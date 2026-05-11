import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const DEBUG_RUN_APP_ACTION_REQUEST_EVENT = "debug-run-app-action-request";
export const DEBUG_RUN_APP_ACTION_RESPONSE_EVENT = "debug-run-app-action-response";
export const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST = "latest";
export const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA = "latest-alpha";

export type AppFlavor = "agent" | "dev" | "internal-alpha" | "nightly" | "owl" | "prod" | "public-beta";

const DEBUG_MENU_ALLOWED_APP_FLAVORS = new Set<AppFlavor>([
  "agent",
  "dev",
  "internal-alpha",
  "nightly",
  "owl",
  "public-beta",
]);

export type DebugRunAppActionRequestNotification = {
  requestId: string;
  sourceWindowLabel: string;
  action: Record<string, unknown>;
  sourceThreadId?: string | null;
};

export type DebugRunAppActionResponseParams = {
  requestId: string;
  ok: boolean;
  result?: unknown | null;
  errorMessage?: string | null;
};

export type PrimaryRuntimeUpdateStatusResponse = {
  disabledReason: string | null;
  enabled: boolean;
  isRunning: boolean;
  nextRunAt: number | null;
  startupChecked: boolean;
};

export type PrimaryRuntimeUpdateRunNowResponse = {
  bundleVersion: string | null;
  nextRunAt: number | null;
  reason: string | null;
  status: "already-current" | "installed" | "skipped";
};

export async function readPrimaryRuntimeUpdateStatus() {
  return invoke<PrimaryRuntimeUpdateStatusResponse>("primary-runtime-update-status");
}

export async function primaryRuntimeUpdateRunNow() {
  return invoke<PrimaryRuntimeUpdateRunNowResponse>("primary-runtime-update-run-now");
}

export async function setPrimaryRuntimeInstallRelease(release: string) {
  await invoke<void>("set-primary-runtime-install-release", {
    params: { release },
  });
}

export function readAppFlavor(): AppFlavor {
  const rawFlavor = import.meta.env.VITE_APP_VARIANT?.trim();
  if (isAppFlavor(rawFlavor)) {
    return rawFlavor;
  }

  return "dev";
}

export function allowDebugMenu(appFlavor = readAppFlavor()) {
  return DEBUG_MENU_ALLOWED_APP_FLAVORS.has(appFlavor);
}

export function onDebugRunAppActionRequest(
  handler: (notification: DebugRunAppActionRequestNotification) => void,
) {
  return listen<DebugRunAppActionRequestNotification>(DEBUG_RUN_APP_ACTION_REQUEST_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function respondToDebugRunAppAction(params: DebugRunAppActionResponseParams) {
  await invoke<void>("debug-run-app-action-response", {
    params,
  });
}

export async function runDebugAppAction(params: {
  action: Record<string, unknown>;
  sourceThreadId?: string | null;
}) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return await new Promise<DebugRunAppActionResponseParams>((resolve, reject) => {
    let unlisten: UnlistenFn | null = null;

    void listen<DebugRunAppActionResponseParams>(DEBUG_RUN_APP_ACTION_RESPONSE_EVENT, (event) => {
      if (event.payload.requestId !== requestId) {
        return;
      }

      if (unlisten !== null) {
        void unlisten();
        unlisten = null;
      }
      resolve(event.payload);
    })
      .then((dispose) => {
        unlisten = dispose;
        void invoke<void>("debug-run-app-action-request", {
          params: {
            requestId,
            action: params.action,
            sourceThreadId: params.sourceThreadId ?? null,
          },
        }).catch((error) => {
          if (unlisten !== null) {
            void unlisten();
            unlisten = null;
          }
          reject(error);
        });
      })
      .catch(reject);
  });
}

function isAppFlavor(value: string | undefined): value is AppFlavor {
  return (
    value === "agent" ||
    value === "dev" ||
    value === "internal-alpha" ||
    value === "nightly" ||
    value === "owl" ||
    value === "prod" ||
    value === "public-beta"
  );
}
