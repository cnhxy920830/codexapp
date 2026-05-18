import {
  getGlobalState,
  readHotkeyWindowHotkeyState,
  type HotkeyWindowHotkeyStateResponse,
} from "../../services/settings";
import { normalizeWorkspaceOnboardingExperimentAssignment } from "../onboarding/selectWorkspaceModel";
import type { DebugOnboardingState } from "./DebugParitySections";

type GlobalStateResponse = {
  value: unknown;
};

export type DebugWindowParityState = {
  onboardingState: DebugOnboardingState;
  realtimeVoiceDebugDisabled: boolean;
  globalDictationForceLockEnabled: boolean;
  hotkeyWindowState: HotkeyWindowHotkeyStateResponse | null;
};

export const DEFAULT_DEBUG_ONBOARDING_STATE: DebugOnboardingState = {
  browserCommentModeCoachmarkDismissed: false,
  hasSeenCodexMobileHomeAnnouncement: false,
  hasSeenRemoteConnectionsHomeAnnouncement: false,
  pluginChecklistActive: false,
  projectlessCompleted: false,
  roleSelectionDebugOverride: "auto",
  routeOverride: "auto",
  welcomePending: false,
  welcomeRoles: [],
  workspaceExperimentAssignment: null,
};

export const DEFAULT_DEBUG_WINDOW_PARITY_STATE: DebugWindowParityState = {
  onboardingState: DEFAULT_DEBUG_ONBOARDING_STATE,
  realtimeVoiceDebugDisabled: false,
  globalDictationForceLockEnabled: false,
  hotkeyWindowState: null,
};

const DEBUG_PARITY_GLOBAL_STATE_KEYS = new Set([
  "browser-sidebar-comment-mode-coachmark-dismissed",
  "electron:onboarding-override",
  "electron:onboarding-plugin-checklist-active",
  "electron:onboarding-projectless-completed",
  "electron:onboarding-welcome-pending",
  "electron:onboarding-welcome-v2-role-selection-debug-override",
  "electron:onboarding-welcome-v2-role-state",
  "electron:onboarding-workspace-experiment-assignment",
  "global-dictation-force-lock-debug-enabled",
  "has-seen-codex-mobile-home-announcement",
  "has-seen-remote-connections-home-announcement",
  "realtime-voice-mode-debug-disabled",
]);

export async function loadDebugWindowParityState(): Promise<DebugWindowParityState> {
  const [
    browserCommentModeCoachmarkDismissedResponse,
    routeOverrideResponse,
    pluginChecklistActiveResponse,
    projectlessCompletedResponse,
    welcomePendingResponse,
    roleSelectionDebugOverrideResponse,
    welcomeRoleStateResponse,
    workspaceExperimentAssignmentResponse,
    hasSeenCodexMobileHomeAnnouncementResponse,
    hasSeenRemoteConnectionsHomeAnnouncementResponse,
    realtimeVoiceDebugDisabledResponse,
    globalDictationForceLockEnabledResponse,
    hotkeyWindowState,
  ] = await Promise.all([
    readGlobalState("browser-sidebar-comment-mode-coachmark-dismissed"),
    readGlobalState("electron:onboarding-override"),
    readGlobalState("electron:onboarding-plugin-checklist-active"),
    readGlobalState("electron:onboarding-projectless-completed"),
    readGlobalState("electron:onboarding-welcome-pending"),
    readGlobalState("electron:onboarding-welcome-v2-role-selection-debug-override"),
    readGlobalState("electron:onboarding-welcome-v2-role-state"),
    readGlobalState("electron:onboarding-workspace-experiment-assignment"),
    readGlobalState("has-seen-codex-mobile-home-announcement"),
    readGlobalState("has-seen-remote-connections-home-announcement"),
    readGlobalState("realtime-voice-mode-debug-disabled"),
    readGlobalState("global-dictation-force-lock-debug-enabled"),
    readHotkeyWindowHotkeyState().catch(() => null),
  ]);

  return {
    onboardingState: {
      browserCommentModeCoachmarkDismissed:
        browserCommentModeCoachmarkDismissedResponse.value === true,
      hasSeenCodexMobileHomeAnnouncement:
        hasSeenCodexMobileHomeAnnouncementResponse.value === true,
      hasSeenRemoteConnectionsHomeAnnouncement:
        hasSeenRemoteConnectionsHomeAnnouncementResponse.value === true,
      pluginChecklistActive: pluginChecklistActiveResponse.value === true,
      projectlessCompleted: projectlessCompletedResponse.value === true,
      roleSelectionDebugOverride: normalizeRoleSelectionDebugOverride(
        roleSelectionDebugOverrideResponse.value,
      ),
      routeOverride: normalizeRouteOverride(routeOverrideResponse.value),
      welcomePending: welcomePendingResponse.value === true,
      welcomeRoles: normalizeWelcomeRoles(welcomeRoleStateResponse.value),
      workspaceExperimentAssignment:
        normalizeWorkspaceOnboardingExperimentAssignment(
          workspaceExperimentAssignmentResponse.value,
        ),
    },
    realtimeVoiceDebugDisabled: realtimeVoiceDebugDisabledResponse.value === true,
    globalDictationForceLockEnabled:
      globalDictationForceLockEnabledResponse.value === true,
    hotkeyWindowState,
  };
}

export function shouldRefreshDebugWindowParityState(keys: string[]) {
  return keys.some((key) => DEBUG_PARITY_GLOBAL_STATE_KEYS.has(key));
}

async function readGlobalState(key: Parameters<typeof getGlobalState>[0]) {
  return getGlobalState(key).catch<GlobalStateResponse>(() => ({ value: null }));
}

function normalizeRouteOverride(value: unknown): DebugOnboardingState["routeOverride"] {
  switch (value) {
    case "app":
    case "auto":
    case "login":
    case "welcome":
    case "workspace":
      return value;
    case "project":
    case "select-workspace":
      return "workspace";
    default:
      return "auto";
  }
}

function normalizeRoleSelectionDebugOverride(
  value: unknown,
): DebugOnboardingState["roleSelectionDebugOverride"] {
  switch (value) {
    case "off":
    case "on":
      return value;
    default:
      return "auto";
  }
}

function normalizeWelcomeRoles(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const roles = (value as Record<string, unknown>).roles;
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter(
    (role): role is string => typeof role === "string" && role.trim().length > 0,
  );
}
