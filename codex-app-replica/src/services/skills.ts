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

export type SkillSetEnabledParams = {
  enabled: boolean;
  hostId?: string | null;
  name?: string | null;
  path?: string | null;
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

type SkillsConfigWriteResponse = {
  effectiveEnabled: boolean;
};

type ReadSkillsSnapshotOptions = {
  forceReload?: boolean;
  hostId?: string | null;
};

export async function readSkillsSnapshot(
  cwd: string | null,
  forceReloadOrOptions: boolean | ReadSkillsSnapshotOptions = false,
): Promise<SkillSummary[]> {
  const { forceReload, hostId } =
    typeof forceReloadOrOptions === "boolean"
      ? {
          forceReload: forceReloadOrOptions,
          hostId: null,
        }
      : {
          forceReload: forceReloadOrOptions.forceReload ?? false,
          hostId: forceReloadOrOptions.hostId ?? null,
        };

  const response = await invoke<SkillsListResponse>("list_skills", {
    params: {
      cwd,
      forceReload,
      hostId,
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

export async function setSkillEnabled(params: SkillSetEnabledParams) {
  const { enabled, hostId, name, path } = params;
  const hasName = typeof name === "string" && name.trim().length > 0;
  const hasPath = typeof path === "string" && path.trim().length > 0;

  if (hasName === hasPath) {
    throw new Error("setSkillEnabled requires exactly one of path or name");
  }

  return invoke<SkillsConfigWriteResponse>("skills-config-write", {
    params: {
      enabled,
      hostId: hostId ?? null,
      name: hasName ? name : null,
      path: hasPath ? path : null,
    },
  });
}
