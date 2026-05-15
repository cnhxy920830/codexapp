import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
export {
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA,
  primaryRuntimeUpdateRunNow,
  readPrimaryRuntimeUpdateStatus,
  setPrimaryRuntimeInstallRelease,
  type PrimaryRuntimeUpdateRunNowResponse,
  type PrimaryRuntimeUpdateStatusResponse,
} from "./primaryRuntime";

export const DEBUG_RUN_APP_ACTION_REQUEST_EVENT = "debug-run-app-action-request";
export const DEBUG_RUN_APP_ACTION_RESPONSE_EVENT = "debug-run-app-action-response";

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

export type AmbientSuggestionsGenerationStatus = {
  projectRoot: string;
  runningCount: number;
  safetyRunningCount: number;
  runningStartedAtMs: number | null;
  safetyStartedAtMs: number | null;
  lastFinishedAtMs: number | null;
};

export type AmbientSuggestionsGenerationStatusesResponse = {
  statuses: AmbientSuggestionsGenerationStatus[];
};

export type AmbientSuggestionRecordStatus = "pending" | "accepted" | "dismissed";

export type AmbientSuggestionRecord = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  appIds: string[];
  status: AmbientSuggestionRecordStatus;
  createdAtMs: number;
  updatedAtMs: number;
};

export type AmbientSuggestionsFile = {
  projectRoot: string;
  generatedAtMs: number | null;
  currentSuggestionIds: string[];
  suggestions: AmbientSuggestionRecord[];
};

export type AmbientSuggestionsReadResponse = {
  file: AmbientSuggestionsFile;
};

export async function readAmbientSuggestionsGenerationStatuses() {
  return invoke<AmbientSuggestionsGenerationStatusesResponse>("ambient-suggestions-generation-statuses");
}

export async function readAmbientSuggestions(params: {
  hostId?: string | null;
  projectRoot: string;
}) {
  return invoke<AmbientSuggestionsReadResponse>("ambient-suggestions", {
    params: {
      hostId: params.hostId ?? null,
      projectRoot: params.projectRoot,
    },
  });
}

export async function refreshAmbientSuggestions(params: {
  hostId?: string | null;
  projectRoot: string;
  mode?: "default" | "first-plugin-connect" | null;
}) {
  return invoke<AmbientSuggestionsReadResponse>("ambient-suggestions-refresh", {
    params: {
      hostId: params.hostId ?? null,
      projectRoot: params.projectRoot,
      mode: params.mode ?? "default",
    },
  });
}

export function readAppFlavor(): AppFlavor {
  const rawFlavor = import.meta.env?.VITE_APP_VARIANT?.trim();
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
