import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ChevronRightIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import type { MessageKey } from "../../i18n/messages";
import type { ArtifactPreviewProto } from "./workbookPreviewLoader";

type ArtifactPreviewHeaderFitOption = {
  label: string;
  onSelect: () => void;
  selected: boolean;
};

type RenderArtifactPreviewHeaderZoomControl = (params: {
  fitOption?: ArtifactPreviewHeaderFitOption | null;
  onZoomPercentChange: (zoomPercent: number) => void;
  triggerTestId: string;
  zoomPercent: number;
}) => ReactNode;

type PopcornElectronPresentationPanelModule = {
  PopcornElectronPresentationPanel: ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    hideSpeakerNotes?: boolean;
    initialPresentationProto: ArtifactPreviewProto;
    renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
    title?: string;
    zoomToFitLabel?: string;
  }>;
};

export type PresentationPreviewPanelTestMode = {
  kind: "ready";
  currentPage?: number;
  notesText?: string;
  totalSlides?: number;
  zoomPercent?: number;
};

export function PresentationPreviewPanel({
  headerRightContent,
  hideSpeakerNotes = false,
  presentationProto,
  renderHeaderZoomControl,
  testMode,
  title,
  t,
}: {
  headerRightContent?: ReactNode;
  hideSpeakerNotes?: boolean;
  presentationProto: ArtifactPreviewProto;
  renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
  testMode?: PresentationPreviewPanelTestMode;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [panelComponent, setPanelComponent] = useState<ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    hideSpeakerNotes?: boolean;
    initialPresentationProto: ArtifactPreviewProto;
    renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
    title?: string;
    zoomToFitLabel?: string;
  }> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  if (testMode?.kind === "ready") {
    return (
      <PresentationPreviewPanelReadyState
        headerRightContent={headerRightContent}
        hideSpeakerNotes={hideSpeakerNotes}
        renderHeaderZoomControl={renderHeaderZoomControl}
        testMode={testMode}
        title={title}
        zoomToFitLabel={t("artifactTab.preview.zoomToFit")}
        t={t}
      />
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    // @ts-ignore -- extracted upstream presentation panel bundle ships without declarations.
    void import("../../assets/workbook/PopcornElectronPresentationPanel-CAnfvJ36.js")
      .then((presentationPanelModule) => {
        if (cancelled) {
          return;
        }
        setPanelComponent(
          () =>
            (presentationPanelModule as PopcornElectronPresentationPanelModule).PopcornElectronPresentationPanel,
        );
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setPanelComponent(null);
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (typeof window === "undefined") {
    return (
      <section
        className="no-drag relative h-full min-h-0 bg-token-bg-primary"
        data-testid="popcorn-electron-presentation-panel"
      />
    );
  }

  if (loadState === "loading") {
    return <PresentationPreviewPanelLoadingState t={t} />;
  }

  if (loadState === "error" || panelComponent == null) {
    return <PresentationPreviewPanelErrorState t={t} />;
  }

  const PanelComponent = panelComponent;
  const className = hideSpeakerNotes
    ? "h-full min-h-0 [&_.popcorn-presentation-main-panel]:h-[calc(100%_-_var(--right-panel-composer-overlay-reserve,0px))] [&_.popcorn-presentation-main-panel]:self-start"
    : "h-full min-h-0";

  return (
    <PanelComponent
      className={className}
      headerRightContent={headerRightContent}
      hideSpeakerNotes={hideSpeakerNotes}
      initialPresentationProto={presentationProto}
      renderHeaderZoomControl={renderHeaderZoomControl}
      title={title}
      zoomToFitLabel={t("artifactTab.preview.zoomToFit")}
    />
  );
}

function PresentationPreviewPanelReadyState({
  headerRightContent,
  hideSpeakerNotes,
  renderHeaderZoomControl,
  testMode,
  title,
  zoomToFitLabel,
  t,
}: {
  headerRightContent?: ReactNode;
  hideSpeakerNotes: boolean;
  renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
  testMode: PresentationPreviewPanelTestMode;
  title: string;
  zoomToFitLabel: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const totalSlides = Math.max(testMode.totalSlides ?? 4, 1);
  const currentPage = clampPresentationPage(testMode.currentPage ?? 2, totalSlides);
  const zoomPercent = clampPresentationZoom(testMode.zoomPercent ?? 75);
  const notesText = testMode.notesText ?? "Capture speaker notes for the live walkthrough.";
  const rootClassName = hideSpeakerNotes
    ? "h-full min-h-0 [&_.popcorn-presentation-main-panel]:h-[calc(100%_-_var(--right-panel-composer-overlay-reserve,0px))] [&_.popcorn-presentation-main-panel]:self-start"
    : "h-full min-h-0";
  const zoomControl =
    renderHeaderZoomControl?.({
      fitOption: {
        label: zoomToFitLabel,
        onSelect: () => undefined,
        selected: false,
      },
      onZoomPercentChange: () => undefined,
      triggerTestId: "popcorn-presentation-zoom-select",
      zoomPercent,
    }) ?? (
      <div
        className="rounded-md border border-token-border-default px-2 py-1 text-sm text-token-text-primary"
        data-testid="popcorn-presentation-zoom-select"
      >
        {t("artifactTab.preview.zoomPercent", { zoomPercent })}
      </div>
    );

  return (
    <section
      className={`no-drag relative h-full min-h-0 bg-token-bg-primary ${rootClassName}`}
      data-codex-popcorn-editor={true}
      data-testid="popcorn-electron-presentation-panel"
    >
      <div className="bg-token-bg-primary text-token-text-primary flex h-full min-h-0 flex-col overflow-hidden">
        <header
          className="grid h-toolbar-pane shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 overflow-hidden border-b border-token-border-light bg-token-main-surface-primary pr-2 pl-4"
          data-testid="popcorn-presentation-header"
        >
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="truncate text-sm font-medium text-token-text-primary">{title}</span>
          </div>
          <div className="min-w-0 justify-self-center" data-testid="popcorn-presentation-page-navigation">
            <div className="flex items-center gap-0.5">
              <Button
                aria-label={t("artifactTab.preview.previousPage")}
                color="ghost"
                disabled={currentPage <= 1}
                size="toolbar"
                uniform
              >
                <ChevronRightIcon className="icon-2xs rotate-180" />
              </Button>
              <span className="min-w-12 px-1 text-center text-sm text-token-text-primary tabular-nums">
                {t("artifactTab.preview.pageIndicator", {
                  current: currentPage,
                  total: totalSlides,
                })}
              </span>
              <Button
                aria-label={t("artifactTab.preview.nextPage")}
                color="ghost"
                disabled={currentPage >= totalSlides}
                size="toolbar"
                uniform
              >
                <ChevronRightIcon className="icon-2xs" />
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 justify-end overflow-hidden">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
              {zoomControl}
              {headerRightContent}
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1 @container/presentation-editor">
          <div className="popcorn-presentation-editor-shell relative flex h-full min-h-0 overflow-hidden">
            <div className="popcorn-presentation-main-panel relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-token-bg-primary">
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full items-center justify-center bg-token-side-bar-background px-6 py-6">
                  <div
                    className="flex h-full w-full max-w-[720px] items-center justify-center rounded-[20px] border border-token-border-default bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,244,0.92))] shadow-sm"
                    data-testid="popcorn-presentation-stage"
                  >
                    <div
                      className="relative aspect-video w-full max-w-[640px] overflow-hidden rounded-[14px] border border-token-border-default bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                      data-testid="popcorn-presentation-canvas"
                    >
                      <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),transparent)]" />
                      <div className="flex h-full flex-col justify-between px-10 py-8">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-token-text-tertiary">
                            Presentation Preview
                          </div>
                          <div className="mt-3 text-[28px] font-semibold text-token-text-primary">
                            Slide {currentPage}
                          </div>
                        </div>
                        <div className="max-w-[420px] text-sm leading-6 text-token-text-secondary">
                          Deterministic ready-state markup mirrors the upstream owner shell for snapshot coverage.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {hideSpeakerNotes ? null : (
                <div
                  className="popcorn-presentation-notes-panel popcorn-presentation-desktop-only pointer-events-none absolute right-0 bottom-0 z-20 px-6 pt-4 pb-6"
                  data-testid="popcorn-presentation-notes-panel"
                >
                  <div className="w-[320px] text-sm">
                    <textarea
                      className="text-token-text-primary pointer-events-auto h-[132px] w-full resize-none rounded-[18px] border border-token-border-default bg-token-main-surface-primary p-4 text-sm outline-none placeholder:text-token-text-secondary"
                      data-testid="popcorn-presentation-notes"
                      placeholder="No speaker notes"
                      readOnly
                      value={notesText}
                    />
                  </div>
                </div>
              )}
            </div>
            <div
              className="popcorn-presentation-codex-thumbnail-rail"
              data-open="true"
              data-testid="popcorn-presentation-codex-thumbnail-rail"
            >
              <button
                aria-expanded="true"
                aria-label="Show slide list"
                className="popcorn-presentation-thumbnail-stack"
                data-testid="popcorn-presentation-thumbnail-stack"
                type="button"
              >
                {Array.from({ length: totalSlides }, (_, index) => (
                  <span
                    key={`stack-${index}`}
                    className="popcorn-presentation-thumbnail-stack-bar"
                    data-testid="popcorn-presentation-thumbnail-stack-bar"
                    style={{
                      backgroundColor:
                        index + 1 === currentPage
                          ? "var(--color-token-text-primary, rgba(13, 13, 13, 1))"
                          : "var(--color-token-border-default, rgba(232, 232, 232, 1))",
                    }}
                  />
                ))}
              </button>
              <div
                className="popcorn-presentation-codex-thumbnail-panel"
                data-testid="popcorn-presentation-thumbnails"
              >
                <div className="popcorn-presentation-codex-thumbnail-panel-floating px-3 py-3">
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: totalSlides }, (_, index) => (
                      <button
                        key={`floating-${index}`}
                        className="flex items-start gap-2.5 rounded-md p-0.5 text-left"
                        data-active={index + 1 === currentPage ? "true" : "false"}
                        data-testid={`popcorn-presentation-floating-slide-${index}`}
                        type="button"
                      >
                        <div className="text-xs text-token-text-secondary">{index + 1}</div>
                        <div className="relative aspect-video w-[96px] overflow-hidden rounded-[10px] border border-token-border-default bg-white" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="popcorn-presentation-codex-thumbnail-panel-full flex h-full min-h-0 flex-col gap-2 overflow-y-auto px-3 py-3">
                  {Array.from({ length: totalSlides }, (_, index) => {
                    const isSelected = index + 1 === currentPage;
                    return (
                      <button
                        key={`slide-${index}`}
                        aria-label={`Slide ${index + 1}`}
                        className="flex items-start gap-2.5 rounded-md p-0.5 text-left"
                        data-active={isSelected ? "true" : "false"}
                        data-testid={`popcorn-presentation-slide-${index}`}
                        type="button"
                      >
                        <div
                          className={`min-w-5 pt-1 text-xs ${isSelected ? "text-token-text-primary" : "text-token-text-secondary"}`}
                        >
                          {index + 1}
                        </div>
                        <div
                          className={`relative aspect-video w-[136px] overflow-hidden rounded-[10px] border bg-white ${
                            isSelected ? "border-token-text-primary shadow-sm" : "border-token-border-default"
                          }`}
                          data-testid={`popcorn-presentation-slide-${index}-surface`}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.03),transparent)]" />
                          <div className="flex h-full items-center justify-center text-[11px] font-medium text-token-text-secondary">
                            Slide {index + 1}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PresentationPreviewPanelLoadingState({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
      <span className="loading-shimmer-pure-text font-medium">{t("artifactTab.previewLoading")}</span>
    </div>
  );
}

function PresentationPreviewPanelErrorState({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">{t("artifactTab.previewError")}</div>;
}

function clampPresentationPage(pageNumber: number, totalSlides: number) {
  return Math.min(Math.max(pageNumber, 1), Math.max(totalSlides, 1));
}

function clampPresentationZoom(zoomPercent: number) {
  return Math.min(200, Math.max(50, zoomPercent));
}
