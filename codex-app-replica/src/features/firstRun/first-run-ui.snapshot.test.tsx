/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstRunButton } from "./FirstRunButton";
import { FirstRunAsciiBackground } from "./FirstRunAsciiBackground";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/firstRun/__snapshots__/first-run-ui.snap.json");
const UPDATE_SNAPSHOTS = process.env.FIRST_RUN_UI_UPDATE_SNAPSHOTS === "1";

test("first run ui snapshots", async (t) => {
  const actualSnapshots = {
    asciiBackground: renderToStaticMarkup(<FirstRunAsciiBackground />),
    outlineButton: renderToStaticMarkup(
      <FirstRunButton color="outline" onClick={noop}>
        Back
      </FirstRunButton>,
    ),
    primaryButton: renderToStaticMarkup(
      <FirstRunButton onClick={noop}>
        Continue
      </FirstRunButton>,
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
      if (name === "asciiBackground") {
        assert.match(actual, /25%/);
        assert.match(actual, /50%/);
      }
      if (name === "outlineButton") {
        assert.match(actual, /user-select-none no-drag cursor-interaction/);
        assert.match(actual, /text-token-button-tertiary-foreground/);
      }
      if (name === "primaryButton") {
        assert.match(actual, /user-select-none no-drag cursor-interaction/);
        assert.match(actual, /bg-token-foreground/);
      }
    });
  }
});

type SnapshotMap = {
  asciiBackground: string;
  outlineButton: string;
  primaryButton: string;
};

const noop = () => {};
