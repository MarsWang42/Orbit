import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";

mkdirSync("data", { recursive: true });
const db = new Database("data/orbit.db", { create: true });
db.run("PRAGMA journal_mode=WAL;");

// --- Migrations ---
// Each entry runs exactly once, in order. Append-only — never edit past entries.

const migrations: string[] = [
  // v1: initial schema
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT,
    thread_id TEXT UNIQUE,
    user_id TEXT,
    cwd TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workspaces (
    alias TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    repo_url TEXT,
    sync INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,

  // v2: track which workspace a session belongs to
  `ALTER TABLE sessions ADD COLUMN workspace_alias TEXT;`,

  // v3: persist session mode (vault vs coding)
  `ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'vault';`,

  // v4: git worktree support for concurrent workspace tasks
  `ALTER TABLE sessions ADD COLUMN worktree_path TEXT;
   ALTER TABLE sessions ADD COLUMN worktree_branch TEXT;`,
];

function migrate() {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (current >= migrations.length) return;

  console.log(`DB at v${current}, applying ${migrations.length - current} migration(s)...`);
  db.transaction(() => {
    for (let i = current; i < migrations.length; i++) {
      for (const stmt of migrations[i].split(";").map((s) => s.trim()).filter(Boolean)) {
        db.run(stmt);
      }
    }
    db.run(`PRAGMA user_version = ${migrations.length}`);
  })();
  console.log(`DB migrated to v${migrations.length}`);
}

migrate();

// --- Prepared statements ---

const stmts = {
  upsert: db.prepare(`
    INSERT INTO sessions (id, claude_session_id, thread_id, user_id, cwd, workspace_alias, mode, worktree_path, worktree_branch, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ON CONFLICT(id) DO UPDATE SET
      claude_session_id = COALESCE(excluded.claude_session_id, claude_session_id),
      workspace_alias = COALESCE(excluded.workspace_alias, workspace_alias),
      mode = COALESCE(excluded.mode, mode),
      worktree_path = COALESCE(excluded.worktree_path, worktree_path),
      worktree_branch = COALESCE(excluded.worktree_branch, worktree_branch),
      status = 'active',
      last_activity_at = datetime('now')
  `),
  setClaudeSessionId: db.prepare(`
    UPDATE sessions SET claude_session_id = ?, last_activity_at = datetime('now') WHERE id = ?
  `),
  touch: db.prepare(`
    UPDATE sessions SET last_activity_at = datetime('now') WHERE id = ?
  `),
  setStatus: db.prepare(`
    UPDATE sessions SET status = ? WHERE id = ?
  `),
  getByThreadId: db.prepare(`
    SELECT * FROM sessions WHERE thread_id = ?
  `),
  deleteByThreadId: db.prepare(`
    DELETE FROM sessions WHERE thread_id = ?
  `),
  getById: db.prepare(`
    SELECT * FROM sessions WHERE id = ?
  `),
  getActive: db.prepare(`
    SELECT * FROM sessions WHERE status = 'active'
  `),
  getIdle: db.prepare(`
    SELECT * FROM sessions WHERE status = 'active'
      AND last_activity_at < datetime('now', '-10 minutes')
  `),

  // Workspace statements
  addWorkspace: db.prepare(`
    INSERT OR REPLACE INTO workspaces (alias, path, repo_url, sync) VALUES (?, ?, ?, ?)
  `),
  getWorkspace: db.prepare(`
    SELECT * FROM workspaces WHERE alias = ?
  `),
  listWorkspaces: db.prepare(`
    SELECT * FROM workspaces ORDER BY alias
  `),
  removeWorkspace: db.prepare(`
    DELETE FROM workspaces WHERE alias = ?
  `),

  // Settings
  setSetting: db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `),
  getSetting: db.prepare(`
    SELECT value FROM settings WHERE key = ?
  `),
};

// --- Session types & functions ---

export interface SessionRow {
  id: string;
  claude_session_id: string | null;
  thread_id: string | null;
  user_id: string;
  cwd: string | null;
  workspace_alias: string | null;
  mode: string;
  worktree_path: string | null;
  worktree_branch: string | null;
  status: string;
  created_at: string;
  last_activity_at: string;
}

export function upsertSession(
  id: string,
  claudeSessionId: string | null,
  threadId: string | null,
  userId: string,
  cwd: string | null,
  workspaceAlias?: string | null,
  mode?: string,
  worktreePath?: string | null,
  worktreeBranch?: string | null,
) {
  stmts.upsert.run(id, claudeSessionId, threadId, userId, cwd, workspaceAlias ?? null, mode ?? "vault", worktreePath ?? null, worktreeBranch ?? null);
}

export function setClaudeSessionId(sessionId: string, claudeSessionId: string) {
  stmts.setClaudeSessionId.run(claudeSessionId, sessionId);
}

export function touchSession(id: string) {
  stmts.touch.run(id);
}

export function setSessionStatus(id: string, status: string) {
  stmts.setStatus.run(status, id);
}

export function getSessionByThreadId(threadId: string): SessionRow | null {
  return stmts.getByThreadId.get(threadId) as SessionRow | null;
}

export function deleteSessionByThreadId(threadId: string) {
  stmts.deleteByThreadId.run(threadId);
}

export function getSessionById(id: string): SessionRow | null {
  return stmts.getById.get(id) as SessionRow | null;
}

export function getActiveSessions(): SessionRow[] {
  return stmts.getActive.all() as SessionRow[];
}

export function getIdleSessions(): SessionRow[] {
  return stmts.getIdle.all() as SessionRow[];
}

// --- Workspace types & functions ---

export interface WorkspaceRow {
  alias: string;
  path: string;
  repo_url: string | null;
  sync: number;
  created_at: string;
}

export function addWorkspace(alias: string, path: string, repoUrl: string | null, sync: boolean) {
  stmts.addWorkspace.run(alias, path, repoUrl, sync ? 1 : 0);
}

export function getWorkspace(alias: string): WorkspaceRow | null {
  return stmts.getWorkspace.get(alias) as WorkspaceRow | null;
}

export function listWorkspaces(): WorkspaceRow[] {
  return stmts.listWorkspaces.all() as WorkspaceRow[];
}

export function removeWorkspace(alias: string): boolean {
  const result = stmts.removeWorkspace.run(alias);
  return result.changes > 0;
}

// --- Settings ---

export function setSetting(key: string, value: string) {
  stmts.setSetting.run(key, value);
}

export function getSetting(key: string): string | null {
  const row = stmts.getSetting.get(key) as { value: string } | null;
  return row?.value ?? null;
}
