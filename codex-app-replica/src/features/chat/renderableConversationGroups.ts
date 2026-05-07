import type { ThreadConversationItem, ThreadConversationMessage } from "../../services/history";
import {
  buildRenderableConversationItems,
  type RenderableConversationItem,
} from "./renderableConversationItems";
import type {
  PendingApproval,
  PendingMcpServerElicitationRequest,
  PendingPermissionsRequestApproval,
  PendingToolRequestUserInput,
  PlanImplementationItem,
} from "./threadConversationState";

type UserMessage = ThreadConversationMessage & { type: "userMessage" };
type AgentMessage = ThreadConversationMessage & {
  type: "agentMessage";
  role: "assistant";
};
type HookPromptItem = Extract<ThreadConversationItem, { type: "hookPrompt" }>;
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
type SystemEventItem = Extract<
  ThreadConversationItem,
  { type: "streamError" } | { type: "systemError" }
>;

export type RenderableConversationGroup = {
  id: string;
  turnId: string;
  preUserItems: HookPromptItem[];
  userItems: UserMessage[];
  activityItems: RenderableConversationItem[];
  assistantMessage: AgentMessage | null;
  toolOutputItems: ImageGenerationItem[];
  postAssistantItems: RenderableConversationItem[];
  systemEventItem: SystemEventItem | null;
  unifiedDiffItem: TurnDiffItem | null;
  todoListItem: TodoListItem | null;
  proposedPlanItem: PlanItem | null;
  planImplementationItem: PlanImplementationItem | null;
  mcpServerElicitationItems: PendingMcpServerElicitationRequest[];
  permissionRequestItems: PendingPermissionsRequestApproval[];
  approvalItem: PendingApproval | null;
  userInputItem: PendingToolRequestUserInput | null;
  remoteTaskCreatedItems: RemoteTaskCreatedItem[];
  personalityChangedItems: PersonalityChangedItem[];
  forkedFromConversationItems: ForkedFromConversationItem[];
  modelChangedItems: ModelChangedItem[];
  modelReroutedItems: ModelReroutedItem[];
};

type RenderableConversationGroupTurnScopedItems = {
  planImplementationItems?: PlanImplementationItem[];
  mcpServerElicitationItems?: PendingMcpServerElicitationRequest[];
  permissionRequestItems?: PendingPermissionsRequestApproval[];
  approvalItems?: PendingApproval[];
  userInputItems?: PendingToolRequestUserInput[];
};

export type RenderableConversationGroupsWithTurnScopedItems = {
  groups: RenderableConversationGroup[];
  unmatchedPlanImplementationItems: PlanImplementationItem[];
  unmatchedMcpServerElicitationItems: PendingMcpServerElicitationRequest[];
  unmatchedPermissionRequestItems: PendingPermissionsRequestApproval[];
  unmatchedApprovalItems: PendingApproval[];
  unmatchedUserInputItems: PendingToolRequestUserInput[];
};

export function buildRenderableConversationGroups(items: ThreadConversationItem[]) {
  const groups: RenderableConversationGroup[] = [];
  const renderableItems = buildRenderableConversationItems(items);
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
  const planImplementationItems = partitionTurnScopedItems(items.planImplementationItems ?? [], knownTurnIds);
  const mcpServerElicitationItems = partitionTurnScopedItems(items.mcpServerElicitationItems ?? [], knownTurnIds);
  const permissionRequestItems = partitionTurnScopedItems(items.permissionRequestItems ?? [], knownTurnIds);
  const approvalItems = partitionTurnScopedItems(items.approvalItems ?? [], knownTurnIds);
  const userInputItems = partitionTurnScopedItems(items.userInputItems ?? [], knownTurnIds);

  return {
    groups: groups.map((group) => ({
      ...group,
      planImplementationItem: takeLatestTurnScopedItem(planImplementationItems.grouped.get(group.turnId) ?? []),
      mcpServerElicitationItems: mcpServerElicitationItems.grouped.get(group.turnId) ?? [],
      permissionRequestItems: permissionRequestItems.grouped.get(group.turnId) ?? [],
      approvalItem: takeLatestTurnScopedItem(approvalItems.grouped.get(group.turnId) ?? []),
      userInputItem: takeLatestTurnScopedItem(userInputItems.grouped.get(group.turnId) ?? []),
    })),
    unmatchedPlanImplementationItems: planImplementationItems.unmatched,
    unmatchedMcpServerElicitationItems: mcpServerElicitationItems.unmatched,
    unmatchedPermissionRequestItems: permissionRequestItems.unmatched,
    unmatchedApprovalItems: approvalItems.unmatched,
    unmatchedUserInputItems: userInputItems.unmatched,
  };
}

function createConversationGroup(
  turnId: string,
  items: RenderableConversationItem[],
): RenderableConversationGroup {
  const preUserItems: HookPromptItem[] = [];
  let proposedPlanItem: PlanItem | null = null;
  const userItems: UserMessage[] = [];
  const personalityChangedItems: PersonalityChangedItem[] = [];
  const modelChangedItems: ModelChangedItem[] = [];
  const modelReroutedItems: ModelReroutedItem[] = [];
  const toolOutputItems: ImageGenerationItem[] = [];
  const forkedFromConversationItems: ForkedFromConversationItem[] = [];
  const remoteTaskCreatedItems: RemoteTaskCreatedItem[] = [];
  const pinnedPostAssistantItems: RenderableConversationItem[] = [];
  const nonUserItems: RenderableConversationItem[] = [];
  let unifiedDiffItem: TurnDiffItem | null = null;
  let todoListItem: TodoListItem | null = null;
  let hasReachedUserMessage = false;

  for (const item of items) {
    if (!hasReachedUserMessage && item.type === "hookPrompt") {
      preUserItems.push(item);
      continue;
    }
    if (item.type === "userMessage") {
      hasReachedUserMessage = true;
      userItems.push(item as UserMessage);
      continue;
    }
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
    if (item.type === "remoteTaskCreated") {
      remoteTaskCreatedItems.push(item);
      continue;
    }
    if (item.type === "autoReviewInterruptionWarning") {
      pinnedPostAssistantItems.push(item);
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
    if (item.type === "forkedFromConversation") {
      forkedFromConversationItems.push(item);
      continue;
    }
    nonUserItems.push(item);
  }

  const assistantMessageIndex = findLastAssistantMessageIndex(nonUserItems);
  const assistantMessage =
    assistantMessageIndex === -1 ? null : (nonUserItems[assistantMessageIndex] as AgentMessage);
  const activityItems =
    assistantMessageIndex === -1 ? nonUserItems : nonUserItems.slice(0, assistantMessageIndex);
  const trailingAutomaticApprovalReviewItems =
    assistantMessageIndex === -1 ? [] : extractTrailingAutomaticApprovalReviewItems(activityItems);
  const normalizedActivityItems =
    trailingAutomaticApprovalReviewItems.length === 0
      ? activityItems
      : activityItems.slice(0, activityItems.length - trailingAutomaticApprovalReviewItems.length);
  const systemEventItem = assistantMessage === null ? extractTrailingSystemEventItem(normalizedActivityItems) : null;
  const finalizedActivityItems =
    systemEventItem === null ? normalizedActivityItems : normalizedActivityItems.slice(0, -1);
  const postAssistantItems = [
    ...pinnedPostAssistantItems,
    ...trailingAutomaticApprovalReviewItems,
    ...(assistantMessageIndex === -1 ? [] : nonUserItems.slice(assistantMessageIndex + 1)),
  ];

  return {
    id: turnId,
    turnId,
    preUserItems,
    userItems,
    activityItems: finalizedActivityItems,
    assistantMessage,
    toolOutputItems,
    postAssistantItems,
    systemEventItem,
    unifiedDiffItem,
    todoListItem,
    proposedPlanItem,
    planImplementationItem: null,
    mcpServerElicitationItems: [],
    permissionRequestItems: [],
    approvalItem: null,
    userInputItem: null,
    remoteTaskCreatedItems,
    personalityChangedItems,
    forkedFromConversationItems,
    modelChangedItems,
    modelReroutedItems,
  };
}

function findLastAssistantMessageIndex(items: RenderableConversationItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item?.type === "agentMessage" &&
      item.role === "assistant" &&
      item.text.trim().length > 0
    ) {
      return index;
    }
  }
  return -1;
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
  return item.type === "streamError" || item.type === "systemError";
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
