import { useEffect, useEffectEvent } from "react";
import {
  onPendingWorktreesUpdated,
  readPendingWorktreesSnapshot,
  type PendingWorktreeEntry,
} from "../../services/pendingWorktrees";
import {
  beginPendingWorktreeConversationStart,
  failPendingWorktreeConversationStart,
  getPendingWorktreeConversationStart,
  removePendingWorktreeConversationStart,
  succeedPendingWorktreeConversationStart,
} from "./pendingWorktreeConversationStart";
import { startPendingWorktreeConversationWithMetadata } from "./startPendingWorktreeConversation";

export function PendingWorktreeConversationStartManager() {
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const handlePendingWorktreesUpdated = useEffectEvent(async (entries: PendingWorktreeEntry[]) => {
    for (const entry of entries) {
      const conversationState = getPendingWorktreeConversationStart(entry.id);
      if (conversationState === null || conversationState.state !== "waiting") {
        continue;
      }

      if (entry.phase !== "worktree-ready" || entry.worktreeWorkspaceRoot === null) {
        continue;
      }

      if (!beginPendingWorktreeConversationStart(entry.id)) {
        continue;
      }

      try {
        const conversationId = await startPendingWorktreeConversationWithMetadata(
          entry,
          entry.worktreeWorkspaceRoot,
        );
        succeedPendingWorktreeConversationStart(entry.id, conversationId);
        if (shouldDismissPendingWorktree(pathname, entry.id)) {
          removePendingWorktreeConversationStart(entry.id);
        }
      } catch {
        failPendingWorktreeConversationStart(entry.id);
      }
    }

    for (const entry of entries) {
      const conversationState = getPendingWorktreeConversationStart(entry.id);
      if (conversationState?.state === "succeeded" && shouldDismissPendingWorktree(pathname, entry.id)) {
        removePendingWorktreeConversationStart(entry.id);
      }
    }
  });

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void readPendingWorktreesSnapshot()
      .then((entries) => {
        if (!disposed) {
          void handlePendingWorktreesUpdated(entries);
        }
      })
      .catch(() => undefined);

    void onPendingWorktreesUpdated((entries) => {
      void handlePendingWorktreesUpdated(entries);
    }).then((release) => {
      if (disposed) {
        release();
        return;
      }
      cleanup = release;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const entries = readPendingWorktreesSnapshot()
      .then((snapshot) => {
        for (const entry of snapshot) {
          const conversationState = getPendingWorktreeConversationStart(entry.id);
          if (conversationState?.state === "succeeded" && shouldDismissPendingWorktree(pathname, entry.id)) {
            removePendingWorktreeConversationStart(entry.id);
          }
        }
      })
      .catch(() => undefined);

    void entries;
  }, [pathname]);

  return null;
}

function shouldDismissPendingWorktree(pathname: string, pendingWorktreeId: string) {
  return pathname === `/worktree-init-v2/${encodeURIComponent(pendingWorktreeId)}` ||
    pathname === `/hotkey-window/worktree-init-v2/${encodeURIComponent(pendingWorktreeId)}`;
}
