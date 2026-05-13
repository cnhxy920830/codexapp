import { invoke } from "@tauri-apps/api/core";

export type ProjectlessThreadCwdParams = {
  directoryName?: string | null;
  prompt?: string | null;
};

export type ProjectlessThreadCwdResponse = {
  cwd: string;
  outputDirectory: string;
  workspaceRoot: string;
};

export async function readProjectlessThreadCwd(
  params?: ProjectlessThreadCwdParams | null,
) {
  return invoke<ProjectlessThreadCwdResponse>("projectless-thread-cwd", {
    params: params ?? null,
  });
}
