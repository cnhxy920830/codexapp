import { Children, isValidElement, type ReactNode } from "react";
import { WorkspaceFileIcon } from "../../components/AppShellIcons";
import { classifyPromptLink, normalizeAppMentionName } from "../../lib/promptLinks";
import {
  buildPromptEditorMentionTitle,
  isPromptEditorMentionSegment,
  parsePromptEditorSegments,
  type PromptEditorMentionSegment,
} from "./promptLinks";
import type { PromptEditorMentionCandidate } from "./types";
import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";

export function readMentionState(editor: HTMLDivElement | null) {
  const textBeforeCursor = getVisibleTextBeforeCursor(editor);
  if (textBeforeCursor === null) {
    return null;
  }
  const match = /(^|\s)([@$])([^\s@$]*)$/u.exec(textBeforeCursor);
  if (!match) {
    return null;
  }

  const endIndex = textBeforeCursor.length;
  return {
    symbol: match[2] as "@" | "$",
    startIndex: endIndex - match[2].length - match[3].length,
    endIndex,
    query: match[3] ?? "",
  };
}

export function getMentionStateForSymbol<TState extends { symbol: "@" | "$" }>(
  mentionState: TState | null,
  symbol: TState["symbol"],
) {
  if (mentionState?.symbol !== symbol) {
    return null;
  }

  return mentionState;
}

export function getMentionSignature(
  mentionState: { symbol: "@" | "$"; startIndex: number; endIndex: number; query: string } | null,
) {
  if (mentionState === null) {
    return null;
  }
  return `${mentionState.symbol}:${mentionState.startIndex}:${mentionState.endIndex}:${mentionState.query}`;
}

export function focusPromptEditorAtEnd(editor: HTMLDivElement | null) {
  if (!editor) {
    return;
  }
  editor.focus();
  restoreSelectionByVisibleIndex(editor, editor.textContent?.length ?? 0);
}

export function isCursorAtStart(editor: HTMLDivElement | null) {
  if (!editor) {
    return false;
  }
  const selection = editor.ownerDocument.getSelection();
  if (!selection || !selection.isCollapsed) {
    return false;
  }
  return getVisibleSelectionIndex(editor) === 0;
}

export function getVisibleSelectionIndex(editor: HTMLDivElement) {
  return getVisibleTextBeforeCursor(editor)?.length ?? editor.textContent?.length ?? 0;
}

export function serializePromptEditorValue(editor: HTMLDivElement) {
  return Array.from(editor.childNodes)
    .map((node) => serializePromptEditorNode(node))
    .join("")
    .replace(/\u00A0/g, " ");
}

export function renderPromptEditorValue(
  editor: HTMLDivElement,
  value: string,
  apps: AppInfo[],
  skills: SkillSummary[],
) {
  const documentRef = editor.ownerDocument;
  const fragment = documentRef.createDocumentFragment();
  const segments = parsePromptEditorSegments(value, {
    apps,
    skills,
  });

  for (const segment of segments) {
    if (segment.type === "text") {
      fragment.append(documentRef.createTextNode(segment.value));
      continue;
    }

    if (isPromptEditorMentionSegment(segment)) {
      fragment.append(createPromptMentionNode(documentRef, segment));
      continue;
    }

    if (segment.type === "file") {
      fragment.append(createPromptFileNode(documentRef, segment));
      continue;
    }

    fragment.append(documentRef.createTextNode(segment.raw));
  }

  editor.replaceChildren(fragment);
  editor.normalize();
}

export function restoreSelectionByVisibleIndex(editor: HTMLDivElement, targetIndex: number) {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) {
    return;
  }

  const { node, offset } = findSelectionPositionByVisibleIndex(editor, targetIndex);
  const range = editor.ownerDocument.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function insertPlainTextAtSelection(editor: HTMLDivElement | null, text: string) {
  if (!editor) {
    return;
  }
  const selection = editor.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!isNodeWithinEditor(editor, range.startContainer) || !isNodeWithinEditor(editor, range.endContainer)) {
    return;
  }

  range.deleteContents();
  const textNode = editor.ownerDocument.createTextNode(text);
  range.insertNode(textNode);
  range.setStart(textNode, text.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function replaceVisibleRangeWithMention(
  editor: HTMLDivElement,
  mentionState: { startIndex: number; endIndex: number },
  candidate: PromptEditorMentionCandidate,
) {
  const start = findSelectionPositionByVisibleIndex(editor, mentionState.startIndex);
  const end = findSelectionPositionByVisibleIndex(editor, mentionState.endIndex);
  const range = editor.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  range.deleteContents();

  const fragment = editor.ownerDocument.createDocumentFragment();
  fragment.append(
    createPromptMentionNode(editor.ownerDocument, {
      type: candidate.kind,
      raw: candidate.insertText,
      label: `$${candidate.label}`,
      href: candidate.kind === "skill" ? decodeInsertedFileHref(candidate.insertText) : candidate.insertText,
      displayLabel: candidate.displayLabel,
      detail: candidate.detail,
      iconSource: candidate.iconSource,
      ...(candidate.kind === "app"
        ? {
            appId: candidate.id.replace(/^app:/u, ""),
            name: normalizeAppMentionName(candidate.displayLabel),
          }
        : {
            path: candidate.path,
            brandColor: candidate.brandColor,
          }),
    } as PromptEditorMentionSegment),
  );

  const space = editor.ownerDocument.createTextNode(" ");
  fragment.append(space);
  range.insertNode(fragment);

  const selection = editor.ownerDocument.getSelection();
  if (!selection) {
    return;
  }

  const nextRange = editor.ownerDocument.createRange();
  nextRange.setStart(space, 1);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function getVisibleTextBeforeCursor(editor: HTMLDivElement | null) {
  if (!editor) {
    return null;
  }
  const selection = editor.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!isNodeWithinEditor(editor, range.endContainer)) {
    return null;
  }

  const prefixRange = range.cloneRange();
  prefixRange.selectNodeContents(editor);
  prefixRange.setEnd(range.endContainer, range.endOffset);
  return prefixRange.toString();
}

function isNodeWithinEditor(editor: HTMLDivElement, node: Node) {
  return node === editor || editor.contains(node);
}

function serializePromptEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  if (node.dataset.scratchpadPromptRaw) {
    return node.dataset.scratchpadPromptRaw;
  }

  if (node.tagName === "BR") {
    return "\n";
  }

  const text = Array.from(node.childNodes)
    .map((child) => serializePromptEditorNode(child))
    .join("");

  if (node.tagName === "DIV" || node.tagName === "P") {
    return `${text}\n`;
  }

  return text;
}

function createPromptMentionNode(documentRef: Document, segment: PromptEditorMentionSegment) {
  const token = documentRef.createElement("span");
  token.contentEditable = "false";
  token.dataset.scratchpadPromptRaw = segment.raw;
  const attributePrefix = `${segment.type}-mention`;
  token.setAttribute(`${attributePrefix}-name`, getPromptMentionName(segment));
  token.setAttribute(`${attributePrefix}-display-name`, segment.displayLabel);
  token.setAttribute(`${attributePrefix}-path`, getPromptMentionPath(segment));
  if (segment.type === "agent") {
    token.setAttribute(`${attributePrefix}-conversation-id`, segment.conversationId ?? "");
  } else {
    token.setAttribute(`${attributePrefix}-icon`, segment.iconSource ?? "");
    token.setAttribute(
      `${attributePrefix}-brand-color`,
      "brandColor" in segment ? (segment.brandColor ?? "") : "",
    );
  }
  token.className =
    [
      "inline-flex max-w-full cursor-interaction items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 align-baseline text-[0.95em] leading-[1.35] text-token-foreground",
      segment.type === "agent" ? "hover:opacity-90" : null,
    ]
      .filter(Boolean)
      .join(" ");

  const title = buildPromptEditorMentionTitle(segment);
  if (title) {
    token.title = title;
  }

  const icon = createPromptMentionIconNode(documentRef, segment);

  const label = documentRef.createElement("span");
  label.className = "min-w-0 break-words";
  label.textContent = segment.displayLabel;

  if (icon) {
    token.append(icon);
  }
  token.append(label);
  return token;
}

function createPromptFileNode(
  documentRef: Document,
  segment: Extract<ReturnType<typeof classifyPromptLink>, { type: "file" }>,
) {
  const displayLabel = segment.locationSuffix ? `${segment.label}${segment.locationSuffix}` : segment.label;
  const token = documentRef.createElement("span");
  token.contentEditable = "false";
  token.dataset.scratchpadPromptRaw = segment.raw;
  token.setAttribute("at-mention-label", displayLabel);
  token.setAttribute("at-mention-path", segment.href);
  token.setAttribute("at-mention-fs-path", segment.path);
  token.className =
    "inline-flex max-w-full items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 align-baseline text-[0.95em] leading-[1.35] text-token-foreground";
  token.title = segment.href;

  const icon = createWorkspaceFileIconNode(
    documentRef,
    "h-[0.95em] w-[0.95em] shrink-0 text-token-text-secondary",
  );
  const label = documentRef.createElement("span");
  label.className = "min-w-0 truncate";
  label.textContent = displayLabel;

  if (icon) {
    token.append(icon);
  }
  token.append(label);
  return token;
}

function createWorkspaceFileIconNode(documentRef: Document, className: string) {
  return createDomNodeFromReactNode(documentRef, WorkspaceFileIcon({ className }));
}

function createPromptMentionIconNode(
  documentRef: Document,
  segment: PromptEditorMentionSegment,
) {
  if (segment.type === "agent") {
    return null;
  }

  if (!segment.iconSource) {
    return null;
  }

  const icon = documentRef.createElement("img");
  icon.alt = "";
  icon.ariaHidden = "true";
  icon.draggable = false;
  icon.src = segment.iconSource;
  icon.className = "h-[0.95em] w-[0.95em] shrink-0 rounded-[4px] object-contain";
  return icon;
}

function getPromptMentionName(segment: PromptEditorMentionSegment) {
  if (segment.type === "app") {
    return segment.name;
  }
  const prefix = segment.type === "agent" || segment.type === "plugin" ? "@" : "$";
  return segment.label.startsWith(prefix) ? segment.label.slice(1).trim() : segment.label.trim();
}

function getPromptMentionPath(segment: PromptEditorMentionSegment) {
  switch (segment.type) {
    case "agent":
      return segment.href;
    case "app":
      return segment.href;
    case "plugin":
      return segment.href;
    case "skill":
      return segment.path;
  }
}

function createDomNodeFromReactNode(
  documentRef: Document,
  reactNode: ReactNode,
  namespaceUri?: string,
): Node | null {
  if (reactNode == null || typeof reactNode === "boolean") {
    return null;
  }

  if (typeof reactNode === "string" || typeof reactNode === "number") {
    return documentRef.createTextNode(String(reactNode));
  }

  if (!isValidElement(reactNode) || typeof reactNode.type !== "string") {
    return null;
  }

  const nextNamespaceUri = namespaceUri ?? (reactNode.type === "svg" ? SVG_NAMESPACE_URI : undefined);
  const element = nextNamespaceUri
    ? documentRef.createElementNS(nextNamespaceUri, reactNode.type)
    : documentRef.createElement(reactNode.type);
  const { children, ...attributes } = reactNode.props as Record<string, unknown> & {
    children?: ReactNode;
  };

  applyReactAttributesToDomNode(element, attributes);
  Children.forEach(children, (child) => {
    const childNode = createDomNodeFromReactNode(documentRef, child, nextNamespaceUri);
    if (childNode) {
      element.append(childNode);
    }
  });

  return element;
}

function applyReactAttributesToDomNode(element: Element, attributes: Record<string, unknown>) {
  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    if (attributeName === "children" || attributeValue == null || typeof attributeValue === "function") {
      continue;
    }

    const domAttributeName = toDomAttributeName(attributeName);
    if (typeof attributeValue === "boolean") {
      if (attributeValue) {
        element.setAttribute(domAttributeName, "true");
      }
      continue;
    }

    element.setAttribute(domAttributeName, String(attributeValue));
  }
}

function toDomAttributeName(attributeName: string) {
  if (attributeName === "className") {
    return "class";
  }

  if (attributeName === "viewBox" || attributeName.startsWith("aria-") || attributeName.startsWith("data-")) {
    return attributeName;
  }

  return attributeName.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function findSelectionPositionByVisibleIndex(editor: HTMLDivElement, targetIndex: number) {
  let remaining = Math.max(0, targetIndex);
  const childNodes = Array.from(editor.childNodes);

  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    const child = childNodes[childIndex];
    const textLength = getVisibleNodeLength(child);

    if (remaining === 0) {
      return {
        node: child.nodeType === Node.TEXT_NODE ? child : editor,
        offset: child.nodeType === Node.TEXT_NODE ? 0 : childIndex,
      };
    }

    if (child.nodeType === Node.TEXT_NODE) {
      if (remaining <= textLength) {
        return {
          node: child,
          offset: remaining,
        };
      }
    } else if (remaining <= textLength) {
      return {
        node: editor,
        offset: childIndex + 1,
      };
    }

    remaining -= textLength;
  }

  return {
    node: editor,
    offset: editor.childNodes.length,
  };
}

function getVisibleNodeLength(node: Node) {
  return node.textContent?.length ?? 0;
}

function decodeInsertedFileHref(insertText: string) {
  const match = /\(([^)\n]+)\)/u.exec(insertText);
  return match?.[1] ?? insertText;
}
