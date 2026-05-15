import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  BrowserTabIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  FolderIcon,
  SettingsCogIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { AutomationInboxItem, AutomationRecord } from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { SettingsHostDropdown } from "../../components/SettingsHostDropdown";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationPreviousRunsList } from "./AutomationPreviousRunsList";
import type { FeedbackState, TranslateFn } from "./automationsPageUtils";
import {
  describeScheduleConfig,
  getScheduleConfigForAutomation,
  formatStatusLabel,
  formatWorkspaceRootsLabel,
  normalizeScheduleIntervalHours,
  normalizeScheduleIntervalMinutes,
  scheduleConfigToRrule,
  transitionScheduleMode,
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
              onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
              onDraftChange={onDraftChange}
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
                          options={REASONING_OPTIONS.map((option) => ({
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
                          formatRootLabel={(root) =>
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

const WEEKDAY_OPTIONS = [
  { id: "MO", key: "settings.automations.scheduleSummary.mondaysLabel" },
  { id: "TU", key: "settings.automations.scheduleSummary.tuesdaysLabel" },
  { id: "WE", key: "settings.automations.scheduleSummary.wednesdaysLabel" },
  { id: "TH", key: "settings.automations.scheduleSummary.thursdaysLabel" },
  { id: "FR", key: "settings.automations.scheduleSummary.fridaysLabel" },
  { id: "SA", key: "settings.automations.scheduleSummary.saturdaysLabel" },
  { id: "SU", key: "settings.automations.scheduleSummary.sundaysLabel" },
] as const;

const REASONING_OPTIONS = [
  { id: "none" },
  { id: "minimal" },
  { id: "low" },
  { id: "medium" },
  { id: "high" },
  { id: "xhigh" },
] as const;

type CompactRailOption = {
  disabled?: boolean;
  secondaryLabel?: string;
  id: string;
  label: string;
  description?: string;
};

const MINUTES_PER_DAY = 1_440;
const TIME_PICKER_INTERVAL_MINUTES = 15;
const TIME_PICKER_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / TIME_PICKER_INTERVAL_MINUTES },
  (_, index) => {
    const totalMinutes = index * TIME_PICKER_INTERVAL_MINUTES;
    return formatTimePickerValue(
      Math.floor(totalMinutes / 60),
      totalMinutes % 60,
    );
  },
);

function useCloseOnOutsidePointerDown(
  containerRef: { current: HTMLDivElement | null },
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [containerRef, isOpen, onClose]);
}

function CompactRailSelect({
  ariaLabel,
  emptyLabel,
  icon,
  menuTitle,
  onSelect,
  options,
  selectedId,
  triggerLabel,
}: {
  ariaLabel: string;
  emptyLabel?: string;
  icon?: ReactNode;
  menuTitle?: string;
  onSelect: (id: string) => void;
  options: CompactRailOption[];
  selectedId: string;
  triggerLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.id === selectedId) ?? null;
  const resolvedTriggerLabel =
    selectedOption?.label ?? triggerLabel ?? emptyLabel ?? "";
  useCloseOnOutsidePointerDown(containerRef, isOpen, () => {
    setIsOpen(false);
  });

  return (
    <div ref={containerRef} className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((current) => !current)}
        className="app-control flex min-w-[160px] max-w-[220px] items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate text-left text-[var(--app-shell-title)]">
            {resolvedTriggerLabel}
          </span>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-64 rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {menuTitle ? (
            <div className="px-3 py-2 text-[12px] font-medium text-[var(--app-shell-title)]">
              {menuTitle}
            </div>
          ) : null}
          <div className="flex max-h-[240px] flex-col overflow-y-auto">
            {options.length > 0 ? (
              options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }
                      onSelect(option.id);
                      setIsOpen(false);
                    }}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                      isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                      option.disabled
                        ? "cursor-default opacity-50"
                        : "disabled:cursor-default disabled:opacity-50",
                    ].join(" ")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="block truncate">{option.label}</span>
                        {option.secondaryLabel ? (
                          <span className="truncate text-[12px] text-[var(--app-shell-subtle)]">
                            {option.secondaryLabel}
                          </span>
                        ) : null}
                      </span>
                      {option.description ? (
                        <span className="app-text-muted mt-1 block whitespace-normal text-[12px] leading-5">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-[13px] app-text-muted">
                {emptyLabel ?? triggerLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactScheduleEditor({
  locale,
  modeOptions,
  onChange,
  scheduleConfig,
  t,
}: {
  locale: string;
  modeOptions: Array<{ id: ScheduleConfig["mode"]; label: string }>;
  onChange: (nextConfig: ScheduleConfig) => void;
  scheduleConfig: ScheduleConfig;
  t: TranslateFn;
}) {
  const selectedModeLabel =
    modeOptions.find((option) => option.id === scheduleConfig.mode)?.label ??
    t("settings.automations.scheduleMode.custom");
  const selectedWeekdayId = scheduleConfig.weekdays[0] ?? "MO";
  const selectedWeekdayOption = WEEKDAY_OPTIONS.find(
    (option) => option.id === selectedWeekdayId,
  );
  const selectedWeekdayLabel = selectedWeekdayOption
    ? t(selectedWeekdayOption.key)
    : selectedWeekdayId;
  const scheduleSummary = describeScheduleConfig(scheduleConfig, locale, t);
  const isMinuteInterval = scheduleConfig.intervalMinutes !== null;
  const intervalValue =
    scheduleConfig.intervalMinutes ?? scheduleConfig.intervalHours;

  return (
    <div className="flex max-w-[260px] flex-col items-end gap-2">
      <CompactRailSelect
        ariaLabel={t("settings.automations.scheduleModeLabel")}
        emptyLabel={t("settings.automations.scheduleMode.custom")}
        icon={<ClockIcon className="h-4 w-4 shrink-0" />}
        triggerLabel={selectedModeLabel}
        options={modeOptions}
        selectedId={scheduleConfig.mode}
        onSelect={(value) =>
          onChange(transitionScheduleMode(scheduleConfig, value as ScheduleConfig["mode"]))
        }
      />
      {scheduleConfig.mode === "hourly" ? (
        <label className="flex w-full items-center justify-end gap-2 text-[12px] app-text-muted">
          <span>{t("settings.automations.scheduleIntervalLabel")}</span>
          <input
            aria-label={t("settings.automations.scheduleIntervalLabel")}
            className="app-input h-9 w-20 rounded-[10px] px-2 text-[13px]"
            defaultValue={String(intervalValue)}
            inputMode="numeric"
            onBlur={(event) => {
              if (event.currentTarget.value.length === 0) {
                event.currentTarget.value = String(intervalValue);
              }
            }}
            onChange={(event) => {
              const digitsOnly = event.currentTarget.value.replaceAll(/[^0-9]/g, "");
              event.currentTarget.value = digitsOnly;
              if (digitsOnly.length === 0) {
                return;
              }

              if (isMinuteInterval) {
                const nextIntervalMinutes = normalizeScheduleIntervalMinutes(
                  Number(digitsOnly),
                );
                if (nextIntervalMinutes === null) {
                  return;
                }

                onChange({
                  ...scheduleConfig,
                  intervalMinutes: nextIntervalMinutes,
                });
                return;
              }

              const nextIntervalHours = normalizeScheduleIntervalHours(
                Number(digitsOnly),
              );
              if (nextIntervalHours === null) {
                return;
              }

              onChange({
                ...scheduleConfig,
                intervalHours: nextIntervalHours,
              });
            }}
            pattern="[0-9]*"
            type="text"
          />
          <span>{isMinuteInterval ? "m" : "h"}</span>
        </label>
      ) : null}
      {scheduleConfig.mode === "weekly" ? (
        <CompactRailSelect
          ariaLabel={t("settings.automations.scheduleWeekday")}
          triggerLabel={selectedWeekdayLabel}
          options={WEEKDAY_OPTIONS.map((option) => ({
            id: option.id,
            label: t(option.key),
          }))}
          selectedId={selectedWeekdayId}
          onSelect={(value) =>
            onChange({
              ...scheduleConfig,
              weekdays: [value],
            })
          }
        />
      ) : null}
      {scheduleConfig.mode !== "custom" && scheduleConfig.mode !== "hourly" ? (
        <CompactTimePicker
          locale={locale}
          value={scheduleConfig.time}
          t={t}
          onChange={(time) =>
            onChange({
              ...scheduleConfig,
              time,
            })
          }
        />
      ) : null}
      {scheduleConfig.mode === "custom" ? (
        <input
          aria-label={t("settings.automations.scheduleCustomLabel")}
          value={scheduleConfig.customRrule}
          onChange={(event) =>
            onChange({
              ...scheduleConfig,
              customRrule: event.target.value,
            })
          }
          placeholder={t("settings.automations.scheduleCustomPlaceholder")}
          className="app-input h-9 w-full rounded-[10px] px-2 text-[12px] font-mono"
          spellCheck={false}
        />
      ) : (
        <div className="app-text-muted max-w-[220px] text-right text-[12px] leading-5">
          {scheduleSummary}
        </div>
      )}
    </div>
  );
}

function CompactTimePicker({
  locale,
  onChange,
  t,
  value,
}: {
  locale: string;
  onChange: (value: string) => void;
  t: TranslateFn;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snappedValue = snapTimePickerValue(value);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  );
  const timeInputLabel = t("settings.automations.scheduleTime");
  const toggleLabel = isOpen
    ? t("settings.automations.hideTimePicker")
    : t("settings.automations.showTimePicker");

  useCloseOnOutsidePointerDown(containerRef, isOpen, () => {
    setIsOpen(false);
  });

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-1">
      <div className="relative w-full">
        <input
          aria-label={timeInputLabel}
          className="app-input h-9 w-full min-w-[110px] rounded-[10px] px-2 pr-8 text-[13px] [&::-webkit-calendar-picker-indicator]:hidden"
          type="time"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((current) => !current);
          }}
          className={[
            isOpen ? "app-control" : "app-control-weak",
            "absolute top-1/2 right-[5px] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px]",
          ].join(" ")}
        >
          <ClockIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen ? (
        <div
          className="overflow-y-scroll overscroll-contain rounded-lg border border-token-border bg-token-input-background/70 p-1"
          style={{
            maxHeight: "min(14rem, max(3.5rem, calc(100vh - 9rem)))",
          }}
          onWheel={(event) => {
            event.stopPropagation();
          }}
        >
          {TIME_PICKER_OPTIONS.map((optionValue) => {
            const formattedTime = formatTimePickerOptionLabel(
              optionValue,
              timeFormatter,
            );
            const isSelected = optionValue === value;
            return (
              <button
                key={optionValue}
                ref={
                  optionValue === snappedValue
                    ? (node) => {
                        node?.scrollIntoView({
                          block: "center",
                          inline: "nearest",
                        });
                      }
                    : undefined
                }
                type="button"
                aria-label={t("settings.automations.timePicker.setTime", {
                  time: formattedTime,
                })}
                aria-pressed={isSelected}
                className={[
                  "cursor-interaction flex h-7 w-full items-center rounded-md px-2 text-left text-sm tabular-nums outline-none focus:bg-token-list-hover-background",
                  isSelected
                    ? "bg-token-list-hover-background text-token-foreground"
                    : "text-token-secondary hover:bg-token-list-hover-background",
                ].join(" ")}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onChange(optionValue);
                  setIsOpen(false);
                }}
              >
                {formattedTime}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function parseTimePickerValue(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return { hour, minute };
}

function formatTimePickerValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapTimePickerValue(value: string) {
  const parsedValue = parseTimePickerValue(value);
  if (!parsedValue) {
    return null;
  }

  const totalMinutes = parsedValue.hour * 60 + parsedValue.minute;
  const snappedMinutes =
    (Math.floor(totalMinutes / TIME_PICKER_INTERVAL_MINUTES) *
      TIME_PICKER_INTERVAL_MINUTES) %
    MINUTES_PER_DAY;
  return formatTimePickerValue(
    Math.floor(snappedMinutes / 60),
    snappedMinutes % 60,
  );
}

function formatTimePickerOptionLabel(
  value: string,
  formatter: Intl.DateTimeFormat,
) {
  const parsedValue = parseTimePickerValue(value);
  if (!parsedValue) {
    return value;
  }

  return formatter.format(
    new Date(2024, 0, 1, parsedValue.hour, parsedValue.minute),
  );
}

function formatReasoningLabel(value: string, t: TranslateFn) {
  switch (value) {
    case "none":
      return t("settings.agent.approval.never");
    case "minimal":
      return "Minimal";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "Very high";
    default:
      return value;
  }
}
