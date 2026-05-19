import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { PlusIcon, RefreshIcon, SearchIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { SettingsHostDropdown } from "../../components/SettingsHostDropdown";
import { SettingsChoiceMenu } from "../../components/SettingsChoiceMenu";
import { useI18n } from "../../i18n/i18n";
import { renderInlineLinkMessage } from "../../i18n/renderInlineLinkMessage";
import type { MessageKey } from "../../i18n/messages";
import {
  buildMarketplaceFilterOptions,
  buildPluginTryInChatPrompt,
  filterBrowsePluginCandidates,
  getPluginCandidateDisplayName,
  groupPluginBrowseSections,
  listPluginCandidates,
  selectHeroPlugins,
  selectImportedPluginCandidates,
  type PluginCandidate,
} from "../../lib/pluginSelectors";
import {
  readAppsSnapshot,
  type AppInfo,
} from "../../services/apps";
import {
  detectExternalAgentImports,
  type ExternalAgentImportItem,
} from "../../services/externalAgentImport";
import {
  installPlugin,
  readPlugin,
  readPluginsSnapshot,
  setPluginEnabled,
  type PluginDetail,
  type PluginListSnapshot,
  type PluginReadParams,
} from "../../services/plugins";
import {
  readConfigForHost,
  resolveUserConfigWriteTarget,
  type ConfigWriteTarget,
} from "../../services/settings";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../../services/queryCache";
import {
  LOCAL_SETTINGS_HOST_ID,
  normalizeSelectedSettingsHostId,
  type RemoteConnection,
} from "../../services/settingsHosts";
import {
  installRecommendedSkill,
  readRecommendedSkills,
  type RecommendedSkill,
} from "../../services/recommendedSkills";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import { buildCreatorPrefillPrompt, readStoredBoolean, writeStoredBoolean } from "./creatorPrefill";
import { InstalledSkillCard } from "./components/InstalledSkillCard";
import { PluginDetailDialog } from "./components/PluginDetailDialog";
import { PluginsBrowseTab } from "./components/PluginsBrowseTab";
import { PluginsPage, type ManageTab } from "./PluginsPage";
import { ThreadPageHeader } from "../chat/ThreadPageHeader";
import type { SkillsChatRequest } from "./types";

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

const ALL_CATEGORIES_VALUE = "__all_categories__";
const ALL_MARKETPLACES_VALUE = "__all_marketplaces__";
const IMPORT_PROVIDER_IDS = ["claude-code"];
const SKILL_CREATOR_PREFILL_STORAGE_KEY = "has-opened-skill-creator-prefill-v1";
const PLUGIN_QUERY_KEY = ["plugins"] as const;
const APPS_QUERY_KEY = ["apps", "list"] as const;
const CONFIG_QUERY_KEY = ["config"] as const;
const SKILLS_QUERY_KEY = ["skills"] as const;
const SKILLS_DOCS_URL = "https://developers.openai.com/codex/skills/";

type BrowseTab = "plugins" | "skills" | "apps";

type PluginBrowseState = {
  apps: AppInfo[];
  importedPluginNames: string[];
  snapshot: PluginListSnapshot;
  writeTarget: ConfigWriteTarget | null;
};

type SkillsRoutePageProps = {
  authMethod: string | null;
  codexHome: string | null;
  connectAppId?: string;
  connectedRemoteConnections: RemoteConnection[];
  initialTab?: BrowseTab;
  isPluginsRouteEnabled: boolean;
  onConsumeInitialState: () => void;
  onOpenChatWithPrompt: (request: SkillsChatRequest) => void;
  onSelectHost: (hostId: string) => void;
  onShowToast: (toast: AppToast) => void;
  pluginDeepLinkAuthBlocked?: boolean;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  workspaceRoot: string | null;
};

export function SkillsRoutePage({
  authMethod,
  codexHome,
  connectAppId,
  connectedRemoteConnections,
  initialTab,
  isPluginsRouteEnabled,
  onConsumeInitialState,
  onOpenChatWithPrompt,
  onSelectHost,
  onShowToast,
  pluginDeepLinkAuthBlocked,
  remoteConnectionHostIds,
  selectedHostId,
  workspaceRoot,
}: SkillsRoutePageProps) {
  const { t } = useI18n();
  const resolvedSelectedHostId = normalizeSelectedSettingsHostId(
    selectedHostId,
    connectedRemoteConnections,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMarketplaceFilterValue, setSelectedMarketplaceFilterValue] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsLoadError, setSkillsLoadError] = useState<string | null>(null);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [recommendedSkills, setRecommendedSkills] = useState<RecommendedSkill[]>([]);
  const [recommendedSkillsLoadError, setRecommendedSkillsLoadError] = useState<string | null>(null);
  const [recommendedSkillsRepoRoot, setRecommendedSkillsRepoRoot] = useState<string | null>(null);
  const [isRecommendedSkillsLoading, setIsRecommendedSkillsLoading] = useState(true);
  const [installingRecommendedSkillId, setInstallingRecommendedSkillId] = useState<string | null>(null);
  const [hasPendingSkillRefresh, setHasPendingSkillRefresh] = useState(false);
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [importedPluginNames, setImportedPluginNames] = useState<string[]>([]);
  const [pluginsLoadError, setPluginsLoadError] = useState<string | null>(null);
  const [isPluginsLoading, setIsPluginsLoading] = useState(true);
  const [configWriteTarget, setConfigWriteTarget] = useState<ConfigWriteTarget | null>(null);
  const [activePlugin, setActivePlugin] = useState<PluginCandidate | null>(null);
  const [pluginDetail, setPluginDetail] = useState<PluginDetail | null>(null);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [pendingTogglePluginId, setPendingTogglePluginId] = useState<string | null>(null);
  const skillsRequestIdRef = useRef(0);
  const recommendedSkillsRequestIdRef = useRef(0);
  const browseRequestIdRef = useRef(0);
  const [hasOpenedSkillCreatorPrefill, setHasOpenedSkillCreatorPrefill] = useState(() =>
    readStoredBoolean(SKILL_CREATOR_PREFILL_STORAGE_KEY),
  );

  const canShowUnifiedPluginsPage = isPluginsRouteEnabled && authMethod !== "apikey";
  const shouldShowManagePluginsPage =
    canShowUnifiedPluginsPage &&
    (initialTab === "apps" ||
      (initialTab != null && initialTab !== "skills") ||
      (connectAppId != null && connectAppId.trim().length > 0));
  const initialManageTab: ManageTab | undefined =
    initialTab === "apps" || initialTab === "plugins" ? initialTab : undefined;
  const canInstallRecommendedSkills = resolvedSelectedHostId === LOCAL_SETTINGS_HOST_ID;
  const skillCreatorPath = useMemo(() => {
    if (!codexHome || resolvedSelectedHostId !== LOCAL_SETTINGS_HOST_ID) {
      return null;
    }

    return `${codexHome}/skills/.system/skill-creator/SKILL.md`;
  }, [codexHome, resolvedSelectedHostId]);

  useEffect(() => {
    if (initialTab != null || pluginDeepLinkAuthBlocked === true) {
      onConsumeInitialState();
    }
  }, [initialTab, onConsumeInitialState, pluginDeepLinkAuthBlocked]);

  useEffect(() => {
    if (pluginDeepLinkAuthBlocked !== true || authMethod !== "apikey") {
      return;
    }

    onShowToast({
      tone: "info",
      message: t("skills.pluginsAuthBlockedToast.title"),
      description: t("skills.pluginsAuthBlockedToast.description"),
    });
  }, [authMethod, onShowToast, pluginDeepLinkAuthBlocked, t]);

  useEffect(() => {
    void loadSkills({
      forceReload: false,
      hostId: resolvedSelectedHostId,
      onError: setSkillsLoadError,
      onLoaded: setSkills,
      onLoading: setIsSkillsLoading,
      requestIdRef: skillsRequestIdRef,
      workspaceRoot,
    });

    void loadRecommendedSkills({
      hostId: resolvedSelectedHostId,
      onError: setRecommendedSkillsLoadError,
      onLoaded: setRecommendedSkills,
      onLoading: setIsRecommendedSkillsLoading,
      onRepoRootLoaded: setRecommendedSkillsRepoRoot,
      refresh: false,
      requestIdRef: recommendedSkillsRequestIdRef,
    });
    setHasPendingSkillRefresh(false);

    if (!canShowUnifiedPluginsPage) {
      setPluginsSnapshot(null);
      setApps([]);
      setImportedPluginNames([]);
      setPluginsLoadError(null);
      setIsPluginsLoading(false);
      setConfigWriteTarget(null);
      setActivePlugin(null);
      return;
    }

    void loadBrowseState({
      onAppsLoaded: setApps,
      onConfigWriteTargetLoaded: setConfigWriteTarget,
      onError: setPluginsLoadError,
      onImportedPluginNamesLoaded: setImportedPluginNames,
      onLoaded: setPluginsSnapshot,
      onLoading: setIsPluginsLoading,
      requestIdRef: browseRequestIdRef,
      selectedHostId: resolvedSelectedHostId,
      workspaceRoot,
    });
  }, [canShowUnifiedPluginsPage, resolvedSelectedHostId, workspaceRoot]);

  useEffect(() => {
    if (activePlugin == null || !canShowUnifiedPluginsPage) {
      setPluginDetail(null);
      setDetailLoadError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setPluginDetail(null);
    setDetailLoadError(null);
    setDetailLoading(true);

    void readPlugin(buildPluginParams(activePlugin, resolvedSelectedHostId))
      .then((response) => {
        if (!cancelled) {
          setPluginDetail(response.plugin);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailLoadError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePlugin, canShowUnifiedPluginsPage, resolvedSelectedHostId]);

  useEffect(() => {
    if (activePlugin == null) {
      return;
    }

    const nextActivePlugin = findPluginCandidateById(pluginsSnapshot, activePlugin.plugin.id);
    if (nextActivePlugin === activePlugin) {
      return;
    }

    setActivePlugin(nextActivePlugin);
  }, [activePlugin, pluginsSnapshot]);

  const installedSkills = useMemo(() => dedupeSkills(skills), [skills]);
  const workspaceRoots = useMemo(() => collectWorkspaceRoots(installedSkills), [installedSkills]);

  const filteredSkills = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (query.length === 0) {
      return installedSkills;
    }
    return installedSkills.filter((skill) => buildInstalledSkillSearchText(skill).includes(query));
  }, [installedSkills, searchQuery]);

  const installedSkillMatchKeys = useMemo(() => buildInstalledSkillMatchKeys(installedSkills), [installedSkills]);

  const filteredRecommendedSkills = useMemo(() => {
    const query = normalizeText(searchQuery);
    return recommendedSkills
      .filter((skill) => !matchesInstalledSkill(installedSkillMatchKeys, skill))
      .filter((skill) => {
        if (query.length === 0) {
          return true;
        }
        return buildRecommendedSkillSearchText(skill).includes(query);
      });
  }, [installedSkillMatchKeys, recommendedSkills, searchQuery]);

  const allPluginCandidates = useMemo(() => listPluginCandidates(pluginsSnapshot), [pluginsSnapshot]);
  const marketplaceFilterOptions = useMemo(
    () => buildMarketplaceFilterOptions(allPluginCandidates),
    [allPluginCandidates],
  );
  const filteredPluginCandidates = useMemo(
    () =>
      filterBrowsePluginCandidates({
        candidates: allPluginCandidates,
        marketplaceFilterValue: selectedMarketplaceFilterValue,
        query: searchQuery,
      }),
    [allPluginCandidates, searchQuery, selectedMarketplaceFilterValue],
  );

  const importedPlugins = useMemo(
    () =>
      selectImportedPluginCandidates({
        apps,
        importedPluginNames,
        snapshot: pluginsSnapshot,
      }),
    [apps, importedPluginNames, pluginsSnapshot],
  );

  const filteredImportedPlugins = useMemo(
    () =>
      filterBrowsePluginCandidates({
        candidates: importedPlugins,
        marketplaceFilterValue: selectedMarketplaceFilterValue,
        query: searchQuery,
      }),
    [importedPlugins, searchQuery, selectedMarketplaceFilterValue],
  );

  const importedPluginIds = useMemo(
    () => new Set(filteredImportedPlugins.map((candidate) => candidate.plugin.id)),
    [filteredImportedPlugins],
  );

  const discoverPluginCandidates = useMemo(
    () =>
      filteredPluginCandidates.filter((candidate) => !importedPluginIds.has(candidate.plugin.id)),
    [filteredPluginCandidates, importedPluginIds],
  );

  const groupedPluginSections = useMemo(
    () =>
      groupPluginBrowseSections(
        discoverPluginCandidates,
        pluginsSnapshot?.featuredPluginIds ?? [],
      ),
    [discoverPluginCandidates, pluginsSnapshot],
  );

  const categoryFilterOptions = useMemo(
    () => groupedPluginSections.map(({ section }) => ({ label: section.title, value: section.id })),
    [groupedPluginSections],
  );

  const visiblePluginSections = useMemo(() => {
    if (selectedCategoryId == null) {
      return groupedPluginSections;
    }
    return groupedPluginSections.filter(({ section }) => section.id === selectedCategoryId);
  }, [groupedPluginSections, selectedCategoryId]);

  const showHeroAndImportedSections = searchQuery.trim().length === 0 && selectedCategoryId == null;
  const heroPlugins = useMemo(
    () =>
      showHeroAndImportedSections
        ? selectHeroPlugins(discoverPluginCandidates, pluginsSnapshot?.featuredPluginIds ?? [])
        : [],
    [discoverPluginCandidates, pluginsSnapshot, showHeroAndImportedSections],
  );

  useEffect(() => {
    if (
      selectedMarketplaceFilterValue != null &&
      !marketplaceFilterOptions.some((option) => option.value === selectedMarketplaceFilterValue)
    ) {
      setSelectedMarketplaceFilterValue(null);
    }
  }, [marketplaceFilterOptions, selectedMarketplaceFilterValue]);

  useEffect(() => {
    if (
      selectedCategoryId != null &&
      !categoryFilterOptions.some((option) => option.value === selectedCategoryId)
    ) {
      setSelectedCategoryId(null);
    }
  }, [categoryFilterOptions, selectedCategoryId]);

  const refreshSkills = async (forceReload: boolean) =>
    loadSkills({
      forceReload,
      hostId: resolvedSelectedHostId,
      onError: setSkillsLoadError,
      onLoaded: setSkills,
      onLoading: setIsSkillsLoading,
      requestIdRef: skillsRequestIdRef,
      workspaceRoot,
    });

  const refreshRecommendedSkills = async (refresh: boolean) =>
    loadRecommendedSkills({
      hostId: resolvedSelectedHostId,
      onError: setRecommendedSkillsLoadError,
      onLoaded: setRecommendedSkills,
      onLoading: setIsRecommendedSkillsLoading,
      onRepoRootLoaded: setRecommendedSkillsRepoRoot,
      refresh,
      requestIdRef: recommendedSkillsRequestIdRef,
    });

  const refreshBrowseData = async (options?: { forceRefetchApps?: boolean }) =>
    refreshBrowseState({
      onAppsLoaded: setApps,
      onConfigWriteTargetLoaded: setConfigWriteTarget,
      onError: setPluginsLoadError,
      onImportedPluginNamesLoaded: setImportedPluginNames,
      onLoaded: setPluginsSnapshot,
      requestIdRef: browseRequestIdRef,
      selectedHostId: resolvedSelectedHostId,
      forceRefetchApps: options?.forceRefetchApps ?? false,
      workspaceRoot,
    });

  const handleQueryCacheInvalidate = useEffectEvent((notification: QueryCacheInvalidateNotification) => {
    const shouldRefreshBrowseData =
      canShowUnifiedPluginsPage &&
      (queryKeyMatchesPrefix(notification.queryKey, PLUGIN_QUERY_KEY) ||
        queryKeyMatchesPrefix(notification.queryKey, APPS_QUERY_KEY) ||
        queryKeyMatchesPrefix(notification.queryKey, CONFIG_QUERY_KEY));
    const shouldRefreshSkills = queryKeyMatchesPrefix(notification.queryKey, SKILLS_QUERY_KEY);

    if (!shouldRefreshBrowseData && !shouldRefreshSkills) {
      return;
    }

    if (shouldRefreshBrowseData) {
      void refreshBrowseData({ forceRefetchApps: true });
    }

    if (shouldRefreshSkills) {
      void refreshSkills(true);
      void refreshRecommendedSkills(true);
    }
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

  const updateActivePluginFromSnapshot = (snapshot: PluginListSnapshot | null, pluginId: string) => {
    const nextCandidate = findPluginCandidateById(snapshot, pluginId);
    if (nextCandidate != null) {
      setActivePlugin((current) => (current?.plugin.id === pluginId ? nextCandidate : current));
    }
    return nextCandidate;
  };

  const installPluginCandidate = async (candidate: PluginCandidate) => {
    setInstallingPluginId(candidate.plugin.id);
    try {
      await installPlugin(buildPluginParams(candidate, resolvedSelectedHostId));
      const nextSnapshot = await refreshBrowseData();
      await refreshSkills(true);
      return updateActivePluginFromSnapshot(nextSnapshot, candidate.plugin.id) ?? candidate;
    } finally {
      setInstallingPluginId(null);
    }
  };

  const togglePluginCandidate = async (candidate: PluginCandidate, enabled: boolean) => {
    setPendingTogglePluginId(candidate.plugin.id);
    try {
      await setPluginEnabled({
        enabled,
        expectedVersion: configWriteTarget?.expectedVersion ?? null,
        filePath: configWriteTarget?.filePath ?? null,
        hostId: resolvedSelectedHostId,
        pluginId: candidate.plugin.id,
      });
      const nextSnapshot = await refreshBrowseData();
      await refreshSkills(true);
      return updateActivePluginFromSnapshot(nextSnapshot, candidate.plugin.id) ?? candidate;
    } finally {
      setPendingTogglePluginId(null);
    }
  };

  const handleInstallPlugin = async (candidate: PluginCandidate) => {
    if (installingPluginId != null) {
      return;
    }

    setPluginsLoadError(null);
    setDetailLoadError(null);

    try {
      await installPluginCandidate(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setDetailLoadError(message);
      } else {
        setPluginsLoadError(message);
      }
    }
  };

  const handleTogglePluginEnabled = async (candidate: PluginCandidate, enabled: boolean) => {
    if (pendingTogglePluginId != null || candidate.plugin.enabled === enabled) {
      return;
    }

    setPluginsLoadError(null);
    setDetailLoadError(null);

    try {
      await togglePluginCandidate(candidate, enabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setDetailLoadError(message);
      } else {
        setPluginsLoadError(message);
      }
    }
  };

  const handleTryInChat = async (candidate: PluginCandidate) => {
    if (installingPluginId != null || pendingTogglePluginId != null) {
      return;
    }

    setPluginsLoadError(null);
    setDetailLoadError(null);

    try {
      let nextCandidate = candidate;
      if (!nextCandidate.plugin.installed) {
        nextCandidate = await installPluginCandidate(nextCandidate);
      }
      if (!nextCandidate.plugin.enabled) {
        nextCandidate = await togglePluginCandidate(nextCandidate, true);
      }
      onOpenChatWithPrompt({
        prompt: buildPluginTryInChatPrompt(nextCandidate),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setDetailLoadError(message);
      } else {
        setPluginsLoadError(message);
      }
    }
  };

  const handleCreateSkill = () => {
    if (skillCreatorPath == null) {
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

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [headingContainer, setHeadingContainer] = useState<HTMLDivElement | null>(null);
  const isHeadingVisible = useElementVisibility({
    container: scrollContainer,
    target: headingContainer,
  });

  useEffect(() => {
    document.documentElement.dataset.hideHeaderDivider = "true";
    return () => {
      delete document.documentElement.dataset.hideHeaderDivider;
    };
  }, []);

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="flex min-h-full w-full flex-col pb-6">
        {shouldShowManagePluginsPage ? (
          <PluginsPage
            codexHome={codexHome}
            connectedRemoteConnections={connectedRemoteConnections}
            initialSelectedAppId={connectAppId ?? null}
            initialTab={initialManageTab}
            onOpenChatWithPrompt={onOpenChatWithPrompt}
            onSelectHost={onSelectHost}
            onShowToast={onShowToast}
            remoteConnectionHostIds={remoteConnectionHostIds}
            selectedHostId={resolvedSelectedHostId}
            workspaceRoot={workspaceRoot}
          />
        ) : canShowUnifiedPluginsPage ? (
          <>
            <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-6 px-5 pb-8 pt-6">
              <div className="flex justify-end">
                <SettingsHostDropdown
                  connectedRemoteConnections={connectedRemoteConnections}
                  onSelectHost={onSelectHost}
                  remoteConnectionHostIds={remoteConnectionHostIds}
                  selectedHostId={resolvedSelectedHostId}
                  t={t}
                />
              </div>

              <div className="flex justify-center text-center">
                <h1 className="app-title text-[28px] font-normal">{t("skills.appsPage.browseIntro.title")}</h1>
              </div>
            </div>

            <div className="sticky top-0 z-10 bg-gradient-to-b from-[var(--app-shell-main-surface)] to-transparent">
              <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-3 px-5 pb-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <SearchInput
                    ariaLabel={t("skills.appsPage.search.plugins.label")}
                    onChange={setSearchQuery}
                    placeholder={t("skills.appsPage.search.plugins")}
                    value={searchQuery}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <SettingsChoiceMenu
                      disabled={marketplaceFilterOptions.length === 0}
                      onChange={(value) =>
                        setSelectedMarketplaceFilterValue(
                          value === ALL_MARKETPLACES_VALUE ? null : value,
                        )
                      }
                      options={[
                        {
                          label: t("skills.appsPage.pluginsFilter.all"),
                          value: ALL_MARKETPLACES_VALUE,
                        },
                        ...marketplaceFilterOptions.map((option) => ({
                          description: option.subLabel ?? undefined,
                          label: option.label,
                          value: option.value,
                        })),
                      ]}
                      value={selectedMarketplaceFilterValue ?? ALL_MARKETPLACES_VALUE}
                    />

                    <SettingsChoiceMenu
                      disabled={categoryFilterOptions.length === 0}
                      onChange={(value) =>
                        setSelectedCategoryId(value === ALL_CATEGORIES_VALUE ? null : value)
                      }
                      options={[
                        {
                          label: t("skills.appsPage.categoryFilter.all"),
                          value: ALL_CATEGORIES_VALUE,
                        },
                        ...categoryFilterOptions,
                      ]}
                      value={selectedCategoryId ?? ALL_CATEGORIES_VALUE}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto flex min-h-0 w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col px-5">
              <PluginsBrowseTab
                errorMessage={pluginsLoadError}
                heroPlugins={heroPlugins}
                importedPlugins={showHeroAndImportedSections ? filteredImportedPlugins : []}
                isLoading={isPluginsLoading}
                onInstallPlugin={(candidate) => handleInstallPlugin(candidate)}
                onOpenPluginDetails={setActivePlugin}
                onToggleInstalledPluginEnabled={(candidate, enabled) =>
                  handleTogglePluginEnabled(candidate, enabled)
                }
                onTryInChat={(candidate) => handleTryInChat(candidate)}
                pendingPluginId={installingPluginId}
                pendingTogglePluginId={pendingTogglePluginId}
                sections={visiblePluginSections}
              />
            </div>
          </>
        ) : (
          <div className="mr-4 flex h-full flex-col text-base">
            <ThreadPageHeader
              environmentType={null}
              start={isHeadingVisible ? null : t("skills.page.heading")}
              trailing={
                <div className="flex flex-nowrap items-center gap-1.5">
                  {connectedRemoteConnections.length > 0 && remoteConnectionHostIds.length > 0 ? (
                    <SettingsHostDropdown
                      connectedRemoteConnections={connectedRemoteConnections}
                      onSelectHost={onSelectHost}
                      remoteConnectionHostIds={remoteConnectionHostIds}
                      selectedHostId={resolvedSelectedHostId}
                      t={t}
                    />
                  ) : null}
                  <RefreshSkillsButton
                    isDisabled={isSkillsLoading || isRecommendedSkillsLoading}
                    isPendingRefresh={hasPendingSkillRefresh}
                    onClick={() => {
                      void Promise.all([refreshSkills(true), refreshRecommendedSkills(true)]).then(
                        ([skillsRefreshed, recommendedSkillsRefreshed]) => {
                          if (skillsRefreshed && recommendedSkillsRefreshed) {
                            setHasPendingSkillRefresh(false);
                          }
                        },
                      );
                    }}
                    t={t}
                  />
                  <div className="hidden min-w-[160px] flex-1 lg:flex lg:w-[220px] lg:flex-none">
                    <SearchInput
                      ariaLabel={t("skills.page.search.label")}
                      onChange={setSearchQuery}
                      placeholder={t("skills.page.search")}
                      value={searchQuery}
                    />
                  </div>
                  <Button
                    color="primary"
                    disabled={skillCreatorPath == null}
                    onClick={handleCreateSkill}
                    size="toolbar"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>{t("skills.page.createSkill")}</span>
                  </Button>
                </div>
              }
            />

            <div className="flex-1 overflow-y-auto p-panel" ref={setScrollContainer}>
              <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col gap-8">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-1" ref={setHeadingContainer}>
                    <div className="heading-xl font-normal text-token-foreground">
                      {t("skills.page.heading")}
                    </div>
                    <div className="text-lg font-normal text-token-description-foreground">
                      {renderInlineLinkMessage(t("skills.page.subheading"), SKILLS_DOCS_URL)}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 w-full flex-1">
                  <div className="flex min-h-0 flex-1 flex-col gap-9 pb-10">
                    <PageSection title={t("skills.section.installed")}>
                      <InstalledSkillsSection
                        getScopeLabel={(skill) => getSkillScopeLabel(skill, workspaceRoots, t)}
                        hostId={resolvedSelectedHostId}
                        isLoading={isSkillsLoading}
                        loadError={skillsLoadError}
                        onOpenChatWithPrompt={onOpenChatWithPrompt}
                        onShowToast={onShowToast}
                        onSkillsUpdated={async () => {
                          await refreshSkills(true);
                        }}
                        skills={filteredSkills}
                        totalSkills={installedSkills.length}
                        t={t}
                      />
                    </PageSection>

                    <PageSection title={t("skills.section.recommended")}>
                      <RecommendedSkillsSection
                        canInstall={canInstallRecommendedSkills}
                        installingSkillId={installingRecommendedSkillId}
                        isLoading={isRecommendedSkillsLoading}
                        loadError={recommendedSkillsLoadError}
                        onInstall={async (skill) => {
                          setInstallingRecommendedSkillId(skill.id);
                          setRecommendedSkillsLoadError(null);
                          try {
                            await installRecommendedSkill({
                              hostId: resolvedSelectedHostId,
                              installRoot:
                                resolvedSelectedHostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null,
                              repoPath: skill.repoPath,
                              skillId: skill.id,
                            });
                            await refreshRecommendedSkills(true);
                            setHasPendingSkillRefresh(true);
                          } catch (error) {
                            setRecommendedSkillsLoadError(
                              error instanceof Error ? error.message : String(error),
                            );
                          } finally {
                            setInstallingRecommendedSkillId(null);
                          }
                        }}
                        repoRoot={recommendedSkillsRepoRoot}
                        skills={filteredRecommendedSkills}
                        totalSkills={recommendedSkills.filter(
                          (skill) => !matchesInstalledSkill(installedSkillMatchKeys, skill),
                        ).length}
                        t={t}
                      />
                    </PageSection>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activePlugin != null ? (
        <PluginDetailDialog
          candidate={activePlugin}
          detail={pluginDetail}
          error={detailLoadError}
          isLoading={detailLoading}
          onClose={() => setActivePlugin(null)}
          onInstall={() => void handleInstallPlugin(activePlugin)}
          onRetry={() => {
            setActivePlugin({ ...activePlugin, plugin: { ...activePlugin.plugin } });
          }}
          onToggleInstalledPluginEnabled={(enabled) =>
            void handleTogglePluginEnabled(activePlugin, enabled)
          }
          onTryInChat={() => void handleTryInChat(activePlugin)}
          pendingPluginId={installingPluginId}
          pendingTogglePluginId={pendingTogglePluginId}
        />
      ) : null}
    </div>
  );
}

function RefreshSkillsButton({
  isDisabled,
  isPendingRefresh,
  onClick,
  t,
}: {
  isDisabled: boolean;
  isPendingRefresh: boolean;
  onClick: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <Button
      color={isPendingRefresh ? "secondary" : "ghost"}
      onClick={onClick}
      disabled={isDisabled}
      size="toolbar"
    >
      <RefreshIcon className="h-4 w-4" />
      <span className="hidden lg:inline">
        {isPendingRefresh ? t("skills.page.refreshSkillsToUseNew") : t("skills.page.refreshSkills")}
      </span>
    </Button>
  );
}

function PageSection({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="pr-0.5 pl-2 text-base font-medium text-token-foreground opacity-75">{title}</div>
      {children}
    </section>
  );
}

function SearchInput({
  ariaLabel,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="app-control flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[12px] px-3">
      <SearchIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
      <span className="sr-only">{ariaLabel}</span>
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="app-text-input min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
    </label>
  );
}

function InstalledSkillsSection({
  getScopeLabel,
  hostId,
  isLoading,
  loadError,
  onOpenChatWithPrompt,
  onShowToast,
  onSkillsUpdated,
  skills,
  totalSkills,
  t,
}: {
  getScopeLabel: (skill: SkillSummary) => string;
  hostId: string;
  isLoading: boolean;
  loadError: string | null;
  onOpenChatWithPrompt: (request: SkillsChatRequest) => void;
  onShowToast: (toast: AppToast) => void;
  onSkillsUpdated: () => Promise<void>;
  skills: SkillSummary[];
  totalSkills: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (loadError) {
    void loadError;
  }

  if (totalSkills === 0) {
    return <CenteredState title={t("skills.page.empty")} />;
  }

  if (skills.length === 0) {
    return (
      <CenteredState
        description={t("skills.page.filteredEmptyDescription")}
        title={t("skills.page.filteredEmpty")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {skills.map((skill) => (
        <InstalledSkillCard
          key={`${skill.cwd}:${skill.path}`}
          hostId={hostId}
          onOpenChatWithPrompt={onOpenChatWithPrompt}
          onShowToast={onShowToast}
          onSkillsUpdated={onSkillsUpdated}
          scopeBadges={[getScopeLabel(skill)]}
          skill={skill}
        />
      ))}
    </div>
  );
}

function RecommendedSkillsSection({
  canInstall,
  installingSkillId,
  isLoading,
  loadError,
  onInstall,
  repoRoot,
  skills,
  totalSkills,
  t,
}: {
  canInstall: boolean;
  installingSkillId: string | null;
  isLoading: boolean;
  loadError: string | null;
  onInstall: (skill: RecommendedSkill) => Promise<void>;
  repoRoot: string | null;
  skills: RecommendedSkill[];
  totalSkills: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (loadError) {
    return <CenteredState description={loadError} title={t("skills.recommended.error")} />;
  }

  if (totalSkills === 0) {
    return <CenteredState title={t("skills.page.empty")} />;
  }

  if (skills.length === 0) {
    return (
      <CenteredState
        description={t("skills.page.filteredEmptyDescription")}
        title={t("skills.page.filteredEmpty")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {skills.map((skill) => {
        const skillName = skill.name;
        const isInstalling = installingSkillId === skill.id;
        const resolvedRepoPath =
          repoRoot == null ? skill.repoPath : `${repoRoot.replace(/[\\/]+$/, "")}/${skill.repoPath}`;

        return (
          <article
            key={skill.id}
            className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] leading-6">{skillName}</div>
                <div className="app-text-muted mt-1 text-[12px] leading-5">
                  {skill.shortDescription ?? skill.description}
                </div>
                <div
                  className="app-text-muted mt-1 truncate text-[11px] leading-5"
                  title={resolvedRepoPath}
                >
                  {resolvedRepoPath}
                </div>
              </div>
              <button
                type="button"
                disabled={!canInstall || isInstalling}
                onClick={() => void onInstall(skill)}
                className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {isInstalling
                  ? t("plugins.installModal.installing", { pluginName: skillName })
                  : t("plugins.installModal.install", { pluginName: skillName })}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CenteredState({
  description,
  title,
}: {
  description?: string | null;
  title: string;
}) {
  return (
    <div className="flex min-h-[180px] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="text-[14px] leading-6">{title}</div>
        {description ? <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div> : null}
      </div>
    </div>
  );
}

async function loadSkills({
  forceReload,
  hostId,
  onError,
  onLoaded,
  onLoading,
  requestIdRef,
  workspaceRoot,
}: {
  forceReload: boolean;
  hostId: string;
  onError: (value: string | null) => void;
  onLoaded: (value: SkillSummary[]) => void;
  onLoading: (value: boolean) => void;
  requestIdRef: MutableRefObject<number>;
  workspaceRoot: string | null;
}) {
  const requestId = ++requestIdRef.current;
  onLoading(true);
  onError(null);
  const effectiveWorkspaceRoot = hostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null;

  try {
    const nextSkills = await readSkillsSnapshot(effectiveWorkspaceRoot, {
      forceReload,
      hostId,
    });
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded(nextSkills);
    return true;
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded([]);
    onError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    if (requestId === requestIdRef.current) {
      onLoading(false);
    }
  }
}

async function loadRecommendedSkills({
  hostId,
  onError,
  onLoaded,
  onLoading,
  onRepoRootLoaded,
  refresh,
  requestIdRef,
}: {
  hostId: string;
  onError: (value: string | null) => void;
  onLoaded: (value: RecommendedSkill[]) => void;
  onLoading: (value: boolean) => void;
  onRepoRootLoaded: (value: string | null) => void;
  refresh: boolean;
  requestIdRef: MutableRefObject<number>;
}) {
  const requestId = ++requestIdRef.current;
  onLoading(true);
  onError(null);

  try {
    const response = await readRecommendedSkills({
      hostId,
      refresh,
    });
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded(response.skills);
    onRepoRootLoaded(response.repoRoot);
    onError(response.error);
    return response.error == null;
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded([]);
    onRepoRootLoaded(null);
    onError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    if (requestId === requestIdRef.current) {
      onLoading(false);
    }
  }
}

async function loadBrowseState({
  onAppsLoaded,
  onConfigWriteTargetLoaded,
  onError,
  onImportedPluginNamesLoaded,
  onLoaded,
  onLoading,
  requestIdRef,
  selectedHostId,
  forceRefetchApps,
  workspaceRoot,
}: {
  onAppsLoaded: (value: AppInfo[]) => void;
  onConfigWriteTargetLoaded: (value: ConfigWriteTarget | null) => void;
  onError: (value: string | null) => void;
  onImportedPluginNamesLoaded: (value: string[]) => void;
  onLoaded: (value: PluginListSnapshot | null) => void;
  onLoading: (value: boolean) => void;
  forceRefetchApps?: boolean;
  requestIdRef: MutableRefObject<number>;
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const requestId = ++requestIdRef.current;
  onLoading(true);
  onError(null);

  try {
    const nextState = await readPluginBrowseState(workspaceRoot, selectedHostId, {
      forceRefetchApps: forceRefetchApps ?? false,
    });
    if (requestId !== requestIdRef.current) {
      return null;
    }
    onLoaded(nextState.snapshot);
    onAppsLoaded(nextState.apps);
    onImportedPluginNamesLoaded(nextState.importedPluginNames);
    onConfigWriteTargetLoaded(nextState.writeTarget);
    return nextState.snapshot;
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return null;
    }
    onLoaded(null);
    onAppsLoaded([]);
    onImportedPluginNamesLoaded([]);
    onConfigWriteTargetLoaded(
      typeof error === "object" && error !== null && "writeTarget" in error
        ? (error.writeTarget as ConfigWriteTarget | null)
        : null,
    );
    onError(error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    if (requestId === requestIdRef.current) {
      onLoading(false);
    }
  }
}

async function refreshBrowseState({
  onAppsLoaded,
  onConfigWriteTargetLoaded,
  onError,
  onImportedPluginNamesLoaded,
  onLoaded,
  forceRefetchApps,
  requestIdRef,
  selectedHostId,
  workspaceRoot,
}: {
  onAppsLoaded: (value: AppInfo[]) => void;
  onConfigWriteTargetLoaded: (value: ConfigWriteTarget | null) => void;
  onError: (value: string | null) => void;
  onImportedPluginNamesLoaded: (value: string[]) => void;
  onLoaded: (value: PluginListSnapshot | null) => void;
  forceRefetchApps?: boolean;
  requestIdRef: MutableRefObject<number>;
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const requestId = ++requestIdRef.current;
  const nextState = await readPluginBrowseState(workspaceRoot, selectedHostId, {
    forceRefetchApps: forceRefetchApps ?? false,
  });
  if (requestId !== requestIdRef.current) {
    return null;
  }

  onLoaded(nextState.snapshot);
  onAppsLoaded(nextState.apps);
  onImportedPluginNamesLoaded(nextState.importedPluginNames);
  onConfigWriteTargetLoaded(nextState.writeTarget);
  onError(null);
  return nextState.snapshot;
}

async function readPluginBrowseState(
  workspaceRoot: string | null,
  selectedHostId: string,
  options?: { forceRefetchApps?: boolean },
) {
  const effectiveWorkspaceRoot = selectedHostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null;
  const [pluginsResult, configResult, appsResult, importsResult] = await Promise.allSettled([
    readPluginsSnapshot(effectiveWorkspaceRoot, selectedHostId),
    readConfigForHost({
      hostId: selectedHostId,
      cwd: effectiveWorkspaceRoot,
      includeLayers: true,
    }),
    readAppsSnapshot({
      hostId: selectedHostId,
      forceRefetch: options?.forceRefetchApps ?? false,
    }),
    detectExternalAgentImports({
      hostId: selectedHostId,
      includeHome: true,
      providers: IMPORT_PROVIDER_IDS,
      workspaceRoots: effectiveWorkspaceRoot ? [effectiveWorkspaceRoot] : null,
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
    importedPluginNames:
      importsResult.status === "fulfilled" ? collectImportedPluginNames(importsResult.value.items) : [],
    snapshot: pluginsResult.value,
    writeTarget,
  } satisfies PluginBrowseState;
}

function collectImportedPluginNames(items: ExternalAgentImportItem[]) {
  const names = new Set<string>();
  for (const item of items) {
    for (const migration of item.details?.plugins ?? []) {
      for (const pluginName of migration.pluginNames) {
        const trimmedName = pluginName.trim();
        if (trimmedName.length > 0) {
          names.add(trimmedName);
        }
      }
    }
  }
  return Array.from(names);
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
    if (currentRank < existingRank || (currentRank === existingRank && skill.path.localeCompare(existing.path) < 0)) {
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

function buildInstalledSkillSearchText(skill: SkillSummary) {
  return normalizeText(
    [skill.name, skill.displayName ?? "", skill.description, skill.shortDescription ?? "", skill.path].join(" "),
  );
}

function buildRecommendedSkillSearchText(skill: RecommendedSkill) {
  return normalizeText([skill.id, skill.name, skill.description, skill.shortDescription ?? ""].join(" "));
}

function buildInstalledSkillMatchKeys(skills: SkillSummary[]) {
  const keys = new Set<string>();
  for (const skill of skills) {
    keys.add(normalizeText(skill.name));
    if (skill.displayName) {
      keys.add(normalizeText(skill.displayName));
    }
    const pathBasename = getPathBasename(skill.path);
    if (pathBasename.length > 0) {
      keys.add(normalizeText(pathBasename));
    }
  }
  return keys;
}

function matchesInstalledSkill(installedSkillMatchKeys: Set<string>, skill: RecommendedSkill) {
  return installedSkillMatchKeys.has(normalizeText(skill.id)) || installedSkillMatchKeys.has(normalizeText(skill.name));
}

function buildPluginParams(candidate: PluginCandidate, hostId: string): PluginReadParams {
  return candidate.marketplacePath == null
    ? {
        hostId,
        pluginName: candidate.plugin.name,
        remoteMarketplaceName: candidate.marketplaceName,
      }
    : {
        hostId,
        marketplacePath: candidate.marketplacePath,
        pluginName: candidate.plugin.name,
      };
}

function findPluginCandidateById(snapshot: PluginListSnapshot | null, pluginId: string) {
  return listPluginCandidates(snapshot).find((candidate) => candidate.plugin.id === pluginId) ?? null;
}

function getSkillDisplayName(skill: SkillSummary) {
  return skill.displayName ?? skill.name;
}

function getScopePriority(scope: string) {
  return SCOPE_PRIORITY[normalizeScope(scope)] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
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

function useElementVisibility({
  container,
  target,
}: {
  container: HTMLElement | null;
  target: HTMLElement | null;
}) {
  return useSyncExternalStore(
    (onStoreChange) => subscribeElementVisibility(container, target, onStoreChange),
    () => getElementVisibilitySnapshot(container, target),
    () => true,
  );
}

function subscribeElementVisibility(
  container: HTMLElement | null,
  target: HTMLElement | null,
  onStoreChange: () => void,
) {
  if (container == null || target == null) {
    return noop;
  }

  const handleChange = () => {
    onStoreChange();
  };

  container.addEventListener("scroll", handleChange, { passive: true });
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          handleChange();
        });
  resizeObserver?.observe(container);
  resizeObserver?.observe(target);

  return () => {
    container.removeEventListener("scroll", handleChange);
    resizeObserver?.disconnect();
  };
}

function getElementVisibilitySnapshot(container: HTMLElement | null, target: HTMLElement | null) {
  if (container == null || target == null) {
    return true;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return targetRect.bottom > containerRect.top && targetRect.top < containerRect.bottom;
}

function noop() {}
