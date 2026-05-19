/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/LocalEnvironmentsSettings.tsx",
);

test("local environments page keeps extracted select, preview, and editor owner split", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /<WorkspaceSelectionCard/);
  assert.match(source, /<LocalEnvironmentPreview/);
  assert.match(source, /<LocalEnvironmentEditor/);
  assert.match(source, /title=\{<SettingsSectionTitle slug="local-environments" \/>\}/);
  assert.match(source, /renderLearnMoreDescription\(t\("settings\.localEnvironments\.workspaceSelect\.description"\)\)/);
});

test("workspace selection cards keep extracted add button and inherited accordion affordance", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /aria-label=\{t\("settings\.localEnvironments\.workspaceSelect\.addLabel"\)\}/);
  assert.match(source, /className="w-9 justify-center"/);
  assert.match(source, /<PlusIcon className="icon-xs" \/>/);
  assert.match(source, /settings\.localEnvironments\.workspaceSelect\.inherited/);
  assert.match(source, /isExpanded \? "rotate-180" : ""/);
  assert.doesNotMatch(source, /selectedWorkspaceRoot=/);
});

test("preview keeps extracted group order, variables popover, and summary rows", () => {
  const source = readSource(SOURCE_PATH);

  const projectGroupIndex = source.indexOf('title={t("settings.localEnvironments.workspace.title")}');
  const environmentGroupIndex = source.indexOf('title={t("settings.localEnvironments.environment.title")}');
  assert.ok(projectGroupIndex >= 0);
  assert.ok(environmentGroupIndex > projectGroupIndex);

  assert.match(source, /<ProjectSummaryCard workspaceGroup=\{workspaceGroup\} workspaceRoot=\{workspaceRoot\} \/>/);
  assert.match(source, /<LocalEnvironmentSettingsRow/);
  assert.match(source, /<SetupEnvVarsPopover \/>/);
  assert.match(source, /CODEX_SOURCE_PATH/);
  assert.match(source, /CODEX_WORKTREE_PATH/);
  assert.match(source, /<ActionSummaryRow key=\{`\$\{action\.name\}-\$\{index\}`\} action=\{action\} \/>/);
});

test("editor keeps extracted segmented controls, action platform checkbox, and save affordance", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /<SegmentedControl/);
  assert.match(source, /buildScriptPlatformOptions\(t\)/);
  assert.match(source, /buildPlatformOptions\(t\)/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /settings\.localEnvironments\.actions\.item\.platforms\.specific/);
  assert.match(source, /title=\{saveDisabledReason \?\? undefined\}/);
  assert.match(source, /loading=\{isSaving\}/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
