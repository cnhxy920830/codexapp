import { useEffect, useState } from "react";
import { getGlobalState } from "../../../services/settings";
import type { WelcomeMode } from "./types";

type UseWelcomeModeParams = {
  statsigIsLoading: boolean;
  welcomeV2DefaultFlowEnabled: boolean;
};

export function resolveWelcomeMode({
  debugOverride,
  statsigIsLoading,
  welcomeV2DefaultFlowEnabled,
}: {
  debugOverride: string;
  statsigIsLoading: boolean;
  welcomeV2DefaultFlowEnabled: boolean;
}) {
  if (debugOverride === "on") {
    return "role";
  }

  if (debugOverride !== "auto") {
    return "intent";
  }

  if (statsigIsLoading) {
    return null;
  }

  return welcomeV2DefaultFlowEnabled ? "role" : "intent";
}

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

        setMode(
          resolveWelcomeMode({
            debugOverride,
            statsigIsLoading,
            welcomeV2DefaultFlowEnabled,
          }),
        );
      } catch {
        if (!cancelled && !statsigIsLoading) {
          setMode(
            resolveWelcomeMode({
              debugOverride: "auto",
              statsigIsLoading,
              welcomeV2DefaultFlowEnabled,
            }),
          );
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
