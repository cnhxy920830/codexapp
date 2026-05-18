import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { MessageKey, MessageValues } from "../i18n/messages";
import {
  emitQueryCacheInvalidated,
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "./queryCache";

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

export type ChatGptLoginParams = {
  hostId?: string | null;
  useStreamlinedLogin?: boolean;
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

export type BrowserChatGptPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "prolite"
  | "team"
  | "self_serve_business_usage_based"
  | "business"
  | "enterprise_cbp_usage_based"
  | "enterprise"
  | "edu"
  | "unknown";

export type BrowserChatGptTokenAuth = {
  accessToken: string;
  accountId: string;
  userId: string | null;
  email: string | null;
  planType: BrowserChatGptPlanType;
  source: "token";
};

export type SaveBrowserChatGptTokenAuthParams = {
  accessToken: string;
  chatgptAccountId?: string | null;
  chatgptPlanType?: string | null;
};

export const ACCOUNT_INFO_QUERY_KEY = ["account-info"] as const;
export const ENVIRONMENTS_QUERY_KEY = ["environments"] as const;

const DEFAULT_AUTH_STATE: AuthState = {
  authMethod: null,
  openAIAuth: null,
  requiresAuth: true,
  email: null,
  accountId: null,
  userId: null,
  planAtLogin: null,
};

const BROWSER_AUTH_METHOD_STORAGE_KEY = "codex.browser.authMethod";
const BROWSER_CHATGPT_AUTH_STORAGE_KEY = "codex.browser.chatgptAuth";
const BROWSER_CHATGPT_TOKEN_AUTH_SESSION_KEY = "codex.browser.chatgptTokenAuth";
const BROWSER_CHATGPT_ACCESS_TOKEN_COOKIE = "codex_browser_chatgpt_access_token";
const BROWSER_CHATGPT_ACCOUNT_ID_COOKIE = "codex_browser_chatgpt_account_id";
export const BROWSER_AUTH_CHANGED_EVENT = "codex-browser-auth-changed";
const BROWSER_CHATGPT_HOST_SUFFIXES = ["chatgpt.com", "chatgpt-staging.com"] as const;
const BROWSER_CHATGPT_PLAN_TYPES = new Set<BrowserChatGptPlanType>([
  "free",
  "go",
  "plus",
  "pro",
  "prolite",
  "team",
  "self_serve_business_usage_based",
  "business",
  "enterprise_cbp_usage_based",
  "enterprise",
  "edu",
  "unknown",
]);

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  return invoke<AuthSnapshot>("get_auth_state");
}

export async function getLaunchContext(): Promise<LaunchContext> {
  return invoke<LaunchContext>("get_launch_context");
}

export async function readAccountInfo(): Promise<AccountInfoResponse> {
  return invoke<AccountInfoResponse>("account-info");
}

export async function invalidateAccountSettingsQueries() {
  await Promise.all([
    emitQueryCacheInvalidated(ACCOUNT_INFO_QUERY_KEY),
    emitQueryCacheInvalidated(ENVIRONMENTS_QUERY_KEY),
  ]);
}

export function isAccountSettingsQueryInvalidation(notification: QueryCacheInvalidateNotification) {
  return (
    queryKeyMatchesPrefix(notification.queryKey, ACCOUNT_INFO_QUERY_KEY) ||
    queryKeyMatchesPrefix(notification.queryKey, ENVIRONMENTS_QUERY_KEY)
  );
}

export function onAccountSettingsQueriesInvalidated(
  handler: (notification: QueryCacheInvalidateNotification) => void,
) {
  return onQueryCacheInvalidated((notification) => {
    if (isAccountSettingsQueryInvalidation(notification)) {
      handler(notification);
    }
  });
}

export async function loginApiKey(params: ApiKeyLoginParams) {
  return invoke<void>("login-with-api-key", {
    params: {
      hostId: null,
      apiKey: params.apiKey,
    },
  });
}

export async function loginApiKeyForHost(hostId: string | null, apiKey: string) {
  return invoke<void>("login-with-api-key-for-host", {
    params: {
      hostId: normalizeHostId(hostId),
      apiKey,
    },
  });
}

export async function loginChatGpt(params: ChatGptLoginParams = {}) {
  return invoke<ChatGptLoginStart>("login-with-chatgpt", {
    params: {
      hostId: normalizeHostId(params.hostId),
      useStreamlinedLogin: params.useStreamlinedLogin === true,
    },
  });
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

export async function logoutForHost(hostId: string | null) {
  return invoke<void>("logout", {
    params: {
      hostId: normalizeHostId(hostId),
    },
  });
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

export function readBrowserChatGptTokenAuth(): BrowserChatGptTokenAuth | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(BROWSER_CHATGPT_TOKEN_AUTH_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const value = JSON.parse(rawValue) as Record<string, unknown>;
    const accessToken = normalizeOptionalString(value.accessToken);
    const accountId = normalizeOptionalString(value.accountId);
    const source = value.source === "token" ? value.source : null;
    if (accessToken == null || accountId == null || source == null) {
      return null;
    }

    return {
      accessToken,
      accountId,
      userId: normalizeOptionalString(value.userId),
      email: normalizeOptionalString(value.email),
      planType: normalizeBrowserChatGptPlanType(value.planType) ?? "unknown",
      source,
    };
  } catch {
    return null;
  }
}

export function saveBrowserChatGptTokenAuth({
  accessToken,
  chatgptAccountId,
  chatgptPlanType,
}: SaveBrowserChatGptTokenAuthParams): BrowserChatGptTokenAuth {
  const normalizedAccessToken = normalizeChatGptBearerToken(accessToken);
  const parsedTokenClaims = parseBrowserChatGptTokenClaims(normalizedAccessToken);
  const accountId = chatgptAccountId?.trim() || parsedTokenClaims?.accountId || null;
  if (accountId == null) {
    throw new Error("Paste a ChatGPT bearer token with an account ID");
  }

  const nextAuth: BrowserChatGptTokenAuth = {
    accessToken: normalizedAccessToken,
    accountId,
    userId: parsedTokenClaims?.userId ?? null,
    email: parsedTokenClaims?.email ?? null,
    planType: normalizeBrowserChatGptPlanType(chatgptPlanType) ?? parsedTokenClaims?.planType ?? "unknown",
    source: "token",
  };

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(BROWSER_CHATGPT_TOKEN_AUTH_SESSION_KEY, JSON.stringify(nextAuth));
    clearLegacyBrowserChatGptAuthState();
    syncBrowserChatGptAuthCookies(nextAuth.accessToken, accountId);
    dispatchBrowserAuthChanged();
  }

  return nextAuth;
}

export function clearBrowserChatGptTokenAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(BROWSER_CHATGPT_TOKEN_AUTH_SESSION_KEY);
  clearLegacyBrowserChatGptAuthState();
  dispatchBrowserAuthChanged();
}

export function onBrowserAuthChanged(handler: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => {
    handler();
  };
  window.addEventListener(BROWSER_AUTH_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(BROWSER_AUTH_CHANGED_EVENT, listener);
  };
}

type ParsedBrowserChatGptTokenClaims = {
  accountId: string | null;
  userId: string | null;
  email: string | null;
  planType: BrowserChatGptPlanType | null;
};

function normalizeHostId(hostId: string | null | undefined) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeChatGptBearerToken(accessToken: string) {
  const trimmed = accessToken.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
}

function parseBrowserChatGptTokenClaims(accessToken: string): ParsedBrowserChatGptTokenClaims | null {
  const payloadSegment = accessToken.split(".")[1];
  if (payloadSegment == null) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
    const authClaims = normalizeRecord(payload["https://api.openai.com/auth"]);
    const profileClaims = normalizeRecord(payload["https://api.openai.com/profile"]);
    return {
      accountId: normalizeOptionalString(authClaims?.chatgpt_account_id),
      userId: normalizeOptionalString(authClaims?.chatgpt_user_id),
      email: normalizeOptionalString(profileClaims?.email),
      planType: normalizeBrowserChatGptPlanType(authClaims?.chatgpt_plan_type),
    };
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const normalizedValue = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalizedValue.length % 4)) % 4;
  return globalThis.atob(`${normalizedValue}${"=".repeat(paddingLength)}`);
}

function normalizeBrowserChatGptPlanType(value: unknown): BrowserChatGptPlanType | null {
  if (typeof value !== "string") {
    return null;
  }

  return BROWSER_CHATGPT_PLAN_TYPES.has(value as BrowserChatGptPlanType) ? (value as BrowserChatGptPlanType) : null;
}

function clearLegacyBrowserChatGptAuthState() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BROWSER_AUTH_METHOD_STORAGE_KEY);
    window.localStorage.removeItem(BROWSER_CHATGPT_AUTH_STORAGE_KEY);
  }
  deleteBrowserAuthCookie(BROWSER_CHATGPT_ACCESS_TOKEN_COOKIE);
  deleteBrowserAuthCookie(BROWSER_CHATGPT_ACCOUNT_ID_COOKIE);
}

function syncBrowserChatGptAuthCookies(accessToken: string, accountId: string) {
  if (typeof document === "undefined" || isChatGptHost()) {
    return;
  }

  setBrowserAuthCookie(BROWSER_CHATGPT_ACCESS_TOKEN_COOKIE, accessToken);
  setBrowserAuthCookie(BROWSER_CHATGPT_ACCOUNT_ID_COOKIE, accountId);
}

function isChatGptHost() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return BROWSER_CHATGPT_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function setBrowserAuthCookie(name: string, value: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict`;
}

function deleteBrowserAuthCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; Path=/; SameSite=Strict; Max-Age=0`;
}

function dispatchBrowserAuthChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(BROWSER_AUTH_CHANGED_EVENT));
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
