import { getGlobalState, setGlobalState } from "./settings";

export type WorktreesSettingsSnapshot = {
  autoCleanupEnabled: boolean;
  keepCount: number;
};

export const DEFAULT_WORKTREES_SETTINGS: WorktreesSettingsSnapshot = {
  autoCleanupEnabled: true,
  keepCount: 15,
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
