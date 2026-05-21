import type {
  JsonRpcId,
  ThreadConversation,
  ThreadConversationItem,
  ThreadEvent,
} from "../../services/history";

export const ACTIVE_ACTIVITY_POLL_INTERVAL_MS = 15_000;

export type OverlayRequestEvent = Extract<
  ThreadEvent,
  | { type: "toolRequestUserInputRequested" }
  | { type: "permissionsRequestApprovalRequested" }
  | { type: "mcpServerElicitationRequested" }
>;

export function getNextActivityRefreshDelayMs(options: {
  hasRunningCloudSession: boolean;
  hasRunningLocalSession: boolean;
  nextExpiresAtMs: number | null;
  nowMs?: number;
}) {
  const nowMs = options.nowMs ?? Date.now();
  const hasRunningSession = options.hasRunningCloudSession || options.hasRunningLocalSession;
  if (!hasRunningSession && options.nextExpiresAtMs == null) {
    return null;
  }

  let delayMs = ACTIVE_ACTIVITY_POLL_INTERVAL_MS;
  let shouldRefreshActivity = hasRunningSession;
  if (options.nextExpiresAtMs != null) {
    const expiresInMs = Math.max(0, options.nextExpiresAtMs - nowMs);
    if (expiresInMs < ACTIVE_ACTIVITY_POLL_INTERVAL_MS) {
      delayMs = expiresInMs;
      shouldRefreshActivity = false;
    }
  }

  return {
    delayMs,
    shouldRefreshActivity,
  };
}

export function mergeSyntheticRequestItemsIntoConversation(
  conversation: ThreadConversation,
  syntheticItemsByThreadId: ReadonlyMap<string, ThreadConversationItem[]>,
) {
  const syntheticItems = syntheticItemsByThreadId.get(conversation.id) ?? [];
  if (syntheticItems.length === 0) {
    return conversation;
  }

  return {
    ...conversation,
    items: [...conversation.items, ...syntheticItems],
  };
}

export function updateSyntheticRequestItemsForThread(
  current: ReadonlyMap<string, ThreadConversationItem[]>,
  threadId: string,
  updater: (items: ThreadConversationItem[]) => ThreadConversationItem[],
): Map<string, ThreadConversationItem[]> {
  const existingItems = current.get(threadId) ?? [];
  const nextItems = updater(existingItems);
  if (nextItems === existingItems) {
    return new Map(current);
  }

  const next = new Map(current);
  if (nextItems.length === 0) {
    next.delete(threadId);
  } else {
    next.set(threadId, nextItems);
  }
  return next;
}

export function approvalRequestKey(requestId: JsonRpcId) {
  return `${typeof requestId}:${requestId}`;
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

export function upsertPermissionRequestConversationItem(
  items: ThreadConversationItem[],
  request: Extract<ThreadEvent, { type: "permissionsRequestApprovalRequested" }>,
) {
  return upsertConversationItem(items, {
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
  });
}

export function upsertMcpServerElicitationConversationItem(
  items: ThreadConversationItem[],
  request: Extract<ThreadEvent, { type: "mcpServerElicitationRequested" }>,
) {
  return upsertConversationItem(items, {
    type: "mcpServerElicitation",
    id: mcpServerElicitationConversationItemId(request.requestId),
    turnId: request.turnId,
    requestId: request.requestId,
    serverName: request.serverName,
    request: request.request,
    completed: false,
    action: null,
    content: null,
  });
}

export function upsertUserInputConversationItem(
  items: ThreadConversationItem[],
  request: Extract<ThreadEvent, { type: "toolRequestUserInputRequested" }>,
) {
  return upsertConversationItem(items, {
    type: "userInput",
    id: userInputConversationItemId(request.requestId),
    turnId: request.turnId,
    requestId: request.requestId,
    itemId: request.itemId,
    questions: request.questions,
    completed: false,
  });
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

function threadItemId(item: ThreadConversationItem) {
  return item.id;
}

function upsertConversationItem(
  items: ThreadConversationItem[],
  nextItem: ThreadConversationItem,
) {
  const nextItemId = threadItemId(nextItem);
  const index = items.findIndex((item) => threadItemId(item) === nextItemId);
  if (index === -1) {
    return [...items, nextItem];
  }
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}
