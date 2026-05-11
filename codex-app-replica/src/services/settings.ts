import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_LOCALE, resolveSupportedLocale, type LocaleCode } from "../i18n/messages";
import {
  applyAppearanceCssVariables,
  cloneAppearanceChromeTheme,
  DEFAULT_APPEARANCE_CODE_THEME_ID,
  DEFAULT_CHROME_THEME_BY_VARIANT,
  type AppearanceChromeTheme,
  type AppearanceCodeThemeId,
  type AppearanceVariant,
  normalizeAppearanceChromeTheme,
  normalizeAppearanceCodeThemeId,
} from "./appearanceThemes";

export type ConfigReadResponse = {
  config: ConfigSnapshot;
  origins: Record<string, ConfigLayerMetadata>;
  layers: ConfigLayer[] | null;
};

export type ConfigSnapshot = {
  approvalPolicy: string | null;
  sandboxMode: string | null;
  sandboxWorkspaceWrite: SandboxWorkspaceWrite | null;
  personality: ConfigPersonality | null;
  modelPersonality: ConfigPersonality | null;
  memories: MemoriesConfigSnapshot | null;
  mcpServers: Record<string, unknown> | null;
};

export type SandboxWorkspaceWrite = {
  networkAccess: boolean;
};

export type MemoriesConfigSnapshot = {
  generateMemories: boolean;
  useMemories: boolean;
  disableOnExternalContext: boolean;
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

export type FollowUpQueueMode = "queue" | "steer";
export type ReviewDelivery = "inline" | "detached";
export type AppearanceTheme = "light" | "dark" | "system";
export type ResolvedAppearanceTheme = Exclude<AppearanceTheme, "system">;
export type ComposerEnterBehavior = "enter" | "cmdIfMultiline";
export type IntegratedTerminalShell = "powershell" | "commandPrompt" | "gitBash" | "wsl";
export type ConfigPersonality = "friendly" | "pragmatic" | "none";

export type TerminalShellOptionsResponse = {
  availableShells: IntegratedTerminalShell[];
};

export type WslBashAvailabilityResponse = {
  available: boolean;
  distro: string | null;
};

const SYSTEM_APPEARANCE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

let removeSystemAppearanceThemeListener: (() => void) | null = null;

export type GlobalStateKey =
  | "usePointerCursors"
  | "sansFontSize"
  | "codeFontSize"
  | "conversationDetailMode"
  | "localeOverride"
  | "viewed2025-09-15-nux"
  | "viewed2025-09-15-full-chatgpt-auth-nux"
  | "viewed2025-09-15-apikey-auth-nux"
  | "appearanceTheme"
  | "appearanceLightChromeTheme"
  | "appearanceDarkChromeTheme"
  | "appearanceLightCodeThemeId"
  | "appearanceDarkCodeThemeId"
  | "selected-avatar-id"
  | "composerEnterBehavior"
  | "integratedTerminalShell"
  | "preventSleepWhileRunning"
  | "runCodexInWindowsSubsystemForLinux"
  | "followUpQueueMode"
  | "reviewDelivery"
  | "electron:onboarding-override"
  | "electron:onboarding-welcome-pending"
  | "electron:onboarding-projectless-completed"
  | "electron:onboarding-hide-first-new-thread-promos"
  | "electron:onboarding-plugin-checklist-active"
  | "electron:onboarding-primary-runtime-install-requested"
  | "electron:onboarding-primary-runtime-install-ready"
  | "electron:onboarding-workspace-experiment-assignment"
  | "electron:onboarding-workspace-autolaunch-applied"
  | "electron:onboarding-welcome-v2-state"
  | "electron:onboarding-welcome-v2-role-state"
  | "electron:onboarding-welcome-v2-role-selection-debug-override"
  | "last_completed_onboarding"
  | "git-branch-prefix"
  | "git-always-force-push"
  | "git-create-pull-request-as-draft"
  | "git-pull-request-merge-method"
  | "git-show-sidebar-pr-icons"
  | "git-commit-instructions"
  | "git-pr-instructions"
  | "worktree-auto-cleanup-enabled"
  | "worktree-auto-cleanup-unpackaged-override-enabled"
  | "worktree-keep-count";

export type GlobalStateValue = boolean | number | string | Record<string, unknown> | null;

export type GeneralSettingsSnapshot = {
  usePointerCursors: boolean;
  uiFontSize: number;
  codeFontSize: number;
  localeOverride: string | null;
  appearanceTheme: AppearanceTheme;
  composerEnterBehavior: ComposerEnterBehavior;
  integratedTerminalShell: IntegratedTerminalShell;
  preventSleepWhileRunning: boolean;
  runCodexInWindowsSubsystemForLinux: boolean;
  followUpQueueMode: FollowUpQueueMode;
  reviewDelivery: ReviewDelivery;
};

export type AppearanceSettingsSnapshot = GeneralSettingsSnapshot & {
  darkChromeTheme: AppearanceChromeTheme;
  darkCodeThemeId: AppearanceCodeThemeId;
  lightChromeTheme: AppearanceChromeTheme;
  lightCodeThemeId: AppearanceCodeThemeId;
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsSnapshot = {
  usePointerCursors: true,
  uiFontSize: 14,
  codeFontSize: 12,
  localeOverride: null,
  appearanceTheme: "system",
  composerEnterBehavior: "enter",
  integratedTerminalShell: "powershell",
  preventSleepWhileRunning: false,
  runCodexInWindowsSubsystemForLinux: false,
  followUpQueueMode: "queue",
  reviewDelivery: "inline",
};

export type GlobalStateUpdatedNotification = {
  keys: string[];
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettingsSnapshot = {
  ...DEFAULT_GENERAL_SETTINGS,
  darkChromeTheme: cloneAppearanceChromeTheme(DEFAULT_CHROME_THEME_BY_VARIANT.dark),
  darkCodeThemeId: DEFAULT_APPEARANCE_CODE_THEME_ID,
  lightChromeTheme: cloneAppearanceChromeTheme(DEFAULT_CHROME_THEME_BY_VARIANT.light),
  lightCodeThemeId: DEFAULT_APPEARANCE_CODE_THEME_ID,
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

export type ConfigWriteTarget = {
  filePath: string | null;
  expectedVersion: string | null;
};

export type ConfigWriteEdit = {
  keyPath: string;
  value: unknown;
  mergeStrategy: "upsert" | "replace";
};

export type BatchWriteConfigParams = {
  edits: ConfigWriteEdit[];
  filePath?: string | null;
  expectedVersion?: string | null;
  reloadUserConfig?: boolean;
};

export type BatchWriteConfigForHostParams = BatchWriteConfigParams & {
  hostId?: string | null;
};

export type ConfigReadForHostParams = {
  hostId?: string | null;
  cwd?: string | null;
  includeLayers?: boolean;
};

export type ConfigWriteForHostParams = {
  hostId?: string | null;
  keyPath: string;
  value: unknown;
  mergeStrategy: "upsert" | "replace";
  filePath?: string | null;
  expectedVersion?: string | null;
};

export type ThirdPartyNoticesResponse = {
  text: string | null;
};

const THIRD_PARTY_NOTICES_STALE_MS = 60_000;

let thirdPartyNoticesCache:
  | {
      response: ThirdPartyNoticesResponse;
      loadedAt: number;
    }
  | null = null;

export async function readConfig(cwd: string | null = null) {
  return invoke<ConfigReadResponse>("read_config", { cwd });
}

export async function readConfigForHost(params: ConfigReadForHostParams) {
  const { cwd = null, hostId, includeLayers = true } = params;
  return invoke<ConfigReadResponse>("read-config-for-host", {
    params: {
      hostId: normalizeHostId(hostId),
      cwd,
      includeLayers,
    },
  });
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

export async function writeConfigValueForHost(params: ConfigWriteForHostParams) {
  return invoke<void>("write-config-value", {
    params: {
      ...params,
      hostId: normalizeHostId(params.hostId),
    },
  });
}

export async function batchWriteConfigValues(params: BatchWriteConfigParams) {
  return invoke<void>("batch_write_config_values", { params });
}

export async function batchWriteConfigValueForHost(params: BatchWriteConfigForHostParams) {
  return invoke<void>("batch-write-config-value", { params });
}

export async function setPersonality(personality: ConfigPersonality | null) {
  return invoke<void>("set_personality", { personality });
}

export function peekThirdPartyNotices() {
  if (
    thirdPartyNoticesCache == null ||
    Date.now() - thirdPartyNoticesCache.loadedAt >= THIRD_PARTY_NOTICES_STALE_MS
  ) {
    return null;
  }

  return thirdPartyNoticesCache.response;
}

export async function readThirdPartyNotices() {
  const cached = peekThirdPartyNotices();
  if (cached != null) {
    return cached;
  }

  const response = await invoke<ThirdPartyNoticesResponse>("third-party-notices");
  thirdPartyNoticesCache = {
    response,
    loadedAt: Date.now(),
  };
  return response;
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

export function resolveUserConfigWriteTarget(response: ConfigReadResponse): ConfigWriteTarget | null {
  const userLayer = response.layers?.find((layer) => layer.name.type === "user");
  if (!userLayer || userLayer.name.type !== "user") {
    return null;
  }

  return {
    filePath: userLayer.name.file,
    expectedVersion: userLayer.version,
  };
}

export function resolveConfigWriteTargetForKeyPath(
  response: ConfigReadResponse,
  keyPath: string,
  probeFields: string[] = [],
): ConfigWriteTarget | null {
  const userWriteTarget = resolveUserConfigWriteTarget(response);
  if (userWriteTarget) {
    return userWriteTarget;
  }

  const origin = findConfigOrigin(response.origins, keyPath, probeFields);
  if (origin) {
    if (isNonWritableConfigSource(origin.name)) {
      return null;
    }
    if (origin.name.type === "system") {
      return userWriteTarget;
    }
    const filePath = resolveWritableConfigSourcePath(origin.name);
    return filePath
      ? {
          filePath,
          expectedVersion: origin.version,
        }
      : userWriteTarget;
  }

  const fallbackLayer = response.layers?.[0];
  if (!fallbackLayer) {
    return null;
  }

  const filePath = resolveWritableConfigSourcePath(fallbackLayer.name);
  return filePath
    ? {
        filePath,
        expectedVersion: fallbackLayer.version,
      }
    : null;
}

export function resolveConfigChildOrigins(
  response: ConfigReadResponse,
  rootKey: string,
  childKeys: string[],
  probeFields: string[] = [],
) {
  return Object.fromEntries(
    childKeys.map((childKey) => {
      const keyPath = `${rootKey}.${childKey}`;
      return [childKey, findConfigOrigin(response.origins, keyPath, probeFields)];
    }),
  ) as Record<string, ConfigLayerMetadata | null>;
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

export function onGlobalStateUpdated(handler: (notification: GlobalStateUpdatedNotification) => void) {
  return listen<GlobalStateUpdatedNotification>("global-state-updated", (event) => {
    handler(event.payload);
  });
}

export async function readTerminalShellOptions() {
  return invoke<TerminalShellOptionsResponse>("terminal-shell-options");
}

export async function readWslBashAvailability() {
  return invoke<WslBashAvailabilityResponse>("wsl-bash-availability");
}

export async function setPowerSaveBlocker(shouldBlock: boolean) {
  return invoke<void>("power-save-blocker-set", {
    params: {
      shouldBlock,
    },
  });
}

export async function readPreventSleepWhileRunningPreference() {
  const response = await getGlobalState("preventSleepWhileRunning");
  return response.value === true;
}

export async function readGeneralSettingsSnapshot(): Promise<GeneralSettingsSnapshot> {
  const [
    localeOverride,
    usePointerCursors,
    uiFontSize,
    codeFontSize,
    appearanceTheme,
    composerEnterBehavior,
    integratedTerminalShell,
    preventSleepWhileRunning,
    runCodexInWindowsSubsystemForLinux,
    followUpQueueMode,
    reviewDelivery,
  ] =
    await Promise.all([
      getGlobalState("localeOverride"),
      getGlobalState("usePointerCursors"),
      getGlobalState("sansFontSize"),
      getGlobalState("codeFontSize"),
      getGlobalState("appearanceTheme"),
      getGlobalState("composerEnterBehavior"),
      getGlobalState("integratedTerminalShell"),
      getGlobalState("preventSleepWhileRunning"),
      getGlobalState("runCodexInWindowsSubsystemForLinux"),
      getGlobalState("followUpQueueMode"),
      getGlobalState("reviewDelivery"),
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
    appearanceTheme: normalizeAppearanceTheme(appearanceTheme.value),
    composerEnterBehavior: normalizeComposerEnterBehavior(composerEnterBehavior.value),
    integratedTerminalShell: normalizeIntegratedTerminalShell(integratedTerminalShell.value),
    preventSleepWhileRunning:
      typeof preventSleepWhileRunning.value === "boolean"
        ? preventSleepWhileRunning.value
        : DEFAULT_GENERAL_SETTINGS.preventSleepWhileRunning,
    runCodexInWindowsSubsystemForLinux:
      typeof runCodexInWindowsSubsystemForLinux.value === "boolean"
        ? runCodexInWindowsSubsystemForLinux.value
        : DEFAULT_GENERAL_SETTINGS.runCodexInWindowsSubsystemForLinux,
    followUpQueueMode: normalizeFollowUpQueueMode(followUpQueueMode.value),
    reviewDelivery: normalizeReviewDelivery(reviewDelivery.value),
  };
}

export async function readAppearanceSettingsSnapshot(): Promise<AppearanceSettingsSnapshot> {
  const [
    generalSettings,
    lightChromeTheme,
    darkChromeTheme,
    lightCodeThemeId,
    darkCodeThemeId,
  ] = await Promise.all([
    readGeneralSettingsSnapshot(),
    getGlobalState("appearanceLightChromeTheme"),
    getGlobalState("appearanceDarkChromeTheme"),
    getGlobalState("appearanceLightCodeThemeId"),
    getGlobalState("appearanceDarkCodeThemeId"),
  ]);

  return {
    ...generalSettings,
    darkChromeTheme: normalizeAppearanceChromeTheme(darkChromeTheme.value, "dark"),
    darkCodeThemeId: normalizeAppearanceCodeThemeId(darkCodeThemeId.value, "dark"),
    lightChromeTheme: normalizeAppearanceChromeTheme(lightChromeTheme.value, "light"),
    lightCodeThemeId: normalizeAppearanceCodeThemeId(lightCodeThemeId.value, "light"),
  };
}

export async function readSelectedAvatarId() {
  const response = await getGlobalState("selected-avatar-id");
  return typeof response.value === "string" && response.value.length > 0 ? response.value : "codex";
}

export async function setSelectedAvatarId(value: string) {
  await setGlobalState("selected-avatar-id", value);
}

export function applyGeneralSettingsSnapshot(settings: GeneralSettingsSnapshot) {
  applySharedShellSettings(settings);
  applyAppearanceTheme(settings.appearanceTheme);
}

export function applyAppearanceSettingsSnapshot(settings: AppearanceSettingsSnapshot) {
  applySharedShellSettings(settings);
  applyAppearanceTheme(settings.appearanceTheme, {
    dark: settings.darkChromeTheme,
    light: settings.lightChromeTheme,
  });
}

function applySharedShellSettings(
  settings: Pick<GeneralSettingsSnapshot, "codeFontSize" | "uiFontSize" | "usePointerCursors">,
) {
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
    personality?: unknown;
    model_personality?: unknown;
    mcp_servers?: unknown;
    memories?:
      | {
          generate_memories?: unknown;
          use_memories?: unknown;
          disable_on_external_context?: unknown;
          no_memories_if_mcp_or_web_search?: unknown;
        }
      | unknown;
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
    personality: normalizeConfigPersonality(value.personality),
    modelPersonality: normalizeConfigPersonality(value.model_personality),
    memories: normalizeMemoriesConfig(value.memories),
    mcpServers:
      value.mcp_servers && typeof value.mcp_servers === "object" && !Array.isArray(value.mcp_servers)
        ? (value.mcp_servers as Record<string, unknown>)
        : null,
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

function resolveWritableConfigSourcePath(name: ConfigLayerSource) {
  if (name.type === "user" || name.type === "system" || name.type === "legacyManagedConfigTomlFromFile") {
    return resolveLayerFilePath(name);
  }
  if (name.type === "project") {
    return buildProjectConfigPath(name.dotCodexFolder);
  }
  return null;
}

function isNonWritableConfigSource(name: ConfigLayerSource | null | undefined) {
  if (!name) {
    return false;
  }
  return name.type === "mdm" ||
    name.type === "sessionFlags" ||
    name.type === "legacyManagedConfigTomlFromFile" ||
    name.type === "legacyManagedConfigTomlFromMdm";
}

function findConfigOrigin(
  origins: Record<string, ConfigLayerMetadata>,
  keyPath: string,
  probeFields: string[] = [],
) {
  const directOrigin = origins[keyPath];
  if (directOrigin) {
    return directOrigin;
  }

  for (const probeField of probeFields) {
    const origin = origins[`${keyPath}.${probeField}`];
    if (origin) {
      return origin;
    }
  }

  return null;
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeApprovalPolicy(value: unknown) {
  return value === "untrusted" || value === "on-failure" || value === "on-request" || value === "never"
    ? value
    : null;
}

function normalizeSandboxMode(value: unknown) {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access" ? value : null;
}

export function normalizeConfigPersonality(value: unknown): ConfigPersonality | null {
  return value === "friendly" || value === "pragmatic" || value === "none" ? value : null;
}

function normalizeFollowUpQueueMode(value: unknown): FollowUpQueueMode {
  if (value === "interrupt") {
    return "steer";
  }
  return value === "queue" || value === "steer" ? value : DEFAULT_GENERAL_SETTINGS.followUpQueueMode;
}

function normalizeReviewDelivery(value: unknown): ReviewDelivery {
  return value === "inline" || value === "detached" ? value : DEFAULT_GENERAL_SETTINGS.reviewDelivery;
}

function normalizeAppearanceTheme(value: unknown): AppearanceTheme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_GENERAL_SETTINGS.appearanceTheme;
}

function normalizeMemoriesConfig(value: unknown): MemoriesConfigSnapshot | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }
  const memoryConfig = value as {
    generate_memories?: unknown;
    use_memories?: unknown;
    disable_on_external_context?: unknown;
    no_memories_if_mcp_or_web_search?: unknown;
  };
  const generateMemories = memoryConfig.generate_memories === true;
  const useMemories = memoryConfig.use_memories === true;
  const disableOnExternalContext =
    memoryConfig.disable_on_external_context === true || memoryConfig.no_memories_if_mcp_or_web_search === true;
  return {
    generateMemories,
    useMemories,
    disableOnExternalContext,
  };
}

function normalizeComposerEnterBehavior(value: unknown): ComposerEnterBehavior {
  return value === "enter" || value === "cmdIfMultiline" ? value : DEFAULT_GENERAL_SETTINGS.composerEnterBehavior;
}

function normalizeIntegratedTerminalShell(value: unknown): IntegratedTerminalShell {
  return value === "powershell" || value === "commandPrompt" || value === "gitBash" || value === "wsl"
    ? value
    : DEFAULT_GENERAL_SETTINGS.integratedTerminalShell;
}

function applyAppearanceTheme(
  theme: AppearanceTheme,
  chromeThemes?: Record<AppearanceVariant, AppearanceChromeTheme>,
) {
  if (typeof document === "undefined") {
    return;
  }
  removeSystemAppearanceThemeListener?.();
  removeSystemAppearanceThemeListener = null;

  const applyResolvedTheme = () => {
    const resolvedTheme = resolveEffectiveAppearanceTheme(theme);
    if (chromeThemes) {
      applyAppearanceCssVariables(document.documentElement, resolvedTheme, chromeThemes[resolvedTheme]);
      return;
    }
    document.documentElement.classList.toggle("electron-dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("electron-light", resolvedTheme === "light");
  };

  applyResolvedTheme();

  if (theme === "system") {
    removeSystemAppearanceThemeListener = subscribeToSystemAppearanceTheme(applyResolvedTheme);
  }
}

function resolveEffectiveAppearanceTheme(theme: AppearanceTheme): ResolvedAppearanceTheme {
  return theme === "system" ? resolveCurrentSystemAppearanceTheme() : theme;
}

function resolveCurrentSystemAppearanceTheme(): ResolvedAppearanceTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(SYSTEM_APPEARANCE_MEDIA_QUERY).matches ? "dark" : "light";
}

function subscribeToSystemAppearanceTheme(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia(SYSTEM_APPEARANCE_MEDIA_QUERY);
  if (typeof mediaQuery.addEventListener === "function" && typeof mediaQuery.removeEventListener === "function") {
    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }
  if (typeof mediaQuery.addListener === "function" && typeof mediaQuery.removeListener === "function") {
    mediaQuery.addListener(onChange);
    return () => {
      mediaQuery.removeListener(onChange);
    };
  }
  return () => undefined;
}
