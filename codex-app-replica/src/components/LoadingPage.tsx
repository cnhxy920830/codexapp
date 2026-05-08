import { useEffect, useState } from "react";
import { HomepageLogo } from "./HomepageLogo";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LOADING_LOGO_MASK_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 500' fill='black'%3E%3Cpath d='M330.34 313.62h-67.84c-7.65 0-13.85-6.2-13.85-13.85s6.2-13.85 13.85-13.85h67.84c7.65 0 13.85 6.2 13.85 13.85s-6.2 13.85-13.85 13.85Z'/%3E%3Cpath d='M169.65 313.38c-2.36 0-4.74-.6-6.93-1.87-6.62-3.83-8.88-12.31-5.05-18.93l23.78-41.08-23.91-43.21c-3.7-6.69-1.28-15.12 5.41-18.82 6.69-3.71 15.12-1.28 18.82 5.41l31.51 56.94-31.64 54.65c-2.57 4.43-7.22 6.91-12 6.91Z'/%3E%3Cpath d='M144.61 144.5c1.42-41.82 35.79-75.27 77.95-75.25 27.89.02 52.35 14.68 66.11 36.71 10.93-5.82 23.41-9.12 36.65-9.11 43.05.02 77.94 34.94 77.91 78 0 13.24-3.32 25.72-9.16 36.64 22.02 13.79 36.66 38.26 36.64 66.15-.02 42.16-33.52 76.48-75.34 77.86-1.42 41.82-35.78 75.28-77.94 75.25-27.89-.02-52.35-14.68-66.11-36.72-10.93 5.82-23.4 9.13-36.65 9.12-43.05-.02-77.94-34.94-77.91-78 0-13.24 3.32-25.72 9.16-36.64-22.02-13.79-36.65-38.26-36.64-66.15.02-42.16 33.51-76.48 75.33-77.86ZM297.77 71.99c-19.24-19.26-45.83-31.17-75.2-31.19-49.23-.03-90.67 33.39-102.84 78.79-45.41 12.12-78.87 53.52-78.9 102.76-.02 29.37 11.87 55.97 31.1 75.23-2.35 8.79-3.62 18.03-3.63 27.56-.03 58.77 47.58 106.44 106.35 106.47 9.53 0 18.77-1.25 27.55-3.6 19.24 19.26 45.84 31.18 75.21 31.2 49.24.03 90.67-33.39 102.84-78.8 45.42-12.11 78.88-53.51 78.91-102.75.02-29.37-11.87-55.98-31.11-75.24 2.35-8.78 3.62-18.02 3.63-27.55.03-58.77-47.58-106.44-106.35-106.47-9.53 0-18.77 1.25-27.56 3.59Z'/%3E%3C/svg%3E";

type LoadingPageProps = {
  overlay?: boolean;
  fillParent?: boolean;
  showLogo?: boolean;
  debugName?: string;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

function readPrefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
}

function LoadingLogo({ className }: { className?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div aria-hidden="true" className={joinClasses("relative inline-flex shrink-0 items-center justify-center", className)}>
      <HomepageLogo aria-hidden="true" className="codex-logo-shimmer-base h-full w-full" />
      <div
        className={joinClasses("pointer-events-none absolute inset-0", !prefersReducedMotion && "codex-logo-shimmer-overlay")}
        style={{
          WebkitMaskImage: `url(${LOADING_LOGO_MASK_URL})`,
          maskImage: `url(${LOADING_LOGO_MASK_URL})`,
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </div>
  );
}

export function LoadingPage({
  overlay = false,
  fillParent = false,
  showLogo = true,
  debugName: _debugName,
}: LoadingPageProps) {
  return (
    <div
      className={joinClasses(
        "flex items-center justify-center",
        overlay
          ? "absolute inset-0 z-10"
          : fillParent
            ? "absolute inset-0 bg-transparent"
            : "relative h-full w-full bg-transparent",
      )}
      style={
        overlay
          ? {
              backgroundColor: "color-mix(in srgb, var(--app-shell-surface) 70%, transparent)",
            }
          : undefined
      }
    >
      {overlay || fillParent ? null : (
        <div data-tauri-drag-region className="draggable absolute inset-x-0 top-0 h-[var(--app-shell-toolbar-sm)]" />
      )}
      <div className="flex flex-col items-center gap-2">
        {showLogo ? <LoadingLogo className="h-14 w-14" /> : null}
      </div>
    </div>
  );
}
