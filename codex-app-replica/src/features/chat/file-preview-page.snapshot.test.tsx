/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FilePreviewPage } from "./FilePreviewPage";
import { PdbPreview } from "./PdbPreview";

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
    pdbPreviewLoaded: renderToStaticMarkup(
      <PdbPreview
        contents={createPdbPreviewContents()}
        filePath="models/alphafold/test-structure.pdb"
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
  pdbPreviewLoaded: string;
};

const translate = (key: string) => key;

function createPdbPreviewContents() {
  return [
    "MODEL        1",
    makePdbAtomLine({
      serial: 1,
      atomName: "CA",
      residueName: "GLY",
      chainId: "A",
      residueNumber: 1,
      x: 11.104,
      y: 13.207,
      z: 9.447,
      bFactor: 95,
      element: "C",
    }),
    makePdbAtomLine({
      serial: 2,
      atomName: "CA",
      residueName: "ALA",
      chainId: "B",
      residueNumber: 2,
      x: 12,
      y: 14,
      z: 10,
      bFactor: 72.5,
      element: "C",
    }),
    "ENDMDL",
    "MODEL        2",
    makePdbAtomLine({
      serial: 3,
      atomName: "CA",
      residueName: "GLY",
      chainId: "A",
      residueNumber: 1,
      x: 10,
      y: 11,
      z: 8,
      bFactor: 88,
      element: "C",
    }),
    makePdbAtomLine({
      serial: 4,
      atomName: "CA",
      residueName: "ALA",
      chainId: "B",
      residueNumber: 2,
      x: 13,
      y: 15,
      z: 11,
      bFactor: 66,
      element: "C",
    }),
    "ENDMDL",
  ].join("\n");
}

function makePdbAtomLine({
  serial,
  atomName,
  residueName,
  chainId,
  residueNumber,
  x,
  y,
  z,
  bFactor,
  element,
}: {
  serial: number;
  atomName: string;
  residueName: string;
  chainId: string;
  residueNumber: number;
  x: number;
  y: number;
  z: number;
  bFactor: number;
  element: string;
}) {
  return [
    "ATOM".padEnd(6, " "),
    String(serial).padStart(5, " "),
    " ",
    atomName.padStart(4, " "),
    " ",
    residueName.padStart(3, " "),
    " ",
    chainId.slice(0, 1),
    String(residueNumber).padStart(4, " "),
    "    ",
    x.toFixed(3).padStart(8, " "),
    y.toFixed(3).padStart(8, " "),
    z.toFixed(3).padStart(8, " "),
    "1.00".padStart(6, " "),
    bFactor.toFixed(2).padStart(6, " "),
    "          ",
    element.padStart(2, " "),
  ].join("");
}
