import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceFileIcon } from "../../components/AppShellIcons";
import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";
import { searchWorkspaceFiles } from "../../services/workspaceFiles";
import {
  onActiveWorkspaceRootsUpdated,
  readActiveWorkspaceRoots,
} from "../../services/workspaceRoots";
import { classifyPromptLink } from "../../lib/promptLinks";
import {
  buildScratchpadAppPromptLink,
  buildScratchpadPromptMentionTitle,
  buildScratchpadSkillPromptLink,
  isScratchpadPromptMentionSegment,
  parseScratchpadPromptSegments,
  type ScratchpadPromptMentionSegment,
} from "./scratchpadPromptLinks";
import {
  buildScratchpadFileMentionCandidate,
  dedupeScratchpadFileMentionCandidates,
  type ScratchpadFileMentionCandidate,
} from "./scratchpadFileMentions";

type ScratchpadPromptInputProps = {
  ariaLabel: string;
  autoFocus: boolean;
  isIndented: boolean;
  onChange: (value: string) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onSubmit: () => void | Promise<void>;
  placeholder: string;
  value: string;
  apps: AppInfo[];
  skills: SkillSummary[];
};

type MentionCandidate =
  | {
      id: string;
      kind: "app";
      label: string;
      displayLabel: string;
      insertText: string;
      detail: string | null;
    }
  | ScratchpadFileMentionCandidate
  | {
      id: string;
      kind: "skill";
      label: string;
      displayLabel: string;
      insertText: string;
      detail: string | null;
      brandColor: string | null;
    };

type MentionState = {
  symbol: "@" | "$";
  startIndex: number;
  endIndex: number;
  query: string;
};

export function ScratchpadPromptInput({
  ariaLabel,
  autoFocus,
  isIndented,
  onChange,
  onIndent,
  onOutdent,
  onSubmit,
  placeholder,
  value,
  apps,
  skills,
}: ScratchpadPromptInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedAppsRef = useRef<AppInfo[] | null>(null);
  const lastRenderedSkillsRef = useRef<SkillSummary[] | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [dismissedMentionSignature, setDismissedMentionSignature] = useState<string | null>(null);
  const [activeWorkspaceRoots, setActiveWorkspaceRoots] = useState<string[]>([]);
  const [fileCandidates, setFileCandidates] = useState<ScratchpadFileMentionCandidate[]>([]);
  const mentionSignature = useMemo(() => getMentionSignature(mentionState), [mentionState]);
  const mentionCandidates = useMemo(() => {
    if (mentionSignature !== null && mentionSignature === dismissedMentionSignature) {
      return [];
    }
    return buildMentionCandidates({
      mentionState,
      apps,
      skills,
      fileCandidates,
    });
  }, [apps, dismissedMentionSignature, fileCandidates, mentionSignature, mentionState, skills]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    focusPromptEditorAtEnd(editorRef.current);
  }, [autoFocus]);

  useEffect(() => {
    setSelectedCandidateIndex(0);
  }, [mentionState?.query, mentionState?.symbol]);

  useEffect(() => {
    if (mentionSignature === null || mentionSignature === dismissedMentionSignature) {
      return;
    }
    setDismissedMentionSignature(null);
  }, [dismissedMentionSignature, mentionSignature]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const refreshActiveRoots = async () => {
      try {
        const response = await readActiveWorkspaceRoots();
        if (!disposed) {
          setActiveWorkspaceRoots(response.roots);
        }
      } catch {
        if (!disposed) {
          setActiveWorkspaceRoots([]);
        }
      }
    };

    void refreshActiveRoots();

    void onActiveWorkspaceRootsUpdated(() => {
      void refreshActiveRoots();
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const currentMentionState = mentionState;
    if (currentMentionState?.symbol !== "@") {
      setFileCandidates([]);
      return;
    }

    if (activeWorkspaceRoots.length === 0) {
      setFileCandidates([]);
      return;
    }

    let cancelled = false;

    void Promise.all(
      activeWorkspaceRoots.map(async (workspaceRoot) => {
        const results = await searchWorkspaceFiles({
          workspaceRoot,
          query: currentMentionState.query,
        });
        return results.map((result) =>
          buildScratchpadFileMentionCandidate({
            result,
            workspaceRoot,
          }),
        );
      }),
    )
      .then((candidateGroups) => {
        if (cancelled) {
          return;
        }
        setFileCandidates(
          dedupeScratchpadFileMentionCandidates(candidateGroups.flat()).slice(0, 8),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setFileCandidates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceRoots, mentionState]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const currentValue = serializePromptEditorValue(editor);
    if (
      currentValue === value &&
      lastRenderedAppsRef.current === apps &&
      lastRenderedSkillsRef.current === skills
    ) {
      setMentionState(readMentionState(editor));
      return;
    }

    const selectionIndex =
      document.activeElement === editor ? getVisibleSelectionIndex(editor) : null;
    renderPromptEditorValue(editor, value, apps, skills);
    if (selectionIndex !== null) {
      restoreSelectionByVisibleIndex(editor, selectionIndex);
    }
    lastRenderedAppsRef.current = apps;
    lastRenderedSkillsRef.current = skills;
    setMentionState(readMentionState(editor));
  }, [apps, skills, value]);

  return (
    <div className="relative min-w-0 flex-1">
      {value.length === 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 py-1.5 text-base text-token-input-placeholder-foreground"
        >
          {placeholder}
        </div>
      ) : null}
      <div
        ref={editorRef}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className="min-h-9 max-h-[25dvh] min-w-0 w-full overflow-y-auto bg-transparent py-1.5 text-base whitespace-pre-wrap break-words text-token-foreground outline-none"
        onInput={() => syncEditorDom()}
        onPaste={(event) => {
          event.preventDefault();
          const pastedText = event.clipboardData.getData("text/plain");
          if (pastedText.length === 0) {
            return;
          }
          insertPlainTextAtSelection(editorRef.current, pastedText);
          syncEditorDom();
        }}
        onKeyDown={(event) => {
          if (mentionCandidates.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedCandidateIndex((current) => (current + 1) % mentionCandidates.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedCandidateIndex((current) =>
                current === 0 ? mentionCandidates.length - 1 : current - 1,
              );
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const candidate = mentionCandidates[selectedCandidateIndex];
              if (candidate) {
                applyCandidate(candidate);
              }
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDismissedMentionSignature(getMentionSignature(readMentionState(editorRef.current)));
              setMentionState(null);
              setSelectedCandidateIndex(0);
              return;
            }
          }

          if (event.key === "Backspace" && isIndented && isCursorAtStart(editorRef.current)) {
            event.preventDefault();
            onOutdent();
            return;
          }

          if (event.key === "Tab") {
            event.preventDefault();
            if (!isIndented) {
              onIndent();
            }
            return;
          }

          if (event.key === "Enter" && (event.shiftKey || event.altKey)) {
            event.preventDefault();
            insertPlainTextAtSelection(editorRef.current, "\n");
            syncEditorDom();
            return;
          }

          if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            void onSubmit();
          }
        }}
        onKeyUp={() => {
          setMentionState(readMentionState(editorRef.current));
        }}
        onMouseUp={() => {
          setMentionState(readMentionState(editorRef.current));
        }}
        onFocus={() => {
          setMentionState(readMentionState(editorRef.current));
        }}
        onBlur={() => {
          setMentionState(null);
        }}
      />
      {mentionCandidates.length > 0 ? (
        <div className="absolute top-full left-0 z-50 mt-2 w-[320px] max-w-full overflow-hidden rounded-[14px] border border-token-border bg-token-bg-primary shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="max-h-[260px] overflow-y-auto p-1.5">
            {mentionCandidates.map((candidate, index) => {
              const isSelected = index === selectedCandidateIndex;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  className={[
                    "flex w-full items-start gap-2 rounded-[10px] px-3 py-2 text-left",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyCandidate(candidate);
                  }}
                >
                  {candidate.kind === "file" ? (
                    <WorkspaceFileIcon className="mt-0.5 h-4 w-4 shrink-0 text-token-text-secondary" />
                  ) : (
                    <span className="mt-0.5 shrink-0 text-[12px] text-token-text-secondary">
                      {candidate.kind === "skill" ? "$" : "@"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-token-foreground">
                      {candidate.displayLabel}
                    </span>
                    {candidate.detail ? (
                      <span className="mt-1 block truncate text-[12px] text-token-text-secondary">
                        {candidate.detail}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );

  function applyCandidate(candidate: MentionCandidate) {
    const editor = editorRef.current;
    const currentMentionState = readMentionState(editor);
    if (editor === null || currentMentionState === null) {
      return;
    }

    replaceVisibleRangeWithMention(editor, currentMentionState, candidate);
    setSelectedCandidateIndex(0);
    syncEditorDom();
    setMentionState(readMentionState(editor));
  }

  function syncEditorDom() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const selectionIndex = getVisibleSelectionIndex(editor);
    const nextValue = serializePromptEditorValue(editor);
    renderPromptEditorValue(editor, nextValue, apps, skills);
    restoreSelectionByVisibleIndex(editor, selectionIndex);
    lastRenderedAppsRef.current = apps;
    lastRenderedSkillsRef.current = skills;
    onChange(nextValue);
    setMentionState(readMentionState(editor));
  }
}

function readMentionState(editor: HTMLDivElement | null): MentionState | null {
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

function buildMentionCandidates(
  {
    mentionState,
    apps,
    skills,
    fileCandidates,
  }: {
    mentionState: MentionState | null;
    apps: AppInfo[];
    skills: SkillSummary[];
    fileCandidates: ScratchpadFileMentionCandidate[];
  },
): MentionCandidate[] {
  if (mentionState === null) {
    return [];
  }

  const normalizedQuery = mentionState.query.trim().toLowerCase();
  if (mentionState.symbol === "@") {
    const appCandidates = apps
      .filter((app) => app.isAccessible)
      .filter((app) => {
        if (normalizedQuery.length === 0) {
          return true;
        }
        return (
          app.name.toLowerCase().includes(normalizedQuery) ||
          (app.description ?? "").toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 8)
      .map((app) => ({
        id: `app:${app.id}`,
        kind: "app" as const,
        label: app.name,
        displayLabel: app.name,
        insertText: buildScratchpadAppPromptLink(app),
        detail: app.description ?? null,
      }));

    return [...appCandidates, ...fileCandidates].slice(0, 8);
  }

  return skills
    .filter((skill) => skill.enabled)
    .filter((skill) => {
      if (normalizedQuery.length === 0) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(normalizedQuery) ||
        (skill.displayName ?? "").toLowerCase().includes(normalizedQuery) ||
        skill.description.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 8)
    .map((skill) => ({
      id: `skill:${skill.path || skill.name}`,
      kind: "skill" as const,
      label: skill.displayName ?? skill.name,
      displayLabel: skill.displayName ?? skill.name,
      insertText: buildScratchpadSkillPromptLink(skill),
      detail: skill.shortDescription ?? skill.description,
      brandColor: skill.brandColor ?? null,
    }));
}

function focusPromptEditorAtEnd(editor: HTMLDivElement | null) {
  if (!editor) {
    return;
  }
  editor.focus();
  restoreSelectionByVisibleIndex(editor, editor.textContent?.length ?? 0);
}

function isCursorAtStart(editor: HTMLDivElement | null) {
  if (!editor) {
    return false;
  }
  const selection = editor.ownerDocument.getSelection();
  if (!selection || !selection.isCollapsed) {
    return false;
  }
  return getVisibleSelectionIndex(editor) === 0;
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

function getVisibleSelectionIndex(editor: HTMLDivElement) {
  return getVisibleTextBeforeCursor(editor)?.length ?? editor.textContent?.length ?? 0;
}

function isNodeWithinEditor(editor: HTMLDivElement, node: Node) {
  return node === editor || editor.contains(node);
}

function serializePromptEditorValue(editor: HTMLDivElement) {
  return Array.from(editor.childNodes)
    .map((node) => serializePromptEditorNode(node))
    .join("")
    .replace(/\u00A0/g, " ");
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

function renderPromptEditorValue(
  editor: HTMLDivElement,
  value: string,
  apps: AppInfo[],
  skills: SkillSummary[],
) {
  const documentRef = editor.ownerDocument;
  const fragment = documentRef.createDocumentFragment();
  const segments = parseScratchpadPromptSegments(value, {
    apps,
    skills,
  });

  for (const segment of segments) {
    if (segment.type === "text") {
      fragment.append(documentRef.createTextNode(segment.value));
      continue;
    }

    if (isScratchpadPromptMentionSegment(segment)) {
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

function createPromptMentionNode(documentRef: Document, segment: ScratchpadPromptMentionSegment) {
  const token = documentRef.createElement("span");
  token.contentEditable = "false";
  token.dataset.scratchpadPromptRaw = segment.raw;
  token.className =
    "inline-flex max-w-full items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 align-baseline text-[0.95em] leading-[1.35] text-token-foreground";

  const title = buildScratchpadPromptMentionTitle(segment);
  if (title) {
    token.title = title;
  }

  const prefix = documentRef.createElement("span");
  prefix.className = "shrink-0 text-[0.8em] text-token-text-secondary";
  prefix.textContent = segment.type === "skill" ? "$" : "@";

  const label = documentRef.createElement("span");
  label.className = "min-w-0 truncate";
  label.textContent = segment.displayLabel;

  token.append(prefix, label);
  return token;
}

function createPromptFileNode(
  documentRef: Document,
  segment: Extract<ReturnType<typeof classifyPromptLink>, { type: "file" }>,
) {
  const token = documentRef.createElement("span");
  token.contentEditable = "false";
  token.dataset.scratchpadPromptRaw = segment.raw;
  token.className =
    "inline-flex max-w-full items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 align-baseline text-[0.95em] leading-[1.35] text-token-foreground";
  token.title = segment.href;

  const label = documentRef.createElement("span");
  label.className = "min-w-0 truncate";
  label.textContent = segment.locationSuffix ? `${segment.label}${segment.locationSuffix}` : segment.label;

  token.append(label);
  return token;
}

function restoreSelectionByVisibleIndex(editor: HTMLDivElement, targetIndex: number) {
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

function getMentionSignature(mentionState: MentionState | null) {
  if (mentionState === null) {
    return null;
  }
  return `${mentionState.symbol}:${mentionState.startIndex}:${mentionState.endIndex}:${mentionState.query}`;
}

function insertPlainTextAtSelection(editor: HTMLDivElement | null, text: string) {
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

function replaceVisibleRangeWithMention(
  editor: HTMLDivElement,
  mentionState: MentionState,
  candidate: MentionCandidate,
) {
  const start = findSelectionPositionByVisibleIndex(editor, mentionState.startIndex);
  const end = findSelectionPositionByVisibleIndex(editor, mentionState.endIndex);
  const range = editor.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  range.deleteContents();

  const fragment = editor.ownerDocument.createDocumentFragment();
  fragment.append(
    candidate.kind === "file"
      ? createPromptFileNode(
          editor.ownerDocument,
          classifyPromptLink({
            raw: candidate.insertText,
            label: candidate.label,
            href: decodeInsertedFileHref(candidate.insertText),
          }) as Extract<ReturnType<typeof classifyPromptLink>, { type: "file" }>,
        )
      : createPromptMentionNode(editor.ownerDocument, {
          type: candidate.kind,
          raw: candidate.insertText,
          label: candidate.kind === "app" ? `@${candidate.label}` : `$${candidate.label}`,
          href: candidate.kind === "skill" ? decodeInsertedFileHref(candidate.insertText) : candidate.insertText,
          displayLabel: candidate.displayLabel,
          detail: candidate.detail,
          ...(candidate.kind === "app"
            ? {
                appId: candidate.id.replace(/^app:/u, ""),
              }
            : {
                path: "",
                brandColor: candidate.brandColor,
              }),
        } as ScratchpadPromptMentionSegment),
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

function decodeInsertedFileHref(insertText: string) {
  const match = /\(([^)\n]+)\)/u.exec(insertText);
  return match?.[1] ?? insertText;
}
