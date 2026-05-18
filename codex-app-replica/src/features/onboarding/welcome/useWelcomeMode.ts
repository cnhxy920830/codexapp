import { useEffect, useState } from "react";
import { getGlobalState } from "../../../services/settings";
import type { WelcomeMode } from "./types";

type UseWelcomeModeParams = {
  statsigIsLoading: boolean;
  welcomeV2DefaultFlowEnabled: boolean;
};

export function useWelcomeMode({
  statsigIsLoading,
  welcomeV2DefaultFlowEnabled,
}: UseWelcomeModeParams) {
  const [mode, setMode] = useState<Exclude<WelcomeMode, "simple"> | null>(null);

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

        if (debugOverride === "on") {
          setMode("role");
          return;
        }

        if (debugOverride !== "auto") {
          setMode("intent");
          return;
        }

        if (statsigIsLoading) {
          setMode(null);
          return;
        }

        setMode(welcomeV2DefaultFlowEnabled ? "intent" : "role");
      } catch {
        if (!cancelled && !statsigIsLoading) {
          setMode(welcomeV2DefaultFlowEnabled ? "intent" : "role");
        }
      }
    };

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, [statsigIsLoading, welcomeV2DefaultFlowEnabled]);

  return mode;
}
