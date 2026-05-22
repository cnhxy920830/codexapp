/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/LocalEnvironmentsSettings.tsx",
);

test("local environments page keeps extracted select, preview, and editor owner split", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /<WorkspaceSelectionCard/);
  assert.match(source, /<LocalEnvironmentPreview/);
  assert.match(source, /<LocalEnvironmentEditor/);
  assert.match(source, /title=\{<SettingsSectionTitle slug="local-environments" \/>\}/);
  assert.match(
    source,
    /renderLearnMoreDescription\(\s*t\("settings\.localEnvironments\.workspaceSelect\.description"\),\s*t\("settings\.localEnvironments\.workspaceSelect\.learnMore"\),\s*\)/,
  );
});

test("workspace selection cards keep extracted add button and inherited accordion affordance", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /aria-label=\{t\("settings\.localEnvironments\.workspaceSelect\.addLabel"\)\}/);
  assert.match(source, /className="w-9 justify-center"/);
  assert.match(source, /<PlusIcon className="icon-xs" \/>/);
  assert.match(source, /settings\.localEnvironments\.workspaceSelect\.inherited/);
  assert.match(source, /isExpanded \? "rotate-180" : ""/);
  assert.doesNotMatch(source, /selectedWorkspaceRoot=/);
  assert.match(source, /if \(preferredProjectEntry\) {\s*onSelectEnvironment\(workspaceRoot, preferredProjectEntry\.configPath\);/);
  assert.doesNotMatch(
    source,
    /if \(preferredProjectEntry\) {\s*onSelectEnvironment\(workspaceRoot, preferredProjectEntry\.configPath\);\s*}\s*setIsExpanded\(\(current\) => !current\);/,
  );
});

test("workspace selection subtitle keeps a dedicated localized learn-more label instead of hard-coded english splitting", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /function renderLearnMoreDescription\(description: string, learnMoreLabel: string\)/);
  assert.match(source, /const markerIndex = description\.indexOf\(learnMoreLabel\);/);
  assert.match(source, /description\.slice\(markerIndex \+ learnMoreLabel\.length\)/);
  assert.match(source, /{\s*learnMoreLabel\s*}/);
  assert.doesNotMatch(source, /MESSAGES\["en-US"\]\["settings\.localEnvironments\.workspaceSelect\.learnMore"\]/);
  assert.doesNotMatch(source, /const marker = "Learn more\."/);
});

test("workspace selection shell keeps extracted learn-more frame during loading instead of top-level loading fallback", () => {
  const source = readSource(SOURCE_PATH);

  assert.doesNotMatch(source, /if \(isWorkspaceRootsLoading\) \{/);
  assert.match(
    source,
    /if \(isSelectProjectMode\) \{\s*return \(\s*<LocalEnvironmentsPageFrame\s+subtitle=\{renderLearnMoreDescription\(/s,
  );
  assert.match(source, /<WorkspaceSelectionCard[\s\S]*isLoading=\{isWorkspaceRootsLoading\}/);
  assert.match(
    source,
    /if \(isLoading\) \{\s*return \(\s*<SettingsGroup className="gap-2">\s*<SettingsGroup\.Header[\s\S]*actions=\{addProjectAction\}/s,
  );
  assert.match(
    source,
    /if \(groups\.length === 0\) \{\s*return \(\s*<SettingsGroup className="gap-2">\s*<SettingsGroup\.Header[\s\S]*actions=\{addProjectAction\}/s,
  );
  assert.doesNotMatch(source, /workspaceRootsErrorMessage \? <InlineError message=\{workspaceRootsErrorMessage\} \/> : null/);
});

test("remote add-project flow uses pending view action instead of immediate page-local selection changes", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /if \(isRemoteHost\) {\s*onRequestOpenRemoteProjectDialog\?\.\(\);\s*return;\s*}/);
  assert.doesNotMatch(source, /if \(isRemoteHost\) {\s*setIsRemoteProjectDialogOpen\(true\);\s*return;\s*}/);
  assert.doesNotMatch(source, /setSelectedWorkspaceRoot\(response\.project\.remotePath\);/);
  assert.doesNotMatch(source, /onUpdateRouteSearch\?\.\(\s*buildLocalEnvironmentRouteSearch\(\{\s*workspaceRoot: response\.project\.remotePath,/);
  assert.doesNotMatch(source, /onSelectHostId\?\.\(hostId\);/);
});

test("remote add-project dialog source keeps extracted validation bridge instead of simplified local-only modal semantics", () => {
  const settingsSource = readSource(SOURCE_PATH);
  const dialogSource = readSource(
    path.join(process.cwd(), "src/features/localEnvironments/RemoteProjectSetupDialog.tsx"),
  );
  const serviceSource = readSource(path.join(process.cwd(), "src/services/settingsHosts.ts"));

  assert.match(settingsSource, /remoteProjects=\{remoteProjects\}/);
  assert.match(settingsSource, /message: t\("projectSetupDialog\.saveError"\)/);

  assert.match(serviceSource, /invoke<RemoteWorkspaceDirectoryEntriesResponse>\("remote-workspace-directory-entries"/);
  assert.match(serviceSource, /export function normalizeRemoteProjectPath\(path: string\)/);

  assert.match(dialogSource, /readRemoteWorkspaceDirectoryEntries\(\{/);
  assert.match(dialogSource, /const isPickMode = mode === "pick";/);
  assert.match(dialogSource, /kind: "conflicting-remote-project"/);
  assert.match(dialogSource, /kind: "path-validation-pending"/);
  assert.match(dialogSource, /t\("projectSetupDialog\.conflict\.remoteProjectAlreadyMapped\.standalone"/);
  assert.match(dialogSource, /t\("workspaceRootDialog\.remotePlaceholder"\)/);
  assert.doesNotMatch(dialogSource, /<select/);
  assert.doesNotMatch(dialogSource, /settings\.localEnvironments\.remoteProjectDialog\./);
});

test("preview keeps extracted group order, variables popover, and summary rows", () => {
  const source = readSource(SOURCE_PATH);

  const projectGroupIndex = source.indexOf('title={t("settings.localEnvironments.workspace.title")}');
  const environmentGroupIndex = source.indexOf('title={t("settings.localEnvironments.environment.title")}');
  assert.ok(projectGroupIndex >= 0);
  assert.ok(environmentGroupIndex > projectGroupIndex);

  assert.match(source, /<ProjectSummaryCard workspaceGroup=\{workspaceGroup\} workspaceRoot=\{workspaceRoot\} \/>/);
  assert.match(source, /<LocalEnvironmentSettingsRow/);
  assert.match(source, /<SetupEnvVarsPopover \/>/);
  assert.match(source, /CODEX_SOURCE_PATH/);
  assert.match(source, /CODEX_WORKTREE_PATH/);
  assert.match(source, /<ActionSummaryRow key=\{`\$\{action\.name\}-\$\{index\}`\} action=\{action\} \/>/);
});

test("preview scripts keep extracted shared code-snippet owner instead of page-local bare pre blocks", () => {
  const settingsSource = readSource(SOURCE_PATH);
  const snippetSource = readSource(path.join(process.cwd(), "src/components/CodeSnippet.tsx"));

  assert.match(settingsSource, /import \{ CodeSnippet \} from "\.\/CodeSnippet";/);
  assert.match(
    settingsSource,
    /<CodeSnippet\s+codeContainerClassName="max-h-40"\s+content=\{script\}\s+language="bash"\s+shouldWrapCode\s+\/>/,
  );
  assert.doesNotMatch(settingsSource, /<pre className="max-h-40 overflow-x-auto whitespace-pre-wrap p-3 font-mono text-\[12px\] leading-6 text-token-text-primary">/);

  assert.match(snippetSource, /title=\{copied \? t\("copyButton\.copied"\) : t\("copyButton\.copyCode"\)\}/);
  assert.match(snippetSource, /aria-label=\{copied \? t\("copyButton\.copiedAriaLabel"\) : t\("copyButton\.copyAriaLabel"\)\}/);
  assert.match(snippetSource, /navigator\.clipboard\?\.writeText/);
  assert.match(snippetSource, /codeContainerClassName/);
  assert.match(snippetSource, /shouldWrapCode \? "whitespace-pre-wrap" : "whitespace-pre"/);
});

test("editor keeps extracted segmented controls, action platform checkbox, and save affordance", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /import \{ SegmentedControl \} from "\.\/SegmentedControl";/);
  assert.match(source, /<SegmentedControl/);
  assert.match(source, /buildScriptPlatformOptions\(t\)/);
  assert.match(source, /buildPlatformOptions\(t\)/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /className="peer sr-only"/);
  assert.match(source, /<CheckIcon className="h-3 w-3" \/>/);
  assert.match(source, /settings\.localEnvironments\.actions\.item\.platforms\.specific/);
  assert.match(source, /<Tooltip disabled=\{saveDisabledReason == null\} tooltipContent=\{saveDisabledReason \?\? ""\}>/);
  assert.match(source, /<Tooltip tooltipContent=\{t\("settings\.localEnvironments\.actions\.item\.tooltip\.delete"\)\}>/);
  assert.doesNotMatch(source, /function SegmentedControl\(/);
  assert.doesNotMatch(source, /loading=\{isSaving\}/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
