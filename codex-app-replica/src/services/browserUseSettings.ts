import { invoke } from "@tauri-apps/api/core";
import { emitQueryCacheInvalidated } from "./queryCache";
import { getGlobalState, setGlobalState } from "./settings";

export type BrowserUseApprovalMode = "alwaysAsk" | "neverAsk";
export type BrowserUseOriginKind = "allowed" | "denied";
export type BrowserUseFileTransferKind = "download" | "upload";
export type BrowserBrowsingDataType = "cookies" | "siteData" | "cache";
export type BrowserAnnotationScreenshotsMode = "always" | "necessary";

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

export type BrowserBrowsingDataClearResponse = {
  ok: boolean;
};

export const BROWSER_USE_SETTINGS_QUERY_KEY = [
  "browser-use-origin-state-read",
] as const;

export async function readBrowserUseSettings() {
  return invoke<BrowserUseSettingsState>(BROWSER_USE_SETTINGS_QUERY_KEY[0]);
}

export async function writeBrowserUseApprovalMode(params: {
  approvalMode: BrowserUseApprovalMode;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-approval-mode-write", { params });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function writeBrowserUseHistoryApprovalMode(params: {
  approvalMode: BrowserUseApprovalMode;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-history-approval-mode-write", { params });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function writeBrowserUseFileTransferApprovalMode(params: {
  kind: BrowserUseFileTransferKind;
  approvalMode: BrowserUseApprovalMode;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-file-transfer-approval-mode-write", { params });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function addBrowserUseOrigin(params: {
  kind: BrowserUseOriginKind;
  origin: string;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-origin-add", {
      params: {
        kind: params.kind,
        targetOrigin: params.origin,
      },
    });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function addBrowserUseFileTransferOrigin(params: {
  kind: BrowserUseOriginKind;
  transferKind: BrowserUseFileTransferKind;
  origin: string;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-file-transfer-origin-add", {
      params: {
        kind: params.kind,
        targetOrigin: params.origin,
        transferKind: params.transferKind,
      },
    });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function removeBrowserUseOrigin(params: {
  kind: BrowserUseOriginKind;
  origin: string;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-origin-remove", {
      params: {
        kind: params.kind,
        targetOrigin: params.origin,
      },
    });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function removeBrowserUseFileTransferOrigin(params: {
  kind: BrowserUseOriginKind;
  transferKind: BrowserUseFileTransferKind;
  origin: string;
}) {
  try {
    return await invoke<BrowserUseSettingsState>("browser-use-file-transfer-origin-remove", {
      params: {
        kind: params.kind,
        targetOrigin: params.origin,
        transferKind: params.transferKind,
      },
    });
  } finally {
    await emitQueryCacheInvalidated(BROWSER_USE_SETTINGS_QUERY_KEY).catch(() => undefined);
  }
}

export async function clearBrowserBrowsingData(dataTypes: BrowserBrowsingDataType[]) {
  return invoke<BrowserBrowsingDataClearResponse>("browser-browsing-data-clear", {
    params: { dataTypes },
  });
}

export async function readBrowserAnnotationScreenshotsMode() {
  const response = await getGlobalState("browser-annotation-screenshots-mode");
  return response.value === "necessary" ? response.value : "always";
}

export async function writeBrowserAnnotationScreenshotsMode(value: BrowserAnnotationScreenshotsMode) {
  await setGlobalState("browser-annotation-screenshots-mode", value);
}
