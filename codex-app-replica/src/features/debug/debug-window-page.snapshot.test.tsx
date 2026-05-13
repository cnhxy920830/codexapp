/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { initialAuthSnapshot, type AuthSnapshot } from "../../services/auth";
import type { ThreadConversation, ThreadHistoryEntry } from "../../services/history";
import type { ProjectlessThreadCwdResponse } from "../../services/projectlessThreads";
import type { ActiveWorkspaceRootsResponse, WorkspaceRootOptionsResponse } from "../../services/workspaceRoots";
import type { RemoteConnection } from "../../services/settingsHosts";
import type { WorktreesSettingsSnapshot } from "../../services/worktrees";
import type { AmbientSuggestionsGenerationStatus, PrimaryRuntimeUpdateStatusResponse } from "../../services/debug";
import { DebugModal } from "./DebugWindowPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/debug/__snapshots__/debug-window-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.DEBUG_WINDOW_PAGE_UPDATE_SNAPSHOTS === "1";

test("debug window page snapshot", async (t) => {
  const actualSnapshots = {
    page: renderToStaticMarkup(
      <DebugModal
        activeWorkspaceRoots={{ roots: ["D:\\workspace"] }}
        ambientSuggestionStatuses={ambientSuggestionStatuses}
        appActionDraft={`{\n  "type": "app.get_summary"\n}`}
        appActionResult="Not run yet"
        authSnapshot={authSnapshot}
        connectedRemoteConnections={remoteConnections}
        conversationId="thread-1"
        isAppActionRunning={false}
        isAmbientSuggestionsLoading={false}
        refreshingAmbientSuggestionsProjectRoot={null}
        onAppActionDraftChange={noop}
        onClose={noop}
        onPopOut={noop}
        onRefreshAmbientSuggestions={noop}
        onPrimaryRuntimeInstallReleaseChange={noop}
        onPrimaryRuntimeRefresh={noop}
        onPrimaryRuntimeRunNow={noop}
        onRunAppAction={noop}
        primaryRuntimeInstallRelease="latest"
        primaryRuntimeStatus={primaryRuntimeStatus}
        projectlessThreadCwd={projectlessThreadCwd}
        recentThreads={recentThreads}
        remoteConnections={remoteConnections}
        showHeader={false}
        showPopOutButton={false}
        threadConversation={threadConversation}
        worktreesSettings={worktreesSettings}
        workspaceRootOptions={workspaceRootOptions}
      />,
    ),
  };

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
      assert.match(actual, /Product events/);
      assert.match(actual, /App Actions/);
      assert.match(actual, /Workspace runtime/);
      assert.match(actual, /User/);
    });
  }
});

type SnapshotMap = {
  page: string;
};

const authSnapshot: AuthSnapshot = {
  ...initialAuthSnapshot,
  authState: {
    authMethod: "chatgpt",
    openAIAuth: null,
    requiresAuth: false,
    email: "debug@example.com",
    accountId: "acct-123",
    userId: "user-123",
    planAtLogin: "Pro",
  },
  isLoading: false,
};

const remoteConnections: RemoteConnection[] = [
  {
    hostId: "remote-1",
    displayName: "Remote Host",
    source: "ssh",
    autoConnect: true,
    sshAlias: "remote",
    sshHost: "example.com",
    sshPort: 22,
    identity: null,
  },
];

const primaryRuntimeStatus: PrimaryRuntimeUpdateStatusResponse = {
  disabledReason: "runtime-config-missing",
  enabled: false,
  isRunning: false,
  nextRunAt: null,
  startupChecked: false,
};

const recentThreads: ThreadHistoryEntry[] = [];
const threadConversation: ThreadConversation = {
  id: "thread-1",
  title: "Debug thread",
  cwd: "D:\\workspace",
  turns: [{ id: "turn-1" }] as unknown as ThreadConversation["turns"],
  items: [{ id: "item-1" }] as unknown as ThreadConversation["items"],
} as ThreadConversation;

const workspaceRootOptions: WorkspaceRootOptionsResponse = {
  roots: ["D:\\workspace"],
  labels: { "D:\\workspace": "Workspace" },
};
const projectlessThreadCwd: ProjectlessThreadCwdResponse = {
  cwd: "D:\\Users\\debug\\Documents\\Codex\\2026-05-13\\new-chat",
  outputDirectory: "D:\\Users\\debug\\Documents\\Codex\\2026-05-13\\new-chat",
  workspaceRoot: "D:\\Users\\debug\\Documents\\Codex",
};
const ambientSuggestionStatuses: AmbientSuggestionsGenerationStatus[] = [
  {
    projectRoot: "D:\\workspace",
    runningCount: 1,
    safetyRunningCount: 0,
    runningStartedAtMs: null,
    safetyStartedAtMs: null,
    lastFinishedAtMs: null,
  },
];

const worktreesSettings: WorktreesSettingsSnapshot = {
  autoCleanupEnabled: true,
  keepCount: 15,
};

const noop = () => {};
