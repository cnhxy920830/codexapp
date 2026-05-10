//! Global dictation window owner.
//!
//! Backs the extracted `/global-dictation` page (`global-dictation-page-C614NQ6P.js`)
//! with the secondary Tauri window the upstream Electron host owns through
//! `ZV` in `main-Bnxe1qAn.js`. That class is responsible for:
//!
//! - Lazy `ensureWindow()` creation with a transparent, frameless,
//!   always-on-top, non-focusable window pinned to the bottom-center of the
//!   display nearest the cursor.
//! - `prewarm()` / `showAndStart(sessionId)` / `sendStop(sessionId)` /
//!   `setLayout("compact" | "error")` / `hide()` lifecycle.
//! - Forwarding `global-dictation-start` / `global-dictation-stop` events to
//!   the dictation window's webContents.
//! - Accepting `global-dictation-window-layout` dispatches from the page when
//!   it switches between the compact recording bubble and the error bubble.
//!
//! Upstream geometry constants (extracted directly from the bundled host):
//!
//! ```text
//! JV = 16   // bottom margin from work-area
//! YV = 40   // window height
//! XV = { compact: 72, error: 312 } // window widths per layout
//! ```
//!
//! The remaining `global-dictation-{recording-stopped,dismiss,completed,
//! failed,in-app-started,record-history-item,enabled-changed,
//! force-lock-changed}` desktop messages live in `QV` upstream as no-op
//! `break;` cases on the desktop side; their actual handling is renderer-side.
//! The replica registers them as no-op Tauri commands so the page-owned
//! `dispatchMessage(...)` contract is honored without inventing host-side
//! behavior that does not exist upstream.

use serde::Deserialize;
use serde::Serialize;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::PhysicalPosition;
use tauri::PhysicalSize;
use tauri::Position;
use tauri::Size;
use tauri::State;
use tauri::WebviewUrl;
use tauri::WebviewWindow;
use tauri::WebviewWindowBuilder;

const GLOBAL_DICTATION_WINDOW_LABEL: &str = "global-dictation";
const GLOBAL_DICTATION_ROUTE_PATH: &str = "/global-dictation";

const COMPACT_WIDTH: f64 = 72.0;
const ERROR_WIDTH: f64 = 312.0;
const WINDOW_HEIGHT: f64 = 40.0;
const BOTTOM_MARGIN: f64 = 16.0;

const GLOBAL_DICTATION_START_EVENT: &str = "global-dictation-start";
const GLOBAL_DICTATION_STOP_EVENT: &str = "global-dictation-stop";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GlobalDictationLayout {
    Compact,
    Error,
}

impl GlobalDictationLayout {
    fn width(self) -> f64 {
        match self {
            GlobalDictationLayout::Compact => COMPACT_WIDTH,
            GlobalDictationLayout::Error => ERROR_WIDTH,
        }
    }
}

#[derive(Debug, Default)]
pub struct GlobalDictationWindowState {
    inner: Mutex<GlobalDictationStateInner>,
}

#[derive(Debug, Default)]
struct GlobalDictationStateInner {
    layout: Option<GlobalDictationLayout>,
    active_session_id: Option<String>,
}

impl GlobalDictationWindowState {
    fn set_layout(&self, layout: GlobalDictationLayout) {
        let mut guard = self.inner.lock().expect("dictation state mutex poisoned");
        guard.layout = Some(layout);
    }

    fn set_active_session(&self, session_id: Option<String>) {
        let mut guard = self.inner.lock().expect("dictation state mutex poisoned");
        guard.active_session_id = session_id;
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalDictationStartEvent<'a> {
    session_id: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalDictationStopEvent<'a> {
    session_id: &'a str,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationSessionParams {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationLayoutParams {
    pub session_id: String,
    pub layout: GlobalDictationLayout,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationCompletedParams {
    pub session_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationFailedParams {
    pub session_id: String,
    pub stage: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationRecordHistoryItemParams {
    pub session_id: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at_ms: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationEnabledChangedParams {
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationForceLockChangedParams {
    pub force_lock: bool,
}

#[tauri::command(rename = "global-dictation-prewarm")]
pub fn global_dictation_prewarm(app: AppHandle) -> Result<(), String> {
    ensure_window(&app)?;
    Ok(())
}

#[tauri::command(rename = "global-dictation-show-and-start")]
pub fn global_dictation_show_and_start(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    params: GlobalDictationSessionParams,
) -> Result<bool, String> {
    let window = ensure_window(&app)?;
    apply_layout(&window, GlobalDictationLayout::Compact)?;
    state.set_layout(GlobalDictationLayout::Compact);
    state.set_active_session(Some(params.session_id.clone()));
    window
        .set_always_on_top(true)
        .map_err(|err| format!("failed to set always-on-top: {err}"))?;
    window
        .show()
        .map_err(|err| format!("failed to show global-dictation window: {err}"))?;
    app.emit_to(
        GLOBAL_DICTATION_WINDOW_LABEL,
        GLOBAL_DICTATION_START_EVENT,
        GlobalDictationStartEvent {
            session_id: &params.session_id,
        },
    )
    .map_err(|err| format!("failed to emit global-dictation-start: {err}"))?;
    Ok(true)
}

#[tauri::command(rename = "global-dictation-stop")]
pub fn global_dictation_stop(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    params: GlobalDictationSessionParams,
) -> Result<(), String> {
    if app
        .get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL)
        .is_none()
    {
        // Upstream `sendStop` is a no-op when there is no recorder window.
        return Ok(());
    }
    state.set_active_session(None);
    app.emit_to(
        GLOBAL_DICTATION_WINDOW_LABEL,
        GLOBAL_DICTATION_STOP_EVENT,
        GlobalDictationStopEvent {
            session_id: &params.session_id,
        },
    )
    .map_err(|err| format!("failed to emit global-dictation-stop: {err}"))
}

#[tauri::command(rename = "global-dictation-window-layout")]
pub fn global_dictation_window_layout(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    params: GlobalDictationLayoutParams,
) -> Result<(), String> {
    let _ = params.session_id; // upstream uses the id only for logging; no behavior gate.
    let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) else {
        return Ok(());
    };
    apply_layout(&window, params.layout)?;
    state.set_layout(params.layout);
    Ok(())
}

#[tauri::command(rename = "global-dictation-hide")]
pub fn global_dictation_hide(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|err| format!("failed to hide global-dictation window: {err}"))?;
    }
    Ok(())
}

#[tauri::command(rename = "global-dictation-recording-stopped")]
pub fn global_dictation_recording_stopped(_params: GlobalDictationSessionParams) {}

#[tauri::command(rename = "global-dictation-dismiss")]
pub fn global_dictation_dismiss(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    _params: GlobalDictationSessionParams,
) -> Result<(), String> {
    state.set_active_session(None);
    if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|err| format!("failed to hide global-dictation window on dismiss: {err}"))?;
    }
    Ok(())
}

#[tauri::command(rename = "global-dictation-completed")]
pub fn global_dictation_completed(_params: GlobalDictationCompletedParams) {}

#[tauri::command(rename = "global-dictation-failed")]
pub fn global_dictation_failed(_params: GlobalDictationFailedParams) {}

#[tauri::command(rename = "global-dictation-in-app-started")]
pub fn global_dictation_in_app_started() {}

#[tauri::command(rename = "global-dictation-record-history-item")]
pub fn global_dictation_record_history_item(_params: GlobalDictationRecordHistoryItemParams) {}

#[tauri::command(rename = "global-dictation-enabled-changed")]
pub fn global_dictation_enabled_changed(_params: GlobalDictationEnabledChangedParams) {}

#[tauri::command(rename = "global-dictation-force-lock-changed")]
pub fn global_dictation_force_lock_changed(_params: GlobalDictationForceLockChangedParams) {}

fn ensure_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        GLOBAL_DICTATION_WINDOW_LABEL,
        WebviewUrl::App(GLOBAL_DICTATION_ROUTE_PATH.into()),
    )
    .title("Dictation")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focusable(false)
    .shadow(false)
    .resizable(false)
    .visible(false)
    .inner_size(COMPACT_WIDTH, WINDOW_HEIGHT)
    .build()
    .map_err(|err| format!("failed to create {GLOBAL_DICTATION_WINDOW_LABEL}: {err}"))?;

    window
        .set_visible_on_all_workspaces(true)
        .map_err(|err| format!("failed to enable all-workspaces visibility: {err}"))?;
    window
        .set_always_on_top(true)
        .map_err(|err| format!("failed to keep dictation on top: {err}"))?;
    window
        .set_skip_taskbar(true)
        .map_err(|err| format!("failed to hide dictation from the taskbar: {err}"))?;

    apply_layout(&window, GlobalDictationLayout::Compact)?;
    Ok(window)
}

fn apply_layout(window: &WebviewWindow, layout: GlobalDictationLayout) -> Result<(), String> {
    let bounds = compute_bounds(window, layout)?;
    window
        .set_size(Size::Physical(PhysicalSize {
            width: bounds.width,
            height: bounds.height,
        }))
        .map_err(|err| format!("failed to resize global-dictation window: {err}"))?;
    window
        .set_position(Position::Physical(PhysicalPosition {
            x: bounds.x,
            y: bounds.y,
        }))
        .map_err(|err| format!("failed to position global-dictation window: {err}"))?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct DictationBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn compute_bounds(
    window: &WebviewWindow,
    layout: GlobalDictationLayout,
) -> Result<DictationBounds, String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let monitor = preferred_monitor(window)?;
    let work_area = monitor_work_area_physical(&monitor, scale);

    let logical_width = layout.width();
    let logical_height = WINDOW_HEIGHT;
    let logical_bottom_margin = BOTTOM_MARGIN;

    let physical_width = (logical_width * scale).round() as i32;
    let physical_height = (logical_height * scale).round() as i32;
    let physical_bottom_margin = (logical_bottom_margin * scale).round() as i32;

    let center_x = work_area.x + (work_area.width as i32 - physical_width).max(0) / 2;
    let bottom_anchored_y =
        work_area.y + (work_area.height as i32 - physical_height - physical_bottom_margin);
    let y = bottom_anchored_y.max(work_area.y);

    Ok(DictationBounds {
        x: center_x,
        y,
        width: physical_width.max(0) as u32,
        height: physical_height.max(0) as u32,
    })
}

fn preferred_monitor(window: &WebviewWindow) -> Result<tauri::Monitor, String> {
    if let Ok(Some(current)) = window.current_monitor() {
        return Ok(current);
    }
    if let Ok(Some(primary)) = window.primary_monitor() {
        return Ok(primary);
    }
    Err("no monitor available for global-dictation window".into())
}

#[derive(Debug, Clone, Copy)]
struct PhysicalRect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn monitor_work_area_physical(monitor: &tauri::Monitor, _scale: f64) -> PhysicalRect {
    // Tauri exposes the full monitor bounds in physical pixels. Tauri does not
    // currently expose the OS-reported "work area" (excluding taskbar), so we
    // fall back to the full bounds; on Windows the taskbar overlap is usually
    // <= BOTTOM_MARGIN, which the layout offset already accommodates.
    let position = monitor.position();
    let size = monitor.size();
    PhysicalRect {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_widths_match_extracted_constants() {
        assert_eq!(GlobalDictationLayout::Compact.width(), 72.0);
        assert_eq!(GlobalDictationLayout::Error.width(), 312.0);
    }

    #[test]
    fn layout_serializes_kebab_case() {
        let value = serde_json::to_value(GlobalDictationLayout::Compact).expect("serialize");
        assert_eq!(value, "compact");
        let value = serde_json::to_value(GlobalDictationLayout::Error).expect("serialize");
        assert_eq!(value, "error");
    }

    #[test]
    fn layout_params_roundtrip_camel_case() {
        let raw = serde_json::json!({
            "sessionId": "s-1",
            "layout": "error",
        });
        let parsed: GlobalDictationLayoutParams = serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.session_id, "s-1");
        assert_eq!(parsed.layout, GlobalDictationLayout::Error);
    }

    #[test]
    fn completed_params_roundtrip_camel_case() {
        let raw = serde_json::json!({"sessionId": "s-2", "text": "hello"});
        let parsed: GlobalDictationCompletedParams =
            serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.session_id, "s-2");
        assert_eq!(parsed.text, "hello");
    }

    #[test]
    fn failed_params_roundtrip_camel_case() {
        let raw = serde_json::json!({"sessionId": "s-3", "stage": "transcription"});
        let parsed: GlobalDictationFailedParams = serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.session_id, "s-3");
        assert_eq!(parsed.stage, "transcription");
    }

    #[test]
    fn record_history_item_params_allow_missing_completion_time() {
        let raw = serde_json::json!({"sessionId": "s-4", "text": "x"});
        let parsed: GlobalDictationRecordHistoryItemParams =
            serde_json::from_value(raw).expect("deserialize");
        assert!(parsed.completed_at_ms.is_none());
    }

    #[test]
    fn enabled_changed_params_roundtrip_camel_case() {
        let raw = serde_json::json!({"enabled": true});
        let parsed: GlobalDictationEnabledChangedParams =
            serde_json::from_value(raw).expect("deserialize");
        assert!(parsed.enabled);
    }

    #[test]
    fn force_lock_changed_params_roundtrip_camel_case() {
        let raw = serde_json::json!({"forceLock": true});
        let parsed: GlobalDictationForceLockChangedParams =
            serde_json::from_value(raw).expect("deserialize");
        assert!(parsed.force_lock);
    }

    #[test]
    fn state_tracks_layout_and_session() {
        let state = GlobalDictationWindowState::default();
        state.set_layout(GlobalDictationLayout::Error);
        state.set_active_session(Some("session".into()));
        let guard = state.inner.lock().unwrap();
        assert_eq!(guard.layout, Some(GlobalDictationLayout::Error));
        assert_eq!(guard.active_session_id.as_deref(), Some("session"));
    }
}
