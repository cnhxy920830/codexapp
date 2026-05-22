import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RefreshIcon } from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import { Button } from "../../components/Button";
import { SettingsContentLayout } from "../../components/SettingsContentLayout";
import { SettingsGroup } from "../../components/SettingsGroup";
import { SettingsSectionTitle } from "../../components/SettingsSectionTitle";
import { SettingsSurface } from "../../components/SettingsSurface";
import { Spinner } from "../../components/Spinner";
import { useReplicaStatsigGateValue } from "../statsig/replicaStatsig";
import { useI18n } from "../../i18n/i18n";
import { readGitOrigins } from "../../services/gitOrigins";
import { listenGitStateChanged } from "../../services/gitStateEvents";
import { archiveConversation, type ThreadConversation, type ThreadConversationItem, type ThreadHistoryEntry } from "../../services/history";
import {
  LOCAL_SETTINGS_HOST_ID,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  onSharedObjectUpdated,
} from "../../services/settingsHosts";
import { onWorkspaceRootOptionsUpdated, readWorkspaceRootOptions } from "../../services/workspaceRoots";
import { deleteWorktree, readCodexWorktrees, type CodexWorktreeEntry } from "../../services/worktrees";

type WorktreesSettingsPageProps = {
  cachedConversations: ThreadConversation[];
  onShowToast?: (toast: AppToast) => void;
  onViewConversation?: (threadId: string, hostId: string) => void | Promise<void>;
  isRecentThreadsLoading?: boolean;
  recentThreads: ThreadHistoryEntry[];
  selectedHostId: string;
};

type WorktreeRepositoryGroup = {
  key: string;
  repoRoot: string | null;
  worktrees: CodexWorktreeEntry[];
};

export function WorktreesSettingsPage({
  cachedConversations,
  onShowToast,
  onViewConversation,
  isRecentThreadsLoading = false,
  recentThreads,
  selectedHostId,
}: WorktreesSettingsPageProps) {
  const { t } = useI18n();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [worktrees, setWorktrees] = useState<CodexWorktreeEntry[]>([]);
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const backgroundSubagentsEnabled = useReplicaStatsigGateValue("1221508807");

  useEffect(() => {
    let disposed = false;
    let cleanupWorkspaceRootUpdates: (() => void) | null = null;
    let cleanupSharedObjects: (() => void) | null = null;

    if (selectedHostId === LOCAL_SETTINGS_HOST_ID) {
      void onWorkspaceRootOptionsUpdated(() => {
        if (!disposed) {
          setReloadNonce((current) => current + 1);
        }
      }).then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        cleanupWorkspaceRootUpdates = cleanup;
      });
    } else {
      void onSharedObjectUpdated((notification) => {
        if (notification.key === REMOTE_PROJECTS_SHARED_OBJECT_KEY && !disposed) {
          setReloadNonce((current) => current + 1);
        }
      }).then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        cleanupSharedObjects = cleanup;
      });
    }

    return () => {
      disposed = true;
      cleanupWorkspaceRootUpdates?.();
      cleanupSharedObjects?.();
    };
  }, [selectedHostId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadError(null);
      if (hasLoadedOnceRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [worktreesResponse, projectRootsResponse] = await Promise.all([
          readCodexWorktrees({
            hostId: selectedHostId,
            operationSource: "worktrees_settings_page",
          }),
          readWorkspaceRootOptions(selectedHostId).then((response) => response.roots),
        ]);
        if (cancelled) {
          return;
        }

        setWorktrees(worktreesResponse.worktrees);
        setProjectRoots(projectRootsResponse);
        hasLoadedOnceRef.current = true;
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce, selectedHostId]);

  const visibleWorktrees = filterOutProjectRootWorktrees(worktrees, projectRoots);
  const groupedWorktrees = groupWorktreesByRepository(visibleWorktrees);
  const cachedConversationsById = useMemo(() => {
    return new Map(
      cachedConversations
        .filter((conversation) => (conversation.hostId ?? LOCAL_SETTINGS_HOST_ID) === selectedHostId)
        .map((conversation) => [conversation.id, conversation]),
    );
  }, [cachedConversations, selectedHostId]);
  const recentThreadsForHost = recentThreads.filter((thread) => (thread.hostId ?? LOCAL_SETTINGS_HOST_ID) === selectedHostId);
  const visibleRecentThreads = recentThreadsForHost.filter(
    (thread) => !isThreadSpawnSubagentConversation(thread, backgroundSubagentsEnabled),
  );

  const refreshAction = (
    <Button
      aria-label={t("settings.worktrees.refresh")}
      className="shrink-0"
      color="ghost"
      loading={isRefreshing}
      onClick={() => setReloadNonce((current) => current + 1)}
      size="toolbar"
      title={t("settings.worktrees.refresh")}
      uniform
    >
      {isRefreshing ? null : <RefreshIcon className="icon-xs" />}
    </Button>
  );

  if (isLoading) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="worktrees" />}>
        <SettingsGroup>
          <SettingsGroup.Header actions={refreshAction} title={t("settings.worktrees.loading.title")} />
          <SettingsGroup.Content>
            <SettingsSurface>
              <div className="flex items-center gap-2 p-3 text-sm text-token-text-secondary">
                <Spinner className="icon-xxs" />
                <span>{t("settings.worktrees.loading.body")}</span>
              </div>
            </SettingsSurface>
          </SettingsGroup.Content>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  if (loadError !== null) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="worktrees" />}>
        <SettingsGroup>
          <SettingsGroup.Header actions={refreshAction} title={t("settings.worktrees.error.title")} />
          <SettingsGroup.Content>
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">
                {loadError || t("settings.worktrees.error.body")}
              </div>
            </SettingsSurface>
          </SettingsGroup.Content>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  if (groupedWorktrees.length === 0) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="worktrees" />}>
        <SettingsGroup>
          <SettingsGroup.Header actions={refreshAction} title={t("settings.worktrees.empty.title")} />
          <SettingsGroup.Content>
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">{t("settings.worktrees.empty.body")}</div>
            </SettingsSurface>
          </SettingsGroup.Content>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  return (
    <SettingsContentLayout title={<SettingsSectionTitle slug="worktrees" />}>
      {groupedWorktrees.map((group, index) => (
        <WorktreeRepositorySection
          key={group.key}
          action={index === 0 ? refreshAction : null}
          allRecentThreads={recentThreadsForHost}
          cachedConversationsById={cachedConversationsById}
          hostId={selectedHostId}
          isThreadsLoading={isRecentThreadsLoading}
          onShowToast={onShowToast}
          onViewConversation={onViewConversation}
          onWorktreeDeleted={() => setReloadNonce((current) => current + 1)}
          repoRoot={group.repoRoot}
          visibleRecentThreads={visibleRecentThreads}
          worktrees={group.worktrees}
        />
      ))}
    </SettingsContentLayout>
  );
}

function WorktreeRepositorySection({
  action,
  allRecentThreads,
  cachedConversationsById,
  hostId,
  isThreadsLoading,
  onShowToast,
  onViewConversation,
  onWorktreeDeleted,
  repoRoot,
  visibleRecentThreads,
  worktrees,
}: {
  action: ReactNode;
  allRecentThreads: ThreadHistoryEntry[];
  cachedConversationsById: ReadonlyMap<string, ThreadConversation>;
  hostId: string;
  isThreadsLoading: boolean;
  onShowToast?: (toast: AppToast) => void;
  onViewConversation?: (threadId: string, hostId: string) => void | Promise<void>;
  onWorktreeDeleted: () => void;
  repoRoot: string | null;
  visibleRecentThreads: ThreadHistoryEntry[];
  worktrees: CodexWorktreeEntry[];
}) {
  const { t } = useI18n();
  const sortedWorktrees = sortWorktreesByConversationCount(worktrees, visibleRecentThreads);
  const [resolvedRepoRoot, setResolvedRepoRoot] = useState<string | null>(repoRoot ?? null);
  const [isRepositoryMetadataLoading, setIsRepositoryMetadataLoading] = useState(false);

  useEffect(() => {
    if (repoRoot == null) {
      setResolvedRepoRoot(null);
      setIsRepositoryMetadataLoading(false);
      return;
    }

    let cancelled = false;

    const refreshRepoRoot = () => {
      setResolvedRepoRoot(repoRoot);
      setIsRepositoryMetadataLoading(true);
      void readGitOrigins({
        dirs: [repoRoot],
        hostId,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }
          const gitRoot = response.origins.at(0)?.root?.trim() ?? null;
          setResolvedRepoRoot(gitRoot ?? repoRoot);
        })
        .catch(() => {
          if (!cancelled) {
            setResolvedRepoRoot(repoRoot);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRepositoryMetadataLoading(false);
          }
        });
    };

    refreshRepoRoot();
    const unsubscribe = listenGitStateChanged(refreshRepoRoot);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hostId, repoRoot]);

  const displayRepoRoot = resolvedRepoRoot ?? repoRoot ?? worktrees[0]?.dir ?? null;

  return (
    <SettingsGroup>
      <SettingsGroup.Header
        actions={action}
        title={
          <div className="flex min-w-0 flex-col">
            <div className="min-w-0 truncate text-sm text-token-text-primary">
              {displayRepoRoot ? (
                <span className="truncate font-mono text-sm">{displayRepoRoot}</span>
              ) : (
                <span>{t("settings.worktrees.repository.unknown")}</span>
              )}
            </div>
            {isRepositoryMetadataLoading && displayRepoRoot == null ? (
              <div className="text-xs text-token-text-secondary">
                {t("settings.worktrees.repository.loading")}
              </div>
            ) : null}
          </div>
        }
      />
      <SettingsGroup.Content>
        <SettingsSurface>
          {sortedWorktrees.map((worktree) => (
            <WorktreeRow
              key={worktree.dir}
              allConversations={getWorktreeConversations(worktree.dir, allRecentThreads)}
              cachedConversationsById={cachedConversationsById}
              hostId={hostId}
              isConversationsLoading={isThreadsLoading}
              onShowToast={onShowToast}
              onViewConversation={onViewConversation}
              onWorktreeDeleted={onWorktreeDeleted}
              visibleConversations={getWorktreeConversations(worktree.dir, visibleRecentThreads)}
              worktree={worktree}
            />
          ))}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function WorktreeRow({
  allConversations,
  cachedConversationsById,
  hostId,
  isConversationsLoading,
  onShowToast,
  onViewConversation,
  onWorktreeDeleted,
  visibleConversations,
  worktree,
}: {
  allConversations: ThreadHistoryEntry[];
  cachedConversationsById: ReadonlyMap<string, ThreadConversation>;
  hostId: string;
  isConversationsLoading: boolean;
  onShowToast?: (toast: AppToast) => void;
  onViewConversation?: (threadId: string, hostId: string) => void | Promise<void>;
  onWorktreeDeleted: () => void;
  visibleConversations: ThreadHistoryEntry[];
  worktree: CodexWorktreeEntry;
}) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      if (allConversations.length > 0) {
        await Promise.all(
          allConversations.map((conversation) =>
            archiveConversation({
              conversationId: conversation.id,
              cleanupWorktree: false,
            }),
          ),
        );
      }
      await deleteWorktree({
        hostId,
        worktree: worktree.dir,
        reason: "settings-delete-targeted",
      });
      onWorktreeDeleted();
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.worktrees.delete.error"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-token-text-primary">{t("settings.worktrees.row.title")}</div>
          <div className="mt-1 truncate font-mono text-xs text-token-text-secondary">{worktree.dir}</div>
        </div>
        <Button className="shrink-0" color="danger" loading={isDeleting} onClick={() => void handleDelete()} size="toolbar">
          {t("settings.worktrees.row.delete")}
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs text-token-text-secondary">{t("settings.worktrees.row.conversations")}</div>
        {isConversationsLoading ? (
          <div className="flex items-center gap-2 text-xs text-token-text-secondary">
            <Spinner className="icon-xxs" />
            <span>{t("settings.worktrees.row.conversations.loading")}</span>
          </div>
        ) : visibleConversations.length === 0 ? (
          <div className="text-xs text-token-text-secondary">{t("settings.worktrees.row.conversations.empty")}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleConversations.map((conversation) => {
              const title =
                getConversationDisplayTitle(conversation.id, cachedConversationsById) ??
                getThreadHistoryConversationTitle(conversation) ??
                t("settings.worktrees.conversation.untitled");

              return (
                <button
                  key={conversation.id}
                  className="focus-visible:outline-token-focus flex w-full items-center justify-between gap-2 rounded-lg px-row-x py-row-y text-left text-sm text-token-text-primary hover:bg-token-list-hover-background hover:text-token-text-primary/80 focus-visible:outline-1 focus-visible:outline-offset-[-2px]"
                  onClick={() => {
                    void onViewConversation?.(conversation.id, hostId);
                  }}
                  type="button"
                >
                  <span className="truncate">{title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function filterOutProjectRootWorktrees(worktrees: CodexWorktreeEntry[], projectRoots: string[]) {
  if (projectRoots.length === 0) {
    return worktrees;
  }

  return worktrees.filter((worktree) => {
    return !projectRoots.some((projectRoot) => isSameOrNestedPath(worktree.dir, projectRoot));
  });
}

function groupWorktreesByRepository(worktrees: CodexWorktreeEntry[]): WorktreeRepositoryGroup[] {
  const groups = new Map<string, WorktreeRepositoryGroup>();

  for (const worktree of worktrees) {
    const repoRoot = getRepositoryRootFromGitDir(worktree.gitDir);
    const key = normalizePath(repoRoot ?? worktree.dir);
    const existingGroup = groups.get(key);
    if (existingGroup) {
      existingGroup.worktrees.push(worktree);
      continue;
    }
    groups.set(key, {
      key,
      repoRoot,
      worktrees: [worktree],
    });
  }

  return Array.from(groups.values());
}

function sortWorktreesByConversationCount(worktrees: CodexWorktreeEntry[], conversations: ThreadHistoryEntry[]) {
  if (conversations.length === 0) {
    return worktrees;
  }

  return worktrees
    .map((worktree, index) => ({
      conversationCount: getWorktreeConversations(worktree.dir, conversations).length,
      index,
      worktree,
    }))
    .sort((left, right) => {
      const conversationCountDifference = right.conversationCount - left.conversationCount;
      if (conversationCountDifference !== 0) {
        return conversationCountDifference;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.worktree);
}

function getWorktreeConversations(worktreeDir: string, conversations: ThreadHistoryEntry[]) {
  if (conversations.length === 0) {
    return [];
  }

  const normalizedWorktreeDir = normalizePath(worktreeDir);
  return conversations.filter((conversation) => {
    if (!conversation.cwd) {
      return false;
    }
    const normalizedConversationCwd = normalizePath(conversation.cwd);
    return (
      normalizedConversationCwd === normalizedWorktreeDir ||
      normalizedConversationCwd.startsWith(`${normalizedWorktreeDir}/`)
    );
  });
}

function getRepositoryRootFromGitDir(gitDir: string) {
  const normalizedGitDir = normalizePath(gitDir);
  const worktreeMarker = "/.git/worktrees/";
  const worktreeIndex = normalizedGitDir.indexOf(worktreeMarker);
  if (worktreeIndex >= 0) {
    return normalizedGitDir.slice(0, worktreeIndex);
  }
  if (normalizedGitDir.endsWith("/.git")) {
    return normalizedGitDir.slice(0, -5);
  }
  return null;
}

function isSameOrNestedPath(root: string, path: string) {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function isThreadSpawnSubagentConversation(thread: ThreadHistoryEntry, backgroundSubagentsEnabled: boolean) {
  return !backgroundSubagentsEnabled && thread.source?.parentThreadId != null;
}

function getConversationDisplayTitle(
  conversationId: string,
  cachedConversationsById: ReadonlyMap<string, ThreadConversation>,
) {
  const conversation = cachedConversationsById.get(conversationId);
  if (!conversation) {
    return null;
  }

  const title = normalizeConversationTitleText(conversation.title);
  if (title !== null) {
    return title;
  }

  const firstUserTextInput = conversation.turns[0]?.input
    ?.filter((input): input is Extract<(typeof conversation.turns)[number]["input"][number], { type: "text" }> => input.type === "text")
    .map((input) => input.text)
    .join("")
    .trim();
  const normalizedFirstUserTextInput = normalizeConversationTitleText(firstUserTextInput);
  if (normalizedFirstUserTextInput !== null) {
    return normalizedFirstUserTextInput;
  }

  return getParentCollabConversationPromptTitle(conversation.id, cachedConversationsById);
}

function getThreadHistoryConversationTitle(conversation: ThreadHistoryEntry) {
  const normalizedName = normalizeConversationTitleText(conversation.name);
  if (normalizedName !== null) {
    return normalizedName;
  }

  return normalizeConversationTitleText(conversation.preview);
}

function getParentCollabConversationPromptTitle(
  conversationId: string,
  cachedConversationsById: ReadonlyMap<string, ThreadConversation>,
) {
  const parentConversationId = cachedConversationsById.get(conversationId)?.source?.parentThreadId ?? null;
  if (parentConversationId === null) {
    return null;
  }

  const parentConversation = cachedConversationsById.get(parentConversationId);
  if (!parentConversation) {
    return null;
  }

  for (let turnIndex = parentConversation.turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = parentConversation.turns[turnIndex];
    const items = getConversationItemsForTurn(parentConversation.items, turn.id);
    for (const item of items) {
      if (item.type !== "collabAgentToolCall" || !item.receiverThreadIds.includes(conversationId)) {
        continue;
      }
      const promptTitle = normalizeConversationTitleText(item.prompt);
      if (promptTitle !== null) {
        return promptTitle;
      }
    }
  }

  return null;
}

function getConversationItemsForTurn(items: ThreadConversationItem[], turnId: string) {
  return items.filter((item) => item.turnId === turnId);
}

function normalizeConversationTitleText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const firstLine = trimmed.split(/\r?\n/u, 1)[0] ?? trimmed;
  const normalized = firstLine.replace(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
