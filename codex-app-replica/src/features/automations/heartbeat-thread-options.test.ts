import assert from "node:assert/strict";
import { test } from "node:test";
import type { ThreadHistoryEntry } from "../../services/history";
import { buildHeartbeatThreadOptions } from "./automationsPageUtils";

test("heartbeat thread options only include pinned threads with recent metadata", () => {
  const options = buildHeartbeatThreadOptions({
    occupiedThreadIds: new Set<string>(),
    pinnedThreadIds: ["thread-2", "missing-thread", "thread-1"],
    recentThreads: [
      createThread({
        id: "thread-1",
        name: "Alpha",
        preview: "alpha preview",
        createdAt: 1710000000,
      }),
      createThread({
        id: "thread-2",
        name: null,
        preview: "Bravo preview",
        createdAt: 1720000000,
      }),
    ],
    selectedThreadId: "",
    threadNameById: new Map(),
  });

  assert.deepEqual(options, [
    {
      createdAt: 1720000000,
      id: "thread-2",
      isPinned: true,
      title: "Bravo preview",
      unavailable: false,
    },
    {
      createdAt: 1710000000,
      id: "thread-1",
      isPinned: true,
      title: "Alpha",
      unavailable: false,
    },
  ]);
});

test("heartbeat thread options prepend the selected unpinned thread", () => {
  const options = buildHeartbeatThreadOptions({
    occupiedThreadIds: new Set<string>(["thread-3"]),
    pinnedThreadIds: ["thread-1"],
    recentThreads: [
      createThread({
        id: "thread-1",
        name: "Pinned thread",
        preview: "pinned preview",
        createdAt: 1710000000,
      }),
      createThread({
        id: "thread-3",
        name: "Selected thread",
        preview: "selected preview",
        createdAt: 1730000000,
      }),
    ],
    selectedThreadId: "thread-3",
    threadNameById: new Map([
      ["thread-1", "Pinned thread"],
      ["thread-3", "Selected thread"],
    ]),
  });

  assert.deepEqual(options, [
    {
      createdAt: 1730000000,
      id: "thread-3",
      isPinned: false,
      title: "Selected thread",
      unavailable: true,
    },
    {
      createdAt: 1710000000,
      id: "thread-1",
      isPinned: true,
      title: "Pinned thread",
      unavailable: false,
    },
  ]);
});

test("heartbeat thread options fall back to threadNameById for a selected thread missing recent metadata", () => {
  const options = buildHeartbeatThreadOptions({
    occupiedThreadIds: new Set<string>(),
    pinnedThreadIds: [],
    recentThreads: [],
    selectedThreadId: "thread-9",
    threadNameById: new Map([["thread-9", "Recovered title"]]),
  });

  assert.deepEqual(options, [
    {
      createdAt: null,
      id: "thread-9",
      isPinned: false,
      title: "Recovered title",
      unavailable: false,
    },
  ]);
});

function createThread({
  createdAt,
  id,
  name,
  preview,
}: {
  createdAt: number;
  id: string;
  name: string | null;
  preview: string;
}): ThreadHistoryEntry {
  return {
    id,
    preview,
    createdAt,
    updatedAt: createdAt,
    status: { type: "idle" },
    cwd: "D:\\workspace\\codex-app",
    path: null,
    name,
    source: null,
  };
}
