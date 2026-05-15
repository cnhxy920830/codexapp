import { invoke } from "@tauri-apps/api/core";
import { openFile } from "./hostFiles";

export type WorkspaceFileSearchResult = {
  name: string;
  path: string;
  relativePath: string;
};

export type WorkspaceFilePreviewTarget = WorkspaceFileSearchResult & {
  hostId?: string | null;
  workspaceRoot: string;
};

export type WorkspaceDirectoryEntry = {
  path: string;
  name: string;
  entryType: "file" | "directory";
};

export type WorkspaceFileDocument = {
  hostId?: string | null;
  name: string;
  path: string;
  relativePath: string;
  contents: string | null;
  mimeType: string | null;
  isBinary: boolean;
};

export type WorkspaceFileMetadata = {
  isFile: boolean;
  sizeBytes: number | null;
  mimeType: string | null;
};

export type ReadWorkspaceFileBinaryResponse = {
  contentsBase64: string;
};

export async function searchWorkspaceFiles(params: { workspaceRoot: string; query: string }) {
  return invoke<WorkspaceFileSearchResult[]>("search_workspace_files", { params });
}

export async function listWorkspaceDirectoryEntries(params: {
  workspaceRoot: string;
  directoryPath?: string | null;
  includeHidden?: boolean;
}) {
  return invoke<WorkspaceDirectoryEntry[]>("list_workspace_directory_entries", {
    params: {
      includeHidden: false,
      ...params,
    },
  });
}

export async function readWorkspaceFile(params: { workspaceRoot: string; relativePath: string }) {
  return invoke<WorkspaceFileDocument>("read_workspace_file", { params });
}

export async function readWorkspaceFileMetadata(params: { workspaceRoot: string; relativePath: string }) {
  return invoke<WorkspaceFileMetadata>("read_workspace_file_metadata", { params });
}

export async function readWorkspaceFileBinary(params: { workspaceRoot: string; relativePath: string }) {
  return invoke<ReadWorkspaceFileBinaryResponse>("read_workspace_file_binary", { params });
}

export async function openWorkspaceFileInEditor(path: string) {
  return openFile({ path });
}
