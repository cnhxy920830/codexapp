import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AnsiText } from "../../components/AnsiText";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n/i18n";
import type { AppToast } from "../../components/AppToastRegion";
import {
  cancelPendingWorktree,
  onPendingWorktreesUpdated,
  readPendingWorktreesSnapshot,
  retryPendingWorktree,
  updatePendingWorktreeMetadata,
  type PendingWorktreeEntry,
} from "../../services/pendingWorktrees";
import {
  retryPendingWorktreeConversationStart,
  usePendingWorktreeConversationStart,
} from "./pendingWorktreeConversationStart";
import { startPendingWorktreeConversationWithMetadata } from "./startPendingWorktreeConversation";
import { UserPromptMessageCard } from "../chat/UserPromptMessageCard";

export function WorktreeInitV2Page({
  pendingWorktreeId,
  conversationPathBuilder = buildDefaultConversationPath,
  homePath = "/",
  onConversationReady,
  onEditEnvironment,
  onNavigateToPath,
  onNavigateHome,
  onNavigateToNewConversation,
  onShowToast,
}: {
  pendingWorktreeId: string;
  conversationPathBuilder?: (conversationId: string) => string;
  homePath?: string;
  onConversationReady?: (conversationId: string) => void | Promise<void>;
  onEditEnvironment?: (params: {
    workspaceRoot: string;
    configPath: string | null;
    mode: "edit" | "preview";
  }) => void;
  onNavigateToPath?: (path: string) => void;
  onNavigateHome?: () => void;
  onNavigateToNewConversation?: (params: { prefillPrompt: string }) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<PendingWorktreeEntry[] | null>(null);
  const [isExitActionPending, setIsExitActionPending] = useState(false);
  const clearedAttentionIdsRef = useRef(new Set<string>());
  const handledReadyConversationIdsRef = useRef(new Set<string>());
  const outputRef = useRef<HTMLDivElement | null>(null);

  const entry = useMemo(
    () => entries?.find((candidate) => candidate.id === pendingWorktreeId) ?? null,
    [entries, pendingWorktreeId],
  );
  const conversationStart = usePendingWorktreeConversationStart(pendingWorktreeId);
  const handleClearAttention = useEffectEvent(() => {
    if (pendingWorktreeId.length === 0 || entry === null) {
      return;
    }

    if (clearedAttentionIdsRef.current.has(entry.id)) {
      return;
    }

    clearedAttentionIdsRef.current.add(entry.id);
    void updatePendingWorktreeMetadata({
      hostId: entry.hostId,
      id: entry.id,
      update: { type: "needsAttention", needsAttention: false },
    }).catch(() => undefined);
  });

  useEffect(() => {
    let cancelled = false;

    void readPendingWorktreesSnapshot()
      .then((nextEntries) => {
        if (!cancelled) {
          setEntries(nextEntries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void onPendingWorktreesUpdated((nextEntries) => {
      setEntries(nextEntries);
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
    clearedAttentionIdsRef.current.delete(pendingWorktreeId);
    handledReadyConversationIdsRef.current.clear();
  }, [pendingWorktreeId]);

  useEffect(() => {
    handleClearAttention();
  }, [handleClearAttention, pendingWorktreeId]);

  useEffect(() => {
    const container = outputRef.current;
    if (container && entry !== null) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entry]);

  useEffect(() => {
    if (
      conversationStart?.state !== "succeeded" ||
      handledReadyConversationIdsRef.current.has(conversationStart.conversationId)
    ) {
      return;
    }

    handledReadyConversationIdsRef.current.add(conversationStart.conversationId);
    void onConversationReady?.(conversationStart.conversationId);
  }, [conversationStart, onConversationReady]);

  const navigateToPath = useEffectEvent((path: string) => {
    if (onNavigateToPath) {
      onNavigateToPath(path);
      return;
    }

    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.replaceState(window.history.state, "", path);
    }
  });

  if (isExitActionPending) {
    return null;
  }

  if (entry === undefined || entries === null) {
    return null;
  }

  if (entry === null) {
    if (onNavigateHome) {
      onNavigateHome();
      return null;
    }
    navigateToPath(homePath);
    return null;
  }

  if (conversationStart?.state === "succeeded") {
    navigateToPath(conversationPathBuilder(conversationStart.conversationId));
        return null;
  }

  const isRunning = entry.phase === "queued" || entry.phase === "creating";
  const isConversationStartFailed = conversationStart?.state === "failed";
  const isStartingConversation = conversationStart?.state === "starting";
  const showFailureActions = entry.phase === "failed" || isConversationStartFailed;
  const isStableWorktree = entry.launchMode === "create-stable-worktree";

  return (
    <main className="h-full overflow-hidden bg-[var(--app-shell-surface)] text-[13px] text-[var(--app-shell-text)]">
      <div className="flex h-full flex-col overflow-y-auto p-[var(--padding-panel)]">
        <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-4">
          <UserPromptMessageCard hostId={entry.hostId} message={entry.prompt} />
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-token-description-foreground">
              {isStartingConversation ? t("worktreeInitV2.status.startingConversation") : null}
              {!isStartingConversation && !isConversationStartFailed && entry.phase === "worktree-ready"
                ? t("worktreeInitV2.status.success")
                : null}
              {isConversationStartFailed ? t("worktreeInitV2.status.startConversationError") : null}
              {!isConversationStartFailed && entry.phase === "failed" ? t("worktreeInitV2.status.error") : null}
              {isRunning && entry.launchMode === "fork-conversation"
                ? t("worktreeInitV2.status.runningFork")
                : null}
              {isRunning && entry.launchMode !== "fork-conversation"
                ? t("worktreeInitV2.status.running")
                : null}
            </div>
            {isRunning || showFailureActions ? (
              <div className="flex items-center gap-2">
                {isRunning && !isStableWorktree ? (
                  <Button
                    color="ghost"
                    loading={isExitActionPending}
                    onClick={() => {
                      void handleWorkLocallyInstead(entry);
                    }}
                  >
                    {t("worktreeInitV2.workLocallyInstead")}
                  </Button>
                ) : null}
                {isRunning ? (
                  <Button
                    color="ghost"
                    loading={isExitActionPending}
                    onClick={() => {
                      void handleCancel(entry);
                    }}
                  >
                    {t("worktreeInitV2.cancel")}
                  </Button>
                ) : null}
                {showFailureActions ? (
                  <>
                    {entry.phase === "failed" ? (
                      <Button
                        color="ghost"
                        onClick={() => {
                          if (onEditEnvironment) {
                            onEditEnvironment({
                              workspaceRoot: entry.sourceWorkspaceRoot,
                              configPath: entry.localEnvironmentConfigPath,
                              mode: "edit",
                            });
                          }
                        }}
                      >
                        {t("worktreeInitV2.editEnvironment")}
                      </Button>
                    ) : null}
                    <Button
                      color="ghost"
                      onClick={() => {
                        void handleRetry(entry);
                      }}
                    >
                      {t("codex.common.retry")}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div
            ref={outputRef}
            className="vertical-scroll-fade-mask text-size-code flex max-h-[500px] min-h-[500px] flex-1 flex-col overflow-x-auto overflow-y-auto rounded-lg border border-token-border bg-token-editor-background p-3 font-mono text-sm whitespace-pre text-token-input-placeholder-foreground"
          >
            {entry.outputText.length > 0 ? (
              <AnsiText className="text-sm text-token-foreground">{entry.outputText}</AnsiText>
            ) : (
              <span className="text-token-input-placeholder-foreground">{t("worktreeInitV2.output.empty")}</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );

  async function handleCancel(currentEntry: PendingWorktreeEntry) {
    setIsExitActionPending(true);
    try {
      await cancelPendingWorktree({ hostId: currentEntry.hostId, id: currentEntry.id });
      if (onNavigateToNewConversation) {
        onNavigateToNewConversation({ prefillPrompt: currentEntry.prompt.trim() });
      } else if (onNavigateHome) {
        onNavigateHome();
      }
    } catch (error) {
      setIsExitActionPending(false);
      onShowToast?.({
        tone: "error",
        message: "Unable to cancel worktree setup",
        description: getErrorMessage(error, "The pending worktree could not be cancelled."),
      });
    }
  }

  async function handleWorkLocallyInstead(currentEntry: PendingWorktreeEntry) {
    setIsExitActionPending(true);
    try {
      await cancelPendingWorktree({ hostId: currentEntry.hostId, id: currentEntry.id });
      const conversationId = await startPendingWorktreeConversationWithMetadata(
        currentEntry,
        currentEntry.sourceWorkspaceRoot,
      );
      await onConversationReady?.(conversationId);
    } catch (error) {
      void cancelPendingWorktree({ hostId: currentEntry.hostId, id: currentEntry.id }).catch(() => undefined);
      onShowToast?.({
        tone: "error",
        message: "Error starting chat",
        description: getErrorMessage(error, "Unable to start the local conversation."),
      });
      setIsExitActionPending(false);
    }
  }

  async function handleRetry(currentEntry: PendingWorktreeEntry) {
    if (currentEntry.phase === "failed") {
      await retryPendingWorktree({ hostId: currentEntry.hostId, id: currentEntry.id });
      return;
    }

    retryPendingWorktreeConversationStart(currentEntry.id);
  }
}

function buildDefaultConversationPath(conversationId: string) {
  return `/local/${encodeURIComponent(conversationId)}`;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return fallbackMessage;
}
