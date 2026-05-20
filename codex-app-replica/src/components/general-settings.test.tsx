/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/GeneralSettings.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");

test("general settings keeps extracted shared shell and section order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout title=\{<SettingsSectionTitle slug="general-settings" \/>\}>/);
  assert.match(source, /<SettingsGroup className="gap-4">[\s\S]*settings\.workMode\.groupTitle/s);
  assert.match(source, /<SettingsGroup className="gap-2">[\s\S]*settings\.agent\.permissionsMode\.groupTitle/s);
  assert.match(source, /<SettingsGroup className="gap-2">[\s\S]*settings\.general\.groupTitle/s);
  assert.match(source, /<SettingsGroup className="gap-2">[\s\S]*settings\.general\.dictation/s);
  assert.match(source, /<SettingsGroup className="gap-2">[\s\S]*settings\.general\.notifications/s);
  assert.match(source, /<SettingsGroup className="gap-2">[\s\S]*settings\.general\.gpuTearingDebug/s);

  const workModeIndex = source.indexOf('title={t("settings.workMode.groupTitle")}');
  const permissionsIndex = source.indexOf('title={t("settings.agent.permissionsMode.groupTitle")}');
  const generalIndex = source.indexOf('title={t("settings.general.groupTitle")}');
  const dictationIndex = source.indexOf('title={t("settings.general.dictation")}');
  const notificationsIndex = source.indexOf('title={t("settings.general.notifications")}');
  const gpuIndex = source.indexOf('title={t("settings.general.gpuTearingDebug")}');

  assert.ok(workModeIndex >= 0);
  assert.ok(permissionsIndex > workModeIndex);
  assert.ok(generalIndex > permissionsIndex);
  assert.ok(dictationIndex > generalIndex);
  assert.ok(notificationsIndex > dictationIndex);
  assert.ok(gpuIndex > notificationsIndex);
});

test("general settings keeps extracted single General surface and row order", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const generalSectionMatch = source.match(
    /<SettingsGroup className="gap-2">\s*<SettingsGroup\.Header title=\{t\("settings\.general\.groupTitle"\)\} \/>\s*<SettingsSurface>([\s\S]*?)<\/SettingsSurface>\s*<\/SettingsGroup>/,
  );

  assert.ok(generalSectionMatch);
  const generalSectionSource = generalSectionMatch[1];

  const openTargetIndex = generalSectionSource.indexOf('label={t("settings.ide.defaultOpenTarget.label")}');
  const agentEnvironmentIndex = generalSectionSource.indexOf('label={t("settings.agentEnvironment.label")}');
  const terminalShellIndex = generalSectionSource.indexOf('label={t("settings.openIn.integratedTerminalShell.label")}');
  const languageIndex = generalSectionSource.indexOf('label={t("settings.ide.language.label")}');
  const macMenuBarIndex = generalSectionSource.indexOf('label={t("settings.general.macMenuBar.label")}');
  const hotkeyWindowIndex = generalSectionSource.indexOf(
    'label={t(\n                  "settings.general.experimentalFeatures.hotkeyWindowHotkey.label",',
  );
  const preventSleepIndex = generalSectionSource.indexOf(
    'label={t("settings.general.power.preventSleepWhileRunning.label")}',
  );
  const enterBehaviorIndex = generalSectionSource.indexOf('label={t("settings.general.enterBehavior.label", {');
  const speedIndex = generalSectionSource.indexOf('label={t("settings.agent.speed.label")}');
  const followUpIndex = generalSectionSource.indexOf('label={t("settings.general.followUpQueueMode.label")}');
  const reviewIndex = generalSectionSource.indexOf('label={t("settings.general.reviewDelivery.label")}');
  const ambientIndex = generalSectionSource.indexOf('label={t("settings.agent.ambientSuggestions.groupTitle")}');
  const externalImportIndex = generalSectionSource.indexOf(
    't("settings.general.importExternalAgent.importedRowLabel")',
  );

  assert.ok(openTargetIndex >= 0);
  assert.ok(agentEnvironmentIndex > openTargetIndex);
  assert.ok(terminalShellIndex > agentEnvironmentIndex);
  assert.ok(languageIndex > terminalShellIndex);
  assert.ok(macMenuBarIndex > languageIndex);
  assert.ok(hotkeyWindowIndex > macMenuBarIndex);
  assert.ok(preventSleepIndex > hotkeyWindowIndex);
  assert.ok(enterBehaviorIndex > preventSleepIndex);
  assert.ok(speedIndex > enterBehaviorIndex);
  assert.ok(followUpIndex > speedIndex);
  assert.ok(reviewIndex > followUpIndex);
  assert.ok(ambientIndex > reviewIndex);
  assert.ok(externalImportIndex > ambientIndex);

  assert.doesNotMatch(
    generalSectionSource,
    /<\/SettingsSurface>\s*<SettingsSurface>/,
  );
});

test("general settings keeps extracted permissions link owner and dictation gating", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(
    source,
    /renderInlineLinkMessage\(\s*t\("settings\.agent\.permissionsMode\.autoReview\.description"\),\s*PERMISSIONS_MODE_LEARN_MORE_URL,\s*"inline-flex text-token-text-link-foreground",\s*\)/s,
  );
  assert.match(
    source,
    /renderInlineLinkMessage\(\s*t\("settings\.agent\.permissionsMode\.fullAccess\.description"\),\s*PERMISSIONS_MODE_LEARN_MORE_URL,\s*"inline-flex text-token-text-link-foreground",\s*\)/s,
  );
  assert.match(
    source,
    /const showDictationSettings =\s*useReplicaStatsigGateValue\(REPLICA_STATSIG_GATES\.dictationPrimary\) &&\s*useReplicaStatsigGateValue\(REPLICA_STATSIG_GATES\.dictationSecondary\);/,
  );
  assert.match(
    source,
    /const showGlobalDictationHotkeys =\s*showDictationSettings &&\s*!useReplicaStatsigGateValue\(REPLICA_STATSIG_GATES\.hotkeyWindowSuppress\);/,
  );

  const dictationSectionMatch = source.match(
    /<SettingsGroup className="gap-2">\s*<SettingsGroup\.Header title=\{t\("settings\.general\.dictation"\)\} \/>\s*<SettingsSurface>([\s\S]*?)<\/SettingsSurface>\s*<\/SettingsGroup>/,
  );
  assert.ok(dictationSectionMatch);
  const dictationSectionSource = dictationSectionMatch[1];

  const holdHotkeyIndex = dictationSectionSource.indexOf(
    'label={t("settings.general.globalDictationHotkey.label")}',
  );
  const toggleHotkeyIndex = dictationSectionSource.indexOf(
    'label={t("settings.general.globalDictationToggleHotkey.label")}',
  );
  const dictionaryIndex = dictationSectionSource.indexOf("<DictationDictionarySetting");
  const historyIndex = dictationSectionSource.indexOf("<GlobalDictationHistorySetting");

  assert.ok(holdHotkeyIndex >= 0);
  assert.ok(toggleHotkeyIndex > holdHotkeyIndex);
  assert.ok(dictionaryIndex > toggleHotkeyIndex);
  assert.ok(historyIndex > dictionaryIndex);
});

test("general settings keeps extracted ambient eligibility and App authSnapshot wiring", () => {
  const componentSource = readSource(COMPONENT_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);

  assert.match(
    componentSource,
    /const showAmbientSuggestionsSetting =\s*useReplicaStatsigGateValue\(REPLICA_STATSIG_GATES\.ambientSuggestions\) &&\s*isAmbientSuggestionsEligible\(authSnapshot \?\? null, accountInfo\);/,
  );
  assert.match(componentSource, /function isAmbientSuggestionsEligible\(/);
  assert.match(
    appSource,
    /<GeneralSettings[\s\S]*authSnapshot=\{authSnapshot\}[\s\S]*codexHome=\{codexHome\}[\s\S]*workspaceRoot=\{settingsWorkspaceRoot\}/,
  );
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
