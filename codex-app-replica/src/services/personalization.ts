import { invoke } from "@tauri-apps/api/core";
import { batchWriteConfigValueForHost } from "./settings";

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

export type ChroniclePermissionStatus =
  | "granted"
  | "denied"
  | "restricted"
  | "not-determined"
  | "unknown";

export type ChronicleSidecarProcessState =
  | "disabled"
  | "starting"
  | "running"
  | "stopping"
  | "failed";

export type ChroniclePermissionsResponse = {
  accessibility: ChroniclePermissionStatus;
  screenRecording: ChroniclePermissionStatus;
  chronicleSidecarPresent: boolean;
  chronicleSidecarProcessState: ChronicleSidecarProcessState;
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

export async function listExperimentalFeaturesForHost(hostId?: string | null) {
  return invoke<ExperimentalFeature[]>("list-experimental-features-for-host", {
    params: {
      hostId,
    },
  });
}

export async function setExperimentalFeatureEnablement(enablement: Record<string, boolean>) {
  return invoke<void>("set_experimental_feature_enablement", {
    params: { enablement },
  });
}

export async function setLocalAppServerFeatureEnablement(params: {
  featureName: string;
  enabled: boolean;
}) {
  return invoke<void>("set-local-app-server-feature-enablement", {
    params,
  });
}

export async function setExperimentalFeatureForHost(
  hostId: string | null | undefined,
  featureName: string,
  enabled: boolean,
) {
  const normalizedHostId = hostId ?? "local";
  if (normalizedHostId === "local" && featureName === "remote_control") {
    await setLocalAppServerFeatureEnablement({
      featureName,
      enabled,
    });
    return;
  }

  await batchWriteConfigValueForHost({
    hostId: normalizedHostId,
    edits: [
      {
        keyPath: buildExperimentalFeatureConfigKeyPath(featureName),
        value: enabled,
        mergeStrategy: "upsert",
      },
    ],
    filePath: null,
    expectedVersion: null,
  });
}

export async function resetMemories() {
  return invoke<void>("reset_memories");
}

export async function readChroniclePermissions() {
  return invoke<ChroniclePermissionsResponse>("chronicle-permissions");
}

function buildExperimentalFeatureConfigKeyPath(featureName: string) {
  return featureName.startsWith("features.")
    ? featureName
    : `features.${featureName}`;
}
