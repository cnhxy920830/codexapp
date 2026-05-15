/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILTIN_AVATARS } from "../../components/appearance/avatarData";
import { ThreadComposer } from "./ThreadComposer";
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
    case "composer.mode.agentMode.guardianApprovals":
      return "Auto-review";
    case "composer.permissionsDropdown.guardianApproval.shortLabel":
      return "Auto-review";
    case "composer.permissionsDropdown.fullAccess.label":
      return "Full access";
    case "composer.permissionsDropdown.fullAccess.optionLabel":
      return "Full access";
    case "composer.permissionsDropdown.custom.label":
      return "Custom";
    case "composer.permissionsDropdown.custom.optionLabel":
      return "Custom (config.toml)";
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
  initialAgentMode: "auto",
  isDropdownDisabled: false,
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
      selectedAvatar={BUILTIN_AVATARS[0]}
      submitButtonMode="send"
      t={translate}
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
