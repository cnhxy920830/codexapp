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
