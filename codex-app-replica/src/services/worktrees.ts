import { invoke } from "@tauri-apps/api/core";
import { getGlobalState, setGlobalState } from "./settings";
import { LOCAL_SETTINGS_HOST_ID } from "./settingsHosts";

export type WorktreesSettingsSnapshot = {
  autoCleanupEnabled: boolean;
  keepCount: number;
};

export const DEFAULT_WORKTREES_SETTINGS: WorktreesSettingsSnapshot = {
  autoCleanupEnabled: true,
  keepCount: 15,
};

export type CodexWorktreeEntry = {
  dir: string;
  gitDir: string;
};

export type CodexWorktreesResponse = {
  worktrees: CodexWorktreeEntry[];
};

const AUTO_CLEANUP_KEY = "worktree-auto-cleanup-enabled";
const KEEP_COUNT_KEY = "worktree-keep-count";

export async function readWorktreesSettingsSnapshot(): Promise<WorktreesSettingsSnapshot> {
  const [autoCleanupEnabled, keepCount] = await Promise.all([
    getGlobalState(AUTO_CLEANUP_KEY),
    getGlobalState(KEEP_COUNT_KEY),
  ]);

  return {
    autoCleanupEnabled:
      typeof autoCleanupEnabled.value === "boolean"
        ? autoCleanupEnabled.value
        : DEFAULT_WORKTREES_SETTINGS.autoCleanupEnabled,
    keepCount:
      typeof keepCount.value === "number" && Number.isFinite(keepCount.value) && keepCount.value >= 1
        ? Math.trunc(keepCount.value)
        : DEFAULT_WORKTREES_SETTINGS.keepCount,
  };
}

export async function setWorktreesAutoCleanupEnabled(value: boolean) {
  return setGlobalState(AUTO_CLEANUP_KEY, value);
}

export async function setWorktreesKeepCount(value: number) {
  return setGlobalState(KEEP_COUNT_KEY, value);
}

export async function readCodexWorktrees(params: {
  hostId?: string | null;
  operationSource: string;
}) {
  return invoke<CodexWorktreesResponse>("codex-worktrees", {
    params: {
      hostConfig: {
        id: normalizeHostId(params.hostId) ?? LOCAL_SETTINGS_HOST_ID,
      },
      operationSource: params.operationSource,
    },
  });
}

export async function deleteWorktree(params: {
  hostId?: string | null;
  worktree: string;
  reason: string;
}) {
  return invoke<void>("worktree-delete", {
    params: {
      hostId: normalizeHostId(params.hostId),
      worktree: params.worktree,
      reason: params.reason,
    },
  });
}

export async function setWorktreeOwnerThread(params: {
  hostId?: string | null;
  worktree: string;
  conversationId: string;
}) {
  return invoke<void>("worktree-set-owner-thread", {
    params: {
      hostId: params.hostId ?? null,
      worktree: params.worktree,
      conversationId: params.conversationId,
    },
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  if (!trimmed || trimmed === LOCAL_SETTINGS_HOST_ID) {
    return null;
  }
  return trimmed;
}
