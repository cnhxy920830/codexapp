import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/i18n";

type ImagePreviewDialogProps = {
  alt: string;
  caption?: string | null;
  closeAriaLabel?: string;
  contentMaxWidthClassName?: string;
  downloadSrc?: string;
  imageDecoding?: HTMLImageElement["decoding"];
  imageDraggable?: boolean;
  imageFetchPriority?: HTMLImageElement["fetchPriority"];
  imageLoading?: "eager" | "lazy";
  imageReferrerPolicy?: ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
  onImageError?: ((event: SyntheticEvent<HTMLImageElement, Event>) => void) | undefined;
  onCloseAutoFocus?: ((event: ImagePreviewDialogCloseAutoFocusEvent) => void) | undefined;
  onNextImage?: (() => void) | null;
  onOpenChange: (open: boolean) => void;
  onPreviousImage?: (() => void) | null;
  open: boolean;
  portalContainer?: Element | DocumentFragment | null;
  src: string;
  triggerContent: ReactNode;
};

type Size = {
  height: number;
  width: number;
};

export type ImagePreviewDialogCloseAutoFocusEvent = {
  defaultPrevented: boolean;
  preventDefault: () => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const PERCENT_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  style: "percent",
});

export function ImagePreviewDialog({
  alt,
  caption = null,
  closeAriaLabel,
  contentMaxWidthClassName,
  downloadSrc,
  imageDecoding,
  imageDraggable,
  imageFetchPriority,
  imageLoading,
  imageReferrerPolicy,
  onImageError,
  onCloseAutoFocus,
  onNextImage = null,
  onOpenChange,
  onPreviousImage = null,
  open,
  portalContainer,
  src,
  triggerContent,
}: ImagePreviewDialogProps) {
  const { t } = useI18n();
  const dismissAreaRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusTargetRef = useRef<HTMLElement | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);

  const dialogLabel = t("imagePreviewDialog.label");
  const resolvedCloseAriaLabel = closeAriaLabel ?? t("imagePreviewDialog.close");
  const downloadAriaLabel = t("imagePreviewDialog.download");
  const zoomInAriaLabel = t("imagePreviewDialog.zoomIn");
  const zoomOutAriaLabel = t("imagePreviewDialog.zoomOut");
  const previousImageAriaLabel = t("imagePreviewDialog.previousImage");
  const nextImageAriaLabel = t("imagePreviewDialog.nextImage");

  const normalizedCaption = caption?.trim() || null;
  const normalizedDownloadSrc = downloadSrc ?? src;
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;
  const zoomPercent = PERCENT_FORMATTER.format(zoom);
  const downloadFileName = resolveImagePreviewDownloadFileName(normalizedDownloadSrc, alt);

  const resetView = useCallback(() => {
    setZoom(1);
    setNaturalSize(null);
  }, []);

  const rememberFocusTarget = useCallback((target: EventTarget | null) => {
    restoreFocusTargetRef.current = target instanceof HTMLElement ? target : null;
  }, []);

  const scheduleFocusRestore = useCallback(() => {
    const target = restoreFocusTargetRef.current;
    queueMicrotask(() => {
      restoreImagePreviewFocusTarget(target, onCloseAutoFocus);
    });
  }, [onCloseAutoFocus]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        if (typeof document !== "undefined" && restoreFocusTargetRef.current == null) {
          rememberFocusTarget(document.activeElement);
        }
        onOpenChange(true);
        return;
      }

      if (!nextOpen) {
        resetView();
        onOpenChange(false);
        scheduleFocusRestore();
        return;
      }
    },
    [onOpenChange, rememberFocusTarget, resetView, scheduleFocusRestore],
  );

  const updateDismissAreaSize = useCallback((element: HTMLDivElement | null) => {
    if (element == null) {
      setContainerSize(null);
      return;
    }

    const { height, width } = element.getBoundingClientRect();
    setContainerSize((current) =>
      current?.height === height && current.width === width ? current : { height, width },
    );
  }, []);

  const setDismissAreaNode = useCallback(
    (element: HTMLDivElement | null) => {
      dismissAreaRef.current = element;
      updateDismissAreaSize(element);
    },
    [updateDismissAreaSize],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const element = dismissAreaRef.current;
    if (element == null || typeof ResizeObserver === "undefined") {
      return;
    }

    updateDismissAreaSize(element);

    const observer = new ResizeObserver(() => {
      updateDismissAreaSize(element);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [open, updateDismissAreaSize]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        event.stopPropagation();
        handleOpenChange(false);
        return;
      }

      if (event.key === "ArrowLeft" && onPreviousImage) {
        event.preventDefault();
        event.stopPropagation();
        resetView();
        onPreviousImage();
        return;
      }

      if (event.key === "ArrowRight" && onNextImage) {
        event.preventDefault();
        event.stopPropagation();
        resetView();
        onNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [handleOpenChange, onNextImage, onPreviousImage, open, resetView]);

  const scaledImageStyle = useMemo(() => {
    if (containerSize == null || naturalSize == null) {
      return undefined;
    }

    const widthScale = containerSize.width / naturalSize.width;
    const heightScale = containerSize.height / naturalSize.height;
    const scaledFactor = Math.min(widthScale, heightScale) * zoom;
    if (!Number.isFinite(scaledFactor) || scaledFactor <= 0) {
      return undefined;
    }

    return {
      height: `${naturalSize.height * scaledFactor}px`,
      width: `${naturalSize.width * scaledFactor}px`,
    };
  }, [containerSize, naturalSize, zoom]);

  const trigger = isValidElement(triggerContent)
    ? (() => {
        const typedTriggerContent = triggerContent as ReactElement<{
          onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
        }>;

        return cloneElement(typedTriggerContent, {
          onClick: (event: ReactMouseEvent<HTMLElement>) => {
            typedTriggerContent.props.onClick?.(event);
            if (event.defaultPrevented) {
              return;
            }
            rememberFocusTarget(event.currentTarget);
            handleOpenChange(true);
          },
        });
      })()
    : (
        <span
          className="contents"
          onClick={(event) => {
            if (event.defaultPrevented) {
              return;
            }
            rememberFocusTarget(event.currentTarget);
            handleOpenChange(true);
          }}
        >
          {triggerContent}
        </span>
      );

  if (!open || typeof document === "undefined") {
    return trigger;
  }

  return (
    <>
      {trigger}
      {createPortal(
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/90" />
          <div
            className="pointer-events-none fixed inset-0 h-[100dvh] w-screen max-w-none overflow-visible rounded-none bg-transparent p-0 shadow-none ring-0 backdrop-blur-none"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
          >
            <div
              className="pointer-events-auto relative flex h-full w-full flex-col items-center justify-center px-14 pt-12 pb-8"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  handleOpenChange(false);
                }
              }}
            >
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <a
                  className={IMAGE_PREVIEW_ACTION_CLASS_NAME}
                  href={normalizedDownloadSrc}
                  download={downloadFileName}
                  aria-label={downloadAriaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!normalizedDownloadSrc.startsWith("data:")) {
                      return;
                    }

                    event.preventDefault();
                    const objectUrl = URL.createObjectURL(createBlobFromDataUrl(normalizedDownloadSrc));
                    const anchor = document.createElement("a");
                    anchor.href = objectUrl;
                    anchor.download = downloadFileName;
                    anchor.style.display = "none";
                    document.body.append(anchor);
                    anchor.click();
                    anchor.remove();
                    window.setTimeout(() => {
                      URL.revokeObjectURL(objectUrl);
                    }, 0);
                  }}
                  onPointerDown={stopPointerEventPropagation}
                >
                  <ImagePreviewDownloadIcon className="icon-xs" />
                </a>
                <button
                  type="button"
                  className={IMAGE_PREVIEW_ACTION_CLASS_NAME}
                  aria-label={resolvedCloseAriaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenChange(false);
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleOpenChange(false);
                  }}
                >
                  <ImagePreviewCloseIcon className="icon-sm" />
                </button>
              </div>

              {onPreviousImage ? (
                <button
                  type="button"
                  className={`${IMAGE_PREVIEW_ACTION_CLASS_NAME} absolute top-1/2 left-3 z-10 -translate-y-1/2 p-0`}
                  aria-label={previousImageAriaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    resetView();
                    onPreviousImage();
                  }}
                  onPointerDown={stopPointerEventPropagation}
                >
                  <ImagePreviewArrowLeftIcon className="icon-sm" />
                </button>
              ) : null}

              {onNextImage ? (
                <button
                  type="button"
                  className={`${IMAGE_PREVIEW_ACTION_CLASS_NAME} absolute top-1/2 right-3 z-10 -translate-y-1/2 p-0`}
                  aria-label={nextImageAriaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    resetView();
                    onNextImage();
                  }}
                  onPointerDown={stopPointerEventPropagation}
                >
                  <ImagePreviewArrowLeftIcon className="icon-sm rotate-180" />
                </button>
              ) : null}

              <div
                ref={setDismissAreaNode}
                data-testid="image-preview-dismiss-area"
                className={joinClassNames(
                  "flex min-h-0 w-full flex-1 items-center justify-center overflow-auto",
                  contentMaxWidthClassName,
                )}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    handleOpenChange(false);
                  }
                }}
              >
                <h2 className="sr-only">{dialogLabel}</h2>
                <img
                  src={src}
                  alt={alt}
                  className={joinClassNames(
                    "rounded-lg object-contain",
                    scaledImageStyle == null ? "max-h-full w-full" : "block max-w-none",
                  )}
                  style={scaledImageStyle}
                  decoding={imageDecoding}
                  draggable={imageDraggable}
                  fetchPriority={imageFetchPriority}
                  loading={imageLoading}
                  referrerPolicy={imageReferrerPolicy}
                  onError={onImageError}
                  onLoad={(event) => {
                    const { naturalHeight, naturalWidth } = event.currentTarget;
                    if (naturalWidth === 0 || naturalHeight === 0) {
                      return;
                    }
                    setNaturalSize({
                      height: naturalHeight,
                      width: naturalWidth,
                    });
                  }}
                  onPointerDown={stopPointerEventPropagation}
                />
              </div>

              <div className="z-10 mt-5 flex max-w-[min(48rem,calc(100vw-2rem))] flex-col items-center gap-3 text-token-foreground">
                {normalizedCaption ? (
                  <div className="max-w-full rounded-2xl bg-token-editor-background/95 px-4 py-2 text-center text-sm shadow-md ring-1 ring-black/5 backdrop-blur-sm">
                    {normalizedCaption}
                  </div>
                ) : null}

                <div className="flex items-center gap-1 rounded-full bg-token-editor-background/95 p-1 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
                  <button
                    type="button"
                    className="no-drag flex size-9 cursor-interaction items-center justify-center rounded-full bg-token-foreground/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={zoomOutAriaLabel}
                    disabled={!canZoomOut}
                    onClick={() => {
                      setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP));
                    }}
                  >
                    <ImagePreviewMinusIcon className="icon-xs" />
                  </button>
                  <div className="no-drag flex min-w-16 items-center justify-center px-2 text-center text-sm tabular-nums">
                    <span>{zoomPercent}</span>
                  </div>
                  <button
                    type="button"
                    className="no-drag flex size-9 cursor-interaction items-center justify-center rounded-full bg-token-foreground/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={zoomInAriaLabel}
                    disabled={!canZoomIn}
                    onClick={() => {
                      setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
                    }}
                  >
                    <ImagePreviewPlusIcon className="icon-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        portalContainer ?? document.body,
      )}
    </>
  );
}

export function restoreImagePreviewFocusTarget(
  target: { focus: () => void; isConnected?: boolean } | null,
  onCloseAutoFocus?: ((event: ImagePreviewDialogCloseAutoFocusEvent) => void) | undefined,
) {
  const event = createImagePreviewCloseAutoFocusEvent();
  onCloseAutoFocus?.(event);
  if (event.defaultPrevented || target == null || target.isConnected === false) {
    return false;
  }

  target.focus();
  return true;
}

function createImagePreviewCloseAutoFocusEvent(): ImagePreviewDialogCloseAutoFocusEvent {
  let defaultPrevented = false;
  return {
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault() {
      defaultPrevented = true;
    },
  };
}

function joinClassNames(...classNames: Array<string | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function resolveImagePreviewDownloadFileName(src: string, alt: string) {
  const normalizedAlt = alt.trim();
  if (normalizedAlt.length > 0) {
    return normalizedAlt;
  }

  if (src.startsWith("data:")) {
    return "image";
  }

  const rawFileName = src.split(/[?#]/, 1)[0]?.split(/[\\/]/).at(-1);
  if (rawFileName == null || rawFileName.length === 0) {
    return "image";
  }

  try {
    return decodeURIComponent(rawFileName);
  } catch {
    return rawFileName;
  }
}

function createBlobFromDataUrl(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");
  const metadata = dataUrl.slice(5, separatorIndex);
  const encodedBody = dataUrl.slice(separatorIndex + 1);
  const mimeType = metadata.match(/^[^;]+/)?.[0] || "application/octet-stream";
  if (/;base64/i.test(metadata)) {
    const binary = atob(encodedBody);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  }

  return new Blob([decodeURIComponent(encodedBody)], { type: mimeType });
}

function stopPointerEventPropagation(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation();
}

function ImagePreviewDownloadIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2.66831 12.6664V12.5004C2.66831 12.1331 2.96607 11.8353 3.33334 11.8353C3.70061 11.8353 3.99838 12.1331 3.99838 12.5004V12.6664C3.99838 13.3773 3.99929 13.8708 4.03061 14.2543C4.0613 14.6299 4.11812 14.8414 4.19858 14.9994L4.26889 15.1263C4.4452 15.4138 4.69823 15.6482 5.00034 15.8021L5.13022 15.8578C5.27399 15.9092 5.4635 15.9471 5.74545 15.9701C6.12897 16.0014 6.62231 16.0013 7.33334 16.0013H12.6664C13.3772 16.0013 13.8708 16.0014 14.2542 15.9701C14.6296 15.9394 14.8414 15.8825 14.9994 15.8021L15.1263 15.7308C15.4137 15.5545 15.6482 15.3014 15.8021 14.9994L15.8578 14.8695C15.9092 14.7258 15.947 14.5361 15.9701 14.2543C16.0014 13.8708 16.0013 13.3772 16.0013 12.6664V12.5004C16.0013 12.1332 16.2992 11.8355 16.6664 11.8353C17.0336 11.8353 17.3314 12.1331 17.3314 12.5004V12.6664C17.3314 13.3554 17.332 13.9125 17.2953 14.3627C17.2625 14.7636 17.1975 15.1248 17.0531 15.4613L16.9867 15.6039C16.7212 16.1248 16.3173 16.5606 15.8216 16.8646L15.6039 16.9867C15.2271 17.1787 14.8206 17.2579 14.3626 17.2953C13.9124 17.3321 13.3554 17.3314 12.6664 17.3314H7.33334C6.64425 17.3314 6.0873 17.3321 5.63706 17.2953C5.23651 17.2626 4.87562 17.1982 4.5394 17.0541L4.39682 16.9867C3.8757 16.7212 3.4392 16.3175 3.1351 15.8217L3.01303 15.6039C2.82106 15.2271 2.74186 14.8207 2.70444 14.3627C2.66767 13.9125 2.66831 13.3554 2.66831 12.6664ZM9.3353 3.33337C9.3353 2.9661 9.63307 2.66833 10.0003 2.66833C10.3675 2.66851 10.6654 2.96621 10.6654 3.33337V10.8939L12.8626 8.69666L12.9671 8.61169C13.2253 8.44097 13.5767 8.4693 13.804 8.69666C14.0634 8.95633 14.0635 9.37748 13.804 9.63708L10.4701 12.9701C10.3454 13.0947 10.1766 13.1653 10.0003 13.1654C9.82397 13.1654 9.65434 13.0948 9.52963 12.9701L6.19663 9.63708L6.11166 9.53259C5.9411 9.27445 5.96934 8.92394 6.19663 8.69666C6.42392 8.46937 6.77442 8.44113 7.03256 8.61169L7.13705 8.69666L9.3353 10.8949V3.33337Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImagePreviewArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8.8011 3.611C9.05912 3.44087 9.40989 3.46898 9.63703 3.69596C9.89673 3.95566 9.89673 4.37767 9.63703 4.63737L4.93977 9.33463H16.6663L16.8011 9.34831C17.1038 9.41043 17.3312 9.67859 17.3314 9.99967C17.3314 10.3209 17.1039 10.5888 16.8011 10.651L16.6663 10.6647H4.93879L9.63703 15.363L9.722 15.4674C9.89241 15.7255 9.86413 16.0761 9.63703 16.3034C9.40981 16.5306 9.05921 16.5587 8.8011 16.3883L8.69661 16.3034L2.86262 10.4704C2.60319 10.2108 2.6033 9.78962 2.86262 9.52995L8.69661 3.69596L8.8011 3.611Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImagePreviewMinusIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 10.0002C3.5 9.63297 3.79777 9.33521 4.16504 9.33521H15.835C16.2022 9.33521 16.5 9.63297 16.5 10.0002C16.5 10.3675 16.2022 10.6652 15.835 10.6652H4.16504C3.79777 10.6652 3.5 10.3675 3.5 10.0002Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImagePreviewPlusIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImagePreviewCloseIcon({ className }: { className?: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true" className={className}>
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}

const IMAGE_PREVIEW_ACTION_CLASS_NAME =
  "no-drag pointer-events-auto flex h-10 min-w-10 cursor-interaction items-center justify-center rounded-full bg-token-editor-background/95 px-3 text-token-foreground shadow-md ring-1 ring-black/5 backdrop-blur-sm transition-transform hover:bg-token-menu-background hover:ring-token-focus-border focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
