import type { MessageKey } from "../../i18n/messages";
import type {
  ThreadConversationCollabAgentState,
  ThreadConversationMultiAgentAction,
} from "../../services/history";
import type { MultiAgentGroupItem } from "./renderableConversationItems";

export type TranslateMessage = (key: MessageKey, values?: Record<string, number | string>) => string;

type MultiAgentDisplayTool = "closeAgent" | "resumeAgent" | "sendInput" | "spawnAgent";
type MultiAgentDisplayStatus = "completed" | "failed" | "inProgress";
type MultiAgentAgentStatus = "pendingInit" | "running" | "interrupted" | "completed" | "errored" | "shutdown" | "notFound";

const multiAgentHeaderLabelKeys: Record<
  MultiAgentDisplayTool,
  Record<MultiAgentDisplayStatus, MessageKey>
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.header.close.completed",
    failed: "localConversation.multiAgentAction.header.close.failed",
    inProgress: "localConversation.multiAgentAction.header.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.header.resume.completed",
    failed: "localConversation.multiAgentAction.header.resume.failed",
    inProgress: "localConversation.multiAgentAction.header.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.header.sendInput.completed",
    failed: "localConversation.multiAgentAction.header.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.header.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.header.spawn.completed",
    failed: "localConversation.multiAgentAction.header.spawn.failed",
    inProgress: "localConversation.multiAgentAction.header.spawn.inProgress",
  },
};

const multiAgentRowLabelKeys: Record<
  MultiAgentDisplayTool,
  Record<MultiAgentDisplayStatus, MessageKey>
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.close.completed",
    failed: "localConversation.multiAgentAction.rowAction.close.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.resume.completed",
    failed: "localConversation.multiAgentAction.rowAction.resume.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.rowAction.sendInput.completed",
    failed: "localConversation.multiAgentAction.rowAction.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.rowAction.spawn.completed",
    failed: "localConversation.multiAgentAction.rowAction.spawn.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.spawn.inProgress",
  },
};

const multiAgentSendInputPromptRowLabelKeys: Record<MultiAgentDisplayStatus, MessageKey> = {
  completed: "localConversation.multiAgentAction.rowAction.sendInput.messaged.completed",
  failed: "localConversation.multiAgentAction.rowAction.sendInput.messaged.failed",
  inProgress: "localConversation.multiAgentAction.rowAction.sendInput.messaged.inProgress",
};

const multiAgentAgentStateLabelKeys: Record<MultiAgentAgentStatus, MessageKey> = {
  pendingInit: "localConversation.multiAgentAction.agentState.pendingInit",
  running: "localConversation.multiAgentAction.agentState.running",
  interrupted: "localConversation.multiAgentAction.agentState.interrupted",
  completed: "localConversation.multiAgentAction.agentState.completed",
  errored: "localConversation.multiAgentAction.agentState.errored",
  shutdown: "localConversation.multiAgentAction.agentState.shutdown",
  notFound: "localConversation.multiAgentAction.agentState.notFound",
};

export function buildMultiAgentGroupRows(
  items: MultiAgentGroupItem["items"],
  t: TranslateMessage,
) {
  const rows: string[] = [];

  for (const item of items) {
    const prompt = item.prompt?.trim() ?? "";
    const normalizedStatus = normalizeMultiAgentStatus(item.status);
    const isSpawnWithInstructions =
      item.action === "spawnAgent" && normalizedStatus === "completed" && prompt.length > 0;
    const isSendInputWithPrompt = item.action === "sendInput" && prompt.length > 0;
    const action = resolveMultiAgentActionLabel(item.action, item.status, t, "row");
    const receiverThreadIds = collectMultiAgentReceiverThreadIds(item);
    const agentsStates = getAgentsStates(item);

    if (receiverThreadIds.length === 0) {
      rows.push(t("localConversation.multiAgentAction.row.generic", { action }));
    } else {
      for (const receiverThreadId of receiverThreadIds) {
        if (isSpawnWithInstructions) {
          rows.push(
            t("localConversation.multiAgentAction.row.spawn.createdWithInstructions", {
              agent: receiverThreadId,
              instructions: prompt,
            }),
          );
          continue;
        }

        if (isSendInputWithPrompt) {
          rows.push(
            t("localConversation.multiAgentAction.row.sendInput.messagedWithPrompt", {
              action: resolveMultiAgentSendInputPromptActionLabel(item.status, t),
              agent: receiverThreadId,
              prompt,
            }),
          );
          continue;
        }

        rows.push(
          t("localConversation.multiAgentAction.row.agent", {
            action,
            agent: receiverThreadId,
            stateSuffix: resolveMultiAgentStateSuffix(item.action, agentsStates[receiverThreadId], t),
          }),
        );
      }
    }

    if (!isSpawnWithInstructions && !isSendInputWithPrompt && prompt.length > 0) {
      rows.push(
        t("localConversation.multiAgentAction.meta.prompt", {
          prompt,
        }),
      );
    }
  }

  return rows;
}

export function resolveMultiAgentActionLabel(
  action: MultiAgentGroupItem["action"],
  status: MultiAgentGroupItem["status"],
  t: TranslateMessage,
  context: "header" | "row",
) {
  const resolvedStatus = normalizeMultiAgentStatus(status);
  const labelKey =
    isMultiAgentDisplayTool(action) && resolvedStatus
      ? context === "header"
        ? multiAgentHeaderLabelKeys[action][resolvedStatus]
        : multiAgentRowLabelKeys[action][resolvedStatus]
      : null;

  if (labelKey) {
    return t(labelKey);
  }

  const normalizedTool = action
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  if (normalizedTool.length === 0) {
    return resolvedStatus === "failed" ? t("app.chat.status.failed") : t("app.chat.status.completed");
  }

  const verb = normalizedTool.replaceAll(/\b\w/g, (character) => character.toUpperCase());
  return resolvedStatus === "failed" ? `${t("app.chat.status.failed")} ${verb}` : verb;
}

export function resolveMultiAgentCountLabel(
  items: MultiAgentGroupItem["items"],
  t: TranslateMessage,
) {
  const count = resolveMultiAgentReceiverCount(items);
  return count > 0 ? t("localConversation.multiAgentAction.header.count", { count }) : "";
}

export function resolveMultiAgentReceiverCount(items: MultiAgentGroupItem["items"]) {
  const receiverThreadIds = new Set(items.flatMap(collectMultiAgentReceiverThreadIds));
  if (receiverThreadIds.size > 0) {
    return receiverThreadIds.size;
  }
  return items.length;
}

export function toSingleMultiAgentGroupItem(
  item: ThreadConversationMultiAgentAction,
): MultiAgentGroupItem {
  return {
    type: "multiAgentGroup",
    id: `multi-agent-group:${item.action}:${item.status}:${item.id}`,
    turnId: item.turnId,
    action: item.action,
    status: item.status,
    items: [item],
  };
}

function isMultiAgentDisplayTool(action: MultiAgentGroupItem["action"]): action is MultiAgentDisplayTool {
  return action === "closeAgent" || action === "resumeAgent" || action === "sendInput" || action === "spawnAgent";
}

function collectMultiAgentReceiverThreadIds(item: MultiAgentGroupItem["items"][number]) {
  return Array.from(new Set([...getReceiverThreadIds(item), ...getAgentStateThreadIds(item)])).sort();
}

function resolveMultiAgentSendInputPromptActionLabel(
  status: MultiAgentGroupItem["status"],
  t: TranslateMessage,
) {
  return t(multiAgentSendInputPromptRowLabelKeys[normalizeMultiAgentStatus(status)]);
}

function resolveMultiAgentStateSuffix(
  action: MultiAgentGroupItem["action"],
  agentState: ThreadConversationCollabAgentState | undefined,
  t: TranslateMessage,
) {
  if (action === "closeAgent" || action === "resumeAgent" || agentState === undefined) {
    return "";
  }

  const label = resolveMultiAgentAgentStateLabel(agentState.status, t);
  const message = agentState.message?.trim() ?? "";
  return message.length === 0 ? ` (${label})` : ` (${label}: ${message})`;
}

function resolveMultiAgentAgentStateLabel(status: string, t: TranslateMessage) {
  const normalizedStatus = normalizeMultiAgentAgentStatus(status);
  if (normalizedStatus === null) {
    return status.trim();
  }
  return t(multiAgentAgentStateLabelKeys[normalizedStatus]);
}

function normalizeMultiAgentStatus(status: MultiAgentGroupItem["status"]): MultiAgentDisplayStatus {
  if (status === "completed" || status === "failed" || status === "inProgress") {
    return status;
  }
  return status.trim().toLowerCase() === "inprogress" ? "inProgress" : "completed";
}

function normalizeMultiAgentAgentStatus(status: string): MultiAgentAgentStatus | null {
  const normalizedStatus = status.trim();
  switch (normalizedStatus) {
    case "pendingInit":
    case "running":
    case "interrupted":
    case "completed":
    case "errored":
    case "shutdown":
    case "notFound":
      return normalizedStatus;
    default:
      return null;
  }
}

export function isMultiAgentInProgressStatus(status: MultiAgentGroupItem["status"]) {
  return normalizeMultiAgentStatus(status) === "inProgress";
}

function getReceiverThreadIds(item: MultiAgentGroupItem["items"][number]) {
  return (item.receiverThreads ?? [])
    .map((receiverThread) => receiverThread.threadId.trim())
    .filter((receiverThreadId) => receiverThreadId.length > 0);
}

function getAgentStateThreadIds(item: MultiAgentGroupItem["items"][number]) {
  return Object.keys(getAgentsStates(item));
}

function getAgentsStates(item: MultiAgentGroupItem["items"][number]) {
  if (!item.agentsStates || typeof item.agentsStates !== "object" || Array.isArray(item.agentsStates)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(item.agentsStates)
      .map(([receiverThreadId, agentState]) => [receiverThreadId.trim(), agentState] as const)
      .filter(([receiverThreadId]) => receiverThreadId.length > 0),
  );
}
