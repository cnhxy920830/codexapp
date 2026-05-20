import { useEffect, useMemo, useRef } from "react";
import { pairDiffBlock, type PullRequestDiffFragment } from "../../lib/diffPreviewModel";
import { applyAppearanceCssVariables, type AppearanceChromeTheme, type AppearanceVariant } from "../../services/appearanceThemes";

const THEME_PREVIEW_PATCH = `--- a/src/theme-preview.ts
+++ b/src/theme-preview.ts
@@ -1,5 +1,5 @@
 const themePreview: ThemeConfig = {
-  surface: "sidebar",
-  accent: "#2563eb",
-  contrast: 42,
+  surface: "sidebar-elevated",
+  accent: "#0ea5e9",
+  contrast: 68,
 };
`;

const PREVIEW_OPTIONS = {
  hideWhitespace: false,
  wordDiffsEnabled: false,
} as const;

type SplitPreviewRow =
  | {
      kind: "header" | "meta";
      text: string;
    }
  | {
      kind: "hunk";
      newStart: number | null;
      oldStart: number | null;
      text: string;
    }
  | {
      kind: "addition" | "context" | "deletion" | "paired";
      leftFragments: PullRequestDiffFragment[];
      leftLineNumber: number | null;
      leftText: string | null;
      rightFragments: PullRequestDiffFragment[];
      rightLineNumber: number | null;
      rightText: string | null;
    };

export function ThemePreviewCard({
  theme,
  variant,
}: {
  theme: AppearanceChromeTheme;
  variant: AppearanceVariant;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(() => buildSplitPreviewRows(THEME_PREVIEW_PATCH), []);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }
    applyAppearanceCssVariables(rootRef.current, variant, theme);
  }, [theme, variant]);

  return (
    <div
      ref={rootRef}
      data-testid="theme-preview"
      className="overflow-hidden rounded-xl border border-token-border bg-token-main-surface-primary"
      style={{
        colorScheme: variant,
        fontFamily: "var(--app-shell-ui-font-family)",
      }}
    >
      <div className="overflow-x-auto">
        <div className="min-w-max font-mono text-[12px] leading-6" style={{ fontFamily: "var(--app-shell-code-font-family)" }}>
          {rows.map((row, index) => renderSplitRow(row, index))}
        </div>
      </div>
    </div>
  );
}

function renderSplitRow(row: SplitPreviewRow, index: number) {
  switch (row.kind) {
    case "header":
      return null;
    case "meta":
      return (
        <div
          key={`meta:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre" />
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "hunk":
      return (
        <div
          key={`hunk:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-sky-500/10 text-sky-700 dark:text-sky-300"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.oldStart)}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre">{row.text}</div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.newStart)}
          </div>
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "addition":
    case "context":
    case "deletion":
    case "paired":
      return (
        <div
          key={`row:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)]"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(row.leftLineNumber)}
          </div>
          <div
            className={[
              "border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre",
              splitCodeCellClassName(row.kind, "left"),
            ].join(" ")}
          >
            {row.leftText == null ? <span className="text-[var(--app-shell-muted)]">&nbsp;</span> : renderPreviewFragments(row.leftFragments, row.kind, "left")}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(row.rightLineNumber)}
          </div>
          <div
            className={[
              "px-4 py-0.5 whitespace-pre",
              splitCodeCellClassName(row.kind, "right"),
            ].join(" ")}
          >
            {row.rightText == null ? <span className="text-[var(--app-shell-muted)]">&nbsp;</span> : renderPreviewFragments(row.rightFragments, row.kind, "right")}
          </div>
        </div>
      );
  }
}

function renderPreviewFragments(
  fragments: PullRequestDiffFragment[],
  kind: SplitPreviewRow["kind"],
  side: "left" | "right",
) {
  return fragments.map((fragment, index) => {
    if (!fragment.isChanged) {
      return <span key={index}>{fragment.text || " "}</span>;
    }

    return (
      <span
        key={index}
        className={[
          "rounded-[3px] px-0.5 font-medium",
          fragmentHighlightClassName(kind, side),
        ].join(" ")}
      >
        {fragment.text}
      </span>
    );
  });
}

function buildSplitPreviewRows(patch: string) {
  const entries = parsePatchEntries(patch);
  const rows: SplitPreviewRow[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];
    if (entry == null) {
      break;
    }

    if (entry.kind === "header" || entry.kind === "meta") {
      rows.push({
        kind: entry.kind,
        text: entry.text,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "hunk") {
      const hunkHeader = parseHunkHeader(entry.text);
      oldLineNumber = hunkHeader.oldStart ?? oldLineNumber;
      newLineNumber = hunkHeader.newStart ?? newLineNumber;
      rows.push({
        kind: "hunk",
        newStart: hunkHeader.newStart,
        oldStart: hunkHeader.oldStart,
        text: entry.text,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "context") {
      rows.push({
        kind: "context",
        leftFragments: [{ isChanged: false, text: entry.text }],
        leftLineNumber: oldLineNumber,
        leftText: entry.text,
        rightFragments: [{ isChanged: false, text: entry.text }],
        rightLineNumber: newLineNumber,
        rightText: entry.text,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
      index += 1;
      continue;
    }

    const {
      additions,
      deletions,
      nextIndex,
    } = collectNumberedChangeBlock(entries, index, oldLineNumber, newLineNumber);
    for (const [changeIndex, change] of pairDiffBlock(
      additions.map((line) => line.text),
      deletions.map((line) => line.text),
      PREVIEW_OPTIONS,
    ).entries()) {
      const deletion = deletions[changeIndex] ?? null;
      const addition = additions[changeIndex] ?? null;
      rows.push({
        kind:
          change.leftText != null && change.rightText != null
            ? "paired"
            : change.leftText != null
              ? "deletion"
              : "addition",
        leftFragments: change.leftFragments,
        leftLineNumber: deletion?.lineNumber ?? null,
        leftText: change.leftText,
        rightFragments: change.rightFragments,
        rightLineNumber: addition?.lineNumber ?? null,
        rightText: change.rightText,
      });
    }
    oldLineNumber += deletions.length;
    newLineNumber += additions.length;
    index = nextIndex;
  }

  return rows;
}

type NumberedPatchLine = {
  lineNumber: number;
  text: string;
};

function collectNumberedChangeBlock(
  entries: PatchEntry[],
  startIndex: number,
  oldLineNumber: number,
  newLineNumber: number,
) {
  const deletions: NumberedPatchLine[] = [];
  const additions: NumberedPatchLine[] = [];
  let index = startIndex;
  let currentOldLineNumber = oldLineNumber;
  let currentNewLineNumber = newLineNumber;

  while (index < entries.length && entries[index]?.kind === "deletion") {
    deletions.push({
      lineNumber: currentOldLineNumber,
      text: entries[index]!.text,
    });
    currentOldLineNumber += 1;
    index += 1;
  }
  while (index < entries.length && entries[index]?.kind === "addition") {
    additions.push({
      lineNumber: currentNewLineNumber,
      text: entries[index]!.text,
    });
    currentNewLineNumber += 1;
    index += 1;
  }

  return { additions, deletions, nextIndex: index };
}

type PatchEntry =
  | {
      kind: "header" | "hunk" | "meta";
      text: string;
    }
  | {
      kind: "addition" | "context" | "deletion";
      text: string;
    };

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

function parseHunkHeader(text: string) {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
  if (match == null) {
    return {
      newStart: null,
      oldStart: null,
    };
  }

  return {
    newStart: Number(match[2]),
    oldStart: Number(match[1]),
  };
}

function formatLineNumber(value: number | null) {
  return value == null ? "" : String(value);
}

function splitCodeCellClassName(
  kind: "addition" | "context" | "deletion" | "paired",
  side: "left" | "right",
) {
  if (kind === "context") {
    return "text-[var(--app-shell-text)]";
  }

  if (kind === "paired") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "text-[var(--app-shell-muted)]";
  }

  return side === "right"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "text-[var(--app-shell-muted)]";
}

function fragmentHighlightClassName(
  kind: "addition" | "context" | "deletion" | "paired" | "header" | "hunk" | "meta",
  side: "left" | "right",
) {
  if (kind === "deletion" || (kind === "paired" && side === "left")) {
    return "bg-red-500/20";
  }

  if (kind === "addition" || (kind === "paired" && side === "right")) {
    return "bg-emerald-500/20";
  }

  return "";
}
