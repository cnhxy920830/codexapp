import { invoke } from "@tauri-apps/api/core";

export const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT = "debug-window-origin-conversation-changed";
export const AVATAR_OVERLAY_ROUTE_PATH = "/avatar-overlay";
export const DEBUG_WINDOW_ROUTE_PATH = "/debug";
export const EDITOR_DIFF_ROUTE_PATH = "/editor-diff";
export const FIRST_RUN_ROUTE_PATH = "/first-run";
export const GLOBAL_DICTATION_ROUTE_PATH = "/global-dictation";
export const HOTKEY_HOME_ROUTE_PATH = "/hotkey-window";
export const HOTKEY_NEW_THREAD_ROUTE_PATH = "/hotkey-window/new-thread";
export const HOTKEY_WORKTREE_INIT_V2_ROUTE_PREFIX = "/hotkey-window/worktree-init-v2/";
export const LOGIN_ROUTE_PATH = "/login";
export const PLAN_SUMMARY_ROUTE_PATH = "/plan-summary";
export const SELECT_WORKSPACE_ROUTE_PATH = "/select-workspace";
export const WELCOME_ROUTE_PATH = "/welcome";
export const WORKTREE_INIT_V2_ROUTE_PREFIX = "/worktree-init-v2/";

export type PendingPlanSummaryState = {
  conversationId: string;
  planContent: string;
};

export type ShowDiffParams = {
  conversationId: string;
  unifiedDiff: string;
  cwd: string | null;
};

export type UpdateDiffIfOpenParams = {
  conversationId: string;
  unifiedDiff: string;
};

export type SetPrimaryWindowModeParams = {
  mode: "app" | "onboarding";
  onboardingVariant?: "v2";
};

export async function showPlanSummary(params: PendingPlanSummaryState) {
  await invoke("show-plan-summary", { params });
}

export async function showDiff(params: ShowDiffParams) {
  await invoke("show-diff", { params });
}

export async function updateDiffIfOpen(params: UpdateDiffIfOpenParams) {
  await invoke("update-diff-if-open", { params });
}

export async function openDebugWindow() {
  await invoke("open-debug-window");
}

export async function showSettings(section: string) {
  await invoke("show-settings", { section });
}

export async function openInMainWindow(path: string) {
  await invoke("open-in-main-window", { path });
}

export async function openInNewWindow(params: {
  hostId: string | null;
  path: string;
}) {
  await invoke("open-in-new-window", { params });
}

export async function openInHotkeyWindow(path: string) {
  await invoke("open-in-hotkey-window", {
    params: { path },
  });
}

export async function notifyDebugWindowOriginConversationChanged(conversationId: string) {
  await invoke("debug-window-origin-conversation-changed", { conversationId });
}

export async function setPrimaryWindowMode(params: SetPrimaryWindowModeParams) {
  await invoke("electron-set-window-mode", { params });
}

export async function takePendingDebugWindowOriginConversation() {
  return invoke<string | null>("take_pending_debug_window_origin_conversation");
}

export async function takePendingPlanSummary() {
  return invoke<PendingPlanSummaryState | null>("take_pending_plan_summary");
}

export async function takePendingWindowRoute() {
  return invoke<string | null>("take_pending_window_route");
}

export function buildWorktreeInitV2RoutePath(
  pendingWorktreeId: string,
  shell: "default" | "hotkey" = "default",
) {
  const normalizedId = encodeURIComponent(pendingWorktreeId.trim());
  return shell === "hotkey"
    ? `${HOTKEY_WORKTREE_INIT_V2_ROUTE_PREFIX}${normalizedId}`
    : `${WORKTREE_INIT_V2_ROUTE_PREFIX}${normalizedId}`;
}
