/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { SelectWorkspacePageView } from "./SelectWorkspacePageView";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/onboarding/__snapshots__/select-workspace-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.SELECT_WORKSPACE_PAGE_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("select workspace page snapshots", async (t) => {
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
  emptyState: string;
  emptyStateMenuOpen: string;
  listState: string;
  listStateWithMissingRow: string;
  remoteListStateWithMissingRow: string;
  remoteEmptyState: string;
};

function buildSnapshots(): SnapshotMap {
  const workspaceOptions = [
    {
      root: "D:\\workspace\\codex",
      label: "codex",
    },
    {
      root: "D:\\workspace\\playground",
      label: "Playground",
    },
  ];

  return {
    emptyState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            hasAvailableRoots={false}
            isEmptyState
            isLoadingRoots={false}
            isRemoteHost={false}
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots={false}
            selectedRoots={[]}
            showPlaygroundCopy={false}
            skipErrorMessage={null}
            workspaceRootOptions={[]}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
          />
        </div>
      </StaticI18nProvider>,
    ),
    emptyStateMenuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            addProjectMenuOpen
            hasAvailableRoots={false}
            isEmptyState
            isLoadingRoots={false}
            isRemoteHost={false}
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots={false}
            selectedRoots={[]}
            showPlaygroundCopy={false}
            skipErrorMessage={null}
            workspaceRootOptions={[]}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
          />
        </div>
      </StaticI18nProvider>,
    ),
    listState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            existingPaths={workspaceOptions.map((option) => option.root)}
            hasAvailableRoots
            isEmptyState={false}
            isLoadingExistingPaths={false}
            isLoadingRoots={false}
            isRemoteHost={false}
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots
            selectedRoots={["D:\\workspace\\codex"]}
            showPlaygroundCopy
            skipErrorMessage="Could not create project"
            workspaceRootOptions={workspaceOptions}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
          />
        </div>
      </StaticI18nProvider>,
    ),
    listStateWithMissingRow: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            existingPaths={["D:\\workspace\\codex"]}
            hasAvailableRoots
            isEmptyState={false}
            isLoadingExistingPaths={false}
            isLoadingRoots={false}
            isRemoteHost={false}
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots
            selectedRoots={["D:\\workspace\\codex"]}
            showPlaygroundCopy={false}
            skipErrorMessage={null}
            workspaceRootOptions={[
              ...workspaceOptions,
              {
                root: "D:\\workspace\\missing",
                label: "missing",
              },
            ]}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
          />
        </div>
      </StaticI18nProvider>,
    ),
    remoteListStateWithMissingRow: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            existingPaths={["D:\\workspace\\codex"]}
            hasAvailableRoots
            isEmptyState={false}
            isLoadingExistingPaths={false}
            isLoadingRoots={false}
            isRemoteHost
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots
            selectedRoots={["D:\\workspace\\codex"]}
            showPlaygroundCopy={false}
            skipErrorMessage={null}
            workspaceRootOptions={[
              ...workspaceOptions,
              {
                root: "D:\\workspace\\missing",
                label: "missing",
              },
            ]}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
          />
        </div>
      </StaticI18nProvider>,
    ),
    remoteEmptyState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <SelectWorkspacePageView
            hasAvailableRoots={false}
            isEmptyState
            isLoadingRoots={false}
            isRemoteHost
            isSelectAllChecked={false}
            isSkipPending={false}
            hasSelectedRoots={false}
            selectedRoots={[]}
            showPlaygroundCopy={false}
            skipErrorMessage={null}
            workspaceRootOptions={[]}
            onContinue={noop}
            onOpenFolder={noop}
            onSkip={noop}
            onStartFromScratch={noop}
            onToggleSelectAll={noopBool}
            onToggleWorkspace={noopToggleWorkspace}
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

const noop = () => {};
const noopBool = (_checked: boolean) => {};
const noopToggleWorkspace = (_root: string, _checked: boolean) => {};
const noopLocale = async (_locale: LocaleCode) => {};
