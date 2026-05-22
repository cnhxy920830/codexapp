import { type MouseEvent, useId, type ReactNode } from "react";
import { CloseIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { useI18n } from "../i18n/i18n";

export function SettingsDialog({
  children,
  contentClassName,
  footer,
  hideCloseButton = false,
  onOpenChange,
  onOpenAutoFocus,
  open,
  shouldIgnoreClickOutside = false,
  size = "default",
  title,
  subtitle,
}: {
  children?: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  hideCloseButton?: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAutoFocus?: ((event: SettingsDialogOpenAutoFocusEvent) => void) | undefined;
  open: boolean;
  shouldIgnoreClickOutside?: boolean;
  size?: "compact" | "default";
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  const openAutoFocusEvent: SettingsDialogOpenAutoFocusEvent = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  onOpenAutoFocus?.(openAutoFocusEvent);

  return (
    <DialogOverlay
      onDismiss={() => onOpenChange(false)}
      shouldIgnoreClickOutside={shouldIgnoreClickOutside}
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={subtitle || children ? descriptionId : undefined}
        className={[
          "w-full max-w-[92vw] rounded-3xl border border-token-border bg-token-dropdown-background/90 text-token-foreground shadow-lg backdrop-blur-xl outline-none",
          size === "compact" ? "max-w-[420px]" : "max-w-[520px]",
          contentClassName ?? "",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-0 px-5 py-5 text-base leading-normal tracking-normal">
          <div className="flex flex-col items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
              <h2 id={titleId} className="heading-dialog min-w-0 font-semibold">
                {title}
              </h2>
            </div>
          </div>

          {subtitle ? (
            <div id={descriptionId} className="flex w-full flex-col pt-3 first:pt-0">
              <div className="text-token-description-foreground">{subtitle}</div>
            </div>
          ) : children ? (
            <div id={descriptionId} className="flex w-full flex-col pt-3 first:pt-0">
              {children}
            </div>
          ) : null}

          {subtitle && children ? (
            <div className="flex w-full flex-col pt-3 first:pt-0">{children}</div>
          ) : null}

          {footer ? <div className="flex w-full items-center justify-end gap-3 pt-3">{footer}</div> : null}
        </div>
        {hideCloseButton ? null : (
          <button
            type="button"
            aria-label={t("codex.alert.closeAriaLabel")}
            className="no-drag absolute top-4 right-4 cursor-interaction rounded p-1 leading-none text-token-foreground/80 hover:bg-token-toolbar-hover-background focus:ring-1 focus:ring-token-focus-border focus:outline-none"
            onClick={(event) => {
              event.stopPropagation();
              onOpenChange(false);
            }}
          >
            <CloseIcon className="icon-xs" />
          </button>
        )}
      </div>
    </DialogOverlay>
  );
}

export function SettingsDialogFooter({
  cancelLabel,
  confirmLabel,
  confirmTone,
  confirmDisabled,
  confirmLoading,
  onCancel,
  onConfirm,
}: {
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  confirmTone?: "danger" | "primary";
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <Button color="ghost" disabled={confirmLoading} onClick={onCancel} size="toolbar">
        {cancelLabel}
      </Button>
      <Button
        color={confirmTone === "danger" ? "danger" : "primary"}
        disabled={confirmDisabled}
        loading={confirmLoading}
        onClick={onConfirm}
        size="toolbar"
      >
        {confirmLabel}
      </Button>
    </>
  );
}

function DialogOverlay({
  children,
  onDismiss,
  shouldIgnoreClickOutside,
}: {
  children: ReactNode;
  onDismiss: () => void;
  shouldIgnoreClickOutside?: boolean;
}) {
  return (
    <div
      className="codex-dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        if (shouldIgnoreClickOutside) {
          event.preventDefault();
          return;
        }
        onDismiss();
      }}
    >
      {children}
    </div>
  );
}

export type SettingsDialogOpenAutoFocusEvent = {
  defaultPrevented: boolean;
  preventDefault: () => void;
};
