import type { MessageKey } from "../../i18n/messages";
import type { ThreadConversationTurnDiff } from "../../services/history";
import { showDiff } from "../../services/windowNavigation";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type TurnDiffCardProps = {
  conversationCwd: string | null;
  conversationId: string;
  item: ThreadConversationTurnDiff;
  t: Translate;
};

export function TurnDiffCard({ conversationCwd, conversationId, item, t }: TurnDiffCardProps) {
  const unifiedDiff = item.unifiedDiff.trim();
  if (unifiedDiff.length === 0) {
    return null;
  }

  const handleReviewChanges = async () => {
    try {
      await showDiff({
        conversationId,
        unifiedDiff: item.unifiedDiff,
        cwd: conversationCwd,
      });
    } catch {
      // Keep the diff visible even if the desktop bridge is unavailable.
    }
  };

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-title text-[14px] font-medium">Diff</div>
        <button
          type="button"
          onClick={() => void handleReviewChanges()}
          className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
        >
          {t("codex.unifiedDiff.reviewChanges")}
        </button>
      </div>
      <pre className="app-code-block mt-3 overflow-x-auto rounded-[14px] px-4 py-3 text-[12px] leading-6 whitespace-pre-wrap">
        {item.unifiedDiff}
      </pre>
    </div>
  );
}
