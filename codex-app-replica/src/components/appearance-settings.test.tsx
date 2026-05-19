/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const APPEARANCE_SOURCE_PATH = path.join(process.cwd(), "src/components/AppearanceSettings.tsx");
const THEME_EDITOR_SOURCE_PATH = path.join(process.cwd(), "src/components/appearance/ThemeEditorCard.tsx");
const PETS_SOURCE_PATH = path.join(process.cwd(), "src/components/appearance/PetsSection.tsx");

test("appearance settings keeps extracted page shell and section order", () => {
  const source = readSource(APPEARANCE_SOURCE_PATH);

  assert.match(source, /SettingsContentLayout title=\{<SettingsSectionTitle slug="appearance" \/>\}/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Content>\s*<SettingsSurface>/s);
  assert.match(source, /<div className="flex flex-col gap-2 p-1">/);
  assert.match(source, /<ThemePreviewCard theme=\{previewTheme\} variant=\{previewVariant\} \/>/);
  assert.match(source, /showCodeFont=\{showCodeFont\}/);

  const themeIndex = source.indexOf('label={t("settings.general.appearance.theme")}');
  const previewIndex = source.indexOf('<ThemePreviewCard theme={previewTheme} variant={previewVariant} />');
  const pointerIndex = source.indexOf('label={t("settings.general.appearance.usePointerCursors.label")}');
  const uiFontIndex = source.indexOf('label={t("settings.general.appearance.sansFontSize.row")}');
  const codeFontIndex = source.indexOf('label={t("settings.general.appearance.codeFontSize.row")}');
  const smoothingIndex = source.indexOf('label={t("settings.general.appearance.fontSmoothing.label")}');

  assert.ok(themeIndex >= 0);
  assert.ok(previewIndex > themeIndex);
  assert.ok(pointerIndex > previewIndex);
  assert.ok(uiFontIndex > pointerIndex);
  assert.ok(codeFontIndex > uiFontIndex);
  assert.ok(smoothingIndex > codeFontIndex);
});

test("appearance settings uses extracted detail-mode and segmented toggle ownership", () => {
  const source = readSource(APPEARANCE_SOURCE_PATH);

  assert.match(source, /const showCodeFont = state\.conversationDetailMode === "STEPS_COMMANDS";/);
  assert.match(source, /<div className="inline-flex items-center gap-0\.5" role="group" aria-label=\{ariaLabel\}>/);
  assert.match(source, /color=\{selected \? "secondary" : "ghost"\}/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
});

test("theme editor keeps extracted shared button shell and nested settings rows", () => {
  const source = readSource(THEME_EDITOR_SOURCE_PATH);

  assert.match(source, /import \{ Button \} from "\.\.\/Button";/);
  assert.match(source, /import \{ SettingsRow \} from "\.\.\/SettingsRow";/);
  assert.match(source, /showCodeFont \? \(/);
  assert.match(source, /<Button[\s\S]*color="ghost"[\s\S]*size="toolbar"[\s\S]*settings\.general\.appearance\.chromeTheme\.import/s);
  assert.match(
    source,
    /<SettingsRow[\s\S]*label=\{t\("settings\.general\.appearance\.chromeTheme\.accent\.short"\)\}[\s\S]*variant="nested"/s,
  );
  assert.doesNotMatch(source, /function EditorRow\(/);
});

test("pets section keeps extracted shared shells, controls, and expanded container wiring", () => {
  const source = readSource(PETS_SOURCE_PATH);

  assert.match(source, /import \{ Button \} from "\.\.\/Button";/);
  assert.match(source, /import \{ SettingsGroup \} from "\.\.\/SettingsGroup";/);
  assert.match(source, /import \{ SettingsRow \} from "\.\.\/SettingsRow";/);
  assert.match(source, /import \{ SettingsSurface \} from "\.\.\/SettingsSurface";/);
  assert.match(source, /import \{ Spinner \} from "\.\.\/Spinner";/);
  assert.match(source, /aria-controls=\{contentId\}/);
  assert.match(source, /id=\{contentId\} className="flex flex-col divide-y divide-token-border bg-token-bg-secondary\/20"/);
  assert.match(source, /<Button[\s\S]*color="secondary"[\s\S]*loading=\{isCreatingCustomAvatar\}[\s\S]*size="toolbar"/s);
  assert.match(source, /<Button color="ghost" onClick=\{onOpenFolder\} size="toolbar">/);
  assert.match(source, /<SettingsRow[\s\S]*icon=\{<AvatarSprite avatar=\{avatar\} size="sm" \/>\}/s);
  assert.doesNotMatch(source, /function ToolbarButton\(/);
  assert.doesNotMatch(source, /function InlineSpinner\(/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
