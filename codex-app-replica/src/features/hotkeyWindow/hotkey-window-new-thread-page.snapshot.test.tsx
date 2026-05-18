/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/__snapshots__/hotkey-window-new-thread-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.HOTKEY_WINDOW_NEW_THREAD_PAGE_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("hotkey window new thread page snapshots", async (t) => {
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
  projectless: string;
  withInitialProject: string;
};

async function buildSnapshots(): Promise<SnapshotMap> {
  const { HotkeyWindowNewThreadPage } = await import("./HotkeyWindowNewThreadPage");

  return {
    projectless: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px] w-[560px]">
          <HotkeyWindowNewThreadPage
            codexHome={null}
            composerEnterBehavior="enter"
            guardianApprovalEnabledByStatsig={false}
            initialWorkspaceRoot={null}
            onOpenLocalEnvironmentsSettings={noopOpenLocalEnvironmentsSettings}
            onStartCloudConversation={noopStartCloudConversation}
            onStartLocalConversation={noopStartLocalConversation}
            onStartWorktreeConversation={noopStartWorktreeConversation}
          />
        </div>
      </StaticI18nProvider>,
    ),
    withInitialProject: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px] w-[560px]">
          <HotkeyWindowNewThreadPage
            codexHome={null}
            composerEnterBehavior="cmdIfMultiline"
            guardianApprovalEnabledByStatsig={false}
            initialWorkspaceRoot="D:\\workspace\\codex"
            onOpenLocalEnvironmentsSettings={noopOpenLocalEnvironmentsSettings}
            onStartCloudConversation={noopStartCloudConversation}
            onStartLocalConversation={noopStartLocalConversation}
            onStartWorktreeConversation={noopStartWorktreeConversation}
          />
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

const noopLocale = async (_locale: LocaleCode) => {};
const noopOpenLocalEnvironmentsSettings = (_params: {
  configPath: string | null;
  workspaceRoot: string;
}) => {};
const noopStartCloudConversation = async (_params: {
  draft: string;
  permissionOverrides: unknown;
  workspaceRoot: string;
}) => {};
const noopStartLocalConversation = async (_params: {
  draft: string;
  permissionOverrides: unknown;
  workspaceRoot: string | null;
}) => {};
const noopStartWorktreeConversation = async (_params: {
  id: string;
  localEnvironmentConfigPath: string | null;
  permissionOverrides: unknown;
  prompt: string;
  startingState: unknown;
  workspaceRoot: string;
}) => {};
