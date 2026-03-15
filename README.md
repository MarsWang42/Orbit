# Orbit

A Telegram bot that bridges Telegram with [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), serving as an AI-powered personal assistant for knowledge management and coding workflows.

Orbit works in two modes:

- **Vault Mode** — Manages your personal knowledge base powered by [OrbitOS](https://github.com/MarsWang42/OrbitOS), an Obsidian-based productivity framework. Claude reads and writes notes, daily logs, projects, research, and wiki entries on your behalf.
- **Coding Mode** — Full git/gh development environment. Each coding task gets its own Telegram forum topic with planning, execution, PR creation, and code review — all through chat.

## Features

- **Knowledge management** — Capture, organize, and retrieve notes through natural conversation. Auto-commits and syncs to GitHub.
- **Coding sessions** — Clone repos, create new GitHub repos, work on issues, create PRs — all from Telegram.
- **Plan-then-execute** — Coding tasks go through a planning phase first, then execute with fresh context after your approval.
- **Daily routine** — Automated morning briefing that reviews yesterday, plans today, and connects to active projects.
- **Multi-workspace** — Switch between multiple projects and vaults with `@alias` prefix.
- **Model selection** — Choose between Claude Opus, Sonnet, or Haiku per topic with `/models`.
- **Bilingual** — English and Chinese UI.

## Quick Start

### Prerequisites

- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))
- A [Claude](https://claude.ai) account (Max subscription or API key)
- (Optional) GitHub personal access token for repo operations

### Install on a VPS

```bash
curl -fsSL https://raw.githubusercontent.com/MarsWang42/Orbit/main/install.sh | bash
```

This installs Bun, Git, GitHub CLI, Claude Code, clones Orbit, and sets up a systemd service.

Then:

```bash
cd ~/orbit
vim .env          # Fill in BOT_TOKEN and ALLOWED_USER_ID
claude login      # Authenticate Claude (one-time)
sudo systemctl enable --now orbit
```

### Install with Docker

```bash
git clone https://github.com/MarsWang42/Orbit.git
cd Orbit
cp .env.example .env
vim .env          # Fill in your config
docker compose up -d
docker exec -it orbit-orbit-1 claude login   # One-time auth
```

### Local Development

```bash
git clone https://github.com/MarsWang42/Orbit.git
cd Orbit
bun install
cp .env.example .env
# Edit .env with your config
claude login
bun run dev
```

## Upgrading

From your Orbit directory:

```bash
bash upgrade.sh
```

The script auto-detects your deployment mode (systemd, Docker, or local), backs up the database, pulls the latest code, and restarts the service. For Docker, it rebuilds the image automatically.

You can also run it remotely:

```bash
ORBIT_DIR=~/orbit bash <(curl -fsSL https://raw.githubusercontent.com/MarsWang42/Orbit/main/upgrade.sh)
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `ALLOWED_USER_ID` | Yes | Your Telegram user ID |
| `GH_TOKEN` | No | GitHub personal access token |
| `DEFAULT_CWD` | No | Default vault directory (default: `~`) |
| `DAILY_HOUR` | No | Hour for daily routine, 0-23 (default: `8`) |
| `DAILY_PROMPT` | No | Prompt for daily routine |

## Bot Commands

| Command | Description |
|---------|-------------|
| `/setup` | Set up vault (DM) or forum topics (group) |
| `/coding` | Start a coding session on a GitHub repo |
| `/pr` | Fetch PR comments and feed to Claude |
| `/models` | Choose Claude model for the current topic |
| `/stop` | Stop the current session |
| `/new` | End session and start fresh (DM only) |
| `/ws_add` | Add a workspace |
| `/ws_list` | List all workspaces |
| `/ws_remove` | Remove a workspace |
| `/ws_default` | Set default workspace |

## Architecture

```
Telegram --> grammy bot
  --> Command router (DM / forum topic handlers)
    --> InteractiveSession
      --> Claude Code CLI subprocess (stream-json I/O)
        --> Reads/writes workspace files
          --> Auto-commit & optional GitHub sync
```

**Vault sessions** auto-commit changes, upload new files to chat, and optionally push to GitHub. **Coding sessions** run in dedicated forum topics with full git access — each workspace gets its own topic thread.

Claude output streams to Telegram in real-time, with messages edited in-place every 1.5s. Tool usage shows live status indicators.

## OrbitOS

Orbit's vault mode is built on [OrbitOS](https://github.com/MarsWang42/OrbitOS), a structured knowledge base template for Obsidian. It provides:

- **Inbox** — Quick captures
- **Daily** — AI-generated daily logs
- **Projects** — Active projects with Context/Actions/Progress layout
- **Research** — Deep research notes
- **Wiki** — Atomic, reusable knowledge entries
- **Resources** — Curated external content
- **Plans** — Execution plans
- **Skills** — Reusable AI workflows (`/start-my-day`, `/kickoff`, `/research`, etc.)

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript (strict)
- **Bot Framework**: [grammY](https://grammy.dev)
- **Database**: SQLite (bun:sqlite, WAL mode)
- **AI**: Claude Code CLI
- **GitHub**: [Octokit](https://github.com/octokit/octokit.js)

## License

MIT
