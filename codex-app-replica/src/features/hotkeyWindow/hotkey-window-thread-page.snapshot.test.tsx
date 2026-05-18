/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import type { ThreadConversation } from "../../services/history";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/__snapshots__/hotkey-window-thread-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.HOTKEY_WINDOW_THREAD_PAGE_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("hotkey window thread page snapshots", async (t) => {
  const actualSnapshots = await buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  titledThreadWithProject: string;
  untitledThreadWithoutProject: string;
};

async function buildSnapshots(): Promise<SnapshotMap> {
  const { HotkeyWindowThreadPage } = await import("./HotkeyWindowThreadPage");

  return {
    titledThreadWithProject: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px] w-[560px]">
          <HotkeyWindowThreadPage
            conversationId="thread-alpha"
            onNavigateToPath={noopNavigate}
            threadConversation={buildThreadConversation({
              cwd: "D:\\workspace\\Alpha Beta Gamma Delta",
              title: "Hotkey thread parity",
            })}
          >
            <div className="h-full rounded-md border border-token-border-light" />
          </HotkeyWindowThreadPage>
        </div>
      </StaticI18nProvider>,
    ),
    untitledThreadWithoutProject: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px] w-[560px]">
          <HotkeyWindowThreadPage
            conversationId="thread-beta"
            onNavigateToPath={noopNavigate}
            threadConversation={buildThreadConversation({
              cwd: "",
              title: "   ",
            })}
          >
            <div className="h-full rounded-md border border-token-border-light" />
          </HotkeyWindowThreadPage>
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function StaticI18nProvider({ children }: { children: ReactElement }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US" as LocaleCode,
        setLocale: noopLocale,
        t: translate,
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

function buildThreadConversation({
  cwd,
  title,
}: {
  cwd: string;
  title: string;
}): ThreadConversation {
  return {
    id: "thread-snapshot",
    title,
    cwd,
    hostId: null,
    turns: [],
    turnTimings: [],
    items: [],
    latestTokenUsageInfo: null,
  };
}

const noopLocale = async (_locale: LocaleCode) => {};
const noopNavigate = (_path: string) => undefined;
