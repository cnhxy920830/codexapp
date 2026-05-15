import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CollapseAllDiffsIcon,
  CopyPathIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  ExpandAllDiffsIcon,
  MoreActionsIcon,
  RefreshIcon,
  WrapDisabledIcon,
  WrapEnabledIcon,
  WordDiffsDisabledIcon,
  WordDiffsEnabledIcon,
  WhitespaceIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";
import { countFileChangeDiffLines, type ThreadDiffSummary } from "./threadConversationState";

type ReviewSidePanelProps = {
  onOpenReviewFile: (change: FileChangeSummary) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

type ReviewDiffMode = "split" | "unified";

export function ReviewSidePanel({
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
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const fileKeys = useMemo(
    () => threadDiffSummary.files.map((file, index) => buildReviewFileKey(file, index)),
    [threadDiffSummary.files],
  );
  const [expandedFileKeys, setExpandedFileKeys] = useState<Set<string>>(() => new Set(fileKeys));
  const isAllExpanded = fileKeys.length > 0 && expandedFileKeys.size === fileKeys.length;

  useEffect(() => {
    setExpandedFileKeys(new Set(fileKeys));
  }, [fileKeys]);

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

  if (!threadDiffSummary.hasChanges) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--app-shell-subtle)]">
        <div className="max-w-72 rounded-[18px] border border-dashed border-[var(--app-shell-border)] px-5 py-6">
          <div className="app-title text-[14px] font-medium">{t("codex.review.noDiff")}</div>
          <div className="mt-2 text-[13px] leading-6">
            {t("codex.review.noDiff.baseDescription")}
          </div>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyGitApplyCommand = async () => {
    const command = buildGitApplyCommand(threadDiffSummary.files);
    if (command.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setCopiedApplyCommand(true);
      window.setTimeout(() => setCopiedApplyCommand(false), 1600);
    } finally {
      setIsOptionsMenuOpen(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--app-shell-border)] px-2.5 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="app-title text-[13px] font-medium">
              {t("thread.sidePanel.diffTab")}
            </div>
            <div className="app-text-muted mt-1 flex flex-wrap items-center gap-3 text-[11px]">
              <span>{t("app.chat.filesChanged", { fileCount: threadDiffSummary.fileCount })}</span>
              <span className="text-[#21a05b]">+{threadDiffSummary.linesAdded}</span>
              <span className="text-[#c3564e]">-{threadDiffSummary.linesDeleted}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="relative" ref={optionsMenuRef}>
              <ToolbarButton
                label={t("codex.review.header.moreOptions")}
                onClick={() => setIsOptionsMenuOpen((current) => !current)}
              >
                <MoreActionsIcon className="h-4 w-4" />
              </ToolbarButton>
              {isOptionsMenuOpen ? (
                <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <OptionsMenuButton
                    label={
                      loadFullFilesEnabled
                        ? t("codex.review.loadFullFiles.disable")
                        : t("codex.review.loadFullFiles.enable")
                    }
                    onClick={() => {
                      setLoadFullFilesEnabled((current) => !current);
                      setIsOptionsMenuOpen(false);
                    }}
                    selected={loadFullFilesEnabled}
                  />
                  <OptionsMenuButton
                    label={
                      richPreviewEnabled
                        ? t("codex.review.richPreview.disable")
                        : t("codex.review.richPreview.enable")
                    }
                    onClick={() => {
                      setRichPreviewEnabled((current) => !current);
                      setIsOptionsMenuOpen(false);
                    }}
                    selected={richPreviewEnabled}
                  />
                  <OptionsMenuButton
                    label={
                      wordDiffsEnabled
                        ? t("codex.review.wordDiffs.disable")
                        : t("codex.review.wordDiffs.enable")
                    }
                    onClick={() => {
                      setWordDiffsEnabled((current) => !current);
                      setIsOptionsMenuOpen(false);
                    }}
                    selected={wordDiffsEnabled}
                  />
                  <OptionsMenuButton
                    label={
                      hideWhitespace
                        ? t("codex.review.whitespace.show")
                        : t("codex.review.whitespace.hide")
                    }
                    onClick={() => {
                      setHideWhitespace((current) => !current);
                      setIsOptionsMenuOpen(false);
                    }}
                    selected={hideWhitespace}
                  />
                  <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                  <OptionsMenuButton
                    label={t("codex.review.copyGitApplyCommand")}
                    onClick={() => void handleCopyGitApplyCommand()}
                    selected={false}
                    trailingIcon={<CopyPathIcon className="h-3.5 w-3.5" />}
                  />
                </div>
              ) : null}
            </div>

            <ToolbarButton label={t("codex.review.refreshGitQueries")} onClick={handleRefresh}>
              <RefreshIcon className={["h-4 w-4", isRefreshing ? "animate-spin" : ""].join(" ")} />
            </ToolbarButton>
            <ToolbarButton
              label={wrap ? t("codex.review.wrap.disable") : t("codex.review.wrap.enable")}
              onClick={() => setWrap((current) => !current)}
            >
              {wrap ? (
                <WrapEnabledIcon className="h-4 w-4" />
              ) : (
                <WrapDisabledIcon className="h-4 w-4" />
              )}
            </ToolbarButton>
            <ToolbarButton
              label={
                isAllExpanded
                  ? t("codex.review.expandOrCollapseDiffMenu.collapse")
                  : t("codex.review.expandOrCollapseDiffMenu.expand")
              }
              onClick={() =>
                setExpandedFileKeys(
                  isAllExpanded ? new Set<string>() : new Set(fileKeys),
                )
              }
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
              onClick={() =>
                setDiffMode((current) => (current === "unified" ? "split" : "unified"))
              }
            >
              {diffMode === "unified" ? (
                <DiffSplitIcon className="h-4 w-4" />
              ) : (
                <DiffUnifiedIcon className="h-4 w-4" />
              )}
            </ToolbarButton>
          </div>
        </div>

        {copiedApplyCommand ? (
          <div className="app-text-muted mt-2 text-[11px]">
            {t("codex.review.copyGitApplyCommand.toast")}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
                isExpanded={expandedFileKeys.has(fileKey)}
                loadFullFilesEnabled={loadFullFilesEnabled}
                onOpenReviewFile={onOpenReviewFile}
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
                t={t}
                wordDiffsEnabled={wordDiffsEnabled}
                wrap={wrap}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewFileCard({
  change,
  diffMode,
  fileKey,
  hideWhitespace,
  isExpanded,
  loadFullFilesEnabled,
  onOpenReviewFile,
  onToggleExpanded,
  richPreviewEnabled,
  t,
  wordDiffsEnabled,
  wrap,
}: {
  change: FileChangeSummary;
  diffMode: ReviewDiffMode;
  fileKey: string;
  hideWhitespace: boolean;
  isExpanded: boolean;
  loadFullFilesEnabled: boolean;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  onToggleExpanded: () => void;
  richPreviewEnabled: boolean;
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
    <div className="app-card-muted overflow-hidden rounded-[14px]">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? t("localConversation.planSummary.collapse") : t("localConversation.planSummary.expand")}
          className="app-topbar-button mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]"
        >
          <ChevronDownIcon className={["h-4 w-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90"].join(" ")} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-control shrink-0 rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">
              {change.kind}
            </span>
            <button
              type="button"
              disabled={!isPreviewable}
              onClick={() => onOpenReviewFile(change)}
              className="app-title min-w-0 truncate text-left text-[13px] leading-5 disabled:opacity-70"
              title={change.path}
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
            onClick={() => onOpenReviewFile(change)}
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
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px]"
    >
      {children}
    </button>
  );
}

function OptionsMenuButton({
  label,
  onClick,
  selected,
  trailingIcon = null,
}: {
  label: string;
  onClick: () => void;
  selected: boolean;
  trailingIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]"
    >
      <span className="min-w-0 flex-1">{label}</span>
      {selected ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : trailingIcon}
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
