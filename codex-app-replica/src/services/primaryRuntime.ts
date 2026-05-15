import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST = "latest";
export const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA = "latest-alpha";
export const PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT = "primary-runtime-install-progress";

export type PrimaryRuntimeUpdateStatusResponse = {
  disabledReason: string | null;
  enabled: boolean;
  isRunning: boolean;
  nextRunAt: number | null;
  startupChecked: boolean;
};

export type PrimaryRuntimeUpdateRunNowResponse = {
  bundleVersion: string | null;
  nextRunAt: number | null;
  reason: string | null;
  status: "already-current" | "installed" | "skipped";
};

export type PrimaryRuntimeProblem = {
  kind: string;
  message: string;
};

export type LoadPrimaryRuntimeDependenciesResponse = {
  bundleVersion: string | null;
  installed: boolean;
  instructions: string | null;
};

export type DiagnosePrimaryRuntimeDependenciesResponse = {
  bundleVersion: string | null;
  installed: boolean;
  problems: PrimaryRuntimeProblem[];
};

export type PrimaryRuntimeInstallResultResponse = {
  bundleVersion: string | null;
  status: "already-current" | "installed";
};

export type FinishPrimaryRuntimeInstallResponse = {
  completed: boolean;
};

export type CancelPrimaryRuntimeInstallResponse = {
  canceled: boolean;
};

export type PrimaryRuntimeInstallProgressPhase =
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "validating"
  | "installed"
  | "configuring"
  | "ready"
  | "error";

export type PrimaryRuntimeInstallProgressEvent = {
  bundleVersion: string | null;
  downloadedBytes: number | null;
  errorMessage: string | null;
  phase: PrimaryRuntimeInstallProgressPhase;
  release: string | null;
  totalBytes: number | null;
};

export type PrimaryRuntimeInstallProgressNotification = {
  hostId: string;
  progress: PrimaryRuntimeInstallProgressEvent;
};

export async function readPrimaryRuntimeUpdateStatus() {
  return invoke<PrimaryRuntimeUpdateStatusResponse>("primary-runtime-update-status");
}

export async function primaryRuntimeUpdateRunNow() {
  return invoke<PrimaryRuntimeUpdateRunNowResponse>("primary-runtime-update-run-now");
}

export async function setPrimaryRuntimeInstallRelease(release: string) {
  await invoke<void>("set-primary-runtime-install-release", {
    params: { release },
  });
}

export async function loadPrimaryRuntimeDependencies(params: { hostId?: string | null }) {
  return invoke<LoadPrimaryRuntimeDependenciesResponse>("load-primary-runtime-dependencies", {
    params: {
      hostId: params.hostId ?? "local",
    },
  });
}

export async function diagnosePrimaryRuntimeDependencies(params: {
  hostId?: string | null;
}) {
  return invoke<DiagnosePrimaryRuntimeDependenciesResponse>(
    "diagnose-primary-runtime-dependencies",
    {
      params: {
        hostId: params.hostId ?? "local",
      },
    },
  );
}

export async function installPrimaryRuntime(params: {
  hostId?: string | null;
  release?: string | null;
}) {
  return invoke<PrimaryRuntimeInstallResultResponse>("install-primary-runtime", {
    params: {
      hostId: params.hostId ?? "local",
      release: params.release ?? null,
    },
  });
}

export async function finishPrimaryRuntimeInstall(params: {
  hostId?: string | null;
  release?: string | null;
}) {
  return invoke<FinishPrimaryRuntimeInstallResponse>(
    "finish-primary-runtime-install",
    {
      params: {
        hostId: params.hostId ?? "local",
        release: params.release ?? null,
      },
    },
  );
}

export async function cancelPrimaryRuntimeInstall(params: {
  hostId?: string | null;
}) {
  return invoke<CancelPrimaryRuntimeInstallResponse>(
    "cancel-primary-runtime-install",
    {
      params: {
        hostId: params.hostId ?? "local",
      },
    },
  );
}

export async function resetPrimaryRuntimeDependencies(params: {
  hostId?: string | null;
  release?: string | null;
}) {
  return invoke<PrimaryRuntimeInstallResultResponse>(
    "reset-primary-runtime-dependencies",
    {
      params: {
        hostId: params.hostId ?? "local",
        release: params.release ?? null,
      },
    },
  );
}

export function onPrimaryRuntimeInstallProgress(
  handler: (notification: PrimaryRuntimeInstallProgressNotification) => void,
) {
  return listen<PrimaryRuntimeInstallProgressNotification>(
    PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function isPrimaryRuntimeInstallProgressActive(
  progress: PrimaryRuntimeInstallProgressEvent | null | undefined,
) {
  switch (progress?.phase) {
    case undefined:
    case "ready":
    case "error":
      return false;
    case "checking":
    case "downloading":
    case "verifying":
    case "extracting":
    case "validating":
    case "installed":
    case "configuring":
      return true;
  }
}

export function getPrimaryRuntimeInstallProgressPercent(
  progress: PrimaryRuntimeInstallProgressEvent | null | undefined,
) {
  if (progress == null) {
    return 0;
  }

  switch (progress.phase) {
    case "checking":
      return 0;
    case "downloading":
      return progress.downloadedBytes == null || progress.totalBytes == null
        ? 0
        : Math.floor(
            Math.min((progress.downloadedBytes / progress.totalBytes) * 100, 100),
          );
    case "verifying":
    case "extracting":
      return 98;
    case "validating":
    case "installed":
    case "configuring":
    case "ready":
      return 100;
    case "error":
      return 0;
  }
}
