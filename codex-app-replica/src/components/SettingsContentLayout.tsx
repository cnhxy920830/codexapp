import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SettingsContentLayoutProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  action?: ReactNode;
  backSlot?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  fullWidth?: boolean;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  title?: ReactNode;
};

export function SettingsContentLayout({
  action,
  backSlot,
  children,
  className,
  contentClassName,
  fullWidth = false,
  subtitle,
  subtitleClassName,
  title,
  ...props
}: SettingsContentLayoutProps) {
  const hasHeader = title != null || subtitle != null || action != null;

  return (
    <div className={joinClasses("main-surface flex h-full min-h-0 flex-col", className)} {...props}>
      {backSlot ? (
        <div className="draggable flex items-center px-panel electron:h-toolbar extension:h-toolbar-sm">
          {backSlot}
        </div>
      ) : null}
      <div className="scrollbar-stable flex-1 overflow-y-auto p-panel">
        <div
          className={joinClasses(
            "mx-auto flex w-full flex-col",
            fullWidth ? null : "max-w-2xl electron:min-w-[calc(320px*var(--codex-window-zoom))]",
            contentClassName,
          )}
        >
          {hasHeader ? (
            <div className="flex items-center justify-between gap-3 pb-panel">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-panel">
                {title ? <div className="electron:heading-lg heading-base truncate">{title}</div> : null}
                {subtitle ? (
                  <div className={joinClasses("text-base text-token-text-secondary", subtitleClassName ?? "truncate")}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-[var(--padding-panel)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
