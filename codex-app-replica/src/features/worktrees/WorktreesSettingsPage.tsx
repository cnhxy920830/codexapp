import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshIcon } from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import { Button } from "../../components/Button";
import { SettingsContentLayout } from "../../components/SettingsContentLayout";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import { readGitOrigins } from "../../services/gitOrigins";
import { archiveConversation, getRecentThreadsForHost, type ThreadHistoryEntry } from "../../services/history";
import {
  LOCAL_SETTINGS_HOST_ID,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  onSharedObjectUpdated,
  readSettingsRemoteProjectsSnapshot,
} from "../../services/settingsHosts";
import { onWorkspaceRootOptionsUpdated, readWorkspaceRootOptions } from "../../services/workspaceRoots";
import { deleteWorktree, readCodexWorktrees, type CodexWorktreeEntry } from "../../services/worktrees";

type WorktreesSettingsPageProps = {
  onDismissToast?: () => void;
  onShowToast?: (toast: AppToast) => void;
  onViewConversation?: (threadId: string, hostId: string) => void | Promise<void>;
  selectedHostId: string;
};

type WorktreeRepositoryGroup = {
  key: string;
  repoRoot: string | null;
  worktrees: CodexWorktreeEntry[];
};

export function WorktreesSettingsPage({
  onDismissToast,
  onShowToast,
  onViewConversation,
  selectedHostId,
}: WorktreesSettingsPageProps) {
  const { t } = useI18n();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [worktrees, setWorktrees] = useState<CodexWorktreeEntry[]>([]);
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [recentThreads, setRecentThreads] = useState<ThreadHistoryEntry[]>([]);
  const [restoredRepoRoots, setRestoredRepoRoots] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isThreadsLoading, setIsThreadsLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

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
          selectedHostId === LOCAL_SETTINGS_HOST_ID
            ? readWorkspaceRootOptions(selectedHostId).then((response) => response.roots)
            : readSettingsRemoteProjectsSnapshot().then((remoteProjects) => {
                return remoteProjects
                  .filter((remoteProject) => remoteProject.hostId === selectedHostId)
                  .map((remoteProject) => remoteProject.remotePath);
              }),
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsThreadsLoading(true);
      try {
        const threads = await getRecentThreadsForHost(selectedHostId);
        if (!cancelled) {
          setRecentThreads(threads);
        }
      } catch {
        if (!cancelled) {
          setRecentThreads([]);
        }
      } finally {
        if (!cancelled) {
          setIsThreadsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce, selectedHostId]);

  useEffect(() => {
    let cancelled = false;

    const visibleWorktrees = filterOutProjectRootWorktrees(worktrees, projectRoots);
    const groups = groupWorktreesByRepository(visibleWorktrees);
    const dirsToResolve = groups
      .filter((group) => group.repoRoot === null)
      .map((group) => group.worktrees[0]?.dir ?? null)
      .filter((dir): dir is string => dir !== null);

    if (dirsToResolve.length === 0) {
      setRestoredRepoRoots({});
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        const response = await readGitOrigins({
          dirs: dirsToResolve,
          hostId: selectedHostId,
        });
        if (cancelled) {
          return;
        }

        const rootsByDir = new Map(response.origins.map((origin) => [normalizePath(origin.dir), origin.root]));
        const nextRestoredRepoRoots: Record<string, string> = {};
        for (const group of groups) {
          if (group.repoRoot !== null) {
            continue;
          }
          const firstWorktreeDir = group.worktrees[0]?.dir;
          if (!firstWorktreeDir) {
            continue;
          }
          const restoredRoot = rootsByDir.get(normalizePath(firstWorktreeDir));
          if (typeof restoredRoot === "string" && restoredRoot.trim().length > 0) {
            nextRestoredRepoRoots[group.key] = restoredRoot;
          }
        }
        setRestoredRepoRoots(nextRestoredRepoRoots);
      } catch {
        if (!cancelled) {
          setRestoredRepoRoots({});
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectRoots, reloadNonce, selectedHostId, worktrees]);

  const visibleWorktrees = filterOutProjectRootWorktrees(worktrees, projectRoots);
  const groupedWorktrees = groupWorktreesByRepository(visibleWorktrees);
  const visibleRecentThreads = recentThreads.filter((thread) => !isThreadSpawnSubagentConversation(thread));

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
      <SettingsContentLayout title={t("settings.section.worktrees")}>
        <SettingsGroup>
          <SettingsGroupHeader action={refreshAction} title={t("settings.worktrees.loading.title")} />
          <SettingsGroupContent>
            <SettingsSurface>
              <div className="flex items-center gap-2 p-3 text-sm text-token-text-secondary">
                <Spinner className="icon-xxs" />
                <span>{t("settings.worktrees.loading.body")}</span>
              </div>
            </SettingsSurface>
          </SettingsGroupContent>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  if (loadError !== null) {
    return (
      <SettingsContentLayout title={t("settings.section.worktrees")}>
        <SettingsGroup>
          <SettingsGroupHeader action={refreshAction} title={t("settings.worktrees.error.title")} />
          <SettingsGroupContent>
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">
                {loadError || t("settings.worktrees.error.body")}
              </div>
            </SettingsSurface>
          </SettingsGroupContent>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  if (groupedWorktrees.length === 0) {
    return (
      <SettingsContentLayout title={t("settings.section.worktrees")}>
        <SettingsGroup>
          <SettingsGroupHeader action={refreshAction} title={t("settings.worktrees.empty.title")} />
          <SettingsGroupContent>
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">{t("settings.worktrees.empty.body")}</div>
            </SettingsSurface>
          </SettingsGroupContent>
        </SettingsGroup>
      </SettingsContentLayout>
    );
  }

  return (
    <SettingsContentLayout title={t("settings.section.worktrees")}>
      {groupedWorktrees.map((group, index) => (
        <WorktreeRepositorySection
          key={group.key}
          action={index === 0 ? refreshAction : null}
          allRecentThreads={recentThreads}
          displayRepoRoot={restoredRepoRoots[group.key] ?? group.repoRoot ?? group.worktrees[0]?.dir ?? null}
          hostId={selectedHostId}
          isThreadsLoading={isThreadsLoading}
          onDismissToast={onDismissToast}
          onShowToast={onShowToast}
          onViewConversation={onViewConversation}
          onWorktreeDeleted={() => setReloadNonce((current) => current + 1)}
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
  displayRepoRoot,
  hostId,
  isThreadsLoading,
  onDismissToast,
  onShowToast,
  onViewConversation,
  onWorktreeDeleted,
  visibleRecentThreads,
  worktrees,
}: {
  action: ReactNode;
  allRecentThreads: ThreadHistoryEntry[];
  displayRepoRoot: string | null;
  hostId: string;
  isThreadsLoading: boolean;
  onDismissToast?: () => void;
  onShowToast?: (toast: AppToast) => void;
  onViewConversation?: (threadId: string, hostId: string) => void | Promise<void>;
  onWorktreeDeleted: () => void;
  visibleRecentThreads: ThreadHistoryEntry[];
  worktrees: CodexWorktreeEntry[];
}) {
  const { t } = useI18n();
  const sortedWorktrees = sortWorktreesByConversationCount(worktrees, visibleRecentThreads);

  return (
    <SettingsGroup>
      <SettingsGroupHeader
        action={action}
        title={
          <div className="min-w-0 truncate text-sm text-token-text-primary">
            {displayRepoRoot ?? t("settings.worktrees.repository.unknown")}
          </div>
        }
      />
      <SettingsGroupContent>
        <SettingsSurface>
          {sortedWorktrees.map((worktree) => (
            <WorktreeRow
              key={worktree.dir}
              allConversations={getWorktreeConversations(worktree.dir, allRecentThreads)}
              hostId={hostId}
              isConversationsLoading={isThreadsLoading}
              onDismissToast={onDismissToast}
              onShowToast={onShowToast}
              onViewConversation={onViewConversation}
              onWorktreeDeleted={onWorktreeDeleted}
              visibleConversations={getWorktreeConversations(worktree.dir, visibleRecentThreads)}
              worktree={worktree}
            />
          ))}
        </SettingsSurface>
      </SettingsGroupContent>
    </SettingsGroup>
  );
}

function WorktreeRow({
  allConversations,
  hostId,
  isConversationsLoading,
  onDismissToast,
  onShowToast,
  onViewConversation,
  onWorktreeDeleted,
  visibleConversations,
  worktree,
}: {
  allConversations: ThreadHistoryEntry[];
  hostId: string;
  isConversationsLoading: boolean;
  onDismissToast?: () => void;
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
              const title = (conversation.name ?? conversation.preview).trim() || t("settings.worktrees.conversation.untitled");

              return (
                <button
                  key={conversation.id}
                  className="focus-visible:outline-token-focus flex w-full items-center justify-between gap-2 rounded-lg px-row-x py-row-y text-left text-sm text-token-text-primary hover:bg-token-list-hover-background hover:text-token-text-primary/80 focus-visible:outline-1 focus-visible:outline-offset-[-2px]"
                  onClick={() => {
                    onDismissToast?.();
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

function SettingsGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupHeader({
  action,
  title,
}: {
  action?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pb-2">
      <div className="min-w-0 flex-1">{title}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border",
        className,
      )}
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
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

function isThreadSpawnSubagentConversation(thread: ThreadHistoryEntry) {
  return thread.source?.parentThreadId != null;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
