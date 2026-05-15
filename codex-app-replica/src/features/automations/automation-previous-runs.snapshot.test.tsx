/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../../i18n/messages";
import type { AutomationInboxItem } from "../../services/automations";
import { AutomationPreviousRunsList } from "./AutomationPreviousRunsList";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/automations/__snapshots__/automation-previous-runs.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.AUTOMATION_PREVIOUS_RUNS_UPDATE_SNAPSHOTS === "1";

test("automation previous runs snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  emptyState: string;
  loadingState: string;
  populatedState: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    emptyState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[420px] w-[360px]">
          <AutomationPreviousRunsList
            automationId="automation-1"
            formatRootLabel={formatRootLabel}
            inboxItems={[]}
            isLoading={false}
            onOpenThread={noopOpenThread}
            onSetInboxItemReadState={noopSetReadState}
            threadTitleById={new Map()}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
    loadingState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[420px] w-[360px]">
          <AutomationPreviousRunsList
            automationId="automation-1"
            formatRootLabel={formatRootLabel}
            inboxItems={[]}
            isLoading={true}
            onOpenThread={noopOpenThread}
            onSetInboxItemReadState={noopSetReadState}
            threadTitleById={new Map()}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
    populatedState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[420px] w-[360px]">
          <AutomationPreviousRunsList
            automationId="automation-1"
            formatRootLabel={formatRootLabel}
            inboxItems={createInboxItems()}
            isLoading={false}
            onOpenThread={noopOpenThread}
            onSetInboxItemReadState={noopSetReadState}
            threadTitleById={new Map([["thread-3", "Conversation title"]])}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function createInboxItems(): AutomationInboxItem[] {
  return [
    {
      id: "in-progress",
      automationId: "automation-1",
      automationName: "Daily triage",
      title: "Daily triage",
      sourceCwd: "D:\\workspace\\codex-app",
      threadId: "thread-1",
      readAt: null,
      createdAt: Date.now() - 5 * 60 * 1000,
      status: "IN_PROGRESS",
    },
    {
      id: "archived-unread",
      automationId: "automation-1",
      automationName: "Daily triage",
      title: null,
      sourceCwd: "D:\\workspace\\codex-app",
      threadId: "thread-2",
      readAt: null,
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
      status: "ARCHIVED",
    },
    {
      id: "read-normal",
      automationId: "automation-1",
      automationName: "Daily triage",
      title: "Resolved CI",
      sourceCwd: "D:\\workspace\\codex-app",
      threadId: "thread-3",
      readAt: Date.now() - 60 * 60 * 1000,
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
      status: null,
    },
  ];
}

function formatRootLabel(root: string) {
  if (root === "D:\\workspace\\codex-app") {
    return "codex-app";
  }
  return root;
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

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(MESSAGES["en-US"][key], values);
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

const noopLocale = async (_locale: LocaleCode) => {};
const noopOpenThread = async (_threadId: string) => {};
const noopSetReadState = async (_id: string, _isRead: boolean) => {};
