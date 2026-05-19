import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n/i18n";
import { OpenAiBlossomIcon } from "./OpenAiBlossomIcon";
import { LoginRouteHelloLogo } from "./LoginRouteHelloLogo";

const codexAppGaLogo = new URL(
  "../../assets/codex-app-ga-logo--UgmJjKM.png",
  import.meta.url,
).href;

export type LoginRouteShellVariant = "welcomeV1" | "welcomeV2";

export type LoginRouteViewProps = {
  apiKeyValue: string;
  isApiKeyEntryVisible: boolean;
  isApiKeySignInPending: boolean;
  isBrowserSignInPending: boolean;
  isSnakeVisible: boolean;
  shellVariant: LoginRouteShellVariant;
  showChatGptProviderSignIn: boolean;
  useStreamlinedCopy: boolean;
  onApiKeyCancel: () => void;
  onApiKeySubmit: () => void;
  onApiKeyValueChange: (value: string) => void;
  onCancelSignIn: () => void;
  onChatGptSignIn: () => void;
  onGoogleSignIn: () => void;
  onMicrosoftSignIn: () => void;
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
  shellVariant,
  showChatGptProviderSignIn,
  useStreamlinedCopy,
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
  if (shellVariant === "welcomeV2") {
    return (
      <OnboardingShell fullBleed hideHeader={isSnakeVisible}>
        {isSnakeVisible ? (
          <div className="flex h-full w-full">{snakeGame}</div>
        ) : (
          <WelcomeV2Shell
            apiKeyValue={apiKeyValue}
            isApiKeyEntryVisible={isApiKeyEntryVisible}
            isApiKeySignInPending={isApiKeySignInPending}
            isBrowserSignInPending={isBrowserSignInPending}
            showChatGptProviderSignIn={showChatGptProviderSignIn}
            useStreamlinedCopy={useStreamlinedCopy}
            onApiKeyCancel={onApiKeyCancel}
            onApiKeySubmit={onApiKeySubmit}
            onApiKeyValueChange={onApiKeyValueChange}
            onCancelSignIn={onCancelSignIn}
            onChatGptSignIn={onChatGptSignIn}
            onGoogleSignIn={onGoogleSignIn}
            onMicrosoftSignIn={onMicrosoftSignIn}
            onPlaySnake={onPlaySnake}
            onShowApiKeyEntry={onShowApiKeyEntry}
            onSignUp={onSignUp}
          />
        )}
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell fullBleed={isSnakeVisible} hideHeader={isSnakeVisible}>
      {isSnakeVisible ? (
        <div className="flex h-full w-full">{snakeGame}</div>
      ) : (
        <WelcomeV1Shell
          apiKeyValue={apiKeyValue}
          isApiKeyEntryVisible={isApiKeyEntryVisible}
          isApiKeySignInPending={isApiKeySignInPending}
          isBrowserSignInPending={isBrowserSignInPending}
          onApiKeyCancel={onApiKeyCancel}
          onApiKeySubmit={onApiKeySubmit}
          onApiKeyValueChange={onApiKeyValueChange}
          onCancelSignIn={onCancelSignIn}
          onChatGptSignIn={onChatGptSignIn}
          onPlaySnake={onPlaySnake}
          onShowApiKeyEntry={onShowApiKeyEntry}
        />
      )}
    </OnboardingShell>
  );
}

function WelcomeV2Shell({
  apiKeyValue,
  isApiKeyEntryVisible,
  isApiKeySignInPending,
  isBrowserSignInPending,
  showChatGptProviderSignIn,
  useStreamlinedCopy,
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
}: Omit<LoginRouteViewProps, "shellVariant" | "isSnakeVisible" | "snakeGame">) {
  const { t } = useI18n();

  if (isBrowserSignInPending && !isApiKeyEntryVisible) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-token-main-surface-primary pb-12 text-token-foreground">
        <div className="flex w-[340px] flex-col items-center gap-8">
          <img
            alt=""
            aria-hidden="true"
            className="size-[52px] shrink-0"
            draggable={false}
            src={codexAppGaLogo}
          />
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
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-token-main-surface-primary pb-6 text-token-foreground">
      <div className="flex w-[340px] flex-col items-center gap-8">
        <div className="flex w-full flex-col items-center gap-8">
          <button
            aria-label={t("electron.onboarding.login.snake.start")}
            className="group flex cursor-interaction items-center justify-center rounded-full"
            type="button"
            onClick={onPlaySnake}
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-[52px] shrink-0"
              draggable={false}
              src={codexAppGaLogo}
            />
          </button>
          <div className="flex w-full flex-col items-center text-center">
            <h1 className="w-[316px] text-[28px] leading-9 font-normal text-token-foreground">
              {useStreamlinedCopy
                ? t("electron.onboarding.login.welcomeV2.title.streamlined")
                : t("electron.onboarding.login.welcomeV2.title")}
            </h1>
            {useStreamlinedCopy ? (
              <span className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-[#4452ff]/[0.08] py-1 pr-3 pl-2.5 text-[13px] leading-5 font-normal tracking-[-0.078px] text-[#4452ff] dark:bg-[#4452ff]/25 dark:text-[#7882ff]">
                <CheckBadgeIcon className="size-3.5 shrink-0" />
                {t("electron.onboarding.login.includedPlans.welcomeV2")}
              </span>
            ) : null}
          </div>
        </div>
        {isApiKeyEntryVisible ? (
          <div className="w-full">
            <ApiKeyEntryContent
              apiKeyValue={apiKeyValue}
              isApiKeyEntryVisible={isApiKeyEntryVisible}
              isApiKeySignInPending={isApiKeySignInPending}
              isBrowserSignInPending={isBrowserSignInPending}
              onApiKeySecondaryAction={onApiKeyCancel}
              onApiKeySubmit={onApiKeySubmit}
              onApiKeyValueChange={onApiKeyValueChange}
              onChatGptSignIn={onChatGptSignIn}
              onShowApiKeyEntry={onShowApiKeyEntry}
              apiKeySecondaryActionLabel={t(
                "electron.onboarding.login.apikey.cancel",
              )}
            />
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <button
              className="flex h-[48px] w-full cursor-interaction items-center justify-center gap-2 rounded-full border border-transparent bg-token-foreground text-[14px] leading-5 font-medium text-token-dropdown-background hover:bg-token-foreground/80"
              type="button"
              onClick={onChatGptSignIn}
            >
              <OpenAiBlossomIcon
                aria-hidden="true"
                className="size-6 shrink-0 text-token-dropdown-background"
              />
              {useStreamlinedCopy
                ? t("electron.onboarding.login.chatgpt.signIn.streamlined")
                : t("electron.onboarding.login.chatgpt.signIn")}
            </button>
            {showChatGptProviderSignIn ? (
              <>
                <button
                  className="flex h-[46px] w-full cursor-interaction items-center justify-center gap-2 rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-foreground hover:bg-token-list-hover-background"
                  type="button"
                  onClick={onGoogleSignIn}
                >
                  <GoogleProviderIcon className="size-5 shrink-0" />
                  {t("electron.onboarding.login.google.signIn")}
                </button>
                <button
                  className="flex h-[46px] w-full cursor-interaction items-center justify-center gap-2 rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-foreground hover:bg-token-list-hover-background"
                  type="button"
                  onClick={onMicrosoftSignIn}
                >
                  <MicrosoftProviderIcon className="size-5 shrink-0" />
                  {t("electron.onboarding.login.microsoft.signIn")}
                </button>
              </>
            ) : null}
            <button
              className="flex h-[46px] w-full cursor-interaction items-center justify-center rounded-full border border-token-border bg-token-main-surface-primary text-[14px] leading-5 font-medium text-token-foreground hover:bg-token-list-hover-background"
              type="button"
              onClick={onShowApiKeyEntry}
            >
              {t("electron.onboarding.login.apikey.open.welcomeV2")}
            </button>
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
    </div>
  );
}

function WelcomeV1Shell({
  apiKeyValue,
  isApiKeyEntryVisible,
  isApiKeySignInPending,
  isBrowserSignInPending,
  onApiKeyCancel,
  onApiKeySubmit,
  onApiKeyValueChange,
  onCancelSignIn,
  onChatGptSignIn,
  onPlaySnake,
  onShowApiKeyEntry,
}: Pick<
  LoginRouteViewProps,
  | "apiKeyValue"
  | "isApiKeyEntryVisible"
  | "isApiKeySignInPending"
  | "isBrowserSignInPending"
  | "onApiKeyCancel"
  | "onApiKeySubmit"
  | "onApiKeyValueChange"
  | "onCancelSignIn"
  | "onChatGptSignIn"
  | "onPlaySnake"
  | "onShowApiKeyEntry"
>) {
  const { t } = useI18n();

  return (
    <div className="mt-32 flex h-full w-full max-w-[320px] flex-col items-center">
      <button
        aria-label={t("electron.onboarding.login.snake.start")}
        className="group flex cursor-interaction items-center justify-center rounded-full p-2"
        type="button"
        onClick={onPlaySnake}
      >
        <LoginRouteHelloLogo className="size-12 text-token-foreground" />
      </button>
      <span className="mt-4 text-center text-heading-lg font-medium text-token-foreground">
        {t("electron.onboarding.login.title")}
      </span>
      <span className="mt-1 text-center text-lg text-token-description-foreground">
        {t("electron.onboarding.login.subtitle")}
      </span>
      <div className="mt-8 flex w-full flex-col items-center">
        <ApiKeyEntryContent
          apiKeyValue={apiKeyValue}
          isApiKeyEntryVisible={isApiKeyEntryVisible}
          isApiKeySignInPending={isApiKeySignInPending}
          isBrowserSignInPending={isBrowserSignInPending}
          onApiKeySecondaryAction={onApiKeyCancel}
          onApiKeySubmit={onApiKeySubmit}
          onApiKeyValueChange={onApiKeyValueChange}
          onChatGptSignIn={
            isBrowserSignInPending ? onCancelSignIn : onChatGptSignIn
          }
          onShowApiKeyEntry={onShowApiKeyEntry}
          apiKeySecondaryActionLabel={t(
            "electron.onboarding.login.apikey.cancel",
          )}
        />
      </div>
    </div>
  );
}

function ApiKeyEntryContent({
  apiKeyValue,
  isApiKeyEntryVisible,
  isApiKeySignInPending,
  isBrowserSignInPending,
  onApiKeySecondaryAction,
  onApiKeySubmit,
  onApiKeyValueChange,
  onChatGptSignIn,
  onShowApiKeyEntry,
  apiKeySecondaryActionLabel,
}: {
  apiKeyValue: string;
  isApiKeyEntryVisible: boolean;
  isApiKeySignInPending: boolean;
  isBrowserSignInPending: boolean;
  onApiKeySecondaryAction: () => void;
  onApiKeySubmit: () => void;
  onApiKeyValueChange: (value: string) => void;
  onChatGptSignIn: () => void;
  onShowApiKeyEntry: () => void;
  apiKeySecondaryActionLabel: string;
}) {
  const { t } = useI18n();

  if (isApiKeyEntryVisible) {
    return (
      <div className="flex w-full flex-col gap-3">
        <label className="text-base font-medium text-token-foreground">
          {t("electron.onboarding.login.apikey.label")}
          <input
            autoFocus
            className="mt-2 w-full rounded-xl border border-token-border bg-token-input-background px-4 py-2.5 focus:ring-2 focus:ring-black/15 focus:outline-none"
            placeholder={t("electron.onboarding.login.apikey.placeholder")}
            value={apiKeyValue}
            onChange={(event) => onApiKeyValueChange(event.target.value)}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button
            className="flex flex-1 justify-center py-2"
            color="secondary"
            onClick={onApiKeySecondaryAction}
          >
            {apiKeySecondaryActionLabel}
          </Button>
          <Button
            className="flex flex-1 justify-center py-2"
            disabled={apiKeyValue.trim().length === 0 || isApiKeySignInPending}
            loading={isApiKeySignInPending}
            onClick={onApiKeySubmit}
          >
            {t("electron.onboarding.login.apikey.continue")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[200px] flex-col gap-3">
      <Button
        className="w-full justify-center py-2.5"
        color="primary"
        onClick={onChatGptSignIn}
      >
        {isBrowserSignInPending
          ? t("electron.onboarding.login.chatgpt.cancel")
          : t("electron.onboarding.login.chatgpt.continue")}
      </Button>
      {!isBrowserSignInPending ? (
        <Button
          className="w-full justify-center py-2.5"
          color="outline"
          onClick={onShowApiKeyEntry}
        >
          {t("electron.onboarding.login.apikey.open")}
        </Button>
      ) : null}
    </div>
  );
}

function OnboardingShell({
  children,
  fullBleed = false,
  hideHeader = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
  hideHeader?: boolean;
}) {
  const showToolbarInset = !hideHeader && detectPlatform() !== "windows";

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <div className="absolute inset-0 bg-token-bg-primary electron:bg-transparent" />
      {showToolbarInset ? (
        <div className="draggable fixed inset-x-0 top-0 z-10 h-toolbar-sm select-none" />
      ) : null}
      <div
        className={
          fullBleed
            ? "fixed inset-0"
            : [
                "fixed inset-x-0 bottom-0 flex items-center justify-center px-6 pb-8",
                showToolbarInset ? "top-[var(--height-toolbar-sm)] pt-2" : "top-0 pt-8",
              ].join(" ")
        }
      >
        {children}
      </div>
    </div>
  );
}

function detectPlatform() {
  if (typeof navigator === "undefined") {
    return "windows";
  }

  const platform = navigator.userAgent || navigator.platform || "";
  if (/mac/i.test(platform)) {
    return "mac";
  }
  if (/linux/i.test(platform)) {
    return "linux";
  }
  return "windows";
}

function GoogleProviderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
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
      <path d="M3.25 3.25H11.25V11.25H3.25V3.25Z" fill="#F35325" />
      <path d="M12.75 3.25H20.75V11.25H12.75V3.25Z" fill="#81BC06" />
      <path d="M3.25 12.75H11.25V20.75H3.25V12.75Z" fill="#05A6F0" />
      <path d="M12.75 12.75H20.75V20.75H12.75V12.75Z" fill="#FFBA08" />
    </svg>
  );
}

function CheckBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
