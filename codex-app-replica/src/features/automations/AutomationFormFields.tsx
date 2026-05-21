import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  BrowserTabIcon,
  FolderIcon,
  SettingsCogIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { AutomationRecord } from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import {
  AUTOMATION_REASONING_OPTIONS,
  CompactRailSelect,
  CompactScheduleEditor,
  formatReasoningLabel,
} from "./AutomationsCompactControls";
import type {
  HeartbeatThreadOption,
  ScheduleConfig,
  TranslateFn,
} from "./automationsPageUtils";
import type { MessageKey } from "../../i18n/messages";
import {
  formatWorkspaceRootsLabel,
  getScheduleConfigForAutomation,
  scheduleConfigToRrule,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationFormFieldsVariant = "compactRail" | "stacked";

export type AutomationFormFieldsProps = {
  draft: AutomationRecord;
  heartbeatThreadOptions: HeartbeatThreadOption[];
  localEnvironmentState: AutomationLocalEnvironmentState;
  locale: string;
  modelOptions: ModelListEntry[];
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  showPromptField?: boolean;
  useCreateCompactRailProjectPlaceholder?: boolean;
  variant?: AutomationFormFieldsVariant;
  workspaceRootLabels: Record<string, string>;
  workspaceRootOptions: string[];
  t: TranslateFn;
};

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="app-title text-[13px] font-medium">{label}</span>
      {children}
    </label>
  );
}

function CompactField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex items-center gap-1">
      <span className="shrink-0 text-sm text-token-description-foreground">{label}</span>
      {children}
    </div>
  );
}

type SelectorState = {
  scheduleConfig: ScheduleConfig;
  selectedModelLabel: string;
  selectedReasoningLabel: string;
  selectedWorkspaceRootId: string;
  selectedWorkspaceRootLabel: string;
};

function useSelectorState({
  draft,
  locale,
  modelOptions,
  projectPlaceholderKey,
  t,
  workspaceRootLabels,
}: {
  draft: AutomationRecord;
  locale: string;
  modelOptions: ModelListEntry[];
  projectPlaceholderKey: MessageKey;
  t: TranslateFn;
  workspaceRootLabels: Record<string, string>;
}): SelectorState {
  return useMemo(() => {
    const scheduleConfig = getScheduleConfigForAutomation(draft);
    const selectedWorkspaceRootId = draft.kind === "cron" ? draft.cwds[0] ?? "" : "";
    const selectedWorkspaceRootLabel =
      draft.kind === "cron" && selectedWorkspaceRootId.length > 0
        ? formatWorkspaceRootsLabel(
            [selectedWorkspaceRootId],
            locale,
            workspaceRootLabels,
            t,
          )
        : t(projectPlaceholderKey);
    const selectedModelLabel =
      draft.kind === "cron" && draft.model && modelOptions.length > 0
        ? modelOptions.find((option) => option.id === draft.model)?.id ?? draft.model
        : t("settings.automations.model.loading");
    const selectedReasoningLabel =
      draft.kind === "cron" &&
      draft.reasoningEffort &&
      draft.reasoningEffort.trim().length > 0
        ? formatReasoningLabel(draft.reasoningEffort, t)
        : t("settings.automations.reasoning.loading");

    return {
      scheduleConfig,
      selectedModelLabel,
      selectedReasoningLabel,
      selectedWorkspaceRootId,
      selectedWorkspaceRootLabel,
    };
  }, [draft, locale, modelOptions, projectPlaceholderKey, t, workspaceRootLabels]);
}

export function AutomationFormFields({
  draft,
  heartbeatThreadOptions,
  localEnvironmentState,
  locale,
  modelOptions,
  onOpenLocalEnvironmentsSettings,
  onDraftChange,
  showPromptField = true,
  useCreateCompactRailProjectPlaceholder = false,
  variant = "stacked",
  workspaceRootLabels,
  workspaceRootOptions,
  t,
}: AutomationFormFieldsProps) {
  const projectPlaceholderKey =
    useCreateCompactRailProjectPlaceholder && draft.kind === "cron"
      ? "settings.automations.cwdPlaceholder"
      : "settings.automations.projectDropdown.placeholder";
  const {
    scheduleConfig,
    selectedModelLabel,
    selectedReasoningLabel,
    selectedWorkspaceRootId,
    selectedWorkspaceRootLabel,
  } = useSelectorState({
    draft,
    locale,
    modelOptions,
    projectPlaceholderKey,
    t,
    workspaceRootLabels,
  });
  const isCompactRail = variant === "compactRail";
  const FieldWrapper = isCompactRail ? CompactField : FormField;
  const triggerClassName = isCompactRail ? "max-w-52 min-w-0 shrink" : undefined;
  const showIcon = !isCompactRail;

  const projectField = draft.kind === "heartbeat" ? (
    <FieldWrapper label={t("inbox.automations.targetThread.label")}>
      <CompactRailSelect
        ariaLabel={t("settings.automations.heartbeatThread.ariaLabel")}
        className={triggerClassName}
        emptyLabel={t("settings.automations.heartbeatThread.empty")}
        icon={<BrowserTabIcon className="h-4 w-4 shrink-0" />}
        menuTitle={t("settings.automations.heartbeatThread.title")}
        options={heartbeatThreadOptions.map((thread) => ({
          disabled: thread.unavailable,
          id: thread.id,
          label: thread.title,
          secondaryLabel: thread.isPinned
            ? undefined
            : t("settings.automations.heartbeatThread.unpinned"),
        }))}
        selectedId={draft.targetThreadId}
        showIcon={showIcon}
        triggerLabel={
          heartbeatThreadOptions.find((thread) => thread.id === draft.targetThreadId)?.title ??
          t("settings.automations.heartbeatThread.placeholder")
        }
        onSelect={(value) =>
          onDraftChange((current) =>
            current && current.kind === "heartbeat"
              ? { ...current, targetThreadId: value }
              : current,
          )
        }
      />
    </FieldWrapper>
  ) : (
    <FieldWrapper label={t("inbox.automations.folder.label")}>
      <CompactRailSelect
        ariaLabel={t(projectPlaceholderKey)}
        className={triggerClassName}
        icon={<FolderIcon className="h-4 w-4 shrink-0" />}
        menuTitle={t("inbox.automations.folder.label")}
        options={workspaceRootOptions.map((root) => ({
          id: root,
          label: formatWorkspaceRootsLabel([root], locale, workspaceRootLabels, t),
        }))}
        selectedId={selectedWorkspaceRootId}
        showIcon={showIcon}
        triggerLabel={selectedWorkspaceRootLabel}
        onSelect={(value) =>
          onDraftChange((current) =>
            current && current.kind === "cron"
              ? { ...current, cwds: value ? [value] : [] }
              : current,
          )
        }
      />
    </FieldWrapper>
  );

  const executionEnvironmentField =
    draft.kind === "cron" ? (
      <FieldWrapper label={t("inbox.automations.executionEnvironment.label")}>
        <CompactRailSelect
          ariaLabel={t("settings.automations.executionEnvironment.ariaLabel")}
          className={triggerClassName}
          icon={
            draft.executionEnvironment === "worktree" ? (
              <WorkspaceFileIcon className="h-4 w-4 shrink-0" />
            ) : (
              <FolderIcon className="h-4 w-4 shrink-0" />
            )
          }
          menuTitle={t("settings.automations.executionEnvironment.menuTitle")}
          options={[
            {
              id: "local",
              label: t("settings.automations.executionEnvironment.local"),
              description: t("settings.automations.executionEnvironment.local.help"),
            },
            {
              id: "worktree",
              label: t("settings.automations.executionEnvironment.worktree"),
              description: t("settings.automations.executionEnvironment.worktree.help"),
            },
          ]}
          selectedId={draft.executionEnvironment}
          showIcon={showIcon}
          triggerLabel={
            draft.executionEnvironment === "worktree"
              ? t("settings.automations.executionEnvironment.worktree")
              : t("settings.automations.executionEnvironment.local")
          }
          onSelect={(value) =>
            onDraftChange((current) =>
              current && current.kind === "cron"
                ? {
                    ...current,
                    executionEnvironment: value,
                    localEnvironmentConfigPath:
                      value === "worktree" ? current.localEnvironmentConfigPath : null,
                  }
                : current,
            )
          }
        />
      </FieldWrapper>
    ) : null;

  const localEnvironmentField =
    draft.kind === "cron" && localEnvironmentState.visible ? (
      <FieldWrapper label={t("inbox.automations.localEnvironment.label")}>
        <AutomationLocalEnvironmentSelector
          className={isCompactRail ? "max-w-52 min-w-0 shrink" : undefined}
          fullWidth={!isCompactRail}
          labelClassName={isCompactRail ? "text-token-foreground" : undefined}
          onOpenSettings={onOpenLocalEnvironmentsSettings}
          showIcon={showIcon}
          state={localEnvironmentState}
          t={t}
        />
      </FieldWrapper>
    ) : null;

  const modelField =
    draft.kind === "cron" ? (
      <FieldWrapper label={t("inbox.automations.model.label")}>
        <CompactRailSelect
          ariaLabel={t("settings.automations.model.ariaLabel")}
          className={triggerClassName}
          emptyLabel={t("settings.automations.model.loading")}
          icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
          menuTitle={t("settings.automations.model.title")}
          options={modelOptions.map((modelOption) => ({
            id: modelOption.id,
            label: modelOption.id,
          }))}
          selectedId={draft.model ?? ""}
          showIcon={showIcon}
          triggerLabel={selectedModelLabel}
          onSelect={(value) =>
            onDraftChange((current) =>
              current && current.kind === "cron"
                ? { ...current, model: value || null }
                : current,
            )
          }
        />
      </FieldWrapper>
    ) : null;

  const reasoningField =
    draft.kind === "cron" ? (
      <FieldWrapper label={t("inbox.automations.reasoning.label")}>
        <CompactRailSelect
          ariaLabel={t("settings.automations.reasoning.ariaLabel")}
          className={triggerClassName}
          emptyLabel={t("settings.automations.reasoning.loading")}
          icon={<SettingsCogIcon className="h-4 w-4 shrink-0" />}
          menuTitle={t("settings.automations.reasoning.title")}
          options={AUTOMATION_REASONING_OPTIONS.map((option) => ({
            id: option.id,
            label: formatReasoningLabel(option.id, t),
          }))}
          selectedId={draft.reasoningEffort ?? ""}
          showIcon={showIcon}
          triggerLabel={selectedReasoningLabel}
          onSelect={(value) =>
            onDraftChange((current) =>
              current && current.kind === "cron"
                ? { ...current, reasoningEffort: value || null }
                : current,
            )
          }
        />
      </FieldWrapper>
    ) : null;

  const scheduleField = (
    <FieldWrapper
      label={
        draft.kind === "heartbeat"
          ? t("inbox.automations.interval.label")
          : t("inbox.automations.repeats.label")
      }
    >
      <CompactScheduleEditor
        className={triggerClassName}
        locale={locale}
        modeOptions={
          draft.kind === "heartbeat"
            ? [
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
              ]
            : [
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
              ]
        }
        scheduleConfig={scheduleConfig}
        showIcon={showIcon}
        t={t}
        onChange={(nextConfig) =>
          onDraftChange((current) =>
            current
              ? {
                  ...current,
                  rrule: scheduleConfigToRrule(nextConfig),
                }
              : current,
          )
        }
      />
    </FieldWrapper>
  );

  return (
    <div className={isCompactRail ? "flex min-w-0 flex-wrap items-center gap-3" : "grid gap-5"}>
      {showPromptField ? (
        <FormField label={t("settings.automations.promptLabel")}>
          <textarea
            value={draft.prompt}
            onChange={(event) =>
              onDraftChange((current) =>
                current ? { ...current, prompt: event.target.value } : current,
              )
            }
            placeholder={t("settings.automations.promptPlaceholder")}
            className="app-input min-h-[160px] rounded-[12px] px-3 py-3 text-[14px] leading-6"
          />
        </FormField>
      ) : null}
      {isCompactRail ? (
        draft.kind === "heartbeat" ? (
          <>
            {projectField}
            {scheduleField}
          </>
        ) : (
          <>
            {executionEnvironmentField}
            {projectField}
            {scheduleField}
            {modelField}
            {reasoningField}
          </>
        )
      ) : (
        <>
          {projectField}
          {executionEnvironmentField}
          {localEnvironmentField}
          {scheduleField}
          {modelField}
          {reasoningField}
        </>
      )}
    </div>
  );
}
