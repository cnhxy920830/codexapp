import { invoke } from "@tauri-apps/api/core";

export type OpenFileParams = {
  hostId?: string | null;
  path: string;
  cwd?: string | null;
  target?: string | null;
  line?: number | null;
  column?: number | null;
  openMode?: string | null;
  range?:
    | {
        start: {
          line: number;
          column: number;
        };
      }
    | null;
};

export type ReadFileParams = {
  hostId?: string | null;
  path: string;
  cwd?: string | null;
};

export type ReadFileTextResponse = {
  contents: string;
};

export type ReadFileMetadataResponse = {
  isFile: boolean;
  sizeBytes: number | null;
  mimeType: string | null;
};

export type ReadFileBinaryResponse = {
  contentsBase64: string;
};

export async function openFile(params: OpenFileParams) {
  await invoke<void>("open-file", { params });
  return { success: true as const };
}

export async function openInBrowser(url: string) {
  await invoke<void>("open-in-browser", {
    params: { url },
  });
}

export async function readFileText(params: ReadFileParams) {
  return invoke<ReadFileTextResponse>("read-file", { params });
}

export async function readFileMetadata(params: ReadFileParams) {
  return invoke<ReadFileMetadataResponse>("read-file-metadata", { params });
}

export async function readFileBinary(params: ReadFileParams) {
  return invoke<ReadFileBinaryResponse>("read-file-binary", { params });
}
