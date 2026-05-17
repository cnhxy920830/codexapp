import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../src/i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../src/i18n/messages";
import { RightPanelCollapsedRail, RightPanelTabStrip } from "../src/features/chat/RightPanelTabStrip";
import { ReviewGitActions } from "../src/features/chat/ReviewGitActions";
import { ReviewSidePanel } from "../src/features/chat/ReviewSidePanel";
import {
  createSideChatRightPanelTab,
  createWorkspaceFileRightPanelTab,
} from "../src/features/chat/rightPanelTabs";
import type { ThreadDiffSummary } from "../src/features/chat/threadConversationState";
import { ChatConversationMainPane } from "../src/features/chat/ChatConversationMainPane";
import { ChatSidePanel } from "../src/features/chat/ChatSidePanel";
import { LocalConversationPageHeader } from "../src/features/chat/LocalConversationPageHeader";
import type {
  ThreadConversation,
  ThreadConversationMessage,
  ThreadConversationUserInput,
} from "../src/services/history";
import type { HotkeyPermissionsState } from "../src/features/hotkeyWindow/hotkeyPermissionsMode";
import { AutomationsOverviewPane } from "../src/features/automations/AutomationsOverviewPane";
import type { AutomationRecord, CronAutomationRecord } from "../src/services/automations";

const rootDir = process.cwd();

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

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  const formattedPluralTemplate = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, token, oneVariant, otherVariant) => {
      const rawValue = values[token];
      const numericValue =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? Number(rawValue)
            : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const variant = numericValue === 1 ? oneVariant : otherVariant;
      return variant.replaceAll("#", String(numericValue));
    },
  );

  return formattedPluralTemplate.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(MESSAGES["en-US"][key], values);
}

function withI18n(element: ReactElement) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US" as LocaleCode,
        setLocale: () => undefined,
        t: translate,
      }}
    >
      {element}
    </I18N_CONTEXT.Provider>
  );
}

function normalizeChatMarkup(markup: string) {
  return markup.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
}

function normalizeAutomationsMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/src="data:image\/svg\+xml,[^"]*"/g, 'src="[asset]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildThreadDiffSummaryFixture(): ThreadDiffSummary {
  return {
    fileCount: 2,
    linesAdded: 5,
    linesDeleted: 2,
    hasChanges: true,
    files: [
      {
        kind: "modified",
        path: "src/features/chat/ThreadComposer.tsx",
        movePath: null,
        diff: [
          "@@ -1,4 +1,6 @@",
          ' import React from "react";',
          '+import { useEffect } from "react";',
          " export function ThreadComposer() {",
          "-  return null;",
          "+  return <div>composer</div>;",
          " }",
        ].join("\n"),
      },
      {
        kind: "renamed",
        path: "src/features/chat/ReviewPane.tsx",
        movePath: "src/features/chat/ReviewSidePanel.tsx",
        diff: [
          "--- a/src/features/chat/ReviewPane.tsx",
          "+++ b/src/features/chat/ReviewSidePanel.tsx",
          "@@ -10,2 +10,4 @@",
          '-const title = "Review";',
          '+const title = "Review changes";',
          '+const subtitle = "2 files changed";',
        ].join("\n"),
      },
    ],
  };
}

const EMPTY_THREAD_DIFF_SUMMARY: ThreadDiffSummary = {
  fileCount: 0,
  linesAdded: 0,
  linesDeleted: 0,
  files: [],
  hasChanges: false,
};

function buildReviewSidePanelSnapshots() {
  return {
    reviewWithChanges: normalizeChatMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ReviewSidePanel
            gitInitCwd="D:\\workspace"
            gitRoot="D:\\workspace"
            hostId={null}
            onOpenReviewFile={() => undefined}
            showGitRepoRequired={false}
            t={translate}
            threadDiffSummary={buildThreadDiffSummaryFixture()}
          />
        </div>,
      ),
    ),
    reviewEmpty: normalizeChatMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ReviewSidePanel
            gitInitCwd="D:\\workspace"
            gitRoot="D:\\workspace"
            hostId={null}
            onOpenReviewFile={() => undefined}
            showGitRepoRequired={true}
            t={translate}
            threadDiffSummary={EMPTY_THREAD_DIFF_SUMMARY}
          />
        </div>,
      ),
    ),
    reviewEmptyOptionsMenuOpen: normalizeChatMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ReviewSidePanel
            defaultOptionsMenuOpen
            gitInitCwd="D:\\workspace"
            gitRoot="D:\\workspace"
            hostId={null}
            onOpenReviewFile={() => undefined}
            showGitRepoRequired={true}
            t={translate}
            threadDiffSummary={EMPTY_THREAD_DIFF_SUMMARY}
          />
        </div>,
      ),
    ),
    reviewGitActionsMenuOpen: normalizeChatMarkup(
      renderToStaticMarkup(
        <div className="p-6">
          <ReviewGitActions defaultMenuOpen gitRoot="D:\\workspace" hostId={null} t={translate} />
        </div>,
      ),
    ),
    collapsedRailQuickOpenOnly: normalizeChatMarkup(
      renderToStaticMarkup(
        <RightPanelCollapsedRail
          activeStaticTabId={null}
          collapsedTabs={[]}
          onActivateTab={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onOpenWorkspaceFileSearch={() => undefined}
          t={translate}
        />,
      ),
    ),
    collapsedRailWithTabs: normalizeChatMarkup(
      renderToStaticMarkup(
        <RightPanelCollapsedRail
          activeStaticTabId="review"
          collapsedTabs={[
            createWorkspaceFileRightPanelTab({
              name: "thread.ts",
              path: "D:\\workspace\\src\\thread.ts",
              relativePath: "src/thread.ts",
              workspaceRoot: "D:\\workspace",
            }),
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onOpenWorkspaceFileSearch={() => undefined}
          t={translate}
        />,
      ),
    ),
    tabStripWithDynamicTabs: normalizeChatMarkup(
      renderToStaticMarkup(
        <RightPanelTabStrip
          activeTabId="sidechat:side-1"
          activeStaticTabId={null}
          openTabs={[
            createWorkspaceFileRightPanelTab({
              name: "thread.ts",
              path: "D:\\workspace\\src\\thread.ts",
              relativePath: "src/thread.ts",
              workspaceRoot: "D:\\workspace",
            }),
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onCloseTab={() => undefined}
          onReorderTabs={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onOpenWorkspaceFileSearch={() => undefined}
          onToggleFullWidth={() => undefined}
          onTogglePanel={() => undefined}
          rightPanelWidthMode="regular"
          t={translate}
        />,
      ),
    ),
    tabStripFullWidthMode: normalizeChatMarkup(
      renderToStaticMarkup(
        <RightPanelTabStrip
          activeTabId="sidechat:side-1"
          activeStaticTabId="review"
          openTabs={[
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onCloseTab={() => undefined}
          onReorderTabs={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onOpenWorkspaceFileSearch={() => undefined}
          onToggleFullWidth={() => undefined}
          onTogglePanel={() => undefined}
          rightPanelWidthMode="full"
          t={translate}
        />,
      ),
    ),
  };
}

function buildTextInput(text: string): ThreadConversationUserInput {
  return { type: "text", text, textElements: [] };
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
        comments: [],
        attachments: [],
        images: [],
      } as ThreadConversationMessage,
      {
        type: "multiAgentAction",
        id: "multi-agent-1",
        turnId: "turn-1",
        action: "spawn_agents",
        status: "completed",
        senderThreadId: "thread-source-9",
        receiverThreads: [],
        prompt: "Audit remaining UI parity differences.",
        model: "claude-opus-4-7",
        reasoningEffort: "high",
        agentsStates: {},
      },
    ],
    hasUnreadTurn: false,
  } as ThreadConversation;
}

function buildAnnotationOnlyLocalConversationFixture(): ThreadConversation {
  return {
    ...buildLocalConversationFixture(),
    id: "thread-annotation-only",
    items: buildLocalConversationFixture().items.slice(0, 1),
  };
}

function buildEditingLocalConversationFixture(): ThreadConversation {
  return buildLocalConversationFixture();
}

function buildSideChatConversationFixture(): ThreadConversation {
  return {
    ...buildLocalConversationFixture(),
    id: "side-thread-1",
    title: "Follow up in side chat.",
  };
}

function buildLocalConversationPageSnapshots() {
  const threadConversation = buildLocalConversationFixture();
  const annotationOnlyThreadConversation = buildAnnotationOnlyLocalConversationFixture();
  const editingThreadConversation = buildEditingLocalConversationFixture();
  const sideChatConversation = buildSideChatConversationFixture();

  return {
    mainThread: normalizeChatMarkup(
      renderToStaticMarkup(
        withI18n(
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
          </div>,
        ),
      ),
    ),
    mainThreadMenuOpen: normalizeChatMarkup(
      renderToStaticMarkup(
        withI18n(
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
          </div>,
        ),
      ),
    ),
    annotationOnlyThread: normalizeChatMarkup(
      renderToStaticMarkup(
        withI18n(
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
          </div>,
        ),
      ),
    ),
    editingUserMessage: normalizeChatMarkup(
      renderToStaticMarkup(
        withI18n(
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
          </div>,
        ),
      ),
    ),
    sideChat: normalizeChatMarkup(
      renderToStaticMarkup(
        withI18n(
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
          </div>,
        ),
      ),
    ),
    titleHoverCardOpen: normalizeChatMarkup(
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
            threadGitRoot={null}
            title={threadConversation.title}
          />
        </div>,
      ),
    ),
  };
}

function createBaseDraft(): CronAutomationRecord {
  return {
    kind: "cron",
    id: "base-draft",
    name: "",
    prompt: "",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    cwds: [],
    executionEnvironment: "local",
    localEnvironmentConfigPath: null,
    model: null,
    reasoningEffort: null,
    rrule: "FREQ=DAILY;INTERVAL=1",
  };
}

function createCurrentAutomation(): AutomationRecord {
  return {
    kind: "cron",
    id: "current-1",
    name: "Release notes",
    prompt: "Draft weekly release notes.",
    status: "ACTIVE",
    createdAt: 1_715_248_000_000,
    updatedAt: 1_715_248_000_000,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    localEnvironmentConfigPath: null,
    model: "gpt-5.4",
    reasoningEffort: "high",
    rrule: "FREQ=WEEKLY;INTERVAL=1;BYHOUR=9;BYMINUTE=0;BYDAY=FR",
  };
}

function createPausedAutomation(): AutomationRecord {
  return {
    kind: "cron",
    id: "paused-1",
    name: "CI monitor",
    prompt: "Check CI failures.",
    status: "PAUSED",
    createdAt: 1_715_248_000_000,
    updatedAt: 1_715_248_000_000,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "local",
    localEnvironmentConfigPath: null,
    model: "gpt-5.4",
    reasoningEffort: "medium",
    rrule: "FREQ=HOURLY;INTERVAL=2;BYMINUTE=0;BYDAY=MO,TU,WE,TH,FR",
  };
}

function buildAutomationsOverviewSnapshots() {
  return {
    emptyState: normalizeAutomationsMarkup(
      renderToStaticMarkup(
        withI18n(
          <div className="w-[1280px] h-[900px]">
            <AutomationsOverviewPane
              isLoading={false}
              isRunningNowId={null}
              items={[]}
              locale="en-US"
              openRowMenuId={null}
              quickStartBaseDraft={createBaseDraft()}
              selectedId={null}
              threadNameById={new Map()}
              workspaceRootLabels={{}}
              onDeleteAutomation={() => undefined}
              onPauseAutomation={() => undefined}
              onSelectQuickStart={() => undefined}
              onResumeAutomation={() => undefined}
              onRunAutomationNow={() => undefined}
              onSelectAutomation={() => undefined}
              onToggleMenu={() => undefined}
              t={translate}
            />
          </div>,
        ),
      ),
    ),
    populatedState: normalizeAutomationsMarkup(
      renderToStaticMarkup(
        withI18n(
          <div className="w-[1280px] h-[900px]">
            <AutomationsOverviewPane
              isLoading={false}
              isRunningNowId="current-1"
              items={[createCurrentAutomation(), createPausedAutomation()]}
              locale="en-US"
              openRowMenuId="paused-1"
              quickStartBaseDraft={createBaseDraft()}
              selectedId="current-1"
              threadNameById={new Map()}
              workspaceRootLabels={{
                "D:\\workspace\\codex-app": "codex-app",
              }}
              onDeleteAutomation={() => undefined}
              onPauseAutomation={() => undefined}
              onSelectQuickStart={() => undefined}
              onResumeAutomation={() => undefined}
              onRunAutomationNow={() => undefined}
              onSelectAutomation={() => undefined}
              onToggleMenu={() => undefined}
              t={translate}
            />
          </div>,
        ),
      ),
    ),
  };
}

async function writeSnapshot(relativePath: string, value: unknown) {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  await writeSnapshot("src/features/chat/__snapshots__/review-side-panel.snap.json", buildReviewSidePanelSnapshots());
  await writeSnapshot("src/features/chat/__snapshots__/local-conversation-page.snap.json", buildLocalConversationPageSnapshots());
  await writeSnapshot("src/features/automations/__snapshots__/automations-overview.snap.json", buildAutomationsOverviewSnapshots());
}

void main();
