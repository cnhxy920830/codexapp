import { useEffect, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyPathIcon,
  DownloadIcon,
  OpenInEditorIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversationPlan } from "../../services/history";
import { showPlanSummary } from "../../services/windowNavigation";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type PlanSummaryItemCardProps = {
  conversationId: string;
  conversationCwd?: string | null;
  conversationHostId?: string | null;
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
const COLLAPSED_PLAN_HEIGHT = 320;

export function PlanSummaryItemCard({
  conversationId,
  conversationCwd = null,
  conversationHostId = null,
  defaultCollapsed,
  item,
  isWriting = false,
  showOpenButton = true,
  t,
}: PlanSummaryItemCardProps) {
  const summaryText = "text" in item ? item.text : item.content;
  const completed = "completed" in item ? item.completed : true;
  const isWritingPlan = isWriting || !completed;
  const hasVisibleSummaryText = summaryText.trim().length > 0;
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsCollapsed(defaultCollapsed ?? false);
  }, [defaultCollapsed]);

  useEffect(() => {
    if (!copied || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const showCompletedActions = !isWritingPlan;
  const collapseButtonTooltip = isCollapsed
    ? t("localConversation.planSummary.expandTooltip")
    : t("localConversation.planSummary.collapseTooltip");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
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
    <div className="relative overflow-clip rounded-lg bg-token-foreground/5">
      <div className="relative flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div
          className={[
            "text-base font-semibold leading-tight text-token-foreground",
            isWritingPlan ? "loading-shimmer-pure-text" : "",
          ].join(" ")}
        >
          {isWritingPlan ? t("localConversation.planSummary.titleWriting") : t("localConversation.planSummary.title")}
        </div>
        <div className="flex items-center gap-1">
          {showCompletedActions && hasVisibleSummaryText ? (
            <PlanSummaryActionTooltip content={t("localConversation.planSummary.download")}>
              <Button
                aria-label={t("localConversation.planSummary.download")}
                color="ghost"
                onClick={handleDownload}
                size="icon"
              >
                <DownloadIcon className="icon-2xs" />
              </Button>
            </PlanSummaryActionTooltip>
          ) : null}
          {showCompletedActions && hasVisibleSummaryText ? (
            <PlanSummaryActionTooltip
              content={copied ? t("copyButton.copied") : t("copyButton.copyAriaLabel")}
              disabled={copied}
            >
              {copied ? (
                <Button
                  aria-label={t("copyButton.copiedAriaLabel")}
                  className="text-token-foreground"
                  color="ghost"
                  size="icon"
                >
                  <CheckIcon className="icon-2xs" />
                </Button>
              ) : (
                <Button
                  aria-label={t("copyButton.copyAriaLabel")}
                  color="ghost"
                  onClick={() => void handleCopy()}
                  size="icon"
                >
                  <CopyPathIcon className="icon-2xs" />
                </Button>
              )}
            </PlanSummaryActionTooltip>
          ) : null}
          {showCompletedActions && showOpenButton ? (
            <PlanSummaryActionTooltip content={t("localConversation.planSummary.openInNewWindow.tooltip")}>
              <Button
                color="outline"
                className="gap-1"
                onClick={() => void handleOpen()}
              >
                <span>{t("localConversation.planSummary.openInNewWindow")}</span>
                <OpenInEditorIcon className="icon-2xs" />
              </Button>
            </PlanSummaryActionTooltip>
          ) : null}
          <PlanSummaryActionTooltip content={collapseButtonTooltip}>
            <Button
              aria-label={
                isCollapsed
                  ? t("localConversation.planSummary.expand")
                  : t("localConversation.planSummary.collapse")
              }
              color="ghost"
              onClick={() => setIsCollapsed((current) => !current)}
              size="icon"
            >
              <ChevronDownIcon
                className={[
                  "icon-2xs transition-transform",
                  isCollapsed ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </Button>
          </PlanSummaryActionTooltip>
        </div>
      </div>

      <div
        className="relative overflow-hidden"
        style={{
          height: isCollapsed ? COLLAPSED_PLAN_HEIGHT : "auto",
        }}
      >
        <div className="px-4 py-3">
          <MarkdownPreview
            className="text-size-chat"
            cwd={conversationCwd}
            hostId={conversationHostId}
            text={summaryText}
            variant="notebook"
          />
        </div>
        {isCollapsed ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-token-input-background to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <Button
                className="pointer-events-auto"
                color="primary"
                onClick={() => setIsCollapsed(false)}
              >
                {t("localConversation.planSummary.viewPlan")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PlanSummaryActionTooltip({
  children,
  content,
  disabled = false,
}: {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      {disabled ? null : (
        <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden max-w-[min(32rem,calc(100vw-16px))] -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
          {content}
        </div>
      )}
    </div>
  );
}
