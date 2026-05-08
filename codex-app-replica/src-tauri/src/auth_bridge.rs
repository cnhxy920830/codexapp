use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{sleep, Duration};

use crate::thread_history::append_agent_message_delta;
use crate::thread_history::append_command_execution_output_delta;
use crate::thread_history::append_plan_delta;
use crate::thread_history::append_reasoning_content_delta;
use crate::thread_history::append_reasoning_summary_delta;
use crate::thread_history::build_auto_review_interruption_warning_item;
use crate::thread_history::build_automatic_approval_review_item;
use crate::thread_history::build_forked_from_conversation_item;
use crate::thread_history::build_hook_item;
use crate::thread_history::build_model_rerouted_item;
use crate::thread_history::build_stream_error_item;
use crate::thread_history::build_system_error_item;
use crate::thread_history::build_todo_list_item;
use crate::thread_history::build_turn_diff_item;
use crate::thread_history::ensure_reasoning_summary_part;
use crate::thread_history::map_file_change_summary;
use crate::thread_history::map_thread_item;
use crate::thread_history::map_todo_list_step;
use crate::thread_history::map_turn_input;
use crate::thread_history::replace_file_change_changes;
use crate::thread_history::thread_item_id;
use crate::thread_history::FileChangeSummary;
use crate::thread_history::ThreadConversation;
use crate::thread_history::ThreadConversationItem;
use crate::thread_history::ThreadConversationTurn;
use crate::thread_history::ThreadConversationTurnTiming;

const AUTH_EVENT: &str = "auth-state-changed";
const THREAD_EVENT: &str = "thread-event";
const MCP_OAUTH_EVENT: &str = "mcp-oauth-login-completed";
const APPS_LIST_UPDATED_EVENT: &str = "apps-list-updated";
const CLIENT_NAME: &str = "codex-app-replica";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const AUTO_REVIEW_INTERRUPTION_WARNING_MESSAGE_PREFIX: &str =
    "Automatic approval review rejected too many approval requests for this turn";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthState {
    pub auth_method: Option<String>,
    #[serde(rename = "openAIAuth")]
    pub open_ai_auth: Option<String>,
    pub requires_auth: bool,
    pub email: Option<String>,
    pub plan_at_login: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthSnapshot {
    pub is_loading: bool,
    pub auth_state: AuthState,
    pub active_login_id: Option<String>,
    pub last_login_error: Option<String>,
    pub browser_auth_url: Option<String>,
    pub device_code: Option<DeviceCodeInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeInfo {
    pub login_id: String,
    pub verification_url: String,
    pub user_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendAddCreditsNudgeEmailParams {
    pub credit_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendAddCreditsNudgeEmailResponse {
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadHistoryEntry {
    pub id: String,
    pub preview: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub cwd: String,
    pub path: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum JsonRpcId {
    Integer(i64),
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigReadResponse {
    pub config: ConfigSnapshot,
    pub origins: HashMap<String, ConfigLayerMetadata>,
    pub layers: Option<Vec<ConfigLayer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSnapshot {
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
    pub sandbox_workspace_write: Option<SandboxWorkspaceWrite>,
    pub personality: Option<String>,
    pub model_personality: Option<String>,
    pub memories: Option<MemoriesConfigSnapshot>,
    pub mcp_servers: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SandboxWorkspaceWrite {
    pub network_access: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoriesConfigSnapshot {
    pub generate_memories: bool,
    pub use_memories: bool,
    pub disable_on_external_context: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLayerMetadata {
    pub name: ConfigLayerSource,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ConfigLayerSource {
    Mdm { domain: String, key: String },
    System { file: String },
    User { file: String },
    Project { dot_codex_folder: String },
    SessionFlags,
    LegacyManagedConfigTomlFromFile { file: String },
    LegacyManagedConfigTomlFromMdm,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLayer {
    pub name: ConfigLayerSource,
    pub version: String,
    pub config: serde_json::Value,
    pub disabled_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigValueWriteParams {
    pub key_path: String,
    pub value: serde_json::Value,
    pub merge_strategy: String,
    pub file_path: Option<String>,
    pub expected_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigEditParams {
    pub key_path: String,
    pub value: serde_json::Value,
    pub merge_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBatchWriteParams {
    pub edits: Vec<ConfigEditParams>,
    pub file_path: Option<String>,
    pub expected_version: Option<String>,
    #[serde(default)]
    pub reload_user_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyLoginParams {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatGptLoginStart {
    pub login_id: String,
    pub auth_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeLoginStart {
    pub login_id: String,
    pub verification_url: String,
    pub user_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadListResponse {
    data: Vec<ThreadListItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadListItem {
    id: String,
    preview: String,
    created_at: i64,
    updated_at: i64,
    cwd: String,
    path: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadReadResponse {
    thread: ThreadReadThread,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadRollbackResponse {
    thread: ThreadReadThread,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExperimentalFeatureListResponse {
    data: Vec<ExperimentalFeature>,
    next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListParams {
    pub cwd: Option<String>,
    #[serde(default)]
    pub force_reload: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListResponse {
    pub data: Vec<SkillsListEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListEntry {
    pub cwd: String,
    pub skills: Vec<SkillMetadata>,
    pub errors: Vec<SkillErrorInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub short_description: Option<String>,
    #[serde(default)]
    pub interface: Option<SkillInterface>,
    pub path: String,
    pub scope: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInterface {
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub short_description: Option<String>,
    #[serde(default)]
    pub icon_small: Option<String>,
    #[serde(default)]
    pub icon_large: Option<String>,
    #[serde(default)]
    pub brand_color: Option<String>,
    #[serde(default)]
    pub default_prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillErrorInfo {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppsListParams {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    pub thread_id: Option<String>,
    pub force_refetch: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppsListResponse {
    pub data: Vec<AppInfo>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub install_url: Option<String>,
    #[serde(default)]
    pub is_accessible: bool,
    #[serde(default)]
    pub is_enabled: bool,
    #[serde(default)]
    pub plugin_display_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginListParams {
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginListResponse {
    pub marketplaces: Vec<PluginMarketplaceEntry>,
    #[serde(default)]
    pub marketplace_load_errors: Vec<MarketplaceLoadErrorInfo>,
    #[serde(default)]
    pub featured_plugin_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginReadParams {
    pub marketplace_path: Option<String>,
    pub remote_marketplace_name: Option<String>,
    pub plugin_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginReadResponse {
    pub plugin: PluginDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginDetail {
    pub marketplace_name: String,
    pub marketplace_path: Option<String>,
    pub summary: PluginSummary,
    pub description: Option<String>,
    pub skills: Vec<PluginSkillSummary>,
    pub apps: Vec<PluginAppSummary>,
    pub mcp_servers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginSkillSummary {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub short_description: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginAppSummary {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub install_url: Option<String>,
    #[serde(default)]
    pub needs_auth: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallParams {
    pub marketplace_path: Option<String>,
    pub remote_marketplace_name: Option<String>,
    pub plugin_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResponse {
    pub auth_policy: String,
    pub apps_needing_auth: Vec<PluginAppSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginUninstallParams {
    pub plugin_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginUninstallResponse {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginMarketplaceEntry {
    pub name: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub interface: Option<MarketplaceInterface>,
    pub plugins: Vec<PluginSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceInterface {
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceLoadErrorInfo {
    pub marketplace_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub enabled: bool,
    #[serde(default)]
    pub interface: Option<PluginInterface>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginInterface {
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub short_description: Option<String>,
    #[serde(default)]
    pub long_description: Option<String>,
    #[serde(default)]
    pub developer_name: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentalFeature {
    pub name: String,
    pub stage: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub announcement: Option<String>,
    pub enabled: bool,
    pub default_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusListParams {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusListResponse {
    pub data: Vec<McpServerStatusEntry>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusEntry {
    pub name: String,
    pub auth_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerOauthLoginParams {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerOauthLoginResponse {
    pub authorization_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadStartResponse {
    thread: ThreadStartThread,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TurnStartResponse {
    turn: TurnStartTurn,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewStartResponse {
    turn: TurnStartTurn,
    review_thread_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TurnSteerResponse {
    turn_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TurnStartTurn {
    id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewStartResult {
    pub turn_id: String,
    pub review_thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentalFeatureEnablementSetParams {
    pub enablement: HashMap<String, bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadStartThread {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadReadThread {
    id: String,
    preview: String,
    cwd: String,
    name: Option<String>,
    turns: Vec<ThreadReadTurn>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadReadTurn {
    id: String,
    status: Option<String>,
    started_at: Option<f64>,
    completed_at: Option<f64>,
    #[serde(default)]
    input: Vec<serde_json::Value>,
    items: Vec<serde_json::Value>,
}

fn resolved_thread_title(thread: &ThreadReadThread) -> String {
    thread
        .name
        .clone()
        .unwrap_or_else(|| thread.preview.clone())
        .trim()
        .to_string()
}

fn seconds_to_milliseconds(value: Option<f64>) -> Option<i64> {
    let seconds = value?;
    if !seconds.is_finite() {
        return None;
    }
    let milliseconds = seconds * 1000.0;
    if !milliseconds.is_finite() {
        return None;
    }
    Some(milliseconds.round() as i64)
}

impl Default for AuthState {
    fn default() -> Self {
        Self {
            auth_method: None,
            open_ai_auth: None,
            requires_auth: true,
            email: None,
            plan_at_login: None,
        }
    }
}

impl Default for AuthSnapshot {
    fn default() -> Self {
        Self {
            is_loading: true,
            auth_state: AuthState::default(),
            active_login_id: None,
            last_login_error: None,
            browser_auth_url: None,
            device_code: None,
        }
    }
}

pub struct AuthBridgeState {
    snapshot: Mutex<AuthSnapshot>,
    is_ready: Mutex<bool>,
    request_tx: Mutex<Option<mpsc::UnboundedSender<AppServerMessage>>>,
    current_personality: Mutex<Option<String>>,
    turn_diffs: Mutex<HashMap<String, String>>,
    model_reroutes: Mutex<HashMap<String, Vec<ModelReroutedCacheEntry>>>,
    automatic_approval_reviews: Mutex<HashMap<String, Vec<AutomaticApprovalReviewCacheEntry>>>,
    auto_review_interruption_warnings:
        Mutex<HashMap<String, Vec<AutoReviewInterruptionWarningCacheEntry>>>,
    latest_turn_ids: Mutex<HashMap<String, String>>,
    turn_errors: Mutex<HashMap<String, Vec<TurnErrorCacheEntry>>>,
    forked_from_conversations: Mutex<HashMap<String, ForkedFromConversationCacheEntry>>,
}

impl AuthBridgeState {
    pub fn current_personality(&self) -> Option<String> {
        self.current_personality
            .lock()
            .expect("current personality mutex poisoned")
            .clone()
    }
}

#[derive(Debug, Clone)]
struct ModelReroutedCacheEntry {
    id: String,
    from_model: String,
    to_model: String,
    reason: String,
}

#[derive(Debug, Clone)]
struct ForkedFromConversationCacheEntry {
    turn_id: String,
    source_conversation_id: String,
    source_conversation_title: Option<String>,
}

#[derive(Debug, Clone)]
struct AutomaticApprovalReviewCacheEntry {
    id: String,
    status: String,
    risk_level: Option<String>,
    rationale: Option<String>,
}

#[derive(Debug, Clone)]
struct AutoReviewInterruptionWarningCacheEntry {
    id: String,
}

#[derive(Debug, Clone)]
struct TurnErrorCacheEntry {
    id: String,
    content: String,
    additional_details: Option<String>,
    will_retry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThreadItemUpdatePhase {
    Started,
    Completed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadEventPayload {
    ThreadItemUpdated {
        thread_id: String,
        turn_id: String,
        phase: ThreadItemUpdatePhase,
        item: ThreadConversationItem,
    },
    TurnCompleted {
        thread_id: String,
        turn_id: String,
        status: String,
        error: Option<String>,
    },
    CommandApprovalRequested {
        request_id: JsonRpcId,
        thread_id: String,
        turn_id: String,
        item_id: String,
        reason: Option<String>,
        network_approval_context: Option<NetworkApprovalContextPayload>,
        command: Option<String>,
        cwd: Option<String>,
        command_actions: Option<Vec<CommandActionPayload>>,
        additional_permissions: Option<PermissionProfilePayload>,
        proposed_execpolicy_amendment: Option<Vec<String>>,
        proposed_network_policy_amendments: Option<Vec<NetworkPolicyAmendmentPayload>>,
        available_decisions: Option<Vec<String>>,
    },
    FileChangeApprovalRequested {
        request_id: JsonRpcId,
        thread_id: String,
        turn_id: String,
        item_id: String,
        reason: Option<String>,
        grant_root: Option<String>,
        changes: Vec<FileChangeSummary>,
    },
    PermissionsRequestApprovalRequested {
        request_id: JsonRpcId,
        thread_id: String,
        turn_id: String,
        item_id: String,
        cwd: String,
        reason: Option<String>,
        permissions: PermissionProfilePayload,
    },
    McpServerElicitationRequested {
        request_id: JsonRpcId,
        thread_id: String,
        turn_id: Option<String>,
        server_name: String,
        request: McpServerElicitationRequestPayload,
    },
    ToolRequestUserInputRequested {
        request_id: JsonRpcId,
        thread_id: String,
        turn_id: String,
        item_id: String,
        questions: Vec<ToolRequestUserInputQuestionPayload>,
    },
    ServerRequestResolved {
        request_id: JsonRpcId,
        thread_id: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequestUserInputQuestionPayload {
    id: String,
    header: String,
    question: String,
    is_other: bool,
    is_secret: bool,
    options: Option<Vec<ToolRequestUserInputOptionPayload>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequestUserInputOptionPayload {
    label: String,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionProfilePayload {
    pub network: Option<NetworkPermissionPayload>,
    pub file_system: Option<FileSystemPermissionPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkPermissionPayload {
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemPermissionPayload {
    pub read: Option<Vec<String>>,
    pub write: Option<Vec<String>>,
    pub entries: Option<Vec<FileSystemEntryPayload>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemEntryPayload {
    pub path: String,
    pub access: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkApprovalContextPayload {
    host: String,
    protocol: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkPolicyAmendmentPayload {
    host: String,
    action: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CommandActionPayload {
    Read {
        command: String,
        name: String,
        path: String,
    },
    ListFiles {
        command: String,
        path: Option<String>,
    },
    Search {
        command: String,
        query: Option<String>,
        path: Option<String>,
    },
    Unknown {
        command: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum McpServerElicitationRequestPayload {
    Form {
        message: String,
        meta: Option<serde_json::Value>,
        requested_schema: serde_json::Value,
    },
    Url {
        message: String,
        meta: Option<serde_json::Value>,
        url: String,
        elicitation_id: String,
    },
}

impl Default for AuthBridgeState {
    fn default() -> Self {
        Self {
            snapshot: Mutex::new(AuthSnapshot::default()),
            is_ready: Mutex::new(false),
            request_tx: Mutex::new(None),
            current_personality: Mutex::new(None),
            turn_diffs: Mutex::new(HashMap::new()),
            model_reroutes: Mutex::new(HashMap::new()),
            automatic_approval_reviews: Mutex::new(HashMap::new()),
            auto_review_interruption_warnings: Mutex::new(HashMap::new()),
            latest_turn_ids: Mutex::new(HashMap::new()),
            turn_errors: Mutex::new(HashMap::new()),
            forked_from_conversations: Mutex::new(HashMap::new()),
        }
    }
}

fn normalize_runtime_personality(personality: Option<&str>) -> Result<Option<String>, String> {
    match personality {
        None => Ok(None),
        Some(value @ ("friendly" | "pragmatic" | "none")) => Ok(Some(value.to_string())),
        Some(other) => Err(format!("unsupported personality value: {other}")),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Account {
    #[serde(rename = "type")]
    account_type: String,
    email: Option<String>,
    plan_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountReadResponse {
    account: Option<Account>,
    requires_openai_auth: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GetAccountRateLimitsResponse {
    pub rate_limits: RateLimitSnapshot,
    pub rate_limits_by_limit_id: Option<HashMap<String, RateLimitSnapshot>>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitSnapshot {
    pub limit_id: Option<String>,
    pub limit_name: Option<String>,
    pub primary: Option<RateLimitWindow>,
    pub secondary: Option<RateLimitWindow>,
    pub credits: Option<CreditsSnapshot>,
    pub plan_type: Option<String>,
    pub rate_limit_reached_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitWindow {
    pub used_percent: i32,
    pub window_duration_mins: Option<i64>,
    pub resets_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreditsSnapshot {
    pub has_credits: bool,
    pub unlimited: bool,
    pub balance: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginCompletedNotification {
    login_id: Option<String>,
    success: bool,
    error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct McpOauthLoginCompletedNotification {
    name: String,
    success: bool,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum LoginStartResult {
    #[serde(rename_all = "camelCase")]
    ApiKey,
    #[serde(rename_all = "camelCase")]
    Chatgpt { login_id: String, auth_url: String },
    #[serde(rename_all = "camelCase")]
    ChatgptDeviceCode {
        login_id: String,
        verification_url: String,
        user_code: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum JsonRpcMessage {
    Response {
        id: JsonRpcId,
        #[serde(default)]
        result: Option<serde_json::Value>,
        #[serde(default)]
        error: Option<JsonRpcError>,
    },
    Request {
        id: JsonRpcId,
        method: String,
        #[serde(default)]
        params: serde_json::Value,
    },
    Notification {
        method: String,
        #[serde(default)]
        params: serde_json::Value,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

enum AppServerRequestKind {
    AccountRead,
    AccountRateLimitsRead,
    AccountSendAddCreditsNudgeEmail,
    AppsList,
    LoginApiKey,
    LoginChatGpt,
    LoginChatGptDeviceCode,
    CancelLogin,
    Logout,
    ConfigRead,
    ConfigValueWrite,
    ConfigBatchWrite,
    ExperimentalFeatureList,
    ExperimentalFeatureEnablementSet,
    MemoryReset,
    McpServerOauthLogin,
    McpServerStatusList,
    ReloadMcpServerConfig,
    SkillsList,
    PluginList,
    PluginRead,
    PluginInstall,
    PluginUninstall,
    ThreadList,
    ThreadStart,
    ThreadFork,
    ThreadArchive,
    ThreadUnarchive,
    ThreadNameSet,
    ThreadRead,
    ThreadRollback,
    ReviewStart,
    TurnStart,
    TurnSteer,
    TurnInterrupt,
}

struct AppServerRequest {
    kind: AppServerRequestKind,
    payload: serde_json::Value,
    response_tx: Option<oneshot::Sender<Result<serde_json::Value, String>>>,
}

struct AppServerResponse {
    request_id: JsonRpcId,
    result: serde_json::Value,
    response_tx: Option<oneshot::Sender<Result<(), String>>>,
}

enum AppServerMessage {
    Request(AppServerRequest),
    Response(AppServerResponse),
}

#[tauri::command]
pub fn get_auth_state(state: State<'_, Arc<AuthBridgeState>>) -> AuthSnapshot {
    state
        .snapshot
        .lock()
        .expect("auth snapshot mutex poisoned")
        .clone()
}

#[tauri::command]
pub async fn read_account_rate_limits(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<GetAccountRateLimitsResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::AccountRateLimitsRead,
        serde_json::json!({}),
    )
    .await?;
    serde_json::from_value::<GetAccountRateLimitsResponse>(value)
        .map_err(|err| format!("failed to decode account rate limits response: {err}"))
}

#[tauri::command]
pub async fn send_add_credits_nudge_email(
    state: State<'_, Arc<AuthBridgeState>>,
    params: SendAddCreditsNudgeEmailParams,
) -> Result<SendAddCreditsNudgeEmailResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::AccountSendAddCreditsNudgeEmail,
        serde_json::json!({
            "creditType": params.credit_type,
        }),
    )
    .await?;
    serde_json::from_value::<SendAddCreditsNudgeEmailResponse>(value)
        .map_err(|err| format!("failed to decode add credits nudge response: {err}"))
}

#[tauri::command]
pub async fn login_api_key(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ApiKeyLoginParams,
) -> Result<(), String> {
    clear_login_error(&app, state.inner());
    send_request(
        state.inner(),
        AppServerRequestKind::LoginApiKey,
        serde_json::json!({
            "type": "apiKey",
            "apiKey": params.api_key,
        }),
    )
    .await
    .map(|_| ())
    .map_err(|error| {
        set_login_error(&app, state.inner(), error.clone());
        error
    })
}

#[tauri::command]
pub async fn login_chatgpt(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<ChatGptLoginStart, String> {
    clear_login_error(&app, state.inner());
    let value = send_request(
        state.inner(),
        AppServerRequestKind::LoginChatGpt,
        serde_json::json!({
            "type": "chatgpt",
        }),
    )
    .await
    .map_err(|error| {
        set_login_error(&app, state.inner(), error.clone());
        error
    })?;
    let result = serde_json::from_value::<LoginStartResult>(value).map_err(|err| {
        let error = format!("failed to decode chatgpt login response: {err}");
        set_login_error(&app, state.inner(), error.clone());
        error
    })?;
    match result {
        LoginStartResult::Chatgpt { login_id, auth_url } => {
            update_login_pending_state(
                &app,
                state.inner(),
                Some(login_id.clone()),
                Some(auth_url.clone()),
                None,
            );
            Ok(ChatGptLoginStart { login_id, auth_url })
        }
        _ => {
            let error = "unexpected login response type".to_string();
            set_login_error(&app, state.inner(), error.clone());
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn login_chatgpt_device_code(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<DeviceCodeLoginStart, String> {
    clear_login_error(&app, state.inner());
    let value = send_request(
        state.inner(),
        AppServerRequestKind::LoginChatGptDeviceCode,
        serde_json::json!({
            "type": "chatgptDeviceCode",
        }),
    )
    .await
    .map_err(|error| {
        set_login_error(&app, state.inner(), error.clone());
        error
    })?;
    let result = serde_json::from_value::<LoginStartResult>(value).map_err(|err| {
        let error = format!("failed to decode device code response: {err}");
        set_login_error(&app, state.inner(), error.clone());
        error
    })?;
    match result {
        LoginStartResult::ChatgptDeviceCode {
            login_id,
            verification_url,
            user_code,
        } => {
            update_login_pending_state(
                &app,
                state.inner(),
                Some(login_id.clone()),
                None,
                Some(DeviceCodeInfo {
                    login_id: login_id.clone(),
                    verification_url: verification_url.clone(),
                    user_code: user_code.clone(),
                }),
            );
            Ok(DeviceCodeLoginStart {
                login_id,
                verification_url,
                user_code,
            })
        }
        _ => {
            let error = "unexpected login response type".to_string();
            set_login_error(&app, state.inner(), error.clone());
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn cancel_login(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    login_id: String,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::CancelLogin,
        serde_json::json!({ "loginId": login_id }),
    )
    .await
    .map(|_| ())
    .map(|_| clear_login_state(&app, state.inner()))
    .map_err(|error| {
        set_login_error(&app, state.inner(), error.clone());
        error
    })
}

#[tauri::command]
pub async fn logout(app: AppHandle, state: State<'_, Arc<AuthBridgeState>>) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::Logout,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())
    .map(|_| clear_login_state(&app, state.inner()))
    .map_err(|error| {
        set_login_error(&app, state.inner(), error.clone());
        error
    })
}

#[tauri::command]
pub async fn read_config(
    state: State<'_, Arc<AuthBridgeState>>,
    cwd: Option<String>,
) -> Result<ConfigReadResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ConfigRead,
        serde_json::json!({
            "includeLayers": true,
            "cwd": cwd,
        }),
    )
    .await?;
    serde_json::from_value::<ConfigReadResponse>(value)
        .map_err(|err| format!("failed to decode config read response: {err}"))
}

#[tauri::command]
pub async fn write_config_value(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigValueWriteParams,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ConfigValueWrite,
        serde_json::json!({
            "keyPath": params.key_path,
            "value": params.value,
            "mergeStrategy": params.merge_strategy,
            "filePath": params.file_path,
            "expectedVersion": params.expected_version,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn batch_write_config_values(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigBatchWriteParams,
) -> Result<(), String> {
    let edits = params
        .edits
        .into_iter()
        .map(|edit| {
            serde_json::json!({
                "keyPath": edit.key_path,
                "value": edit.value,
                "mergeStrategy": edit.merge_strategy,
            })
        })
        .collect::<Vec<_>>();
    send_request(
        state.inner(),
        AppServerRequestKind::ConfigBatchWrite,
        serde_json::json!({
            "edits": edits,
            "filePath": params.file_path,
            "expectedVersion": params.expected_version,
            "reloadUserConfig": params.reload_user_config,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn set_personality(
    state: State<'_, Arc<AuthBridgeState>>,
    personality: Option<String>,
) -> Result<(), String> {
    let personality = normalize_runtime_personality(personality.as_deref())?;
    *state
        .current_personality
        .lock()
        .expect("current personality mutex poisoned") = personality;
    Ok(())
}

#[tauri::command]
pub async fn list_experimental_features(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ExperimentalFeature>, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ExperimentalFeatureList,
        serde_json::json!({
            "limit": 100,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ExperimentalFeatureListResponse>(value)
        .map_err(|err| format!("failed to decode experimental feature list response: {err}"))?;
    let _ = response.next_cursor;
    Ok(response.data)
}

#[tauri::command]
pub async fn set_experimental_feature_enablement(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ExperimentalFeatureEnablementSetParams,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ExperimentalFeatureEnablementSet,
        serde_json::json!({
            "enablement": params.enablement,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn reset_memories(state: State<'_, Arc<AuthBridgeState>>) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::MemoryReset,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn list_skills(
    state: State<'_, Arc<AuthBridgeState>>,
    params: SkillsListParams,
) -> Result<SkillsListResponse, String> {
    let mut cwds = Vec::new();
    if let Some(cwd) = params.cwd {
        cwds.push(cwd);
    }
    let value = send_request(
        state.inner(),
        AppServerRequestKind::SkillsList,
        serde_json::json!({
            "cwds": cwds,
            "forceReload": params.force_reload,
        }),
    )
    .await?;
    serde_json::from_value::<SkillsListResponse>(value)
        .map_err(|err| format!("failed to decode skills list response: {err}"))
}

#[tauri::command]
pub async fn list_apps(
    state: State<'_, Arc<AuthBridgeState>>,
    params: AppsListParams,
) -> Result<AppsListResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::AppsList,
        serde_json::json!({
            "cursor": params.cursor,
            "limit": params.limit,
            "threadId": params.thread_id,
            "forceRefetch": params.force_refetch,
        }),
    )
    .await?;
    serde_json::from_value::<AppsListResponse>(value)
        .map_err(|err| format!("failed to decode apps list response: {err}"))
}

#[tauri::command]
pub async fn list_plugins(
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginListParams,
) -> Result<PluginListResponse, String> {
    let cwds = params.cwd.map(|cwd| vec![cwd]);
    let value = send_request(
        state.inner(),
        AppServerRequestKind::PluginList,
        serde_json::json!({
            "cwds": cwds,
        }),
    )
    .await?;
    serde_json::from_value::<PluginListResponse>(value)
        .map_err(|err| format!("failed to decode plugin list response: {err}"))
}

#[tauri::command]
pub async fn read_plugin(
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginReadParams,
) -> Result<PluginReadResponse, String> {
    let PluginReadParams {
        marketplace_path,
        remote_marketplace_name,
        plugin_name,
    } = params;
    if marketplace_path.is_some() == remote_marketplace_name.is_some() {
        return Err(
            "plugin/read requires exactly one of marketplacePath or remoteMarketplaceName".into(),
        );
    }
    let value = send_request(
        state.inner(),
        AppServerRequestKind::PluginRead,
        serde_json::json!({
            "marketplacePath": marketplace_path,
            "remoteMarketplaceName": remote_marketplace_name,
            "pluginName": plugin_name,
        }),
    )
    .await?;
    serde_json::from_value::<PluginReadResponse>(value)
        .map_err(|err| format!("failed to decode plugin read response: {err}"))
}

#[tauri::command]
pub async fn install_plugin(
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginInstallParams,
) -> Result<PluginInstallResponse, String> {
    let PluginInstallParams {
        marketplace_path,
        remote_marketplace_name,
        plugin_name,
    } = params;
    if marketplace_path.is_some() == remote_marketplace_name.is_some() {
        return Err(
            "plugin/install requires exactly one of marketplacePath or remoteMarketplaceName"
                .into(),
        );
    }
    let value = send_request(
        state.inner(),
        AppServerRequestKind::PluginInstall,
        serde_json::json!({
            "marketplacePath": marketplace_path,
            "remoteMarketplaceName": remote_marketplace_name,
            "pluginName": plugin_name,
        }),
    )
    .await?;
    serde_json::from_value::<PluginInstallResponse>(value)
        .map_err(|err| format!("failed to decode plugin install response: {err}"))
}

#[tauri::command]
pub async fn uninstall_plugin(
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginUninstallParams,
) -> Result<PluginUninstallResponse, String> {
    send_request(
        state.inner(),
        AppServerRequestKind::PluginUninstall,
        serde_json::json!({
            "pluginId": params.plugin_id,
        }),
    )
    .await
    .map(|_| PluginUninstallResponse {})
}

#[tauri::command]
pub async fn list_mcp_server_status(
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerStatusListParams,
) -> Result<McpServerStatusListResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::McpServerStatusList,
        serde_json::json!({
            "cursor": params.cursor,
            "detail": params.detail,
            "limit": params.limit,
        }),
    )
    .await?;
    serde_json::from_value::<McpServerStatusListResponse>(value)
        .map_err(|err| format!("failed to decode MCP server status list response: {err}"))
}

#[tauri::command]
pub async fn login_mcp_server(
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerOauthLoginParams,
) -> Result<McpServerOauthLoginResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::McpServerOauthLogin,
        serde_json::json!({
            "name": params.name,
        }),
    )
    .await?;
    serde_json::from_value::<McpServerOauthLoginResponse>(value)
        .map_err(|err| format!("failed to decode MCP server oauth login response: {err}"))
}

#[tauri::command]
pub async fn reload_mcp_server_config(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ReloadMcpServerConfig,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn list_recent_threads(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads(state.inner(), false).await
}

#[tauri::command]
pub async fn list_archived_threads(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads(state.inner(), true).await
}

async fn list_threads(
    state: &Arc<AuthBridgeState>,
    archived: bool,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    let value = send_request(
        state,
        AppServerRequestKind::ThreadList,
        serde_json::json!({
            "archived": archived,
            "limit": 100,
            "sortKey": "updated_at",
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadListResponse>(value)
        .map_err(|err| format!("failed to decode thread list response: {err}"))?;
    let mut threads = response
        .data
        .into_iter()
        .map(|thread| ThreadHistoryEntry {
            id: thread.id,
            preview: thread.preview,
            created_at: thread.created_at,
            updated_at: thread.updated_at,
            cwd: thread.cwd,
            path: thread.path,
            name: thread.name,
        })
        .collect::<Vec<_>>();
    threads.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
    });
    Ok(threads)
}

#[tauri::command]
pub async fn start_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    cwd: Option<String>,
) -> Result<String, String> {
    start_thread_with_personality(state.inner(), cwd, state.current_personality()).await
}

#[tauri::command]
pub async fn fork_thread(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
) -> Result<String, String> {
    let source_thread_title = send_request(
        state.inner(),
        AppServerRequestKind::ThreadRead,
        serde_json::json!({
            "threadId": thread_id.clone(),
            "includeTurns": true,
        }),
    )
    .await
    .ok()
    .and_then(|value| serde_json::from_value::<ThreadReadResponse>(value).ok())
    .map(|response| resolved_thread_title(&response.thread))
    .filter(|value| !value.is_empty());
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadFork,
        serde_json::json!({
            "threadId": thread_id.clone(),
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread fork response: {err}"))?;
    let forked_thread_id = response.thread.id;
    let forked_turn_id = send_request(
        state.inner(),
        AppServerRequestKind::ThreadRead,
        serde_json::json!({
            "threadId": forked_thread_id.clone(),
            "includeTurns": true,
        }),
    )
    .await
    .ok()
    .and_then(|value| serde_json::from_value::<ThreadReadResponse>(value).ok())
    .and_then(|response| response.thread.turns.last().map(|turn| turn.id.clone()))
    .unwrap_or_else(|| format!("forked-from-conversation:{forked_thread_id}"));
    if let Ok(mut forked_from_conversations) = state.forked_from_conversations.lock() {
        forked_from_conversations.insert(
            forked_thread_id.clone(),
            ForkedFromConversationCacheEntry {
                turn_id: forked_turn_id.clone(),
                source_conversation_id: thread_id.clone(),
                source_conversation_title: source_thread_title.clone(),
            },
        );
    }
    if let Some(item) = build_forked_from_conversation_item(
        &forked_turn_id,
        format!("forked-from-conversation:{forked_thread_id}"),
        thread_id,
        source_thread_title,
    ) {
        let _ = app.emit(
            THREAD_EVENT,
            ThreadEventPayload::ThreadItemUpdated {
                thread_id: forked_thread_id.clone(),
                turn_id: forked_turn_id,
                phase: ThreadItemUpdatePhase::Completed,
                item,
            },
        );
    }
    Ok(forked_thread_id)
}

#[tauri::command]
pub async fn archive_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ThreadArchive,
        serde_json::json!({
            "threadId": thread_id,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn unarchive_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
) -> Result<String, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadUnarchive,
        serde_json::json!({
            "threadId": thread_id,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread unarchive response: {err}"))?;
    Ok(response.thread.id)
}

#[tauri::command]
pub async fn set_thread_name(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    name: Option<String>,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ThreadNameSet,
        serde_json::json!({
            "threadId": thread_id,
            "name": name,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn start_turn(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    text: String,
    cwd: Option<String>,
) -> Result<String, String> {
    start_turn_with_personality(
        state.inner(),
        thread_id,
        text,
        cwd,
        state.current_personality(),
    )
    .await
}

#[tauri::command]
pub async fn start_turn_with_input(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    input: Vec<serde_json::Value>,
    cwd: Option<String>,
) -> Result<String, String> {
    start_turn_with_input_and_personality(
        state.inner(),
        thread_id,
        serde_json::Value::Array(input),
        cwd,
        state.current_personality(),
    )
    .await
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StartReviewParams {
    pub thread_id: String,
    pub delivery: String,
}

#[tauri::command]
pub async fn start_review(
    state: State<'_, Arc<AuthBridgeState>>,
    params: StartReviewParams,
) -> Result<ReviewStartResult, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ReviewStart,
        serde_json::json!({
            "threadId": params.thread_id,
            "delivery": params.delivery,
            "target": {
                "type": "uncommittedChanges",
            },
        }),
    )
    .await?;
    let response = serde_json::from_value::<ReviewStartResponse>(value)
        .map_err(|err| format!("failed to decode review start response: {err}"))?;
    Ok(ReviewStartResult {
        turn_id: response.turn.id,
        review_thread_id: response.review_thread_id,
    })
}

#[tauri::command]
pub async fn steer_turn(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    turn_id: String,
    text: String,
) -> Result<String, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::TurnSteer,
        serde_json::json!({
            "threadId": thread_id,
            "input": [
                { "type": "text", "text": text }
            ],
            "expectedTurnId": turn_id,
        }),
    )
    .await?;
    let response = serde_json::from_value::<TurnSteerResponse>(value)
        .map_err(|err| format!("failed to decode turn steer response: {err}"))?;
    Ok(response.turn_id)
}

#[tauri::command]
pub async fn interrupt_turn(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    turn_id: String,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::TurnInterrupt,
        serde_json::json!({
            "threadId": thread_id,
            "turnId": turn_id,
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn respond_to_approval_request(
    state: State<'_, Arc<AuthBridgeState>>,
    request_id: JsonRpcId,
    decision: serde_json::Value,
) -> Result<(), String> {
    send_response(
        state.inner(),
        request_id,
        serde_json::json!({
            "decision": decision,
        }),
    )
    .await
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequestUserInputAnswerPayload {
    pub answers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequestUserInputResponsePayload {
    pub answers: HashMap<String, ToolRequestUserInputAnswerPayload>,
}

#[tauri::command]
pub async fn respond_to_tool_request_user_input(
    state: State<'_, Arc<AuthBridgeState>>,
    request_id: JsonRpcId,
    response: ToolRequestUserInputResponsePayload,
) -> Result<(), String> {
    let result = serde_json::to_value(response)
        .map_err(|err| format!("failed to encode request_user_input response: {err}"))?;
    send_response(state.inner(), request_id, result).await
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsRequestApprovalResponsePayload {
    pub permissions: PermissionProfilePayload,
    pub scope: String,
    pub strict_auto_review: Option<bool>,
}

#[tauri::command]
pub async fn respond_to_permissions_request_approval(
    state: State<'_, Arc<AuthBridgeState>>,
    request_id: JsonRpcId,
    response: PermissionsRequestApprovalResponsePayload,
) -> Result<(), String> {
    let result = serde_json::to_value(response)
        .map_err(|err| format!("failed to encode permissions approval response: {err}"))?;
    send_response(state.inner(), request_id, result).await
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerElicitationRequestResponsePayload {
    pub action: String,
    pub content: Option<serde_json::Value>,
    pub meta: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn respond_to_mcp_server_elicitation_request(
    state: State<'_, Arc<AuthBridgeState>>,
    request_id: JsonRpcId,
    response: McpServerElicitationRequestResponsePayload,
) -> Result<(), String> {
    let result = serde_json::json!({
        "action": response.action,
        "content": response.content,
        "_meta": response.meta,
    });
    send_response(state.inner(), request_id, result).await
}

#[tauri::command]
pub async fn read_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
) -> Result<ThreadConversation, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadRead,
        serde_json::json!({
            "threadId": thread_id,
            "includeTurns": true,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadReadResponse>(value)
        .map_err(|err| format!("failed to decode thread read response: {err}"))?;
    if let Some(latest_turn_id) = response.thread.turns.last().map(|turn| turn.id.clone()) {
        remember_latest_turn_id(state.inner(), &response.thread.id, &latest_turn_id);
    }
    map_thread_conversation(state.inner(), response.thread)
}

#[tauri::command]
pub async fn rollback_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    num_turns: u32,
) -> Result<ThreadConversation, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadRollback,
        serde_json::json!({
            "threadId": thread_id,
            "numTurns": num_turns,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadRollbackResponse>(value)
        .map_err(|err| format!("failed to decode thread rollback response: {err}"))?;
    if let Some(latest_turn_id) = response.thread.turns.last().map(|turn| turn.id.clone()) {
        remember_latest_turn_id(state.inner(), &response.thread.id, &latest_turn_id);
    }
    map_thread_conversation(state.inner(), response.thread)
}

fn map_thread_conversation(
    state: &Arc<AuthBridgeState>,
    thread: ThreadReadThread,
) -> Result<ThreadConversation, String> {
    let mut items = Vec::<ThreadConversationItem>::new();
    let mut turns = Vec::<ThreadConversationTurn>::new();
    let mut turn_timings = Vec::<ThreadConversationTurnTiming>::new();
    let turn_diffs = state
        .turn_diffs
        .lock()
        .map_err(|_| "failed to lock turn diff cache".to_string())?;
    let model_reroutes = state
        .model_reroutes
        .lock()
        .map_err(|_| "failed to lock model reroute cache".to_string())?;
    let automatic_approval_reviews = state
        .automatic_approval_reviews
        .lock()
        .map_err(|_| "failed to lock automatic approval review cache".to_string())?;
    let auto_review_interruption_warnings = state
        .auto_review_interruption_warnings
        .lock()
        .map_err(|_| "failed to lock auto-review interruption warning cache".to_string())?;
    let turn_errors = state
        .turn_errors
        .lock()
        .map_err(|_| "failed to lock turn error cache".to_string())?;
    let forked_from_conversations = state
        .forked_from_conversations
        .lock()
        .map_err(|_| "failed to lock forked conversation cache".to_string())?;
    for turn in thread.turns.iter() {
        let status = turn
            .status
            .clone()
            .unwrap_or_else(|| "completed".to_string());
        turns.push(ThreadConversationTurn {
            id: turn.id.clone(),
            status: status.clone(),
            input: map_turn_input(&turn.input),
        });
        turn_timings.push(ThreadConversationTurnTiming {
            turn_id: turn.id.clone(),
            status,
            turn_started_at_ms: seconds_to_milliseconds(turn.started_at),
            final_assistant_started_at_ms: seconds_to_milliseconds(turn.completed_at),
            first_turn_work_item_started_at_ms: None,
        });
        let context_compaction_completed = !matches!(
            turn.status.as_deref(),
            Some("inProgress") | Some("in_progress")
        );
        for item in turn
            .items
            .iter()
            .filter_map(|item| map_thread_item(&turn.id, item, Some(context_compaction_completed)))
        {
            if let Some(index) = items
                .iter()
                .position(|existing| thread_item_id(existing) == thread_item_id(&item))
            {
                items[index] = item;
            } else {
                items.push(item);
            }
        }
        if let Some(diff) = turn_diffs
            .get(&thread_turn_cache_key(&thread.id, &turn.id))
            .cloned()
        {
            let item = build_turn_diff_item(&turn.id, diff);
            if let Some(index) = items
                .iter()
                .position(|existing| thread_item_id(existing) == thread_item_id(&item))
            {
                items[index] = item;
            } else {
                items.push(item);
            }
        }
        if let Some(reroutes) = model_reroutes
            .get(&thread_turn_cache_key(&thread.id, &turn.id))
            .cloned()
        {
            for reroute in reroutes {
                let Some(item) = build_model_rerouted_item(
                    &turn.id,
                    reroute.id,
                    reroute.from_model,
                    reroute.to_model,
                    reroute.reason,
                ) else {
                    continue;
                };
                if let Some(index) = items
                    .iter()
                    .position(|existing| thread_item_id(existing) == thread_item_id(&item))
                {
                    items[index] = item;
                } else {
                    items.push(item);
                }
            }
        }
        if let Some(review_entries) = automatic_approval_reviews
            .get(&thread_turn_cache_key(&thread.id, &turn.id))
            .cloned()
        {
            for review_entry in review_entries {
                let Some(item) = build_automatic_approval_review_item(
                    &turn.id,
                    review_entry.id,
                    review_entry.status,
                    review_entry.risk_level,
                    review_entry.rationale,
                ) else {
                    continue;
                };
                if let Some(index) = items
                    .iter()
                    .position(|existing| thread_item_id(existing) == thread_item_id(&item))
                {
                    items[index] = item;
                } else {
                    items.push(item);
                }
            }
        }
        if let Some(warning_entries) = auto_review_interruption_warnings
            .get(&thread_turn_cache_key(&thread.id, &turn.id))
            .cloned()
        {
            for warning_entry in warning_entries {
                let item = build_auto_review_interruption_warning_item(&turn.id, warning_entry.id);
                if let Some(index) = items
                    .iter()
                    .position(|existing| thread_item_id(existing) == thread_item_id(&item))
                {
                    items[index] = item;
                } else {
                    items.push(item);
                }
            }
        }
        if let Some(error_entries) = turn_errors
            .get(&thread_turn_cache_key(&thread.id, &turn.id))
            .cloned()
        {
            for error_entry in error_entries {
                let item = if error_entry.will_retry {
                    build_stream_error_item(
                        &turn.id,
                        error_entry.id,
                        error_entry.content,
                        error_entry.additional_details,
                    )
                } else {
                    build_system_error_item(&turn.id, error_entry.id, error_entry.content)
                };
                let Some(item) = item else {
                    continue;
                };
                if let Some(index) = items
                    .iter()
                    .position(|existing| thread_item_id(existing) == thread_item_id(&item))
                {
                    items[index] = item;
                } else {
                    items.push(item);
                }
            }
        }
    }
    if let Some(forked_from_conversation) = forked_from_conversations.get(&thread.id) {
        if let Some(item) = build_forked_from_conversation_item(
            &forked_from_conversation.turn_id,
            format!("forked-from-conversation:{}", thread.id),
            forked_from_conversation.source_conversation_id.clone(),
            forked_from_conversation.source_conversation_title.clone(),
        ) {
            if let Some(index) = items
                .iter()
                .position(|existing| thread_item_id(existing) == thread_item_id(&item))
            {
                items[index] = item;
            } else {
                items.push(item);
            }
        }
    }
    let title = resolved_thread_title(&thread);
    let id = thread.id;
    let cwd = thread.cwd;
    Ok(ThreadConversation {
        id,
        title,
        cwd,
        turns,
        turn_timings,
        items,
    })
}

pub fn shared_state() -> Arc<AuthBridgeState> {
    Arc::new(AuthBridgeState::default())
}

pub async fn start_thread_with_personality(
    state: &Arc<AuthBridgeState>,
    cwd: Option<String>,
    personality: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    if let Some(cwd) = cwd {
        payload.insert("cwd".to_string(), serde_json::Value::String(cwd));
    }
    if let Some(personality) = personality {
        payload.insert(
            "personality".to_string(),
            serde_json::Value::String(personality),
        );
    }
    let value = send_request(
        state,
        AppServerRequestKind::ThreadStart,
        serde_json::Value::Object(payload),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread start response: {err}"))?;
    Ok(response.thread.id)
}

pub async fn start_turn_with_personality(
    state: &Arc<AuthBridgeState>,
    thread_id: String,
    text: String,
    cwd: Option<String>,
    personality: Option<String>,
) -> Result<String, String> {
    start_turn_with_input_and_personality(
        state,
        thread_id,
        serde_json::json!([{ "type": "text", "text": text }]),
        cwd,
        personality,
    )
    .await
}

pub async fn start_turn_with_input_and_personality(
    state: &Arc<AuthBridgeState>,
    thread_id: String,
    input: serde_json::Value,
    cwd: Option<String>,
    personality: Option<String>,
) -> Result<String, String> {
    let mut payload = serde_json::Map::new();
    payload.insert("threadId".to_string(), serde_json::Value::String(thread_id));
    payload.insert("input".to_string(), input);
    if let Some(cwd) = cwd {
        payload.insert("cwd".to_string(), serde_json::Value::String(cwd));
    }
    if let Some(personality) = personality {
        payload.insert(
            "personality".to_string(),
            serde_json::Value::String(personality),
        );
    }
    let value = send_request(
        state,
        AppServerRequestKind::TurnStart,
        serde_json::Value::Object(payload),
    )
    .await?;
    let response = serde_json::from_value::<TurnStartResponse>(value)
        .map_err(|err| format!("failed to decode turn start response: {err}"))?;
    Ok(response.turn.id)
}

pub async fn start(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Arc<AuthBridgeState>>().inner().clone();
    update_snapshot(&app, &state, AuthSnapshot::default());

    let mut child = Command::new("cmd")
        .args(["/c", "codex", "app-server", "--listen", "stdio://"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("failed to spawn app-server: {err}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "missing app-server stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "missing app-server stdout".to_string())?;

    let (request_tx, request_rx) = mpsc::unbounded_channel();
    *state
        .request_tx
        .lock()
        .expect("request channel mutex poisoned") = Some(request_tx);

    tokio::spawn(run_client(app, state, stdin, stdout, request_rx));
    Ok(())
}

async fn run_client(
    app: AppHandle,
    state: Arc<AuthBridgeState>,
    mut stdin: ChildStdin,
    stdout: ChildStdout,
    mut request_rx: mpsc::UnboundedReceiver<AppServerMessage>,
) {
    let mut next_request_id: i64 = 1;
    let mut pending = HashMap::<JsonRpcId, AppServerRequestKind>::new();
    let mut pending_result =
        HashMap::<JsonRpcId, oneshot::Sender<Result<serde_json::Value, String>>>::new();
    let mut pending_thread_items = HashMap::<String, ThreadConversationItem>::new();
    let mut lines = BufReader::new(stdout).lines();
    let mut initialized = false;

    if let Err(err) = write_json(
        &mut stdin,
        &serde_json::json!({
            "method": "initialize",
            "id": next_request_id,
            "params": {
                "clientInfo": {
                    "name": CLIENT_NAME,
                    "title": "Codex App Replica",
                    "version": CLIENT_VERSION
                },
                "capabilities": {
                    "experimentalApi": true
                }
            }
        }),
    )
    .await
    {
        set_bridge_error(&app, &state, err);
        return;
    }
    pending.insert(
        JsonRpcId::Integer(next_request_id),
        AppServerRequestKind::AccountRead,
    );
    next_request_id += 1;

    loop {
        tokio::select! {
            maybe_message = request_rx.recv() => {
                let Some(message) = maybe_message else {
                    break;
                };
                match message {
                    AppServerMessage::Request(request) => {
                        let request_id = next_request_id;
                        next_request_id += 1;
                        let request_id_value = JsonRpcId::Integer(request_id);
                        let method = request_method(&request.kind);
                        let payload = serde_json::json!({
                            "method": method,
                            "id": request_id,
                            "params": request.payload,
                        });
                        if let Some(response_tx) = request.response_tx {
                            pending_result.insert(request_id_value.clone(), response_tx);
                        }
                        pending.insert(request_id_value.clone(), request.kind);
                        if let Err(err) = write_json(&mut stdin, &payload).await {
                            if let Some(response_tx) = pending_result.remove(&request_id_value) {
                                let _ = response_tx.send(Err(err.clone()));
                            }
                            pending.remove(&request_id_value);
                            set_bridge_error(&app, &state, err);
                            break;
                        }
                    }
                    AppServerMessage::Response(response) => {
                        let payload = serde_json::json!({
                            "id": response.request_id,
                            "result": response.result,
                        });
                        if let Err(err) = write_json(&mut stdin, &payload).await {
                            if let Some(response_tx) = response.response_tx {
                                let _ = response_tx.send(Err(err.clone()));
                            }
                            set_bridge_error(&app, &state, err);
                            break;
                        }
                        if let Some(response_tx) = response.response_tx {
                            let _ = response_tx.send(Ok(()));
                        }
                    }
                }
            }
            line = lines.next_line() => {
                let Ok(Some(line)) = line else {
                    break;
                };
                if line.trim().is_empty() {
                    continue;
                }
                let Ok(message) = serde_json::from_str::<JsonRpcMessage>(&line) else {
                    continue;
                };
                match message {
                    JsonRpcMessage::Response { id, result, error } => {
                        let kind = pending.remove(&id);
                        if id == JsonRpcId::Integer(1) && !initialized {
                            initialized = true;
                            *state.is_ready.lock().expect("ready mutex poisoned") = true;
                            let _ = write_json(&mut stdin, &serde_json::json!({"method":"initialized","params":{}})).await;
                            queue_account_read(&mut stdin, &mut next_request_id, &mut pending).await;
                            continue;
                        }
                        if let Some(response_tx) = pending_result.remove(&id) {
                            match (&result, &error) {
                                (Some(value), None) => {
                                    let _ = response_tx.send(Ok(value.clone()));
                                }
                                (_, Some(err)) => {
                                    let _ = response_tx.send(Err(err.message.clone()));
                                }
                                _ => {
                                    let _ = response_tx.send(Err("empty response".to_string()));
                                }
                            }
                        }
                        if let Some(AppServerRequestKind::AccountRead) = kind {
                            match (result, error) {
                                (Some(value), None) => {
                                    if let Ok(response) = serde_json::from_value::<AccountReadResponse>(value) {
                                        let mut snapshot = state.snapshot.lock().expect("snapshot mutex poisoned").clone();
                                        snapshot.is_loading = false;
                                        snapshot.auth_state = map_account(response);
                                        update_snapshot(&app, &state, snapshot);
                                    }
                                }
                                (_, Some(err)) => {
                                    set_bridge_error(&app, &state, err.message);
                                }
                                _ => {}
                            }
                        }
                    }
                    JsonRpcMessage::Request { id, method, params } => {
                        match method.as_str() {
                            "item/commandExecution/requestApproval" => {
                                handle_command_approval_request(&app, id, params);
                            }
                            "item/fileChange/requestApproval" => {
                                handle_file_change_approval_request(
                                    &app,
                                    id,
                                    params,
                                    &pending_thread_items,
                                );
                            }
                            "item/permissions/requestApproval" => {
                                handle_permissions_request_approval_request(&app, id, params);
                            }
                            "mcpServer/elicitation/request" => {
                                handle_mcp_server_elicitation_request(&app, id, params);
                            }
                            "item/tool/requestUserInput" => {
                                handle_tool_request_user_input_request(&app, id, params);
                            }
                            _ => {}
                        }
                    }
                    JsonRpcMessage::Notification { method, params } => {
                        match method.as_str() {
                            "account/updated" => {
                                queue_account_read(&mut stdin, &mut next_request_id, &mut pending).await;
                            }
                            "account/login/completed" => {
                                handle_login_completed(&app, &state, params);
                                queue_account_read(&mut stdin, &mut next_request_id, &mut pending).await;
                            }
                            "mcpServer/oauthLogin/completed" => {
                                handle_mcp_oauth_login_completed(&app, params);
                            }
                            "app/list/updated" => {
                                handle_apps_list_updated(&app, params);
                            }
                            "mcpServer/startupStatus/updated" => {}
                            "turn/started" => {
                                remember_latest_turn_from_notification(&state, &params);
                            }
                            "item/started" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_item_started(&app, params, &mut pending_thread_items);
                            }
                            "item/completed" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_item_completed(&app, params, &mut pending_thread_items);
                            }
                            "hook/started" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_hook_notification(
                                    &app,
                                    params,
                                    ThreadItemUpdatePhase::Started,
                                );
                            }
                            "hook/completed" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_hook_notification(
                                    &app,
                                    params,
                                    ThreadItemUpdatePhase::Completed,
                                );
                            }
                            "item/agentMessage/delta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_agent_message_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/plan/delta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_plan_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/reasoning/summaryPartAdded" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_reasoning_summary_part_added(
                                    &app,
                                    params,
                                    &mut pending_thread_items,
                                );
                            }
                            "item/reasoning/summaryTextDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_reasoning_summary_text_delta(
                                    &app,
                                    params,
                                    &mut pending_thread_items,
                                );
                            }
                            "item/reasoning/textDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_reasoning_text_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/commandExecution/outputDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_command_execution_output_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/fileChange/patchUpdated" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_file_change_patch_updated(&app, params, &mut pending_thread_items);
                            }
                            "serverRequest/resolved" => {
                                handle_server_request_resolved(&app, params);
                            }
                            "turn/plan/updated" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_turn_plan_updated(&app, params);
                            }
                            "turn/diff/updated" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_turn_diff_updated(&app, &state, params);
                            }
                            "model/rerouted" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_model_rerouted(&app, &state, params);
                            }
                            "turn/completed" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_turn_completed(&app, params);
                            }
                            "item/autoApprovalReview/started"
                            | "item/autoApprovalReview/completed" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_automatic_approval_review_notification(&app, &state, params);
                            }
                            "guardianWarning" => {
                                handle_guardian_warning_notification(&app, &state, params);
                            }
                            "error" => {
                                remember_latest_turn_from_notification(&state, &params);
                                handle_error_notification(&app, &state, params);
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }
}

async fn queue_account_read(
    stdin: &mut ChildStdin,
    next_request_id: &mut i64,
    pending: &mut HashMap<JsonRpcId, AppServerRequestKind>,
) {
    let request_id = *next_request_id;
    *next_request_id += 1;
    pending.insert(
        JsonRpcId::Integer(request_id),
        AppServerRequestKind::AccountRead,
    );
    let _ = write_json(
        stdin,
        &serde_json::json!({
            "method": "account/read",
            "id": request_id,
            "params": { "refreshToken": false }
        }),
    )
    .await;
}

fn handle_login_completed(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: serde_json::Value,
) {
    let Ok(notification) = serde_json::from_value::<LoginCompletedNotification>(params) else {
        return;
    };
    let mut snapshot = state
        .snapshot
        .lock()
        .expect("snapshot mutex poisoned")
        .clone();
    if notification.login_id.as_deref() != snapshot.active_login_id.as_deref() {
        return;
    }
    clear_pending_login_state(&mut snapshot);
    if notification.success {
        snapshot.last_login_error = None;
    } else if let Some(error) = notification.error {
        snapshot.last_login_error = Some(error);
    }
    update_snapshot(app, state, snapshot);
}

fn handle_mcp_oauth_login_completed(app: &AppHandle, params: serde_json::Value) {
    let Ok(notification) = serde_json::from_value::<McpOauthLoginCompletedNotification>(params)
    else {
        return;
    };
    let _ = app.emit(MCP_OAUTH_EVENT, notification);
}

fn handle_apps_list_updated(app: &AppHandle, params: serde_json::Value) {
    if let Ok(notification) = serde_json::from_value::<AppsListResponse>(serde_json::json!({
        "data": params.get("data").cloned().unwrap_or(serde_json::Value::Array(vec![])),
        "nextCursor": serde_json::Value::Null,
    })) {
        let _ = app.emit(APPS_LIST_UPDATED_EVENT, notification);
    }
}

fn request_method(kind: &AppServerRequestKind) -> &'static str {
    match kind {
        AppServerRequestKind::AccountRead => "account/read",
        AppServerRequestKind::AccountRateLimitsRead => "account/rateLimits/read",
        AppServerRequestKind::AccountSendAddCreditsNudgeEmail => "account/sendAddCreditsNudgeEmail",
        AppServerRequestKind::AppsList => "app/list",
        AppServerRequestKind::LoginApiKey => "account/login/start",
        AppServerRequestKind::LoginChatGpt => "account/login/start",
        AppServerRequestKind::LoginChatGptDeviceCode => "account/login/start",
        AppServerRequestKind::CancelLogin => "account/login/cancel",
        AppServerRequestKind::Logout => "account/logout",
        AppServerRequestKind::ConfigRead => "config/read",
        AppServerRequestKind::ConfigValueWrite => "config/value/write",
        AppServerRequestKind::ConfigBatchWrite => "config/batchWrite",
        AppServerRequestKind::ExperimentalFeatureList => "experimentalFeature/list",
        AppServerRequestKind::ExperimentalFeatureEnablementSet => {
            "experimentalFeature/enablement/set"
        }
        AppServerRequestKind::MemoryReset => "memory/reset",
        AppServerRequestKind::McpServerOauthLogin => "mcpServer/oauth/login",
        AppServerRequestKind::McpServerStatusList => "mcpServerStatus/list",
        AppServerRequestKind::ReloadMcpServerConfig => "config/mcpServer/reload",
        AppServerRequestKind::SkillsList => "skills/list",
        AppServerRequestKind::PluginList => "plugin/list",
        AppServerRequestKind::PluginRead => "plugin/read",
        AppServerRequestKind::PluginInstall => "plugin/install",
        AppServerRequestKind::PluginUninstall => "plugin/uninstall",
        AppServerRequestKind::ThreadList => "thread/list",
        AppServerRequestKind::ThreadStart => "thread/start",
        AppServerRequestKind::ThreadFork => "thread/fork",
        AppServerRequestKind::ThreadArchive => "thread/archive",
        AppServerRequestKind::ThreadUnarchive => "thread/unarchive",
        AppServerRequestKind::ThreadNameSet => "thread/name/set",
        AppServerRequestKind::ThreadRead => "thread/read",
        AppServerRequestKind::ThreadRollback => "thread/rollback",
        AppServerRequestKind::ReviewStart => "review/start",
        AppServerRequestKind::TurnStart => "turn/start",
        AppServerRequestKind::TurnSteer => "turn/steer",
        AppServerRequestKind::TurnInterrupt => "turn/interrupt",
    }
}

fn handle_item_started(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item) = params.get("item").cloned() else {
        return;
    };
    let Some(thread_item) = map_thread_item(turn_id, &item, Some(false)) else {
        return;
    };
    if matches!(
        thread_item,
        ThreadConversationItem::CommandExecution { .. } | ThreadConversationItem::FileChange { .. }
    ) {
        pending_thread_items.insert(
            thread_item_id(&thread_item).to_string(),
            thread_item.clone(),
        );
    }
    if matches!(thread_item, ThreadConversationItem::AgentMessage { .. }) {
        return;
    }
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Started,
            item: thread_item,
        },
    );
}

fn handle_item_completed(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item) = params.get("item").cloned() else {
        return;
    };
    let Some(thread_item) = map_thread_item(turn_id, &item, Some(true)) else {
        return;
    };
    if matches!(
        thread_item,
        ThreadConversationItem::CommandExecution { .. }
            | ThreadConversationItem::FileChange { .. }
            | ThreadConversationItem::Plan { .. }
            | ThreadConversationItem::Reasoning { .. }
    ) {
        pending_thread_items.remove(thread_item_id(&thread_item));
    }
    if matches!(thread_item, ThreadConversationItem::AgentMessage { .. }) {
        pending_thread_items.remove(thread_item_id(&thread_item));
    }
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: thread_item,
        },
    );
}

fn handle_hook_notification(
    app: &AppHandle,
    params: serde_json::Value,
    phase: ThreadItemUpdatePhase,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(run) = params.get("run") else {
        return;
    };
    let Some(item) = build_hook_item(turn_id, run) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase,
            item,
        },
    );
}

fn handle_agent_message_delta(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let item = pending_thread_items
        .entry(item_id.to_string())
        .or_insert_with(|| ThreadConversationItem::AgentMessage {
            id: item_id.to_string(),
            turn_id: turn_id.to_string(),
            role: "assistant".to_string(),
            text: String::new(),
            completed: false,
        });
    let Some(updated_item) = append_agent_message_delta(item, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_reasoning_summary_part_added(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(summary_index) = params
        .get("summaryIndex")
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
    else {
        return;
    };
    let item = pending_thread_items
        .entry(item_id.to_string())
        .or_insert_with(|| ThreadConversationItem::Reasoning {
            id: item_id.to_string(),
            turn_id: turn_id.to_string(),
            summary: Vec::new(),
            content: Vec::new(),
        });
    let Some(updated_item) = ensure_reasoning_summary_part(item, summary_index) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_plan_delta(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let item = pending_thread_items
        .entry(item_id.to_string())
        .or_insert_with(|| ThreadConversationItem::Plan {
            id: item_id.to_string(),
            turn_id: turn_id.to_string(),
            text: String::new(),
        });
    let Some(updated_item) = append_plan_delta(item, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_reasoning_summary_text_delta(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(summary_index) = params
        .get("summaryIndex")
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
    else {
        return;
    };
    let item = pending_thread_items
        .entry(item_id.to_string())
        .or_insert_with(|| ThreadConversationItem::Reasoning {
            id: item_id.to_string(),
            turn_id: turn_id.to_string(),
            summary: Vec::new(),
            content: Vec::new(),
        });
    let Some(updated_item) = append_reasoning_summary_delta(item, summary_index, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_reasoning_text_delta(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(content_index) = params
        .get("contentIndex")
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
    else {
        return;
    };
    let item = pending_thread_items
        .entry(item_id.to_string())
        .or_insert_with(|| ThreadConversationItem::Reasoning {
            id: item_id.to_string(),
            turn_id: turn_id.to_string(),
            summary: Vec::new(),
            content: Vec::new(),
        });
    let Some(updated_item) = append_reasoning_content_delta(item, content_index, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_turn_completed(app: &AppHandle, params: serde_json::Value) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn) = params.get("turn") else {
        return;
    };
    let Some(turn_id) = turn.get("id").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(status) = turn.get("status").and_then(serde_json::Value::as_str) else {
        return;
    };
    let error = turn
        .get("error")
        .and_then(|value| value.get("message"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::TurnCompleted {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            status: status.to_string(),
            error,
        },
    );
}

fn remember_latest_turn_from_notification(
    state: &Arc<AuthBridgeState>,
    params: &serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let turn_id = params
        .get("turnId")
        .and_then(serde_json::Value::as_str)
        .or_else(|| {
            params
                .get("turn")
                .and_then(|turn| turn.get("id"))
                .and_then(serde_json::Value::as_str)
        });
    let Some(turn_id) = turn_id else {
        return;
    };
    remember_latest_turn_id(state, thread_id, turn_id);
}

fn remember_latest_turn_id(state: &Arc<AuthBridgeState>, thread_id: &str, turn_id: &str) {
    if let Ok(mut latest_turn_ids) = state.latest_turn_ids.lock() {
        latest_turn_ids.insert(thread_id.to_string(), turn_id.to_string());
    }
}

fn handle_automatic_approval_review_notification(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(review_id) = params.get("reviewId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(review) = params.get("review") else {
        return;
    };
    let Some(status) = review.get("status").and_then(serde_json::Value::as_str) else {
        return;
    };
    let item_id = format!("automatic-approval-review:{review_id}");
    let risk_level = review
        .get("riskLevel")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let rationale = review
        .get("rationale")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    if let Ok(mut automatic_approval_reviews) = state.automatic_approval_reviews.lock() {
        let review_entries = automatic_approval_reviews
            .entry(thread_turn_cache_key(thread_id, turn_id))
            .or_default();
        if let Some(existing) = review_entries.iter_mut().find(|entry| entry.id == item_id) {
            existing.status = status.to_string();
            existing.risk_level = risk_level.clone();
            existing.rationale = rationale.clone();
        } else {
            review_entries.push(AutomaticApprovalReviewCacheEntry {
                id: item_id.clone(),
                status: status.to_string(),
                risk_level: risk_level.clone(),
                rationale: rationale.clone(),
            });
        }
    }
    let Some(item) = build_automatic_approval_review_item(
        turn_id,
        item_id,
        status.to_string(),
        risk_level,
        rationale,
    ) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item,
        },
    );
}

fn handle_guardian_warning_notification(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let message = params
        .get("message")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    let warning_kind = params.get("kind").and_then(serde_json::Value::as_str);
    if warning_kind != Some("tooManyDenials")
        && !message.starts_with(AUTO_REVIEW_INTERRUPTION_WARNING_MESSAGE_PREFIX)
    {
        return;
    }
    let turn_id = state
        .latest_turn_ids
        .lock()
        .ok()
        .and_then(|latest_turn_ids| latest_turn_ids.get(thread_id).cloned());
    let Some(turn_id) = turn_id else {
        return;
    };
    let item_id = format!("auto-review-interruption-warning:{turn_id}");
    if let Ok(mut auto_review_interruption_warnings) =
        state.auto_review_interruption_warnings.lock()
    {
        let warning_entries = auto_review_interruption_warnings
            .entry(thread_turn_cache_key(thread_id, &turn_id))
            .or_default();
        if !warning_entries.iter().any(|entry| entry.id == item_id) {
            warning_entries.push(AutoReviewInterruptionWarningCacheEntry {
                id: item_id.clone(),
            });
        }
    }
    let item = build_auto_review_interruption_warning_item(&turn_id, item_id);
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id,
            phase: ThreadItemUpdatePhase::Completed,
            item,
        },
    );
}

fn handle_error_notification(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(error) = params.get("error") else {
        return;
    };
    let Some(content) = error.get("message").and_then(serde_json::Value::as_str) else {
        return;
    };
    let additional_details = error
        .get("additionalDetails")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let will_retry = params
        .get("willRetry")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let mut item_id = format!(
        "{}:{turn_id}:0",
        if will_retry {
            "stream-error"
        } else {
            "system-error"
        }
    );
    if let Ok(mut turn_errors) = state.turn_errors.lock() {
        let error_entries = turn_errors
            .entry(thread_turn_cache_key(thread_id, turn_id))
            .or_default();
        if let Some(existing) = error_entries.iter().find(|entry| {
            entry.content == content
                && entry.additional_details.as_deref() == additional_details.as_deref()
                && entry.will_retry == will_retry
        }) {
            item_id = existing.id.clone();
        } else {
            item_id = format!(
                "{}:{turn_id}:{}",
                if will_retry {
                    "stream-error"
                } else {
                    "system-error"
                },
                error_entries.len()
            );
            error_entries.push(TurnErrorCacheEntry {
                id: item_id.clone(),
                content: content.to_string(),
                additional_details: additional_details.clone(),
                will_retry,
            });
        }
    }
    let item = if will_retry {
        build_stream_error_item(turn_id, item_id, content.to_string(), additional_details)
    } else {
        build_system_error_item(turn_id, item_id, content.to_string())
    };
    let Some(item) = item else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item,
        },
    );
}

fn handle_turn_plan_updated(app: &AppHandle, params: serde_json::Value) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let explanation = params
        .get("explanation")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let plan = params
        .get("plan")
        .and_then(serde_json::Value::as_array)
        .map(|plan| {
            plan.iter()
                .filter_map(map_todo_list_step)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let Some(item) = build_todo_list_item(turn_id, explanation, plan) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item,
        },
    );
}

fn handle_turn_diff_updated(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(diff) = params.get("diff").and_then(serde_json::Value::as_str) else {
        return;
    };
    if let Ok(mut turn_diffs) = state.turn_diffs.lock() {
        turn_diffs.insert(thread_turn_cache_key(thread_id, turn_id), diff.to_string());
    }
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: build_turn_diff_item(turn_id, diff.to_string()),
        },
    );
}

fn handle_model_rerouted(app: &AppHandle, state: &Arc<AuthBridgeState>, params: serde_json::Value) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(from_model) = params.get("fromModel").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(to_model) = params.get("toModel").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(reason) = params.get("reason").and_then(serde_json::Value::as_str) else {
        return;
    };
    let mut item_id = format!("model-rerouted:{turn_id}:0");
    if let Ok(mut model_reroutes) = state.model_reroutes.lock() {
        let reroutes = model_reroutes
            .entry(thread_turn_cache_key(thread_id, turn_id))
            .or_default();
        if let Some(existing) = reroutes.iter().find(|entry| {
            entry.from_model == from_model && entry.to_model == to_model && entry.reason == reason
        }) {
            item_id = existing.id.clone();
        } else {
            item_id = format!("model-rerouted:{turn_id}:{}", reroutes.len());
            reroutes.push(ModelReroutedCacheEntry {
                id: item_id.clone(),
                from_model: from_model.to_string(),
                to_model: to_model.to_string(),
                reason: reason.to_string(),
            });
        }
    }
    let Some(item) = build_model_rerouted_item(
        turn_id,
        item_id,
        from_model.to_string(),
        to_model.to_string(),
        reason.to_string(),
    ) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item,
        },
    );
}

fn handle_command_execution_output_delta(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item) = pending_thread_items.get_mut(item_id) else {
        return;
    };
    let Some(updated_item) = append_command_execution_output_delta(item, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_file_change_patch_updated(
    app: &AppHandle,
    params: serde_json::Value,
    pending_thread_items: &mut HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(changes) = params.get("changes").and_then(serde_json::Value::as_array) else {
        return;
    };
    let Some(item) = pending_thread_items.get_mut(item_id) else {
        return;
    };
    let Some(updated_item) = replace_file_change_changes(
        item,
        changes
            .iter()
            .filter_map(map_file_change_summary)
            .collect::<Vec<_>>(),
    ) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            phase: ThreadItemUpdatePhase::Completed,
            item: updated_item,
        },
    );
}

fn handle_command_approval_request(
    app: &AppHandle,
    request_id: JsonRpcId,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let reason = params
        .get("reason")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let network_approval_context = params
        .get("networkApprovalContext")
        .and_then(map_network_approval_context_payload);
    let command = params
        .get("command")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let cwd = params
        .get("cwd")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let command_actions = params
        .get("commandActions")
        .and_then(serde_json::Value::as_array)
        .map(|actions| {
            actions
                .iter()
                .filter_map(map_command_action_payload)
                .collect::<Vec<_>>()
        })
        .filter(|actions| !actions.is_empty());
    let additional_permissions =
        map_optional_permission_profile_payload(params.get("additionalPermissions"));
    let proposed_execpolicy_amendment = params
        .get("proposedExecpolicyAmendment")
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|entries| !entries.is_empty());
    let proposed_network_policy_amendments = params
        .get("proposedNetworkPolicyAmendments")
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(map_network_policy_amendment_payload)
                .collect::<Vec<_>>()
        })
        .filter(|entries| !entries.is_empty());
    let available_decisions = params
        .get("availableDecisions")
        .and_then(serde_json::Value::as_array)
        .map(|decisions| {
            decisions
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|decisions| !decisions.is_empty());
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::CommandApprovalRequested {
            request_id,
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            item_id: item_id.to_string(),
            reason,
            network_approval_context,
            command,
            cwd,
            command_actions,
            additional_permissions,
            proposed_execpolicy_amendment,
            proposed_network_policy_amendments,
            available_decisions,
        },
    );
}

fn handle_file_change_approval_request(
    app: &AppHandle,
    request_id: JsonRpcId,
    params: serde_json::Value,
    pending_thread_items: &HashMap<String, ThreadConversationItem>,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let reason = params
        .get("reason")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let grant_root = params
        .get("grantRoot")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let changes = pending_thread_items
        .get(item_id)
        .and_then(|item| match item {
            ThreadConversationItem::FileChange { changes, .. } => Some(changes.clone()),
            _ => None,
        })
        .unwrap_or_default();
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::FileChangeApprovalRequested {
            request_id,
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            item_id: item_id.to_string(),
            reason,
            grant_root,
            changes,
        },
    );
}

fn handle_server_request_resolved(app: &AppHandle, params: serde_json::Value) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(request_id) = params
        .get("requestId")
        .cloned()
        .and_then(|value| serde_json::from_value::<JsonRpcId>(value).ok())
    else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ServerRequestResolved {
            request_id,
            thread_id: thread_id.to_string(),
        },
    );
}

fn thread_turn_cache_key(thread_id: &str, turn_id: &str) -> String {
    format!("{thread_id}:{turn_id}")
}

fn handle_tool_request_user_input_request(
    app: &AppHandle,
    request_id: JsonRpcId,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let questions = params
        .get("questions")
        .and_then(serde_json::Value::as_array)
        .map(|questions| {
            questions
                .iter()
                .filter_map(map_tool_request_user_input_question)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ToolRequestUserInputRequested {
            request_id,
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            item_id: item_id.to_string(),
            questions,
        },
    );
}

fn handle_permissions_request_approval_request(
    app: &AppHandle,
    request_id: JsonRpcId,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(turn_id) = params.get("turnId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(item_id) = params.get("itemId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(cwd) = params.get("cwd").and_then(serde_json::Value::as_str) else {
        return;
    };
    let reason = params
        .get("reason")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let permissions = map_permission_profile_payload(params.get("permissions"));
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::PermissionsRequestApprovalRequested {
            request_id,
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
            item_id: item_id.to_string(),
            cwd: cwd.to_string(),
            reason,
            permissions,
        },
    );
}

fn handle_mcp_server_elicitation_request(
    app: &AppHandle,
    request_id: JsonRpcId,
    params: serde_json::Value,
) {
    let Some(thread_id) = params.get("threadId").and_then(serde_json::Value::as_str) else {
        return;
    };
    let turn_id = params
        .get("turnId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let Some(server_name) = params.get("serverName").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(request) = map_mcp_server_elicitation_request_payload(&params) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::McpServerElicitationRequested {
            request_id,
            thread_id: thread_id.to_string(),
            turn_id,
            server_name: server_name.to_string(),
            request,
        },
    );
}

fn map_tool_request_user_input_question(
    value: &serde_json::Value,
) -> Option<ToolRequestUserInputQuestionPayload> {
    Some(ToolRequestUserInputQuestionPayload {
        id: value.get("id")?.as_str()?.to_string(),
        header: value
            .get("header")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        question: value
            .get("question")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        is_other: value
            .get("isOther")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        is_secret: value
            .get("isSecret")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        options: value
            .get("options")
            .and_then(serde_json::Value::as_array)
            .map(|options| {
                options
                    .iter()
                    .filter_map(map_tool_request_user_input_option)
                    .collect::<Vec<_>>()
            }),
    })
}

fn map_tool_request_user_input_option(
    value: &serde_json::Value,
) -> Option<ToolRequestUserInputOptionPayload> {
    Some(ToolRequestUserInputOptionPayload {
        label: value.get("label")?.as_str()?.to_string(),
        description: value
            .get("description")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

fn map_permission_profile_payload(value: Option<&serde_json::Value>) -> PermissionProfilePayload {
    let network =
        value
            .and_then(|value| value.get("network"))
            .map(|network| NetworkPermissionPayload {
                enabled: network.get("enabled").and_then(serde_json::Value::as_bool),
            });
    let file_system = value
        .and_then(|value| value.get("fileSystem"))
        .map(|file_system| FileSystemPermissionPayload {
            read: file_system
                .get("read")
                .and_then(serde_json::Value::as_array)
                .map(|paths| {
                    paths
                        .iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .filter(|paths| !paths.is_empty()),
            write: file_system
                .get("write")
                .and_then(serde_json::Value::as_array)
                .map(|paths| {
                    paths
                        .iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .filter(|paths| !paths.is_empty()),
            entries: file_system
                .get("entries")
                .and_then(serde_json::Value::as_array)
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(map_file_system_entry_payload)
                        .collect::<Vec<_>>()
                })
                .filter(|entries| !entries.is_empty()),
        });
    PermissionProfilePayload {
        network,
        file_system,
    }
}

fn map_optional_permission_profile_payload(
    value: Option<&serde_json::Value>,
) -> Option<PermissionProfilePayload> {
    let payload = map_permission_profile_payload(value);
    if payload.network.is_none() && payload.file_system.is_none() {
        return None;
    }
    Some(payload)
}

fn map_file_system_entry_payload(value: &serde_json::Value) -> Option<FileSystemEntryPayload> {
    let access = value.get("access")?.as_str()?.to_string();
    let path = value
        .get("path")
        .and_then(
            |path| match path.get("type").and_then(serde_json::Value::as_str) {
                Some("path") => path.get("path").and_then(serde_json::Value::as_str),
                Some("glob_pattern") => path.get("pattern").and_then(serde_json::Value::as_str),
                Some("special") => Some("special"),
                _ => None,
            },
        )?
        .to_string();
    Some(FileSystemEntryPayload { path, access })
}

fn map_mcp_server_elicitation_request_payload(
    value: &serde_json::Value,
) -> Option<McpServerElicitationRequestPayload> {
    match value.get("mode")?.as_str()? {
        "form" => Some(McpServerElicitationRequestPayload::Form {
            message: value.get("message")?.as_str()?.to_string(),
            meta: value.get("_meta").cloned(),
            requested_schema: value.get("requestedSchema")?.clone(),
        }),
        "url" => Some(McpServerElicitationRequestPayload::Url {
            message: value.get("message")?.as_str()?.to_string(),
            meta: value.get("_meta").cloned(),
            url: value.get("url")?.as_str()?.to_string(),
            elicitation_id: value.get("elicitationId")?.as_str()?.to_string(),
        }),
        _ => None,
    }
}

fn map_network_approval_context_payload(
    value: &serde_json::Value,
) -> Option<NetworkApprovalContextPayload> {
    Some(NetworkApprovalContextPayload {
        host: value.get("host")?.as_str()?.to_string(),
        protocol: value.get("protocol")?.as_str()?.to_string(),
    })
}

fn map_network_policy_amendment_payload(
    value: &serde_json::Value,
) -> Option<NetworkPolicyAmendmentPayload> {
    Some(NetworkPolicyAmendmentPayload {
        host: value.get("host")?.as_str()?.to_string(),
        action: value.get("action")?.as_str()?.to_string(),
    })
}

fn map_command_action_payload(value: &serde_json::Value) -> Option<CommandActionPayload> {
    match value.get("type")?.as_str()? {
        "read" => Some(CommandActionPayload::Read {
            command: value.get("command")?.as_str()?.to_string(),
            name: value.get("name")?.as_str()?.to_string(),
            path: value.get("path")?.as_str()?.to_string(),
        }),
        "listFiles" => Some(CommandActionPayload::ListFiles {
            command: value.get("command")?.as_str()?.to_string(),
            path: value
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
        }),
        "search" => Some(CommandActionPayload::Search {
            command: value.get("command")?.as_str()?.to_string(),
            query: value
                .get("query")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
            path: value
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
        }),
        "unknown" => Some(CommandActionPayload::Unknown {
            command: value.get("command")?.as_str()?.to_string(),
        }),
        _ => None,
    }
}

fn map_account(response: AccountReadResponse) -> AuthState {
    let mut state = AuthState {
        requires_auth: response.requires_openai_auth,
        ..AuthState::default()
    };

    if let Some(account) = response.account {
        let auth_method = match account.account_type.as_str() {
            "apiKey" => "apikey".to_string(),
            "chatgpt" => "chatgpt".to_string(),
            other => other.to_string(),
        };
        state.open_ai_auth = Some(auth_method.clone());
        state.auth_method = Some(auth_method);
        state.email = account.email;
        state.plan_at_login = account.plan_type;
    }

    state
}

fn update_snapshot(app: &AppHandle, state: &Arc<AuthBridgeState>, snapshot: AuthSnapshot) {
    *state.snapshot.lock().expect("snapshot mutex poisoned") = snapshot.clone();
    let _ = app.emit(AUTH_EVENT, snapshot);
}

fn update_login_pending_state(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    active_login_id: Option<String>,
    browser_auth_url: Option<String>,
    device_code: Option<DeviceCodeInfo>,
) {
    with_snapshot_mutation(app, state, |snapshot| {
        snapshot.is_loading = false;
        snapshot.active_login_id = active_login_id;
        snapshot.browser_auth_url = browser_auth_url;
        snapshot.device_code = device_code;
        snapshot.last_login_error = None;
    });
}

fn clear_login_state(app: &AppHandle, state: &Arc<AuthBridgeState>) {
    with_snapshot_mutation(app, state, |snapshot| {
        snapshot.is_loading = false;
        clear_pending_login_state(snapshot);
        snapshot.last_login_error = None;
    });
}

fn clear_login_error(app: &AppHandle, state: &Arc<AuthBridgeState>) {
    with_snapshot_mutation(app, state, |snapshot| {
        snapshot.last_login_error = None;
    });
}

fn set_login_error(app: &AppHandle, state: &Arc<AuthBridgeState>, error: String) {
    with_snapshot_mutation(app, state, |snapshot| {
        snapshot.is_loading = false;
        clear_pending_login_state(snapshot);
        snapshot.last_login_error = Some(error);
    });
}

fn clear_pending_login_state(snapshot: &mut AuthSnapshot) {
    snapshot.active_login_id = None;
    snapshot.browser_auth_url = None;
    snapshot.device_code = None;
}

fn with_snapshot_mutation(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    update: impl FnOnce(&mut AuthSnapshot),
) {
    let mut snapshot = state
        .snapshot
        .lock()
        .expect("snapshot mutex poisoned")
        .clone();
    update(&mut snapshot);
    update_snapshot(app, state, snapshot);
}

fn set_bridge_error(app: &AppHandle, state: &Arc<AuthBridgeState>, error: String) {
    set_login_error(app, state, error);
}

async fn wait_for_request_sender(
    state: &Arc<AuthBridgeState>,
) -> Result<mpsc::UnboundedSender<AppServerMessage>, String> {
    for _ in 0..40 {
        let is_ready = *state.is_ready.lock().expect("ready mutex poisoned");
        let sender = state
            .request_tx
            .lock()
            .expect("request channel mutex poisoned")
            .clone();
        if is_ready {
            if let Some(sender) = sender {
                return Ok(sender);
            }
        }
        sleep(Duration::from_millis(50)).await;
    }
    Err("auth bridge is not ready".to_string())
}

async fn send_request(
    state: &Arc<AuthBridgeState>,
    kind: AppServerRequestKind,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let sender = wait_for_request_sender(state).await?;
    let (response_tx, response_rx) = oneshot::channel();
    sender
        .send(AppServerMessage::Request(AppServerRequest {
            kind,
            payload,
            response_tx: Some(response_tx),
        }))
        .map_err(|_| "auth bridge request channel closed".to_string())?;
    response_rx
        .await
        .map_err(|_| "auth bridge response channel closed".to_string())?
}

async fn send_response(
    state: &Arc<AuthBridgeState>,
    request_id: JsonRpcId,
    result: serde_json::Value,
) -> Result<(), String> {
    let sender = wait_for_request_sender(state).await?;
    let (response_tx, response_rx) = oneshot::channel();
    sender
        .send(AppServerMessage::Response(AppServerResponse {
            request_id,
            result,
            response_tx: Some(response_tx),
        }))
        .map_err(|_| "auth bridge request channel closed".to_string())?;
    response_rx
        .await
        .map_err(|_| "auth bridge response channel closed".to_string())?
}

async fn write_json(stdin: &mut ChildStdin, value: &serde_json::Value) -> Result<(), String> {
    let mut line = serde_json::to_vec(value).map_err(|err| err.to_string())?;
    line.push(b'\n');
    stdin
        .write_all(&line)
        .await
        .map_err(|err| format!("failed to write app-server json: {err}"))?;
    stdin
        .flush()
        .await
        .map_err(|err| format!("failed to flush app-server json: {err}"))
}
