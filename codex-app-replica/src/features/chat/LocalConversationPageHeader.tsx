import type { ReactNode } from "react";
import type { ThreadHistoryEntrySource } from "../../services/history";

type LocalConversationPageHeaderProps = {
  conversationId: string | null;
  cwd: string | null;
  heartbeatAction?: ReactNode;
  heartbeatSummary?: string | null;
  projectLabel: string | null;
  source: ThreadHistoryEntrySource | null;
  threadGitRoot: string | null;
  title: string;
  trailingActions?: ReactNode;
};

export function LocalConversationPageHeader({
  conversationId,
  cwd,
  heartbeatAction,
  heartbeatSummary = null,
  projectLabel,
  source,
  threadGitRoot,
  title,
  trailingActions,
}: LocalConversationPageHeaderProps) {
  const titleSuffix = buildLocalConversationTitleSuffix(source, conversationId);
  const trimmedProjectLabel = projectLabel?.trim() || null;
  const trimmedCwd = cwd?.trim() || null;
  const trimmedHeartbeatSummary = heartbeatSummary?.trim() || null;
  const trimmedThreadGitRoot = threadGitRoot?.trim() || null;
  const normalizedCwd = trimmedCwd?.replace(/[\\/]+$/u, "").toLowerCase() ?? "";
  const normalizedThreadGitRoot =
    trimmedThreadGitRoot?.replace(/[\\/]+$/u, "").toLowerCase() ?? "";
  const gitRootLabel =
    trimmedThreadGitRoot !== null &&
    normalizedThreadGitRoot.length > 0 &&
    normalizedThreadGitRoot !== normalizedCwd
      ? trimmedThreadGitRoot
      : null;
  const hasHoverCardDetails =
    trimmedProjectLabel !== null ||
    trimmedCwd !== null ||
    gitRootLabel !== null ||
    trimmedHeartbeatSummary !== null;
  const titleContent = (
    <div className="no-drag pointer-events-auto max-w-[320px] min-w-[2ch] cursor-default truncate text-[15px] font-medium text-[var(--app-shell-text)]">
      <span className="flex min-w-0 items-center truncate">
        <span className="block w-fit truncate">{title}</span>
        {titleSuffix ? <span className="min-w-0 truncate">{titleSuffix}</span> : null}
      </span>
    </div>
  );

  return (
    <header className="border-b border-[var(--app-shell-border)] px-4">
      <div className="draggable grid min-h-[var(--app-shell-toolbar)] w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
          {hasHoverCardDetails ? (
            <div className="group relative min-w-0 max-w-[320px]">
              {titleContent}
              <div className="pointer-events-none absolute top-[calc(100%+8px)] left-0 z-20 hidden w-[320px] max-w-[calc(100vw-40px)] rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-3 text-[12px] leading-5 text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
                {trimmedProjectLabel ? (
                  <div className="truncate text-[12px] font-medium text-[var(--app-shell-text)]">
                    {trimmedProjectLabel}
                  </div>
                ) : null}
                {trimmedCwd ? (
                  <div className="mt-1 break-all font-mono text-[11px] leading-5 text-[var(--app-shell-subtle)]">
                    {trimmedCwd}
                  </div>
                ) : null}
                {gitRootLabel || trimmedHeartbeatSummary ? (
                  <div className="mt-2 border-t border-[var(--app-shell-border)] pt-2">
                    {gitRootLabel ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {gitRootLabel ? (
                          <span className="inline-flex max-w-full items-center rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 font-mono text-[11px] text-[var(--app-shell-subtle)]">
                            <span className="truncate">{gitRootLabel}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {trimmedHeartbeatSummary ? (
                      <div className="mt-2 text-[11px] leading-5 text-[var(--app-shell-subtle)]">
                        {trimmedHeartbeatSummary}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            titleContent
          )}
          {heartbeatAction}
          {trailingActions}
        </div>
      </div>
    </header>
  );
}

function buildLocalConversationTitleSuffix(
  source: ThreadHistoryEntrySource | null,
  conversationId: string | null,
) {
  const parentThreadId = source?.parentThreadId ?? null;
  if (parentThreadId === null) {
    return null;
  }

  const nickname = formatSubagentNickname(source?.agentNickname ?? null, conversationId);
  const role =
    typeof source?.agentRole === "string" &&
    source.agentRole.trim().length > 0 &&
    source.agentRole !== "default"
      ? source.agentRole.trim()
      : null;

  if (nickname === null && role === null) {
    return null;
  }

  return (
    <>
      {nickname ? (
        <span className="ml-1 shrink-0 font-medium text-[var(--vscode-charts-blue)]">
          {nickname}
        </span>
      ) : null}
      {role ? (
        <span className="ml-1 shrink-0 text-[var(--app-shell-subtle)]">({role})</span>
      ) : null}
    </>
  );
}

function formatSubagentNickname(
  agentNickname: string | null,
  conversationId: string | null,
) {
  const trimmedNickname = agentNickname?.trim() ?? "";
  if (trimmedNickname.length > 0) {
    return trimmedNickname.startsWith("@")
      ? trimmedNickname.slice(1)
      : trimmedNickname;
  }

  const trimmedConversationId = conversationId?.trim() ?? "";
  if (trimmedConversationId.length === 0) {
    return null;
  }

  return `agent-${trimmedConversationId.slice(0, 8)}`;
}
