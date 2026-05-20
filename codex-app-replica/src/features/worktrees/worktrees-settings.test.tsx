/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/features/worktrees/WorktreesSettingsPage.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const SERVICE_SOURCE_PATH = path.join(process.cwd(), "src/services/history.ts");
const TITLE_SOURCE_PATH = path.join(process.cwd(), "src/components/SettingsSectionTitle.tsx");

test("worktrees settings keeps extracted shared settings shell and title owner", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const titleSource = readSource(TITLE_SOURCE_PATH);

  assert.match(source, /SettingsContentLayout title=\{<SettingsSectionTitle slug="worktrees" \/>\}/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header actions=\{refreshAction\} title=\{t\("settings\.worktrees\.loading\.title"\)\} \/>/s);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header actions=\{refreshAction\} title=\{t\("settings\.worktrees\.error\.title"\)\} \/>/s);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header actions=\{refreshAction\} title=\{t\("settings\.worktrees\.empty\.title"\)\} \/>/s);
  assert.match(source, /<SettingsSurface>/);
  assert.doesNotMatch(source, /function SettingsGroup\(/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);

  assert.match(titleSource, /\| "worktrees"/);
  assert.match(titleSource, /worktrees: "settings\.section\.worktrees"/);
});

test("worktrees settings keeps extracted host-filtered recent threads and background-subagent gate", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);

  assert.match(source, /const backgroundSubagentsEnabled = useReplicaStatsigGateValue\("1221508807"\);/);
  assert.match(
    source,
    /const cachedConversationsById = useMemo\(\(\) => \{\s*return new Map\(\s*cachedConversations\s*\.filter\(\(conversation\) => \(conversation\.hostId \?\? LOCAL_SETTINGS_HOST_ID\) === selectedHostId\)\s*\.map\(\(conversation\) => \[conversation\.id, conversation\]\),\s*\);\s*\}, \[cachedConversations, selectedHostId\]\);/s,
  );
  assert.match(
    source,
    /const recentThreadsForHost = recentThreads\.filter\(\(thread\) => \(thread\.hostId \?\? LOCAL_SETTINGS_HOST_ID\) === selectedHostId\);/,
  );
  assert.match(
    source,
    /const visibleRecentThreads = recentThreadsForHost\.filter\(\s*\(thread\) => !isThreadSpawnSubagentConversation\(thread, backgroundSubagentsEnabled\),\s*\);/s,
  );
  assert.match(
    source,
    /function isThreadSpawnSubagentConversation\(thread: ThreadHistoryEntry, backgroundSubagentsEnabled: boolean\) \{\s*return !backgroundSubagentsEnabled && thread\.source\?\.parentThreadId != null;\s*\}/s,
  );
  assert.match(source, /recentThreads: ThreadHistoryEntry\[];/);
  assert.match(source, /cachedConversations: ThreadConversation\[];/);
  assert.match(source, /isRecentThreadsLoading\?: boolean;/);
  assert.match(appSource, /isRecentThreadsLoading=\{!hasLoadedInitialThreadSnapshot\}/);
  assert.match(appSource, /recentThreads=\{recentThreadEntries\}/);
  assert.match(appSource, /cachedConversations=\{Array\.from\(loadedConversationsByIdRef\.current\.values\(\)\)\}/);
});

test("worktrees settings keeps extracted worktree row interactions and app routing contract", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);
  const serviceSource = readSource(SERVICE_SOURCE_PATH);

  assert.match(source, /archiveConversation\(\{\s*conversationId: conversation\.id,\s*cleanupWorktree: false,\s*\}\)/s);
  assert.match(
    source,
    /await deleteWorktree\(\{\s*hostId,\s*worktree: worktree\.dir,\s*reason: "settings-delete-targeted",\s*\}\);/s,
  );
  assert.match(source, /void onViewConversation\?\.\(conversation\.id, hostId\);/);
  assert.doesNotMatch(source, /onDismissToast\?\.\(\);/);
  assert.match(source, /<Button className="shrink-0" color="danger" loading=\{isDeleting\} onClick=\{\(\) => void handleDelete\(\)\} size="toolbar">/);
  assert.match(source, /repoRoot=\{group\.repoRoot\}/);
  assert.match(source, /const displayRepoRoot = repoRoot \?\? worktrees\[0\]\?\.dir \?\? null;/);
  assert.match(source, /const isRepositoryMetadataLoading = false;/);
  assert.match(source, /t\("settings\.worktrees\.repository\.loading"\)/);
  assert.match(source, /<span className="truncate font-mono text-sm">\{displayRepoRoot\}<\/span>/);
  assert.doesNotMatch(source, /readGitOrigins/);
  assert.match(source, /<Spinner className="icon-xxs" \/>/);
  assert.match(source, /t\("settings\.worktrees\.row\.conversations\.loading"\)/);
  assert.match(
    source,
    /const title =\s*getConversationDisplayTitle\(conversation\.id, cachedConversationsById\) \?\?\s*getThreadHistoryConversationTitle\(conversation\) \?\?\s*t\("settings\.worktrees\.conversation\.untitled"\);/s,
  );
  assert.match(source, /return getParentCollabConversationPromptTitle\(conversation\.id, cachedConversationsById\);/);
  assert.match(source, /const title = normalizeConversationTitleText\(conversation\.title\);/);
  assert.match(source, /const firstUserTextInput = conversation\.turns\[0\]\?\.input/);
  assert.match(source, /item\.type !== "collabAgentToolCall" \|\| !item\.receiverThreadIds\.includes\(conversationId\)/);
  assert.match(source, /const promptTitle = normalizeConversationTitleText\(item\.prompt\);/);

  assert.match(appSource, /onViewConversation=\{\(threadId, hostId\) => void viewConversationForHost\(threadId, hostId\)\}/);
  assert.match(serviceSource, /hostId\?: string \| null;/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
