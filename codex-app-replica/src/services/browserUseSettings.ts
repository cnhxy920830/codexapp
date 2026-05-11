import { invoke } from "@tauri-apps/api/core";

export type BrowserUseApprovalMode = "alwaysAsk" | "neverAsk";
export type BrowserUseOriginKind = "allowed" | "denied";
export type BrowserUseFileTransferKind = "download" | "upload";

export type BrowserUseSettingsState = {
  approvalMode: BrowserUseApprovalMode;
  historyApprovalMode: BrowserUseApprovalMode;
  downloadApprovalMode: BrowserUseApprovalMode;
  uploadApprovalMode: BrowserUseApprovalMode;
  allowedOrigins: string[];
  deniedOrigins: string[];
  allowedDownloadOrigins: string[];
  deniedDownloadOrigins: string[];
  allowedUploadOrigins: string[];
  deniedUploadOrigins: string[];
};

export async function readBrowserUseSettings() {
  return invoke<BrowserUseSettingsState>("read_browser_use_settings");
}

export async function writeBrowserUseApprovalMode(params: {
  approvalMode: BrowserUseApprovalMode;
}) {
  return invoke<BrowserUseSettingsState>("write_browser_use_approval_mode", { params });
}

export async function writeBrowserUseHistoryApprovalMode(params: {
  approvalMode: BrowserUseApprovalMode;
}) {
  return invoke<BrowserUseSettingsState>("write_browser_use_history_approval_mode", { params });
}

export async function writeBrowserUseFileTransferApprovalMode(params: {
  kind: BrowserUseFileTransferKind;
  approvalMode: BrowserUseApprovalMode;
}) {
  return invoke<BrowserUseSettingsState>("browser-use-file-transfer-approval-mode-write", { params });
}

export async function addBrowserUseOrigin(params: {
  kind: BrowserUseOriginKind;
  origin: string;
}) {
  return invoke<BrowserUseSettingsState>("add_browser_use_origin", { params });
}

export async function addBrowserUseFileTransferOrigin(params: {
  kind: BrowserUseOriginKind;
  transferKind: BrowserUseFileTransferKind;
  origin: string;
}) {
  return invoke<BrowserUseSettingsState>("browser-use-file-transfer-origin-add", { params });
}

export async function removeBrowserUseOrigin(params: {
  kind: BrowserUseOriginKind;
  origin: string;
}) {
  return invoke<BrowserUseSettingsState>("remove_browser_use_origin", { params });
}

export async function removeBrowserUseFileTransferOrigin(params: {
  kind: BrowserUseOriginKind;
  transferKind: BrowserUseFileTransferKind;
  origin: string;
}) {
  return invoke<BrowserUseSettingsState>("browser-use-file-transfer-origin-remove", { params });
}
