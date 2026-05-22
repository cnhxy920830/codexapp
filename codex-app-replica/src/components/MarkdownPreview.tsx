import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { CheckIcon, CopyPathIcon } from "./AppShellIcons";
import { MarkdownOwnedLink, useMarkdownHtmlLinkOwner } from "./markdownPreviewLinks";
import {
  MarkdownDetailsDisclosure,
  isMarkdownDetailsDirectiveStart,
  tryParseMarkdownDetailsBlock,
  type MarkdownDetailsBlock,
} from "./markdownPreviewDetails";
import { classifyPromptLink } from "../lib/promptLinks";
import { openFile } from "../services/hostFiles";
import type { AppInfo } from "../services/apps";
import type { PluginSummary } from "../services/plugins";
import type { SkillSummary } from "../services/skills";
import type { MarkdownBrowserLinkHandlers, MarkdownFileLinkReference } from "./markdownLinkTypes";
import { MarkdownMedia, type MarkdownMediaContext } from "./markdownPreviewMedia";
import {
  findInlineMathToken,
  isMarkdownMathCodeFenceLanguage,
  MarkdownMath,
  tryParseMarkdownMathBlock,
  type MarkdownMathBlock,
  type MarkdownMathInlineNode,
} from "./markdownMath";
import { MarkdownMermaid } from "./markdownMermaid";
import { HighlightedCodeSnippet } from "./HighlightedCodeSnippet";

type MarkdownPreviewProps = {
  allowBasicHtml?: boolean;
  apps?: AppInfo[];
  canFileLinkOpenInSidePanel?: ((fileReference: MarkdownFileLinkReference) => boolean) | null;
  className?: string;
  cwd?: string | null;
  hostId?: string | null;
  style?: CSSProperties;
  onExternalLinkOpenInBrowser?: MarkdownBrowserLinkHandlers["onExternalLinkOpenInBrowser"];
  onFileLinkOpen?: ((fileReference: MarkdownFileLinkReference) => void) | null;
  onFileLinkOpenInBrowser?: MarkdownBrowserLinkHandlers["onFileLinkOpenInBrowser"];
  plugins?: PluginSummary[];
  renderCodeBlock?: (args: { content: string; language: string | null }) => ReactNode;
  skills?: SkillSummary[];
  text: string;
  variant?: "appShell" | "notebook";
};

type MarkdownVariant = NonNullable<MarkdownPreviewProps["variant"]>;

type MarkdownBlock =
  | MarkdownMathBlock
  | MarkdownDetailsBlock
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
      html: string;
      type: "html";
    }
  | {
      lines: string[];
      type: "paragraph";
    }
  | {
      items: MarkdownListItem[];
      ordered: boolean;
      type: "list";
    }
  | {
      lines: string[];
      type: "blockquote";
    }
  | {
      headers: string[];
      rows: string[][];
      type: "table";
    }
  | {
      type: "rule";
    };

type MarkdownListItem = {
  lines: string[];
  taskState: "checked" | "unchecked" | null;
};

type InlineNode =
  | MarkdownMathInlineNode
  | {
      children: InlineNode[];
      type: "emphasis" | "strikethrough" | "strong";
    }
  | {
      children: InlineNode[];
      href: string;
      type: "link";
    }
  | {
      alt: string;
      src: string;
      title: string | null;
      type: "image";
    }
  | {
      text: string;
      type: "code" | "text";
    };

type ParsedInlineContent =
  | {
      html: string;
      kind: "html";
    }
  | {
      kind: "nodes";
      nodes: InlineNode[];
    };

type TokenMatch =
  | {
      fullMatch: string;
      index: number;
      innerText: string;
      type: "math";
    }
  | {
      fullMatch: string;
      href: string;
      index: number;
      innerText: string;
      type: "link";
    }
  | {
      alt: string;
      fullMatch: string;
      index: number;
      src: string;
      title: string | null;
      type: "image";
    }
  | {
      fullMatch: string;
      index: number;
      innerText: string;
      type: "code" | "emphasis" | "strikethrough" | "strong";
    };

type MarkdownVariantClasses = {
  blockquote: string;
  codeBlockBody: string;
  codeBlockContainer: string;
  codeBlockHeader: string;
  codeBlockTitle: string;
  detailsBody: string;
  detailsContainer: string;
  detailsIcon: string;
  detailsSummary: string;
  heading1: string;
  heading2: string;
  heading3: string;
  horizontalRule: string;
  html: string;
  image: string;
  imageGrid: string;
  imageSingle: string;
  inlineCode: string;
  link: string;
  list: string;
  mentionChip: string;
  mentionChipInteractive: string;
  mentionPrefix: string;
  paragraph: string;
  root: string;
  tableCell: string;
  tableHead: string;
  tableHeadCell: string;
  tableRow: string;
  tableWrapper: string;
  taskList: string;
};

type MarkdownRenderOptions = {
  allowBasicHtml: boolean;
  apps: AppInfo[];
  mediaContext: MarkdownMediaContext;
  plugins: PluginSummary[];
  renderCodeBlock?: MarkdownPreviewProps["renderCodeBlock"];
  skills: SkillSummary[];
  variant: MarkdownVariant;
  variantClasses: MarkdownVariantClasses;
};

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/;
const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/;
const INLINE_CODE_PATTERN = /`([^`]+)`/;
const STRONG_PATTERN = /\*\*(.+?)\*\*|__(.+?)__/;
const STRIKETHROUGH_PATTERN = /~~(.+?)~~/;
const EMPHASIS_PATTERN = /\*(.+?)\*|_(.+?)_/;
const CODE_FENCE_PATTERN = /^\s*```(.*)$/;
const HEADING_PATTERN = /^\s*(#{1,6})\s+(.*)$/;
const HORIZONTAL_RULE_PATTERN = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const BLOCKQUOTE_PATTERN = /^\s*>\s?(.*)$/;
const LIST_ITEM_PATTERN = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
const TASK_LIST_ITEM_PATTERN = /^\[( |x|X)\]\s+(.*)$/;
const BASIC_HTML_PATTERN = /<\/?[a-zA-Z][^>]*>/;
const TABLE_DIVIDER_CELL_PATTERN = /^:?-{3,}:?$/;
const UNSAFE_BLOCK_TAG_PATTERN =
  /<\s*(script|style|iframe|object|embed|meta|link|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const UNSAFE_SELF_CLOSING_TAG_PATTERN = /<\s*(script|style|iframe|object|embed|meta|link|base)\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_ATTR_PATTERN = /\s+on[a-z-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const URL_ATTR_PATTERN = /\s+(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

const VARIANT_CLASSES: Record<MarkdownVariant, MarkdownVariantClasses> = {
  appShell: {
    blockquote: "border-l-2 border-[var(--app-shell-border)] pl-3 text-[13px] leading-6 text-[var(--app-shell-subtle)]",
    codeBlockBody:
      "overflow-auto p-2 text-[13px] [&_code]:block [&_code]:font-mono [&_code]:text-[12px] [&_code]:leading-6 [&_code]:whitespace-pre-wrap [&_code]:text-[var(--app-shell-foreground)]",
    codeBlockContainer:
      "w-full min-w-0 overflow-clip rounded-[14px] border border-[var(--app-shell-border)] bg-[color-mix(in_srgb,var(--app-shell-text)_4%,transparent)]",
    codeBlockHeader: "flex items-center px-2 py-1 text-sm text-[var(--app-shell-subtle)] select-none",
    codeBlockTitle: "min-w-0 flex-1 truncate",
    detailsBody: "pt-2 [&>*:last-child]:mb-0",
    detailsContainer:
      "group my-3 rounded-[14px] border border-[color-mix(in_srgb,var(--app-shell-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--app-shell-text)_3%,transparent)] px-4 py-3",
    detailsIcon: "icon-2xs shrink-0 -rotate-90 text-[var(--app-shell-subtle)] transition-transform group-open:rotate-0",
    detailsSummary:
      "flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-[var(--app-shell-foreground)] marker:hidden [&::-webkit-details-marker]:hidden",
    heading1: "heading-base mt-1 mb-2 text-[16px] font-semibold leading-7",
    heading2: "mt-3 mb-1.5 text-[13px] font-semibold leading-6",
    heading3: "mt-3 mb-1 text-[13px] font-medium leading-6",
    horizontalRule: "border-t border-[var(--app-shell-border)]",
    html: [
      "text-[13px] leading-6 text-[var(--app-shell-foreground)]",
      "[&_a]:text-[var(--color-link-text)] [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition [&_a:hover]:opacity-80",
      "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--app-shell-border)] [&_blockquote]:pl-4 [&_blockquote]:italic",
      "[&_code]:rounded-[6px] [&_code]:bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
      "[&_pre]:overflow-x-auto [&_pre]:rounded-[14px] [&_pre]:bg-[color-mix(in_srgb,var(--app-shell-text)_4%,transparent)] [&_pre]:px-3 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-6 [&_pre]:whitespace-pre-wrap [&_pre]:text-[var(--app-shell-foreground)]",
      "[&_table]:my-4 [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse",
      "[&_thead]:border-b [&_thead]:border-[var(--app-shell-border)]",
      "[&_tr]:border-b [&_tr]:border-[var(--app-shell-border)] [&_tr:last-child]:border-b-0",
      "[&_th]:max-w-48 [&_th]:min-w-16 [&_th]:p-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:whitespace-normal",
      "[&_td]:max-w-48 [&_td]:min-w-16 [&_td]:p-1 [&_td]:align-top [&_td]:whitespace-normal",
      "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1.5",
      "[&_img]:my-3 [&_img]:block [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded-md [&_img]:object-contain [&_img]:shadow-md",
    ].join(" "),
    image: "block max-h-80 max-w-full rounded-md object-contain shadow-md",
    imageGrid: "my-2 flex flex-wrap items-start gap-3 text-left",
    imageSingle: "my-2 text-left",
    inlineCode:
      "rounded-[6px] bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)] px-1 py-0.5 font-mono text-[12px]",
    link: "cursor-pointer text-left text-[var(--color-link-text)] underline underline-offset-2 transition hover:opacity-80",
    list: "space-y-2 pl-5 text-[13px] leading-6 text-[var(--app-shell-foreground)]",
    mentionChip:
      "group/inline-mention inline cursor-pointer px-0.5 align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-link-text)_80%,var(--app-shell-foreground)_20%)]",
    mentionChipInteractive:
      "group/inline-mention inline appearance-none cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-link-text)_80%,var(--app-shell-foreground)_20%)] hover:underline hover:decoration-current hover:decoration-dashed hover:decoration-[0.5px] hover:underline-offset-2",
    mentionPrefix: "",
    paragraph: "text-[13px] leading-6 text-[var(--app-shell-foreground)]",
    root: "space-y-3",
    tableCell: "max-w-48 min-w-16 p-1 align-top whitespace-normal",
    tableHead: "border-b border-[var(--app-shell-border)]",
    tableHeadCell: "max-w-48 min-w-16 p-1 text-left align-top font-semibold whitespace-normal",
    tableRow: "border-b border-[var(--app-shell-border)] last:border-b-0",
    tableWrapper: "my-4 overflow-x-auto overflow-y-hidden",
    taskList: "space-y-2 pl-0 text-[13px] leading-6 text-[var(--app-shell-foreground)]",
  },
  notebook: {
    blockquote: "border-l-2 border-token-border pl-3 text-[13px] leading-6 text-token-text-tertiary",
    codeBlockBody:
      "overflow-auto p-2 text-size-chat [&_code]:block [&_code]:font-mono [&_code]:text-xs [&_code]:whitespace-pre-wrap [&_code]:text-token-text-primary",
    codeBlockContainer: "w-full min-w-0 overflow-clip rounded-lg border border-token-input-background bg-token-text-code-block-background",
    codeBlockHeader: "flex items-center px-2 py-1 text-sm text-token-description-foreground select-none",
    codeBlockTitle: "min-w-0 flex-1 truncate",
    detailsBody: "pt-2 [&>*:last-child]:mb-0",
    detailsContainer: "group my-3 rounded-xl border border-token-border/30 bg-token-bg-secondary/15 px-4 py-3",
    detailsIcon: "icon-2xs shrink-0 -rotate-90 text-token-text-tertiary transition-transform group-open:rotate-0",
    detailsSummary:
      "text-size-chat flex cursor-pointer list-none items-center gap-1.5 font-medium text-token-foreground marker:hidden [&::-webkit-details-marker]:hidden",
    heading1: "mt-1 mb-2 text-[16px] font-semibold leading-7",
    heading2: "mt-3 mb-1.5 text-[13px] font-semibold leading-6",
    heading3: "mt-3 mb-1 text-[13px] font-medium leading-6",
    horizontalRule: "border-t border-token-border",
    html: [
      "text-[13px] leading-6 text-token-text-primary",
      "[&_a]:text-[var(--color-link-text)] [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition [&_a:hover]:opacity-80",
      "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-token-border [&_blockquote]:pl-4 [&_blockquote]:italic",
      "[&_code]:rounded-[6px] [&_code]:bg-token-text-code-block-background/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
      "[&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-token-text-code-block-background/20 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:whitespace-pre-wrap [&_pre]:text-token-text-primary",
      "[&_table]:my-4 [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse",
      "[&_thead]:border-b [&_thead]:border-token-border",
      "[&_tr]:border-b [&_tr]:border-token-border [&_tr:last-child]:border-b-0",
      "[&_th]:max-w-48 [&_th]:min-w-16 [&_th]:p-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:whitespace-normal",
      "[&_td]:max-w-48 [&_td]:min-w-16 [&_td]:p-1 [&_td]:align-top [&_td]:whitespace-normal",
      "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1.5",
      "[&_img]:my-3 [&_img]:block [&_img]:max-h-[640px] [&_img]:max-w-full [&_img]:rounded-md [&_img]:object-contain [&_img]:shadow-md",
    ].join(" "),
    image: "block max-h-[640px] max-w-full rounded-md object-contain shadow-md",
    imageGrid: "my-2 flex flex-wrap items-start gap-3 text-left",
    imageSingle: "my-2 text-left",
    inlineCode: "rounded-[6px] bg-token-text-code-block-background/20 px-1 py-0.5 font-mono text-[12px]",
    link: "cursor-pointer text-left text-[var(--color-link-text)] underline underline-offset-2 transition hover:opacity-80",
    list: "space-y-2 pl-5 text-[13px] leading-6 text-token-text-primary",
    mentionChip:
      "group/inline-mention inline-mention-brand-aware inline cursor-pointer px-0.5 align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)]",
    mentionChipInteractive:
      "group/inline-mention inline-mention-brand-aware inline appearance-none cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)] hover:underline hover:decoration-current hover:decoration-dashed hover:decoration-[0.5px] hover:underline-offset-2",
    mentionPrefix: "",
    paragraph: "text-[13px] leading-6 text-token-text-primary",
    root: "text-size-chat space-y-3",
    tableCell: "max-w-48 min-w-16 p-1 align-top whitespace-normal",
    tableHead: "border-b border-token-border",
    tableHeadCell: "max-w-48 min-w-16 p-1 text-left align-top font-semibold whitespace-normal",
    tableRow: "border-b border-token-border last:border-b-0",
    tableWrapper: "my-4 overflow-x-auto overflow-y-hidden",
    taskList: "space-y-2 pl-0 text-[13px] leading-6 text-token-text-primary",
  },
};

const COPY_BUTTON_LABEL = "Copy code";
const COPIED_LABEL = "Copied";

export function MarkdownPreview({
  allowBasicHtml = false,
  apps = [],
  canFileLinkOpenInSidePanel = null,
  className,
  cwd = null,
  hostId = null,
  style,
  onExternalLinkOpenInBrowser = null,
  onFileLinkOpen = null,
  onFileLinkOpenInBrowser = null,
  plugins = [],
  renderCodeBlock,
  skills = [],
  text,
  variant = "appShell",
}: MarkdownPreviewProps) {
  const blocks = useMemo(() => parseBlocks(text, allowBasicHtml), [allowBasicHtml, text]);
  const variantClasses = VARIANT_CLASSES[variant];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mediaContext = useMemo<MarkdownMediaContext>(
    () => ({
      canFileLinkOpenInSidePanel,
      cwd,
      hostId,
      onExternalLinkOpenInBrowser,
      onFileLinkOpen,
      onFileLinkOpenInBrowser,
      rootRef,
    }),
    [
      canFileLinkOpenInSidePanel,
      cwd,
      hostId,
      onExternalLinkOpenInBrowser,
      onFileLinkOpen,
      onFileLinkOpenInBrowser,
    ],
  );

  return (
    <div ref={rootRef} className={[variantClasses.root, className ?? ""].join(" ").trim()} style={style}>
      {renderBlocks(blocks, {
        allowBasicHtml,
        apps,
        mediaContext,
        plugins,
        renderCodeBlock,
        skills,
        variant,
        variantClasses,
      })}
    </div>
  );
}

function renderBlocks(blocks: MarkdownBlock[], options: MarkdownRenderOptions) {
  return blocks.map((block, index) => {
    if (block.type === "heading") {
      const className =
        block.level === 1 ? options.variantClasses.heading1 : block.level === 2 ? options.variantClasses.heading2 : options.variantClasses.heading3;
      const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
      return (
        <Tag key={`heading:${index}`} className={className}>
          {renderInlineFragment(block.text, options)}
        </Tag>
      );
    }

    if (block.type === "code") {
      if (isMarkdownMermaidCodeFenceLanguage(block.language)) {
        const fallback =
          options.renderCodeBlock?.({
            content: block.code,
            language: "plaintext",
          }) ?? <MarkdownCodeBlock content={block.code} language="plaintext" variant={options.variant} />;
        return <MarkdownMermaid key={`code:${index}`} code={block.code} fallback={fallback} />;
      }

      const content =
        options.renderCodeBlock?.({
          content: block.code,
          language: block.language,
        }) ?? (
          <HighlightedCodeSnippet
            content={block.code}
            language={block.language ?? "text"}
            showLineNumbers={false}
            shouldWrapCode={true}
          />
        );
      return <Fragment key={`code:${index}`}>{content}</Fragment>;
    }

    if (block.type === "math") {
      return <MarkdownMath key={`math:${index}`} displayMode source={block.source} />;
    }

    if (block.type === "details") {
      const body =
        block.body.trim().length === 0 ? null : renderBlocks(parseBlocks(block.body, options.allowBasicHtml), options);
      return (
        <MarkdownDetailsDisclosure
          key={`details:${index}`}
          block={block}
          body={body}
          classes={{
            body: options.variantClasses.detailsBody,
            container: options.variantClasses.detailsContainer,
            icon: options.variantClasses.detailsIcon,
            summary: options.variantClasses.detailsSummary,
          }}
        />
      );
    }

    if (block.type === "html") {
      return <BasicHtmlBlock key={`html:${index}`} className={options.variantClasses.html} context={options.mediaContext} html={block.html} />;
    }

    if (block.type === "table") {
      return <MarkdownTable key={`table:${index}`} block={block} options={options} />;
    }

    if (block.type === "paragraph") {
      const paragraphText = joinMarkdownLines(block.lines);
      const content = parseInlineContent(paragraphText, options.allowBasicHtml);
      if (content.kind === "html") {
        return (
          <p key={`paragraph:${index}`} className={options.variantClasses.paragraph}>
            <BasicHtmlInline className={options.variantClasses.html} context={options.mediaContext} html={content.html} />
          </p>
        );
      }

      const standaloneImages = extractStandaloneImages(content.nodes);
      if (standaloneImages != null) {
        return (
          <div
            key={`paragraph:${index}`}
            className={standaloneImages.length > 1 ? options.variantClasses.imageGrid : options.variantClasses.imageSingle}
          >
            {standaloneImages.map((image, imageIndex) => (
              <MarkdownImage
                context={options.mediaContext}
                key={`image:${imageIndex}`}
                alt={image.alt}
                src={image.src}
                title={image.title}
                className={options.variantClasses.image}
              />
            ))}
          </div>
        );
      }

      return (
        <p key={`paragraph:${index}`} className={options.variantClasses.paragraph}>
          {renderInlineNodes(content.nodes, options.variantClasses, options.mediaContext, options.apps, options.plugins, options.skills)}
        </p>
      );
    }

    if (block.type === "list") {
      const hasTaskItems = block.items.some((item) => item.taskState != null);
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={`list:${index}`}
          className={
            hasTaskItems
              ? options.variantClasses.taskList
              : [options.variantClasses.list, block.ordered ? "list-decimal" : "list-disc"].join(" ")
          }
        >
          {block.items.map((item, itemIndex) => {
            const nestedBlocks = parseBlocks(item.lines.join("\n"), options.allowBasicHtml);
            if (item.taskState == null) {
              return (
                <li key={`item:${itemIndex}`} className="pl-1">
                  <div className="space-y-2">{renderBlocks(nestedBlocks, options)}</div>
                </li>
              );
            }

            return (
              <li key={`item:${itemIndex}`} className="list-none">
                <div className="flex items-start gap-2">
                  <input
                    checked={item.taskState === "checked"}
                    className="mt-[5px] h-3.5 w-3.5 shrink-0 accent-token-text-primary"
                    disabled
                    readOnly
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1 space-y-2">{renderBlocks(nestedBlocks, options)}</div>
                </div>
              </li>
            );
          })}
        </ListTag>
      );
    }

    if (block.type === "blockquote") {
      return (
        <blockquote key={`blockquote:${index}`} className={options.variantClasses.blockquote}>
          <div className="space-y-2">{renderBlocks(parseBlocks(block.lines.join("\n"), options.allowBasicHtml), options)}</div>
        </blockquote>
      );
    }

    return <hr key={`rule:${index}`} className={options.variantClasses.horizontalRule} />;
  });
}

function MarkdownTable({
  block,
  options,
}: {
  block: Extract<MarkdownBlock, { type: "table" }>;
  options: MarkdownRenderOptions;
}) {
  return (
    <div className={options.variantClasses.tableWrapper}>
      <table className="w-full table-auto border-collapse">
        <thead className={options.variantClasses.tableHead}>
          <tr>
            {block.headers.map((header, index) => (
              <th key={`header:${index}`} className={options.variantClasses.tableHeadCell}>
                {renderInlineFragment(header, options)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`row:${rowIndex}`} className={options.variantClasses.tableRow}>
              {row.map((cell, cellIndex) => (
                <td key={`cell:${rowIndex}:${cellIndex}`} className={options.variantClasses.tableCell}>
                  {renderInlineFragment(cell, options)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownCodeBlock({
  content,
  language,
  variant,
}: {
  content: string;
  language: string | null;
  variant: MarkdownVariant;
}) {
  const [copied, setCopied] = useState(false);
  const classes = VARIANT_CLASSES[variant];
  const title = formatCodeBlockTitle(language);

  useEffect(() => {
    if (!copied || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  return (
    <div className={classes.codeBlockContainer}>
      <div className={classes.codeBlockHeader}>
        <div className={classes.codeBlockTitle}>{title}</div>
        <button
          aria-label={copied ? COPIED_LABEL : COPY_BUTTON_LABEL}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-token-text-tertiary transition hover:bg-token-list-hover-background hover:text-token-text-primary"
          title={copied ? COPIED_LABEL : COPY_BUTTON_LABEL}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
              return;
            }

            void navigator.clipboard.writeText(content).then(
              () => {
                setCopied(true);
              },
              () => {},
            );
          }}
        >
          {copied ? <CheckIcon className="icon-xs" /> : <CopyPathIcon className="icon-xs" />}
        </button>
      </div>
      <div className={classes.codeBlockBody}>
        <code data-language={language ?? undefined}>{content}</code>
      </div>
    </div>
  );
}

function MarkdownImage({
  alt,
  className,
  context,
  src,
  title,
}: {
  alt: string;
  className: string;
  context: MarkdownMediaContext;
  src: string;
  title: string | null;
}) {
  return <MarkdownMedia alt={alt} className={className} context={context} src={src} title={title} />;
}

function renderInlineFragment(text: string, options: MarkdownRenderOptions) {
  const content = parseInlineContent(text, options.allowBasicHtml);
  if (content.kind === "html") {
    return <BasicHtmlInline className={options.variantClasses.html} context={options.mediaContext} html={content.html} />;
  }

  return renderInlineNodes(content.nodes, options.variantClasses, options.mediaContext, options.apps, options.plugins, options.skills);
}

function parseInlineContent(text: string, allowBasicHtml: boolean): ParsedInlineContent {
  if (!allowBasicHtml || !containsBasicHtml(text)) {
    return {
      kind: "nodes",
      nodes: parseInline(text),
    };
  }

  const normalized = normalizeSupportedInlineHtml(text);
  if (!containsBasicHtml(normalized)) {
    return {
      kind: "nodes",
      nodes: parseInline(normalized),
    };
  }

  return {
    html: text,
    kind: "html",
  };
}

function parseBlocks(markdown: string, allowBasicHtml: boolean) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: MarkdownBlock[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";

    if (line.trim().length === 0) {
      lineIndex += 1;
      continue;
    }

    const codeFenceMatch = line.match(CODE_FENCE_PATTERN);
    if (codeFenceMatch) {
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length && !CODE_FENCE_PATTERN.test(lines[lineIndex] ?? "")) {
        codeLines.push(lines[lineIndex] ?? "");
        lineIndex += 1;
      }

      if (lineIndex < lines.length) {
        lineIndex += 1;
      }

      const language = normalizeMarkdownText(codeFenceMatch[1] ?? "");
      if (isMarkdownMathCodeFenceLanguage(language)) {
        blocks.push({
          source: codeLines.join("\n"),
          type: "math",
        });
        continue;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language,
        type: "code",
      });
      continue;
    }

    const detailsBlock = tryParseMarkdownDetailsBlock({
      allowBasicHtml,
      lineIndex,
      lines,
    });
    if (detailsBlock != null) {
      blocks.push(detailsBlock.block);
      lineIndex = detailsBlock.nextLineIndex;
      continue;
    }

    const mathBlock = tryParseMarkdownMathBlock({
      lineIndex,
      lines,
    });
    if (mathBlock != null) {
      blocks.push(mathBlock.block);
      lineIndex = mathBlock.nextLineIndex;
      continue;
    }

    if (allowBasicHtml && isHtmlBlockStart(line)) {
      const htmlLines: string[] = [];
      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex] ?? "";
        if (currentLine.trim().length === 0) {
          break;
        }
        htmlLines.push(currentLine);
        lineIndex += 1;
      }
      blocks.push({
        html: htmlLines.join("\n"),
        type: "html",
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
        level: Math.min(headingMatch[1]?.length ?? 1, 6),
        text: headingMatch[2]?.trim() ?? "",
        type: "heading",
      });
      lineIndex += 1;
      continue;
    }

    const blockquoteMatch = line.match(BLOCKQUOTE_PATTERN);
    if (blockquoteMatch) {
      const blockquoteLines: string[] = [];
      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex] ?? "";
        const currentMatch = currentLine.match(BLOCKQUOTE_PATTERN);
        if (!currentMatch) {
          break;
        }
        blockquoteLines.push(currentMatch[1] ?? "");
        lineIndex += 1;
      }
      blocks.push({
        lines: blockquoteLines,
        type: "blockquote",
      });
      continue;
    }

    const table = tryParseTable(lines, lineIndex, allowBasicHtml);
    if (table != null) {
      blocks.push(table.block);
      lineIndex = table.nextLineIndex;
      continue;
    }

    const listMatch = line.match(LIST_ITEM_PATTERN);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2] ?? "");
      const baseIndent = (listMatch[1] ?? "").length;
      const items: MarkdownListItem[] = [];

      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex] ?? "";
        const currentMatch = currentLine.match(LIST_ITEM_PATTERN);
        if (!currentMatch) {
          break;
        }

        const currentOrdered = /\d+\./.test(currentMatch[2] ?? "");
        const currentIndent = (currentMatch[1] ?? "").length;
        if (currentOrdered !== ordered || currentIndent !== baseIndent) {
          break;
        }

        const taskPrefix = extractTaskPrefix(currentMatch[3] ?? "");
        const itemLines = [taskPrefix.text];
        lineIndex += 1;

        while (lineIndex < lines.length) {
          const continuationLine = lines[lineIndex] ?? "";
          if (continuationLine.trim().length === 0) {
            itemLines.push("");
            lineIndex += 1;
            continue;
          }

          const continuationMatch = continuationLine.match(LIST_ITEM_PATTERN);
          if (continuationMatch && (continuationMatch[1] ?? "").length === baseIndent) {
            break;
          }

          if (leadingWhitespaceLength(continuationLine) <= baseIndent) {
            break;
          }

          itemLines.push(continuationLine.trim());
          lineIndex += 1;
        }

        items.push({
          lines: trimTrailingBlankLines(itemLines),
          taskState: taskPrefix.taskState,
        });
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
      const currentLine = lines[lineIndex] ?? "";
      if (
        currentLine.trim().length === 0 ||
        isBlockBoundary(currentLine, allowBasicHtml) ||
        looksLikeTableStart(lines, lineIndex, allowBasicHtml) ||
        tryParseMarkdownMathBlock({
          lineIndex,
          lines,
        }) != null
      ) {
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

function tryParseTable(lines: string[], lineIndex: number, allowBasicHtml: boolean) {
  if (!looksLikeTableStart(lines, lineIndex, allowBasicHtml)) {
    return null;
  }

  const headerCells = splitMarkdownTableRow(lines[lineIndex] ?? "");
  const rows: string[][] = [];
  let rowIndex = lineIndex + 2;

  while (rowIndex < lines.length) {
    const currentLine = lines[rowIndex] ?? "";
    if (currentLine.trim().length === 0 || isBlockBoundary(currentLine, allowBasicHtml)) {
      break;
    }

    const currentRow = splitMarkdownTableRow(currentLine);
    if (currentRow.length === 0) {
      break;
    }

    rows.push(normalizeTableRow(currentRow, headerCells.length));
    rowIndex += 1;
  }

  return {
    block: {
      headers: headerCells,
      rows,
      type: "table" as const,
    },
    nextLineIndex: rowIndex,
  };
}

function looksLikeTableStart(lines: string[], lineIndex: number, allowBasicHtml: boolean) {
  const currentLine = lines[lineIndex] ?? "";
  const nextLine = lines[lineIndex + 1] ?? "";
  if (
    currentLine.trim().length === 0 ||
    nextLine.trim().length === 0 ||
    (allowBasicHtml && isHtmlBlockStart(currentLine))
  ) {
    return false;
  }

  const headerCells = splitMarkdownTableRow(currentLine);
  const dividerCells = splitMarkdownTableRow(nextLine);
  if (headerCells.length < 2 || dividerCells.length !== headerCells.length) {
    return false;
  }

  return dividerCells.every((cell) => TABLE_DIVIDER_CELL_PATTERN.test(cell.trim()));
}

function isBlockBoundary(line: string, allowBasicHtml: boolean) {
  return (
    CODE_FENCE_PATTERN.test(line) ||
    isMarkdownDetailsDirectiveStart(line) ||
    HORIZONTAL_RULE_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    BLOCKQUOTE_PATTERN.test(line) ||
    LIST_ITEM_PATTERN.test(line) ||
    (allowBasicHtml && isHtmlBlockStart(line))
  );
}

function isHtmlBlockStart(line: string) {
  const trimmed = line.trimStart();
  return trimmed.startsWith("<") && containsBasicHtml(trimmed);
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
    } else if (token.type === "math") {
      nodes.push({
        source: token.innerText,
        type: "math",
      });
    } else if (token.type === "image") {
      nodes.push({
        alt: token.alt,
        src: token.src,
        title: token.title,
        type: "image",
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
    findInlineMathToken(text),
    findImageToken(text),
    findLinkToken(text),
    findStrongToken(text),
    findStrikethroughToken(text),
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
    innerText: match[1] ?? "",
    type: "code",
  };
}

function findImageToken(text: string): TokenMatch | null {
  const match = IMAGE_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  const destination = parseMarkdownLinkDestination(match[2] ?? "");
  return {
    alt: match[1] ?? "",
    fullMatch: match[0],
    index: match.index,
    src: destination.href,
    title: destination.title,
    type: "image",
  };
}

function findLinkToken(text: string): TokenMatch | null {
  const match = LINK_PATTERN.exec(text);
  if (match == null || match.index == null) {
    return null;
  }

  const destination = parseMarkdownLinkDestination(match[2] ?? "");
  return {
    fullMatch: match[0],
    href: destination.href,
    index: match.index,
    innerText: match[1] ?? "",
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

function findStrikethroughToken(text: string): TokenMatch | null {
  const match = STRIKETHROUGH_PATTERN.exec(text);
  if (match == null || match.index == null || !match[1]) {
    return null;
  }

  return {
    fullMatch: match[0],
    index: match.index,
    innerText: match[1],
    type: "strikethrough",
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

function renderInlineNodes(
  nodes: InlineNode[],
  variantClasses: MarkdownVariantClasses,
  mediaContext: MarkdownMediaContext,
  apps: AppInfo[],
  plugins: PluginSummary[],
  skills: SkillSummary[],
) {
  return nodes.map((node, index) => {
    if (node.type === "text") {
      return renderInlineText(node.text, `text:${index}`);
    }

    if (node.type === "code") {
      const inlinePromptLink = parseInlinePromptLink(node.text, apps, plugins, skills);
      if (inlinePromptLink != null) {
        const renderedPromptLink = renderPromptLinkSegment({
          key: `code:${index}`,
          mediaContext,
          segment: inlinePromptLink,
          variantClasses,
        });
        if (renderedPromptLink != null) {
          return renderedPromptLink;
        }
      }

      return (
        <code key={`code:${index}`} className={variantClasses.inlineCode}>
          {node.text}
        </code>
      );
    }

    if (node.type === "math") {
      return <MarkdownMath key={`math:${index}`} displayMode={false} source={node.source} />;
    }

    if (node.type === "image") {
      return (
        <MarkdownImage
          key={`image:${index}`}
          alt={node.alt}
          className={variantClasses.image}
          context={mediaContext}
          src={node.src}
          title={node.title}
        />
      );
    }

    if (node.type === "strong") {
      return (
        <strong key={`strong:${index}`} className="font-semibold">
          {renderInlineNodes(node.children, variantClasses, mediaContext, apps, plugins, skills)}
        </strong>
      );
    }

    if (node.type === "strikethrough") {
      return (
        <del key={`strikethrough:${index}`}>
          {renderInlineNodes(node.children, variantClasses, mediaContext, apps, plugins, skills)}
        </del>
      );
    }

    if (node.type === "emphasis") {
      return (
        <em key={`em:${index}`} className="italic">
          {renderInlineNodes(node.children, variantClasses, mediaContext, apps, plugins, skills)}
        </em>
      );
    }

    if (node.type !== "link") {
      return null;
    }

    const linkLabel = flattenInlineNodesText(node.children).trim();
    const promptLink = classifyPromptLink({
      label: linkLabel,
      href: node.href,
      apps,
      plugins,
      skills,
    });
    const renderedPromptLink = renderPromptLinkSegment({
      key: `link:${index}`,
      mediaContext,
      segment: promptLink,
      variantClasses,
    });
    if (renderedPromptLink != null) {
      return renderedPromptLink;
    }

    return (
      <MarkdownOwnedLink
        key={`link:${index}`}
        className={variantClasses.link}
        context={mediaContext}
        href={node.href}
        title={node.href}
      >
        {renderInlineNodes(node.children, variantClasses, mediaContext, apps, plugins, skills)}
      </MarkdownOwnedLink>
    );
  });
}

function renderInlineText(text: string, keyPrefix: string) {
  const segments = text.split("\n");
  return segments.map((segment, index) => (
    <Fragment key={`${keyPrefix}:${index}`}>
      {index > 0 ? <br /> : null}
      {segment}
    </Fragment>
  ));
}

function flattenInlineNodesText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.text;
        case "math":
          return node.source;
        case "image":
          return node.alt;
        case "emphasis":
        case "link":
        case "strikethrough":
        case "strong":
          return flattenInlineNodesText(node.children);
      }
    })
    .join("");
}

function parseInlinePromptLink(text: string, apps: AppInfo[], plugins: PluginSummary[], skills: SkillSummary[]) {
  const match = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/.exec(text.trim());
  if (match == null) {
    return null;
  }

  const label = match[1] ?? "";
  const href = match[2] ?? "";
  const segment = classifyPromptLink({
    raw: match[0],
    label,
    href,
    apps,
    plugins,
    skills,
  });

  return segment.type === "url" || segment.type === "unknown" ? null : segment;
}

function renderPromptLinkSegment({
  key,
  mediaContext,
  segment,
  variantClasses,
}: {
  key: string;
  mediaContext: MarkdownMediaContext;
  segment: ReturnType<typeof classifyPromptLink>;
  variantClasses: MarkdownVariantClasses;
}) {
  switch (segment.type) {
    case "skill":
      return (
        <MentionChip
          key={key}
          interactive
          className={variantClasses.mentionChipInteractive}
          title={segment.detail ?? segment.path}
          prefix="$"
          label={segment.displayLabel}
          iconSource={segment.iconSource}
          showPrefix={segment.iconSource == null}
          onClick={(event) => {
            event.preventDefault();
            void openFile({
              hostId: mediaContext.hostId ?? null,
              path: segment.path,
            });
          }}
        />
      );
    case "app":
      return (
        <MentionChip
          key={key}
          className={variantClasses.mentionChip}
          title={segment.detail ?? segment.href}
          prefix="@"
          label={segment.displayLabel}
          iconSource={segment.iconSource}
          showPrefix={segment.iconSource == null}
        />
      );
    case "plugin":
      return (
        <MentionChip
          key={key}
          className={variantClasses.mentionChip}
          title={segment.detail ?? segment.href}
          prefix="@"
          label={segment.displayLabel}
          iconSource={segment.iconSource}
          showPrefix={segment.iconSource == null}
          style={getMentionChipStyle(segment.brandColor)}
        />
      );
    case "agent":
      if (segment.conversationId == null && segment.roleName == null) {
        return null;
      }
      return (
        <MentionChip
          key={key}
          className={`${variantClasses.mentionChip} cursor-default`}
          title={segment.href}
          prefix="@"
          label={segment.displayLabel}
          showPrefix
        />
      );
    case "file": {
      const displayLabel = segment.locationSuffix ? `${segment.label}${segment.locationSuffix}` : segment.label;
      return (
        <MarkdownOwnedLink
          key={key}
          className={variantClasses.link}
          context={mediaContext}
          href={segment.href}
          title={segment.href}
        >
          {displayLabel}
        </MarkdownOwnedLink>
      );
    }
    case "url":
      return (
        <MarkdownOwnedLink
          key={key}
          className={variantClasses.link}
          context={mediaContext}
          href={segment.url}
          title={segment.url}
        >
          {segment.label}
        </MarkdownOwnedLink>
      );
    case "unknown":
      return null;
  }
}

function MentionChip({
  className,
  iconSource,
  interactive = false,
  label,
  onClick,
  prefix,
  showPrefix = false,
  style,
  title,
}: {
  className: string;
  iconSource?: string | null;
  interactive?: boolean;
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  prefix: "@" | "$";
  showPrefix?: boolean;
  style?: CSSProperties;
  title: string;
}) {
  const icon = renderMentionChipIcon(iconSource);
  const text = showPrefix ? `${prefix}${label}` : label;
  const content = (
    <>
      {icon}
      <span className="min-w-0 break-words">{text}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={className} title={title} style={style} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className={className} title={title} style={style}>
      {content}
    </span>
  );
}

function renderMentionChipIcon(iconSource: string | null | undefined) {
  const normalizedSource = normalizeMentionIconSource(iconSource ?? null);
  if (normalizedSource == null) {
    return null;
  }

  return (
    <span className="relative mr-1 inline-block h-[1lh] w-4 align-bottom">
      <img
        alt=""
        aria-hidden
        className="icon-xs absolute top-1/2 -translate-y-1/2 rounded-[2px] object-cover"
        src={normalizedSource}
      />
    </span>
  );
}

function normalizeMentionIconSource(iconSource: string | null) {
  if (iconSource == null) {
    return null;
  }

  const trimmed = iconSource.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^(https?:|data:|blob:|file:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return `file:///${trimmed.replaceAll("\\", "/")}`;
  }

  if (trimmed.startsWith("\\\\")) {
    return `file:${trimmed.replaceAll("\\", "/")}`;
  }

  if (trimmed.startsWith("/")) {
    return `file://${trimmed}`;
  }

  return null;
}

function getMentionChipStyle(brandColor: string | null) {
  if (brandColor == null || brandColor.trim().length === 0) {
    return undefined;
  }

  return {
    ["--inline-mention-base-color" as string]: brandColor,
    ["--inline-mention-dark-base-color" as string]: `color-mix(in oklch, ${brandColor} 50%, var(--color-token-foreground, var(--app-shell-foreground)) 50%)`,
  } as CSSProperties;
}

function BasicHtmlBlock({
  className,
  context,
  html,
}: {
  className: string;
  context: MarkdownMediaContext;
  html: string;
}) {
  const htmlLinkOwner = useMarkdownHtmlLinkOwner(context);
  return (
    <>
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(html) }}
        onClick={htmlLinkOwner.onClick}
        onContextMenu={htmlLinkOwner.onContextMenu}
      />
      {htmlLinkOwner.menu}
    </>
  );
}

function BasicHtmlInline({
  className,
  context,
  html,
}: {
  className: string;
  context: MarkdownMediaContext;
  html: string;
}) {
  const htmlLinkOwner = useMarkdownHtmlLinkOwner(context);
  return (
    <>
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(html) }}
        onClick={htmlLinkOwner.onClick}
        onContextMenu={htmlLinkOwner.onContextMenu}
      />
      {htmlLinkOwner.menu}
    </>
  );
}

function sanitizeBasicHtml(html: string) {
  return html
    .replace(UNSAFE_BLOCK_TAG_PATTERN, "")
    .replace(UNSAFE_SELF_CLOSING_TAG_PATTERN, "")
    .replace(EVENT_HANDLER_ATTR_PATTERN, "")
    .replace(
      URL_ATTR_PATTERN,
      (_fullMatch, attributeName: string, _quotedValue: string, doubleQuotedValue?: string, singleQuotedValue?: string, bareValue?: string) => {
        const rawValue = doubleQuotedValue ?? singleQuotedValue ?? bareValue ?? "";
        if (!isSafeHtmlUrl(rawValue)) {
          return "";
        }

        return ` ${attributeName}="${escapeHtmlAttribute(rawValue.trim())}"`;
      },
    );
}

function parseMarkdownLinkDestination(value: string) {
  const trimmed = value.trim();
  const angleBracketMatch = trimmed.match(/^<([^>]+)>(?:\s+"([^"]+)")?$/);
  if (angleBracketMatch) {
    return {
      href: angleBracketMatch[1]?.trim() ?? "",
      title: angleBracketMatch[2] ?? null,
    };
  }

  const titleMatch = trimmed.match(/^(.+?)\s+"([^"]+)"$/);
  if (titleMatch) {
    return {
      href: stripOptionalMarkdownLinkBrackets(titleMatch[1] ?? ""),
      title: titleMatch[2] ?? null,
    };
  }

  return {
    href: stripOptionalMarkdownLinkBrackets(trimmed),
    title: null,
  };
}

function stripOptionalMarkdownLinkBrackets(value: string) {
  if (value.startsWith("<") && value.endsWith(">")) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function isSafeHtmlUrl(url: string) {
  const normalized = url.trim();
  return !/^(javascript:|vbscript:|data:(?!image\/))/i.test(normalized);
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function containsBasicHtml(text: string) {
  return BASIC_HTML_PATTERN.test(text);
}

function normalizeSupportedInlineHtml(text: string) {
  return text
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*(strong|b)\s*>/gi, "**")
    .replace(/<\s*\/\s*(strong|b)\s*>/gi, "**")
    .replace(/<\s*(em|i)\s*>/gi, "*")
    .replace(/<\s*\/\s*(em|i)\s*>/gi, "*")
    .replace(/<\s*(s|del)\s*>/gi, "~~")
    .replace(/<\s*\/\s*(s|del)\s*>/gi, "~~")
    .replace(/<\s*code\s*>/gi, "`")
    .replace(/<\s*\/\s*code\s*>/gi, "`");
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

function extractStandaloneImages(nodes: InlineNode[]) {
  const images: Extract<InlineNode, { type: "image" }>[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text.trim().length === 0) {
      continue;
    }

    if (node.type !== "image") {
      return null;
    }

    images.push(node);
  }

  return images.length > 0 ? images : null;
}

function extractTaskPrefix(value: string) {
  const match = value.match(TASK_LIST_ITEM_PATTERN);
  if (match == null) {
    return {
      taskState: null,
      text: value,
    };
  }

  return {
    taskState: match[1] === " " ? ("unchecked" as const) : ("checked" as const),
    text: match[2] ?? "",
  };
}

function splitMarkdownTableRow(value: string) {
  if (!value.includes("|")) {
    return [];
  }

  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const character of value.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  if (cells[0] === "") {
    cells.shift();
  }
  if (cells[cells.length - 1] === "") {
    cells.pop();
  }

  return cells;
}

function normalizeTableRow(cells: string[], expectedLength: number) {
  if (cells.length === expectedLength) {
    return cells;
  }

  if (cells.length > expectedLength) {
    return cells.slice(0, expectedLength);
  }

  return [...cells, ...Array.from({ length: expectedLength - cells.length }, () => "")];
}

function formatCodeBlockTitle(language: string | null) {
  if (language == null || language.trim().length === 0) {
    return "Code";
  }

  const normalized = language.trim();
  if (normalized.toLowerCase() === "plaintext") {
    return "Plain text";
  }

  return normalized;
}

function isMarkdownMermaidCodeFenceLanguage(language: string | null) {
  if (language == null) {
    return false;
  }

  const normalized = language.trim().toLowerCase().split(/\s+/, 1)[0] ?? "";
  return normalized === "mermaid" || normalized === "language-mermaid";
}

function joinMarkdownLines(lines: string[]) {
  return lines.join(" ");
}

function trimTrailingBlankLines(lines: string[]) {
  const trimmedLines = [...lines];
  while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1]?.trim().length === 0) {
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
