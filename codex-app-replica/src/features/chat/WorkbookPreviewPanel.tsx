import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { WorkbookPreviewProto } from "./workbookPreviewLoader";

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

type PopcornElectronWorkbookPanelModule = {
  PopcornElectronWorkbookPanel: ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    initialWorkbookProto: WorkbookPreviewProto;
    renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
    title?: string;
  }>;
};

export function WorkbookPreviewPanel({
  headerRightContent,
  renderHeaderZoomControl,
  title,
  t,
  workbookProto,
}: {
  headerRightContent?: ReactNode;
  renderHeaderZoomControl?: RenderArtifactPreviewHeaderZoomControl;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workbookProto: WorkbookPreviewProto;
}) {
  const [panelComponent, setPanelComponent] = useState<ComponentType<{
    className?: string;
    headerRightContent?: ReactNode;
    initialWorkbookProto: WorkbookPreviewProto;
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

    // @ts-ignore -- extracted upstream workbook panel bundle ships without declarations.
    void import("../../assets/workbook/PopcornElectronWorkbookPanel-SIBzzAMk.js")
      .then((workbookPanelModule) => {
        if (cancelled) {
          return;
        }
        setPanelComponent(() => (workbookPanelModule as PopcornElectronWorkbookPanelModule).PopcornElectronWorkbookPanel);
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
    return <section className="no-drag relative h-full min-h-0 bg-token-bg-primary" data-testid="popcorn-electron-workbook-panel" />;
  }

  if (loadState === "loading") {
    return <WorkbookPreviewPanelLoadingState t={t} />;
  }

  if (loadState === "error" || panelComponent == null) {
    return <WorkbookPreviewPanelErrorState t={t} />;
  }

  const PanelComponent = panelComponent;
  return (
    <PanelComponent
      className="h-full min-h-0"
      headerRightContent={headerRightContent}
      initialWorkbookProto={workbookProto}
      renderHeaderZoomControl={renderHeaderZoomControl}
      title={title}
    />
  );
}

function WorkbookPreviewPanelLoadingState({
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

function WorkbookPreviewPanelErrorState({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">{t("artifactTab.previewError")}</div>;
}
