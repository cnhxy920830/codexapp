import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type ComposerPermissionMode,
  type ComposerPermissionModeVisibility,
  type ConversationDetailMode,
  type ComposerEnterBehavior,
  type ConfigRequirementsReadResponse,
  type ConfigServiceTier,
  copyGlobalDictationHistoryItem,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_GPU_TEARING_DEBUG_SETTINGS,
  type FollowUpQueueMode,
  getConfigRequirementsForHost,
  type GlobalDictationHistoryItem,
  type GlobalDictationHotkeyStateResponse,
  getGlobalState,
  type GpuTearingDebugSettingKey,
  type GpuTearingDebugSettings,
  type HotkeyWindowHotkeyStateResponse,
  listModelsForHost,
  type ModelListResponse,
  readComposerPermissionModeVisibility,
  readConfigForHost,
  readDictationDictionary,
  readGlobalDictationHistory,
  readGlobalDictationHotkeyState,
  readGeneralSettingsSnapshot,
  readGpuTearingDebugSettings,
  readHotkeyWindowHotkeyState,
  readMacMenuBarEnabledPreference,
  readTerminalShellOptions,
  readWslBashAvailability,
  type IntegratedTerminalShell,
  resolveLocalePreference,
  type ReviewDelivery,
  setGlobalState,
  setGlobalDictationHotkey,
  setGlobalDictationToggleHotkey,
  setHotkeyWindowHotkey,
  type GeneralSettingsSnapshot,
  type GlobalStateKey,
  updateGpuTearingDebugSettings,
  updateComposerPermissionModeVisibility,
  writeConfigValueForHost,
} from "../services/settings";
import {
  readAccountInfo,
  type AccountInfoResponse,
  type AuthSnapshot,
} from "../services/auth";
import {
  buildAcceleratorFromKeyboardEvent,
  formatAcceleratorLabel,
} from "../services/keyboardShortcuts";
import {
  getComposerModifierLabel,
  getInvertFollowUpShortcutAccelerator,
} from "../lib/followUpShortcuts";
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
  REPLICA_STATSIG_GATES,
  useReplicaStatsigDefaultFeatures,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";
import {
  SUPPORTED_LOCALES,
  getLocaleLabel,
  resolveSupportedLocale,
  type LocaleCode,
  type MessageKey,
} from "../i18n/messages";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
} from "./AppShellIcons";
import { ToggleSwitch } from "./ToggleSwitch";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import type { AppToast } from "./AppToastRegion";

const LOCAL_EXTERNAL_AGENT_IMPORT_HOST_ID = "local";
const EXTERNAL_AGENT_IMPORT_PROVIDERS = ["claude-code"] as const;
const MIGRATE_TO_CODEX_SKILL_NAME = "migrate-to-codex";
const PERMISSIONS_MODE_LEARN_MORE_URL =
  "https://developers.openai.com/codex/config-basic";
const AMBIENT_SUGGESTIONS_SUPPORTED_PLANS = new Set([
  "plus",
  "pro",
  "business",
  "team",
  "self_serve_business_usage_based",
]);
const TERMINAL_SHELL_LABELS: Record<IntegratedTerminalShell, string> = {
  powershell: "PowerShell",
  commandPrompt: "Command Prompt",
  gitBash: "Git Bash",
  wsl: "WSL",
};
const EMPTY_DICTATION_DICTIONARY_ENTRY = "";
const DEFAULT_DICTATION_DICTIONARY_ENTRIES = [EMPTY_DICTATION_DICTIONARY_ENTRY];
const DICTATION_DICTIONARY_PLACEHOLDERS = [
  "Jane Doe",
  "Acme Widget",
  "checkout-form.tsx",
  "useCartState",
] as const;
type WorkModeOptionId = "coding" | "everyday";
type SpeedMenuValue = "fast" | "flex" | "standard";

const WORK_MODE_OPTIONS: ReadonlyArray<{
  id: WorkModeOptionId;
  value: ConversationDetailMode;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: ReactNode;
}> = [
  {
    id: "coding",
    value: "STEPS_COMMANDS",
    titleKey: "settings.workMode.coding.title",
    descriptionKey: "settings.workMode.coding.description",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[var(--app-shell-text)]"
      >
        <path
          d="M6.19629 7.86231C6.42357 7.63534 6.7752 7.60692 7.0332 7.77734L7.1377 7.86231L8.80371 9.5293C9.06329 9.78889 9.06307 10.21 8.80371 10.4697L7.1377 12.1367C6.878 12.3964 6.45599 12.3964 6.19629 12.1367C5.93686 11.8771 5.93697 11.456 6.19629 11.1963L7.39258 9.99902L6.19629 8.80371L6.11133 8.69922C5.94087 8.4411 5.96904 8.08955 6.19629 7.86231Z"
          fill="currentColor"
        />
        <path
          d="M13.4668 11.0156C13.7699 11.0776 13.998 11.3456 13.998 11.667C13.9979 11.9883 13.7698 12.2564 13.4668 12.3184L13.333 12.332H10.833C10.466 12.3319 10.1682 12.034 10.168 11.667C10.168 11.2998 10.4659 11.0021 10.833 11.002H13.333L13.4668 11.0156Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.6602 2.66504C13.3492 2.66504 13.9062 2.66439 14.3564 2.70117C14.8142 2.73859 15.2201 2.81796 15.5967 3.00977C16.1922 3.31321 16.677 3.79805 16.9805 4.39356C17.1722 4.77014 17.2517 5.17604 17.2891 5.63379C17.3258 6.08402 17.3252 6.64102 17.3252 7.33008V12.6602C17.3252 13.3492 17.3258 13.9062 17.2891 14.3564C17.2516 14.8142 17.1723 15.2201 16.9805 15.5967C16.677 16.1922 16.1922 16.677 15.5967 16.9805C15.2201 17.1723 14.8142 17.2516 14.3564 17.2891C13.9062 17.3258 13.3492 17.3252 12.6602 17.3252H7.33008C6.64102 17.3252 6.08402 17.3258 5.63379 17.2891C5.17604 17.2517 4.77014 17.1722 4.39356 16.9805C3.79805 16.677 3.31321 16.1922 3.00977 15.5967C2.81796 15.2201 2.73859 14.8142 2.70117 14.3564C2.66439 13.9062 2.66504 13.3492 2.66504 12.6602V7.33008C2.66504 6.64101 2.66439 6.08402 2.70117 5.63379C2.73858 5.17601 2.81797 4.77016 3.00977 4.39356C3.31321 3.79802 3.79802 3.31321 4.39356 3.00977C4.77016 2.81797 5.17601 2.73858 5.63379 2.70117C6.08402 2.66439 6.64101 2.66504 7.33008 2.66504H12.6602ZM7.33008 3.99512C6.61907 3.99512 6.1257 3.99601 5.74219 4.02734C5.3665 4.05804 5.15508 4.11481 4.99707 4.19531C4.65183 4.37124 4.37124 4.65183 4.19531 4.99707C4.11481 5.15508 4.05805 5.3665 4.02734 5.74219C3.99601 6.1257 3.99512 6.61908 3.99512 7.33008V12.6602C3.99512 13.3711 3.99601 13.8646 4.02734 14.248C4.05805 14.6237 4.11481 14.8352 4.19531 14.9932C4.37124 15.3384 4.65186 15.619 4.99707 15.7949C5.15507 15.8754 5.36654 15.9322 5.74219 15.9629C6.1257 15.9942 6.61908 15.9951 7.33008 15.9951H12.6602C13.3711 15.9951 13.8646 15.9942 14.248 15.9629C14.6237 15.9322 14.8352 15.8754 14.9932 15.7949C15.3384 15.619 15.619 15.3384 15.7949 14.9932C15.8754 14.8352 15.9322 14.6237 15.9629 14.248C15.9942 13.8646 15.9951 13.3711 15.9951 12.6602V7.33008C15.9951 6.61908 15.9942 6.1257 15.9629 5.74219C15.9322 5.36654 15.8754 5.15507 15.7949 4.99707C15.619 4.65186 15.3384 4.37124 14.9932 4.19531C14.8352 4.11481 14.6237 4.05805 14.248 4.02734C13.8646 3.99601 13.3711 3.99512 12.6602 3.99512H7.33008Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "everyday",
    value: "STEPS_PROSE",
    titleKey: "settings.workMode.everyday.title",
    descriptionKey: "settings.workMode.everyday.description",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[var(--app-shell-text)]"
      >
        <path
          d="M11.335 12.083C11.3347 9.97242 9.44966 8.16504 7 8.16504C4.55034 8.16504 2.66527 9.97242 2.66504 12.083C2.66504 12.8512 2.90887 13.5704 3.33691 14.1797C3.4302 14.3125 3.47218 14.4745 3.4541 14.6357C3.40535 15.0678 3.31415 15.4843 3.19922 15.8877C3.66136 15.8098 4.10651 15.6986 4.54297 15.5508L4.66699 15.5215C4.79159 15.5045 4.91938 15.5238 5.03516 15.5771C5.62294 15.8481 6.2901 16.002 7 16.002C9.44981 16.002 11.335 14.1938 11.335 12.083ZM17.335 7.91309C17.3348 5.80247 15.4497 3.99512 13 3.99512C11.5595 3.99512 10.298 4.62925 9.51465 5.58496C9.28182 5.86891 8.86214 5.9105 8.57812 5.67773C8.29409 5.44493 8.25257 5.02526 8.48535 4.74121C9.52649 3.47094 11.1693 2.66504 13 2.66504C16.0729 2.66504 18.6648 4.96138 18.665 7.91309C18.665 8.8753 18.3824 9.77408 17.8984 10.5459C17.9866 11.1153 18.1604 11.6767 18.3848 12.2568C18.4665 12.4681 18.4355 12.7068 18.3018 12.8896C18.1681 13.0723 17.9505 13.1739 17.7246 13.1602C16.8659 13.1076 16.0585 12.9617 15.2734 12.7178C15.1054 12.7861 14.9347 12.8511 14.7588 12.9043C14.4073 13.0104 14.036 12.8113 13.9297 12.46C13.8235 12.1084 14.0226 11.7372 14.374 11.6309C14.5782 11.5692 14.7758 11.4944 14.9648 11.4072L15.084 11.3652C15.2063 11.3351 15.3361 11.3399 15.457 11.3809C15.8932 11.5286 16.338 11.6399 16.7998 11.7178C16.6849 11.3144 16.5946 10.8978 16.5459 10.4658C16.5278 10.3046 16.5698 10.1426 16.6631 10.0098C17.0911 9.40048 17.335 8.68131 17.335 7.91309ZM12.665 12.083C12.665 15.0349 10.073 17.332 7 17.332C6.19184 17.332 5.42143 17.1731 4.72266 16.8887C4.04698 17.0983 3.35521 17.2365 2.62793 17.3037L2.27539 17.3301C2.04946 17.3438 1.83192 17.2422 1.69824 17.0596C1.56452 16.8767 1.53354 16.638 1.61523 16.4268L1.79297 15.9375C1.93133 15.5279 2.03737 15.1238 2.10059 14.7158C1.61678 13.9441 1.33496 13.045 1.33496 12.083C1.33519 9.13134 3.92709 6.83496 7 6.83496C10.0729 6.83496 12.6648 9.13134 12.665 12.083Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

type AgentEnvironmentValue = "windows" | "wsl";
type NotificationTurnMode = "off" | "unfocused" | "always";
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
  authSnapshot,
  codexHome,
  workspaceRoot,
  onComposerEnterBehaviorChange,
  onFollowUpQueueModeChange,
  onReviewDeliveryChange,
  onOpenChatWithPrompt,
  onShowToast,
}: {
  authSnapshot?: AuthSnapshot | null;
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
  const [hotkeyWindowHotkeyState, setHotkeyWindowHotkeyState] =
    useState<HotkeyWindowHotkeyStateResponse | null>(null);
  const [isCapturingHotkeyWindowHotkey, setIsCapturingHotkeyWindowHotkey] =
    useState(false);
  const [isUpdatingHotkeyWindowHotkey, setIsUpdatingHotkeyWindowHotkey] =
    useState(false);
  const [hotkeyWindowHotkeyError, setHotkeyWindowHotkeyError] = useState<
    string | null
  >(null);
  const [globalDictationHotkeyState, setGlobalDictationHotkeyState] =
    useState<GlobalDictationHotkeyStateResponse | null>(null);
  const [globalDictationHistoryItems, setGlobalDictationHistoryItems] =
    useState<GlobalDictationHistoryItem[]>([]);
  const [isCapturingGlobalDictationHotkey, setIsCapturingGlobalDictationHotkey] =
    useState(false);
  const [
    isCapturingGlobalDictationToggleHotkey,
    setIsCapturingGlobalDictationToggleHotkey,
  ] = useState(false);
  const [isUpdatingGlobalDictationHotkey, setIsUpdatingGlobalDictationHotkey] =
    useState(false);
  const [
    isUpdatingGlobalDictationToggleHotkey,
    setIsUpdatingGlobalDictationToggleHotkey,
  ] = useState(false);
  const [globalDictationHotkeyError, setGlobalDictationHotkeyError] = useState<
    string | null
  >(null);
  const [
    globalDictationToggleHotkeyError,
    setGlobalDictationToggleHotkeyError,
  ] = useState<string | null>(null);
  const [
    copyingGlobalDictationHistoryItemId,
    setCopyingGlobalDictationHistoryItemId,
  ] = useState<string | null>(null);
  const [notificationTurnMode, setNotificationTurnMode] =
    useState<NotificationTurnMode>("unfocused");
  const [notificationsPermissionsEnabled, setNotificationsPermissionsEnabled] =
    useState(true);
  const [notificationsQuestionsEnabled, setNotificationsQuestionsEnabled] =
    useState(true);
  const [ambientSuggestionsEnabled, setAmbientSuggestionsEnabled] = useState(true);
  const [composerPermissionModeVisibility, setComposerPermissionModeVisibility] =
    useState<ComposerPermissionModeVisibility>(() =>
      readComposerPermissionModeVisibility(),
    );
  const [serviceTier, setServiceTier] = useState<ConfigServiceTier | null>(null);
  const [isSpeedLoading, setIsSpeedLoading] = useState(false);
  const [canUseFastMode, setCanUseFastMode] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfoResponse | null>(null);
  const [languageSearch, setLanguageSearch] = useState("");
  const [openTargets, setOpenTargets] = useState<OpenInTargetsResponse | null>(null);
  const [availableTerminalShells, setAvailableTerminalShells] = useState<IntegratedTerminalShell[]>([]);
  const [macMenuBarEnabled, setMacMenuBarEnabled] = useState(true);
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
  const [dictationDictionary, setDictationDictionary] = useState<string[]>([]);
  const [dictationDictionaryDraft, setDictationDictionaryDraft] = useState<string[] | null>(null);
  const [isDictationDictionaryExpanded, setIsDictationDictionaryExpanded] =
    useState(false);
  const [gpuTearingDebugSettings, setGpuTearingDebugSettings] =
    useState<GpuTearingDebugSettings>(DEFAULT_GPU_TEARING_DEBUG_SETTINGS);
  const composerModifierLabel = getComposerModifierLabel();
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const openTargetMenuRef = useRef<HTMLDivElement | null>(null);
  const terminalShellMenuRef = useRef<HTMLDivElement | null>(null);
  const initialAgentEnvironmentRef = useRef<boolean | null>(null);
  const skipNextDictationDictionaryBlurPersistRef = useRef(false);
  const isWindowsPlatform =
    typeof navigator === "undefined" ? true : navigator.userAgent.includes("Windows");
  const isMacOsPlatform =
    typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Mac");
  const defaultFeatures = useReplicaStatsigDefaultFeatures();
  const showHotkeyWindowHotkeySetting =
    useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.hotkeyWindow) &&
    !useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.hotkeyWindowSuppress);
  const showDictationSettings =
    useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.dictationPrimary) &&
    useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.dictationSecondary);
  const showGpuTearingDebugSettings = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.gpuTearingDebug,
  );
  const showDefaultOpenTargetSetting = isWindowsPlatform;
  const showIntegratedTerminalShellSetting = isWindowsPlatform;
  const showAgentEnvironmentSetting =
    isWindowsPlatform && availableTerminalShells.includes("wsl");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextGpuTearingDebugSettings = readGpuTearingDebugSettings();
        const [
          snapshotResult,
          terminalShellOptionsResult,
          openTargetsResult,
          hotkeyWindowHotkeyStateResult,
          notificationTurnModeResult,
          notificationPermissionsEnabledResult,
          notificationQuestionsEnabledResult,
          ambientSuggestionsEnabledResult,
          macMenuBarEnabledResult,
          dictationDictionaryResult,
        ] =
          await Promise.allSettled([
            readGeneralSettingsSnapshot(),
            readTerminalShellOptions(),
            showDefaultOpenTargetSetting ? readOpenInTargets({ cwd: null }) : Promise.resolve(null),
            isWindowsPlatform ? readHotkeyWindowHotkeyState() : Promise.resolve(null),
            getGlobalState("notifications-turn-mode"),
            getGlobalState("notifications-permissions-enabled"),
            getGlobalState("notifications-questions-enabled"),
            getGlobalState("ambient-suggestions-enabled"),
            isMacOsPlatform ? readMacMenuBarEnabledPreference() : Promise.resolve(true),
            readDictationDictionary(),
          ]);
        if (cancelled) {
          return;
        }

        if (snapshotResult.status !== "fulfilled") {
          throw snapshotResult.reason;
        }

        setState(snapshotResult.value);
        setGpuTearingDebugSettings(nextGpuTearingDebugSettings);
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
        setHotkeyWindowHotkeyState(
          hotkeyWindowHotkeyStateResult.status === "fulfilled"
            ? hotkeyWindowHotkeyStateResult.value
            : null,
        );
        setNotificationTurnMode(
          notificationTurnModeResult.status === "fulfilled"
            ? normalizeNotificationTurnMode(notificationTurnModeResult.value.value)
            : "unfocused",
        );
        setNotificationsPermissionsEnabled(
          notificationPermissionsEnabledResult.status === "fulfilled"
            ? notificationPermissionsEnabledResult.value.value !== false
            : true,
        );
        setNotificationsQuestionsEnabled(
          notificationQuestionsEnabledResult.status === "fulfilled"
            ? notificationQuestionsEnabledResult.value.value !== false
            : true,
        );
        setAmbientSuggestionsEnabled(
          ambientSuggestionsEnabledResult.status === "fulfilled"
            ? normalizeAmbientSuggestionsEnabled(ambientSuggestionsEnabledResult.value.value)
            : true,
        );
        setMacMenuBarEnabled(
          macMenuBarEnabledResult.status === "fulfilled"
            ? macMenuBarEnabledResult.value
            : true,
        );
        setDictationDictionary(
          dictationDictionaryResult.status === "fulfilled"
            ? dictationDictionaryResult.value
            : [],
        );
        setHotkeyWindowHotkeyError(
          hotkeyWindowHotkeyStateResult.status === "rejected"
            ? hotkeyWindowHotkeyStateResult.reason instanceof Error
              ? hotkeyWindowHotkeyStateResult.reason.message
              : "Failed to update Popout Window hotkey."
            : null,
        );
        const nonBlockingError =
          terminalShellOptionsResult.status === "rejected"
            ? terminalShellOptionsResult.reason
            : openTargetsResult.status === "rejected"
              ? openTargetsResult.reason
              : notificationTurnModeResult.status === "rejected"
                ? notificationTurnModeResult.reason
                : notificationPermissionsEnabledResult.status === "rejected"
                ? notificationPermissionsEnabledResult.reason
                : notificationQuestionsEnabledResult.status === "rejected"
                ? notificationQuestionsEnabledResult.reason
                  : ambientSuggestionsEnabledResult.status === "rejected"
                      ? ambientSuggestionsEnabledResult.reason
                      : macMenuBarEnabledResult.status === "rejected"
                        ? macMenuBarEnabledResult.reason
                      : dictationDictionaryResult.status === "rejected"
                        ? dictationDictionaryResult.reason
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
  }, [isWindowsPlatform, showDefaultOpenTargetSetting]);

  useEffect(() => {
    if (!isWindowsPlatform) {
      setGlobalDictationHotkeyState(null);
      setGlobalDictationHistoryItems([]);
      return;
    }

    let cancelled = false;

    const loadGlobalDictationSettings = async () => {
      const [hotkeyStateResult, historyResult] = await Promise.allSettled([
        readGlobalDictationHotkeyState(),
        readGlobalDictationHistory(),
      ]);
      if (cancelled) {
        return;
      }

      if (hotkeyStateResult.status === "fulfilled") {
        setGlobalDictationHotkeyState(hotkeyStateResult.value);
        setGlobalDictationHotkeyError(null);
        setGlobalDictationToggleHotkeyError(null);
      }

      if (historyResult.status === "fulfilled") {
        setGlobalDictationHistoryItems(historyResult.value.items);
      }
    };

    void loadGlobalDictationSettings();

    return () => {
      cancelled = true;
    };
  }, [isWindowsPlatform]);

  useEffect(() => {
    if (authSnapshot?.authState.authMethod !== "chatgpt") {
      setAccountInfo(null);
      return;
    }

    let cancelled = false;

    const loadAccountInfo = async () => {
      try {
        const nextAccountInfo = await readAccountInfo();
        if (!cancelled) {
          setAccountInfo(nextAccountInfo);
        }
      } catch {
        if (!cancelled) {
          setAccountInfo(null);
        }
      }
    };

    void loadAccountInfo();

    return () => {
      cancelled = true;
    };
  }, [
    authSnapshot?.authState.authMethod,
    authSnapshot?.authState.email,
    authSnapshot?.authState.planAtLogin,
  ]);

  useEffect(() => {
    if (authSnapshot?.authState.authMethod !== "chatgpt") {
      setServiceTier(null);
      setCanUseFastMode(false);
      setIsSpeedLoading(false);
      return;
    }

    let cancelled = false;
    setIsSpeedLoading(true);

    const loadSpeedSettings = async () => {
      const [configResult, configRequirementsResult, modelsResult] =
        await Promise.allSettled([
          readConfigForHost({
            hostId: null,
            cwd: null,
            includeLayers: false,
          }),
          getConfigRequirementsForHost({ hostId: null }),
          listModelsForHost({
            hostId: null,
            cursor: null,
            limit: 100,
            includeHidden: false,
          }),
        ]);

      if (cancelled) {
        return;
      }

      setServiceTier(
        configResult.status === "fulfilled"
          ? configResult.value.config.serviceTier
          : null,
      );
      setCanUseFastMode(
        configRequirementsResult.status === "fulfilled" &&
          modelsResult.status === "fulfilled"
          ? canUseFastModeFromSettingsSurface(
              configRequirementsResult.value,
              modelsResult.value,
            )
          : false,
      );
      setIsSpeedLoading(false);
    };

    void loadSpeedSettings();

    return () => {
      cancelled = true;
    };
  }, [authSnapshot?.activeLoginId, authSnapshot?.authState.authMethod]);

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
    field:
      | "conversationDetailMode"
      | "composerEnterBehavior"
      | "followUpQueueMode"
      | "preventSleepWhileRunning"
      | "reviewDelivery",
    key: GlobalStateKey,
    value:
      | boolean
      | ComposerEnterBehavior
      | ConversationDetailMode
      | FollowUpQueueMode
      | ReviewDelivery,
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

  const persistMacMenuBarEnabled = async (value: boolean) => {
    const previousValue = macMenuBarEnabled;
    setMacMenuBarEnabled(value);
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("mac-menu-bar-enabled", value);
    } catch (err) {
      setMacMenuBarEnabled(previousValue);
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

  const persistHotkeyWindowHotkey = async (hotkey: string | null) => {
    setHotkeyWindowHotkeyError(null);
    setIsUpdatingHotkeyWindowHotkey(true);
    try {
      const response = await setHotkeyWindowHotkey(hotkey);
      setHotkeyWindowHotkeyState(response.state);
      if (!response.success) {
        setHotkeyWindowHotkeyError(
          response.error ??
            t(
              "settings.general.experimentalFeatures.hotkeyWindowHotkey.errorGeneric",
            ),
        );
        return;
      }
      setIsCapturingHotkeyWindowHotkey(false);
    } catch (err) {
      setHotkeyWindowHotkeyError(
        err instanceof Error
          ? err.message
          : t(
              "settings.general.experimentalFeatures.hotkeyWindowHotkey.errorGeneric",
            ),
      );
    } finally {
      setIsUpdatingHotkeyWindowHotkey(false);
    }
  };

  const persistGlobalDictationHotkey = async ({
    hotkey,
    kind,
  }: {
    hotkey: string | null;
    kind: "hold" | "toggle";
  }) => {
    const isHoldHotkey = kind === "hold";
    const setErrorMessage = isHoldHotkey
      ? setGlobalDictationHotkeyError
      : setGlobalDictationToggleHotkeyError;
    const setIsUpdating = isHoldHotkey
      ? setIsUpdatingGlobalDictationHotkey
      : setIsUpdatingGlobalDictationToggleHotkey;
    const setIsCapturing = isHoldHotkey
      ? setIsCapturingGlobalDictationHotkey
      : setIsCapturingGlobalDictationToggleHotkey;
    const genericErrorMessage = t(
      isHoldHotkey
        ? "settings.general.globalDictationHotkey.errorGeneric"
        : "settings.general.globalDictationToggleHotkey.errorGeneric",
    );

    setErrorMessage(null);
    setIsUpdating(true);
    try {
      const response = isHoldHotkey
        ? await setGlobalDictationHotkey(hotkey)
        : await setGlobalDictationToggleHotkey(hotkey);
      setGlobalDictationHotkeyState(response.state);
      if (!response.success) {
        setErrorMessage(response.error ?? genericErrorMessage);
        return;
      }
      setIsCapturing(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : genericErrorMessage,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const persistNotificationSetting = async <T extends boolean | NotificationTurnMode>(
    key:
      | "notifications-turn-mode"
      | "notifications-permissions-enabled"
      | "notifications-questions-enabled",
    value: T,
    previousValue: T,
    setValue: (nextValue: T) => void,
  ) => {
    setValue(value);
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
    } catch (err) {
      setValue(previousValue);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistAmbientSuggestionsEnabled = async (value: boolean) => {
    const previousValue = ambientSuggestionsEnabled;
    setAmbientSuggestionsEnabled(value);
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("ambient-suggestions-enabled", value);
    } catch (err) {
      setAmbientSuggestionsEnabled(previousValue);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistServiceTier = async (value: SpeedMenuValue) => {
    const nextServiceTier = value === "fast" ? "fast" : null;
    const previousValue = serviceTier;
    setServiceTier(nextServiceTier);
    setError(null);
    setIsSaving(true);
    try {
      await writeConfigValueForHost({
        hostId: null,
        keyPath: "service_tier",
        value: nextServiceTier,
        mergeStrategy: "upsert",
      });
    } catch (err) {
      setServiceTier(previousValue);
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

  const persistDictationDictionary = async (entries: string[]) => {
    const normalizedEntries = normalizeDictationDictionaryEntries(entries);
    const previousEntries = dictationDictionary;
    setDictationDictionary(normalizedEntries);
    setDictationDictionaryDraft(null);
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("dictationDictionary", normalizedEntries);
    } catch (err) {
      setDictationDictionary(previousEntries);
      setDictationDictionaryDraft(entries);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyGlobalDictationHistoryItem = async (id: string) => {
    setCopyingGlobalDictationHistoryItemId(id);
    try {
      await copyGlobalDictationHistoryItem(id);
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          tone: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setCopyingGlobalDictationHistoryItemId((current) =>
        current === id ? null : current,
      );
    }
  };

  const persistGpuTearingDebugSetting = (
    key: GpuTearingDebugSettingKey,
    value: boolean,
  ) => {
    setGpuTearingDebugSettings((current) =>
      updateGpuTearingDebugSettings({
        key,
        settings: current,
        value,
      }),
    );
  };

  const localeEntries = useMemo(
    () =>
      SUPPORTED_LOCALES.filter(
        (entry): entry is LocaleCode => entry !== "auto",
      )
        .map((entry) => {
          const nativeLabel = getLocaleLabel(entry, entry);
          const localizedLabel = getLocaleLabel(entry, locale);
          const searchText = `${nativeLabel} ${localizedLabel}`.toLowerCase();
          return {
            code: entry,
            nativeLabel,
            localizedLabel,
            searchText,
          };
        })
        .sort((left, right) => left.nativeLabel.localeCompare(right.nativeLabel)),
    [locale],
  );

  const normalizedLocaleOverride = resolveSupportedLocale(state.localeOverride);
  const selectedLocaleLabel =
    normalizedLocaleOverride == null
      ? t("settings.ide.language.auto")
      : localeEntries.find((entry) => entry.code === normalizedLocaleOverride)
          ?.nativeLabel ?? t("settings.ide.language.auto");

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
  const configuredHotkeyWindowHotkey =
    hotkeyWindowHotkeyState?.configuredHotkey ?? null;
  const hotkeyWindowHotkeyStatusLabel =
    configuredHotkeyWindowHotkey == null
      ? t("settings.general.experimentalFeatures.hotkeyWindowHotkey.off")
      : formatAcceleratorLabel(configuredHotkeyWindowHotkey);
  const invertFollowUpShortcutLabel = useMemo(
    () =>
      formatAcceleratorLabel(
        getInvertFollowUpShortcutAccelerator(state.composerEnterBehavior),
      ),
    [state.composerEnterBehavior],
  );
  const isGlobalDictationHotkeySupported =
    globalDictationHotkeyState?.supported ?? false;
  const configuredGlobalDictationHotkey =
    globalDictationHotkeyState?.configuredHotkey ?? null;
  const configuredGlobalDictationToggleHotkey =
    globalDictationHotkeyState?.configuredToggleHotkey ?? null;
  const globalDictationHotkeyStatusLabel =
    configuredGlobalDictationHotkey == null
      ? t("settings.general.globalDictationHotkey.off")
      : formatAcceleratorLabel(configuredGlobalDictationHotkey);
  const globalDictationToggleHotkeyStatusLabel =
    configuredGlobalDictationToggleHotkey == null
      ? t("settings.general.globalDictationHotkey.off")
      : formatAcceleratorLabel(configuredGlobalDictationToggleHotkey);
  const dictationDictionaryEditorValues =
    dictationDictionaryDraft ?? dictationDictionary;
  const visibleDictationDictionaryEntries =
    dictationDictionaryEditorValues.length > 0
      ? dictationDictionaryEditorValues
      : DEFAULT_DICTATION_DICTIONARY_ENTRIES;
  const notificationTurnModeOptions: Array<{
    value: NotificationTurnMode;
    label: string;
  }> = [
    { value: "off", label: t("notifications.turnMode.off") },
    { value: "unfocused", label: t("notifications.turnMode.unfocused") },
    { value: "always", label: t("notifications.turnMode.always") },
  ];

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
  const hotkeyWindowHotkeyDescription = (
    <>
      <span>
        {t("settings.general.experimentalFeatures.hotkeyWindowHotkey.description")}
      </span>
      {hotkeyWindowHotkeyError ? (
        <span className="app-text-error block">{hotkeyWindowHotkeyError}</span>
      ) : null}
    </>
  );
  const globalDictationHotkeyDescription = (
    <>
      <span>{t("settings.general.globalDictationHotkey.description")}</span>
      {globalDictationHotkeyError ? (
        <span className="app-text-error block">{globalDictationHotkeyError}</span>
      ) : null}
    </>
  );
  const globalDictationToggleHotkeyDescription = (
    <>
      <span>{t("settings.general.globalDictationToggleHotkey.description")}</span>
      {globalDictationToggleHotkeyError ? (
        <span className="app-text-error block">
          {globalDictationToggleHotkeyError}
        </span>
      ) : null}
    </>
  );
  const selectedWorkModeId: WorkModeOptionId =
    state.conversationDetailMode === "STEPS_PROSE" ? "everyday" : "coding";
  const speedOptions = useMemo(
    () => [
      {
        value: "standard",
        label: t("settings.agent.speed.option.standard"),
        description: t("settings.agent.speed.option.standard.description"),
      },
      {
        value: "fast",
        label: t("settings.agent.speed.option.fast"),
        description: t("settings.agent.speed.option.fast.description"),
      },
    ],
    [t],
  );
  const selectedSpeedMenuValue: SpeedMenuValue = serviceTier ?? "standard";
  const speedTriggerLabel =
    serviceTier === "fast"
      ? t("settings.agent.speed.option.fast")
      : t("settings.agent.speed.option.standard");
  const showSpeedSetting =
    authSnapshot?.authState.authMethod === "chatgpt" &&
    !isSpeedLoading &&
    canUseFastMode;
  const showAmbientSuggestionsSetting = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.ambientSuggestions,
  );
  const showGuardianPermissionsModeOption =
    defaultFeatures.guardian_approval === true;
  const gpuTearingDebugSettingRows = useMemo(
    () => [
      {
        key: "disableScrollFadeMask" as const,
        label: t("settings.general.gpuTearingDebug.disableScrollFadeMask.label"),
        description: t(
          "settings.general.gpuTearingDebug.disableScrollFadeMask.description",
        ),
      },
      {
        key: "disableScrollFadeMaskAnimation" as const,
        label: t(
          "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.label",
        ),
        description: t(
          "settings.general.gpuTearingDebug.disableScrollFadeMaskAnimation.description",
        ),
      },
      {
        key: "disableBackdropBlur" as const,
        label: t("settings.general.gpuTearingDebug.disableBackdropBlur.label"),
        description: t(
          "settings.general.gpuTearingDebug.disableBackdropBlur.description",
        ),
      },
      {
        key: "disableCssMotion" as const,
        label: t("settings.general.gpuTearingDebug.disableCssMotion.label"),
        description: t(
          "settings.general.gpuTearingDebug.disableCssMotion.description",
        ),
      },
      {
        key: "forceOpaqueRendererBackground" as const,
        label: t(
          "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.label",
        ),
        description: t(
          "settings.general.gpuTearingDebug.forceOpaqueRendererBackground.description",
        ),
      },
    ],
    [t],
  );
  const persistComposerPermissionModeVisibility = (
    mode: ComposerPermissionMode,
    visible: boolean,
  ) => {
    setComposerPermissionModeVisibility((current) =>
      updateComposerPermissionModeVisibility({
        mode,
        visible,
        settings: current,
      }),
    );
  };

  return (
    <>
      <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">
            {t("settings.section.general-settings")}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-1">
            <div className="app-title text-[14px] font-medium">
              {t("settings.workMode.groupTitle")}
            </div>
            <p className="text-[13px] leading-5 text-[var(--app-shell-subtle)]">
              {t("settings.workMode.groupDescription")}
            </p>
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div
            className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"
            role="radiogroup"
            aria-label={t("settings.workMode.radioGroup")}
          >
            {WORK_MODE_OPTIONS.map((option) => {
              const isSelected = selectedWorkModeId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isLoading || isSaving}
                  onClick={() =>
                    void persistChoice(
                      "conversationDetailMode",
                      "conversationDetailMode",
                      option.value,
                    )
                  }
                  className={[
                    "flex min-h-[62px] min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left outline-none transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-shell-control-ring)]",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                    isSelected
                      ? "border-transparent bg-[var(--app-shell-card-bg-muted)]"
                      : "border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg)] hover:bg-[var(--app-shell-card-bg-muted)]",
                  ].join(" ")}
                >
                  {option.icon}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="min-w-0 truncate text-sm text-[var(--app-shell-text)]">
                      {t(option.titleKey)}
                    </span>
                    <span className="min-w-0 truncate text-sm text-[var(--app-shell-subtle)]">
                      {t(option.descriptionKey)}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full",
                      isSelected
                        ? "border-2 border-[var(--app-shell-accent)] bg-[var(--app-shell-accent)]"
                        : "border border-[var(--app-shell-border)]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-[7px] w-[7px] rounded-full bg-white transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">
            {t("settings.agent.permissionsMode.groupTitle")}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-4 text-[14px]">
            <SettingRow
              label={t("settings.agent.permissionsMode.default.title")}
              description={t("settings.agent.permissionsMode.default.description")}
            >
              <ToggleSwitch
                checked
                disabled
                ariaLabel={t("settings.agent.permissionsMode.default.toggle")}
                onChange={() => undefined}
              />
            </SettingRow>
            {showGuardianPermissionsModeOption ? (
              <SettingRow
                label={t("settings.agent.permissionsMode.autoReview.title")}
                description={renderLinkedDescription(
                  t("settings.agent.permissionsMode.autoReview.description"),
                  PERMISSIONS_MODE_LEARN_MORE_URL,
                )}
              >
                <ToggleSwitch
                  checked={composerPermissionModeVisibility["guardian-approvals"]}
                  disabled={isLoading || isSaving}
                  ariaLabel={t("settings.agent.permissionsMode.autoReview.toggle")}
                  onChange={(checked) =>
                    persistComposerPermissionModeVisibility(
                      "guardian-approvals",
                      checked,
                    )
                  }
                />
              </SettingRow>
            ) : null}
            <SettingRow
              label={t("settings.agent.permissionsMode.fullAccess.title")}
              description={renderLinkedDescription(
                t("settings.agent.permissionsMode.fullAccess.description"),
                PERMISSIONS_MODE_LEARN_MORE_URL,
              )}
            >
              <ToggleSwitch
                checked={composerPermissionModeVisibility["full-access"]}
                disabled={isLoading || isSaving}
                ariaLabel={t("settings.agent.permissionsMode.fullAccess.toggle")}
                onChange={(checked) =>
                  persistComposerPermissionModeVisibility("full-access", checked)
                }
              />
            </SettingRow>
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">
            {t("settings.general.groupTitle")}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-4 text-[14px]">
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
                        normalizedLocaleOverride == null
                          ? "app-nav-item-active"
                          : "app-nav-item-idle",
                      ].join(" ")}
                    >
                      <span>{t("settings.ide.language.autoOption")}</span>
                      {normalizedLocaleOverride == null ? (
                        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                      ) : null}
                    </button>
                    <div className="mt-1 max-h-80 overflow-y-auto">
                      {filteredLocaleEntries.map((entry) => {
                        const isSelected = entry.code === normalizedLocaleOverride;
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
            {isMacOsPlatform ? (
              <SettingRow
                label={t("settings.general.macMenuBar.label")}
                description={t("settings.general.macMenuBar.description")}
              >
                <ToggleSwitch
                  checked={macMenuBarEnabled}
                  disabled={isLoading || isSaving}
                  ariaLabel={t("settings.general.macMenuBar.ariaLabel")}
                  onChange={(checked) => void persistMacMenuBarEnabled(checked)}
                />
              </SettingRow>
            ) : null}
            {showHotkeyWindowHotkeySetting ? (
              <SettingRow
                label={t(
                  "settings.general.experimentalFeatures.hotkeyWindowHotkey.label",
                )}
                description={hotkeyWindowHotkeyDescription}
              >
                {isCapturingHotkeyWindowHotkey ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      autoFocus
                      value={t(
                        "settings.general.experimentalFeatures.hotkeyWindowHotkey.capturePrompt",
                      )}
                      aria-label={t(
                        "settings.general.experimentalFeatures.hotkeyWindowHotkey.captureAriaLabel",
                      )}
                      onBlur={() => setIsCapturingHotkeyWindowHotkey(false)}
                      onKeyDown={(event) => {
                        if (event.repeat) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.key === "Escape") {
                          setIsCapturingHotkeyWindowHotkey(false);
                          return;
                        }
                        const accelerator = buildAcceleratorFromKeyboardEvent(
                          event.nativeEvent,
                        );
                        if (accelerator == null) {
                          return;
                        }
                        setIsCapturingHotkeyWindowHotkey(false);
                        void persistHotkeyWindowHotkey(accelerator);
                      }}
                      className="app-control h-9 w-36 rounded-[10px] px-3 py-2 text-[13px]"
                    />
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setIsCapturingHotkeyWindowHotkey(false)}
                      className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                    >
                      {t(
                        "settings.general.experimentalFeatures.hotkeyWindowHotkey.cancel",
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="min-w-20 text-right text-[13px] text-token-text-secondary">
                      {hotkeyWindowHotkeyStatusLabel}
                    </span>
                    <button
                      type="button"
                      disabled={isUpdatingHotkeyWindowHotkey}
                      onClick={() => {
                        setHotkeyWindowHotkeyError(null);
                        setIsCapturingHotkeyWindowHotkey(true);
                      }}
                      className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                    >
                      {configuredHotkeyWindowHotkey == null
                        ? t(
                            "settings.general.experimentalFeatures.hotkeyWindowHotkey.set",
                          )
                        : t(
                            "settings.general.experimentalFeatures.hotkeyWindowHotkey.change",
                          )}
                    </button>
                    {configuredHotkeyWindowHotkey != null ? (
                      <button
                        type="button"
                        disabled={isUpdatingHotkeyWindowHotkey}
                        onClick={() => void persistHotkeyWindowHotkey(null)}
                        className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                      >
                        {t(
                          "settings.general.experimentalFeatures.hotkeyWindowHotkey.clear",
                        )}
                      </button>
                    ) : null}
                  </div>
                )}
              </SettingRow>
            ) : null}
            {isWindowsPlatform ? null : (
              <SettingRow
                label={t("settings.general.power.preventSleepWhileRunning.label")}
                description={t(
                  "settings.general.power.preventSleepWhileRunning.description",
                )}
              >
                <ToggleSwitch
                  checked={state.preventSleepWhileRunning}
                  disabled={isLoading || isSaving}
                  ariaLabel={t(
                    "settings.general.power.preventSleepWhileRunning.label",
                  )}
                  onChange={(checked) =>
                    void persistChoice(
                      "preventSleepWhileRunning",
                      "preventSleepWhileRunning",
                      checked,
                    )
                  }
                />
              </SettingRow>
            )}
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
                modifierSymbol: composerModifierLabel,
              })}
              description={t("settings.general.enterBehavior.description", {
                modifierSymbol: composerModifierLabel,
              })}
            >
              <ToggleSwitch
                checked={state.composerEnterBehavior === "cmdIfMultiline"}
                disabled={isLoading || isSaving}
                ariaLabel={t("settings.general.enterBehavior.label", {
                  modifierSymbol: composerModifierLabel,
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
            {showSpeedSetting ? (
              <SettingRow
                label={t("settings.agent.speed.label")}
                description={t("settings.agent.speed.description")}
              >
                <SettingsChoiceMenu
                  disabled={isLoading || isSaving || isSpeedLoading}
                  options={speedOptions}
                  triggerLabel={speedTriggerLabel}
                  value={selectedSpeedMenuValue}
                  onChange={(value) =>
                    void persistServiceTier(value as SpeedMenuValue)
                  }
                />
              </SettingRow>
            ) : null}
            <SettingRow
              label={t("settings.general.followUpQueueMode.label")}
              description={t("settings.general.followUpQueueMode.description", {
                invertFollowUpShortcutLabel,
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
            {showAmbientSuggestionsSetting ? (
              <SettingRow
                label={t("settings.agent.ambientSuggestions.groupTitle")}
                description={t("settings.agent.ambientSuggestions.rowLabel")}
              >
                <ToggleSwitch
                  checked={ambientSuggestionsEnabled}
                  disabled={isLoading || isSaving}
                  ariaLabel={t("settings.agent.ambientSuggestions.toggleLabel")}
                  onChange={(checked) =>
                    void persistAmbientSuggestionsEnabled(checked)
                  }
                />
              </SettingRow>
            ) : null}
          </div>
        </div>
        {showDictationSettings ? (
          <>
            <div className="app-card rounded-[18px] px-5 py-4">
              <div className="app-title text-[14px] font-medium">
                {t("settings.general.dictation")}
              </div>
            </div>
            <div className="app-card overflow-hidden rounded-[18px]">
              <div className="divide-y divide-[var(--app-shell-border)]">
                <SettingRow
                  label={t("settings.general.globalDictationHotkey.label")}
                  description={globalDictationHotkeyDescription}
                >
                  <DictationHotkeyControl
                    capturePrompt={t(
                      "settings.general.globalDictationHotkey.capturePrompt",
                    )}
                    captureAriaLabel={t(
                      "settings.general.globalDictationHotkey.captureAriaLabel",
                    )}
                    cancelLabel={t(
                      "settings.general.globalDictationHotkey.cancel",
                    )}
                    changeLabel={t(
                      "settings.general.globalDictationHotkey.change",
                    )}
                    clearLabel={t(
                      "settings.general.globalDictationHotkey.clear",
                    )}
                    configuredHotkey={configuredGlobalDictationHotkey}
                    disabled={!isGlobalDictationHotkeySupported}
                    isCapturing={isCapturingGlobalDictationHotkey}
                    isUpdating={isUpdatingGlobalDictationHotkey}
                    setLabel={t("settings.general.globalDictationHotkey.set")}
                    statusLabel={globalDictationHotkeyStatusLabel}
                    onCancelCapture={() =>
                      setIsCapturingGlobalDictationHotkey(false)
                    }
                    onClear={() =>
                      void persistGlobalDictationHotkey({
                        hotkey: null,
                        kind: "hold",
                      })
                    }
                    onStartCapture={() => {
                      setGlobalDictationHotkeyError(null);
                      setIsCapturingGlobalDictationHotkey(true);
                    }}
                    onSubmit={(hotkey) =>
                      void persistGlobalDictationHotkey({
                        hotkey,
                        kind: "hold",
                      })
                    }
                  />
                </SettingRow>
                <SettingRow
                  label={t("settings.general.globalDictationToggleHotkey.label")}
                  description={globalDictationToggleHotkeyDescription}
                >
                  <DictationHotkeyControl
                    capturePrompt={t(
                      "settings.general.globalDictationHotkey.capturePrompt",
                    )}
                    captureAriaLabel={t(
                      "settings.general.globalDictationToggleHotkey.captureAriaLabel",
                    )}
                    cancelLabel={t(
                      "settings.general.globalDictationHotkey.cancel",
                    )}
                    changeLabel={t(
                      "settings.general.globalDictationToggleHotkey.change",
                    )}
                    clearLabel={t(
                      "settings.general.globalDictationToggleHotkey.clear",
                    )}
                    configuredHotkey={configuredGlobalDictationToggleHotkey}
                    disabled={!isGlobalDictationHotkeySupported}
                    isCapturing={isCapturingGlobalDictationToggleHotkey}
                    isUpdating={isUpdatingGlobalDictationToggleHotkey}
                    setLabel={t(
                      "settings.general.globalDictationToggleHotkey.set",
                    )}
                    statusLabel={globalDictationToggleHotkeyStatusLabel}
                    onCancelCapture={() =>
                      setIsCapturingGlobalDictationToggleHotkey(false)
                    }
                    onClear={() =>
                      void persistGlobalDictationHotkey({
                        hotkey: null,
                        kind: "toggle",
                      })
                    }
                    onStartCapture={() => {
                      setGlobalDictationToggleHotkeyError(null);
                      setIsCapturingGlobalDictationToggleHotkey(true);
                    }}
                    onSubmit={(hotkey) =>
                      void persistGlobalDictationHotkey({
                        hotkey,
                        kind: "toggle",
                      })
                    }
                  />
                </SettingRow>
                <GlobalDictationHistorySetting
                  copyingItemId={copyingGlobalDictationHistoryItemId}
                  items={globalDictationHistoryItems}
                  onCopy={(id) => void handleCopyGlobalDictationHistoryItem(id)}
                  t={t}
                />
                <DictationDictionarySetting
                  entries={visibleDictationDictionaryEntries}
                  isExpanded={isDictationDictionaryExpanded}
                  isSaving={isSaving}
                  onChange={setDictationDictionaryDraft}
                  onPersist={persistDictationDictionary}
                  onToggle={() => {
                    setIsDictationDictionaryExpanded((current) => !current);
                    setDictationDictionaryDraft(null);
                  }}
                  skipNextBlurPersistRef={skipNextDictationDictionaryBlurPersistRef}
                  t={t}
                />
              </div>
            </div>
          </>
        ) : null}
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">
            {t("settings.general.notifications")}
          </div>
        </div>
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="space-y-4 text-[14px]">
            <SettingRow
              label={t("notifications.turnMode.label")}
              description={t("notifications.turnMode.description")}
            >
              <SettingsChoiceMenu
                disabled={isLoading || isSaving}
                options={notificationTurnModeOptions}
                value={notificationTurnMode}
                onChange={(value) =>
                  void persistNotificationSetting(
                    "notifications-turn-mode",
                    value as NotificationTurnMode,
                    notificationTurnMode,
                    (nextValue) => setNotificationTurnMode(nextValue),
                  )
                }
              />
            </SettingRow>
            <SettingRow
              label={t("notifications.permissions.label")}
              description={t("notifications.permissions.description")}
            >
              <ToggleSwitch
                checked={notificationsPermissionsEnabled}
                disabled={isLoading || isSaving}
                ariaLabel={t("notifications.permissions.label")}
                onChange={(checked) =>
                  void persistNotificationSetting(
                    "notifications-permissions-enabled",
                    checked,
                    notificationsPermissionsEnabled,
                    (nextValue) => setNotificationsPermissionsEnabled(nextValue),
                  )
                }
              />
            </SettingRow>
            <SettingRow
              label={t("notifications.questions.label")}
              description={t("notifications.questions.description")}
            >
              <ToggleSwitch
                checked={notificationsQuestionsEnabled}
                disabled={isLoading || isSaving}
                ariaLabel={t("notifications.questions.label")}
                onChange={(checked) =>
                  void persistNotificationSetting(
                    "notifications-questions-enabled",
                    checked,
                    notificationsQuestionsEnabled,
                    (nextValue) => setNotificationsQuestionsEnabled(nextValue),
                  )
                }
              />
            </SettingRow>
          </div>
        </div>
        {showGpuTearingDebugSettings ? (
          <>
            <div className="app-card rounded-[18px] px-5 py-4">
              <div className="space-y-1">
                <div className="app-title text-[14px] font-medium">
                  {t("settings.general.gpuTearingDebug")}
                </div>
                <p className="text-[13px] leading-5 text-[var(--app-shell-subtle)]">
                  {t("settings.general.gpuTearingDebug.subtitle")}
                </p>
              </div>
            </div>
            <div className="app-card rounded-[18px] px-5 py-4">
              <div className="space-y-4 text-[14px]">
                {gpuTearingDebugSettingRows.map((setting) => (
                  <SettingRow
                    key={setting.key}
                    label={setting.label}
                    description={setting.description}
                  >
                    <ToggleSwitch
                      checked={gpuTearingDebugSettings[setting.key]}
                      disabled={false}
                      ariaLabel={t("settings.general.gpuTearingDebug.toggle", {
                        settingName: setting.label,
                      })}
                      onChange={(checked) =>
                        persistGpuTearingDebugSetting(setting.key, checked)
                      }
                    />
                  </SettingRow>
                ))}
              </div>
            </div>
          </>
        ) : null}
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

function DictationHotkeyControl({
  cancelLabel,
  capturePrompt,
  captureAriaLabel,
  changeLabel,
  clearLabel,
  configuredHotkey,
  disabled,
  isCapturing,
  isUpdating,
  setLabel,
  statusLabel,
  onCancelCapture,
  onClear,
  onStartCapture,
  onSubmit,
}: {
  cancelLabel: string;
  capturePrompt: string;
  captureAriaLabel: string;
  changeLabel: string;
  clearLabel: string;
  configuredHotkey: string | null;
  disabled: boolean;
  isCapturing: boolean;
  isUpdating: boolean;
  setLabel: string;
  statusLabel: string;
  onCancelCapture: () => void;
  onClear: () => void;
  onStartCapture: () => void;
  onSubmit: (hotkey: string) => void;
}) {
  if (isCapturing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          autoFocus
          value={capturePrompt}
          aria-label={captureAriaLabel}
          onBlur={onCancelCapture}
          onKeyDown={(event) => {
            if (event.repeat) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") {
              onCancelCapture();
              return;
            }
            const accelerator = buildAcceleratorFromKeyboardEvent(
              event.nativeEvent,
            );
            if (accelerator == null) {
              return;
            }
            onCancelCapture();
            onSubmit(accelerator);
          }}
          className="app-control h-9 w-36 rounded-[10px] px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancelCapture}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-20 text-right text-[13px] text-token-text-secondary">
        {statusLabel}
      </span>
      <button
        type="button"
        disabled={disabled || isUpdating}
        onClick={onStartCapture}
        className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
      >
        {configuredHotkey == null ? setLabel : changeLabel}
      </button>
      {configuredHotkey != null ? (
        <button
          type="button"
          disabled={disabled || isUpdating}
          onClick={onClear}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

function GlobalDictationHistorySetting({
  copyingItemId,
  items,
  onCopy,
  t,
}: {
  copyingItemId: string | null;
  items: GlobalDictationHistoryItem[];
  onCopy: (id: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="px-3 py-3">
      <div className="text-sm text-[var(--app-shell-text)]">
        {t("settings.general.globalDictationHistory.emptyTitle")}
      </div>
      {items.length === 0 ? (
        <div className="app-text-muted mt-1 text-sm leading-5">
          {t("settings.general.globalDictationHistory.emptyDescription")}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="app-control flex items-start gap-3 rounded-[12px] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-wrap break-words text-[13px]">
                  {item.text}
                </div>
                <div className="app-text-muted mt-1 text-[12px]">
                  {formatCompactRelativeTime(item.createdAtMs, t)}
                </div>
              </div>
              <button
                type="button"
                disabled={copyingItemId === item.id}
                onClick={() => onCopy(item.id)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("settings.general.globalDictationHistory.copy")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DictationDictionarySetting({
  entries,
  isExpanded,
  isSaving,
  onChange,
  onPersist,
  onToggle,
  skipNextBlurPersistRef,
  t,
}: {
  entries: string[];
  isExpanded: boolean;
  isSaving: boolean;
  onChange: (entries: string[]) => void;
  onPersist: (entries: string[]) => Promise<void>;
  onToggle: () => void;
  skipNextBlurPersistRef: { current: boolean };
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="min-w-0 text-sm text-[var(--app-shell-text)]">
            {t("settings.general.dictationDictionary.label")}
          </span>
          <span className="app-text-muted min-w-0 text-sm">
            {t("settings.general.dictationDictionary.description")}
          </span>
        </span>
        <ChevronDownIcon
          className={[
            "h-4 w-4 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
            isExpanded ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {isExpanded ? (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
            {entries.map((entry, index) => {
              const disableRemove =
                entries.length === 1 && entry.length === 0;
              return (
                <div key={`dictation-dictionary-entry-${index}`} className="relative">
                  <input
                    autoFocus={index === 0}
                    data-dictation-dictionary-entry-index={index}
                    aria-label={t("settings.general.dictationDictionary.entryLabel")}
                    className="app-control w-full rounded-[10px] px-3 py-2 pr-9 text-[13px] outline-none"
                    disabled={isSaving}
                    placeholder={
                      DICTATION_DICTIONARY_PLACEHOLDERS[index] ??
                      DICTATION_DICTIONARY_PLACEHOLDERS[0]
                    }
                    value={entry}
                    onChange={(event) => {
                      const nextEntries = [...entries];
                      nextEntries[index] = event.currentTarget.value;
                      onChange(nextEntries);
                    }}
                    onBlur={() => {
                      if (skipNextBlurPersistRef.current) {
                        skipNextBlurPersistRef.current = false;
                        return;
                      }
                      void onPersist(entries);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      event.preventDefault();
                      const nextEntries = [
                        ...entries.slice(0, index + 1),
                        EMPTY_DICTATION_DICTIONARY_ENTRY,
                        ...entries.slice(index + 1),
                      ];
                      skipNextBlurPersistRef.current = true;
                      onChange(nextEntries);
                      requestAnimationFrame(() => {
                        document
                          .querySelector<HTMLInputElement>(
                            `[data-dictation-dictionary-entry-index="${index + 1}"]`,
                          )
                          ?.focus();
                      });
                    }}
                  />
                  <button
                    type="button"
                    aria-label={t("settings.general.dictationDictionary.removeEntry")}
                    disabled={isSaving || disableRemove}
                    onClick={() =>
                      void onPersist(
                        entries.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                    className="app-control absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] disabled:opacity-60"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onChange([...entries, EMPTY_DICTATION_DICTIONARY_ENTRY])
            }
            className="app-control flex items-center justify-center gap-2 rounded-[11px] border-dashed px-3 py-1.5 text-[12px] text-[var(--app-shell-muted)] disabled:opacity-60"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t("settings.general.dictationDictionary.addEntry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function normalizeDictationDictionaryEntries(entries: string[]) {
  return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function normalizeNotificationTurnMode(value: unknown): NotificationTurnMode {
  return value === "off" || value === "unfocused" || value === "always"
    ? value
    : "unfocused";
}

function canUseFastModeFromSettingsSurface(
  configRequirements: ConfigRequirementsReadResponse,
  models: ModelListResponse,
) {
  if (configRequirements.requirements?.featureRequirements?.fast_mode === false) {
    return false;
  }

  return models.data.some((model) =>
    model.additionalSpeedTiers.includes("fast"),
  );
}

function normalizeAmbientSuggestionsEnabled(value: unknown): boolean {
  return value !== false;
}

function isAmbientSuggestionsEligible(
  authSnapshot: AuthSnapshot | null,
  accountInfo: AccountInfoResponse | null,
): boolean {
  const authMethod = authSnapshot?.authState.authMethod;
  if (authMethod === "apikey") {
    return true;
  }
  if (authMethod !== "chatgpt") {
    return false;
  }

  const email = accountInfo?.email ?? authSnapshot?.authState.email;
  const plan = accountInfo?.plan ?? authSnapshot?.authState.planAtLogin;
  return hasOpenAiEmail(email) || hasSupportedAmbientSuggestionsPlan(plan);
}

function hasOpenAiEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase().endsWith("@openai.com") === true;
}

function hasSupportedAmbientSuggestionsPlan(plan: string | null | undefined): boolean {
  if (plan == null) {
    return false;
  }
  return AMBIENT_SUGGESTIONS_SUPPORTED_PLANS.has(plan.trim().toLowerCase());
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

function renderLinkedDescription(description: string, href: string): ReactNode {
  const match = description.match(/^(.*)<a>(.*)<\/a>(.*)$/);
  if (!match) {
    return description;
  }

  const [, prefix, linkText, suffix] = match;
  return (
    <>
      {prefix}
      <a
        className="inline-flex text-[var(--app-shell-accent)]"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {linkText}
      </a>
      {suffix}
    </>
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
