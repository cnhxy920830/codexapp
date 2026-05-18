import { useEffect } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  REPLICA_STATSIG_GATES,
  logReplicaStatsigProductEvent,
  readReplicaStatsigTelemetryIdentity,
  useReplicaStatsigGateValue,
  useReplicaStatsigState,
} from "../statsig/replicaStatsig";
import { WelcomeFlow } from "./welcome/WelcomeFlow";
import { SimpleWelcomeCard, WelcomeShell } from "./welcome/steps";
import {
  shouldUseWelcomeV2WorkspaceOnboarding,
  type WorkspaceOnboardingExperimentAssignment,
} from "./selectWorkspaceModel";
import { useWelcomeMode } from "./welcome/useWelcomeMode";

type WelcomePageProps = {
  isWelcomeTarget: boolean;
  onAutoCompleteToHome: () => void;
  onCompleteToHome: () => void;
  onContinueToWorkspace: () => void;
  workspaceOnboardingExperimentAssignment: WorkspaceOnboardingExperimentAssignment;
};

export function WelcomePage({
  isWelcomeTarget,
  onAutoCompleteToHome,
  onCompleteToHome,
  onContinueToWorkspace,
  workspaceOnboardingExperimentAssignment,
}: WelcomePageProps) {
  const { t } = useI18n();
  const welcomeV2FlowEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.workspaceOnboardingWelcomeV2Flow,
  );
  const statsigState = useReplicaStatsigState();
  const externalAgentImportEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.externalAgentOnboardingImport,
  );
  const externalAgentCoworkMigrationEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.externalAgentCoworkMigration,
  );
  const shouldUseWelcomeV2Onboarding = shouldUseWelcomeV2WorkspaceOnboarding({
    assignment: workspaceOnboardingExperimentAssignment,
    welcomeV2FlowEnabled,
  });
  const mode = useWelcomeMode({
    statsigIsLoading: statsigState.isLoading,
    welcomeV2DefaultFlowEnabled: useReplicaStatsigGateValue(
      REPLICA_STATSIG_GATES.workspaceOnboardingWelcomeV2DefaultFlow,
    ),
  });

  const experimentArm = workspaceOnboardingExperimentAssignment?.arm;

  if (!shouldUseWelcomeV2Onboarding) {
    if (!isWelcomeTarget) {
      return (
        <AutoCompleteToHome
          experimentArm={experimentArm}
          onAutoCompleteToHome={onAutoCompleteToHome}
        />
      );
    }

    return (
      <WelcomeShell>
        <SimpleWelcomeCard onContinue={onContinueToWorkspace} t={t} />
      </WelcomeShell>
    );
  }

  if (mode === null) {
    return null;
  }

  return (
    <WelcomeFlow
      clearActiveWorkspaceRootOnComplete={!isWelcomeTarget}
      externalAgentImportEnabled={externalAgentImportEnabled}
      experimentArm={experimentArm}
      isCoworkMigrationEnabled={externalAgentCoworkMigrationEnabled}
      mode={mode}
      onCompleteToHome={onCompleteToHome}
    />
  );
}

function AutoCompleteToHome({
  experimentArm,
  onAutoCompleteToHome,
}: {
  experimentArm: string | undefined;
  onAutoCompleteToHome: () => void;
}) {
  useEffect(() => {
    const identity = readReplicaStatsigTelemetryIdentity();
    logReplicaStatsigProductEvent({
      eventName: "codex_onboarding_completed",
      metadata: {
        experiment_arm: experimentArm,
        selected_workspaces_count: 0,
        user_id: identity.userId,
        workspace_id: identity.workspaceId,
      },
    });
    onAutoCompleteToHome();
  }, [experimentArm, onAutoCompleteToHome]);

  return null;
}
