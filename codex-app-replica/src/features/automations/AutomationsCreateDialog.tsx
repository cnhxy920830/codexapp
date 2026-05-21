import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
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
const OVERLAY_MIN_HEIGHT = 360;
const OVERLAY_HEIGHT_OFFSET = 208;
const BASE_FADE_DURATION_MS = 160;
const SIZE_DURATION_MS = 220;
const OVERLAY_FADE_DURATION_MS = 260;
const OVERLAY_HEADER_FADE_DURATION_MS = 208;

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

type OverlayState = {
  closeOverlay: () => void;
  closeOverlayAndThen: (callback?: () => void) => void;
  isOverlayOpen: boolean;
  openOverlay: () => void;
};

function AutomationTemplatesOverlay({
  closeOverlayAndThen,
  onSelectTemplateDraft,
  quickStartBaseDraft,
  t,
}: {
  closeOverlayAndThen: (callback?: () => void) => void;
  onSelectTemplateDraft: (draft: CronAutomationRecord) => void;
  quickStartBaseDraft: CronAutomationRecord;
  t: TranslateFn;
}) {
  return (
    <div className="flex h-full flex-col px-5 pt-[4rem] pb-4">
      <div className="vertical-scroll-fade-mask min-h-0 flex-1 overflow-y-auto">
        <AutomationsQuickStartTemplates
          baseDraft={quickStartBaseDraft}
          columns="two"
          onSelectAction={(nextDraft) => {
            closeOverlayAndThen(() => onSelectTemplateDraft(nextDraft));
          }}
          t={t}
        />
      </div>
    </div>
  );
}

function AutomationTemplateHeader({ t }: { t: TranslateFn }) {
  return (
    <div className="px-5 pt-5 pb-3">
      <div className="min-w-0 pr-32 text-lg leading-tight whitespace-nowrap text-token-foreground">
        {t("settings.automations.modal.templateTitle")}
      </div>
    </div>
  );
}

function AutomationTemplateToggleButton({
  isOverlayOpen,
  onCloseOverlay,
  onOpenOverlay,
  t,
}: {
  isOverlayOpen: boolean;
  onCloseOverlay: () => void;
  onOpenOverlay: () => void;
  t: TranslateFn;
}) {
  return (
    <Button
      aria-label={t(
        isOverlayOpen
          ? "settings.automations.modal.collapse"
          : "settings.automations.modal.expand",
      )}
      color="outline"
      data-testid="automation-template-toggle-button"
      onClick={() => {
        if (isOverlayOpen) {
          onCloseOverlay();
          return;
        }
        onOpenOverlay();
      }}
      size="toolbar"
      type="button"
    >
      {t(
        isOverlayOpen
          ? "settings.automations.modal.createNew"
          : "settings.automations.modal.useTemplate",
      )}
    </Button>
  );
}

function AutomationDialogOverlay({
  baseContent,
  children,
  defaultOverlayOpen = false,
  isOpen,
  overlayContent,
  overlayHeader,
}: {
  baseContent: ReactNode | ((state: OverlayState) => ReactNode);
  children?: (state: OverlayState) => ReactNode;
  defaultOverlayOpen?: boolean;
  isOpen: boolean;
  overlayContent: (state: OverlayState) => ReactNode;
  overlayHeader?: ReactNode;
}) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(defaultOverlayOpen);
  const [isOverlayVisible, setIsOverlayVisible] = useState(defaultOverlayOpen);
  const [isBaseVisible, setIsBaseVisible] = useState(!defaultOverlayOpen);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const timeout of timeoutsRef.current) {
      window.clearTimeout(timeout);
    }
    timeoutsRef.current = [];
  };

  const resetOverlay = () => {
    clearTimers();
    setIsOverlayOpen(defaultOverlayOpen);
    setIsOverlayVisible(defaultOverlayOpen);
    setIsBaseVisible(!defaultOverlayOpen);
  };

  const closeOverlayAndThen = (callback?: () => void) => {
    clearTimers();
    setIsOverlayVisible(false);
    const closeTimeout = window.setTimeout(() => {
      setIsOverlayOpen(false);
      callback?.();
    }, OVERLAY_FADE_DURATION_MS);
    const baseTimeout = window.setTimeout(() => {
      setIsBaseVisible(true);
    }, OVERLAY_FADE_DURATION_MS + SIZE_DURATION_MS);
    timeoutsRef.current.push(closeTimeout, baseTimeout);
  };

  const openOverlay = () => {
    clearTimers();
    setIsOverlayVisible(false);
    setIsBaseVisible(false);
    const openTimeout = window.setTimeout(() => {
      setIsOverlayOpen(true);
    }, BASE_FADE_DURATION_MS);
    const visibleTimeout = window.setTimeout(() => {
      setIsOverlayVisible(true);
    }, BASE_FADE_DURATION_MS + SIZE_DURATION_MS);
    timeoutsRef.current.push(openTimeout, visibleTimeout);
  };

  useEffect(() => {
    resetOverlay();
  }, [defaultOverlayOpen, isOpen]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setContentHeight(element.scrollHeight);
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const height =
    isOverlayOpen
      ? Math.max((contentHeight ?? OVERLAY_MIN_HEIGHT) + OVERLAY_HEIGHT_OFFSET, OVERLAY_MIN_HEIGHT)
      : contentHeight;
  const overlayState: OverlayState = {
    closeOverlay: () => closeOverlayAndThen(),
    closeOverlayAndThen,
    isOverlayOpen,
    openOverlay,
  };
  const resolvedBaseContent =
    typeof baseContent === "function" ? baseContent(overlayState) : baseContent;

  return (
    <div
      className="relative"
      style={
        height === null
          ? undefined
          : {
              height,
              transition: `height ${SIZE_DURATION_MS}ms var(--cubic-enter)`,
            }
      }
    >
      {children?.(overlayState)}
      {overlayHeader ? (
        <div
          className={[
            "pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity",
            isOverlayVisible ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ transitionDuration: `${OVERLAY_HEADER_FADE_DURATION_MS}ms` }}
        >
          {overlayHeader}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={[
          "w-full transition-opacity",
          isBaseVisible ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        style={{ transitionDuration: `${BASE_FADE_DURATION_MS}ms` }}
      >
        {resolvedBaseContent}
      </div>
      <div
        className={[
          "absolute inset-0 transition-opacity",
          isOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        style={{
          minHeight: OVERLAY_MIN_HEIGHT,
          transitionDuration: `${OVERLAY_FADE_DURATION_MS}ms`,
        }}
      >
        {overlayContent(overlayState)}
      </div>
    </div>
  );
}

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
    if (draft === null) {
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
  }, [draft, hostId, localEnvironmentState.workspaceRoot]);

  const canClearDraft = useMemo(() => {
    if (draft === null) {
      return false;
    }

    return draft.name.trim().length > 0 || draft.prompt.trim().length > 0;
  }, [draft]);

  if (draft === null) {
    return null;
  }

  const baseContent = ({ closeOverlay, isOverlayOpen, openOverlay }: OverlayState) => (
    <form
      id={AUTOMATION_FORM_ID}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || isSaving) {
          return;
        }
        onCreate();
      }}
    >
      <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
        <div className="flex min-w-0 items-start justify-between gap-4 pr-12">
          <div className="min-w-0 flex-1">
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
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canClearDraft ? (
              <Button color="ghost" onClick={onClearDraft} size="toolbar" type="button">
                {t("settings.automations.clear")}
              </Button>
            ) : null}
            <AutomationTemplateToggleButton
              isOverlayOpen={isOverlayOpen}
              onCloseOverlay={closeOverlay}
              onOpenOverlay={openOverlay}
              t={t}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
      </div>

      <div className="border-t border-[var(--app-shell-border)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              useCreateCompactRailProjectPlaceholder={true}
              variant="compactRail"
              workspaceRootLabels={workspaceRootLabels}
              workspaceRootOptions={workspaceRootOptions}
              t={t}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button color="ghost" onClick={onCancel} size="toolbar" type="button">
              {t("settings.automations.cancel")}
            </Button>
            {saveTooltip && !isSaving ? (
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
                disabled={!canSave || isSaving}
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
  );

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

        <AutomationDialogOverlay
          baseContent={baseContent}
          defaultOverlayOpen={initialTemplateMode}
          isOpen={true}
          overlayContent={({ closeOverlayAndThen }) => (
            <AutomationTemplatesOverlay
              closeOverlayAndThen={closeOverlayAndThen}
              onSelectTemplateDraft={onSelectTemplateDraft}
              quickStartBaseDraft={quickStartBaseDraft}
              t={t}
            />
          )}
          overlayHeader={<AutomationTemplateHeader t={t} />}
        >
          {({ closeOverlay, isOverlayOpen, openOverlay }) =>
            isOverlayOpen ? (
              <div className="absolute top-5 right-14 z-20">
                <AutomationTemplateToggleButton
                  isOverlayOpen={isOverlayOpen}
                  onCloseOverlay={closeOverlay}
                    onOpenOverlay={openOverlay}
                  t={t}
                />
              </div>
            ) : null
          }
        </AutomationDialogOverlay>
      </div>
    </div>
  );
}
