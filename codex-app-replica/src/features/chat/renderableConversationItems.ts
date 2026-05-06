import type { ThreadConversationItem } from "../../services/history";

export function buildRenderableConversationItems(items: ThreadConversationItem[]) {
  const exitedReviewTextByTurnId = new Map(
    items
      .filter(
        (item): item is Extract<ThreadConversationItem, { type: "exitedReviewMode" }> =>
          item.type === "exitedReviewMode",
      )
      .map((item) => [item.turnId, item.review.trim()]),
  );

  return items.filter((item) => {
    if (item.type !== "agentMessage") {
      return true;
    }
    const exitedReviewText = exitedReviewTextByTurnId.get(item.turnId);
    return !exitedReviewText || exitedReviewText !== item.text.trim();
  });
}
