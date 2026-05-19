use crate::global_dictation_window::{
    global_dictation_show_and_start, global_dictation_stop, GlobalDictationCompletedParams,
    GlobalDictationFailedParams, GlobalDictationSessionParams, GlobalDictationWindowState,
};
use crate::global_settings::{read_global_settings, write_global_settings};
use crate::keyboard_shortcuts::{
    read_command_keybinding_lookup, set_command_keybinding, CommandKeybindingUpdate,
    SetCommandKeybindingParams,
};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const HOLD_COMMAND_ID: &str = "globalDictationHold";
const TOGGLE_COMMAND_ID: &str = "globalDictationToggle";
const GLOBAL_DICTATION_HISTORY_KEY: &str = "globalDictationHistory";
const MAX_GLOBAL_DICTATION_HISTORY_ITEMS: usize = 10;
const GLOBAL_DICTATION_PASTE_INITIAL_DELAY_MS: u64 = 150;
const GLOBAL_DICTATION_PASTE_FINAL_DELAY_MS: u64 = 700;

#[cfg(target_os = "windows")]
const WM_APP_REFRESH_HOTKEYS: u32 = WM_APP_BASE + 17;
#[cfg(target_os = "windows")]
const WM_APP_EXIT_RUNTIME: u32 = WM_APP_BASE + 18;
#[cfg(target_os = "windows")]
const WM_APP_BASE: u32 = 0x8000;
#[cfg(target_os = "windows")]
const PM_NOREMOVE: u32 = 0x0000;
#[cfg(target_os = "windows")]
const WM_HOTKEY: u32 = 0x0312;
#[cfg(target_os = "windows")]
const HOTKEY_ID_HOLD: i32 = 0x4401;
#[cfg(target_os = "windows")]
const HOTKEY_ID_TOGGLE: i32 = 0x4402;
#[cfg(target_os = "windows")]
const HOTKEY_ID_VALIDATION: i32 = 0x4403;
#[cfg(target_os = "windows")]
const MOD_ALT: u32 = 0x0001;
#[cfg(target_os = "windows")]
const MOD_CONTROL: u32 = 0x0002;
#[cfg(target_os = "windows")]
const MOD_SHIFT: u32 = 0x0004;
#[cfg(target_os = "windows")]
const MOD_WIN: u32 = 0x0008;
#[cfg(target_os = "windows")]
const MOD_NOREPEAT: u32 = 0x4000;
#[cfg(target_os = "windows")]
const CF_UNICODETEXT: u32 = 13;
#[cfg(target_os = "windows")]
const GMEM_MOVEABLE: usize = 0x0002;
#[cfg(target_os = "windows")]
const VK_BACK: u32 = 0x08;
#[cfg(target_os = "windows")]
const VK_TAB: u32 = 0x09;
#[cfg(target_os = "windows")]
const VK_RETURN: u32 = 0x0D;
#[cfg(target_os = "windows")]
const VK_ESCAPE: u32 = 0x1B;
#[cfg(target_os = "windows")]
const VK_SPACE: u32 = 0x20;
#[cfg(target_os = "windows")]
const VK_PRIOR: u32 = 0x21;
#[cfg(target_os = "windows")]
const VK_NEXT: u32 = 0x22;
#[cfg(target_os = "windows")]
const VK_END: u32 = 0x23;
#[cfg(target_os = "windows")]
const VK_HOME: u32 = 0x24;
#[cfg(target_os = "windows")]
const VK_LEFT: u32 = 0x25;
#[cfg(target_os = "windows")]
const VK_UP: u32 = 0x26;
#[cfg(target_os = "windows")]
const VK_RIGHT: u32 = 0x27;
#[cfg(target_os = "windows")]
const VK_DOWN: u32 = 0x28;
#[cfg(target_os = "windows")]
const VK_INSERT: u32 = 0x2D;
#[cfg(target_os = "windows")]
const VK_DELETE: u32 = 0x2E;
#[cfg(target_os = "windows")]
const VK_SHIFT_KEYSTATE: i32 = 0x10;
#[cfg(target_os = "windows")]
const VK_CONTROL_KEYSTATE: i32 = 0x11;
#[cfg(target_os = "windows")]
const VK_MENU_KEYSTATE: i32 = 0x12;
#[cfg(target_os = "windows")]
const VK_LWIN_KEYSTATE: i32 = 0x5B;
#[cfg(target_os = "windows")]
const VK_RWIN_KEYSTATE: i32 = 0x5C;
#[cfg(target_os = "windows")]
const VK_F1: u32 = 0x70;
#[cfg(target_os = "windows")]
const VK_OEM_1: u32 = 0xBA;
#[cfg(target_os = "windows")]
const VK_OEM_PLUS: u32 = 0xBB;
#[cfg(target_os = "windows")]
const VK_OEM_COMMA: u32 = 0xBC;
#[cfg(target_os = "windows")]
const VK_OEM_MINUS: u32 = 0xBD;
#[cfg(target_os = "windows")]
const VK_OEM_PERIOD: u32 = 0xBE;
#[cfg(target_os = "windows")]
const VK_OEM_2: u32 = 0xBF;
#[cfg(target_os = "windows")]
const VK_OEM_3: u32 = 0xC0;
#[cfg(target_os = "windows")]
const VK_OEM_4: u32 = 0xDB;
#[cfg(target_os = "windows")]
const VK_OEM_5: u32 = 0xDC;
#[cfg(target_os = "windows")]
const VK_OEM_6: u32 = 0xDD;
#[cfg(target_os = "windows")]
const VK_OEM_7: u32 = 0xDE;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationHotkeyStateResponse {
    pub supported: bool,
    pub configured_hotkey: Option<String>,
    pub configured_toggle_hotkey: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationSetHotkeyResponse {
    pub success: bool,
    pub error: Option<String>,
    pub state: GlobalDictationHotkeyStateResponse,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationSetHotkeyParams {
    pub hotkey: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationHistoryItem {
    pub id: String,
    pub text: String,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationHistoryResponse {
    pub items: Vec<GlobalDictationHistoryItem>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationCopyHistoryItemParams {
    pub id: String,
}

#[derive(Debug, Default)]
pub struct GlobalDictationSettingsState {
    inner: Mutex<GlobalDictationSettingsStateInner>,
}

#[derive(Debug, Default)]
struct GlobalDictationSettingsStateInner {
    active_session: Option<ActiveGlobalDictationSession>,
    next_session_counter: u64,
    runtime_thread_id: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ActiveGlobalDictationSession {
    session_id: String,
    source: GlobalDictationSessionSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GlobalDictationSessionSource {
    Hold,
    Toggle,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct RegisteredGlobalDictationHotkey {
    release_watch_keys: Vec<Vec<i32>>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct WindowsHotkeyRegistration {
    modifiers: u32,
    release_watch_keys: Vec<Vec<i32>>,
    virtual_key: u32,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, Default)]
#[repr(C)]
struct WinPoint {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, Default)]
#[repr(C)]
struct WinMsg {
    hwnd: *mut core::ffi::c_void,
    message: u32,
    w_param: usize,
    l_param: isize,
    time: u32,
    pt: WinPoint,
    l_private: u32,
}

#[cfg(target_os = "windows")]
unsafe extern "system" {
    #[link_name = "CloseClipboard"]
    fn close_clipboard() -> i32;
    #[link_name = "EmptyClipboard"]
    fn empty_clipboard() -> i32;
    #[link_name = "GetAsyncKeyState"]
    fn get_async_key_state(virtual_key: i32) -> i16;
    #[link_name = "GetCurrentThreadId"]
    fn get_current_thread_id() -> u32;
    #[link_name = "GetMessageW"]
    fn get_message_w(
        message: *mut WinMsg,
        window: *mut core::ffi::c_void,
        message_filter_min: u32,
        message_filter_max: u32,
    ) -> i32;
    #[link_name = "GlobalAlloc"]
    fn global_alloc(flags: usize, bytes: usize) -> *mut core::ffi::c_void;
    #[link_name = "GlobalFree"]
    fn global_free(memory: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    #[link_name = "GlobalLock"]
    fn global_lock(memory: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    #[link_name = "GlobalUnlock"]
    fn global_unlock(memory: *mut core::ffi::c_void) -> i32;
    #[link_name = "OpenClipboard"]
    fn open_clipboard(window: *mut core::ffi::c_void) -> i32;
    #[link_name = "PeekMessageW"]
    fn peek_message_w(
        message: *mut WinMsg,
        window: *mut core::ffi::c_void,
        message_filter_min: u32,
        message_filter_max: u32,
        remove_message: u32,
    ) -> i32;
    #[link_name = "PostThreadMessageW"]
    fn post_thread_message_w(thread_id: u32, message: u32, w_param: usize, l_param: isize) -> i32;
    #[link_name = "RegisterHotKey"]
    fn register_hot_key(
        window: *mut core::ffi::c_void,
        id: i32,
        modifiers: u32,
        virtual_key: u32,
    ) -> i32;
    #[link_name = "SetClipboardData"]
    fn set_clipboard_data(format: u32, memory: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    #[link_name = "UnregisterHotKey"]
    fn unregister_hot_key(window: *mut core::ffi::c_void, id: i32) -> i32;
}

#[tauri::command(rename = "global-dictation-hotkey-state")]
pub fn global_dictation_hotkey_state(
    app: AppHandle,
) -> Result<GlobalDictationHotkeyStateResponse, String> {
    Ok(GlobalDictationHotkeyStateResponse {
        supported: cfg!(target_os = "windows"),
        configured_hotkey: resolve_validated_dictation_hotkey(&app, HOLD_COMMAND_ID)?,
        configured_toggle_hotkey: resolve_validated_dictation_hotkey(&app, TOGGLE_COMMAND_ID)?,
    })
}

#[tauri::command(rename = "global-dictation-set-hotkey")]
pub fn global_dictation_set_hotkey(
    app: AppHandle,
    state: State<'_, GlobalDictationSettingsState>,
    params: GlobalDictationSetHotkeyParams,
) -> Result<GlobalDictationSetHotkeyResponse, String> {
    update_dictation_hotkey(&app, state.inner(), HOLD_COMMAND_ID, params.hotkey)
}

#[tauri::command(rename = "global-dictation-set-toggle-hotkey")]
pub fn global_dictation_set_toggle_hotkey(
    app: AppHandle,
    state: State<'_, GlobalDictationSettingsState>,
    params: GlobalDictationSetHotkeyParams,
) -> Result<GlobalDictationSetHotkeyResponse, String> {
    update_dictation_hotkey(&app, state.inner(), TOGGLE_COMMAND_ID, params.hotkey)
}

#[tauri::command(rename = "global-dictation-history")]
pub fn global_dictation_history(app: AppHandle) -> Result<GlobalDictationHistoryResponse, String> {
    Ok(GlobalDictationHistoryResponse {
        items: read_dictation_history(&app)?,
    })
}

#[tauri::command(rename = "global-dictation-copy-history-item")]
pub fn global_dictation_copy_history_item(
    app: AppHandle,
    params: GlobalDictationCopyHistoryItemParams,
) -> Result<(), String> {
    let history = read_dictation_history(&app)?;
    let item = history
        .into_iter()
        .find(|entry| entry.id == params.id)
        .ok_or_else(|| {
            let id = &params.id;
            format!("global dictation history item not found: {id}")
        })?;
    write_text_to_clipboard(&item.text)
}

pub(crate) fn start_global_dictation_hotkey_runtime(
    app: AppHandle,
    state: &GlobalDictationSettingsState,
) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, state);
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let guard = state
            .inner
            .lock()
            .expect("global dictation settings mutex poisoned");
        if guard.runtime_thread_id.is_some() {
            return Ok(());
        }
        drop(guard);

        let (ready_tx, ready_rx) = mpsc::channel();
        thread::spawn(move || global_dictation_hotkey_thread(app, ready_tx));
        let thread_id = ready_rx
            .recv_timeout(Duration::from_secs(5))
            .map_err(|err| format!("failed to start global dictation hotkey runtime: {err}"))?;

        let mut guard = state
            .inner
            .lock()
            .expect("global dictation settings mutex poisoned");
        guard.runtime_thread_id = Some(thread_id);
        drop(guard);

        refresh_global_dictation_hotkeys(state)?;
        Ok(())
    }
}

pub(crate) fn handle_global_dictation_completed(
    app: &AppHandle,
    state: &GlobalDictationSettingsState,
    params: &GlobalDictationCompletedParams,
) -> Result<(), String> {
    clear_active_session(state, &params.session_id);
    let transcript = record_dictation_history_item(
        app,
        &params.session_id,
        &params.text,
        Some(current_unix_time_ms()),
    )?;
    if let Some(transcript) = transcript {
        if let Err(err) = paste_global_dictation_text(&format!("{transcript} ")) {
            eprintln!("global dictation paste failed: {err}");
        }
    }
    Ok(())
}

pub(crate) fn handle_global_dictation_dismiss(
    state: &GlobalDictationSettingsState,
    session_id: &str,
) {
    clear_active_session(state, session_id);
}

pub(crate) fn handle_global_dictation_failed(
    state: &GlobalDictationSettingsState,
    params: &GlobalDictationFailedParams,
) {
    if params.stage != "transcription" {
        clear_active_session(state, &params.session_id);
    }
}

pub(crate) fn handle_global_dictation_record_history_item(
    app: &AppHandle,
    params: &crate::global_dictation_window::GlobalDictationRecordHistoryItemParams,
) -> Result<(), String> {
    let _ = record_dictation_history_item(
        app,
        &params.session_id,
        &params.text,
        params.completed_at_ms.or(Some(current_unix_time_ms())),
    )?;
    Ok(())
}

fn update_dictation_hotkey(
    app: &AppHandle,
    state: &GlobalDictationSettingsState,
    command_id: &str,
    hotkey: Option<String>,
) -> Result<GlobalDictationSetHotkeyResponse, String> {
    let validation_error = match hotkey.as_deref() {
        Some(shortcut) => global_dictation_hotkey_error(shortcut, cfg!(target_os = "macos"))
            .map(str::to_string)
            .or_else(|| ensure_hotkey_can_be_registered(app, command_id, shortcut).err()),
        None => None,
    };

    let error = match validation_error {
        Some(error) => Some(error),
        None => {
            let update = match hotkey {
                Some(accelerator) => CommandKeybindingUpdate::Set { accelerator },
                None => CommandKeybindingUpdate::Reset,
            };
            match set_command_keybinding(
                app.clone(),
                SetCommandKeybindingParams {
                    command_id: command_id.to_string(),
                    update,
                },
            ) {
                Ok(_) => refresh_global_dictation_hotkeys(state).err(),
                Err(err) => Some(err),
            }
        }
    };

    let state_response = global_dictation_hotkey_state(app.clone())?;
    Ok(GlobalDictationSetHotkeyResponse {
        success: error.is_none(),
        error,
        state: state_response,
    })
}

fn resolve_validated_dictation_hotkey(
    app: &AppHandle,
    command_id: &str,
) -> Result<Option<String>, String> {
    let lookup = read_command_keybinding_lookup(app, command_id)?;
    if !lookup.has_binding {
        return Ok(None);
    }

    Ok(lookup.hotkey.and_then(|shortcut| {
        (global_dictation_hotkey_error(&shortcut, cfg!(target_os = "macos")).is_none())
            .then_some(shortcut)
    }))
}

fn clear_active_session(state: &GlobalDictationSettingsState, session_id: &str) {
    let mut guard = state
        .inner
        .lock()
        .expect("global dictation settings mutex poisoned");
    if guard
        .active_session
        .as_ref()
        .is_some_and(|active| active.session_id == session_id)
    {
        guard.active_session = None;
    }
}

fn start_hotkey_session(
    app: &AppHandle,
    source: GlobalDictationSessionSource,
) -> Result<Option<String>, String> {
    let dictation_state: State<'_, GlobalDictationSettingsState> = app.state();
    {
        let mut guard = dictation_state
            .inner
            .lock()
            .expect("global dictation settings mutex poisoned");
        if guard.active_session.is_some() {
            return Ok(None);
        }
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        guard.next_session_counter += 1;
        let next_session_counter = guard.next_session_counter;
        let session_id = format!("global-dictation-{timestamp_ms}-{next_session_counter}");
        guard.active_session = Some(ActiveGlobalDictationSession {
            session_id: session_id.clone(),
            source,
        });
        drop(guard);

        let window_state: State<'_, GlobalDictationWindowState> = app.state();
        if global_dictation_show_and_start(
            app.clone(),
            window_state,
            GlobalDictationSessionParams {
                session_id: session_id.clone(),
            },
        )
        .is_err()
        {
            clear_active_session(dictation_state.inner(), &session_id);
            return Err("failed to show global dictation window".to_string());
        }

        return Ok(Some(session_id));
    }
}

fn stop_active_session(app: &AppHandle, session_id: &str) {
    let window_state: State<'_, GlobalDictationWindowState> = app.state();
    let _ = global_dictation_stop(
        app.clone(),
        window_state,
        GlobalDictationSessionParams {
            session_id: session_id.to_string(),
        },
    );
}

fn current_active_session(app: &AppHandle) -> Option<ActiveGlobalDictationSession> {
    let dictation_state: State<'_, GlobalDictationSettingsState> = app.state();
    let guard = dictation_state
        .inner
        .lock()
        .expect("global dictation settings mutex poisoned");
    guard.active_session.clone()
}

fn record_dictation_history_item(
    app: &AppHandle,
    session_id: &str,
    text: &str,
    created_at_ms: Option<u64>,
) -> Result<Option<String>, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let mut history = read_dictation_history(app)?;
    push_dictation_history_item(
        &mut history,
        GlobalDictationHistoryItem {
            id: session_id.to_string(),
            text: trimmed.to_string(),
            created_at_ms: created_at_ms.unwrap_or_else(current_unix_time_ms),
        },
    );
    write_dictation_history(app, &history)?;
    Ok(Some(trimmed.to_string()))
}

fn read_dictation_history(app: &AppHandle) -> Result<Vec<GlobalDictationHistoryItem>, String> {
    let settings = read_global_settings(app)?;
    let Some(value) = settings.get(GLOBAL_DICTATION_HISTORY_KEY) else {
        return Ok(Vec::new());
    };

    serde_json::from_value::<Vec<GlobalDictationHistoryItem>>(value.clone())
        .map(|mut items| {
            items.retain(|item| !item.text.trim().is_empty());
            items.sort_by(|left, right| right.created_at_ms.cmp(&left.created_at_ms));
            items
        })
        .map_err(|err| {
            format!("failed to parse {GLOBAL_DICTATION_HISTORY_KEY} from global settings: {err}")
        })
}

fn write_dictation_history(
    app: &AppHandle,
    history: &[GlobalDictationHistoryItem],
) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    settings.insert(
        GLOBAL_DICTATION_HISTORY_KEY.to_string(),
        serde_json::to_value(history)
            .map_err(|err| format!("failed to encode dictation history json: {err}"))?,
    );
    write_global_settings(app, &settings)
}

fn push_dictation_history_item(
    history: &mut Vec<GlobalDictationHistoryItem>,
    item: GlobalDictationHistoryItem,
) {
    history.retain(|existing| existing.id != item.id);
    history.insert(0, item);
    history.truncate(MAX_GLOBAL_DICTATION_HISTORY_ITEMS);
}

fn current_unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn paste_global_dictation_text(text: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        paste_global_dictation_text_windows(text)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err("Global dictation paste is not supported on this OS.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn paste_global_dictation_text_windows(text: &str) -> Result<(), String> {
    let script = format!(
        concat!(
            "Add-Type -AssemblyName System.Windows.Forms; ",
            "$text = [Environment]::GetEnvironmentVariable('CODEX_GLOBAL_DICTATION_TEXT'); ",
            "$snapshot = $null; ",
            "try {{ $snapshot = [System.Windows.Forms.Clipboard]::GetDataObject() }} catch {{}}; ",
            "[System.Windows.Forms.Clipboard]::SetText($text); ",
            "try {{ ",
            "Start-Sleep -Milliseconds {initial_delay}; ",
            "[System.Windows.Forms.SendKeys]::SendWait('^v'); ",
            "Start-Sleep -Milliseconds {final_delay}; ",
            "}} finally {{ ",
            "$current = $null; ",
            "try {{ if ([System.Windows.Forms.Clipboard]::ContainsText()) {{ $current = [System.Windows.Forms.Clipboard]::GetText() }} }} catch {{}}; ",
            "if ($current -eq $text) {{ ",
            "if ($null -ne $snapshot) {{ [System.Windows.Forms.Clipboard]::SetDataObject($snapshot, $true) }} ",
            "else {{ [System.Windows.Forms.Clipboard]::Clear() }} ",
            "}} ",
            "}}"
        ),
        initial_delay = GLOBAL_DICTATION_PASTE_INITIAL_DELAY_MS,
        final_delay = GLOBAL_DICTATION_PASTE_FINAL_DELAY_MS,
    );

    let status = Command::new("powershell.exe")
        .args([
            "-STA",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .env("CODEX_GLOBAL_DICTATION_TEXT", text)
        .status()
        .map_err(|err| format!("failed to start global dictation paste helper: {err}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "global dictation paste helper exited with {status}"
        ))
    }
}

fn split_hotkey_shortcut(shortcut: &str) -> Vec<&str> {
    shortcut
        .split('+')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .collect()
}

fn global_dictation_hotkey_error(shortcut: &str, is_macos: bool) -> Option<&'static str> {
    let segments = split_hotkey_shortcut(shortcut);
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
    let mut non_modifier_segment = None;
    for segment in segments {
        let lowered = segment.to_ascii_lowercase();
        if is_modifier_segment(&lowered) {
            if is_supported_modifier_segment(&lowered) {
                has_supported_modifier = true;
            }
            continue;
        }
        if non_modifier_segment.is_some() {
            return Some("Shortcut must include exactly one non-modifier key.");
        }
        non_modifier_segment = Some(segment);
    }

    if non_modifier_segment.is_none() {
        return Some("Shortcut must include a non-modifier key.");
    }
    if !has_supported_modifier {
        return Some("Shortcut must include Cmd/Ctrl or Alt.");
    }
    if global_dictation_hotkey_supported(shortcut) {
        None
    } else {
        Some("Shortcut key is not supported for global dictation.")
    }
}

fn global_dictation_hotkey_supported(shortcut: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        parse_windows_hotkey(shortcut).is_some()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = shortcut;
        false
    }
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

#[cfg(target_os = "windows")]
fn refresh_global_dictation_hotkeys(state: &GlobalDictationSettingsState) -> Result<(), String> {
    let guard = state
        .inner
        .lock()
        .expect("global dictation settings mutex poisoned");
    let thread_id = guard
        .runtime_thread_id
        .ok_or_else(|| "global dictation hotkey runtime is not running".to_string())?;
    let posted = unsafe { post_thread_message_w(thread_id, WM_APP_REFRESH_HOTKEYS, 0, 0) };
    if posted == 0 {
        return Err(format!(
            "failed to post global dictation hotkey refresh: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn refresh_global_dictation_hotkeys(_state: &GlobalDictationSettingsState) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn ensure_hotkey_can_be_registered(
    app: &AppHandle,
    command_id: &str,
    shortcut: &str,
) -> Result<(), String> {
    if resolve_validated_dictation_hotkey(app, command_id)?.as_deref() == Some(shortcut) {
        return Ok(());
    }

    let registration = parse_windows_hotkey(shortcut)
        .ok_or_else(|| format!("unsupported global dictation hotkey: {shortcut}"))?;
    let registered = unsafe {
        register_hot_key(
            std::ptr::null_mut(),
            HOTKEY_ID_VALIDATION,
            registration.modifiers,
            registration.virtual_key,
        )
    };
    if registered == 0 {
        return Err(format!(
            "failed to register global dictation hotkey {shortcut}: {}",
            std::io::Error::last_os_error()
        ));
    }

    unsafe {
        let _ = unregister_hot_key(std::ptr::null_mut(), HOTKEY_ID_VALIDATION);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn ensure_hotkey_can_be_registered(
    _app: &AppHandle,
    _command_id: &str,
    _shortcut: &str,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn global_dictation_hotkey_thread(app: AppHandle, ready_tx: mpsc::Sender<u32>) {
    let mut message = WinMsg::default();
    unsafe {
        let _ = peek_message_w(&mut message, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
    }
    let thread_id = unsafe { get_current_thread_id() };
    let _ = ready_tx.send(thread_id);

    let mut hold_registration = None;
    let mut toggle_registration = None;
    refresh_registered_hotkeys(&app, &mut hold_registration, &mut toggle_registration);

    loop {
        let result = unsafe { get_message_w(&mut message, std::ptr::null_mut(), 0, 0) };
        if result <= 0 {
            break;
        }

        match message.message {
            WM_HOTKEY => match message.w_param as i32 {
                HOTKEY_ID_HOLD => {
                    if let Some(registration) = hold_registration.clone() {
                        handle_hold_hotkey(&app, registration);
                    }
                }
                HOTKEY_ID_TOGGLE => handle_toggle_hotkey(&app),
                _ => {}
            },
            WM_APP_REFRESH_HOTKEYS => {
                refresh_registered_hotkeys(&app, &mut hold_registration, &mut toggle_registration);
            }
            WM_APP_EXIT_RUNTIME => break,
            _ => {}
        }
    }

    unregister_registered_hotkey(HOTKEY_ID_HOLD);
    unregister_registered_hotkey(HOTKEY_ID_TOGGLE);
}

#[cfg(target_os = "windows")]
fn refresh_registered_hotkeys(
    app: &AppHandle,
    hold_registration: &mut Option<RegisteredGlobalDictationHotkey>,
    toggle_registration: &mut Option<RegisteredGlobalDictationHotkey>,
) {
    unregister_registered_hotkey(HOTKEY_ID_HOLD);
    unregister_registered_hotkey(HOTKEY_ID_TOGGLE);

    *hold_registration = resolve_validated_dictation_hotkey(app, HOLD_COMMAND_ID)
        .ok()
        .flatten()
        .and_then(|shortcut| register_dictation_hotkey(HOTKEY_ID_HOLD, &shortcut).ok());
    *toggle_registration = resolve_validated_dictation_hotkey(app, TOGGLE_COMMAND_ID)
        .ok()
        .flatten()
        .and_then(|shortcut| register_dictation_hotkey(HOTKEY_ID_TOGGLE, &shortcut).ok());
}

#[cfg(target_os = "windows")]
fn register_dictation_hotkey(
    id: i32,
    shortcut: &str,
) -> Result<RegisteredGlobalDictationHotkey, String> {
    let registration = parse_windows_hotkey(shortcut)
        .ok_or_else(|| format!("unsupported global dictation hotkey: {shortcut}"))?;
    let registered = unsafe {
        register_hot_key(
            std::ptr::null_mut(),
            id,
            registration.modifiers,
            registration.virtual_key,
        )
    };
    if registered == 0 {
        return Err(format!(
            "failed to register global dictation hotkey {shortcut}: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(RegisteredGlobalDictationHotkey {
        release_watch_keys: registration.release_watch_keys,
    })
}

#[cfg(target_os = "windows")]
fn unregister_registered_hotkey(id: i32) {
    unsafe {
        let _ = unregister_hot_key(std::ptr::null_mut(), id);
    }
}

#[cfg(target_os = "windows")]
fn handle_hold_hotkey(app: &AppHandle, registration: RegisteredGlobalDictationHotkey) {
    let Ok(Some(session_id)) = start_hotkey_session(app, GlobalDictationSessionSource::Hold) else {
        return;
    };
    let watch_keys = registration.release_watch_keys;
    let app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(20));
        let Some(active_session) = current_active_session(&app) else {
            return;
        };
        if active_session.session_id != session_id
            || active_session.source != GlobalDictationSessionSource::Hold
        {
            return;
        }
        if watch_keys.iter().any(|group| !is_key_group_pressed(group)) {
            stop_active_session(&app, &session_id);
            return;
        }
    });
}

#[cfg(target_os = "windows")]
fn handle_toggle_hotkey(app: &AppHandle) {
    if let Some(active_session) = current_active_session(app) {
        stop_active_session(app, &active_session.session_id);
        return;
    }

    let _ = start_hotkey_session(app, GlobalDictationSessionSource::Toggle);
}

#[cfg(target_os = "windows")]
fn is_key_group_pressed(group: &[i32]) -> bool {
    group
        .iter()
        .any(|key_code| unsafe { get_async_key_state(*key_code) } < 0)
}

#[cfg(target_os = "windows")]
fn parse_windows_hotkey(shortcut: &str) -> Option<WindowsHotkeyRegistration> {
    let segments = split_hotkey_shortcut(shortcut);
    let mut modifiers = MOD_NOREPEAT;
    let mut release_watch_keys = Vec::new();
    let mut virtual_key = None;

    for segment in segments {
        let normalized = normalize_hotkey_segment(segment);
        match normalized.as_str() {
            "cmdorctrl" | "control" | "ctrl" => {
                modifiers |= MOD_CONTROL;
                release_watch_keys.push(vec![VK_CONTROL_KEYSTATE]);
            }
            "command" | "cmd" => {
                modifiers |= MOD_WIN;
                release_watch_keys.push(vec![VK_LWIN_KEYSTATE, VK_RWIN_KEYSTATE]);
            }
            "alt" | "option" => {
                modifiers |= MOD_ALT;
                release_watch_keys.push(vec![VK_MENU_KEYSTATE]);
            }
            "shift" => {
                modifiers |= MOD_SHIFT;
                release_watch_keys.push(vec![VK_SHIFT_KEYSTATE]);
            }
            _ => {
                if virtual_key.is_some() {
                    return None;
                }
                virtual_key = virtual_key_for_segment(segment);
            }
        }
    }

    let virtual_key = virtual_key?;
    release_watch_keys.push(vec![virtual_key as i32]);

    Some(WindowsHotkeyRegistration {
        modifiers,
        release_watch_keys,
        virtual_key,
    })
}

#[cfg(target_os = "windows")]
fn virtual_key_for_segment(segment: &str) -> Option<u32> {
    let trimmed = segment.trim();
    if trimmed.len() == 1 {
        let character = trimmed.chars().next()?;
        if character.is_ascii_alphabetic() {
            return Some(character.to_ascii_uppercase() as u32);
        }
        if character.is_ascii_digit() {
            return Some(character as u32);
        }
        return match character {
            '\'' => Some(VK_OEM_7),
            ',' => Some(VK_OEM_COMMA),
            '-' => Some(VK_OEM_MINUS),
            '.' => Some(VK_OEM_PERIOD),
            '/' => Some(VK_OEM_2),
            ';' => Some(VK_OEM_1),
            '=' => Some(VK_OEM_PLUS),
            '[' => Some(VK_OEM_4),
            '\\' => Some(VK_OEM_5),
            ']' => Some(VK_OEM_6),
            '`' => Some(VK_OEM_3),
            _ => None,
        };
    }

    let normalized = normalize_hotkey_segment(segment);
    match normalized.as_str() {
        "backspace" => Some(VK_BACK),
        "delete" | "del" => Some(VK_DELETE),
        "down" | "arrowdown" => Some(VK_DOWN),
        "end" => Some(VK_END),
        "enter" | "return" => Some(VK_RETURN),
        "esc" | "escape" => Some(VK_ESCAPE),
        "home" => Some(VK_HOME),
        "insert" => Some(VK_INSERT),
        "left" | "arrowleft" => Some(VK_LEFT),
        "minus" => Some(VK_OEM_MINUS),
        "pagedown" => Some(VK_NEXT),
        "pageup" => Some(VK_PRIOR),
        "plus" => Some(VK_OEM_PLUS),
        "right" | "arrowright" => Some(VK_RIGHT),
        "space" => Some(VK_SPACE),
        "tab" => Some(VK_TAB),
        "up" | "arrowup" => Some(VK_UP),
        _ => {
            let function_index = normalized
                .strip_prefix('f')
                .and_then(|value| value.parse::<u32>().ok())?;
            (1..=24)
                .contains(&function_index)
                .then_some(VK_F1 + function_index - 1)
        }
    }
}

fn write_text_to_clipboard(text: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        write_text_to_clipboard_windows(text)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err("global dictation history copy is only supported on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn write_text_to_clipboard_windows(text: &str) -> Result<(), String> {
    let mut utf16 = text.encode_utf16().collect::<Vec<_>>();
    utf16.push(0);
    let bytes = utf16.len() * std::mem::size_of::<u16>();

    let opened = unsafe { open_clipboard(std::ptr::null_mut()) };
    if opened == 0 {
        return Err(format!(
            "failed to open clipboard: {}",
            std::io::Error::last_os_error()
        ));
    }

    struct ClipboardGuard;
    impl Drop for ClipboardGuard {
        fn drop(&mut self) {
            unsafe {
                let _ = close_clipboard();
            }
        }
    }
    let _clipboard_guard = ClipboardGuard;

    if unsafe { empty_clipboard() } == 0 {
        return Err(format!(
            "failed to empty clipboard: {}",
            std::io::Error::last_os_error()
        ));
    }

    let memory = unsafe { global_alloc(GMEM_MOVEABLE, bytes) };
    if memory.is_null() {
        return Err("failed to allocate clipboard memory".to_string());
    }

    let locked = unsafe { global_lock(memory) } as *mut u16;
    if locked.is_null() {
        unsafe {
            let _ = global_free(memory);
        }
        return Err("failed to lock clipboard memory".to_string());
    }

    unsafe {
        std::ptr::copy_nonoverlapping(utf16.as_ptr(), locked, utf16.len());
        let _ = global_unlock(memory);
    }

    let clipboard_memory = unsafe { set_clipboard_data(CF_UNICODETEXT, memory) };
    if clipboard_memory.is_null() {
        unsafe {
            let _ = global_free(memory);
        }
        return Err(format!(
            "failed to set clipboard contents: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        global_dictation_hotkey_error, handle_global_dictation_failed, normalize_hotkey_segment,
        parse_windows_hotkey, push_dictation_history_item, split_hotkey_shortcut,
        virtual_key_for_segment, ActiveGlobalDictationSession, GlobalDictationHistoryItem,
        GlobalDictationHistoryResponse, GlobalDictationHotkeyStateResponse,
        GlobalDictationSessionSource, GlobalDictationSetHotkeyParams,
        GlobalDictationSetHotkeyResponse, GlobalDictationSettingsState,
        MAX_GLOBAL_DICTATION_HISTORY_ITEMS,
    };
    use crate::global_dictation_window::GlobalDictationFailedParams;

    #[test]
    fn splits_shortcuts_into_trimmed_segments() {
        assert_eq!(
            split_hotkey_shortcut(" Ctrl + Alt + K "),
            vec!["Ctrl", "Alt", "K"]
        );
    }

    #[test]
    fn normalizes_hotkey_segments() {
        assert_eq!(normalize_hotkey_segment("Left_Control"), "leftcontrol");
        assert_eq!(normalize_hotkey_segment("Page-Down"), "pagedown");
    }

    #[test]
    fn validates_windows_dictation_hotkeys_with_upstream_messages() {
        assert_eq!(global_dictation_hotkey_error("Ctrl+Alt+K", false), None);
        assert_eq!(
            global_dictation_hotkey_error("LeftShift", false),
            Some("Choose a shortcut with Ctrl or Alt plus another key.")
        );
        assert_eq!(
            global_dictation_hotkey_error("Shift", false),
            Some("Shortcut must include a non-modifier key.")
        );
        assert_eq!(
            global_dictation_hotkey_error("K", false),
            Some("Shortcut must include Cmd/Ctrl or Alt.")
        );
    }

    #[test]
    fn serializes_dictation_hotkey_state_with_camel_case_fields() {
        let value = serde_json::to_value(GlobalDictationHotkeyStateResponse {
            supported: true,
            configured_hotkey: Some("Ctrl+Alt+K".to_string()),
            configured_toggle_hotkey: Some("Ctrl+Alt+J".to_string()),
        })
        .expect("global dictation hotkey state should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "supported": true,
                "configuredHotkey": "Ctrl+Alt+K",
                "configuredToggleHotkey": "Ctrl+Alt+J"
            })
        );
    }

    #[test]
    fn serializes_set_hotkey_response_with_camel_case_fields() {
        let value = serde_json::to_value(GlobalDictationSetHotkeyResponse {
            success: true,
            error: None,
            state: GlobalDictationHotkeyStateResponse {
                supported: true,
                configured_hotkey: Some("Ctrl+Alt+K".to_string()),
                configured_toggle_hotkey: None,
            },
        })
        .expect("set hotkey response should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "success": true,
                "error": null,
                "state": {
                    "supported": true,
                    "configuredHotkey": "Ctrl+Alt+K",
                    "configuredToggleHotkey": null
                }
            })
        );
    }

    #[test]
    fn serializes_history_response_with_camel_case_fields() {
        let value = serde_json::to_value(GlobalDictationHistoryResponse {
            items: vec![GlobalDictationHistoryItem {
                id: "session-1".to_string(),
                text: "hello".to_string(),
                created_at_ms: 42,
            }],
        })
        .expect("history response should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "items": [{
                    "id": "session-1",
                    "text": "hello",
                    "createdAtMs": 42
                }]
            })
        );
    }

    #[test]
    fn deserializes_set_hotkey_params() {
        let params: GlobalDictationSetHotkeyParams = serde_json::from_value(serde_json::json!({
            "hotkey": "Ctrl+Alt+K"
        }))
        .expect("set hotkey params should deserialize");

        assert_eq!(
            params,
            GlobalDictationSetHotkeyParams {
                hotkey: Some("Ctrl+Alt+K".to_string()),
            }
        );
    }

    #[test]
    fn transcription_failures_keep_active_session() {
        let state = GlobalDictationSettingsState::default();
        {
            let mut guard = state
                .inner
                .lock()
                .expect("global dictation settings mutex poisoned");
            guard.active_session = Some(ActiveGlobalDictationSession {
                session_id: "session-1".to_string(),
                source: GlobalDictationSessionSource::Toggle,
            });
        }

        handle_global_dictation_failed(
            &state,
            &GlobalDictationFailedParams {
                session_id: "session-1".to_string(),
                stage: "transcription".to_string(),
            },
        );

        let guard = state
            .inner
            .lock()
            .expect("global dictation settings mutex poisoned");
        assert_eq!(
            guard.active_session,
            Some(ActiveGlobalDictationSession {
                session_id: "session-1".to_string(),
                source: GlobalDictationSessionSource::Toggle,
            })
        );
    }

    #[test]
    fn recording_failures_clear_active_session() {
        let state = GlobalDictationSettingsState::default();
        {
            let mut guard = state
                .inner
                .lock()
                .expect("global dictation settings mutex poisoned");
            guard.active_session = Some(ActiveGlobalDictationSession {
                session_id: "session-1".to_string(),
                source: GlobalDictationSessionSource::Hold,
            });
        }

        handle_global_dictation_failed(
            &state,
            &GlobalDictationFailedParams {
                session_id: "session-1".to_string(),
                stage: "recording".to_string(),
            },
        );

        let guard = state
            .inner
            .lock()
            .expect("global dictation settings mutex poisoned");
        assert_eq!(guard.active_session, None);
    }

    #[test]
    fn history_push_retains_latest_ten_items() {
        let mut history = Vec::new();
        for index in 0..12 {
            push_dictation_history_item(
                &mut history,
                GlobalDictationHistoryItem {
                    id: format!("session-{index}"),
                    text: format!("text-{index}"),
                    created_at_ms: index,
                },
            );
        }

        assert_eq!(history.len(), MAX_GLOBAL_DICTATION_HISTORY_ITEMS);
        assert_eq!(
            history.first().map(|item| item.id.as_str()),
            Some("session-11")
        );
        assert_eq!(
            history.last().map(|item| item.id.as_str()),
            Some("session-2")
        );
    }

    #[test]
    fn history_push_replaces_existing_item_and_moves_it_to_front() {
        let mut history = vec![
            GlobalDictationHistoryItem {
                id: "session-1".to_string(),
                text: "old".to_string(),
                created_at_ms: 1,
            },
            GlobalDictationHistoryItem {
                id: "session-2".to_string(),
                text: "other".to_string(),
                created_at_ms: 2,
            },
        ];

        push_dictation_history_item(
            &mut history,
            GlobalDictationHistoryItem {
                id: "session-1".to_string(),
                text: "new".to_string(),
                created_at_ms: 3,
            },
        );

        assert_eq!(history.len(), 2);
        assert_eq!(history[0].id, "session-1");
        assert_eq!(history[0].text, "new");
        assert_eq!(history[0].created_at_ms, 3);
        assert_eq!(history[1].id, "session-2");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parses_supported_windows_hotkeys() {
        let registration = parse_windows_hotkey("Ctrl+Shift+K").expect("shortcut should parse");
        assert_eq!(registration.virtual_key, 'K' as u32);
        assert_eq!(registration.release_watch_keys.len(), 3);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn maps_common_virtual_keys() {
        assert_eq!(virtual_key_for_segment("Space"), Some(0x20));
        assert_eq!(virtual_key_for_segment("Plus"), Some(0xBB));
        assert_eq!(virtual_key_for_segment("F12"), Some(0x7B));
        assert_eq!(virtual_key_for_segment("["), Some(0xDB));
    }
}
