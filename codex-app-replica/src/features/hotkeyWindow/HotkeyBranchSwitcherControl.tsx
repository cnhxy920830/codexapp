import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useI18n } from "../../i18n/i18n";
import { generateGitCommitMessage } from "../../services/gitCommitMessages";
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
  buildCommitMessagePrompt,
  dedupeBranches,
  getErrorMessage,
  mergeGitChangeSummaries,
  normalizeBranchName,
  sanitizeBranchInput,
} from "./gitBranchUtils";

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

export function HotkeyBranchSwitcherControl({
  gitRoot,
}: {
  gitRoot: string;
}) {
  const { t } = useI18n();
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
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [conflictedPaths, setConflictedPaths] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingBranchAction | null>(null);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false);
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
  }, [debouncedQuery, gitRoot, reloadNonce]);

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
    setCreateBranchError(null);
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
    void readGitCommitDialogState({ gitRoot })
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
  }, [gitRoot, isCommitDialogOpen]);

  const currentBranch = normalizeBranchName(branchState?.currentBranch);
  const currentBranchLabel =
    currentBranch ??
    normalizeBranchName(branchState?.defaultBranch) ??
    (isLoading
      ? t("composer.remote.loadingMoreBranches")
      : t("localConversation.syncSetup.noBranches"));
  const defaultBranch = normalizeBranchName(branchState?.defaultBranch);
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
  const createDisabledReason =
    !isLoading && !loadError && !hasBranches
      ? t("composer.footer.branchSwitch.createAndCheckout.disabledTooltip")
      : null;
  const branchChangeCount = getUncommittedFileCount(branchState);
  const isSearchLoading =
    (normalizedQuery !== normalizedDebouncedQuery && normalizedQuery.length > 0) ||
    (isLoading && isSearching);
  const isListLoading = isLoading && !isSearching && branchState === null;
  const isBusy = isMutating || isCommitting || isGeneratingCommitMessage;
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
  const commitTargetBranch =
    normalizeBranchName(commitDialogState?.currentBranch) ??
    currentBranch ??
    defaultBranch ??
    targetBranchName;
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
    setIsGeneratingCommitMessage(false);
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

  const handleCheckoutBranch = async (branch: string) => {
    if (isBusy) {
      return;
    }
    await performCheckoutBranch(branch);
  };

  const performCreateAndCheckoutBranch = async (branch: string) => {
    setIsMutating(true);
    setMutationError(null);
    setCreateBranchError(null);
    try {
      const createResult = await createGitBranch({
        gitRoot,
        branch,
        failIfExists: true,
      });
      if (createResult.status === "error") {
        setCreateBranchError(createResult.error);
        return;
      }

      const checkoutResult = await checkoutGitBranch({
        gitRoot,
        branch,
      });
      if (checkoutResult.status === "error") {
        if (checkoutResult.errorType === "blocked-by-working-tree-changes") {
          openConflictDialog(checkoutResult, { type: "create-and-checkout", branch });
          return;
        }
        setMutationError(checkoutResult.error);
        setIsCreateDialogOpen(false);
        return;
      }

      setIsCreateDialogOpen(false);
      setIsOpen(false);
      closeConflictFlow();
      reloadBranches();
    } catch (error) {
      setCreateBranchError(
        getErrorMessage(error) ||
          t("composer.footer.branchSwitch.createBranchError", { message: "Unknown error" }),
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateAndCheckoutBranch = async (branch: string) => {
    if (isBusy) {
      return;
    }
    await performCreateAndCheckoutBranch(branch);
  };

  const handleCommitAndContinue = async () => {
    if (pendingAction === null || isCommitActionDisabled) {
      return;
    }

    setCommitError(null);
    let resolvedCommitMessage = commitMessage.trim();

    if (resolvedCommitMessage.length === 0) {
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
        resolvedCommitMessage = response.message?.trim() ?? "";
        if (resolvedCommitMessage.length === 0) {
          setCommitError(t("review.commit.generate.emptyResponse"));
          return;
        }
        setCommitMessage((current) =>
          current.trim().length === 0 ? resolvedCommitMessage : current,
        );
      } catch (error) {
        setCommitError(
          t("review.commit.generate.failed", {
            error: getErrorMessage(error) || "Unknown error",
          }),
        );
        return;
      } finally {
        setIsGeneratingCommitMessage(false);
      }
    }

    setIsCommitting(true);
    try {
      const result = await commitGitChanges({
        gitRoot,
        message: resolvedCommitMessage,
        includeUnstaged,
      });
      if (result.status === "error") {
        setCommitError(result.error);
        return;
      }

      const nextAction = pendingAction;
      closeConflictFlow();
      reloadBranches();
      if (nextAction.type === "checkout") {
        await performCheckoutBranch(nextAction.branch);
      } else {
        await performCreateAndCheckoutBranch(nextAction.branch);
      }
    } catch (error) {
      setCommitError(getErrorMessage(error));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <button
        type="button"
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
        onClick={() => setIsOpen((open) => !open)}
        title={t("composer.footer.branchSwitch.tooltip")}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <BranchIcon className="h-4 w-4 shrink-0 text-token-text-secondary" />
          <span className="truncate">{currentBranchLabel}</span>
        </span>
        {isBusy ? (
          <RefreshIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-token-text-secondary" />
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
        )}
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[288px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-token-text-secondary" />
              <input
                aria-label={t("codex.composer.searchBranches")}
                className="app-control app-text-input w-full rounded-[10px] py-2 pr-3 pl-9 text-[13px] outline-none"
                placeholder={t("codex.composer.searchBranches")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }
                  event.preventDefault();
                  if (!isSearching) {
                    setIsOpen(false);
                    return;
                  }
                  if (isBusy || isSearchLoading || visibleBranches.length === 0) {
                    return;
                  }
                  void handleCheckoutBranch(
                    visibleBranches.find((branch) => branch !== currentBranch) ??
                      visibleBranches[0],
                  );
                }}
              />
            </div>

            {mutationError ? (
              <div className="rounded-[10px] border border-[var(--app-shell-danger-border)] bg-[var(--app-shell-danger-bg)] px-3 py-2 text-[12px] text-[var(--app-shell-danger-text)]">
                {mutationError}
              </div>
            ) : null}

            <div className="vertical-scroll-fade-mask max-h-[200px] overflow-y-auto">
              <BranchSectionHeading label={t("composer.remote.branchesSectionHeading")} />
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
                visibleBranches.map((branch) => (
                  <BranchItem
                    key={branch}
                    isSelected={branch === currentBranch}
                    label={branch}
                    detail={
                      branch === currentBranch && branchChangeCount > 0
                        ? t("composer.footer.branchSwitch.uncommittedSummaryPrefix", {
                            fileCount: branchChangeCount,
                          })
                        : null
                    }
                    onSelect={() => void handleCheckoutBranch(branch)}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              disabled={createDisabledReason !== null || isBusy}
              title={createDisabledReason ?? undefined}
              className={[
                "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]",
                createDisabledReason !== null || isBusy
                  ? "cursor-not-allowed opacity-60"
                  : "app-nav-item-idle",
              ].join(" ")}
              onClick={() => {
                if (createDisabledReason !== null || isBusy) {
                  return;
                }
                setIsOpen(false);
                setIsCreateDialogOpen(true);
              }}
            >
              <PlusIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
              <span>{t("composer.footer.branchSwitch.createAndCheckout")}</span>
            </button>
          </div>
        </div>
      ) : null}

      {isCreateDialogOpen ? (
        <DialogOverlay>
          <DialogCard
            actions={
              <>
                <Button
                  color="secondary"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setCreateBranchError(null);
                  }}
                >
                  {t("composer.footer.branchSwitch.createDialog.close")}
                </Button>
                <Button
                  color="primary"
                  disabled={!canCreateBranch}
                  loading={isMutating}
                  onClick={() => void handleCreateAndCheckoutBranch(createBranchName.trim())}
                >
                  {t("composer.footer.branchSwitch.createDialog.createAndCheckout")}
                </Button>
              </>
            }
            title={t("composer.footer.branchSwitch.createDialog.title")}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-medium text-[var(--app-shell-text)]">
                {t("localConversation.syncSetup.branchName")}
              </div>
              <button
                type="button"
                className="text-[12px] text-[var(--app-shell-subtle)] hover:text-[var(--app-shell-text)]"
                onClick={() => {
                  void showSettings("git-settings");
                  setIsCreateDialogOpen(false);
                }}
              >
                {t("localConversation.syncSetup.setPrefix")}
              </button>
            </div>
            <input
              autoFocus
              aria-label={t("composer.footer.branchSwitch.createDialog.ariaLabel")}
              className="app-control app-text-input mt-2 w-full rounded-[10px] px-3 py-2 text-[13px] outline-none"
              placeholder={t("composer.footer.branchSwitch.createDialog.placeholder")}
              value={createBranchName}
              onChange={(event) => {
                setCreateBranchError(null);
                setCreateBranchName(sanitizeBranchInput(event.target.value));
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                if (canCreateBranch) {
                  void handleCreateAndCheckoutBranch(createBranchName.trim());
                }
              }}
            />
            {createBranchName.trim().endsWith("/") ? (
              <div className="mt-2 text-[12px] text-[var(--app-shell-danger-text)]">
                {t("composer.footer.branchSwitch.createDialog.trailingSlashError")}
              </div>
            ) : null}
            {!createBranchName.trim().endsWith("/") && createBranchExists ? (
              <div className="mt-2 text-[12px] text-[var(--app-shell-danger-text)]">
                {t("composer.footer.branchSwitch.createDialog.branchExistsError")}
              </div>
            ) : null}
            {!createBranchName.trim().endsWith("/") &&
            !createBranchExists &&
            createBranchError ? (
              <div className="mt-2 text-[12px] text-[var(--app-shell-danger-text)]">
                {createBranchError}
              </div>
            ) : null}
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
                  <ToggleSwitch
                    ariaLabel={t("review.commit.ariaLabel.includeUnstaged")}
                    checked={includeUnstaged}
                    disabled={isBusy}
                    onChange={setIncludeUnstaged}
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
                target={commitTargetBranch ?? t("review.commit.form.commitTo.none")}
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
                <div className="text-[12px] text-[var(--app-shell-danger-text)]">
                  {commitError}
                </div>
              ) : null}
            </div>
          </DialogCard>
        </DialogOverlay>
      ) : null}
    </div>
  );
}

function BranchSectionHeading({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
      {label}
    </div>
  );
}

function BranchItem({
  detail,
  isSelected,
  label,
  onSelect,
}: {
  detail?: string | null;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
        isSelected ? "app-nav-item-active" : "app-nav-item-idle",
      ].join(" ")}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{label}</span>
        {detail ? (
          <span className="app-text-muted mt-1 block text-[12px] leading-5">{detail}</span>
        ) : null}
      </span>
      {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
    </button>
  );
}

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5.4165" cy="5" r="1.875" stroke="currentColor" strokeWidth="1.33" />
      <circle cx="5.4165" cy="15" r="1.875" stroke="currentColor" strokeWidth="1.33" />
      <circle cx="14.5833" cy="5" r="1.875" stroke="currentColor" strokeWidth="1.33" />
      <path d="M5.4165 6.66664V13.3333" stroke="currentColor" strokeWidth="1.33" strokeLinejoin="round" />
      <path
        d="M5.41658 12.5V11.6667C5.41658 10.7462 6.16278 10 7.08325 10H12.9166C13.8371 10 14.5833 9.25381 14.5833 8.33333V7.5"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinejoin="round"
      />
    </svg>
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
      <span className="flex min-w-0 items-center gap-2 text-[var(--app-shell-text)]">
        <BranchIcon className="h-4 w-4 shrink-0 text-token-text-secondary" />
        <span className="truncate">{target}</span>
      </span>
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
