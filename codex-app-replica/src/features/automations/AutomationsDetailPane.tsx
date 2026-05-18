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
  selectedHostId: string;
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
  const toneClassName =
    status === "ACTIVE"
      ? "bg-token-charts-green/15 text-token-charts-green"
      : status === "PAUSED"
        ? "bg-token-charts-orange/15 text-token-charts-orange"
        : "bg-token-charts-red/15 text-token-charts-red";
  const dotClassName =
    status === "ACTIVE"
      ? "bg-token-charts-green"
      : status === "PAUSED"
        ? "bg-token-charts-orange"
        : "bg-token-charts-red";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-base",
        toneClassName,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", dotClassName].join(" ")} />
      {formatStatusLabel(status, t)}
    </span>
  );
}

function RailPill({ children }: { children: ReactNode }) {
  return (
    <span className="app-badge inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-base">
      {children}
    </span>
  );
}

function CompactRailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center h-[1.875rem] w-full grid-cols-[auto_minmax(0,1fr)] gap-x-6 overflow-x-hidden rounded-lg text-base leading-[18px] text-token-foreground electron:opacity-75">
      <div className="min-w-0 flex items-center pr-2 pl-1 text-left">{label}</div>
      <div className="min-w-0 flex items-center justify-end justify-self-stretch overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function CompactSectionLabel({
  children,
  topPadding = false,
}: {
  children: ReactNode;
  topPadding?: boolean;
}) {
  return (
    <div
      className={
        topPadding
          ? "px-1 pt-6 pb-2 text-base text-token-input-placeholder-foreground opacity-75"
          : "px-1 py-2 text-base text-token-input-placeholder-foreground opacity-75"
      }
    >
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
  selectedHostId,
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
                <CompactSectionLabel>{t("inbox.automations.statusSection")}</CompactSectionLabel>
                <CompactRailRow
                  label={t("inbox.automations.status.label")}
                >
                  <StatusBadge status={draft.status} t={t} />
                </CompactRailRow>
                <CompactRailRow
                  label={t("inbox.automations.nextRun.label")}
                >
                  <RailPill>{nextRunLabel}</RailPill>
                </CompactRailRow>
                <CompactRailRow
                  label={t("inbox.automations.lastRun.label")}
                >
                  <RailPill>{lastRunLabel}</RailPill>
                </CompactRailRow>
              </div>

              <div className="flex flex-col">
                <CompactSectionLabel topPadding>
                  {t("inbox.automations.details")}
                </CompactSectionLabel>
                {draft.kind === "cron" ? (
                  <CompactRailRow
                    label={t("inbox.automations.executionEnvironment.label")}
                  >
                    <CompactRailSelect
                      align="end"
                      ariaLabel={t("settings.automations.executionEnvironment.ariaLabel")}
                      className="!text-base"
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
                      showIcon={false}
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
                  </CompactRailRow>
                ) : null}
                {draft.kind === "cron" && hasConnectedRemoteConnections ? (
                  <CompactRailRow
                    label={t("inbox.automations.host.label")}
                  >
                    <SettingsHostDropdown
                      align="end"
                      connectedRemoteConnections={[]}
                      contentWidth="menuWide"
                      onSelectHost={() => {}}
                      remoteConnectionHostIds={[]}
                      selectedHostId={selectedHostId}
                      triggerClassName="!w-auto max-w-full !text-base"
                      triggerColor="ghost"
                      t={t}
                    />
                  </CompactRailRow>
                ) : null}
                {draft.kind === "cron" && localEnvironmentState.visible ? (
                  <CompactRailRow
                    label={t("inbox.automations.localEnvironment.label")}
                  >
                    <AutomationLocalEnvironmentSelector
                      align="end"
                      className="min-w-[160px] justify-end !text-base"
                      fullWidth={false}
                      labelClassName="text-token-foreground"
                      onOpenSettings={onOpenLocalEnvironmentsSettings}
                      showIcon={false}
                      state={localEnvironmentState}
                      t={t}
                    />
                  </CompactRailRow>
                ) : null}
                <CompactRailRow
                  label={
                    draft.kind === "heartbeat"
                      ? t("inbox.automations.targetThread.label")
                      : t("inbox.automations.folder.label")
                  }
                >
                  {draft.kind === "heartbeat" ? (
                    <CompactRailSelect
                      align="end"
                      ariaLabel={t("settings.automations.heartbeatThread.ariaLabel")}
                      className="!text-base"
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
                      showIcon={false}
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
                      align="end"
                      ariaLabel={t("settings.automations.projectDropdown.placeholder")}
                      className="!text-base"
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
                      showIcon={false}
                      onSelect={(value) =>
                        onDraftChange((current) =>
                          current && current.kind === "cron"
                            ? { ...current, cwds: value ? [value] : [] }
                            : current,
                        )
                      }
                    />
                  )}
                </CompactRailRow>
                <CompactRailRow
                  label={
                    draft.kind === "heartbeat"
                      ? t("inbox.automations.interval.label")
                      : t("inbox.automations.repeats.label")
                  }
                >
                  {draft.kind === "heartbeat" ? (
                    <CompactScheduleEditor
                      align="end"
                      className="!text-base"
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
                      showIcon={false}
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
                      align="end"
                      className="!text-base"
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
                      showIcon={false}
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
                  )}
                </CompactRailRow>
                {draft.kind === "cron" ? (
                  <>
                    <CompactRailRow
                      label={t("inbox.automations.model.label")}
                    >
                      <CompactRailSelect
                        align="end"
                        ariaLabel={t("settings.automations.model.ariaLabel")}
                        className="!text-base"
                        icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
                        menuTitle={t("settings.automations.model.title")}
                        triggerLabel={selectedModelLabel}
                        emptyLabel={t("settings.automations.model.loading")}
                        options={modelOptions.map((modelOption) => ({
                          id: modelOption.id,
                          label: modelOption.id,
                        }))}
                        selectedId={draft.model ?? ""}
                        showIcon={false}
                        onSelect={(value) =>
                          onDraftChange((current) =>
                            current && current.kind === "cron"
                              ? { ...current, model: value || null }
                              : current,
                          )
                        }
                      />
                    </CompactRailRow>
                    <CompactRailRow
                      label={t("inbox.automations.reasoning.label")}
                    >
                      <CompactRailSelect
                        align="end"
                        ariaLabel={t("settings.automations.reasoning.ariaLabel")}
                        className="!text-base"
                        icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
                        menuTitle={t("settings.automations.reasoning.title")}
                        triggerLabel={selectedReasoningLabel}
                        emptyLabel={t("settings.automations.reasoning.loading")}
                        options={AUTOMATION_REASONING_OPTIONS.map((option) => ({
                          id: option.id,
                          label: formatReasoningLabel(option.id, t),
                        }))}
                        selectedId={draft.reasoningEffort ?? ""}
                        showIcon={false}
                        onSelect={(value) =>
                          onDraftChange((current) =>
                            current && current.kind === "cron"
                              ? { ...current, reasoningEffort: value || null }
                              : current,
                          )
                        }
                      />
                    </CompactRailRow>
                    <div className="min-h-0 flex-1">
                      <CompactSectionLabel topPadding>
                        {t("inbox.automations.history")}
                      </CompactSectionLabel>
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
