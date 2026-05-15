/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/i18n";
import type { ThreadConversationUserComment } from "../../services/history";
import type { WorkspaceFileDocument, WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import { PdfPreviewPanel } from "./PdfPreviewPanel";
import { PdbPreviewLoadingOverlay } from "./PdbPreview";
import { WorkspaceFilePreviewContent, WorkspaceFilePreviewStateContent } from "./WorkspaceFilePreviewPanel";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/workspace-file-preview-panel.snap.json");
const UPDATE_SNAPSHOTS = process.env.WORKSPACE_FILE_PREVIEW_PANEL_UPDATE_SNAPSHOTS === "1";

test("workspace file preview panel snapshots", async (t) => {
  const originalNow = Date.now;
  Date.now = () => 0;
  const workspaceRoot = "D:\\workspace";
  const ownerShellContext = {
    onSelectWorkspaceFile: () => {},
    preferredEditorTarget: "vscode",
    showFileTree: false,
    tabId: "workspace:file-preview",
    artifactRichPreviewEnabled: true,
    setArtifactRichPreviewEnabled: () => {},
    toggleFileTree: () => {},
  };

  try {
    const actualSnapshots = {
      pdfLoadingShell: renderSnapshot(
        <PdfPreviewPanel file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)} t={translate} />,
      ),
      pdfReadyInverted: renderSnapshot(
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
      pdfReadyWithComments: renderSnapshot(
        <PdfPreviewPanel
          comments={[
            buildPdfComment({
              body: "Summarize this chart in the follow-up.",
              line: 7,
              pageNumber: 2,
              path: "D:\\workspace\\docs\\report.pdf",
            }),
          ]}
          file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)}
          t={translate}
          testMode={{
            kind: "ready",
            currentPage: 2,
            numPages: 3,
          }}
        />,
      ),
      pdfReadyAnnotatingWithComments: renderSnapshot(
        <PdfPreviewPanel
          comments={[
            buildPdfComment({
              body: "Summarize this chart in the follow-up.",
              line: 7,
              pageNumber: 2,
              path: "D:\\workspace\\docs\\report.pdf",
            }),
          ]}
          file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)}
          t={translate}
          testMode={{
            kind: "ready",
            commentMode: true,
            currentPage: 2,
            numPages: 3,
          }}
        />,
      ),
      pdfPresentation: renderSnapshot(
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
      workspacePdf: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile("docs/report.pdf", "D:\\workspace\\docs\\report.pdf", null, "application/pdf", true)}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "docs/report.pdf")}
          t={translate}
        />,
      ),
      texShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          compiledPdfDataUrl="data:application/pdf;base64,JVBERi0xLjQK"
          file={buildFile("papers/demo.tex", "D:\\workspace\\papers\\demo.tex", null, "text/plain", true)}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "papers/demo.tex")}
          t={translate}
        />,
      ),
      plainText: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile("src/example.ts", "D:\\workspace\\src\\example.ts", "line one\r\nline two", "text/plain", false)}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "src/example.ts")}
          t={translate}
        />,
      ),
      workbookShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile(
            "sheets/report.xlsx",
            "D:\\workspace\\sheets\\report.xlsx",
            null,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            true,
          )}
          parsedArtifact={{
            kind: "spreadsheet",
            proto: {},
          }}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "sheets/report.xlsx")}
          t={translate}
        />,
      ),
      pptxShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile(
            "slides/deck.pptx",
            "D:\\workspace\\slides\\deck.pptx",
            null,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            true,
          )}
          parsedArtifact={{
            kind: "presentation",
            proto: {},
          }}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "slides/deck.pptx")}
          t={translate}
        />,
      ),
      ipynbShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile("notebooks/demo.ipynb", "D:\\workspace\\notebooks\\demo.ipynb", null, "application/x-ipynb+json", true)}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "notebooks/demo.ipynb")}
          t={translate}
          binaryContents={new TextEncoder().encode(
            JSON.stringify({
              cells: [
                {
                  cell_type: "markdown",
                  source: [
                    "# Analysis\n",
                    "Notebook intro\n\n",
                    "| Name | Value |\n",
                    "| --- | --- |\n",
                    "| alpha | 1 |\n\n",
                    "- [x] shipped\n",
                    "- [ ] next step\n\n",
                    "![Notebook chart](https://example.com/notebook-chart.png)\n\n",
                    "![Notebook demo reel](https://example.com/notebook-demo.mp4)",
                  ],
                },
                {
                  cell_type: "code",
                  execution_count: 3,
                  metadata: {
                    codexNotebook: {
                      descriptionMarkdown: "Run `summary()` and inspect the <strong>output</strong>.",
                    },
                  },
                  outputs: [
                    {
                      output_type: "stream",
                      text: ["ready\n"],
                    },
                  ],
                  source: ["summary()"],
                },
              ],
              metadata: {
                title: "Demo Notebook",
              },
            }),
          )}
        />,
      ),
      csvSourceOwner: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile("data/report.csv", "D:\\workspace\\data\\report.csv", "name,value\r\nalpha,1", "text/csv", false)}
          ownerShellContext={{
            ...ownerShellContext,
            artifactRichPreviewEnabled: false,
          }}
          selectedFileTarget={buildTarget(workspaceRoot, "data/report.csv")}
          t={translate}
        />,
      ),
      docxShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          file={buildFile(
            "docs/report.docx",
            "D:\\workspace\\docs\\report.docx",
            null,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            true,
          )}
          ownerShellContext={ownerShellContext}
          selectedFileTarget={buildTarget(workspaceRoot, "docs/report.docx")}
          t={translate}
          binaryContents={new Uint8Array([80, 75, 3, 4])}
        />,
      ),
      docxDocumentShell: renderSnapshot(
        <WorkspaceFilePreviewContent
          artifactPreviewGateEnabled
          file={buildFile(
            "docs/report.docx",
            "D:\\workspace\\docs\\report.docx",
            null,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            true,
          )}
          ownerShellContext={ownerShellContext}
          parsedArtifact={{
            kind: "document",
            proto: {},
          }}
          selectedFileTarget={buildTarget(workspaceRoot, "docs/report.docx")}
          t={translate}
        />,
      ),
      unsupportedState: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "unsupported",
            unsupportedKind: "wordDocument",
          }}
          previewTitle="report.doc"
          t={translate}
        />,
      ),
      unsupportedStateOwner: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          ownerShellContext={ownerShellContext}
          previewState={{
            kind: "unsupported",
            unsupportedKind: "wordDocument",
          }}
          previewTitle="report.doc"
          selectedFileTarget={buildTarget(workspaceRoot, "docs/report.doc")}
          t={translate}
        />,
      ),
      tooLargeState: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "tooLarge",
            sizeBytes: 42 * 1024 * 1024,
          }}
          previewTitle="large.csv"
          t={translate}
        />,
      ),
      tooLargeStateOwner: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          ownerShellContext={ownerShellContext}
          previewState={{
            kind: "tooLarge",
            sizeBytes: 42 * 1024 * 1024,
          }}
          previewTitle="large.csv"
          selectedFileTarget={buildTarget(workspaceRoot, "data/large.csv")}
          t={translate}
        />,
      ),
      errorState: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          previewState={{
            kind: "error",
          }}
          previewTitle="broken.xlsx"
          t={translate}
        />,
      ),
      errorStateOwner: renderSnapshot(
        <WorkspaceFilePreviewStateContent
          ownerShellContext={ownerShellContext}
          previewState={{
            kind: "error",
          }}
          previewTitle="broken.xlsx"
          selectedFileTarget={buildTarget(workspaceRoot, "broken.xlsx")}
          t={translate}
        />,
      ),
      pdbLoadingOverlay: renderSnapshot(<PdbPreviewLoadingOverlay />),
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
  csvSourceOwner: string;
  docxDocumentShell: string;
  docxShell: string;
  errorState: string;
  errorStateOwner: string;
  ipynbShell: string;
  pdfReadyAnnotatingWithComments: string;
  pdfLoadingShell: string;
  pdfPresentation: string;
  pdfReadyInverted: string;
  pdfReadyWithComments: string;
  plainText: string;
  pdbLoadingOverlay: string;
  pptxShell: string;
  texShell: string;
  tooLargeState: string;
  tooLargeStateOwner: string;
  unsupportedState: string;
  unsupportedStateOwner: string;
  workbookShell: string;
  workspacePdf: string;
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

function buildTarget(workspaceRoot: string, relativePath: string): WorkspaceFilePreviewTarget {
  const name = relativePath.split(/[\\/]+/).at(-1) ?? relativePath;
  return {
    name,
    path: `${workspaceRoot}\\${relativePath.replaceAll("/", "\\")}`,
    relativePath,
    workspaceRoot,
  };
}

function buildPdfComment({
  body,
  line,
  pageNumber,
  path,
}: {
  body: string;
  line: number;
  pageNumber: number;
  path: string;
}): ThreadConversationUserComment {
  return {
    body,
    content: [
      {
        contentType: "text",
        text: body,
      },
    ],
    lineRange: null,
    localPdfCommentMetadata: {
      kind: "region",
      pageRect: {
        height: 48,
        width: 168,
        x: 120,
        y: 216,
      },
      pageSize: {
        height: 792,
        width: 612,
      },
    },
    localPdfContext: {
      pageCount: 3,
      pageNumber,
      path,
      title: "report.pdf",
    },
    origin: "PDF",
    path,
    position: {
      line,
      path: "pdf:report.pdf",
    },
  };
}

const translate = (key: string) => key;

function renderSnapshot(element: ReactElement) {
  return renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>);
}
