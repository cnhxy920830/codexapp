import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { BackNavigationIcon, TrashIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { FilteredPluginSettings, type FilteredPluginSettingsItemPresentation } from "./FilteredPluginSettings";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import {
  BrowserUseDialog,
  BrowserUseLoadingStateRow,
  BrowserUseMessageStateRow,
  BrowserUseOriginSection,
  renderInlineTagButton,
} from "./browserUseShared";
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
  readPluginsSnapshot,
  type PluginListSnapshot,
} from "../services/plugins";

const COMPUTER_USE_SETTINGS_PATH = "/settings/computer-use";
const GOOGLE_CHROME_SETTINGS_PATH = "/settings/computer-use/google-chrome";
const PLUGIN_QUERY_KEY = ["plugins"] as const;
const DEFAULT_SOUND_MODE: ComputerUseSoundModeValue = "foregroundClicks";
const CHROME_EXTENSION_ID_RELATIVE_PATH = "scripts/extension-id.json";
const CHROME_EXTENSION_INSTALL_URL_PREFIX = "https://chromewebstore.google.com/detail/codex/";
const BROWSER_USE_LEARN_MORE_URL = "https://developers.openai.com/codex/app/computer-use";

type ComputerUseSubpage = "google-chrome" | "overview";
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
  const effectiveWorkspaceRoot = isLocalHost ? workspaceRoot : null;
  const [currentSubpage, setCurrentSubpage] = useState<ComputerUseSubpage>(readCurrentSubpageFromLocation);
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [pluginsLoading, setPluginsLoading] = useState(true);
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
      setPluginsLoading(false);
      return;
    }

    setPluginsLoading(true);
    try {
      setPluginsSnapshot(await readPluginsSnapshot(workspaceRoot, selectedHostId));
    } catch (error) {
      setPluginsSnapshot(null);
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

  return (
    <SettingsContentLayout
      subtitle={t("settings.computerUse.subtitle")}
      title={<SettingsSectionTitle slug="computer-use" />}
    >
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.computerUse.install.title")} />
        <SettingsGroup.Content>
          <FilteredPluginSettings
            emptyState={t("settings.computerUse.install.empty")}
            getItemPresentation={(candidate) =>
              getControlItemPresentation({
                candidate,
                chromeDescription,
                chromeDescriptionTone,
                isChromePluginReady,
                onOpenChromeSettings: handleOpenChromeSettings,
                t,
              })
            }
            hostId={selectedHostId}
            installButtonLabel={t("settings.computerUse.install.button")}
            pluginNames={["computer-use", "chrome"]}
            selectPlugins={(snapshot) => {
              const plugins = [];
              const computerUsePlugin =
                isLocalHost ? selectPluginCandidatesByName(snapshot, ["computer-use"])[0] ?? null : null;
              const selectedChromePlugin =
                isLocalHost
                  ? selectChromePlugin(selectPluginCandidatesByName(snapshot, ["chrome-internal", "chrome-dev", "chrome"]))
                  : null;

              if (computerUsePlugin != null) {
                plugins.push(computerUsePlugin);
              }

              if (selectedChromePlugin != null) {
                plugins.push(selectedChromePlugin);
              }

              return plugins;
            }}
            workspaceRoot={effectiveWorkspaceRoot}
          />
        </SettingsGroup.Content>
      </SettingsGroup>

      {isComputerUseAvailable ? (
        <>
          <SettingsGroup>
            <SettingsGroup.Header title={t("settings.computerUse.allowedApps.title")} />
            <SettingsGroup.Content>
              <SettingsSurface>
                <ComputerUseAllowedAppsList
                  approvalsState={approvalsState}
                  isLoading={approvalsLoading}
                  hasLoadError={approvalsLoadError}
                  onShowToast={onShowToast}
                  setApprovalsState={setApprovalsState}
                />
              </SettingsSurface>
            </SettingsGroup.Content>
          </SettingsGroup>

          <SoundModeSelector
            isLoading={soundModeLoading}
            isPending={soundModePending}
            onChange={(value) => void handleSoundModeChange(value)}
            options={soundOptions}
            value={soundMode}
          />
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
        warning: t("settings.browserUse.approval.neverAsk.elevatedRiskDisclaimer"),
        warningIcon: (
          <ElevatedRiskIcon className="icon-xs shrink-0 text-token-editor-warning-foreground" />
        ),
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

  const downloadApprovalOptions = useMemo(
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
        title={t("settings.computerUse.chrome.title")}
      >
        <div className="flex min-h-[120px] items-center justify-center text-token-text-secondary">
          <BrowserUseLoadingStateRow message={null} />
        </div>
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
          <BrowserUseMessageStateRow message={loadError} />
        </SettingsSurface>
      ) : (
        <>
          <SettingsGroup>
            <SettingsGroup.Header title={t("settings.computerUse.chrome.permissions.title")} />
            <SettingsGroup.Content>
              <SettingsSurface>
                <SettingsRow
                  control={
                    <SettingsChoiceMenu
                      className="w-[152px]"
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
                  description={renderInlineTagButton(
                    t("settings.browserUse.approval.description"),
                    "learnMoreLink",
                    () => {
                      void openInBrowser(BROWSER_USE_LEARN_MORE_URL);
                    },
                    "text-token-text-link-foreground hover:underline",
                  )}
                  label={t("settings.browserUse.approval.label")}
                />
                <SettingsRow
                  control={
                    <SettingsChoiceMenu
                      className="w-[152px]"
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
                <SettingsRow
                  control={
                    <SettingsChoiceMenu
                      className="w-[152px]"
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
                      options={downloadApprovalOptions}
                      value={downloadApprovalMode}
                    />
                  }
                  description={t("settings.browserUse.downloadApproval.description")}
                  label={t("settings.browserUse.downloadApproval.label")}
                />
                <SettingsRow
                  control={
                    <SettingsChoiceMenu
                      className="w-[152px]"
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
            </SettingsGroup.Content>
          </SettingsGroup>

          {CHROME_ORIGIN_SECTION_CONFIGS.map((config) => (
            <BrowserUseOriginSection
              key={`${config.resource}:${config.kind}`}
              emptyTitleKey={config.emptyTitleKey}
              isDisabled={controlsDisabled}
              isLoading={settingsLoading}
              onRequestAdd={() => {
                setOriginDraft("");
                setAddOriginConfig(config);
              }}
              onRequestRemove={(origin) => setRemoveOriginState({ config, origin })}
              origins={getOriginsForConfig(settingsState, config)}
              subtitleKey={config.subtitleKey}
              titleKey={config.titleKey}
            />
          ))}
        </>
      )}

      {addOriginConfig ? (
        <BrowserUseDialog
          confirmLabel={t("settings.browserUse.domains.addDialogConfirm")}
          disableConfirm={originDraft.trim().length === 0 || pendingAction != null}
          onClose={() => {
            setOriginDraft("");
            setAddOriginConfig(null);
          }}
          onConfirm={() => void handleAddOrigin(addOriginConfig)}
          subtitle={t(addOriginConfig.addDialogSubtitleKey)}
          title={t(addOriginConfig.addDialogTitleKey)}
          footer={
            <>
              <Button
                color="outline"
                disabled={pendingAction != null}
                type="button"
                onClick={() => {
                  setOriginDraft("");
                  setAddOriginConfig(null);
                }}
              >
                {t("settings.browserUse.domains.addDialogCancel")}
              </Button>
              <Button
                disabled={originDraft.trim().length === 0 || pendingAction != null}
                loading={pendingAction != null}
                type="submit"
              >
                {t("settings.browserUse.domains.addDialogConfirm")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              aria-label={t("settings.browserUse.domains.addDialogAriaLabel")}
              className="rounded-xl border border-token-border px-3 py-2 text-base text-token-input-foreground shadow-sm outline-none placeholder:text-token-input-placeholder-foreground"
              onChange={(event) => setOriginDraft(event.currentTarget.value)}
              placeholder={t("settings.browserUse.domains.addDialogPlaceholder")}
              value={originDraft}
            />
          </div>
        </BrowserUseDialog>
      ) : null}

      {removeOriginState ? (
        <BrowserUseDialog
          confirmLabel={t("settings.browserUse.origins.removeDialogConfirm")}
          confirmTone="danger"
          disableConfirm={pendingAction != null}
          onClose={() => setRemoveOriginState(null)}
          onConfirm={() => void handleRemoveOrigin(removeOriginState)}
          subtitle={t(removeOriginState.config.removeDialogSubtitleKey)}
          title={t(removeOriginState.config.removeDialogTitleKey, { origin: removeOriginState.origin })}
          footer={
            <>
              <Button
                color="ghost"
                disabled={pendingAction != null}
                type="button"
                onClick={() => setRemoveOriginState(null)}
              >
                {t("settings.browserUse.origins.removeDialogCancel")}
              </Button>
              <Button
                color="danger"
                loading={pendingAction != null}
                type="button"
                onClick={() => void handleRemoveOrigin(removeOriginState)}
              >
                {t("settings.browserUse.origins.removeDialogConfirm")}
              </Button>
            </>
          }
        >
          {null}
        </BrowserUseDialog>
      ) : null}
    </SettingsContentLayout>
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
        <BrowserUseLoadingStateRow message={t("settings.computerUse.allowedApps.loading")} />
      ) : hasLoadError ? (
        <BrowserUseMessageStateRow message={t("settings.computerUse.allowedApps.loadError")} />
      ) : approvedApps.length === 0 ? (
        <SettingsRow
          className="justify-center"
          control={null}
          label={<span className="text-token-text-secondary">{t("settings.computerUse.allowedApps.emptyTitle")}</span>}
        />
      ) : (
        approvedApps.map((approvedApp) => (
          <SettingsRow
            key={approvedApp.bundleIdentifier}
            className="items-start max-sm:flex-col max-sm:items-stretch"
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
        <BrowserUseDialog
          confirmLabel={t("settings.computerUse.allowedApps.removeDialogConfirm")}
          confirmTone="danger"
          disableConfirm={pendingBundleIdentifier != null}
          onClose={() => setRemoveDialogApp(null)}
          onConfirm={() => void handleRemoveApproval()}
          subtitle={t("settings.computerUse.allowedApps.removeDialogSubtitle", {
            displayName: removeDialogApp.displayName,
          })}
          title={t("settings.computerUse.allowedApps.removeDialogTitle", {
            displayName: removeDialogApp.displayName,
          })}
          footer={
            <>
              <Button
                color="ghost"
                disabled={pendingBundleIdentifier != null}
                type="button"
                onClick={() => setRemoveDialogApp(null)}
              >
                {t("settings.computerUse.allowedApps.removeDialogCancel")}
              </Button>
              <Button
                color="danger"
                loading={pendingBundleIdentifier != null}
                type="button"
                onClick={() => void handleRemoveApproval()}
              >
                {t("settings.computerUse.allowedApps.removeDialogConfirm")}
              </Button>
            </>
          }
        >
          {null}
        </BrowserUseDialog>
      ) : null}
    </>
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
        <ChevronRightIcon className="icon-xs text-token-text-secondary" />
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

function ElevatedRiskIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.06543 1.95123C9.66107 1.69076 10.3389 1.69071 10.9346 1.95123L15.9346 4.13873C16.7832 4.51008 17.3311 5.34917 17.3311 6.27545V10.5528C17.3309 14.6017 14.0489 17.8847 10 17.8848C5.95108 17.8846 2.66813 14.6017 2.66797 10.5528V6.27545C2.66797 5.34924 3.21695 4.51012 4.06543 4.13873L9.06543 1.95123ZM10.4014 3.16998C10.1456 3.05814 9.85444 3.05819 9.59863 3.16998L4.59863 5.35748C4.23427 5.51708 3.99805 5.87764 3.99805 6.27545V10.5528C3.99821 13.8671 6.68563 16.5546 10 16.5547C13.3144 16.5546 16.0008 13.8671 16.001 10.5528V6.27545C16.001 5.87756 15.7658 5.51703 15.4014 5.35748L10.4014 3.16998Z"
        fill="currentColor"
      />
      <path
        d="M10.8883 13.1116C10.8883 13.6025 10.4903 14.0005 9.99936 14.0005C9.50844 14.0005 9.11047 13.6025 9.11047 13.1116C9.11047 12.6207 9.50844 12.2227 9.99936 12.2227C10.4903 12.2227 10.8883 12.6207 10.8883 13.1116Z"
        fill="currentColor"
      />
      <path
        d="M10.5169 10.8949L11.1135 7.31519C11.2283 6.62672 10.6974 6 9.99941 6C9.30145 6 8.77053 6.62672 8.88528 7.31519L9.4819 10.8949C9.52406 11.1479 9.74294 11.3333 9.99941 11.3333C10.2559 11.3333 10.4748 11.1479 10.5169 10.8949Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SoundModeSelector({
  isLoading,
  isPending,
  onChange,
  options,
  value,
}: {
  isLoading: boolean;
  isPending: boolean;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  if (selectedOption == null) {
    return null;
  }

  return (
    <SettingsChoiceMenu
      className="w-max max-w-full"
      disabled={isLoading || isPending}
      onChange={onChange}
      options={options}
      value={value}
    />
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7.52925 3.7793C7.75652 3.55203 8.10803 3.52383 8.36616 3.69434L8.47065 3.7793L14.2207 9.5293C14.4804 9.789 14.4804 10.211 14.2207 10.4707L8.47065 16.2207C8.21095 16.4804 7.78895 16.4804 7.52925 16.2207C7.26955 15.961 7.26955 15.539 7.52925 15.2793L12.8085 10L7.52925 4.7207L7.44429 4.61621C7.27378 4.35808 7.30198 4.00657 7.52925 3.7793Z"
        fill="currentColor"
      />
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

function getControlItemPresentation({
  candidate,
  chromeDescription,
  chromeDescriptionTone,
  isChromePluginReady,
  onOpenChromeSettings,
  t,
}: {
  candidate: PluginCandidate;
  chromeDescription: string;
  chromeDescriptionTone?: "danger" | "success";
  isChromePluginReady: boolean;
  onOpenChromeSettings: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}): FilteredPluginSettingsItemPresentation {
  if (candidate.plugin.name === "computer-use") {
    return {
      controlLabel: t("settings.computerUse.anyApp.title"),
      title: t("settings.computerUse.anyApp.title"),
      description: t("settings.computerUse.anyApp.description"),
    };
  }

  return {
    action: isChromePluginReady ? (
      <Button color="secondary" size="toolbar" onClick={onOpenChromeSettings}>
        {t("settings.computerUse.chrome.manage")}
      </Button>
    ) : null,
    controlLabel: t("settings.computerUse.chrome.pluginTitle"),
    title: t("settings.computerUse.chrome.pluginTitle"),
    description: chromeDescription,
    descriptionIndicator:
      chromeDescriptionTone === "success"
        ? "success"
        : chromeDescriptionTone === "danger"
          ? "error"
          : undefined,
  };
}

function selectChromePlugin(candidates: PluginCandidate[]) {
  return candidates.find((candidate) => candidate.plugin.name === "chrome-internal") ?? candidates[0] ?? null;
}
