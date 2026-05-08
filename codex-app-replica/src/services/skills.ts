import { invoke } from "@tauri-apps/api/core";

export type SkillSummary = {
  cwd: string;
  name: string;
  displayName: string | null;
  description: string;
  shortDescription: string | null;
  path: string;
  scope: string;
  enabled: boolean;
};

type SkillsListResponse = {
  data: Array<{
    cwd: string;
    skills: Array<{
      name: string;
      description: string;
      shortDescription: string | null;
      interface: {
        displayName: string | null;
      } | null;
      path: string;
      scope: string;
      enabled: boolean;
    }>;
    errors: Array<{
      path: string;
      message: string;
    }>;
  }>;
};

export async function readSkillsSnapshot(cwd: string | null, forceReload = false): Promise<SkillSummary[]> {
  const response = await invoke<SkillsListResponse>("list_skills", {
    params: {
      cwd,
      forceReload,
    },
  });

  return response.data
    .flatMap((entry) =>
      entry.skills.map((skill) => ({
        cwd: entry.cwd,
        name: skill.name,
        displayName: skill.interface?.displayName ?? null,
        description: skill.description,
        shortDescription: skill.shortDescription,
        path: skill.path,
        scope: skill.scope,
        enabled: skill.enabled,
      })),
    )
    .sort((left, right) => {
      const leftName = (left.displayName ?? left.name).toLowerCase();
      const rightName = (right.displayName ?? right.name).toLowerCase();
      return leftName.localeCompare(rightName);
    });
}
