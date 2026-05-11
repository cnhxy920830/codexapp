/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanSummaryPage } from "./PlanSummaryPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/plan-summary-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.PLAN_SUMMARY_PAGE_UPDATE_SNAPSHOTS === "1";

test("plan summary page snapshots", async (t) => {
  const actualSnapshots = {
    loading: renderToStaticMarkup(<PlanSummaryPage planSummary={null} t={translate} />),
    loaded: renderToStaticMarkup(
      <PlanSummaryPage
        planSummary={{
          conversationId: "conversation-123",
          planContent: "# Plan\n\n- First\n- Second",
        }}
        t={translate}
      />,
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
    });
  }
});

type SnapshotMap = {
  loading: string;
  loaded: string;
};

const translate = (key: string) => key;
