import { invoke } from "@tauri-apps/api/core";

export type GitBranchesResponse = {
  currentBranch: string | null;
  defaultBranch: string | null;
  recentBranches: string[];
  searchBranches: string[];
  hasWorkingTreeChanges: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type GitBranchMutationErrorType =
  | "blocked-by-working-tree-changes"
  | "branch-already-exists"
  | "invalid-branch-name";

export type GitBranchMutationResponse =
  | {
      status: "success";
      error: null;
      errorType: null;
      conflictedPaths: null;
    }
  | {
      status: "error";
      error: string;
      errorType: GitBranchMutationErrorType | null;
      conflictedPaths: string[] | null;
    };

export type GitCommitChangesResponse = GitBranchMutationResponse;

export type GitChangeSummary = {
  files: number;
  filePaths: string[];
  totalAdditions: number;
  totalDeletions: number;
};

export type GitCommitDialogStateResponse = {
  currentBranch: string | null;
  stagedSummary: GitChangeSummary;
  unstagedSummary: GitChangeSummary;
  trackedChangesUnifiedDiff: string | null;
};

type GitHostParams = {
  gitRoot: string;
  hostId?: string | null;
};

export async function readGitBranches(params: GitHostParams & {
  query?: string | null;
}) {
  return invoke<GitBranchesResponse>("git-branches-read", {
    params: {
      gitRoot: params.gitRoot,
      query: normalizeOptionalString(params.query),
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function checkoutGitBranch(params: GitHostParams & { branch: string }) {
  return invoke<GitBranchMutationResponse>("git-checkout-branch", {
    params: {
      gitRoot: params.gitRoot,
      branch: params.branch.trim(),
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function readGitCommitDialogState(params: GitHostParams) {
  return invoke<GitCommitDialogStateResponse>("git-commit-dialog-read", {
    params: {
      gitRoot: params.gitRoot,
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function createGitBranch(params: GitHostParams & {
  branch: string;
  failIfExists?: boolean;
}) {
  return invoke<GitBranchMutationResponse>("git-create-branch", {
    params: {
      gitRoot: params.gitRoot,
      branch: params.branch.trim(),
      failIfExists: params.failIfExists ?? false,
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function commitGitChanges(params: GitHostParams & {
  message: string;
  includeUnstaged?: boolean;
}) {
  return invoke<GitCommitChangesResponse>("git-commit-changes", {
    params: {
      gitRoot: params.gitRoot,
      message: params.message.trim(),
      includeUnstaged: params.includeUnstaged ?? true,
      hostId: normalizeHostId(params.hostId),
    },
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
