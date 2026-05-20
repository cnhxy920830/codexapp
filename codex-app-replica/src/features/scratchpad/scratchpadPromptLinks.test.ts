import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildScratchpadAppPromptLink,
  parseScratchpadPromptSegments,
} from "./scratchpadPromptLinks";

test("scratchpad prompt parser keeps agent and subagent links as mention segments", () => {
  const segments = parseScratchpadPromptSegments(
    "Use [@Planner](agent://conv_123) with [@Reviewer](subagent://code-reviewer).",
  );

  assert.deepEqual(
    segments,
    [
      {
        type: "text",
        value: "Use ",
      },
      {
        type: "agent",
        raw: "[@Planner](agent://conv_123)",
        label: "@Planner",
        href: "agent://conv_123",
        displayLabel: "Planner",
        detail: null,
        conversationId: "conv_123",
        roleName: null,
      },
      {
        type: "text",
        value: " with ",
      },
      {
        type: "agent",
        raw: "[@Reviewer](subagent://code-reviewer)",
        label: "@Reviewer",
        href: "subagent://code-reviewer",
        displayLabel: "Reviewer",
        detail: null,
        conversationId: null,
        roleName: "code-reviewer",
      },
      {
        type: "text",
        value: ".",
      },
    ],
  );
});

test("scratchpad app prompt links follow the extracted dollar-prefixed app markdown contract", () => {
  const link = buildScratchpadAppPromptLink({
    id: "browser-use",
    name: "Browser Use",
    description: "Browser automation",
    installUrl: null,
    logoUrl: null,
    logoUrlDark: null,
    isAccessible: true,
    isEnabled: true,
    pluginDisplayNames: [],
  });

  assert.equal(link, "[$browser-use](app://browser-use)");
});
