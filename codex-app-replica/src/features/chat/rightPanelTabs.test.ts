import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSideChatRightPanelTab,
  createWorkspaceFileRightPanelTab,
  reorderRightPanelTabs,
} from "./rightPanelTabs";

test("reorderRightPanelTabs moves the dragged tab before the drop target", () => {
  const fileTab = createWorkspaceFileRightPanelTab({
    name: "alpha.ts",
    path: "D:\\workspace\\src\\alpha.ts",
    relativePath: "src/alpha.ts",
    workspaceRoot: "D:\\workspace",
  });
  const sideChatTab = createSideChatRightPanelTab({
    conversationId: "side-1",
    index: 1,
    title: "Side chat",
    numberedTitle: "Side chat 1",
  });
  const secondFileTab = createWorkspaceFileRightPanelTab({
    name: "beta.ts",
    path: "D:\\workspace\\src\\beta.ts",
    relativePath: "src/beta.ts",
    workspaceRoot: "D:\\workspace",
  });

  const result = reorderRightPanelTabs(
    [fileTab, sideChatTab, secondFileTab],
    secondFileTab.id,
    fileTab.id,
  );

  assert.deepEqual(
    result.map((tab) => tab.id),
    [secondFileTab.id, fileTab.id, sideChatTab.id],
  );
});

test("reorderRightPanelTabs is a no-op when either tab id is missing", () => {
  const fileTab = createWorkspaceFileRightPanelTab({
    name: "alpha.ts",
    path: "D:\\workspace\\src\\alpha.ts",
    relativePath: "src/alpha.ts",
    workspaceRoot: "D:\\workspace",
  });
  const sideChatTab = createSideChatRightPanelTab({
    conversationId: "side-1",
    index: 1,
    title: "Side chat",
    numberedTitle: "Side chat 1",
  });
  const source = [fileTab, sideChatTab];

  assert.equal(reorderRightPanelTabs(source, "missing", fileTab.id), source);
  assert.equal(reorderRightPanelTabs(source, fileTab.id, "missing"), source);
  assert.equal(reorderRightPanelTabs(source, fileTab.id, fileTab.id), source);
});
