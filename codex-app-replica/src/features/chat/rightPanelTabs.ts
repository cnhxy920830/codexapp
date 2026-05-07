import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";

export type StaticRightPanelTabId = "review" | "browser";

type StaticRightPanelTab = {
  kind: StaticRightPanelTabId;
  id: StaticRightPanelTabId;
};

export type WorkspaceFileRightPanelTab = {
  kind: "workspaceFile";
  file: WorkspaceFilePreviewTarget;
  id: string;
  title: string;
};

export type RightPanelTab = StaticRightPanelTab | WorkspaceFileRightPanelTab;

export function createStaticRightPanelTab(id: StaticRightPanelTabId): StaticRightPanelTab {
  return { kind: id, id };
}

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

export function isStaticRightPanelTab(tab: RightPanelTab): tab is StaticRightPanelTab {
  return tab.kind === "review" || tab.kind === "browser";
}

export function isWorkspaceFileRightPanelTab(tab: RightPanelTab): tab is WorkspaceFileRightPanelTab {
  return tab.kind === "workspaceFile";
}

export function isWorkspaceFileRightPanelTabId(tabId: string | null) {
  return tabId?.startsWith("file:") ?? false;
}

function normalizeWorkspaceFileRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
}
