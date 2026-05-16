import type {
  ComposerPermissionModeVisibility,
  ConfigApprovalPolicy,
  ConfigApprovalPolicyGranular,
  ConfigApprovalsReviewer,
  ConfigRequirements,
  ConfigSnapshot,
  ConversationDetailMode,
  SandboxWorkspaceWrite,
} from "../../services/settings";
import type { TurnStartPermissionOverrides, TurnStartSandboxPolicy } from "../../services/history";

export type HotkeyPermissionAgentMode =
  | "read-only"
  | "auto"
  | "granular"
  | "guardian-approvals"
  | "full-access"
  | "custom";

type StandardHotkeyPermissionAgentMode = Exclude<HotkeyPermissionAgentMode, "custom">;

export type HotkeyPermissionOptionValue =
  | "default"
  | "guardian-approvals"
  | "full-access"
  | "custom";

type HotkeyFullAccessDisabledReason = "global-default" | "requirements" | null;

export type HotkeyPermissionsState = {
  availableAgentModes: HotkeyPermissionAgentMode[];
  canShowCustom: boolean;
  canShowDefaultPermissions: boolean;
  canShowFullAccess: boolean;
  canShowGuardian: boolean;
  defaultAgentMode: Extract<HotkeyPermissionAgentMode, "read-only" | "auto" | "granular">;
  fullAccessDisabledReason: HotkeyFullAccessDisabledReason;
  initialAgentMode: HotkeyPermissionAgentMode;
  isDropdownDisabled: boolean;
  showFullAccessOption: boolean;
  showGuardianOption: boolean;
};

export type VisibleHotkeyPermissionOption = {
  disabled: boolean;
  value: HotkeyPermissionOptionValue;
};

const STANDARD_ALLOWED_AGENT_MODES: StandardHotkeyPermissionAgentMode[] = [
  "read-only",
  "auto",
  "granular",
  "guardian-approvals",
  "full-access",
];

const CUSTOM_INSERTION_PRIORITY: HotkeyPermissionAgentMode[] = [
  "custom",
  "auto",
  "granular",
  "guardian-approvals",
  "read-only",
];

const GRANULAR_APPROVAL_POLICY: ConfigApprovalPolicyGranular = {
  granular: {
    sandbox_approval: false,
    rules: false,
    skill_approval: false,
    request_permissions: true,
    mcp_elicitations: true,
  },
};

export function resolveHotkeyPermissionsState(params: {
  config: ConfigSnapshot | null;
  conversationDetailMode: ConversationDetailMode;
  guardianApprovalEnabledByStatsig: boolean;
  requirements: ConfigRequirements | null;
  visibility: ComposerPermissionModeVisibility;
}): HotkeyPermissionsState {
  const defaultAgentMode = getDefaultWorkspaceWriteMode({
    config: params.config,
    conversationDetailMode: params.conversationDetailMode,
    requirements: params.requirements,
  });
  const availableAgentModes = getAvailableAgentModes({
    config: params.config,
    guardianApprovalEnabledByStatsig: params.guardianApprovalEnabledByStatsig,
    requirements: params.requirements,
    visibility: params.visibility,
  });
  const canShowDefaultPermissions = shouldShowDefaultPermissions(params.requirements);
  const showGuardianOption =
    params.guardianApprovalEnabledByStatsig && params.visibility["guardian-approvals"];
  const canShowGuardian =
    showGuardianOption &&
    availableAgentModes.includes("guardian-approvals");
  const showFullAccessOption = params.visibility["full-access"];
  const canShowFullAccess =
    showFullAccessOption && availableAgentModes.includes("full-access");
  const fullAccessDisabledReason: HotkeyFullAccessDisabledReason =
    showFullAccessOption && !canShowFullAccess ? "requirements" : null;
  const canShowCustom = availableAgentModes.includes("custom");
  const optionCount =
    (canShowDefaultPermissions ? 1 : 0) +
    (showGuardianOption ? 1 : 0) +
    (showFullAccessOption ? 1 : 0) +
    (canShowCustom ? 1 : 0);
  const configEquivalentMode = getConfigEquivalentMode(params.config, defaultAgentMode);
  const configNonFullAccessMode = getConfigNonFullAccessMode({
    availableAgentModes,
    config: params.config,
    guardianApprovalEnabledByStatsig: params.guardianApprovalEnabledByStatsig,
    requirements: params.requirements,
    visibility: params.visibility,
  });

  return {
    availableAgentModes,
    canShowCustom,
    canShowDefaultPermissions,
    canShowFullAccess,
    canShowGuardian,
    defaultAgentMode,
    fullAccessDisabledReason,
    initialAgentMode: getInitialAgentMode({
      availableAgentModes,
      configEquivalentMode,
      configNonFullAccessMode,
    }),
    isDropdownDisabled: optionCount <= 1,
    showFullAccessOption,
    showGuardianOption,
  };
}

export function getVisibleHotkeyPermissionOptions(
  state: HotkeyPermissionsState,
): VisibleHotkeyPermissionOption[] {
  const options: VisibleHotkeyPermissionOption[] = [];

  if (state.canShowDefaultPermissions) {
    options.push({
      disabled: false,
      value: "default",
    });
  }

  if (state.showGuardianOption) {
    options.push({
      disabled: !state.canShowGuardian,
      value: "guardian-approvals",
    });
  }

  if (state.showFullAccessOption) {
    options.push({
      disabled: !state.canShowFullAccess,
      value: "full-access",
    });
  }

  if (state.canShowCustom) {
    options.push({
      disabled: false,
      value: "custom",
    });
  }

  return options;
}

export function getHotkeyPermissionOptionValue(
  mode: HotkeyPermissionAgentMode,
): HotkeyPermissionOptionValue {
  if (isDefaultPermissionsMode(mode)) {
    return "default";
  }
  return mode;
}

export function isDefaultPermissionsMode(mode: HotkeyPermissionAgentMode) {
  return mode === "read-only" || mode === "auto" || mode === "granular";
}

export function getNextAgentModeFromOption(params: {
  defaultAgentMode: Extract<HotkeyPermissionAgentMode, "read-only" | "auto" | "granular">;
  option: HotkeyPermissionOptionValue;
}): HotkeyPermissionAgentMode {
  if (params.option === "default") {
    return params.defaultAgentMode;
  }
  return params.option;
}

export function buildTurnStartPermissionOverrides(params: {
  agentMode: HotkeyPermissionAgentMode;
  config: ConfigSnapshot | null;
  workspaceRoots: string[];
}): TurnStartPermissionOverrides {
  switch (params.agentMode) {
    case "read-only":
      return buildReadOnlyPermissionOverrides();
    case "auto":
      return buildWorkspaceWritePermissionOverrides(params.workspaceRoots);
    case "granular":
      return buildWorkspaceWritePermissionOverrides(
        params.workspaceRoots,
        undefined,
        GRANULAR_APPROVAL_POLICY,
      );
    case "guardian-approvals": {
      if (
        params.config?.sandboxMode === "read-only" &&
        isOnRequestApprovalPolicy(params.config.approvalPolicy)
      ) {
        return buildReadOnlyPermissionOverrides("guardian_subagent");
      }

      if (
        params.config?.sandboxMode === "workspace-write" &&
        isOnRequestApprovalPolicy(params.config.approvalPolicy)
      ) {
        return buildWorkspaceWritePermissionOverrides(
          params.workspaceRoots,
          params.config.sandboxWorkspaceWrite,
          undefined,
          "guardian_subagent",
        );
      }

      return buildWorkspaceWritePermissionOverrides(
        params.workspaceRoots,
        undefined,
        undefined,
        "guardian_subagent",
      );
    }
    case "full-access":
      return {
        approvalPolicy: "never",
        approvalsReviewer: "user",
        sandboxPolicy: {
          type: "dangerFullAccess",
        },
      };
    case "custom":
      return buildPermissionOverridesFromConfig(params.workspaceRoots, params.config);
  }
}

function getDefaultWorkspaceWriteMode(params: {
  config: ConfigSnapshot | null;
  conversationDetailMode: ConversationDetailMode;
  requirements: ConfigRequirements | null;
}): Extract<HotkeyPermissionAgentMode, "read-only" | "auto" | "granular"> {
  if (
    params.conversationDetailMode === "STEPS_PROSE" &&
    isAgentModeAllowed("granular", params.requirements) &&
    getConfigEquivalentMode(params.config, "granular") === "granular"
  ) {
    return "granular";
  }

  return "auto";
}

function getAvailableAgentModes(params: {
  config: ConfigSnapshot | null;
  guardianApprovalEnabledByStatsig: boolean;
  requirements: ConfigRequirements | null;
  visibility: ComposerPermissionModeVisibility;
}) {
  const modes = getAllowedAgentModesFromRequirements(params.requirements);
  const filteredModes = params.guardianApprovalEnabledByStatsig
    ? modes
    : modes.filter((mode) => mode !== "guardian-approvals");
  const visibleModes = filteredModes.filter((mode) => {
    switch (mode) {
      case "guardian-approvals":
        return params.visibility["guardian-approvals"];
      case "full-access":
        return params.visibility["full-access"];
      default:
        return true;
    }
  });

  if (hasExplicitPermissionConfig(params.config)) {
    const configOverrides = buildPermissionOverridesFromConfig([], params.config);
    if (
      isPermissionConfigurationAllowed(
        params.requirements,
        getSandboxModeFromPolicy(configOverrides.sandboxPolicy),
        configOverrides.approvalPolicy ?? null,
        configOverrides.approvalsReviewer ?? null,
      )
    ) {
      return [...visibleModes, "custom"] as HotkeyPermissionAgentMode[];
    }
  }

  return visibleModes;
}

function getAllowedAgentModesFromRequirements(requirements: ConfigRequirements | null) {
  return STANDARD_ALLOWED_AGENT_MODES.filter((mode) => isAgentModeAllowed(mode, requirements));
}

function isAgentModeAllowed(
  mode: StandardHotkeyPermissionAgentMode,
  requirements: ConfigRequirements | null,
) {
  const modeConfig = getAgentModeRequirementConfig(mode);
  return isPermissionConfigurationAllowed(
    requirements,
    modeConfig.sandboxMode,
    modeConfig.approvalPolicy,
    modeConfig.approvalsReviewer,
  );
}

function getAgentModeRequirementConfig(
  mode: StandardHotkeyPermissionAgentMode,
): {
  sandboxMode: string;
  approvalPolicy: ConfigApprovalPolicy;
  approvalsReviewer: ConfigApprovalsReviewer;
} {
  switch (mode) {
    case "read-only":
      return {
        sandboxMode: "read-only",
        approvalPolicy: "on-request",
        approvalsReviewer: "user",
      };
    case "auto":
      return {
        sandboxMode: "workspace-write",
        approvalPolicy: "on-request",
        approvalsReviewer: "user",
      };
    case "granular":
      return {
        sandboxMode: "workspace-write",
        approvalPolicy: GRANULAR_APPROVAL_POLICY,
        approvalsReviewer: "user",
      };
    case "guardian-approvals":
      return {
        sandboxMode: "workspace-write",
        approvalPolicy: "on-request",
        approvalsReviewer: "guardian_subagent",
      };
    case "full-access":
      return {
        sandboxMode: "danger-full-access",
        approvalPolicy: "never",
        approvalsReviewer: "user",
      };
  }
}

function isPermissionConfigurationAllowed(
  requirements: ConfigRequirements | null,
  sandboxMode: string | null,
  approvalPolicy: ConfigApprovalPolicy | null,
  approvalsReviewer: string | null,
) {
  if (requirements === null) {
    return true;
  }

  if (
    requirements.allowedSandboxModes !== null &&
    sandboxMode !== null &&
    !requirements.allowedSandboxModes.includes(sandboxMode)
  ) {
    return false;
  }

  if (
    requirements.allowedApprovalPolicies !== null &&
    approvalPolicy !== null &&
    !requirements.allowedApprovalPolicies.some((value) => areApprovalPoliciesEqual(value, approvalPolicy))
  ) {
    return false;
  }

  if (
    requirements.allowedApprovalsReviewers !== null &&
    approvalsReviewer !== null &&
    !requirements.allowedApprovalsReviewers.includes(approvalsReviewer)
  ) {
    return false;
  }

  return true;
}

function areApprovalPoliciesEqual(left: unknown, right: ConfigApprovalPolicy) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getConfigEquivalentMode(
  config: ConfigSnapshot | null,
  defaultWorkspaceWriteMode: Extract<HotkeyPermissionAgentMode, "read-only" | "auto" | "granular">,
) {
  const sandboxMode = config?.sandboxMode ?? null;
  const approvalPolicy = config?.approvalPolicy ?? null;
  const sandboxWorkspaceWrite = config?.sandboxWorkspaceWrite ?? null;
  const isApprovalUnset = approvalPolicy === null;
  const isSandboxUnset = sandboxMode === null;
  const hasNoExplicitPermissions = isApprovalUnset && isSandboxUnset;
  const usesOnRequestApproval = isOnRequestApprovalPolicy(approvalPolicy);
  const usesNeverApproval = approvalPolicy === "never" || approvalPolicy === null;
  const isWorkspaceWriteDefault = isDefaultWorkspaceWriteConfig(sandboxWorkspaceWrite);

  if (hasNoExplicitPermissions) {
    return defaultWorkspaceWriteMode;
  }

  if ((sandboxMode === "read-only" || sandboxMode === null) && usesOnRequestApproval) {
    return "read-only";
  }

  if (sandboxMode === "workspace-write" && isWorkspaceWriteDefault) {
    if (isGranularApprovalPolicy(approvalPolicy)) {
      return "granular";
    }

    if (usesOnRequestApproval) {
      return config?.approvalsReviewer === "guardian_subagent"
        ? "guardian-approvals"
        : "auto";
    }
  }

  if (sandboxMode === "danger-full-access" && usesNeverApproval) {
    return "full-access";
  }

  return null;
}

function getConfigNonFullAccessMode(params: {
  availableAgentModes: HotkeyPermissionAgentMode[];
  config: ConfigSnapshot | null;
  guardianApprovalEnabledByStatsig: boolean;
  requirements: ConfigRequirements | null;
  visibility: ComposerPermissionModeVisibility;
}) {
  const standardModes = params.availableAgentModes.filter((mode) => mode !== "custom");
  const fallbackMode = getHighestPriorityMode(standardModes);
  const configEquivalentMode = getConfigEquivalentMode(params.config, "auto");

  if (
    params.guardianApprovalEnabledByStatsig &&
    configEquivalentMode === "auto" &&
    params.config?.approvalsReviewer === "guardian_subagent" &&
    params.visibility["guardian-approvals"] &&
    isAgentModeAllowed("guardian-approvals", params.requirements)
  ) {
    return "guardian-approvals";
  }

  return fallbackMode;
}

function getHighestPriorityMode(modes: HotkeyPermissionAgentMode[]) {
  for (const mode of CUSTOM_INSERTION_PRIORITY) {
    if (modes.includes(mode)) {
      return mode === "custom" ? "read-only" : mode;
    }
  }

  return "read-only";
}

function getInitialAgentMode(params: {
  availableAgentModes: HotkeyPermissionAgentMode[];
  configEquivalentMode: HotkeyPermissionAgentMode | null;
  configNonFullAccessMode: HotkeyPermissionAgentMode;
}) {
  if (params.availableAgentModes.includes("custom")) {
    return "custom";
  }

  if (
    !hasNonFullAccessMode(params.availableAgentModes) &&
    params.availableAgentModes.includes("full-access")
  ) {
    return "full-access";
  }

  if (
    params.configEquivalentMode !== null &&
    params.availableAgentModes.includes(params.configEquivalentMode)
  ) {
    return params.configEquivalentMode;
  }

  return params.configNonFullAccessMode;
}

function hasNonFullAccessMode(modes: HotkeyPermissionAgentMode[]) {
  return modes.some((mode) => mode !== "full-access" && mode !== "custom");
}

function shouldShowDefaultPermissions(requirements: ConfigRequirements | null) {
  if (requirements === null) {
    return true;
  }

  const workspaceWriteAllowed =
    requirements.allowedSandboxModes === null ||
    requirements.allowedSandboxModes.includes("workspace-write");
  const onRequestAllowed =
    requirements.allowedApprovalPolicies === null ||
    requirements.allowedApprovalPolicies.some((value) => value === "on-request");
  const reviewerAllowed =
    requirements.allowedApprovalsReviewers === null ||
    requirements.allowedApprovalsReviewers.includes("user") ||
    requirements.allowedApprovalsReviewers.includes("auto_review");

  return workspaceWriteAllowed && onRequestAllowed && reviewerAllowed;
}

function hasExplicitPermissionConfig(config: ConfigSnapshot | null) {
  return config?.approvalPolicy !== null || config?.sandboxMode !== null;
}

function buildPermissionOverridesFromConfig(
  workspaceRoots: string[],
  config: ConfigSnapshot | null,
): TurnStartPermissionOverrides {
  const approvalsReviewer = normalizeConfigApprovalsReviewer(config);
  switch (config?.sandboxMode) {
    case "danger-full-access":
      return {
        approvalPolicy: config.approvalPolicy ?? "never",
        approvalsReviewer,
        sandboxPolicy: {
          type: "dangerFullAccess",
        },
      };
    case "read-only":
      return {
        approvalPolicy: config?.approvalPolicy ?? "on-request",
        approvalsReviewer,
        sandboxPolicy: {
          type: "readOnly",
          networkAccess: false,
        },
      };
    case "workspace-write":
      return buildWorkspaceWritePermissionOverrides(
        workspaceRoots,
        config.sandboxWorkspaceWrite,
        config.approvalPolicy ?? "on-request",
        approvalsReviewer,
      );
    default:
      return {
        approvalPolicy: config?.approvalPolicy ?? "on-request",
        approvalsReviewer,
        sandboxPolicy: {
          type: "readOnly",
          networkAccess: false,
        },
      };
  }
}

function normalizeConfigApprovalsReviewer(config: ConfigSnapshot | null): ConfigApprovalsReviewer {
  const approvalsReviewer = config?.approvalsReviewer;
  if (
    approvalsReviewer === "guardian_subagent" &&
    config?.features?.guardian_approval !== true
  ) {
    return "user";
  }

  return approvalsReviewer === "auto_review" ||
    approvalsReviewer === "guardian_subagent"
    ? approvalsReviewer
    : "user";
}

function buildWorkspaceWritePermissionOverrides(
  workspaceRoots: string[],
  sandboxWorkspaceWrite?: SandboxWorkspaceWrite | null,
  approvalPolicy?: ConfigApprovalPolicy,
  approvalsReviewer: ConfigApprovalsReviewer = "user",
): TurnStartPermissionOverrides {
  const writableRoots = [
    ...workspaceRoots,
    ...(sandboxWorkspaceWrite?.writableRoots ?? []),
  ];
  const sandboxPolicy: TurnStartSandboxPolicy = {
    type: "workspaceWrite",
    writableRoots,
    excludeSlashTmp: sandboxWorkspaceWrite?.excludeSlashTmp ?? false,
    excludeTmpdirEnvVar: sandboxWorkspaceWrite?.excludeTmpdirEnvVar ?? false,
    networkAccess: sandboxWorkspaceWrite?.networkAccess ?? false,
  };

  return {
    approvalPolicy: approvalPolicy ?? "on-request",
    approvalsReviewer,
    sandboxPolicy,
  };
}

function buildReadOnlyPermissionOverrides(
  approvalsReviewer: ConfigApprovalsReviewer = "user",
): TurnStartPermissionOverrides {
  return {
    approvalPolicy: "on-request",
    approvalsReviewer,
    sandboxPolicy: {
      type: "readOnly",
      networkAccess: false,
    },
  };
}

function isGranularApprovalPolicy(value: ConfigApprovalPolicy | null | undefined) {
  return JSON.stringify(value) === JSON.stringify(GRANULAR_APPROVAL_POLICY);
}

function isOnRequestApprovalPolicy(value: ConfigApprovalPolicy | null | undefined) {
  return value === "on-request" || value === null || value === undefined;
}

function isDefaultWorkspaceWriteConfig(config: SandboxWorkspaceWrite | null | undefined) {
  return (config?.writableRoots?.length ?? 0) === 0 &&
    (config?.networkAccess ?? false) === false &&
    (config?.excludeSlashTmp ?? false) === false &&
    (config?.excludeTmpdirEnvVar ?? false) === false;
}

function getSandboxModeFromPolicy(policy: TurnStartSandboxPolicy | null | undefined) {
  switch (policy?.type) {
    case "dangerFullAccess":
      return "danger-full-access";
    case "readOnly":
      return "read-only";
    case "workspaceWrite":
      return "workspace-write";
    default:
      return null;
  }
}
