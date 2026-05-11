import { invoke } from "@tauri-apps/api/core";

export const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT = "debug-window-origin-conversation-changed";
export const DEBUG_WINDOW_ROUTE_PATH = "/debug";
export const EDITOR_DIFF_ROUTE_PATH = "/editor-diff";
export const FIRST_RUN_ROUTE_PATH = "/first-run";
export const LOGIN_ROUTE_PATH = "/login";
export const PLAN_SUMMARY_ROUTE_PATH = "/plan-summary";
export const SELECT_WORKSPACE_ROUTE_PATH = "/select-workspace";
export const WELCOME_ROUTE_PATH = "/welcome";

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

export async function notifyDebugWindowOriginConversationChanged(conversationId: string) {
  await invoke("debug-window-origin-conversation-changed", { conversationId });
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
