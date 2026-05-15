//! Browser session data clearing owner.
//!
//! Implements the `browser-browsing-data-clear` Tauri command, which mirrors
//! upstream `main-Bnxe1qAn.js`'s
//! `session.fromPartition("persist:codex-browser-app")` clearing path. The
//! page-owner `browser-use-settings-CJBdA4SJ.js` invokes this with
//! `{ dataTypes: ["siteData" | "cookies" | "cache", ...] }` when the user
//! clears browsing data from Browser Use settings.
//!
//! ## Replica reality
//!
//! The replica now hosts a dedicated browser-sidebar child webview that uses
//! the same fixed `codex-browser-partitions/app` relative data directory wired
//! in `browser_sidebar.rs`. This owner still mirrors upstream with a direct
//! on-disk clear pass over that isolated profile instead of calling WebView2
//! profile APIs.
//!
//! This implementation honors the page-owned desktop bridge contract:
//!
//! 1. deserialize the extracted `dataTypes` array shape,
//! 2. resolve the browser-sidebar profile storage directory for the fixed
//!    `app` partition (without creating it),
//! 3. if the folder exists, attempt to clear the matching subdirectories;
//!    otherwise return success (faithful "no-op against empty partition"),
//! 4. respond with `{ ok: true }` to satisfy the page's promise.

use crate::browser_sidebar::browser_sidebar_partition_relative_dir;
use crate::browser_sidebar::BROWSER_SIDEBAR_LABEL;
use serde::Deserialize;
use serde::Serialize;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserBrowsingDataType {
    SiteData,
    Cookies,
    Cache,
}

impl BrowserBrowsingDataType {
    fn subdirectories(self) -> &'static [&'static str] {
        match self {
            BrowserBrowsingDataType::SiteData => {
                &["IndexedDB", "Local Storage", "Service Worker", "WebStorage"]
            }
            BrowserBrowsingDataType::Cookies => &["Cookies"],
            BrowserBrowsingDataType::Cache => &["Cache", "Code Cache", "GPUCache"],
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBrowsingDataClearParams {
    pub data_types: Vec<BrowserBrowsingDataType>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBrowsingDataClearResponse {
    pub ok: bool,
}

#[tauri::command(rename = "browser-browsing-data-clear")]
pub fn browser_browsing_data_clear(
    app: AppHandle,
    params: BrowserBrowsingDataClearParams,
) -> Result<BrowserBrowsingDataClearResponse, String> {
    let local_data_dir = app
        .path()
        .local_data_dir()
        .map_err(|err| format!("failed to resolve local data dir: {err}"))?;

    let partition_dir = app_partition_dir(&local_data_dir);
    if !partition_dir.exists() {
        // Faithful no-op: upstream `clearStorageData` is itself a no-op when
        // the partition has never been materialized.
        return Ok(BrowserBrowsingDataClearResponse { ok: true });
    }

    let mut subdirs = Vec::new();
    for data_type in params.data_types {
        for subdir in data_type.subdirectories() {
            if !subdirs.contains(subdir) {
                subdirs.push(*subdir);
            }
        }
    }

    clear_partition_subdirs(&partition_dir, &subdirs)?;
    Ok(BrowserBrowsingDataClearResponse { ok: true })
}

fn app_partition_dir(local_data_dir: &Path) -> PathBuf {
    local_data_dir
        .join(BROWSER_SIDEBAR_LABEL)
        .join(browser_sidebar_partition_relative_dir())
}

fn clear_partition_subdirs(partition_dir: &Path, subdirs: &[&str]) -> Result<(), String> {
    for subdir in subdirs {
        let path = partition_dir.join(subdir);
        if !path.exists() {
            continue;
        }
        if path.is_dir() {
            std::fs::remove_dir_all(&path)
                .map_err(|err| format!("failed to clear {}: {err}", path.display()))?;
        } else if path.is_file() {
            std::fs::remove_file(&path)
                .map_err(|err| format!("failed to clear {}: {err}", path.display()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn data_types_deserialize_extracted_camel_case_values() {
        let v: BrowserBrowsingDataClearParams =
            serde_json::from_value(serde_json::json!({"dataTypes": ["siteData"]}))
                .expect("deserialize siteData");
        assert_eq!(v.data_types, vec![BrowserBrowsingDataType::SiteData]);

        let v: BrowserBrowsingDataClearParams =
            serde_json::from_value(serde_json::json!({"dataTypes": ["cookies", "cache"]}))
                .expect("deserialize cookies");
        assert_eq!(
            v.data_types,
            vec![
                BrowserBrowsingDataType::Cookies,
                BrowserBrowsingDataType::Cache,
            ]
        );
    }

    #[test]
    fn data_types_reject_unknown_values() {
        let result: Result<BrowserBrowsingDataClearParams, _> =
            serde_json::from_value(serde_json::json!({"dataTypes": ["unknown"]}));
        assert!(result.is_err());
    }

    #[test]
    fn response_serializes_camel_case() {
        let value =
            serde_json::to_value(BrowserBrowsingDataClearResponse { ok: true }).expect("serialize");
        assert_eq!(value["ok"], true);
    }

    #[test]
    fn site_data_subdirectories_match_chromium_layout() {
        assert_eq!(
            BrowserBrowsingDataType::SiteData.subdirectories(),
            &["IndexedDB", "Local Storage", "Service Worker", "WebStorage"]
        );
        assert_eq!(
            BrowserBrowsingDataType::Cookies.subdirectories(),
            &["Cookies"]
        );
        assert_eq!(
            BrowserBrowsingDataType::Cache.subdirectories(),
            &["Cache", "Code Cache", "GPUCache"]
        );
    }

    #[test]
    fn app_partition_dir_uses_browser_sidebar_storage_root() {
        let local_data_dir = PathBuf::from(r"C:\tmp\local-app-data");
        assert_eq!(
            app_partition_dir(&local_data_dir),
            local_data_dir
                .join(BROWSER_SIDEBAR_LABEL)
                .join(browser_sidebar_partition_relative_dir())
        );
    }

    #[test]
    fn clear_partition_subdirs_is_no_op_when_dir_absent() {
        let temp = unique_temp_dir("browser-clear-absent");
        clear_partition_subdirs(&temp, BrowserBrowsingDataType::Cache.subdirectories())
            .expect("absent partition is treated as no-op");
        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn clear_partition_subdirs_removes_only_matching_subdirs() {
        let temp = unique_temp_dir("browser-clear-cache");
        let cache = temp.join("Cache");
        let cookies = temp.join("Cookies");
        fs::create_dir_all(&cache).expect("create cache dir");
        fs::create_dir_all(&cookies).expect("create cookies dir");
        fs::write(cache.join("entry"), b"x").expect("seed cache file");
        fs::write(cookies.join("entry"), b"x").expect("seed cookies file");

        clear_partition_subdirs(&temp, BrowserBrowsingDataType::Cache.subdirectories())
            .expect("clear cache succeeds");

        assert!(!cache.exists(), "cache dir was removed");
        assert!(cookies.exists(), "cookies dir is preserved by cache scope");

        let _ = fs::remove_dir_all(temp);
    }

    fn unique_temp_dir(case: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-app-replica-{case}-{nanos}"));
        fs::create_dir_all(&path).expect("temp dir");
        path
    }
}
