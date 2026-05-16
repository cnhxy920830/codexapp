import { PULL_REQUESTS_PAGE_MESSAGES, type PullRequestsPageMessageKey } from "./pullRequestsPageMessages";
import {
  AUTOMATIONS_PAGE_MESSAGES,
  type AutomationsPageMessageKey,
} from "./automationsPageMessages";

export const UPSTREAM_LOCALE_CODES = [
  "en-US",
  "am",
  "ar",
  "bg-BG",
  "bn-BD",
  "bs-BA",
  "ca-ES",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "es-419",
  "es-ES",
  "et-EE",
  "fa",
  "fi-FI",
  "fr-CA",
  "fr-FR",
  "gu-IN",
  "hi-IN",
  "hr-HR",
  "hu-HU",
  "hy-AM",
  "id-ID",
  "is-IS",
  "it-IT",
  "ja-JP",
  "ka-GE",
  "kk",
  "kn-IN",
  "ko-KR",
  "lt",
  "lv-LV",
  "mk-MK",
  "ml",
  "mn",
  "mr-IN",
  "ms-MY",
  "my-MM",
  "nb-NO",
  "nl-NL",
  "pa",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sl-SI",
  "so-SO",
  "sq-AL",
  "sr-RS",
  "sv-SE",
  "sw-TZ",
  "ta-IN",
  "te-IN",
  "th-TH",
  "tl",
  "tr-TR",
  "uk-UA",
  "ur",
  "vi-VN",
  "zh-CN",
  "zh-HK",
  "zh-TW",
] as const;

export type LocaleCode = (typeof UPSTREAM_LOCALE_CODES)[number];
type MessageLocaleCode = "en-US" | "zh-CN";
export type MessageValues = Record<string, number | string>;

export type MessageKey =
  | "app.menu.file"
  | "app.menu.edit"
  | "app.menu.view"
  | "app.menu.window"
  | "app.menu.help"
  | "app.nav.newChat"
  | "app.nav.search"
  | "app.nav.settings"
  | "skills.appsPage.heading.plugins"
  | "skills.appsPage.subheading.plugins"
  | "skills.appsPage.search.plugins"
  | "skills.appsPage.search.plugins.label"
  | "skills.appsPage.loading"
  | "skills.appsPage.loadError.title"
  | "skills.appsPage.loadError.retry"
  | "skills.appsPage.empty.plugins"
  | "skills.appsPage.manageTab.plugins"
  | "skills.appsPage.manageTab.apps"
  | "skills.appsPage.manageTab.mcps"
  | "skills.appsPage.manageTab.skills"
  | "skills.appsPage.manageTab.marketplace"
  | "skills.appsPage.empty.installedApps"
  | "skills.appsPage.empty.mcps"
  | "skills.appsPage.empty.skills"
  | "skills.appsPage.marketplace.loading"
  | "skills.appsPage.marketplace.loadError.title"
  | "skills.appsPage.marketplace.loadError.retry"
  | "skills.appsPage.empty.marketplace"
  | "skills.appsPage.marketplace.pluginCount"
  | "skills.appsPage.marketplace.upgradeAll"
  | "skills.appsPage.marketplace.upgradeAll.tooltip"
  | "skills.appsPage.marketplace.upgrade.ariaLabel"
  | "skills.appsPage.marketplace.upgrade.button"
  | "skills.appsPage.marketplace.upgrade"
  | "skills.appsPage.marketplace.upgrade.builtInDisabled"
  | "skills.appsPage.marketplace.upgrade.workspaceDisabled"
  | "skills.appsPage.marketplace.upgrade.localDisabled"
  | "skills.appsPage.marketplace.remove"
  | "skills.appsPage.marketplace.remove.ariaLabel"
  | "skills.appsPage.marketplace.remove.builtInDisabled"
  | "skills.appsPage.marketplace.remove.workspaceDisabled"
  | "skills.appsPage.marketplace.removeDialog.title"
  | "skills.appsPage.marketplace.removeDialog.description"
  | "skills.appsPage.marketplace.removeDialog.cancel"
  | "skills.appsPage.marketplace.removeDialog.confirm"
  | "skills.appsPage.marketplace.partialLoadError.title"
  | "skills.appsPage.marketplace.partialLoadError.more"
  | "skills.appsPage.marketplace.partialLoadError.retry"
  | "skills.appsPage.mcps.settings"
  | "skills.appsPage.mcps.enable"
  | "skills.appsPage.mcps.disable"
  | "skills.appsPage.mcps.toggle"
  | "skills.appsPage.mcps.toggleError"
  | "skills.appsPage.apps.toggle"
  | "skills.appsPage.apps.toggleError"
  | "skills.appsPage.skills.enable"
  | "skills.appsPage.skills.disable"
  | "skills.appsPage.skills.toggle"
  | "skills.appsPage.skills.toggleError"
  | "skills.appsPage.toolsDialog.open"
  | "skills.appsPage.toolsDialog.moreActions"
  | "skills.appsPage.toolsDialog.enableApp"
  | "skills.appsPage.toolsDialog.disableApp"
  | "skills.appsPage.toolsDialog.tryInChat"
  | "skills.appsPage.toolsDialog.tryInChatDisabled"
  | "skills.appsPage.toolsDialog.disabledBadge"
  | "skills.appsPage.toolsDialog.subtitle"
  | "skills.appsPage.toolsDialog.summary"
  | "skills.appsPage.toolsDialog.loading"
  | "skills.appsPage.toolsDialog.empty"
  | "skills.appsPage.toolsDialog.error"
  | "skills.appsPage.addMarketplace.title"
  | "skills.appsPage.addMarketplace.header"
  | "skills.appsPage.addMarketplace.subtitle"
  | "skills.appsPage.addMarketplace.sourceRequired"
  | "skills.appsPage.addMarketplace.sourceLabel"
  | "skills.appsPage.addMarketplace.sourcePlaceholder"
  | "skills.appsPage.addMarketplace.refLabel"
  | "skills.appsPage.addMarketplace.refPlaceholder"
  | "skills.appsPage.addMarketplace.sparsePathsLabel"
  | "skills.appsPage.addMarketplace.sparsePathsPlaceholder"
  | "skills.appsPage.addMarketplace.cancel"
  | "skills.appsPage.addMarketplace.submit"
  | "skills.appsPage.addMarketplace.failed"
  | "skills.appsPage.addMarketplace.refreshFailed"
  | "skills.appsPage.addMarketplace.alreadyAdded"
  | "skills.appsPage.addMarketplace.success"
  | "skills.appsPage.pluginsUnsupportedHost.title"
  | "skills.appsPage.pluginsUnsupportedHost.description"
  | "skills.appsPage.browseIntro.title"
  | "skills.appsPage.hostDropdown.local"
  | "skills.appsPage.hostDropdown.title"
  | "skills.appsPage.pluginsFilter.all"
  | "skills.appsPage.categoryFilter.all"
  | "skills.appsPage.categoryFilter.trigger"
  | "skills.appsPage.categoryDropdown.ariaLabel"
  | "skills.appsPage.browseDropdown.ariaLabel"
  | "skills.appsPage.marketplaceFilter.addMore"
  | "skills.page.heading"
  | "skills.page.subheading"
  | "skills.page.loading"
  | "skills.page.empty"
  | "skills.page.filteredEmpty"
  | "skills.page.filteredEmptyDescription"
  | "skills.page.search"
  | "skills.page.search.label"
  | "skills.page.createSkill"
  | "skills.page.refreshSkills"
  | "skills.page.refreshSkillsToUseNew"
  | "skills.page.refreshFailed"
  | "skills.pluginsAuthBlockedToast.title"
  | "skills.pluginsAuthBlockedToast.description"
  | "skills.section.installed"
  | "skills.section.recommended"
  | "settings.nav.skills-settings"
  | "settings.section.skills-settings"
  | "skills.card.enabledStatus"
  | "skills.card.disabledStatus"
  | "skills.card.loadingContents"
  | "skills.card.contentsError"
  | "skills.card.removeSuccess"
  | "skills.card.removeFailed"
  | "skills.card.toggleEnabledError"
  | "skills.card.disabledBadge"
  | "skills.card.open"
  | "skills.card.moreActions"
  | "skills.card.details"
  | "skills.card.uninstall"
  | "skills.card.try"
  | "skills.card.enableSuccess"
  | "skills.card.disableSuccess"
  | "skills.card.enableSkill"
  | "skills.card.disableSkill"
  | "plugins.card.enableToggleTooltip"
  | "plugins.card.disableToggleTooltip"
  | "plugins.card.toggleAria"
  | "plugins.card.enabledStatus"
  | "plugins.card.disabledStatus"
  | "plugins.card.enableButton"
  | "plugins.card.installTooltip"
  | "plugins.card.tryInChat"
  | "plugins.card.enableSuccess"
  | "plugins.card.disableSuccess"
  | "plugins.card.toggleError"
  | "plugins.importedConnectors.title"
  | "plugins.importedConnectors.empty"
  | "plugins.importedConnectors.finishSetup"
  | "plugins.hero.tryInChat"
  | "plugins.hero.dotLabel"
  | "plugins.hero.copy.computerUse"
  | "plugins.hero.copy.gmail"
  | "plugins.hero.copy.slack"
  | "plugins.hero.copy.googleCalendar"
  | "plugins.hero.copy.googleDrive"
  | "plugins.hero.copy.linear"
  | "skills.recommended.error"
  | "skills.scope.builtIn"
  | "skills.scope.team"
  | "skills.scope.personal"
  | "skills.scope.adminInstalled"
  | "plugins.marketplace.removeSuccess"
  | "plugins.marketplace.removeError"
  | "plugins.marketplace.upgradeAllSuccess"
  | "plugins.marketplace.upgradeSuccess"
  | "plugins.marketplace.upgradeAllError"
  | "plugins.marketplace.upgradeError"
  | "plugins.marketplace.upgradeAllRequestError"
  | "app.shell.appMenu"
  | "app.shell.back"
  | "app.shell.forward"
  | "app.shell.toggleSidebar"
  | "app.shell.settings"
  | "app.shell.share"
  | "home.hero.letsBuild"
  | "threadPage.newThread"
  | "hotkeyWindow.dismiss"
  | "hotkeyWindow.defaultTitle"
  | "hotkeyWindow.threadPage.newButton"
  | "hotkeyWindow.threadPage.openInMainWindow"
  | "codex.alert.closeAriaLabel"
  | "codex.archiveInfo.electron"
  | "codex.archiveInfo.settingsLink"
  | "codex.signInFailed.message"
  | "codex.legal.step.intro.title"
  | "codex.legal.step.intro.subtitle"
  | "codex.legal.step.cloud.title"
  | "codex.legal.step.cloud.subtitle"
  | "codex.legal.step.todo.title"
  | "codex.legal.step.todo.subtitle"
  | "codex.legal.autonomy.title"
  | "codex.legal.autonomy.details"
  | "codex.legal.autonomy.details.link"
  | "codex.legal.mistakes.title"
  | "codex.legal.mistakes.review"
  | "codex.legal.powered.title"
  | "codex.legal.powered.details"
  | "codex.legal.powered.details.link"
  | "codex.legal.copilot.title"
  | "codex.legal.copilot.details"
  | "codex.legal.copilot.oaiTosLink"
  | "codex.legal.copilot.gitHubTosLink"
  | "codex.legal.backButton"
  | "codex.legal.continueButton"
  | "codex.legal.continue.apikey"
  | "codex.legal.cloud.taskOne.title"
  | "codex.legal.cloud.taskOne.meta"
  | "codex.legal.cloud.taskTwo.title"
  | "codex.legal.cloud.taskTwo.meta"
  | "codex.legal.cloud.taskTwo.stats.positive"
  | "codex.legal.cloud.taskTwo.stats.negative"
  | "codex.legal.cloud.taskThree.title"
  | "codex.legal.cloud.taskThree.meta"
  | "codex.legal.cloud.taskThree.stats.positive"
  | "codex.legal.cloud.taskThree.stats.negative"
  | "codex.legal.todo.heading"
  | "app.chat.noRecentThreads"
  | "app.chat.noMessages"
  | "app.chat.changedFiles"
  | "app.chat.undo"
  | "app.chat.viewDiff"
  | "app.chat.commit"
  | "app.chat.projects"
  | "app.chat.filesChanged"
  | "app.chat.composePlaceholder"
  | "composer.placeholder.newTask.doAnything"
  | "composer.footer.v2.cloudTab"
  | "composer.mode.worktreeSegment"
  | "composer.hotkeyWindow.modeDropdown.localProject"
  | "composer.hotkeyWindow.modeDropdown.tooltip"
  | "composer.mode.local"
  | "composer.hotkeyWindow.modeDropdown.localOnly"
  | "composer.mode.worktree"
  | "app.chat.send"
  | "app.chat.stop"
  | "app.chat.queuedFollowUps"
  | "commentAttachments.numAnnotations"
  | "commentAttachments.numComments"
  | "app.chat.removeQueuedFollowUp"
  | "app.chat.commandExecution"
  | "app.chat.fileChange"
  | "app.chat.hookPrompt"
  | "localConversation.hookItem.eventName.preToolUse"
  | "localConversation.hookItem.eventName.postToolUse"
  | "localConversation.hookItem.eventName.sessionStart"
  | "localConversation.hookItem.eventName.userPromptSubmit"
  | "localConversation.hookItem.eventName.permissionRequest"
  | "localConversation.hookItem.eventName.stop"
  | "localConversation.hookItem.summary.withStatusMessage"
  | "localConversation.hookItem.summary.ariaLabel"
  | "localConversation.hookItem.feedback"
  | "localConversation.hookItem.warning"
  | "localConversation.hookItem.error"
  | "localConversation.hookItem.hookContext"
  | "localConversation.hookItem.stop"
  | "app.chat.contextCompaction"
  | "app.chat.contextCompactionDescription"
  | "app.chat.imageGeneration"
  | "app.chat.collabAgentToolCall"
  | "app.chat.mcpServer"
  | "app.chat.mcpTool"
  | "app.chat.agentTool"
  | "app.chat.senderThread"
  | "app.chat.receiverThreads"
  | "homePage.mainContent"
  | "app.chat.revisedPrompt"
  | "app.chat.prompt"
  | "app.chat.model"
  | "app.chat.reasoningEffort"
  | "app.chat.agentStatus"
  | "app.chat.savedPath"
  | "app.chat.toolNamespace"
  | "app.chat.toolCallFailed"
  | "app.chat.output"
  | "app.chat.noOutput"
  | "hotkeyWindow.home.placeholder.unknownProject"
  | "hotkeyWindow.home.placeholder.projectless"
  | "hotkeyWindow.home.placeholder.cloud"
  | "hotkeyWindow.home.placeholder.worktree"
  | "hotkeyWindow.home.placeholder.local"
  | "hotkeyWindow.home.taskMenu.startIn.projectlessTooltip"
  | "hotkeyWindow.home.taskMenu.startIn.disabledTooltip"
  | "hotkeyWindow.home.taskMenu.label"
  | "hotkeyWindow.home.taskMenu.project"
  | "hotkeyWindow.home.taskMenu.startIn"
  | "hotkeyWindow.home.taskMenu.environment"
  | "hotkeyWindow.home.taskMenu.branch"
  | "hotkeyWindow.home.taskMenu.permissions"
  | "composer.permissionsDropdown.default.label"
  | "composer.permissionsDropdown.default.optionLabel"
  | "composer.permissionsDropdown.default.tooltip"
  | "composer.permissionsDropdown.guardianApproval.shortLabel"
  | "composer.permissionsDropdown.guardianApproval.tooltip"
  | "composer.permissionsDropdown.guardianApproval.disabled"
  | "composer.mode.agentMode.guardianApprovals"
  | "composer.permissionsDropdown.fullAccess.label"
  | "composer.permissionsDropdown.fullAccess.optionLabel"
  | "composer.permissionsDropdown.agentMode.tooltip.fullAccess"
  | "composer.permissionsDropdown.fullAccess.disabled"
  | "composer.permissionsDropdown.fullAccess.disabledGlobalDefault"
  | "composer.permissionsDropdown.custom.label"
  | "composer.permissionsDropdown.custom.optionLabel"
  | "composer.permissionsDropdown.agentMode.tooltip.custom"
  | "composer.permissionsDropdown.disabled.requirements"
  | "composer.permissionsDropdown.trigger.tooltip"
  | "composer.mode.agentMode.fullAccessConfirm.title"
  | "composer.mode.agentMode.fullAccessConfirm.description"
  | "composer.mode.agentMode.fullAccessConfirm.caution"
  | "composer.mode.agentMode.fullAccessConfirm.goBack"
  | "composer.mode.agentMode.fullAccessConfirm.confirm"
  | "composer.remote.currentBranch"
  | "composer.remote.branch"
  | "composer.remote.localWorkingTree"
  | "composer.remote.localFileStateHeading"
  | "composer.remote.currentEditsSuffix.useLocal"
  | "composer.remote.branchStartingPoint"
  | "composer.remote.branchesSectionHeading"
  | "codex.composer.searchBranches"
  | "composer.remote.errorLoadingBranches"
  | "composer.remote.loadingMoreBranches"
  | "composer.footer.branchSwitch.tooltip"
  | "composer.footer.branchSwitch.checkoutError"
  | "composer.footer.branchSwitch.createBranchError"
  | "composer.footer.branchSwitch.uncommittedSummaryPrefix"
  | "composer.footer.branchSwitch.createAndCheckout.disabledTooltip"
  | "composer.footer.branchSwitch.createAndCheckout"
  | "composer.footer.branchSwitch.createDialog.title"
  | "composer.footer.branchSwitch.createDialog.placeholder"
  | "composer.footer.branchSwitch.createDialog.ariaLabel"
  | "composer.footer.branchSwitch.createDialog.trailingSlashError"
  | "composer.footer.branchSwitch.createDialog.branchExistsError"
  | "composer.footer.branchSwitch.createDialog.close"
  | "composer.footer.branchSwitch.createDialog.createAndCheckout"
  | "composer.footer.branchSwitch.uncommittedDialog.title"
  | "composer.footer.branchSwitch.uncommittedDialog.conflict.bodyPrefix"
  | "composer.footer.branchSwitch.uncommittedDialog.conflict.bodySuffix"
  | "composer.footer.branchSwitch.uncommittedDialog.body.noDiff"
  | "composer.footer.branchSwitch.uncommittedDialog.targetBranchFallback"
  | "composer.footer.branchSwitch.uncommittedDialog.cancel"
  | "composer.footer.branchSwitch.uncommittedDialog.commit"
  | "composer.footer.branchSwitch.commitDialog.title"
  | "composer.footer.branchSwitch.commitDialog.subtitle"
  | "composer.footer.branchSwitch.commitDialog.messageLabel"
  | "composer.footer.branchSwitch.commitDialog.messagePlaceholder"
  | "composer.footer.branchSwitch.commitDialog.cancel"
  | "composer.footer.branchSwitch.commitDialog.commit"
  | "composer.contextWindowUsageLabel"
  | "composer.contextWindowUsageStatusFull"
  | "composer.contextWindowUsageStatusLeft"
  | "composer.contextWindowUsageTooltip"
  | "composer.contextWindow.usagePercent"
  | "composer.contextWindow.autoCompactionTooltipLine1"
  | "composer.pendingThreadGoal.summary"
  | "composer.pendingThreadGoal.editTooltip"
  | "composer.pendingThreadGoal.edit"
  | "composer.pendingThreadGoal.clearTooltip"
  | "composer.pendingThreadGoal.clear"
  | "composer.threadGoalEditor.editTitle"
  | "composer.threadGoalEditor.createTitle"
  | "composer.threadGoalEditor.objectiveAriaLabel"
  | "composer.threadGoalEditor.objectivePlaceholder"
  | "composer.threadGoalEditor.useDraft"
  | "composer.threadGoalEditor.cancel"
  | "composer.threadGoalEditor.save"
  | "composer.threadGoalEditor.set"
  | "composer.threadGoal.editTooltip"
  | "composer.threadGoal.edit"
  | "composer.threadGoal.pauseTooltip"
  | "composer.threadGoal.pause"
  | "composer.threadGoal.resumeTooltip"
  | "composer.threadGoal.resume"
  | "composer.threadGoal.clearTooltip"
  | "composer.threadGoal.clear"
  | "composer.threadGoal.expand"
  | "composer.threadGoal.collapse"
  | "composer.threadGoal.summary.active"
  | "composer.threadGoal.summary.paused"
  | "composer.threadGoal.summary.budgetLimited"
  | "composer.threadGoal.summary.complete"
  | "composer.threadGoal.status.active"
  | "composer.threadGoal.status.paused"
  | "composer.threadGoal.status.budgetLimited"
  | "composer.threadGoal.status.complete"
  | "composer.threadGoal.tokenUsage"
  | "composer.threadGoal.setError"
  | "composer.threadGoal.statusUpdateError"
  | "composer.threadGoal.clearError"
  | "localConversation.sync.modal.noChanges"
  | "review.commit.form.title"
  | "review.commit.form.commitTo"
  | "review.commit.form.commitTo.none"
  | "review.commit.form.changesToBeCommitted"
  | "review.commit.messageLabel"
  | "review.commit.messagePlaceholder"
  | "review.commit.customInstructionsLink"
  | "review.commit.includeUnstaged"
  | "review.commit.ariaLabel.includeUnstaged"
  | "review.commit.loading.title.createDraftPr"
  | "review.commit.loading.title.createPr"
  | "review.commit.form.continue"
  | "review.commit.rows.fileCount"
  | "review.commit.generate.emptyResponse"
  | "review.commit.generate.failed"
  | "localConversationPage.createPullRequestError"
  | "localConversationPage.createDraftPullRequestButtonLabel"
  | "localConversationPage.createPullRequestButtonLabel"
  | "localConversation.syncSetup.branchName"
  | "localConversation.syncSetup.setPrefix"
  | "localConversation.syncSetup.branchesLoading"
  | "localConversation.syncSetup.noBranches"
  | "composer.reviewMode.branches.error"
  | "composer.reviewMode.branches.retry"
  | "review.commit.buttonLabel"
  | "localConversation.gitActions.createBranch"
  | "localConversationPage.gitActions"
  | "localConversation.pullRequest.actions.viewPr"
  | "localConversation.pullRequest.actions.statusTitle"
  | "review.gitActions.prStatus.loading"
  | "review.gitActions.prStatus.notInstalled"
  | "review.gitActions.prStatus.notAuthenticated"
  | "review.gitActions.prStatus.notAuthenticatedHint"
  | "review.gitActions.prStatus.noBranch"
  | "review.gitActions.prStatus.loadError"
  | "review.gitActions.prStatus.available"
  | "review.gitActions.prStatus.none"
  | "review.gitActions.prState.draft"
  | "review.gitActions.prState.merged"
  | "review.gitActions.prState.checksFailing"
  | "review.gitActions.prState.checksInProgress"
  | "review.gitActions.prState.changesRequested"
  | "review.gitActions.prState.approved"
  | "review.gitActions.prState.ready"
  | "app.chat.exitCode"
  | "app.chat.durationMs"
  | "app.chat.movedTo"
  | "app.chat.status.inProgress"
  | "app.chat.status.completed"
  | "app.chat.status.failed"
  | "app.chat.status.declined"
  | "app.chat.approval.commandTitle"
  | "app.chat.approval.fileChangeTitle"
  | "app.chat.approval.review"
  | "app.chat.approval.reason"
  | "app.chat.approval.command"
  | "app.chat.approval.workingDirectory"
  | "app.chat.approval.networkAccess"
  | "app.chat.approval.protocol"
  | "app.chat.approval.host"
  | "app.chat.approval.commandActions"
  | "app.chat.approval.additionalPermissions"
  | "app.chat.approval.execPolicyAmendment"
  | "app.chat.approval.networkPolicyAmendments"
  | "app.chat.approval.requestedWriteRoot"
  | "app.chat.approval.changes"
  | "app.chat.approval.noChanges"
  | "app.chat.approval.accept"
  | "app.chat.approval.acceptForSession"
  | "app.chat.approval.decline"
  | "app.chat.approval.cancel"
  | "app.chat.approval.submitting"
  | "app.chat.implementPlan.prompt"
  | "app.chat.implementPlan.implement"
  | "app.chat.implementPlan.otherPlaceholder"
  | "app.chat.implementPlan.dismiss"
  | "app.chat.implementPlan.submit"
  | "app.chat.planImplementation"
  | "app.chat.userInput.title"
  | "app.chat.userInput.submit"
  | "app.chat.userInput.otherHint"
  | "app.chat.userInput.secretHint"
  | "app.chat.userMessage.autoResolveSync"
  | "app.chat.userMessage.commentCount"
  | "app.chat.userMessage.copyAriaLabel"
  | "app.chat.userMessage.copyCopiedAriaLabel"
  | "app.chat.userMessage.copyCopiedTooltip"
  | "app.chat.userMessage.copyTooltip"
  | "app.chat.userMessage.editAriaLabel"
  | "app.chat.userMessage.editTooltip"
  | "app.chat.userMessage.editTextareaAriaLabel"
  | "app.chat.userMessage.editPlaceholder"
  | "app.chat.userMessage.cancelEditMessage"
  | "app.chat.userMessage.sendEditedMessage"
  | "app.chat.userMessage.goal"
  | "app.chat.userMessage.showLess"
  | "app.chat.userMessage.showMore"
  | "app.chat.userMessage.implementPlan"
  | "app.chat.userMessage.noContent"
  | "app.chat.userMessage.pullRequestCheckCount"
  | "app.chat.userMessage.pullRequestFixMode"
  | "app.chat.userMessage.pullRequestMergeTask"
  | "app.chat.userMessage.referencesPriorConversation"
  | "app.chat.userMessage.reviewMode"
  | "app.chat.latestTurnPreview.items"
  | "app.chat.permissions.title"
  | "app.chat.permissions.network"
  | "app.chat.permissions.networkEnabled"
  | "app.chat.permissions.fileSystem"
  | "app.chat.permissions.read"
  | "app.chat.permissions.write"
  | "app.chat.permissions.entries"
  | "app.chat.permissions.strictAutoReview"
  | "app.chat.permissions.grantTurn"
  | "app.chat.permissions.grantSession"
  | "app.chat.permissions.deny"
  | "app.chat.mcpElicitation.title"
  | "app.chat.mcpElicitation.url"
  | "app.chat.mcpElicitation.accept"
  | "app.chat.mcpElicitation.decline"
  | "app.chat.mcpElicitation.cancel"
  | "app.chat.mcpElicitation.submit"
  | "app.chat.mcpElicitation.required"
  | "app.chat.mcpElicitation.booleanEnabled"
  | "app.chat.mcpElicitation.unsupportedField"
  | "composer.reviewMode.title"
  | "composer.reviewMode.option.unstaged.simple"
  | "thinkingShimmer.default"
  | "wham.whamProposedTask.title"
  | "localConversation.planSummary.title"
  | "localConversation.planSummary.titleWriting"
  | "localConversation.planSummary.download"
  | "localConversation.planSummary.copy"
  | "localConversation.planSummary.openInNewWindow"
  | "localConversation.planSummary.expand"
  | "localConversation.planSummary.collapse"
  | "localConversation.planSummary.viewPlan"
  | "avatarOverlay.session.readFile"
  | "avatarOverlay.session.readingFile"
  | "avatarOverlay.session.listedFiles"
  | "avatarOverlay.session.listingFiles"
  | "avatarOverlay.session.searchedFiles"
  | "avatarOverlay.session.searchedQuery"
  | "avatarOverlay.session.searchingFiles"
  | "avatarOverlay.session.searchingQuery"
  | "avatarOverlay.session.searchedWeb"
  | "codex.webSearch.summary"
  | "codex.webSearch.summary.details"
  | "codex.webSearch.summary.verb.completed"
  | "codex.webSearch.summary.verb.inProgress"
  | "avatarOverlay.session.calledToolName"
  | "thread.browser.emptyState.title"
  | "thread.browser.emptyState.description"
  | "codex.remoteConversation.codexCloudTask"
  | "codex.remoteConversation.viewPreviousTurns"
  | "codex.remoteConversation.viewPreviousTurns.buttonTooltip"
  | "codex.remoteConversation.viewPreviousTurns.buttonText"
  | "codex.remoteConversation.openInWeb"
  | "codex.remoteConversation.errorWithMessage"
  | "remoteConversation.environmentSetup.failed"
  | "remoteConversation.environmentSetup.running"
  | "remoteConversation.environmentSetup.output.empty"
  | "codex.remoteConversation.userImageAttachment"
  | "codex.remoteConversation.closeImagePreview"
  | "codex.remoteConversation.loadingImage"
  | "codex.localConversation.userImageAttachment"
  | "codex.localConversation.closeImagePreview"
  | "imagePreviewDialog.label"
  | "imagePreviewDialog.close"
  | "imagePreviewDialog.download"
  | "imagePreviewDialog.zoomIn"
  | "imagePreviewDialog.zoomOut"
  | "imagePreviewDialog.previousImage"
  | "imagePreviewDialog.nextImage"
  | "artifactPdfPreview.annotate"
  | "artifactPdfPreview.annotating"
  | "artifactPdfPreview.commentInput"
  | "artifactPdfPreview.commentMarkerLabel"
  | "markdown.videoPlayer"
  | "markdown.videoUnavailable"
  | "markdown.imagePreviewButton"
  | "markdown.imageUnavailable"
  | "markdown.imageLoading"
  | "codex.remoteConversation.taskFailed"
  | "codex.remoteConversation.turnFailed"
  | "codex.remoteConversation.turnTab.title"
  | "codex.remoteConversation.turnTab.loading"
  | "codex.remoteConversation.applyDiff.apply"
  | "codex.remoteConversation.applyDiff.revert"
  | "codex.remoteConversation.applyDiff.dropdownTitle"
  | "codex.remoteConversation.applyDiff.applyCta"
  | "codex.remoteConversation.applyDiff.revertCta"
  | "codex.applyDropdown.header.title"
  | "codex.applyDropdown.header.changes"
  | "codex.applyDropdown.header.fileCount"
  | "codex.applyDropdown.header.rows"
  | "codex.applyDropdown.header.workspace"
  | "codex.applyDropdown.results.empty"
  | "codex.applyDropdown.results.skipped"
  | "codex.applyDropdown.results.conflicted"
  | "codex.applyOrRevertBanner.apply"
  | "codex.applyOrRevertBanner.reapply"
  | "codex.applyOrRevertBanner.revert"
  | "codex.applyOrRevertBanner.applyMessage"
  | "codex.applyOrRevertBanner.revertMessage"
  | "codex.applyOrRevertBanner.applyMessageDifferentEnvironment"
  | "codex.applyOrRevertBanner.applyMessageDifferentEnvironment.tooltip"
  | "codex.applyResultsDialog.title"
  | "codex.applyResultsDialog.applied"
  | "codex.applyResultsDialog.conflicted"
  | "codex.applyResultsDialog.skipped"
  | "codex.applyResultsDialog.notGitRepo"
  | "codex.applyResultsDialog.noDetails"
  | "codex.applyResultsDialog.close"
  | "codex.diffView.applyPatchNotGitRepo"
  | "codex.diffView.revertPatchNotGitRepo"
  | "codex.diffView.applyPatchSuccess"
  | "codex.diffView.revertPatchSuccess"
  | "codex.diffView.applyPatchPartialSuccess"
  | "codex.diffView.revertPatchPartialSuccess"
  | "codex.diffView.applyPatchError"
  | "codex.diffView.revertPatchError"
  | "localConversation.remoteTaskCreated"
  | "localConversation.remoteTaskCreated.task"
  | "localConversation.dynamicToolCall"
  | "localConversation.appControlToolCall.appHelp.active"
  | "localConversation.appControlToolCall.appHelp.completed"
  | "localConversation.appControlToolCall.threadsCreate.active"
  | "localConversation.appControlToolCall.threadsCreate.completed"
  | "localConversation.appControlToolCall.threadsCreateInWorktree.active"
  | "localConversation.appControlToolCall.threadsCreateInWorktree.completed"
  | "localConversation.appControlToolCall.threadsList.active"
  | "localConversation.appControlToolCall.threadsList.completed"
  | "localConversation.appControlToolCall.threadsRead.active"
  | "localConversation.appControlToolCall.threadsRead.completed"
  | "localConversation.appControlToolCall.threadsSendMessage.active"
  | "localConversation.appControlToolCall.threadsSendMessage.completed"
  | "localConversation.appControlToolCall.threadsSetArchived.active"
  | "localConversation.appControlToolCall.threadsSetArchived.completed"
  | "localConversation.appControlToolCall.threadsSetPinned.active"
  | "localConversation.appControlToolCall.threadsSetPinned.completed"
  | "localConversation.appControlToolCall.threadsSetTitle.active"
  | "localConversation.appControlToolCall.threadsSetTitle.completed"
  | "localConversation.multiAgentAction.header"
  | "localConversation.multiAgentAction.header.count"
  | "localConversation.multiAgentAction.header.close.completed"
  | "localConversation.multiAgentAction.header.close.failed"
  | "localConversation.multiAgentAction.header.close.inProgress"
  | "localConversation.multiAgentAction.header.resume.completed"
  | "localConversation.multiAgentAction.header.resume.failed"
  | "localConversation.multiAgentAction.header.resume.inProgress"
  | "localConversation.multiAgentAction.header.sendInput.completed"
  | "localConversation.multiAgentAction.header.sendInput.failed"
  | "localConversation.multiAgentAction.header.sendInput.inProgress"
  | "localConversation.multiAgentAction.header.spawn.completed"
  | "localConversation.multiAgentAction.header.spawn.failed"
  | "localConversation.multiAgentAction.header.spawn.inProgress"
  | "localConversation.multiAgentAction.row.generic"
  | "localConversation.multiAgentAction.row.agent"
  | "localConversation.multiAgentAction.row.spawn.createdWithInstructions"
  | "localConversation.multiAgentAction.row.sendInput.messagedWithPrompt"
  | "localConversation.multiAgentAction.rowAction.close.completed"
  | "localConversation.multiAgentAction.rowAction.close.failed"
  | "localConversation.multiAgentAction.rowAction.close.inProgress"
  | "localConversation.multiAgentAction.rowAction.resume.completed"
  | "localConversation.multiAgentAction.rowAction.resume.failed"
  | "localConversation.multiAgentAction.rowAction.resume.inProgress"
  | "localConversation.multiAgentAction.rowAction.sendInput.completed"
  | "localConversation.multiAgentAction.rowAction.sendInput.failed"
  | "localConversation.multiAgentAction.rowAction.sendInput.inProgress"
  | "localConversation.multiAgentAction.rowAction.sendInput.messaged.completed"
  | "localConversation.multiAgentAction.rowAction.sendInput.messaged.failed"
  | "localConversation.multiAgentAction.rowAction.sendInput.messaged.inProgress"
  | "localConversation.multiAgentAction.rowAction.spawn.completed"
  | "localConversation.multiAgentAction.rowAction.spawn.failed"
  | "localConversation.multiAgentAction.rowAction.spawn.inProgress"
  | "localConversation.multiAgentAction.meta.prompt"
  | "localConversation.multiAgentAction.agentState.pendingInit"
  | "localConversation.multiAgentAction.agentState.running"
  | "localConversation.multiAgentAction.agentState.interrupted"
  | "localConversation.multiAgentAction.agentState.shutdown"
  | "localConversation.multiAgentAction.agentState.completed"
  | "localConversation.multiAgentAction.agentState.errored"
  | "localConversation.multiAgentAction.agentState.notFound"
  | "localConversation.personalityChanged"
  | "localConversation.autoReviewInterruptionWarning"
  | "localConversation.autoReviewInterruptionWarning.nextSteps"
  | "localConversation.header.heartbeatAutomationNextRun"
  | "localConversation.header.openHeartbeatAutomation"
  | "localConversation.scrollToBottomButton"
  | "composer.latestTurn"
  | "composer.latestTurn.working"
  | "localConversation.automaticApprovalReview.summary.inProgress"
  | "localConversation.automaticApprovalReview.summary.aborted"
  | "localConversation.automaticApprovalReview.summary.timedOut"
  | "localConversation.automaticApprovalReview.summary.completed"
  | "localConversation.automaticApprovalReview.title.inProgress"
  | "localConversation.automaticApprovalReview.title.approved"
  | "localConversation.automaticApprovalReview.title.denied"
  | "localConversation.automaticApprovalReview.title.deniedHighRisk"
  | "localConversation.automaticApprovalReview.title.timedOut"
  | "localConversation.automaticApprovalReview.title.aborted"
  | "localConversation.modelChanged"
  | "localConversation.modelChanged.warning.line1"
  | "localConversation.modelChanged.warning.line2"
  | "localConversation.parentThread"
  | "localConversation.forkedFromConversation"
  | "codex.localConversation.comment.screenshotAttached"
  | "codex.localConversation.pdfComment.annotationAttached"
  | "codex.localConversation.browserComment.selectedElement"
  | "codex.localConversation.diffCommentLeftSide"
  | "codex.localConversation.diffCommentRightSide"
  | "localConversation.modelRerouted"
  | "localConversation.modelRerouted.warning.line1"
  | "localConversation.modelRerouted.warning.line2"
  | "codex.review.noDiff"
  | "codex.review.noDiff.baseDescription"
  | "codex.review.noDiff.orNoLongerAvailable"
  | "codex.review.noDiff.gitRepoRequired.title"
  | "codex.review.noDiff.gitRepoRequired.description"
  | "codex.review.noDiff.gitInit.success"
  | "codex.review.noDiff.gitInit.createRepository"
  | "codex.review.noDiff.gitInit.creating"
  | "codex.review.noDiff.gitInit.error"
  | "codex.review.header.moreOptions"
  | "codex.review.wrap.enable"
  | "codex.review.wrap.disable"
  | "codex.review.expandOrCollapseDiffMenu.collapse"
  | "codex.review.expandOrCollapseDiffMenu.expand"
  | "codex.review.loadFullFiles.enable"
  | "codex.review.loadFullFiles.disable"
  | "codex.review.diff.fullContentLoadFailed"
  | "codex.common.retry"
  | "dictation.error.connection"
  | "dictation.error.microphoneMissing"
  | "dictation.error.microphonePermissionDenied"
  | "dictation.error.microphoneUnavailable"
  | "dictation.error.unsupported"
  | "composer.dictation.startError"
  | "composer.dictation.transcribeError"
  | "globalDictation.dismissError"
  | "globalDictation.listening"
  | "globalDictation.retry"
  | "globalDictation.transcribing"
  | "globalDictation.waveformAriaLabel"
  | "codex.review.richPreview.enable"
  | "codex.review.richPreview.disable"
  | "codex.review.wordDiffs.enable"
  | "codex.review.wordDiffs.disable"
  | "codex.review.whitespace.show"
  | "codex.review.whitespace.hide"
  | "codex.review.copyGitApplyCommand"
  | "codex.review.copyGitApplyCommand.toast"
  | "codex.review.switchToSplit"
  | "codex.review.switchToUnified"
  | "codex.review.refreshGitQueries"
  | "codex.unifiedDiff.reviewChanges"
  | "thread.sidePanel.browserTab"
  | "thread.sidePanel.diffTab"
  | "thread.sidePanel.empty.title"
  | "thread.sidePanel.openFile"
  | "thread.sidePanel.openBrowserTab"
  | "thread.sidePanel.openReviewTab"
  | "thread.sidePanel.openTab"
  | "thread.sidePanel.toggle"
  | "codex.rightPanel.expandFullWidth"
  | "codex.rightPanel.restoreWidth"
  | "codex.tabs.closeNamed"
  | "codex.tabs.contextMenu.close"
  | "thread.fileCommandMenu.filesGroup"
  | "thread.fileCommandMenu.searchFiles"
  | "threadSidePanel.workspaceBrowser.loading"
  | "threadSidePanel.workspaceBrowser.empty"
  | "codex.fileTreeSearch.label"
  | "codex.fileTreeSearch.placeholder"
  | "codex.fileTreeSearch.clear"
  | "codex.review.fileSearch.empty"
  | "thread.fileTreePanel.noMatchingFiles"
  | "thread.fileTreePanel.searchingFiles"
  | "markdown.externalLink.openInBrowser"
  | "markdown.externalLink.openInExternalBrowser"
  | "markdown.externalLink.copyLink"
  | "markdown.fileReference.openInTarget"
  | "markdown.fileReference.viewInCodexBrowser"
  | "markdown.fileReference.viewFile"
  | "markdown.fileReference.openWith"
  | "markdown.fileReference.openWithTarget"
  | "markdown.fileReference.copyPath"
  | "markdown.fileReference.openInFinder"
  | "markdown.fileReference.openInExplorer"
  | "markdown.fileReference.openInFileManager"
  | "mermaidDiagram.fitToWidth"
  | "mermaidDiagram.viewActualSize"
  | "mermaidDiagram.copySource"
  | "mermaidDiagram.ariaLabel"
  | "mermaidDiagram.originalCode"
  | "review.fileSource.breadcrumb.ariaLabel"
  | "review.fileSource.breadcrumb.openInEditor.ariaLabel"
  | "review.fileSource.breadcrumb.openInEditor.tooltip"
  | "review.fileSource.options"
  | "review.fileSource.copyPath"
  | "review.fileSource.error"
  | "review.fileSource.loading"
  | "review.fileSource.tooLarge"
  | "review.fileSource.tooLargeDetail"
  | "review.fileSource.unsupported.archive"
  | "review.fileSource.unsupported.audio"
  | "review.fileSource.unsupported.excelSpreadsheet"
  | "review.fileSource.unsupported.keynoteDeck"
  | "review.fileSource.unsupported.numbersSpreadsheet"
  | "review.fileSource.unsupported.opendocumentPresentation"
  | "review.fileSource.unsupported.opendocumentSpreadsheet"
  | "review.fileSource.unsupported.opendocumentText"
  | "review.fileSource.unsupported.pagesDocument"
  | "review.fileSource.unsupported.powerpointDeck"
  | "review.fileSource.unsupported.richTextDocument"
  | "review.fileSource.unsupported.video"
  | "review.fileSource.unsupported.wordDocument"
  | "review.fileSource.unsupportedDetail"
  | "review.fileSource.richPreview.enable"
  | "review.fileSource.richPreview.disable"
  | "review.fileSource.wrap.enable"
  | "review.fileSource.wrap.disable"
  | "codex.filePreview.pdb.empty"
  | "codex.filePreview.pdb.modelSelectLabel"
  | "codex.filePreview.pdb.modelOption"
  | "codex.filePreview.pdb.resetView"
  | "codex.filePreview.pdb.residueCount"
  | "codex.filePreview.pdb.atomCount"
  | "codex.filePreview.pdb.scoreSummary"
  | "codex.filePreview.pdb.viewerLabel"
  | "codex.filePreview.pdb.viewerLoadError"
  | "codex.filePreview.pdb.legendVeryHigh"
  | "codex.filePreview.pdb.legendConfident"
  | "codex.filePreview.pdb.legendLow"
  | "codex.filePreview.pdb.legendVeryLow"
  | "codex.filePreview.pdb.interactionHint"
  | "codex.filePreview.pdb.chainSelectLabel"
  | "codex.filePreview.pdb.chainLabel"
  | "codex.filePreview.pdb.chainOption"
  | "codex.filePreview.pdb.sequenceResidueCount"
  | "codex.filePreview.pdb.selectedResidues"
  | "codex.filePreview.pdb.sequenceLabel"
  | "codex.filePreview.pdb.residueLabel"
  | "codex.filePreview.pdb.residueTitle"
  | "artifactTab.preview.exitPresentation"
  | "artifactTab.preview.nextPage"
  | "artifactTab.preview.open"
  | "artifactTab.preview.pageIndicator"
  | "artifactTab.preview.previousPage"
  | "artifactTab.preview.zoomPercent"
  | "artifactTab.preview.zoomToFit"
  | "artifactTab.previewError"
  | "artifactTab.previewLoading"
  | "artifactTab.previewTooLarge"
  | "copyButton.copyAriaLabel"
  | "copyButton.copied"
  | "copyButton.copiedAriaLabel"
  | "copyButton.copyCode"
  | "notebookPreview.cellCount"
  | "notebookPreview.codeCellTitle"
  | "notebookPreview.codeDisclosure"
  | "notebookPreview.empty"
  | "notebookPreview.emptyCodeCell"
  | "notebookPreview.emptyMarkdownCell"
  | "notebookPreview.emptyUnknownCell"
  | "notebookPreview.emptyRawCell"
  | "notebookPreview.errorOutput"
  | "notebookPreview.executionCount"
  | "notebookPreview.htmlOutputTitle"
  | "notebookPreview.imageOutputAlt"
  | "notebookPreview.markdownCellTitle"
  | "notebookPreview.rawCellTitle"
  | "notebookPreview.rawCodeTitle"
  | "notebookPreview.rawOutputDisclosure"
  | "notebookPreview.readOnlyBadge"
  | "notebookPreview.restartKernelDisabled"
  | "notebookPreview.restartKernelDisabledTooltip"
  | "notebookPreview.runAllDisabled"
  | "notebookPreview.runAllDisabledTooltip"
  | "notebookPreview.runCellDisabledTooltip"
  | "notebookPreview.cellPosition"
  | "notebookPreview.pythonCodeTitle"
  | "artifactTab.sourceOptions"
  | "artifactTab.sourceOptions.viewSource"
  | "codex.diffView.failedToDecodeBase64Diff"
  | "codex.diffView.filesChanged"
  | "codex.diffView.linesAdded"
  | "codex.diffView.linesDeleted"
  | "codex.diffView.noDiffData"
  | "codex.diffView.richPreviewEnable"
  | "codex.diffView.richPreviewDisable"
  | "codex.diffView.richPreviewToggle"
  | "codex.diffView.switchToSplit"
  | "codex.diffView.switchToUnified"
  | "wham.diff.contextMenu.copyPath"
  | "wham.diff.contextMenu.toggleWrap"
  | "wham.diff.binaryFile"
  | "threadHeader.archiveConfirmCancel"
  | "threadHeader.archiveConfirmConfirm"
  | "threadHeader.archiveConfirmHeartbeatConfirm"
  | "threadHeader.archiveConfirmHeartbeatSubtitleNamed"
  | "threadHeader.archiveConfirmHeartbeatSubtitleUnnamed"
  | "threadHeader.archiveConfirmHeartbeatTitle"
  | "threadHeader.archiveConfirmSubtitle"
  | "threadHeader.archiveConfirmTitle"
  | "threadHeader.addAutomation"
  | "threadHeader.copyAppLink"
  | "threadHeader.copyConversationMarkdown"
  | "threadHeader.copyConversationMarkdownError"
  | "threadHeader.copyConversationMarkdownSuccess"
  | "threadHeader.copySessionId"
  | "threadHeader.copyWorkingDirectory"
  | "threadHeader.copyWorkingDirectoryError"
  | "threadHeader.copyWorkingDirectorySuccess"
  | "threadHeader.editAutomation"
  | "threadHeader.forkIntoLocal"
  | "threadHeader.forkIntoWorktree"
  | "threadHeader.forkPendingWorktreePrompt"
  | "threadHeader.forkPendingWorktreeTitle"
  | "threadHeader.forkThreadRequiresGitRepo"
  | "threadHeader.forkIntoSameWorktree"
  | "threadHeader.forkThreadError"
  | "threadHeader.openSideChat"
  | "threadHeader.openInNewWindow"
  | "threadHeader.openSideChatError"
  | "threadHeader.moreActions"
  | "sidebarElectron.markThreadUnread"
  | "sidebarElectron.pinThread"
  | "sidebarElectron.unpinThread"
  | "localConversation.sideChat.title"
  | "localConversation.sideChat.numberedTitle"
  | "sidebarElectron.archiveThread"
  | "sidebarElectron.renameThread"
  | "sidebarElectron.renameThreadDialogAriaLabel"
  | "sidebarElectron.renameThreadDialogCancel"
  | "sidebarElectron.renameThreadDialogPlaceholder"
  | "sidebarElectron.renameThreadDialogSave"
  | "sidebarElectron.renameThreadDialogSubtitle"
  | "sidebarElectron.renameThreadDialogTitle"
  | "sidebarElectron.renameThreadError"
  | "sidebarElectron.skillsAppsRouteNavLink"
  | "sidebarElectron.skillsRouteNavLink"
  | "sidebarElectron.automationsRouteNavLink"
  | "sidebarElectron.pullRequestsRouteNavLink"
  | "sidebarElectron.pluginsRouteNavLink"
  | "sidebarElectron.pluginsDisabledTooltip"
  | "sidebarElectron.noTasks"
  | "sidebarElectron.scratchpadNavLink"
  | PullRequestsPageMessageKey
  | AutomationsPageMessageKey
  | "inbox.mode.automations"
  | "inbox.automations.createError"
  | "inbox.automations.updateError"
  | "inbox.automations.loading"
  | "inbox.automations.new"
  | "inbox.automations.current"
  | "inbox.automations.sectionsNav"
  | "inbox.automations.pausedSection"
  | "inbox.automations.inProgress"
  | "inbox.automations.header.root"
  | "inbox.automations.details"
  | "inbox.automations.nextRun.label"
  | "inbox.automations.nextRun.none"
  | "inbox.automations.lastRun.label"
  | "inbox.automations.lastRun.none"
  | "inbox.automations.missing"
  | "inbox.automations.missingBack"
  | "inbox.automations.missingSubtitle"
  | "inbox.automations.emptySubtitle.learnMore"
  | "inbox.automations.rowSummary.heartbeat"
  | "inbox.automations.editTooltip"
  | "inbox.automations.moreOptionsTooltip"
  | "inbox.automations.rowActions"
  | "inbox.automations.pauseMenuItem"
  | "inbox.automations.resumeMenuItem"
  | "inbox.automations.deleteMenuItem"
  | "inbox.automations.deleteConfirm.cancel"
  | "inbox.automations.deleteConfirm.confirm"
  | "inbox.automations.deleteConfirm.description"
  | "inbox.automations.deleteConfirm.title"
  | "inbox.automations.deleteError"
  | "inbox.automations.deleteFailedDescription"
  | "inbox.automations.runNowError"
  | "inbox.automations.runNowSuccess"
  | "inbox.automations.relativeDate.pastToday"
  | "inbox.automations.relativeDate.pastWeekday"
  | "inbox.automations.relativeDate.today"
  | "inbox.automations.relativeDate.tomorrow"
  | "inbox.automations.relativeDate.weekday"
  | "inbox.automations.relativeDate.yesterday"
  | "inbox.automations.statusSection"
  | "inbox.automations.status.label"
  | "inbox.automations.status.active"
  | "inbox.automations.status.paused"
  | "inbox.automations.status.deleted"
  | "inbox.automations.executionEnvironment.label"
  | "inbox.automations.host.label"
  | "inbox.automations.folder.label"
  | "inbox.automations.localEnvironment.label"
  | "composer.worktreeEnvironment.title"
  | "composer.worktreeEnvironment.tooltip"
  | "composer.worktreeEnvironment.loading"
  | "composer.worktreeEnvironment.error"
  | "composer.worktreeEnvironment.default"
  | "composer.worktreeEnvironment.create"
  | "codex.environmentSelector.noEnvironment"
  | "codex.environments.noEnvironmentsFound"
  | "inbox.automations.history"
  | "inbox.automations.history.untitled"
  | "inbox.automations.history.archivedTooltip"
  | "inbox.automations.workspaceFallback"
  | "inbox.automations.targetThread.label"
  | "inbox.automations.model.label"
  | "inbox.automations.reasoning.label"
  | "inbox.automations.interval.label"
  | "inbox.automations.repeats.label"
  | "inbox.contextMenu.markRead"
  | "inbox.contextMenu.markUnread"
  | "settings.automations.runNow"
  | "settings.automations.cancel"
  | "settings.automations.create"
  | "settings.automations.save"
  | "settings.automations.saveRetry"
  | "settings.automations.deleteAria"
  | "settings.automations.clear"
  | "settings.automations.dialog.newTitle"
  | "settings.automations.nameLabel"
  | "settings.automations.namePlaceholder"
  | "settings.automations.pauseAria"
  | "settings.automations.promptLabel"
  | "settings.automations.promptPlaceholder"
  | "settings.automations.projectDropdown.projectless"
  | "settings.automations.projectDropdown.placeholder"
  | "settings.automations.projectDropdown.localOnlyTooltip"
  | "settings.automations.resumeAria"
  | "settings.automations.rruleSummaryFallback"
  | "settings.automations.scheduleSummary.daily"
  | "settings.automations.scheduleSummary.weekdays"
  | "settings.automations.scheduleSummary.weekends"
  | "settings.automations.scheduleSummary.weekly"
  | "settings.automations.scheduleSummary.interval"
  | "settings.automations.scheduleSummary.intervalDays"
  | "settings.automations.scheduleSummary.intervalDayCount"
  | "settings.automations.scheduleSummary.intervalMinute"
  | "settings.automations.scheduleSummary.intervalMinutes"
  | "settings.automations.scheduleSummary.intervalHourly"
  | "settings.automations.scheduleSummary.intervalDaily"
  | "settings.automations.scheduleSummary.intervalWeekly"
  | "settings.automations.scheduleSummary.sundaysLabel"
  | "settings.automations.scheduleSummary.mondaysLabel"
  | "settings.automations.scheduleSummary.tuesdaysLabel"
  | "settings.automations.scheduleSummary.wednesdaysLabel"
  | "settings.automations.scheduleSummary.thursdaysLabel"
  | "settings.automations.scheduleSummary.fridaysLabel"
  | "settings.automations.scheduleSummary.saturdaysLabel"
  | "settings.automations.cwdPlaceholder"
  | "settings.automations.heartbeatThread.placeholder"
  | "settings.automations.executionEnvironment.ariaLabel"
  | "settings.automations.executionEnvironment.local"
  | "settings.automations.executionEnvironment.worktree"
  | "scratchpadPage.headerTitle"
  | "scratchpadPage.headerSubtitle"
  | "scratchpadPage.clearButton"
  | "scratchpadPage.createError"
  | "scratchpadPage.inputPlaceholder.initial"
  | "scratchpadPage.inputPlaceholder.followUp"
  | "scratchpadPage.inputPlaceholder.followUpHint"
  | "scratchpadPage.summaryLoading"
  | "codex.localTaskRow.awaitingApproval"
  | "codex.localTaskRow.awaitingResponse"
  | "general.title"
  | "general.theme"
  | "general.themeDescription"
  | "general.themeLight"
  | "general.themeDark"
  | "general.themeSystem"
  | "general.languageDescription"
  | "general.usePointerCursors"
  | "general.usePointerCursorsDescription"
  | "general.uiFontSize"
  | "general.uiFontSizeDescription"
  | "general.codeFontSize"
  | "general.codeFontSizeDescription"
  | "general.enterBehavior"
  | "general.enterBehaviorDescription"
  | "general.followUpBehavior"
  | "general.followUpBehaviorDescription"
  | "general.followUpQueue"
  | "general.followUpSteer"
  | "general.reviewDelivery"
  | "general.reviewDeliveryDescription"
  | "general.reviewInline"
  | "general.reviewDetached"
  | "general.saving"
  | "general.language"
  | "general.languageAuto"
  | "general.languageEnglish"
  | "general.languageChineseSimplified"
  | "settings.general"
  | "settings.nav.general-settings"
  | "settings.nav.appearance"
  | "settings.nav.agent"
  | "settings.nav.plugins-settings"
  | "settings.nav.browser-use"
  | "settings.nav.computer-use"
  | "settings.nav.usage"
  | "settings.nav.data-controls"
  | "settings.nav.keyboard-shortcuts"
  | "settings.nav.git-settings"
  | "settings.nav.worktrees"
  | "settings.nav.personalization"
  | "settings.nav.mcp-settings"
  | "settings.nav.local-environments"
  | "settings.section.general-settings"
  | "settings.section.appearance"
  | "settings.section.agent"
  | "settings.section.personalization"
  | "settings.section.usage"
  | "settings.section.local-environments"
  | "computerUse.label"
  | "settings.section.data-controls"
  | "settings.section.keyboard-shortcuts"
  | "settings.section.git-settings"
  | "settings.section.worktrees"
  | "settings.section.plugins-settings"
  | "settings.section.browser-use"
  | "settings.section.mcp-settings"
  | "settings.section.mcp-settings.subtitle"
  | "settings.browserUse.title"
  | "settings.browserUse.subtitle"
  | "settings.browserUse.control.title"
  | "settings.browserUse.control.description"
  | "settings.browserUse.install.title"
  | "settings.browserUse.install.button"
  | "settings.browserUse.install.empty"
  | "settings.browserUse.permissions.title"
  | "settings.browserUse.browser.title"
  | "settings.browserUse.browser.clearBrowsingData.label"
  | "settings.browserUse.browser.clearBrowsingData.description"
  | "settings.browserUse.browser.clearBrowsingData"
  | "settings.browserUse.browser.hideClearOptions"
  | "settings.browserUse.browser.showClearOptions"
  | "settings.browserUse.browser.cookies.label"
  | "settings.browserUse.browser.siteData.label"
  | "settings.browserUse.browser.cache.label"
  | "settings.browserUse.browser.clearCookies"
  | "settings.browserUse.browser.clearSiteData"
  | "settings.browserUse.browser.clearCache"
  | "settings.browserUse.browser.browsingDataCleared"
  | "settings.browserUse.browser.cookiesCleared"
  | "settings.browserUse.browser.siteDataCleared"
  | "settings.browserUse.browser.cacheCleared"
  | "settings.browserUse.browser.clearBrowsingDataError"
  | "settings.browserUse.browser.clearCookiesError"
  | "settings.browserUse.browser.clearSiteDataError"
  | "settings.browserUse.browser.clearCacheError"
  | "settings.browserUse.browser.annotationScreenshots.label"
  | "settings.browserUse.browser.annotationScreenshots.description"
  | "settings.browserUse.browser.annotationScreenshots.always.label"
  | "settings.browserUse.browser.annotationScreenshots.necessary.label"
  | "settings.browserUse.browser.annotationScreenshots.saveError"
  | "settings.browserUse.approval.label"
  | "settings.browserUse.approval.description"
  | "settings.browserUse.approval.alwaysAsk.label"
  | "settings.browserUse.approval.alwaysAsk.description"
  | "settings.browserUse.approval.neverAsk.label"
  | "settings.browserUse.approval.neverAsk.description"
  | "settings.browserUse.approval.neverAsk.elevatedRiskDisclaimer"
  | "settings.browserUse.approval.saveError"
  | "settings.browserUse.historyApproval.label"
  | "settings.browserUse.historyApproval.description"
  | "settings.browserUse.historyApproval.alwaysAsk.label"
  | "settings.browserUse.historyApproval.alwaysAsk.description"
  | "settings.browserUse.historyApproval.neverAsk.label"
  | "settings.browserUse.historyApproval.neverAsk.description"
  | "settings.browserUse.historyApproval.saveError"
  | "settings.browserUse.downloadApproval.label"
  | "settings.browserUse.downloadApproval.description"
  | "settings.browserUse.downloadApproval.alwaysAsk.description"
  | "settings.browserUse.downloadApproval.neverAsk.description"
  | "settings.browserUse.downloadApproval.saveError"
  | "settings.browserUse.uploadApproval.label"
  | "settings.browserUse.uploadApproval.description"
  | "settings.browserUse.uploadApproval.alwaysAsk.description"
  | "settings.browserUse.uploadApproval.neverAsk.description"
  | "settings.browserUse.uploadApproval.saveError"
  | "settings.browserUse.allowedDomains.title"
  | "settings.browserUse.allowedDomains.subtitle"
  | "settings.browserUse.allowedDomains.emptyTitle"
  | "settings.browserUse.allowedDomains.added"
  | "settings.browserUse.allowedDomains.addDialogTitle"
  | "settings.browserUse.allowedDomains.addDialogSubtitle"
  | "settings.browserUse.blockedDomains.title"
  | "settings.browserUse.blockedDomains.subtitle"
  | "settings.browserUse.blockedDomains.emptyTitle"
  | "settings.browserUse.blockedDomains.added"
  | "settings.browserUse.blockedDomains.addDialogTitle"
  | "settings.browserUse.blockedDomains.addDialogSubtitle"
  | "settings.browserUse.blockedDomains.chromeSubtitle"
  | "settings.browserUse.allowedDownloadDomains.title"
  | "settings.browserUse.allowedDownloadDomains.subtitle"
  | "settings.browserUse.allowedDownloadDomains.emptyTitle"
  | "settings.browserUse.allowedDownloadDomains.added"
  | "settings.browserUse.allowedDownloadDomains.removed"
  | "settings.browserUse.allowedDownloadDomains.addDialogTitle"
  | "settings.browserUse.allowedDownloadDomains.addDialogSubtitle"
  | "settings.browserUse.allowedDownloadDomains.removeDialogTitle"
  | "settings.browserUse.allowedDownloadDomains.removeDialogSubtitle"
  | "settings.browserUse.blockedDownloadDomains.title"
  | "settings.browserUse.blockedDownloadDomains.subtitle"
  | "settings.browserUse.blockedDownloadDomains.emptyTitle"
  | "settings.browserUse.blockedDownloadDomains.added"
  | "settings.browserUse.blockedDownloadDomains.removed"
  | "settings.browserUse.blockedDownloadDomains.addDialogTitle"
  | "settings.browserUse.blockedDownloadDomains.addDialogSubtitle"
  | "settings.browserUse.blockedDownloadDomains.removeDialogTitle"
  | "settings.browserUse.blockedDownloadDomains.removeDialogSubtitle"
  | "settings.browserUse.allowedUploadDomains.title"
  | "settings.browserUse.allowedUploadDomains.subtitle"
  | "settings.browserUse.allowedUploadDomains.emptyTitle"
  | "settings.browserUse.allowedUploadDomains.added"
  | "settings.browserUse.allowedUploadDomains.removed"
  | "settings.browserUse.allowedUploadDomains.addDialogTitle"
  | "settings.browserUse.allowedUploadDomains.addDialogSubtitle"
  | "settings.browserUse.allowedUploadDomains.removeDialogTitle"
  | "settings.browserUse.allowedUploadDomains.removeDialogSubtitle"
  | "settings.browserUse.blockedUploadDomains.title"
  | "settings.browserUse.blockedUploadDomains.subtitle"
  | "settings.browserUse.blockedUploadDomains.emptyTitle"
  | "settings.browserUse.blockedUploadDomains.added"
  | "settings.browserUse.blockedUploadDomains.removed"
  | "settings.browserUse.blockedUploadDomains.addDialogTitle"
  | "settings.browserUse.blockedUploadDomains.addDialogSubtitle"
  | "settings.browserUse.blockedUploadDomains.removeDialogTitle"
  | "settings.browserUse.blockedUploadDomains.removeDialogSubtitle"
  | "settings.browserUse.domains.add"
  | "settings.browserUse.domains.addDialogAriaLabel"
  | "settings.browserUse.domains.addDialogPlaceholder"
  | "settings.browserUse.domains.addDialogCancel"
  | "settings.browserUse.domains.addDialogConfirm"
  | "settings.browserUse.domains.addError"
  | "settings.browserUse.origins.loading"
  | "settings.browserUse.origins.saveError"
  | "settings.browserUse.origins.removeAriaLabel"
  | "settings.browserUse.origins.removeDialogCancel"
  | "settings.browserUse.origins.removeDialogConfirm"
  | "settings.browserUse.allowedWebsites.saved"
  | "settings.browserUse.allowedWebsites.removeDialogTitle"
  | "settings.browserUse.allowedWebsites.removeDialogSubtitle"
  | "settings.browserUse.deniedWebsites.saved"
  | "settings.browserUse.deniedWebsites.removeDialogTitle"
  | "settings.browserUse.deniedWebsites.removeDialogSubtitle"
  | "settings.computerUse.install.title"
  | "settings.computerUse.install.button"
  | "settings.computerUse.install.empty"
  | "settings.computerUse.subtitle"
  | "settings.computerUse.sounds.foregroundClicks"
  | "settings.computerUse.sounds.foregroundAndBackgroundClicks"
  | "settings.computerUse.sounds.off"
  | "settings.computerUse.anyApp.title"
  | "settings.computerUse.anyApp.description"
  | "settings.computerUse.chrome.pluginTitle"
  | "settings.computerUse.chrome.pluginDescription"
  | "settings.computerUse.chrome.pluginConnectedDescription"
  | "settings.computerUse.chrome.pluginDisconnectedDescription"
  | "settings.computerUse.chrome.manage"
  | "settings.computerUse.chrome.title"
  | "settings.computerUse.chrome.reinstallExtension"
  | "settings.computerUse.chrome.openExtensionSettingsError"
  | "settings.computerUse.chrome.removeExtension"
  | "settings.computerUse.chrome.permissions.title"
  | "settings.computerUse.chrome.connected"
  | "settings.computerUse.chrome.notConnected"
  | "settings.computerUse.chrome.back"
  | "settings.computerUse.breadcrumb.computerUse"
  | "settings.computerUse.chrome.breadcrumb.googleChrome"
  | "settings.computerUse.allowedApps.title"
  | "settings.computerUse.allowedApps.loading"
  | "settings.computerUse.allowedApps.loadError"
  | "settings.computerUse.allowedApps.emptyTitle"
  | "settings.computerUse.allowedApps.removeAriaLabel"
  | "settings.computerUse.allowedApps.removeDialogTitle"
  | "settings.computerUse.allowedApps.removeDialogSubtitle"
  | "settings.computerUse.allowedApps.removeDialogCancel"
  | "settings.computerUse.allowedApps.removeDialogConfirm"
  | "settings.computerUse.allowedApps.saved"
  | "settings.computerUse.allowedApps.saveError"
  | "settings.pluginControls.disableToggleTooltip"
  | "settings.pluginControls.enableToggleTooltip"
  | "settings.pluginControls.toggleAria"
  | "settings.pluginControls.installTooltip"
  | "plugins.installModal.about"
  | "plugins.installModal.capabilities"
  | "plugins.installModal.developedBy"
  | "plugins.installModal.includes"
  | "plugins.installModal.includes.apps"
  | "plugins.installModal.includes.skills"
  | "plugins.installModal.includes.mcpServers"
  | "plugins.installModal.install"
  | "plugins.installModal.installing"
  | "plugins.installModal.metadata.category"
  | "plugins.installModal.title"
  | "plugins.installModal.finishSetup.title"
  | "plugins.installModal.finishSetup.description"
  | "plugins.installModal.requiredApps"
  | "plugins.installModal.requiredApps.connected"
  | "plugins.installModal.requiredApps.connecting"
  | "plugins.installModal.requiredApps.connect"
  | "plugins.installModal.browserExtensions"
  | "plugins.installModal.browserExtension.description"
  | "plugins.installModal.done"
  | "plugins.install.ready"
  | "plugins.install.success"
  | "plugins.install.error"
  | "plugins.install.refreshError"
  | "codexMobile.homeBanner.title"
  | "codexMobile.homeBanner.body"
  | "codexMobile.homeBanner.primary"
  | "codexMobile.homeBanner.dismiss"
  | "codexMobile.setupDialog.close"
  | "codexMobile.setupDialog.initial.title"
  | "codexMobile.setupDialog.initial.heading"
  | "codexMobile.setupDialog.initial.description"
  | "codexMobile.setupDialog.initial.feature.threads"
  | "codexMobile.setupDialog.initial.feature.notifications"
  | "codexMobile.setupDialog.initial.feature.actions"
  | "codexMobile.setupDialog.initial.skip"
  | "codexMobile.setupDialog.initial.primary"
  | "codexMobile.setupDialog.initial.startSetupError"
  | "codexMobile.setupDialog.allowHost.title"
  | "codexMobile.setupDialog.allowHost.heading"
  | "codexMobile.setupDialog.allowHost.description"
  | "codexMobile.setupDialog.allowHost.primary"
  | "codexMobile.setupDialog.mfaRequired.title"
  | "codexMobile.setupDialog.mfaRequired.heading"
  | "codexMobile.setupDialog.mfaRequired.description"
  | "codexMobile.setupDialog.mfaRequired.primary"
  | "codexMobile.setupDialog.waiting.title"
  | "codexMobile.setupDialog.waiting.heading"
  | "codexMobile.setupDialog.waiting.description"
  | "codexMobile.setupDialog.connected.title"
  | "codexMobile.setupDialog.connected.heading"
  | "codexMobile.setupDialog.connected.description"
  | "codexMobile.setupDialog.connected.keepAwake.title"
  | "codexMobile.setupDialog.connected.keepAwake.description"
  | "codexMobile.setupDialog.connected.keepAwake.toggle"
  | "codexMobile.setupDialog.connected.computerUse.title"
  | "codexMobile.setupDialog.connected.computerUse.description"
  | "codexMobile.setupDialog.connected.computerUse.toggle"
  | "codexMobile.setupDialog.connected.chromeExtension.title"
  | "codexMobile.setupDialog.connected.chromeExtension.description"
  | "codexMobile.setupDialog.connected.finish"
  | "settings.localEnvironments.workspaceSelect.description"
  | "settings.localEnvironments.workspaceSelect.title"
  | "settings.localEnvironments.workspaceSelect.learnMore"
  | "settings.localEnvironments.workspaceSelect.loading"
  | "settings.localEnvironments.workspaceSelect.empty"
  | "settings.localEnvironments.workspaceSelect.listLabel"
  | "settings.localEnvironments.workspaceSelect.addLabel"
  | "settings.localEnvironments.workspaceSelect.loadingLabel"
  | "settings.localEnvironments.workspaceSelect.errorLabel"
  | "settings.localEnvironments.workspaceSelect.inherited"
  | "settings.localEnvironments.workspaceSelect.viewAction"
  | "settings.localEnvironments.workspace.add"
  | "settings.localEnvironments.workspace.title"
  | "settings.localEnvironments.breadcrumb.back"
  | "settings.localEnvironments.breadcrumb.root"
  | "settings.localEnvironments.breadcrumb.edit"
  | "settings.localEnvironments.editor.title"
  | "settings.localEnvironments.editor.setup.description"
  | "settings.localEnvironments.environment.create"
  | "settings.localEnvironments.environment.edit"
  | "settings.localEnvironments.environment.defaultName"
  | "settings.localEnvironments.environment.empty"
  | "settings.localEnvironments.environment.title"
  | "settings.localEnvironments.environment.name"
  | "settings.localEnvironments.environment.setup"
  | "settings.localEnvironments.environment.setup.description"
  | "settings.localEnvironments.environment.setup.platformSelector"
  | "settings.localEnvironments.environment.setup.platformOverrides"
  | "settings.localEnvironments.environment.setup.platformOverrides.description"
  | "settings.localEnvironments.environment.setup.envVars.button"
  | "settings.localEnvironments.environment.setup.envVars.title"
  | "settings.localEnvironments.environment.setup.envVars.sourcePath.description"
  | "settings.localEnvironments.environment.setup.envVars.worktreePath.description"
  | "settings.localEnvironments.environment.cleanup.title"
  | "settings.localEnvironments.environment.cleanup.description"
  | "settings.localEnvironments.environment.cleanup.summaryTitle"
  | "settings.localEnvironments.environment.cleanup.summaryDescription"
  | "settings.localEnvironments.environment.cleanup.empty"
  | "settings.localEnvironments.environment.cleanup.platformSelector"
  | "settings.localEnvironments.environment.cleanup.platformOverrides"
  | "settings.localEnvironments.environment.cleanup.platformOverrides.description"
  | "settings.localEnvironments.environment.actions.description"
  | "settings.localEnvironments.environment.actionsLabel"
  | "settings.localEnvironments.environment.script.default"
  | "settings.localEnvironments.actions.title"
  | "settings.localEnvironments.actions.add"
  | "settings.localEnvironments.actions.empty"
  | "settings.localEnvironments.actions.item.name"
  | "settings.localEnvironments.actions.item.command"
  | "settings.localEnvironments.actions.item.button.delete"
  | "settings.localEnvironments.actions.item.tooltip.delete"
  | "settings.localEnvironments.actions.item.platforms"
  | "settings.localEnvironments.actions.item.platforms.selector"
  | "settings.localEnvironments.actions.item.platforms.specific"
  | "settings.localEnvironments.actions.item.platforms.help"
  | "settings.localEnvironments.actions.item.platforms.macos"
  | "settings.localEnvironments.actions.item.platforms.linux"
  | "settings.localEnvironments.actions.item.platforms.windows"
  | "settings.localEnvironments.actions.icon.tool"
  | "settings.localEnvironments.actions.icon.run"
  | "settings.localEnvironments.actions.icon.debug"
  | "settings.localEnvironments.actions.icon.test"
  | "settings.localEnvironments.preview.save"
  | "settings.localEnvironments.preview.saveError"
  | "settings.localEnvironments.save.success"
  | "settings.localEnvironments.save.disabled.name"
  | "settings.localEnvironments.save.disabled.noChanges"
  | "settings.localEnvironments.save.disabled.saving"
  | "settings.localEnvironments.file.parseError"
  | "settings.localEnvironments.file.readError"
  | "settings.localEnvironments.loading.title"
  | "settings.localEnvironments.loading.body"
  | "settings.localEnvironments.unavailable.title"
  | "settings.localEnvironments.unavailable.body"
  | "settings.localEnvironments.remoteProjectDialog.title"
  | "settings.localEnvironments.remoteProjectDialog.description"
  | "settings.localEnvironments.remoteProjectDialog.emptyDescription"
  | "settings.localEnvironments.remoteProjectDialog.hostLabel"
  | "settings.localEnvironments.remoteProjectDialog.pathLabel"
  | "settings.localEnvironments.remoteProjectDialog.note"
  | "settings.localEnvironments.remoteProjectDialog.cancel"
  | "settings.localEnvironments.remoteProjectDialog.confirm"
  | "settings.localEnvironments.remoteProjectDialog.saveError"
  | "settings.keyboardShortcuts.subtitle.electron"
  | "settings.keyboardShortcuts.loading"
  | "settings.keyboardShortcuts.search.ariaLabel"
  | "settings.keyboardShortcuts.search.placeholder"
  | "settings.keyboardShortcuts.table.command"
  | "settings.keyboardShortcuts.table.keybinding"
  | "settings.keyboardShortcuts.table.actions"
  | "settings.keyboardShortcuts.noMatches"
  | "settings.keyboardShortcuts.unassigned"
  | "settings.keyboardShortcuts.capturePrompt"
  | "settings.keyboardShortcuts.captureCancel"
  | "settings.keyboardShortcuts.captureAriaLabel"
  | "settings.keyboardShortcuts.captureConflict"
  | "settings.keyboardShortcuts.setAriaLabel"
  | "settings.keyboardShortcuts.changeAriaLabel"
  | "settings.keyboardShortcuts.createAriaLabel"
  | "settings.keyboardShortcuts.clearAriaLabel"
  | "settings.keyboardShortcuts.resetAriaLabel"
  | "settings.keyboardShortcuts.updateError"
  | "settings.git.branchPrefix.label"
  | "settings.git.branchPrefix.description"
  | "settings.git.branchPrefix.placeholder"
  | "settings.git.branchPrefix.ariaLabel"
  | "settings.git.branchPrefix.save.success"
  | "settings.git.branchPrefix.save.error"
  | "settings.git.forcePush.label"
  | "settings.git.forcePush.description"
  | "settings.git.forcePush.ariaLabel"
  | "settings.git.forcePush.save.enabled"
  | "settings.git.forcePush.save.disabled"
  | "settings.git.forcePush.save.error"
  | "settings.git.createDraftPullRequest.label"
  | "settings.git.createDraftPullRequest.description"
  | "settings.git.createDraftPullRequest.ariaLabel"
  | "settings.git.createDraftPullRequest.save.enabled"
  | "settings.git.createDraftPullRequest.save.disabled"
  | "settings.git.createDraftPullRequest.save.error"
  | "settings.git.pullRequestMergeMethod.label"
  | "settings.git.pullRequestMergeMethod.description"
  | "settings.git.pullRequestMergeMethod.ariaLabel"
  | "settings.git.pullRequestMergeMethod.merge"
  | "settings.git.pullRequestMergeMethod.squash"
  | "settings.git.pullRequestMergeMethod.save.success"
  | "settings.git.pullRequestMergeMethod.save.error"
  | "settings.git.showSidebarPrIcons.label"
  | "settings.git.showSidebarPrIcons.description"
  | "settings.git.showSidebarPrIcons.ariaLabel"
  | "settings.git.showSidebarPrIcons.save.enabled"
  | "settings.git.showSidebarPrIcons.save.disabled"
  | "settings.git.showSidebarPrIcons.save.error"
  | "settings.git.commitInstructions.label"
  | "settings.git.commitInstructions.description"
  | "settings.git.commitInstructions.save"
  | "settings.git.commitInstructions.placeholder"
  | "settings.git.commitInstructions.ariaLabel"
  | "settings.git.commitInstructions.save.success"
  | "settings.git.commitInstructions.save.error"
  | "settings.git.prInstructions.label"
  | "settings.git.prInstructions.description"
  | "settings.git.prInstructions.save"
  | "settings.git.prInstructions.placeholder"
  | "settings.git.prInstructions.ariaLabel"
  | "settings.git.prInstructions.save.success"
  | "settings.git.prInstructions.save.error"
  | "settings.worktrees.autoCleanup.label"
  | "settings.worktrees.autoCleanup.description"
  | "settings.worktrees.autoCleanup.ariaLabel"
  | "settings.worktrees.autoCleanup.save.enabled"
  | "settings.worktrees.autoCleanup.save.disabled"
  | "settings.worktrees.autoCleanup.save.error"
  | "settings.worktrees.keepCount.label"
  | "settings.worktrees.keepCount.description"
  | "settings.worktrees.keepCount.description.disabled"
  | "settings.worktrees.keepCount.ariaLabel"
  | "settings.worktrees.keepCount.save.success"
  | "settings.worktrees.keepCount.save.error"
  | "settings.worktrees.autoCleanup.confirm.title"
  | "settings.worktrees.autoCleanup.confirm.body"
  | "settings.worktrees.autoCleanup.confirm.cancel"
  | "settings.worktrees.autoCleanup.confirm.confirm"
  | "settings.worktrees.refresh"
  | "settings.worktrees.loading.title"
  | "settings.worktrees.loading.body"
  | "settings.worktrees.error.title"
  | "settings.worktrees.error.body"
  | "settings.worktrees.empty.title"
  | "settings.worktrees.empty.body"
  | "settings.worktrees.repository.unknown"
  | "settings.worktrees.repository.loading"
  | "settings.worktrees.row.title"
  | "settings.worktrees.row.delete"
  | "settings.worktrees.row.conversations"
  | "settings.worktrees.row.conversations.loading"
  | "settings.worktrees.row.conversations.empty"
  | "settings.worktrees.conversation.untitled"
  | "settings.worktrees.delete.error"
  | "settings.dataControls.archivedChats.dateTime"
  | "settings.dataControls.archivedChats.dateTimeWithRepo"
  | "settings.dataControls.archivedChats.empty"
  | "settings.dataControls.archivedChats.error"
  | "settings.dataControls.archivedChats.loading"
  | "settings.dataControls.archivedChats.unarchive"
  | "settings.dataControls.archivedChats.unarchiveError"
  | "settings.dataControls.archivedChats.unarchiveSuccessPlain"
  | "settings.dataControls.archivedChats.untitled"
  | "settings.dataControls.archivedChats.viewNow"
  | "settings.usage.access.loading"
  | "settings.usage.load.loading"
  | "settings.usage.load.error"
  | "settings.usage.load.retry"
  | "settings.usage.credit.title"
  | "settings.usage.credit.remaining.description"
  | "settings.usage.credit.purchase"
  | "settings.usage.credit.remaining.unavailable"
  | "settings.usage.credit.remaining.unlimited"
  | "settings.usage.credit.remaining.value"
  | "settings.usage.autoTopUp.title"
  | "settings.usage.autoTopUp.description"
  | "settings.usage.autoTopUp.settings"
  | "settings.usage.autoTopUp.status.active"
  | "settings.usage.autoTopUp.managePayment.error"
  | "settings.usage.autoTopUp.managePayment.action"
  | "settings.usage.autoTopUp.purchaseCredit.action"
  | "settings.usage.autoTopUp.dialog.title"
  | "settings.usage.autoTopUp.dialog.description"
  | "settings.usage.autoTopUp.threshold.label"
  | "settings.usage.autoTopUp.threshold.helper"
  | "settings.usage.autoTopUp.threshold.ariaLabel"
  | "settings.usage.autoTopUp.threshold.error.missing"
  | "settings.usage.autoTopUp.threshold.error.wholeNumber"
  | "settings.usage.autoTopUp.threshold.error.minimum"
  | "settings.usage.autoTopUp.target.label"
  | "settings.usage.autoTopUp.target.helper"
  | "settings.usage.autoTopUp.target.ariaLabel"
  | "settings.usage.autoTopUp.target.equivalent"
  | "settings.usage.autoTopUp.target.equivalent.loading"
  | "settings.usage.autoTopUp.target.error.missing"
  | "settings.usage.autoTopUp.target.error.wholeNumber"
  | "settings.usage.autoTopUp.target.error.minimumDifference"
  | "settings.usage.autoTopUp.disable"
  | "settings.usage.autoTopUp.cancel"
  | "settings.usage.autoTopUp.save"
  | "settings.usage.autoTopUp.enable"
  | "settings.usage.autoTopUp.immediateTopUpNotice.enable"
  | "settings.usage.autoTopUp.immediateTopUpNotice.update"
  | "settings.usage.autoTopUp.immediateTopUpFailure.generic"
  | "settings.usage.autoTopUp.immediateTopUpFailure.amount"
  | "settings.usage.autoTopUp.enable.success"
  | "settings.usage.autoTopUp.enable.error"
  | "settings.usage.autoTopUp.update.success"
  | "settings.usage.autoTopUp.update.error"
  | "settings.usage.autoTopUp.disable.success"
  | "settings.usage.autoTopUp.disable.error"
  | "settings.usage.autoTopUp.save.error"
  | "settings.usage.limits.title"
  | "settings.usage.limits.spark.title"
  | "settings.usage.limits.fiveHour.label"
  | "settings.usage.limits.weekly.label"
  | "settings.usage.limits.window.resetAt"
  | "settings.usage.limits.progress.ariaLabel"
  | "settings.usage.limits.progress.remaining"
  | "settings.general.enterBehavior.label"
  | "settings.general.enterBehavior.description"
  | "settings.general.followUpQueueMode.label"
  | "settings.general.followUpQueueMode.description"
  | "settings.general.followUpQueueMode.queue"
  | "settings.general.followUpQueueMode.interrupt"
  | "settings.general.reviewDelivery.label"
  | "settings.general.reviewDelivery.description"
  | "settings.general.reviewDelivery.inline"
  | "settings.general.reviewDelivery.detached"
  | "settings.agent.speed.label"
  | "settings.agent.speed.description"
  | "settings.agent.speed.option.fast"
  | "settings.agent.speed.option.fast.description"
  | "settings.agent.speed.option.standard"
  | "settings.agent.speed.option.standard.description"
  | "settings.agent.permissionsMode.groupTitle"
  | "settings.agent.permissionsMode.default.title"
  | "settings.agent.permissionsMode.default.description"
  | "settings.agent.permissionsMode.default.toggle"
  | "settings.agent.permissionsMode.autoReview.title"
  | "settings.agent.permissionsMode.autoReview.description"
  | "settings.agent.permissionsMode.autoReview.toggle"
  | "settings.agent.permissionsMode.fullAccess.title"
  | "settings.agent.permissionsMode.fullAccess.description"
  | "settings.agent.permissionsMode.fullAccess.toggle"
  | "settings.workMode.groupTitle"
  | "settings.workMode.groupDescription"
  | "settings.workMode.radioGroup"
  | "settings.workMode.coding.title"
  | "settings.workMode.coding.description"
  | "settings.workMode.everyday.title"
  | "settings.workMode.everyday.description"
  | "settings.agent.ambientSuggestions.groupTitle"
  | "settings.agent.ambientSuggestions.rowLabel"
  | "settings.agent.ambientSuggestions.toggleLabel"
  | "settings.general.groupTitle"
  | "settings.general.notifications"
  | "settings.general.dictation"
  | "settings.general.globalDictationHotkey.label"
  | "settings.general.globalDictationHotkey.description"
  | "settings.general.globalDictationHotkey.errorGeneric"
  | "settings.general.globalDictationHotkey.off"
  | "settings.general.globalDictationHotkey.set"
  | "settings.general.globalDictationHotkey.change"
  | "settings.general.globalDictationHotkey.clear"
  | "settings.general.globalDictationHotkey.cancel"
  | "settings.general.globalDictationHotkey.capturePrompt"
  | "settings.general.globalDictationHotkey.captureAriaLabel"
  | "settings.general.globalDictationToggleHotkey.label"
  | "settings.general.globalDictationToggleHotkey.description"
  | "settings.general.globalDictationToggleHotkey.errorGeneric"
  | "settings.general.globalDictationToggleHotkey.captureAriaLabel"
  | "settings.general.globalDictationToggleHotkey.set"
  | "settings.general.globalDictationToggleHotkey.change"
  | "settings.general.globalDictationToggleHotkey.clear"
  | "settings.general.globalDictationHistory.emptyTitle"
  | "settings.general.globalDictationHistory.emptyDescription"
  | "settings.general.globalDictationHistory.copy"
  | "settings.general.dictationDictionary.label"
  | "settings.general.dictationDictionary.description"
  | "settings.general.dictationDictionary.entryLabel"
  | "settings.general.dictationDictionary.addEntry"
  | "settings.general.dictationDictionary.removeEntry"
  | "settings.general.gpuTearingDebug"
  | "settings.general.gpuTearingDebug.subtitle"
  | "settings.general.gpuTearingDebug.toggle"
  | "settings.general.gpuTearingDebug.disableScrollFadeMask.label"
  | "settings.general.gpuTearingDebug.disableScrollFadeMask.description"
  | "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.label"
  | "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.description"
  | "settings.general.gpuTearingDebug.disableBackdropBlur.label"
  | "settings.general.gpuTearingDebug.disableBackdropBlur.description"
  | "settings.general.gpuTearingDebug.disableCssMotion.label"
  | "settings.general.gpuTearingDebug.disableCssMotion.description"
  | "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.label"
  | "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.description"
  | "notifications.turnMode.label"
  | "notifications.turnMode.description"
  | "notifications.turnMode.off"
  | "notifications.turnMode.unfocused"
  | "notifications.turnMode.always"
  | "notifications.permissions.label"
  | "notifications.permissions.description"
  | "notifications.questions.label"
  | "notifications.questions.description"
  | "settings.general.experimentalFeatures"
  | "settings.general.experimentalFeatures.restartNote"
  | "settings.general.experimentalFeatures.loading"
  | "settings.general.experimentalFeatures.empty"
  | "settings.general.experimentalFeatures.toggle"
  | "settings.general.experimentalFeatures.plugins.label"
  | "settings.general.experimentalFeatures.plugins.description"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.label"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.description"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.off"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.capturePrompt"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.captureAriaLabel"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.cancel"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.set"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.change"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.clear"
  | "settings.general.experimentalFeatures.hotkeyWindowHotkey.errorGeneric"
  | "settings.agent.dependencies.sectionTitle"
  | "settings.agent.dependencies.bundleVersion.label"
  | "settings.agent.dependencies.bundleVersion.loading"
  | "settings.agent.dependencies.bundleVersion.notInstalled"
  | "settings.agent.dependencies.bundleVersion.problemDescription"
  | "settings.agent.dependencies.enabled.label"
  | "settings.agent.dependencies.enabled.description"
  | "settings.agent.dependencies.enabled.ariaLabel"
  | "settings.agent.dependencies.diagnose.label"
  | "settings.agent.dependencies.diagnose.description"
  | "settings.agent.dependencies.diagnose.button"
  | "settings.agent.dependencies.diagnose.ok"
  | "settings.agent.dependencies.diagnose.problem"
  | "settings.agent.dependencies.diagnose.failed"
  | "settings.agent.dependencies.reset.label"
  | "settings.agent.dependencies.reset.description"
  | "settings.agent.dependencies.reset.button"
  | "settings.agent.dependencies.reset.installed"
  | "settings.agent.dependencies.reset.canceled"
  | "settings.agent.dependencies.reset.failed"
  | "settings.agent.dependencies.cancel.button"
  | "settings.agent.dependencies.cancel.noop"
  | "settings.agent.dependencies.cancel.canceled"
  | "settings.agent.dependencies.cancel.failed"
  | "settings.remoteControlConnections.localRemoteControl.label"
  | "settings.remoteControlConnections.localRemoteControl.description"
  | "localConversation.primaryRuntimeInstallStatus.downloading"
  | "localConversation.primaryRuntimeInstallStatus.extracting"
  | "localConversation.primaryRuntimeInstallStatus.finalizing"
  | "settings.general.power.preventSleepWhileRunning.label"
  | "settings.general.power.preventSleepWhileRunning.description"
  | "settings.agentEnvironment.label"
  | "settings.agentEnvironment.description"
  | "settings.agentEnvironment.windowsNative"
  | "settings.agentEnvironment.windowsNative.description"
  | "settings.agentEnvironment.wsl"
  | "settings.agentEnvironment.wsl.description"
  | "settings.agentEnvironment.restartNotice"
  | "settings.agentEnvironment.wslBashError"
  | "settings.agentEnvironment.wslBashError.unknownDistribution"
  | "settings.general.importExternalAgent.rowLabel"
  | "settings.general.importExternalAgent.importedRowLabel"
  | "settings.general.importExternalAgent.rowDescription"
  | "settings.general.importExternalAgent.lastImported"
  | "settings.general.importExternalAgent.checking"
  | "settings.general.importExternalAgent.importing"
  | "settings.general.importExternalAgent.import"
  | "settings.general.importExternalAgent.importAgain"
  | "settings.general.importExternalAgent.viewImportedFiles"
  | "settings.general.importExternalAgent.continueWithCodex"
  | "onboarding.welcome.simple.title"
  | "onboarding.welcome.simple.subtitle"
  | "onboarding.welcome.continue"
  | "onboarding.welcome.close"
  | "onboarding.welcome.new.title.anon"
  | "onboarding.welcome.debugFallback.description"
  | "onboarding.welcomeV2.role.title"
  | "onboarding.welcomeV2.role.subtitle"
  | "onboarding.welcomeV2.role.engineering"
  | "onboarding.welcomeV2.role.product"
  | "onboarding.welcomeV2.role.finance"
  | "onboarding.welcomeV2.role.marketing"
  | "onboarding.welcomeV2.role.sales"
  | "onboarding.welcomeV2.role.operations"
  | "onboarding.welcomeV2.role.dataScience"
  | "onboarding.welcomeV2.role.design"
  | "onboarding.welcomeV2.role.student"
  | "onboarding.welcomeV2.role.somethingElse"
  | "onboarding.welcomeV2.intent.title"
  | "onboarding.welcomeV2.intent.subtitle"
  | "onboarding.welcomeV2.intent.buildSoftware"
  | "onboarding.welcomeV2.intent.designProducts"
  | "onboarding.welcomeV2.intent.manageProjects"
  | "onboarding.welcomeV2.intent.searchEmailChat"
  | "onboarding.welcomeV2.intent.manageCalendar"
  | "onboarding.welcomeV2.intent.workWithDocs"
  | "onboarding.welcomeV2.intent.analyzeData"
  | "onboarding.welcomeV2.intent.other"
  | "onboarding.welcomeV2.workMode.title"
  | "onboarding.welcomeV2.workMode.subtitle"
  | "onboarding.welcomeV2.workMode.coding.title"
  | "onboarding.welcomeV2.workMode.coding.description"
  | "onboarding.welcomeV2.workMode.nonCoding.title"
  | "onboarding.welcomeV2.workMode.nonCoding.description"
  | "onboarding.welcomeV2.workMode.settingsHint"
  | "onboarding.welcomeV2.personalized.title"
  | "onboarding.welcomeV2.personalized.description"
  | "onboarding.welcomeV2.personalized.toggle"
  | "onboarding.welcomeV2.personalizedSuggestions.title"
  | "onboarding.welcomeV2.personalizedSuggestions.description"
  | "onboarding.welcomeV2.personalizedSuggestions.toggle"
  | "onboarding.welcomeV2.personalizedSuggestions.info"
  | "onboarding.welcomeV2.skip"
  | "onboarding.welcomeV2.externalAgentImport.providers.dialogTitle"
  | "onboarding.welcomeV2.externalAgentImport.providers.title"
  | "onboarding.welcomeV2.externalAgentImport.providers.subtitle"
  | "onboarding.welcomeV2.externalAgentImport.providers.appsFound"
  | "onboarding.welcomeV2.externalAgentImport.providers.list"
  | "onboarding.welcomeV2.externalAgentImport.providers.claudeCode"
  | "onboarding.welcomeV2.externalAgentImport.providers.claudeCowork"
  | "onboarding.welcomeV2.externalAgentImport.providers.standardChatsUnsupported"
  | "onboarding.welcomeV2.externalAgentImport.providers.toggle"
  | "onboarding.welcomeV2.externalAgentImport.items.title"
  | "onboarding.welcomeV2.externalAgentImport.items.subtitle"
  | "onboarding.welcomeV2.externalAgentImport.items.list"
  | "onboarding.welcomeV2.externalAgentImport.items.bothProvidersNote"
  | "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.title"
  | "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.description"
  | "onboarding.welcomeV2.externalAgentImport.projects.title"
  | "onboarding.welcomeV2.externalAgentImport.projects.description"
  | "onboarding.welcomeV2.externalAgentImport.recentChats.title"
  | "onboarding.welcomeV2.externalAgentImport.recentChats.description"
  | "onboarding.welcomeV2.externalAgentImport.customize"
  | "onboarding.welcomeV2.externalAgentImport.customize.title"
  | "onboarding.welcomeV2.externalAgentImport.customize.description"
  | "onboarding.welcomeV2.externalAgentImport.customize.confirm"
  | "onboarding.welcomeV2.externalAgentImport.customize.projects"
  | "onboarding.welcomeV2.externalAgentImport.customize.projectsDescription"
  | "onboarding.welcomeV2.externalAgentImport.customize.pluginsWithCount"
  | "onboarding.welcomeV2.externalAgentImport.error"
  | "electron.onboarding.workspace.title"
  | "electron.onboarding.workspace.subtitle"
  | "electron.onboarding.workspace.openFolder"
  | "electron.onboarding.workspace.loading"
  | "electron.onboarding.workspace.listLabel"
  | "electron.onboarding.workspace.selectAll"
  | "electron.onboarding.workspace.empty"
  | "electron.onboarding.workspace.continue"
  | "electron.onboarding.workspace.skip"
  | "electron.onboarding.workspace.skipping"
  | "electron.onboarding.workspace.skip.playground"
  | "electron.onboarding.workspace.skipping.playground"
  | "electron.onboarding.workspace.skip.error"
  | "electron.onboarding.workspace.skip.error.unknown"
  | "projectSetup.addProjectMenu.startFromScratch"
  | "projectSetup.addProjectMenu.useExistingFolder"
  | "settings.openIn.integratedTerminalShell.label"
  | "settings.openIn.integratedTerminalShell.description"
  | "settings.openIn.integratedTerminalShell.unavailable"
  | "settings.ide.defaultOpenTarget.label"
  | "settings.ide.defaultOpenTarget.description"
  | "settings.ide.defaultOpenTarget.placeholder"
  | "externalAgentConfig.projectImport.title"
  | "externalAgentConfig.projectImport.subtitle"
  | "externalAgentConfig.projectImport.confirm"
  | "externalAgentConfig.projectImport.cancel"
  | "externalAgentConfig.projectImport.error"
  | "externalAgentConfig.itemType.agentsMd"
  | "externalAgentConfig.itemType.config"
  | "externalAgentConfig.itemType.skills"
  | "externalAgentConfig.itemType.plugins"
  | "externalAgentConfig.itemType.subagents"
  | "externalAgentConfig.itemType.hooks"
  | "externalAgentConfig.itemType.commands"
  | "externalAgentConfig.itemType.sessions"
  | "externalAgentConfig.itemType.mcpServerConfig"
  | "settings.agent.importSettings.sectionTitle"
  | "settings.agent.importSettings.sectionSubtitle"
  | "settings.agent.importSettings.loadingLabel"
  | "settings.agent.importSettings.detectingDescription"
  | "settings.agent.importSettings.sharedImportLabel"
  | "settings.agent.importSettings.sharedImportDescription"
  | "settings.agent.importSettings.applySelected"
  | "settings.agent.importSettings.remaining.summaryLabel"
  | "settings.agent.importSettings.remaining.summaryDescription"
  | "settings.agent.importSettings.remaining.continueInCodex"
  | "settings.agent.importSettings.remaining.userConfigSettingsSection"
  | "settings.agent.importSettings.remaining.currentProjectSettingsSection"
  | "settings.agent.importSettings.remaining.itemDescription"
  | "settings.agent.importSettings.remaining.slashCommandsLabel"
  | "settings.agent.importSettings.remaining.hooksLabel"
  | "settings.agent.importSettings.remaining.mcpLabel"
  | "settings.agent.importSettings.remaining.pluginsLabel"
  | "settings.agent.importSettings.remaining.subagentsLabel"
  | "settings.agent.importSettings.toast.importing"
  | "settings.agent.importSettings.toast.success"
  | "settings.agent.importSettings.toast.error"
  | "settings.agent.importSettings.progress.close"
  | "settings.agent.importSettings.progress.continueInCodex"
  | "settings.agent.importSettings.progress.scrollToBottom"
  | "settings.agent.importSettings.progress.remainingOnlyTitle"
  | "settings.agent.importSettings.progress.remainingOnlySubtitle"
  | "settings.agent.importSettings.progress.successTitle"
  | "settings.agent.importSettings.progress.successSubtitle"
  | "settings.agent.importSettings.progress.errorTitle"
  | "settings.agent.importSettings.progress.errorSubtitle"
  | "settings.agent.importSettings.progress.runningTitle"
  | "settings.agent.importSettings.progress.runningSubtitle"
  | "settings.agent.importSettings.progress.userConfigSection"
  | "settings.agent.importSettings.progress.currentProjectSection"
  | "wham.formattedRelativeDateTime.compactMinutesAgo"
  | "wham.formattedRelativeDateTime.compactHoursAgo"
  | "wham.formattedRelativeDateTime.compactDaysAgo"
  | "wham.formattedRelativeDateTime.compactWeeksAgo"
  | "wham.formattedRelativeDateTime.compactMonthsAgo"
  | "wham.formattedRelativeDateTime.compactYearsAgo"
  | "settings.general.appearance.theme"
  | "settings.general.appearance.theme.description"
  | "settings.general.appearance.theme.light"
  | "settings.general.appearance.theme.dark"
  | "settings.general.appearance.theme.system"
  | "settings.general.appearance.usePointerCursors.label"
  | "settings.general.appearance.usePointerCursors.description"
  | "settings.general.appearance.sansFontSize.row"
  | "settings.general.appearance.sansFontSize.row.description"
  | "settings.general.appearance.sansFontSize"
  | "settings.general.appearance.sansFontSize.units"
  | "settings.general.appearance.codeFontSize.row"
  | "settings.general.appearance.codeFontSize.row.description"
  | "settings.general.appearance.codeFontSize"
  | "settings.general.appearance.codeFontSize.units"
  | "settings.general.appearance.fontSmoothing.label"
  | "settings.general.appearance.fontSmoothing.description"
  | "settings.general.appearance.lightChromeTheme"
  | "settings.general.appearance.darkChromeTheme"
  | "settings.general.appearance.codeTheme"
  | "settings.general.appearance.codeTheme.previewGlyph"
  | "settings.general.appearance.chromeTheme.accent"
  | "settings.general.appearance.chromeTheme.accent.short"
  | "settings.general.appearance.chromeTheme.surface"
  | "settings.general.appearance.chromeTheme.surface.short"
  | "settings.general.appearance.chromeTheme.ink"
  | "settings.general.appearance.chromeTheme.ink.short"
  | "settings.general.appearance.chromeTheme.uiFontFamily"
  | "settings.general.appearance.chromeTheme.uiFontFamily.short"
  | "settings.general.appearance.chromeTheme.codeFontFamily"
  | "settings.general.appearance.chromeTheme.codeFontFamily.short"
  | "settings.general.appearance.chromeTheme.translucentSidebar"
  | "settings.general.appearance.chromeTheme.translucentSidebar.short"
  | "settings.general.appearance.chromeTheme.contrast"
  | "settings.general.appearance.chromeTheme.contrast.short"
  | "settings.general.appearance.chromeTheme.import"
  | "settings.general.appearance.chromeTheme.export"
  | "settings.general.appearance.chromeTheme.export.success"
  | "settings.general.appearance.chromeTheme.export.error"
  | "settings.general.appearance.chromeTheme.import.success"
  | "settings.general.appearance.chromeTheme.import.error"
  | "settings.general.appearance.chromeTheme.import.dialog.title"
  | "settings.general.appearance.chromeTheme.import.dialog.ariaLabel"
  | "settings.general.appearance.chromeTheme.import.dialog.cancel"
  | "settings.general.appearance.chromeTheme.import.dialog.submit"
  | "settings.configuration"
  | "settings.backToApp"
  | "settings.nav.back"
  | "settings.nav.account"
  | "settings.nav.connections"
  | "settings.nav.hooks-settings"
  | "settings.title"
  | "settings.nav.heading.app"
  | "settings.nav.heading.host"
  | "settings.hostDropdown.local"
  | "settings.hostDropdown.title"
  | "settings.account.subtitle"
  | "settings.account.current.title"
  | "settings.account.authMethod"
  | "settings.account.authMethod.chatgptToken"
  | "settings.account.email"
  | "settings.account.accountId"
  | "settings.account.userId"
  | "settings.account.plan"
  | "settings.account.token.title"
  | "settings.account.token.subtitle"
  | "settings.account.token.inputLabel"
  | "settings.account.token.placeholder"
  | "settings.account.token.saved"
  | "settings.account.token.save"
  | "settings.account.signOut"
  | "settings.account.notAvailable"
  | "settings.agent.title"
  | "settings.agent.configuration.subtitle.summary"
  | "settings.agent.customConfig"
  | "settings.agent.openConfigToml"
  | "settings.agent.configuration.approval.label"
  | "settings.agent.configuration.approval.definition"
  | "settings.agent.configuration.sandbox.label"
  | "settings.agent.configuration.sandbox.definition"
  | "settings.agent.configuration.network.label"
  | "settings.agent.configuration.network.definition"
  | "settings.agent.configuration.scope.projectGroup"
  | "settings.agent.configuration.scope.globalGroup"
  | "settings.agent.configuration.scope.open"
  | "settings.agent.configuration.scope.user"
  | "settings.agent.configuration.scope.managed"
  | "settings.agent.configuration.scope.managedDescription"
  | "settings.agent.configuration.scope.loading"
  | "settings.agent.configuration.scope.unavailable"
  | "settings.agent.configuration.scope.readOnly"
  | "settings.agent.configuration.control.managed"
  | "settings.agent.configuration.configToml"
  | "settings.agent.configuration.configToml.description"
  | "settings.agent.configuration.configToml.restartNote"
  | "settings.agent.configuration.configToml.docs"
  | "settings.openSourceLicenses.rowLabel"
  | "settings.openSourceLicenses.rowDescription"
  | "settings.openSourceLicenses.view"
  | "settings.openSourceLicenses.back"
  | "settings.openSourceLicenses.title"
  | "settings.openSourceLicenses.subtitle"
  | "settings.openSourceLicenses.loading"
  | "settings.openSourceLicenses.missing"
  | "settings.section.account"
  | "settings.section.connections"
  | "settings.section.hooks-settings"
  | "settings.hooks.subtitle"
  | "settings.hooks.refresh"
  | "settings.hooks.refresh.success"
  | "settings.hooks.loadingProjects.label"
  | "settings.hooks.emptyProject.label"
  | "settings.hooks.emptyProject.description"
  | "settings.hooks.loading.label"
  | "settings.hooks.loadError.label"
  | "settings.hooks.project.loading"
  | "settings.hooks.project.group"
  | "settings.hooks.issues.summary"
  | "settings.hooks.issues.error"
  | "settings.hooks.event.counts"
  | "settings.hooks.event.emptyCounts"
  | "settings.hooks.event.moreActions"
  | "settings.hooks.event.openSourceFile"
  | "settings.hooks.event.managedTooltip"
  | "settings.hooks.event.preToolUse"
  | "settings.hooks.event.preToolUse.description"
  | "settings.hooks.event.permissionRequest"
  | "settings.hooks.event.permissionRequest.description"
  | "settings.hooks.event.postToolUse"
  | "settings.hooks.event.postToolUse.description"
  | "settings.hooks.event.preCompact"
  | "settings.hooks.event.preCompact.description"
  | "settings.hooks.event.postCompact"
  | "settings.hooks.event.postCompact.description"
  | "settings.hooks.event.sessionStart"
  | "settings.hooks.event.sessionStart.description"
  | "settings.hooks.event.userPromptSubmit"
  | "settings.hooks.event.userPromptSubmit.description"
  | "settings.hooks.event.stop"
  | "settings.hooks.event.stop.description"
  | "settings.hooks.event.fallbackHookTitle"
  | "settings.hooks.source.plugin"
  | "settings.hooks.source.pluginSummary"
  | "settings.hooks.source.adminConfig"
  | "settings.hooks.source.userConfig"
  | "settings.hooks.source.projectConfig"
  | "settings.hooks.source.sessionFlags"
  | "settings.hooks.source.unknown"
  | "settings.mcp.loading"
  | "settings.mcp.loadError.title"
  | "settings.mcp.loadError.retry"
  | "settings.mcp.empty"
  | "settings.mcp.addServer"
  | "settings.mcp.myServers"
  | "settings.mcp.restartApp"
  | "settings.mcp.server.login"
  | "settings.mcp.server.settings"
  | "settings.mcp.server.enable"
  | "settings.mcp.readOnly"
  | "settings.mcp.oauth.error"
  | "settings.mcp.refreshing"
  | "settings.mcp.detail.titleExisting"
  | "settings.mcp.detail.titleNew"
  | "settings.mcp.detail.back"
  | "settings.mcp.detail.docs"
  | "settings.mcp.detail.docs.link"
  | "settings.mcp.detail.uninstall"
  | "settings.mcp.detail.name"
  | "settings.mcp.detail.switchTransportNotice"
  | "settings.mcp.detail.transport.label"
  | "settings.mcp.detail.transport.stdio"
  | "settings.mcp.detail.transport.http"
  | "settings.mcp.detail.command"
  | "settings.mcp.detail.args"
  | "settings.mcp.detail.addArgument"
  | "settings.mcp.detail.envVars"
  | "settings.mcp.detail.addEnvVar"
  | "settings.mcp.detail.envVarPassthrough"
  | "settings.mcp.detail.addEnvVarPassthrough"
  | "settings.mcp.detail.cwd"
  | "settings.mcp.detail.http.url"
  | "settings.mcp.detail.http.bearerToken"
  | "settings.mcp.detail.http.headers"
  | "settings.mcp.detail.http.addHeader"
  | "settings.mcp.detail.http.envHeaders"
  | "settings.mcp.detail.http.addEnvHeader"
  | "settings.mcp.detail.save"
  | "settings.mcp.detail.remove"
  | "settings.editRow.headerPlaceholder"
  | "settings.editRow.valuePlaceholder"
  | "settings.editRow.removeEntry"
  | "settings.agent.approval.untrusted"
  | "settings.agent.approval.onFailure"
  | "settings.agent.approval.onRequest"
  | "settings.agent.approval.never"
  | "settings.agent.sandbox.readOnly"
  | "settings.agent.sandbox.workspaceWrite"
  | "settings.agent.sandbox.fullAccess"
  | "settings.ide.language.label"
  | "settings.ide.language.description"
  | "settings.ide.language.auto"
  | "settings.ide.language.autoOption"
  | "settings.ide.language.search"
  | "settings.general.macMenuBar.label"
  | "settings.general.macMenuBar.description"
  | "settings.general.macMenuBar.ariaLabel"
  | "settings.personalization.agents.title"
  | "settings.personalization.agents.description"
  | "settings.personalization.agents.placeholder"
  | "settings.personalization.agents.loading"
  | "settings.personalization.agents.loadError"
  | "settings.personalization.agents.retry"
  | "settings.personalization.agents.save"
  | "settings.personalization.agents.save.success"
  | "settings.personalization.agents.save.error"
  | "settings.personalization.personality.label"
  | "settings.personalization.personality.description"
  | "settings.personalization.memory.title"
  | "settings.personalization.memory.subtitle"
  | "settings.general.experimentalFeatures.chronicle.name"
  | "settings.general.experimentalFeatures.chronicle.memoriesRequiredTooltip"
  | "settings.general.experimentalFeatures.chronicle.buttonAriaLabel"
  | "settings.general.experimentalFeatures.chronicle.consentTitle"
  | "settings.general.experimentalFeatures.chronicle.consentBodyIntro"
  | "settings.general.experimentalFeatures.chronicle.consentBodyConsiderations"
  | "settings.general.experimentalFeatures.chronicle.consentBodyCost"
  | "settings.general.experimentalFeatures.chronicle.consentBodyPrivacy"
  | "settings.general.experimentalFeatures.chronicle.consentBodyPromptInjection"
  | "settings.general.experimentalFeatures.chronicle.consentBodyStorageHeading"
  | "settings.general.experimentalFeatures.chronicle.consentBodyStorageProcessing"
  | "settings.general.experimentalFeatures.chronicle.consentBodyStorageLocal"
  | "settings.general.experimentalFeatures.chronicle.consentBodyDisableIntro"
  | "settings.general.experimentalFeatures.chronicle.cancel"
  | "settings.general.experimentalFeatures.chronicle.continue"
  | "settings.general.experimentalFeatures.chronicle.description"
  | "settings.general.experimentalFeatures.chronicle.permission.runningStatus"
  | "settings.general.experimentalFeatures.chronicle.permission.runningStatusAccessibility"
  | "settings.general.experimentalFeatures.chronicle.permission.screenRecording"
  | "settings.general.experimentalFeatures.chronicle.permission.statusLabel"
  | "settings.general.experimentalFeatures.chronicle.permission.notGranted"
  | "settings.general.experimentalFeatures.chronicle.permission.accessibility"
  | "settings.general.experimentalFeatures.chronicle.permission.status"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.paused"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.starting"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.stopping"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.running"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.checking"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.unknown"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.granted"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.notDetermined"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.denied"
  | "settings.general.experimentalFeatures.chronicle.permissionStatus.restricted"
  | "settings.general.experimentalFeatures.chronicle.screenRecordingSettingsName"
  | "settings.general.experimentalFeatures.chronicle.accessibilitySettingsName"
  | "settings.general.experimentalFeatures.chronicle.setupTitle"
  | "settings.general.experimentalFeatures.chronicle.openScreenRecordingSettings"
  | "settings.general.experimentalFeatures.chronicle.openAccessibilitySettings"
  | "settings.general.experimentalFeatures.chronicle.askCodex"
  | "settings.general.experimentalFeatures.chronicle.setupClose"
  | "settings.general.experimentalFeatures.chronicle.permissionDragAppLabel"
  | "settings.general.experimentalFeatures.chronicle.permissionDragApp"
  | "settings.general.experimentalFeatures.chronicle.setupReadyTitle"
  | "settings.general.experimentalFeatures.chronicle.setupFailedTitle"
  | "settings.general.experimentalFeatures.chronicle.setupScreenRecordingPermissionNeededTitle"
  | "settings.general.experimentalFeatures.chronicle.setupAccessibilityPermissionNeededTitle"
  | "settings.general.experimentalFeatures.chronicle.setupInProgressTitle"
  | "settings.general.experimentalFeatures.chronicle.setupWaiting"
  | "settings.general.experimentalFeatures.chronicle.setupScreenRecordingRestricted"
  | "settings.general.experimentalFeatures.chronicle.setupScreenRecordingDenied"
  | "settings.general.experimentalFeatures.chronicle.setupAccessibilityRestricted"
  | "settings.general.experimentalFeatures.chronicle.setupAccessibilityDenied"
  | "settings.general.experimentalFeatures.chronicle.setupReady"
  | "settings.general.experimentalFeatures.chronicle.setupFailed"
  | "settings.personalization.pets.title"
  | "settings.personalization.pets.current"
  | "settings.personalization.pets.openPet"
  | "settings.personalization.pets.tuckAwayPet"
  | "settings.personalization.avatars.select"
  | "settings.personalization.avatars.selected"
  | "settings.pets.custom.title"
  | "settings.pets.custom.openFolder"
  | "settings.pets.custom.openFolderError"
  | "settings.pets.refresh"
  | "settings.pets.loadingCustom"
  | "settings.pets.loadCustomError"
  | "settings.pets.custom.create.title"
  | "settings.memory.enableMemoriesLabel"
  | "settings.memory.enableMemoriesDescription"
  | "settings.memory.enableMemoriesAriaLabel"
  | "settings.memory.noToolContextLabel"
  | "settings.memory.noToolContextDescription"
  | "settings.memory.noToolContextAriaLabel"
  | "settings.memory.resetMemoriesLabel"
  | "settings.memory.resetMemoriesDescription"
  | "settings.memory.resetMemoriesButton"
  | "settings.memory.resetDialogTitle"
  | "settings.memory.resetDialogSubtitle"
  | "settings.memory.resetDialogCancel"
  | "settings.memory.resetDialogConfirm"
  | "settings.memory.resetSuccess"
  | "settings.memory.resetError"
  | "composer.personalitySlashCommand.label.friendly"
  | "composer.personalitySlashCommand.description.friendly"
  | "composer.personalitySlashCommand.label.pragmatic"
  | "composer.personalitySlashCommand.description.pragmatic"
  | "auth.signOut"
  | "auth.signInWithChatGpt"
  | "auth.apiKey"
  | "auth.useApiKey"
  | "auth.deviceCode"
  | "auth.useDeviceCode"
  | "auth.checking"
  | "auth.signingIn"
  | "auth.signedOut"
  | "auth.ready"
  | "auth.chatGpt"
  | "auth.openAiApiKey"
  | "auth.loginRequired"
  | "auth.cancel"
  | "auth.cancelSignIn"
  | "auth.apiKeyPlaceholder"
  | "auth.apiKeyConfirm"
  | "auth.completeBrowserSignIn"
  | "auth.openBrowser"
  | "auth.copy"
  | "electron.onboarding.login.snake.start"
  | "electron.onboarding.login.welcomeV2.title"
  | "electron.onboarding.login.chatgpt.signIn"
  | "electron.onboarding.login.chatgpt.cancel.welcomeV2"
  | "electron.onboarding.login.apikey.open.welcomeV2"
  | "electron.onboarding.login.apikey.label"
  | "electron.onboarding.login.apikey.placeholder"
  | "electron.onboarding.login.apikey.cancel"
  | "electron.onboarding.login.apikey.continue"
  | "electron.onboarding.login.browserPending.welcomeV2"
  | "electron.onboarding.login.signup.welcomeV2"
  | "electron.onboarding.login.includedPlans.welcomeV2"
  | "avatarOverlay.statusRunning"
  | "avatarOverlay.statusRunningSubtitle"
  | "avatarOverlay.statusWaiting"
  | "avatarOverlay.statusReview"
  | "avatarOverlay.statusFailed"
  | "avatarOverlay.statusInfo"
  | "avatarOverlay.session.calledTool"
  | "avatarOverlay.session.callingTool"
  | "avatarOverlay.session.callingToolName"
  | "avatarOverlay.session.editedFiles"
  | "avatarOverlay.session.editingFiles"
  | "avatarOverlay.session.newThread"
  | "avatarOverlay.session.ranCommand"
  | "avatarOverlay.session.runningCommand"
  | "avatarOverlay.openNotification"
  | "avatarOverlay.dismissNotification"
  | "avatarOverlay.dismissNotificationTooltip"
  | "avatarOverlay.replyNotification"
  | "avatarOverlay.replyNotificationButton"
  | "avatarOverlay.sendNotificationReply"
  | "avatarOverlay.notificationReplyPlaceholder"
  | "avatarOverlay.notificationReplyError"
  | "avatarOverlay.expandNotification"
  | "avatarOverlay.collapseNotification"
  | "avatarOverlay.expandNotificationTooltip"
  | "avatarOverlay.collapseNotificationTooltip"
  | "avatarOverlay.collapseNotificationTray"
  | "avatarOverlay.notificationList"
  | "avatarOverlay.latestNotifications"
  | "avatarOverlay.showLatestNotifications"
  | "avatarOverlay.showOlderNotifications"
  | "avatarOverlay.olderNotificationCount"
  | "avatarOverlay.compactOlderNotificationCount"
  | "avatarOverlay.toggleNotificationTray"
  | "petOverlay.mascotLabel"
  | "petOverlay.closePet"
  | "history.noMessageYet";

type MessageDictionary = Record<MessageKey, string>;

export const DEFAULT_LOCALE: LocaleCode = "en-US";

export const SUPPORTED_LOCALES = ["auto", ...UPSTREAM_LOCALE_CODES] as const;

const LOCALE_LOOKUP = new Map(UPSTREAM_LOCALE_CODES.map((code) => [normalizeLocaleCode(code), code]));

export function normalizeLocaleCode(value: string) {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

export function resolveSupportedLocale(value: unknown): LocaleCode | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const normalized = normalizeLocaleCode(value);
  const exactMatch = LOCALE_LOOKUP.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }
  const [language] = normalized.split("-");
  if (!language) {
    return null;
  }
  return (
    UPSTREAM_LOCALE_CODES.find((code) => {
      const supportedCode = normalizeLocaleCode(code);
      return supportedCode === language || supportedCode.startsWith(`${language}-`);
    }) ?? null
  );
}

export function getMessageLocale(locale: LocaleCode | null | undefined): MessageLocaleCode {
  return locale && normalizeLocaleCode(locale).startsWith("zh") ? "zh-CN" : "en-US";
}

export function getLocaleLabel(code: LocaleCode, displayLocale: LocaleCode) {
  try {
    return new Intl.DisplayNames([displayLocale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const MESSAGES: Record<MessageLocaleCode, MessageDictionary> = {
  "en-US": {
    "app.menu.file": "File",
    "app.menu.edit": "Edit",
    "app.menu.view": "View",
    "app.menu.window": "Window",
    "app.menu.help": "Help",
    "app.nav.newChat": "New chat",
    "app.nav.search": "Search",
    "app.nav.settings": "Settings",
    "skills.appsPage.heading.plugins": "Plugins",
    "skills.appsPage.subheading.plugins": "Plugins let Codex work your way.",
    "skills.appsPage.search.plugins": "Search plugins",
    "skills.appsPage.search.plugins.label": "Search plugins",
    "skills.appsPage.loading": "Loading apps…",
    "skills.appsPage.loadError.title": "Unable to load apps",
    "skills.appsPage.loadError.retry": "Retry",
    "skills.appsPage.empty.plugins": "No plugins found",
    "skills.appsPage.manageTab.plugins": "Plugins",
    "skills.appsPage.manageTab.marketplace": "Marketplace",
    "skills.appsPage.marketplace.loading": "Loading marketplaces…",
    "skills.appsPage.marketplace.loadError.title": "Unable to load marketplaces",
    "skills.appsPage.marketplace.loadError.retry": "Retry",
    "skills.appsPage.empty.marketplace": "No marketplaces found",
    "skills.appsPage.marketplace.pluginCount": "{count, plural, one {# plugin} other {# plugins}}",
    "skills.appsPage.marketplace.upgrade.ariaLabel": "Upgrade marketplace",
    "skills.appsPage.marketplace.upgrade.button": "Upgrade",
    "skills.appsPage.marketplace.upgrade": "Upgrade marketplace",
    "skills.appsPage.marketplace.upgrade.builtInDisabled": "Built-in marketplaces are upgraded by Codex",
    "skills.appsPage.marketplace.upgrade.workspaceDisabled": "Workspace marketplaces are managed by the workspace",
    "skills.appsPage.marketplace.upgrade.localDisabled": "Only Git marketplaces can be upgraded",
    "skills.appsPage.marketplace.remove": "Remove marketplace",
    "skills.appsPage.marketplace.remove.ariaLabel": "Remove marketplace",
    "skills.appsPage.marketplace.remove.builtInDisabled": "Built-in marketplaces cannot be removed",
    "skills.appsPage.marketplace.remove.workspaceDisabled": "Workspace marketplaces are managed by the workspace",
    "skills.appsPage.marketplace.removeDialog.title": 'Remove "{marketplaceName}"?',
    "skills.appsPage.marketplace.removeDialog.description":
      "Codex will remove this marketplace from your configuration. Plugins from it will no longer appear unless the marketplace is added again",
    "skills.appsPage.marketplace.removeDialog.cancel": "Cancel",
    "skills.appsPage.marketplace.removeDialog.confirm": "Remove",
    "skills.appsPage.marketplace.partialLoadError.title": "Some marketplaces could not be loaded",
    "skills.appsPage.marketplace.partialLoadError.more":
      "{count, plural, one {# more marketplace could not be loaded} other {# more marketplaces could not be loaded}}",
    "skills.appsPage.marketplace.partialLoadError.retry": "Retry",
    "skills.appsPage.addMarketplace.title": "Add marketplace",
    "skills.appsPage.addMarketplace.header": "Add marketplace",
    "skills.appsPage.addMarketplace.subtitle": "Add a plugin marketplace from a GitHub repo, Git URL, or local folder",
    "skills.appsPage.addMarketplace.sourceRequired": "Enter a marketplace source",
    "skills.appsPage.addMarketplace.sourceLabel": "Source",
    "skills.appsPage.addMarketplace.sourcePlaceholder": "openai/plugins or git@github.com:org/repo.git",
    "skills.appsPage.addMarketplace.refLabel": "Git ref",
    "skills.appsPage.addMarketplace.refPlaceholder": "main",
    "skills.appsPage.addMarketplace.sparsePathsLabel": "Sparse paths",
    "skills.appsPage.addMarketplace.sparsePathsPlaceholder": "plugins/codex",
    "skills.appsPage.addMarketplace.cancel": "Cancel",
    "skills.appsPage.addMarketplace.submit": "Add marketplace",
    "skills.appsPage.addMarketplace.failed": "Failed to add marketplace",
    "skills.appsPage.addMarketplace.refreshFailed":
      "{marketplaceName} marketplace is configured, but failed to refresh the plugin list",
    "skills.appsPage.addMarketplace.alreadyAdded": "{marketplaceName} is already added",
    "skills.appsPage.addMarketplace.success": "{marketplaceName} marketplace added",
    "skills.appsPage.pluginsUnsupportedHost.title": "Plugins are not available for this host",
    "skills.appsPage.pluginsUnsupportedHost.description": "Choose another host to browse and manage plugins",
    "skills.appsPage.browseIntro.title": "Make Codex work your way",
    "skills.appsPage.hostDropdown.local": "Local",
    "skills.appsPage.hostDropdown.title": "Host",
    "skills.appsPage.pluginsFilter.all": "All plugins",
    "skills.appsPage.categoryFilter.all": "All",
    "skills.appsPage.categoryFilter.trigger": "Category",
    "skills.appsPage.categoryDropdown.ariaLabel": "Choose a category",
    "skills.appsPage.browseDropdown.ariaLabel": "Choose a plugin marketplace",
    "skills.appsPage.marketplaceFilter.addMore": "Add more",
    "skills.page.heading": "Skills",
    "skills.page.subheading": "Give Codex superpowers. <a>Learn more</a>",
    "skills.page.loading": "Loading skills...",
    "skills.page.empty": "No skills found",
    "skills.page.filteredEmpty": "No skills match your filters",
    "skills.page.filteredEmptyDescription": "Try adjusting your search or scope filters",
    "skills.page.search": "Search skills",
    "skills.page.search.label": "Search skills",
    "skills.page.createSkill": "New skill",
    "skills.page.refreshSkills": "Refresh",
    "skills.page.refreshSkillsToUseNew": "Refresh to use new skill(s)",
    "skills.page.refreshFailed": "Unable to load skills",
    "skills.pluginsAuthBlockedToast.title": "Sign in with ChatGPT to use plugins",
    "skills.pluginsAuthBlockedToast.description":
      "Plugins are not available with API key sign-in. Sign in with ChatGPT to browse and install them.",
    "skills.section.installed": "Installed",
    "skills.section.recommended": "Recommended",
    "settings.nav.skills-settings": "Skills",
    "skills.card.enabledStatus": "Enabled",
    "skills.card.disabledStatus": "Disabled",
    "skills.card.loadingContents": "Loading skill contents...",
    "skills.card.contentsError": "Unable to load skill contents.",
    "skills.card.removeSuccess": "{skillName} skill uninstalled",
    "skills.card.removeFailed": "Failed to uninstall skill",
    "skills.card.toggleEnabledError": "Failed to update skill",
    "skills.card.disabledBadge": "Disabled",
    "skills.card.open": "Open",
    "skills.card.moreActions": "More actions",
    "skills.card.details": "Details",
    "skills.card.uninstall": "Uninstall",
    "skills.card.try": "Try in chat",
    "skills.card.enableSuccess": "{skillName} skill enabled",
    "skills.card.disableSuccess": "{skillName} skill disabled",
    "skills.card.enableSkill": "Enable skill",
    "skills.card.disableSkill": "Disable skill",
    "skills.appsPage.manageTab.apps": "Apps",
    "skills.appsPage.manageTab.mcps": "MCPs",
    "skills.appsPage.manageTab.skills": "Skills",
    "skills.appsPage.empty.installedApps": "No installed apps",
    "skills.appsPage.empty.mcps": "No MCP servers found",
    "skills.appsPage.empty.skills": "No installed skills",
    "skills.appsPage.marketplace.upgradeAll": "Upgrade all",
    "skills.appsPage.marketplace.upgradeAll.tooltip": "Upgrade all upgradable marketplaces",
    "skills.appsPage.mcps.settings": "Open MCP settings",
    "skills.appsPage.mcps.enable": "Enable MCP server",
    "skills.appsPage.mcps.disable": "Disable MCP server",
    "skills.appsPage.mcps.toggle": "Toggle MCP server enabled state",
    "skills.appsPage.mcps.toggleError": "Failed to update MCP server",
    "skills.appsPage.apps.toggle": "Toggle app enabled state",
    "skills.appsPage.apps.toggleError": "Failed to update app",
    "skills.appsPage.skills.enable": "Enable skill",
    "skills.appsPage.skills.disable": "Disable skill",
    "skills.appsPage.skills.toggle": "Toggle skill enabled state",
    "skills.appsPage.skills.toggleError": "Failed to update skill",
    "skills.appsPage.toolsDialog.open": "Manage on ChatGPT",
    "skills.appsPage.toolsDialog.moreActions": "More actions",
    "skills.appsPage.toolsDialog.enableApp": "Enable app",
    "skills.appsPage.toolsDialog.disableApp": "Disable app",
    "skills.appsPage.toolsDialog.tryInChat": "Try in chat",
    "skills.appsPage.toolsDialog.tryInChatDisabled": "Enable and connect this app to try it in chat",
    "skills.appsPage.toolsDialog.disabledBadge": "Disabled",
    "skills.appsPage.toolsDialog.subtitle": "Available tools for this app",
    "skills.appsPage.toolsDialog.summary": "The {appName} app contains {totalActions} actions ({actionTypes})",
    "skills.appsPage.toolsDialog.loading": "Loading tools…",
    "skills.appsPage.toolsDialog.empty": "No tools available for this app.",
    "skills.appsPage.toolsDialog.error": "Unable to load tools for this app.",
    "plugins.card.enableToggleTooltip": "Enable plugin",
    "plugins.card.disableToggleTooltip": "Disable plugin",
    "plugins.card.toggleAria": "Toggle plugin enabled state",
    "plugins.card.enabledStatus": "Plugin enabled",
    "plugins.card.disabledStatus": "Plugin disabled",
    "plugins.card.enableButton": "Enable",
    "plugins.card.installTooltip": "Install plugin",
    "plugins.card.tryInChat": "Try in Chat",
    "plugins.card.enableSuccess": "{pluginName} plugin enabled",
    "plugins.card.disableSuccess": "{pluginName} plugin disabled",
    "plugins.card.toggleError": "Failed to update plugin",
    "plugins.importedConnectors.title": "Imported plugins",
    "plugins.importedConnectors.empty": "No imported plugins",
    "plugins.importedConnectors.finishSetup": "Finish setup",
    "plugins.hero.tryInChat": "Try in chat",
    "plugins.hero.dotLabel": "Go to plugin slide {index}",
    "plugins.hero.copy.computerUse": "Play a playlist to help me lock in",
    "plugins.hero.copy.gmail": "Draft replies for every email I'm behind on",
    "plugins.hero.copy.slack": "Prep me for standup every morning",
    "plugins.hero.copy.googleCalendar": "Schedule a recurring 1:1",
    "plugins.hero.copy.googleDrive": "Draft my weekly recap every Friday",
    "plugins.hero.copy.linear": "Create tickets for these bug bash findings",
    "skills.recommended.error": "Unable to load recommended skills",
    "skills.scope.builtIn": "System",
    "skills.scope.team": "Team",
    "skills.scope.personal": "Personal",
    "skills.scope.adminInstalled": "Admin installed",
    "plugins.marketplace.removeSuccess": "{marketplaceName} marketplace removed",
    "plugins.marketplace.removeError": "Failed to remove marketplace",
    "plugins.marketplace.upgradeAllSuccess": "Marketplaces upgraded",
    "plugins.marketplace.upgradeSuccess": "{marketplaceName} marketplace upgraded",
    "plugins.marketplace.upgradeAllError": "Some marketplaces failed to upgrade",
    "plugins.marketplace.upgradeError": "Failed to upgrade marketplace",
    "plugins.marketplace.upgradeAllRequestError": "Failed to upgrade marketplaces",
    "plugins.installModal.about": "About",
    "plugins.installModal.capabilities": "Capabilities",
    "plugins.installModal.developedBy": "Developed by {developerName}",
    "plugins.installModal.includes": "Includes",
    "plugins.installModal.includes.apps": "Apps",
    "plugins.installModal.includes.skills": "Skills",
    "plugins.installModal.includes.mcpServers": "MCP servers",
    "plugins.installModal.install": "Install {pluginName}",
    "plugins.installModal.installing": "Installing {pluginName}",
    "plugins.installModal.metadata.category": "Category: {category}",
    "plugins.installModal.title": "Install {pluginName}",
    "plugins.installModal.finishSetup.title": "Finish setting up {pluginName}",
    "plugins.installModal.finishSetup.description":
      "Complete the remaining steps so Codex can use this plugin.",
    "plugins.installModal.requiredApps": "Required apps",
    "plugins.installModal.requiredApps.connected": "Connected",
    "plugins.installModal.requiredApps.connecting": "Connecting…",
    "plugins.installModal.requiredApps.connect": "Connect",
    "plugins.installModal.browserExtensions": "Browser extensions",
    "plugins.installModal.browserExtension.description":
      "Install this extension in Chrome to let Codex connect to your browser",
    "plugins.installModal.done": "Done",
    "plugins.install.ready": "{pluginName} is ready to use",
    "plugins.install.success": "{pluginName} installed",
    "plugins.install.error": "Failed to install plugin",
    "plugins.install.refreshError":
      "Installed {pluginName}, but failed to refresh plugin state",
    "codexMobile.homeBanner.title": "Introducing Codex mobile",
    "codexMobile.homeBanner.body":
      "The power of Codex on your desktop computer from your phone",
    "codexMobile.homeBanner.primary": "Set up",
    "codexMobile.homeBanner.dismiss": "Dismiss Codex mobile banner",
    "codexMobile.setupDialog.close": "Close",
    "codexMobile.setupDialog.initial.title": "Set up Codex mobile",
    "codexMobile.setupDialog.initial.heading": "Set up Codex mobile",
    "codexMobile.setupDialog.initial.description":
      "Use the ChatGPT app on your phone to keep working with Codex whenever your computer is awake",
    "codexMobile.setupDialog.initial.feature.threads":
      "Access all your threads and projects and create new ones",
    "codexMobile.setupDialog.initial.feature.notifications":
      "Get notified when Codex desktop completes a task or needs your attention",
    "codexMobile.setupDialog.initial.feature.actions":
      "Use the full power of Codex on the go, including taking actions on your computer",
    "codexMobile.setupDialog.initial.skip": "Set up later in Settings",
    "codexMobile.setupDialog.initial.primary": "Get started",
    "codexMobile.setupDialog.initial.startSetupError":
      "Couldn’t check security requirements. Try again",
    "codexMobile.setupDialog.allowHost.title":
      "Allow your phone to control this computer",
    "codexMobile.setupDialog.allowHost.heading":
      "Allow your phone to control this computer",
    "codexMobile.setupDialog.allowHost.description":
      "Let Codex mobile access this computer so you can keep working from your phone",
    "codexMobile.setupDialog.allowHost.primary": "Allow",
    "codexMobile.setupDialog.mfaRequired.title":
      "Turn on Multi-Factor Authentication",
    "codexMobile.setupDialog.mfaRequired.heading":
      "Turn on Multi-Factor Authentication",
    "codexMobile.setupDialog.mfaRequired.description":
      "To ensure you remain in control of your devices, you’ll need to turn on Multi-Factor Authentication for your ChatGPT account.",
    "codexMobile.setupDialog.mfaRequired.primary":
      "Continue on chatgpt.com",
    "codexMobile.setupDialog.waiting.title": "Approve on mobile device",
    "codexMobile.setupDialog.waiting.heading": "Approve on mobile device",
    "codexMobile.setupDialog.waiting.description":
      "Approve the connection request sent to your mobile device signed into ChatGPT.",
    "codexMobile.setupDialog.connected.title": "You’re connected",
    "codexMobile.setupDialog.connected.heading": "You’re connected",
    "codexMobile.setupDialog.connected.description":
      "Make the most out of Codex mobile. You can change these later in Settings.",
    "codexMobile.setupDialog.connected.keepAwake.title":
      "Keep this computer awake",
    "codexMobile.setupDialog.connected.keepAwake.description":
      "Prevent your computer from sleeping when Codex is running.",
    "codexMobile.setupDialog.connected.keepAwake.toggle":
      "Keep this computer awake",
    "codexMobile.setupDialog.connected.computerUse.title":
      "Enable Computer Use",
    "codexMobile.setupDialog.connected.computerUse.description":
      "Let Codex control the apps on your Mac.",
    "codexMobile.setupDialog.connected.computerUse.toggle":
      "Enable Computer Use",
    "codexMobile.setupDialog.connected.chromeExtension.title":
      "Install Chrome extension",
    "codexMobile.setupDialog.connected.chromeExtension.description":
      "Let Codex navigate and fill out forms on websites.",
    "codexMobile.setupDialog.connected.finish": "Finish setup",
    "app.shell.appMenu": "App menu",
    "app.shell.back": "Back",
    "app.shell.forward": "Forward",
    "app.shell.toggleSidebar": "Toggle sidebar",
    "app.shell.settings": "Settings",
    "app.shell.share": "Share",
    "codex.alert.closeAriaLabel": "Close",
    "codex.archiveInfo.electron": "View archived chats in {settingsLink}",
    "codex.archiveInfo.settingsLink": "Settings",
    "codex.signInFailed.message": "Sign-in failed: {rawMessage}",
    "codex.legal.step.intro.title": "Codex in your IDE",
    "codex.legal.step.intro.subtitle":
      "Codex navigates, edits, runs commands, and executes tests directly in your repo. Powered by your ChatGPT account.",
    "codex.legal.step.cloud.title": "Hand off to Codex in the cloud",
    "codex.legal.step.cloud.subtitle":
      "Send tasks to Codex to run in the background so you can stay focused and move faster.",
    "codex.legal.step.todo.title": "Turn TODOs into Codex tasks",
    "codex.legal.step.todo.subtitle": "Write a TODO comment and convert it into a Codex task with a single click.",
    "codex.legal.autonomy.title": "Decide how much autonomy you want to grant",
    "codex.legal.autonomy.details": "For more details, see the {link}",
    "codex.legal.autonomy.details.link": "Codex docs",
    "codex.legal.mistakes.title": "Codex can make mistakes",
    "codex.legal.mistakes.review": "Review the code it writes and commands it runs",
    "codex.legal.powered.title": "Powered by your ChatGPT account",
    "codex.legal.powered.details": "Uses your plan’s rate limits and {link}",
    "codex.legal.powered.details.link": "training data preferences",
    "codex.legal.copilot.title": "Powered by GitHub Copilot",
    "codex.legal.copilot.details":
      "Uses your Copilot plan for all model calls, billing, and rate limits. Codex extension usage is subject to both {oaiTos} and {gitHubTos}.",
    "codex.legal.copilot.oaiTosLink": "OpenAI Codex terms of service",
    "codex.legal.copilot.gitHubTosLink": "GitHub Terms of Service",
    "codex.legal.backButton": "Back",
    "codex.legal.continueButton": "Next",
    "codex.legal.continue.apikey": "Continue",
    "codex.legal.cloud.taskOne.title": "Explain repository to a new designer",
    "codex.legal.cloud.taskOne.meta": "openai/agi · Oct 12",
    "codex.legal.cloud.taskTwo.title": "Fix an onboarding bug",
    "codex.legal.cloud.taskTwo.meta": "openai/agi · Oct 9",
    "codex.legal.cloud.taskTwo.stats.positive": "+2",
    "codex.legal.cloud.taskTwo.stats.negative": "-20",
    "codex.legal.cloud.taskThree.title": "Create a darkmode theme",
    "codex.legal.cloud.taskThree.meta": "openai/codex · Oct 8",
    "codex.legal.cloud.taskThree.stats.positive": "+249",
    "codex.legal.cloud.taskThree.stats.negative": "-123",
    "codex.legal.todo.heading": "// TODO: implement schema",
    "app.chat.noRecentThreads": "No recent conversations",
    "app.chat.noMessages": "No messages",
    "app.chat.changedFiles": "{fileCount} files changed",
    "app.chat.undo": "Undo",
    "app.chat.viewDiff": "View diff",
    "app.chat.commit": "Commit",
    "app.chat.projects": "PROJECTS",
    "app.chat.filesChanged": "{fileCount} files changed",
    "app.chat.composePlaceholder": "Ask Codex anything. Type @ to use plugins or mention files",
    "composer.placeholder.newTask.doAnything": "Ask Codex to do anything",
    "composer.footer.v2.cloudTab": "Cloud",
    "composer.mode.worktreeSegment": "Worktree",
    "composer.hotkeyWindow.modeDropdown.localProject": "Local project",
    "composer.hotkeyWindow.modeDropdown.tooltip": "Select where to run the task",
    "composer.mode.local": "Work locally",
    "composer.hotkeyWindow.modeDropdown.localOnly": "Initialize a git repo to run tasks in worktrees",
    "composer.mode.worktree": "New worktree",
    "app.chat.send": "Send",
    "app.chat.stop": "Stop",
    "app.chat.queuedFollowUps": "Queued follow-ups ({count})",
    "commentAttachments.numAnnotations": "{count, plural, one {# annotation} other {# annotations}}",
    "commentAttachments.numComments": "{count, plural, one {# comment} other {# comments}}",
    "app.chat.removeQueuedFollowUp": "Remove",
    "app.chat.commandExecution": "Command",
    "app.chat.fileChange": "File change",
    "app.chat.hookPrompt": "Hook prompt",
    "localConversation.hookItem.eventName.preToolUse": "Before tool use",
    "localConversation.hookItem.eventName.postToolUse": "After tool use",
    "localConversation.hookItem.eventName.sessionStart": "Session start",
    "localConversation.hookItem.eventName.userPromptSubmit": "User prompt submit",
    "localConversation.hookItem.eventName.permissionRequest": "Permission request",
    "localConversation.hookItem.eventName.stop": "Stop",
    "localConversation.hookItem.summary.withStatusMessage": "{eventName} - {statusMessage}",
    "localConversation.hookItem.summary.ariaLabel": "{summary} {status}",
    "localConversation.hookItem.feedback": "Feedback",
    "localConversation.hookItem.warning": "Warning",
    "localConversation.hookItem.error": "Error",
    "localConversation.hookItem.hookContext": "Hook context",
    "localConversation.hookItem.stop": "Stop",
    "app.chat.contextCompaction": "Context compacted",
    "app.chat.contextCompactionDescription": "Earlier conversation context was compacted.",
    "app.chat.imageGeneration": "Generated image",
    "app.chat.collabAgentToolCall": "Agent tool call",
    "app.chat.mcpServer": "MCP server",
    "app.chat.mcpTool": "Tool",
    "app.chat.agentTool": "Agent tool",
    "app.chat.senderThread": "Sender thread",
    "app.chat.receiverThreads": "Receiver threads",
    "homePage.mainContent": "Main content",
    "home.hero.letsBuild": "Let’s build",
    "threadPage.newThread": "New chat",
    "hotkeyWindow.dismiss": "Dismiss Popout Window",
    "hotkeyWindow.defaultTitle": "Codex",
    "hotkeyWindow.threadPage.newButton": "Start New Chat",
    "hotkeyWindow.threadPage.openInMainWindow": "Open in Main Window",
    "app.chat.revisedPrompt": "Revised prompt",
    "app.chat.prompt": "Prompt",
    "app.chat.model": "Model",
    "app.chat.reasoningEffort": "Reasoning effort",
    "app.chat.agentStatus": "Agent status",
    "app.chat.savedPath": "Saved path",
    "app.chat.toolNamespace": "Namespace",
    "app.chat.toolCallFailed": "Tool call failed.",
    "app.chat.output": "Output",
    "app.chat.noOutput": "No output yet",
    "hotkeyWindow.home.placeholder.unknownProject": "this project",
    "hotkeyWindow.home.placeholder.projectless": "Ask Codex anything locally",
    "hotkeyWindow.home.placeholder.cloud": "Ask Codex anything in the cloud",
    "hotkeyWindow.home.placeholder.worktree": "Ask Codex anything in a worktree in {project}",
    "hotkeyWindow.home.placeholder.local": "Ask Codex anything locally in {project}",
    "hotkeyWindow.home.taskMenu.startIn.projectlessTooltip": "Projectless chats run locally",
    "hotkeyWindow.home.taskMenu.startIn.disabledTooltip":
      "Initialize a git repo to start in cloud or worktree mode",
    "hotkeyWindow.home.taskMenu.label": "Task settings",
    "hotkeyWindow.home.taskMenu.project": "Project",
    "hotkeyWindow.home.taskMenu.startIn": "Start in",
    "hotkeyWindow.home.taskMenu.environment": "Environment",
    "hotkeyWindow.home.taskMenu.branch": "Branch",
    "hotkeyWindow.home.taskMenu.permissions": "Permissions",
    "composer.permissionsDropdown.default.label": "Default permissions",
    "composer.permissionsDropdown.default.optionLabel": "Default permissions",
    "composer.permissionsDropdown.default.tooltip": "Codex automatically runs commands in a sandbox",
    "composer.permissionsDropdown.guardianApproval.shortLabel": "Auto-review",
    "composer.permissionsDropdown.guardianApproval.tooltip":
      "Codex run commands in a sandbox and uses Auto-review for elevated requests. <link>Learn more</link>",
    "composer.permissionsDropdown.guardianApproval.disabled":
      "Auto-review requires default sandboxed permissions to be available in this workspace",
    "composer.mode.agentMode.guardianApprovals": "Auto-review",
    "composer.permissionsDropdown.fullAccess.label": "Full access",
    "composer.permissionsDropdown.fullAccess.optionLabel": "Full access",
    "composer.permissionsDropdown.agentMode.tooltip.fullAccess":
      "Codex has full access over your computer (elevated risk)",
    "composer.permissionsDropdown.fullAccess.disabled":
      "Full access is disabled by requirements.toml",
    "composer.permissionsDropdown.fullAccess.disabledGlobalDefault":
      "Full access cannot be used as the global default",
    "composer.permissionsDropdown.custom.label": "Custom",
    "composer.permissionsDropdown.custom.optionLabel": "Custom (config.toml)",
    "composer.permissionsDropdown.agentMode.tooltip.custom":
      "Codex uses the permission defined in config.toml",
    "composer.permissionsDropdown.disabled.requirements":
      "Permissions are locked by requirements.toml",
    "composer.permissionsDropdown.trigger.tooltip": "Change permissions",
    "composer.mode.agentMode.fullAccessConfirm.title": "Enable full access?",
    "composer.mode.agentMode.fullAccessConfirm.description":
      "When Codex runs with full access, it can edit any file on your computer and run commands with network, without your approval",
    "composer.mode.agentMode.fullAccessConfirm.caution":
      "Exercise caution when enabling full access. This significantly increases the risk of data loss, leaks, or unexpected behavior.",
    "composer.mode.agentMode.fullAccessConfirm.goBack": "Cancel",
    "composer.mode.agentMode.fullAccessConfirm.confirm": "Yes, continue anyway",
    "composer.remote.currentBranch": "{branch} (current)",
    "composer.remote.branch": "{branch}",
    "composer.remote.localWorkingTree": "Use local changes",
    "composer.remote.localFileStateHeading": "Local file state",
    "composer.remote.currentEditsSuffix.useLocal": "with local code changes",
    "composer.remote.branchStartingPoint": "What branch should this task start from?",
    "composer.remote.branchesSectionHeading": "Branches",
    "codex.composer.searchBranches": "Search branches",
    "composer.remote.errorLoadingBranches": "Error loading branches",
    "composer.remote.loadingMoreBranches": "Loading…",
    "composer.footer.branchSwitch.tooltip": "Switch branch",
    "composer.footer.branchSwitch.checkoutError": "Failed to switch branch: {message}",
    "composer.footer.branchSwitch.createBranchError": "Failed to create branch: {message}",
    "composer.footer.branchSwitch.uncommittedSummaryPrefix":
      "Uncommitted: {fileCount, plural, one {# file} other {# files}}",
    "composer.footer.branchSwitch.createAndCheckout.disabledTooltip":
      "Commit changes to create and checkout a new branch",
    "composer.footer.branchSwitch.createAndCheckout": "Create and checkout new branch…",
    "composer.footer.branchSwitch.createDialog.title": "Create and checkout branch",
    "composer.footer.branchSwitch.createDialog.placeholder": "new-branch",
    "composer.footer.branchSwitch.createDialog.ariaLabel": "Branch name",
    "composer.footer.branchSwitch.createDialog.trailingSlashError":
      "Branch name cannot end with “/”.",
    "composer.footer.branchSwitch.createDialog.branchExistsError": "Branch already exists.",
    "composer.footer.branchSwitch.createDialog.close": "Close",
    "composer.footer.branchSwitch.createDialog.createAndCheckout": "Create and checkout",
    "composer.footer.branchSwitch.uncommittedDialog.title": "Commit changes to switch branch",
    "composer.footer.branchSwitch.uncommittedDialog.conflict.bodyPrefix":
      "Your changes to the following files would be overwritten by checkout:",
    "composer.footer.branchSwitch.uncommittedDialog.conflict.bodySuffix":
      "Please commit your changes to continue",
    "composer.footer.branchSwitch.uncommittedDialog.body.noDiff":
      "Commit changes in {fileCount, plural, one {# file} other {# files}} to check out {branchName}.",
    "composer.footer.branchSwitch.uncommittedDialog.targetBranchFallback": "the selected branch",
    "composer.footer.branchSwitch.uncommittedDialog.cancel": "Cancel",
    "composer.footer.branchSwitch.uncommittedDialog.commit": "Commit and switch branch…",
    "composer.footer.branchSwitch.commitDialog.title": "Commit changes",
    "composer.footer.branchSwitch.commitDialog.subtitle":
      "Commit your current changes, then Codex will continue switching to {branchName}.",
    "composer.footer.branchSwitch.commitDialog.messageLabel": "Commit message",
    "composer.footer.branchSwitch.commitDialog.messagePlaceholder": "Describe the current changes",
    "composer.footer.branchSwitch.commitDialog.cancel": "Cancel",
    "composer.footer.branchSwitch.commitDialog.commit": "Commit changes",
    "composer.contextWindowUsageLabel": "Context window:",
    "composer.contextWindowUsageStatusFull": "{usage}% full",
    "composer.contextWindowUsageStatusLeft": "{usage}% used ({remaining}% left)",
    "composer.contextWindowUsageTooltip": "{usedTokens}k / {contextWindow}k tokens used",
    "composer.contextWindow.usagePercent": "{usage}%",
    "composer.contextWindow.autoCompactionTooltipLine1": "Codex automatically compacts its context",
    "composer.pendingThreadGoal.summary": "Goal",
    "composer.pendingThreadGoal.editTooltip": "Edit goal",
    "composer.pendingThreadGoal.edit": "Edit goal",
    "composer.pendingThreadGoal.clearTooltip": "Clear goal",
    "composer.pendingThreadGoal.clear": "Clear goal",
    "composer.threadGoalEditor.editTitle": "Edit goal",
    "composer.threadGoalEditor.createTitle": "Set goal",
    "composer.threadGoalEditor.objectiveAriaLabel": "Goal objective",
    "composer.threadGoalEditor.objectivePlaceholder": "What should Codex keep working toward?",
    "composer.threadGoalEditor.useDraft": "Use draft",
    "composer.threadGoalEditor.cancel": "Cancel",
    "composer.threadGoalEditor.save": "Save goal",
    "composer.threadGoalEditor.set": "Set goal",
    "composer.threadGoal.editTooltip": "Edit goal",
    "composer.threadGoal.edit": "Edit goal",
    "composer.threadGoal.pauseTooltip": "Pause goal",
    "composer.threadGoal.pause": "Pause goal",
    "composer.threadGoal.resumeTooltip": "Resume goal",
    "composer.threadGoal.resume": "Resume goal",
    "composer.threadGoal.clearTooltip": "Clear goal",
    "composer.threadGoal.clear": "Clear goal",
    "composer.threadGoal.expand": "Expand goal details",
    "composer.threadGoal.collapse": "Collapse goal details",
    "composer.threadGoal.summary.active": "Goal",
    "composer.threadGoal.summary.paused": "Goal paused",
    "composer.threadGoal.summary.budgetLimited": "Goal limited",
    "composer.threadGoal.summary.complete": "Goal complete",
    "composer.threadGoal.status.active": "Active",
    "composer.threadGoal.status.paused": "Paused",
    "composer.threadGoal.status.budgetLimited": "Limited by budget",
    "composer.threadGoal.status.complete": "Complete",
    "composer.threadGoal.tokenUsage": "{used} / {budget} tokens",
    "composer.threadGoal.setError": "Failed to set goal",
    "composer.threadGoal.statusUpdateError": "Failed to update goal",
    "composer.threadGoal.clearError": "Failed to clear goal",
    "localConversation.sync.modal.noChanges": "No changes",
    "review.commit.form.title": "Commit your changes",
    "review.commit.form.commitTo": "Branch",
    "review.commit.form.commitTo.none": "-",
    "review.commit.form.changesToBeCommitted": "Changes",
    "review.commit.messageLabel": "Commit message",
    "review.commit.messagePlaceholder": "Leave blank to autogenerate a commit message",
    "review.commit.customInstructionsLink": "Custom instructions",
    "review.commit.includeUnstaged": "Include unstaged",
    "review.commit.ariaLabel.includeUnstaged": "Include unstaged",
    "review.commit.loading.title.createDraftPr": "Creating a draft PR",
    "review.commit.loading.title.createPr": "Creating a PR",
    "review.commit.form.continue": "Continue",
    "review.commit.rows.fileCount": "{count, plural, one {# file} other {# files}}",
    "review.commit.generate.emptyResponse": "Couldn't generate a commit message.",
    "review.commit.generate.failed": "Failed to generate commit message: {error}",
    "localConversationPage.createPullRequestError": "Failed to create pull request",
    "localConversationPage.createDraftPullRequestButtonLabel": "Create draft PR",
    "localConversationPage.createPullRequestButtonLabel": "Create PR",
    "localConversation.syncSetup.branchName": "Branch name",
    "localConversation.syncSetup.setPrefix": "Set prefix",
    "localConversation.syncSetup.branchesLoading": "Loading branches…",
    "localConversation.syncSetup.noBranches": "No branches found",
    "composer.reviewMode.branches.error": "Unable to load branches",
    "composer.reviewMode.branches.retry": "Retry",
    "review.commit.buttonLabel": "Commit",
    "localConversation.gitActions.createBranch": "Create branch",
    "localConversationPage.gitActions": "Git actions",
    "localConversation.pullRequest.actions.viewPr": "View PR",
    "localConversation.pullRequest.actions.statusTitle": "PR status",
    "review.gitActions.prStatus.loading": "Loading PR status…",
    "review.gitActions.prStatus.notInstalled": "GitHub CLI not installed",
    "review.gitActions.prStatus.notAuthenticated": "GitHub CLI not authenticated",
    "review.gitActions.prStatus.notAuthenticatedHint": "Check your GitHub CLI auth and try again",
    "review.gitActions.prStatus.noBranch": "No branch selected",
    "review.gitActions.prStatus.loadError": "Couldn’t load pull request",
    "review.gitActions.prStatus.available": "Pull request available",
    "review.gitActions.prStatus.none": "No open PR for this branch",
    "review.gitActions.prState.draft": "Draft pull request",
    "review.gitActions.prState.merged": "Merged",
    "review.gitActions.prState.checksFailing": "Checks failing",
    "review.gitActions.prState.checksInProgress": "Checks in progress",
    "review.gitActions.prState.changesRequested": "Changes requested",
    "review.gitActions.prState.approved": "Approved",
    "review.gitActions.prState.ready": "Ready",
    "app.chat.exitCode": "Exit code",
    "app.chat.durationMs": "Duration (ms)",
    "app.chat.movedTo": "Moved to",
    "app.chat.status.inProgress": "In progress",
    "app.chat.status.completed": "Completed",
    "app.chat.status.failed": "Failed",
    "app.chat.status.declined": "Declined",
    "app.chat.approval.commandTitle": "Command approval",
    "app.chat.approval.fileChangeTitle": "File change approval",
    "app.chat.approval.review": "Review and respond to continue this turn.",
    "app.chat.approval.reason": "Reason",
    "app.chat.approval.command": "Command",
    "app.chat.approval.workingDirectory": "Working directory",
    "app.chat.approval.networkAccess": "Requested network access",
    "app.chat.approval.protocol": "Protocol",
    "app.chat.approval.host": "Host",
    "app.chat.approval.commandActions": "Parsed command actions",
    "app.chat.approval.additionalPermissions": "Requested additional permissions",
    "app.chat.approval.execPolicyAmendment": "Suggested future command allowance",
    "app.chat.approval.networkPolicyAmendments": "Suggested future network rules",
    "app.chat.approval.requestedWriteRoot": "Requested write root",
    "app.chat.approval.changes": "Changes",
    "app.chat.approval.noChanges": "No file changes were attached to this request.",
    "app.chat.approval.accept": "Accept",
    "app.chat.approval.acceptForSession": "Accept for session",
    "app.chat.approval.decline": "Decline",
    "app.chat.approval.cancel": "Cancel",
    "app.chat.approval.submitting": "Submitting response...",
    "app.chat.implementPlan.prompt": "Implement this plan?",
    "app.chat.implementPlan.implement": "Yes, implement this plan",
    "app.chat.implementPlan.otherPlaceholder": "No, and tell Codex what to do differently",
    "app.chat.implementPlan.dismiss": "Dismiss",
    "app.chat.implementPlan.submit": "Submit",
    "app.chat.planImplementation": "Implement plan",
    "app.chat.userInput.title": "User input requested",
    "app.chat.userInput.submit": "Submit answers",
    "app.chat.userInput.otherHint": "Other answers may be entered manually if needed.",
    "app.chat.userInput.secretHint": "This answer may contain sensitive input.",
    "app.chat.userMessage.autoResolveSync": "Auto resolve conflicts",
    "app.chat.userMessage.commentCount": "{count, plural, one {# comment} other {# comments}}",
    "app.chat.userMessage.copyAriaLabel": "Copy message",
    "app.chat.userMessage.copyCopiedAriaLabel": "Copied",
    "app.chat.userMessage.copyCopiedTooltip": "Copied",
    "app.chat.userMessage.copyTooltip": "Copy",
    "app.chat.userMessage.editAriaLabel": "Edit message",
    "app.chat.userMessage.editTooltip": "Edit",
    "app.chat.userMessage.editTextareaAriaLabel": "Edit message",
    "app.chat.userMessage.editPlaceholder": "Edit message",
    "app.chat.userMessage.cancelEditMessage": "Cancel",
    "app.chat.userMessage.sendEditedMessage": "Send",
    "app.chat.userMessage.goal": "Goal",
    "app.chat.userMessage.showLess": "Show less",
    "app.chat.userMessage.showMore": "Show more",
    "app.chat.userMessage.implementPlan": "Implement plan",
    "app.chat.userMessage.noContent": "(No content)",
    "app.chat.userMessage.pullRequestCheckCount": "{count, plural, one {# CI test} other {# CI tests}}",
    "app.chat.userMessage.pullRequestFixMode": "PR fix",
    "app.chat.userMessage.pullRequestMergeTask": "PR #{number}",
    "app.chat.userMessage.referencesPriorConversation": "References prior conversation",
    "app.chat.userMessage.reviewMode": "Review mode",
    "app.chat.latestTurnPreview.items": "{count, plural, one {# item} other {# items}}",
    "app.chat.permissions.title": "Permissions request",
    "app.chat.permissions.network": "Network",
    "app.chat.permissions.networkEnabled": "This request asks for network access.",
    "app.chat.permissions.fileSystem": "File system",
    "app.chat.permissions.read": "Read access",
    "app.chat.permissions.write": "Write access",
    "app.chat.permissions.entries": "Detailed entries",
    "app.chat.permissions.strictAutoReview": "Review subsequent commands in this turn before execution",
    "app.chat.permissions.grantTurn": "Grant for turn",
    "app.chat.permissions.grantSession": "Grant for session",
    "app.chat.permissions.deny": "Deny",
    "app.chat.mcpElicitation.title": "{serverName} request",
    "app.chat.mcpElicitation.url": "Open URL",
    "app.chat.mcpElicitation.accept": "Accept",
    "app.chat.mcpElicitation.decline": "Decline",
    "app.chat.mcpElicitation.cancel": "Cancel",
    "app.chat.mcpElicitation.submit": "Submit response",
    "app.chat.mcpElicitation.required": "Required",
    "app.chat.mcpElicitation.booleanEnabled": "Enable this option",
    "app.chat.mcpElicitation.unsupportedField": "This field type is not fully supported yet. The raw schema is shown for review.",
    "localConversation.scrollToBottomButton": "Scroll to bottom",
    "composer.latestTurn": "Latest turn",
    "composer.latestTurn.working": "Working",
    "composer.reviewMode.title": "Code review",
    "composer.reviewMode.option.unstaged.simple": "Review uncommitted changes",
    "thinkingShimmer.default": "Thinking",
    "wham.whamProposedTask.title": "Suggested task",
    "localConversation.planSummary.title": "Plan",
    "localConversation.planSummary.titleWriting": "Writing plan",
    "localConversation.planSummary.download": "Download plan",
    "localConversation.planSummary.copy": "Copy plan",
    "localConversation.planSummary.openInNewWindow": "Open",
    "localConversation.planSummary.expand": "Expand plan summary",
    "localConversation.planSummary.collapse": "Collapse plan summary",
    "localConversation.planSummary.viewPlan": "Expand plan",
    "avatarOverlay.session.readFile": "Read {fileName}",
    "avatarOverlay.session.readingFile": "Reading {fileName}",
    "avatarOverlay.session.listedFiles": "Listed files",
    "avatarOverlay.session.listingFiles": "Listing files",
    "avatarOverlay.session.searchedFiles": "Searched files",
    "avatarOverlay.session.searchedQuery": "Searched “{query}”",
    "avatarOverlay.session.searchingFiles": "Searching files",
    "avatarOverlay.session.searchingQuery": "Searching “{query}”",
    "avatarOverlay.session.searchedWeb": "Searched the web",
    "codex.webSearch.summary": "{label}{details}",
    "codex.webSearch.summary.details": " for {query}",
    "codex.webSearch.summary.verb.completed": "Searched web",
    "codex.webSearch.summary.verb.inProgress": "Searching the web",
    "avatarOverlay.session.calledToolName": "Called {toolName}",
    "thread.browser.emptyState.title": "Start browsing",
    "thread.browser.emptyState.description": "Enter a URL to open a page",
    "codex.remoteConversation.codexCloudTask": "You are viewing a <u>Codex cloud</u> task",
    "codex.remoteConversation.viewPreviousTurns": "Open in web",
    "codex.remoteConversation.viewPreviousTurns.buttonTooltip": "Open in web",
    "codex.remoteConversation.viewPreviousTurns.buttonText": "Open",
    "codex.remoteConversation.openInWeb": "Open in web",
    "codex.remoteConversation.errorWithMessage": "Error: {message}",
    "remoteConversation.environmentSetup.failed": "Environment setup failed",
    "remoteConversation.environmentSetup.running": "Setting up environment",
    "remoteConversation.environmentSetup.output.empty": "Waiting for output…",
    "codex.remoteConversation.userImageAttachment": "User attachment",
    "codex.remoteConversation.closeImagePreview": "Close image preview",
    "codex.remoteConversation.loadingImage": "Loading image",
    "codex.localConversation.userImageAttachment": "User attachment",
    "codex.localConversation.closeImagePreview": "Close image preview",
    "imagePreviewDialog.label": "Image preview",
    "imagePreviewDialog.close": "Close image preview",
    "imagePreviewDialog.download": "Download image",
    "imagePreviewDialog.zoomIn": "Zoom in image",
    "imagePreviewDialog.zoomOut": "Zoom out image",
    "imagePreviewDialog.previousImage": "Previous image",
    "imagePreviewDialog.nextImage": "Next image",
    "artifactPdfPreview.annotate": "Annotate",
    "artifactPdfPreview.annotating": "Annotating",
    "artifactPdfPreview.commentInput": "PDF annotation",
    "artifactPdfPreview.commentMarkerLabel": "PDF annotation {commentNumber}",
    "markdown.videoPlayer": "Video",
    "markdown.videoUnavailable": "Video unavailable",
    "markdown.imagePreviewButton": "Open image preview",
    "markdown.imageUnavailable": "Image unavailable",
    "markdown.imageLoading": "Image loading",
    "codex.remoteConversation.taskFailed": "Task failed",
    "codex.remoteConversation.turnFailed": "An error occurred during this task",
    "codex.remoteConversation.turnTab.title": "Attempt {number}",
    "codex.remoteConversation.turnTab.loading": "Attempt {number}",
    "codex.remoteConversation.applyDiff.apply": "Apply",
    "codex.remoteConversation.applyDiff.revert": "Revert",
    "codex.remoteConversation.applyDiff.dropdownTitle": "Apply changes to a local branch",
    "codex.remoteConversation.applyDiff.applyCta": "Apply changes",
    "codex.remoteConversation.applyDiff.revertCta": "Revert changes",
    "codex.applyDropdown.header.title": "Apply changes",
    "codex.applyDropdown.header.changes": "Changes",
    "codex.applyDropdown.header.fileCount": "{count, plural, one {# file} other {# files}}",
    "codex.applyDropdown.header.rows": "rows",
    "codex.applyDropdown.header.workspace": "Project",
    "codex.applyDropdown.results.empty": "No files were copied",
    "codex.applyDropdown.results.skipped": "{count, plural, one {1 file skipped:} other {{count} files skipped:}}",
    "codex.applyDropdown.results.conflicted": "{count, plural, one {1 file conflicted:} other {{count} files conflicted:}}",
    "codex.applyOrRevertBanner.apply": "Apply",
    "codex.applyOrRevertBanner.reapply": "Reapply",
    "codex.applyOrRevertBanner.revert": "Revert",
    "codex.applyOrRevertBanner.applyMessage": "Apply changes and continue locally?",
    "codex.applyOrRevertBanner.revertMessage": "Revert applied changes?",
    "codex.applyOrRevertBanner.applyMessageDifferentEnvironment": "This task was made in {environment} so may not apply cleanly.",
    "codex.applyOrRevertBanner.applyMessageDifferentEnvironment.tooltip": "Changes made in {environment} so may not apply cleanly.",
    "codex.applyResultsDialog.title": "Apply results",
    "codex.applyResultsDialog.applied": "Applied cleanly ({count})",
    "codex.applyResultsDialog.conflicted": "Conflicted ({count})",
    "codex.applyResultsDialog.skipped": "Skipped ({count})",
    "codex.applyResultsDialog.notGitRepo": "This action only works when running in a Git repository.",
    "codex.applyResultsDialog.noDetails": "No file details available.",
    "codex.applyResultsDialog.close": "Close",
    "codex.diffView.applyPatchNotGitRepo": "Couldn’t apply changes: not a git repository",
    "codex.diffView.revertPatchNotGitRepo": "Couldn’t revert changes: not a git repository",
    "codex.diffView.applyPatchSuccess": "Applied changes",
    "codex.diffView.revertPatchSuccess": "Reverted changes",
    "codex.diffView.applyPatchPartialSuccess": "Applied some changes",
    "codex.diffView.revertPatchPartialSuccess": "Reverted some changes",
    "codex.diffView.applyPatchError": "Couldn’t apply changes",
    "codex.diffView.revertPatchError": "Couldn’t revert changes",
    "localConversation.remoteTaskCreated": "Created {taskLink} in Codex Cloud",
    "localConversation.remoteTaskCreated.task": "task",
    "localConversation.dynamicToolCall": "{toolName}",
    "localConversation.appControlToolCall.appHelp.active": "Checking thread actions",
    "localConversation.appControlToolCall.appHelp.completed": "Checked thread actions",
    "localConversation.appControlToolCall.threadsCreate.active": "Creating new thread",
    "localConversation.appControlToolCall.threadsCreate.completed": "Created new thread",
    "localConversation.appControlToolCall.threadsCreateInWorktree.active": "Creating worktree thread",
    "localConversation.appControlToolCall.threadsCreateInWorktree.completed": "Created worktree thread",
    "localConversation.appControlToolCall.threadsList.active": "Listing threads",
    "localConversation.appControlToolCall.threadsList.completed": "Listed threads",
    "localConversation.appControlToolCall.threadsRead.active": "Reading thread",
    "localConversation.appControlToolCall.threadsRead.completed": "Read thread",
    "localConversation.appControlToolCall.threadsSendMessage.active": "Sending message to thread",
    "localConversation.appControlToolCall.threadsSendMessage.completed": "Sent message to thread",
    "localConversation.appControlToolCall.threadsSetArchived.active": "Updating thread archive",
    "localConversation.appControlToolCall.threadsSetArchived.completed": "Updated thread archive",
    "localConversation.appControlToolCall.threadsSetPinned.active": "Updating thread pin",
    "localConversation.appControlToolCall.threadsSetPinned.completed": "Updated thread pin",
    "localConversation.appControlToolCall.threadsSetTitle.active": "Renaming thread",
    "localConversation.appControlToolCall.threadsSetTitle.completed": "Renamed thread",
    "localConversation.header.heartbeatAutomationNextRun": "Next run: {nextRunLabel}",
    "localConversation.header.openHeartbeatAutomation": "Open heartbeat automation",
    "localConversation.multiAgentAction.header": "{action}{countLabel}",
    "localConversation.multiAgentAction.header.count":
      " {count, plural, one {# agent} other {# agents}}",
    "localConversation.multiAgentAction.header.close.completed": "Closed",
    "localConversation.multiAgentAction.header.close.failed": "Failed to close",
    "localConversation.multiAgentAction.header.close.inProgress": "Closing",
    "localConversation.multiAgentAction.header.resume.completed": "Resumed",
    "localConversation.multiAgentAction.header.resume.failed": "Failed to resume",
    "localConversation.multiAgentAction.header.resume.inProgress": "Resuming",
    "localConversation.multiAgentAction.header.sendInput.completed": "Messaged",
    "localConversation.multiAgentAction.header.sendInput.failed": "Failed to message",
    "localConversation.multiAgentAction.header.sendInput.inProgress": "Messaging",
    "localConversation.multiAgentAction.header.spawn.completed": "Spawned",
    "localConversation.multiAgentAction.header.spawn.failed": "Failed to spawn",
    "localConversation.multiAgentAction.header.spawn.inProgress": "Spawning",
    "localConversation.multiAgentAction.row.generic": "{action}",
    "localConversation.multiAgentAction.row.agent": "{action} {agent}{stateSuffix}",
    "localConversation.multiAgentAction.row.spawn.createdWithInstructions":
      "Created {agent} with the instructions: {instructions}",
    "localConversation.multiAgentAction.row.sendInput.messagedWithPrompt":
      "{action} {agent}: {prompt}",
    "localConversation.multiAgentAction.rowAction.close.completed": "Closed",
    "localConversation.multiAgentAction.rowAction.close.failed": "Failed closing",
    "localConversation.multiAgentAction.rowAction.close.inProgress": "Closing",
    "localConversation.multiAgentAction.rowAction.resume.completed": "Resumed",
    "localConversation.multiAgentAction.rowAction.resume.failed": "Failed resuming",
    "localConversation.multiAgentAction.rowAction.resume.inProgress": "Resuming",
    "localConversation.multiAgentAction.rowAction.sendInput.completed": "Messaged",
    "localConversation.multiAgentAction.rowAction.sendInput.failed": "Failed messaging",
    "localConversation.multiAgentAction.rowAction.sendInput.inProgress": "Messaging",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.completed": "Messaged",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.failed": "Failed to message",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.inProgress": "Messaging",
    "localConversation.multiAgentAction.rowAction.spawn.completed": "Spawned",
    "localConversation.multiAgentAction.rowAction.spawn.failed": "Failed spawning",
    "localConversation.multiAgentAction.rowAction.spawn.inProgress": "Spawning",
    "localConversation.multiAgentAction.meta.prompt": "Input: {prompt}",
    "localConversation.multiAgentAction.agentState.pendingInit": "pending init",
    "localConversation.multiAgentAction.agentState.running": "running",
    "localConversation.multiAgentAction.agentState.interrupted": "interrupted",
    "localConversation.multiAgentAction.agentState.shutdown": "shutdown",
    "localConversation.multiAgentAction.agentState.completed": "completed",
    "localConversation.multiAgentAction.agentState.errored": "errored",
    "localConversation.multiAgentAction.agentState.notFound": "not found",
    "localConversation.personalityChanged": "Switched to {personality} personality",
    "localConversation.autoReviewInterruptionWarning": "Turn ended by Auto-review",
    "localConversation.autoReviewInterruptionWarning.nextSteps":
      "Auto-review stopped this turn after repeated denials. Add more context or choose a different permission mode to continue.",
    "localConversation.automaticApprovalReview.summary.inProgress":
      "A carefully prompted reviewer agent is reviewing this request before Codex runs it.",
    "localConversation.automaticApprovalReview.summary.aborted":
      "A carefully prompted reviewer agent stopped reviewing this request before Codex ran it.",
    "localConversation.automaticApprovalReview.summary.timedOut":
      "A carefully prompted reviewer agent timed out before Codex ran this request.",
    "localConversation.automaticApprovalReview.summary.completed":
      "A carefully prompted reviewer agent reviewed this request.",
    "localConversation.automaticApprovalReview.title.inProgress": "Auto-reviewing",
    "localConversation.automaticApprovalReview.title.approved": "Auto-review approved",
    "localConversation.automaticApprovalReview.title.denied": "Auto-review denied",
    "localConversation.automaticApprovalReview.title.deniedHighRisk":
      "Auto-review denied high risk",
    "localConversation.automaticApprovalReview.title.timedOut": "Auto-review timed out",
    "localConversation.automaticApprovalReview.title.aborted": "Auto-review stopped",
    "localConversation.modelChanged": "Model changed from {fromModel} to {toModel}.",
    "localConversation.modelChanged.warning.line1":
      "Changing models mid-conversation will degrade performance.",
    "localConversation.modelChanged.warning.line2": "Context may automatically compact.",
    "localConversation.parentThread": "Parent chat",
    "localConversation.forkedFromConversation": "Forked from conversation",
    "codex.localConversation.comment.screenshotAttached": "Screenshot attached",
    "codex.localConversation.pdfComment.annotationAttached": "PDF annotation attached",
    "codex.localConversation.browserComment.selectedElement": "Selected page element",
    "codex.localConversation.diffCommentLeftSide": "L",
    "codex.localConversation.diffCommentRightSide": "R",
    "localConversation.modelRerouted": "Your request was routed to {toModel}.",
    "localConversation.modelRerouted.warning.line1":
      "Heads up, your request was re-routed to reduce cyber-abuse risk.",
    "localConversation.modelRerouted.warning.line2":
      "Think this is a mistake? Request a review at <link>chatgpt.com/cyber</link> or report via /feedback",
    "codex.review.noDiff": "No file changes yet",
    "codex.review.noDiff.baseDescription": "Changes in this project will appear here.",
    "codex.review.noDiff.orNoLongerAvailable": "The latest diffs are no longer available.",
    "codex.review.noDiff.gitRepoRequired.title": "Create a Git repository",
    "codex.review.noDiff.gitRepoRequired.description": "Track, review, and undo changes in this project.",
    "codex.review.noDiff.gitInit.success": "Git repository created",
    "codex.review.noDiff.gitInit.createRepository": "Create git repository",
    "codex.review.noDiff.gitInit.creating": "Creating…",
    "codex.review.noDiff.gitInit.error": "Git init failed: {message}",
    "codex.review.header.moreOptions": "Review options",
    "codex.review.wrap.enable": "Enable word wrap",
    "codex.review.wrap.disable": "Disable word wrap",
    "codex.review.expandOrCollapseDiffMenu.collapse": "Collapse all diffs",
    "codex.review.expandOrCollapseDiffMenu.expand": "Expand all diffs",
    "codex.review.loadFullFiles.enable": "Load full files",
    "codex.review.loadFullFiles.disable": "Don't load full files",
    "codex.review.diff.fullContentLoadFailed": "Full file content failed to load",
    "codex.common.retry": "Retry",
    "dictation.error.connection": "Check your connection and try again",
    "dictation.error.microphoneMissing": "Connect a microphone to use dictation",
    "dictation.error.microphonePermissionDenied": "Allow microphone access to use dictation",
    "dictation.error.microphoneUnavailable": "Close other apps using the microphone",
    "dictation.error.unsupported": "Dictation is not available on this device",
    "composer.dictation.startError": "Unable to start dictation",
    "composer.dictation.transcribeError": "Unable to transcribe audio",
    "globalDictation.dismissError": "Dismiss",
    "globalDictation.listening": "Listening",
    "globalDictation.retry": "Retry",
    "globalDictation.transcribing": "Transcribing…",
    "globalDictation.waveformAriaLabel": "Global dictation waveform",
    "codex.review.richPreview.enable": "Enable rich preview",
    "codex.review.richPreview.disable": "Disable rich preview",
    "codex.review.wordDiffs.enable": "Enable word diffs",
    "codex.review.wordDiffs.disable": "Disable word diffs",
    "codex.review.whitespace.show": "Show white space",
    "codex.review.whitespace.hide": "Hide white space",
    "codex.review.copyGitApplyCommand": "Copy git apply command",
    "codex.review.copyGitApplyCommand.toast": "Copied git apply command to the clipboard",
    "codex.review.switchToSplit": "Switch to split diff",
    "codex.review.switchToUnified": "Switch to unified diff",
    "codex.review.refreshGitQueries": "Refresh",
    "codex.unifiedDiff.reviewChanges": "Review changes",
    "thread.sidePanel.browserTab": "Browser",
    "thread.sidePanel.diffTab": "Review",
    "thread.sidePanel.empty.title": "Nothing here yet",
    "thread.sidePanel.openFile": "Open file",
    "thread.sidePanel.openBrowserTab": "Browser",
    "thread.sidePanel.openReviewTab": "Review",
    "thread.sidePanel.openTab": "Open side panel tab",
    "thread.sidePanel.toggle": "Toggle side panel",
    "codex.rightPanel.expandFullWidth": "Expand panel",
    "codex.rightPanel.restoreWidth": "Restore panel width",
    "codex.tabs.closeNamed": "Close {title} tab",
    "codex.tabs.contextMenu.close": "Close tab",
    "thread.fileCommandMenu.filesGroup": "Files",
    "thread.fileCommandMenu.searchFiles": "Search files",
    "threadSidePanel.workspaceBrowser.loading": "Loading directory entries…",
    "threadSidePanel.workspaceBrowser.empty": "No files in this folder",
    "codex.fileTreeSearch.label": "Filter files",
    "codex.fileTreeSearch.placeholder": "Filter files…",
    "codex.fileTreeSearch.clear": "Clear file filter",
    "codex.review.fileSearch.empty": "No matching files",
    "thread.fileTreePanel.noMatchingFiles": "No matching files",
    "thread.fileTreePanel.searchingFiles": "Searching files...",
    "review.fileSource.breadcrumb.ariaLabel": "File path",
    "review.fileSource.breadcrumb.openInEditor.ariaLabel": "Open in editor",
    "review.fileSource.breadcrumb.openInEditor.tooltip": "Open in editor",
    "review.fileSource.options": "File viewer options",
    "review.fileSource.copyPath": "Copy path",
    "review.fileSource.error": "Unable to load file",
    "review.fileSource.loading": "Loading file…",
    "review.fileSource.tooLarge": "File is too large to preview",
    "review.fileSource.tooLargeDetail": "{size} exceeds the {limit} preview limit",
    "review.fileSource.unsupported.archive": "Archive previews aren't supported yet",
    "review.fileSource.unsupported.audio": "Audio previews aren't supported yet",
    "review.fileSource.unsupported.excelSpreadsheet": "Excel spreadsheet previews aren't supported yet",
    "review.fileSource.unsupported.keynoteDeck": "Keynote deck previews aren't supported yet",
    "review.fileSource.unsupported.numbersSpreadsheet": "Numbers spreadsheet previews aren't supported yet",
    "review.fileSource.unsupported.opendocumentPresentation": "OpenDocument presentation previews aren't supported yet",
    "review.fileSource.unsupported.opendocumentSpreadsheet": "OpenDocument spreadsheet previews aren't supported yet",
    "review.fileSource.unsupported.opendocumentText": "OpenDocument text previews aren't supported yet",
    "review.fileSource.unsupported.pagesDocument": "Pages document previews aren't supported yet",
    "review.fileSource.unsupported.powerpointDeck": "PowerPoint deck previews aren't supported yet",
    "review.fileSource.unsupported.richTextDocument": "Rich Text document previews aren't supported yet",
    "review.fileSource.unsupported.video": "Video previews aren't supported yet",
    "review.fileSource.unsupported.wordDocument": "Word document previews aren't supported yet",
    "review.fileSource.unsupportedDetail": "Open this file outside Codex to view it",
    "review.fileSource.richPreview.enable": "Enable rich view",
    "review.fileSource.richPreview.disable": "Disable rich view",
    "review.fileSource.wrap.enable": "Enable word wrap",
    "review.fileSource.wrap.disable": "Disable word wrap",
    "codex.filePreview.pdb.empty": "No PDB atoms found",
    "codex.filePreview.pdb.modelSelectLabel": "Select PDB model",
    "codex.filePreview.pdb.modelOption": "Model {modelNumber}",
    "codex.filePreview.pdb.resetView": "Reset view",
    "codex.filePreview.pdb.residueCount": "{count, number} residues",
    "codex.filePreview.pdb.atomCount": "{count, number} atoms",
    "codex.filePreview.pdb.scoreSummary": "B-factor/pLDDT {mean}",
    "codex.filePreview.pdb.viewerLabel": "Interactive PDB structure viewer",
    "codex.filePreview.pdb.viewerLoadError": "Unable to load the 3Dmol PDB viewer",
    "codex.filePreview.pdb.legendVeryHigh": "90+",
    "codex.filePreview.pdb.legendConfident": "70-90",
    "codex.filePreview.pdb.legendLow": "50-70",
    "codex.filePreview.pdb.legendVeryLow": "<50",
    "codex.filePreview.pdb.interactionHint": "Drag to rotate. Scroll to zoom.",
    "codex.filePreview.pdb.chainSelectLabel": "Select PDB chain",
    "codex.filePreview.pdb.chainLabel": "Chain {chainId}",
    "codex.filePreview.pdb.chainOption": "Chain {chainId} ({count, number} residues)",
    "codex.filePreview.pdb.sequenceResidueCount": "{count, number} coordinate residues",
    "codex.filePreview.pdb.selectedResidues": "Selected {range}",
    "codex.filePreview.pdb.sequenceLabel": "PDB chain sequence",
    "codex.filePreview.pdb.residueLabel": "{residueName} {residueNumber} in chain {chainId}",
    "codex.filePreview.pdb.residueTitle": "{residueName} {residueNumber}",
    "artifactTab.preview.exitPresentation": "Exit",
    "artifactTab.preview.nextPage": "Next page",
    "artifactTab.preview.open": "Open",
    "artifactTab.preview.pageIndicator": "{current}/{total}",
    "artifactTab.preview.previousPage": "Previous page",
    "artifactTab.preview.zoomPercent": "{zoomPercent}%",
    "artifactTab.preview.zoomToFit": "Zoom to fit",
    "markdown.externalLink.openInBrowser": "Open in browser",
    "markdown.externalLink.openInExternalBrowser": "Open in external browser",
    "markdown.externalLink.copyLink": "Copy link",
    "markdown.fileReference.openInTarget": "Open in {target}",
    "markdown.fileReference.viewInCodexBrowser": "View in browser",
    "markdown.fileReference.viewFile": "Open file",
    "markdown.fileReference.openWith": "Open with",
    "markdown.fileReference.openWithTarget": "{target}",
    "markdown.fileReference.copyPath": "Copy path",
    "markdown.fileReference.openInFinder": "Open in Finder",
    "markdown.fileReference.openInExplorer": "Open in Explorer",
    "markdown.fileReference.openInFileManager": "Open in File Manager",
    "mermaidDiagram.fitToWidth": "Fit diagram to width",
    "mermaidDiagram.viewActualSize": "View actual size",
    "mermaidDiagram.copySource": "Copy mermaid",
    "mermaidDiagram.ariaLabel": "Mermaid diagram",
    "mermaidDiagram.originalCode": "Mermaid source code",
    "artifactTab.previewError": "Couldn’t load this preview",
    "artifactTab.previewLoading": "Preparing preview…",
    "artifactTab.previewTooLarge": "This file is too large to preview in the side panel",
    "copyButton.copyAriaLabel": "Copy",
    "copyButton.copied": "Copied",
    "copyButton.copiedAriaLabel": "Copied",
    "copyButton.copyCode": "Copy code",
    "notebookPreview.cellCount": "{cellCount, plural, one {# cell} other {# cells}}",
    "notebookPreview.codeCellTitle": "Code cell {cellNumber}",
    "notebookPreview.codeDisclosure": "Code",
    "notebookPreview.empty": "This notebook does not contain any cells",
    "notebookPreview.emptyCodeCell": "Empty code cell",
    "notebookPreview.emptyMarkdownCell": "Empty Markdown cell",
    "notebookPreview.emptyUnknownCell": "Empty notebook cell",
    "notebookPreview.emptyRawCell": "Empty raw cell",
    "notebookPreview.errorOutput": "{name}: {message}",
    "notebookPreview.executionCount": "Run {executionCount}",
    "notebookPreview.htmlOutputTitle": "Notebook HTML output",
    "notebookPreview.imageOutputAlt": "Notebook output {outputNumber}",
    "notebookPreview.markdownCellTitle": "Markdown cell {cellNumber}",
    "notebookPreview.rawCellTitle": "Raw cell {cellNumber}",
    "notebookPreview.rawCodeTitle": "Raw",
    "notebookPreview.rawOutputDisclosure": "Raw output",
    "notebookPreview.readOnlyBadge": "Read only",
    "notebookPreview.restartKernelDisabled": "Restart kernel",
    "notebookPreview.restartKernelDisabledTooltip": "Kernels are not connected in this preview",
    "notebookPreview.runAllDisabled": "Run all",
    "notebookPreview.runAllDisabledTooltip": "Running is not available in this preview",
    "notebookPreview.runCellDisabledTooltip": "Running is disabled in read-only preview",
    "notebookPreview.cellPosition": "Cell {cellNumber} of {totalCellCount}",
    "notebookPreview.pythonCodeTitle": "Python",
    "artifactTab.sourceOptions": "Artifact viewer options",
    "artifactTab.sourceOptions.viewSource": "View source",
    "codex.diffView.failedToDecodeBase64Diff": "Couldn’t load this diff",
    "codex.diffView.filesChanged": "{fileCount, plural, one {# file changed} other {# files changed}}",
    "codex.diffView.linesAdded": "+{linesAdded}",
    "codex.diffView.linesDeleted": "-{linesDeleted}",
    "codex.diffView.noDiffData": "No diff available",
    "codex.diffView.richPreviewEnable": "Enable rich preview",
    "codex.diffView.richPreviewDisable": "Disable rich preview",
    "codex.diffView.richPreviewToggle": "Toggle rich preview",
    "codex.diffView.switchToSplit": "Switch to split diff",
    "codex.diffView.switchToUnified": "Switch to unified diff",
    "wham.diff.contextMenu.copyPath": "Copy path",
    "wham.diff.contextMenu.toggleWrap": "Toggle word wrap",
    "wham.diff.binaryFile": "Binary file not shown",
    "threadHeader.archiveConfirmCancel": "Cancel",
    "threadHeader.archiveConfirmConfirm": "Archive",
    "threadHeader.archiveConfirmHeartbeatConfirm": "Archive and remove",
    "threadHeader.archiveConfirmHeartbeatSubtitleNamed":
      "This chat has a running heartbeat automation: {name}. Archiving the chat will also remove this automation and stop future runs.",
    "threadHeader.archiveConfirmHeartbeatSubtitleUnnamed":
      "This chat has a running heartbeat automation. Archiving the chat will also remove this automation and stop future runs.",
    "threadHeader.archiveConfirmHeartbeatTitle": "Archive chat and remove automation?",
    "threadHeader.archiveConfirmSubtitle": "You can find it later in archived chats.",
    "threadHeader.archiveConfirmTitle": "Archive chat?",
    "threadHeader.addAutomation": "Add automation",
    "threadHeader.copyAppLink": "Copy deeplink",
    "threadHeader.copyConversationMarkdown": "Copy as Markdown",
    "threadHeader.copyConversationMarkdownError": "Failed to copy conversation as Markdown",
    "threadHeader.copyConversationMarkdownSuccess": "Copied conversation as Markdown",
    "threadHeader.copySessionId": "Copy session ID",
    "threadHeader.copyWorkingDirectory": "Copy working directory",
    "threadHeader.copyWorkingDirectoryError": "Failed to copy working directory",
    "threadHeader.copyWorkingDirectorySuccess": "Copied working directory",
    "threadHeader.editAutomation": "Edit automation",
    "threadHeader.forkIntoLocal": "Fork into local",
    "threadHeader.forkIntoWorktree": "Fork into new worktree",
    "threadHeader.forkPendingWorktreePrompt": "Fork this conversation into a new worktree.",
    "threadHeader.forkPendingWorktreeTitle": "Forked conversation",
    "threadHeader.forkThreadRequiresGitRepo": "Fork into new worktree requires a git repository",
    "threadHeader.forkIntoSameWorktree": "Fork into same worktree",
    "threadHeader.forkThreadError": "Failed to fork chat",
    "threadHeader.openInNewWindow": "Open in new window",
    "threadHeader.openSideChat": "Open side chat",
    "threadHeader.openSideChatError": "Failed to open side chat",
    "threadHeader.moreActions": "Chat actions",
    "sidebarElectron.markThreadUnread": "Mark as unread",
    "sidebarElectron.pinThread": "Pin chat",
    "sidebarElectron.unpinThread": "Unpin chat",
    "localConversation.sideChat.title": "Side chat",
    "localConversation.sideChat.numberedTitle": "Side chat {index}",
    "sidebarElectron.archiveThread": "Archive chat",
    "sidebarElectron.renameThread": "Rename chat",
    "sidebarElectron.renameThreadDialogAriaLabel": "Chat title",
    "sidebarElectron.renameThreadDialogCancel": "Cancel",
    "sidebarElectron.renameThreadDialogPlaceholder": "Add a title...",
    "sidebarElectron.renameThreadDialogSave": "Save",
    "sidebarElectron.renameThreadDialogSubtitle": "Keep it short and recognizable",
    "sidebarElectron.renameThreadDialogTitle": "Rename chat",
    "sidebarElectron.renameThreadError": "Failed to rename thread",
    "sidebarElectron.skillsAppsRouteNavLink": "Plugins",
    "sidebarElectron.skillsRouteNavLink": "Skills",
    "sidebarElectron.automationsRouteNavLink": "Automations",
    "sidebarElectron.pullRequestsRouteNavLink": "Pull requests",
    "sidebarElectron.pluginsRouteNavLink": "Plugins",
    "sidebarElectron.pluginsDisabledTooltip": "Please sign in with ChatGPT to use plugins",
    "sidebarElectron.noTasks": "No chats",
    "sidebarElectron.scratchpadNavLink": "Scratchpad",
    "inbox.mode.automations": "Automations",
    "inbox.automations.createError": "Could not create automation",
    "inbox.automations.updateError": "Could not update automation",
    "inbox.automations.loading": "Loading…",
    "inbox.automations.new": "New automation",
    "inbox.automations.current": "Current",
    "inbox.automations.sectionsNav": "Automation sections",
    "inbox.automations.pausedSection": "Paused",
    "inbox.automations.inProgress": "In progress",
    "inbox.automations.header.root": "Automations",
    "inbox.automations.details": "Details",
    "inbox.automations.nextRun.label": "Next run",
    "inbox.automations.nextRun.none": "Not scheduled",
    "inbox.automations.lastRun.label": "Last ran",
    "inbox.automations.lastRun.none": "-",
    "inbox.automations.missing": "Automation not found",
    "inbox.automations.missingBack": "Back to automations",
    "inbox.automations.missingSubtitle": "This automation may have been deleted or is no longer available on this device.",
    "inbox.automations.emptySubtitle.learnMore": "Automate recurring chat work by configuring scheduled conversations. <link>Learn more</link>",
    "inbox.automations.rowSummary.heartbeat": "Heartbeat • {thread}",
    "inbox.automations.editTooltip": "Edit automation",
    "inbox.automations.moreOptionsTooltip": "More options",
    "inbox.automations.rowActions": "Automation actions",
    "inbox.automations.pauseMenuItem": "Pause",
    "inbox.automations.resumeMenuItem": "Resume",
    "inbox.automations.deleteMenuItem": "Delete",
    "inbox.automations.deleteConfirm.cancel": "Cancel",
    "inbox.automations.deleteConfirm.confirm": "Delete automation",
    "inbox.automations.deleteConfirm.description": "This will permanently delete the automation and stop all future runs.",
    "inbox.automations.deleteConfirm.title": "Delete {name}?",
    "inbox.automations.deleteError": "Could not delete automation",
    "inbox.automations.deleteFailedDescription": "Try again.",
    "inbox.automations.runNowError": "Could not start automation",
    "inbox.automations.runNowSuccess": "Automation started",
    "inbox.automations.relativeDate.pastToday": "Today at {time}",
    "inbox.automations.relativeDate.pastWeekday": "{weekday} at {time}",
    "inbox.automations.relativeDate.today": "Today at {time}",
    "inbox.automations.relativeDate.tomorrow": "Tomorrow at {time}",
    "inbox.automations.relativeDate.weekday": "{weekday} at {time}",
    "inbox.automations.relativeDate.yesterday": "Yesterday at {time}",
    "inbox.automations.statusSection": "Status",
    "inbox.automations.status.label": "Status",
    "inbox.automations.status.active": "Active",
    "inbox.automations.status.paused": "Paused",
    "inbox.automations.status.deleted": "Deleted",
    "inbox.automations.executionEnvironment.label": "Runs in",
    "inbox.automations.host.label": "Host",
    "inbox.automations.folder.label": "Project",
    "inbox.automations.localEnvironment.label": "Environment",
    "composer.worktreeEnvironment.title": "Local environment",
    "composer.worktreeEnvironment.tooltip": "Select a local environment",
    "composer.worktreeEnvironment.loading": "Loading environments...",
    "composer.worktreeEnvironment.error": "Error loading environments",
    "composer.worktreeEnvironment.default": "Default environment",
    "composer.worktreeEnvironment.create": "Create local environment",
    "codex.environmentSelector.noEnvironment": "No environment",
    "codex.environments.noEnvironmentsFound": "No environments found",
    "inbox.automations.history": "Previous runs",
    "inbox.automations.history.untitled": "Untitled",
    "inbox.automations.history.archivedTooltip": "Run was archived",
    "inbox.automations.workspaceFallback": "-",
    "inbox.automations.targetThread.label": "Chat",
    "inbox.automations.model.label": "Model",
    "inbox.automations.reasoning.label": "Reasoning",
    "inbox.automations.interval.label": "Interval",
    "inbox.automations.repeats.label": "Repeats",
    "inbox.contextMenu.markRead": "Mark as read",
    "inbox.contextMenu.markUnread": "Mark as unread",
    "settings.automations.runNow": "Run now",
    "settings.automations.cancel": "Cancel",
    "settings.automations.create": "Create",
    "settings.automations.save": "Save",
    "settings.automations.saveRetry": "Save",
    "settings.automations.deleteAria": "Delete automation",
    "settings.automations.clear": "Clear",
    "settings.automations.dialog.newTitle": "New automation",
    "settings.automations.nameLabel": "Name",
    "settings.automations.namePlaceholder": "Automation name",
    "settings.automations.pauseAria": "Pause automation",
    "settings.automations.promptLabel": "Prompt",
    "settings.automations.promptPlaceholder": "What should Codex do?",
    "settings.automations.projectDropdown.projectless": "Chats",
    "settings.automations.projectDropdown.placeholder": "Select project",
    "settings.automations.projectDropdown.localOnlyTooltip": "Automations can only be created for local projects",
    "settings.automations.resumeAria": "Resume automation",
    "settings.automations.rruleSummaryFallback": "Custom schedule",
    "settings.automations.scheduleSummary.daily": "Daily at {time}",
    "settings.automations.scheduleSummary.weekdays": "Weekdays at {time}",
    "settings.automations.scheduleSummary.weekends": "Weekends at {time}",
    "settings.automations.scheduleSummary.weekly": "{days} at {time}",
    "settings.automations.scheduleSummary.interval": "Every {count}h",
    "settings.automations.scheduleSummary.intervalDays":
      "{interval} on {days}",
    "settings.automations.scheduleSummary.intervalDayCount":
      "{count, plural, one {# day} other {# days}}",
    "settings.automations.scheduleSummary.intervalMinute": "Every minute",
    "settings.automations.scheduleSummary.intervalMinutes":
      "Every {count}m",
    "settings.automations.scheduleSummary.intervalHourly": "Hourly",
    "settings.automations.scheduleSummary.intervalDaily": "Daily",
    "settings.automations.scheduleSummary.intervalWeekly": "Weekly",
    "settings.automations.scheduleSummary.sundaysLabel": "Sundays",
    "settings.automations.scheduleSummary.mondaysLabel": "Mondays",
    "settings.automations.scheduleSummary.tuesdaysLabel": "Tuesdays",
    "settings.automations.scheduleSummary.wednesdaysLabel": "Wednesdays",
    "settings.automations.scheduleSummary.thursdaysLabel": "Thursdays",
    "settings.automations.scheduleSummary.fridaysLabel": "Fridays",
    "settings.automations.scheduleSummary.saturdaysLabel": "Saturdays",
    "settings.automations.cwdPlaceholder": "One project path per line",
    "settings.automations.heartbeatThread.placeholder": "Select a chat",
    "settings.automations.executionEnvironment.ariaLabel": "Execution environment",
    "settings.automations.executionEnvironment.local": "Local",
    "settings.automations.executionEnvironment.worktree": "Worktree",
    "scratchpadPage.headerTitle": "Scratchpad",
    "scratchpadPage.headerSubtitle": "Experiment",
    "scratchpadPage.clearButton": "Clear",
    "scratchpadPage.createError": "Could not create chat",
    "scratchpadPage.inputPlaceholder.initial": "Add a task",
    "scratchpadPage.inputPlaceholder.followUp": "Add a follow up",
    "scratchpadPage.inputPlaceholder.followUpHint": "Add a task, or tab for a follow up",
    "scratchpadPage.summaryLoading": "Summarizing final assistant response",
    "codex.localTaskRow.awaitingApproval": "Awaiting approval",
    "codex.localTaskRow.awaitingResponse": "Awaiting response",
    "general.title": "General",
    "general.theme": "Theme",
    "general.themeDescription": "Use light, dark, or match your system",
    "general.themeLight": "Light",
    "general.themeDark": "Dark",
    "general.themeSystem": "System",
    "general.languageDescription": "Language for the app UI",
    "general.usePointerCursors": "Use pointer cursors",
    "general.usePointerCursorsDescription": "Change the cursor to a pointer when hovering over interactive elements",
    "general.uiFontSize": "UI font size",
    "general.uiFontSizeDescription": "Adjust the base size used for the Codex UI",
    "general.codeFontSize": "Code font size",
    "general.codeFontSizeDescription": "Adjust the base size used for code across chats and diffs",
    "general.enterBehavior": "Require {modifierSymbol} + enter to send long prompts",
    "general.enterBehaviorDescription": "When enabled, multiline prompts require {modifierSymbol} + enter to send.",
    "general.followUpBehavior": "Follow-up behavior",
    "general.followUpBehaviorDescription":
      "Queue follow-ups while Codex runs or steer the current run. Press {invertFollowUpShortcutLabel} to do the opposite for one message",
    "general.followUpQueue": "Queue",
    "general.followUpSteer": "Steer",
    "general.reviewDelivery": "Code review",
    "general.reviewDeliveryDescription": "Start /review in the current chat when possible or launch a separate review chat",
    "general.reviewInline": "Inline",
    "general.reviewDetached": "Detached",
    "general.saving": "Saving",
    "general.language": "Language",
    "general.languageAuto": "Auto Detect",
    "general.languageEnglish": "English",
    "general.languageChineseSimplified": "Chinese (Simplified)",
    "settings.general": "General",
    "settings.nav.general-settings": "General",
    "settings.nav.appearance": "Appearance",
    "settings.nav.agent": "Configuration",
    "settings.nav.plugins-settings": "Plugins",
    "settings.nav.browser-use": "Browser use",
    "settings.nav.computer-use": "Computer use",
    "settings.nav.usage": "Usage",
    "settings.nav.data-controls": "Archived chats",
    "settings.nav.keyboard-shortcuts": "Keyboard shortcuts",
    "settings.nav.git-settings": "Git",
    "settings.nav.worktrees": "Worktrees",
    "settings.nav.personalization": "Personalization",
    "settings.nav.mcp-settings": "MCP servers",
    "settings.nav.local-environments": "Local environments",
    "settings.section.general-settings": "General",
    "settings.section.appearance": "Appearance",
    "settings.section.agent": "Configuration",
    "settings.section.personalization": "Personalization",
    "settings.section.usage": "Usage",
    "settings.section.local-environments": "Environments",
    "computerUse.label": "Computer use",
    "settings.section.data-controls": "Archived chats",
    "settings.section.keyboard-shortcuts": "Keyboard shortcuts",
    "settings.section.git-settings": "Git",
    "settings.section.worktrees": "Worktrees",
    "settings.section.plugins-settings": "Plugins",
    "settings.section.skills-settings": "Skills",
    "settings.section.browser-use": "Browser use",
    "settings.section.mcp-settings": "MCP servers",
    "settings.section.mcp-settings.subtitle": "Connect external tools and data sources. <a>Learn more.</a>",
    "settings.browserUse.title": "Browser",
    "settings.browserUse.subtitle":
      "Manage Codex's browser. Google Chrome can be set up in <computerUseSettingsLink>computer use settings</computerUseSettingsLink>",
    "settings.browserUse.control.title": "Browser Use",
    "settings.browserUse.control.description": "Let Codex control the built-in browser",
    "settings.browserUse.install.title": "Plugins",
    "settings.browserUse.install.button": "Install",
    "settings.browserUse.install.empty": "In-app browser plugin unavailable",
    "settings.browserUse.permissions.title": "Permissions",
    "settings.browserUse.browser.title": "Data",
    "settings.browserUse.browser.clearBrowsingData.label": "Browsing data",
    "settings.browserUse.browser.clearBrowsingData.description":
      "Clear site data and cache from the in-app browser",
    "settings.browserUse.browser.clearBrowsingData": "Clear all browsing data",
    "settings.browserUse.browser.hideClearOptions": "Hide individual browsing data options",
    "settings.browserUse.browser.showClearOptions": "Show individual browsing data options",
    "settings.browserUse.browser.cookies.label": "Cookies",
    "settings.browserUse.browser.siteData.label": "Site data",
    "settings.browserUse.browser.cache.label": "Cached images and files",
    "settings.browserUse.browser.clearCookies": "Delete cookies",
    "settings.browserUse.browser.clearSiteData": "Delete site data",
    "settings.browserUse.browser.clearCache": "Delete cached images and files",
    "settings.browserUse.browser.browsingDataCleared": "Browsing data cleared",
    "settings.browserUse.browser.cookiesCleared": "Browser cookies cleared",
    "settings.browserUse.browser.siteDataCleared": "Browser site data cleared",
    "settings.browserUse.browser.cacheCleared": "Browser cache cleared",
    "settings.browserUse.browser.clearBrowsingDataError": "Unable to clear browsing data",
    "settings.browserUse.browser.clearCookiesError": "Unable to clear browser cookies",
    "settings.browserUse.browser.clearSiteDataError": "Unable to clear browser site data",
    "settings.browserUse.browser.clearCacheError": "Unable to clear browser cache",
    "settings.browserUse.browser.annotationScreenshots.label": "Annotation screenshots",
    "settings.browserUse.browser.annotationScreenshots.description":
      "Screenshots help Codex better understand and address comments, but increase plan usage",
    "settings.browserUse.browser.annotationScreenshots.always.label": "Always include",
    "settings.browserUse.browser.annotationScreenshots.necessary.label": "Only on drag selection",
    "settings.browserUse.browser.annotationScreenshots.saveError":
      "Unable to save annotation screenshots setting",
    "settings.browserUse.approval.label": "Approval",
    "settings.browserUse.approval.description": "Choose if Codex asks for approval before opening websites",
    "settings.browserUse.approval.alwaysAsk.label": "Always ask",
    "settings.browserUse.approval.alwaysAsk.description": "Ask before opening websites",
    "settings.browserUse.approval.neverAsk.label": "Always allow",
    "settings.browserUse.approval.neverAsk.description": "Open websites without asking",
    "settings.browserUse.approval.neverAsk.elevatedRiskDisclaimer":
      "This setting has elevated risks for your data.",
    "settings.browserUse.approval.saveError": "Unable to save approval setting",
    "settings.browserUse.historyApproval.label": "History",
    "settings.browserUse.historyApproval.description": "Choose if Codex asks for approval before accessing your history",
    "settings.browserUse.historyApproval.alwaysAsk.label": "Always ask",
    "settings.browserUse.historyApproval.alwaysAsk.description": "Ask before accessing history",
    "settings.browserUse.historyApproval.neverAsk.label": "Always allow",
    "settings.browserUse.historyApproval.neverAsk.description": "Access history without asking",
    "settings.browserUse.historyApproval.saveError": "Unable to save history setting",
    "settings.browserUse.downloadApproval.label": "Downloads",
    "settings.browserUse.downloadApproval.description":
      "Choose if Codex asks before downloading files from websites",
    "settings.browserUse.downloadApproval.alwaysAsk.description": "Ask before downloading files",
    "settings.browserUse.downloadApproval.neverAsk.description": "Download files without asking",
    "settings.browserUse.downloadApproval.saveError": "Unable to save download setting",
    "settings.browserUse.uploadApproval.label": "Uploads",
    "settings.browserUse.uploadApproval.description":
      "Choose if Codex asks before uploading files to websites",
    "settings.browserUse.uploadApproval.alwaysAsk.description": "Ask before uploading files",
    "settings.browserUse.uploadApproval.neverAsk.description": "Upload files without asking",
    "settings.browserUse.uploadApproval.saveError": "Unable to save upload setting",
    "settings.browserUse.allowedDomains.title": "Allowed domains",
    "settings.browserUse.allowedDomains.subtitle": "Domains that open without asking",
    "settings.browserUse.allowedDomains.emptyTitle": "No allowed domains",
    "settings.browserUse.allowedDomains.added": "Allowed domain added",
    "settings.browserUse.allowedDomains.addDialogTitle": "Add allowed domain",
    "settings.browserUse.allowedDomains.addDialogSubtitle":
      "This means Codex can open this URL without asking first.",
    "settings.browserUse.blockedDomains.title": "Blocked domains",
    "settings.browserUse.blockedDomains.subtitle": "Codex will never open these sites",
    "settings.browserUse.blockedDomains.emptyTitle": "No blocked domains",
    "settings.browserUse.blockedDomains.added": "Blocked domain added",
    "settings.browserUse.blockedDomains.addDialogTitle": "Add blocked domain",
    "settings.browserUse.blockedDomains.addDialogSubtitle": "This means Codex will not open this URL.",
    "settings.browserUse.blockedDomains.chromeSubtitle":
      "Codex will never open these sites in your browser",
    "settings.browserUse.allowedDownloadDomains.title": "Allowed download domains",
    "settings.browserUse.allowedDownloadDomains.subtitle":
      "Domains that can download files without asking",
    "settings.browserUse.allowedDownloadDomains.emptyTitle": "No allowed download domains",
    "settings.browserUse.allowedDownloadDomains.added": "Allowed download domain added",
    "settings.browserUse.allowedDownloadDomains.removed": "Allowed download domain removed",
    "settings.browserUse.allowedDownloadDomains.addDialogTitle": "Add allowed download domain",
    "settings.browserUse.allowedDownloadDomains.addDialogSubtitle":
      "This means Codex can download files from this URL without asking first",
    "settings.browserUse.allowedDownloadDomains.removeDialogTitle":
      "Remove “{origin}” from allowed download domains?",
    "settings.browserUse.allowedDownloadDomains.removeDialogSubtitle":
      "Codex will ask before downloading files from this domain",
    "settings.browserUse.blockedDownloadDomains.title": "Blocked download domains",
    "settings.browserUse.blockedDownloadDomains.subtitle":
      "Codex will never download files from these sites",
    "settings.browserUse.blockedDownloadDomains.emptyTitle": "No blocked download domains",
    "settings.browserUse.blockedDownloadDomains.added": "Blocked download domain added",
    "settings.browserUse.blockedDownloadDomains.removed": "Blocked download domain removed",
    "settings.browserUse.blockedDownloadDomains.addDialogTitle": "Add blocked download domain",
    "settings.browserUse.blockedDownloadDomains.addDialogSubtitle":
      "This means Codex will not download files from this URL",
    "settings.browserUse.blockedDownloadDomains.removeDialogTitle":
      "Remove “{origin}” from blocked download domains?",
    "settings.browserUse.blockedDownloadDomains.removeDialogSubtitle":
      "Codex can ask again before downloading files from this domain",
    "settings.browserUse.allowedUploadDomains.title": "Allowed upload domains",
    "settings.browserUse.allowedUploadDomains.subtitle":
      "Domains that can receive file uploads without asking",
    "settings.browserUse.allowedUploadDomains.emptyTitle": "No allowed upload domains",
    "settings.browserUse.allowedUploadDomains.added": "Allowed upload domain added",
    "settings.browserUse.allowedUploadDomains.removed": "Allowed upload domain removed",
    "settings.browserUse.allowedUploadDomains.addDialogTitle": "Add allowed upload domain",
    "settings.browserUse.allowedUploadDomains.addDialogSubtitle":
      "This means Codex can upload files to this URL without asking first",
    "settings.browserUse.allowedUploadDomains.removeDialogTitle":
      "Remove “{origin}” from allowed upload domains?",
    "settings.browserUse.allowedUploadDomains.removeDialogSubtitle":
      "Codex will ask before uploading files to this domain",
    "settings.browserUse.blockedUploadDomains.title": "Blocked upload domains",
    "settings.browserUse.blockedUploadDomains.subtitle":
      "Codex will never upload files to these sites",
    "settings.browserUse.blockedUploadDomains.emptyTitle": "No blocked upload domains",
    "settings.browserUse.blockedUploadDomains.added": "Blocked upload domain added",
    "settings.browserUse.blockedUploadDomains.removed": "Blocked upload domain removed",
    "settings.browserUse.blockedUploadDomains.addDialogTitle": "Add blocked upload domain",
    "settings.browserUse.blockedUploadDomains.addDialogSubtitle":
      "This means Codex will not upload files to this URL",
    "settings.browserUse.blockedUploadDomains.removeDialogTitle":
      "Remove “{origin}” from blocked upload domains?",
    "settings.browserUse.blockedUploadDomains.removeDialogSubtitle":
      "Codex can ask again before uploading files to this domain",
    "settings.browserUse.domains.add": "Add",
    "settings.browserUse.domains.addDialogAriaLabel": "Domain",
    "settings.browserUse.domains.addDialogPlaceholder": "example.com",
    "settings.browserUse.domains.addDialogCancel": "Cancel",
    "settings.browserUse.domains.addDialogConfirm": "Add",
    "settings.browserUse.domains.addError": "Unable to add domain",
    "settings.browserUse.origins.loading": "Loading websites",
    "settings.browserUse.origins.saveError": "Unable to save domains",
    "settings.browserUse.origins.removeAriaLabel": "Remove {origin}",
    "settings.browserUse.origins.removeDialogCancel": "Cancel",
    "settings.browserUse.origins.removeDialogConfirm": "Remove",
    "settings.browserUse.allowedWebsites.saved": "Allowed domain removed",
    "settings.browserUse.allowedWebsites.removeDialogTitle": "Remove “{origin}” from allowed domains?",
    "settings.browserUse.allowedWebsites.removeDialogSubtitle":
      "Codex will ask before opening this domain.",
    "settings.browserUse.deniedWebsites.saved": "Blocked domain removed",
    "settings.browserUse.deniedWebsites.removeDialogTitle": "Remove “{origin}” from blocked domains?",
    "settings.browserUse.deniedWebsites.removeDialogSubtitle":
      "Codex can ask again before opening this domain.",
    "settings.computerUse.install.title": "Plugin",
    "settings.computerUse.install.button": "Install",
    "settings.computerUse.install.empty": "Computer Use plugin unavailable",
    "settings.computerUse.subtitle": "Manage how Codex uses other applications on your computer",
    "settings.computerUse.sounds.foregroundClicks": "Play sounds for foreground clicks",
    "settings.computerUse.sounds.foregroundAndBackgroundClicks":
      "Play sounds for foreground and background clicks",
    "settings.computerUse.sounds.off": "Don’t play sounds",
    "settings.computerUse.anyApp.title": "Any App",
    "settings.computerUse.anyApp.description": "Let Codex control apps on your computer",
    "settings.computerUse.chrome.pluginTitle": "Google Chrome",
    "settings.computerUse.chrome.pluginDescription":
      "Use the browser extension for additional control",
    "settings.computerUse.chrome.pluginConnectedDescription":
      "Connected to browser extension for additional control",
    "settings.computerUse.chrome.pluginDisconnectedDescription": "Browser extension not connected",
    "settings.computerUse.chrome.manage": "Manage",
    "settings.computerUse.chrome.title": "Google Chrome",
    "settings.computerUse.chrome.reinstallExtension": "Reinstall extension",
    "settings.computerUse.chrome.openExtensionSettingsError":
      "Unable to open Chrome extension settings",
    "settings.computerUse.chrome.removeExtension": "Remove extension",
    "settings.computerUse.chrome.permissions.title": "Permissions",
    "settings.computerUse.chrome.connected": "Connected",
    "settings.computerUse.chrome.notConnected": "Not connected",
    "settings.computerUse.chrome.back": "Back",
    "settings.computerUse.breadcrumb.computerUse": "Computer use",
    "settings.computerUse.chrome.breadcrumb.googleChrome": "Google Chrome",
    "settings.computerUse.allowedApps.title": "Always-allowed apps",
    "settings.computerUse.allowedApps.loading": "Loading allowed apps",
    "settings.computerUse.allowedApps.loadError": "Unable to load allowed apps.",
    "settings.computerUse.allowedApps.emptyTitle": "None yet",
    "settings.computerUse.allowedApps.removeAriaLabel": "Remove {displayName}",
    "settings.computerUse.allowedApps.removeDialogTitle":
      "Remove “{displayName}” from always allowed apps?",
    "settings.computerUse.allowedApps.removeDialogSubtitle":
      "Codex will ask to use “{displayName}” in the next computer use session.",
    "settings.computerUse.allowedApps.removeDialogCancel": "Cancel",
    "settings.computerUse.allowedApps.removeDialogConfirm": "Remove",
    "settings.computerUse.allowedApps.saved": "Allowed app removed",
    "settings.computerUse.allowedApps.saveError": "Unable to save allowed apps",
    "settings.pluginControls.disableToggleTooltip": "Disable {pluginName}",
    "settings.pluginControls.enableToggleTooltip": "Enable {pluginName}",
    "settings.pluginControls.toggleAria": "Toggle {pluginName}",
    "settings.pluginControls.installTooltip": "Install {pluginName}",
    "settings.localEnvironments.workspaceSelect.description":
      "Local environments tell Codex how to set up worktrees for a project. <a>Learn more.</a>",
    "settings.localEnvironments.workspaceSelect.title": "Select a project",
    "settings.localEnvironments.workspaceSelect.learnMore": "Learn more.",
    "settings.localEnvironments.workspaceSelect.loading": "Loading projects.",
    "settings.localEnvironments.workspaceSelect.empty":
      "No projects yet. Add one to configure local environments.",
    "settings.localEnvironments.workspaceSelect.listLabel": "Available projects",
    "settings.localEnvironments.workspaceSelect.addLabel": "Add environment",
    "settings.localEnvironments.workspaceSelect.loadingLabel": "Loading environment",
    "settings.localEnvironments.workspaceSelect.errorLabel": "Environment needs attention",
    "settings.localEnvironments.workspaceSelect.inherited":
      "{count, plural, one {# environment in a parent folder} other {# environments in parent folders}}",
    "settings.localEnvironments.workspaceSelect.viewAction": "View",
    "settings.localEnvironments.workspace.add": "Add project",
    "settings.localEnvironments.workspace.title": "Project",
    "settings.localEnvironments.breadcrumb.back": "Back",
    "settings.localEnvironments.breadcrumb.root": "Environments",
    "settings.localEnvironments.breadcrumb.edit": "edit",
    "settings.localEnvironments.editor.title": "Local environment",
    "settings.localEnvironments.editor.setup.description": "Runs at the project root on worktree creation",
    "settings.localEnvironments.environment.create": "Create local environment",
    "settings.localEnvironments.environment.edit": "Edit local environment",
    "settings.localEnvironments.environment.defaultName": "local",
    "settings.localEnvironments.environment.empty": "No local environment is configured for this project yet.",
    "settings.localEnvironments.environment.title": "Environment details",
    "settings.localEnvironments.environment.name": "Name",
    "settings.localEnvironments.environment.setup": "Setup script",
    "settings.localEnvironments.environment.setup.description": "This script will run on worktree creation.",
    "settings.localEnvironments.environment.setup.platformSelector": "Setup script platform",
    "settings.localEnvironments.environment.setup.platformOverrides": "Platform overrides",
    "settings.localEnvironments.environment.setup.platformOverrides.description":
      "Overrides the default script for specific OSes.",
    "settings.localEnvironments.environment.setup.envVars.button": "Variables",
    "settings.localEnvironments.environment.setup.envVars.title": "Setup script environment variables",
    "settings.localEnvironments.environment.setup.envVars.sourcePath.description": "Source workspace path",
    "settings.localEnvironments.environment.setup.envVars.worktreePath.description": "New worktree path",
    "settings.localEnvironments.environment.cleanup.title": "Cleanup script",
    "settings.localEnvironments.environment.cleanup.description":
      "Runs at the project root before worktree cleanup",
    "settings.localEnvironments.environment.cleanup.summaryTitle": "Cleanup script",
    "settings.localEnvironments.environment.cleanup.summaryDescription":
      "This script will run before a worktree is deleted.",
    "settings.localEnvironments.environment.cleanup.empty": "No cleanup script configured.",
    "settings.localEnvironments.environment.cleanup.platformSelector": "Cleanup script platform",
    "settings.localEnvironments.environment.cleanup.platformOverrides": "Platform overrides",
    "settings.localEnvironments.environment.cleanup.platformOverrides.description":
      "Overrides the default cleanup script for specific OSes.",
    "settings.localEnvironments.environment.actions.description":
      "These actions can run any command and will be displayed in the header.",
    "settings.localEnvironments.environment.actionsLabel": "Actions",
    "settings.localEnvironments.environment.script.default": "Default",
    "settings.localEnvironments.actions.title": "Actions",
    "settings.localEnvironments.actions.add": "Add action",
    "settings.localEnvironments.actions.empty": "Add an action to run commands from the local toolbar.",
    "settings.localEnvironments.actions.item.name": "Name",
    "settings.localEnvironments.actions.item.command": "Action script",
    "settings.localEnvironments.actions.item.button.delete": "Delete",
    "settings.localEnvironments.actions.item.tooltip.delete": "Delete",
    "settings.localEnvironments.actions.item.platforms": "Platforms",
    "settings.localEnvironments.actions.item.platforms.selector": "Platform selection",
    "settings.localEnvironments.actions.item.platforms.specific": "Platform specific",
    "settings.localEnvironments.actions.item.platforms.help": "Only run on a specific OS.",
    "settings.localEnvironments.actions.item.platforms.macos": "macOS",
    "settings.localEnvironments.actions.item.platforms.linux": "Linux",
    "settings.localEnvironments.actions.item.platforms.windows": "Windows",
    "settings.localEnvironments.actions.icon.tool": "Tool",
    "settings.localEnvironments.actions.icon.run": "Run",
    "settings.localEnvironments.actions.icon.debug": "Debug",
    "settings.localEnvironments.actions.icon.test": "Test",
    "settings.localEnvironments.preview.save": "Save",
    "settings.localEnvironments.preview.saveError": "Failed to save the file. ({error})",
    "settings.localEnvironments.save.success": "Saved local environment",
    "settings.localEnvironments.save.disabled.name": "Add an environment name to save.",
    "settings.localEnvironments.save.disabled.noChanges": "No changes to save.",
    "settings.localEnvironments.save.disabled.saving": "Saving…",
    "settings.localEnvironments.file.parseError":
      "Unable to parse the existing file. Saving will overwrite it. ({error})",
    "settings.localEnvironments.file.readError": "Failed to load local environment data. ({error})",
    "settings.localEnvironments.loading.title": "Loading local environments",
    "settings.localEnvironments.loading.body": "Fetching your project configuration.",
    "settings.localEnvironments.unavailable.title": "Local environments unavailable",
    "settings.localEnvironments.unavailable.body":
      "We could not load local environment settings for this project.",
    "settings.localEnvironments.remoteProjectDialog.title": "Add remote project",
    "settings.localEnvironments.remoteProjectDialog.description":
      "Choose a connected remote host and enter the folder for this project.",
    "settings.localEnvironments.remoteProjectDialog.emptyDescription":
      "Set up a remote host first. Then you can choose a host and folder here.",
    "settings.localEnvironments.remoteProjectDialog.hostLabel": "Remote host",
    "settings.localEnvironments.remoteProjectDialog.pathLabel": "Folder path",
    "settings.localEnvironments.remoteProjectDialog.note":
      "This remote folder will appear as its own project in the sidebar.",
    "settings.localEnvironments.remoteProjectDialog.cancel": "Cancel",
    "settings.localEnvironments.remoteProjectDialog.confirm": "Add project",
    "settings.localEnvironments.remoteProjectDialog.saveError": "Failed to save project",
    "settings.keyboardShortcuts.subtitle.electron": "Customize app shortcuts",
    "settings.keyboardShortcuts.loading": "Loading shortcuts…",
    "settings.keyboardShortcuts.search.ariaLabel": "Search keyboard shortcuts",
    "settings.keyboardShortcuts.search.placeholder": "Search shortcuts",
    "settings.keyboardShortcuts.table.command": "Command",
    "settings.keyboardShortcuts.table.keybinding": "Keybinding",
    "settings.keyboardShortcuts.table.actions": "Actions",
    "settings.keyboardShortcuts.noMatches": "No matching shortcuts",
    "settings.keyboardShortcuts.unassigned": "Unassigned",
    "settings.keyboardShortcuts.capturePrompt": "Press shortcut",
    "settings.keyboardShortcuts.captureCancel": "Cancel",
    "settings.keyboardShortcuts.captureAriaLabel": "Shortcut capture for {commandTitle}",
    "settings.keyboardShortcuts.captureConflict": "Used by {commandTitle}",
    "settings.keyboardShortcuts.setAriaLabel": "Set shortcut for {commandTitle}",
    "settings.keyboardShortcuts.changeAriaLabel": "Change shortcut for {commandTitle}",
    "settings.keyboardShortcuts.createAriaLabel": "Create new shortcut for {commandTitle}",
    "settings.keyboardShortcuts.clearAriaLabel": "Clear shortcut for {commandTitle}",
    "settings.keyboardShortcuts.resetAriaLabel": "Reset shortcut for {commandTitle}",
    "settings.keyboardShortcuts.updateError": "Failed to update shortcut",
    "settings.git.branchPrefix.label": "Branch prefix",
    "settings.git.branchPrefix.description": "Prefix used when creating new branches in Codex",
    "settings.git.branchPrefix.placeholder": "codex/",
    "settings.git.branchPrefix.ariaLabel": "Branch prefix",
    "settings.git.branchPrefix.save.success": "Saved branch prefix",
    "settings.git.branchPrefix.save.error": "Failed to save branch prefix",
    "settings.git.forcePush.label": "Always force push",
    "settings.git.forcePush.description": "Use --force-with-lease when pushing from Codex",
    "settings.git.forcePush.ariaLabel": "Always force push",
    "settings.git.forcePush.save.enabled": "Always force push enabled",
    "settings.git.forcePush.save.disabled": "Always force push disabled",
    "settings.git.forcePush.save.error": "Failed to save force push setting",
    "settings.git.createDraftPullRequest.label": "Create draft pull requests",
    "settings.git.createDraftPullRequest.description": "Use draft pull requests by default when creating PRs from Codex",
    "settings.git.createDraftPullRequest.ariaLabel": "Create draft pull requests",
    "settings.git.createDraftPullRequest.save.enabled": "Create draft pull requests enabled",
    "settings.git.createDraftPullRequest.save.disabled": "Create draft pull requests disabled",
    "settings.git.createDraftPullRequest.save.error": "Failed to save draft pull request setting",
    "settings.git.pullRequestMergeMethod.label": "Pull request merge method",
    "settings.git.pullRequestMergeMethod.description": "Choose how Codex merges pull requests",
    "settings.git.pullRequestMergeMethod.ariaLabel": "Pull request merge method",
    "settings.git.pullRequestMergeMethod.merge": "Merge",
    "settings.git.pullRequestMergeMethod.squash": "Squash",
    "settings.git.pullRequestMergeMethod.save.success": "Saved pull request merge method",
    "settings.git.pullRequestMergeMethod.save.error": "Failed to save pull request merge method",
    "settings.git.showSidebarPrIcons.label": "Show PR icons in sidebar",
    "settings.git.showSidebarPrIcons.description": "Display PR status icons on chat rows in the sidebar",
    "settings.git.showSidebarPrIcons.ariaLabel": "Show PR icons in sidebar",
    "settings.git.showSidebarPrIcons.save.enabled": "Sidebar PR icons enabled",
    "settings.git.showSidebarPrIcons.save.disabled": "Sidebar PR icons disabled",
    "settings.git.showSidebarPrIcons.save.error": "Failed to save sidebar PR icon setting",
    "settings.git.commitInstructions.label": "Commit instructions",
    "settings.git.commitInstructions.description": "Added to commit message generation prompts",
    "settings.git.commitInstructions.save": "Save",
    "settings.git.commitInstructions.placeholder": "Add commit message guidance…",
    "settings.git.commitInstructions.ariaLabel": "Commit instructions",
    "settings.git.commitInstructions.save.success": "Saved commit instructions",
    "settings.git.commitInstructions.save.error": "Failed to save commit instructions",
    "settings.git.prInstructions.label": "Pull request instructions",
    "settings.git.prInstructions.description": "Added to PR title/description generation prompts",
    "settings.git.prInstructions.save": "Save",
    "settings.git.prInstructions.placeholder": "Add pull request guidance…",
    "settings.git.prInstructions.ariaLabel": "Pull request instructions",
    "settings.git.prInstructions.save.success": "Saved pull request instructions",
    "settings.git.prInstructions.save.error": "Failed to save pull request instructions",
    "settings.worktrees.autoCleanup.label": "Automatically delete old worktrees",
    "settings.worktrees.autoCleanup.description":
      "Recommended for most users. Turn this off only if you want to manage old worktrees and disk usage yourself.",
    "settings.worktrees.autoCleanup.ariaLabel": "Automatically delete old worktrees",
    "settings.worktrees.autoCleanup.save.enabled": "Automatic deletion enabled",
    "settings.worktrees.autoCleanup.save.disabled": "Automatic deletion disabled",
    "settings.worktrees.autoCleanup.save.error": "Failed to save automatic deletion setting",
    "settings.worktrees.keepCount.label": "Auto-delete limit",
    "settings.worktrees.keepCount.description":
      "Number of Codex worktrees to keep before older ones are pruned automatically. Codex snapshots worktrees before deleting, so pruned worktrees should always be restorable.",
    "settings.worktrees.keepCount.description.disabled":
      "Automatic deletion is disabled. Codex will not prune old worktrees automatically. Re-enable it to use this saved limit again.",
    "settings.worktrees.keepCount.ariaLabel": "Auto-delete limit",
    "settings.worktrees.keepCount.save.success": "Saved auto-delete limit",
    "settings.worktrees.keepCount.save.error": "Failed to save auto-delete limit",
    "settings.worktrees.autoCleanup.confirm.title": "Disable automatic worktree deletion?",
    "settings.worktrees.autoCleanup.confirm.body":
      "We highly recommend keeping automatic deletion on so old worktrees do not build up and use unnecessary disk space. If you prefer to manage old worktrees yourself, you can turn this off and Codex will stop deleting them automatically.",
    "settings.worktrees.autoCleanup.confirm.cancel": "Keep automatic deletion",
    "settings.worktrees.autoCleanup.confirm.confirm": "Disable automatic deletion",
    "settings.worktrees.refresh": "Refresh",
    "settings.worktrees.loading.title": "Loading worktrees",
    "settings.worktrees.loading.body": "Fetching worktree details.",
    "settings.worktrees.error.title": "Unable to load worktrees",
    "settings.worktrees.error.body": "Something went wrong while loading worktrees.",
    "settings.worktrees.empty.title": "No worktrees yet",
    "settings.worktrees.empty.body": "Worktrees created by Codex will appear here.",
    "settings.worktrees.repository.unknown": "Unknown repository",
    "settings.worktrees.repository.loading": "Loading repository metadata…",
    "settings.worktrees.row.title": "Worktree",
    "settings.worktrees.row.delete": "Delete",
    "settings.worktrees.row.conversations": "Conversations",
    "settings.worktrees.row.conversations.loading": "Loading conversations…",
    "settings.worktrees.row.conversations.empty": "No conversations linked to this worktree.",
    "settings.worktrees.conversation.untitled": "Untitled conversation",
    "settings.worktrees.delete.error": "Failed to delete worktree",
    "settings.dataControls.archivedChats.dateTime": "{date}, {time}",
    "settings.dataControls.archivedChats.dateTimeWithRepo": "{date}, {time} • {repo}",
    "settings.dataControls.archivedChats.empty": "No archived chats.",
    "settings.dataControls.archivedChats.error": "Could not load archived chats.",
    "settings.dataControls.archivedChats.loading": "Loading archived chats…",
    "settings.dataControls.archivedChats.unarchive": "Unarchive",
    "settings.dataControls.archivedChats.unarchiveError": "Failed to unarchive chat",
    "settings.dataControls.archivedChats.unarchiveSuccessPlain": "Unarchived chat",
    "settings.dataControls.archivedChats.untitled": "Untitled chat",
    "settings.dataControls.archivedChats.viewNow": "View now",
    "settings.usage.access.loading": "Checking subscription…",
    "settings.usage.load.loading": "Loading usage settings…",
    "settings.usage.load.error": "Could not load usage settings.",
    "settings.usage.load.retry": "Retry",
    "settings.usage.credit.title": "Credit",
    "settings.usage.credit.remaining.description": "Use credit to send messages when you reach usage limits. <a>Doc</a>",
    "settings.usage.credit.purchase": "Purchase",
    "settings.usage.credit.remaining.unavailable": "Credit remaining unavailable",
    "settings.usage.credit.remaining.unlimited": "Unlimited credit",
    "settings.usage.credit.remaining.value": "{credit} credit remaining",
    "settings.usage.autoTopUp.title": "Auto-reload credit",
    "settings.usage.autoTopUp.description": "Automatically add credit when you reach your minimum balance.",
    "settings.usage.autoTopUp.settings": "Settings",
    "settings.usage.autoTopUp.status.active": "Active",
    "settings.usage.autoTopUp.managePayment.error": "Unable to open payment settings right now. Please try again.",
    "settings.usage.autoTopUp.managePayment.action": "Update your payment method",
    "settings.usage.autoTopUp.purchaseCredit.action": "Purchase credit directly",
    "settings.usage.autoTopUp.dialog.title": "Auto-reload credit",
    "settings.usage.autoTopUp.dialog.description": "OpenAI will charge your payment method automatically when you reach your minimum balance.",
    "settings.usage.autoTopUp.threshold.label": "Minimum balance",
    "settings.usage.autoTopUp.threshold.helper": "Auto reload triggers when your credit balance goes below this amount.",
    "settings.usage.autoTopUp.threshold.ariaLabel": "Auto-reload minimum balance",
    "settings.usage.autoTopUp.threshold.error.missing": "Enter a minimum balance (at least 125 credits).",
    "settings.usage.autoTopUp.threshold.error.wholeNumber": "Minimum balance must be a whole number.",
    "settings.usage.autoTopUp.threshold.error.minimum": "Set the minimum balance to at least 125 credits.",
    "settings.usage.autoTopUp.target.label": "Target balance",
    "settings.usage.autoTopUp.target.helper": "Auto reload brings your credit balance back up to this amount.",
    "settings.usage.autoTopUp.target.ariaLabel": "Auto-reload target balance",
    "settings.usage.autoTopUp.target.equivalent":
      "Minimum {creditCount} credit will be purchased, equivalent to <strong>{amount}</strong>",
    "settings.usage.autoTopUp.target.equivalent.loading": "Loading price",
    "settings.usage.autoTopUp.target.error.missing": "Enter a target balance.",
    "settings.usage.autoTopUp.target.error.wholeNumber": "Target balance must be a whole number.",
    "settings.usage.autoTopUp.target.error.minimumDifference": "Set the target balance to at least 125 credits above the minimum balance.",
    "settings.usage.autoTopUp.disable": "Turn off",
    "settings.usage.autoTopUp.cancel": "Cancel",
    "settings.usage.autoTopUp.save": "Save",
    "settings.usage.autoTopUp.enable": "Turn on",
    "settings.usage.autoTopUp.immediateTopUpNotice.enable":
      "Enabling auto reload will trigger a one-time purchase of {creditCount} credit to reach your target balance. Estimated cost: <strong>{amount}</strong>.",
    "settings.usage.autoTopUp.immediateTopUpNotice.update":
      "Updating your settings will trigger a one-time purchase of {creditCount} credit with an estimated cost of <strong>{amount}</strong>.",
    "settings.usage.autoTopUp.immediateTopUpFailure.generic":
      "The initial top-up failed. <actionLine><managePayment>Update your payment method</managePayment> or <purchaseCredit>purchase credit directly</purchaseCredit>.</actionLine>",
    "settings.usage.autoTopUp.immediateTopUpFailure.amount":
      "The initial top-up for an estimated {amount} failed. <actionLine><managePayment>Update your payment method</managePayment> or <purchaseCredit>purchase credit directly</purchaseCredit>.</actionLine>",
    "settings.usage.autoTopUp.enable.success": "Enabled auto reload",
    "settings.usage.autoTopUp.enable.error": "Failed to enable auto reload",
    "settings.usage.autoTopUp.update.success": "Updated auto reload settings",
    "settings.usage.autoTopUp.update.error": "Failed to update auto reload",
    "settings.usage.autoTopUp.disable.success": "Disabled auto reload",
    "settings.usage.autoTopUp.disable.error": "Failed to disable auto reload",
    "settings.usage.autoTopUp.save.error": "Failed to save auto reload settings",
    "settings.usage.limits.title": "General usage limits",
    "settings.usage.limits.spark.title": "GPT-5.3-Codex-Spark usage limits",
    "settings.usage.limits.fiveHour.label": "5 hour usage limit",
    "settings.usage.limits.weekly.label": "Weekly usage limit",
    "settings.usage.limits.window.resetAt": "Resets {time}",
    "settings.usage.limits.progress.ariaLabel": "Usage remaining",
    "settings.usage.limits.progress.remaining": "{remaining}% left",
    "settings.general.enterBehavior.label": "Require {modifierSymbol} + enter to send long prompts",
    "settings.general.enterBehavior.description": "When enabled, multiline prompts require {modifierSymbol} + enter to send.",
    "settings.general.followUpQueueMode.label": "Follow-up behavior",
    "settings.general.followUpQueueMode.description":
      "Queue follow-ups while Codex runs or steer the current run. Press {invertFollowUpShortcutLabel} to do the opposite for one message",
    "settings.general.followUpQueueMode.queue": "Queue",
    "settings.general.followUpQueueMode.interrupt": "Steer",
    "settings.general.reviewDelivery.label": "Code review",
    "settings.general.reviewDelivery.description": "Start /review in the current chat when possible or launch a separate review chat",
    "settings.general.reviewDelivery.inline": "Inline",
    "settings.general.reviewDelivery.detached": "Detached",
    "settings.agent.speed.label": "Speed",
    "settings.agent.speed.description":
      "Choose how quickly inference runs across chats, subagents, and compaction. Fast uses increased plan usage",
    "settings.agent.speed.option.fast": "Fast",
    "settings.agent.speed.option.fast.description": "1.5x speed, increased plan usage",
    "settings.agent.speed.option.standard": "Standard",
    "settings.agent.speed.option.standard.description": "Default speed",
    "settings.agent.permissionsMode.groupTitle": "Permissions",
    "settings.agent.permissionsMode.default.title": "Default permissions",
    "settings.agent.permissionsMode.default.description":
      "By default, Codex can read and edit files in its workspace. It can ask for additional access when needed",
    "settings.agent.permissionsMode.default.toggle":
      "Default permissions are always shown",
    "settings.agent.permissionsMode.autoReview.title": "Auto-review",
    "settings.agent.permissionsMode.autoReview.description":
      "Codex can read and edit files in its workspace. Codex automatically reviews requests for additional access. Auto-review can make mistakes. <a>Learn more</a> about elevated risks.",
    "settings.agent.permissionsMode.autoReview.toggle":
      "Show Auto-review in the composer",
    "settings.agent.permissionsMode.fullAccess.title": "Full access",
    "settings.agent.permissionsMode.fullAccess.description":
      "When Codex runs with full access, it can edit any file on your computer and run commands with network, without your approval. This significantly increases the risk of data loss, leaks, or unexpected behavior. <a>Learn more</a> about elevated risks.",
    "settings.agent.permissionsMode.fullAccess.toggle":
      "Show Full access in the composer",
    "settings.workMode.groupTitle": "Work mode",
    "settings.workMode.groupDescription": "Choose how much technical detail Codex shows",
    "settings.workMode.radioGroup": "Work mode",
    "settings.workMode.coding.title": "For coding",
    "settings.workMode.coding.description": "More technical responses and control",
    "settings.workMode.everyday.title": "For everyday work",
    "settings.workMode.everyday.description": "Same power, less technical detail",
    "settings.agent.ambientSuggestions.groupTitle": "Suggested prompts",
    "settings.agent.ambientSuggestions.rowLabel":
      "Suggest what to do next by searching project files and connected apps",
    "settings.agent.ambientSuggestions.toggleLabel":
      "Enable ambient suggestions",
    "settings.general.groupTitle": "General",
    "settings.general.notifications": "Notifications",
    "settings.general.dictation": "Dictation",
    "settings.general.globalDictationHotkey.label": "Hold-to-dictate hotkey",
    "settings.general.globalDictationHotkey.description":
      "Hold anywhere on desktop to dictate at your cursor",
    "settings.general.globalDictationHotkey.errorGeneric":
      "Failed to update hold-to-dictate hotkey.",
    "settings.general.globalDictationHotkey.off": "Off",
    "settings.general.globalDictationHotkey.set": "Set",
    "settings.general.globalDictationHotkey.change": "Change",
    "settings.general.globalDictationHotkey.clear": "Clear",
    "settings.general.globalDictationHotkey.cancel": "Cancel",
    "settings.general.globalDictationHotkey.capturePrompt": "Press shortcut",
    "settings.general.globalDictationHotkey.captureAriaLabel":
      "Hold-to-dictate hotkey capture",
    "settings.general.globalDictationToggleHotkey.label":
      "Toggle dictation hotkey",
    "settings.general.globalDictationToggleHotkey.description":
      "Press once anywhere on desktop to start dictation, then press again to stop",
    "settings.general.globalDictationToggleHotkey.errorGeneric":
      "Failed to update toggle dictation hotkey.",
    "settings.general.globalDictationToggleHotkey.captureAriaLabel":
      "Toggle dictation hotkey capture",
    "settings.general.globalDictationToggleHotkey.set": "Set",
    "settings.general.globalDictationToggleHotkey.change": "Change",
    "settings.general.globalDictationToggleHotkey.clear": "Clear",
    "settings.general.globalDictationHistory.emptyTitle": "Recent dictations",
    "settings.general.globalDictationHistory.emptyDescription":
      "Your recent dictations will appear here in case the text doesn't show up where you expected",
    "settings.general.globalDictationHistory.copy": "Copy dictated text",
    "settings.general.dictationDictionary.label": "Dictation dictionary",
    "settings.general.dictationDictionary.description":
      "Words or phrases dictation should recognize",
    "settings.general.dictationDictionary.entryLabel": "Dictionary entry",
    "settings.general.dictationDictionary.addEntry": "Add entry",
    "settings.general.dictationDictionary.removeEntry": "Remove entry",
    "settings.general.gpuTearingDebug": "GPU Tearing Debug",
    "settings.general.gpuTearingDebug.subtitle":
      "Temporary compositor isolation toggles. Changes apply immediately and are only active while the debug gate is enabled.",
    "settings.general.gpuTearingDebug.toggle": "Toggle {settingName}",
    "settings.general.gpuTearingDebug.disableScrollFadeMask.label":
      "Disable scroll fade mask",
    "settings.general.gpuTearingDebug.disableScrollFadeMask.description":
      "Removes scroll-edge fade masks entirely to isolate mask compositing as a tearing trigger",
    "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.label":
      "Disable scroll fade animation",
    "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.description":
      "Keeps static fade masks but removes the scroll-linked animation timeline",
    "settings.general.gpuTearingDebug.disableBackdropBlur.label":
      "Disable backdrop blur",
    "settings.general.gpuTearingDebug.disableBackdropBlur.description":
      "Forces backdrop filters off across the web UI to reduce layered blur composition",
    "settings.general.gpuTearingDebug.disableCssMotion.label":
      "Disable CSS motion",
    "settings.general.gpuTearingDebug.disableCssMotion.description":
      "Turns off CSS animations and transitions to isolate compositor animation work",
    "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.label":
      "Force opaque web background",
    "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.description":
      "Paints the renderer root and body with opaque backgrounds to isolate transparent-window composition",
    "notifications.turnMode.label": "Turn completion notifications",
    "notifications.turnMode.description": "Set when Codex alerts you that it's finished",
    "notifications.turnMode.off": "Never",
    "notifications.turnMode.unfocused": "Only when unfocused",
    "notifications.turnMode.always": "Always",
    "notifications.permissions.label": "Enable permission notifications",
    "notifications.permissions.description": "Show alerts when notification permissions are required",
    "notifications.questions.label": "Enable question notifications",
    "notifications.questions.description": "Show alerts when input is needed to continue",
    "settings.general.experimentalFeatures": "Experimental features (Beta)",
    "settings.general.experimentalFeatures.restartNote":
      "Restart Codex to apply experimental feature changes",
    "settings.general.experimentalFeatures.loading":
      "Loading experimental features…",
    "settings.general.experimentalFeatures.empty":
      "No beta experimental features available",
    "settings.general.experimentalFeatures.toggle":
      "Toggle {featureName}",
    "settings.general.experimentalFeatures.plugins.label": "Plugins",
    "settings.general.experimentalFeatures.plugins.description":
      "Enable the plugins experience in Codex",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.label": "Popout Window hotkey",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.description":
      "Set a global shortcut for Popout Window. Leave unset to keep it off.",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.off": "Off",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.capturePrompt":
      "Press shortcut",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.captureAriaLabel":
      "Popout Window hotkey capture",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.cancel": "Cancel",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.set": "Set",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.change": "Change",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.clear": "Clear",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.errorGeneric":
      "Failed to update Popout Window hotkey.",
    "settings.agent.dependencies.sectionTitle": "Workspace Dependencies",
    "settings.agent.dependencies.bundleVersion.label": "Current version",
    "settings.agent.dependencies.bundleVersion.loading": "Checking…",
    "settings.agent.dependencies.bundleVersion.notInstalled": "Not installed",
    "settings.agent.dependencies.bundleVersion.problemDescription":
      "Run diagnostics or reinstall if tool calls fail",
    "settings.agent.dependencies.enabled.label": "Codex dependencies",
    "settings.agent.dependencies.enabled.description":
      "Allow Codex to install and expose bundled Node.js and Python tools",
    "settings.agent.dependencies.enabled.ariaLabel":
      "Enable Codex dependencies",
    "settings.agent.dependencies.diagnose.label":
      "Diagnose issues in Codex Workspace",
    "settings.agent.dependencies.diagnose.description":
      "Checks the current bundle and records diagnostic logs",
    "settings.agent.dependencies.diagnose.button": "Diagnose",
    "settings.agent.dependencies.diagnose.ok":
      "Codex dependencies look healthy",
    "settings.agent.dependencies.diagnose.problem":
      "Codex dependencies may need repair. Send /feedback if this keeps happening",
    "settings.agent.dependencies.diagnose.failed":
      "Couldn’t diagnose Codex dependencies",
    "settings.agent.dependencies.reset.label": "Reset and install Workspace",
    "settings.agent.dependencies.reset.description":
      "Deletes the local bundle, downloads it again, and reloads tools",
    "settings.agent.dependencies.reset.button": "Reinstall",
    "settings.agent.dependencies.reset.installed":
      "Codex dependencies were reinstalled",
    "settings.agent.dependencies.reset.canceled":
      "Codex dependency download canceled",
    "settings.agent.dependencies.reset.failed":
      "Couldn’t reinstall Codex dependencies",
    "settings.agent.dependencies.cancel.button": "Cancel download",
    "settings.agent.dependencies.cancel.noop":
      "No Codex dependency download is running",
    "settings.agent.dependencies.cancel.canceled":
      "Canceling Codex dependency download",
    "settings.agent.dependencies.cancel.failed":
      "Couldn’t cancel Codex dependency download",
    "settings.remoteControlConnections.localRemoteControl.label":
      "Enable Remote Control on this Computer",
    "settings.remoteControlConnections.localRemoteControl.description":
      "Allows other signed-in Codex clients to connect to this computer",
    "localConversation.primaryRuntimeInstallStatus.downloading":
      "Setting up your workspace: {percent}%",
    "localConversation.primaryRuntimeInstallStatus.extracting":
      "Preparing your workspace",
    "localConversation.primaryRuntimeInstallStatus.finalizing":
      "Finalizing your workspace",
    "settings.general.power.preventSleepWhileRunning.label":
      "Prevent sleep while running",
    "settings.general.power.preventSleepWhileRunning.description":
      "Keep your computer awake while Codex is running a chat",
    "settings.agentEnvironment.label": "Agent environment",
    "settings.agentEnvironment.description": "Choose where the agent runs on Windows",
    "settings.agentEnvironment.windowsNative": "Windows native",
    "settings.agentEnvironment.windowsNative.description": "Run the agent directly in Windows",
    "settings.agentEnvironment.wsl": "Windows Subsystem for Linux",
    "settings.agentEnvironment.wsl.description": "Run the agent inside WSL",
    "settings.agentEnvironment.restartNotice":
      "Restart Codex to apply this change. The agent is still running in {currentEnvironment}.",
    "settings.agentEnvironment.wslBashError":
      "Codex can't run in {distributionName} because /usr/bin/bash is missing",
    "settings.agentEnvironment.wslBashError.unknownDistribution": "this WSL distribution",
    "settings.general.importExternalAgent.rowLabel": "Import work from other AI apps",
    "settings.general.importExternalAgent.importedRowLabel": "Imported agent setup",
    "settings.general.importExternalAgent.rowDescription":
      "Bring over your setup, projects, and recent chats",
    "settings.general.importExternalAgent.lastImported":
      "Last imported {relativeTime} ago",
    "settings.general.importExternalAgent.checking": "Checking",
    "settings.general.importExternalAgent.importing": "Importing",
    "settings.general.importExternalAgent.import": "Import",
    "settings.general.importExternalAgent.importAgain": "Import again",
    "settings.general.importExternalAgent.viewImportedFiles": "View imported files",
    "settings.general.importExternalAgent.continueWithCodex": "Continue with Codex",
    "onboarding.welcome.simple.title": "Welcome!",
    "onboarding.welcome.simple.subtitle": "Continue to choose your workspace",
    "onboarding.welcome.continue": "Continue",
    "onboarding.welcome.close": "Close",
    "onboarding.welcome.new.title.anon": "Welcome!",
    "onboarding.welcome.debugFallback.description":
      "Debug override is forcing the welcome screen. Continue to test the onboarding flow.",
    "onboarding.welcomeV2.role.title": "What type of work do you do?",
    "onboarding.welcomeV2.role.subtitle": "Customize Codex to fit the way you work",
    "onboarding.welcomeV2.role.engineering": "Engineering",
    "onboarding.welcomeV2.role.product": "Product",
    "onboarding.welcomeV2.role.finance": "Finance",
    "onboarding.welcomeV2.role.marketing": "Marketing",
    "onboarding.welcomeV2.role.sales": "Sales",
    "onboarding.welcomeV2.role.operations": "Operations",
    "onboarding.welcomeV2.role.dataScience": "Data Science",
    "onboarding.welcomeV2.role.design": "Design",
    "onboarding.welcomeV2.role.student": "Student",
    "onboarding.welcomeV2.role.somethingElse": "Something else",
    "onboarding.welcomeV2.intent.title": "What can Codex help with?",
    "onboarding.welcomeV2.intent.subtitle": "Choose what you want to work on first",
    "onboarding.welcomeV2.intent.buildSoftware": "Build software",
    "onboarding.welcomeV2.intent.designProducts": "Design products",
    "onboarding.welcomeV2.intent.manageProjects": "Manage projects",
    "onboarding.welcomeV2.intent.searchEmailChat": "Manage inbox",
    "onboarding.welcomeV2.intent.manageCalendar": "Organize calendar",
    "onboarding.welcomeV2.intent.workWithDocs": "Work with docs",
    "onboarding.welcomeV2.intent.analyzeData": "Analyze data",
    "onboarding.welcomeV2.intent.other": "Something else",
    "onboarding.welcomeV2.workMode.title": "How technical should Codex feel?",
    "onboarding.welcomeV2.workMode.subtitle": "Choose how much detail Codex shows",
    "onboarding.welcomeV2.workMode.coding.title": "For coding",
    "onboarding.welcomeV2.workMode.coding.description": "More technical responses and code detail",
    "onboarding.welcomeV2.workMode.nonCoding.title": "For everyday work",
    "onboarding.welcomeV2.workMode.nonCoding.description": "Same powerful agent, less technical detail",
    "onboarding.welcomeV2.workMode.settingsHint": "You can always change this later in settings",
    "onboarding.welcomeV2.personalized.title": "Suggest personalized tasks",
    "onboarding.welcomeV2.personalized.description":
      "Codex can suggest what to do next by searching project files and connected apps",
    "onboarding.welcomeV2.personalized.toggle": "Enable personalized suggestions",
    "onboarding.welcomeV2.personalizedSuggestions.title": "Suggest personalized tasks",
    "onboarding.welcomeV2.personalizedSuggestions.description":
      "Codex can suggest what to do next by searching project files and connected apps",
    "onboarding.welcomeV2.personalizedSuggestions.toggle": "Enable personalized suggestions",
    "onboarding.welcomeV2.personalizedSuggestions.info": "About personalized suggestions",
    "onboarding.welcomeV2.skip": "Skip",
    "onboarding.welcomeV2.externalAgentImport.providers.dialogTitle": "Import from other AI apps",
    "onboarding.welcomeV2.externalAgentImport.providers.title": "Import work from other AI apps",
    "onboarding.welcomeV2.externalAgentImport.providers.subtitle":
      "Bring over your setup, projects, and recent chats",
    "onboarding.welcomeV2.externalAgentImport.providers.appsFound": "Apps found",
    "onboarding.welcomeV2.externalAgentImport.providers.list": "Apps found",
    "onboarding.welcomeV2.externalAgentImport.providers.claudeCode": "Claude Code",
    "onboarding.welcomeV2.externalAgentImport.providers.claudeCowork": "Claude Cowork",
    "onboarding.welcomeV2.externalAgentImport.providers.standardChatsUnsupported":
      "Standard Claude Chat data cannot be imported",
    "onboarding.welcomeV2.externalAgentImport.providers.toggle": "Import {provider}",
    "onboarding.welcomeV2.externalAgentImport.items.title": "Select items to import",
    "onboarding.welcomeV2.externalAgentImport.items.subtitle":
      "Import all your work or handpick what to bring over",
    "onboarding.welcomeV2.externalAgentImport.items.list": "Import options",
    "onboarding.welcomeV2.externalAgentImport.items.bothProvidersNote":
      "Claude Code and Claude Cowork projects and chat sessions will be imported to Codex",
    "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.title": "Tools & setup",
    "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.description":
      "Settings, instructions, plugins, skills",
    "onboarding.welcomeV2.externalAgentImport.projects.title": "Projects ({count})",
    "onboarding.welcomeV2.externalAgentImport.projects.description":
      "Work inside your existing projects",
    "onboarding.welcomeV2.externalAgentImport.recentChats.title": "Chat sessions ({count})",
    "onboarding.welcomeV2.externalAgentImport.recentChats.description": "Last 30 days of chats",
    "onboarding.welcomeV2.externalAgentImport.customize": "Customize",
    "onboarding.welcomeV2.externalAgentImport.customize.title": "Choose what to import",
    "onboarding.welcomeV2.externalAgentImport.customize.description":
      "Select which detected items to import",
    "onboarding.welcomeV2.externalAgentImport.customize.confirm": "Confirm",
    "onboarding.welcomeV2.externalAgentImport.customize.projects": "Projects ({count})",
    "onboarding.welcomeV2.externalAgentImport.customize.projectsDescription":
      "Work inside your existing projects",
    "onboarding.welcomeV2.externalAgentImport.customize.pluginsWithCount": "Plugins ({count})",
    "onboarding.welcomeV2.externalAgentImport.error":
      "Couldn't finish the import. Try again, or skip for now.",
    "electron.onboarding.workspace.title": "Select a project",
    "electron.onboarding.workspace.subtitle":
      "Codex will be able to edit files and run commands in selected folders.",
    "electron.onboarding.workspace.openFolder": "Add project",
    "electron.onboarding.workspace.loading": "Loading projects...",
    "electron.onboarding.workspace.listLabel": "Available projects",
    "electron.onboarding.workspace.selectAll": "Select all",
    "electron.onboarding.workspace.empty": "Add a project to continue.",
    "electron.onboarding.workspace.continue": "Continue",
    "electron.onboarding.workspace.skip": "Skip",
    "electron.onboarding.workspace.skipping": "Creating a new project...",
    "electron.onboarding.workspace.skip.playground": "Continue to playground",
    "electron.onboarding.workspace.skipping.playground": "Opening playground...",
    "electron.onboarding.workspace.skip.error": "Couldn't create a new project: {message}",
    "electron.onboarding.workspace.skip.error.unknown": "Unknown error",
    "projectSetup.addProjectMenu.startFromScratch": "Start from scratch",
    "projectSetup.addProjectMenu.useExistingFolder": "Use an existing folder",
    "settings.openIn.integratedTerminalShell.label": "Integrated terminal shell",
    "settings.openIn.integratedTerminalShell.description": "Choose which shell opens in the integrated terminal.",
    "settings.openIn.integratedTerminalShell.unavailable": "No shells available",
    "settings.ide.defaultOpenTarget.label": "Default open destination",
    "settings.ide.defaultOpenTarget.description": "Where files and folders open by default",
    "settings.ide.defaultOpenTarget.placeholder": "No targets found",
    "externalAgentConfig.projectImport.title": "Select settings to import",
    "externalAgentConfig.projectImport.subtitle":
      "Codex found useful settings in another agent app",
    "externalAgentConfig.projectImport.confirm": "Continue",
    "externalAgentConfig.projectImport.cancel": "Maybe later",
    "externalAgentConfig.projectImport.error": "Could not import project settings",
    "externalAgentConfig.itemType.agentsMd": "Instructions",
    "externalAgentConfig.itemType.config": "Settings",
    "externalAgentConfig.itemType.skills": "Skills",
    "externalAgentConfig.itemType.plugins": "Plugins",
    "externalAgentConfig.itemType.subagents": "Agents",
    "externalAgentConfig.itemType.hooks": "Hooks",
    "externalAgentConfig.itemType.commands": "Commands",
    "externalAgentConfig.itemType.sessions": "Sessions",
    "externalAgentConfig.itemType.mcpServerConfig": "MCP servers",
    "settings.agent.importSettings.sectionTitle": "Import external agent config",
    "settings.agent.importSettings.sectionSubtitle":
      "Detected settings from another agent that can be added to Codex",
    "settings.agent.importSettings.loadingLabel": "Checking for imports",
    "settings.agent.importSettings.detectingDescription":
      "Checking for compatible external settings, AGENTS.md, and skills",
    "settings.agent.importSettings.sharedImportLabel": "Import another agent setup",
    "settings.agent.importSettings.sharedImportDescription":
      "Choose settings, chats, and projects from another local agent app",
    "settings.agent.importSettings.applySelected": "Import to Codex",
    "settings.agent.importSettings.remaining.summaryLabel": "{count} selected",
    "settings.agent.importSettings.remaining.summaryDescription":
      "Migrate selected settings that can’t be imported automatically",
    "settings.agent.importSettings.remaining.continueInCodex": "Continue in Codex",
    "settings.agent.importSettings.remaining.userConfigSettingsSection": "User config",
    "settings.agent.importSettings.remaining.currentProjectSettingsSection":
      "Current project",
    "settings.agent.importSettings.remaining.itemDescription":
      "Migrate {path} with Codex",
    "settings.agent.importSettings.remaining.slashCommandsLabel": "Slash commands",
    "settings.agent.importSettings.remaining.hooksLabel": "Hooks",
    "settings.agent.importSettings.remaining.mcpLabel": "MCP",
    "settings.agent.importSettings.remaining.pluginsLabel": "Plugins",
    "settings.agent.importSettings.remaining.subagentsLabel": "Subagents",
    "settings.agent.importSettings.toast.importing": "Importing agent setup",
    "settings.agent.importSettings.toast.success": "Agent setup imported",
    "settings.agent.importSettings.toast.error": "Unable to import agent setup",
    "settings.agent.importSettings.progress.close": "Close",
    "settings.agent.importSettings.progress.continueInCodex": "Continue with Codex",
    "settings.agent.importSettings.progress.scrollToBottom": "Scroll to bottom",
    "settings.agent.importSettings.progress.remainingOnlyTitle":
      "Additional setup found",
    "settings.agent.importSettings.progress.remainingOnlySubtitle":
      "Codex found additional setup that requires extra steps to import.",
    "settings.agent.importSettings.progress.successTitle":
      "Imported external agent config",
    "settings.agent.importSettings.progress.successSubtitle":
      "Selected config was copied into Codex",
    "settings.agent.importSettings.progress.errorTitle": "Import failed",
    "settings.agent.importSettings.progress.errorSubtitle":
      "Some config could not be imported. Check the selected items and try again",
    "settings.agent.importSettings.progress.runningTitle":
      "Importing external agent config",
    "settings.agent.importSettings.progress.runningSubtitle":
      "Hang tight, this may take a few moments",
    "settings.agent.importSettings.progress.userConfigSection": "User config",
    "settings.agent.importSettings.progress.currentProjectSection": "Current project",
    "wham.formattedRelativeDateTime.compactMinutesAgo": "{value}m",
    "wham.formattedRelativeDateTime.compactHoursAgo": "{value}h",
    "wham.formattedRelativeDateTime.compactDaysAgo": "{value}d",
    "wham.formattedRelativeDateTime.compactWeeksAgo": "{value}w",
    "wham.formattedRelativeDateTime.compactMonthsAgo": "{value}mo",
    "wham.formattedRelativeDateTime.compactYearsAgo": "{value}y",
    "settings.general.appearance.theme": "Theme",
    "settings.general.appearance.theme.description": "Use light, dark, or match your system",
    "settings.general.appearance.theme.light": "Light",
    "settings.general.appearance.theme.dark": "Dark",
    "settings.general.appearance.theme.system": "System",
    "settings.general.appearance.usePointerCursors.label": "Use pointer cursors",
    "settings.general.appearance.usePointerCursors.description":
      "Change the cursor to a pointer when hovering over interactive elements",
    "settings.general.appearance.sansFontSize.row": "UI font size",
    "settings.general.appearance.sansFontSize.row.description": "Adjust the base size used for the Codex UI",
    "settings.general.appearance.sansFontSize": "Sans font size",
    "settings.general.appearance.sansFontSize.units": "px",
    "settings.general.appearance.codeFontSize.row": "Code font size",
    "settings.general.appearance.codeFontSize.row.description": "Adjust the base size used for code across chats and diffs",
    "settings.general.appearance.codeFontSize": "Code font size",
    "settings.general.appearance.codeFontSize.units": "px",
    "settings.general.appearance.fontSmoothing.label": "Font Smoothing",
    "settings.general.appearance.fontSmoothing.description":
      "Use native macOS font anti-aliasing",
    "settings.general.appearance.lightChromeTheme": "Light theme",
    "settings.general.appearance.darkChromeTheme": "Dark theme",
    "settings.general.appearance.codeTheme": "{variant} code theme",
    "settings.general.appearance.codeTheme.previewGlyph": "Aa",
    "settings.general.appearance.chromeTheme.accent": "{variant} accent color",
    "settings.general.appearance.chromeTheme.accent.short": "Accent",
    "settings.general.appearance.chromeTheme.surface": "{variant} background color",
    "settings.general.appearance.chromeTheme.surface.short": "Background",
    "settings.general.appearance.chromeTheme.ink": "{variant} ink color",
    "settings.general.appearance.chromeTheme.ink.short": "Foreground",
    "settings.general.appearance.chromeTheme.uiFontFamily": "{variant} UI font",
    "settings.general.appearance.chromeTheme.uiFontFamily.short": "UI font",
    "settings.general.appearance.chromeTheme.codeFontFamily": "{variant} code font",
    "settings.general.appearance.chromeTheme.codeFontFamily.short": "Code font",
    "settings.general.appearance.chromeTheme.translucentSidebar": "{variant} translucent sidebar",
    "settings.general.appearance.chromeTheme.translucentSidebar.short": "Translucent sidebar",
    "settings.general.appearance.chromeTheme.contrast": "{variant} contrast",
    "settings.general.appearance.chromeTheme.contrast.short": "Contrast",
    "settings.general.appearance.chromeTheme.import": "Import",
    "settings.general.appearance.chromeTheme.export": "Copy theme",
    "settings.general.appearance.chromeTheme.export.success": "{variant} theme copied",
    "settings.general.appearance.chromeTheme.export.error": "Couldn’t copy {variant} theme",
    "settings.general.appearance.chromeTheme.import.success": "{variant} theme imported",
    "settings.general.appearance.chromeTheme.import.error": "Couldn’t import {variant} theme",
    "settings.general.appearance.chromeTheme.import.dialog.title": "Import theme",
    "settings.general.appearance.chromeTheme.import.dialog.ariaLabel": "{variant} theme share string",
    "settings.general.appearance.chromeTheme.import.dialog.cancel": "Cancel",
    "settings.general.appearance.chromeTheme.import.dialog.submit": "Import theme",
    "settings.configuration": "Configuration",
    "settings.backToApp": "Back to app",
    "settings.nav.back": "Back to app",
    "settings.nav.account": "Account",
    "settings.nav.connections": "Connections",
    "settings.nav.hooks-settings": "Hooks",
    "settings.title": "SETTINGS",
    "settings.nav.heading.app": "APP",
    "settings.nav.heading.host": "HOST",
    "settings.hostDropdown.local": "Local",
    "settings.hostDropdown.title": "Host",
    "settings.account.subtitle": "Manage the ChatGPT token used by the browser dev host",
    "settings.account.current.title": "Current account",
    "settings.account.authMethod": "Auth method",
    "settings.account.authMethod.chatgptToken": "ChatGPT bearer token",
    "settings.account.email": "Email",
    "settings.account.accountId": "Account ID",
    "settings.account.userId": "User ID",
    "settings.account.plan": "Plan",
    "settings.account.token.title": "Browser token",
    "settings.account.token.subtitle": "Paste a replacement token if cloud requests start failing",
    "settings.account.token.inputLabel": "ChatGPT bearer token",
    "settings.account.token.placeholder": "Bearer eyJ…",
    "settings.account.token.saved": "Token saved",
    "settings.account.token.save": "Update token",
    "settings.account.signOut": "Sign out",
    "settings.account.notAvailable": "Not available",
    "settings.agent.title": "Configuration",
    "settings.agent.configuration.subtitle.summary": "Configure approval policy and sandbox settings <a>Learn more</a>",
    "settings.agent.customConfig": "Custom config.toml settings",
    "settings.agent.openConfigToml": "Open Config.toml",
    "settings.agent.configuration.approval.label": "Approval policy",
    "settings.agent.configuration.approval.definition": "Choose when Codex asks for approval",
    "settings.agent.configuration.sandbox.label": "Sandbox settings",
    "settings.agent.configuration.sandbox.definition": "Choose how much Codex can do when running commands",
    "settings.agent.configuration.network.label": "Allow network access",
    "settings.agent.configuration.network.definition": "Allow network access when the sandbox is set to workspace write",
    "settings.agent.configuration.scope.projectGroup": "Project config",
    "settings.agent.configuration.scope.globalGroup": "Global config",
    "settings.agent.configuration.scope.open": "Open config.toml",
    "settings.agent.configuration.scope.user": "User config",
    "settings.agent.configuration.scope.managed": "Admin config",
    "settings.agent.configuration.scope.managedDescription": "Managed by admin policy",
    "settings.agent.configuration.scope.loading": "Loading…",
    "settings.agent.configuration.scope.unavailable": "Config scope unavailable.",
    "settings.agent.configuration.scope.readOnly": "This config source cannot be edited here.",
    "settings.agent.configuration.control.managed": "This value is managed by admin policy.",
    "settings.agent.configuration.configToml": "config.toml",
    "settings.agent.configuration.configToml.description": "Edit your config to customize agent behavior",
    "settings.agent.configuration.configToml.restartNote": "Restart Codex after editing to apply changes",
    "settings.agent.configuration.configToml.docs": "Docs",
    "settings.openSourceLicenses.rowLabel": "Open source licenses",
    "settings.openSourceLicenses.rowDescription": "Third-party notices for bundled dependencies",
    "settings.openSourceLicenses.view": "View",
    "settings.openSourceLicenses.back": "Back",
    "settings.openSourceLicenses.title": "Open source licenses",
    "settings.openSourceLicenses.subtitle": "Third-party notices for dependencies included in this app",
    "settings.openSourceLicenses.loading": "Loading…",
    "settings.openSourceLicenses.missing": "No third-party notices were found.",
    "settings.section.account": "Account",
    "settings.section.connections": "Connections",
    "settings.section.hooks-settings": "Hooks",
    "settings.hooks.subtitle": "Manage lifecycle hooks from config and enabled plugins <a>Learn more</a>",
    "settings.hooks.refresh": "Refresh",
    "settings.hooks.refresh.success": "Refreshed hooks",
    "settings.hooks.loadingProjects.label": "Loading projects…",
    "settings.hooks.emptyProject.label": "No project selected",
    "settings.hooks.emptyProject.description": "Open a project to view its hooks",
    "settings.hooks.loading.label": "Loading hooks…",
    "settings.hooks.loadError.label": "Could not load hooks",
    "settings.hooks.project.loading": "Select project",
    "settings.hooks.project.group": "Project",
    "settings.hooks.issues.summary":
      "{count, plural, one {# issue loading hooks for this project} other {# issues loading hooks for this project}}",
    "settings.hooks.issues.error": "{path}: {message}",
    "settings.hooks.event.counts": "{active} active · {installed} installed",
    "settings.hooks.event.emptyCounts": "0 installed",
    "settings.hooks.event.moreActions": "More actions",
    "settings.hooks.event.openSourceFile": "Open source file",
    "settings.hooks.event.managedTooltip": "Managed hooks are always on",
    "settings.hooks.event.preToolUse": "PreToolUse",
    "settings.hooks.event.preToolUse.description": "Before a tool executes",
    "settings.hooks.event.permissionRequest": "PermissionRequest",
    "settings.hooks.event.permissionRequest.description": "When permission is requested",
    "settings.hooks.event.postToolUse": "PostToolUse",
    "settings.hooks.event.postToolUse.description": "After a tool executes",
    "settings.hooks.event.preCompact": "PreCompact",
    "settings.hooks.event.preCompact.description": "Before Codex compacts the conversation",
    "settings.hooks.event.postCompact": "PostCompact",
    "settings.hooks.event.postCompact.description": "After Codex compacts the conversation",
    "settings.hooks.event.sessionStart": "SessionStart",
    "settings.hooks.event.sessionStart.description": "When a new session starts",
    "settings.hooks.event.userPromptSubmit": "UserPromptSubmit",
    "settings.hooks.event.userPromptSubmit.description": "When the user submits a prompt",
    "settings.hooks.event.stop": "Stop",
    "settings.hooks.event.stop.description": "Right before Codex ends its turn",
    "settings.hooks.event.fallbackHookTitle": "Hook {index}",
    "settings.hooks.source.plugin": "Plugin",
    "settings.hooks.source.pluginSummary": "Plugin · {pluginName}",
    "settings.hooks.source.adminConfig": "Admin config",
    "settings.hooks.source.userConfig": "User config",
    "settings.hooks.source.projectConfig": "Project config",
    "settings.hooks.source.sessionFlags": "Session flags",
    "settings.hooks.source.unknown": "Unknown source",
    "settings.mcp.loading": "Loading MCP servers…",
    "settings.mcp.loadError.title": "Unable to load MCP servers",
    "settings.mcp.loadError.retry": "Retry",
    "settings.mcp.empty": "No MCP servers connected",
    "settings.mcp.addServer": "Add server",
    "settings.mcp.myServers": "Servers",
    "settings.mcp.restartApp": "Restart",
    "settings.mcp.server.login": "Authenticate",
    "settings.mcp.server.settings": "Settings",
    "settings.mcp.server.enable": "Enable",
    "settings.mcp.readOnly": "This server is managed by project config.",
    "settings.mcp.oauth.error": "Failed to authenticate MCP server",
    "settings.mcp.refreshing": "Refreshing MCP servers…",
    "settings.mcp.detail.titleExisting": "Update {name} MCP",
    "settings.mcp.detail.titleNew": "Connect to a custom MCP",
    "settings.mcp.detail.back": "Back",
    "settings.mcp.detail.docs": "Open MCP documentation",
    "settings.mcp.detail.docs.link": "Docs",
    "settings.mcp.detail.uninstall": "Uninstall",
    "settings.mcp.detail.name": "Name",
    "settings.mcp.detail.switchTransportNotice": "If you would like to switch MCP server type, please uninstall first.",
    "settings.mcp.detail.transport.label": "Transport",
    "settings.mcp.detail.transport.stdio": "STDIO",
    "settings.mcp.detail.transport.http": "Streamable HTTP",
    "settings.mcp.detail.command": "Command to launch",
    "settings.mcp.detail.args": "Arguments",
    "settings.mcp.detail.addArgument": "Add argument",
    "settings.mcp.detail.envVars": "Environment variables",
    "settings.mcp.detail.addEnvVar": "Add environment variable",
    "settings.mcp.detail.envVarPassthrough": "Environment variable passthrough",
    "settings.mcp.detail.addEnvVarPassthrough": "Add variable",
    "settings.mcp.detail.cwd": "Working directory",
    "settings.mcp.detail.http.url": "URL",
    "settings.mcp.detail.http.bearerToken": "Bearer token env var",
    "settings.mcp.detail.http.headers": "Headers",
    "settings.mcp.detail.http.addHeader": "Add header",
    "settings.mcp.detail.http.envHeaders": "Headers from environment variables",
    "settings.mcp.detail.http.addEnvHeader": "Add variable",
    "settings.mcp.detail.save": "Save",
    "settings.mcp.detail.remove": "Remove",
    "settings.editRow.headerPlaceholder": "Key",
    "settings.editRow.valuePlaceholder": "Value",
    "settings.editRow.removeEntry": "Remove entry",
    "settings.agent.approval.untrusted": "Untrusted",
    "settings.agent.approval.onFailure": "On failure",
    "settings.agent.approval.onRequest": "On request",
    "settings.agent.approval.never": "Never",
    "settings.agent.sandbox.readOnly": "Read only",
    "settings.agent.sandbox.workspaceWrite": "Workspace write",
    "settings.agent.sandbox.fullAccess": "Full access",
    "settings.ide.language.label": "Language",
    "settings.ide.language.description": "Language for the app UI",
    "settings.ide.language.auto": "Auto Detect",
    "settings.ide.language.autoOption": "Auto Detect",
    "settings.ide.language.search": "Search languages",
    "settings.general.macMenuBar.label": "Show in menu bar",
    "settings.general.macMenuBar.description":
      "Keep Codex in the macOS menu bar when the main window is closed",
    "settings.general.macMenuBar.ariaLabel": "Show Codex in the menu bar",
    "settings.personalization.agents.title": "Custom instructions",
    "settings.personalization.agents.description": "Give Codex extra instructions and context for your project. <a>Learn more</a>",
    "settings.personalization.agents.placeholder": "Add your custom instructions...",
    "settings.personalization.agents.loading": "Loading agents.md...",
    "settings.personalization.agents.loadError": "Unable to load agents.md.",
    "settings.personalization.agents.retry": "Retry",
    "settings.personalization.agents.save": "Save",
    "settings.personalization.agents.save.success": "Saved agents.md",
    "settings.personalization.agents.save.error": "Unable to save agents.md",
    "settings.personalization.personality.label": "Personality",
    "settings.personalization.personality.description": "Choose a default tone for Codex responses",
    "settings.personalization.memory.title": "Memory (experimental)",
    "settings.personalization.memory.subtitle": "Configure how Codex collects, retains, and consolidates memories. <a>Learn more</a>",
    "settings.general.experimentalFeatures.chronicle.name": "Chronicle research preview",
    "settings.general.experimentalFeatures.chronicle.memoriesRequiredTooltip": "Enable memories to use Chronicle",
    "settings.general.experimentalFeatures.chronicle.buttonAriaLabel": "Toggle {featureName}",
    "settings.general.experimentalFeatures.chronicle.consentTitle": "Enable Chronicle research preview",
    "settings.general.experimentalFeatures.chronicle.consentBodyIntro":
      "Chronicle is an experimental feature that augments memories with context from your screen. With Chronicle enabled, Codex references what you’ve seen to provide more helpful, contextual responses to prompts like “finish what I was doing” or “update this dashboard.”",
    "settings.general.experimentalFeatures.chronicle.consentBodyConsiderations":
      "Be mindful of the following considerations before enabling Chronicle:",
    "settings.general.experimentalFeatures.chronicle.consentBodyCost":
      "<strong>Cost</strong>: Chronicle uses image inputs and runs in the background, which consumes rate limits quickly.",
    "settings.general.experimentalFeatures.chronicle.consentBodyPrivacy":
      "<strong>Privacy</strong>: Chronicle screen captures can include sensitive information visible on your screen. (It does not have access to your microphone or system audio.) Don’t use Chronicle to record meetings or communications with others without their consent. Pause Chronicle when viewing content you do not want remembered in memories.",
    "settings.general.experimentalFeatures.chronicle.consentBodyPromptInjection":
      "<strong>Prompt injection</strong>: Using Chronicle increases risk to prompt injection attacks from screen content. For instance, if you browse a site with malicious agent instructions, Codex may follow those instructions.",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageHeading": "How it works:",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageProcessing":
      "To generate memories, the screen captures are processed on our servers and then deleted.",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageLocal":
      "Screen captures are temporarily stored on device, and memories are also stored on device. Both are stored unencrypted, so be aware that other applications on your computer may have access to these files. When Codex uses memories in a chat, they may be used to improve our models, if allowed in your ChatGPT settings.",
    "settings.general.experimentalFeatures.chronicle.consentBodyDisableIntro":
      "You can disable Chronicle at any time, which will stop screen captures going forward. <link>Learn more.</link>",
    "settings.general.experimentalFeatures.chronicle.cancel": "Cancel",
    "settings.general.experimentalFeatures.chronicle.continue": "Continue",
    "settings.general.experimentalFeatures.chronicle.description":
      "Augment memories with screen context so Codex can help with anything you’re working on. <link>Learn more</link>",
    "settings.general.experimentalFeatures.chronicle.permission.runningStatus": "Status: {status}",
    "settings.general.experimentalFeatures.chronicle.permission.runningStatusAccessibility":
      "Accessibility: {status} (open setup)",
    "settings.general.experimentalFeatures.chronicle.permission.screenRecording": "Screen Recording",
    "settings.general.experimentalFeatures.chronicle.permission.statusLabel": "Status",
    "settings.general.experimentalFeatures.chronicle.permission.notGranted":
      "{statusLabel}: {permission} permission not granted (open setup)",
    "settings.general.experimentalFeatures.chronicle.permission.accessibility": "Accessibility",
    "settings.general.experimentalFeatures.chronicle.permission.status": "{permission}: {status}",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.paused": "Paused",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.starting": "Starting",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.stopping": "Stopping",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.running": "Running",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.checking": "Checking",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.unknown": "Unknown",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.granted": "Granted",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.notDetermined": "Not requested",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.denied": "Denied",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.restricted": "Restricted",
    "settings.general.experimentalFeatures.chronicle.screenRecordingSettingsName": "Screen Recording",
    "settings.general.experimentalFeatures.chronicle.accessibilitySettingsName": "Accessibility",
    "settings.general.experimentalFeatures.chronicle.setupTitle": "Setting up Chronicle",
    "settings.general.experimentalFeatures.chronicle.openScreenRecordingSettings": "Open System Settings",
    "settings.general.experimentalFeatures.chronicle.openAccessibilitySettings": "Open System Settings",
    "settings.general.experimentalFeatures.chronicle.askCodex": "Try it out",
    "settings.general.experimentalFeatures.chronicle.setupClose": "Close",
    "settings.general.experimentalFeatures.chronicle.permissionDragAppLabel":
      "Drag Codex into {permissionSettingsName} settings",
    "settings.general.experimentalFeatures.chronicle.permissionDragApp":
      "If {bundleName} doesn't appear in the list, drag this app icon into {permissionSettingsName} settings",
    "settings.general.experimentalFeatures.chronicle.setupReadyTitle": "Chronicle is ready to use!",
    "settings.general.experimentalFeatures.chronicle.setupFailedTitle": "Chronicle setup failed",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingPermissionNeededTitle":
      "Allow Screen Recording to use Chronicle",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityPermissionNeededTitle":
      "Allow Accessibility to use Chronicle",
    "settings.general.experimentalFeatures.chronicle.setupInProgressTitle": "Setting up Chronicle",
    "settings.general.experimentalFeatures.chronicle.setupWaiting": "Waiting…",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingRestricted":
      "Screen Recording is restricted by macOS or your organization. Chronicle will continue automatically if the restriction is removed and Codex receives Screen Recording permission.",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingDenied":
      "Please open System Settings → Privacy & Security → Screen Recording and enable {bundleName}. You may need to restart Codex to apply the change.",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityRestricted":
      "Accessibility is restricted by macOS or your organization. Chronicle will continue automatically if the restriction is removed and Codex receives Accessibility permission",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityDenied":
      "Please open System Settings → Privacy & Security → Accessibility and enable {bundleName}.",
    "settings.general.experimentalFeatures.chronicle.setupReady":
      "You can pause Chronicle at any time by clicking \"Pause Chronicle\" in the Codex menu bar.",
    "settings.general.experimentalFeatures.chronicle.setupFailed": "Chronicle setup failed.",
    "settings.personalization.pets.title": "Pets",
    "settings.personalization.pets.current": "{petName} selected",
    "settings.personalization.pets.openPet": "Wake Pet",
    "settings.personalization.pets.tuckAwayPet": "Tuck Away Pet",
    "settings.personalization.avatars.select": "Select",
    "settings.personalization.avatars.selected": "Selected",
    "settings.pets.custom.title": "Custom pets",
    "settings.pets.custom.openFolder": "Open folder",
    "settings.pets.custom.openFolderError": "Unable to open pet folder",
    "settings.pets.refresh": "Refresh",
    "settings.pets.loadingCustom": "Loading custom pets",
    "settings.pets.loadCustomError": "Unable to load custom pets",
    "settings.pets.custom.create.title": "Create your own pet",
    "settings.memory.enableMemoriesLabel": "Enable memories",
    "settings.memory.enableMemoriesDescription": "Generate new memories from chats and bring them into new chats",
    "settings.memory.enableMemoriesAriaLabel": "Enable memories",
    "settings.memory.noToolContextLabel": "Skip tool-assisted chats",
    "settings.memory.noToolContextDescription": "Do not generate memories from chats that used MCP tools or web search",
    "settings.memory.noToolContextAriaLabel": "Skip tool-assisted chats",
    "settings.memory.resetMemoriesLabel": "Reset memories",
    "settings.memory.resetMemoriesDescription": "Delete all Codex memories",
    "settings.memory.resetMemoriesButton": "Reset",
    "settings.memory.resetDialogTitle": "Reset all memories?",
    "settings.memory.resetDialogSubtitle": "This deletes all Codex memories.",
    "settings.memory.resetDialogCancel": "Cancel",
    "settings.memory.resetDialogConfirm": "Reset",
    "settings.memory.resetSuccess": "Memories reset",
    "settings.memory.resetError": "Unable to reset memories",
    "composer.personalitySlashCommand.label.friendly": "Friendly",
    "composer.personalitySlashCommand.description.friendly": "Warm, collaborative, and helpful",
    "composer.personalitySlashCommand.label.pragmatic": "Pragmatic",
    "composer.personalitySlashCommand.description.pragmatic": "Concise, task-focused, and direct",
    "auth.signOut": "Sign out",
    "auth.signInWithChatGpt": "Sign in with ChatGPT",
    "auth.apiKey": "API key",
    "auth.useApiKey": "Use API Key",
    "auth.deviceCode": "Device code",
    "auth.useDeviceCode": "Use device code",
    "auth.checking": "Checking",
    "auth.signingIn": "Signing in",
    "auth.signedOut": "Signed out",
    "auth.ready": "Ready",
    "auth.chatGpt": "ChatGPT",
    "auth.openAiApiKey": "OpenAI API key",
    "auth.loginRequired": "Login required",
    "auth.cancel": "Cancel",
    "auth.cancelSignIn": "Cancel Sign-in",
    "auth.apiKeyPlaceholder": "sk-...",
    "auth.apiKeyConfirm": "OK",
    "auth.completeBrowserSignIn": "Complete sign-in in your browser.",
    "auth.openBrowser": "Open browser",
    "auth.copy": "Copy",
    "electron.onboarding.login.snake.start": "Play Snake",
    "electron.onboarding.login.welcomeV2.title": "Get started with Codex",
    "electron.onboarding.login.chatgpt.signIn": "Sign in with ChatGPT",
    "electron.onboarding.login.chatgpt.cancel.welcomeV2": "Cancel sign-in",
    "electron.onboarding.login.apikey.open.welcomeV2": "Sign in another way",
    "electron.onboarding.login.apikey.label": "OpenAI API key",
    "electron.onboarding.login.apikey.placeholder": "sk-…",
    "electron.onboarding.login.apikey.cancel": "Cancel",
    "electron.onboarding.login.apikey.continue": "Continue",
    "electron.onboarding.login.browserPending.welcomeV2": "Continue signing in with your browser",
    "electron.onboarding.login.signup.welcomeV2": "Sign up",
    "electron.onboarding.login.includedPlans.welcomeV2": "Included with all ChatGPT plans",
    "avatarOverlay.statusRunning": "Running",
    "avatarOverlay.statusRunningSubtitle": "Thinking",
    "avatarOverlay.statusWaiting": "Needs input",
    "avatarOverlay.statusReview": "Ready",
    "avatarOverlay.statusFailed": "Blocked",
    "avatarOverlay.statusInfo": "Info",
    "avatarOverlay.session.calledTool": "Called tool",
    "avatarOverlay.session.callingTool": "Calling tool",
    "avatarOverlay.session.callingToolName": "Calling {toolName}",
    "avatarOverlay.session.editedFiles": "Edited {fileCount} files",
    "avatarOverlay.session.editingFiles": "Editing {fileCount} files",
    "avatarOverlay.session.newThread": "New chat",
    "avatarOverlay.session.ranCommand": "Ran command",
    "avatarOverlay.session.runningCommand": "Running command",
    "avatarOverlay.openNotification": "Open notification",
    "avatarOverlay.dismissNotification": "Dismiss {title}",
    "avatarOverlay.dismissNotificationTooltip": "Dismiss",
    "avatarOverlay.replyNotification": "Reply to {title}",
    "avatarOverlay.replyNotificationButton": "Reply",
    "avatarOverlay.sendNotificationReply": "Send reply to {title}",
    "avatarOverlay.notificationReplyPlaceholder": "Reply",
    "avatarOverlay.notificationReplyError": "Unable to send reply",
    "avatarOverlay.expandNotification": "Expand {title}",
    "avatarOverlay.collapseNotification": "Collapse {title}",
    "avatarOverlay.expandNotificationTooltip": "Expand",
    "avatarOverlay.collapseNotificationTooltip": "Collapse",
    "avatarOverlay.collapseNotificationTray": "Collapse activity",
    "avatarOverlay.notificationList": "Activity notifications",
    "avatarOverlay.latestNotifications": "Latest",
    "avatarOverlay.showLatestNotifications": "Show latest activity",
    "avatarOverlay.showOlderNotifications": "Show {count} older activity items",
    "avatarOverlay.olderNotificationCount": "{count} more",
    "avatarOverlay.compactOlderNotificationCount": "+{count}",
    "avatarOverlay.toggleNotificationTray": "Open activity tray, {count} items",
    "petOverlay.mascotLabel": "{petName} pet",
    "petOverlay.closePet": "Close pet",
    "history.noMessageYet": "(no message yet)",
    ...PULL_REQUESTS_PAGE_MESSAGES["en-US"],
    ...AUTOMATIONS_PAGE_MESSAGES["en-US"],
  },
  "zh-CN": {
    "app.menu.file": "文件",
    "app.menu.edit": "编辑",
    "app.menu.view": "查看",
    "app.menu.window": "窗口",
    "app.menu.help": "帮助",
    "app.nav.newChat": "新对话",
    "app.nav.search": "搜索",
    "app.nav.settings": "设置",
    "skills.appsPage.heading.plugins": "插件",
    "skills.appsPage.subheading.plugins": "插件让 Codex 按你的方式运行。",
    "skills.appsPage.search.plugins": "搜索插件",
    "skills.appsPage.search.plugins.label": "搜索插件",
    "skills.appsPage.loading": "正在加载应用…",
    "skills.appsPage.loadError.title": "无法加载应用",
    "skills.appsPage.loadError.retry": "重试",
    "skills.appsPage.empty.plugins": "未找到插件",
    "skills.appsPage.manageTab.plugins": "插件",
    "skills.appsPage.manageTab.marketplace": "市场",
    "skills.appsPage.marketplace.loading": "正在加载市场…",
    "skills.appsPage.marketplace.loadError.title": "无法加载插件市场",
    "skills.appsPage.marketplace.loadError.retry": "重试",
    "skills.appsPage.empty.marketplace": "未找到任何市场",
    "skills.appsPage.marketplace.pluginCount": "{count, plural, one {# 个插件} other {# 个插件}}",
    "skills.appsPage.marketplace.upgrade.ariaLabel": "升级市场",
    "skills.appsPage.marketplace.upgrade.button": "升级",
    "skills.appsPage.marketplace.upgrade": "升级市场",
    "skills.appsPage.marketplace.upgrade.builtInDisabled": "内置市场由 Codex 升级",
    "skills.appsPage.marketplace.upgrade.workspaceDisabled": "工作区市场由工作区管理",
    "skills.appsPage.marketplace.upgrade.localDisabled": "只能升级 Git 市场",
    "skills.appsPage.marketplace.remove": "移除市场",
    "skills.appsPage.marketplace.remove.ariaLabel": "移除市场",
    "skills.appsPage.marketplace.remove.builtInDisabled": "无法移除内置市场",
    "skills.appsPage.marketplace.remove.workspaceDisabled": "工作区市场由工作区管理",
    "skills.appsPage.marketplace.removeDialog.title": "是否移除“{marketplaceName}”？",
    "skills.appsPage.marketplace.removeDialog.description":
      "Codex 将从你的配置中移除此市场。除非再次添加该市场，否则其中的插件将不再显示",
    "skills.appsPage.marketplace.removeDialog.cancel": "取消",
    "skills.appsPage.marketplace.removeDialog.confirm": "移除",
    "skills.appsPage.marketplace.partialLoadError.title": "部分插件市场无法加载",
    "skills.appsPage.marketplace.partialLoadError.more":
      "{count, plural, one {还有 # 个市场无法加载} other {还有 # 个市场无法加载}}",
    "skills.appsPage.marketplace.partialLoadError.retry": "重试",
    "skills.appsPage.addMarketplace.title": "添加插件市场",
    "skills.appsPage.addMarketplace.header": "添加插件市场",
    "skills.appsPage.addMarketplace.subtitle": "从 GitHub 仓库、Git URL 或本地文件夹添加插件市场",
    "skills.appsPage.addMarketplace.sourceRequired": "请输入市场来源",
    "skills.appsPage.addMarketplace.sourceLabel": "来源",
    "skills.appsPage.addMarketplace.sourcePlaceholder": "openai/plugins 或 git@github.com:org/repo.git",
    "skills.appsPage.addMarketplace.refLabel": "Git 引用",
    "skills.appsPage.addMarketplace.refPlaceholder": "main",
    "skills.appsPage.addMarketplace.sparsePathsLabel": "稀疏路径",
    "skills.appsPage.addMarketplace.sparsePathsPlaceholder": "plugins/codex",
    "skills.appsPage.addMarketplace.cancel": "取消",
    "skills.appsPage.addMarketplace.submit": "添加市场",
    "skills.appsPage.addMarketplace.failed": "添加插件市场失败",
    "skills.appsPage.addMarketplace.refreshFailed": "{marketplaceName} 市场已配置，但刷新插件列表失败",
    "skills.appsPage.addMarketplace.alreadyAdded": "{marketplaceName} 已添加",
    "skills.appsPage.addMarketplace.success": "已添加 {marketplaceName} 市场",
    "skills.appsPage.pluginsUnsupportedHost.title": "此主机不支持插件",
    "skills.appsPage.pluginsUnsupportedHost.description": "请选择其他主机以浏览和管理插件",
    "skills.appsPage.browseIntro.title": "让 Codex 按你的方式工作",
    "skills.appsPage.hostDropdown.local": "本地",
    "skills.appsPage.hostDropdown.title": "主机",
    "skills.appsPage.pluginsFilter.all": "全部插件",
    "skills.appsPage.categoryFilter.all": "全部",
    "skills.appsPage.categoryFilter.trigger": "分类",
    "skills.appsPage.categoryDropdown.ariaLabel": "选择分类",
    "skills.appsPage.browseDropdown.ariaLabel": "选择插件市场",
    "skills.appsPage.marketplaceFilter.addMore": "添加更多",
    "skills.page.heading": "技能",
    "skills.page.subheading": "赋予 Codex 更强大的能力。<a>了解更多</a>",
    "skills.page.loading": "正在加载技能…",
    "skills.page.empty": "找不到技能",
    "skills.page.filteredEmpty": "没有符合筛选条件的技能",
    "skills.page.filteredEmptyDescription": "尝试调整你的搜索内容或范围筛选条件",
    "skills.page.search": "搜索技能",
    "skills.page.search.label": "搜索技能",
    "skills.page.createSkill": "新建技能",
    "skills.page.refreshSkills": "刷新",
    "skills.page.refreshSkillsToUseNew": "刷新以使用新技能",
    "skills.page.refreshFailed": "无法加载技能",
    "skills.pluginsAuthBlockedToast.title": "使用插件需要通过 ChatGPT 登录",
    "skills.pluginsAuthBlockedToast.description":
      "使用 API 密钥登录时无法使用插件。请通过 ChatGPT 登录以浏览和安装插件。",
    "skills.section.installed": "已安装",
    "skills.section.recommended": "推荐",
    "settings.nav.skills-settings": "技能",
    "skills.card.enabledStatus": "已启用",
    "skills.card.disabledStatus": "已禁用",
    "skills.card.loadingContents": "正在加载技能内容…",
    "skills.card.contentsError": "无法加载技能内容。",
    "skills.card.removeSuccess": "{skillName} 技能已卸载",
    "skills.card.removeFailed": "无法卸载技能",
    "skills.card.toggleEnabledError": "无法更新技能",
    "skills.card.disabledBadge": "已禁用",
    "skills.card.open": "打开",
    "skills.card.moreActions": "更多操作",
    "skills.card.details": "详情",
    "skills.card.uninstall": "卸载",
    "skills.card.try": "在对话中试用",
    "skills.card.enableSuccess": "{skillName} 技能已启用",
    "skills.card.disableSuccess": "{skillName} 技能已禁用",
    "skills.card.enableSkill": "启用技能",
    "skills.card.disableSkill": "禁用技能",
    "skills.appsPage.manageTab.apps": "应用",
    "skills.appsPage.manageTab.mcps": "MCP 服务器",
    "skills.appsPage.manageTab.skills": "技能",
    "skills.appsPage.empty.installedApps": "没有已安装的应用",
    "skills.appsPage.empty.mcps": "没有 MCP 服务器",
    "skills.appsPage.empty.skills": "没有已安装的技能",
    "skills.appsPage.marketplace.upgradeAll": "全部升级",
    "skills.appsPage.marketplace.upgradeAll.tooltip": "升级所有可升级的市场",
    "skills.appsPage.mcps.settings": "打开 MCP 设置",
    "skills.appsPage.mcps.enable": "启用 MCP 服务器",
    "skills.appsPage.mcps.disable": "禁用 MCP 服务器",
    "skills.appsPage.mcps.toggle": "切换 MCP 服务器启用状态",
    "skills.appsPage.mcps.toggleError": "更新 MCP 服务器失败",
    "skills.appsPage.apps.toggle": "切换应用启用状态",
    "skills.appsPage.apps.toggleError": "更新应用失败",
    "skills.appsPage.skills.enable": "启用技能",
    "skills.appsPage.skills.disable": "禁用技能",
    "skills.appsPage.skills.toggle": "切换技能启用状态",
    "skills.appsPage.skills.toggleError": "更新技能失败",
    "skills.appsPage.toolsDialog.open": "前往 ChatGPT 管理",
    "skills.appsPage.toolsDialog.moreActions": "更多操作",
    "skills.appsPage.toolsDialog.enableApp": "启用应用",
    "skills.appsPage.toolsDialog.disableApp": "禁用应用",
    "skills.appsPage.toolsDialog.tryInChat": "在对话中试用",
    "skills.appsPage.toolsDialog.tryInChatDisabled": "启用并连接此应用，即可在对话中试用",
    "skills.appsPage.toolsDialog.disabledBadge": "已禁用",
    "skills.appsPage.toolsDialog.subtitle": "此应用的可用工具",
    "skills.appsPage.toolsDialog.summary": "{appName} 应用包含 {totalActions} 项操作（{actionTypes}）",
    "skills.appsPage.toolsDialog.loading": "正在加载工具…",
    "skills.appsPage.toolsDialog.empty": "此应用暂无可用工具。",
    "skills.appsPage.toolsDialog.error": "无法加载此应用的工具。",
    "plugins.card.enableToggleTooltip": "启用插件",
    "plugins.card.disableToggleTooltip": "禁用插件",
    "plugins.card.toggleAria": "切换插件启用状态",
    "plugins.card.enabledStatus": "插件已启用",
    "plugins.card.disabledStatus": "插件已禁用",
    "plugins.card.enableButton": "启用",
    "plugins.card.installTooltip": "安装插件",
    "plugins.card.tryInChat": "在聊天中试用",
    "plugins.card.enableSuccess": "{pluginName} 插件已启用",
    "plugins.card.disableSuccess": "{pluginName} 插件已禁用",
    "plugins.card.toggleError": "更新插件失败",
    "plugins.importedConnectors.title": "已导入的插件",
    "plugins.importedConnectors.empty": "没有已导入的插件",
    "plugins.importedConnectors.finishSetup": "完成设置",
    "plugins.hero.tryInChat": "在聊天中试用",
    "plugins.hero.dotLabel": "前往第 {index} 个插件幻灯片",
    "plugins.hero.copy.computerUse": "播放一个帮助我进入状态的歌单",
    "plugins.hero.copy.gmail": "帮我起草所有积压邮件的回复",
    "plugins.hero.copy.slack": "每天早上帮我准备 standup",
    "plugins.hero.copy.googleCalendar": "安排一个周期性的 1:1",
    "plugins.hero.copy.googleDrive": "每周五帮我起草周报",
    "plugins.hero.copy.linear": "把这次 bug bash 发现整理成工单",
    "skills.recommended.error": "无法加载推荐技能",
    "skills.scope.builtIn": "系统",
    "skills.scope.team": "团队",
    "skills.scope.personal": "个人",
    "skills.scope.adminInstalled": "管理员安装",
    "plugins.marketplace.removeSuccess": "已移除 {marketplaceName} 市场",
    "plugins.marketplace.removeError": "移除市场失败",
    "plugins.marketplace.upgradeAllSuccess": "市场已升级",
    "plugins.marketplace.upgradeSuccess": "{marketplaceName} 市场已升级",
    "plugins.marketplace.upgradeAllError": "部分市场升级失败",
    "plugins.marketplace.upgradeError": "升级市场失败",
    "plugins.marketplace.upgradeAllRequestError": "升级市场失败",
    "plugins.installModal.about": "关于",
    "plugins.installModal.capabilities": "能力",
    "plugins.installModal.developedBy": "由 {developerName} 开发",
    "plugins.installModal.includes": "包含",
    "plugins.installModal.includes.apps": "应用",
    "plugins.installModal.includes.skills": "技能",
    "plugins.installModal.includes.mcpServers": "MCP 服务器",
    "plugins.installModal.install": "安装 {pluginName}",
    "plugins.installModal.installing": "正在安装 {pluginName}",
    "plugins.installModal.metadata.category": "分类：{category}",
    "plugins.installModal.title": "安装 {pluginName}",
    "plugins.installModal.finishSetup.title": "完成 {pluginName} 设置",
    "plugins.installModal.finishSetup.description":
      "完成剩余步骤后，Codex 才能使用这个插件。",
    "plugins.installModal.requiredApps": "必需应用",
    "plugins.installModal.requiredApps.connected": "已连接",
    "plugins.installModal.requiredApps.connecting": "连接中…",
    "plugins.installModal.requiredApps.connect": "连接",
    "plugins.installModal.browserExtensions": "浏览器扩展",
    "plugins.installModal.browserExtension.description":
      "在 Chrome 中安装此扩展，让 Codex 能连接到你的浏览器",
    "plugins.installModal.done": "完成",
    "plugins.install.ready": "{pluginName} 已可使用",
    "plugins.install.success": "{pluginName} 已安装",
    "plugins.install.error": "安装插件失败",
    "plugins.install.refreshError":
      "已安装 {pluginName}，但刷新插件状态失败",
    "codexMobile.homeBanner.title": "介绍 Codex mobile",
    "codexMobile.homeBanner.body": "在手机上使用桌面电脑上的 Codex 能力",
    "codexMobile.homeBanner.primary": "开始设置",
    "codexMobile.homeBanner.dismiss": "关闭 Codex mobile 横幅",
    "codexMobile.setupDialog.close": "关闭",
    "codexMobile.setupDialog.initial.title": "设置 Codex mobile",
    "codexMobile.setupDialog.initial.heading": "设置 Codex mobile",
    "codexMobile.setupDialog.initial.description":
      "在电脑保持唤醒时，通过手机上的 ChatGPT 应用继续使用 Codex",
    "codexMobile.setupDialog.initial.feature.threads":
      "访问你的所有线程和项目，并创建新的线程",
    "codexMobile.setupDialog.initial.feature.notifications":
      "当 Codex 桌面端完成任务或需要你处理时接收通知",
    "codexMobile.setupDialog.initial.feature.actions":
      "随时随地使用完整的 Codex 能力，包括在你的电脑上执行操作",
    "codexMobile.setupDialog.initial.skip": "稍后在设置中配置",
    "codexMobile.setupDialog.initial.primary": "开始",
    "codexMobile.setupDialog.initial.startSetupError":
      "无法检查安全要求。请重试",
    "codexMobile.setupDialog.allowHost.title": "允许手机控制这台电脑",
    "codexMobile.setupDialog.allowHost.heading": "允许手机控制这台电脑",
    "codexMobile.setupDialog.allowHost.description":
      "允许 Codex mobile 访问这台电脑，这样你就能在手机上继续工作",
    "codexMobile.setupDialog.allowHost.primary": "允许",
    "codexMobile.setupDialog.mfaRequired.title": "开启多重身份验证",
    "codexMobile.setupDialog.mfaRequired.heading": "开启多重身份验证",
    "codexMobile.setupDialog.mfaRequired.description":
      "为了确保始终由你控制设备，你需要先为 ChatGPT 账户开启多重身份验证。",
    "codexMobile.setupDialog.mfaRequired.primary": "继续前往 chatgpt.com",
    "codexMobile.setupDialog.waiting.title": "在移动设备上批准",
    "codexMobile.setupDialog.waiting.heading": "在移动设备上批准",
    "codexMobile.setupDialog.waiting.description":
      "请在已登录 ChatGPT 的移动设备上批准该连接请求。",
    "codexMobile.setupDialog.connected.title": "已连接",
    "codexMobile.setupDialog.connected.heading": "已连接",
    "codexMobile.setupDialog.connected.description":
      "充分利用 Codex mobile。你之后也可以在设置中更改这些选项。",
    "codexMobile.setupDialog.connected.keepAwake.title": "让这台电脑保持唤醒",
    "codexMobile.setupDialog.connected.keepAwake.description":
      "在 Codex 运行时阻止电脑进入睡眠。",
    "codexMobile.setupDialog.connected.keepAwake.toggle":
      "让这台电脑保持唤醒",
    "codexMobile.setupDialog.connected.computerUse.title":
      "启用 Computer Use",
    "codexMobile.setupDialog.connected.computerUse.description":
      "允许 Codex 控制你 Mac 上的应用。",
    "codexMobile.setupDialog.connected.computerUse.toggle":
      "启用 Computer Use",
    "codexMobile.setupDialog.connected.chromeExtension.title":
      "安装 Chrome 扩展",
    "codexMobile.setupDialog.connected.chromeExtension.description":
      "让 Codex 能在网站上导航并填写表单。",
    "codexMobile.setupDialog.connected.finish": "完成设置",
    "app.shell.appMenu": "应用菜单",
    "app.shell.back": "返回",
    "app.shell.forward": "前进",
    "app.shell.toggleSidebar": "显示或隐藏侧边栏",
    "app.shell.settings": "设置",
    "app.shell.share": "共享",
    "codex.alert.closeAriaLabel": "关闭",
    "codex.archiveInfo.electron": "查看已归档的聊天：{settingsLink}",
    "codex.archiveInfo.settingsLink": "设置",
    "codex.signInFailed.message": "登录失败：{rawMessage}",
    "codex.legal.step.intro.title": "在 IDE 中使用 Codex",
    "codex.legal.step.intro.subtitle":
      "Codex 能直接在代码仓库内导航、编辑、运行命令、执行测试，均由你的 ChatGPT 帐户提供支持。",
    "codex.legal.step.cloud.title": "移交云端 Codex 处理",
    "codex.legal.step.cloud.subtitle": "将任务发送至 Codex 后台运行，让你保持专注，提高效率​。",
    "codex.legal.step.todo.title": "将 TODO 转为 Codex 任务",
    "codex.legal.step.todo.subtitle": "编写 TODO 注释并一键转为 Codex 任务。",
    "codex.legal.autonomy.title": "设定授予的自主权限程度",
    "codex.legal.autonomy.details": "有关详情，请查看{link}",
    "codex.legal.autonomy.details.link": "Codex 文档",
    "codex.legal.mistakes.title": "Codex 也可能会犯错",
    "codex.legal.mistakes.review": "审查其编写的代码和执行的命令",
    "codex.legal.powered.title": "由你的 ChatGPT 帐户提供支持",
    "codex.legal.powered.details": "使用套餐的速率限制和{link}",
    "codex.legal.powered.details.link": "训练数据偏好设置",
    "codex.legal.copilot.title": "由 GitHub Copilot 提供支持",
    "codex.legal.copilot.details":
      "你的 Copilot 套餐适用于模型调用、计费与速率限制。使用 Codex 扩展程序时需同时遵守 {oaiTos} 和 {gitHubTos}。",
    "codex.legal.copilot.oaiTosLink": "OpenAI Codex 服务条款",
    "codex.legal.copilot.gitHubTosLink": "GitHub 服务条款",
    "codex.legal.backButton": "返回",
    "codex.legal.continueButton": "下一步",
    "codex.legal.continue.apikey": "继续",
    "codex.legal.cloud.taskOne.title": "为新设计师讲解代码仓库",
    "codex.legal.cloud.taskOne.meta": "openai/agi · 10 月 12 日",
    "codex.legal.cloud.taskTwo.title": "修复引导流程错误",
    "codex.legal.cloud.taskTwo.meta": "openai/agi · 10 月 9 日",
    "codex.legal.cloud.taskTwo.stats.positive": "+2",
    "codex.legal.cloud.taskTwo.stats.negative": "-20",
    "codex.legal.cloud.taskThree.title": "创建深色模式主题",
    "codex.legal.cloud.taskThree.meta": "openai/codex · 10 月 8 日",
    "codex.legal.cloud.taskThree.stats.positive": "+249",
    "codex.legal.cloud.taskThree.stats.negative": "-123",
    "codex.legal.todo.heading": "// TODO：实现架构",
    "app.chat.noRecentThreads": "暂无最近会话",
    "app.chat.noMessages": "暂无消息",
    "app.chat.changedFiles": "{fileCount} 个文件已更改",
    "app.chat.undo": "撤销",
    "app.chat.viewDiff": "查看差异",
    "app.chat.commit": "提交",
    "app.chat.projects": "项目",
    "app.chat.filesChanged": "{fileCount} 个文件已更改",
    "app.chat.composePlaceholder": "可向 Codex 询问任何事。输入 @ 使用插件或提及文件",
    "composer.placeholder.newTask.doAnything": "向 Codex 下达任意指令​",
    "composer.footer.v2.cloudTab": "云端",
    "composer.mode.worktreeSegment": "工作树",
    "composer.hotkeyWindow.modeDropdown.localProject": "本地项目",
    "composer.hotkeyWindow.modeDropdown.tooltip": "选择任务的运行位置",
    "composer.mode.local": "在本地运行",
    "composer.hotkeyWindow.modeDropdown.localOnly": "初始化 Git 仓库后才能在工作树中运行任务",
    "composer.mode.worktree": "新工作树",
    "app.chat.send": "发送",
    "app.chat.stop": "停止",
    "app.chat.queuedFollowUps": "排队中的跟进（{count}）",
    "commentAttachments.numAnnotations": "{count, plural, one {# 条批注} other {# 条批注}}",
    "commentAttachments.numComments": "{count, plural, other {# 个评论}}",
    "app.chat.removeQueuedFollowUp": "移除",
    "app.chat.commandExecution": "命令",
    "app.chat.fileChange": "文件修改",
    "app.chat.hookPrompt": "钩子提示",
    "localConversation.hookItem.eventName.preToolUse": "调用工具前",
    "localConversation.hookItem.eventName.postToolUse": "调用工具后",
    "localConversation.hookItem.eventName.sessionStart": "会话开始",
    "localConversation.hookItem.eventName.userPromptSubmit": "用户提示提交",
    "localConversation.hookItem.eventName.permissionRequest": "权限请求",
    "localConversation.hookItem.eventName.stop": "停止",
    "localConversation.hookItem.summary.withStatusMessage": "{eventName} - {statusMessage}",
    "localConversation.hookItem.summary.ariaLabel": "{summary} {status}",
    "localConversation.hookItem.feedback": "反馈",
    "localConversation.hookItem.warning": "警告",
    "localConversation.hookItem.error": "错误",
    "localConversation.hookItem.hookContext": "钩子上下文",
    "localConversation.hookItem.stop": "停止",
    "app.chat.contextCompaction": "上下文已压缩",
    "app.chat.contextCompactionDescription": "较早的对话上下文已被压缩。",
    "app.chat.imageGeneration": "已生成图片",
    "app.chat.collabAgentToolCall": "智能体工具调用",
    "app.chat.mcpServer": "MCP 服务器",
    "app.chat.mcpTool": "工具",
    "app.chat.agentTool": "智能体工具",
    "app.chat.senderThread": "发送线程",
    "app.chat.receiverThreads": "接收线程",
    "homePage.mainContent": "主要内容",
    "home.hero.letsBuild": "开始构建",
    "threadPage.newThread": "新聊天",
    "hotkeyWindow.dismiss": "关闭弹出窗口",
    "hotkeyWindow.defaultTitle": "Codex",
    "hotkeyWindow.threadPage.newButton": "开始新聊天",
    "hotkeyWindow.threadPage.openInMainWindow": "在主窗口中打开",
    "app.chat.revisedPrompt": "修订后的提示词",
    "app.chat.prompt": "提示词",
    "app.chat.model": "模型",
    "app.chat.reasoningEffort": "推理强度",
    "app.chat.agentStatus": "智能体状态",
    "app.chat.savedPath": "保存路径",
    "app.chat.toolNamespace": "命名空间",
    "app.chat.toolCallFailed": "工具调用失败。",
    "app.chat.output": "输出",
    "app.chat.noOutput": "尚无输出",
    "hotkeyWindow.home.placeholder.unknownProject": "此项目",
    "hotkeyWindow.home.placeholder.projectless": "在本地向 Codex 询问任何事",
    "hotkeyWindow.home.placeholder.cloud": "在云端向 Codex 询问任何事",
    "hotkeyWindow.home.placeholder.worktree": "在 {project} 的工作树中向 Codex 询问任何事",
    "hotkeyWindow.home.placeholder.local": "在 {project} 本地向 Codex 询问任何事",
    "hotkeyWindow.home.taskMenu.startIn.projectlessTooltip": "无项目聊天仅能在本地运行",
    "hotkeyWindow.home.taskMenu.startIn.disabledTooltip": "初始化 Git 仓库后才能在云端或工作树中启动",
    "hotkeyWindow.home.taskMenu.label": "任务设置",
    "hotkeyWindow.home.taskMenu.project": "项目",
    "hotkeyWindow.home.taskMenu.startIn": "启动位置",
    "hotkeyWindow.home.taskMenu.environment": "环境",
    "hotkeyWindow.home.taskMenu.branch": "分支",
    "hotkeyWindow.home.taskMenu.permissions": "权限",
    "composer.permissionsDropdown.default.label": "默认权限",
    "composer.permissionsDropdown.default.optionLabel": "默认权限",
    "composer.permissionsDropdown.default.tooltip": "Codex 在沙盒中自动运行命令",
    "composer.permissionsDropdown.guardianApproval.shortLabel": "自动审核",
    "composer.permissionsDropdown.guardianApproval.tooltip":
      "Codex 将在沙盒中运行命令，并对需升级处理的请求进行自动审查。<link>了解更多</link>",
    "composer.permissionsDropdown.guardianApproval.disabled":
      "要使用自动审查，此工作空间必须提供默认沙盒权限",
    "composer.mode.agentMode.guardianApprovals": "自动审核",
    "composer.permissionsDropdown.fullAccess.label": "完全访问权限",
    "composer.permissionsDropdown.fullAccess.optionLabel": "完全访问权限",
    "composer.permissionsDropdown.agentMode.tooltip.fullAccess":
      "Codex 对你的计算机拥有完全访问权限（风险升高）",
    "composer.permissionsDropdown.fullAccess.disabled":
      "完整访问权限已被 requirements.toml 禁用",
    "composer.permissionsDropdown.fullAccess.disabledGlobalDefault":
      "完全访问权限不能设为全局默认权限",
    "composer.permissionsDropdown.custom.label": "自定义",
    "composer.permissionsDropdown.custom.optionLabel": "自定义（config.toml）",
    "composer.permissionsDropdown.agentMode.tooltip.custom":
      "Codex 使用 config.toml 中定义的权限",
    "composer.permissionsDropdown.disabled.requirements":
      "权限被 requirements.toml 锁定",
    "composer.permissionsDropdown.trigger.tooltip": "更改权限",
    "composer.mode.agentMode.fullAccessConfirm.title": "启用完全访问权限？",
    "composer.mode.agentMode.fullAccessConfirm.description":
      "当 Codex 以完全访问权限运行时，无需你批准，即可编辑你的电脑上的任何文件并运行联网命令",
    "composer.mode.agentMode.fullAccessConfirm.caution":
      "启用完全访问权限时请务必谨慎。这会显著增加数据丢失、泄露或意外行为的风险。",
    "composer.mode.agentMode.fullAccessConfirm.goBack": "取消",
    "composer.mode.agentMode.fullAccessConfirm.confirm": "是的，仍要继续",
    "composer.remote.currentBranch": "{branch}（当前）",
    "composer.remote.branch": "{branch}",
    "composer.remote.localWorkingTree": "使用本地更改",
    "composer.remote.localFileStateHeading": "本地文件状态",
    "composer.remote.currentEditsSuffix.useLocal": "包含本地代码改动",
    "composer.remote.branchStartingPoint": "此任务应从哪个分支开始？",
    "composer.remote.branchesSectionHeading": "分支",
    "codex.composer.searchBranches": "搜索分支",
    "composer.remote.errorLoadingBranches": "加载分支时出错",
    "composer.remote.loadingMoreBranches": "正在加载…",
    "composer.footer.branchSwitch.tooltip": "切换分支",
    "composer.footer.branchSwitch.checkoutError": "切换分支失败：{message}",
    "composer.footer.branchSwitch.createBranchError": "创建分支失败：{message}",
    "composer.footer.branchSwitch.uncommittedSummaryPrefix":
      "未提交：{fileCount, plural, one {# 个文件} other {# 个文件}}",
    "composer.footer.branchSwitch.createAndCheckout.disabledTooltip":
      "请先提交更改，然后再创建并切换到新分支",
    "composer.footer.branchSwitch.createAndCheckout": "创建并切换到新分支…",
    "composer.footer.branchSwitch.createDialog.title": "创建并切换分支",
    "composer.footer.branchSwitch.createDialog.placeholder": "new-branch",
    "composer.footer.branchSwitch.createDialog.ariaLabel": "分支名称",
    "composer.footer.branchSwitch.createDialog.trailingSlashError":
      "分支名称不能以“/”结尾。",
    "composer.footer.branchSwitch.createDialog.branchExistsError": "分支已存在。",
    "composer.footer.branchSwitch.createDialog.close": "关闭",
    "composer.footer.branchSwitch.createDialog.createAndCheckout": "创建并切换",
    "composer.footer.branchSwitch.uncommittedDialog.title": "提交更改以切换分支",
    "composer.footer.branchSwitch.uncommittedDialog.conflict.bodyPrefix":
      "以下文件上的更改会在切换分支时被覆盖：",
    "composer.footer.branchSwitch.uncommittedDialog.conflict.bodySuffix":
      "请先提交更改以继续",
    "composer.footer.branchSwitch.uncommittedDialog.body.noDiff":
      "请先提交 {fileCount, plural, one {# 个文件} other {# 个文件}} 中的更改，然后再切换到 {branchName}。",
    "composer.footer.branchSwitch.uncommittedDialog.targetBranchFallback": "所选分支",
    "composer.footer.branchSwitch.uncommittedDialog.cancel": "取消",
    "composer.footer.branchSwitch.uncommittedDialog.commit": "提交并切换分支…",
    "composer.footer.branchSwitch.commitDialog.title": "提交更改",
    "composer.footer.branchSwitch.commitDialog.subtitle":
      "提交当前更改后，Codex 会继续切换到 {branchName}。",
    "composer.footer.branchSwitch.commitDialog.messageLabel": "提交信息",
    "composer.footer.branchSwitch.commitDialog.messagePlaceholder": "描述当前更改",
    "composer.footer.branchSwitch.commitDialog.cancel": "取消",
    "composer.footer.branchSwitch.commitDialog.commit": "提交更改",
    "composer.contextWindowUsageLabel": "上下文窗口：",
    "composer.contextWindowUsageStatusFull": "已占满 {usage}%",
    "composer.contextWindowUsageStatusLeft": "已使用 {usage}%（剩余 {remaining}%）",
    "composer.contextWindowUsageTooltip": "已使用 {usedTokens}k / {contextWindow}k tokens",
    "composer.contextWindow.usagePercent": "{usage}%",
    "composer.contextWindow.autoCompactionTooltipLine1": "Codex 会在上下文接近满载时自动压缩上下文",
    "composer.pendingThreadGoal.summary": "目标",
    "composer.pendingThreadGoal.editTooltip": "编辑目标",
    "composer.pendingThreadGoal.edit": "编辑目标",
    "composer.pendingThreadGoal.clearTooltip": "清除目标",
    "composer.pendingThreadGoal.clear": "清除目标",
    "composer.threadGoalEditor.editTitle": "编辑目标",
    "composer.threadGoalEditor.createTitle": "设置目标",
    "composer.threadGoalEditor.objectiveAriaLabel": "目标内容",
    "composer.threadGoalEditor.objectivePlaceholder": "Codex 应持续朝什么目标推进？",
    "composer.threadGoalEditor.useDraft": "使用当前草稿",
    "composer.threadGoalEditor.cancel": "取消",
    "composer.threadGoalEditor.save": "保存目标",
    "composer.threadGoalEditor.set": "设置目标",
    "composer.threadGoal.editTooltip": "编辑目标",
    "composer.threadGoal.edit": "编辑目标",
    "composer.threadGoal.pauseTooltip": "暂停目标",
    "composer.threadGoal.pause": "暂停目标",
    "composer.threadGoal.resumeTooltip": "恢复目标",
    "composer.threadGoal.resume": "恢复目标",
    "composer.threadGoal.clearTooltip": "清除目标",
    "composer.threadGoal.clear": "清除目标",
    "composer.threadGoal.expand": "展开目标详情",
    "composer.threadGoal.collapse": "收起目标详情",
    "composer.threadGoal.summary.active": "目标",
    "composer.threadGoal.summary.paused": "目标已暂停",
    "composer.threadGoal.summary.budgetLimited": "目标受预算限制",
    "composer.threadGoal.summary.complete": "目标已完成",
    "composer.threadGoal.status.active": "进行中",
    "composer.threadGoal.status.paused": "已暂停",
    "composer.threadGoal.status.budgetLimited": "受预算限制",
    "composer.threadGoal.status.complete": "已完成",
    "composer.threadGoal.tokenUsage": "{used} / {budget} tokens",
    "composer.threadGoal.setError": "设置目标失败",
    "composer.threadGoal.statusUpdateError": "更新目标失败",
    "composer.threadGoal.clearError": "清除目标失败",
    "localConversation.sync.modal.noChanges": "没有更改",
    "review.commit.form.title": "提交你的更改",
    "review.commit.form.commitTo": "分支",
    "review.commit.form.commitTo.none": "-",
    "review.commit.form.changesToBeCommitted": "更改",
    "review.commit.messageLabel": "提交信息",
    "review.commit.messagePlaceholder": "留空以自动生成提交信息",
    "review.commit.customInstructionsLink": "自定义说明",
    "review.commit.includeUnstaged": "包含未暂存更改",
    "review.commit.ariaLabel.includeUnstaged": "包含未暂存更改",
    "review.commit.loading.title.createDraftPr": "正在创建草稿 PR",
    "review.commit.loading.title.createPr": "正在创建 PR",
    "review.commit.form.continue": "继续",
    "review.commit.rows.fileCount": "{count, plural, one {# 个文件} other {# 个文件}}",
    "review.commit.generate.emptyResponse": "无法生成提交信息。",
    "review.commit.generate.failed": "生成提交信息失败：{error}",
    "localConversationPage.createPullRequestError": "创建拉取请求失败",
    "localConversationPage.createDraftPullRequestButtonLabel": "创建草稿 PR",
    "localConversationPage.createPullRequestButtonLabel": "创建 PR",
    "localConversation.syncSetup.branchName": "分支名称",
    "localConversation.syncSetup.setPrefix": "设置前缀",
    "localConversation.syncSetup.branchesLoading": "正在加载分支…",
    "localConversation.syncSetup.noBranches": "未找到分支",
    "composer.reviewMode.branches.error": "无法加载分支",
    "composer.reviewMode.branches.retry": "重试",
    "review.commit.buttonLabel": "提交",
    "localConversation.gitActions.createBranch": "创建分支",
    "localConversationPage.gitActions": "Git 操作",
    "localConversation.pullRequest.actions.viewPr": "查看 PR",
    "localConversation.pullRequest.actions.statusTitle": "PR 状态",
    "review.gitActions.prStatus.loading": "正在加载 PR 状态…",
    "review.gitActions.prStatus.notInstalled": "未安装 GitHub CLI",
    "review.gitActions.prStatus.notAuthenticated": "GitHub CLI 未认证",
    "review.gitActions.prStatus.notAuthenticatedHint": "请检查 GitHub CLI 认证后重试",
    "review.gitActions.prStatus.noBranch": "未选择分支",
    "review.gitActions.prStatus.loadError": "无法加载拉取请求",
    "review.gitActions.prStatus.available": "已有拉取请求",
    "review.gitActions.prStatus.none": "此分支没有打开的 PR",
    "review.gitActions.prState.draft": "草稿拉取请求",
    "review.gitActions.prState.merged": "已合并",
    "review.gitActions.prState.checksFailing": "检查失败",
    "review.gitActions.prState.checksInProgress": "检查进行中",
    "review.gitActions.prState.changesRequested": "请求修改",
    "review.gitActions.prState.approved": "已批准",
    "review.gitActions.prState.ready": "可合并",
    "app.chat.exitCode": "退出码",
    "app.chat.durationMs": "耗时（毫秒）",
    "app.chat.movedTo": "移动到",
    "app.chat.status.inProgress": "进行中",
    "app.chat.status.completed": "已完成",
    "app.chat.status.failed": "失败",
    "app.chat.status.declined": "已拒绝",
    "app.chat.approval.commandTitle": "命令审批",
    "app.chat.approval.fileChangeTitle": "文件修改审批",
    "app.chat.approval.review": "请先审查并响应，以继续当前回合。",
    "app.chat.approval.reason": "原因",
    "app.chat.approval.command": "命令",
    "app.chat.approval.workingDirectory": "工作目录",
    "app.chat.approval.networkAccess": "请求的网络访问",
    "app.chat.approval.protocol": "协议",
    "app.chat.approval.host": "主机",
    "app.chat.approval.commandActions": "解析出的命令动作",
    "app.chat.approval.additionalPermissions": "请求的额外权限",
    "app.chat.approval.execPolicyAmendment": "建议的后续命令放行规则",
    "app.chat.approval.networkPolicyAmendments": "建议的后续网络规则",
    "app.chat.approval.requestedWriteRoot": "请求的写入根目录",
    "app.chat.approval.changes": "变更",
    "app.chat.approval.noChanges": "该请求未附带文件变更内容。",
    "app.chat.approval.accept": "接受",
    "app.chat.approval.acceptForSession": "本次会话接受",
    "app.chat.approval.decline": "拒绝",
    "app.chat.approval.cancel": "取消",
    "app.chat.approval.submitting": "正在提交响应...",
    "app.chat.implementPlan.prompt": "实施此计划？",
    "app.chat.implementPlan.implement": "是，实施此计划",
    "app.chat.implementPlan.otherPlaceholder": "否，请告知 Codex 如何调整",
    "app.chat.implementPlan.dismiss": "忽略",
    "app.chat.implementPlan.submit": "提交",
    "app.chat.planImplementation": "实施计划",
    "app.chat.userInput.title": "需要用户输入",
    "app.chat.userInput.submit": "提交答案",
    "app.chat.userInput.otherHint": "如有需要，可手动输入其他答案。",
    "app.chat.userInput.secretHint": "该答案可能包含敏感输入。",
    "app.chat.userMessage.autoResolveSync": "自动解决冲突",
    "app.chat.userMessage.commentCount": "{count, plural, other {# 个评论}}",
    "app.chat.userMessage.copyAriaLabel": "复制消息",
    "app.chat.userMessage.copyCopiedAriaLabel": "已复制",
    "app.chat.userMessage.copyCopiedTooltip": "已复制",
    "app.chat.userMessage.copyTooltip": "复制",
    "app.chat.userMessage.editAriaLabel": "编辑消息",
    "app.chat.userMessage.editTooltip": "编辑",
    "app.chat.userMessage.editTextareaAriaLabel": "编辑消息",
    "app.chat.userMessage.editPlaceholder": "编辑消息",
    "app.chat.userMessage.cancelEditMessage": "取消",
    "app.chat.userMessage.sendEditedMessage": "发送",
    "app.chat.userMessage.goal": "目标",
    "app.chat.userMessage.showLess": "收起",
    "app.chat.userMessage.showMore": "显示更多",
    "app.chat.userMessage.implementPlan": "实现计划",
    "app.chat.userMessage.noContent": "（无内容）",
    "app.chat.userMessage.pullRequestCheckCount": "{count, plural, one {# 个 CI 测试} other {# 个 CI 测试}}",
    "app.chat.userMessage.pullRequestFixMode": "PR 修复",
    "app.chat.userMessage.pullRequestMergeTask": "PR #{number}",
    "app.chat.userMessage.referencesPriorConversation": "参考历史对话",
    "app.chat.userMessage.reviewMode": "审查模式",
    "app.chat.latestTurnPreview.items": "{count, plural, one {# 个项目} other {# 个项目}}",
    "app.chat.permissions.title": "权限请求",
    "app.chat.permissions.network": "网络",
    "app.chat.permissions.networkEnabled": "该请求需要网络访问权限。",
    "app.chat.permissions.fileSystem": "文件系统",
    "app.chat.permissions.read": "读取权限",
    "app.chat.permissions.write": "写入权限",
    "app.chat.permissions.entries": "详细条目",
    "app.chat.permissions.strictAutoReview": "在本回合中后续命令执行前逐条审查",
    "app.chat.permissions.grantTurn": "本回合允许",
    "app.chat.permissions.grantSession": "本会话允许",
    "app.chat.permissions.deny": "拒绝",
    "app.chat.mcpElicitation.title": "{serverName} 请求",
    "app.chat.mcpElicitation.url": "打开链接",
    "app.chat.mcpElicitation.accept": "接受",
    "app.chat.mcpElicitation.decline": "拒绝",
    "app.chat.mcpElicitation.cancel": "取消",
    "app.chat.mcpElicitation.submit": "提交响应",
    "app.chat.mcpElicitation.required": "必填",
    "app.chat.mcpElicitation.booleanEnabled": "启用此选项",
    "app.chat.mcpElicitation.unsupportedField": "该字段类型尚未完整支持，当前展示原始 schema 供审查。",
    "localConversation.scrollToBottomButton": "滚动到底部",
    "composer.latestTurn": "最新一轮",
    "composer.latestTurn.working": "处理中",
    "composer.reviewMode.title": "代码审查",
    "composer.reviewMode.option.unstaged.simple": "审查未提交的更改",
    "thinkingShimmer.default": "正在思考",
    "wham.whamProposedTask.title": "建议的任务",
    "localConversation.planSummary.title": "计划",
    "localConversation.planSummary.titleWriting": "正在编写计划",
    "localConversation.planSummary.download": "下载计划",
    "localConversation.planSummary.copy": "复制计划",
    "localConversation.planSummary.openInNewWindow": "打开",
    "localConversation.planSummary.expand": "展开计划摘要",
    "localConversation.planSummary.collapse": "折叠计划摘要",
    "localConversation.planSummary.viewPlan": "展开计划",
    "avatarOverlay.session.readFile": "已读取 {fileName}",
    "avatarOverlay.session.readingFile": "正在读取 {fileName}",
    "avatarOverlay.session.listedFiles": "已列出文件",
    "avatarOverlay.session.listingFiles": "正在列出文件",
    "avatarOverlay.session.searchedFiles": "已搜索文件",
    "avatarOverlay.session.searchedQuery": "已搜索“{query}”",
    "avatarOverlay.session.searchingFiles": "正在搜索文件",
    "avatarOverlay.session.searchingQuery": "正在搜索“{query}”",
    "avatarOverlay.session.searchedWeb": "已搜索网页",
    "codex.webSearch.summary": "{label}{details}",
    "codex.webSearch.summary.details": "（{query}）",
    "codex.webSearch.summary.verb.completed": "已搜索网页",
    "codex.webSearch.summary.verb.inProgress": "正在搜索网页",
    "avatarOverlay.session.calledToolName": "已调用 {toolName}",
    "thread.browser.emptyState.title": "开始浏览",
    "thread.browser.emptyState.description": "输入 URL 以打开页面",
    "codex.remoteConversation.codexCloudTask": "你正在查看一个 <u>Codex cloud</u> 任务",
    "codex.remoteConversation.viewPreviousTurns": "在网页中打开",
    "codex.remoteConversation.viewPreviousTurns.buttonTooltip": "在网页中打开",
    "codex.remoteConversation.viewPreviousTurns.buttonText": "打开",
    "codex.remoteConversation.openInWeb": "在网页中打开",
    "codex.remoteConversation.errorWithMessage": "错误：{message}",
    "remoteConversation.environmentSetup.failed": "环境设置失败",
    "remoteConversation.environmentSetup.running": "正在设置环境",
    "remoteConversation.environmentSetup.output.empty": "等待输出…",
    "codex.remoteConversation.userImageAttachment": "用户附件",
    "codex.remoteConversation.closeImagePreview": "关闭图片预览",
    "codex.remoteConversation.loadingImage": "正在加载图片",
    "codex.localConversation.userImageAttachment": "用户附件",
    "codex.localConversation.closeImagePreview": "关闭图片预览",
    "imagePreviewDialog.label": "图片预览",
    "imagePreviewDialog.close": "关闭图片预览",
    "imagePreviewDialog.download": "下载图片",
    "imagePreviewDialog.zoomIn": "放大图片",
    "imagePreviewDialog.zoomOut": "缩小图片",
    "imagePreviewDialog.previousImage": "上一张图片",
    "imagePreviewDialog.nextImage": "下一张图片",
    "artifactPdfPreview.annotate": "批注",
    "artifactPdfPreview.annotating": "批注中",
    "artifactPdfPreview.commentInput": "PDF 注释",
    "artifactPdfPreview.commentMarkerLabel": "PDF 注释 {commentNumber}",
    "markdown.videoPlayer": "视频",
    "markdown.videoUnavailable": "视频不可用",
    "markdown.imagePreviewButton": "打开图片预览",
    "markdown.imageUnavailable": "图片不可用",
    "markdown.imageLoading": "图片加载中",
    "codex.remoteConversation.taskFailed": "任务失败",
    "codex.remoteConversation.turnFailed": "此任务执行期间发生错误",
    "codex.remoteConversation.turnTab.title": "尝试 {number}",
    "codex.remoteConversation.turnTab.loading": "尝试 {number}",
    "codex.remoteConversation.applyDiff.apply": "应用",
    "codex.remoteConversation.applyDiff.revert": "还原",
    "codex.remoteConversation.applyDiff.dropdownTitle": "将更改应用到本地分支",
    "codex.remoteConversation.applyDiff.applyCta": "应用更改",
    "codex.remoteConversation.applyDiff.revertCta": "还原更改",
    "codex.applyDropdown.header.title": "应用更改",
    "codex.applyDropdown.header.changes": "更改",
    "codex.applyDropdown.header.fileCount": "{count, plural, one {# 个文件} other {# 个文件}}",
    "codex.applyDropdown.header.rows": "行",
    "codex.applyDropdown.header.workspace": "项目",
    "codex.applyDropdown.results.empty": "没有复制任何文件",
    "codex.applyDropdown.results.skipped": "{count, plural, one {已跳过 1 个文件：} other {已跳过 {count} 个文件：}}",
    "codex.applyDropdown.results.conflicted": "{count, plural, one {1 个文件冲突：} other {{count} 个文件冲突：}}",
    "codex.applyOrRevertBanner.apply": "应用",
    "codex.applyOrRevertBanner.reapply": "重新应用",
    "codex.applyOrRevertBanner.revert": "还原",
    "codex.applyOrRevertBanner.applyMessage": "要应用这些更改并在本地继续吗？",
    "codex.applyOrRevertBanner.revertMessage": "要还原已应用的更改吗？",
    "codex.applyOrRevertBanner.applyMessageDifferentEnvironment": "此任务是在 {environment} 中创建的，可能无法直接应用。",
    "codex.applyOrRevertBanner.applyMessageDifferentEnvironment.tooltip": "这些更改是在 {environment} 中产生的，可能无法直接应用。",
    "codex.applyResultsDialog.title": "应用结果",
    "codex.applyResultsDialog.applied": "已干净应用（{count}）",
    "codex.applyResultsDialog.conflicted": "有冲突（{count}）",
    "codex.applyResultsDialog.skipped": "已跳过（{count}）",
    "codex.applyResultsDialog.notGitRepo": "此操作仅在 Git 仓库中可用。",
    "codex.applyResultsDialog.noDetails": "没有可显示的文件详情。",
    "codex.applyResultsDialog.close": "关闭",
    "codex.diffView.applyPatchNotGitRepo": "无法应用更改：不是 git 仓库",
    "codex.diffView.revertPatchNotGitRepo": "无法还原更改：不是 git 仓库",
    "codex.diffView.applyPatchSuccess": "已应用更改",
    "codex.diffView.revertPatchSuccess": "已还原更改",
    "codex.diffView.applyPatchPartialSuccess": "部分更改已应用",
    "codex.diffView.revertPatchPartialSuccess": "部分更改已还原",
    "codex.diffView.applyPatchError": "无法应用更改",
    "codex.diffView.revertPatchError": "无法还原更改",
    "localConversation.remoteTaskCreated": "已在 Codex Cloud 中创建{taskLink}",
    "localConversation.remoteTaskCreated.task": "任务",
    "localConversation.dynamicToolCall": "{toolName}",
    "localConversation.appControlToolCall.appHelp.active": "正在检查线程操作",
    "localConversation.appControlToolCall.appHelp.completed": "已检查线程操作",
    "localConversation.appControlToolCall.threadsCreate.active": "正在创建新线程",
    "localConversation.appControlToolCall.threadsCreate.completed": "已创建新线程",
    "localConversation.appControlToolCall.threadsCreateInWorktree.active": "正在创建工作树线程",
    "localConversation.appControlToolCall.threadsCreateInWorktree.completed": "已创建工作树线程",
    "localConversation.appControlToolCall.threadsList.active": "正在列出线程",
    "localConversation.appControlToolCall.threadsList.completed": "已列出线程",
    "localConversation.appControlToolCall.threadsRead.active": "正在阅读对话串",
    "localConversation.appControlToolCall.threadsRead.completed": "已读讨论串",
    "localConversation.appControlToolCall.threadsSendMessage.active": "正在向线程发送消息",
    "localConversation.appControlToolCall.threadsSendMessage.completed": "已向线程发送消息",
    "localConversation.appControlToolCall.threadsSetArchived.active": "正在更新线程归档",
    "localConversation.appControlToolCall.threadsSetArchived.completed": "已更新线程归档状态",
    "localConversation.appControlToolCall.threadsSetPinned.active": "正在更新线程置顶状态",
    "localConversation.appControlToolCall.threadsSetPinned.completed": "已更新线程置顶",
    "localConversation.appControlToolCall.threadsSetTitle.active": "正在重命名线程",
    "localConversation.appControlToolCall.threadsSetTitle.completed": "线程已重命名",
    "localConversation.header.heartbeatAutomationNextRun": "下次运行：{nextRunLabel}",
    "localConversation.header.openHeartbeatAutomation": "打开心跳自动化",
    "localConversation.multiAgentAction.header": "{action}{countLabel}",
    "localConversation.multiAgentAction.header.count":
      " {count, plural, one {# 个智能体} other {# 个智能体}}",
    "localConversation.multiAgentAction.header.close.completed": "已关闭",
    "localConversation.multiAgentAction.header.close.failed": "关闭失败",
    "localConversation.multiAgentAction.header.close.inProgress": "正在关闭",
    "localConversation.multiAgentAction.header.resume.completed": "已恢复",
    "localConversation.multiAgentAction.header.resume.failed": "恢复失败",
    "localConversation.multiAgentAction.header.resume.inProgress": "正在恢复",
    "localConversation.multiAgentAction.header.sendInput.completed": "已发送消息",
    "localConversation.multiAgentAction.header.sendInput.failed": "发送消息失败",
    "localConversation.multiAgentAction.header.sendInput.inProgress": "正在发送消息",
    "localConversation.multiAgentAction.header.spawn.completed": "已创建",
    "localConversation.multiAgentAction.header.spawn.failed": "创建失败",
    "localConversation.multiAgentAction.header.spawn.inProgress": "正在创建",
    "localConversation.multiAgentAction.row.generic": "{action}",
    "localConversation.multiAgentAction.row.agent": "{action} {agent}{stateSuffix}",
    "localConversation.multiAgentAction.row.spawn.createdWithInstructions":
      "已根据以下指令创建 {agent}：{instructions}",
    "localConversation.multiAgentAction.row.sendInput.messagedWithPrompt":
      "{action} {agent}：{prompt}",
    "localConversation.multiAgentAction.rowAction.close.completed": "已关闭",
    "localConversation.multiAgentAction.rowAction.close.failed": "关闭失败",
    "localConversation.multiAgentAction.rowAction.close.inProgress": "正在关闭",
    "localConversation.multiAgentAction.rowAction.resume.completed": "已恢复",
    "localConversation.multiAgentAction.rowAction.resume.failed": "恢复失败",
    "localConversation.multiAgentAction.rowAction.resume.inProgress": "正在恢复",
    "localConversation.multiAgentAction.rowAction.sendInput.completed": "已发送消息",
    "localConversation.multiAgentAction.rowAction.sendInput.failed": "发送消息失败",
    "localConversation.multiAgentAction.rowAction.sendInput.inProgress": "正在发送消息",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.completed": "已发送消息",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.failed": "无法发送消息",
    "localConversation.multiAgentAction.rowAction.sendInput.messaged.inProgress": "正在发送消息",
    "localConversation.multiAgentAction.rowAction.spawn.completed": "已创建",
    "localConversation.multiAgentAction.rowAction.spawn.failed": "创建失败",
    "localConversation.multiAgentAction.rowAction.spawn.inProgress": "正在创建",
    "localConversation.multiAgentAction.meta.prompt": "输入：{prompt}",
    "localConversation.multiAgentAction.agentState.pendingInit": "待定初始化",
    "localConversation.multiAgentAction.agentState.running": "正在运行",
    "localConversation.multiAgentAction.agentState.interrupted": "已中断",
    "localConversation.multiAgentAction.agentState.shutdown": "关闭",
    "localConversation.multiAgentAction.agentState.completed": "已完成",
    "localConversation.multiAgentAction.agentState.errored": "出错",
    "localConversation.multiAgentAction.agentState.notFound": "找不到",
    "localConversation.personalityChanged": "已切换为 {personality} 个性",
    "localConversation.autoReviewInterruptionWarning": "回合已由自动审核结束",
    "localConversation.autoReviewInterruptionWarning.nextSteps":
      "因多次被拒绝，自动审查已停止本轮操作。请添加更多上下文或选择其他权限模式以继续。",
    "localConversation.automaticApprovalReview.summary.inProgress":
      "经优化提示的审查智能体正在审查此请求，随后 Codex 才会执行此请求。",
    "localConversation.automaticApprovalReview.summary.aborted":
      "经优化提示的审查智能体在 Codex 运行此请求之前，停止了对此请求的审查。",
    "localConversation.automaticApprovalReview.summary.timedOut":
      "经优化提示的审查智能体在 Codex 运行此请求前已超时。",
    "localConversation.automaticApprovalReview.summary.completed":
      "经优化提示的审查智能体已审查此请求。",
    "localConversation.automaticApprovalReview.title.inProgress": "自动审核中",
    "localConversation.automaticApprovalReview.title.approved": "自动审核已批准",
    "localConversation.automaticApprovalReview.title.denied": "自动审核已拒绝",
    "localConversation.automaticApprovalReview.title.deniedHighRisk":
      "自动审核已拒绝高风险操作",
    "localConversation.automaticApprovalReview.title.timedOut": "自动审核超时",
    "localConversation.automaticApprovalReview.title.aborted": "自动审核已停止",
    "localConversation.modelChanged": "模型已从 {fromModel} 更改为 {toModel}。",
    "localConversation.modelChanged.warning.line1": "在对话中途切换模型会降低性能表现。",
    "localConversation.modelChanged.warning.line2": "背景信息可能会自动压缩。",
    "localConversation.parentThread": "父聊天",
    "localConversation.forkedFromConversation": "从对话中派生",
    "codex.localConversation.comment.screenshotAttached": "已附加截图",
    "codex.localConversation.pdfComment.annotationAttached": "已附加 PDF 批注",
    "codex.localConversation.browserComment.selectedElement": "已选中页面元素",
    "codex.localConversation.diffCommentLeftSide": "左",
    "codex.localConversation.diffCommentRightSide": "右",
    "localConversation.modelRerouted": "你的请求已转发至 {toModel}。",
    "localConversation.modelRerouted.warning.line1": "请注意，你的请求已被转发，以降低网络滥用风险。",
    "localConversation.modelRerouted.warning.line2":
      "认为这是误操作？可通过 <link>chatgpt.com/cyber 申请复核</link>或通过 /feedback 报告",
    "codex.review.noDiff": "尚无文件更改",
    "codex.review.noDiff.baseDescription": "此项目中的更改将显示在此处。",
    "codex.review.noDiff.orNoLongerAvailable": "最新差异已不可用。",
    "codex.review.noDiff.gitRepoRequired.title": "创建 Git 仓库",
    "codex.review.noDiff.gitRepoRequired.description": "在此项目中跟踪、审查并撤销更改。",
    "codex.review.noDiff.gitInit.success": "Git 仓库已创建",
    "codex.review.noDiff.gitInit.createRepository": "创建 git 仓库",
    "codex.review.noDiff.gitInit.creating": "正在创建…",
    "codex.review.noDiff.gitInit.error": "Git 初始化失败：{message}",
    "codex.review.header.moreOptions": "查看选项",
    "codex.review.wrap.enable": "启用自动换行",
    "codex.review.wrap.disable": "禁用自动换行",
    "codex.review.expandOrCollapseDiffMenu.collapse": "折叠全部差异",
    "codex.review.expandOrCollapseDiffMenu.expand": "展开全部差异",
    "codex.review.loadFullFiles.enable": "加载完整文件",
    "codex.review.loadFullFiles.disable": "不加载完整文件",
    "codex.review.diff.fullContentLoadFailed": "完整文件内容加载失败",
    "codex.common.retry": "重试",
    "dictation.error.connection": "检查连接后重试",
    "dictation.error.microphoneMissing": "连接麦克风以使用听写功能",
    "dictation.error.microphonePermissionDenied": "要使用听写功能，请允许访问麦克风",
    "dictation.error.microphoneUnavailable": "关闭其他正在使用麦克风的应用",
    "dictation.error.unsupported": "此设备不支持听写",
    "composer.dictation.startError": "无法开始听写",
    "composer.dictation.transcribeError": "无法转录音频",
    "globalDictation.dismissError": "关闭",
    "globalDictation.listening": "正在听写",
    "globalDictation.retry": "重试",
    "globalDictation.transcribing": "转写中…",
    "globalDictation.waveformAriaLabel": "全局听写波形",
    "codex.review.richPreview.enable": "启用富文本预览",
    "codex.review.richPreview.disable": "禁用富文本预览",
    "codex.review.wordDiffs.enable": "启用文字差异",
    "codex.review.wordDiffs.disable": "禁用文字差异",
    "codex.review.whitespace.show": "显示空白字符",
    "codex.review.whitespace.hide": "隐藏空白字符",
    "codex.review.copyGitApplyCommand": "复制 git apply 命令",
    "codex.review.copyGitApplyCommand.toast": "已将 git apply 命令复制到剪贴板",
    "codex.review.switchToSplit": "切换到分栏差异",
    "codex.review.switchToUnified": "切换到统一差异",
    "codex.review.refreshGitQueries": "刷新",
    "codex.unifiedDiff.reviewChanges": "审查更改",
    "thread.sidePanel.browserTab": "浏览器",
    "thread.sidePanel.diffTab": "审查",
    "thread.sidePanel.empty.title": "这里还没有内容",
    "thread.sidePanel.openFile": "打开文件",
    "thread.sidePanel.openBrowserTab": "浏览器",
    "thread.sidePanel.openReviewTab": "审查",
    "thread.sidePanel.openTab": "打开侧边面板标签页",
    "thread.sidePanel.toggle": "显示/隐藏侧边栏",
    "codex.rightPanel.expandFullWidth": "展开面板",
    "codex.rightPanel.restoreWidth": "恢复面板宽度",
    "codex.tabs.closeNamed": "关闭 {title} 标签页",
    "codex.tabs.contextMenu.close": "关闭标签页",
    "thread.fileCommandMenu.filesGroup": "文件",
    "thread.fileCommandMenu.searchFiles": "搜索文件",
    "threadSidePanel.workspaceBrowser.loading": "正在加载目录内容…",
    "threadSidePanel.workspaceBrowser.empty": "此文件夹中没有文件",
    "codex.fileTreeSearch.label": "筛选文件",
    "codex.fileTreeSearch.placeholder": "筛选文件…",
    "codex.fileTreeSearch.clear": "清除文件筛选",
    "codex.review.fileSearch.empty": "没有匹配的文件",
    "thread.fileTreePanel.noMatchingFiles": "没有匹配的文件",
    "thread.fileTreePanel.searchingFiles": "正在搜索文件…",
    "review.fileSource.breadcrumb.ariaLabel": "文件路径",
    "review.fileSource.breadcrumb.openInEditor.ariaLabel": "在编辑器中打开",
    "review.fileSource.breadcrumb.openInEditor.tooltip": "在编辑器中打开",
    "review.fileSource.options": "文件预览选项",
    "review.fileSource.copyPath": "复制路径",
    "review.fileSource.error": "无法加载文件",
    "review.fileSource.loading": "正在加载文件…",
    "review.fileSource.tooLarge": "文件过大，无法预览",
    "review.fileSource.tooLargeDetail": "{size} 已超出 {limit} 的预览上限",
    "review.fileSource.unsupported.archive": "暂不支持预览压缩包",
    "review.fileSource.unsupported.audio": "暂不支持预览音频",
    "review.fileSource.unsupported.excelSpreadsheet": "暂不支持预览 Excel 电子表格",
    "review.fileSource.unsupported.keynoteDeck": "暂不支持预览 Keynote 演示文稿",
    "review.fileSource.unsupported.numbersSpreadsheet": "暂不支持预览 Numbers 表格",
    "review.fileSource.unsupported.opendocumentPresentation": "暂不支持预览 OpenDocument 演示文稿",
    "review.fileSource.unsupported.opendocumentSpreadsheet": "暂不支持预览 OpenDocument 电子表格",
    "review.fileSource.unsupported.opendocumentText": "暂不支持预览 OpenDocument 文本",
    "review.fileSource.unsupported.pagesDocument": "暂不支持预览 Pages 文档",
    "review.fileSource.unsupported.powerpointDeck": "暂不支持预览 PowerPoint 演示文稿",
    "review.fileSource.unsupported.richTextDocument": "暂不支持预览富文本文档",
    "review.fileSource.unsupported.video": "暂不支持预览视频",
    "review.fileSource.unsupported.wordDocument": "暂不支持预览 Word 文档",
    "review.fileSource.unsupportedDetail": "请在 Codex 外部打开该文件查看",
    "review.fileSource.richPreview.enable": "启用增强视图",
    "review.fileSource.richPreview.disable": "禁用增强视图",
    "review.fileSource.wrap.enable": "启用自动换行",
    "review.fileSource.wrap.disable": "禁用自动换行",
    "codex.filePreview.pdb.empty": "未找到 PDB 原子",
    "codex.filePreview.pdb.modelSelectLabel": "选择 PDB 模型",
    "codex.filePreview.pdb.modelOption": "模型 {modelNumber}",
    "codex.filePreview.pdb.resetView": "重置视图",
    "codex.filePreview.pdb.residueCount": "{count, number} 个残基",
    "codex.filePreview.pdb.atomCount": "{count, number} 个原子",
    "codex.filePreview.pdb.scoreSummary": "B 因子/pLDDT {mean}",
    "codex.filePreview.pdb.viewerLabel": "交互式 PDB 结构查看器",
    "codex.filePreview.pdb.viewerLoadError": "无法加载 3Dmol PDB 查看器",
    "codex.filePreview.pdb.legendVeryHigh": "90+",
    "codex.filePreview.pdb.legendConfident": "70-90",
    "codex.filePreview.pdb.legendLow": "50-70",
    "codex.filePreview.pdb.legendVeryLow": "<50",
    "codex.filePreview.pdb.interactionHint": "拖动旋转，滚动缩放。",
    "codex.filePreview.pdb.chainSelectLabel": "选择 PDB 链",
    "codex.filePreview.pdb.chainLabel": "链 {chainId}",
    "codex.filePreview.pdb.chainOption": "链 {chainId}（{count, number} 个残基）",
    "codex.filePreview.pdb.sequenceResidueCount": "{count, number} 个坐标残基",
    "codex.filePreview.pdb.selectedResidues": "已选 {range}",
    "codex.filePreview.pdb.sequenceLabel": "PDB 链序列",
    "codex.filePreview.pdb.residueLabel": "链 {chainId} 中的 {residueName} {residueNumber}",
    "codex.filePreview.pdb.residueTitle": "{residueName} {residueNumber}",
    "artifactTab.preview.exitPresentation": "退出",
    "artifactTab.preview.nextPage": "下一页",
    "artifactTab.preview.open": "打开",
    "artifactTab.preview.pageIndicator": "{current}/{total}",
    "artifactTab.preview.previousPage": "上一页",
    "artifactTab.preview.zoomPercent": "{zoomPercent}%",
    "artifactTab.preview.zoomToFit": "缩放以适应",
    "markdown.externalLink.openInBrowser": "在浏览器中打开",
    "markdown.externalLink.openInExternalBrowser": "在外部浏览器中打开",
    "markdown.externalLink.copyLink": "复制链接",
    "markdown.fileReference.openInTarget": "在 {target} 中打开",
    "markdown.fileReference.viewInCodexBrowser": "在浏览器中查看",
    "markdown.fileReference.viewFile": "打开文件",
    "markdown.fileReference.openWith": "打开方式",
    "markdown.fileReference.openWithTarget": "{target}",
    "markdown.fileReference.copyPath": "复制路径",
    "markdown.fileReference.openInFinder": "在 Finder 中打开",
    "markdown.fileReference.openInExplorer": "在资源管理器中打开",
    "markdown.fileReference.openInFileManager": "在文件管理器中打开",
    "mermaidDiagram.fitToWidth": "将图表适配到宽度",
    "mermaidDiagram.viewActualSize": "查看实际尺寸",
    "mermaidDiagram.copySource": "复制 Mermaid",
    "mermaidDiagram.ariaLabel": "Mermaid 图表",
    "mermaidDiagram.originalCode": "Mermaid 源代码",
    "artifactTab.previewError": "无法加载此预览",
    "artifactTab.previewLoading": "正在准备预览…",
    "artifactTab.previewTooLarge": "此文件太大，无法在侧边面板中预览",
    "copyButton.copyAriaLabel": "复制",
    "copyButton.copied": "已复制",
    "copyButton.copiedAriaLabel": "已复制",
    "copyButton.copyCode": "复制代码",
    "notebookPreview.cellCount": "{cellCount, plural, one {# 个单元格} other {# 个单元格}}",
    "notebookPreview.codeCellTitle": "代码单元格 {cellNumber}",
    "notebookPreview.codeDisclosure": "代码",
    "notebookPreview.empty": "此笔记本不包含任何单元格",
    "notebookPreview.emptyCodeCell": "空代码单元格",
    "notebookPreview.emptyMarkdownCell": "空 Markdown 单元格",
    "notebookPreview.emptyUnknownCell": "空笔记本单元格",
    "notebookPreview.emptyRawCell": "空原始单元格",
    "notebookPreview.errorOutput": "{name}: {message}",
    "notebookPreview.executionCount": "运行 {executionCount}",
    "notebookPreview.htmlOutputTitle": "笔记本 HTML 输出",
    "notebookPreview.imageOutputAlt": "笔记本输出 {outputNumber}",
    "notebookPreview.markdownCellTitle": "Markdown 单元格 {cellNumber}",
    "notebookPreview.rawCellTitle": "原始单元格 {cellNumber}",
    "notebookPreview.rawCodeTitle": "原始",
    "notebookPreview.rawOutputDisclosure": "原始输出",
    "notebookPreview.readOnlyBadge": "只读",
    "notebookPreview.restartKernelDisabled": "重启内核",
    "notebookPreview.restartKernelDisabledTooltip": "此预览未连接内核",
    "notebookPreview.runAllDisabled": "运行全部",
    "notebookPreview.runAllDisabledTooltip": "此预览中无法运行",
    "notebookPreview.runCellDisabledTooltip": "只读预览中已禁用运行",
    "notebookPreview.cellPosition": "第 {cellNumber} 个单元格，共 {totalCellCount} 个",
    "notebookPreview.pythonCodeTitle": "Python",
    "artifactTab.sourceOptions": "制品查看器选项",
    "artifactTab.sourceOptions.viewSource": "查看源码",
    "codex.diffView.failedToDecodeBase64Diff": "无法加载此差异",
    "codex.diffView.filesChanged": "{fileCount, plural, one {# 个文件已更改} other {# 个文件已更改}}",
    "codex.diffView.linesAdded": "+{linesAdded}",
    "codex.diffView.linesDeleted": "-{linesDeleted}",
    "codex.diffView.noDiffData": "没有可用的差异",
    "codex.diffView.richPreviewEnable": "启用富文本预览",
    "codex.diffView.richPreviewDisable": "禁用富文本预览",
    "codex.diffView.richPreviewToggle": "切换富文本预览",
    "codex.diffView.switchToSplit": "切换到分栏差异",
    "codex.diffView.switchToUnified": "切换到统一差异",
    "wham.diff.contextMenu.copyPath": "复制路径",
    "wham.diff.contextMenu.toggleWrap": "切换自动换行",
    "wham.diff.binaryFile": "未显示二进制文件",
    "threadHeader.archiveConfirmCancel": "取消",
    "threadHeader.archiveConfirmConfirm": "归档",
    "threadHeader.archiveConfirmHeartbeatConfirm": "归档并移除",
    "threadHeader.archiveConfirmHeartbeatSubtitleNamed":
      "此对话有一个正在运行的心跳自动化：{name}。归档对话也会将其移除并停止后续运行。",
    "threadHeader.archiveConfirmHeartbeatSubtitleUnnamed":
      "此对话有一个正在运行的心跳自动化。归档对话也会将其移除并停止后续运行。",
    "threadHeader.archiveConfirmHeartbeatTitle": "归档对话并移除自动化？",
    "threadHeader.archiveConfirmSubtitle": "稍后可在已归档对话中找到。",
    "threadHeader.archiveConfirmTitle": "归档对话？",
    "threadHeader.addAutomation": "添加自动化",
    "threadHeader.copyAppLink": "复制深度链接",
    "threadHeader.copyConversationMarkdown": "复制为 Markdown",
    "threadHeader.copyConversationMarkdownError": "将对话复制为 Markdown 失败",
    "threadHeader.copyConversationMarkdownSuccess": "已将对话复制为 Markdown",
    "threadHeader.copySessionId": "复制会话 ID",
    "threadHeader.copyWorkingDirectory": "复制工作目录",
    "threadHeader.copyWorkingDirectoryError": "复制工作目录失败",
    "threadHeader.copyWorkingDirectorySuccess": "已复制工作目录",
    "threadHeader.editAutomation": "编辑自动化",
    "threadHeader.forkIntoLocal": "派生到本地",
    "threadHeader.forkIntoWorktree": "分叉到新工作树",
    "threadHeader.forkPendingWorktreePrompt": "将此对话分叉到新的工作树。",
    "threadHeader.forkPendingWorktreeTitle": "已分叉的对话",
    "threadHeader.forkThreadRequiresGitRepo": "分叉到新工作树需要 git 仓库",
    "threadHeader.forkIntoSameWorktree": "分叉到同一工作树",
    "threadHeader.forkThreadError": "创建对话分支失败",
    "threadHeader.openInNewWindow": "在新窗口中打开",
    "threadHeader.openSideChat": "打开侧边对话",
    "threadHeader.openSideChatError": "打开侧边对话失败",
    "threadHeader.moreActions": "对话操作",
    "sidebarElectron.markThreadUnread": "标记为未读",
    "sidebarElectron.pinThread": "固定对话",
    "sidebarElectron.unpinThread": "取消固定对话",
    "localConversation.sideChat.title": "侧边对话",
    "localConversation.sideChat.numberedTitle": "侧边对话 {index}",
    "sidebarElectron.archiveThread": "归档对话",
    "sidebarElectron.renameThread": "重命名对话",
    "sidebarElectron.renameThreadDialogAriaLabel": "对话标题",
    "sidebarElectron.renameThreadDialogCancel": "取消",
    "sidebarElectron.renameThreadDialogPlaceholder": "添加标题...",
    "sidebarElectron.renameThreadDialogSave": "保存",
    "sidebarElectron.renameThreadDialogSubtitle": "保持简短且易于区分",
    "sidebarElectron.renameThreadDialogTitle": "重命名对话",
    "sidebarElectron.renameThreadError": "重命名对话失败",
    "sidebarElectron.skillsAppsRouteNavLink": "插件",
    "sidebarElectron.skillsRouteNavLink": "技能",
    "sidebarElectron.automationsRouteNavLink": "自动化",
    "sidebarElectron.pullRequestsRouteNavLink": "拉取请求",
    "sidebarElectron.pluginsRouteNavLink": "插件",
    "sidebarElectron.pluginsDisabledTooltip": "请登录 ChatGPT 以使用插件",
    "sidebarElectron.noTasks": "暂无对话",
    "sidebarElectron.scratchpadNavLink": "草稿区",
    "inbox.mode.automations": "自动化",
    "inbox.automations.createError": "无法创建自动化",
    "inbox.automations.updateError": "无法更新自动化操作",
    "inbox.automations.loading": "正在加载…",
    "inbox.automations.new": "新建自动化功能",
    "inbox.automations.current": "当前",
    "inbox.automations.sectionsNav": "自动化概览板块",
    "inbox.automations.pausedSection": "已暂停",
    "inbox.automations.inProgress": "正在进行中",
    "inbox.automations.header.root": "自动化功能",
    "inbox.automations.details": "详情",
    "inbox.automations.nextRun.label": "下次运行",
    "inbox.automations.nextRun.none": "未计划",
    "inbox.automations.lastRun.label": "上次运行时间",
    "inbox.automations.lastRun.none": "-",
    "inbox.automations.missing": "未找到自动化功能",
    "inbox.automations.missingBack": "返回自动化功能",
    "inbox.automations.missingSubtitle": "该自动化功能可能已被删除，或在此设备上不再可用。",
    "inbox.automations.emptySubtitle.learnMore": "通过设置定期对话，实现工作自动化。<link>了解更多</link>",
    "inbox.automations.rowSummary.heartbeat": "心跳 • {thread}",
    "inbox.automations.editTooltip": "编辑自动化",
    "inbox.automations.moreOptionsTooltip": "更多选项",
    "inbox.automations.rowActions": "自动化操作",
    "inbox.automations.pauseMenuItem": "暂停",
    "inbox.automations.resumeMenuItem": "恢复",
    "inbox.automations.deleteMenuItem": "删除",
    "inbox.automations.deleteConfirm.cancel": "取消",
    "inbox.automations.deleteConfirm.confirm": "删除自动化",
    "inbox.automations.deleteConfirm.description": "此操作将永久删除该自动化并停止所有未来运行。",
    "inbox.automations.deleteConfirm.title": "删除 {name}？",
    "inbox.automations.deleteError": "无法删除自动化",
    "inbox.automations.deleteFailedDescription": "请重试。",
    "inbox.automations.runNowError": "无法启动自动化功能",
    "inbox.automations.runNowSuccess": "自动化功能已启动",
    "inbox.automations.relativeDate.pastToday": "今天 {time}",
    "inbox.automations.relativeDate.pastWeekday": "{weekday} {time}",
    "inbox.automations.relativeDate.today": "今天 {time}",
    "inbox.automations.relativeDate.tomorrow": "明天 {time}",
    "inbox.automations.relativeDate.weekday": "{weekday} {time}",
    "inbox.automations.relativeDate.yesterday": "昨天 {time}",
    "inbox.automations.statusSection": "状态",
    "inbox.automations.status.label": "状态",
    "inbox.automations.status.active": "活跃",
    "inbox.automations.status.paused": "已暂停",
    "inbox.automations.status.deleted": "已删除",
    "inbox.automations.executionEnvironment.label": "运行环境",
    "inbox.automations.host.label": "主机",
    "inbox.automations.folder.label": "项目",
    "inbox.automations.localEnvironment.label": "环境",
    "composer.worktreeEnvironment.title": "本地环境",
    "composer.worktreeEnvironment.tooltip": "选择本地环境",
    "composer.worktreeEnvironment.loading": "正在加载环境...",
    "composer.worktreeEnvironment.error": "加载环境时出错",
    "composer.worktreeEnvironment.default": "默认环境",
    "composer.worktreeEnvironment.create": "创建本地环境",
    "codex.environmentSelector.noEnvironment": "无环境",
    "codex.environments.noEnvironmentsFound": "未找到环境",
    "inbox.automations.history": "运行历史记录",
    "inbox.automations.history.untitled": "无标题",
    "inbox.automations.history.archivedTooltip": "运行记录已归档",
    "inbox.automations.workspaceFallback": "-",
    "inbox.automations.targetThread.label": "对话",
    "inbox.automations.model.label": "模型",
    "inbox.automations.reasoning.label": "推理",
    "inbox.automations.interval.label": "间隔",
    "inbox.automations.repeats.label": "重复次数",
    "inbox.contextMenu.markRead": "标记为已读",
    "inbox.contextMenu.markUnread": "标记为未读",
    "settings.automations.runNow": "立即运行",
    "settings.automations.cancel": "取消",
    "settings.automations.create": "创建",
    "settings.automations.save": "保存",
    "settings.automations.saveRetry": "保存",
    "settings.automations.deleteAria": "删除自动化",
    "settings.automations.clear": "清除",
    "settings.automations.dialog.newTitle": "新自动化",
    "settings.automations.nameLabel": "名称",
    "settings.automations.namePlaceholder": "自动化名称",
    "settings.automations.pauseAria": "暂停自动化",
    "settings.automations.promptLabel": "提示词",
    "settings.automations.promptPlaceholder": "让 Codex 做什么？",
    "settings.automations.projectDropdown.projectless": "对话",
    "settings.automations.projectDropdown.placeholder": "选择项目",
    "settings.automations.projectDropdown.localOnlyTooltip": "只能为本地项目创建自动化",
    "settings.automations.resumeAria": "恢复自动化",
    "settings.automations.rruleSummaryFallback": "自定义计划",
    "settings.automations.scheduleSummary.daily": "每天 {time}",
    "settings.automations.scheduleSummary.weekdays": "工作日 {time}",
    "settings.automations.scheduleSummary.weekends": "周末 {time}",
    "settings.automations.scheduleSummary.weekly": "{days} {time}",
    "settings.automations.scheduleSummary.interval": "每 {count} 小时",
    "settings.automations.scheduleSummary.intervalDays":
      "{interval}，覆盖 {days}",
    "settings.automations.scheduleSummary.intervalDayCount":
      "{count, plural, one {# 天} other {# 天}}",
    "settings.automations.scheduleSummary.intervalMinute": "每分钟",
    "settings.automations.scheduleSummary.intervalMinutes":
      "每 {count} 分钟",
    "settings.automations.scheduleSummary.intervalHourly": "每小时",
    "settings.automations.scheduleSummary.intervalDaily": "每天",
    "settings.automations.scheduleSummary.intervalWeekly": "每周",
    "settings.automations.scheduleSummary.sundaysLabel": "每周日",
    "settings.automations.scheduleSummary.mondaysLabel": "每周一",
    "settings.automations.scheduleSummary.tuesdaysLabel": "每周二",
    "settings.automations.scheduleSummary.wednesdaysLabel": "每周三",
    "settings.automations.scheduleSummary.thursdaysLabel": "每周四",
    "settings.automations.scheduleSummary.fridaysLabel": "每周五",
    "settings.automations.scheduleSummary.saturdaysLabel": "每周六",
    "settings.automations.cwdPlaceholder": "每行一个项目路径",
    "settings.automations.heartbeatThread.placeholder": "选择一个对话",
    "settings.automations.executionEnvironment.ariaLabel": "运行环境",
    "settings.automations.executionEnvironment.local": "本地",
    "settings.automations.executionEnvironment.worktree": "工作树",
    "scratchpadPage.headerTitle": "草稿区",
    "scratchpadPage.headerSubtitle": "实验性功能",
    "scratchpadPage.clearButton": "清除",
    "scratchpadPage.createError": "无法创建聊天",
    "scratchpadPage.inputPlaceholder.initial": "添加任务",
    "scratchpadPage.inputPlaceholder.followUp": "添加后续跟进",
    "scratchpadPage.inputPlaceholder.followUpHint": "添加任务，或按 Tab 键添加后续跟进",
    "scratchpadPage.summaryLoading": "正在总结助手的最终回复",
    "codex.localTaskRow.awaitingApproval": "等待批准",
    "codex.localTaskRow.awaitingResponse": "等待回复",
    "general.title": "通用",
    "general.theme": "主题",
    "general.themeDescription": "使用浅色、深色，或匹配你的系统",
    "general.themeLight": "浅色",
    "general.themeDark": "深色",
    "general.themeSystem": "系统",
    "general.languageDescription": "应用 UI 语言",
    "general.usePointerCursors": "使用指针光标",
    "general.usePointerCursorsDescription": "悬停交互元素时切换为指针光标",
    "general.uiFontSize": "UI 字号",
    "general.uiFontSizeDescription": "调整 Codex UI 使用的基准字号",
    "general.codeFontSize": "代码字体大小",
    "general.codeFontSizeDescription": "调整聊天和差异视图中代码使用的基础字号",
    "general.enterBehavior": "长提示词发送需按 {modifierSymbol} + enter",
    "general.enterBehaviorDescription": "启用后，多行提示词需要按 {modifierSymbol} + enter 才会发送。",
    "general.followUpBehavior": "跟进行为",
    "general.followUpBehaviorDescription":
      "在 Codex 运行时将后续操作加入队列，或引导当前运行。按 {invertFollowUpShortcutLabel} 可对单条消息执行相反操作",
    "general.followUpQueue": "排队",
    "general.followUpSteer": "引导",
    "general.reviewDelivery": "代码审查",
    "general.reviewDeliveryDescription": "尽可能在当前对话中启动 /review，或发起单独的审查对话",
    "general.reviewInline": "行内视图",
    "general.reviewDetached": "分离视图",
    "general.saving": "正在保存",
    "general.language": "语言",
    "general.languageAuto": "自动检测",
    "general.languageEnglish": "英语",
    "general.languageChineseSimplified": "简体中文",
    "settings.general": "通用",
    "settings.nav.general-settings": "常规",
    "settings.nav.appearance": "外观",
    "settings.nav.agent": "配置",
    "settings.nav.plugins-settings": "插件",
    "settings.nav.browser-use": "浏览器使用",
    "settings.nav.computer-use": "计算机使用",
    "settings.nav.usage": "用量",
    "settings.nav.data-controls": "已归档对话",
    "settings.nav.keyboard-shortcuts": "键盘快捷方式",
    "settings.nav.git-settings": "Git",
    "settings.nav.worktrees": "工作树",
    "settings.nav.personalization": "个性化",
    "settings.nav.mcp-settings": "MCP 服务器",
    "settings.nav.local-environments": "本地环境",
    "settings.section.general-settings": "通用",
    "settings.section.appearance": "外观",
    "settings.section.agent": "配置",
    "settings.section.personalization": "个性化",
    "settings.section.usage": "用量",
    "settings.section.local-environments": "环境",
    "computerUse.label": "计算机使用",
    "settings.section.data-controls": "已归档对话",
    "settings.section.keyboard-shortcuts": "键盘快捷键",
    "settings.section.git-settings": "Git",
    "settings.section.worktrees": "工作树",
    "settings.section.plugins-settings": "插件",
    "settings.section.skills-settings": "技能",
    "settings.section.browser-use": "浏览器使用",
    "settings.section.mcp-settings": "MCP 服务器",
    "settings.section.mcp-settings.subtitle": "连接外部工具和数据源。<a>了解更多。</a>",
    "settings.browserUse.title": "浏览器",
    "settings.browserUse.subtitle":
      "管理 Codex 的浏览器。可在<computerUseSettingsLink>计算机使用设置</computerUseSettingsLink>中设置 Google Chrome",
    "settings.browserUse.control.title": "Browser Use",
    "settings.browserUse.control.description": "让 Codex 控制内置浏览器",
    "settings.browserUse.install.title": "插件",
    "settings.browserUse.install.button": "安装",
    "settings.browserUse.install.empty": "应用内浏览器插件不可用",
    "settings.browserUse.permissions.title": "权限",
    "settings.browserUse.browser.title": "数据",
    "settings.browserUse.browser.clearBrowsingData.label": "浏览数据",
    "settings.browserUse.browser.clearBrowsingData.description":
      "清除应用内浏览器中的站点数据和缓存",
    "settings.browserUse.browser.clearBrowsingData": "清除所有浏览数据",
    "settings.browserUse.browser.hideClearOptions": "隐藏单独的浏览数据选项",
    "settings.browserUse.browser.showClearOptions": "显示单独的浏览数据选项",
    "settings.browserUse.browser.cookies.label": "Cookie",
    "settings.browserUse.browser.siteData.label": "站点数据",
    "settings.browserUse.browser.cache.label": "缓存的图片和文件",
    "settings.browserUse.browser.clearCookies": "删除 Cookie",
    "settings.browserUse.browser.clearSiteData": "删除站点数据",
    "settings.browserUse.browser.clearCache": "删除缓存的图片和文件",
    "settings.browserUse.browser.browsingDataCleared": "已清除浏览数据",
    "settings.browserUse.browser.cookiesCleared": "已清除浏览器 Cookie",
    "settings.browserUse.browser.siteDataCleared": "已清除浏览器站点数据",
    "settings.browserUse.browser.cacheCleared": "已清除浏览器缓存",
    "settings.browserUse.browser.clearBrowsingDataError": "无法清除浏览数据",
    "settings.browserUse.browser.clearCookiesError": "无法清除浏览器 Cookie",
    "settings.browserUse.browser.clearSiteDataError": "无法清除浏览器站点数据",
    "settings.browserUse.browser.clearCacheError": "无法清除浏览器缓存",
    "settings.browserUse.browser.annotationScreenshots.label": "标注截图",
    "settings.browserUse.browser.annotationScreenshots.description":
      "截图可帮助 Codex 更好地理解和处理评论，但会增加套餐用量",
    "settings.browserUse.browser.annotationScreenshots.always.label": "始终包含",
    "settings.browserUse.browser.annotationScreenshots.necessary.label": "仅在拖拽选择时",
    "settings.browserUse.browser.annotationScreenshots.saveError": "无法保存标注截图设置",
    "settings.browserUse.approval.label": "审批",
    "settings.browserUse.approval.description": "选择 Codex 在打开网站前是否请求批准",
    "settings.browserUse.approval.alwaysAsk.label": "始终询问",
    "settings.browserUse.approval.alwaysAsk.description": "打开网站前先询问",
    "settings.browserUse.approval.neverAsk.label": "始终允许",
    "settings.browserUse.approval.neverAsk.description": "无需询问即可打开网站",
    "settings.browserUse.approval.neverAsk.elevatedRiskDisclaimer":
      "此设置会给你的数据带来较高风险。",
    "settings.browserUse.approval.saveError": "无法保存审批设置",
    "settings.browserUse.historyApproval.label": "历史记录",
    "settings.browserUse.historyApproval.description": "选择 Codex 在访问你的历史记录前是否需要批准",
    "settings.browserUse.historyApproval.alwaysAsk.label": "始终询问",
    "settings.browserUse.historyApproval.alwaysAsk.description": "访问历史记录前先询问",
    "settings.browserUse.historyApproval.neverAsk.label": "始终允许",
    "settings.browserUse.historyApproval.neverAsk.description": "无需询问即可访问历史记录",
    "settings.browserUse.historyApproval.saveError": "无法保存历史记录设置",
    "settings.browserUse.downloadApproval.label": "下载",
    "settings.browserUse.downloadApproval.description": "选择 Codex 在从网站下载文件前是否先询问",
    "settings.browserUse.downloadApproval.alwaysAsk.description": "下载文件前询问",
    "settings.browserUse.downloadApproval.neverAsk.description": "下载文件时不询问",
    "settings.browserUse.downloadApproval.saveError": "无法保存下载设置",
    "settings.browserUse.uploadApproval.label": "上传",
    "settings.browserUse.uploadApproval.description": "选择 Codex 在将文件上传到网站前是否先询问",
    "settings.browserUse.uploadApproval.alwaysAsk.description": "上传文件前先询问",
    "settings.browserUse.uploadApproval.neverAsk.description": "上传文件时无需询问",
    "settings.browserUse.uploadApproval.saveError": "无法保存上传设置",
    "settings.browserUse.allowedDomains.title": "允许的域名",
    "settings.browserUse.allowedDomains.subtitle": "无需询问即可打开的域名",
    "settings.browserUse.allowedDomains.emptyTitle": "没有允许的域名",
    "settings.browserUse.allowedDomains.added": "已添加允许的域名",
    "settings.browserUse.allowedDomains.addDialogTitle": "添加允许的域名",
    "settings.browserUse.allowedDomains.addDialogSubtitle":
      "这意味着 Codex 无需事先询问即可打开此 URL。",
    "settings.browserUse.blockedDomains.title": "已屏蔽的域名",
    "settings.browserUse.blockedDomains.subtitle": "Codex 绝不会打开这些网站",
    "settings.browserUse.blockedDomains.emptyTitle": "没有已屏蔽的域名",
    "settings.browserUse.blockedDomains.added": "已添加已屏蔽的域名",
    "settings.browserUse.blockedDomains.addDialogTitle": "添加已屏蔽域名",
    "settings.browserUse.blockedDomains.addDialogSubtitle": "这意味着 Codex 不会打开此 URL。",
    "settings.browserUse.blockedDomains.chromeSubtitle": "Codex 绝不会在您的浏览器中打开这些网站",
    "settings.browserUse.allowedDownloadDomains.title": "允许下载的域名",
    "settings.browserUse.allowedDownloadDomains.subtitle": "无需询问即可下载文件的域名",
    "settings.browserUse.allowedDownloadDomains.emptyTitle": "没有允许的下载域名",
    "settings.browserUse.allowedDownloadDomains.added": "已添加允许下载的域名",
    "settings.browserUse.allowedDownloadDomains.removed": "已移除允许的下载域名",
    "settings.browserUse.allowedDownloadDomains.addDialogTitle": "添加允许的下载域名",
    "settings.browserUse.allowedDownloadDomains.addDialogSubtitle":
      "这意味着 Codex 无需事先询问即可从此 URL 下载文件",
    "settings.browserUse.allowedDownloadDomains.removeDialogTitle": "从允许的下载域中移除“{origin}”？",
    "settings.browserUse.allowedDownloadDomains.removeDialogSubtitle":
      "Codex 从此域下载文件前会先询问",
    "settings.browserUse.blockedDownloadDomains.title": "已阻止的下载域名",
    "settings.browserUse.blockedDownloadDomains.subtitle": "Codex 绝不会从这些网站下载文件",
    "settings.browserUse.blockedDownloadDomains.emptyTitle": "没有被阻止的下载域名",
    "settings.browserUse.blockedDownloadDomains.added": "已添加受阻止的下载域名",
    "settings.browserUse.blockedDownloadDomains.removed": "已移除被阻止的下载域名",
    "settings.browserUse.blockedDownloadDomains.addDialogTitle": "添加被阻止的下载域名",
    "settings.browserUse.blockedDownloadDomains.addDialogSubtitle":
      "这意味着 Codex 不会从此 URL 下载文件",
    "settings.browserUse.blockedDownloadDomains.removeDialogTitle": "将“{origin}”从已阻止的下载域中移除？",
    "settings.browserUse.blockedDownloadDomains.removeDialogSubtitle":
      "Codex 可以在从此域下载文件前再次询问",
    "settings.browserUse.allowedUploadDomains.title": "允许上传的域名",
    "settings.browserUse.allowedUploadDomains.subtitle": "无需询问即可接收文件上传的域名",
    "settings.browserUse.allowedUploadDomains.emptyTitle": "没有允许的上传域名",
    "settings.browserUse.allowedUploadDomains.added": "已添加允许上传域名",
    "settings.browserUse.allowedUploadDomains.removed": "已移除允许上传的域名",
    "settings.browserUse.allowedUploadDomains.addDialogTitle": "添加允许上传的域名",
    "settings.browserUse.allowedUploadDomains.addDialogSubtitle":
      "这意味着 Codex 无需事先询问即可将文件上传到此 URL",
    "settings.browserUse.allowedUploadDomains.removeDialogTitle": "从允许上传域名中移除“{origin}”？",
    "settings.browserUse.allowedUploadDomains.removeDialogSubtitle":
      "Codex 在向此域名上传文件前会先询问",
    "settings.browserUse.blockedUploadDomains.title": "已阻止的上传域名",
    "settings.browserUse.blockedUploadDomains.subtitle": "Codex 绝不会将文件上传到这些网站",
    "settings.browserUse.blockedUploadDomains.emptyTitle": "没有被阻止的上传域名",
    "settings.browserUse.blockedUploadDomains.added": "已添加受阻止的上传域名",
    "settings.browserUse.blockedUploadDomains.removed": "已移除受阻止的上传域名",
    "settings.browserUse.blockedUploadDomains.addDialogTitle": "添加被阻止的上传域",
    "settings.browserUse.blockedUploadDomains.addDialogSubtitle":
      "这意味着 Codex 不会将文件上传到此 URL",
    "settings.browserUse.blockedUploadDomains.removeDialogTitle": "要从已阻止的上传域中移除“{origin}”吗？",
    "settings.browserUse.blockedUploadDomains.removeDialogSubtitle":
      "Codex 在向此域上传文件前可以再次询问",
    "settings.browserUse.domains.add": "添加",
    "settings.browserUse.domains.addDialogAriaLabel": "域名",
    "settings.browserUse.domains.addDialogPlaceholder": "example.com",
    "settings.browserUse.domains.addDialogCancel": "取消",
    "settings.browserUse.domains.addDialogConfirm": "添加",
    "settings.browserUse.domains.addError": "无法添加域名",
    "settings.browserUse.origins.loading": "正在加载网站",
    "settings.browserUse.origins.saveError": "无法保存域名",
    "settings.browserUse.origins.removeAriaLabel": "移除{origin}",
    "settings.browserUse.origins.removeDialogCancel": "取消",
    "settings.browserUse.origins.removeDialogConfirm": "移除",
    "settings.browserUse.allowedWebsites.saved": "已移除允许的域名",
    "settings.browserUse.allowedWebsites.removeDialogTitle": "从允许的域名中移除“{origin}”吗？",
    "settings.browserUse.allowedWebsites.removeDialogSubtitle": "Codex 在打开此域名前先询问。",
    "settings.browserUse.deniedWebsites.saved": "已移除已屏蔽的域名",
    "settings.browserUse.deniedWebsites.removeDialogTitle": "要从已屏蔽的域名中移除“{origin}”吗？",
    "settings.browserUse.deniedWebsites.removeDialogSubtitle": "打开此域名前，Codex 可以再次询问。",
    "settings.computerUse.install.title": "插件",
    "settings.computerUse.install.button": "安装",
    "settings.computerUse.install.empty": "电脑操控插件不可用",
    "settings.computerUse.subtitle": "管理 Codex 如何使用您电脑上的其他应用程序",
    "settings.computerUse.sounds.foregroundClicks": "为前台点击播放音效",
    "settings.computerUse.sounds.foregroundAndBackgroundClicks": "为前台和后台点击播放音效",
    "settings.computerUse.sounds.off": "不播放音效",
    "settings.computerUse.anyApp.title": "任何应用",
    "settings.computerUse.anyApp.description": "允许 Codex 控制您电脑上的应用",
    "settings.computerUse.chrome.pluginTitle": "Google Chrome",
    "settings.computerUse.chrome.pluginDescription": "使用浏览器扩展程序，以获得更多控制选项",
    "settings.computerUse.chrome.pluginConnectedDescription":
      "已连接到浏览器扩展程序，可进行更多控制",
    "settings.computerUse.chrome.pluginDisconnectedDescription": "浏览器扩展程序未连接",
    "settings.computerUse.chrome.manage": "管理",
    "settings.computerUse.chrome.title": "Google Chrome",
    "settings.computerUse.chrome.reinstallExtension": "重新安装扩展程序",
    "settings.computerUse.chrome.openExtensionSettingsError": "无法打开 Chrome 扩展程序设置",
    "settings.computerUse.chrome.removeExtension": "移除扩展程序",
    "settings.computerUse.chrome.permissions.title": "权限",
    "settings.computerUse.chrome.connected": "已连接",
    "settings.computerUse.chrome.notConnected": "未连接",
    "settings.computerUse.chrome.back": "返回",
    "settings.computerUse.breadcrumb.computerUse": "Computer Use",
    "settings.computerUse.chrome.breadcrumb.googleChrome": "Google Chrome",
    "settings.computerUse.allowedApps.title": "始终允许的应用",
    "settings.computerUse.allowedApps.loading": "正在加载允许使用的应用",
    "settings.computerUse.allowedApps.loadError": "无法加载允许使用的应用。",
    "settings.computerUse.allowedApps.emptyTitle": "暂无",
    "settings.computerUse.allowedApps.removeAriaLabel": "移除 {displayName}",
    "settings.computerUse.allowedApps.removeDialogTitle": "要将“{displayName}”从始终允许使用的应用中移除吗？",
    "settings.computerUse.allowedApps.removeDialogSubtitle":
      "Codex 会在下一次电脑操控会话中请求使用“{displayName}”。",
    "settings.computerUse.allowedApps.removeDialogCancel": "取消",
    "settings.computerUse.allowedApps.removeDialogConfirm": "移除",
    "settings.computerUse.allowedApps.saved": "已移除允许使用的应用",
    "settings.computerUse.allowedApps.saveError": "无法保存允许使用的应用",
    "settings.pluginControls.disableToggleTooltip": "禁用 {pluginName}",
    "settings.pluginControls.enableToggleTooltip": "启用 {pluginName}",
    "settings.pluginControls.toggleAria": "切换 {pluginName}",
    "settings.pluginControls.installTooltip": "安装 {pluginName}",
    "settings.localEnvironments.workspaceSelect.description":
      "本地环境用于指示 Codex 如何为项目设置工作树。<a>了解更多。</a>",
    "settings.localEnvironments.workspaceSelect.title": "选择项目",
    "settings.localEnvironments.workspaceSelect.learnMore": "了解更多。",
    "settings.localEnvironments.workspaceSelect.loading": "正在加载项目。",
    "settings.localEnvironments.workspaceSelect.empty": "还没有项目。添加一个项目以配置本地环境。",
    "settings.localEnvironments.workspaceSelect.listLabel": "可用项目",
    "settings.localEnvironments.workspaceSelect.addLabel": "添加环境",
    "settings.localEnvironments.workspaceSelect.loadingLabel": "正在加载环境",
    "settings.localEnvironments.workspaceSelect.errorLabel": "环境需要处理",
    "settings.localEnvironments.workspaceSelect.inherited": "父文件夹中的 {count} 个环境",
    "settings.localEnvironments.workspaceSelect.viewAction": "查看",
    "settings.localEnvironments.workspace.add": "添加项目",
    "settings.localEnvironments.workspace.title": "项目",
    "settings.localEnvironments.breadcrumb.back": "返回",
    "settings.localEnvironments.breadcrumb.root": "环境",
    "settings.localEnvironments.breadcrumb.edit": "编辑",
    "settings.localEnvironments.editor.title": "本地环境",
    "settings.localEnvironments.editor.setup.description": "创建工作树时在项目根目录下运行",
    "settings.localEnvironments.environment.create": "创建本地环境",
    "settings.localEnvironments.environment.edit": "编辑本地环境",
    "settings.localEnvironments.environment.defaultName": "local",
    "settings.localEnvironments.environment.empty": "尚未针对此项目配置任何本地环境。",
    "settings.localEnvironments.environment.title": "环境详情",
    "settings.localEnvironments.environment.name": "名称",
    "settings.localEnvironments.environment.setup": "设置脚本",
    "settings.localEnvironments.environment.setup.description": "此脚本会在创建工作树时运行。",
    "settings.localEnvironments.environment.setup.platformSelector": "设置脚本平台",
    "settings.localEnvironments.environment.setup.platformOverrides": "平台覆盖",
    "settings.localEnvironments.environment.setup.platformOverrides.description":
      "为特定操作系统覆盖默认脚本。",
    "settings.localEnvironments.environment.setup.envVars.button": "变量",
    "settings.localEnvironments.environment.setup.envVars.title": "设置脚本环境变量",
    "settings.localEnvironments.environment.setup.envVars.sourcePath.description": "源工作空间路径",
    "settings.localEnvironments.environment.setup.envVars.worktreePath.description": "新工作树路径",
    "settings.localEnvironments.environment.cleanup.title": "清理脚本",
    "settings.localEnvironments.environment.cleanup.description": "清理工作树之前在项目根目录下运行",
    "settings.localEnvironments.environment.cleanup.summaryTitle": "清理脚本",
    "settings.localEnvironments.environment.cleanup.summaryDescription": "此脚本会在删除工作树前运行。",
    "settings.localEnvironments.environment.cleanup.empty": "未配置清理脚本。",
    "settings.localEnvironments.environment.cleanup.platformSelector": "清理脚本平台",
    "settings.localEnvironments.environment.cleanup.platformOverrides": "平台覆盖",
    "settings.localEnvironments.environment.cleanup.platformOverrides.description":
      "为特定操作系统覆盖默认清理脚本。",
    "settings.localEnvironments.environment.actions.description":
      "这些操作可以运行任意命令并将显示在标头中。",
    "settings.localEnvironments.environment.actionsLabel": "操作",
    "settings.localEnvironments.environment.script.default": "默认",
    "settings.localEnvironments.actions.title": "操作",
    "settings.localEnvironments.actions.add": "添加操作",
    "settings.localEnvironments.actions.empty": "添加操作，以便从本地工具栏运行命令。",
    "settings.localEnvironments.actions.item.name": "名称",
    "settings.localEnvironments.actions.item.command": "操作脚本",
    "settings.localEnvironments.actions.item.button.delete": "删除",
    "settings.localEnvironments.actions.item.tooltip.delete": "删除",
    "settings.localEnvironments.actions.item.platforms": "平台",
    "settings.localEnvironments.actions.item.platforms.selector": "平台选择",
    "settings.localEnvironments.actions.item.platforms.specific": "特定平台",
    "settings.localEnvironments.actions.item.platforms.help": "仅在特定操作系统上运行。",
    "settings.localEnvironments.actions.item.platforms.macos": "macOS",
    "settings.localEnvironments.actions.item.platforms.linux": "Linux",
    "settings.localEnvironments.actions.item.platforms.windows": "Windows",
    "settings.localEnvironments.actions.icon.tool": "工具",
    "settings.localEnvironments.actions.icon.run": "运行",
    "settings.localEnvironments.actions.icon.debug": "调试",
    "settings.localEnvironments.actions.icon.test": "测试",
    "settings.localEnvironments.preview.save": "保存",
    "settings.localEnvironments.preview.saveError": "保存文件失败。（{error}）",
    "settings.localEnvironments.save.success": "已保存本地环境",
    "settings.localEnvironments.save.disabled.name": "添加环境名称以保存。",
    "settings.localEnvironments.save.disabled.noChanges": "没有可保存的更改。",
    "settings.localEnvironments.save.disabled.saving": "正在保存…",
    "settings.localEnvironments.file.parseError": "无法解析现有文件。保存内容会将其覆盖。（{error}）",
    "settings.localEnvironments.file.readError": "无法加载本地环境数据。（{error}）",
    "settings.localEnvironments.loading.title": "正在加载本地环境",
    "settings.localEnvironments.loading.body": "正在获取项目配置。",
    "settings.localEnvironments.unavailable.title": "本地环境不可用",
    "settings.localEnvironments.unavailable.body": "我们无法加载此项目的本地环境设置。",
    "settings.localEnvironments.remoteProjectDialog.title": "添加远程项目",
    "settings.localEnvironments.remoteProjectDialog.description": "选择一个已连接的远程主机，并输入此项目的文件夹。",
    "settings.localEnvironments.remoteProjectDialog.emptyDescription":
      "请先设置远程主机。然后你就可以在这里选择主机和文件夹。",
    "settings.localEnvironments.remoteProjectDialog.hostLabel": "远程主机",
    "settings.localEnvironments.remoteProjectDialog.pathLabel": "文件夹路径",
    "settings.localEnvironments.remoteProjectDialog.note": "这个远程文件夹会作为独立项目显示在侧边栏中。",
    "settings.localEnvironments.remoteProjectDialog.cancel": "取消",
    "settings.localEnvironments.remoteProjectDialog.confirm": "添加项目",
    "settings.localEnvironments.remoteProjectDialog.saveError": "保存项目失败",
    "settings.keyboardShortcuts.subtitle.electron": "自定义应用快捷键",
    "settings.keyboardShortcuts.loading": "正在加载快捷键…",
    "settings.keyboardShortcuts.search.ariaLabel": "搜索键盘快捷键",
    "settings.keyboardShortcuts.search.placeholder": "搜索快捷键",
    "settings.keyboardShortcuts.table.command": "命令",
    "settings.keyboardShortcuts.table.keybinding": "按键绑定",
    "settings.keyboardShortcuts.table.actions": "操作",
    "settings.keyboardShortcuts.noMatches": "没有匹配的快捷键",
    "settings.keyboardShortcuts.unassigned": "未分配",
    "settings.keyboardShortcuts.capturePrompt": "按下快捷键",
    "settings.keyboardShortcuts.captureCancel": "取消",
    "settings.keyboardShortcuts.captureAriaLabel": "为 {commandTitle} 录入快捷键",
    "settings.keyboardShortcuts.captureConflict": "已被 {commandTitle} 使用",
    "settings.keyboardShortcuts.setAriaLabel": "为 {commandTitle} 设置快捷键",
    "settings.keyboardShortcuts.changeAriaLabel": "更改 {commandTitle} 的快捷键",
    "settings.keyboardShortcuts.createAriaLabel": "为 {commandTitle} 创建新快捷键",
    "settings.keyboardShortcuts.clearAriaLabel": "清除 {commandTitle} 的快捷键",
    "settings.keyboardShortcuts.resetAriaLabel": "重置 {commandTitle} 的快捷键",
    "settings.keyboardShortcuts.updateError": "更新快捷方式失败",
    "settings.git.branchPrefix.label": "分支前缀",
    "settings.git.branchPrefix.description": "在 Codex 中创建新分支时使用的前缀",
    "settings.git.branchPrefix.placeholder": "codex/",
    "settings.git.branchPrefix.ariaLabel": "分支前缀",
    "settings.git.branchPrefix.save.success": "已保存分支前缀",
    "settings.git.branchPrefix.save.error": "保存分支前缀失败",
    "settings.git.forcePush.label": "始终强制推送",
    "settings.git.forcePush.description": "从 Codex 推送时使用 --force-with-lease 参数",
    "settings.git.forcePush.ariaLabel": "始终强制推送",
    "settings.git.forcePush.save.enabled": "已启用始终强制推送",
    "settings.git.forcePush.save.disabled": "已禁用始终强制推送",
    "settings.git.forcePush.save.error": "保存强制推送设置失败",
    "settings.git.createDraftPullRequest.label": "创建草稿拉取请求",
    "settings.git.createDraftPullRequest.description": "从 Codex 创建 PR 时默认使用草稿拉取请求",
    "settings.git.createDraftPullRequest.ariaLabel": "创建草稿拉取请求",
    "settings.git.createDraftPullRequest.save.enabled": "已启用创建草稿拉取请求",
    "settings.git.createDraftPullRequest.save.disabled": "已禁用创建草稿拉取请求",
    "settings.git.createDraftPullRequest.save.error": "保存草稿拉取请求设置失败",
    "settings.git.pullRequestMergeMethod.label": "拉取请求合并方法",
    "settings.git.pullRequestMergeMethod.description": "选择 Codex 合并拉取请求的方法",
    "settings.git.pullRequestMergeMethod.ariaLabel": "拉取请求合并方法",
    "settings.git.pullRequestMergeMethod.merge": "合并",
    "settings.git.pullRequestMergeMethod.squash": "压缩",
    "settings.git.pullRequestMergeMethod.save.success": "已保存拉取请求合并方法",
    "settings.git.pullRequestMergeMethod.save.error": "保存拉取请求合并方法失败",
    "settings.git.showSidebarPrIcons.label": "在侧边栏显示 PR 图标",
    "settings.git.showSidebarPrIcons.description": "在侧边栏的对话行中显示 PR 状态图标",
    "settings.git.showSidebarPrIcons.ariaLabel": "在侧边栏显示 PR 图标",
    "settings.git.showSidebarPrIcons.save.enabled": "已启用侧边栏 PR 图标",
    "settings.git.showSidebarPrIcons.save.disabled": "已禁用侧边栏 PR 图标",
    "settings.git.showSidebarPrIcons.save.error": "保存侧边栏 PR 图标设置失败",
    "settings.git.commitInstructions.label": "提交指令",
    "settings.git.commitInstructions.description": "已添加到提交信息生成提示中",
    "settings.git.commitInstructions.save": "保存",
    "settings.git.commitInstructions.placeholder": "添加提交消息指引…",
    "settings.git.commitInstructions.ariaLabel": "提交指令",
    "settings.git.commitInstructions.save.success": "已保存提交指令",
    "settings.git.commitInstructions.save.error": "保存提交指令失败",
    "settings.git.prInstructions.label": "拉取请求指令",
    "settings.git.prInstructions.description": "已添加到 PR 标题/描述生成提示中",
    "settings.git.prInstructions.save": "保存",
    "settings.git.prInstructions.placeholder": "添加拉取请求指引…",
    "settings.git.prInstructions.ariaLabel": "拉取请求指令",
    "settings.git.prInstructions.save.success": "已保存拉取请求指令",
    "settings.git.prInstructions.save.error": "保存拉取请求指令失败",
    "settings.worktrees.autoCleanup.label": "自动删除旧工作树",
    "settings.worktrees.autoCleanup.description": "推荐大多数用户启用。仅当你需要手动管理旧工作树和磁盘使用空间时，再关闭此功能。",
    "settings.worktrees.autoCleanup.ariaLabel": "自动删除旧工作树",
    "settings.worktrees.autoCleanup.save.enabled": "已启用自动删除",
    "settings.worktrees.autoCleanup.save.disabled": "已禁用自动删除",
    "settings.worktrees.autoCleanup.save.error": "保存自动删除设置失败",
    "settings.worktrees.keepCount.label": "自动删除限制",
    "settings.worktrees.keepCount.description": "自动清理较旧工作树前保留的 Codex 工作树数量。Codex 会在删除前为工作树创建快照，因此被清理的工作树应始终可恢复。",
    "settings.worktrees.keepCount.description.disabled": "自动删除功能已禁用。Codex 不会自动清理旧工作树。重新启用该功能即可再次使用已保存的限制。",
    "settings.worktrees.keepCount.ariaLabel": "自动删除限制",
    "settings.worktrees.keepCount.save.success": "已保存自动删除限制",
    "settings.worktrees.keepCount.save.error": "保存自动删除限制失败",
    "settings.worktrees.autoCleanup.confirm.title": "禁用工作树自动删除功能？",
    "settings.worktrees.autoCleanup.confirm.body": "我们强烈建议启用自动删除功能，以免旧工作树堆积，占用不必要的磁盘空间。若你希望自行管理旧工作树，可关闭此功能，Codex 将停止自动删除操作。",
    "settings.worktrees.autoCleanup.confirm.cancel": "启用自动删除功能",
    "settings.worktrees.autoCleanup.confirm.confirm": "禁用自动删除功能",
    "settings.worktrees.refresh": "刷新",
    "settings.worktrees.loading.title": "正在加载工作树",
    "settings.worktrees.loading.body": "正在获取工作树详细信息。",
    "settings.worktrees.error.title": "无法加载工作树",
    "settings.worktrees.error.body": "加载工作树时出错。",
    "settings.worktrees.empty.title": "尚无工作树",
    "settings.worktrees.empty.body": "Codex 创建的工作树将显示在此处。",
    "settings.worktrees.repository.unknown": "未知代码仓库",
    "settings.worktrees.repository.loading": "正在加载代码仓库元数据…",
    "settings.worktrees.row.title": "工作树",
    "settings.worktrees.row.delete": "删除",
    "settings.worktrees.row.conversations": "对话",
    "settings.worktrees.row.conversations.loading": "正在加载对话…",
    "settings.worktrees.row.conversations.empty": "无关联到此工作树的对话。",
    "settings.worktrees.conversation.untitled": "无标题对话",
    "settings.worktrees.delete.error": "无法删除工作树",
    "settings.dataControls.archivedChats.dateTime": "{date}，{time}",
    "settings.dataControls.archivedChats.dateTimeWithRepo": "{date}，{time} • {repo}",
    "settings.dataControls.archivedChats.empty": "暂无已归档的聊天。",
    "settings.dataControls.archivedChats.error": "无法加载已归档的聊天。",
    "settings.dataControls.archivedChats.loading": "正在加载已归档的聊天…",
    "settings.dataControls.archivedChats.unarchive": "取消归档",
    "settings.dataControls.archivedChats.unarchiveError": "无法取消归档聊天",
    "settings.dataControls.archivedChats.unarchiveSuccessPlain": "对话已取消归档。",
    "settings.dataControls.archivedChats.untitled": "无标题聊天",
    "settings.dataControls.archivedChats.viewNow": "立即查看",
    "settings.usage.access.loading": "正在检查订阅…",
    "settings.usage.load.loading": "正在加载用量设置…",
    "settings.usage.load.error": "无法加载用量设置。",
    "settings.usage.load.retry": "重试",
    "settings.usage.credit.title": "额度",
    "settings.usage.credit.remaining.description": "在达到用量限制时使用额度发送消息。<a>文档</a>",
    "settings.usage.credit.purchase": "购买",
    "settings.usage.credit.remaining.unavailable": "剩余额度不可用",
    "settings.usage.credit.remaining.unlimited": "无限额度",
    "settings.usage.credit.remaining.value": "剩余 {credit} 额度",
    "settings.usage.autoTopUp.title": "自动充值额度",
    "settings.usage.autoTopUp.description": "当额度余额达到最低值时自动充值。",
    "settings.usage.autoTopUp.settings": "设置",
    "settings.usage.autoTopUp.status.active": "已启用",
    "settings.usage.autoTopUp.managePayment.error": "暂时无法打开付款设置，请重试。",
    "settings.usage.autoTopUp.managePayment.action": "更新付款方式",
    "settings.usage.autoTopUp.purchaseCredit.action": "直接购买额度",
    "settings.usage.autoTopUp.dialog.title": "自动充值额度",
    "settings.usage.autoTopUp.dialog.description": "当你达到最低余额时，OpenAI 会自动向你的付款方式扣费。",
    "settings.usage.autoTopUp.threshold.label": "最低余额",
    "settings.usage.autoTopUp.threshold.helper": "当你的额度余额低于此数值时会触发自动充值。",
    "settings.usage.autoTopUp.threshold.ariaLabel": "自动充值最低余额",
    "settings.usage.autoTopUp.threshold.error.missing": "请输入最低余额（至少 125 额度）。",
    "settings.usage.autoTopUp.threshold.error.wholeNumber": "最低余额必须是整数。",
    "settings.usage.autoTopUp.threshold.error.minimum": "请将最低余额设置为至少 125 额度。",
    "settings.usage.autoTopUp.target.label": "目标余额",
    "settings.usage.autoTopUp.target.helper": "自动充值会将你的额度余额补回到这个数值。",
    "settings.usage.autoTopUp.target.ariaLabel": "自动充值目标余额",
    "settings.usage.autoTopUp.target.equivalent":
      "至少会购买 {creditCount} 额度，约合 <strong>{amount}</strong>",
    "settings.usage.autoTopUp.target.equivalent.loading": "正在加载价格",
    "settings.usage.autoTopUp.target.error.missing": "请输入目标余额。",
    "settings.usage.autoTopUp.target.error.wholeNumber": "目标余额必须是整数。",
    "settings.usage.autoTopUp.target.error.minimumDifference": "请将目标余额设置为至少比最低余额高 125 额度。",
    "settings.usage.autoTopUp.disable": "关闭",
    "settings.usage.autoTopUp.cancel": "取消",
    "settings.usage.autoTopUp.save": "保存",
    "settings.usage.autoTopUp.enable": "开启",
    "settings.usage.autoTopUp.immediateTopUpNotice.enable":
      "开启自动充值后，会立即一次性购买 {creditCount} 额度以达到你的目标余额。预计费用：<strong>{amount}</strong>。",
    "settings.usage.autoTopUp.immediateTopUpNotice.update":
      "更新设置后，会立即一次性购买 {creditCount} 额度，预计费用为 <strong>{amount}</strong>。",
    "settings.usage.autoTopUp.immediateTopUpFailure.generic":
      "首次充值失败。<actionLine><managePayment>更新付款方式</managePayment>或<purchaseCredit>直接购买额度</purchaseCredit>。</actionLine>",
    "settings.usage.autoTopUp.immediateTopUpFailure.amount":
      "预计金额为 {amount} 的首次充值失败。<actionLine><managePayment>更新付款方式</managePayment>或<purchaseCredit>直接购买额度</purchaseCredit>。</actionLine>",
    "settings.usage.autoTopUp.enable.success": "已启用自动充值",
    "settings.usage.autoTopUp.enable.error": "启用自动充值失败",
    "settings.usage.autoTopUp.update.success": "已更新自动充值设置",
    "settings.usage.autoTopUp.update.error": "更新自动充值设置失败",
    "settings.usage.autoTopUp.disable.success": "已关闭自动充值",
    "settings.usage.autoTopUp.disable.error": "关闭自动充值失败",
    "settings.usage.autoTopUp.save.error": "保存自动充值设置失败",
    "settings.usage.limits.title": "常规使用限制",
    "settings.usage.limits.spark.title": "GPT-5.3-Codex-Spark 使用限制",
    "settings.usage.limits.fiveHour.label": "5 小时使用限制",
    "settings.usage.limits.weekly.label": "每周使用限制",
    "settings.usage.limits.window.resetAt": "在 {time} 重置",
    "settings.usage.limits.progress.ariaLabel": "剩余用量",
    "settings.usage.limits.progress.remaining": "剩余 {remaining}%",
    "settings.general.enterBehavior.label": "长提示词发送需按 {modifierSymbol} + enter",
    "settings.general.enterBehavior.description": "启用后，多行提示词需要按 {modifierSymbol} + enter 才会发送。",
    "settings.general.followUpQueueMode.label": "跟进行为",
    "settings.general.followUpQueueMode.description":
      "在 Codex 运行时将后续操作加入队列，或引导当前运行。按 {invertFollowUpShortcutLabel} 可对单条消息执行相反操作",
    "settings.general.followUpQueueMode.queue": "排队",
    "settings.general.followUpQueueMode.interrupt": "引导",
    "settings.general.reviewDelivery.label": "代码审查",
    "settings.general.reviewDelivery.description": "尽可能在当前对话中启动 /review，或发起单独的审查对话",
    "settings.general.reviewDelivery.inline": "行内视图",
    "settings.general.reviewDelivery.detached": "分离视图",
    "settings.agent.speed.label": "速度",
    "settings.agent.speed.description":
      "选择聊天、子智能体和上下文压缩中的推理速度。快速模式会增加套餐用量",
    "settings.agent.speed.option.fast": "快速",
    "settings.agent.speed.option.fast.description": "1.5 倍速，套餐用量增加",
    "settings.agent.speed.option.standard": "标准",
    "settings.agent.speed.option.standard.description": "默认速度",
    "settings.agent.permissionsMode.groupTitle": "权限",
    "settings.agent.permissionsMode.default.title": "默认权限",
    "settings.agent.permissionsMode.default.description":
      "默认情况下，Codex 可以读取并编辑其工作区中的文件。必要时，它可以请求额外的访问权限",
    "settings.agent.permissionsMode.default.toggle": "默认权限始终显示",
    "settings.agent.permissionsMode.autoReview.title": "自动审核",
    "settings.agent.permissionsMode.autoReview.description":
      "Codex 可以读取和编辑其工作区中的文件。Codex 会自动审核额外访问权限请求。自动审核可能会出错。<a>了解更多</a>有关高风险的信息。",
    "settings.agent.permissionsMode.autoReview.toggle": "在编排器中显示自动审核",
    "settings.agent.permissionsMode.fullAccess.title": "完全访问权限",
    "settings.agent.permissionsMode.fullAccess.description":
      "当 Codex 以完全访问权限运行时，无需你批准，即可编辑你的电脑上的任何文件并运行联网命令。这会显著增加数据丢失、泄露或意外行为的风险。<a>了解更多</a>有关高风险的信息。",
    "settings.agent.permissionsMode.fullAccess.toggle":
      "在编排器中显示完全访问权限",
    "settings.workMode.groupTitle": "工作模式",
    "settings.workMode.groupDescription": "选择 Codex 显示多少技术细节",
    "settings.workMode.radioGroup": "工作模式",
    "settings.workMode.coding.title": "适用于编程",
    "settings.workMode.coding.description": "更具技术性的回复和控制",
    "settings.workMode.everyday.title": "适用于日常工作",
    "settings.workMode.everyday.description": "同样强大，技术细节更少",
    "settings.agent.ambientSuggestions.groupTitle": "建议提示",
    "settings.agent.ambientSuggestions.rowLabel":
      "搜索项目文件和已连接应用，建议下一步操作",
    "settings.agent.ambientSuggestions.toggleLabel": "启用智能建议",
    "settings.general.groupTitle": "常规",
    "settings.general.notifications": "通知",
    "settings.general.dictation": "听写",
    "settings.general.globalDictationHotkey.label": "按住听写快捷键",
    "settings.general.globalDictationHotkey.description":
      "在桌面任意位置按住，即可在光标处听写",
    "settings.general.globalDictationHotkey.errorGeneric":
      "更新按住听写快捷键失败",
    "settings.general.globalDictationHotkey.off": "关闭",
    "settings.general.globalDictationHotkey.set": "设置",
    "settings.general.globalDictationHotkey.change": "更改",
    "settings.general.globalDictationHotkey.clear": "清除",
    "settings.general.globalDictationHotkey.cancel": "取消",
    "settings.general.globalDictationHotkey.capturePrompt": "按下快捷键",
    "settings.general.globalDictationHotkey.captureAriaLabel":
      "按住听写快捷键录入",
    "settings.general.globalDictationToggleHotkey.label": "切换听写快捷键",
    "settings.general.globalDictationToggleHotkey.description":
      "在桌面任意位置按一次开始听写，再按一次停止",
    "settings.general.globalDictationToggleHotkey.errorGeneric":
      "更新切换听写快捷键失败",
    "settings.general.globalDictationToggleHotkey.captureAriaLabel":
      "切换听写快捷键录入",
    "settings.general.globalDictationToggleHotkey.set": "设置",
    "settings.general.globalDictationToggleHotkey.change": "更改",
    "settings.general.globalDictationToggleHotkey.clear": "清除",
    "settings.general.globalDictationHistory.emptyTitle": "最近的听写记录",
    "settings.general.globalDictationHistory.emptyDescription":
      "你最近的听写记录会显示在这里，便于在文本没有出现在预期位置时找回内容",
    "settings.general.globalDictationHistory.copy": "复制听写文本",
    "settings.general.dictationDictionary.label": "听写词典",
    "settings.general.dictationDictionary.description":
      "听写应能识别的单词或短语",
    "settings.general.dictationDictionary.entryLabel": "词典条目",
    "settings.general.dictationDictionary.addEntry": "添加条目",
    "settings.general.dictationDictionary.removeEntry": "删除条目",
    "settings.general.gpuTearingDebug": "GPU 撕裂调试",
    "settings.general.gpuTearingDebug.subtitle":
      "临时合成器隔离开关。更改会立即生效，并且仅在启用调试开关时有效。",
    "settings.general.gpuTearingDebug.toggle": "切换 {settingName}",
    "settings.general.gpuTearingDebug.disableScrollFadeMask.label":
      "禁用滚动淡化遮罩",
    "settings.general.gpuTearingDebug.disableScrollFadeMask.description":
      "完全移除滚动边缘渐隐蒙版，以确认蒙版合成是否会触发撕裂",
    "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.label":
      "禁用滚动渐隐动画",
    "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.description":
      "保留静态渐隐蒙版，但移除与滚动关联的动画时间线",
    "settings.general.gpuTearingDebug.disableBackdropBlur.label":
      "禁用背景模糊",
    "settings.general.gpuTearingDebug.disableBackdropBlur.description":
      "在整个 Web UI 中强制关闭背景滤镜，以减少分层模糊合成",
    "settings.general.gpuTearingDebug.disableCssMotion.label":
      "禁用 CSS 动效",
    "settings.general.gpuTearingDebug.disableCssMotion.description":
      "关闭 CSS 动画和过渡，以隔离合成器动画工作",
    "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.label":
      "强制网页背景不透明",
    "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.description":
      "将渲染器根节点和 body 绘制为不透明背景，以隔离透明窗口合成",
    "notifications.turnMode.label": "轮次完成通知",
    "notifications.turnMode.description": "设置 Codex 完成任务时的提醒",
    "notifications.turnMode.off": "从不",
    "notifications.turnMode.unfocused": "仅当应用失焦时",
    "notifications.turnMode.always": "始终",
    "notifications.permissions.label": "启用权限通知",
    "notifications.permissions.description": "在需要通知权限时显示提醒",
    "notifications.questions.label": "启用问题通知",
    "notifications.questions.description": "需要输入才能继续时显示提醒",
    "settings.general.experimentalFeatures": "实验性功能（Beta）",
    "settings.general.experimentalFeatures.restartNote":
      "重启 Codex 以应用实验性功能更改",
    "settings.general.experimentalFeatures.loading":
      "正在加载实验性功能…",
    "settings.general.experimentalFeatures.empty":
      "当前没有可用的 Beta 实验性功能",
    "settings.general.experimentalFeatures.toggle":
      "切换{featureName}",
    "settings.general.experimentalFeatures.plugins.label": "插件",
    "settings.general.experimentalFeatures.plugins.description":
      "在 Codex 中启用插件体验",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.label": "弹出窗口快捷键",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.description":
      "为弹出窗口设置全局快捷键。留空则保持关闭。",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.off": "禁用",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.capturePrompt":
      "按下快捷键",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.captureAriaLabel":
      "弹出窗口热键捕获",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.cancel": "取消",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.set": "设置",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.change": "更改",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.clear": "清除",
    "settings.general.experimentalFeatures.hotkeyWindowHotkey.errorGeneric":
      "更新弹出窗口快捷键失败。",
    "settings.agent.dependencies.sectionTitle": "工作空间依赖项",
    "settings.agent.dependencies.bundleVersion.label": "当前版本",
    "settings.agent.dependencies.bundleVersion.loading": "正在检查…",
    "settings.agent.dependencies.bundleVersion.notInstalled": "未安装",
    "settings.agent.dependencies.bundleVersion.problemDescription":
      "如果工具调用失败，请运行诊断或重新安装",
    "settings.agent.dependencies.enabled.label": "Codex 依赖项",
    "settings.agent.dependencies.enabled.description":
      "允许 Codex 安装并提供随附的 Node.js 和 Python 工具",
    "settings.agent.dependencies.enabled.ariaLabel":
      "启用 Codex 依赖项",
    "settings.agent.dependencies.diagnose.label":
      "诊断 Codex 工作空间中的问题",
    "settings.agent.dependencies.diagnose.description":
      "检查当前捆绑包并记录诊断日志",
    "settings.agent.dependencies.diagnose.button": "诊断",
    "settings.agent.dependencies.diagnose.ok": "Codex 依赖项状态良好",
    "settings.agent.dependencies.diagnose.problem":
      "Codex 依赖项可能需要修复。若此问题持续出现，请发送 /feedback",
    "settings.agent.dependencies.diagnose.failed":
      "无法诊断 Codex 依赖项",
    "settings.agent.dependencies.reset.label": "重置并安装工作空间",
    "settings.agent.dependencies.reset.description":
      "删除本地捆绑包，重新下载后再重新加载工具",
    "settings.agent.dependencies.reset.button": "重新安装",
    "settings.agent.dependencies.reset.installed":
      "Codex 依赖项已重新安装",
    "settings.agent.dependencies.reset.canceled":
      "Codex 依赖项下载已取消",
    "settings.agent.dependencies.reset.failed":
      "无法重新安装 Codex 依赖项",
    "settings.agent.dependencies.cancel.button": "取消下载",
    "settings.agent.dependencies.cancel.noop":
      "当前没有正在进行的 Codex 依赖下载",
    "settings.agent.dependencies.cancel.canceled":
      "正在取消 Codex 依赖项下载",
    "settings.agent.dependencies.cancel.failed":
      "无法取消 Codex 依赖项下载",
    "settings.remoteControlConnections.localRemoteControl.label":
      "在此电脑上启用远程控制",
    "settings.remoteControlConnections.localRemoteControl.description":
      "允许其他已登录的 Codex 客户端连接到这台电脑",
    "localConversation.primaryRuntimeInstallStatus.downloading":
      "正在设置工作区：{percent}%",
    "localConversation.primaryRuntimeInstallStatus.extracting":
      "正在准备工作区",
    "localConversation.primaryRuntimeInstallStatus.finalizing":
      "正在完成工作区设置",
    "settings.general.power.preventSleepWhileRunning.label":
      "运行时防止系统休眠",
    "settings.general.power.preventSleepWhileRunning.description":
      "在 Codex 运行对话时，让电脑保持唤醒状态",
    "settings.agentEnvironment.label": "智能体环境",
    "settings.agentEnvironment.description": "选择智能体在 Windows 上的运行位置",
    "settings.agentEnvironment.windowsNative": "Windows 原生",
    "settings.agentEnvironment.windowsNative.description": "直接在 Windows 中运行智能体",
    "settings.agentEnvironment.wsl": "适用于 Linux 的 Windows 子系统",
    "settings.agentEnvironment.wsl.description": "在 WSL 中运行智能体",
    "settings.agentEnvironment.restartNotice": "重启 Codex 以应用此更改。智能体仍在 {currentEnvironment} 中运行。",
    "settings.agentEnvironment.wslBashError": "由于缺少 /usr/bin/bash，Codex 无法在{distributionName}中运行",
    "settings.agentEnvironment.wslBashError.unknownDistribution": "此 WSL 发行版",
    "settings.general.importExternalAgent.rowLabel": "从其他 AI 应用导入设置",
    "settings.general.importExternalAgent.importedRowLabel": "导入的智能体设置",
    "settings.general.importExternalAgent.rowDescription":
      "导入你的设置、项目和最近聊天记录",
    "settings.general.importExternalAgent.lastImported": "上次于 {relativeTime} 前导入",
    "settings.general.importExternalAgent.checking": "正在检查",
    "settings.general.importExternalAgent.importing": "正在导入",
    "settings.general.importExternalAgent.import": "导入",
    "settings.general.importExternalAgent.importAgain": "再次导入",
    "settings.general.importExternalAgent.viewImportedFiles": "查看已导入的文件",
    "settings.general.importExternalAgent.continueWithCodex": "继续使用 Codex",
    "onboarding.welcome.simple.title": "欢迎！",
    "onboarding.welcome.simple.subtitle": "继续选择你的工作区",
    "onboarding.welcome.continue": "继续",
    "onboarding.welcome.close": "关闭",
    "onboarding.welcome.new.title.anon": "欢迎",
    "onboarding.welcome.debugFallback.description": "调试覆盖强制显示欢迎界面。继续测试引导流程。",
    "onboarding.welcomeV2.role.title": "你主要做什么类型的工作？",
    "onboarding.welcomeV2.role.subtitle": "按你的工作方式自定义 Codex",
    "onboarding.welcomeV2.role.engineering": "工程",
    "onboarding.welcomeV2.role.product": "产品",
    "onboarding.welcomeV2.role.finance": "财务",
    "onboarding.welcomeV2.role.marketing": "市场",
    "onboarding.welcomeV2.role.sales": "销售",
    "onboarding.welcomeV2.role.operations": "运营",
    "onboarding.welcomeV2.role.dataScience": "数据科学",
    "onboarding.welcomeV2.role.design": "设计",
    "onboarding.welcomeV2.role.student": "学生",
    "onboarding.welcomeV2.role.somethingElse": "其他",
    "onboarding.welcomeV2.intent.title": "Codex 可以帮你做什么？",
    "onboarding.welcomeV2.intent.subtitle": "选择要最先处理的内容",
    "onboarding.welcomeV2.intent.buildSoftware": "开发软件",
    "onboarding.welcomeV2.intent.designProducts": "设计产品",
    "onboarding.welcomeV2.intent.manageProjects": "管理项目",
    "onboarding.welcomeV2.intent.searchEmailChat": "管理收件箱",
    "onboarding.welcomeV2.intent.manageCalendar": "整理日历",
    "onboarding.welcomeV2.intent.workWithDocs": "处理文档",
    "onboarding.welcomeV2.intent.analyzeData": "分析数据",
    "onboarding.welcomeV2.intent.other": "其他",
    "onboarding.welcomeV2.workMode.title": "你希望 Codex 呈现出多强的技术性？",
    "onboarding.welcomeV2.workMode.subtitle": "选择 Codex 显示的详细程度",
    "onboarding.welcomeV2.workMode.coding.title": "适用于编程",
    "onboarding.welcomeV2.workMode.coding.description": "更偏技术性的回答和代码细节",
    "onboarding.welcomeV2.workMode.nonCoding.title": "适用于日常工作",
    "onboarding.welcomeV2.workMode.nonCoding.description": "同样强大的智能体，技术细节更少",
    "onboarding.welcomeV2.workMode.settingsHint": "你之后随时可在设置中更改",
    "onboarding.welcomeV2.personalized.title": "建议个性化任务",
    "onboarding.welcomeV2.personalized.description":
      "Codex 可以通过搜索项目文件和已连接应用来建议下一步操作",
    "onboarding.welcomeV2.personalized.toggle": "启用个性化建议",
    "onboarding.welcomeV2.personalizedSuggestions.title": "建议个性化任务",
    "onboarding.welcomeV2.personalizedSuggestions.description":
      "Codex 可通过搜索项目文件和已连接的应用，建议接下来该做什么",
    "onboarding.welcomeV2.personalizedSuggestions.toggle": "启用个性化建议",
    "onboarding.welcomeV2.personalizedSuggestions.info": "关于个性化建议",
    "onboarding.welcomeV2.skip": "跳过",
    "onboarding.welcomeV2.externalAgentImport.providers.dialogTitle": "从其他 AI 应用导入",
    "onboarding.welcomeV2.externalAgentImport.providers.title": "从其他 AI 应用导入工作",
    "onboarding.welcomeV2.externalAgentImport.providers.subtitle":
      "导入你的设置、项目和最近的聊天记录",
    "onboarding.welcomeV2.externalAgentImport.providers.appsFound": "找到的应用",
    "onboarding.welcomeV2.externalAgentImport.providers.list": "找到的应用",
    "onboarding.welcomeV2.externalAgentImport.providers.claudeCode": "Claude Code",
    "onboarding.welcomeV2.externalAgentImport.providers.claudeCowork": "Claude Cowork",
    "onboarding.welcomeV2.externalAgentImport.providers.standardChatsUnsupported":
      "无法导入标准 Claude Chat 数据",
    "onboarding.welcomeV2.externalAgentImport.providers.toggle": "导入 {provider}",
    "onboarding.welcomeV2.externalAgentImport.items.title": "选择要导入的项目",
    "onboarding.welcomeV2.externalAgentImport.items.subtitle":
      "导入所有工作内容，或手动挑选要迁移的内容",
    "onboarding.welcomeV2.externalAgentImport.items.list": "导入选项",
    "onboarding.welcomeV2.externalAgentImport.items.bothProvidersNote":
      "Claude Code 和 Claude Cowork 的项目和聊天会话将导入 Codex",
    "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.title": "工具和设置",
    "onboarding.welcomeV2.externalAgentImport.toolsAndSetup.description": "设置、说明、插件、技能",
    "onboarding.welcomeV2.externalAgentImport.projects.title": "项目（{count}）",
    "onboarding.welcomeV2.externalAgentImport.projects.description": "在现有项目中工作",
    "onboarding.welcomeV2.externalAgentImport.recentChats.title": "聊天会话（{count}）",
    "onboarding.welcomeV2.externalAgentImport.recentChats.description": "最近30天的聊天",
    "onboarding.welcomeV2.externalAgentImport.customize": "自定义",
    "onboarding.welcomeV2.externalAgentImport.customize.title": "选择要导入的内容",
    "onboarding.welcomeV2.externalAgentImport.customize.description": "选择要导入的已检测项目",
    "onboarding.welcomeV2.externalAgentImport.customize.confirm": "确认",
    "onboarding.welcomeV2.externalAgentImport.customize.projects": "项目（{count}）",
    "onboarding.welcomeV2.externalAgentImport.customize.projectsDescription": "在现有项目中工作",
    "onboarding.welcomeV2.externalAgentImport.customize.pluginsWithCount": "插件（{count}）",
    "onboarding.welcomeV2.externalAgentImport.error": "无法完成导入。请重试，或暂时跳过。",
    "electron.onboarding.workspace.title": "选择项目",
    "electron.onboarding.workspace.subtitle": "Codex 将能够在所选文件夹中编辑文件并运行命令。",
    "electron.onboarding.workspace.openFolder": "添加项目",
    "electron.onboarding.workspace.loading": "正在加载项目...",
    "electron.onboarding.workspace.listLabel": "可用项目",
    "electron.onboarding.workspace.selectAll": "全选",
    "electron.onboarding.workspace.empty": "添加项目后即可继续。",
    "electron.onboarding.workspace.continue": "继续",
    "electron.onboarding.workspace.skip": "跳过",
    "electron.onboarding.workspace.skipping": "正在创建新项目...",
    "electron.onboarding.workspace.skip.playground": "继续进入 Playground",
    "electron.onboarding.workspace.skipping.playground": "正在打开 Playground...",
    "electron.onboarding.workspace.skip.error": "无法创建新项目：{message}",
    "electron.onboarding.workspace.skip.error.unknown": "未知错误",
    "projectSetup.addProjectMenu.startFromScratch": "从头开始",
    "projectSetup.addProjectMenu.useExistingFolder": "使用现有文件夹",
    "settings.openIn.integratedTerminalShell.label": "集成终端 Shell",
    "settings.openIn.integratedTerminalShell.description": "选择要在集成终端中打开的 Shell。",
    "settings.openIn.integratedTerminalShell.unavailable": "无可用 Shell",
    "settings.ide.defaultOpenTarget.label": "默认打开目标",
    "settings.ide.defaultOpenTarget.description": "默认打开文件和文件夹的位置",
    "settings.ide.defaultOpenTarget.placeholder": "未找到目标",
    "externalAgentConfig.projectImport.title": "选择要导入的设置",
    "externalAgentConfig.projectImport.subtitle": "Codex 在另一款智能体应用中发现了有用的设置",
    "externalAgentConfig.projectImport.confirm": "继续",
    "externalAgentConfig.projectImport.cancel": "以后再说",
    "externalAgentConfig.projectImport.error": "无法导入项目设置",
    "externalAgentConfig.itemType.agentsMd": "说明",
    "externalAgentConfig.itemType.config": "设置",
    "externalAgentConfig.itemType.skills": "技能",
    "externalAgentConfig.itemType.plugins": "插件",
    "externalAgentConfig.itemType.subagents": "智能体",
    "externalAgentConfig.itemType.hooks": "钩子",
    "externalAgentConfig.itemType.commands": "命令",
    "externalAgentConfig.itemType.sessions": "会话",
    "externalAgentConfig.itemType.mcpServerConfig": "MCP 服务器",
    "settings.agent.importSettings.sectionTitle": "导入外部智能体配置",
    "settings.agent.importSettings.sectionSubtitle":
      "已检测到来自其他智能体、可添加到 Codex 的设置",
    "settings.agent.importSettings.loadingLabel": "正在检查导入项",
    "settings.agent.importSettings.detectingDescription":
      "正在检查兼容的外部设置、AGENTS.md 和技能",
    "settings.agent.importSettings.sharedImportLabel": "导入其他智能体设置",
    "settings.agent.importSettings.sharedImportDescription":
      "从另一款本地智能体应用中选择设置、聊天记录和项目",
    "settings.agent.importSettings.applySelected": "导入到 Codex",
    "settings.agent.importSettings.remaining.summaryLabel": "已选中 {count} 项",
    "settings.agent.importSettings.remaining.summaryDescription":
      "迁移无法自动导入的所选设置",
    "settings.agent.importSettings.remaining.continueInCodex": "继续在 Codex 中处理",
    "settings.agent.importSettings.remaining.userConfigSettingsSection": "用户配置",
    "settings.agent.importSettings.remaining.currentProjectSettingsSection": "当前项目",
    "settings.agent.importSettings.remaining.itemDescription": "使用 Codex 迁移 {path}",
    "settings.agent.importSettings.remaining.slashCommandsLabel": "斜杠命令",
    "settings.agent.importSettings.remaining.hooksLabel": "钩子",
    "settings.agent.importSettings.remaining.mcpLabel": "MCP",
    "settings.agent.importSettings.remaining.pluginsLabel": "插件",
    "settings.agent.importSettings.remaining.subagentsLabel": "子智能体",
    "settings.agent.importSettings.toast.importing": "正在导入智能体设置",
    "settings.agent.importSettings.toast.success": "已导入智能体设置",
    "settings.agent.importSettings.toast.error": "无法导入智能体设置",
    "settings.agent.importSettings.progress.close": "关闭",
    "settings.agent.importSettings.progress.continueInCodex": "继续使用 Codex",
    "settings.agent.importSettings.progress.scrollToBottom": "滚动到底部",
    "settings.agent.importSettings.progress.remainingOnlyTitle": "发现其他设置",
    "settings.agent.importSettings.progress.remainingOnlySubtitle":
      "Codex 发现还有其他设置需要额外步骤才能导入。",
    "settings.agent.importSettings.progress.successTitle": "已导入外部智能体配置",
    "settings.agent.importSettings.progress.successSubtitle":
      "已将所选配置复制到 Codex",
    "settings.agent.importSettings.progress.errorTitle": "导入失败",
    "settings.agent.importSettings.progress.errorSubtitle":
      "部分配置无法导入。请检查所选项目后重试",
    "settings.agent.importSettings.progress.runningTitle": "正在导入外部智能体配置",
    "settings.agent.importSettings.progress.runningSubtitle":
      "请稍候，这可能需要一点时间",
    "settings.agent.importSettings.progress.userConfigSection": "用户配置",
    "settings.agent.importSettings.progress.currentProjectSection": "当前项目",
    "wham.formattedRelativeDateTime.compactMinutesAgo": "{value} 分",
    "wham.formattedRelativeDateTime.compactHoursAgo": "{value} 小时",
    "wham.formattedRelativeDateTime.compactDaysAgo": "{value} 天",
    "wham.formattedRelativeDateTime.compactWeeksAgo": "{value} 周",
    "wham.formattedRelativeDateTime.compactMonthsAgo": "{value} 个月",
    "wham.formattedRelativeDateTime.compactYearsAgo": "{value} 年",
    "settings.general.appearance.theme": "主题",
    "settings.general.appearance.theme.description": "使用浅色、深色，或匹配你的系统",
    "settings.general.appearance.theme.light": "浅色",
    "settings.general.appearance.theme.dark": "深色",
    "settings.general.appearance.theme.system": "系统",
    "settings.general.appearance.usePointerCursors.label": "使用指针光标",
    "settings.general.appearance.usePointerCursors.description": "悬停交互元素时切换为指针光标",
    "settings.general.appearance.sansFontSize.row": "UI 字体大小",
    "settings.general.appearance.sansFontSize.row.description": "调整 Codex UI 使用的基准字号",
    "settings.general.appearance.sansFontSize": "无衬线字体大小",
    "settings.general.appearance.sansFontSize.units": "px",
    "settings.general.appearance.codeFontSize.row": "代码字体大小",
    "settings.general.appearance.codeFontSize.row.description": "调整聊天和差异视图中代码使用的基础字号",
    "settings.general.appearance.codeFontSize": "代码字体大小",
    "settings.general.appearance.codeFontSize.units": "px",
    "settings.general.appearance.fontSmoothing.label": "字体平滑",
    "settings.general.appearance.fontSmoothing.description":
      "使用 macOS 原生字体抗锯齿",
    "settings.general.appearance.lightChromeTheme": "浅色主题",
    "settings.general.appearance.darkChromeTheme": "深色主题",
    "settings.general.appearance.codeTheme": "{variant} 代码主题",
    "settings.general.appearance.codeTheme.previewGlyph": "Aa",
    "settings.general.appearance.chromeTheme.accent": "{variant} 强调色",
    "settings.general.appearance.chromeTheme.accent.short": "强调色",
    "settings.general.appearance.chromeTheme.surface": "{variant} 背景颜色",
    "settings.general.appearance.chromeTheme.surface.short": "背景",
    "settings.general.appearance.chromeTheme.ink": "{variant} 墨迹颜色",
    "settings.general.appearance.chromeTheme.ink.short": "前景",
    "settings.general.appearance.chromeTheme.uiFontFamily": "{variant} UI 字体",
    "settings.general.appearance.chromeTheme.uiFontFamily.short": "UI 字体",
    "settings.general.appearance.chromeTheme.codeFontFamily": "{variant} 代码字体",
    "settings.general.appearance.chromeTheme.codeFontFamily.short": "代码字体",
    "settings.general.appearance.chromeTheme.translucentSidebar": "{variant} 半透明侧边栏",
    "settings.general.appearance.chromeTheme.translucentSidebar.short": "半透明侧边栏",
    "settings.general.appearance.chromeTheme.contrast": "{variant} 对比度",
    "settings.general.appearance.chromeTheme.contrast.short": "对比度",
    "settings.general.appearance.chromeTheme.import": "导入",
    "settings.general.appearance.chromeTheme.export": "复制主题",
    "settings.general.appearance.chromeTheme.export.success": "已复制 {variant} 主题",
    "settings.general.appearance.chromeTheme.export.error": "无法复制 {variant} 主题",
    "settings.general.appearance.chromeTheme.import.success": "已导入 {variant} 主题",
    "settings.general.appearance.chromeTheme.import.error": "无法导入 {variant} 主题",
    "settings.general.appearance.chromeTheme.import.dialog.title": "导入主题",
    "settings.general.appearance.chromeTheme.import.dialog.ariaLabel": "{variant} 主题分享字符串",
    "settings.general.appearance.chromeTheme.import.dialog.cancel": "取消",
    "settings.general.appearance.chromeTheme.import.dialog.submit": "导入主题",
    "settings.configuration": "配置",
    "settings.backToApp": "返回应用",
    "settings.nav.back": "返回应用",
    "settings.nav.account": "账户",
    "settings.nav.connections": "连接",
    "settings.nav.hooks-settings": "Hooks",
    "settings.title": "设置",
    "settings.nav.heading.app": "应用",
    "settings.nav.heading.host": "主机",
    "settings.hostDropdown.local": "本地",
    "settings.hostDropdown.title": "主机",
    "settings.account.subtitle": "管理浏览器开发主机使用的 ChatGPT 令牌",
    "settings.account.current.title": "当前账户",
    "settings.account.authMethod": "身份验证方式",
    "settings.account.authMethod.chatgptToken": "ChatGPT Bearer 令牌",
    "settings.account.email": "电子邮箱",
    "settings.account.accountId": "账户 ID",
    "settings.account.userId": "用户 ID",
    "settings.account.plan": "套餐",
    "settings.account.token.title": "浏览器令牌",
    "settings.account.token.subtitle": "如果云端请求发起失败，请粘贴替换令牌",
    "settings.account.token.inputLabel": "ChatGPT Bearer 令牌",
    "settings.account.token.placeholder": "Bearer eyJ…",
    "settings.account.token.saved": "令牌已保存",
    "settings.account.token.save": "更新令牌",
    "settings.account.signOut": "登出",
    "settings.account.notAvailable": "不可用",
    "settings.agent.title": "配置",
    "settings.agent.configuration.subtitle.summary": "配置审批策略和沙盒设置 <a>了解更多</a>",
    "settings.agent.customConfig": "自定义 config.toml 设置",
    "settings.agent.openConfigToml": "打开 Config.toml",
    "settings.agent.configuration.approval.label": "批准策略",
    "settings.agent.configuration.approval.definition": "选择 Codex 何时请求批准",
    "settings.agent.configuration.sandbox.label": "沙盒设置",
    "settings.agent.configuration.sandbox.definition": "选择 Codex 的命令执行权限",
    "settings.agent.configuration.network.label": "允许网络访问",
    "settings.agent.configuration.network.definition": "当沙盒设置为工作区写入时允许网络访问",
    "settings.agent.configuration.scope.projectGroup": "项目配置",
    "settings.agent.configuration.scope.globalGroup": "全局配置",
    "settings.agent.configuration.scope.open": "打开 config.toml",
    "settings.agent.configuration.scope.user": "用户配置",
    "settings.agent.configuration.scope.managed": "管理员配置",
    "settings.agent.configuration.scope.managedDescription": "由管理员策略管理",
    "settings.agent.configuration.scope.loading": "正在加载...",
    "settings.agent.configuration.scope.unavailable": "配置范围不可用。",
    "settings.agent.configuration.scope.readOnly": "无法在此处编辑该配置源。",
    "settings.agent.configuration.control.managed": "该值由管理员策略管理。",
    "settings.agent.configuration.configToml": "config.toml",
    "settings.agent.configuration.configToml.description": "编辑你的配置以自定义代理行为",
    "settings.agent.configuration.configToml.restartNote": "编辑后重启 Codex 以应用更改",
    "settings.agent.configuration.configToml.docs": "文档",
    "settings.openSourceLicenses.rowLabel": "打开源许可证",
    "settings.openSourceLicenses.rowDescription": "捆绑依赖项的第三方声明",
    "settings.openSourceLicenses.view": "查看",
    "settings.openSourceLicenses.back": "返回",
    "settings.openSourceLicenses.title": "打开源许可证",
    "settings.openSourceLicenses.subtitle": "本应用所含依赖项的第三方声明",
    "settings.openSourceLicenses.loading": "正在加载…",
    "settings.openSourceLicenses.missing": "找不到第三方声明。",
    "settings.section.account": "账户",
    "settings.section.connections": "连接",
    "settings.section.hooks-settings": "Hooks",
    "settings.hooks.subtitle": "管理来自配置和已启用插件的生命周期 Hooks <a>了解更多</a>",
    "settings.hooks.refresh": "刷新",
    "settings.hooks.refresh.success": "已刷新 Hooks",
    "settings.hooks.loadingProjects.label": "正在加载项目…",
    "settings.hooks.emptyProject.label": "未选择项目",
    "settings.hooks.emptyProject.description": "打开一个项目以查看其 Hooks",
    "settings.hooks.loading.label": "正在加载 Hooks…",
    "settings.hooks.loadError.label": "无法加载 Hooks",
    "settings.hooks.project.loading": "选择项目",
    "settings.hooks.project.group": "项目",
    "settings.hooks.issues.summary":
      "{count, plural, one {此项目加载 Hooks 时出现 # 个问题} other {此项目加载 Hooks 时出现 # 个问题}}",
    "settings.hooks.issues.error": "{path}: {message}",
    "settings.hooks.event.counts": "{active} 个已启用 · {installed} 个已安装",
    "settings.hooks.event.emptyCounts": "0 个已安装",
    "settings.hooks.event.moreActions": "更多操作",
    "settings.hooks.event.openSourceFile": "打开源文件",
    "settings.hooks.event.managedTooltip": "受管 Hooks 始终开启",
    "settings.hooks.event.preToolUse": "PreToolUse",
    "settings.hooks.event.preToolUse.description": "在工具执行前",
    "settings.hooks.event.permissionRequest": "PermissionRequest",
    "settings.hooks.event.permissionRequest.description": "请求权限时",
    "settings.hooks.event.postToolUse": "PostToolUse",
    "settings.hooks.event.postToolUse.description": "工具执行后",
    "settings.hooks.event.preCompact": "PreCompact",
    "settings.hooks.event.preCompact.description": "Codex 压缩对话前",
    "settings.hooks.event.postCompact": "PostCompact",
    "settings.hooks.event.postCompact.description": "Codex 压缩对话后",
    "settings.hooks.event.sessionStart": "SessionStart",
    "settings.hooks.event.sessionStart.description": "新会话开始时",
    "settings.hooks.event.userPromptSubmit": "UserPromptSubmit",
    "settings.hooks.event.userPromptSubmit.description": "用户提交提示词时",
    "settings.hooks.event.stop": "Stop",
    "settings.hooks.event.stop.description": "Codex 结束本轮前",
    "settings.hooks.event.fallbackHookTitle": "Hook {index}",
    "settings.hooks.source.plugin": "插件",
    "settings.hooks.source.pluginSummary": "插件 · {pluginName}",
    "settings.hooks.source.adminConfig": "管理员配置",
    "settings.hooks.source.userConfig": "用户配置",
    "settings.hooks.source.projectConfig": "项目配置",
    "settings.hooks.source.sessionFlags": "会话标志",
    "settings.hooks.source.unknown": "未知来源",
    "settings.mcp.loading": "正在加载 MCP 服务器…",
    "settings.mcp.loadError.title": "无法加载 MCP 服务器",
    "settings.mcp.loadError.retry": "重试",
    "settings.mcp.empty": "未连接任何 MCP 服务器",
    "settings.mcp.addServer": "添加服务器",
    "settings.mcp.myServers": "服务器",
    "settings.mcp.restartApp": "重启",
    "settings.mcp.server.login": "验证",
    "settings.mcp.server.settings": "设置",
    "settings.mcp.server.enable": "启用",
    "settings.mcp.readOnly": "此服务器由项目配置管理。",
    "settings.mcp.oauth.error": "无法验证 MCP 服务器",
    "settings.mcp.refreshing": "正在刷新 MCP 服务器…",
    "settings.mcp.detail.titleExisting": "更新 {name} MCP",
    "settings.mcp.detail.titleNew": "连接自定义 MCP",
    "settings.mcp.detail.back": "返回",
    "settings.mcp.detail.docs": "打开 MCP 文档",
    "settings.mcp.detail.docs.link": "文档",
    "settings.mcp.detail.uninstall": "卸载",
    "settings.mcp.detail.name": "名称",
    "settings.mcp.detail.switchTransportNotice": "如需切换 MCP 服务器类型，请先卸载当前配置。",
    "settings.mcp.detail.transport.label": "传输方式",
    "settings.mcp.detail.transport.stdio": "STDIO",
    "settings.mcp.detail.transport.http": "Streamable HTTP",
    "settings.mcp.detail.command": "启动命令",
    "settings.mcp.detail.args": "参数",
    "settings.mcp.detail.addArgument": "添加参数",
    "settings.mcp.detail.envVars": "环境变量",
    "settings.mcp.detail.addEnvVar": "添加环境变量",
    "settings.mcp.detail.envVarPassthrough": "环境变量透传",
    "settings.mcp.detail.addEnvVarPassthrough": "添加变量",
    "settings.mcp.detail.cwd": "工作目录",
    "settings.mcp.detail.http.url": "URL",
    "settings.mcp.detail.http.bearerToken": "Bearer 令牌环境变量",
    "settings.mcp.detail.http.headers": "请求头",
    "settings.mcp.detail.http.addHeader": "添加请求头",
    "settings.mcp.detail.http.envHeaders": "来自环境变量的请求头",
    "settings.mcp.detail.http.addEnvHeader": "添加变量",
    "settings.mcp.detail.save": "保存",
    "settings.mcp.detail.remove": "移除",
    "settings.editRow.headerPlaceholder": "键",
    "settings.editRow.valuePlaceholder": "值",
    "settings.editRow.removeEntry": "移除条目",
    "settings.agent.approval.untrusted": "不受信任",
    "settings.agent.approval.onFailure": "失败时",
    "settings.agent.approval.onRequest": "按需",
    "settings.agent.approval.never": "从不",
    "settings.agent.sandbox.readOnly": "只读",
    "settings.agent.sandbox.workspaceWrite": "工作区写入",
    "settings.agent.sandbox.fullAccess": "完全访问",
    "settings.ide.language.label": "语言",
    "settings.ide.language.description": "应用 UI 语言",
    "settings.ide.language.auto": "自动检测",
    "settings.ide.language.autoOption": "自动检测",
    "settings.ide.language.search": "搜索语言",
    "settings.general.macMenuBar.label": "在菜单栏中显示",
    "settings.general.macMenuBar.description":
      "关闭主窗口后，仍在 macOS 菜单栏中保留 Codex",
    "settings.general.macMenuBar.ariaLabel": "在菜单栏中显示 Codex",
    "settings.personalization.agents.title": "自定义说明",
    "settings.personalization.agents.description": "为你的项目向 Codex 提供额外指令和上下文。<a>了解更多</a>",
    "settings.personalization.agents.placeholder": "添加你的自定义说明...",
    "settings.personalization.agents.loading": "正在加载 agents.md...",
    "settings.personalization.agents.loadError": "无法加载 agents.md。",
    "settings.personalization.agents.retry": "重试",
    "settings.personalization.agents.save": "保存",
    "settings.personalization.agents.save.success": "已保存 agents.md",
    "settings.personalization.agents.save.error": "无法保存 agents.md",
    "settings.personalization.personality.label": "个性",
    "settings.personalization.personality.description": "为 Codex 响应选择默认语气",
    "settings.personalization.memory.title": "记忆（实验性）",
    "settings.personalization.memory.subtitle": "设置 Codex 如何收集、保留和整合记忆。<a>了解更多</a>",
    "settings.general.experimentalFeatures.chronicle.name": "Chronicle 研究预览",
    "settings.general.experimentalFeatures.chronicle.memoriesRequiredTooltip": "启用记忆才能使用 Chronicle",
    "settings.general.experimentalFeatures.chronicle.buttonAriaLabel": "切换{featureName}",
    "settings.general.experimentalFeatures.chronicle.consentTitle": "启用 Chronicle 研究预览",
    "settings.general.experimentalFeatures.chronicle.consentBodyIntro":
      "Chronicle 是一项实验性功能，可利用你的屏幕上的上下文增强记忆。启用 Chronicle 后，Codex 会参考你看过的内容，为“完成我刚才在做的事”或“更新此仪表板”等提示提供更有帮助、更贴合上下文的回复。",
    "settings.general.experimentalFeatures.chronicle.consentBodyConsiderations": "启用 Chronicle 前，请注意以下事项：",
    "settings.general.experimentalFeatures.chronicle.consentBodyCost":
      "<strong>成本</strong>：Chronicle 使用图片输入并在后台运行，会快速消耗费用限额。",
    "settings.general.experimentalFeatures.chronicle.consentBodyPrivacy":
      "<strong>隐私</strong>：Chronicle 的屏幕截图可能包含你的屏幕上可见的敏感信息。（它无法访问你的麦克风或系统音频。）未经他人同意，请勿使用 Chronicle 录制会议或与他人的交流。在查看不希望被记忆记录的内容时，请暂停 Chronicle。",
    "settings.general.experimentalFeatures.chronicle.consentBodyPromptInjection":
      "<strong>提示词注入</strong>：使用 Chronicle 会增加来自屏幕内容的提示词注入攻击的风险。例如，如果你浏览一个含有恶意智能体指令的网站，Codex 可能会遵循这些指令。",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageHeading": "工作原理：",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageProcessing":
      "为了生成回忆，屏幕截图会在我们的服务器上处理，然后被删除。",
    "settings.general.experimentalFeatures.chronicle.consentBodyStorageLocal":
      "屏幕截图会暂时存储在设备上，记忆也会存储在设备上。两者均以未加密形式存储，因此请注意，你计算机上的其他应用程序可能可以访问这些文件。如果你在 ChatGPT 设置中允许，Codex 在聊天中使用这些记忆时，它们可能会被用于改进我们的模型。",
    "settings.general.experimentalFeatures.chronicle.consentBodyDisableIntro":
      "你可随时停用 Chronicle，停用后将不再继续进行屏幕截图。<link>了解更多。</link>",
    "settings.general.experimentalFeatures.chronicle.cancel": "取消",
    "settings.general.experimentalFeatures.chronicle.continue": "继续",
    "settings.general.experimentalFeatures.chronicle.description":
      "通过屏幕上下文增强记忆，以便 Codex 帮你处理正在进行的任何工作。<link>了解更多</link>",
    "settings.general.experimentalFeatures.chronicle.permission.runningStatus": "状态：{status}",
    "settings.general.experimentalFeatures.chronicle.permission.runningStatusAccessibility":
      "辅助功能：{status}（打开设置）",
    "settings.general.experimentalFeatures.chronicle.permission.screenRecording": "屏幕录制",
    "settings.general.experimentalFeatures.chronicle.permission.statusLabel": "状态",
    "settings.general.experimentalFeatures.chronicle.permission.notGranted":
      "{statusLabel}：未授予{permission}权限（打开设置）",
    "settings.general.experimentalFeatures.chronicle.permission.accessibility": "辅助功能",
    "settings.general.experimentalFeatures.chronicle.permission.status": "{permission}：{status}",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.paused": "已暂停",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.starting": "启动中",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.stopping": "正在停止",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.running": "正在运行",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.checking": "检查中",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.unknown": "未知",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.granted": "已授予",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.notDetermined": "未请求",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.denied": "已拒绝",
    "settings.general.experimentalFeatures.chronicle.permissionStatus.restricted": "受限",
    "settings.general.experimentalFeatures.chronicle.screenRecordingSettingsName": "屏幕录制",
    "settings.general.experimentalFeatures.chronicle.accessibilitySettingsName": "辅助功能",
    "settings.general.experimentalFeatures.chronicle.setupTitle": "正在设置 Chronicle",
    "settings.general.experimentalFeatures.chronicle.openScreenRecordingSettings": "打开系统设置",
    "settings.general.experimentalFeatures.chronicle.openAccessibilitySettings": "打开系统设置",
    "settings.general.experimentalFeatures.chronicle.askCodex": "试试看",
    "settings.general.experimentalFeatures.chronicle.setupClose": "关闭",
    "settings.general.experimentalFeatures.chronicle.permissionDragAppLabel":
      "将 Codex 拖到 {permissionSettingsName} 设置中",
    "settings.general.experimentalFeatures.chronicle.permissionDragApp":
      "如果列表中没有 {bundleName}，请将此应用图标拖到 {permissionSettingsName} 设置中",
    "settings.general.experimentalFeatures.chronicle.setupReadyTitle": "Chronicle 已准备就绪！",
    "settings.general.experimentalFeatures.chronicle.setupFailedTitle": "Chronicle 设置失败",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingPermissionNeededTitle":
      "允许 Chronicle 使用屏幕录制",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityPermissionNeededTitle":
      "允许 Chronicle 使用“辅助功能”",
    "settings.general.experimentalFeatures.chronicle.setupInProgressTitle": "正在设置 Chronicle",
    "settings.general.experimentalFeatures.chronicle.setupWaiting": "等待中…",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingRestricted":
      "“屏幕录制”受 macOS 或你的组织限制。如果解除限制且 Codex 获得“屏幕录制”权限，Chronicle 将自动继续。",
    "settings.general.experimentalFeatures.chronicle.setupScreenRecordingDenied":
      "请打开“系统设置”→“隐私与安全性”→“屏幕录制”，并启用 {bundleName}。你可能需要重新启动 Codex 以使更改生效。",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityRestricted":
      "辅助功能访问受 macOS 或你的组织限制。如果限制被解除且 Codex 获得辅助功能权限，Chronicle 将自动继续。",
    "settings.general.experimentalFeatures.chronicle.setupAccessibilityDenied":
      "请打开“系统设置”→“隐私与安全性”→“辅助功能”，然后启用 {bundleName}。",
    "settings.general.experimentalFeatures.chronicle.setupReady":
      "你可以随时点击 Codex 菜单栏中的“暂停 Chronicle” 来暂停 Chronicle。",
    "settings.general.experimentalFeatures.chronicle.setupFailed": "Chronicle 设置失败。",
    "settings.personalization.pets.title": "宠物",
    "settings.personalization.pets.current": "已选择 {petName}",
    "settings.personalization.pets.openPet": "唤醒宠物",
    "settings.personalization.pets.tuckAwayPet": "收起宠物",
    "settings.personalization.avatars.select": "选择",
    "settings.personalization.avatars.selected": "已选",
    "settings.pets.custom.title": "自定义宠物",
    "settings.pets.custom.openFolder": "打开文件夹",
    "settings.pets.custom.openFolderError": "无法打开宠物文件夹",
    "settings.pets.refresh": "刷新",
    "settings.pets.loadingCustom": "正在加载自定义宠物",
    "settings.pets.loadCustomError": "无法加载自定义宠物",
    "settings.pets.custom.create.title": "创建你自己的宠物",
    "settings.memory.enableMemoriesLabel": "启用记忆",
    "settings.memory.enableMemoriesDescription": "从聊天中生成新记忆，并在新聊天中调用",
    "settings.memory.enableMemoriesAriaLabel": "启用记忆",
    "settings.memory.noToolContextLabel": "跳过使用工具的聊天",
    "settings.memory.noToolContextDescription": "不要为使用 MCP 工具或网页搜索的聊天生成记忆",
    "settings.memory.noToolContextAriaLabel": "跳过使用工具的聊天",
    "settings.memory.resetMemoriesLabel": "重置记忆",
    "settings.memory.resetMemoriesDescription": "删除全部 Codex 记忆",
    "settings.memory.resetMemoriesButton": "重置",
    "settings.memory.resetDialogTitle": "重置全部记忆？",
    "settings.memory.resetDialogSubtitle": "这会删除全部 Codex 记忆。",
    "settings.memory.resetDialogCancel": "取消",
    "settings.memory.resetDialogConfirm": "重置",
    "settings.memory.resetSuccess": "记忆已重置",
    "settings.memory.resetError": "无法重置记忆",
    "composer.personalitySlashCommand.label.friendly": "友好",
    "composer.personalitySlashCommand.description.friendly": "温和、协作且乐于助人",
    "composer.personalitySlashCommand.label.pragmatic": "务实",
    "composer.personalitySlashCommand.description.pragmatic": "简洁、任务导向且直接",
    "auth.signOut": "退出登录",
    "auth.signInWithChatGpt": "通过 ChatGPT 登录",
    "auth.apiKey": "API 密钥",
    "auth.useApiKey": "使用 API 密钥",
    "auth.deviceCode": "设备码",
    "auth.useDeviceCode": "使用设备码",
    "auth.checking": "检查中",
    "auth.signingIn": "登录中",
    "auth.signedOut": "需要登录",
    "auth.ready": "就绪",
    "auth.chatGpt": "ChatGPT",
    "auth.openAiApiKey": "OpenAI API 密钥",
    "auth.loginRequired": "您当前未登录。",
    "auth.cancel": "取消",
    "auth.cancelSignIn": "取消登录",
    "auth.apiKeyPlaceholder": "sk-…",
    "auth.apiKeyConfirm": "确定",
    "auth.completeBrowserSignIn": "请在浏览器中完成登录。",
    "auth.openBrowser": "打开浏览器",
    "auth.copy": "复制",
    "electron.onboarding.login.snake.start": "玩贪吃蛇",
    "electron.onboarding.login.welcomeV2.title": "开始使用 Codex",
    "electron.onboarding.login.chatgpt.signIn": "使用 ChatGPT 登录",
    "electron.onboarding.login.chatgpt.cancel.welcomeV2": "取消登录",
    "electron.onboarding.login.apikey.open.welcomeV2": "使用其他方式登录",
    "electron.onboarding.login.apikey.label": "OpenAI API 密钥",
    "electron.onboarding.login.apikey.placeholder": "sk-…",
    "electron.onboarding.login.apikey.cancel": "取消",
    "electron.onboarding.login.apikey.continue": "继续",
    "electron.onboarding.login.browserPending.welcomeV2": "请继续在浏览器中登录。",
    "electron.onboarding.login.signup.welcomeV2": "注册",
    "electron.onboarding.login.includedPlans.welcomeV2": "所有 ChatGPT 套餐均包含",
    "avatarOverlay.statusRunning": "运行中",
    "avatarOverlay.statusRunningSubtitle": "思考中",
    "avatarOverlay.statusWaiting": "需要输入",
    "avatarOverlay.statusReview": "已就绪",
    "avatarOverlay.statusFailed": "已阻塞",
    "avatarOverlay.statusInfo": "信息",
    "avatarOverlay.session.calledTool": "调用了工具",
    "avatarOverlay.session.callingTool": "正在调用工具",
    "avatarOverlay.session.callingToolName": "正在调用 {toolName}",
    "avatarOverlay.session.editedFiles": "编辑了 {fileCount} 个文件",
    "avatarOverlay.session.editingFiles": "正在编辑 {fileCount} 个文件",
    "avatarOverlay.session.newThread": "新对话",
    "avatarOverlay.session.ranCommand": "已运行命令",
    "avatarOverlay.session.runningCommand": "正在运行命令",
    "avatarOverlay.openNotification": "打开通知",
    "avatarOverlay.dismissNotification": "关闭 {title}",
    "avatarOverlay.dismissNotificationTooltip": "关闭",
    "avatarOverlay.replyNotification": "回复 {title}",
    "avatarOverlay.replyNotificationButton": "回复",
    "avatarOverlay.sendNotificationReply": "向 {title} 发送回复",
    "avatarOverlay.notificationReplyPlaceholder": "回复",
    "avatarOverlay.notificationReplyError": "无法发送回复",
    "avatarOverlay.expandNotification": "展开 {title}",
    "avatarOverlay.collapseNotification": "折叠 {title}",
    "avatarOverlay.expandNotificationTooltip": "展开",
    "avatarOverlay.collapseNotificationTooltip": "折叠",
    "avatarOverlay.collapseNotificationTray": "折叠活动",
    "avatarOverlay.notificationList": "活动通知",
    "avatarOverlay.latestNotifications": "最新",
    "avatarOverlay.showLatestNotifications": "查看最新活动",
    "avatarOverlay.showOlderNotifications": "查看 {count} 条较早的活动",
    "avatarOverlay.olderNotificationCount": "还有 {count} 条",
    "avatarOverlay.compactOlderNotificationCount": "+{count}",
    "avatarOverlay.toggleNotificationTray": "打开活动栏，{count} 项",
    "petOverlay.mascotLabel": "{petName} 宠物",
    "petOverlay.closePet": "关闭宠物",
    "history.noMessageYet": "(暂无消息)",
    ...PULL_REQUESTS_PAGE_MESSAGES["zh-CN"],
    ...AUTOMATIONS_PAGE_MESSAGES["zh-CN"],
  },
};
