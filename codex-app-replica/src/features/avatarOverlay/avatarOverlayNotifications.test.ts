/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ThreadConversation,
  ThreadConversationItem,
  ThreadConversationTurn,
  ThreadHistoryEntry,
} from "../../services/history";
import { deriveAvatarOverlayNotifications } from "./avatarOverlayNotifications";

test("avatar overlay notifications only use the latest turn body and status", () => {
  const threadId = "thread-1";
  const notifications = deriveAvatarOverlayNotifications({
    conversationsByThreadId: new Map([
      [
        threadId,
        createConversation({
          hasUnreadTurn: true,
          items: [
            createAgentMessage({
              id: "message-old",
              text: "Old completed answer",
              turnId: "turn-1",
            }),
            createSystemError({
              id: "error-old",
              turnId: "turn-1",
            }),
            createAgentMessage({
              id: "message-new",
              text: "Fresh latest turn answer",
              turnId: "turn-2",
            }),
          ],
          turns: [
            createTurn({
              id: "turn-1",
              status: "failed",
            }),
            createTurn({
              id: "turn-2",
              status: "completed",
            }),
          ],
        }),
      ],
    ]),
    nowMs: 2_000_000,
    recentThreads: [
      createHistoryEntry({
        hasUnreadTurn: true,
        id: threadId,
        status: { type: "idle" },
      }),
    ],
    remoteTasks: [],
    translate,
  }).notifications;

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.status, "review");
  assert.equal(notifications[0]?.body, "Fresh latest turn answer");
});

test("avatar overlay notifications derive waiting from latest-turn requests only", () => {
  const threadId = "thread-2";
  const notifications = deriveAvatarOverlayNotifications({
    conversationsByThreadId: new Map([
      [
        threadId,
        createConversation({
          items: [
            createUserInputRequest({
              completed: false,
              id: "request-old",
              turnId: "turn-1",
            }),
            createAgentMessage({
              id: "message-new",
              text: "Latest turn finished cleanly",
              turnId: "turn-2",
            }),
          ],
          turns: [
            createTurn({
              id: "turn-1",
              status: "completed",
            }),
            createTurn({
              id: "turn-2",
              status: "completed",
            }),
          ],
        }),
      ],
    ]),
    nowMs: 2_000_000,
    recentThreads: [
      createHistoryEntry({
        id: threadId,
        status: { type: "idle" },
      }),
    ],
    remoteTasks: [],
    translate,
  }).notifications;

  assert.equal(notifications.length, 0);
});

function createHistoryEntry(
  overrides: Partial<ThreadHistoryEntry> & Pick<ThreadHistoryEntry, "id" | "status">,
): ThreadHistoryEntry {
  return {
    createdAt: 1_000,
    cwd: "D:\\workspace\\codex-app",
    hasUnreadTurn: false,
    hostId: "local",
    name: "Thread title",
    path: null,
    preview: "Preview",
    source: null,
    updatedAt: 1_000,
    ...overrides,
  };
}

function createConversation(options?: {
  hasUnreadTurn?: boolean;
  items?: ThreadConversationItem[];
  turns?: ThreadConversationTurn[];
}): ThreadConversation {
  return {
    cwd: "D:\\workspace\\codex-app",
    hasUnreadTurn: options?.hasUnreadTurn ?? false,
    hostId: "local",
    id: "thread",
    items: options?.items ?? [],
    latestCollaborationMode: null,
    latestTokenUsageInfo: null,
    source: null,
    threadGoal: null,
    title: "Thread title",
    turnTimings: [],
    turns: options?.turns ?? [],
  };
}

function createTurn(options: { id: string; status: string }): ThreadConversationTurn {
  return {
    id: options.id,
    input: [],
    status: options.status,
  };
}

function createAgentMessage(options: {
  id: string;
  text: string;
  turnId: string;
}): ThreadConversationItem {
  return {
    attachments: [],
    comments: [],
    completed: true,
    id: options.id,
    role: "assistant",
    text: options.text,
    turnId: options.turnId,
    type: "agentMessage",
  };
}

function createSystemError(options: { id: string; turnId: string }): ThreadConversationItem {
  return {
    content: "failure",
    id: options.id,
    turnId: options.turnId,
    type: "systemError",
  };
}

function createUserInputRequest(options: {
  completed: boolean;
  id: string;
  turnId: string;
}): ThreadConversationItem {
  return {
    completed: options.completed,
    id: options.id,
    itemId: "item-1",
    questions: [],
    requestId: 1,
    turnId: options.turnId,
    type: "userInput",
  };
}

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "avatarOverlay.session.newThread":
      return "New chat";
    case "avatarOverlay.session.runningCommand":
      return "Running command";
    case "avatarOverlay.session.ranCommand":
      return "Ran command";
    case "avatarOverlay.session.readingFile":
      return `Reading ${values?.fileName ?? ""}`.trim();
    case "avatarOverlay.session.readFile":
      return `Read ${values?.fileName ?? ""}`.trim();
    case "avatarOverlay.session.listingFiles":
      return "Listing files";
    case "avatarOverlay.session.listedFiles":
      return "Listed files";
    case "avatarOverlay.session.searchingFiles":
      return "Searching files";
    case "avatarOverlay.session.searchedFiles":
      return "Searched files";
    case "avatarOverlay.session.searchingQuery":
      return `Searching "${values?.query ?? ""}"`;
    case "avatarOverlay.session.searchedQuery":
      return `Searched "${values?.query ?? ""}"`;
    case "avatarOverlay.session.editingFiles":
      return `Editing ${values?.fileCount ?? 0} files`;
    case "avatarOverlay.session.editedFiles":
      return `Edited ${values?.fileCount ?? 0} files`;
    case "avatarOverlay.session.callingTool":
      return "Calling tool";
    case "avatarOverlay.session.calledTool":
      return "Called tool";
    case "avatarOverlay.session.callingToolName":
      return `Calling ${values?.toolName ?? ""}`.trim();
    case "avatarOverlay.session.calledToolName":
      return `Called ${values?.toolName ?? ""}`.trim();
    case "avatarOverlay.session.searchedWeb":
      return "Searched web";
    default:
      return key;
  }
}
