import { createPortal } from "react-dom";
import type {
  PromptEditorMentionCandidate,
  PromptEditorOverlayLayout,
} from "./types";

const OVERLAY_MAX_WIDTH = 360;
const OVERLAY_HORIZONTAL_PADDING = 12;
const OVERLAY_OFFSET = 8;
const OVERLAY_TOP_THRESHOLD = 240;

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
      className={[
        "z-[60]",
        mentionOverlayLayout.positionClassName,
        mentionOverlayLayout.renderAbove ? "-translate-y-full" : null,
      ]
        .filter(Boolean)
        .join(" ")}
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
    mentionOverlayLayout.portalContainer,
  );
}

export function getMentionOverlayPlacement(editor: HTMLDivElement | null) {
  if (!editor || typeof window === "undefined") {
    return "bottom" as const;
  }

  const anchorRect = editor.getBoundingClientRect();
  const spaceAbove = anchorRect.top;
  const spaceBelow = window.innerHeight - anchorRect.bottom;

  return spaceBelow < OVERLAY_TOP_THRESHOLD && spaceAbove > spaceBelow ? "top" : "bottom";
}

export function getMentionOverlayLayout(
  editor: HTMLDivElement | null,
  placement: "top" | "bottom",
): PromptEditorOverlayLayout | null {
  if (!editor || typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const portalContainer = getOverlayPortalContainer(editor);
  const containerRect =
    portalContainer === document.body
      ? { left: 0, top: 0, width: window.innerWidth }
      : portalContainer.getBoundingClientRect();
  const anchorRect = getMentionAnchorRect(editor) ?? editor.getBoundingClientRect();
  const width = Math.min(
    OVERLAY_MAX_WIDTH,
    Math.max(containerRect.width - OVERLAY_HORIZONTAL_PADDING * 2, 0),
  );

  return {
    left: clampOverlayPosition(
      anchorRect.left - containerRect.left,
      OVERLAY_HORIZONTAL_PADDING,
      containerRect.width - width - OVERLAY_HORIZONTAL_PADDING,
    ),
    portalContainer,
    positionClassName: portalContainer === document.body ? "fixed" : "absolute",
    renderAbove: placement === "top",
    top:
      (placement === "top"
        ? anchorRect.top - OVERLAY_OFFSET
        : anchorRect.bottom + OVERLAY_OFFSET) - containerRect.top,
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

  return (
    left.left === right.left &&
    left.portalContainer === right.portalContainer &&
    left.positionClassName === right.positionClassName &&
    left.renderAbove === right.renderAbove &&
    left.top === right.top &&
    left.width === right.width
  );
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
  const clientRects = collapsedRange.getClientRects();
  const lastClientRect = clientRects.item(clientRects.length - 1);
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

function getOverlayPortalContainer(editor: HTMLDivElement) {
  const dialogContainer = editor.closest(".codex-dialog");
  return (dialogContainer as HTMLElement | null) ?? document.body;
}

function clampOverlayPosition(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}

export const __testOnly = {
  clampOverlayPosition,
};
