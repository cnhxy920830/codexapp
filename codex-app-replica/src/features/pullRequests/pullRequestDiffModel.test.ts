/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPullRequestGitApplyCommand } from "./pullRequestDiffModel";

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
