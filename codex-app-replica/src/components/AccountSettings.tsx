import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { useI18n } from "../i18n/i18n";
import {
  clearBrowserChatGptTokenAuth,
  invalidateAccountSettingsQueries,
  logoutForHost,
  onAccountSettingsQueriesInvalidated,
  readAccountInfo,
  saveBrowserChatGptTokenAuth,
  type AccountInfoResponse,
  type AuthSnapshot,
} from "../services/auth";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";

type SaveState = "idle" | "saved";

export function AccountSettings({
  authSnapshot,
  onNavigateToLogin,
  onShowToast,
}: {
  authSnapshot: AuthSnapshot;
  onNavigateToLogin: () => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [accountInfo, setAccountInfo] = useState<AccountInfoResponse | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const usesChatGptAuth =
    authSnapshot.authState.authMethod === "chatgpt" ||
    authSnapshot.authState.authMethod === "chatgptAuthTokens";

  const loadAccountInfo = useEffectEvent(async () => {
    if (!usesChatGptAuth) {
      setAccountInfo(null);
      return;
    }

    try {
      setAccountInfo(await readAccountInfo());
    } catch {
      setAccountInfo(null);
    }
  });

  useEffect(() => {
    void loadAccountInfo();
  }, [loadAccountInfo, usesChatGptAuth, authSnapshot.activeLoginId, authSnapshot.authState.authMethod]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onAccountSettingsQueriesInvalidated(() => {
      if (!disposed) {
        void loadAccountInfo();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadAccountInfo]);

  const emailValue = accountInfo?.email ?? authSnapshot.authState.email;
  const accountIdValue = accountInfo?.accountId ?? authSnapshot.authState.accountId;
  const userIdValue = accountInfo?.userId ?? authSnapshot.authState.userId;
  const planValue = accountInfo?.plan ?? authSnapshot.authState.planAtLogin;
  const trimmedTokenDraft = tokenDraft.trim();

  const handleTokenSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmedTokenDraft.length === 0) {
      return;
    }

    try {
      saveBrowserChatGptTokenAuth({
        accessToken: tokenDraft,
      });
      setTokenDraft("");
      setTokenError(null);
      setSaveState("saved");
      await invalidateAccountSettingsQueries();
    } catch (error) {
      setSaveState("idle");
      setTokenError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSignOut = async () => {
    if (!usesChatGptAuth) {
      return;
    }

    try {
      await logoutForHost(LOCAL_SETTINGS_HOST_ID);
      clearBrowserChatGptTokenAuth();
      await invalidateAccountSettingsQueries();
      onNavigateToLogin();
    } catch (error) {
      onShowToast?.({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  return (
    <SettingsContentLayout
      title={<SettingsSectionTitle slug="account" />}
      subtitle={t("settings.account.subtitle")}
      subtitleClassName="text-pretty"
    >
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.account.current.title")} />
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsValueRow
              label={t("settings.account.authMethod")}
              value={usesChatGptAuth ? t("settings.account.authMethod.chatgptToken") : null}
            />
            <SettingsValueRow label={t("settings.account.email")} value={emailValue} />
            <SettingsValueRow label={t("settings.account.accountId")} value={accountIdValue} />
            <SettingsValueRow label={t("settings.account.userId")} value={userIdValue} />
            <SettingsValueRow label={t("settings.account.plan")} value={planValue} />
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header
          title={t("settings.account.token.title")}
          subtitle={t("settings.account.token.subtitle")}
        />
        <SettingsGroup.Content>
          <SettingsSurface>
            <form className="flex flex-col gap-3 p-4" onSubmit={handleTokenSubmit}>
              <label className="flex flex-col gap-2 text-sm font-medium text-token-text-primary">
                <span>{t("settings.account.token.inputLabel")}</span>
                <input
                  autoComplete="off"
                  className="h-9 rounded-md border border-token-input-border bg-token-input-background px-3 text-base text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
                  placeholder={t("settings.account.token.placeholder")}
                  spellCheck={false}
                  type="password"
                  value={tokenDraft}
                  onChange={(event) => {
                    setTokenDraft(event.target.value);
                    setTokenError(null);
                    setSaveState("idle");
                  }}
                />
              </label>

              {tokenError ? <div className="text-sm text-token-danger">{tokenError}</div> : null}
              {tokenError == null && saveState === "saved" ? (
                <div className="text-sm text-token-text-secondary">{t("settings.account.token.saved")}</div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  color="outline"
                  disabled={!usesChatGptAuth}
                  onClick={() => void handleSignOut()}
                >
                  {t("settings.account.signOut")}
                </Button>
                <Button type="submit" disabled={trimmedTokenDraft.length === 0}>
                  {t("settings.account.token.save")}
                </Button>
              </div>
            </form>
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function SettingsValueRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <SettingsValueShell label={label}>
      {value != null && value.length > 0 ? value : <UnavailableValue />}
    </SettingsValueShell>
  );
}

function SettingsValueShell({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="grid min-h-14 items-center gap-1 px-4 py-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
      <div className="min-w-0 text-sm text-token-text-secondary">{label}</div>
      <div className="min-w-0 text-sm text-token-text-primary">
        <div className="truncate">{children}</div>
      </div>
    </div>
  );
}

function UnavailableValue() {
  const { t } = useI18n();

  return <span className="text-token-text-tertiary">{t("settings.account.notAvailable")}</span>;
}
