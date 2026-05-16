import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreadConversationWorkedFor } from "../../services/history";
import { ForwardNavigationIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { RenderableConversationGroup } from "./renderableConversationGroups";

type LatestTurnPreviewProps = {
  group: RenderableConversationGroup;
  isTurnInProgress: boolean;
  previewContent: ReactNode;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function LatestTurnPreview({ group, isTurnInProgress, previewContent, t }: LatestTurnPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [group.id]);

  const itemCount = countLatestTurnPreviewItems(group);
  const workedForItem = findLatestTurnWorkedForItem(group);
  const workedForSummary = useMemo(
    () => buildWorkedForSummary(workedForItem, itemCount, t),
    [itemCount, t, workedForItem],
  );
  const title =
    workedForSummary ??
    (isTurnInProgress ? t("composer.latestTurn.working") : t("composer.latestTurn"));
  const hasPreviewContent = previewContent !== null;

  if (!hasPreviewContent && !isTurnInProgress && itemCount === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--app-shell-border)] bg-[color:color-mix(in_srgb,var(--app-shell-main-surface)_95%,transparent)] shadow-[var(--app-shell-card-shadow)]">
      <button
        type="button"
        onClick={() => {
          if (hasPreviewContent) {
            setIsExpanded((value) => !value);
          }
        }}
        aria-expanded={hasPreviewContent ? isExpanded : undefined}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-shell-control-ring)] focus-visible:ring-inset"
      >
        <span className="min-w-0 truncate text-[13px] leading-5 text-[var(--app-shell-subtle)]">
          {title}
        </span>
        {hasPreviewContent ? (
          <ForwardNavigationIcon
            className={[
              "h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform duration-200",
              isExpanded ? "rotate-90" : "",
            ].join(" ")}
          />
        ) : null}
      </button>

      {hasPreviewContent ? (
        <div
          className={[
            "overflow-hidden transition-[max-height,opacity] duration-200",
            isExpanded ? "max-h-[18rem] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
          style={{ pointerEvents: isExpanded ? "auto" : "none" }}
        >
          <div className="max-h-[18rem] overflow-y-auto border-t border-[var(--app-shell-border)] px-3 pt-0.5 pb-3">
            {previewContent}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countLatestTurnPreviewItems(group: RenderableConversationGroup) {
  const countRenderableItems = (items: Array<{ type: string }>) =>
    items.filter((item) => item.type !== "workedFor").length;

  return countRenderableItems(group.activityItems);
}

function findLatestTurnWorkedForItem(group: RenderableConversationGroup) {
  const items = [...group.activityItems, ...group.postAssistantItems];
  for (const item of items) {
    if (item.type === "workedFor") {
      return item;
    }
  }
  return null;
}

function buildWorkedForSummary(
  workedForItem: ThreadConversationWorkedFor | null,
  itemCount: number,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (workedForItem === null) {
    return itemCount > 0 ? t("app.chat.latestTurnPreview.items", { count: itemCount }) : null;
  }

  if (workedForItem.status === "working") {
    return t("composer.latestTurn.working");
  }

  const durationLabel = formatWorkedForDuration(
    workedForItem.completedAtMs === null
      ? 0
      : Math.max(0, workedForItem.completedAtMs - workedForItem.startedAtMs),
  );

  if (durationLabel === null) {
    return itemCount > 0 ? t("app.chat.latestTurnPreview.items", { count: itemCount }) : t("composer.latestTurn");
  }

  if (itemCount > 0) {
    return `${durationLabel} · ${t("app.chat.latestTurnPreview.items", { count: itemCount })}`;
  }

  return durationLabel;
}

function formatWorkedForDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}
