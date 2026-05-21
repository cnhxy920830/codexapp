import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ACCOUNT_INFO_QUERY_KEY, readAccountInfo } from "../services/auth";
import { onQueryCacheInvalidated, queryKeyMatchesPrefix } from "../services/queryCache";

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
  const usesChatGptAuth = authMethod === "chatgpt";
  const requestIdRef = useRef(0);
  const [state, setState] = useState<UsageSettingsAccessState>({
    isUsageSettingsAccessLoading: isAuthLoading || usesChatGptAuth,
    isUsageSettingsVisible: false,
  });

  const loadUsageSettingsAccess = useEffectEvent(
    async ({
      preserveStateOnError,
      resetBeforeLoad,
    }: {
      preserveStateOnError: boolean;
      resetBeforeLoad: boolean;
    }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (isAuthLoading) {
        setState({
          isUsageSettingsAccessLoading: true,
          isUsageSettingsVisible: false,
        });
        return;
      }

      if (!usesChatGptAuth) {
        setState({
          isUsageSettingsAccessLoading: false,
          isUsageSettingsVisible: false,
        });
        return;
      }

      if (resetBeforeLoad) {
        setState({
          isUsageSettingsAccessLoading: true,
          isUsageSettingsVisible: false,
        });
      }

      try {
        const response = await readAccountInfo();
        if (requestId !== requestIdRef.current) {
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
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (preserveStateOnError) {
          setState((current) => ({
            isUsageSettingsAccessLoading: false,
            isUsageSettingsVisible: current.isUsageSettingsVisible,
          }));
          return;
        }

        setState({
          isUsageSettingsAccessLoading: false,
          isUsageSettingsVisible: false,
        });
      }
    },
  );

  useEffect(() => {
    if (isAuthLoading) {
      requestIdRef.current += 1;
      setState({
        isUsageSettingsAccessLoading: true,
        isUsageSettingsVisible: false,
      });
      return;
    }

    if (!usesChatGptAuth) {
      requestIdRef.current += 1;
      setState({
        isUsageSettingsAccessLoading: false,
        isUsageSettingsVisible: false,
      });
      return;
    }

    void loadUsageSettingsAccess({
      preserveStateOnError: false,
      resetBeforeLoad: true,
    });
  }, [isAuthLoading, usesChatGptAuth]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed && queryKeyMatchesPrefix(notification.queryKey, ACCOUNT_INFO_QUERY_KEY)) {
        void loadUsageSettingsAccess({
          preserveStateOnError: true,
          resetBeforeLoad: false,
        });
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return state;
}
