use serde::Serialize;
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

use crate::query_cache::emit_query_cache_invalidate;

const GLOBAL_SETTINGS_FILE_NAME: &str = "global-settings.json";
const GLOBAL_STATE_UPDATED_EVENT: &str = "global-state-updated";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStateResponse {
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WslBashAvailabilityResponse {
    pub available: bool,
    pub distro: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GlobalStateUpdatedNotification {
    keys: Vec<String>,
}

#[tauri::command]
pub fn get_global_state(app: AppHandle, key: String) -> Result<GlobalStateResponse, String> {
    ensure_supported_key(&key)?;
    let settings = read_global_settings(&app)?;
    Ok(GlobalStateResponse {
        value: settings.get(&key).cloned().unwrap_or(Value::Null),
    })
}

#[tauri::command(rename = "get-global-state")]
pub fn get_global_state_command(
    app: AppHandle,
    key: String,
) -> Result<GlobalStateResponse, String> {
    get_global_state(app, key)
}

#[tauri::command]
pub fn set_global_state(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    ensure_supported_key(&key)?;
    let mut settings = read_global_settings(&app)?;
    settings.insert(key.clone(), value);
    write_global_settings(&app, &settings)?;
    let query_key = key.clone();
    let _ = app.emit(
        GLOBAL_STATE_UPDATED_EVENT,
        GlobalStateUpdatedNotification {
            keys: vec![key.clone()],
        },
    );
    emit_query_cache_invalidate(
        &app,
        vec![
            Value::String("get-global-state".to_string()),
            serde_json::json!({ "key": query_key }),
        ],
    );
    Ok(())
}

#[tauri::command(rename = "set-global-state")]
pub fn set_global_state_command(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    set_global_state(app, key, value)
}

#[tauri::command(rename = "wsl-bash-availability")]
pub fn wsl_bash_availability() -> Result<WslBashAvailabilityResponse, String> {
    Ok(read_wsl_bash_availability())
}

fn ensure_supported_key(key: &str) -> Result<(), String> {
    match key {
        "usePointerCursors"
        | "sansFontSize"
        | "codeFontSize"
        | "localeOverride"
        | "viewed2025-09-15-nux"
        | "viewed2025-09-15-full-chatgpt-auth-nux"
        | "viewed2025-09-15-apikey-auth-nux"
        | "appearanceTheme"
        | "appearanceLightChromeTheme"
        | "appearanceDarkChromeTheme"
        | "appearanceLightCodeThemeId"
        | "appearanceDarkCodeThemeId"
        | "useFontSmoothing"
        | "mac-menu-bar-enabled"
        | "selected-avatar-id"
        | "electron-avatar-overlay-open"
        | "electron-avatar-overlay-bounds"
        | "ambient-suggestions-enabled"
        | "active-remote-project-id"
        | "composerEnterBehavior"
        | "followUpQueueMode"
        | "reviewDelivery"
        | "dictationDictionary"
        | "conversationDetailMode"
        | "integratedTerminalShell"
        | "preventSleepWhileRunning"
        | "runCodexInWindowsSubsystemForLinux"
        | "notifications-turn-mode"
        | "notifications-permissions-enabled"
        | "notifications-questions-enabled"
        | "chronicle-consent-accepted"
        | "chronicle-setup-completion-pending"
        | "use-copilot-auth-if-available"
        | "browser-sidebar-comment-mode-coachmark-dismissed"
        | "electron:onboarding-override"
        | "electron:onboarding-welcome-pending"
        | "electron:onboarding-projectless-completed"
        | "electron:onboarding-hide-first-new-thread-promos"
        | "electron:onboarding-plugin-checklist-active"
        | "electron:onboarding-primary-runtime-install-requested"
        | "electron:onboarding-primary-runtime-install-ready"
        | "electron:onboarding-workspace-experiment-assignment"
        | "electron:onboarding-workspace-autolaunch-applied"
        | "electron:onboarding-welcome-v2-state"
        | "electron:onboarding-welcome-v2-role-state"
        | "electron:onboarding-welcome-v2-role-selection-debug-override"
        | "has-seen-ambient-suggestions-connected-apps-consent"
        | "realtime-voice-mode-debug-disabled"
        | "global-dictation-force-lock-debug-enabled"
        | "has-seen-remote-connections-home-announcement"
        | "has-seen-codex-mobile-home-announcement"
        | "has-completed-codex-mobile-setup"
        | "last_completed_onboarding"
        | "git-branch-prefix"
        | "git-always-force-push"
        | "git-create-pull-request-as-draft"
        | "git-pull-request-merge-method"
        | "git-show-sidebar-pr-icons"
        | "git-commit-instructions"
        | "git-pr-instructions"
        | "pinned-thread-ids"
        | "worktree-auto-cleanup-enabled"
        | "worktree-auto-cleanup-unpackaged-override-enabled"
        | "worktree-keep-count" => Ok(()),
        _ => Err(format!("unsupported global setting key: {key}")),
    }
}

pub(crate) fn read_global_settings(app: &AppHandle) -> Result<Map<String, Value>, String> {
    let path = global_settings_path(app)?;
    if !path.exists() {
        return Ok(Map::new());
    }
    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read {path:?}: {err}"))?;
    let value = serde_json::from_str::<Value>(&contents)
        .map_err(|err| format!("failed to parse {path:?}: {err}"))?;
    match value {
        Value::Object(map) => Ok(map),
        _ => Err(format!(
            "global settings file {path:?} must contain a JSON object"
        )),
    }
}

pub(crate) fn write_global_settings(
    app: &AppHandle,
    settings: &Map<String, Value>,
) -> Result<(), String> {
    let path = global_settings_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("missing parent directory for {path:?}"))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create settings directory {parent:?}: {err}"))?;
    let payload = serde_json::to_string_pretty(settings)
        .map_err(|err| format!("failed to encode global settings json: {err}"))?;
    fs::write(&path, payload).map_err(|err| format!("failed to write {path:?}: {err}"))
}

fn global_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("failed to resolve app config dir: {err}"))?;
    path.push(GLOBAL_SETTINGS_FILE_NAME);
    Ok(path)
}

#[cfg(target_os = "windows")]
fn read_wsl_bash_availability() -> WslBashAvailabilityResponse {
    WslBashAvailabilityResponse {
        available: default_wsl_bash_is_available(),
        distro: default_wsl_distro_name(),
    }
}

#[cfg(not(target_os = "windows"))]
fn read_wsl_bash_availability() -> WslBashAvailabilityResponse {
    WslBashAvailabilityResponse {
        available: false,
        distro: None,
    }
}

#[cfg(target_os = "windows")]
fn default_wsl_bash_is_available() -> bool {
    match Command::new("wsl.exe")
        .args(["--", "/usr/bin/bash", "-lc", "exit 0"])
        .output()
    {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn default_wsl_distro_name() -> Option<String> {
    let output = Command::new("wsl.exe").args(["-l", "-v"]).output().ok()?;
    parse_default_wsl_distro(&decode_wsl_command_output(&output.stdout))
}

#[cfg(target_os = "windows")]
fn decode_wsl_command_output(stdout: &[u8]) -> String {
    if stdout.len() >= 2
        && stdout.len() % 2 == 0
        && stdout.chunks_exact(2).any(|chunk| chunk[1] == 0)
    {
        let utf16 = stdout
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&utf16)
            .trim_start_matches('\u{feff}')
            .to_string();
    }

    String::from_utf8_lossy(stdout).into_owned()
}

#[cfg(target_os = "windows")]
fn parse_default_wsl_distro(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let remainder = line.trim_start().strip_prefix('*')?.trim_start();
        let distro = first_wsl_table_column(remainder).trim();
        if distro.is_empty() {
            None
        } else {
            Some(distro.to_string())
        }
    })
}

#[cfg(target_os = "windows")]
fn first_wsl_table_column(line: &str) -> &str {
    let mut whitespace_run_start = None;
    let mut whitespace_run_len = 0;

    for (index, character) in line.char_indices() {
        if character.is_whitespace() {
            whitespace_run_start.get_or_insert(index);
            whitespace_run_len += 1;
            if whitespace_run_len >= 2 {
                return line[..whitespace_run_start.unwrap()].trim_end();
            }
        } else {
            whitespace_run_start = None;
            whitespace_run_len = 0;
        }
    }

    line.trim_end()
}

#[cfg(test)]
mod tests {
    use super::ensure_supported_key;
    #[cfg(not(target_os = "windows"))]
    use super::read_wsl_bash_availability;
    #[cfg(not(target_os = "windows"))]
    use super::WslBashAvailabilityResponse;
    #[cfg(target_os = "windows")]
    use super::{decode_wsl_command_output, parse_default_wsl_distro};

    #[test]
    fn general_settings_keys_are_supported() {
        for key in [
            "useFontSmoothing",
            "mac-menu-bar-enabled",
            "dictationDictionary",
            "conversationDetailMode",
            "ambient-suggestions-enabled",
            "active-remote-project-id",
            "integratedTerminalShell",
            "preventSleepWhileRunning",
            "runCodexInWindowsSubsystemForLinux",
            "notifications-turn-mode",
            "notifications-permissions-enabled",
            "notifications-questions-enabled",
            "chronicle-consent-accepted",
            "chronicle-setup-completion-pending",
            "use-copilot-auth-if-available",
            "browser-sidebar-comment-mode-coachmark-dismissed",
            "electron:onboarding-override",
            "electron:onboarding-welcome-pending",
            "electron:onboarding-projectless-completed",
            "electron:onboarding-hide-first-new-thread-promos",
            "electron:onboarding-plugin-checklist-active",
            "electron:onboarding-primary-runtime-install-requested",
            "electron:onboarding-primary-runtime-install-ready",
            "electron:onboarding-workspace-experiment-assignment",
            "electron:onboarding-workspace-autolaunch-applied",
            "electron:onboarding-welcome-v2-state",
            "electron:onboarding-welcome-v2-role-state",
            "electron:onboarding-welcome-v2-role-selection-debug-override",
            "has-seen-ambient-suggestions-connected-apps-consent",
            "realtime-voice-mode-debug-disabled",
            "global-dictation-force-lock-debug-enabled",
            "has-seen-remote-connections-home-announcement",
            "has-seen-codex-mobile-home-announcement",
            "has-completed-codex-mobile-setup",
            "last_completed_onboarding",
            "viewed2025-09-15-nux",
            "viewed2025-09-15-full-chatgpt-auth-nux",
            "viewed2025-09-15-apikey-auth-nux",
        ] {
            assert!(
                ensure_supported_key(key).is_ok(),
                "{key} should be supported"
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn wsl_bash_availability_is_unavailable_off_windows() {
        assert_eq!(
            read_wsl_bash_availability(),
            WslBashAvailabilityResponse {
                available: false,
                distro: None,
            }
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn decode_wsl_command_output_supports_utf16le() {
        let encoded = "  NAME\r\n* Ubuntu 22.04  Running  2\r\n"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();

        assert_eq!(
            decode_wsl_command_output(&encoded),
            "  NAME\r\n* Ubuntu 22.04  Running  2\r\n".to_string()
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parse_default_wsl_distro_reads_starred_row() {
        let output = "  NAME                   STATE           VERSION\r\n* Ubuntu 22.04          Running         2\r\n  docker-desktop        Running         2\r\n";

        assert_eq!(
            parse_default_wsl_distro(output),
            Some("Ubuntu 22.04".to_string())
        );
    }
}
