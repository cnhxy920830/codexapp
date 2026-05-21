import { invoke } from "@tauri-apps/api/core";
import {
  emitQueryCacheInvalidated,
} from "./queryCache";
import { readAppsSnapshot } from "./apps";
import { refreshAmbientSuggestions } from "./debug";

const APP_CONNECT_OAUTH_PENDING_STORAGE_KEY =
  "codex-app-replica.app-connect-oauth-pending.v1";

export type AppConnectResumeTarget =
  | {
      kind: "apps-tab";
    }
  | {
      kind: "plugin-install";
    };

export type PendingAppConnectOAuth = {
  appId: string;
  appName: string;
  claimed: boolean;
  hostId: string;
  oauthState: string;
  returnTo?: string;
  resumeTarget: AppConnectResumeTarget;
};

export type AppConnectCallbackLocationState = {
  fullRedirectUrl: string;
  returnTo?: string;
};

export type FinishAppConnectOAuthCallbackResult =
  | {
      kind: "missing-callback-data";
    }
  | {
      kind: "request-failed";
      message?: string;
    }
  | {
      kind: "success";
      appName: string;
    };

type FinishAppConnectOAuthCallbackResponse = {
  appName: string | null;
};

type StoredPendingAppConnectOAuth = Record<string, PendingAppConnectOAuth>;

type AppConnectOAuthCallbackUrlResponse = {
  callbackUrl: string;
};

export async function getAppConnectOAuthCallbackUrl() {
  const response = await invoke<AppConnectOAuthCallbackUrlResponse>(
    "app-connect-oauth-callback-url",
  );
  return response.callbackUrl;
}

export function markAppConnectOAuthPending({
  app,
  hostId,
  redirectUrl,
  returnTo,
  resumeTarget = { kind: "apps-tab" },
}: {
  app: {
    id: string;
    name: string;
  };
  hostId?: string | null;
  redirectUrl: string;
  returnTo?: string;
  resumeTarget?: AppConnectResumeTarget;
}) {
  const oauthState = getOAuthStateFromCallbackUrl(redirectUrl);
  if (oauthState == null) {
    return;
  }

  const nextState = readPendingAppConnectOAuthState();
  nextState[oauthState] = {
    appId: app.id,
    appName: app.name,
    claimed: false,
    hostId: normalizeHostId(hostId),
    oauthState,
    returnTo,
    resumeTarget,
  };
  writePendingAppConnectOAuthState(nextState);
}

export function getPendingAppConnectForCallbackUrl(callbackUrl: string) {
  const oauthState = getOAuthStateFromCallbackUrl(callbackUrl);
  if (oauthState == null) {
    return null;
  }

  return readPendingAppConnectOAuthState()[oauthState] ?? null;
}

export function claimAppConnectOAuthCallback(callbackUrl: string) {
  const oauthState = getOAuthStateFromCallbackUrl(callbackUrl);
  if (oauthState == null) {
    return false;
  }

  const nextState = readPendingAppConnectOAuthState();
  const pending = nextState[oauthState];
  if (pending == null || pending.claimed) {
    return false;
  }

  nextState[oauthState] = {
    ...pending,
    claimed: true,
  };
  writePendingAppConnectOAuthState(nextState);
  return true;
}

export function clearPendingAppConnect({
  oauthState,
  appId,
}: {
  oauthState?: string;
  appId?: string;
}) {
  const nextState = readPendingAppConnectOAuthState();
  if (oauthState != null) {
    if (!(oauthState in nextState)) {
      return;
    }
    delete nextState[oauthState];
    writePendingAppConnectOAuthState(nextState);
    return;
  }

  if (appId == null) {
    return;
  }

  let didChange = false;
  for (const [key, value] of Object.entries(nextState)) {
    if (value.appId === appId) {
      delete nextState[key];
      didChange = true;
    }
  }
  if (didChange) {
    writePendingAppConnectOAuthState(nextState);
  }
}

export function isAppConnectPending(appId: string) {
  return Object.values(readPendingAppConnectOAuthState()).some(
    (pending) => pending.appId === appId,
  );
}

export function parseAppConnectCallbackLocationState(
  value: unknown,
): AppConnectCallbackLocationState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const fullRedirectUrl = Reflect.get(value, "fullRedirectUrl");
  const returnTo = Reflect.get(value, "returnTo");
  if (typeof fullRedirectUrl !== "string") {
    return null;
  }
  if (returnTo != null && typeof returnTo !== "string") {
    return null;
  }

  return {
    fullRedirectUrl,
    returnTo: returnTo ?? undefined,
  };
}

export async function finishAppConnectOAuthCallback({
  fullRedirectUrl,
}: {
  fullRedirectUrl: string;
}): Promise<FinishAppConnectOAuthCallbackResult> {
  const normalizedUrl = fullRedirectUrl.trim();
  const pending = normalizedUrl.length === 0
    ? null
    : getPendingAppConnectForCallbackUrl(normalizedUrl);
  const hostId = pending?.hostId ?? "local";
  const oauthState = pending?.oauthState ?? getOAuthStateFromCallbackUrl(normalizedUrl) ?? undefined;

  if (normalizedUrl.length === 0) {
    clearPendingAppConnect({ oauthState });
    return {
      kind: "missing-callback-data",
    };
  }

  const previousApps = await readAppsSnapshot({
    hostId,
    forceRefetch: false,
  }).catch(() => null);

  try {
    const response = await invoke<FinishAppConnectOAuthCallbackResponse>(
      "finish-app-connect-oauth-callback",
      {
        params: {
          fullRedirectUrl: normalizedUrl,
        },
      },
    );
    return {
      kind: "success",
      appName: response.appName?.trim() || pending?.appName || "App",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : String(error).trim();
    return message.length > 0
      ? {
          kind: "request-failed",
          message,
        }
      : {
          kind: "request-failed",
        };
  } finally {
    const nextApps = await readAppsSnapshot({
      hostId,
      forceRefetch: true,
    }).catch(() => null);
    const hadConnectedApps =
      previousApps != null && previousApps.data.some((app) => app.isAccessible && app.isEnabled);
    const hasConnectedApps = nextApps?.data.some((app) => app.isAccessible && app.isEnabled) === true;
    const shouldRefreshAmbientSuggestions = previousApps != null && !hadConnectedApps && hasConnectedApps;

    await Promise.allSettled([
      emitQueryCacheInvalidated(["apps", "list", hostId]),
      emitQueryCacheInvalidated(["mcp-settings"]),
      emitQueryCacheInvalidated(["mcp-settings", "app-connect"]),
      ...(shouldRefreshAmbientSuggestions
        ? [
            refreshAmbientSuggestions({
              hostId,
              projectRoot: "~",
              mode: "first-plugin-connect",
            }),
            emitQueryCacheInvalidated(["ambient-suggestions"]),
            emitQueryCacheInvalidated(["ambient-suggestions-refresh"]),
          ]
        : []),
    ]);
    clearPendingAppConnect({ oauthState });
  }
}

function getOAuthStateFromCallbackUrl(callbackUrl: string) {
  return getSearchParamValue(callbackUrl, "state");
}

function getSearchParamValue(rawUrl: string, key: string) {
  try {
    return new URL(rawUrl).searchParams.get(key)?.trim() || null;
  } catch {
    return null;
  }
}

function normalizeHostId(hostId: string | null | undefined) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "local";
}

function readPendingAppConnectOAuthState(): StoredPendingAppConnectOAuth {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.sessionStorage.getItem(APP_CONNECT_OAUTH_PENDING_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    const nextState: StoredPendingAppConnectOAuth = {};
    for (const [key, value] of Object.entries(parsed)) {
      const pending = normalizePendingAppConnectOAuth(value);
      if (pending != null) {
        nextState[key] = pending;
      }
    }
    return nextState;
  } catch {
    return {};
  }
}

function writePendingAppConnectOAuthState(value: StoredPendingAppConnectOAuth) {
  if (typeof window === "undefined") {
    return;
  }

  if (Object.keys(value).length === 0) {
    window.sessionStorage.removeItem(APP_CONNECT_OAUTH_PENDING_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    APP_CONNECT_OAUTH_PENDING_STORAGE_KEY,
    JSON.stringify(value),
  );
}

function normalizePendingAppConnectOAuth(
  value: unknown,
): PendingAppConnectOAuth | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const appId = normalizeNonEmptyString(Reflect.get(value, "appId"));
  const appName = normalizeNonEmptyString(Reflect.get(value, "appName"));
  const hostId = normalizeNonEmptyString(Reflect.get(value, "hostId"));
  const oauthState = normalizeNonEmptyString(Reflect.get(value, "oauthState"));
  const claimed = Reflect.get(value, "claimed") === true;
  const returnTo = normalizeOptionalString(Reflect.get(value, "returnTo"));
  const resumeTarget = normalizeResumeTarget(Reflect.get(value, "resumeTarget"));
  if (
    appId == null ||
    appName == null ||
    hostId == null ||
    oauthState == null ||
    resumeTarget == null
  ) {
    return null;
  }

  return {
    appId,
    appName,
    claimed,
    hostId,
    oauthState,
    returnTo: returnTo ?? undefined,
    resumeTarget,
  };
}

function normalizeResumeTarget(value: unknown): AppConnectResumeTarget | null {
  if (!value || typeof value !== "object") {
    return {
      kind: "apps-tab",
    };
  }

  const kind = Reflect.get(value, "kind");
  if (kind === "plugin-install") {
    return {
      kind: "plugin-install",
    };
  }
  if (kind === "apps-tab" || kind == null) {
    return {
      kind: "apps-tab",
    };
  }
  return null;
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
