import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsValueRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { useI18n } from "../i18n/i18n";
import {
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
}: {
  authSnapshot: AuthSnapshot;
  onNavigateToLogin: () => void;
}) {
  const { t } = useI18n();
  const [accountInfo, setAccountInfo] = useState<AccountInfoResponse | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [localAuthMethod, setLocalAuthMethod] = useState<string | null>(null);

  const authMethod = localAuthMethod ?? authSnapshot.authState.authMethod;
  const usesChatGptAuth = authMethod === "chatgpt" || authMethod === "chatgptAuthTokens";

  useEffect(() => {
    if (localAuthMethod != null && authSnapshot.authState.authMethod != null) {
      setLocalAuthMethod(null);
    }
  }, [localAuthMethod, authSnapshot.authState.authMethod]);

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
  }, [usesChatGptAuth, authSnapshot.activeLoginId, authSnapshot.authState.authMethod]);

  useEffect(() => {
    const handleFocus = () => {
      void loadAccountInfo();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAccountInfo]);

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
  }, []);

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
      setLocalAuthMethod("chatgpt");
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

    await logoutForHost(LOCAL_SETTINGS_HOST_ID);
    await invalidateAccountSettingsQueries();
    onNavigateToLogin();
  };

  return (
    <SettingsContentLayout
      title={<SettingsSectionTitle slug="account" />}
      subtitle={t("settings.account.subtitle")}
    >
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.account.current.title")} />
        <SettingsGroup.Content>
          <SettingsSurface>
            <AccountValueRow
              label={t("settings.account.authMethod")}
              value={usesChatGptAuth ? t("settings.account.authMethod.chatgptToken") : null}
            />
            <AccountValueRow label={t("settings.account.email")} value={emailValue} />
            <AccountValueRow label={t("settings.account.accountId")} value={accountIdValue} />
            <AccountValueRow label={t("settings.account.userId")} value={userIdValue} />
            <AccountValueRow label={t("settings.account.plan")} value={planValue} />
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

function AccountValueRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <SettingsValueRow label={label}>
      {value != null && value.length > 0 ? <span className="truncate">{value}</span> : <UnavailableValue />}
    </SettingsValueRow>
  );
}

function UnavailableValue() {
  const { t } = useI18n();

  return <span className="text-token-text-tertiary">{t("settings.account.notAvailable")}</span>;
}
