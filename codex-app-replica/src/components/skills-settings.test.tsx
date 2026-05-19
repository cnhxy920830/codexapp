/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SETTINGS_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/SkillsSettings.tsx",
);
const ROUTE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/skills/SkillsRoutePage.tsx",
);

test("skills settings keeps extracted settings wrapper ownership", () => {
  const source = readSource(SETTINGS_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout>\s*<SkillsRoutePage/s);
  assert.match(source, /initialTab="skills"/);
  assert.match(source, /isPluginsRouteEnabled=\{false\}/);
  assert.doesNotMatch(source, /fullWidth/);
  assert.doesNotMatch(source, /contentClassName="max-w-none"/);
  assert.doesNotMatch(source, /min-h-0 flex-1 overflow-hidden/);
});

test("skills route keeps extracted settings-page toolbar and section order", () => {
  const source = readSource(ROUTE_SOURCE_PATH);

  assert.match(source, /<ThreadPageHeader/);
  assert.match(source, /document\.documentElement\.dataset\.hideHeaderDivider = "true"/);
  assert.match(source, /useElementVisibility/);
  assert.match(source, /<SettingsHostDropdown/);
  assert.match(source, /<RefreshSkillsButton/);
  assert.match(source, /<Button\s+color="primary"/);
  assert.match(source, /placeholder=\{t\("skills\.page\.search"\)\}/);
  assert.match(source, /disabled=\{skillCreatorPath == null\}/);
  assert.match(source, /renderInlineLinkMessage\(t\("skills\.page\.subheading"\), SKILLS_DOCS_URL\)/);

  const installedSectionIndex = source.indexOf('title={t("skills.section.installed")}');
  const recommendedSectionIndex = source.indexOf('title={t("skills.section.recommended")}');
  assert.ok(installedSectionIndex >= 0);
  assert.ok(recommendedSectionIndex > installedSectionIndex);

  assert.match(source, /connectedRemoteConnections\.length > 0 && remoteConnectionHostIds\.length > 0/);
  assert.match(source, /setHasPendingSkillRefresh\(false\)/);
  assert.doesNotMatch(source, /function SkillsRouteHostDropdown/);
  assert.doesNotMatch(source, /function RegenerateIcon/);
  assert.doesNotMatch(source, /refreshFailed/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
