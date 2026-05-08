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
  ThreadConversation,
  ThreadConversationItem,
  ThreadConversationMcpServerElicitation,
  ThreadConversationMessage,
  ThreadConversationPermissionRequest,
  ThreadConversationSteered,
  ThreadConversationSteeringUserMessage,
  ThreadConversationTurnTiming,
  ThreadConversationUserInputRequest,
  ThreadEvent,
} from "../../services/history";
import type { QueuedLocalFollowUp } from "./localFollowUpQueue";

type UserMessageItem = ThreadConversationMessage & {
  type: "userMessage";
  role: "user";
};

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

const defaultApprovalDecisions: ApprovalDecision[] = [
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
];

const implementPlanRequestPrefix = "implement-plan:";
const steeringUserMessagePrefix = "steering-user-message:";
const steeredPrefix = "steered:";

type TurnTimingUpdate = Partial<
  Pick<
    ThreadConversationTurnTiming,
    "status" | "turnStartedAtMs" | "finalAssistantStartedAtMs" | "firstTurnWorkItemStartedAtMs"
  >
>;

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

export function keepLatestTurnScopedPendingRequests<T extends { turnId: string | null | undefined }>(
  requests: T[],
) {
  const seenTurnIds = new Set<string>();
  const filteredRequests: T[] = [];

  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const request = requests[index];
    if (!request.turnId) {
      filteredRequests.unshift(request);
      continue;
    }
    if (seenTurnIds.has(request.turnId)) {
      continue;
    }
    seenTurnIds.add(request.turnId);
    filteredRequests.unshift(request);
  }

  return filteredRequests;
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

export function clearPendingImplementPlanRequestsForThread(
  requests: PendingImplementPlanRequest[],
  threadId: string,
) {
  return requests.filter((request) => request.threadId !== threadId);
}

export function removePendingImplementPlanRequest(
  requests: PendingImplementPlanRequest[],
  requestId: string,
) {
  return requests.filter((request) => request.requestId !== requestId);
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

export function createPermissionRequestConversationItem(
  request: PendingPermissionsRequestApproval,
): ThreadConversationPermissionRequest {
  return {
    type: "permissionRequest",
    id: permissionRequestConversationItemId(request.requestId),
    turnId: request.turnId,
    requestId: request.requestId,
    itemId: request.itemId,
    cwd: request.cwd,
    reason: request.reason,
    permissions: request.permissions,
    completed: false,
    response: null,
  };
}

export function createMcpServerElicitationConversationItem(
  request: PendingMcpServerElicitationRequest,
): ThreadConversationMcpServerElicitation {
  return {
    type: "mcpServerElicitation",
    id: mcpServerElicitationConversationItemId(request.requestId),
    turnId: request.turnId,
    requestId: request.requestId,
    serverName: request.serverName,
    request: request.request,
    completed: false,
    action: null,
    content: null,
  };
}

export function createUserInputConversationItem(
  request: PendingToolRequestUserInput,
): ThreadConversationUserInputRequest {
  return {
    type: "userInput",
    id: userInputConversationItemId(request.requestId),
    turnId: request.turnId,
    requestId: request.requestId,
    itemId: request.itemId,
    questions: request.questions,
    completed: false,
  };
}

export function upsertPermissionRequestConversationItem(
  items: ThreadConversationItem[],
  request: PendingPermissionsRequestApproval,
) {
  return upsertConversationItem(items, createPermissionRequestConversationItem(request));
}

export function upsertMcpServerElicitationConversationItem(
  items: ThreadConversationItem[],
  request: PendingMcpServerElicitationRequest,
) {
  return upsertConversationItem(items, createMcpServerElicitationConversationItem(request));
}

export function upsertUserInputConversationItem(
  items: ThreadConversationItem[],
  request: PendingToolRequestUserInput,
) {
  return upsertConversationItem(items, createUserInputConversationItem(request));
}

export function completePermissionRequestConversationItem(
  items: ThreadConversationItem[],
  requestId: JsonRpcId,
  response: PermissionsRequestApprovalResponse,
) {
  const conversationItemId = permissionRequestConversationItemId(requestId);
  return items.map((item) =>
    item.type === "permissionRequest" && item.id === conversationItemId
      ? {
          ...item,
          completed: true,
          response,
        }
      : item,
  );
}

export function completeMcpServerElicitationConversationItem(
  items: ThreadConversationItem[],
  requestId: JsonRpcId,
  response: McpServerElicitationRequestResponse,
) {
  const conversationItemId = mcpServerElicitationConversationItemId(requestId);
  return items.map((item) =>
    item.type === "mcpServerElicitation" && item.id === conversationItemId
      ? {
          ...item,
          completed: true,
          action: response.action,
          content: response.content,
        }
      : item,
  );
}

export function removeRequestConversationItem(
  items: ThreadConversationItem[],
  requestId: JsonRpcId,
) {
  const requestKey = approvalRequestKey(requestId);
  return items.filter((item) => {
    if (
      item.type === "permissionRequest" ||
      item.type === "mcpServerElicitation" ||
      item.type === "userInput"
    ) {
      return approvalRequestKey(item.requestId) !== requestKey;
    }
    return true;
  });
}

export function createSteeringUserMessage(params: {
  threadId: string;
  turnId: string;
  text: string;
  cwd: string | null;
}): ThreadConversationSteeringUserMessage {
  return {
    type: "steeringUserMessage",
    id: `${steeringUserMessagePrefix}${createQueuedLocalFollowUpId()}`,
    turnId: params.turnId,
    status: "pending",
    text: params.text,
    cwd: params.cwd,
  };
}

export function createSteeredItem(
  userMessage: UserMessageItem,
): ThreadConversationSteered {
  return {
    type: "steered",
    id: `${steeredPrefix}${userMessage.id}`,
    turnId: userMessage.turnId,
  };
}

export function appendSteeringUserMessage(
  conversation: ThreadConversation,
  steeringItem: ThreadConversationSteeringUserMessage,
): ThreadConversation {
  return {
    ...conversation,
    items: [...conversation.items, steeringItem],
  };
}

export function upsertThreadConversationTurnTiming(
  conversation: ThreadConversation,
  turnId: string,
  update: TurnTimingUpdate,
): ThreadConversation {
  const index = conversation.turnTimings.findIndex((entry) => entry.turnId === turnId);
  if (index === -1) {
    return {
      ...conversation,
      turnTimings: [
        ...conversation.turnTimings,
        {
          turnId,
          status: update.status ?? "completed",
          turnStartedAtMs: update.turnStartedAtMs ?? null,
          finalAssistantStartedAtMs: update.finalAssistantStartedAtMs ?? null,
          firstTurnWorkItemStartedAtMs: update.firstTurnWorkItemStartedAtMs ?? null,
        },
      ],
    };
  }

  const currentTiming = conversation.turnTimings[index];
  const nextTiming: ThreadConversationTurnTiming = {
    ...currentTiming,
    ...update,
  };

  if (
    nextTiming.status === currentTiming.status &&
    nextTiming.turnStartedAtMs === currentTiming.turnStartedAtMs &&
    nextTiming.finalAssistantStartedAtMs === currentTiming.finalAssistantStartedAtMs &&
    nextTiming.firstTurnWorkItemStartedAtMs === currentTiming.firstTurnWorkItemStartedAtMs
  ) {
    return conversation;
  }

  return {
    ...conversation,
    turnTimings: conversation.turnTimings.map((entry, entryIndex) => (entryIndex === index ? nextTiming : entry)),
  };
}

export function isWorkStartedConversationItem(item: ThreadConversationItem) {
  return item.type !== "userMessage" && item.type !== "hook";
}

export function foldStartedThreadItemWithSteer(
  items: ThreadConversationItem[],
  item: ThreadConversationItem,
): { items: ThreadConversationItem[]; suppressed: boolean } {
  if (!isUserMessageItem(item)) {
    return {
      items: upsertConversationItem(items, item),
      suppressed: false,
    };
  }

  if (findPendingSteeringUserMessageIndex(items, item) !== -1) {
    return {
      items,
      suppressed: true,
    };
  }

  return {
    items: upsertConversationItem(items, item),
    suppressed: false,
  };
}

export function foldCompletedThreadItemWithSteer(
  items: ThreadConversationItem[],
  item: ThreadConversationItem,
): { items: ThreadConversationItem[]; suppressed: boolean } {
  if (!isUserMessageItem(item)) {
    return {
      items: upsertConversationItem(items, item),
      suppressed: false,
    };
  }

  const steeringIndex = findPendingSteeringUserMessageIndex(items, item);
  if (steeringIndex === -1) {
    return {
      items: upsertConversationItem(items, item),
      suppressed: false,
    };
  }

  const steeringItem = items[steeringIndex];
  if (!steeringItem || steeringItem.type !== "steeringUserMessage") {
    return {
      items: upsertConversationItem(items, item),
      suppressed: false,
    };
  }

  const nextItems = items.map<ThreadConversationItem>((entry, entryIndex) =>
    entryIndex === steeringIndex
      ? {
          ...steeringItem,
          status: "accepted" as const,
        }
      : entry,
  );
  const steeredItem = createSteeredItem(item);
  return {
    items: upsertConversationItem(nextItems, steeredItem),
    suppressed: true,
  };
}

export function clearUnacceptedSteeringUserMessagesForTurn(
  items: ThreadConversationItem[],
  threadId: string,
  turnId: string,
): {
  items: ThreadConversationItem[];
  restoredQueuedFollowUps: QueuedLocalFollowUp[];
} {
  const restoredQueuedFollowUps: QueuedLocalFollowUp[] = [];
  const nextItems = items.filter((item) => {
    if (item.type !== "steeringUserMessage" || item.turnId !== turnId || item.status === "accepted") {
      return true;
    }

    restoredQueuedFollowUps.push({
      id: createQueuedLocalFollowUpId(),
      threadId,
      cwd: item.cwd,
      text: item.text,
    });
    return false;
  });

  return {
    items: nextItems,
    restoredQueuedFollowUps,
  };
}

export function isSteerSyntheticConversationItem(item: ThreadConversationItem) {
  return item.type === "steered";
}

function findPendingSteeringUserMessageIndex(
  items: ThreadConversationItem[],
  userMessage: UserMessageItem,
) {
  const normalizedUserText = normalizeSteerText(userMessage.text);

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item?.type === "steeringUserMessage" &&
      item.turnId === userMessage.turnId &&
      item.status === "pending" &&
      normalizeSteerText(item.text) === normalizedUserText
    ) {
      return index;
    }
  }

  return -1;
}

function normalizeSteerText(text: string) {
  return text.replaceAll(/\r\n?/g, "\n").trim();
}

function isUserMessageItem(item: ThreadConversationItem): item is UserMessageItem {
  return item.type === "userMessage";
}

function permissionRequestConversationItemId(requestId: JsonRpcId) {
  return `permission-request:${approvalRequestKey(requestId)}`;
}

function mcpServerElicitationConversationItemId(requestId: JsonRpcId) {
  return `mcp-server-elicitation:${approvalRequestKey(requestId)}`;
}

function userInputConversationItemId(requestId: JsonRpcId) {
  return `user-input:${approvalRequestKey(requestId)}`;
}

function createQueuedLocalFollowUpId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `queued-follow-up:${Date.now()}:${Math.random().toString(16).slice(2)}`;
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
