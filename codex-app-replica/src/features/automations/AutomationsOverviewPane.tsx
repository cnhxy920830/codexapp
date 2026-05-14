import {
  MoreActionsIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayOutlineIcon,
  ResumeCircleIcon,
  TrashIcon,
  UnselectedCircleIcon,
} from "../../components/AppShellIcons";
import type { ReactNode } from "react";
import type { AutomationRecord, CronAutomationRecord } from "../../services/automations";
import { AutomationsQuickStartTemplates } from "./AutomationsQuickStartTemplates";
import { SectionedPage, SectionedPageSection } from "./SectionedPage";
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
  openRowMenuId: string | null;
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
  onToggleMenu: (automationId: string | null) => void;
  t: TranslateFn;
};

function AutomationRow({
  automation,
  isMenuOpen,
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
  onToggleMenu,
  secondaryLabel,
  t,
}: {
  automation: AutomationRecord;
  isMenuOpen: boolean;
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
  onToggleMenu: (automationId: string | null) => void;
  secondaryLabel: string;
  t: TranslateFn;
}) {
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

  return (
    <div className="group relative" data-automation-menu-root={automation.id}>
      <button
        type="button"
        onClick={() => onSelect(automation)}
        className={[
          "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
          isSelected
            ? "bg-[var(--app-shell-card-bg-selected)]"
            : "hover:bg-[var(--app-shell-card-bg-weak)]",
        ].join(" ")}
      >
        <span className="flex w-5 shrink-0 items-center justify-center">
          {statusIcon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="app-title truncate text-[14px] leading-5">
            {automation.name.trim() || t("settings.automations.namePlaceholder")}
          </div>
          <div className="app-text-muted mt-0.5 truncate text-[12px] leading-5">
            {secondaryLabel}
          </div>
        </div>
        <div
          className={[
            "flex shrink-0 items-center text-[13px] text-[var(--app-shell-muted)]",
            automation.status === "PAUSED" ? "gap-2" : "gap-0",
          ].join(" ")}
        >
          {automation.status === "PAUSED" ? null : (
            <span
              className={[
                "min-w-20 whitespace-nowrap text-right transition-opacity",
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
              <span
                className={[
                  "transition-opacity",
                  isMenuOpen ? "opacity-0" : "group-hover:opacity-0",
                ].join(" ")}
              >
                {statusLabel}
              </span>
            ) : (
              <span />
            )}
            <span
              className={[
                "absolute inset-y-0 right-0 flex items-center gap-2.5 transition-opacity",
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
                className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)] disabled:cursor-default"
              >
                {isRunNowPending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
                ) : (
                  <PlayOutlineIcon className="h-4 w-4" />
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
                className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)]"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={t("inbox.automations.moreOptionsTooltip")}
                aria-label={t("inbox.automations.rowActions")}
                aria-expanded={isMenuOpen}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleMenu(isMenuOpen ? null : automation.id);
                }}
                className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)]"
              >
                <MoreActionsIcon className="h-4 w-4" />
              </button>
            </span>
          </span>
        </div>
      </button>
      {isMenuOpen ? (
        <div className="app-card absolute top-[calc(100%-6px)] right-3 z-10 min-w-[180px] rounded-[14px] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
          {automation.status === "PAUSED" ? (
            <button
              type="button"
              onClick={() => onResume(automation)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <ResumeCircleIcon className="h-4 w-4" />
              {t("inbox.automations.resumeMenuItem")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPause(automation)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <PauseCircleIcon className="h-4 w-4" />
              {t("inbox.automations.pauseMenuItem")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(automation)}
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
  openRowMenuId,
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
  onToggleMenu,
  t,
}: AutomationsOverviewPaneProps) {
  const currentItems = items.filter((item) => !isPaused(item));
  const pausedItems = items.filter(isPaused);
  const isRunNowDisabled = isRunningNowId !== null;

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
                        isMenuOpen={openRowMenuId === automation.id}
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
                        onToggleMenu={onToggleMenu}
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
                        isMenuOpen={openRowMenuId === automation.id}
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
                        onToggleMenu={onToggleMenu}
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
