/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { RemoteConversationPage } from "./RemoteConversationPage";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/chat/__snapshots__/remote-conversation-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.REMOTE_CONVERSATION_PAGE_UPDATE_SNAPSHOTS === "1";

test("remote conversation page snapshot", async () => {
  const actualSnapshots = {
    page: renderToStaticMarkup(
      <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
        <RemoteConversationPage taskId="task-123">
          <div className="app-card">Main pane</div>
        </RemoteConversationPage>
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
    assert.match(actual, /Codex cloud/);
    assert.doesNotMatch(actual, /Apply/);
  }
});

type SnapshotMap = {
  page: string;
};

function translate(key: string) {
  switch (key) {
    case "codex.remoteConversation.codexCloudTask":
      return "You are viewing a <u>Codex cloud</u> task";
    case "codex.remoteConversation.viewPreviousTurns":
      return "Open in web";
    default:
      return key;
  }
}
