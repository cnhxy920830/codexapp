import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversationPlan } from "../../services/history";
import type { PendingPlanSummaryState } from "../../services/windowNavigation";
import { PlanSummaryItemCard } from "./PlanSummaryItemCard";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type PlanSummaryPageProps = {
  planSummary: PendingPlanSummaryState | null;
  t: Translate;
};

const PAGE_ITEM_ID = "plan-summary-page";

export function PlanSummaryPage({ planSummary, t }: PlanSummaryPageProps) {
  if (!planSummary?.planContent || !planSummary?.conversationId) {
    return <PlanSummaryPageLoading />;
  }

  const item: ThreadConversationPlan = {
    type: "plan",
    id: PAGE_ITEM_ID,
    turnId: PAGE_ITEM_ID,
    text: planSummary.planContent,
  };

  return (
    <div className="overflow-y-auto p-6">
      <PlanSummaryItemCard
        conversationId={planSummary.conversationId}
        defaultCollapsed={false}
        item={item}
        showOpenButton={false}
        t={t}
      />
    </div>
  );
}

function PlanSummaryPageLoading() {
  return (
    <div className="p-6">
      <div className="animate-pulse overflow-hidden rounded-[18px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg)]">
        <div className="flex items-center gap-3 border-b border-[var(--app-shell-border)] px-4 py-3">
          <div className="h-8 w-8 rounded-[10px] bg-[var(--app-shell-card-bg-muted)]" />
          <div className="h-4 w-24 rounded bg-[var(--app-shell-card-bg-muted)]" />
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="h-3 w-5/6 rounded bg-[var(--app-shell-card-bg-muted)]" />
          <div className="h-3 w-4/6 rounded bg-[var(--app-shell-card-bg-muted)]" />
          <div className="h-3 w-3/6 rounded bg-[var(--app-shell-card-bg-muted)]" />
        </div>
      </div>
    </div>
  );
}
