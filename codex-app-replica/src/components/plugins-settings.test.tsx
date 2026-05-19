/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SETTINGS_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/PluginsSettings.tsx",
);
const OWNER_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/skills/PluginsPage.tsx",
);
const APP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/App.tsx",
);

test("plugins settings keeps extracted thin wrapper ownership", () => {
  const source = readSource(SETTINGS_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout>\s*<PluginsPage/s);
  assert.match(source, /connectedRemoteConnections=\{connectedRemoteConnections\}/);
  assert.match(source, /onSelectHost=\{onSelectHost\}/);
  assert.match(source, /remoteConnectionHostIds=\{remoteConnectionHostIds\}/);
  assert.doesNotMatch(source, /ManageTabButton/);
  assert.doesNotMatch(source, /LoadErrorPanel/);
  assert.doesNotMatch(source, /PluginsAppToolsDialog/);
});

test("app routes settings plugins page through shared owner inputs", () => {
  const source = readSource(APP_SOURCE_PATH);

  const pluginsSettingsIndex = source.indexOf("<PluginsSettings");
  assert.ok(pluginsSettingsIndex >= 0);
  assert.match(source, /connectedRemoteConnections=\{connectedSettingsRemoteConnections\}/);
  assert.match(source, /onSelectHost=\{setSelectedSettingsHostId\}/);
  assert.match(source, /remoteConnectionHostIds=\{settingsRemoteConnectionHostIds\}/);
  assert.match(source, /onOpenChatWithPrompt=\{\(\{ cwd, prompt \}\) =>/);
  assert.match(source, /openNewConversation\(\{\s*cwd,\s*focusComposerNonce: Date\.now\(\),\s*prefillPrompt: prompt,/s);
});

test("plugins page owner keeps settings manage controls and host selection", () => {
  const source = readSource(OWNER_SOURCE_PATH);

  assert.match(source, /skills\.appsPage\.managePlugins/);
  assert.match(source, /skills\.appsPage\.breadcrumb\.root/);
  assert.match(source, /skills\.appsPage\.breadcrumb\.manage/);
  assert.match(source, /skills\.appsPage\.createPlugin/);
  assert.match(source, /skills\.appsPage\.createSkill/);
  assert.match(source, /skills\.appsPage\.actionsMenu/);
  assert.match(source, /skills\.appsPage\.search\.plugins/);
  assert.match(source, /skills\.appsPage\.search\.plugins\.label/);
  assert.match(source, /<SettingsHostDropdown/);
  assert.match(source, /<ToolbarMenu/);
  assert.match(source, /skills\.appsPage\.pluginsUnsupportedHost\.title/);
  assert.match(source, /<ManageTabButton/);
  assert.match(source, /skills\.appsPage\.manageTab\.plugins/);
  assert.match(source, /skills\.appsPage\.manageTab\.apps/);
  assert.match(source, /skills\.appsPage\.manageTab\.mcps/);
  assert.match(source, /skills\.appsPage\.manageTab\.skills/);
  assert.match(source, /skills\.appsPage\.manageTab\.marketplace/);
  assert.match(source, /cwd: effectiveWorkspaceRoot && effectiveWorkspaceRoot !== "\/" \? effectiveWorkspaceRoot : null/);
  assert.match(source, /prompt: `\[@\$\{app\.name\}\]\(app:\/\/\$\{app\.id\}\)`/);
  assert.match(source, /onOpenChatWithPrompt\?\.\(\{\s*cwd:\s*effectiveWorkspaceRoot && effectiveWorkspaceRoot !== "\/" \? effectiveWorkspaceRoot : null,\s*prompt:\s*`/s);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
