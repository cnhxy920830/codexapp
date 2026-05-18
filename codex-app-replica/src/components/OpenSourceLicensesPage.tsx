import { useEffect, useState } from "react";
import { BackNavigationIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSurface } from "./SettingsSurface";
import { useI18n } from "../i18n/i18n";
import { peekThirdPartyNotices, readThirdPartyNotices } from "../services/settings";

export function OpenSourceLicensesPage({
  licensesBackPath = null,
  onNavigateBack,
}: {
  licensesBackPath?: string | null;
  onNavigateBack: (backPath: string) => void;
}) {
  const initialNotices = peekThirdPartyNotices();
  const [text, setText] = useState<string | null>(initialNotices?.text ?? null);
  const [isLoading, setIsLoading] = useState(initialNotices == null);

  useEffect(() => {
    let cancelled = false;
    const cachedNotices = peekThirdPartyNotices();

    if (cachedNotices != null) {
      setText(cachedNotices.text);
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
    <OpenSourceLicensesPageView
      backPath={resolveOpenSourceLicensesBackPath(licensesBackPath)}
      isLoading={isLoading}
      onNavigateBack={onNavigateBack}
      text={text}
    />
  );
}

export function OpenSourceLicensesPageView({
  backPath,
  isLoading,
  onNavigateBack,
  text,
}: {
  backPath: string;
  isLoading: boolean;
  onNavigateBack: (backPath: string) => void;
  text: string | null;
}) {
  const { t } = useI18n();

  return (
    <SettingsContentLayout
      backSlot={
        <Button
          color="ghost"
          onClick={() => {
            onNavigateBack(backPath);
          }}
          size="toolbar"
        >
          <BackNavigationIcon className="icon-xs" />
          {t("settings.openSourceLicenses.back")}
        </Button>
      }
      title={t("settings.openSourceLicenses.title")}
      subtitle={t("settings.openSourceLicenses.subtitle")}
    >
      <SettingsGroup>
        <SettingsGroup.Content>
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
        </SettingsGroup.Content>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

export function resolveOpenSourceLicensesBackPath(
  licensesBackPath: string | null | undefined,
) {
  if (
    typeof licensesBackPath === "string" &&
    licensesBackPath.startsWith("/settings/")
  ) {
    return licensesBackPath;
  }

  return "/settings/general";
}
