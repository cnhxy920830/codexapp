import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n/i18n";

const codexAppGaLogo = new URL("../../assets/codex-app-ga-logo--UgmJjKM.png", import.meta.url).href;

export type LoginRouteViewProps = {
  apiKeyValue: string;
  isApiKeyEntryVisible: boolean;
  isApiKeySignInPending: boolean;
  isBrowserSignInPending: boolean;
  isSnakeVisible: boolean;
  onApiKeyCancel: () => void;
  onApiKeySubmit: () => void;
  onApiKeyValueChange: (value: string) => void;
  onCancelSignIn: () => void;
  onChatGptSignIn: () => void;
  onGoogleSignIn?: () => void;
  onMicrosoftSignIn?: () => void;
  onPlaySnake: () => void;
  onShowApiKeyEntry: () => void;
  onSignUp: () => void;
  snakeGame?: ReactNode;
};

export function LoginRouteView({
  apiKeyValue,
  isApiKeyEntryVisible,
  isApiKeySignInPending,
  isBrowserSignInPending,
  isSnakeVisible,
  onApiKeyCancel,
  onApiKeySubmit,
  onApiKeyValueChange,
  onCancelSignIn,
  onChatGptSignIn,
  onGoogleSignIn,
  onMicrosoftSignIn,
  onPlaySnake,
  onShowApiKeyEntry,
  onSignUp,
  snakeGame = null,
}: LoginRouteViewProps) {
  const { t } = useI18n();

  if (isSnakeVisible) {
    return <main className="h-full w-full overflow-hidden">{snakeGame}</main>;
  }

  if (isBrowserSignInPending) {
    return (
      <main className="flex h-full w-full items-center justify-center overflow-hidden bg-token-main-surface-primary pb-12 text-token-foreground">
        <div className="flex w-[340px] flex-col items-center gap-8">
          <img alt="" aria-hidden="true" className="size-[52px] shrink-0" draggable={false} src={codexAppGaLogo} />
          <p className="text-center text-[14px] leading-5 font-normal tracking-[-0.18px] text-token-description-foreground">
            {t("electron.onboarding.login.browserPending.welcomeV2")}
          </p>
          <button
            className="flex h-[42px] w-full cursor-interaction items-center justify-center rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-description-foreground hover:bg-token-list-hover-background"
            type="button"
            onClick={onCancelSignIn}
          >
            {t("electron.onboarding.login.chatgpt.cancel.welcomeV2")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full w-full items-center justify-center overflow-hidden bg-token-main-surface-primary pb-6 text-token-foreground">
      <div className="flex w-[340px] flex-col items-center gap-8">
        <div className="flex w-full flex-col items-center gap-8">
          <button
            aria-label={t("electron.onboarding.login.snake.start")}
            className="group flex cursor-interaction items-center justify-center rounded-full"
            type="button"
            onClick={onPlaySnake}
          >
            <img alt="" aria-hidden="true" className="size-[52px] shrink-0" draggable={false} src={codexAppGaLogo} />
          </button>
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <h1 className="w-[316px] text-[28px] leading-9 font-normal text-token-foreground">
              {t("electron.onboarding.login.welcomeV2.title")}
            </h1>
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#4452ff]/[0.08] py-1 pr-3 pl-2.5 text-[13px] leading-5 font-normal tracking-[-0.078px] text-[#4452ff] dark:bg-[#4452ff]/25 dark:text-[#7882ff]">
              <svg
                aria-hidden="true"
                className="size-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t("electron.onboarding.login.includedPlans.welcomeV2")}
            </span>
          </div>
        </div>
        {isApiKeyEntryVisible ? (
          <ApiKeyEntry
            apiKeyValue={apiKeyValue}
            isApiKeySignInPending={isApiKeySignInPending}
            onCancel={onApiKeyCancel}
            onSubmit={onApiKeySubmit}
            onValueChange={onApiKeyValueChange}
          />
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <Button
              className="h-[48px] w-full justify-center gap-2 rounded-full text-[14px] leading-5 font-medium"
              color="primary"
              onClick={onChatGptSignIn}
              size="large"
            >
              {t("electron.onboarding.login.chatgpt.signIn")}
            </Button>
            {onGoogleSignIn ? (
              <button
                aria-label={t("electron.onboarding.login.google.signIn")}
                className="flex h-[46px] w-full cursor-interaction items-center justify-center gap-2 rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-foreground hover:bg-token-list-hover-background"
                type="button"
                onClick={onGoogleSignIn}
              >
                <GoogleProviderIcon className="size-5 shrink-0" />
                {t("electron.onboarding.login.google.signIn")}
              </button>
            ) : null}
            {onMicrosoftSignIn ? (
              <button
                aria-label={t("electron.onboarding.login.microsoft.signIn")}
                className="flex h-[46px] w-full cursor-interaction items-center justify-center gap-2 rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-foreground hover:bg-token-list-hover-background"
                type="button"
                onClick={onMicrosoftSignIn}
              >
                <MicrosoftProviderIcon className="size-5 shrink-0" />
                {t("electron.onboarding.login.microsoft.signIn")}
              </button>
            ) : null}
            <Button
              className="h-[46px] w-full justify-center rounded-full text-[14px] leading-5 font-medium"
              color="outline"
              onClick={onShowApiKeyEntry}
              size="large"
            >
              {t("electron.onboarding.login.apikey.open.welcomeV2")}
            </Button>
            <button
              className="flex h-9 cursor-interaction items-center justify-center px-2 text-[14px] leading-5 font-medium text-token-description-foreground underline hover:text-token-foreground"
              type="button"
              onClick={onSignUp}
            >
              {t("electron.onboarding.login.signup.welcomeV2")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function GoogleProviderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftProviderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  );
}

function ApiKeyEntry({
  apiKeyValue,
  isApiKeySignInPending,
  onCancel,
  onSubmit,
  onValueChange,
}: {
  apiKeyValue: string;
  isApiKeySignInPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col gap-3">
      <label className="text-base font-medium text-token-foreground">
        {t("electron.onboarding.login.apikey.label")}
        <input
          autoFocus
          className="mt-2 w-full rounded-xl border border-token-border bg-token-input-background px-4 py-2.5 focus:ring-2 focus:ring-black/15 focus:outline-none"
          placeholder={t("electron.onboarding.login.apikey.placeholder")}
          value={apiKeyValue}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button className="flex flex-1 justify-center py-2" color="secondary" onClick={onCancel} size="large">
          {t("electron.onboarding.login.apikey.cancel")}
        </Button>
        <Button
          className="flex flex-1 justify-center py-2"
          disabled={apiKeyValue.trim().length === 0 || isApiKeySignInPending}
          loading={isApiKeySignInPending}
          onClick={onSubmit}
          size="large"
        >
          {t("electron.onboarding.login.apikey.continue")}
        </Button>
      </div>
    </div>
  );
}
