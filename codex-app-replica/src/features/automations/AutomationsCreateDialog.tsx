import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import { PlusIcon } from "../../components/AppShellIcons";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationsQuickStartTemplates } from "./AutomationsQuickStartTemplates";
import type { CronAutomationRecord } from "../../services/automations";
import type {
  HeartbeatThreadOption,
  TranslateFn,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationsCreateDialogProps = {
  canSave: boolean;
  draft: AutomationRecord | null;
  isSaving: boolean;
  initialTemplateMode?: boolean;
  quickStartBaseDraft: CronAutomationRecord;
  localEnvironmentState: AutomationLocalEnvironmentState;
  onCancel: () => void;
  onClearDraft: () => void;
  onCreate: () => void;
  onDraftChange: Dispatch<SetStateAction<AutomationRecord | null>>;
  onSelectTemplateDraft: (draft: CronAutomationRecord) => void;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  heartbeatThreadOptions: HeartbeatThreadOption[];
  t: TranslateFn;
};

export function AutomationsCreateDialog({
  canSave,
  draft,
  isSaving,
  initialTemplateMode = false,
  quickStartBaseDraft,
  localEnvironmentState,
  onCancel,
  onClearDraft,
  onCreate,
  onDraftChange,
  onSelectTemplateDraft,
  onOpenLocalEnvironmentsSettings,
  heartbeatThreadOptions,
  t,
}: AutomationsCreateDialogProps) {
  const [isTemplateMode, setIsTemplateMode] = useState(initialTemplateMode);

  if (draft === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card flex max-h-[95vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[20px] shadow-[0_20px_48px_rgba(0,0,0,0.22)]">
        <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isTemplateMode ? (
                <div className="min-w-0 pr-32 text-lg leading-tight whitespace-nowrap text-[var(--app-shell-title)]">
                  {t("settings.automations.modal.templateTitle")}
                </div>
              ) : (
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
              )}
            </div>
            <button
              type="button"
              aria-label={t(
                isTemplateMode
                  ? "settings.automations.modal.collapse"
                  : "settings.automations.modal.expand",
              )}
              onClick={() => setIsTemplateMode((value) => !value)}
              className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t(
                isTemplateMode
                  ? "settings.automations.modal.createNew"
                  : "settings.automations.modal.useTemplate",
              )}
            </button>
            {!isTemplateMode &&
            (draft.name.trim().length > 0 || draft.prompt.trim().length > 0) ? (
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
          {isTemplateMode ? (
            <div className="vertical-scroll-fade-mask min-h-0">
              <AutomationsQuickStartTemplates
                baseDraft={quickStartBaseDraft}
                className=""
                columns="two"
                hideLearnMore={true}
                onSelectAction={(nextDraft) => {
                  onSelectTemplateDraft(nextDraft);
                  setIsTemplateMode(false);
                }}
                t={t}
              />
            </div>
          ) : (
            <div className="grid gap-5">
              <AutomationFormFields
                draft={draft}
                heartbeatThreadOptions={heartbeatThreadOptions}
                localEnvironmentState={localEnvironmentState}
                onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
                onDraftChange={onDraftChange}
                t={t}
              />
            </div>
          )}
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
              {isSaving ? (
                t("general.saving")
              ) : (
                <span className="inline-flex items-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  {t("settings.automations.create")}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
