import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readAppsSnapshot, type AppInfo } from "../../services/apps";
import type { AutomationRecord, CronAutomationRecord } from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import { CloseTabIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Tooltip } from "../../components/Tooltip";
import { PromptEditor } from "../promptEditor";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationsQuickStartTemplates } from "./AutomationsQuickStartTemplates";
import type {
  HeartbeatThreadOption,
  TranslateFn,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

const AUTOMATION_FORM_ID = "automation-form";

type AutomationsCreateDialogProps = {
  canSave: boolean;
  draft: AutomationRecord | null;
  heartbeatThreadOptions: HeartbeatThreadOption[];
  hostId?: string | null;
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
  saveTooltip: string | null;
  workspaceRootLabels: Record<string, string>;
  workspaceRootOptions: string[];
  t: TranslateFn;
};

export function AutomationsCreateDialog({
  canSave,
  draft,
  heartbeatThreadOptions,
  hostId = null,
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
  saveTooltip,
  workspaceRootLabels,
  workspaceRootOptions,
  t,
}: AutomationsCreateDialogProps) {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [isTemplateMode, setIsTemplateMode] = useState(initialTemplateMode);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
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

  useEffect(() => {
    if (draft === null || isTemplateMode) {
      return;
    }

    let cancelled = false;
    const cwd =
      draft.kind === "cron" ? draft.cwds[0] ?? localEnvironmentState.workspaceRoot : null;

    void Promise.all([
      readAppsSnapshot({ hostId }).then((response) => response.data).catch(() => []),
      readSkillsSnapshot(cwd, { hostId }).catch(() => []),
    ]).then(([nextApps, nextSkills]) => {
      if (cancelled) {
        return;
      }

      setApps(nextApps);
      setSkills(nextSkills);
    });

    return () => {
      cancelled = true;
    };
  }, [draft, hostId, isTemplateMode, localEnvironmentState.workspaceRoot]);

  const canClearDraft = useMemo(() => {
    if (draft === null) {
      return false;
    }

    return draft.name.trim().length > 0 || draft.prompt.trim().length > 0;
  }, [draft]);

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

        <form
          id={AUTOMATION_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave || isSaving || isTemplateMode) {
              return;
            }
            onCreate();
          }}
        >
          <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
            <div className="flex min-w-0 items-start justify-between gap-4 pr-12">
              <div className="min-w-0 flex-1">
                {isTemplateMode ? (
                  <div className="heading-xl min-w-0 font-normal text-token-foreground">
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
                    className="heading-xl min-w-0 w-full bg-transparent p-0 font-normal text-token-foreground outline-none placeholder:text-[var(--app-shell-subtle)]"
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
                {!isTemplateMode && canClearDraft ? (
                  <Button color="ghost" onClick={onClearDraft} size="toolbar">
                    {t("settings.automations.clear")}
                  </Button>
                ) : null}
              </div>
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
              <div className="flex min-h-full flex-col gap-4">
                <div className="min-h-[16rem] flex-1">
                  <PromptEditor
                    apps={apps}
                    ariaLabel={t("settings.automations.promptLabel")}
                    autoFocus
                    editorClassName="min-h-[16rem] max-h-none overflow-visible"
                    hostId={hostId}
                    isIndented={false}
                    onChange={(value) =>
                      onDraftChange((current) =>
                        current ? { ...current, prompt: value } : current,
                      )
                    }
                    onIndent={() => undefined}
                    onOutdent={() => undefined}
                    onSubmit={() => {
                      if (!canSave || isSaving) {
                        return;
                      }
                      onCreate();
                    }}
                    placeholder={t("settings.automations.promptPlaceholder")}
                    skills={skills}
                    t={t}
                    value={draft.prompt}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--app-shell-border)] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isTemplateMode ? <span /> : (
                <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1">
                  <AutomationFormFields
                    draft={draft}
                    heartbeatThreadOptions={heartbeatThreadOptions}
                    localEnvironmentState={localEnvironmentState}
                    locale={locale}
                    modelOptions={modelOptions}
                    onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
                    onDraftChange={onDraftChange}
                    showPromptField={false}
                    variant="compactRail"
                    workspaceRootLabels={workspaceRootLabels}
                    workspaceRootOptions={workspaceRootOptions}
                    t={t}
                  />
                </div>
              )}
              <div className="flex shrink-0 items-center gap-2">
                <Button color="ghost" onClick={onCancel} size="toolbar">
                  {t("settings.automations.cancel")}
                </Button>
                {saveTooltip && !isTemplateMode && !isSaving ? (
                  <Tooltip align="end" tooltipContent={saveTooltip}>
                    <span className="inline-flex">
                      <Button
                        color="primary"
                        disabled={true}
                        form={AUTOMATION_FORM_ID}
                        loading={isSaving}
                        size="toolbar"
                        type="submit"
                      >
                        {t("settings.automations.create")}
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button
                    color="primary"
                    disabled={!canSave || isSaving || isTemplateMode}
                    form={AUTOMATION_FORM_ID}
                    loading={isSaving}
                    size="toolbar"
                    type="submit"
                  >
                    {t("settings.automations.create")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
