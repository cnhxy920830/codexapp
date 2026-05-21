import { invoke } from "@tauri-apps/api/core";
import { emitQueryCacheInvalidated } from "./queryCache";

export type ComputerUseVisibilityState = {
  hasApprovalStore: boolean;
};

export type ComputerUseApprovedApp = {
  bundleIdentifier: string;
  displayName: string;
  iconDataURL: string | null;
};

export type ComputerUseApprovalsState = {
  approvedApps: ComputerUseApprovedApp[];
  approvedBundleIdentifiers: string[];
};

export type ComputerUseSoundModeValue =
  | "foregroundClicks"
  | "foregroundAndBackgroundClicks"
  | "off";

export type ComputerUseSoundModeReadResponse = {
  value: ComputerUseSoundModeValue | null;
};

export type ComputerUseSoundModeWriteResponse = {
  value: ComputerUseSoundModeValue;
};

export type ChromeExtensionInstalledState = {
  installed: boolean;
};

export const COMPUTER_USE_APPROVALS_QUERY_KEY = [
  "computer-use-app-approvals-read",
] as const;

export const COMPUTER_USE_SOUND_MODE_QUERY_KEY = [
  "computer-use-sound-mode-read",
] as const;

export async function readComputerUseApprovalsVisibility() {
  return invoke<ComputerUseVisibilityState>("computer-use-app-approvals-visibility");
}

export async function readComputerUseApprovals() {
  return invoke<ComputerUseApprovalsState | null>("computer-use-app-approvals-read");
}

export async function removeComputerUseApproval(params: { bundleIdentifier: string }) {
  try {
    return await invoke<ComputerUseApprovalsState | null>("computer-use-app-approval-remove", { params });
  } finally {
    await emitQueryCacheInvalidated(COMPUTER_USE_APPROVALS_QUERY_KEY).catch(() => undefined);
  }
}

export async function readComputerUseSoundMode() {
  return invoke<ComputerUseSoundModeReadResponse>("computer-use-sound-mode-read");
}

export async function writeComputerUseSoundMode(params: {
  value: ComputerUseSoundModeValue;
}) {
  try {
    return await invoke<ComputerUseSoundModeWriteResponse>("computer-use-sound-mode-write", { params });
  } finally {
    await emitQueryCacheInvalidated(COMPUTER_USE_SOUND_MODE_QUERY_KEY).catch(() => undefined);
  }
}

export async function readChromeExtensionInstalled(params: { extensionId: string }) {
  return invoke<ChromeExtensionInstalledState>("chrome-extension-installed-read", { params });
}

export async function openChromeExtensionSettings(params: { extensionId: string }) {
  return invoke<void>("chrome-extension-settings-open", { params });
}
