import type { MessageKey, MessageValues } from "../../i18n/messages";
import type {
  ThreadConversation,
  ThreadConversationItem,
  ThreadHistoryEntry,
} from "../../services/history";
import type { RemoteTask } from "../../services/remoteTasks";

const RUNNING_NOTIFICATION_EXPIRY_MS = 180_000;
const FAILED_NOTIFICATION_EXPIRY_MS = 3_600_000;
const WAITING_NOTIFICATION_EXPIRY_MS = 86_400_000;
const REVIEW_NOTIFICATION_EXPIRY_MS = 604_800_000;

type Translate = (key: MessageKey, values?: MessageValues) => string;

export type AvatarOverlayNotificationStatus =
  | "running"
  | "waiting"
  | "failed"
  | "review";

export type AvatarOverlayNotificationLevel = "info" | "warning" | "danger" | "success";

export type AvatarOverlayNotificationSource = "local" | "cloud";

export type AvatarOverlayNotification = {
  id: string;
  actionPath: string;
  body: string | null;
  canDismiss: boolean;
  expiresAtMs: number;
  isLoading: boolean;
  level: AvatarOverlayNotificationLevel;
  localConversationId: string | null;
  source: AvatarOverlayNotificationSource;
  status: AvatarOverlayNotificationStatus;
  title: string;
  turnKey: string | null;
  updatedAtMs: number;
};

export type AvatarOverlayNotificationSnapshot = {
  nextExpiresAtMs: number | null;
  notifications: AvatarOverlayNotification[];
};

type AvatarOverlaySession =
  | {
      kind: "local";
      entry: ThreadHistoryEntry;
      conversation: ThreadConversation | undefined;
    }
  | {
      kind: "cloud";
      task: RemoteTask;
    };

export function deriveAvatarOverlayNotifications(options: {
  conversationsByThreadId: ReadonlyMap<string, ThreadConversation>;
  dismissedNotificationTurnKeys?: ReadonlyMap<string, string | null>;
  nowMs?: number;
  recentThreads: ThreadHistoryEntry[];
  remoteTasks: RemoteTask[];
  translate: Translate;
}): AvatarOverlayNotificationSnapshot {
  const { conversationsByThreadId, recentThreads, remoteTasks, translate } = options;
  const nowMs = options.nowMs ?? Date.now();
  const dismissedNotificationTurnKeys = options.dismissedNotificationTurnKeys;
  const notifications: AvatarOverlayNotification[] = [];
  let nextExpiresAtMs: number | null = null;
  const keys = new Set<string>();

  for (const session of buildSessions({ conversationsByThreadId, recentThreads, remoteTasks })) {
    const notification = deriveNotification(session, translate);
    if (notification == null) {
      continue;
    }

    if (dismissedNotificationTurnKeys?.get(notification.id) === notification.turnKey) {
      continue;
    }

    if (nowMs >= notification.expiresAtMs) {
      continue;
    }

    if (keys.has(notification.id)) {
      continue;
    }
    keys.add(notification.id);

    if (nextExpiresAtMs == null || notification.expiresAtMs < nextExpiresAtMs) {
      nextExpiresAtMs = notification.expiresAtMs;
    }

    notifications.push(notification);
  }

  notifications.sort(compareNotifications);

  return {
    nextExpiresAtMs,
    notifications,
  };
}

function buildSessions(options: {
  conversationsByThreadId: ReadonlyMap<string, ThreadConversation>;
  recentThreads: ThreadHistoryEntry[];
  remoteTasks: RemoteTask[];
}) {
  const sessions: AvatarOverlaySession[] = [];

  for (const entry of options.recentThreads) {
    if (isSubagentThread(entry)) {
      continue;
    }
    sessions.push({
      kind: "local",
      entry,
      conversation: options.conversationsByThreadId.get(entry.id),
    });
  }

  for (const task of options.remoteTasks) {
    sessions.push({
      kind: "cloud",
      task,
    });
  }

  return sessions;
}

function deriveNotification(
  session: AvatarOverlaySession,
  translate: Translate,
): AvatarOverlayNotification | null {
  if (session.kind === "local") {
    const status = deriveLocalNotificationStatus(session.entry, session.conversation);
    if (status === "idle") {
      return null;
    }

    const updatedAtMs = session.entry.updatedAt * 1000;
    return {
      id: `local:${session.entry.id}`,
      actionPath: `/local/${session.entry.id}`,
      body: deriveLocalNotificationBody(session.conversation, translate),
      canDismiss: true,
      expiresAtMs: getNotificationExpiresAtMs(status, updatedAtMs),
      isLoading: status === "running",
      level: getNotificationLevel(status),
      localConversationId: session.entry.id,
      source: "local",
      status,
      title: deriveLocalNotificationTitle(session.entry, session.conversation, translate),
      turnKey: String(session.conversation?.turns.length ?? 0),
      updatedAtMs,
    };
  }

  const status = deriveRemoteTaskNotificationStatus(session.task);
  if (status === "idle") {
    return null;
  }

  const updatedAtMs = (session.task.updated_at ?? session.task.created_at ?? 0) * 1000;
  const turnKey = session.task.task_status_display?.latest_turn_status_display?.turn_id ?? null;

  return {
    id: `cloud:${session.task.id}`,
    actionPath: `/remote/${session.task.id}`,
    body: null,
    canDismiss: true,
    expiresAtMs: getNotificationExpiresAtMs(status, updatedAtMs),
    isLoading: status === "running",
    level: getNotificationLevel(status),
    localConversationId: null,
    source: "cloud",
    status,
    title:
      session.task.title?.trim() || translate("avatarOverlay.session.newThread"),
    turnKey,
    updatedAtMs,
  };
}

function isSubagentThread(entry: ThreadHistoryEntry) {
  return entry.source?.parentThreadId != null;
}

function deriveLocalNotificationStatus(
  entry: ThreadHistoryEntry,
  conversation: ThreadConversation | undefined,
): AvatarOverlayNotificationStatus | "idle" {
  switch (entry.status.type) {
    case "systemError":
      return "failed";
    case "active":
      return entry.status.activeFlags.some(
        (flag) => flag === "waitingOnApproval" || flag === "waitingOnUserInput",
      )
        ? "waiting"
        : "running";
    case "idle":
    case "notLoaded":
      break;
    default:
      return "idle";
  }

  if (conversation == null) {
    return "idle";
  }

  const latestTurnStatus = conversation.turns.at(-1)?.status;
  if (latestTurnStatus === "failed") {
    return "failed";
  }

  if (hasPendingRequest(conversation.items)) {
    return "waiting";
  }

  if (latestTurnStatus === "inProgress") {
    return "running";
  }

  if (conversation.items.some(isFailureItem)) {
    return "failed";
  }

  return "idle";
}

function deriveRemoteTaskNotificationStatus(
  task: RemoteTask,
): AvatarOverlayNotificationStatus | "idle" {
  if (task.archived === true) {
    return "idle";
  }

  const latestTurnStatus = task.task_status_display?.latest_turn_status_display?.turn_status;
  if (latestTurnStatus === "failed" || latestTurnStatus === "cancelled") {
    return "failed";
  }
  if (latestTurnStatus === "in_progress" || latestTurnStatus === "pending") {
    return "running";
  }
  if (task.has_unread_turn === true) {
    return "review";
  }
  return "idle";
}

function hasPendingRequest(items: ThreadConversationItem[]) {
  return items.some((item) => {
    switch (item.type) {
      case "permissionRequest":
      case "mcpServerElicitation":
      case "userInput":
        return item.completed === false;
      default:
        return false;
    }
  });
}

function isFailureItem(item: ThreadConversationItem) {
  return item.type === "systemError" || item.type === "streamError";
}

function getNotificationExpiresAtMs(
  status: AvatarOverlayNotificationStatus,
  updatedAtMs: number,
) {
  switch (status) {
    case "running":
      return updatedAtMs + RUNNING_NOTIFICATION_EXPIRY_MS;
    case "failed":
      return updatedAtMs + FAILED_NOTIFICATION_EXPIRY_MS;
    case "waiting":
      return updatedAtMs + WAITING_NOTIFICATION_EXPIRY_MS;
    case "review":
      return updatedAtMs + REVIEW_NOTIFICATION_EXPIRY_MS;
  }
}

function getNotificationLevel(
  status: AvatarOverlayNotificationStatus,
): AvatarOverlayNotificationLevel {
  switch (status) {
    case "waiting":
      return "warning";
    case "failed":
      return "danger";
    case "review":
      return "success";
    case "running":
      return "info";
  }
}

function deriveLocalNotificationTitle(
  entry: ThreadHistoryEntry,
  conversation: ThreadConversation | undefined,
  translate: Translate,
) {
  const title = conversation?.title?.trim() || entry.name?.trim() || entry.preview.trim();
  return title.length > 0 ? title : translate("avatarOverlay.session.newThread");
}

function deriveLocalNotificationBody(
  conversation: ThreadConversation | undefined,
  translate: Translate,
) {
  if (conversation == null) {
    return null;
  }

  const readableText = extractReadableConversationText(conversation.items);
  if (readableText != null) {
    return readableText;
  }

  for (let index = conversation.items.length - 1; index >= 0; index -= 1) {
    const description = describeConversationItem(conversation.items[index], translate);
    if (description != null) {
      return description;
    }
  }

  return null;
}

function extractReadableConversationText(items: ThreadConversationItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.type === "reasoning") {
      for (let summaryIndex = item.summary.length - 1; summaryIndex >= 0; summaryIndex -= 1) {
        const cleanedSummary = cleanActivityText(item.summary[summaryIndex] ?? "");
        if (cleanedSummary != null) {
          return cleanedSummary;
        }
      }
    }

    if (item.type === "agentMessage") {
      const cleanedMessage = cleanActivityText(item.text);
      if (cleanedMessage != null) {
        return cleanedMessage;
      }
    }
  }

  return null;
}

function describeConversationItem(
  item: ThreadConversationItem,
  translate: Translate,
) {
  switch (item.type) {
    case "commandExecution": {
      const latestAction = item.commandActions.at(-1);
      const isRunning = item.status === "inProgress";
      if (latestAction == null) {
        return isRunning
          ? translate("avatarOverlay.session.runningCommand")
          : translate("avatarOverlay.session.ranCommand");
      }

      switch (latestAction.type) {
        case "read":
          return isRunning
            ? translate("avatarOverlay.session.readingFile", {
                fileName: latestAction.name,
              })
            : translate("avatarOverlay.session.readFile", {
                fileName: latestAction.name,
              });
        case "listFiles":
          return isRunning
            ? translate("avatarOverlay.session.listingFiles")
            : translate("avatarOverlay.session.listedFiles");
        case "search": {
          const cleanedQuery = cleanActivityText(latestAction.query ?? "");
          if (cleanedQuery == null) {
            return isRunning
              ? translate("avatarOverlay.session.searchingFiles")
              : translate("avatarOverlay.session.searchedFiles");
          }

          return isRunning
            ? translate("avatarOverlay.session.searchingQuery", {
                query: cleanedQuery,
              })
            : translate("avatarOverlay.session.searchedQuery", {
                query: cleanedQuery,
              });
        }
        case "unknown":
          return isRunning
            ? translate("avatarOverlay.session.runningCommand")
            : translate("avatarOverlay.session.ranCommand");
      }
      break;
    }
    case "fileChange":
      return item.status === "inProgress"
        ? translate("avatarOverlay.session.editingFiles", {
            fileCount: item.changes.length,
          })
        : translate("avatarOverlay.session.editedFiles", {
            fileCount: item.changes.length,
          });
    case "mcpToolCall": {
      const toolName = cleanActivityText(item.tool.replace(/[_-]+/g, " "));
      const isRunning = item.status === "inProgress";
      if (toolName == null) {
        return isRunning
          ? translate("avatarOverlay.session.callingTool")
          : translate("avatarOverlay.session.calledTool");
      }

      return isRunning
        ? translate("avatarOverlay.session.callingToolName", {
            toolName,
          })
        : translate("avatarOverlay.session.calledToolName", {
            toolName,
          });
    }
    case "webSearch": {
      const cleanedQuery = cleanActivityText(item.query);
      return cleanedQuery == null
        ? translate("avatarOverlay.session.searchedWeb")
        : translate("avatarOverlay.session.searchedQuery", {
            query: cleanedQuery,
          });
    }
    default:
      return null;
  }
}

function compareNotifications(
  left: AvatarOverlayNotification,
  right: AvatarOverlayNotification,
) {
  const priorityDelta =
    getNotificationPriority(left.status) - getNotificationPriority(right.status);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const updatedAtDelta = right.updatedAtMs - left.updatedAtMs;
  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return left.id.localeCompare(right.id);
}

function getNotificationPriority(status: AvatarOverlayNotificationStatus) {
  switch (status) {
    case "waiting":
      return 0;
    case "failed":
      return 1;
    case "review":
      return 2;
    case "running":
      return 3;
  }
}

function cleanActivityText(value: string) {
  const cleaned = value
    .replace(/\r?\n+/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}
