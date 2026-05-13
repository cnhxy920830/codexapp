import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function DebugSection({
  storageKey,
  title,
  children,
  defaultOpen = true,
}: {
  storageKey: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(readSectionOpen(storageKey, defaultOpen));

  useEffect(() => {
    writeSectionOpen(storageKey, open);
  }, [open, storageKey]);

  return (
    <details
      className="group rounded-xl border border-token-border bg-token-foreground/[0.03] shadow-sm"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[10px] transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▶
          </span>
          <span className="truncate font-medium text-token-foreground">{title}</span>
        </span>
      </summary>
      <div className="border-t border-token-border px-3 pb-3">{children}</div>
    </details>
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
    </div>
  );
}

export function DebugEmptyState({ message }: { message: string }) {
  return <div className="px-3 py-2 text-xs text-token-foreground-secondary">{message}</div>;
}

function readSectionOpen(storageKey: string, defaultOpen: boolean) {
  if (typeof window === "undefined") {
    return defaultOpen;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "open") {
      return true;
    }
    if (stored === "closed") {
      return false;
    }
  } catch {
    return defaultOpen;
  }

  return defaultOpen;
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
