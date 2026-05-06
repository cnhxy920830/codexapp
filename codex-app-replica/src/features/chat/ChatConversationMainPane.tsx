import type { MessageKey } from "../../i18n/messages";
import type {
  ApprovalDecision,
  ThreadConversation,
  ThreadConversationItem,
} from "../../services/history";
import type { ComposerEnterBehavior } from "../../services/settings";
import type { QueuedLocalFollowUp } from "./localFollowUpQueue";
import {
  approvalRequestKey,
  resolveApprovalDecisions,
  type PendingApproval,
} from "./threadConversationState";
import { buildRenderableConversationItems } from "./renderableConversationItems";

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

type ChatConversationMainPaneProps = {
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  currentThreadApprovals: PendingApproval[];
  currentThreadQueuedFollowUps: QueuedLocalFollowUp[];
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  onComposerDraftChange: (value: string) => void;
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
  currentThreadQueuedFollowUps,
  onApprovalDecision,
  onComposerDraftChange,
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
  const conversationItems = threadConversation ? buildRenderableConversationItems(threadConversation.items) : [];

  return (
    <section className="min-h-0 min-w-0 overflow-y-auto px-5 py-5">
      <div className="mx-auto flex max-w-[820px] flex-col gap-4">
        {threadConversation ? (
          conversationItems.length > 0 ? (
            conversationItems.map((item) => <ConversationItemCard key={item.id} item={item} t={t} />)
          ) : (
            <div className="app-card rounded-[18px] px-5 py-4 text-[14px] leading-6">
              {t("app.chat.noMessages")}
            </div>
          )
        ) : null}

        {currentThreadApprovals.map((approval) => {
          const requestKey = approvalRequestKey(approval.requestId);
          const isResponding = respondingApprovalKeys.includes(requestKey);
          const approvalError = approvalActionErrors[requestKey] ?? null;
          const decisions = resolveApprovalDecisions(approval);
          return (
            <div
              key={requestKey}
              className="app-card-warning rounded-[18px] px-5 py-4"
            >
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
        })}

        <div className="app-card rounded-[18px] px-4 py-4">
          {currentThreadQueuedFollowUps.length > 0 ? (
            <div className="app-card-muted mb-3 rounded-[14px] px-3 py-3">
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
          <textarea
            value={composerDraft}
            onChange={(event) => onComposerDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              const hasModifier = event.ctrlKey || event.metaKey;
              const hasMultilineContent = composerDraft.includes("\n");
              if (hasModifier) {
                event.preventDefault();
                onSubmitTurn(true);
                return;
              }
              if (event.shiftKey) {
                return;
              }
              if (composerEnterBehavior === "enter" || !hasMultilineContent) {
                event.preventDefault();
                onSubmitTurn();
              }
            }}
            rows={4}
            placeholder={t("app.chat.composePlaceholder")}
            className="app-text-input min-h-[104px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="app-text-error min-h-[20px] text-[12px]">{turnError ?? ""}</div>
            <button
              type="button"
              disabled={submitButtonMode === "send" && composerDraft.trim().length === 0}
              onClick={() => {
                if (submitButtonMode === "stop") {
                  onStopTurn();
                  return;
                }
                onSubmitTurn();
              }}
              className="app-button-primary rounded-full px-4 py-1.5 text-[13px]"
            >
              {submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConversationItemCard({
  item,
  t,
}: {
  item: ThreadConversationItem;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (item.type === "userMessage" || item.type === "agentMessage") {
    const isUser = item.role === "user";
    return (
      <div className={isUser ? "flex justify-end" : "rounded-[18px]"}>
        <div
          className={[
            "max-w-[620px] rounded-[18px] px-4 py-3 text-[14px] leading-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
            isUser ? "app-segmented-option-active" : "app-card",
          ].join(" ")}
        >
          {item.text}
        </div>
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
