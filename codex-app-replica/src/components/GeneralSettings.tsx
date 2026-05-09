import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type ComposerEnterBehavior,
  DEFAULT_GENERAL_SETTINGS,
  type FollowUpQueueMode,
  readGeneralSettingsSnapshot,
  readTerminalShellOptions,
  readWslBashAvailability,
  type IntegratedTerminalShell,
  resolveLocalePreference,
  type ReviewDelivery,
  setGlobalState,
  type GeneralSettingsSnapshot,
  type GlobalStateKey,
} from "../services/settings";
import {
  detectExternalAgentImports,
  importExternalAgentItems,
  readExternalAgentImportStatus,
  type ExternalAgentImportItem,
  type ExternalAgentImportStatusResponse,
} from "../services/externalAgentImport";
import {
  readOpenInTargets,
  setPreferredApp,
  type OpenInTargetsResponse,
} from "../services/openTargets";
import { readSkillsSnapshot } from "../services/skills";
import { useI18n } from "../i18n/i18n";
import {
  SUPPORTED_LOCALES,
  getLocaleLabel,
  type LocaleCode,
  type MessageKey,
} from "../i18n/messages";
import { CheckIcon, ChevronDownIcon } from "./AppShellIcons";
import { ToggleSwitch } from "./ToggleSwitch";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import type { AppToast } from "./AppToastRegion";

const INVERT_FOLLOW_UP_SHORTCUT_LABEL = "Ctrl+Enter";
const COMPOSER_MODIFIER_SYMBOL = "Ctrl";
const LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID = "local";
const EXTERNAL_AGENT_IMPORT_PROVIDERS = ["claude-code"] as const;
const MIGRATE_TO_CODEX_SKILL_NAME = "migrate-to-codex";
const TERMINAL_SHELL_LABELS: Record<IntegratedTerminalShell, string> = {
  powershell: "PowerShell",
  commandPrompt: "Command Prompt",
  gitBash: "Git Bash",
  wsl: "WSL",
};

type AgentEnvironmentValue = "windows" | "wsl";
type RemainingArtifactKind = "commands" | "hooks" | "mcp" | "plugins" | "subagents";
type RemainingArtifactScope = "user" | "project";

type RemainingArtifact = {
  count?: number;
  cwd: string | null;
  id: string;
  kind: RemainingArtifactKind;
  path: string;
  scope: RemainingArtifactScope;
};

type ExternalImportProgress = {
  importedItems: ExternalAgentImportItem[];
  remainingArtifacts: RemainingArtifact[];
};

export function GeneralSettings({
  codexHome,
  workspaceRoot,
  onComposerEnterBehaviorChange,
  onFollowUpQueueModeChange,
  onReviewDeliveryChange,
  onOpenChatWithPrompt,
  onShowToast,
}: {
  codexHome?: string | null;
  workspaceRoot?: string | null;
  onComposerEnterBehaviorChange?: (value: ComposerEnterBehavior) => void;
  onFollowUpQueueModeChange?: (value: FollowUpQueueMode) => void;
  onReviewDeliveryChange?: (value: ReviewDelivery) => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { locale, setLocale, t } = useI18n();
  const [state, setState] = useState<GeneralSettingsSnapshot>(DEFAULT_GENERAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isOpenTargetMenuOpen, setIsOpenTargetMenuOpen] = useState(false);
  const [isTerminalShellMenuOpen, setIsTerminalShellMenuOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [openTargets, setOpenTargets] = useState<OpenInTargetsResponse | null>(null);
  const [availableTerminalShells, setAvailableTerminalShells] = useState<IntegratedTerminalShell[]>([]);
  const [agentEnvironmentError, setAgentEnvironmentError] = useState<string | null>(null);
  const [isCheckingWslAvailability, setIsCheckingWslAvailability] = useState(false);
  const [detectedExternalImportItems, setDetectedExternalImportItems] = useState<ExternalAgentImportItem[]>([]);
  const [externalImportStatus, setExternalImportStatus] = useState<ExternalAgentImportStatusResponse | null>(null);
  const [isDetectingExternalImports, setIsDetectingExternalImports] = useState(true);
  const [isImportingExternalItems, setIsImportingExternalItems] = useState(false);
  const [isContinuingWithCodex, setIsContinuingWithCodex] = useState(false);
  const [isExternalImportDialogOpen, setIsExternalImportDialogOpen] = useState(false);
  const [isImportedFilesDialogOpen, setIsImportedFilesDialogOpen] = useState(false);
  const [isRemainingArtifactsDialogOpen, setIsRemainingArtifactsDialogOpen] = useState(false);
  const [externalImportDialogError, setExternalImportDialogError] = useState<string | null>(null);
  const [selectedExternalImportItemKeys, setSelectedExternalImportItemKeys] = useState<Record<string, boolean>>({});
  const [lastCompletedImportProgress, setLastCompletedImportProgress] = useState<ExternalImportProgress | null>(null);
  const [sessionLatestImportedAtMs, setSessionLatestImportedAtMs] = useState<number | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const openTargetMenuRef = useRef<HTMLDivElement | null>(null);
  const terminalShellMenuRef = useRef<HTMLDivElement | null>(null);
  const initialAgentEnvironmentRef = useRef<boolean | null>(null);
  const isWindowsPlatform =
    typeof navigator === "undefined" ? true : navigator.userAgent.includes("Windows");
  const showDefaultOpenTargetSetting = isWindowsPlatform;
  const showIntegratedTerminalShellSetting = isWindowsPlatform;
  const showAgentEnvironmentSetting =
    isWindowsPlatform && availableTerminalShells.includes("wsl");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [snapshotResult, terminalShellOptionsResult, openTargetsResult] =
          await Promise.allSettled([
            readGeneralSettingsSnapshot(),
            readTerminalShellOptions(),
            showDefaultOpenTargetSetting ? readOpenInTargets({ cwd: null }) : Promise.resolve(null),
          ]);
        if (cancelled) {
          return;
        }

        if (snapshotResult.status !== "fulfilled") {
          throw snapshotResult.reason;
        }

        setState(snapshotResult.value);
        if (initialAgentEnvironmentRef.current === null) {
          initialAgentEnvironmentRef.current =
            snapshotResult.value.runCodexInWindowsSubsystemForLinux;
        }
        setAvailableTerminalShells(
          terminalShellOptionsResult.status === "fulfilled"
            ? terminalShellOptionsResult.value.availableShells
            : [],
        );
        setOpenTargets(
          openTargetsResult.status === "fulfilled" ? openTargetsResult.value : null,
        );
        const nonBlockingError =
          terminalShellOptionsResult.status === "rejected"
            ? terminalShellOptionsResult.reason
            : openTargetsResult.status === "rejected"
              ? openTargetsResult.reason
              : null;
        setError(
          nonBlockingError == null
            ? null
            : nonBlockingError instanceof Error
              ? nonBlockingError.message
              : String(nonBlockingError),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [showDefaultOpenTargetSetting]);

  useEffect(() => {
    let cancelled = false;

    const loadExternalImports = async () => {
      setIsDetectingExternalImports(true);

      const [detectResult, statusResult] = await Promise.allSettled([
        detectExternalAgentImports({
          hostId: LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID,
          includeHome: true,
          providers: [...EXTERNAL_AGENT_IMPORT_PROVIDERS],
          workspaceRoots: workspaceRoot ? [workspaceRoot] : null,
        }),
        readExternalAgentImportStatus({
          hostId: LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID,
          providers: [...EXTERNAL_AGENT_IMPORT_PROVIDERS],
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (detectResult.status === "fulfilled") {
        setDetectedExternalImportItems(detectResult.value.items);
      } else {
        setDetectedExternalImportItems([]);
      }

      if (statusResult.status === "fulfilled") {
        setExternalImportStatus(statusResult.value);
      } else {
        setExternalImportStatus(null);
      }

      if (detectResult.status === "rejected" && statusResult.status === "rejected") {
        setError((current) =>
          current ??
          (detectResult.reason instanceof Error
            ? detectResult.reason.message
            : String(detectResult.reason)),
        );
      }

      setIsDetectingExternalImports(false);
    };

    void loadExternalImports();

    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  useEffect(() => {
    if (!isLanguageMenuOpen && !isOpenTargetMenuOpen && !isTerminalShellMenuOpen) {
      setLanguageSearch("");
      return;
    }
    if (!isLanguageMenuOpen) {
      setLanguageSearch("");
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (languageMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      if (openTargetMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      if (terminalShellMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsLanguageMenuOpen(false);
      setIsOpenTargetMenuOpen(false);
      setIsTerminalShellMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isLanguageMenuOpen, isOpenTargetMenuOpen, isTerminalShellMenuOpen]);

  const persistChoice = async (
    field: "composerEnterBehavior" | "followUpQueueMode" | "reviewDelivery",
    key: GlobalStateKey,
    value: ComposerEnterBehavior | FollowUpQueueMode | ReviewDelivery,
  ) => {
    const previousState = state;
    setState((current) => ({ ...current, [field]: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
      if (field === "composerEnterBehavior") {
        onComposerEnterBehaviorChange?.(value as ComposerEnterBehavior);
      }
      if (field === "followUpQueueMode") {
        onFollowUpQueueModeChange?.(value as FollowUpQueueMode);
      }
      if (field === "reviewDelivery") {
        onReviewDeliveryChange?.(value as ReviewDelivery);
      }
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistLocale = async (value: string) => {
    const nextValue = value === "auto" ? null : value;
    const previousState = state;
    setState((current) => ({ ...current, localeOverride: nextValue }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("localeOverride", nextValue);
      setLocale(resolveLocalePreference(nextValue));
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistIntegratedTerminalShell = async (value: IntegratedTerminalShell) => {
    const previousState = state;
    setState((current) => ({ ...current, integratedTerminalShell: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("integratedTerminalShell", value);
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistPreferredOpenTarget = async (value: string) => {
    const previousTargets = openTargets;
    setOpenTargets((current) => {
      if (current == null) {
        return current;
      }
      return {
        ...current,
        preferredTarget: value,
        targets: current.targets.map((target) => ({
          ...target,
          default: target.target === value,
        })),
      };
    });
    setError(null);
    setIsSaving(true);
    try {
      await setPreferredApp(value);
    } catch (err) {
      setOpenTargets(previousTargets);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistAgentEnvironment = async (value: AgentEnvironmentValue) => {
    const nextUseWsl = value === "wsl";
    if (nextUseWsl === state.runCodexInWindowsSubsystemForLinux) {
      return;
    }

    setAgentEnvironmentError(null);
    setError(null);
    setIsCheckingWslAvailability(nextUseWsl);
    setIsSaving(true);

    try {
      if (nextUseWsl) {
        let availability;
        try {
          availability = await readWslBashAvailability();
        } catch {
          const distributionName = t(
            "settings.agentEnvironment.wslBashError.unknownDistribution",
          );
          setAgentEnvironmentError(
            t("settings.agentEnvironment.wslBashError", { distributionName }),
          );
          return;
        }

        if (!availability.available) {
          const distributionName =
            availability.distro ??
            t("settings.agentEnvironment.wslBashError.unknownDistribution");
          setAgentEnvironmentError(
            t("settings.agentEnvironment.wslBashError", { distributionName }),
          );
          return;
        }
      }

      const previousState = state;
      setState((current) => ({
        ...current,
        runCodexInWindowsSubsystemForLinux: nextUseWsl,
      }));
      try {
        await setGlobalState("runCodexInWindowsSubsystemForLinux", nextUseWsl);
      } catch (err) {
        setState(previousState);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCheckingWslAvailability(false);
      setIsSaving(false);
    }
  };

  const localeEntries = SUPPORTED_LOCALES.filter(
    (entry): entry is LocaleCode => entry !== "auto",
  ).map((entry) => {
    const nativeLabel = getLocaleLabel(entry, entry);
    const localizedLabel = getLocaleLabel(entry, locale);
    const searchText = `${nativeLabel} ${localizedLabel} ${entry}`.toLowerCase();
    return {
      code: entry,
      nativeLabel,
      localizedLabel,
      searchText,
    };
  });

  const selectedLocaleLabel =
    state.localeOverride == null
      ? t("settings.ide.language.auto")
      : localeEntries.find((entry) => entry.code === state.localeOverride)?.nativeLabel ??
        state.localeOverride;

  const normalizedLanguageSearch = languageSearch.trim().toLowerCase();
  const filteredLocaleEntries =
    normalizedLanguageSearch.length === 0
      ? localeEntries
      : localeEntries.filter((entry) =>
          entry.searchText.includes(normalizedLanguageSearch),
        );
  const selectedIntegratedTerminalShell =
    availableTerminalShells.find(
      (shell) => shell === state.integratedTerminalShell,
    ) ??
    availableTerminalShells[0] ??
    null;
  const selectedIntegratedTerminalShellLabel =
    selectedIntegratedTerminalShell == null
      ? t("settings.openIn.integratedTerminalShell.unavailable")
      : TERMINAL_SHELL_LABELS[selectedIntegratedTerminalShell];
  const availableOpenTargets =
    openTargets?.targets.filter((target) => target.available !== false) ?? [];
  const selectedOpenTargetValue =
    openTargets?.preferredTarget ??
    availableOpenTargets.find((target) => target.default)?.target ??
    null;
  const selectedOpenTarget =
    availableOpenTargets.find((target) => target.target === selectedOpenTargetValue) ??
    null;

  const agentEnvironmentOptions = useMemo(
    () => [
      {
        value: "windows",
        label: t("settings.agentEnvironment.windowsNative"),
        description: t("settings.agentEnvironment.windowsNative.description"),
      },
      {
        value: "wsl",
        label: t("settings.agentEnvironment.wsl"),
        description: t("settings.agentEnvironment.wsl.description"),
      },
    ],
    [t],
  );
  const selectedAgentEnvironmentValue: AgentEnvironmentValue =
    state.runCodexInWindowsSubsystemForLinux ? "wsl" : "windows";
  const startupAgentEnvironmentValue: AgentEnvironmentValue =
    initialAgentEnvironmentRef.current === true ? "wsl" : "windows";
  const shouldShowAgentEnvironmentRestartNotice =
    initialAgentEnvironmentRef.current !== null &&
    initialAgentEnvironmentRef.current !==
      state.runCodexInWindowsSubsystemForLinux;

  const remainingArtifacts = useMemo(
    () => buildRemainingArtifacts(detectedExternalImportItems, codexHome ?? null),
    [codexHome, detectedExternalImportItems],
  );
  const hasImportChoices = detectedExternalImportItems.length > 0;
  const hasRemainingArtifacts = remainingArtifacts.length > 0;
  const hasActionableExternalImportWork = hasImportChoices || hasRemainingArtifacts;
  const hasPriorExternalImport =
    (externalImportStatus?.latestImportedAtMs ?? null) != null ||
    sessionLatestImportedAtMs != null;
  const effectiveLatestImportedAtMs = maxTimestamp(
    externalImportStatus?.latestImportedAtMs ?? null,
    sessionLatestImportedAtMs,
  );
  const shouldRenderExternalImportRow =
    isDetectingExternalImports ||
    hasActionableExternalImportWork ||
    hasPriorExternalImport ||
    lastCompletedImportProgress != null;
  const shouldOpenCompletedImportDialog =
    !hasActionableExternalImportWork && lastCompletedImportProgress != null;
  const shouldOpenRemainingArtifactsDialog =
    (hasPriorExternalImport && hasRemainingArtifacts) || !hasImportChoices;
  const selectedExternalImportItems = detectedExternalImportItems.filter((item) =>
    selectedExternalImportItemKeys[getExternalImportItemKey(item)] ?? false,
  );
  const externalImportButtonLabel = getExternalImportButtonLabel({
    hasImportChoices,
    hasPriorExternalImport,
    hasRemainingArtifacts,
    isDetectingExternalImports,
    isImportingExternalItems,
    t,
  });
  const isExternalImportButtonDisabled =
    isDetectingExternalImports ||
    isImportingExternalItems ||
    (!hasActionableExternalImportWork &&
      (!hasPriorExternalImport || lastCompletedImportProgress == null));

  const handleOpenExternalImportDialog = () => {
    setExternalImportDialogError(null);
    setSelectedExternalImportItemKeys(
      Object.fromEntries(
        detectedExternalImportItems.map((item) => [getExternalImportItemKey(item), true]),
      ),
    );
    setIsExternalImportDialogOpen(true);
  };

  const refreshExternalImportState = async () => {
    const [detectResult, statusResult] = await Promise.allSettled([
      detectExternalAgentImports({
        hostId: LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID,
        includeHome: true,
        providers: [...EXTERNAL_AGENT_IMPORT_PROVIDERS],
        workspaceRoots: workspaceRoot ? [workspaceRoot] : null,
      }),
      readExternalAgentImportStatus({
        hostId: LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID,
        providers: [...EXTERNAL_AGENT_IMPORT_PROVIDERS],
      }),
    ]);

    if (detectResult.status === "fulfilled") {
      setDetectedExternalImportItems(detectResult.value.items);
    }
    if (statusResult.status === "fulfilled") {
      setExternalImportStatus(statusResult.value);
    }

    return detectResult.status === "fulfilled" ? detectResult.value.items : [];
  };

  const handleConfirmExternalImport = async () => {
    if (selectedExternalImportItems.length === 0) {
      return;
    }

    setExternalImportDialogError(null);
    setIsImportingExternalItems(true);
    onShowToast?.({
      message: t("settings.agent.importSettings.toast.importing"),
      tone: "info",
    });
    try {
      await importExternalAgentItems({
        hostId: LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID,
        items: selectedExternalImportItems,
      });

      const refreshedItems = await refreshExternalImportState();
      const nextRemainingArtifacts = buildRemainingArtifacts(
        refreshedItems,
        codexHome ?? null,
      );
      setLastCompletedImportProgress({
        importedItems: selectedExternalImportItems,
        remainingArtifacts: nextRemainingArtifacts,
      });
      setSessionLatestImportedAtMs(Date.now());
      setIsExternalImportDialogOpen(false);
      setIsImportedFilesDialogOpen(nextRemainingArtifacts.length > 0);
      onShowToast?.({
        message: t("settings.agent.importSettings.toast.success"),
        tone: "success",
      });
    } catch {
      setExternalImportDialogError(t("externalAgentConfig.projectImport.error"));
      onShowToast?.({
        message: t("settings.agent.importSettings.toast.error"),
        tone: "error",
      });
    } finally {
      setIsImportingExternalItems(false);
    }
  };

  const handleContinueWithCodex = async (
    artifacts: RemainingArtifact[] = remainingArtifacts,
  ) => {
    if (artifacts.length === 0) {
      return;
    }

    setIsContinuingWithCodex(true);
    try {
      const migrateSkillPath = await resolveMigrateToCodexSkillPath(
        workspaceRoot ?? null,
        codexHome ?? null,
      );
      if (migrateSkillPath == null) {
        throw new Error("Missing migrate-to-codex skill path");
      }

      onOpenChatWithPrompt?.(
        buildMigrateToCodexPrompt(artifacts, migrateSkillPath),
      );
      setIsImportedFilesDialogOpen(false);
      setIsRemainingArtifactsDialogOpen(false);
    } catch {
      onShowToast?.({
        message: t("settings.general.importExternalAgent.continueWithCodex"),
        description: t("externalAgentConfig.projectImport.error"),
        tone: "error",
      });
    } finally {
      setIsContinuingWithCodex(false);
    }
  };

  const handleExternalImportButtonClick = () => {
    if (shouldOpenCompletedImportDialog) {
      setIsImportedFilesDialogOpen(true);
      return;
    }
    if (shouldOpenRemainingArtifactsDialog) {
      setIsRemainingArtifactsDialogOpen(true);
      return;
    }
    handleOpenExternalImportDialog();
  };

  const agentEnvironmentDescription = (
    <>
      <span>{t("settings.agentEnvironment.description")}</span>
      {shouldShowAgentEnvironmentRestartNotice ? (
        <span className="app-text-error block">
          {t("settings.agentEnvironment.restartNotice", {
            currentEnvironment:
              agentEnvironmentOptions.find(
                (option) => option.value === startupAgentEnvironmentValue,
              )?.label ?? "",
          })}
        </span>
      ) : null}
      {agentEnvironmentError ? (
        <span className="app-text-error block">{agentEnvironmentError}</span>
      ) : null}
    </>
  );

  const externalImportDescription =
    hasPriorExternalImport && effectiveLatestImportedAtMs != null
      ? t("settings.general.importExternalAgent.lastImported", {
          relativeTime: formatCompactRelativeTime(effectiveLatestImportedAtMs, t),
        })
      : t("settings.general.importExternalAgent.rowDescription");

  return (
    <>
      <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">
            {t("settings.section.general-settings")}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-4 text-[14px]">
            <SettingRow
              label={t("settings.ide.language.label")}
              description={t("settings.ide.language.description")}
            >
              <div className="relative w-[320px] max-w-full" ref={languageMenuRef}>
                <button
                  type="button"
                  disabled={isLoading || isSaving}
                  onClick={() => setIsLanguageMenuOpen((open) => !open)}
                  className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
                >
                  <span className="truncate text-left">{selectedLocaleLabel}</span>
                  <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                </button>
                {isLanguageMenuOpen ? (
                  <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                    <div className="pb-1">
                      <input
                        type="text"
                        value={languageSearch}
                        autoFocus
                        onChange={(event) => setLanguageSearch(event.target.value)}
                        placeholder={t("settings.ide.language.search")}
                        className="app-control w-full rounded-[10px] px-3 py-2 text-[13px]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setIsLanguageMenuOpen(false);
                        void persistLocale("auto");
                      }}
                      className={[
                        "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                        state.localeOverride == null
                          ? "app-nav-item-active"
                          : "app-nav-item-idle",
                      ].join(" ")}
                    >
                      <span>{t("settings.ide.language.autoOption")}</span>
                      {state.localeOverride == null ? (
                        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                      ) : null}
                    </button>
                    <div className="mt-1 max-h-80 overflow-y-auto">
                      {filteredLocaleEntries.map((entry) => {
                        const isSelected = entry.code === state.localeOverride;
                        return (
                          <button
                            key={entry.code}
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setIsLanguageMenuOpen(false);
                              void persistLocale(entry.code);
                            }}
                            className={[
                              "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                              isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                            ].join(" ")}
                          >
                            <span className="truncate">
                              {entry.nativeLabel}
                              {entry.localizedLabel === entry.nativeLabel
                                ? ""
                                : ` • ${entry.localizedLabel}`}
                            </span>
                            {isSelected ? (
                              <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </SettingRow>
            {showDefaultOpenTargetSetting ? (
              <SettingRow
                label={t("settings.ide.defaultOpenTarget.label")}
                description={t("settings.ide.defaultOpenTarget.description")}
              >
                <div className="relative w-[220px] max-w-full" ref={openTargetMenuRef}>
                  <button
                    type="button"
                    disabled={isLoading || isSaving || availableOpenTargets.length === 0}
                    onClick={() => setIsOpenTargetMenuOpen((open) => !open)}
                    className="app-control flex h-9 w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
                  >
                    {selectedOpenTarget ? (
                      <OpenTargetLabel
                        icon={selectedOpenTarget.icon}
                        label={selectedOpenTarget.label}
                      />
                    ) : (
                      <span className="truncate text-left">
                        {t("settings.ide.defaultOpenTarget.placeholder")}
                      </span>
                    )}
                    <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                  </button>
                  {isOpenTargetMenuOpen ? (
                    <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      <div className="max-h-80 overflow-y-auto">
                        {availableOpenTargets.map((target) => {
                          const isSelected = target.target === selectedOpenTargetValue;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setIsOpenTargetMenuOpen(false);
                                void persistPreferredOpenTarget(target.target);
                              }}
                              className={[
                                "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                                isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              <OpenTargetLabel icon={target.icon} label={target.label} />
                              {isSelected ? (
                                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </SettingRow>
            ) : null}
            {showAgentEnvironmentSetting ? (
              <SettingRow
                label={t("settings.agentEnvironment.label")}
                description={agentEnvironmentDescription}
              >
                <SettingsChoiceMenu
                  disabled={isLoading || isSaving || isCheckingWslAvailability}
                  options={agentEnvironmentOptions}
                  value={selectedAgentEnvironmentValue}
                  onChange={(value) =>
                    void persistAgentEnvironment(value as AgentEnvironmentValue)
                  }
                />
              </SettingRow>
            ) : null}
            {showIntegratedTerminalShellSetting ? (
              <SettingRow
                label={t("settings.openIn.integratedTerminalShell.label")}
                description={t("settings.openIn.integratedTerminalShell.description")}
              >
                <div className="relative w-[220px] max-w-full" ref={terminalShellMenuRef}>
                  <button
                    type="button"
                    disabled={isLoading || isSaving || availableTerminalShells.length === 0}
                    onClick={() => setIsTerminalShellMenuOpen((open) => !open)}
                    className="app-control flex h-9 w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
                  >
                    <span className="truncate text-left">
                      {selectedIntegratedTerminalShellLabel}
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                  </button>
                  {isTerminalShellMenuOpen ? (
                    <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                      <div className="max-h-80 overflow-y-auto">
                        {availableTerminalShells.map((shell) => {
                          const isSelected = shell === selectedIntegratedTerminalShell;
                          return (
                            <button
                              key={shell}
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setIsTerminalShellMenuOpen(false);
                                void persistIntegratedTerminalShell(shell);
                              }}
                              className={[
                                "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                                isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                              ].join(" ")}
                            >
                              <span className="truncate">
                                {TERMINAL_SHELL_LABELS[shell]}
                              </span>
                              {isSelected ? (
                                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </SettingRow>
            ) : null}
            {shouldRenderExternalImportRow ? (
              <SettingRow
                label={
                  hasPriorExternalImport
                    ? t("settings.general.importExternalAgent.importedRowLabel")
                    : t("settings.general.importExternalAgent.rowLabel")
                }
                description={externalImportDescription}
              >
                <button
                  type="button"
                  disabled={isExternalImportButtonDisabled}
                  onClick={handleExternalImportButtonClick}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {externalImportButtonLabel}
                </button>
              </SettingRow>
            ) : null}
            <SettingRow
              label={t("settings.general.enterBehavior.label", {
                modifierSymbol: COMPOSER_MODIFIER_SYMBOL,
              })}
              description={t("settings.general.enterBehavior.description", {
                modifierSymbol: COMPOSER_MODIFIER_SYMBOL,
              })}
            >
              <ToggleSwitch
                checked={state.composerEnterBehavior === "cmdIfMultiline"}
                disabled={isLoading || isSaving}
                ariaLabel={t("settings.general.enterBehavior.label", {
                  modifierSymbol: COMPOSER_MODIFIER_SYMBOL,
                })}
                onChange={(checked) =>
                  void persistChoice(
                    "composerEnterBehavior",
                    "composerEnterBehavior",
                    checked ? "cmdIfMultiline" : "enter",
                  )
                }
              />
            </SettingRow>
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-4 text-[14px]">
            <SettingRow
              label={t("settings.general.followUpQueueMode.label")}
              description={t("settings.general.followUpQueueMode.description", {
                invertFollowUpShortcutLabel: INVERT_FOLLOW_UP_SHORTCUT_LABEL,
              })}
            >
              <SegmentedControl
                value={state.followUpQueueMode}
                disabled={isLoading || isSaving}
                options={[
                  { value: "queue", label: t("settings.general.followUpQueueMode.queue") },
                  {
                    value: "steer",
                    label: t("settings.general.followUpQueueMode.interrupt"),
                  },
                ]}
                onChange={(value) =>
                  void persistChoice(
                    "followUpQueueMode",
                    "followUpQueueMode",
                    value as FollowUpQueueMode,
                  )
                }
              />
            </SettingRow>
            <SettingRow
              label={t("settings.general.reviewDelivery.label")}
              description={t("settings.general.reviewDelivery.description")}
            >
              <SegmentedControl
                value={state.reviewDelivery}
                disabled={isLoading || isSaving}
                options={[
                  { value: "inline", label: t("settings.general.reviewDelivery.inline") },
                  {
                    value: "detached",
                    label: t("settings.general.reviewDelivery.detached"),
                  },
                ]}
                onChange={(value) =>
                  void persistChoice(
                    "reviewDelivery",
                    "reviewDelivery",
                    value as ReviewDelivery,
                  )
                }
              />
            </SettingRow>
          </div>
        </div>
        {error ? (
          <div className="app-card-error rounded-[18px] px-5 py-4 text-[13px]">
            {error}
          </div>
        ) : null}
      </div>
      {isExternalImportDialogOpen ? (
        <ExternalImportDialog
          errorMessage={externalImportDialogError}
          isPending={isImportingExternalItems}
          items={detectedExternalImportItems}
          selectedItemKeys={selectedExternalImportItemKeys}
          onClose={() => {
            if (!isImportingExternalItems) {
              setIsExternalImportDialogOpen(false);
            }
          }}
          onConfirm={() => void handleConfirmExternalImport()}
          onToggleItem={(item) => {
            const key = getExternalImportItemKey(item);
            setSelectedExternalImportItemKeys((current) => ({
              ...current,
              [key]: !(current[key] ?? false),
            }));
          }}
          t={t}
        />
      ) : null}
      {isImportedFilesDialogOpen && lastCompletedImportProgress != null ? (
        <ExternalImportResultDialog
          codexHome={codexHome ?? null}
          importedItems={lastCompletedImportProgress.importedItems}
          isPending={isContinuingWithCodex}
          onClose={() => setIsImportedFilesDialogOpen(false)}
          onContinue={
            lastCompletedImportProgress.remainingArtifacts.length > 0
              ? () =>
                  void handleContinueWithCodex(
                    lastCompletedImportProgress.remainingArtifacts,
                  )
              : undefined
          }
          remainingArtifacts={lastCompletedImportProgress.remainingArtifacts}
          t={t}
        />
      ) : null}
      {isRemainingArtifactsDialogOpen && remainingArtifacts.length > 0 ? (
        <RemainingArtifactsDialog
          artifacts={remainingArtifacts}
          codexHome={codexHome ?? null}
          isPending={isContinuingWithCodex}
          onClose={() => {
            if (!isContinuingWithCodex) {
              setIsRemainingArtifactsDialogOpen(false);
            }
          }}
          onContinue={() => void handleContinueWithCodex()}
          t={t}
        />
      ) : null}
    </>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        {description ? (
          <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <div className="app-segmented inline-flex rounded-[12px] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition",
            option.value === value
              ? "app-segmented-option-active"
              : "app-segmented-option-idle",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OpenTargetLabel({
  icon,
  label,
}: {
  icon: string | null;
  label: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {icon ? <img alt={label} src={icon} className="icon-sm" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

function ExternalImportDialog({
  errorMessage,
  isPending,
  items,
  selectedItemKeys,
  onClose,
  onConfirm,
  onToggleItem,
  t,
}: {
  errorMessage: string | null;
  isPending: boolean;
  items: ExternalAgentImportItem[];
  selectedItemKeys: Record<string, boolean>;
  onClose: () => void;
  onConfirm: () => void;
  onToggleItem: (item: ExternalAgentImportItem) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const selectedCount = items.filter(
    (item) => selectedItemKeys[getExternalImportItemKey(item)] ?? false,
  ).length;

  return (
    <DialogShell
      title={t("externalAgentConfig.projectImport.title")}
    >
      <div className="app-text-muted text-[13px] leading-6">
        {t("externalAgentConfig.projectImport.subtitle")}
      </div>
      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
        {items.map((item) => {
          const key = getExternalImportItemKey(item);
          const isChecked = selectedItemKeys[key] ?? false;
          return (
            <label
              key={key}
              className="app-card-muted flex cursor-pointer items-start gap-3 rounded-[14px] px-3 py-3"
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isPending}
                onChange={() => onToggleItem(item)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">
                  {getExternalImportItemLabel(item.itemType, t)}
                </span>
                <span className="app-text-muted mt-1 block text-[12px] leading-5">
                  {item.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {errorMessage ? (
        <div className="app-text-error mt-4 text-[13px]">{errorMessage}</div>
      ) : null}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {t("externalAgentConfig.projectImport.cancel")}
        </button>
        <button
          type="button"
          disabled={isPending || selectedCount === 0}
          onClick={onConfirm}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {isPending ? t("settings.general.importExternalAgent.importing") : t("settings.general.importExternalAgent.import")}
        </button>
      </div>
    </DialogShell>
  );
}

function ExternalImportResultDialog({
  codexHome,
  importedItems,
  isPending,
  onClose,
  onContinue,
  remainingArtifacts,
  t,
}: {
  codexHome: string | null;
  importedItems: ExternalAgentImportItem[];
  isPending: boolean;
  onClose: () => void;
  onContinue?: () => void;
  remainingArtifacts: RemainingArtifact[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const userItems = importedItems.filter((item) => !item.cwd);
  const projectItems = importedItems.filter((item) => item.cwd);
  const userArtifacts = remainingArtifacts.filter((artifact) => artifact.scope === "user");
  const projectArtifacts = remainingArtifacts.filter(
    (artifact) => artifact.scope === "project",
  );

  return (
    <DialogShell title={t("settings.agent.importSettings.progress.successTitle")}>
      <div className="app-text-muted text-[13px] leading-6">
        {t("settings.agent.importSettings.progress.successSubtitle")}
      </div>
      <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto">
        {userItems.length > 0 ? (
          <ImportResultSection
            codexHome={codexHome}
            items={userItems}
            pathLabel={getUserConfigRootLabel(codexHome)}
            title={t("settings.agent.importSettings.progress.userConfigSection")}
          />
        ) : null}
        {projectItems.length > 0 ? (
          <ImportResultSection
            codexHome={codexHome}
            items={projectItems}
            pathLabel={getProjectRootLabel(projectItems[0]?.cwd ?? null)}
            title={t("settings.agent.importSettings.progress.currentProjectSection")}
          />
        ) : null}
        {userArtifacts.length > 0 ? (
          <RemainingArtifactSection
            artifacts={userArtifacts}
            codexHome={codexHome}
            pathLabel={getUserConfigRootLabel(codexHome)}
            title={t(
              "settings.agent.importSettings.remaining.userConfigSettingsSection",
            )}
            t={t}
          />
        ) : null}
        {projectArtifacts.length > 0 ? (
          <RemainingArtifactSection
            artifacts={projectArtifacts}
            codexHome={codexHome}
            pathLabel={getProjectRootLabel(projectArtifacts[0]?.cwd ?? null)}
            title={t(
              "settings.agent.importSettings.remaining.currentProjectSettingsSection",
            )}
            t={t}
          />
        ) : null}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {t("settings.agent.importSettings.progress.close")}
        </button>
        {onContinue ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onContinue}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("settings.agent.importSettings.progress.continueInCodex")}
          </button>
        ) : null}
      </div>
    </DialogShell>
  );
}

function ImportResultSection({
  codexHome,
  items,
  pathLabel,
  title,
}: {
  codexHome: string | null;
  items: ExternalAgentImportItem[];
  pathLabel: string | null;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <SectionHeader pathLabel={pathLabel} title={title} />
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={getExternalImportItemKey(item)}
            className="app-card-muted rounded-[14px] px-3 py-3 text-[12px] leading-5"
          >
            {formatImportedItemDescription(item, codexHome)}
          </div>
        ))}
      </div>
    </div>
  );
}

function RemainingArtifactsDialog({
  artifacts,
  codexHome,
  isPending,
  onClose,
  onContinue,
  t,
}: {
  artifacts: RemainingArtifact[];
  codexHome: string | null;
  isPending: boolean;
  onClose: () => void;
  onContinue: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const userArtifacts = artifacts.filter((artifact) => artifact.scope === "user");
  const projectArtifacts = artifacts.filter(
    (artifact) => artifact.scope === "project",
  );

  return (
    <DialogShell
      title={t("settings.agent.importSettings.progress.remainingOnlyTitle")}
    >
      <div className="app-text-muted text-[13px] leading-6">
        {t("settings.agent.importSettings.progress.remainingOnlySubtitle")}
      </div>
      <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto">
        {userArtifacts.length > 0 ? (
          <RemainingArtifactSection
            artifacts={userArtifacts}
            codexHome={codexHome}
            pathLabel={getUserConfigRootLabel(codexHome)}
            title={t(
              "settings.agent.importSettings.remaining.userConfigSettingsSection",
            )}
            t={t}
          />
        ) : null}
        {projectArtifacts.length > 0 ? (
          <RemainingArtifactSection
            artifacts={projectArtifacts}
            codexHome={codexHome}
            pathLabel={getProjectRootLabel(projectArtifacts[0]?.cwd ?? null)}
            title={t(
              "settings.agent.importSettings.remaining.currentProjectSettingsSection",
            )}
            t={t}
          />
        ) : null}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {t("settings.agent.importSettings.progress.close")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onContinue}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {t("settings.agent.importSettings.progress.continueInCodex")}
        </button>
      </div>
    </DialogShell>
  );
}

function RemainingArtifactSection({
  artifacts,
  codexHome,
  pathLabel,
  title,
  t,
}: {
  artifacts: RemainingArtifact[];
  codexHome: string | null;
  pathLabel: string | null;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="space-y-2">
      <SectionHeader pathLabel={pathLabel} title={title} />
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="app-card-muted rounded-[14px] px-3 py-3 text-[12px] leading-5"
          >
            <div className="text-[13px]">
              {getRemainingArtifactLabel(artifact.kind, t)}
              {artifact.count ? ` (${artifact.count})` : ""}
            </div>
            <div className="app-text-muted mt-1 break-all">
              {formatArtifactDisplayPath(artifact, codexHome)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  pathLabel,
  title,
}: {
  pathLabel: string | null;
  title: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[13px] font-medium">{title}</div>
      {pathLabel ? (
        <div className="app-text-muted text-[12px] leading-5">{pathLabel}</div>
      ) : null}
    </div>
  );
}

function DialogShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[520px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="app-title text-[15px] font-medium">{title}</div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function getExternalImportButtonLabel({
  hasImportChoices,
  hasPriorExternalImport,
  hasRemainingArtifacts,
  isDetectingExternalImports,
  isImportingExternalItems,
  t,
}: {
  hasImportChoices: boolean;
  hasPriorExternalImport: boolean;
  hasRemainingArtifacts: boolean;
  isDetectingExternalImports: boolean;
  isImportingExternalItems: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isImportingExternalItems) {
    return t("settings.general.importExternalAgent.importing");
  }
  if (isDetectingExternalImports) {
    return t("settings.general.importExternalAgent.checking");
  }
  if (hasImportChoices || hasRemainingArtifacts) {
    if (hasPriorExternalImport && hasRemainingArtifacts) {
      return t("settings.general.importExternalAgent.continueWithCodex");
    }
    if (hasPriorExternalImport) {
      return t("settings.general.importExternalAgent.importAgain");
    }
    return t("settings.general.importExternalAgent.import");
  }
  return t("settings.general.importExternalAgent.viewImportedFiles");
}

function getExternalImportItemKey(item: ExternalAgentImportItem) {
  return `${item.itemType}:${item.cwd ?? ""}:${item.providerId ?? ""}:${item.description}`;
}

function getExternalImportItemLabel(
  itemType: string,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (itemType) {
    case "AGENTS_MD":
      return t("externalAgentConfig.itemType.agentsMd");
    case "CONFIG":
      return t("externalAgentConfig.itemType.config");
    case "SKILLS":
      return t("externalAgentConfig.itemType.skills");
    case "PLUGINS":
      return t("externalAgentConfig.itemType.plugins");
    case "SUBAGENTS":
      return t("externalAgentConfig.itemType.subagents");
    case "HOOKS":
      return t("externalAgentConfig.itemType.hooks");
    case "COMMANDS":
      return t("externalAgentConfig.itemType.commands");
    case "SESSIONS":
      return t("externalAgentConfig.itemType.sessions");
    case "MCP_SERVER_CONFIG":
      return t("externalAgentConfig.itemType.mcpServerConfig");
    default:
      return itemType;
  }
}

function buildRemainingArtifacts(
  items: ExternalAgentImportItem[],
  codexHome: string | null,
): RemainingArtifact[] {
  return items.flatMap((item) => {
    const kind = getRemainingArtifactKind(item.itemType);
    if (kind == null) {
      return [];
    }

    const path = buildRemainingArtifactPath(item, kind, codexHome);
    if (path == null) {
      return [];
    }

    return [
      {
        count: getRemainingArtifactCount(item, kind),
        cwd: item.cwd ?? null,
        id: `${kind}:${item.cwd ?? ""}:${path}`,
        kind,
        path,
        scope: item.cwd ? "project" : "user",
      },
    ];
  });
}

function getRemainingArtifactKind(itemType: string): RemainingArtifactKind | null {
  switch (itemType) {
    case "COMMANDS":
      return "commands";
    case "HOOKS":
      return "hooks";
    case "MCP_SERVER_CONFIG":
      return "mcp";
    case "PLUGINS":
      return "plugins";
    case "SUBAGENTS":
      return "subagents";
    default:
      return null;
  }
}

function getRemainingArtifactCount(
  item: ExternalAgentImportItem,
  kind: RemainingArtifactKind,
) {
  const details = item.details;
  if (details == null) {
    return undefined;
  }
  switch (kind) {
    case "commands":
      return details.commands.length || undefined;
    case "hooks":
      return details.hooks.length || undefined;
    case "mcp":
      return details.mcpServers.length || undefined;
    case "plugins":
      return (
        details.plugins.reduce((count, plugin) => count + plugin.pluginNames.length, 0) ||
        undefined
      );
    case "subagents":
      return details.subagents.length || undefined;
  }
}

function buildRemainingArtifactPath(
  item: ExternalAgentImportItem,
  kind: RemainingArtifactKind,
  codexHome: string | null,
) {
  const root = item.cwd || getParentDirectory(codexHome);
  if (!root) {
    return null;
  }

  switch (kind) {
    case "commands":
      return joinPath(root, ".claude", "commands");
    case "hooks":
      return joinPath(root, ".claude", "settings.json");
    case "mcp":
      return root;
    case "plugins":
      return joinPath(root, ".claude");
    case "subagents":
      return joinPath(root, ".claude", "agents");
  }
}

function getRemainingArtifactLabel(
  kind: RemainingArtifactKind,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (kind) {
    case "commands":
      return t("settings.agent.importSettings.remaining.slashCommandsLabel");
    case "hooks":
      return t("settings.agent.importSettings.remaining.hooksLabel");
    case "mcp":
      return t("settings.agent.importSettings.remaining.mcpLabel");
    case "plugins":
      return t("settings.agent.importSettings.remaining.pluginsLabel");
    case "subagents":
      return t("settings.agent.importSettings.remaining.subagentsLabel");
  }
}

function normalizeImportedDescription(item: ExternalAgentImportItem) {
  switch (item.itemType) {
    case "AGENTS_MD":
    case "PLUGINS":
    case "SESSIONS":
      return item.description.replace(/^Import /, "Imported ");
    case "CONFIG":
    case "SKILLS":
    case "COMMANDS":
    case "SUBAGENTS":
    case "HOOKS":
      return item.description.replace(/^Migrate /, "Migrated ");
    default:
      return item.description;
  }
}

function formatImportedItemDescription(
  item: ExternalAgentImportItem,
  codexHome: string | null,
) {
  const description = normalizeImportedDescription(item);
  if (!item.cwd) {
    return normalizeUserScopedPathText(description, codexHome);
  }

  const projectRootLabel = getProjectRootLabel(item.cwd);
  return projectRootLabel == null
    ? description
    : replaceLiteralPath(description, item.cwd, projectRootLabel);
}

function formatArtifactDisplayPath(
  artifact: RemainingArtifact,
  codexHome: string | null,
) {
  const path = artifact.scope === "user"
    ? normalizeUserScopedPathText(artifact.path, codexHome)
    : artifact.path;
  const projectRootLabel = getProjectRootLabel(artifact.cwd);
  return artifact.scope === "project" && projectRootLabel != null
    ? replaceLiteralPath(path, artifact.cwd, projectRootLabel)
    : path;
}

function normalizeUserScopedPathText(text: string, codexHome: string | null) {
  let normalized = text
    .replace(/\/Users\/[^/]+\/\.claude/g, "~/.claude")
    .replace(/\/Users\/[^/]+\/\.codex/g, "~/.codex")
    .replace(/\/Users\/[^/]+\/\.agents/g, "~/.agents")
    .replace(/\/Users\/[^/]+\/\.mcp\.json/g, "~/.mcp.json")
    .replace(/\/Users\/[^/]+\/\.claude\.json/g, "~/.claude.json")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.claude/g, "~/.claude")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.codex/g, "~/.codex")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.agents/g, "~/.agents")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.mcp\.json/g, "~/.mcp.json")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.claude\.json/g, "~/.claude.json");

  if (!codexHome) {
    return normalized;
  }

  normalized = replaceLiteralPath(normalized, codexHome, "~/.codex");

  const userRoot = getParentDirectory(codexHome);
  if (!userRoot) {
    return normalized;
  }

  normalized = replaceLiteralPath(
    normalized,
    joinPath(userRoot, ".claude"),
    "~/.claude",
  );
  return replaceLiteralPath(
    normalized,
    joinPath(userRoot, ".agents"),
    "~/.agents",
  );
}

function replaceLiteralPath(
  text: string,
  path: string | null,
  replacement: string,
) {
  if (!path) {
    return text;
  }

  const variants = new Set([
    path,
    path.replace(/\\/g, "/"),
    path.replace(/\//g, "\\"),
  ]);

  let nextText = text;
  for (const variant of variants) {
    if (variant.length === 0) {
      continue;
    }
    nextText = nextText.split(variant).join(replacement);
  }

  return nextText;
}

function getUserConfigRootLabel(codexHome: string | null) {
  return codexHome ? "~/.codex" : null;
}

function getProjectRootLabel(cwd: string | null) {
  return getPathBaseName(cwd) ?? cwd;
}

function getPathBaseName(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/[\\/]+$/, "");
  const lastSeparatorIndex = Math.max(
    normalized.lastIndexOf("\\"),
    normalized.lastIndexOf("/"),
  );

  return lastSeparatorIndex === -1
    ? normalized
    : normalized.slice(lastSeparatorIndex + 1);
}

function formatCompactRelativeTime(
  timestampMs: number,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const now = Date.now();
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

function maxTimestamp(...values: Array<number | null>) {
  return values.reduce<number | null>(
    (current, value) => (value == null ? current : current == null ? value : Math.max(current, value)),
    null,
  );
}

async function resolveMigrateToCodexSkillPath(
  workspaceRoot: string | null,
  codexHome: string | null,
) {
  try {
    const skills = await readSkillsSnapshot(workspaceRoot, false);
    const installedSkill = skills.find((skill) => skill.name === MIGRATE_TO_CODEX_SKILL_NAME);
    if (installedSkill) {
      return installedSkill.path;
    }
  } catch {
    // Ignore and fall through to the upstream bundled skill path.
  }

  if (!codexHome) {
    return null;
  }

  return joinPath(
    codexHome,
    "vendor_imports",
    "skills",
    "skills",
    ".curated",
    MIGRATE_TO_CODEX_SKILL_NAME,
    "SKILL.md",
  );
}

function buildMigrateToCodexPrompt(
  artifacts: RemainingArtifact[],
  skillPath: string,
) {
  const normalizedSkillPath = encodeURI(skillPath.replace(/\\/g, "/"));
  const skillMention = `[$${MIGRATE_TO_CODEX_SKILL_NAME}](${normalizedSkillPath})`;
  const lines = [`Use ${skillMention} to migrate the following settings into Codex.`];
  const userArtifacts = artifacts.filter((artifact) => artifact.scope === "user");
  const projectArtifacts = artifacts.filter((artifact) => artifact.scope === "project");

  if (userArtifacts.length > 0) {
    lines.push("", "User config:");
    for (const artifact of userArtifacts) {
      lines.push(`- ${getPromptArtifactLabel(artifact.kind)}: ${artifact.path}`);
    }
  }

  if (projectArtifacts.length > 0) {
    lines.push("", "Current project:");
    for (const artifact of projectArtifacts) {
      lines.push(`- ${getPromptArtifactLabel(artifact.kind)}: ${artifact.path}`);
    }
  }

  return lines.join("\n");
}

function getPromptArtifactLabel(kind: RemainingArtifactKind) {
  switch (kind) {
    case "commands":
      return "Slash commands";
    case "hooks":
      return "Hooks";
    case "mcp":
      return "MCP";
    case "plugins":
      return "Plugins";
    case "subagents":
      return "Subagents";
  }
}

function joinPath(base: string, ...segments: string[]) {
  const separator = base.includes("\\") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""))].join(
    separator,
  );
}

function getParentDirectory(path: string | null) {
  if (!path) {
    return null;
  }
  const separator = path.includes("\\") ? "\\" : "/";
  const normalized = path.replace(/[\\/]+$/, "");
  const index = normalized.lastIndexOf(separator);
  if (index === -1) {
    return null;
  }
  return normalized.slice(0, index);
}
