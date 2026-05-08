import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";
import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import { isWorkspaceFileRightPanelTab, type RightPanelTab } from "./rightPanelTabs";
import { countFileChangeDiffLines, type ThreadDiffSummary } from "./threadConversationState";
import { WorkspaceFilePreviewPanel } from "./WorkspaceFilePreviewPanel";

type ChatSidePanelProps = {
  activeTab: RightPanelTab | null;
  onOpenReviewFile: (change: FileChangeSummary) => void;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

export function ChatSidePanel({
  activeTab,
  onOpenReviewFile,
  onSelectWorkspaceFile,
  t,
  threadDiffSummary,
}: ChatSidePanelProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-[var(--app-shell-border)] bg-[var(--app-shell-right)] px-4 py-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab && isWorkspaceFileRightPanelTab(activeTab) ? (
          <WorkspaceFilePreviewPanel
            selectedFileTarget={activeTab.file}
            onSelectWorkspaceFile={onSelectWorkspaceFile}
            t={t}
          />
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
