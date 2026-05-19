import { useEffect, useState } from "react";
import { readAccountInfo } from "../services/auth";

type UsageSettingsAccessState = {
  isUsageSettingsAccessLoading: boolean;
  isUsageSettingsVisible: boolean;
};

export function useUsageSettingsAccess({
  authMethod,
  isAuthLoading,
}: {
  authMethod: string | null;
  isAuthLoading: boolean;
}): UsageSettingsAccessState {
  const [state, setState] = useState<UsageSettingsAccessState>({
    isUsageSettingsAccessLoading: isAuthLoading || authMethod === "chatgpt",
    isUsageSettingsVisible: false,
  });

  useEffect(() => {
    let cancelled = false;

    if (isAuthLoading) {
      setState({
        isUsageSettingsAccessLoading: true,
        isUsageSettingsVisible: false,
      });
      return () => {
        cancelled = true;
      };
    }

    if (authMethod !== "chatgpt") {
      setState({
        isUsageSettingsAccessLoading: false,
        isUsageSettingsVisible: false,
      });
      return () => {
        cancelled = true;
      };
    }

    setState({
      isUsageSettingsAccessLoading: true,
      isUsageSettingsVisible: false,
    });

    void readAccountInfo()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const normalizedPlan = response.plan?.trim().toLowerCase();
        setState({
          isUsageSettingsAccessLoading: false,
          isUsageSettingsVisible:
            normalizedPlan === "plus" ||
            normalizedPlan === "pro" ||
            normalizedPlan === "prolite",
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setState({
          isUsageSettingsAccessLoading: false,
          isUsageSettingsVisible: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authMethod, isAuthLoading]);

  return state;
}
