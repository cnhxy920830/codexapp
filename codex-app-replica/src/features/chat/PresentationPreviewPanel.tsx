import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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

export function PresentationPreviewPanel({
  headerRightContent,
  hideSpeakerNotes = false,
  presentationProto,
  renderHeaderZoomControl,
  title,
  t,
}: {
  headerRightContent?: ReactNode;
  hideSpeakerNotes?: boolean;
  presentationProto: ArtifactPreviewProto;
  renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
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
