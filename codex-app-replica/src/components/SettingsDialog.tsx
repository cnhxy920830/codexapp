import {
  type HTMLAttributes,
  type MouseEvent,
  useEffect,
  useId,
  type ReactNode,
} from "react";
import { CloseIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { useI18n } from "../i18n/i18n";

export function SettingsDialog({
  bodyClassName,
  children,
  contentClassName,
  contentProps,
  dialogCloseClassName,
  footer,
  headerAction,
  headerClassName,
  hideHeader = false,
  hideCloseButton = false,
  onOpenChange,
  onOpenAutoFocus,
  onEscapeKeyDown,
  open,
  shouldIgnoreClickOutside = false,
  size = "default",
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  footerClassName,
}: {
  bodyClassName?: string;
  children?: ReactNode;
  contentClassName?: string;
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "onClick">;
  dialogCloseClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  headerAction?: ReactNode;
  headerClassName?: string;
  hideHeader?: boolean;
  hideCloseButton?: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAutoFocus?: ((event: SettingsDialogOpenAutoFocusEvent) => void) | undefined;
  onEscapeKeyDown?: ((event: SettingsDialogEscapeKeyDownEvent) => void) | undefined;
  open: boolean;
  shouldIgnoreClickOutside?: boolean;
  size?: "compact" | "default";
  subtitle?: ReactNode;
  subtitleClassName?: string;
  title: ReactNode;
  titleClassName?: string;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const escapeEvent: SettingsDialogEscapeKeyDownEvent = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      onEscapeKeyDown?.(escapeEvent);
      if (escapeEvent.defaultPrevented) {
        event.preventDefault();
        return;
      }

      onOpenChange(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onEscapeKeyDown, onOpenChange, open]);

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
        aria-describedby={
          contentProps?.["aria-describedby"] ?? (subtitle || children ? descriptionId : undefined)
        }
        className={[
          "w-full max-w-[92vw] rounded-3xl border border-token-border bg-token-dropdown-background/90 text-token-foreground shadow-lg backdrop-blur-xl outline-none",
          size === "compact" ? "max-w-[420px]" : "max-w-[520px]",
          contentClassName ?? "",
        ].join(" ")}
        {...contentProps}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={[
            "flex flex-col gap-0 px-5 py-5 text-base leading-normal tracking-normal",
            bodyClassName ?? "",
          ].join(" ")}
        >
          {hideHeader ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <div
              className={[
                "flex items-start gap-3",
                headerClassName ?? "",
              ].join(" ")}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
                <h2
                  id={titleId}
                  className={[
                    "heading-dialog min-w-0 font-semibold",
                    titleClassName ?? "",
                  ].join(" ")}
                >
                  {title}
                </h2>
              </div>
              {headerAction ? (
                <div className="shrink-0">
                  {headerAction}
                </div>
              ) : null}
            </div>
          )}

          {subtitle ? (
            <div id={descriptionId} className="flex w-full flex-col pt-3 first:pt-0">
              <div
                className={[
                  "text-token-description-foreground",
                  subtitleClassName ?? "",
                ].join(" ")}
              >
                {subtitle}
              </div>
            </div>
          ) : children ? (
            <div id={descriptionId} className="flex w-full flex-col pt-3 first:pt-0">
              {children}
            </div>
          ) : null}

          {subtitle && children ? (
            <div className="flex w-full flex-col pt-3 first:pt-0">{children}</div>
          ) : null}

          {footer ? (
            <div
              className={[
                "flex w-full items-center justify-end gap-3 pt-3",
                footerClassName ?? "",
              ].join(" ")}
            >
              {footer}
            </div>
          ) : null}
        </div>
        {hideCloseButton ? null : (
          <button
            type="button"
            aria-label={t("codex.alert.closeAriaLabel")}
            className={[
              "no-drag absolute top-4 right-4 cursor-interaction rounded p-1 leading-none text-token-foreground/80 hover:bg-token-toolbar-hover-background focus:ring-1 focus:ring-token-focus-border focus:outline-none",
              dialogCloseClassName ?? "",
            ].join(" ")}
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

export type SettingsDialogEscapeKeyDownEvent = {
  defaultPrevented: boolean;
  preventDefault: () => void;
};
