/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/AgentSettings.tsx");
const EXPERIMENTAL_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/AgentExperimentalFeaturesSettings.tsx",
);
const WORKSPACE_DEPENDENCIES_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/WorkspaceDependenciesSettings.tsx",
);
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

test("agent settings reuses shared dropdown owner for config scope and config controls", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const sharedMenuSource = readSource(path.join(process.cwd(), "src/components/SettingsChoiceMenu.tsx"));

  assert.match(source, /import \{ SettingsChoiceMenu \} from "\.\/SettingsChoiceMenu";/);
  assert.match(source, /<SettingsChoiceMenu[\s\S]*className="w-\[240px\]"/);
  assert.match(source, /menuClassName="w-\[240px\]"/);
  assert.match(source, /sections=\{menuSections\}/);
  assert.match(source, /triggerLabel=\{selectedScope\?\.label \?\? t\("settings\.agent\.configuration\.scope\.loading"\)\}/);
  assert.match(source, /<SettingsChoiceMenu[\s\S]*options=\{options\}[\s\S]*value=\{value\}/s);
  assert.doesNotMatch(source, /function ScopeMenuItem\(/);
  assert.doesNotMatch(source, /const \[isOpen, setIsOpen\] = useState\(false\);[\s\S]*document\.addEventListener\("pointerdown", handlePointerDown\);/s);

  assert.match(sharedMenuSource, /type SettingsChoiceMenuSection = \{/);
  assert.match(sharedMenuSource, /sections\?: SettingsChoiceMenuSection\[];/);
  assert.match(sharedMenuSource, /menuSections\.map\(\(section, sectionIndex\) => \{/);
  assert.match(sharedMenuSource, /text-\[11px\] font-medium uppercase tracking-\[0\.08em\]/);
  assert.match(sharedMenuSource, /className="my-2 h-px bg-token-border"/);
  assert.match(sharedMenuSource, /aria-haspopup="menu"/);
  assert.match(sharedMenuSource, /role="menu"/);
  assert.match(sharedMenuSource, /role="menuitem"/);
});

test("agent settings keeps extracted notice markdown and config open behavior", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<MarkdownPreview className="\[&>p\]:my-0" cwd=\{null\} hostId=\{hostId\} text=\{notice\.summary\} \/>/);
  assert.match(source, /<MarkdownPreview className="\[&>p\]:my-0" cwd=\{null\} hostId=\{hostId\} text=\{notice\.details\} \/>/);
  assert.match(source, /line: notice\.range\.start\.line/);
  assert.match(source, /column: notice\.range\.start\.column/);
  assert.doesNotMatch(source, /range: notice\.range/);

  assert.match(
    source,
    /readConfigForHost\(\{\s*hostId,\s*cwd: isLocalHost \? settingsWorkspaceRoot : null,\s*includeLayers: true,\s*\}\)/s,
  );
  assert.match(source, /readWslBashAvailability\(\)/);
  assert.match(
    source,
    /const configTomlButtonLabel =\s*runCodexInWsl && isWindows && hasWsl\s*\?\s*t\("settings\.agent\.openConfigTomlWsl"\)\s*:\s*t\("settings\.agent\.openConfigToml"\);/s,
  );
  assert.match(source, /readOpenInTargets\(\{\s*cwd: null,\s*hostId,\s*\}\)\.catch\(\(\) => null\)/s);
  assert.match(source, /target: openTargetsResponse\?\.preferredTarget \?\? null,/);
  assert.match(
    source,
    /const preferredTargetCwd = selectedScope\.workspaceRoot \?\? \(isLocalHost \? settingsWorkspaceRoot : null\);/,
  );
  assert.match(source, /cwd: selectedScope\.workspaceRoot \?\? null,/);
  assert.doesNotMatch(source, /preferredOpenTarget/);
  assert.doesNotMatch(source, /preferredConfigTomlOpenTarget/);
});

test("agent settings child sections reuse extracted shared settings owners", () => {
  const experimentalSource = readSource(EXPERIMENTAL_SOURCE_PATH);
  const workspaceDependenciesSource = readSource(WORKSPACE_DEPENDENCIES_SOURCE_PATH);

  assert.match(experimentalSource, /import \{ SettingsGroup \} from "\.\/SettingsGroup";/);
  assert.match(experimentalSource, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(experimentalSource, /import \{ SettingsSurface \} from "\.\/SettingsSurface";/);
  assert.match(experimentalSource, /<SettingsGroup\.Header/);
  assert.match(experimentalSource, /<SettingsSurface>/);
  assert.match(experimentalSource, /<SettingsRow/);
  assert.match(experimentalSource, /window\.addEventListener\("focus", handleFocus\)/);
  assert.doesNotMatch(experimentalSource, /app-card rounded-\[18px\]/);

  assert.match(workspaceDependenciesSource, /import \{ SettingsGroup \} from "\.\/SettingsGroup";/);
  assert.match(workspaceDependenciesSource, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(workspaceDependenciesSource, /import \{ SettingsSurface \} from "\.\/SettingsSurface";/);
  assert.match(workspaceDependenciesSource, /<SettingsGroup\.Header/);
  assert.match(workspaceDependenciesSource, /<SettingsSurface>/);
  assert.match(workspaceDependenciesSource, /<SettingsRow/);
  assert.match(workspaceDependenciesSource, /window\.addEventListener\("focus", handleFocus\)/);
  assert.doesNotMatch(workspaceDependenciesSource, /function SettingsGroup\(/);
  assert.doesNotMatch(workspaceDependenciesSource, /function SettingsRow\(/);
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
