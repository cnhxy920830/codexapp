import assert from "node:assert/strict";
import { test } from "node:test";
import type { ThreadHistoryEntry } from "../../services/history";
import {
  deriveSelectWorkspacePageState,
  filterWorkspaceRecentThreads,
  mergeWorkspaceRootSelectionsForPersistence,
  readWorkspaceOnboardingSkipProjectName,
  WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME,
} from "./selectWorkspaceModel";

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

test("select workspace filters spawn-subagent recent threads when background subagents are disabled", () => {
  const recentThreads: ThreadHistoryEntry[] = [
    {
      id: "thread-local-main",
      preview: "",
      createdAt: 1,
      updatedAt: 1,
      status: { type: "idle" },
      cwd: "D:\\workspace\\alpha",
      hostId: "local",
      path: null,
      name: null,
      source: null,
    },
    {
      id: "thread-subagent",
      preview: "",
      createdAt: 2,
      updatedAt: 2,
      status: { type: "idle" },
      cwd: "D:\\workspace\\beta",
      hostId: "local",
      path: null,
      name: null,
      source: {
        parentThreadId: "thread-local-main",
      },
    },
  ];

  assert.deepEqual(
    filterWorkspaceRecentThreads(recentThreads, false).map((thread) => thread.id),
    ["thread-local-main"],
  );
  assert.deepEqual(
    filterWorkspaceRecentThreads(recentThreads, true).map((thread) => thread.id),
    ["thread-local-main", "thread-subagent"],
  );
});

test("select workspace empty-state decision uses full candidate options instead of visible existing rows", () => {
  assert.deepEqual(
    deriveSelectWorkspacePageState({
      candidateRoots: ["D:\\workspace\\missing"],
      inferredRoots: ["D:\\workspace\\missing"],
      isLoading: false,
      workspaceRootOptions: [
        {
          root: "D:\\workspace\\missing",
          label: "missing",
        },
      ],
      workspaceRoots: [],
    }),
    {
      hasAvailableRoots: true,
      hasPersistedOrDerivedRoots: true,
      isEmptyState: false,
    },
  );

  assert.deepEqual(
    deriveSelectWorkspacePageState({
      candidateRoots: [],
      inferredRoots: [],
      isLoading: false,
      workspaceRootOptions: [],
      workspaceRoots: [],
    }),
    {
      hasAvailableRoots: false,
      hasPersistedOrDerivedRoots: false,
      isEmptyState: true,
    },
  );
});

test("select workspace skip uses the extracted default project name for t2/t3/t4 experiment arms", () => {
  assert.equal(
    readWorkspaceOnboardingSkipProjectName("control"),
    null,
  );
  assert.equal(
    readWorkspaceOnboardingSkipProjectName("t2_direct_folder_picker"),
    WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME,
  );
  assert.equal(
    readWorkspaceOnboardingSkipProjectName("t3_auto_playground"),
    WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME,
  );
  assert.equal(
    readWorkspaceOnboardingSkipProjectName("t4_modal_copy_cta_playground"),
    WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME,
  );
});
