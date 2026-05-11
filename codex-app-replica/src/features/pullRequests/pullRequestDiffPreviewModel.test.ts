/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPullRequestSplitPreviewRows,
  buildPullRequestUnifiedPreviewLines,
} from "./pullRequestDiffPreviewModel";

test("buildPullRequestUnifiedPreviewLines marks inline word diffs", () => {
  const patch = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1 +1 @@",
    "-return hello world",
    "+return hello there",
  ].join("\n");

  const lines = buildPullRequestUnifiedPreviewLines(patch, {
    hideWhitespace: false,
    wordDiffsEnabled: true,
  });

  assert.equal(lines[5]?.kind, "deletion");
  assert.equal(lines[6]?.kind, "addition");
  assert.deepEqual(lines[5], {
    fragments: [
      { isChanged: false, text: "return hello " },
      { isChanged: true, text: "world" },
    ],
    kind: "deletion",
    prefix: "-",
    text: "return hello world",
  });
  assert.deepEqual(lines[6], {
    fragments: [
      { isChanged: false, text: "return hello " },
      { isChanged: true, text: "there" },
    ],
    kind: "addition",
    prefix: "+",
    text: "return hello there",
  });
});

test("buildPullRequestSplitPreviewRows hides whitespace-only pairs", () => {
  const patch = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1 +1 @@",
    "-const value = 1;",
    "+const value = 1;  ",
  ].join("\n");

  const rows = buildPullRequestSplitPreviewRows(patch, {
    hideWhitespace: true,
    wordDiffsEnabled: false,
  });

  assert.deepEqual(
    rows.map((row) => row.kind),
    ["header", "header", "header", "header", "hunk"],
  );
});

test("buildPullRequestSplitPreviewRows marks paired word diffs", () => {
  const patch = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1 +1 @@",
    "-return hello world",
    "+return hello there",
  ].join("\n");

  const rows = buildPullRequestSplitPreviewRows(patch, {
    hideWhitespace: false,
    wordDiffsEnabled: true,
  });

  assert.equal(rows[5]?.kind, "paired");
  assert.deepEqual(rows[5], {
    kind: "paired",
    leftFragments: [
      { isChanged: false, text: "return hello " },
      { isChanged: true, text: "world" },
    ],
    leftText: "return hello world",
    rightFragments: [
      { isChanged: false, text: "return hello " },
      { isChanged: true, text: "there" },
    ],
    rightText: "return hello there",
  });
});
