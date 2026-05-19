import { invoke } from "@tauri-apps/api/core";

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

export async function readComputerUseApprovalsVisibility() {
  return invoke<ComputerUseVisibilityState>("computer-use-app-approvals-visibility");
}

export async function readComputerUseApprovals() {
  return invoke<ComputerUseApprovalsState | null>("computer-use-app-approvals-read");
}

export async function removeComputerUseApproval(params: { bundleIdentifier: string }) {
  return invoke<ComputerUseApprovalsState | null>("computer-use-app-approval-remove", { params });
}

export async function readComputerUseSoundMode() {
  return invoke<ComputerUseSoundModeReadResponse>("computer-use-sound-mode-read");
}

export async function writeComputerUseSoundMode(params: {
  value: ComputerUseSoundModeValue;
}) {
  return invoke<ComputerUseSoundModeWriteResponse>("computer-use-sound-mode-write", { params });
}

export async function readChromeExtensionInstalled(params: { extensionId: string }) {
  return invoke<ChromeExtensionInstalledState>("chrome-extension-installed-read", { params });
}

export async function openChromeExtensionSettings(params: { extensionId: string }) {
  return invoke<void>("chrome-extension-settings-open", { params });
}
