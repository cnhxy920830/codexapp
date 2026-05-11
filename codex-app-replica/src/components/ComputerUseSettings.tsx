import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { BackNavigationIcon, NewChatIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { ToggleSwitch } from "./ToggleSwitch";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { selectPluginCandidatesByName, type PluginCandidate } from "../lib/pluginSelectors";
import {
  addBrowserUseFileTransferOrigin,
  addBrowserUseOrigin,
  readBrowserUseSettings,
  removeBrowserUseFileTransferOrigin,
  removeBrowserUseOrigin,
  writeBrowserUseApprovalMode,
  writeBrowserUseFileTransferApprovalMode,
  writeBrowserUseHistoryApprovalMode,
  type BrowserUseApprovalMode,
  type BrowserUseFileTransferKind,
  type BrowserUseOriginKind,
  type BrowserUseSettingsState,
} from "../services/browserUseSettings";
import {
  openChromeExtensionSettings,
  readChromeExtensionInstalled,
  readComputerUseApprovals,
  readComputerUseSoundMode,
  removeComputerUseApproval,
  writeComputerUseSoundMode,
  type ChromeExtensionInstalledState,
  type ComputerUseApprovedApp,
  type ComputerUseApprovalsState,
  type ComputerUseSoundModeValue,
} from "../services/computerUseSettings";
import { openInBrowser, readFileText } from "../services/hostFiles";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../services/queryCache";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";
import {
  installPlugin,
  readPluginsSnapshot,
  setPluginEnabled,
  type PluginListSnapshot,
} from "../services/plugins";

const COMPUTER_USE_SETTINGS_PATH = "/settings/computer-use";
const GOOGLE_CHROME_SETTINGS_PATH = "/settings/computer-use/google-chrome";
const PLUGIN_QUERY_KEY = ["plugins"] as const;
const DEFAULT_SOUND_MODE: ComputerUseSoundModeValue = "foregroundClicks";
const CHROME_EXTENSION_ID_RELATIVE_PATH = "scripts/extension-id.json";
const CHROME_EXTENSION_INSTALL_URL_PREFIX = "https://chromewebstore.google.com/detail/codex/";

type ComputerUseSubpage = "google-chrome" | "overview";
type DescriptionTone = "danger" | "success";
type BrowserUseOriginResource = "downloads" | "origins" | "uploads";

type BrowserUseOriginSectionConfig = {
  addDialogSubtitleKey: MessageKey;
  addDialogTitleKey: MessageKey;
  addedToastKey: MessageKey;
  emptyTitleKey: MessageKey;
  kind: BrowserUseOriginKind;
  removeDialogSubtitleKey: MessageKey;
  removeDialogTitleKey: MessageKey;
  removedToastKey: MessageKey;
  resource: BrowserUseOriginResource;
  subtitleKey: MessageKey;
  titleKey: MessageKey;
};

type BrowserUseRemoveDialogState = {
  config: BrowserUseOriginSectionConfig;
  origin: string;
};

type ChromeExtensionSetup = {
  extensionId: string;
  installUrl: string;
};

const CHROME_ORIGIN_SECTION_CONFIGS: BrowserUseOriginSectionConfig[] = [
  {
    resource: "origins",
    kind: "denied",
    titleKey: "settings.browserUse.blockedDomains.title",
    subtitleKey: "settings.browserUse.blockedDomains.chromeSubtitle",
    emptyTitleKey: "settings.browserUse.blockedDomains.emptyTitle",
    addedToastKey: "settings.browserUse.blockedDomains.added",
    removedToastKey: "settings.browserUse.deniedWebsites.saved",
    addDialogTitleKey: "settings.browserUse.blockedDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.blockedDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.deniedWebsites.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.deniedWebsites.removeDialogSubtitle",
  },
  {
    resource: "origins",
    kind: "allowed",
    titleKey: "settings.browserUse.allowedDomains.title",
    subtitleKey: "settings.browserUse.allowedDomains.subtitle",
    emptyTitleKey: "settings.browserUse.allowedDomains.emptyTitle",
    addedToastKey: "settings.browserUse.allowedDomains.added",
    removedToastKey: "settings.browserUse.allowedWebsites.saved",
    addDialogTitleKey: "settings.browserUse.allowedDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.allowedDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.allowedWebsites.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.allowedWebsites.removeDialogSubtitle",
  },
  {
    resource: "downloads",
    kind: "denied",
    titleKey: "settings.browserUse.blockedDownloadDomains.title",
    subtitleKey: "settings.browserUse.blockedDownloadDomains.subtitle",
    emptyTitleKey: "settings.browserUse.blockedDownloadDomains.emptyTitle",
    addedToastKey: "settings.browserUse.blockedDownloadDomains.added",
    removedToastKey: "settings.browserUse.blockedDownloadDomains.removed",
    addDialogTitleKey: "settings.browserUse.blockedDownloadDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.blockedDownloadDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.blockedDownloadDomains.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.blockedDownloadDomains.removeDialogSubtitle",
  },
  {
    resource: "downloads",
    kind: "allowed",
    titleKey: "settings.browserUse.allowedDownloadDomains.title",
    subtitleKey: "settings.browserUse.allowedDownloadDomains.subtitle",
    emptyTitleKey: "settings.browserUse.allowedDownloadDomains.emptyTitle",
    addedToastKey: "settings.browserUse.allowedDownloadDomains.added",
    removedToastKey: "settings.browserUse.allowedDownloadDomains.removed",
    addDialogTitleKey: "settings.browserUse.allowedDownloadDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.allowedDownloadDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.allowedDownloadDomains.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.allowedDownloadDomains.removeDialogSubtitle",
  },
  {
    resource: "uploads",
    kind: "denied",
    titleKey: "settings.browserUse.blockedUploadDomains.title",
    subtitleKey: "settings.browserUse.blockedUploadDomains.subtitle",
    emptyTitleKey: "settings.browserUse.blockedUploadDomains.emptyTitle",
    addedToastKey: "settings.browserUse.blockedUploadDomains.added",
    removedToastKey: "settings.browserUse.blockedUploadDomains.removed",
    addDialogTitleKey: "settings.browserUse.blockedUploadDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.blockedUploadDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.blockedUploadDomains.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.blockedUploadDomains.removeDialogSubtitle",
  },
  {
    resource: "uploads",
    kind: "allowed",
    titleKey: "settings.browserUse.allowedUploadDomains.title",
    subtitleKey: "settings.browserUse.allowedUploadDomains.subtitle",
    emptyTitleKey: "settings.browserUse.allowedUploadDomains.emptyTitle",
    addedToastKey: "settings.browserUse.allowedUploadDomains.added",
    removedToastKey: "settings.browserUse.allowedUploadDomains.removed",
    addDialogTitleKey: "settings.browserUse.allowedUploadDomains.addDialogTitle",
    addDialogSubtitleKey: "settings.browserUse.allowedUploadDomains.addDialogSubtitle",
    removeDialogTitleKey: "settings.browserUse.allowedUploadDomains.removeDialogTitle",
    removeDialogSubtitleKey: "settings.browserUse.allowedUploadDomains.removeDialogSubtitle",
  },
];

export function ComputerUseSettings({
  onShowToast,
  selectedHostId,
  workspaceRoot,
}: {
  onShowToast?: (toast: AppToast) => void;
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const isLocalHost = selectedHostId === LOCAL_SETTINGS_HOST_ID;
  const [currentSubpage, setCurrentSubpage] = useState<ComputerUseSubpage>(readCurrentSubpageFromLocation);
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [soundMode, setSoundMode] = useState<ComputerUseSoundModeValue>(DEFAULT_SOUND_MODE);
  const [soundModeLoading, setSoundModeLoading] = useState(false);
  const [soundModePending, setSoundModePending] = useState(false);
  const [approvalsState, setApprovalsState] = useState<ComputerUseApprovalsState | null>(null);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsLoadError, setApprovalsLoadError] = useState(false);
  const [chromeExtensionSetup, setChromeExtensionSetup] = useState<ChromeExtensionSetup | null>(null);
  const [chromeExtensionInstalled, setChromeExtensionInstalled] = useState<ChromeExtensionInstalledState>({
    installed: false,
  });
  const [chromeExtensionLoading, setChromeExtensionLoading] = useState(false);

  const loadPlugins = useEffectEvent(async () => {
    if (!isLocalHost) {
      setPluginsSnapshot(null);
      setPluginsError(null);
      setPluginsLoading(false);
      return;
    }

    setPluginsLoading(true);
    setPluginsError(null);
    try {
      setPluginsSnapshot(await readPluginsSnapshot(workspaceRoot, selectedHostId));
    } catch (error) {
      setPluginsSnapshot(null);
      setPluginsError(error instanceof Error ? error.message : String(error));
    } finally {
      setPluginsLoading(false);
    }
  });

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins, isLocalHost, selectedHostId, workspaceRoot]);

  const handlePluginQueryCacheInvalidate = useEffectEvent(
    (notification: QueryCacheInvalidateNotification) => {
      if (!queryKeyMatchesPrefix(notification.queryKey, PLUGIN_QUERY_KEY)) {
        return;
      }
      void loadPlugins();
    },
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed) {
        handlePluginQueryCacheInvalidate(notification);
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
  }, [handlePluginQueryCacheInvalidate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      setCurrentSubpage(readCurrentSubpageFromLocation());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const anyAppPlugin = useMemo(() => {
    return selectPluginCandidatesByName(pluginsSnapshot, ["computer-use"])[0] ?? null;
  }, [pluginsSnapshot]);
  const chromePlugin = useMemo(() => {
    return selectPluginCandidatesByName(pluginsSnapshot, ["chrome-internal", "chrome-dev", "chrome"])[0] ?? null;
  }, [pluginsSnapshot]);
  const isComputerUseAvailable = isLocalHost && (anyAppPlugin != null || chromePlugin != null);
  const isChromePluginReady = chromePlugin?.plugin.installed === true && chromePlugin.plugin.enabled === true;

  useEffect(() => {
    let cancelled = false;

    if (!isComputerUseAvailable || currentSubpage !== "overview") {
      setSoundMode(DEFAULT_SOUND_MODE);
      setSoundModeLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadSoundMode = async () => {
      setSoundModeLoading(true);
      try {
        const response = await readComputerUseSoundMode();
        if (!cancelled) {
          setSoundMode(isComputerUseSoundModeValue(response.value) ? response.value : DEFAULT_SOUND_MODE);
        }
      } catch {
        if (!cancelled) {
          setSoundMode(DEFAULT_SOUND_MODE);
        }
      } finally {
        if (!cancelled) {
          setSoundModeLoading(false);
        }
      }
    };

    void loadSoundMode();

    return () => {
      cancelled = true;
    };
  }, [currentSubpage, isComputerUseAvailable]);

  useEffect(() => {
    let cancelled = false;

    if (!isComputerUseAvailable || currentSubpage !== "overview") {
      setApprovalsState(null);
      setApprovalsLoading(false);
      setApprovalsLoadError(false);
      return () => {
        cancelled = true;
      };
    }

    const loadApprovals = async () => {
      setApprovalsLoading(true);
      setApprovalsLoadError(false);
      try {
        const nextState = await readComputerUseApprovals();
        if (!cancelled) {
          setApprovalsState(nextState);
        }
      } catch {
        if (!cancelled) {
          setApprovalsState(null);
          setApprovalsLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setApprovalsLoading(false);
        }
      }
    };

    void loadApprovals();

    return () => {
      cancelled = true;
    };
  }, [currentSubpage, isComputerUseAvailable]);

  useEffect(() => {
    let cancelled = false;

    if (!isLocalHost || chromePlugin?.plugin.installed !== true) {
      setChromeExtensionSetup(null);
      setChromeExtensionInstalled({ installed: false });
      setChromeExtensionLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadChromeExtensionState = async () => {
      setChromeExtensionLoading(true);
      try {
        const setup = await readChromeExtensionSetup(chromePlugin, selectedHostId);
        if (cancelled) {
          return;
        }
        setChromeExtensionSetup(setup);
        if (setup == null) {
          setChromeExtensionInstalled({ installed: false });
          return;
        }
        const installedState = await readChromeExtensionInstalled({ extensionId: setup.extensionId });
        if (!cancelled) {
          setChromeExtensionInstalled(installedState);
        }
      } catch {
        if (!cancelled) {
          setChromeExtensionSetup(null);
          setChromeExtensionInstalled({ installed: false });
        }
      } finally {
        if (!cancelled) {
          setChromeExtensionLoading(false);
        }
      }
    };

    void loadChromeExtensionState();

    return () => {
      cancelled = true;
    };
  }, [chromePlugin, isLocalHost, selectedHostId]);

  useEffect(() => {
    if (currentSubpage !== "google-chrome") {
      return;
    }
    if (pluginsLoading) {
      return;
    }
    if (isChromePluginReady) {
      return;
    }

    updateComputerUsePath(COMPUTER_USE_SETTINGS_PATH, "replace");
    setCurrentSubpage("overview");
  }, [currentSubpage, isChromePluginReady, pluginsLoading]);

  const soundOptions = useMemo(
    () => [
      {
        value: "foregroundClicks",
        label: t("settings.computerUse.sounds.foregroundClicks"),
      },
      {
        value: "foregroundAndBackgroundClicks",
        label: t("settings.computerUse.sounds.foregroundAndBackgroundClicks"),
      },
      {
        value: "off",
        label: t("settings.computerUse.sounds.off"),
      },
    ],
    [t],
  );

  const handleInstallPlugin = async (candidate: PluginCandidate) => {
    if (pendingPluginId != null || !isLocalHost) {
      return;
    }

    setPendingPluginId(candidate.plugin.id);
    try {
      await installPlugin(buildPluginInstallParams(candidate, selectedHostId));
      await loadPlugins();
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPendingPluginId(null);
    }
  };

  const handleTogglePlugin = async (candidate: PluginCandidate, enabled: boolean) => {
    if (pendingPluginId != null || !isLocalHost) {
      return;
    }

    setPendingPluginId(candidate.plugin.id);
    try {
      await setPluginEnabled({
        hostId: selectedHostId,
        pluginId: candidate.plugin.id,
        enabled,
      });
      await loadPlugins();
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("plugins.card.toggleError"),
      });
    } finally {
      setPendingPluginId(null);
    }
  };

  const handleSoundModeChange = async (value: string) => {
    const nextValue = value as ComputerUseSoundModeValue;
    if (soundModePending || nextValue === soundMode) {
      return;
    }

    setSoundModePending(true);
    try {
      const response = await writeComputerUseSoundMode({ value: nextValue });
      setSoundMode(response.value);
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSoundModePending(false);
    }
  };

  const handleOpenChromeSettings = () => {
    if (!isChromePluginReady) {
      return;
    }

    updateComputerUsePath(GOOGLE_CHROME_SETTINGS_PATH, "push");
    setCurrentSubpage("google-chrome");
  };

  if (currentSubpage === "google-chrome") {
    return (
      <GoogleChromeComputerUseSettingsPage
        chromeExtensionInstalled={chromeExtensionInstalled.installed}
        chromeExtensionLoading={chromeExtensionLoading}
        chromeExtensionSetup={chromeExtensionSetup}
        chromePlugin={chromePlugin}
        isLoading={pluginsLoading && chromePlugin == null}
        onBack={() => {
          updateComputerUsePath(COMPUTER_USE_SETTINGS_PATH, "push");
          setCurrentSubpage("overview");
        }}
        onShowToast={onShowToast}
      />
    );
  }

  const chromeDescription = chromeExtensionLoading
    ? t("settings.computerUse.chrome.pluginDescription")
    : chromeExtensionInstalled.installed
      ? t("settings.computerUse.chrome.pluginConnectedDescription")
      : t("settings.computerUse.chrome.pluginDisconnectedDescription");
  const chromeDescriptionTone =
    chromeExtensionLoading == true
      ? undefined
      : chromeExtensionInstalled.installed
        ? "success"
        : "danger";

  const showControlEmptyState = !pluginsLoading && (pluginsError == null && !isComputerUseAvailable);

  return (
    <SettingsContentLayout title={t("computerUse.label")} subtitle={t("settings.computerUse.subtitle")}>
      <SettingsGroup>
        <SettingsGroupHeader title={t("settings.computerUse.install.title")} />
        <SettingsGroupContent>
          <SettingsSurface>
            {pluginsLoading ? (
              <LoadingStateRow />
            ) : pluginsError ? (
              <MessageStateRow message={pluginsError} />
            ) : showControlEmptyState ? (
              <MessageStateRow message={t("settings.computerUse.install.empty")} />
            ) : (
              <>
                {anyAppPlugin ? (
                  <PluginControlRow
                    candidate={anyAppPlugin}
                    description={t("settings.computerUse.anyApp.description")}
                    isPending={pendingPluginId === anyAppPlugin.plugin.id}
                    onInstall={() => void handleInstallPlugin(anyAppPlugin)}
                    onToggle={(enabled) => void handleTogglePlugin(anyAppPlugin, enabled)}
                    title={t("settings.computerUse.anyApp.title")}
                  />
                ) : null}
                {chromePlugin ? (
                  <PluginControlRow
                    action={
                      chromePlugin.plugin.enabled ? (
                        <Button
                          color="secondary"
                          size="toolbar"
                          onClick={handleOpenChromeSettings}
                        >
                          {t("settings.computerUse.chrome.manage")}
                        </Button>
                      ) : null
                    }
                    candidate={chromePlugin}
                    description={chromeDescription}
                    descriptionTone={chromeDescriptionTone}
                    isPending={pendingPluginId === chromePlugin.plugin.id}
                    onInstall={() => void handleInstallPlugin(chromePlugin)}
                    onToggle={(enabled) => void handleTogglePlugin(chromePlugin, enabled)}
                    title={t("settings.computerUse.chrome.pluginTitle")}
                  />
                ) : null}
              </>
            )}
          </SettingsSurface>
        </SettingsGroupContent>
      </SettingsGroup>

      {isComputerUseAvailable ? (
        <>
          <SettingsGroup>
            <SettingsGroupHeader title={t("settings.computerUse.allowedApps.title")} />
            <SettingsGroupContent>
              <SettingsSurface>
                <ComputerUseAllowedAppsList
                  approvalsState={approvalsState}
                  isLoading={approvalsLoading}
                  hasLoadError={approvalsLoadError}
                  onShowToast={onShowToast}
                  setApprovalsState={setApprovalsState}
                />
              </SettingsSurface>
            </SettingsGroupContent>
          </SettingsGroup>

          <SettingsGroup>
            <SettingsGroupContent>
              <SettingsSurface>
                <div className="flex justify-end p-3 max-sm:justify-stretch">
                  <SettingsChoiceMenu
                    disabled={soundModeLoading || soundModePending}
                    onChange={(value) => void handleSoundModeChange(value)}
                    options={soundOptions}
                    value={soundMode}
                  />
                </div>
              </SettingsSurface>
            </SettingsGroupContent>
          </SettingsGroup>
        </>
      ) : null}
    </SettingsContentLayout>
  );
}

function GoogleChromeComputerUseSettingsPage({
  chromeExtensionInstalled,
  chromeExtensionLoading,
  chromeExtensionSetup,
  chromePlugin,
  isLoading,
  onBack,
  onShowToast,
}: {
  chromeExtensionInstalled: boolean;
  chromeExtensionLoading: boolean;
  chromeExtensionSetup: ChromeExtensionSetup | null;
  chromePlugin: PluginCandidate | null;
  isLoading: boolean;
  onBack: () => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [settingsState, setSettingsState] = useState<BrowserUseSettingsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [addOriginConfig, setAddOriginConfig] = useState<BrowserUseOriginSectionConfig | null>(null);
  const [originDraft, setOriginDraft] = useState("");
  const [removeOriginState, setRemoveOriginState] = useState<BrowserUseRemoveDialogState | null>(null);

  const loadSettings = useEffectEvent(async () => {
    setSettingsLoading(true);
    setLoadError(null);
    try {
      setSettingsState(await readBrowserUseSettings());
    } catch (error) {
      setSettingsState(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setSettingsLoading(false);
    }
  });

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const approvalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.approval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.approval.neverAsk.description"),
      },
    ],
    [t],
  );

  const historyApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.historyApproval.alwaysAsk.label"),
        description: t("settings.browserUse.historyApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.historyApproval.neverAsk.label"),
        description: t("settings.browserUse.historyApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const fileTransferApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.downloadApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.downloadApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const uploadApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.uploadApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.uploadApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const updateSettingsState = async (
    actionKey: string,
    save: () => Promise<BrowserUseSettingsState>,
    errorKey: MessageKey,
  ) => {
    if (pendingAction != null) {
      return;
    }

    setPendingAction(actionKey);
    try {
      setSettingsState(await save());
    } catch {
      onShowToast?.({
        tone: "error",
        message: t(errorKey),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddOrigin = async (config: BrowserUseOriginSectionConfig) => {
    const nextOrigin = originDraft.trim();
    if (nextOrigin.length === 0 || pendingAction != null) {
      return;
    }

    setPendingAction(`add:${config.resource}:${config.kind}`);
    try {
      const nextState =
        config.resource === "origins"
          ? await addBrowserUseOrigin({
              kind: config.kind,
              origin: nextOrigin,
            })
          : await addBrowserUseFileTransferOrigin({
              kind: config.kind,
              transferKind: resourceToTransferKind(config.resource),
              origin: nextOrigin,
            });
      setSettingsState(nextState);
      setOriginDraft("");
      setAddOriginConfig(null);
      onShowToast?.({
        tone: "success",
        message: t(config.addedToastKey),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.browserUse.domains.addError"),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveOrigin = async (state: BrowserUseRemoveDialogState) => {
    if (pendingAction != null) {
      return;
    }

    setPendingAction(`remove:${state.config.resource}:${state.config.kind}:${state.origin}`);
    try {
      const nextState =
        state.config.resource === "origins"
          ? await removeBrowserUseOrigin({
              kind: state.config.kind,
              origin: state.origin,
            })
          : await removeBrowserUseFileTransferOrigin({
              kind: state.config.kind,
              transferKind: resourceToTransferKind(state.config.resource),
              origin: state.origin,
            });
      setSettingsState(nextState);
      setRemoveOriginState(null);
      onShowToast?.({
        tone: "success",
        message: t(state.config.removedToastKey),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.browserUse.origins.saveError"),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const approvalMode = settingsState?.approvalMode ?? "alwaysAsk";
  const historyApprovalMode = settingsState?.historyApprovalMode ?? "alwaysAsk";
  const downloadApprovalMode = settingsState?.downloadApprovalMode ?? "alwaysAsk";
  const uploadApprovalMode = settingsState?.uploadApprovalMode ?? "alwaysAsk";
  const controlsDisabled = settingsLoading || pendingAction != null;
  const headerAction = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        color="secondary"
        size="toolbar"
        disabled={chromeExtensionSetup == null}
        onClick={() => {
          if (chromeExtensionSetup == null) {
            return;
          }
          void openInBrowser(chromeExtensionSetup.installUrl);
        }}
      >
        {t("settings.computerUse.chrome.reinstallExtension")}
      </Button>
      <Button
        color="danger"
        size="toolbar"
        disabled={chromeExtensionSetup == null || chromeExtensionLoading || !chromeExtensionInstalled}
        onClick={() => {
          if (chromeExtensionSetup == null) {
            return;
          }
          void openChromeExtensionSettings({ extensionId: chromeExtensionSetup.extensionId }).catch(() => {
            onShowToast?.({
              tone: "error",
              message: t("settings.computerUse.chrome.openExtensionSettingsError"),
            });
          });
        }}
      >
        {t("settings.computerUse.chrome.removeExtension")}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <SettingsContentLayout
        action={headerAction}
        backSlot={<ComputerUseChromeBreadcrumb onBack={onBack} />}
        subtitle={<StatusBadge installed={chromeExtensionInstalled} />}
        subtitleClassName="flex"
        title={t("settings.computerUse.chrome.title")}
      >
        <SettingsSurface>
          <LoadingStateRow />
        </SettingsSurface>
      </SettingsContentLayout>
    );
  }

  const statusBadge = chromeExtensionLoading ? null : <StatusBadge installed={chromeExtensionInstalled} />;

  return (
    <SettingsContentLayout
      action={headerAction}
      backSlot={<ComputerUseChromeBreadcrumb onBack={onBack} />}
      subtitle={statusBadge}
      subtitleClassName="flex"
      title={t("settings.computerUse.chrome.title")}
    >
      {loadError ? (
        <SettingsSurface>
          <MessageStateRow message={loadError} />
        </SettingsSurface>
      ) : (
        <>
          <SettingsGroup>
            <SettingsGroupHeader title={t("settings.computerUse.chrome.permissions.title")} />
            <SettingsGroupContent>
              <SettingsSurface>
                <SettingsValueRow
                  control={
                    <SettingsChoiceMenu
                      disabled={controlsDisabled}
                      onChange={(value) => {
                        if (value === approvalMode) {
                          return;
                        }
                        void updateSettingsState(
                          "approval",
                          () =>
                            writeBrowserUseApprovalMode({
                              approvalMode: value as BrowserUseApprovalMode,
                            }),
                          "settings.browserUse.approval.saveError",
                        );
                      }}
                      options={approvalOptions}
                      value={approvalMode}
                    />
                  }
                  description={t("settings.browserUse.approval.description")}
                  label={t("settings.browserUse.approval.label")}
                />
                <SettingsValueRow
                  control={
                    <SettingsChoiceMenu
                      disabled={controlsDisabled}
                      onChange={(value) => {
                        if (value === historyApprovalMode) {
                          return;
                        }
                        void updateSettingsState(
                          "historyApproval",
                          () =>
                            writeBrowserUseHistoryApprovalMode({
                              approvalMode: value as BrowserUseApprovalMode,
                            }),
                          "settings.browserUse.historyApproval.saveError",
                        );
                      }}
                      options={historyApprovalOptions}
                      value={historyApprovalMode}
                    />
                  }
                  description={t("settings.browserUse.historyApproval.description")}
                  label={t("settings.browserUse.historyApproval.label")}
                />
                <SettingsValueRow
                  control={
                    <SettingsChoiceMenu
                      disabled={controlsDisabled}
                      onChange={(value) => {
                        if (value === downloadApprovalMode) {
                          return;
                        }
                        void updateSettingsState(
                          "downloadApproval",
                          () =>
                            writeBrowserUseFileTransferApprovalMode({
                              kind: "download",
                              approvalMode: value as BrowserUseApprovalMode,
                            }),
                          "settings.browserUse.downloadApproval.saveError",
                        );
                      }}
                      options={fileTransferApprovalOptions}
                      value={downloadApprovalMode}
                    />
                  }
                  description={t("settings.browserUse.downloadApproval.description")}
                  label={t("settings.browserUse.downloadApproval.label")}
                />
                <SettingsValueRow
                  control={
                    <SettingsChoiceMenu
                      disabled={controlsDisabled}
                      onChange={(value) => {
                        if (value === uploadApprovalMode) {
                          return;
                        }
                        void updateSettingsState(
                          "uploadApproval",
                          () =>
                            writeBrowserUseFileTransferApprovalMode({
                              kind: "upload",
                              approvalMode: value as BrowserUseApprovalMode,
                            }),
                          "settings.browserUse.uploadApproval.saveError",
                        );
                      }}
                      options={uploadApprovalOptions}
                      value={uploadApprovalMode}
                    />
                  }
                  description={t("settings.browserUse.uploadApproval.description")}
                  label={t("settings.browserUse.uploadApproval.label")}
                />
              </SettingsSurface>
            </SettingsGroupContent>
          </SettingsGroup>

          {CHROME_ORIGIN_SECTION_CONFIGS.map((config) => (
            <OriginSection
              key={`${config.resource}:${config.kind}`}
              config={config}
              isDisabled={controlsDisabled}
              isLoading={settingsLoading}
              onRequestAdd={() => {
                setOriginDraft("");
                setAddOriginConfig(config);
              }}
              onRequestRemove={(origin) => setRemoveOriginState({ config, origin })}
              origins={getOriginsForConfig(settingsState, config)}
            />
          ))}
        </>
      )}

      {addOriginConfig ? (
        <DialogShell
          confirmLabel={t("settings.browserUse.domains.addDialogConfirm")}
          disableConfirm={originDraft.trim().length === 0 || pendingAction != null}
          onClose={() => {
            setOriginDraft("");
            setAddOriginConfig(null);
          }}
          onConfirm={() => void handleAddOrigin(addOriginConfig)}
          title={t(addOriginConfig.addDialogTitleKey)}
        >
          <div className="app-text-muted text-[13px] leading-6">{t(addOriginConfig.addDialogSubtitleKey)}</div>
          <input
            autoFocus
            aria-label={t("settings.browserUse.domains.addDialogAriaLabel")}
            className="app-control app-text-input mt-4 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
            onChange={(event) => setOriginDraft(event.target.value)}
            placeholder={t("settings.browserUse.domains.addDialogPlaceholder")}
            value={originDraft}
          />
        </DialogShell>
      ) : null}

      {removeOriginState ? (
        <DialogShell
          confirmLabel={t("settings.browserUse.origins.removeDialogConfirm")}
          confirmTone="danger"
          disableConfirm={pendingAction != null}
          onClose={() => setRemoveOriginState(null)}
          onConfirm={() => void handleRemoveOrigin(removeOriginState)}
          title={t(removeOriginState.config.removeDialogTitleKey, { origin: removeOriginState.origin })}
        >
          <div className="app-text-muted text-[13px] leading-6">
            {t(removeOriginState.config.removeDialogSubtitleKey)}
          </div>
        </DialogShell>
      ) : null}
    </SettingsContentLayout>
  );
}

function PluginControlRow({
  action,
  candidate,
  description,
  descriptionTone,
  isPending,
  onInstall,
  onToggle,
  title,
}: {
  action?: ReactNode;
  candidate: PluginCandidate;
  description: string;
  descriptionTone?: DescriptionTone;
  isPending: boolean;
  onInstall: () => void;
  onToggle: (enabled: boolean) => void;
  title: string;
}) {
  const { t } = useI18n();
  const isInstalled = candidate.plugin.installed;
  const isEnabled = candidate.plugin.enabled;

  return (
    <SettingsValueRow
      control={
        <div className="flex items-center gap-2">
          {action}
          {isInstalled ? (
            <ToggleSwitch
              ariaLabel={t("settings.pluginControls.toggleAria", { pluginName: title })}
              checked={isEnabled}
              disabled={isPending}
              onChange={onToggle}
            />
          ) : (
            <Button
              color="secondary"
              size="toolbar"
              title={t("settings.pluginControls.installTooltip", { pluginName: title })}
              disabled={isPending}
              loading={isPending}
              onClick={onInstall}
            >
              {t("settings.computerUse.install.button")}
            </Button>
          )}
        </div>
      }
      description={description}
      descriptionTone={descriptionTone}
      label={title}
    />
  );
}

function ComputerUseAllowedAppsList({
  approvalsState,
  hasLoadError,
  isLoading,
  onShowToast,
  setApprovalsState,
}: {
  approvalsState: ComputerUseApprovalsState | null;
  hasLoadError: boolean;
  isLoading: boolean;
  onShowToast?: (toast: AppToast) => void;
  setApprovalsState: (state: ComputerUseApprovalsState | null) => void;
}) {
  const { t } = useI18n();
  const [pendingBundleIdentifier, setPendingBundleIdentifier] = useState<string | null>(null);
  const [removeDialogApp, setRemoveDialogApp] = useState<ComputerUseApprovedApp | null>(null);
  const approvedApps = approvalsState?.approvedApps ?? [];

  const handleRemoveApproval = async () => {
    if (removeDialogApp == null || pendingBundleIdentifier != null) {
      return;
    }

    setPendingBundleIdentifier(removeDialogApp.bundleIdentifier);
    try {
      const nextState = await removeComputerUseApproval({
        bundleIdentifier: removeDialogApp.bundleIdentifier,
      });
      if (nextState == null) {
        throw new Error("Computer use approvals are unavailable");
      }
      setApprovalsState(nextState);
      setRemoveDialogApp(null);
      onShowToast?.({
        tone: "success",
        message: t("settings.computerUse.allowedApps.saved"),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.computerUse.allowedApps.saveError"),
      });
    } finally {
      setPendingBundleIdentifier(null);
    }
  };

  return (
    <>
      {isLoading ? (
        <LoadingStateRow />
      ) : hasLoadError ? (
        <MessageStateRow message={t("settings.computerUse.allowedApps.loadError")} />
      ) : approvedApps.length === 0 ? (
        <MessageStateRow message={t("settings.computerUse.allowedApps.emptyTitle")} />
      ) : (
        approvedApps.map((approvedApp) => (
          <SettingsValueRow
            key={approvedApp.bundleIdentifier}
            control={
              <Button
                aria-label={t("settings.computerUse.allowedApps.removeAriaLabel", {
                  displayName: approvedApp.displayName,
                })}
                color="ghost"
                disabled={pendingBundleIdentifier != null}
                size="icon"
                title={t("settings.computerUse.allowedApps.removeAriaLabel", {
                  displayName: approvedApp.displayName,
                })}
                uniform
                onClick={() => setRemoveDialogApp(approvedApp)}
              >
                <TrashIcon className="icon-2xs" />
              </Button>
            }
            icon={<ComputerUseApprovedAppIcon approvedApp={approvedApp} />}
            label={<span className="font-medium">{approvedApp.displayName}</span>}
          />
        ))
      )}

      {removeDialogApp ? (
        <DialogShell
          confirmLabel={t("settings.computerUse.allowedApps.removeDialogConfirm")}
          confirmTone="danger"
          disableConfirm={pendingBundleIdentifier != null}
          onClose={() => setRemoveDialogApp(null)}
          onConfirm={() => void handleRemoveApproval()}
          title={t("settings.computerUse.allowedApps.removeDialogTitle", {
            displayName: removeDialogApp.displayName,
          })}
        >
          <div className="app-text-muted text-[13px] leading-6">
            {t("settings.computerUse.allowedApps.removeDialogSubtitle", {
              displayName: removeDialogApp.displayName,
            })}
          </div>
        </DialogShell>
      ) : null}
    </>
  );
}

function OriginSection({
  config,
  isDisabled,
  isLoading,
  onRequestAdd,
  onRequestRemove,
  origins,
}: {
  config: BrowserUseOriginSectionConfig;
  isDisabled: boolean;
  isLoading: boolean;
  onRequestAdd: () => void;
  onRequestRemove: (origin: string) => void;
  origins: string[];
}) {
  const { t } = useI18n();

  return (
    <SettingsGroup>
      <SettingsGroupContent>
        <SettingsSurface>
          <div className="flex items-start justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-token-text-primary">{t(config.titleKey)}</div>
              <div className="mt-1 text-sm leading-6 text-token-text-secondary">{t(config.subtitleKey)}</div>
            </div>
            <Button
              className="shrink-0"
              color="secondary"
              disabled={isDisabled}
              size="toolbar"
              onClick={onRequestAdd}
            >
              <NewChatIcon className="icon-2xs" />
              <span>{t("settings.browserUse.domains.add")}</span>
            </Button>
          </div>

          {isLoading ? (
            <LoadingStateRow />
          ) : origins.length === 0 ? (
            <MessageStateRow message={t(config.emptyTitleKey)} />
          ) : (
            origins.map((origin) => (
              <SettingsValueRow
                key={`${config.resource}:${config.kind}:${origin}`}
                control={
                  <Button
                    aria-label={t("settings.browserUse.origins.removeAriaLabel", { origin })}
                    color="ghost"
                    disabled={isDisabled}
                    size="icon"
                    title={t("settings.browserUse.origins.removeAriaLabel", { origin })}
                    uniform
                    onClick={() => onRequestRemove(origin)}
                  >
                    <TrashIcon className="icon-2xs" />
                  </Button>
                }
                label={origin}
              />
            ))
          )}
        </SettingsSurface>
      </SettingsGroupContent>
    </SettingsGroup>
  );
}

function ComputerUseChromeBreadcrumb({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();

  return (
    <nav className="flex items-center gap-2 text-sm font-medium text-token-text-secondary">
      <Button color="ghost" size="toolbar" onClick={onBack}>
        <BackNavigationIcon className="icon-xs" />
        {t("settings.computerUse.chrome.back")}
      </Button>
      <div className="flex items-center gap-1">
        <span>{t("settings.computerUse.breadcrumb.computerUse")}</span>
        <span className="text-token-text-secondary">{">"}</span>
        <span className="text-token-text-primary">{t("settings.computerUse.chrome.breadcrumb.googleChrome")}</span>
      </div>
    </nav>
  );
}

function StatusBadge({ installed }: { installed: boolean }) {
  const { t } = useI18n();

  return (
    <span
      className={joinClasses(
        "inline-flex w-max items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium",
        installed
          ? "bg-[var(--color-background-status-success)] text-[var(--color-text-success)]"
          : "bg-token-charts-red/10 text-token-charts-red",
      )}
    >
      <span
        className={joinClasses(
          "h-2 w-2 rounded-full",
          installed ? "bg-[var(--color-icon-success)]" : "bg-token-charts-red",
        )}
      />
      {installed ? t("settings.computerUse.chrome.connected") : t("settings.computerUse.chrome.notConnected")}
    </span>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupHeader({ title }: { title: ReactNode }) {
  return <div className="pb-2 text-sm font-medium text-token-text-primary">{title}</div>;
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border",
        className,
      )}
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function SettingsValueRow({
  control,
  description,
  descriptionTone,
  icon,
  label,
}: {
  control?: ReactNode;
  description?: ReactNode;
  descriptionTone?: DescriptionTone;
  icon?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-token-text-primary">{label}</div>
          {description ? (
            <div
              className={joinClasses(
                "mt-1 text-sm leading-6",
                descriptionTone === "success"
                  ? "text-[var(--color-text-success)]"
                  : descriptionTone === "danger"
                    ? "text-token-charts-red"
                    : "text-token-text-secondary",
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  );
}

function LoadingStateRow() {
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-token-text-secondary">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-shell-subtle)] border-t-transparent" />
    </div>
  );
}

function MessageStateRow({ message }: { message: ReactNode }) {
  return <div className="p-4 text-sm text-token-text-secondary">{message}</div>;
}

function DialogShell({
  children,
  confirmLabel,
  confirmTone,
  disableConfirm,
  onClose,
  onConfirm,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  confirmTone?: "danger";
  disableConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="app-title text-[15px] font-medium">{title}</div>
        <div className="mt-2">{children}</div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button color="secondary" size="toolbar" onClick={onClose}>
            {t(
              confirmTone === "danger"
                ? "settings.browserUse.origins.removeDialogCancel"
                : "settings.browserUse.domains.addDialogCancel",
            )}
          </Button>
          <Button
            color={confirmTone === "danger" ? "danger" : "secondary"}
            disabled={disableConfirm}
            size="toolbar"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ComputerUseApprovedAppIcon({
  approvedApp,
}: {
  approvedApp: ComputerUseApprovedApp;
}) {
  if (approvedApp.iconDataURL) {
    return (
      <img
        alt=""
        className="h-9 w-9 shrink-0 rounded-md"
        draggable={false}
        src={approvedApp.iconDataURL}
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-token-foreground/10 text-sm font-semibold text-token-description-foreground">
      {approvedApp.displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" />
    </svg>
  );
}

function readCurrentSubpageFromLocation(): ComputerUseSubpage {
  if (typeof window === "undefined") {
    return "overview";
  }

  return window.location.pathname === GOOGLE_CHROME_SETTINGS_PATH ? "google-chrome" : "overview";
}

function updateComputerUsePath(path: string, mode: "push" | "replace") {
  if (typeof window === "undefined" || window.location.pathname === path) {
    return;
  }

  if (mode === "push") {
    window.history.pushState(window.history.state, "", path);
    return;
  }

  window.history.replaceState(window.history.state, "", path);
}

function buildPluginInstallParams(candidate: PluginCandidate, hostId: string) {
  return candidate.marketplacePath == null
    ? { hostId, pluginName: candidate.plugin.name }
    : { hostId, marketplacePath: candidate.marketplacePath, pluginName: candidate.plugin.name };
}

function isComputerUseSoundModeValue(value: unknown): value is ComputerUseSoundModeValue {
  return value === "foregroundClicks" || value === "foregroundAndBackgroundClicks" || value === "off";
}

function resourceToTransferKind(resource: BrowserUseOriginResource): BrowserUseFileTransferKind {
  switch (resource) {
    case "downloads":
      return "download";
    case "uploads":
      return "upload";
    case "origins":
      throw new Error("Website origins do not map to a file-transfer kind");
  }
}

function getOriginsForConfig(
  settingsState: BrowserUseSettingsState | null,
  config: BrowserUseOriginSectionConfig,
) {
  if (settingsState == null) {
    return [];
  }

  if (config.resource === "origins") {
    return config.kind === "allowed" ? settingsState.allowedOrigins : settingsState.deniedOrigins;
  }

  if (config.resource === "downloads") {
    return config.kind === "allowed"
      ? settingsState.allowedDownloadOrigins
      : settingsState.deniedDownloadOrigins;
  }

  return config.kind === "allowed" ? settingsState.allowedUploadOrigins : settingsState.deniedUploadOrigins;
}

async function readChromeExtensionSetup(
  candidate: PluginCandidate,
  hostId: string,
): Promise<ChromeExtensionSetup | null> {
  if (candidate.plugin.source.type !== "local") {
    return null;
  }
  if (!["chrome", "chrome-dev", "chrome-internal"].includes(candidate.plugin.name)) {
    return null;
  }

  const response = await readFileText({
    hostId,
    path: buildNestedPath(candidate.plugin.source.path, CHROME_EXTENSION_ID_RELATIVE_PATH),
  });
  const parsed = JSON.parse(response.contents) as { extensionId?: unknown };
  const extensionId =
    typeof parsed.extensionId === "string" ? parsed.extensionId.trim() : "";
  if (extensionId.length === 0) {
    return null;
  }

  return {
    extensionId,
    installUrl: `${CHROME_EXTENSION_INSTALL_URL_PREFIX}${extensionId}`,
  };
}

function buildNestedPath(rootPath: string, relativePath: string) {
  return `${rootPath.replace(/[\\/]+$/, "")}/${relativePath}`;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
