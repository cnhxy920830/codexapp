import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Tooltip } from "../../components/Tooltip";
import type { MessageKey } from "../../i18n/messages";
import { openFile } from "../../services/hostFiles";

export type DocxPreviewPanelTestMode = {
  kind: "ready";
  currentPage?: number;
  totalPages?: number;
  zoomPercent?: number;
  zoomToFit?: boolean;
};

type DocxPreviewPanelProps = {
  bytes: Uint8Array;
  hostId?: string | null;
  path: string;
  testMode?: DocxPreviewPanelTestMode;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type DocxRenderAsync = (
  data: Uint8Array,
  bodyContainer: HTMLElement,
  styleContainer: HTMLElement,
  options: {
    className: string;
    renderAltChunks: boolean;
    useBase64URL: boolean;
  },
) => Promise<unknown>;

type LoadState = "loading" | "ready" | "error";
type ZoomMode =
  | {
      kind: "fit-width";
    }
  | {
      kind: "percentage";
      zoomPercent: number;
    };

const DOCX_CLASS_NAME = "codex-docx-preview";
const DOCX_PAGE_SELECTOR = `section.${DOCX_CLASS_NAME}`;
const DOCX_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200];
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 400;
const WHEEL_ZOOM_FACTOR = 0.01;
const DOCX_PAGE_VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];
const PROGRAMMATIC_SCROLL_SETTLE_DELAY_MS = 100;
const DOCX_BODY_CLASS_NAME = "h-full min-h-0 overflow-auto bg-token-side-bar-background overscroll-contain";
const DOCX_WRAPPER_STYLE = `
  .${DOCX_CLASS_NAME}-wrapper {
    min-height: 100%;
    display: flex;
    flex-flow: column;
    align-items: center;
    gap: 0.875rem;
    padding: 1.5rem 1.5rem var(--right-panel-composer-overlay-reserve, 1.5rem);
    background: var(--color-token-side-bar-background) !important;
  }

  .${DOCX_CLASS_NAME}-wrapper > section.${DOCX_CLASS_NAME} {
    margin: 0 !important;
    border: 1px solid var(--color-token-border-default);
    background: white !important;
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.05);
    transform-origin: top center;
    border-radius: 0;
    zoom: var(--codex-docx-preview-zoom, 1);
  }
`;

let docxRenderAsyncPromise: Promise<DocxRenderAsync | null> | null = null;

export function DocxPreviewPanel({ bytes, hostId = null, path, testMode, title, t }: DocxPreviewPanelProps) {
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const styleContainerRef = useRef<HTMLDivElement | null>(null);
  const renderGenerationRef = useRef(0);
  const pendingProgrammaticPageRef = useRef<number | null>(null);
  const clearProgrammaticScrollRef = useRef<(() => void) | null>(null);
  const touchZoomStateRef = useRef<{ distance: number; zoomPercent: number } | null>(null);
  const zoomMenuRef = useRef<HTMLDivElement | null>(null);
  const isTestReady = testMode?.kind === "ready";
  const initialTotalPages = isTestReady ? Math.max(testMode.totalPages ?? 3, 1) : 0;
  const [renderAsync, setRenderAsync] = useState<DocxRenderAsync | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(isTestReady ? "ready" : "loading");
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(isTestReady ? clampDocxPage(testMode.currentPage ?? 1, initialTotalPages) : 1);
  const [bodyContainerWidth, setBodyContainerWidth] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(
    isTestReady
      ? testMode.zoomToFit
        ? { kind: "fit-width" }
        : { kind: "percentage", zoomPercent: clampZoomPercent(testMode.zoomPercent ?? 75) }
      : { kind: "percentage", zoomPercent: 75 },
  );
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const titleWithoutDocxExtension = useMemo(() => title.replace(/\.docx$/i, ""), [title]);

  useEffect(() => {
    if (testMode != null) {
      return;
    }

    let disposed = false;

    void loadDocxRenderAsync()
      .then((nextRenderAsync) => {
        if (disposed) {
          return;
        }

        setRenderAsync(nextRenderAsync);
        if (nextRenderAsync == null) {
          setLoadState("error");
        }
      })
      .catch(() => {
        if (!disposed) {
          setRenderAsync(null);
          setLoadState("error");
        }
      });

    return () => {
      disposed = true;
    };
  }, [testMode]);

  useEffect(() => {
    if (!isZoomMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (zoomMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsZoomMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsZoomMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isZoomMenuOpen]);

  useEffect(() => {
    if (!isTestReady) {
      return;
    }

    const nextTotalPages = Math.max(testMode.totalPages ?? 3, 1);
    setLoadState("ready");
    setTotalPages(nextTotalPages);
    setCurrentPage(clampDocxPage(testMode.currentPage ?? 1, nextTotalPages));
    setZoomMode(
      testMode.zoomToFit
        ? { kind: "fit-width" }
        : { kind: "percentage", zoomPercent: clampZoomPercent(testMode.zoomPercent ?? 75) },
    );
  }, [isTestReady, testMode]);

  useEffect(() => {
    if (testMode != null) {
      return;
    }

    const bodyContainer = bodyContainerRef.current;
    if (bodyContainer == null || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry == null) {
        return;
      }

      const nextWidth = Math.floor(entry.contentRect.width);
      setBodyContainerWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    });

    observer.observe(bodyContainer);
    return () => {
      observer.disconnect();
    };
  }, [loadState, testMode]);

  useEffect(() => {
    if (testMode != null || loadState !== "ready") {
      return;
    }

    const bodyContainer = bodyContainerRef.current;
    if (bodyContainer == null || typeof IntersectionObserver === "undefined") {
      return;
    }

    const pageElements = getDocxPageElements(bodyContainer);
    if (pageElements.length === 0) {
      return;
    }

    const pageVisibilityByElement = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          pageVisibilityByElement.set(entry.target as HTMLElement, entry.intersectionRatio);
        }

        const nextVisiblePage = getVisibleDocxPage({
          container: bodyContainer,
          pageElements,
          pageVisibilityByElement,
        });
        if (nextVisiblePage == null) {
          return;
        }

        if (
          pendingProgrammaticPageRef.current != null &&
          nextVisiblePage !== pendingProgrammaticPageRef.current
        ) {
          return;
        }

        if (nextVisiblePage === pendingProgrammaticPageRef.current) {
          pendingProgrammaticPageRef.current = null;
          clearProgrammaticScrollRef.current?.();
          clearProgrammaticScrollRef.current = null;
        }

        setCurrentPage((previousPage) => (previousPage === nextVisiblePage ? previousPage : nextVisiblePage));
      },
      {
        root: bodyContainer,
        threshold: DOCX_PAGE_VISIBILITY_THRESHOLDS,
      },
    );

    for (const pageElement of pageElements) {
      pageVisibilityByElement.set(pageElement, 0);
      observer.observe(pageElement);
    }

    const initialVisiblePage = getVisibleDocxPage({
      container: bodyContainer,
      pageElements,
      pageVisibilityByElement,
    });
    if (initialVisiblePage != null) {
      setCurrentPage(initialVisiblePage);
    }

    return () => {
      observer.disconnect();
      pendingProgrammaticPageRef.current = null;
      clearProgrammaticScrollRef.current?.();
      clearProgrammaticScrollRef.current = null;
    };
  }, [loadState, totalPages, bodyContainerWidth, zoomMode, testMode]);

  useEffect(() => {
    if (testMode != null) {
      return;
    }

    if (bodyContainerRef.current == null || styleContainerRef.current == null || renderAsync == null) {
      return;
    }

    const bodyContainer = bodyContainerRef.current;
    const styleContainer = styleContainerRef.current;
    const nextGeneration = renderGenerationRef.current + 1;
    renderGenerationRef.current = nextGeneration;

    pendingProgrammaticPageRef.current = null;
    clearProgrammaticScrollRef.current?.();
    clearProgrammaticScrollRef.current = null;
    bodyContainer.replaceChildren();
    styleContainer.replaceChildren();
    setLoadState("loading");
    setTotalPages(0);
    setCurrentPage(1);

    void renderDocxDocument({
      bytes,
      bodyContainer,
      renderAsync,
      styleContainer,
    }).then((didRender) => {
      if (renderGenerationRef.current !== nextGeneration) {
        return;
      }

      if (!didRender) {
        bodyContainer.replaceChildren();
        styleContainer.replaceChildren();
        setLoadState("error");
        return;
      }

      const nextTotalPages = Math.max(bodyContainer.querySelectorAll(DOCX_PAGE_SELECTOR).length, 1);
      setTotalPages(nextTotalPages);
      setLoadState("ready");
    });

    return () => {
      renderGenerationRef.current += 1;
      pendingProgrammaticPageRef.current = null;
      clearProgrammaticScrollRef.current?.();
      clearProgrammaticScrollRef.current = null;
      bodyContainer.replaceChildren();
      styleContainer.replaceChildren();
    };
  }, [bytes, renderAsync, testMode]);

  const effectiveZoomPercent = useMemo(() => {
    if (zoomMode.kind === "fit-width") {
      return (
        getFitWidthZoomPercent({
          bodyContainer: bodyContainerRef.current,
          bodyContainerWidth,
          zoomPercent: 75,
        }) ?? 75
      );
    }

    return clampZoomPercent(zoomMode.zoomPercent);
  }, [bodyContainerWidth, zoomMode]);

  const previewStyle = useMemo<CSSProperties>(
    () => ({
      "--codex-docx-preview-zoom": `${effectiveZoomPercent / 100}`,
    } as CSSProperties),
    [effectiveZoomPercent],
  );

  const effectiveCurrentPage = clampDocxPage(currentPage, totalPages);
  const currentPageLabel = t("artifactTab.preview.pageIndicator", {
    current: effectiveCurrentPage,
    total: Math.max(totalPages, 1),
  });
  const isZoomToFitSelected = zoomMode.kind === "fit-width";

  return (
    <section className="flex h-full min-h-0 flex-col bg-token-side-bar-background">
      {loadState === "ready" ? (
        <header className="@container grid h-toolbar-pane shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 overflow-hidden border-b border-token-border-light bg-token-main-surface-primary pr-2 pl-4 [@container_(max-width:260px)]:grid-cols-[0_auto_auto] [@container_(max-width:260px)]:gap-1 [@container_(max-width:260px)]:pl-2">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <h2 className="truncate text-sm leading-5 font-medium tracking-[-0.18px] text-token-text-primary [@container_(max-width:260px)]:hidden">
              {titleWithoutDocxExtension}
            </h2>
            <span className="shrink-0 text-sm leading-5 text-token-text-tertiary [@container_(max-width:360px)]:hidden">DOC</span>
          </div>
          <div className="min-w-0 justify-self-center">
            <div className="flex items-center gap-0.5">
              <Tooltip tooltipContent={t("artifactTab.preview.previousPage")}>
                <Button
                  aria-label={t("artifactTab.preview.previousPage")}
                  className="[@container_(max-width:240px)]:hidden"
                  color="ghost"
                  disabled={effectiveCurrentPage <= 1}
                  size="toolbar"
                  uniform
                  onClick={() => {
                    scrollToDocxPage({
                      clearProgrammaticScrollRef,
                      container: bodyContainerRef.current,
                      onCurrentPageChange: setCurrentPage,
                      pageNumber: effectiveCurrentPage - 1,
                      pendingProgrammaticPageRef,
                    });
                  }}
                >
                  <ChevronRightIcon className="icon-2xs rotate-180" />
                </Button>
              </Tooltip>
              <span className="min-w-12 px-1 text-center text-sm text-token-text-primary tabular-nums [@container_(max-width:300px)]:min-w-9 [@container_(max-width:300px)]:px-0.5">
                {currentPageLabel}
              </span>
              <Tooltip tooltipContent={t("artifactTab.preview.nextPage")}>
                <Button
                  aria-label={t("artifactTab.preview.nextPage")}
                  className="[@container_(max-width:240px)]:hidden"
                  color="ghost"
                  disabled={effectiveCurrentPage >= totalPages}
                  size="toolbar"
                  uniform
                  onClick={() => {
                    scrollToDocxPage({
                      clearProgrammaticScrollRef,
                      container: bodyContainerRef.current,
                      onCurrentPageChange: setCurrentPage,
                      pageNumber: effectiveCurrentPage + 1,
                      pendingProgrammaticPageRef,
                    });
                  }}
                >
                  <ChevronRightIcon className="icon-2xs" />
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className="flex min-w-0 justify-end overflow-hidden">
            <div ref={zoomMenuRef} className="flex items-center gap-1">
              <div className="relative">
                <Button
                  aria-expanded={isZoomMenuOpen}
                  aria-haspopup="menu"
                  className="shrink-0 gap-1 rounded-md px-1.5 text-sm"
                  color="ghost"
                  data-testid="docx-preview-zoom-trigger"
                  size="toolbar"
                  onClick={() => {
                    setIsZoomMenuOpen((open) => !open);
                  }}
                >
                  <span className="tabular-nums">{t("artifactTab.preview.zoomPercent", { zoomPercent: effectiveZoomPercent })}</span>
                  <ChevronDownIcon className="icon-2xs" />
                </Button>
                {isZoomMenuOpen ? (
                  <div
                    role="menu"
                    className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[168px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                  >
                    <div className="space-y-1">
                      {DOCX_ZOOM_OPTIONS.map((zoomPercent) => {
                        const isSelected = !isZoomToFitSelected && zoomPercent === effectiveZoomPercent;
                        return (
                          <button
                            key={zoomPercent}
                            type="button"
                            onClick={() => {
                              setZoomMode({ kind: "percentage", zoomPercent });
                              setIsZoomMenuOpen(false);
                            }}
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                              isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                            ].join(" ")}
                          >
                            <span>{t("artifactTab.preview.zoomPercent", { zoomPercent })}</span>
                            {isSelected ? <CheckIcon className="icon-2xs" /> : null}
                          </button>
                        );
                      })}
                      <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            getFitWidthZoomPercent({
                              bodyContainer: bodyContainerRef.current,
                              bodyContainerWidth,
                              zoomPercent: effectiveZoomPercent,
                            }) == null
                          ) {
                            return;
                          }

                          setZoomMode({ kind: "fit-width" });
                          setIsZoomMenuOpen(false);
                        }}
                        className={[
                          "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                          isZoomToFitSelected ? "app-nav-item-active" : "app-nav-item-idle",
                        ].join(" ")}
                      >
                        <span>{t("artifactTab.preview.zoomToFit")}</span>
                        {isZoomToFitSelected ? <CheckIcon className="icon-2xs" /> : null}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <Button
                aria-label={t("artifactTab.preview.open")}
                className="shrink-0 rounded-md !border-token-border-default bg-token-main-surface-primary text-sm text-token-text-primary hover:text-token-text-primary"
                color="outline"
                size="toolbar"
                onClick={() => {
                  void openFile({
                    cwd: null,
                    hostId,
                    path,
                    target: "fileManager",
                  });
                }}
              >
                <span>{t("artifactTab.preview.open")}</span>
              </Button>
            </div>
          </div>
        </header>
      ) : null}
      <div ref={styleContainerRef} aria-hidden="true" className="hidden" />
      <div
        ref={bodyContainerRef}
        aria-label={title}
        className={loadState === "ready" ? DOCX_BODY_CLASS_NAME : "hidden"}
        data-testid="docx-preview-panel"
        style={previewStyle}
        onTouchCancel={() => {
          touchZoomStateRef.current = null;
        }}
        onTouchEnd={() => {
          touchZoomStateRef.current = null;
        }}
        onTouchMove={(event) => {
          const currentTouchZoomState = touchZoomStateRef.current;
          if (event.touches.length !== 2 || currentTouchZoomState == null) {
            return;
          }

          event.preventDefault();
          const nextDistance = getTouchDistance(
            event.touches[0].clientX,
            event.touches[0].clientY,
            event.touches[1].clientX,
            event.touches[1].clientY,
          );
          if (nextDistance <= 0 || currentTouchZoomState.distance <= 0) {
            return;
          }

          setZoomMode({
            kind: "percentage",
            zoomPercent: clampZoomPercent(
              Math.round((nextDistance / currentTouchZoomState.distance) * currentTouchZoomState.zoomPercent),
            ),
          });
        }}
        onTouchStart={(event) => {
          if (event.touches.length !== 2) {
            touchZoomStateRef.current = null;
            return;
          }

          event.preventDefault();
          touchZoomStateRef.current = {
            distance: getTouchDistance(
              event.touches[0].clientX,
              event.touches[0].clientY,
              event.touches[1].clientX,
              event.touches[1].clientY,
            ),
            zoomPercent: effectiveZoomPercent,
          };
        }}
        onWheel={(event) => {
          if (!event.ctrlKey) {
            return;
          }

          event.preventDefault();
          const baseZoomPercent = zoomMode.kind === "percentage" ? zoomMode.zoomPercent : effectiveZoomPercent;
          setZoomMode({
            kind: "percentage",
            zoomPercent: clampZoomPercent(Math.round(baseZoomPercent * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR))),
          });
        }}
      />
      {loadState === "ready" ? null : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
          {loadState === "loading" ? (
            <span className="loading-shimmer-pure-text font-medium">{t("artifactTab.previewLoading")}</span>
          ) : (
            t("artifactTab.previewError")
          )}
        </div>
      )}
    </section>
  );
}

async function loadDocxRenderAsync() {
  if (typeof window === "undefined") {
    throw new Error("docx preview can only load in the browser");
  }

  docxRenderAsyncPromise ??= import("docx-preview")
    .then((module) => {
      // docx-preview exports renderAsync as a named export
      return module.renderAsync ?? null;
    })
    .catch(() => null);
  return docxRenderAsyncPromise;
}

async function renderDocxDocument(params: {
  bytes: Uint8Array;
  bodyContainer: HTMLElement;
  renderAsync: DocxRenderAsync;
  styleContainer: HTMLElement;
}) {
  try {
    await params.renderAsync(params.bytes, params.bodyContainer, params.styleContainer, {
      className: DOCX_CLASS_NAME,
      renderAltChunks: false,
      useBase64URL: true,
    });
    injectDocxWrapperStyle(params.styleContainer);
    return true;
  } catch {
    return false;
  }
}

function injectDocxWrapperStyle(styleContainer: HTMLElement) {
  const styleElement = document.createElement("style");
  styleElement.textContent = DOCX_WRAPPER_STYLE;
  styleContainer.appendChild(styleElement);
}

function getVisibleDocxPage(params: {
  container: HTMLElement;
  pageElements: HTMLElement[];
  pageVisibilityByElement: Map<HTMLElement, number>;
}) {
  if (params.pageElements.length === 0) {
    return null;
  }

  let mostVisiblePageIndex = 0;
  let highestIntersectionRatio = -1;

  for (const [pageIndex, pageElement] of params.pageElements.entries()) {
    const intersectionRatio = params.pageVisibilityByElement.get(pageElement) ?? 0;
    if (intersectionRatio > highestIntersectionRatio) {
      highestIntersectionRatio = intersectionRatio;
      mostVisiblePageIndex = pageIndex;
    }
  }

  if (highestIntersectionRatio > 0) {
    return mostVisiblePageIndex + 1;
  }

  const containerTop = params.container.getBoundingClientRect().top;
  let nearestPageIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [pageIndex, pageElement] of params.pageElements.entries()) {
    const distance = Math.abs(pageElement.getBoundingClientRect().top - containerTop);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPageIndex = pageIndex;
    }
  }

  return nearestPageIndex + 1;
}

function getDocxPageElements(container: ParentNode) {
  return Array.from(container.querySelectorAll<HTMLElement>(DOCX_PAGE_SELECTOR));
}

function scrollToDocxPage(params: {
  clearProgrammaticScrollRef: MutableRefObject<(() => void) | null>;
  container: HTMLElement | null;
  onCurrentPageChange: (pageNumber: number) => void;
  pageNumber: number;
  pendingProgrammaticPageRef: MutableRefObject<number | null>;
}) {
  if (params.container == null || params.pageNumber < 1) {
    return;
  }

  const targetElement = getDocxPageElements(params.container).at(params.pageNumber - 1);
  if (targetElement == null) {
    return;
  }

  params.clearProgrammaticScrollRef.current?.();
  params.clearProgrammaticScrollRef.current = null;
  params.pendingProgrammaticPageRef.current = params.pageNumber;

  let settleTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearScrollTracking = () => {
    if (settleTimeoutId != null) {
      clearTimeout(settleTimeoutId);
      settleTimeoutId = null;
    }

    params.container?.removeEventListener("scroll", handleScroll);
  };

  const settleCurrentPage = () => {
    if (params.pendingProgrammaticPageRef.current !== params.pageNumber || params.container == null) {
      return;
    }

    params.pendingProgrammaticPageRef.current = null;
    clearScrollTracking();

    const nextVisiblePage = getVisibleDocxPage({
      container: params.container,
      pageElements: getDocxPageElements(params.container),
      pageVisibilityByElement: new Map(),
    });
    if (nextVisiblePage != null) {
      params.onCurrentPageChange(nextVisiblePage);
    }
  };

  const handleScroll = () => {
    if (settleTimeoutId != null) {
      clearTimeout(settleTimeoutId);
    }

    settleTimeoutId = setTimeout(settleCurrentPage, PROGRAMMATIC_SCROLL_SETTLE_DELAY_MS);
  };

  params.clearProgrammaticScrollRef.current = clearScrollTracking;
  targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
  params.onCurrentPageChange(params.pageNumber);
  handleScroll();
  params.container.addEventListener("scroll", handleScroll);
}

function clampDocxPage(pageNumber: number, totalPages: number) {
  return Math.min(Math.max(pageNumber, 1), Math.max(totalPages, 1));
}

function clampZoomPercent(zoomPercent: number) {
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent));
}

function getFitWidthZoomPercent(params: {
  bodyContainer: HTMLElement | null;
  bodyContainerWidth: number | null;
  zoomPercent: number;
}) {
  const firstPageElement = params.bodyContainer?.querySelector<HTMLElement>(DOCX_PAGE_SELECTOR);
  if (firstPageElement == null) {
    return null;
  }

  const pageParentElement = firstPageElement.parentElement ?? params.bodyContainer;
  if (pageParentElement == null) {
    return null;
  }
  const computedParentStyle = window.getComputedStyle(pageParentElement);
  const parentHorizontalPadding =
    Number.parseFloat(computedParentStyle.paddingLeft) + Number.parseFloat(computedParentStyle.paddingRight);
  const availableWidth = Math.max(
    1,
    ((params.bodyContainerWidth ?? pageParentElement.clientWidth) || params.bodyContainer?.clientWidth || 1) -
      (Number.isFinite(parentHorizontalPadding) ? parentHorizontalPadding : 0),
  );
  const rawPageWidth = Number.parseFloat(window.getComputedStyle(firstPageElement).width);
  const normalizedPageWidth =
    rawPageWidth > 0
      ? rawPageWidth
      : firstPageElement.getBoundingClientRect().width / Math.max(params.zoomPercent / 100, Number.EPSILON);
  if (!Number.isFinite(normalizedPageWidth) || normalizedPageWidth <= 0) {
    return null;
  }

  return clampZoomPercent(Math.round((availableWidth / normalizedPageWidth) * 100));
}

function getTouchDistance(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x1 - x2, y1 - y2);
}
