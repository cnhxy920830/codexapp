import { invoke } from "@tauri-apps/api/core";

export type GitOrigin = {
  dir: string;
  root: string | null;
  originUrl: string | null;
};

export type GitOriginsResponse = {
  origins: GitOrigin[];
};

export type GitOriginsParams = {
  dirs?: string[];
  hostId?: string | null;
};

export async function readGitOrigins(params: GitOriginsParams = {}) {
  const { dirs = [], hostId = null } = params;
  return invoke<GitOriginsResponse>("git-origins", {
    params: {
      dirs,
      hostId: normalizeHostId(hostId),
    },
  });
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
