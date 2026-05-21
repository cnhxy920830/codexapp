/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SOURCE_PATH = path.join(process.cwd(), "src/components/GitSettings.tsx");

test("git settings uses extracted settings shell and page-owned section order", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /SettingsContentLayout title=\{<SettingsSectionTitle slug="git-settings" \/>\}/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Content>\s*<SettingsSurface>/s);

  const mainGroupIndex = source.indexOf("<SettingsSurface>");
  const commitGroupIndex = source.indexOf('title={t("settings.git.commitInstructions.label")}');
  const prGroupIndex = source.indexOf('title={t("settings.git.prInstructions.label")}');
  assert.ok(mainGroupIndex >= 0);
  assert.ok(commitGroupIndex > mainGroupIndex);
  assert.ok(prGroupIndex > commitGroupIndex);
});

test("git settings keeps extracted main surface row order and segmented merge method control", () => {
  const source = readSource(SOURCE_PATH);

  const branchIndex = source.indexOf('label={t("settings.git.branchPrefix.label")}');
  const mergeIndex = source.indexOf('label={t("settings.git.pullRequestMergeMethod.label")}');
  const sidebarIndex = source.indexOf('label={t("settings.git.showSidebarPrIcons.label")}');
  const forcePushIndex = source.indexOf('label={t("settings.git.forcePush.label")}');
  const draftPrIndex = source.indexOf('label={t("settings.git.createDraftPullRequest.label")}');
  const autoCleanupIndex = source.indexOf('label={t("settings.worktrees.autoCleanup.label")}');
  const keepCountIndex = source.indexOf('label={t("settings.worktrees.keepCount.label")}');

  assert.ok(branchIndex >= 0);
  assert.ok(mergeIndex > branchIndex);
  assert.ok(sidebarIndex > mergeIndex);
  assert.ok(forcePushIndex > sidebarIndex);
  assert.ok(draftPrIndex > forcePushIndex);
  assert.ok(autoCleanupIndex > draftPrIndex);
  assert.ok(keepCountIndex > autoCleanupIndex);

  assert.match(source, /import \{ SegmentedControl \} from "\.\/SegmentedControl";/);
  assert.match(source, /<SegmentedControl/);
  assert.doesNotMatch(source, /<select/);
});

test("git settings keeps extracted gate conditions, worktree nesting, and save hotkey scope", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /showPullRequestMergeMethod && !hideSidebarPrIconsSetting/);
  assert.match(source, /<DesktopOnly>/);
  assert.doesNotMatch(source, /className="electron:block hidden"/);
  assert.match(source, /import \{ useHotkey \} from "\.\.\/hooks\/useHotkey";/);
  assert.match(source, /useHotkey\(\{\s*accelerator: "CmdOrCtrl\+S",\s*enabled: canSaveWithHotkey,\s*onKeyDown: saveWithHotkey,\s*\}\);/s);
  assert.match(source, /const canSaveWithHotkey =\s*\(isBranchPrefixDirty && !isBranchPrefixDisabled\) \|\|/s);
  assert.match(source, /saveBranchPrefixIfDirty\(\),\s*saveCommitInstructionsIfDirty\(\),\s*savePullRequestInstructionsIfDirty\(\)/s);
  assert.doesNotMatch(source, /window\.addEventListener\("keydown"/);
});

test("git settings keeps extracted global-state subscription ownership for git and worktree keys", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /import \{ onGlobalStateUpdated \} from "\.\.\/services\/settings";/);
  assert.match(source, /void onGlobalStateUpdated\(\(notification\) => \{/);
  assert.match(source, /notification\.keys\.includes\("git-branch-prefix"\)/);
  assert.match(source, /notification\.keys\.includes\("git-always-force-push"\)/);
  assert.match(source, /notification\.keys\.includes\("git-create-pull-request-as-draft"\)/);
  assert.match(source, /notification\.keys\.includes\("git-pull-request-merge-method"\)/);
  assert.match(source, /notification\.keys\.includes\("git-show-sidebar-pr-icons"\)/);
  assert.match(source, /notification\.keys\.includes\("git-commit-instructions"\)/);
  assert.match(source, /notification\.keys\.includes\("git-pr-instructions"\)/);
  assert.match(source, /notification\.keys\.includes\("worktree-auto-cleanup-enabled"\)/);
  assert.match(source, /notification\.keys\.includes\("worktree-keep-count"\)/);
  assert.match(source, /void reloadGitSettings\(\);/);
  assert.match(source, /void reloadWorktreeSettings\(\);/);
});

test("git settings keeps extracted instruction header actions and auto-cleanup confirm dialog", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /<SettingsGroup\.Header\s+title=\{t\("settings\.git\.commitInstructions\.label"\)\}\s+subtitle=\{t\("settings\.git\.commitInstructions\.description"\)\}\s+actions=/s);
  assert.match(source, /<SettingsGroup\.Header\s+title=\{t\("settings\.git\.prInstructions\.label"\)\}\s+subtitle=\{t\("settings\.git\.prInstructions\.description"\)\}\s+actions=/s);
  assert.match(source, /color="secondary"/);
  assert.match(source, /loading=\{saving\.commitInstructions\}/);
  assert.match(source, /loading=\{saving\.pullRequestInstructions\}/);

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /settings\.worktrees\.autoCleanup\.confirm\.title/);
  assert.match(source, /settings\.worktrees\.autoCleanup\.confirm\.body/);
  assert.match(source, /settings\.worktrees\.autoCleanup\.confirm\.cancel/);
  assert.match(source, /settings\.worktrees\.autoCleanup\.confirm\.confirm/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /aria-describedby=\{descriptionId\}/);
  assert.match(source, /rounded-3xl border border-token-border bg-token-dropdown-background\/90/);
  assert.match(source, /<Button color="ghost" size="toolbar" onClick=\{\(\) => onOpenChange\(false\)\}>/);
  assert.match(source, /<Button color="danger" size="toolbar" onClick=\{onConfirm\}>/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
