import type {
  ApprovalDecision,
  FileChangeSummary,
  GrantedPermissionProfile,
  JsonRpcId,
  McpServerElicitationRequestResponse,
  PermissionProfile,
  PermissionsRequestApprovalResponse,
  ToolRequestUserInputQuestion,
  ToolRequestUserInputResponse,
  ThreadConversationItem,
  ThreadEvent,
} from "../../services/history";

export type PendingApproval = Extract<
  ThreadEvent,
  { type: "commandApprovalRequested" } | { type: "fileChangeApprovalRequested" }
>;

export type PendingToolRequestUserInput = Extract<
  ThreadEvent,
  { type: "toolRequestUserInputRequested" }
>;

export type PendingPermissionsRequestApproval = Extract<
  ThreadEvent,
  { type: "permissionsRequestApprovalRequested" }
>;

export type PendingMcpServerElicitationRequest = Extract<
  ThreadEvent,
  { type: "mcpServerElicitationRequested" }
>;

export type PendingImplementPlanRequest = {
  requestId: string;
  threadId: string;
  turnId: string;
  planContent: string;
};

export type PlanImplementationItem = {
  id: string;
  threadId: string;
  turnId: string;
  planContent: string;
  isCompleted: boolean;
};

const defaultApprovalDecisions: ApprovalDecision[] = [
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
];

const implementPlanRequestPrefix = "implement-plan:";

export function approvalRequestKey(requestId: JsonRpcId) {
  return `${typeof requestId}:${requestId}`;
}

export function createPendingImplementPlanRequest(
  threadId: string,
  turnId: string,
  planContent: string,
): PendingImplementPlanRequest {
  return {
    requestId: `${implementPlanRequestPrefix}${turnId}`,
    threadId,
    turnId,
    planContent,
  };
}

export function createPlanImplementationItem(
  threadId: string,
  turnId: string,
  planContent: string,
  isCompleted: boolean,
): PlanImplementationItem {
  return {
    id: `${implementPlanRequestPrefix}${turnId}`,
    threadId,
    turnId,
    planContent,
    isCompleted,
  };
}

export function upsertPendingApproval(approvals: PendingApproval[], approval: PendingApproval) {
  const key = approvalRequestKey(approval.requestId);
  const index = approvals.findIndex((entry) => approvalRequestKey(entry.requestId) === key);
  if (index === -1) {
    return [...approvals, approval];
  }
  return approvals.map((entry, entryIndex) => (entryIndex === index ? approval : entry));
}

export function upsertPendingToolRequestUserInput(
  requests: PendingToolRequestUserInput[],
  request: PendingToolRequestUserInput,
) {
  const key = approvalRequestKey(request.requestId);
  const index = requests.findIndex((entry) => approvalRequestKey(entry.requestId) === key);
  if (index === -1) {
    return [...requests, request];
  }
  return requests.map((entry, entryIndex) => (entryIndex === index ? request : entry));
}

export function upsertPendingPermissionsRequestApproval(
  requests: PendingPermissionsRequestApproval[],
  request: PendingPermissionsRequestApproval,
) {
  const key = approvalRequestKey(request.requestId);
  const index = requests.findIndex((entry) => approvalRequestKey(entry.requestId) === key);
  if (index === -1) {
    return [...requests, request];
  }
  return requests.map((entry, entryIndex) => (entryIndex === index ? request : entry));
}

export function upsertPendingMcpServerElicitationRequest(
  requests: PendingMcpServerElicitationRequest[],
  request: PendingMcpServerElicitationRequest,
) {
  const key = approvalRequestKey(request.requestId);
  const index = requests.findIndex((entry) => approvalRequestKey(entry.requestId) === key);
  if (index === -1) {
    return [...requests, request];
  }
  return requests.map((entry, entryIndex) => (entryIndex === index ? request : entry));
}

export function upsertPendingImplementPlanRequest(
  requests: PendingImplementPlanRequest[],
  request: PendingImplementPlanRequest,
) {
  const index = requests.findIndex((entry) => entry.requestId === request.requestId);
  if (index === -1) {
    return [...requests, request];
  }
  return requests.map((entry, entryIndex) => (entryIndex === index ? request : entry));
}

export function upsertPlanImplementationItem(
  items: PlanImplementationItem[],
  item: PlanImplementationItem,
) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...items, item];
  }
  return items.map((entry, entryIndex) => (entryIndex === index ? item : entry));
}

export function clearPendingImplementPlanRequestsForThread(
  requests: PendingImplementPlanRequest[],
  threadId: string,
) {
  return requests.filter((request) => request.threadId !== threadId);
}

export function markPlanImplementationItemsCompletedForThread(
  items: PlanImplementationItem[],
  threadId: string,
) {
  return items.map((item) =>
    item.threadId === threadId && !item.isCompleted
      ? {
          ...item,
          isCompleted: true,
        }
      : item,
  );
}

export function removePendingImplementPlanRequest(
  requests: PendingImplementPlanRequest[],
  requestId: string,
) {
  return requests.filter((request) => request.requestId !== requestId);
}

export function markPlanImplementationItemCompleted(
  items: PlanImplementationItem[],
  requestId: string,
) {
  return items.map((item) =>
    item.id === requestId && !item.isCompleted
      ? {
          ...item,
          isCompleted: true,
        }
      : item,
  );
}

export function buildPendingImplementPlanRequestForTurn(
  threadId: string,
  items: ThreadConversationItem[],
  turnId: string,
) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.turnId !== turnId) {
      continue;
    }
    if (item.type !== "plan") {
      continue;
    }
    const planContent = item.text.trim();
    if (planContent.length === 0) {
      return null;
    }
    return createPendingImplementPlanRequest(threadId, turnId, planContent);
  }
  return null;
}

export function buildPlanImplementationItemForTurn(
  threadId: string,
  items: ThreadConversationItem[],
  turnId: string,
) {
  const request = buildPendingImplementPlanRequestForTurn(threadId, items, turnId);
  if (!request) {
    return null;
  }
  return createPlanImplementationItem(threadId, turnId, request.planContent, false);
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

export function createToolRequestUserInputResponse(
  questions: ToolRequestUserInputQuestion[],
  values: Record<string, string>,
): ToolRequestUserInputResponse {
  const answers = Object.fromEntries(
    questions.map((question) => [
      question.id,
      {
        answers: splitToolRequestUserInputAnswer(values[question.id] ?? ""),
      },
    ]),
  );
  return { answers };
}

export function createPermissionsRequestApprovalResponse(
  permissions: PermissionProfile,
  grantMode: "deny" | "turn" | "session",
  strictAutoReview: boolean,
): PermissionsRequestApprovalResponse {
  if (grantMode === "deny") {
    return {
      permissions: {},
      scope: "turn",
      ...(strictAutoReview ? { strictAutoReview: true } : {}),
    };
  }
  return {
    permissions: toGrantedPermissionProfile(permissions),
    scope: grantMode,
    ...(strictAutoReview ? { strictAutoReview: true } : {}),
  };
}

function toGrantedPermissionProfile(permissions: PermissionProfile): GrantedPermissionProfile {
  const granted: GrantedPermissionProfile = {};
  if (permissions.network !== null) {
    granted.network = permissions.network;
  }
  if (permissions.fileSystem !== null) {
    granted.fileSystem = permissions.fileSystem;
  }
  return granted;
}

export function createMcpServerElicitationRequestResponse(
  action: "accept" | "decline" | "cancel",
  content: unknown | null,
): McpServerElicitationRequestResponse {
  return {
    action,
    content,
    meta: null,
  };
}

function splitToolRequestUserInputAnswer(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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
    const counts = countFileChangeDiffLines(file.diff);
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

export function countFileChangeDiffLines(diff: string | null) {
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
