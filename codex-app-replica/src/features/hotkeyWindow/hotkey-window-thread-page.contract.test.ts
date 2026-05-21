import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const THREAD_PAGE_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/HotkeyWindowThreadPage.tsx",
);
const WORKTREE_INIT_PAGE_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/HotkeyWindowWorktreeInitPage.tsx",
);
const HOTKEY_STATE_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/hotkeyWindowHotkeyState.ts",
);
const SETTINGS_PATH = path.join(
  process.cwd(),
  "src/services/settings.ts",
);
const HOTKEY_WINDOW_RS_PATH = path.join(
  process.cwd(),
  "src-tauri/src/hotkey_window.rs",
);
const REMOTE_CONNECTIONS_RS_PATH = path.join(
  process.cwd(),
  "src-tauri/src/remote_connections.rs",
);

test("hotkey window thread page uses shared-object hotkey state for missing-conversation fallback", async () => {
  const source = await readFile(THREAD_PAGE_PATH, "utf8");

  assert.match(
    source,
    /import\s+\{\s*useHotkeyWindowHotkeyState\s*\}\s+from\s+"\.\/hotkeyWindowHotkeyState"/,
  );
  assert.match(source, /const hotkeyState = useHotkeyWindowHotkeyState\(\);/);
  assert.match(
    source,
    /if \(conversationId !== null \|\| hotkeyState === null\) \{\s*return;\s*\}\s*onNavigateToPath\(\s*hotkeyState\.configuredHotkey === null\s*\?\s*HOTKEY_NEW_THREAD_ROUTE_PATH\s*:\s*HOTKEY_HOME_ROUTE_PATH,\s*\);/s,
  );
  assert.match(source, /if \(conversationId === null\) \{\s*return null;\s*\}/s);
  assert.doesNotMatch(source, /readHotkeyWindowHotkeyState/);
  assert.doesNotMatch(source, /useState<HotkeyWindowHotkeyStateResponse/);
});

test("hotkey window worktree init page shares the same hotkey-state fallback owner", async () => {
  const source = await readFile(WORKTREE_INIT_PAGE_PATH, "utf8");

  assert.match(
    source,
    /import\s+\{\s*useHotkeyWindowHotkeyState\s*\}\s+from\s+"\.\/hotkeyWindowHotkeyState"/,
  );
  assert.match(source, /const hotkeyState = useHotkeyWindowHotkeyState\(\);/);
  assert.match(
    source,
    /if \(pendingWorktreeId !== null \|\| hotkeyState === null\) \{\s*return;\s*\}\s*onNavigateToPath\(\s*hotkeyState\.configuredHotkey === null\s*\?\s*HOTKEY_NEW_THREAD_ROUTE_PATH\s*:\s*HOTKEY_HOME_ROUTE_PATH,\s*\);/s,
  );
  assert.doesNotMatch(source, /readHotkeyWindowHotkeyState/);
});

test("shared hotkey-state owner reads and subscribes to the extracted shared object key", async () => {
  const [source, settingsSource] = await Promise.all([
    readFile(HOTKEY_STATE_PATH, "utf8"),
    readFile(SETTINGS_PATH, "utf8"),
  ]);

  assert.match(
    settingsSource,
    /HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY\s*=\s*"hotkey-window-hotkey-state"/,
  );
  assert.match(
    source,
    /readSharedObjectSnapshot\(\s*HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY,\s*normalizeHotkeyWindowHotkeyState,\s*\)/s,
  );
  assert.match(
    source,
    /onSharedObjectUpdated\(\(notification\) => \{\s*if \(notification\.key !== HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY\) \{\s*return;\s*\}\s*handler\(normalizeHotkeyWindowHotkeyState\(notification\.value\)\);\s*\}\);/s,
  );
  assert.match(source, /const \[hotkeyState, setHotkeyState\] = useState/);
  assert.match(source, /useState<HotkeyWindowHotkeyStateValue>\(null\)/);
  assert.match(source, /const unsubscribe = subscribeHotkeyWindowHotkeyState\(\(state\) => \{/);
});

test("rust host exposes hotkey window hotkey state through shared-object snapshot and updates", async () => {
  const [hotkeyWindowSource, remoteConnectionsSource] = await Promise.all([
    readFile(HOTKEY_WINDOW_RS_PATH, "utf8"),
    readFile(REMOTE_CONNECTIONS_RS_PATH, "utf8"),
  ]);

  assert.match(
    hotkeyWindowSource,
    /const HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY: &str = "hotkey-window-hotkey-state";/,
  );
  assert.match(
    hotkeyWindowSource,
    /pub\(crate\) fn hotkey_window_hotkey_state_shared_object_key\(\) -> &'static str \{\s*HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY\s*\}/s,
  );
  assert.match(
    hotkeyWindowSource,
    /pub\(crate\) fn hotkey_window_hotkey_state_snapshot\(app: &AppHandle\) -> Result<Value, String> \{/,
  );
  assert.match(
    hotkeyWindowSource,
    /fn emit_hotkey_window_hotkey_state_updated\(\s*app: &AppHandle,\s*state: &HotkeyWindowHotkeyStateResponse,\s*\) -> Result<\(\), String> \{/s,
  );
  assert.match(
    hotkeyWindowSource,
    /emit_hotkey_window_hotkey_state_updated\(&app, &state\)\?/,
  );
  assert.match(
    remoteConnectionsSource,
    /if key == hotkey_window_hotkey_state_shared_object_key\(\) \{\s*return Ok\(SharedObjectSnapshotResponse \{\s*value: hotkey_window_hotkey_state_snapshot\(&app\)\?,\s*\}\);\s*\}/s,
  );
});
