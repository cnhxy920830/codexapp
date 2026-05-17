import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useRef, useState } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import { cancelLogin, loginApiKey, loginChatGpt, type AuthSnapshot } from "../../services/auth";
import { setGlobalState } from "../../services/settings";
import { LoginSnakeGame } from "./LoginSnakeGame";
import { LoginRouteView } from "./LoginRouteView";

type LoginMode = "signin" | "signup";
type LoginProvider = "chatgpt" | "google" | "microsoft";

export function LoginRoutePage({
  authSnapshot,
  onNavigateToWelcome,
  onShowToast,
}: {
  authSnapshot: AuthSnapshot;
  onNavigateToWelcome: () => void;
  onShowToast: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isApiKeyEntryVisible, setIsApiKeyEntryVisible] = useState(false);
  const [isApiKeySignInPending, setIsApiKeySignInPending] = useState(false);
  const [isSnakeVisible, setIsSnakeVisible] = useState(false);
  const browserLoginRequestedRef = useRef(false);
  const welcomeHandoffTriggeredRef = useRef(false);
  const lastLoginErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (authSnapshot.activeLoginId || authSnapshot.authState.authMethod) {
      setIsApiKeyEntryVisible(false);
    }
  }, [authSnapshot.activeLoginId, authSnapshot.authState.authMethod]);

  useEffect(() => {
    if (authSnapshot.lastLoginError == null || authSnapshot.lastLoginError === lastLoginErrorRef.current) {
      lastLoginErrorRef.current = authSnapshot.lastLoginError;
      return;
    }

    browserLoginRequestedRef.current = false;
    showLoginError(authSnapshot.lastLoginError);
    lastLoginErrorRef.current = authSnapshot.lastLoginError;
  }, [authSnapshot.lastLoginError]);

  useEffect(() => {
    if (authSnapshot.authState.authMethod == null || !browserLoginRequestedRef.current || welcomeHandoffTriggeredRef.current) {
      return;
    }

    welcomeHandoffTriggeredRef.current = true;
    void prepareWelcomeHandoff().finally(onNavigateToWelcome);
  }, [authSnapshot.authState.authMethod, onNavigateToWelcome]);

  const isBrowserSignInPending = authSnapshot.activeLoginId !== null && authSnapshot.browserAuthUrl !== null;

  return (
    <LoginRouteView
      apiKeyValue={apiKeyValue}
      isApiKeyEntryVisible={isApiKeyEntryVisible}
      isApiKeySignInPending={isApiKeySignInPending}
      isBrowserSignInPending={isBrowserSignInPending}
      isSnakeVisible={isSnakeVisible}
      onApiKeyCancel={() => {
        setApiKeyValue("");
        setIsApiKeyEntryVisible(false);
        setIsApiKeySignInPending(false);
      }}
      onApiKeySubmit={() => void handleApiKeySubmit()}
      onApiKeyValueChange={setApiKeyValue}
      onCancelSignIn={() => void handleCancelSignIn()}
      onChatGptSignIn={() => void handleChatGptSignIn("signin", "chatgpt")}
      onGoogleSignIn={() => void handleChatGptSignIn("signin", "google")}
      onMicrosoftSignIn={() => void handleChatGptSignIn("signin", "microsoft")}
      onPlaySnake={() => setIsSnakeVisible(true)}
      onShowApiKeyEntry={() => {
        setIsApiKeyEntryVisible(true);
        setIsSnakeVisible(false);
      }}
      onSignUp={() => void handleChatGptSignIn("signup", "chatgpt")}
      snakeGame={<LoginSnakeGame onExit={() => setIsSnakeVisible(false)} />}
    />
  );

  async function handleChatGptSignIn(mode: LoginMode, provider: LoginProvider = "chatgpt") {
    if (authSnapshot.activeLoginId) {
      await handleCancelSignIn();
      return;
    }

    welcomeHandoffTriggeredRef.current = false;
    browserLoginRequestedRef.current = true;
    setIsApiKeyEntryVisible(false);
    try {
      const result = await loginChatGpt();
      await open(buildChatGptAuthUrl(result.authUrl, mode, provider));
    } catch (error) {
      browserLoginRequestedRef.current = false;
      showLoginError(error);
    }
  }

  async function handleApiKeySubmit() {
    const normalizedApiKey = apiKeyValue.trim();
    if (!normalizedApiKey || isApiKeySignInPending) {
      return;
    }

    setIsApiKeySignInPending(true);
    welcomeHandoffTriggeredRef.current = false;
    try {
      await loginApiKey({ apiKey: normalizedApiKey });
      await prepareWelcomeHandoff();
      onNavigateToWelcome();
    } catch (error) {
      showLoginError(error);
    } finally {
      setIsApiKeySignInPending(false);
    }
  }

  async function handleCancelSignIn() {
    if (!authSnapshot.activeLoginId) {
      return;
    }

    browserLoginRequestedRef.current = false;
    try {
      await cancelLogin(authSnapshot.activeLoginId);
    } catch (error) {
      showLoginError(error);
    }
  }

  async function prepareWelcomeHandoff() {
    await Promise.allSettled([
      setGlobalState("electron:onboarding-welcome-pending", true),
      setGlobalState("electron:onboarding-primary-runtime-install-requested", true),
      setGlobalState("electron:onboarding-primary-runtime-install-ready", false),
    ]);
  }

  function showLoginError(error: unknown) {
    onShowToast({
      message: t("codex.signInFailed.message", {
        rawMessage: normalizeErrorMessage(error),
      }),
      tone: "error",
    });
  }
}

function buildChatGptAuthUrl(authUrl: string, mode: LoginMode, provider: LoginProvider) {
  try {
    const url = new URL(authUrl);
    if (mode === "signup") {
      url.searchParams.set("screen_hint", "signup");
    }
    if (provider !== "chatgpt") {
      url.searchParams.set("connection", provider);
    }
    return url.toString();
  } catch {
    return authUrl;
  }
}

function normalizeErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown error";
}
