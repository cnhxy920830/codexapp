import { Fragment, useMemo, type MouseEvent } from "react";
import { openInBrowser } from "../../../services/hostFiles";

type SkillMarkdownPreviewProps = {
  text: string;
};

type MarkdownBlock =
  | {
      level: number;
      text: string;
      type: "heading";
    }
  | {
      code: string;
      language: string | null;
      type: "code";
    }
  | {
      lines: string[];
      type: "paragraph";
    }
  | {
      items: string[][];
      ordered: boolean;
      type: "list";
    }
  | {
      lines: string[];
      type: "blockquote";
    }
  | {
      type: "rule";
    };

type InlineNode =
  | {
      children: InlineNode[];
      type: "emphasis" | "strong";
    }
  | {
      children: InlineNode[];
      href: string;
      type: "link";
    }
  | {
      text: string;
      type: "code" | "text";
    };

type TokenMatch =
  | {
      fullMatch: string;
      href: string;
      index: number;
      innerText: string;
      type: "link";
    }
  | {
      fullMatch: string;
      index: number;
      innerText: string;
      type: "code" | "emphasis" | "strong";
    };

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/;
const INLINE_CODE_PATTERN = /`([^`]+)`/;
const STRONG_PATTERN = /\*\*(.+?)\*\*|__(.+?)__/;
const EMPHASIS_PATTERN = /\*(.+?)\*|_(.+?)_/;
const CODE_FENCE_PATTERN = /^\s*```(.*)$/;
const HEADING_PATTERN = /^\s*(#{1,6})\s+(.*)$/;
const HORIZONTAL_RULE_PATTERN = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const BLOCKQUOTE_PATTERN = /^\s*>\s?(.*)$/;
const LIST_ITEM_PATTERN = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

export function SkillMarkdownPreview({ text }: SkillMarkdownPreviewProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4">
      <div className="space-y-3">{renderBlocks(blocks)}</div>
    </div>
  );
}

function renderBlocks(blocks: MarkdownBlock[]) {
  return blocks.map((block, index) => {
    if (block.type === "heading") {
      if (block.level === 1) {
        return (
          <h1 key={`heading:${index}`} className="heading-base mt-1 mb-2 text-[16px] font-semibold leading-7">
            {renderInlineNodes(parseInline(block.text))}
          </h1>
        );
      }

      if (block.level === 2) {
        return (
          <h2 key={`heading:${index}`} className="mt-3 mb-1.5 text-[13px] font-semibold leading-6">
            {renderInlineNodes(parseInline(block.text))}
          </h2>
        );
      }

      return (
        <h3 key={`heading:${index}`} className="mt-3 mb-1 text-[13px] font-medium leading-6">
          {renderInlineNodes(parseInline(block.text))}
        </h3>
      );
    }

    if (block.type === "code") {
      return (
        <pre
          key={`code:${index}`}
          data-language={block.language ?? undefined}
          className="overflow-x-auto rounded-[14px] bg-[color-mix(in_srgb,var(--app-shell-text)_4%,transparent)] px-3 py-3 font-mono text-[12px] leading-6 whitespace-pre-wrap text-[var(--app-shell-foreground)]"
        >
          <code>{block.code}</code>
        </pre>
      );
    }

    if (block.type === "paragraph") {
      return (
        <p key={`paragraph:${index}`} className="text-[13px] leading-6 text-[var(--app-shell-foreground)]">
          {renderInlineNodes(parseInline(joinMarkdownLines(block.lines)))}
        </p>
      );
    }

    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={`list:${index}`}
          className={[
            "space-y-2 pl-5 text-[13px] leading-6 text-[var(--app-shell-foreground)]",
            block.ordered ? "list-decimal" : "list-disc",
          ].join(" ")}
        >
          {block.items.map((itemLines, itemIndex) => (
            <li key={`item:${itemIndex}`} className="pl-1">
              <div className="space-y-2">{renderListItemBlocks(parseBlocks(itemLines.join("\n")))}</div>
            </li>
          ))}
        </ListTag>
      );
    }

    if (block.type === "blockquote") {
      return (
        <blockquote
          key={`blockquote:${index}`}
          className="border-l-2 border-[var(--app-shell-border)] pl-3 text-[13px] leading-6 text-[var(--app-shell-subtle)]"
        >
          <div className="space-y-2">{renderBlocks(parseBlocks(block.lines.join("\n")))}</div>
        </blockquote>
      );
    }

    return <hr key={`rule:${index}`} className="border-t border-[var(--app-shell-border)]" />;
  });
}

function renderListItemBlocks(blocks: MarkdownBlock[]) {
  return blocks.map((block, index) => {
    if (block.type === "paragraph") {
      return (
        <p key={`paragraph:${index}`} className="text-[13px] leading-6 text-[var(--app-shell-foreground)]">
          {renderInlineNodes(parseInline(joinMarkdownLines(block.lines)))}
        </p>
      );
    }

    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={`list:${index}`}
          className={[
            "space-y-2 pl-5 text-[13px] leading-6 text-[var(--app-shell-foreground)]",
            block.ordered ? "list-decimal" : "list-disc",
          ].join(" ")}
        >
          {block.items.map((itemLines, itemIndex) => (
            <li key={`item:${itemIndex}`} className="pl-1">
              <div className="space-y-2">{renderListItemBlocks(parseBlocks(itemLines.join("\n")))}</div>
            </li>
          ))}
        </ListTag>
      );
    }

    if (block.type === "blockquote") {
      return (
        <blockquote
          key={`blockquote:${index}`}
          className="border-l-2 border-[var(--app-shell-border)] pl-3 text-[13px] leading-6 text-[var(--app-shell-subtle)]"
        >
          <div className="space-y-2">{renderBlocks(parseBlocks(block.lines.join("\n")))}</div>
        </blockquote>
      );
    }

    if (block.type === "code") {
      return (
        <pre
          key={`code:${index}`}
          data-language={block.language ?? undefined}
          className="overflow-x-auto rounded-[14px] bg-[color-mix(in_srgb,var(--app-shell-text)_4%,transparent)] px-3 py-3 font-mono text-[12px] leading-6 whitespace-pre-wrap text-[var(--app-shell-foreground)]"
        >
          <code>{block.code}</code>
        </pre>
      );
    }

    if (block.type === "heading") {
      return (
        <div key={`heading:${index}`} className="text-[13px] font-semibold leading-6">
          {renderInlineNodes(parseInline(block.text))}
        </div>
      );
    }

    return <hr key={`rule:${index}`} className="border-t border-[var(--app-shell-border)]" />;
  });
}

function parseBlocks(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: MarkdownBlock[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.trim().length === 0) {
      lineIndex += 1;
      continue;
    }

    const codeFenceMatch = line.match(CODE_FENCE_PATTERN);
    if (codeFenceMatch) {
      const language = normalizeMarkdownText(codeFenceMatch[1]);
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length && !CODE_FENCE_PATTERN.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      if (lineIndex < lines.length) {
        lineIndex += 1;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language,
        type: "code",
      });
      continue;
    }

    if (HORIZONTAL_RULE_PATTERN.test(line)) {
      blocks.push({ type: "rule" });
      lineIndex += 1;
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      blocks.push({
        level: Math.min(headingMatch[1].length, 6),
        text: headingMatch[2].trim(),
        type: "heading",
      });
      lineIndex += 1;
      continue;
    }

    const blockquoteMatch = line.match(BLOCKQUOTE_PATTERN);
    if (blockquoteMatch) {
      const blockquoteLines: string[] = [];
      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex];
        const currentMatch = currentLine.match(BLOCKQUOTE_PATTERN);
        if (!currentMatch) {
          break;
        }
        blockquoteLines.push(currentMatch[1]);
        lineIndex += 1;
      }
      blocks.push({
        lines: blockquoteLines,
        type: "blockquote",
      });
      continue;
    }

    const listMatch = line.match(LIST_ITEM_PATTERN);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const baseIndent = listMatch[1].length;
      const items: string[][] = [];

      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex];
        const currentMatch = currentLine.match(LIST_ITEM_PATTERN);
        if (!currentMatch) {
          break;
        }

        const currentOrdered = /\d+\./.test(currentMatch[2]);
        const currentIndent = currentMatch[1].length;
        if (currentOrdered !== ordered || currentIndent !== baseIndent) {
          break;
        }

        const itemLines = [currentMatch[3]];
        lineIndex += 1;

        while (lineIndex < lines.length) {
          const continuationLine = lines[lineIndex];
          if (continuationLine.trim().length === 0) {
            itemLines.push("");
            lineIndex += 1;
            continue;
          }

          const continuationMatch = continuationLine.match(LIST_ITEM_PATTERN);
          if (continuationMatch && continuationMatch[1].length === baseIndent) {
            break;
          }

          const continuationIndent = leadingWhitespaceLength(continuationLine);
          if (continuationIndent <= baseIndent) {
            break;
          }

          itemLines.push(continuationLine.trim());
          lineIndex += 1;
        }

        items.push(trimTrailingBlankLines(itemLines));
      }

      blocks.push({
        items,
        ordered,
        type: "list",
      });
      continue;
    }

    const paragraphLines: string[] = [];
    while (lineIndex < lines.length) {
      const currentLine = lines[lineIndex];
      if (currentLine.trim().length === 0) {
        break;
      }
      if (isBlockBoundary(currentLine)) {
        break;
      }
      paragraphLines.push(currentLine.trim());
      lineIndex += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        lines: paragraphLines,
        type: "paragraph",
      });
      continue;
    }

    lineIndex += 1;
  }

  return blocks;
}

function isBlockBoundary(line: string) {
  return (
    CODE_FENCE_PATTERN.test(line) ||
    HORIZONTAL_RULE_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    BLOCKQUOTE_PATTERN.test(line) ||
    LIST_ITEM_PATTERN.test(line)
  );
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const token = findNextToken(remaining);
    if (token == null) {
      nodes.push({
        text: remaining,
        type: "text",
      });
      break;
    }

    if (token.index > 0) {
      nodes.push({
        text: remaining.slice(0, token.index),
        type: "text",
      });
    }

    if (token.type === "code") {
      nodes.push({
        text: token.innerText,
        type: "code",
      });
    } else if (token.type === "link") {
      nodes.push({
        children: parseInline(token.innerText),
        href: token.href,
        type: "link",
      });
    } else {
      nodes.push({
        children: parseInline(token.innerText),
        type: token.type,
      });
    }

    remaining = remaining.slice(token.index + token.fullMatch.length);
  }

  return mergeAdjacentTextNodes(nodes);
}

function findNextToken(text: string): TokenMatch | null {
  const candidates: Array<TokenMatch | null> = [
    findInlineCodeToken(text),
    findLinkToken(text),
    findStrongToken(text),
    findEmphasisToken(text),
  ];

  let selectedToken: TokenMatch | null = null;
  for (const candidate of candidates) {
    if (candidate == null) {
      continue;
    }
    if (selectedToken == null || candidate.index < selectedToken.index) {
      selectedToken = candidate;
    }
  }

  return selectedToken;
}

function findInlineCodeToken(text: string): TokenMatch | null {
  const match = INLINE_CODE_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  return {
    fullMatch: match[0],
    index: match.index,
    innerText: match[1],
    type: "code",
  };
}

function findLinkToken(text: string): TokenMatch | null {
  const match = LINK_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  return {
    fullMatch: match[0],
    href: match[2],
    index: match.index,
    innerText: match[1],
    type: "link",
  };
}

function findStrongToken(text: string): TokenMatch | null {
  const match = STRONG_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  const innerText = match[1] ?? match[2];
  if (!innerText) {
    return null;
  }

  return {
    fullMatch: match[0],
    index: match.index,
    innerText,
    type: "strong",
  };
}

function findEmphasisToken(text: string): TokenMatch | null {
  const match = EMPHASIS_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  const innerText = match[1] ?? match[2];
  if (!innerText) {
    return null;
  }

  return {
    fullMatch: match[0],
    index: match.index,
    innerText,
    type: "emphasis",
  };
}

function renderInlineNodes(nodes: InlineNode[]) {
  return nodes.map((node, index) => {
    if (node.type === "text") {
      return <Fragment key={`text:${index}`}>{node.text}</Fragment>;
    }

    if (node.type === "code") {
      return (
        <code
          key={`code:${index}`}
          className="rounded-[6px] bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)] px-1 py-0.5 font-mono text-[12px]"
        >
          {node.text}
        </code>
      );
    }

    if (node.type === "strong") {
      return (
        <strong key={`strong:${index}`} className="font-semibold">
          {renderInlineNodes(node.children)}
        </strong>
      );
    }

    if (node.type === "emphasis") {
      return (
        <em key={`em:${index}`} className="italic">
          {renderInlineNodes(node.children)}
        </em>
      );
    }

    if (node.type === "link") {
      return (
        <button
          key={`link:${index}`}
          type="button"
          onClick={(event) => {
            void handleLinkClick(event, node.href);
          }}
          className="cursor-pointer text-left text-[var(--color-link-text)] underline underline-offset-2 transition hover:opacity-80"
        >
          {renderInlineNodes(node.children)}
        </button>
      );
    }

    return null;
  });
}

async function handleLinkClick(event: MouseEvent<HTMLButtonElement>, href: string) {
  event.preventDefault();

  const normalizedHref = href.trim();
  if (!isExternalLink(normalizedHref)) {
    return;
  }

  await openInBrowser(normalizedHref);
}

function isExternalLink(href: string) {
  return /^(https?:|mailto:)/i.test(href);
}

function mergeAdjacentTextNodes(nodes: InlineNode[]) {
  const mergedNodes: InlineNode[] = [];

  for (const node of nodes) {
    const previousNode = mergedNodes[mergedNodes.length - 1];
    if (node.type === "text" && previousNode?.type === "text") {
      previousNode.text += node.text;
      continue;
    }

    mergedNodes.push(node);
  }

  return mergedNodes;
}

function joinMarkdownLines(lines: string[]) {
  return lines.join(" ");
}

function trimTrailingBlankLines(lines: string[]) {
  const trimmedLines = [...lines];
  while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1].trim().length === 0) {
    trimmedLines.pop();
  }
  return trimmedLines;
}

function leadingWhitespaceLength(value: string) {
  const match = value.match(/^\s*/);
  return match?.[0].length ?? 0;
}

function normalizeMarkdownText(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
