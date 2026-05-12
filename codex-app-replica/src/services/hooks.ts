import { invoke } from "@tauri-apps/api/core";
import {
  emitQueryCacheInvalidated,
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
  type QueryCacheKey,
} from "./queryCache";
import { batchWriteConfigValueForHost } from "./settings";

export const HOOKS_QUERY_KEY = ["hooks"] as const;

export type HookEventName =
  | "preToolUse"
  | "permissionRequest"
  | "postToolUse"
  | "preCompact"
  | "postCompact"
  | "sessionStart"
  | "userPromptSubmit"
  | "stop";

export type HookSource =
  | "system"
  | "mdm"
  | "cloudRequirements"
  | "legacyManagedConfigFile"
  | "legacyManagedConfigMdm"
  | "user"
  | "project"
  | "sessionFlags"
  | "plugin"
  | "unknown"
  | string;

export type HookMetadata = {
  key: string;
  eventName: HookEventName;
  handlerType: string;
  matcher: string | null;
  command: string | null;
  timeoutSec: number;
  statusMessage: string | null;
  sourcePath: string;
  source: HookSource;
  pluginId: string | null;
  displayOrder: number;
  enabled: boolean;
  isManaged: boolean;
  currentHash: string;
  trustStatus: string;
};

export type HookLoadErrorInfo = {
  path: string;
  message: string;
};

export type HooksListEntry = {
  cwd: string;
  hooks: HookMetadata[];
  warnings: string[];
  errors: HookLoadErrorInfo[];
};

export type HooksListResponse = {
  data: HooksListEntry[];
};

export async function listHooksForHost({
  cwd,
  hostId,
}: {
  cwd: string;
  hostId?: string | null;
}) {
  return invoke<HooksListResponse>("list-hooks-for-host", {
    params: {
      hostId: normalizeHostId(hostId),
      cwds: [cwd],
    },
  });
}

export async function setHookEnabledForHost({
  enabled,
  hostId,
  key,
}: {
  enabled: boolean;
  hostId?: string | null;
  key: string;
}) {
  await batchWriteConfigValueForHost({
    hostId: normalizeHostId(hostId),
    edits: [
      {
        keyPath: "hooks.state",
        value: {
          [key]: {
            enabled,
          },
        },
        mergeStrategy: "upsert",
      },
    ],
    filePath: null,
    expectedVersion: null,
    reloadUserConfig: true,
  });
}

export async function invalidateHooksQueries() {
  await emitQueryCacheInvalidated(HOOKS_QUERY_KEY);
}

export function buildHooksQueryKey({
  cwd,
  hostId,
}: {
  cwd: string | null;
  hostId?: string | null;
}) {
  return [...HOOKS_QUERY_KEY, normalizeHostId(hostId), cwd] as QueryCacheKey;
}

export function isHooksQueryInvalidation(notification: QueryCacheInvalidateNotification) {
  return queryKeyMatchesPrefix(notification.queryKey, HOOKS_QUERY_KEY);
}

export function onHooksQueryInvalidated(
  handler: (notification: QueryCacheInvalidateNotification) => void,
) {
  return onQueryCacheInvalidated((notification) => {
    if (isHooksQueryInvalidation(notification)) {
      handler(notification);
    }
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
