export type PullRequestDiffFragment = {
  isChanged: boolean;
  text: string;
};

export type PullRequestUnifiedPreviewLine =
  | {
      kind: "header" | "hunk" | "meta";
      text: string;
    }
  | {
      fragments: PullRequestDiffFragment[];
      kind: "addition" | "context" | "deletion";
      prefix: " " | "+" | "-";
      text: string;
    };

export type PullRequestSplitPreviewRow =
  | {
      kind: "header" | "hunk" | "meta";
      text: string;
    }
  | {
      kind: "addition" | "context" | "deletion" | "paired";
      leftFragments: PullRequestDiffFragment[];
      leftText: string | null;
      rightFragments: PullRequestDiffFragment[];
      rightText: string | null;
    };

type PatchEntry =
  | {
      kind: "header" | "hunk" | "meta";
      text: string;
    }
  | {
      kind: "addition" | "context" | "deletion";
      text: string;
    };

type DiffPreviewOptions = {
  hideWhitespace: boolean;
  wordDiffsEnabled: boolean;
};

export function buildPullRequestUnifiedPreviewLines(
  patch: string,
  options: DiffPreviewOptions,
): PullRequestUnifiedPreviewLine[] {
  const entries = parsePatchEntries(patch);
  const lines: PullRequestUnifiedPreviewLine[] = [];
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];
    if (entry.kind === "header" || entry.kind === "hunk" || entry.kind === "meta") {
      lines.push(entry);
      index += 1;
      continue;
    }

    if (entry.kind === "context") {
      lines.push({
        fragments: [{ isChanged: false, text: entry.text }],
        kind: "context",
        prefix: " ",
        text: entry.text,
      });
      index += 1;
      continue;
    }

    const { additions, deletions, nextIndex } = collectChangeBlock(entries, index);
    for (const change of pairDiffBlock(additions, deletions, options)) {
      if (change.leftText != null) {
        lines.push({
          fragments: change.leftFragments,
          kind: "deletion",
          prefix: "-",
          text: change.leftText,
        });
      }
      if (change.rightText != null) {
        lines.push({
          fragments: change.rightFragments,
          kind: "addition",
          prefix: "+",
          text: change.rightText,
        });
      }
    }
    index = nextIndex;
  }

  return lines;
}

export function buildPullRequestSplitPreviewRows(
  patch: string,
  options: DiffPreviewOptions,
): PullRequestSplitPreviewRow[] {
  const entries = parsePatchEntries(patch);
  const rows: PullRequestSplitPreviewRow[] = [];
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];
    if (entry.kind === "header" || entry.kind === "hunk" || entry.kind === "meta") {
      rows.push(entry);
      index += 1;
      continue;
    }

    if (entry.kind === "context") {
      rows.push({
        kind: "context",
        leftFragments: [{ isChanged: false, text: entry.text }],
        leftText: entry.text,
        rightFragments: [{ isChanged: false, text: entry.text }],
        rightText: entry.text,
      });
      index += 1;
      continue;
    }

    const { additions, deletions, nextIndex } = collectChangeBlock(entries, index);
    for (const change of pairDiffBlock(additions, deletions, options)) {
      rows.push({
        kind:
          change.leftText != null && change.rightText != null
            ? "paired"
            : change.leftText != null
              ? "deletion"
              : "addition",
        leftFragments: change.leftFragments,
        leftText: change.leftText,
        rightFragments: change.rightFragments,
        rightText: change.rightText,
      });
    }
    index = nextIndex;
  }

  return rows;
}

function collectChangeBlock(entries: PatchEntry[], startIndex: number) {
  const deletions: string[] = [];
  const additions: string[] = [];
  let index = startIndex;

  while (index < entries.length && entries[index]?.kind === "deletion") {
    deletions.push(entries[index]!.text);
    index += 1;
  }
  while (index < entries.length && entries[index]?.kind === "addition") {
    additions.push(entries[index]!.text);
    index += 1;
  }

  return { additions, deletions, nextIndex: index };
}

export function pairDiffBlock(additions: string[], deletions: string[], options: DiffPreviewOptions) {
  const pairedLines: Array<{
    leftFragments: PullRequestDiffFragment[];
    leftText: string | null;
    rightFragments: PullRequestDiffFragment[];
    rightText: string | null;
  }> = [];
  const rowCount = Math.max(additions.length, deletions.length);

  for (let index = 0; index < rowCount; index += 1) {
    const deletedText = deletions[index] ?? null;
    const addedText = additions[index] ?? null;

    if (
      options.hideWhitespace &&
      deletedText != null &&
      addedText != null &&
      normalizeWhitespaceForCompare(deletedText) === normalizeWhitespaceForCompare(addedText)
    ) {
      continue;
    }

    const fragments =
      options.wordDiffsEnabled && deletedText != null && addedText != null
        ? buildWordDiffFragments(deletedText, addedText)
        : {
            left: deletedText == null ? [] : [{ isChanged: false, text: deletedText }],
            right: addedText == null ? [] : [{ isChanged: false, text: addedText }],
          };

    pairedLines.push({
      leftFragments: deletedText == null ? [] : fragments.left,
      leftText: deletedText,
      rightFragments: addedText == null ? [] : fragments.right,
      rightText: addedText,
    });
  }

  return pairedLines;
}

export function buildWordDiffFragments(leftText: string, rightText: string) {
  const leftTokens = tokenizeWordDiffText(leftText);
  const rightTokens = tokenizeWordDiffText(rightText);
  const lcsLengths = buildLcsLengths(leftTokens, rightTokens);
  const operations: Array<{ side: "both" | "left" | "right"; text: string }> = [];
  let leftIndex = leftTokens.length;
  let rightIndex = rightTokens.length;

  while (leftIndex > 0 && rightIndex > 0) {
    if (leftTokens[leftIndex - 1] === rightTokens[rightIndex - 1]) {
      operations.unshift({ side: "both", text: leftTokens[leftIndex - 1] });
      leftIndex -= 1;
      rightIndex -= 1;
      continue;
    }

    if (lcsLengths[leftIndex - 1][rightIndex] >= lcsLengths[leftIndex][rightIndex - 1]) {
      operations.unshift({ side: "left", text: leftTokens[leftIndex - 1] });
      leftIndex -= 1;
      continue;
    }

    operations.unshift({ side: "right", text: rightTokens[rightIndex - 1] });
    rightIndex -= 1;
  }

  while (leftIndex > 0) {
    operations.unshift({ side: "left", text: leftTokens[leftIndex - 1] });
    leftIndex -= 1;
  }
  while (rightIndex > 0) {
    operations.unshift({ side: "right", text: rightTokens[rightIndex - 1] });
    rightIndex -= 1;
  }

  const leftFragments: PullRequestDiffFragment[] = [];
  const rightFragments: PullRequestDiffFragment[] = [];

  for (const operation of operations) {
    switch (operation.side) {
      case "both":
        appendFragment(leftFragments, false, operation.text);
        appendFragment(rightFragments, false, operation.text);
        break;
      case "left":
        appendFragment(leftFragments, true, operation.text);
        break;
      case "right":
        appendFragment(rightFragments, true, operation.text);
        break;
    }
  }

  if (leftFragments.length === 0) {
    leftFragments.push({ isChanged: false, text: leftText });
  }
  if (rightFragments.length === 0) {
    rightFragments.push({ isChanged: false, text: rightText });
  }

  return { left: leftFragments, right: rightFragments };
}

function appendFragment(
  fragments: PullRequestDiffFragment[],
  isChanged: boolean,
  text: string,
) {
  if (text.length === 0) {
    return;
  }

  const previous = fragments[fragments.length - 1];
  if (previous && previous.isChanged === isChanged) {
    previous.text += text;
    return;
  }

  fragments.push({ isChanged, text });
}

function buildLcsLengths(leftTokens: string[], rightTokens: string[]) {
  const lengths = Array.from({ length: leftTokens.length + 1 }, () =>
    Array<number>(rightTokens.length + 1).fill(0),
  );

  for (let leftIndex = 1; leftIndex <= leftTokens.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= rightTokens.length; rightIndex += 1) {
      if (leftTokens[leftIndex - 1] === rightTokens[rightIndex - 1]) {
        lengths[leftIndex][rightIndex] = lengths[leftIndex - 1][rightIndex - 1] + 1;
        continue;
      }

      lengths[leftIndex][rightIndex] = Math.max(
        lengths[leftIndex - 1][rightIndex],
        lengths[leftIndex][rightIndex - 1],
      );
    }
  }

  return lengths;
}

function tokenizeWordDiffText(text: string) {
  return text.match(/\w+|\s+|[^\w\s]+/g) ?? [text];
}

function normalizeWhitespaceForCompare(text: string) {
  return text.replace(/[ \t\r\n\f\v]/g, "");
}

function parsePatchEntries(patch: string): PatchEntry[] {
  const entries: PatchEntry[] = [];
  let insideHunk = false;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      entries.push({ kind: "hunk", text: line });
      insideHunk = true;
      continue;
    }

    if (isPatchHeaderLine(line)) {
      entries.push({ kind: "header", text: line });
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      entries.push({ kind: "meta", text: line });
      continue;
    }

    if (insideHunk && line.startsWith("-") && !line.startsWith("---")) {
      entries.push({ kind: "deletion", text: line.slice(1) });
      continue;
    }

    if (insideHunk && line.startsWith("+") && !line.startsWith("+++")) {
      entries.push({ kind: "addition", text: line.slice(1) });
      continue;
    }

    if (insideHunk) {
      entries.push({
        kind: "context",
        text: line.startsWith(" ") ? line.slice(1) : line,
      });
      continue;
    }

    entries.push({ kind: "header", text: line });
  }

  return entries;
}

function isPatchHeaderLine(line: string) {
  return (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ") ||
    line.startsWith("new file mode ") ||
    line.startsWith("deleted file mode ") ||
    line.startsWith("similarity index ") ||
    line.startsWith("dissimilarity index ") ||
    line.startsWith("Binary files ")
  );
}
