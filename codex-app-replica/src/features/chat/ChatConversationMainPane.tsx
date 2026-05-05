import type { MessageKey } from "../../i18n/messages";
import type {
  ApprovalDecision,
  ThreadConversation,
  ThreadConversationItem,
} from "../../services/history";
import {
  approvalRequestKey,
  resolveApprovalDecisions,
  type PendingApproval,
} from "./threadConversationState";

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
  currentThreadApprovals: PendingApproval[];
  isTurnInProgress: boolean;
  onApprovalDecision: (approval: PendingApproval, decision: ApprovalDecision) => void;
  onComposerDraftChange: (value: string) => void;
  onStopTurn: () => void;
  onSubmitTurn: () => void;
  openProjectPath: string | null;
  approvalActionErrors: Record<string, string>;
  respondingApprovalKeys: string[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadConversation: ThreadConversation | null;
  threadPrompt: string;
  turnError: string | null;
};

export function ChatConversationMainPane({
  composerDraft,
  currentThreadApprovals,
  isTurnInProgress,
  onApprovalDecision,
  onComposerDraftChange,
  onStopTurn,
  onSubmitTurn,
  openProjectPath,
  approvalActionErrors,
  respondingApprovalKeys,
  t,
  threadConversation,
  threadPrompt,
  turnError,
}: ChatConversationMainPaneProps) {
  return (
    <section className="min-h-0 min-w-0 overflow-y-auto px-5 py-5">
      <div className="mx-auto flex max-w-[820px] flex-col gap-4">
        {threadConversation ? (
          threadConversation.items.length > 0 ? (
            threadConversation.items.map((item) => <ConversationItemCard key={item.id} item={item} t={t} />)
          ) : (
            <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 text-[14px] leading-6 text-[#302b26] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
              {t("app.chat.noMessages")}
            </div>
          )
        ) : (
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 text-[14px] leading-6 text-[#302b26] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            {threadPrompt}
          </div>
        )}

        {currentThreadApprovals.map((approval) => {
          const requestKey = approvalRequestKey(approval.requestId);
          const isResponding = respondingApprovalKeys.includes(requestKey);
          const approvalError = approvalActionErrors[requestKey] ?? null;
          const decisions = resolveApprovalDecisions(approval);
          return (
            <div
              key={requestKey}
              className="rounded-[18px] border border-[#d5c2a0] bg-[#fff9ef] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[14px] font-medium text-[#4e3c22]">
                  {approval.type === "commandApprovalRequested"
                    ? t("app.chat.approval.commandTitle")
                    : t("app.chat.approval.fileChangeTitle")}
                </div>
                <div className="text-[12px] text-[#8b7554]">{t("app.chat.approval.review")}</div>
              </div>

              {approval.reason ? (
                <LabeledValue label={t("app.chat.approval.reason")} value={approval.reason} className="mt-3" />
              ) : null}

              {approval.type === "commandApprovalRequested" ? (
                <>
                  {approval.command ? (
                    <div className="mt-3">
                      <div className="text-[12px] font-medium tracking-[0.08em] text-[#8b7554]">
                        {t("app.chat.approval.command")}
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded-[14px] bg-[#f7f0e1] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap text-[#33281c]">
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
                    <div className="text-[12px] font-medium tracking-[0.08em] text-[#8b7554]">
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
                      <div className="mt-2 text-[13px] leading-6 text-[#6c5941]">
                        {t("app.chat.approval.noChanges")}
                      </div>
                    )}
                  </div>
                </>
              )}

              {approvalError ? <div className="mt-3 text-[12px] text-[#a2483d]">{approvalError}</div> : null}

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
                        ? "border-[#1c8a4a]/20 bg-[#1c8a4a] text-white"
                        : decision === "acceptForSession"
                          ? "border-[#8b7554]/20 bg-white text-[#4e3c22]"
                          : "border-[#c9b698] bg-white/80 text-[#5f4d37]",
                      "disabled:cursor-not-allowed disabled:bg-[#ddd0b8] disabled:text-[#8c7a62]",
                    ].join(" ")}
                  >
                    {t(approvalDecisionLabelKeys[decision])}
                  </button>
                ))}
                {isResponding ? (
                  <div className="text-[12px] text-[#8b7554]">{t("app.chat.approval.submitting")}</div>
                ) : null}
              </div>
            </div>
          );
        })}

        <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#efeeeb] text-[18px] text-[#645c52]">
              ⊞
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-[#29251f]">AGENTS.md</div>
              <div className="text-[12px] text-[#8e867c]">{t("app.chat.document")}</div>
            </div>
            <button
              type="button"
              className="rounded-[11px] border border-black/8 bg-white px-3 py-1.5 text-[13px] text-[#302b25]"
            >
              {t("app.chat.open")}
            </button>
          </div>
        </div>

        {openProjectPath ? (
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-[#f7f6f4] px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
              {t("app.chat.openProject")}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[#312d28]">{openProjectPath}</div>
          </div>
        ) : null}

        <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <textarea
            value={composerDraft}
            disabled={isTurnInProgress}
            onChange={(event) => onComposerDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                onSubmitTurn();
              }
            }}
            rows={4}
            placeholder={t("app.chat.composePlaceholder")}
            className="min-h-[104px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 text-[#2d2924] outline-none placeholder:text-[#8e867c] disabled:cursor-not-allowed"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-h-[20px] text-[12px] text-[#a2483d]">{turnError ?? ""}</div>
            <button
              type="button"
              disabled={!isTurnInProgress && composerDraft.trim().length === 0}
              onClick={() => {
                if (isTurnInProgress) {
                  onStopTurn();
                  return;
                }
                onSubmitTurn();
              }}
              className="rounded-full border border-black/8 bg-[#2f2b26] px-4 py-1.5 text-[13px] text-white disabled:cursor-not-allowed disabled:bg-[#b9b2aa]"
            >
              {isTurnInProgress ? t("app.chat.stop") : t("app.chat.send")}
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
            isUser
              ? "bg-[#ecebea] text-[#2d2924]"
              : "border border-[var(--app-shell-border)] bg-white/92 text-[#302b26]",
          ].join(" ")}
        >
          {item.text}
        </div>
      </div>
    );
  }

  if (item.type === "commandExecution") {
    return (
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium text-[#2f2b26]">{t("app.chat.commandExecution")}</div>
          <StatusBadge status={item.status} t={t} />
        </div>
        <LabeledValue label={t("app.chat.approval.command")} value={item.command} className="mt-3" mono />
        <LabeledValue label={t("app.chat.approval.workingDirectory")} value={item.cwd} className="mt-3" />
        {item.aggregatedOutput ? (
          <LabeledValue label={t("app.chat.output")} value={item.aggregatedOutput} className="mt-3" mono />
        ) : (
          <div className="mt-3 text-[13px] text-[#8a8176]">{t("app.chat.noOutput")}</div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-[#6b655f]">
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
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium text-[#2f2b26]">{t("app.chat.fileChange")}</div>
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

function FileChangeCard({
  change,
  t,
}: {
  change: { path: string; kind: string; diff: string | null; movePath: string | null };
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="rounded-[14px] bg-[#f7f6f4] px-4 py-3">
      <div className="flex items-center gap-3 text-[13px] text-[#312d28]">
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[#7d756c]">
          {change.kind}
        </span>
        <span className="min-w-0 break-all">{change.path}</span>
      </div>
      {change.movePath ? (
        <div className="mt-2 text-[12px] text-[#7d756c]">
          {t("app.chat.movedTo")}: {change.movePath}
        </div>
      ) : null}
      {change.diff ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-[#5b554f]">
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
    <span className="rounded-full bg-[#f3f1ed] px-2.5 py-1 text-[11px] text-[#655d54]">
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
      <div className="text-[12px] font-medium tracking-[0.08em] text-[#8a8176]">{label}</div>
      <div
        className={[
          "mt-1 break-all text-[13px] leading-6 text-[#312d28]",
          mono ? "whitespace-pre-wrap rounded-[14px] bg-[#f7f6f4] px-4 py-3 font-mono text-[12px]" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
