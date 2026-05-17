import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n/i18n";
import { importExternalAgentItems } from "../../../services/externalAgentImport";
import {
  readComposerPermissionModeVisibility,
  setGlobalState,
  updateComposerPermissionModeVisibility,
} from "../../../services/settings";
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

type WelcomeSelectionState = {
  intents: WelcomeIntentId[];
  personalizedSuggestionsEnabled: boolean;
  roles: Array<WelcomeRoleId | typeof DEFAULT_WELCOME_ROLE_ID>;
  workMode: WelcomeWorkMode | null;
};

type WelcomeFlowProps = {
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

export function WelcomeFlow({ mode, onCompleteToHome }: WelcomeFlowProps) {
  const { t } = useI18n();
  const [stage, setStage] = useState<WelcomeStage>(mode);
  const [selection, setSelection] = useState<WelcomeSelectionState>(DEFAULT_SELECTION);
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<WelcomeImportSelection>({});
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { detectedItems, isDetectingImports, providerIds, selectedProviders, setSelectedProviders } =
    useExternalAgentImportDetection({
      enabled: true,
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
          onSkip={() => void handleImportSkip()}
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
          onSkip={() => void handleImportSkip()}
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
      return { ...current, intents };
    });
  }

  function handleRoleToggle(role: WelcomeRoleId) {
    setSelection((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((value) => value !== role)
        : [...current.roles, role];
      return {
        ...current,
        roles,
        workMode: deriveWorkModeFromRoles(roles),
      };
    });
  }

  function handleWorkModeChange(workMode: WelcomeWorkMode) {
    setSelection((current) => ({ ...current, workMode }));
  }

  async function handleIntentContinue() {
    setSelection((current) => ({
      ...current,
      workMode: current.workMode ?? deriveWorkModeFromIntents(current.intents),
    }));
    setStage("workMode");
  }

  async function handleIntentSkip() {
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

    const nextSummary = overallImportSummary;
    if (nextSummary == null) {
      await completeWelcomeFlow(selection);
      return;
    }

    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImportProvider");
  }

  async function handleRoleContinue() {
    if (selection.roles.length === 0 || isDetectingImports) {
      return;
    }

    const nextSummary = overallImportSummary;
    if (nextSummary == null) {
      await completeWelcomeFlow(selection);
      return;
    }

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
    setSelection(nextSelection);

    if (nextSummary == null) {
      await completeWelcomeFlow(nextSelection);
      return;
    }

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
      await completeWelcomeFlow(selection);
      return;
    }

    setSelectedImportItemIds(createDefaultExternalAgentImportSelection(nextSummary));
    setStage("externalAgentImport");
  }

  async function handleImportSkip() {
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
      const updates = [
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
        updates.push(setGlobalState("ambient-suggestions-enabled", true));
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
