import type { ReactNode } from "react";
import { ChevronDownIcon } from "./AppShellIcons";

const DETAILS_DIRECTIVE_START_PATTERN = /^\s*:::\s*github-details(?:\{(.*)\})?\s*$/;
const DETAILS_DIRECTIVE_END_PATTERN = /^\s*:::\s*$/;
const HTML_DETAILS_START_PATTERN = /^\s*<details(?:\s|>)/i;
const HTML_DETAILS_PATTERN = /^\s*<details(\s+open)?\s*>([\s\S]*?)<\/details>\s*$/i;
const HTML_DETAILS_SUMMARY_PATTERN = /^\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*)$/i;
const HTML_TAG_PATTERN = /<[^>]+>/g;

export type MarkdownDetailsBlock = {
  body: string;
  open: boolean;
  summary: string;
  type: "details";
};

export type MarkdownDetailsVariantClasses = {
  body: string;
  container: string;
  icon: string;
  summary: string;
};

export function MarkdownDetailsDisclosure({
  block,
  body,
  classes,
}: {
  block: MarkdownDetailsBlock;
  body: ReactNode;
  classes: MarkdownDetailsVariantClasses;
}) {
  return (
    <details className={classes.container} open={block.open}>
      <summary className={classes.summary}>
        <ChevronDownIcon className={classes.icon} />
        <span>{block.summary}</span>
      </summary>
      <div className={classes.body}>{body}</div>
    </details>
  );
}

export function isMarkdownDetailsDirectiveStart(line: string) {
  return DETAILS_DIRECTIVE_START_PATTERN.test(line);
}

export function tryParseMarkdownDetailsBlock({
  allowBasicHtml,
  lineIndex,
  lines,
}: {
  allowBasicHtml: boolean;
  lineIndex: number;
  lines: string[];
}): {
  block: MarkdownDetailsBlock;
  nextLineIndex: number;
} | null {
  const directiveBlock = tryParseMarkdownDetailsDirective(lines, lineIndex);
  if (directiveBlock != null) {
    return directiveBlock;
  }

  if (!allowBasicHtml) {
    return null;
  }

  return tryParseHtmlDetailsBlock(lines, lineIndex);
}

function tryParseMarkdownDetailsDirective(lines: string[], lineIndex: number) {
  const startLine = lines[lineIndex] ?? "";
  const startMatch = startLine.match(DETAILS_DIRECTIVE_START_PATTERN);
  if (startMatch == null) {
    return null;
  }

  const attributes = parseDirectiveAttributes(startMatch[1] ?? "");
  const summary = normalizeSummaryText(attributes.summary ?? null);
  if (summary == null) {
    return null;
  }

  const bodyLines: string[] = [];
  let nextLineIndex = lineIndex + 1;
  while (nextLineIndex < lines.length) {
    const currentLine = lines[nextLineIndex] ?? "";
    if (DETAILS_DIRECTIVE_END_PATTERN.test(currentLine)) {
      return {
        block: {
          body: bodyLines.join("\n").trim(),
          open: parseDirectiveBoolean(attributes.open ?? null),
          summary,
          type: "details" as const,
        },
        nextLineIndex: nextLineIndex + 1,
      };
    }

    bodyLines.push(currentLine);
    nextLineIndex += 1;
  }

  return null;
}

function tryParseHtmlDetailsBlock(lines: string[], lineIndex: number) {
  const startLine = lines[lineIndex] ?? "";
  if (!HTML_DETAILS_START_PATTERN.test(startLine)) {
    return null;
  }

  const htmlLines: string[] = [];
  let nextLineIndex = lineIndex;
  while (nextLineIndex < lines.length) {
    const currentLine = lines[nextLineIndex] ?? "";
    htmlLines.push(currentLine);
    nextLineIndex += 1;
    if (/<\/details>\s*$/i.test(currentLine.trim())) {
      break;
    }
  }

  const html = htmlLines.join("\n");
  const detailsMatch = html.match(HTML_DETAILS_PATTERN);
  if (detailsMatch == null) {
    return null;
  }

  const summaryMatch = (detailsMatch[2] ?? "").match(HTML_DETAILS_SUMMARY_PATTERN);
  if (summaryMatch == null) {
    return null;
  }

  const summary = normalizeSummaryText(summaryMatch[1] ?? null);
  if (summary == null) {
    return null;
  }

  return {
    block: {
      body: (summaryMatch[2] ?? "").trim(),
      open: detailsMatch[1] != null,
      summary,
      type: "details" as const,
    },
    nextLineIndex,
  };
}

function parseDirectiveAttributes(source: string) {
  const attributes: Record<string, string> = {};
  let index = 0;

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (index >= source.length) {
      break;
    }

    const keyMatch = /^[A-Za-z_][\w-]*/.exec(source.slice(index));
    if (keyMatch == null || keyMatch.index !== 0) {
      break;
    }

    const key = keyMatch[0];
    index += key.length;
    index = skipWhitespace(source, index);
    if (source[index] !== "=") {
      break;
    }

    index += 1;
    index = skipWhitespace(source, index);
    const value = readDirectiveAttributeValue(source, index);
    if (value == null) {
      break;
    }

    attributes[key] = value.value;
    index = value.nextIndex;
  }

  return attributes;
}

function readDirectiveAttributeValue(source: string, index: number) {
  const quote = source[index];
  if (quote === '"' || quote === "'") {
    let cursor = index + 1;
    let escaped = false;

    while (cursor < source.length) {
      const character = source[cursor];
      if (!escaped && character === quote) {
        const rawValue = source.slice(index, cursor + 1);
        return {
          nextIndex: cursor + 1,
          value: parseQuotedDirectiveAttributeValue(rawValue, quote),
        };
      }

      escaped = !escaped && character === "\\";
      if (character !== "\\") {
        escaped = false;
      }
      cursor += 1;
    }

    return null;
  }

  const bareMatch = /^[^\s}]+/.exec(source.slice(index));
  if (bareMatch == null || bareMatch.index !== 0) {
    return null;
  }

  return {
    nextIndex: index + bareMatch[0].length,
    value: bareMatch[0],
  };
}

function parseQuotedDirectiveAttributeValue(value: string, quote: "'" | '"') {
  if (quote === '"') {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  return value
    .slice(1, -1)
    .replaceAll("\\\\", "\\")
    .replaceAll("\\'", "'");
}

function parseDirectiveBoolean(value: string | null) {
  if (value == null) {
    return false;
  }

  return value.trim().toLowerCase() === "true";
}

function normalizeSummaryText(value: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.replace(HTML_TAG_PATTERN, " ").replace(/\s+/g, " ").trim();
  return normalized.length === 0 ? null : normalized;
}

function skipWhitespace(source: string, index: number) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}
