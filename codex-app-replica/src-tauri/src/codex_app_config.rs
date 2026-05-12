use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CODEX_APP_CONFIG_DIR_NAME: &str = "codex-app";
const CODEX_APP_CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CodexAppConfig {
    pub remote_connections: Vec<CodexAppRemoteConnection>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CodexAppRemoteConnection {
    pub ssh_alias: Option<String>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub identity: Option<String>,
    pub projects: Vec<CodexAppRemoteProject>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CodexAppRemoteProject {
    pub remote_path: String,
    pub label: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

pub fn read_codex_app_config(app: &AppHandle) -> Result<CodexAppConfig, String> {
    let path = codex_app_config_path(app)?;
    if !path.exists() {
        return Ok(CodexAppConfig::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read {path:?}: {err}"))?;
    let value = serde_json::from_str::<Value>(&contents)
        .map_err(|err| format!("failed to parse {path:?}: {err}"))?;
    serde_json::from_value(value).map_err(|err| format!("failed to decode {path:?}: {err}"))
}

pub fn write_codex_app_config(app: &AppHandle, config: &CodexAppConfig) -> Result<(), String> {
    let path = codex_app_config_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("missing parent directory for {path:?}"))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create config directory {parent:?}: {err}"))?;
    let payload = serde_json::to_string_pretty(config)
        .map_err(|err| format!("failed to encode codex app config json: {err}"))?;
    fs::write(&path, payload).map_err(|err| format!("failed to write {path:?}: {err}"))
}

fn codex_app_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("failed to resolve app config dir: {err}"))?;
    path.push(CODEX_APP_CONFIG_DIR_NAME);
    path.push(CODEX_APP_CONFIG_FILE_NAME);
    Ok(path)
}
