import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";
import type { WorkspaceFileDocument } from "../../services/workspaceFiles";
import { countFileChangeDiffLines, type ThreadDiffSummary } from "./threadConversationState";

type ChatSidePanelProps = {
  activeTab: ChatSidePanelTab;
  onTabChange: (tab: ChatSidePanelTab) => void;
  selectedFile: WorkspaceFileDocument | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadDiffSummary: ThreadDiffSummary;
};

export type ChatSidePanelTab = "review" | "browser" | "file";

export function ChatSidePanel({
  activeTab,
  onTabChange,
  selectedFile,
  t,
  threadDiffSummary,
}: ChatSidePanelProps) {
  return (
    <aside className="min-h-0 min-w-0 border-l border-[var(--app-shell-border)] bg-[var(--app-shell-right)] px-4 py-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTabChange("review")}
          className={[
            "rounded-full px-3 py-1.5 text-[13px]",
            activeTab === "review" ? "app-command-tab-active" : "app-command-tab-idle",
          ].join(" ")}
        >
          {t("thread.sidePanel.diffTab")}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("browser")}
          className={[
            "rounded-full px-3 py-1.5 text-[13px]",
            activeTab === "browser" ? "app-command-tab-active" : "app-command-tab-idle",
          ].join(" ")}
        >
          {t("thread.sidePanel.browserTab")}
        </button>
        {selectedFile ? (
          <button
            type="button"
            onClick={() => onTabChange("file")}
            className={[
              "rounded-full px-3 py-1.5 text-[13px]",
              activeTab === "file" ? "app-command-tab-active" : "app-command-tab-idle",
            ].join(" ")}
          >
            {selectedFile.name}
          </button>
        ) : null}
      </div>

      <div className="mt-5 min-h-0 overflow-y-auto">
        {activeTab === "review" ? (
          <ReviewPanel threadDiffSummary={threadDiffSummary} t={t} />
        ) : activeTab === "file" && selectedFile ? (
          <FilePanel selectedFile={selectedFile} />
        ) : (
          <EmptyPanel t={t} />
        )}
      </div>
    </aside>
  );
}

function ReviewPanel({
  threadDiffSummary,
  t,
}: {
  threadDiffSummary: ThreadDiffSummary;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (!threadDiffSummary.hasChanges) {
    return <EmptyPanel t={t} />;
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
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewFileCard({
  change,
  t,
}: {
  change: FileChangeSummary;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const lineCounts = countFileChangeDiffLines(change.diff);

  return (
    <div className="app-card-muted rounded-[14px] px-4 py-3">
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
    </div>
  );
}

function EmptyPanel({
  t,
}: {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-4 py-4 text-[14px] leading-6">
      {t("thread.sidePanel.empty.title")}
    </div>
  );
}

function FilePanel({ selectedFile }: { selectedFile: WorkspaceFileDocument }) {
  return (
    <div className="space-y-4">
      <div className="app-card rounded-[18px] px-4 py-4">
        <div className="app-title break-all text-[14px] font-medium">{selectedFile.name}</div>
        <div className="app-text-muted mt-2 break-all text-[12px] leading-5">{selectedFile.relativePath}</div>
      </div>

      <pre className="app-code-block overflow-x-auto rounded-[18px] px-4 py-4 whitespace-pre-wrap break-words leading-6">
        {selectedFile.contents}
      </pre>
    </div>
  );
}
