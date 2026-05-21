import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CloudTaskIcon,
  DefaultPermissionsIcon,
  FullAccessPermissionsIcon,
  GuardianApprovalsIcon,
  MacbookIcon,
  MoreActionsIcon,
  SettingsCogIcon,
  WorktreeIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n/i18n";
import type { PendingWorktreeStartingState } from "../../services/pendingWorktrees";
import type { TurnStartPermissionOverrides } from "../../services/history";
import { showSettings } from "../../services/windowNavigation";
import {
  getConfigFileName,
  getLocalEnvironmentProjectName,
  getPreferredLocalEnvironment,
  listLocalEnvironments,
  type LocalEnvironmentConfigEntry,
} from "../../services/localEnvironments";
import { readGitOrigins } from "../../services/gitOrigins";
import {
  getConfigRequirementsForHost,
  readComposerPermissionModeVisibility,
  readConfigForHost,
  readGeneralSettingsSnapshot,
  type ConfigRequirements,
  type ConfigSnapshot,
  type ConversationDetailMode,
} from "../../services/settings";
import { isWithinCodexWorktrees } from "../../services/codexHome";
import { buildThreadComposerPermissionOptions } from "../chat/ThreadComposer";
import { HotkeyBranchSwitcherControl } from "./HotkeyBranchSwitcherControl";
import { HotkeyWorktreeBranchControl } from "./HotkeyWorktreeBranchControl";
import { HotkeyWindowProjectMenuControl } from "./HotkeyWindowProjectMenuControl";
import type { HotkeyWindowProjectSelection } from "./HotkeyWindowProjectMenuControl";
import {
  buildTurnStartPermissionOverrides,
  getHotkeyPermissionOptionValue,
  getNextAgentModeFromOption,
  isDefaultPermissionsMode,
  resolveHotkeyPermissionsState,
  type HotkeyPermissionAgentMode,
  type HotkeyPermissionOptionValue,
} from "./hotkeyPermissionsMode";
import { useReplicaStatsigDefaultFeatures } from "../statsig/replicaStatsig";

const HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE = "data-hotkey-window-home-composer-menu-open";
const HOTKEY_WINDOW_HOME_FLOATING_MENU_SELECTOR = "[data-hotkey-window-home-menu-popover='true']";

type HotkeyWindowHomeMode = "local" | "cloud" | "worktree";

type HomeModeMenuOption = {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  title?: string;
  value: HotkeyWindowHomeMode;
};

type HomeMenuOption = {
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  title?: string;
  value: string;
  warning?: string;
};

type HomeQuickAction = {
  icon: ReactNode;
  title: string;
  value: HotkeyWindowHomeMode;
};

type HotkeyWindowHomePageViewProps = {
  branchControl: ReactNode | null;
  codexHome: string | null;
  composerEnterBehavior: "enter" | "cmdIfMultiline";
  draft: string;
  environmentControlEnabled: boolean;
  environmentOptions: HomeMenuOption[];
  error: string | null;
  initialProjectSelection: HotkeyWindowProjectSelection | null;
  isFullAccessConfirmOpen: boolean;
  isPermissionsLoading: boolean;
  isProjectless: boolean;
  isSubmitting: boolean;
  isTaskMenuOpen: boolean;
  mode: HotkeyWindowHomeMode;
  modeDisabledTooltipText: string | null;
  permissionMenuValue: HotkeyPermissionOptionValue;
  permissionOptions: HomeMenuOption[];
  permissionTriggerLabel: string;
  permissionsHidden: boolean;
  permissionsMenuDisabled: boolean;
  placeholderText: string;
  pointerInteractionPaused: boolean;
  projectMenuInitialSelection: HotkeyWindowProjectSelection | null;
  quickActions: HomeQuickAction[];
  selectedEnvironmentConfigPath: string | null;
  selectedEnvironmentLabel: string | null;
  selectedLocalWorkspaceRoot: string | null;
  shellRef?: RefObject<HTMLDivElement | null>;
  taskMenuRef?: RefObject<HTMLDivElement | null>;
  worktreeAllowed: boolean;
  worktreeDisabledTooltipText?: string;
  onConfirmFullAccess: () => void;
  onDismissFullAccessConfirm: () => void;
  onDraftChange: (value: string) => void;
  onEnvironmentSelect: (value: string) => void;
  onOpenLocalEnvironmentSettings: () => void;
  onPermissionSelect: (value: string) => void;
  onQuickActionSelect: (mode: HotkeyWindowHomeMode) => void;
  onSelectedProjectChange: (selection: HotkeyWindowProjectSelection) => void;
  onSubmit: () => void;
  onToggleTaskMenu: () => void;
};

export function HotkeyWindowHomePage({
  codexHome,
  composerEnterBehavior,
  initialProjectSelection,
  onStartCloudConversation,
  onStartLocalConversation,
  onStartWorktreeConversation,
}: {
  codexHome: string | null;
  composerEnterBehavior: "enter" | "cmdIfMultiline";
  initialProjectSelection: HotkeyWindowProjectSelection | null;
  onStartCloudConversation: (params: {
    draft: string;
    hostId: string | null;
    cwd: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoots: string[];
  }) => Promise<void>;
  onStartLocalConversation: (params: {
    draft: string;
    hostId: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string | null;
    workspaceRoots: string[];
  }) => Promise<void>;
  onStartWorktreeConversation: (params: {
    hostId: string;
    id: string;
    localEnvironmentConfigPath: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    prompt: string;
    startingState: PendingWorktreeStartingState;
    workspaceRoot: string;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const initialExecutionSelection = useMemo(
    () => normalizeProjectSelection(initialProjectSelection),
    [initialProjectSelection],
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);
  const [mode, setMode] = useState<HotkeyWindowHomeMode>("local");
  const [gitRoot, setGitRoot] = useState<string | null>(null);
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
  const [selectedProject, setSelectedProject] = useState<HotkeyWindowProjectSelection>(
    initialExecutionSelection.kind === "local" ? initialExecutionSelection : { kind: "projectless" },
  );
  const [isFullAccessConfirmOpen, setIsFullAccessConfirmOpen] = useState(false);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const defaultFeatures = useReplicaStatsigDefaultFeatures();
  const permissionsVisibility = useMemo(() => readComposerPermissionModeVisibility(), []);
  const executionSelection =
    selectedProject.kind === "local"
      ? selectedProject
      : initialExecutionSelection.kind === "remote"
        ? initialExecutionSelection
        : selectedProject;
  const selectedLocalWorkspaceRoot =
    selectedProject.kind === "local" ? selectedProject.workspaceRoot : null;
  const selectedExecutionWorkspaceRoot =
    executionSelection.kind === "remote"
      ? executionSelection.remotePath
      : executionSelection.kind === "local"
        ? executionSelection.workspaceRoot
        : null;
  const selectedExecutionHostId =
    executionSelection.kind === "remote" ? executionSelection.hostId : null;
  const selectedWorkspaceRoots =
    selectedExecutionWorkspaceRoot === null ? [] : [selectedExecutionWorkspaceRoot];

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedLocalWorkspaceRoot === null) {
      setGitRoot(null);
      return;
    }

    let cancelled = false;

    void readGitOrigins({ dirs: [selectedLocalWorkspaceRoot], hostId: null })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const matchingOrigin = response.origins.find((origin) =>
          areSamePath(origin.dir, selectedLocalWorkspaceRoot),
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
  }, [selectedLocalWorkspaceRoot]);

  useEffect(() => {
    if (selectedLocalWorkspaceRoot === null) {
      setLocalEnvironments([]);
      setSelectedEnvironmentConfigPath(null);
      return;
    }

    let cancelled = false;

    void listLocalEnvironments({ hostId: null, workspaceRoot: selectedLocalWorkspaceRoot })
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
  }, [selectedLocalWorkspaceRoot]);

  const isProjectless = selectedExecutionWorkspaceRoot === null;
  const hasGitRepo = selectedLocalWorkspaceRoot !== null && gitRoot !== null;
  const cloudAllowed = executionSelection.kind === "remote" ? true : hasGitRepo;
  const worktreeAllowed =
    selectedLocalWorkspaceRoot !== null &&
    gitRoot !== null &&
    !isWithinCodexWorktrees(selectedLocalWorkspaceRoot, codexHome);
  const worktreeDisabledTooltipText =
    hasGitRepo && !worktreeAllowed
      ? t("composer.hotkeyWindow.modeDropdown.localOnly")
      : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsPermissionsLoading(true);

    void Promise.allSettled([
      readConfigForHost({
        hostId: selectedExecutionHostId,
        cwd: selectedExecutionWorkspaceRoot,
        includeLayers: false,
      }),
      getConfigRequirementsForHost({ hostId: selectedExecutionHostId }),
      readGeneralSettingsSnapshot(),
    ])
      .then(([configResult, requirementsResult, settingsResult]) => {
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
      })
      .finally(() => {
        if (!cancelled) {
          setIsPermissionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedExecutionHostId, selectedExecutionWorkspaceRoot]);

  useEffect(() => {
    setStartingState({ type: "working-tree" });
  }, [gitRoot]);

  useEffect(() => {
    if ((mode === "cloud" && !cloudAllowed) || (mode === "worktree" && !worktreeAllowed)) {
      setMode("local");
    }
  }, [cloudAllowed, mode, worktreeAllowed]);

  useEffect(() => {
    if (!isTaskMenuOpen) {
      document.body.removeAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE);
      return undefined;
    }

    document.body.setAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE, "true");
    return () => {
      document.body.removeAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE);
    };
  }, [isTaskMenuOpen]);

  useEffect(() => {
    if (!isTaskMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (taskMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsTaskMenuOpen(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (taskMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsTaskMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isTaskMenuOpen]);

  const pointerInteractionPaused = useFloatingWindowPointerInteractivity({
    floatingElementSelectors: [HOTKEY_WINDOW_HOME_FLOATING_MENU_SELECTOR],
    includeInteractiveRegion: true,
    interactiveRegionRef: shellRef,
    onInteractiveChange: (isInteractive) => {
      void invoke("hotkey-window-home-pointer-interaction-changed", {
        params: {
          isInteractive,
        },
      }).catch(() => undefined);
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (isTaskMenuOpen) {
        setIsTaskMenuOpen(false);
        return;
      }

      void dismissHotkeyWindow();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTaskMenuOpen]);

  const environmentOptions = useMemo<HomeMenuOption[]>(() => {
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

  const selectedProjectPlaceholderLabel =
    getLocalEnvironmentProjectName(selectedExecutionWorkspaceRoot) ??
    t("hotkeyWindow.home.placeholder.unknownProject");

  const placeholderText = isProjectless
    ? t("hotkeyWindow.home.placeholder.projectless")
    : mode === "cloud"
      ? t("hotkeyWindow.home.placeholder.cloud")
      : mode === "worktree"
        ? t("hotkeyWindow.home.placeholder.worktree", {
            project: selectedProjectPlaceholderLabel,
          })
        : t("hotkeyWindow.home.placeholder.local", {
            project: selectedProjectPlaceholderLabel,
          });

  const modeDisabledTooltipText = isProjectless
    ? t("hotkeyWindow.home.taskMenu.startIn.projectlessTooltip")
    : !cloudAllowed
      ? t("hotkeyWindow.home.taskMenu.startIn.disabledTooltip")
      : null;
  const guardianApprovalEnabledByStatsig =
    defaultFeatures.guardian_approval === true;
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

  const permissionsState = useMemo(
    () =>
      resolveHotkeyPermissionsState({
        config: permissionsConfigWithStatsigFeatures,
        conversationDetailMode: permissionsConversationDetailMode,
        guardianApprovalEnabledByStatsig,
        requirements: permissionsRequirements,
        visibility: permissionsVisibility,
      }),
    [
      guardianApprovalEnabledByStatsig,
      permissionsConfigWithStatsigFeatures,
      permissionsConversationDetailMode,
      permissionsRequirements,
      permissionsVisibility,
    ],
  );

  useEffect(() => {
    setSelectedPermissionMode((current) => {
      if (current !== null && permissionsState.availableAgentModes.includes(current)) {
        return current;
      }
      return permissionsState.initialAgentMode;
    });
  }, [permissionsState]);

  const currentPermissionMode =
    selectedPermissionMode ?? permissionsState.initialAgentMode;

  const permissionOptions = useMemo<HomeMenuOption[]>(() => {
    return buildThreadComposerPermissionOptions({
      composerPermissionsState: permissionsState,
      t,
    }).map((option) => ({
      disabled: option.disabled,
      icon: getPermissionIcon(option.value),
      label: option.label,
      title: sanitizeTooltipText(option.tooltip),
      value: option.value,
    }));
  }, [permissionsState, t]);

  const permissionMenuValue = getHotkeyPermissionOptionValue(currentPermissionMode);
  const permissionTriggerLabel = isDefaultPermissionsMode(currentPermissionMode)
    ? t("composer.permissionsDropdown.default.label")
    : currentPermissionMode === "guardian-approvals"
      ? t("composer.permissionsDropdown.guardianApproval.shortLabel")
      : currentPermissionMode === "full-access"
        ? t("composer.permissionsDropdown.fullAccess.label")
        : t("composer.permissionsDropdown.custom.label");

  const permissionOverrides = useMemo(
    () =>
      buildTurnStartPermissionOverrides({
        agentMode: currentPermissionMode,
        config: permissionsConfigWithStatsigFeatures,
        workspaceRoots: selectedWorkspaceRoots,
      }),
    [
      currentPermissionMode,
      permissionsConfigWithStatsigFeatures,
      selectedWorkspaceRoots,
    ],
  );

  const submitDraft = async () => {
    const nextDraft = draft.trim();
    if (nextDraft.length === 0 || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "worktree" && selectedLocalWorkspaceRoot !== null && worktreeAllowed) {
        await onStartWorktreeConversation({
          hostId: selectedExecutionHostId ?? "local",
          id: `local:pending-${crypto.randomUUID()}`,
          localEnvironmentConfigPath: selectedEnvironmentConfigPath,
          permissionOverrides,
          prompt: nextDraft,
          startingState,
          workspaceRoot: selectedLocalWorkspaceRoot,
        });
      } else if (mode === "cloud" && selectedExecutionWorkspaceRoot !== null && cloudAllowed) {
        await onStartCloudConversation({
          cwd: selectedExecutionWorkspaceRoot,
          draft: nextDraft,
          hostId: selectedExecutionHostId,
          permissionOverrides,
          workspaceRoots: selectedWorkspaceRoots,
        });
      } else {
        await onStartLocalConversation({
          draft: nextDraft,
          hostId: selectedExecutionHostId,
          permissionOverrides,
          workspaceRoot: selectedExecutionWorkspaceRoot,
          workspaceRoots: selectedWorkspaceRoots,
        });
      }
    } catch (submitError) {
      const nextError = getErrorMessage(submitError);
      setError(nextError.length > 0 ? nextError : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionOptionChange = (value: string) => {
    if (
      value !== "default" &&
      value !== "guardian-approvals" &&
      value !== "full-access" &&
      value !== "custom"
    ) {
      return;
    }

    if (value === "full-access") {
      setIsFullAccessConfirmOpen(true);
      return;
    }

    setSelectedPermissionMode(
      getNextAgentModeFromOption({
        defaultAgentMode: permissionsState.defaultAgentMode,
        option: value,
      }),
    );
  };

  const updateHotkeyHomePrefillCwd = (workspaceRoot: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    const nextState = {
      ...currentState,
      prefillCwd: workspaceRoot ?? "~",
    };
    window.history.replaceState(
      nextState,
      "",
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  };

  const quickActions = useMemo<HomeQuickAction[]>(() => {
    const nextQuickActions: HomeQuickAction[] = [];
    if (!isProjectless && mode !== "local") {
      nextQuickActions.push({
        icon: <MacbookIcon className="icon-xs" />,
        title: t("composer.mode.local"),
        value: "local",
      });
    }
    if (!isProjectless && worktreeAllowed && mode !== "worktree") {
      nextQuickActions.push({
        icon: <WorktreeIcon className="icon-xs" />,
        title: t("composer.mode.worktree"),
        value: "worktree",
      });
    }
    return nextQuickActions;
  }, [isProjectless, mode, t, worktreeAllowed]);

  const branchControl =
    mode === "worktree"
      ? gitRoot === null
        ? null
        : (
          <HotkeyWorktreeBranchControl
            gitRoot={gitRoot}
            onStartingStateChange={setStartingState}
            startingState={startingState}
          />
        )
      : gitRoot !== null
        ? <HotkeyBranchSwitcherControl gitRoot={gitRoot} />
        : null;

  const selectedEnvironmentLabel =
    selectedEnvironmentEntry?.type === "success"
      ? selectedEnvironmentEntry.environment.name.trim() ||
        getConfigFileName(selectedEnvironmentEntry.configPath)
      : selectedEnvironmentEntry
        ? getConfigFileName(selectedEnvironmentEntry.configPath)
        : null;

  const projectMenuInitialSelection =
    selectedProject.kind === "local" ? selectedProject : null;

  return (
    <HotkeyWindowHomePageView
      branchControl={branchControl}
      codexHome={codexHome}
      composerEnterBehavior={composerEnterBehavior}
      draft={draft}
      environmentControlEnabled={selectedLocalWorkspaceRoot !== null}
      environmentOptions={environmentOptions}
      error={error}
      initialProjectSelection={initialProjectSelection}
      isFullAccessConfirmOpen={isFullAccessConfirmOpen}
      isPermissionsLoading={isPermissionsLoading}
      isProjectless={isProjectless}
      isSubmitting={isSubmitting}
      isTaskMenuOpen={isTaskMenuOpen}
      mode={mode}
      modeDisabledTooltipText={modeDisabledTooltipText}
      permissionMenuValue={permissionMenuValue}
      permissionOptions={permissionOptions}
      permissionTriggerLabel={permissionTriggerLabel}
      permissionsHidden={mode === "cloud"}
      permissionsMenuDisabled={isPermissionsLoading || permissionsState.isDropdownDisabled}
      placeholderText={placeholderText}
      pointerInteractionPaused={pointerInteractionPaused}
      projectMenuInitialSelection={projectMenuInitialSelection}
      quickActions={quickActions}
      selectedEnvironmentConfigPath={selectedEnvironmentConfigPath}
      selectedEnvironmentLabel={selectedEnvironmentLabel}
      selectedLocalWorkspaceRoot={selectedLocalWorkspaceRoot}
      shellRef={shellRef}
      taskMenuRef={taskMenuRef}
      worktreeAllowed={worktreeAllowed}
      worktreeDisabledTooltipText={worktreeDisabledTooltipText}
      onConfirmFullAccess={() => {
        setSelectedPermissionMode("full-access");
        setIsFullAccessConfirmOpen(false);
      }}
      onDismissFullAccessConfirm={() => setIsFullAccessConfirmOpen(false)}
      onDraftChange={setDraft}
      onEnvironmentSelect={setSelectedEnvironmentConfigPath}
      onOpenLocalEnvironmentSettings={() => {
        if (selectedLocalWorkspaceRoot !== null) {
          void showSettings("local-environments");
        }
      }}
      onPermissionSelect={handlePermissionOptionChange}
      onQuickActionSelect={setMode}
      onSelectedProjectChange={(selection) => {
        setSelectedProject(selection);
        updateHotkeyHomePrefillCwd(
          selection.kind === "local" ? selection.workspaceRoot : null,
        );
      }}
      onSubmit={() => {
        void submitDraft();
      }}
      onToggleTaskMenu={() => setIsTaskMenuOpen((open) => !open)}
    />
  );
}

export function HotkeyWindowHomePageView({
  branchControl,
  codexHome,
  composerEnterBehavior,
  draft,
  environmentControlEnabled,
  environmentOptions,
  error,
  initialProjectSelection,
  isFullAccessConfirmOpen,
  isPermissionsLoading,
  isProjectless,
  isSubmitting,
  isTaskMenuOpen,
  mode,
  modeDisabledTooltipText,
  permissionMenuValue,
  permissionOptions,
  permissionTriggerLabel,
  permissionsHidden,
  permissionsMenuDisabled,
  placeholderText,
  pointerInteractionPaused,
  projectMenuInitialSelection,
  quickActions,
  selectedEnvironmentConfigPath,
  selectedEnvironmentLabel,
  selectedLocalWorkspaceRoot,
  shellRef,
  taskMenuRef,
  worktreeAllowed,
  worktreeDisabledTooltipText,
  onConfirmFullAccess,
  onDismissFullAccessConfirm,
  onDraftChange,
  onEnvironmentSelect,
  onOpenLocalEnvironmentSettings,
  onPermissionSelect,
  onQuickActionSelect,
  onSelectedProjectChange,
  onSubmit,
  onToggleTaskMenu,
}: HotkeyWindowHomePageViewProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modeOptions = useMemo<HomeModeMenuOption[]>(() => {
    return [
      {
        icon: <MacbookIcon className="icon-xs" />,
        label: t("composer.mode.local"),
        value: "local",
      },
      {
        icon: <CloudTaskIcon className="icon-xs" />,
        label: t("composer.footer.v2.cloudTab"),
        value: "cloud",
      },
      {
        disabled: !worktreeAllowed,
        icon: <WorktreeIcon className="icon-xs" />,
        label: t("composer.mode.worktreeSegment"),
        title: worktreeDisabledTooltipText,
        value: "worktree",
      },
    ];
  }, [t, worktreeAllowed, worktreeDisabledTooltipText]);

  const permissionTriggerIcon = getPermissionIcon(permissionMenuValue);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <main aria-label={t("threadPage.newThread")} className="h-full bg-transparent" role="main">
      <div className="hotkey-window-home relative flex h-full w-full items-end overflow-hidden bg-transparent p-1 pointer-events-none">
        <div
          ref={shellRef}
          className={joinClasses(
            "hotkey-window-home-shell pointer-events-auto relative w-full px-[15px] pt-[17px] pb-[13px]",
            pointerInteractionPaused && "no-drag",
          )}
        >
          <div aria-hidden="true" className="hotkey-window-home-underlay" />
          {quickActions.length > 0 ? (
            <div className="relative z-10 mb-3 flex items-center gap-2 px-1">
              {quickActions.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  className="app-thread-composer-action-button no-drag"
                  title={action.title}
                  aria-label={action.title}
                  onClick={() => onQuickActionSelect(action.value)}
                >
                  {action.icon}
                </button>
              ))}
            </div>
          ) : null}
          <div className="hotkey-window-home-composer-surface no-drag relative overflow-hidden rounded-[22px]">
            <div className="px-4 pt-4 pb-3">
              <textarea
                ref={textareaRef}
                aria-label={placeholderText}
                className="app-text-input min-h-[112px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) {
                    return;
                  }

                  const hasMultilineContent = draft.includes("\n");
                  if (composerEnterBehavior === "enter" || !hasMultilineContent) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder={placeholderText}
                rows={4}
                value={draft}
              />
            </div>

            <div className="border-t border-[var(--app-shell-border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div
                  className={joinClasses(
                    error ? "app-text-error" : "app-text-subtle",
                    "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5",
                  )}
                >
                  {error ?? "\u00a0"}
                </div>
                <div className="relative flex items-center gap-2" ref={taskMenuRef}>
                  <Button
                    aria-label={t("hotkeyWindow.home.taskMenu.label")}
                    color="ghost"
                    size="composer"
                    title={t("hotkeyWindow.home.taskMenu.label")}
                    uniform
                    onClick={onToggleTaskMenu}
                  >
                    <MoreActionsIcon className="icon-xs" />
                  </Button>
                  {isTaskMenuOpen ? (
                    <div
                      data-hotkey-window-home-menu-popover="true"
                      className="app-card absolute right-0 bottom-[calc(100%+10px)] z-20 min-w-[320px] rounded-[24px] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                    >
                      <div className="flex flex-col gap-4">
                        <TaskMenuRow
                          control={
                            <HotkeyWindowProjectMenuControl
                              allowRemoteProjects={false}
                              codexHome={codexHome}
                              initialSelection={
                                projectMenuInitialSelection ??
                                (initialProjectSelection?.kind === "local"
                                  ? initialProjectSelection
                                  : null)
                              }
                              onAddRemoteProject={() => undefined}
                              onSelectedProjectChange={onSelectedProjectChange}
                            />
                          }
                          label={t("hotkeyWindow.home.taskMenu.project")}
                        />

                        <TaskMenuRow
                          control={
                            <HomeModeMenu
                              disabled={modeDisabledTooltipText !== null}
                              disabledTooltipText={modeDisabledTooltipText ?? undefined}
                              options={modeOptions}
                              value={mode}
                              onSelect={onQuickActionSelect}
                            />
                          }
                          label={t("hotkeyWindow.home.taskMenu.startIn")}
                        />

                        {mode === "worktree" ? (
                          <TaskMenuRow
                            control={
                              <div className="flex items-center gap-2">
                                {environmentOptions.length > 0 ? (
                                  <HomePillMenu
                                    align="start"
                                    buttonLabel={
                                      selectedEnvironmentLabel ??
                                      environmentOptions[0]?.label ??
                                      t("settings.localEnvironments.environment.create")
                                    }
                                    menuWidthClassName="min-w-[280px]"
                                    options={environmentOptions}
                                    value={selectedEnvironmentConfigPath ?? environmentOptions[0]?.value ?? ""}
                                    onSelect={onEnvironmentSelect}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="app-thread-composer-pill"
                                    disabled={!environmentControlEnabled}
                                    onClick={onOpenLocalEnvironmentSettings}
                                  >
                                    <span>{t("settings.localEnvironments.environment.create")}</span>
                                  </button>
                                )}
                                <Button
                                  aria-label={t("settings.nav.local-environments")}
                                  color="ghost"
                                  size="composer"
                                  uniform
                                  onClick={onOpenLocalEnvironmentSettings}
                                >
                                  <SettingsCogIcon className="icon-xs" />
                                </Button>
                              </div>
                            }
                            label={t("hotkeyWindow.home.taskMenu.environment")}
                          />
                        ) : null}

                        {branchControl ? (
                          <TaskMenuRow
                            control={branchControl}
                            label={t("hotkeyWindow.home.taskMenu.branch")}
                          />
                        ) : null}

                        {permissionsHidden ? null : (
                          <TaskMenuRow
                            control={
                              <HomePillMenu
                                align="start"
                                buttonIcon={permissionTriggerIcon}
                                buttonLabel={permissionTriggerLabel}
                                disabled={permissionsMenuDisabled}
                                disabledTooltipText={
                                  permissionsMenuDisabled && !isPermissionsLoading
                                    ? sanitizeTooltipText(t("composer.permissionsDropdown.disabled.requirements"))
                                    : undefined
                                }
                                menuWidthClassName="min-w-[236px]"
                                options={permissionOptions}
                                value={permissionMenuValue}
                                onSelect={onPermissionSelect}
                              />
                            }
                            label={t("hotkeyWindow.home.taskMenu.permissions")}
                          />
                        )}
                      </div>
                    </div>
                  ) : null}
                  <Button
                    color="primary"
                    disabled={draft.trim().length === 0}
                    loading={isSubmitting}
                    size="composer"
                    onClick={onSubmit}
                  >
                    {t("app.chat.send")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {isFullAccessConfirmOpen ? (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
              <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <div className="app-title text-[15px] font-medium">
                  {t("composer.mode.agentMode.fullAccessConfirm.title")}
                </div>
                <div className="app-text-muted mt-2 text-[13px] leading-6">
                  {t("composer.mode.agentMode.fullAccessConfirm.description")}
                </div>
                <div className="app-text-muted mt-3 text-[13px] leading-6">
                  {t("composer.mode.agentMode.fullAccessConfirm.caution")}
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onDismissFullAccessConfirm}
                    className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                  >
                    {t("composer.mode.agentMode.fullAccessConfirm.goBack")}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmFullAccess}
                    className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px]"
                  >
                    {t("composer.mode.agentMode.fullAccessConfirm.confirm")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function HomeModeMenu({
  disabled,
  disabledTooltipText,
  options,
  value,
  onSelect,
}: {
  disabled: boolean;
  disabledTooltipText?: string;
  options: HomeModeMenuOption[];
  value: HotkeyWindowHomeMode;
  onSelect: (value: HotkeyWindowHomeMode) => void;
}) {
  const triggerOption = options.find((option) => option.value === value) ?? options[0];
  return (
    <HomePillMenu
      buttonIcon={triggerOption?.icon}
      buttonLabel={triggerOption?.label ?? value}
      disabled={disabled}
      disabledTooltipText={disabledTooltipText}
      options={options.map((option) => ({
        disabled: option.disabled,
        icon: option.icon,
        label: option.label,
        title: option.title,
        value: option.value,
      }))}
      value={value}
      onSelect={(nextValue) => {
        if (nextValue === "local" || nextValue === "cloud" || nextValue === "worktree") {
          onSelect(nextValue);
        }
      }}
    />
  );
}

function HomePillMenu({
  align = "end",
  buttonIcon,
  buttonLabel,
  disabled = false,
  disabledTooltipText,
  menuWidthClassName = "min-w-[220px]",
  options,
  value,
  onSelect,
}: {
  align?: "end" | "start";
  buttonIcon?: ReactNode;
  buttonLabel: string;
  disabled?: boolean;
  disabledTooltipText?: string;
  menuWidthClassName?: string;
  options: HomeMenuOption[];
  value: string;
  onSelect: (value: string) => void;
}) {
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
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
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

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={joinClasses(
        "app-thread-composer-pill",
        isOpen && "app-thread-composer-pill-active",
      )}
      onClick={() => {
        if (!disabled) {
          setIsOpen((open) => !open);
        }
      }}
    >
      {buttonIcon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{buttonIcon}</span>
      ) : null}
      <span className="max-w-40 truncate text-left whitespace-nowrap">{buttonLabel}</span>
      <ChevronDownIcon className="icon-2xs shrink-0" />
    </button>
  );

  return (
    <div className="relative max-w-full" ref={containerRef}>
      {disabled && disabledTooltipText ? (
        <span title={disabledTooltipText}>{trigger}</span>
      ) : (
        trigger
      )}
      {isOpen ? (
        <div
          data-hotkey-window-home-menu-popover="true"
          className={joinClasses(
            "app-card absolute top-[calc(100%+8px)] z-30 rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
            align === "start" ? "left-0" : "right-0",
            menuWidthClassName,
          )}
        >
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const isOptionDisabled = disabled || option.disabled === true;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isOptionDisabled}
                  title={option.title}
                  className={joinClasses(
                    "app-nav-item-idle flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected && "app-nav-item-active",
                  )}
                  onClick={() => {
                    if (isOptionDisabled) {
                      return;
                    }
                    setIsOpen(false);
                    onSelect(option.value);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      {option.icon ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {option.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0 truncate">{option.label}</span>
                    </span>
                    {option.description ? (
                      <span className="app-text-muted mt-1 block text-[12px] leading-5">{option.description}</span>
                    ) : null}
                    {option.warning ? (
                      <span className="app-text-muted mt-1 block text-[12px] leading-5">{option.warning}</span>
                    ) : null}
                  </span>
                  <CheckIcon className={joinClasses("h-3.5 w-3.5 shrink-0", !isSelected && "invisible")} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskMenuRow({
  control,
  label,
}: {
  control: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="shrink-0 text-sm font-medium text-[var(--app-shell-text)]">{label}</div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}

function normalizeProjectSelection(
  selection: HotkeyWindowProjectSelection | null | undefined,
): HotkeyWindowProjectSelection {
  if (!selection) {
    return { kind: "projectless" };
  }

  if (selection.kind === "local") {
    const workspaceRoot = normalizeOptionalPath(selection.workspaceRoot);
    return workspaceRoot === null ? { kind: "projectless" } : { kind: "local", workspaceRoot };
  }

  if (selection.kind === "remote") {
    const hostId = selection.hostId.trim();
    const projectId = selection.projectId.trim();
    const remotePath = normalizeOptionalPath(selection.remotePath);
    if (hostId.length === 0 || projectId.length === 0 || remotePath === null) {
      return { kind: "projectless" };
    }
    return {
      kind: "remote",
      hostId,
      projectId,
      remotePath,
    };
  }

  return { kind: "projectless" };
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

function getPermissionIcon(value: HotkeyPermissionOptionValue) {
  if (value === "guardian-approvals") {
    return <GuardianApprovalsIcon className="h-4 w-4 text-[var(--app-shell-accent)]" />;
  }
  if (value === "full-access") {
    return <FullAccessPermissionsIcon className="h-4 w-4 text-[var(--app-shell-warning-text)]" />;
  }
  if (value === "custom") {
    return <SettingsCogIcon className="h-4 w-4" />;
  }
  return <DefaultPermissionsIcon className="h-4 w-4" />;
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

function sanitizeTooltipText(value: string) {
  return value.replace(/<\/?link>/gu, "");
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

function useFloatingWindowPointerInteractivity({
  floatingElementSelectors = [],
  includeInteractiveRegion = false,
  interactiveRegionRef,
  onInteractiveChange,
}: {
  floatingElementSelectors?: string[];
  includeInteractiveRegion?: boolean;
  interactiveRegionRef: RefObject<HTMLElement | null>;
  onInteractiveChange: (isInteractive: boolean) => void;
}) {
  const [pointerInteractionPaused, setPointerInteractionPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let lastInteractive: boolean | null = null;
    let lastPointerPoint: { x: number; y: number } | null = null;
    let pendingPointerPoint: { x: number; y: number } | null = null;
    let pendingFrame: number | null = null;

    const emitInteractiveChange = (isInteractive: boolean) => {
      if (lastInteractive === isInteractive) {
        return;
      }
      lastInteractive = isInteractive;
      setPointerInteractionPaused(!isInteractive);
      onInteractiveChange(isInteractive);
    };

    const isPointInsideElement = (point: { x: number; y: number }, element: Element) => {
      const rect = element.getBoundingClientRect();
      if (
        point.x < rect.left ||
        point.x > rect.right ||
        point.y < rect.top ||
        point.y > rect.bottom
      ) {
        return false;
      }
      return document.elementsFromPoint(point.x, point.y).some((candidate) =>
        candidate === element || element.contains(candidate),
      );
    };

    const isVisibleElement = (element: Element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const styles = window.getComputedStyle(element);
      if (
        styles.display === "none" ||
        styles.visibility === "hidden" ||
        styles.pointerEvents === "none"
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const resolveInteractive = (point: { x: number; y: number }) => {
      const interactiveRegion = interactiveRegionRef.current;
      if (
        interactiveRegion !== null &&
        includeInteractiveRegion &&
        isPointInsideElement(point, interactiveRegion)
      ) {
        return true;
      }

      for (const selector of floatingElementSelectors) {
        const floatingElements = document.querySelectorAll(selector);
        for (const floatingElement of floatingElements) {
          if (isVisibleElement(floatingElement) && isPointInsideElement(point, floatingElement)) {
            return true;
          }
        }
      }

      return false;
    };

    const reevaluate = () => {
      pendingFrame = null;
      const nextPoint = pendingPointerPoint;
      if (nextPoint === null) {
        return;
      }
      lastPointerPoint = nextPoint;
      emitInteractiveChange(resolveInteractive(nextPoint));
    };

    const requestReevaluation = () => {
      if (pendingFrame !== null) {
        return;
      }
      pendingFrame = window.requestAnimationFrame(reevaluate);
    };

    const handleMouseMove = (event: MouseEvent) => {
      pendingPointerPoint = { x: event.clientX, y: event.clientY };
      requestReevaluation();
    };

    const handleViewportChange = () => {
      if (lastPointerPoint === null) {
        return;
      }
      pendingPointerPoint = lastPointerPoint;
      requestReevaluation();
    };

    const handleMouseLeave = () => {
      emitInteractiveChange(false);
    };

    const observer = new MutationObserver(handleViewportChange);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("mouseleave", handleMouseLeave);
    observer.observe(document.body, {
      attributeFilter: ["aria-hidden", "class", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      if (pendingFrame !== null) {
        window.cancelAnimationFrame(pendingFrame);
      }
      onInteractiveChange(true);
    };
  }, [floatingElementSelectors, includeInteractiveRegion, interactiveRegionRef, onInteractiveChange]);

  return pointerInteractionPaused;
}

async function dismissHotkeyWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch {
    // Ignore dismiss failures in non-Tauri contexts.
  }
}
