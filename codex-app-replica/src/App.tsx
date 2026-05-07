import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-shell";
import {
  cancelLogin,
  formatAuthDetail,
  formatAuthLabel,
  getLaunchContext,
  getAuthSnapshot,
  initialAuthSnapshot,
  loginApiKey,
  loginChatGpt,
  loginChatGptDeviceCode,
  logout,
  onAuthSnapshotChange,
  type AuthSnapshot,
  type LaunchContext,
} from "./services/auth";
import {
  archiveThread,
  respondToApprovalRequest,
  respondToMcpServerElicitationRequest,
  respondToPermissionsRequestApproval,
  respondToToolRequestUserInput,
  forkThread,
  setThreadName,
  type ApprovalDecision,
  buildProjectGroups,
  getRecentThreads,
  interruptTurn,
  onThreadEvent,
  readThread,
  startReview,
  startThread,
  steerTurn,
  startTurn,
  type HistoryProjectGroup,
  type FileChangeSummary,
  type ToolRequestUserInputQuestion,
  type ThreadConversation,
} from "./services/history";
import {
  applyAppearanceSettingsSnapshot,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  type ComposerEnterBehavior,
  type FollowUpQueueMode,
  type ReviewDelivery,
  readAppearanceSettingsSnapshot,
  readConfig,
  writeConfigValue,
  type ConfigScopeOption,
  type ConfigSnapshot,
} from "./services/settings";
import { AppearanceSettings } from "./components/AppearanceSettings";
import {
  BackNavigationIcon,
  BrowserTabIcon,
  ForwardNavigationIcon,
  MoreActionsIcon,
  PlusIcon,
  NewChatIcon,
  ReviewTabIcon,
  SearchIcon,
  SettingsCogIcon,
} from "./components/AppShellIcons";
import { AppToastRegion, type AppToast } from "./components/AppToastRegion";
import { ConfigScopeMenu } from "./components/ConfigScopeMenu";
import { DataControlsSettings } from "./components/DataControlsSettings";
import { GitSettings } from "./components/GitSettings";
import { GeneralSettings } from "./components/GeneralSettings";
import { KeyboardShortcutsSettings } from "./components/KeyboardShortcutsSettings";
import { BrowserUseSettings } from "./components/BrowserUseSettings";
import { LocalEnvironmentsSettings } from "./components/LocalEnvironmentsSettings";
import { McpSettings } from "./components/McpSettings";
import { ComputerUseSettings } from "./components/ComputerUseSettings";
import { PersonalizationSettings } from "./components/PersonalizationSettings";
import { PluginsSettings } from "./components/PluginsSettings";
import { BackToAppIcon, SettingsSectionIcon } from "./components/SettingsSectionIcons";
import { SkillsSettings } from "./components/SkillsSettings";
import { UsageSettings } from "./components/UsageSettings";
import { WorktreesSettings } from "./components/WorktreesSettings";
import { SettingsChoiceMenu } from "./components/SettingsChoiceMenu";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { ChatConversationMainPane } from "./features/chat/ChatConversationMainPane";
import { ChatSidePanel } from "./features/chat/ChatSidePanel";
import { RightPanelOpenTabMenu, RightPanelTabStrip } from "./features/chat/RightPanelTabStrip";
import { WorkspaceFileSearchDialog } from "./features/chat/WorkspaceFileSearchDialog";
import { renderConversationMarkdown } from "./features/chat/conversationMarkdown";
import { SkillsRoutePage } from "./features/skills/SkillsRoutePage";
import { usePluginsRouteEnabled } from "./features/skills/usePluginsRouteEnabled";
import {
  createStaticRightPanelTab,
  createWorkspaceFileRightPanelTab,
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
  buildPlanImplementationItemForTurn,
  buildPendingImplementPlanRequestForTurn,
  createMcpServerElicitationRequestResponse,
  createPermissionsRequestApprovalResponse,
  buildThreadDiffSummary,
  clearPendingImplementPlanRequestsForThread,
  createToolRequestUserInputResponse,
  markPlanImplementationItemCompleted,
  markPlanImplementationItemsCompletedForThread,
  removePendingImplementPlanRequest,
  upsertPlanImplementationItem,
  upsertConversationItem,
  upsertPendingImplementPlanRequest,
  upsertPendingApproval,
  upsertPendingMcpServerElicitationRequest,
  upsertPendingPermissionsRequestApproval,
  upsertPendingToolRequestUserInput,
  type PlanImplementationItem,
  type PendingImplementPlanRequest,
  type PendingApproval,
  type PendingMcpServerElicitationRequest,
  type PendingPermissionsRequestApproval,
  type PendingToolRequestUserInput,
} from "./features/chat/threadConversationState";
import { useI18n } from "./i18n/i18n";
import type { MessageKey } from "./i18n/messages";
import { readComputerUseApprovalsVisibility } from "./services/computerUseSettings";
import { getCodexHomePath, isWithinCodexWorktrees } from "./services/codexHome";
import { readWorkspaceFile, type WorkspaceFileDocument } from "./services/workspaceFiles";

const appWindow = getCurrentWindow();
const AGENT_SETTINGS_DOCS_URL = "https://developers.openai.com/codex/app/local-environments";
const CONFIG_TOML_DOCS_URL = "https://developers.openai.com/codex/config-basic";
const IMPLEMENT_PLAN_PROMPT_PREFIX = "PLEASE IMPLEMENT THIS PLAN:";
type WorkspaceFileRightPanelTabState = Extract<RightPanelTab, { kind: "workspaceFile" }>;

type SettingsSection =
  | "general-settings"
  | "appearance"
  | "git-settings"
  | "agent"
  | "personalization"
  | "browser-use"
  | "computer-use"
  | "usage"
  | "plugins-settings"
  | "skills-settings"
  | "keyboard-shortcuts"
  | "mcp-settings"
  | "local-environments"
  | "worktrees"
  | "data-controls";
type AgentConfigControlErrors = Partial<Record<"approval" | "sandbox" | "network", string>>;
type AppRoute = "chat" | "settings" | "skills";

const settingsGroups = [
  {
    headingKey: "settings.nav.heading.app" as const,
    items: [
      { id: "general-settings" as const, labelKey: "settings.nav.general-settings" as const, disabled: false },
      { id: "appearance" as const, labelKey: "settings.nav.appearance" as const, disabled: false },
      { id: "git-settings" as const, labelKey: "settings.nav.git-settings" as const, disabled: false },
      { id: "usage" as const, labelKey: "settings.nav.usage" as const, disabled: false },
    ],
  },
  {
    headingKey: "settings.nav.heading.host" as const,
    items: [
      { id: "agent" as const, labelKey: "settings.nav.agent" as const, disabled: false },
      { id: "personalization" as const, labelKey: "settings.nav.personalization" as const, disabled: false },
      { id: "keyboard-shortcuts" as const, labelKey: "settings.nav.keyboard-shortcuts" as const, disabled: false },
      { id: "mcp-settings" as const, labelKey: "settings.nav.mcp-settings" as const, disabled: false },
      { id: "browser-use" as const, labelKey: "settings.nav.browser-use" as const, disabled: false },
      { id: "computer-use" as const, labelKey: "settings.nav.computer-use" as const, disabled: false },
      { id: "local-environments" as const, labelKey: "settings.nav.local-environments" as const, disabled: false },
      { id: "worktrees" as const, labelKey: "settings.nav.worktrees" as const, disabled: false },
      { id: "data-controls" as const, labelKey: "settings.nav.data-controls" as const, disabled: false },
      { id: "plugins-settings" as const, labelKey: "settings.nav.plugins-settings" as const, disabled: false },
      { id: "skills-settings" as const, labelKey: "settings.nav.skills-settings" as const, disabled: false },
    ],
  },
];

type NavItem = {
  icon: ReactNode;
  label: string;
  route: AppRoute;
  action?: "new-thread";
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
  appearance: "settings.section.appearance",
  "git-settings": "settings.section.git-settings",
  agent: "settings.section.agent",
  personalization: "settings.section.personalization",
  "browser-use": "settings.section.browser-use",
  "computer-use": "computerUse.label",
  usage: "settings.section.usage",
  "plugins-settings": "settings.section.plugins-settings",
  "skills-settings": "settings.section.skills-settings",
  "keyboard-shortcuts": "settings.section.keyboard-shortcuts",
  "mcp-settings": "settings.section.mcp-settings",
  "local-environments": "settings.section.local-environments",
  worktrees: "settings.section.worktrees",
  "data-controls": "settings.section.data-controls",
};

const rightPanelTabLabelKeys: Record<StaticRightPanelTabId, MessageKey> = {
  review: "thread.sidePanel.diffTab",
  browser: "thread.sidePanel.browserTab",
};

function renderRightPanelTabIcon(tabId: StaticRightPanelTabId, className?: string) {
  if (tabId === "review") {
    return <ReviewTabIcon className={className} />;
  }
  return <BrowserTabIcon className={className} />;
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

function App() {
  const { locale, t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>(initialAuthSnapshot);
  const [launchContext, setLaunchContext] = useState<LaunchContext | null>(null);
  const [projectGroups, setProjectGroups] = useState<HistoryProjectGroup[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadConversation, setThreadConversation] = useState<ThreadConversation | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showApiKeyEntry, setShowApiKeyEntry] = useState(false);
  const [authActionError, setAuthActionError] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerEnterBehavior, setComposerEnterBehavior] = useState<ComposerEnterBehavior>("enter");
  const [followUpQueueMode, setFollowUpQueueMode] = useState<FollowUpQueueMode>("queue");
  const [reviewDelivery, setReviewDelivery] = useState<ReviewDelivery>("inline");
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
  const [planImplementationItems, setPlanImplementationItems] = useState<PlanImplementationItem[]>([]);
  const [approvalActionErrors, setApprovalActionErrors] = useState<Record<string, string>>({});
  const [respondingApprovalKeys, setRespondingApprovalKeys] = useState<string[]>([]);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [openRightPanelTabs, setOpenRightPanelTabs] = useState<RightPanelTab[]>([]);
  const [activeRightPanelTabId, setActiveRightPanelTabId] = useState<string | null>(null);
  const [isWorkspaceFileSearchOpen, setIsWorkspaceFileSearchOpen] = useState(false);
  const [isThreadActionsMenuOpen, setIsThreadActionsMenuOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [threadActionFeedback, setThreadActionFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [appToast, setAppToast] = useState<AppToast | null>(null);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>("chat");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general-settings");
  const [hasComputerUseApprovalStore, setHasComputerUseApprovalStore] = useState(false);
  const [codexHome, setCodexHome] = useState<string | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configScopeOptions, setConfigScopeOptions] = useState<ConfigScopeOption[]>([]);
  const [selectedConfigScopeKey, setSelectedConfigScopeKey] = useState<string>("user");
  const [agentConfigControlErrors, setAgentConfigControlErrors] = useState<AgentConfigControlErrors>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const isPluginsRouteEnabled = usePluginsRouteEnabled();
  const queuedFollowUpsRef = useRef<QueuedLocalFollowUp[]>([]);
  const drainingQueuedThreadIdsRef = useRef(new Set<string>());
  const threadActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const openRightPanelTabsRef = useRef<RightPanelTab[]>([]);
  const activeRightPanelTabIdRef = useRef<string | null>(null);
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
    ["plus", "pro", "prolite"].includes((authSnapshot.authState.planAtLogin ?? "").toLowerCase());
  const visibleSettingsGroups = settingsGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (item.id !== "computer-use" || hasComputerUseApprovalStore) &&
          (item.id !== "usage" || showUsageSettings),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const firstVisibleSettingsSection =
    visibleSettingsGroups[0]?.items[0]?.id ?? "general-settings";
  const isCurrentSettingsSectionVisible = visibleSettingsGroups.some((group) =>
    group.items.some((item) => item.id === settingsSection),
  );
  const menuItems = [t("app.menu.file"), t("app.menu.edit"), t("app.menu.view"), t("app.menu.window"), t("app.menu.help")];
  const navItems: NavItem[] = [
    { action: "new-thread", icon: <NewChatIcon className="h-4 w-4" />, label: t("app.nav.newChat"), route: "chat" },
    { icon: <SearchIcon className="h-4 w-4" />, label: t("app.nav.search"), route: "chat" },
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
    { icon: <SettingsCogIcon className="h-4 w-4" />, label: t("app.nav.settings"), route: "settings" },
  ];
  const threadDiffSummary = buildThreadDiffSummary(threadConversation?.items ?? []);
  const totalAdditions = threadDiffSummary.linesAdded;
  const totalDeletions = threadDiffSummary.linesDeleted;
  const shellHeaderTitle =
    currentRoute === "settings"
      ? `${t("app.shell.settings")} / ${t(settingsSectionLabelKeys[settingsSection])}`
      : currentRoute === "skills"
        ? t(primarySkillsRouteLabelKey)
      : threadConversation?.title || t("app.nav.newChat");
  const isTurnInProgress = activeTurn !== null && activeTurn.threadId === selectedThreadId;
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
  const currentThreadPlanImplementationItems = planImplementationItems.filter(
    (item) => item.threadId === selectedThreadId,
  );
  const currentThreadQueuedFollowUps = queuedLocalFollowUpsForThread(queuedFollowUps, selectedThreadId);

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
      .catch(() => setAuthSnapshot(initialAuthSnapshot));
    void getLaunchContext()
      .then(setLaunchContext)
      .catch(() => setLaunchContext({ openProjectPath: null }));
    void onAuthSnapshotChange(setAuthSnapshot).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void readAppearanceSettingsSnapshot()
      .then((settings) => {
        applyAppearanceSettingsSnapshot(settings);
        setComposerEnterBehavior(settings.composerEnterBehavior);
        setFollowUpQueueMode(settings.followUpQueueMode);
        setReviewDelivery(settings.reviewDelivery);
      })
      .catch(() => undefined);
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
    setIsWorkspaceFileSearchOpen(false);
    previousSelectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

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
    if (currentRoute !== "settings" || isCurrentSettingsSectionVisible) {
      return;
    }

    setSettingsSection(firstVisibleSettingsSection);
  }, [currentRoute, firstVisibleSettingsSection, isCurrentSettingsSectionVisible]);

  useEffect(() => {
    queuedFollowUpsRef.current = queuedFollowUps;
  }, [queuedFollowUps]);

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
      if (selectedThreadId === threadId) {
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
        if (selectedThreadId === threadId) {
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
        void drainQueuedFollowUp(event.threadId);
        if (event.status === "completed" && event.error === null) {
          void readThread(event.threadId)
            .then((thread) => {
              const request = buildPendingImplementPlanRequestForTurn(thread.id, thread.items, event.turnId);
              const item = buildPlanImplementationItemForTurn(thread.id, thread.items, event.turnId);
              setPendingImplementPlanRequests((current) => {
                const withoutThread = clearPendingImplementPlanRequestsForThread(current, thread.id);
                return request ? upsertPendingImplementPlanRequest(withoutThread, request) : withoutThread;
              });
              if (item) {
                setPlanImplementationItems((current) => upsertPlanImplementationItem(current, item));
              }
            })
            .catch(() => undefined);
        }
      }
      if (event.threadId !== selectedThreadId) {
        return;
      }
      if (event.type === "threadItemUpdated") {
        setThreadConversation((current) =>
          current && current.id === event.threadId
            ? { ...current, items: upsertConversationItem(current.items, event.item) }
            : current,
        );
        return;
      }
      void Promise.all([getRecentThreads(), readThread(event.threadId)])
        .then(([threads, thread]) => {
          setSelectedThreadId(event.threadId);
          setProjectGroups(
            buildProjectGroups(threads, {
              activeThreadId: event.threadId,
              locale,
              noMessageLabel: t("history.noMessageYet"),
            }),
          );
          setThreadConversation(thread);
        })
        .catch(() => undefined);
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [locale, selectedThreadId, t]);

  useEffect(() => {
    let cancelled = false;

    void getRecentThreads()
      .then((threads) => {
        if (cancelled) {
          return;
        }
        const activeThreadId = threads[0]?.id ?? null;
        syncProjectGroups(activeThreadId, threads);
        if (activeThreadId) {
          void readThread(activeThreadId)
            .then((thread) => {
              if (!cancelled) {
                setThreadConversation(thread);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setThreadConversation(null);
              }
            });
          return;
        }
        setThreadConversation(null);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectGroups([]);
          setSelectedThreadId(null);
          setThreadConversation(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  useEffect(() => {
    if (authSnapshot.activeLoginId || authSnapshot.authState.authMethod) {
      setShowApiKeyEntry(false);
    }
  }, [authSnapshot.activeLoginId, authSnapshot.authState.authMethod]);

  useEffect(() => {
    if (authSnapshot.lastLoginError) {
      setAuthActionError(null);
    }
  }, [authSnapshot.lastLoginError]);

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
  const activeRightPanelTab = openRightPanelTabs.find((tab) => tab.id === activeRightPanelTabId) ?? null;
  const collapsedRightPanelTabs = !isRightPanelOpen ? openRightPanelTabs.filter(isStaticRightPanelTab).slice(0, 3) : [];
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
  };

  const toggleRightPanel = () => {
    setIsRightPanelOpen((current) => !current);
  };

  const openWorkspaceFileSearch = () => {
    if (!chatWorkspaceRoot) {
      return;
    }
    setIsThreadActionsMenuOpen(false);
    setIsWorkspaceFileSearchOpen(true);
  };

  const handleWorkspaceFileSelected = (file: WorkspaceFileDocument) => {
    const workspaceFileTab = createWorkspaceFileRightPanelTab(file);
    setOpenRightPanelTabs((current) => [
      ...current.filter((tab) => !isWorkspaceFileRightPanelTab(tab)),
      workspaceFileTab,
    ]);
    setActiveRightPanelTabId(workspaceFileTab.id);
    setIsRightPanelOpen(true);
    setIsWorkspaceFileSearchOpen(false);
  };

  const handleReviewFileSelected = async (change: FileChangeSummary) => {
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

    try {
      const file = await readWorkspaceFile({
        workspaceRoot: chatWorkspaceRoot,
        relativePath,
      });
      handleWorkspaceFileSelected(file);
      setThreadActionFeedback(null);
    } catch (error) {
      setThreadActionFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const syncProjectGroups = (activeThreadId: string | null, threads: Awaited<ReturnType<typeof getRecentThreads>>) => {
    setSelectedThreadId(activeThreadId);
    setProjectGroups(
      buildProjectGroups(threads, {
        activeThreadId,
        locale,
        noMessageLabel: t("history.noMessageYet"),
      }),
    );
  };

  const openArchivedChatsSettings = () => {
    setAppToast(null);
    setSettingsSection("data-controls");
    setCurrentRoute("settings");
  };

  const refreshRecentThreadsAfterUnarchive = async () => {
    try {
      const threads = await getRecentThreads();
      syncProjectGroups(selectedThreadId ?? threads[0]?.id ?? null, threads);
    } catch {
      // Keep the current sidebar state when refresh fails.
    }
  };

  const viewUnarchivedThread = async (threadId: string) => {
    try {
      const [threads, thread] = await Promise.all([getRecentThreads(), readThread(threadId)]);
      syncProjectGroups(threadId, threads);
      setThreadConversation(thread);
      setTurnError(null);
      setCurrentRoute("chat");
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

  const completeImplementPlanFlowForThread = (threadId: string) => {
    setPendingImplementPlanRequests((current) => clearPendingImplementPlanRequestsForThread(current, threadId));
    setPlanImplementationItems((current) => markPlanImplementationItemsCompletedForThread(current, threadId));
  };

  const createAndSelectThread = async () => {
    const cwd = threadConversation?.cwd ?? openProjectPath ?? null;
    const threadId = await startThread(cwd);
    const [threads, thread] = await Promise.all([getRecentThreads(), readThread(threadId)]);
    syncProjectGroups(threadId, threads);
    setThreadConversation(thread);
    setCurrentRoute("chat");
    return thread;
  };

  const startChatGptLogin = async () => {
    setAuthActionError(null);
    try {
      const result = await loginChatGpt();
      await open(result.authUrl);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const startDeviceCodeLogin = async () => {
    setAuthActionError(null);
    try {
      const result = await loginChatGptDeviceCode();
      await open(result.verificationUrl);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const submitApiKey = async () => {
    if (!apiKeyDraft.trim()) {
      return;
    }
    setAuthActionError(null);
    try {
      await loginApiKey({ apiKey: apiKeyDraft.trim() });
      setApiKeyDraft("");
      setShowApiKeyEntry(false);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const activeLoginId = authSnapshot.activeLoginId;
  const lastLoginError = authSnapshot.lastLoginError;
  const browserAuthUrl = authSnapshot.browserAuthUrl;
  const deviceCode = authSnapshot.deviceCode;
  const isAuthenticated = authSnapshot.authState.authMethod !== null;
  const loginError = lastLoginError ?? authActionError;
  const isBrowserLoginPending = activeLoginId !== null && browserAuthUrl !== null;
  const isDeviceCodePending = activeLoginId !== null && deviceCode !== null;
  const shouldShowAuthPanel =
    showApiKeyEntry || isBrowserLoginPending || isDeviceCodePending || loginError !== null;

  const openRemoteTask = async (taskId: string) => {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }
    try {
      const thread = await readThread(normalizedTaskId);
      setSelectedThreadId(normalizedTaskId);
      setTurnError(null);
      setCurrentRoute("chat");
      setThreadConversation(thread);
    } catch {
      // Keep the current selection untouched when the local shell cannot open the task id directly.
    }
  };

  const selectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setTurnError(null);
    setCurrentRoute("chat");
    try {
      const thread = await readThread(threadId);
      setThreadConversation(thread);
    } catch {
      setThreadConversation(null);
    }
  };

  const startNewThread = async () => {
    try {
      setTurnError(null);
      await createAndSelectThread();
    } catch {
      // Keep the current selection untouched when thread creation fails.
    }
  };

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
        currentThreadPlanImplementationItems,
        {
          approvals: currentThreadApprovals,
          mcpRequests: currentThreadMcpServerElicitationRequest,
          permissionsRequests: currentThreadPermissionsRequestApproval,
          userInputRequests: currentThreadToolRequestUserInput,
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
      setThreadConversation(thread);
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

  const archiveSelectedThread = async () => {
    if (!selectedThreadId) {
      return;
    }
    try {
      await archiveThread(selectedThreadId);
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
      setThreadConversation(thread);
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
      setActiveTurn({ threadId, turnId });
      setComposerDraft("");
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
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

    setTurnError(null);
    try {
      const cwd = threadConversation?.id === request.threadId ? threadConversation.cwd || openProjectPath || null : openProjectPath || null;
      if (activeTurn && activeTurn.threadId === request.threadId) {
        const turnId = await steerTurn({
          threadId: request.threadId,
          turnId: activeTurn.turnId,
          text,
        });
        setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
        setPlanImplementationItems((current) => markPlanImplementationItemCompleted(current, request.requestId));
        setActiveTurn({ threadId: request.threadId, turnId });
        return;
      }
      const turnId = await startTurn({
        threadId: request.threadId,
        text,
        cwd,
      });
      setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
      setPlanImplementationItems((current) => markPlanImplementationItemCompleted(current, request.requestId));
      setActiveTurn({ threadId: request.threadId, turnId });
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
    }
  };

  const dismissImplementPlanRequest = (request: PendingImplementPlanRequest) => {
    setTurnError(null);
    setPendingImplementPlanRequests((current) => removePendingImplementPlanRequest(current, request.requestId));
    setPlanImplementationItems((current) => markPlanImplementationItemCompleted(current, request.requestId));
  };

  const stopTurn = async () => {
    if (!activeTurn) {
      return;
    }
    setTurnError(null);
    try {
      await interruptTurn({
        threadId: activeTurn.threadId,
        turnId: activeTurn.turnId,
      });
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleApprovalDecision = async (approval: PendingApproval, decision: ApprovalDecision) => {
    const requestKey = approvalRequestKey(approval.requestId);
    setTurnError(null);
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
    setTurnError(null);
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
      await respondToToolRequestUserInput({
        requestId: request.requestId,
        response: createToolRequestUserInputResponse(request.questions, values),
      });
    } catch (error) {
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
    setTurnError(null);
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
      await respondToPermissionsRequestApproval({
        requestId: request.requestId,
        response: createPermissionsRequestApprovalResponse(
          request.permissions,
          grantMode,
          strictAutoReview,
        ),
      });
    } catch (error) {
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
    setTurnError(null);
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
      await respondToMcpServerElicitationRequest({
        requestId: request.requestId,
        response: createMcpServerElicitationRequestResponse(action, content),
      });
    } catch (error) {
      setRespondingApprovalKeys((current) => current.filter((key) => key !== requestKey));
      setApprovalActionErrors((current) => ({
        ...current,
        [requestKey]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const signOut = async () => {
    setAuthActionError(null);
    try {
      await logout();
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelActiveLogin = async () => {
    if (!activeLoginId) {
      return;
    }
    setAuthActionError(null);
    try {
      await cancelLogin(activeLoginId);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const reopenBrowserLogin = async () => {
    if (!browserAuthUrl) {
      return;
    }
    setAuthActionError(null);
    try {
      await open(browserAuthUrl);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const openDeviceCodeBrowser = async () => {
    if (!deviceCode) {
      return;
    }
    setAuthActionError(null);
    try {
      await open(deviceCode.verificationUrl);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const copyDeviceCode = async () => {
    if (!deviceCode) {
      return;
    }
    setAuthActionError(null);
    try {
      await navigator.clipboard.writeText(deviceCode.userCode);
    } catch (error) {
      setAuthActionError(error instanceof Error ? error.message : String(error));
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

  const openSourceLicenses = async () => {
    try {
      await open("D:\\autoAiProject\\codexapp\\LICENSE");
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
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
          onComposerEnterBehaviorChange={setComposerEnterBehavior}
          onFollowUpQueueModeChange={setFollowUpQueueMode}
          onReviewDeliveryChange={setReviewDelivery}
        />
      );
    }

    if (settingsSection === "appearance") {
      return <AppearanceSettings onShowToast={(toast) => setAppToast(toast)} />;
    }

    if (settingsSection === "personalization") {
      return (
        <PersonalizationSettings
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "browser-use") {
      return <BrowserUseSettings workspaceRoot={settingsWorkspaceRoot} onShowToast={(toast) => setAppToast(toast)} />;
    }

    if (settingsSection === "computer-use") {
      if (!hasComputerUseApprovalStore) {
        return null;
      }

      return <ComputerUseSettings workspaceRoot={settingsWorkspaceRoot} onShowToast={(toast) => setAppToast(toast)} />;
    }

    if (settingsSection === "usage") {
      return (
        <UsageSettings
          authMethod={authSnapshot.authState.authMethod}
          planAtLogin={authSnapshot.authState.planAtLogin}
        />
      );
    }

    if (settingsSection === "plugins-settings") {
      return <PluginsSettings workspaceRoot={settingsWorkspaceRoot} />;
    }

    if (settingsSection === "skills-settings") {
      return <SkillsSettings workspaceRoot={settingsWorkspaceRoot} />;
    }

    if (settingsSection === "mcp-settings") {
      return <McpSettings workspaceRoot={settingsWorkspaceRoot} />;
    }

    if (settingsSection === "local-environments") {
      return (
        <LocalEnvironmentsSettings
          workspaceRoot={settingsWorkspaceRoot}
          onShowToast={(toast) => setAppToast(toast)}
        />
      );
    }

    if (settingsSection === "data-controls") {
      return (
        <DataControlsSettings
          onDismissToast={() => setAppToast(null)}
          onShowToast={(toast) => setAppToast(toast)}
          onThreadUnarchived={() => void refreshRecentThreadsAfterUnarchive()}
          onViewThread={(threadId) => void viewUnarchivedThread(threadId)}
        />
      );
    }

    if (settingsSection === "keyboard-shortcuts") {
      return <KeyboardShortcutsSettings />;
    }

    if (settingsSection === "git-settings") {
      return <GitSettings />;
    }

    if (settingsSection === "worktrees") {
      return <WorktreesSettings />;
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
                      value={approvalPolicy}
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
                    onClick={() => void openSourceLicenses()}
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
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void startChatGptLogin()}
                    className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
                  >
                    {t("auth.signInWithChatGpt")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthActionError(null);
                      setShowApiKeyEntry((value) => !value);
                    }}
                    className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
                  >
                    {t("auth.useApiKey")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startDeviceCodeLogin()}
                    className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
                  >
                    {t("auth.useDeviceCode")}
                  </button>
                </>
              )}
              {activeLoginId ? (
                <button
                  type="button"
                  onClick={() => void cancelActiveLogin()}
                  className="app-card-error rounded-full px-3 py-1.5 text-[12px]"
                >
                  {t("auth.cancelSignIn")}
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

        {shouldShowAuthPanel ? (
          <div className="app-badge flex flex-wrap items-center gap-3 border-b border-[var(--app-shell-border)] px-4 py-2 text-[12px]">
            {showApiKeyEntry ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder={t("auth.apiKeyPlaceholder")}
                  className="app-control app-text-input min-w-[220px] rounded-[10px] px-3 py-1.5 text-[12px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => void submitApiKey()}
                  className="app-control rounded-full px-3 py-1.5 text-[12px]"
                >
                  {t("auth.apiKeyConfirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKeyEntry(false)}
                  className="app-control-weak rounded-full px-3 py-1.5 text-[12px]"
                >
                  {t("auth.cancel")}
                </button>
              </div>
            ) : null}
            {isBrowserLoginPending ? (
              <div className="app-card-muted flex flex-wrap items-center gap-3 rounded-[12px] px-3 py-2">
                <span>{t("auth.completeBrowserSignIn")}</span>
                <button
                  type="button"
                  onClick={() => void reopenBrowserLogin()}
                  className="app-control rounded-full px-3 py-1 text-[12px]"
                >
                  {t("auth.openBrowser")}
                </button>
              </div>
            ) : null}
            {isDeviceCodePending ? (
              <div className="app-card-muted flex flex-wrap items-center gap-3 rounded-[12px] px-3 py-2">
                <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  {t("auth.deviceCode")}
                </span>
                <span className="font-mono text-[14px] tracking-[0.18em]">
                  {deviceCode.userCode}
                </span>
                <button
                  type="button"
                  onClick={() => void copyDeviceCode()}
                  className="app-control rounded-full px-3 py-1 text-[12px]"
                >
                  {t("auth.copy")}
                </button>
                <button
                  type="button"
                  onClick={() => void openDeviceCodeBrowser()}
                  className="app-control rounded-full px-3 py-1 text-[12px]"
                >
                  {t("auth.openBrowser")}
                </button>
              </div>
            ) : null}
            {loginError ? <div className="app-text-error truncate">{loginError}</div> : null}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-[var(--app-shell-sidebar-width)] flex-col border-r border-[var(--app-shell-border)] bg-[var(--app-shell-sidebar)] px-3 pt-3 pb-3">
            {currentRoute !== "settings" ? (
              <>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const isActive = item.action === "new-thread" || (!item.disabled && item.route === currentRoute);
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
                              void startNewThread();
                              return;
                            }
                            if (item.disabled) {
                              return;
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
                  <span>{t("settings.backToApp")}</span>
                </button>

                <div className="mt-5 px-1 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  {t("settings.title")}
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  {visibleSettingsGroups.map((group) => (
                    <section key={group.headingKey} className="space-y-1.5">
                      <div className="px-1 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                        {t(group.headingKey)}
                      </div>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={item.disabled}
                            onClick={() => setSettingsSection(item.id)}
                            className={[
                              "flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]",
                              settingsSection === item.id
                                ? "app-nav-item-active"
                                : item.disabled
                                  ? "app-nav-item-disabled"
                                  : "app-nav-item-idle",
                            ].join(" ")}
                          >
                            <span className="app-text-muted flex h-4 w-4 shrink-0 items-center justify-center">
                              <SettingsSectionIcon className="h-4 w-4" section={item.id} />
                            </span>
                            {t(item.labelKey)}
                          </button>
                        ))}
                      </div>
                    </section>
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
                                title={t(rightPanelTabLabelKeys[tab.id])}
                                aria-label={t(rightPanelTabLabelKeys[tab.id])}
                                onClick={() => openRightPanelTab(tab.id)}
                                className="app-control-weak !h-6 !w-6 rounded-[8px]"
                              >
                                <span className="icon-sm flex items-center justify-center [&>*]:!h-full [&>*]:!w-full">
                                  {renderRightPanelTabIcon(tab.id)}
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
                  <button
                    type="button"
                    onClick={() => setCurrentRoute("settings")}
                    className="app-control-weak rounded-full px-3 py-1.5 text-[13px]"
                  >
                    {t("app.shell.settings")}
                  </button>
                  {currentRoute === "chat" ? (
                    <div className="relative" ref={threadActionsMenuRef}>
                        <button
                          type="button"
                          title={t("threadHeader.moreActions")}
                          aria-label={t("threadHeader.moreActions")}
                          aria-expanded={isThreadActionsMenuOpen}
                          onClick={() => {
                            setIsThreadActionsMenuOpen((value) => !value);
                          }}
                          className="app-topbar-button flex items-center justify-center rounded-[8px] border border-transparent p-1"
                        >
                          <MoreActionsIcon className="h-4 w-4" />
                      </button>
                      {isThreadActionsMenuOpen ? (
                        <div className="app-card absolute top-10 right-0 z-10 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                          <button
                            type="button"
                            disabled={!selectedThreadId}
                            onClick={openRenameDialog}
                            className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("sidebarElectron.renameThread")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedThreadId}
                            onClick={() => {
                              setIsArchiveDialogOpen(true);
                              setIsThreadActionsMenuOpen(false);
                            }}
                            className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("sidebarElectron.archiveThread")}
                          </button>
                          <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                          <button
                            type="button"
                            disabled={!threadConversation?.cwd}
                            onClick={() => void copyWorkingDirectory()}
                            className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("threadHeader.copyWorkingDirectory")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedThreadId}
                            onClick={() => void copySessionId()}
                            className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("threadHeader.copySessionId")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedThreadId}
                            onClick={() => void copyAppLink()}
                            className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("threadHeader.copyAppLink")}
                          </button>
                          <button
                            type="button"
                            disabled={!threadConversation}
                            onClick={() => void copyConversationMarkdown()}
                            className="app-nav-item-idle mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t("threadHeader.copyConversationMarkdown")}
                          </button>
                          <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                          <button
                            type="button"
                            disabled={!selectedThreadId || isTurnInProgress}
                            onClick={() => void forkSelectedThread()}
                            className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                          >
                            {t(isWorktreeThread ? "threadHeader.forkIntoSameWorktree" : "threadHeader.forkIntoLocal")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {currentRoute === "chat" ? (
                <div className="grid min-h-0 flex-1" style={shellColumns}>
                  <ChatConversationMainPane
                    composerDraft={composerDraft}
                    composerEnterBehavior={composerEnterBehavior}
                    currentThreadApprovals={currentThreadApprovals}
                    currentThreadImplementPlanRequests={currentThreadImplementPlanRequests}
                    currentThreadMcpServerElicitationRequest={currentThreadMcpServerElicitationRequest}
                    currentThreadPlanImplementationItems={currentThreadPlanImplementationItems}
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
                    onOpenRemoteTask={(taskId) => void openRemoteTask(taskId)}
                    onSelectThread={(threadId) => void selectThread(threadId)}
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
                    approvalActionErrors={approvalActionErrors}
                    respondingApprovalKeys={respondingApprovalKeys}
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
                        onOpenReviewFile={(change) => void handleReviewFileSelected(change)}
                        t={t}
                        threadDiffSummary={threadDiffSummary}
                      />
                    </div>
                  ) : null}
                </div>
              ) : currentRoute === "skills" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SkillsRoutePage
                    authMethod={authSnapshot.authState.authMethod}
                    isPluginsRouteEnabled={isPluginsRouteEnabled}
                    workspaceRoot={settingsWorkspaceRoot}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">{renderSettings()}</div>
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
      </div>
      {isArchiveDialogOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">{t("threadHeader.archiveConfirmTitle")}</div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("threadHeader.archiveConfirmSubtitle")}
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
                {t("threadHeader.archiveConfirmConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <WorkspaceFileSearchDialog
        isOpen={isWorkspaceFileSearchOpen}
        workspaceRoot={chatWorkspaceRoot}
        onClose={() => setIsWorkspaceFileSearchOpen(false)}
        onSelectFile={handleWorkspaceFileSelected}
        onError={(message) => {
          setIsWorkspaceFileSearchOpen(false);
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

export default App;
