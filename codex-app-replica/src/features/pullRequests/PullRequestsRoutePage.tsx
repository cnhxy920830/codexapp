import { useEffect, useMemo, useRef, useState } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
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
import { readActiveWorkspaceRoots, readWorkspaceRootOptions } from "../../services/workspaceRoots";
import { readGitOrigins, type GitOrigin } from "../../services/gitOrigins";
import { buildPullRequestGitApplyCommand, parsePullRequestUnifiedDiff } from "./pullRequestDiffModel";
import {
  PULL_REQUEST_BOARD_LAST_SELECTED_REPO_KEY,
  buildPullRequestRepoOptions,
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
import { PullRequestsPageView } from "./PullRequestsPageView";

type PullRequestsRoutePageProps = {
  onShowToast: (toast: AppToast) => void;
};

export function PullRequestsRoutePage({ onShowToast }: PullRequestsRoutePageProps) {
  const { t } = useI18n();
  const [routeState, setRouteState] = useState<PullRequestsRouteState>(() =>
    parsePullRequestsRouteState(getWindowSearch(), readStoredRepoKey()),
  );
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [workspaceRootLabels, setWorkspaceRootLabels] = useState<Record<string, string>>({});
  const [activeWorkspaceRoots, setActiveWorkspaceRoots] = useState<string[]>([]);
  const [gitOrigins, setGitOrigins] = useState<GitOrigin[]>([]);
  const [isWorkspaceMetadataLoading, setIsWorkspaceMetadataLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageErrorDetail, setPageErrorDetail] = useState<string | null>(null);
  const [boardItems, setBoardItems] = useState<PullRequestBoardItem[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
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
  const metadataRequestIdRef = useRef(0);
  const boardRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const diffRequestIdRef = useRef(0);
  const lastAutoOpenBoardKeyRef = useRef<string | null>(null);
  const lastBoardQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++metadataRequestIdRef.current;

    setIsWorkspaceMetadataLoading(true);
    setPageError(null);
    setPageErrorDetail(null);

    void Promise.all([readWorkspaceRootOptions(), readActiveWorkspaceRoots(), readGitOrigins()])
      .then(([rootOptions, activeRoots, origins]) => {
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        setWorkspaceRoots(rootOptions.roots);
        setWorkspaceRootLabels(rootOptions.labels);
        setActiveWorkspaceRoots(activeRoots.roots);
        setGitOrigins(origins.origins);
      })
      .catch((error) => {
        if (cancelled || requestId !== metadataRequestIdRef.current) {
          return;
        }

        const message = formatError(error);
        setPageError(message);
        setPageErrorDetail(message);
      })
      .finally(() => {
        if (!cancelled && requestId === metadataRequestIdRef.current) {
          setIsWorkspaceMetadataLoading(false);
        }
      });

    return () => {
      cancelled = true;
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

  const repoOptions = useMemo(
    () =>
      buildPullRequestRepoOptions({
        activeWorkspaceRoots,
        gitOrigins,
        workspaceRootLabels,
        workspaceRoots,
      }),
    [activeWorkspaceRoots, gitOrigins, workspaceRootLabels, workspaceRoots],
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
        mergeMethod: "merge",
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

  return (
    <PullRequestsPageView
      boardItems={boardItems}
      boardLoading={boardLoading}
      boardSections={groupPullRequestBoardItems(boardItems)}
      codeReviewError={codeReviewError}
      cwd={selectedBoardItemContext?.cwd ?? null}
      detail={detail}
      detailError={detailError}
      detailKey={detailKey}
      detailLoading={detailLoading}
      diffFiles={diffFiles}
      isCodeReviewLoading={isCodeReviewLoading}
      noRepos={noRepos}
      onCloseDetail={handleCloseDetail}
      onCopyGitApplyCommand={unifiedDiff == null ? null : handleCopyGitApplyCommand}
      onCopyPullRequestUrl={handleCopyPullRequestUrl}
      onMarkAsDraft={handleMarkAsDraft}
      onMarkAsReady={handleMarkAsReady}
      onMergePullRequest={handleMergePullRequest}
      onOpenCommentUrl={handleOpenCommentUrl}
      onOpenPullRequestInBrowser={handleOpenPullRequestInBrowser}
      onPostComment={handlePostComment}
      onPostReply={handlePostReply}
      onRefreshCodeReview={refreshDiff}
      onSelectBoardItem={selectPullRequest}
      onSelectFilterView={handleSelectView}
      onSelectRepo={handleSelectRepo}
      onSelectTab={setSelectedTab}
      onToggleAutoMerge={handleToggleAutoMerge}
      hostId={selectedBoardItemContext?.hostId ?? null}
      pageError={pageError}
      pageErrorDetail={pageErrorDetail}
      repoOptions={repoOptions}
      selectedBoardItem={selectedBoardItem}
      selectedRepoKey={selectedRepoKey}
      selectedTab={selectedTab}
      selectedView={routeState.view}
      isWorkspaceMetadataLoading={isWorkspaceMetadataLoading}
    />
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
        mergeMethod: "merge",
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
