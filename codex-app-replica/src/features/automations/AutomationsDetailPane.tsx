import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";
import { SettingsHostDropdown } from "../../components/SettingsHostDropdown";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import { AutomationFormFields } from "./AutomationFormFields";
import type { FeedbackState, TranslateFn } from "./automationsPageUtils";
import { formatStatusLabel } from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationsDetailPaneProps = {
  draft: AutomationRecord;
  feedback: FeedbackState;
  isSaving: boolean;
  lastRunLabel: string;
  localEnvironmentState: AutomationLocalEnvironmentState;
  hasConnectedRemoteConnections: boolean;
  nextRunLabel: string;
  onClearDraft: () => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  recentThreads: ThreadHistoryEntry[];
  threadNameById: Map<string, string>;
  t: TranslateFn;
};

function StatusBadge({
  status,
  t,
}: {
  status: AutomationRecord["status"];
  t: TranslateFn;
}) {
  const dotClassName =
    status === "ACTIVE"
      ? "bg-[#2c9f5f]"
      : status === "PAUSED"
        ? "bg-[#c98a1c]"
        : "bg-[var(--app-shell-danger)]";

  return (
    <span className="app-badge inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px]">
      <span className={["h-2 w-2 rounded-full", dotClassName].join(" ")} />
      {formatStatusLabel(status, t)}
    </span>
  );
}

function RailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="app-text-muted">{label}</span>
      <span className="app-title text-right">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 pb-2 text-[13px] font-medium tracking-[0.08em] text-[var(--app-shell-subtle)] uppercase">
      {children}
    </div>
  );
}

export function AutomationsDetailPane({
  draft,
  feedback,
  isSaving,
  lastRunLabel,
  localEnvironmentState,
  hasConnectedRemoteConnections,
  nextRunLabel,
  onClearDraft,
  onDraftChange,
  onOpenLocalEnvironmentsSettings,
  recentThreads,
  threadNameById,
  t,
}: AutomationsDetailPaneProps) {
  const projectLabel =
    draft.kind === "heartbeat"
      ? (threadNameById.get(draft.targetThreadId) ?? draft.targetThreadId) ||
        t("settings.automations.heartbeatThread.placeholder")
      : draft.cwds.join(" · ") || t("inbox.automations.workspaceFallback");

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1080px] flex-1 flex-col px-panel pb-panel">
        {feedback ? (
          <div
            className={[
              feedback.tone === "error" ? "app-card-error" : "app-badge",
              "mt-3 rounded-[14px] px-4 py-3 text-[13px]",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-6 pt-panel lg:flex-row lg:items-stretch">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto lg:pr-6">
            <div className="flex min-w-0 items-start justify-between gap-4 pb-6">
              <div className="min-w-0 flex-1">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    onDraftChange((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  placeholder={t("settings.automations.namePlaceholder")}
                  className="heading-xl min-w-0 w-full bg-transparent p-0 font-normal text-[var(--app-shell-title)] outline-none placeholder:text-[var(--app-shell-subtle)]"
                />
                {isSaving ? (
                  <div className="app-text-muted mt-2 text-[12px]">
                    {t("general.saving")}
                  </div>
                ) : null}
              </div>
              {draft.name.trim().length > 0 || draft.prompt.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={onClearDraft}
                  className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("settings.automations.clear")}
                </button>
              ) : null}
            </div>

            <AutomationFormFields
              draft={draft}
              localEnvironmentState={localEnvironmentState}
              onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
              onDraftChange={onDraftChange}
              recentThreads={recentThreads}
              t={t}
            />
          </div>

          <aside className="flex shrink-0 flex-col border-t border-[var(--app-shell-border)] bg-[var(--app-shell-right)] lg:w-[320px] lg:border-t-0 lg:border-l">
            <div className="flex min-h-0 flex-1 flex-col p-panel">
              <div className="flex flex-col">
                <SectionLabel>{t("inbox.automations.statusSection")}</SectionLabel>
                <RailRow
                  label={t("inbox.automations.status.label")}
                  value={<StatusBadge status={draft.status} t={t} />}
                />
                <RailRow
                  label={t("inbox.automations.nextRun.label")}
                  value={nextRunLabel}
                />
                <RailRow
                  label={t("inbox.automations.lastRun.label")}
                  value={lastRunLabel}
                />
              </div>

              <div className="mt-6 flex flex-col">
                <SectionLabel>{t("inbox.automations.details")}</SectionLabel>
                {draft.kind === "cron" ? (
                  <RailRow
                    label={t("inbox.automations.executionEnvironment.label")}
                    value={
                      draft.executionEnvironment === "worktree"
                        ? t("settings.automations.executionEnvironment.worktree")
                        : t("settings.automations.executionEnvironment.local")
                    }
                  />
                ) : null}
                {draft.kind === "cron" && hasConnectedRemoteConnections ? (
                  <RailRow
                    label={t("inbox.automations.host.label")}
                    value={
                      <SettingsHostDropdown
                        connectedRemoteConnections={[]}
                        onSelectHost={() => {}}
                        remoteConnectionHostIds={[]}
                        selectedHostId={LOCAL_SETTINGS_HOST_ID}
                        t={t}
                      />
                    }
                  />
                ) : null}
                {draft.kind === "cron" && localEnvironmentState.visible ? (
                  <RailRow
                    label={t("inbox.automations.localEnvironment.label")}
                    value={
                      <AutomationLocalEnvironmentSelector
                        align="end"
                        className="min-w-[160px] justify-end"
                        fullWidth={false}
                        labelClassName="text-[var(--app-shell-title)]"
                        onOpenSettings={onOpenLocalEnvironmentsSettings}
                        showIcon={false}
                        state={localEnvironmentState}
                        t={t}
                      />
                    }
                  />
                ) : null}
                <RailRow
                  label={
                    draft.kind === "heartbeat"
                      ? t("inbox.automations.targetThread.label")
                      : t("inbox.automations.folder.label")
                  }
                  value={projectLabel}
                />
                <RailRow
                  label={
                    draft.kind === "heartbeat"
                      ? t("inbox.automations.interval.label")
                      : t("inbox.automations.repeats.label")
                  }
                  value={draft.rrule}
                />
                {draft.kind === "cron" ? (
                  <>
                    <RailRow
                      label={t("inbox.automations.model.label")}
                      value={draft.model ?? t("inbox.automations.workspaceFallback")}
                    />
                    <RailRow
                      label={t("inbox.automations.reasoning.label")}
                      value={
                        draft.reasoningEffort ??
                        t("inbox.automations.workspaceFallback")
                      }
                    />
                  </>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
