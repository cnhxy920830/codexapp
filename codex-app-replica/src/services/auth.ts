import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { MessageKey, MessageValues } from "../i18n/messages";

export type AuthState = {
  authMethod: string | null;
  openAIAuth: string | null;
  requiresAuth: boolean;
  email: string | null;
  accountId: string | null;
  userId: string | null;
  planAtLogin: string | null;
};

export type LaunchContext = {
  openProjectPath: string | null;
};

export type AuthSnapshot = {
  isLoading: boolean;
  authState: AuthState;
  activeLoginId: string | null;
  lastLoginError: string | null;
  browserAuthUrl: string | null;
  deviceCode: DeviceCodeInfo | null;
};

export type DeviceCodeInfo = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type ApiKeyLoginParams = {
  apiKey: string;
};

export type ChatGptLoginStart = {
  loginId: string;
  authUrl: string;
};

export type DeviceCodeLoginStart = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type AccountInfoResponse = {
  email: string | null;
  accountId: string | null;
  userId: string | null;
  plan: string | null;
};

const DEFAULT_AUTH_STATE: AuthState = {
  authMethod: null,
  openAIAuth: null,
  requiresAuth: true,
  email: null,
  accountId: null,
  userId: null,
  planAtLogin: null,
};

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  return invoke<AuthSnapshot>("get_auth_state");
}

export async function getLaunchContext(): Promise<LaunchContext> {
  return invoke<LaunchContext>("get_launch_context");
}

export async function readAccountInfo(): Promise<AccountInfoResponse> {
  return invoke<AccountInfoResponse>("account-info");
}

export async function loginApiKey(params: ApiKeyLoginParams) {
  return invoke<void>("login-with-api-key", {
    params: {
      hostId: null,
      apiKey: params.apiKey,
    },
  });
}

export async function loginChatGpt() {
  return invoke<ChatGptLoginStart>("login-with-chatgpt");
}

export async function loginChatGptDeviceCode() {
  return invoke<DeviceCodeLoginStart>("login-with-chatgpt-device-code");
}

export async function cancelLogin(loginId: string) {
  return invoke<void>("cancel_login", { loginId });
}

export async function logout() {
  return invoke<void>("logout");
}

export function onAuthSnapshotChange(handler: (snapshot: AuthSnapshot) => void) {
  return listen<AuthSnapshot>("auth-state-changed", (event) => {
    handler(event.payload);
  });
}

export function isUsageSettingsPlanSupported(plan: string | null) {
  if (plan == null) {
    return false;
  }

  const normalizedPlan = plan.trim().toLowerCase();
  return normalizedPlan === "plus" || normalizedPlan === "pro" || normalizedPlan === "prolite";
}

type TranslateMessage = (key: MessageKey, values?: MessageValues) => string;

export function formatAuthLabel(snapshot: AuthSnapshot | null, t: TranslateMessage) {
  if (!snapshot || snapshot.isLoading) {
    return t("auth.checking");
  }

  if (snapshot.activeLoginId) {
    return snapshot.deviceCode ? t("auth.deviceCode") : t("auth.signingIn");
  }

  const { authState } = snapshot;
  if (!authState.authMethod) {
    return authState.requiresAuth ? t("auth.signedOut") : t("auth.ready");
  }

  if (authState.authMethod === "chatgpt" && authState.email) {
    return authState.planAtLogin ? `${authState.email} · ${authState.planAtLogin}` : authState.email;
  }

  if (authState.authMethod === "apikey") {
    return t("auth.apiKey");
  }

  return authState.authMethod === "chatgpt" ? t("auth.chatGpt") : authState.authMethod;
}

export function formatAuthDetail(snapshot: AuthSnapshot | null, t: TranslateMessage) {
  if (!snapshot || snapshot.isLoading) {
    return null;
  }

  if (snapshot.activeLoginId) {
    return snapshot.deviceCode ? snapshot.deviceCode.userCode : t("auth.completeBrowserSignIn");
  }

  const { authState } = snapshot;
  if (authState.authMethod === "chatgpt") {
    return authState.email ? authState.email : t("auth.chatGpt");
  }

  if (authState.authMethod === "apikey") {
    return t("auth.openAiApiKey");
  }

  return authState.requiresAuth ? t("auth.loginRequired") : null;
}

export const initialAuthSnapshot: AuthSnapshot = {
  isLoading: true,
  authState: DEFAULT_AUTH_STATE,
  activeLoginId: null,
  lastLoginError: null,
  browserAuthUrl: null,
  deviceCode: null,
};
