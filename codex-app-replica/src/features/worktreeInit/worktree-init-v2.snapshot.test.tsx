/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnsiText } from "../../components/AnsiText";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { UserPromptMessageCard } from "../chat/UserPromptMessageCard";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/worktreeInit/__snapshots__/worktree-init-v2.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.WORKTREE_INIT_V2_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("worktree init v2 snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

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
  ansiOutput: string;
  promptCard: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    ansiOutput: renderSnapshot(
      <div className="whitespace-pre font-mono text-sm">
        <AnsiText className="text-sm">{"\u001b[31mError\u001b[0m \u001b[1mready\u001b[0m"}</AnsiText>
      </div>,
    ),
    promptCard: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[560px]">
          <UserPromptMessageCard
            hostId="host_123"
            message={`## Pull request merge task:\nPull request: #42\n\n## My request for Codex:\nInvestigate the setup flow.`}
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
