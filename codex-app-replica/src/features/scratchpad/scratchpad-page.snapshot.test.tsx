/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScratchpadPagePreview } from "./ScratchpadPage";
import type { AppInfo } from "../../services/apps";
import type { ThreadConversation } from "../../services/history";
import type { SkillSummary } from "../../services/skills";
import type { RowSummaryState, ScratchpadRow, ThreadRuntimeState } from "./scratchpadTypes";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/scratchpad/__snapshots__/scratchpad-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.SCRATCHPAD_PAGE_UPDATE_SNAPSHOTS === "1";

test("scratchpad page snapshots", async (t) => {
  const thread = createThreadFixture();
  const runtime: ThreadRuntimeState = {
    pendingApprovalTurnIds: new Set(["turn-approval"]),
    pendingUserInputTurnIds: new Set(["turn-input"]),
  };
  const rows: ScratchpadRow[] = [
    createDraftRow({
      id: "draft-row",
      text: "",
      isIndented: false,
    }),
    createDraftRow({
      id: "draft-follow-up-row",
      text: "",
      isIndented: true,
    }),
    createSubmittedRow({
      id: "starting-row",
      state: "starting",
      text: "Initial task is starting",
    }),
    createSubmittedRow({
      id: "approval-row",
      state: "started",
      text: "Approval required task",
      conversationId: thread.id,
      turnId: "turn-approval",
      createdAtMs: Date.UTC(2026, 4, 18, 9, 1, 0),
    }),
    createSubmittedRow({
      id: "input-row",
      state: "started",
      text: "Need more user input",
      conversationId: thread.id,
      turnId: "turn-input",
      createdAtMs: Date.UTC(2026, 4, 18, 9, 2, 0),
    }),
    createSubmittedRow({
      id: "completed-row",
      state: "started",
      text: "Completed task with summary",
      conversationId: thread.id,
      turnId: "turn-completed",
      createdAtMs: Date.UTC(2026, 4, 18, 9, 3, 0),
    }),
    createSubmittedRow({
      id: "error-row",
      state: "error",
      text: "Failed task",
      error: "Could not create chat",
    }),
  ];
  const threadConversationsById = {
    [thread.id]: thread,
  };
  const threadRuntimeById = {
    [thread.id]: runtime,
  };
  const summaryByRowId: Record<string, RowSummaryState> = {
    "completed-row": {
      status: "ready",
      message: "Final assistant answer for the completed scratchpad row.",
      summary: "Completed summary text",
    },
  };

  const actualSnapshots = {
    page: normalizeMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ScratchpadPagePreview
            apps={createAppsFixture()}
            defaultDraftPlaceholder="Add a task, or tab for a follow up"
            followUpDraftPlaceholder="Add a follow up"
            focusedDraftRowId="draft-row"
            rows={rows}
            skills={createSkillsFixture()}
            summaryByRowId={summaryByRowId}
            t={translate}
            threadConversationsById={threadConversationsById}
            threadRuntimeById={threadRuntimeById}
          />
        </div>,
      ),
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
  page: string;
};

function createDraftRow({
  id,
  text,
  isIndented,
}: {
  id: string;
  text: string;
  isIndented: boolean;
}): ScratchpadRow {
  return {
    id,
    state: "draft",
    text,
    isIndented,
    conversationId: null,
    turnId: null,
    parentRowId: null,
    createdAtMs: null,
    error: null,
  };
}

function createSubmittedRow({
  id,
  state,
  text,
  conversationId = null,
  turnId = null,
  createdAtMs = null,
  error = null,
}: {
  id: string;
  state: Exclude<ScratchpadRow["state"], "draft">;
  text: string;
  conversationId?: string | null;
  turnId?: string | null;
  createdAtMs?: number | null;
  error?: string | null;
}): ScratchpadRow {
  return {
    id,
    state,
    text,
    isIndented: false,
    conversationId,
    turnId,
    parentRowId: null,
    createdAtMs,
    error,
  };
}

function createThreadFixture(): ThreadConversation {
  return {
    id: "thread-scratchpad-1",
    title: "Scratchpad thread",
    cwd: "D:\\workspace\\scratchpad",
    hostId: null,
    turns: [
      {
        id: "turn-approval",
        status: "in_progress",
        input: [],
      },
      {
        id: "turn-input",
        status: "in_progress",
        input: [],
      },
      {
        id: "turn-completed",
        status: "completed",
        input: [],
      },
    ],
    turnTimings: [
      {
        turnId: "turn-approval",
        status: "in_progress",
        turnStartedAtMs: Date.UTC(2026, 4, 18, 9, 1, 0),
        finalAssistantStartedAtMs: null,
        firstTurnWorkItemStartedAtMs: null,
      },
      {
        turnId: "turn-input",
        status: "in_progress",
        turnStartedAtMs: Date.UTC(2026, 4, 18, 9, 2, 0),
        finalAssistantStartedAtMs: null,
        firstTurnWorkItemStartedAtMs: null,
      },
      {
        turnId: "turn-completed",
        status: "completed",
        turnStartedAtMs: Date.UTC(2026, 4, 18, 9, 3, 0),
        finalAssistantStartedAtMs: Date.UTC(2026, 4, 18, 9, 3, 30),
        firstTurnWorkItemStartedAtMs: Date.UTC(2026, 4, 18, 9, 3, 10),
      },
    ],
    items: [
      {
        type: "permissionRequest",
        id: "approval-request",
        turnId: "turn-approval",
        requestId: "req-1",
        itemId: "item-1",
        cwd: "D:\\workspace\\scratchpad",
        reason: null,
        permissions: {
          network: null,
          fileSystem: null,
        },
        completed: false,
        response: null,
      },
      {
        type: "userInput",
        id: "user-input-request",
        turnId: "turn-input",
        requestId: "req-2",
        itemId: "item-2",
        questions: [],
        completed: false,
      },
      {
        type: "reasoning",
        id: "completed-reasoning",
        turnId: "turn-completed",
        summary: [],
        content: ["**Summary fallback**"],
      },
      {
        type: "agentMessage",
        id: "completed-assistant",
        turnId: "turn-completed",
        role: "assistant",
        text: "Final assistant answer for the completed scratchpad row.",
        completed: true,
      },
    ],
  };
}

function createAppsFixture(): AppInfo[] {
  return [
    {
      id: "browser-use",
      name: "Browser Use",
      description: "Browser automation",
      installUrl: null,
      logoUrl: null,
      logoUrlDark: null,
      isAccessible: true,
      isEnabled: true,
      pluginDisplayNames: [],
    },
  ];
}

function createSkillsFixture(): SkillSummary[] {
  return [
    {
      brandColor: null,
      cwd: "D:\\workspace\\scratchpad",
      defaultPrompt: null,
      name: "code-review",
      displayName: "Code Review",
      description: "Review code changes",
      iconLarge: null,
      iconSmall: null,
      shortDescription: "Review code",
      path: "D:/skills/code-review",
      scope: "workspace",
      enabled: true,
    },
  ];
}

function translate(key: string) {
  switch (key) {
    case "scratchpadPage.inputPlaceholder.initial":
      return "Add a task";
    case "scratchpadPage.inputPlaceholder.followUp":
      return "Add a follow up";
    case "scratchpadPage.inputPlaceholder.followUpHint":
      return "Add a task, or tab for a follow up";
    case "scratchpadPage.summaryLoading":
      return "Summarizing final assistant response";
    case "codex.localTaskRow.awaitingApproval":
      return "Awaiting approval";
    case "codex.localTaskRow.awaitingResponse":
      return "Awaiting response";
    case "thinkingShimmer.default":
      return "Thinking";
    default:
      return key;
  }
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sdata-reactroot=""/g, "")
    .replace(/animation-delay:-?\d+ms/g, "animation-delay:[delay]");
}
