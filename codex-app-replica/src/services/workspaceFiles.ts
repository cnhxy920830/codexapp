import { invoke } from "@tauri-apps/api/core";

export type WorkspaceFileSearchResult = {
  name: string;
  path: string;
  relativePath: string;
};

export type WorkspaceFileDocument = {
  name: string;
  path: string;
  relativePath: string;
  contents: string;
};

export async function searchWorkspaceFiles(params: { workspaceRoot: string; query: string }) {
  return invoke<WorkspaceFileSearchResult[]>("search_workspace_files", { params });
}

export async function readWorkspaceFile(params: { workspaceRoot: string; relativePath: string }) {
  return invoke<WorkspaceFileDocument>("read_workspace_file", { params });
}
