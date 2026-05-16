import {
  useId,
  useState,
  type FocusEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ThreadHistoryEntrySource } from "../../services/history";

type LocalConversationPageHeaderProps = {
  conversationId: string | null;
  cwd: string | null;
  defaultTitleHoverCardOpen?: boolean;
  compact?: boolean;
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
  defaultTitleHoverCardOpen = false,
  compact = false,
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
  const titleHoverCardContent = hasHoverCardDetails ? (
    <LocalConversationTitleHoverCardContent
      cwd={trimmedCwd}
      gitRootLabel={gitRootLabel}
      heartbeatSummary={trimmedHeartbeatSummary}
      projectLabel={trimmedProjectLabel}
    />
  ) : null;
  const titleContent = (
    <span className="no-drag pointer-events-auto max-w-[320px] min-w-[2ch] cursor-interaction truncate text-[15px] font-medium text-[var(--app-shell-text)]">
      <span className="w-fit truncate">{title}</span>
      {titleSuffix}
    </span>
  );

  if (compact) {
    return (
      <div className="no-drag flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
        {titleHoverCardContent ? (
          <LocalConversationHoverCard
            align="start"
            defaultOpen={defaultTitleHoverCardOpen}
            hoverCardContent={titleHoverCardContent}
            side="bottom"
            sideOffset={6}
          >
            {titleContent}
          </LocalConversationHoverCard>
        ) : (
          titleContent
        )}
        {heartbeatAction}
        {trailingActions}
      </div>
    );
  }

  return (
    <header className="border-b border-[var(--app-shell-border)] px-4">
      <div className="draggable grid min-h-[var(--app-shell-toolbar)] w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
          {titleHoverCardContent ? (
            <LocalConversationHoverCard
              align="start"
              defaultOpen={defaultTitleHoverCardOpen}
              hoverCardContent={titleHoverCardContent}
              side="bottom"
              sideOffset={6}
            >
              {titleContent}
            </LocalConversationHoverCard>
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

function LocalConversationHoverCard({
  align,
  children,
  defaultOpen = false,
  hoverCardContent,
  onOpenChange,
  side,
  sideOffset,
}: {
  align: "start" | "center";
  children: ReactNode;
  defaultOpen?: boolean;
  hoverCardContent: ReactNode;
  onOpenChange?: (open: boolean) => void;
  side: "bottom";
  sideOffset: number;
}) {
  const hoverCardId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const openHoverCard = () => {
    setOpen(true);
    onOpenChange?.(true);
  };
  const closeHoverCard = () => {
    setOpen(false);
    onOpenChange?.(false);
  };
  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    closeHoverCard();
  };
  const hoverCardClassName = open
    ? "pointer-events-auto absolute top-full z-20 w-[320px] max-w-[min(32rem,calc(100vw-16px))] rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-3 text-[12px] leading-5 text-[var(--app-shell-text)] opacity-100 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-150 ease-out"
    : "pointer-events-none absolute top-full z-20 w-[320px] max-w-[min(32rem,calc(100vw-16px))] rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-3 text-[12px] leading-5 text-[var(--app-shell-text)] invisible -translate-y-1 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-150 ease-out";
  const hoverCardStyle = {
    marginTop: `${sideOffset}px`,
  } as CSSProperties;
  if (align === "start") {
    hoverCardStyle.left = 0;
  } else {
    hoverCardStyle.left = "50%";
    hoverCardStyle.transform = open ? "translateX(-50%)" : "translate(-50%, -4px)";
  }
  if (side === "bottom") {
    hoverCardStyle.top = "100%";
  }

  return (
    <div
      aria-describedby={open ? hoverCardId : undefined}
      className="no-drag relative flex min-w-0 max-w-[320px] shrink-0 items-center"
      onBlurCapture={handleBlurCapture}
      onFocusCapture={openHoverCard}
      onMouseEnter={openHoverCard}
      onMouseLeave={closeHoverCard}
    >
      {children}
      <div
        id={hoverCardId}
        className={hoverCardClassName}
        data-state={open ? "open" : "closed"}
        style={hoverCardStyle}
      >
        {hoverCardContent}
      </div>
    </div>
  );
}

function LocalConversationTitleHoverCardContent({
  cwd,
  gitRootLabel,
  heartbeatSummary,
  projectLabel,
}: {
  cwd: string | null;
  gitRootLabel: string | null;
  heartbeatSummary: string | null;
  projectLabel: string | null;
}) {
  const hasMetadataFooter = gitRootLabel !== null || heartbeatSummary !== null;

  return (
    <>
      {projectLabel ? (
        <div className="truncate text-[12px] font-medium text-[var(--app-shell-text)]">
          {projectLabel}
        </div>
      ) : null}
      {cwd ? (
        <div className="mt-1 break-all font-mono text-[11px] leading-5 text-[var(--app-shell-subtle)]">
          {cwd}
        </div>
      ) : null}
      {hasMetadataFooter ? (
        <div className="mt-2 border-t border-[var(--app-shell-border)] pt-2">
          {gitRootLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 font-mono text-[11px] text-[var(--app-shell-subtle)]">
                <span className="truncate">{gitRootLabel}</span>
              </span>
            </div>
          ) : null}
          {heartbeatSummary ? (
            <div
              className={
                gitRootLabel
                  ? "mt-2 text-[11px] leading-5 text-[var(--app-shell-subtle)]"
                  : "text-[11px] leading-5 text-[var(--app-shell-subtle)]"
              }
            >
              {heartbeatSummary}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
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
