import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  formatAuthDetail,
  formatAuthLabel,
  getLaunchContext,
  getAuthSnapshot,
  initialAuthSnapshot,
  isUsageSettingsPlanSupported,
  logout,
  onAuthSnapshotChange,
  type AuthSnapshot,
  type LaunchContext,
} from "./services/auth";
import {
  archiveThread,
  discardConversationFromCache,
  forkConversationFromLatest,
  respondToApprovalRequest,
  respondToMcpServerElicitationRequest,
  respondToPermissionsRequestApproval,
  respondToToolRequestUserInput,
  forkThread,
  setThreadName,
  rollbackThread,
  type ApprovalDecision,
  buildProjectGroups,
  type ThreadConversationItem,
  type ThreadConversationUserInput,
  getRecentThreads,
  interruptTurn,
  onThreadEvent,
  readThread,
  startReview,
  startConversation,
  startThread,
  steerTurn,
  startTurn,
  startTurnWithInput,
  type TurnStartPermissionOverrides,
  type HistoryProjectGroup,
  type ThreadHistoryEntry,
  type FileChangeSummary,
  type ToolRequestUserInputQuestion,
  type ThreadConversation,
} from "./services/history";
import {
  applyGpuTearingDebugSettings,
  applyAppearanceSettingsSnapshot,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  getGlobalState,
  onGpuTearingDebugSettingsChanged,
  onGlobalStateUpdated,
  readPreventSleepWhileRunningPreference,
  type ComposerEnterBehavior,
  type FollowUpQueueMode,
  type ReviewDelivery,
  readAppearanceSettingsSnapshot,
  readConfig,
  readGpuTearingDebugSettings,
  readSelectedAvatarId,
  setPowerSaveBlocker,
  writeConfigValue,
  type ConfigScopeOption,
  type ConfigSnapshot,
} from "./services/settings";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { AccountSettings } from "./components/AccountSettings";
import {
  DEFAULT_AVATAR_ID,
  buildAvatarOptions,
  resolveAvatarOption,
} from "./components/appearance/avatarData";
import {
  BackNavigationIcon,
  BrowserTabIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ForkedConversationIcon,
  ForwardNavigationIcon,
  MoreActionsIcon,
  PlusIcon,
  NewChatIcon,
  ReviewTabIcon,
  SearchIcon,
  SettingsCogIcon,
  WorkspaceFileIcon,
} from "./components/AppShellIcons";
import { AppToastRegion, type AppToast } from "./components/AppToastRegion";
import { ConfigScopeMenu } from "./components/ConfigScopeMenu";
import { DataControlsSettings } from "./components/DataControlsSettings";
import { GitSettings } from "./components/GitSettings";
import { GeneralSettings } from "./components/GeneralSettings";
import { HooksSettings } from "./components/HooksSettings";
import { KeyboardShortcutsSettings } from "./components/KeyboardShortcutsSettings";
import { BrowserUseSettings } from "./components/BrowserUseSettings";
import { LocalEnvironmentsSettings } from "./components/LocalEnvironmentsSettings";
import { McpSettings } from "./components/McpSettings";
import { LoadingPage } from "./components/LoadingPage";
import { OpenSourceLicensesPage } from "./components/OpenSourceLicensesPage";
import { ComputerUseSettings } from "./components/ComputerUseSettings";
import { PersonalizationSettings } from "./components/PersonalizationSettings";
import { PluginsSettings } from "./components/PluginsSettings";
import { BackToAppIcon, SettingsSectionIcon } from "./components/SettingsSectionIcons";
import { SkillsSettings } from "./components/SkillsSettings";
import { UsageSettings } from "./components/UsageSettings";
import { SettingsChoiceMenu } from "./components/SettingsChoiceMenu";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { ChatConversationMainPane } from "./features/chat/ChatConversationMainPane";
import { ChatSidePanel } from "./features/chat/ChatSidePanel";
import { PlanSummaryPage } from "./features/chat/PlanSummaryPage";
import { RightPanelOpenTabMenu, RightPanelTabStrip } from "./features/chat/RightPanelTabStrip";
import {
  WorkspaceFileCommandMenu,
  type WorkspaceFileCommandMenuMode,
} from "./features/chat/WorkspaceFileCommandMenu";
import { renderConversationMarkdown } from "./features/chat/conversationMarkdown";
import { ScratchpadPage } from "./features/scratchpad/ScratchpadPage";
import { SkillsRoutePage } from "./features/skills/SkillsRoutePage";
import { usePluginsRouteEnabled } from "./features/skills/usePluginsRouteEnabled";
import { AutomationsRoutePage } from "./features/automations/AutomationsRoutePage";
import { EditorDiffPage } from "./features/editorDiff/EditorDiffPage";
import { GlobalDictationPage } from "./features/globalDictation/GlobalDictationPage";
import { HotkeyWindowHomePage } from "./features/hotkeyWindow/HotkeyWindowHomePage";
import { HotkeyWindowNewThreadPage } from "./features/hotkeyWindow/HotkeyWindowNewThreadPage";
import { LoginRoutePage } from "./features/auth/LoginRoutePage";
import {
  isLoginOnboardingRoute,
  resolveLoginOnboardingRouteTarget,
} from "./features/auth/loginRouteRouting";
import { PullRequestsRoutePage } from "./features/pullRequests/PullRequestsRoutePage";
import { ThreadHeartbeatAutomationDialog } from "./features/automations/ThreadHeartbeatAutomationDialog";
import { formatHeartbeatAutomationTooltip } from "./features/automations/time";
import { FirstRunPage } from "./features/firstRun/FirstRunPage";
import { SelectWorkspacePage } from "./features/onboarding/SelectWorkspacePage";
import { WelcomePage } from "./features/onboarding/WelcomePage";
import { AvatarOverlayPage } from "./features/avatarOverlay/AvatarOverlayPage";
import { DebugWindowPage as DebugWindowPageContent } from "./features/debug/DebugWindowPage";
import { useReplicaStatsigOwner } from "./features/statsig/replicaStatsig";
import { WorktreesSettingsPage } from "./features/worktrees/WorktreesSettingsPage";
import { WorktreeInitV2Page } from "./features/worktreeInit/WorktreeInitV2Page";
import {
  createSideChatRightPanelTab,
  createStaticRightPanelTab,
  createWorkspaceFileRightPanelTab,
  isSideChatRightPanelTab,
  isStaticRightPanelTab,
  isWorkspaceFileRightPanelTab,
  isWorkspaceFileRightPanelTabId,
  type RightPanelTab,
  type StaticRightPanelTabId,
} from "./features/chat/rightPanelTabs";
import {
  enqueueQueuedLocalFollowUp,
  prependQueuedLocalFollowUp,
  queuedLocalFollowUpsForThread,
  removeQueuedLocalFollowUp,
  takeNextQueuedLocalFollowUp,
  type QueuedLocalFollowUp,
} from "./features/chat/localFollowUpQueue";
import {
  approvalRequestKey,
  appendSteeringUserMessage,
  buildPendingImplementPlanRequestForTurn,
  clearUnacceptedSteeringUserMessagesForTurn,
  completeMcpServerElicitationConversationItem,
  completePermissionRequestConversationItem,
  createMcpServerElicitationRequestResponse,
  createSteeringUserMessage,
  createPermissionsRequestApprovalResponse,
  buildThreadDiffSummary,
  clearPendingImplementPlanRequestsForThread,
  createToolRequestUserInputResponse,
  foldCompletedThreadItemWithSteer,
  foldStartedThreadItemWithSteer,
  isWorkStartedConversationItem,
  removePendingImplementPlanRequest,
  removeRequestConversationItem,
  upsertThreadConversationTurnTiming,
  upsertPendingImplementPlanRequest,
  upsertPendingApproval,
  upsertMcpServerElicitationConversationItem,
  upsertPendingMcpServerElicitationRequest,
  upsertPendingPermissionsRequestApproval,
  upsertPermissionRequestConversationItem,
  upsertPendingToolRequestUserInput,
  upsertUserInputConversationItem,
  type PendingImplementPlanRequest,
  type PendingApproval,
  type PendingMcpServerElicitationRequest,
  type PendingPermissionsRequestApproval,
  type PendingToolRequestUserInput,
} from "./features/chat/threadConversationState";
import { useI18n } from "./i18n/i18n";
import type { MessageKey } from "./i18n/messages";
import {
  buildAcceleratorFromKeyboardEvent,
  getCommandKeymapState,
  getCommandShortcutAccelerators,
  type CommandKeymapState,
} from "./services/keyboardShortcuts";
import {
  DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT,
  AVATAR_OVERLAY_ROUTE_PATH,
  DEBUG_WINDOW_ROUTE_PATH,
  EDITOR_DIFF_ROUTE_PATH,
  FIRST_RUN_ROUTE_PATH,
  GLOBAL_DICTATION_ROUTE_PATH,
  HOTKEY_NEW_THREAD_ROUTE_PATH,
  HOTKEY_WORKTREE_INIT_V2_ROUTE_PREFIX,
  LOGIN_ROUTE_PATH,
  buildWorktreeInitV2RoutePath,
  notifyDebugWindowOriginConversationChanged,
  openInHotkeyWindow,
  PLAN_SUMMARY_ROUTE_PATH,
  SELECT_WORKSPACE_ROUTE_PATH,
  WORKTREE_INIT_V2_ROUTE_PREFIX,
  WELCOME_ROUTE_PATH,
  takePendingDebugWindowOriginConversation,
  takePendingPlanSummary,
  takePendingWindowRoute,
  type PendingPlanSummaryState,
} from "./services/windowNavigation";
import {
  onDebugRunAppActionRequest,
  respondToDebugRunAppAction,
  type DebugRunAppActionRequestNotification,
} from "./services/debug";
import {
  estimateUtf8Bytes,
  notifyViewFocused,
  onAppStateSnapshotRequested,
  readRendererFrameIntervalSnapshot,
  sendAppStateSnapshotResponse,
  setReviewPaneSnapshotMetricsForHost,
  startRendererFrameIntervalSampler,
  type AppStateSnapshotFields,
} from "./services/appStateSnapshot";
import { readComputerUseApprovalsVisibility } from "./services/computerUseSettings";
import { getCodexHomePath, isWithinCodexWorktrees } from "./services/codexHome";
import {
  filterConnectedSettingsRemoteConnections,
  getSettingsRemoteHostColor,
  LOCAL_SETTINGS_HOST_ID,
  normalizeRemoteConnectionsSnapshot,
  normalizeSelectedSettingsHostId,
  onRemoteAppServerConnectionStateChanged,
  onSharedObjectUpdated,
  readSettingsRemoteConnectionStates,
  readInitialSettingsHostId,
  readSettingsRemoteConnectionsSnapshot,
  REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  type AppServerConnectionState,
  type RemoteConnection,
} from "./services/settingsHosts";
import {
  onActiveWorkspaceRootsUpdated,
  readActiveWorkspaceRoots,
} from "./services/workspaceRoots";
import { createPendingWorktree, type PendingWorktreeStartingState } from "./services/pendingWorktrees";
import type { WorkspaceFilePreviewTarget } from "./services/workspaceFiles";
import {
  buildAutomationDraft,
  deleteAutomation,
  listAutomations,
  notifyHeartbeatAutomationThreadStateChanged,
  type AutomationRecord,
  type HeartbeatAutomationRecord,
} from "./services/automations";
import {
  ensureCustomAvatarsLoaded,
  getCustomAvatarsSnapshot,
  subscribeCustomAvatars,
} from "./services/customAvatars";

const appWindow = getCurrentWindow();
const AGENT_SETTINGS_DOCS_URL = "https://developers.openai.com/codex/app/local-environments";
const CONFIG_TOML_DOCS_URL = "https://developers.openai.com/codex/config-basic";
const IMPLEMENT_PLAN_PROMPT_PREFIX = "PLEASE IMPLEMENT THIS PLAN:";
const USER_MESSAGE_REQUEST_HEADING = "## My request for Codex:";
const NAVIGATE_TO_ROUTE_EVENT = "navigate-to-route";
const TOGGLE_DIFF_PANEL_EVENT = "toggle-diff-panel";
const WELCOME_V2_ONBOARDING_QUERY_PARAM = "welcomeV2Onboarding";
const HOTKEY_HOME_ROUTE_PATH = "/hotkey-window";
type WorkspaceFileRightPanelTabState = Extract<RightPanelTab, { kind: "workspaceFile" }>;
type PersistedWorkspaceFileRightPanelTabState = {
  workspaceFileTabsByThreadId: Array<[string, WorkspaceFileRightPanelTabState[]]>;
  activeWorkspaceFileTabIdByThreadId: Array<[string, string]>;
};

const WORKSPACE_FILE_RIGHT_PANEL_TAB_STATE_STORAGE_KEY =
  "codex-app-replica.workspace-file-right-panel-tabs.v1";

type SettingsSection =
  | "general-settings"
  | "account"
  | "appearance"
  | "git-settings"
  | "connections"
  | "agent"
  | "open-source-licenses"
  | "personalization"
  | "browser-use"
  | "computer-use"
  | "usage"
  | "plugins-settings"
  | "skills-settings"
  | "keyboard-shortcuts"
  | "mcp-settings"
  | "hooks-settings"
  | "local-environments"
  | "worktrees"
  | "data-controls";
type SettingsSectionState = {
  licensesBackPath?: string;
  localEnvironmentRouteSearch?: string;
} | null;
type AgentConfigControlErrors = Partial<Record<"approval" | "sandbox" | "network", string>>;
type AppRoute =
  | "chat"
  | "hotkey-home"
  | "hotkey-new-thread"
  | "settings"
  | "skills"
  | "scratchpad"
  | "automations"
  | "pull-requests"
  | "login"
  | "select-workspace"
  | "welcome"
  | "first-run"
  | "plan-summary"
  | "editor-diff"
  | "global-dictation"
  | "worktree-init"
  | "avatar-overlay"
  | "debug";
type SkillsRouteInitialTab = "plugins" | "skills";
type SkillsPageRouteState = {
  initialTab?: SkillsRouteInitialTab;
  pluginDeepLinkAuthBlocked?: boolean;
};
type NavigateToRouteState = {
  conversationId?: string;
  cwd?: string | null;
  focusComposerNonce?: number;
  initialHostId?: string;
  initialTab?: SkillsRouteInitialTab;
  pluginDeepLinkAuthBlocked?: boolean;
  prefillPrompt?: string;
  unifiedDiff?: string;
};
type NavigateToRouteNotification = {
  path: string;
  state?: NavigateToRouteState | null;
};
type ToggleDiffPanelNotification = {
  open: boolean;
};
type DebugWindowOriginConversationChangedNotification = {
  conversationId: string;
};
type ThreadShellVariant = "default" | "hotkey";
type ThreadShellRoute = {
  kind: "local" | "remote";
  threadId: string;
  shell: ThreadShellVariant;
};

type WorktreeInitRoute = {
  pendingWorktreeId: string;
  shell: ThreadShellVariant;
};

type PendingWindowPageKind =
  | "thread"
  | "hotkey-home"
  | "hotkey-new-thread"
  | "plan-summary"
  | "editor-diff"
  | "global-dictation"
  | "worktree-init"
  | "debug"
  | null;

const settingsNavItems = [
  { id: "general-settings" as const, labelKey: "settings.nav.general-settings" as const },
  { id: "account" as const, labelKey: "settings.nav.account" as const },
  { id: "appearance" as const, labelKey: "settings.nav.appearance" as const },
  { id: "git-settings" as const, labelKey: "settings.nav.git-settings" as const },
  { id: "connections" as const, labelKey: "settings.nav.connections" as const },
  { id: "agent" as const, labelKey: "settings.nav.agent" as const },
  { id: "personalization" as const, labelKey: "settings.nav.personalization" as const },
  { id: "keyboard-shortcuts" as const, labelKey: "settings.nav.keyboard-shortcuts" as const },
  { id: "usage" as const, labelKey: "settings.nav.usage" as const },
  { id: "browser-use" as const, labelKey: "settings.nav.browser-use" as const },
  { id: "computer-use" as const, labelKey: "settings.nav.computer-use" as const },
  { id: "mcp-settings" as const, labelKey: "settings.nav.mcp-settings" as const },
  { id: "hooks-settings" as const, labelKey: "settings.nav.hooks-settings" as const },
  { id: "local-environments" as const, labelKey: "settings.nav.local-environments" as const },
  { id: "worktrees" as const, labelKey: "settings.nav.worktrees" as const },
  { id: "data-controls" as const, labelKey: "settings.nav.data-controls" as const },
  { id: "plugins-settings" as const, labelKey: "settings.nav.plugins-settings" as const },
  { id: "skills-settings" as const, labelKey: "settings.nav.skills-settings" as const },
];

const settingsNavSectionOrder: SettingsSection[] = [
  "general-settings",
  "account",
  "appearance",
  "git-settings",
  "connections",
  "local-environments",
  "worktrees",
  "agent",
  "personalization",
  "keyboard-shortcuts",
  "usage",
  "browser-use",
  "computer-use",
  "mcp-settings",
  "hooks-settings",
  "plugins-settings",
  "skills-settings",
  "data-controls",
];

const settingsAppGroupSectionOrder: SettingsSection[] = [
  "general-settings",
  "account",
  "appearance",
  "connections",
  "git-settings",
  "usage",
];

const settingsHostGroupSectionOrder: SettingsSection[] = [
  "agent",
  "personalization",
  "keyboard-shortcuts",
  "mcp-settings",
  "hooks-settings",
  "browser-use",
  "computer-use",
  "local-environments",
  "worktrees",
  "data-controls",
];

type NavItem = {
  icon: ReactNode;
  label: string;
  route: AppRoute;
  action?: "new-thread" | "search-files";
  disabled?: boolean;
  tooltipKey?: MessageKey;
};

const approvalPolicyOptions = [
  { value: "untrusted", label: "Untrusted", description: "Always ask before taking action" },
  { value: "on-failure", label: "On failure", description: "Ask only when a command fails" },
  { value: "on-request", label: "On request", description: "Ask when escalation is requested" },
  { value: "never", label: "Never", description: "Run without asking for approval" },
];

const sandboxModeOptions = [
  { value: "read-only", label: "Read only", description: "Can read files, but cannot edit them" },
  { value: "workspace-write", label: "Workspace write", description: "Can edit files, but only in this workspace" },
  { value: "danger-full-access", label: "Full access", description: "Can edit files outside this workspace" },
];

const settingsSectionLabelKeys: Record<SettingsSection, MessageKey> = {
  "general-settings": "settings.section.general-settings",
  account: "settings.section.account",
  appearance: "settings.section.appearance",
  "git-settings": "settings.section.git-settings",
  connections: "settings.section.connections",
  agent: "settings.section.agent",
  "open-source-licenses": "settings.openSourceLicenses.title",
  personalization: "settings.section.personalization",
  "browser-use": "settings.section.browser-use",
  "computer-use": "computerUse.label",
  usage: "settings.section.usage",
  "plugins-settings": "settings.section.plugins-settings",
  "skills-settings": "settings.section.skills-settings",
  "keyboard-shortcuts": "settings.section.keyboard-shortcuts",
  "mcp-settings": "settings.section.mcp-settings",
  "hooks-settings": "settings.section.hooks-settings",
  "local-environments": "settings.section.local-environments",
  worktrees: "settings.section.worktrees",
  "data-controls": "settings.section.data-controls",
};

function isSettingsSection(value: string): value is SettingsSection {
  return Object.prototype.hasOwnProperty.call(settingsSectionLabelKeys, value);
}

function parseSettingsRoute(path: string): SettingsSection | null {
  const normalizedPath = stripRouteSearchAndHash(path);
  const section = normalizedPath.startsWith("/settings/")
    ? normalizedPath.slice("/settings/".length).split("/")[0] ?? ""
    : "";
  return isSettingsSection(section) ? section : null;
}

function parseThreadShellRoute(path: string): ThreadShellRoute | null {
  const normalizedPath = stripRouteSearchAndHash(path);
  const defaultMatch = /^\/(local|remote)\/([A-Za-z0-9._~%-]+)$/.exec(normalizedPath);
  if (defaultMatch) {
    return {
      kind: defaultMatch[1] as ThreadShellRoute["kind"],
      threadId: defaultMatch[2],
      shell: "default",
    };
  }

  const hotkeyThreadMatch = /^\/hotkey-window\/thread\/([A-Za-z0-9._~%-]+)$/.exec(normalizedPath);
  if (hotkeyThreadMatch) {
    return {
      kind: "local",
      threadId: hotkeyThreadMatch[1],
      shell: "hotkey",
    };
  }

  const hotkeyRemoteMatch = /^\/hotkey-window\/remote\/([A-Za-z0-9._~%-]+)$/.exec(normalizedPath);
  if (hotkeyRemoteMatch) {
    return {
      kind: "remote",
      threadId: hotkeyRemoteMatch[1],
      shell: "hotkey",
    };
  }

  return null;
}

function parseWorktreeInitRoute(path: string): WorktreeInitRoute | null {
  const normalizedPath = stripRouteSearchAndHash(path);

  if (normalizedPath.startsWith(WORKTREE_INIT_V2_ROUTE_PREFIX)) {
    const pendingWorktreeId = decodeRouteSegment(normalizedPath.slice(WORKTREE_INIT_V2_ROUTE_PREFIX.length));
    return pendingWorktreeId === null ? null : { pendingWorktreeId, shell: "default" };
  }

  if (normalizedPath.startsWith(HOTKEY_WORKTREE_INIT_V2_ROUTE_PREFIX)) {
    const pendingWorktreeId = decodeRouteSegment(
      normalizedPath.slice(HOTKEY_WORKTREE_INIT_V2_ROUTE_PREFIX.length),
    );
    return pendingWorktreeId === null ? null : { pendingWorktreeId, shell: "hotkey" };
  }

  return null;
}

function isPlanSummaryRoute(path: string) {
  return path === PLAN_SUMMARY_ROUTE_PATH;
}

function isHotkeyHomeRoute(path: string) {
  return stripRouteSearchAndHash(path) === HOTKEY_HOME_ROUTE_PATH;
}

function isEditorDiffRoute(path: string) {
  return path === EDITOR_DIFF_ROUTE_PATH;
}

function isFirstRunRoute(path: string) {
  return path === FIRST_RUN_ROUTE_PATH;
}

function isGlobalDictationRoute(path: string) {
  return path === GLOBAL_DICTATION_ROUTE_PATH;
}

function isHotkeyNewThreadRoute(path: string) {
  return path === HOTKEY_NEW_THREAD_ROUTE_PATH;
}

function isLoginRoute(path: string) {
  return path === LOGIN_ROUTE_PATH;
}

function isWelcomeRoute(path: string) {
  return path === WELCOME_ROUTE_PATH;
}

function isSelectWorkspaceRoute(path: string) {
  return path === SELECT_WORKSPACE_ROUTE_PATH;
}

function isAvatarOverlayRoute(path: string) {
  return path === AVATAR_OVERLAY_ROUTE_PATH;
}

function isDebugWindowRoute(path: string) {
  return path === DEBUG_WINDOW_ROUTE_PATH;
}

function isPullRequestsRoute(path: string) {
  return path === "/pull-requests";
}

function readInitialAppRoute(): AppRoute {
  if (typeof window !== "undefined" && isHotkeyHomeRoute(window.location.pathname)) {
    return "hotkey-home";
  }

  if (typeof window !== "undefined" && isHotkeyNewThreadRoute(window.location.pathname)) {
    return "hotkey-new-thread";
  }

  if (typeof window !== "undefined" && parseWorktreeInitRoute(window.location.pathname)) {
    return "worktree-init";
  }

  if (typeof window !== "undefined" && isLoginRoute(window.location.pathname)) {
    return "login";
  }

  if (typeof window !== "undefined" && isWelcomeRoute(window.location.pathname)) {
    return "welcome";
  }

  if (typeof window !== "undefined" && isSelectWorkspaceRoute(window.location.pathname)) {
    return "select-workspace";
  }

  if (typeof window !== "undefined" && isEditorDiffRoute(window.location.pathname)) {
    return "editor-diff";
  }

  if (typeof window !== "undefined" && isGlobalDictationRoute(window.location.pathname)) {
    return "global-dictation";
  }

  if (typeof window !== "undefined" && isFirstRunRoute(window.location.pathname)) {
    return "first-run";
  }

  if (typeof window !== "undefined" && isPullRequestsRoute(window.location.pathname)) {
    return "pull-requests";
  }

  if (typeof window !== "undefined" && isAvatarOverlayRoute(window.location.pathname)) {
    return "avatar-overlay";
  }

  return "chat";
}

// Auxiliary windows share the same native blocker and must not clear it on mount/unmount.
function shouldWindowManagePowerSaveBlocker() {
  if (typeof window === "undefined") {
    return true;
  }

  const { pathname } = window.location;
  if (
    isDebugWindowRoute(pathname) ||
    isPlanSummaryRoute(pathname) ||
    isEditorDiffRoute(pathname) ||
    isGlobalDictationRoute(pathname) ||
    isHotkeyHomeRoute(pathname) ||
    isHotkeyNewThreadRoute(pathname) ||
    parseWorktreeInitRoute(pathname) !== null ||
    isFirstRunRoute(pathname) ||
    isLoginRoute(pathname) ||
    isSelectWorkspaceRoute(pathname) ||
    isWelcomeRoute(pathname) ||
    isAvatarOverlayRoute(pathname)
  ) {
    return false;
  }

  return parseThreadShellRoute(pathname)?.shell !== "hotkey";
}

function stripRouteSearchAndHash(path: string) {
  return path.split(/[?#]/, 1)[0] ?? path;
}

function decodeRouteSegment(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(trimmed).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return trimmed;
  }
}

function buildLocalThreadRoutePath(threadId: string, shell: ThreadShellVariant) {
  const encodedThreadId = encodeURIComponent(threadId);
  return shell === "hotkey"
    ? `/hotkey-window/thread/${encodedThreadId}`
    : `/local/${encodedThreadId}`;
}

function buildRemoteThreadRoutePath(threadId: string, shell: ThreadShellVariant) {
  const encodedThreadId = encodeURIComponent(threadId);
  return shell === "hotkey"
    ? `/hotkey-window/remote/${encodedThreadId}`
    : `/remote/${encodedThreadId}`;
}

function getRightPanelTabLabel(tab: RightPanelTab, t: (key: MessageKey) => string) {
  switch (tab.kind) {
    case "review":
      return t("thread.sidePanel.diffTab");
    case "browser":
      return t("thread.sidePanel.browserTab");
    case "sideChat":
      return tab.title;
    case "workspaceFile":
      return tab.title;
  }
}

function renderRightPanelTabIcon(tab: RightPanelTab, className?: string) {
  switch (tab.kind) {
    case "review":
      return <ReviewTabIcon className={className} />;
    case "browser":
      return <BrowserTabIcon className={className} />;
    case "sideChat":
      return <ForkedConversationIcon className={className} />;
    case "workspaceFile":
      return <WorkspaceFileIcon className={className} />;
  }
}

function getConfigScopeLabel(
  scope: ConfigScopeOption,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (scope.kind === "user") {
    return t("settings.agent.configuration.scope.user");
  }
  if (scope.kind === "managed") {
    return t("settings.agent.configuration.scope.managed");
  }
  return scope.label;
}

function getConfigScopeTitle(
  scope: ConfigScopeOption,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (scope.kind === "managed") {
    return t("settings.agent.configuration.scope.managedDescription");
  }
  return scope.filePath;
}

function renderInlineLinkMessage(template: string, href: string) {
  const startTag = "<a>";
  const endTag = "</a>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const linkLabel = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <>
      {prefix}
      <a
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {linkLabel}
      </a>
      {suffix}
    </>
  );
}

function getAgentConfigControlLockReason(
  scope: ConfigScopeOption | null,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (!scope) {
    return t("settings.agent.configuration.scope.unavailable");
  }
  if (!scope.filePath) {
    return t("settings.agent.configuration.scope.readOnly");
  }
  if (scope.kind === "managed") {
    return t("settings.agent.configuration.control.managed");
  }
  return null;
}

function renderConfigTomlDescription(t: (key: MessageKey, values?: Record<string, number | string>) => string) {
  return (
    <>
      {t("settings.agent.configuration.configToml.description")}{" "}
      {t("settings.agent.configuration.configToml.restartNote")}{" "}
      <a
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
        href={CONFIG_TOML_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {t("settings.agent.configuration.configToml.docs")}
      </a>
    </>
  );
}

function readPersistedWorkspaceFileRightPanelTabState(storageKey: string) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as PersistedWorkspaceFileRightPanelTabState;
    if (
      !Array.isArray(parsed.workspaceFileTabsByThreadId) ||
      !Array.isArray(parsed.activeWorkspaceFileTabIdByThreadId)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePersistedWorkspaceFileRightPanelTabState(
  storageKey: string,
  state: PersistedWorkspaceFileRightPanelTabState,
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore persistence failures; the in-memory thread cache still works for this session.
  }
}

function mergeSyntheticRequestItemsIntoConversation(
  conversation: ThreadConversation,
  syntheticItemsByThreadId: Record<string, ThreadConversationItem[]>,
) {
  const syntheticItems = syntheticItemsByThreadId[conversation.id] ?? [];
  if (syntheticItems.length === 0) {
    return conversation;
  }

  return {
    ...conversation,
    items: [...conversation.items, ...syntheticItems],
  };
}

function updateSyntheticRequestItemsForThread(
  current: Record<string, ThreadConversationItem[]>,
  threadId: string,
  updater: (items: ThreadConversationItem[]) => ThreadConversationItem[],
) {
  const existingItems = current[threadId] ?? [];
  const nextItems = updater(existingItems);
  if (nextItems === existingItems) {
    return current;
  }

  if (nextItems.length === 0) {
    if (!(threadId in current)) {
      return current;
    }
    const next = { ...current };
    delete next[threadId];
    return next;
  }

  return {
    ...current,
    [threadId]: nextItems,
  };
}

function replaceEditedUserRequestText(originalText: string, editedMessage: string) {
  const segments = originalText.split(USER_MESSAGE_REQUEST_HEADING);
  if (segments.length <= 1) {
    return editedMessage;
  }
  return `${segments.slice(0, -1).join(USER_MESSAGE_REQUEST_HEADING).trimEnd()}\n${USER_MESSAGE_REQUEST_HEADING}\n${editedMessage}\n`;
}

function replaceFirstTextInput(
  input: ThreadConversationUserInput[],
  editedMessage: string,
): ThreadConversationUserInput[] {
  const textInputIndex = input.findIndex((item) => item.type === "text");
  if (textInputIndex === -1) {
    return input;
  }
  return input.map((item, index) => {
    if (index !== textInputIndex || item.type !== "text") {
      return item;
    }
    return {
      ...item,
      text: replaceEditedUserRequestText(item.text, editedMessage),
      textElements: [],
    };
  });
}

function isEditableUserMessageText(text: string) {
  return !text.trim().startsWith(IMPLEMENT_PLAN_PROMPT_PREFIX);
}

function findLastEditableUserMessage(
  conversation: ThreadConversation | null,
  activeTurn: { threadId: string; turnId: string } | null,
) {
  if (!conversation || activeTurn?.threadId === conversation.id) {
    return null;
  }
  const lastTurn = conversation.turns.at(-1) ?? null;
  if (!lastTurn || lastTurn.status === "inProgress" || lastTurn.status === "in_progress") {
    return null;
  }
  const message = [...conversation.items]
    .reverse()
    .find(
      (item): item is Extract<ThreadConversationItem, { type: "userMessage" }> =>
        item.type === "userMessage" && item.turnId === lastTurn.id && isEditableUserMessageText(item.text),
    );
  if (!message) {
    return null;
  }
  return {
    threadId: conversation.id,
    turnId: lastTurn.id,
    input: lastTurn.input,
  };
}

function isInProgressTurnStatus(status: string) {
  return status === "inProgress" || status === "in_progress";
}

function countInProgressTurns(conversation: ThreadConversation) {
  return conversation.turns.reduce((count, turn) => count + (isInProgressTurnStatus(turn.status) ? 1 : 0), 0);
}

function App() {
  const { locale, t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>(initialAuthSnapshot);
  const [launchContext, setLaunchContext] = useState<LaunchContext | null>(null);
  const [hasLoadedAuthSnapshot, setHasLoadedAuthSnapshot] = useState(false);
  const [hasLoadedLaunchContext, setHasLoadedLaunchContext] = useState(false);
  const [loginRouteOverride, setLoginRouteOverride] = useState<string | null>("auto");
  const [postLoginWelcomePending, setPostLoginWelcomePending] = useState(false);
  const [projectlessOnboardingCompleted, setProjectlessOnboardingCompleted] = useState(false);
  const [activeWorkspaceRootCount, setActiveWorkspaceRootCount] = useState<number | null>(null);
  const [isActiveWorkspaceRootsLoading, setIsActiveWorkspaceRootsLoading] = useState(true);
  const [hasLoadedInitialWindowRoute, setHasLoadedInitialWindowRoute] = useState(false);
  const [hasLoadedInitialThreadSnapshot, setHasLoadedInitialThreadSnapshot] = useState(false);
  const [pendingPlanSummary, setPendingPlanSummary] = useState<PendingPlanSummaryState | null>(null);
  const [editorDiffRouteState, setEditorDiffRouteState] = useState<unknown | null>(() =>
    typeof window === "undefined" ? null : window.history.state,
  );
  const [worktreeInitRoute, setWorktreeInitRoute] = useState<WorktreeInitRoute | null>(() =>
    typeof window === "undefined" ? null : parseWorktreeInitRoute(window.location.pathname),
  );
  const [projectGroups, setProjectGroups] = useState<HistoryProjectGroup[]>([]);
  const [recentThreads, setRecentThreads] = useState<ThreadHistoryEntry[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadConversation, setThreadConversation] = useState<ThreadConversation | null>(null);
  const [isThreadConversationLoading, setIsThreadConversationLoading] = useState(false);
  const [syntheticRequestItemsByThreadId, setSyntheticRequestItemsByThreadId] = useState<
    Record<string, ThreadConversationItem[]>
  >({});
  const [composerDraft, setComposerDraft] = useState("");
  const [composerEnterBehavior, setComposerEnterBehavior] = useState<ComposerEnterBehavior>("enter");
  const [followUpQueueMode, setFollowUpQueueMode] = useState<FollowUpQueueMode>("queue");
  const [reviewDelivery, setReviewDelivery] = useState<ReviewDelivery>("inline");
  const [preventSleepWhileRunning, setPreventSleepWhileRunning] = useState(false);
  const [customAvatarsSnapshot, setCustomAvatarsSnapshot] = useState(getCustomAvatarsSnapshot());
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(DEFAULT_AVATAR_ID);
  const [activeTurn, setActiveTurn] = useState<{ threadId: string; turnId: string } | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [queuedFollowUps, setQueuedFollowUps] = useState<QueuedLocalFollowUp[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [pendingMcpServerElicitationRequest, setPendingMcpServerElicitationRequest] = useState<
    PendingMcpServerElicitationRequest[]
  >([]);
  const [pendingPermissionsRequestApproval, setPendingPermissionsRequestApproval] = useState<
    PendingPermissionsRequestApproval[]
  >([]);
  const [pendingToolRequestUserInput, setPendingToolRequestUserInput] = useState<PendingToolRequestUserInput[]>([]);
  const [pendingImplementPlanRequests, setPendingImplementPlanRequests] = useState<PendingImplementPlanRequest[]>([]);
  const [approvalActionErrors, setApprovalActionErrors] = useState<Record<string, string>>({});
  const [respondingApprovalKeys, setRespondingApprovalKeys] = useState<string[]>([]);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [openRightPanelTabs, setOpenRightPanelTabs] = useState<RightPanelTab[]>([]);
  const [activeRightPanelTabId, setActiveRightPanelTabId] = useState<string | null>(null);
  const [sideChatConversationsById, setSideChatConversationsById] = useState<Record<string, ThreadConversation>>({});
  const [sideChatComposerDraftsById, setSideChatComposerDraftsById] = useState<Record<string, string>>({});
  const [sideChatTurnErrorsById, setSideChatTurnErrorsById] = useState<Record<string, string | null>>({});
  const [workspaceFileCommandMenuMode, setWorkspaceFileCommandMenuMode] =
    useState<WorkspaceFileCommandMenuMode | null>(null);
  const [threadShellVariant, setThreadShellVariant] = useState<ThreadShellVariant>("default");
  const [isThreadActionsMenuOpen, setIsThreadActionsMenuOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [threadActionFeedback, setThreadActionFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [appToast, setAppToast] = useState<AppToast | null>(null);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(readInitialAppRoute);
  const [composerFocusNonce, setComposerFocusNonce] = useState<number | null>(null);
  const [skillsRouteState, setSkillsRouteState] = useState<SkillsPageRouteState | null>(null);
  const [threadHeaderAutomations, setThreadHeaderAutomations] = useState<AutomationRecord[]>([]);
  const [isThreadHeartbeatAutomationDialogOpen, setIsThreadHeartbeatAutomationDialogOpen] = useState(false);
  const [threadHeartbeatAutomationDialogDraft, setThreadHeartbeatAutomationDialogDraft] =
    useState<HeartbeatAutomationRecord | null>(null);
  const [threadHeartbeatAutomationDialogMode, setThreadHeartbeatAutomationDialogMode] =
    useState<"create" | "edit">("create");
  useReplicaStatsigOwner(authSnapshot);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general-settings");
  const [settingsSectionState, setSettingsSectionState] = useState<SettingsSectionState>(null);
  const [settingsRemoteConnections, setSettingsRemoteConnections] = useState<RemoteConnection[]>([]);
  const [settingsRemoteConnectionStates, setSettingsRemoteConnectionStates] = useState<
    Record<string, AppServerConnectionState>
  >({});
  const [selectedSettingsHostId, setSelectedSettingsHostId] = useState<string>(() => readInitialSettingsHostId());
  const [hasComputerUseApprovalStore, setHasComputerUseApprovalStore] = useState(false);
  const [codexHome, setCodexHome] = useState<string | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configScopeOptions, setConfigScopeOptions] = useState<ConfigScopeOption[]>([]);
  const [selectedConfigScopeKey, setSelectedConfigScopeKey] = useState<string>("user");
  const [agentConfigControlErrors, setAgentConfigControlErrors] = useState<AgentConfigControlErrors>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [commandKeymapState, setCommandKeymapState] = useState<CommandKeymapState | null>(null);
  const avatarOptions = useMemo(
    () => buildAvatarOptions(customAvatarsSnapshot.avatars),
    [customAvatarsSnapshot.avatars],
  );
  const selectedAvatar = useMemo(
    () => resolveAvatarOption(selectedAvatarId, avatarOptions),
    [avatarOptions, selectedAvatarId],
  );
  const connectedSettingsRemoteConnections = useMemo(() => {
    return filterConnectedSettingsRemoteConnections(settingsRemoteConnections, settingsRemoteConnectionStates);
  }, [settingsRemoteConnectionStates, settingsRemoteConnections]);
  const isPluginsRouteEnabled = usePluginsRouteEnabled(selectedSettingsHostId, {
    allowRemoteHost: true,
  });
  const queuedFollowUpsRef = useRef<QueuedLocalFollowUp[]>([]);
  const drainingQueuedThreadIdsRef = useRef(new Set<string>());
  const threadActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const openRightPanelTabsRef = useRef<RightPanelTab[]>([]);
  const activeRightPanelTabIdRef = useRef<string | null>(null);
  const sideChatConversationsByIdRef = useRef<Record<string, ThreadConversation>>({});
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadConversationRef = useRef<ThreadConversation | null>(null);
  const recentThreadsRef = useRef<ThreadHistoryEntry[]>([]);
  const loadedConversationsByIdRef = useRef(new Map<string, ThreadConversation>());
  const snapshotSessionStartedAtMsRef = useRef(Date.now());
  const initialWindowThreadIdRef = useRef<string | null>(null);
  const initialWindowPageKindRef = useRef<PendingWindowPageKind>(null);
  const initialThreadSnapshotLoadedRef = useRef(false);
  const threadLoadRequestIdRef = useRef(0);
  const previousSelectedThreadIdRef = useRef<string | null>(null);
  const workspaceFileTabsByThreadIdRef = useRef(new Map<string, WorkspaceFileRightPanelTabState[]>());
  const activeWorkspaceFileTabIdByThreadIdRef = useRef(new Map<string, string>());
  const openProjectPath = launchContext?.openProjectPath ?? null;
  const chatWorkspaceRoot = threadConversation?.cwd ?? openProjectPath ?? null;
  const settingsWorkspaceRoot = chatWorkspaceRoot;
  const isApiKeyAuth = authSnapshot.authState.authMethod === "apikey";
  const isChatGptAuth = authSnapshot.authState.authMethod === "chatgpt";
  const isWorktreeThread = isWithinCodexWorktrees(threadConversation?.cwd ?? null, codexHome);
  const primarySkillsRouteLabelKey: MessageKey = isChatGptAuth && isPluginsRouteEnabled
      ? "sidebarElectron.skillsAppsRouteNavLink"
      : "sidebarElectron.skillsRouteNavLink";
  const showUsageSettings =
    authSnapshot.authState.authMethod === "chatgpt" &&
    isUsageSettingsPlanSupported(authSnapshot.authState.planAtLogin);
  const hiddenSettingsSectionIds = new Set<SettingsSection>(["account", "plugins-settings", "skills-settings"]);
  const directSettingsRouteIds = new Set<SettingsSection>(["account"]);
  const visibleSettingsNavItems = settingsNavItems.filter(
    (item) =>
      !hiddenSettingsSectionIds.has(item.id) &&
      item.id !== "connections" &&
      item.id !== "hooks-settings" &&
      (item.id !== "computer-use" || hasComputerUseApprovalStore) &&
      (item.id !== "usage" || showUsageSettings),
  );
  const orderedVisibleSettingsNavItems = [
    ...settingsNavSectionOrder.flatMap((sectionId) => {
      const item = visibleSettingsNavItems.find((candidate) => candidate.id === sectionId);
      return item ? [item] : [];
    }),
    ...visibleSettingsNavItems.filter((item) => !settingsNavSectionOrder.includes(item.id)),
  ];
  const settingsRemoteConnectionHostIds = settingsRemoteConnections.map((remoteConnection) => remoteConnection.hostId);
  const shouldGroupSettingsSections = connectedSettingsRemoteConnections.length > 0;
  const settingsNavigationGroups = shouldGroupSettingsSections
    ? [
        {
          key: "app" as const,
          headingKey: "settings.nav.heading.app" as const,
          items: orderSettingsNavigationItems(orderedVisibleSettingsNavItems, settingsAppGroupSectionOrder),
        },
        {
          key: "host" as const,
          headingKey: "settings.nav.heading.host" as const,
          items: orderSettingsNavigationItems(orderedVisibleSettingsNavItems, settingsHostGroupSectionOrder),
        },
      ].filter((group) => group.items.length > 0)
    : [
        {
          key: "settings" as const,
          headingKey: null,
          items: orderedVisibleSettingsNavItems,
        },
      ];
  const firstVisibleSettingsSection =
    orderedVisibleSettingsNavItems[0]?.id ?? "general-settings";
  const isCurrentSettingsSectionVisible = orderedVisibleSettingsNavItems.some(
    (item) => item.id === settingsSection,
  );
  const isCurrentSettingsSectionDirectRoute = directSettingsRouteIds.has(settingsSection);
  const isCurrentSettingsSubpage = settingsSection === "open-source-licenses";
  const menuItems = [t("app.menu.file"), t("app.menu.edit"), t("app.menu.view"), t("app.menu.window"), t("app.menu.help")];
  const navItems: NavItem[] = [
    { action: "new-thread", icon: <NewChatIcon className="h-4 w-4" />, label: t("app.nav.newChat"), route: "chat" },
    {
      action: "search-files",
      icon: <SearchIcon className="h-4 w-4" />,
      label: t("app.nav.search"),
      route: "chat",
    },
    {
      icon: <ClockIcon className="h-4 w-4" />,
      label: t("sidebarElectron.automationsRouteNavLink"),
      route: "automations",
    },
    {
      icon: <SettingsSectionIcon className="h-4 w-4" section="skills-settings" />,
      label: t(primarySkillsRouteLabelKey),
      route: "skills",
    },
    ...(isApiKeyAuth
      ? [
          {
            icon: <SettingsSectionIcon className="h-4 w-4" section="plugins-settings" />,
            label: t("sidebarElectron.pluginsRouteNavLink"),
            route: "skills" as const,
            disabled: true,
            tooltipKey: "sidebarElectron.pluginsDisabledTooltip" as const,
          },
        ]
      : []),
  ];
  const selectedThreadView =
    selectedThreadId === null
      ? null
      : projectGroups.flatMap((group) => group.threads).find((thread) => thread.id === selectedThreadId) ?? null;
  const threadDiffSummary = buildThreadDiffSummary(threadConversation?.items ?? []);
  const totalAdditions = threadDiffSummary.linesAdded;
  const totalDeletions = threadDiffSummary.linesDeleted;
  const reviewDiffBytesEstimate = threadDiffSummary.files.reduce(
    (sum, file) => sum + estimateUtf8Bytes(file.diff ?? ""),
    0,
  );
  const shellHeaderTitle =
    currentRoute === "settings"
      ? `${t("app.shell.settings")} / ${t(settingsSectionLabelKeys[settingsSection])}`
      : currentRoute === "plan-summary"
        ? t("localConversation.planSummary.title")
      : currentRoute === "automations"
        ? t("sidebarElectron.automationsRouteNavLink")
      : currentRoute === "pull-requests"
        ? t("pullRequestsPage.title")
      : currentRoute === "scratchpad"
        ? t("sidebarElectron.scratchpadNavLink")
      : currentRoute === "skills"
        ? t(primarySkillsRouteLabelKey)
      : threadConversation?.title || selectedThreadView?.title || t("app.nav.newChat");
  const isAppBootstrapping =
    !hasLoadedAuthSnapshot ||
    !hasLoadedLaunchContext ||
    !hasLoadedInitialWindowRoute ||
    (!hasLoadedInitialThreadSnapshot &&
      currentRoute !== "hotkey-home" &&
      currentRoute !== "hotkey-new-thread" &&
      currentRoute !== "plan-summary" &&
      currentRoute !== "editor-diff" &&
      currentRoute !== "global-dictation" &&
      currentRoute !== "first-run" &&
      currentRoute !== "login" &&
      currentRoute !== "pull-requests" &&
      currentRoute !== "worktree-init" &&
      currentRoute !== "welcome");
  const isTurnInProgress = activeTurn !== null && activeTurn.threadId === selectedThreadId;
  const editableUserMessage = findLastEditableUserMessage(threadConversation, activeTurn);
  const submitButtonMode = isTurnInProgress && composerDraft.trim().length === 0 ? "stop" : "send";
  const currentThreadApprovals = pendingApprovals.filter((approval) => approval.threadId === selectedThreadId);
  const currentThreadPermissionsRequestApproval = pendingPermissionsRequestApproval.filter(
    (request) => request.threadId === selectedThreadId,
  );
  const currentThreadMcpServerElicitationRequest = pendingMcpServerElicitationRequest.filter(
    (request) => request.threadId === selectedThreadId,
  );
  const currentThreadToolRequestUserInput = pendingToolRequestUserInput.filter(
    (request) => request.threadId === selectedThreadId,
  );
  const currentThreadImplementPlanRequests = pendingImplementPlanRequests.filter(
    (request) => request.threadId === selectedThreadId,
  );
  const currentThreadQueuedFollowUps = queuedLocalFollowUpsForThread(queuedFollowUps, selectedThreadId);
  const activeRightPanelTab = openRightPanelTabs.find((tab) => tab.id === activeRightPanelTabId) ?? null;
  const activeSideChatConversationId =
    activeRightPanelTab && isSideChatRightPanelTab(activeRightPanelTab) ? activeRightPanelTab.conversationId : null;
  const activeSideChatConversation =
    activeSideChatConversationId === null ? null : (sideChatConversationsById[activeSideChatConversationId] ?? null);
  const currentSideChatApprovals = pendingApprovals.filter((approval) => approval.threadId === activeSideChatConversationId);
  const currentSideChatPermissionsRequestApproval = pendingPermissionsRequestApproval.filter(
    (request) => request.threadId === activeSideChatConversationId,
  );
  const currentSideChatMcpServerElicitationRequest = pendingMcpServerElicitationRequest.filter(
    (request) => request.threadId === activeSideChatConversationId,
  );
  const currentSideChatToolRequestUserInput = pendingToolRequestUserInput.filter(
    (request) => request.threadId === activeSideChatConversationId,
  );
  const currentSideChatImplementPlanRequests = pendingImplementPlanRequests.filter(
    (request) => request.threadId === activeSideChatConversationId,
  );
  const currentSideChatQueuedFollowUps = queuedLocalFollowUpsForThread(queuedFollowUps, activeSideChatConversationId);
  const recentThreadEntries = recentThreads;
  const totalPendingRequestCount =
    pendingApprovals.length +
    pendingPermissionsRequestApproval.length +
    pendingMcpServerElicitationRequest.length +
    pendingToolRequestUserInput.length +
    pendingImplementPlanRequests.length;
  const selectedThreadAttachedHeartbeatAutomation: HeartbeatAutomationRecord | null =
    selectedThreadId === null
      ? null
      : threadHeaderAutomations.find(
          (automation): automation is HeartbeatAutomationRecord =>
            automation.kind === "heartbeat" &&
            automation.status === "ACTIVE" &&
            automation.targetThreadId === selectedThreadId,
        ) ?? null;
  const selectedThreadAttachedHeartbeatAutomationIncludingPaused: HeartbeatAutomationRecord | null =
    selectedThreadId === null
      ? null
      : threadHeaderAutomations.find(
          (automation): automation is HeartbeatAutomationRecord =>
            automation.kind === "heartbeat" &&
            (automation.status === "ACTIVE" || automation.status === "PAUSED") &&
            automation.targetThreadId === selectedThreadId,
        ) ?? null;
  const hasBlockingHeartbeatAutomationRequest =
    currentThreadApprovals.length > 0 ||
    currentThreadPermissionsRequestApproval.length > 0 ||
    currentThreadMcpServerElicitationRequest.length > 0 ||
    currentThreadToolRequestUserInput.length > 0 ||
    currentThreadImplementPlanRequests.length > 0;
  const hasHeartbeatAutomationEligibleTurn = (threadConversation?.items.length ?? 0) > 0;
  const heartbeatAutomationEligibilityReason =
    !selectedThreadId || !threadConversation
      ? "missing_conversation"
      : !hasHeartbeatAutomationEligibleTurn
        ? "missing_last_turn"
        : hasBlockingHeartbeatAutomationRequest
          ? "pending_request"
          : isTurnInProgress
            ? "turn_in_progress"
            : null;
  const isHeartbeatAutomationEligible = heartbeatAutomationEligibilityReason === null;
  const shouldShowThreadHeartbeatAutomationAction =
    selectedThreadAttachedHeartbeatAutomationIncludingPaused !== null ||
    isHeartbeatAutomationEligible ||
    heartbeatAutomationEligibilityReason === "turn_in_progress";
  const isThreadHeartbeatAutomationActionDisabled =
    selectedThreadAttachedHeartbeatAutomationIncludingPaused === null && !isHeartbeatAutomationEligible;
  const threadHeartbeatAutomationActionLabelKey: MessageKey =
    selectedThreadAttachedHeartbeatAutomationIncludingPaused !== null
      ? "threadHeader.editAutomation"
      : "threadHeader.addAutomation";
  const heartbeatAutomationOpenButtonTooltip = formatHeartbeatAutomationTooltip({
    locale,
    nextRunAt: selectedThreadAttachedHeartbeatAutomation?.nextRunAt ?? null,
    status: selectedThreadAttachedHeartbeatAutomation?.status ?? "ACTIVE",
    t,
  });
  const hasArchivedThreadHeartbeatAutomation = selectedThreadAttachedHeartbeatAutomationIncludingPaused !== null;
  const archivedThreadHeartbeatAutomationName =
    selectedThreadAttachedHeartbeatAutomationIncludingPaused?.name.trim() ?? "";
  const managesPowerSaveBlocker = shouldWindowManagePowerSaveBlocker();
  const shouldBlockPowerSave = managesPowerSaveBlocker && preventSleepWhileRunning && activeTurn !== null;

  useEffect(() => {
    if (
      threadShellVariant !== "hotkey" ||
      currentRoute !== "chat" ||
      selectedThreadId === null ||
      threadConversation?.id !== selectedThreadId
    ) {
      return;
    }

    void notifyHeartbeatAutomationThreadStateChanged({
      threadId: selectedThreadId,
      isEligible: isHeartbeatAutomationEligible,
      collaborationMode: null,
      permissions: null,
      reason: heartbeatAutomationEligibilityReason,
    }).catch(() => undefined);
  }, [
    currentRoute,
    heartbeatAutomationEligibilityReason,
    isHeartbeatAutomationEligible,
    selectedThreadId,
    threadConversation?.id,
    threadShellVariant,
  ]);

  const refreshThreadHeaderAutomations = async () => {
    try {
      setThreadHeaderAutomations(await listAutomations());
    } catch {
      // Keep the last known snapshot when the local automations store cannot be read.
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const syncMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      if (!cancelled) {
        setIsMaximized(maximized);
      }
    };

    void syncMaximized();

    void appWindow.onResized(() => {
      void syncMaximized();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getAuthSnapshot()
      .then(setAuthSnapshot)
      .catch(() => setAuthSnapshot(initialAuthSnapshot))
      .finally(() => setHasLoadedAuthSnapshot(true));
    void getLaunchContext()
      .then(setLaunchContext)
      .catch(() => setLaunchContext({ openProjectPath: null }))
      .finally(() => setHasLoadedLaunchContext(true));
    void onAuthSnapshotChange(setAuthSnapshot).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const refreshLoginOnboardingState = useEffectEvent(async () => {
    try {
      const [overrideResponse, welcomePendingResponse, projectlessCompletedResponse] =
        await Promise.all([
          getGlobalState("electron:onboarding-override"),
          getGlobalState("electron:onboarding-welcome-pending"),
          getGlobalState("electron:onboarding-projectless-completed"),
        ]);
      setLoginRouteOverride(
        typeof overrideResponse.value === "string" ? overrideResponse.value : "auto",
      );
      setPostLoginWelcomePending(welcomePendingResponse.value === true);
      setProjectlessOnboardingCompleted(projectlessCompletedResponse.value === true);
    } catch {
      setLoginRouteOverride("auto");
      setPostLoginWelcomePending(false);
      setProjectlessOnboardingCompleted(false);
    }
  });

  const refreshActiveWorkspaceRoots = useEffectEvent(async () => {
    setIsActiveWorkspaceRootsLoading(true);
    try {
      const response = await readActiveWorkspaceRoots();
      setActiveWorkspaceRootCount(response.roots.length);
    } catch {
      setActiveWorkspaceRootCount(0);
    } finally {
      setIsActiveWorkspaceRootsLoading(false);
    }
  });

  useEffect(() => {
    let disposed = false;
    let unlistenGlobalState: (() => void) | undefined;
    let unlistenActiveWorkspaceRoots: (() => void) | undefined;

    void refreshLoginOnboardingState();
    void refreshActiveWorkspaceRoots();

    void onGlobalStateUpdated((notification) => {
      if (
        !notification.keys.includes("electron:onboarding-override") &&
        !notification.keys.includes("electron:onboarding-welcome-pending") &&
        !notification.keys.includes("electron:onboarding-projectless-completed")
      ) {
        return;
      }

      void refreshLoginOnboardingState();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenGlobalState = dispose;
    });

    void onActiveWorkspaceRootsUpdated(() => {
      void refreshActiveWorkspaceRoots();
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenActiveWorkspaceRoots = dispose;
    });

    return () => {
      disposed = true;
      unlistenGlobalState?.();
      unlistenActiveWorkspaceRoots?.();
    };
  }, [refreshActiveWorkspaceRoots, refreshLoginOnboardingState]);

  useEffect(() => {
    if (
      !hasLoadedAuthSnapshot ||
      authSnapshot.isLoading ||
      authSnapshot.authState.authMethod != null ||
      !authSnapshot.authState.requiresAuth ||
      currentRoute === "login" ||
      currentRoute === "debug" ||
      currentRoute === "editor-diff" ||
      currentRoute === "global-dictation" ||
      currentRoute === "plan-summary"
    ) {
      return;
    }

    if (typeof window !== "undefined" && window.location.pathname !== LOGIN_ROUTE_PATH) {
      window.history.replaceState(window.history.state, "", LOGIN_ROUTE_PATH);
    }
    setCurrentRoute("login");
  }, [
    authSnapshot.authState.authMethod,
    authSnapshot.authState.requiresAuth,
    authSnapshot.isLoading,
    currentRoute,
    hasLoadedAuthSnapshot,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoginOnboardingRoute(window.location.pathname)) {
      return;
    }

    const targetRoute = resolveLoginOnboardingRouteTarget({
      activeWorkspaceRootCount,
      authState: authSnapshot.authState,
      forcedOverride: loginRouteOverride,
      isActiveWorkspaceRootsLoading,
      isAuthLoading: !hasLoadedAuthSnapshot || authSnapshot.isLoading,
      postLoginWelcomePending,
      projectlessOnboardingCompleted,
    });

    if (targetRoute === null) {
      return;
    }

    if (targetRoute === "login") {
      if (window.location.pathname !== LOGIN_ROUTE_PATH) {
        window.history.replaceState(window.history.state, "", LOGIN_ROUTE_PATH);
      }
      if (currentRoute !== "login") {
        setCurrentRoute("login");
      }
      return;
    }

    if (targetRoute === "welcome") {
      if (window.location.pathname !== WELCOME_ROUTE_PATH) {
        window.history.replaceState(window.history.state, "", WELCOME_ROUTE_PATH);
      }
      if (currentRoute !== "welcome") {
        setCurrentRoute("welcome");
      }
      return;
    }

    if (targetRoute === "select-workspace") {
      if (window.location.pathname !== SELECT_WORKSPACE_ROUTE_PATH) {
        window.history.replaceState(window.history.state, "", SELECT_WORKSPACE_ROUTE_PATH);
      }
      if (currentRoute !== "select-workspace") {
        setCurrentRoute("select-workspace");
      }
      return;
    }

    window.history.replaceState(window.history.state, "", "/");
    if (currentRoute !== "chat") {
      setCurrentRoute("chat");
    }
  }, [
    activeWorkspaceRootCount,
    authSnapshot.authState,
    authSnapshot.isLoading,
    currentRoute,
    hasLoadedAuthSnapshot,
    isActiveWorkspaceRootsLoading,
    loginRouteOverride,
    postLoginWelcomePending,
    projectlessOnboardingCompleted,
  ]);

  useEffect(() => {
    void readAppearanceSettingsSnapshot()
      .then((settings) => {
        applyAppearanceSettingsSnapshot(settings);
        applyGpuTearingDebugSettings(readGpuTearingDebugSettings());
        setComposerEnterBehavior(settings.composerEnterBehavior);
        setFollowUpQueueMode(settings.followUpQueueMode);
        setPreventSleepWhileRunning(settings.preventSleepWhileRunning);
        setReviewDelivery(settings.reviewDelivery);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    applyGpuTearingDebugSettings(readGpuTearingDebugSettings());
    return onGpuTearingDebugSettingsChanged((settings) => {
      applyGpuTearingDebugSettings(settings);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("preventSleepWhileRunning")) {
        return;
      }

      void readPreventSleepWhileRunningPreference()
        .then((value) => {
          setPreventSleepWhileRunning(value);
        })
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const applySettingsRemoteConnections = useEffectEvent(async (remoteConnections: RemoteConnection[]) => {
    const statesByHostId = await readSettingsRemoteConnectionStates(remoteConnections);
    setSettingsRemoteConnections(remoteConnections);
    setSettingsRemoteConnectionStates(statesByHostId);
  });

  const applySettingsRemoteConnectionStateChanged = useEffectEvent(
    ({ hostId, state }: { hostId: string; state: AppServerConnectionState }) => {
      if (!settingsRemoteConnections.some((remoteConnection) => remoteConnection.hostId === hostId)) {
        return;
      }

      setSettingsRemoteConnectionStates((currentStates) => {
        if (currentStates[hostId] === state) {
          return currentStates;
        }

        return {
          ...currentStates,
          [hostId]: state,
        };
      });
    },
  );

  useEffect(() => {
    setSelectedSettingsHostId((currentHostId) => {
      return normalizeSelectedSettingsHostId(currentHostId, connectedSettingsRemoteConnections);
    });
  }, [connectedSettingsRemoteConnections]);

  useEffect(() => {
    if (currentRoute !== "settings" && currentRoute !== "skills") {
      return;
    }

    let disposed = false;
    let unlistenSharedObject: (() => void) | undefined;
    let unlistenStateChanged: (() => void) | undefined;

    void readSettingsRemoteConnectionsSnapshot()
      .then((remoteConnections) => {
        if (!disposed) {
          void applySettingsRemoteConnections(remoteConnections);
        }
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setSettingsRemoteConnections([]);
        setSettingsRemoteConnectionStates({});
        setSelectedSettingsHostId(LOCAL_SETTINGS_HOST_ID);
      });

    void onSharedObjectUpdated((notification) => {
      if (notification.key !== REMOTE_CONNECTIONS_SHARED_OBJECT_KEY) {
        return;
      }

      void applySettingsRemoteConnections(normalizeRemoteConnectionsSnapshot(notification.value));
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenSharedObject = dispose;
    });

    void onRemoteAppServerConnectionStateChanged((notification) => {
      void applySettingsRemoteConnectionStateChanged(notification);
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenStateChanged = dispose;
    });

    return () => {
      disposed = true;
      unlistenSharedObject?.();
      unlistenStateChanged?.();
    };
  }, [currentRoute]);

  useEffect(() => {
    if (!managesPowerSaveBlocker) {
      return;
    }

    void setPowerSaveBlocker(shouldBlockPowerSave).catch(() => undefined);
  }, [managesPowerSaveBlocker, shouldBlockPowerSave]);

  useEffect(() => {
    if (!managesPowerSaveBlocker) {
      return;
    }

    return () => {
      void setPowerSaveBlocker(false).catch(() => undefined);
    };
  }, [managesPowerSaveBlocker]);

  useEffect(() => {
    const unsubscribe = subscribeCustomAvatars((nextSnapshot) => {
      setCustomAvatarsSnapshot(nextSnapshot);
    });

    void ensureCustomAvatarsLoaded();

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlistenGlobalStateUpdated: (() => void) | null = null;

    const syncSelectedAvatarId = async () => {
      try {
        const value = await readSelectedAvatarId();
        if (!cancelled) {
          setSelectedAvatarId(value);
        }
      } catch {
        if (!cancelled) {
          setSelectedAvatarId(DEFAULT_AVATAR_ID);
        }
      }
    };

    void syncSelectedAvatarId();

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("selected-avatar-id")) {
        return;
      }

      void syncSelectedAvatarId();
    }).then((dispose) => {
      if (cancelled) {
        void dispose();
        return;
      }

      unlistenGlobalStateUpdated = () => {
        void dispose();
      };
    });

    return () => {
      cancelled = true;
      unlistenGlobalStateUpdated?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getCodexHomePath()
      .then((path) => {
        if (!cancelled) {
          setCodexHome(path);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCodexHome(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getCommandKeymapState()
      .then((state) => {
        if (!cancelled) {
          setCommandKeymapState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommandKeymapState(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isThreadActionsMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (threadActionsMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsThreadActionsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isThreadActionsMenuOpen]);

  useEffect(() => {
    if (!threadActionFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setThreadActionFeedback(null);
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [threadActionFeedback]);

  useEffect(() => {
    if (!appToast) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setAppToast(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [appToast]);

  useEffect(() => {
    openRightPanelTabsRef.current = openRightPanelTabs;
    activeRightPanelTabIdRef.current = activeRightPanelTabId;
  }, [activeRightPanelTabId, openRightPanelTabs]);

  useEffect(() => {
    sideChatConversationsByIdRef.current = sideChatConversationsById;
  }, [sideChatConversationsById]);

  useEffect(() => {
    const previousThreadId = previousSelectedThreadIdRef.current;
    const currentOpenRightPanelTabs = openRightPanelTabsRef.current;
    const currentStaticTabs = currentOpenRightPanelTabs.filter(isStaticRightPanelTab);
    const currentActiveRightPanelTabId = activeRightPanelTabIdRef.current;

    if (previousThreadId !== null) {
      const currentWorkspaceFileTabs = currentOpenRightPanelTabs.filter(isWorkspaceFileRightPanelTab);
      if (currentWorkspaceFileTabs.length > 0) {
        workspaceFileTabsByThreadIdRef.current.set(previousThreadId, currentWorkspaceFileTabs);
      } else {
        workspaceFileTabsByThreadIdRef.current.delete(previousThreadId);
      }

      if (
        currentActiveRightPanelTabId !== null &&
        isWorkspaceFileRightPanelTabId(currentActiveRightPanelTabId)
      ) {
        activeWorkspaceFileTabIdByThreadIdRef.current.set(previousThreadId, currentActiveRightPanelTabId);
      } else {
        activeWorkspaceFileTabIdByThreadIdRef.current.delete(previousThreadId);
      }
    }

    const restoredWorkspaceFileTabs =
      selectedThreadId === null ? [] : (workspaceFileTabsByThreadIdRef.current.get(selectedThreadId) ?? []);
    const restoredActiveWorkspaceFileTabId =
      selectedThreadId === null ? null : (activeWorkspaceFileTabIdByThreadIdRef.current.get(selectedThreadId) ?? null);

    setOpenRightPanelTabs([...currentStaticTabs, ...restoredWorkspaceFileTabs]);
    setActiveRightPanelTabId((current) => {
      if (!isWorkspaceFileRightPanelTabId(current) && current !== null) {
        return current;
      }
      if (
        restoredActiveWorkspaceFileTabId !== null &&
        restoredWorkspaceFileTabs.some((tab) => tab.id === restoredActiveWorkspaceFileTabId)
      ) {
        return restoredActiveWorkspaceFileTabId;
      }
      if (restoredWorkspaceFileTabs.length > 0) {
        return restoredWorkspaceFileTabs[0].id;
      }
      if (isWorkspaceFileRightPanelTabId(current)) {
        return currentStaticTabs[0]?.id ?? null;
      }
      return current;
    });
    setWorkspaceFileCommandMenuMode(null);
    previousSelectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    const persistedWorkspaceFileRightPanelTabState =
      readPersistedWorkspaceFileRightPanelTabState(WORKSPACE_FILE_RIGHT_PANEL_TAB_STATE_STORAGE_KEY);
    if (!persistedWorkspaceFileRightPanelTabState) {
      return;
    }

    workspaceFileTabsByThreadIdRef.current = new Map(
      persistedWorkspaceFileRightPanelTabState.workspaceFileTabsByThreadId,
    );
    activeWorkspaceFileTabIdByThreadIdRef.current = new Map(
      persistedWorkspaceFileRightPanelTabState.activeWorkspaceFileTabIdByThreadId,
    );
  }, []);

  useEffect(() => {
    if (selectedThreadId === null) {
      return;
    }

    const currentWorkspaceFileTabs = openRightPanelTabs.filter(isWorkspaceFileRightPanelTab);
    if (currentWorkspaceFileTabs.length > 0) {
      workspaceFileTabsByThreadIdRef.current.set(selectedThreadId, currentWorkspaceFileTabs);
    } else {
      workspaceFileTabsByThreadIdRef.current.delete(selectedThreadId);
    }

    if (activeRightPanelTabId !== null && isWorkspaceFileRightPanelTabId(activeRightPanelTabId)) {
      activeWorkspaceFileTabIdByThreadIdRef.current.set(selectedThreadId, activeRightPanelTabId);
    } else {
      activeWorkspaceFileTabIdByThreadIdRef.current.delete(selectedThreadId);
    }

    writePersistedWorkspaceFileRightPanelTabState(WORKSPACE_FILE_RIGHT_PANEL_TAB_STATE_STORAGE_KEY, {
      activeWorkspaceFileTabIdByThreadId: [...activeWorkspaceFileTabIdByThreadIdRef.current.entries()],
      workspaceFileTabsByThreadId: [...workspaceFileTabsByThreadIdRef.current.entries()],
    });
  }, [activeRightPanelTabId, openRightPanelTabs, selectedThreadId]);

  useEffect(() => {
    if (currentRoute !== "settings") {
      return;
    }

    let cancelled = false;

    void readComputerUseApprovalsVisibility()
      .then((state) => {
        if (!cancelled) {
          setHasComputerUseApprovalStore(state.hasApprovalStore);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasComputerUseApprovalStore(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRoute]);

  useEffect(() => {
    if (currentRoute !== "chat" && currentRoute !== "automations") {
      return;
    }

    void refreshThreadHeaderAutomations();
  }, [currentRoute]);

  useEffect(() => {
    if (
      currentRoute !== "settings" ||
      isCurrentSettingsSectionVisible ||
      isCurrentSettingsSectionDirectRoute ||
      isCurrentSettingsSubpage
    ) {
      return;
    }

    setSettingsSection(firstVisibleSettingsSection);
    setSettingsSectionState(null);
  }, [
    currentRoute,
    firstVisibleSettingsSection,
    isCurrentSettingsSectionDirectRoute,
    isCurrentSettingsSectionVisible,
    isCurrentSettingsSubpage,
  ]);

  useEffect(() => {
    if (currentRoute !== "settings") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (isSettingsInputElement(target) || target.closest('[role="dialog"][data-state="open"]') != null)
      ) {
        return;
      }

      setCurrentRoute("chat");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentRoute]);

  useEffect(() => {
    queuedFollowUpsRef.current = queuedFollowUps;
  }, [queuedFollowUps]);

  useEffect(() => {
    recentThreadsRef.current = recentThreads;
  }, [recentThreads]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    threadConversationRef.current = threadConversation;
    if (threadConversation !== null) {
      loadedConversationsByIdRef.current.set(threadConversation.id, threadConversation);
    }
  }, [threadConversation]);

  useEffect(() => {
    if (currentRoute !== "chat" || selectedThreadId === null) {
      return;
    }

    void notifyDebugWindowOriginConversationChanged(selectedThreadId).catch(() => undefined);
  }, [currentRoute, selectedThreadId]);

  const handleAppStateSnapshotRequest = useEffectEvent(
    async ({ reason, requestId }: { reason: string; requestId: string }) => {
      const nowMs = Date.now();
      const loadedConversations = Array.from(loadedConversationsByIdRef.current.values());
      const loadedConversationIds = new Set(loadedConversations.map((conversation) => conversation.id));
      const recentThreadIds = recentThreadsRef.current.map((thread) => thread.id);
      const threadCountLoadedRecent = recentThreadIds.reduce(
        (count, threadId) => count + (loadedConversationIds.has(threadId) ? 1 : 0),
        0,
      );
      const inflightTurnCount = loadedConversations.reduce(
        (count, conversation) => count + countInProgressTurns(conversation),
        0,
      );
      const threadCountWithInflightTurn = loadedConversations.reduce(
        (count, conversation) => count + (countInProgressTurns(conversation) > 0 ? 1 : 0),
        0,
      );
      const turnCountTotalLoaded = loadedConversations.reduce(
        (count, conversation) => count + conversation.turns.length,
        0,
      );
      const itemCountTotalLoaded = loadedConversations.reduce(
        (count, conversation) => count + conversation.items.length,
        0,
      );
      const maxTurnsInSingleThread = loadedConversations.reduce(
        (max, conversation) => Math.max(max, conversation.turns.length),
        0,
      );
      const maxItemsInSingleTurn = loadedConversations.reduce((max, conversation) => {
        const conversationMax = conversation.turns.reduce((turnMax, turn) => {
          const turnItemCount = conversation.items.filter((item) => item.turnId === turn.id).length;
          return Math.max(turnMax, turnItemCount);
        }, 0);
        return Math.max(max, conversationMax);
      }, 0);

      const rendererFrameIntervalSnapshot = readRendererFrameIntervalSnapshot();

      const fields: AppStateSnapshotFields = {
        event: "app_state_snapshot",
        schema_version: 1,
        snapshot_reason: reason,
        session_age_ms: Math.max(0, nowMs - snapshotSessionStartedAtMsRef.current),
        thread_count_total: loadedConversations.length,
        thread_count_loaded_recent: threadCountLoadedRecent,
        thread_count_active: activeTurn === null ? 0 : 1,
        thread_count_streaming_owner: activeTurn === null ? 0 : 1,
        thread_count_streaming_follower: 0,
        thread_count_streaming_without_role: 0,
        thread_count_streaming_with_active_runtime: activeTurn === null ? 0 : 1,
        thread_count_streaming_without_active_runtime: 0,
        thread_count_with_inflight_turn: threadCountWithInflightTurn,
        turn_count_total_loaded: turnCountTotalLoaded,
        item_count_total_loaded: itemCountTotalLoaded,
        max_turns_in_single_thread: maxTurnsInSingleThread,
        max_items_in_single_turn: maxItemsInSingleTurn,
        pending_request_count: totalPendingRequestCount,
        inflight_turn_count: inflightTurnCount,
        delta_events_total: 0,
        delta_bytes_total_estimate: 0,
        delta_events_last_30s: 0,
        delta_bytes_last_30s_estimate: 0,
        renderer_frame_interval_sample_count_last_30s:
          rendererFrameIntervalSnapshot.rendererFrameIntervalSampleCountLast30s,
        renderer_frame_interval_p95_ms_last_30s:
          rendererFrameIntervalSnapshot.rendererFrameIntervalP95MsLast30s,
        review_diff_files_total: threadDiffSummary.fileCount,
        review_diff_lines_total: totalAdditions + totalDeletions,
        review_diff_bytes_estimate: reviewDiffBytesEstimate,
      };

      await sendAppStateSnapshotResponse({ requestId, fields });
    },
  );

  useEffect(() => {
    void setReviewPaneSnapshotMetricsForHost({
      hostId: LOCAL_SETTINGS_HOST_ID,
      reviewDiffFilesTotal: threadDiffSummary.fileCount,
      reviewDiffLinesTotal: totalAdditions + totalDeletions,
      reviewDiffBytesEstimate,
    }).catch(() => undefined);
  }, [reviewDiffBytesEstimate, threadDiffSummary.fileCount, totalAdditions, totalDeletions]);

  useEffect(() => {
    return () => {
      void setReviewPaneSnapshotMetricsForHost({
        hostId: LOCAL_SETTINGS_HOST_ID,
        reviewDiffFilesTotal: 0,
        reviewDiffLinesTotal: 0,
        reviewDiffBytesEstimate: 0,
      }).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    startRendererFrameIntervalSampler();

    if (typeof document !== "undefined" && document.hasFocus()) {
      void notifyViewFocused().catch(() => undefined);
    }

    const handleFocus = () => {
      void notifyViewFocused().catch(() => undefined);
    };

    window.addEventListener("focus", handleFocus);

    let unlisten: (() => void) | undefined;
    void onAppStateSnapshotRequested((notification) => {
      void handleAppStateSnapshotRequest(notification);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  const handleDebugWindowOriginConversationChanged = useEffectEvent(async (conversationId: string) => {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
      return;
    }

    if (
      selectedThreadIdRef.current === normalizedConversationId &&
      threadConversationRef.current?.id === normalizedConversationId
    ) {
      return;
    }

    setSelectedThreadId(normalizedConversationId);
    setTurnError(null);
    setCurrentRoute("debug");
    try {
      await loadThreadConversation(normalizedConversationId);
    } catch {
      setThreadConversation(null);
    }
  });

  const handleDebugRunAppActionRequest = useEffectEvent(async (notification: DebugRunAppActionRequestNotification) => {
    const actionType =
      notification.action !== null &&
      typeof notification.action === "object" &&
      !Array.isArray(notification.action) &&
      typeof notification.action.type === "string"
        ? notification.action.type
        : null;

    if (actionType !== "app.get_summary") {
      await respondToDebugRunAppAction({
        requestId: notification.requestId,
        ok: false,
        errorMessage: `Unsupported debug action: ${actionType ?? "unknown"}`,
      }).catch(() => undefined);
      return;
    }

    const currentThread = threadConversationRef.current;
    const result = {
      action: actionType,
      auth: {
        authMethod: authSnapshot.authState.authMethod,
        email: authSnapshot.authState.email,
        accountId: authSnapshot.authState.accountId,
        userId: authSnapshot.authState.userId,
      },
      conversationId: currentThread?.id ?? notification.sourceThreadId ?? null,
      recentThreads: recentThreadsRef.current.slice(0, 5).map((thread) => ({
        id: thread.id,
        title: thread.name ?? thread.preview,
        updatedAt: thread.updatedAt,
      })),
      route: currentRoute,
      selectedHostId: selectedSettingsHostId,
      thread: currentThread
        ? {
            cwd: currentThread.cwd,
            id: currentThread.id,
            items: currentThread.items.length,
            title: currentThread.title ?? null,
            turns: currentThread.turns.length,
          }
        : null,
    };

    await respondToDebugRunAppAction({
      requestId: notification.requestId,
      ok: true,
      result,
    }).catch(() => undefined);
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<DebugWindowOriginConversationChangedNotification>(
      DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT,
      (event) => {
        void handleDebugWindowOriginConversationChanged(event.payload.conversationId);
      },
    )
      .then((dispose) => {
        if (disposed) {
          void dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onDebugRunAppActionRequest((notification) => {
      void handleDebugRunAppActionRequest(notification);
    })
      .then((dispose) => {
        if (disposed) {
          void dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      takePendingWindowRoute(),
      takePendingPlanSummary(),
      takePendingDebugWindowOriginConversation(),
    ])
      .then(([path, planSummary, debugWindowConversationId]) => {
        if (cancelled) {
          return;
        }

        const normalizedDebugWindowConversationId =
          typeof debugWindowConversationId === "string" && debugWindowConversationId.trim().length > 0
            ? debugWindowConversationId.trim()
            : null;

        if (planSummary) {
          setThreadShellVariant("default");
          initialWindowPageKindRef.current = "plan-summary";
          setPendingPlanSummary(planSummary);
          setCurrentRoute("plan-summary");
        }

        if (typeof path !== "string") {
          return;
        }

        if (isPlanSummaryRoute(path)) {
          setThreadShellVariant("default");
          initialWindowPageKindRef.current = "plan-summary";
          setCurrentRoute("plan-summary");
          return;
        }

        if (isHotkeyHomeRoute(path)) {
          setThreadShellVariant("hotkey");
          initialWindowPageKindRef.current = "hotkey-home";
          setSelectedThreadId(null);
          setThreadConversation(null);
          setIsThreadConversationLoading(false);
          setTurnError(null);
          setCurrentRoute("hotkey-home");
          return;
        }

        if (isEditorDiffRoute(path)) {
          setThreadShellVariant("default");
          initialWindowPageKindRef.current = "editor-diff";
          setEditorDiffRouteState(typeof window === "undefined" ? null : window.history.state);
          setCurrentRoute("editor-diff");
          return;
        }

        if (isGlobalDictationRoute(path)) {
          setThreadShellVariant("default");
          initialWindowPageKindRef.current = "global-dictation";
          setCurrentRoute("global-dictation");
          return;
        }

        if (isHotkeyNewThreadRoute(path)) {
          setThreadShellVariant("hotkey");
          initialWindowPageKindRef.current = "hotkey-new-thread";
          setSelectedThreadId(null);
          setThreadConversation(null);
          setIsThreadConversationLoading(false);
          setTurnError(null);
          setCurrentRoute("hotkey-new-thread");
          return;
        }

        const nextWorktreeInitRoute = parseWorktreeInitRoute(path);
        if (nextWorktreeInitRoute) {
          setThreadShellVariant(nextWorktreeInitRoute.shell);
          initialWindowPageKindRef.current = "worktree-init";
          setWorktreeInitRoute(nextWorktreeInitRoute);
          setCurrentRoute("worktree-init");
          return;
        }

        if (isFirstRunRoute(path)) {
          setThreadShellVariant("default");
          setCurrentRoute("first-run");
          return;
        }

        if (isLoginRoute(path)) {
          setThreadShellVariant("default");
          setCurrentRoute("login");
          return;
        }

        if (isWelcomeRoute(path)) {
          setThreadShellVariant("default");
          setCurrentRoute("welcome");
          return;
        }

        if (isSelectWorkspaceRoute(path)) {
          setThreadShellVariant("default");
          setCurrentRoute("select-workspace");
          return;
        }

        if (isDebugWindowRoute(path)) {
          setThreadShellVariant("default");
          initialWindowPageKindRef.current = "debug";
          if (normalizedDebugWindowConversationId) {
            initialWindowThreadIdRef.current = normalizedDebugWindowConversationId;
          }
          setCurrentRoute("debug");
          return;
        }

        if (isPullRequestsRoute(path)) {
          setThreadShellVariant("default");
          setCurrentRoute("pull-requests");
          return;
        }

        const threadRoute = parseThreadShellRoute(path);
        if (threadRoute) {
          setThreadShellVariant(threadRoute.shell);
          initialWindowPageKindRef.current = "thread";
          initialWindowThreadIdRef.current = threadRoute.threadId;
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setHasLoadedInitialWindowRoute(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const drainQueuedFollowUp = async (threadId: string) => {
      if (drainingQueuedThreadIdsRef.current.has(threadId)) {
        return;
      }
      const nextQueuedFollowUp = takeNextQueuedLocalFollowUp(queuedFollowUpsRef.current, threadId);
      if (!nextQueuedFollowUp.followUp) {
        return;
      }
      drainingQueuedThreadIdsRef.current.add(threadId);
      queuedFollowUpsRef.current = nextQueuedFollowUp.remaining;
      setQueuedFollowUps(nextQueuedFollowUp.remaining);
      if (selectedThreadIdRef.current === threadId) {
        setTurnError(null);
      }
      try {
        const turnId = await startTurn({
          threadId,
          text: nextQueuedFollowUp.followUp.text,
          cwd: nextQueuedFollowUp.followUp.cwd,
        });
        completeImplementPlanFlowForThread(threadId);
        setActiveTurn({ threadId, turnId });
      } catch (error) {
        queuedFollowUpsRef.current = prependQueuedLocalFollowUp(
          queuedFollowUpsRef.current,
          nextQueuedFollowUp.followUp,
        );
        setQueuedFollowUps(queuedFollowUpsRef.current);
        if (selectedThreadIdRef.current === threadId) {
          setTurnError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        drainingQueuedThreadIdsRef.current.delete(threadId);
      }
    };
    void onThreadEvent((event) => {
      if (event.type === "commandApprovalRequested" || event.type === "fileChangeApprovalRequested") {
        const requestKey = approvalRequestKey(event.requestId);
        setApprovalActionErrors((current) => {
          if (!(requestKey in current)) {
            return current;
          }
          const next = { ...current };
          delete next[requestKey];
          return next;
        });
        setPendingApprovals((current) => upsertPendingApproval(current, event));
        return;
      }
      if (event.type === "toolRequestUserInputRequested") {
        const requestKey = approvalRequestKey(event.requestId);
        setApprovalActionErrors((current) => {
          if (!(requestKey in current)) {
            return current;
          }
          const next = { ...current };
          delete next[requestKey];
          return next;
        });
        setPendingToolRequestUserInput((current) => upsertPendingToolRequestUserInput(current, event));
        setSyntheticRequestItemsByThreadId((current) =>
          updateSyntheticRequestItemsForThread(current, event.threadId, (items) =>
            upsertUserInputConversationItem(items, event),
          ),
        );
        setThreadConversation((current) => {
          if (!current || current.id !== event.threadId) {
            return current;
          }
          return {
            ...current,
            items: upsertUserInputConversationItem(current.items, event),
          };
        });
        if (event.threadId in sideChatConversationsByIdRef.current) {
          updateSideChatConversation(event.threadId, (conversation) => ({
            ...conversation,
            items: upsertUserInputConversationItem(conversation.items, event),
          }));
        }
        return;
      }
      if (event.type === "permissionsRequestApprovalRequested") {
        const requestKey = approvalRequestKey(event.requestId);
        setApprovalActionErrors((current) => {
          if (!(requestKey in current)) {
            return current;
          }
          const next = { ...current };
          delete next[requestKey];
          return next;
        });
        setPendingPermissionsRequestApproval((current) =>
          upsertPendingPermissionsRequestApproval(current, event),
        );
        setSyntheticRequestItemsByThreadId((current) =>
          updateSyntheticRequestItemsForThread(current, event.threadId, (items) =>
            upsertPermissionRequestConversationItem(items, event),
          ),
        );
        setThreadConversation((current) => {
          if (!current || current.id !== event.threadId) {
            return current;
          }
          return {
            ...current,
            items: upsertPermissionRequestConversationItem(current.items, event),
          };
        });
        if (event.threadId in sideChatConversationsByIdRef.current) {
          updateSideChatConversation(event.threadId, (conversation) => ({
            ...conversation,
            items: upsertPermissionRequestConversationItem(conversation.items, event),
          }));
        }
        return;
      }
      if (event.type === "mcpServerElicitationRequested") {
        const requestKey = approvalRequestKey(event.requestId);
        setApprovalActionErrors((current) => {
          if (!(requestKey in current)) {
            return current;
          }
          const next = { ...current };
          delete next[requestKey];
          return next;
        });
        setPendingMcpServerElicitationRequest((current) =>
          upsertPendingMcpServerElicitationRequest(current, event),
        );
        setSyntheticRequestItemsByThreadId((current) =>
          updateSyntheticRequestItemsForThread(current, event.threadId, (items) =>
            upsertMcpServerElicitationConversationItem(items, event),
          ),
        );
        setThreadConversation((current) => {
          if (!current || current.id !== event.threadId) {
            return current;
          }
          return {
            ...current,
            items: upsertMcpServerElicitationConversationItem(current.items, event),
          };
        });
        if (event.threadId in sideChatConversationsByIdRef.current) {
          updateSideChatConversation(event.threadId, (conversation) => ({
            ...conversation,
            items: upsertMcpServerElicitationConversationItem(conversation.items, event),
          }));
        }
        return;
      }
      if (event.type === "serverRequestResolved") {
        const requestKey = approvalRequestKey(event.requestId);
        setPendingApprovals((current) =>
          current.filter((approval) => approvalRequestKey(approval.requestId) !== requestKey),
        );
        setPendingMcpServerElicitationRequest((current) =>
          current.filter((request) => approvalRequestKey(request.requestId) !== requestKey),
        );
        setPendingPermissionsRequestApproval((current) =>
          current.filter((request) => approvalRequestKey(request.requestId) !== requestKey),
        );
        setPendingToolRequestUserInput((current) =>
          current.filter((request) => approvalRequestKey(request.requestId) !== requestKey),
        );
        setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
        setApprovalActionErrors((current) => {
          if (!(requestKey in current)) {
            return current;
          }
          const next = { ...current };
          delete next[requestKey];
          return next;
        });
        return;
      }
      if (event.type === "turnCompleted") {
        setActiveTurn((current) =>
          current && current.threadId === event.threadId && current.turnId === event.turnId
            ? null
            : current,
        );
        setThreadConversation((current) => {
          if (!current || current.id !== event.threadId) {
            return current;
          }
          const withCompletedTurnTiming = upsertThreadConversationTurnTiming(current, event.turnId, {
            status: event.status,
          });
          const cleared = clearUnacceptedSteeringUserMessagesForTurn(current.items, event.threadId, event.turnId);
          if (cleared.restoredQueuedFollowUps.length > 0) {
            mutateQueuedFollowUps((queued) => [...cleared.restoredQueuedFollowUps, ...queued]);
          }
          if (cleared.items === current.items && withCompletedTurnTiming === current) {
            return current;
          }
          return {
            ...withCompletedTurnTiming,
            items: cleared.items,
          };
        });
        if (event.threadId in sideChatConversationsByIdRef.current) {
          setSideChatConversationsById((current) => {
            const existingConversation = current[event.threadId];
            if (!existingConversation) {
              return current;
            }
            const withCompletedTurnTiming = upsertThreadConversationTurnTiming(existingConversation, event.turnId, {
              status: event.status,
            });
            const cleared = clearUnacceptedSteeringUserMessagesForTurn(
              existingConversation.items,
              event.threadId,
              event.turnId,
            );
            return {
              ...current,
              [event.threadId]: {
                ...withCompletedTurnTiming,
                items: cleared.items,
              },
            };
          });
        }
        void drainQueuedFollowUp(event.threadId);
        if (event.status === "completed" && event.error === null) {
          void getRecentThreads()
            .then((threads) => {
              syncProjectGroups(selectedThreadIdRef.current ?? threads[0]?.id ?? null, threads);
              const sourceThread =
                threadConversationRef.current && threadConversationRef.current.id === event.threadId
                  ? threadConversationRef.current
                  : (sideChatConversationsByIdRef.current[event.threadId] ?? null);
              if (!sourceThread) {
                return;
              }
              const request = buildPendingImplementPlanRequestForTurn(sourceThread.id, sourceThread.items, event.turnId);
              setPendingImplementPlanRequests((current) => {
                const withoutThread = clearPendingImplementPlanRequestsForThread(current, sourceThread.id);
                return request ? upsertPendingImplementPlanRequest(withoutThread, request) : withoutThread;
              });
            })
            .catch(() => undefined);
        }
        return;
      }
      if (event.type === "threadItemUpdated") {
        const isSelectedThread = event.threadId === selectedThreadIdRef.current;
        const isLoadedSideChat = event.threadId in sideChatConversationsByIdRef.current;

        setThreadConversation((current) => {
          if (!isSelectedThread || !current || current.id !== event.threadId) {
            return current;
          }

          const now = Date.now();
          let nextConversation = current;
          if (event.phase === "started" && event.item.type === "agentMessage") {
            nextConversation = upsertThreadConversationTurnTiming(nextConversation, event.turnId, {
              finalAssistantStartedAtMs:
                nextConversation.turnTimings.find((entry) => entry.turnId === event.turnId)?.finalAssistantStartedAtMs ?? now,
            });
          }
          if (
            (event.phase === "started" || event.phase === "completed") &&
            isWorkStartedConversationItem(event.item)
          ) {
            const currentTiming = nextConversation.turnTimings.find((entry) => entry.turnId === event.turnId);
            if (currentTiming?.firstTurnWorkItemStartedAtMs === null || currentTiming === undefined) {
              nextConversation = upsertThreadConversationTurnTiming(nextConversation, event.turnId, {
                firstTurnWorkItemStartedAtMs: now,
                ...(currentTiming === undefined ? { status: activeTurn?.turnId === event.turnId ? "in_progress" : "completed" } : {}),
              });
            }
          }

          const folded =
            event.phase === "started"
              ? foldStartedThreadItemWithSteer(nextConversation.items, event.item)
              : foldCompletedThreadItemWithSteer(nextConversation.items, event.item);

          if (folded.items === nextConversation.items && nextConversation === current) {
            return current;
          }

          const nextLoadedConversation = {
            ...nextConversation,
            items: folded.items,
          };
          loadedConversationsByIdRef.current.set(nextLoadedConversation.id, nextLoadedConversation);
          return nextLoadedConversation;
        });
        if (isLoadedSideChat) {
          setSideChatConversationsById((current) => {
            const existingConversation = current[event.threadId];
            if (!existingConversation) {
              return current;
            }

            const now = Date.now();
            let nextConversation = existingConversation;
            if (event.phase === "started" && event.item.type === "agentMessage") {
              nextConversation = upsertThreadConversationTurnTiming(nextConversation, event.turnId, {
                finalAssistantStartedAtMs:
                  nextConversation.turnTimings.find((entry) => entry.turnId === event.turnId)?.finalAssistantStartedAtMs ?? now,
              });
            }
            if (
              (event.phase === "started" || event.phase === "completed") &&
              isWorkStartedConversationItem(event.item)
            ) {
              const currentTiming = nextConversation.turnTimings.find((entry) => entry.turnId === event.turnId);
              if (currentTiming?.firstTurnWorkItemStartedAtMs === null || currentTiming === undefined) {
                nextConversation = upsertThreadConversationTurnTiming(nextConversation, event.turnId, {
                  firstTurnWorkItemStartedAtMs: now,
                  ...(currentTiming === undefined ? { status: "completed" } : {}),
                });
              }
            }

            const folded =
              event.phase === "started"
                ? foldStartedThreadItemWithSteer(nextConversation.items, event.item)
                : foldCompletedThreadItemWithSteer(nextConversation.items, event.item);

            const nextLoadedConversation = {
              ...nextConversation,
              items: folded.items,
            };
            loadedConversationsByIdRef.current.set(nextLoadedConversation.id, nextLoadedConversation);
            return {
              ...current,
              [event.threadId]: nextLoadedConversation,
            };
          });
        }
        return;
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [locale, selectedThreadId, t]);

  useEffect(() => {
    if (!hasLoadedInitialWindowRoute) {
      return;
    }

    if (
      initialWindowPageKindRef.current === "hotkey-home" ||
      initialWindowPageKindRef.current === "hotkey-new-thread" ||
      initialWindowPageKindRef.current === "plan-summary" ||
      initialWindowPageKindRef.current === "editor-diff" ||
      initialWindowPageKindRef.current === "global-dictation" ||
      initialWindowPageKindRef.current === "worktree-init" ||
      currentRoute === "hotkey-home" ||
      currentRoute === "hotkey-new-thread" ||
      currentRoute === "editor-diff" ||
      currentRoute === "global-dictation" ||
      currentRoute === "first-run" ||
      currentRoute === "login" ||
      currentRoute === "worktree-init" ||
      currentRoute === "welcome"
    ) {
      initialThreadSnapshotLoadedRef.current = true;
      setHasLoadedInitialThreadSnapshot(true);
      return;
    }

    let cancelled = false;
    const isInitialBootstrapRun = !initialThreadSnapshotLoadedRef.current;
    const isDebugWindowBootstrap =
      initialWindowPageKindRef.current === "debug" || currentRoute === "debug";
    const preferredInitialThreadId = isInitialBootstrapRun
      ? initialWindowThreadIdRef.current
      : isDebugWindowBootstrap
        ? selectedThreadIdRef.current
        : null;
    if (isInitialBootstrapRun) {
      initialWindowThreadIdRef.current = null;
    }

    void getRecentThreads()
      .then(async (threads) => {
        if (cancelled) {
          return;
        }
        const activeThreadId = preferredInitialThreadId ?? (isDebugWindowBootstrap ? null : (threads[0]?.id ?? null));
        syncProjectGroups(activeThreadId, threads);
        if (activeThreadId) {
          const requestId = threadLoadRequestIdRef.current + 1;
          threadLoadRequestIdRef.current = requestId;
          if (isInitialBootstrapRun) {
            setIsThreadConversationLoading(true);
            setThreadConversation(null);
          }
          try {
            const thread = await readThread(activeThreadId);
            if (!cancelled && threadLoadRequestIdRef.current === requestId) {
              setThreadConversation(mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId));
            }
          } catch {
            if (!cancelled && threadLoadRequestIdRef.current === requestId && isInitialBootstrapRun) {
              setThreadConversation(null);
            }
          } finally {
            if (!cancelled && threadLoadRequestIdRef.current === requestId && isInitialBootstrapRun) {
              setIsThreadConversationLoading(false);
            }
          }
          return;
        }
        setThreadConversation(null);
        setIsThreadConversationLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectGroups([]);
          setSelectedThreadId(null);
          setThreadConversation(null);
          setIsThreadConversationLoading(false);
        }
      })
      .finally(() => {
        if (!cancelled && isInitialBootstrapRun) {
          initialThreadSnapshotLoadedRef.current = true;
          setHasLoadedInitialThreadSnapshot(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRoute, hasLoadedInitialWindowRoute, locale, syntheticRequestItemsByThreadId, t]);

  useEffect(() => {
    if (currentRoute !== "settings") {
      return;
    }
    let cancelled = false;
    void readConfig(settingsWorkspaceRoot)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setConfigSnapshot(response.config);
        const scopeOptions = buildConfigScopeOptions(response);
        setConfigScopeOptions(scopeOptions);
        setSelectedConfigScopeKey((current) => {
          if (scopeOptions.some((scope) => scope.key === current)) {
            return current;
          }
          return chooseDefaultConfigScopeKey(scopeOptions);
        });
        setAgentConfigControlErrors({});
        setConfigError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setConfigSnapshot(null);
          setConfigScopeOptions([]);
          setSelectedConfigScopeKey("user");
          setAgentConfigControlErrors({});
          setConfigError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentRoute, settingsWorkspaceRoot]);

  const startDragging = async () => {
    await appWindow.startDragging();
  };

  const minimizeWindow = async () => {
    await appWindow.minimize();
  };

  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const closeWindow = async () => {
    await appWindow.close();
  };

  const handleDragMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 0 && event.target === event.currentTarget) {
      void startDragging();
    }
  };

  const shellColumns = {
    gridTemplateColumns: isRightPanelOpen ? "minmax(0, 1fr) var(--app-shell-right-width)" : "minmax(0, 1fr)",
  } as const;
  const collapsedRightPanelTabs = !isRightPanelOpen ? openRightPanelTabs.slice(0, 3) : [];
  const canOfferReviewRightPanelTab = !openRightPanelTabs.some((tab) => tab.kind === "review");
  const canOfferBrowserRightPanelTab = !openRightPanelTabs.some((tab) => tab.kind === "browser");
  const openRightPanelTab = (tabId: StaticRightPanelTabId) => {
    setOpenRightPanelTabs((current) =>
      current.some((tab) => tab.id === tabId) ? current : [...current, createStaticRightPanelTab(tabId)],
    );
    setActiveRightPanelTabId(tabId);
    setIsRightPanelOpen(true);
  };

  const activateRightPanelTab = (tabId: string) => {
    setActiveRightPanelTabId(tabId);
    setIsRightPanelOpen(true);
  };

  const closeRightPanelTab = (tabId: string) => {
    const closingTab = openRightPanelTabsRef.current.find((tab) => tab.id === tabId) ?? null;
    setOpenRightPanelTabs((current) => {
      const closingIndex = current.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab.id !== tabId);
      setActiveRightPanelTabId((activeTabId) => {
        if (activeTabId !== tabId) {
          return activeTabId;
        }
        return nextTabs[closingIndex]?.id ?? nextTabs[closingIndex - 1]?.id ?? null;
      });

      return nextTabs;
    });

    if (closingTab?.kind === "sideChat") {
      const conversationId = closingTab.conversationId;
      void discardConversationFromCache(conversationId).catch(() => undefined);
      setSideChatConversationsById((current) => {
        if (!(conversationId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      setSideChatComposerDraftsById((current) => {
        if (!(conversationId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      setSideChatTurnErrorsById((current) => {
        if (!(conversationId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
    }
  };

  const toggleRightPanel = () => {
    setIsRightPanelOpen((current) => !current);
  };

  const openWorkspaceFileCommandMenu = (mode: WorkspaceFileCommandMenuMode) => {
    if (!chatWorkspaceRoot) {
      return;
    }
    setIsThreadActionsMenuOpen(false);
    setWorkspaceFileCommandMenuMode(mode);
  };

  const openWorkspaceFileSearch = () => {
    openWorkspaceFileCommandMenu("files");
  };

  const handleGlobalShortcutKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const accelerator = buildAcceleratorFromKeyboardEvent(event);
    if (!accelerator) {
      return;
    }

    const isMac = typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Mac");
    const matchingCommandId = ["closeTabOrWindow", "searchFiles", "openCommandMenu"].find((commandId) =>
      getCommandShortcutAccelerators(commandId, commandKeymapState).some((binding) =>
        binding
          .replaceAll("CmdOrCtrl", isMac ? "Command" : "Ctrl")
          .replaceAll("Cmd", "Command")
          .replaceAll("Control", "Ctrl") === accelerator,
      ),
    );

    if (!matchingCommandId) {
      return;
    }

    if (matchingCommandId === "closeTabOrWindow") {
      event.preventDefault();
      if (activeRightPanelTab !== null) {
        closeRightPanelTab(activeRightPanelTab.id);
        return;
      }

      void closeWindow();
      return;
    }

    if (matchingCommandId === "searchFiles") {
      if (chatWorkspaceRoot === null) {
        return;
      }
      event.preventDefault();
      openWorkspaceFileCommandMenu("files");
      return;
    }

    if (matchingCommandId === "openCommandMenu") {
      if (chatWorkspaceRoot === null) {
        return;
      }
      event.preventDefault();
      openWorkspaceFileCommandMenu("root");
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalShortcutKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcutKeyDown);
    };
  }, [handleGlobalShortcutKeyDown]);

  const handleWorkspaceFileSelected = (file: WorkspaceFilePreviewTarget) => {
    const workspaceFileTab = createWorkspaceFileRightPanelTab(file);
    setOpenRightPanelTabs((current) => {
      const existingTabIndex = current.findIndex((tab) => tab.id === workspaceFileTab.id);
      if (existingTabIndex === -1) {
        return [...current, workspaceFileTab];
      }

      const existingTab = current[existingTabIndex];
      if (!isWorkspaceFileRightPanelTab(existingTab)) {
        return current;
      }

      const nextTabs = [...current];
      nextTabs[existingTabIndex] = workspaceFileTab;
      return nextTabs;
    });
    setActiveRightPanelTabId(workspaceFileTab.id);
    setIsRightPanelOpen(true);
    setWorkspaceFileCommandMenuMode(null);
  };

  const handleReviewFileSelected = (change: FileChangeSummary) => {
    if (!chatWorkspaceRoot) {
      return;
    }

    const candidatePath = change.movePath ?? change.path;
    const normalizedWorkspaceRoot = chatWorkspaceRoot.replaceAll("\\", "/").replace(/\/+$/, "");
    const normalizedCandidatePath = candidatePath.replaceAll("\\", "/");
    const isAbsolutePath = /^[A-Za-z]:\//.test(normalizedCandidatePath) || normalizedCandidatePath.startsWith("/");

    let relativePath = normalizedCandidatePath;
    if (normalizedCandidatePath.startsWith(`${normalizedWorkspaceRoot}/`)) {
      relativePath = normalizedCandidatePath.slice(normalizedWorkspaceRoot.length + 1);
    } else if (isAbsolutePath) {
      setThreadActionFeedback({
        tone: "error",
        message: `workspace file path must be relative: ${candidatePath}`,
      });
      return;
    } else {
      relativePath = normalizedCandidatePath.replace(/^\.?\//, "");
    }

    if (!relativePath) {
      setThreadActionFeedback({
        tone: "error",
        message: `workspace file path is empty: ${candidatePath}`,
      });
      return;
    }

    handleWorkspaceFileSelected({
      name: relativePath.split("/").at(-1) ?? relativePath,
      path: `${normalizedWorkspaceRoot}/${relativePath}`,
      relativePath,
      workspaceRoot: chatWorkspaceRoot,
    });
    setThreadActionFeedback(null);
  };

  const syncProjectGroups = (activeThreadId: string | null, threads: Awaited<ReturnType<typeof getRecentThreads>>) => {
    setRecentThreads(threads);
    setSelectedThreadId(activeThreadId);
    setProjectGroups(
      buildProjectGroups(threads, {
        activeThreadId,
        locale,
        noMessageLabel: t("history.noMessageYet"),
      }),
    );
  };

  const loadThreadConversation = async (threadId: string) => {
    const requestId = threadLoadRequestIdRef.current + 1;
    threadLoadRequestIdRef.current = requestId;
    setIsThreadConversationLoading(true);
    setThreadConversation(null);
    try {
      const thread = await readThread(threadId);
      loadedConversationsByIdRef.current.set(thread.id, thread);
      if (threadLoadRequestIdRef.current === requestId) {
        setThreadConversation(mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId));
      }
      return thread;
    } finally {
      if (threadLoadRequestIdRef.current === requestId) {
        setIsThreadConversationLoading(false);
      }
    }
  };

  const loadSideChatConversation = async (threadId: string) => {
    const thread = await readThread(threadId);
    loadedConversationsByIdRef.current.set(thread.id, thread);
    setSideChatConversationsById((current) => ({
      ...current,
      [thread.id]: mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId),
    }));
    return thread;
  };

  const updateSideChatConversation = (
    threadId: string,
    updater: (conversation: ThreadConversation) => ThreadConversation,
  ) => {
    setSideChatConversationsById((current) => {
      const existingConversation = current[threadId];
      if (!existingConversation) {
        return current;
      }
      const nextConversation = updater(existingConversation);
      loadedConversationsByIdRef.current.set(nextConversation.id, nextConversation);
      return {
        ...current,
        [threadId]: nextConversation,
      };
    });
  };

  const openArchivedChatsSettings = () => {
    setAppToast(null);
    setSettingsSection("data-controls");
    setCurrentRoute("settings");
  };

  const refreshRecentThreadsAfterUnarchive = async (hostId: string) => {
    if (hostId !== LOCAL_SETTINGS_HOST_ID) {
      return;
    }

    try {
      const threads = await getRecentThreads();
      syncProjectGroups(selectedThreadId ?? threads[0]?.id ?? null, threads);
    } catch {
      // Keep the current sidebar state when refresh fails.
    }
  };

  const viewConversationForHost = async (threadId: string, hostId: string) => {
    if (hostId !== LOCAL_SETTINGS_HOST_ID) {
      await openRemoteTask(threadId);
      return;
    }

    try {
      const threads = await getRecentThreads();
      syncProjectGroups(threadId, threads);
      setTurnError(null);
      setCurrentRoute("chat");
      await loadThreadConversation(threadId);
    } catch (error) {
      setAppToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const mutateQueuedFollowUps = (update: (current: QueuedLocalFollowUp[]) => QueuedLocalFollowUp[]) => {
    setQueuedFollowUps((current) => {
      const next = update(current);
      queuedFollowUpsRef.current = next;
      return next;
    });
  };

  const clearConversationTurnError = (threadId: string) => {
    if (threadId in sideChatConversationsByIdRef.current) {
      setSideChatTurnErrorsById((current) => ({
        ...current,
        [threadId]: null,
      }));
      return;
    }
    setTurnError(null);
  };

  const setConversationTurnError = (threadId: string, message: string) => {
    if (threadId in sideChatConversationsByIdRef.current) {
      setSideChatTurnErrorsById((current) => ({
        ...current,
        [threadId]: message,
      }));
      return;
    }
    setTurnError(message);
  };

  const completeImplementPlanFlowForThread = (threadId: string) => {
    setPendingImplementPlanRequests((current) => clearPendingImplementPlanRequestsForThread(current, threadId));
  };

  const createAndSelectThread = async () => {
    const cwd = threadConversation?.cwd ?? openProjectPath ?? null;
    const threadId = await startThread(cwd);
    const threads = await getRecentThreads();
    setThreadShellVariant("default");
    syncProjectGroups(threadId, threads);
    setCurrentRoute("chat");
    return loadThreadConversation(threadId);
  };
  const isAuthenticated = authSnapshot.authState.authMethod !== null;

  const openRemoteTask = async (taskId: string, shell: ThreadShellVariant = "default") => {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }
    try {
      const thread = await readThread(normalizedTaskId);
      setThreadShellVariant(shell);
      setSelectedThreadId(normalizedTaskId);
      setTurnError(null);
      setCurrentRoute("chat");
      setThreadConversation(mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId));
    } catch {
      // Keep the current selection untouched when the local shell cannot open the task id directly.
    }
  };

  const selectThread = async (threadId: string, shell: ThreadShellVariant = "default") => {
    setThreadShellVariant(shell);
    setSelectedThreadId(threadId);
    setTurnError(null);
    setCurrentRoute("chat");
    try {
      await loadThreadConversation(threadId);
    } catch {
      setThreadConversation(null);
    }
  };

  const openNewConversation = useEffectEvent((state: NavigateToRouteState | null = null) => {
    setThreadShellVariant("default");
    setSkillsRouteState(null);
    setWorktreeInitRoute(null);
    setSelectedThreadId(null);
    setThreadConversation(null);
    setIsThreadConversationLoading(false);
    setTurnError(null);
    setComposerDraft(state?.prefillPrompt ?? "");
    setComposerFocusNonce(state?.focusComposerNonce ?? Date.now());
    setCurrentRoute("chat");
  });

  const handleNavigateToRoute = useEffectEvent(async (path: string, state?: NavigateToRouteState | null) => {
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.replaceState(state ?? window.history.state, "", path);
    }

    if (path === "/" || path.length === 0) {
      openNewConversation(state ?? null);
      return;
    }

    if (isPlanSummaryRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("plan-summary");
      return;
    }

    if (isHotkeyHomeRoute(path)) {
      setThreadShellVariant("hotkey");
      setSkillsRouteState(null);
      setSelectedThreadId(null);
      setThreadConversation(null);
      setIsThreadConversationLoading(false);
      setTurnError(null);
      setCurrentRoute("hotkey-home");
      return;
    }

    if (isEditorDiffRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setEditorDiffRouteState(state ?? (typeof window === "undefined" ? null : window.history.state));
      setCurrentRoute("editor-diff");
      return;
    }

    if (isGlobalDictationRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("global-dictation");
      return;
    }

    if (isHotkeyNewThreadRoute(path)) {
      setThreadShellVariant("hotkey");
      setSkillsRouteState(null);
      setSelectedThreadId(null);
      setThreadConversation(null);
      setIsThreadConversationLoading(false);
      setTurnError(null);
      setCurrentRoute("hotkey-new-thread");
      return;
    }

    const nextWorktreeInitRoute = parseWorktreeInitRoute(path);
    if (nextWorktreeInitRoute) {
      setThreadShellVariant(nextWorktreeInitRoute.shell);
      setSkillsRouteState(null);
      setWorktreeInitRoute(nextWorktreeInitRoute);
      setCurrentRoute("worktree-init");
      return;
    }

    if (isFirstRunRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("first-run");
      return;
    }

    if (isLoginRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("login");
      return;
    }

    if (isWelcomeRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("welcome");
      return;
    }

    if (isSelectWorkspaceRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("select-workspace");
      return;
    }

    if (isDebugWindowRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("debug");
      return;
    }

    if (isPullRequestsRoute(path)) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setCurrentRoute("pull-requests");
      return;
    }

    if (path === "/skills") {
      setThreadShellVariant("default");
      if (state?.initialHostId && state.initialHostId.trim().length > 0) {
        setSelectedSettingsHostId(state.initialHostId);
      }
      setSkillsRouteState({
        initialTab: state?.initialTab,
        pluginDeepLinkAuthBlocked: state?.pluginDeepLinkAuthBlocked,
      });
      setCurrentRoute("skills");
      return;
    }

    const settingsSection = parseSettingsRoute(path);
    if (settingsSection) {
      setThreadShellVariant("default");
      setSkillsRouteState(null);
      setSettingsSection(settingsSection);
      setSettingsSectionState(null);
      setCurrentRoute("settings");
      return;
    }

    const threadRoute = parseThreadShellRoute(path);
    if (!threadRoute) {
      return;
    }

    setSkillsRouteState(null);
    setThreadShellVariant(threadRoute.shell);
    if (threadRoute.kind === "remote") {
      await openRemoteTask(threadRoute.threadId, threadRoute.shell);
      return;
    }

    await selectThread(threadRoute.threadId, threadRoute.shell);
  });

  const handleToggleDiffPanel = useEffectEvent((open: boolean) => {
    if (open) {
      openRightPanelTab("review");
      return;
    }

    const hasReviewTab = openRightPanelTabsRef.current.some((tab) => tab.kind === "review");
    if (!hasReviewTab) {
      return;
    }

    const nextTabs = openRightPanelTabsRef.current.filter((tab) => tab.kind !== "review");
    closeRightPanelTab("review");
    if (nextTabs.length === 0) {
      setIsRightPanelOpen(false);
    }
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<NavigateToRouteNotification>(NAVIGATE_TO_ROUTE_EVENT, (event) => {
      void handleNavigateToRoute(event.payload.path, event.payload.state);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<ToggleDiffPanelNotification>(TOGGLE_DIFF_PANEL_EVENT, (event) => {
      void handleToggleDiffPanel(event.payload.open);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const startNewThread = async () => {
    try {
      setTurnError(null);
      await createAndSelectThread();
    } catch {
      // Keep the current selection untouched when thread creation fails.
    }
  };

  const startHotkeyHomeLocalConversation = useEffectEvent(async (params: {
    draft: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string | null;
  }) => {
    const text = params.draft.trim();
    if (text.length === 0) {
      return;
    }

    const cwd = params.workspaceRoot;
    const threadId = await startThread(cwd);

    if (text === "/review") {
      const review = await startReview({ threadId, delivery: reviewDelivery });
      const threads = await getRecentThreads();
      syncProjectGroups(review.reviewThreadId, threads);
      setActiveTurn({ threadId: review.reviewThreadId, turnId: review.turnId });
      await openInHotkeyWindow(buildLocalThreadRoutePath(review.reviewThreadId, "hotkey"));
      return;
    }

    const turnId = await startTurn({
      threadId,
      text,
      cwd,
      ...params.permissionOverrides,
    });
    const threads = await getRecentThreads();
    syncProjectGroups(threadId, threads);
    completeImplementPlanFlowForThread(threadId);
    setActiveTurn({ threadId, turnId });
    await openInHotkeyWindow(buildLocalThreadRoutePath(threadId, "hotkey"));
  });

  const startHotkeyHomeCloudConversation = useEffectEvent(async (params: {
    draft: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string;
  }) => {
    const text = params.draft.trim();
    if (text.length === 0) {
      return;
    }

    const threadId = await startConversation({
      hostId: LOCAL_SETTINGS_HOST_ID,
      text,
      cwd: params.workspaceRoot,
      workspaceRoots: [params.workspaceRoot],
      ...params.permissionOverrides,
    });
    const threads = await getRecentThreads();
    syncProjectGroups(threadId, threads);
    completeImplementPlanFlowForThread(threadId);
    await openInHotkeyWindow(buildRemoteThreadRoutePath(threadId, "hotkey"));
  });

  const startHotkeyHomeWorktreeConversation = useEffectEvent(async (params: {
    id: string;
    localEnvironmentConfigPath: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    prompt: string;
    startingState: PendingWorktreeStartingState;
    workspaceRoot: string;
  }) => {
    const prompt = params.prompt.trim();
    if (prompt.length === 0) {
      return;
    }

    await createPendingWorktree({
      hostId: LOCAL_SETTINGS_HOST_ID,
      request: {
        id: params.id,
        hostId: LOCAL_SETTINGS_HOST_ID,
        label: null,
        initialThreadTitle: null,
        sourceWorkspaceRoot: params.workspaceRoot,
        startingState: params.startingState,
        localEnvironmentConfigPath: params.localEnvironmentConfigPath,
        prompt,
        launchMode: "start-conversation",
        startConversationParamsInput: {
          input: [{ type: "text", text: prompt }],
          approvalPolicy: params.permissionOverrides.approvalPolicy ?? null,
          approvalsReviewer: params.permissionOverrides.approvalsReviewer ?? null,
          sandboxPolicy: params.permissionOverrides.sandboxPolicy ?? null,
        },
        threadGoalObjective: null,
        sourceConversationId: null,
        sourceCollaborationMode: null,
        targetTurnId: null,
      },
    });

    await openInHotkeyWindow(buildWorktreeInitV2RoutePath(params.id, "hotkey"));
  });

  const startHotkeyNewThread = useEffectEvent(async (draft: string) => {
    const text = draft.trim();
    if (text.length === 0) {
      return;
    }

    const cwd = openProjectPath ?? null;
    const threadId = await startThread(cwd);

    if (text === "/review") {
      const review = await startReview({ threadId, delivery: reviewDelivery });
      const threads = await getRecentThreads();
      syncProjectGroups(review.reviewThreadId, threads);
      setActiveTurn({ threadId: review.reviewThreadId, turnId: review.turnId });
      await openInHotkeyWindow(buildLocalThreadRoutePath(review.reviewThreadId, "hotkey"));
      return;
    }

    const turnId = await startTurn({ threadId, text, cwd });
    const threads = await getRecentThreads();
    syncProjectGroups(threadId, threads);
    completeImplementPlanFlowForThread(threadId);
    setActiveTurn({ threadId, turnId });
    await openInHotkeyWindow(buildLocalThreadRoutePath(threadId, "hotkey"));
  });

  const removeQueuedFollowUp = (queuedFollowUpId: string) => {
    mutateQueuedFollowUps((current) => removeQueuedLocalFollowUp(current, queuedFollowUpId));
  };

  const copyWorkingDirectory = async () => {
    const cwd = threadConversation?.cwd ?? null;
    if (!cwd) {
      return;
    }
    try {
      await navigator.clipboard.writeText(cwd);
      setThreadActionFeedback({
        tone: "success",
        message: t("threadHeader.copyWorkingDirectorySuccess"),
      });
      setIsThreadActionsMenuOpen(false);
    } catch {
      setThreadActionFeedback({
        tone: "error",
        message: t("threadHeader.copyWorkingDirectoryError"),
      });
    }
  };

  const copySessionId = async () => {
    if (!selectedThreadId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedThreadId);
      setThreadActionFeedback(null);
      setIsThreadActionsMenuOpen(false);
    } catch (error) {
      setThreadActionFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const copyAppLink = async () => {
    if (!selectedThreadId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`codex://threads/${selectedThreadId}`);
      setThreadActionFeedback(null);
      setIsThreadActionsMenuOpen(false);
    } catch (error) {
      setThreadActionFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const copyConversationMarkdown = async () => {
    if (!threadConversation) {
      return;
    }
    try {
      const markdown = renderConversationMarkdown(
        threadConversation,
        t,
        {
          approvals: currentThreadApprovals,
        },
      );
      await navigator.clipboard.writeText(markdown);
      setThreadActionFeedback({
        tone: "success",
        message: t("threadHeader.copyConversationMarkdownSuccess"),
      });
      setIsThreadActionsMenuOpen(false);
    } catch {
      setThreadActionFeedback({
        tone: "error",
        message: t("threadHeader.copyConversationMarkdownError"),
      });
    }
  };

  const forkSelectedThread = async () => {
    if (!selectedThreadId || isTurnInProgress) {
      return;
    }
    try {
      const forkedThreadId = await forkThread(selectedThreadId);
      const [threads, thread] = await Promise.all([getRecentThreads(), readThread(forkedThreadId)]);
      syncProjectGroups(forkedThreadId, threads);
      setThreadConversation(mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId));
      setTurnError(null);
      setIsThreadActionsMenuOpen(false);
      setThreadActionFeedback(null);
    } catch {
      setThreadActionFeedback({
        tone: "error",
        message: t("threadHeader.forkThreadError"),
      });
    }
  };

  const openSideChatForSelectedThread = async () => {
    if (!selectedThreadId || isTurnInProgress) {
      return;
    }

    try {
      const forkedThreadId = await forkConversationFromLatest({
        conversationId: selectedThreadId,
        cwd: threadConversation?.cwd ?? openProjectPath ?? null,
        developerInstructions:
          "You are in a side conversation. Treat inherited history as reference only. Do not modify files, git state, permissions, configuration, or workspace state unless the user explicitly asks for that mutation in this side conversation.",
      });
      const sideChatCount = openRightPanelTabsRef.current.filter((tab) => tab.kind === "sideChat").length + 1;
      const tab = createSideChatRightPanelTab({
        conversationId: forkedThreadId,
        index: sideChatCount,
        title: t("localConversation.sideChat.title"),
        numberedTitle: t("localConversation.sideChat.numberedTitle", { index: sideChatCount }),
      });
      await loadSideChatConversation(forkedThreadId);
      setOpenRightPanelTabs((current) =>
        current.some((existingTab) => existingTab.id === tab.id) ? current : [...current, tab],
      );
      setActiveRightPanelTabId(tab.id);
      setIsRightPanelOpen(true);
      setIsThreadActionsMenuOpen(false);
      setThreadActionFeedback(null);
    } catch {
      setIsThreadActionsMenuOpen(false);
      setAppToast({
        tone: "error",
        message: t("threadHeader.openSideChatError"),
      });
    }
  };

  const archiveSelectedThread = async () => {
    if (!selectedThreadId) {
      return;
    }
    const attachedHeartbeatAutomation = selectedThreadAttachedHeartbeatAutomationIncludingPaused;
    try {
      await archiveThread(selectedThreadId);
      let heartbeatAutomationError: unknown = null;
      if (attachedHeartbeatAutomation) {
        try {
          await deleteAutomation(attachedHeartbeatAutomation.id);
        } catch (error) {
          heartbeatAutomationError = error;
        }
        await refreshThreadHeaderAutomations();
      }
      const threads = await getRecentThreads();
      const nextThreadId = threads[0]?.id ?? null;
      syncProjectGroups(nextThreadId, threads);
      if (nextThreadId) {
        const nextThread = await readThread(nextThreadId);
        setThreadConversation(nextThread);
      } else {
        setThreadConversation(null);
      }
      setTurnError(null);
      setIsArchiveDialogOpen(false);
      setIsThreadActionsMenuOpen(false);
      if (heartbeatAutomationError) {
        setThreadActionFeedback({
          tone: "error",
          message: heartbeatAutomationError instanceof Error
            ? heartbeatAutomationError.message
            : String(heartbeatAutomationError),
        });
      } else {
        setThreadActionFeedback(null);
        const settingsLinkLabel = t("codex.archiveInfo.settingsLink");
        const archiveInfoTemplate = t("codex.archiveInfo.electron", { settingsLink: "__SETTINGS_LINK__" });
        const [archiveInfoPrefix, archiveInfoSuffix = ""] = archiveInfoTemplate.split("__SETTINGS_LINK__");
        setAppToast({
          tone: "info",
          message: (
            <span>
              {archiveInfoPrefix}
              <button
                type="button"
                onClick={openArchivedChatsSettings}
                className="cursor-interaction text-[var(--app-shell-accent)] underline underline-offset-2 hover:opacity-80"
              >
                {settingsLinkLabel}
              </button>
              {archiveInfoSuffix}
            </span>
          ),
        });
      }
    } catch (error) {
      setThreadActionFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      setIsArchiveDialogOpen(false);
    }
  };

  const openRenameDialog = () => {
    setRenameDraft(threadConversation?.title ?? "");
    setIsRenameDialogOpen(true);
    setIsThreadActionsMenuOpen(false);
  };

  const openThreadHeartbeatAutomationDialog = (mode: "create" | "edit") => {
    if (!selectedThreadId || !threadConversation) {
      return;
    }

    if (mode === "edit" && selectedThreadAttachedHeartbeatAutomationIncludingPaused) {
      setThreadHeartbeatAutomationDialogDraft({
        ...selectedThreadAttachedHeartbeatAutomationIncludingPaused,
      });
      setThreadHeartbeatAutomationDialogMode("edit");
    } else {
      const baseDraft = buildAutomationDraft("heartbeat");
      if (baseDraft.kind !== "heartbeat") {
        return;
      }
      setThreadHeartbeatAutomationDialogDraft({
        ...baseDraft,
        name: threadConversation.title ?? "",
        targetThreadId: selectedThreadId,
      });
      setThreadHeartbeatAutomationDialogMode("create");
    }

    setIsThreadHeartbeatAutomationDialogOpen(true);
    setIsThreadActionsMenuOpen(false);
  };

  const openThreadHeartbeatAutomationAction = () => {
    openThreadHeartbeatAutomationDialog(
      selectedThreadAttachedHeartbeatAutomationIncludingPaused ? "edit" : "create",
    );
  };

  const saveThreadNameChange = async () => {
    if (!selectedThreadId) {
      return;
    }
    try {
      await setThreadName({
        threadId: selectedThreadId,
        name: renameDraft.trim().length > 0 ? renameDraft.trim() : null,
      });
      const [threads, thread] = await Promise.all([getRecentThreads(), readThread(selectedThreadId)]);
      syncProjectGroups(selectedThreadId, threads);
      setThreadConversation(mergeSyntheticRequestItemsIntoConversation(thread, syntheticRequestItemsByThreadId));
      setIsRenameDialogOpen(false);
      setThreadActionFeedback(null);
    } catch {
      setThreadActionFeedback({
        tone: "error",
        message: t("sidebarElectron.renameThreadError"),
      });
    }
  };

  const submitTurn = async (invertFollowUpAction = false) => {
    const text = composerDraft.trim();
    if (text.length === 0) {
      return;
    }
    setTurnError(null);
    try {
      let thread = threadConversation;
      if (!thread) {
        thread = await createAndSelectThread();
      }
      const threadId = thread.id;
      const cwd = thread.cwd || openProjectPath || null;
      if (activeTurn && activeTurn.threadId === threadId) {
        const effectiveFollowUpAction = invertFollowUpAction
          ? followUpQueueMode === "queue"
            ? "steer"
            : "queue"
          : followUpQueueMode;
        if (effectiveFollowUpAction === "queue") {
          mutateQueuedFollowUps((current) =>
            enqueueQueuedLocalFollowUp(current, {
              threadId,
              cwd,
              text,
            }),
          );
          setComposerDraft("");
          return;
        }
        const turnId = await steerTurn({
          threadId,
          turnId: activeTurn.turnId,
          text,
        });
        setThreadConversation((current) =>
          current && current.id === threadId
            ? appendSteeringUserMessage(
                upsertThreadConversationTurnTiming(current, turnId, {
                  status: "in_progress",
                  turnStartedAtMs: Date.now(),
                }),
                createSteeringUserMessage({
                  threadId,
                  turnId,
                  text,
                  cwd,
                }),
              )
            : current,
        );
        completeImplementPlanFlowForThread(threadId);
        setActiveTurn({ threadId, turnId });
        setComposerDraft("");
        return;
      }
      if (text === "/review") {
        const review = await startReview({ threadId, delivery: reviewDelivery });
        const [threads, reviewThread] = await Promise.all([
          getRecentThreads(),
          readThread(review.reviewThreadId),
        ]);
        syncProjectGroups(review.reviewThreadId, threads);
        setThreadConversation(reviewThread);
        setActiveTurn({ threadId: review.reviewThreadId, turnId: review.turnId });
        setComposerDraft("");
        return;
      }
      const turnId = await startTurn({ threadId, text, cwd });
      completeImplementPlanFlowForThread(threadId);
      setThreadConversation((current) =>
        current && current.id === threadId
          ? upsertThreadConversationTurnTiming(current, turnId, {
              status: "in_progress",
              turnStartedAtMs: Date.now(),
            })
          : current,
      );
      setActiveTurn({ threadId, turnId });
      setComposerDraft("");
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
    }
  };

  const submitTurnForExistingConversation = async (
    threadId: string,
    conversation: ThreadConversation | null,
    draft: string,
    setDraft: (value: string) => void,
    setError: (value: string | null) => void,
    setConversation: (updater: (current: ThreadConversation | null) => ThreadConversation | null) => void,
    invertFollowUpAction = false,
  ) => {
    const text = draft.trim();
    if (text.length === 0) {
      return;
    }

    setError(null);
    try {
      const cwd = conversation?.cwd ?? openProjectPath ?? null;
      if (activeTurn && activeTurn.threadId === threadId) {
        const effectiveFollowUpAction = invertFollowUpAction
          ? followUpQueueMode === "queue"
            ? "steer"
            : "queue"
          : followUpQueueMode;
        if (effectiveFollowUpAction === "queue") {
          mutateQueuedFollowUps((current) =>
            enqueueQueuedLocalFollowUp(current, {
              threadId,
              cwd,
              text,
            }),
          );
          setDraft("");
          return;
        }
        const turnId = await steerTurn({
          threadId,
          turnId: activeTurn.turnId,
          text,
        });
        setConversation((current) =>
          current && current.id === threadId
            ? appendSteeringUserMessage(
                upsertThreadConversationTurnTiming(current, turnId, {
                  status: "in_progress",
                  turnStartedAtMs: Date.now(),
                }),
                createSteeringUserMessage({
                  threadId,
                  turnId,
                  text,
                  cwd,
                }),
              )
            : current,
        );
        completeImplementPlanFlowForThread(threadId);
        setActiveTurn({ threadId, turnId });
        setDraft("");
        return;
      }
      const turnId = await startTurn({ threadId, text, cwd });
      completeImplementPlanFlowForThread(threadId);
      setConversation((current) =>
        current && current.id === threadId
          ? upsertThreadConversationTurnTiming(current, turnId, {
              status: "in_progress",
              turnStartedAtMs: Date.now(),
            })
          : current,
      );
      setActiveTurn({ threadId, turnId });
      setDraft("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleEditUserMessageForConversation = async (
    conversation: ThreadConversation | null,
    editedMessage: string,
    setConversation: (conversation: ThreadConversation) => void,
    setError: (value: string | null) => void,
  ) => {
    const normalizedMessage = editedMessage.trim();
    const editableMessage = findLastEditableUserMessage(conversation, activeTurn);
    if (!editableMessage || normalizedMessage.length === 0) {
      return;
    }

    setError(null);
    try {
      const rollbackResult = await rollbackThread({
        threadId: editableMessage.threadId,
        numTurns: 1,
      });
      const mergedRollbackConversation = mergeSyntheticRequestItemsIntoConversation(
        rollbackResult,
        syntheticRequestItemsByThreadId,
      );
      setConversation(mergedRollbackConversation);

      const nextInput = replaceFirstTextInput(editableMessage.input, normalizedMessage);
      const cwd = rollbackResult.cwd || openProjectPath || null;
      const turnId = await startTurnWithInput({
        threadId: editableMessage.threadId,
        input: nextInput,
        cwd,
      });
      completeImplementPlanFlowForThread(editableMessage.threadId);
      setConversation(
        upsertThreadConversationTurnTiming(mergedRollbackConversation, turnId, {
          status: "in_progress",
          turnStartedAtMs: Date.now(),
        }),
      );
      setActiveTurn({ threadId: editableMessage.threadId, turnId });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const handleEditUserMessage = async (editedMessage: string) => {
    const normalizedMessage = editedMessage.trim();
    if (!editableUserMessage || normalizedMessage.length === 0) {
      return;
    }

    setTurnError(null);
    try {
      const rollbackResult = await rollbackThread({
        threadId: editableUserMessage.threadId,
        numTurns: 1,
      });
      const mergedRollbackConversation = mergeSyntheticRequestItemsIntoConversation(
        rollbackResult,
        syntheticRequestItemsByThreadId,
      );
      setThreadConversation(mergedRollbackConversation);

      const nextInput = replaceFirstTextInput(editableUserMessage.input, normalizedMessage);
      const cwd = rollbackResult.cwd || openProjectPath || null;
      const turnId = await startTurnWithInput({
        threadId: editableUserMessage.threadId,
        input: nextInput,
        cwd,
      });
      completeImplementPlanFlowForThread(editableUserMessage.threadId);
      setThreadConversation((current) =>
        current && current.id === editableUserMessage.threadId
          ? upsertThreadConversationTurnTiming(current, turnId, {
              status: "in_progress",
              turnStartedAtMs: Date.now(),
            })
          : current,
      );
      setActiveTurn({ threadId: editableUserMessage.threadId, turnId });
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const handleImplementPlanRequestSubmit = async (
    request: PendingImplementPlanRequest,
    submission: { type: "followUp"; text: string } | { type: "implement" },
  ) => {
    const text =
      submission.type === "implement"
        ? `${IMPLEMENT_PLAN_PROMPT_PREFIX}\n${request.planContent}`
        : submission.text.trim();
    if (text.length === 0) {
      return;
    }

    const isSideChatThread = request.threadId in sideChatConversationsByIdRef.current;
    clearConversationTurnError(request.threadId);
    try {
      const cwd =
        threadConversation?.id === request.threadId
          ? threadConversation.cwd || openProjectPath || null
          : (sideChatConversationsByIdRef.current[request.threadId]?.cwd ?? openProjectPath ?? null);
      if (activeTurn && activeTurn.threadId === request.threadId) {
        const turnId = await steerTurn({
          threadId: request.threadId,
          turnId: activeTurn.turnId,
          text,
        });
        setThreadConversation((current) =>
          current && current.id === request.threadId
            ? appendSteeringUserMessage(
                upsertThreadConversationTurnTiming(current, turnId, {
                  status: "in_progress",
                  turnStartedAtMs: Date.now(),
                }),
                createSteeringUserMessage({
                  threadId: request.threadId,
                  turnId,
                  text,
                  cwd,
                }),
              )
            : current,
        );
        if (isSideChatThread) {
          updateSideChatConversation(request.threadId, (conversation) =>
            appendSteeringUserMessage(
              upsertThreadConversationTurnTiming(conversation, turnId, {
                status: "in_progress",
                turnStartedAtMs: Date.now(),
              }),
              createSteeringUserMessage({
                threadId: request.threadId,
                turnId,
                text,
                cwd,
              }),
            ),
          );
        }
        setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
        setActiveTurn({ threadId: request.threadId, turnId });
        return;
      }
      const turnId = await startTurn({
        threadId: request.threadId,
        text,
        cwd,
      });
      setThreadConversation((current) =>
        current && current.id === request.threadId
          ? upsertThreadConversationTurnTiming(current, turnId, {
              status: "in_progress",
              turnStartedAtMs: Date.now(),
            })
          : current,
      );
      if (isSideChatThread) {
        updateSideChatConversation(request.threadId, (conversation) =>
          upsertThreadConversationTurnTiming(conversation, turnId, {
            status: "in_progress",
            turnStartedAtMs: Date.now(),
          }),
        );
      }
      setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
      setActiveTurn({ threadId: request.threadId, turnId });
    } catch (error) {
      setConversationTurnError(
        request.threadId,
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const dismissImplementPlanRequest = (request: PendingImplementPlanRequest) => {
    setTurnError(null);
    setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
  };

  const stopTurn = async () => {
    if (!activeTurn) {
      return;
    }
    if (activeTurn.threadId in sideChatConversationsByIdRef.current) {
      setSideChatTurnErrorsById((current) => ({
        ...current,
        [activeTurn.threadId]: null,
      }));
    } else {
      setTurnError(null);
    }
    try {
      await interruptTurn({
        threadId: activeTurn.threadId,
        turnId: activeTurn.turnId,
      });
    } catch (error) {
      if (activeTurn.threadId in sideChatConversationsByIdRef.current) {
        setSideChatTurnErrorsById((current) => ({
          ...current,
          [activeTurn.threadId]: error instanceof Error ? error.message : String(error),
        }));
      } else {
        setTurnError(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const handleApprovalDecision = async (approval: PendingApproval, decision: ApprovalDecision) => {
    const requestKey = approvalRequestKey(approval.requestId);
    clearConversationTurnError(approval.threadId);
    setApprovalActionErrors((current) => {
      if (!(requestKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[requestKey];
      return next;
    });
    setRespondingApprovalKeys((current) =>
      current.includes(requestKey) ? current : [...current, requestKey],
    );
    try {
      await respondToApprovalRequest({ requestId: approval.requestId, decision });
    } catch (error) {
      setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
      setApprovalActionErrors((current) => ({
        ...current,
        [requestKey]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const handleToolRequestUserInputSubmit = async (
    request: PendingToolRequestUserInput,
    values: Record<string, string>,
  ) => {
    const requestKey = approvalRequestKey(request.requestId);
    clearConversationTurnError(request.threadId);
    setApprovalActionErrors((current) => {
      if (!(requestKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[requestKey];
      return next;
    });
    setRespondingApprovalKeys((current) =>
      current.includes(requestKey) ? current : [...current, requestKey],
    );
    try {
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          removeRequestConversationItem(items, request.requestId),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: removeRequestConversationItem(current.items, request.requestId),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: removeRequestConversationItem(conversation.items, request.requestId),
        }));
      }
      await respondToToolRequestUserInput({
        requestId: request.requestId,
        response: createToolRequestUserInputResponse(request.questions, values),
      });
    } catch (error) {
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          upsertUserInputConversationItem(items, request),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: upsertUserInputConversationItem(current.items, request),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: upsertUserInputConversationItem(conversation.items, request),
        }));
      }
      setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
      setApprovalActionErrors((current) => ({
        ...current,
        [requestKey]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const handlePermissionsRequestApprovalSubmit = async (
    request: PendingPermissionsRequestApproval,
    grantMode: "deny" | "turn" | "session",
    strictAutoReview: boolean,
  ) => {
    const requestKey = approvalRequestKey(request.requestId);
    clearConversationTurnError(request.threadId);
    setApprovalActionErrors((current) => {
      if (!(requestKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[requestKey];
      return next;
    });
    setRespondingApprovalKeys((current) =>
      current.includes(requestKey) ? current : [...current, requestKey],
    );
    try {
      const response = createPermissionsRequestApprovalResponse(
        request.permissions,
        grantMode,
        strictAutoReview,
      );
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          completePermissionRequestConversationItem(items, request.requestId, response),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: completePermissionRequestConversationItem(current.items, request.requestId, response),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: completePermissionRequestConversationItem(conversation.items, request.requestId, response),
        }));
      }
      await respondToPermissionsRequestApproval({
        requestId: request.requestId,
        response,
      });
    } catch (error) {
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          upsertPermissionRequestConversationItem(items, request),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: upsertPermissionRequestConversationItem(current.items, request),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: upsertPermissionRequestConversationItem(conversation.items, request),
        }));
      }
      setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
      setApprovalActionErrors((current) => ({
        ...current,
        [requestKey]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const handleMcpServerElicitationRequestSubmit = async (
    request: PendingMcpServerElicitationRequest,
    action: "accept" | "decline" | "cancel",
    content: unknown | null,
  ) => {
    const requestKey = approvalRequestKey(request.requestId);
    clearConversationTurnError(request.threadId);
    setApprovalActionErrors((current) => {
      if (!(requestKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[requestKey];
      return next;
    });
    setRespondingApprovalKeys((current) =>
      current.includes(requestKey) ? current : [...current, requestKey],
    );
    try {
      const response = createMcpServerElicitationRequestResponse(action, content);
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          completeMcpServerElicitationConversationItem(items, request.requestId, response),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: completeMcpServerElicitationConversationItem(current.items, request.requestId, response),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: completeMcpServerElicitationConversationItem(conversation.items, request.requestId, response),
        }));
      }
      await respondToMcpServerElicitationRequest({
        requestId: request.requestId,
        response,
      });
    } catch (error) {
      setSyntheticRequestItemsByThreadId((current) =>
        updateSyntheticRequestItemsForThread(current, request.threadId, (items) =>
          upsertMcpServerElicitationConversationItem(items, request),
        ),
      );
      setThreadConversation((current) => {
        if (!current || current.id !== request.threadId) {
          return current;
        }
        return {
          ...current,
          items: upsertMcpServerElicitationConversationItem(current.items, request),
        };
      });
      if (request.threadId in sideChatConversationsByIdRef.current) {
        updateSideChatConversation(request.threadId, (conversation) => ({
          ...conversation,
          items: upsertMcpServerElicitationConversationItem(conversation.items, request),
        }));
      }
      setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
      setApprovalActionErrors((current) => ({
        ...current,
        [requestKey]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== "undefined" && window.location.pathname !== LOGIN_ROUTE_PATH) {
      window.history.replaceState(window.history.state, "", LOGIN_ROUTE_PATH);
    }
    setCurrentRoute("login");
  };

  const signOut = async () => {
    try {
      await logout();
      navigateToLogin();
    } catch (error) {
      setAppToast({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const openConfigToml = async () => {
    const selectedScope = configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null;
    if (!selectedScope?.filePath) {
      return;
    }
    try {
      await open(selectedScope.filePath);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const openSourceLicenses = () => {
    setSettingsSectionState({ licensesBackPath: "/settings/agent" });
    setSettingsSection("open-source-licenses");
  };

  const updateConfigValue = async (keyPath: string, value: string | boolean) => {
    const controlErrorKey =
      keyPath === "approval_policy"
        ? "approval"
        : keyPath === "sandbox_mode"
          ? "sandbox"
          : keyPath === "sandbox_workspace_write.network_access"
            ? "network"
            : null;
    setConfigError(null);
    if (controlErrorKey) {
      setAgentConfigControlErrors((current) => {
        if (!(controlErrorKey in current)) {
          return current;
        }
        const next = { ...current };
        delete next[controlErrorKey];
        return next;
      });
    }
    const selectedScope = configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null;
    const settingsCwd = threadConversation?.cwd ?? openProjectPath ?? null;
    try {
      await writeConfigValue({
        keyPath,
        value,
        mergeStrategy: "upsert",
        filePath: selectedScope?.kind === "project" ? selectedScope.filePath : null,
        expectedVersion: selectedScope?.expectedVersion ?? null,
      });
    } catch (error) {
      if (controlErrorKey) {
        setAgentConfigControlErrors((current) => ({
          ...current,
          [controlErrorKey]: error instanceof Error ? error.message : String(error),
        }));
        return;
      }
      setConfigError(error instanceof Error ? error.message : String(error));
      return;
    }
    try {
      const response = await readConfig(settingsCwd);
      setConfigSnapshot(response.config);
      const scopeOptions = buildConfigScopeOptions(response);
      setConfigScopeOptions(scopeOptions);
      setSelectedConfigScopeKey((current) => {
        if (scopeOptions.some((scope) => scope.key === current)) {
          return current;
        }
        return chooseDefaultConfigScopeKey(scopeOptions);
      });
      setAgentConfigControlErrors({});
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const renderSettings = () => {
    if (settingsSection === "general-settings") {
      return (
        <GeneralSettings
          codexHome={codexHome}
          workspaceRoot={settingsWorkspaceRoot}
          onComposerEnterBehaviorChange={setComposerEnterBehavior}
          onFollowUpQueueModeChange={setFollowUpQueueMode}
          onOpenChatWithPrompt={(prompt) => {
            setCurrentRoute("chat");
            setComposerDraft(prompt);
          }}
          onReviewDeliveryChange={setReviewDelivery}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "account") {
      return (
        <AccountSettings
          authSnapshot={authSnapshot}
          onNavigateToLogin={navigateToLogin}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "appearance") {
      return (
        <AppearanceSettings
          onOpenChatWithPrompt={(prompt) => openNewConversation({ prefillPrompt: prompt })}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "personalization") {
      return (
        <PersonalizationSettings
          onOpenChatWithPrompt={(prompt) => openNewConversation({ prefillPrompt: prompt })}
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "browser-use") {
      return (
        <BrowserUseSettings
          hasComputerUseApprovalStore={hasComputerUseApprovalStore}
          selectedHostId={selectedSettingsHostId}
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "computer-use") {
      if (!hasComputerUseApprovalStore) {
        return null;
      }

      return (
        <ComputerUseSettings
          selectedHostId={selectedSettingsHostId}
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "usage") {
      return <UsageSettings authMethod={authSnapshot.authState.authMethod} onShowToast={(toast) => setAppToast(toast)} />;
    }

    if (settingsSection === "plugins-settings") {
      return (
        <PluginsSettings
          selectedHostId={selectedSettingsHostId}
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
          onOpenChatWithPrompt={(prompt) => {
            setCurrentRoute("chat");
            setComposerDraft(prompt);
          }}
        />
      );
    }

    if (settingsSection === "skills-settings") {
      return <SkillsSettings workspaceRoot={settingsWorkspaceRoot} />;
    }

    if (settingsSection === "mcp-settings") {
      return <McpSettings selectedHostId={selectedSettingsHostId} workspaceRoot={settingsWorkspaceRoot} />;
    }

    if (settingsSection === "hooks-settings") {
      return (
        <HooksSettings
          selectedHostId={selectedSettingsHostId}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "local-environments") {
      return (
        <LocalEnvironmentsSettings
          codexHome={codexHome}
          onUpdateRouteSearch={(localEnvironmentRouteSearch) => {
            setSettingsSectionState(
              localEnvironmentRouteSearch
                ? {
                    localEnvironmentRouteSearch,
                  }
                : null,
            );
          }}
          routeSearch={
            settingsSectionState != null &&
            typeof settingsSectionState === "object" &&
            !Array.isArray(settingsSectionState) &&
            "localEnvironmentRouteSearch" in settingsSectionState &&
            typeof settingsSectionState.localEnvironmentRouteSearch === "string"
              ? settingsSectionState.localEnvironmentRouteSearch
              : (typeof window === "undefined" ? "" : window.location.search)
          }
          onSelectHostId={setSelectedSettingsHostId}
          selectedHostId={selectedSettingsHostId}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "data-controls") {
      return (
        <DataControlsSettings
          onDismissToast={() => setAppToast(null)}
          onShowToast={(toast) => setAppToast(toast)}
          selectedHostId={selectedSettingsHostId}
          onThreadUnarchived={(threadId, hostId) => void refreshRecentThreadsAfterUnarchive(hostId)}
          onViewThread={(threadId, hostId) => void viewConversationForHost(threadId, hostId)}
        />
      );
    }

    if (settingsSection === "keyboard-shortcuts") {
      return <KeyboardShortcutsSettings />;
    }

    if (settingsSection === "git-settings") {
      return <GitSettings onShowToast={(toast) => setAppToast(toast)} />;
    }

    if (settingsSection === "worktrees") {
      return (
        <WorktreesSettingsPage
          onDismissToast={() => setAppToast(null)}
          onShowToast={(toast) => setAppToast(toast)}
          onViewConversation={(threadId, hostId) => void viewConversationForHost(threadId, hostId)}
          selectedHostId={selectedSettingsHostId}
        />
      );
    }

    if (settingsSection === "open-source-licenses") {
      const backPath =
        settingsSectionState != null &&
        typeof settingsSectionState === "object" &&
        !Array.isArray(settingsSectionState) &&
        "licensesBackPath" in settingsSectionState &&
        typeof settingsSectionState.licensesBackPath === "string" &&
        settingsSectionState.licensesBackPath.startsWith("/settings/")
          ? settingsSectionState.licensesBackPath
          : "/settings/general";
      return (
        <OpenSourceLicensesPage
          onBack={() => {
            setSettingsSection(backPath === "/settings/agent" ? "agent" : "general-settings");
            setSettingsSectionState(null);
          }}
        />
      );
    }

    if (settingsSection === "agent") {
      const selectedScope = configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null;
      const scopedConfig = selectedScope?.config;
      const scopeMenuOptions = configScopeOptions.map((scope) => ({
        group: scope.kind === "project" ? "project" as const : "global" as const,
        key: scope.key,
        label: getConfigScopeLabel(scope, t),
        title: getConfigScopeTitle(scope, t),
      }));
      const approvalPolicy = scopedConfig?.approvalPolicy ?? configSnapshot?.approvalPolicy ?? "on-request";
      const approvalPolicyValue =
        typeof approvalPolicy === "string"
          ? approvalPolicy
          : "on-request";
      const sandboxMode = scopedConfig?.sandboxMode ?? configSnapshot?.sandboxMode ?? "read-only";
      const controlLockReason = getAgentConfigControlLockReason(selectedScope, t);
      const showNetworkAccess = sandboxMode === "workspace-write";
      const networkAccess =
        scopedConfig?.sandboxWorkspaceWrite?.networkAccess ??
        configSnapshot?.sandboxWorkspaceWrite?.networkAccess ??
        false;
      const isScopeReadOnly = controlLockReason !== null || selectedScope?.disabledReason !== null;
      return (
        <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
          <div className="app-card rounded-[18px] px-5 py-4">
            <div className="app-title text-[14px] font-medium">{t("settings.agent.title")}</div>
            <div className="app-text-muted mt-1 text-[13px] leading-6">
              {renderInlineLinkMessage(t("settings.agent.configuration.subtitle.summary"), AGENT_SETTINGS_DOCS_URL)}
            </div>
          </div>
          <div className="app-card rounded-[18px] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                {t("settings.agent.customConfig")}
              </div>
              <ConfigScopeMenu
                selectedKey={selectedScope?.key ?? null}
                options={scopeMenuOptions}
                loadingLabel={t("settings.agent.configuration.scope.loading")}
                projectGroupLabel={t("settings.agent.configuration.scope.projectGroup")}
                globalGroupLabel={t("settings.agent.configuration.scope.globalGroup")}
                onSelect={(key) => {
                  setSelectedConfigScopeKey(key);
                  setAgentConfigControlErrors({});
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] leading-6">{t("settings.agent.configuration.configToml")}</div>
                <div className="app-text-muted mt-1 text-[12px] leading-5">
                  {renderConfigTomlDescription(t)}
                </div>
              </div>
              <button
                type="button"
                disabled={!selectedScope?.filePath}
                onClick={() => void openConfigToml()}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.agent.configuration.scope.open")}
              </button>
            </div>
            {selectedScope?.disabledReason ? (
              <div className="app-card-muted app-text-muted mt-3 rounded-[12px] px-3 py-2 text-[12px]">
                {selectedScope.disabledReason}
              </div>
            ) : null}
              <div className="mt-4 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] leading-6">
                      {t("settings.agent.configuration.approval.label")}
                    </div>
                    <div className="app-text-muted mt-1 text-[12px] leading-5">
                      {t("settings.agent.configuration.approval.definition")}
                    </div>
                    {controlLockReason ? (
                      <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-warning-text)]">
                        {controlLockReason}
                      </div>
                    ) : null}
                    {agentConfigControlErrors.approval ? (
                      <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-error-text)]">
                        {agentConfigControlErrors.approval}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <SettingsChoiceMenu
                      value={approvalPolicyValue}
                      options={approvalPolicyOptions}
                      disabled={isScopeReadOnly}
                      onChange={(value) => void updateConfigValue("approval_policy", value)}
                    />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] leading-6">
                      {t("settings.agent.configuration.sandbox.label")}
                    </div>
                    <div className="app-text-muted mt-1 text-[12px] leading-5">
                      {t("settings.agent.configuration.sandbox.definition")}
                    </div>
                    {controlLockReason ? (
                      <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-warning-text)]">
                        {controlLockReason}
                      </div>
                    ) : null}
                    {agentConfigControlErrors.sandbox ? (
                      <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-error-text)]">
                        {agentConfigControlErrors.sandbox}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <SettingsChoiceMenu
                      value={sandboxMode}
                      options={sandboxModeOptions}
                      disabled={isScopeReadOnly}
                      onChange={(value) => void updateConfigValue("sandbox_mode", value)}
                    />
                  </div>
                </div>
                {showNetworkAccess ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] leading-6">
                        {t("settings.agent.configuration.network.label")}
                      </div>
                      <div className="app-text-muted mt-1 text-[12px] leading-5">
                        {t("settings.agent.configuration.network.definition")}
                      </div>
                      {controlLockReason ? (
                        <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-warning-text)]">
                          {controlLockReason}
                        </div>
                      ) : null}
                      {agentConfigControlErrors.network ? (
                        <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-error-text)]">
                          {agentConfigControlErrors.network}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      <ToggleSwitch
                        checked={networkAccess}
                        disabled={isScopeReadOnly}
                        ariaLabel={t("settings.agent.configuration.network.label")}
                        onChange={(checked) => void updateConfigValue("sandbox_workspace_write.network_access", checked)}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="h-px bg-[var(--app-shell-border)]" />
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] leading-6">{t("settings.openSourceLicenses.rowLabel")}</div>
                    <div className="app-text-muted mt-1 text-[12px] leading-5">
                      {t("settings.openSourceLicenses.rowDescription")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openSourceLicenses}
                    className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                  >
                    {t("settings.openSourceLicenses.view")}
                  </button>
                </div>
              </div>
            </div>
          {configError ? (
            <div className="app-card-error rounded-[18px] px-5 py-4 text-[13px]">
              {configError}
            </div>
          ) : null}
        </div>
      );
    }

    return null;
  };

  if (isAppBootstrapping) {
    return <LoadingPage debugName="PersistedStateProvider" />;
  }

  if (currentRoute === "hotkey-home") {
    return (
      <HotkeyWindowHomePage
        codexHome={codexHome}
        composerEnterBehavior={composerEnterBehavior}
        initialWorkspaceRoot={openProjectPath}
        onOpenLocalEnvironmentsSettings={({ configPath, workspaceRoot }) => {
          const searchParams = new URLSearchParams({
            mode: configPath === null ? "edit" : "preview",
            workspaceRoot,
          });
          if (configPath !== null) {
            searchParams.set("configPath", configPath);
          }
          const nextPath = `/settings/local-environments?${searchParams.toString()}`;
          if (typeof window !== "undefined" && window.location.pathname + window.location.search !== nextPath) {
            window.history.replaceState(window.history.state, "", nextPath);
          }
          setThreadShellVariant("default");
          setSelectedSettingsHostId(LOCAL_SETTINGS_HOST_ID);
          setSettingsSection("local-environments");
          setSettingsSectionState({ localEnvironmentRouteSearch: `?${searchParams.toString()}` });
          setCurrentRoute("settings");
        }}
        onStartCloudConversation={startHotkeyHomeCloudConversation}
        onStartLocalConversation={startHotkeyHomeLocalConversation}
        onStartWorktreeConversation={startHotkeyHomeWorktreeConversation}
      />
    );
  }

  if (currentRoute === "hotkey-new-thread") {
    return (
      <HotkeyWindowNewThreadPage
        composerEnterBehavior={composerEnterBehavior}
        onSubmit={startHotkeyNewThread}
      />
    );
  }

  if (currentRoute === "worktree-init") {
    if (worktreeInitRoute === null) {
      return null;
    }

    return (
      <>
        <WorktreeInitV2Page
          pendingWorktreeId={worktreeInitRoute.pendingWorktreeId}
          shell={worktreeInitRoute.shell}
          onEditEnvironment={({ workspaceRoot, configPath, mode }) => {
            const searchParams = new URLSearchParams({ workspaceRoot, mode });
            if (configPath !== null) {
              searchParams.set("configPath", configPath);
            }
            const nextPath = `/settings/local-environments?${searchParams.toString()}`;
            if (typeof window !== "undefined" && window.location.pathname + window.location.search !== nextPath) {
              window.history.replaceState(window.history.state, "", nextPath);
            }
            setThreadShellVariant("default");
            setWorktreeInitRoute(null);
            setSelectedSettingsHostId(LOCAL_SETTINGS_HOST_ID);
            setSettingsSection("local-environments");
            setSettingsSectionState({ localEnvironmentRouteSearch: `?${searchParams.toString()}` });
            setCurrentRoute("settings");
          }}
          onNavigateHome={() => {
            if (typeof window !== "undefined" && window.location.pathname !== "/") {
              window.history.replaceState(window.history.state, "", "/");
            }
            openNewConversation();
          }}
          onOpenConversation={(conversationId, shell) => {
            const nextPath = buildLocalThreadRoutePath(conversationId, shell);
            if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
              window.history.replaceState(window.history.state, "", nextPath);
            }
            setWorktreeInitRoute(null);
            return selectThread(conversationId, shell);
          }}
          onShowToast={(toast) => setAppToast(toast)}
          onStartNewConversation={({ prefillPrompt }) => {
            if (typeof window !== "undefined" && window.location.pathname !== "/") {
              window.history.replaceState(window.history.state, "", "/");
            }
            openNewConversation({
              focusComposerNonce: Date.now(),
              prefillPrompt,
            });
          }}
        />
        <AppToastRegion toast={appToast} onDismiss={() => setAppToast(null)} />
      </>
    );
  }

  if (currentRoute === "debug") {
    return (
      <DebugWindowPage
        conversationId={selectedThreadId}
        isLoading={isThreadConversationLoading}
        onClose={() => void appWindow.close()}
        threadConversation={threadConversation}
      />
    );
  }

  if (currentRoute === "editor-diff") {
    return <EditorDiffPage routeState={editorDiffRouteState} />;
  }

  if (currentRoute === "global-dictation") {
    return <GlobalDictationPage />;
  }

  if (currentRoute === "avatar-overlay") {
    return <AvatarOverlayPage />;
  }

  if (currentRoute === "login") {
    return (
      <>
        <LoginRoutePage
          authSnapshot={authSnapshot}
          onNavigateToWelcome={() => {
            if (typeof window !== "undefined" && window.location.pathname !== WELCOME_ROUTE_PATH) {
              window.history.replaceState(window.history.state, "", WELCOME_ROUTE_PATH);
            }
            setCurrentRoute("welcome");
          }}
          onShowToast={(toast) => setAppToast(toast)}
        />
        <AppToastRegion toast={appToast} onDismiss={() => setAppToast(null)} />
      </>
    );
  }

  if (currentRoute === "first-run") {
    return (
      <FirstRunPage
        authMethod={authSnapshot.authState.authMethod}
        locale={locale}
        onAccept={() => {
          if (typeof window !== "undefined") {
            window.history.replaceState(window.history.state, "", "/");
          }
          setCurrentRoute("chat");
        }}
        t={t}
      />
    );
  }

  if (currentRoute === "welcome") {
    return (
      <WelcomePage
        onCompleteToHome={() => {
          if (typeof window !== "undefined") {
            window.history.replaceState(
              window.history.state,
              "",
              `/?${WELCOME_V2_ONBOARDING_QUERY_PARAM}=1`,
            );
          }
          openNewConversation({ focusComposerNonce: Date.now() });
        }}
        onContinueToWorkspace={() => {
          if (typeof window !== "undefined") {
            window.history.replaceState(window.history.state, "", SELECT_WORKSPACE_ROUTE_PATH);
          }
          setCurrentRoute("select-workspace");
        }}
      />
    );
  }

  if (currentRoute === "select-workspace") {
    return (
      <SelectWorkspacePage
        recentThreads={recentThreadEntries}
        onContinueToHome={({ focusComposerNonce }) => {
          openNewConversation({ focusComposerNonce });
        }}
      />
    );
  }

  return (
    <main className="h-full overflow-hidden bg-[var(--app-shell-surface)] text-[13px] text-[var(--app-shell-text)]">
      <div className="flex h-full flex-col">
        <header className="flex h-[var(--app-shell-toolbar-sm)] items-center border-b border-[var(--app-shell-border)] bg-[var(--app-shell-topbar)]">
          <div className="flex items-center gap-1 px-2.5">
            <button
              type="button"
              aria-label={t("app.shell.appMenu")}
              className="app-control-weak flex h-6 w-6 items-center justify-center rounded-[8px] text-[10px] shadow-[0_1px_0_rgba(0,0,0,0.03)]"
            >
              □
            </button>
            <div className="ml-1 flex items-center gap-0.5">
              {menuItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="app-topbar-button rounded-[7px] px-2.5 py-1 text-[14px] transition"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div
            className="h-full flex-1"
            onMouseDown={handleDragMouseDown}
            onDoubleClick={() => void toggleMaximize()}
          />

          <div className="flex items-center gap-3 pr-1.5">
            <div className="app-badge rounded-full px-3 py-1 text-left text-[11px] leading-4">
              <div className="tracking-[0.08em]">{formatAuthLabel(authSnapshot, t)}</div>
              <div className="truncate text-[10px] tracking-normal text-[var(--app-shell-subtle)]">
                {formatAuthDetail(authSnapshot, t) ?? "\u00a0"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
                >
                  {t("auth.signOut")}
                </button>
              ) : null}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => void minimizeWindow()}
                className="app-topbar-button flex h-[35px] w-11 items-center justify-center text-[12px]"
              >
                _
              </button>
              <button
                type="button"
                onClick={() => void toggleMaximize()}
                className="app-topbar-button flex h-[35px] w-11 items-center justify-center text-[11px]"
              >
                {isMaximized ? "❐" : "□"}
              </button>
              <button
                type="button"
                onClick={() => void closeWindow()}
                className="app-topbar-button flex h-[35px] w-11 items-center justify-center text-[14px] hover:bg-[#d84c3f] hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </header>

        {currentRoute === "plan-summary" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <PlanSummaryPage planSummary={pendingPlanSummary} t={t} />
          </div>
        ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-[var(--app-shell-sidebar-width)] flex-col border-r border-[var(--app-shell-border)] bg-[var(--app-shell-sidebar)] px-3 pt-3 pb-3">
            {currentRoute !== "settings" ? (
              <>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const isActive =
                      item.action === "new-thread"
                        ? true
                        : item.action === "search-files"
                          ? false
                          : !item.disabled && item.route === currentRoute;
                    const buttonClassName = [
                      "flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]",
                      isActive ? "app-nav-item-active" : item.disabled ? "app-nav-item-disabled" : "app-nav-item-idle",
                    ].join(" ");
                    return (
                      <div key={`${item.route}:${item.label}`} className="group relative">
                        <button
                          type="button"
                          disabled={item.disabled}
                          title={item.tooltipKey ? t(item.tooltipKey) : undefined}
                          onClick={() => {
                            if (item.action === "new-thread") {
                              setCurrentRoute("chat");
                              setSkillsRouteState(null);
                              void startNewThread();
                              return;
                            }
                            if (item.action === "search-files") {
                              openWorkspaceFileSearch();
                              return;
                            }
                            if (item.disabled) {
                              return;
                            }
                            if (item.route === "skills") {
                              setSkillsRouteState(null);
                            }
                            setCurrentRoute(item.route);
                          }}
                          className={buttonClassName}
                        >
                          <span className="app-text-muted flex h-4 w-4 items-center justify-center">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                        {item.tooltipKey ? (
                          <div className="pointer-events-none absolute top-1/2 left-full z-10 ml-3 hidden -translate-y-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block">
                            {t(item.tooltipKey)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between px-1 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  <span>{t("app.chat.projects")}</span>
                  <button
                    type="button"
                    onClick={() => void startNewThread()}
                    className="app-text-muted flex h-4 w-4 items-center justify-center"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {projectGroups.length > 0 ? (
                    projectGroups.map((group) => (
                      <section key={group.name} className="space-y-1.5">
                        <div className="app-title flex items-center justify-between px-1 text-[14px]">
                          <span className="truncate">{group.name}</span>
                          <span className="app-text-muted flex h-3.5 w-3.5 items-center justify-center">
                            <MoreActionsIcon className="h-3.5 w-3.5" />
                          </span>
                        </div>

                        <div className="space-y-1">
                          {group.threads.map((thread) => (
                            <button
                              key={thread.id}
                              type="button"
                              onClick={() => void selectThread(thread.id)}
                              className={[
                                "flex w-full items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-left transition",
                                thread.active || selectedThreadId === thread.id
                                  ? "app-nav-item-active"
                                  : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="app-title truncate text-[13px] leading-5">{thread.title}</div>
                              </div>
                              <div className="pt-[1px] text-[12px] text-[var(--app-shell-subtle)]">{thread.age}</div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="app-badge rounded-[14px] px-3.5 py-3 text-[13px] leading-6">
                      {t("app.chat.noRecentThreads")}
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-[var(--app-shell-border)] pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentRoute("settings")}
                    className="app-nav-item-idle flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]"
                  >
                    <span className="app-text-muted flex h-4 w-4 items-center justify-center">
                      <SettingsCogIcon className="h-4 w-4" />
                    </span>
                    <span>{t("app.nav.settings")}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentRoute("chat")}
                  className="app-nav-item-idle flex h-10 items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]"
                >
                  <span className="app-text-muted flex h-4 w-4 items-center justify-center">
                    <BackToAppIcon className="h-4 w-4" />
                  </span>
                  <span>{t("settings.nav.back")}</span>
                </button>

                <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {settingsNavigationGroups.map((group) => (
                    <div key={group.key} className="space-y-1">
                      {group.headingKey ? (
                        <div className="mb-1 flex items-center justify-between gap-2 px-3.5">
                          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
                            {t(group.headingKey)}
                          </div>
                          {group.key === "host" ? (
                            <SettingsHostDropdown
                              connectedRemoteConnections={connectedSettingsRemoteConnections}
                              remoteConnectionHostIds={settingsRemoteConnectionHostIds}
                              selectedHostId={selectedSettingsHostId}
                              onSelectHost={(hostId) => {
                                setSelectedSettingsHostId(hostId);
                              }}
                              t={t}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSettingsSection(item.id);
                            setSettingsSectionState(null);
                          }}
                          className={[
                            "flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]",
                            settingsSection === item.id ? "app-nav-item-active" : "app-nav-item-idle",
                          ].join(" ")}
                        >
                          <span className="app-text-muted flex h-4 w-4 shrink-0 items-center justify-center">
                            <SettingsSectionIcon className="h-4 w-4" section={item.id} />
                          </span>
                          {t(item.labelKey)}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>

          <section className="min-w-0 flex-1 bg-[var(--app-shell-surface)]">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-tl-[18px] rounded-bl-[18px] border border-[var(--app-shell-border-heavy)] bg-[var(--app-shell-main-surface)] shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
              <div className="flex h-[var(--app-shell-toolbar)] items-center gap-3 border-b border-[var(--app-shell-border)] px-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={t("app.shell.back")}
                    onClick={() => setCurrentRoute("chat")}
                    className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] text-[13px]"
                  >
                    <BackNavigationIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("app.shell.forward")}
                    className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] text-[13px]"
                  >
                    <ForwardNavigationIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="app-control flex items-center gap-2 rounded-[12px] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                    <span className="truncate text-[14px]">
                      {shellHeaderTitle}
                    </span>
                    {currentRoute === "chat" ? (
                      <>
                        <span className="ml-auto shrink-0 text-[12px] text-[#21a05b]">+{totalAdditions}</span>
                        <span className="shrink-0 text-[12px] text-[#c3564e]">-{totalDeletions}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentRoute === "chat" ? (
                    <div className="relative flex items-center gap-2">
                      {!isRightPanelOpen ? (
                        <RightPanelOpenTabMenu
                          canOfferBrowserTab={canOfferBrowserRightPanelTab}
                          canOfferReviewTab={canOfferReviewRightPanelTab}
                          canOpenWorkspaceFileSearch={chatWorkspaceRoot !== null}
                          onOpenBrowserTab={() => openRightPanelTab("browser")}
                          onOpenReviewTab={() => openRightPanelTab("review")}
                          onOpenWorkspaceFileSearch={openWorkspaceFileSearch}
                          t={t}
                        />
                      ) : null}
                      <div
                        className={[
                          "flex items-center gap-1 rounded-lg border border-transparent",
                          !isRightPanelOpen && collapsedRightPanelTabs.length > 0
                            ? "p-0.5 hover:border-[var(--app-shell-border)]"
                            : "",
                        ].join(" ")}
                      >
                        {!isRightPanelOpen && collapsedRightPanelTabs.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {collapsedRightPanelTabs.map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                title={getRightPanelTabLabel(tab, t)}
                                aria-label={getRightPanelTabLabel(tab, t)}
                                onClick={() => activateRightPanelTab(tab.id)}
                                className="app-control-weak !h-6 !w-6 rounded-[8px]"
                              >
                                <span className="icon-sm flex items-center justify-center [&>*]:!h-full [&>*]:!w-full">
                                  {renderRightPanelTabIcon(tab)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          title={t("thread.sidePanel.toggle")}
                          aria-label={t("thread.sidePanel.toggle")}
                          aria-pressed={isRightPanelOpen}
                          onClick={toggleRightPanel}
                          className={[
                            "flex h-8 w-8 items-center justify-center rounded-[10px]",
                            isRightPanelOpen ? "app-control" : "app-control-weak",
                          ].join(" ")}
                        >
                          <ForwardNavigationIcon
                            className={[
                              "h-4 w-4",
                              isRightPanelOpen ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {currentRoute === "chat" ? (
                isThreadConversationLoading ? (
                  <div className="relative min-h-0 flex-1">
                    <LoadingPage fillParent debugName="LocalConversationPage" />
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1" style={shellColumns}>
                    <ChatConversationMainPane
                      threadActionsMenuRef={threadActionsMenuRef}
                      composerDraft={composerDraft}
                      composerEnterBehavior={composerEnterBehavior}
                      composerFocusNonce={composerFocusNonce}
                      followUpQueueMode={followUpQueueMode}
                      hasAttachedHeartbeatAutomation={selectedThreadAttachedHeartbeatAutomation !== null}
                      isThreadActionsMenuOpen={isThreadActionsMenuOpen}
                      isThreadHeartbeatAutomationActionDisabled={isThreadHeartbeatAutomationActionDisabled}
                      isThreadHeartbeatAutomationActionVisible={shouldShowThreadHeartbeatAutomationAction}
                      isWorktreeThread={isWorktreeThread}
                      heartbeatAutomationActionLabelKey={threadHeartbeatAutomationActionLabelKey}
                      heartbeatAutomationButtonTooltip={heartbeatAutomationOpenButtonTooltip}
                      currentThreadApprovals={currentThreadApprovals}
                      currentThreadImplementPlanRequests={currentThreadImplementPlanRequests}
                      currentThreadMcpServerElicitationRequest={currentThreadMcpServerElicitationRequest}
                      currentThreadPermissionsRequestApproval={currentThreadPermissionsRequestApproval}
                      currentThreadToolRequestUserInput={currentThreadToolRequestUserInput}
                      currentThreadQueuedFollowUps={currentThreadQueuedFollowUps}
                      onApprovalDecision={(approval, decision) => void handleApprovalDecision(approval, decision)}
                      onDismissImplementPlanRequest={dismissImplementPlanRequest}
                      onImplementPlanRequestSubmit={(request, submission) =>
                        void handleImplementPlanRequestSubmit(request, submission)
                      }
                      onMcpServerElicitationRequestSubmit={(request, action, content) =>
                        void handleMcpServerElicitationRequestSubmit(request, action, content)
                      }
                      onArchiveThread={() => {
                        setIsArchiveDialogOpen(true);
                        setIsThreadActionsMenuOpen(false);
                      }}
                      onCopyAppLink={() => void copyAppLink()}
                      onCopyConversationMarkdown={() => void copyConversationMarkdown()}
                      onCopySessionId={() => void copySessionId()}
                      onCopyWorkingDirectory={() => void copyWorkingDirectory()}
                      onForkSelectedThread={() => void forkSelectedThread()}
                      onOpenSideChat={() => void openSideChatForSelectedThread()}
                      onOpenAttachedHeartbeatAutomation={() => openThreadHeartbeatAutomationDialog("edit")}
                      onOpenThreadHeartbeatAutomationAction={openThreadHeartbeatAutomationAction}
                      onOpenRemoteTask={(taskId) => void openRemoteTask(taskId)}
                      onOpenRenameDialog={openRenameDialog}
                      onSelectThread={(threadId) => void selectThread(threadId)}
                      onEditUserMessage={(text) => void handleEditUserMessage(text)}
                      onPermissionsRequestApprovalSubmit={(request, grantMode, strictAutoReview) =>
                        void handlePermissionsRequestApprovalSubmit(request, grantMode, strictAutoReview)
                      }
                      onToolRequestUserInputSubmit={(request, values) =>
                        void handleToolRequestUserInputSubmit(request, values)
                      }
                      onComposerDraftChange={setComposerDraft}
                      onRemoveQueuedFollowUp={removeQueuedFollowUp}
                      onStopTurn={() => void stopTurn()}
                      onSubmitTurn={(invertFollowUpAction) => void submitTurn(invertFollowUpAction)}
                      onToggleThreadActionsMenu={() => setIsThreadActionsMenuOpen((value) => !value)}
                      approvalActionErrors={approvalActionErrors}
                      reviewDelivery={reviewDelivery}
                      respondingApprovalKeys={respondingApprovalKeys}
                      selectedAvatar={selectedAvatar}
                      submitButtonMode={submitButtonMode}
                      t={t}
                      threadConversation={threadConversation}
                      turnError={turnError}
                    />

                    {isRightPanelOpen ? (
                      <div className="min-h-0 flex flex-col">
                        <RightPanelTabStrip
                          activeTabId={activeRightPanelTabId}
                          openTabs={openRightPanelTabs}
                          onActivateTab={activateRightPanelTab}
                          onCloseTab={closeRightPanelTab}
                          canOfferBrowserTab={canOfferBrowserRightPanelTab}
                          canOfferReviewTab={canOfferReviewRightPanelTab}
                          canOpenWorkspaceFileSearch={chatWorkspaceRoot !== null}
                          onOpenBrowserTab={() => openRightPanelTab("browser")}
                          onOpenReviewTab={() => openRightPanelTab("review")}
                          onOpenWorkspaceFileSearch={openWorkspaceFileSearch}
                          t={t}
                        />
                        <ChatSidePanel
                          activeTab={activeRightPanelTab}
                          composerDraft={
                            activeSideChatConversationId === null
                              ? ""
                              : (sideChatComposerDraftsById[activeSideChatConversationId] ?? "")
                          }
                          composerEnterBehavior={composerEnterBehavior}
                          followUpQueueMode={followUpQueueMode}
                          reviewDelivery={reviewDelivery}
                          selectedAvatar={selectedAvatar}
                          submitButtonMode={
                            activeSideChatConversationId !== null &&
                            activeTurn !== null &&
                            activeTurn.threadId === activeSideChatConversationId &&
                            (sideChatComposerDraftsById[activeSideChatConversationId] ?? "").trim().length === 0
                              ? "stop"
                              : "send"
                          }
                          sideChatConversation={activeSideChatConversation}
                          sideChatApprovals={currentSideChatApprovals}
                          sideChatImplementPlanRequests={currentSideChatImplementPlanRequests}
                          sideChatMcpServerElicitationRequest={currentSideChatMcpServerElicitationRequest}
                          sideChatPermissionsRequestApproval={currentSideChatPermissionsRequestApproval}
                          sideChatToolRequestUserInput={currentSideChatToolRequestUserInput}
                          sideChatQueuedFollowUps={currentSideChatQueuedFollowUps}
                          sideChatTurnError={
                            activeSideChatConversationId === null
                              ? null
                              : (sideChatTurnErrorsById[activeSideChatConversationId] ?? null)
                          }
                          onOpenReviewFile={(change) => void handleReviewFileSelected(change)}
                          onApprovalDecision={(approval, decision) => void handleApprovalDecision(approval, decision)}
                          onComposerDraftChange={(value) => {
                            if (!activeSideChatConversationId) {
                              return;
                            }
                            setSideChatComposerDraftsById((current) => ({
                              ...current,
                              [activeSideChatConversationId]: value,
                            }));
                          }}
                          onDismissImplementPlanRequest={dismissImplementPlanRequest}
                          onEditUserMessage={(text) => {
                            if (!activeSideChatConversationId) {
                              return;
                            }
                            return handleEditUserMessageForConversation(
                              activeSideChatConversation,
                              text,
                              (conversation) => {
                                setSideChatConversationsById((current) => ({
                                  ...current,
                                  [activeSideChatConversationId]: conversation,
                                }));
                                loadedConversationsByIdRef.current.set(conversation.id, conversation);
                              },
                              (value) => {
                                setSideChatTurnErrorsById((current) => ({
                                  ...current,
                                  [activeSideChatConversationId]: value,
                                }));
                              },
                            );
                          }}
                          onImplementPlanRequestSubmit={(request, submission) =>
                            void handleImplementPlanRequestSubmit(request, submission)
                          }
                          onMcpServerElicitationRequestSubmit={(request, action, content) =>
                            void handleMcpServerElicitationRequestSubmit(request, action, content)
                          }
                          onPermissionsRequestApprovalSubmit={(request, grantMode, strictAutoReview) =>
                            void handlePermissionsRequestApprovalSubmit(request, grantMode, strictAutoReview)
                          }
                          onRemoveQueuedFollowUp={removeQueuedFollowUp}
                          onSelectThread={(threadId) => void selectThread(threadId)}
                          onStopTurn={() => void stopTurn()}
                          onSubmitTurn={(invertFollowUpAction) => {
                            if (!activeSideChatConversationId) {
                              return;
                            }
                            void submitTurnForExistingConversation(
                              activeSideChatConversationId,
                              activeSideChatConversation,
                              sideChatComposerDraftsById[activeSideChatConversationId] ?? "",
                              (value) => {
                                setSideChatComposerDraftsById((current) => ({
                                  ...current,
                                  [activeSideChatConversationId]: value,
                                }));
                              },
                              (value) => {
                                setSideChatTurnErrorsById((current) => ({
                                  ...current,
                                  [activeSideChatConversationId]: value,
                                }));
                              },
                              (updater) => {
                                setSideChatConversationsById((current) => {
                                  const existingConversation = current[activeSideChatConversationId] ?? null;
                                  const nextConversation = updater(existingConversation);
                                  if (!nextConversation) {
                                    return current;
                                  }
                                  loadedConversationsByIdRef.current.set(nextConversation.id, nextConversation);
                                  return {
                                    ...current,
                                    [activeSideChatConversationId]: nextConversation,
                                  };
                                });
                              },
                              invertFollowUpAction,
                            );
                          }}
                          onToolRequestUserInputSubmit={(request, values) =>
                            void handleToolRequestUserInputSubmit(request, values)
                          }
                          approvalActionErrors={approvalActionErrors}
                          respondingApprovalKeys={respondingApprovalKeys}
                          t={t}
                          threadDiffSummary={threadDiffSummary}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              ) : currentRoute === "scratchpad" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ScratchpadPage />
                </div>
              ) : currentRoute === "pull-requests" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <PullRequestsRoutePage onShowToast={(toast) => setAppToast(toast)} />
                </div>
              ) : currentRoute === "automations" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <AutomationsRoutePage
                    hasConnectedRemoteConnections={
                      connectedSettingsRemoteConnections.length > 0
                    }
                    onOpenLocalEnvironmentsSettings={({ configPath, workspaceRoot }) => {
                      const searchParams = new URLSearchParams({ workspaceRoot });
                      if (configPath !== null) {
                        searchParams.set("configPath", configPath);
                      }
                      const nextPath = `/settings/local-environments?${searchParams.toString()}`;
                      if (
                        typeof window !== "undefined" &&
                        window.location.pathname + window.location.search !== nextPath
                      ) {
                        window.history.replaceState(window.history.state, "", nextPath);
                      }
                      setSettingsSection("local-environments");
                      setSettingsSectionState({
                        localEnvironmentRouteSearch: `?${searchParams.toString()}`,
                      });
                      setCurrentRoute("settings");
                    }}
                    recentThreads={recentThreadEntries}
                    onOpenThread={selectThread}
                    selectedHostId={selectedSettingsHostId}
                  />
                </div>
              ) : currentRoute === "skills" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <SkillsRoutePage
                    authMethod={authSnapshot.authState.authMethod}
                    codexHome={codexHome}
                    connectedRemoteConnections={connectedSettingsRemoteConnections}
                    initialTab={skillsRouteState?.initialTab}
                    isPluginsRouteEnabled={isPluginsRouteEnabled}
                    onConsumeInitialState={() => setSkillsRouteState(null)}
                    onOpenChatWithPrompt={(prompt) =>
                      openNewConversation({
                        focusComposerNonce: Date.now(),
                        prefillPrompt: prompt,
                      })
                    }
                    onSelectHost={setSelectedSettingsHostId}
                    onShowToast={(toast) => setAppToast(toast)}
                    pluginDeepLinkAuthBlocked={skillsRouteState?.pluginDeepLinkAuthBlocked}
                    remoteConnectionHostIds={settingsRemoteConnectionHostIds}
                    selectedHostId={selectedSettingsHostId}
                    workspaceRoot={settingsWorkspaceRoot}
                  />
                </div>
              ) : (
                <div key={selectedSettingsHostId} className="min-h-0 flex-1 overflow-y-auto">
                  {renderSettings()}
                </div>
              )}
              {threadActionFeedback ? (
                <div
                  className={[
                    threadActionFeedback.tone === "error" ? "app-card-error" : "app-card app-text-muted",
                    "border-t border-[var(--app-shell-border)] px-4 py-2 text-[12px]",
                  ].join(" ")}
                >
                  {threadActionFeedback.message}
                </div>
              ) : null}
            </div>
          </section>
        </div>
        )}
      </div>
      {isArchiveDialogOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">
              {t(
                hasArchivedThreadHeartbeatAutomation
                  ? "threadHeader.archiveConfirmHeartbeatTitle"
                  : "threadHeader.archiveConfirmTitle",
              )}
            </div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {hasArchivedThreadHeartbeatAutomation
                ? archivedThreadHeartbeatAutomationName.length > 0
                  ? t("threadHeader.archiveConfirmHeartbeatSubtitleNamed", {
                      name: archivedThreadHeartbeatAutomationName,
                    })
                  : t("threadHeader.archiveConfirmHeartbeatSubtitleUnnamed")
                : t("threadHeader.archiveConfirmSubtitle")}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsArchiveDialogOpen(false)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("threadHeader.archiveConfirmCancel")}
              </button>
              <button
                type="button"
                onClick={() => void archiveSelectedThread()}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t(
                  hasArchivedThreadHeartbeatAutomation
                    ? "threadHeader.archiveConfirmHeartbeatConfirm"
                    : "threadHeader.archiveConfirmConfirm",
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ThreadHeartbeatAutomationDialog
        open={isThreadHeartbeatAutomationDialogOpen}
        initialDraft={threadHeartbeatAutomationDialogDraft}
        initialMode={threadHeartbeatAutomationDialogMode}
        recentThreads={recentThreadEntries}
        onAutomationsChanged={() => refreshThreadHeaderAutomations()}
        onClose={() => setIsThreadHeartbeatAutomationDialogOpen(false)}
        onOpenThread={(threadId) => {
          setIsThreadHeartbeatAutomationDialogOpen(false);
          void selectThread(threadId);
        }}
      />
      <WorkspaceFileCommandMenu
        commandKeymapState={commandKeymapState}
        initialMode={workspaceFileCommandMenuMode ?? "files"}
        isOpen={workspaceFileCommandMenuMode !== null}
        workspaceRoot={chatWorkspaceRoot}
        onClose={() => setWorkspaceFileCommandMenuMode(null)}
        onSelectFile={handleWorkspaceFileSelected}
        onError={(message) => {
          setWorkspaceFileCommandMenuMode(null);
          setThreadActionFeedback({ tone: "error", message });
        }}
        t={t}
      />
      {isRenameDialogOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">{t("sidebarElectron.renameThreadDialogTitle")}</div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("sidebarElectron.renameThreadDialogSubtitle")}
            </div>
            <input
              aria-label={t("sidebarElectron.renameThreadDialogAriaLabel")}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              placeholder={t("sidebarElectron.renameThreadDialogPlaceholder")}
              className="app-control app-text-input mt-4 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenameDialogOpen(false)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("sidebarElectron.renameThreadDialogCancel")}
              </button>
              <button
                type="button"
                onClick={() => void saveThreadNameChange()}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("sidebarElectron.renameThreadDialogSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AppToastRegion toast={appToast} onDismiss={() => setAppToast(null)} />
    </main>
  );
}

function DebugWindowPage({
  conversationId,
  isLoading,
  onClose,
  threadConversation,
}: {
  conversationId: string | null;
  isLoading: boolean;
  onClose: () => void;
  threadConversation: ThreadConversation | null;
}) {
  return <DebugWindowPageContent conversationId={conversationId} isLoading={isLoading} threadConversation={threadConversation} onClose={onClose} />;
}

export default App;

function isSettingsInputElement(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable) {
    return true;
  }
  return element.closest("[contenteditable='true']") != null;
}

function orderSettingsNavigationItems(
  items: Array<{ id: SettingsSection; labelKey: MessageKey }>,
  preferredOrder: SettingsSection[],
) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return [
    ...preferredOrder.flatMap((sectionId) => {
      const item = itemsById.get(sectionId);
      return item ? [item] : [];
    }),
    ...items.filter((item) => !preferredOrder.includes(item.id)),
  ];
}

function SettingsHostDropdown({
  connectedRemoteConnections,
  remoteConnectionHostIds,
  selectedHostId,
  onSelectHost,
  t,
}: {
  connectedRemoteConnections: RemoteConnection[];
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  onSelectHost: (hostId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRemoteConnection =
    connectedRemoteConnections.find((remoteConnection) => remoteConnection.hostId === selectedHostId) ?? null;
  const localHostLabel = t("settings.hostDropdown.local");
  const selectedHostLabel = selectedRemoteConnection?.displayName ?? localHostLabel;
  const hostOptions = [
    { hostId: LOCAL_SETTINGS_HOST_ID, displayName: localHostLabel },
    ...connectedRemoteConnections.map((remoteConnection) => ({
      hostId: remoteConnection.hostId,
      displayName: remoteConnection.displayName,
    })),
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        aria-label={t("settings.hostDropdown.title")}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex h-7 w-auto max-w-[160px] items-center gap-2 rounded-[10px] px-2 text-[13px]"
      >
        {selectedRemoteConnection === null ? (
          <SettingsLocalHostIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-text)]" />
        ) : (
          <SettingsRemoteHostIcon
            className="h-4 w-4 shrink-0"
            hostId={selectedRemoteConnection.hostId}
            hostIdsForColorAssignment={remoteConnectionHostIds}
          />
        )}
        <span className="truncate text-left text-[var(--app-shell-text)]">{selectedHostLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
            {t("settings.hostDropdown.title")}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {hostOptions.map((hostOption) => {
              const isSelected = hostOption.hostId === selectedHostId;
              return (
                <button
                  key={hostOption.hostId}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectHost(hostOption.hostId);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {hostOption.hostId === LOCAL_SETTINGS_HOST_ID ? (
                      <SettingsLocalHostIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <SettingsRemoteHostIcon
                        className="h-4 w-4 shrink-0"
                        hostId={hostOption.hostId}
                        hostIdsForColorAssignment={remoteConnectionHostIds}
                      />
                    )}
                    <span className="truncate">{hostOption.displayName}</span>
                  </span>
                  {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsLocalHostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M17.6682 13.998H12.6565L11.9641 14.3447C11.8718 14.3909 11.7695 14.415 11.6663 14.415H8.33325C8.23001 14.415 8.12774 14.3909 8.0354 14.3447L7.34302 13.998H2.32837V14.583C2.32837 15.1362 2.77712 15.585 3.33032 15.585H16.6663C17.2195 15.585 17.6682 15.1362 17.6682 14.583V13.998ZM16.8352 6.41699C16.8352 5.93931 16.8347 5.62054 16.8147 5.37598C16.8002 5.19841 16.7766 5.09313 16.7512 5.02246L16.7258 4.96191C16.6538 4.82049 16.5493 4.69891 16.4221 4.60645L16.2883 4.52441C16.2194 4.48931 16.1101 4.45489 15.8733 4.43555C15.6288 4.4156 15.3106 4.41504 14.8333 4.41504H5.16626C4.68886 4.41504 4.37071 4.41559 4.12622 4.43555C3.94903 4.45002 3.84339 4.47277 3.77271 4.49805L3.71216 4.52441C3.57094 4.59637 3.4491 4.70021 3.35669 4.82715L3.27368 4.96191C3.23861 5.03079 3.20513 5.13947 3.18579 5.37598C3.16581 5.62054 3.16528 5.93931 3.16528 6.41699V12.668H7.50024L7.57642 12.6729C7.65302 12.6817 7.72779 12.7036 7.79712 12.7383L8.4895 13.085H11.51L12.2024 12.7383L12.2737 12.708C12.346 12.6819 12.423 12.668 12.5002 12.668H16.8352V6.41699ZM18.1653 12.668H18.3333C18.7003 12.668 18.9981 12.9659 18.9983 13.333V14.583C18.9983 15.8708 17.954 16.915 16.6663 16.915H3.33032C2.04258 16.915 0.998291 15.8708 0.998291 14.583V13.333L1.01196 13.1992C1.07402 12.8962 1.34201 12.668 1.66333 12.668H1.83521V6.41699C1.83521 5.96125 1.83419 5.57886 1.85962 5.26758C1.88569 4.94869 1.94266 4.6459 2.08911 4.3584L2.17896 4.19727C2.40296 3.83215 2.72389 3.53443 3.10767 3.33887L3.21606 3.28809C3.47122 3.17862 3.73854 3.13317 4.01782 3.11035C4.32903 3.08493 4.71068 3.08496 5.16626 3.08496H14.8333C15.2888 3.08496 15.6705 3.08494 15.9817 3.11035C16.3007 3.13642 16.6042 3.19231 16.8918 3.33887L17.052 3.42871C17.4174 3.65275 17.7147 3.97437 17.9104 4.3584L17.9612 4.4668C18.0705 4.72179 18.1171 4.9885 18.1399 5.26758C18.1653 5.57886 18.1653 5.96125 18.1653 6.41699V12.668Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsRemoteHostIcon({
  className,
  hostId,
  hostIdsForColorAssignment,
}: {
  className?: string;
  hostId: string;
  hostIdsForColorAssignment: string[];
}) {
  const color = getSettingsRemoteHostColor(hostId, hostIdsForColorAssignment);
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path d="M10 2.125C14.3492 2.125 17.875 5.65076 17.875 10C17.875 14.3492 14.3492 17.875 10 17.875C5.65076 17.875 2.125 14.3492 2.125 10C2.125 5.65076 5.65076 2.125 10 2.125ZM7.88672 10.625C7.94334 12.3161 8.22547 13.8134 8.63965 14.9053C8.87263 15.5194 9.1351 15.9733 9.39453 16.2627C9.65437 16.5524 9.86039 16.625 10 16.625C10.1396 16.625 10.3456 16.5524 10.6055 16.2627C10.8649 15.9733 11.1274 15.5194 11.3604 14.9053C11.7745 13.8134 12.0567 12.3161 12.1133 10.625H7.88672ZM3.40527 10.625C3.65313 13.2734 5.45957 15.4667 7.89844 16.2822C7.7409 15.997 7.5977 15.6834 7.4707 15.3486C6.99415 14.0923 6.69362 12.439 6.63672 10.625H3.40527ZM13.3633 10.625C13.3064 12.439 13.0059 14.0923 12.5293 15.3486C12.4022 15.6836 12.2582 15.9969 12.1006 16.2822C14.5399 15.467 16.3468 13.2737 16.5947 10.625H13.3633ZM12.1006 3.7168C12.2584 4.00235 12.4021 4.31613 12.5293 4.65137C13.0059 5.90775 13.3064 7.56102 13.3633 9.375H16.5947C16.3468 6.72615 14.54 4.53199 12.1006 3.7168ZM10 3.375C9.86039 3.375 9.65437 3.44756 9.39453 3.7373C9.1351 4.02672 8.87263 4.48057 8.63965 5.09473C8.22547 6.18664 7.94334 7.68388 7.88672 9.375H12.1133C12.0567 7.68388 11.7745 6.18664 11.3604 5.09473C11.1274 4.48057 10.8649 4.02672 10.6055 3.7373C10.3456 3.44756 10.1396 3.375 10 3.375ZM7.89844 3.7168C5.45942 4.53222 3.65314 6.72647 3.40527 9.375H6.63672C6.69362 7.56102 6.99415 5.90775 7.4707 4.65137C7.59781 4.31629 7.74073 4.00224 7.89844 3.7168Z" />
    </svg>
  );
}
