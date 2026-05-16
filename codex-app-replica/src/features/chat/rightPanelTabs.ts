import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";

export type StaticRightPanelTabId = "review" | "browser";

export type WorkspaceFileRightPanelTab = {
  kind: "workspaceFile";
  file: WorkspaceFilePreviewTarget;
  id: string;
  title: string;
};

export type SideChatRightPanelTab = {
  kind: "sideChat";
  conversationId: string;
  id: string;
  title: string;
};

export type RightPanelTab = WorkspaceFileRightPanelTab | SideChatRightPanelTab;

export function createWorkspaceFileRightPanelTab(file: WorkspaceFilePreviewTarget): WorkspaceFileRightPanelTab {
  const relativePath = normalizeWorkspaceFileRelativePath(file.relativePath);

  return {
    kind: "workspaceFile",
    file:
      relativePath === file.relativePath
        ? file
        : {
            ...file,
            relativePath,
          },
    id: buildWorkspaceFileRightPanelTabId(relativePath),
    title: file.name,
  };
}

export function buildWorkspaceFileRightPanelTabId(relativePath: string) {
  return `file:${normalizeWorkspaceFileRelativePath(relativePath)}`;
}

export function buildSideChatRightPanelTabId(conversationId: string) {
  return `sidechat:${conversationId}`;
}

export function createSideChatRightPanelTab(params: {
  conversationId: string;
  index: number;
  title: string;
  numberedTitle: string;
}): SideChatRightPanelTab {
  return {
    kind: "sideChat",
    conversationId: params.conversationId,
    id: buildSideChatRightPanelTabId(params.conversationId),
    title: params.index <= 1 ? params.title : params.numberedTitle,
  };
}

export function isWorkspaceFileRightPanelTab(tab: RightPanelTab): tab is WorkspaceFileRightPanelTab {
  return tab.kind === "workspaceFile";
}

export function isSideChatRightPanelTab(tab: RightPanelTab): tab is SideChatRightPanelTab {
  return tab.kind === "sideChat";
}

export function isWorkspaceFileRightPanelTabId(tabId: string | null) {
  return tabId?.startsWith("file:") ?? false;
}

export function isSideChatRightPanelTabId(tabId: string | null) {
  return tabId?.startsWith("sidechat:") ?? false;
}

export function reorderRightPanelTabs(
  tabs: RightPanelTab[],
  activeTabId: string,
  overTabId: string,
) {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const overIndex = tabs.findIndex((tab) => tab.id === overTabId);

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return tabs;
  }

  const nextTabs = tabs.slice();
  nextTabs.splice(overIndex, 0, nextTabs.splice(activeIndex, 1)[0]);
  return nextTabs;
}

function normalizeWorkspaceFileRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
}
