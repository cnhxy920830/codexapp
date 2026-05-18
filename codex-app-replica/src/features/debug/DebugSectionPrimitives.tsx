import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDownIcon, CopyPathIcon } from "../../components/AppShellIcons";

export function DebugSection({
  actions,
  className,
  children,
  onToggle,
  storageKey,
  title,
  unmountChildrenWhenClosed = false,
  variant = "selection",
}: {
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  onToggle?: (open: boolean) => void;
  storageKey: string;
  title: string;
  unmountChildrenWhenClosed?: boolean;
  variant?: "global" | "selection";
}) {
  const [open, setOpen] = useState(() => readSectionOpen(storageKey));

  useEffect(() => {
    writeSectionOpen(storageKey, open);
  }, [open, storageKey]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      onToggle?.(next);
      return next;
    });
  };

  return (
    <div>
      <div
        className={[
          "flex h-7 w-full items-center justify-between gap-2",
          variant === "selection" ? "bg-token-charts-blue/10 text-token-charts-blue" : "bg-token-foreground/5 text-token-foreground",
          className ?? "",
        ].join(" ")}
      >
        <button
          type="button"
          className={[
            "flex h-full min-w-0 flex-1 cursor-interaction items-center gap-2 px-3 text-left font-medium",
            variant === "selection" ? "hover:bg-token-charts-blue/15" : "hover:bg-token-foreground/10",
          ].join(" ")}
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="icon-2xs transition-transform duration-150" style={{ transform: `rotate(${open ? 0 : -90}deg)` }}>
            <ChevronDownIcon className="icon-2xs" />
          </span>
          {title}
        </button>
        <span className="flex items-center gap-1 pr-3 text-current">
          {actions ? (
            <span
              className="flex items-center gap-1"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {actions}
            </span>
          ) : null}
          {variant === "selection" ? <span className="ml-1 block h-2 w-2 rounded-full bg-current" /> : null}
        </span>
      </div>
      <div
        className="px-3"
        data-open={open}
        style={{
          contentVisibility: open ? "visible" : "hidden",
          display: open ? "block" : "none",
        }}
      >
        {unmountChildrenWhenClosed && !open ? null : children}
      </div>
    </div>
  );
}

export function DebugField({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="group/line-item relative flex items-start justify-between border-t-[0.5px] border-token-border py-1.5 tabular-nums first:border-t-0"
      style={{ "--debug-label-width": "110px" } as CSSProperties}
    >
      <span
        className="min-w-0 shrink-0 text-left break-words text-token-description-foreground"
        style={{ width: "var(--debug-label-width)" }}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words pr-3 text-left">{value}</span>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover/line-item:opacity-100"
        onClick={() => {
          if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
            return;
          }
          void navigator.clipboard.writeText(value).catch(() => {});
        }}
      >
        <CopyPathIcon className="icon-2xs" />
      </button>
    </div>
  );
}

export function DebugEmptyState({ message }: { message: string }) {
  return <div className="px-3 py-2 text-xs text-token-foreground-secondary">{message}</div>;
}

function readSectionOpen(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "open") {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function writeSectionOpen(storageKey: string, open: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, open ? "open" : "closed");
  } catch {
    // ignore
  }
}
