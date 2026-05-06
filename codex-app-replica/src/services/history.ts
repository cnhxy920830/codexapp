import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ThreadHistoryEntry = {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  path: string | null;
  name: string | null;
};

export type HistoryThreadView = {
  id: string;
  title: string;
  age: string;
  active?: boolean;
};

export type HistoryProjectGroup = {
  name: string;
  threads: HistoryThreadView[];
};

export type ThreadConversationMessage = {
  type: "userMessage" | "agentMessage";
  id: string;
  turnId: string;
  role: "user" | "assistant";
  text: string;
};

export type ThreadCommandAction =
  | {
      type: "read";
      command: string;
      name: string;
      path: string;
    }
  | {
      type: "listFiles";
      command: string;
      path: string | null;
    }
  | {
      type: "search";
      command: string;
      query: string | null;
      path: string | null;
    }
  | {
      type: "unknown";
      command: string;
    };

export type ThreadConversationCommandExecution = {
  type: "commandExecution";
  id: string;
  turnId: string;
  command: string;
  cwd: string;
  status: string;
  commandActions: ThreadCommandAction[];
  aggregatedOutput: string | null;
  exitCode: number | null;
  durationMs: number | null;
};

export type ThreadConversation = {
  id: string;
  title: string;
  cwd: string;
  items: ThreadConversationItem[];
};

export type JsonRpcId = number | string;

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type FileChangeSummary = {
  path: string;
  kind: string;
  diff: string | null;
  movePath: string | null;
};

export type ThreadConversationFileChange = {
  type: "fileChange";
  id: string;
  turnId: string;
  status: string;
  changes: FileChangeSummary[];
};

export type ThreadConversationEnteredReviewMode = {
  type: "enteredReviewMode";
  id: string;
  turnId: string;
  review: string;
};

export type ThreadConversationExitedReviewMode = {
  type: "exitedReviewMode";
  id: string;
  turnId: string;
  review: string;
};

export type ThreadConversationItem =
  | ThreadConversationMessage
  | ThreadConversationCommandExecution
  | ThreadConversationFileChange
  | ThreadConversationEnteredReviewMode
  | ThreadConversationExitedReviewMode;

export type ThreadEvent =
  | {
      type: "threadItemUpdated";
      threadId: string;
      turnId: string;
      item: ThreadConversationItem;
    }
  | {
      type: "turnCompleted";
      threadId: string;
      turnId: string;
      status: string;
      error: string | null;
    }
  | {
      type: "commandApprovalRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      reason: string | null;
      command: string | null;
      cwd: string | null;
      availableDecisions: ApprovalDecision[] | null;
    }
  | {
      type: "fileChangeApprovalRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      reason: string | null;
      grantRoot: string | null;
      changes: FileChangeSummary[];
    }
  | {
      type: "serverRequestResolved";
      requestId: JsonRpcId;
      threadId: string;
    };

export type ReviewDelivery = "inline" | "detached";

export type ReviewStartResponse = {
  turnId: string;
  reviewThreadId: string;
};

export async function getRecentThreads() {
  return invoke<ThreadHistoryEntry[]>("list_recent_threads");
}

export async function getArchivedThreads() {
  return invoke<ThreadHistoryEntry[]>("list_archived_threads");
}

export async function startThread(cwd: string | null) {
  return invoke<string>("start_thread", { cwd });
}

export async function forkThread(threadId: string) {
  return invoke<string>("fork_thread", { threadId });
}

export async function archiveThread(threadId: string) {
  return invoke<void>("archive_thread", { threadId });
}

export async function unarchiveThread(threadId: string) {
  return invoke<string>("unarchive_thread", { threadId });
}

export async function setThreadName(params: { threadId: string; name: string | null }) {
  return invoke<void>("set_thread_name", params);
}

export async function startTurn(params: { threadId: string; text: string; cwd: string | null }) {
  return invoke<string>("start_turn", params);
}

export async function startReview(params: { threadId: string; delivery: ReviewDelivery }) {
  return invoke<ReviewStartResponse>("start_review", { params });
}

export async function steerTurn(params: { threadId: string; turnId: string; text: string }) {
  return invoke<string>("steer_turn", params);
}

export async function interruptTurn(params: { threadId: string; turnId: string }) {
  return invoke<void>("interrupt_turn", params);
}

export async function respondToApprovalRequest(params: { requestId: JsonRpcId; decision: ApprovalDecision }) {
  return invoke<void>("respond_to_approval_request", params);
}

export async function readThread(threadId: string) {
  return invoke<ThreadConversation>("read_thread", { threadId });
}

export function onThreadEvent(handler: (event: ThreadEvent) => void) {
  return listen<ThreadEvent>("thread-event", (event) => {
    handler(event.payload);
  });
}

export function buildProjectGroups(
  entries: ThreadHistoryEntry[],
  options?: { activeThreadId?: string | null; locale?: string; now?: Date; noMessageLabel?: string },
) {
  const now = options?.now ?? new Date();
  const activeThreadId = options?.activeThreadId ?? null;
  const locale = options?.locale ?? "en-US";
  const noMessageLabel = options?.noMessageLabel ?? "(no message yet)";
  const groups = new Map<string, HistoryProjectGroup>();

  for (const entry of entries) {
    const groupName = deriveProjectName(entry.cwd);
    const current = groups.get(groupName) ?? { name: groupName, threads: [] };
    current.threads.push({
      id: entry.id,
      title: (entry.name ?? entry.preview).trim() || noMessageLabel,
      age: formatRelativeTime(entry.updatedAt, now, locale),
      active: activeThreadId === entry.id,
    });
    groups.set(groupName, current);
  }

  return Array.from(groups.values());
}

function deriveProjectName(cwd: string) {
  const segments = cwd.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? cwd;
}

function formatRelativeTime(unixSeconds: number, now: Date, locale: string) {
  const diffMs = now.getTime() - unixSeconds * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMs < minute) {
    return formatter.format(0, "minute");
  }
  if (diffMs < hour) {
    return formatter.format(-Math.floor(diffMs / minute), "minute");
  }
  if (diffMs < day) {
    return formatter.format(-Math.floor(diffMs / hour), "hour");
  }
  return formatter.format(-Math.floor(diffMs / day), "day");
}
