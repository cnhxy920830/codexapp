import { useEffect, useState, type ReactNode } from "react";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { useI18n } from "../i18n/i18n";
import {
  clearBrowserChatGptTokenAuth,
  logoutForHost,
  onBrowserAuthChanged,
  readAccountInfo,
  readBrowserChatGptTokenAuth,
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
  const [browserTokenAuth, setBrowserTokenAuth] = useState(() => readBrowserChatGptTokenAuth());
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const usesChatGptAuth =
    authSnapshot.authState.authMethod === "chatgpt" ||
    authSnapshot.authState.authMethod === "chatgptAuthTokens" ||
    browserTokenAuth != null;

  useEffect(() => {
    return onBrowserAuthChanged(() => {
      setBrowserTokenAuth(readBrowserChatGptTokenAuth());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!usesChatGptAuth) {
      setAccountInfo(null);
      return () => {
        cancelled = true;
      };
    }

    void readAccountInfo()
      .then((nextAccountInfo) => {
        if (!cancelled) {
          setAccountInfo(nextAccountInfo);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountInfo(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    usesChatGptAuth,
    authSnapshot.activeLoginId,
    authSnapshot.authState.authMethod,
    authSnapshot.authState.email,
    authSnapshot.authState.planAtLogin,
    browserTokenAuth?.accessToken,
  ]);

  const emailValue = accountInfo?.email ?? browserTokenAuth?.email ?? authSnapshot.authState.email;
  const accountIdValue = accountInfo?.accountId ?? browserTokenAuth?.accountId ?? authSnapshot.authState.accountId;
  const userIdValue = accountInfo?.userId ?? browserTokenAuth?.userId ?? authSnapshot.authState.userId;
  const planValue = accountInfo?.plan ?? browserTokenAuth?.planType ?? authSnapshot.authState.planAtLogin;
  const trimmedTokenDraft = tokenDraft.trim();

  const handleTokenSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmedTokenDraft.length === 0 || isSavingToken) {
      return;
    }

    setIsSavingToken(true);
    try {
      const nextBrowserTokenAuth = saveBrowserChatGptTokenAuth({
        accessToken: tokenDraft,
      });
      setBrowserTokenAuth(nextBrowserTokenAuth);
      setTokenDraft("");
      setTokenError(null);
      setSaveState("saved");
      const nextAccountInfo = await readAccountInfo().catch(() => null);
      setAccountInfo(nextAccountInfo);
    } catch (error) {
      setSaveState("idle");
      setTokenError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleSignOut = async () => {
    if (!usesChatGptAuth || isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await logoutForHost(LOCAL_SETTINGS_HOST_ID);
      clearBrowserChatGptTokenAuth();
      setBrowserTokenAuth(null);
      setAccountInfo(null);
      onNavigateToLogin();
    } catch (error) {
      onShowToast?.({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SettingsContentLayout
      title={t("settings.section.account")}
      subtitle={t("settings.account.subtitle")}
      subtitleClassName="text-pretty"
    >
      <SettingsGroup>
        <SettingsGroupHeader title={t("settings.account.current.title")} />
        <SettingsGroupContent>
          <SettingsSurface>
            <SettingsRow label={t("settings.account.authMethod")}>
              {usesChatGptAuth ? t("settings.account.authMethod.chatgptToken") : <UnavailableValue />}
            </SettingsRow>
            <SettingsValueRow label={t("settings.account.email")} value={emailValue} />
            <SettingsValueRow label={t("settings.account.accountId")} value={accountIdValue} />
            <SettingsValueRow label={t("settings.account.userId")} value={userIdValue} />
            <SettingsValueRow label={t("settings.account.plan")} value={planValue} />
          </SettingsSurface>
        </SettingsGroupContent>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroupHeader
          title={t("settings.account.token.title")}
          subtitle={t("settings.account.token.subtitle")}
        />
        <SettingsGroupContent>
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
                  loading={isSigningOut}
                  onClick={() => void handleSignOut()}
                >
                  {t("settings.account.signOut")}
                </Button>
                <Button type="submit" disabled={trimmedTokenDraft.length === 0} loading={isSavingToken}>
                  {t("settings.account.token.save")}
                </Button>
              </div>
            </form>
          </SettingsSurface>
        </SettingsGroupContent>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupHeader({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="pb-3">
      <div className="text-base font-medium text-token-text-primary">{title}</div>
      {subtitle ? <div className="pt-1 text-sm text-token-text-secondary">{subtitle}</div> : null}
    </div>
  );
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({ children }: { children: ReactNode }) {
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

function SettingsRow({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 flex-1 text-sm text-token-text-primary">{label}</div>
      <div className="min-w-0 shrink-0 text-sm text-token-text-secondary max-sm:shrink">
        <div className="truncate">{children}</div>
      </div>
    </div>
  );
}

function SettingsValueRow({
  label,
  value,
}: {
  label: ReactNode;
  value: string | null;
}) {
  return <SettingsRow label={label}>{value != null && value.length > 0 ? value : <UnavailableValue />}</SettingsRow>;
}

function UnavailableValue() {
  const { t } = useI18n();

  return <span className="text-token-text-tertiary">{t("settings.account.notAvailable")}</span>;
}
