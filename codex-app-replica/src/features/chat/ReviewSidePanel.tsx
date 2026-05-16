import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  CollapseAllDiffsIcon,
  CopyPathIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  ExpandAllDiffsIcon,
  MoreActionsIcon,
  OpenFilesIcon,
  RefreshIcon,
  RichPreviewDisabledIcon,
  RichPreviewEnabledIcon,
  SplitterGripIcon,
  WrapDisabledIcon,
  WrapEnabledIcon,
  WordDiffsDisabledIcon,
  WordDiffsEnabledIcon,
  WhitespaceIcon,
} from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";
import { ReviewGitActions } from "./ReviewGitActions";
import { countFileChangeDiffLines, type ThreadDiffSummary } from "./threadConversationState";
import { ReviewChangedFilesTreePane } from "./ReviewChangedFilesTreePane";
import { ReviewEmptyState } from "./ReviewEmptyState";

type ReviewSidePanelProps = {
  defaultOptionsMenuOpen?: boolean;
  gitInitCwd?: string | null;
  gitRoot?: string | null;
  hostId?: string | null;
  onShowToast?: (toast: AppToast) => void;
  showGitRepoRequired?: boolean;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

type ReviewDiffMode = "split" | "unified";

const REVIEW_CHANGED_FILES_PANE_MIN_WIDTH = 200;
const REVIEW_CHANGED_FILES_PANE_DEFAULT_WIDTH = 220;
const REVIEW_CHANGED_FILES_PANE_MAX_WIDTH_RATIO = 0.6;

export function ReviewSidePanel({
  defaultOptionsMenuOpen = false,
  gitInitCwd = null,
  gitRoot = null,
  hostId = null,
  onShowToast,
  showGitRepoRequired = false,
  onOpenReviewFile,
  t,
  threadDiffSummary,
}: ReviewSidePanelProps) {
  const [wrap, setWrap] = useState(false);
  const [diffMode, setDiffMode] = useState<ReviewDiffMode>("unified");
  const [loadFullFilesEnabled, setLoadFullFilesEnabled] = useState(true);
  const [richPreviewEnabled, setRichPreviewEnabled] = useState(true);
  const [wordDiffsEnabled, setWordDiffsEnabled] = useState(false);
  const [hideWhitespace, setHideWhitespace] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedApplyCommand, setCopiedApplyCommand] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(defaultOptionsMenuOpen);
  const [isChangedFilesPaneOpen, setIsChangedFilesPaneOpen] = useState(true);
  const [changedFilesPaneWidth, setChangedFilesPaneWidth] = useState(
    REVIEW_CHANGED_FILES_PANE_DEFAULT_WIDTH,
  );
  const [isChangedFilesPaneResizing, setIsChangedFilesPaneResizing] = useState(false);
  const [activeReviewPath, setActiveReviewPath] = useState<string | null>(
    threadDiffSummary.files[0]?.path ?? null,
  );
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const fileCardRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const changedFilesPaneRef = useRef<HTMLDivElement | null>(null);
  const fileKeys = useMemo(
    () => threadDiffSummary.files.map((file, index) => buildReviewFileKey(file, index)),
    [threadDiffSummary.files],
  );
  const gitApplyCommand = useMemo(
    () => buildGitApplyCommand(threadDiffSummary.files),
    [threadDiffSummary.files],
  );
  const [expandedFileKeys, setExpandedFileKeys] = useState<Set<string>>(() => new Set(fileKeys));
  const isAllExpanded = fileKeys.length > 0 && expandedFileKeys.size === fileKeys.length;

  useEffect(() => {
    setExpandedFileKeys(new Set(fileKeys));
  }, [fileKeys]);

  useEffect(() => {
    setActiveReviewPath((current) => {
      if (current != null && threadDiffSummary.files.some((file) => file.path === current)) {
        return current;
      }
      return threadDiffSummary.files[0]?.path ?? null;
    });
  }, [threadDiffSummary.files]);

  useEffect(() => {
    if (!isOptionsMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (optionsMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOptionsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOptionsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOptionsMenuOpen]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 500);
  };

  const registerFileCardRef = (path: string) => (node: HTMLDivElement | null) => {
    if (node == null) {
      fileCardRefs.current.delete(path);
      return;
    }

    fileCardRefs.current.set(path, node);
  };

  const scrollToReviewPath = (path: string) => {
    if (!threadDiffSummary.files.some((file) => file.path === path)) {
      return;
    }

    setActiveReviewPath(path);
    requestAnimationFrame(() => {
      fileCardRefs.current.get(path)?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });
  };

  const clampChangedFilesPaneWidth = (width: number) => {
    const parentWidth =
      changedFilesPaneRef.current?.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(
      REVIEW_CHANGED_FILES_PANE_MIN_WIDTH,
      parentWidth * REVIEW_CHANGED_FILES_PANE_MAX_WIDTH_RATIO,
    );
    return Math.min(Math.max(width, REVIEW_CHANGED_FILES_PANE_MIN_WIDTH), maxWidth);
  };

  const handleChangedFilesPaneResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isChangedFilesPaneOpen || event.button !== 0) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const nextTarget = event.currentTarget;
    nextTarget.setPointerCapture(pointerId);
    setIsChangedFilesPaneResizing(true);

    const updateWidth = (clientX: number) => {
      const rightEdge =
        changedFilesPaneRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      const nextWidth = rightEdge - clientX;
      if (nextWidth < REVIEW_CHANGED_FILES_PANE_MIN_WIDTH) {
        setIsChangedFilesPaneOpen(false);
        return;
      }

      setChangedFilesPaneWidth(clampChangedFilesPaneWidth(nextWidth));
    };

    updateWidth(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateWidth(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      setIsChangedFilesPaneResizing(false);
      nextTarget.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (root == null || threadDiffSummary.files.length === 0) {
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
        const nextPath = visibleEntries[0]?.target.getAttribute("data-review-path");
        if (nextPath == null) {
          return;
        }

        setActiveReviewPath((current) => (current === nextPath ? current : nextPath));
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
  }, [threadDiffSummary.files]);

  if (!threadDiffSummary.hasChanges) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewHeaderToolbar
          copyGitApplyCommandDisabled
          diffMode={diffMode}
          gitActions={
            gitRoot ? <ReviewGitActions gitRoot={gitRoot} hostId={hostId} t={t} /> : null
          }
          hideWhitespace={hideWhitespace}
          isAllExpanded={false}
          isChangedFilesPaneOpen={isChangedFilesPaneOpen}
          isOptionsMenuOpen={isOptionsMenuOpen}
          isRefreshing={isRefreshing}
          loadFullFilesEnabled={loadFullFilesEnabled}
          onClickCopyGitApplyCommand={null}
          onHandleRefresh={handleRefresh}
          onToggleChangedFilesPane={() => setIsChangedFilesPaneOpen((current) => !current)}
          onToggleDiffMode={() =>
            setDiffMode((current) => (current === "unified" ? "split" : "unified"))
          }
          onToggleExpanded={() => undefined}
          onToggleHideWhitespace={() => setHideWhitespace((current) => !current)}
          onToggleLoadFullFiles={() => setLoadFullFilesEnabled((current) => !current)}
          onToggleOptionsMenu={() => setIsOptionsMenuOpen((current) => !current)}
          onToggleRichPreview={() => setRichPreviewEnabled((current) => !current)}
          onToggleWordDiffs={() => setWordDiffsEnabled((current) => !current)}
          onToggleWrap={() => setWrap((current) => !current)}
          optionsMenuRef={optionsMenuRef}
          richPreviewEnabled={richPreviewEnabled}
          showCopyGitApplyCommand
          summary={
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <div className="app-title truncate text-[13px] font-medium text-[var(--app-shell-text)]">
                {t("thread.sidePanel.diffTab")}
              </div>
              <div className="app-text-muted flex min-w-0 items-center gap-2 overflow-hidden text-[11px]">
                <span className="truncate">{t("app.chat.filesChanged", { fileCount: 0 })}</span>
              </div>
            </div>
          }
          t={t}
          wordDiffsEnabled={wordDiffsEnabled}
          wrap={wrap}
        />
        <ReviewEmptyState
          gitInitCwd={gitInitCwd}
          hasLastTurnDiff={false}
          hostId={hostId}
          onShowToast={onShowToast}
          showGitRepoRequired={showGitRepoRequired}
          t={t}
        />
      </div>
    );
  }

  const handleCopyGitApplyCommand = async () => {
    if (gitApplyCommand.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(gitApplyCommand);
      setCopiedApplyCommand(true);
      window.setTimeout(() => setCopiedApplyCommand(false), 1600);
    } finally {
      setIsOptionsMenuOpen(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewHeaderToolbar
        copyGitApplyCommandDisabled={gitApplyCommand.length === 0}
        diffMode={diffMode}
        gitActions={
          gitRoot ? <ReviewGitActions gitRoot={gitRoot} hostId={hostId} t={t} /> : null
        }
        hideWhitespace={hideWhitespace}
        isAllExpanded={isAllExpanded}
        isChangedFilesPaneOpen={isChangedFilesPaneOpen}
        isOptionsMenuOpen={isOptionsMenuOpen}
        isRefreshing={isRefreshing}
        loadFullFilesEnabled={loadFullFilesEnabled}
        onClickCopyGitApplyCommand={
          gitApplyCommand.length === 0 ? null : () => void handleCopyGitApplyCommand()
        }
        onHandleRefresh={handleRefresh}
        onToggleChangedFilesPane={() => setIsChangedFilesPaneOpen((current) => !current)}
        onToggleDiffMode={() =>
          setDiffMode((current) => (current === "unified" ? "split" : "unified"))
        }
        onToggleExpanded={() =>
          setExpandedFileKeys(isAllExpanded ? new Set<string>() : new Set(fileKeys))
        }
        onToggleHideWhitespace={() => setHideWhitespace((current) => !current)}
        onToggleLoadFullFiles={() => setLoadFullFilesEnabled((current) => !current)}
        onToggleOptionsMenu={() => setIsOptionsMenuOpen((current) => !current)}
        onToggleRichPreview={() => setRichPreviewEnabled((current) => !current)}
        onToggleWordDiffs={() => setWordDiffsEnabled((current) => !current)}
        onToggleWrap={() => setWrap((current) => !current)}
        optionsMenuRef={optionsMenuRef}
        richPreviewEnabled={richPreviewEnabled}
        showCopyGitApplyCommand
        summary={
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="app-title truncate text-[13px] font-medium text-[var(--app-shell-text)]">
              {t("thread.sidePanel.diffTab")}
            </div>
            <div className="app-text-muted flex min-w-0 items-center gap-2 overflow-hidden text-[11px]">
              <span className="truncate">
                {t("app.chat.filesChanged", { fileCount: threadDiffSummary.fileCount })}
              </span>
              <span className="shrink-0 text-[#21a05b]">+{threadDiffSummary.linesAdded}</span>
              <span className="shrink-0 text-[#c3564e]">-{threadDiffSummary.linesDeleted}</span>
            </div>
          </div>
        }
        t={t}
        wordDiffsEnabled={wordDiffsEnabled}
        wrap={wrap}
      />

      {copiedApplyCommand ? (
        <div className="border-b border-[var(--app-shell-border)] px-3 py-2 text-[11px] text-[var(--app-shell-muted)]">
          {t("codex.review.copyGitApplyCommand.toast")}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-3"
        >
          <div className="space-y-2">
            {threadDiffSummary.files.map((file, index) => {
              const fileKey = buildReviewFileKey(file, index);
              return (
                <ReviewFileCard
                  key={fileKey}
                  change={file}
                  diffMode={diffMode}
                  fileKey={fileKey}
                  hideWhitespace={hideWhitespace}
                  isActive={activeReviewPath === file.path}
                  isExpanded={expandedFileKeys.has(fileKey)}
                  loadFullFilesEnabled={loadFullFilesEnabled}
                  onOpenReviewFile={onOpenReviewFile}
                  onSelectReviewPath={setActiveReviewPath}
                  onToggleExpanded={() =>
                    setExpandedFileKeys((current) => {
                      const next = new Set(current);
                      if (next.has(fileKey)) {
                        next.delete(fileKey);
                      } else {
                        next.add(fileKey);
                      }
                      return next;
                    })
                  }
                  richPreviewEnabled={richPreviewEnabled}
                  reviewCardRef={registerFileCardRef(file.path)}
                  t={t}
                  wordDiffsEnabled={wordDiffsEnabled}
                  wrap={wrap}
                />
              );
            })}
          </div>
        </div>
        {isChangedFilesPaneOpen ? (
          <div
            ref={changedFilesPaneRef}
            className="relative flex h-full shrink-0 border-l border-[var(--app-shell-border)]"
            style={{
              width: `${changedFilesPaneWidth}px`,
              maxWidth: `${REVIEW_CHANGED_FILES_PANE_MAX_WIDTH_RATIO * 100}%`,
            }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={handleChangedFilesPaneResizePointerDown}
              className={[
                "group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-transparent",
                isChangedFilesPaneResizing
                  ? "app-right-panel-splitter-active"
                  : "app-right-panel-splitter",
              ].join(" ")}
            >
              <div className="app-right-panel-splitter-line h-full w-px" />
              <div className="app-right-panel-splitter-grip pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full">
                <SplitterGripIcon className="h-4 w-4" />
              </div>
            </div>
            <aside className="flex min-w-0 flex-1 flex-col bg-[color:var(--app-shell-right)]">
              <ReviewChangedFilesTreePane
                activePath={activeReviewPath}
                files={threadDiffSummary.files}
                onSelectPath={scrollToReviewPath}
                t={t}
              />
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewHeaderToolbar({
  copyGitApplyCommandDisabled,
  diffMode,
  gitActions,
  hideWhitespace,
  isAllExpanded,
  isChangedFilesPaneOpen,
  isOptionsMenuOpen,
  isRefreshing,
  loadFullFilesEnabled,
  onClickCopyGitApplyCommand,
  onHandleRefresh,
  onToggleChangedFilesPane,
  onToggleDiffMode,
  onToggleExpanded,
  onToggleHideWhitespace,
  onToggleLoadFullFiles,
  onToggleOptionsMenu,
  onToggleRichPreview,
  onToggleWordDiffs,
  onToggleWrap,
  optionsMenuRef,
  richPreviewEnabled,
  showCopyGitApplyCommand,
  summary,
  t,
  wordDiffsEnabled,
  wrap,
}: {
  copyGitApplyCommandDisabled: boolean;
  diffMode: ReviewDiffMode;
  gitActions?: ReactNode;
  hideWhitespace: boolean;
  isAllExpanded: boolean;
  isChangedFilesPaneOpen: boolean;
  isOptionsMenuOpen: boolean;
  isRefreshing: boolean;
  loadFullFilesEnabled: boolean;
  onClickCopyGitApplyCommand: (() => void) | null;
  onHandleRefresh: () => void;
  onToggleChangedFilesPane: () => void;
  onToggleDiffMode: () => void;
  onToggleExpanded: () => void;
  onToggleHideWhitespace: () => void;
  onToggleLoadFullFiles: () => void;
  onToggleOptionsMenu: () => void;
  onToggleRichPreview: () => void;
  onToggleWordDiffs: () => void;
  onToggleWrap: () => void;
  optionsMenuRef: React.RefObject<HTMLDivElement | null>;
  richPreviewEnabled: boolean;
  showCopyGitApplyCommand: boolean;
  summary: ReactNode;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  wordDiffsEnabled: boolean;
  wrap: boolean;
}) {
  const reviewHeaderActions = (
    <div className="flex items-center gap-px">
      <div className="relative" ref={optionsMenuRef}>
        <ToolbarButton
          label={t("codex.review.header.moreOptions")}
          onClick={onToggleOptionsMenu}
          pressed={isOptionsMenuOpen}
        >
          <MoreActionsIcon className="h-4 w-4" />
        </ToolbarButton>
        {isOptionsMenuOpen ? (
          <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 min-w-[236px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <OptionsMenuButton
              icon={<OpenFilesIcon className="h-4 w-4" />}
              label={
                loadFullFilesEnabled
                  ? t("codex.review.loadFullFiles.disable")
                  : t("codex.review.loadFullFiles.enable")
              }
              onClick={() => {
                onToggleLoadFullFiles();
                onToggleOptionsMenu();
              }}
            />
            <OptionsMenuButton
              icon={
                richPreviewEnabled ? (
                  <RichPreviewEnabledIcon className="h-4 w-4" />
                ) : (
                  <RichPreviewDisabledIcon className="h-4 w-4" />
                )
              }
              label={
                richPreviewEnabled
                  ? t("codex.review.richPreview.disable")
                  : t("codex.review.richPreview.enable")
              }
              onClick={() => {
                onToggleRichPreview();
                onToggleOptionsMenu();
              }}
            />
            <OptionsMenuButton
              icon={
                wordDiffsEnabled ? (
                  <WordDiffsEnabledIcon className="h-4 w-4" />
                ) : (
                  <WordDiffsDisabledIcon className="h-4 w-4" />
                )
              }
              label={
                wordDiffsEnabled
                  ? t("codex.review.wordDiffs.disable")
                  : t("codex.review.wordDiffs.enable")
              }
              onClick={() => {
                onToggleWordDiffs();
                onToggleOptionsMenu();
              }}
            />
            <OptionsMenuButton
              icon={<WhitespaceIcon className="h-4 w-4" />}
              label={
                hideWhitespace
                  ? t("codex.review.whitespace.show")
                  : t("codex.review.whitespace.hide")
              }
              onClick={() => {
                onToggleHideWhitespace();
                onToggleOptionsMenu();
              }}
            />
            {showCopyGitApplyCommand ? (
              <OptionsMenuButton
                disabled={copyGitApplyCommandDisabled || onClickCopyGitApplyCommand == null}
                icon={<CopyPathIcon className="h-4 w-4" />}
                label={t("codex.review.copyGitApplyCommand")}
                onClick={onClickCopyGitApplyCommand}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <ToolbarButton label={t("codex.review.refreshGitQueries")} onClick={onHandleRefresh}>
        <RefreshIcon className={["h-4 w-4", isRefreshing ? "animate-spin" : ""].join(" ")} />
      </ToolbarButton>
      <ToolbarButton
        label={wrap ? t("codex.review.wrap.disable") : t("codex.review.wrap.enable")}
        onClick={onToggleWrap}
      >
        {wrap ? <WrapEnabledIcon className="h-4 w-4" /> : <WrapDisabledIcon className="h-4 w-4" />}
      </ToolbarButton>
      <ToolbarButton
        label={
          isAllExpanded
            ? t("codex.review.expandOrCollapseDiffMenu.collapse")
            : t("codex.review.expandOrCollapseDiffMenu.expand")
        }
        onClick={onToggleExpanded}
      >
        {isAllExpanded ? (
          <CollapseAllDiffsIcon className="h-4 w-4" />
        ) : (
          <ExpandAllDiffsIcon className="h-4 w-4" />
        )}
      </ToolbarButton>
      <ToolbarButton
        label={
          diffMode === "unified"
            ? t("codex.review.switchToSplit")
            : t("codex.review.switchToUnified")
        }
        onClick={onToggleDiffMode}
      >
        {diffMode === "unified" ? (
          <DiffSplitIcon className="h-4 w-4" />
        ) : (
          <DiffUnifiedIcon className="h-4 w-4" />
        )}
      </ToolbarButton>
    </div>
  );

  return (
    <div className="grid h-[var(--app-shell-toolbar-pane)] grid-cols-[minmax(0,1fr)_auto] items-center gap-1 border-b border-[var(--app-shell-border)] px-2 text-[var(--app-shell-muted)]">
      {summary}
      <div className="flex items-center gap-px">
        {gitActions ?? null}
        <ToolbarButton
          label={t("thread.sidePanel.openFile")}
          onClick={onToggleChangedFilesPane}
          pressed={isChangedFilesPaneOpen}
        >
          <OpenFilesIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-[var(--app-shell-border)]" />
        {reviewHeaderActions}
      </div>
    </div>
  );
}

function ReviewFileCard({
  change,
  diffMode,
  fileKey,
  hideWhitespace,
  isActive,
  isExpanded,
  loadFullFilesEnabled,
  onOpenReviewFile,
  onSelectReviewPath,
  onToggleExpanded,
  richPreviewEnabled,
  reviewCardRef,
  t,
  wordDiffsEnabled,
  wrap,
}: {
  change: FileChangeSummary;
  diffMode: ReviewDiffMode;
  fileKey: string;
  hideWhitespace: boolean;
  isActive: boolean;
  isExpanded: boolean;
  loadFullFilesEnabled: boolean;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  onSelectReviewPath: (path: string) => void;
  onToggleExpanded: () => void;
  richPreviewEnabled: boolean;
  reviewCardRef: (node: HTMLDivElement | null) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  wordDiffsEnabled: boolean;
  wrap: boolean;
}) {
  const { linesAdded, linesDeleted } = countFileChangeDiffLines(change.diff);
  const isPreviewable = !["delete", "deleted"].includes(change.kind.trim().toLowerCase());
  const preview = useMemo(
    () => buildReviewPreview(change.diff, { hideWhitespace, loadFullFilesEnabled }),
    [change.diff, hideWhitespace, loadFullFilesEnabled],
  );
  const splitPreview = useMemo(
    () => buildSplitReviewPreview(preview.lines),
    [preview.lines],
  );

  return (
    <div
      ref={reviewCardRef}
      data-review-path={change.path}
      className={[
        "overflow-hidden rounded-[14px] border transition-colors",
        isActive
          ? "app-card border-[var(--app-shell-border-heavy)]"
          : "app-card-muted border-[var(--app-shell-border)]",
      ].join(" ")}
      onClick={() => onSelectReviewPath(change.path)}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={
            isExpanded
              ? t("localConversation.planSummary.collapse")
              : t("localConversation.planSummary.expand")
          }
          className="app-topbar-button mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]"
        >
          <span
            aria-hidden="true"
            className={["text-[12px] transition-transform", isExpanded ? "rotate-0" : "-rotate-90"].join(" ")}
          >
            ▾
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-control shrink-0 rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
              {change.kind}
            </span>
            <button
              type="button"
              disabled={!isPreviewable}
              onClick={(event) => {
                event.stopPropagation();
                onOpenReviewFile(change);
              }}
              className="app-title min-w-0 truncate text-left text-[13px] leading-5 disabled:opacity-70"
              aria-label={change.path}
            >
              {change.path}
            </button>
          </div>
          {change.movePath ? (
            <div className="app-text-muted mt-1 break-all text-[12px] leading-5">
              {t("app.chat.movedTo")}: {change.movePath}
            </div>
          ) : null}
          <div className="app-text-muted mt-2 flex items-center gap-3 text-[12px]">
            <span className="text-[#21a05b]">+{linesAdded}</span>
            <span className="text-[#c3564e]">-{linesDeleted}</span>
          </div>
        </div>

        {isPreviewable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenReviewFile(change);
            }}
            className="app-control-weak shrink-0 rounded-full px-3 py-1 text-[11px]"
          >
            {t("localConversation.planSummary.openInNewWindow")}
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="border-t border-[var(--app-shell-border)] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StateChip active={richPreviewEnabled} label={t("codex.review.richPreview.enable")} />
            <StateChip active={wordDiffsEnabled} label={t("codex.review.wordDiffs.enable")} />
            <StateChip active={!hideWhitespace} label={t("codex.review.whitespace.show")} />
          </div>
          {preview.lines.length === 0 ? (
            <div className="app-text-muted text-[12px] leading-5">{t("app.chat.noOutput")}</div>
          ) : diffMode === "unified" ? (
            <UnifiedDiffPreview lines={preview.lines} truncated={preview.truncated} wrap={wrap} />
          ) : (
            <SplitDiffPreview linesAdded={splitPreview.linesAdded} linesDeleted={splitPreview.linesDeleted} truncated={preview.truncated} wrap={wrap} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  pressed = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <ReviewToolbarTooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={[
          "app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px]",
          pressed ? "bg-[var(--app-shell-control-hover)] text-[var(--app-shell-text)]" : "",
        ].join(" ")}
      >
        {children}
      </button>
    </ReviewToolbarTooltip>
  );
}

function ReviewToolbarTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden max-w-[min(32rem,calc(100vw-16px))] -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

function OptionsMenuButton({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: (() => void) | null;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick ?? undefined}
      className="app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[var(--app-shell-muted)]">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </span>
    </button>
  );
}

function StateChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-[11px]",
        active ? "app-control" : "app-control-weak",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function UnifiedDiffPreview({
  lines,
  truncated,
  wrap,
}: {
  lines: string[];
  truncated: boolean;
  wrap: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--app-shell-border)]">
      <div className={wrap ? "max-h-[420px] overflow-y-auto" : "max-h-[420px] overflow-auto"}>
        {lines.map((line, index) => (
          <div
            key={`${index}:${line}`}
            className={[
              "px-3 py-1 font-mono text-[12px] leading-5",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              resolveDiffLineClassName(line),
            ].join(" ")}
          >
            {line.length > 0 ? line : " "}
          </div>
        ))}
      </div>
      {truncated ? (
        <div className="app-text-muted border-t border-[var(--app-shell-border)] px-3 py-2 text-[11px]">…</div>
      ) : null}
    </div>
  );
}

function SplitDiffPreview({
  linesAdded,
  linesDeleted,
  truncated,
  wrap,
}: {
  linesAdded: string[];
  linesDeleted: string[];
  truncated: boolean;
  wrap: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--app-shell-border)]">
      <div className="grid grid-cols-2 divide-x divide-[var(--app-shell-border)]">
        <DiffColumn lines={linesDeleted} tone="deleted" wrap={wrap} />
        <DiffColumn lines={linesAdded} tone="added" wrap={wrap} />
      </div>
      {truncated ? (
        <div className="app-text-muted border-t border-[var(--app-shell-border)] px-3 py-2 text-[11px]">…</div>
      ) : null}
    </div>
  );
}

function DiffColumn({
  lines,
  tone,
  wrap,
}: {
  lines: string[];
  tone: "added" | "deleted";
  wrap: boolean;
}) {
  return (
    <div className={wrap ? "max-h-[420px] overflow-y-auto" : "max-h-[420px] overflow-auto"}>
      {lines.length === 0 ? (
        <div className="app-text-muted px-3 py-2 font-mono text-[12px] leading-5">—</div>
      ) : (
        lines.map((line, index) => (
          <div
            key={`${tone}:${index}:${line}`}
            className={[
              "px-3 py-1 font-mono text-[12px] leading-5",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              tone === "deleted"
                ? "bg-[#fff4f2] text-[#9e5348]"
                : "bg-[#f3fbf5] text-[#1f7d47]",
            ].join(" ")}
          >
            {line.length > 0 ? line : " "}
          </div>
        ))
      )}
    </div>
  );
}

function buildReviewFileKey(file: FileChangeSummary, index: number) {
  return `${file.kind}:${file.path}:${file.movePath ?? "same"}:${index}`;
}

function buildGitApplyCommand(files: FileChangeSummary[]) {
  const diff = files
    .map((file) => file.diff?.trimEnd() ?? "")
    .filter((entry) => entry.length > 0)
    .join("\n");

  if (diff.length === 0) {
    return "";
  }

  return `git apply --3way <<'PATCH'\n${diff}\nPATCH`;
}

function buildReviewPreview(
  diff: string | null,
  options: { hideWhitespace: boolean; loadFullFilesEnabled: boolean },
) {
  const normalizedLines = (diff ?? "")
    .split(/\r?\n/u)
    .filter((line) => !(options.hideWhitespace && isWhitespaceOnlyDiffLine(line)));
  const previewLines = options.loadFullFilesEnabled ? normalizedLines : normalizedLines.slice(0, 80);

  return {
    lines: previewLines,
    truncated: !options.loadFullFilesEnabled && normalizedLines.length > previewLines.length,
  };
}

function buildSplitReviewPreview(lines: string[]) {
  return {
    linesAdded: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++ ")),
    linesDeleted: lines.filter((line) => line.startsWith("-") && !line.startsWith("--- ")),
  };
}

function isWhitespaceOnlyDiffLine(line: string) {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
    return false;
  }

  if (line.startsWith("+") || line.startsWith("-")) {
    return line.slice(1).trim().length === 0;
  }

  return false;
}

function resolveDiffLineClassName(line: string) {
  if (line.startsWith("@@")) {
    return "bg-[var(--app-shell-card-bg-weak)] text-[var(--app-shell-title)]";
  }
  if (line.startsWith("+++ ") || line.startsWith("--- ")) {
    return "bg-[var(--app-shell-card-bg-muted)] text-[var(--app-shell-subtle)]";
  }
  if (line.startsWith("+")) {
    return "bg-[#f3fbf5] text-[#1f7d47]";
  }
  if (line.startsWith("-")) {
    return "bg-[#fff4f2] text-[#9e5348]";
  }
  return "app-code-block";
}
