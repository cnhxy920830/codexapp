import { useEffect, useRef } from "react";
import {
  navigateBrowserSidebar,
  setBrowserSidebarBounds,
  setBrowserSidebarVisible,
  type BrowserSidebarTarget,
} from "../../services/browserSidebar";

type BrowserSidebarPanelProps = {
  target: BrowserSidebarTarget | null;
};

export function BrowserSidebarPanel({
  target,
}: BrowserSidebarPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateBounds = () => {
      const container = containerRef.current;
      if (container == null) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        return;
      }

      void setBrowserSidebarBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }).catch(() => undefined);
    };

    updateBounds();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateBounds();
          });

    if (containerRef.current != null) {
      resizeObserver?.observe(containerRef.current);
    }

    window.addEventListener("resize", updateBounds);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateBounds);
      void setBrowserSidebarVisible(false).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (target == null) {
      void setBrowserSidebarVisible(false).catch(() => undefined);
      return;
    }

    const container = containerRef.current;
    if (container != null) {
      const rect = container.getBoundingClientRect();
      if (rect.width >= 1 && rect.height >= 1) {
        void setBrowserSidebarBounds({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        }).catch(() => undefined);
      }
    }

    void setBrowserSidebarVisible(true).catch(() => undefined);
    void navigateBrowserSidebar(target).catch(() => undefined);
  }, [target]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[var(--app-shell-main-surface)]">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
