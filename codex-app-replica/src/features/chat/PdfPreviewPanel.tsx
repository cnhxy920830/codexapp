import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { MessageKey } from "../../i18n/messages";
import { openFile, openInBrowser, readFileBinary } from "../../services/hostFiles";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";
import { ChevronDownIcon, CloseTabIcon, FolderIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";

type PdfViewport = {
  height: number;
  width: number;
};

type PdfRenderTask = {
  cancel: () => void;
};

type PdfPageProxy = {
  getAnnotations: () => Promise<unknown[]>;
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
};

type PdfDocumentProxy = {
  destroy: () => Promise<void>;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  numPages: number;
};

type PdfDocumentLoadingTask = {
  destroy: () => Promise<void>;
  promise: Promise<PdfDocumentProxy>;
};

type PdfModule = {
  AnnotationLayer: new (args: {
    accessibilityManager: undefined;
    annotationCanvasMap: undefined;
    annotationEditorUIManager: undefined;
    annotationStorage: undefined;
    commentManager: undefined;
    div: HTMLDivElement;
    linkService: PdfLinkService;
    page: PdfPageProxy;
    structTreeLayer: undefined;
    viewport: PdfViewport;
  }) => {
    render: (args: {
      annotations: unknown[];
      div: HTMLDivElement;
      linkService: PdfLinkService;
      page: PdfPageProxy;
      renderForms: boolean;
      viewport: PdfViewport;
    }) => Promise<void>;
  };
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (params: { data: Uint8Array }) => PdfDocumentLoadingTask;
};

type PdfLinkService = {
  addLinkAttributes: (element: HTMLAnchorElement, url: string) => void;
  externalLinkEnabled: boolean;
  getAnchorUrl: (hash: string) => string;
  getDestinationHash: (hash: string) => string;
};

type PdfPreviewPanelProps = {
  file: WorkspaceFileDocument;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  testMode?: PdfPreviewPanelTestMode;
};

type PdfPreviewPanelTestMode =
  | {
      kind: "ready";
      currentPage?: number;
      invertColors?: boolean;
      numPages?: number;
      pageHeight?: number;
      pageWidth?: number;
    }
  | {
      kind: "presentation";
      currentPage?: number;
      invertColors?: boolean;
      numPages?: number;
      pageHeight?: number;
      pageWidth?: number;
      title?: string;
    };

type LoadState = "loading" | "ready" | "error";
type ZoomMode =
  | {
      kind: "fit";
    }
  | {
      kind: "percent";
      value: number;
    };

const PDF_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200];
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const PAGE_GAP_PX = 24;

let pdfModulePromise: Promise<PdfModule> | null = null;
const pdfModuleUrl = new URL("../../assets/pdf/pdf-C4JubaMy.js", import.meta.url).href;
const pdfWorkerUrl = new URL("../../assets/pdf/pdf.worker.min-qwK7q_zL.mjs", import.meta.url).href;

export function PdfPreviewPanel({ file, t, testMode }: PdfPreviewPanelProps) {
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomMode, setZoomMode] = useState<ZoomMode>({ kind: "fit" });
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(testMode?.kind === "presentation");
  const [presentationPage, setPresentationPage] = useState(testMode?.kind === "presentation" ? testMode.currentPage ?? 1 : 1);
  const [invertColors, setInvertColors] = useState(testMode?.invertColors ?? false);
  const [requestFullscreenOnOpen, setRequestFullscreenOnOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [firstPageSize, setFirstPageSize] = useState<{ width: number; height: number } | null>(null);
  const presentationRootRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsPresentationOpen(testMode?.kind === "presentation");
  }, [testMode]);

  useEffect(() => {
    if (testMode?.kind === "presentation") {
      setPresentationPage(testMode.currentPage ?? 1);
      return;
    }

    if (!isPresentationOpen) {
      setPresentationPage(currentPage);
    }
  }, [currentPage, isPresentationOpen, testMode]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (zoomMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsZoomMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (testMode != null) {
      return;
    }

    let cancelled = false;

    setFileDataUrl(null);
    setLoadState("loading");
    setPdfDocument(null);
    setNumPages(0);
    setCurrentPage(1);
    setFirstPageSize(null);
    setZoomMode({ kind: "fit" });

    void readFileBinary({ path: file.path })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setFileDataUrl(`data:application/pdf;base64,${response.contentsBase64}`);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.path, testMode]);

  useEffect(() => {
    if (testMode != null) {
      return;
    }

    if (fileDataUrl == null) {
      return;
    }

    let cancelled = false;
    let task: PdfDocumentLoadingTask | null = null;
    let documentProxy: PdfDocumentProxy | null = null;

    setLoadState("loading");

    void loadPdfModule()
      .then(async (pdfjs) => {
        const pdfBytes = parsePdfDataUrl(fileDataUrl);
        if (pdfBytes == null) {
          throw new Error("invalid pdf data url");
        }

        task = pdfjs.getDocument({ data: pdfBytes });
        const loadedDocument = await task.promise;
        const firstPage = await loadedDocument.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });

        if (cancelled) {
          await loadedDocument.destroy();
          return;
        }

        documentProxy = loadedDocument;
        setPdfDocument(loadedDocument);
        setNumPages(Math.max(loadedDocument.numPages, 1));
        setCurrentPage(1);
        setFirstPageSize({ width: viewport.width, height: viewport.height });
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setPdfDocument(null);
          setNumPages(0);
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
      void task?.destroy();
      if (documentProxy != null) {
        void documentProxy.destroy();
      }
    };
  }, [fileDataUrl, testMode]);

  useEffect(() => {
    if (testMode?.invertColors != null) {
      setInvertColors(testMode.invertColors);
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("../../services/settings")
      .then(async ({ getGlobalState, onGlobalStateUpdated }) => {
        const applyCurrentValue = async () => {
          const response = await getGlobalState("pdf-preview-invert-colors");
          if (!disposed) {
            setInvertColors(response.value === true);
          }
        };

        await applyCurrentValue();

        const dispose = await onGlobalStateUpdated((notification) => {
          if (!notification.keys.includes("pdf-preview-invert-colors")) {
            return;
          }

          void applyCurrentValue().catch(() => undefined);
        });

        if (disposed) {
          void dispose();
          return;
        }

        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [testMode]);
  useEffect(() => {
    const container = contentContainerRef.current;
    if (container == null || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry == null) {
        return;
      }
      setContainerWidth(Math.max(0, Math.floor(entry.contentRect.width)));
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current == null || numPages <= 0) {
      return;
    }

    const root = scrollContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = currentPage;
        let bestRatio = -1;

        for (const entry of entries) {
          const pageElement = entry.target as HTMLElement;
          const pageNumber = Number(pageElement.dataset.pageNumber);
          if (!Number.isFinite(pageNumber)) {
            continue;
          }

          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestPage = pageNumber;
          }
        }

        if (bestRatio > 0) {
          setCurrentPage((previousPage) => (previousPage === bestPage ? previousPage : bestPage));
        }
      },
      {
        root,
        rootMargin: "100px 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    const pageElements = root.querySelectorAll<HTMLElement>("[data-pdf-page]");
    pageElements.forEach((pageElement) => observer.observe(pageElement));

    return () => {
      observer.disconnect();
    };
  }, [currentPage, numPages, zoomMode, containerWidth, firstPageSize]);

  useEffect(() => {
    if (!isPresentationOpen || presentationRootRef.current == null) {
      return;
    }

    presentationRootRef.current.focus();
  }, [isPresentationOpen]);

  useEffect(() => {
    if (
      testMode != null ||
      !isPresentationOpen ||
      !requestFullscreenOnOpen ||
      presentationRootRef.current == null ||
      typeof presentationRootRef.current.requestFullscreen !== "function" ||
      typeof document === "undefined" ||
      document.fullscreenElement === presentationRootRef.current
    ) {
      return;
    }

    void presentationRootRef.current.requestFullscreen()
      .catch(() => undefined)
      .finally(() => {
        setRequestFullscreenOnOpen(false);
      });
  }, [isPresentationOpen, requestFullscreenOnOpen, testMode]);

  useEffect(() => {
    if (!isPresentationOpen || presentationRootRef.current == null || typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      if (document.fullscreenElement !== presentationRootRef.current) {
        setIsPresentationOpen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isPresentationOpen]);

  const zoomPercent = useMemo(() => {
    if (testMode?.kind === "presentation") {
      return 100;
    }

    if (firstPageSize == null) {
      return 100;
    }

    if (zoomMode.kind === "percent") {
      return clampZoom(zoomMode.value);
    }

    const availableWidth = Math.max(1, containerWidth - 48);
    return clampZoom(Math.round((availableWidth / firstPageSize.width) * 100));
  }, [containerWidth, firstPageSize, zoomMode]);

  const pageWidth = useMemo(() => {
    if (firstPageSize == null) {
      return 0;
    }

    const scale = zoomPercent / 100;
    return Math.max(1, Math.round(firstPageSize.width * scale));
  }, [firstPageSize, zoomPercent]);

  const pageHeight = useMemo(() => {
    if (firstPageSize == null) {
      return 0;
    }

    const scale = zoomPercent / 100;
    return Math.max(1, Math.round(firstPageSize.height * scale));
  }, [firstPageSize, zoomPercent]);

  const title = useMemo(() => {
    if (testMode?.kind === "presentation" && testMode.title != null) {
      return testMode.title;
    }
    return file.name.replace(/\.pdf$/i, "");
  }, [file.name, testMode]);

  const effectiveNumPages = testMode?.kind === "presentation"
    ? Math.max(testMode.numPages ?? 3, 1)
    : testMode?.kind === "ready"
      ? Math.max(testMode.numPages ?? 3, 1)
    : numPages;
  const effectiveCurrentPage = testMode?.kind === "presentation" || testMode?.kind === "ready"
    ? clampPage(testMode.currentPage ?? 1, effectiveNumPages)
    : currentPage;
  const effectivePageWidth = testMode?.kind === "presentation" || testMode?.kind === "ready"
    ? Math.max(testMode.pageWidth ?? 612, 1)
    : pageWidth;
  const effectivePageHeight = testMode?.kind === "presentation" || testMode?.kind === "ready"
    ? Math.max(testMode.pageHeight ?? 792, 1)
    : pageHeight;
  const effectivePresentationPage = clampPage(
    testMode?.kind === "presentation" ? testMode.currentPage ?? 1 : presentationPage,
    Math.max(numPages, 1),
  );

  if (testMode?.kind === "presentation") {
    return (
      <PdfPresentationOverlay
        currentPage={effectiveCurrentPage}
        invertColors={invertColors}
        numPages={effectiveNumPages}
        onClose={() => undefined}
        onJumpToFirstPage={() => undefined}
        onJumpToLastPage={() => undefined}
        onNextPage={() => undefined}
        onOpenExternalLink={(url) => {
          void openInBrowser(url);
        }}
        onPreviousPage={() => undefined}
        pageHeight={effectivePageHeight}
        pageWidth={effectivePageWidth}
        pdfDocument={null}
        rootRef={presentationRootRef}
        t={t}
        title={title}
      />
    );
  }

  if (testMode?.kind === "ready") {
    return (
      <section className="flex h-full min-h-0 flex-col bg-token-side-bar-background">
        <header className="grid h-toolbar-pane shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 overflow-hidden border-b border-token-border-light bg-token-main-surface-primary pr-2 pl-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <h2 className="truncate text-sm leading-5 font-medium tracking-[-0.18px] text-token-text-primary">{title}</h2>
            <span className="shrink-0 text-sm leading-5 text-token-text-tertiary">PDF</span>
          </div>
          <div className="min-w-0 justify-self-center">
            <div className="flex items-center gap-0.5">
              <Button
                aria-label={t("artifactTab.preview.previousPage")}
                color="ghost"
                disabled={effectiveCurrentPage <= 1}
                size="toolbar"
                uniform
              >
                <ChevronDownIcon className="icon-2xs rotate-90" />
              </Button>
              <span className="min-w-12 px-1 text-center text-sm text-token-text-primary tabular-nums">
                {t("artifactTab.preview.pageIndicator", { current: effectiveCurrentPage, total: effectiveNumPages })}
              </span>
              <Button
                aria-label={t("artifactTab.preview.nextPage")}
                color="ghost"
                disabled={effectiveCurrentPage >= effectiveNumPages}
                size="toolbar"
                uniform
              >
                <ChevronDownIcon className="icon-2xs -rotate-90" />
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 justify-end overflow-hidden">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
              <Button color="ghost" size="toolbar" className="shrink-0 gap-1 rounded-md px-1.5 text-sm">
                <span className="tabular-nums">{t("artifactTab.preview.zoomPercent", { zoomPercent: 100 })}</span>
                <ChevronDownIcon className="icon-2xs" />
              </Button>
              <Button
                aria-label={t("artifactTab.preview.open")}
                color="outline"
                size="toolbar"
                className="shrink-0 rounded-md !border-token-border-default bg-token-main-surface-primary px-2 text-sm text-token-text-primary hover:text-token-text-primary"
              >
                <FolderIcon className="icon-2xs" />
                <span>{t("artifactTab.preview.open")}</span>
              </Button>
            </div>
          </div>
        </header>
        <div aria-label={file.name} className="min-h-0 flex-1 overflow-auto bg-token-side-bar-background">
          <div className="min-h-full pt-6" style={{ paddingBottom: PAGE_GAP_PX }}>
            <div className="flex min-h-full w-max min-w-full flex-col items-center gap-6 px-6">
              {Array.from({ length: effectiveNumPages }, (_, index) => (
                <PdfPlaceholderPage
                  key={index + 1}
                  invertColors={invertColors}
                  pageHeight={effectivePageHeight}
                  pageNumber={index + 1}
                  pageWidth={effectivePageWidth}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-token-side-bar-background">
      {isPresentationOpen && loadState === "ready" && pdfDocument != null ? (
        <PdfPresentationOverlay
          currentPage={effectivePresentationPage}
          invertColors={invertColors}
          numPages={numPages}
          onClose={closePresentation}
          onJumpToFirstPage={() => setPresentationPage(1)}
          onJumpToLastPage={() => setPresentationPage(numPages)}
          onNextPage={() => setPresentationPage((page) => clampPage(page + 1, numPages))}
          onOpenExternalLink={(url) => {
            closePresentation();
            void openInBrowser(url);
          }}
          onPreviousPage={() => setPresentationPage((page) => clampPage(page - 1, numPages))}
          pageHeight={pageHeight}
          pageWidth={pageWidth}
          pdfDocument={pdfDocument}
          rootRef={presentationRootRef}
          t={t}
          title={title}
        />
      ) : loadState === "ready" && pdfDocument != null ? (
        <>
          <header className="grid h-toolbar-pane shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 overflow-hidden border-b border-token-border-light bg-token-main-surface-primary pr-2 pl-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
              <h2 className="truncate text-sm leading-5 font-medium tracking-[-0.18px] text-token-text-primary">{title}</h2>
              <span className="shrink-0 text-sm leading-5 text-token-text-tertiary">PDF</span>
            </div>
            <div className="min-w-0 justify-self-center">
              <div className="flex items-center gap-0.5">
                <Button
                  aria-label={t("artifactTab.preview.previousPage")}
                  color="ghost"
                  disabled={currentPage <= 1}
                  size="toolbar"
                  uniform
                  onClick={() => scrollToPage(currentPage - 1)}
                >
                  <ChevronDownIcon className="icon-2xs rotate-90" />
                </Button>
                <span className="min-w-12 px-1 text-center text-sm text-token-text-primary tabular-nums">
                  {t("artifactTab.preview.pageIndicator", { current: currentPage, total: numPages })}
                </span>
                <Button
                  aria-label={t("artifactTab.preview.nextPage")}
                  color="ghost"
                  disabled={currentPage >= numPages}
                  size="toolbar"
                  uniform
                  onClick={() => scrollToPage(currentPage + 1)}
                >
                  <ChevronDownIcon className="icon-2xs -rotate-90" />
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 justify-end overflow-hidden">
              <div className="flex min-w-0 items-center gap-1 overflow-hidden" ref={zoomMenuRef}>
                <div className="relative">
                  <Button
                    color="ghost"
                    data-state={isZoomMenuOpen ? "open" : "closed"}
                    size="toolbar"
                    className="shrink-0 gap-1 rounded-md px-1.5 text-sm"
                    onClick={() => setIsZoomMenuOpen((open) => !open)}
                  >
                    <span className="tabular-nums">{t("artifactTab.preview.zoomPercent", { zoomPercent })}</span>
                    <ChevronDownIcon className="icon-2xs" />
                  </Button>
                  {isZoomMenuOpen ? (
                    <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[168px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      <div className="space-y-1">
                        {PDF_ZOOM_OPTIONS.map((option) => {
                          const isSelected = zoomMode.kind === "percent" && clampZoom(zoomMode.value) === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setZoomMode({ kind: "percent", value: option });
                                setIsZoomMenuOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                                isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              <span>{t("artifactTab.preview.zoomPercent", { zoomPercent: option })}</span>
                            </button>
                          );
                        })}
                        <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                        <button
                          type="button"
                          onClick={() => {
                            setZoomMode({ kind: "fit" });
                            setIsZoomMenuOpen(false);
                          }}
                          className={[
                            "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                            zoomMode.kind === "fit" ? "app-nav-item-active" : "app-nav-item-idle",
                          ].join(" ")}
                        >
                          <span>{t("artifactTab.preview.zoomToFit")}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  aria-label={t("artifactTab.preview.open")}
                  color="outline"
                  size="toolbar"
                  className="shrink-0 rounded-md !border-token-border-default bg-token-main-surface-primary px-2 text-sm text-token-text-primary hover:text-token-text-primary"
                  onClick={() => {
                    void openFile({
                      path: file.path,
                      target: "fileManager",
                    });
                  }}
                >
                  <FolderIcon className="icon-2xs" />
                  <span>{t("artifactTab.preview.open")}</span>
                </Button>
              </div>
            </div>
          </header>
          <div ref={scrollContainerRef} aria-label={file.name} className="min-h-0 flex-1 overflow-auto bg-token-side-bar-background">
            <div ref={contentContainerRef} className="min-h-full pt-6" style={{ paddingBottom: PAGE_GAP_PX }}>
              <div className="flex min-h-full w-max min-w-full flex-col items-center gap-6 px-6">
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <PdfPageCanvas
                      key={pageNumber}
                      invertColors={invertColors}
                      pageHeight={pageHeight}
                      pageNumber={pageNumber}
                      pageWidth={pageWidth}
                      pdfDocument={pdfDocument}
                      scale={zoomPercent / 100}
                      onOpenExternalLink={(url) => {
                        void openInBrowser(url);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <PdfStateView loadState={loadState} t={t} />
      )}
    </section>
  );

  function scrollToPage(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > numPages) {
      return;
    }

    const target = scrollContainerRef.current?.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
    target?.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    setCurrentPage(pageNumber);
  }

  async function openPresentation() {
    setPresentationPage(currentPage);
    setIsPresentationOpen(true);
    setRequestFullscreenOnOpen(true);
  }

  function closePresentation() {
    setIsPresentationOpen(false);
    if (typeof document !== "undefined" && document.fullscreenElement === presentationRootRef.current) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }
}

function PdfPageCanvas({
  invertColors = false,
  onOpenExternalLink,
  pageHeight,
  pageNumber,
  pageWidth,
  pdfDocument,
  scale,
}: {
  invertColors?: boolean;
  onOpenExternalLink: (url: string) => void;
  pageHeight: number;
  pageNumber: number;
  pageWidth: number;
  pdfDocument: PdfDocumentProxy;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationLayerRef = useRef<HTMLDivElement | null>(null);
  const [pageProxy, setPageProxy] = useState<PdfPageProxy | null>(null);
  const [baseViewport, setBaseViewport] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) {
          return;
        }

        const viewport = page.getViewport({ scale: 1 });
        setPageProxy(page);
        setBaseViewport({ width: viewport.width, height: viewport.height });
      })
      .catch(() => {
        if (!cancelled) {
          setPageProxy(null);
          setBaseViewport(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, pdfDocument]);

  useEffect(() => {
    if (pageProxy == null || baseViewport == null || canvasRef.current == null) {
      return;
    }

    const canvas = canvasRef.current;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const viewport = pageProxy.getViewport({ scale });
    const renderViewport = pageProxy.getViewport({ scale: scale * devicePixelRatio });
    const context = canvas.getContext("2d");

    if (context == null) {
      return;
    }

    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    canvas.style.width = `${Math.round(viewport.width)}px`;
    canvas.style.height = `${Math.round(viewport.height)}px`;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const renderTask = pageProxy.render({
      canvas: canvas as never,
      canvasContext: context,
      viewport: renderViewport,
    });

    return () => {
      renderTask.cancel();
    };
  }, [baseViewport, pageProxy, scale]);

  useEffect(() => {
    if (pageProxy == null || annotationLayerRef.current == null) {
      return;
    }

    let cancelled = false;
    annotationLayerRef.current.innerHTML = "";

    void loadPdfModule()
      .then(async (pdfjs) => {
        const annotations = await pageProxy.getAnnotations();
        if (cancelled || annotations.length === 0 || annotationLayerRef.current == null) {
          return;
        }

        const viewport = pageProxy.getViewport({ scale });
        const linkService: PdfLinkService = {
          addLinkAttributes(element: HTMLAnchorElement, url: string) {
            element.href = url;
            element.title = url;
            element.target = "_blank";
            element.rel = "noopener noreferrer nofollow";
            element.onclick = (event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenExternalLink(url);
            };
          },
          externalLinkEnabled: true,
          getAnchorUrl(hash: string) {
            return hash;
          },
          getDestinationHash(hash: string) {
            return hash;
          },
        };

        const annotationLayer = new pdfjs.AnnotationLayer({
          accessibilityManager: undefined,
          annotationCanvasMap: undefined,
          annotationEditorUIManager: undefined,
          annotationStorage: undefined,
          commentManager: undefined,
          div: annotationLayerRef.current,
          linkService,
          page: pageProxy,
          structTreeLayer: undefined,
          viewport,
        });

        await annotationLayer.render({
          annotations,
          div: annotationLayerRef.current,
          linkService,
          page: pageProxy,
          renderForms: false,
          viewport,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (annotationLayerRef.current != null) {
        annotationLayerRef.current.innerHTML = "";
      }
    };
  }, [onOpenExternalLink, pageProxy, scale]);

  const viewportWidth = baseViewport?.width ?? 0;
  const viewportHeight = baseViewport?.height ?? 0;
  const cssScale = viewportWidth > 0 ? pageWidth / viewportWidth : 1;

  return (
    <div
      className={[
        "pdfPreviewPage relative shrink-0 overflow-hidden border border-token-border-default bg-white shadow-sm",
        invertColors ? "invert" : "",
      ].join(" ").trim()}
      data-page-number={pageNumber}
      data-pdf-page
      style={
        {
          "--scale-factor": cssScale,
          "--user-unit": 1,
          height: Math.max(pageHeight, 1),
          width: Math.max(pageWidth, 1),
        } as CSSProperties
      }
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div ref={annotationLayerRef} className="annotationLayer" />
    </div>
  );
}

function PdfPresentationOverlay({
  currentPage,
  invertColors,
  numPages,
  onClose,
  onJumpToFirstPage,
  onJumpToLastPage,
  onNextPage,
  onOpenExternalLink,
  onPreviousPage,
  pageHeight,
  pageWidth,
  pdfDocument,
  rootRef,
  t,
  title,
}: {
  currentPage: number;
  invertColors: boolean;
  numPages: number;
  onClose: () => void;
  onJumpToFirstPage: () => void;
  onJumpToLastPage: () => void;
  onNextPage: () => void;
  onOpenExternalLink: (url: string) => void;
  onPreviousPage: () => void;
  pageHeight: number;
  pageWidth: number;
  pdfDocument: PdfDocumentProxy | null;
  rootRef: RefObject<HTMLDivElement | null>;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  title: string;
}) {
  const clampedCurrentPage = clampPage(currentPage, numPages);
  const previousDisabled = clampedCurrentPage <= 1;
  const nextDisabled = clampedCurrentPage >= numPages;

  return (
    <div
      ref={rootRef}
      aria-label={title}
      autoFocus
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black text-white outline-none"
      data-testid="artifact-pdf-presentation"
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          (event.target instanceof Element &&
            event.target.closest("a,button,input,select,textarea,[role='button']") != null)
        ) {
          return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left + bounds.width / 2) {
          onPreviousPage();
          return;
        }

        onNextPage();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          onPreviousPage();
          return;
        }
        if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
          event.preventDefault();
          onNextPage();
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          onJumpToFirstPage();
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          onJumpToLastPage();
        }
      }}
      tabIndex={-1}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
        {pdfDocument == null ? (
          <PdfPlaceholderPage
            invertColors={invertColors}
            pageHeight={pageHeight}
            pageNumber={clampedCurrentPage}
            pageWidth={pageWidth}
          />
        ) : (
          <PdfPageCanvas
            invertColors={invertColors}
            onOpenExternalLink={onOpenExternalLink}
            pageHeight={pageHeight}
            pageNumber={clampedCurrentPage}
            pageWidth={pageWidth}
            pdfDocument={pdfDocument}
            scale={1}
          />
        )}
      </div>
      <div className="pointer-events-none absolute right-6 bottom-6 left-6 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-white shadow-lg">
          <Button
            aria-label={t("artifactTab.preview.previousPage")}
            color="ghost"
            disabled={previousDisabled}
            size="toolbar"
            uniform
            className="text-white hover:text-white"
            onClick={onPreviousPage}
          >
            <ChevronDownIcon className="icon-2xs rotate-90" />
          </Button>
          <span className="min-w-14 px-2 text-center text-sm tabular-nums">
            {t("artifactTab.preview.pageIndicator", { current: clampedCurrentPage, total: numPages })}
          </span>
          <Button
            aria-label={t("artifactTab.preview.nextPage")}
            color="ghost"
            disabled={nextDisabled}
            size="toolbar"
            uniform
            className="text-white hover:text-white"
            onClick={onNextPage}
          >
            <ChevronDownIcon className="icon-2xs -rotate-90" />
          </Button>
          <div className="mx-1 h-4 w-px bg-white/25" />
          <Button
            color="ghost"
            size="toolbar"
            className="gap-1 px-2 text-white hover:text-white"
            onClick={onClose}
          >
            <CloseTabIcon className="icon-2xs" />
            <span>{t("artifactTab.preview.exitPresentation")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function PdfPlaceholderPage({
  invertColors = false,
  pageHeight,
  pageNumber,
  pageWidth,
}: {
  invertColors?: boolean;
  pageHeight: number;
  pageNumber: number;
  pageWidth: number;
}) {
  return (
    <div
      className={[
        "pdfPreviewPage relative shrink-0 overflow-hidden border border-token-border-default bg-white shadow-sm",
        invertColors ? "invert" : "",
      ].join(" ").trim()}
      data-artifact-pdf-page
      data-page-number={pageNumber}
      data-pdf-page
      style={
        {
          "--scale-factor": 1,
          "--user-unit": 1,
          height: Math.max(pageHeight, 1),
          width: Math.max(pageWidth, 1),
        } as CSSProperties
      }
    >
      <div className="absolute inset-0 bg-white" />
    </div>
  );
}

function PdfStateView({
  loadState,
  t,
}: {
  loadState: LoadState;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (loadState === "loading") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
        <div className="flex items-center gap-2 font-medium">
          <Spinner className="icon-sm" />
          <span>{t("artifactTab.previewLoading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
      {t("artifactTab.previewError")}
    </div>
  );
}

async function loadPdfModule() {
  if (typeof window === "undefined") {
    throw new Error("pdf.js can only load in the browser");
  }

  pdfModulePromise ??= (import(/* @vite-ignore */ pdfModuleUrl) as Promise<PdfModule>);
  const pdfjs = await pdfModulePromise;
  if (pdfjs.GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return pdfjs;
}

function parsePdfDataUrl(dataUrl: string) {
  const markerIndex = dataUrl.indexOf("base64,");
  if (!dataUrl.startsWith("data:") || markerIndex < 0) {
    return null;
  }

  let binaryString: string;
  try {
    binaryString = window.atob(dataUrl.slice(markerIndex + 7));
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clampPage(pageNumber: number, totalPages: number) {
  return Math.min(Math.max(pageNumber, 1), Math.max(totalPages, 1));
}
