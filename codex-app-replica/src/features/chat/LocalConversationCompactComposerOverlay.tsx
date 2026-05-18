import { useEffect, useMemo, useRef } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import type { ApprovalDecision, ThreadConversation } from "../../services/history";
import type { ComposerEnterBehavior, ConfigSnapshot, FollowUpQueueMode, ReviewDelivery } from "../../services/settings";
import { LatestTurnPreview } from "./LatestTurnPreview";
import {
  ComposerFooterPendingRequest,
  ConversationGroupContent,
  selectComposerFooterPendingRequest,
} from "./ChatConversationMainPane";
import { ThreadComposer } from "./ThreadComposer";
import { buildRenderableConversationGroups } from "./renderableConversationGroups";
import type { HotkeyPermissionAgentMode, HotkeyPermissionsState } from "../hotkeyWindow/hotkeyPermissionsMode";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";
import type {
  PendingApproval,
  PendingImplementPlanRequest,
  PendingMcpServerElicitationRequest,
  PendingPermissionsRequestApproval,
  PendingToolRequestUserInput,
} from "./threadConversationState";

type LocalConversationCompactComposerOverlayProps = {
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  composerFocusNonce?: number | null;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  followUpQueueMode: FollowUpQueueMode;
  isResponseInProgress?: boolean;
  isWorktreeThread: boolean;
  currentThreadApprovals?: PendingApproval[];
  currentThreadImplementPlanRequests?: PendingImplementPlanRequest[];
  currentThreadMcpServerElicitationRequest?: PendingMcpServerElicitationRequest[];
  currentThreadPermissionsRequestApproval?: PendingPermissionsRequestApproval[];
  currentThreadToolRequestUserInput?: PendingToolRequestUserInput[];
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
  onSelectThread: (threadId: string) => void;
  onEditUserMessage: (text: string) => void | Promise<void>;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  onShowToast?: (toast: AppToast) => void;
  approvalActionErrors: Record<string, string>;
  reviewDelivery: ReviewDelivery;
  respondingApprovalKeys: string[];
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadConversation: ThreadConversation | null;
  turnError: string | null;
  workspaceRoot?: string | null;
  conversationHostId?: string | null;
  authMethod?: string | null;
  activeCollaborationMode?: string | null;
};

const COMPACT_OVERLAY_HEIGHT_PX = 118;

export function LocalConversationCompactComposerOverlay({
  composerDraft,
  composerEnterBehavior,
  composerFocusNonce,
  composerPermissionConfig,
  composerPermissionMode,
  composerPermissionsState,
  followUpQueueMode,
  isResponseInProgress = false,
  isWorktreeThread,
  currentThreadApprovals = [],
  currentThreadImplementPlanRequests = [],
  currentThreadMcpServerElicitationRequest = [],
  currentThreadPermissionsRequestApproval = [],
  currentThreadToolRequestUserInput = [],
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
  onSelectThread,
  onEditUserMessage,
  onStopTurn,
  onSubmitTurn,
  onShowToast,
  approvalActionErrors,
  reviewDelivery,
  respondingApprovalKeys,
  submitButtonMode,
  t,
  threadConversation,
  turnError,
  workspaceRoot = null,
  conversationHostId = null,
  authMethod = null,
  activeCollaborationMode = null,
}: LocalConversationCompactComposerOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const userMessageSentAtMsByTurnId = useMemo(
    () =>
      new Map(
        (threadConversation?.turnTimings ?? []).map((timing) => [timing.turnId, timing.turnStartedAtMs ?? null]),
      ),
    [threadConversation?.turnTimings],
  );
  const conversationGroups = useMemo(
    () =>
      threadConversation
        ? buildRenderableConversationGroups(threadConversation.items, {
            turnTimings: threadConversation.turnTimings,
          })
        : [],
    [threadConversation],
  );
  const footerPendingRequest = selectComposerFooterPendingRequest({
    approvals: currentThreadApprovals,
    implementPlanRequests: currentThreadImplementPlanRequests,
    mcpRequests: currentThreadMcpServerElicitationRequest,
    permissionsRequests: currentThreadPermissionsRequestApproval,
    turnIds: conversationGroups.map((group) => group.turnId),
    userInputRequests: currentThreadToolRequestUserInput,
  });
  const latestConversationGroup = conversationGroups.at(-1) ?? null;
  const previewContent =
    latestConversationGroup && threadConversation
      ? (
          <ConversationGroupContent
            conversationId={threadConversation.id}
            conversationCwd={threadConversation.cwd}
            conversationHostId={conversationHostId}
            group={latestConversationGroup}
            approvalActionErrors={{}}
            onApprovalDecision={() => undefined}
            onEditUserMessage={onEditUserMessage}
            onMcpServerElicitationRequestSubmit={() => undefined}
            onOpenRemoteTask={onOpenRemoteTask}
            onSelectRemoteTaskAssistantTurn={onSelectRemoteTaskAssistantTurn}
            onPermissionsRequestApprovalSubmit={() => undefined}
            onSelectThread={onSelectThread}
            onToolRequestUserInputSubmit={() => undefined}
            planSummaryIsWriting={
              isResponseInProgress &&
              latestConversationGroup.assistantMessage === null
            }
            respondingApprovalKeys={[]}
            t={t}
            userMessageSentAtMsByTurnId={userMessageSentAtMsByTurnId}
          />
        )
      : null;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const documentStyle = document.documentElement.style;
    documentStyle.setProperty("--right-panel-composer-overlay-height", `${COMPACT_OVERLAY_HEIGHT_PX}px`);
    documentStyle.setProperty("--right-panel-composer-overlay-reserve", `${COMPACT_OVERLAY_HEIGHT_PX}px`);

    return () => {
      documentStyle.removeProperty("--right-panel-composer-overlay-height");
      documentStyle.removeProperty("--right-panel-composer-overlay-reserve");
    };
  }, []);

  if (threadConversation === null) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-6"
      data-testid="local-conversation-compact-composer-overlay"
    >
      <div className="mx-auto w-full max-w-[var(--thread-composer-max-width)]">
        <div className="pointer-events-auto flex flex-col gap-2">
          {latestConversationGroup ? (
            <LatestTurnPreview
              group={latestConversationGroup}
              isTurnInProgress={isResponseInProgress}
              previewContent={previewContent}
              t={t}
            />
          ) : null}
          {footerPendingRequest ? (
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
          ) : (
            <ThreadComposer
              activeCollaborationMode={activeCollaborationMode}
              composerDraft={composerDraft}
              composerEnterBehavior={composerEnterBehavior}
              conversationId={threadConversation.id}
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
              onOpenWorkspaceFileSearch={onOpenWorkspaceFileSearch ?? null}
              onStopTurn={onStopTurn}
              onSubmitTurn={onSubmitTurn}
              pendingPdfComments={currentThreadPendingPdfComments}
              pendingPdfCommentCount={currentThreadPendingPdfCommentCount}
              placement="main"
              reviewDelivery={reviewDelivery}
              submitButtonMode={submitButtonMode}
              t={t}
              authMethod={authMethod}
              latestTokenUsageInfo={threadConversation.latestTokenUsageInfo ?? null}
              threadGoal={threadConversation.threadGoal ?? null}
              threadCwd={threadConversation.cwd ?? workspaceRoot}
              turnError={turnError}
              onShowToast={onShowToast}
              onOpenSideChat={
                onOpenSideChat
                  ? (initialPrompt) => Promise.resolve(onOpenSideChat(initialPrompt)).then(() => true)
                  : null
              }
              layoutMode="auto-single-line"
            />
          )}
        </div>
      </div>
    </div>
  );
}
