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
  assert.match(source, /import \{ ControlGroup \} from "\.\/ControlGroup";/);
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
  assert.match(source, /<ControlGroup>/);

  const loadingIndex = source.indexOf('label={t("settings.mcp.loading")}');
  const emptyIndex = source.indexOf('label={t("settings.mcp.empty")}');
  const rowIndex = source.indexOf("<McpServerRow");
  assert.equal(loadingIndex, -1);
  assert.ok(emptyIndex >= 0);
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
  assert.match(source, /import \{ ArrowLeftIcon, LinkExternalIcon, PlusIcon, RefreshIcon, SettingsCogIcon, TrashIcon \} from "\.\/AppShellIcons";/);
  assert.match(source, /import \{ LoadingPage \} from "\.\/LoadingPage";/);
  assert.match(source, /<LinkExternalIcon className="icon-xxs" \/>/);
  assert.match(source, /<LoadingPage overlay \/>/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Content>/s);
  assert.match(source, /className="relative"/);
  assert.match(source, /className="bg-token-surface-secondary border-token-border flex items-center rounded-lg border"/);
  assert.doesNotMatch(source, /settings\.mcp\.detail\.transport\.label/);

  assert.doesNotMatch(source, /function SettingsContentLayout\(/);
  assert.doesNotMatch(source, /function SettingsGroup\(/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
  assert.doesNotMatch(source, /function ToolbarButton\(/);
  assert.doesNotMatch(source, /function IconToolbarButton\(/);
  assert.doesNotMatch(source, /function renderMcpSectionSubtitle\(/);
  assert.doesNotMatch(source, /function ArrowLeftIcon\(/);
});

test("mcp settings subtitle messages are split into extracted text and learn-more keys", () => {
  const source = readSource(MESSAGES_SOURCE_PATH);

  assert.match(source, /"settings\.section\.mcp-settings\.subtitle": "Connect external tools and data sources\. "/);
  assert.match(source, /"settings\.section\.mcp-settings\.learnMore": "Learn more\."/);
  assert.match(source, /"settings\.section\.mcp-settings\.subtitle": "连接外部工具和数据源。"/);
  assert.match(source, /"settings\.section\.mcp-settings\.learnMore": "了解更多。"/);
  assert.doesNotMatch(source, /"settings\.section\.mcp-settings\.subtitle": ".*<a>.*<\/a>"/);
});

test("mcp settings keeps upstream oauth cache and restart command payload shape", () => {
  const componentSource = readSource(COMPONENT_SOURCE_PATH);
  const serviceSource = readSource(path.join(process.cwd(), "src/services/mcp.ts"));

  assert.match(componentSource, /const \[authorizationUrlsByName, setAuthorizationUrlsByName\] = useState<Record<string, string \| null>>\(\{\}\);/);
  assert.match(componentSource, /const cachedAuthorizationUrl = authorizationUrlsByName\[name\];/);
  assert.match(componentSource, /if \(cachedAuthorizationUrl\) \{\s*await open\(cachedAuthorizationUrl\);/s);
  assert.match(componentSource, /setAuthorizationUrlsByName\(\(current\) => \(\{ \.\.\.current, \[name\]: response\.authorizationUrl \}\)\);/);
  assert.match(componentSource, /const \{ \[notification\.name\]: _removed, \.\.\.rest \} = current;/);

  assert.match(serviceSource, /invoke<void>\("codex-app-server-restart", \{\s*params: \{\s*hostId,\s*\},\s*\}\);/s);
  assert.doesNotMatch(serviceSource, /killCodexProcess/);
});

test("mcp settings invalidates config queries after save and uninstall mutations", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /await batchWriteConfigValueForHost\(\{[\s\S]*reloadUserConfig: true,[\s\S]*\}\);\s*markSelectedHostDirty\(\);\s*await load\(\);\s*await emitQueryCacheInvalidated\(CONFIG_QUERY_KEY\);\s*closeEditor\(\);/s,
  );
  assert.match(
    source,
    /await batchWriteConfigValueForHost\(\{[\s\S]*value: null,[\s\S]*reloadUserConfig: true,[\s\S]*\}\);\s*markSelectedHostDirty\(\);\s*await load\(\);\s*await emitQueryCacheInvalidated\(CONFIG_QUERY_KEY\);\s*closeEditor\(\);/s,
  );
});

test("mcp settings formats lowercase server names like upstream title helper", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /return customLabel === customLabel\.toLowerCase\(\)\s*\?\s*`\$\{customLabel\[0\]\?\.toUpperCase\(\) \?\? ""\}\$\{customLabel\.slice\(1\)\}`\s*:\s*customLabel;/s,
  );
  assert.match(
    source,
    /return trimmedName === trimmedName\.toLowerCase\(\)\s*\?\s*`\$\{trimmedName\[0\]\?\.toUpperCase\(\) \?\? ""\}\$\{trimmedName\.slice\(1\)\}`\s*:\s*trimmedName;/s,
  );
});

test("mcp settings route wiring uses local active workspace root instead of chat cwd", () => {
  const appSource = readSource(path.join(process.cwd(), "src/App.tsx"));

  assert.match(appSource, /const \[localActiveWorkspaceRoot, setLocalActiveWorkspaceRoot\] = useState<string \| null>\(null\);/);
  assert.match(appSource, /const response = await readActiveWorkspaceRoots\(LOCAL_SETTINGS_HOST_ID\);/);
  assert.match(appSource, /setLocalActiveWorkspaceRoot\(response\.roots\[0\] \?\? null\);/);
  assert.match(appSource, /void onActiveWorkspaceRootsUpdated\(\(\) => \{\s*void refreshLocalActiveWorkspaceRoot\(\);\s*\}\)/s);
  assert.match(
    appSource,
    /const settingsWorkspaceRoot =\s*selectedSettingsHostId === LOCAL_SETTINGS_HOST_ID\s*\?\s*localActiveWorkspaceRoot\s*:\s*null;/s,
  );
  assert.match(appSource, /return <McpSettings selectedHostId=\{selectedSettingsHostId\} workspaceRoot=\{settingsWorkspaceRoot\} \/>;/);
  assert.doesNotMatch(appSource, /const settingsWorkspaceRoot = chatWorkspaceRoot;/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
