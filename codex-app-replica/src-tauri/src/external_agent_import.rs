use crate::auth_bridge::register_external_agent_import_completed_waiter;
use crate::auth_bridge::request_external_agent_config_detect;
use crate::auth_bridge::request_external_agent_config_import;
use crate::auth_bridge::AuthBridgeState;
use crate::codex_home::resolve_codex_home;

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::time::Duration;

const CLAUDE_CODE_PROVIDER_ID: &str = "claude-code";
const LOCAL_HOST_ID: &str = "local";
const EXTERNAL_AGENT_IMPORT_COMPLETION_TIMEOUT_MS: u64 = 120_000;
const EXTERNAL_AGENT_SESSION_IMPORT_LEDGER_FILE: &str = "external_agent_session_imports.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportDetectParams {
    pub host_id: Option<String>,
    #[serde(default)]
    pub include_home: bool,
    #[serde(default)]
    pub providers: Vec<String>,
    pub workspace_roots: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportImportParams {
    pub host_id: Option<String>,
    #[serde(default)]
    pub items: Vec<ExternalAgentImportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportStatusParams {
    pub host_id: Option<String>,
    pub providers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportDetectResponse {
    pub items: Vec<ExternalAgentImportItem>,
    #[serde(default)]
    pub unsupported_projects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportImportResponse {
    pub project_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportStatusResponse {
    pub imported_session_count: usize,
    pub latest_imported_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExternalAgentImportItemType {
    #[serde(rename = "AGENTS_MD")]
    AgentsMd,
    #[serde(rename = "CONFIG")]
    Config,
    #[serde(rename = "SKILLS")]
    Skills,
    #[serde(rename = "PLUGINS")]
    Plugins,
    #[serde(rename = "MCP_SERVER_CONFIG")]
    McpServerConfig,
    #[serde(rename = "SUBAGENTS")]
    Subagents,
    #[serde(rename = "HOOKS")]
    Hooks,
    #[serde(rename = "COMMANDS")]
    Commands,
    #[serde(rename = "SESSIONS")]
    Sessions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportPluginsMigration {
    pub marketplace_name: String,
    pub plugin_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportSessionMigration {
    pub path: String,
    pub cwd: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportMcpServerMigration {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportHookMigration {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportSubagentMigration {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportCommandMigration {
    pub name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportMigrationDetails {
    #[serde(default)]
    pub plugins: Vec<ExternalAgentImportPluginsMigration>,
    #[serde(default)]
    pub sessions: Vec<ExternalAgentImportSessionMigration>,
    #[serde(default)]
    pub mcp_servers: Vec<ExternalAgentImportMcpServerMigration>,
    #[serde(default)]
    pub hooks: Vec<ExternalAgentImportHookMigration>,
    #[serde(default)]
    pub subagents: Vec<ExternalAgentImportSubagentMigration>,
    #[serde(default)]
    pub commands: Vec<ExternalAgentImportCommandMigration>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAgentImportItem {
    pub item_type: ExternalAgentImportItemType,
    pub description: String,
    pub cwd: Option<String>,
    pub details: Option<ExternalAgentImportMigrationDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppServerExternalAgentImportDetectParams {
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    include_home: bool,
    cwds: Option<Vec<PathBuf>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppServerExternalAgentImportDetectResponse {
    items: Vec<ExternalAgentImportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppServerExternalAgentImportImportParams {
    migration_items: Vec<ExternalAgentImportItem>,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
struct ExternalAgentSessionImportLedger {
    #[serde(default)]
    records: Vec<ExternalAgentSessionImportLedgerRecord>,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
struct ExternalAgentSessionImportLedgerRecord {
    imported_at: Option<i64>,
}

#[tauri::command(rename = "external-agent-import-detect")]
pub async fn external_agent_import_detect(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ExternalAgentImportDetectParams,
) -> Result<ExternalAgentImportDetectResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "external-agent-import-detect")?;

    let providers = normalize_provider_ids(params.providers);
    if !providers.contains(CLAUDE_CODE_PROVIDER_ID) {
        return Ok(ExternalAgentImportDetectResponse {
            items: Vec::new(),
            unsupported_projects: Vec::new(),
        });
    }

    let items =
        detect_claude_code_items(state.inner(), params.include_home, params.workspace_roots)
            .await?;

    Ok(ExternalAgentImportDetectResponse {
        items,
        unsupported_projects: Vec::new(),
    })
}

#[tauri::command(rename = "external-agent-import-import")]
pub async fn external_agent_import_import(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ExternalAgentImportImportParams,
) -> Result<ExternalAgentImportImportResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "external-agent-import-import")?;

    let mut claude_code_items = params
        .items
        .into_iter()
        .filter(is_claude_code_item)
        .map(clear_provider_id)
        .collect::<Vec<_>>();

    if claude_code_items.is_empty() {
        return Ok(ExternalAgentImportImportResponse {
            project_roots: Vec::new(),
        });
    }

    let project_roots = collect_project_roots(&claude_code_items);
    let waiter = claude_code_items
        .iter()
        .any(|item| item.item_type == ExternalAgentImportItemType::Sessions)
        .then(|| register_external_agent_import_completed_waiter(state.inner()));

    request_import(state.inner(), std::mem::take(&mut claude_code_items)).await?;

    if let Some(waiter) = waiter {
        waiter
            .wait(Duration::from_millis(
                EXTERNAL_AGENT_IMPORT_COMPLETION_TIMEOUT_MS,
            ))
            .await?;
    }

    Ok(ExternalAgentImportImportResponse { project_roots })
}

#[tauri::command(rename = "external-agent-import-status")]
pub fn external_agent_import_status(
    params: Option<ExternalAgentImportStatusParams>,
) -> Result<ExternalAgentImportStatusResponse, String> {
    let params = params.unwrap_or(ExternalAgentImportStatusParams {
        host_id: None,
        providers: None,
    });
    ensure_supported_host_id(params.host_id.as_deref(), "external-agent-import-status")?;

    let providers = normalize_provider_ids(params.providers.unwrap_or_default());
    if !providers.contains(CLAUDE_CODE_PROVIDER_ID) {
        return Ok(ExternalAgentImportStatusResponse {
            imported_session_count: 0,
            latest_imported_at_ms: None,
        });
    }

    let codex_home = resolve_codex_home()?;
    Ok(read_claude_code_import_status(&codex_home))
}

async fn detect_claude_code_items(
    state: &Arc<AuthBridgeState>,
    include_home: bool,
    workspace_roots: Option<Vec<String>>,
) -> Result<Vec<ExternalAgentImportItem>, String> {
    if !include_home && workspace_roots.is_none() {
        return Ok(Vec::new());
    }

    let root_items = request_detect(state, include_home, workspace_roots.clone()).await?;
    if !include_home || workspace_roots.is_some() {
        return Ok(root_items);
    }

    let project_roots = collect_project_roots(&root_items);
    if project_roots.is_empty() {
        return Ok(root_items);
    }

    let project_items = request_detect(state, false, Some(project_roots)).await?;
    let mut combined = root_items;
    combined.extend(project_items);
    Ok(deduplicate_items(combined))
}

async fn request_detect(
    state: &Arc<AuthBridgeState>,
    include_home: bool,
    workspace_roots: Option<Vec<String>>,
) -> Result<Vec<ExternalAgentImportItem>, String> {
    let payload = serde_json::to_value(AppServerExternalAgentImportDetectParams {
        include_home,
        cwds: workspace_roots.map(|roots| roots.into_iter().map(PathBuf::from).collect()),
    })
    .map_err(|err| format!("failed to encode external agent detect params: {err}"))?;

    let value = request_external_agent_config_detect(state, payload).await?;
    let response = serde_json::from_value::<AppServerExternalAgentImportDetectResponse>(value)
        .map_err(|err| format!("failed to decode external agent detect response: {err}"))?;

    Ok(response
        .items
        .into_iter()
        .map(tag_with_claude_code_provider)
        .collect())
}

async fn request_import(
    state: &Arc<AuthBridgeState>,
    items: Vec<ExternalAgentImportItem>,
) -> Result<(), String> {
    let payload = serde_json::to_value(AppServerExternalAgentImportImportParams {
        migration_items: items,
    })
    .map_err(|err| format!("failed to encode external agent import params: {err}"))?;
    request_external_agent_config_import(state, payload).await
}

fn collect_project_roots(items: &[ExternalAgentImportItem]) -> Vec<String> {
    let mut project_roots = BTreeSet::new();

    for item in items {
        if let Some(cwd) = non_empty(item.cwd.as_deref()) {
            project_roots.insert(cwd.to_string());
        }
        if let Some(details) = &item.details {
            for session in &details.sessions {
                if let Some(cwd) = non_empty(Some(session.cwd.as_str())) {
                    project_roots.insert(cwd.to_string());
                }
            }
        }
    }

    project_roots.into_iter().collect()
}

fn deduplicate_items(items: Vec<ExternalAgentImportItem>) -> Vec<ExternalAgentImportItem> {
    let mut seen = BTreeSet::new();
    let mut deduplicated = Vec::new();

    for item in items {
        let Ok(key) = serde_json::to_string(&item) else {
            continue;
        };
        if seen.insert(key) {
            deduplicated.push(item);
        }
    }

    deduplicated
}

fn tag_with_claude_code_provider(mut item: ExternalAgentImportItem) -> ExternalAgentImportItem {
    item.provider_id = Some(CLAUDE_CODE_PROVIDER_ID.to_string());
    item
}

fn clear_provider_id(mut item: ExternalAgentImportItem) -> ExternalAgentImportItem {
    item.provider_id = None;
    item
}

fn is_claude_code_item(item: &ExternalAgentImportItem) -> bool {
    match item.provider_id.as_deref() {
        None | Some(CLAUDE_CODE_PROVIDER_ID) => true,
        Some(_) => false,
    }
}

fn normalize_provider_ids(providers: Vec<String>) -> BTreeSet<String> {
    let normalized = providers
        .into_iter()
        .filter_map(|provider| {
            let trimmed = provider.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect::<BTreeSet<_>>();

    if normalized.is_empty() {
        BTreeSet::from([CLAUDE_CODE_PROVIDER_ID.to_string()])
    } else {
        normalized
    }
}

fn read_claude_code_import_status(codex_home: &PathBuf) -> ExternalAgentImportStatusResponse {
    let path = codex_home.join(EXTERNAL_AGENT_SESSION_IMPORT_LEDGER_FILE);
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(_) => {
            return ExternalAgentImportStatusResponse {
                imported_session_count: 0,
                latest_imported_at_ms: None,
            };
        }
    };

    let ledger = serde_json::from_str::<ExternalAgentSessionImportLedger>(&contents)
        .unwrap_or_else(|_| ExternalAgentSessionImportLedger::default());

    ExternalAgentImportStatusResponse {
        imported_session_count: ledger.records.len(),
        latest_imported_at_ms: ledger
            .records
            .iter()
            .filter_map(|record| record.imported_at.map(|timestamp| timestamp * 1_000))
            .max(),
    }
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    match value {
        Some(value) if !value.is_empty() => Some(value),
        _ => None,
    }
}

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id {
        None | Some("") | Some(LOCAL_HOST_ID) => Ok(()),
        Some(other) => Err(format!("{command_name} does not support host id: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::clear_provider_id;
    use super::collect_project_roots;
    use super::deduplicate_items;
    use super::ensure_supported_host_id;
    use super::is_claude_code_item;
    use super::normalize_provider_ids;
    use super::read_claude_code_import_status;
    use super::ExternalAgentImportItem;
    use super::ExternalAgentImportItemType;
    use super::ExternalAgentImportMigrationDetails;
    use super::ExternalAgentImportSessionMigration;
    use super::ExternalAgentImportStatusResponse;

    use std::env;
    use std::fs;

    #[test]
    fn project_roots_include_item_and_session_directories() {
        let items = vec![
            ExternalAgentImportItem {
                item_type: ExternalAgentImportItemType::Config,
                description: "settings".to_string(),
                cwd: Some("D:/repo-a".to_string()),
                details: None,
                provider_id: Some("claude-code".to_string()),
            },
            ExternalAgentImportItem {
                item_type: ExternalAgentImportItemType::Sessions,
                description: "sessions".to_string(),
                cwd: None,
                details: Some(ExternalAgentImportMigrationDetails {
                    sessions: vec![
                        ExternalAgentImportSessionMigration {
                            path: "D:/repo-b/session.jsonl".to_string(),
                            cwd: "D:/repo-b".to_string(),
                            title: Some("repo b".to_string()),
                        },
                        ExternalAgentImportSessionMigration {
                            path: "D:/repo-a/session.jsonl".to_string(),
                            cwd: "D:/repo-a".to_string(),
                            title: Some("repo a".to_string()),
                        },
                    ],
                    ..ExternalAgentImportMigrationDetails::default()
                }),
                provider_id: Some("claude-code".to_string()),
            },
        ];

        assert_eq!(
            collect_project_roots(&items),
            vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()]
        );
    }

    #[test]
    fn duplicate_detect_items_are_removed() {
        let item = ExternalAgentImportItem {
            item_type: ExternalAgentImportItemType::Config,
            description: "settings".to_string(),
            cwd: Some("D:/repo".to_string()),
            details: None,
            provider_id: Some("claude-code".to_string()),
        };

        assert_eq!(
            deduplicate_items(vec![item.clone(), item.clone()]),
            vec![item]
        );
    }

    #[test]
    fn clear_provider_id_strips_provider_before_import() {
        let item = ExternalAgentImportItem {
            item_type: ExternalAgentImportItemType::Config,
            description: "settings".to_string(),
            cwd: Some("D:/repo".to_string()),
            details: None,
            provider_id: Some("claude-code".to_string()),
        };

        assert_eq!(
            clear_provider_id(item),
            ExternalAgentImportItem {
                item_type: ExternalAgentImportItemType::Config,
                description: "settings".to_string(),
                cwd: Some("D:/repo".to_string()),
                details: None,
                provider_id: None,
            }
        );
    }

    #[test]
    fn provider_normalization_defaults_to_claude_code() {
        assert_eq!(
            normalize_provider_ids(vec![]),
            std::collections::BTreeSet::from(["claude-code".to_string()])
        );
        assert!(is_claude_code_item(&ExternalAgentImportItem {
            item_type: ExternalAgentImportItemType::Config,
            description: "settings".to_string(),
            cwd: None,
            details: None,
            provider_id: None,
        }));
    }

    #[test]
    fn status_reader_uses_ledger_records() {
        let root = temp_dir("status-reader");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        fs::write(
            root.join("external_agent_session_imports.json"),
            r#"{
  "records": [
    { "imported_at": 10 },
    { "imported_at": 25 },
    {}
  ]
}"#,
        )
        .expect("fixture ledger should be written");

        assert_eq!(
            read_claude_code_import_status(&root),
            ExternalAgentImportStatusResponse {
                imported_session_count: 3,
                latest_imported_at_ms: Some(25_000),
            }
        );
    }

    #[test]
    fn status_reader_returns_zero_for_invalid_ledger() {
        let root = temp_dir("status-invalid");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        fs::write(
            root.join("external_agent_session_imports.json"),
            "{not-json",
        )
        .expect("fixture ledger should be written");

        assert_eq!(
            read_claude_code_import_status(&root),
            ExternalAgentImportStatusResponse {
                imported_session_count: 0,
                latest_imported_at_ms: None,
            }
        );
    }

    #[test]
    fn external_agent_import_commands_only_accept_local_host() {
        assert!(ensure_supported_host_id(None, "external-agent-import-detect").is_ok());
        assert!(ensure_supported_host_id(Some(""), "external-agent-import-import").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "external-agent-import-status").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "external-agent-import-detect")
                .expect_err("non-local host id should be rejected"),
            "external-agent-import-detect does not support host id: remote"
        );
    }

    fn temp_dir(case_name: &str) -> std::path::PathBuf {
        let unique_suffix = format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("current time should be valid")
                .as_nanos()
        );
        env::temp_dir().join(format!(
            "codex-app-replica-external-agent-import-{case_name}-{unique_suffix}"
        ))
    }
}
