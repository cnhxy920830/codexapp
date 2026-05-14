/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FilePreviewPage } from "./FilePreviewPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/file-preview-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.FILE_PREVIEW_PAGE_UPDATE_SNAPSHOTS === "1";

test("file preview page snapshots", async (t) => {
  const actualSnapshots = {
    invalidState: renderToStaticMarkup(<FilePreviewPage routeState={null} t={translate} />),
    pdfBinaryPlaceholder: renderToStaticMarkup(
      <FilePreviewPage
        routeState={{
          filePath: "docs/report.pdf",
          contents: "",
        }}
        t={translate}
      />,
    ),
    plainText: renderToStaticMarkup(
      <FilePreviewPage
        routeState={{
          filePath: "src/example.ts",
          contents: "line one\r\nline two",
          line: 3,
          column: 2,
        }}
        t={translate}
      />,
    ),
    pdbFallback: renderToStaticMarkup(
      <FilePreviewPage
        routeState={{
          filePath: "models/example.pdb",
          contents: "ATOM",
        }}
        t={translate}
      />,
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
  invalidState: string;
  pdfBinaryPlaceholder: string;
  plainText: string;
  pdbFallback: string;
};

const translate = (key: string) => key;
