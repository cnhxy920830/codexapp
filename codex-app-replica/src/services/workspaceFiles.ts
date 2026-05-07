import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

export type WorkspaceFileSearchResult = {
  name: string;
  path: string;
  relativePath: string;
};

export type WorkspaceFileDocument = {
  name: string;
  path: string;
  relativePath: string;
  contents: string | null;
  mimeType: string | null;
  isBinary: boolean;
};

export async function searchWorkspaceFiles(params: { workspaceRoot: string; query: string }) {
  return invoke<WorkspaceFileSearchResult[]>("search_workspace_files", { params });
}

export async function readWorkspaceFile(params: { workspaceRoot: string; relativePath: string }) {
  return invoke<WorkspaceFileDocument>("read_workspace_file", { params });
}

export async function openWorkspaceFileInEditor(path: string) {
  return open(path);
}
