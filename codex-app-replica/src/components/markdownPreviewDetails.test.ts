import assert from "node:assert/strict";
import { test } from "node:test";
import { tryParseMarkdownDetailsBlock } from "./markdownPreviewDetails";

test("parses github-details container directives", () => {
  const result = tryParseMarkdownDetailsBlock({
    allowBasicHtml: true,
    lineIndex: 0,
    lines: [
      ':::github-details{summary="Expanded section" open="true"}',
      "Inspect the preview output.",
      "",
      "- keep parity",
      ":::",
    ],
  });

  assert.deepEqual(result, {
    block: {
      body: "Inspect the preview output.\n\n- keep parity",
      open: true,
      summary: "Expanded section",
      type: "details",
    },
    nextLineIndex: 5,
  });
});

test("parses html details blocks when basic html is enabled", () => {
  const result = tryParseMarkdownDetailsBlock({
    allowBasicHtml: true,
    lineIndex: 0,
    lines: [
      "<details open>",
      "<summary>Notebook notes</summary>",
      "Inspect the exported image before sharing it.",
      "</details>",
    ],
  });

  assert.deepEqual(result, {
    block: {
      body: "Inspect the exported image before sharing it.",
      open: true,
      summary: "Notebook notes",
      type: "details",
    },
    nextLineIndex: 4,
  });
});
