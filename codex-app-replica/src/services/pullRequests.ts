import { invoke } from "@tauri-apps/api/core";

export type PullRequestFilterView = "authored" | "review";
export type PullRequestBoardColumnKey = "unmet_checks" | "draft" | "ready" | "merged";
export type PullRequestBoardState = "draft" | "failing" | "in_progress" | "merged" | "ready";
export type PullRequestUpdateAction = "mark-draft" | "mark-ready" | "toggle-auto-merge";
export type GhCliStatusResponse = {
  isInstalled: boolean;
  isAuthenticated: boolean;
};

export type ErrorEnvelope = {
  status: "error";
  error: string;
};

export type SuccessEnvelope = {
  status: "success";
};

export type PullRequestBoardRepoParams = {
  cwd: string;
  hostId?: string | null;
  repo: string;
};

export type PullRequestBoardParams = {
  cwd?: string | null;
  hostId?: string | null;
  repo?: string | null;
  repos?: PullRequestBoardRepoParams[] | null;
  searchQuery?: string | null;
};

export type PullRequestBoardItem = {
  cwd: string;
  headBranch: string;
  hostId: string | null;
  url: string;
  number: number;
  state: PullRequestBoardState;
  additions: number;
  deletions: number;
  title: string;
  repo: string | null;
  baseBranch: string;
  isAuthor: boolean;
  canMerge: boolean;
};

export type PullRequestBoardSuccess = {
  status: "success";
  items: PullRequestBoardItem[];
};

export type PullRequestBoardResponse = PullRequestBoardSuccess | ErrorEnvelope;

export type PullRequestLookupParams = {
  cwd: string;
  headBranch: string;
  hostId?: string | null;
  number?: number | null;
  repo?: string | null;
};

export type PullRequestInlineCommentParams = {
  path: string;
  side: string;
  line: number;
  startLine?: number | null;
  startSide?: string | null;
};

export type PullRequestCommentParams = {
  body: string;
  cwd: string;
  hostId?: string | null;
  number: number;
  repo: string;
  replyToReviewThreadId?: string | number | null;
  inlineComment?: PullRequestInlineCommentParams | null;
};

export type PullRequestCheck = {
  status: string;
  label: string;
  description: string | null;
  link: string | null;
};

export type PullRequestCommentPosition = {
  path: string;
  line: number | null;
  side: string;
  startLine: number | null;
  startSide: string | null;
  endLine: number | null;
};

export type PullRequestCommentContent = {
  contentType: string;
  text: string;
};

export type PullRequestCommentAttachment = {
  reviewThreadId: string | null;
  position: PullRequestCommentPosition;
  body: string;
  content: PullRequestCommentContent[];
  path: string;
  line: number | null;
  startLine: number | null;
  endLine: number | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  createdAt: string | null;
  url: string | null;
};

export type PullRequestFileContentSuccess = {
  status: "success";
  contents: string;
};

export type PullRequestFileContentResponse = PullRequestFileContentSuccess | ErrorEnvelope;

export type PullRequestActivityReply = {
  id: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  url: string | null;
};

export type PullRequestActivityEvent = {
  type: "event";
  event: string;
  actorLogin: string | null;
  createdAt: string;
};

export type PullRequestActivityComment = {
  type: "comment" | "review" | "review_comment";
  id: string;
  reviewThreadId: string | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  replies: PullRequestActivityReply[];
  url: string | null;
  path: string | null;
  line: number | null;
};

export type PullRequestActivityItem = PullRequestActivityEvent | PullRequestActivityComment;

export type PullRequestReviewer = {
  login: string;
  avatarUrl: string | null;
  url: string | null;
  commentCount: number | null;
  count: number | null;
};

export type PullRequestReviewers = {
  approved: PullRequestReviewer[];
  commentCounts: PullRequestReviewer[];
  commented: PullRequestReviewer[];
  changesRequested: PullRequestReviewer[];
  requested: PullRequestReviewer[];
  unresolvedCommentCount: number;
};

export type PullRequestStatusSuccess = {
  status: "success";
  activityItems: PullRequestActivityItem[];
  boardItem: PullRequestBoardItem | null;
  body: string;
  canMerge: boolean;
  checks: PullRequestCheck[];
  ciStatus: string;
  commentAttachments: PullRequestCommentAttachment[];
  hasOpenPr: boolean;
  isAutoMergeEnabled: boolean;
  isDraft: boolean;
  number: number | null;
  repo: string | null;
  reviewers: PullRequestReviewers;
  reviewStatus: string;
  url: string | null;
};

export type PullRequestStatusResponse = PullRequestStatusSuccess | ErrorEnvelope;

export type PullRequestMergeParams = {
  cwd: string;
  hostId?: string | null;
  mergeMethod: string;
  number: number;
  repo: string;
};

export type PullRequestUpdateParams = {
  cwd: string;
  hostId?: string | null;
  number: number;
  repo: string;
  action: PullRequestUpdateAction;
  enabled?: boolean | null;
  mergeMethod?: string | null;
};

export type ParsedOriginRepo = {
  host: string;
  owner: string;
  repo: string;
  repoKey: string;
  label: string;
};

export async function readPullRequestBoard(params: PullRequestBoardParams) {
  return invoke<PullRequestBoardResponse>("gh-pr-board", {
    params: normalizeBoardParams(params),
  });
}

export async function readGhCliStatus(params: {
  hostId?: string | null;
}) {
  return invoke<GhCliStatusResponse>("gh-cli-status", {
    params: {
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function readPullRequestStatus(params: PullRequestLookupParams) {
  return invoke<PullRequestStatusResponse>("gh-pr-status", {
    params: normalizeLookupParams(params),
  });
}

export async function mergePullRequest(params: PullRequestMergeParams) {
  return invoke<SuccessEnvelope | ErrorEnvelope>("gh-pr-merge", {
    params: {
      ...params,
      hostId: normalizeHostId(params.hostId),
      repo: params.repo.trim(),
    },
  });
}

export async function updatePullRequest(params: PullRequestUpdateParams) {
  return invoke<SuccessEnvelope | ErrorEnvelope>("gh-pr-update", {
    params: {
      ...params,
      hostId: normalizeHostId(params.hostId),
      repo: params.repo.trim(),
      mergeMethod: normalizeOptionalString(params.mergeMethod),
      enabled: params.enabled ?? null,
    },
  });
}

export async function readPullRequestDiff(params: {
  cwd: string;
  hostId?: string | null;
  number: number;
  repo?: string | null;
}) {
  return invoke<{ status: "success"; unifiedDiff: string } | ErrorEnvelope>("gh-pr-diff", {
    params: {
      cwd: params.cwd,
      hostId: normalizeHostId(params.hostId),
      number: params.number,
      repo: normalizeOptionalString(params.repo),
    },
  });
}

export async function readPullRequestFileContent(params: {
  cwd: string;
  hostId?: string | null;
  objectId: string;
}) {
  return invoke<PullRequestFileContentResponse>("gh-pr-file-content", {
    params: {
      cwd: params.cwd,
      hostId: normalizeHostId(params.hostId),
      objectId: params.objectId.trim(),
    },
  });
}

export async function commentPullRequest(params: PullRequestCommentParams) {
  return invoke<SuccessEnvelope | ErrorEnvelope>("gh-pr-comment", {
    params: {
      body: params.body,
      cwd: params.cwd,
      hostId: normalizeHostId(params.hostId),
      number: params.number,
      repo: params.repo.trim(),
      replyToReviewThreadId: params.replyToReviewThreadId ?? null,
      inlineComment:
        params.inlineComment == null
          ? null
          : {
              path: params.inlineComment.path,
              side: params.inlineComment.side,
              line: params.inlineComment.line,
              startLine: params.inlineComment.startLine ?? null,
              startSide: normalizeOptionalString(params.inlineComment.startSide),
            },
    },
  });
}

export async function openPullRequestInBrowser(url: string) {
  return invoke<void>("open-in-browser", {
    params: { url },
  });
}

export function pullRequestSearchQueryForView(view: PullRequestFilterView) {
  switch (view) {
    case "review":
      return "is:pr is:open review-requested:@me";
    case "authored":
      return "is:pr author:@me";
  }
}

export function parseRepoKeyFromOriginUrl(originUrl: string): ParsedOriginRepo | null {
  const trimmed = originUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const sshMatch = /^(?:ssh:\/\/)?[^@]+@([^/:]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch) {
    return buildParsedOriginRepo(sshMatch[1], sshMatch[2], sshMatch[3]);
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
    return buildParsedOriginRepo(parsed.hostname, owner, repo);
  } catch {
    return null;
  }
}

function buildParsedOriginRepo(host: string, owner: string, repo: string): ParsedOriginRepo | null {
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

function normalizeBoardParams(params: PullRequestBoardParams) {
  return {
    cwd: normalizeOptionalString(params.cwd),
    hostId: normalizeHostId(params.hostId),
    repo: normalizeOptionalString(params.repo),
    repos:
      params.repos?.map((repo) => ({
        cwd: repo.cwd,
        hostId: normalizeHostId(repo.hostId),
        repo: repo.repo.trim(),
      })) ?? null,
    searchQuery: normalizeOptionalString(params.searchQuery),
  };
}

function normalizeLookupParams(params: PullRequestLookupParams) {
  return {
    cwd: params.cwd,
    headBranch: params.headBranch,
    hostId: normalizeHostId(params.hostId),
    number: params.number ?? null,
    repo: normalizeOptionalString(params.repo),
  };
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
