import { useEffect, useState } from "react";
import {
  createMarkdownMediaDataUrl,
  getMarkdownMediaReadTarget,
  inferMarkdownMediaMimeType,
  normalizeMarkdownMediaSource,
} from "../../components/markdownPreviewMedia";
import { ImagePreviewDialog } from "../../components/ImagePreviewDialog";
import { useI18n } from "../../i18n/i18n";
import { readFileBinary } from "../../services/hostFiles";

export function LocalUserImageAttachment({
  conversationCwd = null,
  conversationHostId = null,
  src,
}: {
  conversationCwd?: string | null;
  conversationHostId?: string | null;
  src: string;
}) {
  const { t } = useI18n();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const normalizedSrc = normalizeMarkdownMediaSource(src);
  const readTarget =
    normalizedSrc == null ? null : getMarkdownMediaReadTarget(normalizedSrc, conversationCwd);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() =>
    readTarget == null ? normalizedSrc : null,
  );
  const altText = t("codex.localConversation.userImageAttachment");
  const closeLabel = t("codex.localConversation.closeImagePreview");

  useEffect(() => {
    if (readTarget == null) {
      setResolvedSrc(normalizedSrc);
      return;
    }

    let cancelled = false;
    setResolvedSrc(null);

    void readFileBinary({
      cwd: readTarget.cwd,
      hostId: conversationHostId,
      path: readTarget.path,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const mimeType = response.mimeType ?? inferMarkdownMediaMimeType(normalizedSrc);
        setResolvedSrc(
          createMarkdownMediaDataUrl({
            contentsBase64: response.contentsBase64,
            mimeType,
            source: normalizedSrc ?? readTarget.path,
          }),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setResolvedSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationCwd, conversationHostId, normalizedSrc, readTarget?.cwd, readTarget?.path]);

  if (resolvedSrc == null) {
    return null;
  }

  return (
    <ImagePreviewDialog
      alt={altText}
      closeAriaLabel={closeLabel}
      contentMaxWidthClassName="max-w-[min(90vw,calc(var(--thread-content-max-width)+16rem))]"
      imageReferrerPolicy="no-referrer"
      onOpenChange={setIsPreviewOpen}
      open={isPreviewOpen}
      src={resolvedSrc}
      triggerContent={
        <div
          className="size-16 cursor-interaction rounded-lg border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-shell-control-ring)]"
          role="button"
          tabIndex={0}
          aria-label={altText}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsPreviewOpen(true);
            }
          }}
        >
          <img
            src={resolvedSrc}
            alt={altText}
            className="h-full w-full rounded-lg object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      }
    />
  );
}
