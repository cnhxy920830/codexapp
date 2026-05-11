import { useMemo, type ReactNode } from "react";
import {
  buildPullRequestSplitPreviewRows,
  buildPullRequestUnifiedPreviewLines,
  type PullRequestDiffFragment,
  type PullRequestSplitPreviewRow,
  type PullRequestUnifiedPreviewLine,
} from "../lib/diffPreviewModel";
import type { PullRequestDiffFile } from "../lib/unifiedDiff";

type DiffPreviewProps = {
  file: PullRequestDiffFile;
  isWhitespaceHidden: boolean;
  isWordDiffsEnabled: boolean;
  isWrapEnabled: boolean;
};

export function RichDiffPreview({
  file,
  isWhitespaceHidden,
  isWordDiffsEnabled,
  isWrapEnabled,
}: DiffPreviewProps) {
  const lines = useMemo(
    () =>
      buildPullRequestUnifiedPreviewLines(file.patch, {
        hideWhitespace: isWhitespaceHidden,
        wordDiffsEnabled: isWordDiffsEnabled,
      }),
    [file.patch, isWhitespaceHidden, isWordDiffsEnabled],
  );

  return (
    <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
      {lines.map((line, index) => renderUnifiedPreviewLine(file.path, line, index, isWrapEnabled))}
    </DiffPreviewShell>
  );
}

export function SplitDiffPreview({
  file,
  isWhitespaceHidden,
  isWordDiffsEnabled,
  isWrapEnabled,
}: DiffPreviewProps) {
  const rows = useMemo(
    () =>
      buildPullRequestSplitPreviewRows(file.patch, {
        hideWhitespace: isWhitespaceHidden,
        wordDiffsEnabled: isWordDiffsEnabled,
      }),
    [file.patch, isWhitespaceHidden, isWordDiffsEnabled],
  );

  return (
    <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
      {rows.map((row, index) => renderSplitPreviewRow(file.path, row, index, isWrapEnabled))}
    </DiffPreviewShell>
  );
}

export function DiffPreviewShell({
  children,
  isWrapEnabled,
}: {
  children: ReactNode;
  isWrapEnabled: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)]">
      <div className={["font-mono text-[12px] leading-6", isWrapEnabled ? "" : "min-w-max"].join(" ")}>
        {children}
      </div>
    </div>
  );
}

function renderUnifiedPreviewLine(
  filePath: string,
  line: PullRequestUnifiedPreviewLine,
  index: number,
  isWrapEnabled: boolean,
) {
  if (!("prefix" in line)) {
    return (
      <div key={`${filePath}:u:${index}`} className={["px-4 py-0.5", unifiedPreviewLineClassName(line.kind)].join(" ")}>
        {line.text}
      </div>
    );
  }

  return (
    <div
      key={`${filePath}:u:${index}`}
      className={[
        "px-4 py-0.5",
        isWrapEnabled ? "whitespace-pre-wrap break-all" : "whitespace-pre",
        unifiedPreviewLineClassName(line.kind),
      ].join(" ")}
    >
      <span className="select-none">{line.prefix === " " ? "\u00a0" : line.prefix}</span>
      {renderPreviewFragments(line.fragments, line.kind, isWrapEnabled)}
    </div>
  );
}

function renderSplitPreviewRow(
  filePath: string,
  row: PullRequestSplitPreviewRow,
  index: number,
  isWrapEnabled: boolean,
) {
  if (!("leftFragments" in row)) {
    return (
      <div
        key={`${filePath}:s:${index}`}
        className={["border-b border-[var(--app-shell-border)] px-4 py-0.5", splitPreviewRowClassName(row.kind)].join(" ")}
      >
        {row.text}
      </div>
    );
  }

  const leftCellClassName = splitPreviewCellClassName(row.kind, "left");
  const rightCellClassName = splitPreviewCellClassName(row.kind, "right");

  return (
    <div
      key={`${filePath}:s:${index}`}
      className={[
        "grid grid-cols-2 border-b border-[var(--app-shell-border)]",
        isWrapEnabled ? "whitespace-pre-wrap" : "whitespace-pre",
      ].join(" ")}
    >
      <div className={["min-w-0 border-r border-[var(--app-shell-border)] px-4 py-0.5", leftCellClassName].join(" ")}>
        {renderPreviewCell(row.leftFragments, row.leftText, row.kind, "left", isWrapEnabled)}
      </div>
      <div className={["min-w-0 px-4 py-0.5", rightCellClassName].join(" ")}>
        {renderPreviewCell(row.rightFragments, row.rightText, row.kind, "right", isWrapEnabled)}
      </div>
    </div>
  );
}

function renderPreviewCell(
  fragments: PullRequestDiffFragment[],
  text: string | null,
  rowKind: PullRequestSplitPreviewRow["kind"],
  side: "left" | "right",
  isWrapEnabled: boolean,
) {
  if (text == null) {
    return <span className="text-[var(--app-shell-muted)]">&nbsp;</span>;
  }

  return (
    <span className={isWrapEnabled ? "whitespace-pre-wrap break-all" : "whitespace-pre"}>
      {renderPreviewFragments(fragments, rowKind, isWrapEnabled, side)}
    </span>
  );
}

function renderPreviewFragments(
  fragments: PullRequestDiffFragment[],
  lineKind: PullRequestUnifiedPreviewLine["kind"] | PullRequestSplitPreviewRow["kind"],
  isWrapEnabled: boolean,
  side?: "left" | "right",
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
          isWrapEnabled ? "whitespace-pre-wrap" : "whitespace-pre",
          fragmentHighlightClassName(lineKind, side),
        ].join(" ")}
      >
        {fragment.text}
      </span>
    );
  });
}

function unifiedPreviewLineClassName(kind: PullRequestUnifiedPreviewLine["kind"]) {
  if (kind === "hunk") {
    return "border-b border-[var(--app-shell-border)] bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (kind === "addition") {
    return "border-b border-[var(--app-shell-border)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return "border-b border-[var(--app-shell-border)] bg-red-500/10 text-red-700 dark:text-red-300";
  }

  if (kind === "context") {
    return "border-b border-[var(--app-shell-border)] text-[var(--app-shell-text)]";
  }

  return "border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]";
}

function splitPreviewRowClassName(kind: PullRequestSplitPreviewRow["kind"]) {
  if (kind === "hunk") {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  return "bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]";
}

function splitPreviewCellClassName(kind: PullRequestSplitPreviewRow["kind"], side: "left" | "right") {
  if (kind === "context") {
    return "text-[var(--app-shell-text)]";
  }

  if (kind === "paired") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return side === "left" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "text-[var(--app-shell-muted)]";
  }

  if (kind === "addition") {
    return side === "right" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-[var(--app-shell-muted)]";
  }

  return "text-[var(--app-shell-text)]";
}

function fragmentHighlightClassName(
  lineKind: PullRequestUnifiedPreviewLine["kind"] | PullRequestSplitPreviewRow["kind"],
  side?: "left" | "right",
) {
  if (lineKind === "deletion" || (lineKind === "paired" && side === "left")) {
    return "bg-red-500/20";
  }

  if (lineKind === "addition" || (lineKind === "paired" && side === "right")) {
    return "bg-emerald-500/20";
  }

  return "";
}
