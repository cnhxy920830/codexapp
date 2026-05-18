import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  SettingsCogIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { SettingsChoiceMenu } from "../../components/SettingsChoiceMenu";
import { useI18n } from "../../i18n/i18n";
import { ThreadComposer } from "../chat/ThreadComposer";
import {
  buildTurnStartPermissionOverrides,
  resolveHotkeyPermissionsState,
  type HotkeyPermissionAgentMode,
} from "./hotkeyPermissionsMode";
import type { PendingWorktreeStartingState } from "../../services/pendingWorktrees";
import type { TurnStartPermissionOverrides } from "../../services/history";
import { readGitOrigins } from "../../services/gitOrigins";
import { initializeGitRepository } from "../../services/gitInit";
import { emitGitStateChanged, listenGitStateChanged } from "../../services/gitStateEvents";
import {
  getConfigFileName,
  getPreferredLocalEnvironment,
  listLocalEnvironments,
  type LocalEnvironmentConfigEntry,
} from "../../services/localEnvironments";
import { isWithinCodexWorktrees } from "../../services/codexHome";
import {
  getConfigRequirementsForHost,
  readComposerPermissionModeVisibility,
  readConfigForHost,
  readGeneralSettingsSnapshot,
  type ComposerEnterBehavior,
  type ConfigRequirements,
  type ConfigSnapshot,
  type ConversationDetailMode,
  type FollowUpQueueMode,
  type ReviewDelivery,
} from "../../services/settings";
import { HotkeyBranchSwitcherControl } from "./HotkeyBranchSwitcherControl";
import { HotkeyWorktreeBranchControl } from "./HotkeyWorktreeBranchControl";

type HotkeyNewThreadMode = "local" | "cloud" | "worktree";

const FOLLOW_UP_QUEUE_MODE: FollowUpQueueMode = "steer";
const REVIEW_DELIVERY: ReviewDelivery = "inline";

export function HotkeyWindowNewThreadComposerOwner({
  codexHome,
  composerEnterBehavior,
  guardianApprovalEnabledByStatsig,
  selectedWorkspaceRoot,
  onOpenLocalEnvironmentsSettings,
  onStartCloudConversation,
  onStartLocalConversation,
  onStartWorktreeConversation,
}: {
  codexHome: string | null;
  composerEnterBehavior: ComposerEnterBehavior;
  guardianApprovalEnabledByStatsig: boolean;
  selectedWorkspaceRoot: string | null;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  onStartCloudConversation: (params: {
    draft: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string;
  }) => Promise<void>;
  onStartLocalConversation: (params: {
    draft: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string | null;
  }) => Promise<void>;
  onStartWorktreeConversation: (params: {
    id: string;
    localEnvironmentConfigPath: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    prompt: string;
    startingState: PendingWorktreeStartingState;
    workspaceRoot: string;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const permissionsVisibility = useMemo(() => readComposerPermissionModeVisibility(), []);
  const [composerDraft, setComposerDraft] = useState("");
  const [turnError, setTurnError] = useState<string | null>(null);
  const [mode, setMode] = useState<HotkeyNewThreadMode>("local");
  const [gitRoot, setGitRoot] = useState<string | null>(null);
  const [isCreatingGitRepository, setIsCreatingGitRepository] = useState(false);
  const [gitReloadNonce, setGitReloadNonce] = useState(0);
  const [localEnvironments, setLocalEnvironments] = useState<LocalEnvironmentConfigEntry[]>([]);
  const [selectedEnvironmentConfigPath, setSelectedEnvironmentConfigPath] = useState<string | null>(null);
  const [startingState, setStartingState] = useState<PendingWorktreeStartingState>({
    type: "working-tree",
  });
  const [permissionsConfig, setPermissionsConfig] = useState<ConfigSnapshot | null>(null);
  const [permissionsConversationDetailMode, setPermissionsConversationDetailMode] =
    useState<ConversationDetailMode>("STEPS_COMMANDS");
  const [permissionsRequirements, setPermissionsRequirements] = useState<ConfigRequirements | null>(null);
  const [selectedPermissionMode, setSelectedPermissionMode] = useState<HotkeyPermissionAgentMode | null>(null);
  const [composerFocusNonce] = useState(0);

  useEffect(() => {
    return listenGitStateChanged(() => {
      setGitReloadNonce((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (selectedWorkspaceRoot === null) {
      setGitRoot(null);
      return;
    }

    let cancelled = false;

    void readGitOrigins({ dirs: [selectedWorkspaceRoot] })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const matchingOrigin = response.origins.find((origin) =>
          areSamePath(origin.dir, selectedWorkspaceRoot),
        );
        setGitRoot(normalizeOptionalPath(matchingOrigin?.root ?? null));
      })
      .catch(() => {
        if (!cancelled) {
          setGitRoot(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gitReloadNonce, selectedWorkspaceRoot]);

  useEffect(() => {
    if (selectedWorkspaceRoot === null) {
      setLocalEnvironments([]);
      setSelectedEnvironmentConfigPath(null);
      return;
    }

    let cancelled = false;

    void listLocalEnvironments({ workspaceRoot: selectedWorkspaceRoot })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setLocalEnvironments(response.environments);
        setSelectedEnvironmentConfigPath((current) => {
          if (
            current !== null &&
            response.environments.some((entry) => areSamePath(entry.configPath, current))
          ) {
            return findMatchingEnvironmentConfigPath(response.environments, current) ?? current;
          }
          return getPreferredLocalEnvironment(response.environments)?.configPath ?? null;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLocalEnvironments([]);
          setSelectedEnvironmentConfigPath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceRoot]);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      readConfigForHost({
        hostId: null,
        cwd: selectedWorkspaceRoot,
        includeLayers: false,
      }),
      getConfigRequirementsForHost({ hostId: null }),
      readGeneralSettingsSnapshot(),
    ]).then(([configResult, requirementsResult, settingsResult]) => {
      if (cancelled) {
        return;
      }

      setPermissionsConfig(
        configResult.status === "fulfilled" ? configResult.value.config : null,
      );
      setPermissionsRequirements(
        requirementsResult.status === "fulfilled" ? requirementsResult.value.requirements : null,
      );
      setPermissionsConversationDetailMode(
        settingsResult.status === "fulfilled"
          ? settingsResult.value.conversationDetailMode
          : "STEPS_COMMANDS",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceRoot]);

  useEffect(() => {
    setStartingState({ type: "working-tree" });
  }, [gitRoot]);

  const hasGitRepo = selectedWorkspaceRoot !== null && gitRoot !== null;
  const cloudAllowed = hasGitRepo;
  const worktreeAllowed =
    selectedWorkspaceRoot !== null &&
    gitRoot !== null &&
    !isWithinCodexWorktrees(selectedWorkspaceRoot, codexHome);
  const cloudDisabledReason = selectedWorkspaceRoot === null
    ? t("hotkeyWindow.home.taskMenu.startIn.projectlessTooltip")
    : !cloudAllowed
      ? t("hotkeyWindow.home.taskMenu.startIn.disabledTooltip")
      : null;
  const worktreeDisabledReason = selectedWorkspaceRoot === null
    ? t("hotkeyWindow.home.taskMenu.startIn.projectlessTooltip")
    : hasGitRepo && !worktreeAllowed
      ? t("composer.hotkeyWindow.modeDropdown.localOnly")
      : !hasGitRepo
        ? t("hotkeyWindow.home.taskMenu.startIn.disabledTooltip")
        : null;

  useEffect(() => {
    if ((mode === "cloud" && !cloudAllowed) || (mode === "worktree" && !worktreeAllowed)) {
      setMode("local");
    }
  }, [cloudAllowed, mode, worktreeAllowed]);

  const permissionsConfigWithStatsigFeatures = useMemo(() => {
    if (!guardianApprovalEnabledByStatsig) {
      return permissionsConfig;
    }
    if (permissionsConfig === null) {
      return {
        approvalPolicy: null,
        approvalsReviewer: null,
        features: {
          guardian_approval: true,
        },
        mcpServers: null,
        memories: null,
        modelPersonality: null,
        personality: null,
        sandboxMode: null,
        sandboxWorkspaceWrite: null,
        serviceTier: null,
      } satisfies ConfigSnapshot;
    }
    return {
      ...permissionsConfig,
      features: {
        ...(permissionsConfig.features ?? {}),
        guardian_approval: true,
      },
    };
  }, [guardianApprovalEnabledByStatsig, permissionsConfig]);

  const composerPermissionsState = useMemo(
    () =>
      resolveHotkeyPermissionsState({
        config: permissionsConfigWithStatsigFeatures,
        conversationDetailMode: permissionsConversationDetailMode,
        guardianApprovalEnabledByStatsig,
        requirements: permissionsRequirements,
        visibility: permissionsVisibility,
      }),
    [
      permissionsConfigWithStatsigFeatures,
      permissionsConversationDetailMode,
      permissionsRequirements,
      permissionsVisibility,
      guardianApprovalEnabledByStatsig,
    ],
  );

  useEffect(() => {
    setSelectedPermissionMode((current) => {
      if (
        current !== null &&
        composerPermissionsState.availableAgentModes.includes(current)
      ) {
        return current;
      }
      return composerPermissionsState.initialAgentMode;
    });
  }, [composerPermissionsState]);

  const composerPermissionMode =
    selectedPermissionMode ?? composerPermissionsState.initialAgentMode;
  const permissionOverrides = useMemo(
    () =>
      buildTurnStartPermissionOverrides({
        agentMode: composerPermissionMode,
        config: permissionsConfigWithStatsigFeatures,
        workspaceRoots: selectedWorkspaceRoot === null ? [] : [selectedWorkspaceRoot],
      }),
    [
      composerPermissionMode,
      permissionsConfigWithStatsigFeatures,
      selectedWorkspaceRoot,
    ],
  );

  const environmentOptions = useMemo(() => {
    return localEnvironments.map((entry) => ({
      description: entry.type === "success" ? getConfigFileName(entry.configPath) : undefined,
      label:
        entry.type === "success"
          ? entry.environment.name.trim() || getConfigFileName(entry.configPath)
          : getConfigFileName(entry.configPath),
      value: entry.configPath,
      warning: entry.type === "error" ? entry.error.message : undefined,
    }));
  }, [localEnvironments]);

  const selectedEnvironmentEntry = useMemo(() => {
    if (selectedEnvironmentConfigPath === null) {
      return null;
    }
    return (
      localEnvironments.find((entry) => areSamePath(entry.configPath, selectedEnvironmentConfigPath)) ?? null
    );
  }, [localEnvironments, selectedEnvironmentConfigPath]);

  const handleSubmitTurn = async () => {
    const nextDraft = composerDraft.trim();
    if (nextDraft.length === 0) {
      return;
    }

    setTurnError(null);
    try {
      if (mode === "worktree") {
        if (selectedWorkspaceRoot === null || !worktreeAllowed) {
          setTurnError(worktreeDisabledReason ?? "");
          return;
        }

        await onStartWorktreeConversation({
          id: `local:pending-${crypto.randomUUID()}`,
          localEnvironmentConfigPath: selectedEnvironmentConfigPath,
          permissionOverrides,
          prompt: nextDraft,
          startingState,
          workspaceRoot: selectedWorkspaceRoot,
        });
        return;
      }

      if (mode === "cloud") {
        if (selectedWorkspaceRoot === null || !cloudAllowed) {
          setTurnError(cloudDisabledReason ?? "");
          return;
        }

        await onStartCloudConversation({
          draft: nextDraft,
          permissionOverrides,
          workspaceRoot: selectedWorkspaceRoot,
        });
        return;
      }

      await onStartLocalConversation({
        draft: nextDraft,
        permissionOverrides,
        workspaceRoot: selectedWorkspaceRoot,
      });
    } catch (submitError) {
      const nextError = getErrorMessage(submitError);
      setTurnError(nextError.length > 0 ? nextError : null);
    }
  };

  const handleCreateRepository = async () => {
    if (selectedWorkspaceRoot === null || isCreatingGitRepository) {
      return;
    }

    setTurnError(null);
    setIsCreatingGitRepository(true);
    try {
      await initializeGitRepository({ cwd: selectedWorkspaceRoot, hostId: null });
      emitGitStateChanged();
    } catch (error) {
      const nextError = getErrorMessage(error);
      setTurnError(nextError.length > 0 ? nextError : null);
    } finally {
      setIsCreatingGitRepository(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-panel pb-panel">
      <ThreadComposer
        composerDraft={composerDraft}
        composerEnterBehavior={composerEnterBehavior}
        composerPermissionConfig={permissionsConfigWithStatsigFeatures}
        composerPermissionMode={composerPermissionMode}
        composerPermissionsState={composerPermissionsState}
        conversationId={null}
        focusComposerNonce={composerFocusNonce}
        followUpQueueMode={FOLLOW_UP_QUEUE_MODE}
        isWorktreeThread={false}
        onComposerDraftChange={setComposerDraft}
        onComposerPermissionModeChange={setSelectedPermissionMode}
        onStopTurn={() => undefined}
        onSubmitTurn={() => void handleSubmitTurn()}
        placement="main"
        reviewDelivery={REVIEW_DELIVERY}
        submitButtonMode="send"
        t={t}
        threadCwd={null}
        turnError={turnError}
      />

      <HotkeyWindowNewThreadFooterControls
        cloudDisabledReason={cloudDisabledReason}
        environmentOptions={environmentOptions}
        gitRoot={gitRoot}
        isCreatingGitRepository={isCreatingGitRepository}
        mode={mode}
        selectedEnvironmentConfigPath={selectedEnvironmentConfigPath}
        selectedEnvironmentEntry={selectedEnvironmentEntry}
        selectedWorkspaceRoot={selectedWorkspaceRoot}
        startingState={startingState}
        worktreeAllowed={worktreeAllowed}
        worktreeDisabledReason={worktreeDisabledReason}
        onCreateRepository={() => void handleCreateRepository()}
        onModeChange={setMode}
        onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
        onSelectedEnvironmentConfigPathChange={setSelectedEnvironmentConfigPath}
        onStartingStateChange={setStartingState}
      />
    </div>
  );
}

function HotkeyWindowNewThreadFooterControls({
  cloudDisabledReason,
  environmentOptions,
  gitRoot,
  isCreatingGitRepository,
  mode,
  selectedEnvironmentConfigPath,
  selectedEnvironmentEntry,
  selectedWorkspaceRoot,
  startingState,
  worktreeAllowed,
  worktreeDisabledReason,
  onCreateRepository,
  onModeChange,
  onOpenLocalEnvironmentsSettings,
  onSelectedEnvironmentConfigPathChange,
  onStartingStateChange,
}: {
  cloudDisabledReason: string | null;
  environmentOptions: Array<{
    description?: string;
    label: string;
    value: string;
    warning?: string;
  }>;
  gitRoot: string | null;
  isCreatingGitRepository: boolean;
  mode: HotkeyNewThreadMode;
  selectedEnvironmentConfigPath: string | null;
  selectedEnvironmentEntry: LocalEnvironmentConfigEntry | null;
  selectedWorkspaceRoot: string | null;
  startingState: PendingWorktreeStartingState;
  worktreeAllowed: boolean;
  worktreeDisabledReason: string | null;
  onCreateRepository: () => void;
  onModeChange: (mode: HotkeyNewThreadMode) => void;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  onSelectedEnvironmentConfigPathChange: (configPath: string) => void;
  onStartingStateChange: (state: PendingWorktreeStartingState) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex flex-wrap items-center gap-2">
        <RunLocationDropdown
          cloudDisabledReason={cloudDisabledReason}
          mode={mode}
          worktreeAllowed={worktreeAllowed}
          worktreeDisabledReason={worktreeDisabledReason}
          onModeChange={onModeChange}
        />
        {mode === "local" && selectedWorkspaceRoot !== null && gitRoot === null ? (
          <button
            type="button"
            disabled={isCreatingGitRepository}
            onClick={onCreateRepository}
            className="app-thread-composer-footer-pill inline-flex max-w-[240px] items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlusIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {isCreatingGitRepository
                ? t("codex.review.noDiff.gitInit.creating")
                : t("codex.review.noDiff.gitInit.createRepository")}
            </span>
          </button>
        ) : null}
      </div>

      {mode === "worktree" && selectedWorkspaceRoot !== null && gitRoot !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {environmentOptions.length > 0 ? (
              <SettingsChoiceMenu
                disabled={false}
                onChange={onSelectedEnvironmentConfigPathChange}
                options={environmentOptions}
                triggerLabel={
                  selectedEnvironmentEntry?.type === "success"
                    ? selectedEnvironmentEntry.environment.name.trim() ||
                      getConfigFileName(selectedEnvironmentEntry.configPath)
                    : selectedEnvironmentEntry
                      ? getConfigFileName(selectedEnvironmentEntry.configPath)
                      : undefined
                }
                value={
                  selectedEnvironmentConfigPath ??
                  environmentOptions[0]?.value ??
                  ""
                }
              />
            ) : (
              <button
                type="button"
                className="app-thread-composer-footer-pill inline-flex items-center gap-1.5"
                onClick={() =>
                  onOpenLocalEnvironmentsSettings({
                    configPath: null,
                    workspaceRoot: selectedWorkspaceRoot,
                  })
                }
              >
                <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{t("settings.localEnvironments.environment.create")}</span>
              </button>
            )}
            <Button
              aria-label={t("settings.nav.local-environments")}
              color="ghost"
              size="composer"
              uniform
              onClick={() =>
                onOpenLocalEnvironmentsSettings({
                  configPath: selectedEnvironmentConfigPath,
                  workspaceRoot: selectedWorkspaceRoot,
                })
              }
            >
              <SettingsCogIcon className="icon-xs" />
            </Button>
          </div>
          <HotkeyWorktreeBranchControl
            gitRoot={gitRoot}
            onStartingStateChange={onStartingStateChange}
            startingState={startingState}
          />
        </div>
      ) : null}

      {(mode === "local" || mode === "cloud") && gitRoot !== null ? (
        <HotkeyBranchSwitcherControl gitRoot={gitRoot} />
      ) : null}
    </div>
  );
}

function RunLocationDropdown({
  cloudDisabledReason,
  mode,
  worktreeAllowed,
  worktreeDisabledReason,
  onModeChange,
}: {
  cloudDisabledReason: string | null;
  mode: HotkeyNewThreadMode;
  worktreeAllowed: boolean;
  worktreeDisabledReason: string | null;
  onModeChange: (mode: HotkeyNewThreadMode) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const options = [
    {
      disabled: false,
      label: t("composer.mode.local"),
      value: "local" as const,
    },
    {
      disabled: cloudDisabledReason !== null,
      label: t("composer.footer.v2.cloudTab"),
      title: cloudDisabledReason ?? undefined,
      value: "cloud" as const,
    },
    {
      disabled: !worktreeAllowed,
      label: t("composer.mode.worktreeSegment"),
      title: worktreeDisabledReason ?? undefined,
      value: "worktree" as const,
    },
  ];
  const currentLabel =
    mode === "cloud"
      ? t("composer.footer.v2.cloudTab")
      : mode === "worktree"
        ? t("composer.mode.worktreeSegment")
        : t("composer.mode.local");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={[
          "app-thread-composer-pill",
          isOpen ? "app-thread-composer-pill-active" : "",
        ].join(" ")}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{currentLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
      </button>

      {isOpen ? (
        <div className="app-card absolute left-0 bottom-[calc(100%+8px)] z-20 min-w-[188px] rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {options.map((option) => {
            const isSelected = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                title={option.title}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }
                  setIsOpen(false);
                  onModeChange(option.value);
                }}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60",
                  isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                ].join(" ")}
              >
                <span>{option.label}</span>
                <CheckIcon
                  className={[
                    "h-3.5 w-3.5 shrink-0 text-token-text-secondary",
                    isSelected ? "" : "invisible",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "";
}

function findMatchingEnvironmentConfigPath(
  environments: LocalEnvironmentConfigEntry[],
  candidate: string | null,
) {
  if (candidate === null) {
    return null;
  }
  return environments.find((entry) => areSamePath(entry.configPath, candidate))?.configPath ?? null;
}

function normalizeOptionalPath(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeComparablePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function areSamePath(left: string, right: string) {
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}
