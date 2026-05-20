/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/KeyboardShortcutsSettings.tsx",
);
const TOOLTIP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/Tooltip.tsx",
);
const SERVICE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/services/keyboardShortcuts.ts",
);
const RUST_SOURCE_PATH = path.join(
  process.cwd(),
  "src-tauri/src/keyboard_shortcuts.rs",
);

test("keyboard shortcuts settings route stays registered under settings nav", () => {
  const source = readSource(APP_SOURCE_PATH);

  assert.match(
    source,
    /\{ id: "keyboard-shortcuts" as const, labelKey: "settings\.nav\.keyboard-shortcuts" as const \}/,
  );
  assert.match(
    source,
    /if \(settingsSection === "keyboard-shortcuts"\) \{\s*return <KeyboardShortcutsSettings \/>;\s*\}/s,
  );
});

test("keyboard shortcuts page keeps extracted layout, loading gate, and row-owner structure", () => {
  const source = readSource(PAGE_SOURCE_PATH);

  assert.match(
    source,
    /<SettingsContentLayout\s+title=\{<SettingsSectionTitle slug="keyboard-shortcuts" \/>\}\s*>/s,
  );
  assert.match(
    source,
    /keymapState == null \? null : \(\s*<input/s,
  );
  assert.match(
    source,
    /<SettingsSurface className="overflow-hidden">/,
  );
  assert.match(
    source,
    /filteredCommands\.length === 0 \?\s*\(\s*<tr>/s,
  );
  assert.match(
    source,
    /const displayEntries =\s*isAppending && shortcutEntries\.length > 0\s*\?\s*\[\.\.\.shortcutEntries, null\]\s*:\s*shortcutEntries\.length === 0\s*\?\s*\[null\]\s*:\s*shortcutEntries;/s,
  );
  assert.match(
    source,
    /const rowPaddingClass = isPrimaryRow\s*\?\s*"px-4 pt-2 pb-1"\s*:\s*"px-4 pt-1 pb-2";/s,
  );
  assert.match(
    source,
    /isPrimaryRow && commandIndex > 0\s*\?\s*"group border-t border-token-border align-middle"\s*:\s*"group align-middle"/s,
  );
  assert.match(
    source,
    /<colgroup>\s*<col \/>\s*<col className="w-64" \/>\s*<col className="w-32" \/>\s*<\/colgroup>/s,
  );
  assert.match(
    source,
    /import\s+\{\s*Tooltip,\s*TooltipKeycap\s*\}\s+from\s+"\.\/Tooltip";/,
  );
});

test("keyboard shortcuts capture field keeps extracted shortcut-capture interaction contract", () => {
  const source = readSource(PAGE_SOURCE_PATH);

  assert.match(source, /data-codex-shortcut-capture/);
  assert.match(source, /autoFocus/);
  assert.match(source, /readOnly/);
  assert.match(
    source,
    /if \(event\.repeat\) \{\s*return;\s*\}/s,
  );
  assert.match(
    source,
    /if \(event\.key === "Escape"\) \{\s*cancelCapture\(\);\s*return;\s*\}/s,
  );
  assert.match(source, /buildModifierOnlyAccelerator\(/);
  assert.match(source, /buildAcceleratorFromKeyboardEvent\(/);
  assert.match(
    source,
    /pendingModifierAcceleratorRef\.current === modifierOnlyAccelerator/s,
  );
});

test("keyboard shortcuts page keeps extracted frontend query and Tauri persistence bridge", () => {
  const serviceSource = readSource(SERVICE_SOURCE_PATH);
  const rustSource = readSource(RUST_SOURCE_PATH);

  assert.match(
    serviceSource,
    /export const COMMAND_KEYMAP_STATE_QUERY_KEY = \["codex-command-keymap-state"\] as const;/,
  );
  assert.match(
    serviceSource,
    /invoke<CommandKeymapState>\("get_command_keymap_state"\)/,
  );
  assert.match(
    serviceSource,
    /invoke<CommandKeymapState>\("set_command_keybinding",\s*\{/s,
  );
  assert.match(
    serviceSource,
    /emitQueryCacheInvalidated\(COMMAND_KEYMAP_STATE_QUERY_KEY\)/,
  );

  assert.match(
    rustSource,
    /const COMMAND_KEYMAP_STATE_FILE_NAME: &str = "command-keymap-state\.json";/,
  );
  assert.match(rustSource, /#\[tauri::command\]\s*pub fn get_command_keymap_state/s);
  assert.match(rustSource, /#\[tauri::command\]\s*pub fn set_command_keybinding/s);
  assert.match(rustSource, /fs::read_to_string\(&path\)/);
  assert.match(rustSource, /fs::write\(&path, payload\)/);
});

test("keyboard shortcuts page reuses shared tooltip and keycap owners instead of page-local copies", () => {
  const pageSource = readSource(PAGE_SOURCE_PATH);
  const tooltipSource = readSource(TOOLTIP_SOURCE_PATH);

  assert.match(pageSource, /<TooltipKeycap keysLabel=\{shortcutLabel\} \/>/);
  assert.match(pageSource, /<Tooltip tooltipContent=\{ariaLabel\}>/);
  assert.doesNotMatch(pageSource, /function ShortcutTooltip/);

  assert.match(tooltipSource, /export function TooltipKeycap/);
  assert.match(
    tooltipSource,
    /variant === "button"\s*\?\s*"h-4 min-w-4 items-center justify-center !px-1\.5 !py-0 !leading-4"\s*:\s*"!px-1\.5 !py-0\.5 !leading-none"/s,
  );
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
