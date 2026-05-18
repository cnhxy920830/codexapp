import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../i18n/i18n";
import { refreshAmbientSuggestions } from "../../../services/debug";
import { importExternalAgentItems } from "../../../services/externalAgentImport";
import {
  readComposerPermissionModeVisibility,
  setGlobalState,
  updateComposerPermissionModeVisibility,
} from "../../../services/settings";
import { clearActiveWorkspaceRoot } from "../../../services/workspaceRoots";
import {
  logReplicaStatsigProductEvent,
  readReplicaStatsigTelemetryIdentity,
} from "../../statsig/replicaStatsig";
import {
  buildExternalAgentImportSummary,
  buildSelectedExternalAgentImportItems,
  createDefaultExternalAgentImportSelection,
  hasExternalAgentImportSelection,
  setExternalAgentImportGroupSelection,
} from "./importModel";
import { CODING_ROLE_IDS, DEFAULT_WELCOME_ROLE_ID, WELCOME_ROLE_IDS } from "./constants";
import {
  ExternalAgentImportCustomizeDialog,
  ExternalAgentImportItemsStep,
  ExternalAgentImportProviderStep,
} from "./importSteps";
import { IntentSelectionStep, RoleSelectionStep, WorkModeSelectionStep } from "./selectionSteps";
import { WelcomeShell } from "./shared";
import { useExternalAgentImportDetection } from "./useExternalAgentImportDetection";
import type {
  ExternalAgentProviderId,
  WelcomeIntentId,
  WelcomeMode,
  WelcomeImportSelection,
  WelcomeRoleId,
  WelcomeWorkMode,
} from "./types";

type WelcomeFlowMode = Exclude<WelcomeMode, "simple">;
type WelcomeStage = WelcomeFlowMode | "workMode" | "externalAgentImportProvider" | "externalAgentImport";
const AMBIENT_SUGGESTIONS_CONNECTED_APPS_CONSENT_KEY =
  "has-seen-ambient-suggestions-connected-apps-consent";

type WelcomeSelectionState = {
  intents: WelcomeIntentId[];
  personalizedSuggestionsEnabled: boolean;
  roles: Array<WelcomeRoleId | typeof DEFAULT_WELCOME_ROLE_ID>;
  workMode: WelcomeWorkMode | null;
};

type WelcomeFlowProps = {
  clearActiveWorkspaceRootOnComplete: boolean;
  externalAgentImportEnabled: boolean;
  experimentArm: string | undefined;
  isCoworkMigrationEnabled: boolean;
  mode: WelcomeFlowMode;
  onCompleteToHome: () => void;
};

const NON_CODING_SANS_FONT_SIZE = 14;
const NON_CODING_CODE_FONT_SIZE = 13;
const DEFAULT_SELECTION: WelcomeSelectionState = {
  intents: [],
  personalizedSuggestionsEnabled: true,
  roles: [],
  workMode: null,
};

export function WelcomeFlow({
  clearActiveWorkspaceRootOnComplete,
  externalAgentImportEnabled,
  experimentArm,
  isCoworkMigrationEnabled,
  mode,
  onCompleteToHome,
}: WelcomeFlowProps) {
  const { t } = useI18n();
  const [stage, setStage] = useState<WelcomeStage>(mode);
  const [selection, setSelection] = useState<WelcomeSelectionState>(DEFAULT_SELECTION);
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<WelcomeImportSelection>({});
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastViewedStepRef = useRef<string | null>(null);

  const { detectedItems, isDetectingImports, providerIds, selectedProviders, setSelectedProviders } =
    useExternalAgentImportDetection({
      enabled: externalAgentImportEnabled,
      isCoworkMigrationEnabled,
    });

  useEffect(() => {
    setStage(mode);
    setSelection(DEFAULT_SELECTION);
    setSelectedImportItemIds({});
    setIsCustomizeDialogOpen(false);
    setIsCompleting(false);
    setIsImporting(false);
    setErrorMessage(null);
  }, [mode]);

  useEffect(() => {
    const step = mapWelcomeStageToTelemetryStep(stage);
    if (step == null || lastViewedStepRef.current === step) {
      return;
    }

    lastViewedStepRef.current = step;
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_viewed",
      metadata: {
        step,
      },
    });
  }, [stage]);

  const overallImportSummary = useMemo(
    () => buildExternalAgentImportSummary(detectedItems, providerIds, t),
    [detectedItems, providerIds, t],
  );

  const selectedImportSummary = useMemo(
    () => buildExternalAgentImportSummary(detectedItems, selectedProviders, t),
    [detectedItems, selectedProviders, t],
  );

  const selectedImportItems = useMemo(
    () => buildSelectedExternalAgentImportItems(detectedItems, selectedProviders, selectedImportItemIds),
    [detectedItems, selectedImportItemIds, selectedProviders],
  );

  function logWelcomeProductEvent(
    eventName: string,
    metadata: Record<string, unknown>,
  ) {
    logReplicaStatsigProductEvent({
      eventName,
      metadata: {
        ...metadata,
        ...buildWelcomeTelemetryBaseMetadata(experimentArm),
      },
    });
  }

  function logWelcomeOptionToggled(params: {
    option: string;
    selected: boolean;
    state: WelcomeSelectionState;
    telemetryStep: "intent" | "role" | "work_mode";
  }) {
    logWelcomeProductEvent("codex_onboarding_welcome_option_toggled", {
      option: params.option,
      selected: params.selected,
      step: params.telemetryStep,
      ...buildSelectionTelemetryMetadata(params.telemetryStep, params.state),
    });
  }

  function logWelcomeSkipClicked(
    telemetryStep: "intent" | "role",
    state: WelcomeSelectionState,
  ) {
    logWelcomeProductEvent("codex_onboarding_welcome_skip_clicked", {
      step: telemetryStep,
      ...buildSelectionTelemetryMetadata(telemetryStep, state),
    });
  }

  function logExternalAgentImportEvent(
    action: "continue" | "shown" | "skipped",
    summary: ReturnType<typeof buildExternalAgentImportSummary> | null,
    eventSelection = summary == null
      ? null
      : createDefaultExternalAgentImportSelection(summary),
  ) {
    if (summary == null || eventSelection == null) {
      return;
    }

    logWelcomeProductEvent("codex_onboarding_external_agent_import_event", {
      action,
      source: "first_time_onboarding",
      ...buildExternalAgentImportEventMetadata(summary, eventSelection),
    });
  }

  return (
    <WelcomeShell>
      {stage === "intent" ? (
        <IntentSelectionStep
          onContinue={() => void handleIntentContinue()}
          onPersonalizedSuggestionsChange={(checked) =>
            setSelection((current) => ({ ...current, personalizedSuggestionsEnabled: checked }))
          }
          onSkip={() => void handleIntentSkip()}
          onToggleIntent={handleIntentToggle}
          personalizedSuggestionsEnabled={selection.personalizedSuggestionsEnabled}
          selectedIntents={selection.intents}
          t={t}
        />
      ) : null}
      {stage === "workMode" ? (
        <WorkModeSelectionStep
          isContinueDisabled={isDetectingImports || selection.workMode == null}
          onChooseWorkMode={handleWorkModeChange}
          onContinue={() => void handleWorkModeContinue()}
          selectedWorkMode={selection.workMode}
          t={t}
        />
      ) : null}
      {stage === "role" ? (
        <RoleSelectionStep
          isContinueDisabled={isDetectingImports || selection.roles.length === 0}
          onContinue={() => void handleRoleContinue()}
          onPersonalizedSuggestionsChange={(checked) =>
            setSelection((current) => ({ ...current, personalizedSuggestionsEnabled: checked }))
          }
          onSkip={() => void handleRoleSkip()}
          onToggleRole={handleRoleToggle}
          personalizedSuggestionsEnabled={selection.personalizedSuggestionsEnabled}
          selectedRoles={selection.roles.filter(isWelcomeRoleId)}
          t={t}
        />
      ) : null}
      {stage === "externalAgentImportProvider" && overallImportSummary != null ? (
        <ExternalAgentImportProviderStep
          onContinue={() => void handleProviderContinue()}
          onSkip={() => void handleProviderSkip()}
          onToggleProvider={handleProviderToggle}
          providerIds={providerIds}
          selectedProviders={selectedProviders}
          t={t}
        />
      ) : null}
      {stage === "externalAgentImport" && selectedImportSummary != null ? (
        <ExternalAgentImportItemsStep
          errorMessage={errorMessage}
          isPending={isImporting || isCompleting}
          isContinueDisabled={!hasExternalAgentImportSelection(selectedImportSummary, selectedImportItemIds)}
          onContinue={() => void handleImportContinue()}
          onOpenCustomize={() => setIsCustomizeDialogOpen(true)}
          onSkip={() => void handleImportItemsSkip()}
          onToggleChats={handleToggleChats}
          onToggleGroup={handleToggleImportGroup}
          selection={selectedImportItemIds}
          summary={selectedImportSummary}
          t={t}
        />
      ) : null}
      {isCustomizeDialogOpen && selectedImportSummary != null ? (
        <ExternalAgentImportCustomizeDialog
          items={selectedImportSummary.customizeItems}
          onClose={() => setIsCustomizeDialogOpen(false)}
          onConfirm={handleCustomizeConfirm}
          selectedItemIds={selectedImportItemIds}
          t={t}
        />
      ) : null}
    </WelcomeShell>
  );

  function handleIntentToggle(intent: WelcomeIntentId) {
    setSelection((current) => {
      const intents = current.intents.includes(intent)
        ? current.intents.filter((value) => value !== intent)
        : [...current.intents, intent];
      const nextSelection = { ...current, intents };
      logWelcomeOptionToggled({
        option: intent,
        selected: !current.intents.includes(intent),
        state: nextSelection,
        telemetryStep: "intent",
      });
      return nextSelection;
    });
  }

  function handleRoleToggle(role: WelcomeRoleId) {
    setSelection((current) => {
      const roles: WelcomeSelectionState["roles"] = current.roles.includes(role)
        ? current.roles.filter((value) => value !== role)
        : [...current.roles, role];
      const nextSelection: WelcomeSelectionState = {
        ...current,
        roles,
        workMode: deriveWorkModeFromRoles(roles),
      };
      logWelcomeOptionToggled({
        option: role,
        selected: !current.roles.includes(role),
        state: nextSelection,
        telemetryStep: "role",
      });
      return nextSelection;
    });
  }

  function handleWorkModeChange(workMode: WelcomeWorkMode) {
    setSelection((current) => {
      const nextSelection = { ...current, workMode };
      logWelcomeOptionToggled({
        option: workMode,
        selected: true,
        state: nextSelection,
        telemetryStep: "work_mode",
      });
      return nextSelection;
    });
  }

  async function handleIntentContinue() {
    const nextSelection = {
      ...selection,
      workMode: selection.workMode ?? deriveWorkModeFromIntents(selection.intents),
    };
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_continue_clicked",
      metadata: {
        step: "task_picker",
      },
    });
    setSelection(nextSelection);
    setStage("workMode");
  }

  async function handleIntentSkip() {
    logWelcomeSkipClicked("intent", {
      ...selection,
      personalizedSuggestionsEnabled: false,
    });
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_skipped",
      metadata: {
        step: "task_picker",
      },
    });
    await completeWelcomeFlow({
      intents: ["build_software"],
      personalizedSuggestionsEnabled: false,
      roles: [],
      workMode: "coding",
    });
  }

  async function handleWorkModeContinue() {
    if (selection.workMode == null || isDetectingImports) {
      return;
    }

    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_continue_clicked",
      metadata: {
        step: "work_mode",
      },
    });
    const nextSummary = overallImportSummary;
    if (nextSummary == null) {
      await completeWelcomeFlow(selection);
      return;
    }

    logExternalAgentImportEvent("shown", nextSummary);
    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImportProvider");
  }

  async function handleRoleContinue() {
    if (selection.roles.length === 0 || isDetectingImports) {
      return;
    }

    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_continue_clicked",
      metadata: {
        step: "role_selection",
      },
    });
    const nextSummary = overallImportSummary;
    if (nextSummary == null) {
      await completeWelcomeFlow(selection);
      return;
    }

    logExternalAgentImportEvent("shown", nextSummary);
    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImportProvider");
  }

  async function handleRoleSkip() {
    const nextSelection: WelcomeSelectionState = {
      intents: [],
      personalizedSuggestionsEnabled: false,
      roles: [DEFAULT_WELCOME_ROLE_ID],
      workMode: "coding",
    };
    const nextSummary = overallImportSummary;
    logWelcomeSkipClicked("role", nextSelection);
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_skipped",
      metadata: {
        step: "role_selection",
      },
    });
    setSelection(nextSelection);

    if (nextSummary == null) {
      await completeWelcomeFlow(nextSelection);
      return;
    }

    logExternalAgentImportEvent("shown", nextSummary);
    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImportProvider");
  }

  function handleProviderToggle(providerId: ExternalAgentProviderId) {
    setSelectedProviders((current) =>
      current.includes(providerId) ? current.filter((value) => value !== providerId) : [...current, providerId],
    );
  }

  async function handleProviderContinue() {
    const nextSummary = selectedImportSummary;
    if (nextSummary == null) {
      logExternalAgentImportEvent("skipped", overallImportSummary);
      await completeWelcomeFlow(selection);
      return;
    }

    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImport");
  }

  async function handleProviderSkip() {
    logExternalAgentImportEvent("skipped", overallImportSummary);
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_skipped",
      metadata: {
        step: "agent_migration",
      },
    });
    await completeWelcomeFlow(selection);
  }

  async function handleImportItemsSkip() {
    logExternalAgentImportEvent(
      "skipped",
      selectedImportSummary,
      selectedImportItemIds,
    );
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_step_skipped",
      metadata: {
        step: "agent_migration",
      },
    });
    await completeWelcomeFlow(selection);
  }

  function handleToggleImportGroup(group: "toolsAndSetup" | "projects") {
    if (selectedImportSummary == null) {
      return;
    }

    const groupItems = selectedImportSummary.customizeItems.filter((item) => item.group === group);
    const allSelected = groupItems.every((item) => selectedImportItemIds[item.id] === true);
    setSelectedImportItemIds((current) =>
      setExternalAgentImportGroupSelection(current, selectedImportSummary, group, !allSelected),
    );
  }

  function handleToggleChats() {
    const chatChoiceKey = selectedImportSummary?.chatChoiceKey;
    if (chatChoiceKey == null) {
      return;
    }

    setSelectedImportItemIds((current) => ({
      ...current,
      [chatChoiceKey]: !(current[chatChoiceKey] === true),
    }));
  }

  function handleCustomizeConfirm(nextSelectedIds: WelcomeImportSelection) {
    setSelectedImportItemIds(nextSelectedIds);
    setIsCustomizeDialogOpen(false);
  }

  async function handleImportContinue() {
    if (
      selectedImportSummary == null ||
      isImporting ||
      isCompleting ||
      !hasExternalAgentImportSelection(selectedImportSummary, selectedImportItemIds)
    ) {
      return;
    }

    setErrorMessage(null);
    setIsImporting(true);
    try {
      logReplicaStatsigProductEvent({
        eventName: "codex_onboarding_step_continue_clicked",
        metadata: {
          step: "agent_migration",
        },
      });
      logExternalAgentImportEvent(
        "continue",
        selectedImportSummary,
        selectedImportItemIds,
      );
      await importExternalAgentItems({
        items: selectedImportItems,
      });
      await completeWelcomeFlow(selection);
    } catch {
      setErrorMessage(t("onboarding.welcomeV2.externalAgentImport.error"));
      setIsImporting(false);
    }
  }

  async function completeWelcomeFlow(nextSelection: WelcomeSelectionState) {
    if (isCompleting) {
      return;
    }

    setErrorMessage(null);
    setIsCompleting(true);
    try {
      const workMode = nextSelection.workMode ?? deriveWorkMode(nextSelection);
      const completedAt = Math.floor(Date.now() / 1_000);
      const personalizedSuggestionsEnabled = nextSelection.personalizedSuggestionsEnabled ?? true;
      const showTechnicalControls = workMode !== "non_coding";
      logWelcomeProductEvent("codex_onboarding_completed", {
        experiment_arm: experimentArm,
        personalized_suggestions_enabled: personalizedSuggestionsEnabled,
        selected_workspaces_count: 0,
      });
      const updates = [
        setGlobalState("ambient-suggestions-enabled", personalizedSuggestionsEnabled),
        setGlobalState("active-remote-project-id", null),
        setGlobalState("conversationDetailMode", workMode === "non_coding" ? "STEPS_PROSE" : "STEPS_COMMANDS"),
        setGlobalState("electron:onboarding-override", "auto"),
        setGlobalState("electron:onboarding-welcome-pending", false),
        setGlobalState("electron:onboarding-projectless-completed", true),
        setGlobalState("electron:onboarding-hide-first-new-thread-promos", true),
        setGlobalState("electron:onboarding-plugin-checklist-active", true),
        setGlobalState("last_completed_onboarding", completedAt),
      ];

      updateComposerPermissionModeVisibility({
        mode: "guardian-approvals",
        settings: readComposerPermissionModeVisibility(),
        visible: showTechnicalControls,
      });
      updateComposerPermissionModeVisibility({
        mode: "full-access",
        settings: readComposerPermissionModeVisibility(),
        visible: showTechnicalControls,
      });

      if (workMode === "non_coding") {
        updates.push(
          setGlobalState("sansFontSize", NON_CODING_SANS_FONT_SIZE),
          setGlobalState("codeFontSize", NON_CODING_CODE_FONT_SIZE),
        );
      }

      if (personalizedSuggestionsEnabled) {
        updates.push(
          setGlobalState(AMBIENT_SUGGESTIONS_CONNECTED_APPS_CONSENT_KEY, true),
        );
        void refreshAmbientSuggestions({
          hostId: null,
          projectRoot: "~",
        }).catch(() => undefined);
      }

      if (clearActiveWorkspaceRootOnComplete) {
        void clearActiveWorkspaceRoot().catch(() => undefined);
      }

      if (mode === "role") {
        updates.push(
          setGlobalState("electron:onboarding-welcome-v2-role-state", {
            personalizedSuggestionsEnabled,
            roles: nextSelection.roles,
            workMode,
          }),
        );
      } else {
        updates.push(
          setGlobalState("electron:onboarding-welcome-v2-state", {
            intents: nextSelection.intents,
            personalizedSuggestionsEnabled,
            workMode,
          }),
        );
      }

      await Promise.all(updates);
      onCompleteToHome();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setIsCompleting(false);
      setIsImporting(false);
    }
  }
}

function deriveWorkMode(selection: WelcomeSelectionState): WelcomeWorkMode {
  return deriveWorkModeFromRoles(selection.roles) === "coding" || selection.intents.includes("build_software")
    ? "coding"
    : deriveWorkModeFromIntents(selection.intents);
}

function buildWelcomeTelemetryBaseMetadata(experimentArm: string | undefined) {
  const identity = readReplicaStatsigTelemetryIdentity();
  return {
    experiment_arm: experimentArm,
    user_id: identity.userId,
    workspace_id: identity.workspaceId,
  };
}

function mapWelcomeStageToTelemetryStep(stage: WelcomeStage) {
  switch (stage) {
    case "intent":
      return "task_picker";
    case "workMode":
      return "work_mode";
    case "role":
      return "role_selection";
    case "externalAgentImport":
    case "externalAgentImportProvider":
      return "agent_migration";
    default:
      return null;
  }
}

function buildSelectionTelemetryMetadata(
  telemetryStep: "intent" | "role" | "work_mode",
  state: WelcomeSelectionState,
) {
  switch (telemetryStep) {
    case "intent":
      return {
        selected_intents: state.intents.join(","),
        selected_work_mode: state.workMode ?? undefined,
      };
    case "role":
      return {
        selected_roles: state.roles.join(","),
        selected_work_mode: state.workMode ?? undefined,
      };
    case "work_mode":
      return {
        selected_intents: state.intents.join(","),
        selected_work_mode: state.workMode ?? undefined,
      };
    default:
      return {};
  }
}

function buildExternalAgentImportEventMetadata(
  summary: NonNullable<ReturnType<typeof buildExternalAgentImportSummary>>,
  selection: WelcomeImportSelection,
) {
  const selectedCountByType = {
    agents_selected_count: 0,
    commands_selected_count: 0,
    hooks_selected_count: 0,
    instructions_selected_count: 0,
    mcp_servers_selected_count: 0,
    plugins_selected_count: 0,
    settings_selected_count: 0,
    skills_selected_count: 0,
  };
  const itemTypeToMetric = {
    AGENTS_MD: "instructions_selected_count",
    COMMANDS: "commands_selected_count",
    CONFIG: "settings_selected_count",
    HOOKS: "hooks_selected_count",
    MCP_SERVER_CONFIG: "mcp_servers_selected_count",
    PLUGINS: "plugins_selected_count",
    SKILLS: "skills_selected_count",
    SUBAGENTS: "agents_selected_count",
  } as const;

  let totalItemsCount = 0;
  for (const item of summary.customizeItems) {
    const itemType = item.id.split(":")[0] as keyof typeof itemTypeToMetric;
    const metricKey = itemTypeToMetric[itemType];
    if (metricKey == null) {
      continue;
    }

    totalItemsCount += 1;
    if (selection[item.id] === true) {
      selectedCountByType[metricKey] += 1;
    }
  }

  const selectedItemsCount = Object.values(selectedCountByType).reduce(
    (count, value) => count + value,
    0,
  );

  return {
    ...selectedCountByType,
    chats_count: summary.recentChatCount,
    chats_selected:
      summary.chatChoiceKey == null ? false : selection[summary.chatChoiceKey] === true,
    projects_count: summary.projectCount,
    projects_selected:
      summary.projectChoiceKey == null
        ? false
        : selection[summary.projectChoiceKey] === true,
    selected_items_count: selectedItemsCount,
    total_items_count: totalItemsCount,
  };
}

function deriveWorkModeFromIntents(intents: WelcomeIntentId[]) {
  return intents.some((intent) => intent === "build_software" || intent === "analyze_data")
    ? "coding"
    : "non_coding";
}

function deriveWorkModeFromRoles(roles: WelcomeSelectionState["roles"]) {
  return roles.some((role) => CODING_ROLE_IDS.has(role))
    ? "coding"
    : "non_coding";
}

function isWelcomeRoleId(role: WelcomeSelectionState["roles"][number]): role is WelcomeRoleId {
  return WELCOME_ROLE_IDS.includes(role as WelcomeRoleId);
}
