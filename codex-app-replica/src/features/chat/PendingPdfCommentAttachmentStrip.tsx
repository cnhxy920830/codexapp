import { CloseTabIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";

type PendingPdfCommentAttachmentStripProps = {
  pendingPdfCommentCount: number;
  pendingPdfComments: PendingPdfCommentAttachment[];
  onClearPendingPdfComments?: (() => void) | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function PendingPdfCommentAttachmentStrip({
  pendingPdfCommentCount,
  pendingPdfComments,
  onClearPendingPdfComments = null,
  t,
}: PendingPdfCommentAttachmentStripProps) {
  if (pendingPdfCommentCount === 0) {
    return null;
  }

  const summary = t("commentAttachments.numAnnotations", { count: pendingPdfCommentCount });
  const hasPreview = pendingPdfComments.length > 0;

  return (
    <div className="px-3 pt-3">
      <div className="hide-scrollbar overflow-x-auto">
        <div className="flex min-w-max items-end gap-2">
          <div className="group relative inline-flex">
            <div className="app-control flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[12px] leading-5">
              <span className="truncate">{summary}</span>
              {onClearPendingPdfComments == null ? null : (
                <button
                  type="button"
                  aria-label={t("commentAttachments.removeAnnotationsAriaLabel")}
                  onClick={onClearPendingPdfComments}
                  className="app-control-weak flex h-5 w-5 items-center justify-center rounded-full"
                >
                  <CloseTabIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {hasPreview ? (
              <div
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-96 max-w-[min(24rem,calc(100vw-16px))] overflow-hidden rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block"
                style={{ maxHeight: "min(20rem, calc(100vh - 16px))" }}
              >
                <div className="flex max-h-[min(20rem,calc(100vh-16px))] flex-col divide-y divide-[var(--app-shell-border)] overflow-y-auto">
                  {pendingPdfComments.map(({ comment, id }) => (
                    <PendingPdfCommentPreviewRow
                      key={id}
                      body={comment.body}
                      screenshotSrc={comment.localPdfScreenshot?.dataUrl ?? null}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingPdfCommentPreviewRow({
  body,
  screenshotSrc,
  t,
}: {
  body: string;
  screenshotSrc: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-2">
      <div className="flex items-center gap-1 text-xs leading-4 text-[var(--app-shell-subtle)]">
        {screenshotSrc === null ? null : (
          <img
            alt={t("codex.localConversation.comment.screenshotAttached")}
            className="h-5 w-7 shrink-0 rounded-sm border border-[var(--app-shell-border)] object-cover"
            src={screenshotSrc}
          />
        )}
        <span>{t("codex.localConversation.pdfComment.annotationAttached")}</span>
      </div>
      <div className="text-sm leading-5 break-words whitespace-pre-wrap text-[var(--app-shell-text)]">
        {body}
      </div>
    </div>
  );
}
