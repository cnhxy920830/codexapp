import { invoke } from "@tauri-apps/api/core";
import {
  emitQueryCacheInvalidated,
} from "./queryCache";
import { readAppsSnapshot } from "./apps";
import { refreshAmbientSuggestions } from "./debug";

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

let pendingAppConnectOAuthState: StoredPendingAppConnectOAuth = {};

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
  return {
    ...pendingAppConnectOAuthState,
  };
}

function writePendingAppConnectOAuthState(value: StoredPendingAppConnectOAuth) {
  pendingAppConnectOAuthState = value;
}
