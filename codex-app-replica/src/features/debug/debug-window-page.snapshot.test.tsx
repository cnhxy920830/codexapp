/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { initialAuthSnapshot, type AuthSnapshot } from "../../services/auth";
import type {
  DebugAppServerHostSnapshot,
  DebugAppServerNotificationRecord,
  DebugAppServerRequestRecord,
  DebugAppServerThreadStatusResponse,
} from "../../services/debugAppServer";
import type { ThreadConversation } from "../../services/history";
import type { PrimaryRuntimeInstallProgressEvent } from "../../services/primaryRuntime";
import type { ProjectlessThreadCwdResponse } from "../../services/projectlessThreads";
import type { HotkeyWindowHotkeyStateResponse } from "../../services/settings";
import type { WorkspaceRootOptionsResponse } from "../../services/workspaceRoots";
import type { AppServerConnectionState, RemoteConnection } from "../../services/settingsHosts";
import type {
  AmbientSuggestionsGenerationStatus,
  PackagedStateResponse,
  PrimaryRuntimeUpdateStatusResponse,
} from "../../services/debug";
import type { DebugOnboardingState } from "./DebugParitySections";
import { DebugModal } from "./DebugWindowPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/debug/__snapshots__/debug-window-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.DEBUG_WINDOW_PAGE_UPDATE_SNAPSHOTS === "1";

test("debug window page snapshot", async (t) => {
  const actualSnapshots = {
    page: renderDebugModal(),
    nodeReplOpen: renderDebugModal(["debug-node-repl-section"]),
    appServerOpen: renderDebugModal([
      "debug-app-server-section",
      "debug-app-server-requests-local",
      "debug-app-server-notifications-local",
      "debug-app-server-thread-status-local",
    ]),
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
      if (name === "page") {
        const orderedSectionMarkers = [
          "</svg></span>Product events</button>",
          "</svg></span>Node REPL</button>",
          "</svg></span>Local conversation</button>",
          "</svg></span>Child processes</button>",
          "</svg></span>App Server</button>",
          "</svg></span>Ambient suggestion chats (2)</button>",
          "</svg></span>Onboarding</button>",
          "</svg></span>Project roots</button>",
          "</svg></span>Workspace runtime</button>",
          "</svg></span>Realtime voice</button>",
          "</svg></span>Global dictation</button>",
          "</svg></span>App Actions</button>",
          "</svg></span>Worktree cleanup</button>",
          "</svg></span>Popout Window hotkey</button>",
          "</svg></span>User</button>",
        ];
        let previousIndex = -1;
        for (const marker of orderedSectionMarkers) {
          const nextIndex = actual.indexOf(marker);
          assert.notEqual(nextIndex, -1, `Expected section marker ${marker}`);
          assert.ok(nextIndex > previousIndex, `Expected ${marker} after previous section`);
          previousIndex = nextIndex;
        }
        assert.match(actual, /Reset onboarding/);
        assert.match(actual, /Force realtime voice mode off in this app and new app-server threads\./);
        assert.match(actual, /Force this dev app to own the global dictation window lock\./);
        assert.match(actual, /Disable dev override/);
        assert.doesNotMatch(actual, /Diagnostics/);
      }

      if (name === "nodeReplOpen") {
        assert.match(actual, /toolCallCount/);
        assert.match(actual, /call\[0\]\.script/);
        assert.match(actual, /Open full-size image/);
        assert.match(actual, /&lt;base64 image data:/);
      }

      if (name === "appServerOpen") {
        assert.match(actual, /Built-in app server/);
        assert.match(actual, /Remote SSH/);
        assert.match(actual, /All states \(3\)/);
        assert.match(actual, /Debug thread/);
        assert.match(actual, /Waiting on input/);
        assert.match(actual, /Untitled thread/);
        assert.match(actual, /Recent requests/);
        assert.match(actual, /Notifications/);
        assert.match(actual, /Show delta notifications/);
        assert.match(actual, /Unsubscribe/);
      }
    });
  }
});

type SnapshotMap = {
  page: string;
  nodeReplOpen: string;
  appServerOpen: string;
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

const workspaceRootOptions: WorkspaceRootOptionsResponse = {
  roots: ["D:\\workspace"],
  labels: { "D:\\workspace": "Workspace" },
};
const packagedState: PackagedStateResponse = {
  isPackaged: false,
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

const onboardingState: DebugOnboardingState = {
  browserCommentModeCoachmarkDismissed: true,
  hasSeenCodexMobileHomeAnnouncement: true,
  hasSeenRemoteConnectionsHomeAnnouncement: false,
  pluginChecklistActive: true,
  projectlessCompleted: false,
  roleSelectionDebugOverride: "on",
  routeOverride: "workspace",
  welcomePending: true,
  welcomeRoles: ["engineering", "design"],
  workspaceExperimentAssignment: {
    arm: "t3_auto_playground",
    assignedAtMs: 1,
    experimentName: "93537254",
  },
};

const primaryRuntimeInstallProgress: PrimaryRuntimeInstallProgressEvent = {
  bundleVersion: "1.2.3",
  downloadedBytes: 2 * 1024 * 1024,
  errorMessage: null,
  phase: "downloading",
  release: "latest",
  totalBytes: 8 * 1024 * 1024,
};

const hotkeyWindowState: HotkeyWindowHotkeyStateResponse = {
  supported: true,
  configuredHotkey: "Ctrl+Shift+Alt+P",
  isGateEnabled: true,
  isDevMode: true,
  isDevOverrideEnabled: true,
  isActive: true,
};

const debugAppServerRequests: DebugAppServerRequestRecord[] = [
  {
    id: "request-3",
    method: "thread/read",
    matchingRequestSequenceNumber: 3,
    startedAtMs: 1716000002345,
    endedAtMs: null,
    timeoutMs: 0,
    paramsPreview: '{\n  "threadId": "conversation-123"\n}',
    resultPreview: null,
    errorPreview: null,
    status: "pending",
    durationMs: null,
  },
  {
    id: "request-2",
    method: "thread/list",
    matchingRequestSequenceNumber: 2,
    startedAtMs: 1716000001234,
    endedAtMs: 1716000001456,
    timeoutMs: 0,
    paramsPreview: '{\n  "archived": false,\n  "limit": 100,\n  "sortKey": "updated_at"\n}',
    resultPreview: '{\n  "data": []\n}',
    errorPreview: null,
    status: "completed",
    durationMs: 222,
  },
  {
    id: "request-1",
    method: "thread/unsubscribe",
    matchingRequestSequenceNumber: 1,
    startedAtMs: 1716000000123,
    endedAtMs: 1716000000789,
    timeoutMs: 0,
    paramsPreview: '{\n  "threadId": "conversation-123"\n}',
    resultPreview: null,
    errorPreview: "unsubscribe failed",
    status: "failed",
    durationMs: 666,
  },
];

const debugAppServerNotifications: DebugAppServerNotificationRecord[] = [
  {
    id: "notification-3",
    method: "item/agentMessage/delta",
    paramsPreview: '{\n  "threadId": "conversation-123",\n  "delta": "hello"\n}',
    receivedAtMs: 1716000002567,
    severity: "noisy",
    isNoisy: true,
    threadId: "conversation-123",
  },
  {
    id: "notification-2",
    method: "error",
    paramsPreview: '{\n  "threadId": "conversation-123",\n  "message": "boom"\n}',
    receivedAtMs: 1716000002000,
    severity: "error",
    isNoisy: false,
    threadId: "conversation-123",
  },
  {
    id: "notification-1",
    method: "thread/goal/updated",
    paramsPreview: '{\n  "threadId": "conversation-123"\n}',
    receivedAtMs: 1716000001567,
    severity: "default",
    isNoisy: false,
    threadId: "conversation-123",
  },
];

const debugAppServerHosts: DebugAppServerHostSnapshot[] = [
  {
    hostId: "local",
    appServerVersion: null,
    installedCodexVersion: null,
    requests: debugAppServerRequests,
    notifications: debugAppServerNotifications,
  },
  {
    hostId: "remote-1",
    appServerVersion: "1.2.3",
    installedCodexVersion: null,
    requests: [],
    notifications: [],
  },
];

const debugAppServerConnectionStatesByHostId: Record<string, AppServerConnectionState> = {
  "remote-1": "connected",
};

const debugAppServerThreadStatusesByHostId: Record<string, DebugAppServerThreadStatusResponse> = {
  local: {
    entries: [
      {
        conversationId: "conversation-123",
        lastTurnStatus: "completed",
        resumeState: "resumed",
        threadRuntimeStatus: { type: "idle" },
        title: "Debug thread",
        updatedAt: 1716000003000,
        streamRole: { role: "owner" },
      },
      {
        conversationId: "conversation-456",
        lastTurnStatus: "inProgress",
        resumeState: "resuming",
        threadRuntimeStatus: { type: "active", activeFlags: ["waitingOnUserInput"] },
        title: "Waiting on input",
        updatedAt: 1716000002000,
        streamRole: { role: "owner" },
      },
      {
        conversationId: "conversation-789",
        lastTurnStatus: null,
        resumeState: "needs_resume",
        threadRuntimeStatus: { type: "systemError" },
        title: null,
        updatedAt: 1716000001000,
        streamRole: null,
      },
    ],
    titlesByThreadId: {
      "conversation-123": "Debug thread",
      "conversation-456": "Waiting on input",
      "conversation-789": "Untitled thread",
    },
  },
  "remote-1": {
    entries: [],
    titlesByThreadId: {},
  },
};

const threadConversation: ThreadConversation = {
  id: "conversation-123",
  title: "Debug thread",
  cwd: "D:\\workspace",
  turns: [
    {
      id: "turn-1",
      status: "completed",
      input: [
        {
          type: "comment",
          path: "src/features/debug/DebugWindowPage.tsx",
          body: "Review this file",
          content: [],
          position: null,
        },
        {
          type: "localImage",
          path: "compare/debug.png",
        },
        {
          type: "mention",
          name: "tracker",
          path: "compare/tracker.md",
        },
        {
          type: "skill",
          name: "openai-docs",
          path: "C:\\Users\\Administrator\\.codex\\skills\\.system\\openai-docs\\SKILL.md",
        },
      ],
    },
  ],
  turnTimings: [],
  items: [
    {
      type: "mcpToolCall",
      id: "node-repl-completed",
      turnId: "turn-1",
      server: "node_repl",
      tool: "eval",
      status: "completed",
      arguments: {
        code: "console.log('hello from node repl');",
        title: "Inspect globals",
        timeout_ms: 5000,
      },
      result: {
        ok: true,
        content: [
          {
            type: "text",
            text: "debug output\nsecond line",
          },
          {
            type: "image",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X3ENAAAAAElFTkSuQmCC",
            mimeType: "image/png",
          },
        ],
      },
      error: null,
      durationMs: 41,
      resultSummary: "ok",
      errorMessage: null,
    },
    {
      type: "mcpToolCall",
      id: "node-repl-failed",
      turnId: "turn-1",
      server: "node_repl",
      tool: "eval",
      status: "failed",
      arguments: {
        cwd: "D:\\workspace",
      },
      result: null,
      error: {
        message: "Process exited with status 1",
      },
      durationMs: 18,
      resultSummary: null,
      errorMessage: "Process exited with status 1",
    },
    {
      type: "mcpToolCall",
      id: "node-repl-running",
      turnId: "turn-1",
      server: "node_repl",
      tool: "eval",
      status: "inProgress",
      arguments: {
        code: "const state = await loadState();\nstate",
        timeout_ms: 1000,
      },
      result: null,
      error: null,
      durationMs: null,
      resultSummary: null,
      errorMessage: null,
    },
    {
      type: "fileChange",
      id: "change-1",
      turnId: "turn-1",
      status: "completed",
      changes: [
        {
          path: "src/features/debug/DebugWindowPage.tsx",
          kind: "modified",
          diff: "@@ -1 +1 @@\n-old\n+new",
          movePath: null,
        },
      ],
    },
  ],
};

function renderDebugModal(openSections: string[] = []) {
  return withMockSectionStorage(openSections, () =>
    renderToStaticMarkup(
      <DebugModal
        ambientSuggestionStatuses={ambientSuggestionStatuses}
        appActionDraft={`{\n  "type": "app.get_summary"\n}`}
        appActionResult="Not run yet"
        authSnapshot={authSnapshot}
        conversationId="conversation-123"
        debugAppServerInitialConnectionStatesByHostId={debugAppServerConnectionStatesByHostId}
        debugAppServerInitialHosts={debugAppServerHosts}
        debugAppServerInitialThreadStatusesByHostId={debugAppServerThreadStatusesByHostId}
        globalDictationForceLockEnabled={true}
        hotkeyWindowState={hotkeyWindowState}
        isAppActionRunning={false}
        isAmbientSuggestionsLoading={false}
        isPackaged={packagedState}
        onboardingState={onboardingState}
        refreshingAmbientSuggestionsProjectRoot={null}
        onAppActionDraftChange={noop}
        onClose={noop}
        onOpenConversation={noop}
        onPopOut={noop}
        onRefreshAmbientSuggestions={noop}
        onPrimaryRuntimeInstallReleaseChange={noop}
        onPrimaryRuntimeRefresh={noop}
        onPrimaryRuntimeRunNow={noop}
        onRunAppAction={noop}
        primaryRuntimeInstallRelease="latest"
        primaryRuntimeInstallProgress={primaryRuntimeInstallProgress}
        primaryRuntimeLastTrigger="Not run yet"
        primaryRuntimeStatus={primaryRuntimeStatus}
        projectlessThreadCwd={projectlessThreadCwd}
        realtimeVoiceDebugDisabled={true}
        remoteConnections={remoteConnections}
        showHeader={false}
        showPopOutButton={false}
        threadConversation={threadConversation}
        workspaceRootOptions={workspaceRootOptions}
      />,
    ),
  );
}

function withMockSectionStorage<T>(openSections: string[], render: () => T) {
  if (openSections.length === 0) {
    return render();
  }

  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const originalWindow = globalThis.window;
  const openSectionSet = new Set(openSections);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: {
        getItem: (key: string) => (openSectionSet.has(key) ? "open" : "closed"),
        setItem: () => undefined,
      },
    } as unknown as Window & typeof globalThis,
  });

  try {
    return render();
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: originalWindow,
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

const noop = () => {};
