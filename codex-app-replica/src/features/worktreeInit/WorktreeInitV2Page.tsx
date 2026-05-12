import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
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
  forkConversationFromLatest,
  forkConversationFromTurn,
  setThreadGoal,
  setThreadName,
  startThread,
  startTurnWithInput,
  type TurnStartPermissionOverrides,
  type ThreadConversationUserInput,
} from "../../services/history";
import { setWorktreeOwnerThread } from "../../services/worktrees";

type ConversationStartState =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "succeeded"; conversationId: string }
  | { state: "failed"; errorMessage: string };

export function WorktreeInitV2Page({
  pendingWorktreeId,
  shell,
  onEditEnvironment,
  onNavigateHome,
  onOpenConversation,
  onShowToast,
  onStartNewConversation,
}: {
  pendingWorktreeId: string;
  shell: "default" | "hotkey";
  onEditEnvironment: (params: {
    workspaceRoot: string;
    configPath: string | null;
    mode: "edit" | "preview";
  }) => void;
  onNavigateHome: () => void;
  onOpenConversation: (conversationId: string, shell: "default" | "hotkey") => void | Promise<void>;
  onShowToast?: (toast: AppToast) => void;
  onStartNewConversation: (params: { prefillPrompt: string }) => void;
}) {
  const [entries, setEntries] = useState<PendingWorktreeEntry[] | null>(null);
  const [isExitActionPending, setIsExitActionPending] = useState(false);
  const [conversationStartState, setConversationStartState] = useState<ConversationStartState>({
    state: "idle",
  });
  const clearedAttentionIdsRef = useRef(new Set<string>());
  const redirectedRef = useRef(false);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const entry = useMemo(
    () => entries?.find((candidate) => candidate.id === pendingWorktreeId) ?? null,
    [entries, pendingWorktreeId],
  );
  const isLoading = entries === null;
  const isStartingConversation = conversationStartState.state === "starting";
  const conversationStartFailed = conversationStartState.state === "failed";
  const isRunning = entry?.phase === "queued" || entry?.phase === "creating";
  const isSetupFailed = entry?.phase === "failed";
  const showFailureActions = isSetupFailed || conversationStartFailed;
  const isStableWorktree = entry?.launchMode === "create-stable-worktree";

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
    redirectedRef.current = false;
    clearedAttentionIdsRef.current.delete(pendingWorktreeId);
    setConversationStartState({ state: "idle" });
  }, [pendingWorktreeId]);

  useEffect(() => {
    if (entry === null || clearedAttentionIdsRef.current.has(entry.id)) {
      return;
    }

    clearedAttentionIdsRef.current.add(entry.id);
    void updatePendingWorktreeMetadata({
      hostId: entry.hostId,
      id: entry.id,
      update: { type: "needsAttention", needsAttention: false },
    }).catch(() => undefined);
  }, [entry]);

  useEffect(() => {
    const container = outputRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entry?.outputText]);

  useEffect(() => {
    if (entry !== null || isLoading || isExitActionPending || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    onNavigateHome();
  }, [entry, isExitActionPending, isLoading, onNavigateHome]);

  useEffect(() => {
    if (entry === null) {
      return;
    }

    if (entry.phase === "queued" || entry.phase === "creating" || entry.phase === "failed") {
      setConversationStartState((current) => (current.state === "idle" ? current : { state: "idle" }));
    }
  }, [entry?.id, entry?.phase]);

  useEffect(() => {
    if (entry === null || entry.phase !== "worktree-ready" || entry.launchMode === "create-stable-worktree") {
      return;
    }
    if (conversationStartState.state !== "idle") {
      return;
    }

    let cancelled = false;
    setConversationStartState({ state: "starting" });

    void startPendingWorktreeConversation(entry, entry.worktreeWorkspaceRoot ?? entry.sourceWorkspaceRoot)
      .then(async (conversationId) => {
        await applyStartedConversationMetadata(entry, conversationId);
        if (cancelled) {
          return;
        }
        setConversationStartState({ state: "succeeded", conversationId });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setConversationStartState({
          state: "failed",
          errorMessage: getErrorMessage(error, "Failed to start the conversation."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [conversationStartState.state, entry]);

  useEffect(() => {
    if (conversationStartState.state !== "succeeded" || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    void onOpenConversation(conversationStartState.conversationId, shell);
  }, [conversationStartState, onOpenConversation, shell]);

  if (isLoading) {
    return null;
  }

  if (isExitActionPending) {
    return null;
  }

  if (entry === null) {
    return null;
  }

  return (
    <main className="h-full overflow-hidden bg-[var(--app-shell-surface)] text-[13px] text-[var(--app-shell-text)]">
      <div className="flex h-full flex-col overflow-y-auto p-[var(--padding-panel)]">
        <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-4">
          <PendingWorktreePromptCard prompt={entry.prompt} />
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-token-description-foreground">
              {isStartingConversation ? "Starting conversation." : null}
              {!isStartingConversation && !conversationStartFailed && entry.phase === "worktree-ready"
                ? "Worktree ready."
                : null}
              {conversationStartFailed ? "Worktree ready, but failed to start the conversation." : null}
              {!conversationStartFailed && entry.phase === "failed" ? "Worktree setup failed." : null}
              {isRunning && entry.launchMode === "fork-conversation"
                ? "Creating a worktree to fork this conversation."
                : null}
              {isRunning && entry.launchMode !== "fork-conversation"
                ? "Creating a worktree and running setup."
                : null}
            </div>
            {isRunning || showFailureActions ? (
              <div className="flex items-center gap-2">
                {isRunning && !isStableWorktree ? (
                  <Button
                    color="ghost"
                    loading={false}
                    onClick={() => {
                      void handleWorkLocallyInstead(entry);
                    }}
                  >
                    Work locally instead
                  </Button>
                ) : null}
                {isRunning ? (
                  <Button
                    color="ghost"
                    onClick={() => {
                      void handleCancel(entry);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                {showFailureActions ? (
                  <>
                    {entry.phase === "failed" ? (
                      <Button
                        color="ghost"
                        onClick={() => {
                          onEditEnvironment({
                            workspaceRoot: entry.sourceWorkspaceRoot,
                            configPath: entry.localEnvironmentConfigPath,
                            mode: "edit",
                          });
                        }}
                      >
                        Edit environment
                      </Button>
                    ) : null}
                    <Button
                      color="ghost"
                      onClick={() => {
                        void handleRetry(entry);
                      }}
                    >
                      Retry
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div
            ref={outputRef}
            className="vertical-scroll-fade-mask text-size-code flex min-h-[500px] flex-1 flex-col overflow-x-auto overflow-y-auto rounded-lg border border-token-border bg-token-editor-background p-3 font-mono text-sm whitespace-pre text-token-input-placeholder-foreground"
          >
            {entry.outputText.length > 0 ? (
              <div className="text-token-foreground">{entry.outputText}</div>
            ) : (
              <span className="text-token-input-placeholder-foreground">Waiting for output…</span>
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
      onStartNewConversation({ prefillPrompt: currentEntry.prompt.trim() });
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
      const conversationId = await startPendingWorktreeConversation(
        currentEntry,
        currentEntry.sourceWorkspaceRoot,
      );
      await applyStartedConversationMetadata(currentEntry, conversationId);
      redirectedRef.current = true;
      await onOpenConversation(conversationId, shell);
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

    setConversationStartState({ state: "starting" });
    try {
      const conversationId = await startPendingWorktreeConversation(
        currentEntry,
        currentEntry.worktreeWorkspaceRoot ?? currentEntry.sourceWorkspaceRoot,
      );
      await applyStartedConversationMetadata(currentEntry, conversationId);
      setConversationStartState({ state: "succeeded", conversationId });
    } catch (error) {
      setConversationStartState({
        state: "failed",
        errorMessage: getErrorMessage(error, "Failed to start the conversation."),
      });
    }
  }
}

function PendingWorktreePromptCard({ prompt }: { prompt: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[720px] rounded-[18px] border border-token-border bg-token-dropdown-background px-4 py-3 shadow-sm">
        <div className="whitespace-pre-wrap text-sm leading-6 text-token-foreground">{prompt}</div>
      </div>
    </div>
  );
}

async function startPendingWorktreeConversation(
  entry: PendingWorktreeEntry,
  workspaceRoot: string,
) {
  if (entry.launchMode === "fork-conversation") {
    const sourceConversationId = entry.sourceConversationId?.trim();
    if (!sourceConversationId) {
      throw new Error("Missing source conversation id.");
    }

    if (entry.targetTurnId !== null) {
      return forkConversationFromTurn({
        conversationId: sourceConversationId,
        targetTurnId: entry.targetTurnId,
        cwd: workspaceRoot,
      });
    }

    return forkConversationFromLatest({
      conversationId: sourceConversationId,
      cwd: workspaceRoot,
    });
  }

  if (entry.launchMode !== "start-conversation") {
    throw new Error(`Unsupported launch mode: ${entry.launchMode}`);
  }

  const threadId = await startThread(workspaceRoot);
  const input = normalizePendingConversationInput(entry.startConversationParamsInput, entry.prompt);
  const permissionOverrides = normalizePendingConversationPermissionOverrides(
    entry.startConversationParamsInput,
  );
  if (input.length > 0) {
    await startTurnWithInput({
      threadId,
      input,
      cwd: workspaceRoot,
      ...permissionOverrides,
    });
  }
  return threadId;
}

async function applyStartedConversationMetadata(
  entry: PendingWorktreeEntry,
  conversationId: string,
) {
  if (entry.worktreeGitRoot !== null) {
    await setWorktreeOwnerThread({
      hostId: entry.hostId,
      worktree: entry.worktreeGitRoot,
      conversationId,
    }).catch(() => undefined);
  }

  if (entry.threadGoalObjective !== null) {
    await setThreadGoal({
      threadId: conversationId,
      objective: entry.threadGoalObjective,
    });
  }

  const title = (entry.initialThreadTitle ?? (entry.labelEdited ? entry.label ?? "" : "")).trim();
  if (title.length > 0) {
    await setThreadName({
      threadId: conversationId,
      name: title,
    });
  }
}

function normalizePendingConversationInput(
  value: Record<string, unknown> | null,
  fallbackPrompt: string,
): ThreadConversationUserInput[] {
  const input = Array.isArray(value?.input) ? value.input : null;
  if (input === null) {
    return fallbackPrompt.trim().length > 0
      ? [{ type: "text", text: fallbackPrompt, textElements: [] }]
      : [];
  }

  const normalized = input
    .map(normalizePendingConversationInputItem)
    .filter((item): item is ThreadConversationUserInput => item !== null);
  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackPrompt.trim().length > 0
    ? [{ type: "text", text: fallbackPrompt, textElements: [] }]
    : [];
}

function normalizePendingConversationInputItem(value: unknown): ThreadConversationUserInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "text":
      return {
        type: "text",
        text: typeof record.text === "string" ? record.text : "",
        textElements: [],
      };
    case "image":
      return typeof record.url === "string" ? { type: "image", url: record.url } : null;
    case "localImage":
      return typeof record.path === "string" ? { type: "localImage", path: record.path } : null;
    case "skill":
      return typeof record.name === "string" && typeof record.path === "string"
        ? { type: "skill", name: record.name, path: record.path }
        : null;
    case "mention":
      return typeof record.name === "string" && typeof record.path === "string"
        ? { type: "mention", name: record.name, path: record.path }
        : null;
    default:
      return null;
  }
}

function normalizePendingConversationPermissionOverrides(
  value: Record<string, unknown> | null,
): TurnStartPermissionOverrides {
  return {
    approvalPolicy: normalizePendingConversationApprovalPolicy(value?.approvalPolicy),
    approvalsReviewer:
      typeof value?.approvalsReviewer === "string" && value.approvalsReviewer.trim().length > 0
        ? value.approvalsReviewer.trim()
        : null,
    sandboxPolicy: normalizePendingConversationSandboxPolicy(value?.sandboxPolicy),
  };
}

function normalizePendingConversationApprovalPolicy(value: unknown) {
  if (
    value === "untrusted" ||
    value === "on-failure" ||
    value === "on-request" ||
    value === "never"
  ) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const granularValue = (value as Record<string, unknown>).granular;
  if (!granularValue || typeof granularValue !== "object" || Array.isArray(granularValue)) {
    return null;
  }
  const granularRecord = granularValue as Record<string, unknown>;

  return {
    granular: {
      sandbox_approval: granularRecord.sandbox_approval === true,
      rules: granularRecord.rules === true,
      skill_approval: granularRecord.skill_approval === true,
      request_permissions: granularRecord.request_permissions === true,
      mcp_elicitations: granularRecord.mcp_elicitations === true,
    },
  };
}

function normalizePendingConversationSandboxPolicy(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "readOnly":
      return {
        type: "readOnly" as const,
        networkAccess: record.networkAccess === true,
      };
    case "workspaceWrite":
      return {
        type: "workspaceWrite" as const,
        writableRoots: Array.isArray(record.writableRoots)
          ? record.writableRoots.filter(
              (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
            )
          : [],
        excludeSlashTmp: record.excludeSlashTmp === true,
        excludeTmpdirEnvVar: record.excludeTmpdirEnvVar === true,
        networkAccess: record.networkAccess === true,
      };
    case "dangerFullAccess":
      return {
        type: "dangerFullAccess" as const,
      };
    default:
      return null;
  }
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
