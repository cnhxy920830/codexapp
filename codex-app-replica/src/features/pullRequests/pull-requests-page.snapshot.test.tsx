/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import type {
  PullRequestActivityItem,
  PullRequestBoardItem,
  PullRequestCommentAttachment,
  PullRequestStatusSuccess,
} from "../../services/pullRequests";
import { groupPullRequestBoardItems } from "./pullRequestsPageModel";
import { PullRequestsPageView } from "./PullRequestsPageView";
import type { PullRequestDiffFile } from "./pullRequestDiffModel";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/__snapshots__/pull-requests-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.PULL_REQUESTS_PAGE_UPDATE_SNAPSHOTS === "1";
const NOW = Date.UTC(2026, 4, 11, 12, 0, 0);

test("pull requests page snapshots", async (t) => {
  const originalNow = Date.now;
  Date.now = () => NOW;

  try {
    const actualSnapshots = buildSnapshots();

    if (UPDATE_SNAPSHOTS) {
      await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
      await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
      return;
    }

    const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

    for (const [name, actual] of Object.entries(actualSnapshots)) {
      await t.test(name, () => {
        assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
      });
    }
  } finally {
    Date.now = originalNow;
  }
});

type SnapshotMap = {
  noRepos: string;
  boardDetail: string;
  codeReview: string;
};

function buildSnapshots(): SnapshotMap {
  const boardItem = buildBoardItem();
  const detail = buildDetail(boardItem);

  return {
    noRepos: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <PullRequestsPageView
            boardItems={[]}
            boardLoading={false}
            boardSections={[]}
            codeReviewError={null}
            cwd={null}
            detail={null}
            detailError={null}
            detailKey="none"
            detailLoading={false}
            diffFiles={[]}
            hostId={null}
            isCodeReviewLoading={false}
            isWorkspaceMetadataLoading={false}
            noRepos
            onCloseDetail={noop}
            onCopyGitApplyCommand={null}
            onCopyPullRequestUrl={noopBoard}
            onMarkAsDraft={noop}
            onMarkAsReady={noop}
            onMergePullRequest={noopBoard}
            onOpenCommentUrl={noopUrl}
            onOpenPullRequestInBrowser={noopBoard}
            onPostComment={noopText}
            onPostReply={noopReply}
            onRefreshCodeReview={noop}
            onSelectBoardItem={noopBoard}
            onSelectFilterView={noopFilter}
            onSelectRepo={noopRepo}
            onSelectTab={noopTab}
            onToggleAutoMerge={noop}
            pageError={null}
            pageErrorDetail={null}
            repoOptions={[]}
            selectedBoardItem={null}
            selectedRepoKey={null}
            selectedTab="pullRequest"
            selectedView="authored"
          />
        </div>
      </StaticI18nProvider>,
    ),
    boardDetail: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[900px]">
          <PullRequestsPageView
            boardItems={[boardItem]}
            boardLoading={false}
            boardSections={groupPullRequestBoardItems([boardItem])}
            codeReviewError={null}
            cwd={boardItem.cwd}
            detail={detail}
            detailError={null}
            detailKey="board-item"
            detailLoading={false}
            diffFiles={[]}
            hostId={boardItem.hostId}
            isCodeReviewLoading={false}
            isWorkspaceMetadataLoading={false}
            noRepos={false}
            onCloseDetail={noop}
            onCopyGitApplyCommand={null}
            onCopyPullRequestUrl={noopBoard}
            onMarkAsDraft={noop}
            onMarkAsReady={noop}
            onMergePullRequest={noopBoard}
            onOpenCommentUrl={noopUrl}
            onOpenPullRequestInBrowser={noopBoard}
            onPostComment={noopText}
            onPostReply={noopReply}
            onRefreshCodeReview={noop}
            onSelectBoardItem={noopBoard}
            onSelectFilterView={noopFilter}
            onSelectRepo={noopRepo}
            onSelectTab={noopTab}
            onToggleAutoMerge={noop}
            pageError={null}
            pageErrorDetail={null}
            repoOptions={[{ cwd: boardItem.cwd, hostId: null, label: "openai/codex", originUrl: null, repo: "openai/codex", key: "openai/codex" }]}
            selectedBoardItem={boardItem}
            selectedRepoKey="all"
            selectedTab="pullRequest"
            selectedView="authored"
          />
        </div>
      </StaticI18nProvider>,
    ),
    codeReview: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[900px]">
          <PullRequestsPageView
            boardItems={[boardItem]}
            boardLoading={false}
            boardSections={groupPullRequestBoardItems([boardItem])}
            codeReviewError={null}
            cwd={boardItem.cwd}
            detail={detail}
            detailError={null}
            detailKey="code-review"
            detailLoading={false}
            diffFiles={DIFF_FILES}
            hostId={boardItem.hostId}
            isCodeReviewLoading={false}
            isWorkspaceMetadataLoading={false}
            noRepos={false}
            onCloseDetail={noop}
            onCopyGitApplyCommand={null}
            onCopyPullRequestUrl={noopBoard}
            onMarkAsDraft={noop}
            onMarkAsReady={noop}
            onMergePullRequest={noopBoard}
            onOpenCommentUrl={noopUrl}
            onOpenPullRequestInBrowser={noopBoard}
            onPostComment={noopText}
            onPostReply={noopReply}
            onRefreshCodeReview={noop}
            onSelectBoardItem={noopBoard}
            onSelectFilterView={noopFilter}
            onSelectRepo={noopRepo}
            onSelectTab={noopTab}
            onToggleAutoMerge={noop}
            pageError={null}
            pageErrorDetail={null}
            repoOptions={[{ cwd: boardItem.cwd, hostId: null, label: "openai/codex", originUrl: null, repo: "openai/codex", key: "openai/codex" }]}
            selectedBoardItem={boardItem}
            selectedRepoKey="openai/codex"
            selectedTab="codeReview"
            selectedView="review"
          />
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function StaticI18nProvider({ children }: { children: ReactElement }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US" as LocaleCode,
        setLocale: noopLocale,
        t: translate,
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}

function buildBoardItem(): PullRequestBoardItem {
  return {
    additions: 24,
    baseBranch: "main",
    canMerge: true,
    cwd: "D:\\workspace\\codex",
    deletions: 9,
    headBranch: "pr-page-shell",
    hostId: null,
    isAuthor: true,
    number: 142,
    repo: "openai/codex",
    state: "ready",
    title: "Align pull requests page",
    url: "https://github.com/openai/codex/pull/142",
  };
}

function buildDetail(boardItem: PullRequestBoardItem): PullRequestStatusSuccess {
  return {
    activityItems: [
      {
        type: "event",
        event: "opened",
        actorLogin: "codex-bot",
        createdAt: "2026-05-11T10:00:00Z",
      },
      {
        type: "review_comment",
        id: "review-comment-1",
        reviewThreadId: "thread-1",
        authorLogin: "reviewer",
        authorAvatarUrl: null,
        body: "Please tighten the header spacing.",
        createdAt: "2026-05-11T10:15:00Z",
        replies: [
          {
            id: "reply-1",
            authorLogin: "codex-bot",
            authorAvatarUrl: null,
            body: "Done.",
            createdAt: "2026-05-11T10:20:00Z",
            url: "https://github.com/openai/codex/pull/142#discussion_r1",
          },
        ],
        url: "https://github.com/openai/codex/pull/142#discussion_r2",
        path: "src/App.tsx",
        line: 42,
      },
    ] as PullRequestActivityItem[],
    boardItem,
    body: "This page now matches the extracted upstream shell.",
    canMerge: true,
    checks: [
      {
        status: "passing",
        label: "build",
        description: null,
        link: null,
      },
    ],
    ciStatus: "passing",
    commentAttachments: [
      {
        reviewThreadId: "thread-1",
        position: {
          path: "src/App.tsx",
          line: 42,
          side: "RIGHT",
          startLine: null,
          startSide: null,
          endLine: 42,
        },
        body: "Looks good.",
        content: [{ contentType: "text/plain", text: "Looks good." }],
        path: "src/App.tsx",
        line: 42,
        startLine: null,
        endLine: 42,
        authorLogin: "reviewer",
        authorAvatarUrl: null,
        createdAt: "2026-05-11T10:16:00Z",
        url: "https://github.com/openai/codex/pull/142#discussion_r2",
      },
    ] as PullRequestCommentAttachment[],
    hasOpenPr: true,
    isAutoMergeEnabled: false,
    isDraft: false,
    number: boardItem.number,
    repo: boardItem.repo,
    reviewers: {
      approved: [],
      commentCounts: [],
      commented: [],
      changesRequested: [],
      requested: [],
      unresolvedCommentCount: 1,
    },
    reviewStatus: "review_required",
    status: "success",
    url: boardItem.url,
  };
}

const DIFF_FILES: PullRequestDiffFile[] = [
  {
    additions: 12,
    deletions: 4,
    headerLines: ["diff --git a/src/App.tsx b/src/App.tsx"],
    hunkMetadata: [],
    hunks: ["@@ -1,4 +1,4 @@"],
    isBinary: false,
    isPartial: false,
    newObjectId: null,
    newPath: "src/App.tsx",
    oldObjectId: null,
    oldPath: "src/App.tsx",
    path: "src/App.tsx",
    patch: "diff --git a/src/App.tsx b/src/App.tsx\n@@ -1,4 +1,4 @@\n-context\n+context updated",
    status: "modified",
  },
  {
    additions: 8,
    deletions: 2,
    headerLines: ["diff --git a/src/components/Toolbar.tsx b/src/components/Toolbar.tsx"],
    hunkMetadata: [],
    hunks: ["@@ -10,3 +10,9 @@"],
    isBinary: false,
    isPartial: false,
    newObjectId: null,
    newPath: "src/components/Toolbar.tsx",
    oldObjectId: null,
    oldPath: "src/components/Toolbar.tsx",
    path: "src/components/Toolbar.tsx",
    patch:
      "diff --git a/src/components/Toolbar.tsx b/src/components/Toolbar.tsx\n@@ -10,3 +10,9 @@\n-export function Toolbar() {}\n+export function Toolbar() {\n+  return <div className=\"toolbar\">Review</div>;\n+}",
    status: "modified",
  },
  {
    additions: 3,
    deletions: 1,
    headerLines: ["diff --git a/docs/pull-requests.md b/docs/pull-requests.md"],
    hunkMetadata: [],
    hunks: ["@@ -1,2 +1,4 @@"],
    isBinary: false,
    isPartial: false,
    newObjectId: null,
    newPath: "docs/pull-requests.md",
    oldObjectId: null,
    oldPath: "docs/pull-requests.md",
    path: "docs/pull-requests.md",
    patch:
      "diff --git a/docs/pull-requests.md b/docs/pull-requests.md\n@@ -1,2 +1,4 @@\n-PRs\n+Pull requests\n+\n+Code review layout notes",
    status: "modified",
  },
];

const noop = () => {};
const noopLocale = (_locale: LocaleCode) => {};
const noopBoard = (_item: PullRequestBoardItem) => {};
const noopFilter = (_view: "authored" | "review") => {};
const noopRepo = (_repoKey: string) => {};
const noopTab = (_tab: "pullRequest" | "codeReview") => {};
const noopText = (_body: string) => {};
const noopReply = (_reviewThreadId: string, _body: string) => {};
const noopUrl = (_url: string) => {};

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(MESSAGES["en-US"][key], values);
}

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  const formattedPluralTemplate = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, token, oneVariant, otherVariant) => {
      const rawValue = values[token];
      const numericValue =
        typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const variant = numericValue === 1 ? oneVariant : otherVariant;
      return variant.replaceAll("#", String(numericValue));
    },
  );

  return formattedPluralTemplate.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}
