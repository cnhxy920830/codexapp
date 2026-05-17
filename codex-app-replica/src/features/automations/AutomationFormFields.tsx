import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  BrowserTabIcon,
  ClockIcon,
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
import {
  formatWorkspaceRootsLabel,
  getScheduleConfigForAutomation,
  scheduleConfigToRrule,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

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

export function AutomationFormFields({
  draft,
  heartbeatThreadOptions,
  localEnvironmentState,
  locale,
  modelOptions,
  onOpenLocalEnvironmentsSettings,
  onDraftChange,
  workspaceRootLabels,
  workspaceRootOptions,
  t,
}: AutomationFormFieldsProps) {
  const scheduleConfig = useMemo<ScheduleConfig>(
    () => getScheduleConfigForAutomation(draft),
    [draft],
  );
  const selectedWorkspaceRootId = draft.kind === "cron" ? draft.cwds[0] ?? "" : "";
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
    draft.kind === "cron" && draft.reasoningEffort && draft.reasoningEffort.trim().length > 0
      ? formatReasoningLabel(draft.reasoningEffort, t)
      : t("settings.automations.reasoning.loading");

  return (
    <div className="grid gap-5">
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

      {draft.kind === "heartbeat" ? (
        <FormField label={t("inbox.automations.targetThread.label")}>
          <CompactRailSelect
            ariaLabel={t("settings.automations.heartbeatThread.ariaLabel")}
            icon={<BrowserTabIcon className="h-4 w-4 shrink-0" />}
            menuTitle={t("settings.automations.heartbeatThread.title")}
            triggerLabel={
              heartbeatThreadOptions.find((thread) => thread.id === draft.targetThreadId)?.title ??
              t("settings.automations.heartbeatThread.placeholder")
            }
            emptyLabel={t("settings.automations.heartbeatThread.empty")}
            options={heartbeatThreadOptions.map((thread) => ({
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
        </FormField>
      ) : (
        <>
          <FormField label={t("inbox.automations.folder.label")}>
            <CompactRailSelect
              ariaLabel={t("settings.automations.projectDropdown.placeholder")}
              icon={<FolderIcon className="h-4 w-4 shrink-0" />}
              menuTitle={t("inbox.automations.folder.label")}
              triggerLabel={selectedWorkspaceRootLabel}
              options={workspaceRootOptions.map((root) => ({
                id: root,
                label: formatWorkspaceRootsLabel([root], locale, workspaceRootLabels, t),
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
          </FormField>

          <FormField label={t("inbox.automations.executionEnvironment.label")}>
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
                  description: t("settings.automations.executionEnvironment.worktree.help"),
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
          </FormField>

          {localEnvironmentState.visible ? (
            <FormField label={t("inbox.automations.localEnvironment.label")}>
              <AutomationLocalEnvironmentSelector
                state={localEnvironmentState}
                onOpenSettings={onOpenLocalEnvironmentsSettings}
                t={t}
              />
            </FormField>
          ) : null}

          <FormField label={t("inbox.automations.model.label")}>
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
          </FormField>

          <FormField label={t("inbox.automations.reasoning.label")}>
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
          </FormField>
        </>
      )}

      <FormField
        label={
          draft.kind === "heartbeat"
            ? t("inbox.automations.interval.label")
            : t("inbox.automations.repeats.label")
        }
      >
        <CompactScheduleEditor
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
      </FormField>
    </div>
  );
}
