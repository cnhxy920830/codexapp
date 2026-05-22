/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/PersonalizationSettings.tsx",
);
const MEMORY_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/PersonalizationMemorySettings.tsx",
);
const CHRONICLE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/PersonalizationChronicleSettings.tsx",
);
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const SETTINGS_SERVICE_PATH = path.join(process.cwd(), "src/services/settings.ts");
const PERSONALIZATION_SERVICE_PATH = path.join(
  process.cwd(),
  "src/services/personalization.ts",
);
const SETTINGS_DIALOG_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/SettingsDialog.tsx",
);
const TOGGLE_SWITCH_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/ToggleSwitch.tsx",
);

test("personalization settings keeps extracted shared shell and section order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /SettingsContentLayout title=\{<SettingsSectionTitle slug="personalization" \/>\}/,
  );
  assert.match(source, /<CustomInstructionsGroup/);
  assert.match(source, /<PersonalizationMemorySettings/);
  assert.match(source, /SettingsChoiceMenu[\s\S]*className="w-\[240px\]"/);
  assert.match(source, /SettingsChoiceMenu[\s\S]*menuClassName="w-\[260px\] max-w-xs"/);

  const personalityIndex = source.indexOf(
    'label={t("settings.personalization.personality.label")}',
  );
  const customInstructionsIndex = source.indexOf("<CustomInstructionsGroup");
  const memoryIndex = source.indexOf("<PersonalizationMemorySettings");

  assert.ok(personalityIndex >= 0);
  assert.ok(customInstructionsIndex > personalityIndex);
  assert.ok(memoryIndex > customInstructionsIndex);
});

test("personalization settings uses extracted host-aware services and hotkey save flow", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /readConfigForHost\(\{\s*hostId: selectedHostId,/s);
  assert.match(source, /setPersonalityForHost\(\{\s*hostId: selectedHostId,/s);
  assert.match(source, /readCodexAgentsMd\(selectedHostId\)/);
  assert.match(source, /writeCodexAgentsMd\(\{\s*hostId: selectedHostId,/s);
  assert.match(source, /useHotkey\(\{\s*accelerator: "CmdOrCtrl\+S",/s);
  assert.match(source, /onKeyDown: \(event\) => \{\s*event\.preventDefault\(\);\s*void saveCodexAgentsDocument\(\);/s);
  assert.doesNotMatch(source, /window\.addEventListener\("keydown", handleKeyDown\)/);
  assert.doesNotMatch(source, /workspaceRoot\]/);
});

test("personalization memory settings keeps extracted host-aware memory and chronicle wiring", () => {
  const source = readSource(MEMORY_SOURCE_PATH);

  assert.match(source, /listExperimentalFeaturesForHost\(selectedHostId\)/);
  assert.match(source, /resetMemoriesForHost\(selectedHostId\)/);
  assert.match(source, /const chronicleChecked = state\.chronicleEnabled;/);
  assert.match(
    source,
    /!enabled && isLocalHost[\s\S]*keyPath: "features\.chronicle"[\s\S]*value: false/s,
  );
  assert.match(source, /disabled=\{isBusy \|\| !state\.featureEnabled\}/);
  assert.match(source, /import \{ SettingsDialog, SettingsDialogFooter \} from "\.\/SettingsDialog";/);
  assert.match(source, /<SettingsDialog[\s\S]*size="compact"[\s\S]*title=\{t\("settings\.memory\.resetDialogTitle"\)\}/s);
  assert.match(source, /<SettingsDialogFooter[\s\S]*confirmTone="danger"/s);
});

test("chronicle settings renders as extracted shared settings row", () => {
  const source = readSource(CHRONICLE_SOURCE_PATH);

  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /<SettingsRow[\s\S]*label=\{chronicleDisplayName\}/s);
  assert.match(source, /<ChronicleDescription/);
  assert.match(source, /import \{ SettingsDialog, SettingsDialogFooter \} from "\.\/SettingsDialog";/);
  assert.match(source, /import \{ Tooltip \} from "\.\/Tooltip";/);
  assert.match(
    source,
    /<Tooltip[\s\S]*tooltipContent=\{t\("settings\.general\.experimentalFeatures\.chronicle\.memoriesRequiredTooltip"\)\}[\s\S]*<ToggleSwitch/s,
  );
  assert.match(source, /className=\{memoriesEnabled \? undefined : "pointer-events-none"\}/);
  assert.match(source, /<SettingsDialogFooter[\s\S]*confirmLabel=\{t\("settings\.general\.experimentalFeatures\.chronicle\.continue"\)\}/s);
  assert.match(source, /<SettingsDialog[\s\S]*title=\{t\("settings\.general\.experimentalFeatures\.chronicle\.consentTitle"\)\}/s);
  assert.match(source, /<h2 className="sr-only">\{chronicleDisplayName\}<\/h2>/);
  assert.doesNotMatch(source, /<div className="space-y-2">/);
});

test("app and services keep extracted personalization host plumbing", () => {
  const appSource = readSource(APP_SOURCE_PATH);
  const settingsServiceSource = readSource(SETTINGS_SERVICE_PATH);
  const personalizationServiceSource = readSource(PERSONALIZATION_SERVICE_PATH);

  assert.match(
    appSource,
    /<PersonalizationSettings[\s\S]*selectedHostId=\{selectedSettingsHostId\}/,
  );
  assert.match(
    appSource,
    /<PersonalizationSettings[\s\S]*focusComposerNonce: Date\.now\(\)[\s\S]*prefillPrompt: prompt/s,
  );
  assert.match(
    settingsServiceSource,
    /invoke<void>\("set-personality", \{\s*params: \{\s*hostId: normalizeHostId\(params\.hostId\),/s,
  );
  assert.match(
    personalizationServiceSource,
    /invoke<WorkspaceAgentsMdDocument>\("codex-agents-md",/,
  );
  assert.match(
    personalizationServiceSource,
    /invoke<\{ path: string \}>\("codex-agents-md-save",/,
  );
  assert.match(
    personalizationServiceSource,
    /invoke<void>\("reset-memories-for-host",/,
  );
});

test("shared settings dialog and toggle primitives support extracted personalization owners", () => {
  const dialogSource = readSource(SETTINGS_DIALOG_SOURCE_PATH);
  const toggleSource = readSource(TOGGLE_SWITCH_SOURCE_PATH);

  assert.match(dialogSource, /export function SettingsDialog\(/);
  assert.match(dialogSource, /role="dialog"/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /aria-labelledby=\{titleId\}/);
  assert.match(dialogSource, /aria-describedby=\{subtitle \|\| children \? descriptionId : undefined\}/);
  assert.match(dialogSource, /size = "default"/);
  assert.match(dialogSource, /w-full max-w-\[92vw\] rounded-3xl border border-token-border bg-token-dropdown-background\/90 text-token-foreground shadow-lg backdrop-blur-xl outline-none/);
  assert.match(dialogSource, /size === "compact" \? "max-w-\[420px\]" : "max-w-\[520px\]"/);
  assert.match(dialogSource, /className="flex flex-col gap-0 px-5 py-5 text-base leading-normal tracking-normal"/);
  assert.match(dialogSource, /className="codex-dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-\[rgba\(0,0,0,0\.24\)\] px-4"/);
  assert.match(dialogSource, /export function SettingsDialogFooter\(/);
  assert.match(dialogSource, /<Button color="ghost" disabled=\{confirmLoading\} onClick=\{onCancel\} size="toolbar">/);
  assert.match(dialogSource, /size="toolbar"/);
  assert.match(toggleSource, /className\?: string;/);
  assert.match(toggleSource, /className=\{joinClasses\("app-toggle", className\)\}/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
