import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  BrowserTabIcon,
  FolderIcon,
  SettingsCogIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { AutomationInboxItem, AutomationRecord } from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { SettingsHostDropdown } from "../../components/SettingsHostDropdown";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import {
  CompactRailSelect,
  CompactScheduleEditor,
  AUTOMATION_REASONING_OPTIONS,
  formatReasoningLabel,
} from "./AutomationsCompactControls";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationPreviousRunsList } from "./AutomationPreviousRunsList";
import type { FeedbackState, TranslateFn } from "./automationsPageUtils";
import {
  describeScheduleConfig,
  getScheduleConfigForAutomation,
  formatStatusLabel,
  formatWorkspaceRootsLabel,
  scheduleConfigToRrule,
  type HeartbeatThreadOption,
  type ScheduleConfig,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationsDetailPaneProps = {
  draft: AutomationRecord;
  feedback: FeedbackState;
  heartbeatThreadOptions: HeartbeatThreadOption[];
  inboxItems: AutomationInboxItem[];
  isInboxItemsLoading: boolean;
  isSaving: boolean;
  lastRunLabel: string;
  localEnvironmentState: AutomationLocalEnvironmentState;
  hasConnectedRemoteConnections: boolean;
  nextRunLabel: string;
  onClearDraft: () => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  onOpenThread: (threadId: string) => void | Promise<void>;
  onSetInboxItemReadState: (id: string, isRead: boolean) => Promise<void>;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  modelOptions: ModelListEntry[];
  locale: string;
  threadTitleById: ReadonlyMap<string, string>;
  workspaceRootOptions: string[];
  workspaceRootLabels: Record<string, string>;
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
      <div className="min-w-0 text-right">{value}</div>
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
  heartbeatThreadOptions,
  inboxItems,
  isInboxItemsLoading,
  isSaving,
  lastRunLabel,
  localEnvironmentState,
  hasConnectedRemoteConnections,
  nextRunLabel,
  onClearDraft,
  onDraftChange,
  onOpenThread,
  onSetInboxItemReadState,
  onOpenLocalEnvironmentsSettings,
  modelOptions,
  locale,
  threadTitleById,
  workspaceRootOptions,
  workspaceRootLabels,
  t,
}: AutomationsDetailPaneProps) {
  const [cronScheduleConfig, setCronScheduleConfig] = useState<ScheduleConfig | null>(
    () => (draft.kind === "cron" ? getScheduleConfigForAutomation(draft) : null),
  );
  const [heartbeatScheduleConfig, setHeartbeatScheduleConfig] =
    useState<ScheduleConfig | null>(() =>
      draft.kind === "heartbeat" ? getScheduleConfigForAutomation(draft) : null,
    );

  useEffect(() => {
    if (draft.kind === "cron") {
      setCronScheduleConfig(getScheduleConfigForAutomation(draft));
      return;
    }

    setCronScheduleConfig(null);
  }, [draft.id, draft.kind, draft.rrule]);

  useEffect(() => {
    if (draft.kind === "heartbeat") {
      setHeartbeatScheduleConfig(getScheduleConfigForAutomation(draft));
      return;
    }

    setHeartbeatScheduleConfig(null);
  }, [draft.id, draft.kind, draft.rrule]);

  const effectiveCronScheduleConfig =
    draft.kind === "cron"
      ? cronScheduleConfig ?? getScheduleConfigForAutomation(draft)
      : null;
  const effectiveHeartbeatScheduleConfig =
    draft.kind === "heartbeat"
      ? heartbeatScheduleConfig ?? getScheduleConfigForAutomation(draft)
      : null;

  const heartbeatThreadDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }),
    [locale],
  );
  const selectedHeartbeatThread = heartbeatThreadOptions.find(
    (thread) => draft.kind === "heartbeat" && thread.id === draft.targetThreadId,
  );
  const selectedWorkspaceRootId =
    draft.kind === "cron" ? draft.cwds[0] ?? "" : "";
  const selectedWorkspaceRootLabel =
    draft.kind === "cron" && selectedWorkspaceRootId.length > 0
      ? formatWorkspaceRootsLabel(
          [selectedWorkspaceRootId],
          locale,
          workspaceRootLabels,
          t,
        )
      : t("settings.automations.projectDropdown.placeholder");
  const selectedModelLabel =
    draft.kind === "cron" && draft.model && modelOptions.length > 0
      ? modelOptions.find((option) => option.id === draft.model)?.id ?? draft.model
      : t("settings.automations.model.loading");
  const selectedReasoningLabel =
    draft.reasoningEffort && draft.reasoningEffort.trim().length > 0
      ? formatReasoningLabel(draft.reasoningEffort, t)
      : t("settings.automations.reasoning.loading");

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
              heartbeatThreadOptions={heartbeatThreadOptions}
              localEnvironmentState={localEnvironmentState}
              locale={locale}
              modelOptions={modelOptions}
              onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
              onDraftChange={onDraftChange}
              workspaceRootLabels={workspaceRootLabels}
              workspaceRootOptions={workspaceRootOptions}
              t={t}
            />
          </div>

          <aside className="flex shrink-0 flex-col border-t border-[var(--app-shell-border)] bg-[var(--app-shell-right)] lg:w-96 lg:border-t-0 lg:border-l">
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
                      <CompactRailSelect
                        ariaLabel={t("settings.automations.executionEnvironment.ariaLabel")}
                        icon={
                          draft.executionEnvironment === "worktree" ? (
                            <WorkspaceFileIcon className="h-4 w-4 shrink-0" />
                          ) : (
                            <FolderIcon className="h-4 w-4 shrink-0" />
                          )
                        }
                        menuTitle={t("settings.automations.executionEnvironment.menuTitle")}
                        triggerLabel={
                          draft.executionEnvironment === "worktree"
                            ? t("settings.automations.executionEnvironment.worktree")
                            : t("settings.automations.executionEnvironment.local")
                        }
                        options={[
                          {
                            id: "local",
                            label: t("settings.automations.executionEnvironment.local"),
                            description: t("settings.automations.executionEnvironment.local.help"),
                          },
                          {
                            id: "worktree",
                            label: t("settings.automations.executionEnvironment.worktree"),
                            description: t(
                              "settings.automations.executionEnvironment.worktree.help",
                            ),
                          },
                        ]}
                        selectedId={draft.executionEnvironment}
                        onSelect={(value) =>
                          onDraftChange((current) =>
                            current && current.kind === "cron"
                              ? {
                                  ...current,
                                  executionEnvironment: value,
                                  localEnvironmentConfigPath:
                                    value === "worktree"
                                      ? current.localEnvironmentConfigPath
                                      : null,
                                }
                              : current,
                          )
                        }
                      />
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
                  value={
                    draft.kind === "heartbeat" ? (
                      <CompactRailSelect
                        ariaLabel={t("settings.automations.heartbeatThread.ariaLabel")}
                        icon={<BrowserTabIcon className="h-4 w-4 shrink-0" />}
                        menuTitle={t("settings.automations.heartbeatThread.title")}
                        triggerLabel={
                          selectedHeartbeatThread?.title ??
                          t("settings.automations.heartbeatThread.placeholder")
                        }
                        emptyLabel={t("settings.automations.heartbeatThread.empty")}
                        options={heartbeatThreadOptions.map((thread) => ({
                          description:
                            thread.createdAt !== null && thread.createdAt > 0
                              ? heartbeatThreadDateFormatter.format(
                                  new Date(thread.createdAt * 1000),
                                )
                              : undefined,
                          disabled: thread.unavailable,
                          id: thread.id,
                          label: thread.title,
                          secondaryLabel: thread.isPinned
                            ? undefined
                            : t("settings.automations.heartbeatThread.unpinned"),
                        }))}
                        selectedId={draft.targetThreadId}
                        onSelect={(value) =>
                          onDraftChange((current) =>
                            current && current.kind === "heartbeat"
                              ? { ...current, targetThreadId: value }
                              : current,
                          )
                        }
                      />
                    ) : (
                      <CompactRailSelect
                        ariaLabel={t("settings.automations.projectDropdown.placeholder")}
                        icon={<FolderIcon className="h-4 w-4 shrink-0" />}
                        menuTitle={t("inbox.automations.folder.label")}
                        triggerLabel={selectedWorkspaceRootLabel}
                        options={workspaceRootOptions.map((root) => ({
                          id: root,
                          label: formatWorkspaceRootsLabel(
                            [root],
                            locale,
                            workspaceRootLabels,
                            t,
                          ),
                        }))}
                        selectedId={selectedWorkspaceRootId}
                        onSelect={(value) =>
                          onDraftChange((current) =>
                            current && current.kind === "cron"
                              ? { ...current, cwds: value ? [value] : [] }
                              : current,
                          )
                        }
                      />
                    )
                  }
                />
                <RailRow
                  label={
                    draft.kind === "heartbeat"
                      ? t("inbox.automations.interval.label")
                      : t("inbox.automations.repeats.label")
                  }
                  value={
                    draft.kind === "heartbeat" ? (
                      <CompactScheduleEditor
                        locale={locale}
                        modeOptions={[
                          {
                            id: "hourly",
                            label: t("settings.automations.scheduleMode.interval"),
                          },
                          {
                            id: "daily",
                            label: t("settings.automations.scheduleMode.daily"),
                          },
                          {
                            id: "weekdays",
                            label: t("settings.automations.scheduleMode.weekdays"),
                          },
                          {
                            id: "weekly",
                            label: t("settings.automations.scheduleMode.weekly"),
                          },
                          {
                            id: "custom",
                            label: t("settings.automations.scheduleMode.custom"),
                          },
                        ]}
                        scheduleConfig={
                          effectiveHeartbeatScheduleConfig ??
                          getScheduleConfigForAutomation(draft)
                        }
                        t={t}
                        onChange={(nextConfig) => {
                          setHeartbeatScheduleConfig(nextConfig);
                          onDraftChange((current) =>
                            current && current.kind === "heartbeat"
                              ? {
                                  ...current,
                                  rrule: scheduleConfigToRrule(nextConfig),
                                }
                              : current,
                          );
                        }}
                      />
                    ) : (
                      <CompactScheduleEditor
                        locale={locale}
                        modeOptions={[
                          {
                            id: "daily",
                            label: t("settings.automations.scheduleMode.daily"),
                          },
                          {
                            id: "weekdays",
                            label: t("settings.automations.scheduleMode.weekdays"),
                          },
                          {
                            id: "weekly",
                            label: t("settings.automations.scheduleMode.weekly"),
                          },
                          {
                            id: "custom",
                            label: t("settings.automations.scheduleMode.custom"),
                          },
                        ]}
                        scheduleConfig={
                          effectiveCronScheduleConfig ??
                          getScheduleConfigForAutomation(draft)
                        }
                        t={t}
                        onChange={(nextConfig) => {
                          setCronScheduleConfig(nextConfig);
                          onDraftChange((current) =>
                            current && current.kind === "cron"
                              ? {
                                  ...current,
                                  rrule: scheduleConfigToRrule(nextConfig),
                                }
                              : current,
                          );
                        }}
                      />
                    )
                  }
                />
                {draft.kind === "cron" ? (
                  <>
                    <RailRow
                      label={t("inbox.automations.model.label")}
                      value={
                        <CompactRailSelect
                          ariaLabel={t("settings.automations.model.ariaLabel")}
                          icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
                          menuTitle={t("settings.automations.model.title")}
                          triggerLabel={selectedModelLabel}
                          emptyLabel={t("settings.automations.model.loading")}
                          options={modelOptions.map((modelOption) => ({
                            id: modelOption.id,
                            label: modelOption.id,
                          }))}
                          selectedId={draft.model ?? ""}
                          onSelect={(value) =>
                            onDraftChange((current) =>
                              current && current.kind === "cron"
                                ? { ...current, model: value || null }
                                : current,
                            )
                          }
                        />
                      }
                    />
                    <RailRow
                      label={t("inbox.automations.reasoning.label")}
                      value={
                        <CompactRailSelect
                          ariaLabel={t("settings.automations.reasoning.ariaLabel")}
                          icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
                          menuTitle={t("settings.automations.reasoning.title")}
                          triggerLabel={selectedReasoningLabel}
                          emptyLabel={t("settings.automations.reasoning.loading")}
                          options={AUTOMATION_REASONING_OPTIONS.map((option) => ({
                            id: option.id,
                            label: formatReasoningLabel(option.id, t),
                          }))}
                          selectedId={draft.reasoningEffort ?? ""}
                          onSelect={(value) =>
                            onDraftChange((current) =>
                              current && current.kind === "cron"
                                ? { ...current, reasoningEffort: value || null }
                                : current,
                            )
                          }
                        />
                      }
                    />
                    <div className="mt-6 min-h-0 flex-1">
                      <SectionLabel>{t("inbox.automations.history")}</SectionLabel>
                      <div className="min-h-0 flex-1">
                        <AutomationPreviousRunsList
                          automationId={draft.id}
                          formatRootLabel={(root: string) =>
                            formatWorkspaceRootsLabel([root], locale, workspaceRootLabels, t)
                          }
                          inboxItems={inboxItems}
                          isLoading={isInboxItemsLoading}
                          onOpenThread={onOpenThread}
                          onSetInboxItemReadState={onSetInboxItemReadState}
                          threadTitleById={threadTitleById}
                          t={t}
                        />
                      </div>
                    </div>
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

