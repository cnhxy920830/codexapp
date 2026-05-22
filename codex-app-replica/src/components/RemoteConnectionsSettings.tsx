import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { AppToast } from "./AppToastRegion";
import {
  CheckIcon,
  CloseIcon,
  CloseTabIcon,
  InfoIcon,
  LogoutIcon,
  MoreActionsIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  WarningIcon,
} from "./AppShellIcons";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsDialog, SettingsDialogFooter } from "./SettingsDialog";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSurface } from "./SettingsSurface";
import { Spinner } from "./Spinner";
import { ToggleSwitch } from "./ToggleSwitch";
import { Tooltip } from "./Tooltip";
import { useI18n } from "../i18n/i18n";
import {
  type MessageKey,
  type MessageValues,
} from "../i18n/messages";
import {
  DialogOverlay,
  SetupDialog,
  useConnectedSettings,
} from "../features/chat/CodexMobileOnboarding";
import {
  hasConnectedRemoteControlClients,
  listConnectedRemoteControlClients,
  readRemoteControlMfaRequiredButDisabled,
  type RemoteControlClient,
} from "../services/remoteControl";
import { restartCodexAppServer } from "../services/mcp";
import {
  loginApiKeyForHost,
  loginChatGptWithCompletion,
  logoutForHost,
} from "../services/auth";
import { openInBrowser } from "../services/hostFiles";
import {
  listExperimentalFeaturesForHost,
  setExperimentalFeatureForHost,
} from "../services/personalization";
import {
  getGlobalState,
  setGlobalState,
} from "../services/settings";
import {
  discoverRemoteSshConnections,
  deleteRemoteControlConnection,
  onRemoteAppServerConnectionStateChanged,
  onSharedObjectUpdated,
  readAppServerConnectionState,
  readSettingsRemoteConnectionsSnapshot,
  readSettingsRemoteControlConnectionsSnapshot,
  readSettingsRemoteControlConnectionsStateSnapshot,
  refreshRemoteConnections,
  refreshRemoteControlConnections,
  REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY,
  REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY,
  renameRemoteControlConnection,
  saveCodexManagedRemoteSshConnections,
  setRemoteConnectionAutoConnect,
  LOCAL_SETTINGS_HOST_ID,
  type AppServerConnectionState,
  type AppServerConnectionStateResponse,
  type RemoteConnection,
  type RemoteControlConnection,
  type RemoteControlConnectionsState,
  type SavedRemoteConnectionInput,
} from "../services/settingsHosts";

type RemoteConnectionsSettingsProps = {
  onNavigateToCreateRemoteProject?: () => void;
  onShowToast?: (toast: AppToast) => void;
};

type ConnectionError =
  | { code: "login-required" }
  | {
      code: "restart-required";
      currentVersion?: string | null;
      installedVersion?: string | null;
    }
  | {
      code: "update-required";
      currentVersion?: string | null;
      minRequiredVersion?: string | null;
    }
  | {
      code: "connection-failed";
      message: string;
    };

type SshAuthMode = "none" | "identity";

type SshDialogMode = "add" | "edit";

type SshDraft = {
  displayName: string;
  sshHost: string;
  sshPort: string;
  authMode: SshAuthMode;
  identity: string;
  targetKind: "alias" | "host";
};

type SshValidationError =
  | "displayNameRequired"
  | "sshHostRequired"
  | "sshPortInteger"
  | "sshPortRange"
  | "identityRequired"
  | "duplicateDisplayName";

type ConnectionDetailRow = {
  id: "alias" | "host" | "port" | "identity" | "platform" | "version" | "lastSeen";
  label: MessageKey;
  value: ReactNode;
  copyValue: string | null;
};

type DeviceConnection = RemoteConnection | RemoteControlConnection;

type DeviceConnectionStateByHostId = Record<string, AppServerConnectionStateResponse>;

type LocalDeviceSetupStep =
  | "initial"
  | "allow-host"
  | "mfa-required"
  | "waiting"
  | "connected";

const REMOTE_CONNECTION_MIN_REQUIRED_VERSION = "0.129.0-alpha.6";

export function RemoteConnectionsSettings({
  onNavigateToCreateRemoteProject,
  onShowToast,
}: RemoteConnectionsSettingsProps) {
  const { t } = useI18n();
  const [sshConnections, setSshConnections] = useState<RemoteConnection[]>([]);
  const [remoteControlConnections, setRemoteControlConnections] = useState<RemoteControlConnection[]>([]);
  const [connectionStates, setConnectionStates] = useState<DeviceConnectionStateByHostId>({});
  const [remoteControlConnectionsState, setRemoteControlConnectionsState] =
    useState<RemoteControlConnectionsState>({
      available: false,
      authRequired: false,
      clientAuthorized: false,
    });
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [remoteControlClients, setRemoteControlClients] = useState<RemoteControlClient[] | null>(null);
  const [isLoadingRemoteControlClients, setIsLoadingRemoteControlClients] = useState(true);
  const [isRefreshingConnections, setIsRefreshingConnections] = useState(false);
  const [authDialogHostId, setAuthDialogHostId] = useState<string | null>(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [editingConnectionHostId, setEditingConnectionHostId] = useState<string | null>(null);
  const [sshDialogMode, setSshDialogMode] = useState<SshDialogMode>("add");
  const [isSshDialogOpen, setIsSshDialogOpen] = useState(false);
  const [isSavingSshConnection, setIsSavingSshConnection] = useState(false);
  const [detailsConnection, setDetailsConnection] = useState<DeviceConnection | null>(null);
  const [connectionToDelete, setConnectionToDelete] = useState<DeviceConnection | null>(null);
  const [isDeletingConnection, setIsDeletingConnection] = useState(false);
  const [pendingAutoConnectHostId, setPendingAutoConnectHostId] = useState<string | null>(null);
  const connectedSettings = useConnectedSettings({
    enabled: true,
    onShowToast,
  });

  const sortedSshConnections = useMemo(() => {
    return [...sshConnections].sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [sshConnections]);

  const sortedRemoteControlConnections = useMemo(() => {
    return sortRemoteControlConnections(remoteControlConnections);
  }, [remoteControlConnections]);

  const deviceConnections = useMemo<DeviceConnection[]>(() => {
    return [...sortedSshConnections, ...sortedRemoteControlConnections];
  }, [sortedRemoteControlConnections, sortedSshConnections]);

  const editingConnection = useMemo(() => {
    return sortedSshConnections.find((connection) => connection.hostId === editingConnectionHostId) ?? null;
  }, [editingConnectionHostId, sortedSshConnections]);

  useEffect(() => {
    let disposed = false;
    let disposeSharedObject: (() => void) | null = null;
    let disposeConnectionState: (() => void) | null = null;
    let refreshIntervalId: number | null = null;

    const load = async () => {
      setIsLoadingConnections(true);
      try {
        const [
          nextSshConnections,
          nextRemoteControlConnections,
          nextRemoteControlConnectionsState,
        ] = await Promise.all([
          readSettingsRemoteConnectionsSnapshot(),
          readSettingsRemoteControlConnectionsSnapshot(),
          readSettingsRemoteControlConnectionsStateSnapshot(),
        ]);
        if (disposed) {
          return;
        }
        setSshConnections(nextSshConnections);
        setRemoteControlConnections(nextRemoteControlConnections);
        setRemoteControlConnectionsState(nextRemoteControlConnectionsState);
        const allConnections = [...nextSshConnections, ...nextRemoteControlConnections];
        const nextStates = await readConnectionStateResponses(allConnections);
        if (disposed) {
          return;
        }
        setConnectionStates(nextStates);
        setConnectionsError(null);
      } catch (error) {
        if (disposed) {
          return;
        }
        setSshConnections([]);
        setRemoteControlConnections([]);
        setConnectionStates({});
        setRemoteControlConnectionsState({
          available: false,
          authRequired: false,
          clientAuthorized: false,
        });
        setConnectionsError(getErrorMessage(error));
      } finally {
        if (!disposed) {
          setIsLoadingConnections(false);
        }
      }
    };

    const refreshAllConnections = async () => {
      await Promise.all([
        refreshRemoteConnections(),
        refreshRemoteControlConnections(),
      ]);
    };

    const loadRemoteControl = async () => {
      setIsLoadingRemoteControlClients(true);
      try {
        const clients = await listConnectedRemoteControlClients();
        if (!disposed) {
          setRemoteControlClients(clients);
        }
      } catch {
        if (!disposed) {
          setRemoteControlClients(null);
        }
      } finally {
        if (!disposed) {
          setIsLoadingRemoteControlClients(false);
        }
      }
    };

    void Promise.all([load(), loadRemoteControl()]);
    refreshIntervalId = window.setInterval(() => {
      void refreshAllConnections().catch(() => {
        // Shared-object refresh will reconcile page state once either command completes.
      });
    }, 15_000);

    void onSharedObjectUpdated((notification) => {
      if (
        notification.key === REMOTE_CONNECTIONS_SHARED_OBJECT_KEY ||
        notification.key === REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY ||
        notification.key === REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY
      ) {
        void load();
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      disposeSharedObject = dispose;
    });

    void onRemoteAppServerConnectionStateChanged(() => {
      void load();
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      disposeConnectionState = dispose;
    });

    return () => {
      disposed = true;
      if (refreshIntervalId != null) {
        window.clearInterval(refreshIntervalId);
      }
      disposeSharedObject?.();
      disposeConnectionState?.();
    };
  }, []);

  const handleRefreshConnections = async () => {
    setIsRefreshingConnections(true);
    try {
      await Promise.all([
        refreshRemoteConnections(),
        refreshRemoteControlConnections(),
      ]);
      onShowToast?.({
        tone: "success",
        message: t("settings.remoteConnections.refresh.success"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.refresh.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setIsRefreshingConnections(false);
    }
  };

  const handleToggleAutoConnect = async (hostId: string, autoConnect: boolean) => {
    setPendingAutoConnectHostId(hostId);
    try {
      await setRemoteConnectionAutoConnect(hostId, autoConnect);
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.connectToggle.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAutoConnectHostId(null);
    }
  };

  const handleRenameRemoteControl = async (connection: RemoteControlConnection, name: string) => {
    try {
      await renameRemoteControlConnection(connection.envId, name);
      onShowToast?.({
        tone: "success",
        message: t("settings.remoteControlConnections.rename.success"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteControlConnections.rename.error"),
        description: getErrorMessage(error),
      });
      throw error;
    }
  };

  const handleOpenAddDialog = async () => {
    try {
      await discoverRemoteSshConnections();
    } catch {
      // Ignore discovery failures here; the saved snapshot remains the source for rendering.
    }
    setEditingConnectionHostId(null);
    setSshDialogMode("add");
    setIsSshDialogOpen(true);
  };

  const handleSaveSshConnection = async (draft: SshDraft) => {
    const errors = validateSshDraft({
      draft,
      existingConnections: sortedSshConnections,
      editingHostId: sshDialogMode === "edit" ? editingConnectionHostId : null,
    });
    if (errors.length > 0) {
      throw new Error(errors[0]);
    }

    const existingSavedConnections = toSavedConnections(sortedSshConnections);
    const nextConnection = toSavedConnectionInput(
      draft,
      sshDialogMode === "edit" ? editingConnectionHostId : null,
    );
    const nextSavedConnections =
      sshDialogMode === "edit" && editingConnectionHostId
        ? existingSavedConnections.map((connection) =>
            connection.hostId === editingConnectionHostId ? nextConnection : connection,
          )
        : existingSavedConnections.concat(nextConnection);

    setIsSavingSshConnection(true);
    try {
      await saveCodexManagedRemoteSshConnections(nextSavedConnections);
      setIsSshDialogOpen(false);
      setEditingConnectionHostId(null);
      onShowToast?.({
        tone: "success",
        message: t("settings.remoteConnections.save.success"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.save.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setIsSavingSshConnection(false);
    }
  };

  const handleDeleteSshConnection = async (connection: RemoteConnection) => {
    try {
      const nextSavedConnections = toSavedConnections(sortedSshConnections).filter(
        (savedConnection) => savedConnection.hostId !== connection.hostId,
      );
      await saveCodexManagedRemoteSshConnections(nextSavedConnections);
      onShowToast?.({
        tone: "success",
        message: t("settings.remoteConnections.save.success"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.delete.error"),
        description: getErrorMessage(error),
      });
    }
  };

  const handleDeleteConnection = async () => {
    if (connectionToDelete == null) {
      return;
    }

    setIsDeletingConnection(true);
    try {
      if (isRemoteControlConnection(connectionToDelete)) {
        await deleteRemoteControlConnection(connectionToDelete.envId);
        onShowToast?.({
          tone: "success",
          message: t("settings.remoteControlConnections.delete.success"),
        });
      }
      setConnectionToDelete(null);
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: isRemoteControlConnection(connectionToDelete)
          ? t("settings.remoteControlConnections.delete.error")
          : t("settings.remoteConnections.delete.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeletingConnection(false);
    }
  };

  const handleRestartConnection = async (hostId: string) => {
    try {
      await restartCodexAppServer(hostId);
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.restartConnection"),
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <>
      <SettingsContentLayout
        title={t("settings.section.connections")}
        subtitle={t("remoteConnections.page.subheading")}
      >
        <LocalDeviceSettingsSection
          connectedSettings={connectedSettings}
          onShowToast={onShowToast}
        />
        <RemoteControlClientsSection
          clients={remoteControlClients}
          isLoading={isLoadingRemoteControlClients}
        />
        <DeviceConnectionsSection
          connectionStates={connectionStates}
          connections={deviceConnections}
          remoteControlConnectionsState={remoteControlConnectionsState}
          isLoading={isLoadingConnections}
          onDeleteConnection={setConnectionToDelete}
          onDeleteSshConnection={(connection) => {
            void handleDeleteSshConnection(connection);
          }}
          onEditConnection={(hostId) => {
            setEditingConnectionHostId(hostId);
            setSshDialogMode("edit");
            setIsSshDialogOpen(true);
          }}
          onOpenDetails={(connection) => {
            setDetailsConnection(connection);
          }}
          onLoginRequired={(hostId) => {
            setAuthDialogHostId(hostId);
            setIsAuthDialogOpen(true);
          }}
          onLogoutConnection={async (hostId) => {
            try {
              await logoutForHost(hostId);
            } catch (error) {
              onShowToast?.({
                tone: "error",
                message: t("settings.remoteConnections.logout.error"),
                description: getErrorMessage(error),
              });
            }
          }}
          onNavigateToCreateRemoteProject={onNavigateToCreateRemoteProject}
          onRenameRemoteControlConnection={(connection, name) =>
            void handleRenameRemoteControl(connection, name)
          }
          onRefreshConnections={() => void handleRefreshConnections()}
          onRestartConnection={(hostId) => void handleRestartConnection(hostId)}
          onToggleAutoConnect={(hostId, autoConnect) => void handleToggleAutoConnect(hostId, autoConnect)}
          isRefreshingConnections={isRefreshingConnections}
          pendingAutoConnectHostId={pendingAutoConnectHostId}
          onAddConnection={() => void handleOpenAddDialog()}
        />
      </SettingsContentLayout>

      <RemoteConnectionAuthDialog
        hostId={authDialogHostId}
        open={isAuthDialogOpen}
        onOpenChange={(open) => {
          setIsAuthDialogOpen(open);
          if (!open) {
            setAuthDialogHostId(null);
          }
        }}
        onShowToast={onShowToast}
      />

      <SshConnectionDialog
        existingConnections={sortedSshConnections}
        mode={sshDialogMode}
        connection={editingConnection}
        isOpen={isSshDialogOpen}
        isSaving={isSavingSshConnection}
        onClose={() => {
          if (!isSavingSshConnection) {
            setIsSshDialogOpen(false);
          }
        }}
        onSave={(draft) => void handleSaveSshConnection(draft)}
      />

      <DeleteConnectionDialog
        connection={connectionToDelete}
        isDeleting={isDeletingConnection}
        open={
          connectionToDelete != null &&
          isRemoteControlConnection(connectionToDelete)
        }
        onConfirm={() => void handleDeleteConnection()}
        onOpenChange={(open) => {
          if (!open && !isDeletingConnection) {
            setConnectionToDelete(null);
          }
        }}
      />

      <ConnectionDetailsDialog
        connection={detailsConnection}
        response={detailsConnection == null ? null : (connectionStates[detailsConnection.hostId] ?? null)}
        open={detailsConnection != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsConnection(null);
          }
        }}
        onShowToast={onShowToast}
      />
    </>
  );
}

function LocalDeviceSettingsSection({
  connectedSettings,
  onShowToast,
}: {
  connectedSettings: ReturnType<typeof useConnectedSettings>;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [isLoadingRemoteControlEnabled, setIsLoadingRemoteControlEnabled] = useState(true);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<LocalDeviceSetupStep | null>(null);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [showStartSetupError, setShowStartSetupError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const features = await listExperimentalFeaturesForHost(LOCAL_SETTINGS_HOST_ID);
        if (!cancelled) {
          setRemoteControlEnabled(
            features.find((feature) => feature.name === "remote_control")?.enabled === true,
          );
        }
      } catch {
        if (!cancelled) {
          setRemoteControlEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRemoteControlEnabled(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSetupDialogOpen || setupStep !== "waiting") {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      void hasConnectedRemoteControlClients()
        .then((hasConnectedClients) => {
          if (!cancelled && hasConnectedClients) {
            setSetupStep("connected");
          }
        })
        .catch(() => undefined);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSetupDialogOpen, setupStep]);

  const closeSetupDialog = () => {
    setIsSetupDialogOpen(false);
    setSetupStep(null);
    setShowStartSetupError(false);
  };

  const enableRemoteControlDirectly = async () => {
    await setExperimentalFeatureForHost(LOCAL_SETTINGS_HOST_ID, "remote_control", true);
    setRemoteControlEnabled(true);
  };

  const handleStartSetup = async () => {
    setIsSetupInProgress(true);
    setShowStartSetupError(false);
    try {
      const response = await readRemoteControlMfaRequiredButDisabled();
      setSetupStep(response.mfaRequiredButDisabled ? "mfa-required" : "allow-host");
    } catch {
      setShowStartSetupError(true);
    } finally {
      setIsSetupInProgress(false);
    }
  };

  const handleAllowHost = async () => {
    setIsSetupInProgress(true);
    try {
      const hasConnectedClients = await hasConnectedRemoteControlClients();
      await enableRemoteControlDirectly();
      setSetupStep(hasConnectedClients ? "connected" : "waiting");
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.localHost.remoteControl.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setIsSetupInProgress(false);
    }
  };

  const handleFinishSetup = async () => {
    await Promise.all([
      setGlobalState("has-completed-codex-mobile-setup", true),
      setGlobalState("has-seen-codex-mobile-home-announcement", true),
    ]);
    closeSetupDialog();
  };

  const handleRemoteControlChange = async (checked: boolean) => {
    setIsLoadingRemoteControlEnabled(true);
    try {
      if (!checked) {
        await setExperimentalFeatureForHost(LOCAL_SETTINGS_HOST_ID, "remote_control", false);
        setRemoteControlEnabled(false);
        return;
      }

      const completedSetup = await getGlobalState("has-completed-codex-mobile-setup");
      if (completedSetup.value === true) {
        await enableRemoteControlDirectly();
        return;
      }

      setShowStartSetupError(false);
      setSetupStep("initial");
      setIsSetupDialogOpen(true);
      return;
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.localHost.remoteControl.error"),
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoadingRemoteControlEnabled(false);
    }
  };

  return (
    <>
      <SettingsGroup className="gap-2">
        <SettingsGroup.Header
          className="h-auto"
          title={t("settings.remoteConnections.localHost.header.title")}
        />
        <SettingsGroup.Content>
          <SettingsSurface className="rounded-xl">
            <SettingsRow
              icon={<DeviceSettingsIcon className="icon-base" />}
              label={t("settings.remoteConnections.localHost.remoteControl.label")}
              control={
                <ToggleSwitch
                  ariaLabel={t("settings.remoteConnections.localHost.remoteControl.label")}
                  checked={remoteControlEnabled}
                  disabled={isLoadingRemoteControlEnabled}
                  onChange={(checked) => void handleRemoteControlChange(checked)}
                />
              }
            />
            {connectedSettings.showKeepComputerAwake ? (
              <SettingsRow
                icon={<KeepAliveIcon className="icon-base" />}
                label={t("settings.remoteConnections.localHost.keepLive.label")}
                control={
                  <ToggleSwitch
                    ariaLabel={t("settings.remoteConnections.localHost.keepLive.label")}
                    checked={connectedSettings.keepComputerAwake}
                    disabled={connectedSettings.keepComputerAwakeToggleDisabled}
                    onChange={(checked) => void connectedSettings.onKeepComputerAwakeChange(checked)}
                  />
                }
              />
            ) : null}
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SetupDialog
        computerUseEnabled={connectedSettings.computerUseEnabled}
        computerUseToggleDisabled={connectedSettings.computerUseToggleDisabled}
        installModal={connectedSettings.installModal}
        keepComputerAwake={connectedSettings.keepComputerAwake}
        keepComputerAwakeToggleDisabled={connectedSettings.keepComputerAwakeToggleDisabled}
        onAllowHost={() => void handleAllowHost()}
        onComputerUseEnabledChange={(enabled) =>
          void connectedSettings.onComputerUseEnabledChange(enabled)
        }
        onContinueOnChatGpt={() => void openInBrowser("https://chatgpt.com/#settings/Security")}
        onFinishSetup={() => void handleFinishSetup()}
        onInstallChromeExtension={connectedSettings.onInstallChromeExtension}
        onKeepComputerAwakeChange={(enabled) =>
          void connectedSettings.onKeepComputerAwakeChange(enabled)
        }
        onOpenChange={(open) => {
          if (!open) {
            closeSetupDialog();
          }
        }}
        onSkip={closeSetupDialog}
        onStartSetup={() => void handleStartSetup()}
        open={isSetupDialogOpen}
        setupInProgress={isSetupInProgress}
        showKeepComputerAwake={connectedSettings.showKeepComputerAwake}
        showStartSetupError={showStartSetupError}
        step={setupStep ?? "initial"}
      />
    </>
  );
}

function RemoteControlClientsSection({
  clients,
  isLoading,
}: {
  clients: RemoteControlClient[] | null;
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const deviceLabel = useMemo(() => {
    const platform = typeof navigator === "undefined" ? "" : navigator.platform;
    if (/^Win/i.test(platform)) {
      return t("settings.remoteConnections.remoteControlClients.deviceLabel.pc");
    }
    if (/^Mac/i.test(platform)) {
      return t("settings.remoteConnections.remoteControlClients.deviceLabel.mac");
    }
    return t("settings.remoteConnections.remoteControlClients.deviceLabel.computer");
  }, [t]);

  if (clients == null && !isLoading) {
    return null;
  }

  return (
    <SettingsGroup className="gap-2">
      <SettingsGroup.Header
        className="h-auto"
        title={t("settings.remoteConnections.remoteControlClients.header.title", {
          device: deviceLabel,
        })}
      />
      <SettingsGroup.Content>
        <SettingsSurface className="rounded-xl">
          {isLoading ? (
            <div className="p-3 text-sm text-token-text-secondary">
              {t("settings.remoteConnections.remoteControlClients.loading")}
            </div>
          ) : null}
          {!isLoading && (clients?.length ?? 0) === 0 ? (
            <SettingsRow
              label={t("settings.remoteConnections.remoteControlClients.empty")}
              control={null}
            />
          ) : null}
          {clients?.map((client) => (
            <SettingsRow
              key={client.client_id}
              icon={<ControllingDeviceIcon className="icon-sm" />}
              label={client.display_name ?? client.device_model ?? client.platform ?? client.client_id}
              description={
                client.last_seen_at == null
                  ? t("settings.remoteConnections.remoteControlClients.authorized")
                  : (
                    <RemoteControlClientLastSeen
                      timestampMs={Date.parse(client.last_seen_at)}
                    />
                  )
              }
              control={null}
            />
          ))}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function DeviceConnectionsSection({
  connections,
  remoteControlConnectionsState,
  connectionStates,
  isLoading,
  onAddConnection,
  onDeleteConnection,
  onDeleteSshConnection,
  onEditConnection,
  onOpenDetails,
  onLoginRequired,
  onLogoutConnection,
  onNavigateToCreateRemoteProject,
  onRenameRemoteControlConnection,
  onRefreshConnections,
  onRestartConnection,
  onToggleAutoConnect,
  isRefreshingConnections,
  pendingAutoConnectHostId,
}: {
  connections: DeviceConnection[];
  remoteControlConnectionsState: RemoteControlConnectionsState;
  connectionStates: DeviceConnectionStateByHostId;
  isLoading: boolean;
  onAddConnection: () => void;
  onDeleteConnection: (connection: DeviceConnection) => void;
  onDeleteSshConnection: (connection: RemoteConnection) => void;
  onEditConnection: (hostId: string) => void;
  onOpenDetails: (connection: DeviceConnection) => void;
  onLoginRequired: (hostId: string) => void;
  onLogoutConnection: (hostId: string) => Promise<void> | void;
  onNavigateToCreateRemoteProject?: () => void;
  onRenameRemoteControlConnection: (
    connection: RemoteControlConnection,
    name: string,
  ) => Promise<void> | void;
  onRefreshConnections: () => void;
  onRestartConnection: (hostId: string) => void;
  onToggleAutoConnect: (hostId: string, autoConnect: boolean) => void;
  isRefreshingConnections: boolean;
  pendingAutoConnectHostId: string | null;
}) {
  const { t } = useI18n();
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingEnvId, setSavingEnvId] = useState<string | null>(null);
  const trimmedDraftName = draftName.trim();
  const hasConnectedConnection = connections.some((connection) => {
    return (
      !isRemoteControlConnection(connection) &&
      connectionStates[connection.hostId]?.state === "connected"
    );
  });
  const showEmptyState =
    connections.length === 0 && !remoteControlConnectionsState.authRequired;

  const handleStartEditing = (connection: RemoteControlConnection) => {
    setEditingEnvId(connection.envId);
    setDraftName(connection.displayName);
  };

  const handleCancelEditing = () => {
    setEditingEnvId(null);
    setDraftName("");
  };

  const handleSaveRemoteControlConnection = async (
    connection: RemoteControlConnection,
  ) => {
    if (trimmedDraftName.length === 0 || savingEnvId != null) {
      return;
    }
    if (trimmedDraftName === connection.displayName) {
      handleCancelEditing();
      return;
    }

    setSavingEnvId(connection.envId);
    try {
      await onRenameRemoteControlConnection(connection, trimmedDraftName);
      handleCancelEditing();
    } catch {
      // Toast is owned by the mutation caller.
    } finally {
      setSavingEnvId(null);
    }
  };

  return (
    <SettingsGroup className="gap-2">
      <SettingsGroup.Header
        className="h-auto"
        title={t("settings.remoteConnections.deviceConnections.header.title")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              aria-label={t("settings.remoteConnections.refresh")}
              title={t("settings.remoteConnections.refresh")}
              color="ghost"
              size="toolbar"
              uniform
              disabled={isRefreshingConnections}
              loading={isRefreshingConnections}
              onClick={onRefreshConnections}
            >
              <RefreshIcon className="h-4 w-4" />
            </Button>
            <Button
              color="secondary"
              size="toolbar"
              onClick={onAddConnection}
            >
              <PlusIcon className="h-4 w-4" />
              {t("settings.remoteConnections.add")}
            </Button>
            {onNavigateToCreateRemoteProject != null && hasConnectedConnection ? (
              <Button
                color="secondary"
                size="toolbar"
                onClick={onNavigateToCreateRemoteProject}
              >
                {t("settings.remoteConnections.createRemoteProject")}
              </Button>
            ) : null}
          </div>
        }
      />
      <SettingsGroup.Content>
        <SettingsSurface className="rounded-xl">
          {isLoading ? (
            <div className="p-3 text-sm text-token-text-secondary">
              {t("settings.remoteConnections.deviceConnections.loading")}
            </div>
          ) : null}
          {!isLoading && showEmptyState ? (
            <SettingsRow
              label={t("settings.remoteConnections.deviceConnections.empty")}
              control={null}
            />
          ) : null}
          {connections.map((connection) => {
            if (isRemoteControlConnection(connection)) {
              return (
                <RemoteControlConnectionRow
                  key={connection.hostId}
                  connection={connection}
                  clientAuthorized={remoteControlConnectionsState.clientAuthorized}
                  draftName={draftName}
                  editingEnvId={editingEnvId}
                  pendingAutoConnectHostId={pendingAutoConnectHostId}
                  response={connectionStates[connection.hostId] ?? null}
                  savingEnvId={savingEnvId}
                  trimmedDraftName={trimmedDraftName}
                  onCancelEditing={handleCancelEditing}
                  onDeleteConnection={onDeleteConnection}
                  onDraftNameChange={setDraftName}
                  onLogoutConnection={onLogoutConnection}
                  onOpenDetails={onOpenDetails}
                  onSave={handleSaveRemoteControlConnection}
                  onStartEditing={handleStartEditing}
                  onToggleAutoConnect={onToggleAutoConnect}
                />
              );
            }

            return (
              <SshConnectionRow
                key={connection.hostId}
                connection={connection}
                pendingAutoConnectHostId={pendingAutoConnectHostId}
                response={connectionStates[connection.hostId] ?? null}
                onDeleteConnection={onDeleteSshConnection}
                onEditConnection={onEditConnection}
                onLoginRequired={onLoginRequired}
                onLogoutConnection={onLogoutConnection}
                onOpenDetails={onOpenDetails}
                onRestartConnection={onRestartConnection}
                onToggleAutoConnect={onToggleAutoConnect}
              />
            );
          })}
          {!isLoading && remoteControlConnectionsState.authRequired ? (
            <div className="p-3 text-sm text-token-text-secondary">
              {t("settings.remoteControlConnections.authRequired")}
            </div>
          ) : null}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function SshConnectionRow({
  connection,
  pendingAutoConnectHostId,
  response,
  onDeleteConnection,
  onEditConnection,
  onLoginRequired,
  onLogoutConnection,
  onOpenDetails,
  onRestartConnection,
  onToggleAutoConnect,
}: {
  connection: RemoteConnection;
  pendingAutoConnectHostId: string | null;
  response: AppServerConnectionStateResponse | null;
  onDeleteConnection: (connection: RemoteConnection) => void;
  onEditConnection: (hostId: string) => void;
  onLoginRequired: (hostId: string) => void;
  onLogoutConnection: (hostId: string) => Promise<void> | void;
  onOpenDetails: (connection: DeviceConnection) => void;
  onRestartConnection: (hostId: string) => void;
  onToggleAutoConnect: (hostId: string, autoConnect: boolean) => void;
}) {
  const { t } = useI18n();
  const resolvedResponse = response ?? {
    state: "disconnected" as const,
    error: null,
    appServerVersion: null,
    installedCodexVersion: null,
  };
  const connectionError = normalizeConnectionError(resolvedResponse.error);
  const restartAvailableNotice = buildRestartAvailableNotice({
    appServerVersion: resolvedResponse.appServerVersion,
    installedCodexVersion: resolvedResponse.installedCodexVersion,
    state: resolvedResponse.state,
  });
  const {
    bannerError,
    isRestartAvailableNotice,
    statusState,
  } = buildSshBannerState({
    error: connectionError,
    restartAvailableNotice,
    state: resolvedResponse.state,
  });
  const meta = buildConnectionMeta(t, statusState, bannerError);
  const isPendingAutoConnect = pendingAutoConnectHostId === connection.hostId;
  const canRestart =
    resolvedResponse.state === "connected" ||
    connectionError?.code === "login-required" ||
    connectionError?.code === "update-required" ||
    connectionError?.code === "restart-required";

  return (
    <SettingsRow
      label={connection.displayName}
      description={t("settings.remoteConnections.deviceConnections.sshSubtitle")}
      status={
        <ConnectionStatusDot
          label={meta.label}
          message={meta.message}
          state={statusState}
        />
      }
      banner={
        bannerError == null ? null : (
          <SshConnectionBanner
            action={buildSshBannerAction({
              hostId: connection.hostId,
              message: meta.message,
              onLoginRequired,
              onRestartConnection,
              action: meta.action,
            })}
            isInformational={isRestartAvailableNotice}
            message={meta.message}
          />
        )
      }
      control={
        <div className="flex items-center gap-2">
          <ConnectionActionsMenu
            actionsLabel={t("settings.remoteConnections.table.actions.ariaLabel", {
              connectionName: connection.displayName,
            })}
            detailsLabel={t("settings.remoteConnections.detailsMenu")}
            deleteLabel={t("settings.remoteConnections.deleteConnection")}
            deleteTooltip={t("settings.remoteConnections.deleteConnection")}
            editLabel={t("settings.remoteConnections.editConnection")}
            editTooltip={t("settings.remoteConnections.editConnection")}
            editDisabled={false}
            deleteDisabled={false}
            onDelete={() => onDeleteConnection(connection)}
            onDetails={() => onOpenDetails(connection)}
            onEdit={() => onEditConnection(connection.hostId)}
            onLogout={
              resolvedResponse.state === "connected"
                ? () => void onLogoutConnection(connection.hostId)
                : undefined
            }
            onRestart={
              canRestart ? () => onRestartConnection(connection.hostId) : undefined
            }
            restartLabel={t("settings.remoteConnections.restartConnection")}
          />
          <ToggleSwitch
            ariaLabel={t("settings.remoteConnections.table.autoConnect.ariaLabel", {
              connectionName: connection.displayName,
            })}
            checked={connection.autoConnect}
            disabled={isPendingAutoConnect}
            onChange={(checked) => onToggleAutoConnect(connection.hostId, checked)}
          />
        </div>
      }
    />
  );
}

type SshBannerAction =
  | { kind: "login"; label: string }
  | { kind: "restart"; label: string; tooltipText?: string };

type SshBannerModel = {
  label: string;
  message: string;
  action: SshBannerAction | null;
};

function SshConnectionBanner({
  action,
  isInformational,
  message,
}: {
  action: { label: string; onClick: () => void; tooltipText?: string } | null;
  isInformational: boolean;
  message: string;
}) {
  const Icon = isInformational ? InfoIcon : WarningIcon;
  const iconClassName = isInformational
    ? "icon-xs shrink-0 text-token-charts-blue"
    : "icon-xs shrink-0 text-token-charts-red";
  const button = action == null ? null : (
    <Button
      className="h-6 shrink-0 !bg-white enabled:hover:!bg-white/90 dark:!bg-token-bg-primary dark:enabled:hover:!bg-token-bg-primary/90"
      color="secondary"
      size="default"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );

  return (
    <div className="mt-1 flex min-w-0 items-center justify-between gap-3 rounded-[18px] bg-token-foreground/5 py-1.5 pr-1.5 pl-4 text-sm text-token-text-secondary">
      <div className="mr-2 flex min-w-0 flex-1 items-center gap-2">
        <Icon aria-hidden="true" className={iconClassName} />
        <span className="min-w-0 flex-1 break-words">{message}</span>
      </div>
      {action?.tooltipText == null || button == null ? (
        button
      ) : (
        <Tooltip tooltipContent={action.tooltipText}>{button}</Tooltip>
      )}
    </div>
  );
}

function ConnectionStatusDot({
  label,
  message,
  state,
}: {
  label: string;
  message: string;
  state: AppServerConnectionState;
}) {
  const dot =
    state === "connecting" ? (
      <span
        aria-label={label}
        className="icon-2xs inline-flex shrink-0 items-center justify-center text-token-description-foreground"
        role="img"
      >
        <Spinner className="icon-2xs" />
      </span>
    ) : state === "restarting" ? (
      <span
        aria-label={label}
        className="icon-2xs inline-flex shrink-0 items-center justify-center text-token-charts-blue"
        role="img"
      >
        <Spinner className="icon-2xs text-token-charts-blue" />
      </span>
    ) : state === "error" ? (
      <span
        aria-label={label}
        className="icon-2xs inline-flex shrink-0 items-center justify-center text-token-charts-red"
        role="img"
      >
        <WarningIcon className="icon-2xs text-token-charts-red" />
      </span>
    ) : (
      <span
        aria-label={label}
        className={buildConnectionDotClassName(state)}
        role="img"
      />
    );

  return <Tooltip tooltipContent={message}>{dot}</Tooltip>;
}

function RemoteControlConnectionRow({
  connection,
  clientAuthorized,
  draftName,
  editingEnvId,
  pendingAutoConnectHostId,
  response,
  savingEnvId,
  trimmedDraftName,
  onCancelEditing,
  onDeleteConnection,
  onDraftNameChange,
  onLogoutConnection,
  onOpenDetails,
  onSave,
  onStartEditing,
  onToggleAutoConnect,
}: {
  connection: RemoteControlConnection;
  clientAuthorized: boolean;
  draftName: string;
  editingEnvId: string | null;
  pendingAutoConnectHostId: string | null;
  response: AppServerConnectionStateResponse | null;
  savingEnvId: string | null;
  trimmedDraftName: string;
  onCancelEditing: () => void;
  onDeleteConnection: (connection: DeviceConnection) => void;
  onDraftNameChange: (value: string) => void;
  onLogoutConnection: (hostId: string) => Promise<void> | void;
  onOpenDetails: (connection: DeviceConnection) => void;
  onSave: (connection: RemoteControlConnection) => Promise<void> | void;
  onStartEditing: (connection: RemoteControlConnection) => void;
  onToggleAutoConnect: (hostId: string, autoConnect: boolean) => void;
}) {
  const { t } = useI18n();
  const resolvedResponse = response ?? {
    state: "disconnected" as const,
    error: null,
    appServerVersion: null,
    installedCodexVersion: null,
  };
  const compatibleVersion = isCompatibleRemoteControlVersion(
    connection.appServerVersion,
  );
  const canConnect =
    clientAuthorized && connection.online && compatibleVersion;
  const isEditing = editingEnvId === connection.envId;
  const isSaving = savingEnvId === connection.envId;
  const deleteDisabled =
    isEditing || savingEnvId != null || connection.online;
  const editDisabled = isEditing || savingEnvId != null;

  return (
    <SettingsRow
      className={canConnect ? undefined : "text-token-text-secondary opacity-60"}
      label={
        isEditing ? (
          <input
            aria-label={t("settings.remoteControlConnections.rename.inputLabel")}
            className="min-w-0 rounded-md border border-token-input-border bg-token-input-background px-2 py-1 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border disabled:bg-token-foreground/5 disabled:text-token-text-secondary disabled:opacity-100"
            value={draftName}
            disabled={isSaving}
            onChange={(event) => onDraftNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSave(connection);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelEditing();
              }
            }}
            autoFocus
          />
        ) : (
          connection.displayName
        )
      }
      description={buildRemoteControlConnectionSubtitle(t, connection, compatibleVersion)}
      status={
        <RemoteControlConnectionStatus
          connection={connection}
          state={resolvedResponse.state}
        />
      }
      control={
        isEditing ? (
          <div className="flex items-center gap-1">
            <Button
              aria-label={t("settings.remoteControlConnections.rename.save")}
              color="ghost"
              size="icon"
              loading={isSaving}
              disabled={trimmedDraftName.length === 0 || savingEnvId != null}
              onClick={() => void onSave(connection)}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label={t("settings.remoteControlConnections.rename.cancel")}
              color="ghost"
              size="icon"
              disabled={isSaving}
              onClick={onCancelEditing}
            >
              <CloseTabIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <ConnectionActionsMenu
              actionsLabel={t("settings.remoteConnections.table.actions.ariaLabel", {
                connectionName: connection.displayName,
              })}
              detailsLabel={t("settings.remoteConnections.detailsMenu")}
              deleteLabel={t("settings.remoteConnections.deleteConnection")}
              deleteTooltip={
                connection.online
                  ? t("settings.remoteControlConnections.delete.offlineOnly")
                  : t("settings.remoteConnections.deleteConnection")
              }
              editLabel={t("settings.remoteControlConnections.rename")}
              editTooltip={t("settings.remoteControlConnections.rename")}
              editDisabled={editDisabled}
              deleteDisabled={deleteDisabled}
              onDelete={() => onDeleteConnection(connection)}
              onDetails={() => onOpenDetails(connection)}
              onEdit={() => onStartEditing(connection)}
              onLogout={
                resolvedResponse.state === "connected"
                  ? () => void onLogoutConnection(connection.hostId)
                  : undefined
              }
            />
            <ToggleSwitch
              ariaLabel={t("settings.remoteControlConnections.table.connect.ariaLabel", {
                connectionName: connection.displayName,
              })}
              checked={connection.autoConnect}
              disabled={!canConnect || pendingAutoConnectHostId === connection.hostId}
              onChange={(checked) => onToggleAutoConnect(connection.hostId, checked)}
            />
          </div>
        )
      }
    />
  );
}

function RemoteConnectionAuthDialog({
  hostId,
  open,
  onOpenChange,
  onShowToast,
}: {
  hostId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isApiKeyEntryVisible, setIsApiKeyEntryVisible] = useState(false);
  const [isChatGptSignInPending, setIsChatGptSignInPending] = useState(false);
  const [isApiKeySignInPending, setIsApiKeySignInPending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const close = (abortPendingLogin: boolean) => {
    if (abortPendingLogin) {
      abortControllerRef.current?.abort();
    }
    abortControllerRef.current = null;
    setApiKeyValue("");
    setIsApiKeyEntryVisible(false);
    setIsChatGptSignInPending(false);
    setIsApiKeySignInPending(false);
    onOpenChange(false);
  };

  const showErrorToast = (error: unknown) => {
    onShowToast?.({
      tone: "error",
      message: t("settings.remoteConnections.auth.error", {
        message: getErrorMessage(error),
      }),
    });
  };

  const handleChatGptSignIn = async () => {
    if (hostId == null) {
      showErrorToast("Remote connection manager is unavailable.");
      return;
    }

    if (isChatGptSignInPending) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsChatGptSignInPending(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsChatGptSignInPending(true);

    try {
      const result = await loginChatGptWithCompletion({
        hostId,
        signal: controller.signal,
      });
      await openInBrowser(result.authUrl);
      const completion = await result.completion;
      if (!completion.success) {
        showErrorToast(completion.error ?? "Unknown error");
        return;
      }
      close(false);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") {
        return;
      }
      showErrorToast(error);
    } finally {
      abortControllerRef.current = null;
      setIsChatGptSignInPending(false);
    }
  };

  const handleApiKeySubmit = async () => {
    if (hostId == null || apiKeyValue.trim().length === 0 || isApiKeySignInPending) {
      return;
    }

    setIsApiKeySignInPending(true);
    try {
      await loginApiKeyForHost(hostId, apiKeyValue.trim());
      close(false);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsApiKeySignInPending(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <SettingsDialog
      contentProps={{ "aria-describedby": undefined }}
      hideCloseButton
      hideHeader
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close(true);
          return;
        }
        onOpenChange(true);
      }}
      open={open}
      size="compact"
      title={t("settings.remoteConnections.auth.title")}
      bodyClassName="gap-2 px-6 py-5"
    >
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="heading-dialog min-w-0 font-semibold">
              {t("settings.remoteConnections.auth.title")}
            </h2>
            <div className="text-token-description-foreground">
              {t("settings.remoteConnections.auth.description")}
            </div>
          </div>
          <Button
            aria-label={t("settings.remoteConnections.auth.closeIcon")}
            className="-mt-1 -mr-1 shrink-0"
            color="ghost"
            size="icon"
            onClick={() => close(true)}
          >
            <CloseIcon className="icon-xs" />
          </Button>
        </div>
        {!isApiKeyEntryVisible ? (
          <div className="flex justify-center pt-2">
            <div className="flex w-full flex-col gap-3">
              <Button
                size="large"
                className="justify-center"
                loading={isChatGptSignInPending}
                onClick={() => void handleChatGptSignIn()}
              >
                {t("auth.signInWithChatGpt")}
              </Button>
              <Button
                color="secondary"
                size="large"
                className="justify-center"
                onClick={() => setIsApiKeyEntryVisible(true)}
              >
                {t("auth.useApiKey")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-token-text-primary">
                {t("auth.openAiApiKey")}
              </span>
              <input
                value={apiKeyValue}
                onChange={(event) => setApiKeyValue(event.target.value)}
                placeholder={t("auth.apiKeyPlaceholder")}
                className="w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-2 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button
                color="ghost"
                type="button"
                onClick={() => {
                  setApiKeyValue("");
                  setIsApiKeyEntryVisible(false);
                }}
              >
                {t("settings.remoteConnections.auth.back")}
              </Button>
              <Button
                loading={isApiKeySignInPending}
                disabled={apiKeyValue.trim().length === 0}
                type="button"
                onClick={() => void handleApiKeySubmit()}
              >
                {t("auth.apiKeyConfirm")}
              </Button>
            </div>
          </div>
        )}
        <div className="flex w-full items-center justify-end gap-3">
          <Button
            color="ghost"
            type="button"
            onClick={() => close(true)}
          >
            {t("settings.remoteConnections.auth.close")}
          </Button>
        </div>
      </>
    </SettingsDialog>
  );
}

function SshConnectionDialog({
  connection,
  existingConnections,
  isOpen,
  isSaving,
  mode,
  onClose,
  onSave,
}: {
  connection: RemoteConnection | null;
  existingConnections: RemoteConnection[];
  isOpen: boolean;
  isSaving: boolean;
  mode: SshDialogMode;
  onClose: () => void;
  onSave: (draft: SshDraft) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SshDraft>(() => createEmptySshDraft());
  const [validationErrors, setValidationErrors] = useState<SshValidationError[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(connection == null ? createEmptySshDraft() : createDraftFromConnection(connection));
    setValidationErrors([]);
  }, [connection, isOpen]);

  if (!isOpen) {
    return null;
  }

  const isAliasTarget = mode === "edit" && draft.targetKind === "alias";
  const dialogWidthClassName = mode === "add" ? "max-w-[520px]" : "max-w-[460px]";

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isSaving) {
      return;
    }
    const nextErrors = validateSshDraft({
      draft,
      existingConnections,
      editingHostId: connection?.hostId ?? null,
    });
    setValidationErrors(nextErrors);
    if (nextErrors.length === 0) {
      await onSave(draft);
    }
  };

  return (
    <SettingsDialog
      contentClassName={dialogWidthClassName}
      footer={(
        <SettingsDialogFooter
          cancelLabel={t("settings.remoteConnections.dialog.cancel")}
          confirmLabel={t("settings.remoteConnections.dialog.apply")}
          confirmLoading={isSaving}
          onCancel={onClose}
          onConfirm={() => void handleSubmit()}
        />
      )}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={isOpen}
      size={mode === "add" ? "default" : "compact"}
      title={
        mode === "add"
          ? t("settings.remoteConnections.dialog.addTitle")
          : t("settings.remoteConnections.dialog.editTitle")
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        {validationErrors.length > 0 ? (
          <div className="rounded-md border border-token-border-error p-2 text-sm text-token-error-foreground">
            {validationErrors.map((error) => (
              <div key={error}>{t(getSshValidationMessageKey(error))}</div>
            ))}
          </div>
        ) : null}

        <div className={validationErrors.length > 0 ? "mt-4 grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4"}>
          <DialogField
            label={t("settings.remoteConnections.dialog.field.displayName")}
            value={draft.displayName}
            disabled={isSaving}
            onChange={(value) => setDraft((current) => ({ ...current, displayName: value }))}
          />

          <DialogField
            label={
              isAliasTarget
                ? t("settings.remoteConnections.dialog.field.alias")
                : t("settings.remoteConnections.dialog.field.sshHost")
            }
            placeholder={
              isAliasTarget
                ? undefined
                : t("settings.remoteConnections.dialog.field.sshHost.placeholder")
            }
            value={draft.sshHost}
            disabled={isSaving || isAliasTarget}
            onChange={(value) => setDraft((current) => ({ ...current, sshHost: value }))}
          />

          {!isAliasTarget ? (
            <>
              <DialogField
                label={t("settings.remoteConnections.dialog.field.sshPort")}
                description={t("settings.remoteConnections.dialog.field.optional")}
                value={draft.sshPort}
                disabled={isSaving}
                onChange={(value) => setDraft((current) => ({ ...current, sshPort: value }))}
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-token-text-primary">
                  {t("settings.remoteConnections.dialog.authMode.ariaLabel")}
                </span>
                <AuthModeSegmentedControl
                  value={draft.authMode}
                  disabled={isSaving}
                  onChange={(authMode) => setDraft((current) => ({ ...current, authMode }))}
                />
              </div>

              {draft.authMode === "identity" ? (
                <DialogField
                  label={t("settings.remoteConnections.dialog.field.identity")}
                  value={draft.identity}
                  disabled={isSaving}
                  onChange={(value) => setDraft((current) => ({ ...current, identity: value }))}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </form>
    </SettingsDialog>
  );
}

function DeleteConnectionDialog({
  connection,
  isDeleting,
  open,
  onConfirm,
  onOpenChange,
}: {
  connection: DeviceConnection | null;
  isDeleting: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  if (!open || connection == null) {
    return null;
  }

  return (
    <SettingsDialog
      footer={(
        <SettingsDialogFooter
          cancelLabel={t("settings.remoteControlConnections.deleteDialog.cancel")}
          confirmLabel={t("settings.remoteControlConnections.deleteDialog.confirm")}
          confirmLoading={isDeleting}
          confirmTone="danger"
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      )}
      onOpenChange={onOpenChange}
      open={open}
      size="compact"
      title={t("settings.remoteControlConnections.deleteDialog.title", {
        connectionName: connection.displayName,
      })}
      subtitle={t("settings.remoteControlConnections.deleteDialog.subtitle")}
    />
  );
}

function ConnectionDetailsDialog({
  connection,
  response,
  open,
  onOpenChange,
  onShowToast,
}: {
  connection: DeviceConnection | null;
  response: AppServerConnectionStateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();

  if (!open || connection == null) {
    return null;
  }

  const connectionError = normalizeConnectionError(response?.error ?? null);
  const detailRows = buildConnectionDetailRows(connection, response);
  const badgeLabel = isRemoteControlConnection(connection)
    ? buildRemoteControlAvailabilityLabel(
        t,
        connection,
        response?.state ?? "disconnected",
      )
    : buildConnectionMeta(
        t,
        response?.state ?? "disconnected",
        connectionError,
      ).label;

  const handleCopy = async (
    value: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.details.copyError"),
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      onShowToast?.({
        tone: "success",
        message: t("settings.remoteConnections.details.copySuccess"),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.remoteConnections.details.copyError"),
      });
    }
  };

  return (
    <SettingsDialog
      contentClassName="bg-token-bg-primary"
      dialogCloseClassName="[&>svg]:icon-sm"
      hideHeader
      bodyClassName="gap-2 px-6 py-5"
      onOpenChange={onOpenChange}
      open={open}
      title={connection.displayName}
    >
      <div className="flex flex-col gap-2">
        <div className="heading-dialog break-words pr-8 text-lg leading-snug font-semibold">
          {connection.displayName}
        </div>
        <div className="text-token-description-foreground">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-token-foreground/10 py-0.5 pr-2 pl-1 text-xs font-medium text-token-text-primary">
            {isRemoteControlConnection(connection) ? (
              <RemoteControlConnectionStatus
                connection={connection}
                state={response?.state ?? "disconnected"}
              />
            ) : (
              <ConnectionStatusDot
                label={badgeLabel}
                message={buildConnectionMeta(
                  t,
                  response?.state ?? "disconnected",
                  connectionError,
                ).message}
                state={response?.state ?? "disconnected"}
              />
            )}
            <span>
              {isRemoteControlConnection(connection)
                ? t("settings.remoteConnections.deviceConnections.signedInDeviceSubtitle")
                : t("settings.remoteConnections.deviceConnections.sshSubtitle")}
            </span>
          </span>
        </div>
      </div>
      <div className="pt-0">
        <div className="overflow-hidden rounded-xl border border-token-border">
          {detailRows.map((row) => (
            <div
              key={row.id}
              className="flex min-h-9 items-center justify-between gap-3 border-t border-token-border px-3 py-2 first:border-t-0"
            >
              <div className="shrink-0 text-sm text-token-text-secondary">
                {t(row.label)}
              </div>
              <div className="max-w-[80%] min-w-0 text-right text-sm text-token-text-primary">
                {row.copyValue == null ? (
                  typeof row.value === "string" ? (
                    <span className="block max-w-full min-w-0 truncate">
                      {row.value.trim().length ? row.value : "—"}
                    </span>
                  ) : (
                    row.value ?? "—"
                  )
                ) : (
                  <button
                    type="button"
                    className="block max-w-full min-w-0 cursor-interaction text-right"
                    onClick={(event) => void handleCopy(row.copyValue!, event)}
                  >
                    {typeof row.value === "string" ? (
                      <span className="block max-w-full min-w-0 truncate">
                        {row.value.trim().length ? row.value : "—"}
                      </span>
                    ) : (
                      row.value ?? "—"
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SettingsDialog>
  );
}

function ConnectionActionsMenu({
  actionsLabel,
  deleteDisabled,
  deleteLabel,
  deleteTooltip,
  detailsLabel,
  editDisabled,
  editLabel,
  editTooltip,
  onDelete,
  onDetails,
  onEdit,
  onLogout,
  onRestart,
  restartLabel,
}: {
  actionsLabel: string;
  deleteDisabled: boolean;
  deleteLabel: string;
  deleteTooltip: string;
  detailsLabel: string;
  editDisabled: boolean;
  editLabel: string;
  editTooltip: string;
  onDetails: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onLogout?: () => void;
  onRestart?: () => void;
  restartLabel?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusFirstItemRef = useRef(false);

  const closeMenu = (options?: { restoreFocus?: boolean }) => {
    shouldFocusFirstItemRef.current = false;
    setIsOpen(false);
    if (options?.restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const focusEnabledMenuItem = (startIndex: number, direction: 1 | -1) => {
    for (
      let index = startIndex;
      index >= 0 && index < menuItemRefs.current.length;
      index += direction
    ) {
      const nextItem = menuItemRefs.current[index];
      if (nextItem == null || nextItem.disabled) {
        continue;
      }
      nextItem.focus();
      return;
    }
  };

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
    const handleFocusIn = (event: FocusEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldFocusFirstItemRef.current) {
      return;
    }
    shouldFocusFirstItemRef.current = false;
    focusEnabledMenuItem(0, 1);
  }, [isOpen]);

  const handleMenuItemKeyDown = (
    index: number,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEnabledMenuItem(index + 1, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusEnabledMenuItem(index - 1, -1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusEnabledMenuItem(0, 1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusEnabledMenuItem(menuItemRefs.current.length - 1, -1);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  };

  const menuItems = [
    {
      icon: <InfoIcon className="h-3.5 w-3.5" />,
      label: detailsLabel,
      disabled: false,
      tooltip: undefined,
      danger: false,
      onSelect: onDetails,
    },
    {
      icon: <PencilIcon className="h-3.5 w-3.5" />,
      label: editLabel,
      disabled: editDisabled,
      tooltip: editDisabled ? editTooltip : undefined,
      danger: false,
      onSelect: onEdit,
    },
    ...(onRestart != null && restartLabel != null
      ? [{
          icon: <RefreshIcon className="h-3.5 w-3.5" />,
          label: restartLabel,
          disabled: false,
          tooltip: undefined,
          danger: false,
          onSelect: onRestart,
        }]
      : []),
    ...(onLogout != null
      ? [{
          icon: <LogoutIcon className="h-3.5 w-3.5" />,
          label: t("settings.remoteConnections.logout"),
          disabled: false,
          tooltip: undefined,
          danger: false,
          onSelect: onLogout,
        }]
      : []),
    {
      icon: <TrashIcon className="h-3.5 w-3.5" />,
      label: deleteLabel,
      disabled: deleteDisabled,
      tooltip: deleteDisabled ? deleteTooltip : undefined,
      danger: true,
      onSelect: onDelete,
    },
  ];

  menuItemRefs.current = [];

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={triggerRef}
        aria-label={actionsLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t("settings.remoteConnections.detailsMenu")}
        color="ghost"
        size="toolbar"
        uniform
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          shouldFocusFirstItemRef.current = false;
          setIsOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          triggerRef.current = event.currentTarget;
          if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          shouldFocusFirstItemRef.current = true;
          setIsOpen(true);
        }}
      >
        <MoreActionsIcon className="h-3.5 w-3.5" />
      </Button>

      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div
            aria-orientation="vertical"
            className="max-h-80 overflow-y-auto"
            role="menu"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
              }
            }}
          >
            {menuItems.map((item, index) => (
              <MenuButton
                key={`${item.label}-${index}`}
                ref={(node) => {
                  menuItemRefs.current[index] = node;
                }}
                danger={item.danger}
                disabled={item.disabled}
                icon={item.icon}
                label={item.label}
                onKeyDown={(event) => handleMenuItemKeyDown(index, event)}
                onMouseMove={(event) => {
                  event.currentTarget.focus({ preventScroll: true });
                }}
                onSelect={() => {
                  closeMenu({ restoreFocus: true });
                  item.onSelect();
                }}
                role="menuitem"
                tabIndex={-1}
                tooltip={item.tooltip}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type MenuButtonProps = {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onMouseMove?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
  role?: "menuitem";
  tabIndex?: number;
  tooltip?: string;
};

const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onKeyDown,
  onMouseMove,
  onSelect,
  role,
  tabIndex,
  tooltip,
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      role={role}
      tabIndex={tabIndex}
      title={tooltip}
      onClick={() => {
        if (!disabled) {
          onSelect();
        }
      }}
      onKeyDown={onKeyDown}
      onMouseMove={onMouseMove}
      className={[
        "flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60",
        disabled ? "" : "app-nav-item-idle",
        danger ? "text-token-charts-red" : "",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
});

function SettingsRow({
  banner = null,
  className,
  control,
  description,
  icon,
  label,
  status,
}: {
  banner?: ReactNode;
  className?: string;
  control: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div
      className={[
        "grid min-h-16 items-center gap-x-3 gap-y-1 px-5 py-3",
        status == null
          ? "grid-cols-[minmax(0,1fr)_auto]"
          : "grid-cols-[auto_minmax(0,1fr)_auto]",
        className ?? "",
      ].join(" ")}
    >
      {status ? <span className="icon-2xs inline-flex shrink-0 items-center justify-center self-center">{status}</span> : null}
      <div className="min-w-0 text-base text-token-text-primary">{label}</div>
      <div className="row-span-2 flex shrink-0 items-center gap-2">{control}</div>
      {description ? (
        <div className={status ? "col-start-2 min-w-0 text-sm text-token-text-secondary" : "min-w-0 text-sm text-token-text-secondary"}>
          {description}
        </div>
      ) : null}
      {banner ? (
        <div className={status ? "col-span-2 col-start-2 min-w-0" : "col-span-2 min-w-0"}>
          {banner}
        </div>
      ) : null}
    </div>
  );
}

function DialogField({
  description,
  disabled = false,
  label,
  onChange,
  placeholder,
  value,
}: {
  description?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-token-text-primary">{label}</span>
      <input
        className="w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground disabled:bg-token-foreground/5 disabled:text-token-text-secondary"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {description ? <span className="text-xs text-token-text-secondary">{description}</span> : null}
    </label>
  );
}

function AuthModeSegmentedControl({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: SshAuthMode) => void;
  value: SshAuthMode;
}) {
  const { t } = useI18n();
  const options: SshAuthMode[] = ["none", "identity"];

  return (
    <div
      className="flex rounded-full bg-token-foreground/10 p-0.5"
      role="group"
      aria-label={t("settings.remoteConnections.dialog.authMode.ariaLabel")}
    >
      {options.map((option) => {
        const isSelected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            className={[
              "cursor-interaction flex h-7 flex-1 items-center justify-center rounded-full px-2 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "bg-token-dropdown-background text-token-foreground shadow-sm ring-1 ring-token-border/60"
                : "text-token-foreground hover:bg-token-foreground/5",
            ].join(" ")}
            onClick={() => onChange(option)}
          >
            {t(
              option === "none"
                ? "settings.remoteConnections.dialog.authMode.none"
                : "settings.remoteConnections.dialog.authMode.identity",
            )}
          </button>
        );
      })}
    </div>
  );
}

function buildConnectionMeta(
  t: (key: MessageKey, values?: MessageValues) => string,
  state: AppServerConnectionState,
  error: ConnectionError | null,
) : SshBannerModel {
  if (state === "error" && error?.code === "login-required") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.unauthed"),
      message: t("appServer.error.loginRequired"),
      action: {
        kind: "login",
        label: t("threadPage.remoteConnectionStatusBadge.login"),
      },
    };
  }
  if (state === "connected") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.connected"),
      message: t("threadPage.remoteConnectionStatusBadge.connected"),
      action: null,
    };
  }
  if (state === "connecting") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.connecting"),
      message: t("threadPage.remoteConnectionStatusBadge.connecting"),
      action: null,
    };
  }
  if (state === "restarting") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.restarting"),
      message: t("threadPage.remoteConnectionStatusBadge.restarting"),
      action: null,
    };
  }
  if (state === "error" && error?.code === "update-required") {
    const message = t("appServer.error.unsupportedVersion", {
      minVersion:
        error.minRequiredVersion ?? REMOTE_CONNECTION_MIN_REQUIRED_VERSION,
      currentVersion: error.currentVersion ?? "—",
    });
    return {
      label: t("threadPage.remoteConnectionStatusBadge.updateRequired"),
      message,
      action: null,
    };
  }
  if (state === "error" && error?.code === "restart-required") {
    const message =
      error.currentVersion == null || error.installedVersion == null
        ? t("appServer.error.genericRestartRequired")
        : t("appServer.error.restartAvailable", {
            currentVersion: error.currentVersion,
            installedVersion: error.installedVersion,
          });
    return {
      label: t("threadPage.remoteConnectionStatusBadge.restartRequired"),
      message,
      action: {
        kind: "restart",
        label: t("threadPage.remoteConnectionStatusBadge.restartNow"),
        tooltipText: t(
          "threadPage.remoteConnectionStatusBadge.restartNowTooltip",
        ),
      },
    };
  }
  if (state === "error" && error?.code === "connection-failed") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.error"),
      message: `${t("threadPage.remoteConnectionStatusBadge.error")}: ${error.message}`,
      action: null,
    };
  }
  if (state === "error") {
    return {
      label: t("threadPage.remoteConnectionStatusBadge.error"),
      message: t("threadPage.remoteConnectionStatusBadge.error"),
      action: null,
    };
  }
  return {
    label: t("threadPage.remoteConnectionStatusBadge.disconnected"),
    message: t("threadPage.remoteConnectionStatusBadge.disconnected"),
    action: null,
  };
}

function buildConnectionDotClassName(
  state: AppServerConnectionState,
) {
  if (state === "connected") {
    return "block size-2 rounded-full bg-token-charts-green";
  }
  if (state === "error") {
    return "block size-2 rounded-full bg-token-charts-red";
  }
  return "block size-2 rounded-full bg-gray-400";
}

function buildRestartAvailableNotice({
  appServerVersion,
  installedCodexVersion,
  state,
}: {
  appServerVersion: string | null;
  installedCodexVersion: string | null;
  state: AppServerConnectionState | null;
}) {
  if (
    state == null ||
    appServerVersion == null ||
    installedCodexVersion == null ||
    !isRestartVersionOutdated({
      appServerVersion,
      installedCodexVersion,
    })
  ) {
    return null;
  }

  return {
    currentVersion: appServerVersion,
    installedVersion: installedCodexVersion,
  };
}

function buildSshBannerState({
  error,
  restartAvailableNotice,
  state,
}: {
  error: ConnectionError | null;
  restartAvailableNotice: {
    currentVersion: string;
    installedVersion: string;
  } | null;
  state: AppServerConnectionState;
}) {
  if (state === "error") {
    return {
      bannerError: error ?? (restartAvailableNotice == null
        ? null
        : {
            code: "restart-required" as const,
            currentVersion: restartAvailableNotice.currentVersion,
            installedVersion: restartAvailableNotice.installedVersion,
          }),
      isRestartAvailableNotice: false,
      statusState: "error" as const,
    };
  }

  if (restartAvailableNotice == null) {
    return {
      bannerError: null,
      isRestartAvailableNotice: false,
      statusState: state,
    };
  }

  return {
    bannerError: {
      code: "restart-required" as const,
      currentVersion: restartAvailableNotice.currentVersion,
      installedVersion: restartAvailableNotice.installedVersion,
    },
    isRestartAvailableNotice: error == null,
    statusState: "error" as const,
  };
}

function buildSshBannerAction({
  hostId,
  message,
  onLoginRequired,
  onRestartConnection,
  action,
}: {
  hostId: string;
  message: string;
  onLoginRequired: (hostId: string) => void;
  onRestartConnection: (hostId: string) => void;
  action: SshBannerAction | null;
}) {
  if (action == null) {
    return null;
  }

  if (action.kind === "login") {
    return {
      label: action.label,
      onClick: () => onLoginRequired(hostId),
    };
  }

  return {
    label: action.label,
    tooltipText: action.tooltipText ?? message,
    onClick: () => onRestartConnection(hostId),
  };
}

function isRestartVersionOutdated({
  appServerVersion,
  installedCodexVersion,
}: {
  appServerVersion: string;
  installedCodexVersion: string;
}) {
  const current = parseLooseVersion(appServerVersion);
  const installed = parseLooseVersion(installedCodexVersion);
  if (current == null || installed == null) {
    return false;
  }

  return compareParsedLooseVersions(current, installed) < 0;
}

function isRemoteControlConnection(
  connection: DeviceConnection,
): connection is RemoteControlConnection {
  return "envId" in connection;
}

function buildConnectionDetailRows(
  connection: DeviceConnection,
  response: AppServerConnectionStateResponse | null,
): ConnectionDetailRow[] {
  if (isRemoteControlConnection(connection)) {
    const platform = buildRemoteControlPlatformLabel(connection);
    return [
      {
        id: "host",
        label: "settings.remoteControlConnections.details.host",
        value: connection.hostName ?? "—",
        copyValue: connection.hostName,
      },
      {
        id: "platform",
        label: "settings.remoteControlConnections.details.platform",
        value: platform,
        copyValue: platform === "—" ? null : platform,
      },
      {
        id: "version",
        label: "settings.remoteControlConnections.details.version",
        value: connection.appServerVersion ?? "—",
        copyValue: connection.appServerVersion,
      },
      {
        id: "lastSeen",
        label: "settings.remoteControlConnections.details.lastSeen",
        value: formatRelativeDateTime(connection.lastSeenAt),
        copyValue: connection.lastSeenAt,
      },
    ];
  }

  const rows: ConnectionDetailRow[] = [];

  if (connection.source === "discovered" && connection.sshAlias != null) {
    rows.push({
      id: "alias",
      label: "settings.remoteConnections.details.alias",
      value: connection.sshAlias,
      copyValue: connection.sshAlias,
    });
  }

  rows.push(
    {
      id: "host",
      label: "settings.remoteConnections.details.host",
      value: connection.sshHost,
      copyValue: connection.sshHost,
    },
    {
      id: "port",
      label: "settings.remoteConnections.details.port",
      value: connection.sshPort == null ? null : String(connection.sshPort),
      copyValue: connection.sshPort == null ? null : String(connection.sshPort),
    },
    {
      id: "identity",
      label: "settings.remoteConnections.details.identity",
      value: connection.identity,
      copyValue: connection.identity,
    },
  );

  if (
    response?.state === "connected" &&
    typeof response.appServerVersion === "string" &&
    response.appServerVersion.trim().length > 0
  ) {
    rows.push({
      id: "version",
      label: "settings.remoteConnections.details.version",
      value: response.appServerVersion,
      copyValue: response.appServerVersion,
    });
  }

  return rows;
}

function buildRemoteControlPlatformLabel(connection: RemoteControlConnection) {
  const values = [connection.os, connection.arch].filter(
    (value): value is string => value != null && value.trim().length > 0,
  );
  return values.length > 0 ? values.join(" / ") : "—";
}

function formatDetailDateTime(value: string | null) {
  if (value == null) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeDateTime(value: string | null) {
  if (value == null) {
    return "—";
  }

  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs)) {
    return value;
  }

  return <RelativeDateTimeValue timestampMs={timestampMs} />;
}

function sortRemoteControlConnections(
  connections: RemoteControlConnection[],
) {
  return [...connections].sort((left, right) => {
    if (left.online !== right.online) {
      return left.online ? -1 : 1;
    }
    if (left.lastSeenAt != null && right.lastSeenAt == null) {
      return -1;
    }
    if (left.lastSeenAt == null && right.lastSeenAt != null) {
      return 1;
    }
    if (
      left.lastSeenAt != null &&
      right.lastSeenAt != null &&
      left.lastSeenAt !== right.lastSeenAt
    ) {
      return right.lastSeenAt.localeCompare(left.lastSeenAt);
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

async function readConnectionStateResponses(
  connections: DeviceConnection[],
): Promise<DeviceConnectionStateByHostId> {
  const states = await Promise.all(
    connections.map(async (connection) => {
      const response = await readAppServerConnectionState(connection.hostId).catch(
        () => null,
      );
      return [
        connection.hostId,
        response ?? {
          state: "disconnected" as const,
          error: null,
          appServerVersion: null,
          installedCodexVersion: null,
          codexHome: null,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(states);
}

function isCompatibleRemoteControlVersion(version: string | null) {
  if (version == null) {
    return false;
  }

  const current = parseLooseVersion(version);
  const required = parseLooseVersion(REMOTE_CONNECTION_MIN_REQUIRED_VERSION);
  if (current == null || required == null) {
    return false;
  }

  const maxLength = Math.max(current.numbers.length, required.numbers.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = current.numbers[index] ?? 0;
    const right = required.numbers[index] ?? 0;
    if (left !== right) {
      return left > right;
    }
  }

  if (current.prerelease == null && required.prerelease == null) {
    return true;
  }
  if (current.prerelease == null) {
    return true;
  }
  if (required.prerelease == null) {
    return false;
  }

  return current.prerelease.localeCompare(required.prerelease) >= 0;
}

function parseLooseVersion(version: string) {
  const match = version.trim().match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?/);
  if (match == null) {
    return null;
  }

  return {
    numbers: match[1].split(".").map((value) => Number.parseInt(value, 10)),
    prerelease: match[2] ?? null,
  };
}

function compareParsedLooseVersions(
  left: { numbers: number[]; prerelease: string | null },
  right: { numbers: number[]; prerelease: string | null },
) {
  const maxLength = Math.max(left.numbers.length, right.numbers.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left.numbers[index] ?? 0;
    const rightValue = right.numbers[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue < rightValue ? -1 : 1;
    }
  }

  if (left.prerelease == null && right.prerelease == null) {
    return 0;
  }
  if (left.prerelease == null) {
    return 1;
  }
  if (right.prerelease == null) {
    return -1;
  }

  return left.prerelease.localeCompare(right.prerelease);
}

function buildRemoteControlAvailabilityLabel(
  t: (key: MessageKey, values?: MessageValues) => string,
  connection: RemoteControlConnection,
  state: AppServerConnectionState,
) {
  if (connection.online) {
    if (isCompatibleRemoteControlVersion(connection.appServerVersion)) {
      if (state === "connected") {
        return connection.busy
          ? t("settings.remoteControlConnections.availability.busy")
          : t("settings.remoteControlConnections.availability.online");
      }
      return t("threadPage.remoteConnectionStatusBadge.disconnected");
    }

    return t("settings.remoteControlConnections.availability.updateRequired", {
      currentVersion: connection.appServerVersion ?? "—",
      requiredVersion: REMOTE_CONNECTION_MIN_REQUIRED_VERSION,
    });
  }

  return t("settings.remoteControlConnections.availability.offline");
}

function buildRemoteControlDotClassName(
  connection: RemoteControlConnection,
  state: AppServerConnectionState,
) {
  if (
    !connection.online ||
    !isCompatibleRemoteControlVersion(connection.appServerVersion) ||
    state !== "connected"
  ) {
    return "block size-2 rounded-full bg-gray-400";
  }
  if (connection.busy) {
    return "block size-2 rounded-full bg-token-charts-yellow";
  }
  return "block size-2 rounded-full bg-token-charts-green";
}

function buildRemoteControlConnectionSubtitle(
  t: (key: MessageKey, values?: MessageValues) => string,
  connection: RemoteControlConnection,
  compatibleVersion: boolean,
) {
  if (connection.online) {
    if (compatibleVersion) {
      return t(
        "settings.remoteConnections.deviceConnections.signedInDeviceOnlineSubtitle",
      );
    }
    return t(
      "settings.remoteConnections.deviceConnections.signedInDeviceUpdateRequiredSubtitle",
      {
        currentVersion: connection.appServerVersion ?? "—",
        requiredVersion: REMOTE_CONNECTION_MIN_REQUIRED_VERSION,
      },
    );
  }

  return t(
    "settings.remoteConnections.deviceConnections.signedInDeviceOfflineSubtitle",
  );
}

function RemoteControlConnectionStatus({
  connection,
  state,
}: {
  connection: RemoteControlConnection;
  state: AppServerConnectionState;
}) {
  const { t } = useI18n();
  const label = buildRemoteControlAvailabilityLabel(t, connection, state);

  return (
    <span
      aria-label={label}
      className={buildRemoteControlDotClassName(connection, state)}
      role="img"
      title={label}
    />
  );
}

function normalizeConnectionError(value: unknown): ConnectionError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.code === "login-required") {
    return { code: "login-required" };
  }
  if (record.code === "restart-required") {
    return {
      code: "restart-required",
      currentVersion: typeof record.currentVersion === "string" ? record.currentVersion : null,
      installedVersion: typeof record.installedVersion === "string" ? record.installedVersion : null,
    };
  }
  if (record.code === "update-required") {
    return {
      code: "update-required",
      currentVersion: typeof record.currentVersion === "string" ? record.currentVersion : null,
      minRequiredVersion:
        typeof record.minRequiredVersion === "string"
          ? record.minRequiredVersion
          : REMOTE_CONNECTION_MIN_REQUIRED_VERSION,
    };
  }
  if (record.code === "connection-failed" && typeof record.message === "string") {
    return {
      code: "connection-failed",
      message: record.message,
    };
  }
  return null;
}

function createEmptySshDraft(): SshDraft {
  return {
    displayName: "",
    sshHost: "",
    sshPort: "",
    authMode: "none",
    identity: "",
    targetKind: "host",
  };
}

function createDraftFromConnection(connection: RemoteConnection): SshDraft {
  return {
    displayName: connection.displayName,
    sshHost: connection.sshAlias ?? connection.sshHost ?? "",
    sshPort: connection.sshPort == null ? "" : String(connection.sshPort),
    authMode: connection.identity ? "identity" : "none",
    identity: connection.identity ?? "",
    targetKind: connection.sshAlias ? "alias" : "host",
  };
}

function validateSshDraft({
  draft,
  editingHostId,
  existingConnections,
}: {
  draft: SshDraft;
  editingHostId: string | null;
  existingConnections: RemoteConnection[];
}): SshValidationError[] {
  const errors: SshValidationError[] = [];
  if (draft.displayName.trim().length === 0) {
    errors.push("displayNameRequired");
  }
  if (draft.sshHost.trim().length === 0) {
    errors.push("sshHostRequired");
  }

  if (draft.targetKind === "host" && draft.sshPort.trim().length > 0) {
    const parsedPort = Number(draft.sshPort);
    if (!Number.isInteger(parsedPort)) {
      errors.push("sshPortInteger");
    } else if (parsedPort < 1 || parsedPort > 65535) {
      errors.push("sshPortRange");
    }
  }

  if (draft.targetKind === "host" && draft.authMode === "identity" && draft.identity.trim().length === 0) {
    errors.push("identityRequired");
  }

  const duplicateDisplayName = existingConnections.some((connection) => {
    return (
      connection.hostId !== editingHostId &&
      connection.displayName.trim().toLowerCase() === draft.displayName.trim().toLowerCase()
    );
  });
  if (duplicateDisplayName) {
    errors.push("duplicateDisplayName");
  }

  return errors;
}

function toSavedConnections(connections: RemoteConnection[]): SavedRemoteConnectionInput[] {
  return connections.map((connection) => ({
    hostId: connection.hostId,
    displayName: connection.displayName,
    alias: connection.sshAlias,
    hostname: connection.sshAlias == null ? connection.sshHost : null,
    sshPort: connection.sshAlias == null ? connection.sshPort : null,
    identity: connection.sshAlias == null ? connection.identity : null,
    source: connection.source,
  }));
}

function toSavedConnectionInput(
  draft: SshDraft,
  hostId: string | null,
): SavedRemoteConnectionInput {
  if (draft.targetKind === "alias") {
    return {
      hostId,
      displayName: draft.displayName.trim(),
      alias: draft.sshHost.trim(),
    };
  }

  const sshPort = draft.sshPort.trim().length === 0 ? null : Number(draft.sshPort);
  return {
    hostId,
    displayName: draft.displayName.trim(),
    hostname: draft.sshHost.trim(),
    sshPort,
    identity: draft.authMode === "identity" ? draft.identity.trim() : null,
  };
}

function getSshValidationMessageKey(error: SshValidationError): MessageKey {
  switch (error) {
    case "displayNameRequired":
      return "settings.remoteConnections.dialog.field.displayName.error";
    case "sshHostRequired":
      return "settings.remoteConnections.dialog.field.sshHost.error";
    case "sshPortInteger":
      return "settings.remoteConnections.dialog.field.sshPort.intError";
    case "sshPortRange":
      return "settings.remoteConnections.dialog.field.sshPort.rangeError";
    case "identityRequired":
      return "settings.remoteConnections.dialog.field.identity.error";
    case "duplicateDisplayName":
      return "settings.remoteConnections.dialog.field.displayName.duplicateError";
  }
}

function RemoteControlClientLastSeen({
  timestampMs,
}: {
  timestampMs: number;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (!Number.isFinite(timestampMs)) {
    return "—";
  }

  return t("settings.remoteConnections.remoteControlClients.lastSeen", {
    date: formatCompactRelativeTime(timestampMs, now, t),
  });
}

function RelativeDateTimeValue({
  timestampMs,
}: {
  timestampMs: number;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (!Number.isFinite(timestampMs)) {
    return "—";
  }

  return formatCompactRelativeTime(timestampMs, now, t);
}

function formatCompactRelativeTime(
  timestampMs: number,
  now: number,
  t: (key: MessageKey, values?: MessageValues) => string,
) {
  const diffMinutes = Math.floor((now - timestampMs) / (60 * 1000));
  const safeMinutes = Math.max(1, diffMinutes);

  if (safeMinutes < 60) {
    return t("wham.formattedRelativeDateTime.compactMinutesAgo", {
      value: safeMinutes,
    });
  }

  const hours = Math.floor(safeMinutes / 60);
  if (hours < 24) {
    return t("wham.formattedRelativeDateTime.compactHoursAgo", { value: hours });
  }

  const days = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(timestampMs).getTime()) / 86400000),
  );
  if (days < 7) {
    return t("wham.formattedRelativeDateTime.compactDaysAgo", { value: days });
  }

  if (days < 30) {
    return t("wham.formattedRelativeDateTime.compactWeeksAgo", {
      value: Math.floor(days / 7),
    });
  }

  if (days < 365) {
    return t("wham.formattedRelativeDateTime.compactMonthsAgo", {
      value: Math.floor(days / 30),
    });
  }

  return t("wham.formattedRelativeDateTime.compactYearsAgo", {
    value: Math.floor(days / 365),
  });
}

function startOfDay(value: number) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function DeviceSettingsIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C9.525 0.00013 10.763 1.23843 10.763 2.76367C10.763 4.05805 9.87077 5.14005 8.66992 5.43848V7.32812H11.5605C12.854 7.32827 13.9023 8.37673 13.9023 9.6709V10.5527C15.1032 10.8512 15.994 11.9334 15.9941 13.2285C15.9941 14.7542 14.7562 15.9922 13.2305 15.9922C11.7049 15.992 10.4667 14.7541 10.4668 13.2285C10.4668 11.9335 11.3578 10.8511 12.5586 10.5527V9.6709C12.5586 9.1148 12.1076 8.66406 11.5508 8.66406H4.44922C3.89238 8.66406 3.44141 9.1148 3.44141 9.6709V10.5527C4.64212 10.8512 5.53295 11.9334 5.5332 13.2285C5.5332 14.7543 4.29507 15.9922 2.76953 15.9922C1.24399 15.992 0.000131907 14.7541 0 13.2285C0.000149293 11.9337 0.891005 10.8513 2.0918 10.5527V9.6709C2.0918 8.37686 3.14025 7.32812 4.43359 7.32812H7.32812V5.43848C6.12741 5.14006 5.23633 4.05816 5.23633 2.76367C5.23668 1.2385 6.47494 0.00017584 8 0ZM2.76953 11.7871C1.98247 11.7874 1.34388 12.426 1.34375 13.2139C1.34375 14.0015 1.9822 14.6482 2.76953 14.6484C3.55719 14.6484 4.19727 14.0018 4.19727 13.2139C4.19712 12.4261 3.55737 11.7871 2.76953 11.7871ZM13.2305 11.7871C12.4433 11.7874 11.8107 12.4261 11.8105 13.2139C11.8105 14.0016 12.4428 14.6482 13.2305 14.6484C14.0181 14.6484 14.6504 14.0018 14.6504 13.2139C14.6502 12.4261 14.0182 11.7873 13.2305 11.7871ZM8 1.33594C7.21283 1.33611 6.57835 1.97073 6.57812 2.75781C6.57812 3.54548 7.21263 4.18493 8 4.18555C8.78744 4.18511 9.42188 3.54554 9.42188 2.75781C9.42153 1.97071 8.78711 1.33607 8 1.33594Z"
        fill="currentColor"
      />
    </svg>
  );
}

function KeepAliveIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 15" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.34354 0.292893C4.7341 0.683418 4.7341 1.31658 4.34354 1.70711C1.21906 4.8313 1.21906 9.89662 4.34354 13.0208C4.7341 13.4113 4.7341 14.0445 4.34354 14.435C3.95298 14.8256 3.31976 14.8256 2.9292 14.435C-0.976399 10.5298 -0.976399 4.19814 2.9292 0.292893C3.31976 -0.0976311 3.95298 -0.0976311 4.34354 0.292893Z"
        fill="currentColor"
      />
      <path
        d="M15.6583 0.292893C16.0488 -0.0976311 16.682 -0.0976311 17.0726 0.292893C20.9782 4.19814 20.9782 10.5298 17.0726 14.435C16.682 14.8256 16.0488 14.8256 15.6583 14.435C15.2677 14.0445 15.2677 13.4113 15.6583 13.0208C18.7827 9.89662 18.7827 4.8313 15.6583 1.70711C15.2677 1.31658 15.2677 0.683418 15.6583 0.292893Z"
        fill="currentColor"
      />
      <path
        d="M7.17222 3.12132C7.56278 3.51184 7.56278 4.14501 7.17222 4.53553C5.60998 6.09763 5.60998 8.63029 7.17222 10.1924C7.56278 10.5829 7.56278 11.2161 7.17222 11.6066C6.78166 11.9971 6.14844 11.9971 5.75788 11.6066C3.41452 9.26346 3.41452 5.46447 5.75788 3.12132C6.14844 2.7308 6.78166 2.7308 7.17222 3.12132Z"
        fill="currentColor"
      />
      <path
        d="M12.8296 3.12132C13.2201 2.7308 13.8534 2.7308 14.2439 3.12132C16.5873 5.46447 16.5873 9.26346 14.2439 11.6066C13.8534 11.9971 13.2201 11.9971 12.8296 11.6066C12.439 11.2161 12.439 10.5829 12.8296 10.1924C14.3918 8.63029 14.3918 6.09763 12.8296 4.53553C12.439 4.14501 12.439 3.51184 12.8296 3.12132Z"
        fill="currentColor"
      />
      <path
        d="M12.0011 7.36396C12.0011 8.46853 11.1056 9.36396 10.0009 9.36396C8.89623 9.36396 8.00072 8.46853 8.00072 7.36396C8.00072 6.25939 8.89623 5.36396 10.0009 5.36396C11.1056 5.36396 12.0011 6.25939 12.0011 7.36396Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ControllingDeviceIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M7.237 2c.567 0 1.042.125 1.425.375s.684.637.9 1.162l.988 2.388c.216.516.283.996.2 1.437-.075.442-.304.872-.688 1.288l-1.278 1.37c.618 1.22 1.33 2.252 2.142 3.093.81.84 1.804 1.559 2.978 2.159l1.36-1.359c.408-.4.833-.641 1.274-.725.442-.091.93-.024 1.463.2l2.463 1.025c.533.225.92.525 1.162.9.25.376.375.85.375 1.425v1.938c0 .608-.155 1.166-.463 1.675a3.325 3.325 0 0 1-1.25 1.2c-.517.3-1.08.45-1.687.45-2.95 0-5.7-.783-8.25-2.35-2.55-1.566-4.579-3.587-6.087-6.062C2.754 11.105 2 8.575 2 6c0-.733.175-1.404.525-2.013a3.91 3.91 0 0 1 1.45-1.45A3.96 3.96 0 0 1 6 2h1.237Z" />
    </svg>
  );
}

function RemoteHostIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10 2.125C14.3492 2.125 17.875 5.65076 17.875 10C17.875 14.3492 14.3492 17.875 10 17.875C5.65076 17.875 2.125 14.3492 2.125 10C2.125 5.65076 5.65076 2.125 10 2.125ZM7.88672 10.625C7.94334 12.3161 8.22547 13.8134 8.63965 14.9053C8.87263 15.5194 9.1351 15.9733 9.39453 16.2627C9.65437 16.5524 9.86039 16.625 10 16.625C10.1396 16.625 10.3456 16.5524 10.6055 16.2627C10.8649 15.9733 11.1274 15.5194 11.3604 14.9053C11.7745 13.8134 12.0567 12.3161 12.1133 10.625H7.88672ZM3.40527 10.625C3.65313 13.2734 5.45957 15.4667 7.89844 16.2822C7.7409 15.997 7.5977 15.6834 7.4707 15.3486C6.99415 14.0923 6.69362 12.439 6.63672 10.625H3.40527ZM13.3633 10.625C13.3064 12.439 13.0059 14.0923 12.5293 15.3486C12.4022 15.6836 12.2582 15.9969 12.1006 16.2822C14.5399 15.467 16.3468 13.2737 16.5947 10.625H13.3633ZM12.1006 3.7168C12.2584 4.00235 12.4021 4.31613 12.5293 4.65137C13.0059 5.90775 13.3064 7.56102 13.3633 9.375H16.5947C16.3468 6.72615 14.54 4.53199 12.1006 3.7168ZM10 3.375C9.86039 3.375 9.65437 3.44756 9.39453 3.7373C9.1351 4.02672 8.87263 4.48057 8.63965 5.09473C8.22547 6.18664 7.94334 7.68388 7.88672 9.375H12.1133C12.0567 7.68388 11.7745 6.18664 11.3604 5.09473C11.1274 4.48057 10.8649 4.02672 10.6055 3.7373C10.3456 3.44756 10.1396 3.375 10 3.375ZM7.89844 3.7168C5.45942 4.53222 3.65314 6.72647 3.40527 9.375H6.63672C6.69362 7.56102 6.99415 5.90775 7.4707 4.65137C7.59781 4.31629 7.74073 4.00224 7.89844 3.7168Z" />
    </svg>
  );
}
