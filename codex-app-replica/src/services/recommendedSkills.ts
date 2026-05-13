import { invoke } from "@tauri-apps/api/core";

export type RecommendedSkill = {
  id: string;
  name: string;
  description: string;
  shortDescription: string | null;
  iconSmall: string | null;
  iconLarge: string | null;
  repoPath: string;
};

export type RecommendedSkillsSnapshot = {
  repoRoot: string | null;
  skills: RecommendedSkill[];
};

type RecommendedSkillsResponse = {
  repoRoot: string | null;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    shortDescription: string | null;
    iconSmall: string | null;
    iconLarge: string | null;
    repoPath: string;
  }>;
  error: string | null;
};

type InstallRecommendedSkillResponse = {
  installedPath: string;
};

export async function readRecommendedSkills(params?: {
  hostId?: string | null;
  refresh?: boolean;
}) {
  const response = await invoke<RecommendedSkillsResponse>("recommended-skills", {
    params: {
      hostId: params?.hostId ?? null,
      refresh: params?.refresh ?? false,
    },
  });

  return {
    error: response.error,
    repoRoot: response.repoRoot,
    skills: response.skills.map((skill) => ({
      description: skill.description,
      iconLarge: skill.iconLarge,
      iconSmall: skill.iconSmall,
      id: skill.id,
      name: skill.name,
      repoPath: skill.repoPath,
      shortDescription: skill.shortDescription,
    })),
  } satisfies {
    error: string | null;
    repoRoot: string | null;
    skills: RecommendedSkill[];
  };
}

export async function installRecommendedSkill(params: {
  hostId?: string | null;
  installRoot?: string | null;
  repoPath: string;
  skillId: string;
}) {
  return invoke<InstallRecommendedSkillResponse>("install-recommended-skill", {
    params: {
      hostId: params.hostId ?? null,
      installRoot: params.installRoot ?? null,
      repoPath: params.repoPath,
      skillId: params.skillId,
    },
  });
}

export async function removeSkill(params: {
  hostId?: string | null;
  skillPath: string;
}) {
  return invoke("remove-skill", {
    params: {
      hostId: params.hostId ?? null,
      skillPath: params.skillPath,
    },
  });
}
