import { useEffect, useMemo, useRef, useState } from "react";
import { getCodexHomePath } from "../../services/codexHome";
import { readGitOrigins } from "../../services/gitOrigins";
import type { ThreadHistoryEntry } from "../../services/history";
import { readPendingWorktreesSnapshot, onPendingWorktreesUpdated } from "../../services/pendingWorktrees";
import { getGlobalState, onGlobalStateUpdated, setGlobalState } from "../../services/settings";
import {
  LOCAL_SETTINGS_HOST_ID,
  onRemoteAppServerConnectionStateChanged,
  onSharedObjectUpdated,
  readConnectedSettingsRemoteConnections,
  readSettingsRemoteConnectionsSnapshot,
  readSettingsRemoteProjectsSnapshot,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
  type RemoteConnection,
  type RemoteProject,
} from "../../services/settingsHosts";
import {
  onOnboardingSkipWorkspaceResult,
  onWorkspaceRootOptionPicked,
  onWorkspaceRootOptionsUpdated,
  pickWorkspaceRootOption,
  readExistingPaths,
  readWorkspaceRootOptions,
  setActiveWorkspaceRoot,
  skipWorkspaceOnboarding,
  updateWorkspaceRootOptions,
} from "../../services/workspaceRoots";
import { useI18n } from "../../i18n/i18n";
import {
  buildWorkspaceRootOptions,
  countSelectedRoots,
  deriveCandidateWorkspaceRoots,
  deriveSelectWorkspacePageState,
  deriveWorkspaceAutoLaunchAction,
  filterWorkspaceRecentThreads,
  mergeWorkspaceRootSelectionsForPersistence,
  normalizeWorkspaceOnboardingExperimentAssignment,
  readWorkspaceOnboardingExperimentArm,
  readWorkspaceOnboardingSkipProjectName,
  shouldUsePlaygroundCopy,
  stripWorkspaceRootExtendedPrefix,
} from "./selectWorkspaceModel";
import { SelectWorkspacePageView } from "./SelectWorkspacePageView";
import { useReplicaStatsigGateValue } from "../statsig/replicaStatsig";
import { RemoteProjectSetupDialog } from "../localEnvironments/RemoteProjectSetupDialog";

type SelectWorkspacePageProps = {
  currentWindowHostId: string;
  onContinueToHome: (state: { focusComposerNonce: number; hostId: string }) => void;
  recentThreads: ThreadHistoryEntry[];
};

export function SelectWorkspacePage({
  currentWindowHostId,
  onContinueToHome,
  recentThreads,
}: SelectWorkspacePageProps) {
  const { t } = useI18n();
  const backgroundSubagentsEnabled = useReplicaStatsigGateValue("1221508807");
  const [activeRemoteProjectId, setActiveRemoteProjectId] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([]);
  const [connectedRemoteConnections, setConnectedRemoteConnections] = useState<RemoteConnection[]>([]);
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [workspaceRootLabels, setWorkspaceRootLabels] = useState<Record<string, string>>({});
  const [pendingWorktrees, setPendingWorktrees] = useState<Awaited<ReturnType<typeof readPendingWorktreesSnapshot>>>([]);
  const [gitOrigins, setGitOrigins] = useState<Awaited<ReturnType<typeof readGitOrigins>>["origins"]>([]);
  const [codexHome, setCodexHome] = useState<string | null>(null);
  const [existingPaths, setExistingPaths] = useState<string[]>([]);
  const [pickedRoots, setPickedRoots] = useState<string[]>([]);
  const [selectedRoots, setSelectedRoots] = useState<Record<string, boolean>>({});
  const [skipErrorMessage, setSkipErrorMessage] = useState<string | null>(null);
  const [isRemotePathDialogOpen, setIsRemotePathDialogOpen] = useState(false);
  const [isRemotePathSaving, setIsRemotePathSaving] = useState(false);
  const [isSkipPending, setIsSkipPending] = useState(false);
  const [isLoadingWorkspaceRoots, setIsLoadingWorkspaceRoots] = useState(true);
  const [isLoadingPendingWorktrees, setIsLoadingPendingWorktrees] = useState(true);
  const [isLoadingGitOrigins, setIsLoadingGitOrigins] = useState(false);
  const [isLoadingCodexHome, setIsLoadingCodexHome] = useState(true);
  const [isLoadingExistingPaths, setIsLoadingExistingPaths] = useState(false);
  const [workspaceOnboardingOverride, setWorkspaceOnboardingOverride] = useState("auto");
  const [workspaceOnboardingExperimentAssignment, setWorkspaceOnboardingExperimentAssignment] = useState(
    normalizeWorkspaceOnboardingExperimentAssignment(null),
  );
  const [workspaceOnboardingAutoLaunchApplied, setWorkspaceOnboardingAutoLaunchApplied] = useState(false);
  const continueNonceRef = useRef(0);
  const hasAutoContinuedRef = useRef(false);
  const hasAutoSkippedRef = useRef(false);

  const workspaceOnboardingExperimentArm = readWorkspaceOnboardingExperimentArm(
    workspaceOnboardingExperimentAssignment,
  );
  const usePlaygroundCopy = shouldUsePlaygroundCopy(workspaceOnboardingExperimentArm);
  const currentRemoteProject = useMemo(() => {
    if (activeRemoteProjectId === null) {
      return null;
    }

    return remoteProjects.find((project) => project.id === activeRemoteProjectId) ?? null;
  }, [activeRemoteProjectId, remoteProjects]);
  const currentHostId = normalizeOptionalString(currentWindowHostId) ?? LOCAL_SETTINGS_HOST_ID;
  const isRemoteHost = currentHostId !== LOCAL_SETTINGS_HOST_ID;
  const visibleRecentThreads = useMemo(() => {
    return filterWorkspaceRecentThreads(
      recentThreads.filter((thread) => (thread.hostId ?? LOCAL_SETTINGS_HOST_ID) === currentHostId),
      backgroundSubagentsEnabled,
    );
  }, [backgroundSubagentsEnabled, currentHostId, recentThreads]);

  const inferredRoots = useMemo(() => {
    return deriveCandidateWorkspaceRoots({
      codexHome,
      gitOrigins,
      pendingWorktrees,
      recentThreads: visibleRecentThreads,
    });
  }, [codexHome, gitOrigins, pendingWorktrees, visibleRecentThreads]);

  const candidateRoots = useMemo(() => {
    return dedupeWorkspaceRoots([...workspaceRoots, ...inferredRoots, ...pickedRoots]);
  }, [inferredRoots, pickedRoots, workspaceRoots]);

  const workspaceRootOptions = useMemo(() => {
    return buildWorkspaceRootOptions(candidateRoots, workspaceRootLabels);
  }, [candidateRoots, workspaceRootLabels]);

  const selectedRootList = useMemo(() => {
    return workspaceRootOptions
      .map((option) => option.root)
      .filter((root) => selectedRoots[root] === true);
  }, [selectedRoots, workspaceRootOptions]);

  const totalWorkspaceCount = workspaceRootOptions.length;
  const selectedWorkspaceCount = countSelectedRoots(
    selectedRoots,
    workspaceRootOptions.map((option) => option.root),
  );
  const isSelectAllChecked = totalWorkspaceCount > 0 && selectedWorkspaceCount === totalWorkspaceCount;
  const isLoading =
    isLoadingWorkspaceRoots ||
    isLoadingPendingWorktrees ||
    isLoadingGitOrigins ||
    isLoadingCodexHome ||
    isLoadingExistingPaths;
  const { hasAvailableRoots, hasPersistedOrDerivedRoots, isEmptyState } = useMemo(() => {
    return deriveSelectWorkspacePageState({
      candidateRoots,
      inferredRoots,
      isLoading,
      workspaceRootOptions,
      workspaceRoots,
    });
  }, [candidateRoots, inferredRoots, isLoading, workspaceRootOptions, workspaceRoots]);
  const autoLaunchAction = deriveWorkspaceAutoLaunchAction({
    arm: workspaceOnboardingExperimentArm,
    autoLaunchApplied: workspaceOnboardingAutoLaunchApplied,
    hasPersistedRoots: workspaceRoots.length > 0,
    isLoadingRoots: isLoadingWorkspaceRoots,
    isRemoteHost,
  });

  useEffect(() => {
    let disposed = false;
    let cleanupGlobalStateUpdated: (() => void) | undefined;
    let cleanupSharedObjectUpdated: (() => void) | undefined;
    let cleanupConnectionStates: (() => void) | undefined;

    const loadRemoteConnections = async () => {
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

    const loadRemoteProjectState = async () => {
      try {
        const [activeRemoteProjectResponse, remoteProjectsResponse] = await Promise.all([
          getGlobalState("active-remote-project-id"),
          readSettingsRemoteProjectsSnapshot(),
        ]);
        if (disposed) {
          return;
        }

        setActiveRemoteProjectId(normalizeOptionalGlobalStateString(activeRemoteProjectResponse.value));
        setRemoteProjects(remoteProjectsResponse);
      } catch {
        if (!disposed) {
          setActiveRemoteProjectId(null);
          setRemoteProjects([]);
        }
      }
    };

    void loadRemoteProjectState();
    void loadRemoteConnections();

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("active-remote-project-id")) {
        return;
      }

      void getGlobalState("active-remote-project-id")
        .then((response) => {
          if (!disposed) {
            setActiveRemoteProjectId(normalizeOptionalGlobalStateString(response.value));
          }
        })
        .catch(() => {
          if (!disposed) {
            setActiveRemoteProjectId(null);
          }
        });
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupGlobalStateUpdated = cleanup;
    });

    void onSharedObjectUpdated((notification) => {
      if (notification.key === REMOTE_CONNECTIONS_SHARED_OBJECT_KEY) {
        void loadRemoteConnections();
      }
      if (notification.key !== REMOTE_PROJECTS_SHARED_OBJECT_KEY) {
        return;
      }

      void readSettingsRemoteProjectsSnapshot()
        .then((projects) => {
          if (!disposed) {
            setRemoteProjects(projects);
          }
        })
        .catch(() => {
          if (!disposed) {
            setRemoteProjects([]);
          }
        });
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupSharedObjectUpdated = cleanup;
    });

    void onRemoteAppServerConnectionStateChanged(() => {
      void loadRemoteConnections();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupConnectionStates = cleanup;
    });

    return () => {
      disposed = true;
      cleanupGlobalStateUpdated?.();
      cleanupSharedObjectUpdated?.();
      cleanupConnectionStates?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceState = async () => {
      setIsLoadingWorkspaceRoots(true);
      try {
        if (isRemoteHost) {
          if (cancelled) {
            return;
          }
          setWorkspaceRoots(
            remoteProjects
              .filter((project) => project.hostId === currentHostId)
              .map((project) => project.remotePath),
          );
          setWorkspaceRootLabels(
            Object.fromEntries(
              remoteProjects
                .filter((project) => project.hostId === currentHostId)
                .map((project) => [project.remotePath, project.label] as const),
            ),
          );
          return;
        }

        const response = await readWorkspaceRootOptions(currentHostId);
        if (cancelled) {
          return;
        }
        setWorkspaceRoots(response.roots);
        setWorkspaceRootLabels(response.labels);
      } catch {
        if (!cancelled) {
          setWorkspaceRoots([]);
          setWorkspaceRootLabels({});
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkspaceRoots(false);
        }
      }
    };

    void loadWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [currentHostId, isRemoteHost, remoteProjects]);

  useEffect(() => {
    let disposed = false;
    let cleanupOptions: (() => void) | undefined;
    let cleanupPicked: (() => void) | undefined;
    let cleanupSkipResult: (() => void) | undefined;

    const reloadWorkspaceState = async () => {
      setIsLoadingWorkspaceRoots(true);
      try {
        if (isRemoteHost) {
          if (disposed) {
            return;
          }
          setWorkspaceRoots(
            remoteProjects
              .filter((project) => project.hostId === currentHostId)
              .map((project) => project.remotePath),
          );
          setWorkspaceRootLabels(
            Object.fromEntries(
              remoteProjects
                .filter((project) => project.hostId === currentHostId)
                .map((project) => [project.remotePath, project.label] as const),
            ),
          );
          return;
        }

        const response = await readWorkspaceRootOptions(currentHostId);
        if (disposed) {
          return;
        }
        setWorkspaceRoots(response.roots);
        setWorkspaceRootLabels(response.labels);
      } catch {
        if (!disposed) {
          setWorkspaceRoots([]);
          setWorkspaceRootLabels({});
        }
      } finally {
        if (!disposed) {
          setIsLoadingWorkspaceRoots(false);
        }
      }
    };

    void onWorkspaceRootOptionsUpdated(() => {
      void reloadWorkspaceState();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupOptions = cleanup;
    });

    void onWorkspaceRootOptionPicked((notification) => {
      setSkipErrorMessage(null);
      setPickedRoots((current) => dedupeWorkspaceRoots([...current, notification.root]));
      setSelectedRoots((current) => ({
        ...current,
        [notification.root]: true,
      }));
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupPicked = cleanup;
    });

    void onOnboardingSkipWorkspaceResult((notification) => {
      setIsSkipPending(false);
      if (!notification.success) {
        setSkipErrorMessage(
          normalizeOptionalString(notification.error) ??
            t("electron.onboarding.workspace.skip.error.unknown"),
        );
        return;
      }

      setSkipErrorMessage(null);
      const completedAt = Math.floor(Date.now() / 1000);
      void Promise.all([
        setGlobalState("last_completed_onboarding", completedAt),
        setGlobalState("electron:onboarding-override", "auto"),
      ]).catch(() => undefined);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      cleanupSkipResult = cleanup;
    });

    return () => {
      disposed = true;
      cleanupOptions?.();
      cleanupPicked?.();
      cleanupSkipResult?.();
    };
  }, [currentHostId, isRemoteHost, remoteProjects, t]);

  useEffect(() => {
    let cancelled = false;

    void readPendingWorktreesSnapshot()
      .then((entries) => {
        if (!cancelled) {
          setPendingWorktrees(entries.filter((entry) => entry.hostId === currentHostId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingWorktrees([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPendingWorktrees(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentHostId]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void onPendingWorktreesUpdated((entries) => {
      setPendingWorktrees(entries.filter((entry) => entry.hostId === currentHostId));
    }).then((release) => {
      if (disposed) {
        release();
        return;
      }
      cleanup = release;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [currentHostId]);

  useEffect(() => {
    let cancelled = false;

    void getCodexHomePath()
      .then((value) => {
        if (!cancelled) {
          setCodexHome(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCodexHome(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCodexHome(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const dirs = dedupeWorkspaceRoots([
      ...visibleRecentThreads.map((thread) => thread.cwd).filter((cwd) => cwd.trim().length > 0),
      ...pendingWorktrees
        .map((entry) => {
          const cwd = entry.startConversationParamsInput?.cwd;
          return typeof cwd === "string" ? cwd.trim() : entry.sourceWorkspaceRoot;
        })
        .filter((cwd) => cwd.trim().length > 0),
    ]);

    if (dirs.length === 0) {
      setGitOrigins([]);
      setIsLoadingGitOrigins(false);
      return;
    }

    setIsLoadingGitOrigins(true);
    void readGitOrigins({ dirs, hostId: currentHostId })
      .then((response) => {
        if (!cancelled) {
          setGitOrigins(response.origins);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGitOrigins([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingGitOrigins(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentHostId, pendingWorktrees, visibleRecentThreads]);

  useEffect(() => {
    let cancelled = false;

    if (candidateRoots.length === 0) {
      setExistingPaths([]);
      setIsLoadingExistingPaths(false);
      return;
    }

    setIsLoadingExistingPaths(true);
    if (isRemoteHost) {
      setExistingPaths(candidateRoots);
      setIsLoadingExistingPaths(false);
      return;
    }

    void readExistingPaths(candidateRoots, currentHostId)
      .then((response) => {
        if (!cancelled) {
          setExistingPaths(response.existingPaths);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExistingPaths(candidateRoots);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingExistingPaths(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [candidateRoots, currentHostId, isRemoteHost]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getGlobalState("electron:onboarding-override"),
      getGlobalState("electron:onboarding-workspace-experiment-assignment"),
      getGlobalState("electron:onboarding-workspace-autolaunch-applied"),
    ])
      .then(([onboardingOverrideResponse, assignmentResponse, autoLaunchAppliedResponse]) => {
        if (cancelled) {
          return;
        }
        setWorkspaceOnboardingOverride(
          typeof onboardingOverrideResponse.value === "string"
            ? onboardingOverrideResponse.value
            : "auto",
        );
        setWorkspaceOnboardingExperimentAssignment(
          normalizeWorkspaceOnboardingExperimentAssignment(assignmentResponse.value),
        );
        setWorkspaceOnboardingAutoLaunchApplied(autoLaunchAppliedResponse.value === true);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceOnboardingOverride("auto");
          setWorkspaceOnboardingExperimentAssignment(
            normalizeWorkspaceOnboardingExperimentAssignment(null),
          );
          setWorkspaceOnboardingAutoLaunchApplied(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      hasAutoSkippedRef.current ||
      isLoading ||
      autoLaunchAction !== "select_workspace_skip_to_playground"
    ) {
      return;
    }

    hasAutoSkippedRef.current = true;
    setWorkspaceOnboardingAutoLaunchApplied(true);
    void setGlobalState("electron:onboarding-workspace-autolaunch-applied", true).catch(() => undefined);
    void handleSkipWorkspace();
  }, [autoLaunchAction, isLoading]);

  useEffect(() => {
    if (
      hasAutoContinuedRef.current ||
      hasPersistedOrDerivedRoots ||
      isLoading ||
      selectedRootList.length === 0
    ) {
      return;
    }

    hasAutoContinuedRef.current = true;
    void handleContinue();
  }, [hasPersistedOrDerivedRoots, isLoading, selectedRootList]);

  return (
    <>
      <SelectWorkspacePageView
        hasAvailableRoots={hasAvailableRoots}
        isEmptyState={isEmptyState}
        isLoadingRoots={isLoading}
        isRemoteHost={isRemoteHost}
        isSelectAllChecked={isSelectAllChecked}
        isSkipPending={isSkipPending}
        hasSelectedRoots={selectedRootList.length > 0}
        selectedRoots={selectedRootList}
        showPlaygroundCopy={usePlaygroundCopy}
        skipErrorMessage={skipErrorMessage}
        existingPaths={existingPaths}
        isLoadingExistingPaths={isLoadingExistingPaths}
        workspaceRootOptions={workspaceRootOptions}
        onContinue={() => {
          void handleContinue();
        }}
        onOpenFolder={() => {
          void handleOpenFolder();
        }}
        onSkip={() => {
          void handleSkipWorkspace();
        }}
        onStartFromScratch={() => {
          void handleSkipWorkspace();
        }}
        onToggleSelectAll={(checked) => {
          setSkipErrorMessage(null);
          setSelectedRoots((current) => {
            const next = { ...current };
            for (const option of workspaceRootOptions) {
              next[option.root] = checked;
            }
            return next;
          });
        }}
        onToggleWorkspace={(root, checked) => {
          setSkipErrorMessage(null);
          setPickedRoots((current) => dedupeWorkspaceRoots([...current, root]));
          setSelectedRoots((current) => ({
            ...current,
            [root]: checked,
          }));
        }}
      />
      {isRemotePathDialogOpen ? (
        <RemoteProjectSetupDialog
          connectedRemoteConnections={connectedRemoteConnections}
          initialDirectoryPath={null}
          initialHostId={currentHostId}
          isSaving={isRemotePathSaving}
          mode="pick"
          remoteProjects={remoteProjects}
          onClose={() => {
            if (!isRemotePathSaving) {
              setIsRemotePathDialogOpen(false);
            }
          }}
          onSave={async (params) => {
            setIsRemotePathSaving(true);
            try {
              setSkipErrorMessage(null);
              setPickedRoots((current) => dedupeWorkspaceRoots([...current, params.remotePath]));
              setSelectedRoots((current) => ({
                ...current,
                [params.remotePath]: true,
              }));
              setIsRemotePathDialogOpen(false);
            } finally {
              setIsRemotePathSaving(false);
            }
          }}
        />
      ) : null}
    </>
  );

  async function handleOpenFolder() {
    setSkipErrorMessage(null);
    if (isRemoteHost) {
      setIsRemotePathDialogOpen(true);
      return;
    }
    await pickWorkspaceRootOption();
  }

  async function handleSkipWorkspace() {
    if (isSkipPending) {
      return;
    }

    setSkipErrorMessage(null);
    setIsSkipPending(true);
    try {
      await skipWorkspaceOnboarding(
        readWorkspaceOnboardingSkipProjectName(workspaceOnboardingExperimentArm),
      );
    } catch (error) {
      setIsSkipPending(false);
      setSkipErrorMessage(getErrorMessage(error, t("electron.onboarding.workspace.skip.error.unknown")));
    }
  }

  async function handleContinue() {
    if (selectedRootList.length === 0) {
      return;
    }

    setSkipErrorMessage(null);
    const nextWorkspaceRoots = mergeWorkspaceRootSelectionsForPersistence({
      onboardingOverride: workspaceOnboardingOverride,
      persistedRoots: workspaceRoots,
      selectedRoots: selectedRootList,
    });
    const completedAt = Math.floor(Date.now() / 1000);

    await setGlobalState("last_completed_onboarding", completedAt);
    if (!isRemoteHost) {
      await updateWorkspaceRootOptions(nextWorkspaceRoots);
    }
    await setGlobalState("electron:onboarding-override", "auto");
    await setGlobalState("active-remote-project-id", null);
    if (!isRemoteHost) {
      await setActiveWorkspaceRoot(selectedRootList[0]);
    }

    continueNonceRef.current += 1;
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", "/");
    }
    onContinueToHome({
      focusComposerNonce: continueNonceRef.current,
      hostId: currentHostId,
    });
  }
}

function dedupeWorkspaceRoots(roots: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const root of roots) {
    const normalizedRoot = normalizeOptionalString(root);
    if (normalizedRoot === null) {
      continue;
    }

    const comparisonKey = stripWorkspaceRootExtendedPrefix(normalizedRoot)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
    if (seen.has(comparisonKey)) {
      continue;
    }
    seen.add(comparisonKey);
    deduped.push(normalizedRoot);
  }

  return deduped.sort((left, right) => left.localeCompare(right));
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return fallbackMessage;
}

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalGlobalStateString(value: unknown) {
  return typeof value === "string" ? normalizeOptionalString(value) : null;
}
