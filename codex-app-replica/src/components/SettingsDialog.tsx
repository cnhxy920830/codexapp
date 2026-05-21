import type { ReactNode } from "react";
import { Button } from "./Button";

export function SettingsDialog({
  children,
  footer,
  onOpenChange,
  open,
  size = "default",
  title,
  subtitle,
}: {
  children?: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: "compact" | "default";
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <DialogOverlay onDismiss={() => onOpenChange(false)}>
      <div
        aria-modal="true"
        role="dialog"
        className={[
          "w-full rounded-[18px] border border-token-border bg-token-main-surface-primary shadow-[0_16px_40px_rgba(0,0,0,0.22)]",
          size === "compact" ? "max-w-[420px] px-5 py-5" : "max-w-[560px] px-5 py-4",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-medium text-token-text-primary">{title}</div>
            {subtitle ? (
              <div className="text-sm text-token-text-secondary">{subtitle}</div>
            ) : null}
          </div>
          {children}
          {footer ? <div className="flex items-center justify-end gap-2">{footer}</div> : null}
        </div>
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
      <Button color="ghost" disabled={confirmLoading} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        color={confirmTone === "danger" ? "danger" : "primary"}
        disabled={confirmDisabled}
        loading={confirmLoading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </>
  );
}

function DialogOverlay({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={onDismiss}
    >
      {children}
    </div>
  );
}
