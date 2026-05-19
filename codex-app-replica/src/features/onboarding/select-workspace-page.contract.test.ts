import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeWorkspaceRootSelectionsForPersistence } from "./selectWorkspaceModel";

test("select workspace continue only merges persisted roots for the welcome-to-workspace handoff", () => {
  const persistedRoots = ["D:\\workspace\\beta", "D:\\workspace\\alpha"];
  const selectedRoots = ["D:\\workspace\\gamma", "D:\\workspace\\alpha"];

  assert.deepEqual(
    mergeWorkspaceRootSelectionsForPersistence({
      onboardingOverride: "workspace",
      persistedRoots,
      selectedRoots,
    }),
    ["D:\\workspace\\beta", "D:\\workspace\\alpha", "D:\\workspace\\gamma"],
  );

  assert.deepEqual(
    mergeWorkspaceRootSelectionsForPersistence({
      onboardingOverride: "auto",
      persistedRoots,
      selectedRoots,
    }),
    selectedRoots,
  );
});

test("select workspace continue de-duplicates merged roots with the first persisted spelling preserved", () => {
  assert.deepEqual(
    mergeWorkspaceRootSelectionsForPersistence({
      onboardingOverride: "workspace",
      persistedRoots: [" D:\\Workspace\\Repo\\ "],
      selectedRoots: ["d:/workspace/repo", "D:\\workspace\\other"],
    }),
    ["D:\\Workspace\\Repo\\", "D:\\workspace\\other"],
  );
});
