/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPullRequestGitApplyCommand, parsePullRequestUnifiedDiff } from "./pullRequestDiffModel";

test("buildPullRequestGitApplyCommand matches the upstream heredoc command", () => {
  const unifiedDiff = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "@@ -1 +1 @@",
    "-old",
    "+new",
  ].join("\n");

  assert.equal(
    buildPullRequestGitApplyCommand(unifiedDiff),
    [
      ' (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<\'EOF\'',
      unifiedDiff,
      "EOF",
      ")",
    ].join("\n"),
  );
});

test("parsePullRequestUnifiedDiff preserves trailing whitespace in patch lines", () => {
  const unifiedDiff = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1 +1 @@",
    "-const value = 1;",
    "+const value = 1;  ",
  ].join("\n");

  const files = parsePullRequestUnifiedDiff(unifiedDiff);

  assert.equal(files.length, 1);
  assert.equal(files[0]?.patch, [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 123..456 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1 +1 @@",
    "-const value = 1;",
    "+const value = 1;  ",
  ].join("\n"));
});

test("parsePullRequestUnifiedDiff captures object ids and hunk metadata", () => {
  const unifiedDiff = [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 1234567..89abcde 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
    "@@ -1,3 +1,3 @@",
    " line 1",
    "-old line 2",
    "+new line 2",
    " line 3",
  ].join("\n");

  const files = parsePullRequestUnifiedDiff(unifiedDiff);

  assert.equal(files.length, 1);
  assert.equal(files[0]?.oldObjectId, "1234567");
  assert.equal(files[0]?.newObjectId, "89abcde");
  assert.equal(files[0]?.path, "src/App.tsx");
  assert.deepEqual(files[0]?.headerLines, [
    "diff --git a/src/App.tsx b/src/App.tsx",
    "index 1234567..89abcde 100644",
    "--- a/src/App.tsx",
    "+++ b/src/App.tsx",
  ]);
  assert.deepEqual(files[0]?.hunkMetadata, [
    {
      additionCount: 3,
      additionStart: 1,
      deletionCount: 3,
      deletionStart: 1,
      hunkContent: [
        { type: "context", lines: 1 },
        { type: "deletion", deletions: 1 },
        { type: "addition", additions: 1 },
        { type: "context", lines: 1 },
      ],
      hunkSpecs: "@@ -1,3 +1,3 @@",
      noEOFCRAdditions: false,
      noEOFCRDeletions: false,
    },
  ]);
});
