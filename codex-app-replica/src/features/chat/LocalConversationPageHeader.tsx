import {
  useId,
  useState,
  type FocusEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ClockIcon,
  FolderIcon,
  ForkedConversationIcon,
  WorktreeIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadHistoryEntrySource } from "../../services/history";

const SUBAGENT_TITLE_COLOR_TOKENS = [
  "--vscode-charts-red",
  "--vscode-charts-blue",
  "--vscode-charts-orange",
  "--vscode-charts-green",
  "--vscode-charts-purple",
] as const;

const subagentTitleColorByConversationId = new Map<string, string>();
let nextSubagentTitleColorIndex = 0;

type HoverCardRow = {
  id: string;
  icon: ReactNode;
  label: string;
  allowWrap?: boolean;
  tone?: "default" | "danger";
};

type HoverCardSection = {
  id: string;
  rows: HoverCardRow[];
};

type LocalConversationPageHeaderProps = {
  conversationId: string | null;
  cwd: string | null;
  defaultTitleHoverCardOpen?: boolean;
  compact?: boolean;
  heartbeatAction?: ReactNode;
  heartbeatSummary?: string | null;
  latestCollaborationMode?: string | null;
  latestReasoningEffort?: string | null;
  onTitleHoverCardOpenChange?: (open: boolean) => void;
  projectLabel: string | null;
  source: ThreadHistoryEntrySource | null;
  t?: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadBranchLabel?: string | null;
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
  latestCollaborationMode = null,
  latestReasoningEffort = null,
  onTitleHoverCardOpenChange,
  projectLabel,
  source,
  t,
  threadBranchLabel = null,
  threadGitRoot,
  title,
  trailingActions,
}: LocalConversationPageHeaderProps) {
  const titleSuffix = buildLocalConversationTitleSuffix({
    conversationId,
    latestCollaborationMode,
    latestReasoningEffort,
    source,
    t,
  });
  const trimmedTitle = title.trim();
  const trimmedProjectLabel = projectLabel?.trim() || null;
  const trimmedCwd = cwd?.trim() || null;
  const trimmedThreadBranchLabel = threadBranchLabel?.trim() || null;
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
  const hoverCardSections = buildHoverCardSections({
    cwd: trimmedCwd,
    gitRootLabel,
    heartbeatSummary: trimmedHeartbeatSummary,
    threadBranchLabel: trimmedThreadBranchLabel,
  });
  const titleHoverCardContent =
    trimmedTitle.length > 0 ? (
      <LocalConversationTitleHoverCardContent
        projectLabel={trimmedProjectLabel}
        sections={hoverCardSections}
        threadTitle={trimmedTitle}
      />
    ) : null;
  const titleContent = (
    <span className="no-drag pointer-events-auto max-w-[320px] min-w-[2ch] cursor-interaction truncate text-[15px] font-medium text-[var(--app-shell-text)]">
      <span className="w-fit truncate">{trimmedTitle.length > 0 ? trimmedTitle : title}</span>
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
            onOpenChange={onTitleHoverCardOpenChange}
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
              onOpenChange={onTitleHoverCardOpenChange}
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
  projectLabel,
  sections,
  threadTitle,
}: {
  projectLabel: string | null;
  sections: HoverCardSection[];
  threadTitle: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="truncate text-[12px] font-medium text-[var(--app-shell-text)]">
          {threadTitle}
        </div>
        {projectLabel ? (
          <div className="truncate text-[12px] text-[var(--app-shell-subtle)]">
            {projectLabel}
          </div>
        ) : null}
      </div>
      {sections.map((section, index) => (
        <div
          key={section.id}
          className={index === 0 ? "flex flex-col gap-2" : "flex flex-col gap-2 border-t border-[var(--app-shell-border)] pt-3"}
        >
          {section.rows.map((row) => (
            <LocalConversationHoverCardRow key={row.id} row={row} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LocalConversationHoverCardRow({
  row,
}: {
  row: HoverCardRow;
}) {
  const iconClassName =
    row.tone === "danger"
      ? "h-4 w-4 shrink-0 text-[var(--app-shell-danger-text)]"
      : "h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]";
  const labelClassName = row.allowWrap
    ? row.tone === "danger"
      ? "min-w-0 flex-1 break-all text-[11px] leading-5 text-[var(--app-shell-danger-text)]"
      : "min-w-0 flex-1 break-all text-[11px] leading-5 text-[var(--app-shell-subtle)]"
    : row.tone === "danger"
      ? "min-w-0 flex-1 truncate text-[11px] leading-5 text-[var(--app-shell-danger-text)]"
      : "min-w-0 flex-1 truncate text-[11px] leading-5 text-[var(--app-shell-subtle)]";

  return (
    <div className="flex items-start gap-2">
      <div className={iconClassName}>{row.icon}</div>
      <div className={labelClassName}>{row.label}</div>
    </div>
  );
}

function buildHoverCardSections(params: {
  cwd: string | null;
  gitRootLabel: string | null;
  heartbeatSummary: string | null;
  threadBranchLabel: string | null;
}) {
  const environmentRows: HoverCardRow[] = [];
  if (params.cwd !== null) {
    environmentRows.push({
      id: "cwd",
      icon: <FolderIcon className="h-4 w-4 shrink-0" />,
      label: params.cwd,
      allowWrap: true,
    });
  }
  const branchRows: HoverCardRow[] = [];
  if (params.threadBranchLabel !== null) {
    branchRows.push({
      id: "branch",
      icon: <ForkedConversationIcon className="h-4 w-4 shrink-0" />,
      label: params.threadBranchLabel,
    });
  }
  if (params.gitRootLabel !== null) {
    branchRows.push({
      id: "gitRoot",
      icon: <WorktreeIcon className="h-4 w-4 shrink-0" />,
      label: params.gitRootLabel,
      allowWrap: true,
    });
  }

  const automationRows: HoverCardRow[] =
    params.heartbeatSummary === null
      ? []
      : [
          {
            id: "heartbeat",
            icon: <ClockIcon className="h-4 w-4 shrink-0" />,
            label: params.heartbeatSummary,
            allowWrap: true,
          },
        ];

  return [
    environmentRows.length > 0
      ? {
          id: "environment",
          rows: environmentRows,
        }
      : null,
    branchRows.length > 0
      ? {
          id: "branch",
          rows: branchRows,
        }
      : null,
    automationRows.length > 0
      ? {
          id: "automation",
          rows: automationRows,
        }
      : null,
  ].filter((section): section is HoverCardSection => section !== null);
}

function buildLocalConversationTitleSuffix(params: {
  source: ThreadHistoryEntrySource | null;
  conversationId: string | null;
  latestCollaborationMode: string | null;
  latestReasoningEffort: string | null;
  t?: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const parentThreadId = params.source?.parentThreadId ?? null;
  if (parentThreadId === null) {
    return null;
  }

  const nickname = formatSubagentNickname(params.source?.agentNickname ?? null, params.conversationId);
  const nicknameColor = getSubagentTitleColor(params.conversationId);
  const role =
    typeof params.source?.agentRole === "string" &&
    params.source.agentRole.trim().length > 0 &&
    params.source.agentRole !== "default"
      ? params.source.agentRole.trim()
      : null;
  const collaborationMode = formatCollaborationModeLabel(params.latestCollaborationMode, params.t);
  const reasoningEffort = formatReasoningEffortLabel(params.latestReasoningEffort, params.t);
  const modeSuffix =
    collaborationMode == null
      ? null
      : reasoningEffort == null
        ? collaborationMode
        : `${collaborationMode} (${reasoningEffort})`;

  if (nickname === null && role === null && modeSuffix === null) {
    return null;
  }

  return (
    <>
      {nickname ? (
        <span
          className="ml-1 shrink-0 font-medium"
          style={nicknameColor == null ? undefined : { color: nicknameColor }}
        >
          {nickname}
        </span>
      ) : null}
      {role ? <span className="ml-1 shrink-0 text-[var(--app-shell-subtle)]">({role})</span> : null}
      {modeSuffix ? (
        <span className="ml-1 shrink-0 text-[var(--app-shell-subtle)]">{modeSuffix}</span>
      ) : null}
    </>
  );
}

function formatCollaborationModeLabel(
  value: string | null,
  t?: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (value === "plan") {
    return t?.("composer.planModeIndicator") ?? "Plan";
  }
  if (value === "default") {
    return "Default";
  }
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function formatReasoningEffortLabel(
  value: string | null,
  t?: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (value) {
    case "none":
      return t?.("settings.agent.approval.never") ?? "Never";
    case "minimal":
      return "Minimal";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "Very high";
    default: {
      const trimmedValue = value?.trim() ?? "";
      return trimmedValue.length > 0 ? trimmedValue : null;
    }
  }
}

function formatSubagentNickname(
  agentNickname: string | null,
  conversationId: string | null,
) {
  const trimmedNickname = agentNickname?.trim() ?? "";
  const normalizedNickname = trimmedNickname.startsWith("@")
    ? trimmedNickname.slice(1).trim()
    : trimmedNickname;
  if (normalizedNickname.length > 0) {
    return `@${normalizedNickname}`;
  }

  const trimmedConversationId = conversationId?.trim() ?? "";
  if (trimmedConversationId.length === 0) {
    return null;
  }

  return `@agent-${trimmedConversationId.slice(0, 8)}`;
}

function getSubagentTitleColor(conversationId: string | null) {
  const trimmedConversationId = conversationId?.trim() ?? "";
  if (trimmedConversationId.length === 0) {
    return null;
  }

  const cachedColorToken = subagentTitleColorByConversationId.get(trimmedConversationId);
  if (cachedColorToken != null) {
    return `var(${cachedColorToken})`;
  }

  const colorToken = SUBAGENT_TITLE_COLOR_TOKENS[nextSubagentTitleColorIndex];
  nextSubagentTitleColorIndex =
    (nextSubagentTitleColorIndex + 1) % SUBAGENT_TITLE_COLOR_TOKENS.length;
  subagentTitleColorByConversationId.set(trimmedConversationId, colorToken);
  return `var(${colorToken})`;
}
