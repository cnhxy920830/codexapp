import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type WorkspaceRootOptionsResponse = {
  roots: string[];
  labels: Record<string, string>;
};

export type ActiveWorkspaceRootsResponse = {
  roots: string[];
};

export type WorkspaceRootOptionAddedNotification = {
  root: string;
};

export type WorkspaceRootOptionPickedNotification = {
  root: string;
};

export type OnboardingSkipWorkspaceResultNotification = {
  success: boolean;
  root?: string | null;
  error?: string | null;
};

export type OnboardingPickWorkspaceOrCreateDefaultResultNotification = {
  success: boolean;
  source: string;
  root?: string | null;
  error?: string | null;
};

export type PathsExistResponse = {
  existingPaths: string[];
};

export async function readWorkspaceRootOptions(hostId?: string | null) {
  return invoke<WorkspaceRootOptionsResponse>("workspace-root-options", {
    hostId: normalizeHostId(hostId),
  });
}

export async function readActiveWorkspaceRoots(hostId?: string | null) {
  return invoke<ActiveWorkspaceRootsResponse>("active-workspace-roots", {
    hostId: normalizeHostId(hostId),
  });
}

export async function addNewWorkspaceRootOption(root?: string | null) {
  return invoke<void>("electron-add-new-workspace-root-option", {
    root: normalizeOptionalRoot(root),
  });
}

export async function pickWorkspaceRootOption() {
  return invoke<void>("electron-pick-workspace-root-option");
}

export async function updateWorkspaceRootOptions(roots: string[]) {
  return invoke<void>("electron-update-workspace-root-options", {
    roots: roots.map(normalizeOptionalRoot).filter((root): root is string => root !== null),
  });
}

export async function setActiveWorkspaceRoot(root: string) {
  return invoke<void>("electron-set-active-workspace-root", {
    root: normalizeRequiredRoot(root, "root"),
  });
}

export async function clearActiveWorkspaceRoot() {
  return invoke<void>("electron-clear-active-workspace-root");
}

export async function skipWorkspaceOnboarding(projectName?: string | null) {
  return invoke<void>("electron-onboarding-skip-workspace", {
    projectName: normalizeOptionalRoot(projectName),
  });
}

export async function pickWorkspaceOrCreateDefault(defaultProjectName?: string | null) {
  return invoke<void>("electron-onboarding-pick-workspace-or-create-default", {
    defaultProjectName: normalizeOptionalRoot(defaultProjectName),
  });
}

export async function readExistingPaths(paths: string[], hostId?: string | null) {
  return invoke<PathsExistResponse>("paths-exist", {
    hostId: normalizeHostId(hostId),
    paths: paths.map(normalizeOptionalRoot).filter((path): path is string => path !== null),
  });
}

export function onWorkspaceRootOptionsUpdated(handler: () => void) {
  return listen("workspace-root-options-updated", () => {
    handler();
  });
}

export function onActiveWorkspaceRootsUpdated(handler: () => void) {
  return listen("active-workspace-roots-updated", () => {
    handler();
  });
}

export function onWorkspaceRootOptionAdded(
  handler: (notification: WorkspaceRootOptionAddedNotification) => void,
) {
  return listen<WorkspaceRootOptionAddedNotification>("workspace-root-option-added", (event) => {
    handler(event.payload);
  });
}

export function onWorkspaceRootOptionPicked(
  handler: (notification: WorkspaceRootOptionPickedNotification) => void,
) {
  return listen<WorkspaceRootOptionPickedNotification>("workspace-root-option-picked", (event) => {
    handler(event.payload);
  });
}

export function onOnboardingSkipWorkspaceResult(
  handler: (notification: OnboardingSkipWorkspaceResultNotification) => void,
) {
  return listen<OnboardingSkipWorkspaceResultNotification>(
    "electron-onboarding-skip-workspace-result",
    (event) => {
      handler(event.payload);
    },
  );
}

export function onOnboardingPickWorkspaceOrCreateDefaultResult(
  handler: (notification: OnboardingPickWorkspaceOrCreateDefaultResultNotification) => void,
) {
  return listen<OnboardingPickWorkspaceOrCreateDefaultResultNotification>(
    "electron-onboarding-pick-workspace-or-create-default-result",
    (event) => {
      handler(event.payload);
    },
  );
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalRoot(root?: string | null) {
  const trimmed = root?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredRoot(root: string, parameterName: string) {
  const normalized = normalizeOptionalRoot(root);
  if (normalized === null) {
    throw new Error(`${parameterName} is empty`);
  }
  return normalized;
}
