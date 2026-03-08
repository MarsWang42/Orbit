import type { Subprocess } from "bun";
import { StreamProcessor } from "./stream-processor";
import { resolvePath } from "./config";
import {
  upsertSession,
  setClaudeSessionId,
  touchSession,
  setSessionStatus,
  getWorkspace,
  getSetting,
  type WorkspaceRow,
} from "./db";
import { tokenizeUrl } from "./github";
import { t } from "./i18n";

export interface ReplyTarget {
  send(text: string): Promise<number>;
  edit(messageId: number, text: string): Promise<void>;
  sendFile(path: string): Promise<void>;
}

const MAX_MSG_LEN = 4000;
const FLUSH_INTERVAL_MS = 1500;
function buildVaultSystemPrompt(): string {
  return `${t("prompt.telegram_base")} ${t("prompt.vault_extra")} ${t("prompt.no_interactive_tools")}`;
}

function buildInboxSystemPrompt(): string {
  return `${t("prompt.telegram_base")} ${t("prompt.inbox_extra")} ${t("prompt.vault_extra")} ${t("prompt.no_interactive_tools")}`;
}

function buildCodingSystemPrompt(planMode = false): string {
  let prompt = `${t("prompt.telegram_base")} ${t("prompt.coding_extra")}`;
  const vaultAlias = getSetting("default_workspace");
  if (vaultAlias) {
    const vault = getWorkspace(vaultAlias);
    if (vault) {
      const vaultPath = resolvePath(vault.path);
      prompt += ` ${t("prompt.coding_vault_access", { path: vaultPath })}`;
    }
  }
  if (planMode) {
    prompt += ` ${t("prompt.plan_mode")}`;
  }
  return prompt;
}

export type SessionMode = "vault" | "coding" | "inbox";
const FILE_EXTENSIONS_TO_UPLOAD = new Set([
  ".md", ".txt",
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".doc", ".docx", ".xls", ".xlsx", ".csv", ".json",
  ".zip", ".tar", ".gz",
]);

export type ModelAlias = "opus" | "sonnet" | "haiku";
export const MODEL_ALIASES: ModelAlias[] = ["opus", "sonnet", "haiku"];

export class InteractiveSession {
  readonly id: string;
  readonly cwd: string;
  readonly mode: SessionMode;
  readonly planMode: boolean;
  readonly model: ModelAlias | null;
  planText = "";
  private claudeSessionId: string | null;
  private proc: Subprocess | null = null;
  private streamProcessor: StreamProcessor;
  private replyTarget: ReplyTarget;
  private workspaceAlias: string | null;
  private lastPrompt = "";
  private onPlanReady: ((plan: string) => void) | null = null;

  private accumulatedText = "";
  private currentMessageId: number | null = null;
  private currentMessageText = "";
  private statusMessageId: number | null = null;
  private currentStatus = "";
  private hadToolUse = false;

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pendingFlush = false;
  private flushLock: Promise<void> = Promise.resolve();
  private statusLock: Promise<void> = Promise.resolve();
  private pendingStatus: string | null = null;

  isStreaming = false;
  private inputQueue: string[] = [];

  constructor(opts: {
    id: string;
    replyTarget: ReplyTarget;
    userId: string;
    threadId: string | null;
    cwd: string;
    mode?: SessionMode;
    planMode?: boolean;
    model?: ModelAlias | null;
    workspaceAlias?: string | null;
    claudeSessionId?: string | null;
    onPlanReady?: (plan: string) => void;
    worktreePath?: string | null;
    worktreeBranch?: string | null;
  }) {
    this.id = opts.id;
    this.replyTarget = opts.replyTarget;
    this.cwd = opts.cwd;
    this.mode = opts.mode ?? "vault";
    this.planMode = opts.planMode ?? false;
    this.model = opts.model ?? null;
    this.workspaceAlias = opts.workspaceAlias ?? null;
    this.claudeSessionId = opts.claudeSessionId ?? null;
    this.onPlanReady = opts.onPlanReady ?? null;

    this.streamProcessor = new StreamProcessor({
      onInit: (sid) => {
        this.claudeSessionId = sid;
        setClaudeSessionId(this.id, sid);
      },
      onText: (text) => {
        this.setStatus(t("status.generating"));
        if (this.hadToolUse && this.accumulatedText) {
          this.accumulatedText += "\n\n---\n\n";
          this.hadToolUse = false;
        }
        this.accumulatedText += text;
        this.pendingFlush = true;
      },
      onToolUse: (name, input) => {
        this.hadToolUse = true;
        this.setStatus(this.formatToolUse(name, input));
      },
      onToolResult: () => {
        this.setStatus(t("status.thinking"));
      },
      onResult: () => {
        this.scheduleFlush();
        this.finishResponse();
      },
      onError: (err) => {
        this.replyTarget.send(t("error.prefix", { message: String(err) })).catch(console.error);
        this.finishResponse();
      },
    });

    upsertSession(this.id, this.claudeSessionId, opts.threadId, opts.userId, this.cwd, this.workspaceAlias, this.mode, opts.worktreePath, opts.worktreeBranch);
  }

  updateReplyTarget(target: ReplyTarget) {
    this.replyTarget = target;
  }

  get alive(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async send(prompt: string) {
    if (this.isStreaming) {
      this.inputQueue.push(prompt);
      return;
    }

    this.lastPrompt = prompt;
    touchSession(this.id);
    this.isStreaming = true;
    this.accumulatedText = "";
    this.currentMessageId = null;
    this.currentMessageText = "";
    this.hadToolUse = false;

    this.setStatus(t("status.thinking"));

    if (!this.alive) await this.spawn();

    const payload = JSON.stringify({
      type: "user",
      message: { role: "user", content: prompt },
      session_id: this.claudeSessionId ?? "default",
      parent_tool_use_id: null,
    }) + "\n";

    const stdin = this.proc!.stdin as import("bun").FileSink;
    stdin.write(payload);
    stdin.flush();
    this.startFlushTimer();
  }

  kill() {
    this.stopFlushTimer();
    this.isStreaming = false;
    this.inputQueue.length = 0;
    if (this.alive) this.proc!.kill("SIGTERM");
    this.proc = null;
    setSessionStatus(this.id, "reaped");
  }

  // --- Process lifecycle ---

  private async spawn() {
    const args = [
      "claude", "-p",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--max-turns", "25",
      "--system-prompt", this.mode === "coding" ? buildCodingSystemPrompt(this.planMode)
        : this.mode === "inbox" ? buildInboxSystemPrompt()
        : buildVaultSystemPrompt(),
    ];
    if (this.model) args.push("--model", this.model);
    if (this.claudeSessionId) args.push("-r", this.claudeSessionId);

    const cwd = resolvePath(this.cwd);
    console.log(`[${this.id}] spawn: ${args.join(" ")} (cwd: ${cwd})`);

    try {
      const proc = Bun.spawn(args, {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd,
        env: { ...process.env, CLAUDECODE: "" } as Record<string, string>,
      });

      this.proc = proc;
      setSessionStatus(this.id, "active");

      this.pipeStream(proc.stdout as ReadableStream<Uint8Array>, (chunk) =>
        this.streamProcessor.feed(chunk),
      );
      this.pipeStream(proc.stderr as ReadableStream<Uint8Array>, (chunk) => {
        if (chunk.trim()) console.error(`[${this.id}] stderr: ${chunk.trim()}`);
      });

      proc.exited.then((code) => {
        console.log(`[${this.id}] exited code=${code}`);
        this.streamProcessor.flush();
        if (this.isStreaming) this.finishResponse();
        setSessionStatus(this.id, "reaped");
      });
    } catch (err) {
      console.error(`[${this.id}] spawn failed:`, err);
      this.replyTarget.send(t("error.spawn_failed")).catch(console.error);
      this.isStreaming = false;
    }
  }

  private async pipeStream(stream: ReadableStream<Uint8Array> | null, handler: (text: string) => void) {
    if (!stream) return;
    const decoder = new TextDecoder();
    try {
      for await (const chunk of stream) {
        handler(typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true }));
      }
    } catch (err) {
      console.error(`[${this.id}] stream error:`, err);
    }
  }

  private setStatus(text: string) {
    this.pendingStatus = `\u{1F916} _${this.model ?? "default"}_\n${text}`;
    this.statusLock = this.statusLock.then(() => this.doSetStatus());
  }

  private async doSetStatus() {
    const text = this.pendingStatus;
    if (!text || text === this.currentStatus) return;
    this.currentStatus = text;
    this.pendingStatus = null;
    try {
      if (this.statusMessageId) {
        await this.replyTarget.edit(this.statusMessageId, text);
      } else {
        this.statusMessageId = await this.replyTarget.send(text);
      }
    } catch {
      // Edit failed — keep existing message ID to avoid duplicates
    }
  }

  private async clearStatus() {
    this.pendingStatus = null;
    const done = this.statusLock.then(async () => {
      if (!this.statusMessageId) return;
      try {
        await this.replyTarget.edit(this.statusMessageId, t("status.done"));
      } catch { }
      this.statusMessageId = null;
      this.currentStatus = "";
    });
    this.statusLock = done;
    await done;
  }

  private formatToolUse(name: string, input: Record<string, any>): string {
    switch (name) {
      case "Read":
        return t("tool.read", { path: input.file_path ?? "file" });
      case "Edit":
        return t("tool.edit", { path: input.file_path ?? "file" });
      case "Write":
        return t("tool.write", { path: input.file_path ?? "file" });
      case "Bash":
        return t("tool.bash", { command: (input.command ?? "").slice(0, 80) });
      case "Glob":
        return t("tool.glob", { pattern: input.pattern ?? "files" });
      case "Grep":
        return t("tool.grep", { pattern: (input.pattern ?? "").slice(0, 60) });
      case "WebFetch":
        return t("tool.webfetch", { url: input.url ?? "URL" });
      case "WebSearch":
        return t("tool.websearch", { query: input.query ?? "" });
      default:
        return t("tool.default", { name });
    }
  }

  // --- Message flushing ---

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (this.pendingFlush) {
        this.scheduleFlush();
        this.pendingFlush = false;
      }
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private scheduleFlush() {
    this.flushLock = this.flushLock.then(() => this.doFlush());
  }

  private async doFlush() {
    while (true) {
      const newContent = this.accumulatedText.slice(this.currentMessageText.length);
      if (!newContent) return;

      const fullText = this.currentMessageText + newContent;

      if (fullText.length <= MAX_MSG_LEN) {
        if (this.currentMessageId) {
          await this.editMsg(this.currentMessageId, fullText);
          this.currentMessageText = fullText;
        } else {
          await this.sendMsg(fullText);
        }
        return;
      }

      // Text exceeds limit — split and send a chunk
      const splitAt = this.findSplitPoint(fullText, MAX_MSG_LEN);
      const chunk = fullText.slice(0, splitAt);
      const overflow = fullText.slice(splitAt);

      if (this.currentMessageId) {
        await this.editMsg(this.currentMessageId, chunk);
      } else {
        await this.sendMsg(chunk);
      }

      // Reset for next chunk
      this.currentMessageId = null;
      this.currentMessageText = "";
      this.accumulatedText = overflow;
    }
  }

  private findSplitPoint(text: string, limit: number): number {
    return findSplitPoint(text, limit);
  }

  private async sendMsg(text: string) {
    try {
      const msgId = await this.replyTarget.send(text || "\u200b");
      this.currentMessageId = msgId;
      this.currentMessageText = text;
    } catch (err) {
      console.error(`[${this.id}] send failed:`, err);
    }
  }

  private async editMsg(msgId: number, text: string) {
    try {
      await this.replyTarget.edit(msgId, text || "\u200b");
    } catch {
      this.currentMessageId = null;
      this.currentMessageText = "";
      await this.sendMsg(text);
    }
  }

  // --- Response lifecycle ---

  private finishResponse() {
    this.stopFlushTimer();

    this.flushLock = this.flushLock.then(async () => {
      if (this.accumulatedText && this.accumulatedText !== this.currentMessageText) {
        await this.doFlush();
      }

      this.isStreaming = false;
      await this.clearStatus();

      if (this.planMode && this.onPlanReady && this.accumulatedText) {
        this.planText = this.accumulatedText;
        this.onPlanReady(this.planText);
      }

      if ((this.mode === "vault" || this.mode === "inbox") && this.workspaceAlias && this.workspaceAlias === getSetting("default_workspace")) {
        await this.uploadNewFiles();
        await this.maybeAutoSync();
      }

      if (this.inputQueue.length > 0) {
        this.send(this.inputQueue.shift()!);
      }
    });
  }

  private async uploadNewFiles() {
    const cwd = resolvePath(this.cwd);

    // Get modified/deleted tracked files with status, and untracked (new) files
    const proc = Bun.spawn(
      ["git", "-c", "core.quotePath=false", "diff", "--name-status"],
      { cwd, stdout: "pipe", stderr: "ignore" },
    );
    const untrackedProc = Bun.spawn(
      ["git", "-c", "core.quotePath=false", "ls-files", "--others", "--exclude-standard"],
      { cwd, stdout: "pipe", stderr: "ignore" },
    );

    const [diffOutput, untrackedOutput] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(untrackedProc.stdout).text(),
    ]);
    await Promise.all([proc.exited, untrackedProc.exited]);

    // Parse tracked changes: "M\tfile.md", "D\tfile.md", etc.
    const tracked = diffOutput.trim().split("\n").filter(Boolean).map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status: status as string, file: rest.join("\t") };
    });
    // Untracked files are all new additions
    const untracked = untrackedOutput.trim().split("\n").filter(Boolean).map((file) => ({
      status: "A",
      file,
    }));

    const changes = [...tracked, ...untracked];
    if (changes.length === 0) return;
    console.log(`[${this.id}] changed files: ${changes.map((c) => `${c.status} ${c.file}`).join(", ")}`);

    // Send status summary
    const statusIcons: Record<string, string> = { A: "📄", M: "✏️", D: "🗑" };
    const summary = changes
      .map((c) => `${statusIcons[c.status] ?? "🔧"} \`${c.file}\``)
      .join("\n");
    await this.replyTarget.send(summary);

    // Upload non-deleted files with matching extensions
    for (const { status, file } of changes) {
      if (status === "D") continue;
      const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
      if (!FILE_EXTENSIONS_TO_UPLOAD.has(ext)) continue;

      const fullPath = `${cwd}/${file}`;
      try {
        await this.replyTarget.sendFile(fullPath);
        console.log(`[${this.id}] uploaded: ${file}`);
      } catch (err) {
        console.error(`[${this.id}] file upload failed (${file}):`, err);
      }
    }
  }

  private async maybeAutoSync() {
    const cwd = resolvePath(this.cwd);
    const commitMsg = this.lastPrompt.slice(0, 72).replace(/'/g, "'\\''");

    // Always commit; only push if workspace has sync enabled
    const ws = this.workspaceAlias ? getWorkspace(this.workspaceAlias) : null;

    // Ensure remote URL has token embedded for push auth
    if (ws?.sync) {
      const remoteProc = Bun.spawn(["git", "remote", "get-url", "origin"], { cwd, stdout: "pipe", stderr: "ignore" });
      const remoteUrl = (await new Response(remoteProc.stdout).text()).trim();
      if (remoteUrl && !remoteUrl.includes("@github.com")) {
        const tokenized = tokenizeUrl(remoteUrl);
        if (tokenized !== remoteUrl) {
          await Bun.spawn(["git", "remote", "set-url", "origin", tokenized], { cwd, stdout: "ignore", stderr: "ignore" }).exited;
        }
      }
    }

    const pushStr = ws?.sync ? " && git push" : "";

    const proc = Bun.spawn(["sh", "-c", `git add -A && git diff --cached --quiet || git -c user.name=Orbit -c user.email=orbit@bot commit -m 'orbit: ${commitMsg}'${pushStr}`], {
      cwd,
      stdout: "ignore",
      stderr: "pipe",
    });
    const code = await proc.exited;

    if (code !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error(`[${this.id}] auto-sync failed (code=${code}): ${stderr.trim()}`);
    } else {
      console.log(`[${this.id}] auto-sync complete`);
    }
  }
}

export function findSplitPoint(text: string, limit: number): number {
  const region = text.slice(0, limit);

  const fences = region.match(/```/g);
  if (fences && fences.length % 2 !== 0) {
    const lastFence = region.lastIndexOf("```");
    if (lastFence > 0) {
      const nl = region.lastIndexOf("\n", lastFence);
      return nl > 0 ? nl : lastFence;
    }
  }

  const lastNewline = region.lastIndexOf("\n");
  return lastNewline > limit * 0.5 ? lastNewline : limit;
}

// --- In-memory session registry ---

const sessions = new Map<string, InteractiveSession>();

export function getSession(id: string): InteractiveSession | undefined {
  return sessions.get(id);
}

export function registerSession(session: InteractiveSession) {
  sessions.set(session.id, session);
}
