import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDownIcon,
  FolderIcon,
  SearchClearIcon,
  SearchIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import {
  readPullRequestFileContent,
  type PullRequestCommentAttachment,
} from "../../services/pullRequests";
import { renderMessageContent } from "../chat/messageContent";
import type { PullRequestDiffFile } from "./pullRequestDiffModel";
import {
  buildPullRequestSplitPreviewRows,
  buildPullRequestUnifiedPreviewLines,
  type PullRequestDiffFragment,
  type PullRequestSplitPreviewRow,
  type PullRequestUnifiedPreviewLine,
} from "./pullRequestDiffPreviewModel";
import {
  buildPullRequestFullFilePreview,
  splitPullRequestFileContents,
} from "./pullRequestFullFilePreview";
import { PullRequestReviewToolbar } from "./PullRequestReviewToolbar";

type PullRequestCodeReviewPaneProps = {
  codeReviewError: string | null;
  commentAttachments: PullRequestCommentAttachment[];
  cwd: string | null;
  detailKey: string;
  diffFiles: PullRequestDiffFile[];
  hostId: string | null;
  isCodeReviewLoading: boolean;
  onCopyGitApplyCommand: (() => void | Promise<void>) | null;
  onRefreshCodeReview: () => void;
  onOpenCommentUrl: (url: string) => void | Promise<void>;
};

type FileTreeNode = FileTreeDirectoryNode | FileTreeFileNode;

type FileTreeDirectoryNode = {
  kind: "directory";
  name: string;
  path: string;
  children: FileTreeNode[];
};

type FileTreeFileNode = {
  kind: "file";
  name: string;
  filePath: string;
};

type MutableFileTreeDirectoryNode = {
  kind: "directory";
  name: string;
  path: string;
  children: Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>;
};

type FullFileContentState =
  | {
      status: "idle" | "loading";
    }
  | {
      status: "loaded";
      newLines: string[];
      oldLines: string[];
    }
  | {
      status: "error";
    }

export function PullRequestCodeReviewPane({
  codeReviewError,
  commentAttachments,
  cwd,
  detailKey,
  diffFiles,
  hostId,
  isCodeReviewLoading,
  onCopyGitApplyCommand,
  onRefreshCodeReview,
  onOpenCommentUrl,
}: PullRequestCodeReviewPaneProps) {
  const { t } = useI18n();
  const [activeFilePath, setActiveFilePath] = useState<string | null>(diffFiles[0]?.path ?? null);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(() => new Set());
  const [isAllDiffsExpanded, setIsAllDiffsExpanded] = useState(true);
  const [isRichPreviewEnabled, setIsRichPreviewEnabled] = useState(true);
  const [isSplitDiffEnabled, setIsSplitDiffEnabled] = useState(false);
  const [isLoadFullFilesEnabled, setIsLoadFullFilesEnabled] = useState(false);
  const [isWordDiffsEnabled, setIsWordDiffsEnabled] = useState(false);
  const [isWhitespaceHidden, setIsWhitespaceHidden] = useState(false);
  const [isWrapEnabled, setIsWrapEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullFileContentByPath, setFullFileContentByPath] = useState<Record<string, FullFileContentState>>({});
  const fileCardRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fullFileLoadGenerationRef = useRef(0);
  const fullFileContentByPathRef = useRef(fullFileContentByPath);

  const allDirectoryPaths = useMemo(() => collectDirectoryPaths(diffFiles), [diffFiles]);
  const visibleTreeFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return diffFiles;
    }

    return diffFiles.filter((file) => normalizeDiffPath(file.path).toLowerCase().includes(normalizedQuery));
  }, [diffFiles, searchQuery]);
  const visibleTreeDirectories = useMemo(() => collectDirectoryPaths(visibleTreeFiles), [visibleTreeFiles]);
  const treeNodes = useMemo(() => buildFileTree(visibleTreeFiles), [visibleTreeFiles]);
  const attachmentsByPath = useMemo(() => groupAttachmentsByPath(commentAttachments), [commentAttachments]);
  const fileTreeSelectionPath = activeFilePath == null ? null : normalizeDiffPath(activeFilePath);
  const effectiveExpandedDirectories = searchQuery.trim().length > 0 ? new Set(visibleTreeDirectories) : expandedDirectories;

  useEffect(() => {
    fullFileLoadGenerationRef.current += 1;
    setActiveFilePath(diffFiles[0]?.path ?? null);
    setIsAllDiffsExpanded(true);
    setIsLoadFullFilesEnabled(false);
    setIsRichPreviewEnabled(true);
    setIsSplitDiffEnabled(false);
    setIsWordDiffsEnabled(false);
    setIsWhitespaceHidden(false);
    setIsWrapEnabled(true);
    setSearchQuery("");
    setExpandedDirectories(new Set());
    setFullFileContentByPath({});
  }, [detailKey]);

  useEffect(() => {
    fullFileLoadGenerationRef.current += 1;
    setFullFileContentByPath({});
  }, [diffFiles]);

  useEffect(() => {
    fullFileContentByPathRef.current = fullFileContentByPath;
  }, [fullFileContentByPath]);

  useEffect(() => {
    setExpandedDirectories((current) => {
      const next = current.size === 0 ? new Set(allDirectoryPaths) : new Set(current);
      for (const directoryPath of allDirectoryPaths) {
        next.add(directoryPath);
      }
      return next;
    });
  }, [allDirectoryPaths]);

  useEffect(() => {
    if (diffFiles.length === 0) {
      setActiveFilePath(null);
      return;
    }

    setActiveFilePath((current) => {
      if (current != null && diffFiles.some((file) => file.path === current)) {
        return current;
      }
      return diffFiles[0].path;
    });
  }, [diffFiles]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (root == null || diffFiles.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => {
            if (right.intersectionRatio !== left.intersectionRatio) {
              return right.intersectionRatio - left.intersectionRatio;
            }

            return Math.abs(left.boundingClientRect.top - root.getBoundingClientRect().top)
              - Math.abs(right.boundingClientRect.top - root.getBoundingClientRect().top);
          });
        const nextPath = visibleEntries[0]?.target.getAttribute("data-file-path");
        if (nextPath == null) {
          return;
        }

        setActiveFilePath((current) => (current === nextPath ? current : nextPath));
      },
      {
        root,
        rootMargin: "-18% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.6, 0.85],
      },
    );

    for (const card of fileCardRefs.current.values()) {
      observer.observe(card);
    }

    return () => {
      observer.disconnect();
    };
  }, [diffFiles]);

  const registerFileCardRef = (path: string) => (node: HTMLDivElement | null) => {
    if (node == null) {
      fileCardRefs.current.delete(path);
      return;
    }

    fileCardRefs.current.set(path, node);
  };

  const scrollToFile = (path: string) => {
    setActiveFilePath(path);
    fileCardRefs.current.get(path)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const loadFullFile = useCallback(async (file: PullRequestDiffFile, options?: { retry?: boolean }) => {
    if (!isLoadFullFilesEnabled || cwd == null || file.isBinary) {
      return;
    }
    if (file.oldObjectId == null && file.newObjectId == null) {
      return;
    }

    const currentState = fullFileContentByPathRef.current[file.path];
    if (!options?.retry && currentState != null && currentState.status !== "idle") {
      return;
    }

    const generation = fullFileLoadGenerationRef.current;
    const loadingState: FullFileContentState = { status: "loading" };
    const errorState: FullFileContentState = { status: "error" };

    setFullFileContentByPath((current) => {
      const existing = current[file.path];
      if (!options?.retry && existing != null && existing.status !== "idle") {
        return current;
      }

      const next: Record<string, FullFileContentState> = {
        ...current,
        [file.path]: loadingState,
      };
      fullFileContentByPathRef.current = next;
      return next;
    });

    try {
      const [oldContentsResult, newContentsResult] = await Promise.all([
        file.oldObjectId == null
          ? null
          : readPullRequestFileContent({
              cwd,
              hostId,
              objectId: file.oldObjectId,
            }),
        file.newObjectId == null
          ? null
          : readPullRequestFileContent({
              cwd,
              hostId,
              objectId: file.newObjectId,
            }),
      ]);

      if (generation !== fullFileLoadGenerationRef.current) {
        return;
      }

      if (oldContentsResult?.status === "error" || newContentsResult?.status === "error") {
        setFullFileContentByPath((current) => {
          const next: Record<string, FullFileContentState> = {
            ...current,
            [file.path]: errorState,
          };
          fullFileContentByPathRef.current = next;
          return next;
        });
        return;
      }

      setFullFileContentByPath((current) => {
        const next: Record<string, FullFileContentState> = {
          ...current,
          [file.path]: {
            status: "loaded",
            oldLines:
              oldContentsResult == null
                ? []
                : splitPullRequestFileContents(oldContentsResult.contents),
            newLines:
              newContentsResult == null
                ? []
                : splitPullRequestFileContents(newContentsResult.contents),
          },
        };
        fullFileContentByPathRef.current = next;
        return next;
      });
    } catch {
      if (generation !== fullFileLoadGenerationRef.current) {
        return;
      }

      setFullFileContentByPath((current) => {
        const next: Record<string, FullFileContentState> = {
          ...current,
          [file.path]: errorState,
        };
        fullFileContentByPathRef.current = next;
        return next;
      });
    }
  }, [cwd, hostId, isLoadFullFilesEnabled]);

  const showLoadFullFiles = useMemo(
    () =>
      diffFiles.some(
        (file) => file.isPartial && !file.isBinary && (file.oldObjectId != null || file.newObjectId != null),
      ),
    [diffFiles],
  );

  useEffect(() => {
    if (!isLoadFullFilesEnabled || activeFilePath == null) {
      return;
    }

    const file = diffFiles.find((entry) => entry.path === activeFilePath);
    if (file == null) {
      return;
    }

    void loadFullFile(file);
  }, [activeFilePath, diffFiles, isLoadFullFilesEnabled, loadFullFile]);

  if (isCodeReviewLoading) {
    return (
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="app-card-muted rounded-[14px] px-4 py-10 text-center text-[13px] leading-6">
          {t("pullRequestsPage.detail.checks.loading")}
        </div>
      </div>
    );
  }

  if (codeReviewError) {
    return (
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="app-card-error rounded-[14px] px-4 py-3 text-[13px] leading-6">
          <div className="font-medium">{t("pullRequestsPage.codeReview.error")}</div>
          <div className="mt-2 break-words text-[12px] leading-5 opacity-80">{codeReviewError}</div>
        </div>
      </div>
    );
  }

  if (diffFiles.length === 0) {
    return (
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">
          <div className="font-medium">{t("codex.review.noDiff")}</div>
          <div className="mt-2 text-[12px] leading-5 opacity-80">{t("codex.review.noDiff.baseDescription")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
      <PullRequestReviewToolbar
        isAllDiffsExpanded={isAllDiffsExpanded}
        isLoadFullFilesEnabled={isLoadFullFilesEnabled}
        isRichPreviewEnabled={isRichPreviewEnabled}
        isSplitDiffEnabled={isSplitDiffEnabled}
        isWhitespaceHidden={isWhitespaceHidden}
        isWordDiffsEnabled={isWordDiffsEnabled}
        isWrapEnabled={isWrapEnabled}
        onCopyGitApplyCommand={onCopyGitApplyCommand}
        onRefreshCodeReview={onRefreshCodeReview}
        onToggleAllDiffsExpanded={() => setIsAllDiffsExpanded((value) => !value)}
        onToggleLoadFullFilesEnabled={() => setIsLoadFullFilesEnabled((value) => !value)}
        onToggleRichPreviewEnabled={() => setIsRichPreviewEnabled((value) => !value)}
        onToggleWhitespaceHidden={() => setIsWhitespaceHidden((value) => !value)}
        onToggleWordDiffsEnabled={() => setIsWordDiffsEnabled((value) => !value)}
        onToggleSplitDiffEnabled={() => setIsSplitDiffEnabled((value) => !value)}
        onToggleWrapEnabled={() => setIsWrapEnabled((value) => !value)}
        showLoadFullFiles={showLoadFullFiles}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <aside className="flex min-h-0 w-[240px] shrink-0 flex-col rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)]">
          <CodeReviewSearchInput query={searchQuery} onChange={setSearchQuery} />
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {visibleTreeFiles.length === 0 ? (
              <div className="px-2 py-2 text-left text-[13px] text-[var(--app-shell-muted)]">
                {t("codex.review.fileSearch.empty")}
              </div>
            ) : (
              <div className="px-2">
                <FileTreeNodes
                  activeFilePath={fileTreeSelectionPath}
                  depth={0}
                  expandedDirectories={effectiveExpandedDirectories}
                  nodes={treeNodes}
                  onSelectFile={scrollToFile}
                  onToggleDirectory={(directoryPath) => {
                    setExpandedDirectories((current) => {
                      const next = new Set(current);
                      if (next.has(directoryPath)) {
                        next.delete(directoryPath);
                      } else {
                        next.add(directoryPath);
                      }
                      return next;
                    });
                  }}
                />
              </div>
            )}
          </div>
        </aside>

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            {diffFiles.map((file) => (
              <div
                key={file.path}
                ref={registerFileCardRef(file.path)}
                data-file-path={file.path}
                className={[
                  "rounded-[14px] border px-4 py-3 transition-colors",
                  activeFilePath === file.path
                    ? "app-card border-[var(--app-shell-border-heavy)]"
                    : "app-card-muted border-[var(--app-shell-border)]",
                ].join(" ")}
                onClick={() => setActiveFilePath(file.path)}
              >
                {(() => {
                  const fullFileContentState = fullFileContentByPath[file.path] ?? { status: "idle" as const };
                  const fullFilePreview =
                    isLoadFullFilesEnabled && fullFileContentState.status === "loaded"
                      ? buildPullRequestFullFilePreview(
                          file,
                          fullFileContentState.oldLines,
                          fullFileContentState.newLines,
                          {
                            hideWhitespace: isWhitespaceHidden,
                            wordDiffsEnabled: isWordDiffsEnabled,
                          },
                        )
                      : null;

                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="app-title truncate text-[13px] font-medium">{file.path}</div>
                          <div className="app-text-muted mt-1 text-[12px] leading-5">
                            +{file.additions} / -{file.deletions}
                          </div>
                        </div>
                      </div>

                      {isLoadFullFilesEnabled && fullFileContentState.status === "error" ? (
                        <div className="app-card-error mt-3 rounded-[12px] px-4 py-3 text-[12px] leading-5">
                          <div className="flex items-center justify-between gap-3">
                            <span>{t("codex.review.diff.fullContentLoadFailed")}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void loadFullFile(file, { retry: true });
                              }}
                              className="app-control rounded-[10px] px-2 py-1 text-[12px]"
                            >
                              {t("codex.common.retry")}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {isAllDiffsExpanded ? (
                        <>
                          <div className="mt-3">
                            {fullFilePreview != null ? (
                              isSplitDiffEnabled ? (
                                <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
                                  {fullFilePreview.splitRows.map((row, index) =>
                                    renderSplitPreviewRow(file.path, row, index, isWrapEnabled),
                                  )}
                                </DiffPreviewShell>
                              ) : (
                                <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
                                  {fullFilePreview.unifiedLines.map((line, index) =>
                                    renderUnifiedPreviewLine(file.path, line, index, isWrapEnabled),
                                  )}
                                </DiffPreviewShell>
                              )
                            ) : isSplitDiffEnabled ? (
                              <SplitDiffPreview
                                file={file}
                                isWhitespaceHidden={isWhitespaceHidden}
                                isWordDiffsEnabled={isWordDiffsEnabled}
                                isWrapEnabled={isWrapEnabled}
                              />
                            ) : isRichPreviewEnabled ? (
                              <RichDiffPreview
                                file={file}
                                isWhitespaceHidden={isWhitespaceHidden}
                                isWordDiffsEnabled={isWordDiffsEnabled}
                                isWrapEnabled={isWrapEnabled}
                              />
                            ) : (
                              <pre
                                className={[
                                  "app-code-block overflow-x-auto rounded-[12px] px-4 py-3 text-[12px] leading-6",
                                  isWrapEnabled ? "whitespace-pre-wrap" : "whitespace-pre",
                                ].join(" ")}
                              >
                                <code>{file.patch}</code>
                              </pre>
                            )}
                          </div>

                          {(attachmentsByPath.get(file.path) ?? []).length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {(attachmentsByPath.get(file.path) ?? []).map((attachment) => (
                                <CodeReviewAttachmentCard
                                  key={attachmentKey(attachment)}
                                  attachment={attachment}
                                  onOpenCommentUrl={onOpenCommentUrl}
                                />
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeReviewSearchInput({
  onChange,
  query,
}: {
  onChange: (value: string) => void;
  query: string;
}) {
  const { t } = useI18n();

  return (
    <div className="shrink-0 px-2 pt-2 pb-px">
      <div className="relative flex h-9 w-full items-center gap-1.5 rounded-lg border border-[var(--app-shell-border)] bg-[color:var(--app-shell-muted-surface)] text-[13px] leading-[18px]">
        <label htmlFor="pull-request-review-file-tree-search" className="sr-only">
          {t("codex.fileTreeSearch.label")}
        </label>
        <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
        <input
          id="pull-request-review-file-tree-search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("codex.fileTreeSearch.placeholder")}
          className="w-full appearance-none border-none bg-transparent py-0 pl-0 pr-1.5 text-[var(--app-shell-text)] outline-none placeholder:text-[var(--app-shell-muted)]"
          type="text"
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label={t("codex.fileTreeSearch.clear")}
            onClick={() => onChange("")}
            className="mr-1 flex h-7 w-7 items-center justify-center text-[var(--app-shell-muted)] hover:text-[var(--app-shell-text)]"
          >
            <SearchClearIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FileTreeNodes({
  activeFilePath,
  depth,
  expandedDirectories,
  nodes,
  onSelectFile,
  onToggleDirectory,
}: {
  activeFilePath: string | null;
  depth: number;
  expandedDirectories: Set<string>;
  nodes: FileTreeNode[];
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5 py-2">
      {nodes.map((node) =>
        node.kind === "directory" ? (
          <div key={`dir:${node.path}`}>
            <button
              type="button"
              onClick={() => onToggleDirectory(node.path)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]"
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              <ChevronDownIcon
                className={[
                  "h-4 w-4 shrink-0 text-[var(--app-shell-muted)] transition-transform",
                  expandedDirectories.has(node.path) ? "rotate-0" : "-rotate-90",
                ].join(" ")}
              />
              <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
              <span className="truncate">{node.name}</span>
            </button>
            {expandedDirectories.has(node.path) ? (
              <FileTreeNodes
                activeFilePath={activeFilePath}
                depth={depth + 1}
                expandedDirectories={expandedDirectories}
                nodes={node.children}
                onSelectFile={onSelectFile}
                onToggleDirectory={onToggleDirectory}
              />
            ) : null}
          </div>
        ) : (
          <button
            key={`file:${node.filePath}`}
            type="button"
            onClick={() => onSelectFile(node.filePath)}
            className={[
              "flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]",
              activeFilePath === normalizeDiffPath(node.filePath) ? "app-nav-item-active" : "app-nav-item-idle",
            ].join(" ")}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
            <span className="truncate">{node.name}</span>
          </button>
        ),
      )}
    </div>
  );
}

function RichDiffPreview({
  file,
  isWhitespaceHidden,
  isWordDiffsEnabled,
  isWrapEnabled,
}: {
  file: PullRequestDiffFile;
  isWhitespaceHidden: boolean;
  isWordDiffsEnabled: boolean;
  isWrapEnabled: boolean;
}) {
  const lines = useMemo(
    () =>
      buildPullRequestUnifiedPreviewLines(file.patch, {
        hideWhitespace: isWhitespaceHidden,
        wordDiffsEnabled: isWordDiffsEnabled,
      }),
    [file.patch, isWhitespaceHidden, isWordDiffsEnabled],
  );

  return (
    <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
      {lines.map((line, index) => renderUnifiedPreviewLine(file.path, line, index, isWrapEnabled))}
    </DiffPreviewShell>
  );
}

function SplitDiffPreview({
  file,
  isWhitespaceHidden,
  isWordDiffsEnabled,
  isWrapEnabled,
}: {
  file: PullRequestDiffFile;
  isWhitespaceHidden: boolean;
  isWordDiffsEnabled: boolean;
  isWrapEnabled: boolean;
}) {
  const rows = useMemo(
    () =>
      buildPullRequestSplitPreviewRows(file.patch, {
        hideWhitespace: isWhitespaceHidden,
        wordDiffsEnabled: isWordDiffsEnabled,
      }),
    [file.patch, isWhitespaceHidden, isWordDiffsEnabled],
  );

  return (
    <DiffPreviewShell isWrapEnabled={isWrapEnabled}>
      {rows.map((row, index) => renderSplitPreviewRow(file.path, row, index, isWrapEnabled))}
    </DiffPreviewShell>
  );
}

function DiffPreviewShell({
  children,
  isWrapEnabled,
}: {
  children: ReactNode;
  isWrapEnabled: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)]">
      <div className={["font-mono text-[12px] leading-6", isWrapEnabled ? "" : "min-w-max"].join(" ")}>
        {children}
      </div>
    </div>
  );
}

function renderUnifiedPreviewLine(
  filePath: string,
  line: PullRequestUnifiedPreviewLine,
  index: number,
  isWrapEnabled: boolean,
) {
  if (!("prefix" in line)) {
    return (
      <div key={`${filePath}:u:${index}`} className={["px-4 py-0.5", unifiedPreviewLineClassName(line.kind)].join(" ")}>
        {line.text}
      </div>
    );
  }

  return (
    <div
      key={`${filePath}:u:${index}`}
      className={[
        "px-4 py-0.5",
        isWrapEnabled ? "whitespace-pre-wrap break-all" : "whitespace-pre",
        unifiedPreviewLineClassName(line.kind),
      ].join(" ")}
    >
      <span className="select-none">{line.prefix === " " ? "\u00a0" : line.prefix}</span>
      {renderPreviewFragments(line.fragments, line.kind, isWrapEnabled)}
    </div>
  );
}

function renderSplitPreviewRow(
  filePath: string,
  row: PullRequestSplitPreviewRow,
  index: number,
  isWrapEnabled: boolean,
) {
  if (!("leftFragments" in row)) {
    return (
      <div key={`${filePath}:s:${index}`} className={["border-b border-[var(--app-shell-border)] px-4 py-0.5", splitPreviewRowClassName(row.kind)].join(" ")}>
        {row.text}
      </div>
    );
  }

  const leftCellClassName = splitPreviewCellClassName(row.kind, "left");
  const rightCellClassName = splitPreviewCellClassName(row.kind, "right");

  return (
    <div
      key={`${filePath}:s:${index}`}
      className={[
        "grid grid-cols-2 border-b border-[var(--app-shell-border)]",
        isWrapEnabled ? "whitespace-pre-wrap" : "whitespace-pre",
      ].join(" ")}
    >
      <div className={["min-w-0 border-r border-[var(--app-shell-border)] px-4 py-0.5", leftCellClassName].join(" ")}>
        {renderPreviewCell(row.leftFragments, row.leftText, row.kind, "left", isWrapEnabled)}
      </div>
      <div className={["min-w-0 px-4 py-0.5", rightCellClassName].join(" ")}>
        {renderPreviewCell(row.rightFragments, row.rightText, row.kind, "right", isWrapEnabled)}
      </div>
    </div>
  );
}

function renderPreviewCell(
  fragments: PullRequestDiffFragment[],
  text: string | null,
  rowKind: PullRequestSplitPreviewRow["kind"],
  side: "left" | "right",
  isWrapEnabled: boolean,
) {
  if (text == null) {
    return <span className="text-[var(--app-shell-muted)]">&nbsp;</span>;
  }

  return (
    <span className={isWrapEnabled ? "whitespace-pre-wrap break-all" : "whitespace-pre"}>
      {renderPreviewFragments(fragments, rowKind, isWrapEnabled, side)}
    </span>
  );
}

function renderPreviewFragments(
  fragments: PullRequestDiffFragment[],
  lineKind: PullRequestUnifiedPreviewLine["kind"] | PullRequestSplitPreviewRow["kind"],
  isWrapEnabled: boolean,
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
          isWrapEnabled ? "whitespace-pre-wrap" : "whitespace-pre",
          fragmentHighlightClassName(lineKind, side),
        ].join(" ")}
      >
        {fragment.text}
      </span>
    );
  });
}

function unifiedPreviewLineClassName(kind: PullRequestUnifiedPreviewLine["kind"]) {
  if (kind === "hunk") {
    return "border-b border-[var(--app-shell-border)] bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (kind === "addition") {
    return "border-b border-[var(--app-shell-border)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return "border-b border-[var(--app-shell-border)] bg-red-500/10 text-red-700 dark:text-red-300";
  }

  if (kind === "context") {
    return "border-b border-[var(--app-shell-border)] text-[var(--app-shell-text)]";
  }

  return "border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]";
}

function splitPreviewRowClassName(kind: PullRequestSplitPreviewRow["kind"]) {
  if (kind === "hunk") {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  return "bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-subtle)]";
}

function splitPreviewCellClassName(kind: PullRequestSplitPreviewRow["kind"], side: "left" | "right") {
  if (kind === "context") {
    return "text-[var(--app-shell-text)]";
  }

  if (kind === "paired") {
    return side === "left"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (kind === "deletion") {
    return side === "left" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "text-[var(--app-shell-muted)]";
  }

  if (kind === "addition") {
    return side === "right" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-[var(--app-shell-muted)]";
  }

  return "text-[var(--app-shell-text)]";
}

function fragmentHighlightClassName(
  lineKind: PullRequestUnifiedPreviewLine["kind"] | PullRequestSplitPreviewRow["kind"],
  side?: "left" | "right",
) {
  if (lineKind === "deletion" || (lineKind === "paired" && side === "left")) {
    return "bg-red-500/20";
  }

  if (lineKind === "addition" || (lineKind === "paired" && side === "right")) {
    return "bg-emerald-500/20";
  }

  return "";
}

function CodeReviewAttachmentCard({
  attachment,
  onOpenCommentUrl,
}: {
  attachment: PullRequestCommentAttachment;
  onOpenCommentUrl: (url: string) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const authorLogin = attachment.authorLogin?.trim().length
    ? attachment.authorLogin
    : t("pullRequestsPage.codeReview.githubCommentAuthor");

  return (
    <div className="app-card rounded-[12px] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AttachmentAvatar authorLogin={authorLogin} avatarUrl={attachment.authorAvatarUrl} />
          <div className="min-w-0">
            <div className="app-title truncate text-[13px] font-medium">{authorLogin}</div>
            <div className="app-text-muted mt-1 text-[12px] leading-5">
              {attachment.path}
              {attachment.line != null ? `:${attachment.line}` : ""}
            </div>
          </div>
        </div>
        {attachment.url ? (
          <button
            type="button"
            onClick={() => void onOpenCommentUrl(attachment.url ?? "")}
            className="app-text-muted shrink-0 text-[12px] hover:underline"
          >
            {t("pullRequestsPage.detail.viewCommentOnGitHub")}
          </button>
        ) : null}
      </div>
      <div className="mt-3">{renderMessageContent(attachment.body)}</div>
    </div>
  );
}

function AttachmentAvatar({
  authorLogin,
  avatarUrl,
}: {
  authorLogin: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={authorLogin} className="size-7 shrink-0 rounded-full object-cover" />;
  }

  return (
    <div className="app-card-muted flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
      {authorLogin.slice(0, 1).toUpperCase()}
    </div>
  );
}

function groupAttachmentsByPath(commentAttachments: PullRequestCommentAttachment[]) {
  const groupedAttachments = new Map<string, PullRequestCommentAttachment[]>();

  for (const attachment of commentAttachments) {
    const entry = groupedAttachments.get(attachment.path);
    if (entry) {
      entry.push(attachment);
      continue;
    }

    groupedAttachments.set(attachment.path, [attachment]);
  }

  return groupedAttachments;
}

function collectDirectoryPaths(diffFiles: PullRequestDiffFile[]) {
  const directoryPaths = new Set<string>();

  for (const file of diffFiles) {
    const segments = normalizeDiffPath(file.path)
      .split("/")
      .filter((segment) => segment.length > 0);
    for (let index = 1; index < segments.length; index += 1) {
      directoryPaths.add(segments.slice(0, index).join("/"));
    }
  }

  return Array.from(directoryPaths).sort((left, right) => left.localeCompare(right));
}

function buildFileTree(diffFiles: PullRequestDiffFile[]): FileTreeNode[] {
  const root = new Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>();

  for (const file of diffFiles) {
    const normalizedPath = normalizeDiffPath(file.path);
    const segments = normalizedPath.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      continue;
    }

    let currentChildren = root;
    let directoryPath = "";

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const isFileSegment = index === segments.length - 1;

      if (isFileSegment) {
        currentChildren.set(`file:${normalizedPath}`, {
          kind: "file",
          name: segment,
          filePath: file.path,
        });
        continue;
      }

      directoryPath = directoryPath.length > 0 ? `${directoryPath}/${segment}` : segment;
      const directoryKey = `dir:${directoryPath}`;
      const existingNode = currentChildren.get(directoryKey);
      if (existingNode && existingNode.kind === "directory") {
        currentChildren = existingNode.children;
        continue;
      }

      const nextDirectory: MutableFileTreeDirectoryNode = {
        kind: "directory",
        name: segment,
        path: directoryPath,
        children: new Map(),
      };
      currentChildren.set(directoryKey, nextDirectory);
      currentChildren = nextDirectory.children;
    }
  }

  return finalizeTreeNodes(root);
}

function finalizeTreeNodes(
  nodes: Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>,
): FileTreeNode[] {
  return Array.from(nodes.values())
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }

      const leftName = left.kind === "directory" ? left.name : left.name;
      const rightName = right.kind === "directory" ? right.name : right.name;
      return leftName.localeCompare(rightName);
    })
    .map((node) =>
      node.kind === "directory"
        ? {
            kind: "directory",
            name: node.name,
            path: node.path,
            children: finalizeTreeNodes(node.children),
          }
        : node,
    );
}

function normalizeDiffPath(path: string) {
  return path.replaceAll("\\", "/");
}

function attachmentKey(attachment: PullRequestCommentAttachment) {
  return `${attachment.path}:${attachment.line ?? 0}:${attachment.createdAt ?? ""}:${attachment.url ?? ""}`;
}
