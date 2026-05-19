import type { ReactNode } from "react";

type SettingsRowVariant = "default" | "nested";

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

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
