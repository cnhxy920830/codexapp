import { useEffect, useState } from "react";
import { getGlobalState } from "../../../services/settings";
import type { WelcomeMode } from "./types";

type UseWelcomeModeParams = {
  isWelcomeTarget: boolean;
  shouldUseWelcomeV2Onboarding: boolean;
  welcomeV2DefaultFlowEnabled: boolean;
};

export function useWelcomeMode({
  isWelcomeTarget,
  shouldUseWelcomeV2Onboarding,
  welcomeV2DefaultFlowEnabled,
}: UseWelcomeModeParams) {
  const [mode, setMode] = useState<WelcomeMode | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMode = async () => {
      try {
        const [debugOverrideResponse] = await Promise.all([
          getGlobalState("electron:onboarding-welcome-v2-role-selection-debug-override"),
        ]);

        if (cancelled) {
          return;
        }

        const debugOverride =
          typeof debugOverrideResponse.value === "string" ? debugOverrideResponse.value : "auto";

        if (isWelcomeTarget && !shouldUseWelcomeV2Onboarding) {
          setMode("simple");
          return;
        }

        if (debugOverride === "on") {
          setMode("role");
          return;
        }

        setMode(welcomeV2DefaultFlowEnabled ? "intent" : "role");
      } catch {
        if (!cancelled) {
          setMode(welcomeV2DefaultFlowEnabled ? "intent" : "role");
        }
      }
    };

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, [isWelcomeTarget, shouldUseWelcomeV2Onboarding, welcomeV2DefaultFlowEnabled]);

  return mode;
}
