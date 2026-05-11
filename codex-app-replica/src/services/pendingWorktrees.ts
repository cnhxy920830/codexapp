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
  phase: PendingWorktreePhase;
  labelEdited: boolean;
  outputText: string;
  errorMessage: string | null;
  worktreeWorkspaceRoot: string | null;
  worktreeGitRoot: string | null;
  needsAttention: boolean;
  isPinned: boolean;
  pinnedBeforeThreadId: string | null;
  label: string | null;
  initialThreadTitle: string | null;
  sourceWorkspaceRoot: string;
  startingState: PendingWorktreeStartingState | null;
  localEnvironmentConfigPath: string | null;
  prompt: string;
  launchMode: PendingWorktreeLaunchMode;
  startConversationParamsInput: Record<string, unknown> | null;
  threadGoalObjective: string | null;
  sourceConversationId: string | null;
  sourceCollaborationMode: Record<string, unknown> | null;
  targetTurnId: string | null;
};

export type PendingWorktreePhase = "queued" | "creating" | "worktree-ready" | "failed";
export type PendingWorktreeLaunchMode = "create-stable-worktree" | "fork-conversation" | "start-conversation";
export type PendingWorktreeStartingState =
  | { type: "working-tree" }
  | { type: "branch"; branchName: string };

export type PendingWorktreeMetadataUpdate =
  | { type: "isPinned"; isPinned: boolean }
  | { type: "pinnedBeforeThreadId"; beforeThreadId: string | null }
  | { type: "label"; label: string }
  | { type: "labelEdited"; labelEdited: boolean }
  | { type: "needsAttention"; needsAttention: boolean };

export async function readPendingWorktreesSnapshot() {
  const response = await invoke<SharedObjectSnapshotResponse>("get-shared-object-snapshot", {
    key: PENDING_WORKTREES_SHARED_OBJECT_KEY,
  });
  return normalizePendingWorktreesSnapshot(response.value);
}

export async function updatePendingWorktreeMetadata(params: {
  hostId: string;
  id: string;
  update: PendingWorktreeMetadataUpdate;
}) {
  await invoke<void>("pending-worktree-update-metadata", params);
}

export async function retryPendingWorktree(params: { hostId: string; id: string }) {
  await invoke<void>("pending-worktree-retry", params);
}

export async function cancelPendingWorktree(params: { hostId: string; id: string }) {
  await invoke<void>("pending-worktree-cancel", params);
}

export async function dismissPendingWorktree(params: { hostId: string; id: string }) {
  await invoke<void>("pending-worktree-dismiss", params);
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
  const phase = normalizePendingWorktreePhase(record.phase);
  const sourceWorkspaceRoot = normalizeNonEmptyString(record.sourceWorkspaceRoot);
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const launchMode = normalizePendingWorktreeLaunchMode(record.launchMode);
  if (id === null || hostId === null || phase === null || sourceWorkspaceRoot === null || launchMode === null) {
    return null;
  }

  return {
    id,
    hostId,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    phase,
    labelEdited: record.labelEdited === true,
    outputText: typeof record.outputText === "string" ? record.outputText : "",
    errorMessage: normalizeOptionalString(record.errorMessage),
    worktreeWorkspaceRoot: normalizeOptionalString(record.worktreeWorkspaceRoot),
    worktreeGitRoot: normalizeOptionalString(record.worktreeGitRoot),
    needsAttention: record.needsAttention === true,
    isPinned: record.isPinned === true,
    pinnedBeforeThreadId: normalizeOptionalString(record.pinnedBeforeThreadId),
    label: normalizeOptionalString(record.label),
    initialThreadTitle: normalizeOptionalString(record.initialThreadTitle),
    sourceWorkspaceRoot,
    startingState: normalizePendingWorktreeStartingState(record.startingState),
    localEnvironmentConfigPath: normalizeOptionalString(record.localEnvironmentConfigPath),
    prompt,
    launchMode,
    startConversationParamsInput: normalizeObject(record.startConversationParamsInput),
    threadGoalObjective: normalizeOptionalString(record.threadGoalObjective),
    sourceConversationId: normalizeOptionalString(record.sourceConversationId),
    sourceCollaborationMode: normalizeObject(record.sourceCollaborationMode),
    targetTurnId: normalizeOptionalString(record.targetTurnId),
  };
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePendingWorktreePhase(value: unknown): PendingWorktreePhase | null {
  switch (value) {
    case "queued":
    case "creating":
    case "worktree-ready":
    case "failed":
      return value;
    default:
      return null;
  }
}

function normalizePendingWorktreeLaunchMode(value: unknown): PendingWorktreeLaunchMode | null {
  switch (value) {
    case "create-stable-worktree":
    case "fork-conversation":
    case "start-conversation":
      return value;
    default:
      return null;
  }
}

function normalizePendingWorktreeStartingState(value: unknown): PendingWorktreeStartingState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "working-tree":
      return { type: "working-tree" };
    case "branch": {
      const branchName = normalizeNonEmptyString(record.branchName);
      return branchName === null ? null : { type: "branch", branchName };
    }
    default:
      return null;
  }
}
