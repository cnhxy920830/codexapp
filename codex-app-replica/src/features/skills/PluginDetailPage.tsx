import { useEffect, useMemo, useRef, useState } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyPathIcon,
  LinkExternalIcon,
  MoreActionsIcon,
  NewChatIcon,
  WarningIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { LargeEmptyState } from "../../components/LargeEmptyState";
import { PluginsAppToolsDialog } from "../../components/PluginsAppToolsDialog";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { Tooltip } from "../../components/Tooltip";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import {
  buildPluginTryInChatPrompt,
  listPluginCandidates,
  type PluginCandidate,
} from "../../lib/pluginSelectors";
import {
  readAppTools,
  readAppsSnapshot,
  setAppEnabled,
  type AppInfo,
  type AppTool,
} from "../../services/apps";
import { isAppConnectPending } from "../../services/appConnectOAuth";
import type { ConnectorPersonalizationMode } from "../../services/appConnect";
import { openInBrowser } from "../../services/hostFiles";
import {
  deletePluginShare,
  listPluginShares,
  installPlugin,
  readPlugin,
  readPluginSharePrincipals,
  readPluginsSnapshot,
  savePluginShare,
  searchWorkspaceUsers,
  setPluginEnabled,
  uninstallPlugin,
  updatePluginShareTargets,
  type PluginDetail,
  type PluginReadParams,
  type PluginShareListItem,
  type PluginSharePrincipal,
} from "../../services/plugins";
import {
  parseMcpServers,
  setMcpServerEnabled,
} from "../../services/mcp";
import {
  readConfigForHost,
  resolveUserConfigWriteTarget,
  type ConfigWriteTarget,
} from "../../services/settings";
import { LOCAL_SETTINGS_HOST_ID, normalizeSelectedSettingsHostId, type RemoteConnection } from "../../services/settingsHosts";
import { readSkillsSnapshot, setSkillEnabled, type SkillSummary } from "../../services/skills";
import { SectionedPage, SectionedPageSection, type SectionedPageSection as SectionNavItem } from "../automations/SectionedPage";
import pluginDetailGradient from "../../assets/plugin-detail-gradient-DoN1ti1h.png";
import type { SkillsChatRequest } from "./types";
import { PluginInstallModal } from "./PluginInstallModal";
import { PluginShareDialog } from "./PluginShareDialog";
import {
  parsePluginDetailRoute,
  parsePluginDetailRouteQuery,
  resolvePluginDetailDirectSelection,
  type PluginDetailRouteSource,
} from "./pluginDetailRoute";
import {
  buildPluginInstallParams,
  launchPluginAppConnect,
  readPluginInstallDisclosure,
  readPluginBrowserExtensions,
  readPluginSourcePath,
  resolveInstallBlockedReason,
  type BrowserExtensionState,
  type PluginConnectorDisclosure,
} from "./pluginInstallHelpers";
import {
  closePluginInstallSession,
  connectPluginInstallRequiredApp,
  openPluginInstallSession,
  setPluginInstallIsInstalling,
  setPluginInstallNeedsApps,
  usePluginInstallAutoFinish,
} from "./pluginInstallSession";

const DETAIL_POLL_INTERVAL_MS = 2_000;
const DETAIL_POLL_TIMEOUT_MS = 15_000;

type DataState = "loading" | "error" | "missing" | "ready";

type PluginDetailPageProps = {
  accountId: string | null;
  authMethod: string | null;
  connectedRemoteConnections: RemoteConnection[];
  onNavigate: (path: string, state?: Record<string, unknown> | null) => void;
  onOpenChatWithPrompt: (request: SkillsChatRequest) => void;
  onShowToast: (toast: AppToast) => void;
  selectedHostId: string;
  workspaceRoot: string | null;
};

type ResolvedPluginRouteTarget = {
  directMarketplacePath: string | null;
  directPluginName: string | null;
  directRemoteMarketplaceName: string | null;
  hostId: string;
  pluginId: string | null;
  source: PluginDetailRouteSource | null;
};

type InstalledSkillState = {
  installedSkills: SkillSummary[];
  unavailableSkills: PluginDetail["skills"];
};

type ResolvedMcpServer =
  | {
      kind: "app";
      app: AppInfo;
    }
  | {
      configKey: string | null;
      enabled: boolean;
      installed: boolean;
      kind: "config";
      name: string;
    };

export function PluginDetailPage({
  accountId,
  authMethod,
  connectedRemoteConnections,
  onNavigate,
  onOpenChatWithPrompt,
  onShowToast,
  selectedHostId,
  workspaceRoot,
}: PluginDetailPageProps) {
  const { t } = useI18n();
  const currentPath =
    typeof window === "undefined"
      ? ""
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const currentSearch = typeof window === "undefined" ? "" : window.location.search;
  const routeMatch = parsePluginDetailRoute(currentPath);
  const routeQuery = parsePluginDetailRouteQuery(currentSearch);
  const normalizedSelectedHostId = normalizeSelectedSettingsHostId(
    selectedHostId,
    connectedRemoteConnections,
  );
  const routeTarget = useMemo<ResolvedPluginRouteTarget | null>(() => {
    if (routeMatch == null || routeQuery == null) {
      return null;
    }

    const hostId = normalizeSelectedSettingsHostId(
      routeQuery.hostId ?? normalizedSelectedHostId,
      connectedRemoteConnections,
    );
    const pluginId = routeMatch.pluginId.trim().length > 0 ? routeMatch.pluginId : null;
    const directSelection = resolvePluginDetailDirectSelection({
      explicitMarketplacePath: undefined,
      explicitPluginName: undefined,
      explicitRemoteMarketplaceName: undefined,
      requestedPluginId: pluginId,
      routeQuery,
    });

    return {
      ...directSelection,
      hostId,
      pluginId,
      source: routeQuery.source,
    };
  }, [connectedRemoteConnections, normalizedSelectedHostId, routeMatch, routeQuery]);

  useEffect(() => {
    if (authMethod !== "apikey") {
      return;
    }

    onNavigate("/skills", {
      initialTab: "skills",
      pluginDeepLinkAuthBlocked: true,
    });
  }, [authMethod, onNavigate]);

  const [detail, setDetail] = useState<PluginDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [missingResolvedPluginId, setMissingResolvedPluginId] = useState<string | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [writeTarget, setWriteTarget] = useState<ConfigWriteTarget | null>(null);
  const [mcpConfig, setMcpConfig] = useState<Awaited<ReturnType<typeof readConfigForHost>>["config"] | null>(null);
  const [pluginShare, setPluginShare] = useState<PluginShareListItem | null>(null);
  const [pluginSharePrincipals, setPluginSharePrincipals] = useState<PluginSharePrincipal[] | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const [pendingUninstall, setPendingUninstall] = useState(false);
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);
  const [pendingMcpKey, setPendingMcpKey] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [appToolsError, setAppToolsError] = useState<string | null>(null);
  const [appToolsLoading, setAppToolsLoading] = useState(false);
  const [appTools, setAppTools] = useState<AppTool[]>([]);
  const [browserExtensions, setBrowserExtensions] = useState<BrowserExtensionState[]>([]);
  const [installDisclosureLoading, setInstallDisclosureLoading] = useState(false);
  const [pluginInstallDisclosures, setPluginInstallDisclosures] = useState<PluginConnectorDisclosure[] | null>(null);
  const [pluginInstallPersonalizationModes, setPluginInstallPersonalizationModes] = useState<Record<string, ConnectorPersonalizationMode>>({});
  const [copySucceeded, setCopySucceeded] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const effectiveWorkspaceRoot =
    routeTarget?.hostId === LOCAL_SETTINGS_HOST_ID ? workspaceRoot : null;
  const handlePostInstallReady = ({
    postInstallComposerPrefill,
  }: {
    postInstallComposerPrefill: string | null;
  }) => {
    const prompt = postInstallComposerPrefill?.trim();
    if (prompt == null || prompt.length === 0) {
      return;
    }

    onOpenChatWithPrompt({
      cwd: effectiveWorkspaceRoot ?? undefined,
      prompt,
    });
  };
  const installSessionSnapshot = usePluginInstallAutoFinish({
    apps,
    detail,
    onInstalledReady: handlePostInstallReady,
    onShowToast,
  });

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (routeTarget == null) {
      setDetail(null);
      setDetailError(null);
      setBrowserExtensions([]);
      setInstallDisclosureLoading(false);
      setPluginInstallDisclosures(null);
      setPluginInstallPersonalizationModes({});
      setDataState("missing");
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const load = async () => {
      setDataState("loading");
      setDetailError(null);
      setMissingResolvedPluginId(null);

      const browseSnapshot = await readPluginsSnapshot(
        effectiveWorkspaceRoot,
        routeTarget.hostId,
      ).catch((error) => {
        throw error instanceof Error ? error : new Error(String(error));
      });
      if (cancelled) {
        return;
      }

      const nextCandidates = listPluginCandidates(browseSnapshot);
      const candidate = resolveCandidate(nextCandidates, routeTarget);

      const shouldRetryLookup =
        routeTarget.pluginId != null &&
        candidate == null &&
        routeTarget.directPluginName == null &&
        Date.now() - startedAt < DETAIL_POLL_TIMEOUT_MS;
      if (shouldRetryLookup) {
        window.setTimeout(() => {
          if (!cancelled) {
            void load();
          }
        }, DETAIL_POLL_INTERVAL_MS);
        return;
      }

      if (routeTarget.pluginId != null && candidate == null && routeTarget.directPluginName == null) {
        setMissingResolvedPluginId(routeTarget.pluginId);
        setDetail(null);
        setDataState("missing");
        return;
      }

      const readParams = buildPluginReadParams(routeTarget, candidate);
      if (readParams == null) {
        setDetail(null);
        setDataState("missing");
        return;
      }

      try {
        const [
          pluginResponse,
          appsResponse,
          configResponse,
          skillsResponse,
          shareResponse,
        ] = await Promise.all([
          readPlugin(readParams),
          readAppsSnapshot({
            hostId: routeTarget.hostId,
            forceRefetch: true,
          }),
          readConfigForHost({
            cwd: effectiveWorkspaceRoot,
            hostId: routeTarget.hostId,
            includeLayers: true,
          }),
          readSkillsSnapshot(effectiveWorkspaceRoot, {
            forceReload: true,
            hostId: routeTarget.hostId,
          }),
          listPluginShares({ hostId: routeTarget.hostId }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) {
          return;
        }

        setDetail(pluginResponse.plugin);
        setApps(appsResponse.data);
        setWriteTarget(resolveUserConfigWriteTarget(configResponse));
        setMcpConfig(configResponse.config);
        setSkills(skillsResponse);
        setPluginShare(resolvePluginShare(shareResponse.data, pluginResponse.plugin));
        setPluginSharePrincipals(pluginResponse.plugin.summary.shareContext?.shareTargets ?? null);
        const nextBrowserExtensions = await readPluginBrowserExtensions({
          detail: pluginResponse.plugin,
          hostId: routeTarget.hostId,
        });
        if (cancelled) {
          return;
        }
        setBrowserExtensions(nextBrowserExtensions);
        setDataState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailError(error instanceof Error ? error.message : String(error));
        setBrowserExtensions([]);
        setInstallDisclosureLoading(false);
        setPluginInstallDisclosures(null);
        setPluginInstallPersonalizationModes({});
        setDataState("error");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveWorkspaceRoot, routeTarget]);

  useEffect(() => {
    if (selectedAppId == null || routeTarget == null) {
      setAppTools([]);
      setAppToolsError(null);
      setAppToolsLoading(false);
      return;
    }

    let cancelled = false;
    setAppToolsLoading(true);
    setAppToolsError(null);

    void readAppTools({
      appId: selectedAppId,
      hostId: routeTarget.hostId,
    })
      .then((response) => {
        if (!cancelled) {
          setAppTools(response.tools);
          setAppToolsLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAppTools([]);
          setAppToolsError(error instanceof Error ? error.message : String(error));
          setAppToolsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [routeTarget, selectedAppId]);

  useEffect(() => {
    if (!shareDialogOpen) {
      return;
    }
    const remotePluginId =
      pluginShare?.plugin.shareContext?.remotePluginId ?? pluginShare?.plugin.id ?? null;
    if (remotePluginId == null) {
      return;
    }

    let cancelled = false;
    void readPluginSharePrincipals({
      remotePluginId,
    })
      .then((response) => {
        if (!cancelled) {
          setPluginSharePrincipals(response.principals);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPluginSharePrincipals(detail?.summary.shareContext?.shareTargets ?? null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detail?.summary.shareContext?.shareTargets, pluginShare, shareDialogOpen]);

  const pluginName = detail?.summary.interface?.displayName ?? detail?.summary.name ?? t("plugins.detail.pageTitleFallback");
  const pluginShortDescription =
    detail == null
      ? null
      : detail.summary.interface?.shortDescription ??
        detail.description ??
        detail.summary.interface?.longDescription ??
        detail.summary.name;
  const pluginLongDescription =
    detail == null
      ? null
      : resolvePluginLongDescription(detail);
  const routeBackLabel = routeTarget?.source === "manage" ? t("plugins.detail.breadcrumb.manage") : t("plugins.detail.breadcrumb.root");
  const selectedApp = selectedAppId == null ? null : apps.find((app) => app.id === selectedAppId) ?? null;
  const installedSkillState = useMemo(() => buildInstalledSkillState(detail, skills), [detail, skills]);
  const resolvedMcpServers = useMemo(
    () => buildResolvedMcpServers(apps, mcpConfig, detail?.mcpServers ?? []),
    [apps, detail?.mcpServers, mcpConfig],
  );
  const connectedAccountEmailByAppId = useMemo(() => new Map<string, string>(), []);
  const pluginInformation = useMemo(() => (detail == null ? [] : buildPluginInformation(detail, t)), [detail, t]);
  const installBlockedReason = resolveInstallBlockedReason(detail, apps);
  const isInstallBlocked = installBlockedReason != null;
  const isPromptInstallBlocked = isInstallBlocked;
  const sectionItems = useMemo<SectionNavItem[]>(() => {
    if (detail == null) {
      return [];
    }

    const items: SectionNavItem[] = [];
    if (pluginLongDescription != null) {
      items.push({
        id: "plugin-description",
        title: t("plugins.detail.description"),
      });
    }
    if (detail.summary.installed && browserExtensions.length > 0) {
      items.push({
        id: "plugin-setup",
        title: t("plugins.detail.setup"),
      });
    }
    if (
      detail.apps.length > 0 ||
      resolvedMcpServers.length > 0 ||
      installedSkillState.installedSkills.length > 0 ||
      installedSkillState.unavailableSkills.length > 0
    ) {
      items.push({
        id: "plugin-includes",
        title: t("plugins.detail.includes"),
      });
    }
    if (pluginInformation.length > 0) {
      items.push({
        id: "plugin-information",
        title: t("plugins.detail.information"),
      });
    }
    return items;
  }, [
    browserExtensions.length,
    detail,
    installedSkillState.installedSkills.length,
    installedSkillState.unavailableSkills.length,
    pluginInformation.length,
    pluginLongDescription,
    resolvedMcpServers.length,
    t,
  ]);

  const handleBack = () => {
    const historyIndex =
      typeof window === "undefined"
        ? 0
        : Number(window.history.state?.idx ?? 0);
    if (routeTarget?.source === "manage") {
      onNavigate("/skills", {
        initialHostId: routeTarget.hostId,
        initialMode: "manage",
        initialTab: "plugins",
      });
      return;
    }
    if (historyIndex > 0) {
      window.history.back();
      return;
    }
    onNavigate("/skills", {
      initialHostId: routeTarget?.hostId,
      initialTab: "plugins",
    });
  };

  const refreshCurrentPlugin = async () => {
    if (routeTarget == null) {
      return;
    }
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    onNavigate(path, {
      initialHostId: routeTarget.hostId,
    });
  };

  const handleInstall = (postInstallComposerPrefill: string | null = null) => {
    if (routeTarget == null || detail == null || dataState !== "ready") {
      return;
    }
    if (isInstallBlocked) {
      return;
    }
    void loadInstallDisclosure(detail);
    openPluginInstallSession({
      blockedReason: installBlockedReason,
      includedBrowserExtensions: browserExtensions,
      plugin: detail,
      postInstallComposerPrefill,
    });
  };

  const loadInstallDisclosure = async (plugin: PluginDetail) => {
    if (
      plugin.summary.authPolicy !== "ON_INSTALL" ||
      plugin.apps.length === 0
    ) {
      setInstallDisclosureLoading(false);
      setPluginInstallDisclosures(null);
      setPluginInstallPersonalizationModes({});
      return;
    }

    setInstallDisclosureLoading(true);
    try {
      const disclosures = await readPluginInstallDisclosure(plugin.apps);
      setPluginInstallDisclosures(disclosures);
      setPluginInstallPersonalizationModes((current) => {
        const next: Record<string, ConnectorPersonalizationMode> = {};
        for (const disclosure of disclosures) {
          const toggle = disclosure.personalizationToggle;
          if (toggle == null) {
            continue;
          }
          next[toggle.appId] =
            current[toggle.appId] ??
            (toggle.defaultMode === "PERSONALIZE_ALWAYS"
              ? "PERSONALIZE_ALWAYS"
              : "NO_PERSONALIZATION");
        }
        return next;
      });
    } catch {
      setPluginInstallDisclosures([]);
      setPluginInstallPersonalizationModes({});
    } finally {
      setInstallDisclosureLoading(false);
    }
  };

  const handleEnable = async () => {
    if (routeTarget == null || detail == null) {
      return;
    }

    setPendingEnable(true);
    try {
      await setPluginEnabled({
        enabled: true,
        expectedVersion: writeTarget?.expectedVersion ?? null,
        filePath: writeTarget?.filePath ?? null,
        hostId: routeTarget.hostId,
        pluginId: detail.summary.id,
      });
      await refreshAfterMutation();
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPendingEnable(false);
    }
  };

  const handleTryInChat = async (promptOverride: string | null = null) => {
    if (detail == null) {
      return;
    }

    if (!detail.summary.installed) {
      handleInstall(
        promptOverride ??
          buildPluginTryInChatPrompt({
            marketplaceLabel: detail.marketplaceName,
            marketplaceName: detail.marketplaceName,
            marketplacePath: detail.marketplacePath,
            plugin: detail.summary,
          }),
      );
      return;
    }
    if (!detail.summary.enabled) {
      await handleEnable();
    }

    onOpenChatWithPrompt({
      cwd: effectiveWorkspaceRoot ?? undefined,
      prompt:
        promptOverride ??
        buildPluginTryInChatPrompt({
          marketplaceLabel: detail.marketplaceName,
          marketplaceName: detail.marketplaceName,
          marketplacePath: detail.marketplacePath,
          plugin: detail.summary,
        }),
    });
  };

  const handleCopyLink = async () => {
    if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
      return false;
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopySucceeded(true);
    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopySucceeded(false);
      copyTimeoutRef.current = null;
    }, 2_000);
    return true;
  };

  const handleRemove = async () => {
    if (routeTarget == null || detail == null) {
      return;
    }

    setPendingUninstall(true);
    try {
      await uninstallPlugin({
        hostId: routeTarget.hostId,
        pluginId: detail.summary.id,
      });
      setRemoveOpen(false);
      onNavigate("/skills", {
        initialHostId: routeTarget.hostId,
        initialTab: "plugins",
      });
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPendingUninstall(false);
    }
  };

  const handleToggleAppEnabled = async (enabled: boolean) => {
    if (routeTarget == null || selectedApp == null) {
      return;
    }

    setPendingAppId(selectedApp.id);
    try {
      await setAppEnabled({
        appId: selectedApp.id,
        enabled,
        expectedVersion: writeTarget?.expectedVersion ?? null,
        filePath: writeTarget?.filePath ?? null,
        hostId: routeTarget.hostId,
      });
      await refreshAfterMutation();
    } finally {
      setPendingAppId(null);
    }
  };

  const handleOpenAppUrl = async (url: string | null) => {
    if (url == null) {
      return;
    }
    await openInBrowser(url);
  };

  const performAppConnect = async ({
    appId,
    installUrl,
    mode,
    name,
    resumeTarget,
  }: {
    appId: string;
    installUrl: string | null;
    mode?: ConnectorPersonalizationMode | null;
    name: string;
    resumeTarget: { kind: "apps-tab" | "plugin-install" };
  }) => {
    const response = await launchPluginAppConnect({
      app: {
        appId,
        installUrl,
        name,
      },
      hostId: routeTarget?.hostId ?? LOCAL_SETTINGS_HOST_ID,
      personalizationMode: mode,
      resumeTarget,
      returnTo: `${window.location.pathname}${window.location.search}`,
    });

    if (response?.kind === "connected-directly") {
      onShowToast({
        tone: "success",
        message: t("apps.appConnectOAuthCallbackPage.success", {
          appName: name,
        }),
      });
      await refreshAfterMutation();
      return response;
    }

    if (response?.kind === "failed") {
      throw new Error(t("apps.appConnectOAuthCallbackPage.requestFailed"));
    }

    if (response?.kind === "browser-fallback") {
      await refreshAfterMutation();
    }

    return response;
  };

  const handleConnectRequiredApp = async (appId: string) => {
    if (routeTarget == null) {
      return;
    }

    const app = detail?.apps.find((entry) => entry.id === appId) ?? null;
    if (app == null) {
      return;
    }

    try {
      await performAppConnect({
        appId,
        installUrl: app.installUrl,
        name: app.name,
        resumeTarget: { kind: "apps-tab" },
      });
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleToggleMcpServerEnabled = async (server: ResolvedMcpServer, enabled: boolean) => {
    if (routeTarget == null || server.kind !== "config" || server.configKey == null) {
      return;
    }

    setPendingMcpKey(server.configKey);
    try {
      await setMcpServerEnabled({
        enabled,
        expectedVersion: writeTarget?.expectedVersion ?? null,
        filePath: writeTarget?.filePath ?? null,
        hostId: routeTarget.hostId,
        serverName: server.configKey,
      });
      await refreshAfterMutation();
    } finally {
      setPendingMcpKey(null);
    }
  };

  const handleToggleSkillEnabled = async (skill: SkillSummary, enabled: boolean) => {
    if (routeTarget == null) {
      return;
    }

    await setSkillEnabled({
      enabled,
      hostId: routeTarget.hostId,
      path: skill.path,
    });
    await refreshAfterMutation();
  };

  const handleShare = async () => {
    if (detail == null || readPluginSourcePath(detail) == null) {
      return;
    }
    setShareDialogOpen(true);
  };

  const handleStopSharing = async () => {
    const remotePluginId = pluginShare?.plugin.shareContext?.remotePluginId ?? pluginShare?.plugin.id ?? null;
    if (routeTarget == null || remotePluginId == null) {
      return;
    }

    setShareBusy(true);
    try {
      await deletePluginShare({
        hostId: routeTarget.hostId,
        remotePluginId,
      });
      setPluginShare(null);
      setPluginSharePrincipals(null);
      await refreshAfterMutation();
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setShareBusy(false);
    }
  };

  async function refreshAfterMutation() {
    if (routeTarget == null) {
      return null;
    }

    const [pluginsSnapshot, appsSnapshot, configResponse, skillsSnapshot, sharesResponse] = await Promise.all([
      readPluginsSnapshot(effectiveWorkspaceRoot, routeTarget.hostId),
      readAppsSnapshot({
        hostId: routeTarget.hostId,
        forceRefetch: true,
      }),
      readConfigForHost({
        cwd: effectiveWorkspaceRoot,
        hostId: routeTarget.hostId,
        includeLayers: true,
      }),
      readSkillsSnapshot(effectiveWorkspaceRoot, {
        forceReload: true,
        hostId: routeTarget.hostId,
      }),
      listPluginShares({ hostId: routeTarget.hostId }).catch(() => ({ data: [] })),
    ]);

    setApps(appsSnapshot.data);
    setWriteTarget(resolveUserConfigWriteTarget(configResponse));
    setMcpConfig(configResponse.config);
    setSkills(skillsSnapshot);
    const currentDetail = detail;
    if (currentDetail != null) {
      setPluginShare(resolvePluginShare(sharesResponse.data, currentDetail));
    }
    const readParams = buildPluginReadParams(routeTarget, resolveCandidate(listPluginCandidates(pluginsSnapshot), routeTarget));
    if (readParams != null) {
      const pluginResponse = await readPlugin(readParams);
      setDetail(pluginResponse.plugin);
      setPluginSharePrincipals(pluginResponse.plugin.summary.shareContext?.shareTargets ?? null);
      setBrowserExtensions(
        await readPluginBrowserExtensions({
          detail: pluginResponse.plugin,
          hostId: routeTarget.hostId,
        }),
      );
      setDataState("ready");
      setDetailError(null);
      return pluginResponse.plugin;
    }
    return null;
  }

  const performInstallFromSession = async () => {
    if (routeTarget == null || detail == null) {
      return;
    }

    const snapshot = installSessionSnapshot.session;
    if (snapshot.kind !== "details") {
      return;
    }

    const installParams = buildPluginInstallParams(detail, routeTarget.hostId);
    if (installParams == null) {
      return;
    }

    setPluginInstallIsInstalling(true);
    try {
      const response = await installPlugin(installParams);
      const refreshedPlugin = (await refreshAfterMutation()) ?? detail;
      const requiredBrowserExtensions = await readPluginBrowserExtensions({
        detail: refreshedPlugin,
        hostId: routeTarget.hostId,
      });
      const requiredApps = response.appsNeedingAuth.map((app) => ({
        appId: app.id,
        description: app.description,
        installUrl: app.installUrl,
        logoUrl:
          apps.find((availableApp) => availableApp.id === app.id)?.logoUrl ??
          apps.find((availableApp) => availableApp.id === app.id)?.logoUrlDark ??
          null,
        name: app.name,
        status: "pending" as const,
      }));

      if (
        response.authPolicy === "ON_USE" ||
        (requiredApps.length === 0 && requiredBrowserExtensions.length === 0)
      ) {
        closePluginInstallSession();
        onShowToast({
          tone: "success",
          message: t("plugins.install.success", {
            pluginName:
              refreshedPlugin.summary.interface?.displayName ??
              refreshedPlugin.summary.name,
          }),
        });
        handlePostInstallReady({
          postInstallComposerPrefill: snapshot.postInstallComposerPrefill,
        });
        return;
      }

      setPluginInstallNeedsApps({
        blockedReason: resolveInstallBlockedReason(refreshedPlugin, apps),
        plugin: refreshedPlugin,
        postInstallComposerPrefill: snapshot.postInstallComposerPrefill,
        requiredApps,
        requiredBrowserExtensions,
      });

      if (
        response.authPolicy === "ON_INSTALL" &&
        requiredApps.length === 1 &&
        requiredBrowserExtensions.length === 0
      ) {
        const [requiredApp] = requiredApps;
        await connectPluginInstallRequiredApp({
          appId: requiredApp.appId,
          hostId: routeTarget.hostId,
          onConnected: refreshAfterMutation,
          onDirectlyConnected: (appName) => {
            onShowToast({
              tone: "success",
              message: t("apps.appConnectOAuthCallbackPage.success", {
                appName,
              }),
            });
          },
          personalizationMode:
            pluginInstallPersonalizationModes[requiredApp.appId] ??
            "NO_PERSONALIZATION",
        });
      }
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      setPluginInstallIsInstalling(false);
    }
  };

  const headerActions =
    dataState === "ready" && detail != null ? (
      <PluginDetailHeaderActions
        blockedReason={installBlockedReason}
        copyLabel={copySucceeded ? t("plugins.detail.copiedLink") : t("plugins.detail.copyLink")}
        isInstallBlocked={isInstallBlocked}
        isInstalling={installSessionSnapshot.isInstalling}
        isShareBusy={shareBusy}
        isUninstalling={pendingUninstall}
        isUpdatingEnabled={pendingEnable}
        onCopyLink={() => {
          void handleCopyLink();
        }}
        onEnable={() => {
          void handleEnable();
        }}
        onInstall={() => {
          handleInstall();
        }}
        onRemove={() => setRemoveOpen(true)}
        onShare={readPluginSourcePath(detail) == null ? null : () => {
          void handleShare();
        }}
        onStopSharing={pluginShare == null ? null : () => {
          void handleStopSharing();
        }}
        onTryInChat={() => {
          void handleTryInChat(buildPluginTryInChatPrompt({
            marketplaceLabel: detail.marketplaceName,
            marketplaceName: detail.marketplaceName,
            marketplacePath: detail.marketplacePath,
            plugin: detail.summary,
          }));
        }}
        plugin={detail}
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col text-base">
      <header className="border-b border-[var(--app-shell-border)] px-4">
        <div className="draggable grid min-h-[var(--app-shell-toolbar)] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2">
          <div className="flex min-w-0 items-center gap-1 text-[13px] text-token-description-foreground">
            <Button color="ghost" size="toolbar" onClick={handleBack}>
              {routeBackLabel}
            </Button>
            <ArrowLeftIcon className="h-3.5 w-3.5 rotate-180" />
            <span className="truncate text-token-foreground">{pluginName}</span>
          </div>
          {headerActions ? <div className="flex items-center justify-end">{headerActions}</div> : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {dataState === "loading" ? (
          <CenteredState title={t("skills.page.loading")} />
        ) : dataState === "error" ? (
          <CenteredState description={detailError} title={t("plugins.detail.errorTitle")} />
        ) : dataState === "missing" ? (
          <CenteredState
            description={
              missingResolvedPluginId != null
                ? t("plugins.detail.missingFromCurrentMarketplaces")
                : t("plugins.detail.missingDescription")
            }
            title={t("plugins.detail.missing")}
          />
        ) : detail == null ? null : (
          <SectionedPage
            ariaLabel={t("plugins.detail.sectionsNav")}
            className="px-6 py-5"
            contentInnerClassName="flex min-h-full flex-col gap-8"
            disableScrollFade
            sections={sectionItems}
            showNav={false}
          >
            <section className="flex flex-col gap-8">
              <div className="flex min-w-0 flex-col gap-5">
                <div className="flex min-w-0 items-start gap-4">
                  <ReadyStateIcon label={pluginName} logoUrl={detail.summary.interface?.logoUrl ?? detail.summary.interface?.logo ?? null} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[22px] font-medium tracking-[-0.03em] break-words text-token-foreground">
                      {pluginName}
                    </div>
                    {pluginShortDescription ? (
                      <div className="mt-1 text-[15px] leading-6 text-token-text-secondary">
                        {pluginShortDescription}
                      </div>
                    ) : null}
                  </div>
                </div>
                {detail.summary.interface?.defaultPrompt?.map((prompt, index) => prompt.trim()).filter((prompt) => prompt.length > 0).map((prompt, index) => (
                  <div
                    key={`${prompt}-${index}`}
                    className="relative flex justify-center overflow-hidden rounded-[20px] px-4 py-12 shadow-[inset_0_0_0_1px_var(--color-token-border-default)] sm:px-8"
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      src={pluginDetailGradient}
                    />
                    <div className="absolute inset-0 bg-token-bg-primary/70" />
                    <div className="relative flex w-full max-w-[640px] justify-center">
                      <Tooltip
                        disabled={!isPromptInstallBlocked}
                        tooltipContent={
                          installBlockedReason === "connector-unavailable"
                            ? t("plugins.install.connectorUnavailable")
                            : t("plugins.install.disabledByAdmin")
                        }
                      >
                        <div>
                          <button
                            type="button"
                            aria-disabled={isPromptInstallBlocked}
                            className={[
                              "max-w-[77%] rounded-[18px] bg-token-bg-primary/75 p-2 break-words shadow-[0_0_0_1px_var(--color-token-border-default)] [&_.contain-inline-size]:[contain:initial]",
                              isPromptInstallBlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                            ].join(" ")}
                            disabled={pendingEnable || pendingUninstall || isPromptInstallBlocked}
                            onClick={() => {
                              void handleTryInChat(prompt);
                            }}
                          >
                            <div className="break-words [&_.contain-inline-size]:[contain:initial]">
                              {prompt}
                            </div>
                          </button>
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                ))}
                {pluginLongDescription != null ? (
                  <SectionedPageSection id="plugin-description" title={t("plugins.detail.description")}>
                    <div className="max-w-4xl text-[14px] leading-6 text-token-foreground">
                      {pluginLongDescription}
                    </div>
                  </SectionedPageSection>
                ) : null}
              </div>

              {detail.summary.installed && browserExtensions.length > 0 ? (
                <SectionedPageSection id="plugin-setup" title={t("plugins.detail.setup")}>
                  <div className="grid gap-3">
                    {browserExtensions.map((extension) => (
                      <IncludedItem
                        key={extension.id}
                        description={t("plugins.installModal.browserExtension.description")}
                        icon={<ReadyStateIcon label={extension.name} logoUrl={extension.iconUrl} />}
                        title={extension.name}
                        control={
                          <Button
                            color="secondary"
                            size="toolbar"
                            onClick={() => void openInBrowser(extension.installUrl)}
                          >
                            {t("plugins.detail.setup.openBrowserExtension")}
                          </Button>
                        }
                      />
                    ))}
                  </div>
                </SectionedPageSection>
              ) : null}

              {detail.apps.length > 0 ||
              resolvedMcpServers.length > 0 ||
              installedSkillState.installedSkills.length > 0 ||
              installedSkillState.unavailableSkills.length > 0 ? (
                <SectionedPageSection id="plugin-includes" title={t("plugins.detail.includes")}>
                  <div className="grid gap-3">
                    {detail.apps.map((app) => {
                      const connectedApp = apps.find((entry) => entry.id === app.id) ?? null;
                      const isPendingConnect = isAppConnectPending(app.id);
                      const blockedByAdmin = resolveAppBlockedReason(app.id, detail) === "disabled-by-admin";

                      return (
                        <IncludedItem
                          key={`app-${app.id}`}
                          badges={[t("plugins.detail.includes.appBadge")]}
                          description={app.description ?? connectedApp?.description ?? null}
                          dimmed={blockedByAdmin}
                          icon={<ReadyStateIcon label={app.name} logoUrl={connectedApp?.logoUrl ?? connectedApp?.logoUrlDark ?? null} />}
                          secondaryLabel={blockedByAdmin ? t("plugins.detail.includes.disabledByAdminBadge") : connectedAccountEmailByAppId.get(app.id) ?? null}
                          title={app.name}
                          control={
                            <div className="flex items-center gap-2">
                              {connectedApp != null && connectedApp.isAccessible ? (
                                <>
                                  <Button
                                    color="ghost"
                                    size="toolbar"
                                    onClick={() => setSelectedAppId(app.id)}
                                  >
                                    {t("skills.appsPage.toolsDialog.open")}
                                  </Button>
                                  <Tooltip
                                    tooltipContent={
                                      connectedApp.isEnabled
                                        ? t("skills.appsPage.toolsDialog.disableApp")
                                        : t("skills.appsPage.toolsDialog.enableApp")
                                    }
                                  >
                                    <div>
                                      <ToggleSwitch
                                        ariaLabel={
                                          connectedApp.isEnabled
                                            ? t("skills.appsPage.toolsDialog.disableApp")
                                            : t("skills.appsPage.toolsDialog.enableApp")
                                        }
                                        checked={connectedApp.isEnabled}
                                        disabled={pendingAppId === app.id}
                                        onChange={(enabled) => {
                                          if (selectedAppId !== app.id) {
                                            setSelectedAppId(app.id);
                                          }
                                          void setAppEnabled({
                                            appId: app.id,
                                            enabled,
                                            expectedVersion: writeTarget?.expectedVersion ?? null,
                                            filePath: writeTarget?.filePath ?? null,
                                            hostId: routeTarget?.hostId ?? null,
                                          }).then(() => refreshAfterMutation());
                                        }}
                                      />
                                    </div>
                                  </Tooltip>
                                </>
                              ) : (
                                <Button
                                  color="secondary"
                                  size="toolbar"
                                  disabled={app.installUrl == null || isPendingConnect}
                                  onClick={() => {
                                    void handleConnectRequiredApp(app.id);
                                  }}
                                >
                                  {isPendingConnect
                                    ? t("plugins.installModal.requiredApps.connecting")
                                    : t("plugins.installModal.requiredApps.connect")}
                                </Button>
                              )}
                            </div>
                          }
                        />
                      );
                    })}
                    {resolvedMcpServers.map((server) => (
                      <IncludedItem
                        key={server.kind === "app" ? `mcp-app-${server.app.id}` : `mcp-config-${server.name}`}
                        badges={[t("plugins.detail.includes.mcpServerBadge")]}
                        description={server.kind === "app" ? server.app.description : null}
                        dimmed={server.kind === "config" && server.installed && !server.enabled}
                        icon={<ReadyStateIcon label={server.kind === "app" ? server.app.name : server.name} logoUrl={server.kind === "app" ? server.app.logoUrl ?? server.app.logoUrlDark ?? null : null} />}
                        title={server.kind === "app" ? server.app.name : capitalizeLabel(server.name)}
                        control={
                          server.kind === "app" ? (
                            <div className="flex items-center gap-2">
                              <Button
                                color="ghost"
                                size="toolbar"
                                onClick={() => setSelectedAppId(server.app.id)}
                              >
                                {t("skills.appsPage.toolsDialog.open")}
                              </Button>
                              {detail.summary.installed ? (
                                <Tooltip
                                  tooltipContent={
                                    server.app.isEnabled
                                      ? t("skills.appsPage.toolsDialog.disableApp")
                                      : t("skills.appsPage.toolsDialog.enableApp")
                                  }
                                >
                                  <div>
                                    <ToggleSwitch
                                      ariaLabel={
                                        server.app.isEnabled
                                          ? t("skills.appsPage.toolsDialog.disableApp")
                                          : t("skills.appsPage.toolsDialog.enableApp")
                                      }
                                      checked={server.app.isEnabled}
                                      disabled={pendingAppId === server.app.id}
                                      onChange={(enabled) => {
                                        setPendingAppId(server.app.id);
                                        void setAppEnabled({
                                          appId: server.app.id,
                                          enabled,
                                          expectedVersion: writeTarget?.expectedVersion ?? null,
                                          filePath: writeTarget?.filePath ?? null,
                                          hostId: routeTarget?.hostId ?? null,
                                        })
                                          .then(() => refreshAfterMutation())
                                          .finally(() => setPendingAppId(null));
                                      }}
                                    />
                                  </div>
                                </Tooltip>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Tooltip
                                tooltipContent={
                                  server.installed
                                    ? t("plugins.detail.mcp.settings")
                                    : t("plugins.detail.mcp.setup")
                                }
                              >
                                <Button
                                  aria-label={
                                    server.installed
                                      ? t("plugins.detail.mcp.settings")
                                      : t("plugins.detail.mcp.setup")
                                  }
                                  color="ghost"
                                  size="icon"
                                  uniform
                                  onClick={() => {
                                    onNavigate("/settings/mcp-settings");
                                  }}
                                >
                                  <LinkExternalIcon className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              {server.installed ? (
                                <Tooltip
                                  tooltipContent={
                                    server.enabled
                                      ? t("plugins.detail.mcp.disable")
                                      : t("plugins.detail.mcp.enable")
                                  }
                                >
                                  <div>
                                    <ToggleSwitch
                                      ariaLabel={t("plugins.detail.mcp.toggleAria")}
                                      checked={server.enabled}
                                      disabled={pendingMcpKey === server.configKey || server.configKey == null}
                                      onChange={(enabled) => {
                                        void handleToggleMcpServerEnabled(server, enabled);
                                      }}
                                    />
                                  </div>
                                </Tooltip>
                              ) : null}
                            </div>
                          )
                        }
                      />
                    ))}
                    {installedSkillState.installedSkills.map((skill) => (
                      <IncludedItem
                        key={`skill-${skill.path}`}
                        badges={[t("plugins.detail.includes.skillBadge")]}
                        description={skill.shortDescription ?? skill.description}
                        icon={<ReadyStateIcon label={skill.displayName ?? skill.name} logoUrl={null} />}
                        title={skill.displayName ?? skill.name}
                        control={
                          <Tooltip
                            tooltipContent={
                              skill.enabled
                                ? t("settings.pluginControls.disableToggleTooltip")
                                : t("settings.pluginControls.enableToggleTooltip")
                            }
                          >
                            <div>
                              <ToggleSwitch
                                ariaLabel={t("settings.pluginControls.toggleAria")}
                                checked={skill.enabled}
                                disabled={false}
                                onChange={(enabled) => {
                                  void handleToggleSkillEnabled(skill, enabled);
                                }}
                              />
                            </div>
                          </Tooltip>
                        }
                      />
                    ))}
                    {installedSkillState.unavailableSkills.map((skill) => (
                      <IncludedItem
                        key={`unavailable-skill-${skill.name}`}
                        badges={[t("plugins.detail.includes.skillBadge")]}
                        description={skill.shortDescription ?? skill.description}
                        dimmed
                        icon={<ReadyStateIcon label={skill.interface?.displayName ?? skill.name} logoUrl={null} />}
                        title={skill.interface?.displayName ?? skill.name}
                      />
                    ))}
                  </div>
                </SectionedPageSection>
              ) : null}

              {pluginInformation.length > 0 ? (
                <SectionedPageSection id="plugin-information" title={t("plugins.detail.information")}>
                  <div className="grid gap-3">
                    {pluginInformation.map((entry) => (
                      <IncludedItem
                        key={entry.key}
                        description={entry.label}
                        title={entry.value}
                      />
                    ))}
                  </div>
                </SectionedPageSection>
              ) : null}
            </section>
          </SectionedPage>
        )}
      </div>

      <PluginsAppToolsDialog
        app={selectedApp}
        errorMessage={appToolsError}
        isLoading={appToolsLoading}
        onOpenAppUrl={handleOpenAppUrl}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppId(null);
          }
        }}
        onSetAppEnabled={(enabled) => {
          void handleToggleAppEnabled(enabled);
        }}
        onTryInChat={
          selectedApp == null
            ? undefined
            : () => {
                onOpenChatWithPrompt({
                  cwd: effectiveWorkspaceRoot ?? undefined,
                  prompt: `[@${selectedApp.name}](app://${selectedApp.id})`,
                });
              }
        }
        showEnableToggle={detail?.summary.installed === true}
        tools={appTools}
        updatingAppId={pendingAppId}
      />

      <PluginInstallModal
        appPersonalizationModes={pluginInstallPersonalizationModes}
        connectorDisclosures={pluginInstallDisclosures}
        isInstalling={installSessionSnapshot.isInstalling}
        isLoadingDisclosure={installDisclosureLoading}
        onAppPersonalizationModeChange={(appId, mode) => {
          setPluginInstallPersonalizationModes((current) => ({
            ...current,
            [appId]: mode,
          }));
        }}
        onClose={() => closePluginInstallSession()}
        onConnectRequiredApp={(appId) => {
          void connectPluginInstallRequiredApp({
            appId,
            hostId: routeTarget?.hostId ?? LOCAL_SETTINGS_HOST_ID,
            onConnected: refreshAfterMutation,
            onDirectlyConnected: (appName) => {
              onShowToast({
                tone: "success",
                message: t("apps.appConnectOAuthCallbackPage.success", {
                  appName,
                }),
              });
            },
            personalizationMode:
              pluginInstallPersonalizationModes[appId] ?? "NO_PERSONALIZATION",
          });
        }}
        onInstall={() => {
          void performInstallFromSession();
        }}
        session={installSessionSnapshot.session}
      />

      {removeOpen && detail != null ? (
        <RemovePluginDialog
          isRemoving={pendingUninstall}
          pluginDisplayName={pluginName}
          onClose={() => setRemoveOpen(false)}
          onConfirm={() => {
            void handleRemove();
          }}
        />
      ) : null}

      {shareDialogOpen && detail != null ? (
        <PluginShareDialog
          accountId={accountId}
          initialPrincipals={pluginSharePrincipals ?? detail.summary.shareContext?.shareTargets ?? []}
          isSaving={shareBusy}
          pluginDisplayName={pluginName}
          onClose={() => setShareDialogOpen(false)}
          onCopyLink={async () => {
            if (routeTarget == null) {
              return false;
            }
            const pluginPath = readPluginSourcePath(detail);
            if (pluginPath == null) {
              return false;
            }
            setShareBusy(true);
            try {
              const response =
                pluginShare?.shareUrl != null
                  ? {
                      remotePluginId:
                        pluginShare.plugin.shareContext?.remotePluginId ??
                        pluginShare.plugin.id,
                      shareUrl: pluginShare.shareUrl,
                    }
                  : await savePluginShare({
                      hostId: routeTarget.hostId,
                      pluginPath,
                      remotePluginId:
                        pluginShare?.plugin.shareContext?.remotePluginId ?? null,
                    });
              setPluginShare({
                localPluginPath: pluginPath,
                plugin: {
                  ...detail.summary,
                  shareContext: {
                    remotePluginId: response.remotePluginId,
                    shareUrl: response.shareUrl,
                    creatorAccountUserId:
                      pluginShare?.plugin.shareContext?.creatorAccountUserId ??
                      detail.summary.shareContext?.creatorAccountUserId ??
                      null,
                    creatorName:
                      pluginShare?.plugin.shareContext?.creatorName ??
                      detail.summary.shareContext?.creatorName ??
                      null,
                    shareTargets: pluginSharePrincipals ?? detail.summary.shareContext?.shareTargets ?? null,
                  },
                },
                shareUrl: response.shareUrl,
              });
              if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
                return false;
              }
              await navigator.clipboard.writeText(response.shareUrl);
              return true;
            } catch {
              return false;
            } finally {
              setShareBusy(false);
            }
          }}
          onSaveTargets={async (targets) => {
            if (routeTarget == null) {
              return [];
            }
            const pluginPath = readPluginSourcePath(detail);
            if (pluginPath == null) {
              return [];
            }
            setShareBusy(true);
            try {
              const remotePluginId =
                pluginShare?.plugin.shareContext?.remotePluginId ??
                pluginShare?.plugin.id ??
                (
                  await savePluginShare({
                    hostId: routeTarget.hostId,
                    pluginPath,
                    remotePluginId: null,
                  })
                ).remotePluginId;
              const response = await updatePluginShareTargets({
                remotePluginId,
                targets,
              });
              setPluginSharePrincipals(response.principals);
              setPluginShare((current) => {
                if (current == null) {
                  return current;
                }
                return {
                  ...current,
                  plugin: {
                    ...current.plugin,
                    shareContext: current.plugin.shareContext == null
                      ? {
                          remotePluginId,
                          shareUrl: current.shareUrl,
                          creatorAccountUserId: null,
                          creatorName: null,
                          shareTargets: response.principals,
                        }
                      : {
                          ...current.plugin.shareContext,
                          remotePluginId,
                          shareTargets: response.principals,
                        },
                  },
                };
              });
              await refreshAfterMutation();
              return response.principals;
            } catch (error) {
              onShowToast({
                tone: "error",
                message: error instanceof Error ? error.message : String(error),
              });
              throw error;
            } finally {
              setShareBusy(false);
            }
          }}
          onSearchWorkspaceUsers={async (query) => {
            if (accountId == null || authMethod !== "chatgpt") {
              return [];
            }
            const response = await searchWorkspaceUsers({
              accountId,
              query,
            });
            return response.items;
          }}
        />
      ) : null}
    </div>
  );
}

function PluginDetailHeaderActions({
  blockedReason,
  copyLabel,
  isInstallBlocked,
  isInstalling,
  isShareBusy,
  isUninstalling,
  isUpdatingEnabled,
  onCopyLink,
  onEnable,
  onInstall,
  onRemove,
  onShare,
  onStopSharing,
  onTryInChat,
  placement = "header",
  plugin,
}: {
  blockedReason: "connector-unavailable" | "disabled-by-admin" | null;
  copyLabel: string;
  isInstallBlocked: boolean;
  isInstalling: boolean;
  isShareBusy: boolean;
  isUninstalling: boolean;
  isUpdatingEnabled: boolean;
  onCopyLink?: (() => void) | null;
  onEnable: () => void;
  onInstall: () => void;
  onRemove: () => void;
  onShare?: (() => void) | null;
  onStopSharing?: (() => void) | null;
  onTryInChat: () => void;
  placement?: "content" | "header";
  plugin: PluginDetail;
}) {
  const { t } = useI18n();
  const isContentPlacement = placement === "content";

  if (!plugin.summary.installed) {
    const action = (
      <Button
        color="primary"
        disabled={isInstallBlocked}
        loading={isInstalling}
        size="toolbar"
        className={isContentPlacement ? "w-full justify-center" : undefined}
        onClick={onInstall}
      >
        {blockedReason === "disabled-by-admin" ? (
          <WarningIcon className="h-4 w-4" />
        ) : null}
        {isInstalling
          ? t("plugins.detail.addingToCodex")
          : blockedReason === "disabled-by-admin"
            ? t("plugins.detail.disabledByAdminButton")
            : t("plugins.detail.addToCodex")}
      </Button>
    );

    return (
      <div className={isContentPlacement ? "flex w-full items-center gap-2" : "flex items-center gap-2"}>
        {onShare ? (
          <Button color="secondary" disabled={isShareBusy} size="toolbar" onClick={onShare}>
            {t("plugins.detail.share")}
          </Button>
        ) : null}
        {onCopyLink ? (
          <Tooltip tooltipContent={copyLabel}>
            <Button aria-label={copyLabel} color="ghost" size="icon" uniform onClick={onCopyLink}>
              <CopyPathIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        ) : null}
        {blockedReason === "connector-unavailable" ? (
          <Tooltip tooltipContent={t("plugins.install.connectorUnavailable")}>
            <div className={isContentPlacement ? "w-full" : undefined}>{action}</div>
          </Tooltip>
        ) : action}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PluginDetailMoreActions
        disabled={isUpdatingEnabled || isUninstalling}
        onRemove={onRemove}
        onStopSharing={onStopSharing}
      />
      {onShare ? (
        <Button color="secondary" disabled={isShareBusy} size="toolbar" onClick={onShare}>
          {t("plugins.detail.share")}
        </Button>
      ) : null}
      {onCopyLink ? (
        <Tooltip tooltipContent={copyLabel}>
          <Button aria-label={copyLabel} color="ghost" size="icon" uniform onClick={onCopyLink}>
            {copyLabel === t("plugins.detail.copiedLink") ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyPathIcon className="h-4 w-4" />
            )}
          </Button>
        </Tooltip>
      ) : null}
      <Button
        color="primary"
        disabled={isUninstalling}
        loading={isUpdatingEnabled}
        size="toolbar"
        className={isContentPlacement ? "w-full justify-center" : undefined}
        onClick={plugin.summary.enabled ? onTryInChat : onEnable}
      >
        {plugin.summary.enabled ? <NewChatIcon className="h-4 w-4" /> : null}
        {plugin.summary.enabled ? t("plugins.detail.tryInCodex") : t("plugins.detail.enableInCodex")}
      </Button>
    </div>
  );
}

function PluginDetailMoreActions({
  disabled,
  onRemove,
  onStopSharing,
}: {
  disabled: boolean;
  onRemove: () => void;
  onStopSharing?: (() => void) | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest("[data-plugin-detail-more-actions='true']")) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  return (
    <div className="relative" data-plugin-detail-more-actions="true">
      <Button
        aria-label={t("plugins.detail.moreActions")}
        color="ghost"
        size="icon"
        uniform
        onClick={() => setOpen((current) => !current)}
      >
        <MoreActionsIcon className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[220px] rounded-[14px] border border-token-border bg-token-bg-primary p-2 shadow-[0_16px_32px_rgba(0,0,0,0.18)]">
          {onStopSharing ? (
            <button
              type="button"
              className="app-nav-item-idle w-full rounded-[10px] px-3 py-2 text-left text-[13px]"
              onClick={() => {
                setOpen(false);
                onStopSharing();
              }}
            >
              {t("plugins.detail.stopSharing")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            className="app-nav-item-idle w-full rounded-[10px] px-3 py-2 text-left text-[13px] text-token-error-foreground disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            {t("plugins.detail.uninstall")}
          </button>
        </div>
      ) : null}
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
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <LargeEmptyState
        title={<span className="text-[14px] leading-6">{title}</span>}
        description={
          description ? <span className="text-[12px] leading-5 text-token-text-secondary">{description}</span> : null
        }
      />
    </div>
  );
}

function CompactEmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-[14px] border border-token-border bg-token-bg-primary/30 px-4 py-3 text-[13px] text-token-text-secondary">
      {title}
    </div>
  );
}

function ReadyStateIcon({
  label,
  logoUrl,
}: {
  label: string;
  logoUrl: string | null;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  if (logoUrl == null || hasImageError) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-token-border bg-token-bg-primary text-xs font-medium text-token-foreground shadow-sm">
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-token-border bg-token-bg-primary shadow-sm">
      <img
        alt={label}
        className="h-full w-full object-contain"
        src={logoUrl}
        onError={() => setHasImageError(true)}
      />
    </span>
  );
}

function RemovePluginDialog({
  isRemoving,
  onClose,
  onConfirm,
  pluginDisplayName,
}: {
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pluginDisplayName: string;
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-label={t("plugins.detail.removeDialog.title", { name: pluginDisplayName })}
        aria-modal="true"
        className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        role="dialog"
      >
        <div className="text-[15px] font-medium">
          {t("plugins.detail.removeDialog.title", { name: pluginDisplayName })}
        </div>
        <div className="app-text-muted mt-2 text-[13px] leading-6">
          {t("plugins.detail.removeDialog.description")}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button color="outline" disabled={isRemoving} onClick={onClose}>
            {t("plugins.detail.removeDialog.cancel")}
          </Button>
          <Button color="danger" disabled={isRemoving} loading={isRemoving} onClick={onConfirm}>
            {t("plugins.detail.removeDialog.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildPluginReadParams(
  routeTarget: ResolvedPluginRouteTarget,
  candidate: PluginCandidate | null,
): PluginReadParams | null {
  const pluginName = routeTarget.directPluginName ?? candidate?.plugin.name ?? null;
  if (pluginName == null) {
    return null;
  }

  if (routeTarget.directMarketplacePath != null || candidate?.marketplacePath != null) {
    return {
      hostId: routeTarget.hostId,
      marketplacePath: routeTarget.directMarketplacePath ?? candidate?.marketplacePath ?? null,
      pluginName,
    };
  }

  const remoteMarketplaceName =
    routeTarget.directRemoteMarketplaceName ?? candidate?.marketplaceName ?? null;
  if (remoteMarketplaceName == null) {
    return null;
  }

  return {
    hostId: routeTarget.hostId,
    pluginName,
    remoteMarketplaceName,
  };
}

function resolveCandidate(
  candidates: PluginCandidate[],
  routeTarget: ResolvedPluginRouteTarget,
) {
  if (routeTarget.pluginId != null) {
    const byId = candidates.find((candidate) => candidate.plugin.id === routeTarget.pluginId);
    if (byId != null) {
      return byId;
    }
  }

  return candidates.find((candidate) => {
    if (routeTarget.directPluginName != null && candidate.plugin.name !== routeTarget.directPluginName) {
      return false;
    }
    if (
      routeTarget.directMarketplacePath != null &&
      candidate.marketplacePath !== routeTarget.directMarketplacePath
    ) {
      return false;
    }
    if (
      routeTarget.directRemoteMarketplaceName != null &&
      routeTarget.directMarketplacePath == null &&
      candidate.marketplaceName !== routeTarget.directRemoteMarketplaceName
    ) {
      return false;
    }
    return true;
  }) ?? null;
}

function resolvePluginShare(shares: PluginShareListItem[], detail: PluginDetail) {
  const remotePluginId = detail.summary.shareContext?.remotePluginId ?? null;
  if (remotePluginId != null) {
    const byRemoteId = shares.find(
      (share) => share.plugin.shareContext?.remotePluginId === remotePluginId,
    );
    if (byRemoteId != null) {
      return byRemoteId;
    }
  }

  const pluginSourcePath = readPluginSourcePath(detail);
  if (pluginSourcePath == null) {
    return null;
  }

  return shares.find((share) => share.localPluginPath === pluginSourcePath) ?? null;
}

function buildInstalledSkillState(
  detail: PluginDetail | null,
  skills: SkillSummary[],
): InstalledSkillState {
  if (detail == null) {
    return {
      installedSkills: [],
      unavailableSkills: [],
    };
  }

  const selectedByName = new Map<string, SkillSummary>();
  for (const skill of skills) {
    const existing = selectedByName.get(skill.name);
    if (existing == null || skill.path.localeCompare(existing.path) < 0) {
      selectedByName.set(skill.name, skill);
    }
  }

  const installedSkills: SkillSummary[] = [];
  const unavailableSkills: PluginDetail["skills"] = [];
  for (const pluginSkill of detail.skills) {
    const installed = selectedByName.get(pluginSkill.name);
    if (installed == null) {
      unavailableSkills.push(pluginSkill);
      continue;
    }
    installedSkills.push(installed);
  }

  installedSkills.sort((left, right) =>
    (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name),
  );

  return {
    installedSkills,
    unavailableSkills,
  };
}

function buildResolvedMcpServers(
  apps: AppInfo[],
  config: Awaited<ReturnType<typeof readConfigForHost>>["config"] | null,
  pluginServerNames: string[],
): ResolvedMcpServer[] {
  const configuredServers = parseMcpServers(config);

  return pluginServerNames.map((serverName) => {
    const normalizedServerName = normalizeServerName(serverName);
    const app = apps.find((entry) =>
      [
        entry.id,
        entry.name,
        ...entry.pluginDisplayNames,
        ...Object.keys(entry.labels ?? {}),
        ...Object.values(entry.labels ?? {}),
      ].some(
        (value) => normalizeServerName(value) === normalizedServerName,
      ),
    );
    if (app != null) {
      return {
        app,
        kind: "app",
      };
    }

    const configured = configuredServers.find(
      (entry) => normalizeServerName(entry.name) === normalizedServerName,
    );
    return {
      configKey: configured?.name ?? null,
      enabled: configured?.server.base.enabled !== false,
      installed: configured != null,
      kind: "config",
      name: serverName,
    };
  });
}

function normalizeServerName(value: string) {
  return value.trim().toLowerCase().replace(/^connector[_-]/, "").replace(/^mcp[_-]/, "").replace(/[\s_-]+/g, "");
}

function resolvePluginLongDescription(detail: PluginDetail) {
  const longDescription =
    detail.summary.interface?.longDescription ??
    detail.description ??
    detail.summary.interface?.shortDescription ??
    null;
  return longDescription === (detail.summary.interface?.shortDescription ?? detail.description ?? null)
    ? null
    : longDescription;
}

function buildPluginInformation(
  detail: PluginDetail,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const entries: Array<{ key: string; label: string; value: string }> = [];
  const categoryParts = [
    detail.marketplaceName.trim().length > 0 ? detail.marketplaceName.trim() : null,
    detail.summary.interface?.category?.trim() || null,
  ].filter((value): value is string => value != null);
  if (categoryParts.length > 0) {
    entries.push({
      key: "category",
      label: t("plugins.detail.information.category"),
      value: categoryParts.join(", "),
    });
  }

  const capabilities = detail.summary.interface?.capabilities ?? [];
  if (capabilities.length > 0) {
    entries.push({
      key: "capabilities",
      label: t("plugins.detail.information.capabilities"),
      value: capabilities.join(", "),
    });
  }

  const developerName = detail.summary.interface?.developerName?.trim();
  if (developerName) {
    entries.push({
      key: "developer",
      label: t("plugins.detail.information.developer"),
      value: developerName,
    });
  }

  if (detail.summary.interface?.websiteUrl) {
    entries.push({
      key: "website",
      label: t("plugins.detail.information.website"),
      value: detail.summary.interface.websiteUrl,
    });
  }

  if (detail.summary.interface?.privacyPolicyUrl) {
    entries.push({
      key: "privacyPolicy",
      label: t("plugins.detail.information.privacyPolicy"),
      value: detail.summary.interface.privacyPolicyUrl,
    });
  }

  if (detail.summary.interface?.termsOfServiceUrl) {
    entries.push({
      key: "termsOfService",
      label: t("plugins.detail.information.termsOfService"),
      value: detail.summary.interface.termsOfServiceUrl,
    });
  }

  return entries;
}

function resolveAppBlockedReason(appId: string, detail: PluginDetail | null) {
  if (detail == null) {
    return null;
  }
  const pluginApp = detail.apps.find((entry) => entry.id === appId);
  if (pluginApp == null) {
    return null;
  }
  return detail.summary.availability === "DISABLED_BY_ADMIN" ? "disabled-by-admin" : null;
}

function capitalizeLabel(value: string) {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function IncludedItem({
  badges,
  control,
  description,
  dimmed = false,
  icon,
  secondaryLabel,
  title,
}: {
  badges?: string[];
  control?: React.ReactNode;
  description?: React.ReactNode;
  dimmed?: boolean;
  icon?: React.ReactNode;
  secondaryLabel?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-[14px] border border-token-border bg-token-bg-primary/40 px-4 py-3",
        dimmed ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon ?? null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 truncate text-[14px] font-medium text-token-foreground">{title}</div>
              {(badges ?? []).map((badge) => (
                <span
                  key={badge}
                  className="shrink-0 text-[12px] font-normal text-token-text-secondary"
                >
                  {badge}
                </span>
              ))}
              {secondaryLabel ? (
                <span className="shrink-0 text-[12px] text-token-text-secondary">{secondaryLabel}</span>
              ) : null}
            </div>
            {description ? (
              <div className="mt-1 text-[12px] leading-5 text-token-text-secondary">{description}</div>
            ) : null}
          </div>
        </div>
        {control ? <div className="shrink-0">{control}</div> : null}
      </div>
    </div>
  );
}
