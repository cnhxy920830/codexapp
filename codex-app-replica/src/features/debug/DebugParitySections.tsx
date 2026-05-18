import { useEffect, useState } from "react";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { logout, type AuthSnapshot } from "../../services/auth";
import type { ThreadConversation, ThreadConversationUserInput } from "../../services/history";
import { formatAcceleratorLabel } from "../../services/keyboardShortcuts";
import type { PrimaryRuntimeInstallProgressEvent } from "../../services/primaryRuntime";
import {
  setGlobalDictationForceLockChanged,
  setGlobalState,
  setHotkeyWindowDevHotkeyOverride,
  type HotkeyWindowHotkeyStateResponse,
} from "../../services/settings";
import { buildThreadDiffSummary } from "../chat/threadConversationState";
import {
  type WorkspaceOnboardingExperimentArm,
  type WorkspaceOnboardingExperimentAssignment,
} from "../onboarding/selectWorkspaceModel";
import { useReplicaStatsigState } from "../statsig/replicaStatsig";
import { DebugField, DebugSection } from "./DebugSectionPrimitives";

const LOCAL_CONVERSATION_STORAGE_KEY = "debug-entry-local-conversation-current";
const ONBOARDING_STORAGE_KEY = "debug-onboarding";
const REALTIME_VOICE_STORAGE_KEY = "debug-realtime-voice-override";
const GLOBAL_DICTATION_STORAGE_KEY = "debug-global-dictation-lock-override";
const HOTKEY_WINDOW_STORAGE_KEY = "debug-hotkey-window-hotkey";
const WORKSPACE_ONBOARDING_EXPERIMENT_NAME = "93537254";

const ONBOARDING_ROUTE_BUTTONS: Array<{ label: string; value: OnboardingRouteOverrideValue }> = [
  { label: "Auto", value: "auto" },
  { label: "Login", value: "login" },
  { label: "Welcome", value: "welcome" },
  { label: "Project", value: "workspace" },
  { label: "App", value: "app" },
];

const WORKSPACE_EXPERIMENT_BUTTONS: Array<{ label: string; value: WorkspaceExperimentValue }> = [
  { label: "Auto", value: "auto" },
  { label: "Control", value: "control" },
  { label: "T2 Picker", value: "t2_direct_folder_picker" },
  { label: "T3 Playground", value: "t3_auto_playground" },
  { label: "T4 Copy+CTA", value: "t4_modal_copy_cta_playground" },
  { label: "T5 Onboarding V2", value: "t5_onboarding_v2" },
];

const ROLE_SELECTION_BUTTONS: Array<{ label: string; value: RoleSelectionOverrideValue }> = [
  { label: "Auto", value: "auto" },
  { label: "On", value: "on" },
  { label: "Off", value: "off" },
];

type FieldLine = {
  label: string;
  value: string;
};

type WorkspaceExperimentValue = WorkspaceOnboardingExperimentArm | "auto";
type OnboardingRouteOverrideValue = "auto" | "app" | "login" | "welcome" | "workspace";
type RoleSelectionOverrideValue = "auto" | "off" | "on";

export type DebugOnboardingState = {
  browserCommentModeCoachmarkDismissed: boolean;
  hasSeenCodexMobileHomeAnnouncement: boolean;
  hasSeenRemoteConnectionsHomeAnnouncement: boolean;
  pluginChecklistActive: boolean;
  projectlessCompleted: boolean;
  roleSelectionDebugOverride: RoleSelectionOverrideValue;
  routeOverride: OnboardingRouteOverrideValue;
  welcomePending: boolean;
  welcomeRoles: string[];
  workspaceExperimentAssignment: WorkspaceOnboardingExperimentAssignment;
};

export function LocalConversationSection({
  conversationId,
  threadConversation,
}: {
  conversationId: string;
  threadConversation: ThreadConversation | null;
}) {
  const diffSummary = threadConversation ? buildThreadDiffSummary(threadConversation.items) : null;
  const editedFiles = diffSummary?.files.map((file) => normalizeDebugValue(file.path, "unknown")) ?? [];
  const referencedFiles = collectReferencedFiles(threadConversation?.turns.at(-1)?.input ?? []);
  const lines: FieldLine[] = [
    { label: "id", value: conversationId },
    { label: "model", value: "unknown" },
    { label: "reasoning", value: "unknown" },
    { label: "rolloutPath", value: "unknown" },
    { label: "resumeState", value: "unknown" },
    { label: "cwd", value: normalizeDebugValue(threadConversation?.cwd, "unknown") },
    { label: "editedFileCount", value: String(diffSummary?.fileCount ?? 0) },
    ...editedFiles.map((file, index) => ({ label: `editedFile[${index}]`, value: file })),
    { label: "referencedFileCount", value: String(referencedFiles.length) },
    ...referencedFiles.map((file, index) => ({ label: `referencedFile[${index}]`, value: file })),
  ];

  return (
    <DebugSection storageKey={LOCAL_CONVERSATION_STORAGE_KEY} title="Local conversation" variant="selection">
      <DebugFieldList lines={lines} />
    </DebugSection>
  );
}

export function OnboardingSection({
  authSnapshot,
  initialState,
  primaryRuntimeInstallProgress,
  workspaceRootCount,
}: {
  authSnapshot: AuthSnapshot | null;
  initialState: DebugOnboardingState;
  primaryRuntimeInstallProgress: PrimaryRuntimeInstallProgressEvent | null;
  workspaceRootCount: number;
}) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const authMethod = authSnapshot?.authState.authMethod ?? "none";
  const runtimeLabel = primaryRuntimeInstallProgress == null
    ? "idle"
    : formatPrimaryRuntimeProgress(primaryRuntimeInstallProgress);
  const rolesLabel = state.welcomeRoles.length === 0 ? "none" : state.welcomeRoles.join(", ");
  const workspaceExperimentArm = state.workspaceExperimentAssignment?.arm ?? "auto";

  return (
    <DebugSection storageKey={ONBOARDING_STORAGE_KEY} title="Onboarding" variant="global">
      <div className="flex flex-col gap-3 pb-4">
        <div className="text-xs text-token-description-foreground">
          {`Auth: ${authMethod} · Projects: ${workspaceRootCount}`}
        </div>
        <div className="text-xs text-token-description-foreground">{`Codex runtime: ${runtimeLabel}`}</div>
        <div className="flex flex-wrap gap-2">
          {ONBOARDING_ROUTE_BUTTONS.map((button) => (
            <button
              key={button.value}
              type="button"
              className={routeButtonClassName(state.routeOverride === button.value)}
              onClick={() => {
                void handleRouteOverrideChange(button.value);
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="text-token-description-foreground">
            {`Onboarding welcome pending: ${state.welcomePending ? "pending" : "off"} · Projectless completed: ${state.projectlessCompleted ? "yes" : "no"} · Plugin checklist active: ${state.pluginChecklistActive ? "yes" : "no"} · Roles: ${rolesLabel}`}
          </div>
          <button
            type="button"
            className="rounded border border-token-border px-3 py-1 text-token-description-foreground hover:bg-token-foreground/5"
            onClick={() => {
              void handleResetOnboarding();
            }}
          >
            Reset onboarding
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-token-description-foreground">
            {`WelcomeV2 Role Selection Gate: ${state.roleSelectionDebugOverride}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLE_SELECTION_BUTTONS.map((button) => (
              <button
                key={button.value}
                type="button"
                className={routeButtonClassName(state.roleSelectionDebugOverride === button.value)}
                onClick={() => {
                  void handleRoleSelectionOverrideChange(button.value);
                }}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-token-description-foreground">
            {`Onboarding plugin checklist: ${state.pluginChecklistActive ? "active" : "inactive"}`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={routeButtonClassName(state.pluginChecklistActive)}
              onClick={() => {
                void handlePluginChecklistChange(true);
              }}
            >
              Checklist on
            </button>
            <button
              type="button"
              className={routeButtonClassName(!state.pluginChecklistActive)}
              onClick={() => {
                void handlePluginChecklistChange(false);
              }}
            >
              Checklist off
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-token-description-foreground">
            {`Workspace onboarding experiment: ${workspaceExperimentArm}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_EXPERIMENT_BUTTONS.map((button) => (
              <button
                key={button.value}
                type="button"
                className={routeButtonClassName(workspaceExperimentArm === button.value)}
                onClick={() => {
                  void handleWorkspaceExperimentChange(button.value);
                }}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="text-token-description-foreground">
            {`Remote Connections home announcement: ${state.hasSeenRemoteConnectionsHomeAnnouncement ? "seen" : "unseen"}`}
          </div>
          <button
            type="button"
            className="rounded border border-token-border px-3 py-1 text-token-description-foreground hover:bg-token-foreground/5"
            onClick={() => {
              void handleRemoteConnectionsAnnouncementReset();
            }}
          >
            Reset announcement
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="text-token-description-foreground">
            {`Codex mobile home announcement: ${state.hasSeenCodexMobileHomeAnnouncement ? "seen" : "unseen"}`}
          </div>
          <button
            type="button"
            className="rounded border border-token-border px-3 py-1 text-token-description-foreground hover:bg-token-foreground/5"
            onClick={() => {
              void handleCodexMobileAnnouncementReset();
            }}
          >
            Reset announcement
          </button>
          <button
            type="button"
            className="rounded border border-token-border px-3 py-1 text-token-description-foreground hover:bg-token-foreground/5"
            onClick={() => {
              void handleCodexMobileAnnouncementPreview();
            }}
          >
            Preview announcement
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="text-token-description-foreground">
            {`Browser comment mode coachmark: ${state.browserCommentModeCoachmarkDismissed ? "seen" : "unseen"}`}
          </div>
          <button
            type="button"
            className="rounded border border-token-border px-3 py-1 text-token-description-foreground hover:bg-token-foreground/5"
            onClick={() => {
              void handleBrowserCoachmarkReset();
            }}
          >
            Reset coachmark
          </button>
        </div>
      </div>
    </DebugSection>
  );

  async function handleRouteOverrideChange(value: OnboardingRouteOverrideValue) {
    setState((current) => ({ ...current, routeOverride: value }));
    const writes = [setGlobalState("electron:onboarding-override", value)];
    if (value === "workspace") {
      writes.push(setGlobalState("electron:onboarding-workspace-autolaunch-applied", false));
    }
    await Promise.all(writes);
  }

  async function handleResetOnboarding() {
    setState((current) => ({
      ...current,
      pluginChecklistActive: false,
      projectlessCompleted: false,
      routeOverride: "welcome",
      welcomePending: true,
    }));
    await Promise.all([
      setGlobalState("use-copilot-auth-if-available", false),
      setGlobalState("electron:onboarding-override", "welcome"),
      setGlobalState("electron:onboarding-welcome-pending", true),
      setGlobalState("electron:onboarding-projectless-completed", false),
      setGlobalState("electron:onboarding-plugin-checklist-active", false),
      setGlobalState("electron:onboarding-workspace-autolaunch-applied", false),
    ]);
    await logout().catch(() => undefined);
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }

  async function handleRoleSelectionOverrideChange(value: RoleSelectionOverrideValue) {
    setState((current) => ({ ...current, roleSelectionDebugOverride: value }));
    await setGlobalState("electron:onboarding-welcome-v2-role-selection-debug-override", value);
  }

  async function handlePluginChecklistChange(enabled: boolean) {
    setState((current) => ({ ...current, pluginChecklistActive: enabled }));
    await setGlobalState("electron:onboarding-plugin-checklist-active", enabled);
  }

  async function handleWorkspaceExperimentChange(value: WorkspaceExperimentValue) {
    const nextAssignment = value === "auto"
      ? null
      : {
          arm: value,
          assignedAtMs: Date.now(),
          experimentName: WORKSPACE_ONBOARDING_EXPERIMENT_NAME,
        } satisfies Exclude<WorkspaceOnboardingExperimentAssignment, null>;
    setState((current) => ({
      ...current,
      workspaceExperimentAssignment: nextAssignment,
    }));
    await setGlobalState("electron:onboarding-workspace-experiment-assignment", nextAssignment);
  }

  async function handleRemoteConnectionsAnnouncementReset() {
    setState((current) => ({ ...current, hasSeenRemoteConnectionsHomeAnnouncement: false }));
    await setGlobalState("has-seen-remote-connections-home-announcement", false);
  }

  async function handleCodexMobileAnnouncementReset() {
    setState((current) => ({ ...current, hasSeenCodexMobileHomeAnnouncement: false }));
    await setGlobalState("has-seen-codex-mobile-home-announcement", false);
  }

  async function handleCodexMobileAnnouncementPreview() {
    setState((current) => ({ ...current, hasSeenCodexMobileHomeAnnouncement: false }));
    await Promise.all([
      setGlobalState("has-completed-codex-mobile-setup", true),
      setGlobalState("has-seen-codex-mobile-home-announcement", false),
    ]);
  }

  async function handleBrowserCoachmarkReset() {
    setState((current) => ({ ...current, browserCommentModeCoachmarkDismissed: false }));
    await setGlobalState("browser-sidebar-comment-mode-coachmark-dismissed", false);
  }
}

export function RealtimeVoiceSection({
  initialDebugDisabled,
}: {
  initialDebugDisabled: boolean;
}) {
  const gateEnabled = useReplicaStatsigState().gates["2380644311"] === true;
  const [debugDisabled, setDebugDisabled] = useState(initialDebugDisabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setDebugDisabled(initialDebugDisabled);
  }, [initialDebugDisabled]);

  const effectiveVoiceModeEnabled = gateEnabled && !debugDisabled;

  return (
    <DebugSection storageKey={REALTIME_VOICE_STORAGE_KEY} title="Realtime voice" variant="global">
      <DebugFieldList
        lines={[
          { label: "Statsig gate", value: gateEnabled ? "Enabled" : "Disabled" },
          { label: "Debug override", value: debugDisabled ? "Forcing off" : "Off" },
          { label: "Effective voice mode", value: effectiveVoiceModeEnabled ? "Enabled" : "Disabled" },
        ]}
      />
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="text-xs text-token-description-foreground">
          Force realtime voice mode off in this app and new app-server threads.
        </div>
        <ToggleSwitch
          ariaLabel="Force realtime voice mode off"
          checked={debugDisabled}
          disabled={isPending}
          onChange={(checked) => {
            void handleChange(checked);
          }}
        />
      </div>
      {error ? <div className="py-1.5 text-xs text-token-error-foreground">{error}</div> : null}
    </DebugSection>
  );

  async function handleChange(checked: boolean) {
    setError(null);
    setDebugDisabled(checked);
    setIsPending(true);
    try {
      await setGlobalState("realtime-voice-mode-debug-disabled", checked);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update realtime voice override.");
    } finally {
      setIsPending(false);
    }
  }
}

export function GlobalDictationSection({
  initialForceLockEnabled,
}: {
  initialForceLockEnabled: boolean;
}) {
  const [forceLockEnabled, setForceLockEnabled] = useState(initialForceLockEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setForceLockEnabled(initialForceLockEnabled);
  }, [initialForceLockEnabled]);

  return (
    <DebugSection storageKey={GLOBAL_DICTATION_STORAGE_KEY} title="Global dictation" variant="global">
      <DebugFieldList lines={[{ label: "Lock override", value: forceLockEnabled ? "Force claiming" : "Off" }]} />
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="text-xs text-token-description-foreground">
          Force this dev app to own the global dictation window lock.
        </div>
        <ToggleSwitch
          ariaLabel="Force this app to own global dictation"
          checked={forceLockEnabled}
          disabled={isPending}
          onChange={(checked) => {
            void handleChange(checked);
          }}
        />
      </div>
      {error ? <div className="py-1.5 text-xs text-token-error-foreground">{error}</div> : null}
    </DebugSection>
  );

  async function handleChange(checked: boolean) {
    setError(null);
    setForceLockEnabled(checked);
    setIsPending(true);
    try {
      await setGlobalState("global-dictation-force-lock-debug-enabled", checked);
      await setGlobalDictationForceLockChanged(checked);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to update global dictation lock override.",
      );
    } finally {
      setIsPending(false);
    }
  }
}

export function PopoutWindowHotkeySection({
  initialState,
}: {
  initialState: HotkeyWindowHotkeyStateResponse | null;
}) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  if (state == null || state.supported === false || state.isDevMode === false) {
    return null;
  }

  const configuredHotkeyLabel = state.configuredHotkey == null ? "Off" : formatAcceleratorLabel(state.configuredHotkey);
  const buttonDisabled = state.configuredHotkey == null || isPending;
  const buttonLabel = state.isDevOverrideEnabled ? "Disable dev override" : "Enable hotkey in dev";

  return (
    <DebugSection storageKey={HOTKEY_WINDOW_STORAGE_KEY} title="Popout Window hotkey" variant="global">
      <DebugFieldList
        lines={[
          { label: "Configured hotkey", value: configuredHotkeyLabel },
          { label: "Gate", value: state.isGateEnabled ? "Enabled" : "Disabled" },
          { label: "Runtime", value: state.isActive ? "Active" : "Inactive" },
          { label: "Dev override", value: state.isDevOverrideEnabled ? "Enabled" : "Disabled" },
        ]}
      />
      <div className="flex flex-col gap-2 py-1.5">
        <button
          type="button"
          className="inline-flex w-fit items-center rounded border border-token-border px-3 py-1 text-xs text-token-foreground hover:bg-token-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={buttonDisabled}
          onClick={() => {
            void handleToggle();
          }}
        >
          {buttonLabel}
        </button>
        {state.configuredHotkey == null ? (
          <div className="text-xs text-token-description-foreground">
            Set a Popout Window hotkey in Settings to use dev override.
          </div>
        ) : null}
        {error ? <div className="text-xs text-token-error-foreground">{error}</div> : null}
      </div>
    </DebugSection>
  );

  async function handleToggle() {
    if (state == null) {
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      const response = await setHotkeyWindowDevHotkeyOverride(!state.isDevOverrideEnabled);
      setState(response.state);
      if (!response.success) {
        setError(response.error ?? "Failed to update dev override.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update dev override.");
    } finally {
      setIsPending(false);
    }
  }
}

function DebugFieldList({ lines }: { lines: FieldLine[] }) {
  return (
    <div className="flex flex-col py-1.5">
      {lines.map((line) => (
        <DebugField key={line.label} label={line.label} value={line.value} />
      ))}
    </div>
  );
}

function collectReferencedFiles(inputs: ThreadConversationUserInput[]) {
  const referencedFiles: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const path = readInputPath(input);
    if (path == null || seen.has(path)) {
      continue;
    }
    seen.add(path);
    referencedFiles.push(path);
  }

  return referencedFiles;
}

function readInputPath(input: ThreadConversationUserInput) {
  switch (input.type) {
    case "comment":
    case "localImage":
    case "mention":
    case "skill":
      return normalizeDebugValue(input.path, null);
    case "image":
    case "text":
      return null;
  }
}

function routeButtonClassName(active: boolean) {
  return [
    "rounded border px-3 py-1 text-xs",
    active
      ? "border-token-focus-border text-token-foreground"
      : "border-token-border text-token-description-foreground hover:bg-token-foreground/5",
  ].join(" ");
}

function normalizeDebugValue(value: string | null | undefined, fallback: string): string;
function normalizeDebugValue(value: string | null | undefined, fallback: null): string | null;
function normalizeDebugValue(value: string | null | undefined, fallback: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function formatPrimaryRuntimeProgress(progress: PrimaryRuntimeInstallProgressEvent) {
  const bytesLabel = progress.downloadedBytes == null
    ? null
    : progress.totalBytes == null
      ? `${formatMegabytes(progress.downloadedBytes)} downloaded`
      : `${formatMegabytes(progress.downloadedBytes)} / ${formatMegabytes(progress.totalBytes)}`;
  return [progress.phase, bytesLabel, normalizeDebugValue(progress.errorMessage, null)].filter(Boolean).join(" · ");
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
