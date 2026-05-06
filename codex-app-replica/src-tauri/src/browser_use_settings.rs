use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::Url;

const BROWSER_USE_DIR: &str = "browser";
const BROWSER_USE_CONFIG_FILE: &str = "config.toml";
const APPROVAL_MODE_KEY: &str = "approval_mode";
const HISTORY_APPROVAL_MODE_KEY: &str = "history_approval_mode";
const ORIGINS_KEY: &str = "origins";
const ALLOWED_ORIGINS_KEY: &str = "allowed";
const DENIED_ORIGINS_KEY: &str = "denied";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserUseApprovalMode {
    AlwaysAsk,
    NeverAsk,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseSettingsState {
    pub approval_mode: BrowserUseApprovalMode,
    pub history_approval_mode: BrowserUseApprovalMode,
    pub allowed_origins: Vec<String>,
    pub denied_origins: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseApprovalModeWriteParams {
    pub approval_mode: BrowserUseApprovalMode,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BrowserUseOriginKind {
    Allowed,
    Denied,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseOriginMutationParams {
    pub kind: BrowserUseOriginKind,
    pub origin: String,
}

impl Default for BrowserUseSettingsState {
    fn default() -> Self {
        Self {
            approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            history_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            allowed_origins: Vec::new(),
            denied_origins: Vec::new(),
        }
    }
}

#[tauri::command]
pub fn read_browser_use_settings() -> Result<BrowserUseSettingsState, String> {
    Ok(browser_use_settings_state_from_table(
        &read_browser_use_settings_table()?,
    ))
}

#[tauri::command]
pub fn write_browser_use_approval_mode(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    mutate_browser_use_settings_table(|table| {
        table.insert(
            APPROVAL_MODE_KEY.to_string(),
            toml::Value::String(approval_mode_to_config_value(params.approval_mode).to_string()),
        );
        Ok(true)
    })
}

#[tauri::command]
pub fn write_browser_use_history_approval_mode(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    mutate_browser_use_settings_table(|table| {
        table.insert(
            HISTORY_APPROVAL_MODE_KEY.to_string(),
            toml::Value::String(approval_mode_to_config_value(params.approval_mode).to_string()),
        );
        Ok(true)
    })
}

#[tauri::command]
pub fn add_browser_use_origin(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    let normalized_origin = normalize_browser_use_origin(&params.origin)
        .ok_or_else(|| "Invalid Browser Use origin".to_string())?;

    mutate_browser_use_settings_table(|table| {
        let origins_table = ensure_origins_table(table);
        let mut next_origins = normalized_origin_list(origins_table.get(params.kind.config_key()));
        let mut did_change = false;

        if !next_origins
            .iter()
            .any(|origin| origin == &normalized_origin)
        {
            next_origins.push(normalized_origin.clone());
            did_change = true;
        }

        let opposite_origins =
            normalized_origin_list(origins_table.get(params.kind.opposite_config_key()))
                .into_iter()
                .filter(|origin| origin != &normalized_origin)
                .collect::<Vec<_>>();
        let opposite_key = params.kind.opposite_config_key();
        if opposite_origins != normalized_origin_list(origins_table.get(opposite_key)) {
            did_change = true;
        }

        set_origin_list(origins_table, params.kind.config_key(), next_origins);
        set_origin_list(origins_table, opposite_key, opposite_origins);

        Ok(did_change)
    })
}

#[tauri::command]
pub fn remove_browser_use_origin(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    let target_origin = params.origin.trim().to_string();
    if target_origin.is_empty() {
        return read_browser_use_settings();
    }

    mutate_browser_use_settings_table(|table| {
        let Some(origins_table) = table
            .get_mut(ORIGINS_KEY)
            .and_then(toml::Value::as_table_mut)
        else {
            return Ok(false);
        };
        let current_origins = normalized_origin_list(origins_table.get(params.kind.config_key()));
        let next_origins = current_origins
            .iter()
            .filter(|origin| *origin != &target_origin)
            .cloned()
            .collect::<Vec<_>>();

        if next_origins.len() == current_origins.len() {
            return Ok(false);
        }

        set_origin_list(origins_table, params.kind.config_key(), next_origins);
        Ok(true)
    })
}

fn mutate_browser_use_settings_table(
    mutator: impl FnOnce(&mut toml::Table) -> Result<bool, String>,
) -> Result<BrowserUseSettingsState, String> {
    let mut table = read_browser_use_settings_table()?;
    let did_change = mutator(&mut table)?;
    if did_change {
        write_browser_use_settings_table(&table)?;
    }
    Ok(browser_use_settings_state_from_table(&table))
}

fn read_browser_use_settings_table() -> Result<toml::Table, String> {
    let config_path = browser_use_config_path()?;
    if !config_path.exists() {
        return Ok(toml::Table::new());
    }

    let Ok(contents) = fs::read_to_string(&config_path) else {
        return Ok(toml::Table::new());
    };

    contents
        .parse::<toml::Table>()
        .or_else(|_| Ok(toml::Table::new()))
}

fn write_browser_use_settings_table(table: &toml::Table) -> Result<(), String> {
    let config_path = browser_use_config_path()?;
    let parent = config_path
        .parent()
        .ok_or_else(|| "browser use config path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create browser use config directory: {err}"))?;

    let contents = toml::to_string(table)
        .map_err(|err| format!("failed to serialize browser use config: {err}"))?;
    let normalized_contents = if contents.ends_with('\n') {
        contents
    } else {
        format!("{contents}\n")
    };

    fs::write(&config_path, normalized_contents)
        .map_err(|err| format!("failed to write browser use config: {err}"))
}

fn browser_use_settings_state_from_table(table: &toml::Table) -> BrowserUseSettingsState {
    let origins_table = table.get(ORIGINS_KEY).and_then(toml::Value::as_table);

    BrowserUseSettingsState {
        approval_mode: approval_mode_from_config_value(
            table.get(APPROVAL_MODE_KEY).and_then(toml::Value::as_str),
        ),
        history_approval_mode: approval_mode_from_config_value(
            table
                .get(HISTORY_APPROVAL_MODE_KEY)
                .and_then(toml::Value::as_str),
        ),
        allowed_origins: origins_table.map_or_else(Vec::new, |origins| {
            normalized_origin_list(origins.get(ALLOWED_ORIGINS_KEY))
        }),
        denied_origins: origins_table.map_or_else(Vec::new, |origins| {
            normalized_origin_list(origins.get(DENIED_ORIGINS_KEY))
        }),
    }
}

fn ensure_origins_table(table: &mut toml::Table) -> &mut toml::Table {
    let origins_entry = table
        .entry(ORIGINS_KEY.to_string())
        .or_insert_with(|| toml::Value::Table(toml::Table::new()));
    if !origins_entry.is_table() {
        *origins_entry = toml::Value::Table(toml::Table::new());
    }
    origins_entry
        .as_table_mut()
        .expect("browser use origins entry should be a TOML table")
}

fn set_origin_list(origins_table: &mut toml::Table, key: &str, origins: Vec<String>) {
    origins_table.insert(
        key.to_string(),
        toml::Value::Array(
            origins
                .into_iter()
                .map(toml::Value::String)
                .collect::<Vec<_>>(),
        ),
    );
}

fn normalized_origin_list(value: Option<&toml::Value>) -> Vec<String> {
    let Some(items) = value.and_then(toml::Value::as_array) else {
        return Vec::new();
    };

    let mut normalized = Vec::new();
    for item in items {
        let Some(origin) = item.as_str() else {
            continue;
        };
        let trimmed_origin = origin.trim();
        if trimmed_origin.is_empty()
            || normalized
                .iter()
                .any(|existing_origin| existing_origin == trimmed_origin)
        {
            continue;
        }
        normalized.push(trimmed_origin.to_string());
    }

    normalized
}

fn approval_mode_from_config_value(value: Option<&str>) -> BrowserUseApprovalMode {
    match value {
        Some("never_ask") => BrowserUseApprovalMode::NeverAsk,
        _ => BrowserUseApprovalMode::AlwaysAsk,
    }
}

fn approval_mode_to_config_value(mode: BrowserUseApprovalMode) -> &'static str {
    match mode {
        BrowserUseApprovalMode::AlwaysAsk => "always_ask",
        BrowserUseApprovalMode::NeverAsk => "never_ask",
    }
}

fn normalize_browser_use_origin(value: &str) -> Option<String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return None;
    }

    let candidate = if has_url_scheme(trimmed_value) {
        trimmed_value.to_string()
    } else {
        format!("https://{trimmed_value}")
    };
    let parsed_url = Url::parse(&candidate).ok()?;
    match parsed_url.scheme() {
        "http" | "https" => Some(parsed_url.origin().ascii_serialization()),
        _ => None,
    }
}

fn has_url_scheme(value: &str) -> bool {
    value
        .find("://")
        .is_some_and(|separator_index| separator_index > 0)
}

fn browser_use_config_path() -> Result<PathBuf, String> {
    Ok(resolve_codex_home()?
        .join(BROWSER_USE_DIR)
        .join(BROWSER_USE_CONFIG_FILE))
}

fn resolve_codex_home() -> Result<PathBuf, String> {
    if let Some(path) = non_empty_env_path("CODEX_HOME") {
        return Ok(path);
    }

    let home_dir =
        resolve_home_directory().ok_or_else(|| "failed to resolve CODEX_HOME".to_string())?;
    Ok(home_dir.join(".codex"))
}

fn resolve_home_directory() -> Option<PathBuf> {
    non_empty_env_path("USERPROFILE")
        .or_else(home_directory_from_drive_and_path)
        .or_else(|| non_empty_env_path("HOME"))
}

fn home_directory_from_drive_and_path() -> Option<PathBuf> {
    let drive = env::var_os("HOMEDRIVE")?;
    let path = env::var_os("HOMEPATH")?;
    let mut home_dir = PathBuf::from(drive);
    home_dir.push(PathBuf::from(path));
    if home_dir.as_os_str().is_empty() {
        return None;
    }
    Some(home_dir)
}

fn non_empty_env_path(name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(env::var_os(name)?);
    if path.as_os_str().is_empty() {
        return None;
    }
    Some(path)
}

impl BrowserUseOriginKind {
    fn config_key(self) -> &'static str {
        match self {
            BrowserUseOriginKind::Allowed => ALLOWED_ORIGINS_KEY,
            BrowserUseOriginKind::Denied => DENIED_ORIGINS_KEY,
        }
    }

    fn opposite_config_key(self) -> &'static str {
        match self {
            BrowserUseOriginKind::Allowed => DENIED_ORIGINS_KEY,
            BrowserUseOriginKind::Denied => ALLOWED_ORIGINS_KEY,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::approval_mode_from_config_value;
    use super::normalize_browser_use_origin;
    use super::normalized_origin_list;
    use super::BrowserUseApprovalMode;

    #[test]
    fn approval_mode_defaults_to_always_ask() {
        assert_eq!(
            approval_mode_from_config_value(Some("unexpected")),
            BrowserUseApprovalMode::AlwaysAsk
        );
        assert_eq!(
            approval_mode_from_config_value(None),
            BrowserUseApprovalMode::AlwaysAsk
        );
    }

    #[test]
    fn normalize_browser_use_origin_adds_https_and_strips_paths() {
        assert_eq!(
            normalize_browser_use_origin("example.com/path?q=1"),
            Some("https://example.com".to_string())
        );
        assert_eq!(
            normalize_browser_use_origin("http://example.com/example"),
            Some("http://example.com".to_string())
        );
    }

    #[test]
    fn normalize_browser_use_origin_rejects_unsupported_schemes() {
        assert_eq!(normalize_browser_use_origin("ftp://example.com"), None);
        assert_eq!(normalize_browser_use_origin(""), None);
    }

    #[test]
    fn normalized_origin_list_trims_and_deduplicates() {
        let array = toml::Value::Array(vec![
            toml::Value::String(" https://example.com ".to_string()),
            toml::Value::String("https://example.com".to_string()),
            toml::Value::String("https://openai.com".to_string()),
            toml::Value::Boolean(true),
        ]);

        assert_eq!(
            normalized_origin_list(Some(&array)),
            vec![
                "https://example.com".to_string(),
                "https://openai.com".to_string()
            ]
        );
    }
}
