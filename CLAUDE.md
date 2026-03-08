# Orbit

Telegram bot bridging Telegram with Claude Code CLI. Bun + TypeScript + grammy + SQLite.

`bun run dev` to start development. No test suite — validate via live Telegram interaction.

## Architecture

- **Vault Mode** (DM, default): Works with OrbitOS knowledge base (Obsidian vault). Auto-commits, optionally syncs to GitHub.
- **Coding Mode** (forum topics): Full git/gh access per workspace. Each coding task gets its own topic thread.
- **Sessions**: Stored in SQLite, idle-reaped after 10 min, max 25 turns. DM sessions always use the default vault workspace.
- **Skill passthrough**: Only registered bot commands are intercepted; unknown `/` commands (e.g. `/start-my-day`) must be forwarded to the Claude session as vault skill invocations.

## OrbitOS Vault Structure

Folder names depend on language (CN/EN). Structure: Inbox, Daily (YYYY-MM-DD.md), Projects (C.A.P. layout), Research, Wiki (atomic notes), Resources, Plans, System. Skills live in `.agents/skills/`. Notes use `[[wikilink]]` syntax for connections.

## Conventions

- All user-facing strings go through `t()` — keys in `src/i18n/en.ts` and `src/i18n/cn.ts`
- Use `fs/promises` (async) in bot handlers, never sync fs calls
- Telegram callback data max 64 bytes — use ID registries for paths, especially with CJK
- Validate filesystem paths with `realpath()` after `resolve()` to prevent symlink traversal
