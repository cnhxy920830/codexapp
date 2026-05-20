import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const DEBUG_WINDOW_PAGE_PATH = path.join(process.cwd(), "src/features/debug/DebugWindowPage.tsx");
const APP_PATH = path.join(process.cwd(), "src/App.tsx");
const WINDOW_NAVIGATION_PATH = path.join(process.cwd(), "src/services/windowNavigation.ts");
const WINDOW_NAVIGATION_RUST_PATH = path.join(process.cwd(), "src-tauri/src/window_navigation.rs");

test("debug window page owns the extracted standalone shell and delegates only the modal body", async () => {
  const source = await readFile(DEBUG_WINDOW_PAGE_PATH, "utf8");

  assert.match(source, /export function DebugWindowShell\(\{ children \}: \{ children: ReactNode \}\)/);
  assert.match(
    source,
    /<main className="h-dvh w-full overflow-hidden bg-token-main-surface-primary text-token-foreground">\s*\{children\}\s*<\/main>/s,
  );
  assert.match(source, /return <NavigateHome onNavigateHome=\{onNavigateHome\} \/>;/);
  assert.match(source, /return \(\s*<DebugWindowShell>\s*<DebugModal/s);
  assert.match(source, /showHeader=\{false\}/);
  assert.match(source, /showPopOutButton=\{false\}/);
  assert.match(source, /function closeDebugWindow\(\) \{\s*if \(typeof window !== "undefined" && typeof window\.close === "function"\) \{\s*window\.close\(\);/s);
  assert.match(source, /export function DebugModal\(/);
  assert.match(source, /return \(\s*<div className="flex h-full min-h-0 w-full flex-col text-sm">/s);
  assert.doesNotMatch(source, /export function DebugModal[\s\S]*?<main className="h-dvh w-full overflow-hidden bg-token-main-surface-primary text-token-foreground">/s);
});

test("debug window route and origin-conversation host bridge stay aligned with the extracted owner", async () => {
  const appSource = await readFile(APP_PATH, "utf8");
  const windowNavigationSource = await readFile(WINDOW_NAVIGATION_PATH, "utf8");
  const rustSource = await readFile(WINDOW_NAVIGATION_RUST_PATH, "utf8");

  assert.match(appSource, /DEBUG_WINDOW_ROUTE_PATH/);
  assert.match(appSource, /currentRoute === "debug"/);
  assert.match(appSource, /<DebugWindowPage/);
  assert.match(appSource, /notifyDebugWindowOriginConversationChanged\(selectedThreadId\)/);
  assert.match(windowNavigationSource, /export const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT = "debug-window-origin-conversation-changed";/);
  assert.match(windowNavigationSource, /export const DEBUG_WINDOW_ROUTE_PATH = "\/debug";/);
  assert.match(windowNavigationSource, /takePendingDebugWindowOriginConversation/);
  assert.match(rustSource, /const DEBUG_WINDOW_ROUTE_PATH: &str = "\/debug";/);
  assert.match(rustSource, /const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT: &str =\s*"debug-window-origin-conversation-changed";/s);
  assert.match(rustSource, /#\[tauri::command\(rename = "debug-window-origin-conversation-changed"\)\]/);
  assert.match(rustSource, /pub fn take_pending_debug_window_origin_conversation\(/);
});
