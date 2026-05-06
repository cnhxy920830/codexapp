import { invoke } from "@tauri-apps/api/core";

export type LocalEnvironmentPlatform = "darwin" | "linux" | "win32";

export type LocalEnvironmentPlatformScript = {
  script: string;
};

export type LocalEnvironmentScriptSection = {
  script: string;
  darwin: LocalEnvironmentPlatformScript | null;
  linux: LocalEnvironmentPlatformScript | null;
  win32: LocalEnvironmentPlatformScript | null;
};

export type LocalEnvironmentAction = {
  name: string;
  icon: string | null;
  command: string;
  platform: string | null;
};

export type LocalEnvironmentDocument = {
  version: number;
  name: string;
  setup: LocalEnvironmentScriptSection;
  cleanup: LocalEnvironmentScriptSection;
  actions: LocalEnvironmentAction[];
};

export type LocalEnvironmentConfigEntry = {
  configPath: string;
  fileName: string;
  environment: LocalEnvironmentDocument | null;
  parseError: string | null;
};

export type LocalEnvironmentGroup = {
  path: string;
  label: string;
  isCurrentRoot: boolean;
  environments: LocalEnvironmentConfigEntry[];
};

export type LocalEnvironmentsListResponse = {
  workspaceRoot: string;
  groups: LocalEnvironmentGroup[];
};

export type LocalEnvironmentConfigResponse = {
  configPath: string;
  exists: boolean;
  environment: LocalEnvironmentDocument;
  parseError: string | null;
};

export async function listLocalEnvironments(workspaceRoot: string) {
  return invoke<LocalEnvironmentsListResponse>("list_local_environments", {
    params: { workspaceRoot },
  });
}

export async function readLocalEnvironmentConfig(params: { workspaceRoot: string; configPath: string }) {
  return invoke<LocalEnvironmentConfigResponse>("read_local_environment_config", { params });
}

export async function writeLocalEnvironmentConfig(params: {
  workspaceRoot: string;
  configPath: string;
  environment: LocalEnvironmentDocument;
}) {
  return invoke<LocalEnvironmentConfigResponse>("write_local_environment_config", { params });
}

export function getPreferredLocalEnvironment(entries: LocalEnvironmentConfigEntry[]) {
  return (
    entries.find((entry) => getConfigFileName(entry.configPath) === "environment.toml" && entry.environment !== null) ??
    entries.find((entry) => entry.environment !== null) ??
    entries[0] ??
    null
  );
}

export function createDefaultLocalEnvironmentConfigPath(
  entries: LocalEnvironmentConfigEntry[],
  workspaceRoot: string,
) {
  const environmentsDir = joinNormalizedPath(workspaceRoot, ".codex/environments");
  const existingPaths = new Set(entries.map((entry) => normalizePathForComparison(entry.configPath)));
  const defaultPath = joinNormalizedPath(environmentsDir, "environment.toml");
  if (!existingPaths.has(normalizePathForComparison(defaultPath))) {
    return defaultPath;
  }

  let suffix = 2;
  for (;;) {
    const candidate = joinNormalizedPath(environmentsDir, `environment-${suffix}.toml`);
    if (!existingPaths.has(normalizePathForComparison(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}

export function createDefaultLocalEnvironmentDocument(configPath: string) {
  return {
    version: 1,
    name: deriveWorkspaceLabelFromConfigPath(configPath),
    setup: createEmptyScriptSection(),
    cleanup: createEmptyScriptSection(),
    actions: [],
  } satisfies LocalEnvironmentDocument;
}

export function createEmptyScriptSection(): LocalEnvironmentScriptSection {
  return {
    script: "",
    darwin: null,
    linux: null,
    win32: null,
  };
}

export function getConfigFileName(configPath: string) {
  const normalized = normalizePathForComparison(configPath);
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? normalized;
}

export function deriveWorkspaceLabelFromConfigPath(configPath: string) {
  const normalized = normalizePathForComparison(configPath);
  const marker = "/.codex/environments/";
  const markerIndex = normalized.lastIndexOf(marker);
  const ownerPath = markerIndex === -1 ? normalized : normalized.slice(0, markerIndex);
  const segments = ownerPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "local";
}

export function normalizePathForComparison(path: string) {
  return path.replace(/\\/g, "/");
}

function joinNormalizedPath(basePath: string, relativePath: string) {
  const base = basePath.replace(/[\\/]+$/, "");
  const relative = relativePath.replace(/^[\\/]+/, "");
  return `${base}/${relative}`;
}
