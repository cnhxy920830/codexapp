import { Children, type ReactNode, type RefObject } from "react";
import {
  ArchiveIcon,
  CloudTaskIcon,
  ClockIcon,
  CopyPathIcon,
  FolderIcon,
  MacbookIcon,
  MoreActionsIcon,
  OpenInNewWindowIcon,
  OpenSideChatIcon,
  PencilIcon,
  PinIcon,
  UnpinIcon,
  WorktreeIcon,
  ForkedConversationIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";

type ThreadHeaderEnvironment = "cloud" | "local" | "worktree" | null;

type ThreadPageHeaderProps = {
  environmentType: ThreadHeaderEnvironment;
  secondaryText?: string | null;
  titleSuffix?: ReactNode;
  variant?: "default" | "localConversation";
  start?: ReactNode;
  startActions?: ReactNode;
  trailing?: ReactNode;
  trailingActions?: ReactNode;
};

type ThreadHeaderActionMenuProps = {
  actionsMenuRef: RefObject<HTMLDivElement | null>;
  canPinThread?: boolean;
  canCopyWorkingDirectory: boolean;
  hasAttachedHeartbeatAutomation: boolean;
  heartbeatAutomationActionLabelKey: MessageKey;
  heartbeatAutomationButtonTooltip: string;
  isOpenInNewWindowDisabled?: boolean;
  isThreadActionsMenuOpen: boolean;
  isThreadHeartbeatAutomationActionDisabled: boolean;
  isThreadHeartbeatAutomationActionVisible: boolean;
  isThreadPinned: boolean;
  isTurnInProgress: boolean;
  isWorktreeThread: boolean;
  variant?: "default" | "localConversation";
  onArchive: () => void;
  onCopyAppLink: () => void;
  onCopyConversationMarkdown: () => void;
  onCopySessionId: () => void;
  onCopyWorkingDirectory: () => void;
  onForkThread: () => void;
  onForkThreadIntoWorktree: () => void;
  onOpenAttachedHeartbeatAutomation: () => void;
  onOpenInNewWindow: () => void;
  onOpenSideChat?: () => void;
  onOpenThreadHeartbeatAutomationAction: () => void;
  onOpenRenameDialog: () => void;
  onTogglePinThread: () => void;
  onToggleThreadActionsMenu: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type ThreadHeaderHeartbeatButtonProps = {
  hasAttachedHeartbeatAutomation: boolean;
  heartbeatAutomationButtonTooltip: string;
  onOpenAttachedHeartbeatAutomation: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  variant?: "default" | "localConversation";
};

type ThreadHeaderOverflowMenuProps = Omit<
  ThreadHeaderActionMenuProps,
  "hasAttachedHeartbeatAutomation" | "heartbeatAutomationButtonTooltip" | "onOpenAttachedHeartbeatAutomation"
>;

export function ThreadPageHeader({
  environmentType,
  secondaryText = null,
  titleSuffix,
  variant = "default",
  start,
  startActions,
  trailing,
  trailingActions,
}: ThreadPageHeaderProps) {
  const renderedSecondaryText =
    secondaryText !== null && secondaryText.trim().length > 0 ? secondaryText.trim() : null;
  const headerTrailingActions = normalizeThreadHeaderActions(trailingActions);
  const shouldShowTrailingDivider = trailing !== null && headerTrailingActions.length > 0;

  if (variant === "localConversation") {
    return (
      <header className="border-b border-[var(--app-shell-border)] px-4">
        <div className="draggable grid min-h-[var(--app-shell-toolbar)] w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center py-1.5">
          <div className="flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
            {start || titleSuffix ? (
              <div className="no-drag pointer-events-auto max-w-[320px] min-w-[2ch] truncate text-[15px] font-medium text-[var(--app-shell-text)]">
                <div className="flex min-w-0 items-center truncate">
                  {start ? <span className="w-fit truncate">{start}</span> : null}
                  {titleSuffix ? <span className="ml-1 min-w-0 truncate">{titleSuffix}</span> : null}
                </div>
              </div>
            ) : null}
            {trailing ? <div className="no-drag shrink-0">{trailing}</div> : null}
            {headerTrailingActions.length > 0 ? (
              <div className="no-drag flex shrink-0 items-center gap-2">{headerTrailingActions}</div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-[var(--app-shell-border)] px-4">
      <div className="draggable grid min-h-[var(--app-shell-toolbar)] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2">
        <div className="flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
          {start ? (
            <div className="app-title no-drag pointer-events-auto max-w-[320px] min-w-0 truncate text-[15px] font-medium">
              {start}
            </div>
          ) : null}
          {environmentType === "cloud" ? (
            <CloudTaskIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
          ) : environmentType !== null ? (
            <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
          ) : null}
          {renderedSecondaryText ? (
            <div className="flex min-w-0 truncate text-[12px] leading-[18px] font-normal text-[var(--app-shell-subtle)]">
              {renderedSecondaryText}
            </div>
          ) : null}
          {startActions}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {trailing}
          {headerTrailingActions.length > 0 ? (
            <div className="flex items-center gap-0.5">
              {shouldShowTrailingDivider ? (
                <div className="mx-2 h-[16px] w-px bg-[var(--app-shell-border)]" />
              ) : null}
              {headerTrailingActions}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function ThreadHeaderActionMenu({
  actionsMenuRef,
  canPinThread = true,
  canCopyWorkingDirectory,
  hasAttachedHeartbeatAutomation,
  heartbeatAutomationActionLabelKey,
  heartbeatAutomationButtonTooltip,
  isOpenInNewWindowDisabled = false,
  isThreadActionsMenuOpen,
  isThreadHeartbeatAutomationActionDisabled,
  isThreadHeartbeatAutomationActionVisible,
  isThreadPinned,
  isTurnInProgress,
  isWorktreeThread,
  variant = "default",
  onArchive,
  onCopyAppLink,
  onCopyConversationMarkdown,
  onCopySessionId,
  onCopyWorkingDirectory,
  onForkThread,
  onForkThreadIntoWorktree,
  onOpenAttachedHeartbeatAutomation,
  onOpenInNewWindow,
  onOpenSideChat,
  onOpenThreadHeartbeatAutomationAction,
  onOpenRenameDialog,
  onTogglePinThread,
  onToggleThreadActionsMenu,
  t,
}: ThreadHeaderActionMenuProps) {
  return (
    <>
      <ThreadHeaderHeartbeatButton
        hasAttachedHeartbeatAutomation={hasAttachedHeartbeatAutomation}
        heartbeatAutomationButtonTooltip={heartbeatAutomationButtonTooltip}
        onOpenAttachedHeartbeatAutomation={onOpenAttachedHeartbeatAutomation}
        t={t}
        variant={variant}
      />
      <ThreadHeaderOverflowMenu
        actionsMenuRef={actionsMenuRef}
        canPinThread={canPinThread}
        canCopyWorkingDirectory={canCopyWorkingDirectory}
        heartbeatAutomationActionLabelKey={heartbeatAutomationActionLabelKey}
        isOpenInNewWindowDisabled={isOpenInNewWindowDisabled}
        isThreadActionsMenuOpen={isThreadActionsMenuOpen}
        isThreadHeartbeatAutomationActionDisabled={isThreadHeartbeatAutomationActionDisabled}
        isThreadHeartbeatAutomationActionVisible={isThreadHeartbeatAutomationActionVisible}
        isThreadPinned={isThreadPinned}
        isTurnInProgress={isTurnInProgress}
        isWorktreeThread={isWorktreeThread}
        variant={variant}
        onArchive={onArchive}
        onCopyAppLink={onCopyAppLink}
        onCopyConversationMarkdown={onCopyConversationMarkdown}
        onCopySessionId={onCopySessionId}
        onCopyWorkingDirectory={onCopyWorkingDirectory}
        onForkThread={onForkThread}
        onForkThreadIntoWorktree={onForkThreadIntoWorktree}
        onOpenInNewWindow={onOpenInNewWindow}
        onOpenSideChat={onOpenSideChat}
        onOpenThreadHeartbeatAutomationAction={onOpenThreadHeartbeatAutomationAction}
        onOpenRenameDialog={onOpenRenameDialog}
        onTogglePinThread={onTogglePinThread}
        onToggleThreadActionsMenu={onToggleThreadActionsMenu}
        t={t}
      />
    </>
  );
}

export function ThreadHeaderHeartbeatButton({
  hasAttachedHeartbeatAutomation,
  heartbeatAutomationButtonTooltip,
  onOpenAttachedHeartbeatAutomation,
  t,
  variant = "default",
}: ThreadHeaderHeartbeatButtonProps) {
  const isLocalConversation = variant === "localConversation";
  const heartbeatButtonClassName = isLocalConversation
    ? "app-topbar-button no-drag flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[var(--app-shell-subtle)] hover:text-[var(--app-shell-text)]"
    : "app-topbar-button no-drag flex h-8 w-8 items-center justify-center rounded-[10px]";

  if (!hasAttachedHeartbeatAutomation) {
    return null;
  }

  return (
    <ThreadHeaderTooltip content={heartbeatAutomationButtonTooltip}>
      <button
        type="button"
        aria-label={t("localConversation.header.openHeartbeatAutomation")}
        onClick={onOpenAttachedHeartbeatAutomation}
        className={heartbeatButtonClassName}
      >
        <ClockIcon className="h-4 w-4" />
      </button>
    </ThreadHeaderTooltip>
  );
}

export function ThreadHeaderOverflowMenu({
  actionsMenuRef,
  canPinThread = true,
  canCopyWorkingDirectory,
  heartbeatAutomationActionLabelKey,
  isOpenInNewWindowDisabled = false,
  isThreadActionsMenuOpen,
  isThreadHeartbeatAutomationActionDisabled,
  isThreadHeartbeatAutomationActionVisible,
  isThreadPinned,
  isTurnInProgress,
  isWorktreeThread,
  variant = "default",
  onArchive,
  onCopyAppLink,
  onCopyConversationMarkdown,
  onCopySessionId,
  onCopyWorkingDirectory,
  onForkThread,
  onForkThreadIntoWorktree,
  onOpenInNewWindow,
  onOpenSideChat,
  onOpenThreadHeartbeatAutomationAction,
  onOpenRenameDialog,
  onTogglePinThread,
  onToggleThreadActionsMenu,
  t,
}: ThreadHeaderOverflowMenuProps) {
  const isLocalConversation = variant === "localConversation";
  const menuButtonClassName = isLocalConversation
    ? "app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--app-shell-subtle)] hover:text-[var(--app-shell-text)]"
    : "app-topbar-button no-drag flex h-8 w-8 items-center justify-center rounded-[10px]";
  const shouldShowForkSection =
    onOpenSideChat !== undefined || isThreadHeartbeatAutomationActionVisible || !isOpenInNewWindowDisabled;
  const shouldShowOpenInNewWindow = !isOpenInNewWindowDisabled;

  return (
    <>
      <div className="relative no-drag" ref={actionsMenuRef}>
        <button
          type="button"
          aria-label={t("threadHeader.moreActions")}
          aria-expanded={isThreadActionsMenuOpen}
          onClick={onToggleThreadActionsMenu}
          className={menuButtonClassName}
        >
          <MoreActionsIcon className="h-4 w-4" />
        </button>

        {isThreadActionsMenuOpen ? (
          <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 min-w-[236px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            {canPinThread ? (
              <button
                type="button"
                onClick={onTogglePinThread}
                className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              >
                {isThreadPinned ? (
                  <UnpinIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <PinIcon className="h-4 w-4 shrink-0" />
                )}
                {isThreadPinned ? t("sidebarElectron.unpinThread") : t("sidebarElectron.pinThread")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenRenameDialog}
              className={[
                "app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]",
                canPinThread ? "" : "mt-0",
              ].join(" ")}
            >
              <PencilIcon className="h-4 w-4 shrink-0" />
              {t("sidebarElectron.renameThread")}
            </button>
            <button
              type="button"
              onClick={onArchive}
              className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <ArchiveIcon className="h-4 w-4 shrink-0" />
              {t("sidebarElectron.archiveThread")}
            </button>
            <div className="my-1 h-px bg-[var(--app-shell-border)]" />
            <button
              type="button"
              disabled={!canCopyWorkingDirectory}
              onClick={onCopyWorkingDirectory}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
            >
              <CopyPathIcon className="h-4 w-4 shrink-0" />
              {t("threadHeader.copyWorkingDirectory")}
            </button>
            <button
              type="button"
              onClick={onCopySessionId}
              className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <CopyPathIcon className="h-4 w-4 shrink-0" />
              {t("threadHeader.copySessionId")}
            </button>
            <button
              type="button"
              onClick={onCopyAppLink}
              className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <CopyPathIcon className="h-4 w-4 shrink-0" />
              {t("threadHeader.copyAppLink")}
            </button>
            <button
              type="button"
              onClick={onCopyConversationMarkdown}
              className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <CopyPathIcon className="h-4 w-4 shrink-0" />
              {t("threadHeader.copyConversationMarkdown")}
            </button>
            {shouldShowForkSection ? (
              <div className="my-1 h-px bg-[var(--app-shell-border)]" />
            ) : null}
            {onOpenSideChat ? (
              <button
                type="button"
                onClick={onOpenSideChat}
                className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              >
                <OpenSideChatIcon className="h-4 w-4 shrink-0" />
                {t("threadHeader.openSideChat")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={isTurnInProgress}
              onClick={onForkThread}
              className={[
                "app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60",
                onOpenSideChat || isThreadHeartbeatAutomationActionVisible || shouldShowOpenInNewWindow
                  ? "mt-1"
                  : "",
              ].join(" ")}
            >
              {isWorktreeThread ? (
                <MacbookIcon className="h-4 w-4 shrink-0" />
              ) : (
                <ForkedConversationIcon className="h-4 w-4 shrink-0" />
              )}
              {t(isWorktreeThread ? "threadHeader.forkIntoSameWorktree" : "threadHeader.forkIntoLocal")}
            </button>
            <button
              type="button"
              disabled={isTurnInProgress}
              onClick={onForkThreadIntoWorktree}
              className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
            >
              <WorktreeIcon className="h-4 w-4 shrink-0" />
              {t("threadHeader.forkIntoWorktree")}
            </button>
            {isThreadHeartbeatAutomationActionVisible ? (
              <button
                type="button"
                disabled={isThreadHeartbeatAutomationActionDisabled}
                onClick={onOpenThreadHeartbeatAutomationAction}
                className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
              >
                <ClockIcon className="h-4 w-4 shrink-0" />
                {t(heartbeatAutomationActionLabelKey)}
              </button>
            ) : null}
            {shouldShowOpenInNewWindow ? <div className="my-1 h-px bg-[var(--app-shell-border)]" /> : null}
            {shouldShowOpenInNewWindow ? (
              <button
                type="button"
                onClick={onOpenInNewWindow}
                className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              >
                <OpenInNewWindowIcon className="h-4 w-4 shrink-0" />
                {t("threadHeader.openInNewWindow")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function ThreadHeaderTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden max-w-[min(32rem,calc(100vw-16px))] -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

function normalizeThreadHeaderActions(actions: ReactNode) {
  return Children.toArray(actions);
}
