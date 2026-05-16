/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewSidePanel } from "./ReviewSidePanel";
import { RightPanelCollapsedRail, RightPanelTabStrip } from "./RightPanelTabStrip";
import {
  createSideChatRightPanelTab,
  createWorkspaceFileRightPanelTab,
} from "./rightPanelTabs";
import type { ThreadDiffSummary } from "./threadConversationState";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/review-side-panel.snap.json");
const UPDATE_SNAPSHOTS = process.env.REVIEW_SIDE_PANEL_UPDATE_SNAPSHOTS === "1";

test("review side panel snapshots", async (t) => {
  const actualSnapshots = {
    reviewWithChanges: normalizeMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ReviewSidePanel
            gitInitCwd="D:\\workspace"
            hostId={null}
            onOpenReviewFile={() => undefined}
            showGitRepoRequired={false}
            t={translate}
            threadDiffSummary={buildThreadDiffSummaryFixture()}
          />
        </div>,
      ),
    ),
    reviewEmpty: normalizeMarkup(
      renderToStaticMarkup(
        <div className="h-[900px] w-[1280px]">
          <ReviewSidePanel
            gitInitCwd="D:\\workspace"
            hostId={null}
            onOpenReviewFile={() => undefined}
            showGitRepoRequired={true}
            t={translate}
            threadDiffSummary={EMPTY_THREAD_DIFF_SUMMARY}
          />
        </div>,
      ),
    ),
    collapsedRailQuickOpenOnly: normalizeMarkup(
      renderToStaticMarkup(
        <RightPanelCollapsedRail
          activeStaticTabId={null}
          collapsedTabs={[]}
          onActivateTab={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          t={translate}
        />,
      ),
    ),
    collapsedRailWithTabs: normalizeMarkup(
      renderToStaticMarkup(
        <RightPanelCollapsedRail
          activeStaticTabId="review"
          collapsedTabs={[
            createWorkspaceFileRightPanelTab({
              name: "thread.ts",
              path: "D:\\workspace\\src\\thread.ts",
              relativePath: "src/thread.ts",
              workspaceRoot: "D:\\workspace",
            }),
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          t={translate}
        />,
      ),
    ),
    tabStripWithDynamicTabs: normalizeMarkup(
      renderToStaticMarkup(
        <RightPanelTabStrip
          activeTabId="sidechat:side-1"
          activeStaticTabId={null}
          openTabs={[
            createWorkspaceFileRightPanelTab({
              name: "thread.ts",
              path: "D:\\workspace\\src\\thread.ts",
              relativePath: "src/thread.ts",
              workspaceRoot: "D:\\workspace",
            }),
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onCloseTab={() => undefined}
          onReorderTabs={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onToggleFullWidth={() => undefined}
          onTogglePanel={() => undefined}
          rightPanelWidthMode="regular"
          t={translate}
        />,
      ),
    ),
    tabStripFullWidthMode: normalizeMarkup(
      renderToStaticMarkup(
        <RightPanelTabStrip
          activeTabId="sidechat:side-1"
          activeStaticTabId="review"
          openTabs={[
            createSideChatRightPanelTab({
              conversationId: "side-1",
              index: 2,
              title: "Side chat",
              numberedTitle: "Side chat 2",
            }),
          ]}
          onActivateTab={() => undefined}
          onCloseTab={() => undefined}
          onReorderTabs={() => undefined}
          onOpenBrowserTab={() => undefined}
          onOpenReviewTab={() => undefined}
          onToggleFullWidth={() => undefined}
          onTogglePanel={() => undefined}
          rightPanelWidthMode="full"
          t={translate}
        />,
      ),
    ),
  };

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
});

type SnapshotMap = {
  reviewWithChanges: string;
  reviewEmpty: string;
  collapsedRailQuickOpenOnly: string;
  collapsedRailWithTabs: string;
  tabStripWithDynamicTabs: string;
  tabStripFullWidthMode: string;
};

const EMPTY_THREAD_DIFF_SUMMARY: ThreadDiffSummary = {
  fileCount: 0,
  linesAdded: 0,
  linesDeleted: 0,
  files: [],
  hasChanges: false,
};

function normalizeMarkup(markup: string) {
  return markup
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildThreadDiffSummaryFixture(): ThreadDiffSummary {
  return {
    fileCount: 2,
    linesAdded: 5,
    linesDeleted: 2,
    hasChanges: true,
    files: [
      {
        kind: "modified",
        path: "src/features/chat/ThreadComposer.tsx",
        movePath: null,
        diff: [
          "@@ -1,4 +1,6 @@",
          " import React from \"react\";",
          "+import { useEffect } from \"react\";",
          " export function ThreadComposer() {",
          "-  return null;",
          "+  return <div>composer</div>;",
          " }",
        ].join("\n"),
      },
      {
        kind: "renamed",
        path: "src/features/chat/ReviewPane.tsx",
        movePath: "src/features/chat/ReviewSidePanel.tsx",
        diff: [
          "--- a/src/features/chat/ReviewPane.tsx",
          "+++ b/src/features/chat/ReviewSidePanel.tsx",
          "@@ -10,2 +10,4 @@",
          "-const title = \"Review\";",
          "+const title = \"Review changes\";",
          "+const subtitle = \"2 files changed\";",
        ].join("\n"),
      },
    ],
  };
}

const MESSAGE_MAP: Record<string, string> = {
  "app.chat.filesChanged": "{fileCount} files changed",
  "app.chat.movedTo": "Moved to",
  "app.chat.noOutput": "No output",
  "codex.review.copyGitApplyCommand": "Copy git apply command",
  "codex.review.copyGitApplyCommand.toast": "Copied git apply command",
  "codex.review.expandOrCollapseDiffMenu.collapse": "Collapse all",
  "codex.review.expandOrCollapseDiffMenu.expand": "Expand all",
  "codex.review.header.moreOptions": "Review options",
  "codex.review.loadFullFiles.disable": "Don't load full files",
  "codex.review.loadFullFiles.enable": "Load full files",
  "codex.review.noDiff": "No diff available",
  "codex.review.noDiff.baseDescription": "Changes will appear here when the assistant edits files.",
  "codex.review.noDiff.orNoLongerAvailable": "The latest diffs are no longer available.",
  "codex.review.noDiff.gitRepoRequired.title": "Create a Git repository",
  "codex.review.noDiff.gitRepoRequired.description": "Track, review, and undo changes in this project.",
  "codex.review.noDiff.gitInit.success": "Git repository created",
  "codex.review.noDiff.gitInit.createRepository": "Create git repository",
  "codex.review.noDiff.gitInit.creating": "Creating…",
  "codex.review.noDiff.gitInit.error": "Git init failed: {message}",
  "codex.review.refreshGitQueries": "Refresh",
  "codex.review.richPreview.disable": "Disable rich preview",
  "codex.review.richPreview.enable": "Enable rich preview",
  "codex.review.switchToSplit": "Switch to split diff",
  "codex.review.switchToUnified": "Switch to unified diff",
  "codex.review.whitespace.hide": "Hide white space",
  "codex.review.whitespace.show": "Show white space",
  "codex.review.wordDiffs.disable": "Disable word diffs",
  "codex.review.wordDiffs.enable": "Enable word diffs",
  "codex.review.wrap.disable": "Disable word wrap",
  "codex.review.wrap.enable": "Enable word wrap",
  "localConversation.planSummary.collapse": "Collapse",
  "localConversation.planSummary.expand": "Expand",
  "localConversation.planSummary.openInNewWindow": "Open in new window",
  "thread.sidePanel.browserTab": "Browser",
  "thread.sidePanel.diffTab": "Review",
  "thread.sidePanel.openBrowserTab": "Open browser tab",
  "thread.sidePanel.openFile": "Open file",
  "thread.sidePanel.openReviewTab": "Open review tab",
  "codex.rightPanel.expandFullWidth": "Expand panel",
  "codex.rightPanel.restoreWidth": "Restore panel width",
};

function translate(key: string, values?: Record<string, number | string>) {
  if (key === "app.chat.filesChanged") {
    return `${values?.fileCount ?? 0} files changed`;
  }
  return MESSAGE_MAP[key] ?? key;
}
