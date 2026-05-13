import { invoke } from "@tauri-apps/api/core";

export type ScratchpadCompletionSummaryResponse = {
  summary: string | null;
};

export async function generateScratchpadCompletionSummary(params: {
  message: string;
  cwd?: string | null;
}) {
  return invoke<ScratchpadCompletionSummaryResponse>("generate-scratchpad-completion-summary", {
    message: params.message,
    cwd: normalizeOptionalString(params.cwd),
  });
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
