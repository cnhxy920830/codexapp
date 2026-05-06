import { invoke } from "@tauri-apps/api/core";

export type WorkspaceAgentsMdDocument = {
  path: string;
  contents: string;
};

export type ExperimentalFeature = {
  name: string;
  stage: string;
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
};

export async function readWorkspaceAgentsMd(workspaceRoot: string | null) {
  return invoke<WorkspaceAgentsMdDocument | null>("read_workspace_agents_md", {
    params: { workspaceRoot },
  });
}

export async function writeWorkspaceAgentsMd(params: {
  workspaceRoot: string | null;
  contents: string;
}) {
  return invoke<WorkspaceAgentsMdDocument>("write_workspace_agents_md", { params });
}

export async function listExperimentalFeatures() {
  return invoke<ExperimentalFeature[]>("list_experimental_features");
}

export async function setExperimentalFeatureEnablement(enablement: Record<string, boolean>) {
  return invoke<void>("set_experimental_feature_enablement", {
    params: { enablement },
  });
}

export async function resetMemories() {
  return invoke<void>("reset_memories");
}
