import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { MessageKey } from "../../i18n/messages";
import {
  CopyPathIcon,
  ForwardNavigationIcon,
  MoreActionsIcon,
  OpenFilesIcon,
  OpenInEditorIcon,
  RichPreviewDisabledIcon,
  RichPreviewEnabledIcon,
  WrapDisabledIcon,
  WrapEnabledIcon,
} from "../../components/AppShellIcons";
import { renderMessageContent } from "./messageContent";
import {
  openWorkspaceFileInEditor,
  readWorkspaceFile,
  readWorkspaceFileMetadata,
  type WorkspaceFilePreviewTarget,
} from "../../services/workspaceFiles";
import { useFilePreviewDisplayPreferences } from "./filePreviewDisplayPreferences";
import { useFilePreviewOpenFilesState } from "./filePreviewOpenFilesState";
import { WorkspaceFileTreePanel } from "./WorkspaceFileTreePanel";
import {
  WORKSPACE_FILE_PREVIEW_LIMIT_BYTES,
  formatWorkspaceFileSize,
  getBreadcrumbSegments,
  getPdfPreviewSrc,
  getSvgPreviewDataUri,
  getWorkspaceFileRichPreviewControlMode,
  getWorkspaceFileRichPreviewKind,
  getWorkspaceFileUnsupportedMessageKey,
  getWorkspaceFileUnsupportedPreviewKind,
  normalizePreviewText,
  type WorkspaceFilePreviewDescriptor,
  type WorkspaceFilePreviewState,
} from "./workspaceFilePreviewUtils";

type WorkspaceFilePreviewPanelProps = {
  selectedFileTarget: WorkspaceFilePreviewTarget;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

const OPEN_FILES_PANEL_MIN_WIDTH = 200;
const OPEN_FILES_PANEL_DEFAULT_WIDTH = 400;
const OPEN_FILES_PANEL_MAX_WIDTH_RATIO = 0.6;

export function WorkspaceFilePreviewPanel({
  selectedFileTarget,
  onSelectWorkspaceFile,
  t,
}: WorkspaceFilePreviewPanelProps) {
  const breadcrumbPath = selectedFileTarget.relativePath || selectedFileTarget.path;
  const [previewState, setPreviewState] = useState<WorkspaceFilePreviewState>({ kind: "loading" });
  const {
    isRichPreviewEnabled,
    isWordWrapEnabled,
    toggleRichPreview,
    toggleWordWrap,
  } = useFilePreviewDisplayPreferences();
  const { close, isOpen, setWidth, toggle, width } = useFilePreviewOpenFilesState();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    setPreviewState({ kind: "loading" });

    let cancelled = false;
    void readWorkspaceFileMetadata({
      workspaceRoot: selectedFileTarget.workspaceRoot,
      relativePath: selectedFileTarget.relativePath,
    })
      .then((metadata) => {
        if (cancelled) {
          return;
        }
        if (!metadata.isFile) {
          setPreviewState({ kind: "error" });
          return;
        }

        const previewSource = {
          ...selectedFileTarget,
          mimeType: metadata.mimeType,
        };
        const unsupportedKind = getWorkspaceFileUnsupportedPreviewKind(previewSource);
        if (unsupportedKind !== null) {
          setPreviewState({ kind: "unsupported", unsupportedKind });
          return;
        }
        if (metadata.sizeBytes !== null && metadata.sizeBytes > WORKSPACE_FILE_PREVIEW_LIMIT_BYTES) {
          setPreviewState({ kind: "tooLarge", sizeBytes: metadata.sizeBytes });
          return;
        }

        void readWorkspaceFile({
          workspaceRoot: selectedFileTarget.workspaceRoot,
          relativePath: selectedFileTarget.relativePath,
        })
          .then((file) => {
            if (!cancelled) {
              setPreviewState({ kind: "ready", file });
            }
          })
          .catch(() => {
            if (!cancelled) {
              setPreviewState({ kind: "error" });
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewState({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileTarget.relativePath, selectedFileTarget.workspaceRoot]);

  useEffect(() => {
    if (width === OPEN_FILES_PANEL_DEFAULT_WIDTH) {
      return;
    }

    const parentWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(OPEN_FILES_PANEL_MIN_WIDTH, parentWidth * OPEN_FILES_PANEL_MAX_WIDTH_RATIO);
    if (width > maxWidth) {
      setWidth(maxWidth);
    }
  }, [setWidth, width]);

  const previewDescriptor: WorkspaceFilePreviewDescriptor =
    previewState.kind === "ready"
      ? {
          name: previewState.file.name,
          path: previewState.file.path,
          relativePath: previewState.file.relativePath,
          mimeType: previewState.file.mimeType,
        }
      : {
          name: selectedFileTarget.name,
          path: selectedFileTarget.path,
          relativePath: selectedFileTarget.relativePath,
          mimeType: null,
        };

  const richPreviewControlMode = getWorkspaceFileRichPreviewControlMode(previewDescriptor);
  const richPreviewKind = getWorkspaceFileRichPreviewKind(previewDescriptor);
  const canToggleRichPreview =
    previewState.kind === "ready" && richPreviewControlMode === "toggle" && richPreviewKind !== null;
  const shouldRenderRichPreview =
    previewState.kind === "ready" &&
    richPreviewKind !== null &&
    (richPreviewControlMode === "always" ||
      (richPreviewControlMode === "toggle" && canToggleRichPreview && isRichPreviewEnabled));
  const canToggleWrap = !shouldRenderRichPreview;

  const handleOpenInEditor = async () => {
    try {
      await openWorkspaceFileInEditor(previewState.kind === "ready" ? previewState.file.path : selectedFileTarget.path);
    } catch {
      // Preserve the current preview state when the host cannot open the file path.
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(breadcrumbPath);
    } catch {
      // Keep the current preview visible when clipboard access is unavailable.
    }
  };

  const openFilesPanelWidth = useMemo(() => {
    const parentWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(OPEN_FILES_PANEL_MIN_WIDTH, parentWidth * OPEN_FILES_PANEL_MAX_WIDTH_RATIO);
    return Math.min(Math.max(width, OPEN_FILES_PANEL_MIN_WIDTH), maxWidth);
  }, [width]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: openFilesPanelWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (state === null || state.pointerId !== event.pointerId) {
      return;
    }

    const parentWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(OPEN_FILES_PANEL_MIN_WIDTH, parentWidth * OPEN_FILES_PANEL_MAX_WIDTH_RATIO);
    const nextWidth = Math.min(
      Math.max(state.startWidth - (event.clientX - state.startClientX), 0),
      maxWidth,
    );

    if (nextWidth < OPEN_FILES_PANEL_MIN_WIDTH) {
      close();
      resizeStateRef.current = null;
      return;
    }

    setWidth(nextWidth);
  };

  const handleResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (state === null || state.pointerId !== event.pointerId) {
      return;
    }
    resizeStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  let content: ReactNode;
  if (previewState.kind === "loading") {
    content = <CenteredFileState message={t("review.fileSource.loading")} />;
  } else if (previewState.kind === "unsupported") {
    content = (
      <CenteredFileState
        message={t(getWorkspaceFileUnsupportedMessageKey(previewState.unsupportedKind))}
        detail={t("review.fileSource.unsupportedDetail")}
      />
    );
  } else if (previewState.kind === "tooLarge") {
    content = (
      <CenteredFileState
        message={t("review.fileSource.tooLarge")}
        detail={t("review.fileSource.tooLargeDetail", {
          limit: formatWorkspaceFileSize(WORKSPACE_FILE_PREVIEW_LIMIT_BYTES),
          size: formatWorkspaceFileSize(previewState.sizeBytes),
        })}
      />
    );
  } else if (previewState.kind === "error") {
    content = <CenteredFileState message={t("review.fileSource.error")} />;
  } else {
    const selectedFile = previewState.file;

    if (selectedFile.isBinary && !shouldRenderRichPreview) {
      content = (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4">
          <div className="app-text-muted text-[13px] leading-6">{t("wham.diff.binaryFile")}</div>
        </div>
      );
    } else {
      const normalizedContents = normalizePreviewText(selectedFile.contents ?? "");
      const svgPreviewDataUri =
        shouldRenderRichPreview && richPreviewKind === "image" ? getSvgPreviewDataUri(selectedFile) : null;
      const pdfPreviewSrc = shouldRenderRichPreview && richPreviewKind === "pdf" ? getPdfPreviewSrc(selectedFile) : null;

      content = (
        <div className="min-h-0 flex-1 overflow-auto">
          {shouldRenderRichPreview && richPreviewKind === "markdown" ? (
            <div className="px-4 py-4">{renderMessageContent(normalizedContents)}</div>
          ) : pdfPreviewSrc ? (
            <div className="h-full min-h-[640px] bg-white">
              <iframe
                src={pdfPreviewSrc}
                title={selectedFile.name}
                className="block h-full min-h-[640px] w-full border-0"
              />
            </div>
          ) : svgPreviewDataUri ? (
            <div className="app-code-block px-4 py-4">
              <img src={svgPreviewDataUri} alt={selectedFile.name} className="block max-h-96 w-full" />
            </div>
          ) : (
            <div className="app-code-block">
              <code
                className={[
                  "block px-4 py-4 font-mono text-[12px] leading-6",
                  isWordWrapEnabled ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                ].join(" ")}
              >
                {normalizedContents}
              </code>
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div ref={containerRef} className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <FileBreadcrumb
          canToggleWrap={canToggleWrap}
          canToggleRichPreview={canToggleRichPreview}
          isOpenFilesPanelOpen={isOpen}
          isRichPreviewEnabled={isRichPreviewEnabled}
          isWordWrapEnabled={isWordWrapEnabled}
          onCopyPath={handleCopyPath}
          onOpenInEditor={handleOpenInEditor}
          onToggleOpenFilesPanel={toggle}
          onToggleRichPreview={toggleRichPreview}
          onToggleWordWrap={toggleWordWrap}
          path={breadcrumbPath}
          t={t}
        />
        {content}
      </div>
      {isOpen ? (
        <div
          style={{ maxWidth: `${OPEN_FILES_PANEL_MAX_WIDTH_RATIO * 100}%`, width: `${openFilesPanelWidth}px` }}
          className="relative flex h-full shrink-0 border-l border-[var(--app-shell-border)]"
        >
          <div
            className="absolute top-0 left-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
          <WorkspaceFileTreePanel
            workspaceRoot={selectedFileTarget.workspaceRoot}
            onSelectWorkspaceFile={onSelectWorkspaceFile}
            t={t}
          />
        </div>
      ) : null}
    </div>
  );
}

function FileBreadcrumb({
  canToggleWrap,
  canToggleRichPreview,
  isOpenFilesPanelOpen,
  isRichPreviewEnabled,
  isWordWrapEnabled,
  onCopyPath,
  onOpenInEditor,
  onToggleOpenFilesPanel,
  onToggleRichPreview,
  onToggleWordWrap,
  path,
  t,
}: {
  canToggleWrap: boolean;
  canToggleRichPreview: boolean;
  isOpenFilesPanelOpen: boolean;
  isRichPreviewEnabled: boolean;
  isWordWrapEnabled: boolean;
  onCopyPath: () => void;
  onOpenInEditor: () => void;
  onToggleOpenFilesPanel: () => void;
  onToggleRichPreview: () => void;
  onToggleWordWrap: () => void;
  path: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const segments = getBreadcrumbSegments(path);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOptionsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!optionsMenuRef.current?.contains(target)) {
        setIsOptionsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOptionsMenuOpen]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={t("review.fileSource.breadcrumb.ariaLabel")}
      className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--app-shell-border)] bg-[var(--app-shell-right)] px-2"
    >
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto px-2">
        <ol className="flex min-w-max items-center gap-1 text-[12px] text-[var(--app-shell-subtle)]">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;

            return (
              <li key={`${index}:${segment}`} className="flex shrink-0 items-center gap-1">
                <span className={isLast ? "font-medium text-[var(--app-shell-text)]" : ""}>{segment}</span>
                {isLast ? null : (
                  <ForwardNavigationIcon className="h-3 w-3 shrink-0 text-[var(--app-shell-subtle)]" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <button
        type="button"
        aria-label={t("review.fileSource.breadcrumb.openInEditor.ariaLabel")}
        title={t("review.fileSource.breadcrumb.openInEditor.tooltip")}
        onClick={() => void onOpenInEditor()}
        className="app-control-weak mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]"
      >
        <OpenInEditorIcon className="h-4 w-4" />
      </button>
      <div className="relative mr-1" ref={optionsMenuRef}>
        <button
          type="button"
          aria-label={t("review.fileSource.options")}
          aria-expanded={isOptionsMenuOpen}
          onClick={() => setIsOptionsMenuOpen((value) => !value)}
          className="app-control-weak flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]"
        >
          <MoreActionsIcon className="h-4 w-4" />
        </button>
        {isOptionsMenuOpen ? (
          <div className="app-card absolute top-9 right-0 z-10 min-w-[176px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => {
                setIsOptionsMenuOpen(false);
                void onCopyPath();
              }}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <CopyPathIcon className="h-4 w-4 shrink-0" />
              <span>{t("review.fileSource.copyPath")}</span>
            </button>
            {canToggleRichPreview ? (
              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onToggleRichPreview();
                }}
                className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              >
                {isRichPreviewEnabled ? (
                  <RichPreviewDisabledIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <RichPreviewEnabledIcon className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {t(
                    isRichPreviewEnabled
                      ? "review.fileSource.richPreview.disable"
                      : "review.fileSource.richPreview.enable",
                  )}
                </span>
              </button>
            ) : null}
            {canToggleWrap ? (
              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onToggleWordWrap();
                }}
                className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              >
                {isWordWrapEnabled ? (
                  <WrapEnabledIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <WrapDisabledIcon className="h-4 w-4 shrink-0" />
                )}
                <span>{t(isWordWrapEnabled ? "review.fileSource.wrap.disable" : "review.fileSource.wrap.enable")}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={[
          "mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]",
          isOpenFilesPanelOpen ? "app-control" : "app-control-weak",
        ].join(" ")}
        onClick={onToggleOpenFilesPanel}
      >
        <OpenFilesIcon className="h-4 w-4" />
      </button>
    </nav>
  );
}

function CenteredFileState({
  detail,
  message,
}: {
  detail?: string;
  message: string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="text-center text-sm text-[var(--app-shell-muted)]">
        <div>{message}</div>
        {detail ? <div className="mt-1 text-[12px]">{detail}</div> : null}
      </div>
    </div>
  );
}
