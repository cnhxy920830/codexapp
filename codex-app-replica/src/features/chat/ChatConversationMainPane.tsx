import { useEffect, useState, type ReactNode } from "react";
import {
  CloudTaskIcon,
  CubeIcon,
  ForkedConversationIcon,
  InfoIcon,
  PersonalityChangedIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type {
  ApprovalDecision,
  CommandAction,
  McpServerElicitationRequest,
  ThreadConversation,
  ThreadConversationItem,
} from "../../services/history";
import type { ToolRequestUserInputQuestion } from "../../services/history";
import type { ComposerEnterBehavior } from "../../services/settings";
import type { QueuedLocalFollowUp } from "./localFollowUpQueue";
import {
  approvalRequestKey,
  resolveApprovalDecisions,
  type PlanImplementationItem,
  type PendingApproval,
  type PendingImplementPlanRequest,
  type PendingMcpServerElicitationRequest,
  type PendingPermissionsRequestApproval,
  type PendingToolRequestUserInput,
} from "./threadConversationState";
import { renderMessageContent } from "./messageContent";
import { PlanSummaryItemCard } from "./PlanSummaryItemCard";
import {
  attachTurnScopedItemsToRenderableConversationGroups,
  buildRenderableConversationGroups,
} from "./renderableConversationGroups";
import type {
  ExplorationGroupItem,
  MultiAgentGroupItem,
  RenderableConversationItem,
  WebSearchGroupItem,
} from "./renderableConversationItems";
import { ThreadComposer } from "./ThreadComposer";

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
  currentThreadApprovals: PendingApproval[];
  currentThreadImplementPlanRequests: PendingImplementPlanRequest[];
  currentThreadPlanImplementationItems: PlanImplementationItem[];
  currentThreadMcpServerElicitationRequest: PendingMcpServerElicitationRequest[];
  currentThreadPermissionsRequestApproval: PendingPermissionsRequestApproval[];
  currentThreadToolRequestUserInput: PendingToolRequestUserInput[];
  currentThreadQueuedFollowUps: QueuedLocalFollowUp[];
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
  onOpenRemoteTask: (taskId: string) => void;
  onSelectThread: (threadId: string) => void;
  onRemoveQueuedFollowUp: (queuedFollowUpId: string) => void;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadConversation: ThreadConversation | null;
  turnError: string | null;
};

export function ChatConversationMainPane({
  composerDraft,
  composerEnterBehavior,
  currentThreadApprovals,
  currentThreadImplementPlanRequests,
  currentThreadPlanImplementationItems,
  currentThreadMcpServerElicitationRequest,
  currentThreadPermissionsRequestApproval,
  currentThreadToolRequestUserInput,
  currentThreadQueuedFollowUps,
  onApprovalDecision,
  onDismissImplementPlanRequest,
  onImplementPlanRequestSubmit,
  onMcpServerElicitationRequestSubmit,
  onPermissionsRequestApprovalSubmit,
  onToolRequestUserInputSubmit,
  onComposerDraftChange,
  onOpenRemoteTask,
  onSelectThread,
  onRemoveQueuedFollowUp,
  onStopTurn,
  onSubmitTurn,
  approvalActionErrors,
  respondingApprovalKeys,
  submitButtonMode,
  t,
  threadConversation,
  turnError,
}: ChatConversationMainPaneProps) {
  const baseConversationGroups = threadConversation ? buildRenderableConversationGroups(threadConversation.items) : [];
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
  const bodyMcpRequests = filterPendingRequestsForConversationBody(
    currentThreadMcpServerElicitationRequest,
    footerPendingRequest,
  );
  const bodyPermissionsRequests = filterPendingRequestsForConversationBody(
    currentThreadPermissionsRequestApproval,
    footerPendingRequest,
  );
  const bodyUserInputRequests = filterPendingRequestsForConversationBody(
    currentThreadToolRequestUserInput,
    footerPendingRequest,
  );
  const groupedConversation = attachTurnScopedItemsToRenderableConversationGroups(baseConversationGroups, {
    approvalItems: bodyApprovals,
    mcpServerElicitationItems: bodyMcpRequests,
    permissionRequestItems: bodyPermissionsRequests,
    planImplementationItems: currentThreadPlanImplementationItems,
    userInputItems: bodyUserInputRequests,
  });
  const conversationGroups = groupedConversation.groups;
  const latestConversationGroupTurnId = conversationGroups.at(-1)?.turnId ?? null;
  const hasTurnContent = threadConversation !== null && conversationGroups.length > 0;
  const hasUnmatchedBodyContent =
    groupedConversation.unmatchedMcpServerElicitationItems.length > 0 ||
    groupedConversation.unmatchedApprovalItems.length > 0 ||
    groupedConversation.unmatchedPermissionRequestItems.length > 0 ||
    groupedConversation.unmatchedUserInputItems.length > 0 ||
    groupedConversation.unmatchedPlanImplementationItems.length > 0 ||
    currentThreadQueuedFollowUps.length > 0;
  const showBlankConversationBody = !hasTurnContent && !hasUnmatchedBodyContent;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      {showBlankConversationBody ? (
        <div
          className="[container-type:size] relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden"
          role="main"
          aria-label={t("homePage.mainContent")}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-5">
            <div className="flex-1" />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto flex max-w-[820px] flex-col gap-4">
            {hasTurnContent
              ? conversationGroups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    {group.preUserItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.preUserItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.userItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.userItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.activityItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.activityItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.assistantMessage ? (
                      <ConversationItemCard
                        item={group.assistantMessage}
                        onOpenRemoteTask={onOpenRemoteTask}
                        onSelectThread={onSelectThread}
                        t={t}
                      />
                    ) : null}
                    {group.toolOutputItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.toolOutputItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.postAssistantItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.postAssistantItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.systemEventItem ? (
                      <ConversationItemCard
                        item={group.systemEventItem}
                        onOpenRemoteTask={onOpenRemoteTask}
                        onSelectThread={onSelectThread}
                        t={t}
                      />
                    ) : null}
                    {group.unifiedDiffItem ? (
                      <ConversationItemCard
                        item={group.unifiedDiffItem}
                        onOpenRemoteTask={onOpenRemoteTask}
                        onSelectThread={onSelectThread}
                        t={t}
                      />
                    ) : null}
                    {group.remoteTaskCreatedItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.remoteTaskCreatedItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.personalityChangedItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.personalityChangedItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.forkedFromConversationItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.forkedFromConversationItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.modelChangedItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.modelChangedItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.modelReroutedItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.modelReroutedItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    {group.todoListItem ? (
                      <ConversationItemCard
                        item={group.todoListItem}
                        onOpenRemoteTask={onOpenRemoteTask}
                        onSelectThread={onSelectThread}
                        t={t}
                      />
                    ) : null}
                    {group.proposedPlanItems.length > 0 ? (
                      <div className="space-y-3">
                        {group.proposedPlanItems.map((item) => (
                          <ConversationItemCard
                            key={item.id}
                            item={item}
                            planSummaryIsWriting={
                              submitButtonMode === "stop" &&
                              latestConversationGroupTurnId === group.turnId &&
                              group.assistantMessage === null
                            }
                            onOpenRemoteTask={onOpenRemoteTask}
                            onSelectThread={onSelectThread}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : null}
                    <ConversationTurnPlanImplementationItems items={group.planImplementationItems} t={t} />
                    <ConversationTurnMcpRequests
                      mcpRequests={group.mcpServerElicitationItems}
                      approvalActionErrors={approvalActionErrors}
                      respondingApprovalKeys={respondingApprovalKeys}
                      onMcpServerElicitationRequestSubmit={onMcpServerElicitationRequestSubmit}
                      t={t}
                    />
                    <ConversationTurnPermissionRequests
                      permissionsRequests={group.permissionRequestItems}
                      approvalActionErrors={approvalActionErrors}
                      respondingApprovalKeys={respondingApprovalKeys}
                      onPermissionsRequestApprovalSubmit={onPermissionsRequestApprovalSubmit}
                      t={t}
                    />
                    <ConversationTurnApprovalRequests
                      approvals={group.approvalItems}
                      approvalActionErrors={approvalActionErrors}
                      respondingApprovalKeys={respondingApprovalKeys}
                      onApprovalDecision={onApprovalDecision}
                      t={t}
                    />
                    <ConversationTurnUserInputRequests
                      userInputRequests={group.userInputItems}
                      approvalActionErrors={approvalActionErrors}
                      respondingApprovalKeys={respondingApprovalKeys}
                      onToolRequestUserInputSubmit={onToolRequestUserInputSubmit}
                      t={t}
                    />
                  </div>
                ))
              : null}

            <ConversationTurnPlanImplementationItems items={groupedConversation.unmatchedPlanImplementationItems} t={t} />
            <ConversationTurnMcpRequests
              mcpRequests={groupedConversation.unmatchedMcpServerElicitationItems}
              approvalActionErrors={approvalActionErrors}
              respondingApprovalKeys={respondingApprovalKeys}
              onMcpServerElicitationRequestSubmit={onMcpServerElicitationRequestSubmit}
              t={t}
            />
            <ConversationTurnPermissionRequests
              permissionsRequests={groupedConversation.unmatchedPermissionRequestItems}
              approvalActionErrors={approvalActionErrors}
              respondingApprovalKeys={respondingApprovalKeys}
              onPermissionsRequestApprovalSubmit={onPermissionsRequestApprovalSubmit}
              t={t}
            />
            <ConversationTurnApprovalRequests
              approvals={groupedConversation.unmatchedApprovalItems}
              approvalActionErrors={approvalActionErrors}
              respondingApprovalKeys={respondingApprovalKeys}
              onApprovalDecision={onApprovalDecision}
              t={t}
            />
            <ConversationTurnUserInputRequests
              userInputRequests={groupedConversation.unmatchedUserInputItems}
              approvalActionErrors={approvalActionErrors}
              respondingApprovalKeys={respondingApprovalKeys}
              onToolRequestUserInputSubmit={onToolRequestUserInputSubmit}
              t={t}
            />

            {currentThreadQueuedFollowUps.length > 0 ? (
              <div className="app-card rounded-[18px] px-4 py-4">
                <div className="app-card-muted rounded-[14px] px-3 py-3">
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
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className={showBlankConversationBody ? "px-5 pb-5" : "px-5 pt-2 pb-5"}>
        <div className="mx-auto w-full max-w-3xl">
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
              composerDraft={composerDraft}
              composerEnterBehavior={composerEnterBehavior}
              onComposerDraftChange={onComposerDraftChange}
              onStopTurn={onStopTurn}
              onSubmitTurn={onSubmitTurn}
              submitButtonMode={submitButtonMode}
              t={t}
              turnError={turnError}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ConversationTurnMcpRequests({
  mcpRequests,
  approvalActionErrors,
  respondingApprovalKeys,
  onMcpServerElicitationRequestSubmit,
  t,
}: {
  mcpRequests: PendingMcpServerElicitationRequest[];
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  onMcpServerElicitationRequestSubmit: (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (mcpRequests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {mcpRequests.map((request) => {
        const requestKey = approvalRequestKey(request.requestId);
        const isResponding = respondingApprovalKeys.includes(requestKey);
        const requestError = approvalActionErrors[requestKey] ?? null;
        return (
          <McpServerElicitationRequestCard
            key={requestKey}
            request={request}
            isResponding={isResponding}
            requestError={requestError}
            onSubmit={onMcpServerElicitationRequestSubmit}
            t={t}
          />
        );
      })}
    </div>
  );
}

function ConversationTurnPermissionRequests({
  permissionsRequests,
  approvalActionErrors,
  respondingApprovalKeys,
  onPermissionsRequestApprovalSubmit,
  t,
}: {
  permissionsRequests: PendingPermissionsRequestApproval[];
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  onPermissionsRequestApprovalSubmit: (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (permissionsRequests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {permissionsRequests.map((request) => {
        const requestKey = approvalRequestKey(request.requestId);
        const isResponding = respondingApprovalKeys.includes(requestKey);
        const requestError = approvalActionErrors[requestKey] ?? null;
        return (
          <PermissionsRequestApprovalCard
            key={requestKey}
            request={request}
            isResponding={isResponding}
            requestError={requestError}
            onSubmit={onPermissionsRequestApprovalSubmit}
            t={t}
          />
        );
      })}
    </div>
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

function ConversationTurnUserInputRequests({
  userInputRequests,
  approvalActionErrors,
  respondingApprovalKeys,
  onToolRequestUserInputSubmit,
  t,
}: {
  userInputRequests: PendingToolRequestUserInput[];
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  onToolRequestUserInputSubmit: (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (userInputRequests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {userInputRequests.map((request) => {
        const requestKey = approvalRequestKey(request.requestId);
        const isResponding = respondingApprovalKeys.includes(requestKey);
        const requestError = approvalActionErrors[requestKey] ?? null;
        return (
          <ToolRequestUserInputCard
            key={requestKey}
            request={request}
            isResponding={isResponding}
            requestError={requestError}
            onSubmit={onToolRequestUserInputSubmit}
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
  items: PlanImplementationItem[];
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

function ComposerFooterPendingRequest({
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
  item: PlanImplementationItem;
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

function ConversationItemCard({
  item,
  planSummaryIsWriting = false,
  onOpenRemoteTask,
  onSelectThread,
  t,
}: {
  item: RenderableConversationItem;
  planSummaryIsWriting?: boolean;
  onOpenRemoteTask: (taskId: string) => void;
  onSelectThread: (threadId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (item.type === "userMessage" || item.type === "agentMessage") {
    const isUser = item.role === "user";
    return (
      <div className={isUser ? "flex justify-end" : "rounded-[18px]"}>
        <div
          className={[
            "max-w-[620px] rounded-[18px] px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
            isUser ? "app-segmented-option-active" : "app-card",
          ].join(" ")}
        >
          {renderMessageContent(item.text)}
        </div>
      </div>
    );
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

  if (item.type === "plan") {
    return <PlanSummaryItemCard item={item} isWriting={planSummaryIsWriting} t={t} />;
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
    const unifiedDiff = item.unifiedDiff.trim();
    if (unifiedDiff.length === 0) {
      return null;
    }
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">Diff</div>
        <pre className="app-code-block mt-3 overflow-x-auto rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
          {item.unifiedDiff}
        </pre>
      </div>
    );
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

  if (item.type === "hookPrompt") {
    const fragments = item.fragments.filter((fragment) => fragment.text.trim().length > 0);
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("app.chat.hookPrompt")}</div>
        <div className="mt-3 space-y-2">
          {fragments.map((fragment, index) => (
            <div key={`${item.id}:fragment:${fragment.hookRunId || index}`} className="app-text-muted text-[13px] leading-6 whitespace-pre-wrap">
              {fragment.text}
            </div>
          ))}
        </div>
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
        {renderMessageContent(`![Image](${item.path})`)}
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

  if (item.type === "collabAgentToolCall") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("app.chat.collabAgentToolCall")}</div>
          <StatusBadge status={item.status} t={t} />
        </div>
        <LabeledValue label={t("app.chat.agentTool")} value={item.tool} className="mt-3" />
        <LabeledValue label={t("app.chat.senderThread")} value={item.senderThreadId} className="mt-3" />
        {item.receiverThreadIds.length > 0 ? (
          <LabeledValue label={t("app.chat.receiverThreads")} value={item.receiverThreadIds.join(", ")} className="mt-3" />
        ) : null}
        {item.prompt ? <LabeledValue label={t("app.chat.prompt")} value={item.prompt} className="mt-3" /> : null}
        {item.model ? <LabeledValue label={t("app.chat.model")} value={item.model} className="mt-3" /> : null}
        {item.reasoningEffort ? (
          <LabeledValue label={t("app.chat.reasoningEffort")} value={item.reasoningEffort} className="mt-3" />
        ) : null}
        {item.receiverSummary ? (
          <LabeledValue label={t("app.chat.agentStatus")} value={item.receiverSummary} className="mt-3" />
        ) : null}
      </div>
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
    return <DynamicToolCallInlineStatus item={item} />;
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

  if (item.type === "enteredReviewMode" || item.type === "exitedReviewMode") {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="app-title text-[14px] font-medium">{t("composer.reviewMode.title")}</div>
          <StatusBadge status={item.type === "enteredReviewMode" ? "inProgress" : "completed"} t={t} />
        </div>
        <div className="app-text-muted mt-3 whitespace-pre-wrap text-[13px] leading-6">
          {item.type === "enteredReviewMode" ? formatReviewModeLabel(item.review, t) : item.review}
        </div>
      </div>
    );
  }

  return null;
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
}: {
  item: Extract<ThreadConversationItem, { type: "dynamicToolCall" }>;
}) {
  const isCompleted = item.status !== "inProgress";
  const label = resolveDynamicToolCallLabel(item.tool, isCompleted);

  return (
    <InlineConversationStatusRow
      message={
        <span className={isCompleted ? undefined : "loading-shimmer-pure-text"}>
          {label}
        </span>
      }
    />
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
    <div className="my-2 flex items-center gap-2 text-[13px] text-[var(--app-shell-muted)]">
      <div className="h-px flex-1 border-t border-current/20" />
      <div className="flex max-w-[70%] min-w-0 items-center gap-1 whitespace-nowrap">
        <ForkedConversationIcon className="h-[14px] w-[14px] shrink-0" />
        <button
          type="button"
          className="cursor-interaction max-w-64 min-w-0 truncate text-left align-bottom text-[var(--app-shell-accent)] hover:underline"
          onClick={() => onSelectThread(sourceConversationId)}
        >
          {t("localConversation.forkedFromConversation")}
        </button>
      </div>
      <div className="h-px flex-1 border-t border-current/20" />
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
  return item.commandActions
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
  return (
    <>
      {prefix}
      <a
        href="https://chatgpt.com/cyber"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:no-underline"
      >
        {linkText}
      </a>
      {suffix}
    </>
  );
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
  automation_update: "Automation updated",
  load_workspace_dependencies: "Loaded workspace dependencies",
  read_thread_terminal: "Read thread terminal",
};

const dynamicToolCallInProgressLabels: Record<string, string> = {
  automation_update: "Updating automation",
  load_workspace_dependencies: "Loading workspace dependencies",
  read_thread_terminal: "Reading thread terminal",
};

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
  if (normalizedToolName.length === 0) {
    return "Tool call";
  }

  return normalizedToolName.replaceAll(/\b\w/g, (character) => character.toUpperCase());
}

const multiAgentHeaderLabelKeys: Partial<
  Record<
    Extract<MultiAgentGroupItem["tool"], "closeAgent" | "resumeAgent" | "sendInput" | "spawnAgent">,
    Partial<Record<Extract<MultiAgentGroupItem["status"], "completed" | "failed" | "inProgress">, MessageKey>>
  >
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.header.close.completed",
    failed: "localConversation.multiAgentAction.header.close.failed",
    inProgress: "localConversation.multiAgentAction.header.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.header.resume.completed",
    failed: "localConversation.multiAgentAction.header.resume.failed",
    inProgress: "localConversation.multiAgentAction.header.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.header.sendInput.completed",
    failed: "localConversation.multiAgentAction.header.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.header.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.header.spawn.completed",
    failed: "localConversation.multiAgentAction.header.spawn.failed",
    inProgress: "localConversation.multiAgentAction.header.spawn.inProgress",
  },
};

const multiAgentRowLabelKeys: Partial<
  Record<
    Extract<MultiAgentGroupItem["tool"], "closeAgent" | "resumeAgent" | "sendInput" | "spawnAgent">,
    Partial<Record<Extract<MultiAgentGroupItem["status"], "completed" | "failed" | "inProgress">, MessageKey>>
  >
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.close.completed",
    failed: "localConversation.multiAgentAction.rowAction.close.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.resume.completed",
    failed: "localConversation.multiAgentAction.rowAction.resume.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.rowAction.sendInput.completed",
    failed: "localConversation.multiAgentAction.rowAction.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.rowAction.spawn.completed",
    failed: "localConversation.multiAgentAction.rowAction.spawn.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.spawn.inProgress",
  },
};

function MultiAgentGroupSummary({
  item,
  t,
}: {
  item: MultiAgentGroupItem;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const actionLabel = resolveMultiAgentActionLabel(item.tool, item.status, t, "header");
  const count = resolveMultiAgentReceiverCount(item.items);
  const countLabel =
    count > 0 ? t("localConversation.multiAgentAction.header.count", { count }) : "";
  const prompt = resolveMultiAgentGroupPrompt(item.items);
  const rows = buildMultiAgentGroupRows(item.items, t);

  return (
    <div className="app-card-muted rounded-[16px] px-4 py-3">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="app-title text-[13px] font-medium">
            {t("localConversation.multiAgentAction.header", {
              action: actionLabel,
              countLabel,
            })}
          </div>
          {prompt ? (
            <div className="app-text-muted mt-1 line-clamp-2 text-[12px] leading-5">
              {t("localConversation.multiAgentAction.meta.prompt", {
                prompt,
              })}
            </div>
          ) : null}
        </div>
        <ForwardNavigationIcon
          className={[
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
            isExpanded ? "rotate-90" : "",
          ].join(" ")}
        />
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-1.5">
          {rows.map((row, index) => (
            <div
              key={`${item.id}:row:${index}`}
              className="app-text-muted break-words rounded-[12px] bg-[var(--app-shell-right)] px-3 py-2 text-[12px] leading-5"
            >
              {row}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildMultiAgentGroupRows(
  items: MultiAgentGroupItem["items"],
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const rows: string[] = [];

  for (const item of items) {
    const action = resolveMultiAgentActionLabel(item.tool, item.status, t, "row");
    if (item.receiverThreadIds.length === 0) {
      rows.push(t("localConversation.multiAgentAction.row.generic", { action }));
      continue;
    }

    for (const receiverThreadId of item.receiverThreadIds) {
      rows.push(
        t("localConversation.multiAgentAction.row.agent", {
          action,
          agent: receiverThreadId,
        }),
      );
    }
  }

  return rows;
}

function resolveMultiAgentGroupPrompt(items: MultiAgentGroupItem["items"]) {
  for (const item of items) {
    const prompt = item.prompt?.trim();
    if (prompt) {
      return prompt;
    }
  }
  return null;
}

function resolveMultiAgentReceiverCount(items: MultiAgentGroupItem["items"]) {
  const receiverThreadIds = new Set(items.flatMap((item) => item.receiverThreadIds));
  if (receiverThreadIds.size > 0) {
    return receiverThreadIds.size;
  }
  return items.length;
}

function resolveMultiAgentActionLabel(
  tool: MultiAgentGroupItem["tool"],
  status: MultiAgentGroupItem["status"],
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  context: "header" | "row",
) {
  const resolvedStatus = normalizeMultiAgentStatus(status);
  const labelKey =
    context === "header"
      ? multiAgentHeaderLabelKeys[tool]?.[resolvedStatus]
      : multiAgentRowLabelKeys[tool]?.[resolvedStatus];

  if (labelKey) {
    return t(labelKey);
  }

  const normalizedTool = tool
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  if (normalizedTool.length === 0) {
    return resolvedStatus === "failed" ? t("app.chat.status.failed") : t("app.chat.status.completed");
  }

  const verb = normalizedTool.replaceAll(/\b\w/g, (character) => character.toUpperCase());
  return resolvedStatus === "failed" ? `${t("app.chat.status.failed")} ${verb}` : verb;
}

function normalizeMultiAgentStatus(status: MultiAgentGroupItem["status"]) {
  if (status === "completed" || status === "failed" || status === "inProgress") {
    return status;
  }
  return status.trim().toLowerCase() === "inprogress" ? "inProgress" : "completed";
}

function formatReviewModeLabel(
  review: string,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const normalized = review.trim().toLowerCase();
  if (normalized === "current changes" || normalized === "uncommitted changes") {
    return t("composer.reviewMode.option.unstaged.simple");
  }
  return review;
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
  return (
    <div className="app-card-muted rounded-[14px] px-4 py-3">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="app-control rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
          {action.type}
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

function selectComposerFooterPendingRequest({
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

function filterPendingRequestsForConversationBody<
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
