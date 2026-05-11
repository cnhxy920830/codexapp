/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";
import { PdbPreviewLoadingOverlay } from "./PdbPreview";
import { WorkspaceFilePreviewContent } from "./WorkspaceFilePreviewPanel";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/workspace-file-preview-panel.snap.json");
const UPDATE_SNAPSHOTS = process.env.WORKSPACE_FILE_PREVIEW_PANEL_UPDATE_SNAPSHOTS === "1";

test("workspace file preview panel snapshots", async (t) => {
  const actualSnapshots = {
    binaryPdf: renderToStaticMarkup(
      <WorkspaceFilePreviewContent file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)} t={translate} />,
    ),
    plainText: renderToStaticMarkup(
      <WorkspaceFilePreviewContent
        file={buildFile("src/example.ts", "D:\\workspace\\src\\example.ts", "line one\r\nline two", "text/plain", false)}
        t={translate}
      />,
    ),
    pdbLoadingOverlay: renderToStaticMarkup(<PdbPreviewLoadingOverlay />),
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
  binaryPdf: string;
  plainText: string;
  pdbLoadingOverlay: string;
};

function buildFile(
  relativePath: string,
  pathValue: string,
  contents: string | null,
  mimeType: string | null,
  isBinary: boolean,
): WorkspaceFileDocument {
  const name = relativePath.split(/[\\/]+/).at(-1) ?? relativePath;
  return {
    contents,
    isBinary,
    mimeType,
    name,
    path: pathValue,
    relativePath,
  };
}

const translate = (key: string) => key;
