import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "../../components/AppShellIcons";
import { type AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey, MessageValues } from "../../i18n/messages";
import {
  buildPullRequestUnifiedDiffSummary,
  parsePullRequestUnifiedDiff,
} from "../../lib/unifiedDiff";
import { readGitBranches } from "../../services/gitBranches";
import { readGitOrigins } from "../../services/gitOrigins";
import { applyPatch, type ApplyPatchResponse } from "../../services/patchApply";
import { parseRepoKeyFromOriginUrl } from "../../services/pullRequests";
import type {
  RemoteTaskEnvironment,
  RemoteTaskEnvironmentRepoMapEntry,
} from "../../services/remoteTasks";

type ResolvedGitState = {
  branchName: string | null;
  gitRoot: string | null;
  localRepoKey: string | null;
};

type RemoteDiffApplyOwnerProps = {
  diff: string | null;
  onShowToast?: (toast: AppToast) => void;
  taskEnvironment: RemoteTaskEnvironment | null;
  turnId: string | null;
  workspaceRoot: string | null;
};

type RemoteDiffApplyControlProps = RemoteDiffApplyOwnerProps & {
  variant: "header" | "footer";
};

type RemoteDiffApplyState = {
  apply: () => Promise<void>;
  branchName: string | null;
  canApply: boolean;
  gitRootPath: string | null;
  hasAppliedCodeLocally: boolean;
  isApplying: boolean;
  isNonWorkspaceEnvironment: boolean;
  results: ApplyResultsState;
  revert: () => Promise<void>;
  setResultsOpen: (open: boolean) => void;
  summary: ReturnType<typeof buildPullRequestUnifiedDiffSummary> | null;
  taskEnvironmentLabel: string | null;
};

type ApplyResultsState = {
  open: boolean;
  result: ApplyPatchResponse | null;
};

const APPLIED_TURNS_SESSION_STORAGE_KEY = "codex-app-replica.remote-apply.applied-turns.v1";

export function RemoteDiffApplyControl(props: RemoteDiffApplyControlProps) {
  if (props.variant === "header") {
    return <RemoteDiffApplyHeaderControl {...props} />;
  }
  return <RemoteDiffApplyFooterControl {...props} />;
}

function RemoteDiffApplyHeaderControl(props: RemoteDiffApplyOwnerProps) {
  const { t } = useI18n();
  const state = useRemoteDiffApplyState(props);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  if (!props.turnId || !state.gitRootPath) {
    return null;
  }

  const triggerLabel = state.hasAppliedCodeLocally
    ? t("codex.remoteConversation.applyDiff.revert")
    : t("codex.remoteConversation.applyDiff.apply");
  const showHeaderSummary = state.results.result === null && !state.hasAppliedCodeLocally;

  return (
    <>
      <div className="relative shrink-0" ref={containerRef}>
        <button
          type="button"
          disabled={state.isApplying || !state.canApply}
          title={t("codex.remoteConversation.applyDiff.dropdownTitle")}
          aria-label={t("codex.remoteConversation.applyDiff.dropdownTitle")}
          onClick={() => setIsOpen((current) => !current)}
          className="app-control flex h-8 items-center gap-2 rounded-[11px] px-3 text-[12px] disabled:opacity-60"
        >
          <ApplyDiffIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{triggerLabel}</span>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
        </button>
        {isOpen ? (
          <div className="app-card absolute right-0 top-[calc(100%+8px)] z-20 w-[420px] rounded-[16px] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            {showHeaderSummary ? (
              <div className="flex flex-col gap-3 px-1 pt-2 pb-1">
                <ApplyDiffIcon className="h-5 w-5 text-[var(--app-shell-text)]" />
                <div className="text-[15px] font-medium text-[var(--app-shell-text)]">
                  {t("codex.applyDropdown.header.title")}
                </div>
                {state.summary ? (
                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="text-[var(--app-shell-subtle)]">
                      {t("codex.applyDropdown.header.changes")}
                    </span>
                    <span className="font-medium text-[var(--app-shell-text)]">
                      {t("codex.applyDropdown.header.fileCount", { count: state.summary.fileCount })}
                    </span>
                    <span className="flex items-center gap-1">
                      <DiffSummaryPill summary={state.summary} t={t} />
                      <span className="text-[var(--app-shell-subtle)]">
                        {t("codex.applyDropdown.header.rows")}
                      </span>
                    </span>
                  </div>
                ) : null}
                <div className="h-px bg-[var(--app-shell-border)]" />
                <div className="text-[13px] text-[var(--app-shell-subtle)]">
                  {t("codex.applyDropdown.header.workspace")}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-px">
              <HeaderTargetRow branchName={state.branchName} gitRootPath={state.gitRootPath} />
              {state.results.result ? <HeaderResultsSummary result={state.results.result} t={t} /> : null}
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {state.hasAppliedCodeLocally ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!state.canApply || state.isApplying}
                    onClick={() => {
                      setIsOpen(false);
                      void state.revert();
                    }}
                    className="app-control flex-1 rounded-[12px] px-3 py-2 text-[13px] disabled:opacity-60"
                  >
                    {t("codex.remoteConversation.applyDiff.revertCta")}
                  </button>
                  <button
                    type="button"
                    disabled={!state.canApply || state.isApplying}
                    onClick={() => {
                      setIsOpen(false);
                      void state.apply();
                    }}
                    className="app-control flex-1 rounded-[12px] px-3 py-2 text-[13px] disabled:opacity-60"
                  >
                    {t("codex.applyOrRevertBanner.reapply")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!state.canApply || state.isApplying}
                  onClick={() => {
                    setIsOpen(false);
                    void state.apply();
                  }}
                  className="app-control rounded-[12px] px-3 py-2 text-[13px] disabled:opacity-60"
                >
                  {t("codex.remoteConversation.applyDiff.applyCta")}
                </button>
              )}
            </div>
            {state.isNonWorkspaceEnvironment && state.taskEnvironmentLabel ? (
              <div className="mt-2 text-center text-[13px] text-[var(--app-shell-warning-text,#a16207)]">
                {t("codex.applyOrRevertBanner.applyMessageDifferentEnvironment", {
                  environment: state.taskEnvironmentLabel,
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ApplyResultsDialog
        open={state.results.open}
        result={state.results.result}
        onOpenChange={state.setResultsOpen}
        t={t}
      />
    </>
  );
}

function RemoteDiffApplyFooterControl(props: RemoteDiffApplyOwnerProps) {
  const { t } = useI18n();
  const state = useRemoteDiffApplyState(props);

  if (!props.turnId || !props.diff) {
    return null;
  }

  return (
    <>
      <div className="app-card rounded-[18px] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            {state.isNonWorkspaceEnvironment ? (
              <InfoBadgeIcon className="h-4 w-4 text-[var(--app-shell-warning-text,#a16207)]" />
            ) : (
              <ApplyDiffIcon className="h-4 w-4 text-[var(--app-shell-text)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] leading-6 text-[var(--app-shell-text)]">
              {state.hasAppliedCodeLocally
                ? t("codex.applyOrRevertBanner.revertMessage")
                : t("codex.applyOrRevertBanner.applyMessage")}
            </div>
            {state.isNonWorkspaceEnvironment && state.taskEnvironmentLabel ? (
              <div
                className="truncate text-[13px] leading-6 text-[var(--app-shell-warning-text,#a16207)]"
                title={t("codex.applyOrRevertBanner.applyMessageDifferentEnvironment.tooltip", {
                  environment: state.taskEnvironmentLabel,
                })}
              >
                {t("codex.applyOrRevertBanner.applyMessageDifferentEnvironment", {
                  environment: state.taskEnvironmentLabel,
                })}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {state.hasAppliedCodeLocally ? (
              <>
                <button
                  type="button"
                  disabled={!state.canApply || state.isApplying}
                  onClick={() => void state.revert()}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {t("codex.applyOrRevertBanner.revert")}
                </button>
                <button
                  type="button"
                  disabled={!state.canApply || state.isApplying}
                  onClick={() => void state.apply()}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {t("codex.applyOrRevertBanner.reapply")}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!state.canApply || state.isApplying}
                onClick={() => void state.apply()}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("codex.applyOrRevertBanner.apply")}
              </button>
            )}
          </div>
        </div>
      </div>
      <ApplyResultsDialog
        open={state.results.open}
        result={state.results.result}
        onOpenChange={state.setResultsOpen}
        t={t}
      />
    </>
  );
}

function useRemoteDiffApplyState({
  diff,
  onShowToast,
  taskEnvironment,
  turnId,
  workspaceRoot,
}: RemoteDiffApplyOwnerProps): RemoteDiffApplyState {
  const { t } = useI18n();
  const [isApplying, setIsApplying] = useState(false);
  const [results, setResults] = useState<ApplyResultsState>({
    open: false,
    result: null,
  });
  const [resolvedGitState, setResolvedGitState] = useState<ResolvedGitState>({
    branchName: null,
    gitRoot: null,
    localRepoKey: null,
  });
  const [appliedTurnIds, setAppliedTurnIds] = useState<Record<string, boolean>>(
    () => readAppliedTurnIdsFromSessionStorage(),
  );
  const normalizedDiff = diff?.trim() ?? "";
  const summary = useMemo(() => {
    if (normalizedDiff.length === 0) {
      return null;
    }
    return buildPullRequestUnifiedDiffSummary(parsePullRequestUnifiedDiff(normalizedDiff));
  }, [normalizedDiff]);
  const taskRepoKeys = useMemo(() => resolveTaskRepoKeys(taskEnvironment), [taskEnvironment]);
  const taskEnvironmentLabel = taskEnvironment?.label?.trim() || null;

  useEffect(() => {
    let cancelled = false;

    const loadGitState = async () => {
      if (!workspaceRoot || workspaceRoot.trim().length === 0) {
        if (!cancelled) {
          setResolvedGitState({
            branchName: null,
            gitRoot: null,
            localRepoKey: null,
          });
        }
        return;
      }

      try {
        const origins = await readGitOrigins({ dirs: [workspaceRoot] });
        const origin = pickMatchingGitOrigin(origins.origins, taskRepoKeys);
        const gitRoot = origin?.root?.trim() ?? null;
        const localRepoKey = parseOriginRepoKey(origin?.originUrl ?? null);
        let branchName: string | null = null;

        if (gitRoot) {
          try {
            const branches = await readGitBranches({ gitRoot });
            branchName = branches.currentBranch ?? branches.defaultBranch ?? null;
          } catch {
            branchName = null;
          }
        }

        if (!cancelled) {
          setResolvedGitState({
            branchName,
            gitRoot,
            localRepoKey,
          });
        }
      } catch {
        if (!cancelled) {
          setResolvedGitState({
            branchName: null,
            gitRoot: null,
            localRepoKey: null,
          });
        }
      }
    };

    void loadGitState();
    return () => {
      cancelled = true;
    };
  }, [taskRepoKeys, workspaceRoot]);

  const hasAppliedCodeLocally = Boolean(turnId && appliedTurnIds[turnId]);
  const isNonWorkspaceEnvironment = Boolean(
    taskEnvironmentLabel &&
      (taskRepoKeys.length === 0 ||
        resolvedGitState.localRepoKey == null ||
        !taskRepoKeys.includes(resolvedGitState.localRepoKey)),
  );
  const canApply = Boolean(
    turnId &&
      normalizedDiff.length > 0 &&
      resolvedGitState.gitRoot &&
      !isApplying,
  );

  const runMutation = async (revert: boolean) => {
    if (!turnId || !resolvedGitState.gitRoot || normalizedDiff.length === 0) {
      return;
    }

    setIsApplying(true);
    try {
      const response = await applyPatch({
        diff: normalizedDiff,
        cwd: resolvedGitState.gitRoot,
        hostConfig: null,
        revert,
      });

      if (response.status === "success") {
        setResults({ open: false, result: null });
        setAppliedTurnIds((current) => {
          const next = { ...current };
          if (revert) {
            delete next[turnId];
          } else {
            next[turnId] = true;
          }
          writeAppliedTurnIdsToSessionStorage(next);
          return next;
        });
      } else {
        setResults({ open: true, result: response });
      }

      showApplyToast(t, response, revert, onShowToast);
    } finally {
      setIsApplying(false);
      void refreshBranchState(resolvedGitState.gitRoot, setResolvedGitState);
    }
  };

  return {
    apply: async () => runMutation(false),
    branchName: resolvedGitState.branchName,
    canApply,
    gitRootPath: resolvedGitState.gitRoot,
    hasAppliedCodeLocally,
    isApplying,
    isNonWorkspaceEnvironment,
    results,
    revert: async () => runMutation(true),
    setResultsOpen: (open) =>
      setResults((current) => ({
        ...current,
        open,
      })),
    summary,
    taskEnvironmentLabel,
  };
}

function HeaderTargetRow({
  branchName,
  gitRootPath,
}: {
  branchName: string | null;
  gitRootPath: string;
}) {
  const label = branchName ?? basename(gitRootPath);
  const subtitle = basename(gitRootPath);
  return (
    <div className="app-control flex items-start gap-3 rounded-[12px] px-3 py-2 text-left">
      <BranchIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-shell-text)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[var(--app-shell-text)]">
              {label}
            </div>
            {subtitle ? (
              <div className="truncate text-[12px] text-[var(--app-shell-subtle)]">
                {subtitle}
              </div>
            ) : null}
          </div>
          <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-shell-text)]" />
        </div>
      </div>
    </div>
  );
}

function HeaderResultsSummary({
  result,
  t,
}: {
  result: ApplyPatchResponse;
  t: (key: MessageKey, values?: MessageValues) => string;
}) {
  const appliedPaths = result.appliedPaths ?? [];
  const skippedPaths = result.skippedPaths ?? [];
  const conflictedPaths = result.conflictedPaths ?? [];

  if (appliedPaths.length + skippedPaths.length + conflictedPaths.length === 0) {
    return (
      <div className="p-2 text-[13px] text-[var(--app-shell-subtle)]">
        {t("codex.applyDropdown.results.empty")}
      </div>
    );
  }

  return (
    <div className="max-h-64 space-y-3 overflow-y-auto rounded-[12px] p-2">
      {appliedPaths.length > 0 ? (
        <ResultPathsList
          icon={<CheckIcon className="h-3.5 w-3.5 shrink-0" />}
          paths={appliedPaths}
          toneClassName="text-[var(--app-shell-text)]"
        />
      ) : null}
      {skippedPaths.length > 0 ? (
        <ResultPathsList
          icon={<XIcon className="h-3.5 w-3.5 shrink-0" />}
          label={t("codex.applyDropdown.results.skipped", { count: skippedPaths.length })}
          paths={skippedPaths}
          toneClassName="text-[var(--app-shell-subtle)]"
        />
      ) : null}
      {conflictedPaths.length > 0 ? (
        <ResultPathsList
          icon={<XIcon className="h-3.5 w-3.5 shrink-0" />}
          label={t("codex.applyDropdown.results.conflicted", { count: conflictedPaths.length })}
          paths={conflictedPaths}
          toneClassName="text-[var(--app-shell-warning-text,#a16207)]"
        />
      ) : null}
    </div>
  );
}

function ResultPathsList({
  icon,
  label,
  paths,
  toneClassName,
}: {
  icon: ReactNode;
  label?: string;
  paths: string[];
  toneClassName: string;
}) {
  if (paths.length === 0) {
    return null;
  }

  return (
    <div className={["flex flex-col gap-1.5 text-[13px]", toneClassName].join(" ")}>
      {label ? <div className="whitespace-nowrap">{label}</div> : null}
      {paths.map((path) => (
        <div key={path} className="flex items-center gap-2 truncate" title={path}>
          {icon}
          <span className="truncate">{shortenPath(path)}</span>
        </div>
      ))}
    </div>
  );
}

function ApplyResultsDialog({
  open,
  onOpenChange,
  result,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ApplyPatchResponse | null;
  t: (key: MessageKey, values?: MessageValues) => string;
}) {
  if (!open || result === null) {
    return null;
  }

  const appliedPaths = result.appliedPaths ?? [];
  const conflictedPaths = result.conflictedPaths ?? [];
  const skippedPaths = result.skippedPaths ?? [];
  const hasDetails =
    appliedPaths.length > 0 || conflictedPaths.length > 0 || skippedPaths.length > 0;
  const isNotGitRepo = result.errorCode === "not-git-repo";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[520px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="text-[15px] font-medium text-[var(--app-shell-text)]">
          {t("codex.applyResultsDialog.title")}
        </div>
        <div className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto pr-1 text-[13px] leading-6 text-[var(--app-shell-text)]">
          {hasDetails ? (
            <>
              {appliedPaths.length > 0 ? (
                <DetailedPathsSection
                  label={t("codex.applyResultsDialog.applied", { count: appliedPaths.length })}
                  paths={appliedPaths}
                />
              ) : null}
              {conflictedPaths.length > 0 ? (
                <DetailedPathsSection
                  label={t("codex.applyResultsDialog.conflicted", {
                    count: conflictedPaths.length,
                  })}
                  labelClassName="text-[var(--app-shell-danger,#b42318)]"
                  paths={conflictedPaths}
                />
              ) : null}
              {skippedPaths.length > 0 ? (
                <DetailedPathsSection
                  label={t("codex.applyResultsDialog.skipped", { count: skippedPaths.length })}
                  labelClassName="text-[var(--app-shell-subtle)]"
                  paths={skippedPaths}
                />
              ) : null}
            </>
          ) : (
            <p className="text-[var(--app-shell-subtle)]">
              {isNotGitRepo
                ? t("codex.applyResultsDialog.notGitRepo")
                : t("codex.applyResultsDialog.noDetails")}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("codex.applyResultsDialog.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailedPathsSection({
  label,
  labelClassName,
  paths,
}: {
  label: string;
  labelClassName?: string;
  paths: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className={["font-medium", labelClassName ?? ""].join(" ").trim()}>{label}</div>
      <ul>
        {paths.map((path) => (
          <li key={path} className="truncate" title={path}>
            {path}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffSummaryPill({
  summary,
  t,
}: {
  summary: ReturnType<typeof buildPullRequestUnifiedDiffSummary>;
  t: (key: MessageKey, values?: MessageValues) => string;
}) {
  return (
    <>
      <span className="text-emerald-700 dark:text-emerald-300">
        {t("codex.diffView.linesAdded", { linesAdded: summary.linesAdded })}
      </span>
      <span className="text-red-700 dark:text-red-300">
        {t("codex.diffView.linesDeleted", { linesDeleted: summary.linesDeleted })}
      </span>
    </>
  );
}

function resolveTaskRepoKeys(taskEnvironment: RemoteTaskEnvironment | null) {
  const keys: string[] = [];
  for (const repoMapEntry of taskEnvironment?.repo_map ?? []) {
    const parsedRepo = parseRemoteRepoMapEntry(repoMapEntry);
    if (parsedRepo?.repoKey && !keys.includes(parsedRepo.repoKey)) {
      keys.push(parsedRepo.repoKey);
    }
  }
  return keys;
}

function parseRemoteRepoMapEntry(value: RemoteTaskEnvironmentRepoMapEntry | null | undefined) {
  const cloneUrl = value?.clone_url?.trim() ?? "";
  if (cloneUrl.length === 0) {
    return null;
  }
  return parseRepoKeyFromOriginUrl(cloneUrl);
}

function parseOriginRepoKey(originUrl: string | null) {
  const normalized = originUrl?.trim() ?? "";
  if (normalized.length === 0) {
    return null;
  }
  return parseRepoKeyFromOriginUrl(normalized)?.repoKey ?? null;
}

function pickMatchingGitOrigin(
  origins: Array<{ root: string | null; originUrl: string | null }>,
  taskRepoKeys: string[],
) {
  if (taskRepoKeys.length > 0) {
    const matchedOrigin = origins.find((origin) => {
      const originRepoKey = parseOriginRepoKey(origin.originUrl);
      return originRepoKey !== null && taskRepoKeys.includes(originRepoKey);
    });
    if (matchedOrigin) {
      return matchedOrigin;
    }
  }
  return origins.find((origin) => origin.root != null) ?? origins[0] ?? null;
}

async function refreshBranchState(
  gitRoot: string | null,
  setResolvedGitState: (value: ResolvedGitState | ((current: ResolvedGitState) => ResolvedGitState)) => void,
) {
  if (!gitRoot) {
    return;
  }

  try {
    const branches = await readGitBranches({ gitRoot });
    setResolvedGitState((current) => ({
      ...current,
      branchName: branches.currentBranch ?? branches.defaultBranch ?? null,
      gitRoot,
    }));
  } catch {
    setResolvedGitState((current) => ({
      ...current,
      gitRoot,
    }));
  }
}

function showApplyToast(
  t: (key: MessageKey, values?: MessageValues) => string,
  result: ApplyPatchResponse,
  revert: boolean,
  onShowToast?: (toast: AppToast) => void,
) {
  if (!onShowToast) {
    return;
  }

  const key =
    result.status === "error"
      ? getApplyErrorToastKey(result.errorCode ?? null, revert)
      : getApplyToastKey(result.status, revert);
  onShowToast({
    tone: result.status === "error" ? "error" : result.status === "partial-success" ? "info" : "success",
    message: t(key),
  });
}

function getApplyToastKey(status: ApplyPatchResponse["status"], revert: boolean) {
  if (status === "success") {
    return revert ? "codex.diffView.revertPatchSuccess" : "codex.diffView.applyPatchSuccess";
  }
  if (status === "partial-success") {
    return revert ? "codex.diffView.revertPatchPartialSuccess" : "codex.diffView.applyPatchPartialSuccess";
  }
  return revert ? "codex.diffView.revertPatchError" : "codex.diffView.applyPatchError";
}

function getApplyErrorToastKey(errorCode: ApplyPatchResponse["errorCode"], revert: boolean) {
  if (errorCode === "not-git-repo") {
    return revert ? "codex.diffView.revertPatchNotGitRepo" : "codex.diffView.applyPatchNotGitRepo";
  }
  return getApplyToastKey("error", revert);
}

function readAppliedTurnIdsFromSessionStorage() {
  if (typeof window === "undefined") {
    return {} as Record<string, boolean>;
  }

  const raw = window.sessionStorage.getItem(APPLIED_TURNS_SESSION_STORAGE_KEY);
  if (!raw) {
    return {} as Record<string, boolean>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed === "object" && parsed !== null ? parsed : ({} as Record<string, boolean>);
  } catch {
    return {} as Record<string, boolean>;
  }
}

function writeAppliedTurnIdsToSessionStorage(value: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(APPLIED_TURNS_SESSION_STORAGE_KEY, JSON.stringify(value));
}

function basename(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts.at(-1) ?? normalized;
}

function shortenPath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const name = basename(normalized);
  const parent = basename(normalized.slice(0, Math.max(0, normalized.lastIndexOf("/"))));
  return parent && parent !== "." ? `${parent}/${name}` : name;
}

function ApplyDiffIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14.6602 11.3291C14.8874 11.1024 15.2382 11.0739 15.4961 11.2441L15.6006 11.3291L18.0508 13.7793C18.1754 13.904 18.2451 14.0737 18.2451 14.25C18.2451 14.4261 18.1751 14.5951 18.0508 14.7197L15.6006 17.1699L15.4961 17.2549C15.238 17.4255 14.8875 17.3971 14.6602 17.1699C14.4006 16.9102 14.4005 16.4892 14.6602 16.2295L15.9736 14.915H12.3301C11.9629 14.915 11.6651 14.6172 11.665 14.25C11.6651 13.8828 11.9629 13.585 12.3301 13.585H15.9746L14.6602 12.2705L14.5742 12.166C14.4039 11.9079 14.433 11.5563 14.6602 11.3291Z"
        fill="currentColor"
      />
      <path
        d="M7.6211 2.84082L7.875 2.86719C8.46133 2.95309 9.01189 3.20874 9.45703 3.60547L9.70215 3.84473C9.81425 3.95779 9.85105 3.99455 9.88672 4.02637L9.99805 4.11719C10.2646 4.3174 10.5851 4.43638 10.9199 4.45703L11.1797 4.45996H13.6914C14.2499 4.45996 14.703 4.45958 15.0713 4.48535C15.4458 4.51157 15.7828 4.56683 16.1025 4.70313L16.3662 4.83106C16.9638 5.15706 17.4378 5.67623 17.707 6.30762L17.7939 6.54981C17.868 6.79538 17.904 7.05317 17.9238 7.33203C17.9498 7.69789 17.9502 8.14747 17.9502 8.7002C17.9501 8.87631 17.8803 9.0453 17.7559 9.16992C17.6311 9.29464 17.4615 9.36524 17.2852 9.36524H3.4502V12.7002C3.4502 13.3761 3.45084 13.8434 3.48047 14.2061C3.50947 14.5608 3.56304 14.7568 3.63672 14.9014L3.70215 15.0195C3.86642 15.2873 4.10236 15.505 4.38379 15.6484L4.50391 15.7002C4.63661 15.7476 4.8133 15.783 5.0791 15.8047C5.44174 15.8343 5.90904 15.835 6.58496 15.835H9L9.13477 15.8486C9.43762 15.9108 9.66504 16.1788 9.66504 16.5C9.66504 16.8212 9.43763 17.0892 9.13477 17.1514L9 17.165H6.58496C5.93097 17.165 5.40006 17.1659 4.97071 17.1309C4.5885 17.0996 4.24191 17.0373 3.91797 16.8984L3.78028 16.834C3.27979 16.579 2.86045 16.191 2.56836 15.7148L2.45117 15.5049C2.26619 15.1417 2.19002 14.7513 2.1543 14.3145C2.11922 13.8851 2.12012 13.3542 2.12012 12.7002V7.29981C2.12012 6.64581 2.11922 6.1149 2.1543 5.68555C2.19002 5.24867 2.26619 4.85831 2.45117 4.49512L2.56836 4.28516C2.86045 3.80898 3.27979 3.42103 3.78028 3.16602L3.91797 3.10156C4.24191 2.96268 4.5885 2.90039 4.97071 2.86914C5.40006 2.83406 5.93097 2.83496 6.58496 2.83496H7.28028C7.42346 2.83496 7.52306 2.83479 7.6211 2.84082Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10.6 9.70459C11.0142 9.70461 11.35 10.0404 11.35 10.4546V13.7876C11.35 14.2018 11.0142 14.5376 10.6 14.5376C10.1858 14.5376 9.84998 14.2018 9.84998 13.7876V10.4546C9.84998 10.0404 10.1858 9.70459 10.6 9.70459Z"
        fill="currentColor"
      />
      <path
        d="M10.6 6.2876C11.1292 6.28762 11.558 6.71732 11.558 7.24658C11.5578 7.77569 11.1291 8.20457 10.6 8.20459C10.0708 8.20459 9.64215 7.7757 9.64197 7.24658C9.64197 6.71731 10.0707 6.2876 10.6 6.2876Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6 2.53955C14.9713 2.53955 18.515 6.08326 18.515 10.4546C18.515 14.8259 14.9713 18.3696 10.6 18.3696C6.22864 18.3696 2.68494 14.8259 2.68494 10.4546C2.68494 6.08326 6.22864 2.53955 10.6 2.53955ZM10.6 3.86963C6.96318 3.86963 4.01501 6.81779 4.01501 10.4546C4.01501 14.0914 6.96318 17.0396 10.6 17.0396C14.2368 17.0396 17.1849 14.0914 17.1849 10.4546C17.1849 6.81779 14.2368 3.86963 10.6 3.86963Z"
        fill="currentColor"
      />
    </svg>
  );
}
