import type {
  ThreadConversationCollabAgentToolCall,
  ThreadConversationCommandExecution,
  ThreadConversationItem,
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
  tool: ThreadConversationCollabAgentToolCall["tool"];
  status: ThreadConversationCollabAgentToolCall["status"];
  items: ThreadConversationCollabAgentToolCall[];
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

    if (isCollabAgentToolCallGroupable(item)) {
      const groupItems: ThreadConversationCollabAgentToolCall[] = [item];
      let nextIndex = index + 1;
      while (nextIndex < filteredItems.length) {
        const nextItem = filteredItems[nextIndex];
        if (!isMatchingCollabAgentToolCallGroupItem(nextItem, item)) {
          break;
        }
        groupItems.push(nextItem);
        nextIndex += 1;
      }

      renderableItems.push({
        type: "multiAgentGroup",
        id: `multiAgentGroup:${item.turnId}:${item.tool}:${item.status}:${item.id}`,
        turnId: item.turnId,
        tool: item.tool,
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
  if (item.type !== "commandExecution" || item.commandActions.length === 0) {
    return false;
  }
  return item.commandActions.every(
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

function isCollabAgentToolCallGroupable(
  item: ThreadConversationItem,
): item is ThreadConversationCollabAgentToolCall {
  return item.type === "collabAgentToolCall" && normalizeStatus(item.status) !== "inProgress";
}

function isMatchingCollabAgentToolCallGroupItem(
  item: ThreadConversationItem | undefined,
  referenceItem: ThreadConversationCollabAgentToolCall,
): item is ThreadConversationCollabAgentToolCall {
  return (
    item?.type === "collabAgentToolCall" &&
    item.turnId === referenceItem.turnId &&
    item.tool === referenceItem.tool &&
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
