import { invoke } from "@tauri-apps/api/core";

export type AutomationStatus = "ACTIVE" | "PAUSED" | "DELETED";
export type AutomationInboxItemStatus = "IN_PROGRESS" | "ARCHIVED" | null;
export type AutomationDeleteStatus =
  | "deleted"
  | "not_found"
  | "invalid_id"
  | "store_unavailable"
  | "state_cleanup_failed"
  | "remove_failed";

export const AUTOMATION_UPDATE_MISSING_MESSAGE =
  "Automation does not exist in the app and could not be updated. It may have been deleted manually by the user.";

type AutomationTimestamps = {
  createdAt: number | null;
  updatedAt: number | null;
  lastRunAt: number | null;
  nextRunAt: number | null;
};

export type HeartbeatAutomationRecord = {
  kind: "heartbeat";
  id: string;
  name: string;
  prompt: string;
  status: AutomationStatus;
  targetThreadId: string;
  model: string | null;
  reasoningEffort: string | null;
  rrule: string;
} & AutomationTimestamps;

export type CronAutomationRecord = {
  kind: "cron";
  id: string;
  name: string;
  prompt: string;
  status: AutomationStatus;
  cwds: string[];
  executionEnvironment: string;
  localEnvironmentConfigPath: string | null;
  model: string | null;
  reasoningEffort: string | null;
  rrule: string;
} & AutomationTimestamps;

export type AutomationRecord = HeartbeatAutomationRecord | CronAutomationRecord;

export type SaveAutomationParams = {
  automation: AutomationRecord;
};

export type AutomationThreadRunResult = {
  threadId: string;
  turnId: string;
};

export type AutomationInboxItem = {
  id: string;
  automationId: string;
  automationName: string | null;
  title: string | null;
  sourceCwd: string | null;
  threadId: string | null;
  readAt: number | null;
  createdAt: number;
  status: AutomationInboxItemStatus;
};

export type AutomationDeleteResult = {
  item: AutomationRecord | null;
  success: boolean;
  status: AutomationDeleteStatus;
};

export type HeartbeatAutomationThreadStateChangedParams = {
  threadId: string | null;
  isEligible: boolean;
  collaborationMode: {
    approvalPolicy: string | null;
    approvalsReviewer: string | null;
    sandboxPolicy: unknown | null;
  } | null;
  permissions: {
    network: {
      enabled: boolean | null;
    } | null;
    fileSystem: {
      read: string[] | null;
      write: string[] | null;
      entries: Array<{
        path: string;
        access: string;
      }> | null;
    } | null;
  } | null;
  reason: string | null;
};

export async function listAutomations() {
  const response = await invoke<{ items: AutomationRecord[] }>("list_automations");
  return response.items;
}

export async function readAutomation(id: string) {
  return invoke<AutomationRecord | null>("read_automation", { params: { id } });
}

export async function saveAutomation(params: SaveAutomationParams) {
  return invoke<AutomationRecord>("save_automation", { params });
}

export async function createAutomation(automation: AutomationRecord) {
  const response = await invoke<{ item: AutomationRecord }>("automation-create", {
    params: automation,
  });
  return response.item;
}

export async function updateAutomation(automation: AutomationRecord) {
  const response = await invoke<{ item: AutomationRecord }>("automation-update", {
    params: automation,
  });
  return response.item;
}

export async function setAutomationStatus(id: string, status: AutomationStatus) {
  return invoke<AutomationRecord>("set_automation_status", { params: { id, status } });
}

export async function deleteAutomation(id: string) {
  return invoke<void>("delete_automation", { params: { id } });
}

export async function deleteAutomationCompat(id: string) {
  return invoke<AutomationDeleteResult>("automation-delete", { params: { id } });
}

export async function runAutomationNow(id: string) {
  return invoke<AutomationThreadRunResult>("run_automation_now", { params: { id } });
}

export async function listInboxItems(limit = 200) {
  const response = await invoke<{ items: AutomationInboxItem[] }>("inbox-items", {
    params: { limit },
  });
  return response.items;
}

export async function setInboxItemReadState(id: string, isRead: boolean) {
  return invoke<void>("inbox-item-set-read-state", {
    params: { id, isRead },
  });
}

export async function notifyHeartbeatAutomationThreadStateChanged(
  params: HeartbeatAutomationThreadStateChangedParams,
) {
  return invoke<void>("heartbeat-automation-thread-state-changed", { params });
}

export function buildAutomationDraft(kind: AutomationRecord["kind"]): AutomationRecord {
  const id = crypto.randomUUID();
  if (kind === "heartbeat") {
    return {
      kind: "heartbeat",
      id,
      name: "",
      prompt: "",
      status: "ACTIVE",
      createdAt: null,
      updatedAt: null,
      lastRunAt: null,
      nextRunAt: null,
      targetThreadId: "",
      model: null,
      reasoningEffort: null,
      rrule: "FREQ=MINUTELY;INTERVAL=30",
    };
  }

  return {
    kind: "cron",
    id,
    name: "",
    prompt: "",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    cwds: [],
    executionEnvironment: "worktree",
    localEnvironmentConfigPath: null,
    model: null,
    reasoningEffort: null,
    rrule: "FREQ=DAILY;INTERVAL=1",
  };
}
