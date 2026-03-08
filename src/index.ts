import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import { config, resolvePath } from "./config";
import {
  InteractiveSession,
  getSession,
  registerSession,
  MODEL_ALIASES,
  type ModelAlias,
  type ReplyTarget,
  type SessionMode,
} from "./session";
import {
  getSessionByThreadId,
  deleteSessionByThreadId,
  getActiveSessions,
  setSessionStatus,
  getIdleSessions,
  getSessionById,
  addWorkspace,
  getWorkspace,
  listWorkspaces,
  removeWorkspace,
  setSetting,
  getSetting,
} from "./db";
import { existsSync, mkdirSync } from "fs";
import { t, setLangCache } from "./i18n";
import { createRepo, repoExists, listPRsByHead, getPRComments, parseRepoFromRemote, tokenizeUrl, getAuthenticatedUser, forkRepo } from "./github";
import { run, runSilent } from "./shell";
import { toBranchName, escapeMarkdown, withRetry } from "./utils";

const bot = new Bot(config.BOT_TOKEN);

// --- Auth middleware ---

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== config.ALLOWED_USER_ID) return;
  await next();
});

// --- Setup guard: block everything until /setup is complete ---

function isSetupComplete(): boolean {
  return !!getSetting("default_workspace");
}

bot.use(async (ctx, next) => {
  if (isSetupComplete()) return next();

  const text = ctx.message?.text ?? "";
  if (text.startsWith("/setup")) return next();
  if (text.startsWith("/cancel")) return next();
  if (ctx.callbackQuery?.data?.startsWith("setup:")) return next();
  if (ctx.message && getSetting("setup_step")) return next();

  if (ctx.message) {
    await ctx.reply(t("setup.required"), { parse_mode: "Markdown" });
  }
});

// --- Setup / onboarding ---

const ORBITOS_TEMPLATE = "https://github.com/MarsWang42/OrbitOS";

bot.command("setup", async (ctx) => {
  if (ctx.chat.type === "supergroup") {
    return setupForumTopics(ctx);
  }

  if (ctx.chat.type !== "private") return;

  const existing = getSetting("default_workspace");
  if (existing && getWorkspace(existing)) {
    await ctx.reply(t("setup.already_set_up", { alias: existing }), { parse_mode: "Markdown" });
    return;
  }

  if (!getSetting("setup_lang")) {
    await sendSetupLang(ctx);
  } else {
    await sendSetupChoose(ctx);
  }
});

async function sendSetupLang(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text("English", "setup:lang:EN")
    .text("中文", "setup:lang:CN");

  await ctx.reply("Choose your language / 选择语言：", { reply_markup: keyboard });
}

async function sendSetupChoose(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text(t("setup.btn_new"), "setup:new").row()
    .text(t("setup.btn_existing"), "setup:existing");

  await ctx.reply(
    t("setup.welcome"),
    { reply_markup: keyboard },
  );
}

bot.callbackQuery("setup:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  setSetting("setup_step", "new_repo_name");
  await ctx.editMessageText(
    t("setup.lang_chosen", { lang: getSetting("setup_lang") === "CN" ? "中文" : "English" }),
    { parse_mode: "Markdown" },
  );
});

bot.callbackQuery("setup:existing", async (ctx) => {
  await ctx.answerCallbackQuery();
  setSetting("setup_step", "existing_url");
  await ctx.editMessageText(t("setup.existing_url_prompt"));
});

bot.callbackQuery(/^setup:lang:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const lang = ctx.match![1] as "EN" | "CN";
  setSetting("setup_lang", lang);
  setLangCache(lang);
  const keyboard = new InlineKeyboard()
    .text(t("setup.btn_new"), "setup:new").row()
    .text(t("setup.btn_existing"), "setup:existing");
  await ctx.editMessageText(t("setup.welcome"), { reply_markup: keyboard });
});

bot.callbackQuery("setup:forum:recreate", async (ctx) => {
  await ctx.answerCallbackQuery();
  setSetting("daily_thread_id", "");
  setSetting("inbox_thread_id", "");
  await ctx.editMessageText(t("forum.recreating"), { parse_mode: "Markdown" });
  await setupForumTopics(ctx);
});

bot.callbackQuery("setup:forum:keep", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t("forum.keeping"), { parse_mode: "Markdown" });
});

async function setupForumTopics(ctx: Context) {
  const chatId = ctx.chat!.id;

  if (getSetting("daily_thread_id") && getSetting("inbox_thread_id")) {
    const keyboard = new InlineKeyboard()
      .text(t("forum.btn_recreate"), "setup:forum:recreate").row()
      .text(t("forum.btn_keep"), "setup:forum:keep");
    await ctx.reply(t("forum.already_set_up"), { reply_markup: keyboard });
    return;
  }

  setSetting("forum_chat_id", String(chatId));

  try {
    if (!getSetting("daily_thread_id")) {
      const dailyTopic = await ctx.api.createForumTopic(chatId, "☀️ Daily");
      setSetting("daily_thread_id", String(dailyTopic.message_thread_id));
      const dailyMsg = await ctx.api.sendMessage(chatId, t("forum.daily_ready"), {
        message_thread_id: dailyTopic.message_thread_id,
        parse_mode: "Markdown",
      });
      await ctx.api.pinChatMessage(chatId, dailyMsg.message_id).catch(() => {});
    }

    if (!getSetting("inbox_thread_id")) {
      const inboxTopic = await ctx.api.createForumTopic(chatId, "📥 Inbox");
      setSetting("inbox_thread_id", String(inboxTopic.message_thread_id));
      const inboxMsg = await ctx.api.sendMessage(chatId, t("forum.inbox_ready"), {
        message_thread_id: inboxTopic.message_thread_id,
        parse_mode: "Markdown",
      });
      await ctx.api.pinChatMessage(chatId, inboxMsg.message_id).catch(() => {});
    }

    await ctx.reply(t("forum.setup_complete"), { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Forum setup failed:", err);
    await ctx.reply(t("forum.setup_failed"));
  }
}

// --- Commands ---

bot.command("ws_add", async (ctx) => {
  const args = (ctx.message?.text ?? "").replace(/^\/ws_add\s*/, "").trim().split(/\s+/);
  if (args.length < 2 || !args[0]) {
    await ctx.reply(t("ws.add_usage"));
    return;
  }
  await handleWorkspaceAdd(ctx, args[0], args.slice(1).join(" "));
});

bot.command("ws_list", async (ctx) => {
  await handleWorkspaceList(ctx);
});

bot.command("ws_remove", async (ctx) => {
  const alias = (ctx.message?.text ?? "").replace(/^\/ws_remove\s*/, "").trim();
  if (!alias) {
    await ctx.reply(t("ws.remove_usage"));
    return;
  }
  const removed = removeWorkspace(alias);
  await ctx.reply(removed ? t("ws.removed", { alias }) : t("ws.not_found", { alias }));
});

bot.command("ws_default", async (ctx) => {
  const alias = (ctx.message?.text ?? "").replace(/^\/ws_default\s*/, "").trim();
  if (!alias) {
    await ctx.reply(t("ws.default_usage"));
    return;
  }
  if (!getWorkspace(alias)) {
    await ctx.reply(t("ws.not_found", { alias }));
    return;
  }
  setSetting("default_workspace", alias);
  await ctx.reply(t("ws.default_set", { alias }));
});

bot.command("new", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  const sessionId = `dm-${ctx.from!.id}`;
  getSession(sessionId)?.kill();
  await ctx.reply(t("session.ended"), { parse_mode: "Markdown" });
});

bot.command("stop", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  let session: ReturnType<typeof getSession>;

  if (ctx.chat.type === "private") {
    session = getSession(`dm-${ctx.from!.id}`);
  } else if (threadId !== undefined) {
    session = getSession(`topic-${threadId}`);
  }

  if (session) {
    session.kill();
    await ctx.reply(t("session.stopped"), { parse_mode: "Markdown" });
  } else {
    await ctx.reply(t("session.no_active"), { parse_mode: "Markdown" });
  }
});

// --- /cancel command ---

bot.command("cancel", async (ctx) => {
  const setupStep = getSetting("setup_step");
  const codingStep = getSetting("coding_step");

  if (setupStep) {
    setSetting("setup_step", "");
  }
  if (codingStep) {
    setSetting("coding_step", "");
  }

  await ctx.reply(t("cancel.done"), { parse_mode: "Markdown" });
});

// --- /done command ---

bot.command("done", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply(t("done.use_in_topic"), { parse_mode: "Markdown" });
    return;
  }

  const sessionId = `topic-${threadId}`;
  const session = getSession(sessionId);
  const row = getSessionByThreadId(String(threadId));

  if (session) session.kill();

  const worktreePath = row?.worktree_path;
  if (worktreePath) {
    const ws = row.workspace_alias ? getWorkspace(row.workspace_alias) : null;
    if (ws) {
      const result = await run(["git", "worktree", "remove", worktreePath, "--force"], ws.path);
      if (!result.ok) console.error(`Failed to remove worktree: ${result.stderr}`);
    }
  }

  if (row) {
    setSessionStatus(row.id, "completed");
  }

  await ctx.reply(t("done.completed"), { parse_mode: "Markdown" });

  try {
    await ctx.api.closeForumTopic(ctx.chat!.id, threadId);
  } catch (err) {
    console.error("Failed to close forum topic:", err);
  }
});

// --- /models command ---

bot.command("models", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const key = threadId ? `model:topic:${threadId}` : "model:default";
  const current = getSetting(key) ?? "default";

  const keyboard = new InlineKeyboard();
  for (const alias of MODEL_ALIASES) {
    const label = alias === current ? `${alias} ✓` : alias;
    keyboard.text(label, `models:set:${alias}:${threadId ?? "default"}`);
  }

  await ctx.reply(t("models.select", { current }), { reply_markup: keyboard, parse_mode: "Markdown" });
});

bot.callbackQuery(/^models:set:(\w+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const model = ctx.match![1] as ModelAlias;
  const target = ctx.match![2];
  const key = target === "default" ? "model:default" : `model:topic:${target}`;
  setSetting(key, model);

  if (target !== "default") {
    const session = getSession(`topic-${target}`);
    if (session) session.kill();
  }

  await ctx.editMessageText(t("models.set", { model }), { parse_mode: "Markdown" });
});

// --- /coding command ---

bot.command("coding", async (ctx) => {
  if (ctx.chat.type !== "supergroup") {
    await ctx.reply(t("coding.use_in_group"));
    return;
  }

  const workspaces = listWorkspaces();
  const defaultAlias = getSetting("default_workspace");
  const codingWorkspaces = workspaces.filter((w) => w.alias !== defaultAlias);

  const keyboard = new InlineKeyboard();
  for (const ws of codingWorkspaces) {
    keyboard.text(ws.alias, `coding:ws:${ws.alias}`).row();
  }
  keyboard.text(t("coding.btn_new"), "coding:new");

  await ctx.reply(t("coding.select_project"), { reply_markup: keyboard });
});

bot.callbackQuery("coding:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (config.GH_TOKEN) {
    const keyboard = new InlineKeyboard()
      .text(t("coding.btn_clone"), "coding:clone")
      .text(t("coding.btn_create"), "coding:create");
    await ctx.editMessageText(t("coding.select_project"), { reply_markup: keyboard });
  } else {
    setSetting("coding_step", "awaiting_url");
    await ctx.editMessageText(t("coding.send_url"), { parse_mode: "Markdown" });
  }
});

bot.callbackQuery("coding:clone", async (ctx) => {
  await ctx.answerCallbackQuery();
  setSetting("coding_step", "awaiting_url");
  await ctx.editMessageText(t("coding.send_url"), { parse_mode: "Markdown" });
});

bot.callbackQuery("coding:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  setSetting("coding_step", "awaiting_new_name");
  await ctx.editMessageText(t("coding.send_name"), { parse_mode: "Markdown" });
});

bot.callbackQuery(/^coding:ws:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const alias = ctx.match![1];
  const ws = getWorkspace(alias);
  if (!ws) {
    await ctx.editMessageText(t("coding.ws_not_found"));
    return;
  }
  setSetting("coding_step", `awaiting_task:${alias}`);
  await ctx.editMessageText(t("coding.ws_selected", { alias }), { parse_mode: "Markdown" });
});

bot.callbackQuery(/^coding:plan:approve:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const threadId = Number(ctx.match![1]);
  const sessionId = `topic-${threadId}`;

  const session = getSession(sessionId);
  const planKey = `plan:${threadId}`;
  const plan = session?.planText || getSetting(planKey);
  console.log(`[plan:approve] thread=${threadId} session=${!!session} planInMemory=${!!session?.planText} planInDb=${!!getSetting(planKey)}`);
  if (!plan) {
    await ctx.editMessageText(t("coding.plan_not_found"), { parse_mode: "Markdown" });
    return;
  }

  const row = getSessionByThreadId(String(threadId));
  const wsAlias = row?.workspace_alias;
  const ws = wsAlias ? getWorkspace(wsAlias) : null;
  const cwd = session?.cwd ?? row?.cwd ?? getDefaultCwd();

  if (session) session.kill();

  await ctx.editMessageText(t("coding.executing_plan"), { parse_mode: "Markdown" });

  setSetting(`plan:${threadId}`, "");

  const chatId = ctx.chat!.id;
  const contextPrefix = ws?.repo_url ? `[GitHub repo: ${ws.repo_url}]\n\n` : "";
  const execSession = new InteractiveSession({
    id: sessionId,
    replyTarget: makeApiReplyTarget(chatId, threadId),
    userId: String(ctx.from!.id),
    threadId: String(threadId),
    cwd,
    mode: "coding",
    model: resolveModel(threadId),
    workspaceAlias: wsAlias,
    worktreePath: row?.worktree_path,
    worktreeBranch: row?.worktree_branch,
  });
  registerSession(execSession);
  await execSession.send(`${contextPrefix}Execute this plan:\n\n${plan}`);
});

bot.callbackQuery(/^coding:plan:revise:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t("coding.plan_ready").replace(/\.$/, "") + " \u2014 _send your feedback below._", { parse_mode: "Markdown" });
});

// --- /pr command ---

bot.command("pr", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply(t("pr.use_in_topic"));
    return;
  }

  let session = getSession(`topic-${threadId}`);
  if (!session) {
    const row = getSessionByThreadId(String(threadId));
    if (!row || !row.workspace_alias) {
      await ctx.reply(t("pr.no_session"), { parse_mode: "Markdown" });
      return;
    }
    const ws = getWorkspace(row.workspace_alias);
    if (!ws) {
      await ctx.reply(t("pr.ws_not_found"), { parse_mode: "Markdown" });
      return;
    }
    session = new InteractiveSession({
      id: row.id,
      replyTarget: makeReplyTarget(ctx, threadId),
      userId: String(ctx.from!.id),
      threadId: String(threadId),
      cwd: row.cwd ?? ws.path,
      mode: "coding",
      model: resolveModel(threadId),
      workspaceAlias: row.workspace_alias,
      claudeSessionId: row.claude_session_id,
      worktreePath: row.worktree_path,
      worktreeBranch: row.worktree_branch,
    });
    registerSession(session);
  }

  if (session.mode !== "coding") {
    await ctx.reply(t("pr.not_coding"), { parse_mode: "Markdown" });
    return;
  }

  const cwd = resolvePath(session.cwd);

  const { stdout: branch } = await run(["git", "branch", "--show-current"], cwd);
  if (!branch) {
    await ctx.reply(t("pr.no_branch"), { parse_mode: "Markdown" });
    return;
  }

  const [upstreamResult, originResult] = await Promise.all([
    run(["git", "remote", "get-url", "upstream"], cwd),
    run(["git", "remote", "get-url", "origin"], cwd),
  ]);
  const upstreamUrl = upstreamResult.ok ? upstreamResult.stdout : "";
  const originUrl = originResult.ok ? originResult.stdout : "";

  const upstreamInfo = upstreamUrl ? parseRepoFromRemote(upstreamUrl) : null;
  const originInfo = originUrl ? parseRepoFromRemote(originUrl) : null;
  const isFork = !!upstreamInfo;

  const repoInfo = upstreamInfo ?? originInfo;
  if (!repoInfo) {
    await ctx.reply(t("pr.no_repo"), { parse_mode: "Markdown" });
    return;
  }

  const headOwner = isFork && originInfo ? originInfo.owner : undefined;

  let prs: Awaited<ReturnType<typeof listPRsByHead>>;
  try {
    prs = await listPRsByHead(repoInfo.owner, repoInfo.repo, branch, headOwner);
  } catch (err) {
    await ctx.reply(t("pr.gh_failed"), { parse_mode: "Markdown" });
    return;
  }

  if (prs.length === 0) {
    await ctx.reply(t("pr.no_pr", { branch }), { parse_mode: "Markdown" });
    return;
  }

  const pr = prs[0];

  let comments: Awaited<ReturnType<typeof getPRComments>>;
  try {
    comments = await getPRComments(repoInfo.owner, repoInfo.repo, pr.number);
  } catch {
    comments = [];
  }

  const allComments: string[] = [];
  for (const c of comments) {
    const loc = c.path ? ` (${c.path}${c.line ? `:${c.line}` : ""})` : "";
    if (c.body) allComments.push(`**${c.author}**${loc}: ${c.body}`);
  }

  if (allComments.length === 0) {
    await ctx.reply(t("pr.no_comments", { number: pr.number, title: pr.title, url: pr.url }), { parse_mode: "Markdown" });
    return;
  }

  const commentsText = allComments.join("\n\n");
  const prompt = `Here are the latest PR comments on #${pr.number} (${pr.title}), please address them:\n\n${commentsText}`;
  await ctx.reply(t("pr.feeding", { count: allComments.length }), { parse_mode: "Markdown" });
  await session.send(prompt);
});

// --- Message routing ---

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  let prompt = text;
  const replyText = ctx.message.reply_to_message?.text;
  if (replyText) {
    const preview = replyText.length > 80
      ? replyText.slice(0, 80) + "…"
      : replyText;
    prompt = `[reply to: ${preview}]\n${text}`;
  }

  const setupStep = getSetting("setup_step");
  if (ctx.chat.type === "private" && setupStep) {
    return handleSetupTextInput(ctx, text, setupStep);
  }

  const codingStep = getSetting("coding_step");
  if (ctx.chat.type === "supergroup" && codingStep) {
    return handleCodingTextInput(ctx, text, codingStep);
  }

  const threadId = ctx.message.message_thread_id;

  if (ctx.chat.type === "private") return handleDM(ctx, prompt);
  if (threadId !== undefined) {
    const inboxThreadId = getSetting("inbox_thread_id");
    if (inboxThreadId && String(threadId) === inboxThreadId) {
      return handleInboxReply(ctx, prompt, threadId);
    }
    return handleTopicReply(ctx, prompt, threadId);
  }
  return handleNewTopic(ctx, prompt);
});

// --- Setup ---

async function handleSetupTextInput(ctx: Context, text: string, step: string) {
  const input = text.trim();

  if (step === "existing_url") {
    const isGitUrl = /^https?:\/\//.test(input) || input.endsWith(".git");
    if (!isGitUrl) {
      await ctx.reply(t("setup.invalid_url"));
      return;
    }
    setSetting("setup_step", "");
    await finishSetupWithClone(ctx, input);
    return;
  }

  if (step === "new_repo_name") {
    const repoName = input.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!repoName) {
      await ctx.reply(t("setup.invalid_name"));
      return;
    }

    if (config.GH_TOKEN && await repoExists(repoName)) {
      await ctx.reply(t("setup.repo_name_taken", { name: repoName }), { parse_mode: "Markdown" });
      return;
    }

    setSetting("setup_step", "");

    const lang = getSetting("setup_lang") ?? "EN";
    await ctx.reply(t("setup.creating_vault", { name: repoName, lang }), { parse_mode: "Markdown" });

    const cloneDir = `workspaces/${repoName}`;
    const tmpDir = `workspaces/.orbit-setup-tmp`;
    const cloneResult = await run(["git", "clone", "--depth", "1", ORBITOS_TEMPLATE, tmpDir]);
    if (!cloneResult.ok) {
      await ctx.reply(t("setup.clone_failed", { error: cloneResult.stderr.slice(0, 500) }));
      return;
    }

    const langDir = `${tmpDir}/${lang}`;
    if (!existsSync(langDir)) {
      await runSilent(["rm", "-rf", tmpDir]);
      await ctx.reply(t("setup.lang_folder_missing", { lang }));
      return;
    }

    await runSilent(["mv", langDir, cloneDir]);
    await runSilent(["rm", "-rf", tmpDir]);

    const absPath = `${process.cwd()}/${cloneDir}`;

    if (config.GH_TOKEN) {
      await runSilent(["git", "init", "-b", "main"], absPath);
      await runSilent(["git", "add", "-A"], absPath);
      const commitResult = await run(
        ["git", "-c", "user.name=Orbit", "-c", "user.email=orbit@bot", "commit", "-m", "Initial OrbitOS vault"],
        absPath,
      );
      if (!commitResult.ok) console.error(`Initial commit failed: ${commitResult.stderr}`);

      let repoUrl: string;
      try {
        const ghResult = await createRepo(repoName);
        repoUrl = ghResult.url;
        const tokenizedCloneUrl = tokenizeUrl(ghResult.cloneUrl);
        await runSilent(["git", "remote", "add", "origin", tokenizedCloneUrl], absPath);
        const pushResult = await run(["git", "push", "-u", "origin", "main"], absPath);
        if (!pushResult.ok) throw new Error(pushResult.stderr.slice(0, 300));
      } catch (err: any) {
        addWorkspace(repoName, absPath, null, false);
        setSetting("default_workspace", repoName);
        await ctx.reply(t("setup.vault_created_gh_fail", { error: String(err.message ?? err).slice(0, 300) }));
        return;
      }

      addWorkspace(repoName, absPath, repoUrl, true);
      setSetting("default_workspace", repoName);

      await ctx.reply(
        t("setup.vault_created_gh", { name: repoName, url: repoUrl, path: absPath }),
        { parse_mode: "Markdown" },
      );
    } else {
      await runSilent(["git", "init", "-b", "main"], absPath);
      await runSilent(["git", "add", "-A"], absPath);
      await runSilent(
        ["git", "-c", "user.name=Orbit", "-c", "user.email=orbit@bot", "commit", "-m", "Initial OrbitOS vault"],
        absPath,
      );

      addWorkspace(repoName, absPath, null, false);
      setSetting("default_workspace", repoName);

      await ctx.reply(
        t("setup.vault_created_local", { name: repoName, path: absPath }),
        { parse_mode: "Markdown" },
      );
    }
    return;
  }
}

async function finishSetupWithClone(ctx: Context, url: string) {
  const alias = url.replace(/\.git$/, "").split("/").pop()?.toLowerCase() ?? "vault";
  await ctx.reply(t("setup.cloning", { alias }), { parse_mode: "Markdown" });

  const result = await cloneRepo(alias, url);
  if (!result.ok) {
    setSetting("setup_step", "");
    await ctx.reply(t("setup.clone_failed", { error: result.error }));
    return;
  }

  setSetting("default_workspace", alias);
  setSetting("setup_step", "");
  await ctx.reply(
    t("setup.clone_done", { alias, path: result.path }),
    { parse_mode: "Markdown" },
  );
}

// --- Coding flow ---

async function handleCodingTextInput(ctx: Context, text: string, step: string) {
  if (step === "awaiting_new_name") {
    const repoName = text.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!repoName) {
      await ctx.reply(t("setup.invalid_name"));
      return;
    }

    if (await repoExists(repoName)) {
      await ctx.reply(t("coding.repo_name_taken", { name: repoName }), { parse_mode: "Markdown" });
      return;
    }

    // Claim the step before async work to prevent double-processing
    setSetting("coding_step", "");

    await ctx.reply(t("coding.creating_repo", { name: repoName }), { parse_mode: "Markdown" });

    try {
      const ghResult = await createRepo(repoName);
      const cloneResult = await cloneRepo(repoName, ghResult.cloneUrl);
      if (!cloneResult.ok) {
        await ctx.reply(t("setup.clone_failed", { error: cloneResult.error }));
        return;
      }

      setSetting("coding_step", `awaiting_task:${repoName}`);
      await ctx.reply(t("coding.repo_created", { name: repoName }), { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.reply(t("setup.clone_failed", { error: String(err.message ?? err).slice(0, 500) }));
    }
    return;
  }

  if (step === "awaiting_url") {
    const isGitUrl = /^https?:\/\//.test(text) || text.endsWith(".git");
    if (!isGitUrl) {
      await ctx.reply(t("setup.invalid_url"));
      return;
    }

    const alias = text.replace(/\.git$/, "").split("/").pop()?.toLowerCase() ?? "project";
    const existing = getWorkspace(alias);
    if (existing) {
      setSetting("coding_step", `awaiting_task:${alias}`);
      await ctx.reply(t("coding.already_exists", { alias }), { parse_mode: "Markdown" });
      return;
    }

    // Claim the step before async work to prevent double-processing
    setSetting("coding_step", "");

    let cloneUrl = text;
    const parsed = parseRepoFromRemote(text);
    if (parsed && config.GH_TOKEN) {
      const me = await getAuthenticatedUser();
      if (me && parsed.owner.toLowerCase() !== me.toLowerCase()) {
        await ctx.reply(t("coding.forking", { owner: parsed.owner, repo: parsed.repo }), { parse_mode: "Markdown" });
        try {
          const fork = await forkRepo(parsed.owner, parsed.repo);
          cloneUrl = fork.cloneUrl;
          await ctx.reply(t("coding.forked", { name: fork.fullName }), { parse_mode: "Markdown" });
        } catch (err: any) {
          await ctx.reply(t("setup.clone_failed", { error: String(err.message ?? err).slice(0, 500) }));
          return;
        }
      }
    }

    await ctx.reply(t("setup.cloning", { alias }), { parse_mode: "Markdown" });
    const result = await cloneRepo(alias, cloneUrl);
    if (!result.ok) {
      await ctx.reply(t("setup.clone_failed", { error: result.error }));
      return;
    }

    if (cloneUrl !== text) {
      await runSilent(["git", "remote", "add", "upstream", tokenizeUrl(text)], result.path);
    }

    setSetting("coding_step", `awaiting_task:${alias}`);
    await ctx.reply(t("coding.cloned", { alias }), { parse_mode: "Markdown" });
    return;
  }

  const taskMatch = step.match(/^awaiting_task:(.+)$/);
  if (taskMatch) {
    const alias = taskMatch[1];
    setSetting("coding_step", "");
    await startCodingSession(ctx, alias, text);
    return;
  }
}

async function resolveDefaultBranch(wsPath: string): Promise<string | null> {
  const headRef = await run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "--short"], wsPath);
  if (headRef.ok && headRef.stdout) return headRef.stdout.replace("origin/", "");

  for (const fallback of ["main", "master"]) {
    if (await runSilent(["git", "rev-parse", "--verify", `refs/remotes/origin/${fallback}`], wsPath)) {
      return fallback;
    }
  }
  return null;
}

async function syncWithRemote(wsPath: string, defaultBranch: string): Promise<void> {
  // For forks: fetch upstream and merge into default branch first
  if (await runSilent(["git", "remote", "get-url", "upstream"], wsPath)) {
    const fetch = await run(["git", "fetch", "upstream", defaultBranch], wsPath);
    if (fetch.ok) {
      const merge = await run(["git", "merge", "--ff-only", `upstream/${defaultBranch}`], wsPath);
      if (!merge.ok) console.warn(`Upstream merge failed (continuing): ${merge.stderr}`);
    } else {
      console.warn(`Upstream fetch failed (continuing): ${fetch.stderr}`);
    }
  }

  const pull = await run(["git", "pull", "--ff-only", "origin", defaultBranch], wsPath);
  if (!pull.ok) console.warn(`Pull before worktree failed (continuing): ${pull.stderr}`);
}

async function deduplicateBranch(wsPath: string, branch: string): Promise<string> {
  const { stdout } = await run(["git", "branch", "--list"], wsPath);
  const branchList = stdout.replace(/\*/g, "").split("\n").map(b => b.trim()).filter(Boolean);

  let candidate = branch;
  let suffix = 2;
  while (branchList.includes(candidate)) {
    candidate = `${branch}-${suffix}`;
    suffix++;
  }
  return candidate;
}

async function createWorktree(wsPath: string, alias: string, task: string): Promise<{ worktreePath: string; branch: string } | null> {
  if (!existsSync(`${wsPath}/.git`)) return null;

  try {
    const defaultBranch = await resolveDefaultBranch(wsPath);
    if (defaultBranch) await syncWithRemote(wsPath, defaultBranch);
  } catch (e) {
    console.warn(`Pre-worktree pull skipped: ${e}`);
  }

  let branch = toBranchName(task) || "task";
  branch = await deduplicateBranch(wsPath, branch);

  const worktreeBase = `${process.cwd()}/workspaces/.worktrees/${alias}`;
  const worktreePath = `${worktreeBase}/${branch}`;
  mkdirSync(worktreeBase, { recursive: true });

  const result = await run(["git", "worktree", "add", worktreePath, "-b", branch], wsPath);
  if (!result.ok) {
    console.error(`Failed to create worktree: ${result.stderr}`);
    return null;
  }

  return { worktreePath, branch };
}

async function startCodingSession(ctx: Context, alias: string, task: string) {
  const ws = getWorkspace(alias);
  if (!ws) {
    await ctx.reply(t("ws.not_found", { alias }), { parse_mode: "Markdown" });
    return;
  }

  const chatId = ctx.chat!.id;
  const topicName = `\u{1F528} [${alias}] ${task.slice(0, 78 - alias.length - 3)}`;

  try {
    const worktree = await createWorktree(ws.path, alias, task);
    const sessionCwd = worktree?.worktreePath ?? ws.path;

    const topic = await ctx.api.createForumTopic(chatId, topicName);
    const threadId = topic.message_thread_id;

    const session = new InteractiveSession({
      id: `topic-${threadId}`,
      replyTarget: makeReplyTarget(ctx, threadId),
      userId: String(ctx.from!.id),
      threadId: String(threadId),
      cwd: sessionCwd,
      mode: "coding",
      planMode: true,
      model: resolveModel(),
      workspaceAlias: alias,
      worktreePath: worktree?.worktreePath ?? null,
      worktreeBranch: worktree?.branch ?? null,
      onPlanReady: (plan) => {
        setSetting(`plan:${threadId}`, plan);
        const keyboard = new InlineKeyboard()
          .text(t("coding.btn_approve"), `coding:plan:approve:${threadId}`)
          .text(t("coding.btn_revise"), `coding:plan:revise:${threadId}`);
        bot.api.sendMessage(chatId, t("coding.plan_ready"), {
          message_thread_id: threadId,
          reply_markup: keyboard,
        }).catch(console.error);
      },
    });
    registerSession(session);

    await ctx.api.sendMessage(chatId, task, { message_thread_id: threadId }).catch((err) => console.error("Failed to post task:", err));

    let contextLines: string[] = [];
    if (ws.repo_url) contextLines.push(t("prompt.coding_context_repo", { url: ws.repo_url }));
    if (worktree) {
      contextLines.push(t("prompt.coding_context_worktree", { path: worktree.worktreePath }));
      contextLines.push(t("prompt.coding_context_branch", { branch: worktree.branch }));
    }
    const contextPrefix = contextLines.length > 0 ? contextLines.join("\n") + "\n\n" : "";
    await session.send(contextPrefix + task);

    await postTopicLink(chatId, threadId, topicName);
  } catch (err) {
    console.error("Failed to create coding topic:", err);
    await ctx.reply(t("coding.topic_failed")).catch(console.error);
  }
}

// --- Session restore helper ---

function getOrRestoreSession(opts: {
  sessionId: string;
  replyTarget: ReplyTarget;
  userId: string;
  threadId: string | null;
  cwd: string;
  mode: SessionMode;
  model: ModelAlias | null;
  workspaceAlias: string | null;
}): InteractiveSession | null {
  const existing = getSession(opts.sessionId);
  if (existing) {
    existing.updateReplyTarget(opts.replyTarget);
    return existing;
  }

  const row = opts.threadId
    ? getSessionByThreadId(opts.threadId)
    : getSessionById(opts.sessionId);

  if (row?.status === "completed") return null;

  const session = new InteractiveSession({
    id: row?.id ?? opts.sessionId,
    replyTarget: opts.replyTarget,
    userId: opts.userId,
    threadId: opts.threadId,
    cwd: row?.cwd ?? opts.cwd,
    mode: (row?.mode as SessionMode) ?? opts.mode,
    model: opts.model,
    workspaceAlias: row?.workspace_alias ?? opts.workspaceAlias,
    claudeSessionId: row?.claude_session_id,
    worktreePath: row?.worktree_path,
    worktreeBranch: row?.worktree_branch,
  });
  registerSession(session);
  return session;
}

// --- Topic link helper ---

async function postTopicLink(chatId: number, threadId: number, name: string) {
  const linkChatId = String(chatId).replace(/^-100/, "");
  const topicUrl = `https://t.me/c/${linkChatId}/${threadId}`;
  await bot.api.sendMessage(chatId, `[${escapeMarkdown(name)}](${topicUrl})`, {
    parse_mode: "MarkdownV2",
  }).catch((err) => console.error("Failed to post topic link:", err));
}

// --- Handlers ---

async function handleDM(ctx: Context, prompt: string) {
  const userId = String(ctx.from!.id);
  const sessionId = `dm-${userId}`;

  const session = getOrRestoreSession({
    sessionId,
    replyTarget: makeReplyTarget(ctx),
    userId,
    threadId: null,
    cwd: getDefaultCwd(),
    mode: "vault",
    model: resolveModel(),
    workspaceAlias: getSetting("default_workspace"),
  })!;

  await session.send(prompt);
}

async function handleInboxReply(ctx: Context, prompt: string, threadId: number) {
  const session = getOrRestoreSession({
    sessionId: `topic-${threadId}`,
    replyTarget: makeReplyTarget(ctx, threadId),
    userId: String(ctx.from!.id),
    threadId: String(threadId),
    cwd: getDefaultCwd(),
    mode: "inbox",
    model: resolveModel(threadId),
    workspaceAlias: getSetting("default_workspace"),
  })!;

  await session.send(prompt);
}

async function handleTopicReply(ctx: Context, prompt: string, threadId: number) {
  const session = getOrRestoreSession({
    sessionId: `topic-${threadId}`,
    replyTarget: makeReplyTarget(ctx, threadId),
    userId: String(ctx.from!.id),
    threadId: String(threadId),
    cwd: getDefaultCwd(),
    mode: "vault",
    model: resolveModel(threadId),
    workspaceAlias: getSetting("default_workspace"),
  });

  if (!session) {
    await ctx.reply(t("done.already_completed"), { parse_mode: "Markdown" });
    return;
  }

  await session.send(prompt);
}

async function handleNewTopic(ctx: Context, prompt: string) {
  const chatId = ctx.chat!.id;
  const defaultAlias = getSetting("default_workspace");
  const cleanText = prompt.replace(/^\[reply to: [^\]]*\]\n/, "");
  const topicName = `\u{1F4AD} [Orbit] ${cleanText.slice(0, 70) || "Claude session"}`;

  try {
    const topic = await ctx.api.createForumTopic(chatId, topicName);
    const threadId = topic.message_thread_id;

    const session = new InteractiveSession({
      id: `topic-${threadId}`,
      replyTarget: makeReplyTarget(ctx, threadId),
      userId: String(ctx.from!.id),
      threadId: String(threadId),
      cwd: getDefaultCwd(),
      model: resolveModel(threadId),
      workspaceAlias: defaultAlias,
    });
    registerSession(session);

    await ctx.api.sendMessage(chatId, prompt, { message_thread_id: threadId }).catch((err) => console.error("Failed to post prompt:", err));

    await session.send(prompt);

    await postTopicLink(chatId, threadId, topicName);
  } catch (err) {
    console.error("Failed to create forum topic:", err);
    await ctx.reply(t("error.topic_failed")).catch(console.error);
  }
}

// --- Workspace commands ---

async function cloneRepo(alias: string, repoUrl: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const cloneDir = `workspaces/${alias}`;
  const cloneUrl = tokenizeUrl(repoUrl);

  const result = await run(["git", "clone", cloneUrl, cloneDir]);
  if (!result.ok) return { ok: false, error: result.stderr.slice(0, 500) };

  const absPath = `${process.cwd()}/${cloneDir}`;
  addWorkspace(alias, absPath, repoUrl, true);
  return { ok: true, path: absPath };
}

async function handleWorkspaceAdd(ctx: Context, alias: string, target: string) {
  const isGitUrl = /^https?:\/\//.test(target) || target.endsWith(".git");

  if (isGitUrl) {
    await ctx.reply(t("ws.cloning", { alias }));
    const result = await cloneRepo(alias, target);
    if (!result.ok) {
      await ctx.reply(t("setup.clone_failed", { error: result.error }));
      return;
    }
    await ctx.reply(t("ws.added_sync", { alias, path: result.path }));
  } else {
    const resolved = resolvePath(target);
    if (!existsSync(resolved)) mkdirSync(resolved, { recursive: true });
    addWorkspace(alias, resolved, null, false);
    await ctx.reply(t("ws.added", { alias, path: resolved }));
  }
}

async function handleWorkspaceList(ctx: Context) {
  const workspaces = listWorkspaces();
  if (workspaces.length === 0) {
    await ctx.reply(t("ws.none"));
    return;
  }

  const defaultAlias = getSetting("default_workspace");
  const lines = workspaces.map((w) => {
    const flags = [
      w.alias === defaultAlias && "default",
      w.sync && "sync",
    ].filter(Boolean).join(", ");
    const suffix = flags ? ` (${flags})` : "";
    return `- *${w.alias}*${suffix}: ${w.path}`;
  });
  await ctx.reply(lines.join("\n"));
}

function resolveModel(threadId?: number | string | null): ModelAlias | null {
  if (threadId) {
    const topicModel = getSetting(`model:topic:${threadId}`);
    if (topicModel) return topicModel as ModelAlias;
  }
  const defaultModel = getSetting("model:default");
  return defaultModel ? defaultModel as ModelAlias : null;
}

function getDefaultCwd(): string {
  const defaultAlias = getSetting("default_workspace");
  if (defaultAlias) {
    const ws = getWorkspace(defaultAlias);
    if (ws) return ws.path;
  }
  return resolvePath(config.DEFAULT_CWD);
}

// --- ReplyTarget factory ---

function makeReplyTarget(ctx: Context, threadId?: number): ReplyTarget {
  return makeApiReplyTarget(ctx.chat!.id, threadId);
}

function makeApiReplyTarget(chatId: number, threadId?: number): ReplyTarget {
  return {
    async send(text: string): Promise<number> {
      const opts: Record<string, any> = { parse_mode: "Markdown" };
      if (threadId !== undefined) opts.message_thread_id = threadId;
      try {
        const msg = await withRetry(() => bot.api.sendMessage(chatId, text, opts));
        return msg.message_id;
      } catch (err: any) {
        if (err?.description?.includes("can't parse entities")) {
          const plainOpts: Record<string, any> = {};
          if (threadId !== undefined) plainOpts.message_thread_id = threadId;
          const msg = await withRetry(() => bot.api.sendMessage(chatId, text, plainOpts));
          return msg.message_id;
        }
        throw err;
      }
    },
    async edit(messageId: number, text: string): Promise<void> {
      try {
        await withRetry(() => bot.api.editMessageText(chatId, messageId, text, { parse_mode: "Markdown" }));
      } catch (err: any) {
        if (err?.description?.includes("can't parse entities")) {
          await withRetry(() => bot.api.editMessageText(chatId, messageId, text));
          return;
        }
        throw err;
      }
    },
    async sendFile(filePath: string): Promise<void> {
      const opts: Record<string, any> = {};
      if (threadId !== undefined) opts.message_thread_id = threadId;
      await withRetry(() => bot.api.sendDocument(chatId, new InputFile(filePath), opts));
    },
  };
}

// --- Startup ---

console.log("Starting Orbit (Telegram)...");

for (const row of getActiveSessions()) {
  setSessionStatus(row.id, "reaped");
  console.log(`Reaped stale session ${row.id}`);
}

setInterval(() => {
  for (const row of getIdleSessions()) {
    const session = getSession(row.id);
    if (session) {
      console.log(`Reaping idle session ${row.id}`);
      session.kill();
    } else {
      setSessionStatus(row.id, "reaped");
    }
  }
}, 60_000);

// --- Daily cron ---

function startDailyCron() {
  const check = () => {
    const now = new Date();
    const chatId = getSetting("forum_chat_id");
    const threadId = getSetting("daily_thread_id");
    if (!chatId || !threadId) return;

    const lastRun = getSetting("daily_last_run");
    const today = now.toISOString().slice(0, 10);
    if (lastRun === today) return;

    if (now.getHours() >= config.DAILY_HOUR) {
      console.log("Running daily routine...");
      setSetting("daily_last_run", today);
      runDaily(Number(chatId), Number(threadId));
    }
  };

  setInterval(check, 60_000);
  check();
}

function runDaily(chatId: number, threadId: number) {
  const sessionId = `daily-${new Date().toISOString().slice(0, 10)}`;
  const cwd = getDefaultCwd();

  deleteSessionByThreadId(String(threadId));
  const target = makeApiReplyTarget(chatId, threadId);

  const session = new InteractiveSession({
    id: sessionId,
    replyTarget: target,
    userId: String(config.ALLOWED_USER_ID),
    threadId: String(threadId),
    cwd,
    model: resolveModel(threadId),
    workspaceAlias: getSetting("default_workspace"),
  });
  registerSession(session);
  session.send(config.DAILY_PROMPT);
}

// --- Start ---

bot.start({
  onStart: async (info) => {
    console.log(`Bot started as @${info.username}`);
    await bot.api.setMyCommands([
      { command: "setup", description: t("cmd.setup") },
      { command: "coding", description: t("cmd.coding") },
      { command: "pr", description: t("cmd.pr") },
      { command: "done", description: t("cmd.done") },
      { command: "stop", description: t("cmd.stop") },
      { command: "new", description: t("cmd.new") },
      { command: "ws_add", description: t("cmd.ws_add") },
      { command: "ws_list", description: t("cmd.ws_list") },
      { command: "ws_remove", description: t("cmd.ws_remove") },
      { command: "ws_default", description: t("cmd.ws_default") },
      { command: "models", description: t("cmd.models") },
      { command: "cancel", description: t("cmd.cancel") },
    ]);
    startDailyCron();
  },
});
