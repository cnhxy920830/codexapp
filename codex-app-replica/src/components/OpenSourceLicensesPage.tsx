import { useEffect, useState, type ReactNode } from "react";
import { BackNavigationIcon } from "./AppShellIcons";
import { useI18n } from "../i18n/i18n";
import { peekThirdPartyNotices, readThirdPartyNotices } from "../services/settings";

export function OpenSourceLicensesPage({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(peekThirdPartyNotices()?.text ?? null);
  const [isLoading, setIsLoading] = useState(peekThirdPartyNotices() == null);

  useEffect(() => {
    let cancelled = false;

    if (peekThirdPartyNotices() != null) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);

    void readThirdPartyNotices()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setText(response.text);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setText(null);
        void error;
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsContentLayout
      backSlot={
        <ToolbarButton
          color="ghost"
          icon={<BackNavigationIcon className="icon-xs" />}
          label={t("settings.openSourceLicenses.back")}
          onClick={onBack}
        />
      }
      title={t("settings.openSourceLicenses.title")}
      subtitle={t("settings.openSourceLicenses.subtitle")}
    >
      <SettingsGroup>
        <SettingsGroupContent>
          <SettingsSurface>
            {isLoading ? (
              <div className="text-sm text-token-text-secondary">
                {t("settings.openSourceLicenses.loading")}
              </div>
            ) : text ? (
              <pre className="bg-token-surface-secondary rounded p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-token-text-primary">
                {text}
              </pre>
            ) : (
              <div className="text-sm text-token-text-secondary">
                {t("settings.openSourceLicenses.missing")}
              </div>
            )}
          </SettingsSurface>
        </SettingsGroupContent>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function SettingsContentLayout({
  backSlot,
  children,
  subtitle,
  title,
}: {
  backSlot?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="main-surface flex h-full min-h-0 flex-col">
      <div className="draggable flex h-toolbar items-center px-panel">
        {backSlot}
      </div>
      <div className="scrollbar-stable flex-1 overflow-y-auto p-panel">
        <div className="mx-auto flex w-full max-w-2xl min-w-[calc(320px*var(--codex-window-zoom))] flex-col">
          <div className="flex items-center justify-between gap-3 pb-panel">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-panel">
              <div className="heading-lg truncate text-token-text-primary">{title}</div>
              {subtitle ? (
                <div className="text-base text-token-text-secondary truncate">{subtitle}</div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-[var(--padding-panel)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupContent({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border"
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function ToolbarButton({
  color = "secondary",
  icon,
  label,
  onClick,
}: {
  color?: "ghost" | "secondary";
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition",
        color === "ghost"
          ? "text-token-text-secondary hover:bg-token-radio-active-foreground/5 hover:text-token-text-primary"
          : "border border-token-border bg-token-main-surface-primary text-token-text-primary hover:bg-token-list-hover-background",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
