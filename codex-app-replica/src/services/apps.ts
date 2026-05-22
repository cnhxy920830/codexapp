import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { emitQueryCacheInvalidated } from "./queryCache";
import { batchWriteConfigValueForHost } from "./settings";

const APPS_QUERY_KEY = ["apps", "list"] as const;

export type AppsListParams = {
  hostId?: string | null;
  cursor?: string | null;
  limit?: number | null;
  threadId?: string | null;
  forceRefetch?: boolean;
};

export type AppInfo = {
  id: string;
  name: string;
  description: string | null;
  installUrl: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: string[];
  labels: Record<string, string> | null;
};

export type AppsListResponse = {
  data: AppInfo[];
  nextCursor: string | null;
};

export type AppSetEnabledParams = {
  appId: string;
  enabled: boolean;
  expectedVersion?: string | null;
  filePath?: string | null;
  hostId?: string | null;
};

export type AppTool = {
  name: string;
  description: string;
  accessBadges: string[];
  visibility: string | null;
};

export type ReadAppToolsParams = {
  appId: string;
  hostId?: string | null;
};

export type ReadAppToolsResponse = {
  tools: AppTool[];
};

export async function readAppsSnapshot(params: AppsListParams = {}) {
  const { hostId = null, ...rest } = params;
  return invoke<AppsListResponse>("list_apps", {
    params: {
      hostId,
      ...rest,
    },
  });
}

export async function readAppTools(params: ReadAppToolsParams) {
  return invoke<ReadAppToolsResponse>("read_app_tools", { params });
}

export async function setAppEnabled(params: AppSetEnabledParams) {
  const { appId, enabled, expectedVersion, filePath, hostId } = params;
  await batchWriteConfigValueForHost({
    hostId,
    edits: [
      {
        keyPath: `apps.${appId}.enabled`,
        value: enabled,
        mergeStrategy: "upsert",
      },
    ],
    filePath: filePath ?? null,
    expectedVersion: expectedVersion ?? null,
    reloadUserConfig: true,
  });
  await emitQueryCacheInvalidated([...APPS_QUERY_KEY, hostId ?? null]);
}

export function onAppsSnapshotUpdated(handler: (snapshot: AppsListResponse) => void) {
  return listen<AppsListResponse>("apps-list-updated", (event) => {
    handler(event.payload);
  });
}
