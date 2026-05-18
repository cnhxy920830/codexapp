import { useEffect, useRef, useState } from "react";
import {
  MoreActionsIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayOutlineIcon,
  ResumeCircleIcon,
  TrashIcon,
  UnselectedCircleIcon,
} from "../../components/AppShellIcons";
import type { AutomationRecord, CronAutomationRecord } from "../../services/automations";
import { AutomationsQuickStartTemplates } from "./AutomationsQuickStartTemplates";
import { SectionedPage, SectionedPageSection, type SectionedPageSection as SectionedPageSectionConfig } from "./SectionedPage";
import type { TranslateFn } from "./automationsPageUtils";
import {
  describeAutomation,
  formatScheduleSummary,
  formatStatusLabel,
  isPaused,
} from "./automationsPageUtils";

type AutomationsOverviewPaneProps = {
  isLoading: boolean;
  isRunningNowId: string | null;
  items: AutomationRecord[];
  locale: string;
  defaultOpenRowMenuId?: string | null;
  selectedId: string | null;
  threadNameById: Map<string, string>;
  workspaceRootLabels: Record<string, string>;
  quickStartBaseDraft: CronAutomationRecord;
  onDeleteAutomation: (automation: AutomationRecord) => void;
  onPauseAutomation: (automation: AutomationRecord) => void;
  onSelectQuickStart: (draft: CronAutomationRecord) => void;
  onResumeAutomation: (automation: AutomationRecord) => void;
  onRunAutomationNow: (automation: AutomationRecord) => void;
  onSelectAutomation: (automation: AutomationRecord) => void;
  t: TranslateFn;
};

function AutomationRow({
  automation,
  defaultOpenMenu = false,
  locale,
  isRunNowDisabled,
  isRunNowPending,
  isSelected,
  onDelete,
  onEdit,
  onPause,
  onResume,
  onRunNow,
  onSelect,
  secondaryLabel,
  t,
}: {
  automation: AutomationRecord;
  defaultOpenMenu?: boolean;
  locale: string;
  isRunNowDisabled: boolean;
  isRunNowPending: boolean;
  isSelected: boolean;
  onDelete: (automation: AutomationRecord) => void;
  onEdit: (automation: AutomationRecord) => void;
  onPause: (automation: AutomationRecord) => void;
  onResume: (automation: AutomationRecord) => void;
  onRunNow: (automation: AutomationRecord) => void;
  onSelect: (automation: AutomationRecord) => void;
  secondaryLabel: string;
  t: TranslateFn;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(defaultOpenMenu);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const scheduleLabel = formatScheduleSummary(automation, locale, t);
  const statusIcon =
    automation.status === "PAUSED" ? (
      <PauseCircleIcon className="icon-sm shrink-0 app-text-muted" />
    ) : (
      <UnselectedCircleIcon className="icon-sm shrink-0 app-text-muted" />
    );
  const statusLabel =
    automation.status === "PAUSED"
      ? formatStatusLabel(automation.status, t)
      : null;
  const moreLabel = t("inbox.automations.rowActions");

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rowRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  return (
    <div
      ref={rowRef}
      className={[
        "group relative min-h-10 w-full rounded-lg px-3 py-3 text-left text-base cursor-interaction",
        isSelected
          ? "bg-token-list-active-selection-background"
          : "hover:bg-token-list-active-selection-background",
      ].join(" ")}
      data-automation-menu-root={automation.id}
      role="button"
      tabIndex={0}
      aria-label={automation.name.trim() || t("settings.automations.namePlaceholder")}
      aria-disabled={false}
      onClick={() => onSelect(automation)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        onSelect(automation);
      }}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex min-h-6 shrink-0 items-center">
          {statusIcon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-baseline gap-3">
            <div className="flex min-w-0 flex-1 items-baseline gap-2 text-base leading-6">
              <span className="min-w-0 truncate text-token-foreground">
                {automation.name.trim() || t("settings.automations.namePlaceholder")}
              </span>
              <span className="max-w-48 shrink-0 truncate text-token-description-foreground">
                {secondaryLabel || t("inbox.automations.workspaceFallback")}
              </span>
            </div>
            <div
              className={[
                "flex shrink-0 items-center text-base text-token-description-foreground",
                automation.status === "PAUSED" ? "gap-2" : "gap-0",
              ].join(" ")}
            >
              {automation.status === "PAUSED" ? null : (
                <span
                  className={[
                    "min-w-20 whitespace-nowrap text-right",
                    isMenuOpen ? "opacity-0" : "group-hover:opacity-0",
                  ].join(" ")}
                >
                  {scheduleLabel}
                </span>
              )}
              <span
                className={[
                  "relative inline-flex justify-end",
                  automation.status === "PAUSED" ? "min-w-20" : "",
                ].join(" ")}
              >
                {statusLabel ? (
                  <span className={isMenuOpen ? "opacity-0" : "group-hover:opacity-0"}>
                    {statusLabel}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={[
                    "absolute inset-y-0 right-0 flex items-center gap-2.5",
                    isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    title={t("settings.automations.runNow")}
                    aria-label={t("settings.automations.runNow")}
                    disabled={isRunNowDisabled}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRunNow(automation);
                    }}
                    className="flex cursor-interaction items-center justify-center text-token-description-foreground hover:text-token-foreground disabled:cursor-default"
                  >
                    {isRunNowPending ? (
                      <span className="icon-sm animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
                    ) : (
                      <PlayOutlineIcon className="icon-sm" />
                    )}
                  </button>
                  <button
                    type="button"
                    title={t("inbox.automations.editTooltip")}
                    aria-label={t("inbox.automations.editTooltip")}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onEdit(automation);
                    }}
                    className="flex items-center justify-center text-token-description-foreground hover:text-token-foreground"
                  >
                    <PencilIcon className="icon-sm" />
                  </button>
                  <button
                    type="button"
                    title={t("inbox.automations.moreOptionsTooltip")}
                    aria-label={moreLabel}
                    aria-expanded={isMenuOpen}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsMenuOpen((open) => !open);
                    }}
                    className="flex items-center justify-center text-token-description-foreground hover:text-token-foreground"
                  >
                    <MoreActionsIcon className="icon-sm" />
                  </button>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      {isMenuOpen ? (
        <div className="app-card absolute top-[calc(100%-6px)] right-3 z-10 min-w-[180px] rounded-[14px] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
          {automation.status === "PAUSED" ? (
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onResume(automation);
              }}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <ResumeCircleIcon className="h-4 w-4" />
              {t("inbox.automations.resumeMenuItem")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onPause(automation);
              }}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <PauseCircleIcon className="h-4 w-4" />
              {t("inbox.automations.pauseMenuItem")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onDelete(automation);
            }}
            className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] text-[var(--app-shell-danger)]"
          >
            <TrashIcon className="h-4 w-4" />
            {t("inbox.automations.deleteMenuItem")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AutomationsOverviewPane({
  isLoading,
  isRunningNowId,
  items,
  locale,
  defaultOpenRowMenuId = null,
  selectedId,
  threadNameById,
  workspaceRootLabels,
  quickStartBaseDraft,
  onDeleteAutomation,
  onPauseAutomation,
  onSelectQuickStart,
  onResumeAutomation,
  onRunAutomationNow,
  onSelectAutomation,
  t,
}: AutomationsOverviewPaneProps) {
  const currentItems = items.filter((item) => !isPaused(item));
  const pausedItems = items.filter(isPaused);
  const isRunNowDisabled = isRunningNowId !== null;
  const sections: SectionedPageSectionConfig[] = [];

  if (currentItems.length > 0) {
    sections.push({
      id: "current-automations",
      title: t("inbox.automations.current"),
    });
  }
  if (pausedItems.length > 0) {
    sections.push({
      id: "paused-automations",
      title: t("inbox.automations.pausedSection"),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-content-max-width)] flex-col gap-8 px-panel pt-panel pb-8">
        <div className="flex flex-col gap-3">
          <div className="heading-xl font-normal text-[var(--app-shell-title)]">
            {t("inbox.automations.header.root")}
          </div>
        </div>

        {isLoading ? (
          <div className="app-text-muted flex items-center gap-2 rounded-md px-2 py-2 text-[13px]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
            {t("inbox.automations.loading")}
          </div>
        ) : items.length === 0 ? (
          <AutomationsQuickStartTemplates
            baseDraft={quickStartBaseDraft}
            onSelectAction={onSelectQuickStart}
            t={t}
          />
        ) : (
          <SectionedPage
            ariaLabel={t("inbox.automations.sectionsNav")}
            className="[--sectioned-page-leading-inset:0]"
            contentInnerClassName="flex flex-col gap-8 px-panel pb-panel [&>section]:gap-2"
            sections={sections}
            showNav={false}
          >
            {currentItems.length > 0 ? (
              <SectionedPageSection
                id="current-automations"
                title={t("inbox.automations.current")}
              >
                <div className="-mx-3 flex flex-col gap-1" role="list">
                  {currentItems.map((automation) => (
                    <div key={automation.id} role="listitem">
                      <AutomationRow
                        automation={automation}
                        defaultOpenMenu={defaultOpenRowMenuId === automation.id}
                        locale={locale}
                        isRunNowDisabled={isRunNowDisabled}
                        isRunNowPending={isRunningNowId === automation.id}
                        isSelected={selectedId === automation.id}
                        onDelete={onDeleteAutomation}
                        onEdit={onSelectAutomation}
                        onPause={onPauseAutomation}
                        onResume={onResumeAutomation}
                        onRunNow={onRunAutomationNow}
                        onSelect={onSelectAutomation}
                        secondaryLabel={describeAutomation(
                          automation,
                          threadNameById,
                          locale,
                          workspaceRootLabels,
                          t,
                        )}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              </SectionedPageSection>
            ) : null}

            {pausedItems.length > 0 ? (
              <SectionedPageSection
                id="paused-automations"
                title={t("inbox.automations.pausedSection")}
              >
                <div className="-mx-3 flex flex-col gap-1" role="list">
                  {pausedItems.map((automation) => (
                    <div key={automation.id} role="listitem">
                      <AutomationRow
                        automation={automation}
                        defaultOpenMenu={defaultOpenRowMenuId === automation.id}
                        locale={locale}
                        isRunNowDisabled={isRunNowDisabled}
                        isRunNowPending={isRunningNowId === automation.id}
                        isSelected={selectedId === automation.id}
                        onDelete={onDeleteAutomation}
                        onEdit={onSelectAutomation}
                        onPause={onPauseAutomation}
                        onResume={onResumeAutomation}
                        onRunNow={onRunAutomationNow}
                        onSelect={onSelectAutomation}
                        secondaryLabel={describeAutomation(
                          automation,
                          threadNameById,
                          locale,
                          workspaceRootLabels,
                          t,
                        )}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              </SectionedPageSection>
            ) : null}
          </SectionedPage>
        )}
      </div>
    </div>
  );
}
