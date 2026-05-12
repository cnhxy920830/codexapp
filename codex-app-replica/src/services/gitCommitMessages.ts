import { invoke } from "@tauri-apps/api/core";

export type GenerateGitCommitMessageResponse = {
  message: string | null;
};

export async function generateGitCommitMessage(params: {
  prompt: string;
  cwd?: string | null;
}) {
  return invoke<GenerateGitCommitMessageResponse>("generate-git-commit-message", {
    params: {
      prompt: params.prompt,
      cwd: normalizeOptionalString(params.cwd),
    },
  });
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
