import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDownIcon,
  OpenInEditorIcon,
} from "../../components/AppShellIcons";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import {
  createMarkdownMediaDataUrl,
  inferMarkdownMediaMimeType,
} from "../../components/markdownPreviewMedia";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import {
  pairDiffBlock,
  type PullRequestDiffFragment,
} from "../../lib/diffPreviewModel";
import type { PullRequestDiffFile } from "../../lib/unifiedDiff";
import { PdfPreviewPanel } from "../chat/PdfPreviewPanel";
import {
  getWorkspaceFileRichPreviewControlMode,
  getWorkspaceFileRichPreviewKind,
  normalizePreviewText,
  type WorkspaceFilePreviewDescriptor,
} from "../chat/workspaceFilePreviewUtils";
import { openFile, readFileBinary, readFileText } from "../../services/hostFiles";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";

type DiffViewMode = "split" | "unified";

export type EditorDiffPreviewOverride =
  | {
      kind: "markdown";
      text: string;
    }
  | {
      kind: "image";
      dataUrl: string;
    }
  | {
      kind: "pdf";
      fileDataUrl: string;
    }
  | {
      kind: "loading";
    }
  | {
      kind: "error";
    };

type EditorDiffFileSurfaceProps = {
  cwd: string | null;
  file: PullRequestDiffFile;
  hostId?: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  previewOverride?: EditorDiffPreviewOverride | null;
  richPreviewEnabled: boolean;
  viewMode: DiffViewMode;
};

type UnifiedDiffRow =
  | {
      kind: "header" | "meta";
      text: string;
    }
  | {
      kind: "hunk";
      text: string;
      oldStart: number | null;
      newStart: number | null;
    }
  | {
      fragments: PullRequestDiffFragment[];
      kind: "addition" | "context" | "deletion";
      newLineNumber: number | null;
      oldLineNumber: number | null;
      prefix: " " | "+" | "-";
      text: string;
    };

type UnifiedCodeRow = Extract<
  UnifiedDiffRow,
  { kind: "addition" | "context" | "deletion" }
>;

type SplitDiffRow =
  | {
      kind: "header" | "meta";
      text: string;
    }
  | {
      kind: "hunk";
      text: string;
      oldStart: number | null;
      newStart: number | null;
    }
  | {
      kind: "addition" | "context" | "deletion" | "paired";
      leftFragments: PullRequestDiffFragment[];
      leftLineNumber: number | null;
      leftText: string | null;
      rightFragments: PullRequestDiffFragment[];
      rightLineNumber: number | null;
      rightText: string | null;
    };

type SplitCodeRow = Extract<
  SplitDiffRow,
  { kind: "addition" | "context" | "deletion" | "paired" }
>;

type PatchEntry =
  | {
      kind: "header" | "hunk" | "meta";
      text: string;
    }
  | {
      kind: "addition" | "context" | "deletion";
      text: string;
    };

type NumberedPatchLine = {
  lineNumber: number;
  text: string;
};

type EditorDiffRichPreviewKind = "image" | "markdown" | "pdf";
type EditorDiffRichPreviewControlMode = "always" | "none" | "toggle";

type EditorDiffRichPreviewPlan = {
  controlMode: EditorDiffRichPreviewControlMode;
  descriptor: WorkspaceFilePreviewDescriptor;
  kind: EditorDiffRichPreviewKind;
  path: string;
};

type EditorDiffPreviewState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      dataUrl: string;
      status: "image-ready";
    }
  | {
      status: "markdown-ready";
      text: string;
    }
  | {
      fileDataUrl: string;
      status: "pdf-ready";
    }
  | {
      status: "error";
    };

const PREVIEW_OPTIONS = {
  hideWhitespace: false,
  wordDiffsEnabled: false,
} as const;

export function EditorDiffFileSurface({
  cwd,
  file,
  hostId = null,
  isOpen,
  onToggleOpen,
  previewOverride = null,
  richPreviewEnabled,
  viewMode,
}: EditorDiffFileSurfaceProps) {
  const { t } = useI18n();
  const unifiedRows = useMemo(() => buildUnifiedDiffRows(file), [file]);
  const splitRows = useMemo(() => buildSplitDiffRows(file), [file]);
  const displayPath = file.path;
  const displayFileName = useMemo(() => getDisplayFileName(displayPath), [displayPath]);
  const openFilePath = resolveOpenFilePath(file);
  const canOpenFile = openFilePath != null;
  const isAddition = file.status === "added";
  const isDeletion = file.status === "deleted";
  const hasDiffBodyContent =
    file.hunkMetadata.length > 0 || file.additions > 0 || file.deletions > 0;
  const isRenameWithoutChanges =
    file.status === "renamed" && file.additions === 0 && file.deletions === 0 && !hasDiffBodyContent;
  const openFileAriaLabel = t("codex.diff.fileHeader.openInIcon");
  const openFileTooltip = t("codex.diff.fileHeader.openIn.tooltip");
  const toggleFileAriaLabel = t(
    isOpen ? "codex.diff.fileToggle.collapse" : "codex.diff.fileToggle.expand",
  );
  const previewPlan = useMemo(
    () =>
      resolveRichPreviewPlan({
        file,
        previewPath: openFilePath,
        richPreviewEnabled,
      }),
    [file, openFilePath, richPreviewEnabled],
  );
  const [previewState, setPreviewState] = useState<EditorDiffPreviewState>(() =>
    buildPreviewStateFromOverride(previewOverride),
  );

  useEffect(() => {
    const overrideState = buildPreviewStateFromOverride(previewOverride);
    if (overrideState.status !== "idle") {
      setPreviewState(overrideState);
      return;
    }

    if (previewPlan == null) {
      setPreviewState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setPreviewState({ status: "loading" });

    if (previewPlan.kind === "markdown") {
      void readFileText({
        cwd,
        hostId,
        path: previewPlan.path,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }

          const normalizedText = normalizePreviewText(response.contents);
          if (normalizedText.length === 0) {
            setPreviewState({ status: "error" });
            return;
          }

          setPreviewState({
            status: "markdown-ready",
            text: normalizedText,
          });
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewState({ status: "error" });
          }
        });
    } else {
      void readFileBinary({
        cwd,
        hostId,
        path: previewPlan.path,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }

          if (previewPlan.kind === "pdf") {
            setPreviewState({
              fileDataUrl: buildPdfDataUrl(response.contentsBase64, response.mimeType),
              status: "pdf-ready",
            });
            return;
          }

          setPreviewState({
            dataUrl: createMarkdownMediaDataUrl({
              contentsBase64: response.contentsBase64,
              mimeType:
                response.mimeType ??
                previewPlan.descriptor.mimeType ??
                inferMarkdownMediaMimeType(previewPlan.path),
              source: previewPlan.path,
            }),
            status: "image-ready",
          });
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewState({ status: "error" });
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [cwd, hostId, previewOverride, previewPlan]);

  const fallbackBody = renderFallbackBody({
    file,
    hasDiffBodyContent,
    isRenameWithoutChanges,
    splitRows,
    t,
    unifiedRows,
    viewMode,
  });
  const previewBody = renderPreviewBody({
    cwd,
    fallbackBody,
    file,
    hostId,
    previewOverride,
    previewPlan,
    previewState,
    t,
  });

  return (
    <section className="group/file-diff overflow-hidden rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)]">
      <div
        role="button"
        aria-expanded={isOpen}
        onClick={onToggleOpen}
        className="sticky top-0 z-10 cursor-pointer select-none bg-[color:color-mix(in_srgb,var(--app-shell-card-bg-weak)_92%,transparent)] backdrop-blur"
      >
        <div className="group relative @container/diff-header flex items-center gap-2 px-4 py-3 text-[13px]">
          <div className="min-w-0 flex flex-1 items-center gap-2 pb-0.5 text-[var(--app-shell-text)]">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!canOpenFile}
                onClick={(event) => {
                  event.stopPropagation();
                  if (openFilePath == null) {
                    return;
                  }
                  void openFile({
                    cwd,
                    hostId,
                    path: openFilePath,
                  });
                }}
                className="min-w-0 cursor-pointer truncate text-left font-medium text-[var(--app-shell-text)] [direction:rtl] disabled:cursor-default"
                title={displayPath}
              >
                <span className="min-w-0 truncate [direction:ltr] [unicode-bidi:plaintext] @xs/diff-header:hidden">
                  {displayFileName}
                </span>
                <span className="hidden min-w-0 truncate [direction:ltr] [unicode-bidi:plaintext] @xs/diff-header:inline">
                  {displayPath}
                </span>
              </button>
            </div>
            <span className="ml-auto shrink-0 text-[12px] leading-5 text-[var(--app-shell-subtle)]">
              +{file.additions} / -{file.deletions}
            </span>
            {isAddition ? (
              <span className="mb-0.5 text-[var(--app-shell-link)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            ) : null}
            {isDeletion ? (
              <span className="mb-0.5 text-red-700 dark:text-red-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            ) : null}
          </div>
          <div className="ms-auto flex items-center gap-1">
            {canOpenFile ? (
              <div
                className="shrink-0 opacity-0 transition-opacity duration-200 group-hover/file-diff:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label={openFileAriaLabel}
                  title={openFileTooltip}
                  onClick={() => {
                    if (openFilePath == null) {
                      return;
                    }
                    void openFile({
                      cwd,
                      hostId,
                      path: openFilePath,
                    });
                  }}
                  className="app-topbar-button flex h-7 w-7 items-center justify-center rounded-[10px] border border-transparent text-[var(--app-shell-text)] transition-colors"
                >
                  <OpenInEditorIcon className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={toggleFileAriaLabel}
              onClick={(event) => {
                event.stopPropagation();
                onToggleOpen();
              }}
              className="app-topbar-button flex h-7 w-7 items-center justify-center rounded-[10px] border border-transparent text-[var(--app-shell-text)] transition-colors"
            >
              <ChevronDownIcon
                className={[
                  "h-4 w-4 shrink-0 text-[var(--app-shell-muted)] transition-transform duration-200",
                  isOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      </div>

      {isOpen ? <div className="border-t-0">{previewBody ?? fallbackBody}</div> : null}
    </section>
  );
}

function renderPreviewBody({
  cwd,
  fallbackBody,
  file,
  hostId,
  previewOverride,
  previewPlan,
  previewState,
  t,
}: {
  cwd: string | null;
  fallbackBody: ReactNode;
  file: PullRequestDiffFile;
  hostId: string | null;
  previewOverride: EditorDiffPreviewOverride | null;
  previewPlan: EditorDiffRichPreviewPlan | null;
  previewState: EditorDiffPreviewState;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (previewPlan == null) {
    return null;
  }

  if (previewPlan.kind === "markdown") {
    if (previewState.status === "loading") {
      return <DiffPreviewLoading t={t} />;
    }

    if (previewState.status !== "markdown-ready") {
      return fallbackBody;
    }

    return (
      <div className="overflow-auto bg-[var(--app-shell-card-bg-weak)] px-4 py-3">
        <MarkdownPreview
          className="[&>p]:my-0"
          cwd={cwd}
          hostId={hostId}
          text={previewState.text}
        />
      </div>
    );
  }

  if (previewPlan.kind === "image") {
    if (previewState.status === "loading") {
      return <DiffPreviewLoading t={t} />;
    }

    if (previewState.status !== "image-ready") {
      return fallbackBody;
    }

    return (
      <div className="flex min-h-48 items-center justify-center overflow-auto bg-[var(--app-shell-card-bg-weak)] p-4">
        <img
          alt={previewPlan.descriptor.name}
          className="block max-h-[32rem] max-w-full rounded-md object-contain shadow-sm"
          src={previewState.dataUrl}
        />
      </div>
    );
  }

  if (previewState.status === "loading") {
    return <DiffPreviewLoading t={t} />;
  }

  if (previewState.status !== "pdf-ready") {
    return fallbackBody;
  }

  const pdfFile = buildPdfPreviewFileDocument({
    file,
    hostId,
    path: previewPlan.path,
  });

  return (
    <div className="h-[720px] min-h-[420px] max-h-[80vh] overflow-hidden bg-[var(--app-shell-card-bg-weak)]">
      <PdfPreviewPanel
        file={pdfFile}
        fileDataUrl={previewState.fileDataUrl}
        hostId={hostId}
        path={previewPlan.path}
        t={t}
        testMode={
          previewOverride?.kind === "pdf"
            ? {
                kind: "ready",
                numPages: 1,
              }
            : undefined
        }
        title={previewPlan.descriptor.name}
      />
    </div>
  );
}

function renderFallbackBody({
  file,
  hasDiffBodyContent,
  isRenameWithoutChanges,
  splitRows,
  t,
  unifiedRows,
  viewMode,
}: {
  file: PullRequestDiffFile;
  hasDiffBodyContent: boolean;
  isRenameWithoutChanges: boolean;
  splitRows: SplitDiffRow[];
  t: ReturnType<typeof useI18n>["t"];
  unifiedRows: UnifiedDiffRow[];
  viewMode: DiffViewMode;
}) {
  if (file.isBinary) {
    return (
      <div className="flex h-full justify-center bg-[var(--app-shell-card-bg-weak)] py-4 text-sm text-[var(--app-shell-subtle)]">
        {t("wham.diff.binaryFile")}
      </div>
    );
  }

  if (isRenameWithoutChanges) {
    return (
      <div className="flex h-full justify-center bg-[var(--app-shell-card-bg-weak)] py-4 text-sm text-[var(--app-shell-subtle)]">
        {t("codex.diff.fileRenamedWithoutChanges")}
      </div>
    );
  }

  if (!hasDiffBodyContent) {
    return (
      <div className="flex h-full justify-center bg-[var(--app-shell-card-bg-weak)] py-4 text-sm text-[var(--app-shell-subtle)]">
        {t("wham.diff.noContent")}
      </div>
    );
  }

  return viewMode === "split" ? (
    <SplitDiffRowsView rows={splitRows} />
  ) : (
    <UnifiedDiffRowsView rows={unifiedRows} />
  );
}

function DiffPreviewLoading({
  t,
}: {
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="flex min-h-48 items-center justify-center bg-[var(--app-shell-card-bg-weak)] px-6 py-10 text-sm text-[var(--app-shell-subtle)]">
      <div className="flex items-center gap-2 font-medium">
        <Spinner className="h-4 w-4" />
        <span>{t("artifactTab.previewLoading")}</span>
      </div>
    </div>
  );
}

function buildPreviewStateFromOverride(
  previewOverride: EditorDiffPreviewOverride | null,
): EditorDiffPreviewState {
  if (previewOverride == null) {
    return { status: "idle" };
  }

  switch (previewOverride.kind) {
    case "markdown":
      return {
        status: "markdown-ready",
        text: previewOverride.text,
      };
    case "image":
      return {
        dataUrl: previewOverride.dataUrl,
        status: "image-ready",
      };
    case "pdf":
      return {
        fileDataUrl: previewOverride.fileDataUrl,
        status: "pdf-ready",
      };
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error" };
  }
}

function resolveRichPreviewPlan({
  file,
  previewPath,
  richPreviewEnabled,
}: {
  file: PullRequestDiffFile;
  previewPath: string | null;
  richPreviewEnabled: boolean;
}): EditorDiffRichPreviewPlan | null {
  if (previewPath == null || file.status === "deleted") {
    return null;
  }

  const descriptor = buildPreviewDescriptor(file, previewPath);
  const kind = getWorkspaceFileRichPreviewKind(descriptor);
  if (kind == null) {
    return null;
  }

  const controlMode = getWorkspaceFileRichPreviewControlMode(descriptor);
  if (controlMode === "none") {
    return null;
  }

  if (controlMode === "toggle" && !richPreviewEnabled) {
    return null;
  }

  return {
    controlMode,
    descriptor,
    kind,
    path: previewPath,
  };
}

function buildPreviewDescriptor(
  file: PullRequestDiffFile,
  previewPath: string,
): WorkspaceFilePreviewDescriptor {
  return {
    mimeType: inferPreviewMimeType(previewPath),
    name: getDisplayFileName(previewPath),
    path: previewPath,
    relativePath: file.path,
  };
}

function buildPdfPreviewFileDocument({
  file,
  hostId,
  path,
}: {
  file: PullRequestDiffFile;
  hostId: string | null;
  path: string;
}): WorkspaceFileDocument {
  return {
    contents: null,
    hostId,
    isBinary: true,
    mimeType: inferPreviewMimeType(path),
    name: getDisplayFileName(path),
    path,
    relativePath: file.path,
  };
}

function inferPreviewMimeType(path: string) {
  const inferred = inferMarkdownMediaMimeType(path);
  if (inferred != null) {
    return inferred;
  }

  if (path.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }

  return null;
}

function buildPdfDataUrl(contentsBase64: string, mimeType: string | null) {
  return `data:${mimeType ?? "application/pdf"};base64,${contentsBase64}`;
}

function UnifiedDiffRowsView({ rows }: { rows: UnifiedDiffRow[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max font-mono text-[12px] leading-6">
        {rows.map((row, index) => renderUnifiedRow(row, index))}
      </div>
    </div>
  );
}

function SplitDiffRowsView({ rows }: { rows: SplitDiffRow[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max font-mono text-[12px] leading-6">
        {rows.map((row, index) => renderSplitRow(row, index))}
      </div>
    </div>
  );
}

function renderUnifiedRow(row: UnifiedDiffRow, index: number) {
  switch (row.kind) {
    case "header":
    case "meta":
      return (
        <div
          key={`u:${index}`}
          className="grid grid-cols-[4.5rem_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "hunk":
      return (
        <div
          key={`u:${index}`}
          className="grid grid-cols-[4.5rem_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-sky-500/10 text-sky-700 dark:text-sky-300"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.oldStart)}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.newStart)}
          </div>
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "addition":
    case "context":
    case "deletion": {
      const codeRow: UnifiedCodeRow = row;
      return (
        <div
          key={`u:${index}`}
          className={[
            "grid grid-cols-[4.5rem_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)]",
            unifiedCodeRowClassName(codeRow.kind),
          ].join(" ")}
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(codeRow.oldLineNumber)}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(codeRow.newLineNumber)}
          </div>
          <div className="px-4 py-0.5 whitespace-pre">
            <span className="select-none">
              {codeRow.prefix === " " ? "\u00a0" : codeRow.prefix}
            </span>
            {renderPreviewFragments(codeRow.fragments, codeRow.kind)}
          </div>
        </div>
      );
    }
  }
}

function renderSplitRow(row: SplitDiffRow, index: number) {
  switch (row.kind) {
    case "header":
    case "meta":
      return (
        <div
          key={`s:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre" />
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right" />
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "hunk":
      return (
        <div
          key={`s:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)] bg-sky-500/10 text-sky-700 dark:text-sky-300"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.oldStart)}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre">
            {row.text}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums">
            {formatLineNumber(row.newStart)}
          </div>
          <div className="px-4 py-0.5 whitespace-pre">{row.text}</div>
        </div>
      );
    case "addition":
    case "context":
    case "deletion":
    case "paired": {
      const codeRow: SplitCodeRow = row;
      return (
        <div
          key={`s:${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)] border-b border-[var(--app-shell-border)]"
        >
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(codeRow.leftLineNumber)}
          </div>
          <div
            className={[
              "border-r border-[var(--app-shell-border)] px-4 py-0.5 whitespace-pre",
              splitCodeCellClassName(codeRow.kind, "left"),
            ].join(" ")}
          >
            {codeRow.leftText == null ? (
              <span className="text-[var(--app-shell-muted)]">&nbsp;</span>
            ) : (
              renderPreviewFragments(codeRow.leftFragments, codeRow.kind, "left")
            )}
          </div>
          <div className="border-r border-[var(--app-shell-border)] px-3 py-0.5 text-right tabular-nums text-[var(--app-shell-muted)]">
            {formatLineNumber(codeRow.rightLineNumber)}
          </div>
          <div
            className={[
              "px-4 py-0.5 whitespace-pre",
              splitCodeCellClassName(codeRow.kind, "right"),
            ].join(" ")}
          >
            {codeRow.rightText == null ? (
              <span className="text-[var(--app-shell-muted)]">&nbsp;</span>
            ) : (
              renderPreviewFragments(codeRow.rightFragments, codeRow.kind, "right")
            )}
          </div>
        </div>
      );
    }
  }
}

function renderPreviewFragments(
  fragments: PullRequestDiffFragment[],
  lineKind: UnifiedCodeRow["kind"] | SplitCodeRow["kind"],
  side?: "left" | "right",
) {
  return fragments.map((fragment, index) => {
    if (!fragment.isChanged) {
      return <span key={index}>{fragment.text || " "}</span>;
    }

    return (
      <span
        key={index}
        className={[
          "rounded-[3px] px-0.5 font-medium",
          fragmentHighlightClassName(lineKind, side),
        ].join(" ")}
      >
        {fragment.text}
      </span>
    );
  });
}

function buildUnifiedDiffRows(file: PullRequestDiffFile) {
  const entries = parsePatchEntries(file.patch);
  const rows: UnifiedDiffRow[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];
    if (entry == null) {
      break;
    }

    if (entry.kind === "header" || entry.kind === "meta") {
      rows.push({
        kind: entry.kind,
        text: entry.text,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "hunk") {
      const hunkHeader = parseHunkHeader(entry.text);
      oldLineNumber = hunkHeader.oldStart ?? oldLineNumber;
      newLineNumber = hunkHeader.newStart ?? newLineNumber;
      rows.push({
        kind: "hunk",
        text: entry.text,
        oldStart: hunkHeader.oldStart,
        newStart: hunkHeader.newStart,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "context") {
      rows.push({
        fragments: [{ isChanged: false, text: entry.text }],
        kind: "context",
        newLineNumber,
        oldLineNumber,
        prefix: " ",
        text: entry.text,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
      index += 1;
      continue;
    }

    const {
      additions,
      deletions,
      nextIndex,
    } = collectNumberedChangeBlock(entries, index, oldLineNumber, newLineNumber);
    const changes = pairDiffBlock(
      additions.map((line) => line.text),
      deletions.map((line) => line.text),
      PREVIEW_OPTIONS,
    );

    changes.forEach((change, changeIndex) => {
      const deletion = deletions[changeIndex] ?? null;
      const addition = additions[changeIndex] ?? null;

      if (change.leftText != null && deletion != null) {
        rows.push({
          fragments: change.leftFragments,
          kind: "deletion",
          newLineNumber: null,
          oldLineNumber: deletion.lineNumber,
          prefix: "-",
          text: change.leftText,
        });
      }

      if (change.rightText != null && addition != null) {
        rows.push({
          fragments: change.rightFragments,
          kind: "addition",
          newLineNumber: addition.lineNumber,
          oldLineNumber: null,
          prefix: "+",
          text: change.rightText,
        });
      }
    });

    oldLineNumber += deletions.length;
    newLineNumber += additions.length;
    index = nextIndex;
  }

  return rows;
}

function buildSplitDiffRows(file: PullRequestDiffFile) {
  const entries = parsePatchEntries(file.patch);
  const rows: SplitDiffRow[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];
    if (entry == null) {
      break;
    }

    if (entry.kind === "header" || entry.kind === "meta") {
      rows.push({
        kind: entry.kind,
        text: entry.text,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "hunk") {
      const hunkHeader = parseHunkHeader(entry.text);
      oldLineNumber = hunkHeader.oldStart ?? oldLineNumber;
      newLineNumber = hunkHeader.newStart ?? newLineNumber;
      rows.push({
        kind: "hunk",
        text: entry.text,
        oldStart: hunkHeader.oldStart,
        newStart: hunkHeader.newStart,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "context") {
      rows.push({
        kind: "context",
        leftFragments: [{ isChanged: false, text: entry.text }],
        leftLineNumber: oldLineNumber,
        leftText: entry.text,
        rightFragments: [{ isChanged: false, text: entry.text }],
        rightLineNumber: newLineNumber,
        rightText: entry.text,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
      index += 1;
      continue;
    }

    const {
      additions,
      deletions,
      nextIndex,
    } = collectNumberedChangeBlock(entries, index, oldLineNumber, newLineNumber);
    const changes = pairDiffBlock(
      additions.map((line) => line.text),
      deletions.map((line) => line.text),
      PREVIEW_OPTIONS,
    );

    changes.forEach((change, changeIndex) => {
      const deletion = deletions[changeIndex] ?? null;
      const addition = additions[changeIndex] ?? null;
      rows.push({
        kind:
          change.leftText != null && change.rightText != null
            ? "paired"
            : change.leftText != null
              ? "deletion"
              : "addition",
        leftFragments: change.leftFragments,
        leftLineNumber: deletion?.lineNumber ?? null,
        leftText: change.leftText,
        rightFragments: change.rightFragments,
        rightLineNumber: addition?.lineNumber ?? null,
        rightText: change.rightText,
      });
    });

    oldLineNumber += deletions.length;
    newLineNumber += additions.length;
    index = nextIndex;
  }

  return rows;
}

function collectNumberedChangeBlock(
  entries: PatchEntry[],
  startIndex: number,
  oldLineNumber: number,
  newLineNumber: number,
) {
  const deletions: NumberedPatchLine[] = [];
  const additions: NumberedPatchLine[] = [];
  let index = startIndex;
  let currentOldLineNumber = oldLineNumber;
  let currentNewLineNumber = newLineNumber;

  while (entries[index]?.kind === "deletion") {
    deletions.push({
      lineNumber: currentOldLineNumber,
      text: entries[index]!.text,
    });
    currentOldLineNumber += 1;
    index += 1;
  }

  while (entries[index]?.kind === "addition") {
    additions.push({
      lineNumber: currentNewLineNumber,
      text: entries[index]!.text,
    });
    currentNewLineNumber += 1;
    index += 1;
  }

  return {
    additions,
    deletions,
    nextIndex: index,
  };
}

function parsePatchEntries(patch: string) {
  const entries: PatchEntry[] = [];
  let insideHunk = false;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      entries.push({ kind: "hunk", text: line });
      insideHunk = true;
      continue;
    }

    if (isPatchHeaderLine(line)) {
      entries.push({ kind: "header", text: line });
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      entries.push({ kind: "meta", text: line });
      continue;
    }

    if (insideHunk && line.startsWith("-") && !line.startsWith("---")) {
      entries.push({ kind: "deletion", text: line.slice(1) });
      continue;
    }

    if (insideHunk && line.startsWith("+") && !line.startsWith("+++")) {
      entries.push({ kind: "addition", text: line.slice(1) });
      continue;
    }

    if (insideHunk) {
      entries.push({
        kind: "context",
        text: line.startsWith(" ") ? line.slice(1) : line,
      });
      continue;
    }

    entries.push({ kind: "header", text: line });
  }

  return entries;
}

function isPatchHeaderLine(line: string) {
  return (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ") ||
    line.startsWith("new file mode ") ||
    line.startsWith("deleted file mode ") ||
    line.startsWith("similarity index ") ||
    line.startsWith("dissimilarity index ") ||
    line.startsWith("Binary files ")
  );
}

function parseHunkHeader(text: string) {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
  if (match == null) {
    return {
      newStart: null,
      oldStart: null,
    };
  }

  return {
    newStart: Number(match[2]),
    oldStart: Number(match[1]),
  };
}

function formatLineNumber(value: number | null) {
  return value == null ? "" : String(value);
}

function unifiedCodeRowClassName(kind: "addition" | "context" | "deletion") {
  if (kind === "addition") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  }

  return "text-[var(--app-shell-text)]";
}

function splitCodeCellClassName(
  kind: "addition" | "context" | "deletion" | "paired",
  side: "left" | "right",
) {
  if (kind === "context") {
    return "text-[var(--app-shell-text)]";
  }

  if (kind === "paired") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "text-[var(--app-shell-muted)]";
  }

  return side === "right"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "text-[var(--app-shell-muted)]";
}

function fragmentHighlightClassName(
  kind: UnifiedDiffRow["kind"] | SplitDiffRow["kind"],
  side?: "left" | "right",
) {
  if (kind === "deletion" || (kind === "paired" && side === "left")) {
    return "bg-red-500/20";
  }

  if (kind === "addition" || (kind === "paired" && side === "right")) {
    return "bg-emerald-500/20";
  }

  return "";
}

function getDisplayFileName(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
}

function resolveOpenFilePath(file: PullRequestDiffFile) {
  if (file.status === "deleted") {
    return file.oldPath;
  }

  return file.newPath ?? file.oldPath;
}
