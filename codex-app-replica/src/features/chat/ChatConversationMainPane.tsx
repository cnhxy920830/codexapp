import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  CheckIcon,
  CheckCircleFilledIcon,
  CloudTaskIcon,
  CubeIcon,
  CopyPathIcon,
  ForkedConversationIcon,
  InfoIcon,
  PencilIcon,
  PersonalityChangedIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type {
  ApprovalDecision,
  CommandAction,
  McpServerElicitationRequest,
  ThreadConversation,
  ThreadConversationMessage,
  ThreadConversationItem,
  ThreadConversationPlanImplementation,
} from "../../services/history";
import {
  resolveRemoteTaskEnvironmentSetupState,
  getRemoteTaskApplyDiff,
  type RemoteConversationGroupOverride,
  type RemoteTaskEnvironment,
  type RemoteTaskTurn,
} from "../../services/remoteTasks";
import type { ToolRequestUserInputQuestion } from "../../services/history";
import type { ComposerEnterBehavior, FollowUpQueueMode, ReviewDelivery } from "../../services/settings";
import type { ConfigSnapshot } from "../../services/settings";
import { updateDiffIfOpen } from "../../services/windowNavigation";
import { openFile } from "../../services/hostFiles";
import { readGitBranches } from "../../services/gitBranches";
import { readGitOrigins } from "../../services/gitOrigins";
import { listenGitStateChanged } from "../../services/gitStateEvents";
import { OpenPullRequestIcon } from "../pullRequests/PullRequestIcons";
import type { QueuedLocalFollowUp } from "./localFollowUpQueue";
import {
  approvalRequestKey,
  resolveApprovalDecisions,
  type PendingApproval,
  type PendingImplementPlanRequest,
  type PendingMcpServerElicitationRequest,
  type PendingPermissionsRequestApproval,
  type PendingToolRequestUserInput,
} from "./threadConversationState";
import { renderMessageContent } from "./messageContent";
import { LocalUserImageAttachment } from "./LocalUserImageAttachment";
import { MultiAgentGroupSummary } from "./MultiAgentGroupSummary";
import { PlanSummaryItemCard } from "./PlanSummaryItemCard";
import { RemoteEnvironmentSetupCard } from "./RemoteEnvironmentSetupCard";
import { RemoteConversationFooter } from "./RemoteConversationFooter";
import { RemoteUserImageAttachment } from "./RemoteUserImageAttachment";
import { ThreadGoalOwner } from "./ThreadGoalOwner";
import { TurnDiffCard } from "./TurnDiffCard";
import { UserMessageEditComposer } from "./UserMessageEditComposer";
import { UserMessageCollapsibleContent } from "./UserMessageCollapsibleContent";
import {
  attachTurnScopedItemsToRenderableConversationGroups,
  buildRenderableConversationGroups,
} from "./renderableConversationGroups";
import type { RenderableConversationGroup } from "./renderableConversationGroups";
import type {
  CollapsedToolActivityItem,
  ExplorationGroupItem,
  RenderableConversationItem,
  WebSearchGroupItem,
} from "./renderableConversationItems";
import {
  buildCollapsedToolActivityDetailLines,
  resolveCollapsedToolActivitySummaryText,
} from "./renderableConversationItems";
import { isMultiAgentInProgressStatus, toSingleMultiAgentGroupItem } from "./multiAgentAction";
import { ThreadComposer } from "./ThreadComposer";
import { CodexMobileOnboarding } from "./CodexMobileOnboarding";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";
import type {
  HotkeyPermissionAgentMode,
  HotkeyPermissionsState,
} from "../hotkeyWindow/hotkeyPermissionsMode";

const approvalDecisionLabelKeys: Record<ApprovalDecision, MessageKey> = {
  accept: "app.chat.approval.accept",
  acceptForSession: "app.chat.approval.acceptForSession",
  decline: "app.chat.approval.decline",
  cancel: "app.chat.approval.cancel",
};

const statusLabelKeys: Record<string, MessageKey> = {
  inProgress: "app.chat.status.inProgress",
  completed: "app.chat.status.completed",
  failed: "app.chat.status.failed",
  declined: "app.chat.status.declined",
};

type CurrentPendingRequest =
  | {
      type: "approval";
      request: PendingApproval;
    }
  | {
      type: "mcpServerElicitation";
      request: PendingMcpServerElicitationRequest;
    }
  | {
      type: "permissionRequest";
      request: PendingPermissionsRequestApproval;
    }
  | {
      type: "userInput";
      request: PendingToolRequestUserInput;
    }
  | {
      type: "implementPlan";
      request: PendingImplementPlanRequest;
    };

type ChatConversationMainPaneProps = {
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  composerFocusNonce?: number | null;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  followUpQueueMode: FollowUpQueueMode;
  isResponseInProgress?: boolean;
  isWorktreeThread: boolean;
  currentThreadApprovals: PendingApproval[];
  currentThreadImplementPlanRequests: PendingImplementPlanRequest[];
  currentThreadMcpServerElicitationRequest: PendingMcpServerElicitationRequest[];
  currentThreadPermissionsRequestApproval: PendingPermissionsRequestApproval[];
  currentThreadToolRequestUserInput: PendingToolRequestUserInput[];
  currentThreadQueuedFollowUps: QueuedLocalFollowUp[];
  currentThreadPendingPdfComments?: PendingPdfCommentAttachment[];
  currentThreadPendingPdfCommentCount?: number;
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  onDismissImplementPlanRequest: (request: PendingImplementPlanRequest) => void;
  onImplementPlanRequestSubmit: (
    request: PendingImplementPlanRequest,
    submission: { type: "followUp"; text: string } | { type: "implement" },
  ) => void;
  onMcpServerElicitationRequestSubmit: (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => void;
  onPermissionsRequestApprovalSubmit: (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => void;
  onToolRequestUserInputSubmit: (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => void;
  onComposerDraftChange: (value: string) => void;
  onComposerCollaborationModeChange?: (mode: "default" | "plan" | null) => void;
  onComposerPermissionModeChange: (mode: HotkeyPermissionAgentMode) => void;
  onOpenRemoteTask: (taskId: string) => void;
  onSelectRemoteTaskAssistantTurn: (assistantTurnId: string) => void;
  onOpenSideChat?: (initialPrompt?: string | null) => boolean | Promise<boolean>;
  onOpenWorkspaceFileSearch?: () => void;
  onFocusComposerRequest?: () => void;
  onSelectThread: (threadId: string) => void;
  onThreadGoalEditorOpenChange?: (open: boolean) => void;
  onPendingThreadGoalObjectiveChange?: (value: string | null) => void;
  onEditUserMessage: (text: string) => void | Promise<void>;
  onRemoveQueuedFollowUp: (queuedFollowUpId: string) => void;
  onClearPendingPdfComments?: () => void;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  onShowToast?: (toast: AppToast) => void;
  approvalActionErrors: Record<string, string>;
  reviewDelivery: ReviewDelivery;
  respondingApprovalKeys: string[];
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  remoteAttemptTabsByTurnId: Record<
    string,
    {
      turns: RemoteTaskTurn[];
      selectedTurnId: string | null;
      expectedCount: number;
    }
  >;
  remoteConversationOverridesByTurnId: Record<string, RemoteConversationGroupOverride>;
  remoteCurrentAssistantTurn?: RemoteTaskTurn | null;
  remoteDiffTaskTurn?: RemoteTaskTurn | null;
  remoteSelectedAssistantTurn?: RemoteTaskTurn | null;
  remoteTaskEnvironment?: RemoteTaskEnvironment | null;
  remoteTaskId?: string | null;
  composerPlacement?: "main" | "side";
  showFooter?: boolean;
  showComposerFooter?: boolean;
  isThreadGoalEditorOpen?: boolean;
  pendingThreadGoalObjective?: string | null;
  threadConversation: ThreadConversation | null;
  turnError: string | null;
  workspaceRoot?: string | null;
  conversationHostId?: string | null;
  authMethod?: string | null;
  activeCollaborationMode?: string | null;
};

export function ChatConversationMainPane({
  composerDraft,
  composerEnterBehavior,
  composerFocusNonce,
  composerPermissionConfig,
  composerPermissionMode,
  composerPermissionsState,
  followUpQueueMode,
  isResponseInProgress = false,
  isWorktreeThread,
  currentThreadApprovals,
  currentThreadImplementPlanRequests,
  currentThreadMcpServerElicitationRequest,
  currentThreadPermissionsRequestApproval,
  currentThreadToolRequestUserInput,
  currentThreadQueuedFollowUps,
  currentThreadPendingPdfComments = [],
  currentThreadPendingPdfCommentCount = 0,
  onApprovalDecision,
  onDismissImplementPlanRequest,
  onImplementPlanRequestSubmit,
  onMcpServerElicitationRequestSubmit,
  onPermissionsRequestApprovalSubmit,
  onToolRequestUserInputSubmit,
  onComposerDraftChange,
  onComposerCollaborationModeChange,
  onComposerPermissionModeChange,
  onOpenRemoteTask,
  onSelectRemoteTaskAssistantTurn,
  onOpenSideChat,
  onOpenWorkspaceFileSearch,
  onFocusComposerRequest = () => undefined,
  onSelectThread,
  onThreadGoalEditorOpenChange = () => undefined,
  onPendingThreadGoalObjectiveChange = () => undefined,
  onEditUserMessage,
  onRemoveQueuedFollowUp,
  onClearPendingPdfComments,
  onStopTurn,
  onSubmitTurn,
  onShowToast,
  approvalActionErrors,
  reviewDelivery,
  respondingApprovalKeys,
  submitButtonMode,
  t,
  remoteAttemptTabsByTurnId,
  remoteConversationOverridesByTurnId,
  remoteCurrentAssistantTurn = null,
  remoteDiffTaskTurn = null,
  remoteSelectedAssistantTurn = null,
  remoteTaskEnvironment = null,
  remoteTaskId = null,
  composerPlacement = "main",
  showFooter = true,
  showComposerFooter = true,
  isThreadGoalEditorOpen = false,
  pendingThreadGoalObjective = null,
  threadConversation,
  turnError,
  workspaceRoot = null,
  conversationHostId = null,
  authMethod = null,
  activeCollaborationMode = null,
}: ChatConversationMainPaneProps) {
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [threadBranchLabel, setThreadBranchLabel] = useState<string | null>(null);
  const [threadGitRoot, setThreadGitRoot] = useState<string | null>(null);
  const userMessageSentAtMsByTurnId = useMemo(
    () =>
      new Map(
        (threadConversation?.turnTimings ?? []).map((timing) => [timing.turnId, timing.turnStartedAtMs ?? null]),
      ),
    [threadConversation?.turnTimings],
  );
  const baseConversationGroups = threadConversation
    ? buildRenderableConversationGroups(threadConversation.items, {
        turnTimings: threadConversation.turnTimings,
      })
    : [];
  const turnIds = baseConversationGroups.map((group) => group.turnId);
  const footerPendingRequest = selectComposerFooterPendingRequest({
    approvals: currentThreadApprovals,
    implementPlanRequests: currentThreadImplementPlanRequests,
    mcpRequests: currentThreadMcpServerElicitationRequest,
    permissionsRequests: currentThreadPermissionsRequestApproval,
    turnIds,
    userInputRequests: currentThreadToolRequestUserInput,
  });
  const bodyApprovals = filterPendingRequestsForConversationBody(currentThreadApprovals, footerPendingRequest);
  const bodyUserInputRequests = filterPendingRequestsForConversationBody(
    currentThreadToolRequestUserInput,
    footerPendingRequest,
  );
  const groupedConversation = attachTurnScopedItemsToRenderableConversationGroups(baseConversationGroups, {
    approvalItems: bodyApprovals,
  });
  const conversationGroups = groupedConversation.groups;
  const latestConversationGroup = conversationGroups.at(-1) ?? null;
  const latestConversationGroupTurnId = conversationGroups.at(-1)?.turnId ?? null;
  const conversationId = threadConversation?.id ?? null;
  const latestUnifiedDiff = latestConversationGroup?.unifiedDiffItem?.unifiedDiff ?? "";
  const remoteApplyTurnId = remoteSelectedAssistantTurn?.id ?? null;
  const remoteApplyDiff = getRemoteTaskApplyDiff({
    selectedTurn: remoteSelectedAssistantTurn,
    diffTaskTurn: remoteDiffTaskTurn,
    currentAssistantTurn: remoteCurrentAssistantTurn,
  });
  const showRemoteApplyFooter = Boolean(
    remoteApplyTurnId && remoteApplyDiff && threadConversation !== null,
  );
  const showRemoteFailedFooter = Boolean(
    remoteCurrentAssistantTurn?.turn_status === "failed" && remoteTaskId && threadConversation !== null,
  );
  const hasTurnContent = threadConversation !== null && conversationGroups.length > 0;
  const hasUnmatchedBodyContent =
    groupedConversation.unmatchedApprovalItems.length > 0 ||
    currentThreadQueuedFollowUps.length > 0;
  const showBlankConversationBody = !hasTurnContent && !hasUnmatchedBodyContent;
  const showThreadGoalOwner =
    composerPlacement === "main" &&
    (threadConversation?.hostId ?? null) === null &&
    (threadConversation?.threadGoal != null || pendingThreadGoalObjective != null || isThreadGoalEditorOpen);

  useEffect(() => {
    let cancelled = false;

    const resolveThreadBranchLabel = async () => {
      const workspaceForBranch = threadConversation?.cwd ?? workspaceRoot ?? null;
      if (!workspaceForBranch || remoteTaskId !== null) {
        setThreadBranchLabel(null);
        setThreadGitRoot(null);
        return;
      }

      try {
        const origins = await readGitOrigins({ dirs: [workspaceForBranch] });
        const gitRoot = origins.origins.at(0)?.root?.trim() ?? null;
        if (!gitRoot) {
          if (!cancelled) {
            setThreadBranchLabel(null);
            setThreadGitRoot(null);
          }
          return;
        }

        const branches = await readGitBranches({ gitRoot, hostId: conversationHostId });
        if (!cancelled) {
          setThreadGitRoot(gitRoot);
          setThreadBranchLabel(branches.currentBranch ?? branches.defaultBranch ?? null);
        }
      } catch {
        if (!cancelled) {
          setThreadBranchLabel(null);
          setThreadGitRoot(null);
        }
      }
    };

    void resolveThreadBranchLabel();
    const unsubscribe = listenGitStateChanged(() => {
      void resolveThreadBranchLabel();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversationHostId, remoteTaskId, threadConversation?.cwd, workspaceRoot]);

  useEffect(() => {
    const scrollContainer = conversationScrollRef.current;
    if (scrollContainer === null) {
      setShowScrollToBottomButton(false);
      return;
    }

    const updateScrollToBottomButton = () => {
      const distanceFromBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      setShowScrollToBottomButton(distanceFromBottom > 160);
    };

    updateScrollToBottomButton();
    scrollContainer.addEventListener("scroll", updateScrollToBottomButton, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", updateScrollToBottomButton);
    };
  }, [conversationGroups.length, showBlankConversationBody]);

  useEffect(() => {
    if (!isResponseInProgress) {
      return;
    }

    const scrollContainer = conversationScrollRef.current;
    if (scrollContainer === null) {
      return;
    }

    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    if (distanceFromBottom <= 160) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [isResponseInProgress, threadConversation?.items.length]);

  const handleScrollToBottom = () => {
    const scrollContainer = conversationScrollRef.current;
    if (scrollContainer === null) {
      return;
    }

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!conversationId || latestUnifiedDiff.trim().length === 0) {
      return;
    }

    void updateDiffIfOpen({
      conversationId,
      unifiedDiff: latestUnifiedDiff,
    }).catch(() => undefined);
  }, [conversationId, latestUnifiedDiff]);
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-[var(--app-shell-main-surface)]">
      {showBlankConversationBody ? (
        <div
          className="[container-type:size] relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden"
          role="main"
          aria-label={t("homePage.mainContent")}
        >
          <CodexMobileOnboarding onShowToast={onShowToast} />
        </div>
      ) : (
        <div
          ref={conversationScrollRef}
          className="thread-edge-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3"
          role="main"
          aria-label={t("homePage.mainContent")}
        >
          <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-3">
            {hasTurnContent
              ? conversationGroups.map((group) => (
                  <ConversationGroupContent
                    key={group.id}
                    conversationId={conversationId ?? ""}
                    conversationCwd={threadConversation?.cwd ?? null}
                    conversationHostId={conversationHostId}
                    group={group}
                    approvalActionErrors={approvalActionErrors}
                    onApprovalDecision={onApprovalDecision}
                    onMcpServerElicitationRequestSubmit={onMcpServerElicitationRequestSubmit}
                    onOpenRemoteTask={onOpenRemoteTask}
                    onSelectRemoteTaskAssistantTurn={onSelectRemoteTaskAssistantTurn}
                    onPermissionsRequestApprovalSubmit={onPermissionsRequestApprovalSubmit}
                    onEditUserMessage={onEditUserMessage}
                    onSelectThread={onSelectThread}
                    remoteAttemptTabs={remoteAttemptTabsByTurnId[group.turnId] ?? null}
                    remoteConversationOverride={remoteConversationOverridesByTurnId[group.turnId] ?? null}
                    onToolRequestUserInputSubmit={onToolRequestUserInputSubmit}
                    planSummaryIsWriting={
                      isResponseInProgress &&
                      latestConversationGroupTurnId === group.turnId &&
                      group.assistantMessage === null
                    }
                    respondingApprovalKeys={respondingApprovalKeys}
                    t={t}
                    userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId}
                  />
                ))
              : null}
            <ConversationTurnApprovalRequests
              approvals={groupedConversation.unmatchedApprovalItems}
              approvalActionErrors={approvalActionErrors}
              respondingApprovalKeys={respondingApprovalKeys}
              onApprovalDecision={onApprovalDecision}
              t={t}
            />

            {currentThreadQueuedFollowUps.length > 0 ? (
              <div className="app-card-muted rounded-[16px] px-4 py-3">
                <div className="app-title text-[12px] font-medium tracking-[0.08em]">
                  {t("app.chat.queuedFollowUps", { count: currentThreadQueuedFollowUps.length })}
                </div>
                <div className="mt-2 space-y-2">
                  {currentThreadQueuedFollowUps.map((followUp) => (
                    <div
                      key={followUp.id}
                      className="app-control flex items-start justify-between gap-3 rounded-[12px] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 break-words text-[13px] leading-6 whitespace-pre-wrap">
                        {followUp.text}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveQueuedFollowUp(followUp.id)}
                        className="app-control-weak shrink-0 rounded-full px-2.5 py-1 text-[11px]"
                      >
                        {t("app.chat.removeQueuedFollowUp")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showFooter ? (
        <RemoteConversationFooter
          aboveComposerContent={
            showThreadGoalOwner ? (
              <ThreadGoalOwner
                conversationId={conversationId}
                draftObjective={composerDraft}
                goal={threadConversation?.threadGoal ?? null}
                hostId={conversationHostId}
                isEditorOpen={isThreadGoalEditorOpen}
                pendingObjective={pendingThreadGoalObjective}
                onEditorOpenChange={onThreadGoalEditorOpenChange}
                onFocusComposer={onFocusComposerRequest}
                onPendingObjectiveChange={onPendingThreadGoalObjectiveChange}
                onShowToast={onShowToast}
                t={t}
              />
            ) : null
          }
          composer={
            <ThreadComposer
              activeCollaborationMode={activeCollaborationMode}
              composerDraft={composerDraft}
              composerEnterBehavior={composerEnterBehavior}
              conversationId={conversationId}
              focusComposerNonce={composerFocusNonce}
              composerPermissionConfig={composerPermissionConfig}
              composerPermissionMode={composerPermissionMode}
              composerPermissionsState={composerPermissionsState}
              followUpQueueMode={followUpQueueMode}
              isResponseInProgress={isResponseInProgress}
              isWorktreeThread={isWorktreeThread}
              onComposerDraftChange={onComposerDraftChange}
              onComposerCollaborationModeChange={onComposerCollaborationModeChange}
              onComposerPermissionModeChange={onComposerPermissionModeChange}
              onClearPendingPdfComments={onClearPendingPdfComments}
              onOpenWorkspaceFileSearch={onOpenWorkspaceFileSearch}
              onOpenThreadGoalEditor={
                composerPlacement === "main"
                  ? () => onThreadGoalEditorOpenChange(true)
                  : null
              }
              onStopTurn={onStopTurn}
              onSubmitTurn={onSubmitTurn}
              pendingPdfComments={currentThreadPendingPdfComments}
              pendingPdfCommentCount={currentThreadPendingPdfCommentCount}
              pendingThreadGoalObjective={
                composerPlacement === "main" ? pendingThreadGoalObjective : null
              }
              placement={composerPlacement}
              reviewDelivery={reviewDelivery}
              submitButtonMode={submitButtonMode}
              t={t}
              authMethod={authMethod}
              latestTokenUsageInfo={threadConversation?.latestTokenUsageInfo ?? null}
              threadBranchLabel={threadBranchLabel}
              threadGoal={threadConversation?.threadGoal ?? null}
              threadGitRoot={threadGitRoot}
              threadHostId={conversationHostId}
              threadCwd={threadConversation?.cwd ?? null}
              turnError={turnError}
              onShowToast={onShowToast}
              onOpenSideChat={
                onOpenSideChat
                  ? (initialPrompt) => Promise.resolve(onOpenSideChat(initialPrompt)).then(() => true)
                  : null
              }
            />
          }
          footerPendingRequest={
            footerPendingRequest ? (
              <ComposerFooterPendingRequest
                pendingRequest={footerPendingRequest}
                approvalActionErrors={approvalActionErrors}
                respondingApprovalKeys={respondingApprovalKeys}
                onApprovalDecision={onApprovalDecision}
                onDismissImplementPlanRequest={onDismissImplementPlanRequest}
                onImplementPlanRequestSubmit={onImplementPlanRequestSubmit}
                onMcpServerElicitationRequestSubmit={onMcpServerElicitationRequestSubmit}
                onPermissionsRequestApprovalSubmit={onPermissionsRequestApprovalSubmit}
                onToolRequestUserInputSubmit={onToolRequestUserInputSubmit}
                t={t}
                turnError={turnError}
              />
            ) : null
          }
          onScrollToBottom={handleScrollToBottom}
          onShowToast={onShowToast}
          remoteApplyDiff={remoteApplyDiff}
          remoteApplyTurnId={remoteApplyTurnId}
          remoteTaskEnvironment={remoteTaskEnvironment}
          remoteTaskId={remoteTaskId}
          showComposerFooter={showComposerFooter}
          showRemoteApplyFooter={showRemoteApplyFooter}
          showRemoteFailedFooter={showRemoteFailedFooter}
          showScrollToBottomButton={showScrollToBottomButton}
          t={t}
          workspaceRoot={workspaceRoot}
        />
      ) : null}
    </section>
  );
}

function ConversationTurnApprovalRequests({
  approvals,
  approvalActionErrors,
  respondingApprovalKeys,
  onApprovalDecision,
  t,
}: {
  approvals: PendingApproval[];
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (approvals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => {
        const requestKey = approvalRequestKey(approval.requestId);
        const isResponding = respondingApprovalKeys.includes(requestKey);
        const approvalError = approvalActionErrors[requestKey] ?? null;
        return (
          <ApprovalRequestCard
            key={requestKey}
            approval={approval}
            isResponding={isResponding}
            approvalError={approvalError}
            onApprovalDecision={onApprovalDecision}
            t={t}
          />
        );
      })}
    </div>
  );
}

function ConversationTurnPlanImplementationItems({
  items,
  t,
}: {
  items: ThreadConversationPlanImplementation[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <PlanImplementationItemCard key={item.id} item={item} t={t} />
      ))}
    </div>
  );
}

export function ComposerFooterPendingRequest({
  pendingRequest,
  approvalActionErrors,
  respondingApprovalKeys,
  onApprovalDecision,
  onDismissImplementPlanRequest,
  onImplementPlanRequestSubmit,
  onMcpServerElicitationRequestSubmit,
  onPermissionsRequestApprovalSubmit,
  onToolRequestUserInputSubmit,
  t,
  turnError,
}: {
  pendingRequest: CurrentPendingRequest;
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  onDismissImplementPlanRequest: (request: PendingImplementPlanRequest) => void;
  onImplementPlanRequestSubmit: (
    request: PendingImplementPlanRequest,
    submission: { type: "followUp"; text: string } | { type: "implement" },
  ) => void;
  onMcpServerElicitationRequestSubmit: (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => void;
  onPermissionsRequestApprovalSubmit: (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => void;
  onToolRequestUserInputSubmit: (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  turnError: string | null;
}) {
  switch (pendingRequest.type) {
    case "approval": {
      const requestKey = approvalRequestKey(pendingRequest.request.requestId);
      return (
        <ApprovalRequestCard
          approval={pendingRequest.request}
          isResponding={respondingApprovalKeys.includes(requestKey)}
          approvalError={approvalActionErrors[requestKey] ?? null}
          onApprovalDecision={onApprovalDecision}
          t={t}
        />
      );
    }
    case "mcpServerElicitation": {
      const requestKey = approvalRequestKey(pendingRequest.request.requestId);
      return (
        <McpServerElicitationRequestCard
          request={pendingRequest.request}
          isResponding={respondingApprovalKeys.includes(requestKey)}
          requestError={approvalActionErrors[requestKey] ?? null}
          onSubmit={onMcpServerElicitationRequestSubmit}
          t={t}
        />
      );
    }
    case "permissionRequest": {
      const requestKey = approvalRequestKey(pendingRequest.request.requestId);
      return (
        <PermissionsRequestApprovalCard
          request={pendingRequest.request}
          isResponding={respondingApprovalKeys.includes(requestKey)}
          requestError={approvalActionErrors[requestKey] ?? null}
          onSubmit={onPermissionsRequestApprovalSubmit}
          t={t}
        />
      );
    }
    case "userInput": {
      const requestKey = approvalRequestKey(pendingRequest.request.requestId);
      return (
        <ToolRequestUserInputCard
          request={pendingRequest.request}
          isResponding={respondingApprovalKeys.includes(requestKey)}
          requestError={approvalActionErrors[requestKey] ?? null}
          onSubmit={onToolRequestUserInputSubmit}
          t={t}
        />
      );
    }
    case "implementPlan":
      return (
        <ImplementPlanRequestCard
          request={pendingRequest.request}
          onDismiss={onDismissImplementPlanRequest}
          onSubmit={onImplementPlanRequestSubmit}
          t={t}
          turnError={turnError}
        />
      );
  }
}

function PlanImplementationItemCard({
  item,
  t,
}: {
  item: ThreadConversationPlanImplementation;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">{t("app.chat.planImplementation")}</div>
        <StatusBadge status={item.isCompleted ? "completed" : "inProgress"} t={t} />
      </div>
      <div className="app-text-muted mt-3 whitespace-pre-wrap text-[13px] leading-6">{item.planContent}</div>
    </div>
  );
}

function ImplementPlanRequestCard({
  request,
  onDismiss,
  onSubmit,
  t,
  turnError,
}: {
  request: PendingImplementPlanRequest;
  onDismiss: (request: PendingImplementPlanRequest) => void;
  onSubmit: (
    request: PendingImplementPlanRequest,
    submission: { type: "followUp"; text: string } | { type: "implement" },
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  turnError: string | null;
}) {
  const [followUpText, setFollowUpText] = useState("");

  useEffect(() => {
    setFollowUpText("");
  }, [request.requestId]);

  return (
    <div className="app-card rounded-[18px] px-4 py-4">
      <div className="text-[14px] font-medium">{t("app.chat.implementPlan.prompt")}</div>
      <textarea
        value={followUpText}
        onChange={(event) => setFollowUpText(event.target.value)}
        rows={3}
        placeholder={t("app.chat.implementPlan.otherPlaceholder")}
        className="app-text-input mt-3 min-h-[88px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none"
      />
      {turnError ? <div className="app-text-error mt-2 text-[12px]">{turnError}</div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(request, { type: "implement" })}
          className="app-button-primary rounded-full px-4 py-1.5 text-[13px]"
        >
          {t("app.chat.implementPlan.implement")}
        </button>
        <button
          type="button"
          disabled={followUpText.trim().length === 0}
          onClick={() => onSubmit(request, { type: "followUp", text: followUpText })}
          className="app-control rounded-full px-4 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("app.chat.implementPlan.submit")}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(request)}
          className="app-control-weak rounded-full px-4 py-1.5 text-[13px]"
        >
          {t("app.chat.implementPlan.dismiss")}
        </button>
      </div>
    </div>
  );
}

function ApprovalRequestCard({
  approval,
  isResponding,
  approvalError,
  onApprovalDecision,
  t,
}: {
  approval: PendingApproval;
  isResponding: boolean;
  approvalError: string | null;
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const requestKey = approvalRequestKey(approval.requestId);
  const decisions = resolveApprovalDecisions(approval);

  return (
    <div className="app-card-warning rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-medium">
          {approval.type === "commandApprovalRequested"
            ? t("app.chat.approval.commandTitle")
            : t("app.chat.approval.fileChangeTitle")}
        </div>
        <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.review")}</div>
      </div>

      {approval.reason ? (
        <LabeledValue label={t("app.chat.approval.reason")} value={approval.reason} className="mt-3" />
      ) : null}

      {approval.type === "commandApprovalRequested" ? (
        <>
          {approval.networkApprovalContext ? (
            <div className="mt-3 space-y-2">
              <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.networkAccess")}
              </div>
              <div className="app-card-muted rounded-[14px] px-4 py-3">
                <div className="text-[13px] leading-6">
                  {approval.networkApprovalContext.protocol}://{approval.networkApprovalContext.host}
                </div>
                <div className="app-text-muted mt-2 flex flex-wrap gap-4 text-[12px]">
                  <span>
                    {t("app.chat.approval.protocol")}: {approval.networkApprovalContext.protocol}
                  </span>
                  <span>
                    {t("app.chat.approval.host")}: {approval.networkApprovalContext.host}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          {approval.command ? (
            <div className="mt-3">
              <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.command")}
              </div>
              <pre className="app-code-block-warning mt-1 overflow-x-auto rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
                {approval.command}
              </pre>
            </div>
          ) : null}
          {approval.cwd ? (
            <LabeledValue
              label={t("app.chat.approval.workingDirectory")}
              value={approval.cwd}
              className="mt-3"
            />
          ) : null}
          {approval.commandActions && approval.commandActions.length > 0 ? (
            <div className="mt-3">
              <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.commandActions")}
              </div>
              <div className="mt-2 space-y-2">
                {approval.commandActions.map((action, index) => (
                  <CommandActionCard
                    key={`${requestKey}:command-action:${action.type}:${index}`}
                    action={action}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {approval.additionalPermissions ? (
            <div className="mt-3">
              <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.additionalPermissions")}
              </div>
              <div className="mt-2 space-y-2">
                {approval.additionalPermissions.network?.enabled ? (
                  <div className="app-card-muted rounded-[14px] px-4 py-3">
                    <div className="text-[12px] font-medium tracking-[0.08em]">
                      {t("app.chat.permissions.network")}
                    </div>
                    <div className="mt-2 text-[12px] leading-5">
                      {t("app.chat.permissions.networkEnabled")}
                    </div>
                  </div>
                ) : null}
                {approval.additionalPermissions.fileSystem ? (
                  <div className="space-y-2">
                    {renderPermissionPathBlock(
                      t("app.chat.permissions.read"),
                      approval.additionalPermissions.fileSystem.read ?? [],
                    )}
                    {renderPermissionPathBlock(
                      t("app.chat.permissions.write"),
                      approval.additionalPermissions.fileSystem.write ?? [],
                    )}
                    {approval.additionalPermissions.fileSystem.entries &&
                    approval.additionalPermissions.fileSystem.entries.length > 0 ? (
                      <div className="app-card-muted rounded-[14px] px-4 py-3">
                        <div className="text-[12px] font-medium tracking-[0.08em]">
                          {t("app.chat.permissions.entries")}
                        </div>
                        <div className="mt-2 space-y-1">
                          {approval.additionalPermissions.fileSystem.entries.map((entry, index) => (
                            <div
                              key={`${requestKey}:additional-entry:${entry.access}:${entry.path}:${index}`}
                              className="text-[12px] leading-5"
                            >
                              {entry.access}: {entry.path}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {approval.proposedExecpolicyAmendment && approval.proposedExecpolicyAmendment.length > 0 ? (
            <div className="mt-3">
              <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.execPolicyAmendment")}
              </div>
              <div className="mt-2 space-y-1">
                {approval.proposedExecpolicyAmendment.map((entry) => (
                  <div
                    key={`${requestKey}:exec-policy:${entry}`}
                    className="app-card-muted break-all rounded-[14px] px-4 py-3 text-[12px] leading-5"
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {approval.proposedNetworkPolicyAmendments && approval.proposedNetworkPolicyAmendments.length > 0 ? (
            <div className="mt-3">
              <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
                {t("app.chat.approval.networkPolicyAmendments")}
              </div>
              <div className="mt-2 space-y-2">
                {approval.proposedNetworkPolicyAmendments.map((entry, index) => (
                  <div
                    key={`${requestKey}:network-policy:${entry.action}:${entry.host}:${index}`}
                    className="app-card-muted rounded-[14px] px-4 py-3 text-[12px] leading-5"
                  >
                    {entry.action}: {entry.host}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {approval.grantRoot ? (
            <LabeledValue
              label={t("app.chat.approval.requestedWriteRoot")}
              value={approval.grantRoot}
              className="mt-3"
            />
          ) : null}
          <div className="mt-3">
            <div className="app-text-warning-muted text-[12px] font-medium tracking-[0.08em]">
              {t("app.chat.approval.changes")}
            </div>
            {approval.changes.length > 0 ? (
              <div className="mt-2 space-y-2">
                {approval.changes.map((change, changeIndex) => (
                  <FileChangeCard
                    key={`${requestKey}:${change.kind}:${change.path}:${changeIndex}`}
                    change={change}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="app-text-warning-muted mt-2 text-[13px] leading-6">
                {t("app.chat.approval.noChanges")}
              </div>
            )}
          </div>
        </>
      )}

      {approvalError ? <div className="app-text-error mt-3 text-[12px]">{approvalError}</div> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {decisions.map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={isResponding}
            onClick={() => void onApprovalDecision(approval, decision)}
            className={[
              "rounded-full border px-3 py-1.5 text-[12px]",
              decision === "accept"
                ? "app-approval-button-primary"
                : decision === "acceptForSession"
                  ? "app-approval-button-secondary"
                  : "app-approval-button-tertiary",
            ].join(" ")}
          >
            {t(approvalDecisionLabelKeys[decision])}
          </button>
        ))}
        {isResponding ? (
          <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.submitting")}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ConversationGroupContent({
  conversationId,
  conversationCwd = null,
  conversationHostId = null,
  group,
  approvalActionErrors,
  onApprovalDecision,
  onEditUserMessage,
  onMcpServerElicitationRequestSubmit,
  onOpenRemoteTask,
  onSelectRemoteTaskAssistantTurn,
  onPermissionsRequestApprovalSubmit,
  onSelectThread,
  remoteAttemptTabs = null,
  remoteConversationOverride = null,
  onToolRequestUserInputSubmit,
  planSummaryIsWriting = false,
  respondingApprovalKeys,
  t,
  userMessageSentAtMsByTurnId,
}: {
  conversationId: string;
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  group: RenderableConversationGroup;
  approvalActionErrors: Record<string, string>;
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  onEditUserMessage: (text: string) => void | Promise<void>;
  onMcpServerElicitationRequestSubmit: (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => void;
  onOpenRemoteTask: (taskId: string) => void;
  onSelectRemoteTaskAssistantTurn: (assistantTurnId: string) => void;
  onPermissionsRequestApprovalSubmit: (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => void;
  onSelectThread: (threadId: string) => void;
  remoteAttemptTabs?: {
    turns: RemoteTaskTurn[];
    selectedTurnId: string | null;
    expectedCount: number;
  } | null;
  remoteConversationOverride?: RemoteConversationGroupOverride | null;
  onToolRequestUserInputSubmit: (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => void;
  planSummaryIsWriting?: boolean;
  respondingApprovalKeys: string[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  userMessageSentAtMsByTurnId: Map<string, number | null>;
}) {
  const remoteEnvironmentSetupState = remoteConversationOverride?.assistantTurn
    ? resolveRemoteTaskEnvironmentSetupState(remoteConversationOverride.assistantTurn)
    : null;
  const showRemoteEnvironmentSetup = remoteEnvironmentSetupState !== null;
  const userMessageParentContextItem = group.forkedFromConversationItems[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.preUserItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.modelChangedItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      {remoteConversationOverride && remoteConversationOverride.userImageAttachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 self-end">
          {remoteConversationOverride.userImageAttachments.map((attachment, index) => (
            <RemoteUserImageAttachment
              key={`${group.turnId}:${attachment.assetPointer ?? attachment.directUrl ?? index}`}
              attachment={attachment}
            />
          ))}
        </div>
      ) : null}
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.userItems} parentContextItem={userMessageParentContextItem} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.modelReroutedItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      {remoteAttemptTabs && remoteAttemptTabs.expectedCount > 1 ? (
        <RemoteAttemptTabs
          expectedCount={remoteAttemptTabs.expectedCount}
          selectedTurnId={remoteAttemptTabs.selectedTurnId}
          turns={remoteAttemptTabs.turns}
          onSelect={onSelectRemoteTaskAssistantTurn}
          t={t}
        />
      ) : null}
      {showRemoteEnvironmentSetup && remoteConversationOverride?.assistantTurn ? (
        <RemoteEnvironmentSetupCard
          assistantTurn={remoteConversationOverride.assistantTurn}
          taskId={conversationId}
        />
      ) : (
        <>
          <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.activityItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          {group.assistantMessage ? (
            <ConversationItemCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={group.assistantMessage} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          ) : null}
          <ConversationItemList
            conversationCwd={conversationCwd}
            conversationHostId={conversationHostId}
            conversationId={conversationId}
            items={group.assistantAutomationUpdateItems}
            onEditUserMessage={onEditUserMessage}
            onOpenRemoteTask={onOpenRemoteTask}
            onSelectThread={onSelectThread}
            t={t}
            userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId}
          />
          <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.automationUpdateItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.toolOutputItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.postAssistantItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          {group.systemEventItem ? (
            <ConversationItemCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={group.systemEventItem} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
          ) : null}
          {group.unifiedDiffItem ? (
            <ConversationItemCard
              conversationId={conversationId}
              conversationCwd={conversationCwd}
              conversationHostId={conversationHostId}
              item={group.unifiedDiffItem}
              onEditUserMessage={onEditUserMessage}
              onOpenRemoteTask={onOpenRemoteTask}
              onSelectThread={onSelectThread}
              t={t}
              userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId}
            />
          ) : null}
        </>
      )}
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.remoteTaskCreatedItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.personalityChangedItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      {group.todoListItem ? (
        <ConversationItemCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={group.todoListItem} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      ) : null}
      {group.proposedPlanItem ? (
        <ConversationItemCard
          conversationId={conversationId}
          conversationCwd={conversationCwd}
          conversationHostId={conversationHostId}
          item={group.proposedPlanItem}
          planSummaryIsWriting={planSummaryIsWriting}
          onEditUserMessage={onEditUserMessage}
          onOpenRemoteTask={onOpenRemoteTask}
          onSelectThread={onSelectThread}
          t={t}
          userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId}
        />
      ) : null}
      <ConversationTurnPlanImplementationItems items={group.planImplementationItem ? [group.planImplementationItem] : []} t={t} />
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.mcpServerElicitationItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      <ConversationItemList conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} items={group.permissionRequestItems} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      <ConversationTurnApprovalRequests
        approvals={group.approvalItem ? [group.approvalItem] : []}
        approvalActionErrors={approvalActionErrors}
        respondingApprovalKeys={respondingApprovalKeys}
        onApprovalDecision={onApprovalDecision}
        t={t}
      />
      {group.userInputItem ? (
        <ConversationItemCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={group.userInputItem} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
      ) : null}
    </div>
  );
}

function ConversationItemList({
  conversationCwd = null,
  conversationHostId = null,
  conversationId,
  items,
  parentContextItem = null,
  onEditUserMessage,
  onOpenRemoteTask,
  onSelectThread,
  t,
  userMessageSentAtMsByTurnId,
}: {
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  conversationId: string;
  items: RenderableConversationItem[];
  parentContextItem?: Extract<ThreadConversationItem, { type: "forkedFromConversation" }> | null;
  onEditUserMessage: (text: string) => void | Promise<void>;
  onOpenRemoteTask: (taskId: string) => void;
  onSelectThread: (threadId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  userMessageSentAtMsByTurnId: Map<string, number | null>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
      <div className="space-y-3">
        {items.map((item) => (
          <ConversationItemCard key={item.id} conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={item} parentContextItem={item.type === "userMessage" ? parentContextItem : null} onEditUserMessage={onEditUserMessage} onOpenRemoteTask={onOpenRemoteTask} onSelectThread={onSelectThread} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />
        ))}
    </div>
  );
}

function RemoteAttemptTabs({
  expectedCount,
  selectedTurnId,
  turns,
  onSelect,
  t,
}: {
  expectedCount: number;
  selectedTurnId: string | null;
  turns: RemoteTaskTurn[];
  onSelect: (assistantTurnId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const orderedTurns = [...turns].sort(
    (left, right) =>
      (left.attempt_placement ?? left.created_at ?? 0) - (right.attempt_placement ?? right.created_at ?? 0),
  );
  const items = Array.from({ length: expectedCount }, (_, index) => ({
    attemptNumber: index + 1,
    turn: orderedTurns[index] ?? null,
  }));

  return (
    <div className="hide-scrollbar -mb-1 flex overflow-x-auto overflow-y-visible whitespace-nowrap">
      <div className="flex gap-2 pb-1">
        {items.map(({ attemptNumber, turn }) =>
          turn ? (
            <button
              key={turn.id}
              type="button"
              onClick={() => onSelect(turn.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-[12px]",
                turn.id === selectedTurnId ? "app-approval-button-primary" : "app-control",
              ].join(" ")}
            >
              {t("codex.remoteConversation.turnTab.title", { number: attemptNumber })}
            </button>
          ) : (
            <button
              key={`remote-attempt-placeholder:${attemptNumber}`}
              type="button"
              disabled
              className="app-control rounded-full border px-3 py-1.5 text-[12px] opacity-60"
            >
              {t("codex.remoteConversation.turnTab.loading", { number: attemptNumber })}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function ConversationItemCard({
  conversationId,
  conversationCwd = null,
  conversationHostId = null,
  item,
  parentContextItem = null,
  planSummaryIsWriting = false,
  onEditUserMessage,
  onOpenRemoteTask,
  onSelectThread,
  t,
  userMessageSentAtMsByTurnId,
}: {
  conversationId: string;
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  item: RenderableConversationItem;
  parentContextItem?: Extract<ThreadConversationItem, { type: "forkedFromConversation" }> | null;
  planSummaryIsWriting?: boolean;
  onEditUserMessage: (text: string) => void | Promise<void>;
  onOpenRemoteTask: (taskId: string) => void;
  onSelectThread: (threadId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  userMessageSentAtMsByTurnId: Map<string, number | null>;
}) {
  if (item.type === "userMessage" || item.type === "agentMessage") {
    if (item.type === "userMessage") {
      return <UserConversationMessageCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} item={item} onEditMessage={onEditUserMessage} onSelectThread={onSelectThread} parentContextItem={parentContextItem} t={t} userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId} />;
    }

    return <AssistantConversationMessageCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} item={item} t={t} />;
  }

  if (item.type === "explorationGroup") {
    return <ExplorationGroupSummary item={item} t={t} />;
  }

  if (item.type === "webSearchGroup") {
    return <WebSearchGroupSummary item={item} t={t} />;
  }

  if (item.type === "multiAgentGroup") {
    return <MultiAgentGroupSummary item={item} t={t} />;
  }

  if (item.type === "collapsedToolActivity") {
    return <CollapsedToolActivitySummaryCard item={item} />;
  }

  if (item.type === "plan") {
    return <PlanSummaryItemCard conversationCwd={conversationCwd} conversationHostId={conversationHostId} conversationId={conversationId} item={item} isWriting={planSummaryIsWriting} t={t} />;
  }

  if (item.type === "todoList") {
    const hasExplanation = item.explanation !== null && item.explanation.trim().length > 0;
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        {hasExplanation ? (
          <div className="app-text-muted whitespace-pre-wrap text-[13px] leading-6">{item.explanation}</div>
        ) : null}
        {item.plan.length > 0 ? (
          <div className={hasExplanation ? "mt-3 space-y-2" : "space-y-2"}>
            {item.plan.map((entry, index) => (
              <div key={`${item.id}:step:${index}:${entry.step}`} className="flex items-start gap-2 text-[13px] leading-6">
                <span className="app-text-subtle shrink-0 font-mono">[{todoListStepCheckmark(entry.status)}]</span>
                <span className="min-w-0 whitespace-pre-wrap">{entry.step}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (item.type === "turnDiff") {
    return <TurnDiffCard conversationCwd={conversationCwd} conversationId={conversationId} item={item} t={t} />;
  }

  if (item.type === "modelRerouted") {
    return <ModelReroutedInlineStatus item={item} t={t} />;
  }

  if (item.type === "modelChanged") {
    return <ModelChangedInlineStatus item={item} t={t} />;
  }

  if (item.type === "personalityChanged") {
    return <PersonalityChangedInlineStatus item={item} t={t} />;
  }

  if (item.type === "forkedFromConversation") {
    return <ForkedConversationInlineStatus item={item} onSelectThread={onSelectThread} t={t} />;
  }

  if (item.type === "remoteTaskCreated") {
    return <RemoteTaskCreatedInlineStatus item={item} onOpenRemoteTask={onOpenRemoteTask} t={t} />;
  }

  if (item.type === "hook") {
    const nonEmptyEntries = item.entries.filter((entry) => entry.text.trim().length > 0);
    const eventName = t(resolveHookEventNameKey(item.eventName));
    const summary =
      item.statusMessage && item.statusMessage.trim().length > 0
        ? t("localConversation.hookItem.summary.withStatusMessage", {
            eventName,
            statusMessage: item.statusMessage.trim(),
          })
        : eventName;
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div
            aria-label={t("localConversation.hookItem.summary.ariaLabel", {
              summary,
              status: item.status,
            })}
            className="app-title text-[14px] font-medium"
          >
            {summary}
          </div>
          <StatusBadge status={normalizeHookStatus(item.status)} t={t} />
        </div>
        {item.sourcePath ? (
          <LabeledValue label={t("localConversation.hookItem.hookContext")} value={item.sourcePath} className="mt-3" />
        ) : null}
        {nonEmptyEntries.length > 0 ? (
          <div className="mt-3 space-y-2">
            {nonEmptyEntries.map((entry, index) => (
              <div key={`${item.id}:entry:${entry.kind}:${index}`} className="app-card-muted rounded-[14px] px-4 py-3">
                <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
                  {resolveHookEntryLabel(entry.kind, t)}
                </div>
                <div className="mt-2 text-[13px] leading-6 whitespace-pre-wrap">{entry.text}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (item.type === "reasoning") {
    const summaryLines = item.summary.filter((line) => line.trim().length > 0);
    const contentLines = item.content.filter((line) => line.trim().length > 0);
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("thinkingShimmer.default")}</div>
        {summaryLines.length > 0 ? (
          <div className="mt-3 space-y-2">
            {summaryLines.map((line, index) => (
              <div key={`${item.id}:summary:${index}`} className="app-text-muted text-[13px] leading-6">
                {line}
              </div>
            ))}
          </div>
        ) : null}
        {contentLines.length > 0 ? (
          <pre className="app-code-block mt-3 overflow-x-auto rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
            {contentLines.join("\n")}
          </pre>
        ) : null}
      </div>
    );
  }

  if (item.type === "commandExecution") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("app.chat.commandExecution")}</div>
          <StatusBadge status={item.status} t={t} />
        </div>
        <LabeledValue label={t("app.chat.approval.command")} value={item.command} className="mt-3" mono />
        <LabeledValue label={t("app.chat.approval.workingDirectory")} value={item.cwd} className="mt-3" />
        {item.aggregatedOutput ? (
          <LabeledValue label={t("app.chat.output")} value={item.aggregatedOutput} className="mt-3" mono />
        ) : (
          <div className="app-text-subtle mt-3 text-[13px]">{t("app.chat.noOutput")}</div>
        )}
        <div className="app-text-muted mt-3 flex flex-wrap gap-4 text-[12px]">
          <span>
            {t("app.chat.exitCode")}: {item.exitCode ?? "—"}
          </span>
          <span>
            {t("app.chat.durationMs")}: {item.durationMs ?? "—"}
          </span>
        </div>
      </div>
    );
  }

  if (item.type === "webSearch") {
    return <WebSearchSummaryRow item={item} t={t} />;
  }

  if (item.type === "imageView") {
    return (
      <div className="app-card rounded-[18px] px-4 py-4">
        {renderMessageContent(`![Image](${item.path})`, {
          cwd: conversationCwd,
          hostId: conversationHostId,
        })}
      </div>
    );
  }

  if (item.type === "imageGeneration") {
    const normalizedResult = item.result.trim();
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("app.chat.imageGeneration")}</div>
          <StatusBadge status={item.status} t={t} />
        </div>
        {item.revisedPrompt ? (
          <LabeledValue label={t("app.chat.revisedPrompt")} value={item.revisedPrompt} className="mt-3" />
        ) : null}
        {normalizedResult ? <LabeledValue label={t("app.chat.output")} value={normalizedResult} className="mt-3" mono /> : null}
        {item.savedPath ? <LabeledValue label={t("app.chat.savedPath")} value={item.savedPath} className="mt-3" /> : null}
      </div>
    );
  }

  if (item.type === "multiAgentAction") {
    return (
      <MultiAgentGroupSummary
        item={toSingleMultiAgentGroupItem(item)}
        defaultExpanded={isMultiAgentInProgressStatus(item.status)}
        t={t}
      />
    );
  }

  if (item.type === "mcpToolCall") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">
            {t("avatarOverlay.session.calledToolName", { toolName: item.tool })}
          </div>
          <StatusBadge status={item.status} t={t} />
        </div>
        <LabeledValue label={t("app.chat.mcpServer")} value={item.server} className="mt-3" />
        <LabeledValue label={t("app.chat.mcpTool")} value={item.tool} className="mt-3" />
        {item.resultSummary ? (
          <LabeledValue label={t("app.chat.output")} value={item.resultSummary} className="mt-3" mono />
        ) : null}
        {item.errorMessage ? <div className="app-text-error mt-3 text-[12px]">{item.errorMessage}</div> : null}
      </div>
    );
  }

  if (item.type === "dynamicToolCall") {
    return <DynamicToolCallInlineStatus item={item} t={t} />;
  }

  if (item.type === "automationUpdate") {
    return <AutomationUpdateCard item={item} />;
  }

  if (item.type === "automaticApprovalReview") {
    return <AutomaticApprovalReviewCard item={item} t={t} />;
  }

  if (item.type === "autoReviewInterruptionWarning") {
    return <AutoReviewInterruptionWarningInlineStatus t={t} />;
  }

  if (item.type === "systemError") {
    return <ConversationRuntimeErrorCard content={item.content} />;
  }

  if (item.type === "streamError") {
    return <ConversationRuntimeErrorCard additionalDetails={item.additionalDetails} content={item.content} />;
  }

  if (item.type === "contextCompaction") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("app.chat.contextCompaction")}</div>
          <StatusBadge status={item.isCompleted ? "completed" : "inProgress"} t={t} />
        </div>
        <div className="app-text-muted mt-2 text-[13px] leading-6">{t("app.chat.contextCompactionDescription")}</div>
      </div>
    );
  }

  if (item.type === "mcpServerElicitation") {
    return <McpServerElicitationConversationItemCard item={item} t={t} />;
  }

  if (item.type === "permissionRequest") {
    return <PermissionRequestConversationItemCard item={item} t={t} />;
  }

  if (item.type === "userInput") {
    return <UserInputConversationItemCard item={item} t={t} />;
  }

  if (item.type === "userInputResponse") {
    const populatedQuestions = item.questionsAndAnswers.filter(
      (entry) =>
        entry.header.trim().length > 0 ||
        entry.question.trim().length > 0 ||
        entry.answers.some((answer) => answer.trim().length > 0),
    );

    if (populatedQuestions.length === 0) {
      return null;
    }

    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">User input response</div>
          <StatusBadge status={item.completed ? "completed" : "inProgress"} t={t} />
        </div>
        <div className="mt-3 space-y-3">
          {populatedQuestions.map((entry, index) => {
            const questionLabel = entry.header.trim() || entry.question.trim() || entry.id.trim() || `Question ${index + 1}`;
            const answers = entry.answers.map((answer) => answer.trim()).filter((answer) => answer.length > 0);
            return (
              <div key={`${item.id}:${entry.id || index}`} className="app-card-muted rounded-[14px] px-4 py-3">
                <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">{questionLabel}</div>
                {entry.question.trim().length > 0 ? (
                  <div className="mt-2 text-[13px] leading-6 whitespace-pre-wrap">{entry.question}</div>
                ) : null}
                {answers.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {answers.map((answer, answerIndex) => (
                      <div key={`${item.id}:${entry.id || index}:answer:${answerIndex}`} className="app-text-muted text-[13px] leading-6 whitespace-pre-wrap">
                        {answer}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === "fileChange") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("app.chat.fileChange")}</div>
          <StatusBadge status={item.status} t={t} />
        </div>
        <div className="mt-3 space-y-2">
          {item.changes.map((change: typeof item.changes[number], index: number) => (
            <FileChangeCard key={`${item.id}:${change.kind}:${change.path}:${index}`} change={change} t={t} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function AssistantConversationMessageCard({
  conversationCwd = null,
  conversationHostId = null,
  item,
  t,
}: {
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  item: ThreadConversationMessage;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className="group flex w-full justify-start">
      <div className="flex flex-col gap-2 max-w-[min(780px,100%)]">
        <div className="app-assistant-message rounded-2xl bg-[var(--app-shell-card-bg)] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[var(--app-shell-border)]">
          {renderMessageContent(item.text, {
            cwd: conversationCwd,
            hostId: conversationHostId,
          })}
        </div>
        <div className="flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            aria-label={copied ? t("app.chat.userMessage.copyCopiedAriaLabel") : t("app.chat.userMessage.copyAriaLabel")}
            disabled={copied}
            onClick={() => void handleCopy()}
            className="app-topbar-button inline-flex h-6 w-6 items-center justify-center rounded-full px-0 py-0 disabled:cursor-default text-[var(--app-shell-muted)] hover:text-[var(--app-shell-text)] hover:bg-[var(--app-shell-control-bg)]"
            title={copied ? t("app.chat.userMessage.copyCopiedTooltip") : t("app.chat.userMessage.copyTooltip")}
          >
            {copied ? <CheckIcon className="h-[14px] w-[14px]" /> : <CopyPathIcon className="h-[14px] w-[14px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserConversationMessageCard({
  conversationCwd = null,
  conversationHostId = null,
  item,
  onEditMessage,
  onSelectThread,
  parentContextItem = null,
  t,
  userMessageSentAtMsByTurnId,
}: {
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  item: ThreadConversationMessage;
  onEditMessage: (text: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void;
  parentContextItem?: Extract<ThreadConversationItem, { type: "forkedFromConversation" }> | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  userMessageSentAtMsByTurnId: Map<string, number | null>;
}) {
  const { locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const normalizedText = item.text.trim();
  const comments = Array.isArray(item.comments) ? item.comments : [];
  const commentCount = comments.length;
  const pullRequestCheckCount =
    typeof item.pullRequestCheckCount === "number" && Number.isFinite(item.pullRequestCheckCount)
      ? item.pullRequestCheckCount
      : 0;
  const pullRequestMergeTaskNumber =
    typeof item.pullRequestMergeTaskNumber === "number" && Number.isFinite(item.pullRequestMergeTaskNumber)
      ? item.pullRequestMergeTaskNumber
      : null;
  const hasVisibleText = normalizedText.length > 0;
  const visibleText = normalizedText.startsWith("PLEASE IMPLEMENT THIS PLAN:")
    ? t("app.chat.userMessage.implementPlan")
    : item.text;
  const hasVisibleMessageText = visibleText.trim().length > 0;
  const chips = [
    item.referencesPriorConversation
      ? { key: "referencesPriorConversation", label: t("app.chat.userMessage.referencesPriorConversation") }
      : null,
    item.reviewMode ? { key: "reviewMode", label: t("app.chat.userMessage.reviewMode") } : null,
    item.pullRequestFixMode ? { key: "pullRequestFixMode", label: t("app.chat.userMessage.pullRequestFixMode") } : null,
    item.autoResolveSync ? { key: "autoResolveSync", label: t("app.chat.userMessage.autoResolveSync") } : null,
    commentCount > 0
      ? {
          key: "commentCount",
          label: t("app.chat.userMessage.commentCount", { count: commentCount }),
        }
      : null,
    pullRequestCheckCount > 0
      ? {
          key: "pullRequestCheckCount",
          label: t("app.chat.userMessage.pullRequestCheckCount", { count: pullRequestCheckCount }),
        }
      : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);
  const sentAtMs = resolveUserMessageSentAtMs(item.turnId, userMessageSentAtMsByTurnId);
  const sentAtLabel = useMemo(() => {
    if (sentAtMs === null) {
      return null;
    }
    return formatUserMessageTimestamp(sentAtMs, locale);
  }, [locale, sentAtMs]);
  const messageStatusLabel = resolveUserMessageStatusLabel(item, t);
  const canEdit = !normalizedText.startsWith("PLEASE IMPLEMENT THIS PLAN:");
  const shouldRenderMetaRow = chips.length > 0 || hasVisibleMessageText;

  const handleCopy = async () => {
    if (!hasVisibleText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Keep the conversation visible even if clipboard access is unavailable.
    }
  };

  const handleEditSubmitWithText = async (value: string) => {
    const nextText = value.trim();
    if (nextText.length === 0 || isSubmittingEdit) {
      return;
    }
    setIsSubmittingEdit(true);
    try {
      await onEditMessage(nextText);
      setIsEditing(false);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const shouldRenderBubble = hasVisibleText || chips.length === 0;
  const hasAttachments = Array.isArray(item.attachments) && item.attachments.length > 0;
  const hasImages = Array.isArray(item.images) && item.images.length > 0;
  const parentContextId = parentContextItem?.sourceConversationId.trim() ?? "";
  const shouldRenderParentContext = parentContextId.length > 0;
  const shouldRenderAttachmentRow = shouldRenderParentContext || hasAttachments || hasImages;

  return (
      <div className="flex w-full flex-col gap-2">
      {shouldRenderAttachmentRow ? (
        <div className="flex flex-wrap items-end justify-end gap-2 self-end">
          {shouldRenderParentContext ? (
            <ParentChatAttachmentChip
              sourceConversationId={parentContextId}
              onSelectThread={onSelectThread}
              t={t}
            />
          ) : null}
          {item.attachments?.map((attachment, index) => (
            <UserMessageAttachmentChip
              key={`${item.id}:attachment:${attachment.path}:${index}`}
              attachment={attachment}
              conversationCwd={conversationCwd}
              conversationHostId={conversationHostId}
            />
          ))}
          {item.images?.map((src, index) => (
            <LocalUserImageAttachment
              key={`${item.id}:image:${src}:${index}`}
              conversationCwd={conversationCwd}
              conversationHostId={conversationHostId}
              src={src}
            />
          ))}
        </div>
      ) : null}
      {pullRequestMergeTaskNumber !== null ? (
        <UserMessageHeaderBadge
          icon={<OpenPullRequestIcon className="h-3.5 w-3.5 shrink-0" />}
          label={t("app.chat.userMessage.pullRequestMergeTask", { number: pullRequestMergeTaskNumber })}
        />
      ) : null}
      {item.goal ? (
        <UserMessageHeaderBadge
          icon={<CheckCircleFilledIcon className="h-3.5 w-3.5 shrink-0" />}
          label={t("app.chat.userMessage.goal")}
        />
      ) : null}
      <div className="group flex w-full flex-col items-end justify-end gap-1">
        {shouldRenderBubble ? (
          isEditing ? (
            <div className="w-full p-px">
              <UserMessageEditComposer
                cwd={conversationCwd}
                hostId={conversationHostId}
                isSubmitting={isSubmittingEdit}
                onCancel={() => {
                  setDraft(item.text);
                  setIsEditing(false);
                }}
                onDraftChange={setDraft}
                onSubmit={async (text) => {
                  setDraft(text);
                  await handleEditSubmitWithText(text);
                }}
                t={t}
                value={draft}
              />
            </div>
          ) : (
            <>
              {messageStatusLabel !== null ? (
                <div className="ms-1 mr-1 flex items-center gap-2 text-[var(--app-shell-muted)]">
                  <UserMessageStatusIcon className="h-[13px] w-[13px] shrink-0" />
                  <span className="text-[12px]">{messageStatusLabel}</span>
                </div>
              ) : null}
              <div
                className={[
                  "app-user-message max-w-[77%] break-words rounded-2xl px-3 py-2 [&_.contain-inline-size]:[contain:initial]",
                  hasVisibleText ? "" : "leading-none",
                ].join(" ")}
              >
                {hasVisibleText ? (
                  <UserMessageCollapsibleContent
                    cwd={conversationCwd}
                    hostId={conversationHostId}
                    text={visibleText}
                    t={t}
                  />
                ) : (
                  <div className="app-text-subtle mb-px text-[13px] leading-6">
                    {t("app.chat.userMessage.noContent")}
                  </div>
                )}
              </div>
            </>
          )
        ) : null}
        <div
          className={[
            "flex flex-row-reverse items-center gap-1 text-[12px] leading-4 text-[var(--app-shell-muted)]",
            shouldRenderMetaRow ? "" : "hidden",
          ].join(" ")}
        >
          {chips.map((chip) => (
            <UserMessageChip key={`${item.id}:${chip.key}`} label={chip.label} />
          ))}
          {hasVisibleMessageText && !isEditing ? (
            <div className="ms-1 mr-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              {sentAtLabel ? (
                <span className="app-text-muted text-[12px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  {sentAtLabel}
                </span>
              ) : null}
              <div className="flex items-center gap-1">
                <UserMessageActionTooltip
                  content={copied ? t("app.chat.userMessage.copyCopiedTooltip") : t("app.chat.userMessage.copyTooltip")}
                >
                  <button
                    type="button"
                    aria-label={copied ? t("app.chat.userMessage.copyCopiedAriaLabel") : t("app.chat.userMessage.copyAriaLabel")}
                    disabled={copied}
                    onClick={() => void handleCopy()}
                    className="app-topbar-button inline-flex h-6 w-6 items-center justify-center rounded-full px-0 py-0 disabled:cursor-default"
                  >
                    {copied ? <CheckIcon className="h-[14px] w-[14px]" /> : <CopyPathIcon className="h-[14px] w-[14px]" />}
                  </button>
                </UserMessageActionTooltip>
                {canEdit ? (
                  <UserMessageActionTooltip content={t("app.chat.userMessage.editTooltip")}>
                    <button
                      type="button"
                      aria-label={t("app.chat.userMessage.editAriaLabel")}
                      onClick={() => {
                        setDraft(item.text);
                        setIsEditing(true);
                      }}
                      className="app-topbar-button inline-flex h-6 w-6 items-center justify-center rounded-full px-0 py-0"
                    >
                      <PencilIcon className="h-[14px] w-[14px]" />
                    </button>
                  </UserMessageActionTooltip>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserMessageChip({ label }: { label: string }) {
  return (
    <span className="app-user-message-chip text-[12px] leading-4">
      {label}
    </span>
  );
}

function UserMessageHeaderBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="app-user-message-pill text-left">
      <UserMessageOwnerPillContent icon={icon} label={label} />
    </span>
  );
}

function UserMessageOwnerPillContent({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <>
      <span className="app-user-message-pill-icon">{icon}</span>
      <span className="app-user-message-pill-content">
        <span className="app-user-message-pill-label">{label}</span>
      </span>
    </>
  );
}

function UserMessageAttachmentChip({
  attachment,
  conversationCwd,
  conversationHostId,
}: {
  attachment: NonNullable<ThreadConversationMessage["attachments"]>[number];
  conversationCwd: string | null;
  conversationHostId: string | null;
}) {
  const lineInfo =
    typeof attachment.startLine === "number" && Number.isFinite(attachment.startLine)
      ? typeof attachment.endLine === "number" &&
        Number.isFinite(attachment.endLine) &&
        attachment.endLine !== attachment.startLine
        ? `${attachment.startLine}-${attachment.endLine}`
        : `${attachment.startLine}`
      : null;
  const displayLabel =
    lineInfo === null
      ? attachment.label
      : attachment.label.replace(/(?:\s+\(\s*\d+(?:-\d+)?\s*\)|\s+\d+(?:-\d+)?)(\s*)$/u, "$1");
  const openPath = attachment.fsPath ?? attachment.path;
  const openLine =
    typeof attachment.startLine === "number" && Number.isFinite(attachment.startLine) ? attachment.startLine : null;

  return (
    <button
      type="button"
      onClick={() =>
        void openFile({
          cwd: conversationCwd,
          hostId: conversationHostId,
          path: openPath,
          line: openLine,
          column: openLine === null ? null : 1,
        })
      }
      className="app-user-message-pill cursor-interaction"
    >
      <span className="app-user-message-pill-icon" aria-hidden="true">
        <WorkspaceFileIcon className="icon-2xs" />
      </span>
      <span className="app-user-message-pill-content">
        <span className="app-user-message-pill-label">{displayLabel}</span>
        {lineInfo !== null ? (
          <span className="app-user-message-pill-line">
            {lineInfo}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ParentChatAttachmentChip({
  sourceConversationId,
  onSelectThread,
  t,
}: {
  sourceConversationId: string;
  onSelectThread: (threadId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const displayTitle = t("localConversation.parentThread");

  return (
    <button
      type="button"
      onClick={() => onSelectThread(sourceConversationId)}
      className="app-user-message-pill cursor-interaction"
    >
      <span className="app-user-message-pill-icon" aria-hidden="true">
        <ForkedConversationIcon className="icon-2xs" />
      </span>
      <span className="app-user-message-pill-content">
        <span className="app-user-message-pill-label">{displayTitle}</span>
      </span>
    </button>
  );
}

function resolveUserMessageStatusLabel(
  item: ThreadConversationMessage,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (item.steeringStatus === "pending") {
    return t("app.chat.status.inProgress");
  }
  if (item.steeringStatus === "accepted") {
    return t("app.chat.status.completed");
  }
  return null;
}

function UserMessageStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M13.1293 7.34753C13.3565 7.12027 13.7081 7.09207 13.9662 7.26257L14.0707 7.34753L18.0707 11.3475C18.3304 11.6072 18.3304 12.0292 18.0707 12.2889L14.0707 16.2889C13.811 16.5486 13.389 16.5486 13.1293 16.2889C12.8696 16.0292 12.8696 15.6072 13.1293 15.3475L15.9935 12.4833H6.59998C4.57585 12.4833 2.93494 10.8424 2.93494 8.81824V5.31824C2.93494 4.95097 3.23271 4.6532 3.59998 4.6532C3.96724 4.6532 4.26501 4.95097 4.26501 5.31824V8.81824C4.26501 10.1078 5.31039 11.1532 6.59998 11.1532H15.9935L13.1293 8.28894L13.0443 8.18445C12.8738 7.92632 12.902 7.5748 13.1293 7.34753Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserMessageActionTooltip({
  children,
  content,
}: {
  children: ReactElement;
  content: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

function resolveUserMessageSentAtMs(turnId: string, userMessageSentAtMsByTurnId: Map<string, number | null>) {
  const sentAtMs = userMessageSentAtMsByTurnId.get(turnId) ?? null;
  return typeof sentAtMs === "number" && Number.isFinite(sentAtMs) ? sentAtMs : null;
}

const USER_MESSAGE_RECENT_DAY_WINDOW = 7;

function formatUserMessageTimestamp(sentAtMs: number, locale: string) {
  const sentAt = new Date(sentAtMs);
  const now = new Date();
  const dayDelta = resolveCalendarDayDelta(sentAt, now);

  if (dayDelta === 0) {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(sentAt);
  }

  if (dayDelta < 0 && dayDelta > -USER_MESSAGE_RECENT_DAY_WINDOW) {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(sentAt);
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(sentAt);
}

function resolveCalendarDayDelta(date: Date, now: Date) {
  const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dateAtMidnight.getTime() - nowAtMidnight.getTime()) / 86400000);
}

function ConversationRuntimeErrorCard({
  additionalDetails = null,
  content,
}: {
  additionalDetails?: string | null;
  content: string;
}) {
  const normalizedContent = content.trim();
  const normalizedAdditionalDetails = additionalDetails?.trim() || null;
  if (normalizedContent.length === 0 && normalizedAdditionalDetails === null) {
    return null;
  }
  return (
    <div className="app-card-error rounded-[18px] px-5 py-4">
      {normalizedContent.length > 0 ? <div className="whitespace-pre-wrap text-[13px] leading-6">{normalizedContent}</div> : null}
      {normalizedAdditionalDetails ? (
        <div className="app-text-error mt-3 whitespace-pre-wrap text-[12px] leading-5">{normalizedAdditionalDetails}</div>
      ) : null}
    </div>
  );
}

function AutomaticApprovalReviewCard({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "automaticApprovalReview" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const title = resolveAutomaticApprovalReviewTitle(item, t);
  const summary = resolveAutomaticApprovalReviewSummary(item, t);
  if (title.length === 0 && summary.length === 0) {
    return null;
  }

  const isHighRiskDenial = item.status === "denied" && item.riskLevel === "high";
  const isInProgress = item.status === "inProgress";

  return (
    <details open className="app-card rounded-[18px] px-5 py-4">
      <summary className="list-none cursor-interaction [&::-webkit-details-marker]:hidden">
        <div
          className={
            isHighRiskDenial
              ? "text-[14px] font-medium text-[var(--app-shell-error)]"
              : "app-title text-[14px] font-medium"
          }
        >
          <span className={isInProgress ? "loading-shimmer-pure-text" : undefined}>{title}</span>
        </div>
      </summary>
      {summary.length > 0 ? (
        <div className="app-text-muted mt-3 whitespace-pre-wrap text-[13px] leading-6">
          {summary}
        </div>
      ) : null}
    </details>
  );
}

function AutoReviewInterruptionWarningInlineStatus({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <InlineConversationStatusRow
      icon={<InfoIcon className="h-3.5 w-3.5 shrink-0" />}
      message={t("localConversation.autoReviewInterruptionWarning")}
      trailingContent={
        <InlineConversationStatusTooltip
          ariaLabel={t("localConversation.autoReviewInterruptionWarning")}
          line1={t("localConversation.autoReviewInterruptionWarning.nextSteps")}
        />
      }
    />
  );
}

function InlineConversationStatusRow({
  className,
  icon,
  message,
  trailingContent,
}: {
  className?: string;
  icon?: ReactNode;
  message: ReactNode;
  trailingContent?: ReactNode;
}) {
  return (
    <div
      className={[
        "my-2 flex items-center gap-2 text-[13px] text-[var(--app-shell-muted)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="h-px flex-1 border-t border-current/20" />
      <div className="flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap">
        {icon ?? null}
        <div className="min-w-0 truncate">{message}</div>
        {trailingContent ?? null}
      </div>
      <div className="h-px flex-1 border-t border-current/20" />
    </div>
  );
}

function CollapsedToolActivitySummaryCard({
  item,
}: {
  item: CollapsedToolActivityItem;
}) {
  const summary = resolveCollapsedToolActivitySummaryText(item.summary);
  const detailLines = buildCollapsedToolActivityDetailLines(item);

  return (
    <details open={item.isInProgress} className="app-card rounded-[18px] px-5 py-4">
      <summary className="list-none cursor-interaction [&::-webkit-details-marker]:hidden">
        <InlineConversationStatusRow
          className="my-0"
          message={
            <span className={item.isInProgress ? "loading-shimmer-pure-text" : undefined}>
              {summary}
            </span>
          }
        />
      </summary>
      {detailLines.length > 0 ? (
        <div className="mt-3 space-y-1 pl-4">
          {detailLines.map((line, index) => (
            <div key={`${item.id}:detail:${index}`} className="app-text-muted text-[12px] leading-5">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </details>
  );
}

function ExplorationGroupSummary({
  item,
  t,
}: {
  item: ExplorationGroupItem;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const summaries = item.items.flatMap((groupedItem) =>
    groupedItem.type === "commandExecution" ? buildExplorationCommandSummaries(groupedItem, t) : [],
  );
  const reasoningBlocks = item.items.filter(
    (groupedItem): groupedItem is Extract<ThreadConversationItem, { type: "reasoning" }> =>
      groupedItem.type === "reasoning",
  );

  if (summaries.length === 0 && reasoningBlocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {summaries.map((summary, index) => (
        <InlineConversationStatusRow
          key={`${item.id}:summary:${index}:${summary.text}`}
          className="my-0"
          message={
            <span className={summary.isInProgress ? "loading-shimmer-pure-text" : undefined}>
              {summary.text}
            </span>
          }
        />
      ))}
      {reasoningBlocks.map((reasoningItem, index) => {
        const lines = [...reasoningItem.summary, ...reasoningItem.content]
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (lines.length === 0) {
          return null;
        }
        return (
          <div
            key={`${item.id}:reasoning:${reasoningItem.id || index}`}
            className="ml-4 border-l border-[var(--app-shell-border)]/60 pl-4"
          >
            <div className="space-y-1">
              {lines.map((line, lineIndex) => (
                <div
                  key={`${reasoningItem.id}:line:${lineIndex}`}
                  className="app-text-muted text-[12px] leading-5"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WebSearchGroupSummary({
  item,
  t,
}: {
  item: WebSearchGroupItem;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="space-y-1">
      {item.items.map((webSearchItem) => (
        <WebSearchSummaryRow key={webSearchItem.id} item={webSearchItem} t={t} compact />
      ))}
    </div>
  );
}

function WebSearchSummaryRow({
  compact = false,
  item,
  t,
}: {
  compact?: boolean;
  item: Extract<ThreadConversationItem, { type: "webSearch" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const label = item.completed
    ? t("codex.webSearch.summary.verb.completed")
    : t("codex.webSearch.summary.verb.inProgress");
  const detailValue = resolveWebSearchSummaryDetails(item);
  const details = detailValue.length > 0 ? t("codex.webSearch.summary.details", { query: detailValue }) : "";
  const summary = t("codex.webSearch.summary", { label, details });

  return (
    <InlineConversationStatusRow
      className={compact ? "my-0" : undefined}
      message={
        <span className={item.completed ? undefined : "loading-shimmer-pure-text"}>
          {summary}
        </span>
      }
    />
  );
}

function DynamicToolCallInlineStatus({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "dynamicToolCall" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const summary = resolveDynamicToolCallSummary(item, t);
  if (summary === null) {
    return null;
  }

  return (
    <InlineConversationStatusRow
      icon={summary.icon}
      message={
        <span className={summary.isInProgress ? "loading-shimmer-pure-text" : undefined}>
          {summary.message}
        </span>
      }
    />
  );
}

function AutomationUpdateCard({
  item,
}: {
  item: Extract<ThreadConversationItem, { type: "automationUpdate" }>;
}) {
  const mode = item.result?.mode ?? normalizeAutomationUpdateModeLabel(item.arguments?.mode) ?? "pending";
  const automationId = item.result?.automationId ?? item.arguments?.id ?? "pending";
  const kind = item.result?.snapshot?.kind ?? item.arguments?.kind ?? null;
  const name = item.result?.snapshot?.name ?? item.arguments?.name ?? null;
  const rrule = item.result?.snapshot?.rrule ?? item.arguments?.rrule ?? null;

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">Automation update</div>
        <div className="app-text-muted text-[12px]">completed</div>
      </div>
      <LabeledValue label="Mode" value={mode} className="mt-3" />
      <LabeledValue label="Automation ID" value={automationId} className="mt-3" mono />
      {kind ? <LabeledValue label="Kind" value={kind} className="mt-3" /> : null}
      {name ? <LabeledValue label="Name" value={name} className="mt-3" /> : null}
      {rrule ? <LabeledValue label="Schedule" value={rrule} className="mt-3" mono /> : null}
      {item.result?.deleteStatus ? (
        <LabeledValue label="Delete status" value={item.result.deleteStatus} className="mt-3" />
      ) : null}
    </div>
  );
}

function ModelReroutedInlineStatus({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "modelRerouted" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const targetModel = item.toModel.trim();
  if (targetModel.length === 0) {
    return null;
  }

  return (
    <InlineConversationStatusRow
      message={t("localConversation.modelRerouted", { toModel: targetModel })}
      trailingContent={
        item.reason === "highRiskCyberActivity" ? (
          <InlineConversationStatusTooltip
            ariaLabel={t("localConversation.modelRerouted.warning.line1")}
            line1={t("localConversation.modelRerouted.warning.line1")}
            line2={renderModelReroutedWarningLine2(t("localConversation.modelRerouted.warning.line2"))}
          />
        ) : null
      }
    />
  );
}

function ModelChangedInlineStatus({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "modelChanged" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const fromModel = item.fromModel.trim();
  const toModel = item.toModel.trim();
  if (fromModel.length === 0 || toModel.length === 0) {
    return null;
  }

  return (
    <InlineConversationStatusRow
      icon={<CubeIcon className="h-2.5 w-2.5" />}
      message={t("localConversation.modelChanged", { fromModel, toModel })}
      trailingContent={
        <InlineConversationStatusTooltip
          ariaLabel={t("localConversation.modelChanged.warning.line1")}
          line1={t("localConversation.modelChanged.warning.line1")}
          line2={t("localConversation.modelChanged.warning.line2")}
        />
      }
    />
  );
}

function PersonalityChangedInlineStatus({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "personalityChanged" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const personality = item.personality.trim();
  if (personality.length === 0) {
    return null;
  }

  const personalityLabel =
    personality === "friendly"
      ? t("composer.personalitySlashCommand.label.friendly")
      : t("composer.personalitySlashCommand.label.pragmatic");

  return (
    <InlineConversationStatusRow
      icon={<PersonalityChangedIcon className="h-[14px] w-[14px] shrink-0" />}
      message={t("localConversation.personalityChanged", { personality: personalityLabel })}
    />
  );
}

function RemoteTaskCreatedInlineStatus({
  item,
  onOpenRemoteTask,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "remoteTaskCreated" }>;
  onOpenRemoteTask: (taskId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const taskId = item.taskId.trim();
  if (taskId.length === 0) {
    return null;
  }

  const taskLinkToken = "__REMOTE_TASK_LINK__";
  const buttonLabel = t("localConversation.remoteTaskCreated.task");
  const messageTemplate = t("localConversation.remoteTaskCreated", { taskLink: taskLinkToken });
  const messageParts = messageTemplate.split(taskLinkToken);
  const message =
    messageParts.length === 2 ? (
      <>
        {messageParts[0]}
        <button
          type="button"
          className="cursor-interaction border-0 bg-transparent p-0 text-[var(--app-shell-accent)] outline-none hover:underline"
          onClick={() => onOpenRemoteTask(taskId)}
        >
          {buttonLabel}
        </button>
        {messageParts[1]}
      </>
    ) : (
      t("localConversation.remoteTaskCreated", { taskLink: buttonLabel })
    );

  return (
    <InlineConversationStatusRow
      icon={<CloudTaskIcon className="h-[14px] w-[14px] shrink-0" />}
      message={message}
    />
  );
}

function ForkedConversationInlineStatus({
  item,
  onSelectThread,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "forkedFromConversation" }>;
  onSelectThread: (threadId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const sourceConversationId = item.sourceConversationId.trim();
  if (sourceConversationId.length === 0) {
    return null;
  }

  return (
    <div className="app-text-muted my-2 flex items-center gap-2 text-[13px]">
      <div className="min-w-0 flex-1 border-t border-current/20" />
      <div className="flex max-w-[70%] min-w-0 items-center gap-1 whitespace-nowrap">
        <ForkedConversationIcon className="h-[14px] w-[14px] shrink-0" />
        <button
          type="button"
          className="min-w-0 max-w-64 truncate text-left text-[var(--app-shell-accent)] hover:underline"
          onClick={() => onSelectThread(sourceConversationId)}
        >
          {t("localConversation.forkedFromConversation")}
        </button>
      </div>
      <div className="min-w-0 flex-1 border-t border-current/20" />
    </div>
  );
}

function InlineConversationStatusTooltip({
  ariaLabel,
  line1,
  line2,
}: {
  ariaLabel: string;
  line1: ReactNode;
  line2?: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      <button
        type="button"
        aria-label={ariaLabel}
        className="app-text-muted flex h-4 w-4 items-center justify-center rounded-full"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      <div className="absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-center text-[12px] leading-5 text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        <div>{line1}</div>
        {line2 != null ? <div className="mt-2">{line2}</div> : null}
      </div>
    </div>
  );
}

function buildExplorationCommandSummaries(
  item: Extract<ThreadConversationItem, { type: "commandExecution" }>,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const isInProgress = isCommandExecutionStillRunning(item);
  return getThreadCommandActions(item)
    .map((action) => {
      if (action.type === "read") {
        const fileName = getCommandActionDisplayName(action.path || action.name);
        if (fileName.length === 0) {
          return null;
        }
        return {
          isInProgress,
          text: t(
            isInProgress ? "avatarOverlay.session.readingFile" : "avatarOverlay.session.readFile",
            { fileName },
          ),
        };
      }
      if (action.type === "listFiles") {
        return {
          isInProgress,
          text: t(
            isInProgress ? "avatarOverlay.session.listingFiles" : "avatarOverlay.session.listedFiles",
          ),
        };
      }
      if (action.type === "search") {
        const query = action.query?.trim() ?? "";
        if (query.length > 0) {
          return {
            isInProgress,
            text: t(
              isInProgress
                ? "avatarOverlay.session.searchingQuery"
                : "avatarOverlay.session.searchedQuery",
              { query },
            ),
          };
        }
        return {
          isInProgress,
          text: t(
            isInProgress
              ? "avatarOverlay.session.searchingFiles"
              : "avatarOverlay.session.searchedFiles",
          ),
        };
      }
      return null;
    })
    .filter((summary): summary is { isInProgress: boolean; text: string } => summary !== null);
}

function getCommandActionDisplayName(path: string) {
  const normalizedPath = path.trim().replaceAll("\\", "/");
  if (normalizedPath.length === 0) {
    return "";
  }
  return normalizedPath.split("/").filter((segment) => segment.length > 0).at(-1) ?? normalizedPath;
}

function isCommandExecutionStillRunning(item: Extract<ThreadConversationItem, { type: "commandExecution" }>) {
  const normalizedStatus = item.status.trim().toLowerCase();
  if (normalizedStatus === "inprogress" || normalizedStatus === "pending") {
    return true;
  }
  return item.exitCode === null && normalizedStatus !== "completed" && normalizedStatus !== "interrupted";
}

function getThreadCommandActions(item: Extract<ThreadConversationItem, { type: "commandExecution" }>) {
  return Array.isArray(item.commandActions) ? item.commandActions : [];
}

function resolveAutomaticApprovalReviewTitle(
  item: Extract<ThreadConversationItem, { type: "automaticApprovalReview" }>,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (item.status) {
    case "inProgress":
      return t("localConversation.automaticApprovalReview.title.inProgress");
    case "approved":
      return t("localConversation.automaticApprovalReview.title.approved");
    case "denied":
      return item.riskLevel === "high"
        ? t("localConversation.automaticApprovalReview.title.deniedHighRisk")
        : t("localConversation.automaticApprovalReview.title.denied");
    case "timedOut":
      return t("localConversation.automaticApprovalReview.title.timedOut");
    case "aborted":
      return t("localConversation.automaticApprovalReview.title.aborted");
    default:
      return item.status;
  }
}

function resolveAutomaticApprovalReviewSummary(
  item: Extract<ThreadConversationItem, { type: "automaticApprovalReview" }>,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const rationale = item.rationale?.trim() ?? "";
  if (rationale.length > 0) {
    return rationale;
  }
  if (item.status === "inProgress") {
    return t("localConversation.automaticApprovalReview.summary.inProgress");
  }
  if (item.status === "aborted") {
    return t("localConversation.automaticApprovalReview.summary.aborted");
  }
  if (item.status === "timedOut") {
    return t("localConversation.automaticApprovalReview.summary.timedOut");
  }
  return t("localConversation.automaticApprovalReview.summary.completed");
}

function renderModelReroutedWarningLine2(template: string) {
  const match = template.match(/^(.*)<link>(.*)<\/link>(.*)$/);
  if (!match) {
    return template;
  }

  const [, prefix, linkText, suffix] = match;
  return [
    prefix,
    <a
      key="cyber-link"
      href="https://chatgpt.com/cyber"
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:no-underline"
    >
      {linkText}
    </a>,
    suffix,
  ];
}

function resolveWebSearchSummaryDetails(item: Extract<ThreadConversationItem, { type: "webSearch" }>) {
  if (item.action?.type === "search") {
    const query = item.action.query?.trim();
    if (query) {
      return query;
    }
    const queries = item.action.queries?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? [];
    if (queries.length > 0) {
      return queries.length > 1 ? `${queries[0]} ...` : queries[0];
    }
  }

  if (item.action?.type === "openPage") {
    return item.action.url?.trim() ?? "";
  }

  if (item.action?.type === "findInPage") {
    const pattern = item.action.pattern?.trim() ?? "";
    const url = item.action.url?.trim() ?? "";
    if (pattern && url) {
      return `'${pattern}' in ${url}`;
    }
    if (pattern) {
      return pattern;
    }
    if (url) {
      return url;
    }
  }

  return item.query.trim();
}

const dynamicToolCallCompletedLabels: Record<string, string> = {
  load_workspace_dependencies: "Loaded workspace dependencies",
  read_thread_terminal: "Read thread terminal",
};

const dynamicToolCallInProgressLabels: Record<string, string> = {
  load_workspace_dependencies: "Loading workspace dependencies",
  read_thread_terminal: "Reading thread terminal",
};

const appControlToolCallInProgressLabelKeys = {
  "app.help": "localConversation.appControlToolCall.appHelp.active",
  "threads.create": "localConversation.appControlToolCall.threadsCreate.active",
  "threads.create_in_worktree": "localConversation.appControlToolCall.threadsCreateInWorktree.active",
  "threads.list": "localConversation.appControlToolCall.threadsList.active",
  "threads.read": "localConversation.appControlToolCall.threadsRead.active",
  "threads.send_message": "localConversation.appControlToolCall.threadsSendMessage.active",
  "threads.set_archived": "localConversation.appControlToolCall.threadsSetArchived.active",
  "threads.set_pinned": "localConversation.appControlToolCall.threadsSetPinned.active",
  "threads.set_title": "localConversation.appControlToolCall.threadsSetTitle.active",
} as const satisfies Record<string, MessageKey>;

const appControlToolCallCompletedLabelKeys = {
  "app.help": "localConversation.appControlToolCall.appHelp.completed",
  "threads.create": "localConversation.appControlToolCall.threadsCreate.completed",
  "threads.create_in_worktree": "localConversation.appControlToolCall.threadsCreateInWorktree.completed",
  "threads.list": "localConversation.appControlToolCall.threadsList.completed",
  "threads.read": "localConversation.appControlToolCall.threadsRead.completed",
  "threads.send_message": "localConversation.appControlToolCall.threadsSendMessage.completed",
  "threads.set_archived": "localConversation.appControlToolCall.threadsSetArchived.completed",
  "threads.set_pinned": "localConversation.appControlToolCall.threadsSetPinned.completed",
  "threads.set_title": "localConversation.appControlToolCall.threadsSetTitle.completed",
} as const satisfies Record<string, MessageKey>;

type AppControlToolCallType = keyof typeof appControlToolCallInProgressLabelKeys;

function normalizeAutomationUpdateModeLabel(mode: "view" | "create" | "update" | "delete" | "suggested_create" | "suggested_update" | undefined) {
  switch (mode) {
    case "create":
    case "suggested_create":
      return "create";
    case "update":
    case "suggested_update":
      return "update";
    case "delete":
      return "delete";
    case "view":
      return "view";
    default:
      return null;
  }
}

function resolveDynamicToolCallLabel(toolName: string, isCompleted: boolean) {
  const mappedLabel = isCompleted
    ? dynamicToolCallCompletedLabels[toolName]
    : dynamicToolCallInProgressLabels[toolName];
  if (mappedLabel) {
    return mappedLabel;
  }

  const normalizedToolName = toolName
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .trim();
  return normalizedToolName.replaceAll(/\b\w/g, (character) => character.toUpperCase());
}

function resolveDynamicToolCallSummary(
  item: Extract<ThreadConversationItem, { type: "dynamicToolCall" }>,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const appControlMessageKey = resolveAppControlToolCallMessageKey(item);
  const isInProgress = item.status === "inProgress";

  if (appControlMessageKey !== null) {
    return {
      icon: <CopyPathIcon className="h-3.5 w-3.5 shrink-0" />,
      isInProgress,
      message: t(appControlMessageKey),
    };
  }

  const label = resolveDynamicToolCallLabel(item.tool, !isInProgress);
  return {
    icon: undefined,
    isInProgress,
    message: t("localConversation.dynamicToolCall", { toolName: label }),
  };
}

function resolveAppControlToolCallMessageKey(
  item: Extract<ThreadConversationItem, { type: "dynamicToolCall" }>,
): MessageKey | null {
  if (item.tool !== "manage_codex_threads" || !item.arguments || typeof item.arguments !== "object") {
    return null;
  }

  const typeValue = "type" in item.arguments ? item.arguments.type : null;
  if (!isAppControlToolCallType(typeValue)) {
    return null;
  }

  return item.status === "inProgress"
    ? appControlToolCallInProgressLabelKeys[typeValue] ?? null
    : appControlToolCallCompletedLabelKeys[typeValue] ?? null;
}

function isAppControlToolCallType(value: unknown): value is AppControlToolCallType {
  return typeof value === "string" && value in appControlToolCallInProgressLabelKeys;
}

function todoListStepCheckmark(status: string) {
  return status === "completed" ? "x" : " ";
}

function FileChangeCard({
  change,
  t,
}: {
  change: { path: string; kind: string; diff: string | null; movePath: string | null };
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card-muted rounded-[14px] px-4 py-3">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="app-control rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
          {change.kind}
        </span>
        <span className="min-w-0 break-all">{change.path}</span>
      </div>
      {change.movePath ? (
        <div className="app-text-muted mt-2 text-[12px]">
          {t("app.chat.movedTo")}: {change.movePath}
        </div>
      ) : null}
      {change.diff ? (
        <pre className="app-text-muted mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[12px] leading-6">
          {change.diff}
        </pre>
      ) : null}
    </div>
  );
}

function CommandActionCard({
  action,
  t,
}: {
  action: CommandAction;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const label = resolveCommandActionBadgeLabel(action, t);

  return (
    <div className="app-card-muted rounded-[14px] px-4 py-3">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="app-control rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
          {label}
        </span>
        <span className="min-w-0 break-all">{action.command}</span>
      </div>
      {"path" in action && action.path ? (
        <div className="app-text-muted mt-2 break-all text-[12px] leading-5">
          {t("app.chat.approval.workingDirectory")}: {action.path}
        </div>
      ) : null}
      {"name" in action ? (
        <div className="app-text-muted mt-2 break-all text-[12px] leading-5">
          {action.name}
        </div>
      ) : null}
      {"query" in action && action.query ? (
        <div className="app-text-muted mt-2 break-all text-[12px] leading-5">
          {action.query}
        </div>
      ) : null}
    </div>
  );
}

function resolveCommandActionBadgeLabel(
  action: CommandAction,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (action.type) {
    case "read": {
      const fileName = getCommandActionDisplayName(action.path || action.name);
      return fileName.length > 0
        ? t("avatarOverlay.session.readingFile", { fileName })
        : action.type;
    }
    case "listFiles":
      return t("avatarOverlay.session.listingFiles");
    case "search": {
      const query = action.query?.trim() ?? "";
      return query.length > 0
        ? t("avatarOverlay.session.searchingQuery", { query })
        : t("avatarOverlay.session.searchingFiles");
    }
    case "unknown":
      return action.type;
  }
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const labelKey = statusLabelKeys[status] ?? "app.chat.status.inProgress";
  return (
    <span className="app-badge rounded-full px-2.5 py-1 text-[11px]">
      {t(labelKey)}
    </span>
  );
}

function normalizeHookStatus(status: string) {
  if (status === "completed" || status === "failed") {
    return status;
  }
  if (status === "running") {
    return "inProgress";
  }
  if (status === "blocked" || status === "stopped") {
    return "declined";
  }
  return "inProgress";
}

function resolveHookEventNameKey(eventName: string): MessageKey {
  switch (eventName) {
    case "preToolUse":
      return "localConversation.hookItem.eventName.preToolUse";
    case "permissionRequest":
      return "localConversation.hookItem.eventName.permissionRequest";
    case "postToolUse":
      return "localConversation.hookItem.eventName.postToolUse";
    case "sessionStart":
      return "localConversation.hookItem.eventName.sessionStart";
    case "userPromptSubmit":
      return "localConversation.hookItem.eventName.userPromptSubmit";
    case "stop":
      return "localConversation.hookItem.eventName.stop";
    default:
      return "localConversation.hookItem.eventName.stop";
  }
}

function resolveHookEntryLabel(kind: string, t: (key: MessageKey, values?: Record<string, number | string>) => string) {
  switch (kind) {
    case "feedback":
      return t("localConversation.hookItem.feedback");
    case "warning":
      return t("localConversation.hookItem.warning");
    case "error":
      return t("localConversation.hookItem.error");
    case "context":
      return t("localConversation.hookItem.hookContext");
    case "stop":
      return t("localConversation.hookItem.stop");
    default:
      return kind;
  }
}

function LabeledValue({
  label,
  value,
  className = "",
  mono = false,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={className}>
      <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">{label}</div>
      <div
        className={[
          "mt-1 break-all text-[13px] leading-6",
          mono ? "app-code-block whitespace-pre-wrap rounded-[14px] px-4 py-3 font-mono text-[12px]" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function ToolRequestUserInputCard({
  request,
  isResponding,
  requestError,
  onSubmit,
  t,
}: {
  request: PendingToolRequestUserInput;
  isResponding: boolean;
  requestError: string | null;
  onSubmit: (request: PendingToolRequestUserInput, values: Record<string, string>) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.questions.map((question) => [question.id, ""])),
  );

  useEffect(() => {
    setValues((current) => {
      const next = { ...current };
      for (const question of request.questions) {
        if (!(question.id in next)) {
          next[question.id] = "";
        }
      }
      return next;
    });
  }, [request]);

  return (
    <div className="app-card-warning rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-medium">{t("app.chat.userInput.title")}</div>
        <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.review")}</div>
      </div>
      <div className="mt-3 space-y-4">
        {request.questions.map((question) => (
          <ToolRequestUserInputQuestionField
            key={`${request.itemId}:${question.id}`}
            question={question}
            value={values[question.id] ?? ""}
            disabled={isResponding}
            t={t}
            onChange={(value) =>
              setValues((current) => ({
                ...current,
                [question.id]: value,
              }))
            }
          />
        ))}
      </div>
      {requestError ? <div className="app-text-error mt-3 text-[12px]">{requestError}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, values)}
          className="app-approval-button-primary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.userInput.submit")}
        </button>
        {isResponding ? (
          <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.submitting")}</div>
        ) : null}
      </div>
    </div>
  );
}

function McpServerElicitationConversationItemCard({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "mcpServerElicitation" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const serverTitle = item.serverName.trim().length > 0 ? item.serverName : "MCP";

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">{t("app.chat.mcpElicitation.title", { serverName: serverTitle })}</div>
        <StatusBadge status={item.completed ? "completed" : "inProgress"} t={t} />
      </div>
      <div className="mt-3 text-[13px] leading-6 whitespace-pre-wrap">{item.request.message}</div>
      {item.request.mode === "url" ? (
        <LabeledValue label={t("app.chat.mcpElicitation.url")} value={item.request.url} className="mt-3" />
      ) : (
        <div className="app-text-muted mt-3 text-[12px] leading-5">
          {Object.keys(item.request.requestedSchema.properties ?? {}).length} fields requested
        </div>
      )}
      {item.completed ? (
        <div className="app-text-muted mt-3 text-[12px] leading-5">
          Action: {item.action ?? "none"}
        </div>
      ) : null}
    </div>
  );
}

type McpElicitationFieldValue = string | boolean | null;

function McpServerElicitationRequestCard({
  request,
  isResponding,
  requestError,
  onSubmit,
  t,
}: {
  request: PendingMcpServerElicitationRequest;
  isResponding: boolean;
  requestError: string | null;
  onSubmit: (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, McpElicitationFieldValue>>({});

  useEffect(() => {
    const formRequest = request.request;
    if (formRequest.mode !== "form") {
      setFieldValues({});
      return;
    }
    setFieldValues((current) => {
      const next: Record<string, McpElicitationFieldValue> = {};
      for (const [fieldKey, rawSchema] of Object.entries(formRequest.requestedSchema.properties ?? {})) {
        const schema = normalizeMcpElicitationFieldSchema(rawSchema);
        if (!schema) {
          next[fieldKey] = current[fieldKey] ?? null;
          continue;
        }
        if (schema.kind === "boolean") {
          next[fieldKey] =
            typeof current[fieldKey] === "boolean" ? current[fieldKey] : (schema.defaultValue ?? false);
          continue;
        }
        if (schema.kind === "enum") {
          next[fieldKey] =
            typeof current[fieldKey] === "string"
              ? current[fieldKey]
              : (schema.defaultValue ?? schema.options[0]?.value ?? "");
          continue;
        }
        if (schema.kind === "string") {
          next[fieldKey] =
            typeof current[fieldKey] === "string" ? current[fieldKey] : (schema.defaultValue ?? "");
          continue;
        }
        next[fieldKey] = current[fieldKey] ?? null;
      }
      return next;
    });
  }, [request]);

  const serverTitle = request.serverName.trim().length > 0 ? request.serverName : "MCP";

  if (request.request.mode === "url") {
    return (
      <div className="app-card-warning rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium">{t("app.chat.mcpElicitation.title", { serverName: serverTitle })}</div>
          <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.review")}</div>
        </div>
        <div className="mt-3 text-[13px] leading-6 whitespace-pre-wrap">{request.request.message}</div>
        <LabeledValue label={t("app.chat.mcpElicitation.url")} value={request.request.url} className="mt-3" />
        {requestError ? <div className="app-text-error mt-3 text-[12px]">{requestError}</div> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isResponding}
            onClick={() => onSubmit(request, "accept", null)}
            className="app-approval-button-primary rounded-full border px-3 py-1.5 text-[12px]"
          >
            {t("app.chat.mcpElicitation.accept")}
          </button>
          <button
            type="button"
            disabled={isResponding}
            onClick={() => onSubmit(request, "decline", null)}
            className="app-approval-button-secondary rounded-full border px-3 py-1.5 text-[12px]"
          >
            {t("app.chat.mcpElicitation.decline")}
          </button>
          <button
            type="button"
            disabled={isResponding}
            onClick={() => onSubmit(request, "cancel", null)}
            className="app-approval-button-tertiary rounded-full border px-3 py-1.5 text-[12px]"
          >
            {t("app.chat.mcpElicitation.cancel")}
          </button>
          {isResponding ? (
            <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.submitting")}</div>
          ) : null}
        </div>
      </div>
    );
  }

  const schemaProperties = Object.entries(request.request.requestedSchema.properties ?? {});
  const requiredFields = new Set(request.request.requestedSchema.required ?? []);

  return (
    <div className="app-card-warning rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-medium">{t("app.chat.mcpElicitation.title", { serverName: serverTitle })}</div>
        <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.review")}</div>
      </div>
      <div className="mt-3 text-[13px] leading-6 whitespace-pre-wrap">{request.request.message}</div>
      <div className="mt-4 space-y-4">
        {schemaProperties.map(([fieldKey, rawSchema]) => (
          <McpServerElicitationField
            key={`${request.serverName}:${fieldKey}`}
            fieldKey={fieldKey}
            rawSchema={rawSchema}
            value={fieldValues[fieldKey] ?? null}
            required={requiredFields.has(fieldKey)}
            disabled={isResponding}
            t={t}
            onChange={(value) =>
              setFieldValues((current) => ({
                ...current,
                [fieldKey]: value,
              }))
            }
          />
        ))}
      </div>
      {requestError ? <div className="app-text-error mt-3 text-[12px]">{requestError}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isResponding}
          onClick={() =>
            onSubmit(
              request,
              "accept",
              request.request.mode === "form"
                ? buildMcpElicitationContent(request.request, fieldValues)
                : null,
            )
          }
          className="app-approval-button-primary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.mcpElicitation.submit")}
        </button>
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, "decline", null)}
          className="app-approval-button-secondary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.mcpElicitation.decline")}
        </button>
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, "cancel", null)}
          className="app-approval-button-tertiary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.mcpElicitation.cancel")}
        </button>
        {isResponding ? (
          <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.submitting")}</div>
        ) : null}
      </div>
    </div>
  );
}

function McpServerElicitationField({
  fieldKey,
  rawSchema,
  value,
  required,
  disabled,
  t,
  onChange,
}: {
  fieldKey: string;
  rawSchema: unknown;
  value: McpElicitationFieldValue;
  required: boolean;
  disabled: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  onChange: (value: McpElicitationFieldValue) => void;
}) {
  const schema = normalizeMcpElicitationFieldSchema(rawSchema);
  const label = schema?.title || fieldKey;
  const description = schema?.description ?? null;
  const requiredLabel = required ? ` (${t("app.chat.mcpElicitation.required")})` : "";

  if (!schema) {
    return (
      <div className="space-y-2">
        <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
          {label}
          {requiredLabel}
        </div>
        {description ? <div className="text-[13px] leading-6">{description}</div> : null}
        <pre className="app-code-block rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
          {JSON.stringify(rawSchema, null, 2)}
        </pre>
        <div className="app-text-muted text-[12px] leading-5">{t("app.chat.mcpElicitation.unsupportedField")}</div>
      </div>
    );
  }

  if (schema.kind === "boolean") {
    return (
      <div className="space-y-2">
        <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
          {label}
          {requiredLabel}
        </div>
        {description ? <div className="text-[13px] leading-6">{description}</div> : null}
        <label className="app-card-muted flex items-center gap-2 rounded-[14px] px-4 py-3 text-[13px]">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{t("app.chat.mcpElicitation.booleanEnabled")}</span>
        </label>
      </div>
    );
  }

  if (schema.kind === "enum") {
    return (
      <div className="space-y-2">
        <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
          {label}
          {requiredLabel}
        </div>
        {description ? <div className="text-[13px] leading-6">{description}</div> : null}
        <div className="space-y-2">
          {schema.options.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={`${fieldKey}:${option.value}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={[
                  "w-full rounded-[14px] border px-3 py-2 text-left",
                  isSelected ? "app-nav-item-active" : "app-card-muted",
                ].join(" ")}
              >
                <div className="text-[13px] font-medium">{option.label}</div>
                {option.description ? (
                  <div className="app-text-muted mt-1 text-[12px] leading-5">{option.description}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (schema.kind === "string") {
    return (
      <div className="space-y-2">
        <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
          {label}
          {requiredLabel}
        </div>
        {description ? <div className="text-[13px] leading-6">{description}</div> : null}
        <textarea
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className="app-text-input min-h-[84px] w-full resize-y text-[13px] leading-6 outline-none"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
        {label}
        {requiredLabel}
      </div>
      {description ? <div className="text-[13px] leading-6">{description}</div> : null}
      <pre className="app-code-block rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
        {JSON.stringify(rawSchema, null, 2)}
      </pre>
      <div className="app-text-muted text-[12px] leading-5">{t("app.chat.mcpElicitation.unsupportedField")}</div>
    </div>
  );
}

function ToolRequestUserInputQuestionField({
  question,
  value,
  disabled,
  t,
  onChange,
}: {
  question: ToolRequestUserInputQuestion;
  value: string;
  disabled: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  onChange: (value: string) => void;
}) {
  const hasOptions = question.options !== null && question.options.length > 0;
  const showManualInput = !hasOptions || question.isOther;
  return (
    <div className="space-y-2">
      <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
        {question.header || question.id}
      </div>
      <div className="text-[13px] leading-6">{question.question}</div>
      {hasOptions ? (
        <div className="space-y-2">
          {question.options?.map((option) => {
            const isSelected = value === option.label;
            return (
              <button
                key={`${question.id}:${option.label}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.label)}
                className={[
                  "w-full rounded-[14px] border px-3 py-2 text-left",
                  isSelected ? "app-nav-item-active" : "app-card-muted",
                ].join(" ")}
              >
                <div className="text-[13px] font-medium">{option.label}</div>
                <div className="app-text-muted mt-1 text-[12px] leading-5">{option.description}</div>
              </button>
            );
          })}
        </div>
      ) : null}
      {showManualInput ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={3}
          className={[
            "app-text-input min-h-[84px] w-full resize-y text-[13px] leading-6 outline-none",
            question.isSecret ? "font-mono" : "",
          ].join(" ")}
          placeholder={question.isOther ? "Other" : ""}
        />
      ) : null}
      {question.isOther ? (
        <div className="app-text-muted text-[12px] leading-5">{t("app.chat.userInput.otherHint")}</div>
      ) : null}
      {question.isSecret ? (
        <div className="app-text-muted text-[12px] leading-5">{t("app.chat.userInput.secretHint")}</div>
      ) : null}
    </div>
  );
}

function UserInputConversationItemCard({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "userInput" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">{t("app.chat.userInput.title")}</div>
        <StatusBadge status={item.completed ? "completed" : "inProgress"} t={t} />
      </div>
      <div className="mt-3 space-y-3">
        {item.questions.map((question, index) => (
          <div key={`${item.id}:${question.id || index}`} className="app-card-muted rounded-[14px] px-4 py-3">
            <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
              {question.header || question.id || `Question ${index + 1}`}
            </div>
            <div className="mt-2 text-[13px] leading-6 whitespace-pre-wrap">{question.question}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsRequestApprovalCard({
  request,
  isResponding,
  requestError,
  onSubmit,
  t,
}: {
  request: PendingPermissionsRequestApproval;
  isResponding: boolean;
  requestError: string | null;
  onSubmit: (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [strictAutoReview, setStrictAutoReview] = useState(false);

  return (
    <div className="app-card-warning rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-medium">{t("app.chat.permissions.title")}</div>
        <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.review")}</div>
      </div>
      {request.reason ? (
        <LabeledValue label={t("app.chat.approval.reason")} value={request.reason} className="mt-3" />
      ) : null}
      <LabeledValue label={t("app.chat.approval.workingDirectory")} value={request.cwd} className="mt-3" />
      {request.permissions.network?.enabled ? (
        <div className="mt-3">
          <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
            {t("app.chat.permissions.network")}
          </div>
          <div className="mt-1 text-[13px] leading-6">{t("app.chat.permissions.networkEnabled")}</div>
        </div>
      ) : null}
      {request.permissions.fileSystem ? (
        <div className="mt-3">
          <div className="app-text-subtle text-[12px] font-medium tracking-[0.08em]">
            {t("app.chat.permissions.fileSystem")}
          </div>
          <div className="mt-2 space-y-2">
            {renderPermissionPathBlock(
              t("app.chat.permissions.read"),
              request.permissions.fileSystem.read ?? [],
            )}
            {renderPermissionPathBlock(
              t("app.chat.permissions.write"),
              request.permissions.fileSystem.write ?? [],
            )}
            {request.permissions.fileSystem.entries && request.permissions.fileSystem.entries.length > 0 ? (
              <div className="app-card-muted rounded-[14px] px-4 py-3">
                <div className="text-[12px] font-medium tracking-[0.08em]">
                  {t("app.chat.permissions.entries")}
                </div>
                <div className="mt-2 space-y-1">
                  {request.permissions.fileSystem.entries.map((entry, index) => (
                    <div key={`${entry.access}:${entry.path}:${index}`} className="text-[12px] leading-5">
                      {entry.access}: {entry.path}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <label className="mt-4 flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={strictAutoReview}
          disabled={isResponding}
          onChange={(event) => setStrictAutoReview(event.target.checked)}
        />
        <span>{t("app.chat.permissions.strictAutoReview")}</span>
      </label>
      {requestError ? <div className="app-text-error mt-3 text-[12px]">{requestError}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, "turn", strictAutoReview)}
          className="app-approval-button-primary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.permissions.grantTurn")}
        </button>
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, "session", strictAutoReview)}
          className="app-approval-button-secondary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.permissions.grantSession")}
        </button>
        <button
          type="button"
          disabled={isResponding}
          onClick={() => onSubmit(request, "deny", false)}
          className="app-approval-button-tertiary rounded-full border px-3 py-1.5 text-[12px]"
        >
          {t("app.chat.permissions.deny")}
        </button>
        {isResponding ? (
          <div className="app-text-warning-muted text-[12px]">{t("app.chat.approval.submitting")}</div>
        ) : null}
      </div>
    </div>
  );
}

function PermissionRequestConversationItemCard({
  item,
  t,
}: {
  item: Extract<ThreadConversationItem, { type: "permissionRequest" }>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">{t("app.chat.permissions.title")}</div>
        <StatusBadge status={item.completed ? "completed" : "inProgress"} t={t} />
      </div>
      {item.reason ? (
        <LabeledValue label={t("app.chat.approval.reason")} value={item.reason} className="mt-3" />
      ) : null}
      <LabeledValue label={t("app.chat.approval.workingDirectory")} value={item.cwd} className="mt-3" />
      {item.completed ? (
        <div className="app-text-muted mt-3 text-[12px] leading-5">
          Scope: {item.response?.scope ?? "none"}
        </div>
      ) : null}
    </div>
  );
}

function renderPermissionPathBlock(label: string, paths: string[]) {
  if (paths.length === 0) {
    return null;
  }
  return (
    <div className="app-card-muted rounded-[14px] px-4 py-3">
      <div className="text-[12px] font-medium tracking-[0.08em]">{label}</div>
      <div className="mt-2 space-y-1">
        {paths.map((path) => (
          <div key={`${label}:${path}`} className="break-all text-[12px] leading-5">
            {path}
          </div>
        ))}
      </div>
    </div>
  );
}

export function selectComposerFooterPendingRequest({
  approvals,
  implementPlanRequests,
  mcpRequests,
  permissionsRequests,
  turnIds,
  userInputRequests,
}: {
  approvals: PendingApproval[];
  implementPlanRequests: PendingImplementPlanRequest[];
  mcpRequests: PendingMcpServerElicitationRequest[];
  permissionsRequests: PendingPermissionsRequestApproval[];
  turnIds: string[];
  userInputRequests: PendingToolRequestUserInput[];
}): CurrentPendingRequest | null {
  const currentPendingRequest = selectCurrentPendingRequest({
    approvals,
    implementPlanRequests,
    mcpRequests,
    permissionsRequests,
    turnIds,
    userInputRequests,
  });

  if (!currentPendingRequest) {
    return null;
  }

  if (currentPendingRequest.type === "mcpServerElicitation" && currentPendingRequest.request.turnId !== null) {
    return null;
  }

  return currentPendingRequest;
}

function selectCurrentPendingRequest({
  approvals,
  implementPlanRequests,
  mcpRequests,
  permissionsRequests,
  turnIds,
  userInputRequests,
}: {
  approvals: PendingApproval[];
  implementPlanRequests: PendingImplementPlanRequest[];
  mcpRequests: PendingMcpServerElicitationRequest[];
  permissionsRequests: PendingPermissionsRequestApproval[];
  turnIds: string[];
  userInputRequests: PendingToolRequestUserInput[];
}): CurrentPendingRequest | null {
  for (let index = turnIds.length - 1; index >= 0; index -= 1) {
    const turnId = turnIds[index];
    const userInputRequest = findLatestPendingRequestForTurnId(userInputRequests, turnId);
    if (userInputRequest) {
      return {
        type: "userInput",
        request: userInputRequest,
      };
    }

    const approval = findLatestPendingRequestForTurnId(approvals, turnId);
    if (approval) {
      return {
        type: "approval",
        request: approval,
      };
    }

    const permissionsRequest = findLatestPendingRequestForTurnId(permissionsRequests, turnId);
    if (permissionsRequest) {
      return {
        type: "permissionRequest",
        request: permissionsRequest,
      };
    }

    const mcpRequest = findLatestPendingRequestForTurnId(mcpRequests, turnId);
    if (mcpRequest) {
      return {
        type: "mcpServerElicitation",
        request: mcpRequest,
      };
    }

    const implementPlanRequest = findLatestPendingRequestForTurnId(implementPlanRequests, turnId);
    if (implementPlanRequest) {
      return {
        type: "implementPlan",
        request: implementPlanRequest,
      };
    }
  }

  const turnlessMcpRequest = findLatestPendingRequestForTurnId(mcpRequests, null);
  if (!turnlessMcpRequest) {
    return null;
  }

  return {
    type: "mcpServerElicitation",
    request: turnlessMcpRequest,
  };
}

export function filterPendingRequestsForConversationBody<
  T extends
    | PendingApproval
    | PendingMcpServerElicitationRequest
    | PendingPermissionsRequestApproval
    | PendingToolRequestUserInput,
>(requests: T[], footerPendingRequest: CurrentPendingRequest | null) {
  if (!footerPendingRequest) {
    return requests;
  }

  switch (footerPendingRequest.type) {
    case "approval":
      return footerPendingRequest.request.type === "commandApprovalRequested" ||
        footerPendingRequest.request.type === "fileChangeApprovalRequested"
        ? requests.filter((request) => approvalRequestKey(request.requestId) !== approvalRequestKey(footerPendingRequest.request.requestId))
        : requests;
    case "mcpServerElicitation":
      return "serverName" in footerPendingRequest.request
        ? requests.filter((request) => approvalRequestKey(request.requestId) !== approvalRequestKey(footerPendingRequest.request.requestId))
        : requests;
    case "permissionRequest":
      return "permissions" in footerPendingRequest.request
        ? requests.filter((request) => approvalRequestKey(request.requestId) !== approvalRequestKey(footerPendingRequest.request.requestId))
        : requests;
    case "userInput":
      return "questions" in footerPendingRequest.request
        ? requests.filter((request) => approvalRequestKey(request.requestId) !== approvalRequestKey(footerPendingRequest.request.requestId))
        : requests;
    case "implementPlan":
      return requests;
  }
}

function findLatestPendingRequestForTurnId<T extends { turnId: string | null }>(
  requests: T[],
  turnId: string | null,
) {
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const request = requests[index];
    if (request.turnId === turnId) {
      return request;
    }
  }
  return null;
}

type NormalizedMcpFieldSchema =
  | {
      kind: "string";
      title: string | null;
      description: string | null;
      defaultValue: string | null;
    }
  | {
      kind: "boolean";
      title: string | null;
      description: string | null;
      defaultValue: boolean | null;
    }
  | {
      kind: "enum";
      title: string | null;
      description: string | null;
      defaultValue: string | null;
      options: Array<{
        value: string;
        label: string;
        description: string | null;
      }>;
    }
  | {
      kind: "unsupported";
      title: string | null;
      description: string | null;
    };

function normalizeMcpElicitationFieldSchema(rawSchema: unknown): NormalizedMcpFieldSchema | null {
  if (!rawSchema || typeof rawSchema !== "object") {
    return null;
  }
  const schema = rawSchema as Record<string, unknown>;
  const title = typeof schema.title === "string" ? schema.title : null;
  const description = typeof schema.description === "string" ? schema.description : null;
  if (schema.type === "string") {
    const enumValues = Array.isArray(schema.enum)
      ? schema.enum.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (enumValues.length > 0) {
      const enumNames = Array.isArray(schema.enumNames)
        ? schema.enumNames.filter((entry): entry is string => typeof entry === "string")
        : [];
      return {
        kind: "enum",
        title,
        description,
        defaultValue: typeof schema.default === "string" ? schema.default : null,
        options: enumValues.map((value, index) => ({
          value,
          label: enumNames[index] ?? value,
          description: null,
        })),
      };
    }
    if ("items" in schema) {
      return { kind: "unsupported", title, description };
    }
    return {
      kind: "string",
      title,
      description,
      defaultValue: typeof schema.default === "string" ? schema.default : null,
    };
  }
  if (schema.type === "boolean") {
    return {
      kind: "boolean",
      title,
      description,
      defaultValue: typeof schema.default === "boolean" ? schema.default : null,
    };
  }
  return { kind: "unsupported", title, description };
}

function buildMcpElicitationContent(
  request: Extract<McpServerElicitationRequest, { mode: "form" }>,
  fieldValues: Record<string, McpElicitationFieldValue>,
) {
  const content: Record<string, unknown> = {};
  for (const [fieldKey, rawSchema] of Object.entries(request.requestedSchema.properties ?? {})) {
    const schema = normalizeMcpElicitationFieldSchema(rawSchema);
    const value = fieldValues[fieldKey];
    if (!schema || schema.kind === "unsupported") {
      continue;
    }
    if (schema.kind === "boolean") {
      if (typeof value === "boolean") {
        content[fieldKey] = value;
      }
      continue;
    }
    if (typeof value === "string") {
      content[fieldKey] = value;
    }
  }
  return content;
}
