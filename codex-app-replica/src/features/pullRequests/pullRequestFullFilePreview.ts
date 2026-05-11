import type { PullRequestDiffFile } from "./pullRequestDiffModel";
import {
  pairDiffBlock,
  type PullRequestDiffFragment,
  type PullRequestSplitPreviewRow,
  type PullRequestUnifiedPreviewLine,
} from "./pullRequestDiffPreviewModel";

export type PullRequestFullFilePreview = {
  splitRows: PullRequestSplitPreviewRow[];
  unifiedLines: PullRequestUnifiedPreviewLine[];
};

type FullPreviewOptions = {
  hideWhitespace: boolean;
  wordDiffsEnabled: boolean;
};

export function buildPullRequestFullFilePreview(
  file: PullRequestDiffFile,
  oldLines: string[],
  newLines: string[],
  options: FullPreviewOptions,
): PullRequestFullFilePreview {
  const splitRows: PullRequestSplitPreviewRow[] = [];
  const unifiedLines: PullRequestUnifiedPreviewLine[] = [];

  for (const headerLine of file.headerLines) {
    pushPreviewTextLine(splitRows, unifiedLines, "header", headerLine);
  }

  if (file.hunkMetadata.length === 0) {
    const preview = buildFullFilePreviewFromLines(oldLines, newLines, options);
    splitRows.push(...preview.splitRows);
    unifiedLines.push(...preview.unifiedLines);
    return { splitRows, unifiedLines };
  }

  let oldLineIndex = 0;
  let newLineIndex = 0;

  for (const hunk of file.hunkMetadata) {
    pushPreviewTextLine(splitRows, unifiedLines, "hunk", hunk.hunkSpecs);

    while (oldLineIndex < hunk.deletionStart - 1 && newLineIndex < hunk.additionStart - 1) {
      const oldLine = oldLines[oldLineIndex];
      const newLine = newLines[newLineIndex];
      if (oldLine == null || newLine == null) {
        break;
      }

      pushContextLine(splitRows, unifiedLines, oldLine ?? "", newLine ?? "");
      oldLineIndex += 1;
      newLineIndex += 1;
    }

    let segmentIndex = 0;
    while (segmentIndex < hunk.hunkContent.length) {
      const segment = hunk.hunkContent[segmentIndex];
      if (segment.type === "context") {
        for (let index = 0; index < segment.lines; index += 1) {
          pushContextLine(
            splitRows,
            unifiedLines,
            oldLines[oldLineIndex] ?? "",
            newLines[newLineIndex] ?? "",
          );
          oldLineIndex += 1;
          newLineIndex += 1;
        }
        segmentIndex += 1;
        continue;
      }

      const deletions: string[] = [];
      const additions: string[] = [];
      while (segmentIndex < hunk.hunkContent.length && hunk.hunkContent[segmentIndex]?.type === "deletion") {
        deletions.push(oldLines[oldLineIndex] ?? "");
        oldLineIndex += 1;
        segmentIndex += 1;
      }
      while (segmentIndex < hunk.hunkContent.length && hunk.hunkContent[segmentIndex]?.type === "addition") {
        additions.push(newLines[newLineIndex] ?? "");
        newLineIndex += 1;
        segmentIndex += 1;
      }

      pushChangeBlock(splitRows, unifiedLines, deletions, additions, options);
    }
  }

  while (oldLineIndex < oldLines.length && newLineIndex < newLines.length) {
    const oldLine = oldLines[oldLineIndex];
    const newLine = newLines[newLineIndex];
    if (oldLine == null || newLine == null) {
      break;
    }

    pushContextLine(splitRows, unifiedLines, oldLine ?? "", newLine ?? "");
    oldLineIndex += 1;
    newLineIndex += 1;
  }

  return { splitRows, unifiedLines };
}

export function splitPullRequestFileContents(contents: string) {
  const lines = contents.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

function buildFullFilePreviewFromLines(
  oldLines: string[],
  newLines: string[],
  options: FullPreviewOptions,
): PullRequestFullFilePreview {
  const rows = pairDiffBlock(newLines, oldLines, options);
  const splitRows = rows.map((row) => mapChangeRowToSplitRow(row));
  const unifiedLines: PullRequestUnifiedPreviewLine[] = [];

  for (const row of rows) {
    if (row.leftText != null) {
      unifiedLines.push({
        fragments: row.leftFragments,
        kind: "deletion",
        prefix: "-",
        text: row.leftText,
      });
    }

    if (row.rightText != null) {
      unifiedLines.push({
        fragments: row.rightFragments,
        kind: "addition",
        prefix: "+",
        text: row.rightText,
      });
    }
  }

  return { splitRows, unifiedLines };
}

function pushChangeBlock(
  splitRows: PullRequestSplitPreviewRow[],
  unifiedLines: PullRequestUnifiedPreviewLine[],
  deletions: string[],
  additions: string[],
  options: FullPreviewOptions,
) {
  const rows = pairDiffBlock(additions, deletions, options);
  for (const row of rows) {
    splitRows.push(mapChangeRowToSplitRow(row));
    if (row.leftText != null) {
      unifiedLines.push({
        fragments: row.leftFragments,
        kind: "deletion",
        prefix: "-",
        text: row.leftText,
      });
    }
    if (row.rightText != null) {
      unifiedLines.push({
        fragments: row.rightFragments,
        kind: "addition",
        prefix: "+",
        text: row.rightText,
      });
    }
  }
}

function pushContextLine(
  splitRows: PullRequestSplitPreviewRow[],
  unifiedLines: PullRequestUnifiedPreviewLine[],
  oldLine: string,
  newLine: string,
) {
  splitRows.push({
    kind: "context",
    leftFragments: [{ isChanged: false, text: oldLine }],
    leftText: oldLine,
    rightFragments: [{ isChanged: false, text: newLine }],
    rightText: newLine,
  });
  unifiedLines.push({
    fragments: [{ isChanged: false, text: newLine }],
    kind: "context",
    prefix: " ",
    text: newLine,
  });
}

function mapChangeRowToSplitRow(row: {
  leftFragments: PullRequestDiffFragment[];
  leftText: string | null;
  rightFragments: PullRequestDiffFragment[];
  rightText: string | null;
}): PullRequestSplitPreviewRow {
  return {
    kind:
      row.leftText != null && row.rightText != null
        ? "paired"
        : row.leftText != null
          ? "deletion"
          : "addition",
    leftFragments: row.leftFragments,
    leftText: row.leftText,
    rightFragments: row.rightFragments,
    rightText: row.rightText,
  };
}

function pushPreviewTextLine(
  splitRows: PullRequestSplitPreviewRow[],
  unifiedLines: PullRequestUnifiedPreviewLine[],
  kind: "header" | "hunk" | "meta",
  text: string,
) {
  splitRows.push({
    kind,
    text,
  });
  unifiedLines.push({
    kind,
    text,
  });
}
