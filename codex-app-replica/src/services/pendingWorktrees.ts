import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const PENDING_WORKTREES_SHARED_OBJECT_KEY = "pending_worktrees";

type SharedObjectSnapshotResponse = {
  value: unknown;
};

type SharedObjectUpdatedNotification = {
  key: string;
  value: unknown;
};

export type PendingWorktreeEntry = {
  id: string;
  hostId: string;
  createdAt: number;
  sourceWorkspaceRoot: string;
  startConversationParamsInput: Record<string, unknown> | null;
};

export async function readPendingWorktreesSnapshot() {
  const response = await invoke<SharedObjectSnapshotResponse>("get-shared-object-snapshot", {
    key: PENDING_WORKTREES_SHARED_OBJECT_KEY,
  });
  return normalizePendingWorktreesSnapshot(response.value);
}

export function onPendingWorktreesUpdated(handler: (entries: PendingWorktreeEntry[]) => void) {
  return listen<SharedObjectUpdatedNotification>("shared-object-updated", (event) => {
    if (event.payload.key !== PENDING_WORKTREES_SHARED_OBJECT_KEY) {
      return;
    }
    handler(normalizePendingWorktreesSnapshot(event.payload.value));
  });
}

function normalizePendingWorktreesSnapshot(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PendingWorktreeEntry[];
  }

  return value
    .map(normalizePendingWorktreeEntry)
    .filter((entry): entry is PendingWorktreeEntry => entry !== null);
}

function normalizePendingWorktreeEntry(value: unknown): PendingWorktreeEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeNonEmptyString(record.id);
  const hostId = normalizeNonEmptyString(record.hostId);
  const sourceWorkspaceRoot = normalizeNonEmptyString(record.sourceWorkspaceRoot);
  if (id === null || hostId === null || sourceWorkspaceRoot === null) {
    return null;
  }

  return {
    id,
    hostId,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    sourceWorkspaceRoot,
    startConversationParamsInput: normalizeObject(record.startConversationParamsInput),
  };
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
