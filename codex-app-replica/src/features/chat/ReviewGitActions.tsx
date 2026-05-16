import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  OpenInNewWindowIcon,
  RefreshIcon,
  ReviewTabIcon,
  WorktreeIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import type { MessageKey } from "../../i18n/messages";
import {
  checkoutGitBranch,
  commitGitChanges,
  createGitBranch,
  readGitBranches,
  readGitCommitDialogState,
  type GitBranchMutationResponse,
  type GitBranchesResponse,
  type GitChangeSummary,
  type GitCommitDialogStateResponse,
} from "../../services/gitBranches";
import { generateGitCommitMessage } from "../../services/gitCommitMessages";
import { readGitSettingsSnapshot } from "../../services/gitSettings";
import {
  openPullRequestInBrowser,
  readGhCliStatus,
  readPullRequestStatus,
  type GhCliStatusResponse,
  type PullRequestBoardState,
  type PullRequestStatusSuccess,
} from "../../services/pullRequests";
import { showSettings } from "../../services/windowNavigation";
import {
  buildCommitMessagePrompt,
  dedupeBranches,
  getErrorMessage,
  mergeGitChangeSummaries,
  normalizeBranchName,
  sanitizeBranchInput,
} from "../hotkeyWindow/gitBranchUtils";
import {
  PullRequestStateColorClass,
  PullRequestStateIcon,
} from "../pullRequests/PullRequestIcons";

const DEFAULT_BRANCH_PREFIX = "codex/";

type PendingBranchAction =
  | {
      type: "commit-only";
    }
  | {
      type: "create-and-checkout";
      branch: string;
    };

type ReviewGitActionsProps = {
  defaultMenuOpen?: boolean;
  gitRoot: string;
  hostId?: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function ReviewGitActions({
  defaultMenuOpen = false,
  gitRoot,
  hostId = null,
  t,
}: ReviewGitActionsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [branchState, setBranchState] = useState<GitBranchesResponse | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(defaultMenuOpen);
  const [isMutatingBranch, setIsMutatingBranch] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createBranchName, setCreateBranchName] = useState(DEFAULT_BRANCH_PREFIX);
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [conflictedPaths, setConflictedPaths] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingBranchAction | null>(null);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitDialogState, setCommitDialogState] = useState<GitCommitDialogStateResponse | null>(null);
  const [isCommitDialogLoading, setIsCommitDialogLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false);
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [ghCliStatus, setGhCliStatus] = useState<GhCliStatusResponse | null>(null);
  const [isLoadingGhCliStatus, setIsLoadingGhCliStatus] = useState(false);
  const [pullRequestStatus, setPullRequestStatus] = useState<PullRequestStatusSuccess | null>(null);
  const [isLoadingPullRequestStatus, setIsLoadingPullRequestStatus] = useState(false);
  const [pullRequestError, setPullRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readGitBranches({
      gitRoot,
      hostId,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBranchState(response);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to read git branches for review actions", error);
        setBranchState(null);
      });

    return () => {
      cancelled = true;
    };
  }, [gitRoot, hostId, reloadNonce]);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingGhCliStatus(true);
    void readGhCliStatus({ hostId })
      .then((response) => {
        if (!cancelled) {
          setGhCliStatus(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGhCliStatus(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingGhCliStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hostId, reloadNonce]);

  const currentBranch = normalizeBranchName(branchState?.currentBranch);

  useEffect(() => {
    if (
      currentBranch === null ||
      ghCliStatus?.isInstalled !== true ||
      ghCliStatus.isAuthenticated !== true
    ) {
      setPullRequestStatus(null);
      setPullRequestError(null);
      setIsLoadingPullRequestStatus(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPullRequestStatus(true);
    void readPullRequestStatus({
      cwd: gitRoot,
      headBranch: currentBranch,
      hostId,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        if (response.status === "success") {
          setPullRequestStatus(response);
          setPullRequestError(null);
          return;
        }
        setPullRequestStatus(null);
        setPullRequestError(response.error);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPullRequestStatus(null);
        setPullRequestError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPullRequestStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentBranch, ghCliStatus?.isAuthenticated, ghCliStatus?.isInstalled, gitRoot, hostId, reloadNonce]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isCreateDialogOpen) {
      return;
    }

    let cancelled = false;
    void readGitSettingsSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        const suggestedPrefix = snapshot.branchPrefix.trim();
        setCreateBranchName(suggestedPrefix.length > 0 ? suggestedPrefix : DEFAULT_BRANCH_PREFIX);
      })
      .catch(() => {
        if (!cancelled) {
          setCreateBranchName(DEFAULT_BRANCH_PREFIX);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCreateDialogOpen]);

  useEffect(() => {
    if (!isCommitDialogOpen) {
      return;
    }

    let cancelled = false;
    setCommitDialogState(null);
    setCommitError(null);
    setIsCommitDialogLoading(true);
    void readGitCommitDialogState({ gitRoot, hostId })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setCommitDialogState(response);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setCommitError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsCommitDialogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gitRoot, hostId, isCommitDialogOpen]);

  const defaultBranch = normalizeBranchName(branchState?.defaultBranch);
  const currentBranchLabel = currentBranch ?? defaultBranch ?? "HEAD";
  const branches = useMemo(
    () =>
      dedupeBranches([
        ...(defaultBranch ? [defaultBranch] : []),
        ...(currentBranch ? [currentBranch] : []),
        ...(branchState?.recentBranches ?? []),
      ]),
    [branchState?.recentBranches, currentBranch, defaultBranch],
  );
  const isBusy = isMutatingBranch || isCommitting || isGeneratingCommitMessage;
  const branchChangeCount = getUncommittedFileCount(branchState);
  const targetBranchName =
    pendingAction?.type === "create-and-checkout" ? pendingAction.branch : currentBranchLabel;
  const createBranchExists = branches.some(
    (branch) => branch.toLowerCase() === createBranchName.trim().toLowerCase(),
  );
  const createBranchEndsWithSlash = createBranchName.trim().endsWith("/");
  const canCreateBranch =
    createBranchName.trim().length > 0 &&
    !createBranchEndsWithSlash &&
    !createBranchExists &&
    !isMutatingBranch;
  const selectedCommitSummary = useMemo(
    () =>
      mergeGitChangeSummaries(
        commitDialogState?.stagedSummary,
        includeUnstaged ? commitDialogState?.unstagedSummary : null,
      ),
    [commitDialogState?.stagedSummary, commitDialogState?.unstagedSummary, includeUnstaged],
  );
  const hasSelectedCommitChanges = selectedCommitSummary.files > 0;
  const isCommitActionDisabled =
    isCommitDialogLoading || isBusy || pendingAction === null || !hasSelectedCommitChanges;
  const canUsePullRequests =
    ghCliStatus?.isInstalled === true &&
    ghCliStatus.isAuthenticated === true &&
    currentBranch !== null;
  const pullRequestState = mapPullRequestState(pullRequestStatus);
  const gitActionsLabel = t("localConversationPage.gitActions");
  const shouldRenderPullRequestStatus =
    pullRequestStatus?.hasOpenPr === true && pullRequestState !== null;

  const reloadAll = () => {
    setReloadNonce((current) => current + 1);
  };

  const closeConflictFlow = () => {
    setIsConflictDialogOpen(false);
    setIsCommitDialogOpen(false);
    setConflictedPaths([]);
    setPendingAction(null);
    setCommitMessage("");
    setCommitError(null);
    setCommitDialogState(null);
    setIsCommitDialogLoading(false);
    setIsGeneratingCommitMessage(false);
    setIncludeUnstaged(true);
  };

  const openConflictDialog = (
    result: Extract<GitBranchMutationResponse, { status: "error" }>,
    action: PendingBranchAction,
  ) => {
    setConflictedPaths(result.conflictedPaths ?? []);
    setPendingAction(action);
    setIsMenuOpen(false);
    setIsCreateDialogOpen(false);
    setIsConflictDialogOpen(true);
  };

  const performCreateAndCheckoutBranch = async (
    branch: string,
    options?: {
      allowExistingBranch?: boolean;
    },
  ) => {
    setIsMutatingBranch(true);
    setCreateBranchError(null);

    try {
      const createResult = await createGitBranch({
        gitRoot,
        hostId,
        branch,
        failIfExists: true,
      });
      if (createResult.status === "error") {
        if (
          createResult.errorType !== "branch-already-exists" ||
          options?.allowExistingBranch !== true
        ) {
          setCreateBranchError(
            createResult.error ||
              t("composer.footer.branchSwitch.createBranchError", { message: "Unknown error" }),
          );
          return;
        }
      }

      const checkoutResult = await checkoutGitBranch({
        gitRoot,
        hostId,
        branch,
      });
      if (checkoutResult.status === "error") {
        if (checkoutResult.errorType === "blocked-by-working-tree-changes") {
          openConflictDialog(checkoutResult, { type: "create-and-checkout", branch });
          return;
        }
        setCreateBranchError(
          checkoutResult.error ||
            t("composer.footer.branchSwitch.checkoutError", { message: "Unknown error" }),
        );
        return;
      }

      setIsMenuOpen(false);
      setIsCreateDialogOpen(false);
      closeConflictFlow();
      reloadAll();
    } catch (error) {
      setCreateBranchError(
        getErrorMessage(error) ||
          t("composer.footer.branchSwitch.createBranchError", { message: "Unknown error" }),
      );
    } finally {
      setIsMutatingBranch(false);
    }
  };

  const generateCommitMessageIfNeeded = async () => {
    const existingMessage = commitMessage.trim();
    if (existingMessage.length > 0) {
      return existingMessage;
    }

    setIsGeneratingCommitMessage(true);
    try {
      const gitSettings = await readGitSettingsSnapshot();
      const response = await generateGitCommitMessage({
        prompt: buildCommitMessagePrompt({
          commitInstructions: gitSettings.commitInstructions,
          draftMessage: commitMessage,
          uncommittedDiff: commitDialogState?.trackedChangesUnifiedDiff ?? null,
        }),
        cwd: gitRoot,
      });
      const generatedMessage = response.message?.trim() ?? "";
      if (generatedMessage.length === 0) {
        setCommitError(t("review.commit.generate.emptyResponse"));
        return null;
      }
      setCommitMessage((current) => (current.trim().length === 0 ? generatedMessage : current));
      return generatedMessage;
    } catch (error) {
      setCommitError(
        t("review.commit.generate.failed", {
          error: getErrorMessage(error) || "Unknown error",
        }),
      );
      return null;
    } finally {
      setIsGeneratingCommitMessage(false);
    }
  };

  const handleCommitAndContinue = async () => {
    if (pendingAction === null || isCommitActionDisabled) {
      return;
    }

    setCommitError(null);
    const resolvedCommitMessage = await generateCommitMessageIfNeeded();
    if (resolvedCommitMessage === null) {
      return;
    }

    setIsCommitting(true);
    try {
      const result = await commitGitChanges({
        gitRoot,
        hostId,
        message: resolvedCommitMessage,
        includeUnstaged,
      });
      if (result.status === "error") {
        setCommitError(result.error);
        return;
      }

      const nextAction = pendingAction;
      closeConflictFlow();
      reloadAll();
      if (nextAction.type === "commit-only") {
        return;
      }
      await performCreateAndCheckoutBranch(nextAction.branch, { allowExistingBranch: true });
    } catch (error) {
      setCommitError(getErrorMessage(error));
    } finally {
      setIsCommitting(false);
    }
  };

  const pullRequestSummary = buildPullRequestSummary({
    canUsePullRequests,
    ghCliStatus,
    isLoadingGhCliStatus,
    isLoadingPullRequestStatus,
    pullRequestError,
    pullRequestStatus,
    state: pullRequestState,
    t,
  });

  return (
    <>
      <div className="relative" ref={containerRef}>
        <ReviewToolbarTooltip content={gitActionsLabel}>
          <Button
            aria-label={gitActionsLabel}
            aria-pressed={isMenuOpen}
            className="shrink-0"
            color={isMenuOpen ? "ghostActive" : "ghost"}
            data-state={isMenuOpen ? "open" : "closed"}
            onClick={() => setIsMenuOpen((open) => !open)}
            size="toolbar"
            uniform
          >
            {isBusy ? (
              <Spinner className="icon-xxs" />
            ) : (
              <WorktreeIcon className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </ReviewToolbarTooltip>
        {isMenuOpen ? (
          <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[320px] rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setPendingAction({ type: "commit-only" });
                    setIsMenuOpen(false);
                    setIsCommitDialogOpen(true);
                  }}
                  className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
                  <span className="truncate">{t("review.commit.buttonLabel")}</span>
                </button>
                {pullRequestStatus?.url ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!pullRequestStatus?.url) {
                        return;
                      }
                      setIsMenuOpen(false);
                      void openPullRequestInBrowser(pullRequestStatus.url);
                    }}
                    className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
                  >
                    <OpenInNewWindowIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
                    <span className="truncate">{t("localConversation.pullRequest.actions.viewPr")}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCreateDialogOpen(true);
                  }}
                  className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  <WorktreeIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
                  <span className="truncate">{t("localConversation.gitActions.createBranch")}</span>
                </button>
              </div>

              {shouldRenderPullRequestStatus ? (
                <div className="border-t border-[var(--app-shell-border)] pt-2">
                  <MenuSectionTitle label={t("localConversation.pullRequest.actions.statusTitle")} />
                  <div className="rounded-[10px] border border-[var(--app-shell-border)] px-3 py-2">
                    <div className="flex items-start gap-2">
                      {pullRequestSummary.icon}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-[var(--app-shell-text)]">
                          {pullRequestSummary.title}
                        </div>
                        {pullRequestSummary.description ? (
                          <div className="app-text-muted mt-1 text-[12px] leading-5">
                            {pullRequestSummary.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isCreateDialogOpen ? (
        <DialogOverlay>
          <DialogCard
            actions={
              <>
                <Button color="secondary" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("composer.footer.branchSwitch.createDialog.close")}
                </Button>
                <Button
                  color="primary"
                  disabled={!canCreateBranch}
                  loading={isMutatingBranch}
                  onClick={() => void performCreateAndCheckoutBranch(createBranchName.trim())}
                >
                  {t("composer.footer.branchSwitch.createDialog.createAndCheckout")}
                </Button>
              </>
            }
            title={t("composer.footer.branchSwitch.createDialog.title")}
          >
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                className="app-control app-text-input w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
                aria-label={t("composer.footer.branchSwitch.createDialog.ariaLabel")}
                placeholder={t("composer.footer.branchSwitch.createDialog.placeholder")}
                value={createBranchName}
                onChange={(event) => {
                  setCreateBranchError(null);
                  setCreateBranchName(sanitizeBranchInput(event.target.value));
                }}
              />
              {createBranchEndsWithSlash ? (
                <div className="text-[12px] text-[var(--app-shell-danger-text)]">
                  {t("composer.footer.branchSwitch.createDialog.trailingSlashError")}
                </div>
              ) : null}
              {!createBranchEndsWithSlash && createBranchExists ? (
                <div className="text-[12px] text-[var(--app-shell-danger-text)]">
                  {t("composer.footer.branchSwitch.createDialog.branchExistsError")}
                </div>
              ) : null}
              {createBranchError ? (
                <div className="text-[12px] text-[var(--app-shell-danger-text)]">
                  {createBranchError}
                </div>
              ) : null}
            </div>
          </DialogCard>
        </DialogOverlay>
      ) : null}

      {isConflictDialogOpen ? (
        <DialogOverlay>
          <DialogCard
            actions={
              <>
                <Button color="secondary" onClick={closeConflictFlow}>
                  {t("composer.footer.branchSwitch.uncommittedDialog.cancel")}
                </Button>
                <Button
                  color="primary"
                  onClick={() => {
                    setIsConflictDialogOpen(false);
                    setCommitMessage("");
                    setCommitError(null);
                    setIncludeUnstaged(true);
                    setIsCommitDialogOpen(true);
                  }}
                >
                  {t("composer.footer.branchSwitch.uncommittedDialog.commit")}
                </Button>
              </>
            }
            title={t("composer.footer.branchSwitch.uncommittedDialog.title")}
          >
            {conflictedPaths.length > 0 ? (
              <div className="space-y-3 text-[13px] leading-6 text-[var(--app-shell-subtle)]">
                <div>{t("composer.footer.branchSwitch.uncommittedDialog.conflict.bodyPrefix")}</div>
                <div className="max-h-[180px] overflow-y-auto rounded-[10px] border border-[var(--app-shell-border)] px-3 py-2 text-[12px] text-[var(--app-shell-text)]">
                  {conflictedPaths.map((path) => (
                    <div key={path} className="truncate">
                      {path}
                    </div>
                  ))}
                </div>
                <div>{t("composer.footer.branchSwitch.uncommittedDialog.conflict.bodySuffix")}</div>
              </div>
            ) : (
              <div className="text-[13px] leading-6 text-[var(--app-shell-subtle)]">
                {t("composer.footer.branchSwitch.uncommittedDialog.body.noDiff", {
                  branchName: targetBranchName,
                  fileCount: Math.max(branchChangeCount, 1),
                })}
              </div>
            )}
          </DialogCard>
        </DialogOverlay>
      ) : null}

      {isCommitDialogOpen ? (
        <DialogOverlay>
          <DialogCard
            actions={
              <>
                <div className="mr-auto flex items-center gap-3">
                  <input
                    aria-label={t("review.commit.ariaLabel.includeUnstaged")}
                    checked={includeUnstaged}
                    disabled={isBusy}
                    onChange={(event) => setIncludeUnstaged(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-[13px] text-[var(--app-shell-text)]">
                    {t("review.commit.includeUnstaged")}
                  </span>
                </div>
                <Button color="secondary" onClick={closeConflictFlow}>
                  {t("composer.footer.branchSwitch.commitDialog.cancel")}
                </Button>
                <Button
                  color="primary"
                  disabled={isCommitActionDisabled}
                  loading={isCommitting || isGeneratingCommitMessage}
                  onClick={() => void handleCommitAndContinue()}
                >
                  {t("review.commit.form.continue")}
                </Button>
              </>
            }
            title={t("review.commit.form.title")}
          >
            <div className="flex flex-col gap-4">
              <CommitMetadataRow
                label={t("review.commit.form.commitTo")}
                target={
                  normalizeBranchName(commitDialogState?.currentBranch) ??
                  currentBranch ??
                  defaultBranch ??
                  t("review.commit.form.commitTo.none")
                }
              />
              <CommitSummaryRow
                label={t("review.commit.form.changesToBeCommitted")}
                summary={selectedCommitSummary}
                isLoading={isCommitDialogLoading}
                noChangesLabel={t("localConversation.sync.modal.noChanges")}
                fileCountLabel={t("review.commit.rows.fileCount", {
                  count: selectedCommitSummary.files,
                })}
              />
              <div className="flex items-center justify-between gap-4">
                <div className="text-[12px] font-medium text-[var(--app-shell-text)]">
                  {t("review.commit.messageLabel")}
                </div>
                <button
                  type="button"
                  className="text-[12px] text-[var(--app-shell-subtle)] hover:text-[var(--app-shell-text)]"
                  onClick={() => {
                    void showSettings("personalization");
                  }}
                >
                  {t("review.commit.customInstructionsLink")}
                </button>
              </div>
              <textarea
                autoFocus
                className="app-control app-text-input min-h-[96px] w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
                placeholder={t("review.commit.messagePlaceholder")}
                value={commitMessage}
                disabled={isBusy}
                onChange={(event) => {
                  setCommitError(null);
                  setCommitMessage(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void handleCommitAndContinue();
                  }
                }}
              />
              {commitError ? (
                <div className="text-[12px] text-[var(--app-shell-danger-text)]">{commitError}</div>
              ) : null}
            </div>
          </DialogCard>
        </DialogOverlay>
      ) : null}
    </>
  );
}

function MenuSectionTitle({ label }: { label: string }) {
  return (
    <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-muted)]">
      {label}
    </div>
  );
}

function buildPullRequestSummary({
  canUsePullRequests,
  ghCliStatus,
  isLoadingGhCliStatus,
  isLoadingPullRequestStatus,
  pullRequestError,
  pullRequestStatus,
  state,
  t,
}: {
  canUsePullRequests: boolean;
  ghCliStatus: GhCliStatusResponse | null;
  isLoadingGhCliStatus: boolean;
  isLoadingPullRequestStatus: boolean;
  pullRequestError: string | null;
  pullRequestStatus: PullRequestStatusSuccess | null;
  state: PullRequestBoardState | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoadingGhCliStatus || isLoadingPullRequestStatus) {
    return {
      title: t("review.gitActions.prStatus.loading"),
      description: null,
      icon: <Spinner className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
    };
  }

  if (ghCliStatus?.isInstalled === false) {
    return {
      title: t("review.gitActions.prStatus.notInstalled"),
      description: null,
      icon: <WorktreeIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
    };
  }

  if (ghCliStatus?.isInstalled === true && ghCliStatus.isAuthenticated === false) {
    return {
      title: t("review.gitActions.prStatus.notAuthenticated"),
      description: t("review.gitActions.prStatus.notAuthenticatedHint"),
      icon: <WorktreeIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
    };
  }

  if (!canUsePullRequests) {
    return {
      title: t("review.gitActions.prStatus.noBranch"),
      description: null,
      icon: <WorktreeIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
    };
  }

  if (pullRequestError) {
    return {
      title: t("review.gitActions.prStatus.loadError"),
      description: pullRequestError,
      icon: <WorktreeIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-danger-text)]" />,
    };
  }

  if (pullRequestStatus?.hasOpenPr && state !== null) {
    return {
      title:
        pullRequestStatus.number == null
          ? t("review.gitActions.prStatus.available")
          : `PR #${pullRequestStatus.number}`,
      description: summarizePullRequestState(pullRequestStatus, state, t),
      icon: (
        <PullRequestStateIcon
          className={["h-4 w-4 shrink-0", PullRequestStateColorClass(state)].join(" ")}
          state={state}
        />
      ),
    };
  }

  return {
    title: t("review.gitActions.prStatus.none"),
    description: null,
    icon: <ReviewTabIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />,
  };
}

function summarizePullRequestState(
  pullRequestStatus: PullRequestStatusSuccess,
  state: PullRequestBoardState,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (state) {
    case "draft":
      return t("review.gitActions.prState.draft");
    case "merged":
      return t("review.gitActions.prState.merged");
    case "failing":
      return t("review.gitActions.prState.checksFailing");
    case "in_progress":
      return t("review.gitActions.prState.checksInProgress");
    case "ready":
      if (pullRequestStatus.reviewStatus === "changes_requested") {
        return t("review.gitActions.prState.changesRequested");
      }
      if (pullRequestStatus.reviewStatus === "approved") {
        return t("review.gitActions.prState.approved");
      }
      return t("review.gitActions.prState.ready");
  }
}

function mapPullRequestState(
  pullRequestStatus: PullRequestStatusSuccess | null,
): PullRequestBoardState | null {
  if (pullRequestStatus === null || !pullRequestStatus.hasOpenPr) {
    return null;
  }

  if (pullRequestStatus.isDraft) {
    return "draft";
  }
  if (pullRequestStatus.url == null) {
    return null;
  }
  if (pullRequestStatus.canMerge && pullRequestStatus.ciStatus === "passing") {
    return "ready";
  }
  if (pullRequestStatus.ciStatus === "pending") {
    return "in_progress";
  }
  if (pullRequestStatus.ciStatus === "failing") {
    return "failing";
  }
  return "ready";
}

function CommitMetadataRow({
  label,
  target,
}: {
  label: string;
  target: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="font-medium text-[var(--app-shell-text)]">{label}</span>
      <span className="truncate text-[var(--app-shell-text)]">{target}</span>
    </div>
  );
}

function CommitSummaryRow({
  label,
  summary,
  isLoading,
  noChangesLabel,
  fileCountLabel,
}: {
  label: string;
  summary: GitChangeSummary;
  isLoading: boolean;
  noChangesLabel: string;
  fileCountLabel: string;
}) {
  const hasSummary = summary.files > 0 || summary.totalAdditions > 0 || summary.totalDeletions > 0;

  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="font-medium text-[var(--app-shell-text)]">{label}</span>
      {isLoading ? (
        <RefreshIcon className="h-3.5 w-3.5 animate-spin text-token-text-secondary" />
      ) : hasSummary ? (
        <span className="flex items-center gap-3 whitespace-nowrap text-[var(--app-shell-subtle)]">
          <span>{fileCountLabel}</span>
          <span>
            +{summary.totalAdditions}/-{summary.totalDeletions}
          </span>
        </span>
      ) : (
        <span className="text-[var(--app-shell-subtle)]">{noChangesLabel}</span>
      )}
    </div>
  );
}

function DialogCard({
  actions,
  children,
  title,
}: {
  actions: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="app-card w-full max-w-[520px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <div className="app-title text-[15px] font-medium">{title}</div>
      <div className="mt-3">{children}</div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </div>
  );
}

function DialogOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      {children}
    </div>
  );
}

function getUncommittedFileCount(branchState: GitBranchesResponse | null) {
  if (branchState === null) {
    return 0;
  }
  return Math.max(branchState.stagedCount, branchState.unstagedCount) + branchState.untrackedCount;
}

function ReviewToolbarTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden max-w-[min(32rem,calc(100vw-16px))] -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}
