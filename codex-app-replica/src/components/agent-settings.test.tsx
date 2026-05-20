/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/AgentSettings.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const MESSAGES_SOURCE_PATH = path.join(process.cwd(), "src/i18n/messages.ts");
const REMOTE_RUNTIME_SOURCE_PATH = path.join(
  process.cwd(),
  "src-tauri/src/remote_app_server_runtime.rs",
);

test("agent settings keeps extracted page shell and section order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout[\s\S]*title=\{<SettingsSectionTitle slug="agent" \/>\}/);
  assert.match(
    source,
    /renderInlineLinkMessage\(\s*t\("settings\.agent\.configuration\.subtitle\.summary"\),\s*AGENT_SETTINGS_DOCS_URL,\s*"inline-flex text-token-text-link-foreground",\s*\)/s,
  );
  assert.match(source, /<SettingsGroup\.Header title=\{t\("settings\.agent\.customConfig\.sectionTitle"\)\} \/>/);

  const noticesIndex = source.indexOf("{notices.map((notice, index) => (");
  const configSectionIndex = source.indexOf("<ConfigSettingsSection");
  const configTomlRowIndex = source.indexOf('label={t("settings.agent.configuration.configToml")}');
  const openSourceRowIndex = source.indexOf('label={t("settings.openSourceLicenses.rowLabel")}');
  const experimentalIndex = source.indexOf("<AgentExperimentalFeaturesSettings");
  const workspaceDepsIndex = source.indexOf("<WorkspaceDependenciesSettings");

  assert.ok(noticesIndex >= 0);
  assert.ok(configSectionIndex > noticesIndex);
  assert.ok(configTomlRowIndex > configSectionIndex);
  assert.ok(openSourceRowIndex > configTomlRowIndex);
  assert.ok(experimentalIndex > openSourceRowIndex);
  assert.ok(workspaceDepsIndex > experimentalIndex);
});

test("agent settings keeps extracted notice markdown and config toml open behavior", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<MarkdownPreview className="\[&>p\]:my-0" cwd=\{null\} hostId=\{hostId\} text=\{notice\.summary\} \/>/);
  assert.match(source, /<MarkdownPreview className="\[&>p\]:my-0" cwd=\{null\} hostId=\{hostId\} text=\{notice\.details\} \/>/);
  assert.match(source, /line: notice\.range\.start\.line/);
  assert.match(source, /column: notice\.range\.start\.column/);
  assert.doesNotMatch(source, /range: notice\.range/);

  assert.match(source, /readOpenInTargets\(\{\s*cwd: null,\s*hostId,\s*\}\)\.catch\(\(\) => null\)/s);
  assert.ok(source.includes("setPreferredConfigTomlOpenTarget(openTargetsResponse?.preferredTarget ?? null);"));
  assert.match(source, /target: preferredConfigTomlOpenTarget,/);
  assert.match(source, /t\("settings\.agent\.openConfigTomlWsl"\)/);
});

test("agent settings route stays owned by AgentSettings component and remote notices use public helper", () => {
  const appSource = readSource(APP_SOURCE_PATH);
  const runtimeSource = readSource(REMOTE_RUNTIME_SOURCE_PATH);

  assert.match(appSource, /if \(settingsSection === "agent"\) \{/);
  assert.match(
    appSource,
    /<AgentSettings[\s\S]*hostId=\{selectedSettingsHostId\}[\s\S]*settingsCwd=\{settingsCwd\}[\s\S]*settingsWorkspaceRoot=\{settingsWorkspaceRoot\}/,
  );

  assert.match(runtimeSource, /push_agent_settings_notice/);
  assert.match(
    runtimeSource,
    /push_agent_settings_notice\(\s*app,\s*auth_state\.inner\(\),\s*host_id,\s*AgentSettingsNotice \{/s,
  );
  assert.doesNotMatch(runtimeSource, /auth_state\.agent_settings_notices\.lock\(\)/);
});

test("agent settings messages include extracted config toml keys", () => {
  const source = readSource(MESSAGES_SOURCE_PATH);

  assert.match(source, /"settings\.agent\.customConfig\.sectionTitle"/);
  assert.match(source, /"settings\.agent\.openConfigTomlWsl"/);
  assert.match(source, /"settings\.agent\.openConfigToml": "Open config\.toml"/);
  assert.match(source, /"settings\.agent\.openConfigTomlWsl": "Open config\.toml in WSL environment"/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
