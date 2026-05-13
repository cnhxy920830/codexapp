//! Windows taskbar badge owner.
//!
//! The extracted desktop host dispatches `electron-set-badge-count` and the
//! upstream Electron main process forwards it to `app.setBadgeCount(count)`.
//! Electron's `app.setBadgeCount` is not supported on Windows, so the faithful
//! Windows-owner behavior is to accept the message and produce no visible taskbar
//! badge change.
//!
//! The replica previously substituted a numeric overlay icon. That created a
//! Windows-visible badge the upstream app does not expose through this API, so
//! the owner now intentionally behaves as a no-op while preserving the upstream
//! command name and parameter shape.

use serde::Deserialize;
use serde::Serialize;
use tauri::Window;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ElectronSetBadgeCountParams {
    pub count: u32,
}

#[tauri::command(rename = "electron-set-badge-count")]
pub fn electron_set_badge_count(
    _window: Window,
    _params: ElectronSetBadgeCountParams,
) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn params_deserialize_camel_case() {
        let raw = serde_json::json!({"count": 7});
        let parsed: ElectronSetBadgeCountParams = serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.count, 7);
    }

    #[test]
    fn params_accept_zero_and_large_values() {
        let zero: ElectronSetBadgeCountParams =
            serde_json::from_value(serde_json::json!({"count": 0})).expect("deserialize zero");
        let large: ElectronSetBadgeCountParams =
            serde_json::from_value(serde_json::json!({"count": 9999})).expect("deserialize large");

        assert_eq!(zero.count, 0);
        assert_eq!(large.count, 9999);
    }
}
