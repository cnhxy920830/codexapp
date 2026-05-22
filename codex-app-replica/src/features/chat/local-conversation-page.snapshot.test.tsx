/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import type {
  ThreadConversation,
  ThreadConversationMessage,
  ThreadConversationUserInput,
} from "../../services/history";
import type { HotkeyPermissionsState } from "../hotkeyWindow/hotkeyPermissionsMode";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/chat/__snapshots__/local-conversation-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.LOCAL_CONVERSATION_PAGE_UPDATE_SNAPSHOTS === "1";

const permissionsState: HotkeyPermissionsState = {
  availableAgentModes: ["read-only", "auto", "granular", "guardian-approvals", "full-access", "custom"],
  canShowCustom: true,
  canShowDefaultPermissions: true,
  canShowFullAccess: true,
  canShowGuardian: true,
  defaultAgentMode: "auto",
  fullAccessDisabledReason: null,
  initialAgentMode: "auto",
  isDropdownDisabled: false,
  showFullAccessOption: true,
  showGuardianOption: true,
};

test("local conversation page snapshots", async (t) => {
  installBrowserModuleShim();
  const [
    { ChatConversationMainPane },
    { ChatSidePanel },
    { LocalConversationCompactComposerOverlay },
    { LocalConversationPageHeader },
    { createSideChatRightPanelTab },
  ] = await Promise.all([
    import("./ChatConversationMainPane"),
    import("./ChatSidePanel"),
    import("./LocalConversationCompactComposerOverlay"),
    import("./LocalConversationPageHeader"),
    import("./rightPanelTabs"),
  ]);
  const threadConversation = buildLocalConversationFixture();
  const emptyThreadConversation = buildEmptyLocalConversationFixture();
  const annotationOnlyThreadConversation = buildAnnotationOnlyLocalConversationFixture();
  const editingThreadConversation = buildEditingLocalConversationFixture();
  const sideChatConversation = buildSideChatConversationFixture();

  const actualSnapshots = {
    mainThread: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[1080px] w-[1440px]">
            <ChatConversationMainPane
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadQueuedFollowUps={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onFocusComposerRequest={() => undefined}
              onSelectThread={() => undefined}
              onThreadGoalEditorOpenChange={() => undefined}
              onPendingThreadGoalObjectiveChange={() => undefined}
              onEditUserMessage={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              remoteAttemptTabsByTurnId={{}}
              remoteConversationOverridesByTurnId={{}}
              composerPlacement="main"
              isThreadGoalEditorOpen={false}
              pendingThreadGoalObjective={null}
              threadConversation={threadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    mainThreadMenuOpen: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[1080px] w-[1440px]">
            <ChatConversationMainPane
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadQueuedFollowUps={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onFocusComposerRequest={() => undefined}
              onSelectThread={() => undefined}
              onThreadGoalEditorOpenChange={() => undefined}
              onPendingThreadGoalObjectiveChange={() => undefined}
              onEditUserMessage={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              remoteAttemptTabsByTurnId={{}}
              remoteConversationOverridesByTurnId={{}}
              composerPlacement="main"
              isThreadGoalEditorOpen={false}
              pendingThreadGoalObjective={null}
              threadConversation={threadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    annotationOnlyThread: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[1080px] w-[1440px]">
            <ChatConversationMainPane
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadQueuedFollowUps={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onFocusComposerRequest={() => undefined}
              onSelectThread={() => undefined}
              onThreadGoalEditorOpenChange={() => undefined}
              onPendingThreadGoalObjectiveChange={() => undefined}
              onEditUserMessage={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              remoteAttemptTabsByTurnId={{}}
              remoteConversationOverridesByTurnId={{}}
              composerPlacement="main"
              isThreadGoalEditorOpen={false}
              pendingThreadGoalObjective={null}
              threadConversation={annotationOnlyThreadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    emptyThread: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[1080px] w-[1440px]">
            <ChatConversationMainPane
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadQueuedFollowUps={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onFocusComposerRequest={() => undefined}
              onSelectThread={() => undefined}
              onThreadGoalEditorOpenChange={() => undefined}
              onPendingThreadGoalObjectiveChange={() => undefined}
              onEditUserMessage={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              remoteAttemptTabsByTurnId={{}}
              remoteConversationOverridesByTurnId={{}}
              composerPlacement="main"
              isThreadGoalEditorOpen={false}
              pendingThreadGoalObjective={null}
              threadConversation={emptyThreadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    editingUserMessage: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[1080px] w-[1440px]">
            <ChatConversationMainPane
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadQueuedFollowUps={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onFocusComposerRequest={() => undefined}
              onSelectThread={() => undefined}
              onThreadGoalEditorOpenChange={() => undefined}
              onPendingThreadGoalObjectiveChange={() => undefined}
              onEditUserMessage={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              remoteAttemptTabsByTurnId={{}}
              remoteConversationOverridesByTurnId={{}}
              composerPlacement="main"
              isThreadGoalEditorOpen={false}
              pendingThreadGoalObjective={null}
              threadConversation={editingThreadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    sideChat: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="h-[900px] w-[420px]">
            <ChatSidePanel
              activeStaticTabId={null}
              activeTab={createSideChatRightPanelTab({
                conversationId: "side-thread-1",
                index: 1,
                title: "Follow up in side chat.",
                numberedTitle: "Follow up in side chat. 1",
              })}
              browserTarget={null}
              conversationHostId={null}
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              reviewDelivery="inline"
              submitButtonMode="send"
              sideChatConversation={sideChatConversation}
              sideChatApprovals={[]}
              sideChatImplementPlanRequests={[]}
              sideChatMcpServerElicitationRequest={[]}
              sideChatPermissionsRequestApproval={[]}
              sideChatToolRequestUserInput={[]}
              sideChatQueuedFollowUps={[]}
              sideChatTurnError={null}
              pendingPdfComments={[]}
              threadConversation={threadConversation}
              onOpenSideChat={() => true}
              onOpenBrowserTarget={() => undefined}
              onOpenReviewFile={() => undefined}
              onOpenWorkspaceFileSearch={() => undefined}
              onSelectWorkspaceFile={() => undefined}
              onSubmitPdfComment={async () => undefined}
              onPendingPdfCommentsChange={() => undefined}
              onApprovalDecision={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onEditUserMessage={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onRemoveQueuedFollowUp={() => undefined}
              onSelectThread={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              approvalActionErrors={{}}
              respondingApprovalKeys={[]}
              t={translate}
              threadDiffSummary={{
                fileCount: 0,
                linesAdded: 0,
                linesDeleted: 0,
                files: [],
                hasChanges: false,
              }}
              authMethod="chatgpt"
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    fullWidthCompactComposerOverlay: normalizeMarkup(
      renderToStaticMarkup(
        <I18N_CONTEXT.Provider value={{ locale: "en-US", setLocale: () => undefined, t: translate }}>
          <div className="relative h-[900px] w-[900px] bg-[var(--app-shell-main-surface)]">
            <LocalConversationCompactComposerOverlay
              composerDraft=""
              composerEnterBehavior="enter"
              composerPermissionConfig={null}
              composerPermissionMode="auto"
              composerPermissionsState={permissionsState}
              followUpQueueMode="queue"
              isResponseInProgress={false}
              isWorktreeThread={false}
              currentThreadApprovals={[]}
              currentThreadImplementPlanRequests={[]}
              currentThreadMcpServerElicitationRequest={[]}
              currentThreadPermissionsRequestApproval={[]}
              currentThreadToolRequestUserInput={[]}
              currentThreadPendingPdfComments={[]}
              currentThreadPendingPdfCommentCount={0}
              onApprovalDecision={() => undefined}
              onDismissImplementPlanRequest={() => undefined}
              onImplementPlanRequestSubmit={() => undefined}
              onMcpServerElicitationRequestSubmit={() => undefined}
              onPermissionsRequestApprovalSubmit={() => undefined}
              onToolRequestUserInputSubmit={() => undefined}
              onComposerDraftChange={() => undefined}
              onComposerPermissionModeChange={() => undefined}
              onOpenRemoteTask={() => undefined}
              onSelectRemoteTaskAssistantTurn={() => undefined}
              onOpenSideChat={() => true}
              onOpenWorkspaceFileSearch={() => undefined}
              onSelectThread={() => undefined}
              onEditUserMessage={() => undefined}
              onStopTurn={() => undefined}
              onSubmitTurn={() => undefined}
              approvalActionErrors={{}}
              reviewDelivery="inline"
              respondingApprovalKeys={[]}
              submitButtonMode="send"
              t={translate}
              threadConversation={threadConversation}
              turnError={null}
              workspaceRoot="D:\\workspace\\project"
              conversationHostId={null}
              authMethod="chatgpt"
              activeCollaborationMode={threadConversation.latestCollaborationMode ?? null}
            />
          </div>
        </I18N_CONTEXT.Provider>,
      ),
    ),
    titleHoverCardOpen: normalizeMarkup(
      renderToStaticMarkup(
        <div className="w-[1440px]">
          <LocalConversationPageHeader
            conversationId={threadConversation.id}
            cwd={threadConversation.cwd}
            defaultTitleHoverCardOpen={true}
            heartbeatSummary="Next run: Tomorrow at 9:00 AM"
            latestCollaborationMode={threadConversation.latestCollaborationMode ?? null}
            latestReasoningEffort="high"
            projectLabel="project"
            source={threadConversation.source ?? null}
            threadBranchLabel="feature/local-header-parity"
            threadGitRoot="D:\\workspace\\project-main"
            title={threadConversation.title}
          />
        </div>,
      ),
    ),
  };

  assert.ok(!actualSnapshots.mainThread.includes('title="Next run: Tomorrow at 9:00 AM"'));
  assert.ok(!actualSnapshots.mainThread.includes('title="More actions"'));
  assert.ok(!actualSnapshots.mainThreadMenuOpen.includes('title="More actions"'));
  assert.ok(actualSnapshots.mainThread.includes("app-user-message-pill"));
  assert.ok(!actualSnapshots.mainThread.includes("app-user-message-owner-badge"));

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  mainThread: string;
  mainThreadMenuOpen: string;
  annotationOnlyThread: string;
  emptyThread: string;
  editingUserMessage: string;
  sideChat: string;
  fullWidthCompactComposerOverlay: string;
  titleHoverCardOpen: string;
};

function normalizeMarkup(markup: string) {
  return markup
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function installBrowserModuleShim() {
  if (typeof window !== "undefined") {
    return;
  }

  const eventListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const localStorageEntries = new Map<string, string>();
  const location = new URL("https://codex-app.test/?hostId=local");

  class TestCustomEvent<T = unknown> extends Event implements CustomEvent<T> {
    detail: T;

    constructor(type: string, eventInitDict?: CustomEventInit<T>) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail as T;
    }

    initCustomEvent(
      type: string,
      bubbles?: boolean,
      cancelable?: boolean,
      detail?: T,
    ) {
      this.detail = detail as T;
    }
  }

  const windowShim = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const listeners = eventListeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      listeners.add(listener);
      eventListeners.set(type, listeners);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      eventListeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      const listeners = eventListeners.get(event.type);
      if (listeners == null) {
        return true;
      }
      for (const listener of listeners) {
        if (typeof listener === "function") {
          listener.call(windowShim, event);
          continue;
        }
        listener.handleEvent(event);
      }
      return !event.defaultPrevented;
    },
    location,
    localStorage: {
      clear() {
        localStorageEntries.clear();
      },
      getItem(key: string) {
        return localStorageEntries.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(localStorageEntries.keys())[index] ?? null;
      },
      removeItem(key: string) {
        localStorageEntries.delete(key);
      },
      setItem(key: string, value: string) {
        localStorageEntries.set(key, String(value));
      },
      get length() {
        return localStorageEntries.size;
      },
    },
    navigator: {
      language: "en-US",
      platform: "Win32",
      userAgent: "node-test",
    },
    electronBridge: undefined,
    requestAnimationFrame(callback: FrameRequestCallback) {
      return setTimeout(() => {
        callback(Date.now());
      }, 0) as unknown as number;
    },
    cancelAnimationFrame(handle: number) {
      clearTimeout(handle);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowShim,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      visibilityState: "visible",
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: windowShim.navigator,
  });
  Object.defineProperty(globalThis, "CustomEvent", {
    configurable: true,
    value: TestCustomEvent,
  });
}

function buildLocalConversationFixture(): ThreadConversation {
  return {
    id: "thread-local-1",
    title: "Fix local chat parity",
    cwd: "D:\\workspace\\project",
    hostId: null,
    source: {
      parentThreadId: "thread-source-9",
      depth: 1,
      agentNickname: "@Planner",
      agentRole: "reviewer",
    },
    latestCollaborationMode: "plan",
    latestTokenUsageInfo: {
      total: {
        totalTokens: 92000,
        inputTokens: 56000,
        cachedInputTokens: 4000,
        outputTokens: 32000,
        reasoningOutputTokens: 8000,
      },
      last: {
        totalTokens: 92000,
        inputTokens: 56000,
        cachedInputTokens: 4000,
        outputTokens: 32000,
        reasoningOutputTokens: 8000,
      },
      modelContextWindow: 128000,
    },
    threadGoal: {
      threadId: "thread-local-1",
      objective: "Align the local conversation page with the extracted Codex app owner.",
      status: "active",
      tokenBudget: 150000,
      tokensUsed: 42000,
      timeUsedSeconds: 3720,
      createdAt: Date.UTC(2026, 4, 16, 8, 0, 0) / 1000,
      updatedAt: Date.UTC(2026, 4, 16, 8, 32, 0) / 1000,
    },
    turns: [
      {
        id: "turn-1",
        status: "completed",
        input: [buildTextInput("Compare extracted source and patch the local conversation page.")],
      },
    ],
    turnTimings: [
      {
        turnId: "turn-1",
        status: "completed",
        turnStartedAtMs: Date.UTC(2026, 4, 16, 8, 30, 0),
        finalAssistantStartedAtMs: Date.UTC(2026, 4, 16, 8, 31, 0),
        firstTurnWorkItemStartedAtMs: Date.UTC(2026, 4, 16, 8, 30, 30),
      },
    ],
    items: [
      {
        type: "forkedFromConversation",
        id: "forked-1",
        turnId: "turn-1",
        sourceConversationId: "thread-source-9",
        sourceConversationTitle: "Original parity audit",
      },
      {
        type: "userMessage",
        id: "user-1",
        turnId: "turn-1",
        role: "user",
        text: "Compare extracted source and patch the local conversation page.",
        completed: true,
        goal: true,
        referencesPriorConversation: true,
        reviewMode: true,
        pullRequestFixMode: true,
        pullRequestMergeTaskNumber: 123,
        autoResolveSync: true,
        pullRequestCheckCount: 2,
        comments: [
          {
            path: "docs/spec.pdf",
            body: "Carry the annotation badge outside the bubble.",
            content: [],
            origin: "pdf",
            localPdfContext: {
              pageCount: 12,
              pageNumber: 3,
              path: "D:\\workspace\\project\\docs\\spec.pdf",
              title: "Spec",
            },
            localPdfScreenshot: {
              commentId: "pdf-comment-1",
              dataUrl: "data:image/png;base64,AAAA",
              width: 96,
              height: 72,
              pageNumber: 3,
            },
          },
          {
            path: "https://example.com/review",
            body: "Keep the browser-selection badge in the tooltip owner.",
            content: [],
            origin: "browser",
          },
          {
            path: "src/App.tsx",
            body: "Align the local header with source owner.",
            content: [],
            position: { path: "src/App.tsx", line: 42, side: "left" },
          },
          {
            path: "src/features/chat/ThreadComposer.tsx",
            body: "Keep the composer footer control ordering source-backed.",
            content: [],
            position: {
              path: "src/features/chat/ThreadComposer.tsx",
              line: 128,
              side: "right",
            },
          },
        ],
        attachments: [
          {
            label: "ThreadPageHeader.tsx (42-44)",
            path: "D:\\workspace\\project\\src\\features\\chat\\ThreadPageHeader.tsx",
            fsPath: "D:\\workspace\\project\\src\\features\\chat\\ThreadPageHeader.tsx",
            startLine: 42,
            endLine: 44,
          },
        ],
        images: ["https://example.com/user-attachment.png"],
      },
      {
        type: "agentMessage",
        id: "assistant-1",
        turnId: "turn-1",
        role: "assistant",
        text: "Patched the header shell and message chrome from extracted source owners.",
        completed: true,
      },
    ],
  };
}

function buildSideChatConversationFixture(): ThreadConversation {
  return {
    id: "side-thread-1",
    title: "Side chat 1",
    cwd: "D:\\workspace\\project",
    hostId: null,
    source: {
      parentThreadId: "thread-local-1",
      depth: 2,
      agentNickname: "@Reviewer",
      agentRole: "default",
    },
    latestTokenUsageInfo: null,
    turns: [
      {
        id: "side-turn-1",
        status: "completed",
        input: [buildTextInput("Follow up in side chat.")],
      },
    ],
    turnTimings: [
      {
        turnId: "side-turn-1",
        status: "completed",
        turnStartedAtMs: Date.UTC(2026, 4, 16, 8, 45, 0),
        finalAssistantStartedAtMs: Date.UTC(2026, 4, 16, 8, 45, 20),
        firstTurnWorkItemStartedAtMs: Date.UTC(2026, 4, 16, 8, 45, 10),
      },
    ],
    items: [
      {
        type: "forkedFromConversation",
        id: "side-forked-1",
        turnId: "side-turn-1",
        sourceConversationId: "thread-local-1",
        sourceConversationTitle: "Fix local chat parity",
      },
      {
        type: "userMessage",
        id: "side-user-1",
        turnId: "side-turn-1",
        role: "user",
        text: "Follow up in side chat.",
        completed: true,
      },
      {
        type: "agentMessage",
        id: "side-assistant-1",
        turnId: "side-turn-1",
        role: "assistant",
        text: "Side pane composer uses the source-backed compact branch.",
        completed: true,
      },
    ],
  };
}

function buildAnnotationOnlyLocalConversationFixture(): ThreadConversation {
  const threadConversation = buildLocalConversationFixture();
  const annotationOnlyUserMessage = threadConversation.items.find(
    (item): item is ThreadConversationMessage => item.type === "userMessage",
  );

  if (annotationOnlyUserMessage === undefined) {
    return threadConversation;
  }

  return {
    ...threadConversation,
    items: threadConversation.items.map((item) =>
      item.type !== "userMessage" || item.id !== annotationOnlyUserMessage.id
        ? item
        : {
            ...item,
            comments: item.comments?.filter(
              (comment) =>
                comment.origin === "pdf" ||
                comment.localPdfContext != null ||
                comment.localPdfScreenshot != null,
            ),
          },
    ),
  };
}

function buildEmptyLocalConversationFixture(): ThreadConversation {
  const threadConversation = buildLocalConversationFixture();

  return {
    ...threadConversation,
    turns: [],
    turnTimings: [],
    items: [],
    latestTokenUsageInfo: null,
    threadGoal: null,
  };
}

function buildEditingLocalConversationFixture(): ThreadConversation {
  const threadConversation = buildLocalConversationFixture();
  const userMessage = threadConversation.items.find(
    (item): item is ThreadConversationMessage => item.type === "userMessage",
  );

  if (userMessage === undefined) {
    return threadConversation;
  }

  return {
    ...threadConversation,
    items: threadConversation.items.map((item) =>
      item.type !== "userMessage" || item.id !== userMessage.id
        ? item
        : {
            ...item,
            comments: [],
            text: "/side Draft a tighter parity checklist with @browser-use and $code-review",
          },
    ),
  };
}

function buildTextInput(text: string): ThreadConversationUserInput {
  return {
    type: "text",
    text,
    textElements: [],
  };
}

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "app.nav.newChat":
      return "New chat";
    case "app.chat.composePlaceholder":
      return "Ask Codex";
    case "app.chat.filesChanged":
      return `${values?.fileCount ?? 0} files changed`;
    case "app.chat.homePage":
    case "homePage.mainContent":
      return "Main content";
    case "app.chat.queuedFollowUps":
      return `${values?.count ?? 0} queued follow-ups`;
    case "app.chat.removeQueuedFollowUp":
      return "Remove";
    case "app.chat.send":
      return "Send";
    case "app.chat.stop":
      return "Stop";
    case "app.chat.status.completed":
      return "Completed";
    case "app.chat.status.inProgress":
      return "In progress";
    case "app.chat.status.failed":
      return "Failed";
    case "app.chat.status.declined":
      return "Declined";
    case "app.chat.userMessage.autoResolveSync":
      return "Auto resolve conflicts";
    case "app.chat.userMessage.commentCount":
      return `${values?.count ?? 0} comments`;
    case "app.chat.userMessage.copyAriaLabel":
      return "Copy message";
    case "app.chat.userMessage.copyCopiedAriaLabel":
      return "Copied";
    case "app.chat.userMessage.copyCopiedTooltip":
      return "Copied";
    case "app.chat.userMessage.copyTooltip":
      return "Copy";
    case "app.chat.userMessage.editAriaLabel":
      return "Edit message";
    case "app.chat.userMessage.editPlaceholder":
      return "Edit message";
    case "app.chat.userMessage.editTooltip":
      return "Edit";
    case "app.chat.userMessage.goal":
      return "Goal";
    case "app.chat.userMessage.implementPlan":
      return "Implement plan";
    case "app.chat.userMessage.noContent":
      return "(No content)";
    case "app.chat.userMessage.pullRequestCheckCount":
      return `${values?.count ?? 0} CI tests`;
    case "app.chat.userMessage.pullRequestFixMode":
      return "PR fix";
    case "app.chat.userMessage.pullRequestMergeTask":
      return `PR #${values?.number ?? 0}`;
    case "app.chat.userMessage.referencesPriorConversation":
      return "References prior conversation";
    case "app.chat.userMessage.reviewMode":
      return "Review mode";
    case "commentAttachments.numAnnotations":
      return `${values?.count ?? 0} annotations`;
    case "commentAttachments.numComments":
      return `${values?.count ?? 0} comments`;
    case "codex.review.noDiff.gitInit.createRepository":
      return "Create git repository";
    case "codex.review.noDiff.gitInit.creating":
      return "Creating…";
    case "codex.localConversation.comment.screenshotAttached":
      return "Screenshot attached";
    case "codex.localConversation.pdfComment.annotationAttached":
      return "PDF annotation attached";
    case "codex.localConversation.browserComment.selectedElement":
      return "Selected page element";
    case "codex.localConversation.diffCommentLeftSide":
      return "L";
    case "codex.localConversation.diffCommentRightSide":
      return "R";
    case "composer.contextWindow.autoCompactionTooltipLine1":
      return "Codex automatically compacts its context";
    case "composer.pendingThreadGoal.summary":
      return "Goal";
    case "composer.pendingThreadGoal.editTooltip":
    case "composer.pendingThreadGoal.edit":
      return "Edit goal";
    case "composer.pendingThreadGoal.clearTooltip":
    case "composer.pendingThreadGoal.clear":
      return "Clear goal";
    case "composer.threadGoalEditor.editTitle":
      return "Edit goal";
    case "composer.threadGoalEditor.createTitle":
      return "Set goal";
    case "composer.threadGoalEditor.objectiveAriaLabel":
      return "Goal objective";
    case "composer.threadGoalEditor.objectivePlaceholder":
      return "What should Codex keep working toward?";
    case "composer.threadGoalEditor.useDraft":
      return "Use draft";
    case "composer.threadGoalEditor.cancel":
      return "Cancel";
    case "composer.threadGoalEditor.save":
      return "Save goal";
    case "composer.threadGoalEditor.set":
      return "Set goal";
    case "composer.threadGoal.editTooltip":
    case "composer.threadGoal.edit":
      return "Edit goal";
    case "composer.threadGoal.pauseTooltip":
    case "composer.threadGoal.pause":
      return "Pause goal";
    case "composer.threadGoal.resumeTooltip":
    case "composer.threadGoal.resume":
      return "Resume goal";
    case "composer.threadGoal.clearTooltip":
    case "composer.threadGoal.clear":
      return "Clear goal";
    case "composer.threadGoal.expand":
      return "Expand goal details";
    case "composer.threadGoal.collapse":
      return "Collapse goal details";
    case "composer.threadGoal.summary.active":
      return "Goal";
    case "composer.threadGoal.summary.paused":
      return "Goal paused";
    case "composer.threadGoal.summary.budgetLimited":
      return "Goal limited";
    case "composer.threadGoal.summary.complete":
      return "Goal complete";
    case "composer.threadGoal.status.active":
      return "Active";
    case "composer.threadGoal.status.paused":
      return "Paused";
    case "composer.threadGoal.status.budgetLimited":
      return "Limited by budget";
    case "composer.threadGoal.status.complete":
      return "Complete";
    case "composer.threadGoal.tokenUsage":
      return `${values?.used ?? 0} / ${values?.budget ?? 0} tokens`;
    case "composer.threadGoal.setError":
      return "Failed to set goal";
    case "composer.threadGoal.statusUpdateError":
      return "Failed to update goal";
    case "composer.threadGoal.clearError":
      return "Failed to clear goal";
    case "composer.contextWindow.usagePercent":
      return `${values?.usage ?? 0}%`;
    case "composer.contextWindowUsageLabel":
      return "Context window:";
    case "composer.contextWindowUsageStatusFull":
      return `${values?.usage ?? 0}% full`;
    case "composer.contextWindowUsageStatusLeft":
      return `${values?.usage ?? 0}% used (${values?.remaining ?? 0}% left)`;
    case "composer.contextWindowUsageTooltip":
      return `${values?.usedTokens ?? 0}k / ${values?.contextWindow ?? 0}k tokens used`;
    case "composer.mode.agentMode.fullAccessConfirm.caution":
      return "Caution";
    case "composer.mode.agentMode.fullAccessConfirm.confirm":
      return "Yes, continue anyway";
    case "composer.mode.agentMode.fullAccessConfirm.description":
      return "Description";
    case "composer.mode.agentMode.fullAccessConfirm.goBack":
      return "Go back";
    case "composer.mode.agentMode.fullAccessConfirm.title":
      return "Enable full access?";
    case "composer.mode.agentMode.guardianApprovals":
      return "Auto-review";
    case "composer.permissionsDropdown.default.tooltip":
      return "Codex automatically runs commands in a sandbox";
    case "composer.permissionsDropdown.guardianApproval.tooltip":
      return "Auto-review tooltip";
    case "composer.permissionsDropdown.guardianApproval.disabled":
      return "Auto-review disabled";
    case "composer.permissionsDropdown.custom.label":
      return "Custom";
    case "composer.permissionsDropdown.custom.optionLabel":
      return "Custom (config.toml)";
    case "composer.permissionsDropdown.agentMode.tooltip.custom":
      return "Custom permissions tooltip";
    case "composer.permissionsDropdown.default.label":
      return "Default permissions";
    case "composer.permissionsDropdown.default.optionLabel":
      return "Default permissions";
    case "composer.permissionsDropdown.disabled.requirements":
      return "Permissions locked";
    case "composer.permissionsDropdown.trigger.tooltip":
      return "Change permissions";
    case "composer.permissionsDropdown.agentMode.tooltip.fullAccess":
      return "Full access tooltip";
    case "composer.permissionsDropdown.fullAccess.disabled":
      return "Full access disabled";
    case "composer.permissionsDropdown.fullAccess.disabledGlobalDefault":
      return "Full access disabled globally";
    case "composer.permissionsDropdown.fullAccess.label":
      return "Full access";
    case "composer.permissionsDropdown.fullAccess.optionLabel":
      return "Full access";
    case "composer.permissionsDropdown.guardianApproval.shortLabel":
      return "Auto-review";
    case "composer.remote.currentBranch":
      return `${values?.branch ?? ""} (current)`;
    case "general.enterBehaviorDescription":
      return `Use ${values?.modifierSymbol ?? "Cmd"}+Enter`;
    case "localConversation.parentThread":
      return "Parent chat";
    case "localConversation.forkedFromConversation":
      return "Forked from conversation";
    case "localConversation.header.openHeartbeatAutomation":
      return "Open heartbeat automation";
    case "localConversation.scrollToBottomButton":
      return "Scroll to bottom";
    case "settings.automations.executionEnvironment.local":
      return "Local";
    case "settings.automations.executionEnvironment.worktree":
      return "Worktree";
    case "thread.sidePanel.empty.title":
      return "Nothing open";
    case "thread.sidePanel.openFile":
      return "Open file";
    case "thread.sidePanel.toggle":
      return "Toggle side panel";
    case "threadHeader.addAutomation":
      return "Add automation";
    case "threadHeader.copyAppLink":
      return "Copy app link";
    case "threadHeader.copyConversationMarkdown":
      return "Copy conversation markdown";
    case "threadHeader.copySessionId":
      return "Copy session ID";
    case "threadHeader.copyWorkingDirectory":
      return "Copy working directory";
    case "threadHeader.editAutomation":
      return "Edit automation";
    case "threadHeader.forkIntoLocal":
      return "Fork into local";
    case "threadHeader.forkIntoSameWorktree":
      return "Fork into same worktree";
    case "threadHeader.forkIntoWorktree":
      return "Fork into worktree";
    case "threadHeader.moreActions":
      return "More actions";
    case "threadHeader.openInNewWindow":
      return "Open in new window";
    case "threadHeader.openSideChat":
      return "Open side chat";
    case "codex.tabs.closeNamed":
      return `Close ${values?.title ?? ""} tab`;
    case "sidebarElectron.archiveThread":
      return "Archive thread";
    case "sidebarElectron.pinThread":
      return "Pin thread";
    case "sidebarElectron.renameThread":
      return "Rename thread";
    case "sidebarElectron.unpinThread":
      return "Unpin thread";
    default:
      return key;
  }
}
