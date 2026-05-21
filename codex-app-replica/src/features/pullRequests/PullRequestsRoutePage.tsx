import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import {
  getRecentThreads,
  getRecentThreadsForHost,
  onThreadEvent,
  onThreadReadStateChanged,
  type ThreadHistoryEntry,
} from "../../services/history";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import type {
  PullRequestBoardItem,
  PullRequestFilterView,
  PullRequestStatusSuccess,
} from "../../services/pullRequests";
import {
  commentPullRequest,
  mergePullRequest,
  openPullRequestInBrowser,
  readPullRequestBoard,
  readPullRequestDiff,
  readPullRequestStatus,
  updatePullRequest,
  pullRequestSearchQueryForView,
} from "../../services/pullRequests";
import { onWorkspaceRootOptionsUpdated, readWorkspaceRootOptions } from "../../services/workspaceRoots";
import { readGitOrigins, type GitOrigin } from "../../services/gitOrigins";
import { getCodexHomePath } from "../../services/codexHome";
import { readGitSettingsSnapshot, type GitMergeMethod } from "../../services/gitSettings";
import { onGlobalStateUpdated } from "../../services/settings";
import {
  REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  onRemoteAppServerConnectionStateChanged,
  onSharedObjectUpdated,
  readConnectedSettingsRemoteConnections,
  readSettingsRemoteConnectionsSnapshot,
  readSettingsRemoteProjectsSnapshot,
  type RemoteProject,
} from "../../services/settingsHosts";
import { buildPullRequestGitApplyCommand, parsePullRequestUnifiedDiff } from "./pullRequestDiffModel";
import {
  PULL_REQUEST_BOARD_LAST_SELECTED_REPO_KEY,
  buildPullRequestProjectGroups,
  buildPullRequestRepoOptions,
  getPullRequestGitOriginRequests,
  getFirstSelectablePullRequest,
  getPullRequestBoardQueryTarget,
  groupPullRequestBoardItems,
  parsePullRequestsRouteState,
  pullRequestSelectionKey,
  resolvePullRequestRepoOption,
  resolvePullRequestSelectionKey,
  serializePullRequestsRouteState,
  type PullRequestRepoOption,
  type PullRequestsRouteState,
} from "./pullRequestsPageModel";
import { PullRequestDetailPane } from "./PullRequestDetailPane";
import {
  PullRequestsBoardLoadingState,
  PullRequestsCenteredEmptyState,
  PullRequestsHeaderRepoMenu,
  PullRequestsPageView,
  PullRequestsRouteLoadingState,
} from "./PullRequestsPageView";

type PullRequestsRoutePageProps = {
  onRegisterHeaderContent?: (content: ReactNode | null) => void;
  onOpenConversationForHost: (threadId: string, hostId: string) => void | Promise<void>;
  onSetRightPanelCloseAction: (action: (() => void) | null) => void;
  onSetRightPanelVisible: (visible: boolean) => void;
  onShowToast: (toast: AppToast) => void;
  rightPanelHost: RefObject<HTMLDivElement | null>;
};

export function PullRequestsRoutePage({
  onRegisterHeaderContent,
  onOpenConversationForHost,
  onSetRightPanelCloseAction,
  onSetRightPanelVisible,
  onShowToast,
  rightPanelHost,
}: PullRequestsRoutePageProps) {
  const { t } = useI18n();
  const [routeState, setRouteState] = useState<PullRequestsRouteState>(() =>
    parsePullRequestsRouteState(getWindowSearch(), readStoredRepoKey()),
  );
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([]);
  const [connectedRemoteHostIds, setConnectedRemoteHostIds] = useState<string[]>([]);
  const [gitOrigins, setGitOrigins] = useState<Array<{ hostId: string | null; origin: GitOrigin }>>([]);
  const [codexHome, setCodexHome] = useState<string | null>(null);
  const [mergeMethod, setMergeMethod] = useState<GitMergeMethod>("merge");
  const [isWorkspaceMetadataLoading, setIsWorkspaceMetadataLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageErrorDetail, setPageErrorDetail] = useState<string | null>(null);
  const [boardItems, setBoardItems] = useState<PullRequestBoardItem[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [recentThreads, setRecentThreads] = useState<ThreadHistoryEntry[]>([]);
  const [detail, setDetail] = useState<PullRequestStatusSuccess | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffFiles, setDiffFiles] = useState<ReturnType<typeof parsePullRequestUnifiedDiff>>([]);
  const [unifiedDiff, setUnifiedDiff] = useState<string | null>(null);
  const [codeReviewError, setCodeReviewError] = useState<string | null>(null);
  const [isCodeReviewLoading, setIsCodeReviewLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"pullRequest" | "codeReview">("pullRequest");
  const [boardRefreshNonce, setBoardRefreshNonce] = useState(0);
  const [detailRefreshNonce, setDetailRefreshNonce] = useState(0);
  const [diffRefreshNonce, setDiffRefreshNonce] = useState(0);
  const [metadataRefreshNonce, setMetadataRefreshNonce] = useState(0);
  const [recentThreadsRefreshNonce, setRecentThreadsRefreshNonce] = useState(0);
  const metadataRequestIdRef = useRef(0);
  const boardRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const diffRequestIdRef = useRef(0);
  const recentThreadsRequestIdRef = useRef(0);
  const lastAutoOpenBoardKeyRef = useRef<string | null>(null);
  const lastBoardQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++metadataRequestIdRef.current;

    setIsWorkspaceMetadataLoading(true);
    setPageError(null);
    setPageErrorDetail(null);

    const load = async () => {
      try {
        const [rootOptions, nextRemoteProjects, remoteConnections, nextCodexHome, gitSettings] = await Promise.all([
          readWorkspaceRootOptions(),
          readSettingsRemoteProjectsSnapshot().catch(() => []),
          readSettingsRemoteConnectionsSnapshot().catch(() => []),
          getCodexHomePath().catch(() => null),
          readGitSettingsSnapshot().catch(() => null),
        ]);
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        const nextConnectedRemoteConnections =
          await readConnectedSettingsRemoteConnections(remoteConnections).catch(() => []);
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        const projectGroups = buildPullRequestProjectGroups({
          codexHome: nextCodexHome,
          connectedRemoteHostIds: nextConnectedRemoteConnections.map((connection) => connection.hostId),
          remoteProjects: nextRemoteProjects,
          workspaceRoots: rootOptions.roots,
        });
        const gitOriginRequests = getPullRequestGitOriginRequests(projectGroups);
        const originResponses = await Promise.all(
          gitOriginRequests.map(async (request) => {
            const response = await readGitOrigins({
              dirs: request.dirs,
              hostId: request.hostId,
            });
            return response.origins.map((origin) => ({
              hostId: request.hostId,
              origin,
            }));
          }),
        ).catch((error: unknown) => {
          throw error;
        });
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        setWorkspaceRoots(rootOptions.roots);
        setRemoteProjects(nextRemoteProjects);
        setConnectedRemoteHostIds(nextConnectedRemoteConnections.map((connection) => connection.hostId));
        setGitOrigins(originResponses.flat());
        setCodexHome(nextCodexHome);
        if (gitSettings != null) {
          setMergeMethod(gitSettings.pullRequestMergeMethod);
        }
      } catch (error) {
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        const message = formatError(error);
        setPageError(message);
        setPageErrorDetail(message);
      } finally {
        if (!cancelled && requestId === metadataRequestIdRef.current) {
          setIsWorkspaceMetadataLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [metadataRefreshNonce]);

  useEffect(() => {
    let disposed = false;
    let cleanupWorkspaceRoots: (() => void) | undefined;
    let cleanupSharedObjects: (() => void) | undefined;
    let cleanupConnectionStates: (() => void) | undefined;

    const refreshWorkspaceMetadata = () => {
      if (!disposed) {
        setMetadataRefreshNonce((current) => current + 1);
      }
    };

    void onWorkspaceRootOptionsUpdated(refreshWorkspaceMetadata).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanupWorkspaceRoots = dispose;
    });

    void onSharedObjectUpdated((notification) => {
      if (
        notification.key === REMOTE_CONNECTIONS_SHARED_OBJECT_KEY ||
        notification.key === REMOTE_PROJECTS_SHARED_OBJECT_KEY
      ) {
        refreshWorkspaceMetadata();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanupSharedObjects = dispose;
    });

    void onRemoteAppServerConnectionStateChanged(() => {
      refreshWorkspaceMetadata();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanupConnectionStates = dispose;
    });

    return () => {
      disposed = true;
      void cleanupWorkspaceRoots?.();
      void cleanupSharedObjects?.();
      void cleanupConnectionStates?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenGlobalState: (() => void) | undefined;

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("git-pull-request-merge-method")) {
        return;
      }

      void readGitSettingsSnapshot()
        .then((snapshot) => {
          if (!disposed) {
            setMergeMethod(snapshot.pullRequestMergeMethod);
          }
        })
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }

      unlistenGlobalState = dispose;
    });

    return () => {
      disposed = true;
      void unlistenGlobalState?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++recentThreadsRequestIdRef.current;

    const load = async () => {
      const visibleRemoteHostIds = [...new Set(connectedRemoteHostIds)];
      const settledResults = await Promise.allSettled([
        getRecentThreads(),
        ...visibleRemoteHostIds.map((hostId) => getRecentThreadsForHost(hostId)),
      ]);
      if (cancelled || requestId !== recentThreadsRequestIdRef.current) {
        return;
      }

      const fulfilledResults = settledResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (fulfilledResults.length === 0) {
        return;
      }

      setRecentThreads(
        fulfilledResults
          .flat()
          .sort((left, right) => right.updatedAt - left.updatedAt),
      );
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [connectedRemoteHostIds, recentThreadsRefreshNonce]);

  useEffect(() => {
    let disposed = false;
    let cleanupThreadEvents: (() => void) | undefined;
    let cleanupThreadReadStateChanged: (() => void) | undefined;

    const refreshRecentThreads = () => {
      if (!disposed) {
        setRecentThreadsRefreshNonce((current) => current + 1);
      }
    };

    void onThreadEvent(() => {
      refreshRecentThreads();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanupThreadEvents = dispose;
    });

    void onThreadReadStateChanged(() => {
      refreshRecentThreads();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanupThreadReadStateChanged = dispose;
    });

    return () => {
      disposed = true;
      void cleanupThreadEvents?.();
      void cleanupThreadReadStateChanged?.();
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRouteState(parsePullRequestsRouteState(getWindowSearch(), readStoredRepoKey()));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const projectGroups = useMemo(
    () =>
      buildPullRequestProjectGroups({
        codexHome,
        connectedRemoteHostIds,
        remoteProjects,
        workspaceRoots,
      }),
    [codexHome, connectedRemoteHostIds, remoteProjects, workspaceRoots],
  );

  const repoOptions = useMemo(
    () =>
      buildPullRequestRepoOptions({
        codexHome,
        gitOrigins,
        projectGroups,
      }),
    [codexHome, gitOrigins, projectGroups],
  );

  const selectedRepoKey = useMemo(
    () => resolvePullRequestSelectionKey(repoOptions, routeState.repoKey),
    [repoOptions, routeState.repoKey],
  );
  const selectedRepoOption = useMemo(
    () => resolvePullRequestRepoOption(repoOptions, routeState.repoKey),
    [repoOptions, routeState.repoKey],
  );
  const boardQueryTarget = useMemo(
    () => getPullRequestBoardQueryTarget(selectedRepoOption, selectedRepoKey, repoOptions, routeState.view),
    [repoOptions, routeState.view, selectedRepoKey, selectedRepoOption],
  );
  const boardQueryKey = useMemo(
    () =>
      pullRequestSelectionKey({
        repoKey: selectedRepoKey,
        view: routeState.view,
        searchQuery: routeState.view === "review" ? pullRequestSearchQueryForView(routeState.view) : null,
      }),
    [routeState.view, selectedRepoKey],
  );
  const selectedBoardItem = useMemo(
    () => resolveSelectedBoardItem(boardItems, routeState.pullRequestNumber, routeState.pullRequestUrl),
    [boardItems, routeState.pullRequestNumber, routeState.pullRequestUrl],
  );
  const selectedBoardItemKey = useMemo(
    () => buildBoardItemKey(selectedBoardItem),
    [selectedBoardItem],
  );
  const relatedThreads = useMemo(() => {
    if (selectedBoardItem == null) {
      return [];
    }

    const targetBranch = selectedBoardItem.headBranch.trim();
    if (targetBranch.length === 0) {
      return [];
    }

    const selectedHostId = selectedBoardItem.hostId ?? LOCAL_SETTINGS_HOST_ID;

    return recentThreads
      .filter((thread) => {
        const threadBranch = thread.gitInfo?.branch?.trim() ?? "";
        return threadBranch === targetBranch;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((thread) => ({
        hostId: selectedHostId,
        id: thread.id,
        title:
          (thread.name ?? thread.preview).trim()
          || t("pullRequestsPage.detail.relatedThreads.untitled"),
      }));
  }, [recentThreads, selectedBoardItem, t]);
  const selectedBoardItemContext = useMemo(
    () => {
      if (!selectedBoardItem) {
        return null;
      }
      return {
        cwd: selectedBoardItem.cwd,
        hostId: selectedBoardItem.hostId,
        number: selectedBoardItem.number,
        repo: selectedBoardItem.repo ?? selectedRepoOption?.repo ?? null,
      };
    },
    [selectedBoardItem, selectedRepoOption?.repo],
  );
  const detailKey = selectedBoardItemKey ?? "none";

  useEffect(() => {
    if (isWorkspaceMetadataLoading) {
      return;
    }

    if (repoOptions.length === 0 || boardQueryTarget == null) {
      setBoardItems([]);
      setBoardLoading(false);
      return;
    }

    const requestId = ++boardRequestIdRef.current;
    const targetKey = boardQueryKey;
    const targetChanged = lastBoardQueryKeyRef.current !== targetKey;
    lastBoardQueryKeyRef.current = targetKey;

    setBoardLoading(true);
    setPageError(null);
    setPageErrorDetail(null);
    if (targetChanged) {
      setBoardItems([]);
    }

    void readPullRequestBoard(boardQueryTarget)
      .then((response) => {
        if (requestId !== boardRequestIdRef.current) {
          return;
        }

        if (response.status === "error") {
          setBoardItems([]);
          setPageError(response.error);
          setPageErrorDetail(response.error);
          return;
        }

        setBoardItems(response.items);
      })
      .catch((error) => {
        if (requestId !== boardRequestIdRef.current) {
          return;
        }

        const message = formatError(error);
        setBoardItems([]);
        setPageError(message);
        setPageErrorDetail(message);
      })
      .finally(() => {
        if (requestId === boardRequestIdRef.current) {
          setBoardLoading(false);
        }
      });
  }, [boardQueryKey, boardQueryTarget, boardRefreshNonce, isWorkspaceMetadataLoading, repoOptions.length]);

  useEffect(() => {
    if (selectedBoardItem == null) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      setDiffFiles([]);
      setUnifiedDiff(null);
      setCodeReviewError(null);
      setIsCodeReviewLoading(false);
      return;
    }

    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
    setDiffFiles([]);
    setUnifiedDiff(null);
    setCodeReviewError(null);
    setIsCodeReviewLoading(false);
  }, [selectedBoardItemKey]);

  useEffect(() => {
    if (selectedBoardItemContext == null) {
      return;
    }

    const requestId = ++detailRequestIdRef.current;
    setDetailLoading(true);
    setDetailError(null);

    void readPullRequestStatus({
      cwd: selectedBoardItemContext.cwd,
      headBranch: selectedBoardItem?.headBranch ?? "",
      hostId: selectedBoardItemContext.hostId,
      number: selectedBoardItemContext.number,
      repo: selectedBoardItemContext.repo,
    })
      .then((response) => {
        if (requestId !== detailRequestIdRef.current) {
          return;
        }

        if (response.status === "error") {
          setDetail(null);
          setDetailError(response.error);
          return;
        }

        setDetail(response);
      })
      .catch((error) => {
        if (requestId !== detailRequestIdRef.current) {
          return;
        }

        setDetail(null);
        setDetailError(formatError(error));
      })
      .finally(() => {
        if (requestId === detailRequestIdRef.current) {
          setDetailLoading(false);
        }
      });
  }, [detailRefreshNonce, selectedBoardItemContext, selectedBoardItem?.headBranch]);

  useEffect(() => {
    if (selectedBoardItemContext == null || selectedTab !== "codeReview") {
      setIsCodeReviewLoading(false);
      return;
    }

    const requestId = ++diffRequestIdRef.current;
    setIsCodeReviewLoading(true);
    setCodeReviewError(null);

    void readPullRequestDiff({
      cwd: selectedBoardItemContext.cwd,
      hostId: selectedBoardItemContext.hostId,
      number: selectedBoardItemContext.number,
      repo: selectedBoardItemContext.repo,
    })
      .then((response) => {
        if (requestId !== diffRequestIdRef.current) {
          return;
        }

        if (response.status === "error") {
          setDiffFiles([]);
          setUnifiedDiff(null);
          setCodeReviewError(response.error);
          return;
        }

        setUnifiedDiff(response.unifiedDiff);
        setDiffFiles(parsePullRequestUnifiedDiff(response.unifiedDiff));
      })
      .catch((error) => {
        if (requestId !== diffRequestIdRef.current) {
          return;
        }

        setDiffFiles([]);
        setUnifiedDiff(null);
        setCodeReviewError(formatError(error));
      })
      .finally(() => {
        if (requestId === diffRequestIdRef.current) {
          setIsCodeReviewLoading(false);
        }
      });
  }, [diffRefreshNonce, selectedBoardItemContext, selectedTab]);

  useEffect(() => {
    if (pageError != null || isWorkspaceMetadataLoading || boardLoading || boardItems.length === 0) {
      return;
    }

    if (routeState.pullRequestNumber != null || routeState.pullRequestUrl != null) {
      return;
    }

    const firstSelectable = getFirstSelectablePullRequest(boardItems);
    if (firstSelectable == null) {
      return;
    }

    if (lastAutoOpenBoardKeyRef.current === boardQueryKey) {
      return;
    }

    lastAutoOpenBoardKeyRef.current = boardQueryKey;
    selectPullRequest(firstSelectable, { replace: true });
  }, [
    boardItems,
    boardLoading,
    boardQueryKey,
    isWorkspaceMetadataLoading,
    pageError,
    routeState.pullRequestNumber,
    routeState.pullRequestUrl,
  ]);

  const hasRepos = repoOptions.length > 0;
  const noRepos = !isWorkspaceMetadataLoading && pageError == null && hasRepos === false;

  const handleSelectRepo = (repoKey: string) => {
    writeStoredRepoKey(repoKey);
    const nextState: PullRequestsRouteState = {
      repoKey,
      view: routeState.view,
      pullRequestNumber: null,
      pullRequestUrl: null,
    };
    setRouteState(nextState);
    writePullRequestsRouteState(nextState, { replace: false });
  };

  const handleSelectView = (view: PullRequestFilterView) => {
    const nextState: PullRequestsRouteState = {
      repoKey: selectedRepoKey,
      view,
      pullRequestNumber: null,
      pullRequestUrl: null,
    };
    setRouteState(nextState);
    writePullRequestsRouteState(nextState, { replace: false });
  };

  const selectPullRequest = (item: PullRequestBoardItem, options?: { replace?: boolean }) => {
    const nextState: PullRequestsRouteState = {
      repoKey: selectedRepoKey,
      view: routeState.view,
      pullRequestNumber: item.number,
      pullRequestUrl: item.url,
    };
    setRouteState(nextState);
    writePullRequestsRouteState(nextState, { replace: options?.replace === true });
  };

  const handleCloseDetail = () => {
    const nextState: PullRequestsRouteState = {
      repoKey: selectedRepoKey,
      view: routeState.view,
      pullRequestNumber: null,
      pullRequestUrl: null,
    };
    setRouteState(nextState);
    writePullRequestsRouteState(nextState, { replace: false });
  };

  const refreshBoard = () => {
    setBoardRefreshNonce((value) => value + 1);
  };

  const refreshDetail = () => {
    setDetailRefreshNonce((value) => value + 1);
  };

  const refreshDiff = () => {
    setDiffRefreshNonce((value) => value + 1);
  };

  const handleCopyPullRequestUrl = async (item: PullRequestBoardItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      onShowToast({
        message: t("pullRequestsPage.card.contextMenu.copyUrlSuccess"),
        tone: "success",
      });
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.card.contextMenu.copyUrlError"),
        tone: "error",
      });
    }
  };

  const handleOpenPullRequestInBrowser = async (item: PullRequestBoardItem) => {
    try {
      await openPullRequestInBrowser(item.url);
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.error.title"),
        tone: "error",
      });
    }
  };

  const handleOpenCommentUrl = async (url: string) => {
    try {
      await openPullRequestInBrowser(url);
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.error.title"),
        tone: "error",
      });
    }
  };

  const handleCopyGitApplyCommand = async () => {
    if (unifiedDiff == null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildPullRequestGitApplyCommand(unifiedDiff));
      onShowToast({
        message: t("codex.review.copyGitApplyCommand.toast"),
        tone: "success",
      });
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.error.title"),
        tone: "error",
      });
    }
  };

  const handleMergePullRequest = async (item: PullRequestBoardItem) => {
    try {
      const result = await mergePullRequest({
        cwd: item.cwd,
        hostId: item.hostId,
        mergeMethod,
        number: item.number,
        repo: resolveItemRepo(item, selectedRepoOption),
      });

      if (result.status !== "success") {
        onShowToast({
          description: result.error,
          message: t("pullRequestsPage.detail.actions.errorTitle"),
          tone: "error",
        });
        return;
      }

      onShowToast({
        message: t("pullRequestsPage.card.merge.success"),
        tone: "success",
      });
      refreshBoard();
      refreshDetail();
      refreshDiff();
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.detail.actions.errorTitle"),
        tone: "error",
      });
    }
  };

  const handleMarkAsDraft = async () => {
    if (selectedBoardItemContext == null) {
      return;
    }

    await runUpdateAction({
      action: "mark-draft",
      successMessage: t("pullRequestsPage.detail.actions.markDraft.success"),
      item: selectedBoardItemContext,
    });
  };

  const handleMarkAsReady = async () => {
    if (selectedBoardItemContext == null) {
      return;
    }

    await runUpdateAction({
      action: "mark-ready",
      successMessage: t("pullRequestsPage.detail.actions.markReady.success"),
      item: selectedBoardItemContext,
    });
  };

  const handleToggleAutoMerge = async () => {
    if (selectedBoardItemContext == null || detail == null) {
      return;
    }

    await runUpdateAction({
      action: "toggle-auto-merge",
      enabled: !detail.isAutoMergeEnabled,
      successMessage: t("pullRequestsPage.detail.actions.enableAutoMerge.success"),
      item: selectedBoardItemContext,
    });
  };

  const handlePostComment = async (body: string) => {
    if (selectedBoardItemContext == null) {
      return;
    }

    await runCommentAction({
      body,
      item: selectedBoardItemContext,
    });
  };

  const handlePostReply = async (reviewThreadId: string, body: string) => {
    if (selectedBoardItemContext == null) {
      return;
    }

    await runCommentAction({
      body,
      item: selectedBoardItemContext,
      replyToReviewThreadId: reviewThreadId,
    });
  };

  const detailPane = selectedBoardItem == null ? null : (
    <PullRequestDetailPane
      boardItem={selectedBoardItem}
      codeReviewError={codeReviewError}
      commentAttachments={detail?.commentAttachments ?? []}
      cwd={selectedBoardItemContext?.cwd ?? null}
      detail={detail}
      detailError={detailError}
      detailKey={detailKey}
      detailLoading={detailLoading}
      diffFiles={diffFiles}
      hostId={selectedBoardItemContext?.hostId ?? null}
      isCodeReviewLoading={isCodeReviewLoading}
      onClose={handleCloseDetail}
      onOpenConversationForHost={onOpenConversationForHost}
      onCopyGitApplyCommand={unifiedDiff == null ? null : handleCopyGitApplyCommand}
      onCopyUrl={() => void handleCopyPullRequestUrl(selectedBoardItem)}
      onMarkAsDraft={handleMarkAsDraft}
      onMarkAsReady={handleMarkAsReady}
      onMerge={() => void handleMergePullRequest(selectedBoardItem)}
      onOpenCommentUrl={(url) => void handleOpenCommentUrl(url)}
      onOpenInBrowser={() => void handleOpenPullRequestInBrowser(selectedBoardItem)}
      onPostComment={handlePostComment}
      onPostReply={handlePostReply}
      onRefreshCodeReview={refreshDiff}
      relatedThreads={relatedThreads}
      onSelectTab={setSelectedTab}
      onToggleAutoMerge={handleToggleAutoMerge}
      selectedTab={selectedTab}
    />
  );

  useEffect(() => {
    onSetRightPanelVisible(detailPane !== null);
    return () => {
      onSetRightPanelVisible(false);
    };
  }, [detailPane, onSetRightPanelVisible]);

  const headerContent = useMemo(
    () => (
      <div className="draggable flex w-full min-w-0 items-center justify-between gap-3 py-2">
        <div className="min-w-0 text-base font-medium text-token-foreground">
          {t("pullRequestsPage.title")}
        </div>
        <div className="flex items-center gap-2">
          <PullRequestsHeaderRepoMenu
            disabled={repoOptions.length === 0}
            onChange={handleSelectRepo}
            options={repoOptions}
            selectedRepoKey={selectedRepoKey}
          />
        </div>
      </div>
    ),
    [handleSelectRepo, repoOptions, selectedRepoKey, t],
  );

  const shouldShowPageHeader = !isWorkspaceMetadataLoading && repoOptions.length > 0;

  useEffect(() => {
    onRegisterHeaderContent?.(shouldShowPageHeader ? headerContent : null);
    return () => {
      onRegisterHeaderContent?.(null);
    };
  }, [headerContent, onRegisterHeaderContent, shouldShowPageHeader]);

  useEffect(() => {
    onSetRightPanelCloseAction(selectedBoardItem == null ? null : handleCloseDetail);
    return () => {
      onSetRightPanelCloseAction(null);
    };
  }, [onSetRightPanelCloseAction, selectedBoardItem, selectedRepoKey, routeState.view]);

  if (isWorkspaceMetadataLoading) {
    return <PullRequestsRouteLoadingState />;
  }

  if (noRepos) {
    return (
      <PullRequestsCenteredEmptyState
        description={t("pullRequestsPage.empty.noRepos.description")}
        title={t("pullRequestsPage.empty.noRepos.title")}
      />
    );
  }

  return (
    <>
      <PullRequestsPageView
        boardItems={boardItems}
        boardLoading={boardLoading}
        boardSections={groupPullRequestBoardItems(boardItems)}
        onCopyPullRequestUrl={handleCopyPullRequestUrl}
        onMergePullRequest={handleMergePullRequest}
        onOpenPullRequestInBrowser={handleOpenPullRequestInBrowser}
        onSelectBoardItem={selectPullRequest}
        onSelectFilterView={handleSelectView}
        pageError={pageError}
        pageErrorDetail={pageErrorDetail}
        selectedBoardItem={selectedBoardItem}
        selectedRepoKey={selectedRepoKey}
        selectedView={routeState.view}
      />
      {detailPane && rightPanelHost.current ? createPortal(detailPane, rightPanelHost.current) : null}
    </>
  );

  async function runUpdateAction({
    action,
    enabled,
    item,
    successMessage,
  }: {
    action: "mark-draft" | "mark-ready" | "toggle-auto-merge";
    enabled?: boolean;
    item: {
      cwd: string;
      hostId: string | null;
      number: number;
      repo: string | null;
    };
    successMessage: string;
  }) {
    try {
      const result = await updatePullRequest({
        action,
        cwd: item.cwd,
        enabled,
        hostId: item.hostId,
        number: item.number,
        repo: resolveItemRepoByContext(item),
        mergeMethod,
      });

      if (result.status !== "success") {
        onShowToast({
          description: result.error,
          message: t("pullRequestsPage.detail.actions.errorTitle"),
          tone: "error",
        });
        return;
      }

      onShowToast({
        message: successMessage,
        tone: "success",
      });
      refreshBoard();
      refreshDetail();
      refreshDiff();
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.detail.actions.errorTitle"),
        tone: "error",
      });
    }
  }

  async function runCommentAction({
    body,
    item,
    replyToReviewThreadId = null,
  }: {
    body: string;
    item: {
      cwd: string;
      hostId: string | null;
      number: number;
      repo: string | null;
    };
    replyToReviewThreadId?: string | null;
  }) {
    try {
      const result = await commentPullRequest({
        body,
        cwd: item.cwd,
        hostId: item.hostId,
        number: item.number,
        repo: resolveItemRepoByContext(item),
        replyToReviewThreadId,
      });

      if (result.status !== "success") {
        onShowToast({
          description: result.error,
          message: t("pullRequestsPage.detail.actions.errorTitle"),
          tone: "error",
        });
        return;
      }

      onShowToast({
        message: t("pullRequestsPage.codeReview.commentPosted"),
        tone: "success",
      });
      refreshDetail();
      refreshDiff();
    } catch (error) {
      onShowToast({
        description: formatError(error),
        message: t("pullRequestsPage.detail.actions.errorTitle"),
        tone: "error",
      });
    }
  }

  function resolveItemRepo(item: PullRequestBoardItem, repoOption: PullRequestRepoOption | null) {
    return item.repo ?? repoOption?.repo ?? "";
  }

  function resolveItemRepoByContext(item: { repo: string | null }) {
    return item.repo ?? selectedRepoOption?.repo ?? "";
  }
}

function buildBoardItemKey(item: PullRequestBoardItem | null) {
  if (item == null) {
    return null;
  }

  return `${item.cwd}:${item.headBranch}:${item.hostId ?? ""}:${item.number}:${item.url}`;
}

function resolveSelectedBoardItem(
  items: PullRequestBoardItem[],
  selectedPullRequestNumber: number | null,
  selectedPullRequestUrl: string | null,
) {
  if (selectedPullRequestUrl != null) {
    return items.find((item) => item.url === selectedPullRequestUrl) ?? null;
  }

  if (selectedPullRequestNumber != null) {
    return items.find((item) => item.number === selectedPullRequestNumber) ?? null;
  }

  return null;
}

function readStoredRepoKey() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(PULL_REQUEST_BOARD_LAST_SELECTED_REPO_KEY);
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function writeStoredRepoKey(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PULL_REQUEST_BOARD_LAST_SELECTED_REPO_KEY, value);
  } catch {
    // Ignore persistence failures.
  }
}

function getWindowSearch() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}

function writePullRequestsRouteState(state: PullRequestsRouteState, options?: { replace?: boolean }) {
  if (typeof window === "undefined") {
    return;
  }

  const params = serializePullRequestsRouteState(state);
  const nextSearch = params.toString();
  const nextUrl = nextSearch.length > 0 ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl === nextUrl) {
    return;
  }

  const method = options?.replace === true ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", nextUrl);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
