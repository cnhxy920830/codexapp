export type AutomationsPageMessageKey =
  | "home.useCases.dailyBugScan.prompt"
  | "home.useCases.dailyBugScan.automationPrompt"
  | "home.useCases.weeklyReleaseNotes.prompt"
  | "home.useCases.weeklyReleaseNotes.automationPrompt"
  | "home.useCases.dailyStandup.prompt"
  | "home.useCases.dailyStandup.automationPrompt"
  | "home.useCases.nightlyCiReport.prompt"
  | "home.useCases.nightlyCiReport.automationPrompt"
  | "home.useCases.dailyClassicGame.prompt"
  | "home.useCases.dailyClassicGame.automationPrompt"
  | "home.useCases.skillProgressionMap.prompt"
  | "home.useCases.skillProgressionMap.automationPrompt"
  | "home.useCases.weeklyEngineeringSummary.prompt"
  | "home.useCases.weeklyEngineeringSummary.automationPrompt"
  | "home.useCases.performanceRegressionWatch.prompt"
  | "home.useCases.performanceRegressionWatch.automationPrompt"
  | "home.useCases.dependencySdkDrift.prompt"
  | "home.useCases.dependencySdkDrift.automationPrompt"
  | "home.useCases.testGapDetection.prompt"
  | "home.useCases.testGapDetection.automationPrompt"
  | "home.useCases.preReleaseCheck.prompt"
  | "home.useCases.preReleaseCheck.automationPrompt"
  | "home.useCases.agentsDocsSync.prompt"
  | "home.useCases.agentsDocsSync.automationPrompt"
  | "home.useCases.weeklyPrSummary.prompt"
  | "home.useCases.weeklyPrSummary.automationPrompt"
  | "home.useCases.issueTriage.prompt"
  | "home.useCases.issueTriage.automationPrompt"
  | "home.useCases.ciMonitor.prompt"
  | "home.useCases.ciMonitor.automationPrompt"
  | "home.useCases.dependencySweep.prompt"
  | "home.useCases.dependencySweep.automationPrompt"
  | "home.useCases.performanceAudit.prompt"
  | "home.useCases.performanceAudit.automationPrompt"
  | "home.useCases.changelogUpdate.prompt"
  | "home.useCases.changelogUpdate.automationPrompt"
  | "settings.automations.modal.useTemplate"
  | "settings.automations.modal.createNew"
  | "settings.automations.modal.expand"
  | "settings.automations.modal.collapse"
  | "settings.automations.modal.templateTitle"
  | "settings.automations.executionEnvironment.menuTitle"
  | "settings.automations.executionEnvironment.compactTooltip"
  | "settings.automations.executionEnvironment.local.help"
  | "settings.automations.executionEnvironment.worktree.help"
  | "settings.automations.heartbeatThread.title"
  | "settings.automations.heartbeatThread.ariaLabel"
  | "settings.automations.heartbeatThread.empty"
  | "settings.automations.heartbeatThread.unpinned"
  | "settings.automations.model.ariaLabel"
  | "settings.automations.model.title"
  | "settings.automations.model.loading"
  | "settings.automations.reasoning.ariaLabel"
  | "settings.automations.reasoning.title"
  | "settings.automations.reasoning.loading"
  | "settings.automations.reasoning.compactTooltip"
  | "settings.automations.scheduleMode.interval"
  | "settings.automations.scheduleMode.hourly"
  | "settings.automations.scheduleMode.daily"
  | "settings.automations.scheduleMode.weekdays"
  | "settings.automations.scheduleMode.weekly"
  | "settings.automations.scheduleMode.custom"
  | "settings.automations.scheduleModeLabel"
  | "settings.automations.scheduleIntervalLabel"
  | "settings.automations.scheduleWeekday"
  | "settings.automations.scheduleTime"
  | "settings.automations.showTimePicker"
  | "settings.automations.hideTimePicker"
  | "settings.automations.timePicker.setTime"
  | "settings.automations.scheduleCustomLabel"
  | "settings.automations.scheduleCustomPlaceholder"
  | "settings.automations.saveTooltip.combined.create"
  | "settings.automations.saveTooltip.combined.save"
  | "settings.automations.saveTooltip.item.name.create"
  | "settings.automations.saveTooltip.item.name.save"
  | "settings.automations.saveTooltip.item.prompt.create"
  | "settings.automations.saveTooltip.item.prompt.save"
  | "settings.automations.saveTooltip.item.cwd.create"
  | "settings.automations.saveTooltip.item.cwd.save"
  | "settings.automations.saveTooltip.item.thread.create"
  | "settings.automations.saveTooltip.item.thread.save"
  | "settings.automations.saveTooltip.item.executionEnvironment.create"
  | "settings.automations.saveTooltip.item.executionEnvironment.save"
  | "settings.automations.saveTooltip.item.model.create"
  | "settings.automations.saveTooltip.item.model.save"
  | "settings.automations.saveTooltip.item.schedule.create"
  | "settings.automations.saveTooltip.item.schedule.save"
  | "settings.automations.banner.tooltipLabel"
  | "settings.automations.banner.danger"
  | "settings.automations.banner.defaultHowTo.readOnly"
  | "settings.automations.banner.defaultHowTo.default"
  | "inbox.rightPanel.quickStart.section.statusReports"
  | "inbox.rightPanel.quickStart.section.releasePrep"
  | "inbox.rightPanel.quickStart.section.incidentsAndTriage"
  | "inbox.rightPanel.quickStart.section.codeQuality"
  | "inbox.rightPanel.quickStart.section.repoMaintenance"
  | "inbox.rightPanel.quickStart.section.growthAndExploration"
  | "inbox.rightPanel.quickStart.home.defaultDraftName"
  | "inbox.rightPanel.quickStart.home.dailyBugScan.draftName"
  | "inbox.rightPanel.quickStart.home.weeklyReleaseNotes.draftName"
  | "inbox.rightPanel.quickStart.home.dailyStandup.draftName"
  | "inbox.rightPanel.quickStart.home.nightlyCiReport.draftName"
  | "inbox.rightPanel.quickStart.home.dailyClassicGame.draftName"
  | "inbox.rightPanel.quickStart.home.skillProgressionMap.draftName"
  | "inbox.rightPanel.quickStart.home.weeklyEngineeringSummary.draftName"
  | "inbox.rightPanel.quickStart.home.performanceRegressionWatch.draftName"
  | "inbox.rightPanel.quickStart.home.dependencySdkDrift.draftName"
  | "inbox.rightPanel.quickStart.home.testGapDetection.draftName"
  | "inbox.rightPanel.quickStart.home.preReleaseCheck.draftName"
  | "inbox.rightPanel.quickStart.home.agentsDocsSync.draftName"
  | "inbox.rightPanel.quickStart.home.weeklyPrSummary.draftName"
  | "inbox.rightPanel.quickStart.home.issueTriage.draftName"
  | "inbox.rightPanel.quickStart.home.ciMonitor.draftName"
  | "inbox.rightPanel.quickStart.home.dependencySweep.draftName"
  | "inbox.rightPanel.quickStart.home.performanceAudit.draftName"
  | "inbox.rightPanel.quickStart.home.changelogUpdate.draftName";

export const AUTOMATIONS_PAGE_MESSAGES = {
  "en-US": {
    "home.useCases.dailyBugScan.prompt":
      "Scan recent commits for likely bugs and propose minimal fixes.",
    "home.useCases.dailyBugScan.automationPrompt": `Scan recent commits (since the last run, or last 24h) for likely bugs and propose minimal fixes.

Grounding rules:
- Use ONLY concrete repo evidence (commit SHAs, PRs, file paths, diffs, failing tests, CI signals).
- Do NOT invent bugs; if evidence is weak, say so and skip.
- Prefer the smallest safe fix; avoid refactors and unrelated cleanup.`,
    "home.useCases.weeklyReleaseNotes.prompt":
      "Draft release notes from merged PRs.",
    "home.useCases.weeklyReleaseNotes.automationPrompt": `Draft weekly release notes from merged PRs (include links when available).

Scope & grounding:
- Stay strictly within the repo history for the week; do not add extra sections beyond what the data supports.
- Use PR numbers/titles; avoid claims about impact unless supported by PR description/tests/metrics in repo.`,
    "home.useCases.dailyStandup.prompt":
      "Summarize yesterday’s git activity for standup.",
    "home.useCases.dailyStandup.automationPrompt": `Summarize yesterday’s git activity for standup.

Grounding rules:
- Anchor statements to commits/PRs/files; do not speculate about intent or future work.
- Keep it scannable and team-ready.`,
    "home.useCases.nightlyCiReport.prompt":
      "Summarize CI failures and flaky tests.",
    "home.useCases.nightlyCiReport.automationPrompt": `Summarize CI failures and flaky tests from the last CI window; suggest top fixes.

Grounding rules:
- Cite specific jobs, tests, error messages, or log snippets when available.
- Avoid overconfident root-cause claims; separate “observed” vs “suspected.”`,
    "home.useCases.dailyClassicGame.prompt":
      "Create a small classic game with minimal scope.",
    "home.useCases.dailyClassicGame.automationPrompt": `Create a small classic game with minimal scope.

Constraints:
- Do NOT add extra features, styling systems, content, or new dependencies unless required.
- Reuse existing repo tooling and patterns.`,
    "home.useCases.skillProgressionMap.prompt":
      "Suggest next skills to deepen from recent PRs and reviews.",
    "home.useCases.skillProgressionMap.automationPrompt": `From recent PRs and reviews, suggest next skills to deepen.

Grounding rules:
- Anchor each suggestion to concrete evidence (PR themes, review comments, recurring issues).
- Avoid generic advice; make each recommendation actionable and specific.`,
    "home.useCases.weeklyEngineeringSummary.prompt":
      "Synthesize this week’s PRs, rollouts, incidents, and reviews.",
    "home.useCases.weeklyEngineeringSummary.automationPrompt": `Synthesize this week’s PRs, rollouts, incidents, and reviews into a weekly update.

Grounding rules:
- Do not invent events; if data is missing, say that briefly.
- Prefer concrete references (PR #, incident ID, rollout note, file path) where available.`,
    "home.useCases.performanceRegressionWatch.prompt":
      "Watch for performance regressions in recent changes.",
    "home.useCases.performanceRegressionWatch.automationPrompt": `Compare recent changes to benchmarks or traces and flag regressions early.

Grounding rules:
- Ground claims in measurable signals (benchmarks, traces, timings, flamegraphs).
- If measurements are unavailable, state “No measurements found” rather than guessing.`,
    "home.useCases.dependencySdkDrift.prompt":
      "Detect dependency and SDK drift; propose alignment.",
    "home.useCases.dependencySdkDrift.automationPrompt": `Detect dependency and SDK drift and propose a minimal alignment plan.

Grounding rules:
- Cite current and target versions from the repo when possible (lockfiles, package manifests).
- Do not guess versions; if targets are unclear, propose options and label them as suggestions.`,
    "home.useCases.testGapDetection.prompt":
      "Find test gaps from recent changes; create draft PRs.",
    "home.useCases.testGapDetection.automationPrompt": `Identify untested paths from recent changes; add focused tests and use $yeet for draft PRs.

Constraints:
- Keep scope tight to the changed areas; avoid broad refactors.
- Prefer small, reliable tests that fail before and pass after.`,
    "home.useCases.preReleaseCheck.prompt":
      "Run a pre-release checklist before tagging.",
    "home.useCases.preReleaseCheck.automationPrompt": `Before tagging, verify changelog, migrations, feature flags, and tests.

Grounding rules:
- Report ONLY what you can confirm from the repo and CI context.
- If a check cannot be verified, mark it explicitly as “Unknown.”`,
    "home.useCases.agentsDocsSync.prompt":
      "Update AGENTS.md with new workflows and commands.",
    "home.useCases.agentsDocsSync.automationPrompt": `Update AGENTS.md with newly discovered workflows and commands.

Constraints:
- Keep edits minimal, accurate, and grounded in repo usage.
- Do not touch unrelated sections or auto-generated files.
- If you are unsure, prefer adding a TODO with a short note rather than inventing.`,
    "home.useCases.weeklyPrSummary.prompt":
      "Summarize last week's PRs by teammate and theme.",
    "home.useCases.weeklyPrSummary.automationPrompt": `Summarize last week’s PRs by teammate and theme; highlight risks.

Grounding rules:
- Use PR numbers/titles when available.
- Avoid speculation about impact; stick to what the PR changed.`,
    "home.useCases.issueTriage.prompt":
      "Triage new issues and suggest owners and priority.",
    "home.useCases.issueTriage.automationPrompt": `Triage new issues; suggest owner, priority, and labels.

Grounding rules:
- Base recommendations on issue content + repo context (CODEOWNERS, touched areas, prior similar issues).
- Do not guess owners without signals; if unclear, say “Owner: Unknown” and suggest a team instead.`,
    "home.useCases.ciMonitor.prompt":
      "Check CI failures; group likely root causes.",
    "home.useCases.ciMonitor.automationPrompt": `Check CI failures; group by likely root cause and suggest minimal fixes.

Grounding rules:
- Cite jobs, tests, errors, and log evidence.
- Avoid overconfident root-cause claims; label uncertain items as “Suspected.”`,
    "home.useCases.dependencySweep.prompt":
      "Scan outdated dependencies and propose safe upgrades.",
    "home.useCases.dependencySweep.automationPrompt": `Scan outdated dependencies; propose safe upgrades with minimal changes.

Rules:
- Prefer the smallest viable upgrade set.
- Explicitly call out breaking-change risks and required migrations.
- Do not propose upgrades without identifying current versions from the repo.`,
    "home.useCases.performanceAudit.prompt":
      "Audit performance regressions; propose fixes.",
    "home.useCases.performanceAudit.automationPrompt": `Audit performance regressions and propose highest-leverage fixes.

Grounding rules:
- Ground claims in measurements/traces when available.
- If evidence is missing, state uncertainty briefly and suggest what to measure next.`,
    "home.useCases.changelogUpdate.prompt":
      "Update the changelog with this week's highlights.",
    "home.useCases.changelogUpdate.automationPrompt": `Update the changelog with this week’s highlights and key PR links.

Constraints:
- Only include items supported by repo history.
- Keep structure simple and consistent with existing changelog format.`,
    "settings.automations.modal.useTemplate": "Use template",
    "settings.automations.modal.createNew": "Create new",
    "settings.automations.modal.expand": "Expand automation modal",
    "settings.automations.modal.collapse": "Collapse automation modal",
    "settings.automations.modal.templateTitle": "Automation templates",
    "settings.automations.executionEnvironment.menuTitle": "Run in",
    "settings.automations.executionEnvironment.compactTooltip":
      "Run in {environment}",
    "settings.automations.executionEnvironment.local.help":
      "Runs directly in the selected project directory without creating a worktree.",
    "settings.automations.executionEnvironment.worktree.help":
      "Runs in a dedicated Git worktree created from the selected project, keeping your current checkout untouched.",
    "settings.automations.heartbeatThread.title": "Target chat",
    "settings.automations.heartbeatThread.ariaLabel": "Target chat",
    "settings.automations.heartbeatThread.empty":
      "Pin a local chat first to use heartbeat automations",
    "settings.automations.heartbeatThread.unpinned": "unpinned",
    "settings.automations.model.ariaLabel": "Model",
    "settings.automations.model.title": "Model",
    "settings.automations.model.loading": "Loading model",
    "settings.automations.reasoning.ariaLabel": "Reasoning",
    "settings.automations.reasoning.title": "Reasoning",
    "settings.automations.reasoning.loading": "Loading reasoning",
    "settings.automations.reasoning.compactTooltip":
      "{reasoning} reasoning",
    "settings.automations.scheduleMode.interval": "Interval",
    "settings.automations.scheduleMode.hourly": "Hourly",
    "settings.automations.scheduleMode.daily": "Daily",
    "settings.automations.scheduleMode.weekdays": "Weekdays",
    "settings.automations.scheduleMode.weekly": "Weekly",
    "settings.automations.scheduleMode.custom": "Custom",
    "settings.automations.scheduleModeLabel": "Schedule type",
    "settings.automations.scheduleIntervalLabel": "Every",
    "settings.automations.scheduleWeekday": "Day",
    "settings.automations.scheduleTime": "Time",
    "settings.automations.showTimePicker": "Show time picker",
    "settings.automations.hideTimePicker": "Hide time picker",
    "settings.automations.timePicker.setTime": "Set time to {time}",
    "settings.automations.scheduleCustomLabel": "Custom RRULE",
    "settings.automations.scheduleCustomPlaceholder":
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0",
    "settings.automations.saveTooltip.combined.create": "{requirements} to create",
    "settings.automations.saveTooltip.combined.save": "{requirements} to save",
    "settings.automations.saveTooltip.item.name.create": "Create title",
    "settings.automations.saveTooltip.item.name.save": "create title",
    "settings.automations.saveTooltip.item.prompt.create": "Add prompt",
    "settings.automations.saveTooltip.item.prompt.save": "add prompt",
    "settings.automations.saveTooltip.item.cwd.create": "Select project",
    "settings.automations.saveTooltip.item.cwd.save": "select project",
    "settings.automations.saveTooltip.item.thread.create": "Select chat",
    "settings.automations.saveTooltip.item.thread.save": "select chat",
    "settings.automations.saveTooltip.item.executionEnvironment.create":
      "Choose where to run it",
    "settings.automations.saveTooltip.item.executionEnvironment.save":
      "choose where to run it",
    "settings.automations.saveTooltip.item.model.create": "Choose a model",
    "settings.automations.saveTooltip.item.model.save": "choose a model",
    "settings.automations.saveTooltip.item.schedule.create": "Fix the schedule",
    "settings.automations.saveTooltip.item.schedule.save": "fix the schedule",
    "settings.automations.banner.tooltipLabel": "Automation sandbox details",
    "settings.automations.banner.danger":
      "Automations run with the default sandbox mode (currently full access). Full access background automations are high risk: Codex may modify files, execute commands, and access the network without asking. We recommend changing the sandbox mode to workspace write and using <rulesDocsLink>rules</rulesDocsLink> to selectively define which commands agents can run with full access.",
    "settings.automations.banner.defaultHowTo.readOnly":
      "Automations run with the default sandbox mode (currently read-only). If tool calls need to modify files, access the network, or use computer applications, they will fail. We recommend updating the sandbox to workspace write.",
    "settings.automations.banner.defaultHowTo.default":
      "Automations run with the default sandbox mode. If tool calls need to modify files outside the workspace, access the network, or use computer applications, they will fail. You can use <rulesDocsLink>rules</rulesDocsLink> to selectively allow specific commands to run outside the sandbox.",
    "inbox.rightPanel.quickStart.section.statusReports": "Status reports",
    "inbox.rightPanel.quickStart.section.releasePrep": "Release prep",
    "inbox.rightPanel.quickStart.section.incidentsAndTriage":
      "Incidents & triage",
    "inbox.rightPanel.quickStart.section.codeQuality": "Code quality",
    "inbox.rightPanel.quickStart.section.repoMaintenance": "Repo maintenance",
    "inbox.rightPanel.quickStart.section.growthAndExploration":
      "Growth & exploration",
    "inbox.rightPanel.quickStart.home.defaultDraftName": "Automation",
    "inbox.rightPanel.quickStart.home.dailyBugScan.draftName":
      "Daily bug scan",
    "inbox.rightPanel.quickStart.home.weeklyReleaseNotes.draftName":
      "Weekly release notes",
    "inbox.rightPanel.quickStart.home.dailyStandup.draftName":
      "Standup summary",
    "inbox.rightPanel.quickStart.home.nightlyCiReport.draftName":
      "Nightly CI report",
    "inbox.rightPanel.quickStart.home.dailyClassicGame.draftName":
      "Daily classic game",
    "inbox.rightPanel.quickStart.home.skillProgressionMap.draftName":
      "Skill progression map",
    "inbox.rightPanel.quickStart.home.weeklyEngineeringSummary.draftName":
      "Weekly engineering summary",
    "inbox.rightPanel.quickStart.home.performanceRegressionWatch.draftName":
      "Performance regression watch",
    "inbox.rightPanel.quickStart.home.dependencySdkDrift.draftName":
      "Dependency and SDK drift",
    "inbox.rightPanel.quickStart.home.testGapDetection.draftName":
      "Test gap detection",
    "inbox.rightPanel.quickStart.home.preReleaseCheck.draftName":
      "Pre-release check",
    "inbox.rightPanel.quickStart.home.agentsDocsSync.draftName":
      "Update AGENTS.md",
    "inbox.rightPanel.quickStart.home.weeklyPrSummary.draftName":
      "Weekly PR summary",
    "inbox.rightPanel.quickStart.home.issueTriage.draftName": "Issue triage",
    "inbox.rightPanel.quickStart.home.ciMonitor.draftName": "CI monitor",
    "inbox.rightPanel.quickStart.home.dependencySweep.draftName":
      "Dependency sweep",
    "inbox.rightPanel.quickStart.home.performanceAudit.draftName":
      "Performance audit",
    "inbox.rightPanel.quickStart.home.changelogUpdate.draftName":
      "Update changelog",
  },
  "zh-CN": {
    "home.useCases.dailyBugScan.prompt": "扫描最近提交中的潜在 bug，并提出最小修复。",
    "home.useCases.dailyBugScan.automationPrompt": `扫描最近提交（自上次运行以来，或最近 24 小时内）中的潜在 bug，并提出最小修复。

依据规则：
- 只使用代码仓库中的具体证据（commit SHA、PR、文件路径、diff、失败测试、CI 信号）。
- 不要凭空捏造 bug；如果证据不足，就说明并跳过。
- 优先最小且安全的修复；避免重构和无关清理。`,
    "home.useCases.weeklyReleaseNotes.prompt":
      "根据已合并的 PR 起草发布说明。",
    "home.useCases.weeklyReleaseNotes.automationPrompt": `根据已合并的 PR 起草每周发布说明（如有链接请附上）。

范围与依据：
- 严格限定在本周代码仓库历史内；不要添加数据无法支撑的额外章节。
- 使用 PR 编号和标题；除非有 PR 描述、测试或指标支持，否则不要推断影响。`,
    "home.useCases.dailyStandup.prompt":
      "总结昨天的 git 活动，用于站会同步。",
    "home.useCases.dailyStandup.automationPrompt": `总结昨天的 git 活动，用于站会同步。

依据规则：
- 结论要锚定到提交、PR 或文件；不要推测意图或未来工作。
- 保持易扫读，适合团队同步。`,
    "home.useCases.nightlyCiReport.prompt": "总结 CI 失败和 flaky 测试。",
    "home.useCases.nightlyCiReport.automationPrompt": `总结上一个 CI 窗口中的失败和 flaky 测试，并给出优先修复建议。

依据规则：
- 尽量引用具体 job、测试名、错误信息或日志片段。
- 不要过度自信地下结论；区分“观察到的”与“怀疑的”。`,
    "home.useCases.dailyClassicGame.prompt":
      "做一个范围尽量小的经典小游戏。",
    "home.useCases.dailyClassicGame.automationPrompt": `做一个范围尽量小的经典小游戏。

约束：
- 除非确有必要，不要增加额外功能、样式系统、内容或新依赖。
- 尽量复用仓库现有工具链和模式。`,
    "home.useCases.skillProgressionMap.prompt":
      "根据最近的 PR 和 review，建议下一步值得深化的技能。",
    "home.useCases.skillProgressionMap.automationPrompt": `根据最近的 PR 和 review，建议下一步值得深化的技能。

依据规则：
- 每条建议都要锚定到具体证据（PR 主题、review 评论、反复出现的问题）。
- 避免泛泛建议；每条建议都应具体且可执行。`,
    "home.useCases.weeklyEngineeringSummary.prompt":
      "综合本周的 PR、发布、事故与评审情况。",
    "home.useCases.weeklyEngineeringSummary.automationPrompt": `将本周的 PR、发布、事故与评审综合为一份周报。

依据规则：
- 不要编造事件；若缺少数据，简短说明即可。
- 尽量引用具体对象（PR #、事故 ID、发布说明、文件路径）。`,
    "home.useCases.performanceRegressionWatch.prompt":
      "关注最近变更中的性能回退。",
    "home.useCases.performanceRegressionWatch.automationPrompt": `对比最近变更与 benchmark 或 trace，尽早标记性能回退。

依据规则：
- 结论必须基于可量化信号（benchmark、trace、耗时、火焰图）。
- 如果没有测量数据，直接写“未找到测量数据”，不要猜测。`,
    "home.useCases.dependencySdkDrift.prompt":
      "检测依赖和 SDK 漂移，并提出对齐建议。",
    "home.useCases.dependencySdkDrift.automationPrompt": `检测依赖和 SDK 漂移，并提出最小化的对齐方案。

依据规则：
- 尽量引用仓库中的当前和目标版本（锁文件、包清单）。
- 不要猜版本；如果目标不清晰，给出选项并标注为建议。`,
    "home.useCases.testGapDetection.prompt":
      "从最近变更中找出测试缺口，并创建 draft PR。",
    "home.useCases.testGapDetection.automationPrompt": `识别最近变更中的未测试路径；补充聚焦测试，并使用 $yeet 创建 draft PR。

约束：
- 范围限定在改动区域；避免大范围重构。
- 优先选择小而可靠、能先失败后通过的测试。`,
    "home.useCases.preReleaseCheck.prompt": "在打 tag 前执行发布前检查。",
    "home.useCases.preReleaseCheck.automationPrompt": `在打 tag 前，检查 changelog、迁移、feature flag 和测试。

依据规则：
- 只报告你能从仓库和 CI 环境确认的内容。
- 如果某项无法验证，明确标记为“未知”。`,
    "home.useCases.agentsDocsSync.prompt":
      "根据新流程和命令更新 AGENTS.md。",
    "home.useCases.agentsDocsSync.automationPrompt": `根据新发现的工作流和命令更新 AGENTS.md。

约束：
- 保持改动最小、准确，并基于仓库实际使用情况。
- 不要修改无关章节或自动生成文件。
- 如果不确定，优先加一个简短 TODO，而不是编造。`,
    "home.useCases.weeklyPrSummary.prompt":
      "按同事和主题总结上周的 PR。",
    "home.useCases.weeklyPrSummary.automationPrompt": `按同事和主题总结上周的 PR，并标出风险。

依据规则：
- 尽量使用 PR 编号和标题。
- 不要推断影响；只描述 PR 实际改了什么。`,
    "home.useCases.issueTriage.prompt":
      "分诊新 issue，并建议负责人和优先级。",
    "home.useCases.issueTriage.automationPrompt": `分诊新 issue；建议 owner、优先级和标签。

依据规则：
- 建议要基于 issue 内容和仓库上下文（CODEOWNERS、涉及区域、类似历史 issue）。
- 没有足够信号时不要猜 owner；可以写“Owner: Unknown”并建议团队。`,
    "home.useCases.ciMonitor.prompt": "检查 CI 失败，并归类可能根因。",
    "home.useCases.ciMonitor.automationPrompt": `检查 CI 失败；按可能根因分组，并建议最小修复。

依据规则：
- 引用 job、测试、错误和日志证据。
- 不要过度自信地下结论；不确定项标记为“怀疑”。`,
    "home.useCases.dependencySweep.prompt":
      "扫描过期依赖，并提出安全升级建议。",
    "home.useCases.dependencySweep.automationPrompt": `扫描过期依赖；以最小改动提出安全升级建议。

规则：
- 优先选择最小可行升级集合。
- 明确指出破坏性变更风险和所需迁移。
- 未识别出仓库中的当前版本前，不要提出升级建议。`,
    "home.useCases.performanceAudit.prompt":
      "审计性能回退并提出修复建议。",
    "home.useCases.performanceAudit.automationPrompt": `审计性能回退，并提出收益最高的修复方向。

依据规则：
- 尽量基于测量或 trace。
- 如果证据不足，简要说明不确定性，并指出下一步该测什么。`,
    "home.useCases.changelogUpdate.prompt": "用本周重点更新 changelog。",
    "home.useCases.changelogUpdate.automationPrompt": `用本周重点和关键 PR 链接更新 changelog。

约束：
- 只包含仓库历史能支撑的内容。
- 保持结构简单，并与现有 changelog 格式一致。`,
    "settings.automations.modal.useTemplate": "使用模板",
    "settings.automations.modal.createNew": "新建",
    "settings.automations.modal.expand": "展开自动化弹窗",
    "settings.automations.modal.collapse": "收起自动化弹窗",
    "settings.automations.modal.templateTitle": "自动化模板",
    "settings.automations.executionEnvironment.menuTitle": "运行位置",
    "settings.automations.executionEnvironment.compactTooltip":
      "在{environment}中运行",
    "settings.automations.executionEnvironment.local.help":
      "直接在所选项目目录中运行，不创建 worktree。",
    "settings.automations.executionEnvironment.worktree.help":
      "在从所选项目创建的独立 Git worktree 中运行，不影响当前检出。",
    "settings.automations.heartbeatThread.title": "目标对话",
    "settings.automations.heartbeatThread.ariaLabel": "目标对话",
    "settings.automations.heartbeatThread.empty":
      "请先固定一个本地对话，才能使用 heartbeat 自动化",
    "settings.automations.heartbeatThread.unpinned": "未固定",
    "settings.automations.model.ariaLabel": "模型",
    "settings.automations.model.title": "模型",
    "settings.automations.model.loading": "正在加载模型",
    "settings.automations.reasoning.ariaLabel": "推理",
    "settings.automations.reasoning.title": "推理",
    "settings.automations.reasoning.loading": "正在加载推理",
    "settings.automations.reasoning.compactTooltip":
      "{reasoning} 推理",
    "settings.automations.scheduleMode.interval": "间隔",
    "settings.automations.scheduleMode.hourly": "每小时",
    "settings.automations.scheduleMode.daily": "每天",
    "settings.automations.scheduleMode.weekdays": "工作日",
    "settings.automations.scheduleMode.weekly": "每周",
    "settings.automations.scheduleMode.custom": "自定义",
    "settings.automations.scheduleModeLabel": "计划类型",
    "settings.automations.scheduleIntervalLabel": "每隔",
    "settings.automations.scheduleWeekday": "日期",
    "settings.automations.scheduleTime": "时间",
    "settings.automations.showTimePicker": "显示时间选择器",
    "settings.automations.hideTimePicker": "隐藏时间选择器",
    "settings.automations.timePicker.setTime": "将时间设为 {time}",
    "settings.automations.scheduleCustomLabel": "自定义 RRULE",
    "settings.automations.scheduleCustomPlaceholder":
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0",
    "settings.automations.saveTooltip.combined.create": "{requirements} to create",
    "settings.automations.saveTooltip.combined.save": "{requirements} to save",
    "settings.automations.saveTooltip.item.name.create": "创建标题",
    "settings.automations.saveTooltip.item.name.save": "创建标题",
    "settings.automations.saveTooltip.item.prompt.create": "添加提示词",
    "settings.automations.saveTooltip.item.prompt.save": "添加提示词",
    "settings.automations.saveTooltip.item.cwd.create": "选择项目",
    "settings.automations.saveTooltip.item.cwd.save": "选择项目",
    "settings.automations.saveTooltip.item.thread.create": "选择对话",
    "settings.automations.saveTooltip.item.thread.save": "选择对话",
    "settings.automations.saveTooltip.item.executionEnvironment.create":
      "选择运行位置",
    "settings.automations.saveTooltip.item.executionEnvironment.save":
      "选择运行位置",
    "settings.automations.saveTooltip.item.model.create": "选择模型",
    "settings.automations.saveTooltip.item.model.save": "选择模型",
    "settings.automations.saveTooltip.item.schedule.create": "修复计划",
    "settings.automations.saveTooltip.item.schedule.save": "修复计划",
    "settings.automations.banner.tooltipLabel": "自动化沙盒详情",
    "settings.automations.banner.danger":
      "自动化任务以默认沙盒设置（当前为全权限）运行。全权限后台自动化存在较高风险，Codex 可能无需询问即修改文件、执行命令及访问网络。建议将沙盒设置为工作空间写入权限，并通过<rulesDocsLink>规则</rulesDocsLink>选择性定义代理可全权限运行的命令。",
    "settings.automations.banner.defaultHowTo.readOnly":
      "自动化任务以默认沙盒设置（当前为只读）运行。若工具调用需修改文件、访问网络或操作电脑应用，该操作将执行失败。建议将沙盒更新为工作空间写入权限。",
    "settings.automations.banner.defaultHowTo.default":
      "自动化任务以默认沙盒设置运行。若工具调用需修改工作空间外文件、访问网络或操作电脑应用，该操作将执行失败。可通过<rulesDocsLink>规则</rulesDocsLink>选择性允许特定命令在沙盒外运行。",
    "inbox.rightPanel.quickStart.section.statusReports": "Status reports",
    "inbox.rightPanel.quickStart.section.releasePrep": "Release prep",
    "inbox.rightPanel.quickStart.section.incidentsAndTriage":
      "Incidents & triage",
    "inbox.rightPanel.quickStart.section.codeQuality": "Code quality",
    "inbox.rightPanel.quickStart.section.repoMaintenance": "Repo maintenance",
    "inbox.rightPanel.quickStart.section.growthAndExploration":
      "Growth & exploration",
    "inbox.rightPanel.quickStart.home.defaultDraftName": "Automation",
    "inbox.rightPanel.quickStart.home.dailyBugScan.draftName":
      "Daily bug scan",
    "inbox.rightPanel.quickStart.home.weeklyReleaseNotes.draftName":
      "Weekly release notes",
    "inbox.rightPanel.quickStart.home.dailyStandup.draftName":
      "Standup summary",
    "inbox.rightPanel.quickStart.home.nightlyCiReport.draftName":
      "Nightly CI report",
    "inbox.rightPanel.quickStart.home.dailyClassicGame.draftName":
      "Daily classic game",
    "inbox.rightPanel.quickStart.home.skillProgressionMap.draftName":
      "Skill progression map",
    "inbox.rightPanel.quickStart.home.weeklyEngineeringSummary.draftName":
      "Weekly engineering summary",
    "inbox.rightPanel.quickStart.home.performanceRegressionWatch.draftName":
      "Performance regression watch",
    "inbox.rightPanel.quickStart.home.dependencySdkDrift.draftName":
      "Dependency and SDK drift",
    "inbox.rightPanel.quickStart.home.testGapDetection.draftName":
      "Test gap detection",
    "inbox.rightPanel.quickStart.home.preReleaseCheck.draftName":
      "Pre-release check",
    "inbox.rightPanel.quickStart.home.agentsDocsSync.draftName":
      "Update AGENTS.md",
    "inbox.rightPanel.quickStart.home.weeklyPrSummary.draftName":
      "Weekly PR summary",
    "inbox.rightPanel.quickStart.home.issueTriage.draftName": "Issue triage",
    "inbox.rightPanel.quickStart.home.ciMonitor.draftName": "CI monitor",
    "inbox.rightPanel.quickStart.home.dependencySweep.draftName":
      "Dependency sweep",
    "inbox.rightPanel.quickStart.home.performanceAudit.draftName":
      "Performance audit",
    "inbox.rightPanel.quickStart.home.changelogUpdate.draftName":
      "Update changelog",
  },
} as const;
