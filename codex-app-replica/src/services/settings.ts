import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_LOCALE, resolveSupportedLocale, type LocaleCode } from "../i18n/messages";

export type ConfigReadResponse = {
  config: ConfigSnapshot;
  origins: Record<string, ConfigLayerMetadata>;
  layers: ConfigLayer[] | null;
};

export type ConfigSnapshot = {
  approvalPolicy: string | null;
  sandboxMode: string | null;
  sandboxWorkspaceWrite: SandboxWorkspaceWrite | null;
};

export type SandboxWorkspaceWrite = {
  networkAccess: boolean;
};

export type ConfigLayerMetadata = {
  name: ConfigLayerSource;
  version: string;
};

export type ConfigLayerSource =
  | { type: "mdm"; domain: string; key: string }
  | { type: "system"; file: string }
  | { type: "user"; file: string }
  | { type: "project"; dotCodexFolder: string }
  | { type: "sessionFlags" }
  | { type: "legacyManagedConfigTomlFromFile"; file: string }
  | { type: "legacyManagedConfigTomlFromMdm" };

export type ConfigLayer = {
  name: ConfigLayerSource;
  version: string;
  config: unknown;
  disabledReason: string | null;
};

export type GlobalStateKey = "usePointerCursors" | "sansFontSize" | "codeFontSize" | "localeOverride";

export type GlobalStateValue = boolean | number | string | null;

export type GeneralSettingsSnapshot = {
  usePointerCursors: boolean;
  uiFontSize: number;
  codeFontSize: number;
  localeOverride: string | null;
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsSnapshot = {
  usePointerCursors: true,
  uiFontSize: 14,
  codeFontSize: 12,
  localeOverride: null,
};

export type ConfigScopeOption = {
  key: string;
  kind: "project" | "user" | "managed";
  label: string;
  filePath: string | null;
  expectedVersion: string | null;
  workspaceRoot: string | null;
  disabledReason: string | null;
  config: ConfigSnapshot | null;
};

export async function readConfig(cwd: string | null = null) {
  return invoke<ConfigReadResponse>("read_config", { cwd });
}

export async function writeConfigValue(params: {
  keyPath: string;
  value: unknown;
  mergeStrategy: "upsert" | "replace";
  filePath?: string | null;
  expectedVersion?: string | null;
}) {
  return invoke<void>("write_config_value", { params });
}

export function buildConfigScopeOptions(response: ConfigReadResponse) {
  const layers = response.layers ?? [];
  const options: ConfigScopeOption[] = [];

  for (const layer of layers) {
    if (layer.name.type === "project") {
      const workspaceRoot = trimDotCodexFolder(layer.name.dotCodexFolder);
      options.push({
        key: `project:${workspaceRoot ?? layer.name.dotCodexFolder}`,
        kind: "project",
        label: deriveProjectLabel(workspaceRoot ?? layer.name.dotCodexFolder),
        filePath: buildProjectConfigPath(layer.name.dotCodexFolder),
        expectedVersion: layer.version,
        workspaceRoot,
        disabledReason: layer.disabledReason,
        config: parseLayerConfig(layer.config),
      });
    }
  }

  const userLayer = layers.find((layer) => layer.name.type === "user");
  if (userLayer && userLayer.name.type === "user") {
    options.push({
      key: "user",
      kind: "user",
      label: "User config",
      filePath: userLayer.name.file,
      expectedVersion: userLayer.version,
      workspaceRoot: null,
      disabledReason: userLayer.disabledReason,
      config: parseLayerConfig(userLayer.config),
    });
  } else {
    options.push({
      key: "user",
      kind: "user",
      label: "User config",
      filePath: null,
      expectedVersion: null,
      workspaceRoot: null,
      disabledReason: null,
      config: null,
    });
  }

  const managedLayer = layers.find(
    (layer) => layer.name.type === "system" || layer.name.type === "mdm" || layer.name.type === "legacyManagedConfigTomlFromFile",
  );
  if (managedLayer) {
    options.push({
      key: "managed",
      kind: "managed",
      label: "Admin config",
      filePath: resolveLayerFilePath(managedLayer.name),
      expectedVersion: managedLayer.version,
      workspaceRoot: null,
      disabledReason: managedLayer.disabledReason,
      config: parseLayerConfig(managedLayer.config),
    });
  }

  return options;
}

export function chooseDefaultConfigScopeKey(options: ConfigScopeOption[]) {
  return options.find((scope) => scope.kind === "project")?.key ?? options[0]?.key ?? "user";
}

export async function getGlobalState(key: GlobalStateKey) {
  return invoke<{ value: GlobalStateValue }>("get_global_state", { key });
}

export async function setGlobalState(key: GlobalStateKey, value: GlobalStateValue) {
  return invoke<void>("set_global_state", { key, value });
}

export async function readGeneralSettingsSnapshot(): Promise<GeneralSettingsSnapshot> {
  const [localeOverride, usePointerCursors, uiFontSize, codeFontSize] = await Promise.all([
    getGlobalState("localeOverride"),
    getGlobalState("usePointerCursors"),
    getGlobalState("sansFontSize"),
    getGlobalState("codeFontSize"),
  ]);
  return {
    localeOverride: typeof localeOverride.value === "string" ? localeOverride.value : DEFAULT_GENERAL_SETTINGS.localeOverride,
    usePointerCursors:
      typeof usePointerCursors.value === "boolean"
        ? usePointerCursors.value
        : DEFAULT_GENERAL_SETTINGS.usePointerCursors,
    uiFontSize: typeof uiFontSize.value === "number" ? uiFontSize.value : DEFAULT_GENERAL_SETTINGS.uiFontSize,
    codeFontSize:
      typeof codeFontSize.value === "number" ? codeFontSize.value : DEFAULT_GENERAL_SETTINGS.codeFontSize,
  };
}

export function applyGeneralSettingsSnapshot(settings: GeneralSettingsSnapshot) {
  document.documentElement.style.setProperty("--app-shell-ui-font-size", `${settings.uiFontSize}px`);
  document.documentElement.style.setProperty("--app-shell-code-font-size", `${settings.codeFontSize}px`);
  document.documentElement.classList.toggle("app-no-pointer-cursors", !settings.usePointerCursors);
}

export function resolveLocalePreference(value: unknown): LocaleCode {
  return resolveSupportedLocale(value) ?? resolveSupportedLocale(navigator.language) ?? DEFAULT_LOCALE;
}

export function parseLayerConfig(config: unknown): ConfigSnapshot | null {
  if (!config || Array.isArray(config) || typeof config !== "object") {
    return null;
  }
  const value = config as {
    approval_policy?: unknown;
    sandbox_mode?: unknown;
    sandbox_workspace_write?: { network_access?: unknown } | unknown;
  };
  const sandboxWorkspaceWriteValue = value.sandbox_workspace_write;
  const networkAccess =
    sandboxWorkspaceWriteValue &&
    typeof sandboxWorkspaceWriteValue === "object" &&
    !Array.isArray(sandboxWorkspaceWriteValue) &&
    "network_access" in sandboxWorkspaceWriteValue &&
    typeof sandboxWorkspaceWriteValue.network_access === "boolean"
      ? sandboxWorkspaceWriteValue.network_access
      : null;
  return {
    approvalPolicy: normalizeApprovalPolicy(value.approval_policy),
    sandboxMode: normalizeSandboxMode(value.sandbox_mode),
    sandboxWorkspaceWrite: networkAccess === null ? null : { networkAccess },
  };
}

function deriveProjectLabel(path: string) {
  const segments = path.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? path;
}

function trimDotCodexFolder(path: string) {
  return path.endsWith("/.codex") || path.endsWith("\\.codex") ? path.slice(0, -7) : null;
}

function buildProjectConfigPath(dotCodexFolder: string) {
  const slash = dotCodexFolder.includes("\\") ? "\\" : "/";
  return `${dotCodexFolder}${slash}config.toml`;
}

function resolveLayerFilePath(name: ConfigLayerSource) {
  if (name.type === "system" || name.type === "legacyManagedConfigTomlFromFile") {
    return name.file;
  }
  return null;
}

function normalizeApprovalPolicy(value: unknown) {
  return value === "untrusted" || value === "on-failure" || value === "on-request" || value === "never"
    ? value
    : null;
}

function normalizeSandboxMode(value: unknown) {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access" ? value : null;
}
