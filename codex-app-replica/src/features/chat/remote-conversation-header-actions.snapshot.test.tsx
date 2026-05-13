/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { RemoteConversationHeaderActions } from "./RemoteConversationHeaderActions";
import type { RemoteTask, RemoteTaskTurn } from "../../services/remoteTasks";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/chat/__snapshots__/remote-conversation-header-actions.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.REMOTE_CONVERSATION_HEADER_ACTIONS_UPDATE_SNAPSHOTS === "1";

test("remote conversation header actions snapshot", async (t) => {
  const task = {
    id: "task-123",
    external_pull_requests: [],
  } satisfies RemoteTask;

  const actionTurn = {
    id: "turn-123",
    turn_status: "completed",
    output_items: [
      {
        type: "pr",
        output_diff: {
          diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
        },
      },
    ],
  } satisfies RemoteTaskTurn;

  const actualSnapshots = {
    create: renderToStaticMarkup(
      <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
        <RemoteConversationHeaderActions
          diffTaskTurn={null}
          selectedTurn={actionTurn}
          task={task}
          taskEnvironment={null}
          taskId="task-123"
          turns={[actionTurn]}
          workspaceRoot={null}
        />
      </I18N_CONTEXT.Provider>,
    ),
    existing: renderToStaticMarkup(
      <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
        <RemoteConversationHeaderActions
          diffTaskTurn={null}
          selectedTurn={{
            ...actionTurn,
            pull_request_status: "created",
            pull_request_data: {
              url: "https://github.com/openai/codex/pull/7",
              number: 7,
              status: "ready",
            },
          }}
          task={{
            ...task,
            external_pull_requests: [
              {
                assistant_turn_id: "turn-123",
                pull_request: {
                  url: "https://github.com/openai/codex/pull/7",
                  number: 7,
                  status: "ready",
                },
              },
            ],
          }}
          taskEnvironment={null}
          taskId="task-123"
          turns={[
            {
              ...actionTurn,
              pull_request_status: "created",
              pull_request_data: {
                url: "https://github.com/openai/codex/pull/7",
                number: 7,
                status: "ready",
              },
            },
          ]}
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
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
      assert.match(actual, /Open in web/);
      assert.match(actual, /Create draft PR|#7/);
    });
  }
});

type SnapshotMap = {
  create: string;
  existing: string;
};

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "codex.remoteConversation.viewPreviousTurns.buttonTooltip":
      return "Open in web";
    case "codex.remoteConversation.viewPreviousTurns.buttonText":
      return "Open";
    case "localConversationPage.createDraftPullRequestButtonLabel":
      return "Create draft PR";
    case "localConversationPage.createPullRequestButtonLabel":
      return "Create PR";
    case "codex.remoteConversation.applyDiff.apply":
      return "Apply";
    case "codex.remoteConversation.applyDiff.revert":
      return "Revert";
    case "review.commit.loading.title.createDraftPr":
      return "Creating a draft PR";
    case "review.commit.loading.title.createPr":
      return "Creating a PR";
    default:
      return key;
  }
}
