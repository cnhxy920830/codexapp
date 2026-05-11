/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadConversationTurnDiff } from "../../services/history";
import { TurnDiffCard } from "./TurnDiffCard";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/turn-diff-card.snap.json");
const UPDATE_SNAPSHOTS = process.env.TURN_DIFF_CARD_UPDATE_SNAPSHOTS === "1";

test("turn diff card snapshot", async (t) => {
  const item: ThreadConversationTurnDiff = {
    type: "turnDiff",
    id: "turn-diff-1",
    turnId: "turn-1",
    unifiedDiff: "@@ -1 +1 @@\n-old line\n+new line\n",
  };

  const actualSnapshots = {
    diffCard: renderToStaticMarkup(
      <TurnDiffCard conversationCwd="D:\\workspace" conversationId="thread-1" item={item} t={translate} />,
    ),
  };

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
      assert.match(actual, /Review changes/);
      assert.match(actual, /@@ -1 \+1 @@/);
    });
  }
});

type SnapshotMap = {
  diffCard: string;
};

const translate = (key: string) => {
  if (key === "codex.unifiedDiff.reviewChanges") {
    return "Review changes";
  }
  return key;
};
