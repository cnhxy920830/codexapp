import { useEffect, useState, type ReactNode } from "react";
import { ForwardNavigationIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { RenderableConversationGroup } from "./renderableConversationGroups";
import { renderMessageContent } from "./messageContent";

type LatestTurnPreviewProps = {
  group: RenderableConversationGroup;
  isTurnInProgress: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function LatestTurnPreview({ group, isTurnInProgress, t }: LatestTurnPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [group.id]);

  const bodyBlocks = buildLatestTurnPreviewBlocks(group);
  const itemCount = bodyBlocks.length > 0 ? bodyBlocks.length : countLatestTurnPreviewItems(group);
  const body = buildLatestTurnPreviewBody(bodyBlocks, itemCount, t);
  const headerLabel = itemCount > 0 ? t("app.chat.latestTurnPreview.items", { count: itemCount }) : null;
  const title = headerLabel ?? (isTurnInProgress ? t("composer.latestTurn.working") : t("composer.latestTurn"));
  const canExpand = body !== null;
  if (!canExpand && !isTurnInProgress && itemCount === 0) {
    return null;
  }

  return (
    <div className="app-card rounded-[18px] px-4 py-4">
      <button
        type="button"
        onClick={() => {
          if (canExpand) {
            setIsExpanded((value) => !value);
          }
        }}
        aria-expanded={canExpand ? isExpanded : undefined}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="app-title text-[13px] font-medium">{title}</div>
        </div>
        {canExpand ? (
          <ForwardNavigationIcon
            className={[
              "mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
              isExpanded ? "rotate-90" : "",
            ].join(" ")}
          />
        ) : null}
      </button>

      {canExpand && isExpanded ? <div className="mt-3 space-y-3">{body}</div> : null}
    </div>
  );
}

function buildLatestTurnPreviewBody(
  bodyBlocks: ReactNode[],
  itemCount: number,
  t: LatestTurnPreviewProps["t"],
): ReactNode {
  if (bodyBlocks.length > 0) {
    return <div className="space-y-3">{bodyBlocks.map((block, index) => <div key={index}>{block}</div>)}</div>;
  }

  return itemCount > 0 ? (
    <div className="app-text-muted text-[13px] leading-6">
      {t("app.chat.latestTurnPreview.items", { count: itemCount })}
    </div>
  ) : null;
}

function countLatestTurnPreviewItems(group: RenderableConversationGroup) {
  return (
    group.preUserItems.length +
    group.userItems.length +
    group.activityItems.length +
    group.toolOutputItems.length +
    group.postAssistantItems.length +
    group.remoteTaskCreatedItems.length +
    group.personalityChangedItems.length +
    group.forkedFromConversationItems.length +
    group.modelChangedItems.length +
    group.modelReroutedItems.length +
    (group.todoListItem ? 1 : 0) +
    (group.proposedPlanItem ? 1 : 0) +
    (group.planImplementationItem ? 1 : 0) +
    group.mcpServerElicitationItems.length +
    group.permissionRequestItems.length +
    (group.approvalItem ? 1 : 0) +
    (group.userInputItem ? 1 : 0)
  );
}

function buildLatestTurnPreviewBlocks(group: RenderableConversationGroup) {
  const blocks: ReactNode[] = [];

  const assistantText = group.assistantMessage?.text.trim() ?? "";
  if (assistantText.length > 0) {
    blocks.push(
      <div className="app-card-muted rounded-[14px] px-4 py-3">{renderMessageContent(assistantText)}</div>,
    );
  }

  const planText = group.proposedPlanItem?.text.trim() ?? "";
  if (planText.length > 0) {
    blocks.push(
      <div className="app-card-muted rounded-[14px] px-4 py-3">{renderMessageContent(planText)}</div>,
    );
  }

  const todoListSummary = buildTodoListSummary(group);
  if (todoListSummary !== null) {
    blocks.push(
      <div className="app-card-muted rounded-[14px] px-4 py-3">{renderMessageContent(todoListSummary)}</div>,
    );
  }

  const systemEventText = group.systemEventItem?.content.trim() ?? "";
  if (systemEventText.length > 0) {
    blocks.push(<div className="app-text-muted text-[13px] leading-6">{systemEventText}</div>);
  }

  const unifiedDiffText = group.unifiedDiffItem?.unifiedDiff.trim() ?? "";
  if (unifiedDiffText.length > 0) {
    blocks.push(
      <div className="app-card rounded-[14px] px-4 py-3">
        <div className="app-title text-[13px] font-medium">Diff</div>
        <pre className="app-code-block mt-3 overflow-x-auto rounded-[12px] px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap">
          {unifiedDiffText}
        </pre>
      </div>,
    );
  }

  return blocks;
}

function buildTodoListSummary(group: RenderableConversationGroup) {
  const todoListItem = group.todoListItem;
  if (!todoListItem) {
    return null;
  }

  const lines: string[] = [];
  const explanation = todoListItem.explanation?.trim() ?? "";
  if (explanation.length > 0) {
    lines.push(explanation);
  }
  for (const step of todoListItem.plan) {
    lines.push(`- ${step.status}: ${step.step}`);
  }
  return lines.join("\n");
}
