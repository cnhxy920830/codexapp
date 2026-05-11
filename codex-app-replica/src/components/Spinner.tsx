import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function Spinner({
  animationDurationMs,
  className,
}: {
  animationDurationMs?: number;
  className?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationDelay = `-${Date.now() % 1000}ms`;
  const animationDuration = animationDurationMs === undefined ? undefined : `${animationDurationMs}ms`;

  return (
    <div
      className={joinClasses(
        !prefersReducedMotion && "animate-spin",
        "inline-flex h-fit w-fit contain-paint contain-layout contain-style",
      )}
      style={{
        animationDelay,
        animationDuration,
      }}
    >
      <SpinnerIcon className={className} />
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        opacity="0.3"
        d="M18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12ZM20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z"
        fill="currentColor"
      />
      <path
        d="M12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12H6C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => {
        mediaQuery.removeEventListener("change", onChange);
      };
    }

    mediaQuery.addListener(onChange);
    return () => {
      mediaQuery.removeListener(onChange);
    };
  }, []);

  return prefersReducedMotion;
}

function getPrefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
