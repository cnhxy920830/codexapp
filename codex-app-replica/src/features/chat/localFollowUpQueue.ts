import type { ThreadConversationUserInput } from "../../services/history";

export type QueuedLocalFollowUp = {
  id: string;
  threadId: string;
  cwd: string | null;
  input?: ThreadConversationUserInput[] | null;
  text: string;
};

export function enqueueQueuedLocalFollowUp(
  queue: QueuedLocalFollowUp[],
  followUp: Omit<QueuedLocalFollowUp, "id">,
) {
  return [
    ...queue,
    {
      ...followUp,
      id: createQueuedLocalFollowUpId(),
    },
  ];
}

export function queuedLocalFollowUpsForThread(queue: QueuedLocalFollowUp[], threadId: string | null) {
  if (!threadId) {
    return [];
  }
  return queue.filter((entry) => entry.threadId === threadId);
}

export function removeQueuedLocalFollowUp(queue: QueuedLocalFollowUp[], id: string) {
  return queue.filter((entry) => entry.id !== id);
}

export function takeNextQueuedLocalFollowUp(queue: QueuedLocalFollowUp[], threadId: string) {
  const index = queue.findIndex((entry) => entry.threadId === threadId);
  if (index === -1) {
    return { followUp: null, remaining: queue };
  }
  return {
    followUp: queue[index],
    remaining: queue.filter((_, entryIndex) => entryIndex !== index),
  };
}

export function prependQueuedLocalFollowUp(queue: QueuedLocalFollowUp[], followUp: QueuedLocalFollowUp) {
  return [followUp, ...queue];
}

function createQueuedLocalFollowUpId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `queued-follow-up:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}
