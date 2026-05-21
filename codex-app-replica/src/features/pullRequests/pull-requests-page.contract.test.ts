import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const ROUTE_PAGE_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/PullRequestsRoutePage.tsx",
);
const PAGE_VIEW_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/PullRequestsPageView.tsx",
);
const DETAIL_PANE_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/PullRequestDetailPane.tsx",
);
const CODE_REVIEW_PANE_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/PullRequestCodeReviewPane.tsx",
);
const APP_PATH = path.join(process.cwd(), "src/App.tsx");

test("pull requests page owns its app-shell header registration and body sectioned-page shell", async () => {
  const routeSource = await readFile(ROUTE_PAGE_PATH, "utf8");
  const pageViewSource = await readFile(PAGE_VIEW_PATH, "utf8");
  const appSource = await readFile(APP_PATH, "utf8");

  assert.match(routeSource, /onRegisterHeaderContent\?: \(content: ReactNode \| null\) => void;/);
  assert.match(routeSource, /onRegisterHeaderContent\?\.\(shouldShowPageHeader \? headerContent : null\)/);
  assert.match(routeSource, /onRegisterHeaderContent\?\.\(null\)/);
  assert.match(routeSource, /<PullRequestsHeaderRepoMenu/);
  assert.match(appSource, /currentRoute === "scratchpad" \|\| currentRoute === "pull-requests"/);
  assert.match(appSource, /<PullRequestsRoutePage[\s\S]*onRegisterHeaderContent=\{\(content\) => \{\s*setPageHeaderContent\(content\);?\s*\}\}/);
  assert.match(pageViewSource, /<SectionedPage[\s\S]*showNav=\{false\}/s);
  assert.match(pageViewSource, /contentInnerClassName="flex flex-col gap-8 px-panel pb-panel"/);
  assert.match(pageViewSource, /export function PullRequestsRouteLoadingState\(\)/);
  assert.match(pageViewSource, /className="flex h-full items-center justify-center"/);
  assert.match(routeSource, /if \(isWorkspaceMetadataLoading\) \{\s*return <PullRequestsRouteLoadingState \/>;\s*\}/s);
  assert.match(routeSource, /if \(noRepos\) \{\s*return \(\s*<PullRequestsCenteredEmptyState/s);
});

test("pull requests board rows and empty states follow extracted shared-owner semantics", async () => {
  const pageViewSource = await readFile(PAGE_VIEW_PATH, "utf8");

  assert.match(pageViewSource, /<SectionedPageSection id=\{sectionId\} showDivider title=\{title\}>/);
  assert.match(pageViewSource, /bg-token-list-active-selection-background/);
  assert.match(pageViewSource, /text-token-description-foreground/);
  assert.match(pageViewSource, /<Button[\s\S]*color="secondary"[\s\S]*>\s*\{t\("pullRequestsPage\.card\.merge"\)\}/s);
  assert.match(pageViewSource, /export function PullRequestsBoardLoadingState\(\)/);
  assert.match(pageViewSource, /export function PullRequestsCenteredEmptyState\(/);
  assert.doesNotMatch(pageViewSource, /draggable flex w-full min-w-0 items-center justify-between gap-3 border-b/);
});

test("pull requests detail owner and code review toolbar follow extracted right-panel behavior", async () => {
  const detailPaneSource = await readFile(DETAIL_PANE_PATH, "utf8");
  const codeReviewPaneSource = await readFile(CODE_REVIEW_PANE_PATH, "utf8");

  assert.match(detailPaneSource, /const \[isFileTreeVisible, setIsFileTreeVisible\] = useState\(false\);/);
  assert.match(detailPaneSource, /setIsFileTreeVisible\(false\);[\s\S]*?\}, \[detailKey\]\);/s);
  assert.match(detailPaneSource, /`\$\{effectiveBoardItem\.headBranch\} -> \$\{effectiveBoardItem\.baseBranch\}`/);
  assert.match(detailPaneSource, /relatedThreads\.length > 0 \?/);
  assert.match(detailPaneSource, /pullRequestsPage\.detail\.relatedThreads\.untitled/);
  assert.match(detailPaneSource, /selectedTab === "codeReview" \?[\s\S]*?pullRequestsPage\.codeReview\.hideFileTree[\s\S]*?pullRequestsPage\.codeReview\.showFileTree/s);
  assert.match(detailPaneSource, /showFileTree=\{isFileTreeVisible\}/);

  assert.match(codeReviewPaneSource, /if \(isCodeReviewLoading\) \{\s*return <LoadingPage \/>;\s*\}/s);
  assert.match(codeReviewPaneSource, /CodeReviewCenteredMessage/);
  assert.match(codeReviewPaneSource, /pullRequestsPage\.codeReview\.empty/);
  assert.match(codeReviewPaneSource, /pullRequestsPage\.codeReview\.error/);
  assert.match(codeReviewPaneSource, /showHideWhitespace=\{false\}/);
  assert.match(codeReviewPaneSource, /showLoadFullFiles=\{false\}/);
  assert.doesNotMatch(codeReviewPaneSource, /showLoadFullFiles=\{showLoadFullFiles\}/);
});
