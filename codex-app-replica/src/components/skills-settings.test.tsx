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
const APP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/App.tsx",
);

test("skills settings keeps extracted settings wrapper ownership", () => {
  const source = readSource(SETTINGS_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout>\s*<SkillsRoutePage/s);
  assert.doesNotMatch(source, /initialTab="skills"/);
  assert.doesNotMatch(source, /isPluginsRouteEnabled=\{false\}/);
  assert.doesNotMatch(source, /onConsumeInitialState=\{\(\) => undefined\}/);
  assert.doesNotMatch(source, /fullWidth/);
  assert.doesNotMatch(source, /contentClassName="max-w-none"/);
  assert.doesNotMatch(source, /min-h-0 flex-1 overflow-hidden/);
});

test("skills route keeps extracted settings-page toolbar and section order", () => {
  const source = readSource(ROUTE_SOURCE_PATH);

  assert.match(source, /<ThreadPageHeader/);
  assert.match(source, /document\.documentElement\.dataset\.hideHeaderDivider = "true"/);
  assert.match(source, /useElementVisibility/);
  assert.match(source, /isPluginsRouteEnabled = false/);
  assert.match(source, /onConsumeInitialState = noop/);
  assert.match(source, /<SettingsHostDropdown/);
  assert.match(source, /<RefreshSkillsButton/);
  assert.match(source, /<Button\s+color="primary"/);
  assert.match(source, /placeholder=\{t\("skills\.page\.search"\)\}/);
  assert.match(source, /disabled=\{skillCreatorPath == null\}/);
  assert.match(source, /renderInlineLinkMessage\(t\("skills\.page\.subheading"\), SKILLS_DOCS_URL\)/);
  assert.match(source, /\[container-type:inline-size\]/);
  assert.match(source, /skills-page-card-grid grid gap-4/);
  assert.match(source, /<LargeEmptyState/);
  assert.match(source, /<SkillsLargeEmptyState title=\{t\("skills\.page\.loading"\)\}/);

  const installedSectionIndex = source.indexOf('title={t("skills.section.installed")}');
  const recommendedSectionIndex = source.indexOf('title={t("skills.section.recommended")}');
  assert.ok(installedSectionIndex >= 0);
  assert.ok(recommendedSectionIndex > installedSectionIndex);

  assert.match(source, /connectedRemoteConnections\.length > 0 && remoteConnectionHostIds\.length > 0/);
  assert.match(source, /setHasPendingSkillRefresh\(false\)/);
  assert.match(source, /isDisabled=\{isSkillsLoading\}/);
  assert.doesNotMatch(source, /isDisabled=\{isSkillsLoading \|\| isRecommendedSkillsLoading\}/);
  assert.match(source, /await markSkillsUpdated\(\);\s*await refreshRecommendedSkills\(true\);\s*setHasPendingSkillRefresh\(false\);/s);
  assert.match(source, /onSkillsUpdated=\{async \(\) => \{\s*await markSkillsUpdated\(\);\s*\}\}/s);
  assert.match(source, /await markSkillsUpdated\(\);\s*await refreshRecommendedSkills\(true\);\s*setHasPendingSkillRefresh\(true\);/s);
  assert.match(source, /message: t\("skills\.recommended\.installSuccess", \{\s*skillName: skill\.name,\s*\}\)/s);
  assert.doesNotMatch(source, /Promise\.all\(\[refreshSkills\(true\), refreshRecommendedSkills\(true\)\]\)/);
  assert.doesNotMatch(source, /function SkillsRouteHostDropdown/);
  assert.doesNotMatch(source, /function RegenerateIcon/);
  assert.doesNotMatch(source, /refreshFailed/);
});

test("skills settings keeps extracted shared chat bridge without startInSidebar plumbing", () => {
  const routeSource = readSource(ROUTE_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);

  assert.match(routeSource, /onOpenChatWithPrompt\(\{\s*prompt,\s*\}\)/s);
  assert.doesNotMatch(appSource, /startInSidebar/);
  assert.match(
    appSource,
    /settingsSection === "skills-settings"[\s\S]*onOpenChatWithPrompt=\{\(\{ cwd, prompt \}\) =>[\s\S]*openNewConversation\(\{[\s\S]*cwd,[\s\S]*focusComposerNonce: Date\.now\(\),[\s\S]*prefillPrompt: prompt,[\s\S]*\}\)/s,
  );
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
