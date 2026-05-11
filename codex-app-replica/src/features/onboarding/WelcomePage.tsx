import { LoadingPage } from "../../components/LoadingPage";
import { useI18n } from "../../i18n/i18n";
import { WelcomeFlow } from "./welcome/WelcomeFlow";
import { SimpleWelcomeCard, WelcomeShell } from "./welcome/steps";
import { useWelcomeMode } from "./welcome/useWelcomeMode";

type WelcomePageProps = {
  onCompleteToHome: () => void;
  onContinueToWorkspace: () => void;
};

export function WelcomePage({ onCompleteToHome, onContinueToWorkspace }: WelcomePageProps) {
  const { t } = useI18n();
  const mode = useWelcomeMode();

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
