import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import { CloseTabIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationsQuickStartTemplates } from "./AutomationsQuickStartTemplates";
import type { CronAutomationRecord } from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import type {
  HeartbeatThreadOption,
  TranslateFn,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationsCreateDialogProps = {
  canSave: boolean;
  draft: AutomationRecord | null;
  heartbeatThreadOptions: HeartbeatThreadOption[];
  isSaving: boolean;
  initialTemplateMode?: boolean;
  locale: string;
  modelOptions: ModelListEntry[];
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
  workspaceRootLabels: Record<string, string>;
  workspaceRootOptions: string[];
  t: TranslateFn;
};

export function AutomationsCreateDialog({
  canSave,
  draft,
  heartbeatThreadOptions,
  isSaving,
  initialTemplateMode = false,
  locale,
  modelOptions,
  quickStartBaseDraft,
  localEnvironmentState,
  onCancel,
  onClearDraft,
  onCreate,
  onDraftChange,
  onSelectTemplateDraft,
  onOpenLocalEnvironmentsSettings,
  workspaceRootLabels,
  workspaceRootOptions,
  t,
}: AutomationsCreateDialogProps) {
  const [isTemplateMode, setIsTemplateMode] = useState(initialTemplateMode);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (dialogRef.current?.contains(event.target)) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  if (draft === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div
        ref={dialogRef}
        className="app-card relative flex max-h-[95vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[20px] shadow-[0_20px_48px_rgba(0,0,0,0.22)]"
      >
        <button
          type="button"
          aria-label={t("codex.alert.closeAriaLabel")}
          onClick={onCancel}
          className="app-control-weak absolute top-[22px] right-5 z-10 flex size-8 items-center justify-center rounded-full"
        >
          <CloseTabIcon className="h-4 w-4" />
        </button>
        <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
          <div className="flex min-w-0 items-start justify-between gap-4 pr-12">
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
            <Button
              color="ghost"
              aria-label={t(
                isTemplateMode
                  ? "settings.automations.modal.collapse"
                  : "settings.automations.modal.expand",
              )}
              onClick={() => setIsTemplateMode((value) => !value)}
              size="toolbar"
            >
              {t(
                isTemplateMode
                  ? "settings.automations.modal.createNew"
                  : "settings.automations.modal.useTemplate",
              )}
            </Button>
            {!isTemplateMode &&
            (draft.name.trim().length > 0 || draft.prompt.trim().length > 0) ? (
              <Button color="ghost" onClick={onClearDraft} size="toolbar">
                {t("settings.automations.clear")}
              </Button>
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
                locale={locale}
                modelOptions={modelOptions}
                onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
                onDraftChange={onDraftChange}
                workspaceRootLabels={workspaceRootLabels}
                workspaceRootOptions={workspaceRootOptions}
                t={t}
              />
            </div>
          )}
        </div>

        <div className="border-t border-[var(--app-shell-border)] px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <Button color="ghost" onClick={onCancel} size="toolbar">
              {t("settings.automations.cancel")}
            </Button>
            <Button
              color="primary"
              disabled={!canSave || isSaving}
              loading={isSaving}
              onClick={onCreate}
              size="toolbar"
            >
              {isSaving ? t("general.saving") : t("settings.automations.create")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
