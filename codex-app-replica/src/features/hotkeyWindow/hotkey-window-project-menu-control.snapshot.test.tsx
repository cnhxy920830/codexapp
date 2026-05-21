/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { HotkeyWindowProjectMenuControlView } from "./HotkeyWindowProjectMenuControl";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/__snapshots__/hotkey-window-project-menu-control.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.HOTKEY_WINDOW_PROJECT_MENU_CONTROL_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("hotkey window project menu control snapshots", async (t) => {
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
  heroOpen: string;
  homeNoRemoteMenuOpen: string;
  menuOpen: string;
  noResults: string;
};

function buildSnapshots(): SnapshotMap {
  const connectedRemoteConnections = [
    {
      autoConnect: false,
      displayName: "staging-box",
      hostId: "remote-staging",
      identity: null,
      source: "ssh",
      sshAlias: null,
      sshHost: null,
      sshPort: null,
    },
  ];
  const localProject = {
    kind: "local" as const,
    hasGitRoot: true,
    isCodexWorktree: false,
    label: "codex",
    workspaceRoot: "D:\\workspace\\codex",
  };
  const worktreeProject = {
    kind: "local" as const,
    hasGitRoot: false,
    isCodexWorktree: true,
    label: "feature-worktree",
    workspaceRoot: "D:\\Codex\\.codex\\worktrees\\feature-worktree",
  };
  const remoteProject = {
    kind: "remote" as const,
    hostDisplayName: "staging-box",
    hostId: "remote-staging",
    label: "codex-remote",
    projectId: "remote-project-1",
    remotePath: "/srv/codex",
  };
  const projectOptions = [localProject, worktreeProject, remoteProject];

  return {
    emptyState: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[320px] p-4">
          <HotkeyWindowProjectMenuControlView
            allowRemoteProjects
            connectedRemoteConnections={connectedRemoteConnections}
            filteredProjectOptions={projectOptions}
            isLoading={false}
            isOpen={false}
            query=""
            selectedOption={null}
            selection={{ kind: "projectless" }}
            variant="home"
            onAddLocalProject={noop}
            onAddRemoteProject={noop}
            onClearProject={noop}
            onQueryChange={noopString}
            onSelectProject={noopProjectOption}
            onToggleOpen={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    heroOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[520px] p-4">
          <HotkeyWindowProjectMenuControlView
            allowRemoteProjects
            connectedRemoteConnections={connectedRemoteConnections}
            filteredProjectOptions={projectOptions}
            isLoading={false}
            isOpen
            query=""
            selectedOption={remoteProject}
            selection={{ kind: "remote", hostId: "remote-staging", projectId: "remote-project-1", remotePath: "/srv/codex" }}
            variant="hero"
            onAddLocalProject={noop}
            onAddRemoteProject={noop}
            onClearProject={noop}
            onQueryChange={noopString}
            onSelectProject={noopProjectOption}
            onToggleOpen={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    homeNoRemoteMenuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[320px] p-4">
          <HotkeyWindowProjectMenuControlView
            allowRemoteProjects={false}
            connectedRemoteConnections={connectedRemoteConnections}
            filteredProjectOptions={[localProject, worktreeProject]}
            isLoading={false}
            isOpen
            query=""
            selectedOption={localProject}
            selection={{ kind: "local", workspaceRoot: localProject.workspaceRoot }}
            variant="home"
            onAddLocalProject={noop}
            onAddRemoteProject={noop}
            onClearProject={noop}
            onQueryChange={noopString}
            onSelectProject={noopProjectOption}
            onToggleOpen={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    menuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[320px] p-4">
          <HotkeyWindowProjectMenuControlView
            allowRemoteProjects
            connectedRemoteConnections={connectedRemoteConnections}
            filteredProjectOptions={projectOptions}
            isLoading={false}
            isOpen
            query=""
            selectedOption={localProject}
            selection={{ kind: "local", workspaceRoot: localProject.workspaceRoot }}
            variant="home"
            onAddLocalProject={noop}
            onAddRemoteProject={noop}
            onClearProject={noop}
            onQueryChange={noopString}
            onSelectProject={noopProjectOption}
            onToggleOpen={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    noResults: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[320px] p-4">
          <HotkeyWindowProjectMenuControlView
            allowRemoteProjects
            connectedRemoteConnections={connectedRemoteConnections}
            filteredProjectOptions={[]}
            isLoading={false}
            isOpen
            query="zzz"
            selectedOption={localProject}
            selection={{ kind: "local", workspaceRoot: localProject.workspaceRoot }}
            variant="home"
            onAddLocalProject={noop}
            onAddRemoteProject={noop}
            onClearProject={noop}
            onQueryChange={noopString}
            onSelectProject={noopProjectOption}
            onToggleOpen={noop}
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
const noopString = (_value: string) => {};
const noopProjectOption = (_value: unknown) => {};
const noopLocale = async (_locale: LocaleCode) => {};
