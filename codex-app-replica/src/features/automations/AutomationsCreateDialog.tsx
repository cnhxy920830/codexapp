import type { Dispatch, SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";
import { AutomationFormFields } from "./AutomationFormFields";
import type { FeedbackState, TranslateFn } from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationsCreateDialogProps = {
  canSave: boolean;
  draft: AutomationRecord | null;
  feedback: FeedbackState;
  isSaving: boolean;
  localEnvironmentState: AutomationLocalEnvironmentState;
  onCancel: () => void;
  onClearDraft: () => void;
  onCreate: () => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  recentThreads: ThreadHistoryEntry[];
  t: TranslateFn;
};

export function AutomationsCreateDialog({
  canSave,
  draft,
  feedback,
  isSaving,
  localEnvironmentState,
  onCancel,
  onClearDraft,
  onCreate,
  onDraftChange,
  onOpenLocalEnvironmentsSettings,
  recentThreads,
  t,
}: AutomationsCreateDialogProps) {
  if (draft === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card flex max-h-[95vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[20px] shadow-[0_20px_48px_rgba(0,0,0,0.22)]">
        <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {feedback ? (
              <div
                className={[
                  feedback.tone === "error" ? "app-card-error" : "app-badge",
                  "rounded-[14px] px-4 py-3 text-[13px]",
                ].join(" ")}
              >
                {feedback.message}
              </div>
            ) : null}

            <AutomationFormFields
              draft={draft}
              localEnvironmentState={localEnvironmentState}
              onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
              onDraftChange={onDraftChange}
              recentThreads={recentThreads}
              t={t}
            />
          </div>
        </div>

        <div className="border-t border-[var(--app-shell-border)] px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t("settings.automations.cancel")}
            </button>
            <button
              type="button"
              disabled={!canSave || isSaving}
              onClick={onCreate}
              className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
            >
              {isSaving ? t("general.saving") : t("settings.automations.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
