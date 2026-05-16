import { invoke } from "@tauri-apps/api/core";

export async function initializeGitRepository(params: {
  cwd: string;
  hostId?: string | null;
}) {
  return invoke<void>("git-init-repo", {
    params: {
      cwd: params.cwd,
      hostId: normalizeHostId(params.hostId),
    },
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
