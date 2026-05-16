import { useEffect, useRef, useState, type ReactNode } from "react";
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
            title={tooltip}
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
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="app-right-panel-tab-strip flex h-[var(--app-shell-toolbar-pane)] shrink-0 items-center gap-2 border-b border-[var(--app-shell-border)] px-2.5">
      <div
        className="hide-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto py-1"
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
        {openTabs.map((tab) => {
          const title = getRightPanelTabTitle(tab, t);
          const tooltip = getRightPanelTabTooltip(tab, t);
          const isActive = tab.id === activeTabId;
          const icon = renderRightPanelTabIcon(tab);
          const isDragged = draggedTabId === tab.id;

          return (
            <div
              key={tab.id}
              draggable={true}
              role="tab"
              aria-selected={isActive}
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
              className={[
                "group mr-1 flex h-7 max-w-40 shrink-0 items-center gap-1 rounded-[10px] px-1.5 transition-opacity",
                isActive
                  ? "bg-[var(--app-shell-main-surface)] text-[var(--app-shell-text)] shadow-[var(--app-shell-card-shadow)]"
                  : "text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-control-hover)]",
                isDragged ? "opacity-50" : "opacity-100",
              ].join(" ")}
            >
              <button
                type="button"
                title={tooltip}
                onMouseDown={(event) => {
                  if (event.button !== 1) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                onClick={() => onActivateTab(tab.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-1 text-left text-[13px]"
              >
                {icon}
                <span className="truncate">{title}</span>
              </button>
              <button
                type="button"
                title={t("codex.tabs.closeNamed", { title })}
                aria-label={t("codex.tabs.closeNamed", { title })}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] text-[var(--app-shell-subtle)] hover:bg-[var(--app-shell-control-hover)] hover:text-[var(--app-shell-text)]",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                ].join(" ")}
              >
                <CloseTabIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <RightPanelQuickOpenActions
          activeStaticTabId={activeStaticTabId}
          onOpenBrowserTab={onOpenBrowserTab}
          onOpenReviewTab={onOpenReviewTab}
          t={t}
          buttonClassName="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
        />
        <button
          type="button"
          title={
            rightPanelWidthMode === "full"
              ? t("codex.rightPanel.restoreWidth")
              : t("codex.rightPanel.expandFullWidth")
          }
          aria-label={
            rightPanelWidthMode === "full"
              ? t("codex.rightPanel.restoreWidth")
              : t("codex.rightPanel.expandFullWidth")
          }
          aria-pressed={rightPanelWidthMode === "full"}
          onClick={onToggleFullWidth}
          className="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
        >
          {rightPanelWidthMode === "full" ? (
            <RestorePanelWidthIcon className="h-4 w-4" />
          ) : (
            <ExpandPanelIcon className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          title={t("thread.sidePanel.toggle")}
          aria-label={t("thread.sidePanel.toggle")}
          onClick={onTogglePanel}
          className="app-topbar-button no-drag flex h-7 w-7 items-center justify-center rounded-[8px] text-[12px]"
        >
          <ChevronDownIcon className="h-4 w-4 -rotate-90" />
        </button>
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
  title,
}: {
  children: ReactNode;
  className: string;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-label={label}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
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
