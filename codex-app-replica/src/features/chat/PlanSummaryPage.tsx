import { useI18n } from "../../i18n/i18n";
import type { PendingPlanSummaryState } from "../../services/windowNavigation";
import { PlanSummaryItemCard } from "./PlanSummaryItemCard";

type PlanSummaryPageProps = {
  routeState: unknown;
};

export function PlanSummaryPage({ routeState }: PlanSummaryPageProps) {
  const { t } = useI18n();
  const planSummary = resolvePlanSummaryRouteState(routeState);

  if (planSummary == null) {
    return <PlanSummaryPageLoading />;
  }

  const item = {
    type: "assistant-message",
    content: planSummary.planContent,
    sentAtMs: null,
    completed: true,
    phase: null,
    structuredOutput: undefined,
  } as const;

  return (
    <div className="overflow-y-auto p-[var(--padding-panel)]">
      <PlanSummaryItemCard
        conversationId={planSummary.conversationId}
        item={item}
        showOpenButton={false}
        t={t}
      />
    </div>
  );
}

function resolvePlanSummaryRouteState(routeState: unknown): PendingPlanSummaryState | null {
  if (routeState == null || typeof routeState !== "object") {
    return null;
  }

  const record = routeState as Record<string, unknown>;
  const rawConversationId = record.conversationId;
  const rawPlanContent = record.planContent;

  if (typeof rawConversationId !== "string" || typeof rawPlanContent !== "string") {
    return null;
  }

  const conversationId = rawConversationId.trim();
  if (conversationId.length === 0 || rawPlanContent.length === 0) {
    return null;
  }

  return {
    conversationId,
    planContent: rawPlanContent,
  };
}

function PlanSummaryPageLoading() {
  return (
    <div className="p-[var(--padding-panel)]">
      <div className="animate-pulse overflow-hidden rounded-2xl border border-token-border bg-token-editor-background/50">
        <div className="flex items-center gap-3 border-b border-token-border/60 px-4 py-3">
          <div className="size-8 rounded-lg bg-token-foreground/10" />
          <div className="h-4 w-24 rounded bg-token-foreground/20" />
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="h-3 w-5/6 rounded bg-token-foreground/10" />
          <div className="h-3 w-4/6 rounded bg-token-foreground/10" />
          <div className="h-3 w-3/6 rounded bg-token-foreground/10" />
        </div>
      </div>
    </div>
  );
}
