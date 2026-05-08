import type {
  ThreadConversationAutomationUpdate,
  ThreadConversationHook,
  ThreadConversationItem,
  ThreadConversationMessage,
  ThreadConversationPlanImplementation,
  ThreadConversationTurnTiming,
} from "../../services/history";
import {
  buildRenderableConversationItems,
  collapseToolActivityItems,
  type RenderableConversationItem,
} from "./renderableConversationItems";
import type {
  PendingApproval,
  PendingToolRequestUserInput,
} from "./threadConversationState";

type UserMessage = ThreadConversationMessage & { type: "userMessage" };
type AgentMessage = ThreadConversationMessage & {
  type: "agentMessage";
  role: "assistant";
};
type HookItem = ThreadConversationHook;
type TodoListItem = Extract<ThreadConversationItem, { type: "todoList" }>;
type TurnDiffItem = Extract<ThreadConversationItem, { type: "turnDiff" }>;
type PersonalityChangedItem = Extract<ThreadConversationItem, { type: "personalityChanged" }>;
type ModelChangedItem = Extract<ThreadConversationItem, { type: "modelChanged" }>;
type ModelReroutedItem = Extract<ThreadConversationItem, { type: "modelRerouted" }>;
type ForkedFromConversationItem = Extract<ThreadConversationItem, { type: "forkedFromConversation" }>;
type RemoteTaskCreatedItem = Extract<ThreadConversationItem, { type: "remoteTaskCreated" }>;
type AutomaticApprovalReviewItem = Extract<ThreadConversationItem, { type: "automaticApprovalReview" }>;
type PlanItem = Extract<ThreadConversationItem, { type: "plan" }>;
type ImageGenerationItem = Extract<ThreadConversationItem, { type: "imageGeneration" }>;
type SystemEventItem = Extract<ThreadConversationItem, { type: "systemError" }>;

type McpServerElicitationItem = Extract<ThreadConversationItem, { type: "mcpServerElicitation" }>;
type PermissionRequestItem = Extract<ThreadConversationItem, { type: "permissionRequest" }>;
type UserInputRequestItem = Extract<ThreadConversationItem, { type: "userInput" }>;

export type RenderableConversationGroup = {
  id: string;
  turnId: string;
  preUserItems: HookItem[];
  userItems: UserMessage[];
  activityItems: RenderableConversationItem[];
  assistantMessage: AgentMessage | null;
  assistantAutomationUpdateItems: ThreadConversationAutomationUpdate[];
  automationUpdateItems: ThreadConversationAutomationUpdate[];
  toolOutputItems: ImageGenerationItem[];
  postAssistantItems: RenderableConversationItem[];
  systemEventItem: SystemEventItem | null;
  unifiedDiffItem: TurnDiffItem | null;
  todoListItem: TodoListItem | null;
  proposedPlanItem: PlanItem | null;
  planImplementationItem: ThreadConversationPlanImplementation | null;
  mcpServerElicitationItems: McpServerElicitationItem[];
  permissionRequestItems: PermissionRequestItem[];
  approvalItem: PendingApproval | null;
  userInputItem: UserInputRequestItem | null;
  remoteTaskCreatedItems: RemoteTaskCreatedItem[];
  personalityChangedItems: PersonalityChangedItem[];
  forkedFromConversationItems: ForkedFromConversationItem[];
  modelChangedItems: ModelChangedItem[];
  modelReroutedItems: ModelReroutedItem[];
};

type RenderableConversationGroupTurnScopedItems = {
  approvalItems?: PendingApproval[];
};

export type RenderableConversationGroupsWithTurnScopedItems = {
  groups: RenderableConversationGroup[];
  unmatchedApprovalItems: PendingApproval[];
};

export function buildRenderableConversationGroups(
  items: ThreadConversationItem[],
  options?: {
    turnTimings?: ThreadConversationTurnTiming[];
  },
) {
  const groups: RenderableConversationGroup[] = [];
  const renderableItems = buildRenderableConversationItems(items, options);
  let currentTurnId: string | null = null;
  let currentItems: RenderableConversationItem[] = [];

  for (const item of renderableItems) {
    if (currentTurnId !== null && currentTurnId !== item.turnId) {
      groups.push(createConversationGroup(currentTurnId, currentItems));
      currentItems = [];
    }
    if (currentTurnId !== item.turnId) {
      currentTurnId = item.turnId;
    }
    currentItems.push(item);
  }

  if (currentTurnId !== null) {
    groups.push(createConversationGroup(currentTurnId, currentItems));
  }

  return groups;
}

export function attachTurnScopedItemsToRenderableConversationGroups(
  groups: RenderableConversationGroup[],
  items: RenderableConversationGroupTurnScopedItems = {},
): RenderableConversationGroupsWithTurnScopedItems {
  const knownTurnIds = new Set(groups.map((group) => group.turnId));
  const approvalItems = partitionTurnScopedItems(items.approvalItems ?? [], knownTurnIds);

  return {
    groups: groups.map((group) => ({
      ...group,
      approvalItem: takeLatestApprovalItem(
        approvalItems.grouped.get(group.turnId) ?? [],
        collectConversationGroupItemOrder(group),
      ),
    })),
    unmatchedApprovalItems: approvalItems.unmatched,
  };
}

function createConversationGroup(
  turnId: string,
  items: RenderableConversationItem[],
): RenderableConversationGroup {
  const preUserItems: HookItem[] = [];
  let proposedPlanItem: PlanItem | null = null;
  let planImplementationItem: ThreadConversationPlanImplementation | null = null;
  const userItems: UserMessage[] = [];
  const personalityChangedItems: PersonalityChangedItem[] = [];
  const modelChangedItems: ModelChangedItem[] = [];
  const modelReroutedItems: ModelReroutedItem[] = [];
  const toolOutputItems: ImageGenerationItem[] = [];
  const automationUpdateItems: ThreadConversationAutomationUpdate[] = [];
  const forkedFromConversationItems: ForkedFromConversationItem[] = [];
  const mcpServerElicitationItems: McpServerElicitationItem[] = [];
  const permissionRequestItems: PermissionRequestItem[] = [];
  let userInputItem: UserInputRequestItem | null = null;
  const remoteTaskCreatedItems: RemoteTaskCreatedItem[] = [];
  const pinnedPostAssistantItems: RenderableConversationItem[] = [];
  const nonUserItems: RenderableConversationItem[] = [];
  let unifiedDiffItem: TurnDiffItem | null = null;
  let todoListItem: TodoListItem | null = null;
  let hasEnteredPrimaryConversationRegion = false;
  const hasLaterPrimaryConversationContent = buildHasLaterPrimaryConversationContent(items);

  for (const [index, item] of items.entries()) {
    if (!hasEnteredPrimaryConversationRegion && item.type === "userMessage") {
      userItems.push(item as UserMessage);
      continue;
    }
    if (!hasEnteredPrimaryConversationRegion && item.type === "hook") {
      preUserItems.push(item);
      continue;
    }

    hasEnteredPrimaryConversationRegion = true;

    if (item.type === "todoList") {
      todoListItem = item;
      continue;
    }
    if (item.type === "turnDiff") {
      unifiedDiffItem = item;
      continue;
    }
    if (item.type === "personalityChanged") {
      personalityChangedItems.push(item);
      continue;
    }
    if (item.type === "modelChanged") {
      modelChangedItems.push(item);
      continue;
    }
    if (item.type === "modelRerouted") {
      modelReroutedItems.push(item);
      continue;
    }
    if (item.type === "plan") {
      proposedPlanItem = item;
      continue;
    }
    if (item.type === "planImplementation") {
      planImplementationItem = item;
      continue;
    }
    if (item.type === "remoteTaskCreated") {
      remoteTaskCreatedItems.push(item);
      continue;
    }
    if (item.type === "autoReviewInterruptionWarning") {
      pinnedPostAssistantItems.push(item);
      continue;
    }
    if (item.type === "hook") {
      if (hasLaterPrimaryConversationContent[index]) {
        nonUserItems.push(item);
      } else {
        pinnedPostAssistantItems.push(item);
      }
      continue;
    }
    if (item.type === "explorationGroup" || item.type === "webSearchGroup") {
      nonUserItems.push(item);
      continue;
    }
    if (item.type === "imageGeneration") {
      toolOutputItems.push(item);
      continue;
    }
    if (item.type === "automationUpdate") {
      automationUpdateItems.push(item);
      continue;
    }
    if (item.type === "mcpServerElicitation") {
      mcpServerElicitationItems.push(item);
      continue;
    }
    if (item.type === "permissionRequest") {
      permissionRequestItems.push(item);
      continue;
    }
    if (item.type === "userInput") {
      userInputItem = item;
      continue;
    }
    if (item.type === "forkedFromConversation") {
      forkedFromConversationItems.push(item);
      continue;
    }
    nonUserItems.push(item);
  }

  const trailingAutomaticApprovalReviewItems = extractTrailingAutomaticApprovalReviewItems(nonUserItems);
  const agentItems =
    trailingAutomaticApprovalReviewItems.length === 0
      ? nonUserItems
      : nonUserItems.slice(0, nonUserItems.length - trailingAutomaticApprovalReviewItems.length);
  const assistantMessage = extractTrailingAssistantMessage(agentItems);
  const activityItems =
    assistantMessage === null
      ? [...agentItems, ...trailingAutomaticApprovalReviewItems]
      : agentItems.slice(0, -1);
  const systemEventItem = extractTrailingSystemEventItem(activityItems);
  const finalizedActivityItems = collapseToolActivityItems(
    systemEventItem === null ? activityItems : activityItems.slice(0, -1),
  );
  const assistantAutomationUpdateItems =
    assistantMessage === null ? [] : automationUpdateItems;
  const standaloneAutomationUpdateItems =
    assistantMessage === null ? automationUpdateItems : [];
  const postAssistantItems =
    assistantMessage === null
      ? collapseToolActivityItems(pinnedPostAssistantItems)
      : collapseToolActivityItems([...pinnedPostAssistantItems, ...trailingAutomaticApprovalReviewItems]);

  return {
    id: turnId,
    turnId,
    preUserItems,
    userItems,
    activityItems: finalizedActivityItems,
    assistantMessage,
    assistantAutomationUpdateItems,
    automationUpdateItems: standaloneAutomationUpdateItems,
    toolOutputItems,
    postAssistantItems,
    systemEventItem,
    unifiedDiffItem,
    todoListItem,
    proposedPlanItem,
    planImplementationItem,
    mcpServerElicitationItems,
    permissionRequestItems,
    approvalItem: null,
    userInputItem,
    remoteTaskCreatedItems,
    personalityChangedItems,
    forkedFromConversationItems,
    modelChangedItems,
    modelReroutedItems,
  };
}

function buildHasLaterPrimaryConversationContent(items: RenderableConversationItem[]) {
  const hasLaterPrimaryConversationContent = Array(items.length).fill(false);
  let hasSeenLaterPrimaryConversationContent = false;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    hasLaterPrimaryConversationContent[index] = hasSeenLaterPrimaryConversationContent;
    const item = items[index];
    if (item && (item.type === "userMessage" || isPrimaryConversationContentItem(item))) {
      hasSeenLaterPrimaryConversationContent = true;
    }
  }

  return hasLaterPrimaryConversationContent;
}

function isPrimaryConversationContentItem(item: RenderableConversationItem) {
  if (
    item.type === "explorationGroup" ||
    item.type === "webSearchGroup" ||
    item.type === "multiAgentGroup" ||
    item.type === "collapsedToolActivity"
  ) {
    return true;
  }

  switch (item.type) {
    case "agentMessage":
      return item.role === "assistant";
    case "commandExecution":
    case "fileChange":
    case "mcpToolCall":
    case "dynamicToolCall":
    case "automaticApprovalReview":
    case "multiAgentAction":
    case "webSearch":
    case "reasoning":
    case "streamError":
    case "systemError":
    case "contextCompaction":
    case "steered":
    case "workedFor":
    case "userInputResponse":
    case "imageView":
      return true;
    default:
      return false;
  }
}

function extractTrailingAssistantMessage(items: RenderableConversationItem[]) {
  const trailingItem = items.at(-1);
  return trailingItem !== undefined && isAssistantMessage(trailingItem) ? trailingItem : null;
}

function extractTrailingAutomaticApprovalReviewItems(items: RenderableConversationItem[]) {
  const trailingItems: AutomaticApprovalReviewItem[] = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.type !== "automaticApprovalReview") {
      break;
    }
    trailingItems.unshift(item);
  }
  return trailingItems;
}

function extractTrailingSystemEventItem(items: RenderableConversationItem[]) {
  const trailingItem = items.at(-1);
  return trailingItem !== undefined && isSystemEventItem(trailingItem) ? trailingItem : null;
}

function isSystemEventItem(item: RenderableConversationItem): item is SystemEventItem {
  return item.type === "systemError";
}

function isAssistantMessage(item: RenderableConversationItem): item is AgentMessage {
  return item.type === "agentMessage" && item.role === "assistant" && item.text.trim().length > 0;
}

function partitionTurnScopedItems<T extends { turnId: string | null }>(items: T[], knownTurnIds: Set<string>) {
  const grouped = new Map<string, T[]>();
  const unmatched: T[] = [];

  for (const item of items) {
    if (item.turnId && knownTurnIds.has(item.turnId)) {
      const current = grouped.get(item.turnId) ?? [];
      current.push(item);
      grouped.set(item.turnId, current);
      continue;
    }
    unmatched.push(item);
  }

  return { grouped, unmatched };
}

function takeLatestTurnScopedItem<T>(items: T[]) {
  return items.at(-1) ?? null;
}

function takeLatestApprovalItem(
  items: PendingApproval[],
  itemOrder: Map<string, number>,
) {
  let matchedItem: PendingApproval | null = null;
  let matchedOrder = -1;

  for (const item of items) {
    const itemId = item.itemId;
    const order = itemOrder.get(itemId);
    if (order === undefined || order < matchedOrder) {
      continue;
    }
    matchedItem = item;
    matchedOrder = order;
  }

  if (matchedItem !== null) {
    return matchedItem;
  }

  return takeLatestTurnScopedItem(items);
}

function collectConversationGroupItemOrder(group: RenderableConversationGroup) {
  const itemOrder = new Map<string, number>();
  let index = 0;

  const pushItem = (item: RenderableConversationItem) => {
    for (const itemId of collectRenderableConversationItemIds(item)) {
      itemOrder.set(itemId, index);
    }
    index += 1;
  };

  for (const item of group.preUserItems) {
    pushItem(item);
  }
  for (const item of group.modelChangedItems) {
    pushItem(item);
  }
  for (const item of group.userItems) {
    pushItem(item);
  }
  for (const item of group.modelReroutedItems) {
    pushItem(item);
  }
  for (const item of group.activityItems) {
    pushItem(item);
  }
  if (group.assistantMessage) {
    pushItem(group.assistantMessage);
  }
  for (const item of group.toolOutputItems) {
    pushItem(item);
  }
  for (const item of group.postAssistantItems) {
    pushItem(item);
  }
  if (group.systemEventItem) {
    pushItem(group.systemEventItem);
  }
  if (group.unifiedDiffItem) {
    pushItem(group.unifiedDiffItem);
  }
  for (const item of group.remoteTaskCreatedItems) {
    pushItem(item);
  }
  for (const item of group.personalityChangedItems) {
    pushItem(item);
  }
  for (const item of group.forkedFromConversationItems) {
    pushItem(item);
  }
  if (group.todoListItem) {
    pushItem(group.todoListItem);
  }
  if (group.proposedPlanItem) {
    pushItem(group.proposedPlanItem);
  }

  return itemOrder;
}

function collectRenderableConversationItemIds(item: RenderableConversationItem): string[] {
  if (
    item.type === "explorationGroup" ||
    item.type === "webSearchGroup" ||
    item.type === "multiAgentGroup" ||
    item.type === "collapsedToolActivity"
  ) {
    return item.items.map((groupedItem) => groupedItem.id);
  }

  return [item.id];
}
