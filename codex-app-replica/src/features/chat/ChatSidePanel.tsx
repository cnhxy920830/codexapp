import { useEffect, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import type {
  FileChangeSummary,
  ThreadConversation,
  ThreadConversationUserInputComment,
} from "../../services/history";
import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import type { AppToast } from "../../components/AppToastRegion";
import { ChatConversationMainPane } from "./ChatConversationMainPane";
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
import type { BrowserSidebarTarget } from "../../services/browserSidebar";
import { readGitOrigins } from "../../services/gitOrigins";
import { listenGitStateChanged } from "../../services/gitStateEvents";
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
  activeStaticTabId: "browser" | "review" | null;
  activeTab: RightPanelTab | null;
  browserTarget: BrowserSidebarTarget | null;
  conversationHostId?: string | null;
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  followUpQueueMode: FollowUpQueueMode;
  hidePresentationSpeakerNotes?: boolean;
  reviewDelivery: ReviewDelivery;
  sideChatIsResponseInProgress?: boolean;
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
  onShowToast?: (toast: AppToast) => void;
  threadConversation: ThreadConversation | null;
  onOpenSideChat?: ((initialPrompt?: string | null) => boolean | Promise<boolean>) | null;
  onOpenBrowserTarget: (target: BrowserSidebarTarget) => void;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  onOpenWorkspaceFileSearch?: (() => void) | null;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  onSubmitPdfComment: (comment: ThreadConversationUserInputComment) => Promise<void>;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onApprovalDecision: (approval: PendingApproval, decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
  onComposerDraftChange: (value: string) => void;
  onComposerCollaborationModeChange?: ((mode: "default" | "plan" | null) => void) | null;
  activeCollaborationMode?: string | null;
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
  authMethod?: string | null;
};

export function ChatSidePanel({
  activeStaticTabId,
  activeTab,
  browserTarget,
  conversationHostId = null,
  composerDraft,
  composerEnterBehavior,
  composerPermissionConfig,
  composerPermissionMode,
  composerPermissionsState,
  followUpQueueMode,
  hidePresentationSpeakerNotes = false,
  reviewDelivery,
  sideChatIsResponseInProgress = false,
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
  onShowToast,
  threadConversation,
  onOpenSideChat = null,
  onOpenBrowserTarget,
  onOpenReviewFile,
  onOpenWorkspaceFileSearch = null,
  onSelectWorkspaceFile,
  onSubmitPdfComment,
  onPendingPdfCommentsChange,
  onApprovalDecision,
  onComposerDraftChange,
  onComposerCollaborationModeChange,
  activeCollaborationMode = null,
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
  authMethod = null,
}: ChatSidePanelProps) {
  const [reviewGitInitCwd, setReviewGitInitCwd] = useState<string | null>(null);
  const [reviewGitRoot, setReviewGitRoot] = useState<string | null>(null);
  const [showReviewGitRepoRequired, setShowReviewGitRepoRequired] = useState(false);
  const shouldRenderReviewPanel = activeStaticTabId === "review";
  const shouldRenderBrowserPanel = activeStaticTabId === "browser";

  useEffect(() => {
    const cwd = threadConversation?.cwd?.trim() ?? "";
    if (cwd.length === 0) {
      setReviewGitInitCwd(null);
      setReviewGitRoot(null);
      setShowReviewGitRepoRequired(false);
      return;
    }

    let cancelled = false;
    setReviewGitInitCwd(cwd);

    const refreshGitRepoState = () => {
      void readGitOrigins({ dirs: [cwd], hostId: conversationHostId })
        .then((response) => {
          if (cancelled) {
            return;
          }
          const gitRoot = response.origins.at(0)?.root?.trim() ?? null;
          setReviewGitRoot(gitRoot);
          setShowReviewGitRepoRequired(gitRoot === null);
        })
        .catch(() => {
          if (!cancelled) {
            setReviewGitRoot(null);
            setShowReviewGitRepoRequired(false);
          }
        });
    };

    refreshGitRepoState();
    const unsubscribe = listenGitStateChanged(refreshGitRepoState);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversationHostId, threadConversation?.cwd]);

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-shell-main-surface)]">
      {shouldRenderReviewPanel ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ReviewSidePanel
            gitInitCwd={reviewGitInitCwd}
            gitRoot={reviewGitRoot}
            hostId={conversationHostId}
            onShowToast={onShowToast}
            onOpenReviewFile={onOpenReviewFile}
            showGitRepoRequired={showReviewGitRepoRequired}
            threadDiffSummary={threadDiffSummary}
            t={t}
          />
        </div>
      ) : shouldRenderBrowserPanel ? (
        <div className="min-h-0 flex-1">
          <BrowserSidebarPanel target={browserTarget} />
        </div>
      ) : activeTab && isWorkspaceFileRightPanelTab(activeTab) ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkspaceFilePreviewPanel
            hidePresentationSpeakerNotes={hidePresentationSpeakerNotes}
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
            composerDraft={composerDraft}
            composerEnterBehavior={composerEnterBehavior}
            composerPermissionConfig={composerPermissionConfig}
            composerPermissionMode={composerPermissionMode}
            composerPermissionsState={composerPermissionsState}
            followUpQueueMode={followUpQueueMode}
            isResponseInProgress={sideChatIsResponseInProgress}
            isWorktreeThread={false}
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
            onComposerCollaborationModeChange={onComposerCollaborationModeChange ?? undefined}
            activeCollaborationMode={activeCollaborationMode}
            onComposerPermissionModeChange={onComposerPermissionModeChange}
            onOpenRemoteTask={onSelectThread}
            onSelectRemoteTaskAssistantTurn={() => undefined}
            onOpenSideChat={onOpenSideChat ?? undefined}
            onOpenWorkspaceFileSearch={onOpenWorkspaceFileSearch ?? undefined}
            onSelectThread={onSelectThread}
            onEditUserMessage={onEditUserMessage}
            onRemoveQueuedFollowUp={onRemoveQueuedFollowUp}
            onClearPendingPdfComments={undefined}
            onStopTurn={onStopTurn}
            onSubmitTurn={onSubmitTurn}
            onShowToast={onShowToast}
            approvalActionErrors={approvalActionErrors}
            reviewDelivery={reviewDelivery}
            respondingApprovalKeys={respondingApprovalKeys}
            submitButtonMode={submitButtonMode}
            t={t}
            authMethod={authMethod}
            remoteAttemptTabsByTurnId={{}}
            remoteConversationOverridesByTurnId={{}}
            composerPlacement="side"
            threadConversation={sideChatConversation}
            turnError={sideChatTurnError}
            conversationHostId={conversationHostId}
          />
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
