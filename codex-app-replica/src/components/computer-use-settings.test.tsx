/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/ComputerUseSettings.tsx");
const SERVICE_SOURCE_PATH = path.join(process.cwd(), "src/services/computerUseSettings.ts");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const TITLE_SOURCE_PATH = path.join(process.cwd(), "src/components/SettingsSectionTitle.tsx");
const MESSAGES_SOURCE_PATH = path.join(process.cwd(), "src/i18n/messages.ts");

test("computer use settings keeps extracted overview page title slug and section order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /title=\{<SettingsSectionTitle slug="computer-use" \/>\}/);
  assert.match(source, /<SettingsGroup\.Header title=\{t\("settings\.computerUse\.install\.title"\)\} \/>/);

  const controlIndex = source.indexOf('title={t("settings.computerUse.install.title")}');
  const allowedAppsIndex = source.indexOf('title={t("settings.computerUse.allowedApps.title")}');
  const soundSelectorIndex = source.indexOf("<SoundModeSelector");

  assert.ok(controlIndex >= 0);
  assert.ok(allowedAppsIndex > controlIndex);
  assert.ok(soundSelectorIndex > allowedAppsIndex);
  assert.doesNotMatch(
    source,
    /<SettingsGroup>\s*<SettingsGroup\.Content>\s*<SoundModeSelector/s,
  );
});

test("computer use settings keeps extracted control rows and chrome manage ownership", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<FilteredPluginSettings/);
  assert.match(source, /installButtonLabel=\{t\("settings\.computerUse\.install\.button"\)\}/);
  assert.match(source, /emptyState=\{t\("settings\.computerUse\.install\.empty"\)\}/);
  assert.match(source, /title: t\("settings\.computerUse\.anyApp\.title"\)/);
  assert.match(source, /description: t\("settings\.computerUse\.anyApp\.description"\)/);
  assert.match(source, /title: t\("settings\.computerUse\.chrome\.pluginTitle"\)/);
  assert.match(source, /description: chromeDescription/);
  assert.match(source, /descriptionIndicator:\s*chromeDescriptionTone === "success"/);
  assert.match(source, /<Button color="secondary" size="toolbar" onClick=\{onOpenChromeSettings\}>/);
});

test("computer use settings keeps extracted allowed-app rows and compact remove dialog", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<BrowserUseLoadingStateRow message=\{t\("settings\.computerUse\.allowedApps\.loading"\)\} \/>/);
  assert.match(source, /<BrowserUseMessageStateRow message=\{t\("settings\.computerUse\.allowedApps\.loadError"\)\} \/>/);
  assert.match(source, /className="justify-center"/);
  assert.match(source, /<TrashIcon className="icon-2xs" \/>/);
  assert.match(source, /approvedApps\.map\(\(approvedApp\) => \(\s*<SettingsRow/s);
  assert.match(source, /className="items-start max-sm:flex-col max-sm:items-stretch"/);
  assert.doesNotMatch(source, /function ComputerUseSettingsRow\(/);
  assert.match(source, /<BrowserUseDialog\s+confirmLabel=\{t\("settings\.computerUse\.allowedApps\.removeDialogConfirm"\)\}/s);
  assert.match(source, /title=\{t\("settings\.computerUse\.allowedApps\.removeDialogTitle"/);
  assert.match(source, /subtitle=\{t\("settings\.computerUse\.allowedApps\.removeDialogSubtitle"/);
});

test("computer use settings keeps extracted chrome subpage shell, permissions, and six origin sections", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /backSlot=\{<ComputerUseChromeBreadcrumb onBack=\{onBack\} \/>\}/);
  assert.match(source, /subtitle=\{statusBadge\}/);
  assert.match(source, /subtitleClassName="flex"/);
  assert.match(source, /<StatusBadge installed=\{chromeExtensionInstalled\} \/>/);
  assert.match(source, /<Button\s+color="secondary"\s+size="toolbar"[\s\S]*settings\.computerUse\.chrome\.reinstallExtension/);
  assert.match(source, /<Button\s+color="danger"\s+size="toolbar"[\s\S]*settings\.computerUse\.chrome\.removeExtension/);
  assert.match(source, /title=\{t\("settings\.computerUse\.chrome\.permissions\.title"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.approval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.historyApproval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.downloadApproval\.label"\)\}/);
  assert.match(source, /label=\{t\("settings\.browserUse\.uploadApproval\.label"\)\}/);

  const originSectionMatches = source.match(/<BrowserUseOriginSection/g) ?? [];
  assert.equal(originSectionMatches.length, 2);
  assert.match(source, /const CHROME_ORIGIN_SECTION_CONFIGS: BrowserUseOriginSectionConfig\[] = \[/);

  const triggerMatches = source.match(/className="w-\[152px\]"/g) ?? [];
  assert.ok(triggerMatches.length >= 4);
});

test("computer use settings service and labels use extracted command and title keys", () => {
  const serviceSource = readSource(SERVICE_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);
  const titleSource = readSource(TITLE_SOURCE_PATH);
  const messagesSource = readSource(MESSAGES_SOURCE_PATH);

  assert.match(serviceSource, /invoke<ComputerUseVisibilityState>\("computer-use-app-approvals-visibility"\)/);
  assert.match(serviceSource, /invoke<ComputerUseApprovalsState \| null>\("computer-use-app-approvals-read"\)/);
  assert.match(serviceSource, /invoke<ComputerUseApprovalsState \| null>\("computer-use-app-approval-remove", \{ params \}\)/);

  assert.match(titleSource, /\| "computer-use"/);
  assert.match(titleSource, /"computer-use": "computerUse\.label"/);
  assert.match(appSource, /"computer-use": "computerUse\.label"/);

  assert.match(messagesSource, /"computerUse\.label": "Computer use"/);
  assert.match(messagesSource, /"computerUse\.label": "计算机使用"/);
  assert.match(messagesSource, /"settings\.section\.computer-use": "Computer use"/);
  assert.match(messagesSource, /"settings\.section\.computer-use": "计算机使用"/);
  assert.match(messagesSource, /"settings\.computerUse\.install\.title": "Control"/);
  assert.match(messagesSource, /"settings\.computerUse\.install\.empty": "Computer Use plugins unavailable"/);
  assert.match(messagesSource, /"settings\.computerUse\.install\.title": "控制"/);
  assert.match(messagesSource, /"settings\.computerUse\.install\.empty": "Computer Use 插件不可用"/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
