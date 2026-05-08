import type {
  ThreadConversationAutomaticApprovalReview,
  ThreadConversationAutomationUpdate,
  ThreadConversationCommandExecution,
  ThreadConversationFileChange,
  ThreadConversationItem,
  ThreadConversationMcpToolCall,
  ThreadConversationWorkedFor,
  ThreadConversationMultiAgentAction,
  ThreadConversationReasoning,
  ThreadConversationTurnTiming,
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

export type CollapsedToolActivitySummary = {
  createdFileCount: number;
  editedFileCount: number;
  deletedFileCount: number;
  exploredFileCount: number;
  searchCount: number;
  listCount: number;
  approvedRequestCount: number;
  deniedRequestCount: number;
  commandCount: number;
  mcpToolCallCount: number;
  webSearchCount: number;
};

export type CollapsibleToolActivityItem =
  | ExplorationGroupItem
  | WebSearchGroupItem
  | ThreadConversationCommandExecution
  | ThreadConversationFileChange
  | ThreadConversationMcpToolCall
  | ThreadConversationAutomaticApprovalReview;

export type CollapsedToolActivityItem = {
  type: "collapsedToolActivity";
  id: string;
  turnId: string;
  isInProgress: boolean;
  items: CollapsibleToolActivityItem[];
  summary: CollapsedToolActivitySummary;
};

export type RenderableConversationItem =
  | ThreadConversationItem
  | ExplorationGroupItem
  | WebSearchGroupItem
  | MultiAgentGroupItem
  | CollapsedToolActivityItem;

export function buildRenderableConversationItems(
  items: ThreadConversationItem[],
  options?: {
    turnTimings?: ThreadConversationTurnTiming[];
  },
): RenderableConversationItem[] {
  const normalizedItems = normalizeSyntheticConversationItems(items, options?.turnTimings ?? []);
  const filteredItems = omitHiddenConversationItems(
    filterExitedReviewDuplicateAssistantMessages(normalizedItems),
  );
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

export function collapseToolActivityItems(items: RenderableConversationItem[]): RenderableConversationItem[] {
  const nextItems: RenderableConversationItem[] = [];

  for (let index = 0; index < items.length; ) {
    const item = items[index];
    if (!item || !isCollapsibleToolActivityItem(item)) {
      if (item) {
        nextItems.push(item);
      }
      index += 1;
      continue;
    }

    const groupItems: CollapsibleToolActivityItem[] = [item];
    let nextIndex = index + 1;

    while (nextIndex < items.length) {
      const nextItem = items[nextIndex];
      if (!nextItem || !isCollapsibleToolActivityItem(nextItem)) {
        break;
      }
      if (shouldSplitCollapsedToolActivityGroup(groupItems.at(-1), nextItem)) {
        break;
      }
      groupItems.push(nextItem);
      nextIndex += 1;
    }

    if (groupItems.length === 1) {
      nextItems.push(item);
    } else {
      nextItems.push(buildCollapsedToolActivityItem(groupItems));
    }
    index = nextIndex;
  }

  return nextItems;
}

export function resolveCollapsedToolActivitySummaryText(summary: CollapsedToolActivitySummary) {
  const summaryParts: string[] = [];

  pushCollapsedToolActivityCount(summaryParts, summary.createdFileCount, "Created", "created", "file", "files");
  pushCollapsedToolActivityCount(summaryParts, summary.editedFileCount, "Edited", "edited", "file", "files");
  pushCollapsedToolActivityCount(summaryParts, summary.deletedFileCount, "Deleted", "deleted", "file", "files");

  const explorationParts = [
    formatCollapsedToolActivityCount(summary.exploredFileCount, "file", "files"),
    formatCollapsedToolActivityCount(summary.searchCount, "search", "searches"),
    formatCollapsedToolActivityCount(summary.listCount, "list", "lists"),
  ].filter((value): value is string => value !== null);
  if (explorationParts.length > 0) {
    summaryParts.push(
      `${summaryParts.length === 0 ? "Explored" : "explored"} ${explorationParts.join(", ")}`,
    );
  }

  pushCollapsedToolActivityCount(summaryParts, summary.approvedRequestCount, "Approved", "approved", "request", "requests");
  pushCollapsedToolActivityCount(summaryParts, summary.deniedRequestCount, "Denied", "denied", "request", "requests");
  pushCollapsedToolActivityCount(summaryParts, summary.commandCount, "Ran", "ran", "command", "commands");
  pushCollapsedToolActivityCount(summaryParts, summary.mcpToolCallCount, "Called", "called", "tool", "tools");
  pushCollapsedToolActivityCount(summaryParts, summary.webSearchCount, "Searched web", "searched web", "time", "times");

  return summaryParts.length === 0 ? "Tool activity" : summaryParts.join(", ");
}

export function buildCollapsedToolActivityDetailLines(item: CollapsedToolActivityItem) {
  const detailLines: string[] = [];

  for (const entry of item.items) {
    if (entry.type === "commandExecution") {
      const command = entry.command.trim();
      if (command.length > 0) {
        detailLines.push(`Ran ${command}`);
      }
      continue;
    }

    if (entry.type !== "fileChange") {
      continue;
    }

    for (const change of entry.changes) {
      const stats = countCollapsedToolActivityDiffStats(change.diff ?? "");
      detailLines.push(
        `${resolveCollapsedToolActivityFileChangeVerb(change.kind)} ${change.path} (+${stats.additions} -${stats.deletions})`,
      );
    }
  }

  return detailLines;
}

function normalizeSyntheticConversationItems(
  items: ThreadConversationItem[],
  turnTimings: ThreadConversationTurnTiming[],
) {
  const normalizedItems = normalizeSteerConversationItems(items).filter(hasRenderableTurnId);
  if (turnTimings.length === 0) {
    return normalizedItems;
  }

  const itemsByTurnId = new Map<string, ThreadConversationItem[]>();
  for (const item of normalizedItems) {
    const currentTurnItems = itemsByTurnId.get(item.turnId) ?? [];
    currentTurnItems.push(item);
    itemsByTurnId.set(item.turnId, currentTurnItems);
  }

  const syntheticItemsByTurnId = new Map<string, ThreadConversationWorkedFor>();
  for (const turnTiming of turnTimings) {
    const syntheticItem = createWorkedForItem(
      itemsByTurnId.get(turnTiming.turnId) ?? [],
      turnTiming,
    );
    if (syntheticItem !== null) {
      syntheticItemsByTurnId.set(turnTiming.turnId, syntheticItem);
    }
  }

  if (syntheticItemsByTurnId.size === 0) {
    return normalizedItems;
  }

  const nextItems: ThreadConversationItem[] = [];
  const insertedTurns = new Set<string>();
  const workedTurnIds = new Set(
    [...syntheticItemsByTurnId.entries()]
      .filter(([, item]) => item.type === "workedFor" && item.status === "worked")
      .map(([turnId]) => turnId),
  );

  for (const item of normalizedItems) {
    const turnSyntheticItem = syntheticItemsByTurnId.get(item.turnId);
    if (
      turnSyntheticItem !== undefined &&
      !insertedTurns.has(item.turnId) &&
      shouldInsertWorkedForBeforeItem(turnSyntheticItem, item)
    ) {
      nextItems.push(turnSyntheticItem);
      insertedTurns.add(item.turnId);
    }

    nextItems.push(item);
  }

  for (const [turnId, syntheticItem] of syntheticItemsByTurnId.entries()) {
    if (!insertedTurns.has(turnId) && !workedTurnIds.has(turnId)) {
      nextItems.push(syntheticItem);
    }
  }

  return nextItems;
}

function createWorkedForItem(
  items: ThreadConversationItem[],
  turnTiming: ThreadConversationTurnTiming,
) {
  const hasStartedWork = items.some((item) => !isNonWorkConversationItem(item));
  const startedAtMs = turnTiming.firstTurnWorkItemStartedAtMs;
  if (!hasStartedWork || startedAtMs === null) {
    return null;
  }

  const completedAtMs = resolveWorkedForCompletedAtMs(items, turnTiming);
  if (isTurnInProgress(turnTiming.status)) {
    if (completedAtMs === null) {
      return {
        type: "workedFor",
        id: `worked-for:${turnTiming.turnId}`,
        turnId: turnTiming.turnId,
        status: "working",
        startedAtMs,
        completedAtMs: null,
      } satisfies ThreadConversationItem;
    }

    return {
      type: "workedFor",
      id: `worked-for:${turnTiming.turnId}`,
      turnId: turnTiming.turnId,
      status: "worked",
      startedAtMs,
      completedAtMs,
    } satisfies ThreadConversationItem;
  }

  if (completedAtMs === null) {
    return null;
  }

  return {
    type: "workedFor",
    id: `worked-for:${turnTiming.turnId}`,
    turnId: turnTiming.turnId,
    status: "worked",
    startedAtMs,
    completedAtMs,
  } satisfies ThreadConversationItem;
}

function shouldInsertWorkedForBeforeItem(
  workedForItem: Extract<ThreadConversationItem, { type: "workedFor" }>,
  item: ThreadConversationItem,
) {
  if (workedForItem.status === "working") {
    return !isNonWorkConversationItem(item);
  }

  return item.type === "agentMessage" && item.role === "assistant" && item.text.trim().length > 0;
}

function resolveWorkedForCompletedAtMs(
  items: ThreadConversationItem[],
  turnTiming: ThreadConversationTurnTiming,
) {
  if (!isTurnInProgress(turnTiming.status)) {
    return turnTiming.finalAssistantStartedAtMs;
  }

  const finalAssistantStartedAtMs = turnTiming.finalAssistantStartedAtMs;
  if (finalAssistantStartedAtMs === null) {
    return null;
  }

  const hasCompletedAssistant = items.some(
    (item) =>
      item.type === "agentMessage" &&
      item.role === "assistant" &&
      item.text.trim().length > 0 &&
      item.completed,
  );
  return hasCompletedAssistant ? finalAssistantStartedAtMs : null;
}

function isTurnInProgress(status: string) {
  const normalizedStatus = status.trim().toLowerCase();
  return normalizedStatus === "inprogress" || normalizedStatus === "in_progress";
}

function isNonWorkConversationItem(item: ThreadConversationItem) {
  return item.type === "userMessage" || item.type === "hook" || item.type === "automationUpdate";
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

function omitHiddenConversationItems(items: ThreadConversationItem[]) {
  return items.filter(
    (item) =>
      item.type !== "enteredReviewMode" &&
      item.type !== "exitedReviewMode" &&
      item.type !== "hookPrompt",
  );
}

function normalizeSteerConversationItems(items: ThreadConversationItem[]) {
  return items.flatMap((item): ThreadConversationItem[] => {
    if (item.type === "steered") {
      return [];
    }
    if (item.type === "steeringUserMessage") {
      return [
        {
          type: "userMessage",
          id: item.id,
          turnId: item.turnId,
          role: "user",
          text: item.text,
          completed: item.status === "accepted",
          steeringStatus: item.status,
        },
      ];
    }
    return [item];
  });
}

function hasRenderableTurnId(
  item: ThreadConversationItem,
): item is ThreadConversationItem & { turnId: string } {
  return item.turnId !== null;
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

function isCollapsibleToolActivityItem(
  item: RenderableConversationItem,
): item is CollapsibleToolActivityItem {
  if (item.type === "explorationGroup" || item.type === "webSearchGroup") {
    return true;
  }

  if (item.type === "fileChange" || item.type === "commandExecution" || item.type === "mcpToolCall") {
    return true;
  }

  return (
    item.type === "automaticApprovalReview" &&
    (item.status === "approved" || item.status === "denied")
  );
}

function shouldSplitCollapsedToolActivityGroup(
  previousItem: CollapsibleToolActivityItem | undefined,
  nextItem: CollapsibleToolActivityItem,
) {
  return (
    previousItem?.type === "mcpToolCall" &&
    nextItem.type === "mcpToolCall" &&
    previousItem.server.trim() !== nextItem.server.trim()
  );
}

function buildCollapsedToolActivityItem(items: CollapsibleToolActivityItem[]): CollapsedToolActivityItem {
  const firstItem = items[0];
  const summary = buildCollapsedToolActivitySummary(items);

  return {
    type: "collapsedToolActivity",
    id: `collapsedToolActivity:${firstItem.turnId}:${firstItem.id}`,
    turnId: firstItem.turnId,
    isInProgress: items.some(isCollapsedToolActivityItemInProgress),
    items,
    summary,
  };
}

function buildCollapsedToolActivitySummary(items: CollapsibleToolActivityItem[]): CollapsedToolActivitySummary {
  let createdFileCount = 0;
  let editedFileCount = 0;
  let deletedFileCount = 0;
  const exploredPaths = new Set<string>();
  let searchCount = 0;
  let listCount = 0;
  let approvedRequestCount = 0;
  let deniedRequestCount = 0;
  let commandCount = 0;
  let mcpToolCallCount = 0;
  let webSearchCount = 0;

  for (const item of items) {
    if (item.type === "explorationGroup") {
      for (const groupedItem of item.items) {
        if (groupedItem.type !== "commandExecution") {
          continue;
        }
        for (const action of getCommandActions(groupedItem)) {
          if (action.type === "read") {
            const pathKey = (action.path || action.name).trim();
            if (pathKey.length > 0) {
              exploredPaths.add(pathKey);
            }
            continue;
          }
          if (action.type === "search") {
            searchCount += 1;
            continue;
          }
          if (action.type === "listFiles") {
            listCount += 1;
          }
        }
      }
      continue;
    }

    if (item.type === "webSearchGroup") {
      webSearchCount += item.items.length;
      continue;
    }

    if (item.type === "fileChange") {
      for (const change of item.changes) {
        if (change.kind === "delete") {
          deletedFileCount += 1;
          continue;
        }
        if (change.kind === "add") {
          createdFileCount += 1;
          continue;
        }
        editedFileCount += 1;
      }
      continue;
    }

    if (item.type === "commandExecution") {
      commandCount += 1;
      continue;
    }

    if (item.type === "mcpToolCall") {
      mcpToolCallCount += 1;
      continue;
    }

    if (item.type === "automaticApprovalReview") {
      if (item.status === "approved") {
        approvedRequestCount += 1;
        continue;
      }
      if (item.status === "denied") {
        deniedRequestCount += 1;
      }
    }
  }

  return {
    createdFileCount,
    editedFileCount,
    deletedFileCount,
    exploredFileCount: exploredPaths.size,
    searchCount,
    listCount,
    approvedRequestCount,
    deniedRequestCount,
    commandCount,
    mcpToolCallCount,
    webSearchCount,
  };
}

function isCollapsedToolActivityItemInProgress(item: CollapsibleToolActivityItem) {
  if (item.type === "explorationGroup") {
    return item.isInProgress;
  }

  if (item.type === "webSearchGroup") {
    return item.items.some((entry) => !entry.completed);
  }

  if (item.type === "fileChange") {
    return isCollapsedToolActivityStatusInProgress(item.status);
  }

  if (item.type === "commandExecution") {
    return isCommandExecutionInProgress(item);
  }

  if (item.type === "mcpToolCall") {
    return isCollapsedToolActivityStatusInProgress(item.status);
  }

  return false;
}

function isCollapsedToolActivityStatusInProgress(status: string) {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus === "inprogress" || normalizedStatus === "pending") {
    return true;
  }
  return normalizedStatus !== "completed" && normalizedStatus !== "failed" && normalizedStatus !== "interrupted";
}

function pushCollapsedToolActivityCount(
  summaryParts: string[],
  count: number,
  firstVerb: string,
  subsequentVerb: string,
  singularLabel: string,
  pluralLabel: string,
) {
  const countLabel = formatCollapsedToolActivityCount(count, singularLabel, pluralLabel);
  if (countLabel !== null) {
    summaryParts.push(`${summaryParts.length === 0 ? firstVerb : subsequentVerb} ${countLabel}`);
  }
}

function formatCollapsedToolActivityCount(
  count: number,
  singularLabel: string,
  pluralLabel: string,
) {
  return count === 0 ? null : `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function resolveCollapsedToolActivityFileChangeVerb(kind: string) {
  switch (kind) {
    case "add":
      return "Created";
    case "delete":
      return "Deleted";
    default:
      return "Edited";
  }
}

function countCollapsedToolActivityDiffStats(diff: string) {
  let additions = 0;
  let deletions = 0;

  for (const line of diff.replaceAll(/\r\n?/g, "\n").split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}
