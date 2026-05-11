import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppToast } from "./AppToastRegion";
import {
  BackNavigationIcon,
  FolderIcon,
  PlayOutlineIcon,
  SettingsCogIcon,
  TrashIcon,
} from "./AppShellIcons";
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

const SCRIPT_PLATFORM_OPTIONS = ["default", ...LOCAL_ENVIRONMENT_PLATFORMS] as const;
const LOCAL_ENVIRONMENT_CONFIG_KEY_PATH = "codex.localEnvironmentConfigPath";
const LOCAL_ENVIRONMENT_LEARN_MORE_URL = "https://developers.openai.com/codex/app/local-environments";
const LOCAL_ENVIRONMENT_LOCAL_HOST_ID = "local";

type ScriptPlatformSelection = (typeof SCRIPT_PLATFORM_OPTIONS)[number];

type EditableLocalEnvironmentAction = LocalEnvironmentAction & {
  id: string;
};

type EditableLocalEnvironmentDocument = Omit<LocalEnvironmentDocument, "actions"> & {
  actions: EditableLocalEnvironmentAction[];
};

export function LocalEnvironmentsSettings({
  codexHome,
  selectedHostId,
  onShowToast,
}: {
  codexHome: string | null;
  selectedHostId: string;
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

    return workspaceRoots.includes(selectedWorkspaceRoot) ? selectedWorkspaceRoot : null;
  }, [selectedWorkspaceRoot, workspaceRoots]);

  const selectedWorkspaceLabel = useMemo(() => {
    if (!normalizedSelectedWorkspaceRoot) {
      return null;
    }
    return getWorkspaceRootLabel(normalizedSelectedWorkspaceRoot, workspaceRootLabels);
  }, [normalizedSelectedWorkspaceRoot, workspaceRootLabels]);

  const selectedWorkspaceIsCodexWorktree = useMemo(() => {
    return normalizedSelectedWorkspaceRoot
      ? isWithinCodexWorktrees(normalizedSelectedWorkspaceRoot, codexHome)
      : false;
  }, [codexHome, normalizedSelectedWorkspaceRoot]);

  const isRemoteHost = selectedHostId.trim() !== LOCAL_ENVIRONMENT_LOCAL_HOST_ID;
  const isSelectProjectMode = normalizedSelectedWorkspaceRoot === null;
  const canAddProjectLocally = !isRemoteHost;

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
    if (isRemoteHost) {
      setWorkspaceRoots([]);
      setWorkspaceRootLabels({});
      setActiveWorkspaceRoots([]);
      setSelectedWorkspaceRoot(null);
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
        setSelectedWorkspaceRoot((current) => {
          if (current && workspaceRootOptionsResponse.roots.includes(current)) {
            return current;
          }
          return activeWorkspaceRootsResponse.roots.find((root) => workspaceRootOptionsResponse.roots.includes(root)) ?? null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setWorkspaceRoots([]);
        setWorkspaceRootLabels({});
        setActiveWorkspaceRoots([]);
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
  }, []);

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
  };

  const saveEditor = async () => {
    if (!selectedWorkspacePath || !editableEnvironment || saveDisabledReason) {
      return;
    }

    const shouldPersistWorktreeConfigPath =
      !configSnapshot?.exists && selectedWorkspaceIsCodexWorktree && normalizedSelectedWorkspaceRoot !== null;

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
  };

  const selectWorkspaceEnvironment = (workspaceRoot: string, configPath: string) => {
    setSelectedWorkspaceRoot(workspaceRoot);
    setSelectedConfigPath(configPath);
    setIsEditMode(false);
  };

  const createWorkspaceEnvironment = (workspaceRoot: string) => {
    const nextConfigPath = createDefaultLocalEnvironmentConfigPath(
      environmentEntries.filter((entry) => isConfigPathForWorkspace(entry.configPath, workspaceRoot)),
      workspaceRoot,
    );
    setSelectedWorkspaceRoot(workspaceRoot);
    setSelectedConfigPath(nextConfigPath);
    setIsEditMode(true);
  };

  const handleAddProject = async () => {
    if (!canAddProjectLocally) {
      return;
    }
    await addNewWorkspaceRootOption();
  };

  if (isRemoteHost) {
    return (
      <PageFrame title={t("settings.nav.local-environments")}>
        <InfoCard
          body={t("settings.localEnvironments.unavailable.body")}
          title={t("settings.localEnvironments.unavailable.title")}
        />
      </PageFrame>
    );
  }

  if (isWorkspaceRootsLoading) {
    return (
      <PageFrame
        subtitle={t("settings.localEnvironments.workspaceSelect.description")}
        title={t("settings.nav.local-environments")}
      >
        <InfoCard
          body={t("settings.localEnvironments.loading.body")}
          title={t("settings.localEnvironments.loading.title")}
        />
      </PageFrame>
    );
  }

  if (isSelectProjectMode) {
    return (
      <PageFrame
        subtitle={renderLearnMoreDescription(t("settings.localEnvironments.workspaceSelect.description"))}
        title={t("settings.nav.local-environments")}
      >
        <WorkspaceSelectionCard
          activeWorkspaceRoots={activeWorkspaceRoots}
          environmentEntries={environmentEntries}
          hostId={selectedHostId}
          isAddProjectEnabled={canAddProjectLocally}
          isLoading={isWorkspaceRootsLoading}
          onAddProject={() => void handleAddProject()}
          onCreateEnvironment={createWorkspaceEnvironment}
          onSelectEnvironment={selectWorkspaceEnvironment}
          selectedWorkspaceRoot={selectedWorkspaceRoot}
          t={t}
          workspaceRootLabels={workspaceRootLabels}
          workspaceRoots={workspaceRoots}
        />
        {workspaceRootsErrorMessage ? <InlineError message={workspaceRootsErrorMessage} /> : null}
      </PageFrame>
    );
  }

  if (isListLoading || isDetailsLoading || !selectedWorkspacePath || !normalizedSelectedWorkspaceRoot) {
    return (
      <PageFrame
        breadcrumb={
          <Breadcrumbs
            mode={isEditMode ? "edit" : "preview"}
            onBack={isEditMode ? closeEditor : openWorkspaceSelection}
            workspaceLabel={selectedWorkspaceLabel}
            workspaceRoot={selectedWorkspaceRoot}
          />
        }
        title={t("settings.nav.local-environments")}
      >
        <InfoCard
          body={t("settings.localEnvironments.loading.body")}
          title={t("settings.localEnvironments.loading.title")}
        />
      </PageFrame>
    );
  }

  if (!configSnapshot) {
    return (
      <PageFrame
        breadcrumb={
          <Breadcrumbs
            mode={isEditMode ? "edit" : "preview"}
            onBack={isEditMode ? closeEditor : openWorkspaceSelection}
            workspaceLabel={selectedWorkspaceLabel}
            workspaceRoot={selectedWorkspaceRoot}
          />
        }
        title={t("settings.nav.local-environments")}
      >
        <InfoCard
          body={t("settings.localEnvironments.unavailable.body")}
          title={t("settings.localEnvironments.unavailable.title")}
        />
      </PageFrame>
    );
  }

  const previewContent = isEditMode ? (
    editableEnvironment ? (
      <>
        <SectionCard title={t("settings.localEnvironments.editor.title")}>
          <ProjectCard isCodexWorktree={selectedWorkspaceIsCodexWorktree} workspaceRoot={normalizedSelectedWorkspaceRoot} />
          {parseErrorMessage ? <InlineError message={t("settings.localEnvironments.file.parseError", { error: parseErrorMessage })} /> : null}
          {readErrorMessage ? <InlineError message={t("settings.localEnvironments.file.readError", { error: readErrorMessage })} /> : null}
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="local-environment-name"
              className="text-sm font-medium text-token-text-primary"
            >
              {t("settings.localEnvironments.environment.name")}
            </label>
            <input
              id="local-environment-name"
              value={editableEnvironment.name}
              onChange={(event) =>
                setEditableEnvironment((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
            />
          </div>
        </SectionCard>

        <ScriptEditorCard
          activePlatform={setupPlatform}
          description={t("settings.localEnvironments.editor.setup.description")}
          isEnvVarsOpen={isSetupEnvVarsOpen}
          onPlatformChange={setSetupPlatform}
          onScriptChange={(platform, script) => updateScriptSection("setup", platform, script)}
          onToggleEnvVars={() => setIsSetupEnvVarsOpen((current) => !current)}
          placeholder={LOCAL_ENVIRONMENT_SETUP_PLACEHOLDER}
          script={getScriptForPlatform(editableEnvironment.setup, setupPlatform)}
          title={t("settings.localEnvironments.environment.setup")}
          toggleAriaLabel={t("settings.localEnvironments.environment.setup.platformSelector")}
          t={t}
        />

        <ScriptEditorCard
          activePlatform={cleanupPlatform}
          description={t("settings.localEnvironments.environment.cleanup.description")}
          isEnvVarsOpen={false}
          onPlatformChange={setCleanupPlatform}
          onScriptChange={(platform, script) => updateScriptSection("cleanup", platform, script)}
          placeholder={LOCAL_ENVIRONMENT_CLEANUP_PLACEHOLDER}
          script={getScriptForPlatform(editableEnvironment.cleanup, cleanupPlatform)}
          title={t("settings.localEnvironments.environment.cleanup.title")}
          toggleAriaLabel={t("settings.localEnvironments.environment.cleanup.platformSelector")}
          t={t}
        />

        <SectionCard
          actions={
            <button
              type="button"
              onClick={addAction}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t("settings.localEnvironments.actions.add")}
            </button>
          }
          title={t("settings.localEnvironments.actions.title")}
        >
          <div className="app-text-muted text-[13px] leading-6">
            {t("settings.localEnvironments.environment.actions.description")}
          </div>
          {editableEnvironment.actions.length === 0 ? (
            <SurfaceCard>
              <div className="text-sm text-token-text-secondary">
                {t("settings.localEnvironments.actions.empty")}
              </div>
            </SurfaceCard>
          ) : (
            <div className="mt-4 space-y-4">
              {editableEnvironment.actions.map((action) => (
                <ActionEditorCard
                  key={action.id}
                  action={action}
                  onChange={updateAction}
                  onDelete={removeAction}
                  t={t}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {saveErrorMessage ? <InlineError message={saveErrorMessage} /> : null}

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={saveDisabledReason !== null}
            onClick={() => void saveEditor()}
            title={saveDisabledReason ?? undefined}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("settings.localEnvironments.preview.save")}
          </button>
          {saveDisabledReason ? (
            <div className="app-text-muted text-[12px] leading-5">{saveDisabledReason}</div>
          ) : null}
        </div>
      </>
    ) : (
      <InfoCard
        body={t("settings.localEnvironments.unavailable.body")}
        title={t("settings.localEnvironments.unavailable.title")}
      />
    )
  ) : (
    <>
      <SectionCard title={t("settings.localEnvironments.environment.title")}>
        <ProjectCard isCodexWorktree={selectedWorkspaceIsCodexWorktree} workspaceRoot={normalizedSelectedWorkspaceRoot} />
        {parseErrorMessage ? <InlineError message={t("settings.localEnvironments.file.parseError", { error: parseErrorMessage })} /> : null}
        {readErrorMessage ? <InlineError message={t("settings.localEnvironments.file.readError", { error: readErrorMessage })} /> : null}
        <div className="mt-5 space-y-5">
          {configSnapshot.exists ? (
            <>
              <PreviewSection
                description={t("settings.localEnvironments.environment.setup.description")}
                platformOverridesDescription={t(
                  "settings.localEnvironments.environment.setup.platformOverrides.description",
                )}
                platformOverridesTitle={t("settings.localEnvironments.environment.setup.platformOverrides")}
                scriptSection={previewEnvironment?.setup ?? createDefaultLocalEnvironmentDocument(normalizedSelectedWorkspaceRoot).setup}
                title={t("settings.localEnvironments.environment.setup")}
                t={t}
              />
              <PreviewSection
                description={t("settings.localEnvironments.environment.cleanup.summaryDescription")}
                emptyMessage={t("settings.localEnvironments.environment.cleanup.empty")}
                platformOverridesDescription={t(
                  "settings.localEnvironments.environment.cleanup.platformOverrides.description",
                )}
                platformOverridesTitle={t("settings.localEnvironments.environment.cleanup.platformOverrides")}
                scriptSection={previewEnvironment?.cleanup ?? createDefaultLocalEnvironmentDocument(normalizedSelectedWorkspaceRoot).cleanup}
                title={t("settings.localEnvironments.environment.cleanup.summaryTitle")}
                t={t}
              />
              <ActionsPreview actions={previewEnvironment?.actions ?? []} t={t} />
            </>
          ) : (
            <SurfaceCard>
              <div className="text-sm text-token-text-secondary">
                {t("settings.localEnvironments.environment.empty")}
              </div>
            </SurfaceCard>
          )}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openEditor}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {configSnapshot.exists
            ? t("settings.localEnvironments.environment.edit")
            : t("settings.localEnvironments.environment.create")}
        </button>
      </div>
    </>
  );

  return (
    <PageFrame
      breadcrumb={
        <Breadcrumbs
          mode={isEditMode ? "edit" : "preview"}
          onBack={isEditMode ? closeEditor : openWorkspaceSelection}
          workspaceLabel={selectedWorkspaceLabel}
          workspaceRoot={selectedWorkspaceRoot}
        />
      }
      title={t("settings.nav.local-environments")}
    >
      {previewContent}
    </PageFrame>
  );
}

function PageFrame({
  breadcrumb = null,
  children,
  subtitle,
  title,
}: {
  breadcrumb?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  title: string;
}) {
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="flex flex-col gap-2">
        <div className="text-[18px] font-medium text-token-text-primary">{title}</div>
        {subtitle ? <div className="text-sm leading-6 text-token-text-secondary">{subtitle}</div> : null}
      </div>
      {breadcrumb}
      {children}
    </div>
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
  activeWorkspaceRoots,
  environmentEntries: _environmentEntries,
  hostId,
  isAddProjectEnabled,
  isLoading,
  onAddProject,
  onCreateEnvironment,
  onSelectEnvironment,
  selectedWorkspaceRoot,
  t,
  workspaceRootLabels,
  workspaceRoots,
}: {
  activeWorkspaceRoots: string[];
  environmentEntries: LocalEnvironmentConfigEntry[];
  hostId: string;
  isAddProjectEnabled: boolean;
  isLoading: boolean;
  onAddProject: () => void;
  onCreateEnvironment: (workspaceRoot: string, entries: LocalEnvironmentConfigEntry[]) => void;
  onSelectEnvironment: (workspaceRoot: string, configPath: string) => void;
  selectedWorkspaceRoot: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workspaceRootLabels: Record<string, string>;
  workspaceRoots: string[];
}) {
  if (isLoading) {
    return (
      <SectionCard title={t("settings.localEnvironments.workspaceSelect.title")}>
        <SurfaceCard>
          <div className="text-sm text-token-text-secondary">
            {t("settings.localEnvironments.workspaceSelect.loading")}
          </div>
        </SurfaceCard>
      </SectionCard>
    );
  }

  if (workspaceRoots.length === 0) {
    return (
      <SectionCard title={t("settings.localEnvironments.workspaceSelect.title")}>
        <SurfaceCard>
          <div className="flex flex-col gap-3">
            <div className="text-sm text-token-text-secondary">
              {t("settings.localEnvironments.workspaceSelect.empty")}
            </div>
            {isAddProjectEnabled ? (
              <div>
                <button
                  type="button"
                  onClick={onAddProject}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("settings.localEnvironments.workspace.add")}
                </button>
              </div>
            ) : null}
          </div>
        </SurfaceCard>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={t("settings.localEnvironments.workspaceSelect.title")}
      actions={
        isAddProjectEnabled ? (
          <button
            type="button"
            onClick={onAddProject}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.localEnvironments.workspace.add")}
          </button>
        ) : null
      }
    >
      <div className="space-y-3" aria-label={t("settings.localEnvironments.workspaceSelect.listLabel")}>
        {workspaceRoots.map((workspaceRoot) => (
          <WorkspaceSelectionProjectCard
            key={workspaceRoot}
            hostId={hostId}
            isActive={selectedWorkspaceRoot === workspaceRoot}
            isCodexWorktree={false}
            isInitiallyExpanded={activeWorkspaceRoots.includes(workspaceRoot)}
            label={getWorkspaceRootLabel(workspaceRoot, workspaceRootLabels)}
            onCreateEnvironment={onCreateEnvironment}
            onSelectEnvironment={onSelectEnvironment}
            t={t}
            workspaceRoot={workspaceRoot}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function WorkspaceSelectionProjectCard({
  hostId,
  isActive,
  isCodexWorktree,
  isInitiallyExpanded,
  label,
  onCreateEnvironment,
  onSelectEnvironment,
  t,
  workspaceRoot,
}: {
  hostId: string;
  isActive: boolean;
  isCodexWorktree: boolean;
  isInitiallyExpanded: boolean;
  label: string;
  onCreateEnvironment: (workspaceRoot: string, entries: LocalEnvironmentConfigEntry[]) => void;
  onSelectEnvironment: (workspaceRoot: string, configPath: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workspaceRoot: string;
}) {
  const [entries, setEntries] = useState<LocalEnvironmentConfigEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const ProjectIcon = isCodexWorktree ? WorktreeIcon : FolderIcon;

  return (
    <div className={["rounded-[16px] border border-[var(--app-shell-border)]", isActive ? "app-card" : "bg-[var(--app-shell-card)]"].join(" ")}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (preferredProjectEntry) {
              onSelectEnvironment(workspaceRoot, preferredProjectEntry.configPath);
              return;
            }
            setIsExpanded((current) => !current);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ProjectIcon className="icon-sm shrink-0 text-token-text-secondary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-token-text-primary">{label}</div>
            <div className="truncate text-xs text-token-text-secondary">{workspaceRoot}</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onCreateEnvironment(workspaceRoot, entries)}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          aria-label={t("settings.localEnvironments.workspaceSelect.addLabel")}
        >
          {t("settings.localEnvironments.workspaceSelect.addLabel")}
        </button>
      </div>

      {isLoading ? (
        <div className="border-t border-[var(--app-shell-border)] px-4 py-3 text-sm text-token-text-secondary">
          {t("settings.localEnvironments.workspaceSelect.loadingLabel")}
        </div>
      ) : errorMessage ? (
        <div className="border-t border-[var(--app-shell-border)] px-4 py-3 text-sm text-token-error-foreground">
          {t("settings.localEnvironments.workspaceSelect.errorLabel")}
        </div>
      ) : hasEntries ? (
        <div className="border-t border-[var(--app-shell-border)]">
          <div className="divide-y divide-[var(--app-shell-border)]">
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
            <div className="border-t border-[var(--app-shell-border)]">
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-token-text-secondary"
              >
                <span>
                  {t("settings.localEnvironments.workspaceSelect.inherited", {
                    count: inheritedEntries.length,
                  })}
                </span>
                <ChevronRightIcon
                  className={[
                    "icon-xs shrink-0 text-token-text-secondary transition-transform",
                    isExpanded ? "rotate-90" : "",
                  ].join(" ")}
                />
              </button>
              {isExpanded ? (
                <div className="divide-y divide-[var(--app-shell-border)] border-t border-[var(--app-shell-border)]">
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
    </div>
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

function SectionCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px] font-medium">{title}</div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SurfaceCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] p-3">
      {children}
    </div>
  );
}

function ProjectCard({
  isCodexWorktree,
  workspaceRoot,
}: {
  isCodexWorktree: boolean;
  workspaceRoot: string;
}) {
  const ProjectIcon = isCodexWorktree ? WorktreeIcon : FolderIcon;
  const projectName = getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot;

  return (
    <SurfaceCard>
      <div className="flex items-center gap-3">
        <ProjectIcon className="icon-sm shrink-0 text-token-text-secondary" />
        <div className="min-w-0">
          <div className="truncate text-sm text-token-text-primary">{projectName}</div>
          <div className="truncate text-xs text-token-text-secondary">{workspaceRoot}</div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function PreviewSection({
  title,
  description,
  scriptSection,
  platformOverridesTitle,
  platformOverridesDescription,
  emptyMessage,
  t,
}: {
  title: string;
  description: string;
  scriptSection: LocalEnvironmentScriptSection;
  platformOverridesTitle: string;
  platformOverridesDescription: string;
  emptyMessage?: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const defaultScript = scriptSection.script.trim();
  const overrides = LOCAL_ENVIRONMENT_PLATFORMS.flatMap((platform) => {
    const script = scriptSection[platform]?.script ?? "";
    return script.trim().length > 0 ? [{ platform, script }] : [];
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-token-text-primary">{title}</div>
        <div className="text-sm text-token-text-secondary">{description}</div>
      </div>

      {defaultScript.length > 0 ? <CodeBlock script={defaultScript} /> : null}
      {defaultScript.length === 0 && overrides.length === 0 && emptyMessage ? (
        <SurfaceCard>
          <div className="text-sm text-token-text-secondary">{emptyMessage}</div>
        </SurfaceCard>
      ) : null}

      {overrides.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-token-text-primary">{platformOverridesTitle}</div>
            <div className="text-sm text-token-text-secondary">{platformOverridesDescription}</div>
          </div>
          <div className="space-y-3">
            {overrides.map((override) => (
              <div key={override.platform} className="flex flex-col gap-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
                  {formatPlatformLabel(override.platform, t)}
                </div>
                <CodeBlock script={override.script} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionsPreview({
  actions,
  t,
}: {
  actions: LocalEnvironmentAction[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-token-text-primary">
          {t("settings.localEnvironments.environment.actionsLabel")}
        </div>
        <div className="text-sm text-token-text-secondary">
          {t("settings.localEnvironments.environment.actions.description")}
        </div>
      </div>

      <SurfaceCard>
        <div className="flex flex-col gap-2">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <div
                key={`${action.name}-${index}`}
                className="flex items-center gap-2 text-sm text-token-text-secondary"
              >
                <span className="text-token-text-secondary">
                  <LocalEnvironmentActionIconGlyph icon={action.icon ?? "tool"} />
                </span>
                <span>{action.name}</span>
              </div>
            ))
          ) : (
            <div className="text-sm text-token-text-secondary">
              {t("settings.localEnvironments.actions.empty")}
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}

function ScriptEditorCard({
  activePlatform,
  description,
  isEnvVarsOpen,
  onPlatformChange,
  onScriptChange,
  onToggleEnvVars,
  placeholder,
  script,
  title,
  toggleAriaLabel,
  t,
}: {
  activePlatform: ScriptPlatformSelection;
  description: string;
  isEnvVarsOpen: boolean;
  onPlatformChange: (platform: ScriptPlatformSelection) => void;
  onScriptChange: (platform: ScriptPlatformSelection, script: string) => void;
  onToggleEnvVars?: (() => void) | undefined;
  placeholder: string;
  script: string;
  title: string;
  toggleAriaLabel: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <SectionCard title={title}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-token-text-secondary">{description}</div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2" aria-label={toggleAriaLabel}>
            {SCRIPT_PLATFORM_OPTIONS.map((platform) => {
              const isActive = platform === activePlatform;
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => onPlatformChange(platform)}
                  className={[
                    "rounded-[11px] px-3 py-1.5 text-[12px]",
                    isActive ? "app-nav-item-active" : "app-control",
                  ].join(" ")}
                >
                  {formatScriptPlatformLabel(platform, t)}
                </button>
              );
            })}
          </div>

          {onToggleEnvVars ? (
            <button
              type="button"
              onClick={onToggleEnvVars}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t("settings.localEnvironments.environment.setup.envVars.button")}
            </button>
          ) : null}
        </div>

        {isEnvVarsOpen ? (
          <SurfaceCard>
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium text-token-text-primary">
                {t("settings.localEnvironments.environment.setup.envVars.title")}
              </div>
              <EnvVarRow
                description={t("settings.localEnvironments.environment.setup.envVars.sourcePath.description")}
                variable="CODEX_SOURCE_PATH"
              />
              <EnvVarRow
                description={t("settings.localEnvironments.environment.setup.envVars.worktreePath.description")}
                variable="CODEX_WORKTREE_PATH"
              />
            </div>
          </SurfaceCard>
        ) : null}

        <textarea
          value={script}
          rows={6}
          placeholder={placeholder}
          onChange={(event) => onScriptChange(activePlatform, event.target.value)}
          className="app-control app-text-input min-h-[140px] w-full rounded-[12px] px-3 py-2 font-mono text-[13px] outline-none"
        />
      </div>
    </SectionCard>
  );
}

function ActionEditorCard({
  action,
  onChange,
  onDelete,
  t,
}: {
  action: EditableLocalEnvironmentAction;
  onChange: (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => void;
  onDelete: (actionId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const isPlatformSpecific = action.platform !== null;
  const selectedPlatform = action.platform ?? "darwin";

  return (
    <SurfaceCard>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
          <ActionIconMenu
            ariaLabel={t(getActionIconMessageKey(action.icon ?? "tool"))}
            onChange={(icon) => onChange(action.id, { icon })}
            t={t}
            value={action.icon ?? "tool"}
          />

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
              {t("settings.localEnvironments.actions.item.name")}
            </span>
            <input
              value={action.name}
              onChange={(event) => onChange(action.id, { name: event.target.value })}
              className="app-control app-text-input rounded-[12px] px-3 py-2 text-[13px] outline-none"
            />
          </label>

          <button
            type="button"
            title={t("settings.localEnvironments.actions.item.tooltip.delete")}
            aria-label={t("settings.localEnvironments.actions.item.tooltip.delete")}
            onClick={() => onDelete(action.id)}
            className="app-control flex h-[40px] w-[40px] items-center justify-center rounded-[11px]"
          >
            <TrashIcon className="icon-sm" />
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
            {t("settings.localEnvironments.actions.item.command")}
          </span>
          <textarea
            value={action.command}
            rows={4}
            placeholder={LOCAL_ENVIRONMENT_ACTION_PLACEHOLDER}
            onChange={(event) => onChange(action.id, { command: event.target.value })}
            className="app-control app-text-input min-h-[112px] rounded-[12px] px-3 py-2 font-mono text-[13px] outline-none"
          />
        </label>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
            {t("settings.localEnvironments.actions.item.platforms")}
          </div>
          <label className="flex items-center gap-3 text-sm text-token-text-primary">
            <input
              type="checkbox"
              checked={isPlatformSpecific}
              onChange={(event) =>
                onChange(action.id, {
                  platform: event.target.checked ? selectedPlatform : null,
                })
              }
              className="h-4 w-4 rounded border border-[var(--app-shell-border)]"
            />
            <span>{t("settings.localEnvironments.actions.item.platforms.specific")}</span>
          </label>
          <div className="text-sm text-token-text-secondary">
            {t("settings.localEnvironments.actions.item.platforms.help")}
          </div>

          {isPlatformSpecific ? (
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label={t("settings.localEnvironments.actions.item.platforms.selector")}
            >
              {LOCAL_ENVIRONMENT_PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => onChange(action.id, { platform })}
                  className={[
                    "rounded-[11px] px-3 py-1.5 text-[12px]",
                    platform === selectedPlatform ? "app-nav-item-active" : "app-control",
                  ].join(" ")}
                >
                  {formatPlatformLabel(platform, t)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
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
    <div className="rounded-[12px] border border-[var(--app-shell-border)] px-3 py-2">
      <div className="text-sm text-token-text-secondary">{description}</div>
      <code className="mt-2 block overflow-x-auto rounded-[10px] bg-[var(--app-shell-muted-surface)] px-2 py-1.5 text-xs">
        {variable}
      </code>
    </div>
  );
}

function CodeBlock({ script }: { script: string }) {
  return (
    <SurfaceCard>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-6 text-token-text-primary">
        {script}
      </pre>
    </SurfaceCard>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="text-[14px] font-medium">{title}</div>
      <div className="app-text-muted mt-1 text-[13px] leading-6">{body}</div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="mt-3 text-sm text-token-error-foreground">{message}</div>;
}

function UnavailableState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <InfoCard title={title} body={body} />
    </div>
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

function renderLearnMoreDescription(description: string) {
  const marker = "Learn more.";
  const markerIndex = description.indexOf(marker);
  if (markerIndex === -1) {
    return description;
  }

  const prefix = description.slice(0, markerIndex);
  const suffix = description.slice(markerIndex + marker.length);
  return (
    <>
      {prefix}
      <a
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
        href={LOCAL_ENVIRONMENT_LEARN_MORE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {marker}
      </a>
      {suffix}
    </>
  );
}

function normalizeComparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
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

function formatScriptPlatformLabel(
  platform: ScriptPlatformSelection,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (platform === "default") {
    return t("settings.localEnvironments.environment.script.default");
  }
  return formatPlatformLabel(platform, t);
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

function WorktreeIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.8 11.535c.367 0 .665.298.665.665v5a.665.665 0 0 1-.665.665h-5a.665.665 0 1 1 0-1.33h3.394l-3.565-3.564a.666.666 0 0 1 .942-.942l3.564 3.565V12.2c0-.367.298-.665.665-.665Zm0-9.4c.367 0 .665.298.665.665v5a.665.665 0 0 1-1.33 0V4.405l-5.128 5.128c-.323.324-.558.565-.842.74a2.668 2.668 0 0 1-.771.319c-.324.078-.662.073-1.12.073H1.93a.665.665 0 1 1 0-1.33h5.345c.52 0 .673-.005.809-.037.136-.033.266-.086.385-.16.12-.072.23-.177.598-.545l5.128-5.128H10.8a.665.665 0 0 1 0-1.33h5Z" />
    </svg>
  );
}
