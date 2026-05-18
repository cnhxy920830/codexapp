use crate::global_settings::read_global_settings;
use crate::global_settings::write_global_settings;
use crate::keyboard_shortcuts::read_command_keybinding_lookup;
use crate::keyboard_shortcuts::set_command_keybinding;
use crate::keyboard_shortcuts::CommandKeybindingLookup;
use crate::keyboard_shortcuts::CommandKeybindingUpdate;
use crate::keyboard_shortcuts::SetCommandKeybindingParams;
use crate::window_navigation::PendingWindowRoutes;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder, Window};

const HOTKEY_HOME_WINDOW_LABEL: &str = "hotkey-window-home";
const HOTKEY_THREAD_WINDOW_LABEL: &str = "hotkey-window-thread";
const HOTKEY_HOME_ROUTE_PATH: &str = "/hotkey-window";
const HOTKEY_NEW_THREAD_ROUTE_PATH: &str = "/hotkey-window/new-thread";
const HOTKEY_THREAD_ROUTE_PREFIX: &str = "/hotkey-window/thread/";
const HOTKEY_REMOTE_ROUTE_PREFIX: &str = "/hotkey-window/remote/";
const HOTKEY_WORKTREE_INIT_ROUTE_PREFIX: &str = "/hotkey-window/worktree-init-v2/";
const HOTKEY_WINDOW_COMMAND_ID: &str = "hotkeyWindow";
const HOTKEY_WINDOW_HOTKEY_GLOBAL_STATE_KEY: &str = "hotkeyWindowHotkey";
const HOTKEY_WINDOW_DEV_OVERRIDE_GLOBAL_STATE_KEY: &str =
    "hotkey-window-dev-hotkey-override-enabled";
const NAVIGATE_TO_ROUTE_EVENT: &str = "navigate-to-route";

// Extracted from the upstream hotkey-window lifecycle owner in main-Bnxe1qAn.js.
const HOTKEY_HOME_WIDTH: f64 = 470.0;
const HOTKEY_HOME_HEIGHT: f64 = 290.0;
const HOTKEY_THREAD_WIDTH: f64 = 470.0;
const HOTKEY_THREAD_HEIGHT: f64 = 640.0;
const HOTKEY_THREAD_MIN_WIDTH: f64 = 400.0;
const HOTKEY_THREAD_MIN_HEIGHT: f64 = 400.0;

#[derive(Debug, Default)]
pub struct HotkeyWindowGateState {
    enabled: Mutex<bool>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowHotkeyStateResponse {
    pub supported: bool,
    pub configured_hotkey: Option<String>,
    pub is_gate_enabled: bool,
    pub is_dev_mode: bool,
    pub is_dev_override_enabled: bool,
    pub is_active: bool,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowSetHotkeyParams {
    pub hotkey: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowSetDevHotkeyOverrideParams {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowSetHotkeyResponse {
    pub success: bool,
    pub error: Option<String>,
    pub state: HotkeyWindowHotkeyStateResponse,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInHotkeyWindowParams {
    pub path: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowHomePointerInteractionChangedParams {
    pub is_interactive: bool,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyWindowEnabledChangedParams {
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HotkeyWindowSurface {
    Home,
    Thread,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HotkeyWindowRoute {
    path: String,
    surface: HotkeyWindowSurface,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NavigateToRouteNotification {
    path: String,
}

#[tauri::command(rename = "hotkey-window-hotkey-state")]
pub fn hotkey_window_hotkey_state(
    app: AppHandle,
    gate_state: State<'_, HotkeyWindowGateState>,
) -> Result<HotkeyWindowHotkeyStateResponse, String> {
    let configured_hotkey = resolve_configured_hotkey_window_hotkey(&app)?;
    let has_configured_hotkey = configured_hotkey.is_some();
    let is_gate_enabled = hotkey_window_gate_enabled(&gate_state);
    let is_dev_mode = cfg!(debug_assertions);
    let is_dev_override_enabled = read_hotkey_window_dev_override_enabled(&app)?;

    Ok(HotkeyWindowHotkeyStateResponse {
        supported: true,
        configured_hotkey,
        is_gate_enabled,
        is_dev_mode,
        is_dev_override_enabled,
        is_active: hotkey_window_is_active(
            has_configured_hotkey,
            is_gate_enabled,
            is_dev_mode,
            is_dev_override_enabled,
        ),
    })
}

#[tauri::command(rename = "hotkey-window-set-hotkey")]
pub fn hotkey_window_set_hotkey(
    app: AppHandle,
    gate_state: State<'_, HotkeyWindowGateState>,
    params: HotkeyWindowSetHotkeyParams,
) -> Result<HotkeyWindowSetHotkeyResponse, String> {
    let HotkeyWindowSetHotkeyParams { hotkey } = params;
    let validation_error = hotkey
        .as_deref()
        .and_then(|shortcut| hotkey_window_hotkey_error(shortcut, cfg!(target_os = "macos")))
        .map(str::to_string);

    let error = match validation_error {
        Some(error) => Some(error),
        None => {
            let update = match hotkey.as_ref() {
                Some(accelerator) => CommandKeybindingUpdate::Set {
                    accelerator: accelerator.clone(),
                },
                None => CommandKeybindingUpdate::Reset,
            };

            match set_command_keybinding(
                app.clone(),
                SetCommandKeybindingParams {
                    command_id: HOTKEY_WINDOW_COMMAND_ID.to_string(),
                    update,
                },
            ) {
                Ok(_) => sync_legacy_hotkey_window_hotkey(&app, hotkey.as_deref()).err(),
                Err(err) => Some(err),
            }
        }
    };

    let state = hotkey_window_hotkey_state(app, gate_state)?;
    Ok(HotkeyWindowSetHotkeyResponse {
        success: error.is_none(),
        error,
        state,
    })
}

#[tauri::command(rename = "hotkey-window-set-dev-hotkey-override")]
pub fn hotkey_window_set_dev_hotkey_override(
    app: AppHandle,
    gate_state: State<'_, HotkeyWindowGateState>,
    params: HotkeyWindowSetDevHotkeyOverrideParams,
) -> Result<HotkeyWindowSetHotkeyResponse, String> {
    let error = write_hotkey_window_dev_override_enabled(&app, params.enabled).err();
    let state = hotkey_window_hotkey_state(app, gate_state)?;
    Ok(HotkeyWindowSetHotkeyResponse {
        success: error.is_none(),
        error,
        state,
    })
}

#[tauri::command(rename = "open-in-hotkey-window")]
pub fn open_in_hotkey_window(
    app: AppHandle,
    window: Window,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: OpenInHotkeyWindowParams,
) -> Result<(), String> {
    let route = validated_hotkey_window_route(&params.path)?;
    let target_label = route.surface.window_label();

    if let Some(existing_window) = app.get_webview_window(target_label) {
        apply_hotkey_window_surface_policy(&existing_window, route.surface)?;
        navigate_window_to_route(&existing_window, &route.path)?;
        show_and_focus_window(&existing_window)?;
        hide_replaced_hotkey_surface(&app, &window, route.surface)?;
        return Ok(());
    }

    pending_window_routes.insert(target_label, route.path.clone())?;
    match create_hotkey_window(&app, &route) {
        Ok(created_window) => {
            show_and_focus_window(&created_window)?;
            hide_replaced_hotkey_surface(&app, &window, route.surface)
        }
        Err(err) => {
            let _ = pending_window_routes.remove(target_label);
            Err(err)
        }
    }
}

#[tauri::command(rename = "hotkey-window-home-pointer-interaction-changed")]
pub fn hotkey_window_home_pointer_interaction_changed(
    window: Window,
    params: HotkeyWindowHomePointerInteractionChangedParams,
) -> Result<(), String> {
    if window.label() != HOTKEY_HOME_WINDOW_LABEL {
        return Ok(());
    }

    window
        .set_ignore_cursor_events(!params.is_interactive)
        .map_err(|err| {
            format!("failed to update {HOTKEY_HOME_WINDOW_LABEL} pointer interactivity: {err}")
        })
}

#[tauri::command(rename = "hotkey-window-enabled-changed")]
pub fn hotkey_window_enabled_changed(
    gate_state: State<'_, HotkeyWindowGateState>,
    params: HotkeyWindowEnabledChangedParams,
) {
    *gate_state
        .enabled
        .lock()
        .expect("hotkey window gate state mutex poisoned") = params.enabled;
}

fn hotkey_window_gate_enabled(gate_state: &HotkeyWindowGateState) -> bool {
    *gate_state
        .enabled
        .lock()
        .expect("hotkey window gate state mutex poisoned")
}

fn hotkey_window_is_active(
    has_configured_hotkey: bool,
    is_gate_enabled: bool,
    is_dev_mode: bool,
    is_dev_override_enabled: bool,
) -> bool {
    has_configured_hotkey && is_gate_enabled && (!is_dev_mode || is_dev_override_enabled)
}

fn resolve_configured_hotkey_window_hotkey(app: &AppHandle) -> Result<Option<String>, String> {
    let keymap_hotkey = read_command_keybinding_lookup(app, HOTKEY_WINDOW_COMMAND_ID)?;
    let legacy_hotkey = read_legacy_hotkey_window_hotkey(app)?;
    let configured_hotkey = resolve_hotkey_window_hotkey(&keymap_hotkey, legacy_hotkey);

    if keymap_hotkey.has_binding {
        sync_legacy_hotkey_window_hotkey(app, configured_hotkey.as_deref())?;
    }

    Ok(configured_hotkey)
}

fn resolve_hotkey_window_hotkey(
    keymap_hotkey: &CommandKeybindingLookup,
    legacy_hotkey: Option<String>,
) -> Option<String> {
    if keymap_hotkey.has_binding {
        keymap_hotkey.hotkey.clone()
    } else {
        legacy_hotkey
    }
}

fn read_legacy_hotkey_window_hotkey(app: &AppHandle) -> Result<Option<String>, String> {
    let settings = read_global_settings(app)?;
    Ok(settings
        .get(HOTKEY_WINDOW_HOTKEY_GLOBAL_STATE_KEY)
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|shortcut| {
            hotkey_window_hotkey_error(shortcut, cfg!(target_os = "macos")).is_none()
        }))
}

fn read_hotkey_window_dev_override_enabled(app: &AppHandle) -> Result<bool, String> {
    let settings = read_global_settings(app)?;
    Ok(settings
        .get(HOTKEY_WINDOW_DEV_OVERRIDE_GLOBAL_STATE_KEY)
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

fn write_hotkey_window_dev_override_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    let next_value = Value::Bool(enabled);
    if settings.get(HOTKEY_WINDOW_DEV_OVERRIDE_GLOBAL_STATE_KEY) == Some(&next_value) {
        return Ok(());
    }
    settings.insert(
        HOTKEY_WINDOW_DEV_OVERRIDE_GLOBAL_STATE_KEY.to_string(),
        next_value,
    );
    write_global_settings(app, &settings)
}

fn sync_legacy_hotkey_window_hotkey(
    app: &AppHandle,
    configured_hotkey: Option<&str>,
) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    match configured_hotkey {
        Some(hotkey) => {
            let next_value = Value::String(hotkey.to_string());
            if settings.get(HOTKEY_WINDOW_HOTKEY_GLOBAL_STATE_KEY) == Some(&next_value) {
                return Ok(());
            }
            settings.insert(
                HOTKEY_WINDOW_HOTKEY_GLOBAL_STATE_KEY.to_string(),
                next_value,
            );
        }
        None => {
            if settings
                .remove(HOTKEY_WINDOW_HOTKEY_GLOBAL_STATE_KEY)
                .is_none()
            {
                return Ok(());
            }
        }
    }

    write_global_settings(app, &settings)
}

fn hotkey_window_hotkey_error(shortcut: &str, is_macos: bool) -> Option<&'static str> {
    let segments = split_hotkey_window_shortcut(shortcut);
    if is_macos && macos_bare_modifier_name(shortcut).is_some() {
        return None;
    }
    if segments
        .iter()
        .any(|segment| is_bare_modifier_segment(segment))
    {
        return if segments.len() == 1 {
            if is_macos {
                Some("This shortcut key is not supported.")
            } else {
                Some("Choose a shortcut with Ctrl or Alt plus another key.")
            }
        } else {
            Some("Use Ctrl, Alt, or Command when combining with another key.")
        };
    }
    if segments.is_empty() {
        return Some("Shortcut cannot be empty.");
    }

    let mut has_supported_modifier = false;
    let mut key = None;
    for segment in segments {
        let lowered = segment.to_ascii_lowercase();
        if is_modifier_segment(&lowered) {
            if is_supported_modifier_segment(&lowered) {
                has_supported_modifier = true;
            }
            continue;
        }
        if key.is_some() {
            return Some("Shortcut must include exactly one non-modifier key.");
        }
        key = Some(segment);
    }

    if key.is_none() {
        return Some("Shortcut must include a non-modifier key.");
    }

    if has_supported_modifier {
        None
    } else {
        Some("Shortcut must include Cmd/Ctrl or Alt.")
    }
}

fn split_hotkey_window_shortcut(shortcut: &str) -> Vec<&str> {
    shortcut
        .split('+')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .collect()
}

fn is_bare_modifier_segment(segment: &str) -> bool {
    macos_bare_modifier_name(segment).is_some()
        || matches!(
            normalize_hotkey_segment(segment).as_str(),
            "rightcontrol" | "rightctrl" | "leftshift" | "rightshift"
        )
}

fn macos_bare_modifier_name(segment: &str) -> Option<&'static str> {
    match normalize_hotkey_segment(segment).as_str() {
        "fn" => Some("Fn"),
        "leftoption" | "leftalt" => Some("LeftOption"),
        "rightoption" | "rightalt" => Some("RightOption"),
        "leftcommand" | "leftcmd" | "leftmeta" => Some("LeftCommand"),
        "doublecommand"
        | "leftcommand+rightcommand"
        | "leftcmd+rightcmd"
        | "leftmeta+rightmeta" => Some("DoubleCommand"),
        "rightcommand" | "rightcmd" | "rightmeta" => Some("RightCommand"),
        "leftcontrol" | "leftctrl" => Some("LeftControl"),
        _ => None,
    }
}

fn is_modifier_segment(segment: &str) -> bool {
    matches!(
        segment,
        "cmdorctrl" | "command" | "cmd" | "control" | "ctrl" | "alt" | "option" | "shift"
    )
}

fn is_supported_modifier_segment(segment: &str) -> bool {
    matches!(
        segment,
        "cmdorctrl" | "command" | "cmd" | "control" | "ctrl" | "alt" | "option"
    )
}

fn normalize_hotkey_segment(segment: &str) -> String {
    segment
        .chars()
        .filter(|character| !matches!(character, ' ' | '_' | '-'))
        .flat_map(char::to_lowercase)
        .collect()
}

fn validated_hotkey_window_route(path: &str) -> Result<HotkeyWindowRoute, String> {
    let surface =
        route_surface(path).ok_or_else(|| format!("invalid hotkey window path: {path}"))?;
    Ok(HotkeyWindowRoute {
        path: path.to_string(),
        surface,
    })
}

fn route_surface(path: &str) -> Option<HotkeyWindowSurface> {
    if path == HOTKEY_HOME_ROUTE_PATH {
        return Some(HotkeyWindowSurface::Home);
    }

    if path == HOTKEY_NEW_THREAD_ROUTE_PATH {
        return Some(HotkeyWindowSurface::Thread);
    }

    if let Some(id) = path
        .strip_prefix(HOTKEY_THREAD_ROUTE_PREFIX)
        .or_else(|| path.strip_prefix(HOTKEY_REMOTE_ROUTE_PREFIX))
        .or_else(|| path.strip_prefix(HOTKEY_WORKTREE_INIT_ROUTE_PREFIX))
    {
        return (!id.is_empty() && id.bytes().all(is_valid_hotkey_route_byte))
            .then_some(HotkeyWindowSurface::Thread);
    }

    None
}

fn create_hotkey_window(
    app: &AppHandle,
    route: &HotkeyWindowRoute,
) -> Result<WebviewWindow, String> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "missing window template config".to_string())?;
    config.label = route.surface.window_label().to_string();

    let builder = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| format!("failed to clone hotkey window template: {err}"))?
        .title(app.package_info().name.clone())
        .visible(false)
        .focused(false);

    match route.surface {
        HotkeyWindowSurface::Home => builder
            .inner_size(HOTKEY_HOME_WIDTH, HOTKEY_HOME_HEIGHT)
            .build()
            .map_err(|err| format!("failed to create {HOTKEY_HOME_WINDOW_LABEL} window: {err}")),
        HotkeyWindowSurface::Thread => builder
            .inner_size(HOTKEY_THREAD_WIDTH, HOTKEY_THREAD_HEIGHT)
            .min_inner_size(HOTKEY_THREAD_MIN_WIDTH, HOTKEY_THREAD_MIN_HEIGHT)
            .build()
            .map_err(|err| format!("failed to create {HOTKEY_THREAD_WINDOW_LABEL} window: {err}")),
    }
}

fn apply_hotkey_window_surface_policy(
    window: &WebviewWindow,
    surface: HotkeyWindowSurface,
) -> Result<(), String> {
    match surface {
        HotkeyWindowSurface::Home => window
            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                HOTKEY_HOME_WIDTH,
                HOTKEY_HOME_HEIGHT,
            )))
            .map_err(|err| format!("failed to resize {HOTKEY_HOME_WINDOW_LABEL} window: {err}")),
        HotkeyWindowSurface::Thread => {
            window
                .set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
                    HOTKEY_THREAD_MIN_WIDTH,
                    HOTKEY_THREAD_MIN_HEIGHT,
                ))))
                .map_err(|err| {
                    format!("failed to update {HOTKEY_THREAD_WINDOW_LABEL} minimum size: {err}")
                })?;
            Ok(())
        }
    }
}

fn hide_replaced_hotkey_surface(
    app: &AppHandle,
    origin_window: &Window,
    target_surface: HotkeyWindowSurface,
) -> Result<(), String> {
    let replacement_label = target_surface.window_label();
    if origin_window.label() == replacement_label || !is_hotkey_window_label(origin_window.label())
    {
        return Ok(());
    }

    let replaced_label = match target_surface {
        HotkeyWindowSurface::Home => HOTKEY_THREAD_WINDOW_LABEL,
        HotkeyWindowSurface::Thread => HOTKEY_HOME_WINDOW_LABEL,
    };

    if origin_window.label() == replaced_label {
        return origin_window
            .hide()
            .map_err(|err| format!("failed to hide replaced {replaced_label} window: {err}"));
    }

    if let Some(existing_window) = app.get_webview_window(replaced_label) {
        existing_window
            .hide()
            .map_err(|err| format!("failed to hide replaced {replaced_label} window: {err}"))?;
    }

    Ok(())
}

fn navigate_window_to_route(window: &WebviewWindow, path: &str) -> Result<(), String> {
    window
        .emit(
            NAVIGATE_TO_ROUTE_EVENT,
            NavigateToRouteNotification {
                path: path.to_string(),
            },
        )
        .map_err(|err| format!("failed to emit {NAVIGATE_TO_ROUTE_EVENT}: {err}"))
}

fn show_and_focus_window(window: &WebviewWindow) -> Result<(), String> {
    window
        .show()
        .map_err(|err| format!("failed to show {} window: {err}", window.label()))?;
    window
        .set_focus()
        .map_err(|err| format!("failed to focus {} window: {err}", window.label()))
}

fn is_hotkey_window_label(label: &str) -> bool {
    matches!(label, HOTKEY_HOME_WINDOW_LABEL | HOTKEY_THREAD_WINDOW_LABEL)
}

fn is_valid_hotkey_route_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'%')
}

impl HotkeyWindowSurface {
    fn window_label(self) -> &'static str {
        match self {
            HotkeyWindowSurface::Home => HOTKEY_HOME_WINDOW_LABEL,
            HotkeyWindowSurface::Thread => HOTKEY_THREAD_WINDOW_LABEL,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::hotkey_window_gate_enabled;
    use super::hotkey_window_hotkey_error;
    use super::hotkey_window_is_active;
    use super::resolve_hotkey_window_hotkey;
    use super::route_surface;
    use super::validated_hotkey_window_route;
    use super::HotkeyWindowEnabledChangedParams;
    use super::HotkeyWindowGateState;
    use super::HotkeyWindowHomePointerInteractionChangedParams;
    use super::HotkeyWindowHotkeyStateResponse;
    use super::HotkeyWindowRoute;
    use super::HotkeyWindowSetDevHotkeyOverrideParams;
    use super::HotkeyWindowSetHotkeyParams;
    use super::HotkeyWindowSetHotkeyResponse;
    use super::HotkeyWindowSurface;
    use super::OpenInHotkeyWindowParams;
    use super::HOTKEY_HOME_ROUTE_PATH;
    use super::HOTKEY_NEW_THREAD_ROUTE_PATH;
    use crate::keyboard_shortcuts::CommandKeybindingLookup;

    #[test]
    fn classifies_supported_hotkey_window_routes() {
        assert_eq!(
            route_surface(HOTKEY_HOME_ROUTE_PATH),
            Some(HotkeyWindowSurface::Home)
        );
        assert_eq!(
            route_surface(HOTKEY_NEW_THREAD_ROUTE_PATH),
            Some(HotkeyWindowSurface::Thread)
        );
        assert_eq!(
            route_surface("/hotkey-window/thread/thread_abc-123"),
            Some(HotkeyWindowSurface::Thread)
        );
        assert_eq!(
            route_surface("/hotkey-window/remote/task_abc-123"),
            Some(HotkeyWindowSurface::Thread)
        );
        assert_eq!(
            route_surface("/hotkey-window/worktree-init-v2/pending_abc-123"),
            Some(HotkeyWindowSurface::Thread)
        );
    }

    #[test]
    fn rejects_unsupported_hotkey_window_routes() {
        assert_eq!(route_surface(""), None);
        assert_eq!(route_surface("/"), None);
        assert_eq!(route_surface("/debug"), None);
        assert_eq!(route_surface("/global-dictation"), None);
        assert_eq!(route_surface("/hotkey-window/thread/thread?id=1"), None);
        assert_eq!(route_surface("/hotkey-window/thread/"), None);
    }

    #[test]
    fn validates_hotkey_window_paths() {
        assert_eq!(
            validated_hotkey_window_route("/hotkey-window/thread/thread_abc-123"),
            Ok(HotkeyWindowRoute {
                path: "/hotkey-window/thread/thread_abc-123".to_string(),
                surface: HotkeyWindowSurface::Thread,
            })
        );
    }

    #[test]
    fn deserializes_open_in_hotkey_window_payload() {
        let payload: OpenInHotkeyWindowParams = serde_json::from_value(serde_json::json!({
            "path": "/hotkey-window/new-thread"
        }))
        .expect("open-in-hotkey-window payload should deserialize");

        assert_eq!(
            payload,
            OpenInHotkeyWindowParams {
                path: "/hotkey-window/new-thread".to_string(),
            }
        );
    }

    #[test]
    fn deserializes_pointer_interaction_payload() {
        let payload: HotkeyWindowHomePointerInteractionChangedParams =
            serde_json::from_value(serde_json::json!({
                "isInteractive": true
            }))
            .expect("pointer interactivity payload should deserialize");

        assert_eq!(
            payload,
            HotkeyWindowHomePointerInteractionChangedParams {
                is_interactive: true,
            }
        );
    }

    #[test]
    fn deserializes_set_hotkey_payload() {
        let payload: HotkeyWindowSetHotkeyParams = serde_json::from_value(serde_json::json!({
            "hotkey": "Ctrl+Alt+K"
        }))
        .expect("hotkey-window-set-hotkey payload should deserialize");

        assert_eq!(
            payload,
            HotkeyWindowSetHotkeyParams {
                hotkey: Some("Ctrl+Alt+K".to_string()),
            }
        );
    }

    #[test]
    fn deserializes_set_dev_override_payload() {
        let payload: HotkeyWindowSetDevHotkeyOverrideParams =
            serde_json::from_value(serde_json::json!({
                "enabled": true
            }))
            .expect("hotkey-window-set-dev-hotkey-override payload should deserialize");

        assert_eq!(
            payload,
            HotkeyWindowSetDevHotkeyOverrideParams { enabled: true }
        );
    }

    #[test]
    fn falls_back_to_legacy_hotkey_when_keymap_binding_is_missing() {
        assert_eq!(
            resolve_hotkey_window_hotkey(
                &CommandKeybindingLookup {
                    has_binding: false,
                    hotkey: None,
                },
                Some("Ctrl+Alt+K".to_string()),
            ),
            Some("Ctrl+Alt+K".to_string())
        );
    }

    #[test]
    fn keymap_hotkey_wins_over_legacy_hotkey() {
        assert_eq!(
            resolve_hotkey_window_hotkey(
                &CommandKeybindingLookup {
                    has_binding: true,
                    hotkey: Some("Ctrl+Alt+L".to_string()),
                },
                Some("Ctrl+Alt+K".to_string()),
            ),
            Some("Ctrl+Alt+L".to_string())
        );
    }

    #[test]
    fn explicit_keymap_clear_disables_legacy_hotkey() {
        assert_eq!(
            resolve_hotkey_window_hotkey(
                &CommandKeybindingLookup {
                    has_binding: true,
                    hotkey: None,
                },
                Some("Ctrl+Alt+K".to_string()),
            ),
            None
        );
    }

    #[test]
    fn validates_hotkey_window_hotkeys_with_upstream_windows_rules() {
        assert_eq!(hotkey_window_hotkey_error("Ctrl+Alt+K", false), None);
        assert_eq!(
            hotkey_window_hotkey_error("LeftShift", false),
            Some("Choose a shortcut with Ctrl or Alt plus another key.")
        );
        assert_eq!(
            hotkey_window_hotkey_error("Shift", false),
            Some("Shortcut must include a non-modifier key.")
        );
        assert_eq!(
            hotkey_window_hotkey_error("K", false),
            Some("Shortcut must include Cmd/Ctrl or Alt.")
        );
    }

    #[test]
    fn serializes_hotkey_window_hotkey_state_with_camel_case_fields() {
        let value = serde_json::to_value(HotkeyWindowHotkeyStateResponse {
            supported: true,
            configured_hotkey: Some("Ctrl+Alt+K".to_string()),
            is_gate_enabled: false,
            is_dev_mode: false,
            is_dev_override_enabled: false,
            is_active: false,
        })
        .expect("hotkey window state should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "supported": true,
                "configuredHotkey": "Ctrl+Alt+K",
                "isGateEnabled": false,
                "isDevMode": false,
                "isDevOverrideEnabled": false,
                "isActive": false
            })
        );
    }

    #[test]
    fn deserializes_enabled_changed_payload() {
        let payload: HotkeyWindowEnabledChangedParams = serde_json::from_value(serde_json::json!({
            "enabled": true
        }))
        .expect("hotkey-window-enabled-changed payload should deserialize");

        assert_eq!(payload, HotkeyWindowEnabledChangedParams { enabled: true });
    }

    #[test]
    fn gate_state_defaults_to_disabled() {
        let gate_state = HotkeyWindowGateState::default();
        assert!(!hotkey_window_gate_enabled(&gate_state));
    }

    #[test]
    fn hotkey_window_active_formula_matches_dev_override_rules() {
        assert!(!hotkey_window_is_active(false, true, false, false));
        assert!(!hotkey_window_is_active(true, false, false, false));
        assert!(!hotkey_window_is_active(true, true, true, false));
        assert!(hotkey_window_is_active(true, true, true, true));
        assert!(hotkey_window_is_active(true, true, false, false));
    }

    #[test]
    fn serializes_set_hotkey_response_with_camel_case_fields() {
        let value = serde_json::to_value(HotkeyWindowSetHotkeyResponse {
            success: true,
            error: None,
            state: HotkeyWindowHotkeyStateResponse {
                supported: true,
                configured_hotkey: Some("Ctrl+Alt+K".to_string()),
                is_gate_enabled: false,
                is_dev_mode: false,
                is_dev_override_enabled: false,
                is_active: false,
            },
        })
        .expect("hotkey-window-set-hotkey response should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "success": true,
                "error": null,
                "state": {
                    "supported": true,
                    "configuredHotkey": "Ctrl+Alt+K",
                    "isGateEnabled": false,
                    "isDevMode": false,
                    "isDevOverrideEnabled": false,
                    "isActive": false
                }
            })
        );
    }
}
