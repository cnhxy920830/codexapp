import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";
import {
  CopyPathIcon,
  ForwardNavigationIcon,
  MoreActionsIcon,
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
  type WorkspaceFileDocument,
  type WorkspaceFilePreviewTarget,
} from "../../services/workspaceFiles";
import { isWorkspaceFileRightPanelTab, type RightPanelTab } from "./rightPanelTabs";
import { countFileChangeDiffLines, type ThreadDiffSummary } from "./threadConversationState";

type ChatSidePanelProps = {
  activeTab: RightPanelTab | null;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

type WorkspaceFilePreviewDescriptor = Pick<WorkspaceFileDocument, "name" | "path" | "relativePath"> & {
  mimeType: string | null;
};

type WorkspaceFileUnsupportedPreviewKind =
  | "archive"
  | "audio"
  | "excelSpreadsheet"
  | "keynoteDeck"
  | "numbersSpreadsheet"
  | "opendocumentPresentation"
  | "opendocumentSpreadsheet"
  | "opendocumentText"
  | "pagesDocument"
  | "powerpointDeck"
  | "richTextDocument"
  | "video"
  | "wordDocument";

type WorkspaceFilePreviewState =
  | {
      kind: "loading";
    }
  | {
      kind: "unsupported";
      unsupportedKind: WorkspaceFileUnsupportedPreviewKind;
    }
  | {
      kind: "ready";
      file: WorkspaceFileDocument;
    }
  | {
      kind: "tooLarge";
      sizeBytes: number;
    }
  | {
      kind: "error";
    };

const WORKSPACE_FILE_PREVIEW_LIMIT_BYTES = 10 * 1024 * 1024;

export function ChatSidePanel({
  activeTab,
  onOpenReviewFile,
  t,
  threadDiffSummary,
}: ChatSidePanelProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-[var(--app-shell-border)] bg-[var(--app-shell-right)] px-4 py-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab && isWorkspaceFileRightPanelTab(activeTab) ? (
          <FilePanel selectedFileTarget={activeTab.file} t={t} />
        ) : activeTab?.kind === "review" ? (
          <ReviewPanel onOpenReviewFile={onOpenReviewFile} threadDiffSummary={threadDiffSummary} t={t} />
        ) : activeTab?.kind === "browser" ? (
          <BrowserEmptyPanel t={t} />
        ) : (
          <EmptyPanel t={t} />
        )}
      </div>
    </aside>
  );
}

function ReviewPanel({
  onOpenReviewFile,
  threadDiffSummary,
  t,
}: {
  onOpenReviewFile: (change: FileChangeSummary) => void;
  threadDiffSummary: ThreadDiffSummary;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (!threadDiffSummary.hasChanges) {
    return <ReviewEmptyPanel t={t} />;
  }

  return (
    <div className="space-y-4">
      <div className="app-card rounded-[18px] px-4 py-4">
        <div className="text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
          {t("thread.sidePanel.diffTab")}
        </div>
        <div className="app-title mt-3 text-[14px] font-medium">
          {t("app.chat.filesChanged", { fileCount: threadDiffSummary.fileCount })}
        </div>
        <div className="app-text-muted mt-2 flex items-center gap-3 text-[12px]">
          <span className="text-[#21a05b]">+{threadDiffSummary.linesAdded}</span>
          <span className="text-[#c3564e]">-{threadDiffSummary.linesDeleted}</span>
        </div>
      </div>

      <div className="space-y-2">
        {threadDiffSummary.files.map((file, index) => (
          <ReviewFileCard
            key={`${file.kind}:${file.path}:${file.movePath ?? "same"}:${index}`}
            change={file}
            onOpenReviewFile={onOpenReviewFile}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewFileCard({
  change,
  onOpenReviewFile,
  t,
}: {
  change: FileChangeSummary;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const lineCounts = countFileChangeDiffLines(change.diff);
  const isPreviewable = !["delete", "deleted"].includes(change.kind.trim().toLowerCase());

  return (
    <button
      type="button"
      disabled={!isPreviewable}
      onClick={() => onOpenReviewFile(change)}
      className={[
        "w-full rounded-[14px] px-4 py-3 text-left",
        isPreviewable ? "app-card-muted cursor-pointer" : "app-card-muted opacity-70",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="app-control shrink-0 rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
          {change.kind}
        </span>
        <div className="min-w-0 flex-1">
          <div className="break-all text-[13px] leading-6">{change.path}</div>
          {change.movePath ? (
            <div className="app-text-muted mt-1 break-all text-[12px] leading-5">
              {t("app.chat.movedTo")}: {change.movePath}
            </div>
          ) : null}
        </div>
      </div>

      {lineCounts.linesAdded > 0 || lineCounts.linesDeleted > 0 ? (
        <div className="app-text-muted mt-3 flex items-center gap-3 text-[12px]">
          <span className="text-[#21a05b]">+{lineCounts.linesAdded}</span>
          <span className="text-[#c3564e]">-{lineCounts.linesDeleted}</span>
        </div>
      ) : null}
    </button>
  );
}

function ReviewEmptyPanel({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-4 py-5">
      <div className="app-title text-[14px] font-medium">{t("codex.review.noDiff")}</div>
      <div className="app-text-muted mt-2 text-[13px] leading-6">
        {t("codex.review.noDiff.baseDescription")}
      </div>
    </div>
  );
}

function BrowserEmptyPanel({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-4 py-5">
      <div className="app-title text-[14px] font-medium">{t("thread.browser.emptyState.title")}</div>
      <div className="app-text-muted mt-2 text-[13px] leading-6">
        {t("thread.browser.emptyState.description")}
      </div>
    </div>
  );
}

function EmptyPanel({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-72 text-center">
        <div className="app-title text-[14px] font-medium">{t("thread.sidePanel.empty.title")}</div>
      </div>
    </div>
  );
}

function FilePanel({
  selectedFileTarget,
  t,
}: {
  selectedFileTarget: WorkspaceFilePreviewTarget;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const breadcrumbPath = selectedFileTarget.relativePath || selectedFileTarget.path;
  const [previewState, setPreviewState] = useState<WorkspaceFilePreviewState>({ kind: "loading" });
  const [isWordWrapEnabled, setIsWordWrapEnabled] = useState(true);
  const [isRichPreviewEnabled, setIsRichPreviewEnabled] = useState(false);

  useEffect(() => {
    setIsWordWrapEnabled(true);
    setIsRichPreviewEnabled(false);
    setPreviewState({ kind: "loading" });

    let cancelled = false;
    void readWorkspaceFileMetadata({
      workspaceRoot: selectedFileTarget.workspaceRoot,
      relativePath: selectedFileTarget.relativePath,
    })
      .then((metadata) => {
        if (!cancelled) {
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
        }
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
  const canToggleRichPreview = previewState.kind === "ready" && richPreviewControlMode === "toggle" && richPreviewKind !== null;
  const shouldRenderRichPreview =
    previewState.kind === "ready" &&
    richPreviewKind !== null &&
    (richPreviewControlMode === "always" ||
      (richPreviewControlMode === "toggle" && canToggleRichPreview && isRichPreviewEnabled));
  const canToggleWrap = !shouldRenderRichPreview;
  const showOptionsMenu = true;

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

  if (previewState.kind === "loading") {
    return <CenteredFileState message={t("review.fileSource.loading")} />;
  }

  if (previewState.kind === "unsupported") {
    return (
      <CenteredFileState
        message={t(getWorkspaceFileUnsupportedMessageKey(previewState.unsupportedKind))}
        detail={t("review.fileSource.unsupportedDetail")}
      />
    );
  }

  if (previewState.kind === "tooLarge") {
    return (
      <CenteredFileState
        message={t("review.fileSource.tooLarge")}
        detail={t("review.fileSource.tooLargeDetail", {
          limit: formatWorkspaceFileSize(WORKSPACE_FILE_PREVIEW_LIMIT_BYTES),
          size: formatWorkspaceFileSize(previewState.sizeBytes),
        })}
      />
    );
  }

  if (previewState.kind === "error") {
    return <CenteredFileState message={t("review.fileSource.error")} />;
  }

  const selectedFile = previewState.file;

  if (selectedFile.isBinary && !shouldRenderRichPreview) {
    return (
      <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full flex-col">
        <FileBreadcrumb
          canToggleWrap={canToggleWrap}
          canToggleRichPreview={canToggleRichPreview}
          isRichPreviewEnabled={isRichPreviewEnabled}
          isWordWrapEnabled={isWordWrapEnabled}
          onCopyPath={handleCopyPath}
          onOpenInEditor={handleOpenInEditor}
          onToggleRichPreview={() => setIsRichPreviewEnabled((value) => !value)}
          onToggleWordWrap={() => setIsWordWrapEnabled((value) => !value)}
          path={breadcrumbPath}
          showOptionsMenu={showOptionsMenu}
          t={t}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center px-4">
          <div className="app-text-muted text-[13px] leading-6">{t("wham.diff.binaryFile")}</div>
        </div>
      </div>
    );
  }

  const normalizedContents = normalizePreviewText(selectedFile.contents ?? "");
  const svgPreviewDataUri =
    shouldRenderRichPreview && richPreviewKind === "image" ? getSvgPreviewDataUri(selectedFile) : null;
  const pdfPreviewSrc = shouldRenderRichPreview && richPreviewKind === "pdf" ? getPdfPreviewSrc(selectedFile) : null;

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full flex-col">
      <FileBreadcrumb
        canToggleWrap={canToggleWrap}
        canToggleRichPreview={canToggleRichPreview}
        isRichPreviewEnabled={isRichPreviewEnabled}
        isWordWrapEnabled={isWordWrapEnabled}
        onCopyPath={handleCopyPath}
        onOpenInEditor={handleOpenInEditor}
        onToggleRichPreview={() => setIsRichPreviewEnabled((value) => !value)}
        onToggleWordWrap={() => setIsWordWrapEnabled((value) => !value)}
        path={breadcrumbPath}
        showOptionsMenu={showOptionsMenu}
        t={t}
      />
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
    </div>
  );
}

function FileBreadcrumb({
  canToggleWrap,
  canToggleRichPreview,
  isRichPreviewEnabled,
  isWordWrapEnabled,
  onCopyPath,
  onOpenInEditor,
  onToggleRichPreview,
  onToggleWordWrap,
  path,
  showOptionsMenu,
  t,
}: {
  canToggleWrap: boolean;
  canToggleRichPreview: boolean;
  isRichPreviewEnabled: boolean;
  isWordWrapEnabled: boolean;
  onCopyPath: () => void;
  onOpenInEditor: () => void;
  onToggleRichPreview: () => void;
  onToggleWordWrap: () => void;
  path: string;
  showOptionsMenu: boolean;
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
      {showOptionsMenu ? (
        <div className="relative mr-1" ref={optionsMenuRef}>
          <button
            type="button"
            aria-label={t("artifactTab.sourceOptions")}
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
                <span>{t("wham.diff.contextMenu.copyPath")}</span>
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
                    {t(isRichPreviewEnabled ? "codex.diffView.richPreviewDisable" : "codex.diffView.richPreviewEnable")}
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
                  <span>{t("wham.diff.contextMenu.toggleWrap")}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
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

function normalizePreviewText(contents: string) {
  return contents.replace(/\r\n/g, "\n");
}

function getSvgPreviewDataUri(file: WorkspaceFileDocument) {
  const contents = file.contents;
  if (!contents) {
    return null;
  }

  const normalizedMimeType = file.mimeType?.toLowerCase() ?? null;
  const normalizedRelativePath = file.relativePath.toLowerCase();
  const trimmedContents = contents.trimStart();

  if (
    normalizedMimeType !== "image/svg+xml" &&
    !normalizedRelativePath.endsWith(".svg") &&
    !trimmedContents.startsWith("<svg")
  ) {
    return null;
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(contents)}`;
}

function getPdfPreviewSrc(file: WorkspaceFileDocument) {
  return convertFileSrc(file.path);
}

// Mirror the extracted `Uc/Gc/A9/nRe` preview gates from `use-model-settings`.
const ALWAYS_RICH_IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);

const MARKDOWN_EXTENSIONS = new Set(["markdown", "md", "mdown", "mdx", "mkd"]);

function getWorkspaceFileRichPreviewMode(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  if (extension === null) {
    return "none";
  }
  if (extension === "svg") {
    return "toggle";
  }
  if (ALWAYS_RICH_IMAGE_EXTENSIONS.has(extension)) {
    return "always";
  }
  return "none";
}

function formatWorkspaceFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

const ARCHIVE_EXTENSIONS = new Set(["7z", "bz2", "gz", "rar", "tar", "tgz", "xz", "zip"]);
const AUDIO_EXTENSIONS = new Set(["aac", "aif", "aiff", "alac", "flac", "m4a", "mid", "midi", "mp3", "oga", "ogg", "opus", "wav", "wma"]);
const EXCEL_EXTENSIONS = new Set(["xls", "xlsm", "xlsx"]);
const KEYNOTE_EXTENSIONS = new Set(["key"]);
const NUMBERS_EXTENSIONS = new Set(["numbers"]);
const OPEN_DOCUMENT_PRESENTATION_EXTENSIONS = new Set(["odp"]);
const OPEN_DOCUMENT_SPREADSHEET_EXTENSIONS = new Set(["ods"]);
const OPEN_DOCUMENT_TEXT_EXTENSIONS = new Set(["odt"]);
const PAGES_EXTENSIONS = new Set(["pages"]);
const POWERPOINT_EXTENSIONS = new Set(["ppt", "pptm", "pptx"]);
const RICH_TEXT_EXTENSIONS = new Set(["rtf"]);
const VIDEO_EXTENSIONS = new Set(["3g2", "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv"]);
const WORD_EXTENSIONS = new Set(["doc", "docm", "docx"]);

function getWorkspaceFileUnsupportedMessageKey(kind: WorkspaceFileUnsupportedPreviewKind): MessageKey {
  switch (kind) {
    case "archive":
      return "review.fileSource.unsupported.archive";
    case "audio":
      return "review.fileSource.unsupported.audio";
    case "excelSpreadsheet":
      return "review.fileSource.unsupported.excelSpreadsheet";
    case "keynoteDeck":
      return "review.fileSource.unsupported.keynoteDeck";
    case "numbersSpreadsheet":
      return "review.fileSource.unsupported.numbersSpreadsheet";
    case "opendocumentPresentation":
      return "review.fileSource.unsupported.opendocumentPresentation";
    case "opendocumentSpreadsheet":
      return "review.fileSource.unsupported.opendocumentSpreadsheet";
    case "opendocumentText":
      return "review.fileSource.unsupported.opendocumentText";
    case "pagesDocument":
      return "review.fileSource.unsupported.pagesDocument";
    case "powerpointDeck":
      return "review.fileSource.unsupported.powerpointDeck";
    case "richTextDocument":
      return "review.fileSource.unsupported.richTextDocument";
    case "video":
      return "review.fileSource.unsupported.video";
    case "wordDocument":
      return "review.fileSource.unsupported.wordDocument";
  }
}

function getWorkspaceFileUnsupportedPreviewKind(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const mimeType = file.mimeType?.toLowerCase() ?? null;

  if (
    ARCHIVE_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/zip" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-bzip" ||
    mimeType === "application/x-bzip2" ||
    mimeType === "application/x-xz"
  ) {
    return "archive";
  }
  if (AUDIO_EXTENSIONS.has(extension ?? "") || (mimeType?.startsWith("audio/") ?? false)) {
    return "audio";
  }
  if (
    EXCEL_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel.sheet.macroenabled.12"
  ) {
    return "excelSpreadsheet";
  }
  if (KEYNOTE_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.keynote") {
    return "keynoteDeck";
  }
  if (NUMBERS_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.numbers") {
    return "numbersSpreadsheet";
  }
  if (
    OPEN_DOCUMENT_PRESENTATION_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.oasis.opendocument.presentation"
  ) {
    return "opendocumentPresentation";
  }
  if (
    OPEN_DOCUMENT_SPREADSHEET_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return "opendocumentSpreadsheet";
  }
  if (OPEN_DOCUMENT_TEXT_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.oasis.opendocument.text") {
    return "opendocumentText";
  }
  if (PAGES_EXTENSIONS.has(extension ?? "") || mimeType === "application/vnd.apple.pages") {
    return "pagesDocument";
  }
  if (
    POWERPOINT_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "powerpointDeck";
  }
  if (RICH_TEXT_EXTENSIONS.has(extension ?? "") || mimeType === "application/rtf" || mimeType === "text/rtf") {
    return "richTextDocument";
  }
  if (VIDEO_EXTENSIONS.has(extension ?? "") || (mimeType?.startsWith("video/") ?? false)) {
    return "video";
  }
  if (
    WORD_EXTENSIONS.has(extension ?? "") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "wordDocument";
  }

  return null;
}

function getWorkspaceFileRichPreviewKind(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const richPreviewMode = getWorkspaceFileRichPreviewMode(file);
  if (richPreviewMode !== "none") {
    return "image";
  }
  if (extension !== null && MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }
  if (extension === "pdf") {
    return "pdf";
  }
  return null;
}

function getWorkspaceFileRichPreviewControlMode(file: WorkspaceFilePreviewDescriptor) {
  const extension = getWorkspaceFileExtension(file);
  const richPreviewMode = getWorkspaceFileRichPreviewMode(file);
  if (richPreviewMode === "always") {
    return "always";
  }
  if (richPreviewMode === "toggle" || (extension !== null && MARKDOWN_EXTENSIONS.has(extension))) {
    return "toggle";
  }
  if (extension === "pdf") {
    return "always";
  }
  return "none";
}

function getWorkspaceFileExtension(file: WorkspaceFilePreviewDescriptor) {
  const normalizedPath = (file.relativePath || file.name || file.path).toLowerCase();
  const extensionStartIndex = normalizedPath.lastIndexOf(".");
  if (extensionStartIndex <= -1 || extensionStartIndex === normalizedPath.length - 1) {
    return null;
  }
  return normalizedPath.slice(extensionStartIndex + 1);
}

function getBreadcrumbSegments(path: string) {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0);
}
