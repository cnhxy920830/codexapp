import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MoreActionsIcon, SettingsCogIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { SettingsChoiceMenu } from "../../components/SettingsChoiceMenu";
import { useI18n } from "../../i18n/i18n";
import type { PendingWorktreeStartingState } from "../../services/pendingWorktrees";
import type { TurnStartPermissionOverrides } from "../../services/history";
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
import { HotkeyBranchSwitcherControl } from "./HotkeyBranchSwitcherControl";
import { HotkeyWorktreeBranchControl } from "./HotkeyWorktreeBranchControl";
import { HotkeyWindowProjectMenuControl } from "./HotkeyWindowProjectMenuControl";
import {
  buildTurnStartPermissionOverrides,
  getVisibleHotkeyPermissionOptions,
  getHotkeyPermissionOptionValue,
  getNextAgentModeFromOption,
  isDefaultPermissionsMode,
  resolveHotkeyPermissionsState,
  type HotkeyPermissionAgentMode,
  type HotkeyPermissionOptionValue,
} from "./hotkeyPermissionsMode";
import { useReplicaStatsigDefaultFeatures } from "../statsig/replicaStatsig";

const appWindow = getCurrentWindow();
const HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE = "data-hotkey-window-home-composer-menu-open";

type HotkeyWindowHomeMode = "local" | "cloud" | "worktree";
export function HotkeyWindowHomePage({
  codexHome,
  composerEnterBehavior,
  initialWorkspaceRoot,
  onOpenLocalEnvironmentsSettings,
  onStartCloudConversation,
  onStartLocalConversation,
  onStartWorktreeConversation,
}: {
  codexHome: string | null;
  composerEnterBehavior: "enter" | "cmdIfMultiline";
  initialWorkspaceRoot: string | null;
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);
  const [isShellHovered, setIsShellHovered] = useState(false);
  const [isShellFocused, setIsShellFocused] = useState(false);
  const [selectedWorkspaceRoot, setSelectedWorkspaceRoot] = useState<string | null>(
    normalizeOptionalPath(initialWorkspaceRoot),
  );
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
  const [isFullAccessConfirmOpen, setIsFullAccessConfirmOpen] = useState(false);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const defaultFeatures = useReplicaStatsigDefaultFeatures();
  const permissionsVisibility = useMemo(() => readComposerPermissionModeVisibility(), []);

  useEffect(() => {
    textareaRef.current?.focus();
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
        const matchingOrigin = response.origins.find((origin) => areSamePath(origin.dir, selectedWorkspaceRoot));
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
  }, [selectedWorkspaceRoot]);

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

  const isProjectless = selectedWorkspaceRoot === null;
  const hasGitRepo = selectedWorkspaceRoot !== null && gitRoot !== null;
  const cloudAllowed = hasGitRepo;
  const worktreeAllowed =
    selectedWorkspaceRoot !== null &&
    gitRoot !== null &&
    !isWithinCodexWorktrees(selectedWorkspaceRoot, codexHome);
  const worktreeDisabledTooltipText =
    hasGitRepo && !worktreeAllowed
      ? t("composer.hotkeyWindow.modeDropdown.localOnly")
      : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsPermissionsLoading(true);

    void Promise.allSettled([
      readConfigForHost({
        hostId: null,
        cwd: selectedWorkspaceRoot,
        includeLayers: false,
      }),
      getConfigRequirementsForHost({ hostId: null }),
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
  }, [selectedWorkspaceRoot]);

  useEffect(() => {
    setStartingState({ type: "working-tree" });
  }, [gitRoot]);

  useEffect(() => {
    if ((mode === "cloud" && !cloudAllowed) || (mode === "worktree" && !worktreeAllowed)) {
      setMode("local");
    }
  }, [cloudAllowed, mode, worktreeAllowed]);

  useEffect(() => {
    if (isTaskMenuOpen) {
      document.body.setAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE, "true");
      return () => {
        document.body.removeAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE);
      };
    }

    document.body.removeAttribute(HOTKEY_WINDOW_HOME_MENU_BODY_ATTRIBUTE);
    return undefined;
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

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isTaskMenuOpen]);

  const isPointerInteractive = isTaskMenuOpen || isShellHovered || isShellFocused;

  useEffect(() => {
    void invoke("hotkey-window-home-pointer-interaction-changed", {
      params: {
        isInteractive: isPointerInteractive,
      },
    }).catch(() => undefined);

    return () => {
      void invoke("hotkey-window-home-pointer-interaction-changed", {
        params: {
          isInteractive: true,
        },
      }).catch(() => undefined);
    };
  }, [isPointerInteractive]);

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

      void appWindow.hide().catch(() => undefined);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTaskMenuOpen]);

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

  const selectedProjectPlaceholderLabel =
    getLocalEnvironmentProjectName(selectedWorkspaceRoot) ??
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
        ...(permissionsConfig?.features ?? {}),
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

  const permissionOptions = useMemo(() => {
    const options: Array<{
      disabled?: boolean;
      label: string;
      title?: string;
      value: HotkeyPermissionOptionValue;
    }> = [];

    for (const option of getVisibleHotkeyPermissionOptions(permissionsState)) {
      switch (option.value) {
        case "default":
          options.push({
            disabled: option.disabled,
            label: t("composer.permissionsDropdown.default.optionLabel"),
            value: option.value,
          });
          break;
        case "guardian-approvals":
          options.push({
            disabled: option.disabled,
            label: t("composer.mode.agentMode.guardianApprovals"),
            title: option.disabled
              ? t("composer.permissionsDropdown.guardianApproval.disabled")
              : t("composer.permissionsDropdown.guardianApproval.tooltip"),
            value: option.value,
          });
          break;
        case "full-access":
          options.push({
            disabled: option.disabled,
            label: t("composer.permissionsDropdown.fullAccess.optionLabel"),
            title: option.disabled
              ? permissionsState.fullAccessDisabledReason === "global-default"
                ? t("composer.permissionsDropdown.fullAccess.disabledGlobalDefault")
                : t("composer.permissionsDropdown.fullAccess.disabled")
              : t("composer.permissionsDropdown.agentMode.tooltip.fullAccess"),
            value: option.value,
          });
          break;
        case "custom":
          options.push({
            disabled: option.disabled,
            label: t("composer.permissionsDropdown.custom.optionLabel"),
            title: t("composer.permissionsDropdown.agentMode.tooltip.custom"),
            value: option.value,
          });
          break;
      }
    }

    return options;
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
        workspaceRoots: selectedWorkspaceRoot === null ? [] : [selectedWorkspaceRoot],
      }),
    [
      currentPermissionMode,
      permissionsConfigWithStatsigFeatures,
      selectedWorkspaceRoot,
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
      if (mode === "worktree" && selectedWorkspaceRoot !== null && worktreeAllowed) {
        await onStartWorktreeConversation({
          id: `local:pending-${crypto.randomUUID()}`,
          localEnvironmentConfigPath: selectedEnvironmentConfigPath,
          permissionOverrides,
          prompt: nextDraft,
          startingState,
          workspaceRoot: selectedWorkspaceRoot,
        });
      } else if (mode === "cloud" && selectedWorkspaceRoot !== null && cloudAllowed) {
        await onStartCloudConversation({
          draft: nextDraft,
          permissionOverrides,
          workspaceRoot: selectedWorkspaceRoot,
        });
      } else {
        await onStartLocalConversation({
          draft: nextDraft,
          permissionOverrides,
          workspaceRoot: selectedWorkspaceRoot,
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

  return (
    <main aria-label={t("threadPage.newThread")} className="h-full bg-transparent" role="main">
      <div className="hotkey-window-home relative flex h-full w-full items-end overflow-hidden bg-transparent p-1 pointer-events-none">
        <div
          ref={shellRef}
          className="hotkey-window-home-shell pointer-events-auto relative w-full px-[15px] pt-[17px] pb-[13px]"
          onBlurCapture={() => {
            requestAnimationFrame(() => {
              setIsShellFocused(shellRef.current?.contains(document.activeElement) ?? false);
            });
          }}
          onFocusCapture={() => setIsShellFocused(true)}
          onMouseEnter={() => setIsShellHovered(true)}
          onMouseLeave={() => setIsShellHovered(false)}
        >
          <div aria-hidden="true" className="hotkey-window-home-underlay" />
          <div className="hotkey-window-home-composer-surface no-drag relative overflow-hidden rounded-[22px]">
            <div className="px-4 pt-4 pb-3">
              <textarea
                ref={textareaRef}
                aria-label={placeholderText}
                className="app-text-input min-h-[112px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) {
                    return;
                  }

                  const hasMultilineContent = draft.includes("\n");
                  if (composerEnterBehavior === "enter" || !hasMultilineContent) {
                    event.preventDefault();
                    void submitDraft();
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
                  className={[
                    error ? "app-text-error" : "app-text-subtle",
                    "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5",
                  ].join(" ")}
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
                    onClick={() => setIsTaskMenuOpen((open) => !open)}
                  >
                    <MoreActionsIcon className="icon-xs" />
                  </Button>
                  {isTaskMenuOpen ? (
                    <div className="app-card absolute right-0 bottom-[calc(100%+10px)] z-20 min-w-[320px] rounded-[24px] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      <div className="flex flex-col gap-4">
                        <TaskMenuRow
                          control={
                            <HotkeyWindowProjectMenuControl
                              codexHome={codexHome}
                              initialWorkspaceRoot={initialWorkspaceRoot}
                              onSelectedWorkspaceRootChange={setSelectedWorkspaceRoot}
                            />
                          }
                          label={t("hotkeyWindow.home.taskMenu.project")}
                        />

                        <TaskMenuRow
                          control={
                            <div title={modeDisabledTooltipText ?? undefined}>
                              <SettingsChoiceMenu
                                disabled={modeDisabledTooltipText !== null}
                                onChange={(value) => {
                                  if (
                                    value === "local" ||
                                    value === "cloud" ||
                                    value === "worktree"
                                  ) {
                                    setMode(value);
                                  }
                                }}
                                options={[
                                  {
                                    label: t("composer.mode.local"),
                                    value: "local",
                                  },
                                  {
                                    label: t("composer.footer.v2.cloudTab"),
                                    value: "cloud",
                                  },
                                  {
                                    label: t("composer.mode.worktreeSegment"),
                                    disabled: !worktreeAllowed,
                                    title: worktreeDisabledTooltipText,
                                    value: "worktree",
                                  },
                                ]}
                                value={mode}
                              />
                            </div>
                          }
                          label={t("hotkeyWindow.home.taskMenu.startIn")}
                        />

                        {mode === "worktree" ? (
                          <TaskMenuRow
                            control={
                              <div className="flex items-center gap-2">
                                {environmentOptions.length > 0 ? (
                                  <SettingsChoiceMenu
                                    disabled={false}
                                    onChange={(value) => setSelectedEnvironmentConfigPath(value)}
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
                                      localEnvironments[0]?.configPath ??
                                      ""
                                    }
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="app-control rounded-[10px] px-3 py-2 text-[13px]"
                                    onClick={() => {
                                      if (selectedWorkspaceRoot !== null) {
                                        onOpenLocalEnvironmentsSettings({
                                          configPath: null,
                                          workspaceRoot: selectedWorkspaceRoot,
                                        });
                                      }
                                    }}
                                  >
                                    {t("settings.localEnvironments.environment.create")}
                                  </button>
                                )}
                                <Button
                                  aria-label={t("settings.nav.local-environments")}
                                  color="ghost"
                                  size="composer"
                                  uniform
                                  onClick={() => {
                                    if (selectedWorkspaceRoot !== null) {
                                      onOpenLocalEnvironmentsSettings({
                                        configPath: selectedEnvironmentConfigPath,
                                        workspaceRoot: selectedWorkspaceRoot,
                                      });
                                    }
                                  }}
                                >
                                  <SettingsCogIcon className="icon-xs" />
                                </Button>
                              </div>
                            }
                            label={t("hotkeyWindow.home.taskMenu.environment")}
                          />
                        ) : null}

                        {mode === "worktree" ? (
                          <TaskMenuRow
                            control={
                              gitRoot === null ? null : (
                                <HotkeyWorktreeBranchControl
                                  gitRoot={gitRoot}
                                  onStartingStateChange={setStartingState}
                                  startingState={startingState}
                                />
                              )
                            }
                            label={t("hotkeyWindow.home.taskMenu.branch")}
                          />
                        ) : gitRoot !== null ? (
                          <TaskMenuRow
                            control={<HotkeyBranchSwitcherControl gitRoot={gitRoot} />}
                            label={t("hotkeyWindow.home.taskMenu.branch")}
                          />
                        ) : null}

                        {mode === "cloud" ? null : (
                          <TaskMenuRow
                            control={
                              <SettingsChoiceMenu
                                disabled={
                                  isPermissionsLoading || permissionsState.isDropdownDisabled
                                }
                                onChange={handlePermissionOptionChange}
                                options={permissionOptions}
                                triggerLabel={permissionTriggerLabel}
                                value={permissionMenuValue}
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
                    onClick={() => void submitDraft()}
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
                    onClick={() => setIsFullAccessConfirmOpen(false)}
                    className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                  >
                    {t("composer.mode.agentMode.fullAccessConfirm.goBack")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPermissionMode("full-access");
                      setIsFullAccessConfirmOpen(false);
                    }}
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "";
}
