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

export async function readComputerUseApprovalsVisibility() {
  return invoke<ComputerUseVisibilityState>("read_computer_use_approvals_visibility");
}

export async function readComputerUseApprovals() {
  return invoke<ComputerUseApprovalsState | null>("read_computer_use_approvals");
}

export async function removeComputerUseApproval(params: { bundleIdentifier: string }) {
  return invoke<ComputerUseApprovalsState | null>("remove_computer_use_approval", { params });
}
