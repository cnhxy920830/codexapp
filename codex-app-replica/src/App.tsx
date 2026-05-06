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
import { NewChatIcon, SearchIcon, SettingsCogIcon } from "./components/AppShellIcons";
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
import { SkillsSettings } from "./components/SkillsSettings";
import { WorktreesSettings } from "./components/WorktreesSettings";
import { SettingsChoiceMenu } from "./components/SettingsChoiceMenu";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { ChatConversationMainPane } from "./features/chat/ChatConversationMainPane";
import { ChatSidePanel, type ChatSidePanelTab } from "./features/chat/ChatSidePanel";
import { WorkspaceFileSearchDialog } from "./features/chat/WorkspaceFileSearchDialog";
import { renderConversationMarkdown } from "./features/chat/conversationMarkdown";
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
  buildThreadDiffSummary,
  upsertConversationItem,
  upsertPendingApproval,
  type PendingApproval,
} from "./features/chat/threadConversationState";
import { useI18n } from "./i18n/i18n";
import type { MessageKey } from "./i18n/messages";
import type { WorkspaceFileDocument } from "./services/workspaceFiles";

const appWindow = getCurrentWindow();
const AGENT_SETTINGS_DOCS_URL = "https://developers.openai.com/codex/app/local-environments";
const CONFIG_TOML_DOCS_URL = "https://developers.openai.com/codex/config-basic";

type SettingsSection =
  | "general-settings"
  | "appearance"
  | "git-settings"
  | "agent"
  | "personalization"
  | "browser-use"
  | "computer-use"
  | "plugins-settings"
  | "skills-settings"
  | "keyboard-shortcuts"
  | "mcp-settings"
  | "local-environments"
  | "worktrees"
  | "data-controls";
type AgentConfigControlErrors = Partial<Record<"approval" | "sandbox" | "network", string>>;

const settingsGroups = [
  {
    headingKey: "settings.sectionApp" as const,
    items: [
      { id: "general-settings" as const, labelKey: "settings.nav.general-settings" as const, disabled: false },
      { id: "appearance" as const, labelKey: "settings.nav.appearance" as const, disabled: false },
      { id: "git-settings" as const, labelKey: "settings.nav.git-settings" as const, disabled: false },
    ],
  },
  {
    headingKey: "settings.sectionHost" as const,
    items: [
      { id: "agent" as const, labelKey: "settings.nav.agent" as const, disabled: false },
      { id: "personalization" as const, labelKey: "settings.nav.personalization" as const, disabled: false },
      { id: "browser-use" as const, labelKey: "settings.nav.browser-use" as const, disabled: false },
      { id: "computer-use" as const, labelKey: "settings.nav.computer-use" as const, disabled: false },
      { id: "mcp-settings" as const, labelKey: "settings.nav.mcp-settings" as const, disabled: false },
      { id: "plugins-settings" as const, labelKey: "settings.nav.plugins-settings" as const, disabled: false },
      { id: "skills-settings" as const, labelKey: "skills.page.heading" as const, disabled: false },
      { id: "keyboard-shortcuts" as const, labelKey: "settings.nav.keyboard-shortcuts" as const, disabled: false },
      { id: "local-environments" as const, labelKey: "settings.nav.local-environments" as const, disabled: false },
      { id: "worktrees" as const, labelKey: "settings.nav.worktrees" as const, disabled: false },
      { id: "data-controls" as const, labelKey: "settings.nav.data-controls" as const, disabled: false },
    ],
  },
];

type NavItem = {
  icon: ReactNode;
  label: string;
  route: "chat" | "settings";
  action?: "new-thread";
  section?: SettingsSection;
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
  "general-settings": "settings.nav.general-settings",
  appearance: "settings.nav.appearance",
  "git-settings": "settings.section.git-settings",
  agent: "settings.nav.agent",
  personalization: "settings.nav.personalization",
  "browser-use": "settings.section.browser-use",
  "computer-use": "settings.nav.computer-use",
  "plugins-settings": "settings.section.plugins-settings",
  "skills-settings": "skills.page.heading",
  "keyboard-shortcuts": "settings.nav.keyboard-shortcuts",
  "mcp-settings": "settings.section.mcp-settings",
  "local-environments": "settings.nav.local-environments",
  worktrees: "settings.nav.worktrees",
  "data-controls": "settings.nav.data-controls",
};

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
  const [approvalActionErrors, setApprovalActionErrors] = useState<Record<string, string>>({});
  const [respondingApprovalKeys, setRespondingApprovalKeys] = useState<string[]>([]);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [activeSidePanelTab, setActiveSidePanelTab] = useState<ChatSidePanelTab>("review");
  const [selectedSidePanelFile, setSelectedSidePanelFile] = useState<WorkspaceFileDocument | null>(null);
  const [isWorkspaceFileSearchOpen, setIsWorkspaceFileSearchOpen] = useState(false);
  const [isSidePanelTabMenuOpen, setIsSidePanelTabMenuOpen] = useState(false);
  const [isThreadActionsMenuOpen, setIsThreadActionsMenuOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [threadActionFeedback, setThreadActionFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [appToast, setAppToast] = useState<AppToast | null>(null);
  const [currentRoute, setCurrentRoute] = useState<"chat" | "settings">("chat");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general-settings");
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configScopeOptions, setConfigScopeOptions] = useState<ConfigScopeOption[]>([]);
  const [selectedConfigScopeKey, setSelectedConfigScopeKey] = useState<string>("user");
  const [agentConfigControlErrors, setAgentConfigControlErrors] = useState<AgentConfigControlErrors>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const queuedFollowUpsRef = useRef<QueuedLocalFollowUp[]>([]);
  const drainingQueuedThreadIdsRef = useRef(new Set<string>());
  const sidePanelTabMenuRef = useRef<HTMLDivElement | null>(null);
  const threadActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const openProjectPath = launchContext?.openProjectPath ?? null;
  const chatWorkspaceRoot = threadConversation?.cwd ?? openProjectPath ?? null;
  const settingsWorkspaceRoot = chatWorkspaceRoot;
  const menuItems = [t("app.menu.file"), t("app.menu.edit"), t("app.menu.view"), t("app.menu.window"), t("app.menu.help")];
  const navItems: NavItem[] = [
    { action: "new-thread", icon: <NewChatIcon className="h-4 w-4" />, label: t("app.nav.newChat"), route: "chat" },
    { icon: <SearchIcon className="h-4 w-4" />, label: t("app.nav.search"), route: "chat" },
    { icon: <SettingsCogIcon className="h-4 w-4" />, label: t("app.nav.settings"), route: "settings" },
  ];
  const threadDiffSummary = buildThreadDiffSummary(threadConversation?.items ?? []);
  const totalAdditions = threadDiffSummary.linesAdded;
  const totalDeletions = threadDiffSummary.linesDeleted;
  const shellHeaderTitle =
    currentRoute === "settings"
      ? `${t("app.shell.settings")} / ${t(settingsSectionLabelKeys[settingsSection])}`
      : threadConversation?.title || t("app.nav.newChat");
  const isTurnInProgress = activeTurn !== null && activeTurn.threadId === selectedThreadId;
  const submitButtonMode = isTurnInProgress && composerDraft.trim().length === 0 ? "stop" : "send";
  const currentThreadApprovals = pendingApprovals.filter((approval) => approval.threadId === selectedThreadId);
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
    if (!isSidePanelTabMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (sidePanelTabMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsSidePanelTabMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isSidePanelTabMenuOpen]);

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
    setSelectedSidePanelFile(null);
    setIsWorkspaceFileSearchOpen(false);
    setActiveSidePanelTab((current) => (current === "file" ? "review" : current));
  }, [selectedThreadId]);

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
      if (event.type === "serverRequestResolved") {
        const requestKey = approvalRequestKey(event.requestId);
        setPendingApprovals((current) =>
          current.filter((approval) => approvalRequestKey(approval.requestId) !== requestKey),
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
      if (event.type === "turnCompleted" && event.error) {
        setTurnError(event.error);
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
    gridTemplateColumns: isSidePanelOpen ? "minmax(0, 1fr) var(--app-shell-right-width)" : "minmax(0, 1fr)",
  } as const;

  const openSidePanelTab = (tab: ChatSidePanelTab) => {
    setActiveSidePanelTab(tab);
    setIsSidePanelOpen(true);
    setIsSidePanelTabMenuOpen(false);
  };

  const openWorkspaceFileSearch = () => {
    if (!chatWorkspaceRoot) {
      return;
    }
    setIsThreadActionsMenuOpen(false);
    setIsSidePanelTabMenuOpen(false);
    setIsWorkspaceFileSearchOpen(true);
  };

  const handleWorkspaceFileSelected = (file: WorkspaceFileDocument) => {
    setSelectedSidePanelFile(file);
    setActiveSidePanelTab("file");
    setIsSidePanelOpen(true);
    setIsWorkspaceFileSearchOpen(false);
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
      const markdown = renderConversationMarkdown(threadConversation, t);
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
      setActiveTurn({ threadId, turnId });
      setComposerDraft("");
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : String(error));
    }
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
      return <ComputerUseSettings workspaceRoot={settingsWorkspaceRoot} />;
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
            {currentRoute === "chat" ? (
              <>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const isActive = item.action === "new-thread";
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (item.action === "new-thread") {
                            void startNewThread();
                            return;
                          }
                          if (item.section) {
                            setSettingsSection(item.section);
                            setCurrentRoute("settings");
                          } else if (item.route === "settings") {
                            setCurrentRoute("settings");
                          } else {
                            setCurrentRoute("chat");
                          }
                        }}
                        className={[
                          "flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]",
                          isActive ? "app-nav-item-active" : "app-nav-item-idle",
                        ].join(" ")}
                      >
                        <span className="app-text-muted flex h-4 w-4 items-center justify-center">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between px-1 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  <span>{t("app.chat.projects")}</span>
                  <button
                    type="button"
                    onClick={() => void startNewThread()}
                    className="app-text-muted text-[13px] tracking-normal"
                  >
                    +
                  </button>
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {projectGroups.length > 0 ? (
                    projectGroups.map((group) => (
                      <section key={group.name} className="space-y-1.5">
                        <div className="app-title flex items-center justify-between px-1 text-[14px]">
                          <span className="truncate">{group.name}</span>
                          <span className="text-[12px] text-[var(--app-shell-subtle)]">⋯</span>
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
                  <span className="app-text-muted w-4 text-center text-[13px]">←</span>
                  <span>{t("settings.backToApp")}</span>
                </button>

                <div className="mt-5 px-1 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  {t("settings.title")}
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  {settingsGroups.map((group) => (
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
                              "flex h-10 w-full items-center rounded-[12px] px-3.5 text-left text-[14px]",
                              settingsSection === item.id
                                ? "app-nav-item-active"
                                : item.disabled
                                  ? "app-nav-item-disabled"
                                  : "app-nav-item-idle",
                            ].join(" ")}
                          >
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
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={t("app.shell.forward")}
                    className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] text-[13px]"
                  >
                    →
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
                      <div ref={sidePanelTabMenuRef}>
                        <button
                          type="button"
                          title={t("thread.sidePanel.openTab")}
                          aria-label={t("thread.sidePanel.openTab")}
                          aria-expanded={isSidePanelTabMenuOpen}
                          onClick={() => {
                            setIsThreadActionsMenuOpen(false);
                            setIsSidePanelTabMenuOpen((value) => !value);
                          }}
                          className="app-control-weak flex h-8 w-8 items-center justify-center rounded-[10px] text-[12px]"
                        >
                          ⋯
                        </button>
                        {isSidePanelTabMenuOpen ? (
                          <div className="app-card absolute top-10 right-[52px] z-10 min-w-[168px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                            <button
                              type="button"
                              disabled={!chatWorkspaceRoot}
                              onClick={openWorkspaceFileSearch}
                              className="app-nav-item-idle flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] disabled:opacity-60"
                            >
                              {t("thread.sidePanel.openFile")}
                            </button>
                            <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                            <button
                              type="button"
                              onClick={() => openSidePanelTab("review")}
                              className={[
                                "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]",
                                activeSidePanelTab === "review" && isSidePanelOpen
                                  ? "app-nav-item-active"
                                  : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              {t("thread.sidePanel.openReviewTab")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openSidePanelTab("browser")}
                              className={[
                                "mt-1 flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]",
                                activeSidePanelTab === "browser" && isSidePanelOpen
                                  ? "app-nav-item-active"
                                  : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              {t("thread.sidePanel.openBrowserTab")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        title={t("thread.sidePanel.toggle")}
                        aria-label={t("thread.sidePanel.toggle")}
                        aria-pressed={isSidePanelOpen}
                        onClick={() => setIsSidePanelOpen((value) => !value)}
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-[10px] text-[12px]",
                          isSidePanelOpen ? "app-control" : "app-control-weak",
                        ].join(" ")}
                      >
                        {isSidePanelOpen ? "◂" : "▸"}
                      </button>
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
                          setIsSidePanelTabMenuOpen(false);
                          setIsThreadActionsMenuOpen((value) => !value);
                        }}
                        className="app-control-weak rounded-full px-3 py-1.5 text-[13px]"
                      >
                        ⋯
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
                            {t("threadHeader.forkIntoLocal")}
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
                    currentThreadQueuedFollowUps={currentThreadQueuedFollowUps}
                    onApprovalDecision={(approval, decision) => void handleApprovalDecision(approval, decision)}
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

                  {isSidePanelOpen ? (
                    <ChatSidePanel
                      activeTab={activeSidePanelTab}
                      onTabChange={setActiveSidePanelTab}
                      selectedFile={selectedSidePanelFile}
                      t={t}
                      threadDiffSummary={threadDiffSummary}
                    />
                  ) : null}
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
