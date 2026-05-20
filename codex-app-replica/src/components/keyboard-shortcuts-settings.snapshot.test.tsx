/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../i18n/i18n";
import { MESSAGES } from "../i18n/messages";

if (!("window" in globalThis)) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      location: {
        href: "http://localhost/",
        origin: "http://localhost",
        hostname: "localhost",
      },
      electronBridge: undefined,
    },
  });
}

if (!("document" in globalThis)) {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {},
    },
  });
}

if (!("navigator" in globalThis)) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      platform: "Win32",
      language: "en-US",
    },
  });
}

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/components/__snapshots__/keyboard-shortcuts-settings.snap.json",
);
const SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/KeyboardShortcutsSettings.tsx",
);
const TOOLTIP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/Tooltip.tsx",
);
const UPDATE_SNAPSHOTS =
  process.env.KEYBOARD_SHORTCUTS_SETTINGS_UPDATE_SNAPSHOTS === "1";

test("keyboard shortcuts source uses extracted title owner and shared keycap owner", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");
  const tooltipSource = await readFile(TOOLTIP_SOURCE_PATH, "utf8");

  assert.match(
    source,
    /SettingsContentLayout\s+title=\{<SettingsSectionTitle slug="keyboard-shortcuts" \/>\}/s,
  );
  assert.match(
    source,
    /<TooltipKeycap keysLabel=\{shortcutLabel\} \/>/,
  );
  assert.match(
    tooltipSource,
    /export function TooltipKeycap/,
  );
});

test("keyboard shortcuts settings snapshots", async (t) => {
  const actualSnapshots = await buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(
      SNAPSHOT_PATH,
      `${JSON.stringify(actualSnapshots, null, 2)}\n`,
    );
    return;
  }

  const expectedSnapshots = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);

      if (name === "loading") {
        assert.match(actual, /Keyboard shortcuts/);
        assert.match(actual, /Loading shortcuts…/);
        assert.doesNotMatch(actual, /Search shortcuts/);
      }

      if (name === "populated") {
        assert.match(
          actual,
          /w-full rounded-md border border-token-border bg-transparent px-3 py-2 text-sm text-token-text-primary outline-none placeholder:text-token-text-tertiary/,
        );
        assert.match(actual, /Find/);
        assert.match(actual, /Search the current chat/);
        assert.match(actual, /Ctrl\+Alt\+F/);
        assert.match(
          actual,
          /<kbd class=\"inline-flex !rounded-md !border-0 !bg-current\/10 !font-sans !text-xs !text-current !shadow-none !px-1\.5 !py-0\.5 !leading-none\">Ctrl\+Alt\+F<\/kbd>/,
        );
        assert.match(actual, /Clear shortcut for Find/);
        assert.match(actual, /Reset shortcut for Find/);
      }

      if (name === "capture") {
        assert.match(actual, /data-codex-shortcut-capture="true"/);
        assert.match(actual, /Press shortcut/);
        assert.match(actual, /Cancel/);
        assert.match(actual, /Used by Search Files…/);
      }
    });
  }
});

type SnapshotMap = {
  capture: string;
  loading: string;
  populated: string;
};

async function buildSnapshots(): Promise<SnapshotMap> {
  const { KeyboardShortcutsSettingsView } = await import(
    "./KeyboardShortcutsSettings"
  );

  return {
    loading: renderSnapshot(
      <KeyboardShortcutsSettingsView
        captureState={null}
        errorByCommandId={{}}
        gateState={{
          globalDictationEnabled: false,
          hotkeyWindowEnabled: false,
        }}
        isSaving={false}
        keymapState={null}
        onCancelCapture={noop}
        onCaptureShortcut={noop}
        onClearShortcut={noop}
        onResetCommand={noop}
        onSearchTextChange={noop}
        onStartCapture={noop}
        searchText=""
      />,
    ),
    populated: renderSnapshot(
      <KeyboardShortcutsSettingsView
        captureState={null}
        errorByCommandId={{}}
        gateState={{
          globalDictationEnabled: false,
          hotkeyWindowEnabled: false,
        }}
        isSaving={false}
        keymapState={{
          bindings: [
            {
              command: "findInThread",
              key: "Ctrl+Alt+F",
            },
          ],
        }}
        onCancelCapture={noop}
        onCaptureShortcut={noop}
        onClearShortcut={noop}
        onResetCommand={noop}
        onSearchTextChange={noop}
        onStartCapture={noop}
        searchText="findInThread"
      />,
    ),
    capture: renderSnapshot(
      <KeyboardShortcutsSettingsView
        captureState={{
          accelerator: "Ctrl+Alt+F",
          commandId: "findInThread",
          conflictingCommandTitle: "Search Files…",
          mode: "replace",
        }}
        errorByCommandId={{}}
        gateState={{
          globalDictationEnabled: false,
          hotkeyWindowEnabled: false,
        }}
        isSaving={false}
        keymapState={{
          bindings: [
            {
              command: "findInThread",
              key: "Ctrl+Alt+F",
            },
          ],
        }}
        onCancelCapture={noop}
        onCaptureShortcut={noop}
        onClearShortcut={noop}
        onResetCommand={noop}
        onSearchTextChange={noop}
        onStartCapture={noop}
        searchText="findInThread"
      />,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(
    renderToStaticMarkup(
      <I18N_CONTEXT.Provider
        value={{
          locale: "en-US",
          setLocale: noop,
          t: (key, values) => {
            const template = MESSAGES["en-US"][key];
            if (values == null) {
              return template;
            }

            return template.replace(/\{(\w+)\}/g, (match, token) => {
              const value = values[token];
              return value === undefined ? match : String(value);
            });
          },
        }}
      >
        {element}
      </I18N_CONTEXT.Provider>,
    ),
  );
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function noop() {}
