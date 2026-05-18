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
const LOCAL_HOST_ID = "local";

type Translate = (key: MessageKey, values?: MessageValues) => string;

export type AvatarOverlayNotificationStatus =
  | "running"
  | "waiting"
  | "failed"
  | "review";

export type AvatarOverlayNotificationLevel = "info" | "warning" | "danger" | "success";

export type AvatarOverlayNotificationSource = "local" | "remote-host" | "cloud";

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

type DerivedSession = {
  actionPath: string;
  hostId: string | null;
  key: string;
  localConversationId: string | null;
  source: AvatarOverlayNotificationSource;
  status: AvatarOverlayNotificationStatus | "idle";
  subtitle: string | null;
  title: string;
  turnKey: string | null;
  updatedAtMs: number;
};

type DerivedNotification = {
  expiresAtMs: number | null;
  key: string;
  notification: AvatarOverlayNotification;
  notificationPriority: number;
  updatedAtMs: number;
};

export function deriveAvatarOverlayNotifications(options: {
  conversationsByThreadId: ReadonlyMap<string, ThreadConversation>;
  dismissedNotificationTurnKeys?: ReadonlyMap<string, string | null>;
  nowMs?: number;
  recentThreads: ThreadHistoryEntry[];
  remoteTasks: RemoteTask[];
  translate: Translate;
}): AvatarOverlayNotificationSnapshot {
  const nowMs = options.nowMs ?? Date.now();
  const sessions = buildSessions(options);
  const notifications: DerivedNotification[] = [];
  let nextExpiresAtMs: number | null = null;

  for (const session of sessions) {
    const derived = deriveNotification(session, nowMs, options.translate);
    if (derived == null) {
      continue;
    }
    if (
      options.dismissedNotificationTurnKeys?.get(derived.notification.id) ===
      derived.notification.turnKey
    ) {
      continue;
    }
    if (derived.expiresAtMs != null && (nextExpiresAtMs == null || derived.expiresAtMs < nextExpiresAtMs)) {
      nextExpiresAtMs = derived.expiresAtMs;
    }
    notifications.push(derived);
  }

  notifications.sort(compareNotifications);

  return {
    nextExpiresAtMs,
    notifications: notifications.map((entry) => entry.notification),
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
  nowMs: number,
  translate: Translate,
): DerivedNotification | null {
  const derivedSession = deriveSession(session, translate);
  if (derivedSession == null || derivedSession.status === "idle") {
    return null;
  }

  const expiresAtMs = getNotificationExpiresAtMs(derivedSession.status, derivedSession.updatedAtMs);
  if (expiresAtMs != null && nowMs >= expiresAtMs) {
    return null;
  }

  return {
    expiresAtMs,
    key: derivedSession.key,
    notification: {
      id: derivedSession.key,
      actionPath: derivedSession.actionPath,
      body: derivedSession.subtitle,
      canDismiss: true,
      expiresAtMs: expiresAtMs ?? Number.MAX_SAFE_INTEGER,
      isLoading: derivedSession.status === "running",
      level: getNotificationLevel(derivedSession.status),
      localConversationId: derivedSession.localConversationId,
      source: derivedSession.source,
      status: derivedSession.status,
      title: derivedSession.title,
      turnKey: derivedSession.turnKey,
      updatedAtMs: derivedSession.updatedAtMs,
    },
    notificationPriority: getNotificationPriority(derivedSession.status),
    updatedAtMs: derivedSession.updatedAtMs,
  };
}

function deriveSession(
  session: AvatarOverlaySession,
  translate: Translate,
): DerivedSession | null {
  if (session.kind === "local") {
    const hostId = normalizeHostId(session.conversation?.hostId);
    const source = hostId === LOCAL_HOST_ID ? "local" : "remote-host";
    const status = deriveLocalNotificationStatus(session.entry, session.conversation);

    return {
      actionPath: `/local/${session.entry.id}`,
      hostId,
      key: `${source}:${hostId}:${session.entry.id}`,
      localConversationId: session.entry.id,
      source,
      status,
      subtitle: deriveLocalNotificationBody(session.conversation, translate),
      title: deriveLocalNotificationTitle(session.entry, session.conversation, translate),
      turnKey: String(session.conversation?.turns.length ?? 0),
      updatedAtMs: session.entry.updatedAt * 1000,
    };
  }

  return {
    actionPath: `/remote/${session.task.id}`,
    hostId: null,
    key: `cloud:${session.task.id}`,
    localConversationId: null,
    source: "cloud",
    status: deriveRemoteTaskNotificationStatus(session.task),
    subtitle: null,
    title: session.task.title?.trim() || translate("avatarOverlay.session.newThread"),
    turnKey: session.task.task_status_display?.latest_turn_status_display?.turn_id ?? null,
    updatedAtMs: (session.task.updated_at ?? session.task.created_at ?? 0) * 1000,
  };
}

function isSubagentThread(entry: ThreadHistoryEntry) {
  return entry.source?.parentThreadId != null;
}

function deriveLocalNotificationStatus(
  entry: ThreadHistoryEntry,
  conversation: ThreadConversation | undefined,
): AvatarOverlayNotificationStatus | "idle" {
  if (entry.status.type === "systemError") {
    return "failed";
  }

  if (entry.status.type === "active") {
    if (
      entry.status.activeFlags.some(
        (flag) => flag === "waitingOnApproval" || flag === "waitingOnUserInput",
      )
    ) {
      return "waiting";
    }
    return "running";
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
  if (conversation.hasUnreadTurn === true || entry.hasUnreadTurn === true) {
    return "review";
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

function deriveLocalNotificationTitle(
  entry: ThreadHistoryEntry,
  conversation: ThreadConversation | undefined,
  translate: Translate,
) {
  return (
    conversation?.title?.trim() ||
    entry.name?.trim() ||
    entry.preview.trim() ||
    translate("avatarOverlay.session.newThread")
  ).trim();
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

function compareNotifications(left: DerivedNotification, right: DerivedNotification) {
  const priorityDelta = left.notificationPriority - right.notificationPriority;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const updatedAtDelta = right.updatedAtMs - left.updatedAtMs;
  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return left.key.localeCompare(right.key);
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

function normalizeHostId(hostId: string | null | undefined) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : LOCAL_HOST_ID;
}
