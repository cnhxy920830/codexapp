import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AutomationRecord } from "../../services/automations";
import {
  getLocalEnvironmentOwnerRoot,
  getPreferredLocalEnvironment,
  listLocalEnvironments,
  normalizePathForComparison,
  type LocalEnvironmentConfigEntry,
} from "../../services/localEnvironments";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";

type LocalEnvironmentSelectionsByWorkspace = Record<string, string | null>;

type ResolveAutomationLocalEnvironmentSelectionArgs = {
  canValidateSelection: boolean;
  environments: LocalEnvironmentConfigEntry[];
  hostId: string;
  selectionsByWorkspace: LocalEnvironmentSelectionsByWorkspace;
  workspaceRoot: string | null;
};

export type AutomationLocalEnvironmentState = {
  environments: LocalEnvironmentConfigEntry[];
  error: string | null;
  isLoading: boolean;
  onSelectConfigPath: (configPath: string | null) => void;
  selectedConfigPath: string | null;
  visible: boolean;
  workspaceRoot: string | null;
};

export function useAutomationLocalEnvironmentSelection({
  automation,
  hostId,
  setAutomation,
}: {
  automation: AutomationRecord | null;
  hostId: string;
  setAutomation: Dispatch<SetStateAction<AutomationRecord | null>>;
}) {
  const normalizedHostId = normalizeAutomationHostId(hostId);
  const workspaceRoot = useMemo(
    () => getAutomationLocalEnvironmentWorkspaceRoot(automation),
    [automation],
  );
  const workspaceKey = useMemo(
    () => getAutomationLocalEnvironmentWorkspaceKey(normalizedHostId, workspaceRoot),
    [normalizedHostId, workspaceRoot],
  );
  const [environments, setEnvironments] = useState<LocalEnvironmentConfigEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectionsByWorkspace, setSelectionsByWorkspace] =
    useState<LocalEnvironmentSelectionsByWorkspace>({});

  useEffect(() => {
    if (
      automation?.kind !== "cron" ||
      workspaceKey === null ||
      workspaceRoot === null
    ) {
      return;
    }

    setSelectionsByWorkspace((current) => {
      if (Object.prototype.hasOwnProperty.call(current, workspaceKey)) {
        return current;
      }

      const currentConfigPath = automation.localEnvironmentConfigPath;
      const ownerMatchesWorkspace =
        currentConfigPath !== null &&
        normalizePathForComparison(getLocalEnvironmentOwnerRoot(currentConfigPath)) ===
          normalizePathForComparison(workspaceRoot);

      return {
        ...current,
        [workspaceKey]: ownerMatchesWorkspace ? currentConfigPath : null,
      };
    });
  }, [
    automation?.kind,
    automation?.kind === "cron" ? automation.localEnvironmentConfigPath : null,
    workspaceKey,
    workspaceRoot,
  ]);

  useEffect(() => {
    if (workspaceKey === null || workspaceRoot === null) {
      setEnvironments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setEnvironments([]);
    setError(null);
    setIsLoading(true);

    void listLocalEnvironments({
      hostId: normalizedHostId,
      workspaceRoot,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setEnvironments(response.environments);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        setEnvironments([]);
        setError(getErrorMessage(fetchError));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedHostId, workspaceKey, workspaceRoot]);

  const resolvedSelection = useMemo(
    () =>
      resolveAutomationLocalEnvironmentSelection({
        canValidateSelection: !isLoading && error === null,
        environments,
        hostId: normalizedHostId,
        selectionsByWorkspace,
        workspaceRoot,
      }),
    [environments, error, isLoading, normalizedHostId, selectionsByWorkspace, workspaceRoot],
  );

  useEffect(() => {
    if (!resolvedSelection.visible) {
      return;
    }

    setAutomation((current) => {
      if (current === null || current.kind !== "cron") {
        return current;
      }

      return current.localEnvironmentConfigPath ===
        resolvedSelection.selectedConfigPath
        ? current
        : {
            ...current,
            localEnvironmentConfigPath: resolvedSelection.selectedConfigPath,
          };
    });
  }, [resolvedSelection.selectedConfigPath, resolvedSelection.visible, setAutomation]);

  const onSelectConfigPath = (configPath: string | null) => {
    if (workspaceKey !== null) {
      setSelectionsByWorkspace((current) => ({
        ...current,
        [workspaceKey]: configPath,
      }));
    }

    setAutomation((current) => {
      if (current === null || current.kind !== "cron") {
        return current;
      }

      return current.localEnvironmentConfigPath === configPath
        ? current
        : {
            ...current,
            localEnvironmentConfigPath: configPath,
          };
    });
  };

  return {
    environments,
    error,
    isLoading,
    onSelectConfigPath,
    selectedConfigPath: resolvedSelection.selectedConfigPath,
    visible: resolvedSelection.visible,
    workspaceRoot,
  } satisfies AutomationLocalEnvironmentState;
}

export function getAutomationLocalEnvironmentWorkspaceRoot(
  automation: AutomationRecord | null,
) {
  return automation?.kind === "cron" &&
    automation.executionEnvironment === "worktree" &&
    automation.cwds.length === 1
    ? automation.cwds[0] ?? null
    : null;
}

export function getAutomationLocalEnvironmentWorkspaceKey(
  hostId: string,
  workspaceRoot: string | null,
) {
  if (!workspaceRoot || workspaceRoot === "/") {
    return null;
  }

  return `${hostId}:${normalizePathForComparison(workspaceRoot)}`;
}

export function resolveAutomationLocalEnvironmentSelection({
  canValidateSelection,
  environments,
  hostId,
  selectionsByWorkspace,
  workspaceRoot,
}: ResolveAutomationLocalEnvironmentSelectionArgs) {
  const workspaceKey = getAutomationLocalEnvironmentWorkspaceKey(hostId, workspaceRoot);
  const defaultEnvironment = getPreferredLocalEnvironment(environments);
  const defaultConfigPath = defaultEnvironment?.configPath ?? null;
  const hasStoredSelection =
    workspaceKey !== null &&
    Object.prototype.hasOwnProperty.call(selectionsByWorkspace, workspaceKey);
  const storedConfigPath =
    workspaceKey !== null && hasStoredSelection
      ? selectionsByWorkspace[workspaceKey] ?? null
      : null;
  const normalizedStoredConfigPath =
    storedConfigPath === null
      ? null
      : normalizePathForComparison(storedConfigPath);
  const hasValidStoredSelection =
    canValidateSelection &&
    normalizedStoredConfigPath !== null &&
    environments.some(
      (entry) =>
        normalizePathForComparison(entry.configPath) === normalizedStoredConfigPath,
    );

  let resolvedConfigPath = hasStoredSelection ? storedConfigPath : null;
  if (
    canValidateSelection &&
    hasStoredSelection &&
    storedConfigPath !== null &&
    !hasValidStoredSelection
  ) {
    resolvedConfigPath = defaultConfigPath;
  }

  return {
    selectedConfigPath: resolvedConfigPath,
    visible: workspaceKey !== null,
  };
}

function normalizeAutomationHostId(hostId: string) {
  const trimmedHostId = hostId.trim();
  return trimmedHostId.length > 0 ? trimmedHostId : LOCAL_SETTINGS_HOST_ID;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
