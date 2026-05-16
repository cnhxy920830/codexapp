/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatestTurnPreview } from "./LatestTurnPreview";
import type { RenderableConversationGroup } from "./renderableConversationGroups";

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "composer.latestTurn":
      return "Latest turn";
    case "composer.latestTurn.working":
      return "Working";
    case "app.chat.latestTurnPreview.items":
      return values?.count === 1 ? "1 item" : `${values?.count ?? 0} items`;
    default:
      return key;
  }
}

test("LatestTurnPreview prefers worked-for summary and starts collapsed", () => {
  const markup = renderToStaticMarkup(
    <LatestTurnPreview
      group={buildRenderableConversationGroupFixture()}
      isTurnInProgress={false}
      previewContent={<div>Preview body</div>}
      t={translate}
    />,
  );

  assert.match(markup, /2s · 1 item/);
  assert.match(markup, /max-h-0/);
  assert.match(markup, /opacity-0/);
  assert.doesNotMatch(markup, /Latest turn/);
});

test("LatestTurnPreview uses working label for in-progress turn", () => {
  const markup = renderToStaticMarkup(
    <LatestTurnPreview
      group={buildRenderableConversationGroupFixture({
        workedForStatus: "working",
      })}
      isTurnInProgress
      previewContent={<div>Preview body</div>}
      t={translate}
    />,
  );

  assert.match(markup, /Working/);
});

function buildRenderableConversationGroupFixture(options?: {
  workedForStatus?: "worked" | "working";
}) {
  const workedForStatus = options?.workedForStatus ?? "worked";

  return {
    id: "turn-1",
    turnId: "turn-1",
    preUserItems: [],
    userItems: [],
    activityItems: [
      {
        type: "workedFor",
        id: "worked-for:turn-1",
        turnId: "turn-1",
        status: workedForStatus,
        startedAtMs: 1_000,
        completedAtMs: workedForStatus === "worked" ? 3_000 : null,
      },
      {
        type: "commandExecution",
        id: "cmd-1",
        turnId: "turn-1",
        status: "completed",
        command: "dir",
        cwd: "D:\\workspace",
        exitCode: 0,
        commandActions: [],
        aggregatedOutput: null,
        durationMs: 2_000,
      },
    ],
    assistantMessage: null,
    assistantAutomationUpdateItems: [],
    automationUpdateItems: [],
    toolOutputItems: [],
    postAssistantItems: [],
    systemEventItem: null,
    unifiedDiffItem: null,
    todoListItem: null,
    proposedPlanItem: null,
    planImplementationItem: null,
    mcpServerElicitationItems: [],
    permissionRequestItems: [],
    approvalItem: null,
    userInputItem: null,
    remoteTaskCreatedItems: [],
    personalityChangedItems: [],
    forkedFromConversationItems: [],
    modelChangedItems: [],
    modelReroutedItems: [],
  } satisfies RenderableConversationGroup;
}
