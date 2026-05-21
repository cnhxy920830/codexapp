/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ThreadConversation,
  ThreadConversationItem,
} from "../../services/history";
import {
  ACTIVE_ACTIVITY_POLL_INTERVAL_MS,
  getNextActivityRefreshDelayMs,
  mergeSyntheticRequestItemsIntoConversation,
  removeRequestConversationItem,
  updateSyntheticRequestItemsForThread,
  upsertPermissionRequestConversationItem,
  upsertUserInputConversationItem,
} from "./avatarOverlayActivity";

test("avatar overlay schedules no polling when nothing is running and nothing is expiring", () => {
  assert.equal(
    getNextActivityRefreshDelayMs({
      hasRunningCloudSession: false,
      hasRunningLocalSession: false,
      nextExpiresAtMs: null,
      nowMs: 1_000,
    }),
    null,
  );
});

test("avatar overlay schedules a 15s activity refresh while sessions are running", () => {
  assert.deepEqual(
    getNextActivityRefreshDelayMs({
      hasRunningCloudSession: false,
      hasRunningLocalSession: true,
      nextExpiresAtMs: null,
      nowMs: 1_000,
    }),
    {
      delayMs: ACTIVE_ACTIVITY_POLL_INTERVAL_MS,
      shouldRefreshActivity: true,
    },
  );
});

test("avatar overlay wakes at the earliest expiry without re-fetching when expiry is sooner than 15s", () => {
  assert.deepEqual(
    getNextActivityRefreshDelayMs({
      hasRunningCloudSession: true,
      hasRunningLocalSession: false,
      nextExpiresAtMs: 9_000,
      nowMs: 1_000,
    }),
    {
      delayMs: 8_000,
      shouldRefreshActivity: false,
    },
  );
});

test("avatar overlay synthetic request items merge into conversations and clear on resolve", () => {
  const baseConversation = createConversation();
  const syntheticItems = updateSyntheticRequestItemsForThread(new Map(), "thread-1", (items) =>
    upsertUserInputConversationItem(items, {
      type: "toolRequestUserInputRequested",
      requestId: 7,
      threadId: "thread-1",
      turnId: "turn-2",
      itemId: "item-7",
      questions: [],
    }),
  );

  const merged = mergeSyntheticRequestItemsIntoConversation(baseConversation, syntheticItems);
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0]?.type, "userInput");

  const clearedItems = updateSyntheticRequestItemsForThread(syntheticItems, "thread-1", (items) =>
    removeRequestConversationItem(items, 7),
  );
  const cleared = mergeSyntheticRequestItemsIntoConversation(baseConversation, clearedItems);
  assert.equal(cleared.items.length, 0);
});

test("avatar overlay keeps permission request items unique per request id", () => {
  const nextItems = upsertPermissionRequestConversationItem([], {
    type: "permissionsRequestApprovalRequested",
    requestId: 11,
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-11",
    cwd: "D:\\workspace\\repo",
    reason: "Need workspace write",
    permissions: {
      network: null,
      fileSystem: {
        read: ["D:\\workspace\\repo"],
        write: ["D:\\workspace\\repo"],
        entries: [
          {
            path: "D:\\workspace\\repo",
            access: "write",
          },
        ],
      },
    },
  });
  const replaced = upsertPermissionRequestConversationItem(nextItems, {
    type: "permissionsRequestApprovalRequested",
    requestId: 11,
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-11b",
    cwd: "D:\\workspace\\repo",
    reason: "Still need workspace write",
    permissions: {
      network: null,
      fileSystem: {
        read: ["D:\\workspace\\repo"],
        write: ["D:\\workspace\\repo"],
        entries: [
          {
            path: "D:\\workspace\\repo",
            access: "write",
          },
        ],
      },
    },
  });

  assert.equal(replaced.length, 1);
  assert.equal(replaced[0]?.type, "permissionRequest");
  assert.equal(replaced[0]?.itemId, "item-11b");
});

function createConversation(): ThreadConversation {
  return {
    cwd: "D:\\workspace\\repo",
    hasUnreadTurn: false,
    hostId: "local",
    id: "thread-1",
    items: [],
    latestCollaborationMode: null,
    latestTokenUsageInfo: null,
    source: null,
    threadGoal: null,
    title: "Thread",
    turnTimings: [],
    turns: [],
  };
}
