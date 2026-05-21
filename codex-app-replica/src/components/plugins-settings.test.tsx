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
const APP_TOOLS_DIALOG_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/PluginsAppToolsDialog.tsx",
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
  assert.doesNotMatch(source, /startInSidebar/);
  assert.match(source, /initialMode:\s*state\?\.initialMode/);
});

test("plugins page owner keeps extracted manage header, sticky strip, and shared empty state", () => {
  const source = readSource(OWNER_SOURCE_PATH);

  assert.match(source, /skills\.appsPage\.managePlugins/);
  assert.match(source, /skills\.appsPage\.breadcrumb\.root/);
  assert.match(source, /skills\.appsPage\.breadcrumb\.manage/);
  assert.match(source, /initialMode:\s*"browse"/);
  assert.match(source, /path:\s*"\/skills"/);
  assert.match(source, /skills\.appsPage\.createPlugin/);
  assert.match(source, /skills\.appsPage\.createSkill/);
  assert.match(source, /skills\.appsPage\.actionsMenu/);
  assert.match(source, /skills\.appsPage\.search\.plugins/);
  assert.match(source, /skills\.appsPage\.search\.plugins\.label/);
  assert.match(source, /skills\.appsPage\.search\.apps/);
  assert.match(source, /skills\.appsPage\.search\.apps\.label/);
  assert.match(source, /skills\.appsPage\.search\.mcps/);
  assert.match(source, /skills\.appsPage\.search\.mcps\.label/);
  assert.match(source, /skills\.appsPage\.search\.skills/);
  assert.match(source, /skills\.appsPage\.search\.skills\.label/);
  assert.match(source, /skills\.appsPage\.search\.marketplace/);
  assert.match(source, /skills\.appsPage\.search\.marketplace\.label/);
  assert.match(source, /<SettingsHostDropdown/);
  assert.match(source, /localLabelKey="skills\.appsPage\.hostDropdown\.local"/);
  assert.match(source, /titleKey="skills\.appsPage\.hostDropdown\.title"/);
  assert.match(source, /triggerClassName="hidden max-w-56 justify-start gap-1\.5 md:inline-flex"/);
  assert.match(source, /triggerSize="toolbar"/);
  assert.match(source, /<ToolbarMenu/);
  assert.match(source, /skills\.appsPage\.pluginsUnsupportedHost\.title/);
  assert.match(source, /<LargeEmptyState/);
  assert.match(source, /<ManageTabButton/);
  assert.match(source, /skills\.appsPage\.manageTab\.plugins/);
  assert.match(source, /skills\.appsPage\.manageTab\.apps/);
  assert.match(source, /skills\.appsPage\.manageTab\.mcps/);
  assert.match(source, /skills\.appsPage\.manageTab\.skills/);
  assert.match(source, /skills\.appsPage\.manageTab\.marketplace/);
  assert.match(source, /function getManageSearchCopy/);
  assert.match(source, /currentTab === "apps"/);
  assert.match(source, /currentTab === "mcps"/);
  assert.match(source, /currentTab === "skills"/);
  assert.match(source, /currentTab === "marketplace"/);
  assert.match(source, /aria-label=\{t\(manageSearchCopy\.labelKey\)\}/);
  assert.match(source, /placeholder=\{t\(manageSearchCopy\.placeholderKey\)\}/);
  assert.match(source, /md:flex md:w-56/);
  assert.match(source, /cwd: effectiveWorkspaceRoot && effectiveWorkspaceRoot !== "\/" \? effectiveWorkspaceRoot : null/);
  assert.match(source, /prompt: `\[@\$\{app\.name\}\]\(app:\/\/\$\{app\.id\}\)`/);
  assert.match(source, /onOpenChatWithPrompt\?\.\(\{\s*cwd:\s*effectiveWorkspaceRoot && effectiveWorkspaceRoot !== "\/" \? effectiveWorkspaceRoot : null,\s*prompt:\s*`/s);
  assert.doesNotMatch(source, /setIsAddMarketplaceOpen\(true\)/);
});

test("plugins page owner uses extracted MCP manage row icon actions instead of a text settings button", () => {
  const source = readSource(OWNER_SOURCE_PATH);
  const mcpsStart = source.indexOf('{currentTab === "mcps" ? (');
  const skillsStart = source.indexOf('{currentTab === "skills" ? (');

  assert.ok(mcpsStart >= 0);
  assert.ok(skillsStart > mcpsStart);

  const mcpsSection = source.slice(mcpsStart, skillsStart);

  assert.match(source, /function McpIcon/);
  assert.match(mcpsSection, /<McpIcon className="h-5 w-5 shrink-0 text-\[var\(--app-shell-subtle\)\]" \/>/);
  assert.match(mcpsSection, /<Tooltip tooltipContent=\{t\("skills\.appsPage\.mcps\.settings"\)\}>/);
  assert.match(mcpsSection, /<Button[\s\S]*aria-label=\{t\("skills\.appsPage\.mcps\.settings"\)\}[\s\S]*color="ghost"[\s\S]*size="icon"[\s\S]*uniform[\s\S]*<SettingsCogIcon className="h-4 w-4" \/>/s);
  assert.match(mcpsSection, /<Tooltip tooltipContent=\{toggleTooltip\}>[\s\S]*<ToggleSwitch/s);
  assert.doesNotMatch(mcpsSection, /\{t\("skills\.appsPage\.mcps\.settings"\)\}\s*<\/button>/);
  assert.doesNotMatch(mcpsSection, /skills\.card\.(enabledStatus|disabledStatus)/);
});

test("plugins page preserves initial selected app until apps data loads", () => {
  const source = readSource(OWNER_SOURCE_PATH);

  assert.match(source, /useEffect\(\(\) => \{\s*if \(pageState == null\) \{\s*return;\s*\}\s*if \(selectedAppId != null && selectedApp == null\) \{\s*setSelectedAppId\(null\);/s);
});

test("plugins page owner keeps manage apps tab installed-only with extracted dialog and toggle affordances", () => {
  const source = readSource(OWNER_SOURCE_PATH);
  const appsStart = source.indexOf('{currentTab === "apps" ? (');
  const mcpsStart = source.indexOf('{currentTab === "mcps" ? (');

  assert.ok(appsStart >= 0);
  assert.ok(mcpsStart > appsStart);

  const appsSection = source.slice(appsStart, mcpsStart);

  assert.match(source, /const installedApps = useMemo\(\s*\(\) => \(pageState\?\.apps \?\? \[\]\)\.filter\(\(app\) => app\.isAccessible\),/s);
  assert.match(source, /return installedApps/);
  assert.match(source, /const totalApps = installedApps\.length;/);
  assert.match(source, /function buildManageOnChatGptUrl\(app: AppInfo\)/);
  assert.match(source, /url\.hash = `settings\/Connectors\?connector=\$\{encodeURIComponent\(app\.id\)\}&referrer=app_directory`;/);
  assert.match(source, /function AppLogo\(\{ app \}: \{ app: AppInfo \}\)/);
  assert.match(source, /function AppConnectorFallbackIcon\(\{ className \}: \{ className\?: string \}\)/);
  assert.match(source, /document\.documentElement\.classList\.contains\("electron-dark"\)/);
  assert.match(source, /overflow-hidden rounded-lg border border-\[var\(--app-shell-border\)\] bg-\[var\(--app-shell-muted-surface\)\]/);
  assert.match(source, /<AppConnectorFallbackIcon className="h-4 w-4" \/>/);
  assert.match(appsSection, /<AppLogo app=\{app\} \/>/);
  assert.match(appsSection, /skills\.appsPage\.apps\.noDescription/);
  assert.match(appsSection, /<Tooltip tooltipContent=\{t\("skills\.appsPage\.apps\.manageOnChatGpt"\)\}>/);
  assert.match(appsSection, /aria-label=\{t\("skills\.appsPage\.apps\.moreActions"\)\}/);
  assert.match(appsSection, /void handleOpenAppUrl\(buildManageOnChatGptUrl\(app\)\);/);
  assert.match(appsSection, /<Tooltip tooltipContent=\{toggleTooltip\}>[\s\S]*<ToggleSwitch/s);
  assert.match(appsSection, /skills\.appsPage\.apps\.(enabledStatus|disabledStatus)/);
  assert.doesNotMatch(source, /<ForwardNavigationIcon className="h-4 w-4" \/>/);
});

test("plugins page owner uses extracted tooltip affordances for skills and marketplace manage rows", () => {
  const source = readSource(OWNER_SOURCE_PATH);
  const skillsStart = source.indexOf('{currentTab === "skills" ? (');
  const marketplaceStart = source.indexOf('{currentTab === "marketplace" ? (');

  assert.ok(skillsStart >= 0);
  assert.ok(marketplaceStart > skillsStart);

  const skillsSection = source.slice(skillsStart, marketplaceStart);
  const marketplaceSection = source.slice(marketplaceStart);

  assert.match(skillsSection, /<Tooltip tooltipContent=\{toggleTooltip\}>[\s\S]*<ToggleSwitch/s);
  assert.doesNotMatch(skillsSection, /title=\{toggleTooltip\}/);
  assert.match(marketplaceSection, /<BrowserTabIcon className="mt-0\.5 h-5 w-5 shrink-0 text-\[var\(--app-shell-subtle\)\]" \/>/);
  assert.match(
    marketplaceSection,
    /<Tooltip[\s\S]*disabled=\{upgradeDisabledKey == null\}[\s\S]*tooltipContent=\{t\(upgradeDisabledKey \?\? "skills\.appsPage\.marketplace\.upgrade"\)\}[\s\S]*>/s,
  );
  assert.match(
    marketplaceSection,
    /<Tooltip[\s\S]*disabled=\{removeDisabledKey == null\}[\s\S]*tooltipContent=\{t\(removeDisabledKey \?\? "skills\.appsPage\.marketplace\.remove"\)\}[\s\S]*>/s,
  );
  assert.match(marketplaceSection, /<Button[\s\S]*aria-label=\{t\("skills\.appsPage\.marketplace\.upgrade\.ariaLabel"\)\}[\s\S]*color="secondary"/s);
  assert.match(marketplaceSection, /<Button[\s\S]*aria-label=\{t\("skills\.appsPage\.marketplace\.remove\.ariaLabel"\)\}[\s\S]*color="ghost"[\s\S]*size="icon"[\s\S]*uniform/s);
  assert.doesNotMatch(marketplaceSection, /title=\{t\(upgradeDisabledKey \?\? "skills\.appsPage\.marketplace\.upgrade"\)\}/);
  assert.doesNotMatch(marketplaceSection, /title=\{t\(removeDisabledKey \?\? "skills\.appsPage\.marketplace\.remove"\)\}/);
});

test("app tools dialog uses extracted manage deep link, tooltip affordances, and markdown tool descriptions", () => {
  const source = readSource(APP_TOOLS_DIALOG_SOURCE_PATH);

  assert.match(source, /const manageUrl = buildManageOnChatGptUrl\(app\);/);
  assert.match(source, /disabled=\{manageUrl == null\}/);
  assert.match(source, /void onOpenAppUrl\(manageUrl\);/);
  assert.match(source, /url\.hash = `settings\/Connectors\?connector=\$\{encodeURIComponent\(app\.id\)\}&referrer=app_directory`;/);
  assert.match(source, /<Tooltip tooltipContent=\{toggleTooltip\}>[\s\S]*<ToggleSwitch/s);
  assert.match(
    source,
    /<Tooltip[\s\S]*disabled=\{canTryInChat\}[\s\S]*tooltipContent=\{t\("skills\.appsPage\.toolsDialog\.tryInChatDisabled"\)\}[\s\S]*>/s,
  );
  assert.match(
    source,
    /<MarkdownPreview[\s\S]*className="app-text-muted text-\[13px\] leading-6 \[\&>p\]:my-0"[\s\S]*cwd=\{null\}[\s\S]*hostId=\{null\}[\s\S]*text=\{tool\.description\}[\s\S]*\/>/s,
  );
  assert.doesNotMatch(source, /void onOpenAppUrl\(app\.installUrl\);/);
  assert.doesNotMatch(source, /title=\{canTryInChat \? undefined : t\("skills\.appsPage\.toolsDialog\.tryInChatDisabled"\)\}/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
