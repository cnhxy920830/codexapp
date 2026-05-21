import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("settings shell keeps app and host navigation group order from the extracted owner", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /const settingsAppGroupSectionOrder: SettingsSection\[] = \[\s*"general-settings",\s*"account",\s*"appearance",\s*"connections",\s*"git-settings",\s*"usage",\s*\];/s,
  );
  assert.match(
    source,
    /const settingsHostGroupSectionOrder: SettingsSection\[] = \[\s*"agent",\s*"personalization",\s*"keyboard-shortcuts",\s*"mcp-settings",\s*"hooks-settings",\s*"browser-use",\s*"computer-use",\s*"local-environments",\s*"worktrees",\s*"data-controls",\s*\];/s,
  );
});

test("settings shell drives section selection through /settings routes instead of local-only state changes", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /onClick=\{\(\) => \{\s*void handleNavigateToRoute\(`\/settings\/\$\{item\.id\}`,\s*window\.history\.state\);\s*\}\}/s,
  );
  assert.match(
    source,
    /void handleNavigateToRoute\(`\/settings\/\$\{firstVisibleSettingsSection\}`\);/s,
  );
  assert.match(source, /void handleNavigateToRoute\("\/settings\/general-settings"\);/);
  assert.match(source, /void handleNavigateToRoute\("\/settings\/data-controls"\);/);
});

test("settings shell uses extracted visibility gates for hooks, keyboard shortcuts, browser use, and computer use", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /const keyboardShortcutsSettingsVisible = useReplicaStatsigGateValue\(\s*REPLICA_STATSIG_GATES\.hotkeyWindowSuppress,\s*\);/s,
  );
  assert.match(
    source,
    /const browserUseSettingsVisible = useReplicaStatsigGateValue\(\s*REPLICA_STATSIG_GATES\.browserUse,\s*\);/s,
  );
  assert.match(
    source,
    /const browserUseExternalSettingsVisible = useReplicaStatsigGateValue\(\s*REPLICA_STATSIG_GATES\.browserUseExternal,\s*\);/s,
  );
  assert.match(
    source,
    /const computerUseSettingsVisible = useReplicaStatsigGateValue\(\s*REPLICA_STATSIG_GATES\.computerUse,\s*\);/s,
  );
  assert.match(source, /void listExperimentalFeaturesForHost\(selectedSettingsHostId\)/);
  assert.match(source, /const browserUseFeature = features\.find\(\(feature\) => feature\.name === "browser_use"\);/);
  assert.match(
    source,
    /const browserUseExternalFeature = features\.find\(\s*\(feature\) => feature\.name === "browser_use_external",\s*\);/s,
  );
  assert.match(source, /const computerUseFeature = features\.find\(\(feature\) => feature\.name === "computer_use"\);/);
  assert.match(source, /const hooksFeature = features\.find\(\(feature\) => feature\.name === "hooks"\);/);
  assert.match(source, /const pluginHooksFeature = features\.find\(\(feature\) => feature\.name === "plugin_hooks"\);/);
  assert.match(
    source,
    /\(item\.id !== "keyboard-shortcuts" \|\| keyboardShortcutsSettingsVisible\) &&\s*\(item\.id !== "hooks-settings" \|\| areSettingsHooksVisible\)/s,
  );
  assert.match(
    source,
    /\(item\.id !== "browser-use" \|\| isBrowserUseSettingsNavVisible\) &&\s*\(item\.id !== "computer-use" \|\| isComputerUseSettingsNavVisible\)/s,
  );
  assert.doesNotMatch(source, /item\.id !== "hooks-settings" &&/);
  assert.doesNotMatch(source, /\(item\.id !== "browser-use" \|\| selectedSettingsHostId === LOCAL_SETTINGS_HOST_ID\)/);
  assert.doesNotMatch(source, /\(item\.id !== "computer-use" \|\| hasComputerUseApprovalStore\)/);
});
