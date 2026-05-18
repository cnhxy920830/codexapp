import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ThreadHistoryStatus } from "./history";

export type DebugAppServerRequestStatus = "pending" | "completed" | "failed" | "timed-out";

export type DebugAppServerNotificationSeverity = "default" | "error" | "noisy";

export type DebugAppServerRequestRecord = {
  id: string;
  method: string;
  matchingRequestSequenceNumber: number;
  startedAtMs: number;
  endedAtMs: number | null;
  timeoutMs: number;
  paramsPreview: string;
  resultPreview: string | null;
  errorPreview: string | null;
  status: DebugAppServerRequestStatus;
  durationMs: number | null;
};

export type DebugAppServerNotificationRecord = {
  id: string;
  method: string;
  paramsPreview: string;
  receivedAtMs: number;
  severity: DebugAppServerNotificationSeverity;
  isNoisy: boolean;
  threadId: string | null;
};

export type DebugAppServerHostSnapshot = {
  hostId: string;
  appServerVersion: string | null;
  installedCodexVersion: string | null;
  requests: DebugAppServerRequestRecord[];
  notifications: DebugAppServerNotificationRecord[];
};

export type DebugAppServerSnapshotResponse = {
  hosts: DebugAppServerHostSnapshot[];
};

export type DebugAppServerHostUpdatedNotification = {
  host: DebugAppServerHostSnapshot;
};

export type DebugAppServerThreadResumeState = "resumed" | "resuming" | "needs_resume";

export type DebugAppServerThreadStreamRole = {
  role: "owner";
};

export type DebugAppServerThreadStatusEntry = {
  conversationId: string;
  lastTurnStatus: string | null;
  resumeState: DebugAppServerThreadResumeState;
  threadRuntimeStatus: ThreadHistoryStatus | null;
  title: string | null;
  updatedAt: number;
  streamRole: DebugAppServerThreadStreamRole | null;
};

export type DebugAppServerThreadStatusResponse = {
  entries: DebugAppServerThreadStatusEntry[];
  titlesByThreadId: Record<string, string>;
};

export type DebugAppServerThreadUnsubscribeStatus =
  | "notLoaded"
  | "notSubscribed"
  | "unsubscribed";

export type DebugAppServerThreadUnsubscribeResponse = {
  status: DebugAppServerThreadUnsubscribeStatus;
};

export async function readDebugAppServerSnapshot() {
  return invoke<DebugAppServerSnapshotResponse>("debug-app-server-snapshot");
}

export async function clearDebugAppServerRequests(hostId: string) {
  return invoke<void>("debug-app-server-clear-requests", {
    params: {
      hostId,
    },
  });
}

export async function clearDebugAppServerNotifications(hostId: string) {
  return invoke<void>("debug-app-server-clear-notifications", {
    params: {
      hostId,
    },
  });
}

export async function readDebugAppServerThreadStatusForHost(hostId: string) {
  return invoke<DebugAppServerThreadStatusResponse>("debug-app-server-thread-status-for-host", {
    params: {
      hostId,
    },
  });
}

export async function unsubscribeDebugAppServerThreadForHost(hostId: string, threadId: string) {
  return invoke<DebugAppServerThreadUnsubscribeResponse>("unsubscribe-thread-for-host", {
    params: {
      hostId,
      threadId,
    },
  });
}

export function onDebugAppServerHostUpdated(
  handler: (notification: DebugAppServerHostUpdatedNotification) => void,
) {
  return listen<DebugAppServerHostUpdatedNotification>("debug-app-server-host-updated", (event) => {
    handler(event.payload);
  });
}
