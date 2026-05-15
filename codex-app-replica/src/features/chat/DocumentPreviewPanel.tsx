import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { DocumentPreviewProto } from "./workbookPreviewLoader";

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

type PopcornElectronDocumentPanelModule = {
  PopcornElectronDocumentPanel: ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    initialDocumentProto: DocumentPreviewProto;
    renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
    title?: string;
  }>;
};

export function DocumentPreviewPanel({
  documentProto,
  headerRightContent,
  renderHeaderZoomControl,
  title,
  t,
}: {
  documentProto: DocumentPreviewProto;
  headerRightContent?: ReactNode;
  renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [panelComponent, setPanelComponent] = useState<ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    initialDocumentProto: DocumentPreviewProto;
    renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
    title?: string;
  }> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    // @ts-ignore -- extracted upstream document panel bundle ships without declarations.
    void import("../../assets/workbook/PopcornElectronDocumentPanel-hZoWaM07.js")
      .then((documentPanelModule) => {
        if (cancelled) {
          return;
        }
        setPanelComponent(() => (documentPanelModule as PopcornElectronDocumentPanelModule).PopcornElectronDocumentPanel);
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
    return <section className="no-drag relative h-full min-h-0 bg-token-bg-primary" data-testid="popcorn-electron-document-panel" />;
  }

  if (loadState === "loading") {
    return <DocumentPreviewPanelLoadingState t={t} />;
  }

  if (loadState === "error" || panelComponent == null) {
    return <DocumentPreviewPanelErrorState t={t} />;
  }

  const PanelComponent = panelComponent;
  return (
    <PanelComponent
      className="h-full min-h-0"
      headerRightContent={headerRightContent}
      initialDocumentProto={documentProto}
      renderHeaderZoomControl={renderHeaderZoomControl}
      title={title}
    />
  );
}

function DocumentPreviewPanelLoadingState({
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

function DocumentPreviewPanelErrorState({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">{t("artifactTab.previewError")}</div>;
}
