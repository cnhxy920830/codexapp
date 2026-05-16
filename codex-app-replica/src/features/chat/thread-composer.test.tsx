/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildThreadComposerPermissionOptions,
  parseSideChatCommandDraft,
  ThreadComposer,
} from "./ThreadComposer";
import type { HotkeyPermissionsState } from "../hotkeyWindow/hotkeyPermissionsMode";

function translate(key: string, values?: Record<string, number | string>) {
  switch (key) {
    case "app.chat.composePlaceholder":
      return "Ask Codex";
    case "app.chat.removeQueuedFollowUp":
      return "Remove";
    case "app.chat.send":
      return "Send";
    case "app.chat.stop":
      return "Stop";
    case "commentAttachments.numAnnotations":
      return values?.count === 1 ? "1 annotation" : `${values?.count ?? 0} annotations`;
    case "general.enterBehaviorDescription":
      return `Use ${values?.modifierSymbol ?? "Cmd"}+Enter`;
    case "composer.permissionsDropdown.default.label":
      return "Default permissions";
    case "composer.permissionsDropdown.default.optionLabel":
      return "Default permissions";
    case "composer.permissionsDropdown.default.tooltip":
      return "Codex automatically runs commands in a sandbox";
    case "composer.mode.agentMode.guardianApprovals":
      return "Auto-review";
    case "composer.permissionsDropdown.guardianApproval.shortLabel":
      return "Auto-review";
    case "composer.permissionsDropdown.guardianApproval.tooltip":
      return "Auto-review tooltip";
    case "composer.permissionsDropdown.guardianApproval.disabled":
      return "Auto-review disabled";
    case "composer.permissionsDropdown.fullAccess.label":
      return "Full access";
    case "composer.permissionsDropdown.fullAccess.optionLabel":
      return "Full access";
    case "composer.permissionsDropdown.agentMode.tooltip.fullAccess":
      return "Full access tooltip";
    case "composer.permissionsDropdown.fullAccess.disabled":
      return "Full access disabled";
    case "composer.permissionsDropdown.fullAccess.disabledGlobalDefault":
      return "Full access disabled globally";
    case "composer.permissionsDropdown.custom.label":
      return "Custom";
    case "composer.permissionsDropdown.custom.optionLabel":
      return "Custom (config.toml)";
    case "composer.permissionsDropdown.agentMode.tooltip.custom":
      return "Custom permissions tooltip";
    case "composer.permissionsDropdown.disabled.requirements":
      return "Permissions locked";
    case "composer.permissionsDropdown.trigger.tooltip":
      return "Change permissions";
    case "composer.mode.agentMode.fullAccessConfirm.title":
      return "Enable full access?";
    case "composer.mode.agentMode.fullAccessConfirm.description":
      return "Description";
    case "composer.mode.agentMode.fullAccessConfirm.caution":
      return "Caution";
    case "composer.mode.agentMode.fullAccessConfirm.goBack":
      return "Cancel";
    case "composer.mode.agentMode.fullAccessConfirm.confirm":
      return "Yes, continue anyway";
    case "settings.general.followUpQueueMode.queue":
      return "Queue";
    case "settings.general.followUpQueueMode.interrupt":
      return "Interrupt";
    case "settings.general.reviewDelivery.inline":
      return "Inline";
    case "settings.general.reviewDelivery.detached":
      return "Detached";
    case "composer.mode.local":
      return "Work locally";
    case "composer.mode.worktree":
      return "New worktree";
    case "settings.automations.executionEnvironment.worktree":
      return "Worktree";
    case "settings.automations.executionEnvironment.local":
      return "Local";
    case "thread.sidePanel.openFile":
      return "Open file";
    case "codex.review.noDiff.gitInit.createRepository":
      return "Create git repository";
    case "codex.review.noDiff.gitInit.creating":
      return "Creating…";
    case "codex.review.noDiff.gitInit.error":
      return `Git init failed: ${values?.message ?? ""}`;
    case "codex.review.noDiff.gitInit.success":
      return "Git repository created";
    case "composer.contextWindowUsageLabel":
      return "Context window:";
    case "composer.contextWindowUsageStatusFull":
      return `${values?.usage ?? 0}% full`;
    case "composer.contextWindowUsageStatusLeft":
      return `${values?.usage ?? 0}% used (${values?.remaining ?? 0}% left)`;
    case "composer.contextWindowUsageTooltip":
      return `${values?.usedTokens ?? 0}k / ${values?.contextWindow ?? 0}k tokens used`;
    case "composer.contextWindow.usagePercent":
      return `${values?.usage ?? 0}%`;
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
    default:
      return key;
  }
}

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

function renderComposer(pendingPdfCommentCount: number) {
  return renderToStaticMarkup(
    <ThreadComposer
      composerDraft=""
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={permissionsState}
      followUpQueueMode="queue"
      isWorktreeThread={false}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={pendingPdfCommentCount}
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      turnError={null}
    />,
  );
}

test("ThreadComposer keeps send enabled for comment-only pending PDF annotations", () => {
  const markup = renderComposer(1);

  assert.ok(markup.includes("1 annotation"));
  assert.ok(!markup.includes('disabled=""'));
});

test("ThreadComposer disables send when both draft and pending PDF annotations are empty", () => {
  const markup = renderComposer(0);

  assert.ok(markup.includes('disabled=""'));
});

test("ThreadComposer renders pending PDF annotations in the upper attachment strip", () => {
  const markup = renderComposer(1);
  const annotationIndex = markup.indexOf("1 annotation");
  const placeholderIndex = markup.indexOf("Ask Codex");

  assert.notEqual(annotationIndex, -1);
  assert.notEqual(placeholderIndex, -1);
  assert.ok(annotationIndex < placeholderIndex);
});

test("ThreadComposer keeps permissions and footer status text without replica-only status chips", () => {
  const markup = renderComposer(0);
  const permissionsIndex = markup.indexOf("Default permissions");
  const triggerTooltipIndex = markup.indexOf("Change permissions");
  const queueIndex = markup.indexOf("Queue");
  const inlineIndex = markup.indexOf("Inline");
  const legacyTriggerTitleIndex = markup.indexOf('title="Change permissions"');
  const workspaceIndex = markup.indexOf(">workspace<");
  const footerTextClassIndex = markup.indexOf("app-text-subtle min-h-[20px]");

  assert.notEqual(permissionsIndex, -1);
  assert.notEqual(triggerTooltipIndex, -1);
  assert.equal(legacyTriggerTitleIndex, -1);
  assert.equal(queueIndex, -1);
  assert.equal(inlineIndex, -1);
  assert.equal(workspaceIndex, -1);
  assert.notEqual(footerTextClassIndex, -1);
  assert.ok(markup.includes("group-hover:block"));
});

test("ThreadComposer keeps disabled guardian and full-access permission items visible with source-backed tooltips", () => {
  const options = buildThreadComposerPermissionOptions({
    composerPermissionsState: {
      ...permissionsState,
      availableAgentModes: ["read-only", "auto", "granular"],
      canShowFullAccess: false,
      canShowGuardian: false,
      fullAccessDisabledReason: "requirements",
    },
    t: translate,
  });

  assert.deepEqual(
    options.map((option) => ({
      disabled: option.disabled,
      label: option.label,
      tooltip: option.tooltip,
      value: option.value,
    })),
    [
      {
        disabled: false,
        label: "Default permissions",
        tooltip: "Codex automatically runs commands in a sandbox",
        value: "default",
      },
      {
        disabled: true,
        label: "Auto-review",
        tooltip: "Auto-review disabled",
        value: "guardian-approvals",
      },
      {
        disabled: true,
        label: "Full access",
        tooltip: "Full access disabled",
        value: "full-access",
      },
      {
        disabled: false,
        label: "Custom (config.toml)",
        tooltip: "Custom permissions tooltip",
        value: "custom",
      },
    ],
  );
});

test("ThreadComposer uses the locked tooltip on the disabled permissions trigger", () => {
  const markup = renderToStaticMarkup(
    <ThreadComposer
      composerDraft=""
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={{
        ...permissionsState,
        availableAgentModes: ["read-only", "auto", "granular"],
        canShowCustom: false,
        canShowFullAccess: false,
        canShowGuardian: false,
        fullAccessDisabledReason: "global-default",
        isDropdownDisabled: true,
        showFullAccessOption: false,
        showGuardianOption: false,
      }}
      followUpQueueMode="queue"
      isWorktreeThread={false}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={0}
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      turnError={null}
    />,
  );

  assert.ok(markup.includes("Permissions locked"));
  assert.equal(markup.includes(">Change permissions<"), false);
});

test("ThreadComposer suppresses workspace status chip for side placement", () => {
  const markup = renderToStaticMarkup(
    <ThreadComposer
      composerDraft=""
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={permissionsState}
      followUpQueueMode="queue"
      isWorktreeThread={false}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={0}
      placement="side"
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      turnError={null}
    />,
  );

  assert.ok(markup.includes("Default permissions"));
  assert.ok(!markup.includes(">workspace<"));
  assert.ok(!markup.includes("Queue"));
  assert.ok(!markup.includes("Inline"));
});

test("ThreadComposer renders create-git-repository footer control when no git root exists", () => {
  const markup = renderToStaticMarkup(
    <ThreadComposer
      composerDraft=""
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={permissionsState}
      followUpQueueMode="queue"
      isWorktreeThread={false}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={0}
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      threadGitRoot={null}
      turnError={null}
    />,
  );

  assert.ok(markup.includes("Create git repository"));
});

test("ThreadComposer renders context window usage footer control from latest token usage info", () => {
  const markup = renderToStaticMarkup(
    <ThreadComposer
      composerDraft=""
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={permissionsState}
      followUpQueueMode="queue"
      isWorktreeThread={false}
      authMethod="chatgpt"
      latestTokenUsageInfo={{
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
      }}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={0}
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      turnError={null}
    />,
  );

  assert.ok(markup.includes("Context window: 72% full"));
  assert.ok(markup.includes("92k / 128k tokens used"));
  assert.ok(markup.includes("Codex automatically compacts its context"));
  assert.ok(markup.includes("app-thread-composer-footer-meter-button"));
  assert.ok(markup.includes("flex w-38 flex-col gap-0.5 text-center"));
  assert.ok(!markup.includes('title="Context window: 72% full'));
  assert.ok(!markup.includes(">72%<"));
});

test("ThreadComposer uses compact submit button shell and keeps the visible permissions trigger label branch without extra aria text", () => {
  const markup = renderComposer(0);

  assert.ok(markup.includes("app-thread-composer-submit-button"));
  assert.ok(!markup.includes('aria-label="Change permissions"'));
});

test("ThreadComposer keeps official follow-up submit tooltip options when a response is still in progress", () => {
  const markup = renderToStaticMarkup(
    <ThreadComposer
      composerDraft="Follow up on the failing test"
      composerEnterBehavior="enter"
      composerPermissionConfig={null}
      composerPermissionMode="auto"
      composerPermissionsState={permissionsState}
      followUpQueueMode="queue"
      isResponseInProgress
      isWorktreeThread={false}
      onClearPendingPdfComments={() => undefined}
      onComposerDraftChange={() => undefined}
      onComposerPermissionModeChange={() => undefined}
      onStopTurn={() => undefined}
      onSubmitTurn={() => undefined}
      pendingPdfCommentCount={0}
      queuedFollowUpCount={0}
      reviewDelivery="inline"
      submitButtonMode="send"
      t={translate}
      threadBranchLabel={null}
      threadCwd="D:\\workspace"
      turnError={null}
    />,
  );

  assert.ok(markup.includes("Queue"));
  assert.ok(markup.includes("Interrupt"));
  assert.ok(markup.includes('aria-label="Send"'));
  assert.ok(!markup.includes('title="Send"'));
});

test("parseSideChatCommandDraft parses official side-chat slash command shape", () => {
  assert.equal(parseSideChatCommandDraft("/side"), "");
  assert.equal(parseSideChatCommandDraft(" /side   "), "");
  assert.equal(parseSideChatCommandDraft("/side investigate this bug"), "investigate this bug");
  assert.equal(parseSideChatCommandDraft("  /side   compare rust app parity  "), "compare rust app parity");
  assert.equal(parseSideChatCommandDraft("/side\nfollow up"), "follow up");
  assert.equal(parseSideChatCommandDraft("/sider"), null);
  assert.equal(parseSideChatCommandDraft("hello /side"), null);
});
