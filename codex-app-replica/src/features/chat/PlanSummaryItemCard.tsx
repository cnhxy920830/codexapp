import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  CopyPathIcon,
  OpenInEditorIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversationPlan } from "../../services/history";
import { showPlanSummary } from "../../services/windowNavigation";
import { renderMessageContent } from "./messageContent";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type PlanSummaryItemCardProps = {
  conversationId: string;
  defaultCollapsed?: boolean;
  item: ThreadConversationPlan | PlanSummaryAssistantMessageItem;
  isWriting?: boolean;
  showOpenButton?: boolean;
  t: Translate;
};

type PlanSummaryAssistantMessageItem = {
  type: "assistant-message";
  content: string;
  completed: boolean;
};

const PLAN_DOWNLOAD_NAME = "PLAN.md";

export function PlanSummaryItemCard({
  conversationId,
  defaultCollapsed,
  item,
  isWriting = false,
  showOpenButton = true,
  t,
}: PlanSummaryItemCardProps) {
  const summaryText = "text" in item ? item.text : item.content;
  const completed = "completed" in item ? item.completed : true;
  const isWritingPlan = isWriting || !completed;
  const text = summaryText.trim();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? !isWritingPlan);

  useEffect(() => {
    setIsCollapsed(defaultCollapsed ?? !isWritingPlan);
  }, [defaultCollapsed, isWritingPlan]);

  useEffect(() => {
    if (isWriting) {
      setIsCollapsed(false);
    }
  }, [isWriting]);

  if (text.length === 0) {
    return null;
  }

  const showCompletedActions = !isWritingPlan;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch {
      // Keep the plan summary visible if clipboard access is unavailable.
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summaryText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = PLAN_DOWNLOAD_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = async () => {
    try {
      await showPlanSummary({
        conversationId,
        planContent: summaryText,
      });
    } catch {
      // Keep the inline plan summary usable when desktop handoff fails.
    }
  };

  return (
    <div className="app-card overflow-hidden rounded-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div
          className={[
            "text-[16px] font-semibold leading-tight text-[var(--app-shell-text)]",
            isWritingPlan ? "loading-shimmer-pure-text" : "",
          ].join(" ")}
        >
          {isWritingPlan ? t("localConversation.planSummary.titleWriting") : t("localConversation.planSummary.title")}
        </div>
        <div className="flex items-center gap-1">
          {showCompletedActions ? (
            <button
              type="button"
              onClick={handleDownload}
              className="app-control-weak rounded-full px-2.5 py-1 text-[11px]"
            >
              {t("localConversation.planSummary.download")}
            </button>
          ) : null}
          {showCompletedActions ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={t("localConversation.planSummary.copy")}
              className="app-control-weak rounded-full p-2"
            >
              <CopyPathIcon className="h-4 w-4" />
            </button>
          ) : null}
          {showCompletedActions && showOpenButton ? (
            <button
              type="button"
              onClick={() => void handleOpen()}
              className="app-control flex items-center gap-1 rounded-full px-3 py-1 text-[12px]"
            >
              <span>{t("localConversation.planSummary.openInNewWindow")}</span>
              <OpenInEditorIcon className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={
              isCollapsed
                ? t("localConversation.planSummary.expand")
                : t("localConversation.planSummary.collapse")
            }
            onClick={() => setIsCollapsed((current) => !current)}
            className="app-control-weak rounded-full p-2"
          >
            <ChevronDownIcon
              className={[
                "h-4 w-4 transition-transform",
                isCollapsed ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      <div className={isCollapsed ? "relative max-h-[320px] overflow-hidden" : undefined}>
        <div className="px-4 pb-4">{renderMessageContent(summaryText)}</div>
        {isCollapsed ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--app-shell-card-bg)] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="app-button-primary pointer-events-auto rounded-full px-4 py-1.5 text-[12px]"
              >
                {t("localConversation.planSummary.viewPlan")}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
