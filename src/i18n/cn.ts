import type { TranslationKey } from "./en";

export const cn: Record<TranslationKey, string> = {
  // --- 设置 / 引导 ---
  "setup.already_set_up": "已设置默认工作区 `{{alias}}`。使用 /ws_default 更改。",
  "setup.welcome": "欢迎使用 Orbit！让我们来设置你的知识库。",
  "setup.btn_new": "创建新知识库",
  "setup.btn_existing": "连接已有仓库",
  "setup.btn_skip": "跳过",
  "setup.choose_lang": "选择知识库语言：",
  "setup.btn_english": "English",
  "setup.btn_chinese": "中文",
  "setup.existing_url_prompt": "发送你已有 OrbitOS 仓库的 GitHub URL。",
  "setup.skipped": "_已跳过设置。你可以稍后运行 /setup。_",
  "setup.required": "请先运行 /setup 来配置你的知识库，然后才能使用 Orbit。",
  "setup.lang_chosen": "语言：`{{lang}}`\n\n你的知识库仓库叫什么名字？发送一个名称，如 `my-vault` 或 `OrbitOS`。",
  "setup.invalid_url": "请发送一个有效的 GitHub URL。",
  "setup.invalid_name": "名称无效。请使用字母、数字和连字符。",
  "setup.repo_name_taken": "仓库名 `{{name}}` 在 GitHub 上已被使用。请选择其他名称。",
  "setup.creating_vault": "正在创建知识库 `{{name}}` ({{lang}})...",
  "setup.clone_failed": "克隆失败：{{error}}",
  "setup.lang_folder_missing": "模板中未找到语言文件夹 {{lang}}。",
  "setup.vault_created_gh": "知识库已创建并设为默认工作区 `{{name}}`\n仓库：{{url}}\n路径：{{path}}\n\n_现在在论坛群组中运行 /setup 来创建 Daily 和 Inbox 主题。_",
  "setup.vault_created_gh_fail": "知识库已在本地创建，但 GitHub 仓库创建失败：{{error}}\n\n已设为默认工作区。你可以稍后手动推送。",
  "setup.vault_created_local": "知识库已在本地创建为默认工作区 `{{name}}`\n路径：{{path}}\n\n未设置 GH\\_TOKEN — 同步已禁用。在 .env 中添加以启用 GitHub 同步。\n_在论坛群组中运行 /setup 来创建 Daily 和 Inbox 主题。_",
  "setup.cloning": "正在克隆 `{{alias}}`...",
  "setup.clone_done": "知识库已克隆并设为默认工作区 `{{alias}}`\n路径：{{path}}\n\n_现在在论坛群组中运行 /setup 来创建 Daily 和 Inbox 主题。_",

  // --- 论坛主题 ---
  "forum.already_set_up": "论坛主题已设置完成。",
  "forum.btn_recreate": "重新创建主题",
  "forum.btn_keep": "保留现有主题",
  "forum.recreating": "_正在重新创建论坛主题..._",
  "forum.keeping": "_保留现有主题。_",
  "forum.daily_ready": "_Daily 主题已就绪。每日例程将发布在这里。_",
  "forum.inbox_ready": "_收件箱已就绪。在这里发送消息来处理快速任务。_",
  "forum.setup_complete": "论坛设置完成！\n- *☀️ Daily* — 每日例程（自动运行）\n- *📥 Inbox* — 持久会话，用于快速任务",
  "forum.setup_failed": "设置失败。请确保机器人是管理员且已启用主题功能。",

  // --- 工作区命令 ---
  "ws.add_usage": "用法：/ws_add <别名> <路径|git-url>",
  "ws.remove_usage": "用法：/ws_remove <别名>",
  "ws.removed": "工作区 `{{alias}}` 已删除。",
  "ws.not_found": "工作区 `{{alias}}` 未找到。",
  "ws.default_usage": "用法：/ws_default <别名>",
  "ws.default_set": "默认工作区已设为 `{{alias}}`。",
  "ws.none": "未配置工作区。",
  "ws.cloning": "正在克隆到 workspaces/{{alias}}...",
  "ws.added_sync": "工作区 `{{alias}}` 已添加（同步已启用）\n路径：{{path}}",
  "ws.added": "工作区 `{{alias}}` 已添加\n路径：{{path}}",

  // --- 会话命令 ---
  "session.ended": "_会话已结束。发送消息开始新会话。_",
  "session.stopped": "_会话已停止。_",
  "session.no_active": "_没有活跃的会话可停止。_",

  // --- 编码流程 ---
  "coding.use_in_group": "请在论坛群组中使用 /coding。",
  "coding.select_project": "选择一个项目工作区或创建新项目：",
  "coding.btn_new": "+ 新项目",
  "coding.send_url": "发送要克隆的 GitHub 仓库 URL（如 `https://github.com/user/repo`）。",
  "coding.ws_not_found": "工作区未找到。",
  "coding.ws_selected": "工作区 `{{alias}}` 已选择。发送任务描述或 GitHub issue/PR URL。",
  "coding.already_exists": "工作区 `{{alias}}` 已存在。发送任务描述或 GitHub issue/PR URL。",
  "coding.cloned": "已克隆 `{{alias}}`。现在发送任务描述或 GitHub issue/PR URL。",
  "coding.btn_clone": "克隆已有仓库",
  "coding.btn_create": "创建新仓库",
  "coding.send_name": "新仓库叫什么名字？发送一个名称，如 `my-project`。",
  "coding.name_is_url": "检测到 URL — 已切换到克隆模式。",
  "coding.repo_name_taken": "仓库名 `{{name}}` 在 GitHub 上已被使用。请选择其他名称。",
  "coding.creating_repo": "正在创建仓库 `{{name}}`...",
  "coding.repo_created": "仓库 `{{name}}` 已创建。现在发送任务描述或 GitHub issue/PR URL。",
  "coding.plan_not_found": "计划未找到。计划可能已过期。请启动新的编码会话。",
  "coding.plan_ready": "计划已就绪。批准后将以全新上下文开始执行，或回复反馈来修改计划。",
  "coding.btn_approve": "批准",
  "coding.btn_revise": "修改...",
  "coding.executing_plan": "正在执行计划...",
  "coding.forking": "仓库属于 `{{owner}}/{{repo}}` — 正在 fork 到你的账户...",
  "coding.forked": "已 fork 为 `{{name}}`。",
  "coding.topic_failed": "无法为此编码会话创建主题。",

  // --- Done 命令 ---
  "done.use_in_topic": "_请在编码主题中使用 /done。_",
  "done.completed": "_会话已完成，工作树已清理。_",
  "done.already_completed": "_此会话已完成。使用 /coding 开始新会话。_",

  // --- PR 命令 ---
  "pr.use_in_topic": "请在编码主题中使用 /pr。",
  "pr.no_session": "_未找到此主题的编码会话。_",
  "pr.ws_not_found": "_工作区未找到。_",
  "pr.not_coding": "_这不是编码会话。_",
  "pr.no_branch": "_无法确定当前分支。_",
  "pr.gh_failed": "_获取 PR 失败。GH\\_TOKEN 是否已配置？_",
  "pr.no_pr": "_未找到分支 `{{branch}}` 的 PR。_",
  "pr.no_repo": "_无法确定仓库。_",
  "pr.no_comments": "PR #{{number}}: `{{title}}`\n{{url}}\n\n_暂无评论。_",
  "pr.feeding": "_正在将 {{count}} 条 PR 评论发送给 Claude..._",

  // --- 状态指示 ---
  "status.thinking": "⏳ _思考中..._",
  "status.generating": "✍️ _生成中..._",
  "status.done": "✅ _完成_",

  // --- 工具使用标签 ---
  "tool.read": "📖 _正在读取 {{path}}_",
  "tool.edit": "✏️ _正在编辑 {{path}}_",
  "tool.write": "📝 _正在写入 {{path}}_",
  "tool.bash": "💻 _正在运行_ `{{command}}`",
  "tool.glob": "🔍 _正在搜索 {{pattern}}_",
  "tool.grep": "🔍 _正在搜索_ `{{pattern}}`",
  "tool.webfetch": "🌐 _正在获取 {{url}}_",
  "tool.websearch": "🌐 _正在搜索：{{query}}_",
  "tool.default": "🔧 _{{name}}_",

  // --- Claude 系统提示 ---
  "prompt.telegram_base": "你正在 Telegram 机器人内运行。你的输出将显示在 Telegram 聊天中。Telegram 仅支持基本 Markdown：*粗体*、_斜体_、`代码`、```代码块```和 [链接](url)。不要使用表格、标题 (#)、破折号列表 (-) 或其他高级 Markdown — 它们无法渲染。使用纯文本配合粗体/斜体来强调。保持简洁 — 超过 4000 字符的消息将被分割。",
  "prompt.vault_extra": "你可以正常创建文件 — 它们会自动发送到聊天。创建文件时，请同时提供简要的文字摘要。不要运行 git 命令（commit、push、add 等）— 版本控制由服务器自动管理。",
  "prompt.plan_mode": "你处于规划模式。你的任务是探索代码库、理解需求并输出详细的实施计划。不要做任何代码修改 — 只使用 Read、Glob、Grep 和 Bash（仅限非破坏性命令如 git log、git status 等）。输出清晰的结构化计划，包括：1) 要修改的文件，2) 每个文件的具体修改，3) 风险或注意事项。计划要足够具体，以便无需进一步探索即可执行。",
  "prompt.no_interactive_tools": "重要：不要使用 AskUserQuestion、EnterPlanMode 或 ExitPlanMode 工具 — 它们在此环境中无法工作。当你需要向用户提问时（如 /start-my-day 或其他技能），请将问题作为编号列表输出在一条消息中，然后停下来等待用户回复。示例：\"1. 问题？\\n  a) 选项A\\n  b) 选项B\\n2. 问题？（自由输入）\" 用户回复后继续工作流程。需要规划时，将计划作为文本输出，然后直接执行 — 不要进入计划模式。",
  "prompt.inbox_extra": "你在用户的收件箱中。用户发来的是快速想法、笔记片段或待处理的念头。你的任务：1) 如果内容是一个想法/笔记/灵感，在 `00_收件箱/` 目录下创建一个 markdown 文件保存它，文件名使用简短描述性命名（如 `想法-xxx.md`）；2) 如果用户需要帮助思考或解决某个问题，直接在对话中回答并协助梳理，如果讨论产生了值得保留的结论，也存入 `00_收件箱/`。始终在 vault 中操作。",
  "prompt.coding_extra": "你在一个编码工作区中，拥有 git 和 GitHub CLI (gh) 的完全访问权。你可以自由使用 git 命令：commit、push、branch、checkout 等。使用 `gh` 来创建 PR、读取 issue、审查 PR 和管理 GitHub 资源。处理 GitHub issue 时，创建功能分支、修改代码、提交并开启 PR。审查 PR 反馈时，用 `gh` 读取评论、修复问题、提交并推送。当你在 git worktree 中工作时，你已经在专用的功能分支上 — 不要创建新分支、切换分支或运行 `git checkout`。直接在当前分支上 commit 和 push 即可。",
  "prompt.coding_context_repo": "[GitHub 仓库：{{url}}]",
  "prompt.coding_context_worktree": "[仓库已克隆，你正在 git worktree 中工作，路径：{{path}}]",
  "prompt.coding_context_branch": "[分支：{{branch}} — 不要再次克隆仓库，直接在当前目录开始工作]",
  "prompt.coding_vault_access": "你还可以读取用户的 OrbitOS 知识库，位于：{{path}}。你可以使用 Read、Glob 和 Grep 通过绝对路径引用知识库内容（项目、研究、日记、百科等）。知识库结构：00_收件箱、10_日记、20_项目、30_研究、40_知识库、50_资源、90_计划、99_系统。不要在编码会话中写入知识库 — 仅读取以获取上下文。",

  // --- 模型选择 ---
  "models.select": "当前模型：`{{current}}`。选择一个模型：",
  "models.set": "模型已设为 `{{model}}`。新会话将使用此模型。",

  // --- 错误消息 ---
  "error.prefix": "*错误：* {{message}}",
  "error.spawn_failed": "*错误：* 无法启动 Claude Code。",
  "error.topic_failed": "无法为此会话创建主题。",

  // --- 取消 ---
  "cancel.done": "_已取消。你可以随时重新开始。_",

  // --- 机器人命令描述 ---
  "cmd.cancel": "取消当前多步骤操作",
  "cmd.setup": "设置知识库（私聊）或论坛主题（群组）",
  "cmd.coding": "在 GitHub 仓库上启动编码会话",
  "cmd.pr": "获取 PR 评论并发送给 Claude（在编码主题中）",
  "cmd.stop": "停止当前会话",
  "cmd.new": "结束会话并重新开始（仅私聊）",
  "cmd.ws_add": "添加工作区：/ws_add <别名> <路径|git-url>",
  "cmd.ws_list": "列出所有工作区",
  "cmd.ws_remove": "删除工作区：/ws_remove <别名>",
  "cmd.ws_default": "设置默认工作区：/ws_default <别名>",
  "cmd.done": "完成会话并移除工作树（在编码主题中）",
  "cmd.models": "选择此主题的 Claude 模型",
};
