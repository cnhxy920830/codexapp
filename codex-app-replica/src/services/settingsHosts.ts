import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const LOCAL_SETTINGS_HOST_ID = "local";
export const REMOTE_CONNECTIONS_SHARED_OBJECT_KEY = "remote_connections";
export const REMOTE_PROJECTS_SHARED_OBJECT_KEY = "remote-projects";

const REMOTE_HOST_FORBIDDEN_HUE_RANGES = [
  { start: 330, end: 45 },
  { start: 95, end: 165 },
];
const REMOTE_HOST_COLOR_LIGHTNESS = 0.74;
const REMOTE_HOST_CHROMA_MIN = 0.09;
const REMOTE_HOST_CHROMA_MAX = 0.18;

export type RemoteConnection = {
  hostId: string;
  displayName: string;
  source: string;
  autoConnect: boolean;
  sshAlias: string | null;
  sshHost: string | null;
  sshPort: number | null;
  identity: string | null;
};

export type RemoteProject = {
  id: string;
  hostId: string;
  remotePath: string;
  label: string;
};

export type AppServerConnectionState = "connecting" | "restarting" | "connected" | "disconnected" | "error";

export type AppServerConnectionStateResponse = {
  state: AppServerConnectionState;
  error: unknown | null;
};

export type RemoteAppServerConnectionStateChangedNotification = {
  hostId: string;
  state: AppServerConnectionState;
  error: unknown | null;
};

type SharedObjectSnapshotResponse = {
  value: unknown;
};

export type SharedObjectUpdatedNotification = {
  key: string;
  value: unknown;
};

type SaveRemoteProjectResponse = {
  project: RemoteProject;
};

export async function readSettingsRemoteConnectionsSnapshot() {
  const response = await invoke<SharedObjectSnapshotResponse>("get-shared-object-snapshot", {
    key: REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  });
  return normalizeRemoteConnectionsSnapshot(response.value);
}

export async function readSettingsRemoteProjectsSnapshot() {
  const response = await invoke<SharedObjectSnapshotResponse>("get-shared-object-snapshot", {
    key: REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  });
  return normalizeRemoteProjectsSnapshot(response.value);
}

export function onSharedObjectUpdated(handler: (notification: SharedObjectUpdatedNotification) => void) {
  return listen<SharedObjectUpdatedNotification>("shared-object-updated", (event) => {
    handler(event.payload);
  });
}

export async function readAppServerConnectionState(hostId: string) {
  return invoke<AppServerConnectionStateResponse>("app-server-connection-state", {
    params: { hostId },
  });
}

export async function saveRemoteProject(params: { hostId: string; remotePath: string }) {
  return invoke<SaveRemoteProjectResponse>("save-remote-project", {
    params: {
      hostId: normalizeRequiredString(params.hostId),
      remotePath: normalizeRequiredString(params.remotePath),
    },
  });
}

export async function readConnectedSettingsRemoteConnections(remoteConnections: RemoteConnection[]) {
  const statesByHostId = await readSettingsRemoteConnectionStates(remoteConnections);
  return filterConnectedSettingsRemoteConnections(remoteConnections, statesByHostId);
}

export async function readSettingsRemoteConnectionStates(remoteConnections: RemoteConnection[]) {
  const states = await Promise.all(
    remoteConnections.map(async (remoteConnection) => {
      const response = await readAppServerConnectionState(remoteConnection.hostId).catch(() => null);
      return [remoteConnection.hostId, response?.state ?? "disconnected"] as const;
    }),
  );

  return Object.fromEntries(states);
}

export function filterConnectedSettingsRemoteConnections(
  remoteConnections: RemoteConnection[],
  statesByHostId: Record<string, AppServerConnectionState>,
) {
  return remoteConnections.filter((remoteConnection) => {
    return statesByHostId[remoteConnection.hostId] === "connected";
  });
}

export function onRemoteAppServerConnectionStateChanged(
  handler: (notification: RemoteAppServerConnectionStateChangedNotification) => void,
) {
  return listen<RemoteAppServerConnectionStateChangedNotification>(
    "remote-app-server-connection-state-changed",
    (event) => {
      handler(event.payload);
    },
  );
}

export function readInitialSettingsHostId() {
  if (typeof window === "undefined") {
    return LOCAL_SETTINGS_HOST_ID;
  }

  const hostId = new URLSearchParams(window.location.search).get("hostId")?.trim();
  return hostId && hostId.length > 0 ? hostId : LOCAL_SETTINGS_HOST_ID;
}

export function normalizeSelectedSettingsHostId(selectedHostId: string, connectedRemoteConnections: RemoteConnection[]) {
  if (selectedHostId === LOCAL_SETTINGS_HOST_ID) {
    return selectedHostId;
  }

  return connectedRemoteConnections.some((remoteConnection) => remoteConnection.hostId === selectedHostId)
    ? selectedHostId
    : LOCAL_SETTINGS_HOST_ID;
}

export function normalizeRemoteConnectionsSnapshot(value: unknown): RemoteConnection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeRemoteConnection).filter((remoteConnection): remoteConnection is RemoteConnection => {
    return remoteConnection !== null;
  });
}

export function normalizeRemoteProjectsSnapshot(value: unknown): RemoteProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeRemoteProject).filter((remoteProject): remoteProject is RemoteProject => {
    return remoteProject !== null;
  });
}

export function getSettingsRemoteHostColor(hostId: string, hostIdsForColorAssignment: string[]) {
  const hostColorsById = assignRemoteHostColors(hostIdsForColorAssignment);
  return hostColorsById[hostId];
}

function normalizeRemoteConnection(value: unknown): RemoteConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const remoteConnection = value as Record<string, unknown>;
  const hostId = normalizeNonEmptyString(remoteConnection.hostId);
  const displayName = normalizeNonEmptyString(remoteConnection.displayName);
  const source = normalizeNonEmptyString(remoteConnection.source);
  if (hostId === null || displayName === null || source === null) {
    return null;
  }

  return {
    hostId,
    displayName,
    source,
    autoConnect: remoteConnection.autoConnect === true,
    sshAlias: normalizeOptionalString(remoteConnection.sshAlias),
    sshHost: normalizeOptionalString(remoteConnection.sshHost),
    sshPort: typeof remoteConnection.sshPort === "number" ? remoteConnection.sshPort : null,
    identity: normalizeOptionalString(remoteConnection.identity),
  };
}

function normalizeRemoteProject(value: unknown): RemoteProject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const remoteProject = value as Record<string, unknown>;
  const id = normalizeNonEmptyString(remoteProject.id);
  const hostId = normalizeNonEmptyString(remoteProject.hostId);
  const remotePath = normalizeNonEmptyString(remoteProject.remotePath);
  const label = normalizeNonEmptyString(remoteProject.label);
  if (id === null || hostId === null || remotePath === null || label === null) {
    return null;
  }

  return {
    id,
    hostId,
    remotePath,
    label,
  };
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeRequiredString(value: string) {
  const normalized = normalizeNonEmptyString(value);
  if (normalized === null) {
    throw new Error("expected non-empty string");
  }
  return normalized;
}

function assignRemoteHostColors(hostIds: string[]) {
  const uniqueHostIds = [...new Set(hostIds)].sort((left, right) => left.localeCompare(right));
  const hostColorsById: Record<string, string> = {};
  const allowedHueRanges = buildAllowedHueRanges(REMOTE_HOST_FORBIDDEN_HUE_RANGES);
  const allowedHueSpan = allowedHueRanges.reduce((sum, range) => sum + (range.end - range.start), 0);
  if (allowedHueSpan === 0) {
    return hostColorsById;
  }

  uniqueHostIds.forEach((hostId, hostIndex) => {
    const hue = resolveHueForOffset(((hostIndex + 0.5) * allowedHueSpan) / uniqueHostIds.length, allowedHueRanges);
    const chroma = resolveHostChroma(uniqueHostIds.length, hostIndex);
    hostColorsById[hostId] = `oklch(${REMOTE_HOST_COLOR_LIGHTNESS} ${chroma} ${hue.toFixed(2)})`;
  });

  return hostColorsById;
}

function buildAllowedHueRanges(forbiddenHueRanges: Array<{ start: number; end: number }>) {
  const normalizedRanges = forbiddenHueRanges
    .flatMap((range) => {
      const start = ((range.start % 360) + 360) % 360;
      const end = ((range.end % 360) + 360) % 360;
      return start <= end ? [{ start, end }] : [{ start, end: 360 }, { start: 0, end }];
    })
    .sort((left, right) => left.start - right.start);

  if (normalizedRanges.length === 0) {
    return [{ start: 0, end: 360 }];
  }

  const mergedRanges: Array<{ start: number; end: number }> = [];
  normalizedRanges.forEach((range) => {
    const previousRange = mergedRanges.at(-1);
    if (previousRange === undefined || range.start > previousRange.end) {
      mergedRanges.push({ ...range });
      return;
    }
    previousRange.end = Math.max(previousRange.end, range.end);
  });

  const allowedRanges: Array<{ start: number; end: number }> = [];
  let currentStart = 0;
  mergedRanges.forEach((range) => {
    if (range.start > currentStart) {
      allowedRanges.push({ start: currentStart, end: range.start });
    }
    currentStart = range.end;
  });

  if (currentStart < 360) {
    allowedRanges.push({ start: currentStart, end: 360 });
  }

  return allowedRanges;
}

function resolveHueForOffset(offset: number, allowedHueRanges: Array<{ start: number; end: number }>) {
  let remainingOffset = offset;
  for (const range of allowedHueRanges) {
    const span = range.end - range.start;
    if (remainingOffset <= span) {
      return range.start + remainingOffset;
    }
    remainingOffset -= span;
  }

  return allowedHueRanges.at(-1)?.end ?? 0;
}

function resolveHostChroma(hostCount: number, hostIndex: number) {
  if (hostCount <= 1) {
    return (REMOTE_HOST_CHROMA_MIN + REMOTE_HOST_CHROMA_MAX) / 2;
  }

  return REMOTE_HOST_CHROMA_MIN + ((REMOTE_HOST_CHROMA_MAX - REMOTE_HOST_CHROMA_MIN) / (hostCount - 1)) * hostIndex;
}
