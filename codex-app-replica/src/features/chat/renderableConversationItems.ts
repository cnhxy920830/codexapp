import type {
  ThreadConversationCommandExecution,
  ThreadConversationItem,
  ThreadConversationMultiAgentAction,
  ThreadConversationReasoning,
  ThreadConversationWebSearch,
} from "../../services/history";

export type ExplorationGroupItem = {
  type: "explorationGroup";
  id: string;
  turnId: string;
  isInProgress: boolean;
  items: Array<ThreadConversationCommandExecution | ThreadConversationReasoning>;
};

export type WebSearchGroupItem = {
  type: "webSearchGroup";
  id: string;
  turnId: string;
  items: ThreadConversationWebSearch[];
};

export type MultiAgentGroupItem = {
  type: "multiAgentGroup";
  id: string;
  turnId: string;
  action: ThreadConversationMultiAgentAction["action"];
  status: ThreadConversationMultiAgentAction["status"];
  items: ThreadConversationMultiAgentAction[];
};

export type RenderableConversationItem =
  | ThreadConversationItem
  | ExplorationGroupItem
  | WebSearchGroupItem
  | MultiAgentGroupItem;

export function buildRenderableConversationItems(items: ThreadConversationItem[]): RenderableConversationItem[] {
  const filteredItems = filterExitedReviewDuplicateAssistantMessages(items);
  const renderableItems: RenderableConversationItem[] = [];

  for (let index = 0; index < filteredItems.length; ) {
    const item = filteredItems[index];
    if (!item) {
      index += 1;
      continue;
    }

    if (isExplorationCommandExecution(item)) {
      const explorationItems: Array<ThreadConversationCommandExecution | ThreadConversationReasoning> = [item];
      let nextIndex = index + 1;
      while (nextIndex < filteredItems.length) {
        const nextItem = filteredItems[nextIndex];
        if (
          nextItem === undefined ||
          nextItem.turnId !== item.turnId ||
          !isExplorationContinuationItem(nextItem)
        ) {
          break;
        }
        explorationItems.push(nextItem);
        nextIndex += 1;
      }

      renderableItems.push({
        type: "explorationGroup",
        id: `explorationGroup:${item.turnId}:${item.id}`,
        turnId: item.turnId,
        isInProgress: explorationItems.some(
          (explorationItem) =>
            explorationItem.type === "commandExecution" && isCommandExecutionInProgress(explorationItem),
        ),
        items: explorationItems,
      });
      index = nextIndex;
      continue;
    }

    if (item.type === "webSearch") {
      const webSearchItems: ThreadConversationWebSearch[] = [item];
      let nextIndex = index + 1;
      while (nextIndex < filteredItems.length) {
        const nextItem = filteredItems[nextIndex];
        if (nextItem?.type !== "webSearch" || nextItem.turnId !== item.turnId) {
          break;
        }
        webSearchItems.push(nextItem);
        nextIndex += 1;
      }

      renderableItems.push({
        type: "webSearchGroup",
        id: `webSearchGroup:${item.turnId}:${item.id}`,
        turnId: item.turnId,
        items: webSearchItems,
      });
      index = nextIndex;
      continue;
    }

    if (isMultiAgentActionGroupable(item)) {
      const groupItems: ThreadConversationMultiAgentAction[] = [item];
      let nextIndex = index + 1;
      while (nextIndex < filteredItems.length) {
        const nextItem = filteredItems[nextIndex];
        if (!isMatchingMultiAgentActionGroupItem(nextItem, item)) {
          break;
        }
        groupItems.push(nextItem);
        nextIndex += 1;
      }

      renderableItems.push({
        type: "multiAgentGroup",
        id: `multi-agent-group:${item.action}:${item.status}:${item.id}`,
        turnId: item.turnId,
        action: item.action,
        status: item.status,
        items: groupItems,
      });
      index = nextIndex;
      continue;
    }

    renderableItems.push(item);
    index += 1;
  }

  return renderableItems;
}

function filterExitedReviewDuplicateAssistantMessages(items: ThreadConversationItem[]) {
  const exitedReviewTextByTurnId = new Map(
    items
      .filter(
        (item): item is Extract<ThreadConversationItem, { type: "exitedReviewMode" }> =>
          item.type === "exitedReviewMode",
      )
      .map((item) => [item.turnId, item.review.trim()]),
  );

  return items.filter((item) => {
    if (item.type !== "agentMessage") {
      return true;
    }
    const exitedReviewText = exitedReviewTextByTurnId.get(item.turnId);
    return !exitedReviewText || exitedReviewText !== item.text.trim();
  });
}

function isExplorationCommandExecution(
  item: ThreadConversationItem,
): item is ThreadConversationCommandExecution {
  if (item.type !== "commandExecution") {
    return false;
  }
  const commandActions = getCommandActions(item);
  if (commandActions.length === 0) {
    return false;
  }
  return commandActions.every(
    (action) =>
      action.type === "read" || action.type === "listFiles" || action.type === "search",
  );
}

function isExplorationContinuationItem(
  item: ThreadConversationItem,
): item is ThreadConversationCommandExecution | ThreadConversationReasoning {
  return item.type === "reasoning" || isExplorationCommandExecution(item);
}

function isCommandExecutionInProgress(item: ThreadConversationCommandExecution) {
  const normalizedStatus = item.status.trim().toLowerCase();
  if (normalizedStatus === "inprogress" || normalizedStatus === "pending") {
    return true;
  }
  return item.exitCode === null && normalizedStatus !== "completed" && normalizedStatus !== "interrupted";
}

function isMultiAgentActionGroupable(
  item: ThreadConversationItem,
): item is ThreadConversationMultiAgentAction {
  return item.type === "multiAgentAction" && normalizeStatus(item.status) !== "inProgress";
}

function isMatchingMultiAgentActionGroupItem(
  item: ThreadConversationItem | undefined,
  referenceItem: ThreadConversationMultiAgentAction,
): item is ThreadConversationMultiAgentAction {
  return (
    item?.type === "multiAgentAction" &&
    item.turnId === referenceItem.turnId &&
    item.action === referenceItem.action &&
    normalizeStatus(item.status) === normalizeStatus(referenceItem.status) &&
    normalizeStatus(item.status) !== "inProgress"
  );
}

function normalizeStatus(status: string) {
  const normalizedStatus = status.trim();
  if (normalizedStatus === "completed" || normalizedStatus === "failed" || normalizedStatus === "inProgress") {
    return normalizedStatus;
  }
  return normalizedStatus.toLowerCase() === "inprogress" ? "inProgress" : normalizedStatus;
}

function getCommandActions(item: ThreadConversationCommandExecution) {
  return Array.isArray(item.commandActions) ? item.commandActions : [];
}
