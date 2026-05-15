import { Fragment, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MessageKey } from "../../i18n/messages";
import type {
  ThreadConversationUserComment,
  ThreadConversationUserCommentLocalPdfContext,
  ThreadConversationUserCommentLocalPdfCommentMetadata,
  ThreadConversationUserCommentLocalPdfScreenshot,
  ThreadConversationUserCommentPagePoint,
  ThreadConversationUserCommentPageRect,
  ThreadConversationUserCommentPageSize,
  ThreadConversationUserInputComment,
} from "../../services/history";
import { Button } from "../../components/Button";
import {
  createPendingPdfCommentAttachment,
  type PendingPdfCommentAttachment,
} from "./pdfCommentAttachments";

type PdfCommentLayerProps = {
  comments: ThreadConversationUserComment[];
  isCommentMode?: boolean;
  nextCommentNumber?: number;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onSubmitPdfComment?: ((comment: ThreadConversationUserInputComment) => Promise<void>) | null;
  pageCanvas?: HTMLCanvasElement | null;
  pageHeight: number;
  pageCount: number;
  pageNumber: number;
  path: string;
  pendingPdfComments?: PendingPdfCommentAttachment[];
  pageSize: ThreadConversationUserCommentPageSize;
  pageWidth: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  title: string | null;
};

type PdfDraftAnchor =
  | {
      kind: "point";
      point: ThreadConversationUserCommentPagePoint;
    }
  | {
      kind: "region";
      rect: ThreadConversationUserCommentPageRect;
    };

type PointerSelection = {
  current: ThreadConversationUserCommentPagePoint;
  pointerId: number;
  start: ThreadConversationUserCommentPagePoint;
};

type PdfLayerComment = {
  body: string;
  content: Array<{
    label?: string | null;
    text?: string | null;
  }>;
  id: string;
  kind: "pending" | "submitted";
  localPdfCommentMetadata: ThreadConversationUserCommentLocalPdfCommentMetadata;
  localPdfContext: ThreadConversationUserCommentLocalPdfContext | null;
  positionLine: number;
};

const COMMENT_MARKER_COLOR = "#2563eb";
const COMMENT_MARKER_SIZE_PX = 25;
const COMMENT_PREVIEW_HEIGHT_PX = 44;
const COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX = 20;
const COMMENT_PREVIEW_MAX_WIDTH_PX = 294;
const COMMENT_PREVIEW_PADDING_PX = 16;
const COMMENT_PREVIEW_VERTICAL_SPACE_PX = 120;
const COMMENT_EDITOR_HEIGHT_PX = 168;
const COMMENT_SELECTION_POINT_THRESHOLD_PX = 8;
const COMMENT_POINT_SCREENSHOT_HEIGHT_PX = 240;
const COMMENT_POINT_SCREENSHOT_WIDTH_PX = 360;
const COMMENT_REGION_SCREENSHOT_PADDING_PX = 40;
const PDF_COMMENT_MARKER_ICON_SVG = `<svg
  width="26"
  height="25"
  viewBox="0 0 26 25"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M12.6504 0.824799C6.21496 0.824799 0.825466 5.77554 0.825195 12.0885C0.825245 14.2375 1.46183 16.2421 2.55176 17.943L2.02148 20.235L1.99316 20.3756C1.77603 21.655 2.78945 22.7791 4.02832 22.7691L4.0791 22.8209L4.53418 22.7047L7.12305 22.0426C8.77593 22.8778 10.6577 23.3531 12.6504 23.3531C19.086 23.3531 24.4754 18.4014 24.4756 12.0885C24.4753 5.77554 19.0858 0.824799 12.6504 0.824799Z"
    fill="currentColor"
    stroke="white"
    stroke-width="1.65"
  />
</svg>`;
const PDF_COMMENT_CURSOR = `url("${encodeSvgDataUrl(PDF_COMMENT_MARKER_ICON_SVG.replace("currentColor", COMMENT_MARKER_COLOR))}") 13 12, crosshair`;

export function PdfCommentLayer({
  comments,
  isCommentMode = false,
  nextCommentNumber = 1,
  onPendingPdfCommentsChange = null,
  onSubmitPdfComment = null,
  pageCanvas = null,
  pageHeight,
  pageCount,
  pageNumber,
  path,
  pendingPdfComments = [],
  pageSize,
  pageWidth,
  t,
  title,
}: PdfCommentLayerProps) {
  const [draftAnchor, setDraftAnchor] = useState<PdfDraftAnchor | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editingPendingCommentId, setEditingPendingCommentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pointerSelection, setPointerSelection] = useState<PointerSelection | null>(null);
  const [previewCommentKey, setPreviewCommentKey] = useState<string | null>(null);

  useEffect(() => {
    if (isCommentMode) {
      return;
    }

    setDraftAnchor(null);
    setDraftBody("");
    setDraftError(null);
    setEditingPendingCommentId(null);
    setIsSubmitting(false);
    setPointerSelection(null);
    setPreviewCommentKey(null);
  }, [isCommentMode]);

  useEffect(() => {
    setDraftAnchor(null);
    setDraftBody("");
    setDraftError(null);
    setEditingPendingCommentId(null);
    setIsSubmitting(false);
    setPointerSelection(null);
    setPreviewCommentKey(null);
  }, [pageNumber]);

  const pageComments = useMemo(
    () => [
      ...comments.flatMap((comment, index) => {
        const metadata = comment.localPdfCommentMetadata;
        if (comment.localPdfContext?.pageNumber !== pageNumber || metadata == null) {
          return [];
        }
        return [
          {
            body: comment.body,
            content: comment.content ?? [],
            id: getSubmittedPdfCommentId(comment, index),
            kind: "submitted" as const,
            localPdfCommentMetadata: metadata,
            localPdfContext: comment.localPdfContext ?? null,
            positionLine: comment.position?.line ?? index + 1,
          },
        ];
      }),
      ...pendingPdfComments.flatMap(({ comment, id }) => {
        const metadata = comment.localPdfCommentMetadata;
        if (comment.localPdfContext?.pageNumber !== pageNumber || metadata == null) {
          return [];
        }
        return [
          {
            body: comment.body,
            content: comment.content,
            id,
            kind: "pending" as const,
            localPdfCommentMetadata: metadata,
            localPdfContext: comment.localPdfContext ?? null,
            positionLine: comment.position?.line ?? nextCommentNumber,
          },
        ];
      }),
    ],
    [comments, nextCommentNumber, pageNumber, pendingPdfComments],
  );
  const editingPendingComment =
    editingPendingCommentId == null
      ? null
      : pendingPdfComments.find((comment) => comment.id === editingPendingCommentId) ?? null;

  if (!isCommentMode) {
    return null;
  }

  const draftAnchorToRender =
    draftAnchor ??
    (editingPendingComment == null
      ? null
      : getDraftAnchorFromMetadata(editingPendingComment.comment.localPdfCommentMetadata));
  const draftMarkerPoint =
    draftAnchorToRender == null ? null : getDraftAnchorMarkerPoint(draftAnchorToRender);
  const editorStyle =
    draftMarkerPoint == null
      ? null
      : getCommentOverlayStyle({
          markerPoint: draftMarkerPoint,
          overlayHeight: COMMENT_EDITOR_HEIGHT_PX,
          pageHeight,
          pageSize,
          pageWidth,
        });

  return (
    <div
      className="absolute inset-0 z-[3]"
      data-testid="artifact-pdf-comment-layer"
      style={{ cursor: PDF_COMMENT_CURSOR }}
      onPointerCancel={() => {
        setPointerSelection(null);
      }}
      onPointerDown={(event) => {
        if (
          draftAnchorToRender != null ||
          isSubmitting ||
          !event.isPrimary ||
          event.button !== 0
        ) {
          return;
        }

        const point = getPointerPoint(event, pageSize);
        if (point == null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraftError(null);
        setPreviewCommentKey(null);
        setPointerSelection({
          current: point,
          pointerId: event.pointerId,
          start: point,
        });
      }}
      onPointerMove={(event) => {
        if (pointerSelection == null || event.pointerId !== pointerSelection.pointerId) {
          return;
        }

        const point = getPointerPoint(event, pageSize);
        if (point == null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        setPointerSelection((current) =>
          current == null || current.pointerId !== event.pointerId
            ? current
            : {
                ...current,
                current: point,
              },
        );
      }}
      onPointerUp={(event) => {
        if (pointerSelection == null || event.pointerId !== pointerSelection.pointerId) {
          return;
        }

        const point = getPointerPoint(event, pageSize) ?? pointerSelection.current;
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        setDraftAnchor(createDraftAnchor({
          ...pointerSelection,
          current: point,
        }));
        setEditingPendingCommentId(null);
        setDraftBody("");
        setPointerSelection(null);
      }}
    >
      {pageComments.map((comment) => {
        const markerPoint = getPdfCommentMarkerPoint(comment.localPdfCommentMetadata);
        if (markerPoint == null) {
          return null;
        }

        const commentKey = `${comment.kind}:${comment.id}`;
        const markerLabel = comment.positionLine;
        const previewText = getPdfCommentPreviewText(comment);
        const regionStyle = getPdfCommentRegionStyle(comment.localPdfCommentMetadata);
        const markerStyle = getPdfCommentMarkerStyle(
          markerPoint,
          comment.localPdfCommentMetadata.pageSize,
        );
        const previewStyle = getCommentOverlayStyle({
          markerPoint,
          overlayHeight: COMMENT_PREVIEW_HEIGHT_PX,
          pageHeight,
          pageSize: comment.localPdfCommentMetadata.pageSize,
          pageWidth,
        });

        return (
          <Fragment key={commentKey}>
            {regionStyle == null ? null : <div className="pointer-events-none absolute box-border bg-[#128dff33]" style={regionStyle} />}
            <button
              type="button"
              aria-label={t("artifactPdfPreview.commentMarkerLabel", {
                commentNumber: markerLabel,
              })}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none"
              data-testid="artifact-pdf-comment-marker"
              style={markerStyle}
              onBlur={() =>
                setPreviewCommentKey((currentKey) => (currentKey === commentKey ? null : currentKey))
              }
              onFocus={() => setPreviewCommentKey(commentKey)}
              onMouseEnter={() => setPreviewCommentKey(commentKey)}
              onMouseLeave={() =>
                setPreviewCommentKey((currentKey) => (currentKey === commentKey ? null : currentKey))
              }
              onClick={() => {
                if (comment.kind !== "pending") {
                  return;
                }
                setDraftAnchor(null);
                setDraftBody(comment.body);
                setDraftError(null);
                setEditingPendingCommentId(comment.id);
                setPointerSelection(null);
                setPreviewCommentKey(null);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <span className="absolute inset-0 size-full rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.16)]" style={{ backgroundColor: COMMENT_MARKER_COLOR }} />
              <span className="pointer-events-none relative -translate-x-px -translate-y-px text-[10px] leading-none font-bold text-white">
                {markerLabel}
              </span>
            </button>
            {previewCommentKey !== commentKey || previewText.length === 0 || previewStyle == null ? null : (
              <div
                className="pointer-events-none absolute z-[5] flex items-center overflow-hidden rounded-[22px] bg-token-dropdown-background px-4 text-token-foreground shadow-md ring-1 ring-token-border-light"
                data-testid="artifact-pdf-comment-preview"
                style={previewStyle}
              >
                <div className="text-size-chat min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-inherit">
                  {previewText}
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
      {pointerSelection == null ? null : (
        <div
          className="pointer-events-none absolute box-border bg-[#128dff33] border-2 border-dashed border-[#0285ff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
          style={getTransientSelectionStyle(pointerSelection, pageSize) ?? undefined}
        />
      )}
      {draftAnchor?.kind === "region" ? (
        <div
          className="pointer-events-none absolute box-border bg-[#128dff33] border-2 border-dashed border-[#0285ff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
          style={getPageRectStyle(draftAnchor.rect, pageSize) ?? undefined}
        />
      ) : null}
      {draftMarkerPoint == null ? null : (
        <div
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={getPdfCommentMarkerStyle(draftMarkerPoint, pageSize)}
        >
          <span className="absolute inset-0 size-full rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.16)]" style={{ backgroundColor: COMMENT_MARKER_COLOR }} />
          <span className="pointer-events-none relative -translate-x-px -translate-y-px text-[10px] leading-none font-bold text-white">
            {nextCommentNumber}
          </span>
        </div>
      )}
      {draftAnchorToRender == null || editorStyle == null ? null : (
        <div
          className="absolute z-[4] w-[294px] max-w-[min(294px,calc(100%-32px))] cursor-auto"
          style={editorStyle}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="rounded-[18px] bg-token-dropdown-background p-3 text-token-foreground shadow-md ring-1 ring-token-border-light">
            <textarea
              aria-label={t("artifactPdfPreview.commentInput")}
              className="min-h-[84px] w-full resize-none rounded-[12px] border border-token-border-default bg-token-main-surface-primary px-3 py-2 text-sm text-token-text-primary outline-none focus:border-token-focus-border"
              disabled={isSubmitting}
              value={draftBody}
              onChange={(event) => {
                setDraftBody(event.target.value);
                if (draftError != null) {
                  setDraftError(null);
                }
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void saveDraft();
                }
              }}
            />
            {draftError == null ? null : (
              <div className="mt-2 text-xs text-token-charts-red">{draftError}</div>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              {editingPendingCommentId == null ? null : (
                <Button
                  color="ghost"
                  size="toolbar"
                  className="rounded-md px-2 text-sm"
                  disabled={isSubmitting || onPendingPdfCommentsChange == null}
                  onClick={() => {
                    if (onPendingPdfCommentsChange == null) {
                      return;
                    }
                    onPendingPdfCommentsChange((current) =>
                      current.filter((comment) => comment.id !== editingPendingCommentId),
                    );
                    resetEditor();
                  }}
                >
                  <span>{t("settings.localEnvironments.actions.item.button.delete")}</span>
                </Button>
              )}
              <Button
                color="ghost"
                size="toolbar"
                className="rounded-md px-2 text-sm"
                disabled={isSubmitting}
                onClick={resetEditor}
              >
                <span>{t("auth.cancel")}</span>
              </Button>
              <Button
                color="secondary"
                size="toolbar"
                className="rounded-md px-2 text-sm"
                disabled={isSubmitting || onPendingPdfCommentsChange == null}
                onClick={() => {
                  void saveDraft();
                }}
              >
                <span>{t("settings.automations.save")}</span>
              </Button>
              {editingPendingCommentId != null ? null : (
                <Button
                  color="primary"
                  size="toolbar"
                  className="rounded-md px-2 text-sm"
                  loading={isSubmitting}
                  onClick={() => {
                    void submitDraftDirectly();
                  }}
                >
                  <span>{t("app.chat.send")}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function resetEditor() {
    setDraftAnchor(null);
    setDraftBody("");
    setDraftError(null);
    setEditingPendingCommentId(null);
    setPointerSelection(null);
    setPreviewCommentKey(null);
  }

  async function buildDraftComment(anchor: PdfDraftAnchor, line: number) {
    const metadata = buildDraftMetadata(anchor, pageSize);
    const screenshot = await generatePdfCommentScreenshot({
      anchor,
      commentId: createCommentId(),
      markerLabel: String(line),
      pageCanvas,
      pageNumber,
      pageSize,
    });
    return buildPdfCommentInput({
      body: draftBody.trim(),
      line,
      metadata,
      pageCount,
      pageNumber,
      path,
      screenshot,
      title,
    });
  }

  async function saveDraft() {
    const body = draftBody.trim();
    if (body.length === 0) {
      setDraftError("PDF annotation comment is required.");
      return;
    }

    if (editingPendingCommentId != null) {
      if (onPendingPdfCommentsChange == null) {
        setDraftError("PDF annotation save is unavailable.");
        return;
      }
      onPendingPdfCommentsChange((current) =>
        current.map((entry) =>
          entry.id === editingPendingCommentId
            ? {
                ...entry,
                comment: {
                  ...entry.comment,
                  body,
                  content: [
                    {
                      content_type: "text",
                      text: body,
                    },
                  ],
                },
              }
            : entry,
        ),
      );
      resetEditor();
      return;
    }

    if (draftAnchor == null) {
      return;
    }

    if (onPendingPdfCommentsChange == null) {
      setDraftError("PDF annotation save is unavailable.");
      return;
    }

    setDraftError(null);
    setIsSubmitting(true);
    try {
      const comment = await buildDraftComment(draftAnchor, nextCommentNumber);
      onPendingPdfCommentsChange((current) => [
        ...current,
        createPendingPdfCommentAttachment(comment),
      ]);
      resetEditor();
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitDraftDirectly() {
    if (draftAnchor == null) {
      return;
    }

    const body = draftBody.trim();
    if (body.length === 0) {
      setDraftError("PDF annotation comment is required.");
      return;
    }

    if (onSubmitPdfComment == null) {
      setDraftError("PDF annotation submit is unavailable.");
      return;
    }

    setDraftError(null);
    setIsSubmitting(true);
    try {
      const comment = await buildDraftComment(draftAnchor, nextCommentNumber);
      await onSubmitPdfComment(comment);
      resetEditor();
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }
}

function getSubmittedPdfCommentId(comment: ThreadConversationUserComment, index: number) {
  const context = comment.localPdfContext;
  const line = comment.position?.line ?? index + 1;
  return [
    context?.path ?? comment.path,
    context?.pageNumber ?? 0,
    line,
    comment.body,
    index,
  ].join(":");
}

function getPdfCommentPreviewText(comment: PdfLayerComment) {
  if (Array.isArray(comment.content) && comment.content.length > 0) {
    const text = comment.content
      .map((contentItem) => contentItem.text ?? contentItem.label ?? "")
      .join("")
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  return comment.body.trim();
}

function getDraftAnchorFromMetadata(
  metadata: ThreadConversationUserCommentLocalPdfCommentMetadata | null | undefined,
) {
  if (metadata == null) {
    return null;
  }

  if (metadata.kind === "region" && metadata.pageRect != null) {
    return {
      kind: "region" as const,
      rect: metadata.pageRect,
    };
  }

  if (metadata.kind === "point" && metadata.pagePoint != null) {
    return {
      kind: "point" as const,
      point: metadata.pagePoint,
    };
  }

  return null;
}

function buildPdfCommentInput(params: {
  body: string;
  line: number;
  metadata: ThreadConversationUserCommentLocalPdfCommentMetadata;
  pageCount: number;
  pageNumber: number;
  path: string;
  screenshot: ThreadConversationUserCommentLocalPdfScreenshot | null;
  title: string | null;
}): ThreadConversationUserInputComment {
  return {
    type: "comment",
    path: params.path,
    body: params.body,
    content: [
      {
        content_type: "text",
        text: params.body,
      },
    ],
    position: {
      side: "right",
      path: `pdf:${params.title || params.path}`,
      line: params.line,
    },
    origin: "pdf",
    localPdfContext: {
      pageCount: params.pageCount,
      pageNumber: params.pageNumber,
      path: params.path,
      title: params.title,
    },
    localPdfCommentMetadata: params.metadata,
    localPdfScreenshot: params.screenshot,
  };
}

function getPdfCommentMarkerPoint(metadata: ThreadConversationUserCommentLocalPdfCommentMetadata) {
  if (metadata.kind === "region" && metadata.pageRect != null) {
    return {
      x: metadata.pageRect.x,
      y: metadata.pageRect.y,
    };
  }

  if (metadata.kind === "point" && metadata.pagePoint != null) {
    return metadata.pagePoint;
  }

  return null;
}

function getDraftAnchorMarkerPoint(anchor: PdfDraftAnchor) {
  return anchor.kind === "region"
    ? {
        x: anchor.rect.x,
        y: anchor.rect.y,
      }
    : anchor.point;
}

function getPdfCommentRegionStyle(metadata: ThreadConversationUserCommentLocalPdfCommentMetadata) {
  if (metadata.kind !== "region" || metadata.pageRect == null) {
    return null;
  }

  return getPageRectStyle(metadata.pageRect, metadata.pageSize);
}

function getPageRectStyle(
  pageRect: ThreadConversationUserCommentPageRect,
  pageSize: ThreadConversationUserCommentPageSize,
) {
  if (pageSize.width <= 0 || pageSize.height <= 0) {
    return null;
  }

  return {
    height: `${(pageRect.height / pageSize.height) * 100}%`,
    left: `${(pageRect.x / pageSize.width) * 100}%`,
    top: `${(pageRect.y / pageSize.height) * 100}%`,
    width: `${(pageRect.width / pageSize.width) * 100}%`,
  };
}

function getPdfCommentMarkerStyle(
  point: ThreadConversationUserCommentPagePoint,
  pageSize: ThreadConversationUserCommentPageSize,
) {
  return {
    color: COMMENT_MARKER_COLOR,
    height: COMMENT_MARKER_SIZE_PX,
    left: `${(point.x / pageSize.width) * 100}%`,
    top: `${(point.y / pageSize.height) * 100}%`,
    width: COMMENT_MARKER_SIZE_PX,
  };
}

function getCommentOverlayStyle({
  markerPoint,
  overlayHeight,
  pageHeight,
  pageSize,
  pageWidth,
}: {
  markerPoint: ThreadConversationUserCommentPagePoint;
  overlayHeight: number;
  pageHeight: number;
  pageSize: ThreadConversationUserCommentPageSize;
  pageWidth: number;
}) {
  if (pageSize.width <= 0 || pageSize.height <= 0) {
    return null;
  }

  const maxWidth = Math.min(COMMENT_PREVIEW_MAX_WIDTH_PX, Math.max(1, pageWidth - COMMENT_PREVIEW_PADDING_PX * 2));
  const previewTop = clamp(
    (markerPoint.y / pageSize.height) * pageHeight - overlayHeight / 2,
    COMMENT_PREVIEW_PADDING_PX,
    Math.max(COMMENT_PREVIEW_PADDING_PX, pageHeight - COMMENT_PREVIEW_VERTICAL_SPACE_PX - COMMENT_PREVIEW_PADDING_PX),
  );
  const anchorX = (markerPoint.x / pageSize.width) * pageWidth;
  const previewBase = {
    height: overlayHeight,
    maxWidth,
    width: "fit-content",
  };
  const rightAlignedLeft = anchorX + COMMENT_MARKER_SIZE_PX / 2 + COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX;
  if (rightAlignedLeft + maxWidth <= pageWidth - COMMENT_PREVIEW_PADDING_PX) {
    return {
      ...previewBase,
      left: rightAlignedLeft,
      top: previewTop,
    };
  }

  const leftAlignedRight = pageWidth - anchorX + COMMENT_MARKER_SIZE_PX / 2 + COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX;
  if (anchorX - COMMENT_MARKER_SIZE_PX / 2 - COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX - maxWidth >= COMMENT_PREVIEW_PADDING_PX) {
    return {
      ...previewBase,
      right: leftAlignedRight,
      top: previewTop,
    };
  }

  const centeredLeft = clamp(
    anchorX - maxWidth / 2,
    COMMENT_PREVIEW_PADDING_PX,
    Math.max(COMMENT_PREVIEW_PADDING_PX, pageWidth - maxWidth - COMMENT_PREVIEW_PADDING_PX),
  );
  const lowerTop = (markerPoint.y / pageSize.height) * pageHeight + COMMENT_MARKER_SIZE_PX / 2 + COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX;
  return {
    ...previewBase,
    left: centeredLeft,
    top:
      lowerTop + COMMENT_PREVIEW_VERTICAL_SPACE_PX <= pageHeight - COMMENT_PREVIEW_PADDING_PX
        ? lowerTop
        : Math.max(
            COMMENT_PREVIEW_PADDING_PX,
            (markerPoint.y / pageSize.height) * pageHeight -
              COMMENT_MARKER_SIZE_PX / 2 -
              COMMENT_PREVIEW_HORIZONTAL_OFFSET_PX -
              COMMENT_PREVIEW_VERTICAL_SPACE_PX,
          ),
  };
}

function getPointerPoint(
  event: ReactPointerEvent<HTMLDivElement>,
  pageSize: ThreadConversationUserCommentPageSize,
) {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    x: clamp(((event.clientX - bounds.left) / bounds.width) * pageSize.width, 0, pageSize.width),
    y: clamp(((event.clientY - bounds.top) / bounds.height) * pageSize.height, 0, pageSize.height),
  };
}

function createDraftAnchor(selection: PointerSelection): PdfDraftAnchor {
  const rect = createSelectionRect(selection.start, selection.current);
  if (rect.width < COMMENT_SELECTION_POINT_THRESHOLD_PX || rect.height < COMMENT_SELECTION_POINT_THRESHOLD_PX) {
    return {
      kind: "point",
      point: selection.current,
    };
  }

  return {
    kind: "region",
    rect,
  };
}

function createSelectionRect(
  start: ThreadConversationUserCommentPagePoint,
  end: ThreadConversationUserCommentPagePoint,
): ThreadConversationUserCommentPageRect {
  return {
    height: Math.abs(start.y - end.y),
    width: Math.abs(start.x - end.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

function getTransientSelectionStyle(
  selection: PointerSelection,
  pageSize: ThreadConversationUserCommentPageSize,
) {
  return getPageRectStyle(createSelectionRect(selection.start, selection.current), pageSize);
}

function buildDraftMetadata(
  anchor: PdfDraftAnchor,
  pageSize: ThreadConversationUserCommentPageSize,
): ThreadConversationUserCommentLocalPdfCommentMetadata {
  if (anchor.kind === "region") {
    return {
      kind: "region",
      pagePoint: null,
      pageRect: anchor.rect,
      pageSize,
    };
  }

  return {
    kind: "point",
    pagePoint: anchor.point,
    pageRect: null,
    pageSize,
  };
}

async function generatePdfCommentScreenshot({
  anchor,
  commentId,
  markerLabel,
  pageCanvas,
  pageNumber,
  pageSize,
}: {
  anchor: PdfDraftAnchor;
  commentId: string;
  markerLabel: string;
  pageCanvas: HTMLCanvasElement | null;
  pageNumber: number;
  pageSize: ThreadConversationUserCommentPageSize;
}): Promise<ThreadConversationUserCommentLocalPdfScreenshot | null> {
  if (pageCanvas == null || pageCanvas.width <= 0 || pageCanvas.height <= 0) {
    return null;
  }

  const crop = getScreenshotCrop(anchor, pageCanvas, pageSize);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.max(1, Math.round(crop.width));
  outputCanvas.height = Math.max(1, Math.round(crop.height));
  const context = outputCanvas.getContext("2d");
  if (context == null) {
    return null;
  }

  context.drawImage(
    pageCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  );

  if (anchor.kind === "region") {
    const regionRect = projectPageRectToCanvas(anchor.rect, pageCanvas, pageSize, crop);
    drawRegionOverlay(context, regionRect);
    drawMarkerOverlay(context, { x: regionRect.x, y: regionRect.y }, markerLabel);
  } else {
    const point = projectPagePointToCanvas(anchor.point, pageCanvas, pageSize, crop);
    drawMarkerOverlay(context, point, markerLabel);
  }

  return {
    commentId,
    dataUrl: outputCanvas.toDataURL("image/png"),
    height: outputCanvas.height,
    pageNumber,
    width: outputCanvas.width,
  };
}

function getScreenshotCrop(
  anchor: PdfDraftAnchor,
  pageCanvas: HTMLCanvasElement,
  pageSize: ThreadConversationUserCommentPageSize,
) {
  if (anchor.kind === "point") {
    const point = projectPagePointToCanvas(anchor.point, pageCanvas, pageSize, null);
    return createClampedCrop({
      canvasHeight: pageCanvas.height,
      canvasWidth: pageCanvas.width,
      height: COMMENT_POINT_SCREENSHOT_HEIGHT_PX,
      width: COMMENT_POINT_SCREENSHOT_WIDTH_PX,
      x: point.x - COMMENT_POINT_SCREENSHOT_WIDTH_PX / 2,
      y: point.y - COMMENT_POINT_SCREENSHOT_HEIGHT_PX / 2,
    });
  }

  const rect = projectPageRectToCanvas(anchor.rect, pageCanvas, pageSize, null);
  return createClampedCrop({
    canvasHeight: pageCanvas.height,
    canvasWidth: pageCanvas.width,
    height: rect.height + COMMENT_REGION_SCREENSHOT_PADDING_PX * 2,
    width: rect.width + COMMENT_REGION_SCREENSHOT_PADDING_PX * 2,
    x: rect.x - COMMENT_REGION_SCREENSHOT_PADDING_PX,
    y: rect.y - COMMENT_REGION_SCREENSHOT_PADDING_PX,
  });
}

function createClampedCrop({
  canvasHeight,
  canvasWidth,
  height,
  width,
  x,
  y,
}: {
  canvasHeight: number;
  canvasWidth: number;
  height: number;
  width: number;
  x: number;
  y: number;
}) {
  const cropWidth = Math.min(Math.max(1, width), canvasWidth);
  const cropHeight = Math.min(Math.max(1, height), canvasHeight);

  return {
    height: cropHeight,
    width: cropWidth,
    x: clamp(x, 0, Math.max(0, canvasWidth - cropWidth)),
    y: clamp(y, 0, Math.max(0, canvasHeight - cropHeight)),
  };
}

function projectPagePointToCanvas(
  point: ThreadConversationUserCommentPagePoint,
  pageCanvas: HTMLCanvasElement,
  pageSize: ThreadConversationUserCommentPageSize,
  crop: { x: number; y: number } | null,
) {
  const x = (point.x / pageSize.width) * pageCanvas.width;
  const y = (point.y / pageSize.height) * pageCanvas.height;
  return crop == null
    ? { x, y }
    : {
        x: x - crop.x,
        y: y - crop.y,
      };
}

function projectPageRectToCanvas(
  rect: ThreadConversationUserCommentPageRect,
  pageCanvas: HTMLCanvasElement,
  pageSize: ThreadConversationUserCommentPageSize,
  crop: { x: number; y: number } | null,
) {
  const x = (rect.x / pageSize.width) * pageCanvas.width;
  const y = (rect.y / pageSize.height) * pageCanvas.height;
  const width = (rect.width / pageSize.width) * pageCanvas.width;
  const height = (rect.height / pageSize.height) * pageCanvas.height;

  return crop == null
    ? { x, y, width, height }
    : {
        x: x - crop.x,
        y: y - crop.y,
        width,
        height,
      };
}

function drawMarkerOverlay(
  context: CanvasRenderingContext2D,
  point: ThreadConversationUserCommentPagePoint,
  markerLabel: string,
) {
  const radius = 13;

  context.save();
  context.shadowBlur = 3;
  context.shadowColor = "rgba(0, 0, 0, 0.18)";
  context.fillStyle = COMMENT_MARKER_COLOR;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#ffffff";
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#ffffff";
  context.font = "bold 11px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(markerLabel, point.x, point.y);
  context.restore();
}

function drawRegionOverlay(
  context: CanvasRenderingContext2D,
  rect: ThreadConversationUserCommentPageRect,
) {
  context.save();
  context.fillStyle = "rgba(18, 141, 255, 0.2)";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeStyle = "#0285ff";
  context.lineWidth = 2;
  context.setLineDash([6, 4]);
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function createCommentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `pdf-comment-${Date.now()}`;
}

function encodeSvgDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
