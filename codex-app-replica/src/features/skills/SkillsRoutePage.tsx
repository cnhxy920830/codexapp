import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon } from "../../components/AppShellIcons";
import { SettingsChoiceMenu } from "../../components/SettingsChoiceMenu";
import { useI18n } from "../../i18n/i18n";
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
  selectPluginCandidatesByName,
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
  readConfig,
  resolveUserConfigWriteTarget,
  type ConfigWriteTarget,
} from "../../services/settings";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../../services/queryCache";
import {
  getSettingsRemoteHostColor,
  LOCAL_SETTINGS_HOST_ID,
  type RemoteConnection,
} from "../../services/settingsHosts";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import { PluginDetailDialog } from "./components/PluginDetailDialog";
import { PluginsBrowseTab } from "./components/PluginsBrowseTab";

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

type BrowseTab = "plugins" | "skills";

type PluginBrowseState = {
  apps: AppInfo[];
  importedPluginNames: string[];
  snapshot: PluginListSnapshot;
  writeTarget: ConfigWriteTarget | null;
};

type SkillsRoutePageProps = {
  authMethod: string | null;
  codexHome: string | null;
  connectedRemoteConnections: RemoteConnection[];
  initialTab?: BrowseTab;
  isPluginsRouteEnabled: boolean;
  onConsumeInitialState: () => void;
  onOpenChatWithPrompt: (prompt: string) => void;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMarketplaceFilterValue, setSelectedMarketplaceFilterValue] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsLoadError, setSkillsLoadError] = useState<string | null>(null);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
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
  const browseRequestIdRef = useRef(0);
  const [hasOpenedSkillCreatorPrefill, setHasOpenedSkillCreatorPrefill] = useState(() =>
    readStoredBoolean(SKILL_CREATOR_PREFILL_STORAGE_KEY),
  );

  const isSupportedHost = selectedHostId === LOCAL_SETTINGS_HOST_ID;
  const canShowUnifiedPluginsPage = isPluginsRouteEnabled && authMethod !== "apikey" && isSupportedHost;
  const canInstallRecommendedSkills = authMethod === "chatgpt";
  const skillCreatorPath = useMemo(() => {
    if (!codexHome || selectedHostId !== LOCAL_SETTINGS_HOST_ID) {
      return null;
    }

    return `${codexHome}/skills/.system/skill-creator/SKILL.md`;
  }, [codexHome, selectedHostId]);

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
      hostId: selectedHostId,
      onError: setSkillsLoadError,
      onLoaded: setSkills,
      onLoading: setIsSkillsLoading,
      requestIdRef: skillsRequestIdRef,
      workspaceRoot,
    });

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
      selectedHostId,
      workspaceRoot,
    });
  }, [canShowUnifiedPluginsPage, selectedHostId, workspaceRoot]);

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

    void readPlugin(buildPluginParams(activePlugin, selectedHostId))
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
  }, [activePlugin, canShowUnifiedPluginsPage, selectedHostId]);

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

  const allRecommendedCandidates = useMemo(() => {
    if (pluginsSnapshot == null) {
      return [];
    }
    return selectPluginCandidatesByName(pluginsSnapshot, pluginsSnapshot.featuredPluginIds).filter(
      ({ plugin }) => !plugin.installed,
    );
  }, [pluginsSnapshot]);

  const recommendedCandidates = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (query.length === 0) {
      return allRecommendedCandidates;
    }
    return allRecommendedCandidates.filter((candidate) =>
      buildRecommendedPluginSearchText(candidate).includes(query),
    );
  }, [allRecommendedCandidates, searchQuery]);

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
      hostId: selectedHostId,
      onError: setSkillsLoadError,
      onLoaded: setSkills,
      onLoading: setIsSkillsLoading,
      requestIdRef: skillsRequestIdRef,
      workspaceRoot,
    });

  const refreshBrowseData = async (options?: { forceRefetchApps?: boolean }) =>
    refreshBrowseState({
      onAppsLoaded: setApps,
      onConfigWriteTargetLoaded: setConfigWriteTarget,
      onError: setPluginsLoadError,
      onImportedPluginNamesLoaded: setImportedPluginNames,
      onLoaded: setPluginsSnapshot,
      requestIdRef: browseRequestIdRef,
      selectedHostId,
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
      await installPlugin(buildPluginParams(candidate, selectedHostId));
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
        hostId: selectedHostId,
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
      onOpenChatWithPrompt(buildPluginTryInChatPrompt(nextCandidate));
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

    onOpenChatWithPrompt(prompt);
  };

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="flex min-h-full w-full flex-col pb-6">
        {canShowUnifiedPluginsPage ? (
          <>
            <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-6 px-5 pb-8 pt-6">
              <div className="flex justify-end">
                <SkillsRouteHostDropdown
                  connectedRemoteConnections={connectedRemoteConnections}
                  onSelectHost={onSelectHost}
                  remoteConnectionHostIds={remoteConnectionHostIds}
                  selectedHostId={selectedHostId}
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
            <div className="flex flex-nowrap items-center gap-1.5">
              {connectedRemoteConnections.length > 0 && remoteConnectionHostIds.length > 0 ? (
                <SkillsRouteHostDropdown
                  connectedRemoteConnections={connectedRemoteConnections}
                  onSelectHost={onSelectHost}
                  remoteConnectionHostIds={remoteConnectionHostIds}
                  selectedHostId={selectedHostId}
                />
              ) : null}
              <RefreshSkillsButton
                isDisabled={isSkillsLoading}
                isPendingRefresh={false}
                onClick={() => {
                  void refreshSkills(true);
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
              <button
                type="button"
                disabled={skillCreatorPath == null}
                onClick={handleCreateSkill}
                className="app-button-primary flex h-9 shrink-0 items-center justify-center gap-2 rounded-[11px] px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" />
                <span>{t("skills.page.createSkill")}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-panel">
              <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col gap-8">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="heading-xl font-normal text-token-foreground">
                      {t("skills.page.heading")}
                    </div>
                    <div className="text-lg font-normal text-token-description-foreground">
                      {t("skills.page.subheading")}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 w-full flex-1">
                  <div className="flex min-h-0 flex-1 flex-col gap-9 pb-10">
                    <PageSection title={t("skills.section.installed")}>
                      <InstalledSkillsSection
                        getScopeLabel={(skill) => getSkillScopeLabel(skill, workspaceRoots, t)}
                        isLoading={isSkillsLoading}
                        loadError={skillsLoadError}
                        skills={filteredSkills}
                        totalSkills={installedSkills.length}
                        t={t}
                      />
                    </PageSection>

                    <PageSection title={t("skills.section.recommended")}>
                      <RecommendedSkillsSection
                        canInstall={canInstallRecommendedSkills}
                        candidates={recommendedCandidates}
                        installingPluginId={installingPluginId}
                        isLoading={isPluginsLoading}
                        loadError={pluginsLoadError}
                        onInstall={(candidate) => handleInstallPlugin(candidate)}
                        totalCandidates={allRecommendedCandidates.length}
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

function SkillsRouteHostDropdown({
  connectedRemoteConnections,
  onSelectHost,
  remoteConnectionHostIds,
  selectedHostId,
}: {
  connectedRemoteConnections: RemoteConnection[];
  onSelectHost: (hostId: string) => void;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRemoteConnection =
    connectedRemoteConnections.find((remoteConnection) => remoteConnection.hostId === selectedHostId) ?? null;
  const localHostLabel = t("skills.appsPage.hostDropdown.local");
  const selectedHostLabel = selectedRemoteConnection?.displayName ?? localHostLabel;
  const hostOptions = [
    { hostId: LOCAL_SETTINGS_HOST_ID, displayName: localHostLabel },
    ...connectedRemoteConnections.map((remoteConnection) => ({
      displayName: remoteConnection.displayName,
      hostId: remoteConnection.hostId,
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
        aria-label={t("skills.appsPage.hostDropdown.title")}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex h-9 w-auto max-w-[220px] items-center gap-2 rounded-[11px] px-3 text-[13px]"
      >
        {selectedRemoteConnection === null ? (
          <LocalHostIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-text)]" />
        ) : (
          <RemoteHostIcon
            className="h-4 w-4 shrink-0"
            hostId={selectedRemoteConnection.hostId}
            hostIdsForColorAssignment={remoteConnectionHostIds}
          />
        )}
        <span className="truncate text-left text-[var(--app-shell-text)]">{selectedHostLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>

      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[240px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
            {t("skills.appsPage.hostDropdown.title")}
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
                      <LocalHostIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <RemoteHostIcon
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
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={[
        isPendingRefresh ? "app-control" : "app-control-weak",
        "flex h-9 shrink-0 items-center justify-center gap-2 rounded-[11px] px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-60",
      ].join(" ")}
    >
      <RegenerateIcon className="h-4 w-4" />
      <span className="hidden lg:inline">
        {isPendingRefresh ? t("skills.page.refreshSkillsToUseNew") : t("skills.page.refreshSkills")}
      </span>
    </button>
  );
}

function PageSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="px-2 text-[16px] font-medium text-[var(--app-shell-text)]/75">{title}</div>
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] p-4">
        {children}
      </div>
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

function RegenerateIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.50205 16.6664V13.3333C3.50205 12.9661 3.79982 12.6683 4.16709 12.6683H7.5001L7.63389 12.682C7.93696 12.7439 8.16514 13.0119 8.16514 13.3333C8.16514 13.6547 7.93696 13.9227 7.63389 13.9847L7.5001 13.9984H5.47471C6.58687 15.2249 8.21848 16.0013 10.0001 16.0013C13.06 16.0013 15.586 13.711 15.9552 10.7513L15.9854 10.6195C16.0846 10.3266 16.3786 10.1335 16.6974 10.1732C17.0617 10.2186 17.3198 10.551 17.2745 10.9154L17.2247 11.2523C16.6301 14.7051 13.6225 17.3313 10.0001 17.3314C8.01108 17.3314 6.17193 16.5383 4.83213 15.2474V16.6664C4.83213 17.0335 4.53416 17.3312 4.16709 17.3314C3.79982 17.3314 3.50205 17.0336 3.50205 16.6664ZM4.04502 9.24936C3.99941 9.61354 3.66706 9.87179 3.30283 9.82651C2.93839 9.78106 2.67926 9.44877 2.72471 9.08432L4.04502 9.24936ZM10.0001 2.6683C11.994 2.66834 13.8372 3.46552 15.1778 4.76205V3.33334C15.1778 2.96617 15.4757 2.66846 15.8429 2.6683C16.2101 2.6683 16.5079 2.96607 16.5079 3.33334V6.66635C16.5079 7.03362 16.2101 7.33139 15.8429 7.33139H12.5099C12.1426 7.33139 11.8448 7.03362 11.8448 6.66635C11.845 6.29923 12.1427 6.00131 12.5099 6.00131H14.5255C13.4134 4.77489 11.7816 3.99842 10.0001 3.99838C6.94004 3.99838 4.41411 6.28948 4.04502 9.24936L3.38486 9.16635L2.72471 9.08432C3.1758 5.46703 6.26081 2.6683 10.0001 2.6683Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InstalledSkillsSection({
  getScopeLabel,
  isLoading,
  loadError,
  skills,
  totalSkills,
  t,
}: {
  getScopeLabel: (skill: SkillSummary) => string;
  isLoading: boolean;
  loadError: string | null;
  skills: SkillSummary[];
  totalSkills: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (loadError) {
    return <CenteredState description={loadError} title={t("skills.page.refreshFailed")} />;
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
        <article
          key={`${skill.cwd}:${skill.path}`}
          className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[14px] leading-6">{getSkillDisplayName(skill)}</div>
                <ScopeBadge label={getScopeLabel(skill)} />
              </div>
              <div className="app-text-muted mt-1 text-[12px] leading-5">
                {skill.shortDescription ?? skill.description}
              </div>
              <div className="app-text-muted mt-1 truncate text-[11px] leading-5" title={skill.path}>
                {skill.path}
              </div>
            </div>
            <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
              {skill.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecommendedSkillsSection({
  canInstall,
  candidates,
  installingPluginId,
  isLoading,
  loadError,
  onInstall,
  totalCandidates,
  t,
}: {
  canInstall: boolean;
  candidates: PluginCandidate[];
  installingPluginId: string | null;
  isLoading: boolean;
  loadError: string | null;
  onInstall: (candidate: PluginCandidate) => Promise<void>;
  totalCandidates: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (loadError) {
    return <CenteredState description={loadError} title={t("skills.recommended.error")} />;
  }

  if (totalCandidates === 0) {
    return <CenteredState title={t("skills.page.empty")} />;
  }

  if (candidates.length === 0) {
    return (
      <CenteredState
        description={t("skills.page.filteredEmptyDescription")}
        title={t("skills.page.filteredEmpty")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {candidates.map((candidate) => {
        const pluginName = getPluginCandidateDisplayName(candidate);
        const isInstalling = installingPluginId === candidate.plugin.id;

        return (
          <article
            key={candidate.plugin.id}
            className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] leading-6">{pluginName}</div>
                <div className="app-text-muted mt-1 text-[12px] leading-5">
                  {buildRecommendedPluginSearchDescription(candidate)}
                </div>
                <div
                  className="app-text-muted mt-1 truncate text-[11px] leading-5"
                  title={formatMarketplaceLabel(candidate)}
                >
                  {formatMarketplaceLabel(candidate)}
                </div>
              </div>
              <button
                type="button"
                disabled={!canInstall || isInstalling}
                onClick={() => void onInstall(candidate)}
                className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {isInstalling
                  ? t("plugins.installModal.installing", { pluginName })
                  : t("plugins.installModal.install", { pluginName })}
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

function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]">
      {label}
    </span>
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

  try {
    const nextSkills = await readSkillsSnapshot(workspaceRoot, {
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
  const [pluginsResult, configResult, appsResult, importsResult] = await Promise.allSettled([
    readPluginsSnapshot(workspaceRoot, selectedHostId),
    readConfig(workspaceRoot),
    readAppsSnapshot({
      forceRefetch: options?.forceRefetchApps ?? false,
    }),
    detectExternalAgentImports({
      hostId: selectedHostId,
      includeHome: true,
      providers: IMPORT_PROVIDER_IDS,
      workspaceRoots: workspaceRoot ? [workspaceRoot] : null,
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

function buildRecommendedPluginSearchText(candidate: PluginCandidate) {
  return normalizeText(
    [
      candidate.marketplaceName,
      candidate.marketplaceLabel,
      candidate.marketplacePath ?? "",
      candidate.plugin.id,
      candidate.plugin.name,
      candidate.plugin.interface?.displayName ?? "",
      candidate.plugin.interface?.shortDescription ?? "",
      candidate.plugin.interface?.longDescription ?? "",
    ].join(" "),
  );
}

function buildRecommendedPluginSearchDescription(candidate: PluginCandidate) {
  return (
    candidate.plugin.interface?.longDescription ??
    candidate.plugin.interface?.shortDescription ??
    candidate.plugin.name
  );
}

function formatMarketplaceLabel(candidate: PluginCandidate) {
  return candidate.marketplacePath
    ? `${candidate.marketplaceLabel} · ${candidate.marketplacePath}`
    : candidate.marketplaceLabel;
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

function buildCreatorPrefillPrompt({
  creatorPath,
  isFirstOpen,
  kind,
}: {
  creatorPath: string;
  isFirstOpen: boolean;
  kind: "plugin" | "skill";
}) {
  const promptContent =
    kind === "plugin"
      ? { firstUsePrompt: "help me create a plugin", skillName: "plugin-creator" }
      : { firstUsePrompt: "help me create a skill", skillName: "skill-creator" };
  const normalizedCreatorPath = encodeURI(creatorPath.replace(/\\/g, "/"));
  const mention = `[$${promptContent.skillName}](${normalizedCreatorPath})`;
  return isFirstOpen ? `${mention} ${promptContent.firstUsePrompt}` : `${mention} `;
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

function readStoredBoolean(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function writeStoredBoolean(storageKey: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value ? "true" : "false");
  } catch {
    // Ignore persistence failures; the prompt still works for the current session.
  }
}

function LocalHostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M17.6682 13.998H12.6565L11.9641 14.3447C11.8718 14.3909 11.7695 14.415 11.6663 14.415H8.33325C8.23001 14.415 8.12774 14.3909 8.0354 14.3447L7.34302 13.998H2.32837V14.583C2.32837 15.1362 2.77712 15.585 3.33032 15.585H16.6663C17.2195 15.585 17.6682 15.1362 17.6682 14.583V13.998ZM16.8352 6.41699C16.8352 5.93931 16.8347 5.62054 16.8147 5.37598C16.8002 5.19841 16.7766 5.09313 16.7512 5.02246L16.7258 4.96191C16.6538 4.82049 16.5493 4.69891 16.4221 4.60645L16.2883 4.52441C16.2194 4.48931 16.1101 4.45489 15.8733 4.43555C15.6288 4.4156 15.3106 4.41504 14.8333 4.41504H5.16626C4.68886 4.41504 4.37071 4.41559 4.12622 4.43555C3.94903 4.45002 3.84339 4.47277 3.77271 4.49805L3.71216 4.52441C3.57094 4.59637 3.4491 4.70021 3.35669 4.82715L3.27368 4.96191C3.23861 5.03079 3.20513 5.13947 3.18579 5.37598C3.16581 5.62054 3.16528 5.93931 3.16528 6.41699V12.668H7.50024L7.57642 12.6729C7.65302 12.6817 7.72779 12.7036 7.79712 12.7383L8.4895 13.085H11.51L12.2024 12.7383L12.2737 12.708C12.346 12.6819 12.423 12.668 12.5002 12.668H16.8352V6.41699ZM18.1653 12.668H18.3333C18.7003 12.668 18.9981 12.9659 18.9983 13.333V14.583C18.9983 15.8708 17.954 16.915 16.6663 16.915H3.33032C2.04258 16.915 0.998291 15.8708 0.998291 14.583V13.333L1.01196 13.1992C1.07402 12.8962 1.34201 12.668 1.66333 12.668H1.83521V6.41699C1.83521 5.96125 1.83419 5.57886 1.85962 5.26758C1.88569 4.94869 1.94266 4.6459 2.08911 4.3584L2.17896 4.19727C2.40296 3.83215 2.72389 3.53443 3.10767 3.33887L3.21606 3.28809C3.47122 3.17862 3.73854 3.13317 4.01782 3.11035C4.32903 3.08493 4.71068 3.08496 5.16626 3.08496H14.8333C15.2888 3.08496 15.6705 3.08494 15.9817 3.11035C16.3007 3.13642 16.6042 3.19231 16.8918 3.33887L17.052 3.42871C17.4174 3.65275 17.7147 3.97437 17.9104 4.3584L17.9612 4.4668C18.0705 4.72179 18.1171 4.9885 18.1399 5.26758C18.1653 5.57886 18.1653 5.96125 18.1653 6.41699V12.668Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RemoteHostIcon({
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
