import type { GitOrigin } from "../../services/gitOrigins";
import { isWithinCodexWorktrees } from "../../services/codexHome";
import type {
  PullRequestBoardColumnKey,
  PullRequestBoardItem,
  PullRequestFilterView,
} from "../../services/pullRequests";
import { pullRequestSearchQueryForView } from "../../services/pullRequests";

export const PULL_REQUEST_BOARD_LAST_SELECTED_REPO_KEY =
  "pull-request-board:last-selected-repo-key";

const PULL_REQUEST_BOARD_COLUMN_ORDER: PullRequestBoardColumnKey[] = [
  "unmet_checks",
  "draft",
  "ready",
  "merged",
];

export type PullRequestsRouteState = {
  repoKey: string | null;
  view: PullRequestFilterView;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
};

export type PullRequestRepoOption = {
  key: string;
  label: string;
  cwd: string;
  hostId: string | null;
  repo: string;
  originUrl: string | null;
};

export type PullRequestBoardSection = {
  key: PullRequestBoardColumnKey;
  title: string;
  items: PullRequestBoardItem[];
};

export function parsePullRequestsRouteState(
  search: string,
  storedRepoKey: string | null,
): PullRequestsRouteState {
  const params = new URLSearchParams(search);
  return {
    repoKey: normalizeOptionalString(params.get("repoKey")) ?? storedRepoKey,
    view: normalizePullRequestFilterView(params.get("view")),
    pullRequestNumber: parsePositiveInteger(params.get("pullRequestNumber")),
    pullRequestUrl: normalizeOptionalString(params.get("pullRequestUrl")),
  };
}

export function serializePullRequestsRouteState(state: PullRequestsRouteState) {
  const params = new URLSearchParams();
  if (state.repoKey != null) {
    params.set("repoKey", state.repoKey);
  }
  params.set("view", state.view);
  if (state.pullRequestNumber != null) {
    params.set("pullRequestNumber", String(state.pullRequestNumber));
  }
  if (state.pullRequestUrl != null) {
    params.set("pullRequestUrl", state.pullRequestUrl);
  }
  return params;
}

export function buildPullRequestRepoOptions({
  codexHome,
  gitOrigins,
  workspaceRoots,
}: {
  codexHome: string | null;
  gitOrigins: GitOrigin[];
  workspaceRoots: string[];
}) {
  const originsByRoot = new Map<string, GitOrigin>();
  for (const origin of gitOrigins) {
    if (origin.originUrl == null) {
      continue;
    }
    originsByRoot.set(normalizePath(origin.dir), origin);
  }

  const optionsByKey = new Map<string, PullRequestRepoOption & { isCodexWorktree: boolean }>();

  for (const workspaceRoot of workspaceRoots) {
    const origin = originsByRoot.get(normalizePath(workspaceRoot));
    if (origin == null || origin.originUrl == null) {
      continue;
    }

    const parsed = parseRepoKeyFromOriginUrl(origin.originUrl);
    if (parsed == null) {
      continue;
    }

    const option: PullRequestRepoOption & { isCodexWorktree: boolean } = {
      cwd: workspaceRoot,
      hostId: null,
      key: parsed.repoKey,
      label: parsed.label,
      originUrl: origin.originUrl,
      repo: parsed.repoKey,
      isCodexWorktree: isWithinCodexWorktrees(workspaceRoot, codexHome),
    };

    const current = optionsByKey.get(option.key);
    if (current == null || isBetterRepoOption(current, option)) {
      optionsByKey.set(option.key, option);
    }
  }

  return Array.from(optionsByKey.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(({ isCodexWorktree: _isCodexWorktree, ...option }) => option);
}

export function resolvePullRequestRepoOption(
  repoOptions: PullRequestRepoOption[],
  requestedRepoKey: string | null,
) {
  if (requestedRepoKey === "all") {
    return null;
  }

  return repoOptions.find((option) => option.key === requestedRepoKey) ?? repoOptions[0] ?? null;
}

export function resolvePullRequestSelectionKey(
  repoOptions: PullRequestRepoOption[],
  requestedRepoKey: string | null,
) {
  if (requestedRepoKey === "all") {
    return "all";
  }

  return resolvePullRequestRepoOption(repoOptions, requestedRepoKey)?.key ?? null;
}

export function groupPullRequestBoardItems(items: PullRequestBoardItem[]) {
  return PULL_REQUEST_BOARD_COLUMN_ORDER.flatMap((key) => {
    const groupItems = items.filter((item) => matchesBoardColumn(item, key));
    return groupItems.length > 0 ? [{ key, title: getColumnTitleKey(key), items: groupItems }] : [];
  });
}

export function resolveSelectedPullRequest(
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

export function getFirstSelectablePullRequest(items: PullRequestBoardItem[]) {
  return groupPullRequestBoardItems(items).find((section) => section.items.length > 0)?.items[0] ?? null;
}

export function getPullRequestBoardQueryTarget(
  repoOption: PullRequestRepoOption | null,
  repoKey: string | null,
  repoOptions: PullRequestRepoOption[],
  view: PullRequestFilterView,
) {
  const searchQuery = view === "review" ? pullRequestSearchQueryForView(view) : null;

  if (repoKey === "all") {
    return {
      repos: repoOptions.map(({ cwd, hostId, repo }) => ({
        cwd,
        hostId,
        repo,
      })),
      searchQuery,
    };
  }

  return repoOption == null
    ? null
    : {
        cwd: repoOption.cwd,
        hostId: repoOption.hostId,
        repo: repoOption.repo,
        searchQuery,
      };
}

export function normalizePullRequestFilterView(value: string | null): PullRequestFilterView {
  return value === "review" ? "review" : "authored";
}

export function pullRequestSelectionKey({
  repoKey,
  view,
  searchQuery,
}: {
  repoKey: string | null;
  view: PullRequestFilterView;
  searchQuery: string | null;
}) {
  return `${repoKey ?? ""}:${view}:${searchQuery ?? ""}`;
}

export function isPullRequestColumnCollapsedByDefault(key: PullRequestBoardColumnKey) {
  return key === "merged";
}

export function getColumnTitleKey(key: PullRequestBoardColumnKey) {
  switch (key) {
    case "draft":
      return "pullRequestsPage.column.draft";
    case "merged":
      return "pullRequestsPage.column.merged";
    case "ready":
      return "pullRequestsPage.column.ready";
    case "unmet_checks":
      return "pullRequestsPage.column.unmetChecks";
  }
}

export function matchesBoardColumn(item: PullRequestBoardItem, key: PullRequestBoardColumnKey) {
  switch (key) {
    case "draft":
    case "merged":
    case "ready":
      return item.state === key;
    case "unmet_checks":
      return item.state === "failing" || item.state === "in_progress";
  }
}

export function getRepoKeyFromOriginUrl(originUrl: string) {
  return parseRepoKeyFromOriginUrl(originUrl)?.repoKey ?? null;
}

export function parseRepoKeyFromOriginUrl(originUrl: string) {
  const trimmed = originUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const sshMatch = /^(?:ssh:\/\/)?[^@]+@([^/:]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch) {
    return buildParsedRepoKey(sshMatch[1], sshMatch[2], sshMatch[3]);
  }

  try {
    const parsed = new URL(trimmed);
    const [owner, repo] = parsed.pathname
      .split("/")
      .filter((part) => part.length > 0)
      .slice(0, 2);
    if (!owner || !repo) {
      return null;
    }
    return buildParsedRepoKey(parsed.hostname, owner, repo);
  } catch {
    return null;
  }
}

function buildParsedRepoKey(host: string, owner: string, repo: string) {
  const normalizedHost = host.trim();
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.replace(/\.git$/i, "").trim();
  if (normalizedHost.length === 0 || normalizedOwner.length === 0 || normalizedRepo.length === 0) {
    return null;
  }

  const repoKey =
    normalizedHost.toLowerCase() === "github.com"
      ? `${normalizedOwner}/${normalizedRepo}`
      : `${normalizedHost}/${normalizedOwner}/${normalizedRepo}`;

  return {
    host: normalizedHost,
    owner: normalizedOwner,
    repo: normalizedRepo,
    repoKey,
    label: `${normalizedOwner}/${normalizedRepo}`,
  };
}

function isBetterRepoOption(
  current: PullRequestRepoOption & { isCodexWorktree: boolean },
  next: PullRequestRepoOption & { isCodexWorktree: boolean },
) {
  if (current.isCodexWorktree !== next.isCodexWorktree) {
    return current.isCodexWorktree && !next.isCodexWorktree;
  }

  const currentPath = normalizePath(current.cwd);
  const nextPath = normalizePath(next.cwd);
  if (currentPath.length !== nextPath.length) {
    return nextPath.length > currentPath.length;
  }

  return nextPath.localeCompare(currentPath) < 0;
}

function normalizeOptionalString(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInteger(value: string | null) {
  const normalized = normalizeOptionalString(value);
  if (normalized == null) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
