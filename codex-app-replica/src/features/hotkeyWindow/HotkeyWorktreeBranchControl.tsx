import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, RefreshIcon, SearchIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import { readGitBranches, type GitBranchesResponse } from "../../services/gitBranches";
import type { PendingWorktreeStartingState } from "../../services/pendingWorktrees";
import {
  areSameBranch,
  dedupeBranches,
  getErrorMessage,
  normalizeBranchName,
} from "./gitBranchUtils";

const DEFAULT_BRANCH_FALLBACK = "main";
const SEARCH_DEBOUNCE_MS = 300;

export function HotkeyWorktreeBranchControl({
  gitRoot,
  onStartingStateChange,
  startingState,
}: {
  gitRoot: string;
  onStartingStateChange: (state: PendingWorktreeStartingState) => void;
  startingState: PendingWorktreeStartingState;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [branchState, setBranchState] = useState<GitBranchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

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
      setReloadNonce((current) => current + 1);
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
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(getErrorMessage(loadError));
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

  const defaultBranch =
    normalizeBranchName(branchState?.defaultBranch) ??
    normalizeBranchName(branchState?.currentBranch) ??
    DEFAULT_BRANCH_FALLBACK;
  const currentBranch = normalizeBranchName(branchState?.currentBranch) ?? defaultBranch;
  const hasWorkingTreeChanges = branchState?.hasWorkingTreeChanges === true;
  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const branches = useMemo(() => {
    if (branchState === null) {
      return [defaultBranch];
    }

    return dedupeBranches([
      defaultBranch,
      currentBranch,
      ...branchState.recentBranches,
    ]);
  }, [branchState, currentBranch, defaultBranch]);

  const searchBranches = useMemo(() => {
    if (!isSearching) {
      return branches;
    }

    const matchesDefaultBranch = defaultBranch.toLowerCase().includes(normalizedQuery);
    return dedupeBranches([
      ...(matchesDefaultBranch ? [defaultBranch] : []),
      ...(branchState?.searchBranches ?? []),
    ]);
  }, [branchState, branches, defaultBranch, isSearching, normalizedQuery]);

  const visibleBranches = isSearching ? searchBranches : branches;
  const triggerLabel =
    startingState.type === "branch"
      ? t("composer.remote.branch", {
          branch: startingState.branchName,
        })
      : t("composer.remote.currentBranch", {
          branch: currentBranch,
        });
  const triggerDetail =
    startingState.type === "working-tree" && hasWorkingTreeChanges
      ? t("composer.remote.localWorkingTree")
      : null;

  return (
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <button
        type="button"
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
        onClick={() => setIsOpen((open) => !open)}
        title={t("composer.remote.branchStartingPoint")}
      >
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{triggerLabel}</span>
          {triggerDetail ? (
            <span className="app-text-muted mt-1 block truncate text-[11px] leading-4">
              {triggerDetail}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute right-0 top-[calc(100%+8px)] z-20 w-[288px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-token-text-secondary" />
              <input
                aria-label={t("codex.composer.searchBranches")}
                className="app-control app-text-input w-full rounded-[10px] py-2 pr-3 pl-9 text-[13px] outline-none"
                placeholder={t("codex.composer.searchBranches")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="vertical-scroll-fade-mask max-h-[200px] overflow-y-auto">
              {hasWorkingTreeChanges ? (
                <div className="flex flex-col gap-1.5">
                  <BranchSectionHeading label={t("composer.remote.localFileStateHeading")} />
                  <BranchItem
                    detail={t("composer.remote.currentEditsSuffix.useLocal")}
                    isSelected={startingState.type === "working-tree"}
                    label={currentBranch}
                    onSelect={() => {
                      onStartingStateChange({ type: "working-tree" });
                      setIsOpen(false);
                    }}
                  />
                </div>
              ) : null}

              <div className="mt-2 flex flex-col gap-1.5">
                <BranchSectionHeading label={t("composer.remote.branchesSectionHeading")} />
                {error ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                    <div className="text-[13px] text-[var(--app-shell-danger-text)]">
                      {t("composer.remote.errorLoadingBranches")}
                    </div>
                    <button
                      type="button"
                      className="app-control rounded-[10px] px-3 py-1.5 text-[12px]"
                      onClick={() => setReloadNonce((current) => current + 1)}
                    >
                      <span className="flex items-center gap-1.5">
                        <RefreshIcon className="h-3.5 w-3.5" />
                        {t("codex.common.retry")}
                      </span>
                    </button>
                  </div>
                ) : isLoading && (isSearching || branchState === null) ? (
                  <div className="app-text-muted px-3 py-5 text-center text-[13px]">
                    {t("composer.remote.loadingMoreBranches")}
                  </div>
                ) : (
                  visibleBranches.map((branch) => (
                    <BranchItem
                      key={branch}
                      isSelected={
                        startingState.type === "branch" &&
                        areSameBranch(startingState.branchName, branch)
                      }
                      label={branch}
                      onSelect={() => {
                        onStartingStateChange({ type: "branch", branchName: branch });
                        setIsOpen(false);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
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
  detail?: string;
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
