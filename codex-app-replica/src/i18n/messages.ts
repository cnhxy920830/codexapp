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
  | "skills.page.heading"
  | "skills.page.subheading"
  | "skills.page.loading"
  | "skills.page.empty"
  | "skills.page.filteredEmpty"
  | "skills.page.filteredEmptyDescription"
  | "skills.page.search"
  | "skills.page.search.label"
  | "skills.page.refreshSkills"
  | "skills.page.refreshFailed"
  | "skills.section.installed"
  | "skills.card.enabledStatus"
  | "skills.card.disabledStatus"
  | "app.shell.appMenu"
  | "app.shell.back"
  | "app.shell.forward"
  | "app.shell.settings"
  | "app.shell.share"
  | "codex.alert.closeAriaLabel"
  | "codex.archiveInfo.electron"
  | "codex.archiveInfo.settingsLink"
  | "app.chat.noRecentThreads"
  | "app.chat.noMessages"
  | "app.chat.changedFiles"
  | "app.chat.undo"
  | "app.chat.viewDiff"
  | "app.chat.commit"
  | "app.chat.projects"
  | "app.chat.filesChanged"
  | "app.chat.composePlaceholder"
  | "app.chat.send"
  | "app.chat.stop"
  | "app.chat.queuedFollowUps"
  | "app.chat.removeQueuedFollowUp"
  | "app.chat.commandExecution"
  | "app.chat.fileChange"
  | "app.chat.output"
  | "app.chat.noOutput"
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
  | "app.chat.approval.requestedWriteRoot"
  | "app.chat.approval.changes"
  | "app.chat.approval.noChanges"
  | "app.chat.approval.accept"
  | "app.chat.approval.acceptForSession"
  | "app.chat.approval.decline"
  | "app.chat.approval.cancel"
  | "app.chat.approval.submitting"
  | "composer.reviewMode.title"
  | "composer.reviewMode.option.unstaged.simple"
  | "thread.sidePanel.browserTab"
  | "thread.sidePanel.diffTab"
  | "thread.sidePanel.empty.title"
  | "thread.sidePanel.openFile"
  | "thread.sidePanel.openBrowserTab"
  | "thread.sidePanel.openReviewTab"
  | "thread.sidePanel.openTab"
  | "thread.sidePanel.toggle"
  | "thread.fileCommandMenu.filesGroup"
  | "thread.fileCommandMenu.searchFiles"
  | "thread.fileTreePanel.noMatchingFiles"
  | "thread.fileTreePanel.searchingFiles"
  | "threadHeader.archiveConfirmCancel"
  | "threadHeader.archiveConfirmConfirm"
  | "threadHeader.archiveConfirmSubtitle"
  | "threadHeader.archiveConfirmTitle"
  | "threadHeader.copyAppLink"
  | "threadHeader.copyConversationMarkdown"
  | "threadHeader.copyConversationMarkdownError"
  | "threadHeader.copyConversationMarkdownSuccess"
  | "threadHeader.copySessionId"
  | "threadHeader.copyWorkingDirectory"
  | "threadHeader.copyWorkingDirectoryError"
  | "threadHeader.copyWorkingDirectorySuccess"
  | "threadHeader.forkIntoLocal"
  | "threadHeader.forkThreadError"
  | "threadHeader.moreActions"
  | "sidebarElectron.archiveThread"
  | "sidebarElectron.renameThread"
  | "sidebarElectron.renameThreadDialogAriaLabel"
  | "sidebarElectron.renameThreadDialogCancel"
  | "sidebarElectron.renameThreadDialogPlaceholder"
  | "sidebarElectron.renameThreadDialogSave"
  | "sidebarElectron.renameThreadDialogSubtitle"
  | "sidebarElectron.renameThreadDialogTitle"
  | "sidebarElectron.renameThreadError"
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
  | "settings.nav.data-controls"
  | "settings.nav.keyboard-shortcuts"
  | "settings.nav.git-settings"
  | "settings.nav.worktrees"
  | "settings.nav.personalization"
  | "settings.nav.mcp-settings"
  | "settings.nav.local-environments"
  | "settings.section.data-controls"
  | "settings.section.keyboard-shortcuts"
  | "settings.section.git-settings"
  | "settings.section.worktrees"
  | "settings.section.plugins-settings"
  | "settings.section.browser-use"
  | "settings.section.mcp-settings"
  | "settings.section.mcp-settings.subtitle"
  | "settings.browserUse.install.title"
  | "settings.browserUse.install.button"
  | "settings.browserUse.install.empty"
  | "settings.browserUse.permissions.title"
  | "settings.browserUse.approval.label"
  | "settings.browserUse.approval.description"
  | "settings.browserUse.approval.alwaysAsk.label"
  | "settings.browserUse.approval.alwaysAsk.description"
  | "settings.browserUse.approval.neverAsk.label"
  | "settings.browserUse.approval.neverAsk.description"
  | "settings.browserUse.approval.saveError"
  | "settings.browserUse.historyApproval.label"
  | "settings.browserUse.historyApproval.description"
  | "settings.browserUse.historyApproval.alwaysAsk.label"
  | "settings.browserUse.historyApproval.alwaysAsk.description"
  | "settings.browserUse.historyApproval.neverAsk.label"
  | "settings.browserUse.historyApproval.neverAsk.description"
  | "settings.browserUse.historyApproval.saveError"
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
  | "settings.localEnvironments.workspaceSelect.description"
  | "settings.localEnvironments.workspaceSelect.inherited"
  | "settings.localEnvironments.workspaceSelect.viewAction"
  | "settings.localEnvironments.workspace.title"
  | "settings.localEnvironments.breadcrumb.back"
  | "settings.localEnvironments.editor.title"
  | "settings.localEnvironments.editor.setup.description"
  | "settings.localEnvironments.environment.create"
  | "settings.localEnvironments.environment.empty"
  | "settings.localEnvironments.environment.name"
  | "settings.localEnvironments.environment.setup"
  | "settings.localEnvironments.environment.setup.platformSelector"
  | "settings.localEnvironments.environment.setup.envVars.button"
  | "settings.localEnvironments.environment.setup.envVars.title"
  | "settings.localEnvironments.environment.setup.envVars.sourcePath.description"
  | "settings.localEnvironments.environment.setup.envVars.worktreePath.description"
  | "settings.localEnvironments.environment.cleanup.title"
  | "settings.localEnvironments.environment.cleanup.description"
  | "settings.localEnvironments.environment.cleanup.platformSelector"
  | "settings.localEnvironments.environment.actions.description"
  | "settings.localEnvironments.environment.script.default"
  | "settings.localEnvironments.actions.title"
  | "settings.localEnvironments.actions.add"
  | "settings.localEnvironments.actions.empty"
  | "settings.localEnvironments.actions.item.name"
  | "settings.localEnvironments.actions.item.command"
  | "settings.localEnvironments.actions.item.button.delete"
  | "settings.localEnvironments.actions.item.platforms.help"
  | "settings.localEnvironments.actions.item.platforms.macos"
  | "settings.localEnvironments.actions.item.platforms.linux"
  | "settings.localEnvironments.actions.item.platforms.windows"
  | "settings.localEnvironments.actions.icon.tool"
  | "settings.localEnvironments.actions.icon.run"
  | "settings.localEnvironments.actions.icon.debug"
  | "settings.localEnvironments.actions.icon.test"
  | "settings.localEnvironments.preview.save"
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
  | "settings.keyboardShortcuts.subtitle.electron"
  | "settings.keyboardShortcuts.loading"
  | "settings.keyboardShortcuts.table.command"
  | "settings.keyboardShortcuts.table.keybinding"
  | "settings.keyboardShortcuts.table.actions"
  | "settings.keyboardShortcuts.unassigned"
  | "settings.keyboardShortcuts.capturePrompt"
  | "settings.keyboardShortcuts.captureCancel"
  | "settings.keyboardShortcuts.captureAriaLabel"
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
  | "settings.git.forcePush.label"
  | "settings.git.forcePush.description"
  | "settings.git.forcePush.ariaLabel"
  | "settings.git.createDraftPullRequest.label"
  | "settings.git.createDraftPullRequest.description"
  | "settings.git.createDraftPullRequest.ariaLabel"
  | "settings.git.pullRequestMergeMethod.label"
  | "settings.git.pullRequestMergeMethod.description"
  | "settings.git.pullRequestMergeMethod.ariaLabel"
  | "settings.git.pullRequestMergeMethod.merge"
  | "settings.git.pullRequestMergeMethod.squash"
  | "settings.git.showSidebarPrIcons.label"
  | "settings.git.showSidebarPrIcons.description"
  | "settings.git.showSidebarPrIcons.ariaLabel"
  | "settings.git.commitInstructions.label"
  | "settings.git.commitInstructions.description"
  | "settings.git.commitInstructions.save"
  | "settings.git.commitInstructions.placeholder"
  | "settings.git.commitInstructions.ariaLabel"
  | "settings.git.prInstructions.label"
  | "settings.git.prInstructions.description"
  | "settings.git.prInstructions.save"
  | "settings.git.prInstructions.placeholder"
  | "settings.git.prInstructions.ariaLabel"
  | "settings.worktrees.autoCleanup.label"
  | "settings.worktrees.autoCleanup.description"
  | "settings.worktrees.autoCleanup.ariaLabel"
  | "settings.worktrees.keepCount.label"
  | "settings.worktrees.keepCount.description"
  | "settings.worktrees.keepCount.description.disabled"
  | "settings.worktrees.keepCount.ariaLabel"
  | "settings.worktrees.autoCleanup.confirm.title"
  | "settings.worktrees.autoCleanup.confirm.body"
  | "settings.worktrees.autoCleanup.confirm.cancel"
  | "settings.worktrees.autoCleanup.confirm.confirm"
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
  | "settings.general.groupTitle"
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
  | "settings.title"
  | "settings.sectionApp"
  | "settings.sectionHost"
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
  | "settings.mcp.loading"
  | "settings.mcp.loadError.title"
  | "settings.mcp.loadError.retry"
  | "settings.mcp.empty"
  | "settings.mcp.addServer"
  | "settings.mcp.server.login"
  | "settings.mcp.server.settings"
  | "settings.mcp.server.enable"
  | "settings.mcp.readOnly"
  | "settings.mcp.oauth.error"
  | "settings.mcp.refreshing"
  | "settings.mcp.detail.titleExisting"
  | "settings.mcp.detail.titleNew"
  | "settings.mcp.detail.back"
  | "settings.mcp.detail.uninstall"
  | "settings.mcp.detail.name"
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
    "skills.page.heading": "Skills",
    "skills.page.subheading": "Give Codex superpowers. <a>Learn more</a>",
    "skills.page.loading": "Loading skills...",
    "skills.page.empty": "No skills found",
    "skills.page.filteredEmpty": "No skills match your filters",
    "skills.page.filteredEmptyDescription": "Try adjusting your search or scope filters",
    "skills.page.search": "Search skills",
    "skills.page.search.label": "Search skills",
    "skills.page.refreshSkills": "Refresh",
    "skills.page.refreshFailed": "Unable to load skills",
    "skills.section.installed": "Installed",
    "skills.card.enabledStatus": "Enabled",
    "skills.card.disabledStatus": "Disabled",
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
    "app.shell.appMenu": "App menu",
    "app.shell.back": "Back",
    "app.shell.forward": "Forward",
    "app.shell.settings": "Settings",
    "app.shell.share": "Share",
    "codex.alert.closeAriaLabel": "Close",
    "codex.archiveInfo.electron": "View archived chats in {settingsLink}",
    "codex.archiveInfo.settingsLink": "Settings",
    "app.chat.noRecentThreads": "No recent conversations",
    "app.chat.noMessages": "No messages",
    "app.chat.changedFiles": "{fileCount} files changed",
    "app.chat.undo": "Undo",
    "app.chat.viewDiff": "View diff",
    "app.chat.commit": "Commit",
    "app.chat.projects": "PROJECTS",
    "app.chat.filesChanged": "{fileCount} files changed",
    "app.chat.composePlaceholder": "Ask Codex anything. Type @ to use plugins or mention files",
    "app.chat.send": "Send",
    "app.chat.stop": "Stop",
    "app.chat.queuedFollowUps": "Queued follow-ups ({count})",
    "app.chat.removeQueuedFollowUp": "Remove",
    "app.chat.commandExecution": "Command",
    "app.chat.fileChange": "File change",
    "app.chat.output": "Output",
    "app.chat.noOutput": "No output yet",
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
    "app.chat.approval.requestedWriteRoot": "Requested write root",
    "app.chat.approval.changes": "Changes",
    "app.chat.approval.noChanges": "No file changes were attached to this request.",
    "app.chat.approval.accept": "Accept",
    "app.chat.approval.acceptForSession": "Accept for session",
    "app.chat.approval.decline": "Decline",
    "app.chat.approval.cancel": "Cancel",
    "app.chat.approval.submitting": "Submitting response...",
    "composer.reviewMode.title": "Code review",
    "composer.reviewMode.option.unstaged.simple": "Review uncommitted changes",
    "thread.sidePanel.browserTab": "Browser",
    "thread.sidePanel.diffTab": "Review",
    "thread.sidePanel.empty.title": "Nothing here yet",
    "thread.sidePanel.openFile": "Open file",
    "thread.sidePanel.openBrowserTab": "Browser",
    "thread.sidePanel.openReviewTab": "Review",
    "thread.sidePanel.openTab": "Open side panel tab",
    "thread.sidePanel.toggle": "Toggle side panel",
    "thread.fileCommandMenu.filesGroup": "Files",
    "thread.fileCommandMenu.searchFiles": "Search files",
    "thread.fileTreePanel.noMatchingFiles": "No matching files",
    "thread.fileTreePanel.searchingFiles": "Searching files...",
    "threadHeader.archiveConfirmCancel": "Cancel",
    "threadHeader.archiveConfirmConfirm": "Archive",
    "threadHeader.archiveConfirmSubtitle": "You can find it later in archived chats.",
    "threadHeader.archiveConfirmTitle": "Archive chat?",
    "threadHeader.copyAppLink": "Copy deeplink",
    "threadHeader.copyConversationMarkdown": "Copy as Markdown",
    "threadHeader.copyConversationMarkdownError": "Failed to copy conversation as Markdown",
    "threadHeader.copyConversationMarkdownSuccess": "Copied conversation as Markdown",
    "threadHeader.copySessionId": "Copy session ID",
    "threadHeader.copyWorkingDirectory": "Copy working directory",
    "threadHeader.copyWorkingDirectoryError": "Failed to copy working directory",
    "threadHeader.copyWorkingDirectorySuccess": "Copied working directory",
    "threadHeader.forkIntoLocal": "Fork into local",
    "threadHeader.forkThreadError": "Failed to fork chat",
    "threadHeader.moreActions": "Thread actions",
    "sidebarElectron.archiveThread": "Archive chat",
    "sidebarElectron.renameThread": "Rename chat",
    "sidebarElectron.renameThreadDialogAriaLabel": "Chat title",
    "sidebarElectron.renameThreadDialogCancel": "Cancel",
    "sidebarElectron.renameThreadDialogPlaceholder": "Add a title...",
    "sidebarElectron.renameThreadDialogSave": "Save",
    "sidebarElectron.renameThreadDialogSubtitle": "Keep it short and recognizable",
    "sidebarElectron.renameThreadDialogTitle": "Rename chat",
    "sidebarElectron.renameThreadError": "Failed to rename thread",
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
    "settings.nav.data-controls": "Archived chats",
    "settings.nav.keyboard-shortcuts": "Keyboard shortcuts",
    "settings.nav.git-settings": "Git",
    "settings.nav.worktrees": "Worktrees",
    "settings.nav.personalization": "Personalization",
    "settings.nav.mcp-settings": "MCP servers",
    "settings.nav.local-environments": "Local environments",
    "settings.section.data-controls": "Archived chats",
    "settings.section.keyboard-shortcuts": "Keyboard shortcuts",
    "settings.section.git-settings": "Git",
    "settings.section.worktrees": "Worktrees",
    "settings.section.plugins-settings": "Plugins",
    "settings.section.browser-use": "Browser use",
    "settings.section.mcp-settings": "MCP servers",
    "settings.section.mcp-settings.subtitle": "Connect external tools and data sources. <a>Learn more.</a>",
    "settings.browserUse.install.title": "Plugins",
    "settings.browserUse.install.button": "Install",
    "settings.browserUse.install.empty": "Browser plugin unavailable",
    "settings.browserUse.permissions.title": "Permissions",
    "settings.browserUse.approval.label": "Approval",
    "settings.browserUse.approval.description": "Choose if Codex asks for approval before opening websites",
    "settings.browserUse.approval.alwaysAsk.label": "Always ask",
    "settings.browserUse.approval.alwaysAsk.description": "Ask before opening websites",
    "settings.browserUse.approval.neverAsk.label": "Always allow",
    "settings.browserUse.approval.neverAsk.description": "Open websites without asking",
    "settings.browserUse.approval.saveError": "Unable to save approval setting",
    "settings.browserUse.historyApproval.label": "History",
    "settings.browserUse.historyApproval.description": "Choose if Codex asks for approval before accessing your history",
    "settings.browserUse.historyApproval.alwaysAsk.label": "Always ask",
    "settings.browserUse.historyApproval.alwaysAsk.description": "Ask before accessing history",
    "settings.browserUse.historyApproval.neverAsk.label": "Always allow",
    "settings.browserUse.historyApproval.neverAsk.description": "Access history without asking",
    "settings.browserUse.historyApproval.saveError": "Unable to save history setting",
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
    "settings.localEnvironments.workspaceSelect.description":
      "Local environments tell Codex how to set up worktrees for a project. <a>Learn more.</a>",
    "settings.localEnvironments.workspaceSelect.inherited": "{count} environments in parent folders",
    "settings.localEnvironments.workspaceSelect.viewAction": "View",
    "settings.localEnvironments.workspace.title": "Project",
    "settings.localEnvironments.breadcrumb.back": "Back",
    "settings.localEnvironments.editor.title": "Local environment",
    "settings.localEnvironments.editor.setup.description": "Runs at the project root on worktree creation",
    "settings.localEnvironments.environment.create": "Create local environment",
    "settings.localEnvironments.environment.empty": "No local environment is configured for this project yet.",
    "settings.localEnvironments.environment.name": "Name",
    "settings.localEnvironments.environment.setup": "Setup script",
    "settings.localEnvironments.environment.setup.platformSelector": "Setup script platform",
    "settings.localEnvironments.environment.setup.envVars.button": "Variables",
    "settings.localEnvironments.environment.setup.envVars.title": "Setup script environment variables",
    "settings.localEnvironments.environment.setup.envVars.sourcePath.description": "Source workspace path",
    "settings.localEnvironments.environment.setup.envVars.worktreePath.description": "New worktree path",
    "settings.localEnvironments.environment.cleanup.title": "Cleanup script",
    "settings.localEnvironments.environment.cleanup.description":
      "Runs at the project root before worktree cleanup",
    "settings.localEnvironments.environment.cleanup.platformSelector": "Cleanup script platform",
    "settings.localEnvironments.environment.actions.description":
      "These actions can run any command and will be displayed in the header.",
    "settings.localEnvironments.environment.script.default": "Default",
    "settings.localEnvironments.actions.title": "Actions",
    "settings.localEnvironments.actions.add": "Add action",
    "settings.localEnvironments.actions.empty": "Add an action to run commands from the local toolbar.",
    "settings.localEnvironments.actions.item.name": "Name",
    "settings.localEnvironments.actions.item.command": "Action script",
    "settings.localEnvironments.actions.item.button.delete": "Delete",
    "settings.localEnvironments.actions.item.platforms.help": "Run only on a specific operating system.",
    "settings.localEnvironments.actions.item.platforms.macos": "macOS",
    "settings.localEnvironments.actions.item.platforms.linux": "Linux",
    "settings.localEnvironments.actions.item.platforms.windows": "Windows",
    "settings.localEnvironments.actions.icon.tool": "Tool",
    "settings.localEnvironments.actions.icon.run": "Run",
    "settings.localEnvironments.actions.icon.debug": "Debug",
    "settings.localEnvironments.actions.icon.test": "Test",
    "settings.localEnvironments.preview.save": "Save",
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
    "settings.keyboardShortcuts.subtitle.electron": "Customize app shortcuts",
    "settings.keyboardShortcuts.loading": "Loading shortcuts…",
    "settings.keyboardShortcuts.table.command": "Command",
    "settings.keyboardShortcuts.table.keybinding": "Keybinding",
    "settings.keyboardShortcuts.table.actions": "Actions",
    "settings.keyboardShortcuts.unassigned": "Unassigned",
    "settings.keyboardShortcuts.capturePrompt": "Press shortcut",
    "settings.keyboardShortcuts.captureCancel": "Cancel",
    "settings.keyboardShortcuts.captureAriaLabel": "Shortcut capture for {commandTitle}",
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
    "settings.git.forcePush.label": "Always force push",
    "settings.git.forcePush.description": "Use --force-with-lease when pushing from Codex",
    "settings.git.forcePush.ariaLabel": "Always force push",
    "settings.git.createDraftPullRequest.label": "Create draft pull requests",
    "settings.git.createDraftPullRequest.description": "Use draft pull requests by default when creating PRs from Codex",
    "settings.git.createDraftPullRequest.ariaLabel": "Create draft pull requests",
    "settings.git.pullRequestMergeMethod.label": "Pull request merge method",
    "settings.git.pullRequestMergeMethod.description": "Choose how Codex merges pull requests",
    "settings.git.pullRequestMergeMethod.ariaLabel": "Pull request merge method",
    "settings.git.pullRequestMergeMethod.merge": "Merge",
    "settings.git.pullRequestMergeMethod.squash": "Squash",
    "settings.git.showSidebarPrIcons.label": "Show PR icons in sidebar",
    "settings.git.showSidebarPrIcons.description": "Display PR status icons on chat rows in the sidebar",
    "settings.git.showSidebarPrIcons.ariaLabel": "Show PR icons in sidebar",
    "settings.git.commitInstructions.label": "Commit instructions",
    "settings.git.commitInstructions.description": "Added to commit message generation prompts",
    "settings.git.commitInstructions.save": "Save",
    "settings.git.commitInstructions.placeholder": "Add commit message guidance…",
    "settings.git.commitInstructions.ariaLabel": "Commit instructions",
    "settings.git.prInstructions.label": "Pull request instructions",
    "settings.git.prInstructions.description": "Added to PR title/description generation prompts",
    "settings.git.prInstructions.save": "Save",
    "settings.git.prInstructions.placeholder": "Add pull request guidance…",
    "settings.git.prInstructions.ariaLabel": "Pull request instructions",
    "settings.worktrees.autoCleanup.label": "Automatically delete old worktrees",
    "settings.worktrees.autoCleanup.description":
      "Recommended for most users. Turn this off only if you want to manage old worktrees and disk usage yourself.",
    "settings.worktrees.autoCleanup.ariaLabel": "Automatically delete old worktrees",
    "settings.worktrees.keepCount.label": "Auto-delete limit",
    "settings.worktrees.keepCount.description":
      "Number of Codex worktrees to keep before older ones are pruned automatically. Codex snapshots worktrees before deleting, so pruned worktrees should always be restorable.",
    "settings.worktrees.keepCount.description.disabled":
      "Automatic deletion is disabled. Codex will not prune old worktrees automatically. Re-enable it to use this saved limit again.",
    "settings.worktrees.keepCount.ariaLabel": "Auto-delete limit",
    "settings.worktrees.autoCleanup.confirm.title": "Disable automatic worktree deletion?",
    "settings.worktrees.autoCleanup.confirm.body":
      "We highly recommend keeping automatic deletion on so old worktrees do not build up and use unnecessary disk space. If you prefer to manage old worktrees yourself, you can turn this off and Codex will stop deleting them automatically.",
    "settings.worktrees.autoCleanup.confirm.cancel": "Keep automatic deletion",
    "settings.worktrees.autoCleanup.confirm.confirm": "Disable automatic deletion",
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
    "settings.general.groupTitle": "General",
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
    "settings.title": "SETTINGS",
    "settings.sectionApp": "APP",
    "settings.sectionHost": "HOST",
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
    "settings.mcp.loading": "Loading MCP servers…",
    "settings.mcp.loadError.title": "Unable to load MCP servers",
    "settings.mcp.loadError.retry": "Retry",
    "settings.mcp.empty": "No MCP servers connected",
    "settings.mcp.addServer": "Add server",
    "settings.mcp.server.login": "Authenticate",
    "settings.mcp.server.settings": "Settings",
    "settings.mcp.server.enable": "Enable",
    "settings.mcp.readOnly": "This server is managed by project config.",
    "settings.mcp.oauth.error": "Failed to authenticate MCP server",
    "settings.mcp.refreshing": "Refreshing MCP servers…",
    "settings.mcp.detail.titleExisting": "Update {name} MCP",
    "settings.mcp.detail.titleNew": "Connect to a custom MCP",
    "settings.mcp.detail.back": "Back",
    "settings.mcp.detail.uninstall": "Uninstall",
    "settings.mcp.detail.name": "Name",
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
    "history.noMessageYet": "(no message yet)",
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
    "skills.page.heading": "技能",
    "skills.page.subheading": "赋予 Codex 更强大的能力。<a>了解更多</a>",
    "skills.page.loading": "正在加载技能…",
    "skills.page.empty": "找不到技能",
    "skills.page.filteredEmpty": "没有符合筛选条件的技能",
    "skills.page.filteredEmptyDescription": "尝试调整你的搜索内容或范围筛选条件",
    "skills.page.search": "搜索技能",
    "skills.page.search.label": "搜索技能",
    "skills.page.refreshSkills": "刷新",
    "skills.page.refreshFailed": "无法加载技能",
    "skills.section.installed": "已安装",
    "skills.card.enabledStatus": "已启用",
    "skills.card.disabledStatus": "已禁用",
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
    "app.shell.appMenu": "应用菜单",
    "app.shell.back": "返回",
    "app.shell.forward": "前进",
    "app.shell.settings": "设置",
    "app.shell.share": "共享",
    "codex.alert.closeAriaLabel": "关闭",
    "codex.archiveInfo.electron": "查看已归档的聊天：{settingsLink}",
    "codex.archiveInfo.settingsLink": "设置",
    "app.chat.noRecentThreads": "暂无最近会话",
    "app.chat.noMessages": "暂无消息",
    "app.chat.changedFiles": "{fileCount} 个文件已更改",
    "app.chat.undo": "撤销",
    "app.chat.viewDiff": "查看差异",
    "app.chat.commit": "提交",
    "app.chat.projects": "项目",
    "app.chat.filesChanged": "{fileCount} 个文件已更改",
    "app.chat.composePlaceholder": "可向 Codex 询问任何事。输入 @ 使用插件或提及文件",
    "app.chat.send": "发送",
    "app.chat.stop": "停止",
    "app.chat.queuedFollowUps": "排队中的跟进（{count}）",
    "app.chat.removeQueuedFollowUp": "移除",
    "app.chat.commandExecution": "命令",
    "app.chat.fileChange": "文件修改",
    "app.chat.output": "输出",
    "app.chat.noOutput": "尚无输出",
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
    "app.chat.approval.requestedWriteRoot": "请求的写入根目录",
    "app.chat.approval.changes": "变更",
    "app.chat.approval.noChanges": "该请求未附带文件变更内容。",
    "app.chat.approval.accept": "接受",
    "app.chat.approval.acceptForSession": "本次会话接受",
    "app.chat.approval.decline": "拒绝",
    "app.chat.approval.cancel": "取消",
    "app.chat.approval.submitting": "正在提交响应...",
    "composer.reviewMode.title": "代码审查",
    "composer.reviewMode.option.unstaged.simple": "审查未提交的更改",
    "thread.sidePanel.browserTab": "浏览器",
    "thread.sidePanel.diffTab": "审查",
    "thread.sidePanel.empty.title": "这里还没有内容",
    "thread.sidePanel.openFile": "打开文件",
    "thread.sidePanel.openBrowserTab": "浏览器",
    "thread.sidePanel.openReviewTab": "审查",
    "thread.sidePanel.openTab": "打开侧边面板标签页",
    "thread.sidePanel.toggle": "显示/隐藏侧边栏",
    "thread.fileCommandMenu.filesGroup": "文件",
    "thread.fileCommandMenu.searchFiles": "搜索文件",
    "thread.fileTreePanel.noMatchingFiles": "没有匹配的文件",
    "thread.fileTreePanel.searchingFiles": "正在搜索文件…",
    "threadHeader.archiveConfirmCancel": "取消",
    "threadHeader.archiveConfirmConfirm": "归档",
    "threadHeader.archiveConfirmSubtitle": "稍后可在已归档对话中找到。",
    "threadHeader.archiveConfirmTitle": "归档对话？",
    "threadHeader.copyAppLink": "复制深度链接",
    "threadHeader.copyConversationMarkdown": "复制为 Markdown",
    "threadHeader.copyConversationMarkdownError": "将对话复制为 Markdown 失败",
    "threadHeader.copyConversationMarkdownSuccess": "已将对话复制为 Markdown",
    "threadHeader.copySessionId": "复制会话 ID",
    "threadHeader.copyWorkingDirectory": "复制工作目录",
    "threadHeader.copyWorkingDirectoryError": "复制工作目录失败",
    "threadHeader.copyWorkingDirectorySuccess": "已复制工作目录",
    "threadHeader.forkIntoLocal": "派生到本地",
    "threadHeader.forkThreadError": "创建对话分支失败",
    "threadHeader.moreActions": "对话操作",
    "sidebarElectron.archiveThread": "归档对话",
    "sidebarElectron.renameThread": "重命名对话",
    "sidebarElectron.renameThreadDialogAriaLabel": "对话标题",
    "sidebarElectron.renameThreadDialogCancel": "取消",
    "sidebarElectron.renameThreadDialogPlaceholder": "添加标题...",
    "sidebarElectron.renameThreadDialogSave": "保存",
    "sidebarElectron.renameThreadDialogSubtitle": "保持简短且易于区分",
    "sidebarElectron.renameThreadDialogTitle": "重命名对话",
    "sidebarElectron.renameThreadError": "重命名对话失败",
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
    "settings.nav.data-controls": "已归档对话",
    "settings.nav.keyboard-shortcuts": "键盘快捷方式",
    "settings.nav.git-settings": "Git",
    "settings.nav.worktrees": "工作树",
    "settings.nav.personalization": "个性化",
    "settings.nav.mcp-settings": "MCP 服务器",
    "settings.nav.local-environments": "本地环境",
    "settings.section.data-controls": "已归档对话",
    "settings.section.keyboard-shortcuts": "键盘快捷键",
    "settings.section.git-settings": "Git",
    "settings.section.worktrees": "工作树",
    "settings.section.plugins-settings": "插件",
    "settings.section.browser-use": "浏览器使用",
    "settings.section.mcp-settings": "MCP 服务器",
    "settings.section.mcp-settings.subtitle": "连接外部工具和数据源。<a>了解更多。</a>",
    "settings.browserUse.install.title": "插件",
    "settings.browserUse.install.button": "安装",
    "settings.browserUse.install.empty": "浏览器插件不可用",
    "settings.browserUse.permissions.title": "权限",
    "settings.browserUse.approval.label": "审批",
    "settings.browserUse.approval.description": "选择 Codex 在打开网站前是否请求批准",
    "settings.browserUse.approval.alwaysAsk.label": "始终询问",
    "settings.browserUse.approval.alwaysAsk.description": "打开网站前先询问",
    "settings.browserUse.approval.neverAsk.label": "始终允许",
    "settings.browserUse.approval.neverAsk.description": "无需询问即可打开网站",
    "settings.browserUse.approval.saveError": "无法保存审批设置",
    "settings.browserUse.historyApproval.label": "历史记录",
    "settings.browserUse.historyApproval.description": "选择 Codex 在访问你的历史记录前是否需要批准",
    "settings.browserUse.historyApproval.alwaysAsk.label": "始终询问",
    "settings.browserUse.historyApproval.alwaysAsk.description": "访问历史记录前先询问",
    "settings.browserUse.historyApproval.neverAsk.label": "始终允许",
    "settings.browserUse.historyApproval.neverAsk.description": "无需询问即可访问历史记录",
    "settings.browserUse.historyApproval.saveError": "无法保存历史记录设置",
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
    "settings.computerUse.install.empty": "计算机使用插件不可用",
    "settings.localEnvironments.workspaceSelect.description":
      "本地环境用于指示 Codex 如何为项目设置工作树。<a>了解更多。</a>",
    "settings.localEnvironments.workspaceSelect.inherited": "父文件夹中的 {count} 个环境",
    "settings.localEnvironments.workspaceSelect.viewAction": "查看",
    "settings.localEnvironments.workspace.title": "项目",
    "settings.localEnvironments.breadcrumb.back": "返回",
    "settings.localEnvironments.editor.title": "本地环境",
    "settings.localEnvironments.editor.setup.description": "创建工作树时在项目根目录下运行",
    "settings.localEnvironments.environment.create": "创建本地环境",
    "settings.localEnvironments.environment.empty": "尚未针对此项目配置任何本地环境。",
    "settings.localEnvironments.environment.name": "名称",
    "settings.localEnvironments.environment.setup": "设置脚本",
    "settings.localEnvironments.environment.setup.platformSelector": "设置脚本平台",
    "settings.localEnvironments.environment.setup.envVars.button": "变量",
    "settings.localEnvironments.environment.setup.envVars.title": "设置脚本环境变量",
    "settings.localEnvironments.environment.setup.envVars.sourcePath.description": "源工作空间路径",
    "settings.localEnvironments.environment.setup.envVars.worktreePath.description": "新工作树路径",
    "settings.localEnvironments.environment.cleanup.title": "清理脚本",
    "settings.localEnvironments.environment.cleanup.description": "清理工作树之前在项目根目录下运行",
    "settings.localEnvironments.environment.cleanup.platformSelector": "清理脚本平台",
    "settings.localEnvironments.environment.actions.description":
      "这些操作可以运行任意命令并将显示在标头中。",
    "settings.localEnvironments.environment.script.default": "默认",
    "settings.localEnvironments.actions.title": "操作",
    "settings.localEnvironments.actions.add": "添加操作",
    "settings.localEnvironments.actions.empty": "添加操作，以便从本地工具栏运行命令。",
    "settings.localEnvironments.actions.item.name": "名称",
    "settings.localEnvironments.actions.item.command": "操作脚本",
    "settings.localEnvironments.actions.item.button.delete": "删除",
    "settings.localEnvironments.actions.item.platforms.help": "仅在特定操作系统上运行。",
    "settings.localEnvironments.actions.item.platforms.macos": "macOS",
    "settings.localEnvironments.actions.item.platforms.linux": "Linux",
    "settings.localEnvironments.actions.item.platforms.windows": "Windows",
    "settings.localEnvironments.actions.icon.tool": "工具",
    "settings.localEnvironments.actions.icon.run": "运行",
    "settings.localEnvironments.actions.icon.debug": "调试",
    "settings.localEnvironments.actions.icon.test": "测试",
    "settings.localEnvironments.preview.save": "保存",
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
    "settings.keyboardShortcuts.subtitle.electron": "自定义应用快捷键",
    "settings.keyboardShortcuts.loading": "正在加载快捷键…",
    "settings.keyboardShortcuts.table.command": "命令",
    "settings.keyboardShortcuts.table.keybinding": "按键绑定",
    "settings.keyboardShortcuts.table.actions": "操作",
    "settings.keyboardShortcuts.unassigned": "未分配",
    "settings.keyboardShortcuts.capturePrompt": "按下快捷键",
    "settings.keyboardShortcuts.captureCancel": "取消",
    "settings.keyboardShortcuts.captureAriaLabel": "为 {commandTitle} 录入快捷键",
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
    "settings.git.forcePush.label": "始终强制推送",
    "settings.git.forcePush.description": "从 Codex 推送时使用 --force-with-lease 参数",
    "settings.git.forcePush.ariaLabel": "始终强制推送",
    "settings.git.createDraftPullRequest.label": "创建草稿拉取请求",
    "settings.git.createDraftPullRequest.description": "从 Codex 创建 PR 时默认使用草稿拉取请求",
    "settings.git.createDraftPullRequest.ariaLabel": "创建草稿拉取请求",
    "settings.git.pullRequestMergeMethod.label": "拉取请求合并方法",
    "settings.git.pullRequestMergeMethod.description": "选择 Codex 合并拉取请求的方法",
    "settings.git.pullRequestMergeMethod.ariaLabel": "拉取请求合并方法",
    "settings.git.pullRequestMergeMethod.merge": "合并",
    "settings.git.pullRequestMergeMethod.squash": "压缩",
    "settings.git.showSidebarPrIcons.label": "在侧边栏显示 PR 图标",
    "settings.git.showSidebarPrIcons.description": "在侧边栏的对话行中显示 PR 状态图标",
    "settings.git.showSidebarPrIcons.ariaLabel": "在侧边栏显示 PR 图标",
    "settings.git.commitInstructions.label": "提交指令",
    "settings.git.commitInstructions.description": "已添加到提交信息生成提示中",
    "settings.git.commitInstructions.save": "保存",
    "settings.git.commitInstructions.placeholder": "添加提交消息指引…",
    "settings.git.commitInstructions.ariaLabel": "提交指令",
    "settings.git.prInstructions.label": "拉取请求指令",
    "settings.git.prInstructions.description": "已添加到 PR 标题/描述生成提示中",
    "settings.git.prInstructions.save": "保存",
    "settings.git.prInstructions.placeholder": "添加拉取请求指引…",
    "settings.git.prInstructions.ariaLabel": "拉取请求指令",
    "settings.worktrees.autoCleanup.label": "自动删除旧工作树",
    "settings.worktrees.autoCleanup.description": "推荐大多数用户启用。仅当你需要手动管理旧工作树和磁盘使用空间时，再关闭此功能。",
    "settings.worktrees.autoCleanup.ariaLabel": "自动删除旧工作树",
    "settings.worktrees.keepCount.label": "自动删除限制",
    "settings.worktrees.keepCount.description": "自动清理较旧工作树前保留的 Codex 工作树数量。Codex 会在删除前为工作树创建快照，因此被清理的工作树应始终可恢复。",
    "settings.worktrees.keepCount.description.disabled": "自动删除功能已禁用。Codex 不会自动清理旧工作树。重新启用该功能即可再次使用已保存的限制。",
    "settings.worktrees.keepCount.ariaLabel": "自动删除限制",
    "settings.worktrees.autoCleanup.confirm.title": "禁用工作树自动删除功能？",
    "settings.worktrees.autoCleanup.confirm.body": "我们强烈建议启用自动删除功能，以免旧工作树堆积，占用不必要的磁盘空间。若你希望自行管理旧工作树，可关闭此功能，Codex 将停止自动删除操作。",
    "settings.worktrees.autoCleanup.confirm.cancel": "启用自动删除功能",
    "settings.worktrees.autoCleanup.confirm.confirm": "禁用自动删除功能",
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
    "settings.general.groupTitle": "常规",
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
    "settings.title": "设置",
    "settings.sectionApp": "应用",
    "settings.sectionHost": "主机",
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
    "settings.mcp.loading": "正在加载 MCP 服务器…",
    "settings.mcp.loadError.title": "无法加载 MCP 服务器",
    "settings.mcp.loadError.retry": "重试",
    "settings.mcp.empty": "未连接任何 MCP 服务器",
    "settings.mcp.addServer": "添加服务器",
    "settings.mcp.server.login": "验证",
    "settings.mcp.server.settings": "设置",
    "settings.mcp.server.enable": "启用",
    "settings.mcp.readOnly": "此服务器由项目配置管理。",
    "settings.mcp.oauth.error": "无法验证 MCP 服务器",
    "settings.mcp.refreshing": "正在刷新 MCP 服务器…",
    "settings.mcp.detail.titleExisting": "更新 {name} MCP",
    "settings.mcp.detail.titleNew": "连接自定义 MCP",
    "settings.mcp.detail.back": "返回",
    "settings.mcp.detail.uninstall": "卸载",
    "settings.mcp.detail.name": "名称",
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
    "history.noMessageYet": "(暂无消息)",
  },
};
