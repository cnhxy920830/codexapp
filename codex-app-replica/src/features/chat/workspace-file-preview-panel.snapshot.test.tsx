/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";
import { PdfPreviewPanel } from "./PdfPreviewPanel";
import { PdbPreviewLoadingOverlay } from "./PdbPreview";
import { WorkspaceFilePreviewContent, WorkspaceFilePreviewStateContent } from "./WorkspaceFilePreviewPanel";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/workspace-file-preview-panel.snap.json");
const UPDATE_SNAPSHOTS = process.env.WORKSPACE_FILE_PREVIEW_PANEL_UPDATE_SNAPSHOTS === "1";

test("workspace file preview panel snapshots", async (t) => {
  const originalNow = Date.now;
  Date.now = () => 0;

  try {
    const actualSnapshots = {
      pdfLoadingShell: renderToStaticMarkup(
        <PdfPreviewPanel file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)} t={translate} />,
      ),
      pdfReadyInverted: renderToStaticMarkup(
        <PdfPreviewPanel
          file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)}
          t={translate}
          testMode={{
            kind: "ready",
            currentPage: 2,
            invertColors: true,
            numPages: 3,
          }}
        />,
      ),
      pdfPresentation: renderToStaticMarkup(
        <PdfPreviewPanel
          file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)}
          t={translate}
          testMode={{
            kind: "presentation",
            currentPage: 2,
            invertColors: true,
            numPages: 4,
          }}
        />,
      ),
      workspacePdf: renderToStaticMarkup(
        <WorkspaceFilePreviewContent file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)} t={translate} />,
      ),
      plainText: renderToStaticMarkup(
        <WorkspaceFilePreviewContent
          file={buildFile("src/example.ts", "D:\\workspace\\src\\example.ts", "line one\r\nline two", "text/plain", false)}
          t={translate}
        />,
      ),
      workbookShell: renderToStaticMarkup(
        <WorkspaceFilePreviewContent
          file={buildFile(
            "sheets/report.xlsx",
            "D:\\workspace\\sheets\\report.xlsx",
            null,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            true,
          )}
          t={translate}
          workbookProto={{}}
        />,
      ),
      docxShell: renderToStaticMarkup(
        <WorkspaceFilePreviewContent
          file={buildFile(
            "docs/report.docx",
            "D:\\workspace\\docs\\report.docx",
            null,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            true,
          )}
          t={translate}
          binaryContents={new Uint8Array([80, 75, 3, 4])}
        />,
      ),
      unsupportedState: renderToStaticMarkup(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "unsupported",
            unsupportedKind: "wordDocument",
          }}
          previewTitle="report.doc"
          t={translate}
        />,
      ),
      tooLargeState: renderToStaticMarkup(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "tooLarge",
            sizeBytes: 42 * 1024 * 1024,
          }}
          previewTitle="large.csv"
          t={translate}
        />,
      ),
      errorState: renderToStaticMarkup(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "error",
          }}
          previewTitle="broken.xlsx"
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
  } finally {
    Date.now = originalNow;
  }
});

type SnapshotMap = {
  docxShell: string;
  pdfLoadingShell: string;
  pdfPresentation: string;
  pdfReadyInverted: string;
  workspacePdf: string;
  plainText: string;
  workbookShell: string;
  unsupportedState: string;
  tooLargeState: string;
  errorState: string;
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
