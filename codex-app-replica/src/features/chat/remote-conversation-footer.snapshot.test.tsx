/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { RemoteConversationFooter } from "./RemoteConversationFooter";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/chat/__snapshots__/remote-conversation-footer.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.REMOTE_CONVERSATION_FOOTER_UPDATE_SNAPSHOTS === "1";

test("remote conversation footer snapshot", async (t) => {
  const actualSnapshots = {
    localComposer: renderFooter({
      composer: <div className="composer-marker">app.chat.composePlaceholder</div>,
      showComposerFooter: true,
      showRemoteApplyFooter: false,
      showRemoteFailedFooter: false,
    }),
    remoteApplyFooter: renderFooter({
      composer: <div className="composer-marker">app.chat.composePlaceholder</div>,
      remoteApplyDiff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
      remoteApplyTurnId: "turn-123",
      showComposerFooter: true,
      showRemoteApplyFooter: true,
      showRemoteFailedFooter: false,
    }),
    remoteFailedFooter: renderFooter({
      composer: <div className="composer-marker">app.chat.composePlaceholder</div>,
      remoteTaskId: "task-456",
      showComposerFooter: false,
      showRemoteApplyFooter: false,
      showRemoteFailedFooter: true,
    }),
  };

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  await t.test("local composer remains visible for non-remote footer", () => {
    const actual = actualSnapshots.localComposer;
    assert.equal(actual, expectedSnapshots.localComposer);
    assert.match(actual, /app\.chat\.composePlaceholder/);
    assert.doesNotMatch(actual, /Apply changes and continue locally\?/);
  });

  await t.test("remote completed turn shows apply footer and composer", () => {
    const actual = actualSnapshots.remoteApplyFooter;
    assert.equal(actual, expectedSnapshots.remoteApplyFooter);
    assert.match(actual, /Apply changes and continue locally\?/);
    assert.match(actual, /app\.chat\.composePlaceholder/);
  });

  await t.test("remote failed turn shows failed footer without composer", () => {
    const actual = actualSnapshots.remoteFailedFooter;
    assert.equal(actual, expectedSnapshots.remoteFailedFooter);
    assert.match(actual, /An error occurred during this task/);
    assert.match(actual, /Open in web/);
    assert.doesNotMatch(actual, /app\.chat\.composePlaceholder/);
  });
});

type SnapshotMap = {
  localComposer: string;
  remoteApplyFooter: string;
  remoteFailedFooter: string;
};

function renderFooter(
  props: Partial<Parameters<typeof RemoteConversationFooter>[0]>,
) {
  return renderToStaticMarkup(
    <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
      <RemoteConversationFooter
        composer={<div />}
        remoteApplyDiff={null}
        remoteApplyTurnId={null}
        remoteTaskEnvironment={null}
        remoteTaskId={null}
        showComposerFooter={false}
        showRemoteApplyFooter={false}
        showRemoteFailedFooter={false}
        t={translate}
        workspaceRoot={null}
        {...props}
      />
    </I18N_CONTEXT.Provider>,
  );
}

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
    case "codex.remoteConversation.turnFailed":
      return "An error occurred during this task";
    case "codex.remoteConversation.openInWeb":
      return "Open in web";
    default:
      return key;
  }
}
