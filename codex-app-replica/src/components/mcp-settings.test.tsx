/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/McpSettings.tsx");
const MESSAGES_SOURCE_PATH = path.join(process.cwd(), "src/i18n/messages.ts");

test("mcp settings keeps extracted shared shell ownership for the list page", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /import \{ Button \} from "\.\/Button";/);
  assert.match(source, /import \{ SettingsContentLayout \} from "\.\/SettingsContentLayout";/);
  assert.match(source, /import \{ SettingsGroup \} from "\.\/SettingsGroup";/);
  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /import \{ SettingsSectionTitle \} from "\.\/SettingsSectionTitle";/);
  assert.match(source, /import \{ SettingsSurface \} from "\.\/SettingsSurface";/);
  assert.match(source, /title=\{<SettingsSectionTitle slug="mcp-settings" \/>\}/);
  assert.match(source, /subtitle=\{<McpSectionSubtitle \/>\}/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header/s);
  assert.match(source, /<Button color="ghost" size="toolbar" onClick=\{\(\) => void restartAppServer\(\)\}>/);
  assert.match(source, /<RefreshIcon className="icon-xs" \/>/);
  assert.match(source, /<AddServerButton onClick=\{openEditorForNewServer\} \/>/);

  const loadingIndex = source.indexOf('label={t("settings.mcp.loading")}');
  const emptyIndex = source.indexOf('label={t("settings.mcp.empty")}');
  const rowIndex = source.indexOf("<McpServerRow");
  assert.ok(loadingIndex >= 0);
  assert.ok(emptyIndex > loadingIndex);
  assert.ok(rowIndex > emptyIndex);
});

test("mcp settings keeps extracted shared button shell for row controls and detail editor", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<Button color="outline" disabled=\{isSaving\} size="toolbar" onClick=\{\(\) => void onAuthenticate\(server\.name\)\}>/);
  assert.match(source, /<Button[\s\S]*aria-label=\{t\("settings\.mcp\.server\.settings"\)\}[\s\S]*color="ghost"[\s\S]*uniform/s);
  assert.match(source, /<Button color="danger" disabled=\{isSaving\} size="toolbar" onClick=\{onDelete\}>/);
  assert.match(source, /<Button color="ghost" size="toolbar" onClick=\{onBack\}>/);
  assert.match(source, /<Button color="primary" disabled=\{isSaving \|\| !canSave\} size="toolbar" onClick=\{onSave\}>/);
  assert.match(source, /<Button color="secondary" size="toolbar" onClick=\{\(\) => onChange\(\[\.\.\.values, ""\]\)\}>/);
  assert.match(source, /<Button color="secondary" size="toolbar" onClick=\{\(\) => onChange\(\[\.\.\.values, \{ key: "", value: "" \}\]\)\}>/);
  assert.match(source, /<Button[\s\S]*aria-label=\{t\("settings\.editRow\.removeEntry"\)\}[\s\S]*size="icon"[\s\S]*uniform/s);

  assert.doesNotMatch(source, /function SettingsContentLayout\(/);
  assert.doesNotMatch(source, /function SettingsGroup\(/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
  assert.doesNotMatch(source, /function ToolbarButton\(/);
  assert.doesNotMatch(source, /function IconToolbarButton\(/);
  assert.doesNotMatch(source, /function renderMcpSectionSubtitle\(/);
});

test("mcp settings subtitle messages are split into extracted text and learn-more keys", () => {
  const source = readSource(MESSAGES_SOURCE_PATH);

  assert.match(source, /"settings\.section\.mcp-settings\.subtitle": "Connect external tools and data sources\. "/);
  assert.match(source, /"settings\.section\.mcp-settings\.learnMore": "Learn more\."/);
  assert.match(source, /"settings\.section\.mcp-settings\.subtitle": "连接外部工具和数据源。"/);
  assert.match(source, /"settings\.section\.mcp-settings\.learnMore": "了解更多。"/);
  assert.doesNotMatch(source, /"settings\.section\.mcp-settings\.subtitle": ".*<a>.*<\/a>"/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
