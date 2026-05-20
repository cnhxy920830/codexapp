import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";
import {
  onActiveWorkspaceRootsUpdated,
  readActiveWorkspaceRoots,
} from "../../services/workspaceRoots";
import {
  focusPromptEditorAtEnd,
  getMentionSignature,
  getMentionStateForSymbol,
  getVisibleSelectionIndex,
  insertPlainTextAtSelection,
  isCursorAtStart,
  readMentionState,
  renderPromptEditorValue,
  replaceVisibleRangeWithMention,
  restoreSelectionByVisibleIndex,
  serializePromptEditorValue,
} from "./dom";
import { buildAppMentionCandidates, buildSkillMentionCandidates } from "./mentionCandidates";
import { getMentionOverlayLayout, isSameMentionOverlayLayout, renderMentionOverlay } from "./MentionOverlay";
import type {
  PromptEditorMentionCandidate,
  PromptEditorMentionState,
  PromptEditorOverlayLayout,
} from "./types";

type PromptEditorProps = {
  ariaLabel: string;
  autoFocus: boolean;
  hostId?: string | null;
  editorClassName?: string;
  isIndented: boolean;
  onChange: (value: string) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onSubmit: () => void | Promise<void>;
  placeholder: string;
  value: string;
  apps: AppInfo[];
  skills: SkillSummary[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function PromptEditor({
  ariaLabel,
  autoFocus,
  hostId = null,
  editorClassName,
  isIndented,
  onChange,
  onIndent,
  onOutdent,
  onSubmit,
  placeholder,
  value,
  apps,
  skills,
  t,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedAppsRef = useRef<AppInfo[] | null>(null);
  const lastRenderedSkillsRef = useRef<SkillSummary[] | null>(null);
  const [selectedAppCandidateIndex, setSelectedAppCandidateIndex] = useState(0);
  const [selectedSkillCandidateIndex, setSelectedSkillCandidateIndex] = useState(0);
  const [mentionState, setMentionState] = useState<PromptEditorMentionState | null>(null);
  const [dismissedAppMentionSignature, setDismissedAppMentionSignature] = useState<string | null>(null);
  const [dismissedSkillMentionSignature, setDismissedSkillMentionSignature] = useState<string | null>(null);
  const [activeWorkspaceRoots, setActiveWorkspaceRoots] = useState<string[]>([]);
  const [mentionOverlayLayout, setMentionOverlayLayout] = useState<PromptEditorOverlayLayout | null>(null);
  const appMentionState = useMemo(
    () => getMentionStateForSymbol(mentionState, "@"),
    [mentionState],
  );
  const skillMentionState = useMemo(
    () => getMentionStateForSymbol(mentionState, "$"),
    [mentionState],
  );
  const appMentionSignature = useMemo(
    () => getMentionSignature(appMentionState),
    [appMentionState],
  );
  const skillMentionSignature = useMemo(
    () => getMentionSignature(skillMentionState),
    [skillMentionState],
  );
  const appMentionCandidates = useMemo(() => {
    if (
      appMentionSignature !== null &&
      appMentionSignature === dismissedAppMentionSignature
    ) {
      return [];
    }
    return buildAppMentionCandidates({
      mentionState: appMentionState,
      apps,
      t,
    });
  }, [
    appMentionState,
    appMentionSignature,
    apps,
    dismissedAppMentionSignature,
    t,
  ]);
  const skillMentionCandidates = useMemo(() => {
    if (
      skillMentionSignature !== null &&
      skillMentionSignature === dismissedSkillMentionSignature
    ) {
      return [];
    }
    return buildSkillMentionCandidates({
      mentionState: skillMentionState,
      skills,
      activeWorkspaceRoots,
      t,
    });
  }, [
    activeWorkspaceRoots,
    dismissedSkillMentionSignature,
    skillMentionSignature,
    skillMentionState,
    skills,
    t,
  ]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    focusPromptEditorAtEnd(editorRef.current);
  }, [autoFocus]);

  useEffect(() => {
    setSelectedAppCandidateIndex(0);
  }, [appMentionSignature]);

  useEffect(() => {
    setSelectedSkillCandidateIndex(0);
  }, [skillMentionSignature]);

  useEffect(() => {
    if (
      appMentionSignature === null ||
      appMentionSignature === dismissedAppMentionSignature
    ) {
      return;
    }
    setDismissedAppMentionSignature(null);
  }, [appMentionSignature, dismissedAppMentionSignature]);

  useEffect(() => {
    if (
      skillMentionSignature === null ||
      skillMentionSignature === dismissedSkillMentionSignature
    ) {
      return;
    }
    setDismissedSkillMentionSignature(null);
  }, [dismissedSkillMentionSignature, skillMentionSignature]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const refreshActiveRoots = async () => {
      try {
        const response = await readActiveWorkspaceRoots(hostId);
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
  }, [hostId]);

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

  useEffect(() => {
    if (
      (appMentionCandidates.length === 0 && skillMentionCandidates.length === 0) ||
      typeof window === "undefined"
    ) {
      setMentionOverlayLayout(null);
      return;
    }

    const updateMentionOverlayLayout = () => {
      const nextLayout = getMentionOverlayLayout(editorRef.current);
      setMentionOverlayLayout((current) =>
        isSameMentionOverlayLayout(current, nextLayout) ? current : nextLayout,
      );
    };

    updateMentionOverlayLayout();
    window.addEventListener("resize", updateMentionOverlayLayout);
    window.addEventListener("scroll", updateMentionOverlayLayout, true);

    return () => {
      window.removeEventListener("resize", updateMentionOverlayLayout);
      window.removeEventListener("scroll", updateMentionOverlayLayout, true);
    };
  }, [
    appMentionCandidates.length,
    appMentionSignature,
    skillMentionCandidates.length,
    skillMentionSignature,
    value,
  ]);

  const appMentionOverlay = renderMentionOverlay({
    candidates: appMentionCandidates,
    mentionOverlayLayout,
    onSelectCandidate: applyAppCandidate,
    selectedCandidateIndex: selectedAppCandidateIndex,
  });
  const skillMentionOverlay = renderMentionOverlay({
    candidates: skillMentionCandidates,
    mentionOverlayLayout,
    onSelectCandidate: applySkillCandidate,
    selectedCandidateIndex: selectedSkillCandidateIndex,
  });
  const sizeClassName = editorClassName ? null : "min-h-9 max-h-[25dvh]";

  return (
    <>
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
          className={[
            sizeClassName,
            "min-w-0 w-full overflow-y-auto bg-transparent py-1.5 text-base whitespace-pre-wrap break-words text-token-foreground outline-none",
            editorClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
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
            if (appMentionCandidates.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedAppCandidateIndex(
                  (current) => (current + 1) % appMentionCandidates.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedAppCandidateIndex((current) =>
                  current === 0 ? appMentionCandidates.length - 1 : current - 1,
                );
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const candidate = appMentionCandidates[selectedAppCandidateIndex];
                if (candidate) {
                  applyAppCandidate(candidate);
                }
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeAppMention();
                return;
              }
            }

            if (skillMentionCandidates.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedSkillCandidateIndex(
                  (current) => (current + 1) % skillMentionCandidates.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedSkillCandidateIndex((current) =>
                  current === 0 ? skillMentionCandidates.length - 1 : current - 1,
                );
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const candidate = skillMentionCandidates[selectedSkillCandidateIndex];
                if (candidate) {
                  applySkillCandidate(candidate);
                }
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeSkillMention();
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
      </div>
      {appMentionOverlay}
      {skillMentionOverlay}
    </>
  );

  function applyAppCandidate(candidate: PromptEditorMentionCandidate) {
    applyCandidate(candidate);
  }

  function applySkillCandidate(candidate: PromptEditorMentionCandidate) {
    applyCandidate(candidate);
  }

  function applyCandidate(candidate: PromptEditorMentionCandidate) {
    const editor = editorRef.current;
    const currentMentionState = readMentionState(editor);
    if (editor === null || currentMentionState === null) {
      return;
    }

    replaceVisibleRangeWithMention(editor, currentMentionState, candidate);
    if (candidate.kind === "app") {
      setSelectedAppCandidateIndex(0);
    } else {
      setSelectedSkillCandidateIndex(0);
    }
    syncEditorDom();
    setMentionState(readMentionState(editor));
  }

  function closeAppMention() {
    setDismissedAppMentionSignature(
      getMentionSignature(getMentionStateForSymbol(readMentionState(editorRef.current), "@")),
    );
    setMentionState(null);
    setSelectedAppCandidateIndex(0);
  }

  function closeSkillMention() {
    setDismissedSkillMentionSignature(
      getMentionSignature(getMentionStateForSymbol(readMentionState(editorRef.current), "$")),
    );
    setMentionState(null);
    setSelectedSkillCandidateIndex(0);
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
