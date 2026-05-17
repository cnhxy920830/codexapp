import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import {
  normalizeWorkspaceOnboardingExperimentAssignment,
  shouldUseWelcomeV2WorkspaceOnboarding,
  type WorkspaceOnboardingExperimentAssignment,
} from "../onboarding/selectWorkspaceModel";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../statsig/replicaStatsig";
import {
  cancelLogin,
  loginApiKey,
  loginChatGpt,
  type AuthSnapshot,
} from "../../services/auth";
import {
  getGlobalState,
  onGlobalStateUpdated,
  setGlobalState,
} from "../../services/settings";
import { LoginSnakeGame } from "./LoginSnakeGame";
import {
  LoginRouteView,
  type LoginRouteShellVariant,
} from "./LoginRouteView";

type LoginMode = "signin" | "signup" | "google" | "microsoft";

const GATE_LOGIN_PROVIDER_VISIBILITY = "3446609779";
const GATE_STREAMLINED_LOGIN = "1561420571";
const GATE_STREAMLINED_LOGIN_COPY = "2523619087";
const CHATGPT_STREAMLINED_AUTH_URL = "https://chatgpt.com/codex/desktop-auth";

type LoginRoutePageProps = {
  authSnapshot: AuthSnapshot;
  onNavigateToWelcome: () => void;
  onShowToast: (toast: AppToast) => void;
};

export function LoginRoutePage({
  authSnapshot,
  onNavigateToWelcome,
  onShowToast,
}: LoginRoutePageProps) {
  const { t } = useI18n();
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isApiKeyEntryVisible, setIsApiKeyEntryVisible] = useState(false);
  const [isApiKeySignInPending, setIsApiKeySignInPending] = useState(false);
  const [isSnakeVisible, setIsSnakeVisible] = useState(false);
  const [
    workspaceOnboardingExperimentAssignment,
    setWorkspaceOnboardingExperimentAssignment,
  ] = useState<WorkspaceOnboardingExperimentAssignment>(null);
  const browserLoginRequestedRef = useRef(false);
  const welcomeHandoffTriggeredRef = useRef(false);
  const lastLoginErrorRef = useRef<string | null>(null);
  const showChatGptProviderSignIn = useReplicaStatsigGateValue(
    GATE_LOGIN_PROVIDER_VISIBILITY,
  );
  const useStreamlinedLogin = useReplicaStatsigGateValue(
    GATE_STREAMLINED_LOGIN,
  );
  const useStreamlinedCopy = useReplicaStatsigGateValue(
    GATE_STREAMLINED_LOGIN_COPY,
  );
  const welcomeV2DefaultFlowEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.workspaceOnboardingWelcomeV2DefaultFlow,
  );

  const refreshWorkspaceOnboardingExperimentAssignment = useEffectEvent(
    async () => {
      try {
        const response = await getGlobalState(
          "electron:onboarding-workspace-experiment-assignment",
        );
        setWorkspaceOnboardingExperimentAssignment(
          normalizeWorkspaceOnboardingExperimentAssignment(response.value),
        );
      } catch {
        setWorkspaceOnboardingExperimentAssignment(null);
      }
    },
  );

  useEffect(() => {
    let disposed = false;
    let unlistenGlobalState: (() => void) | undefined;

    void refreshWorkspaceOnboardingExperimentAssignment();

    void onGlobalStateUpdated((notification) => {
      if (
        !notification.keys.includes(
          "electron:onboarding-workspace-experiment-assignment",
        )
      ) {
        return;
      }

      void refreshWorkspaceOnboardingExperimentAssignment();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }

      unlistenGlobalState = dispose;
    });

    return () => {
      disposed = true;
      void unlistenGlobalState?.();
    };
  }, []);

  const shellVariant: LoginRouteShellVariant =
    shouldUseWelcomeV2WorkspaceOnboarding({
      assignment: workspaceOnboardingExperimentAssignment,
      welcomeV2DefaultFlowEnabled,
    })
      ? "welcomeV2"
      : "welcomeV1";

  useEffect(() => {
    if (
      authSnapshot.lastLoginError == null ||
      authSnapshot.lastLoginError === lastLoginErrorRef.current
    ) {
      lastLoginErrorRef.current = authSnapshot.lastLoginError;
      return;
    }

    browserLoginRequestedRef.current = false;
    welcomeHandoffTriggeredRef.current = false;
    showLoginError(authSnapshot.lastLoginError);
    lastLoginErrorRef.current = authSnapshot.lastLoginError;
  }, [authSnapshot.lastLoginError]);

  useEffect(() => {
    if (
      authSnapshot.authState.authMethod == null ||
      !browserLoginRequestedRef.current ||
      welcomeHandoffTriggeredRef.current
    ) {
      return;
    }

    welcomeHandoffTriggeredRef.current = true;
    void completeLoginSuccess().finally(onNavigateToWelcome);
  }, [authSnapshot.authState.authMethod, onNavigateToWelcome]);

  const isBrowserSignInPending =
    authSnapshot.activeLoginId !== null &&
    authSnapshot.browserAuthUrl !== null;

  const viewModel = useMemo(
    () => ({
      apiKeyValue,
      isApiKeyEntryVisible,
      isApiKeySignInPending,
      isBrowserSignInPending,
      isSnakeVisible,
      shellVariant,
      showChatGptProviderSignIn,
      useStreamlinedCopy,
    }),
    [
      apiKeyValue,
      isApiKeyEntryVisible,
      isApiKeySignInPending,
      isBrowserSignInPending,
      isSnakeVisible,
      shellVariant,
      showChatGptProviderSignIn,
      useStreamlinedCopy,
    ],
  );

  return (
    <LoginRouteView
      {...viewModel}
      onApiKeyCancel={() => {
        setIsApiKeyEntryVisible(false);
        setIsApiKeySignInPending(false);
        setApiKeyValue("");
      }}
      onApiKeySubmit={() => void handleApiKeySubmit()}
      onApiKeyValueChange={setApiKeyValue}
      onCancelSignIn={() => void handleChatGptSignIn("signin")}
      onChatGptSignIn={() => void handleChatGptSignIn("signin")}
      onGoogleSignIn={() => void handleChatGptSignIn("google")}
      onMicrosoftSignIn={() => void handleChatGptSignIn("microsoft")}
      onPlaySnake={() => setIsSnakeVisible(true)}
      onShowApiKeyEntry={() => {
        setIsApiKeyEntryVisible(true);
        setIsApiKeySignInPending(false);
        setIsSnakeVisible(false);
      }}
      onSignUp={() => void handleChatGptSignIn("signup")}
      snakeGame={<LoginSnakeGame onExit={() => setIsSnakeVisible(false)} />}
    />
  );

  async function handleChatGptSignIn(mode: LoginMode) {
    if (authSnapshot.activeLoginId) {
      await handleCancelSignIn();
      return;
    }

    welcomeHandoffTriggeredRef.current = false;
    browserLoginRequestedRef.current = true;
    setIsApiKeyEntryVisible(false);

    try {
      const result = await loginChatGpt({
        useStreamlinedLogin,
      });
      await open(buildChatGptAuthUrl(result.authUrl, mode, useStreamlinedLogin));
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

    welcomeHandoffTriggeredRef.current = false;
    setIsApiKeySignInPending(true);
    try {
      await loginApiKey({ apiKey: normalizedApiKey });
      await completeLoginSuccess();
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

  async function completeLoginSuccess() {
    browserLoginRequestedRef.current = false;
    setIsApiKeyEntryVisible(false);
    setIsApiKeySignInPending(false);

    await Promise.allSettled([
      setGlobalState("electron:onboarding-primary-runtime-install-ready", false),
      setGlobalState(
        "electron:onboarding-primary-runtime-install-requested",
        true,
      ),
    ]);
    await setGlobalState("electron:onboarding-welcome-pending", true).catch(
      () => undefined,
    );
  }

  function showLoginError(error: unknown) {
    onShowToast({
      message: t("electron.onboarding.login.error", {
        rawMessage: normalizeErrorMessage(error),
      }),
      tone: "error",
    });
  }
}

function buildChatGptAuthUrl(
  authUrl: string,
  mode: LoginMode,
  useStreamlinedLogin: boolean,
) {
  const shapedAuthUrl = shapeChatGptAuthUrl(authUrl, mode);
  if (!useStreamlinedLogin) {
    return shapedAuthUrl;
  }

  try {
    const parsedUrl = new URL(shapedAuthUrl);
    if (parsedUrl.pathname === "/codex/desktop-auth") {
      return shapedAuthUrl;
    }

    const wrapperUrl = new URL(CHATGPT_STREAMLINED_AUTH_URL);
    wrapperUrl.searchParams.set("authorize_url", shapedAuthUrl);
    wrapperUrl.searchParams.set("codex_streamlined_login", "true");
    return wrapperUrl.toString();
  } catch {
    return shapedAuthUrl;
  }
}

function shapeChatGptAuthUrl(authUrl: string, mode: LoginMode) {
  if (mode === "signin") {
    return authUrl;
  }

  try {
    const url = new URL(authUrl);
    switch (mode) {
      case "signup":
        url.searchParams.set("screen_hint", "signup");
        break;
      case "google":
        url.searchParams.set("screen_hint", "login_or_signup");
        url.searchParams.set("connection", "google-oauth2");
        break;
      case "microsoft":
        url.searchParams.set("screen_hint", "login_or_signup");
        url.searchParams.set("connection", "windowslive");
        break;
      default:
        break;
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
