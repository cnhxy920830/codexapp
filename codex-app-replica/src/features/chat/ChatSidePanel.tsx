import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary, ThreadConversationUserInputComment } from "../../services/history";
import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import { ChatConversationMainPane } from "./ChatConversationMainPane";
import type { AvatarOption } from "../../components/appearance/avatarData";
import type {
  ComposerEnterBehavior,
  ConfigSnapshot,
  FollowUpQueueMode,
  ReviewDelivery,
} from "../../services/settings";
import type {
  PendingApproval,
  PendingImplementPlanRequest,
  PendingMcpServerElicitationRequest,
  PendingPermissionsRequestApproval,
  PendingToolRequestUserInput,
} from "./threadConversationState";
import type { QueuedLocalFollowUp } from "./localFollowUpQueue";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";
import type { ThreadConversation } from "../../services/history";
import type { BrowserSidebarTarget } from "../../services/browserSidebar";
import { isWorkspaceFileRightPanelTab, type RightPanelTab } from "./rightPanelTabs";
import type { ThreadDiffSummary } from "./threadConversationState";
import { BrowserSidebarPanel } from "./BrowserSidebarPanel";
import { ReviewSidePanel } from "./ReviewSidePanel";
import { WorkspaceFilePreviewPanel } from "./WorkspaceFilePreviewPanel";
import type {
  HotkeyPermissionAgentMode,
  HotkeyPermissionsState,
} from "../hotkeyWindow/hotkeyPermissionsMode";

type ChatSidePanelProps = {
  activeTab: RightPanelTab | null;
  browserTarget: BrowserSidebarTarget | null;
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  followUpQueueMode: FollowUpQueueMode;
  reviewDelivery: ReviewDelivery;
  selectedAvatar: AvatarOption;
  submitButtonMode: "send" | "stop";
  sideChatConversation: ThreadConversation | null;
  sideChatApprovals: PendingApproval[];
  sideChatImplementPlanRequests: PendingImplementPlanRequest[];
  sideChatMcpServerElicitationRequest: PendingMcpServerElicitationRequest[];
  sideChatPermissionsRequestApproval: PendingPermissionsRequestApproval[];
  sideChatToolRequestUserInput: PendingToolRequestUserInput[];
  sideChatQueuedFollowUps: QueuedLocalFollowUp[];
  sideChatTurnError: string | null;
  pendingPdfComments?: PendingPdfCommentAttachment[];
  threadConversation: ThreadConversation | null;
  onOpenBrowserTarget: (target: BrowserSidebarTarget) => void;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  onSubmitPdfComment: (comment: ThreadConversationUserInputComment) => Promise<void>;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onApprovalDecision: (approval: PendingApproval, decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
  onComposerDraftChange: (value: string) => void;
  onComposerPermissionModeChange: (mode: HotkeyPermissionAgentMode) => void;
  onDismissImplementPlanRequest: (request: PendingImplementPlanRequest) => void;
  onEditUserMessage: (text: string) => void | Promise<void>;
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
  onRemoveQueuedFollowUp: (queuedFollowUpId: string) => void;
  onSelectThread: (threadId: string) => void;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  onToolRequestUserInputSubmit: (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => void;
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

export function ChatSidePanel({
  activeTab,
  browserTarget,
  composerDraft,
  composerEnterBehavior,
  composerPermissionConfig,
  composerPermissionMode,
  composerPermissionsState,
  followUpQueueMode,
  reviewDelivery,
  selectedAvatar,
  submitButtonMode,
  sideChatConversation,
  sideChatApprovals,
  sideChatImplementPlanRequests,
  sideChatMcpServerElicitationRequest,
  sideChatPermissionsRequestApproval,
  sideChatToolRequestUserInput,
  sideChatQueuedFollowUps,
  sideChatTurnError,
  pendingPdfComments = [],
  threadConversation,
  onOpenBrowserTarget,
  onOpenReviewFile,
  onSelectWorkspaceFile,
  onSubmitPdfComment,
  onPendingPdfCommentsChange,
  onApprovalDecision,
  onComposerDraftChange,
  onComposerPermissionModeChange,
  onDismissImplementPlanRequest,
  onEditUserMessage,
  onImplementPlanRequestSubmit,
  onMcpServerElicitationRequestSubmit,
  onPermissionsRequestApprovalSubmit,
  onRemoveQueuedFollowUp,
  onSelectThread,
  onStopTurn,
  onSubmitTurn,
  onToolRequestUserInputSubmit,
  approvalActionErrors,
  respondingApprovalKeys,
  t,
  threadDiffSummary,
}: ChatSidePanelProps) {
  return (
    <aside className="app-right-panel-content flex min-h-0 min-w-0 flex-1 flex-col">
      {activeTab && isWorkspaceFileRightPanelTab(activeTab) ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkspaceFilePreviewPanel
            onOpenBrowserTarget={onOpenBrowserTarget}
            onPendingPdfCommentsChange={onPendingPdfCommentsChange}
            onSubmitPdfComment={onSubmitPdfComment}
            pendingPdfComments={pendingPdfComments}
            selectedFileTarget={activeTab.file}
            tabId={activeTab.id}
            threadConversation={threadConversation}
            onSelectWorkspaceFile={onSelectWorkspaceFile}
            t={t}
          />
        </div>
      ) : activeTab?.kind === "sideChat" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatConversationMainPane
            threadActionsMenuRef={{ current: null }}
            composerDraft={composerDraft}
            composerEnterBehavior={composerEnterBehavior}
            composerPermissionConfig={composerPermissionConfig}
            composerPermissionMode={composerPermissionMode}
            composerPermissionsState={composerPermissionsState}
            followUpQueueMode={followUpQueueMode}
            hasAttachedHeartbeatAutomation={false}
            isThreadActionsMenuOpen={false}
            isThreadHeartbeatAutomationActionDisabled
            isThreadHeartbeatAutomationActionVisible={false}
            isWorktreeThread={false}
            showThreadHeader={false}
            heartbeatAutomationActionLabelKey="threadHeader.addAutomation"
            heartbeatAutomationButtonTooltip=""
            currentThreadApprovals={sideChatApprovals}
            currentThreadImplementPlanRequests={sideChatImplementPlanRequests}
            currentThreadMcpServerElicitationRequest={sideChatMcpServerElicitationRequest}
            currentThreadPermissionsRequestApproval={sideChatPermissionsRequestApproval}
            currentThreadToolRequestUserInput={sideChatToolRequestUserInput}
            currentThreadQueuedFollowUps={sideChatQueuedFollowUps}
            currentThreadPendingPdfCommentCount={0}
            onApprovalDecision={onApprovalDecision}
            onDismissImplementPlanRequest={onDismissImplementPlanRequest}
            onImplementPlanRequestSubmit={onImplementPlanRequestSubmit}
            onMcpServerElicitationRequestSubmit={onMcpServerElicitationRequestSubmit}
            onPermissionsRequestApprovalSubmit={onPermissionsRequestApprovalSubmit}
            onToolRequestUserInputSubmit={onToolRequestUserInputSubmit}
            onComposerDraftChange={onComposerDraftChange}
            onComposerPermissionModeChange={onComposerPermissionModeChange}
            onOpenRemoteTask={onSelectThread}
            onSelectRemoteTaskAssistantTurn={() => undefined}
            onArchiveThread={() => undefined}
            onCopyAppLink={() => undefined}
            onCopyConversationMarkdown={() => undefined}
            onCopySessionId={() => undefined}
            onCopyWorkingDirectory={() => undefined}
            onForkSelectedThread={() => undefined}
            onForkSelectedThreadIntoWorktree={() => undefined}
            onOpenInNewWindow={() => undefined}
            onOpenSideChat={() => undefined}
            onOpenAttachedHeartbeatAutomation={() => undefined}
            onOpenThreadHeartbeatAutomationAction={() => undefined}
            onOpenRenameDialog={() => undefined}
            onSelectThread={onSelectThread}
            onTogglePinnedThread={() => undefined}
            onEditUserMessage={onEditUserMessage}
            onRemoveQueuedFollowUp={onRemoveQueuedFollowUp}
            onClearPendingPdfComments={undefined}
            onStopTurn={onStopTurn}
            onSubmitTurn={onSubmitTurn}
            onToggleThreadActionsMenu={() => undefined}
            approvalActionErrors={approvalActionErrors}
            reviewDelivery={reviewDelivery}
            respondingApprovalKeys={respondingApprovalKeys}
            selectedAvatar={selectedAvatar}
            submitButtonMode={submitButtonMode}
            t={t}
            remoteAttemptTabsByTurnId={{}}
            remoteConversationOverridesByTurnId={{}}
            threadConversation={sideChatConversation}
            turnError={sideChatTurnError}
          />
        </div>
      ) : activeTab?.kind === "review" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ReviewSidePanel onOpenReviewFile={onOpenReviewFile} threadDiffSummary={threadDiffSummary} t={t} />
        </div>
      ) : activeTab?.kind === "browser" ? (
        <div className="min-h-0 flex-1">
          <BrowserSidebarPanel target={browserTarget} t={t} />
        </div>
      ) : (
        <EmptyPanel t={t} />
      )}
    </aside>
  );
}

function EmptyPanel({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--app-shell-subtle)]">
      <div className="max-w-72 rounded-[18px] border border-dashed border-[var(--app-shell-border)] px-5 py-6">
        <div className="app-title text-[14px] font-medium">{t("thread.sidePanel.empty.title")}</div>
      </div>
    </div>
  );
}
