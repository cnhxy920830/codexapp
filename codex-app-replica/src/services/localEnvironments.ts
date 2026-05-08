import { invoke } from "@tauri-apps/api/core";

export const LOCAL_ENVIRONMENT_HOST_ID = "local";
export const LOCAL_ENVIRONMENT_SETUP_PLACEHOLDER = `cd "$CODEX_WORKTREE_PATH"
pip install -r requirements.txt
npm install
./run/setup.sh`;
export const LOCAL_ENVIRONMENT_ACTION_PLACEHOLDER = "npm run dev";
export const LOCAL_ENVIRONMENT_CLEANUP_PLACEHOLDER = `docker compose down --remove-orphans
rm -rf .cache/tmp`;

export const LOCAL_ENVIRONMENT_PLATFORMS = ["darwin", "linux", "win32"] as const;
export const LOCAL_ENVIRONMENT_ACTION_ICONS = ["tool", "run", "debug", "test"] as const;

export type LocalEnvironmentPlatform = (typeof LOCAL_ENVIRONMENT_PLATFORMS)[number];
export type LocalEnvironmentActionIcon = (typeof LOCAL_ENVIRONMENT_ACTION_ICONS)[number];

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
  icon: LocalEnvironmentActionIcon | null;
  command: string;
  platform: LocalEnvironmentPlatform | null;
};

export type LocalEnvironmentDocument = {
  version: number;
  name: string;
  setup: LocalEnvironmentScriptSection;
  cleanup: LocalEnvironmentScriptSection;
  actions: LocalEnvironmentAction[];
};

export type LocalEnvironmentSuccessEntry = {
  configPath: string;
  type: "success";
  environment: LocalEnvironmentDocument;
};

export type LocalEnvironmentErrorEntry = {
  configPath: string;
  type: "error";
  error: {
    message: string;
  };
};

export type LocalEnvironmentConfigEntry = LocalEnvironmentSuccessEntry | LocalEnvironmentErrorEntry;

export type LocalEnvironmentsListResponse = {
  environments: LocalEnvironmentConfigEntry[];
};

export type LocalEnvironmentResponse = {
  environment: LocalEnvironmentConfigEntry;
};

export type LocalEnvironmentConfigResponse = {
  configPath: string;
  exists: boolean;
  raw: string | null;
};

export type LocalEnvironmentConfigSaveResponse = {
  configPath: string;
  success: boolean;
};

export async function listLocalEnvironments(params: { hostId?: string | null; workspaceRoot: string }) {
  return invoke<LocalEnvironmentsListResponse>("local-environments", {
    params: {
      hostId: normalizeHostId(params.hostId),
      workspaceRoot: params.workspaceRoot,
    },
  });
}

export async function readLocalEnvironment(params: { hostId?: string | null; configPath: string }) {
  return invoke<LocalEnvironmentResponse>("local-environment", {
    params: {
      hostId: normalizeHostId(params.hostId),
      configPath: params.configPath,
    },
  });
}

export async function readLocalEnvironmentConfig(params: { hostId?: string | null; configPath: string }) {
  return invoke<LocalEnvironmentConfigResponse>("local-environment-config", {
    params: {
      hostId: normalizeHostId(params.hostId),
      configPath: params.configPath,
    },
  });
}

export async function writeLocalEnvironmentConfig(params: {
  hostId?: string | null;
  configPath: string;
  raw: string;
}) {
  return invoke<LocalEnvironmentConfigSaveResponse>("local-environment-config-save", {
    params: {
      hostId: normalizeHostId(params.hostId),
      configPath: params.configPath,
      raw: params.raw,
    },
  });
}

export function getPreferredLocalEnvironment(entries: LocalEnvironmentConfigEntry[]) {
  return (
    entries.find((entry) => getConfigFileName(entry.configPath) === "environment.toml" && entry.type === "success") ??
    entries.find((entry) => entry.type === "success") ??
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

export function createDefaultLocalEnvironmentDocument(workspaceRoot: string) {
  return {
    version: 1,
    name: getLocalEnvironmentProjectName(workspaceRoot) || "local",
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

export function getLocalEnvironmentOwnerRoot(configPath: string) {
  const normalized = normalizePathForComparison(configPath);
  const marker = "/.codex/environments/";
  const markerIndex = normalized.lastIndexOf(marker);
  return markerIndex === -1 ? normalized : normalized.slice(0, markerIndex);
}

export function getConfigFileName(configPath: string) {
  const normalized = normalizePathForComparison(configPath);
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? normalized;
}

export function getScriptForPlatform(
  section: LocalEnvironmentScriptSection,
  platform: LocalEnvironmentPlatform | "default",
) {
  if (platform === "default") {
    return section.script;
  }
  return section[platform]?.script ?? "";
}

export function renderLocalEnvironmentDocument(document: LocalEnvironmentDocument) {
  const actions = normalizeActions(document.actions);
  const output: string[] = [];

  output.push("# THIS IS AUTOGENERATED. DO NOT EDIT MANUALLY");
  output.push(`version = ${document.version || 1}`);
  output.push(`name = ${quoteTomlString(document.name)}`);

  renderScriptSection(output, "setup", normalizeScriptSection(document.setup));
  renderScriptSection(output, "cleanup", normalizeScriptSection(document.cleanup));

  if (actions.length > 0) {
    output.push("");
    for (const action of actions) {
      output.push("[[actions]]");
      output.push(`name = ${quoteTomlString(action.name)}`);
      if (action.icon) {
        output.push(`icon = ${quoteTomlString(action.icon)}`);
      }
      output.push(`command = ${quoteTomlString(action.command)}`);
      if (action.platform) {
        output.push(`platform = ${quoteTomlString(action.platform)}`);
      }
      output.push("");
    }
  }

  return `${output.join("\n").trimEnd()}\n`;
}

export function normalizePathForComparison(path: string) {
  return path.replace(/\\/g, "/");
}

export function getLocalEnvironmentProjectName(workspaceRoot: string | null | undefined, label?: string | null) {
  if (label && label.trim().length > 0) {
    return trimProjectLabel(label);
  }
  if (!workspaceRoot) {
    return null;
  }

  const trimmedPath = workspaceRoot.trim();
  if (!trimmedPath) {
    return null;
  }

  const segments = normalizePathForComparison(trimmedPath).split("/").filter(Boolean);
  return trimProjectLabel(segments.at(-1) ?? trimmedPath);
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : LOCAL_ENVIRONMENT_HOST_ID;
}

function normalizeActions(actions: LocalEnvironmentAction[]) {
  return actions.flatMap((action) => {
    const name = action.name.trim();
    const command = action.command.trim();
    if (!name || !command) {
      return [];
    }

    const icon = action.icon?.trim() || null;
    const platform = action.platform?.trim() || null;
    return [
      {
        ...action,
        name,
        command,
        icon: isActionIcon(icon) ? icon : null,
        platform: isPlatform(platform) ? platform : null,
      },
    ];
  });
}

function normalizeScriptSection(section: LocalEnvironmentScriptSection): LocalEnvironmentScriptSection {
  return {
    script: section.script,
    darwin: section.darwin?.script.length ? section.darwin : null,
    linux: section.linux?.script.length ? section.linux : null,
    win32: section.win32?.script.length ? section.win32 : null,
  };
}

function renderScriptSection(
  output: string[],
  sectionName: "setup" | "cleanup",
  section: LocalEnvironmentScriptSection,
) {
  const platformOverrides = LOCAL_ENVIRONMENT_PLATFORMS.flatMap((platform) => {
    const script = section[platform]?.script ?? "";
    return script.length > 0 ? [{ platform, script }] : [];
  });

  if (sectionName === "setup" || section.script.length > 0 || platformOverrides.length > 0) {
    output.push("");
    output.push(`[${sectionName}]`);
    output.push(`script = ${quoteTomlString(section.script)}`);
  }

  if (platformOverrides.length === 0) {
    return;
  }

  output.push("");
  platformOverrides.forEach((override, index) => {
    output.push(`[${sectionName}.${override.platform}]`);
    output.push(`script = ${quoteTomlString(override.script)}`);
    if (index < platformOverrides.length - 1) {
      output.push("");
    }
  });
}

function quoteTomlString(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  if (normalized.includes("\n")) {
    if (normalized.includes("'''")) {
      return `"""\n${normalized.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""')}\n"""`;
    }
    return `'''\n${normalized}\n'''`;
  }

  return JSON.stringify(normalized);
}

function joinNormalizedPath(basePath: string, relativePath: string) {
  const base = basePath.replace(/[\\/]+$/, "");
  const relative = relativePath.replace(/^[\\/]+/, "");
  return `${base}/${relative}`;
}

function trimProjectLabel(value: string) {
  const trimmedValue = value.trim();
  const words = trimmedValue.split(/\s+/).filter(Boolean);
  return words.length <= 3 ? trimmedValue : words.slice(0, 3).join(" ");
}

function isActionIcon(value: string | null): value is LocalEnvironmentActionIcon {
  return value !== null && LOCAL_ENVIRONMENT_ACTION_ICONS.includes(value as LocalEnvironmentActionIcon);
}

function isPlatform(value: string | null): value is LocalEnvironmentPlatform {
  return value !== null && LOCAL_ENVIRONMENT_PLATFORMS.includes(value as LocalEnvironmentPlatform);
}
