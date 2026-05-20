/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/BrowserUseSettings.tsx");
const SERVICE_SOURCE_PATH = path.join(process.cwd(), "src/services/browserUseSettings.ts");
const STATSIG_SOURCE_PATH = path.join(process.cwd(), "src/features/statsig/replicaStatsig.ts");

test("browser use settings keeps extracted page shell and browser plugin ownership", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout\s+title=\{t\("settings\.browserUse\.title"\)\}/s);
  assert.match(source, /<FilteredPluginSettings/);
  assert.match(source, /pluginNames=\{\["browser-use"\]\}/);
  assert.match(source, /renderAfterSections=\{\(context\) =>\s*isBrowserUseEnabled\(context\) \?/s);
  assert.match(source, /renderComputerUseSettingsSubtitle\(t\("settings\.browserUse\.subtitle"\)/);
});

test("browser use settings keeps extracted data and permissions row structure", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  const dataGroupIndex = source.indexOf('title={t("settings.browserUse.browser.title")}');
  const permissionsGroupIndex = source.indexOf('title={t("settings.browserUse.permissions.title")}');
  const originsIndex = source.indexOf("{BROWSER_USE_ORIGIN_SECTIONS.map((section) => (");
  assert.ok(dataGroupIndex >= 0);
  assert.ok(permissionsGroupIndex > dataGroupIndex);
  assert.ok(originsIndex > permissionsGroupIndex);

  assert.match(source, /label=\{t\("settings\.browserUse\.browser\.clearBrowsingData\.label"\)\}/);
  assert.match(source, /id="browser-browsing-data-options"/);
  assert.match(source, /ALL_BROWSING_DATA_TYPES\.map\(\(dataType\) => \(/);
  assert.match(source, /label=\{t\("settings\.browserUse\.browser\.annotationScreenshots\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.approval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.historyApproval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.downloadApproval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.uploadApproval\.label"\)\}/);

  const triggerMatches = source.match(/className="w-\[152px\]"/g) ?? [];
  assert.equal(triggerMatches.length, 5);
});

test("browser use settings keeps extracted approval learn-more link and warning row", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /const BROWSER_USE_APPROVAL_LINK_DYNAMIC_CONFIG = "4168530037";/,
  );
  assert.match(
    source,
    /const browserUseLearnMoreDynamicConfig = useReplicaStatsigDynamicConfigValue\(\s*BROWSER_USE_APPROVAL_LINK_DYNAMIC_CONFIG,\s*\)/s,
  );
  assert.match(
    source,
    /const browserUseLearnMoreUrl = resolveBrowserUseLearnMoreUrl\(\s*browserUseLearnMoreDynamicConfig,\s*\)/s,
  );
  assert.match(source, /renderInlineTagButton\(\s*t\("settings\.browserUse\.approval\.description"\),\s*"learnMoreLink"/s);
  assert.match(source, /openInBrowser\(browserUseLearnMoreUrl\)/);
  assert.match(source, /function resolveBrowserUseLearnMoreUrl\(dynamicConfig: unknown\)/);
  assert.match(source, /const parsedUrl = new URL\(configuredUrl\);/);
  assert.match(source, /if \(parsedUrl\.protocol === "https:"\)/);
  assert.match(source, /return BROWSER_USE_LEARN_MORE_URL;/);
  assert.match(source, /warning:\s*t\("settings\.browserUse\.approval\.neverAsk\.elevatedRiskDisclaimer"\)/);
  assert.match(source, /warningIcon:\s*\(\s*<ElevatedRiskIcon className="icon-xs shrink-0 text-token-editor-warning-foreground" \/>/s);
});

test("browser use settings keeps extracted six origin sections and compact dialog ownership", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /const BROWSER_USE_ORIGIN_SECTIONS: ReadonlyArray<OriginSectionConfig> = \[/);
  assert.match(source, /\{ kind: "denied", resource: "origins" \}/);
  assert.match(source, /\{ kind: "allowed", resource: "origins" \}/);
  assert.match(source, /\{ kind: "denied", resource: "downloads" \}/);
  assert.match(source, /\{ kind: "allowed", resource: "downloads" \}/);
  assert.match(source, /\{ kind: "denied", resource: "uploads" \}/);
  assert.match(source, /\{ kind: "allowed", resource: "uploads" \}/);

  assert.match(source, /<SettingsGroup\.Header\s+actions=\{\s*<Button color="secondary" disabled=\{isDisabled\} size="toolbar" onClick=\{onRequestAdd\}>/s);
  assert.match(source, /className="justify-center"/);
  assert.match(source, /<BrowserUseDialog\s+confirmLabel=\{t\("settings\.browserUse\.domains\.addDialogConfirm"\)\}/s);
  assert.match(source, /<BrowserUseDialog\s+confirmLabel=\{t\("settings\.browserUse\.origins\.removeDialogConfirm"\)\}/s);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
});

test("browser use settings service uses extracted browser-use command contract", () => {
  const source = readSource(SERVICE_SOURCE_PATH);

  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-origin-state-read"\)/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-approval-mode-write", \{ params \}\)/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-history-approval-mode-write", \{ params \}\)/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-file-transfer-approval-mode-write", \{ params \}\)/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-origin-add", \{/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-origin-remove", \{/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-file-transfer-origin-add", \{/);
  assert.match(source, /invoke<BrowserUseSettingsState>\("browser-use-file-transfer-origin-remove", \{/);
  assert.match(source, /targetOrigin: params\.origin/);
});

test("replica statsig exposes dynamic config values needed by browser use settings", () => {
  const source = readSource(STATSIG_SOURCE_PATH);

  assert.match(source, /dynamicConfigs: Record<string, unknown>;/);
  assert.match(source, /dynamicConfigs: \{\},/);
  assert.match(source, /export function useReplicaStatsigDynamicConfigValue\(name: string\)/);
  assert.match(
    source,
    /const state = useReplicaStatsigState\(\);\s*return state\.dynamicConfigs\[name\];/s,
  );
  assert.match(source, /const dynamicConfigs = extractDynamicConfigValues\(response\);/);
  assert.match(source, /dynamicConfigs,/);
  assert.match(source, /function extractDynamicConfigValues\(response: unknown\)/);
  assert.match(source, /readNamedValueCollection\(response, "dynamic_configs"\)/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
