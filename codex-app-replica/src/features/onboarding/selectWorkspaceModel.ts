import { isWithinCodexWorktrees } from "../../services/codexHome";
import type { GitOrigin } from "../../services/gitOrigins";
import type { ThreadHistoryEntry } from "../../services/history";
import { getLocalEnvironmentProjectName, normalizePathForComparison } from "../../services/localEnvironments";
import type { PendingWorktreeEntry } from "../../services/pendingWorktrees";

const WORKSPACE_ONBOARDING_EXPERIMENT_NAME = "93537254";
export const WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME = "Playground";

export type WorkspaceOnboardingExperimentArm =
  | "control"
  | "t2_direct_folder_picker"
  | "t3_auto_playground"
  | "t4_modal_copy_cta_playground"
  | "t5_onboarding_v2";

export type WorkspaceOnboardingExperimentAssignment = {
  arm: WorkspaceOnboardingExperimentArm;
  assignedAtMs?: number;
  experimentName?: string;
} | null;

export type WorkspaceRootOption = {
  root: string;
  label: string;
};

export type WorkspaceAutoLaunchAction =
  | "none"
  | "home_open_picker_or_create_default"
  | "select_workspace_skip_to_playground";

export type SelectWorkspacePageState = {
  hasAvailableRoots: boolean;
  hasPersistedOrDerivedRoots: boolean;
  isEmptyState: boolean;
};

export function normalizeWorkspaceOnboardingExperimentAssignment(
  value: unknown,
): WorkspaceOnboardingExperimentAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const arm = normalizeWorkspaceOnboardingExperimentArm(record.arm);
  return {
    arm,
    assignedAtMs: typeof record.assignedAtMs === "number" ? record.assignedAtMs : undefined,
    experimentName:
      typeof record.experimentName === "string" && record.experimentName.length > 0
        ? record.experimentName
        : undefined,
  };
}

export function normalizeWorkspaceOnboardingExperimentArm(value: unknown): WorkspaceOnboardingExperimentArm {
  switch (value) {
    case "control":
    case "t2_direct_folder_picker":
    case "t3_auto_playground":
    case "t4_modal_copy_cta_playground":
    case "t5_onboarding_v2":
      return value;
    default:
      return "control";
  }
}

export function readWorkspaceOnboardingExperimentArm(
  assignment: WorkspaceOnboardingExperimentAssignment,
): WorkspaceOnboardingExperimentArm {
  const arm = assignment?.arm ?? "control";
  return arm === "t5_onboarding_v2" ? "control" : arm;
}

export function readWorkspaceOnboardingExperimentRouteArm(
  assignment: WorkspaceOnboardingExperimentAssignment,
) {
  return assignment?.arm ?? "control";
}

export function shouldUseWelcomeV2WorkspaceOnboarding({
  assignment,
  welcomeV2FlowEnabled,
}: {
  assignment: WorkspaceOnboardingExperimentAssignment;
  welcomeV2FlowEnabled: boolean;
}) {
  return (
    welcomeV2FlowEnabled ||
    readWorkspaceOnboardingExperimentRouteArm(assignment) === "t5_onboarding_v2"
  );
}

export function isWorkspaceOnboardingExperimentAssignment(
  assignment: WorkspaceOnboardingExperimentAssignment,
) {
  return assignment?.experimentName === WORKSPACE_ONBOARDING_EXPERIMENT_NAME;
}

export function shouldUsePlaygroundCopy(arm: WorkspaceOnboardingExperimentArm) {
  return arm === "t4_modal_copy_cta_playground";
}

export function readWorkspaceOnboardingSkipProjectName(arm: WorkspaceOnboardingExperimentArm) {
  return shouldUseWorkspaceOnboardingDefaultProjectName(arm)
    ? WORKSPACE_ONBOARDING_DEFAULT_PROJECT_NAME
    : null;
}

export function mergeWorkspaceRootSelectionsForPersistence({
  onboardingOverride,
  persistedRoots,
  selectedRoots,
}: {
  onboardingOverride: string | null | undefined;
  persistedRoots: string[];
  selectedRoots: string[];
}) {
  if (normalizeWorkspaceOnboardingOverride(onboardingOverride) !== "workspace" || persistedRoots.length === 0) {
    return selectedRoots;
  }

  return dedupeWorkspaceRootSequence([...persistedRoots, ...selectedRoots]);
}

export function deriveWorkspaceAutoLaunchAction({
  arm,
  autoLaunchApplied,
  hasPersistedRoots,
  isLoadingRoots,
  isRemoteHost,
}: {
  arm: WorkspaceOnboardingExperimentArm;
  autoLaunchApplied: boolean;
  hasPersistedRoots: boolean;
  isLoadingRoots: boolean;
  isRemoteHost: boolean;
}): WorkspaceAutoLaunchAction {
  if (isRemoteHost || isLoadingRoots || hasPersistedRoots || autoLaunchApplied) {
    return "none";
  }

  if (arm === "t2_direct_folder_picker") {
    return "home_open_picker_or_create_default";
  }

  return arm === "t3_auto_playground" ? "select_workspace_skip_to_playground" : "none";
}

export function deriveSelectWorkspacePageState({
  candidateRoots,
  inferredRoots,
  isLoading,
  workspaceRootOptions,
  workspaceRoots,
}: {
  candidateRoots: string[];
  inferredRoots: string[];
  isLoading: boolean;
  workspaceRootOptions: WorkspaceRootOption[];
  workspaceRoots: string[];
}): SelectWorkspacePageState {
  const hasPersistedOrDerivedRoots = workspaceRoots.length > 0 || inferredRoots.length > 0;
  return {
    hasAvailableRoots: workspaceRootOptions.length > 0,
    hasPersistedOrDerivedRoots,
    isEmptyState: !hasPersistedOrDerivedRoots && !isLoading && candidateRoots.length === 0,
  };
}

export function filterWorkspaceRecentThreads(
  recentThreads: ThreadHistoryEntry[],
  backgroundSubagentsEnabled: boolean,
) {
  return recentThreads.filter(
    (thread) => !isThreadSpawnSubagentConversation(thread, backgroundSubagentsEnabled),
  );
}

export function deriveCandidateWorkspaceRoots({
  codexHome,
  gitOrigins,
  pendingWorktrees,
  recentThreads,
}: {
  codexHome: string | null;
  gitOrigins: GitOrigin[];
  pendingWorktrees: PendingWorktreeEntry[];
  recentThreads: ThreadHistoryEntry[];
}) {
  const taskRoots = [
    ...recentThreads.map((thread) => thread.cwd).filter(isNonEmptyString),
    ...pendingWorktrees.map(getPendingWorktreeCandidateRoot).filter(isNonEmptyString),
  ];

  return dedupePaths(
    taskRoots.map((taskRoot) => inferWorkspaceRootFromTaskPath(taskRoot, gitOrigins, codexHome)),
  );
}

export function buildWorkspaceRootOptions(roots: string[], labels: Record<string, string>) {
  return roots.map((root) => ({
    root,
    label: getLocalEnvironmentProjectName(root, labels[root]) ?? root,
  }));
}

export function countSelectedRoots(selectedRoots: Record<string, boolean>, roots: string[]) {
  return roots.reduce((count, root) => count + (selectedRoots[root] ? 1 : 0), 0);
}

export function filterExistingWorkspaceRootOptions(options: WorkspaceRootOption[], existingPaths: string[]) {
  const existing = new Set(existingPaths.map(normalizeComparablePath));
  return options.filter((option) => existing.has(normalizeComparablePath(option.root)));
}

export function getPendingWorktreeCandidateRoot(entry: PendingWorktreeEntry) {
  const cwd = entry.startConversationParamsInput?.cwd;
  return typeof cwd === "string" && cwd.trim().length > 0 ? cwd.trim() : entry.sourceWorkspaceRoot;
}

function inferWorkspaceRootFromTaskPath(taskPath: string, gitOrigins: GitOrigin[], codexHome: string | null) {
  const matchingOrigin = findBestGitOrigin(taskPath, gitOrigins);
  if (matchingOrigin?.root == null || !isWithinCodexWorktrees(matchingOrigin.root, codexHome)) {
    return taskPath;
  }

  const matchingSourceRoots = gitOrigins
    .filter((origin) => {
      return (
        origin.originUrl != null &&
        matchingOrigin.originUrl != null &&
        origin.originUrl === matchingOrigin.originUrl &&
        origin.root != null &&
        !isWithinCodexWorktrees(origin.root, codexHome)
      );
    })
    .map((origin) => origin.root as string)
    .sort((left, right) => right.length - left.length);

  return matchingSourceRoots[0] ?? matchingOrigin.root;
}

function findBestGitOrigin(taskPath: string, gitOrigins: GitOrigin[]) {
  const normalizedTaskPath = normalizeComparablePath(taskPath);
  let bestMatch: GitOrigin | null = null;

  for (const origin of gitOrigins) {
    const normalizedOriginDir = normalizeComparablePath(origin.dir);
    if (
      normalizedTaskPath !== normalizedOriginDir &&
      !normalizedTaskPath.startsWith(`${normalizedOriginDir}/`)
    ) {
      continue;
    }

    if (bestMatch == null || normalizedOriginDir.length > normalizeComparablePath(bestMatch.dir).length) {
      bestMatch = origin;
    }
  }

  return bestMatch;
}

function dedupePaths(paths: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const path of paths) {
    const normalized = normalizeComparablePath(path);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(path);
  }

  return deduped.sort((left, right) => left.localeCompare(right));
}

function dedupeWorkspaceRootSequence(roots: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const root of roots) {
    const normalizedValue = normalizeWorkspaceRootValue(root);
    if (normalizedValue === null) {
      continue;
    }

    const comparisonKey = normalizeComparablePath(normalizedValue);
    if (seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    deduped.push(normalizedValue);
  }

  return deduped;
}

function normalizeComparablePath(path: string) {
  return normalizePathForComparison(path).replace(/\/+$/, "").toLowerCase();
}

function shouldUseWorkspaceOnboardingDefaultProjectName(arm: WorkspaceOnboardingExperimentArm) {
  return (
    arm === "t2_direct_folder_picker" ||
    arm === "t3_auto_playground" ||
    arm === "t4_modal_copy_cta_playground"
  );
}

function normalizeWorkspaceOnboardingOverride(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeWorkspaceRootValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isThreadSpawnSubagentConversation(
  thread: ThreadHistoryEntry,
  backgroundSubagentsEnabled: boolean,
) {
  return !backgroundSubagentsEnabled && thread.source?.parentThreadId != null;
}
