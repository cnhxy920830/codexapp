import { useState } from "react";
import { ForwardNavigationIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { MultiAgentGroupItem } from "./renderableConversationItems";
import {
  buildMultiAgentGroupRows,
  resolveMultiAgentActionLabel,
  resolveMultiAgentCountLabel,
} from "./multiAgentAction";

export function MultiAgentGroupSummary({
  defaultExpanded = false,
  item,
  t,
}: {
  defaultExpanded?: boolean;
  item: MultiAgentGroupItem;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const actionLabel = resolveMultiAgentActionLabel(item.action, item.status, t, "header");
  const countLabel = resolveMultiAgentCountLabel(item.items, t);
  const rows = buildMultiAgentGroupRows(item.items, t);

  return (
    <div className="app-card-muted rounded-[16px] px-4 py-3">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="app-title text-[13px] font-medium">
            {t("localConversation.multiAgentAction.header", {
              action: actionLabel,
              countLabel,
            })}
          </div>
        </div>
        <ForwardNavigationIcon
          className={[
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
            isExpanded ? "rotate-90" : "",
          ].join(" ")}
        />
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-1.5">
          {rows.map((row, index) => (
            <div
              key={`${item.id}:row:${index}`}
              className="app-text-muted break-words rounded-[12px] bg-[var(--app-shell-right)] px-3 py-2 text-[12px] leading-5"
            >
              {row}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
