import { useEffect, useState } from "react";
import { getGlobalState } from "../../../services/settings";
import type { WelcomeMode } from "./types";

export function useWelcomeMode() {
  const [mode, setMode] = useState<WelcomeMode | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMode = async () => {
      try {
        const [welcomeOverrideResponse, debugOverrideResponse] = await Promise.all([
          getGlobalState("electron:onboarding-override"),
          getGlobalState("electron:onboarding-welcome-v2-role-selection-debug-override"),
        ]);

        if (cancelled) {
          return;
        }

        const welcomeOverride =
          typeof welcomeOverrideResponse.value === "string" ? welcomeOverrideResponse.value : "auto";
        const debugOverride =
          typeof debugOverrideResponse.value === "string" ? debugOverrideResponse.value : "auto";

        if (welcomeOverride === "welcome") {
          setMode("simple");
          return;
        }

        setMode(debugOverride === "on" ? "role" : "intent");
      } catch {
        if (!cancelled) {
          setMode("intent");
        }
      }
    };

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, []);

  return mode;
}
