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

export type ConfigServiceTier = "fast" | "flex";
export type ConfigApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";
export type ConfigApprovalPolicyGranular = {
  granular: {
    sandbox_approval: boolean;
    rules: boolean;
    skill_approval: boolean;
    request_permissions: boolean;
    mcp_elicitations: boolean;
  };
};
export type ConfigApprovalPolicy =
  | "untrusted"
  | "on-failure"
  | "on-request"
  | "never"
  | ConfigApprovalPolicyGranular;

export type ConfigSnapshot = {
  approvalPolicy: ConfigApprovalPolicy | null;
  sandboxMode: string | null;
  sandboxWorkspaceWrite: SandboxWorkspaceWrite | null;
  approvalsReviewer: ConfigApprovalsReviewer | null;
  personality: ConfigPersonality | null;
  modelPersonality: ConfigPersonality | null;
  serviceTier: ConfigServiceTier | null;
  memories: MemoriesConfigSnapshot | null;
  mcpServers: Record<string, unknown> | null;
  features: Record<string, boolean> | null;
};

export type SandboxWorkspaceWrite = {
  writableRoots: string[] | null;
  excludeSlashTmp: boolean;
  excludeTmpdirEnvVar: boolean;
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
export type ConversationDetailMode = "STEPS_COMMANDS" | "STEPS_PROSE";
export type ConfigPersonality = "friendly" | "pragmatic" | "none";
export type ComposerPermissionMode = "guardian-approvals" | "full-access";
export type ComposerPermissionModeVisibility = Record<ComposerPermissionMode, boolean>;

export type TerminalShellOptionsResponse = {
  availableShells: IntegratedTerminalShell[];
};

export type ConfigRequirementsReadResponse = {
  requirements: ConfigRequirements | null;
};

export type ConfigurationValueResponse = {
  value: unknown;
};

export type ConfigRequirements = {
  allowedApprovalPolicies: unknown[] | null;
  allowedApprovalsReviewers: string[] | null;
  allowedSandboxModes: string[] | null;
  allowedWebSearchModes: string[] | null;
  featureRequirements: Record<string, boolean> | null;
  enforceResidency: string | null;
};

export type AgentSettingsNoticeLevel = "warning";
export type AgentSettingsNoticeKind = "configWarning" | "deprecationNotice";

export type AgentSettingsNoticeRange = {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  } | null;
};

export type AgentSettingsNotice = {
  details: string | null;
  kind: AgentSettingsNoticeKind;
  level: AgentSettingsNoticeLevel;
  path: string | null;
  range: AgentSettingsNoticeRange | null;
  summary: string;
};

export type AgentSettingsNoticesResponse = {
  notices: AgentSettingsNotice[];
};

export type AgentSettingsNoticesChangedNotification = {
  hostId: string;
  notices: AgentSettingsNotice[];
};

export type ModelListForHostParams = {
  hostId?: string | null;
  cursor?: string | null;
  limit?: number | null;
  includeHidden?: boolean | null;
};

export type ModelListEntry = {
  id: string;
  hidden: boolean;
  additionalSpeedTiers: string[];
};

export type ModelListResponse = {
  data: ModelListEntry[];
  nextCursor: string | null;
};

export type WslBashAvailabilityResponse = {
  available: boolean;
  distro: string | null;
};

export type HotkeyWindowHotkeyStateResponse = {
  supported: boolean;
  configuredHotkey: string | null;
  isGateEnabled: boolean;
  isDevMode: boolean;
  isDevOverrideEnabled: boolean;
  isActive: boolean;
};

export type SetHotkeyWindowHotkeyResponse = {
  success: boolean;
  error: string | null;
  state: HotkeyWindowHotkeyStateResponse;
};

export type GlobalDictationHotkeyStateResponse = {
  supported: boolean;
  configuredHotkey: string | null;
  configuredToggleHotkey: string | null;
};

export type SetGlobalDictationHotkeyResponse = {
  success: boolean;
  error: string | null;
  state: GlobalDictationHotkeyStateResponse;
};

export type GlobalDictationHistoryItem = {
  id: string;
  text: string;
  createdAtMs: number;
};

export type GlobalDictationHistoryResponse = {
  items: GlobalDictationHistoryItem[];
};

export type GpuTearingDebugSettingKey =
  | "disableScrollFadeMask"
  | "disableScrollFadeMaskAnimation"
  | "disableBackdropBlur"
  | "disableCssMotion"
  | "forceOpaqueRendererBackground";

export type GpuTearingDebugSettings = Record<GpuTearingDebugSettingKey, boolean>;

const SYSTEM_APPEARANCE_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const GPU_TEARING_DEBUG_SETTINGS_STORAGE_KEY = "gpu-tearing-debug-settings";
const GPU_TEARING_DEBUG_SETTINGS_CHANGED_EVENT =
  "codex-app-replica:gpu-tearing-debug-settings-changed";
const GPU_TEARING_DEBUG_DISABLE_SCROLL_FADE_MASK_CLASS =
  "app-gpu-tearing-debug-disable-scroll-fade-mask";
const GPU_TEARING_DEBUG_DISABLE_SCROLL_FADE_MASK_ANIMATION_CLASS =
  "app-gpu-tearing-debug-disable-scroll-fade-mask-animation";
const GPU_TEARING_DEBUG_DISABLE_BACKDROP_BLUR_CLASS =
  "app-gpu-tearing-debug-disable-backdrop-blur";
const GPU_TEARING_DEBUG_DISABLE_CSS_MOTION_CLASS =
  "app-gpu-tearing-debug-disable-css-motion";
const GPU_TEARING_DEBUG_FORCE_OPAQUE_RENDERER_BACKGROUND_CLASS =
  "app-gpu-tearing-debug-force-opaque-renderer-background";

let removeSystemAppearanceThemeListener: (() => void) | null = null;

export type GlobalStateKey =
  | "editorDiffViewMode"
  | "diffRichPreview"
  | "usePointerCursors"
  | "sansFontSize"
  | "codeFontSize"
  | "useFontSmoothing"
  | "pdf-preview-invert-colors"
  | "ambient-suggestions-enabled"
  | "active-remote-project-id"
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
  | "mac-menu-bar-enabled"
  | "selected-avatar-id"
  | "composerEnterBehavior"
  | "integratedTerminalShell"
  | "preventSleepWhileRunning"
  | "runCodexInWindowsSubsystemForLinux"
  | "followUpQueueMode"
  | "reviewDelivery"
  | "notifications-turn-mode"
  | "notifications-permissions-enabled"
  | "notifications-questions-enabled"
  | "chronicle-consent-accepted"
  | "chronicle-setup-completion-pending"
  | "browser-annotation-screenshots-mode"
  | "browser-sidebar-comment-mode-coachmark-dismissed"
  | "dictationDictionary"
  | "use-copilot-auth-if-available"
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
  | "has-seen-ambient-suggestions-connected-apps-consent"
  | "realtime-voice-mode-debug-disabled"
  | "global-dictation-force-lock-debug-enabled"
  | "has-seen-remote-connections-home-announcement"
  | "has-seen-codex-mobile-home-announcement"
  | "has-completed-codex-mobile-setup"
  | "last_completed_onboarding"
  | "git-branch-prefix"
  | "git-always-force-push"
  | "git-create-pull-request-as-draft"
  | "git-pull-request-merge-method"
  | "git-show-sidebar-pr-icons"
  | "git-commit-instructions"
  | "git-pr-instructions"
  | "pinned-thread-ids"
  | "worktree-auto-cleanup-enabled"
  | "worktree-auto-cleanup-unpackaged-override-enabled"
  | "worktree-keep-count";

export type GlobalStateValue =
  | boolean
  | number
  | string
  | string[]
  | Record<string, unknown>
  | null;

export type GeneralSettingsSnapshot = {
  usePointerCursors: boolean;
  uiFontSize: number;
  codeFontSize: number;
  localeOverride: string | null;
  appearanceTheme: AppearanceTheme;
  conversationDetailMode: ConversationDetailMode;
  composerEnterBehavior: ComposerEnterBehavior;
  integratedTerminalShell: IntegratedTerminalShell;
  preventSleepWhileRunning: boolean;
  runCodexInWindowsSubsystemForLinux: boolean;
  followUpQueueMode: FollowUpQueueMode;
  reviewDelivery: ReviewDelivery;
};

export type AppearanceSettingsSnapshot = GeneralSettingsSnapshot & {
  useFontSmoothing: boolean;
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
  conversationDetailMode: "STEPS_COMMANDS",
  composerEnterBehavior: "enter",
  integratedTerminalShell: "powershell",
  preventSleepWhileRunning: false,
  runCodexInWindowsSubsystemForLinux: false,
  followUpQueueMode: "queue",
  reviewDelivery: "inline",
};

export const DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY: ComposerPermissionModeVisibility = {
  "guardian-approvals": true,
  "full-access": true,
};

export const DEFAULT_GPU_TEARING_DEBUG_SETTINGS: GpuTearingDebugSettings = {
  disableBackdropBlur: false,
  disableCssMotion: false,
  disableScrollFadeMask: false,
  disableScrollFadeMaskAnimation: false,
  forceOpaqueRendererBackground: false,
};

const COMPOSER_PERMISSION_MODE_VISIBILITY_STORAGE_KEY =
  "composer-permission-mode-visibility";

export type GlobalStateUpdatedNotification = {
  keys: string[];
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettingsSnapshot = {
  ...DEFAULT_GENERAL_SETTINGS,
  useFontSmoothing: true,
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
  layer: ConfigLayer | null;
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
  const response = await invoke<ConfigReadResponse>("read_config", { cwd });
  return normalizeConfigReadResponse(response);
}

export async function readConfigForHost(params: ConfigReadForHostParams) {
  const { cwd = null, hostId, includeLayers = true } = params;
  const response = await invoke<ConfigReadResponse>("read-config-for-host", {
    params: {
      hostId: normalizeHostId(hostId),
      cwd,
      includeLayers,
    },
  });
  return normalizeConfigReadResponse(response);
}

export async function getConfigRequirementsForHost(params: {
  hostId?: string | null;
}) {
  return invoke<ConfigRequirementsReadResponse>(
    "get-config-requirements-for-host",
    {
      params: {
        hostId: normalizeHostId(params.hostId),
      },
    },
  );
}

export async function getConfigurationValue(key: string) {
  return invoke<ConfigurationValueResponse>("get-configuration", {
    params: { key },
  });
}

export async function readAgentSettingsNotices(hostId?: string | null) {
  return invoke<AgentSettingsNoticesResponse>("agent-settings-notices", {
    params: {
      hostId: normalizeHostId(hostId),
    },
  });
}

export function onAgentSettingsNoticesChanged(
  handler: (notification: AgentSettingsNoticesChangedNotification) => void,
) {
  return listen<AgentSettingsNoticesChangedNotification>(
    "agent-settings-notices-changed",
    (event) => {
      handler(event.payload);
    },
  );
}

export async function listModelsForHost(
  params: ModelListForHostParams = {},
) {
  const {
    cursor = null,
    hostId,
    includeHidden = null,
    limit = null,
  } = params;
  return invoke<ModelListResponse>("list-models-for-host", {
    params: {
      hostId: normalizeHostId(hostId),
      cursor,
      limit,
      includeHidden,
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

export async function setPersonalityForHost(params: {
  hostId?: string | null;
  personality: ConfigPersonality | null;
}) {
  return invoke<void>("set-personality", {
    params: {
      hostId: normalizeHostId(params.hostId),
      personality: params.personality,
    },
  });
}

export async function setPersonality(personality: ConfigPersonality | null) {
  return setPersonalityForHost({
    hostId: null,
    personality,
  });
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
        layer,
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
      layer: userLayer,
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
      layer: null,
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
      layer: managedLayer,
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

export function resolveConfigOrigin(
  origins: Record<string, ConfigLayerMetadata>,
  keyPath: string,
  probeFields: string[] = [],
) {
  return findConfigOrigin(origins, keyPath, probeFields);
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

export async function readHotkeyWindowHotkeyState() {
  return invoke<HotkeyWindowHotkeyStateResponse>("hotkey-window-hotkey-state");
}

export async function setHotkeyWindowHotkey(hotkey: string | null) {
  return invoke<SetHotkeyWindowHotkeyResponse>("hotkey-window-set-hotkey", {
    params: {
      hotkey,
    },
  });
}

export async function setHotkeyWindowDevHotkeyOverride(enabled: boolean) {
  return invoke<SetHotkeyWindowHotkeyResponse>("hotkey-window-set-dev-hotkey-override", {
    params: {
      enabled,
    },
  });
}

export async function readGlobalDictationHotkeyState() {
  return invoke<GlobalDictationHotkeyStateResponse>("global-dictation-hotkey-state");
}

export async function setGlobalDictationHotkey(hotkey: string | null) {
  return invoke<SetGlobalDictationHotkeyResponse>("global-dictation-set-hotkey", {
    params: {
      hotkey,
    },
  });
}

export async function setGlobalDictationToggleHotkey(hotkey: string | null) {
  return invoke<SetGlobalDictationHotkeyResponse>("global-dictation-set-toggle-hotkey", {
    params: {
      hotkey,
    },
  });
}

export async function setGlobalDictationForceLockChanged(enabled: boolean) {
  return invoke<void>("global-dictation-force-lock-changed", {
    params: {
      enabled,
    },
  });
}

export async function readGlobalDictationHistory() {
  return invoke<GlobalDictationHistoryResponse>("global-dictation-history");
}

export async function copyGlobalDictationHistoryItem(id: string) {
  return invoke<void>("global-dictation-copy-history-item", {
    params: {
      id,
    },
  });
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

export async function readUseFontSmoothingPreference() {
  const response = await getGlobalState("useFontSmoothing");
  return response.value !== false;
}

export async function readMacMenuBarEnabledPreference() {
  const response = await getGlobalState("mac-menu-bar-enabled");
  return response.value !== false;
}

export async function readGeneralSettingsSnapshot(): Promise<GeneralSettingsSnapshot> {
  const [
    localeOverride,
    usePointerCursors,
    uiFontSize,
    codeFontSize,
    appearanceTheme,
    conversationDetailMode,
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
      getGlobalState("conversationDetailMode"),
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
    conversationDetailMode: normalizeConversationDetailMode(conversationDetailMode.value),
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
    useFontSmoothing,
    lightChromeTheme,
    darkChromeTheme,
    lightCodeThemeId,
    darkCodeThemeId,
  ] = await Promise.all([
    readGeneralSettingsSnapshot(),
    readUseFontSmoothingPreference(),
    getGlobalState("appearanceLightChromeTheme"),
    getGlobalState("appearanceDarkChromeTheme"),
    getGlobalState("appearanceLightCodeThemeId"),
    getGlobalState("appearanceDarkCodeThemeId"),
  ]);

  return {
    ...generalSettings,
    useFontSmoothing,
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

export function readComposerPermissionModeVisibility() {
  if (typeof window === "undefined") {
    return DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY;
  }

  try {
    const rawValue = window.localStorage.getItem(
      COMPOSER_PERMISSION_MODE_VISIBILITY_STORAGE_KEY,
    );
    if (!rawValue) {
      return DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY;
    }
    return normalizeComposerPermissionModeVisibility(JSON.parse(rawValue));
  } catch {
    return DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY;
  }
}

export function updateComposerPermissionModeVisibility({
  mode,
  visible,
  settings,
}: {
  mode: ComposerPermissionMode;
  visible: boolean;
  settings?: ComposerPermissionModeVisibility | null;
}) {
  const nextSettings = {
    ...normalizeComposerPermissionModeVisibility(settings),
    [mode]: visible,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        COMPOSER_PERMISSION_MODE_VISIBILITY_STORAGE_KEY,
        JSON.stringify(nextSettings),
      );
    } catch {
      // Ignore persistence failures and keep the in-memory state for this session.
    }
  }

  return nextSettings;
}

export async function setSelectedAvatarId(value: string) {
  await setGlobalState("selected-avatar-id", value);
}

export async function readDictationDictionary() {
  const response = await getGlobalState("dictationDictionary");
  return normalizeDictationDictionary(response.value);
}

export function readGpuTearingDebugSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_GPU_TEARING_DEBUG_SETTINGS;
  }

  try {
    const rawValue = window.localStorage.getItem(
      GPU_TEARING_DEBUG_SETTINGS_STORAGE_KEY,
    );
    if (!rawValue) {
      return DEFAULT_GPU_TEARING_DEBUG_SETTINGS;
    }
    return normalizeGpuTearingDebugSettings(JSON.parse(rawValue));
  } catch {
    return DEFAULT_GPU_TEARING_DEBUG_SETTINGS;
  }
}

export function updateGpuTearingDebugSettings({
  key,
  settings,
  value,
}: {
  key: GpuTearingDebugSettingKey;
  settings?: GpuTearingDebugSettings | null;
  value: boolean;
}) {
  const nextSettings = {
    ...normalizeGpuTearingDebugSettings(settings),
    [key]: value,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        GPU_TEARING_DEBUG_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings),
      );
    } catch {
      // Ignore persistence failures and keep the in-memory state for this session.
    }
  }

  applyGpuTearingDebugSettings(nextSettings);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<GpuTearingDebugSettings>(
        GPU_TEARING_DEBUG_SETTINGS_CHANGED_EVENT,
        {
          detail: nextSettings,
        },
      ),
    );
  }

  return nextSettings;
}

export function onGpuTearingDebugSettingsChanged(
  handler: (settings: GpuTearingDebugSettings) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== GPU_TEARING_DEBUG_SETTINGS_STORAGE_KEY) {
      return;
    }
    handler(readGpuTearingDebugSettings());
  };

  const handleCustomEvent = (event: Event) => {
    handler((event as CustomEvent<GpuTearingDebugSettings>).detail);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    GPU_TEARING_DEBUG_SETTINGS_CHANGED_EVENT,
    handleCustomEvent,
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      GPU_TEARING_DEBUG_SETTINGS_CHANGED_EVENT,
      handleCustomEvent,
    );
  };
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

export function applyGpuTearingDebugSettings(settings: GpuTearingDebugSettings) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const normalizedSettings = normalizeGpuTearingDebugSettings(settings);
  root.classList.toggle(
    GPU_TEARING_DEBUG_DISABLE_SCROLL_FADE_MASK_CLASS,
    normalizedSettings.disableScrollFadeMask,
  );
  root.classList.toggle(
    GPU_TEARING_DEBUG_DISABLE_SCROLL_FADE_MASK_ANIMATION_CLASS,
    normalizedSettings.disableScrollFadeMaskAnimation,
  );
  root.classList.toggle(
    GPU_TEARING_DEBUG_DISABLE_BACKDROP_BLUR_CLASS,
    normalizedSettings.disableBackdropBlur,
  );
  root.classList.toggle(
    GPU_TEARING_DEBUG_DISABLE_CSS_MOTION_CLASS,
    normalizedSettings.disableCssMotion,
  );
  root.classList.toggle(
    GPU_TEARING_DEBUG_FORCE_OPAQUE_RENDERER_BACKGROUND_CLASS,
    normalizedSettings.forceOpaqueRendererBackground,
  );
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
    approvals_reviewer?: unknown;
    personality?: unknown;
    model_personality?: unknown;
    service_tier?: unknown;
    features?: unknown;
    mcp_servers?: unknown;
    memories?:
      | {
          generate_memories?: unknown;
          use_memories?: unknown;
          disable_on_external_context?: unknown;
          no_memories_if_mcp_or_web_search?: unknown;
        }
      | unknown;
    sandbox_workspace_write?:
      | {
          writable_roots?: unknown;
          exclude_slash_tmp?: unknown;
          exclude_tmpdir_env_var?: unknown;
          network_access?: unknown;
        }
      | unknown;
  };
  const sandboxWorkspaceWriteValue = value.sandbox_workspace_write;
  const sandboxWorkspaceWrite =
    sandboxWorkspaceWriteValue &&
    typeof sandboxWorkspaceWriteValue === "object" &&
    !Array.isArray(sandboxWorkspaceWriteValue)
      ? (() => {
        const sandboxWorkspaceWriteRecord = sandboxWorkspaceWriteValue as Record<string, unknown>;
        return {
          writableRoots: Array.isArray(sandboxWorkspaceWriteRecord.writable_roots)
            ? sandboxWorkspaceWriteRecord.writable_roots.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
              )
            : null,
          excludeSlashTmp: sandboxWorkspaceWriteRecord.exclude_slash_tmp === true,
          excludeTmpdirEnvVar: sandboxWorkspaceWriteRecord.exclude_tmpdir_env_var === true,
          networkAccess: sandboxWorkspaceWriteRecord.network_access === true,
        };
      })()
      : null;
  return {
    approvalPolicy: normalizeConfigApprovalPolicy(value.approval_policy),
    sandboxMode: normalizeSandboxMode(value.sandbox_mode),
    sandboxWorkspaceWrite,
    approvalsReviewer: normalizeConfigApprovalsReviewer(value.approvals_reviewer),
    personality: normalizeConfigPersonality(value.personality),
    modelPersonality: normalizeConfigPersonality(value.model_personality),
    serviceTier: normalizeConfigServiceTier(value.service_tier),
    memories: normalizeMemoriesConfig(value.memories),
    mcpServers:
      value.mcp_servers && typeof value.mcp_servers === "object" && !Array.isArray(value.mcp_servers)
        ? (value.mcp_servers as Record<string, unknown>)
        : null,
    features: normalizeBooleanRecord(value.features),
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

function normalizeConfigReadResponse(response: ConfigReadResponse): ConfigReadResponse {
  return {
    ...response,
    config: normalizeConfigSnapshot(response.config),
  };
}

function normalizeConfigSnapshot(config: ConfigSnapshot): ConfigSnapshot {
  return {
    approvalPolicy: normalizeConfigApprovalPolicy(config.approvalPolicy),
    sandboxMode: normalizeSandboxMode(config.sandboxMode),
    sandboxWorkspaceWrite: normalizeSandboxWorkspaceWriteSnapshot(config.sandboxWorkspaceWrite),
    approvalsReviewer: normalizeConfigApprovalsReviewer(config.approvalsReviewer),
    personality: normalizeConfigPersonality(config.personality),
    modelPersonality: normalizeConfigPersonality(config.modelPersonality),
    serviceTier: normalizeConfigServiceTier(config.serviceTier),
    memories: normalizeMemoriesSnapshot(config.memories),
    mcpServers:
      config.mcpServers && typeof config.mcpServers === "object" && !Array.isArray(config.mcpServers)
        ? config.mcpServers
        : null,
    features: normalizeBooleanRecord(config.features),
  };
}

function normalizeConfigApprovalPolicy(value: unknown): ConfigApprovalPolicy | null {
  if (
    value === "untrusted" ||
    value === "on-failure" ||
    value === "on-request" ||
    value === "never"
  ) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const granularValue = (value as Record<string, unknown>).granular;
  if (!granularValue || typeof granularValue !== "object" || Array.isArray(granularValue)) {
    return null;
  }
  const granularRecord = granularValue as Record<string, unknown>;

  return {
    granular: {
      sandbox_approval: granularRecord.sandbox_approval === true,
      rules: granularRecord.rules === true,
      skill_approval: granularRecord.skill_approval === true,
      request_permissions: granularRecord.request_permissions === true,
      mcp_elicitations: granularRecord.mcp_elicitations === true,
    },
  };
}

function normalizeConfigApprovalsReviewer(value: unknown): ConfigApprovalsReviewer | null {
  return value === "user" || value === "auto_review" || value === "guardian_subagent"
    ? value
    : null;
}

function normalizeSandboxWorkspaceWriteSnapshot(value: unknown): SandboxWorkspaceWrite | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    writableRoots: Array.isArray(record.writableRoots)
      ? record.writableRoots.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : null,
    excludeSlashTmp: record.excludeSlashTmp === true,
    excludeTmpdirEnvVar: record.excludeTmpdirEnvVar === true,
    networkAccess: record.networkAccess === true,
  };
}

function normalizeMemoriesSnapshot(value: MemoriesConfigSnapshot | null): MemoriesConfigSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    generateMemories: value.generateMemories === true,
    useMemories: value.useMemories === true,
    disableOnExternalContext: value.disableOnExternalContext === true,
  };
}

function normalizeConfigServiceTier(value: unknown): ConfigServiceTier | null {
  return value === "fast" || value === "flex" ? value : null;
}

function normalizeSandboxMode(value: unknown) {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access" ? value : null;
}

export function normalizeConfigPersonality(value: unknown): ConfigPersonality | null {
  return value === "friendly" || value === "pragmatic" || value === "none" ? value : null;
}

function normalizeBooleanRecord(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
  );
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

function normalizeConversationDetailMode(value: unknown): ConversationDetailMode {
  return value === "STEPS_PROSE" ? "STEPS_PROSE" : DEFAULT_GENERAL_SETTINGS.conversationDetailMode;
}

function normalizeIntegratedTerminalShell(value: unknown): IntegratedTerminalShell {
  return value === "powershell" || value === "commandPrompt" || value === "gitBash" || value === "wsl"
    ? value
    : DEFAULT_GENERAL_SETTINGS.integratedTerminalShell;
}

function normalizeDictationDictionary(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeComposerPermissionModeVisibility(
  value: unknown,
): ComposerPermissionModeVisibility {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY;
  }

  const settings = value as Record<string, unknown>;
  return {
    "guardian-approvals":
      typeof settings["guardian-approvals"] === "boolean"
        ? settings["guardian-approvals"]
        : DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY["guardian-approvals"],
    "full-access":
      typeof settings["full-access"] === "boolean"
        ? settings["full-access"]
        : DEFAULT_COMPOSER_PERMISSION_MODE_VISIBILITY["full-access"],
  };
}

function normalizeGpuTearingDebugSettings(
  value: unknown,
): GpuTearingDebugSettings {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return DEFAULT_GPU_TEARING_DEBUG_SETTINGS;
  }

  const settings = value as Record<string, unknown>;
  return {
    disableBackdropBlur:
      typeof settings.disableBackdropBlur === "boolean"
        ? settings.disableBackdropBlur
        : DEFAULT_GPU_TEARING_DEBUG_SETTINGS.disableBackdropBlur,
    disableCssMotion:
      typeof settings.disableCssMotion === "boolean"
        ? settings.disableCssMotion
        : DEFAULT_GPU_TEARING_DEBUG_SETTINGS.disableCssMotion,
    disableScrollFadeMask:
      typeof settings.disableScrollFadeMask === "boolean"
        ? settings.disableScrollFadeMask
        : DEFAULT_GPU_TEARING_DEBUG_SETTINGS.disableScrollFadeMask,
    disableScrollFadeMaskAnimation:
      typeof settings.disableScrollFadeMaskAnimation === "boolean"
        ? settings.disableScrollFadeMaskAnimation
        : DEFAULT_GPU_TEARING_DEBUG_SETTINGS.disableScrollFadeMaskAnimation,
    forceOpaqueRendererBackground:
      typeof settings.forceOpaqueRendererBackground === "boolean"
        ? settings.forceOpaqueRendererBackground
        : DEFAULT_GPU_TEARING_DEBUG_SETTINGS.forceOpaqueRendererBackground,
  };
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
