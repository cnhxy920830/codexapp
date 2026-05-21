import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppToast } from "./AppToastRegion";
import {
  BackNavigationIcon,
  FolderIcon,
  PlusIcon,
  PlayOutlineIcon,
  SettingsCogIcon,
  TrashIcon,
  WorktreeIcon,
} from "./AppShellIcons";
import { Button } from "./Button";
import { CodeSnippet } from "./CodeSnippet";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { Spinner } from "./Spinner";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import {
  LOCAL_ENVIRONMENT_ACTION_ICONS,
  LOCAL_ENVIRONMENT_ACTION_PLACEHOLDER,
  LOCAL_ENVIRONMENT_CLEANUP_PLACEHOLDER,
  LOCAL_ENVIRONMENT_PLATFORMS,
  LOCAL_ENVIRONMENT_SETUP_PLACEHOLDER,
  createDefaultLocalEnvironmentConfigPath,
  createDefaultLocalEnvironmentDocument,
  getLocalEnvironmentProjectName,
  getLocalEnvironmentOwnerRoot,
  getPreferredLocalEnvironment,
  getScriptForPlatform,
  listLocalEnvironments,
  readLocalEnvironment,
  readLocalEnvironmentConfig,
  renderLocalEnvironmentDocument,
  writeLocalEnvironmentConfig,
  type LocalEnvironmentAction,
  type LocalEnvironmentActionIcon,
  type LocalEnvironmentConfigEntry,
  type LocalEnvironmentDocument,
  type LocalEnvironmentPlatform,
  type LocalEnvironmentScriptSection,
} from "../services/localEnvironments";
import { readGitOrigins } from "../services/gitOrigins";
import { parseRepoKeyFromOriginUrl } from "../services/pullRequests";
import {
  addNewWorkspaceRootOption,
  onActiveWorkspaceRootsUpdated,
  onWorkspaceRootOptionAdded,
  onWorkspaceRootOptionsUpdated,
  readActiveWorkspaceRoots,
  readWorkspaceRootOptions,
} from "../services/workspaceRoots";
import { buildConfigScopeOptions, readConfig, writeConfigValue } from "../services/settings";
import { isWithinCodexWorktrees } from "../services/codexHome";
import {
  LOCAL_SETTINGS_HOST_ID,
  REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  onRemoteAppServerConnectionStateChanged,
  onSharedObjectUpdated,
  readConnectedSettingsRemoteConnections,
  readSettingsRemoteConnectionsSnapshot,
  readSettingsRemoteProjectsSnapshot,
  saveRemoteProject,
  type RemoteConnection,
  type RemoteProject,
} from "../services/settingsHosts";
import { RemoteProjectSetupDialog } from "../features/localEnvironments/RemoteProjectSetupDialog";

const SCRIPT_PLATFORM_OPTIONS = ["default", ...LOCAL_ENVIRONMENT_PLATFORMS] as const;
const LOCAL_ENVIRONMENT_CONFIG_KEY_PATH = "codex.localEnvironmentConfigPath";
const LOCAL_ENVIRONMENT_LEARN_MORE_URL = "https://developers.openai.com/codex/app/local-environments";

type ScriptPlatformSelection = (typeof SCRIPT_PLATFORM_OPTIONS)[number];

type WorkspaceProjectGroup = {
  path: string;
  label: string;
  isCodexWorktree: boolean;
  repositoryData: {
    ownerRepo: {
      owner: string | null;
      repo: string | null;
    } | null;
    rootFolder: string | null;
  } | null;
};

type EditableLocalEnvironmentAction = LocalEnvironmentAction & {
  id: string;
};

type EditableLocalEnvironmentDocument = Omit<LocalEnvironmentDocument, "actions"> & {
  actions: EditableLocalEnvironmentAction[];
};

export function LocalEnvironmentsSettings({
  codexHome,
  onConsumePendingViewAction,
  onRequestOpenRemoteProjectDialog,
  pendingViewAction,
  routeSearch,
  selectedHostId,
  onSelectHostId,
  onUpdateRouteSearch,
  onShowToast,
}: {
  codexHome: string | null;
  onConsumePendingViewAction?: () => void;
  onRequestOpenRemoteProjectDialog?: () => void;
  pendingViewAction?: "open-create-remote-project-modal" | null;
  routeSearch?: string;
  selectedHostId: string;
  onSelectHostId?: (hostId: string) => void;
  onUpdateRouteSearch?: (routeSearch: string | null) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [workspaceRootLabels, setWorkspaceRootLabels] = useState<Record<string, string>>({});
  const [activeWorkspaceRoots, setActiveWorkspaceRoots] = useState<string[]>([]);
  const [isWorkspaceRootsLoading, setIsWorkspaceRootsLoading] = useState(false);
  const [workspaceRootsErrorMessage, setWorkspaceRootsErrorMessage] = useState<string | null>(null);
  const [selectedWorkspaceRoot, setSelectedWorkspaceRoot] = useState<string | null>(null);
  const [environmentEntries, setEnvironmentEntries] = useState<LocalEnvironmentConfigEntry[]>([]);
  const [selectedConfigPath, setSelectedConfigPath] = useState<string | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<Awaited<
    ReturnType<typeof readLocalEnvironmentConfig>
  > | null>(null);
  const [parsedEnvironment, setParsedEnvironment] = useState<LocalEnvironmentConfigEntry | null>(null);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null);
  const [detailsErrorMessage, setDetailsErrorMessage] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableEnvironment, setEditableEnvironment] = useState<EditableLocalEnvironmentDocument | null>(null);
  const [initialFingerprint, setInitialFingerprint] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [setupPlatform, setSetupPlatform] = useState<ScriptPlatformSelection>("default");
  const [cleanupPlatform, setCleanupPlatform] = useState<ScriptPlatformSelection>("default");
  const [isSetupEnvVarsOpen, setIsSetupEnvVarsOpen] = useState(false);
  const [workspaceRootsReloadVersion, setWorkspaceRootsReloadVersion] = useState(0);
  const [gitOriginsByWorkspaceRoot, setGitOriginsByWorkspaceRoot] = useState<Record<string, string>>({});
  const [connectedRemoteConnections, setConnectedRemoteConnections] = useState<RemoteConnection[]>([]);
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([]);
  const [isRemoteProjectDialogOpen, setIsRemoteProjectDialogOpen] = useState(false);
  const [isRemoteProjectSaving, setIsRemoteProjectSaving] = useState(false);
  const routeSelection = useMemo(() => parseLocalEnvironmentRouteSearch(routeSearch), [routeSearch]);
  const isRemoteHost = selectedHostId.trim() !== LOCAL_SETTINGS_HOST_ID;
  const remoteProjectsForSelectedHost = useMemo(() => {
    return remoteProjects.filter((remoteProject) => remoteProject.hostId === selectedHostId);
  }, [remoteProjects, selectedHostId]);
  const projectRoots = useMemo(() => {
    return isRemoteHost ? remoteProjectsForSelectedHost.map((remoteProject) => remoteProject.remotePath) : workspaceRoots;
  }, [isRemoteHost, remoteProjectsForSelectedHost, workspaceRoots]);
  const projectRootLabels = useMemo(() => {
    if (!isRemoteHost) {
      return workspaceRootLabels;
    }

    return Object.fromEntries(
      remoteProjectsForSelectedHost.map((remoteProject) => [remoteProject.remotePath, remoteProject.label]),
    );
  }, [isRemoteHost, remoteProjectsForSelectedHost, workspaceRootLabels]);
  const workspaceProjectGroups = useMemo(() => {
    return projectRoots.map((workspaceRoot) => {
      const label = getWorkspaceRootLabel(workspaceRoot, projectRootLabels);
      const originUrl = gitOriginsByWorkspaceRoot[normalizeComparablePath(workspaceRoot)] ?? null;
      const parsedOrigin = originUrl ? parseRepoKeyFromOriginUrl(originUrl) : null;

      return {
        path: workspaceRoot,
        label,
        isCodexWorktree: isWithinCodexWorktrees(workspaceRoot, codexHome),
        repositoryData: {
          ownerRepo: parsedOrigin
            ? {
                owner: parsedOrigin.owner,
                repo: parsedOrigin.repo,
              }
            : null,
          rootFolder: getLocalEnvironmentProjectName(workspaceRoot) ?? null,
        },
      } satisfies WorkspaceProjectGroup;
    });
  }, [codexHome, gitOriginsByWorkspaceRoot, projectRootLabels, projectRoots]);

  const selectedWorkspacePath = useMemo(() => {
    if (!selectedWorkspaceRoot) {
      return null;
    }

    return selectConfigPathForWorkspace(selectedWorkspaceRoot, environmentEntries, selectedConfigPath);
  }, [environmentEntries, selectedConfigPath, selectedWorkspaceRoot]);

  const normalizedSelectedWorkspaceRoot = useMemo(() => {
    if (selectedWorkspaceRoot === null) {
      return null;
    }

    return projectRoots.includes(selectedWorkspaceRoot) ? selectedWorkspaceRoot : null;
  }, [projectRoots, selectedWorkspaceRoot]);

  const selectedWorkspaceLabel = useMemo(() => {
    if (!normalizedSelectedWorkspaceRoot) {
      return null;
    }
    return getWorkspaceRootLabel(normalizedSelectedWorkspaceRoot, projectRootLabels);
  }, [normalizedSelectedWorkspaceRoot, projectRootLabels]);

  const selectedWorkspaceGroup = useMemo(() => {
    if (!normalizedSelectedWorkspaceRoot) {
      return null;
    }

    return workspaceProjectGroups.find((group) => group.path === normalizedSelectedWorkspaceRoot) ?? null;
  }, [normalizedSelectedWorkspaceRoot, workspaceProjectGroups]);

  const isSelectProjectMode = normalizedSelectedWorkspaceRoot === null;
  const previewEnvironment = parsedEnvironment?.type === "success" ? parsedEnvironment.environment : null;
  const parseErrorMessage = parsedEnvironment?.type === "error" ? parsedEnvironment.error.message : null;
  const readErrorMessage = detailsErrorMessage ?? listErrorMessage ?? workspaceRootsErrorMessage;
  const currentFingerprint = useMemo(
    () => (editableEnvironment ? JSON.stringify(toPersistedDocument(editableEnvironment)) : ""),
    [editableEnvironment],
  );
  const saveDisabledReason = useMemo(() => {
    if (!editableEnvironment) {
      return null;
    }
    if (isSaving) {
      return t("settings.localEnvironments.save.disabled.saving");
    }
    if (editableEnvironment.name.trim().length === 0) {
      return t("settings.localEnvironments.save.disabled.name");
    }
    if (currentFingerprint === initialFingerprint && !parseErrorMessage && !readErrorMessage) {
      return t("settings.localEnvironments.save.disabled.noChanges");
    }
    return null;
  }, [currentFingerprint, editableEnvironment, initialFingerprint, isSaving, parseErrorMessage, readErrorMessage, t]);

  useEffect(() => {
    let disposed = false;
    let cleanupSharedObjects: (() => void) | null = null;
    let cleanupConnectionStates: (() => void) | null = null;

    const loadRemoteConnectionState = async () => {
      try {
        const remoteConnections = await readSettingsRemoteConnectionsSnapshot();
        const nextConnectedRemoteConnections = await readConnectedSettingsRemoteConnections(remoteConnections);
        if (!disposed) {
          setConnectedRemoteConnections(nextConnectedRemoteConnections);
        }
      } catch {
        if (!disposed) {
          setConnectedRemoteConnections([]);
        }
      }
    };

    const loadRemoteProjects = async () => {
      try {
        const nextRemoteProjects = await readSettingsRemoteProjectsSnapshot();
        if (!disposed) {
          setRemoteProjects(nextRemoteProjects);
        }
      } catch {
        if (!disposed) {
          setRemoteProjects([]);
        }
      }
    };

    void Promise.all([loadRemoteConnectionState(), loadRemoteProjects()]);

    void onSharedObjectUpdated((notification) => {
      if (notification.key === REMOTE_CONNECTIONS_SHARED_OBJECT_KEY) {
        void loadRemoteConnectionState();
      }
      if (notification.key === REMOTE_PROJECTS_SHARED_OBJECT_KEY) {
        void loadRemoteProjects();
      }
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupSharedObjects = cleanup;
    });

    void onRemoteAppServerConnectionStateChanged(() => {
      void loadRemoteConnectionState();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupConnectionStates = cleanup;
    });

    return () => {
      disposed = true;
      cleanupSharedObjects?.();
      cleanupConnectionStates?.();
    };
  }, []);

  useEffect(() => {
    if (isRemoteHost) {
      setWorkspaceRootsErrorMessage(null);
      setIsWorkspaceRootsLoading(false);
      return;
    }

    let cancelled = false;

    setIsWorkspaceRootsLoading(true);
    setWorkspaceRootsErrorMessage(null);

    const loadWorkspaceRoots = async () => {
      try {
        const [workspaceRootOptionsResponse, activeWorkspaceRootsResponse] = await Promise.all([
          readWorkspaceRootOptions(selectedHostId),
          readActiveWorkspaceRoots(selectedHostId),
        ]);
        if (cancelled) {
          return;
        }

        setWorkspaceRoots(workspaceRootOptionsResponse.roots);
        setWorkspaceRootLabels(workspaceRootOptionsResponse.labels);
        setActiveWorkspaceRoots(activeWorkspaceRootsResponse.roots);
        try {
          const gitOriginsResponse =
            workspaceRootOptionsResponse.roots.length === 0
              ? { origins: [] as Array<{ dir: string; originUrl: string | null }> }
              : await readGitOrigins({
                  dirs: workspaceRootOptionsResponse.roots,
                  hostId: selectedHostId,
                });
          if (!cancelled) {
            setGitOriginsByWorkspaceRoot(
              Object.fromEntries(
                gitOriginsResponse.origins.flatMap((origin) =>
                  origin.originUrl == null
                    ? []
                    : [[normalizeComparablePath(origin.dir), origin.originUrl]],
                ),
              ),
            );
          }
        } catch {
          if (!cancelled) {
            setGitOriginsByWorkspaceRoot({});
          }
        }
        setSelectedWorkspaceRoot((current) => {
          if (current && workspaceRootOptionsResponse.roots.includes(current)) {
            return current;
          }
          return null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setWorkspaceRoots([]);
        setWorkspaceRootLabels({});
        setActiveWorkspaceRoots([]);
        setGitOriginsByWorkspaceRoot({});
        setSelectedWorkspaceRoot(null);
        setWorkspaceRootsErrorMessage(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsWorkspaceRootsLoading(false);
        }
      }
    };

    void loadWorkspaceRoots();

    return () => {
      cancelled = true;
    };
  }, [isRemoteHost, selectedHostId, workspaceRootsReloadVersion]);

  useEffect(() => {
    if (pendingViewAction !== "open-create-remote-project-modal") {
      return;
    }

    if (!isRemoteHost) {
      const fallbackConnectedHostId = connectedRemoteConnections[0]?.hostId;
      if (fallbackConnectedHostId != null) {
        onSelectHostId?.(fallbackConnectedHostId);
      }
      return;
    }

    setIsRemoteProjectDialogOpen(true);
    onConsumePendingViewAction?.();
  }, [
    connectedRemoteConnections,
    isRemoteHost,
    onConsumePendingViewAction,
    onSelectHostId,
    pendingViewAction,
  ]);

  useEffect(() => {
    if (routeSelection.workspaceRoot === null || projectRoots.length === 0) {
      return;
    }

    const requestedWorkspaceRoot = routeSelection.workspaceRoot;
    const matchingWorkspaceRoot =
      projectRoots.find(
        (workspaceRoot) => normalizeComparablePath(workspaceRoot) === normalizeComparablePath(requestedWorkspaceRoot),
      ) ?? null;
    if (matchingWorkspaceRoot === null) {
      return;
    }

    setSelectedWorkspaceRoot((current) => (current === matchingWorkspaceRoot ? current : matchingWorkspaceRoot));
  }, [projectRoots, routeSelection.workspaceRoot]);

  useEffect(() => {
    if (isRemoteHost) {
      return;
    }

    let disposed = false;
    let cleanupOptions: (() => void) | null = null;
    let cleanupActive: (() => void) | null = null;
    let cleanupAdded: (() => void) | null = null;

    const reload = () => {
      if (disposed) {
        return;
      }
      setSelectedConfigPath(null);
      setWorkspaceRootsReloadVersion((current) => current + 1);
      setReloadVersion((current) => current + 1);
    };

    void onWorkspaceRootOptionsUpdated(reload).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupOptions = cleanup;
    });

    void onActiveWorkspaceRootsUpdated(reload).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupActive = cleanup;
    });

    void onWorkspaceRootOptionAdded((notification) => {
      setSelectedWorkspaceRoot(notification.root);
      setSelectedConfigPath(null);
      setReloadVersion((current) => current + 1);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupAdded = cleanup;
    });

    return () => {
      disposed = true;
      cleanupOptions?.();
      cleanupActive?.();
      cleanupAdded?.();
    };
  }, [isRemoteHost]);

  useEffect(() => {
    if (!normalizedSelectedWorkspaceRoot) {
      setEnvironmentEntries([]);
      setSelectedConfigPath(null);
      setConfigSnapshot(null);
      setParsedEnvironment(null);
      setListErrorMessage(null);
      setDetailsErrorMessage(null);
      setIsListLoading(false);
      setIsDetailsLoading(false);
      setEditableEnvironment(null);
      setInitialFingerprint("");
      setIsSaving(false);
      setSaveErrorMessage(null);
      setSetupPlatform("default");
      setCleanupPlatform("default");
      setIsSetupEnvVarsOpen(false);
      return;
    }

    let cancelled = false;

    setIsEditMode(false);
    setEditableEnvironment(null);
    setInitialFingerprint("");
    setIsSaving(false);
    setSaveErrorMessage(null);
    setSetupPlatform("default");
    setCleanupPlatform("default");
    setIsSetupEnvVarsOpen(false);
    setEnvironmentEntries([]);
    setConfigSnapshot(null);
    setParsedEnvironment(null);
    setIsListLoading(true);
    setListErrorMessage(null);

    void listLocalEnvironments({
      hostId: selectedHostId,
      workspaceRoot: normalizedSelectedWorkspaceRoot,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setEnvironmentEntries(response.environments);
        setSelectedConfigPath((current) =>
          selectConfigPathForWorkspace(normalizedSelectedWorkspaceRoot, response.environments, current),
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setEnvironmentEntries([]);
        setListErrorMessage(getErrorMessage(error));
        setSelectedConfigPath((current) =>
          current && isConfigPathForWorkspace(current, normalizedSelectedWorkspaceRoot)
            ? current
            : createDefaultLocalEnvironmentConfigPath([], normalizedSelectedWorkspaceRoot),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSelectedWorkspaceRoot, reloadVersion, selectedHostId]);

  useEffect(() => {
    if (!selectedWorkspacePath) {
      setConfigSnapshot(null);
      setParsedEnvironment(null);
      setDetailsErrorMessage(null);
      setIsDetailsLoading(false);
      return;
    }

    let cancelled = false;

    setConfigSnapshot(null);
    setParsedEnvironment(null);
    setDetailsErrorMessage(null);
    setIsDetailsLoading(true);

    const load = async () => {
      try {
        const nextConfig = await readLocalEnvironmentConfig({
          hostId: selectedHostId,
          configPath: selectedWorkspacePath,
        });
        if (cancelled) {
          return;
        }

        setConfigSnapshot(nextConfig);
        if (!nextConfig.exists) {
          return;
        }

        try {
          const nextEnvironment = await readLocalEnvironment({
            hostId: selectedHostId,
            configPath: nextConfig.configPath,
          });
          if (!cancelled) {
            setParsedEnvironment(nextEnvironment.environment);
          }
        } catch (error) {
          if (!cancelled) {
            setDetailsErrorMessage(getErrorMessage(error));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setDetailsErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsDetailsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadVersion, selectedHostId, selectedWorkspacePath]);

  useEffect(() => {
    if (!normalizedSelectedWorkspaceRoot) {
      return;
    }

    if (
      routeSelection.workspaceRoot !== null &&
      normalizeComparablePath(routeSelection.workspaceRoot) !== normalizeComparablePath(normalizedSelectedWorkspaceRoot)
    ) {
      return;
    }

    if (
      routeSelection.configPath !== null &&
      isConfigPathForWorkspace(routeSelection.configPath, normalizedSelectedWorkspaceRoot)
    ) {
      setSelectedConfigPath((current) => (current === routeSelection.configPath ? current : routeSelection.configPath));
    }

    if (routeSelection.mode === "edit") {
      const nextConfigPath =
        routeSelection.configPath ??
        selectedWorkspacePath ??
        createDefaultLocalEnvironmentConfigPath(environmentEntries, normalizedSelectedWorkspaceRoot);
      if (selectedWorkspacePath !== nextConfigPath) {
        setSelectedConfigPath(nextConfigPath);
      }
      const sourceDocument =
        previewEnvironment ?? createDefaultLocalEnvironmentDocument(normalizedSelectedWorkspaceRoot);
      const editable = toEditableDocument(sourceDocument);
      setEditableEnvironment(editable);
      setInitialFingerprint(JSON.stringify(toPersistedDocument(editable)));
      setSaveErrorMessage(null);
      setSetupPlatform("default");
      setCleanupPlatform("default");
      setIsSetupEnvVarsOpen(false);
      setIsEditMode(true);
      return;
    }

    if (routeSelection.mode === "preview") {
      setIsEditMode(false);
    }
  }, [
    environmentEntries,
    normalizedSelectedWorkspaceRoot,
    previewEnvironment,
    routeSelection,
    selectedWorkspacePath,
  ]);

  const openEditor = () => {
    if (!normalizedSelectedWorkspaceRoot) {
      return;
    }

    const nextConfigPath =
      selectedWorkspacePath ?? createDefaultLocalEnvironmentConfigPath(environmentEntries, normalizedSelectedWorkspaceRoot);
    if (!selectedWorkspacePath) {
      setSelectedConfigPath(nextConfigPath);
    }

    const sourceDocument = previewEnvironment ?? createDefaultLocalEnvironmentDocument(normalizedSelectedWorkspaceRoot);
    const editable = toEditableDocument(sourceDocument);
    setEditableEnvironment(editable);
    setInitialFingerprint(JSON.stringify(toPersistedDocument(editable)));
    setSaveErrorMessage(null);
    setSetupPlatform("default");
    setCleanupPlatform("default");
    setIsSetupEnvVarsOpen(false);
    setIsEditMode(true);
    onUpdateRouteSearch?.(
      buildLocalEnvironmentRouteSearch({
        workspaceRoot: normalizedSelectedWorkspaceRoot,
        configPath: nextConfigPath,
        mode: "edit",
      }),
    );
  };

  const closeEditor = () => {
    setIsEditMode(false);
    setEditableEnvironment(null);
    setInitialFingerprint("");
    setSaveErrorMessage(null);
    setSetupPlatform("default");
    setCleanupPlatform("default");
    setIsSetupEnvVarsOpen(false);
    setIsSaving(false);
    onUpdateRouteSearch?.(
      normalizedSelectedWorkspaceRoot && selectedWorkspacePath
        ? buildLocalEnvironmentRouteSearch({
            workspaceRoot: normalizedSelectedWorkspaceRoot,
            configPath: selectedWorkspacePath,
            mode: "preview",
          })
        : null,
    );
  };

  const saveEditor = async () => {
    if (!selectedWorkspacePath || !editableEnvironment || saveDisabledReason) {
      return;
    }

    const shouldPersistWorktreeConfigPath =
      !configSnapshot?.exists &&
      (selectedWorkspaceGroup?.isCodexWorktree ?? false) &&
      normalizedSelectedWorkspaceRoot !== null;

    setIsSaving(true);
    setSaveErrorMessage(null);
    try {
      await writeLocalEnvironmentConfig({
        hostId: selectedHostId,
        configPath: selectedWorkspacePath,
        raw: renderLocalEnvironmentDocument(toPersistedDocument(editableEnvironment)),
      });
      if (shouldPersistWorktreeConfigPath && normalizedSelectedWorkspaceRoot) {
        void persistWorktreeLocalEnvironmentConfigPath(normalizedSelectedWorkspaceRoot, selectedWorkspacePath).catch(
          () => undefined,
        );
      }
      setReloadVersion((current) => current + 1);
      closeEditor();
      onShowToast?.({
        tone: "success",
        message: t("settings.localEnvironments.save.success"),
      });
    } catch (error) {
      setSaveErrorMessage(
        t("settings.localEnvironments.preview.saveError", {
          error: getErrorMessage(error),
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateScriptSection = (
    sectionKey: "setup" | "cleanup",
    platform: ScriptPlatformSelection,
    script: string,
  ) => {
    setEditableEnvironment((current) => {
      if (!current) {
        return current;
      }

      const section = current[sectionKey];
      const nextSection: LocalEnvironmentScriptSection =
        platform === "default"
          ? { ...section, script }
          : {
              ...section,
              [platform]: script.length > 0 ? { script } : null,
            };
      return {
        ...current,
        [sectionKey]: nextSection,
      };
    });
  };

  const updateAction = (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => {
    setEditableEnvironment((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        actions: current.actions.map((action) => (action.id === actionId ? { ...action, ...patch } : action)),
      };
    });
  };

  const removeAction = (actionId: string) => {
    setEditableEnvironment((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        actions: current.actions.filter((action) => action.id !== actionId),
      };
    });
  };

  const addAction = () => {
    setEditableEnvironment((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        actions: [...current.actions, createEditableAction()],
      };
    });
  };

  const openWorkspaceSelection = () => {
    setSelectedWorkspaceRoot(null);
    setSelectedConfigPath(null);
    setIsEditMode(false);
    onUpdateRouteSearch?.(null);
  };

  const selectWorkspaceEnvironment = (workspaceRoot: string, configPath: string) => {
    setSelectedWorkspaceRoot(workspaceRoot);
    setSelectedConfigPath(configPath);
    setIsEditMode(false);
    onUpdateRouteSearch?.(
      buildLocalEnvironmentRouteSearch({
        workspaceRoot,
        configPath,
        mode: "preview",
      }),
    );
  };

  const createWorkspaceEnvironment = (workspaceRoot: string, entries: LocalEnvironmentConfigEntry[]) => {
    const nextConfigPath = createDefaultLocalEnvironmentConfigPath(
      entries.filter((entry) => isConfigPathForWorkspace(entry.configPath, workspaceRoot)),
      workspaceRoot,
    );
    setSelectedWorkspaceRoot(workspaceRoot);
    setSelectedConfigPath(nextConfigPath);
    setIsEditMode(true);
    onUpdateRouteSearch?.(
      buildLocalEnvironmentRouteSearch({
        workspaceRoot,
        configPath: nextConfigPath,
        mode: "edit",
      }),
    );
  };

  const handleAddProject = async () => {
    if (isRemoteHost) {
      onRequestOpenRemoteProjectDialog?.();
      return;
    }
    await addNewWorkspaceRootOption();
  };

  const handleSaveRemoteProject = async ({ hostId, remotePath }: { hostId: string; remotePath: string }) => {
    setIsRemoteProjectSaving(true);
    try {
      await saveRemoteProject({
        hostId,
        remotePath,
      });
      setIsRemoteProjectDialogOpen(false);
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("projectSetupDialog.saveError"),
      });
    } finally {
      setIsRemoteProjectSaving(false);
    }
  };

  if (isSelectProjectMode) {
    return (
      <LocalEnvironmentsPageFrame
        subtitle={renderLearnMoreDescription(
          t("settings.localEnvironments.workspaceSelect.description"),
          t("settings.localEnvironments.workspaceSelect.learnMore"),
        )}
      >
        <WorkspaceSelectionCard
          groups={workspaceProjectGroups}
          hostId={selectedHostId}
          isLoading={isWorkspaceRootsLoading}
          onAddProject={() => void handleAddProject()}
          onCreateEnvironment={createWorkspaceEnvironment}
          onSelectEnvironment={selectWorkspaceEnvironment}
        />
      </LocalEnvironmentsPageFrame>
    );
  }

  if (isListLoading || isDetailsLoading || !selectedWorkspacePath || !normalizedSelectedWorkspaceRoot) {
    return (
      <LocalEnvironmentsPageFrame
        backSlot={
          <Breadcrumbs
            mode={isEditMode ? "edit" : "preview"}
            onBack={isEditMode ? closeEditor : openWorkspaceSelection}
            workspaceLabel={selectedWorkspaceLabel}
            workspaceRoot={selectedWorkspaceRoot}
          />
        }
      >
        <LoadingOrUnavailableGroup
          body={t("settings.localEnvironments.loading.body")}
          title={t("settings.localEnvironments.loading.title")}
        />
      </LocalEnvironmentsPageFrame>
    );
  }

  if (!configSnapshot) {
    return (
      <LocalEnvironmentsPageFrame
        backSlot={
          <Breadcrumbs
            mode={isEditMode ? "edit" : "preview"}
            onBack={isEditMode ? closeEditor : openWorkspaceSelection}
            workspaceLabel={selectedWorkspaceLabel}
            workspaceRoot={selectedWorkspaceRoot}
          />
        }
      >
        <LoadingOrUnavailableGroup
          body={t("settings.localEnvironments.unavailable.body")}
          title={t("settings.localEnvironments.unavailable.title")}
        />
      </LocalEnvironmentsPageFrame>
    );
  }

  const pageContent = isEditMode ? (
    editableEnvironment ? (
      <LocalEnvironmentEditor
        cleanupPlatform={cleanupPlatform}
        editableEnvironment={editableEnvironment}
        isSaving={isSaving}
        isSetupEnvVarsOpen={isSetupEnvVarsOpen}
        onAddAction={addAction}
        onNameChange={(name) =>
          setEditableEnvironment((current) => (current ? { ...current, name } : current))
        }
        onRemoveAction={removeAction}
        onSave={() => void saveEditor()}
        onSetupEnvVarsOpenChange={setIsSetupEnvVarsOpen}
        onSetupPlatformChange={setSetupPlatform}
        onCleanupPlatformChange={setCleanupPlatform}
        onUpdateAction={updateAction}
        onUpdateScript={updateScriptSection}
        parseErrorMessage={parseErrorMessage}
        readErrorMessage={readErrorMessage}
        saveDisabledReason={saveDisabledReason}
        saveErrorMessage={saveErrorMessage}
        setupPlatform={setupPlatform}
        workspaceGroup={selectedWorkspaceGroup}
        workspaceRoot={normalizedSelectedWorkspaceRoot}
      />
    ) : (
      <LoadingOrUnavailableGroup
        body={t("settings.localEnvironments.unavailable.body")}
        title={t("settings.localEnvironments.unavailable.title")}
      />
    )
  ) : (
    <LocalEnvironmentPreview
      configExists={configSnapshot.exists}
      initialEnvironment={previewEnvironment}
      onEdit={openEditor}
      parseErrorMessage={parseErrorMessage}
      readErrorMessage={readErrorMessage}
      workspaceGroup={selectedWorkspaceGroup}
      workspaceRoot={normalizedSelectedWorkspaceRoot}
    />
  );

  return (
    <LocalEnvironmentsPageFrame
      backSlot={
        <Breadcrumbs
          mode={isEditMode ? "edit" : "preview"}
          onBack={isEditMode ? closeEditor : openWorkspaceSelection}
          workspaceLabel={selectedWorkspaceLabel}
          workspaceRoot={selectedWorkspaceRoot}
        />
      }
    >
      {pageContent}
      {isRemoteProjectDialogOpen ? (
        <RemoteProjectSetupDialog
          connectedRemoteConnections={connectedRemoteConnections}
          initialHostId={isRemoteHost ? selectedHostId : connectedRemoteConnections[0]?.hostId ?? LOCAL_SETTINGS_HOST_ID}
          isSaving={isRemoteProjectSaving}
          remoteProjects={remoteProjects}
          onClose={() => {
            if (!isRemoteProjectSaving) {
              setIsRemoteProjectDialogOpen(false);
            }
          }}
          onSave={(params) => void handleSaveRemoteProject(params)}
        />
      ) : null}
    </LocalEnvironmentsPageFrame>
  );
}

function LocalEnvironmentsPageFrame({
  backSlot = null,
  children,
  subtitle,
  subtitleClassName,
}: {
  backSlot?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  subtitleClassName?: string;
}) {
  return (
    <SettingsContentLayout
      backSlot={backSlot}
      subtitle={subtitle}
      subtitleClassName={subtitleClassName ?? "leading-6"}
      title={<SettingsSectionTitle slug="local-environments" />}
    >
      {children}
    </SettingsContentLayout>
  );
}

function LoadingOrUnavailableGroup({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <SettingsGroup>
      <SettingsGroup.Header title={title} />
      <SettingsGroup.Content>
        <SettingsSurface className="rounded-xl">
          <div className="p-3 text-sm text-token-text-secondary">{body}</div>
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function Breadcrumbs({
  workspaceLabel,
  workspaceRoot,
  mode,
  onBack,
}: {
  workspaceLabel?: string | null;
  workspaceRoot: string | null;
  mode: "preview" | "edit";
  onBack: (() => void) | null;
}) {
  const { t } = useI18n();
  const resolvedWorkspaceLabel =
    workspaceLabel ??
    (workspaceRoot ? getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot : t("settings.localEnvironments.breadcrumb.root"));

  return (
    <nav className="flex items-center gap-2 text-sm text-token-text-secondary">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="app-control flex items-center gap-1 rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          <BackNavigationIcon className="icon-xs" />
          {t("settings.localEnvironments.breadcrumb.back")}
        </button>
      ) : null}
      <div className="flex items-center gap-1">
        <span>{t("settings.localEnvironments.breadcrumb.root")}</span>
        <ChevronRightIcon className="icon-xs text-token-text-secondary" />
        <span className="text-token-text-primary">{resolvedWorkspaceLabel}</span>
        {mode === "edit" ? (
          <>
            <ChevronRightIcon className="icon-xs text-token-text-secondary" />
            <span>{t("settings.localEnvironments.breadcrumb.edit")}</span>
          </>
        ) : null}
      </div>
    </nav>
  );
}

function WorkspaceSelectionCard({
  groups,
  hostId,
  isLoading,
  onAddProject,
  onCreateEnvironment,
  onSelectEnvironment,
}: {
  groups: WorkspaceProjectGroup[];
  hostId: string;
  isLoading: boolean;
  onAddProject: () => void;
  onCreateEnvironment: (workspaceRoot: string, entries: LocalEnvironmentConfigEntry[]) => void;
  onSelectEnvironment: (workspaceRoot: string, configPath: string) => void;
}) {
  const { t } = useI18n();
  const addProjectAction = (
    <Button color="secondary" size="toolbar" onClick={onAddProject}>
      {t("settings.localEnvironments.workspace.add")}
    </Button>
  );

  if (isLoading) {
    return (
      <SettingsGroup className="gap-2">
        <SettingsGroup.Header
          title={t("settings.localEnvironments.workspaceSelect.title")}
          actions={addProjectAction}
        />
        <SettingsGroup.Content>
          <SettingsSurface className="rounded-xl">
            <div className="flex items-center gap-2 p-3 text-sm text-token-text-secondary">
              <Spinner className="icon-xs" />
              <span>{t("settings.localEnvironments.workspaceSelect.loading")}</span>
            </div>
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
    );
  }

  if (groups.length === 0) {
    return (
      <SettingsGroup className="gap-2">
        <SettingsGroup.Header
          title={t("settings.localEnvironments.workspaceSelect.title")}
          actions={addProjectAction}
        />
        <SettingsGroup.Content>
          <SettingsSurface className="rounded-xl">
            <div className="flex flex-col gap-3 p-3 text-sm text-token-text-secondary">
              <div>{t("settings.localEnvironments.workspaceSelect.empty")}</div>
              <div>
                <Button color="primary" size="toolbar" onClick={onAddProject}>
                  {t("settings.localEnvironments.workspace.add")}
                </Button>
              </div>
            </div>
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup className="gap-2">
      <SettingsGroup.Header
        title={t("settings.localEnvironments.workspaceSelect.title")}
        actions={addProjectAction}
      />
      <SettingsGroup.Content>
        <div className="flex flex-col gap-3" aria-label={t("settings.localEnvironments.workspaceSelect.listLabel")} role="list">
          {groups.map((group) => (
            <WorkspaceSelectionProjectCard
              key={group.path}
              group={group}
              hostId={hostId}
              isInitiallyExpanded={false}
              onCreateEnvironment={onCreateEnvironment}
              onSelectEnvironment={onSelectEnvironment}
            />
          ))}
        </div>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function WorkspaceSelectionProjectCard({
  group,
  hostId,
  isInitiallyExpanded,
  onCreateEnvironment,
  onSelectEnvironment,
}: {
  group: WorkspaceProjectGroup;
  hostId: string;
  isInitiallyExpanded: boolean;
  onCreateEnvironment: (workspaceRoot: string, entries: LocalEnvironmentConfigEntry[]) => void;
  onSelectEnvironment: (workspaceRoot: string, configPath: string) => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<LocalEnvironmentConfigEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const workspaceRoot = group.path;

  useEffect(() => {
    setIsExpanded(isInitiallyExpanded);
  }, [isInitiallyExpanded]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    void listLocalEnvironments({ hostId, workspaceRoot })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setEntries(response.environments);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setEntries([]);
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hostId, workspaceRoot]);

  const { projectEntries, inheritedEntries } = useMemo(
    () => splitProjectAndInheritedEntries(entries, workspaceRoot),
    [entries, workspaceRoot],
  );
  const preferredProjectEntry = useMemo(() => getPreferredLocalEnvironment(projectEntries), [projectEntries]);
  const hasEntries = projectEntries.length > 0 || inheritedEntries.length > 0;
  const ProjectIcon = group.isCodexWorktree ? WorktreeIcon : FolderIcon;
  const ownerLabel = group.repositoryData?.ownerRepo?.owner ?? null;

  return (
    <SettingsSurface className="rounded-lg p-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (preferredProjectEntry) {
              onSelectEnvironment(workspaceRoot, preferredProjectEntry.configPath);
            }
          }}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <ProjectIcon className="icon-sm shrink-0 text-token-text-secondary" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 text-sm text-token-text-primary">
              <span className="truncate font-medium">{group.label}</span>
              {ownerLabel ? <span className="truncate text-token-text-secondary">{ownerLabel}</span> : null}
            </div>
          </div>
        </button>

        <Button
          aria-label={t("settings.localEnvironments.workspaceSelect.addLabel")}
          className="w-9 justify-center"
          color="secondary"
          size="toolbar"
          onClick={() => onCreateEnvironment(workspaceRoot, entries)}
        >
          <PlusIcon className="icon-xs" />
        </Button>
      </div>

      {isLoading ? (
        <div className="border-t border-token-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-token-text-secondary">
            <Spinner className="icon-xs" />
            <span>{t("settings.localEnvironments.workspaceSelect.loadingLabel")}</span>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="border-t border-token-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-token-error-foreground">
            <span>{t("settings.localEnvironments.workspaceSelect.errorLabel")}</span>
          </div>
        </div>
      ) : hasEntries ? (
        <div className="border-t border-token-border">
          <div className="divide-y divide-token-border">
            {projectEntries.map((entry: LocalEnvironmentConfigEntry) => (
              <WorkspaceEnvironmentRow
                key={entry.configPath}
                actionLabel={t("settings.localEnvironments.workspaceSelect.viewAction")}
                entry={entry}
                errorLabel={t("settings.localEnvironments.workspaceSelect.errorLabel")}
                onSelect={() => onSelectEnvironment(workspaceRoot, entry.configPath)}
              />
            ))}
          </div>
          {inheritedEntries.length > 0 ? (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                aria-expanded={isExpanded}
                className="flex cursor-interaction items-center justify-between gap-3 px-4 py-3 text-left text-sm text-token-text-secondary hover:bg-token-list-hover-background"
              >
                <span className="min-w-0 truncate">
                  {t("settings.localEnvironments.workspaceSelect.inherited", {
                    count: inheritedEntries.length,
                  })}
                </span>
                <ChevronRightIcon
                  className={[
                    "icon-2xs shrink-0 text-token-input-placeholder-foreground transition-transform",
                    isExpanded ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              {isExpanded ? (
                <div className="flex flex-col divide-y divide-token-border border-t border-token-border">
                  {inheritedEntries.map((entry: LocalEnvironmentConfigEntry) => (
                    <WorkspaceEnvironmentRow
                      key={entry.configPath}
                      actionLabel={t("settings.localEnvironments.workspaceSelect.viewAction")}
                      entry={entry}
                      errorLabel={t("settings.localEnvironments.workspaceSelect.errorLabel")}
                      onSelect={() => onSelectEnvironment(workspaceRoot, entry.configPath)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </SettingsSurface>
  );
}

function WorkspaceEnvironmentRow({
  actionLabel,
  entry,
  errorLabel,
  onSelect,
}: {
  actionLabel: string;
  entry: LocalEnvironmentConfigEntry;
  errorLabel: string;
  onSelect: () => void;
}) {
  const fileLabel = getLocalEnvironmentConfigFileLabel(entry);
  const title =
    entry.type === "success" && entry.environment.name.trim().length > 0
      ? entry.environment.name
      : entry.type === "error"
        ? errorLabel
        : fileLabel;
  const subtitle = entry.type === "error" || fileLabel !== title ? fileLabel : null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className={entry.type === "error" ? "text-sm text-token-error-foreground" : "text-sm text-token-text-primary"}>
          {title}
        </div>
        {subtitle ? <div className="text-xs text-token-text-secondary">{subtitle}</div> : null}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function LocalEnvironmentPreview({
  configExists,
  initialEnvironment,
  onEdit,
  parseErrorMessage,
  readErrorMessage,
  workspaceGroup,
  workspaceRoot,
}: {
  configExists: boolean;
  initialEnvironment: LocalEnvironmentDocument | null;
  onEdit: () => void;
  parseErrorMessage: string | null;
  readErrorMessage: string | null;
  workspaceGroup: WorkspaceProjectGroup | null;
  workspaceRoot: string;
}) {
  const { t } = useI18n();
  const hasEnvironment = configExists && initialEnvironment !== null;
  const actions = initialEnvironment?.actions ?? [];
  const setupOverrides = getScriptOverrides(initialEnvironment?.setup ?? null);
  const cleanupOverrides = getScriptOverrides(initialEnvironment?.cleanup ?? null);

  return (
    <div className="flex flex-col gap-[var(--padding-panel)]">
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.localEnvironments.workspace.title")} />
        <SettingsGroup.Content>
          <SettingsSurface>
            <ProjectSummaryCard workspaceGroup={workspaceGroup} workspaceRoot={workspaceRoot} />
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.localEnvironments.environment.title")} />
        <SettingsGroup.Content className="gap-[var(--padding-panel)]">
          {hasEnvironment && initialEnvironment ? (
            <>
              <SettingsSurface>
                <LocalEnvironmentSettingsRow
                  control={<span className="text-sm text-token-text-secondary">{initialEnvironment.name}</span>}
                  label={t("settings.localEnvironments.environment.name")}
                />
              </SettingsSurface>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-token-text-primary">
                        {t("settings.localEnvironments.environment.setup")}
                      </div>
                      <div className="text-sm text-token-text-secondary">
                        {t("settings.localEnvironments.environment.setup.description")}
                      </div>
                    </div>
                    <SetupEnvVarsPopover />
                  </div>
                </div>
                <CodeBlock script={initialEnvironment.setup.script} />
                {setupOverrides.length > 0 ? (
                  <PlatformOverridesPreview
                    description={t("settings.localEnvironments.environment.setup.platformOverrides.description")}
                    overrides={setupOverrides}
                    title={t("settings.localEnvironments.environment.setup.platformOverrides")}
                  />
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-token-text-primary">
                    {t("settings.localEnvironments.environment.cleanup.summaryTitle")}
                  </div>
                  <div className="text-sm text-token-text-secondary">
                    {t("settings.localEnvironments.environment.cleanup.summaryDescription")}
                  </div>
                </div>
                {initialEnvironment.cleanup.script.length > 0 ? (
                  <CodeBlock script={initialEnvironment.cleanup.script} />
                ) : (
                  <SettingsSurface>
                    <div className="p-3 text-sm text-token-text-secondary">
                      {t("settings.localEnvironments.environment.cleanup.empty")}
                    </div>
                  </SettingsSurface>
                )}
                {cleanupOverrides.length > 0 ? (
                  <PlatformOverridesPreview
                    description={t("settings.localEnvironments.environment.cleanup.platformOverrides.description")}
                    overrides={cleanupOverrides}
                    title={t("settings.localEnvironments.environment.cleanup.platformOverrides")}
                  />
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-token-text-primary">
                    {t("settings.localEnvironments.environment.actionsLabel")}
                  </div>
                  <div className="text-sm text-token-text-secondary">
                    {t("settings.localEnvironments.environment.actions.description")}
                  </div>
                </div>
                <SettingsSurface>
                  <div className="flex flex-col gap-2 p-3">
                    {actions.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {actions.map((action, index) => (
                          <ActionSummaryRow key={`${action.name}-${index}`} action={action} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-token-text-secondary">
                        {t("settings.localEnvironments.actions.empty")}
                      </div>
                    )}
                  </div>
                </SettingsSurface>
              </div>
            </>
          ) : (
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">
                {t("settings.localEnvironments.environment.empty")}
              </div>
            </SettingsSurface>
          )}

          {parseErrorMessage ? (
            <div className="mt-2 text-sm text-token-error-foreground">
              {t("settings.localEnvironments.file.parseError", { error: parseErrorMessage })}
            </div>
          ) : null}
          {readErrorMessage ? (
            <div className="mt-2 text-sm text-token-error-foreground">
              {t("settings.localEnvironments.file.readError", { error: readErrorMessage })}
            </div>
          ) : null}
        </SettingsGroup.Content>
      </SettingsGroup>

      <div className="flex justify-end">
        <Button color="primary" size="toolbar" onClick={onEdit}>
          {hasEnvironment
            ? t("settings.localEnvironments.environment.edit")
            : t("settings.localEnvironments.environment.create")}
        </Button>
      </div>
    </div>
  );
}

function LocalEnvironmentEditor({
  cleanupPlatform,
  editableEnvironment,
  isSaving,
  isSetupEnvVarsOpen,
  onAddAction,
  onCleanupPlatformChange,
  onNameChange,
  onRemoveAction,
  onSave,
  onSetupEnvVarsOpenChange,
  onSetupPlatformChange,
  onUpdateAction,
  onUpdateScript,
  parseErrorMessage,
  readErrorMessage,
  saveDisabledReason,
  saveErrorMessage,
  setupPlatform,
  workspaceGroup,
  workspaceRoot,
}: {
  cleanupPlatform: ScriptPlatformSelection;
  editableEnvironment: EditableLocalEnvironmentDocument;
  isSaving: boolean;
  isSetupEnvVarsOpen: boolean;
  onAddAction: () => void;
  onCleanupPlatformChange: (platform: ScriptPlatformSelection) => void;
  onNameChange: (name: string) => void;
  onRemoveAction: (actionId: string) => void;
  onSave: () => void;
  onSetupEnvVarsOpenChange: (open: boolean) => void;
  onSetupPlatformChange: (platform: ScriptPlatformSelection) => void;
  onUpdateAction: (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => void;
  onUpdateScript: (
    sectionKey: "setup" | "cleanup",
    platform: ScriptPlatformSelection,
    script: string,
  ) => void;
  parseErrorMessage: string | null;
  readErrorMessage: string | null;
  saveDisabledReason: string | null;
  saveErrorMessage: string | null;
  setupPlatform: ScriptPlatformSelection;
  workspaceGroup: WorkspaceProjectGroup | null;
  workspaceRoot: string;
}) {
  const { t } = useI18n();
  const saveDisabled = saveDisabledReason !== null;

  return (
    <form
      className="flex flex-col gap-[var(--padding-panel)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!saveDisabled) {
          onSave();
        }
      }}
    >
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.localEnvironments.editor.title")} />
        <SettingsGroup.Content className="gap-[var(--padding-panel)]">
          <SettingsSurface>
            <ProjectSummaryCard workspaceGroup={workspaceGroup} workspaceRoot={workspaceRoot} />
          </SettingsSurface>

          {parseErrorMessage ? (
            <div className="mt-2 text-sm text-token-error-foreground">
              {t("settings.localEnvironments.file.parseError", { error: parseErrorMessage })}
            </div>
          ) : null}
          {readErrorMessage ? (
            <div className="mt-2 text-sm text-token-error-foreground">
              {t("settings.localEnvironments.file.readError", { error: readErrorMessage })}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="local-environment-name"
              className="text-sm font-medium text-token-text-primary"
            >
              {t("settings.localEnvironments.environment.name")}
            </label>
            <input
              id="local-environment-name"
              className="focus-visible:ring-token-focus w-72 rounded-md border border-token-border bg-token-input-background px-2.5 py-1.5 text-sm text-token-text-primary outline-none focus-visible:ring-2"
              value={editableEnvironment.name}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-token-text-primary">
                {t("settings.localEnvironments.environment.setup")}
              </div>
              <div className="text-sm text-token-text-secondary">
                {t("settings.localEnvironments.editor.setup.description")}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl
                  ariaLabel={t("settings.localEnvironments.environment.setup.platformSelector")}
                  options={buildScriptPlatformOptions(t)}
                  selectedId={setupPlatform}
                  onSelect={(value) => onSetupPlatformChange(value as ScriptPlatformSelection)}
                />
                <SetupEnvVarsPopover
                  open={isSetupEnvVarsOpen}
                  onOpenChange={onSetupEnvVarsOpenChange}
                />
              </div>
              <textarea
                id={`local-environment-setup-script-${setupPlatform}`}
                className="focus-visible:ring-token-focus w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-2 font-mono text-sm text-token-text-primary outline-none focus-visible:ring-2"
                value={getScriptForPlatform(editableEnvironment.setup, setupPlatform)}
                placeholder={LOCAL_ENVIRONMENT_SETUP_PLACEHOLDER}
                rows={6}
                onChange={(event) => onUpdateScript("setup", setupPlatform, event.target.value)}
              />
            </div>
          </div>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Content className="gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-token-text-primary">
              {t("settings.localEnvironments.environment.cleanup.title")}
            </div>
            <div className="text-sm text-token-text-secondary">
              {t("settings.localEnvironments.environment.cleanup.description")}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                ariaLabel={t("settings.localEnvironments.environment.cleanup.platformSelector")}
                options={buildScriptPlatformOptions(t)}
                selectedId={cleanupPlatform}
                onSelect={(value) => onCleanupPlatformChange(value as ScriptPlatformSelection)}
              />
            </div>
            <textarea
              id={`local-environment-cleanup-script-${cleanupPlatform}`}
              className="focus-visible:ring-token-focus w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-2 font-mono text-sm text-token-text-primary outline-none focus-visible:ring-2"
              value={getScriptForPlatform(editableEnvironment.cleanup, cleanupPlatform)}
              placeholder={LOCAL_ENVIRONMENT_CLEANUP_PLACEHOLDER}
              rows={6}
              onChange={(event) => onUpdateScript("cleanup", cleanupPlatform, event.target.value)}
            />
          </div>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header
          title={t("settings.localEnvironments.actions.title")}
          actions={
            <Button color="secondary" size="toolbar" onClick={onAddAction}>
              {t("settings.localEnvironments.actions.add")}
            </Button>
          }
        />
        <SettingsGroup.Content className="gap-1">
          <div className="text-sm text-token-text-secondary">
            {t("settings.localEnvironments.environment.actions.description")}
          </div>
          {editableEnvironment.actions.length === 0 ? (
            <SettingsSurface>
              <div className="p-3 text-sm text-token-text-secondary">
                {t("settings.localEnvironments.actions.empty")}
              </div>
            </SettingsSurface>
          ) : (
            <div className="flex flex-col gap-3">
              {editableEnvironment.actions.map((action) => (
                <ActionEditorCard
                  key={action.id}
                  action={action}
                  onChange={onUpdateAction}
                  onDelete={onRemoveAction}
                />
              ))}
            </div>
          )}
        </SettingsGroup.Content>
      </SettingsGroup>

      {saveErrorMessage ? (
        <div className="text-sm text-token-error-foreground">{saveErrorMessage}</div>
      ) : null}

      <div className="flex justify-end">
        <span className="inline-flex" title={saveDisabledReason ?? undefined}>
          <Button color="primary" disabled={saveDisabled} size="toolbar" loading={isSaving} type="submit">
            {t("settings.localEnvironments.preview.save")}
          </Button>
        </span>
      </div>
    </form>
  );
}

function ProjectSummaryCard({
  workspaceGroup,
  workspaceRoot,
}: {
  workspaceGroup: WorkspaceProjectGroup | null;
  workspaceRoot: string;
}) {
  const resolvedLabel = workspaceGroup?.label ?? getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot;
  const rootFolder = workspaceGroup?.repositoryData?.rootFolder ?? null;
  const secondaryLabel =
    rootFolder && rootFolder !== resolvedLabel ? `(${rootFolder})` : null;
  const ProjectIcon = workspaceGroup?.isCodexWorktree ? WorktreeIcon : FolderIcon;

  return (
    <div className="flex items-center gap-3 p-3">
      <ProjectIcon className="icon-sm shrink-0 text-token-text-secondary" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1 text-sm text-token-text-primary">
          <span className="truncate">{resolvedLabel}</span>
          {secondaryLabel ? (
            <span className="truncate text-xs text-token-description-foreground">{secondaryLabel}</span>
          ) : null}
        </div>
        <span className="truncate text-xs text-token-text-secondary">{workspaceRoot}</span>
      </div>
    </div>
  );
}

function PlatformOverridesPreview({
  description,
  overrides,
  title,
}: {
  description: string;
  overrides: Array<{ platform: LocalEnvironmentPlatform; script: string }>;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
          {title}
        </div>
        <div className="text-sm text-token-text-secondary">{description}</div>
      </div>
      {overrides.map((override) => (
        <PlatformScriptPreview key={override.platform} platform={override.platform} script={override.script} />
      ))}
    </div>
  );
}

function PlatformScriptPreview({
  platform,
  script,
}: {
  platform: LocalEnvironmentPlatform;
  script: string;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
        {formatPlatformLabel(platform, t)}
      </div>
      <CodeBlock script={script} />
    </div>
  );
}

function ActionSummaryRow({ action }: { action: LocalEnvironmentAction }) {
  return (
    <div className="flex items-center gap-2 text-sm text-token-text-secondary">
      <span className="text-token-text-secondary">
        <LocalEnvironmentActionIconGlyph icon={action.icon ?? "tool"} />
      </span>
      <span>{action.name}</span>
    </div>
  );
}

function LocalEnvironmentSettingsRow({
  control,
  label,
}: {
  control: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 flex-1">
        <div className="text-[14px]">{label}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SegmentedControl({
  ariaLabel,
  options,
  selectedId,
  onSelect,
}: {
  ariaLabel: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="app-segmented inline-flex rounded-[12px] p-1" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition",
            option.id === selectedId ? "app-segmented-option-active" : "app-segmented-option-idle",
          ].join(" ")}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SetupEnvVarsPopover({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        className="w-auto"
        color="ghost"
        size="toolbar"
        onClick={() => setOpen(!isOpen)}
      >
        {t("settings.localEnvironments.environment.setup.envVars.button")}
      </Button>
      {isOpen ? (
        <div className="absolute top-[calc(100%+8px)] right-0 z-20 flex w-80 max-w-[min(20rem,var(--radix-popover-content-available-width))] flex-col gap-1 rounded-lg border border-token-border bg-token-bg-fog p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="px-2 py-1 text-sm font-medium text-token-text-primary">
            {t("settings.localEnvironments.environment.setup.envVars.title")}
          </div>
          <div className="flex flex-col gap-1">
            <EnvVarRow
              description={t("settings.localEnvironments.environment.setup.envVars.sourcePath.description")}
              variable="CODEX_SOURCE_PATH"
            />
            <EnvVarRow
              description={t("settings.localEnvironments.environment.setup.envVars.worktreePath.description")}
              variable="CODEX_WORKTREE_PATH"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionEditorCard({
  action,
  onChange,
  onDelete,
}: {
  action: EditableLocalEnvironmentAction;
  onChange: (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => void;
  onDelete: (actionId: string) => void;
}) {
  const { t } = useI18n();
  const isPlatformSpecific = action.platform !== null;
  const selectedPlatform = action.platform ?? "darwin";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-token-border bg-token-input-background p-3">
      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary"
          htmlFor={`local-env-action-name-${action.id}`}
        >
          {t("settings.localEnvironments.actions.item.name")}
        </label>
        <div className="flex items-center gap-2">
          <ActionIconMenu
            ariaLabel={t(getActionIconMessageKey(action.icon ?? "tool"))}
            onChange={(icon) => onChange(action.id, { icon })}
            t={t}
            value={action.icon ?? "tool"}
          />
          <div className="flex-1">
            <input
              id={`local-env-action-name-${action.id}`}
              className="focus-visible:ring-token-focus w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-1.5 text-sm text-token-text-primary outline-none focus-visible:ring-2"
              value={action.name}
              onChange={(event) => onChange(action.id, { name: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary"
          htmlFor={`local-env-action-command-${action.id}`}
        >
          {t("settings.localEnvironments.actions.item.command")}
        </label>
        <textarea
          id={`local-env-action-command-${action.id}`}
          className="focus-visible:ring-token-focus w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-2 font-mono text-sm text-token-text-primary outline-none focus-visible:ring-2"
          value={action.command}
          placeholder={LOCAL_ENVIRONMENT_ACTION_PLACEHOLDER}
          rows={4}
          onChange={(event) => onChange(action.id, { command: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
                {t("settings.localEnvironments.actions.item.platforms")}
              </div>
              <div className="text-xs text-token-text-secondary">
                {t("settings.localEnvironments.actions.item.platforms.help")}
              </div>
              <div className="relative flex items-center gap-2 text-sm">
                <input
                  id={`local-env-action-platform-specific-${action.id}`}
                  type="checkbox"
                  checked={isPlatformSpecific}
                  className="h-4 w-4 rounded border border-token-border"
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange(action.id, { platform: selectedPlatform });
                      return;
                    }
                    onChange(action.id, { platform: null });
                  }}
                />
                <label
                  className="text-token-text-secondary"
                  htmlFor={`local-env-action-platform-specific-${action.id}`}
                >
                  {t("settings.localEnvironments.actions.item.platforms.specific")}
                </label>
              </div>
            </div>
          </div>

          {isPlatformSpecific ? (
            <div className="flex justify-start">
              <SegmentedControl
                ariaLabel={t("settings.localEnvironments.actions.item.platforms.selector")}
                options={buildPlatformOptions(t)}
                selectedId={selectedPlatform}
                onSelect={(value) => onChange(action.id, { platform: value as LocalEnvironmentPlatform })}
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end sm:justify-center">
          <Button
            aria-label={t("settings.localEnvironments.actions.item.button.delete")}
            color="ghost"
            size="toolbar"
            onClick={() => onDelete(action.id)}
            title={t("settings.localEnvironments.actions.item.tooltip.delete")}
          >
            <TrashIcon className="icon-sm" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionIconMenu({
  ariaLabel,
  onChange,
  t,
  value,
}: {
  ariaLabel: string;
  onChange: (icon: LocalEnvironmentActionIcon) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  value: LocalEnvironmentActionIcon;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((current) => !current)}
        className="app-control flex h-[40px] w-[48px] items-center justify-center rounded-[11px]"
      >
        <LocalEnvironmentActionIconGlyph icon={value} />
      </button>

      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] left-0 z-20 w-[170px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="space-y-1">
            {LOCAL_ENVIRONMENT_ACTION_ICONS.map((icon) => {
              const isSelected = icon === value;
              return (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onChange(icon);
                  }}
                  className={[
                    "flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <LocalEnvironmentActionIconGlyph icon={icon} />
                  <span>{t(getActionIconMessageKey(icon))}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocalEnvironmentActionIconGlyph({ icon }: { icon: LocalEnvironmentActionIcon }) {
  if (icon === "tool") {
    return <SettingsCogIcon className="icon-sm" />;
  }
  if (icon === "run") {
    return <PlayOutlineIcon className="icon-sm" />;
  }
  if (icon === "debug") {
    return <BugIcon className="icon-sm" />;
  }
  return <TestIcon className="icon-sm" />;
}

function EnvVarRow({ description, variable }: { description: string; variable: string }) {
  return (
    <div className="rounded-lg px-2 py-1">
      <div className="text-sm text-token-text-secondary">{description}</div>
      <div className="mt-2 overflow-x-auto rounded-md border border-token-input-background bg-token-text-code-block-background px-2 py-1.5">
        <code className="block whitespace-nowrap text-xs font-medium text-token-text-primary">{variable}</code>
      </div>
    </div>
  );
}

function CodeBlock({ script }: { script: string }) {
  return (
    <CodeSnippet
      codeContainerClassName="max-h-40"
      content={script}
      language="bash"
      shouldWrapCode
    />
  );
}

function toEditableDocument(document: LocalEnvironmentDocument): EditableLocalEnvironmentDocument {
  return {
    ...document,
    actions: document.actions.map((action) => ({
      ...action,
      id: crypto.randomUUID(),
    })),
  };
}

function toPersistedDocument(document: EditableLocalEnvironmentDocument): LocalEnvironmentDocument {
  return {
    version: document.version || 1,
    name: document.name,
    setup: normalizeScriptSection(document.setup),
    cleanup: normalizeScriptSection(document.cleanup),
    actions: document.actions.map(({ id: _id, ...action }) => ({
      ...action,
      icon: action.icon ?? null,
      platform: action.platform ?? null,
    })),
  };
}

function normalizeScriptSection(section: LocalEnvironmentScriptSection): LocalEnvironmentScriptSection {
  return {
    script: section.script,
    darwin: section.darwin?.script.length ? section.darwin : null,
    linux: section.linux?.script.length ? section.linux : null,
    win32: section.win32?.script.length ? section.win32 : null,
  };
}

function createEditableAction(): EditableLocalEnvironmentAction {
  return {
    id: crypto.randomUUID(),
    name: "",
    icon: "tool",
    command: "",
    platform: null,
  };
}

function selectConfigPathForWorkspace(
  workspaceRoot: string,
  entries: LocalEnvironmentConfigEntry[],
  currentConfigPath: string | null,
) {
  if (currentConfigPath && isConfigPathForWorkspace(currentConfigPath, workspaceRoot)) {
    return currentConfigPath;
  }

  return (
    getPreferredLocalEnvironment(entries)?.configPath ??
    createDefaultLocalEnvironmentConfigPath(entries, workspaceRoot)
  );
}

function isConfigPathForWorkspace(configPath: string, workspaceRoot: string) {
  return normalizeComparablePath(getLocalEnvironmentOwnerRoot(configPath)) === normalizeComparablePath(workspaceRoot);
}

function splitProjectAndInheritedEntries(entries: LocalEnvironmentConfigEntry[], workspaceRoot: string) {
  const normalizedWorkspaceRoot = normalizeComparablePath(workspaceRoot);
  const projectEntries: LocalEnvironmentConfigEntry[] = [];
  const inheritedEntries: LocalEnvironmentConfigEntry[] = [];

  entries.forEach((entry) => {
    if (normalizeComparablePath(getLocalEnvironmentOwnerRoot(entry.configPath)) === normalizedWorkspaceRoot) {
      projectEntries.push(entry);
      return;
    }
    inheritedEntries.push(entry);
  });

  return { projectEntries, inheritedEntries };
}

function getLocalEnvironmentConfigFileLabel(entry: LocalEnvironmentConfigEntry) {
  const segments = normalizeComparablePath(entry.configPath).split("/").filter(Boolean);
  return segments.at(-1) ?? entry.configPath;
}

function getWorkspaceRootLabel(workspaceRoot: string, labels: Record<string, string>) {
  const label = labels[workspaceRoot]?.trim();
  if (label && label.length > 0) {
    return label;
  }
  return getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot;
}

function renderLearnMoreDescription(description: string, learnMoreLabel: string) {
  const markerIndex = description.indexOf(learnMoreLabel);
  if (markerIndex === -1) {
    return description;
  }

  const prefix = description.slice(0, markerIndex);
  const suffix = description.slice(markerIndex + learnMoreLabel.length);
  return (
    <>
      {prefix}
      <a
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
        href={LOCAL_ENVIRONMENT_LEARN_MORE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {learnMoreLabel}
      </a>
      {suffix}
    </>
  );
}

function normalizeComparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function buildLocalEnvironmentRouteSearch({
  workspaceRoot,
  configPath,
  mode,
}: {
  workspaceRoot?: string | null;
  configPath?: string | null;
  mode?: "edit" | "preview" | null;
}) {
  const params = new URLSearchParams();
  if (workspaceRoot && workspaceRoot.trim().length > 0) {
    params.set("workspaceRoot", workspaceRoot);
  }
  if (configPath && configPath.trim().length > 0) {
    params.set("configPath", configPath);
  }
  if (mode) {
    params.set("mode", mode);
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : null;
}

function parseLocalEnvironmentRouteSearch(routeSearch?: string) {
  const search = typeof routeSearch === "string" ? routeSearch : "";
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const workspaceRoot = normalizeOptionalRouteValue(params.get("workspaceRoot"));
  const configPath = normalizeOptionalRouteValue(params.get("configPath"));
  const rawMode = normalizeOptionalRouteValue(params.get("mode"));
  const mode = rawMode === "edit" || rawMode === "preview" ? rawMode : null;

  return {
    workspaceRoot,
    configPath,
    mode,
  };
}

async function persistWorktreeLocalEnvironmentConfigPath(workspaceRoot: string, configPath: string) {
  const response = await readConfig(workspaceRoot);
  const projectScope = buildConfigScopeOptions(response).find(
    (scope) =>
      scope.kind === "project" &&
      scope.filePath !== null &&
      scope.workspaceRoot !== null &&
      normalizeComparablePath(scope.workspaceRoot) === normalizeComparablePath(workspaceRoot),
  );
  if (!projectScope?.filePath) {
    return;
  }

  await writeConfigValue({
    keyPath: LOCAL_ENVIRONMENT_CONFIG_KEY_PATH,
    value: configPath,
    mergeStrategy: "upsert",
    filePath: projectScope.filePath,
    expectedVersion: projectScope.expectedVersion ?? null,
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeOptionalRouteValue(value: string | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function formatPlatformLabel(
  platform: LocalEnvironmentPlatform,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (platform === "darwin") {
    return t("settings.localEnvironments.actions.item.platforms.macos");
  }
  if (platform === "linux") {
    return t("settings.localEnvironments.actions.item.platforms.linux");
  }
  return t("settings.localEnvironments.actions.item.platforms.windows");
}

function getActionIconMessageKey(icon: LocalEnvironmentActionIcon): MessageKey {
  if (icon === "tool") {
    return "settings.localEnvironments.actions.icon.tool";
  }
  if (icon === "run") {
    return "settings.localEnvironments.actions.icon.run";
  }
  if (icon === "debug") {
    return "settings.localEnvironments.actions.icon.debug";
  }
  return "settings.localEnvironments.actions.icon.test";
}

function buildScriptPlatformOptions(t: (key: MessageKey, values?: Record<string, number | string>) => string) {
  return SCRIPT_PLATFORM_OPTIONS.map((platform) => ({
    id: platform,
    label:
      platform === "default"
        ? t("settings.localEnvironments.environment.script.default")
        : formatPlatformLabel(platform, t),
  }));
}

function buildPlatformOptions(t: (key: MessageKey, values?: Record<string, number | string>) => string) {
  return LOCAL_ENVIRONMENT_PLATFORMS.map((platform) => ({
    id: platform,
    label: formatPlatformLabel(platform, t),
  }));
}

function getScriptOverrides(section: LocalEnvironmentScriptSection | null) {
  if (!section) {
    return [];
  }

  return LOCAL_ENVIRONMENT_PLATFORMS.flatMap((platform) => {
    const script = section[platform]?.script ?? "";
    return script.length > 0 ? [{ platform, script }] : [];
  });
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg width="21" height="20" viewBox="0 0 21 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10.2 12.083C10.8904 12.083 11.45 12.8295 11.45 13.75C11.45 14.6705 10.8904 15.417 10.2 15.417C9.50966 15.417 8.95001 14.6705 8.95001 13.75C8.95003 12.8295 9.50967 12.083 10.2 12.083Z"
        fill="currentColor"
      />
      <path
        d="M8.117 9.16699C8.80708 9.16713 9.36678 9.63296 9.367 10.208C9.367 10.7832 8.80722 11.2499 8.117 11.25C7.42665 11.25 6.867 10.7833 6.867 10.208C6.86723 9.63287 7.42679 9.16699 8.117 9.16699Z"
        fill="currentColor"
      />
      <path
        d="M12.283 9.16699C12.9732 9.16699 13.5328 9.63287 13.533 10.208C13.533 10.7833 12.9734 11.25 12.283 11.25C11.5928 11.2499 11.033 10.7832 11.033 10.208C11.0332 9.63296 11.5929 9.16713 12.283 9.16699Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.1356 1.83496C16.0895 1.83496 16.7003 2.36544 17.0438 2.83887C17.2139 3.07346 17.3281 3.30439 17.3992 3.47461C17.435 3.56037 17.4606 3.6336 17.4783 3.6875C17.4872 3.71448 17.4948 3.73684 17.4998 3.75391C17.5023 3.76229 17.5041 3.76965 17.5057 3.77539C17.5065 3.7782 17.5071 3.78106 17.5076 3.7832C17.5079 3.7842 17.5084 3.78528 17.5086 3.78613L17.5096 3.78809C17.603 4.1431 17.391 4.50793 17.0359 4.60156C16.6809 4.695 16.3171 4.48291 16.2234 4.12793V4.12988L16.2244 4.13086V4.13281C16.2243 4.13251 16.2239 4.13143 16.2234 4.12988C16.2222 4.12556 16.2198 4.11621 16.2156 4.10352C16.2071 4.07776 16.1927 4.03673 16.1717 3.98633C16.1286 3.88318 16.0617 3.74891 15.9676 3.61914C15.7822 3.36365 15.5274 3.16504 15.1356 3.16504C14.3975 3.16516 13.8581 3.58082 13.4207 4.30273C13.3067 4.491 13.2038 4.69355 13.1111 4.9043C15.6971 5.96132 17.5311 8.38367 17.5311 11.25C17.5311 15.1087 14.208 18.1649 10.2 18.165C6.19206 18.1649 2.86798 15.1087 2.86798 11.25C2.86798 8.38418 4.70168 5.96162 7.28693 4.9043C7.19434 4.69371 7.0923 4.49087 6.97833 4.30273C6.54095 3.58089 6.00159 3.16504 5.26349 3.16504C4.87181 3.16524 4.61679 3.36363 4.43146 3.61914C4.33733 3.74896 4.27044 3.88319 4.22736 3.98633C4.20628 4.0368 4.1919 4.07779 4.18341 4.10352C4.17947 4.11549 4.17694 4.12438 4.1756 4.12891C4.08077 4.48278 3.71807 4.69518 3.3631 4.60156C3.00839 4.5077 2.79702 4.14392 2.89044 3.78906C2.89067 3.78527 2.89113 3.78423 2.89142 3.7832C2.892 3.78105 2.89258 3.77824 2.89337 3.77539C2.89498 3.76964 2.89772 3.76233 2.90021 3.75391C2.90523 3.73688 2.91185 3.71438 2.92072 3.6875C2.9385 3.63356 2.96494 3.56051 3.00079 3.47461C3.07186 3.30444 3.18519 3.07343 3.35529 2.83887C3.69862 2.36548 4.30975 1.83519 5.26349 1.83496C6.64054 1.83496 7.54382 2.66973 8.11603 3.61426C8.2881 3.89836 8.434 4.20218 8.56232 4.50977C9.08979 4.39594 9.6384 4.33498 10.2 4.33496C10.7611 4.33498 11.3088 4.39615 11.8358 4.50977C11.9641 4.20208 12.1109 3.89845 12.283 3.61426C12.8552 2.66975 13.7586 1.83509 15.1356 1.83496ZM10.2 5.66504C9.78619 5.66506 9.38256 5.70388 8.99396 5.77734C8.99966 5.79796 9.00597 5.8184 9.01154 5.83887L9.18146 6.51758L9.19806 6.65039C9.20595 6.95974 8.99569 7.24216 8.68243 7.31445C8.36933 7.38653 8.05697 7.22473 7.92853 6.94336L7.88458 6.81641L7.7254 6.17871C7.72389 6.17318 7.72204 6.16765 7.72052 6.16211C5.62919 7.0461 4.19806 9.01126 4.19806 11.25C4.19806 14.2946 6.84445 16.8348 10.2 16.835C13.5556 16.8348 16.201 14.2946 16.201 11.25C16.201 9.01078 14.7696 7.04582 12.6776 6.16211C12.6166 6.38459 12.5633 6.60491 12.5145 6.81641L12.4715 6.94336C12.343 7.22493 12.0299 7.38675 11.7166 7.31445C11.3592 7.23167 11.1363 6.87512 11.2186 6.51758L11.3875 5.83887C11.393 5.81848 11.3984 5.79788 11.4041 5.77734C11.016 5.70407 10.6133 5.66506 10.2 5.66504Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TestIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16.0013 14.4404C16.0012 13.9504 15.8514 13.4739 15.5736 13.0742L15.4467 12.9082L15.0121 12.3877C13.8615 12.8911 12.9154 13.1121 12.0619 13.1562C11.1476 13.2035 10.3805 13.0475 9.66541 12.8857C8.9421 12.7221 8.28162 12.5562 7.47302 12.5146C6.70041 12.475 5.77589 12.5504 4.56873 12.8887L4.5531 12.9082C4.19469 13.3383 3.99852 13.8806 3.99841 14.4404C3.99841 15.7627 5.07071 16.835 6.39294 16.835H13.6078C14.9299 16.8349 16.0013 15.7626 16.0013 14.4404ZM11.8353 3.16504H8.16541V7.72949C8.16541 8.20671 8.01889 8.6713 7.74841 9.06055L7.62439 9.22266L5.93396 11.25C6.52127 11.1756 7.05057 11.1614 7.54041 11.1865C8.48678 11.2351 9.2693 11.432 9.95837 11.5879C10.6557 11.7456 11.272 11.8653 11.9926 11.8281C12.5792 11.7978 13.2617 11.6591 14.1215 11.3184L12.3754 9.22266C12.0262 8.80363 11.8353 8.27494 11.8353 7.72949V3.16504ZM13.1654 7.72949C13.1654 7.96372 13.247 8.19111 13.3969 8.37109L16.4681 12.0566L16.6654 12.3154C17.0976 12.9371 17.3313 13.6782 17.3314 14.4404C17.3314 16.4971 15.6645 18.1649 13.6078 18.165H6.39294C4.33617 18.165 2.66833 16.4972 2.66833 14.4404C2.66844 13.5694 2.97398 12.7258 3.53162 12.0566L6.60291 8.37109L6.65564 8.30176C6.77198 8.13447 6.83533 7.93464 6.83533 7.72949V3.16504H6.66638C6.29926 3.16486 6.00134 2.86716 6.00134 2.5C6.00134 2.13284 6.29926 1.83514 6.66638 1.83496H13.3334L13.4672 1.84863C13.7703 1.91057 13.9984 2.17857 13.9984 2.5C13.9984 2.82143 13.7703 3.08943 13.4672 3.15137L13.3334 3.16504H13.1654V7.72949Z"
        fill="currentColor"
      />
    </svg>
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

