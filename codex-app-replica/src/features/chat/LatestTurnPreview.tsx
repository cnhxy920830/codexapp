import { useEffect, useState, type ReactNode } from "react";
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
  const headerLabel = itemCount > 0 ? t("app.chat.latestTurnPreview.items", { count: itemCount }) : null;
  const title = headerLabel ?? (isTurnInProgress ? t("composer.latestTurn.working") : t("composer.latestTurn"));
  const hasPreviewContent = previewContent !== null;

  if (!hasPreviewContent && !isTurnInProgress && itemCount === 0) {
    return null;
  }

  return (
    <div className="app-card rounded-[18px] px-4 py-4">
      <button
        type="button"
        onClick={() => {
          if (hasPreviewContent) {
            setIsExpanded((value) => !value);
          }
        }}
        aria-expanded={hasPreviewContent ? isExpanded : undefined}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="app-title text-[13px] font-medium">{title}</div>
        </div>
        {hasPreviewContent ? (
          <ForwardNavigationIcon
            className={[
              "mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
              isExpanded ? "rotate-90" : "",
            ].join(" ")}
          />
        ) : null}
      </button>

      {hasPreviewContent && isExpanded ? <div className="mt-3">{previewContent}</div> : null}
    </div>
  );
}

function countLatestTurnPreviewItems(group: RenderableConversationGroup) {
  const countRenderableItems = (items: Array<{ type: string }>) =>
    items.filter((item) => item.type !== "workedFor").length;

  return countRenderableItems(group.activityItems);
}
