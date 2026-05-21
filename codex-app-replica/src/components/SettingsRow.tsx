import type { ReactNode } from "react";

type SettingsRowVariant = "default" | "nested";
type SettingsValueRowVariant = "default" | "compact";

export function SettingsRow({
  className,
  control,
  description,
  icon,
  id,
  label,
  variant = "default",
}: {
  className?: string;
  control?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  id?: string;
  label: ReactNode;
  variant?: SettingsRowVariant;
}) {
  const rowClassName =
    variant === "nested"
      ? "flex min-h-10 items-center justify-between gap-3 px-4 py-0.5 max-sm:min-h-0 max-sm:flex-col max-sm:items-stretch"
      : "flex items-center justify-between gap-4 p-3";
  const descriptionClassName =
    variant === "nested"
      ? "text-token-text-secondary min-w-0 text-xs"
      : "text-token-text-secondary min-w-0 text-sm";
  const controlClassName =
    variant === "nested"
      ? "flex min-w-0 flex-1 items-center justify-end max-sm:justify-stretch"
      : "flex shrink-0 items-center gap-2";

  return (
    <div id={id} className={joinClasses(rowClassName, className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
          {description ? <div className={descriptionClassName}>{description}</div> : null}
        </div>
      </div>
      <div className={controlClassName}>{control}</div>
    </div>
  );
}

export function SettingsValueRow({
  children,
  label,
  variant = "default",
}: {
  children: ReactNode;
  label: ReactNode;
  variant?: SettingsValueRowVariant;
}) {
  const rowClassName =
    variant === "compact"
      ? "h-[1.875rem] w-full grid-cols-[auto_minmax(0,1fr)] gap-x-6 overflow-x-hidden rounded-lg text-base leading-[18px] text-token-foreground electron:opacity-75"
      : "min-h-14 gap-1 px-4 py-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6";
  const labelClassName =
    variant === "compact"
      ? "flex items-center pr-2 pl-1 text-left"
      : "text-sm text-token-text-secondary";
  const valueClassName =
    variant === "compact"
      ? "flex items-center justify-end justify-self-stretch overflow-hidden"
      : "text-sm text-token-text-primary";

  return (
    <div className={joinClasses("grid items-center", rowClassName)}>
      <div className={joinClasses("min-w-0", labelClassName)}>{label}</div>
      <div className={joinClasses("min-w-0", valueClassName)}>{children}</div>
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
