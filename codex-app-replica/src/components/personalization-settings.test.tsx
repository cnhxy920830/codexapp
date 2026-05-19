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

test("personalization settings keeps extracted shared shell and section order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /SettingsContentLayout title=\{<SettingsSectionTitle slug="personalization" \/>\}/,
  );
  assert.match(source, /<CustomInstructionsGroup/);
  assert.match(source, /<PersonalizationMemorySettings/);
  assert.match(source, /SettingsChoiceMenu[\s\S]*className="w-\[260px\]"/);

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
  assert.match(source, /event\.key\.toLowerCase\(\) !== "s"/);
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
});

test("chronicle settings renders as extracted shared settings row", () => {
  const source = readSource(CHRONICLE_SOURCE_PATH);

  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /<SettingsRow[\s\S]*label=\{chronicleDisplayName\}/s);
  assert.match(source, /<ChronicleDescription/);
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

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
