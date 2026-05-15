import { convertFileSrc } from "@tauri-apps/api/core";
import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; alt: string; src: string }
  | { type: "code"; language: string | null; text: string };

type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

export function renderMessageContent(text: string) {
  const blocks = parseBlocks(normalizeText(text));
  return (
    <div className="app-message-markdown space-y-3">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "heading":
      return (
        <div
          key={`h-${index}`}
          className={readHeadingClassName(block.level)}
        >
          {renderInlineTokens(block.text)}
        </div>
      );
    case "paragraph":
      return (
        <p key={`p-${index}`} className="whitespace-pre-wrap break-words text-[14px] leading-6">
          {renderInlineTokens(block.text)}
        </p>
      );
    case "blockquote":
      return (
        <blockquote
          key={`bq-${index}`}
          className="border-l-2 border-[var(--app-shell-border)] pl-3 text-[14px] leading-6 text-[var(--app-shell-subtle)]"
        >
          {renderInlineTokens(block.text)}
        </blockquote>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={`${block.ordered ? "ol" : "ul"}-${index}`}
          className={[
            "space-y-1 pl-5 text-[14px] leading-6",
            block.ordered ? "list-decimal" : "list-disc",
          ].join(" ")}
        >
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`} className="break-words">
              {renderInlineTokens(item)}
            </li>
          ))}
        </ListTag>
      );
    }
    case "image":
      return (
        <figure key={`img-${index}`} className="overflow-hidden rounded-[14px] border border-[var(--app-shell-border)]">
          <img
            src={normalizeImageSrc(block.src)}
            alt={block.alt}
            className="block max-h-[480px] w-full bg-[var(--app-shell-card-bg-weak)] object-contain"
          />
        </figure>
      );
    case "code":
      return (
        <div key={`code-${index}`} className="overflow-hidden rounded-[14px] border border-[var(--app-shell-border)]">
          {block.language ? (
            <div className="border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--app-shell-subtle)]">
              {block.language}
            </div>
          ) : null}
          <pre className="app-code-block overflow-x-auto px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
            <code>{block.text}</code>
          </pre>
        </div>
      );
  }
}

function renderInlineTokens(text: string): ReactNode[] {
  const tokens = parseInlineTokens(text);
  return tokens.map((token, index) => {
    if (token.type === "text") {
      return <span key={`t-${index}`}>{token.value}</span>;
    }
    if (token.type === "code") {
      return (
        <code
          key={`c-${index}`}
          className="rounded-[6px] bg-[var(--app-shell-card-bg-muted)] px-1.5 py-0.5 font-mono text-[12px]"
        >
          {token.value}
        </code>
      );
    }
    return (
      <a
        key={`a-${index}`}
        href={token.href}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
      >
        {token.label}
      </a>
    );
  });
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || null;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "```") {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].trim() === "```") {
        index += 1;
      }
      blocks.push({ type: "code", language, text: codeLines.join("\n") });
      continue;
    }

    const imageMatch = /^!\[(.*)\]\((.+)\)$/.exec(trimmed);
    if (imageMatch) {
      blocks.push({
        type: "image",
        alt: imageMatch[1].trim() || "Image",
        src: imageMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate.startsWith(">")) {
          break;
        }
        quoteLines.push(candidate.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    const listMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index];
        const candidateMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(candidate);
        if (!candidateMatch || (/\d+\./.test(candidateMatch[2]) !== ordered)) {
          break;
        }
        items.push(candidateMatch[3]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index];
      const candidateTrimmed = candidate.trim();
      if (candidateTrimmed.length === 0) {
        break;
      }
      if (
        candidateTrimmed.startsWith("```") ||
        candidateTrimmed.startsWith(">") ||
        /^!\[(.*)\]\((.+)\)$/.test(candidateTrimmed) ||
        /^(\s*)([-*]|\d+\.)\s+/.test(candidate)
      ) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks;
}

function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = "";

  const flushText = () => {
    if (buffer.length === 0) {
      return;
    }
    tokens.push({ type: "text", value: buffer });
    buffer = "";
  };

  for (let index = 0; index < text.length; ) {
    const char = text[index];

    if (char === "`") {
      const closingIndex = text.indexOf("`", index + 1);
      if (closingIndex > index + 1) {
        flushText();
        tokens.push({ type: "code", value: text.slice(index + 1, closingIndex) });
        index = closingIndex + 1;
        continue;
      }
    }

    if (char === "[") {
      const closingBracket = text.indexOf("](", index + 1);
      if (closingBracket > index + 1) {
        const closingParen = text.indexOf(")", closingBracket + 2);
        if (closingParen > closingBracket + 2) {
          flushText();
          tokens.push({
            type: "link",
            label: text.slice(index + 1, closingBracket),
            href: text.slice(closingBracket + 2, closingParen),
          });
          index = closingParen + 1;
          continue;
        }
      }
    }

    if (text.startsWith("http://", index) || text.startsWith("https://", index)) {
      flushText();
      let endIndex = index;
      while (endIndex < text.length && !/\s/.test(text[endIndex])) {
        endIndex += 1;
      }
      const candidate = text.slice(index, endIndex);
      const trimmed = candidate.replace(/[),.;!?]+$/u, "");
      tokens.push({ type: "link", label: trimmed, href: trimmed });
      buffer += candidate.slice(trimmed.length);
      index = endIndex;
      continue;
    }

    buffer += char;
    index += 1;
  }

  flushText();
  return tokens;
}

function normalizeText(text: string) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function readHeadingClassName(level: number) {
  if (level <= 1) {
    return "text-[20px] font-medium leading-7";
  }
  if (level === 2) {
    return "text-[18px] font-medium leading-7";
  }
  if (level === 3) {
    return "text-[16px] font-medium leading-6";
  }
  return "text-[14px] font-medium leading-6";
}

function normalizeImageSrc(src: string) {
  if (/^(?:https?:\/\/|data:|blob:|asset:|file:\/\/|\/)/i.test(src)) {
    return src;
  }
  return convertFileSrc(src);
}
