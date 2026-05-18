import { useSyncExternalStore } from "react";

type PendingWorktreeConversationStartState =
  | { state: "waiting" }
  | { state: "starting" }
  | { state: "failed" }
  | { state: "succeeded"; conversationId: string };

type Listener = () => void;

const pendingWorktreeConversationStarts = new Map<string, PendingWorktreeConversationStartState>();
const listeners = new Set<Listener>();

export function addPendingWorktreeConversationStart(pendingWorktreeId: string) {
  pendingWorktreeConversationStarts.set(pendingWorktreeId, { state: "waiting" });
  notify();
}

export function beginPendingWorktreeConversationStart(pendingWorktreeId: string) {
  if (pendingWorktreeConversationStarts.get(pendingWorktreeId)?.state !== "waiting") {
    return false;
  }

  pendingWorktreeConversationStarts.set(pendingWorktreeId, { state: "starting" });
  notify();
  return true;
}

export function failPendingWorktreeConversationStart(pendingWorktreeId: string) {
  if (!pendingWorktreeConversationStarts.has(pendingWorktreeId)) {
    return;
  }

  pendingWorktreeConversationStarts.set(pendingWorktreeId, { state: "failed" });
  notify();
}

export function retryPendingWorktreeConversationStart(pendingWorktreeId: string) {
  if (!pendingWorktreeConversationStarts.has(pendingWorktreeId)) {
    return;
  }

  pendingWorktreeConversationStarts.set(pendingWorktreeId, { state: "waiting" });
  notify();
}

export function succeedPendingWorktreeConversationStart(
  pendingWorktreeId: string,
  conversationId: string,
) {
  if (!pendingWorktreeConversationStarts.has(pendingWorktreeId)) {
    return;
  }

  pendingWorktreeConversationStarts.set(pendingWorktreeId, {
    state: "succeeded",
    conversationId,
  });
  notify();
}

export function removePendingWorktreeConversationStart(pendingWorktreeId: string) {
  if (pendingWorktreeConversationStarts.delete(pendingWorktreeId)) {
    notify();
  }
}

export function usePendingWorktreeConversationStart(pendingWorktreeId: string | null) {
  return useSyncExternalStore(subscribe, () => getPendingWorktreeConversationStart(pendingWorktreeId), snapshot);
}

export function getPendingWorktreeConversationStart(pendingWorktreeId: string | null) {
  if (pendingWorktreeId === null) {
    return null;
  }

  return pendingWorktreeConversationStarts.get(pendingWorktreeId) ?? null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return null;
}

function notify() {
  listeners.forEach((listener) => listener());
}
