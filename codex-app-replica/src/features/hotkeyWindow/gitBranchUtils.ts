import type { GitChangeSummary } from "../../services/gitBranches";

const INVALID_BRANCH_INPUT_CHARACTERS = new Set(["~", "^", ":", "?", "*", "[", "]", "\\"]);
const COMMIT_PROMPT_TESTING_NOTE =
  "Testing note: If you mention tests, include unit tests or UI testing frameworks only. Skip lint/tsc since CI runs those.";

export function areSameBranch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function dedupeBranches(branches: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const branch of branches) {
    const normalizedBranch = normalizeBranchName(branch);
    if (normalizedBranch === null) {
      continue;
    }
    const comparableBranch = normalizedBranch.toLowerCase();
    if (seen.has(comparableBranch)) {
      continue;
    }
    seen.add(comparableBranch);
    deduped.push(normalizedBranch);
  }

  return deduped;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "";
}

export function normalizeBranchName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeBranchInput(value: string) {
  return Array.from(value)
    .filter((character) => !/\s/u.test(character) && !INVALID_BRANCH_INPUT_CHARACTERS.has(character))
    .join("");
}

export function mergeGitChangeSummaries(...summaries: Array<GitChangeSummary | null | undefined>): GitChangeSummary {
  const filePaths = new Map<string, string>();
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const summary of summaries) {
    if (summary == null) {
      continue;
    }
    totalAdditions += summary.totalAdditions;
    totalDeletions += summary.totalDeletions;
    for (const path of summary.filePaths) {
      const normalizedPath = path.trim().toLowerCase();
      if (normalizedPath.length === 0 || filePaths.has(normalizedPath)) {
        continue;
      }
      filePaths.set(normalizedPath, path);
    }
  }

  return {
    files: filePaths.size,
    filePaths: Array.from(filePaths.values()),
    totalAdditions,
    totalDeletions,
  };
}

export function buildCommitMessagePrompt(params: {
  commitInstructions: string | null;
  draftMessage: string;
  uncommittedDiff: string | null;
}) {
  const sections: string[] = [];
  const draftMessage = params.draftMessage.trim();
  if (draftMessage.length > 0) {
    sections.push(`Draft message:\n${draftMessage}`);
  }

  const diffSection = buildCommitDiffContext(params.uncommittedDiff);
  if (diffSection !== null) {
    sections.push(diffSection);
  }
  if (sections.length > 0) {
    sections.push(COMMIT_PROMPT_TESTING_NOTE);
  }

  const commitInstructions = params.commitInstructions?.trim() ?? "";
  if (commitInstructions.length > 0) {
    sections.push(
      "Custom commit instructions (apply these to the commit message text only; do not change the required output format):\n" +
        commitInstructions,
    );
  }

  return sections.length === 0 ? "Use the current thread context to infer the commit message." : sections.join("\n\n");
}

function buildCommitDiffContext(uncommittedDiff: string | null) {
  const trimmedDiff = uncommittedDiff?.trim() ?? "";
  if (trimmedDiff.length === 0) {
    return null;
  }
  return `Changes:\n${trimmedDiff}`;
}
