import { invoke } from "@tauri-apps/api/core";

export type ApplyPatchStatus = "success" | "partial-success" | "error";
export type ApplyPatchErrorCode = "not-git-repo";

export type ApplyPatchRequest = {
  diff: string;
  cwd: string;
  hostConfig?: Record<string, unknown> | null;
  revert?: boolean;
};

export type ApplyPatchResponse = {
  status: ApplyPatchStatus;
  appliedPaths: string[];
  skippedPaths: string[];
  conflictedPaths: string[];
  errorCode?: ApplyPatchErrorCode | null;
};

export async function applyPatch(params: ApplyPatchRequest) {
  return invoke<ApplyPatchResponse>("apply-patch", {
    params: {
      diff: params.diff,
      cwd: params.cwd,
      hostConfig: params.hostConfig ?? null,
      revert: params.revert ?? false,
    },
  });
}
