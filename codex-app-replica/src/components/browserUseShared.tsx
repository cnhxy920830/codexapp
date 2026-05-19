import type { ReactNode } from "react";
import { NewChatIcon, TrashIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSurface } from "./SettingsSurface";
import { Spinner } from "./Spinner";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";

export function BrowserUseOriginSection({
  emptyTitleKey,
  isDisabled,
  isLoading,
  onRequestAdd,
  onRequestRemove,
  origins,
  subtitleKey,
  titleKey,
}: {
  emptyTitleKey: MessageKey;
  isDisabled: boolean;
  isLoading: boolean;
  onRequestAdd: () => void;
  onRequestRemove: (origin: string) => void;
  origins: string[];
  subtitleKey: MessageKey;
  titleKey: MessageKey;
}) {
  const { t } = useI18n();

  return (
    <SettingsGroup>
      <SettingsGroup.Header
        actions={
          <Button color="secondary" disabled={isDisabled} size="toolbar" onClick={onRequestAdd}>
            <NewChatIcon className="icon-xs" />
            {t("settings.browserUse.domains.add")}
          </Button>
        }
        subtitle={t(subtitleKey)}
        title={t(titleKey)}
      />
      <SettingsGroup.Content>
        <SettingsSurface>
          {isLoading ? (
            <BrowserUseLoadingStateRow />
          ) : origins.length === 0 ? (
            <SettingsRow
              className="justify-center"
              control={null}
              label={<span className="text-token-text-secondary">{t(emptyTitleKey)}</span>}
            />
          ) : (
            origins.map((origin) => (
              <SettingsRow
                key={`${titleKey}:${origin}`}
                control={
                  <Button
                    aria-label={t("settings.browserUse.origins.removeAriaLabel", { origin })}
                    color="ghost"
                    disabled={isDisabled}
                    size="icon"
                    uniform
                    onClick={() => onRequestRemove(origin)}
                  >
                    <TrashIcon className="icon-2xs" />
                  </Button>
                }
                label={<span className="font-medium">{origin}</span>}
              />
            ))
          )}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

export function BrowserUseDialog({
  children,
  confirmLabel,
  confirmTone,
  disableConfirm,
  footer,
  onClose,
  onConfirm,
  subtitle,
  title,
}: {
  children?: ReactNode;
  confirmLabel?: string;
  confirmTone?: "danger";
  disableConfirm?: boolean;
  footer?: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  subtitle: ReactNode;
  title: ReactNode;
}) {
  return (
    <DialogOverlay onDismiss={onClose}>
      <div
        aria-modal="true"
        role="dialog"
        className="w-full max-w-[420px] rounded-[18px] border border-token-border bg-token-main-surface-primary px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm?.();
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-medium text-token-text-primary">{title}</div>
            <div className="text-sm text-token-text-secondary">{subtitle}</div>
          </div>
          {children}
          <div className="flex items-center justify-end gap-2">
            {footer ?? (
              <>
                <Button color="ghost" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  color={confirmTone === "danger" ? "danger" : "primary"}
                  disabled={disableConfirm}
                  type="submit"
                >
                  {confirmLabel}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}

export function BrowserUseLoadingStateRow({
  message,
}: {
  message?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 p-4 text-sm text-token-text-secondary">
      <Spinner className="icon-xs" />
      {message ?? t("settings.browserUse.origins.loading")}
    </div>
  );
}

export function BrowserUseMessageStateRow({
  message,
}: {
  message: ReactNode;
}) {
  return <div className="p-4 text-sm text-token-text-secondary">{message}</div>;
}

export function renderInlineTagButton(
  template: string,
  tagName: string,
  onClick: () => void,
  className: string,
) {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const label = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <>
      {prefix}
      <button type="button" className={className} onClick={onClick}>
        {label}
      </button>
      {suffix}
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
