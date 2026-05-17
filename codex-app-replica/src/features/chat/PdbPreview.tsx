import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import {
  buildPdbSelectionQuery,
  formatPdbChainId,
  formatPdbResidueId,
  formatPdbResidueRange,
  getSelectedResidues,
  parsePdbPreviewData,
  type PdbResidueChain,
  type PdbSelection,
  type PdbSelectionQuery,
} from "./pdbPreviewParser";

type PdbPreviewProps = {
  contents: string;
  filePath?: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type ViewerStatus = "idle" | "loading" | "error";

type PdbViewer = {
  addModel: (contents: string, format: string) => void;
  addStyle: (selection: PdbSelectionQuery | Record<string, unknown>, style: Record<string, unknown>) => void;
  clear: () => void;
  removeAllModels: () => void;
  render: () => void;
  resize: () => void;
  setBackgroundColor: (color: string) => void;
  setStyle: (selection: PdbSelectionQuery | Record<string, unknown>, style: Record<string, unknown>) => void;
  zoomTo: (selection?: PdbSelectionQuery | Record<string, unknown>, duration?: number, fixed?: boolean) => void;
};

type Pdb3DmolCreateViewer = (element: HTMLDivElement, options: { backgroundColor: string; disableFog: boolean }) => PdbViewer;

type ChoiceMenuOption = {
  label: string;
  value: string;
};

const CARTOON_STYLE = { cartoon: { colorscheme: { gradient: "roygb", max: 100, min: 50, prop: "b" } } };
const CARTOON_SELECTION_STYLE = {
  cartoon: { colorscheme: { gradient: "roygb", max: 100, min: 50, prop: "b" }, opacity: 0.34 },
};
const STICK_STYLE = { stick: { radius: 0.12 } };
const HIDDEN_STICK_STYLE = { stick: { hidden: true } };
const SELECTED_STYLE = { cartoon: { color: "#f97316" }, stick: { color: "#f97316", radius: 0.12 } };

let createViewerPromise: Promise<Pdb3DmolCreateViewer> | null = null;

export function PdbPreview({ contents, filePath, t }: PdbPreviewProps) {
  const data = useMemo(() => parsePdbPreviewData(contents), [contents]);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PdbViewer | null>(null);
  const highlightRangeRef = useRef<PdbSelection | null>(null);
  const selectionStartIndexRef = useRef<number | null>(null);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [activeChainId, setActiveChainId] = useState<string | null>(null);
  const [highlightRange, setHighlightRange] = useState<PdbSelection | null>(null);
  const [zoomRange, setZoomRange] = useState<PdbSelection | null>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("idle");
  const [viewerResetToken, setViewerResetToken] = useState(0);

  useEffect(() => {
    setActiveModelIndex(0);
    setActiveChainId(null);
    highlightRangeRef.current = null;
    selectionStartIndexRef.current = null;
    setHighlightRange(null);
    setZoomRange(null);
    setViewerResetToken((value) => value + 1);
  }, [contents]);

  useEffect(() => {
    if (activeModelIndex >= data.models.length) {
      setActiveModelIndex(0);
    }
  }, [activeModelIndex, data.models.length]);

  const activeModel = data.models[activeModelIndex] ?? null;
  const activeChain =
    activeModel?.residueChains.find((chain) => chain.chainId === activeChainId) ?? activeModel?.residueChains[0] ?? null;
  const highlightedResidues = getSelectedResidues(activeChain, highlightRange?.modelIndex === activeModelIndex ? highlightRange : null);
  const zoomedResidues = getSelectedResidues(activeChain, zoomRange?.modelIndex === activeModelIndex ? zoomRange : null);
  const highlightQuery = buildPdbSelectionQuery(highlightedResidues);
  const zoomQuery = buildPdbSelectionQuery(zoomedResidues);
  const applyHighlightRange = (selection: PdbSelection | null) => {
    highlightRangeRef.current = selection;
    setHighlightRange(selection);
  };

  useEffect(() => {
    const viewerContainer = viewerContainerRef.current;
    const viewer = viewerRef.current;
    if (viewerContainer == null || viewer == null || viewerStatus !== "idle") {
      return;
    }

    const observer = new ResizeObserver(() => {
      viewer.resize();
      viewer.render();
    });
    observer.observe(viewerContainer);
    return () => {
      observer.disconnect();
    };
  }, [activeModelIndex, viewerResetToken, viewerStatus]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer == null || viewerStatus !== "idle") {
      return;
    }

    applyViewerSelection(viewer, highlightQuery);
    viewer.render();
  }, [highlightQuery, viewerStatus]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer == null || viewerStatus !== "idle" || zoomQuery == null) {
      return;
    }

    viewer.zoomTo(zoomQuery, 350, true);
    viewer.render();
  }, [viewerStatus, zoomQuery]);

  useEffect(() => {
    if (activeModel == null) {
      cleanupViewer(viewerRef.current, viewerContainerRef.current);
      viewerRef.current = null;
      return;
    }

    let cancelled = false;
    const viewerContainer = viewerContainerRef.current;
    if (viewerContainer == null) {
      return;
    }

    setViewerStatus("loading");
    cleanupViewer(viewerRef.current, viewerContainer);
    viewerRef.current = null;

    void loadCreateViewer()
      .then((createViewer) => {
        if (cancelled) {
          return;
        }

        const viewer = createViewer(viewerContainer, { backgroundColor: "white", disableFog: true });
        viewerRef.current = viewer;
        viewer.addModel(activeModel.contents, "pdb");
        applyViewerSelection(viewer, null);
        viewer.zoomTo();
        viewer.setBackgroundColor("white");
        viewer.resize();
        viewer.render();
        setViewerStatus("idle");
      })
      .catch(() => {
        if (!cancelled) {
          cleanupViewer(viewerRef.current, viewerContainer);
          viewerRef.current = null;
          setViewerStatus("error");
        }
      });

    return () => {
      cancelled = true;
      cleanupViewer(viewerRef.current, viewerContainer);
      viewerRef.current = null;
    };
  }, [activeModel?.contents, viewerResetToken]);

  if (data.models.length === 0 || activeModel == null) {
    return (
      <PdbPreviewShell filePath={filePath}>
        <div className="flex h-full min-h-0 items-center justify-center">
          <div className="text-[13px] leading-6 text-token-text-secondary">
            {t("codex.filePreview.pdb.empty")}
          </div>
        </div>
      </PdbPreviewShell>
    );
  }

  const residueCountLabel = t("codex.filePreview.pdb.residueCount", { count: activeModel.stats.residueCount });
  const atomCountLabel = t("codex.filePreview.pdb.atomCount", { count: activeModel.stats.atomCount });
  const meanScoreLabel = t("codex.filePreview.pdb.scoreSummary", { mean: formatScore(activeModel.stats.meanScore) });

  return (
    <PdbPreviewShell filePath={filePath}>
      <div className="flex flex-wrap items-center gap-2 border-b border-token-border px-3 py-2">
        {data.models.length > 1 ? (
          <ChoiceMenu
            ariaLabel={t("codex.filePreview.pdb.modelSelectLabel")}
            buttonClassName="!h-6 shrink-0 gap-1 rounded-md px-1.5 text-sm text-token-text-tertiary hover:text-token-text-primary"
            options={data.models.map((model, index) => ({
              label: t("codex.filePreview.pdb.modelOption", { modelNumber: model.modelNumber }),
              value: String(index),
            }))}
            value={String(activeModelIndex)}
            onChange={(value) => {
              const nextIndex = Number.parseInt(value, 10);
              if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= data.models.length) {
                return;
              }
              setActiveModelIndex(nextIndex);
              setActiveChainId(data.models[nextIndex]?.residueChains[0]?.chainId ?? null);
              selectionStartIndexRef.current = null;
              applyHighlightRange(null);
              setZoomRange(null);
            }}
            selectedLabel={t("codex.filePreview.pdb.modelOption", { modelNumber: activeModel.modelNumber })}
            widthClassName="w-[150px]"
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            selectionStartIndexRef.current = null;
            applyHighlightRange(null);
            setZoomRange(null);
            setViewerResetToken((value) => value + 1);
          }}
          className="!h-6 shrink-0 rounded-md !border border-token-border-default bg-token-main-surface-primary px-2 text-sm text-token-text-primary hover:text-token-text-primary"
        >
          {t("codex.filePreview.pdb.resetView")}
        </button>
        <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-token-text-secondary">
          <span>{residueCountLabel}</span>
          <span>{atomCountLabel}</span>
          <span>{meanScoreLabel}</span>
        </div>
      </div>

      {activeChain == null ? null : (
        <ChainSequenceSection
          chains={activeModel.residueChains}
          activeChain={activeChain}
          activeModelIndex={activeModelIndex}
          activeChainId={activeChain.chainId}
          highlightRange={highlightRange}
          onChainChange={(chainId) => {
            setActiveChainId(chainId);
            selectionStartIndexRef.current = null;
            applyHighlightRange(null);
            setZoomRange(null);
          }}
          onResidueSelectionCommit={() => {
            selectionStartIndexRef.current = null;
            const selection = highlightRangeRef.current;
            if (selection?.modelIndex === activeModelIndex) {
              setZoomRange(selection);
            }
          }}
          onResidueSelectionMove={(index) => {
            const startIndex = selectionStartIndexRef.current;
            if (startIndex == null) {
              return;
            }
            applyHighlightRange({
              chainId: activeChain.chainId,
              endIndex: Math.max(startIndex, index),
              modelIndex: activeModelIndex,
              startIndex: Math.min(startIndex, index),
            });
          }}
          onResidueSelectionSelect={(index) => {
            const selection = {
              chainId: activeChain.chainId,
              endIndex: index,
              modelIndex: activeModelIndex,
              startIndex: index,
            };
            selectionStartIndexRef.current = null;
            applyHighlightRange(selection);
            setZoomRange(selection);
          }}
          onResidueSelectionStart={(index) => {
            selectionStartIndexRef.current = index;
            const selection = {
              chainId: activeChain.chainId,
              endIndex: index,
              modelIndex: activeModelIndex,
              startIndex: index,
            };
            applyHighlightRange(selection);
            setZoomRange(null);
          }}
          t={t}
        />
      )}

      <div className="relative min-h-0 flex-1 bg-white">
        <div
          ref={viewerContainerRef}
          aria-label={t("codex.filePreview.pdb.viewerLabel")}
          className="h-full w-full overflow-hidden"
        />
        {viewerStatus === "loading" ? (
          <PdbPreviewLoadingOverlay />
        ) : null}
        {viewerStatus === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-token-main-surface-primary">
            <div className="text-[13px] leading-6 text-token-text-secondary">
              {t("codex.filePreview.pdb.viewerLoadError")}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-token-border px-3 py-2 text-xs text-token-text-secondary">
        <LegendItem className="bg-[#0053d6]">{t("codex.filePreview.pdb.legendVeryHigh")}</LegendItem>
        <LegendItem className="bg-[#65cbf3]">{t("codex.filePreview.pdb.legendConfident")}</LegendItem>
        <LegendItem className="bg-[#ffdb13]">{t("codex.filePreview.pdb.legendLow")}</LegendItem>
        <LegendItem className="bg-[#ff7d45]">{t("codex.filePreview.pdb.legendVeryLow")}</LegendItem>
        <span className="ml-auto">{t("codex.filePreview.pdb.interactionHint")}</span>
      </div>
    </PdbPreviewShell>
  );
}

function PdbPreviewShell({ children, filePath }: { children: ReactNode; filePath?: string }) {
  const fileName = resolvePdbFileName(filePath);

  return (
    <div className="flex h-full min-h-0 flex-col bg-token-main-surface-primary">
      {fileName == null ? null : (
        <div className="border-b border-token-border px-3 py-2 text-sm font-medium text-token-text-primary">{fileName}</div>
      )}
      {children}
    </div>
  );
}

function resolvePdbFileName(filePath?: string): string | null {
  if (filePath == null || filePath.length === 0) {
    return null;
  }

  return filePath.split(/[/\\]+/).at(-1) ?? filePath;
}

function ChainSequenceSection({
  chains,
  activeChain,
  activeChainId,
  activeModelIndex,
  highlightRange,
  onChainChange,
  onResidueSelectionCommit,
  onResidueSelectionMove,
  onResidueSelectionSelect,
  onResidueSelectionStart,
  t,
}: {
  chains: PdbResidueChain[];
  activeChain: PdbResidueChain;
  activeChainId: string;
  activeModelIndex: number;
  highlightRange: PdbSelection | null;
  onChainChange: (chainId: string) => void;
  onResidueSelectionCommit: () => void;
  onResidueSelectionMove: (index: number) => void;
  onResidueSelectionSelect: (index: number) => void;
  onResidueSelectionStart: (index: number) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const selectedResidues = getSelectedResidues(
    activeChain,
    highlightRange?.modelIndex === activeModelIndex ? highlightRange : null,
  );
  const selectedRangeLabel = selectedResidues.length > 0 ? formatPdbResidueRange(selectedResidues) : null;

  return (
    <div className="border-b border-token-border bg-token-main-surface-primary">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs text-token-text-secondary">
        {chains.length > 1 ? (
          <ChainSelector chains={chains} activeChainId={activeChainId} onChainChange={onChainChange} t={t} />
        ) : (
          <span className="font-medium text-token-text-primary">
            {t("codex.filePreview.pdb.chainLabel", { chainId: formatPdbChainId(activeChainId) })}
          </span>
        )}
        <span className="tabular-nums">
          {t("codex.filePreview.pdb.sequenceResidueCount", { count: activeChain.residues.length })}
        </span>
        {selectedRangeLabel != null ? (
          <span className="ml-auto font-medium text-token-text-primary">
            {t("codex.filePreview.pdb.selectedResidues", { range: selectedRangeLabel })}
          </span>
        ) : null}
      </div>
      <ResidueSequenceStrip
        activeChain={activeChain}
        activeModelIndex={activeModelIndex}
        highlightRange={highlightRange}
        onResidueSelectionCommit={onResidueSelectionCommit}
        onResidueSelectionMove={onResidueSelectionMove}
        onResidueSelectionSelect={onResidueSelectionSelect}
        onResidueSelectionStart={onResidueSelectionStart}
        t={t}
      />
    </div>
  );
}

function ChainSelector({
  chains,
  activeChainId,
  onChainChange,
  t,
}: {
  chains: PdbResidueChain[];
  activeChainId: string;
  onChainChange: (chainId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const options = useMemo(
    () =>
      chains.map((chain) => ({
        label: t("codex.filePreview.pdb.chainOption", { chainId: formatPdbChainId(chain.chainId), count: chain.residues.length }),
        value: chain.chainId,
      })),
    [chains, t],
  );

  if (options.length <= 1) {
    return (
      <span className="font-medium text-token-text-primary">
        {t("codex.filePreview.pdb.chainLabel", { chainId: formatPdbChainId(activeChainId) })}
      </span>
    );
  }

  return (
    <ChoiceMenu
      ariaLabel={t("codex.filePreview.pdb.chainSelectLabel")}
      buttonClassName="!h-6 shrink-0 gap-1 rounded-md px-1.5 text-xs text-token-text-tertiary hover:text-token-text-primary"
      onChange={onChainChange}
      options={options}
      selectedLabel={t("codex.filePreview.pdb.chainLabel", { chainId: formatPdbChainId(activeChainId) })}
      value={activeChainId}
      widthClassName="w-[180px]"
    />
  );
}

function ResidueSequenceStrip({
  activeChain,
  activeModelIndex,
  highlightRange,
  onResidueSelectionCommit,
  onResidueSelectionMove,
  onResidueSelectionSelect,
  onResidueSelectionStart,
  t,
}: {
  activeChain: PdbResidueChain;
  activeModelIndex: number;
  highlightRange: PdbSelection | null;
  onResidueSelectionCommit: () => void;
  onResidueSelectionMove: (index: number) => void;
  onResidueSelectionSelect: (index: number) => void;
  onResidueSelectionStart: (index: number) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const range = highlightRange?.modelIndex === activeModelIndex ? highlightRange : null;

  const getResidueIndex = (target: EventTarget | null) => {
    const container = containerRef.current;
    const element = target instanceof Element ? target.closest("[data-pdb-residue-index]") : null;
    if (container == null || !(element instanceof HTMLElement) || !container.contains(element)) {
      return null;
    }

    const index = Number(element.dataset.pdbResidueIndex);
    return Number.isInteger(index) ? index : null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const index = getResidueIndex(event.target);
    if (index == null) {
      return;
    }

    event.preventDefault();
    dragPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onResidueSelectionStart(index);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    const index = getResidueIndex(document.elementFromPoint(event.clientX, event.clientY));
    if (index != null) {
      onResidueSelectionMove(index);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    dragPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResidueSelectionCommit();
  };

  const residueButtons = activeChain.residues.map((residue, index) => {
    const isSelected = range != null && index >= range.startIndex && index <= range.endIndex;
    const isSelectionStart = isSelected && index === range?.startIndex;
    const isSelectionEnd = isSelected && index === range?.endIndex;

    return (
      <button
        key={`${residue.chainId}:${residue.residueNumber}:${residue.insertionCode}:${residue.residueName}:${index}`}
        type="button"
        data-pdb-residue-index={index}
        aria-label={t("codex.filePreview.pdb.residueLabel", {
          chainId: formatPdbChainId(residue.chainId),
          residueName: residue.residueName,
          residueNumber: formatPdbResidueId(residue),
        })}
        aria-pressed={isSelected}
        className={[
          "cursor-interaction inline-flex h-5 min-w-[1.35ch] select-none items-center justify-center rounded-none px-0 text-token-text-secondary",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-token-text-primary",
          !isSelected ? "hover:rounded-sm hover:bg-token-main-surface-secondary hover:text-token-text-primary" : "",
          isSelected ? "bg-orange-100 text-orange-800" : "",
          isSelectionStart ? "rounded-l-sm" : "",
          isSelectionEnd ? "rounded-r-sm" : "",
          isSelectionStart && isSelectionEnd ? "rounded-sm ring-1 ring-orange-300" : "",
        ].join(" ")}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          onResidueSelectionSelect(index);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title={t("codex.filePreview.pdb.residueTitle", {
          residueName: residue.residueName,
          residueNumber: formatPdbResidueId(residue),
        })}
      >
        {residue.sequenceCode}
      </button>
    );
  });

  return (
    <div
      ref={containerRef}
      aria-label={t("codex.filePreview.pdb.sequenceLabel")}
      className="max-h-24 overflow-auto border-t border-token-border px-3 py-2 font-mono text-[11px] leading-5"
    >
      {residueButtons}
    </div>
  );
}

function ChoiceMenu({
  ariaLabel,
  buttonClassName,
  disabled,
  onChange,
  options,
  selectedLabel,
  value,
  widthClassName,
}: {
  ariaLabel: string;
  buttonClassName: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: ChoiceMenuOption[];
  selectedLabel: string;
  value: string;
  widthClassName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${widthClassName} max-w-full`}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={`app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] ${buttonClassName}`}
      >
        <span className="truncate text-left">{selectedLabel || value}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setIsOpen(false);
                    onChange(option.value);
                  }}
                  className={[
                    "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">{option.label}</span>
                  </span>
                  {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LegendItem({ children, className }: { children: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {children}
    </span>
  );
}

function applyViewerSelection(viewer: PdbViewer, selection: PdbSelectionQuery | null) {
  if (selection == null) {
    viewer.setStyle({}, CARTOON_STYLE);
    viewer.addStyle({ hetflag: false }, STICK_STYLE);
    return;
  }

  const inverseSelection = { not: selection };
  viewer.setStyle(inverseSelection, CARTOON_SELECTION_STYLE);
  viewer.addStyle({ and: [inverseSelection, { hetflag: false }] }, HIDDEN_STICK_STYLE);
  viewer.setStyle(selection, SELECTED_STYLE);
}

function cleanupViewer(viewer: PdbViewer | null, container: HTMLDivElement | null) {
  if (viewer != null) {
    viewer.removeAllModels();
    viewer.clear();
  }

  if (container != null) {
    container.replaceChildren();
  }
}

async function loadCreateViewer() {
  if (createViewerPromise == null) {
    createViewerPromise = import("../../assets/3Dmol-B1akbDh1.js").then((module) => getCreateViewer(module));
  }

  return createViewerPromise;
}

function getCreateViewer(module: unknown) {
  const candidate = module as { createViewer?: unknown; default?: { createViewer?: unknown } };
  const createViewer =
    typeof candidate.createViewer === "function"
      ? candidate.createViewer
      : typeof candidate.default?.createViewer === "function"
        ? candidate.default.createViewer
        : null;

  if (createViewer == null) {
    throw new Error("3Dmol createViewer export was not found");
  }

  return createViewer as Pdb3DmolCreateViewer;
}

function formatScore(score: number | null) {
  return score == null ? "n/a" : score.toFixed(1);
}

export function PdbPreviewLoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-token-text-secondary border-t-transparent" />
    </div>
  );
}
