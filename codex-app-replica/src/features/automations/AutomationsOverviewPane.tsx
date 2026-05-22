import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ClockIcon,
  MoreActionsIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayOutlineIcon,
  ResumeCircleIcon,
  TrashIcon,
  UnselectedCircleIcon,
} from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";
import { Tooltip } from "../../components/Tooltip";
import { renderInlineLinkMessage } from "../../i18n/renderInlineLinkMessage";
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

function useSelectableRow(onSelect: () => void, isDisabled = false) {
  return {
    role: "button" as const,
    tabIndex: isDisabled ? -1 : 0,
    "aria-disabled": isDisabled,
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isDisabled && !event.defaultPrevented) {
        onSelect();
      }
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        isDisabled ||
        event.defaultPrevented ||
        event.currentTarget !== event.target
      ) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
  };
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

function MoreActionsTrigger({
  isOpen,
}: {
  isOpen: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-state={isOpen ? "open" : "closed"}
      className="text-token-description-foreground hover:text-token-foreground"
    >
      <MoreActionsIcon className="icon-sm" />
    </span>
  );
}

function useAutomationRowDropdown(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusFirstItemRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldFocusFirstItemRef.current) {
      return;
    }

    shouldFocusFirstItemRef.current = false;
    const firstFocusableItem =
      menuItemRefs.current.find((item) => item !== null && item.disabled !== true) ?? null;
    firstFocusableItem?.focus();
  }, [isOpen]);

  const closeMenu = (options?: { restoreFocus?: boolean }) => {
    shouldFocusFirstItemRef.current = false;
    setIsOpen(false);
    if (options?.restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const focusMenuItem = (startIndex: number, direction: 1 | -1) => {
    for (
      let index = startIndex;
      index >= 0 && index < menuItemRefs.current.length;
      index += direction
    ) {
      const nextItem = menuItemRefs.current[index];
      if (nextItem == null || nextItem.disabled) {
        continue;
      }
      nextItem.focus();
      return;
    }
  };

  const handleMenuItemKeyDown = (
    index: number,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(index + 1, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(index - 1, -1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0, 1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(menuItemRefs.current.length - 1, -1);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  };

  return {
    closeMenu,
    containerRef,
    createMenuItemRefHandler: (index: number) => (node: HTMLButtonElement | null) => {
      menuItemRefs.current[index] = node;
    },
    createTriggerClickHandler:
      (beforeToggle?: (event: React.MouseEvent<HTMLButtonElement>) => void) =>
      (event: React.MouseEvent<HTMLButtonElement>) => {
        triggerRef.current = event.currentTarget;
        shouldFocusFirstItemRef.current = false;
        beforeToggle?.(event);
        setIsOpen((current) => !current);
      },
    createTriggerKeyDownHandler:
      (beforeOpen?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void) =>
      (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        triggerRef.current = event.currentTarget;
        if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        beforeOpen?.(event);
        shouldFocusFirstItemRef.current = true;
        setIsOpen(true);
      },
    handleMenuItemKeyDown,
    handleMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Tab") {
        event.preventDefault();
      }
    },
    isOpen,
  };
}

const AUTOMATIONS_HELP_URL = "https://developers.openai.com/codex/app/automations";

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
  const dropdown = useAutomationRowDropdown(defaultOpenMenu);
  const menuId = useId();
  const shouldSkipSelectRef = useRef(false);
  const scheduleLabel = formatScheduleSummary(automation, locale, t);
  const isPausedState = automation.status === "PAUSED";
  const rowProps = useSelectableRow(() => {
    if (shouldSkipSelectRef.current) {
      shouldSkipSelectRef.current = false;
      return;
    }
    onSelect(automation);
  });
  const moreLabel = t("inbox.automations.rowActions");

  const icon = isPausedState ? (
    <PauseCircleIcon className="icon-sm shrink-0 text-token-description-foreground" />
  ) : (
    <UnselectedCircleIcon className="icon-sm shrink-0 text-token-description-foreground" />
  );
  const statusText = isPausedState ? formatStatusLabel(automation.status, t) : null;
  const scheduleVisibilityClass = dropdown.isOpen
    ? "opacity-0"
    : "group-hover:opacity-0";
  const actionVisibilityClass = dropdown.isOpen
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100";
  const canPause = !isPausedState;
  const canResume = isPausedState;

  return (
    <div
      ref={dropdown.containerRef}
      className={joinClasses(
        "group relative min-h-10 w-full rounded-lg px-3 py-3 text-base cursor-interaction text-left automation-row",
        isSelected
          ? "bg-token-list-active-selection-background"
          : "hover:bg-token-list-active-selection-background",
      )}
      aria-label={automation.name.trim() || t("settings.automations.namePlaceholder")}
      {...rowProps}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex min-h-6 shrink-0 items-center">
          {icon}
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
              className={joinClasses(
                "flex shrink-0 items-center text-base text-token-description-foreground",
                isRunNowPending || isPausedState ? "gap-2" : "gap-0",
              )}
            >
              {!isPausedState && scheduleLabel ? (
                <span
                  className={joinClasses(
                    "min-w-20 whitespace-nowrap text-right",
                    scheduleVisibilityClass,
                  )}
                >
                  {scheduleLabel}
                </span>
              ) : null}
              <span
                className={joinClasses(
                  "relative inline-flex justify-end",
                  !scheduleLabel || isPausedState ? "min-w-20" : null,
                )}
              >
                {statusText ? (
                  <span className={scheduleVisibilityClass}>
                    {statusText}
                  </span>
                ) : (
                  <span />
                )}
                <span className={joinClasses("absolute inset-y-0 right-0 flex items-center gap-2.5", actionVisibilityClass)}>
                  <Tooltip tooltipContent={t("settings.automations.runNow")}>
                    <button
                      type="button"
                      aria-label={t("settings.automations.runNow")}
                      className="flex cursor-interaction items-center justify-center text-token-description-foreground hover:text-token-foreground disabled:cursor-default"
                      disabled={isRunNowDisabled}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRunNow(automation);
                      }}
                    >
                      {isRunNowPending ? (
                        <Spinner className="icon-sm" />
                      ) : (
                        <PlayOutlineIcon className="icon-sm" />
                      )}
                    </button>
                  </Tooltip>
                  <Tooltip tooltipContent={t("inbox.automations.editTooltip")}>
                    <button
                      type="button"
                      className="flex items-center justify-center text-token-description-foreground hover:text-token-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onEdit(automation);
                      }}
                    >
                      <PencilIcon className="icon-sm" />
                    </button>
                  </Tooltip>
                  <Tooltip tooltipContent={t("inbox.automations.moreOptionsTooltip")}>
                    <div className="flex">
                      <button
                        type="button"
                        aria-controls={dropdown.isOpen ? menuId : undefined}
                        aria-expanded={dropdown.isOpen}
                        aria-haspopup="menu"
                        aria-label={moreLabel}
                        className="flex items-center justify-center text-token-description-foreground hover:text-token-foreground"
                        data-state={dropdown.isOpen ? "open" : "closed"}
                        onClick={dropdown.createTriggerClickHandler((event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        })}
                        onKeyDown={dropdown.createTriggerKeyDownHandler((event) => {
                          event.stopPropagation();
                        })}
                      >
                        <MoreActionsTrigger isOpen={dropdown.isOpen} />
                      </button>
                    </div>
                  </Tooltip>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      {dropdown.isOpen ? (
        <div className="app-card absolute top-[calc(100%-6px)] right-3 z-10 min-w-[180px] rounded-[14px] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
          <div
            id={menuId}
            aria-orientation="vertical"
            className="no-drag m-px flex min-w-[220px] select-none flex-col overflow-y-auto rounded-xl bg-token-dropdown-background/90 px-1 py-1 text-token-foreground ring-token-border shadow-xl-spread ring-[0.5px] backdrop-blur-sm"
            onKeyDown={dropdown.handleMenuKeyDown}
            role="menu"
          >
            {canPause ? (
              <button
                type="button"
                ref={dropdown.createMenuItemRefHandler(0)}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  shouldSkipSelectRef.current = true;
                  dropdown.closeMenu({ restoreFocus: true });
                  onPause(automation);
                }}
                onKeyDown={(event) => dropdown.handleMenuItemKeyDown(0, event)}
                onMouseMove={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                }}
                className="no-drag flex w-full items-center rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-left text-sm text-token-foreground outline-hidden hover:bg-token-list-hover-background focus:bg-token-list-hover-background"
              >
                <PauseCircleIcon className="icon-sm mr-2" />
                {t("inbox.automations.pauseMenuItem")}
              </button>
            ) : null}
            {canResume ? (
              <button
                type="button"
                ref={dropdown.createMenuItemRefHandler(0)}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  shouldSkipSelectRef.current = true;
                  dropdown.closeMenu({ restoreFocus: true });
                  onResume(automation);
                }}
                onKeyDown={(event) => dropdown.handleMenuItemKeyDown(0, event)}
                onMouseMove={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                }}
                className="no-drag flex w-full items-center rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-left text-sm text-token-foreground outline-hidden hover:bg-token-list-hover-background focus:bg-token-list-hover-background"
              >
                <ResumeCircleIcon className="icon-sm mr-2" />
                {t("inbox.automations.resumeMenuItem")}
              </button>
            ) : null}
            <button
              type="button"
              ref={dropdown.createMenuItemRefHandler(canPause || canResume ? 1 : 0)}
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                shouldSkipSelectRef.current = true;
                dropdown.closeMenu({ restoreFocus: true });
                onDelete(automation);
              }}
              onKeyDown={(event) =>
                dropdown.handleMenuItemKeyDown(canPause || canResume ? 1 : 0, event)
              }
              onMouseMove={(event) => {
                event.currentTarget.focus({ preventScroll: true });
              }}
              className="no-drag flex w-full items-center rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-left text-sm text-token-charts-red outline-hidden hover:bg-token-list-hover-background focus:bg-token-list-hover-background"
            >
              <TrashIcon className="icon-sm mr-2" />
              {t("inbox.automations.deleteMenuItem")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AutomationsOverviewHeader({ t }: { t: TranslateFn }) {
  return (
    <div className="heading-xl font-normal text-token-foreground">
      {t("inbox.mode.automations")}
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

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col gap-2 px-panel pt-panel pb-panel">
        <AutomationsOverviewHeader t={t} />
        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-token-description-foreground">
          <Spinner className="icon-sm shrink-0 text-token-description-foreground" />
          {t("inbox.automations.loading")}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-1 px-panel pt-panel pb-6">
          <AutomationsOverviewHeader t={t} />
          <div className="text-lg font-normal text-token-description-foreground">
            {renderInlineLinkMessage(
              t("inbox.automations.emptySubtitle.learnMore"),
              AUTOMATIONS_HELP_URL,
            )}
          </div>
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col gap-4 px-panel pb-panel">
          <AutomationsQuickStartTemplates
            baseDraft={quickStartBaseDraft}
            className=""
            onSelectAction={onSelectQuickStart}
            t={t}
          />
        </div>
      </div>
    );
  }

  return (
    <SectionedPage
      ariaLabel={t("inbox.automations.sectionsNav")}
      className="[--sectioned-page-leading-inset:0]"
      contentInnerClassName="flex flex-col gap-8 px-panel pb-panel [&>section]:gap-2"
      header={<AutomationsOverviewHeader t={t} />}
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
  );
}
