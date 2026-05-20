import { createPortal } from "react-dom";
import type {
  PromptEditorMentionCandidate,
  PromptEditorOverlayLayout,
} from "./types";

export function renderMentionOverlay<TCandidate extends PromptEditorMentionCandidate>({
  candidates,
  mentionOverlayLayout,
  onSelectCandidate,
  selectedCandidateIndex,
}: {
  candidates: TCandidate[];
  mentionOverlayLayout: PromptEditorOverlayLayout | null;
  onSelectCandidate: (candidate: TCandidate) => void;
  selectedCandidateIndex: number;
}) {
  if (
    candidates.length === 0 ||
    mentionOverlayLayout === null ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-50"
      style={{
        left: mentionOverlayLayout.left,
        top: mentionOverlayLayout.top,
        width: mentionOverlayLayout.width,
      }}
    >
      <div className="overflow-hidden rounded-[14px] border border-token-border bg-token-bg-primary shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <div className="max-h-[260px] overflow-y-auto p-1.5">
          {candidates.map((candidate, index) => {
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
                  onSelectCandidate(candidate);
                }}
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {renderMentionCandidateIcon(candidate)}
                </span>
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span className="flex-shrink-0 truncate text-[13px] text-token-foreground">
                    {candidate.displayLabel}
                  </span>
                  {candidate.detail ? (
                    <span className="flex-1 truncate text-[12px] text-token-text-secondary">
                      {candidate.detail}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-[12px] text-token-text-secondary">
                    {candidate.scopeLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function getMentionOverlayLayout(editor: HTMLDivElement | null): PromptEditorOverlayLayout | null {
  if (!editor || typeof window === "undefined") {
    return null;
  }

  const anchorRect = getMentionAnchorRect(editor) ?? editor.getBoundingClientRect();
  const width = Math.min(360, Math.max(window.innerWidth - 24, 0));

  return {
    left: clampOverlayPosition(anchorRect.left, 12, window.innerWidth - width - 12),
    top: anchorRect.bottom + 8,
    width,
  };
}

export function isSameMentionOverlayLayout(
  left: PromptEditorOverlayLayout | null,
  right: PromptEditorOverlayLayout | null,
) {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return left.left === right.left && left.top === right.top && left.width === right.width;
}

function renderMentionCandidateIcon(candidate: PromptEditorMentionCandidate) {
  if (candidate.iconSource) {
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={candidate.iconSource}
        className="h-4 w-4 rounded-[4px] object-contain"
      />
    );
  }

  if (candidate.kind === "skill") {
    return (
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-token-bg-tertiary text-[10px] font-medium text-token-text-secondary"
      >
        {candidate.displayLabel.charAt(0).toUpperCase() || "S"}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-token-bg-tertiary text-[10px] font-medium text-token-text-secondary"
    >
      {candidate.displayLabel.charAt(0).toUpperCase() || "A"}
    </span>
  );
}

function getMentionAnchorRect(editor: HTMLDivElement) {
  const selection = editor.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!(range.endContainer === editor || editor.contains(range.endContainer))) {
    return null;
  }

  const collapsedRange = range.cloneRange();
  collapsedRange.collapse(false);
  const lastClientRect = collapsedRange.getClientRects().item(collapsedRange.getClientRects().length - 1);
  if (lastClientRect) {
    return lastClientRect;
  }

  const boundingRect = collapsedRange.getBoundingClientRect();
  if (
    boundingRect.width > 0 ||
    boundingRect.height > 0 ||
    boundingRect.left !== 0 ||
    boundingRect.top !== 0
  ) {
    return boundingRect;
  }

  return null;
}

function clampOverlayPosition(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}
