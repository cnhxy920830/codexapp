/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceFileCommandMenuPanel } from "./WorkspaceFileCommandMenu";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/workspace-file-command-menu.snap.json");
const UPDATE_SNAPSHOTS = process.env.WORKSPACE_FILE_COMMAND_MENU_UPDATE_SNAPSHOTS === "1";

test("workspace file command menu snapshots", async (t) => {
  const actualSnapshots = {
    files: normalizeMarkup(
      renderToStaticMarkup(
        <WorkspaceFileCommandMenuPanel
          canSearch
          isLoading={false}
          mode="files"
          query="thread"
          results={[
            {
              name: "thread.ts",
              path: "D:\\workspace\\src\\thread.ts",
              relativePath: "src/thread.ts",
            },
            {
              name: "thread-state.ts",
              path: "D:\\workspace\\src\\thread-state.ts",
              relativePath: "src/thread-state.ts",
            },
          ]}
          searchFilesShortcutLabel="Ctrl+P"
          selectedIndex={0}
          showSearchFilesItem
          t={translate}
        />,
      ),
    ),
    root: normalizeMarkup(
      renderToStaticMarkup(
        <WorkspaceFileCommandMenuPanel
          canSearch
          isLoading={false}
          mode="root"
          query=""
          results={[]}
          searchFilesShortcutLabel="Ctrl+P"
          selectedIndex={0}
          showSearchFilesItem
          t={translate}
        />,
      ),
    ),
  };

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
  files: string;
  root: string;
};

function normalizeMarkup(markup: string) {
  return markup
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const MESSAGE_MAP: Record<string, string> = {
  "thread.fileCommandMenu.filesGroup": "Files",
  "thread.fileCommandMenu.searchFiles": "Search files",
  "thread.fileTreePanel.noMatchingFiles": "No matching files",
  "thread.fileTreePanel.searchingFiles": "Searching files",
};

function translate(key: string) {
  return MESSAGE_MAP[key] ?? key;
}
