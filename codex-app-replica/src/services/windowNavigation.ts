import { invoke } from "@tauri-apps/api/core";

export const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT = "debug-window-origin-conversation-changed";
export const DEBUG_WINDOW_ROUTE_PATH = "/debug";
export const FIRST_RUN_ROUTE_PATH = "/first-run";
export const PLAN_SUMMARY_ROUTE_PATH = "/plan-summary";

export type PendingPlanSummaryState = {
  conversationId: string;
  planContent: string;
};

export async function showPlanSummary(params: PendingPlanSummaryState) {
  await invoke("show-plan-summary", { params });
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
