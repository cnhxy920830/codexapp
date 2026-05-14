import { useEffect, useState, type ComponentType } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { WorkbookPreviewProto } from "./workbookPreviewLoader";

type PopcornElectronWorkbookPanelModule = {
  PopcornElectronWorkbookPanel: ComponentType<{
    className?: string;
    initialWorkbookProto: WorkbookPreviewProto;
    title?: string;
  }>;
};

export function WorkbookPreviewPanel({
  title,
  t,
  workbookProto,
}: {
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workbookProto: WorkbookPreviewProto;
}) {
  const [panelComponent, setPanelComponent] = useState<ComponentType<{
    className?: string;
    initialWorkbookProto: WorkbookPreviewProto;
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

  if (loadState === "error" || panelComponent == null) {
    return <WorkbookPreviewPanelErrorState t={t} />;
  }

  if (loadState === "loading") {
    return <WorkbookPreviewPanelLoadingState t={t} />;
  }

  const PanelComponent = panelComponent;
  return <PanelComponent className="h-full min-h-0" initialWorkbookProto={workbookProto} title={title} />;
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
