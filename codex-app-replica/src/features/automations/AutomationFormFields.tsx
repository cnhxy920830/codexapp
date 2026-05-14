import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import type {
  HeartbeatThreadOption,
  TranslateFn,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationFormFieldsProps = {
  draft: AutomationRecord;
  localEnvironmentState: AutomationLocalEnvironmentState;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  heartbeatThreadOptions: HeartbeatThreadOption[];
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
  localEnvironmentState,
  onOpenLocalEnvironmentsSettings,
  onDraftChange,
  heartbeatThreadOptions,
  t,
}: AutomationFormFieldsProps) {
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
          <select
            value={draft.targetThreadId}
            onChange={(event) =>
              onDraftChange((current) =>
                current && current.kind === "heartbeat"
                  ? { ...current, targetThreadId: event.target.value }
                  : current,
              )
            }
            className="app-input h-11 rounded-[12px] px-3 text-[14px]"
          >
            <option value="">
              {t("settings.automations.heartbeatThread.placeholder")}
            </option>
            {heartbeatThreadOptions.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.title}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <>
          <FormField label={t("inbox.automations.folder.label")}>
            <textarea
              value={draft.cwds.join("\n")}
              onChange={(event) =>
                onDraftChange((current) =>
                  current && current.kind === "cron"
                    ? {
                        ...current,
                        cwds: event.target.value
                          .split(/\r?\n/)
                          .map((line) => line.trim())
                          .filter(Boolean),
                      }
                    : current,
                )
              }
              placeholder={t("settings.automations.cwdPlaceholder")}
              className="app-input min-h-[88px] rounded-[12px] px-3 py-3 text-[14px] leading-6"
            />
          </FormField>

          <FormField label={t("inbox.automations.executionEnvironment.label")}>
            <select
              aria-label={t("settings.automations.executionEnvironment.ariaLabel")}
              value={draft.executionEnvironment}
              onChange={(event) =>
                onDraftChange((current) =>
                  current && current.kind === "cron"
                    ? { ...current, executionEnvironment: event.target.value }
                    : current,
                )
              }
              className="app-input h-11 rounded-[12px] px-3 text-[14px]"
            >
              <option value="local">
                {t("settings.automations.executionEnvironment.local")}
              </option>
              <option value="worktree">
                {t("settings.automations.executionEnvironment.worktree")}
              </option>
            </select>
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
            <input
              value={draft.model ?? ""}
              onChange={(event) =>
                onDraftChange((current) =>
                  current && current.kind === "cron"
                    ? { ...current, model: event.target.value || null }
                    : current,
                )
              }
              className="app-input h-11 rounded-[12px] px-3 text-[14px]"
            />
          </FormField>

          <FormField label={t("inbox.automations.reasoning.label")}>
            <input
              value={draft.reasoningEffort ?? ""}
              onChange={(event) =>
                onDraftChange((current) =>
                  current && current.kind === "cron"
                    ? { ...current, reasoningEffort: event.target.value || null }
                    : current,
                )
              }
              className="app-input h-11 rounded-[12px] px-3 text-[14px]"
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
        <input
          value={draft.rrule}
          onChange={(event) =>
            onDraftChange((current) =>
              current ? { ...current, rrule: event.target.value } : current,
            )
          }
          className="app-input h-11 rounded-[12px] px-3 text-[14px]"
        />
      </FormField>
    </div>
  );
}
