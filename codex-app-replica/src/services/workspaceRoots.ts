import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type WorkspaceRootOptionsResponse = {
  roots: string[];
  labels: Record<string, string>;
};

export type ActiveWorkspaceRootsResponse = {
  roots: string[];
};

export type WorkspaceRootOptionAddedNotification = {
  root: string;
};

export async function readWorkspaceRootOptions(hostId?: string | null) {
  return invoke<WorkspaceRootOptionsResponse>("workspace-root-options", {
    hostId: normalizeHostId(hostId),
  });
}

export async function readActiveWorkspaceRoots(hostId?: string | null) {
  return invoke<ActiveWorkspaceRootsResponse>("active-workspace-roots", {
    hostId: normalizeHostId(hostId),
  });
}

export async function addNewWorkspaceRootOption(root?: string | null) {
  return invoke<void>("electron-add-new-workspace-root-option", {
    root: normalizeOptionalRoot(root),
  });
}

export function onWorkspaceRootOptionsUpdated(handler: () => void) {
  return listen("workspace-root-options-updated", () => {
    handler();
  });
}

export function onActiveWorkspaceRootsUpdated(handler: () => void) {
  return listen("active-workspace-roots-updated", () => {
    handler();
  });
}

export function onWorkspaceRootOptionAdded(
  handler: (notification: WorkspaceRootOptionAddedNotification) => void,
) {
  return listen<WorkspaceRootOptionAddedNotification>("workspace-root-option-added", (event) => {
    handler(event.payload);
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalRoot(root?: string | null) {
  const trimmed = root?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
