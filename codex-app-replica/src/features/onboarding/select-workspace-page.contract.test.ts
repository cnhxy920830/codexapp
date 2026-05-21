import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { ThreadHistoryEntry } from "../../services/history";
import {
  buildWorkspaceRootOptions,
  deriveSelectWorkspacePageState,
  filterWorkspaceRecentThreads,
  filterExistingWorkspaceRootOptions,
  mergeWorkspaceRootSelectionsForPersistence,
  readWorkspaceOnboardingSkipProjectName,
  stripWorkspaceRootExtendedPrefix,
  WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME,
} from "./selectWorkspaceModel";

const SELECT_WORKSPACE_PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/onboarding/SelectWorkspacePage.tsx",
);
const REMOTE_PROJECT_SETUP_DIALOG_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/localEnvironments/RemoteProjectSetupDialog.tsx",
);
const APP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/App.tsx",
);

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

test("select workspace root labels follow extracted trim-or-basename fallback without local word truncation", () => {
  assert.deepEqual(
    buildWorkspaceRootOptions(
      [
        "\\\\?\\C:\\Users\\Administrator\\Projects\\very long repository name",
        "D:\\workspace\\fallback-name",
      ],
      {
        "\\\\?\\C:\\Users\\Administrator\\Projects\\very long repository name": "  Very long project label kept intact  ",
      },
    ),
    [
      {
        root: "\\\\?\\C:\\Users\\Administrator\\Projects\\very long repository name",
        label: "Very long project label kept intact",
      },
      {
        root: "D:\\workspace\\fallback-name",
        label: "fallback-name",
      },
    ],
  );
});

test("select workspace path normalization matches extracted extended-path handling", () => {
  assert.equal(
    stripWorkspaceRootExtendedPrefix("\\\\?\\C:\\Users\\Administrator\\Projects\\demo"),
    "C:\\Users\\Administrator\\Projects\\demo",
  );
  assert.equal(
    stripWorkspaceRootExtendedPrefix("\\\\?\\UNC\\server\\share\\workspace"),
    "\\\\server\\share\\workspace",
  );
  assert.deepEqual(
    filterExistingWorkspaceRootOptions(
      [
        {
          root: "\\\\?\\C:\\Users\\Administrator\\Projects\\demo\\",
          label: "demo",
        },
        {
          root: "D:\\workspace\\other",
          label: "other",
        },
      ],
      ["c:/users/administrator/projects/demo"],
    ),
    [
      {
        root: "\\\\?\\C:\\Users\\Administrator\\Projects\\demo\\",
        label: "demo",
      },
    ],
  );
});

test("select workspace page keeps extracted host-aware state reads and filtering", () => {
  const source = readSource(SELECT_WORKSPACE_PAGE_SOURCE_PATH);

  assert.match(source, /onGlobalStateUpdated\(/);
  assert.match(source, /readSettingsRemoteProjectsSnapshot\(\)/);
  assert.match(source, /REMOTE_PROJECTS_SHARED_OBJECT_KEY/);
  assert.match(source, /getGlobalState\("active-remote-project-id"\)/);
  assert.match(source, /currentWindowHostId: string;/);
  assert.match(source, /const currentHostId = normalizeOptionalString\(currentWindowHostId\) \?\? LOCAL_SETTINGS_HOST_ID;/);
  assert.match(source, /const isRemoteHost = currentHostId !== LOCAL_SETTINGS_HOST_ID;/);
  assert.match(
    source,
    /recentThreads\.filter\(\(thread\) => \(thread\.hostId \?\? LOCAL_SETTINGS_HOST_ID\) === currentHostId\)/,
  );
  assert.match(source, /setPendingWorktrees\(entries\.filter\(\(entry\) => entry\.hostId === currentHostId\)\);/);
  assert.match(source, /readWorkspaceRootOptions\(currentHostId\)/);
  assert.match(source, /readGitOrigins\(\{ dirs, hostId: currentHostId \}\)/);
  assert.match(source, /readExistingPaths\(candidateRoots, currentHostId\)/);
  assert.match(source, /stripWorkspaceRootExtendedPrefix\(normalizedRoot\)/);
  assert.match(source, /isRemoteHost=\{isRemoteHost\}/);
});

test("select workspace page routes remote add-project through the extracted choose-folder dialog flow", () => {
  const source = readSource(SELECT_WORKSPACE_PAGE_SOURCE_PATH);

  assert.match(source, /<RemoteProjectSetupDialog/);
  assert.match(source, /mode="pick"/);
  assert.match(source, /initialHostId=\{currentHostId\}/);
  assert.match(source, /if \(isRemoteHost\) {\s*setIsRemotePathDialogOpen\(true\);\s*return;\s*}/);
  assert.match(source, /await pickWorkspaceRootOption\(\);/);
  assert.match(source, /setPickedRoots\(\(current\) => dedupeWorkspaceRoots\(\[\.\.\.current, params\.remotePath\]\)\);/);
  assert.match(
    source,
    /setSelectedRoots\(\(current\) => \(\{\s*\.\.\.current,\s*\[params\.remotePath\]: true,\s*\}\)\);/,
  );
  assert.match(source, /onContinueToHome: \(state: \{ focusComposerNonce: number; hostId: string \}\) => void;/);
  assert.match(source, /await setGlobalState\("active-remote-project-id", null\);/);
  assert.match(source, /if \(!isRemoteHost\) {\s*await updateWorkspaceRootOptions\(nextWorkspaceRoots\);\s*}/);
  assert.match(source, /if \(!isRemoteHost\) {\s*await setActiveWorkspaceRoot\(selectedRootList\[0\]\);\s*}/);
  assert.match(source, /onContinueToHome\(\{\s*focusComposerNonce: continueNonceRef\.current,\s*hostId: currentHostId,\s*}\);/);
});

test("remote project setup dialog keeps extracted pick-mode semantics separate from standalone setup conflicts", () => {
  const source = readSource(REMOTE_PROJECT_SETUP_DIALOG_SOURCE_PATH);

  assert.match(source, /const isPickMode = mode === "pick";/);
  assert.match(source, /if \(isPickMode\) {\s*return null;\s*}/);
  assert.match(source, /kind: "conflicting-remote-project"/);
  assert.match(source, /isPickMode \? t\("workspaceRootDialog\.confirmPick"\) : t\("workspaceRootDialog\.confirmAdd"\)/);
});

test("app handoff creates new threads with host-aware thread and turn flows", () => {
  const source = readSource(APP_SOURCE_PATH);

  assert.match(source, /const \[currentWindowHostId, setCurrentWindowHostId\] = useState<string>\(\(\) => readInitialSettingsHostId\(\)\);/);
  assert.match(source, /openNewConversation\(\{ focusComposerNonce, initialHostId: hostId }\);/);
  assert.match(source, /await startThreadForHost\(\{\s*cwd,\s*hostId,\s*collaborationMode: buildCollaborationModePayload\("default"\),\s*}\)/);
  assert.match(source, /hostId === LOCAL_SETTINGS_HOST_ID\s*\?\s*await getRecentThreads\(\)\s*:\s*await getRecentThreadsForHost\(hostId\)/);
  assert.match(source, /return loadThreadConversation\(threadId, hostId\);/);
  assert.match(source, /hostId,\s*threadId,\s*input,\s*cwd,/s);
  assert.match(source, /hostId,\s*threadId,\s*text,\s*cwd,/s);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
