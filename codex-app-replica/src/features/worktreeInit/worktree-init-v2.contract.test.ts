/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/worktreeInit/WorktreeInitV2Page.tsx",
);
const START_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/worktreeInit/startPendingWorktreeConversation.ts",
);

test("worktree init local continue falls back to route navigation when no ready callback is wired", () => {
  const source = readSource(PAGE_SOURCE_PATH);

  assert.match(
    source,
    /if \(onConversationReady\) \{\s*await onConversationReady\(conversationId\);\s*\} else \{\s*navigateToPath\(conversationPathBuilder\(conversationId\)\);\s*\}/s,
  );
});

test("worktree init metadata replays pinned thread state through replica global state", () => {
  const source = readSource(START_SOURCE_PATH);

  assert.match(
    source,
    /if \(entry\.isPinned\) \{\s*await setPinnedThreadState\(\{\s*threadId: conversationId,\s*beforeThreadId: entry\.pinnedBeforeThreadId \?\? null,\s*\}\)\.catch\(\(\) => undefined\);\s*\}/s,
  );
  assert.match(source, /getGlobalState\("pinned-thread-ids"\)/);
  assert.match(source, /await setGlobalState\("pinned-thread-ids", nextPinnedThreadIds\);/);
  assert.match(source, /const beforeThreadIndex = nextThreadIds\.indexOf\(normalizedBeforeThreadId\);/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
