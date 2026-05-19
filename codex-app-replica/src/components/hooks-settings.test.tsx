/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/HooksSettings.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");

test("hooks settings keeps extracted shared shell ownership", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /import \{ SettingsSurface \} from "\.\/SettingsSurface";/);
  assert.match(source, /renderInlineLinkMessage\(t\("settings\.hooks\.subtitle"\), HOOKS_DOCS_URL\)/);
  assert.match(source, /<Button[\s\S]*color="ghost"[\s\S]*size="icon"[\s\S]*uniform[\s\S]*<RefreshIcon className="icon-xs" \/>/);
  assert.doesNotMatch(source, /function renderHooksSubtitle/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
});

test("hooks settings uses extracted remote project-root source and context default", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /readSettingsRemoteProjectsSnapshot/);
  assert.match(source, /REMOTE_PROJECTS_SHARED_OBJECT_KEY/);
  assert.match(source, /onSharedObjectUpdated/);
  assert.match(source, /const defaultProjectRoot = isRemoteHost\s*\?\s*settingsCwd\s*:\s*activeProjectRoots\[0\] \?\? settingsCwd;/);
  assert.match(source, /remoteProjects\.filter\(\(project\) => project\.hostId === selectedHostId\)/);
  assert.match(source, /Object\.fromEntries\(\s*remoteProjectsForSelectedHost\.map\(\(project\) => \[project\.remotePath, project\.label\]\)/s);
});

test("hooks settings keeps extracted hook-row visibility affordance and app context wiring", () => {
  const componentSource = readSource(COMPONENT_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);

  assert.match(componentSource, /has-\[\[data-state=open\]\]:visible has-\[\[data-state=open\]\]:opacity-100/);
  assert.match(componentSource, /data-state=\{isOpen \? "open" : "closed"\}/);
  assert.match(appSource, /<HooksSettings[\s\S]*settingsCwd=\{settingsCwd\}[\s\S]*selectedHostId=\{selectedSettingsHostId\}/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
