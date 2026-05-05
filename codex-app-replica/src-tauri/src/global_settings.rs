use serde::Serialize;
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const GLOBAL_SETTINGS_FILE_NAME: &str = "global-settings.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStateResponse {
    pub value: Value,
}

#[tauri::command]
pub fn get_global_state(app: AppHandle, key: String) -> Result<GlobalStateResponse, String> {
    ensure_supported_key(&key)?;
    let settings = read_global_settings(&app)?;
    Ok(GlobalStateResponse {
        value: settings.get(&key).cloned().unwrap_or(Value::Null),
    })
}

#[tauri::command]
pub fn set_global_state(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    ensure_supported_key(&key)?;
    let mut settings = read_global_settings(&app)?;
    settings.insert(key, value);
    write_global_settings(&app, &settings)
}

fn ensure_supported_key(key: &str) -> Result<(), String> {
    match key {
        "usePointerCursors" | "sansFontSize" | "codeFontSize" | "localeOverride"
        | "followUpQueueMode" | "reviewDelivery" => Ok(()),
        _ => Err(format!("unsupported global setting key: {key}")),
    }
}

fn read_global_settings(app: &AppHandle) -> Result<Map<String, Value>, String> {
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

fn write_global_settings(app: &AppHandle, settings: &Map<String, Value>) -> Result<(), String> {
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
