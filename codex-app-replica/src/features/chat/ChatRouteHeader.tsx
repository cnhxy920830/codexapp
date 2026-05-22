import { useEffect, useState, type ReactNode, type RefObject } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversation } from "../../services/history";
import { readGitBranches } from "../../services/gitBranches";
import type { CommandKeymapState } from "../../services/keyboardShortcuts";
import { readGitOrigins } from "../../services/gitOrigins";
import { listenGitStateChanged } from "../../services/gitStateEvents";
import { LocalConversationPageHeader } from "./LocalConversationPageHeader";
import {
  ThreadHeaderActionMenu,
  ThreadHeaderHeartbeatButton,
  ThreadHeaderOverflowMenu,
  ThreadPageHeader,
} from "./ThreadPageHeader";

type ChatRouteHeaderProps = {
  heartbeatAutomationActionLabelKey: MessageKey;
  heartbeatAutomationButtonTooltip: string;
  hasAttachedHeartbeatAutomation: boolean;
  isResponseInProgress?: boolean;
  isThreadActionsMenuOpen: boolean;
  isThreadHeartbeatAutomationActionDisabled: boolean;
  isThreadHeartbeatAutomationActionVisible: boolean;
  isThreadPinned?: boolean;
  isWorktreeThread: boolean;
  onArchiveThread: () => void;
  onCopyAppLink: () => void;
  onCopyConversationMarkdown: () => void;
  onCopySessionId: () => void;
  onCopyWorkingDirectory: () => void;
  onForkSelectedThread: () => void;
  onForkSelectedThreadIntoWorktree: () => void;
  onOpenAttachedHeartbeatAutomation: () => void;
  onOpenInNewWindow: () => void;
  onMarkThreadUnread?: () => void;
  onOpenRenameDialog: () => void;
  onOpenSideChat?: (() => void) | undefined;
  onOpenThreadHeartbeatAutomationAction: () => void;
  onTogglePinnedThread: () => void;
  onToggleThreadActionsMenu: () => void;
  remoteTaskId?: string | null;
  showThreadHeader?: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  commandKeymapState?: CommandKeymapState | null;
  threadActionsMenuRef: RefObject<HTMLDivElement | null>;
  threadConversation: ThreadConversation | null;
  threadHeaderStartActions?: ReactNode;
  threadHeaderTrailingActions?: ReactNode;
  workspaceRoot?: string | null;
};

export function ChatRouteHeader({
  heartbeatAutomationActionLabelKey,
  heartbeatAutomationButtonTooltip,
  hasAttachedHeartbeatAutomation,
  isResponseInProgress = false,
  isThreadActionsMenuOpen,
  isThreadHeartbeatAutomationActionDisabled,
  isThreadHeartbeatAutomationActionVisible,
  isThreadPinned = false,
  isWorktreeThread,
  onArchiveThread,
  onCopyAppLink,
  onCopyConversationMarkdown,
  onCopySessionId,
  onCopyWorkingDirectory,
  onForkSelectedThread,
  onForkSelectedThreadIntoWorktree,
  onOpenAttachedHeartbeatAutomation,
  onOpenInNewWindow,
  onMarkThreadUnread,
  onOpenRenameDialog,
  onOpenSideChat,
  onOpenThreadHeartbeatAutomationAction,
  onTogglePinnedThread,
  onToggleThreadActionsMenu,
  remoteTaskId = null,
  showThreadHeader = true,
  t,
  commandKeymapState = null,
  threadActionsMenuRef,
  threadConversation,
  threadHeaderStartActions,
  threadHeaderTrailingActions,
  workspaceRoot = null,
}: ChatRouteHeaderProps) {
  if (!showThreadHeader) {
    return null;
  }

  const threadTitle =
    threadConversation?.title.trim().length ? threadConversation.title.trim() : t("app.nav.newChat");
  const threadProjectLabel =
    (threadConversation?.cwd ?? workspaceRoot ?? "")
      .split(/[\\/]/u)
      .filter((segment) => segment.length > 0)
      .at(-1) ?? null;
  const threadHeaderEnvironmentType =
    remoteTaskId !== null ? "cloud" : isWorktreeThread ? "worktree" : threadConversation ? "local" : null;
  const threadHeaderSecondaryText =
    threadProjectLabel !== null && threadProjectLabel !== threadTitle ? threadProjectLabel : null;
  const isLocalConversationHeader = remoteTaskId === null;
  const localConversationHeaderSource = threadConversation?.source ?? null;
  const canPinLocalConversationThread = localConversationHeaderSource?.parentThreadId == null;
  const canCopyWorkingDirectory = (threadConversation?.cwd ?? "").trim().length > 0;
  const latestReasoningEffort = getLatestHeaderReasoningEffort(threadConversation);
  const [isTitleHoverCardOpen, setIsTitleHoverCardOpen] = useState(false);
  const [threadBranchLabel, setThreadBranchLabel] = useState<string | null>(null);
  const [threadGitRoot, setThreadGitRoot] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocalConversationHeader) {
      setThreadBranchLabel(null);
      setThreadGitRoot(null);
      return;
    }

    const workspaceForGitRoot = threadConversation?.cwd ?? workspaceRoot ?? null;
    const hostId = threadConversation?.hostId ?? null;
    if (workspaceForGitRoot == null) {
      setThreadBranchLabel(null);
      setThreadGitRoot(null);
      return;
    }

    let cancelled = false;

    const refreshGitRoot = async () => {
      try {
        const origins = await readGitOrigins({
          dirs: [workspaceForGitRoot],
          hostId,
        });
        const gitRoot = origins.origins.at(0)?.root?.trim() ?? null;
        if (!cancelled) {
          if (gitRoot == null) {
            setThreadBranchLabel(null);
          }
          setThreadGitRoot(gitRoot);
        }
      } catch {
        if (!cancelled) {
          setThreadBranchLabel(null);
          setThreadGitRoot(null);
        }
      }
    };

    void refreshGitRoot();
    const unsubscribe = listenGitStateChanged(() => {
      void refreshGitRoot();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    isLocalConversationHeader,
    threadConversation?.cwd,
    threadConversation?.hostId,
    workspaceRoot,
  ]);

  useEffect(() => {
    if (!isLocalConversationHeader || !isTitleHoverCardOpen || threadGitRoot == null) {
      setThreadBranchLabel(null);
      return;
    }

    let cancelled = false;

    const refreshThreadBranchLabel = async () => {
      try {
        const branches = await readGitBranches({
          gitRoot: threadGitRoot,
          hostId: threadConversation?.hostId ?? null,
        });
        if (!cancelled) {
          setThreadBranchLabel(branches.currentBranch ?? branches.defaultBranch ?? null);
        }
      } catch {
        if (!cancelled) {
          setThreadBranchLabel(null);
        }
      }
    };

    void refreshThreadBranchLabel();
    const unsubscribe = listenGitStateChanged(() => {
      void refreshThreadBranchLabel();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    isLocalConversationHeader,
    isTitleHoverCardOpen,
    threadConversation?.hostId,
    threadGitRoot,
  ]);

  const threadHeaderTrailing = threadHeaderTrailingActions ? (
    <div className="no-drag flex items-center gap-1">{threadHeaderTrailingActions}</div>
  ) : null;
  const threadHeaderMenuActions = threadConversation ? (
    <ThreadHeaderActionMenu
      actionsMenuRef={threadActionsMenuRef}
      canPinThread={isLocalConversationHeader ? canPinLocalConversationThread : true}
      canCopyWorkingDirectory={canCopyWorkingDirectory}
      commandKeymapState={commandKeymapState}
      hasAttachedHeartbeatAutomation={hasAttachedHeartbeatAutomation}
      heartbeatAutomationActionLabelKey={heartbeatAutomationActionLabelKey}
      heartbeatAutomationButtonTooltip={heartbeatAutomationButtonTooltip}
      isThreadActionsMenuOpen={isThreadActionsMenuOpen}
      isThreadHeartbeatAutomationActionDisabled={isThreadHeartbeatAutomationActionDisabled}
      isThreadHeartbeatAutomationActionVisible={isThreadHeartbeatAutomationActionVisible}
      isThreadPinned={isThreadPinned}
      isTurnInProgress={isResponseInProgress}
      isWorktreeThread={isWorktreeThread}
      variant={isLocalConversationHeader ? "localConversation" : "default"}
      onArchive={onArchiveThread}
      onCopyAppLink={onCopyAppLink}
      onCopyConversationMarkdown={onCopyConversationMarkdown}
      onCopySessionId={onCopySessionId}
      onCopyWorkingDirectory={onCopyWorkingDirectory}
      onForkThread={onForkSelectedThread}
      onForkThreadIntoWorktree={onForkSelectedThreadIntoWorktree}
      onOpenAttachedHeartbeatAutomation={onOpenAttachedHeartbeatAutomation}
      onOpenInNewWindow={onOpenInNewWindow}
      onMarkUnread={onMarkThreadUnread}
      onOpenSideChat={onOpenSideChat}
      onOpenThreadHeartbeatAutomationAction={onOpenThreadHeartbeatAutomationAction}
      onOpenRenameDialog={onOpenRenameDialog}
      onTogglePinThread={onTogglePinnedThread}
      onToggleThreadActionsMenu={onToggleThreadActionsMenu}
      t={t}
    />
  ) : null;
  const localConversationHeaderHeartbeat = threadConversation ? (
    <ThreadHeaderHeartbeatButton
      hasAttachedHeartbeatAutomation={hasAttachedHeartbeatAutomation}
      heartbeatAutomationButtonTooltip={heartbeatAutomationButtonTooltip}
      onOpenAttachedHeartbeatAutomation={onOpenAttachedHeartbeatAutomation}
      t={t}
      variant="localConversation"
    />
  ) : null;
  const localConversationHeaderActions = (
    <div className="no-drag flex shrink-0 items-center gap-2">
      {threadHeaderTrailingActions ? (
        <div className="no-drag flex shrink-0 items-center gap-1">{threadHeaderTrailingActions}</div>
      ) : null}
      {threadConversation ? (
        <ThreadHeaderOverflowMenu
          actionsMenuRef={threadActionsMenuRef}
          canPinThread={canPinLocalConversationThread}
          canCopyWorkingDirectory={canCopyWorkingDirectory}
          commandKeymapState={commandKeymapState}
          heartbeatAutomationActionLabelKey={heartbeatAutomationActionLabelKey}
          isThreadActionsMenuOpen={isThreadActionsMenuOpen}
          isThreadHeartbeatAutomationActionDisabled={isThreadHeartbeatAutomationActionDisabled}
          isThreadHeartbeatAutomationActionVisible={isThreadHeartbeatAutomationActionVisible}
          isThreadPinned={isThreadPinned}
          isTurnInProgress={isResponseInProgress}
          isWorktreeThread={isWorktreeThread}
          variant="localConversation"
          onArchive={onArchiveThread}
          onCopyAppLink={onCopyAppLink}
          onCopyConversationMarkdown={onCopyConversationMarkdown}
          onCopySessionId={onCopySessionId}
          onCopyWorkingDirectory={onCopyWorkingDirectory}
          onForkThread={onForkSelectedThread}
          onForkThreadIntoWorktree={onForkSelectedThreadIntoWorktree}
          onOpenInNewWindow={onOpenInNewWindow}
          onMarkUnread={onMarkThreadUnread}
          onOpenSideChat={onOpenSideChat}
          onOpenThreadHeartbeatAutomationAction={onOpenThreadHeartbeatAutomationAction}
          onOpenRenameDialog={onOpenRenameDialog}
          onTogglePinThread={onTogglePinnedThread}
          onToggleThreadActionsMenu={onToggleThreadActionsMenu}
          t={t}
        />
      ) : null}
    </div>
  );

  return isLocalConversationHeader ? (
    <div className="draggable grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-4 py-1.5">
      <LocalConversationPageHeader
        compact
        conversationId={threadConversation?.id ?? null}
        cwd={threadConversation?.cwd ?? workspaceRoot ?? null}
        heartbeatSummary={hasAttachedHeartbeatAutomation ? heartbeatAutomationButtonTooltip : null}
        latestCollaborationMode={threadConversation?.latestCollaborationMode ?? null}
        latestReasoningEffort={latestReasoningEffort}
        onTitleHoverCardOpenChange={setIsTitleHoverCardOpen}
        projectLabel={threadProjectLabel}
        source={localConversationHeaderSource}
        t={t}
        threadBranchLabel={threadBranchLabel}
        threadGitRoot={threadGitRoot}
        title={threadTitle}
        heartbeatAction={localConversationHeaderHeartbeat}
        trailingActions={localConversationHeaderActions}
      />
    </div>
  ) : (
    <div className="draggable grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2">
      <ThreadPageHeader
        compact
        environmentType={threadHeaderEnvironmentType}
        secondaryText={threadHeaderSecondaryText}
        variant="default"
        start={threadTitle}
        startActions={threadHeaderStartActions}
        trailing={threadHeaderTrailing}
        trailingActions={threadHeaderMenuActions}
      />
    </div>
  );
}

function getLatestHeaderReasoningEffort(threadConversation: ThreadConversation | null) {
  if (threadConversation == null) {
    return null;
  }

  for (let index = threadConversation.items.length - 1; index >= 0; index -= 1) {
    const item = threadConversation.items[index];
    if (item?.type !== "multiAgentAction") {
      continue;
    }

    const reasoningEffort = item.reasoningEffort?.trim() ?? "";
    if (reasoningEffort.length > 0) {
      return reasoningEffort;
    }
  }

  return null;
}
