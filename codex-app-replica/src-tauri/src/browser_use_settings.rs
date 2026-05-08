use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Url;

use crate::codex_home::resolve_codex_home;

const BROWSER_USE_DIR: &str = "browser";
const BROWSER_USE_CONFIG_FILE: &str = "config.toml";
const APPROVAL_MODE_KEY: &str = "approval_mode";
const HISTORY_APPROVAL_MODE_KEY: &str = "history_approval_mode";
const DOWNLOAD_APPROVAL_MODE_KEY: &str = "download_approval_mode";
const UPLOAD_APPROVAL_MODE_KEY: &str = "upload_approval_mode";
const ORIGINS_KEY: &str = "origins";
const DOWNLOADS_KEY: &str = "downloads";
const UPLOADS_KEY: &str = "uploads";
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
    pub download_approval_mode: BrowserUseApprovalMode,
    pub upload_approval_mode: BrowserUseApprovalMode,
    pub allowed_origins: Vec<String>,
    pub denied_origins: Vec<String>,
    pub allowed_download_origins: Vec<String>,
    pub denied_download_origins: Vec<String>,
    pub allowed_upload_origins: Vec<String>,
    pub denied_upload_origins: Vec<String>,
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

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BrowserUseFileTransferKind {
    Download,
    Upload,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseOriginMutationParams {
    pub kind: BrowserUseOriginKind,
    #[serde(alias = "origin")]
    pub target_origin: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseFileTransferApprovalModeWriteParams {
    pub approval_mode: BrowserUseApprovalMode,
    pub kind: BrowserUseFileTransferKind,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserUseFileTransferOriginMutationParams {
    pub kind: BrowserUseOriginKind,
    pub transfer_kind: BrowserUseFileTransferKind,
    #[serde(alias = "origin")]
    pub target_origin: String,
}

impl Default for BrowserUseSettingsState {
    fn default() -> Self {
        Self {
            approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            history_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            download_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            upload_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
            allowed_origins: Vec::new(),
            denied_origins: Vec::new(),
            allowed_download_origins: Vec::new(),
            denied_download_origins: Vec::new(),
            allowed_upload_origins: Vec::new(),
            denied_upload_origins: Vec::new(),
        }
    }
}

#[tauri::command]
pub fn read_browser_use_settings() -> Result<BrowserUseSettingsState, String> {
    read_browser_use_settings_state()
}

#[tauri::command(rename = "browser-use-origin-state-read")]
pub fn browser_use_origin_state_read() -> Result<BrowserUseSettingsState, String> {
    read_browser_use_settings_state()
}

#[tauri::command]
pub fn write_browser_use_approval_mode(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    write_browser_use_approval_mode_for_key(APPROVAL_MODE_KEY, params.approval_mode)
}

#[tauri::command(rename = "browser-use-approval-mode-write")]
pub fn browser_use_approval_mode_write(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    write_browser_use_approval_mode_for_key(APPROVAL_MODE_KEY, params.approval_mode)
}

#[tauri::command]
pub fn write_browser_use_history_approval_mode(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    write_browser_use_approval_mode_for_key(HISTORY_APPROVAL_MODE_KEY, params.approval_mode)
}

#[tauri::command(rename = "browser-use-history-approval-mode-write")]
pub fn browser_use_history_approval_mode_write(
    params: BrowserUseApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    write_browser_use_approval_mode_for_key(HISTORY_APPROVAL_MODE_KEY, params.approval_mode)
}

#[tauri::command(rename = "browser-use-file-transfer-approval-mode-write")]
pub fn write_browser_use_file_transfer_approval_mode(
    params: BrowserUseFileTransferApprovalModeWriteParams,
) -> Result<BrowserUseSettingsState, String> {
    write_browser_use_approval_mode_for_key(
        params.kind.approval_mode_config_key(),
        params.approval_mode,
    )
}

#[tauri::command]
pub fn add_browser_use_origin(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    add_browser_use_origin_for_table(ORIGINS_KEY, params.kind, &params.target_origin)
}

#[tauri::command(rename = "browser-use-origin-add")]
pub fn browser_use_origin_add(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    add_browser_use_origin_for_table(ORIGINS_KEY, params.kind, &params.target_origin)
}

#[tauri::command(rename = "browser-use-file-transfer-origin-add")]
pub fn add_browser_use_file_transfer_origin(
    params: BrowserUseFileTransferOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    add_browser_use_origin_for_table(
        params.transfer_kind.origins_config_key(),
        params.kind,
        &params.target_origin,
    )
}

#[tauri::command]
pub fn remove_browser_use_origin(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    remove_browser_use_origin_for_table(ORIGINS_KEY, params.kind, &params.target_origin)
}

#[tauri::command(rename = "browser-use-origin-remove")]
pub fn browser_use_origin_remove(
    params: BrowserUseOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    remove_browser_use_origin_for_table(ORIGINS_KEY, params.kind, &params.target_origin)
}

#[tauri::command(rename = "browser-use-file-transfer-origin-remove")]
pub fn remove_browser_use_file_transfer_origin(
    params: BrowserUseFileTransferOriginMutationParams,
) -> Result<BrowserUseSettingsState, String> {
    remove_browser_use_origin_for_table(
        params.transfer_kind.origins_config_key(),
        params.kind,
        &params.target_origin,
    )
}

fn read_browser_use_settings_state() -> Result<BrowserUseSettingsState, String> {
    Ok(browser_use_settings_state_from_table(
        &read_browser_use_settings_table()?,
    ))
}

fn write_browser_use_approval_mode_for_key(
    config_key: &str,
    approval_mode: BrowserUseApprovalMode,
) -> Result<BrowserUseSettingsState, String> {
    mutate_browser_use_settings_table(|table| {
        table.insert(
            config_key.to_string(),
            toml::Value::String(approval_mode_to_config_value(approval_mode).to_string()),
        );
        Ok(true)
    })
}

fn add_browser_use_origin_for_table(
    table_key: &str,
    kind: BrowserUseOriginKind,
    target_origin: &str,
) -> Result<BrowserUseSettingsState, String> {
    let normalized_origin = normalize_browser_use_origin(target_origin)
        .ok_or_else(|| "Invalid Browser Use origin".to_string())?;

    mutate_browser_use_settings_table(|table| {
        let origins_table = ensure_nested_table(table, table_key);
        let mut next_origins = normalized_origin_list(origins_table.get(kind.config_key()));
        let current_opposite_origins =
            normalized_origin_list(origins_table.get(kind.opposite_config_key()));
        let mut did_change = false;

        if !next_origins
            .iter()
            .any(|origin| origin == &normalized_origin)
        {
            next_origins.push(normalized_origin.clone());
            did_change = true;
        }

        let opposite_key = kind.opposite_config_key();
        let opposite_origins = current_opposite_origins
            .into_iter()
            .filter(|origin| origin != &normalized_origin)
            .collect::<Vec<_>>();
        if opposite_origins != normalized_origin_list(origins_table.get(kind.opposite_config_key()))
        {
            did_change = true;
        }

        set_origin_list(origins_table, kind.config_key(), next_origins);
        set_origin_list(origins_table, opposite_key, opposite_origins);

        Ok(did_change)
    })
}

fn remove_browser_use_origin_for_table(
    table_key: &str,
    kind: BrowserUseOriginKind,
    target_origin: &str,
) -> Result<BrowserUseSettingsState, String> {
    mutate_browser_use_settings_table(|table| {
        let Some(origins_table) = table.get_mut(table_key).and_then(toml::Value::as_table_mut)
        else {
            return Ok(false);
        };
        let current_origins = normalized_origin_list(origins_table.get(kind.config_key()));
        let next_origins = current_origins
            .iter()
            .filter(|origin| origin.as_str() != target_origin)
            .cloned()
            .collect::<Vec<_>>();

        if next_origins.len() == current_origins.len() {
            return Ok(false);
        }

        set_origin_list(origins_table, kind.config_key(), next_origins);
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
    BrowserUseSettingsState {
        approval_mode: approval_mode_from_config_value(
            table.get(APPROVAL_MODE_KEY).and_then(toml::Value::as_str),
        ),
        history_approval_mode: approval_mode_from_config_value(
            table
                .get(HISTORY_APPROVAL_MODE_KEY)
                .and_then(toml::Value::as_str),
        ),
        download_approval_mode: approval_mode_from_config_value(
            table
                .get(DOWNLOAD_APPROVAL_MODE_KEY)
                .and_then(toml::Value::as_str),
        ),
        upload_approval_mode: approval_mode_from_config_value(
            table
                .get(UPLOAD_APPROVAL_MODE_KEY)
                .and_then(toml::Value::as_str),
        ),
        allowed_origins: origin_list_from_table(
            nested_table(table, ORIGINS_KEY),
            BrowserUseOriginKind::Allowed,
        ),
        denied_origins: origin_list_from_table(
            nested_table(table, ORIGINS_KEY),
            BrowserUseOriginKind::Denied,
        ),
        allowed_download_origins: origin_list_from_table(
            nested_table(table, DOWNLOADS_KEY),
            BrowserUseOriginKind::Allowed,
        ),
        denied_download_origins: origin_list_from_table(
            nested_table(table, DOWNLOADS_KEY),
            BrowserUseOriginKind::Denied,
        ),
        allowed_upload_origins: origin_list_from_table(
            nested_table(table, UPLOADS_KEY),
            BrowserUseOriginKind::Allowed,
        ),
        denied_upload_origins: origin_list_from_table(
            nested_table(table, UPLOADS_KEY),
            BrowserUseOriginKind::Denied,
        ),
    }
}

fn nested_table<'a>(table: &'a toml::Table, key: &str) -> Option<&'a toml::Table> {
    table.get(key).and_then(toml::Value::as_table)
}

fn origin_list_from_table(table: Option<&toml::Table>, kind: BrowserUseOriginKind) -> Vec<String> {
    table.map_or_else(Vec::new, |table| {
        normalized_origin_list(table.get(kind.config_key()))
    })
}

fn ensure_nested_table<'a>(table: &'a mut toml::Table, key: &str) -> &'a mut toml::Table {
    let origins_entry = table
        .entry(key.to_string())
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

impl BrowserUseFileTransferKind {
    fn approval_mode_config_key(self) -> &'static str {
        match self {
            BrowserUseFileTransferKind::Download => DOWNLOAD_APPROVAL_MODE_KEY,
            BrowserUseFileTransferKind::Upload => UPLOAD_APPROVAL_MODE_KEY,
        }
    }

    fn origins_config_key(self) -> &'static str {
        match self {
            BrowserUseFileTransferKind::Download => DOWNLOADS_KEY,
            BrowserUseFileTransferKind::Upload => UPLOADS_KEY,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::approval_mode_from_config_value;
    use super::browser_use_settings_state_from_table;
    use super::normalize_browser_use_origin;
    use super::normalized_origin_list;
    use super::BrowserUseApprovalMode;
    use super::BrowserUseFileTransferKind;
    use super::BrowserUseOriginKind;
    use super::BrowserUseSettingsState;
    use super::DOWNLOADS_KEY;
    use super::DOWNLOAD_APPROVAL_MODE_KEY;
    use super::ORIGINS_KEY;
    use super::UPLOADS_KEY;
    use super::UPLOAD_APPROVAL_MODE_KEY;

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
    fn browser_use_settings_state_defaults_when_table_is_empty() {
        assert_eq!(
            browser_use_settings_state_from_table(&toml::Table::new()),
            BrowserUseSettingsState::default()
        );
    }

    #[test]
    fn browser_use_settings_state_reads_file_transfer_settings() {
        let mut table = toml::Table::new();
        table.insert(
            "approval_mode".to_string(),
            toml::Value::String("never_ask".to_string()),
        );
        table.insert(
            "history_approval_mode".to_string(),
            toml::Value::String("always_ask".to_string()),
        );
        table.insert(
            DOWNLOAD_APPROVAL_MODE_KEY.to_string(),
            toml::Value::String("never_ask".to_string()),
        );
        table.insert(
            UPLOAD_APPROVAL_MODE_KEY.to_string(),
            toml::Value::String("always_ask".to_string()),
        );
        table.insert(
            ORIGINS_KEY.to_string(),
            toml::Value::Table(origin_table(
                vec![
                    " https://example.com ".to_string(),
                    "https://example.com".to_string(),
                ],
                vec!["https://blocked.com".to_string()],
            )),
        );
        table.insert(
            DOWNLOADS_KEY.to_string(),
            toml::Value::Table(origin_table(
                vec!["https://download.example.com".to_string()],
                vec!["https://download.blocked.com".to_string()],
            )),
        );
        table.insert(
            UPLOADS_KEY.to_string(),
            toml::Value::Table(origin_table(
                vec!["https://upload.example.com".to_string()],
                vec!["https://upload.blocked.com".to_string()],
            )),
        );

        assert_eq!(
            browser_use_settings_state_from_table(&table),
            BrowserUseSettingsState {
                approval_mode: BrowserUseApprovalMode::NeverAsk,
                history_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
                download_approval_mode: BrowserUseApprovalMode::NeverAsk,
                upload_approval_mode: BrowserUseApprovalMode::AlwaysAsk,
                allowed_origins: vec!["https://example.com".to_string()],
                denied_origins: vec!["https://blocked.com".to_string()],
                allowed_download_origins: vec!["https://download.example.com".to_string()],
                denied_download_origins: vec!["https://download.blocked.com".to_string()],
                allowed_upload_origins: vec!["https://upload.example.com".to_string()],
                denied_upload_origins: vec!["https://upload.blocked.com".to_string()],
            }
        );
    }

    #[test]
    fn file_transfer_kind_uses_upstream_config_keys() {
        assert_eq!(
            BrowserUseFileTransferKind::Download.approval_mode_config_key(),
            DOWNLOAD_APPROVAL_MODE_KEY
        );
        assert_eq!(
            BrowserUseFileTransferKind::Upload.approval_mode_config_key(),
            UPLOAD_APPROVAL_MODE_KEY
        );
        assert_eq!(
            BrowserUseFileTransferKind::Download.origins_config_key(),
            DOWNLOADS_KEY
        );
        assert_eq!(
            BrowserUseFileTransferKind::Upload.origins_config_key(),
            UPLOADS_KEY
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

    fn origin_table(allowed: Vec<String>, denied: Vec<String>) -> toml::Table {
        let mut table = toml::Table::new();
        table.insert(
            BrowserUseOriginKind::Allowed.config_key().to_string(),
            toml::Value::Array(
                allowed
                    .into_iter()
                    .map(toml::Value::String)
                    .collect::<Vec<_>>(),
            ),
        );
        table.insert(
            BrowserUseOriginKind::Denied.config_key().to_string(),
            toml::Value::Array(
                denied
                    .into_iter()
                    .map(toml::Value::String)
                    .collect::<Vec<_>>(),
            ),
        );
        table
    }
}
