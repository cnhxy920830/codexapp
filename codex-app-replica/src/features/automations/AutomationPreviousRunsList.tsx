import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CheckCircleFilledIcon,
} from "../../components/AppShellIcons";
import { Tooltip } from "../../components/Tooltip";
import type { AutomationInboxItem } from "../../services/automations";
import { ContextMenu } from "../../components/ContextMenu";
import type { TranslateFn } from "./automationsPageUtils";

type AutomationPreviousRunsListProps = {
  automationId: string;
  formatRootLabel: (root: string) => string;
  inboxItems: AutomationInboxItem[];
  isLoading: boolean;
  onOpenThread: (threadId: string) => void | Promise<void>;
  onSetInboxItemReadState: (id: string, isRead: boolean) => Promise<void>;
  threadTitleById: ReadonlyMap<string, string>;
  t: TranslateFn;
};

export function AutomationPreviousRunsList({
  automationId,
  formatRootLabel,
  inboxItems,
  isLoading,
  onOpenThread,
  onSetInboxItemReadState,
  threadTitleById,
  t,
}: AutomationPreviousRunsListProps) {
  const items = useMemo(
    () =>
      inboxItems
        .filter((item) => item.automationId === automationId)
        .sort((left, right) => right.createdAt - left.createdAt),
    [automationId, inboxItems],
  );

  if (isLoading && items.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-start px-1">
        <span className="icon-sm animate-spin rounded-full border-2 border-current/30 border-t-current text-token-description-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-1 py-1 text-base text-token-description-foreground opacity-50">
        {t("sidebarElectron.noTasks")}
      </div>
    );
  }

  return (
    <div className="vertical-scroll-fade-mask flex h-full min-h-0 flex-col overflow-y-auto [--edge-fade-distance:1rem]">
      {items.map((item) => {
        const archived = item.status === "ARCHIVED";
        const unread = item.readAt == null;
        const inProgress = item.status === "IN_PROGRESS";
        const canOpenThread = item.threadId !== null && !archived;
        const conversationTitle =
          item.threadId ? threadTitleById.get(item.threadId)?.trim() ?? null : null;
        const title =
          conversationTitle ||
          item.title?.trim() ||
          item.automationName?.trim() ||
          t("inbox.automations.history.untitled");
        const subtitle =
          item.sourceCwd && item.sourceCwd.trim().length > 0
            ? formatRootLabel(item.sourceCwd)
            : null;
        const icon = inProgress ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : unread ? (
          <span
            className={[
              "h-2 w-2 rounded-full",
              archived ? "bg-[var(--app-shell-danger)]" : "bg-[var(--app-shell-link)]",
            ].join(" ")}
          />
        ) : archived ? (
          <ArchiveIcon className="h-3.5 w-3.5 text-[var(--app-shell-subtle)]" />
        ) : (
          <CheckCircleFilledIcon className="h-3.5 w-3.5 text-[var(--app-shell-subtle)]" />
        );
        const contextMenuItems = [
          {
            id: unread ? "mark-read" : "mark-unread",
            label: unread
              ? t("inbox.contextMenu.markRead")
              : t("inbox.contextMenu.markUnread"),
            onSelect: () => {
              void onSetInboxItemReadState(item.id, unread);
            },
          },
        ];
        const row = (
          <div
            className={[
              "group flex items-center gap-2 rounded-md py-2 pr-3 pl-1 text-base [content-visibility:auto] [contain-intrinsic-size:auto_64px]",
              canOpenThread
                ? "cursor-pointer hover:bg-token-list-hover-background"
                : "cursor-default opacity-50",
            ].join(" ")}
            onClick={() => {
              if (!item.threadId || archived) {
                return;
              }
              void onOpenThread(item.threadId);
            }}
          >
            <div className="flex w-5 shrink-0 items-center justify-center text-[var(--app-shell-subtle)]">
              {icon}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-normal text-token-foreground">
                    {title}
                  </span>
                  {subtitle ? (
                    <span className="truncate text-sm text-token-description-foreground">
                      {subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-[4.5rem] items-center justify-end self-center">
                <span className="text-sm whitespace-nowrap text-token-description-foreground tabular-nums">
                  <CompactRelativeDateTime timestampMs={item.createdAt} t={t} />
                </span>
              </div>
            </div>
          </div>
        );

        return (
          <ContextMenu
            key={item.id}
            items={contextMenuItems}
          >
            {archived ? (
              <Tooltip
                align="start"
                tooltipContent={t("inbox.automations.history.archivedTooltip")}
              >
                <div>{row}</div>
              </Tooltip>
            ) : (
              row
            )}
          </ContextMenu>
        );
      })}
    </div>
  );
}

function CompactRelativeDateTime({
  timestampMs,
  t,
}: {
  timestampMs: number;
  t: TranslateFn;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return formatCompactRelativeTime(timestampMs, now, t);
}

function formatCompactRelativeTime(timestampMs: number, now: number, t: TranslateFn) {
  const diffMinutes = Math.floor((now - timestampMs) / (60 * 1000));
  const safeMinutes = Math.max(1, diffMinutes);

  if (safeMinutes < 60) {
    return t("wham.formattedRelativeDateTime.compactMinutesAgo", {
      value: safeMinutes,
    });
  }

  const hours = Math.floor(safeMinutes / 60);
  if (hours < 24) {
    return t("wham.formattedRelativeDateTime.compactHoursAgo", { value: hours });
  }

  const days = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(timestampMs).getTime()) / 86400000),
  );
  if (days < 7) {
    return t("wham.formattedRelativeDateTime.compactDaysAgo", { value: days });
  }

  if (days < 30) {
    return t("wham.formattedRelativeDateTime.compactWeeksAgo", {
      value: Math.floor(days / 7),
    });
  }

  if (days < 365) {
    return t("wham.formattedRelativeDateTime.compactMonthsAgo", {
      value: Math.floor(days / 30),
    });
  }

  return t("wham.formattedRelativeDateTime.compactYearsAgo", {
    value: Math.floor(days / 365),
  });
}

function startOfDay(value: number) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
