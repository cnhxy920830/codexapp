import type { ReactNode } from "react";
import { CloseIcon } from "./AppShellIcons";
import { useI18n } from "../i18n/i18n";

type AlertLevel = "info" | "success" | "warning" | "danger";

export function Alert({
  children,
  className,
  fullWidth = false,
  icon: Icon,
  level = "info",
  onRemove,
  testId,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  icon?: ((props: { className?: string }) => ReactNode) | null;
  level?: AlertLevel;
  onRemove?: (() => void) | null;
  testId?: string;
}) {
  const { t } = useI18n();
  const rootClassName = [
    "alert-root inline-flex flex-row items-start gap-1.5 rounded-2xl px-2 py-2 text-base leading-[1.4] pointer-events-auto box-shadow-lg border text-token-foreground",
    fullWidth ? "flex" : null,
    level === "info" ? "border-token-border bg-token-dropdown-background" : null,
    level === "success" ? "border-token-border bg-token-input-validation-info-background" : null,
    level === "warning"
      ? "border-token-input-validation-warning-border bg-token-input-validation-warning-background"
      : null,
    level === "danger"
      ? "border-token-input-validation-error-border bg-token-input-validation-error-background"
      : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} role="alert" data-testid={testId}>
      {Icon ? (
        <div className="shrink-0 grow-0">
          <Icon className="icon-sm" />
        </div>
      ) : null}
      <div className="flex-1 justify-center gap-2">
        {typeof children === "string" ? <div className="font-medium">{children}</div> : children}
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label={t("codex.alert.closeAriaLabel")}
          className="mt-0.5 flex shrink-0 grow-0 cursor-interaction rounded-full opacity-50 hover:bg-token-button-secondary-hover-background/5 hover:opacity-80"
          onClick={onRemove}
        >
          <CloseIcon className="icon-xs" />
        </button>
      ) : null}
    </div>
  );
}
