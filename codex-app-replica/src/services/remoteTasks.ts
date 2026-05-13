import { invoke } from "@tauri-apps/api/core";
import type {
  ThreadConversation,
  ThreadConversationItem,
  ThreadConversationTurn,
  ThreadConversationTurnTiming,
  ThreadConversationUserInput,
} from "./history";

export type RemoteTaskReadParams = {
  taskId: string;
};

export type RemoteTaskTurnsReadParams = {
  taskId: string;
};

export type RemoteTaskTurnReadParams = {
  taskId: string;
  turnId: string;
};

export type RemoteTaskTurnLogsReadParams = {
  taskId: string;
  turnId: string;
};

export type RemoteTaskPullRequestCreateParams = {
  taskId: string;
  turnId: string;
  mode?: "draft" | null;
  addCodexTag?: boolean | null;
  hidePrTitleAndBody?: boolean | null;
  additionalLabels?: string[] | null;
};

export type RemoteTaskImageReadParams = {
  assetPointer: string;
};

export type RemoteTask = {
  id: string;
  title?: string | null;
  has_unread_turn?: boolean | null;
  task_status_display?: {
    environment_label?: string | null;
    latest_turn_status_display?: {
      turn_status?: string | null;
      diff_stats?: {
        lines_added?: number | null;
        lines_removed?: number | null;
      } | null;
    } | null;
  } | null;
  external_pull_requests?: Array<{
    assistant_turn_id?: string | null;
    pull_request?: {
      url?: string | null;
      number?: number | null;
      status?: string | null;
    } | null;
  }> | null;
};

export type RemoteTaskThreadEvent = {
  method: string;
  params: Record<string, unknown> | null;
};

export type RemoteTaskTurn = {
  id: string;
  previous_turn_id?: string | null;
  created_at?: number | null;
  attempt_placement?: number | null;
  turn_status?: string | null;
  thread_events?: {
    events?: unknown[] | null;
  } | null;
  error?: {
    code?: string | null;
    message?: string | null;
  } | null;
  conversation_id?: string | null;
  input_items?: unknown[] | null;
  output_items?: unknown[] | null;
  sibling_turn_ids?: string[] | null;
  pull_request_status?: string | null;
  pull_request_data?: {
    url?: string | null;
    number?: number | null;
    status?: string | null;
  } | null;
  environment?: RemoteTaskEnvironment | null;
};

export type RemoteTaskEnvironment = {
  id?: string | null;
  label?: string | null;
  repo_map?: RemoteTaskEnvironmentRepoMapEntry[] | null;
  [key: string]: unknown;
};

export type RemoteTaskEnvironmentRepoMapEntry = {
  clone_url?: string | null;
  [key: string]: unknown;
};

export type RemoteTaskReadResponse = {
  task: RemoteTask;
  current_user_turn?: RemoteTaskTurn | null;
  current_assistant_turn?: RemoteTaskTurn | null;
  current_diff_task_turn?: RemoteTaskTurn | null;
};

export type RemoteTaskTurnsReadResponse = {
  turn_mapping: Record<
    string,
    {
      turn?: RemoteTaskTurn | null;
    }
  >;
};

export type RemoteTaskTurnReadResponse = {
  turn: RemoteTaskTurn;
  [key: string]: unknown;
};

export type RemoteTaskTurnLogRecord = {
  id?: string | null;
  item_type?: string | null;
  key?: {
    type?: string | null;
    created_at?: string | null;
    [key: string]: unknown;
  } | null;
  line?: string | null;
  [key: string]: unknown;
};

export type RemoteTaskTurnLogsReadResponse = {
  logs?: RemoteTaskTurnLogRecord[] | null;
  [key: string]: unknown;
};

export type RemoteTaskPullRequestCreateResponse = {
  status?: string | null;
  [key: string]: unknown;
};

export type RemoteTaskImageReadResponse = {
  contentsBase64: string;
  contentType?: string | null;
};

export type RemoteConversationGroupingNode = {
  userTurn: RemoteTaskTurn;
  assistantTurns: RemoteTaskTurn[];
  children: Record<string, RemoteConversationGroupingNode>;
};

export type RemoteConversationGroupingSelection = {
  node: RemoteConversationGroupingNode;
  activeId: string | null;
};

export type RemoteConversationBranch = {
  task: RemoteTask;
  taskId: string;
  groupings: RemoteConversationGroupingSelection[];
  attemptTabsByTurnId: Record<
    string,
    {
      turns: RemoteTaskTurn[];
      selectedTurnId: string | null;
      expectedCount: number;
    }
  >;
  selectedAssistantTurnId: string | null;
  selectedAssistantTurn: RemoteTaskTurn | null;
  conversation: ThreadConversation;
  turnError: string | null;
};

export type RemoteTaskSetupLogEntry = {
  id: string;
  createdAt: string | null;
  line: string;
};

export type RemoteTaskUserImageAttachment = {
  assetPointer: string | null;
  directUrl: string | null;
  width: number | null;
  height: number | null;
};

export type RemoteConversationGroupOverride = {
  assistantTurn: RemoteTaskTurn | null;
  userImageAttachments: RemoteTaskUserImageAttachment[];
};

export type RemoteTaskPullRequestAction = {
  actionTurn: RemoteTaskTurn;
  diffText: string;
};

type RemoteTaskMessageContentPart = {
  content_type?: string;
  text?: string;
};

type RemoteTaskPullRequestOutputItem = {
  type?: string;
  output_diff?: {
    diff?: string | null;
  } | null;
  [key: string]: unknown;
};

type RemoteTaskMessageInputItem = {
  type?: string;
  role?: string;
  content?: RemoteTaskMessageContentPart[];
};

type RemoteTaskTurnEventItem = {
  id?: string;
  type?: string;
  [key: string]: unknown;
};

type RemoteTaskTurnEventParams = {
  item?: RemoteTaskTurnEventItem;
  itemId?: string;
  delta?: string;
  summaryIndex?: number;
  contentIndex?: number;
  diff?: string;
  explanation?: string | null;
  plan?: Array<{
    step?: string;
    status?: string;
  }>;
  turn?: {
    id?: string;
    status?: string;
    error?: string | null;
  };
  error?: {
    message?: string;
    additionalDetails?: string | null;
  };
};

export async function readRemoteTask(params: RemoteTaskReadParams) {
  return invoke<RemoteTaskReadResponse>("remote-task-read", { params });
}

export async function readRemoteTaskTurns(params: RemoteTaskTurnsReadParams) {
  return invoke<RemoteTaskTurnsReadResponse>("remote-task-turns-read", { params });
}

export async function readRemoteTaskTurn(params: RemoteTaskTurnReadParams) {
  return invoke<RemoteTaskTurnReadResponse>("remote-task-turn-read", { params });
}

export async function readRemoteTaskTurnLogs(params: RemoteTaskTurnLogsReadParams) {
  return invoke<RemoteTaskTurnLogsReadResponse>("remote-task-turn-logs-read", { params });
}

export async function createRemoteTaskPullRequest(params: RemoteTaskPullRequestCreateParams) {
  return invoke<RemoteTaskPullRequestCreateResponse>("remote-task-pr-create", {
    params: {
      taskId: params.taskId,
      turnId: params.turnId,
      mode: params.mode ?? null,
      addCodexTag: params.addCodexTag ?? null,
      hidePrTitleAndBody: params.hidePrTitleAndBody ?? null,
      additionalLabels: params.additionalLabels ?? null,
    },
  });
}

export async function readRemoteTaskImageAsset(params: RemoteTaskImageReadParams) {
  return invoke<RemoteTaskImageReadResponse>("remote-task-image-read", { params });
}

export function buildRemoteConversationGroupOverrides(
  groupings: RemoteConversationGroupingSelection[],
) {
  const overrides: Record<string, RemoteConversationGroupOverride> = {};
  for (const grouping of groupings) {
    const assistantTurn =
      grouping.node.assistantTurns.find((turn) => turn.id === grouping.activeId) ??
      grouping.node.assistantTurns[0] ??
      null;
    overrides[grouping.node.userTurn.id] = {
      assistantTurn,
      userImageAttachments: extractRemoteTaskUserImageAttachments(grouping.node.userTurn.input_items),
    };
  }
  return overrides;
}

export function resolveRemoteTaskPullRequestAction(params: {
  turns: RemoteTaskTurn[];
  selectedTurn: RemoteTaskTurn | null;
  diffTaskTurn: RemoteTaskTurn | null;
}) {
  const turnById = new Map<string, RemoteTaskTurn>();
  for (const turn of params.turns) {
    turnById.set(turn.id, turn);
  }
  if (params.selectedTurn?.id) {
    turnById.set(params.selectedTurn.id, params.selectedTurn);
  }
  if (params.diffTaskTurn?.id) {
    turnById.set(params.diffTaskTurn.id, params.diffTaskTurn);
  }

  const assistantTurns = Array.from(turnById.values()).filter((turn) => !hasRemoteTaskTurnInputItems(turn));
  let actionTurn: RemoteTaskTurn | null = null;
  let actionDiffText: string | null = null;
  const selectedTurnAction = params.selectedTurn
    ? resolveLatestRemoteTaskPullRequestDescendant(assistantTurns, turnById, params.selectedTurn)
    : null;
  if (selectedTurnAction) {
    actionTurn = selectedTurnAction.actionTurn;
    actionDiffText = selectedTurnAction.diffText;
  }

  const diffTaskTurnItem =
    params.selectedTurn && params.diffTaskTurn && isRemoteTaskTurnDescendant(turnById, params.selectedTurn.id, params.diffTaskTurn.id)
      ? extractRemoteTaskPullRequestOutputItem(params.diffTaskTurn)
      : null;
  if (
    params.diffTaskTurn &&
    diffTaskTurnItem &&
    (!actionTurn || (params.diffTaskTurn.created_at ?? 0) > (actionTurn.created_at ?? 0))
  ) {
    actionTurn = params.diffTaskTurn;
    actionDiffText = extractRemoteTaskPullRequestDiffText(diffTaskTurnItem);
  }

  const selectedTurnItem = extractRemoteTaskPullRequestOutputItem(params.selectedTurn);
  if (!actionTurn && params.selectedTurn && selectedTurnItem) {
    actionTurn = params.selectedTurn;
    actionDiffText = extractRemoteTaskPullRequestDiffText(selectedTurnItem);
  }

  const fallbackDiffTurnItem = extractRemoteTaskPullRequestOutputItem(params.diffTaskTurn);
  if (!actionTurn && params.diffTaskTurn && fallbackDiffTurnItem) {
    actionTurn = params.diffTaskTurn;
    actionDiffText = extractRemoteTaskPullRequestDiffText(fallbackDiffTurnItem);
  }

  if (!actionTurn || !actionDiffText) {
    return null;
  }

  return {
    actionTurn,
    diffText: actionDiffText,
  } satisfies RemoteTaskPullRequestAction;
}

export function getRemoteTaskPullRequestDiff(
  turn: RemoteTaskTurn | null | undefined,
) {
  return extractRemoteTaskPullRequestDiffText(extractRemoteTaskPullRequestOutputItem(turn));
}

export function getRemoteTaskApplyDiff(params: {
  selectedTurn: RemoteTaskTurn | null;
  diffTaskTurn: RemoteTaskTurn | null;
  currentAssistantTurn?: RemoteTaskTurn | null;
}) {
  return (
    getRemoteTaskPullRequestDiff(params.selectedTurn) ??
    getRemoteTaskPullRequestDiff(params.diffTaskTurn) ??
    getRemoteTaskPullRequestDiff(params.currentAssistantTurn)
  );
}

export function isTerminalRemoteTaskPullRequestStatus(
  status: string | null | undefined,
  url: string | null | undefined,
) {
  if (typeof url === "string" && url.trim().length > 0) {
    return true;
  }
  return (
    status === "created" ||
    status === "failed" ||
    status === "updated" ||
    status === "externally_created"
  );
}

export function resolveRemoteTaskExternalPullRequest(
  pullRequests: RemoteTask["external_pull_requests"] | null | undefined,
  assistantTurnId: string | null,
  url: string | null,
) {
  for (const entry of pullRequests ?? []) {
    if (!entry) {
      continue;
    }
    if (assistantTurnId && entry.assistant_turn_id === assistantTurnId && entry.pull_request) {
      return entry.pull_request;
    }
  }

  for (const entry of pullRequests ?? []) {
    if (!entry?.pull_request?.url || !url) {
      continue;
    }
    if (entry.pull_request.url === url) {
      return entry.pull_request;
    }
  }

  return null;
}

export function parsePullRequestNumberFromUrl(url: string | null | undefined) {
  if (typeof url !== "string") {
    return null;
  }
  const match = /\/pull\/(\d+)(?:\/|$)/.exec(url);
  if (!match) {
    return null;
  }
  const number = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(number) ? number : null;
}

export function extractRemoteTaskSetupLogEntries(
  response: RemoteTaskTurnLogsReadResponse | null | undefined,
) {
  const entries: RemoteTaskSetupLogEntry[] = [];
  for (const [index, entry] of (response?.logs ?? []).entries()) {
    const line = typeof entry?.line === "string" ? entry.line : "";
    if (entry?.key?.type !== "UserSetupScript" || line.length === 0) {
      continue;
    }
    entries.push({
      id:
        typeof entry.id === "string" && entry.id.trim().length > 0
          ? entry.id
          : `stored:${index}`,
      createdAt:
        typeof entry.key.created_at === "string" && entry.key.created_at.trim().length > 0
          ? entry.key.created_at
          : null,
      line,
    });
  }
  return entries;
}

export function extractRemoteTaskUserImageAttachments(
  items: unknown[] | null | undefined,
) {
  const attachments: RemoteTaskUserImageAttachment[] = [];
  for (const item of items ?? []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.type !== "image_asset_pointer") {
      continue;
    }
    const assetPointer =
      typeof record.asset_pointer === "string" && record.asset_pointer.trim().length > 0
        ? record.asset_pointer
        : null;
    const directUrl =
      typeof record.file_service_url === "string" && record.file_service_url.trim().length > 0
        ? record.file_service_url
        : typeof record.url === "string" && record.url.trim().length > 0
          ? record.url
          : null;
    if (assetPointer === null && directUrl === null) {
      continue;
    }
    attachments.push({
      assetPointer,
      directUrl,
      width: typeof record.width === "number" ? record.width : null,
      height: typeof record.height === "number" ? record.height : null,
    });
  }
  return attachments;
}

export function hasRemoteTaskThreadEvents(turn: RemoteTaskTurn | null | undefined) {
  if (!turn) {
    return false;
  }
  return normalizeRemoteTaskThreadEvents(turn.thread_events?.events).length > 0;
}

export function resolveRemoteTaskEnvironmentSetupState(
  turn: RemoteTaskTurn | null | undefined,
) {
  if (!turn) {
    return null;
  }
  if (turn.turn_status === "failed" && turn.error?.code === "startup_script_failed") {
    return "failed" as const;
  }
  if (
    !hasRemoteTaskThreadEvents(turn) &&
    (turn.turn_status === "pending" || turn.turn_status === "in_progress")
  ) {
    return "running" as const;
  }
  return null;
}

export function mergeRemoteTaskTurns(
  taskTurns: RemoteTaskTurnsReadResponse | null,
  fallbackUserTurn: RemoteTaskTurn | null,
  fallbackAssistantTurn: RemoteTaskTurn | null,
) {
  const turnsById = new Map<string, RemoteTaskTurn>();
  for (const entry of Object.values(taskTurns?.turn_mapping ?? {})) {
    if (entry.turn?.id) {
      turnsById.set(entry.turn.id, normalizeRemoteTaskTurn(entry.turn));
    }
  }
  if (fallbackUserTurn?.id) {
    turnsById.set(fallbackUserTurn.id, normalizeRemoteTaskTurn(fallbackUserTurn));
  }
  if (fallbackAssistantTurn?.id) {
    turnsById.set(fallbackAssistantTurn.id, normalizeRemoteTaskTurn(fallbackAssistantTurn));
  }
  return Array.from(turnsById.values()).sort(
    (left, right) => (left.created_at ?? 0) - (right.created_at ?? 0),
  );
}

export function buildRemoteConversationGroupingTree(turns: RemoteTaskTurn[]) {
  const assistantTurnsByUserTurnId: Record<string, RemoteTaskTurn[]> = {};
  const childUserTurnsByAssistantTurnId: Record<string, RemoteTaskTurn> = {};
  let rootUserTurn: RemoteTaskTurn | null = null;

  for (const turn of turns) {
    if (hasRemoteTaskTurnInputItems(turn)) {
      if (turn.previous_turn_id) {
        childUserTurnsByAssistantTurnId[turn.previous_turn_id] = turn;
      } else {
        rootUserTurn = turn;
      }
      continue;
    }

    if (!turn.previous_turn_id) {
      continue;
    }
    const assistantTurns = assistantTurnsByUserTurnId[turn.previous_turn_id] ?? [];
    assistantTurns.push(turn);
    assistantTurnsByUserTurnId[turn.previous_turn_id] = assistantTurns;
  }

  if (!rootUserTurn) {
    return null;
  }

  const visit = (userTurn: RemoteTaskTurn): RemoteConversationGroupingNode => {
    const assistantTurns = [...(assistantTurnsByUserTurnId[userTurn.id] ?? [])];
    const children: Record<string, RemoteConversationGroupingNode> = {};
    for (const assistantTurn of assistantTurns) {
      const childUserTurn = childUserTurnsByAssistantTurnId[assistantTurn.id];
      if (!childUserTurn) {
        continue;
      }
      children[assistantTurn.id] = visit(childUserTurn);
    }
    return {
      userTurn,
      assistantTurns,
      children,
    };
  };

  return visit(rootUserTurn);
}

export function selectRemoteConversationGroupingPath(
  root: RemoteConversationGroupingNode | null,
  selectedAssistantTurnId: string | null,
) {
  if (!root) {
    return [] as RemoteConversationGroupingSelection[];
  }

  const selectedPath: RemoteConversationGroupingSelection[] = [];

  if (selectedAssistantTurnId) {
    const visit = (
      node: RemoteConversationGroupingNode,
    ): RemoteConversationGroupingSelection[] | null => {
      for (const assistantTurn of node.assistantTurns) {
        if (assistantTurn.id === selectedAssistantTurnId) {
          return [{ node, activeId: assistantTurn.id }];
        }
        const childNode = node.children[assistantTurn.id];
        const childPath = childNode ? visit(childNode) : null;
        if (childPath) {
          return [{ node, activeId: assistantTurn.id }, ...childPath];
        }
      }
      return null;
    };

    const explicitPath = visit(root);
    if (explicitPath) {
      selectedPath.push(...explicitPath);
    }
  }

  if (selectedPath.length === 0) {
    selectedPath.push({
      node: root,
      activeId: root.assistantTurns[0]?.id ?? null,
    });
  }

  let current = selectedPath[selectedPath.length - 1];
  while (current?.activeId) {
    const nextNode = current.node.children[current.activeId];
    if (!nextNode) {
      break;
    }
    current = {
      node: nextNode,
      activeId: nextNode.assistantTurns[0]?.id ?? null,
    };
    selectedPath.push(current);
  }

  return selectedPath;
}

export function getDefaultSelectedAssistantTurnId(
  task: RemoteTaskReadResponse | null,
  turns: RemoteTaskTurn[],
) {
  if (task?.current_assistant_turn?.id) {
    return task.current_assistant_turn.id;
  }

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (hasRemoteTaskTurnInputItems(turn) && turn.previous_turn_id) {
      return turn.previous_turn_id;
    }
  }

  return null;
}

export function buildRemoteConversationBranch(params: {
  taskId: string;
  task: RemoteTaskReadResponse;
  taskTurns: RemoteTaskTurnsReadResponse;
  selectedAssistantTurnId: string | null;
  workspaceRoot: string | null;
}) {
  const mergedTurns = mergeRemoteTaskTurns(
    params.taskTurns,
    params.task.current_user_turn ?? null,
    params.task.current_assistant_turn ?? null,
  );
  const tree = buildRemoteConversationGroupingTree(mergedTurns);
  const groupings = selectRemoteConversationGroupingPath(tree, params.selectedAssistantTurnId);
  const selectedAssistantTurn =
    groupings.length === 0
      ? null
      : groupings[groupings.length - 1]?.node.assistantTurns.find(
          (turn) => turn.id === groupings[groupings.length - 1]?.activeId,
        ) ??
        groupings[groupings.length - 1]?.node.assistantTurns[0] ??
        null;

  return {
    task: params.task.task,
    taskId: params.taskId,
    groupings,
    attemptTabsByTurnId: buildRemoteAttemptTabsByTurnId(groupings),
    selectedAssistantTurnId: selectedAssistantTurn?.id ?? null,
    selectedAssistantTurn,
    conversation: buildRemoteConversationThread({
      taskId: params.taskId,
      task: params.task,
      groupings,
      workspaceRoot: params.workspaceRoot,
    }),
    turnError:
      selectedAssistantTurn?.turn_status === "failed"
        ? selectedAssistantTurn.error?.message ?? null
        : null,
  } satisfies RemoteConversationBranch;
}

function buildRemoteConversationThread(params: {
  taskId: string;
  task: RemoteTaskReadResponse;
  groupings: RemoteConversationGroupingSelection[];
  workspaceRoot: string | null;
}) {
  const turns: ThreadConversationTurn[] = [];
  const items: ThreadConversationItem[] = [];
  const turnTimings: ThreadConversationTurnTiming[] = [];

  for (const grouping of params.groupings) {
    const userTurn = grouping.node.userTurn;
    const assistantTurn =
      grouping.node.assistantTurns.find((turn) => turn.id === grouping.activeId) ??
      grouping.node.assistantTurns[0] ??
      null;
    const groupTurnId = userTurn.id;

    turns.push({
      id: groupTurnId,
      status: normalizeRemoteTaskTurnStatus(assistantTurn?.turn_status ?? userTurn.turn_status),
      input: mapRemoteTaskTurnInputToConversationInput(userTurn.input_items),
    });
    turnTimings.push({
      turnId: groupTurnId,
      status: normalizeRemoteTaskTurnStatus(assistantTurn?.turn_status ?? userTurn.turn_status),
      turnStartedAtMs: toTimestampMs(userTurn.created_at),
      finalAssistantStartedAtMs: assistantTurn ? toTimestampMs(assistantTurn.created_at) : null,
      firstTurnWorkItemStartedAtMs: assistantTurn ? toTimestampMs(assistantTurn.created_at) : null,
    });
    items.push(...buildUserMessageItems(groupTurnId, userTurn));

    if (!assistantTurn) {
      continue;
    }
    items.push(...buildAssistantTurnItems(groupTurnId, userTurn, assistantTurn));
  }

  return {
    id: params.taskId,
    title: params.task.task.title?.trim() || params.taskId,
    cwd: params.workspaceRoot ?? "",
    turns,
    turnTimings,
    items,
  } satisfies ThreadConversation;
}

function buildUserMessageItems(groupTurnId: string, userTurn: RemoteTaskTurn) {
  const messageText = extractRemoteTaskMessageText(userTurn.input_items);
  if (messageText.trim().length === 0) {
    return [] satisfies ThreadConversationItem[];
  }

  return [
    {
      type: "userMessage",
      id: `remote-user:${userTurn.id}`,
      turnId: groupTurnId,
      role: "user",
      text: messageText,
      completed: true,
      referencesPriorConversation: hasRemoteTaskPriorConversation(userTurn.input_items),
    },
  ] satisfies ThreadConversationItem[];
}

function buildAssistantTurnItems(
  groupTurnId: string,
  userTurn: RemoteTaskTurn,
  assistantTurn: RemoteTaskTurn,
) {
  const events = normalizeRemoteTaskThreadEvents(assistantTurn.thread_events?.events);
  const items: ThreadConversationItem[] = [];
  let hasAssistantMessage = false;
  let latestDiffText: string | null = null;

  for (const event of events) {
    const nextItems = mapRemoteTaskThreadEventToConversationItems(
      event,
      groupTurnId,
      assistantTurn.id,
    );
    for (const item of nextItems) {
      if (item.type === "agentMessage") {
        hasAssistantMessage = hasAssistantMessage || item.text.trim().length > 0;
      }
      if (item.type === "turnDiff") {
        latestDiffText = item.unifiedDiff;
      }
      upsertById(items, item);
    }
  }

  if (!hasAssistantMessage) {
    const outputText = extractRemoteTaskMessageText(assistantTurn.output_items);
    if (outputText.trim().length > 0) {
      items.push({
        type: "agentMessage",
        id: `remote-assistant-message:${assistantTurn.id}`,
        turnId: groupTurnId,
        role: "assistant",
        text: outputText,
        completed: assistantTurn.turn_status !== "in_progress" && assistantTurn.turn_status !== "pending",
      });
      hasAssistantMessage = true;
    }
  }

  if (latestDiffText === null) {
    const diffText = extractRemoteTaskOutputDiff(assistantTurn.output_items);
    if (diffText) {
      items.push({
        type: "turnDiff",
        id: `remote-diff:${assistantTurn.id}`,
        turnId: groupTurnId,
        unifiedDiff: diffText,
      });
    }
  }

  if (assistantTurn.turn_status === "failed" && assistantTurn.error?.message) {
    items.push({
      type: "systemError",
      id: `remote-error:${assistantTurn.id}`,
      turnId: groupTurnId,
      content: assistantTurn.error.message,
    });
  }

  if (items.length === 0) {
    const fallbackText = buildFallbackRemoteTaskStatusText(userTurn, assistantTurn);
    if (fallbackText) {
      items.push({
        type: "agentMessage",
        id: `remote-assistant-fallback:${assistantTurn.id}`,
        turnId: groupTurnId,
        role: "assistant",
        text: fallbackText,
        completed: assistantTurn.turn_status !== "in_progress" && assistantTurn.turn_status !== "pending",
      });
    }
  }

  return items;
}

function mapRemoteTaskThreadEventToConversationItems(
  event: RemoteTaskThreadEvent,
  groupTurnId: string,
  assistantTurnId: string,
): ThreadConversationItem[] {
  const params = normalizeRemoteTaskThreadEventParams(event.params);
  switch (event.method) {
    case "item/started":
    case "item/completed": {
      const item = mapRemoteTaskEventItem(
        params.item ?? null,
        groupTurnId,
        event.method === "item/completed",
      );
      return item ? [item] : [];
    }
    case "item/agentMessage/delta": {
      const itemId = typeof params.itemId === "string" ? params.itemId : "agent-message";
      return [
        {
          type: "agentMessage",
          id: itemId,
          turnId: groupTurnId,
          role: "assistant",
          text: typeof params.delta === "string" ? params.delta : "",
          completed: false,
        },
      ];
    }
    case "item/plan/delta": {
      const itemId = typeof params.itemId === "string" ? params.itemId : "plan";
      return [
        {
          type: "plan",
          id: itemId,
          turnId: groupTurnId,
          text: typeof params.delta === "string" ? params.delta : "",
        },
      ];
    }
    case "item/reasoning/summaryTextDelta":
      return [
        {
          type: "reasoning",
          id: typeof params.itemId === "string" ? params.itemId : "reasoning",
          turnId: groupTurnId,
          summary: writeIndexedDelta(
            [],
            typeof params.summaryIndex === "number" ? params.summaryIndex : 0,
            typeof params.delta === "string" ? params.delta : "",
          ),
          content: [],
        },
      ];
    case "item/reasoning/textDelta":
      return [
        {
          type: "reasoning",
          id: typeof params.itemId === "string" ? params.itemId : "reasoning",
          turnId: groupTurnId,
          summary: [],
          content: writeIndexedDelta(
            [],
            typeof params.contentIndex === "number" ? params.contentIndex : 0,
            typeof params.delta === "string" ? params.delta : "",
          ),
        },
      ];
    case "item/commandExecution/outputDelta":
      return [
        {
          type: "commandExecution",
          id: typeof params.itemId === "string" ? params.itemId : "command",
          turnId: groupTurnId,
          command: "",
          cwd: "",
          status: "in_progress",
          commandActions: [],
          aggregatedOutput: typeof params.delta === "string" ? params.delta : "",
          exitCode: null,
          durationMs: null,
        },
      ];
    case "turn/diff/updated":
      return typeof params.diff === "string" && params.diff.length > 0
        ? [
            {
              type: "turnDiff",
              id: `remote-diff:${assistantTurnId}`,
              turnId: groupTurnId,
              unifiedDiff: params.diff,
            },
          ]
        : [];
    case "turn/plan/updated":
      return [
        {
          type: "todoList",
          id: `remote-todo:${assistantTurnId}`,
          turnId: groupTurnId,
          explanation: typeof params.explanation === "string" ? params.explanation : null,
          plan: Array.isArray(params.plan)
            ? params.plan.map((entry) => ({
                step: typeof entry?.step === "string" ? entry.step : "",
                status: typeof entry?.status === "string" ? entry.status : "pending",
              }))
            : [],
        },
      ];
    case "error":
      return typeof params.error?.message === "string" && params.error.message.length > 0
        ? [
            {
              type: "systemError",
              id: `remote-error:${assistantTurnId}:${params.error.message}`,
              turnId: groupTurnId,
              content: params.error.message,
            },
          ]
        : [];
    default:
      return [];
  }
}

function mapRemoteTaskEventItem(
  value: RemoteTaskTurnEventItem | null,
  groupTurnId: string,
  completed: boolean,
): ThreadConversationItem | null {
  if (!value?.type || !value.id) {
    return null;
  }

  switch (value.type) {
    case "agentMessage": {
      const text = typeof value.text === "string" ? value.text : "";
      if (text.trim().length === 0) {
        return null;
      }
      return {
        type: "agentMessage",
        id: value.id,
        turnId: groupTurnId,
        role: "assistant",
        text,
        completed,
      } satisfies ThreadConversationItem;
    }
    case "plan": {
      const text = typeof value.text === "string" ? value.text : "";
      if (text.trim().length === 0) {
        return null;
      }
      return {
        type: "plan",
        id: value.id,
        turnId: groupTurnId,
        text,
      } satisfies ThreadConversationItem;
    }
    case "reasoning":
      return {
        type: "reasoning",
        id: value.id,
        turnId: groupTurnId,
        summary: Array.isArray(value.summary)
          ? value.summary.filter((entry): entry is string => typeof entry === "string")
          : [],
        content: Array.isArray(value.content)
          ? value.content.filter((entry): entry is string => typeof entry === "string")
          : [],
      } satisfies ThreadConversationItem;
    case "commandExecution":
      return {
        type: "commandExecution",
        id: value.id,
        turnId: groupTurnId,
        command: typeof value.command === "string" ? value.command : "",
        cwd: typeof value.cwd === "string" ? value.cwd : "",
        status: typeof value.status === "string" ? value.status : completed ? "completed" : "in_progress",
        commandActions: [],
        aggregatedOutput:
          typeof value.aggregatedOutput === "string" ? value.aggregatedOutput : null,
        exitCode: typeof value.exitCode === "number" ? value.exitCode : null,
        durationMs: typeof value.durationMs === "number" ? value.durationMs : null,
      } satisfies ThreadConversationItem;
    case "fileChange":
      return {
        type: "fileChange",
        id: value.id,
        turnId: groupTurnId,
        status: typeof value.status === "string" ? value.status : completed ? "completed" : "in_progress",
        changes: Array.isArray(value.changes)
          ? value.changes
              .map((change) =>
                change && typeof change === "object"
                  ? {
                      path: typeof (change as Record<string, unknown>).path === "string"
                        ? (change as Record<string, unknown>).path as string
                        : "",
                      kind: typeof (change as Record<string, unknown>).kind === "string"
                        ? (change as Record<string, unknown>).kind as string
                        : "edit",
                      diff: typeof (change as Record<string, unknown>).diff === "string"
                        ? (change as Record<string, unknown>).diff as string
                        : null,
                      movePath:
                        typeof (change as Record<string, unknown>).movePath === "string"
                          ? (change as Record<string, unknown>).movePath as string
                          : null,
                    }
                  : null,
              )
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          : [],
      } satisfies ThreadConversationItem;
    default:
      return null;
  }
}

function normalizeRemoteTaskTurn(turn: RemoteTaskTurn): RemoteTaskTurn {
  return {
    ...turn,
    input_items: Array.isArray(turn.input_items) ? turn.input_items : null,
    output_items: Array.isArray(turn.output_items) ? turn.output_items : null,
    sibling_turn_ids: Array.isArray(turn.sibling_turn_ids) ? turn.sibling_turn_ids : [],
    environment: normalizeRemoteTaskEnvironment(turn.environment),
  };
}

export function getRemoteTaskTurnUnifiedDiff(turn: RemoteTaskTurn | null | undefined) {
  if (!turn) {
    return null;
  }
  const threadEventDiff = extractRemoteTaskOutputDiffFromThreadEvents(turn.thread_events?.events);
  if (threadEventDiff) {
    return threadEventDiff;
  }
  return extractRemoteTaskOutputDiff(turn.output_items);
}

function buildRemoteAttemptTabsByTurnId(groupings: RemoteConversationGroupingSelection[]) {
  const tabsByTurnId: RemoteConversationBranch["attemptTabsByTurnId"] = {};
  for (const grouping of groupings) {
    const selectedTurn =
      grouping.node.assistantTurns.find((turn) => turn.id === grouping.activeId) ??
      grouping.node.assistantTurns[0] ??
      null;
    const siblingCount =
      selectedTurn?.sibling_turn_ids?.length ??
      grouping.node.assistantTurns[0]?.sibling_turn_ids?.length ??
      0;
    tabsByTurnId[grouping.node.userTurn.id] = {
      turns: [...grouping.node.assistantTurns].sort(compareRemoteAttemptTurns),
      selectedTurnId: selectedTurn?.id ?? null,
      expectedCount: Math.max(grouping.node.assistantTurns.length, siblingCount + 1),
    };
  }
  return tabsByTurnId;
}

function normalizeRemoteTaskTurnStatus(status: string | null | undefined) {
  switch (status) {
    case "in_progress":
      return "inProgress";
    case "pending":
      return "pending";
    case "failed":
      return "failed";
    case "cancelled":
      return "interrupted";
    case "completed":
      return "completed";
    default:
      return "completed";
  }
}

function compareRemoteAttemptTurns(left: RemoteTaskTurn, right: RemoteTaskTurn) {
  return (left.attempt_placement ?? left.created_at ?? 0) - (right.attempt_placement ?? right.created_at ?? 0);
}

function hasRemoteTaskTurnInputItems(turn: RemoteTaskTurn) {
  return Array.isArray(turn.input_items);
}

function resolveLatestRemoteTaskPullRequestDescendant(
  assistantTurns: RemoteTaskTurn[],
  turnById: Map<string, RemoteTaskTurn>,
  selectedTurn: RemoteTaskTurn,
) {
  let latestAction: RemoteTaskPullRequestAction | null = null;
  for (const turn of assistantTurns) {
    if (!isRemoteTaskTurnDescendant(turnById, selectedTurn.id, turn.id)) {
      continue;
    }
    const item = extractRemoteTaskPullRequestOutputItem(turn);
    const diffText = extractRemoteTaskPullRequestDiffText(item);
    if (!diffText) {
      continue;
    }
    if (!latestAction || (turn.created_at ?? 0) > (latestAction.actionTurn.created_at ?? 0)) {
      latestAction = {
        actionTurn: turn,
        diffText,
      };
    }
  }
  return latestAction;
}

function isRemoteTaskTurnDescendant(
  turnById: Map<string, RemoteTaskTurn>,
  ancestorTurnId: string,
  turnId: string,
) {
  if (ancestorTurnId === turnId) {
    return true;
  }
  let current = turnById.get(turnId);
  const seen = new Set<string>();
  while (current?.previous_turn_id && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.previous_turn_id === ancestorTurnId) {
      return true;
    }
    current = turnById.get(current.previous_turn_id);
  }
  return false;
}

function extractRemoteTaskPullRequestOutputItem(
  turn: RemoteTaskTurn | null | undefined,
) {
  return (turn?.output_items ?? []).find(
    (item): item is RemoteTaskPullRequestOutputItem =>
      !!item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as RemoteTaskPullRequestOutputItem).type === "pr",
  ) ?? null;
}

function extractRemoteTaskPullRequestDiffText(
  item: RemoteTaskPullRequestOutputItem | null | undefined,
) {
  const diffText = item?.output_diff?.diff;
  return typeof diffText === "string" && diffText.trim().length > 0 ? diffText : null;
}

function extractRemoteTaskMessageText(items: unknown[] | null | undefined) {
  return (items ?? [])
    .flatMap((item) =>
      isRemoteTaskMessageInputItem(item) ? item.content ?? [] : [],
    )
    .filter((part): part is RemoteTaskMessageContentPart => part?.content_type === "text")
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function extractRemoteTaskOutputDiff(items: unknown[] | null | undefined) {
  for (const item of items ?? []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.type !== "output_diff") {
      continue;
    }
    const diff = record.output_diff;
    if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
      continue;
    }
    return typeof (diff as Record<string, unknown>).diff === "string"
      ? ((diff as Record<string, unknown>).diff as string)
      : null;
  }
  return null;
}

function extractRemoteTaskOutputDiffFromThreadEvents(events: unknown[] | null | undefined) {
  for (const event of normalizeRemoteTaskThreadEvents(events)) {
    if (event.method !== "turn/diff/updated") {
      continue;
    }
    const params = normalizeRemoteTaskThreadEventParams(event.params);
    if (typeof params.diff === "string" && params.diff.length > 0) {
      return params.diff;
    }
  }
  return null;
}

function hasRemoteTaskPriorConversation(items: unknown[] | null | undefined) {
  return (items ?? []).some(
    (item) =>
      !!item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as Record<string, unknown>).type === "prior_conversation",
  );
}

function mapRemoteTaskTurnInputToConversationInput(
  items: unknown[] | null | undefined,
) {
  const input: ThreadConversationUserInput[] = [];

  for (const item of items ?? []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;

    if (record.type === "message" && Array.isArray(record.content)) {
      const text = record.content
        .filter(
          (entry): entry is RemoteTaskMessageContentPart =>
            !!entry &&
            typeof entry === "object" &&
            !Array.isArray(entry) &&
            (entry as RemoteTaskMessageContentPart).content_type === "text",
        )
        .map((entry) => (typeof entry.text === "string" ? entry.text : ""))
        .join("");
      if (text.trim().length > 0) {
        input.push({
          type: "text",
          text,
          textElements: [],
        });
      }
      continue;
    }

    if (record.type === "image_asset_pointer") {
      const fileServiceUrl =
        typeof record.file_service_url === "string"
          ? record.file_service_url
          : typeof record.url === "string"
            ? record.url
            : null;
      if (fileServiceUrl) {
        input.push({
          type: "image",
          url: fileServiceUrl,
        });
      }
    }
  }

  return input;
}

function normalizeRemoteTaskThreadEvents(
  events: unknown[] | null | undefined,
) {
  return (events ?? [])
    .map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }
      const record = value as Record<string, unknown>;
      return typeof record.method === "string"
        ? {
            method: record.method,
            params:
              record.params && typeof record.params === "object" && !Array.isArray(record.params)
                ? (record.params as Record<string, unknown>)
                : null,
          }
        : null;
    })
    .filter((event): event is RemoteTaskThreadEvent => event !== null);
}

function normalizeRemoteTaskEnvironment(value: RemoteTaskEnvironment | null | undefined) {
  if (!value) {
    return null;
  }

  return {
    ...value,
    repo_map: Array.isArray(value.repo_map)
      ? value.repo_map
          .map((entry) => normalizeRemoteTaskEnvironmentRepoMapEntry(entry))
          .filter((entry): entry is RemoteTaskEnvironmentRepoMapEntry => entry !== null)
      : null,
  };
}

function normalizeRemoteTaskEnvironmentRepoMapEntry(
  value: RemoteTaskEnvironmentRepoMapEntry | null | undefined,
) {
  if (!value) {
    return null;
  }

  return {
    ...value,
  };
}

function normalizeRemoteTaskThreadEventParams(value: Record<string, unknown> | null | undefined) {
  return (value ?? {}) as RemoteTaskTurnEventParams;
}

function upsertById(items: ThreadConversationItem[], item: ThreadConversationItem) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    items.push(item);
    return;
  }

  const existing = items[index];
  if (item.type === "agentMessage" && existing.type === "agentMessage" && !item.completed) {
    items[index] = {
      ...item,
      text: `${existing.text}${item.text}`,
      completed: false,
    };
    return;
  }

  if (item.type === "plan" && existing.type === "plan") {
    items[index] = {
      ...item,
      text: `${existing.text}${item.text}`,
    };
    return;
  }

  if (item.type === "reasoning" && existing.type === "reasoning") {
    items[index] = {
      ...item,
      summary: mergeIndexedTextArrays(existing.summary, item.summary),
      content: mergeIndexedTextArrays(existing.content, item.content),
    };
    return;
  }

  if (
    item.type === "commandExecution" &&
    existing.type === "commandExecution" &&
    item.exitCode === null
  ) {
    items[index] = {
      ...item,
      aggregatedOutput: `${existing.aggregatedOutput ?? ""}${item.aggregatedOutput ?? ""}` || null,
    };
    return;
  }

  if (item.type === "turnDiff" && existing.type === "turnDiff") {
    items[index] = {
      ...item,
      unifiedDiff: item.unifiedDiff || existing.unifiedDiff,
    };
    return;
  }

  items[index] = item;
}

function mergeIndexedTextArrays(existing: string[], incoming: string[]) {
  const next = [...existing];
  for (let index = 0; index < incoming.length; index += 1) {
    const value = incoming[index] ?? "";
    if (!value) {
      continue;
    }
    next[index] = `${next[index] ?? ""}${value}`;
  }
  return next;
}

function writeIndexedDelta(current: string[], index: number, delta: string) {
  const next = [...current];
  while (next.length <= index) {
    next.push("");
  }
  next[index] = `${next[index]}${delta}`;
  return next;
}

function isRemoteTaskMessageInputItem(value: unknown): value is RemoteTaskMessageInputItem {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toTimestampMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value * 1000 : null;
}

function buildFallbackRemoteTaskStatusText(_userTurn: RemoteTaskTurn, _assistantTurn: RemoteTaskTurn) {
  return "";
}
