/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePullRequestUnifiedDiff } from "./pullRequestDiffModel";
import {
  buildPullRequestFullFilePreview,
  splitPullRequestFileContents,
} from "./pullRequestFullFilePreview";

test("buildPullRequestFullFilePreview preserves diff headers and expands full file context", () => {
  const unifiedDiff = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1,3 +1,3 @@",
    " line 1",
    "-old line 2",
    "+new line 2",
    " line 3",
  ].join("\n");

  const file = parsePullRequestUnifiedDiff(unifiedDiff)[0];
  if (file == null) {
    throw new Error("Expected parsed diff file");
  }

  const preview = buildPullRequestFullFilePreview(
    file,
    splitPullRequestFileContents(["line 1", "old line 2", "line 3"].join("\n")),
    splitPullRequestFileContents(["line 1", "new line 2", "line 3"].join("\n")),
    {
      hideWhitespace: false,
      wordDiffsEnabled: false,
    },
  );

  assert.deepEqual(preview.unifiedLines, [
    { kind: "header", text: "diff --git a/src/App.tsx b/src/App.tsx" },
    { kind: "header", text: "index 123..456 100644" },
    { kind: "header", text: "--- a/src/App.tsx" },
    { kind: "header", text: "+++ b/src/App.tsx" },
    { kind: "hunk", text: "@@ -1,3 +1,3 @@" },
    {
      fragments: [{ isChanged: false, text: "line 1" }],
      kind: "context",
      prefix: " ",
      text: "line 1",
    },
    {
      fragments: [{ isChanged: false, text: "old line 2" }],
      kind: "deletion",
      prefix: "-",
      text: "old line 2",
    },
    {
      fragments: [{ isChanged: false, text: "new line 2" }],
      kind: "addition",
      prefix: "+",
      text: "new line 2",
    },
    {
      fragments: [{ isChanged: false, text: "line 3" }],
      kind: "context",
      prefix: " ",
      text: "line 3",
    },
  ]);
});
