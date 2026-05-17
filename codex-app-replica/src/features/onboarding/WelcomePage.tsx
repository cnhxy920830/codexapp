import { LoadingPage } from "../../components/LoadingPage";
import { useI18n } from "../../i18n/i18n";
import { useReplicaStatsigGateValue } from "../statsig/replicaStatsig";
import { REPLICA_STATSIG_GATES } from "../statsig/replicaStatsig";
import { WelcomeFlow } from "./welcome/WelcomeFlow";
import { SimpleWelcomeCard, WelcomeShell } from "./welcome/steps";
import {
  shouldUseWelcomeV2WorkspaceOnboarding,
  type WorkspaceOnboardingExperimentAssignment,
} from "./selectWorkspaceModel";
import { useWelcomeMode } from "./welcome/useWelcomeMode";

type WelcomePageProps = {
  isWelcomeTarget: boolean;
  onCompleteToHome: () => void;
  onContinueToWorkspace: () => void;
  workspaceOnboardingExperimentAssignment: WorkspaceOnboardingExperimentAssignment;
};

export function WelcomePage({
  isWelcomeTarget,
  onCompleteToHome,
  onContinueToWorkspace,
  workspaceOnboardingExperimentAssignment,
}: WelcomePageProps) {
  const { t } = useI18n();
  const welcomeV2FlowEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.workspaceOnboardingWelcomeV2Flow,
  );
  const welcomeV2DefaultFlowEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.workspaceOnboardingWelcomeV2DefaultFlow,
  );
  const shouldUseWelcomeV2Onboarding = shouldUseWelcomeV2WorkspaceOnboarding({
    assignment: workspaceOnboardingExperimentAssignment,
    welcomeV2DefaultFlowEnabled: welcomeV2FlowEnabled,
  });
  const mode = useWelcomeMode({
    isWelcomeTarget,
    shouldUseWelcomeV2Onboarding,
    welcomeV2DefaultFlowEnabled,
  });

  if (mode === null) {
    return <LoadingPage debugName="WelcomePage" />;
  }

  if (mode === "simple") {
    return (
      <WelcomeShell>
        <SimpleWelcomeCard onContinue={onContinueToWorkspace} t={t} />
      </WelcomeShell>
    );
  }

  return <WelcomeFlow mode={mode} onCompleteToHome={onCompleteToHome} />;
}
