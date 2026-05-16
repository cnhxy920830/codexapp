import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  RefreshIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
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
import { readGitSettingsSnapshot } from "../../services/gitSettings";
import { showSettings } from "../../services/windowNavigation";
import {
  dedupeBranches,
  getErrorMessage,
  mergeGitChangeSummaries,
  normalizeBranchName,
  sanitizeBranchInput,
} from "../hotkeyWindow/gitBranchUtils";

const DEFAULT_BRANCH_PREFIX = "codex/";
const SEARCH_DEBOUNCE_MS = 200;

type PendingBranchAction =
  | {
      type: "checkout";
      branch: string;
    }
  | {
      type: "create-and-checkout";
      branch: string;
    };

type ThreadComposerBranchSwitcherProps = {
  gitRoot: string;
  hostId?: string | null;
  fallbackBranchLabel?: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function ThreadComposerBranchSwitcher({
  gitRoot,
  hostId = null,
  fallbackBranchLabel = null,
  t,
}: ThreadComposerBranchSwitcherProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [branchState, setBranchState] = useState<GitBranchesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createBranchName, setCreateBranchName] = useState(DEFAULT_BRANCH_PREFIX);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [conflictedPaths, setConflictedPaths] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingBranchAction | null>(null);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [commitDialogState, setCommitDialogState] = useState<GitCommitDialogStateResponse | null>(null);
  const [isCommitDialogLoading, setIsCommitDialogLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setQuery("");
    setDebouncedQuery("");
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    void readGitBranches({
      gitRoot,
      hostId,
      query: debouncedQuery,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBranchState(response);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, gitRoot, hostId, reloadNonce]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

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
    setCommitError(null);
    setCommitDialogState(null);
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

  const currentBranch = normalizeBranchName(branchState?.currentBranch);
  const defaultBranch = normalizeBranchName(branchState?.defaultBranch);
  const currentBranchLabel =
    currentBranch ??
    defaultBranch ??
    (fallbackBranchLabel?.trim().length ? fallbackBranchLabel.trim() : null) ??
    (isLoading ? t("localConversation.syncSetup.branchesLoading") : t("localConversation.syncSetup.noBranches"));
  const branches = useMemo(
    () =>
      dedupeBranches([
        ...(defaultBranch ? [defaultBranch] : []),
        ...(currentBranch ? [currentBranch] : []),
        ...(branchState?.recentBranches ?? []),
      ]),
    [branchState?.recentBranches, currentBranch, defaultBranch],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedDebouncedQuery = debouncedQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const visibleBranches = isSearching
    ? dedupeBranches(
        branchState?.searchBranches ??
          branches.filter((branch) => branch.toLowerCase().includes(normalizedQuery)),
      )
    : branches;
  const hasBranches = (branchState?.recentBranches.length ?? 0) > 0;
  const branchChangeCount = getUncommittedFileCount(branchState);
  const isSearchLoading =
    (normalizedQuery !== normalizedDebouncedQuery && normalizedQuery.length > 0) ||
    (isLoading && isSearching);
  const isListLoading = isLoading && !isSearching && branchState === null;
  const isBusy = isMutating || isCommitting;
  const targetBranchName =
    pendingAction?.branch ?? t("composer.footer.branchSwitch.uncommittedDialog.targetBranchFallback");
  const createBranchExists = branches.some(
    (branch) => branch.toLowerCase() === createBranchName.trim().toLowerCase(),
  );
  const createBranchEndsWithSlash = createBranchName.trim().endsWith("/");
  const canCreateBranch =
    createBranchName.trim().length > 0 &&
    !createBranchEndsWithSlash &&
    !createBranchExists &&
    !isMutating &&
    !isLoading &&
    hasBranches;
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

  const reloadBranches = () => {
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
    setIncludeUnstaged(true);
  };

  const openConflictDialog = (
    result: Extract<GitBranchMutationResponse, { status: "error" }>,
    action: PendingBranchAction,
  ) => {
    setConflictedPaths(result.conflictedPaths ?? []);
    setPendingAction(action);
    setIsOpen(false);
    setIsCreateDialogOpen(false);
    setIsConflictDialogOpen(true);
  };

  const performCheckoutBranch = async (branch: string) => {
    setIsMutating(true);
    setMutationError(null);
    try {
      const result = await checkoutGitBranch({
        gitRoot,
        hostId,
        branch,
      });
      if (result.status === "error") {
        if (result.errorType === "blocked-by-working-tree-changes") {
          openConflictDialog(result, { type: "checkout", branch });
          return;
        }
        setMutationError(result.error);
        return;
      }

      setIsOpen(false);
      closeConflictFlow();
      reloadBranches();
    } catch (error) {
      setMutationError(
        getErrorMessage(error) ||
          t("composer.footer.branchSwitch.checkoutError", { message: "Unknown error" }),
      );
    } finally {
      setIsMutating(false);
    }
  };

  const performCreateAndCheckoutBranch = async (branch: string) => {
    setIsMutating(true);
    setMutationError(null);

    try {
      const createResult = await createGitBranch({
        gitRoot,
        hostId,
        branch,
        failIfExists: true,
      });
      if (createResult.status === "error") {
        setMutationError(
          createResult.error ||
            t("composer.footer.branchSwitch.createBranchError", { message: "Unknown error" }),
        );
        return;
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
        setMutationError(
          checkoutResult.error ||
            t("composer.footer.branchSwitch.checkoutError", { message: "Unknown error" }),
        );
        return;
      }

      setIsOpen(false);
      setIsCreateDialogOpen(false);
      closeConflictFlow();
      reloadBranches();
    } catch (error) {
      setMutationError(
        getErrorMessage(error) ||
          t("composer.footer.branchSwitch.createBranchError", { message: "Unknown error" }),
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCommitAndContinue = async () => {
    if (pendingAction === null) {
      return;
    }

    setIsCommitting(true);
    setCommitError(null);

    try {
      const result = await commitGitChanges({
        gitRoot,
        hostId,
        message: commitMessage.trim(),
        includeUnstaged,
      });
      if (result.status === "error") {
        setCommitError(result.error);
        return;
      }

      setIsCommitDialogOpen(false);
      if (pendingAction.type === "checkout") {
        await performCheckoutBranch(pendingAction.branch);
        return;
      }
      await performCreateAndCheckoutBranch(pendingAction.branch);
    } catch (error) {
      setCommitError(getErrorMessage(error));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          className="app-thread-composer-footer-pill max-w-[240px]"
          onClick={() => setIsOpen((open) => !open)}
          title={t("composer.footer.branchSwitch.tooltip")}
        >
          <span className="truncate">{currentBranchLabel}</span>
          {isBusy ? (
            <RefreshIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>
        {isOpen ? (
          <div className="app-card absolute bottom-[calc(100%+10px)] left-0 z-20 w-[288px] rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-2">
              <input
                aria-label={t("codex.composer.searchBranches")}
                className="app-control app-text-input w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
                placeholder={t("codex.composer.searchBranches")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-[260px] overflow-y-auto">
                {loadError ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                    <div className="text-[13px] text-[var(--app-shell-danger-text)]">
                      {t("composer.reviewMode.branches.error")}
                    </div>
                    <Button color="secondary" size="composerSm" onClick={reloadBranches}>
                      <RefreshIcon className="h-3.5 w-3.5" />
                      {t("composer.reviewMode.branches.retry")}
                    </Button>
                  </div>
                ) : isListLoading || isSearchLoading ? (
                  <div className="app-text-muted px-3 py-5 text-center text-[13px]">
                    {t("localConversation.syncSetup.branchesLoading")}
                  </div>
                ) : visibleBranches.length === 0 ? (
                  <div className="app-text-muted px-3 py-5 text-center text-[13px]">
                    {t("localConversation.syncSetup.noBranches")}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {visibleBranches.map((branch) => (
                      <button
                        key={branch}
                        type="button"
                        className={[
                          "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                          branch === currentBranch ? "app-nav-item-active" : "app-nav-item-idle",
                        ].join(" ")}
                        onClick={() => void performCheckoutBranch(branch)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{branch}</span>
                          {branch === currentBranch && branchChangeCount > 0 ? (
                            <span className="app-text-muted mt-1 block text-[12px] leading-5">
                              {t("composer.footer.branchSwitch.uncommittedSummaryPrefix", {
                                fileCount: branchChangeCount,
                              })}
                            </span>
                          ) : null}
                        </span>
                        {branch === currentBranch ? (
                          <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-[var(--app-shell-border)] pt-2">
                <button
                  type="button"
                  disabled={!hasBranches || isBusy}
                  onClick={() => {
                    setIsOpen(false);
                    setIsCreateDialogOpen(true);
                  }}
                  className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                >
                  {t("composer.footer.branchSwitch.createAndCheckout")}
                </button>
              </div>
              {mutationError ? (
                <div className="px-3 pb-1 text-[12px] text-[var(--app-shell-danger-text)]">
                  {mutationError}
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
                  loading={isMutating}
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
                onChange={(event) => setCreateBranchName(sanitizeBranchInput(event.target.value))}
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
                  loading={isCommitting}
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
                  targetBranchName
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
  actions: React.ReactNode;
  children: React.ReactNode;
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

function DialogOverlay({ children }: { children: React.ReactNode }) {
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
