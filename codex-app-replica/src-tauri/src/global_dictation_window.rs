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
//! The top-level desktop dispatcher lists
//! `global-dictation-{recording-stopped,dismiss,completed,failed,
//! in-app-started,record-history-item,enabled-changed,force-lock-changed}`
//! in `QV` as pass-through `break;` cases, while the dedicated global
//! dictation controller (`eH.handleMessage(...)` in `main-Bnxe1qAn.js`)
//! owns the real lifecycle:
//!
//! - `dismiss` resets the compact layout and hides the window.
//! - `completed` clears the active session, hides the window, and records
//!   history before paste-back.
//! - `failed` keeps the error bubble open only for transcription failures;
//!   recording-start failures clear the session and hide immediately.

use crate::global_dictation_settings::{
    handle_global_dictation_completed, handle_global_dictation_dismiss,
    handle_global_dictation_failed, handle_global_dictation_record_history_item,
    GlobalDictationSettingsState,
};
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
    pub enabled: bool,
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
    dictation_settings: State<'_, GlobalDictationSettingsState>,
    params: GlobalDictationSessionParams,
) -> Result<(), String> {
    state.set_active_session(None);
    handle_global_dictation_dismiss(dictation_settings.inner(), &params.session_id);
    if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
        apply_layout(&window, GlobalDictationLayout::Compact)?;
        state.set_layout(GlobalDictationLayout::Compact);
        window
            .hide()
            .map_err(|err| format!("failed to hide global-dictation window on dismiss: {err}"))?;
    }
    Ok(())
}

#[tauri::command(rename = "global-dictation-completed")]
pub fn global_dictation_completed(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    dictation_settings: State<'_, GlobalDictationSettingsState>,
    params: GlobalDictationCompletedParams,
) -> Result<(), String> {
    state.set_active_session(None);
    if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
        window.hide().map_err(|err| {
            format!("failed to hide global-dictation window on completion: {err}")
        })?;
    }
    handle_global_dictation_completed(&app, dictation_settings.inner(), &params)
}

#[tauri::command(rename = "global-dictation-failed")]
pub fn global_dictation_failed(
    app: AppHandle,
    state: State<'_, GlobalDictationWindowState>,
    dictation_settings: State<'_, GlobalDictationSettingsState>,
    params: GlobalDictationFailedParams,
) -> Result<(), String> {
    if params.stage != "transcription" {
        state.set_active_session(None);
    }
    handle_global_dictation_failed(dictation_settings.inner(), &params);
    if params.stage != "transcription" {
        if let Some(window) = app.get_webview_window(GLOBAL_DICTATION_WINDOW_LABEL) {
            window.hide().map_err(|err| {
                format!("failed to hide global-dictation window after failure: {err}")
            })?;
        }
    }
    Ok(())
}

#[tauri::command(rename = "global-dictation-in-app-started")]
pub fn global_dictation_in_app_started() {}

#[tauri::command(rename = "global-dictation-record-history-item")]
pub fn global_dictation_record_history_item(
    app: AppHandle,
    params: GlobalDictationRecordHistoryItemParams,
) -> Result<(), String> {
    handle_global_dictation_record_history_item(&app, &params)
}

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
    let work_area = cursor_work_area_physical(window)
        .or_else(|| {
            preferred_monitor(window)
                .ok()
                .map(|monitor| monitor_work_area_physical(&monitor, scale))
        })
        .ok_or_else(|| "no monitor available for global-dictation window".to_string())?;

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
    if let (Ok(cursor), Ok(monitors)) = (window.cursor_position(), window.available_monitors()) {
        if let Some(monitor) = monitors.into_iter().min_by(|left, right| {
            distance_to_rect(cursor.x, cursor.y, monitor_rect(left))
                .partial_cmp(&distance_to_rect(cursor.x, cursor.y, monitor_rect(right)))
                .unwrap_or(std::cmp::Ordering::Equal)
        }) {
            return Ok(monitor);
        }
    }

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

fn monitor_rect(monitor: &tauri::Monitor) -> PhysicalRect {
    PhysicalRect {
        x: monitor.position().x,
        y: monitor.position().y,
        width: monitor.size().width,
        height: monitor.size().height,
    }
}

#[cfg(target_os = "windows")]
fn cursor_work_area_physical(window: &WebviewWindow) -> Option<PhysicalRect> {
    let cursor = window.cursor_position().ok()?;
    let point = WinPoint {
        x: cursor.x.round() as i32,
        y: cursor.y.round() as i32,
    };
    let monitor = unsafe { monitor_from_point(point, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return None;
    }

    let mut monitor_info = WinMonitorInfo {
        cb_size: std::mem::size_of::<WinMonitorInfo>() as u32,
        rc_monitor: WinRect::default(),
        rc_work: WinRect::default(),
        dw_flags: 0,
    };
    let loaded = unsafe { get_monitor_info_w(monitor, &mut monitor_info) };
    if loaded == 0 {
        return None;
    }

    Some(physical_rect_from_win_rect(monitor_info.rc_work))
}

#[cfg(not(target_os = "windows"))]
fn cursor_work_area_physical(_window: &WebviewWindow) -> Option<PhysicalRect> {
    None
}

fn monitor_work_area_physical(monitor: &tauri::Monitor, _scale: f64) -> PhysicalRect {
    // On Windows we prefer `cursor_work_area_physical(...)`, which reads the
    // monitor work area directly from Win32 so the bubble sits above the
    // taskbar like upstream. Other platforms still fall back to the full
    // monitor bounds because Tauri does not expose per-monitor work areas.
    monitor_rect(monitor)
}

fn distance_to_rect(x: f64, y: f64, rect: PhysicalRect) -> f64 {
    let left = f64::from(rect.x);
    let top = f64::from(rect.y);
    let right = left + f64::from(rect.width);
    let bottom = top + f64::from(rect.height);
    let clamped_x = x.clamp(left, right);
    let clamped_y = y.clamp(top, bottom);
    (x - clamped_x).hypot(y - clamped_y)
}

#[cfg(target_os = "windows")]
const MONITOR_DEFAULTTONEAREST: u32 = 2;

#[cfg(target_os = "windows")]
type HMonitor = *mut core::ffi::c_void;

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct WinPoint {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct WinRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct WinMonitorInfo {
    cb_size: u32,
    rc_monitor: WinRect,
    rc_work: WinRect,
    dw_flags: u32,
}

#[cfg(target_os = "windows")]
unsafe extern "system" {
    #[link_name = "MonitorFromPoint"]
    fn monitor_from_point(point: WinPoint, flags: u32) -> HMonitor;
    #[link_name = "GetMonitorInfoW"]
    fn get_monitor_info_w(monitor: HMonitor, monitor_info: *mut WinMonitorInfo) -> i32;
}

#[cfg(target_os = "windows")]
fn physical_rect_from_win_rect(rect: WinRect) -> PhysicalRect {
    PhysicalRect {
        x: rect.left,
        y: rect.top,
        width: (rect.right - rect.left).max(0) as u32,
        height: (rect.bottom - rect.top).max(0) as u32,
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
        let raw = serde_json::json!({"enabled": true});
        let parsed: GlobalDictationForceLockChangedParams =
            serde_json::from_value(raw).expect("deserialize");
        assert!(parsed.enabled);
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

    #[test]
    fn distance_to_rect_is_zero_inside_bounds() {
        let rect = PhysicalRect {
            x: 100,
            y: 200,
            width: 300,
            height: 400,
        };
        assert_eq!(distance_to_rect(250.0, 350.0, rect), 0.0);
    }

    #[test]
    fn distance_to_rect_measures_gap_outside_bounds() {
        let rect = PhysicalRect {
            x: 100,
            y: 200,
            width: 300,
            height: 400,
        };
        assert_eq!(distance_to_rect(500.0, 350.0, rect), 100.0);
        assert_eq!(distance_to_rect(250.0, 700.0, rect), 100.0);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn physical_rect_from_win_rect_uses_work_area_edges() {
        let rect = physical_rect_from_win_rect(WinRect {
            left: 10,
            top: 20,
            right: 210,
            bottom: 420,
        });
        assert_eq!(rect.x, 10);
        assert_eq!(rect.y, 20);
        assert_eq!(rect.width, 200);
        assert_eq!(rect.height, 400);
    }
}
