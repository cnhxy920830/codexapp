import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("App keeps hotkey remote thread routes inside the hotkey shell", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /const isHotkeyRemoteThreadPage =\s*currentRoute === "chat" &&\s*currentThreadShellRoute\?\.shell === "hotkey" &&\s*currentThreadShellRoute\.kind === "remote";/s,
  );
  assert.match(
    source,
    /if \(isHotkeyLocalThreadPage \|\| isHotkeyRemoteThreadPage\) \{\s*const nextPath = buildLocalThreadRoutePath\(threadId, "hotkey"\);[\s\S]*?void selectThread\(threadId, "hotkey"\);/s,
  );
  assert.match(
    source,
    /if \(isHotkeyLocalThreadPage \|\| isHotkeyRemoteThreadPage\) \{\s*const nextPath = buildRemoteThreadRoutePath\(taskId, "hotkey"\);[\s\S]*?void openRemoteTask\(taskId, "hotkey"\);/s,
  );
  assert.match(
    source,
    /if \(isHotkeyRemoteThreadPage\) \{\s*return \(\s*<>\s*<HotkeyWindowRemoteConversationPage\s+onNavigateToPath=\{navigateHotkeyThreadPage\}\s+task=\{remoteTaskState\?\.task \?\? null\}\s+taskId=\{currentThreadShellRoute\?\.threadId \?\? selectedThreadId \?\? null\}/s,
  );
});

test("hotkey remote conversation page uses the shared hotkey fallback and main-window route contract", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/hotkeyWindow/HotkeyWindowRemoteConversationPage.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /import\s+\{\s*HOTKEY_HOME_ROUTE_PATH,\s*HOTKEY_NEW_THREAD_ROUTE_PATH,\s*\}\s+from\s+"..\/..\/services\/windowNavigation";/s,
  );
  assert.match(
    source,
    /const hotkeyState = useHotkeyWindowHotkeyState\(\);/,
  );
  assert.match(
    source,
    /if \(taskId !== null \|\| hotkeyState === null\) \{\s*return;\s*\}\s*onNavigateToPath\(\s*hotkeyState\.configuredHotkey === null\s*\?\s*HOTKEY_NEW_THREAD_ROUTE_PATH\s*:\s*HOTKEY_HOME_ROUTE_PATH,\s*\);/s,
  );
  assert.match(source, /if \(taskId === null\) \{\s*return null;\s*\}/s);
  assert.match(source, /const mainWindowPath = buildMainWindowRemoteThreadPath\(taskId\);/);
  assert.match(source, /return `\/remote\/\$\{encodeURIComponent\(taskId\)\}`;/);
});
