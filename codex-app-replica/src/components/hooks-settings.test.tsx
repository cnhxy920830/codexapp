/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/HooksSettings.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");

test("hooks settings keeps extracted shared shell ownership", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /import \{ SettingsSectionTitle \} from "\.\/SettingsSectionTitle";/);
  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /import \{ SettingsSurface \} from "\.\/SettingsSurface";/);
  assert.match(source, /title=\{<SettingsSectionTitle slug="hooks-settings" \/>\}/);
  assert.match(
    source,
    /renderInlineLinkMessage\(\s*t\("settings\.hooks\.subtitle"\),\s*HOOKS_DOCS_URL,\s*"inline-flex text-token-text-link-foreground",\s*\)/s,
  );
  assert.match(source, /<Tooltip tooltipContent=\{t\("settings\.hooks\.refresh"\)\}>/);
  assert.match(source, /<Button[\s\S]*color="ghost"[\s\S]*size="icon"[\s\S]*uniform[\s\S]*<RefreshIcon className="icon-xs" \/>/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
});

test("hooks settings uses extracted remote project-root source and context default", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /getGlobalState\("active-remote-project-id"\)/);
  assert.match(source, /onGlobalStateUpdated/);
  assert.match(source, /setActiveRemoteProjectId\(normalizeOptionalGlobalStateString\(response\.value\)\);/);
  assert.match(source, /readSettingsRemoteProjectsSnapshot/);
  assert.match(source, /REMOTE_PROJECTS_SHARED_OBJECT_KEY/);
  assert.match(source, /onSharedObjectUpdated/);
  assert.match(source, /const selectedRemoteProject = useMemo\(\(\) => \{/);
  assert.match(source, /remoteProjects\.find\(\(project\) => project\.id === activeRemoteProjectId\) \?\? null/);
  assert.match(
    source,
    /const defaultProjectRoot = isRemoteHost\s*\?\s*selectedRemoteProject\?\.hostId === selectedHostId\s*\?\s*selectedRemoteProject\.remotePath\s*:\s*null\s*:\s*activeProjectRoots\[0\] \?\? null;/s,
  );
  assert.match(source, /remoteProjects\.filter\(\(project\) => project\.hostId === selectedHostId\)/);
  assert.match(source, /Object\.fromEntries\(\s*remoteProjectsForSelectedHost\.map\(\(project\) => \[project\.remotePath, project\.label\]\)/s);
});

test("hooks settings keeps extracted project-name fallback helper for path labels", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /return projectRootLabels\[projectRoot\] \?\? deriveProjectName\(projectRoot\) \?\? projectRoot;/);
  assert.match(source, /const trimmedProjectRoot = projectRoot\.trim\(\);/);
  assert.match(source, /const segments = trimmedProjectRoot\.split\(\/\[\/\\\\\]\+\/\)\.filter\(Boolean\);/);
  assert.match(source, /return trimProjectName\(segments\.at\(-1\) \?\? trimmedProjectRoot\);/);
  assert.match(source, /const words = trimmedValue\.split\(\/\\s\+\/\)\.filter\(Boolean\);/);
  assert.match(source, /return words\.length <= 3 \? trimmedValue : words\.slice\(0, 3\)\.join\(" "\);/);
});

test("hooks settings keeps extracted hook-row visibility affordance and app context wiring", () => {
  const componentSource = readSource(COMPONENT_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);

  assert.match(componentSource, /has-\[\[data-state=open\]\]:visible has-\[\[data-state=open\]\]:opacity-100/);
  assert.match(componentSource, /data-state=\{dropdown\.isOpen \? "open" : "closed"\}/);
  assert.match(componentSource, /<Tooltip delayDuration=\{0\} tooltipContent=\{t\("settings\.hooks\.event\.managedTooltip"\)\}>/);
  assert.match(componentSource, /className="w-\[240px\] justify-between"/);
  assert.match(componentSource, /<ChevronDownIcon className="icon-2xs shrink-0 text-token-input-placeholder-foreground" \/>/);
  assert.match(componentSource, /<MoreActionsIcon className="icon-xs" \/>/);
  assert.match(appSource, /<HooksSettings[\s\S]*settingsCwd=\{settingsCwd\}[\s\S]*selectedHostId=\{selectedSettingsHostId\}/);
});

test("hooks settings project selector and row actions follow extracted shared dropdown semantics", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);

  assert.match(source, /function useHooksDropdownMenu\(\)/);
  assert.match(source, /aria-controls=\{dropdown\.isOpen \? menuId : undefined\}/);
  assert.match(source, /aria-expanded=\{dropdown\.isOpen\}/);
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
  assert.match(source, /const closeMenu = \(options\?: \{ restoreFocus\?: boolean \}\) => \{/);
  assert.match(source, /if \(options\?\.restoreFocus\) \{\s*triggerRef\.current\?\.focus\(\);\s*\}/s);
  assert.match(source, /dropdown\.closeMenu\(\{ restoreFocus: true \}\);/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
