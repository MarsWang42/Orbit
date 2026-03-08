export const en = {
  // --- Setup / onboarding ---
  "setup.already_set_up": "Already set up with default workspace `{{alias}}`. Use /ws_default to change it.",
  "setup.welcome": "Welcome to Orbit! Let's set up your vault.",
  "setup.btn_new": "Create new vault",
  "setup.btn_existing": "Connect existing repo",
  "setup.btn_skip": "Skip",
  "setup.choose_lang": "Which language for your vault?",
  "setup.btn_english": "English",
  "setup.btn_chinese": "\u4e2d\u6587",
  "setup.existing_url_prompt": "Send the GitHub URL of your existing OrbitOS repo.",
  "setup.skipped": "_Setup skipped. You can run /setup later._",
  "setup.required": "Please run /setup first to configure your vault before using Orbit.",
  "setup.lang_chosen": "Language: `{{lang}}`\n\nWhat should your vault repo be called? Send a name like `my-vault` or `OrbitOS`.",
  "setup.invalid_url": "Please send a valid GitHub URL.",
  "setup.invalid_name": "Invalid name. Use letters, numbers, and hyphens.",
  "setup.repo_name_taken": "The repo name `{{name}}` is already taken on GitHub. Please choose a different name.",
  "setup.creating_vault": "Creating vault `{{name}}` ({{lang}})...",
  "setup.clone_failed": "Clone failed: {{error}}",
  "setup.lang_folder_missing": "Language folder {{lang}} not found in the template.",
  "setup.vault_created_gh": "Vault created and set as default workspace `{{name}}`\nRepo: {{url}}\nPath: {{path}}\n\n_Now run /setup in your forum group to create Daily and Inbox topics._",
  "setup.vault_created_gh_fail": "Vault created locally but GitHub repo creation failed: {{error}}\n\nSet as default workspace anyway. You can push manually later.",
  "setup.vault_created_local": "Vault created locally as default workspace `{{name}}`\nPath: {{path}}\n\nNo GH\\_TOKEN set \u2014 sync disabled. Add it to .env to enable GitHub sync.\n_Run /setup in your forum group to create Daily and Inbox topics._",
  "setup.cloning": "Cloning `{{alias}}`...",
  "setup.clone_done": "Vault cloned and set as default workspace `{{alias}}`\nPath: {{path}}\n\n_Now run /setup in your forum group to create Daily and Inbox topics._",

  // --- Forum topics ---
  "forum.already_set_up": "Forum topics are already set up.",
  "forum.btn_recreate": "Recreate topics",
  "forum.btn_keep": "Keep existing",
  "forum.recreating": "_Recreating forum topics..._",
  "forum.keeping": "_Keeping existing topics._",
  "forum.daily_ready": "_Daily topic ready. Your morning routine will be posted here._",
  "forum.inbox_ready": "_Inbox ready. Send messages here for quick tasks._",
  "forum.setup_complete": "Forum setup complete!\n- *\u2600\ufe0f Daily* \u2014 morning routine (runs automatically)\n- *\ud83d\udce5 Inbox* \u2014 persistent session for quick tasks",
  "forum.setup_failed": "Setup failed. Make sure the bot is admin and topics are enabled.",

  // --- Workspace commands ---
  "ws.add_usage": "Usage: /ws_add <alias> <path|git-url>",
  "ws.remove_usage": "Usage: /ws_remove <alias>",
  "ws.removed": "Workspace `{{alias}}` removed.",
  "ws.not_found": "Workspace `{{alias}}` not found.",
  "ws.default_usage": "Usage: /ws_default <alias>",
  "ws.default_set": "Default workspace set to `{{alias}}`.",
  "ws.none": "No workspaces configured.",
  "ws.cloning": "Cloning into workspaces/{{alias}}...",
  "ws.added_sync": "Workspace `{{alias}}` added (sync enabled)\nPath: {{path}}",
  "ws.added": "Workspace `{{alias}}` added\nPath: {{path}}",

  // --- Session commands ---
  "session.ended": "_Session ended. Send a message to start a new one._",
  "session.stopped": "_Session stopped._",
  "session.no_active": "_No active session to stop._",

  // --- Coding flow ---
  "coding.use_in_group": "Use /coding in the forum group.",
  "coding.select_project": "Select a project workspace or create a new one:",
  "coding.btn_new": "+ New project",
  "coding.send_url": "Send the GitHub repo URL to clone (e.g. `https://github.com/user/repo`).",
  "coding.ws_not_found": "Workspace not found.",
  "coding.ws_selected": "Workspace `{{alias}}` selected. Send a task description or GitHub issue/PR URL.",
  "coding.already_exists": "Workspace `{{alias}}` already exists. Send a task description or GitHub issue/PR URL.",
  "coding.cloned": "Cloned `{{alias}}`. Now send a task description or GitHub issue/PR URL.",
  "coding.btn_clone": "Clone existing repo",
  "coding.btn_create": "Create new repo",
  "coding.send_name": "What should the new repo be called? Send a name like `my-project`.",
  "coding.repo_name_taken": "The repo name `{{name}}` is already taken on GitHub. Please choose a different name.",
  "coding.creating_repo": "Creating repo `{{name}}`...",
  "coding.repo_created": "Repo `{{name}}` created. Now send a task description or GitHub issue/PR URL.",
  "coding.plan_ready": "Plan ready. Approve to start execution with fresh context, or reply with feedback to revise.",
  "coding.btn_approve": "Approve",
  "coding.btn_revise": "Revise...",
  "coding.executing_plan": "Executing plan...",
  "coding.plan_not_found": "Plan not found. The plan may have expired. Please start a new coding session.",
  "coding.forking": "Repo belongs to `{{owner}}/{{repo}}` — forking to your account...",
  "coding.forked": "Forked as `{{name}}`.",
  "coding.topic_failed": "Failed to create a topic for this coding session.",

  // --- Done command ---
  "done.use_in_topic": "_Use /done inside a coding topic._",
  "done.completed": "_Session completed and worktree cleaned up._",
  "done.already_completed": "_This session is completed. Use /coding to start a new one._",

  // --- PR command ---
  "pr.use_in_topic": "Use /pr inside a coding topic.",
  "pr.no_session": "_No coding session found for this topic._",
  "pr.ws_not_found": "_Workspace not found._",
  "pr.not_coding": "_This is not a coding session._",
  "pr.no_branch": "_Could not determine current branch._",
  "pr.gh_failed": "_Failed to fetch PRs. Is GH\\_TOKEN configured?_",
  "pr.no_pr": "_No PR found for branch `{{branch}}`._",
  "pr.no_repo": "_Could not determine repository._",
  "pr.no_comments": "PR #{{number}}: `{{title}}`\n{{url}}\n\n_No comments yet._",
  "pr.feeding": "_Feeding {{count}} PR comment(s) to Claude..._",

  // --- Status indicators ---
  "status.thinking": "\u23f3 _Thinking..._",
  "status.generating": "\u270d\ufe0f _Generating..._",
  "status.done": "\u2705 _Done_",

  // --- Tool use labels ---
  "tool.read": "\ud83d\udcd6 _Reading {{path}}_",
  "tool.edit": "\u270f\ufe0f _Editing {{path}}_",
  "tool.write": "\ud83d\udcdd _Writing {{path}}_",
  "tool.bash": "\ud83d\udcbb _Running_ `{{command}}`",
  "tool.glob": "\ud83d\udd0d _Searching for {{pattern}}_",
  "tool.grep": "\ud83d\udd0d _Searching for_ `{{pattern}}`",
  "tool.webfetch": "\ud83c\udf10 _Fetching {{url}}_",
  "tool.websearch": "\ud83c\udf10 _Searching: {{query}}_",
  "tool.default": "\ud83d\udd27 _{{name}}_",

  // --- Claude system prompts ---
  "prompt.telegram_base": "You are running inside a Telegram bot. Your output will be displayed in a Telegram chat. Telegram only supports basic Markdown: *bold*, _italic_, `code`, ```code blocks```, and [links](url). Do NOT use tables, headers (#), bullet lists with -, or other advanced Markdown \u2014 they won't render. Use plain text with bold/italic for emphasis instead. Keep responses concise \u2014 messages over 4000 characters will be split.",
  "prompt.vault_extra": "You may create files as usual \u2014 they will be automatically sent to the chat. When you create files, also provide a brief text summary of what was created. Do NOT run git commands (commit, push, add, etc.) \u2014 version control is managed by the server automatically.",
  "prompt.no_interactive_tools": "IMPORTANT: Do NOT use AskUserQuestion, EnterPlanMode, or ExitPlanMode tools \u2014 they do not work in this environment. When you need to ask the user questions (e.g. during /start-my-day or other skills), output them as a numbered list with options in a single message, then STOP and wait for the user's reply. Example: \"1. Question?\\n  a) Option A\\n  b) Option B\\n2. Question? (free text)\" The user will reply with their answers, then continue the workflow. When you need to plan before executing, outline your plan as text output, then proceed directly with execution \u2014 do not enter plan mode.",
  "prompt.plan_mode": "You are in PLANNING MODE. Your job is to explore the codebase, understand the requirements, and output a detailed implementation plan. Do NOT make any code changes \u2014 only use Read, Glob, Grep, and Bash (for non-destructive commands like git log, git status, etc.). Output a clear, structured plan with: 1) files to change, 2) what changes to make in each file, 3) any risks or considerations. Be specific enough that the plan can be executed without further exploration.",
  "prompt.inbox_extra": "You are in the user's Inbox. The user sends quick thoughts, note fragments, or ideas to process. Your job: 1) If the content is a thought/note/inspiration, create a markdown file in the `00_收件箱/` directory to save it, using a short descriptive filename (e.g. `想法-xxx.md` or `idea-xxx.md`). 2) If the user needs help thinking through or solving a problem, answer directly in the conversation and help organize their thoughts; if the discussion produces conclusions worth keeping, also save them to `00_收件箱/`. Always operate within the vault.",
  "prompt.coding_extra": "You are in a coding workspace with full access to git and the GitHub CLI (gh). You can freely use git commands: commit, push, branch, checkout, etc. Use `gh` to create PRs, read issues, review PRs, and manage GitHub resources. When working on a GitHub issue, create a feature branch, make changes, commit, and open a PR. When reviewing PR feedback, read the comments with `gh`, make fixes, commit, and push. When working in a git worktree, you are already on a dedicated feature branch — do NOT create new branches, switch branches, or run `git checkout`. Just commit and push on the current branch directly.",
  "prompt.coding_context_repo": "[GitHub repo: {{url}}]",
  "prompt.coding_context_worktree": "[The repo is already cloned and you are working in a git worktree at: {{path}}]",
  "prompt.coding_context_branch": "[Branch: {{branch}} — do NOT clone the repo again, just start working in the current directory]",
  "prompt.coding_vault_access": "You also have read access to the user's OrbitOS vault at: {{path}}. You can use Read, Glob, and Grep with absolute paths to reference vault content (projects, research, daily notes, wiki, etc.). Vault structure: 00_\u6536\u4ef6\u7bb1 (inbox), 10_\u65e5\u8bb0 (daily), 20_\u9879\u76ee (projects), 30_\u7814\u7a76 (research), 40_\u77e5\u8bc6\u5e93 (wiki), 50_\u8d44\u6e90 (resources), 90_\u8ba1\u5212 (plans), 99_\u7cfb\u7edf (system). Do NOT write to the vault from coding sessions \u2014 only read for context.",

  // --- Model selection ---
  "models.select": "Current model: `{{current}}`. Choose a model:",
  "models.set": "Model set to `{{model}}`. New sessions will use this model.",

  // --- Error messages ---
  "error.prefix": "*Error:* {{message}}",
  "error.spawn_failed": "*Error:* Failed to spawn Claude Code.",
  "error.topic_failed": "Failed to create a topic for this session.",

  // --- Cancel ---
  "cancel.done": "_Cancelled. You can start over anytime._",

  // --- Bot command descriptions ---
  "cmd.cancel": "Cancel the current multi-step operation",
  "cmd.setup": "Set up vault (DM) or forum topics (group)",
  "cmd.coding": "Start a coding session on a GitHub repo",
  "cmd.pr": "Fetch PR comments and feed to Claude (in coding topic)",
  "cmd.stop": "Stop the current session",
  "cmd.new": "End session and start fresh (DM only)",
  "cmd.ws_add": "Add workspace: /ws_add <alias> <path|git-url>",
  "cmd.ws_list": "List all workspaces",
  "cmd.ws_remove": "Remove workspace: /ws_remove <alias>",
  "cmd.ws_default": "Set default workspace: /ws_default <alias>",
  "cmd.done": "Complete session and remove worktree (in coding topic)",
  "cmd.models": "Choose Claude model for this topic",
} as const;

export type TranslationKey = keyof typeof en;
