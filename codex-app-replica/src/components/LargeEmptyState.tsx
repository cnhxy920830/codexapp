import type { ReactNode } from "react";

type LargeEmptyStateProps = {
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  illustration?: ReactNode;
  title?: ReactNode;
  titleSize?: "default" | "lg";
  tone?: "default" | "faded";
};

export function LargeEmptyState({
  actions,
  className,
  contentClassName,
  description,
  illustration,
  title,
  titleSize = "default",
  tone = "default",
}: LargeEmptyStateProps) {
  const fadedClassName = tone === "faded" ? "opacity-60" : null;

  return (
    <div className={joinClasses("flex w-full flex-col items-center justify-center px-3 py-6", className)}>
      <div
        className={joinClasses(
          "flex w-full max-w-xl flex-col items-center justify-center gap-6 text-center",
          fadedClassName,
          contentClassName,
        )}
      >
        {illustration ? (
          <div className="pointer-events-none text-token-input-placeholder-foreground">{illustration}</div>
        ) : null}

        {title != null || description != null ? (
          <div className="flex flex-col items-center gap-2">
            {title != null ? (
              <div className={joinClasses("font-medium", titleSize === "lg" ? "text-lg" : "text-base")}>{title}</div>
            ) : null}
            {description ? <div className="text-base text-token-description-foreground">{description}</div> : null}
          </div>
        ) : null}

        {actions ? <div className="flex w-full flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
