/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const COMPONENT_SOURCE_PATH = path.join(process.cwd(), "src/components/DataControlsSettings.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const SERVICE_SOURCE_PATH = path.join(process.cwd(), "src/services/history.ts");
const TITLE_SOURCE_PATH = path.join(process.cwd(), "src/components/SettingsSectionTitle.tsx");

test("data controls settings keeps extracted settings shell and shared title owner", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const titleSource = readSource(TITLE_SOURCE_PATH);

  assert.match(source, /<SettingsContentLayout title=\{<SettingsSectionTitle slug="data-controls" \/>\}>/);
  assert.match(source, /<SettingsGroup className="gap-2">\s*<SettingsGroup\.Content>/s);
  assert.match(source, /<SettingsSurface>/);
  assert.match(source, /<SettingsRow label=\{t\("settings\.dataControls\.archivedChats\.loading"\)\} \/>/);
  assert.match(source, /<SettingsRow label=\{t\("settings\.dataControls\.archivedChats\.error"\)\} \/>/);
  assert.match(source, /<SettingsRow label=\{t\("settings\.dataControls\.archivedChats\.empty"\)\} \/>/);

  assert.match(titleSource, /\| "data-controls"/);
  assert.match(titleSource, /"data-controls": "settings\.section\.data-controls"/);
});

test("data controls settings keeps extracted archived row structure and optimistic unarchive flow", () => {
  const source = readSource(COMPONENT_SOURCE_PATH);
  const serviceSource = readSource(SERVICE_SOURCE_PATH);

  assert.match(source, /const previousThreads = archivedThreads;/);
  assert.match(source, /const archivedThreadsRequestIdRef = useRef\(0\);/);
  assert.match(source, /const selectedHostIdRef = useRef\(selectedHostId\);/);
  assert.match(source, /void loadArchivedThreads\(\{\s*hostId: selectedHostId,\s*showLoading: true,\s*clearOnError: true,\s*\}\);/s);
  assert.match(source, /const handleFocus = \(\) => \{/);
  assert.match(source, /hostId: selectedHostIdRef\.current,/);
  assert.match(source, /showLoading: false,/);
  assert.match(source, /clearOnError: false,/);
  assert.match(source, /window\.addEventListener\("focus", handleFocus\);/);
  assert.match(source, /setArchivedThreads\(\(current\) => current\.filter\(\(entry\) => entry\.id !== thread\.id\)\);/);
  assert.match(source, /setArchivedThreads\(previousThreads\);/);
  assert.match(source, /void loadArchivedThreads\(\{\s*hostId: selectedHostId,\s*showLoading: false,\s*clearOnError: false,\s*\}\);/s);
  assert.match(source, /conversationId: thread\.id/);
  assert.match(source, /pointer-events-auto ml-1 cursor-interaction text-token-link underline-offset-2 hover:underline/);
  assert.match(source, /className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-token-list-hover-background"/);
  assert.match(source, /className="truncate text-base font-medium"/);
  assert.match(source, /className="truncate text-token-text-secondary"/);
  assert.match(source, /size="toolbar"/);
  assert.match(source, /loading=\{isPending\}/);
  assert.match(source, /normalizeArchivedThreadTitle\(thread\.name\) \?\?/);
  assert.match(source, /normalizeArchivedThreadTitle\(thread\.preview\) \?\?/);
  assert.match(source, /t\("settings\.dataControls\.archivedChats\.untitled"\)/);
  assert.match(source, /t\("settings\.dataControls\.archivedChats\.dateTimeWithRepo"/);
  assert.match(source, /t\("settings\.dataControls\.archivedChats\.dateTime"/);
  assert.match(source, /const firstLine = trimmed\.split\(/);
  assert.match(source, /const normalized = firstLine\.replace\(/);
  assert.match(source, /const words = trimmed\.split\(\/\\s\+\/u\)\.filter\(Boolean\);/);
  assert.match(source, /return words\.slice\(0, 3\)\.join\(" "\);/);

  assert.match(serviceSource, /invoke<ThreadHistoryEntry\[]>\("list-archived-threads"/);
  assert.match(serviceSource, /invoke<string>\("unarchive-conversation"/);
});

test("data controls settings view-now action follows extracted local and remote route navigation", () => {
  const appSource = readSource(APP_SOURCE_PATH);
  const viewConversationForHostMatch = appSource.match(
    /const viewConversationForHost = async \(threadId: string, hostId: string\) => \{[\s\S]*?\n  \};/,
  );

  assert.ok(viewConversationForHostMatch);
  const viewConversationForHostSource = viewConversationForHostMatch[0];

  assert.match(
    appSource,
    /const openArchivedChatsSettings = \(\) => \{\s*setAppToast\(null\);\s*void handleNavigateToRoute\("\/settings\/data-controls"\);\s*\};/s,
  );
  assert.match(
    viewConversationForHostSource,
    /const viewConversationForHost = async \(threadId: string, hostId: string\) => \{\s*if \(hostId !== LOCAL_SETTINGS_HOST_ID\) \{\s*await handleNavigateToRoute\(buildRemoteThreadRoutePath\(threadId, "default"\)\);\s*return;\s*\}\s*await handleNavigateToRoute\(buildLocalThreadRoutePath\(threadId, "default"\)\);\s*\};/s,
  );
  assert.match(
    appSource,
    /onViewThread=\{\(threadId, hostId\) => void viewConversationForHost\(threadId, hostId\)\}/,
  );
  assert.doesNotMatch(viewConversationForHostSource, /const opened = await openRemoteTask\(threadId\);/);
  assert.doesNotMatch(viewConversationForHostSource, /await loadThreadConversation\(threadId\);/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
