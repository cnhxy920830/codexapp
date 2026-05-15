import { useEffect, useState, type RefObject } from "react";
import { useI18n } from "../i18n/i18n";
import { decodeFileUrlPath } from "../lib/fileReference";
import { readFileBinary } from "../services/hostFiles";
import { ImagePreviewDialog } from "./ImagePreviewDialog";
import type { MarkdownBrowserLinkHandlers, MarkdownSidePanelFileLinkHandlers } from "./markdownLinkTypes";

export type MarkdownMediaContext = MarkdownBrowserLinkHandlers &
  MarkdownSidePanelFileLinkHandlers & {
    cwd?: string | null;
    hostId?: string | null;
    rootRef?: RefObject<HTMLElement | null> | null;
  };

type MarkdownMediaProps = {
  alt: string;
  className: string;
  context?: MarkdownMediaContext;
  src: string;
  title: string | null;
};

type MarkdownMediaKind = "image" | "video";

type MarkdownMediaReadTarget = {
  cwd: string | null;
  path: string;
};

type MarkdownImagePreviewItem = {
  alt: string;
  src: string;
};

type MarkdownImagePreviewGallery = {
  index: number;
  items: MarkdownImagePreviewItem[];
};

type MarkdownImagePreviewImageNode = {
  alt?: string;
  currentSrc?: string;
  getAttribute: (name: string) => string | null;
};

type MarkdownImagePreviewTriggerNode = {
  querySelector: (selector: string) => MarkdownImagePreviewImageNode | null;
};

type MarkdownImagePreviewRootNode = {
  querySelectorAll: (selector: string) => Iterable<MarkdownImagePreviewTriggerNode>;
};

const MARKDOWN_IMAGE_PREVIEW_TRIGGER_ATTRIBUTE = "data-markdown-image-preview-trigger";
const VIDEO_EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogg: "video/ogg",
  webm: "video/webm",
};

const IMAGE_EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export function MarkdownMedia({
  alt,
  className,
  context,
  src,
  title,
}: MarkdownMediaProps) {
  const { t } = useI18n();
  const normalizedSrc = normalizeMarkdownMediaSource(src);
  const readTarget =
    normalizedSrc == null
      ? null
      : getMarkdownMediaReadTarget(normalizedSrc, context?.cwd ?? null);
  const [gallery, setGallery] = useState<MarkdownImagePreviewGallery | null>(null);
  const [loadState, setLoadState] = useState<{
    isLoading: boolean;
    mimeType: string | null;
    resolvedSrc: string | null;
  }>(() => ({
    isLoading: readTarget != null,
    mimeType: readTarget == null ? inferMarkdownMediaMimeType(normalizedSrc) : null,
    resolvedSrc: readTarget == null ? normalizedSrc : null,
  }));

  useEffect(() => {
    if (readTarget == null) {
      setLoadState({
        isLoading: false,
        mimeType: inferMarkdownMediaMimeType(normalizedSrc),
        resolvedSrc: normalizedSrc,
      });
      return;
    }

    let cancelled = false;
    setLoadState({
      isLoading: true,
      mimeType: null,
      resolvedSrc: null,
    });

    void readFileBinary({
      cwd: readTarget.cwd,
      hostId: context?.hostId ?? null,
      path: readTarget.path,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const mimeType = response.mimeType ?? inferMarkdownMediaMimeType(normalizedSrc);
        setLoadState({
          isLoading: false,
          mimeType,
          resolvedSrc: createMarkdownMediaDataUrl({
            contentsBase64: response.contentsBase64,
            mimeType,
            source: normalizedSrc ?? readTarget.path,
          }),
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLoadState({
          isLoading: false,
          mimeType: null,
          resolvedSrc: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [context?.hostId, normalizedSrc, readTarget?.cwd, readTarget?.path]);

  useEffect(() => {
    setGallery(null);
  }, [loadState.resolvedSrc]);

  if (normalizedSrc == null) {
    return <MarkdownMediaFallback alt={alt} src={src} />;
  }

  if (loadState.isLoading) {
    return <span className="text-xs text-token-text-tertiary">{t("markdown.imageLoading")}</span>;
  }

  const resolvedSrc = loadState.resolvedSrc;
  if (resolvedSrc == null) {
    return <MarkdownMediaFallback alt={alt} src={src} />;
  }

  const mediaKind = getMarkdownMediaKind(resolvedSrc, loadState.mimeType);
  if (mediaKind === "video") {
    return (
      <video
        aria-label={alt.length > 0 ? alt : t("markdown.videoPlayer")}
        className={className}
        controls
        preload="metadata"
        src={resolvedSrc}
        title={title ?? undefined}
      />
    );
  }

  const currentGalleryItem = gallery?.items[gallery.index] ?? null;
  const previewAlt = currentGalleryItem?.alt ?? alt;
  const previewSrc = currentGalleryItem?.src ?? resolvedSrc;
  const previousIndex = gallery != null && gallery.index > 0 ? gallery.index - 1 : null;
  const nextIndex =
    gallery != null && gallery.index + 1 < gallery.items.length ? gallery.index + 1 : null;

  return (
    <ImagePreviewDialog
      alt={previewAlt}
      caption={previewAlt}
      contentMaxWidthClassName="max-w-[min(90vw,var(--markdown-wide-block-max-width))]"
      downloadSrc={previewSrc}
      onNextImage={
        nextIndex == null
          ? null
          : () => {
              setGallery((current) =>
                current == null ? current : { ...current, index: nextIndex },
              );
            }
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setGallery(null);
        }
      }}
      onPreviousImage={
        previousIndex == null
          ? null
          : () => {
              setGallery((current) =>
                current == null ? current : { ...current, index: previousIndex },
              );
            }
      }
      open={gallery != null}
      src={previewSrc}
      triggerContent={
        <button
          aria-label={alt.length > 0 ? alt : t("markdown.imagePreviewButton")}
          className="cursor-zoom-in border-0 bg-transparent p-0"
          data-markdown-image-preview-trigger="true"
          type="button"
          onClick={(event) => {
            setGallery(
              collectMarkdownImagePreviewGallery({
                fallbackItem: { alt, src: resolvedSrc },
                root: context?.rootRef?.current ?? null,
                trigger: event.currentTarget,
              }),
            );
          }}
        >
          <img
            alt={alt}
            className={className}
            loading="lazy"
            src={resolvedSrc}
            title={title ?? undefined}
          />
        </button>
      }
    />
  );
}

function MarkdownMediaFallback({
  alt,
  src,
}: {
  alt: string;
  src: string;
}) {
  return <span className="text-xs text-token-text-tertiary">{alt.length > 0 ? alt : src}</span>;
}

export function collectMarkdownImagePreviewGallery({
  fallbackItem,
  root,
  trigger,
}: {
  fallbackItem: MarkdownImagePreviewItem;
  root: MarkdownImagePreviewRootNode | null;
  trigger: MarkdownImagePreviewTriggerNode | null;
}): MarkdownImagePreviewGallery {
  const triggers =
    root == null
      ? []
      : Array.from(
          root.querySelectorAll(
            `[${MARKDOWN_IMAGE_PREVIEW_TRIGGER_ATTRIBUTE}="true"]`,
          ),
        );
  const items: MarkdownImagePreviewItem[] = [];
  let activeIndex: number | null = null;

  for (const currentTrigger of triggers) {
    const image = currentTrigger.querySelector("img");
    const itemSrc = image?.currentSrc || image?.getAttribute("src") || "";
    if (itemSrc.length === 0) {
      continue;
    }

    if (currentTrigger === trigger) {
      activeIndex = items.length;
    }

    items.push({
      alt: image?.alt ?? "",
      src: itemSrc,
    });
  }

  if (activeIndex == null) {
    return {
      index: 0,
      items: [fallbackItem],
    };
  }

  return {
    index: activeIndex,
    items,
  };
}

export function normalizeMarkdownMediaSource(src: string) {
  const normalized = src.trim();
  if (normalized.length === 0 || !isSafeMarkdownMediaUrl(normalized)) {
    return null;
  }

  return normalized;
}

export function getMarkdownMediaKind(
  source: string | null,
  mimeType?: string | null,
): MarkdownMediaKind | null {
  if (source == null) {
    return null;
  }

  const normalizedMimeType =
    mimeType?.trim().toLowerCase() ?? inferMarkdownMediaMimeType(source);
  if (normalizedMimeType?.startsWith("video/")) {
    return "video";
  }

  if (normalizedMimeType?.startsWith("image/")) {
    return "image";
  }

  return null;
}

export function getMarkdownMediaReadTarget(
  source: string,
  cwd: string | null,
): MarkdownMediaReadTarget | null {
  if (source.startsWith("file://")) {
    return {
      cwd: null,
      path: decodeFileUrlPath(source),
    };
  }

  if (!isLikelyLocalMarkdownMediaSource(source)) {
    return null;
  }

  return {
    cwd: isAbsoluteFilesystemPath(source) ? null : cwd,
    path: source,
  };
}

export function createMarkdownMediaDataUrl({
  contentsBase64,
  mimeType,
  source,
}: {
  contentsBase64: string;
  mimeType: string | null;
  source: string;
}) {
  return `data:${mimeType ?? inferMarkdownMediaMimeType(source) ?? "application/octet-stream"};base64,${contentsBase64}`;
}

function inferMarkdownMediaMimeType(source: string | null) {
  if (source == null) {
    return null;
  }

  const dataUrlMatch = source.match(/^data:([^;,]+)/i);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1].toLowerCase();
  }

  const extension = getLowercaseFileExtension(source);
  if (extension == null) {
    return null;
  }

  return (
    VIDEO_EXTENSION_TO_MIME_TYPE[extension] ??
    IMAGE_EXTENSION_TO_MIME_TYPE[extension] ??
    null
  );
}

function getLowercaseFileExtension(source: string) {
  const withoutQuery = source.replace(/[?#].*$/, "");
  const lastSlashIndex = Math.max(
    withoutQuery.lastIndexOf("/"),
    withoutQuery.lastIndexOf("\\"),
  );
  const fileName =
    lastSlashIndex >= 0 ? withoutQuery.slice(lastSlashIndex + 1) : withoutQuery;
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex < 0 || extensionIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(extensionIndex + 1).toLowerCase();
}

function isSafeMarkdownMediaUrl(url: string) {
  return !/^(javascript:|vbscript:|data:(?!(image|video)\/))/i.test(url);
}

function isLikelyLocalMarkdownMediaSource(source: string) {
  return !/^data:/i.test(source) && !hasNonFileUrlProtocol(source);
}

function hasNonFileUrlProtocol(source: string) {
  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(source)) {
    return false;
  }

  return URL_PROTOCOL_PATTERN.test(source) && !source.startsWith("file://");
}

function isAbsoluteFilesystemPath(source: string) {
  return (
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(source) ||
    source.startsWith("/") ||
    source.startsWith("\\\\")
  );
}

const URL_PROTOCOL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;
