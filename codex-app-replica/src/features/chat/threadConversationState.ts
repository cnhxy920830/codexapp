import type {
  ApprovalDecision,
  FileChangeSummary,
  JsonRpcId,
  ThreadConversationItem,
  ThreadEvent,
} from "../../services/history";

export type PendingApproval = Extract<
  ThreadEvent,
  { type: "commandApprovalRequested" } | { type: "fileChangeApprovalRequested" }
>;

const defaultApprovalDecisions: ApprovalDecision[] = [
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
];

export function approvalRequestKey(requestId: JsonRpcId) {
  return `${typeof requestId}:${requestId}`;
}

export function upsertPendingApproval(approvals: PendingApproval[], approval: PendingApproval) {
  const key = approvalRequestKey(approval.requestId);
  const index = approvals.findIndex((entry) => approvalRequestKey(entry.requestId) === key);
  if (index === -1) {
    return [...approvals, approval];
  }
  return approvals.map((entry, entryIndex) => (entryIndex === index ? approval : entry));
}

export function resolveApprovalDecisions(approval: PendingApproval) {
  if (approval.type !== "commandApprovalRequested" || approval.availableDecisions === null) {
    return defaultApprovalDecisions;
  }
  const decisions = approval.availableDecisions.filter(
    (value): value is ApprovalDecision =>
      value === "accept" ||
      value === "acceptForSession" ||
      value === "decline" ||
      value === "cancel",
  );
  if (decisions.length === 0) {
    return defaultApprovalDecisions;
  }
  return Array.from(new Set(decisions));
}

export function upsertConversationItem(
  items: ThreadConversationItem[],
  item: ThreadConversationItem,
) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...items, item];
  }
  return items.map((entry, entryIndex) => (entryIndex === index ? item : entry));
}

export type ThreadDiffSummary = {
  fileCount: number;
  linesAdded: number;
  linesDeleted: number;
  files: FileChangeSummary[];
  hasChanges: boolean;
};

export function buildThreadDiffSummary(items: ThreadConversationItem[]): ThreadDiffSummary {
  const latestTurnId = items.at(-1)?.turnId ?? null;
  if (!latestTurnId) {
    return emptyThreadDiffSummary();
  }
  const files = items
    .filter(
      (item): item is Extract<ThreadConversationItem, { type: "fileChange" }> =>
        item.type === "fileChange" && item.turnId === latestTurnId,
    )
    .flatMap((item) => item.changes);
  if (files.length === 0) {
    return emptyThreadDiffSummary();
  }
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const file of files) {
    const counts = countDiffLines(file.diff);
    linesAdded += counts.linesAdded;
    linesDeleted += counts.linesDeleted;
  }
  return {
    fileCount: files.length,
    linesAdded,
    linesDeleted,
    files,
    hasChanges: true,
  };
}

function emptyThreadDiffSummary(): ThreadDiffSummary {
  return {
    fileCount: 0,
    linesAdded: 0,
    linesDeleted: 0,
    files: [],
    hasChanges: false,
  };
}

function countDiffLines(diff: string | null) {
  if (!diff) {
    return { linesAdded: 0, linesDeleted: 0 };
  }
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }
    if (line.startsWith("+")) {
      linesAdded += 1;
      continue;
    }
    if (line.startsWith("-")) {
      linesDeleted += 1;
    }
  }
  return { linesAdded, linesDeleted };
}
