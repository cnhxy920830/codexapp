import { emit } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
  ForwardNavigationIcon,
  MoreActionsIcon,
  RefreshIcon,
  SearchIcon,
} from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import { Button } from "../../components/Button";
import { PluginsAppToolsDialog } from "../../components/PluginsAppToolsDialog";
import {
  AddMarketplaceDialog,
  LoadErrorPanel,
  MarketplaceLoadErrorsBanner,
  RemoveMarketplaceDialog,
  TrashIcon,
  type AddMarketplaceDraft,
} from "../../components/PluginsMarketplaceDialogs";
import { SettingsHostDropdown } from "../../components/SettingsHostDropdown";
import { ToolbarMenu } from "../../components/ToolbarMenu";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type { AppInfo, AppTool } from "../../services/apps";
import { readAppTools, readAppsSnapshot, setAppEnabled } from "../../services/apps";
import {
  parseMcpServers,
  setMcpServerEnabled,
  type McpServerDraft,
} from "../../services/mcp";
import {
  addMarketplace,
  readPluginsSnapshot,
  removeMarketplace,
  setPluginEnabled,
  upgradeMarketplaces,
  type MarketplaceAddParams,
  type PluginListSnapshot,
  type PluginMarketplaceEntry,
  type PluginSummary,
} from "../../services/plugins";
import {
  readConfigForHost,
  resolveUserConfigWriteTarget,
  type ConfigSnapshot,
  type ConfigWriteTarget,
} from "../../services/settings";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../../services/queryCache";
import {
  LOCAL_SETTINGS_HOST_ID,
  type RemoteConnection,
} from "../../services/settingsHosts";
import { readSkillsSnapshot, setSkillEnabled, type SkillSummary } from "../../services/skills";
import { buildCreatorPrefillPrompt, readStoredBoolean, writeStoredBoolean } from "./creatorPrefill";
import type { SkillsChatRequest } from "./types";
import { usePluginsRouteEnabled } from "./usePluginsRouteEnabled";

const NAVIGATE_TO_ROUTE_EVENT = "navigate-to-route";
const PLUGIN_QUERY_KEY = ["plugins"] as const;
const APPS_QUERY_KEY = ["apps", "list"] as const;
const CONFIG_QUERY_KEY = ["config"] as const;
const SKILLS_QUERY_KEY = ["skills"] as const;
const PLUGIN_CREATOR_PREFILL_STORAGE_KEY = "has-opened-plugin-creator-prefill-v1";
const SKILL_CREATOR_PREFILL_STORAGE_KEY = "has-opened-skill-creator-prefill-v1";

type ManageTab = "plugins" | "apps" | "mcps" | "skills" | "marketplace";

type MarketplaceGroup = PluginMarketplaceEntry & {
  plugins: PluginSummary[];
};

type ManagedMarketplace = {
  name: string;
  displayName: string;
  path: string | null;
  pluginCount: number;
  isBuiltIn: boolean;
  isWorkspace: boolean;
  isRemovable: boolean;
  isUpgradable: boolean;
};

type ManagedMcpServer = {
  enabled: boolean;
  key: string;
  name: string;
};

type ManagedSkill = {
  scopeLabel: string;
  skill: SkillSummary;
};

type PluginsSettingsPageState = {
  apps: AppInfo[];
  appsLoadError: string | null;
  config: ConfigSnapshot | null;
  configLoadError: string | null;
  pluginsSnapshot: PluginListSnapshot;
  skills: SkillSummary[];
  skillsLoadError: string | null;
  writeTarget: ConfigWriteTarget | null;
};

type AppToolsState = {
  errorMessage: string | null;
  isLoading: boolean;
  tools: AppTool[];
};

const EMPTY_ADD_MARKETPLACE_DRAFT: AddMarketplaceDraft = {
  source: "",
  refName: "",
  sparsePaths: "",
};

async function readPluginsSettingsPageState(
  workspaceRoot: string | null,
  selectedHostId: string,
  options?: {
    forceRefetchApps?: boolean;
    forceReloadSkills?: boolean;
  },
) {
  const effectiveWorkspaceRoot =
    selectedHostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null;
  const [pluginsResult, configResult, appsResult, skillsResult] = await Promise.allSettled([
    readPluginsSnapshot(effectiveWorkspaceRoot, selectedHostId),
    readConfigForHost({
      cwd: effectiveWorkspaceRoot,
      hostId: selectedHostId,
    }),
    readAppsSnapshot({
      hostId: selectedHostId,
      forceRefetch: options?.forceRefetchApps ?? false,
    }),
    readSkillsSnapshot(effectiveWorkspaceRoot, {
      forceReload: options?.forceReloadSkills ?? false,
      hostId: selectedHostId,
    }),
  ]);

  const writeTarget =
    configResult.status === "fulfilled" ? resolveUserConfigWriteTarget(configResult.value) : null;

  if (pluginsResult.status === "rejected") {
    const error =
      pluginsResult.reason instanceof Error
        ? pluginsResult.reason
        : new Error(String(pluginsResult.reason));
    throw Object.assign(error, { writeTarget });
  }

  return {
    apps: appsResult.status === "fulfilled" ? appsResult.value.data : [],
    appsLoadError: appsResult.status === "rejected" ? toErrorMessage(appsResult.reason) : null,
    config: configResult.status === "fulfilled" ? configResult.value.config : null,
    configLoadError: configResult.status === "rejected" ? toErrorMessage(configResult.reason) : null,
    pluginsSnapshot: pluginsResult.value,
    skills: skillsResult.status === "fulfilled" ? skillsResult.value : [],
    skillsLoadError: skillsResult.status === "rejected" ? toErrorMessage(skillsResult.reason) : null,
    writeTarget,
  } satisfies PluginsSettingsPageState;
}

export function PluginsPage({
  codexHome,
  connectedRemoteConnections,
  onOpenChatWithPrompt,
  onSelectHost,
  onShowToast,
  remoteConnectionHostIds,
  selectedHostId,
  workspaceRoot,
}: {
  codexHome: string | null;
  connectedRemoteConnections: RemoteConnection[];
  onOpenChatWithPrompt?: (request: SkillsChatRequest) => void;
  onSelectHost: (hostId: string) => void;
  onShowToast?: (toast: AppToast) => void;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const isPluginsRouteEnabled = usePluginsRouteEnabled(selectedHostId, {
    allowRemoteHost: true,
  });
  const effectiveWorkspaceRoot =
    selectedHostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null;
  const [currentTab, setCurrentTab] = useState<ManageTab>("plugins");
  const [pageState, setPageState] = useState<PluginsSettingsPageState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddMarketplaceOpen, setIsAddMarketplaceOpen] = useState(false);
  const [addMarketplaceDraft, setAddMarketplaceDraft] = useState<AddMarketplaceDraft>(
    EMPTY_ADD_MARKETPLACE_DRAFT,
  );
  const [addMarketplaceSourceError, setAddMarketplaceSourceError] = useState<string | null>(null);
  const [addMarketplaceError, setAddMarketplaceError] = useState<string | null>(null);
  const [isAddingMarketplace, setIsAddingMarketplace] = useState(false);
  const [pendingRemoveMarketplaceName, setPendingRemoveMarketplaceName] = useState<string | null>(null);
  const [pendingTogglePluginId, setPendingTogglePluginId] = useState<string | null>(null);
  const [pendingToggleAppId, setPendingToggleAppId] = useState<string | null>(null);
  const [pendingToggleMcpKey, setPendingToggleMcpKey] = useState<string | null>(null);
  const [pendingToggleSkillPath, setPendingToggleSkillPath] = useState<string | null>(null);
  const [pendingUpgradeMarketplaceName, setPendingUpgradeMarketplaceName] = useState<string | null>(null);
  const [isUpgradingAllMarketplaces, setIsUpgradingAllMarketplaces] = useState(false);
  const [marketplaceToRemove, setMarketplaceToRemove] = useState<ManagedMarketplace | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [hasOpenedPluginCreatorPrefill, setHasOpenedPluginCreatorPrefill] = useState(() =>
    readStoredBoolean(PLUGIN_CREATOR_PREFILL_STORAGE_KEY),
  );
  const [hasOpenedSkillCreatorPrefill, setHasOpenedSkillCreatorPrefill] = useState(() =>
    readStoredBoolean(SKILL_CREATOR_PREFILL_STORAGE_KEY),
  );
  const [appToolsState, setAppToolsState] = useState<AppToolsState>({
    errorMessage: null,
    isLoading: false,
    tools: [],
  });
  const pluginCreatorPath = useMemo(() => {
    if (!codexHome || selectedHostId !== LOCAL_SETTINGS_HOST_ID) {
      return null;
    }

    return `${codexHome}/skills/.system/plugin-creator/SKILL.md`;
  }, [codexHome, selectedHostId]);
  const skillCreatorPath = useMemo(() => {
    if (!codexHome || selectedHostId !== LOCAL_SETTINGS_HOST_ID) {
      return null;
    }

    return `${codexHome}/skills/.system/skill-creator/SKILL.md`;
  }, [codexHome, selectedHostId]);

  const showToast = (tone: AppToast["tone"], message: string) => {
    onShowToast?.({
      message,
      tone,
    });
  };

  const resetAddMarketplaceDialog = () => {
    setIsAddMarketplaceOpen(false);
    setAddMarketplaceDraft(EMPTY_ADD_MARKETPLACE_DRAFT);
    setAddMarketplaceSourceError(null);
    setAddMarketplaceError(null);
  };

  const loadPage = async (
    mode: "initial" | "retry",
    options?: {
      forceRefetchApps?: boolean;
      forceReloadSkills?: boolean;
    },
  ) => {
    if (mode === "initial") {
      setIsLoading(true);
    } else {
      setIsRetrying(true);
    }
    setLoadError(null);

    try {
      const nextState = await readPluginsSettingsPageState(workspaceRoot, selectedHostId, options);
      setPageState(nextState);
      return nextState;
    } catch (error) {
      setLoadError(toErrorMessage(error));
      setPageState(null);
      throw error;
    } finally {
      if (mode === "initial") {
        setIsLoading(false);
      } else {
        setIsRetrying(false);
      }
    }
  };

  const refreshPageAfterMutation = async (options?: {
    forceRefetchApps?: boolean;
    forceReloadSkills?: boolean;
  }) => {
    const nextState = await readPluginsSettingsPageState(workspaceRoot, selectedHostId, options);
    setPageState(nextState);
    setLoadError(null);
    return nextState;
  };

  const handleQueryCacheInvalidate = useEffectEvent((notification: QueryCacheInvalidateNotification) => {
    const shouldRefreshPage =
      queryKeyMatchesPrefix(notification.queryKey, PLUGIN_QUERY_KEY) ||
      queryKeyMatchesPrefix(notification.queryKey, APPS_QUERY_KEY) ||
      queryKeyMatchesPrefix(notification.queryKey, CONFIG_QUERY_KEY) ||
      queryKeyMatchesPrefix(notification.queryKey, SKILLS_QUERY_KEY);

    if (!shouldRefreshPage || !isPluginsRouteEnabled) {
      return;
    }

    void refreshPageAfterMutation({
      forceRefetchApps: true,
      forceReloadSkills: true,
    });
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed) {
        handleQueryCacheInvalidate(notification);
      }
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

  useEffect(() => {
    if (!isPluginsRouteEnabled) {
      setPageState(null);
      setLoadError(null);
      setIsLoading(false);
      setIsRetrying(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    let cancelled = false;

    void readPluginsSettingsPageState(workspaceRoot, selectedHostId)
      .then((nextState) => {
        if (!cancelled) {
          setPageState(nextState);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(toErrorMessage(error));
          setPageState(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPluginsRouteEnabled, selectedHostId, workspaceRoot]);

  const managedMarketplaces = useMemo(
    () => buildManagedMarketplaces(pageState?.pluginsSnapshot ?? null, effectiveWorkspaceRoot),
    [effectiveWorkspaceRoot, pageState?.pluginsSnapshot],
  );

  const filteredMarketplaces = useMemo<MarketplaceGroup[]>(() => {
    const query = normalizeText(searchQuery);
    const marketplaces = pageState?.pluginsSnapshot.marketplaces ?? [];

    return marketplaces
      .map((marketplace) => {
        const installedPlugins = marketplace.plugins
          .filter((plugin) => plugin.installed)
          .filter((plugin) => {
            if (query.length === 0) {
              return true;
            }
            return buildPluginSearchText(marketplace, plugin).includes(query);
          })
          .sort(comparePlugins);

        return {
          ...marketplace,
          plugins: installedPlugins,
        };
      })
      .filter((marketplace) => marketplace.plugins.length > 0)
      .sort(compareMarketplaces);
  }, [pageState?.pluginsSnapshot, searchQuery]);

  const filteredManagedMarketplaces = useMemo(() => {
    const query = normalizeText(searchQuery);
    return managedMarketplaces
      .filter((marketplace) => {
        if (query.length === 0) {
          return true;
        }
        return buildMarketplaceSearchText(marketplace).includes(query);
      })
      .sort(compareManagedMarketplaces);
  }, [managedMarketplaces, searchQuery]);

  const managedApps = useMemo(() => {
    const query = normalizeText(searchQuery);
    return (pageState?.apps ?? [])
      .filter((app) => {
        if (query.length === 0) {
          return true;
        }
        return buildAppSearchText(app).includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [pageState?.apps, searchQuery]);

  const managedMcpServers = useMemo(() => {
    const query = normalizeText(searchQuery);
    return buildManagedMcpServers(pageState?.config ?? null)
      .filter((server) => {
        if (query.length === 0) {
          return true;
        }
        return buildMcpSearchText(server).includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [pageState?.config, searchQuery]);

  const managedSkills = useMemo(
    () => buildManagedSkills(pageState?.skills ?? [], searchQuery, t),
    [pageState?.skills, searchQuery, t],
  );
  const selectedApp = useMemo(
    () => (selectedAppId == null ? null : pageState?.apps.find((app) => app.id === selectedAppId) ?? null),
    [pageState?.apps, selectedAppId],
  );

  const marketplaceLoadErrors = pageState?.pluginsSnapshot.marketplaceLoadErrors ?? [];
  const totalPlugins = countInstalledPlugins(pageState?.pluginsSnapshot ?? null);
  const totalApps = pageState?.apps.length ?? 0;
  const totalMcps = buildManagedMcpServers(pageState?.config ?? null).length;
  const totalSkills = buildManagedSkills(pageState?.skills ?? [], "", t).length;
  const totalMarketplaces = managedMarketplaces.length;
  const hasAnyUpgradableMarketplace = managedMarketplaces.some((marketplace) => marketplace.isUpgradable);
  const isMarketplaceActionPending =
    isAddingMarketplace ||
    isUpgradingAllMarketplaces ||
    pendingRemoveMarketplaceName != null ||
    pendingUpgradeMarketplaceName != null;
  const canCreatePlugin = pluginCreatorPath != null && onOpenChatWithPrompt != null;
  const canCreateSkill = skillCreatorPath != null && onOpenChatWithPrompt != null;
  const isRefreshDisabled = isLoading || isRetrying;

  useEffect(() => {
    setSelectedAppId(null);
    setAppToolsState({
      errorMessage: null,
      isLoading: false,
      tools: [],
    });
  }, [selectedHostId]);

  useEffect(() => {
    if (selectedAppId == null) {
      setAppToolsState({
        errorMessage: null,
        isLoading: false,
        tools: [],
      });
      return;
    }

    let cancelled = false;
    setAppToolsState({
      errorMessage: null,
      isLoading: true,
      tools: [],
    });

    void readAppTools({
      appId: selectedAppId,
      hostId: selectedHostId,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setAppToolsState({
          errorMessage: null,
          isLoading: false,
          tools: response.tools,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setAppToolsState({
          errorMessage: toErrorMessage(error),
          isLoading: false,
          tools: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAppId, selectedHostId]);

  useEffect(() => {
    if (selectedAppId != null && selectedApp == null) {
      setSelectedAppId(null);
    }
  }, [selectedApp, selectedAppId]);

  const retryLoad = () => {
    if (!isPluginsRouteEnabled) {
      return;
    }
    void loadPage("retry").catch(() => undefined);
  };

  const closeAddMarketplaceDialog = () => {
    if (isAddingMarketplace) {
      return;
    }
    resetAddMarketplaceDialog();
  };

  const handleAddMarketplace = async () => {
    const params = normalizeAddMarketplaceDraft(addMarketplaceDraft);
    if (params == null) {
      setAddMarketplaceSourceError(t("skills.appsPage.addMarketplace.sourceRequired"));
      setAddMarketplaceError(null);
      return;
    }

    setIsAddingMarketplace(true);
    setAddMarketplaceSourceError(null);
    setAddMarketplaceError(null);

    try {
      const response = await addMarketplace({
        hostId: selectedHostId,
        ...params,
      });

      try {
        await refreshPageAfterMutation({
          forceRefetchApps: true,
          forceReloadSkills: true,
        });
      } catch {
        showToast(
          "error",
          t("skills.appsPage.addMarketplace.refreshFailed", {
            marketplaceName: response.marketplaceName,
          }),
        );
        resetAddMarketplaceDialog();
        return;
      }

      showToast(
        "success",
        response.alreadyAdded
          ? t("skills.appsPage.addMarketplace.alreadyAdded", {
              marketplaceName: response.marketplaceName,
            })
          : t("skills.appsPage.addMarketplace.success", {
              marketplaceName: response.marketplaceName,
            }),
      );
      resetAddMarketplaceDialog();
    } catch {
      setAddMarketplaceError(t("skills.appsPage.addMarketplace.failed"));
    } finally {
      setIsAddingMarketplace(false);
    }
  };

  const handleRemoveMarketplace = async (marketplace: ManagedMarketplace) => {
    if (isMarketplaceActionPending) {
      return;
    }

    setPendingRemoveMarketplaceName(marketplace.name);

    try {
      await removeMarketplace({
        hostId: selectedHostId,
        marketplaceName: marketplace.name,
      });
      showToast(
        "success",
        t("plugins.marketplace.removeSuccess", {
          marketplaceName: marketplace.displayName,
        }),
      );
      setMarketplaceToRemove(null);
    } catch {
      showToast("error", t("plugins.marketplace.removeError"));
    } finally {
      setPendingRemoveMarketplaceName(null);
      void refreshPageAfterMutation({
        forceRefetchApps: true,
        forceReloadSkills: true,
      }).catch(() => undefined);
    }
  };

  const handleUpgradeMarketplace = async (marketplace: ManagedMarketplace) => {
    if (isMarketplaceActionPending) {
      return;
    }

    setPendingUpgradeMarketplaceName(marketplace.name);

    try {
      const response = await upgradeMarketplaces({
        hostId: selectedHostId,
        marketplaceName: marketplace.name,
      });

      if (response.errors.length > 0) {
        showToast("error", t("plugins.marketplace.upgradeError"));
      } else {
        showToast(
          "success",
          t("plugins.marketplace.upgradeSuccess", {
            marketplaceName: marketplace.displayName,
          }),
        );
      }
    } catch {
      showToast("error", t("plugins.marketplace.upgradeError"));
    } finally {
      setPendingUpgradeMarketplaceName(null);
      void refreshPageAfterMutation({
        forceRefetchApps: true,
        forceReloadSkills: true,
      }).catch(() => undefined);
    }
  };

  const handleUpgradeAllMarketplaces = async () => {
    if (isMarketplaceActionPending || !hasAnyUpgradableMarketplace) {
      return;
    }

    setIsUpgradingAllMarketplaces(true);

    try {
      const response = await upgradeMarketplaces({
        hostId: selectedHostId,
      });

      if (response.errors.length > 0) {
        showToast("error", t("plugins.marketplace.upgradeAllError"));
      } else {
        showToast("success", t("plugins.marketplace.upgradeAllSuccess"));
      }
    } catch {
      showToast("error", t("plugins.marketplace.upgradeAllRequestError"));
    } finally {
      setIsUpgradingAllMarketplaces(false);
      void refreshPageAfterMutation({
        forceRefetchApps: true,
        forceReloadSkills: true,
      }).catch(() => undefined);
    }
  };

  const handleTogglePluginEnabled = async (plugin: PluginSummary, enabled: boolean) => {
    if (pendingTogglePluginId != null || !plugin.installed || plugin.enabled === enabled) {
      return;
    }

    setPendingTogglePluginId(plugin.id);

    try {
      await setPluginEnabled({
        hostId: selectedHostId,
        pluginId: plugin.id,
        enabled,
        filePath: pageState?.writeTarget?.filePath ?? null,
        expectedVersion: pageState?.writeTarget?.expectedVersion ?? null,
      });
      await refreshPageAfterMutation({
        forceReloadSkills: true,
      });
      showToast(
        "success",
        t(enabled ? "plugins.card.enableSuccess" : "plugins.card.disableSuccess", {
          pluginName: getPluginDisplayName(plugin),
        }),
      );
    } catch {
      showToast("error", t("plugins.card.toggleError"));
    } finally {
      setPendingTogglePluginId(null);
    }
  };

  const handleToggleAppEnabled = async (app: AppInfo, enabled: boolean) => {
    if (pendingToggleAppId != null || app.isEnabled === enabled) {
      return;
    }

    setPendingToggleAppId(app.id);

    try {
      await setAppEnabled({
        appId: app.id,
        enabled,
        expectedVersion: pageState?.writeTarget?.expectedVersion ?? null,
        filePath: pageState?.writeTarget?.filePath ?? null,
        hostId: selectedHostId,
      });
      await refreshPageAfterMutation({
        forceRefetchApps: true,
      });
    } catch {
      showToast("error", t("skills.appsPage.apps.toggleError"));
    } finally {
      setPendingToggleAppId(null);
    }
  };

  const handleOpenAppUrl = async (url: string | null) => {
    if (!url) {
      return;
    }
    try {
      await open(url);
    } catch (error) {
      showToast("error", toErrorMessage(error));
    }
  };

  const handleTryAppInChat = (app: AppInfo) => {
    onOpenChatWithPrompt?.({
      cwd: effectiveWorkspaceRoot && effectiveWorkspaceRoot !== "/" ? effectiveWorkspaceRoot : null,
      prompt: `[@${app.name}](app://${app.id})`,
    });
  };

  const handleCreatePlugin = () => {
    if (pluginCreatorPath == null || onOpenChatWithPrompt == null) {
      return;
    }

    const prompt = buildCreatorPrefillPrompt({
      creatorPath: pluginCreatorPath,
      isFirstOpen: !hasOpenedPluginCreatorPrefill,
      kind: "plugin",
    });

    if (!hasOpenedPluginCreatorPrefill) {
      writeStoredBoolean(PLUGIN_CREATOR_PREFILL_STORAGE_KEY, true);
      setHasOpenedPluginCreatorPrefill(true);
    }

    onOpenChatWithPrompt({
      prompt,
    });
  };

  const handleCreateSkill = () => {
    if (skillCreatorPath == null || onOpenChatWithPrompt == null) {
      return;
    }

    const prompt = buildCreatorPrefillPrompt({
      creatorPath: skillCreatorPath,
      isFirstOpen: !hasOpenedSkillCreatorPrefill,
      kind: "skill",
    });

    if (!hasOpenedSkillCreatorPrefill) {
      writeStoredBoolean(SKILL_CREATOR_PREFILL_STORAGE_KEY, true);
      setHasOpenedSkillCreatorPrefill(true);
    }

    onOpenChatWithPrompt({
      prompt,
    });
  };

  const handleOpenMcpSettings = async () => {
    try {
      await emit(NAVIGATE_TO_ROUTE_EVENT, { path: "/settings/mcp-settings" });
    } catch (error) {
      showToast("error", toErrorMessage(error));
    }
  };

  const handleToggleMcpServerEnabled = async (server: ManagedMcpServer, enabled: boolean) => {
    if (pendingToggleMcpKey != null || server.enabled === enabled) {
      return;
    }

    setPendingToggleMcpKey(server.key);

    try {
      await setMcpServerEnabled({
        enabled,
        expectedVersion: pageState?.writeTarget?.expectedVersion ?? null,
        filePath: pageState?.writeTarget?.filePath ?? null,
        hostId: selectedHostId,
        serverName: server.key,
      });
      await refreshPageAfterMutation();
    } catch {
      showToast("error", t("skills.appsPage.mcps.toggleError"));
    } finally {
      setPendingToggleMcpKey(null);
    }
  };

  const handleToggleSkillEnabled = async (skill: SkillSummary, enabled: boolean) => {
    if (pendingToggleSkillPath != null || skill.enabled === enabled) {
      return;
    }

    setPendingToggleSkillPath(skill.path);

    try {
      await setSkillEnabled({
        enabled,
        hostId: selectedHostId,
        path: skill.path,
      });
      await refreshPageAfterMutation({
        forceReloadSkills: true,
      });
    } catch {
      showToast("error", t("skills.appsPage.skills.toggleError"));
    } finally {
      setPendingToggleSkillPath(null);
    }
  };

  if (!isPluginsRouteEnabled) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md text-center">
          <div className="app-title text-[18px] font-medium">
            {t("skills.appsPage.pluginsUnsupportedHost.title")}
          </div>
          <div className="app-text-muted mt-3 text-[14px] leading-6">
            {t("skills.appsPage.pluginsUnsupportedHost.description")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col text-base">
        <h1 className="sr-only">{t("skills.appsPage.managePlugins")}</h1>
        <div className="border-b border-[var(--app-shell-border)] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--app-shell-subtle)]">
              <span className="truncate">{t("skills.appsPage.breadcrumb.root")}</span>
              <ForwardNavigationIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[var(--app-shell-text)]">
                {t("skills.appsPage.breadcrumb.manage")}
              </span>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {connectedRemoteConnections.length > 0 && remoteConnectionHostIds.length > 0 ? (
                <SettingsHostDropdown
                  connectedRemoteConnections={connectedRemoteConnections}
                  onSelectHost={onSelectHost}
                  remoteConnectionHostIds={remoteConnectionHostIds}
                  selectedHostId={selectedHostId}
                  t={t}
                  triggerClassName="hidden h-8 w-auto max-w-56 px-2 text-[13px] md:inline-flex"
                  triggerColor="secondary"
                />
              ) : null}

              <ToolbarMenu
                items={[
                  {
                    key: "create-plugin",
                    disabled: !canCreatePlugin,
                    label: t("skills.appsPage.createPlugin"),
                    onSelect: handleCreatePlugin,
                  },
                  {
                    key: "create-skill",
                    disabled: !canCreateSkill,
                    label: t("skills.appsPage.createSkill"),
                    onSelect: handleCreateSkill,
                  },
                ]}
              >
                {({ open, toggle }) => (
                  <Button
                    aria-label={t("skills.appsPage.create")}
                    className="hidden md:inline-flex"
                    color="outline"
                    data-state={open ? "open" : undefined}
                    disabled={!canCreatePlugin && !canCreateSkill}
                    onClick={toggle}
                    size="toolbar"
                  >
                    <span>{t("skills.appsPage.create")}</span>
                    <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                )}
              </ToolbarMenu>

              <ToolbarMenu
                items={[
                  {
                    key: "refresh",
                    disabled: isRefreshDisabled,
                    icon: <RefreshIcon className="h-4 w-4 shrink-0" />,
                    label: t("skills.page.refreshSkills"),
                    onSelect: retryLoad,
                  },
                  {
                    key: "upgrade-all",
                    disabled: currentTab !== "marketplace" || !hasAnyUpgradableMarketplace || isMarketplaceActionPending,
                    icon: (
                      <DownloadIcon
                        className="h-4 w-4 shrink-0"
                      />
                    ),
                    label: t("skills.appsPage.marketplace.upgradeAll"),
                    onSelect: () => void handleUpgradeAllMarketplaces(),
                    title: t("skills.appsPage.marketplace.upgradeAll.tooltip"),
                  },
                ]}
              >
                {({ open, toggle }) => (
                  <Button
                    aria-label={t("skills.appsPage.actionsMenu")}
                    className="hidden md:inline-flex"
                    color="ghost"
                    data-state={open ? "open" : undefined}
                    onClick={toggle}
                    size="icon"
                    uniform
                  >
                    <MoreActionsIcon className="h-4 w-4" />
                  </Button>
                )}
              </ToolbarMenu>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 bg-gradient-to-b from-[var(--app-shell-main-surface)] to-transparent pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <label className="app-control flex min-w-0 items-center gap-2 rounded-[12px] px-3 py-2.5">
              <SearchIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
              <span className="sr-only">{t("skills.appsPage.search.plugins.label")}</span>
              <input
                id="plugins-page-manage-search"
                aria-label={t("skills.appsPage.search.plugins.label")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("skills.appsPage.search.plugins")}
                className="app-text-input min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <ManageTabButton
                count={totalPlugins}
                isActive={currentTab === "plugins"}
                label={t("skills.appsPage.manageTab.plugins")}
                onClick={() => setCurrentTab("plugins")}
              />
              <ManageTabButton
                count={totalApps}
                isActive={currentTab === "apps"}
                label={t("skills.appsPage.manageTab.apps")}
                onClick={() => setCurrentTab("apps")}
              />
              <ManageTabButton
                count={totalMcps}
                isActive={currentTab === "mcps"}
                label={t("skills.appsPage.manageTab.mcps")}
                onClick={() => setCurrentTab("mcps")}
              />
              <ManageTabButton
                count={totalSkills}
                isActive={currentTab === "skills"}
                label={t("skills.appsPage.manageTab.skills")}
                onClick={() => setCurrentTab("skills")}
              />
              <ManageTabButton
                count={totalMarketplaces}
                isActive={currentTab === "marketplace"}
                label={t("skills.appsPage.manageTab.marketplace")}
                onClick={() => setCurrentTab("marketplace")}
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 pb-1">

          {currentTab === "plugins" ? (
            <section className="app-card rounded-[18px] px-5 py-4">
              {isLoading ? (
                <CenteredState title={t("skills.appsPage.loading")} />
              ) : loadError ? (
                <LoadErrorPanel
                  error={loadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : filteredMarketplaces.length === 0 ? (
                <CompactEmptyState title={t("skills.appsPage.empty.plugins")} />
              ) : (
                <div className="space-y-3">
                  {filteredMarketplaces.map((marketplace) => (
                    <section
                      key={marketplace.name}
                      className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                            {getMarketplaceDisplayName(marketplace)}
                          </div>
                          {marketplace.path ? (
                            <div className="app-text-muted mt-1 truncate text-[11px] leading-5">
                              {marketplace.path}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
                          {marketplace.plugins.length}
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {marketplace.plugins.map((plugin) => {
                          const title = getPluginDisplayName(plugin);
                          const description = getPluginDescription(plugin);
                          const toggleTooltip = plugin.enabled
                            ? t("plugins.card.disableToggleTooltip")
                            : t("plugins.card.enableToggleTooltip");

                          return (
                            <div
                              key={plugin.id}
                              className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[14px] leading-6">{title}</div>
                                  <div className="app-text-muted mt-1 text-[12px] leading-5">
                                    {description}
                                  </div>
                                  <div className="app-text-muted mt-1 truncate text-[11px] leading-5">
                                    {plugin.id}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <div className="text-[12px] text-[var(--app-shell-subtle)]">
                                    {plugin.enabled
                                      ? t("plugins.card.enabledStatus")
                                      : t("plugins.card.disabledStatus")}
                                  </div>
                                  <div title={toggleTooltip}>
                                    <ToggleSwitch
                                      ariaLabel={t("plugins.card.toggleAria")}
                                      checked={plugin.enabled}
                                      disabled={pendingTogglePluginId != null}
                                      onChange={(checked) => void handleTogglePluginEnabled(plugin, checked)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {currentTab === "apps" ? (
            <section className="app-card rounded-[18px] px-5 py-4">
              {isLoading ? (
                <CenteredState title={t("skills.appsPage.loading")} />
              ) : loadError ? (
                <LoadErrorPanel
                  error={loadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : pageState?.appsLoadError && totalApps === 0 ? (
                <LoadErrorPanel
                  error={pageState.appsLoadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : managedApps.length === 0 ? (
                <CompactEmptyState title={t("skills.appsPage.empty.installedApps")} />
              ) : (
                <div className="space-y-3">
                  {pageState?.appsLoadError ? (
                    <InlineErrorBanner message={pageState.appsLoadError} />
                  ) : null}

                  {managedApps.map((app) => {
                    const pluginNames = app.pluginDisplayNames.join(" · ");

                    return (
                      <button
                        type="button"
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        className="w-full rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[14px] leading-6">{app.name}</div>
                            {app.description ? (
                              <div className="app-text-muted mt-1 text-[12px] leading-5">
                                {app.description}
                              </div>
                            ) : null}
                            {pluginNames.length > 0 ? (
                              <div className="app-text-muted mt-1 text-[11px] leading-5">
                                {pluginNames}
                              </div>
                            ) : null}
                          </div>

                          <ForwardNavigationIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {currentTab === "mcps" ? (
            <section className="app-card rounded-[18px] px-5 py-4">
              {isLoading ? (
                <CenteredState title={t("skills.appsPage.loading")} />
              ) : loadError ? (
                <LoadErrorPanel
                  error={loadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : pageState?.configLoadError && totalMcps === 0 ? (
                <LoadErrorPanel
                  error={pageState.configLoadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : managedMcpServers.length === 0 ? (
                <CompactEmptyState title={t("skills.appsPage.empty.mcps")} />
              ) : (
                <div className="space-y-2">
                  {pageState?.configLoadError ? (
                    <InlineErrorBanner message={pageState.configLoadError} />
                  ) : null}

                  {managedMcpServers.map((server) => {
                    const toggleTooltip = server.enabled
                      ? t("skills.appsPage.mcps.disable")
                      : t("skills.appsPage.mcps.enable");

                    return (
                      <div
                        key={server.key}
                        className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[14px] leading-6">{server.name}</div>
                            <div className="app-text-muted mt-1 truncate text-[11px] leading-5">
                              {server.key}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleOpenMcpSettings()}
                              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                            >
                              {t("skills.appsPage.mcps.settings")}
                            </button>
                            <div className="text-[12px] text-[var(--app-shell-subtle)]">
                              {server.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
                            </div>
                            <div title={toggleTooltip}>
                              <ToggleSwitch
                                ariaLabel={t("skills.appsPage.mcps.toggle")}
                                checked={server.enabled}
                                disabled={pendingToggleMcpKey != null}
                                onChange={(checked) => void handleToggleMcpServerEnabled(server, checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {currentTab === "skills" ? (
            <section className="app-card rounded-[18px] px-5 py-4">
              {isLoading ? (
                <CenteredState title={t("skills.appsPage.loading")} />
              ) : loadError ? (
                <LoadErrorPanel
                  error={loadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : pageState?.skillsLoadError && totalSkills === 0 ? (
                <LoadErrorPanel
                  error={pageState.skillsLoadError}
                  retryLabel={t("skills.appsPage.loadError.retry")}
                  title={t("skills.appsPage.loadError.title")}
                  onRetry={retryLoad}
                />
              ) : managedSkills.length === 0 ? (
                <CompactEmptyState title={t("skills.appsPage.empty.skills")} />
              ) : (
                <div className="space-y-3">
                  {pageState?.skillsLoadError ? (
                    <InlineErrorBanner message={pageState.skillsLoadError} />
                  ) : null}

                  {managedSkills.map(({ scopeLabel, skill }) => {
                    const toggleTooltip = skill.enabled
                      ? t("skills.appsPage.skills.disable")
                      : t("skills.appsPage.skills.enable");

                    return (
                      <div
                        key={`${skill.cwd}:${skill.path}`}
                        className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[14px] leading-6">{getSkillDisplayName(skill)}</div>
                              <span className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]">
                                {scopeLabel}
                              </span>
                            </div>
                            <div className="app-text-muted mt-1 text-[12px] leading-5">
                              {skill.shortDescription ?? skill.description}
                            </div>
                            <div className="app-text-muted mt-1 truncate text-[11px] leading-5">
                              {skill.path}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-[12px] text-[var(--app-shell-subtle)]">
                              {skill.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
                            </div>
                            <div title={toggleTooltip}>
                              <ToggleSwitch
                                ariaLabel={t("skills.appsPage.skills.toggle")}
                                checked={skill.enabled}
                                disabled={pendingToggleSkillPath != null}
                                onChange={(checked) => void handleToggleSkillEnabled(skill, checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {currentTab === "marketplace" ? (
            <section className="app-card rounded-[18px] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[14px] font-medium">{t("skills.appsPage.manageTab.marketplace")}</div>
                <Button
                  color="secondary"
                  disabled={isMarketplaceActionPending}
                  onClick={() => setIsAddMarketplaceOpen(true)}
                  size="toolbar"
                >
                  {t("skills.appsPage.addMarketplace.title")}
                </Button>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {marketplaceLoadErrors.length > 0 ? (
                  <MarketplaceLoadErrorsBanner
                    errors={marketplaceLoadErrors}
                    isRetrying={isRetrying}
                    onRetry={retryLoad}
                  />
                ) : null}

                {isLoading ? (
                  <CenteredState title={t("skills.appsPage.marketplace.loading")} />
                ) : loadError ? (
                  <LoadErrorPanel
                    error={loadError}
                    retryLabel={t("skills.appsPage.marketplace.loadError.retry")}
                    title={t("skills.appsPage.marketplace.loadError.title")}
                    onRetry={retryLoad}
                  />
                ) : filteredManagedMarketplaces.length === 0 ? (
                  <CompactEmptyState title={t("skills.appsPage.empty.marketplace")} />
                ) : (
                  <div className="space-y-2">
                    {filteredManagedMarketplaces.map((marketplace) => {
                      const upgradeDisabledKey = getMarketplaceUpgradeDisabledKey(marketplace);
                      const removeDisabledKey = getMarketplaceRemoveDisabledKey(marketplace);
                      const isUpgrading = pendingUpgradeMarketplaceName === marketplace.name;

                      return (
                        <div
                          key={`${marketplace.name}:${marketplace.path ?? "remote"}`}
                          className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium leading-6">
                                {marketplace.displayName}
                              </div>
                              <div className="app-text-muted mt-1 flex min-w-0 flex-col gap-0.5 text-[12px] leading-5">
                                <span>
                                  {t("skills.appsPage.marketplace.pluginCount", {
                                    count: marketplace.pluginCount,
                                  })}
                                </span>
                                {marketplace.path ? <span className="truncate">{marketplace.path}</span> : null}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                disabled={!marketplace.isUpgradable || isMarketplaceActionPending}
                                aria-label={t("skills.appsPage.marketplace.upgrade.ariaLabel")}
                                title={t(upgradeDisabledKey ?? "skills.appsPage.marketplace.upgrade")}
                                onClick={() => void handleUpgradeMarketplace(marketplace)}
                                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                              >
                                {isUpgrading
                                  ? t("skills.appsPage.marketplace.upgrade.button")
                                  : t("skills.appsPage.marketplace.upgrade.button")}
                              </button>
                              <button
                                type="button"
                                disabled={!marketplace.isRemovable || isMarketplaceActionPending}
                                aria-label={t("skills.appsPage.marketplace.remove.ariaLabel")}
                                title={t(removeDisabledKey ?? "skills.appsPage.marketplace.remove")}
                                onClick={() => setMarketplaceToRemove(marketplace)}
                                className="app-control-weak flex size-8 items-center justify-center rounded-full text-[12px] disabled:opacity-50"
                              >
                                <TrashIcon className="size-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <PluginsAppToolsDialog
        app={selectedApp}
        errorMessage={appToolsState.errorMessage}
        isLoading={appToolsState.isLoading}
        onOpenAppUrl={handleOpenAppUrl}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppId(null);
          }
        }}
        onSetAppEnabled={(enabled) => {
          if (selectedApp != null) {
            void handleToggleAppEnabled(selectedApp, enabled);
          }
        }}
        onTryInChat={selectedApp == null ? undefined : () => handleTryAppInChat(selectedApp)}
        tools={appToolsState.tools}
        updatingAppId={pendingToggleAppId}
      />

      {isAddMarketplaceOpen ? (
        <AddMarketplaceDialog
          draft={addMarketplaceDraft}
          error={addMarketplaceError}
          isSubmitting={isAddingMarketplace}
          sourceError={addMarketplaceSourceError}
          onChange={(nextDraft) => {
            setAddMarketplaceDraft(nextDraft);
            setAddMarketplaceSourceError(null);
            setAddMarketplaceError(null);
          }}
          onClose={closeAddMarketplaceDialog}
          onSubmit={() => void handleAddMarketplace()}
        />
      ) : null}

      {marketplaceToRemove != null ? (
        <RemoveMarketplaceDialog
          isRemoving={pendingRemoveMarketplaceName === marketplaceToRemove.name}
          marketplaceName={marketplaceToRemove.displayName}
          onClose={() => {
            if (pendingRemoveMarketplaceName == null) {
              setMarketplaceToRemove(null);
            }
          }}
          onConfirm={() => void handleRemoveMarketplace(marketplaceToRemove)}
        />
      ) : null}
    </>
  );
}

function ManageTabButton({
  count,
  isActive,
  label,
  onClick,
}: {
  count: number;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      color={isActive ? "secondary" : "ghost"}
      size="toolbar"
    >
      {label}
      <span className="ml-0.5 text-token-input-placeholder-foreground">{count}</span>
    </Button>
  );
}

function InlineErrorBanner({ message }: { message: string }) {
  return (
    <div className="app-card-muted rounded-[12px] px-3 py-2 text-[12px] leading-5">
      {message}
    </div>
  );
}

function CompactEmptyState({ title }: { title: string }) {
  return (
    <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
      <div>{title}</div>
    </div>
  );
}

function CenteredState({ title }: { title: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center">
      <div className="text-center">
        <div className="app-text-muted text-[13px]">{title}</div>
      </div>
    </div>
  );
}

function compareManagedMarketplaces(left: ManagedMarketplace, right: ManagedMarketplace) {
  return left.displayName.localeCompare(right.displayName);
}

function compareMarketplaces(left: MarketplaceGroup, right: MarketplaceGroup) {
  return getMarketplaceDisplayName(left).localeCompare(getMarketplaceDisplayName(right));
}

function comparePlugins(left: PluginSummary, right: PluginSummary) {
  return getPluginLabel(left).localeCompare(getPluginLabel(right));
}

function getPluginDisplayName(plugin: PluginSummary) {
  return plugin.interface?.displayName ?? plugin.name;
}

function getPluginDescription(plugin: PluginSummary) {
  return plugin.interface?.shortDescription ?? plugin.interface?.longDescription ?? plugin.name;
}

function getMarketplaceDisplayName(marketplace: Pick<PluginMarketplaceEntry, "interface" | "name">) {
  return marketplace.interface?.displayName ?? marketplace.name;
}

function getPluginLabel(plugin: PluginSummary) {
  return getPluginDisplayName(plugin).toLowerCase();
}

function buildPluginSearchText(marketplace: PluginMarketplaceEntry, plugin: PluginSummary) {
  return normalizeText(
    [
      marketplace.name,
      marketplace.interface?.displayName ?? "",
      marketplace.path ?? "",
      plugin.id,
      plugin.name,
      plugin.interface?.displayName ?? "",
      plugin.interface?.shortDescription ?? "",
      plugin.interface?.longDescription ?? "",
    ].join(" "),
  );
}

function buildAppSearchText(app: AppInfo) {
  return normalizeText(
    [app.id, app.name, app.description ?? "", app.installUrl ?? "", ...app.pluginDisplayNames].join(" "),
  );
}

function buildMcpSearchText(server: ManagedMcpServer) {
  return normalizeText(`${server.key} ${server.name}`);
}

function buildManagedMcpServers(config: ConfigSnapshot | null) {
  return parseMcpServers(config).map(({ name, server }) => ({
    enabled: server.base.enabled,
    key: name,
    name: formatMcpServerName(name, server),
  }));
}

function buildManagedSkills(
  skills: SkillSummary[],
  searchQuery: string,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const dedupedSkills = dedupeSkills(skills);
  const workspaceRoots = collectWorkspaceRoots(dedupedSkills);
  const query = normalizeText(searchQuery);

  return dedupedSkills
    .filter((skill) => {
      if (query.length === 0) {
        return true;
      }
      return buildSkillSearchText(skill).includes(query);
    })
    .map((skill) => ({
      scopeLabel: getSkillScopeLabel(skill, workspaceRoots, t),
      skill,
    }));
}

function buildSkillSearchText(skill: SkillSummary) {
  return normalizeText(
    [skill.name, skill.displayName ?? "", skill.description, skill.shortDescription ?? "", skill.path].join(" "),
  );
}

function getSkillDisplayName(skill: SkillSummary) {
  return skill.displayName ?? skill.name;
}

function buildManagedMarketplaces(
  snapshot: PluginListSnapshot | null,
  workspaceRoot: string | null,
): ManagedMarketplace[] {
  return (snapshot?.marketplaces ?? []).map((marketplace) => {
    const displayName = getMarketplaceDisplayName(marketplace);
    const isBuiltIn = marketplace.path == null;
    const isWorkspace = marketplace.path != null && isPathWithinRoot(marketplace.path, workspaceRoot);
    const hasGitPlugins = marketplace.plugins.some((plugin) => plugin.source.type === "git");

    return {
      name: marketplace.name,
      displayName,
      path: marketplace.path,
      pluginCount: marketplace.plugins.length,
      isBuiltIn,
      isWorkspace,
      isRemovable: !isBuiltIn && !isWorkspace,
      isUpgradable: !isBuiltIn && !isWorkspace && hasGitPlugins,
    };
  });
}

function buildMarketplaceSearchText(marketplace: ManagedMarketplace) {
  return normalizeText([marketplace.name, marketplace.displayName, marketplace.path ?? ""].join(" "));
}

function getMarketplaceRemoveDisabledKey(marketplace: ManagedMarketplace): MessageKey | null {
  if (marketplace.isRemovable) {
    return null;
  }

  return marketplace.isBuiltIn
    ? "skills.appsPage.marketplace.remove.builtInDisabled"
    : "skills.appsPage.marketplace.remove.workspaceDisabled";
}

function getMarketplaceUpgradeDisabledKey(marketplace: ManagedMarketplace): MessageKey | null {
  if (marketplace.isUpgradable) {
    return null;
  }

  if (marketplace.isBuiltIn) {
    return "skills.appsPage.marketplace.upgrade.builtInDisabled";
  }

  if (marketplace.isWorkspace) {
    return "skills.appsPage.marketplace.upgrade.workspaceDisabled";
  }

  return "skills.appsPage.marketplace.upgrade.localDisabled";
}

function isPathWithinRoot(path: string, workspaceRoot: string | null) {
  if (workspaceRoot == null || workspaceRoot.trim().length === 0) {
    return false;
  }

  const normalizedPath = normalizePathForComparison(path);
  const normalizedRoot = normalizePathForComparison(workspaceRoot);

  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function normalizePathForComparison(path: string) {
  return path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function normalizeAddMarketplaceDraft(
  draft: AddMarketplaceDraft,
): Omit<MarketplaceAddParams, "hostId"> | null {
  const source = draft.source.trim();
  if (source.length === 0) {
    return null;
  }

  const refName = draft.refName.trim();
  const sparsePaths = draft.sparsePaths
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    source,
    refName: refName.length > 0 ? refName : null,
    sparsePaths: sparsePaths.length > 0 ? sparsePaths : null,
  };
}

function countInstalledPlugins(snapshot: PluginListSnapshot | null) {
  return (snapshot?.marketplaces ?? []).reduce(
    (count, marketplace) => count + marketplace.plugins.filter((plugin) => plugin.installed).length,
    0,
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatMcpServerName(name: string, server: McpServerDraft) {
  const customLabel = server.label.trim();
  if (customLabel.length > 0) {
    return customLabel;
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return "";
  }

  return trimmedName === trimmedName.toLowerCase()
    ? `${trimmedName[0]?.toUpperCase() ?? ""}${trimmedName.slice(1)}`
    : trimmedName;
}

function dedupeSkills(skills: SkillSummary[]) {
  const selectedByName = new Map<string, SkillSummary>();

  for (const skill of skills) {
    const existing = selectedByName.get(skill.name);
    if (existing == null) {
      selectedByName.set(skill.name, skill);
      continue;
    }

    const currentRank = getScopePriority(skill.scope);
    const existingRank = getScopePriority(existing.scope);
    if (
      currentRank < existingRank ||
      (currentRank === existingRank && skill.path.localeCompare(existing.path) < 0)
    ) {
      selectedByName.set(skill.name, skill);
    }
  }

  return Array.from(selectedByName.values()).sort((left, right) =>
    getSkillDisplayName(left).localeCompare(getSkillDisplayName(right)),
  );
}

function collectWorkspaceRoots(skills: SkillSummary[]) {
  return Array.from(new Set(skills.map((skill) => skill.cwd).filter((cwd) => cwd.trim().length > 0)));
}

function getSkillScopeLabel(
  skill: SkillSummary,
  workspaceRoots: string[],
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const normalizedScope = normalizeScope(skill.scope);
  if (normalizedScope === "repo") {
    const repoRoot = getBestMatchingRoot(skill.path, workspaceRoots);
    return repoRoot ? getPathBasename(repoRoot) : t("skills.scope.team");
  }
  if (normalizedScope === "user") {
    return t("skills.scope.personal");
  }
  if (normalizedScope === "admin") {
    return t("skills.scope.adminInstalled");
  }
  return t("skills.scope.builtIn");
}

function getScopePriority(scope: string) {
  return SCOPE_PRIORITY[normalizeScope(scope)] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getBestMatchingRoot(path: string, roots: string[]) {
  let bestMatch: string | null = null;

  for (const root of roots) {
    if (!path.startsWith(root)) {
      continue;
    }
    if (bestMatch == null || root.length > bestMatch.length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

function getPathBasename(path: string) {
  const trimmedPath = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmedPath.lastIndexOf("/"), trimmedPath.lastIndexOf("\\"));
  return separatorIndex === -1 ? trimmedPath : trimmedPath.slice(separatorIndex + 1);
}

const SCOPE_PRIORITY: Record<string, number> = {
  repo: 0,
  user: 1,
  personal: 1,
  system: 2,
  "built-in": 2,
  builtin: 2,
  admin: 3,
  admininstalled: 3,
};
