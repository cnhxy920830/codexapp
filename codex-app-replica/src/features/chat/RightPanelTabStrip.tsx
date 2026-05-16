import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BrowserTabIcon,
  ChevronDownIcon,
  CloseTabIcon,
  ExpandPanelIcon,
  ForkedConversationIcon,
  RestorePanelWidthIcon,
  ReviewTabIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { RightPanelTab } from "./rightPanelTabs";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type RightPanelQuickOpenActionsProps = {
  activeStaticTabId: "browser" | "review" | null;
  onOpenBrowserTab: () => void;
  onOpenReviewTab: () => void;
  t: Translate;
};

type RightPanelTabStripProps = RightPanelQuickOpenActionsProps & {
  activeTabId: string | null;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTabs: (activeTabId: string, overTabId: string) => void;
  onToggleFullWidth: () => void;
  onTogglePanel: () => void;
  openTabs: RightPanelTab[];
  rightPanelWidthMode: "full" | "regular";
};

type RightPanelCollapsedRailProps = RightPanelQuickOpenActionsProps & {
  collapsedTabs: RightPanelTab[];
  onActivateTab: (tabId: string) => void;
};

type RightPanelTabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
};

export function RightPanelCollapsedRail({
  activeStaticTabId,
  collapsedTabs,
  onActivateTab,
  onOpenBrowserTab,
  onOpenReviewTab,
  t,
}: RightPanelCollapsedRailProps) {
  return (
    <aside className="app-right-panel-collapsed-rail flex w-[54px] shrink-0 flex-col items-center gap-2 px-2 py-3">
      <RightPanelQuickOpenActions
        activeStaticTabId={activeStaticTabId}
        onOpenBrowserTab={onOpenBrowserTab}
        onOpenReviewTab={onOpenReviewTab}
        t={t}
        buttonClassName="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px]"
      />
      {collapsedTabs.length > 0 ? (
        <div className="h-px w-6 bg-[var(--app-shell-border)]" />
      ) : null}
      {collapsedTabs.map((tab) => {
        const title = getRightPanelTabTitle(tab, t);
        const tooltip = getRightPanelTabTooltip(tab, t);
        return (
          <IconActionButton
            key={tab.id}
            className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px]"
            label={title}
            onClick={() => onActivateTab(tab.id)}
            tooltip={tooltip}
          >
            {renderRightPanelTabIcon(tab)}
          </IconActionButton>
        );
      })}
    </aside>
  );
}

export function RightPanelTabStrip({
  activeTabId,
  activeStaticTabId,
  onActivateTab,
  onCloseTab,
  onReorderTabs,
  onToggleFullWidth,
  onTogglePanel,
  onOpenBrowserTab,
  onOpenReviewTab,
  openTabs,
  rightPanelWidthMode,
  t,
}: RightPanelTabStripProps) {
  const [contextMenuState, setContextMenuState] = useState<RightPanelTabContextMenuState | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [isLeftFadeVisible, setIsLeftFadeVisible] = useState(false);
  const [isRightFadeVisible, setIsRightFadeVisible] = useState(false);
  const [stickyTrailingWidth, setStickyTrailingWidth] = useState(0);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const stickyTrailingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (contextMenuState === null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenuState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuState]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer === null) {
      return;
    }

    const updateFadeState = () => {
      const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
      if (maxScrollLeft <= 1) {
        setIsLeftFadeVisible(false);
        setIsRightFadeVisible(false);
        return;
      }

      setIsLeftFadeVisible(scrollContainer.scrollLeft > 1);
      setIsRightFadeVisible(scrollContainer.scrollLeft < maxScrollLeft - 1);
    };

    updateFadeState();
    scrollContainer.addEventListener("scroll", updateFadeState, { passive: true });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        scrollContainer.removeEventListener("scroll", updateFadeState);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateFadeState();
    });
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener("scroll", updateFadeState);
      resizeObserver.disconnect();
    };
  }, [activeStaticTabId, activeTabId, openTabs, rightPanelWidthMode]);

  useEffect(() => {
    const stickyTrailing = stickyTrailingRef.current;
    if (stickyTrailing === null) {
      return;
    }

    const updateWidth = () => {
      setStickyTrailingWidth(Math.round(stickyTrailing.getBoundingClientRect().width));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(stickyTrailing);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeStaticTabId]);

  const activeTabIndex = activeTabId === null ? -1 : openTabs.findIndex((tab) => tab.id === activeTabId);

  return (
    <div className="app-right-panel-tab-strip flex h-[var(--app-shell-toolbar-pane)] min-w-0 shrink-0 items-center border-b border-[var(--app-shell-border)] px-2">
      <div
        ref={scrollContainerRef}
        className="hide-scrollbar relative flex h-full min-w-0 flex-1 scroll-px-1 items-center overflow-x-auto overflow-y-hidden"
        style={{ scrollPaddingInlineEnd: `${stickyTrailingWidth}px` }}
        onDragOver={(event) => {
          if (draggedTabId === null) {
            return;
          }
          event.preventDefault();
        }}
        onDrop={() => {
          setDraggedTabId(null);
        }}
      >
        <div
          aria-hidden="true"
          className={joinClassNames(
            "sticky left-0 z-10 h-full w-0 after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:top-0 after:w-10 after:bg-gradient-to-l after:from-transparent after:content-[''] after:transition-opacity after:duration-100",
            isLeftFadeVisible
              ? "after:to-[var(--app-shell-main-surface)] after:opacity-100"
              : "after:to-[var(--app-shell-main-surface)] after:opacity-0",
          )}
        />
        <div
          role="tablist"
          className={joinClassNames("relative flex", draggedTabId === null ? "z-0" : "z-20")}
          style={{ gap: 3 }}
        >
          {openTabs.map((tab, index) => {
            const title = getRightPanelTabTitle(tab, t);
            const tooltip = getRightPanelTabTooltip(tab, t);
            const isActive = tab.id === activeTabId;
            const icon = renderRightPanelTabIcon(tab);
            const isDragged = draggedTabId === tab.id;
            const showTrailingSeparator =
              index < openTabs.length - 1 && !isActive && index !== activeTabIndex - 1;
            const tabStyle = {
              "--app-shell-tab-background": isActive
                ? "color-mix(in srgb, var(--app-shell-accent) 10%, var(--app-shell-main-surface))"
                : "color-mix(in srgb, var(--app-shell-control-hover) 82%, var(--app-shell-main-surface))",
            } as CSSProperties;

            return (
              <div
                key={tab.id}
                className={joinClassNames(
                  "my-auto relative flex max-w-40 shrink-0 items-center gap-0.5 pe-1 contain-content",
                  isDragged ? "z-10 cursor-grab" : null,
                )}
              >
                <div
                  draggable={true}
                  data-tab-id={tab.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", tab.id);
                    setDraggedTabId(tab.id);
                  }}
                  onDragEnd={() => {
                    setDraggedTabId(null);
                  }}
                  onDragOver={(event) => {
                    if (draggedTabId === null || draggedTabId === tab.id) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    if (draggedTabId === null || draggedTabId === tab.id) {
                      return;
                    }
                    event.preventDefault();
                    onReorderTabs(draggedTabId, tab.id);
                    setDraggedTabId(null);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenuState({
                      tabId: tab.id,
                      x: getRightPanelContextMenuLeft(event.clientX),
                      y: getRightPanelContextMenuTop(event.clientY),
                    });
                  }}
                  style={tabStyle}
                  className={joinClassNames(
                    "group/tab relative flex h-7 max-w-[9.75rem] shrink-0 items-center overflow-hidden rounded-lg bg-[var(--app-shell-main-surface)] px-2 py-1 transition-opacity",
                    isDragged ? "opacity-50" : "opacity-100",
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={joinClassNames(
                      "pointer-events-none absolute inset-0 z-0 rounded-md transition-colors",
                      isActive
                        ? "bg-[var(--app-shell-tab-background)]"
                        : "group-hover/tab:bg-[var(--app-shell-tab-background)]",
                    )}
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onMouseDown={(event) => {
                      if (event.button !== 1) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    onClick={() => onActivateTab(tab.id)}
                    className={joinClassNames(
                      "no-drag relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left text-sm",
                      isActive ? "text-[var(--app-shell-text)]" : "text-[var(--app-shell-muted)]",
                    )}
                  >
                    <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {icon}
                    </span>
                    <RightPanelTooltip content={tooltip} wrapperClassName="min-w-0">
                      <span className="min-w-0 truncate">{title}</span>
                    </RightPanelTooltip>
                  </button>
                  <button
                    type="button"
                    aria-label={t("codex.tabs.closeNamed", { title })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="no-drag absolute inset-y-0 left-0 z-30 hidden shrink-0 items-center justify-center bg-[var(--app-shell-tab-background)] px-0.5 text-[var(--app-shell-subtle)] after:absolute after:-inset-1 after:content-[''] group-hover/tab:flex hover:text-[var(--app-shell-text)]"
                  >
                    <CloseTabIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div
                  aria-hidden="true"
                  data-app-shell-tab-separator={tab.id}
                  data-app-shell-tab-separator-index={index}
                  className={joinClassNames(
                    "absolute right-0 h-3 w-px shrink-0 bg-[var(--app-shell-border)] transition-opacity duration-200",
                    showTrailingSeparator ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className={joinClassNames(
            "sticky z-10 h-full w-0 after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:w-10 after:bg-gradient-to-r after:from-transparent after:content-[''] after:transition-opacity after:duration-100",
            isRightFadeVisible
              ? "after:to-[var(--app-shell-main-surface)] after:opacity-100"
              : "after:to-[var(--app-shell-main-surface)] after:opacity-0",
          )}
          style={{ right: stickyTrailingWidth }}
        />
        <div
          ref={stickyTrailingRef}
          className={joinClassNames(
            "sticky right-0 shrink-0 bg-[var(--app-shell-main-surface)]",
            draggedTabId === null ? "z-10" : "pointer-events-none z-0",
          )}
        >
          <div className="flex shrink-0 items-center gap-1">
            <RightPanelQuickOpenActions
              activeStaticTabId={activeStaticTabId}
              onOpenBrowserTab={onOpenBrowserTab}
              onOpenReviewTab={onOpenReviewTab}
              t={t}
              buttonClassName="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
            />
          </div>
        </div>
      </div>
      <div className="my-auto flex shrink-0 items-center gap-1" role="presentation">
        <IconActionButton
          className="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
          label={
            rightPanelWidthMode === "full"
              ? t("codex.rightPanel.restoreWidth")
              : t("codex.rightPanel.expandFullWidth")
          }
          onClick={onToggleFullWidth}
          pressed={rightPanelWidthMode === "full"}
        >
          {rightPanelWidthMode === "full" ? (
            <RestorePanelWidthIcon className="h-4 w-4" />
          ) : (
            <ExpandPanelIcon className="h-4 w-4" />
          )}
        </IconActionButton>
        <IconActionButton
          className="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
          label={t("thread.sidePanel.toggle")}
          onClick={onTogglePanel}
        >
          <ChevronDownIcon className="h-4 w-4 -rotate-90" />
        </IconActionButton>
      </div>
      {contextMenuState ? (
        <div
          ref={contextMenuRef}
          className="app-card fixed z-20 min-w-[148px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
          style={{
            left: `${contextMenuState.x}px`,
            top: `${contextMenuState.y}px`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onCloseTab(contextMenuState.tabId);
              setContextMenuState(null);
            }}
            className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
          >
            {t("codex.tabs.contextMenu.close")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RightPanelQuickOpenActions({
  activeStaticTabId,
  onOpenBrowserTab,
  onOpenReviewTab,
  t,
  buttonClassName,
}: RightPanelQuickOpenActionsProps & {
  buttonClassName: string;
}) {
  return (
    <>
      <IconActionButton
        className={joinClassNames(
          buttonClassName,
          activeStaticTabId === "review"
            ? "bg-[var(--app-shell-control-hover)] text-[var(--app-shell-text)]"
            : null,
        )}
        label={t("thread.sidePanel.openReviewTab")}
        onClick={onOpenReviewTab}
      >
        <ReviewTabIcon className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton
        className={joinClassNames(
          buttonClassName,
          activeStaticTabId === "browser"
            ? "bg-[var(--app-shell-control-hover)] text-[var(--app-shell-text)]"
            : null,
        )}
        label={t("thread.sidePanel.openBrowserTab")}
        onClick={onOpenBrowserTab}
      >
        <BrowserTabIcon className="h-4 w-4" />
      </IconActionButton>
    </>
  );
}

function IconActionButton({
  children,
  className,
  label,
  onClick,
  pressed = false,
  tooltip,
}: {
  children: ReactNode;
  className: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tooltip?: string;
}) {
  return (
    <RightPanelTooltip content={tooltip ?? label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={className}
      >
        {children}
      </button>
    </RightPanelTooltip>
  );
}

function getRightPanelTabTitle(tab: RightPanelTab, t: Translate) {
  switch (tab.kind) {
    case "sideChat":
      return tab.title;
    case "workspaceFile":
      return tab.title;
  }
}

function getRightPanelTabTooltip(tab: RightPanelTab, t: Translate) {
  if (tab.kind === "workspaceFile") {
    return tab.file.relativePath || tab.file.path;
  }
  return getRightPanelTabTitle(tab, t);
}

function renderRightPanelTabIcon(tab: RightPanelTab) {
  if (tab.kind === "sideChat") {
    return <ForkedConversationIcon className="h-4 w-4 shrink-0" />;
  }
  return <WorkspaceFileIcon className="h-4 w-4 shrink-0" />;
}

function RightPanelTooltip({
  children,
  content,
  wrapperClassName = "",
}: {
  children: ReactNode;
  content: ReactNode;
  wrapperClassName?: string;
}) {
  return (
    <div className={joinClassNames("group relative flex shrink-0 items-center", wrapperClassName)}>
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden max-w-[min(32rem,calc(100vw-16px))] -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

function getRightPanelContextMenuLeft(clientX: number) {
  if (typeof window === "undefined") {
    return clientX;
  }

  const contextMenuWidth = 148;
  const viewportPadding = 8;
  return Math.max(
    viewportPadding,
    Math.min(clientX, window.innerWidth - contextMenuWidth - viewportPadding),
  );
}

function getRightPanelContextMenuTop(clientY: number) {
  if (typeof window === "undefined") {
    return clientY;
  }

  const contextMenuHeight = 48;
  const viewportPadding = 8;
  return Math.max(
    viewportPadding,
    Math.min(clientY, window.innerHeight - contextMenuHeight - viewportPadding),
  );
}

function joinClassNames(...values: Array<string | null>) {
  return values.filter((value): value is string => value !== null && value.length > 0).join(" ");
}
