import type { RefObject } from "react";
import { ClockIcon, MoreActionsIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversation } from "../../services/history";

type ThreadPageHeaderProps = {
  actionsMenuRef: RefObject<HTMLDivElement | null>;
  hasAttachedHeartbeatAutomation: boolean;
  heartbeatAutomationActionLabelKey: MessageKey;
  heartbeatAutomationButtonTooltip: string;
  isThreadActionsMenuOpen: boolean;
  isThreadHeartbeatAutomationActionDisabled: boolean;
  isThreadHeartbeatAutomationActionVisible: boolean;
  isTurnInProgress: boolean;
  isWorktreeThread: boolean;
  onArchive: () => void;
  onCopyAppLink: () => void;
  onCopyConversationMarkdown: () => void;
  onCopySessionId: () => void;
  onCopyWorkingDirectory: () => void;
  onForkThread: () => void;
  onOpenAttachedHeartbeatAutomation: () => void;
  onOpenThreadHeartbeatAutomationAction: () => void;
  onOpenRenameDialog: () => void;
  onToggleThreadActionsMenu: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadConversation: ThreadConversation | null;
};

export function ThreadPageHeader({
  actionsMenuRef,
  hasAttachedHeartbeatAutomation,
  heartbeatAutomationActionLabelKey,
  heartbeatAutomationButtonTooltip,
  isThreadActionsMenuOpen,
  isThreadHeartbeatAutomationActionDisabled,
  isThreadHeartbeatAutomationActionVisible,
  isTurnInProgress,
  isWorktreeThread,
  onArchive,
  onCopyAppLink,
  onCopyConversationMarkdown,
  onCopySessionId,
  onCopyWorkingDirectory,
  onForkThread,
  onOpenAttachedHeartbeatAutomation,
  onOpenThreadHeartbeatAutomationAction,
  onOpenRenameDialog,
  onToggleThreadActionsMenu,
  t,
  threadConversation,
}: ThreadPageHeaderProps) {
  if (!threadConversation) {
    return null;
  }

  const title = threadConversation.title.trim().length > 0 ? threadConversation.title : t("app.nav.newChat");
  const canCopyWorkingDirectory = threadConversation.cwd.trim().length > 0;
  const environmentLabel = isWorktreeThread
    ? t("settings.automations.executionEnvironment.worktree")
    : t("settings.automations.executionEnvironment.local");

  return (
    <div className="border-b border-[var(--app-shell-border)] px-5 py-3">
      <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="app-title truncate text-[15px] font-medium leading-6">{title}</div>
            <div className="app-card-muted shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-5">
              {environmentLabel}
            </div>
          </div>
          {threadConversation.cwd ? (
            <div className="app-text-muted mt-1 truncate text-[12px] leading-5" title={threadConversation.cwd}>
              {threadConversation.cwd}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {hasAttachedHeartbeatAutomation ? (
            <button
              type="button"
              title={heartbeatAutomationButtonTooltip}
              aria-label={t("localConversation.header.openHeartbeatAutomation")}
              onClick={onOpenAttachedHeartbeatAutomation}
              className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
            >
              <ClockIcon className="h-4 w-4" />
            </button>
          ) : null}

          <div className="relative" ref={actionsMenuRef}>
            <button
              type="button"
              title={t("threadHeader.moreActions")}
              aria-label={t("threadHeader.moreActions")}
              aria-expanded={isThreadActionsMenuOpen}
              onClick={onToggleThreadActionsMenu}
              className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
            >
              <MoreActionsIcon className="h-4 w-4" />
            </button>

            {isThreadActionsMenuOpen ? (
              <div className="app-card absolute top-10 right-0 z-10 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  onClick={onOpenRenameDialog}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {t("sidebarElectron.renameThread")}
                </button>
                <button
                  type="button"
                  onClick={onArchive}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {t("sidebarElectron.archiveThread")}
                </button>
                <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                <button
                  type="button"
                  disabled={!canCopyWorkingDirectory}
                  onClick={onCopyWorkingDirectory}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t("threadHeader.copyWorkingDirectory")}
                </button>
                <button
                  type="button"
                  onClick={onCopySessionId}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {t("threadHeader.copySessionId")}
                </button>
                <button
                  type="button"
                  onClick={onCopyAppLink}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {t("threadHeader.copyAppLink")}
                </button>
                <button
                  type="button"
                  onClick={onCopyConversationMarkdown}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {t("threadHeader.copyConversationMarkdown")}
                </button>
                <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                <button
                  type="button"
                  disabled={isTurnInProgress}
                  onClick={onForkThread}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t(isWorktreeThread ? "threadHeader.forkIntoSameWorktree" : "threadHeader.forkIntoLocal")}
                </button>
                {isThreadHeartbeatAutomationActionVisible ? (
                  <button
                    type="button"
                    disabled={isThreadHeartbeatAutomationActionDisabled}
                    onClick={onOpenThreadHeartbeatAutomationAction}
                    className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                  >
                    {t(heartbeatAutomationActionLabelKey)}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
