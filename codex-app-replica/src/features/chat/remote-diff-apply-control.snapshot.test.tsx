/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { RemoteDiffApplyControl } from "./RemoteDiffApplyControl";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/chat/__snapshots__/remote-diff-apply-control.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.REMOTE_DIFF_APPLY_CONTROL_UPDATE_SNAPSHOTS === "1";

test("remote diff apply control snapshot", async () => {
  const actualSnapshots = {
    footer: renderToStaticMarkup(
      <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
        <RemoteDiffApplyControl
          variant="footer"
          diff={"diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n"}
          onShowToast={() => undefined}
          taskEnvironment={null}
          turnId="turn-123"
          workspaceRoot={null}
        />
      </I18N_CONTEXT.Provider>,
    ),
  };

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    assert.match(actual, /Apply changes and continue locally/);
    assert.match(actual, /Apply/);
  }
});

type SnapshotMap = {
  footer: string;
};

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "codex.applyOrRevertBanner.apply":
      return "Apply";
    case "codex.applyOrRevertBanner.reapply":
      return "Reapply";
    case "codex.applyOrRevertBanner.revert":
      return "Revert";
    case "codex.applyOrRevertBanner.applyMessage":
      return "Apply changes and continue locally?";
    case "codex.applyOrRevertBanner.revertMessage":
      return "Revert applied changes?";
    case "codex.applyOrRevertBanner.applyMessageDifferentEnvironment":
      return `This task was made in ${values?.environment ?? "remote"} so may not apply cleanly.`;
    case "codex.applyOrRevertBanner.applyMessageDifferentEnvironment.tooltip":
      return `Changes made in ${values?.environment ?? "remote"} so may not apply cleanly.`;
    case "codex.applyResultsDialog.title":
      return "Apply results";
    case "codex.applyResultsDialog.close":
      return "Close";
    case "codex.applyResultsDialog.notGitRepo":
      return "This action only works when running in a Git repository.";
    case "codex.applyResultsDialog.noDetails":
      return "No file details available.";
    default:
      return key;
  }
}
