/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const APPEARANCE_SOURCE_PATH = path.join(process.cwd(), "src/components/AppearanceSettings.tsx");
const THEME_EDITOR_SOURCE_PATH = path.join(process.cwd(), "src/components/appearance/ThemeEditorCard.tsx");
const COLOR_INPUT_SOURCE_PATH = path.join(process.cwd(), "src/components/appearance/ChromeThemeColorInput.tsx");
const THEME_PREVIEW_SOURCE_PATH = path.join(process.cwd(), "src/components/appearance/ThemePreviewCard.tsx");
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

test("appearance settings number inputs keep extracted parseFloat commit behavior", () => {
  const source = readSource(APPEARANCE_SOURCE_PATH);

  assert.match(source, /const parsed = Number\.parseFloat\(draft\);/);
  assert.match(source, /setDraft\(String\(parsed\)\);/);
  assert.match(source, /if \(parsed !== fallback\) \{\s*onCommit\(parsed\);/s);
  assert.doesNotMatch(source, /Math\.round/);
  assert.doesNotMatch(source, /Math\.min/);
  assert.doesNotMatch(source, /Math\.max/);
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
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /const handleKeyDown = \(event: KeyboardEvent\) => \{/);
  assert.match(source, /if \(event\.key === "Escape"\)/);
  assert.match(source, /<Button color="ghost" size="toolbar" onClick=\{\(\) => onOpenChange\(false\)\}>/);
  assert.match(source, /<Button[\s\S]*size="toolbar"[\s\S]*settings\.general\.appearance\.chromeTheme\.import\.dialog\.submit/s);
  assert.doesNotMatch(source, /function EditorRow\(/);
});

test("theme color input replaces native color control with extracted popover picker structure", () => {
  const source = readSource(COLOR_INPUT_SOURCE_PATH);

  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /className="h-3\.5 w-3\.5 shrink-0 rounded-full disabled:cursor-default"/);
  assert.match(source, /className="min-w-0 flex-1 bg-transparent text-xs uppercase tabular-nums outline-hidden disabled:cursor-default"/);
  assert.match(source, /className="h-34 w-34"/);
  assert.match(source, /setDraftValue\(null\);/);
  assert.match(source, /if \(event\.key !== "Escape"\)/);
  assert.match(source, /className="react-colorful__saturation/);
  assert.match(source, /className="react-colorful__hue react-colorful__last-control/);
  assert.match(source, /className="react-colorful__interactive absolute inset-0/);
  assert.match(source, /function hsvaToHex/);
  assert.match(source, /function hexToHsva/);
  assert.doesNotMatch(source, /className="app-control h-9 w-full rounded-\[10px\] px-3 font-mono text-\[13px\] uppercase"/);
  assert.doesNotMatch(source, /type="color"/);
});

test("code theme picker follows extracted shared dropdown semantics", () => {
  const source = readSource(path.join(process.cwd(), "src/components/appearance/CodeThemePicker.tsx"));

  assert.match(source, /const menuId = `code-theme-picker-menu-\$\{variant\}`;/);
  assert.match(source, /aria-controls=\{isOpen \? menuId : undefined\}/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /if \(event\.key !== "ArrowDown" && event\.key !== "Enter" && event\.key !== " "\)/);
  assert.match(source, /shouldFocusFirstItemRef\.current = true;[\s\S]*setIsOpen\(true\);/s);
  assert.match(source, /role="menu"/);
  assert.match(source, /aria-orientation="vertical"/);
  assert.match(source, /role="menuitem"/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /event\.currentTarget\.focus\(\{ preventScroll: true \}\);/);
  assert.match(source, /if \(event\.key === "Home"\)/);
  assert.match(source, /if \(event\.key === "End"\)/);
  assert.match(source, /if \(event\.key === "ArrowUp"\)/);
  assert.match(source, /if \(event\.key === "ArrowDown"\)/);
  assert.match(source, /if \(event\.key === "Escape"\)/);
  assert.match(source, /if \(event\.key === "Tab"\)/);
});

test("theme preview uses split diff-style preview rows instead of hand-built before-after panes", () => {
  const source = readSource(THEME_PREVIEW_SOURCE_PATH);

  assert.match(source, /const THEME_PREVIEW_PATCH = `--- a\/src\/theme-preview\.ts/);
  assert.match(source, /pairDiffBlock\(\s*additions\.map\(\(line\) => line\.text\),\s*deletions\.map\(\(line\) => line\.text\),\s*PREVIEW_OPTIONS,\s*\)/s);
  assert.match(source, /grid-cols-\[4\.5rem_minmax\(0,1fr\)_4\.5rem_minmax\(0,1fr\)\]/);
  assert.match(source, /function parseHunkHeader\(text: string\)/);
  assert.match(source, /leftLineNumber: deletion\?\.lineNumber \?\? null/);
  assert.match(source, /rightLineNumber: addition\?\.lineNumber \?\? null/);
  assert.match(source, /data-testid="theme-preview"/);
  assert.doesNotMatch(source, /BEFORE_PREVIEW_LINES/);
  assert.doesNotMatch(source, /AFTER_PREVIEW_LINES/);
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
  assert.match(source, /readRecommendedSkills\(\{\s*hostId: LOCAL_SETTINGS_HOST_ID,/s);
  assert.match(source, /installRecommendedSkill\(\{\s*hostId: LOCAL_SETTINGS_HOST_ID,/s);
  assert.match(source, /findInstalledSkillByName\(HATCH_PET_SKILL_NAME, true\)/);
  assert.match(source, /skill\.name\.toLowerCase\(\) === normalizedName/);
  assert.match(source, /skill\.name\.toLowerCase\(\)\.endsWith\(`:\$\{normalizedName\}`\)/);
  assert.match(source, /return `\[\$\$\{name\}\]\(\$\{normalizedSkillPath\}\)`;/);
  assert.doesNotMatch(source, /function ToolbarButton\(/);
  assert.doesNotMatch(source, /function InlineSpinner\(/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
