import type { PointerEventHandler, Ref } from "react";
import { SplitterGripIcon } from "./AppShellIcons";

type AppShellRightPanelLayoutProps = {
  children: React.ReactNode;
  isRightPanelOpen: boolean;
  isRightPanelResizing: boolean;
  onRightPanelResizePointerDown?: PointerEventHandler<HTMLDivElement>;
  rightPanelContentRef?: Ref<HTMLDivElement>;
  rightPanelWidth: number;
  separatorAriaLabel: string;
};

export function AppShellRightPanelLayout({
  children,
  isRightPanelOpen,
  isRightPanelResizing,
  onRightPanelResizePointerDown,
  rightPanelContentRef,
  rightPanelWidth,
  separatorAriaLabel,
}: AppShellRightPanelLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-w-0 flex-1">{children}</div>

      {isRightPanelOpen ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={separatorAriaLabel}
            onPointerDown={onRightPanelResizePointerDown}
            className={[
              "group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-transparent",
              isRightPanelResizing ? "app-right-panel-splitter-active" : "app-right-panel-splitter",
            ].join(" ")}
          >
            <div className="app-right-panel-splitter-line h-full w-px" />
            <div className="app-right-panel-splitter-grip pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full">
              <SplitterGripIcon className="h-4 w-4" />
            </div>
          </div>
          <aside
            className="relative h-full min-h-0 min-w-0 shrink-0 overflow-visible shadow-xl"
            style={{ width: `${rightPanelWidth}px` }}
          >
            <div className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
              <div
                className="absolute bottom-0 left-0 top-0 min-w-0 border-l border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]"
                style={{ width: "100%" }}
              >
                <div ref={rightPanelContentRef} className="h-full min-h-0 min-w-0 overflow-hidden" />
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
