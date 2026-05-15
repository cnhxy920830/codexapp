import type { ReactNode, RefObject } from "react";
import {
  ClockIcon,
  MoreActionsIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversation } from "../../services/history";

type ThreadPageHeaderProps = {
  actionsMenuRef: RefObject<HTMLDivElement | null>;
  hasAttachedHeartbeatAutomation: boolean;
  heartbeatAutomationActionLabelKey: MessageKey;
  heartbeatAutomationButtonTooltip: string;
  startActions?: ReactNode;
  isThreadActionsMenuOpen: boolean;
  isThreadHeartbeatAutomationActionDisabled: boolean;
  isThreadHeartbeatAutomationActionVisible: boolean;
  isThreadPinned: boolean;
  isTurnInProgress: boolean;
  isOpenInNewWindowDisabled?: boolean;
  isOpenUnreadActionDisabled?: boolean;
  isWorktreeThread: boolean;
  onArchive: () => void;
  onCopyAppLink: () => void;
  onCopyConversationMarkdown: () => void;
  onCopySessionId: () => void;
  onCopyWorkingDirectory: () => void;
  onForkThread: () => void;
  onForkThreadIntoWorktree: () => void;
  onOpenInNewWindow: () => void;
  onOpenMarkUnread?: () => void;
  onOpenSideChat: () => void;
  onOpenAttachedHeartbeatAutomation: () => void;
  onOpenThreadHeartbeatAutomationAction: () => void;
  onOpenRenameDialog: () => void;
  onTogglePinThread: () => void;
  onToggleThreadActionsMenu: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  trailingActions?: ReactNode;
  threadConversation: ThreadConversation | null;
};

export function ThreadPageHeader({
  actionsMenuRef,
  hasAttachedHeartbeatAutomation,
  heartbeatAutomationActionLabelKey,
  heartbeatAutomationButtonTooltip,
  startActions,
  isThreadActionsMenuOpen,
  isThreadHeartbeatAutomationActionDisabled,
  isThreadHeartbeatAutomationActionVisible,
  isThreadPinned,
  isTurnInProgress,
  isOpenInNewWindowDisabled = false,
  isOpenUnreadActionDisabled = true,
  isWorktreeThread,
  onArchive,
  onCopyAppLink,
  onCopyConversationMarkdown,
  onCopySessionId,
  onCopyWorkingDirectory,
  onForkThread,
  onForkThreadIntoWorktree,
  onOpenInNewWindow,
  onOpenMarkUnread,
  onOpenSideChat,
  onOpenAttachedHeartbeatAutomation,
  onOpenThreadHeartbeatAutomationAction,
  onOpenRenameDialog,
  onTogglePinThread,
  onToggleThreadActionsMenu,
  t,
  trailingActions,
  threadConversation,
}: ThreadPageHeaderProps) {
  if (!threadConversation) {
    return null;
  }

  const title = threadConversation.title.trim().length > 0 ? threadConversation.title : t("app.nav.newChat");
  const hasWorkingDirectory = threadConversation.cwd.trim().length > 0;
  const canCopyWorkingDirectory = hasWorkingDirectory;
  const hasTrailingActions = trailingActions != null;

  return (
    <header className="border-b border-[var(--app-shell-border)] px-5 py-2.5">
      <div
        className={[
          "draggable w-full min-w-0 items-center gap-x-4",
          hasTrailingActions ? "grid grid-cols-[minmax(0,1fr)_auto]" : "flex",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-base electron:font-medium">
          <span className="app-title no-drag pointer-events-auto max-w-[320px] min-w-[2ch] truncate text-[15px] font-medium">
            {title}
          </span>
          {startActions}
          {hasAttachedHeartbeatAutomation ? (
            <button
              type="button"
              title={heartbeatAutomationButtonTooltip}
              aria-label={t("localConversation.header.openHeartbeatAutomation")}
              onClick={onOpenAttachedHeartbeatAutomation}
              className="app-topbar-button no-drag flex h-8 w-8 items-center justify-center rounded-[10px]"
            >
              <ClockIcon className="h-4 w-4" />
            </button>
          ) : null}

          <div className="relative no-drag" ref={actionsMenuRef}>
            <button
              type="button"
              title={t("threadHeader.moreActions")}
              aria-label={t("threadHeader.moreActions")}
              aria-expanded={isThreadActionsMenuOpen}
              onClick={onToggleThreadActionsMenu}
              className="app-topbar-button no-drag flex h-8 w-8 items-center justify-center rounded-[10px]"
            >
              <MoreActionsIcon className="h-4 w-4" />
            </button>

            {isThreadActionsMenuOpen ? (
              <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  onClick={onTogglePinThread}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
                >
                  {isThreadPinned ? t("sidebarElectron.unpinThread") : t("sidebarElectron.pinThread")}
                </button>
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
                <button
                  type="button"
                  disabled={isTurnInProgress}
                  onClick={onForkThreadIntoWorktree}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t("threadHeader.forkIntoWorktree")}
                </button>
                <button
                  type="button"
                  disabled={isTurnInProgress}
                  onClick={onOpenSideChat}
                  className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t("threadHeader.openSideChat")}
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
                <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                <button
                  type="button"
                  disabled={isOpenInNewWindowDisabled}
                  onClick={onOpenInNewWindow}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t("threadHeader.openInNewWindow")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {hasTrailingActions ? (
          <div className="no-drag flex items-center justify-end gap-1.5">
            {trailingActions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
