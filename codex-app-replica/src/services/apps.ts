import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type AppsListParams = {
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
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: string[];
};

export type AppsListResponse = {
  data: AppInfo[];
  nextCursor: string | null;
};

export async function readAppsSnapshot(params: AppsListParams = {}) {
  return invoke<AppsListResponse>("list_apps", { params });
}

export function onAppsSnapshotUpdated(handler: (snapshot: AppsListResponse) => void) {
  return listen<AppsListResponse>("apps-list-updated", (event) => {
    handler(event.payload);
  });
}
