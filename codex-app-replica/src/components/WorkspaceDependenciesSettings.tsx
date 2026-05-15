import {
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "../i18n/i18n";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import {
  CloseTabIcon,
  DownloadIcon,
  SearchIcon,
} from "./AppShellIcons";
import { ToggleSwitch } from "./ToggleSwitch";
import {
  cancelPrimaryRuntimeInstall,
  diagnosePrimaryRuntimeDependencies,
  getPrimaryRuntimeInstallProgressPercent,
  isPrimaryRuntimeInstallProgressActive,
  onPrimaryRuntimeInstallProgress,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  primaryRuntimeUpdateRunNow,
  readPrimaryRuntimeUpdateStatus,
  resetPrimaryRuntimeDependencies,
  type DiagnosePrimaryRuntimeDependenciesResponse,
  type PrimaryRuntimeInstallProgressEvent,
} from "../services/primaryRuntime";
import {
  listExperimentalFeaturesForHost,
  setExperimentalFeatureForHost,
  type ExperimentalFeature,
} from "../services/personalization";

const LOCAL_HOST_ID = "local";
const WORKSPACE_DEPENDENCIES_FEATURE_NAME = "workspace_dependencies";
const EMPTY_DIAGNOSIS = {
  bundleVersion: null,
  installed: false,
  problems: [],
} satisfies DiagnosePrimaryRuntimeDependenciesResponse;

export function WorkspaceDependenciesSettings({
  hostId,
  onShowToast,
}: {
  hostId: string;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isResetStarting, setIsResetStarting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isTriggeringUpdate, setIsTriggeringUpdate] = useState(false);
  const [featureAvailable, setFeatureAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [diagnosis, setDiagnosis] =
    useState<DiagnosePrimaryRuntimeDependenciesResponse | null>(null);
  const [installProgress, setInstallProgress] =
    useState<PrimaryRuntimeInstallProgressEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const refreshState = useEffectEvent(async () => {
    if (hostId !== LOCAL_HOST_ID) {
      return;
    }

    setIsLoading(true);
    try {
      const [features, updateStatus, nextDiagnosis] = await Promise.all([
        listExperimentalFeaturesForHost(hostId).catch(
          () => [] as ExperimentalFeature[],
        ),
        readPrimaryRuntimeUpdateStatus().catch(() => null),
        diagnosePrimaryRuntimeDependencies({ hostId }).catch(
          () => EMPTY_DIAGNOSIS,
        ),
      ]);

      const workspaceDependenciesFeature =
        resolveWorkspaceDependenciesFeature(features);
      setFeatureAvailable(workspaceDependenciesFeature !== null);
      setEnabled(workspaceDependenciesFeature?.enabled === true);
      setDiagnosis(nextDiagnosis);
      setIsInstalling(updateStatus?.isRunning === true);
      if (updateStatus?.isRunning !== true) {
        setInstallProgress(null);
      }
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void refreshState();
  }, [hostId, refreshState]);

  useEffect(() => {
    if (hostId !== LOCAL_HOST_ID) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void onPrimaryRuntimeInstallProgress((notification) => {
      if (notification.hostId !== hostId) {
        return;
      }

      const progressIsActive = isPrimaryRuntimeInstallProgressActive(
        notification.progress,
      );
      setInstallProgress(notification.progress);
      setIsInstalling(progressIsActive);
      if (!progressIsActive) {
        void refreshState();
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
      if (unlisten !== null) {
        void unlisten();
      }
    };
  }, [hostId, refreshState]);

  if (hostId !== LOCAL_HOST_ID) {
    return null;
  }

  const installStatusIsActive =
    isInstalling && isPrimaryRuntimeInstallProgressActive(installProgress);
  const bundleVersionLabel = installStatusIsActive
    ? resolveInstallStatusMessage(t, installProgress)
    : isLoading
      ? t("settings.agent.dependencies.bundleVersion.loading")
      : diagnosis?.bundleVersion ??
        t("settings.agent.dependencies.bundleVersion.notInstalled");
  const currentProblemDescription =
    diagnosis != null && diagnosis.problems.length > 0
      ? t("settings.agent.dependencies.bundleVersion.problemDescription")
      : null;
  const disableResetAction =
    !enabled ||
    (installStatusIsActive
      ? isCanceling
      : isLoading ||
        isToggling ||
        isDiagnosing ||
        isTriggeringUpdate ||
        isResetStarting ||
        isCanceling);

  const updateWorkspaceDependenciesEnablement = async (checked: boolean) => {
    if (isToggling) {
      return;
    }

    setIsToggling(true);
    try {
      await setExperimentalFeatureForHost(
        hostId,
        WORKSPACE_DEPENDENCIES_FEATURE_NAME,
        checked,
      );
      if (checked) {
        setIsTriggeringUpdate(true);
        try {
          await primaryRuntimeUpdateRunNow();
        } catch {
          // Upstream does not surface a separate toast for this branch.
        } finally {
          setIsTriggeringUpdate(false);
        }
      }
      await refreshState();
    } catch {
      await refreshState();
    } finally {
      setIsTriggeringUpdate(false);
      setIsToggling(false);
    }
  };

  const runDiagnosis = async () => {
    if (isDiagnosing) {
      return;
    }

    setIsDiagnosing(true);
    try {
      const response = await diagnosePrimaryRuntimeDependencies({ hostId });
      setDiagnosis(response);
      onShowToast?.({
        tone: response.installed ? "success" : "info",
        message: t(
          response.installed
            ? "settings.agent.dependencies.diagnose.ok"
            : "settings.agent.dependencies.diagnose.problem",
        ),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.agent.dependencies.diagnose.failed"),
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const resetDependencies = async () => {
    if (isResetStarting) {
      return;
    }

    setIsResetStarting(true);
    try {
      await resetPrimaryRuntimeDependencies({
        hostId,
        release: PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
      });
      await refreshState();
      onShowToast?.({
        tone: "success",
        message: t("settings.agent.dependencies.reset.installed"),
      });
    } catch (error) {
      if (isAbortLikeError(error)) {
        setInstallProgress(null);
        setIsInstalling(false);
        await refreshState();
        onShowToast?.({
          tone: "info",
          message: t("settings.agent.dependencies.reset.canceled"),
        });
        return;
      }

      onShowToast?.({
        tone: "error",
        message: t("settings.agent.dependencies.reset.failed"),
      });
    } finally {
      setIsResetStarting(false);
    }
  };

  const cancelInstall = async () => {
    if (isCanceling) {
      return;
    }

    setIsCanceling(true);
    try {
      const response = await cancelPrimaryRuntimeInstall({ hostId });
      setInstallProgress(null);
      setIsInstalling(false);
      await refreshState();
      onShowToast?.({
        tone: "info",
        message: t(
          response.canceled
            ? "settings.agent.dependencies.cancel.canceled"
            : "settings.agent.dependencies.cancel.noop",
        ),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.agent.dependencies.cancel.failed"),
      });
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <SettingsGroup className="gap-2">
      <SettingsGroupHeader title={t("settings.agent.dependencies.sectionTitle")} />
      <SettingsGroupContent>
        <SettingsSurface>
          <SettingsRow
            label={t("settings.agent.dependencies.bundleVersion.label")}
            description={currentProblemDescription}
            control={
              <span className="text-sm text-token-text-secondary">
                {bundleVersionLabel}
              </span>
            }
          />
          <SettingsRow
            label={t("settings.agent.dependencies.enabled.label")}
            description={t("settings.agent.dependencies.enabled.description")}
            control={
              <ToggleSwitch
                checked={enabled}
                disabled={isLoading || isToggling || !featureAvailable}
                onChange={(checked) =>
                  void updateWorkspaceDependenciesEnablement(checked)
                }
                ariaLabel={t("settings.agent.dependencies.enabled.ariaLabel")}
              />
            }
          />
          <SettingsRow
            label={t("settings.agent.dependencies.diagnose.label")}
            description={t("settings.agent.dependencies.diagnose.description")}
            control={
              <Button
                color="secondary"
                size="toolbar"
                loading={isDiagnosing}
                disabled={isResetStarting}
                onClick={() => void runDiagnosis()}
              >
                <SearchIcon className="icon-2xs" />
                {t("settings.agent.dependencies.diagnose.button")}
              </Button>
            }
          />
          <SettingsRow
            label={t("settings.agent.dependencies.reset.label")}
            description={t("settings.agent.dependencies.reset.description")}
            control={
              <Button
                color="danger"
                size="toolbar"
                loading={installStatusIsActive ? isCanceling : isResetStarting}
                disabled={disableResetAction}
                onClick={() =>
                  void (installStatusIsActive ? cancelInstall() : resetDependencies())
                }
              >
                {installStatusIsActive ? (
                  <>
                    <CloseTabIcon className="icon-2xs" />
                    {t("settings.agent.dependencies.cancel.button")}
                  </>
                ) : (
                  <>
                    <DownloadIcon className="icon-2xs" />
                    {t("settings.agent.dependencies.reset.button")}
                  </>
                )}
              </Button>
            }
          />
        </SettingsSurface>
      </SettingsGroupContent>
    </SettingsGroup>
  );
}

function SettingsRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string | null;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
        {description ? <div className="min-w-0 text-sm text-token-text-secondary">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={joinClasses("flex flex-col", className)}>{children}</section>;
}

function SettingsGroupHeader({ title }: { title: ReactNode }) {
  return (
    <div className="flex h-toolbar items-center justify-between gap-2 px-0 py-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-base font-medium text-token-text-primary">{title}</div>
      </div>
    </div>
  );
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border"
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function resolveWorkspaceDependenciesFeature(features: ExperimentalFeature[]) {
  return (
    features.find(
      (feature) => feature.name === WORKSPACE_DEPENDENCIES_FEATURE_NAME,
    ) ?? null
  );
}

function resolveInstallStatusMessage(
  t: ReturnType<typeof useI18n>["t"],
  progress: PrimaryRuntimeInstallProgressEvent | null,
) {
  const percent = getPrimaryRuntimeInstallProgressPercent(progress);
  switch (progress?.phase) {
    case undefined:
    case "checking":
    case "downloading":
    case "error":
      return t("localConversation.primaryRuntimeInstallStatus.downloading", {
        percent,
      });
    case "extracting":
      return t("localConversation.primaryRuntimeInstallStatus.extracting");
    case "verifying":
    case "validating":
    case "installed":
    case "configuring":
    case "ready":
      return t("localConversation.primaryRuntimeInstallStatus.finalizing");
  }
}

function isAbortLikeError(error: unknown) {
  return error instanceof Error || error instanceof DOMException
    ? error.name === "AbortError" ||
        error.message.toLowerCase().includes("aborted")
    : false;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
