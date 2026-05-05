import { useEffect, useState } from "react";
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
  respondToApprovalRequest,
  type ApprovalDecision,
  buildProjectGroups,
  getRecentThreads,
  interruptTurn,
  onThreadEvent,
  readThread,
  startThread,
  startTurn,
  type HistoryProjectGroup,
  type ThreadConversation,
} from "./services/history";
import {
  applyGeneralSettingsSnapshot,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  readGeneralSettingsSnapshot,
  readConfig,
  writeConfigValue,
  type ConfigScopeOption,
  type ConfigSnapshot,
} from "./services/settings";
import { GeneralSettings } from "./components/GeneralSettings";
import { ChatConversationMainPane } from "./features/chat/ChatConversationMainPane";
import {
  approvalRequestKey,
  buildThreadDiffSummary,
  upsertConversationItem,
  upsertPendingApproval,
  type PendingApproval,
} from "./features/chat/threadConversationState";
import { useI18n } from "./i18n/i18n";
import type { MessageKey } from "./i18n/messages";

const appWindow = getCurrentWindow();
const threadPromptDefault = "AGENTS.md";

const openFiles = ["AGENTS.md", "tracker.md"];

type SettingsSection = "general-settings" | "agent";

const settingsGroups = [
  {
    headingKey: "settings.sectionApp" as const,
    items: [{ id: "general-settings" as const, labelKey: "settings.general" as const, disabled: false }],
  },
  {
    headingKey: "settings.sectionHost" as const,
    items: [{ id: "agent" as const, labelKey: "settings.configuration" as const, disabled: false }],
  },
];

const approvalPolicyOptions = [
  { value: "untrusted", labelKey: "settings.agent.approval.untrusted" as const },
  { value: "on-failure", labelKey: "settings.agent.approval.onFailure" as const },
  { value: "on-request", labelKey: "settings.agent.approval.onRequest" as const },
  { value: "never", labelKey: "settings.agent.approval.never" as const },
];

const sandboxModeOptions = [
  { value: "read-only", labelKey: "settings.agent.sandbox.readOnly" as const },
  { value: "workspace-write", labelKey: "settings.agent.sandbox.workspaceWrite" as const },
  { value: "danger-full-access", labelKey: "settings.agent.sandbox.fullAccess" as const },
];

const settingsSectionLabelKeys: Record<SettingsSection, MessageKey> = {
  "general-settings": "settings.general",
  agent: "settings.configuration",
};

function formatConfigScopeLabel(
  scope: ConfigScopeOption,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (scope.kind === "user") {
    return t("settings.agent.scope.userConfig");
  }
  if (scope.kind === "managed") {
    return t("settings.agent.scope.adminConfig");
  }
  return scope.label;
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
  const [threadPrompt, setThreadPrompt] = useState(threadPromptDefault);
  const [composerDraft, setComposerDraft] = useState("");
  const [activeTurn, setActiveTurn] = useState<{ threadId: string; turnId: string } | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvalActionErrors, setApprovalActionErrors] = useState<Record<string, string>>({});
  const [respondingApprovalKeys, setRespondingApprovalKeys] = useState<string[]>([]);
  const [currentRoute, setCurrentRoute] = useState<"chat" | "settings">("chat");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general-settings");
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configScopeOptions, setConfigScopeOptions] = useState<ConfigScopeOption[]>([]);
  const [selectedConfigScopeKey, setSelectedConfigScopeKey] = useState<string>("user");
  const [configVersion, setConfigVersion] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const openProjectPath = launchContext?.openProjectPath ?? null;
  const menuItems = [t("app.menu.file"), t("app.menu.edit"), t("app.menu.view"), t("app.menu.window"), t("app.menu.help")];
  const navItems = [
    { icon: "⊕", label: t("app.nav.newChat"), active: true, route: "chat" as const },
    { icon: "⌕", label: t("app.nav.search"), route: "chat" as const },
    { icon: "⬡", label: t("app.nav.skills"), route: "chat" as const },
    { icon: "◫", label: t("app.nav.plugins"), route: "chat" as const },
    { icon: "◔", label: t("app.nav.automation"), route: "chat" as const },
    { icon: "⚙", label: t("app.nav.settings"), route: "settings" as const },
  ];
  const inspectorBullets = [
    t("app.inspector.bullet.targetVersion"),
    t("app.inspector.bullet.resourceFirst"),
    t("app.inspector.bullet.currentWork"),
    t("app.inspector.bullet.compareArtifacts"),
  ];
  const threadDiffSummary = buildThreadDiffSummary(threadConversation?.items ?? []);
  const totalChangedFiles = threadDiffSummary.fileCount;
  const totalAdditions = threadDiffSummary.linesAdded;
  const totalDeletions = threadDiffSummary.linesDeleted;
  const shellHeaderTitle =
    currentRoute === "settings"
      ? `${t("app.shell.settings")} / ${t(settingsSectionLabelKeys[settingsSection])}`
      : threadConversation?.title || threadPrompt;
  const isTurnInProgress = activeTurn !== null && activeTurn.threadId === selectedThreadId;
  const currentThreadApprovals = pendingApprovals.filter((approval) => approval.threadId === selectedThreadId);

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
    void readGeneralSettingsSnapshot().then(applyGeneralSettingsSnapshot).catch(() => undefined);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
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
          setThreadPrompt(thread.title || threadPromptDefault);
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
                setThreadPrompt(thread.title || threadPromptDefault);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setThreadConversation(null);
                setThreadPrompt(threadPromptDefault);
              }
            });
          return;
        }
        setThreadConversation(null);
        setThreadPrompt(threadPromptDefault);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectGroups([]);
          setSelectedThreadId(null);
          setThreadConversation(null);
          setThreadPrompt(threadPromptDefault);
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
    const settingsCwd = threadConversation?.cwd ?? openProjectPath ?? null;
    void readConfig(settingsCwd)
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
        setConfigVersion(response.layers?.[0]?.version ?? null);
        setConfigError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setConfigSnapshot(null);
          setConfigScopeOptions([]);
          setSelectedConfigScopeKey("user");
          setConfigVersion(null);
          setConfigError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentRoute, openProjectPath, threadConversation?.cwd]);

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
    gridTemplateColumns: "minmax(0, 1fr) var(--app-shell-right-width)",
  } as const;

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

  const createAndSelectThread = async () => {
    const cwd = threadConversation?.cwd ?? openProjectPath ?? null;
    const threadId = await startThread(cwd);
    const [threads, thread] = await Promise.all([getRecentThreads(), readThread(threadId)]);
    syncProjectGroups(threadId, threads);
    setThreadConversation(thread);
    setThreadPrompt(thread.title || threadPromptDefault);
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
      setThreadPrompt(thread.title || threadPromptDefault);
    } catch {
      setThreadConversation(null);
      setThreadPrompt(threadPromptDefault);
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

  const submitTurn = async () => {
    const text = composerDraft.trim();
    if (text.length === 0 || isTurnInProgress) {
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
      const turnId = await startTurn({ threadId, text, cwd });
      setActiveTurn({ threadId, turnId });
      setComposerDraft("");
    } catch (error) {
      setActiveTurn(null);
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
    setConfigError(null);
    try {
      const selectedScope = configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null;
      const settingsCwd = threadConversation?.cwd ?? openProjectPath ?? null;
      await writeConfigValue({
        keyPath,
        value,
        mergeStrategy: "upsert",
        filePath: selectedScope?.kind === "project" ? selectedScope.filePath : null,
        expectedVersion: selectedScope?.expectedVersion ?? null,
      });
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
      setConfigVersion(response.layers?.[0]?.version ?? null);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const renderSettings = () => {
    if (settingsSection === "general-settings") {
      return <GeneralSettings />;
    }

    if (settingsSection === "agent") {
      const selectedScope = configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null;
      const scopedConfig = selectedScope?.config;
      const approvalPolicy = scopedConfig?.approvalPolicy ?? configSnapshot?.approvalPolicy ?? "on-request";
      const sandboxMode = scopedConfig?.sandboxMode ?? configSnapshot?.sandboxMode ?? "read-only";
      const networkAccess =
        scopedConfig?.sandboxWorkspaceWrite?.networkAccess ??
        configSnapshot?.sandboxWorkspaceWrite?.networkAccess ??
        false;
      const isScopeReadOnly = selectedScope?.kind === "managed" || selectedScope?.disabledReason !== null;
      return (
        <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
            <div className="text-[14px] font-medium text-[#29251f]">{t("settings.agent.title")}</div>
            <div className="mt-1 text-[13px] text-[#7f766d]">{t("settings.agent.subtitle")}</div>
          </div>
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                {t("settings.agent.customConfig")}
              </div>
              <select
                value={selectedConfigScopeKey}
                onChange={(event) => setSelectedConfigScopeKey(event.target.value)}
                className="rounded-[10px] border border-black/8 bg-white px-3 py-2 text-[13px]"
              >
                {configScopeOptions.map((scope) => (
                  <option key={scope.key} value={scope.key}>
                    {formatConfigScopeLabel(scope, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="truncate text-[12px] text-[#7f766d]">
                {selectedScope?.filePath ?? "~/.codex/config.toml"}
              </div>
              <button
                type="button"
                disabled={!selectedScope?.filePath}
                onClick={() => void openConfigToml()}
                className="rounded-[11px] border border-black/8 bg-white px-3 py-1.5 text-[12px] text-[#302b25] disabled:cursor-not-allowed disabled:text-[#a29a91]"
              >
                {t("settings.agent.openConfigToml")}
              </button>
            </div>
            {selectedScope?.disabledReason ? (
              <div className="mt-3 rounded-[12px] bg-[#f7f6f4] px-3 py-2 text-[12px] text-[#7f766d]">
                {selectedScope.disabledReason}
              </div>
            ) : null}
            <div className="mt-4 space-y-4 text-[14px]">
              <label className="flex items-center justify-between gap-4">
                <span>{t("settings.agent.approvalPolicy")}</span>
                <select
                  value={approvalPolicy}
                  onChange={(event) => void updateConfigValue("approval_policy", event.target.value)}
                  disabled={isScopeReadOnly}
                  className="rounded-[10px] border border-black/8 bg-white px-3 py-2 text-[13px]"
                >
                  {approvalPolicyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>{t("settings.agent.sandboxMode")}</span>
                <select
                  value={sandboxMode}
                  onChange={(event) => void updateConfigValue("sandbox_mode", event.target.value)}
                  disabled={isScopeReadOnly}
                  className="rounded-[10px] border border-black/8 bg-white px-3 py-2 text-[13px]"
                >
                  {sandboxModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>{t("settings.agent.allowNetworkAccess")}</span>
                <input
                  type="checkbox"
                  checked={networkAccess}
                  disabled={isScopeReadOnly || sandboxMode !== "workspace-write"}
                  onChange={(event) =>
                    void updateConfigValue("sandbox_workspace_write.network_access", event.target.checked)
                  }
                />
              </label>
            </div>
          </div>
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14px] text-[#29251f]">{t("settings.agent.openSourceLicenses")}</div>
                <div className="mt-1 text-[12px] text-[#7f766d]">{t("settings.agent.thirdPartyNotices")}</div>
              </div>
              <button
                type="button"
                onClick={() => void openSourceLicenses()}
                className="rounded-[11px] border border-black/8 bg-white px-3 py-1.5 text-[12px] text-[#302b25]"
              >
                {t("settings.agent.view")}
              </button>
            </div>
          </div>
          {configError ? (
            <div className="rounded-[18px] border border-[#d5b6b0] bg-[#fff3f1] px-5 py-4 text-[13px] text-[#9e5348]">
              {configError}
            </div>
          ) : null}
          <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 text-[12px] text-[#7f766d]">
            {configVersion ? `${t("settings.agent.version")} ${configVersion}` : t("settings.agent.loaded")}
          </div>
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
              className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-black/8 bg-white/85 text-[10px] text-black/70 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
            >
              □
            </button>
            <div className="ml-1 flex items-center gap-0.5">
              {menuItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-[7px] px-2.5 py-1 text-[14px] text-[#4e4841] transition hover:bg-black/5"
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
            <div className="rounded-full bg-white/60 px-3 py-1 text-left text-[11px] leading-4 text-[var(--app-shell-muted)]">
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
                  className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[12px] text-[#433e37]"
                >
                  {t("auth.signOut")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void startChatGptLogin()}
                    className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[12px] text-[#433e37]"
                  >
                    {t("auth.signIn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthActionError(null);
                      setShowApiKeyEntry((value) => !value);
                    }}
                    className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[12px] text-[#433e37]"
                  >
                    {t("auth.apiKey")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startDeviceCodeLogin()}
                    className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[12px] text-[#433e37]"
                  >
                    {t("auth.deviceCode")}
                  </button>
                </>
              )}
              {activeLoginId ? (
                <button
                  type="button"
                  onClick={() => void cancelActiveLogin()}
                  className="rounded-full border border-[#d5b6b0] bg-[#fff3f1] px-3 py-1.5 text-[12px] text-[#9e5348]"
                >
                  {t("auth.cancel")}
                </button>
              ) : null}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => void minimizeWindow()}
                className="flex h-[35px] w-11 items-center justify-center text-[12px] text-black/65 hover:bg-black/5"
              >
                _
              </button>
              <button
                type="button"
                onClick={() => void toggleMaximize()}
                className="flex h-[35px] w-11 items-center justify-center text-[11px] text-black/65 hover:bg-black/5"
              >
                {isMaximized ? "❐" : "□"}
              </button>
              <button
                type="button"
                onClick={() => void closeWindow()}
                className="flex h-[35px] w-11 items-center justify-center text-[14px] text-black/65 hover:bg-[#d84c3f] hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </header>

        {shouldShowAuthPanel ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--app-shell-border)] bg-white/65 px-4 py-2 text-[12px] text-[#564f47]">
            {showApiKeyEntry ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder="sk-..."
                  className="min-w-[220px] rounded-[10px] border border-black/8 bg-white px-3 py-1.5 text-[12px] text-[#2c2823] outline-none"
                />
                <button
                  type="button"
                  onClick={() => void submitApiKey()}
                  className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[12px] text-[#302b25]"
                >
                  {t("auth.saveKey")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKeyEntry(false)}
                  className="rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-[12px] text-[#6a6259]"
                >
                  {t("auth.cancel")}
                </button>
              </div>
            ) : null}
            {isBrowserLoginPending ? (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-[#f7f6f4] px-3 py-2 text-[#4e4740]">
                <span>{t("auth.completeBrowserSignIn")}</span>
                <button
                  type="button"
                  onClick={() => void reopenBrowserLogin()}
                  className="rounded-full border border-black/8 bg-white px-3 py-1 text-[12px] text-[#302b25]"
                >
                  {t("auth.openBrowser")}
                </button>
              </div>
            ) : null}
            {isDeviceCodePending ? (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-[#f7f6f4] px-3 py-2 text-[#4e4740]">
                <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                  {t("auth.deviceCode")}
                </span>
                <span className="font-mono text-[14px] tracking-[0.18em] text-[#2b2722]">
                  {deviceCode.userCode}
                </span>
                <button
                  type="button"
                  onClick={() => void copyDeviceCode()}
                  className="rounded-full border border-black/8 bg-white px-3 py-1 text-[12px] text-[#302b25]"
                >
                  {t("auth.copy")}
                </button>
                <button
                  type="button"
                  onClick={() => void openDeviceCodeBrowser()}
                  className="rounded-full border border-black/8 bg-white px-3 py-1 text-[12px] text-[#302b25]"
                >
                  {t("auth.openBrowser")}
                </button>
              </div>
            ) : null}
            {loginError ? <div className="truncate text-[#a2483d]">{loginError}</div> : null}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-[var(--app-shell-sidebar-width)] flex-col border-r border-[var(--app-shell-border)] bg-[var(--app-shell-sidebar)] px-3 pt-3 pb-3">
            {currentRoute === "chat" ? (
              <>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const isActive = item.route === "settings" ? false : item.active;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (item.icon === "⊕") {
                            void startNewThread();
                            return;
                          }
                          if (item.route === "settings") {
                            setCurrentRoute("settings");
                          } else {
                            setCurrentRoute("chat");
                          }
                        }}
                        className={[
                          "flex h-10 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px]",
                          isActive
                            ? "bg-white text-[#26221d] shadow-[0_1px_0_rgba(0,0,0,0.03)] ring-1 ring-black/4"
                            : "text-[#4c463f] hover:bg-white/55",
                        ].join(" ")}
                      >
                        <span className="w-4 text-center text-[13px] text-[#665f57]">{item.icon}</span>
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
                    className="text-[13px] tracking-normal text-[#7a7269]"
                  >
                    +
                  </button>
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {projectGroups.length > 0 ? (
                    projectGroups.map((group) => (
                      <section key={group.name} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1 text-[14px] text-[#423d37]">
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
                                  ? "bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] ring-1 ring-black/4"
                                  : "hover:bg-white/45",
                              ].join(" ")}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] leading-5 text-[#28241f]">{thread.title}</div>
                              </div>
                              <div className="pt-[1px] text-[12px] text-[var(--app-shell-subtle)]">{thread.age}</div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="rounded-[14px] bg-white/55 px-3.5 py-3 text-[13px] leading-6 text-[#6a6259]">
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
                  className="flex h-10 items-center gap-3 rounded-[12px] px-3.5 text-left text-[14px] text-[#4c463f] hover:bg-white/55"
                >
                  <span className="w-4 text-center text-[13px] text-[#665f57]">←</span>
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
                                ? "bg-white text-[#26221d] shadow-[0_1px_0_rgba(0,0,0,0.03)] ring-1 ring-black/4"
                                : item.disabled
                                  ? "cursor-not-allowed text-[#9a9388]"
                                  : "text-[#4c463f] hover:bg-white/55",
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
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[13px] text-[#59534c] hover:bg-black/4"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={t("app.shell.forward")}
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[13px] text-[#59534c] hover:bg-black/4"
                  >
                    →
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-[12px] border border-black/6 bg-white/88 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                    <span className="truncate text-[14px] text-[#221f1b]">
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
                  <button
                    type="button"
                    onClick={() => setCurrentRoute("settings")}
                    className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[13px] text-[#433e37]"
                  >
                    {t("app.shell.settings")}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-[13px] text-[#433e37]"
                  >
                    {t("app.shell.share")}
                  </button>
                </div>
              </div>

              {currentRoute === "chat" ? (
                <div className="grid min-h-0 flex-1" style={shellColumns}>
                  <ChatConversationMainPane
                    composerDraft={composerDraft}
                    currentThreadApprovals={currentThreadApprovals}
                    isTurnInProgress={isTurnInProgress}
                    onApprovalDecision={(approval, decision) => void handleApprovalDecision(approval, decision)}
                    onComposerDraftChange={setComposerDraft}
                    onStopTurn={() => void stopTurn()}
                    onSubmitTurn={() => void submitTurn()}
                    openProjectPath={openProjectPath}
                    approvalActionErrors={approvalActionErrors}
                    respondingApprovalKeys={respondingApprovalKeys}
                    t={t}
                    threadConversation={threadConversation}
                    threadPrompt={threadPrompt}
                    turnError={turnError}
                  />

                  <aside className="min-h-0 min-w-0 border-l border-[var(--app-shell-border)] bg-[var(--app-shell-right)] px-4 py-4">
                    <div className="flex items-center justify-between text-[12px] tracking-[0.12em] text-[var(--app-shell-subtle)]">
                      <span>{t("app.chat.inspector")}</span>
                      <span className="tracking-normal text-[#867f74]">codex-app-replica</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {openFiles.map((file, index) => (
                        <button
                          key={file}
                          type="button"
                          className={[
                            "rounded-full px-3 py-1.5 text-[13px]",
                            index === 0
                              ? "border border-black/8 bg-white text-[#2f2b26] shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                              : "text-[#867f74] hover:bg-white/50",
                          ].join(" ")}
                        >
                          {file}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="mb-3 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                        {t("app.chat.agentsMd")}
                      </div>

                      <div className="space-y-3">
                        {inspectorBullets.map((item) => (
                          <div key={item} className="flex gap-3 text-[13px] leading-6 text-[#3c3731]">
                            <span className="pt-[10px] text-[8px] text-[#8a8176]">●</span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="mb-3 text-[12px] font-medium tracking-[0.16em] text-[var(--app-shell-subtle)]">
                        {t("app.chat.openFiles")}
                      </div>

                      <div className="space-y-2">
                        {openFiles.map((entry) => (
                          <div
                            key={entry}
                            className="rounded-[13px] bg-[#f7f6f4] px-3.5 py-3 text-[13px] text-[#332f29]"
                          >
                            {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">{renderSettings()}</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;
