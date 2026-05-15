use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex, Notify};
use tokio::time::{sleep, Duration};

use crate::app_state_snapshot::AppStateSnapshotState;
use crate::automation_run_history::archive_automation_run_history_for_thread;
use crate::automation_run_history::complete_automation_run_history_for_thread;
use crate::query_cache::emit_query_cache_invalidate;
use crate::remote_app_server_runtime;
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
const CODEX_APP_SERVER_INITIALIZED_EVENT: &str = "codex-app-server-initialized";
const CLIENT_NAME: &str = "codex-app-replica";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const LOCAL_HOST_ID: &str = "local";
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
    pub account_id: Option<String>,
    pub user_id: Option<String>,
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
pub struct HostScopedParams {
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ForkConversationFromLatestParams {
    pub conversation_id: String,
    pub cwd: Option<String>,
    pub developer_instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CodexAppServerInitializedNotification {
    host_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadHistoryEntry {
    pub id: String,
    pub preview: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: ThreadHistoryStatus,
    pub cwd: String,
    pub path: Option<String>,
    pub name: Option<String>,
    pub source: Option<ThreadHistorySource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadHistorySource {
    pub parent_thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadHistoryStatus {
    NotLoaded,
    Idle,
    SystemError,
    #[serde(rename_all = "camelCase")]
    Active {
        active_flags: Vec<ThreadHistoryActiveFlag>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThreadHistoryActiveFlag {
    WaitingOnApproval,
    WaitingOnUserInput,
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
pub struct ConfigReadForHostParams {
    pub host_id: Option<String>,
    pub cwd: Option<String>,
    #[serde(default)]
    pub include_layers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigRequirementsReadResponse {
    pub requirements: Option<ConfigRequirements>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigRequirements {
    pub allowed_approval_policies: Option<Vec<serde_json::Value>>,
    pub allowed_approvals_reviewers: Option<Vec<String>>,
    pub allowed_sandbox_modes: Option<Vec<String>>,
    pub allowed_web_search_modes: Option<Vec<String>>,
    pub feature_requirements: Option<HashMap<String, bool>>,
    pub enforce_residency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSnapshot {
    pub approval_policy: Option<serde_json::Value>,
    pub sandbox_mode: Option<String>,
    pub sandbox_workspace_write: Option<SandboxWorkspaceWrite>,
    pub approvals_reviewer: Option<String>,
    pub personality: Option<String>,
    pub model_personality: Option<String>,
    pub service_tier: Option<String>,
    pub memories: Option<MemoriesConfigSnapshot>,
    pub features: Option<HashMap<String, bool>>,
    pub apps: Option<serde_json::Value>,
    pub mcp_servers: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SandboxWorkspaceWrite {
    pub writable_roots: Option<Vec<String>>,
    #[serde(default)]
    pub exclude_slash_tmp: bool,
    #[serde(default)]
    pub exclude_tmpdir_env_var: bool,
    #[serde(default)]
    pub network_access: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TurnStartPermissionOverrides {
    pub approval_policy: Option<serde_json::Value>,
    pub approvals_reviewer: Option<String>,
    pub sandbox_policy: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartConversationParams {
    pub host_id: Option<String>,
    pub input: Option<Vec<serde_json::Value>>,
    pub text: Option<String>,
    pub cwd: Option<String>,
    pub workspace_roots: Option<Vec<String>>,
    pub collaboration_mode: Option<serde_json::Value>,
    pub projectless_output_directory: Option<String>,
    pub workspace_kind: Option<String>,
    pub approval_policy: Option<serde_json::Value>,
    pub approvals_reviewer: Option<String>,
    pub sandbox_policy: Option<serde_json::Value>,
    #[serde(default)]
    pub skip_auto_title_generation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MaybeResumeConversationParams {
    pub host_id: Option<String>,
    pub conversation_id: String,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    #[serde(default)]
    pub workspace_roots: Vec<String>,
    pub collaboration_mode: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendFollowUpMessageParams {
    pub conversation_id: String,
    pub prompt: String,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
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
    pub host_id: Option<String>,
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
pub struct ConfigBatchWriteForHostParams {
    pub host_id: Option<String>,
    #[serde(flatten)]
    pub write: ConfigBatchWriteParams,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyLoginParams {
    pub host_id: Option<String>,
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
    status: ThreadHistoryStatus,
    cwd: String,
    path: Option<String>,
    name: Option<String>,
    #[serde(default)]
    source: Option<serde_json::Value>,
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
struct ThreadResumeResponse {
    thread: ThreadReadThread,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribeThreadForHostParams {
    pub host_id: Option<String>,
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadUnsubscribeResponse {
    pub status: ThreadUnsubscribeStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThreadUnsubscribeStatus {
    NotLoaded,
    NotSubscribed,
    Unsubscribed,
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
    pub host_id: Option<String>,
    #[serde(default)]
    pub cwds: Vec<String>,
    pub cwd: Option<String>,
    #[serde(default)]
    pub force_reload: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListResponse {
    pub data: Vec<SkillsListEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillsConfigWriteParams {
    pub host_id: Option<String>,
    pub path: Option<String>,
    pub name: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillsConfigWriteResponse {
    pub effective_enabled: bool,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
pub struct HooksListParams {
    pub host_id: Option<String>,
    pub cwds: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HooksListResponse {
    pub data: Vec<HooksListEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HooksListEntry {
    pub cwd: String,
    pub hooks: Vec<HookMetadata>,
    pub warnings: Vec<String>,
    pub errors: Vec<HookLoadErrorInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HookMetadata {
    pub key: String,
    pub event_name: String,
    pub handler_type: String,
    pub matcher: Option<String>,
    pub command: Option<String>,
    pub timeout_sec: i64,
    pub status_message: Option<String>,
    pub source_path: String,
    pub source: String,
    pub plugin_id: Option<String>,
    pub display_order: i64,
    pub enabled: bool,
    pub is_managed: bool,
    pub current_hash: String,
    pub trust_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HookLoadErrorInfo {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppsListParams {
    pub host_id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelListParams {
    pub host_id: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelListResponse {
    pub data: Vec<ModelListEntry>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelListEntry {
    pub id: String,
    pub hidden: bool,
    #[serde(default)]
    pub additional_speed_tiers: Vec<String>,
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
    pub logo_url: Option<String>,
    #[serde(default)]
    pub logo_url_dark: Option<String>,
    #[serde(default)]
    pub is_accessible: bool,
    #[serde(default)]
    pub is_enabled: bool,
    #[serde(default)]
    pub plugin_display_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAddParams {
    pub host_id: Option<String>,
    pub source: String,
    pub ref_name: Option<String>,
    pub sparse_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAddResponse {
    pub marketplace_name: String,
    pub installed_root: String,
    pub already_added: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceRemoveParams {
    pub host_id: Option<String>,
    pub marketplace_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceRemoveResponse {
    pub marketplace_name: String,
    pub installed_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeParams {
    pub host_id: Option<String>,
    pub marketplace_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeResponse {
    pub selected_marketplaces: Vec<String>,
    pub upgraded_roots: Vec<String>,
    pub errors: Vec<MarketplaceUpgradeErrorInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUpgradeErrorInfo {
    pub marketplace_name: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginListParams {
    pub host_id: Option<String>,
    #[serde(default)]
    pub cwds: Vec<String>,
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
    pub host_id: Option<String>,
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
    pub hooks: Vec<PluginHookSummary>,
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
    pub interface: Option<SkillInterface>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginHookSummary {
    pub key: String,
    pub event_name: String,
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
    pub host_id: Option<String>,
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
    pub host_id: Option<String>,
    pub plugin_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginUninstallResponse {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareListParams {
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareListResponse {
    pub data: Vec<PluginShareListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareListItem {
    pub plugin: PluginSummary,
    pub share_url: String,
    pub local_plugin_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareSaveParams {
    pub host_id: Option<String>,
    pub plugin_path: String,
    pub remote_plugin_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareSaveResponse {
    pub remote_plugin_id: String,
    pub share_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareDeleteParams {
    pub host_id: Option<String>,
    pub remote_plugin_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareDeleteResponse {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveConversationParams {
    pub conversation_id: String,
    #[serde(default)]
    pub cleanup_worktree: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnarchiveConversationParams {
    pub host_id: Option<String>,
    pub conversation_id: String,
}

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
    #[serde(default)]
    pub share_context: Option<PluginShareContext>,
    pub source: PluginSource,
    pub installed: bool,
    pub enabled: bool,
    pub install_policy: PluginInstallPolicy,
    pub auth_policy: PluginAuthPolicy,
    #[serde(default)]
    pub availability: PluginAvailability,
    #[serde(default)]
    pub interface: Option<PluginInterface>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareContext {
    pub remote_plugin_id: String,
    pub share_url: Option<String>,
    pub creator_account_user_id: Option<String>,
    pub creator_name: Option<String>,
    pub share_targets: Option<Vec<PluginSharePrincipal>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginSharePrincipal {
    pub principal_type: PluginSharePrincipalType,
    pub principal_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PluginSharePrincipalType {
    #[serde(rename = "user")]
    User,
    #[serde(rename = "group")]
    Group,
    #[serde(rename = "workspace")]
    Workspace,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PluginInstallPolicy {
    #[serde(rename = "NOT_AVAILABLE")]
    NotAvailable,
    #[serde(rename = "AVAILABLE")]
    Available,
    #[serde(rename = "INSTALLED_BY_DEFAULT")]
    InstalledByDefault,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PluginAuthPolicy {
    #[serde(rename = "ON_INSTALL")]
    OnInstall,
    #[serde(rename = "ON_USE")]
    OnUse,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
pub enum PluginAvailability {
    #[serde(rename = "AVAILABLE", alias = "ENABLED")]
    #[default]
    Available,
    #[serde(rename = "DISABLED_BY_ADMIN")]
    DisabledByAdmin,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginSource {
    #[serde(rename_all = "camelCase")]
    Local {
        path: String,
    },
    #[serde(rename_all = "camelCase")]
    Git {
        url: String,
        path: Option<String>,
        ref_name: Option<String>,
        sha: Option<String>,
    },
    Remote,
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
    #[serde(default)]
    pub website_url: Option<String>,
    #[serde(default)]
    pub privacy_policy_url: Option<String>,
    #[serde(default)]
    pub terms_of_service_url: Option<String>,
    #[serde(default)]
    pub default_prompt: Option<Vec<String>>,
    #[serde(default)]
    pub brand_color: Option<String>,
    #[serde(default)]
    pub composer_icon: Option<String>,
    #[serde(default)]
    pub composer_icon_url: Option<String>,
    #[serde(default)]
    pub logo: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub screenshot_urls: Vec<String>,
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
    pub host_id: Option<String>,
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
    #[serde(default)]
    pub tools: HashMap<String, McpToolEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolEntry {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default)]
    pub annotations: Option<McpToolAnnotations>,
    #[serde(default, rename = "_meta")]
    pub meta: Option<McpToolMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolAnnotations {
    #[serde(default)]
    pub read_only_hint: bool,
    #[serde(default)]
    pub destructive_hint: bool,
    #[serde(default)]
    pub open_world_hint: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolMeta {
    #[serde(default, rename = "connector_id", alias = "connectorId")]
    pub connector_id: Option<String>,
    #[serde(default, rename = "_codex_apps")]
    pub codex_apps: Option<McpToolCodexAppsMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolCodexAppsMeta {
    #[serde(default, rename = "connector_id", alias = "connectorId")]
    pub connector_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadAppToolsParams {
    pub host_id: Option<String>,
    pub app_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadAppToolsResponse {
    pub tools: Vec<AppToolInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppToolInfo {
    pub name: String,
    pub description: String,
    pub access_badges: Vec<String>,
    pub visibility: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerOauthLoginParams {
    pub host_id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAppServerFeatureEnablementParams {
    pub feature_name: String,
    pub enabled: bool,
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
            account_id: None,
            user_id: None,
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
    app_server_process: AsyncMutex<Option<tokio::process::Child>>,
    app_server_generation: Mutex<u64>,
    app_server_lifecycle_lock: AsyncMutex<()>,
    current_personality: Mutex<Option<String>>,
    turn_diffs: Mutex<HashMap<String, String>>,
    model_reroutes: Mutex<HashMap<String, Vec<ModelReroutedCacheEntry>>>,
    automatic_approval_reviews: Mutex<HashMap<String, Vec<AutomaticApprovalReviewCacheEntry>>>,
    auto_review_interruption_warnings:
        Mutex<HashMap<String, Vec<AutoReviewInterruptionWarningCacheEntry>>>,
    latest_turn_ids: Mutex<HashMap<String, String>>,
    observed_turn_agent_messages: Mutex<HashMap<String, String>>,
    observed_turn_completions: Mutex<HashMap<String, ObservedTurnCompletion>>,
    observed_turn_completion_notify: Notify,
    turn_errors: Mutex<HashMap<String, Vec<TurnErrorCacheEntry>>>,
    forked_from_conversations: Mutex<HashMap<String, ForkedFromConversationCacheEntry>>,
    external_agent_import_completed_generation: Mutex<u64>,
    external_agent_import_completed_notify: Notify,
}

impl AuthBridgeState {
    pub fn current_personality(&self) -> Option<String> {
        self.current_personality
            .lock()
            .expect("current personality mutex poisoned")
            .clone()
    }
}

pub(crate) fn auth_snapshot(state: &Arc<AuthBridgeState>) -> AuthSnapshot {
    state
        .snapshot
        .lock()
        .expect("auth snapshot mutex poisoned")
        .clone()
}

pub(crate) struct ExternalAgentImportCompletedWaiter {
    state: Arc<AuthBridgeState>,
    seen_generation: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ObservedTurnCompletion {
    pub status: String,
    pub error: Option<String>,
}

impl ExternalAgentImportCompletedWaiter {
    pub async fn wait(self, timeout_duration: Duration) -> Result<(), String> {
        tokio::time::timeout(timeout_duration, async {
            loop {
                let notified = self.state.external_agent_import_completed_notify.notified();
                let generation = *self
                    .state
                    .external_agent_import_completed_generation
                    .lock()
                    .expect("external agent import generation mutex poisoned");
                if generation > self.seen_generation {
                    return Ok(());
                }
                notified.await;
            }
        })
        .await
        .map_err(|_| "Timed out waiting for external agent import completion".to_string())?
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
            app_server_process: AsyncMutex::new(None),
            app_server_generation: Mutex::new(0),
            app_server_lifecycle_lock: AsyncMutex::new(()),
            current_personality: Mutex::new(None),
            turn_diffs: Mutex::new(HashMap::new()),
            model_reroutes: Mutex::new(HashMap::new()),
            automatic_approval_reviews: Mutex::new(HashMap::new()),
            auto_review_interruption_warnings: Mutex::new(HashMap::new()),
            latest_turn_ids: Mutex::new(HashMap::new()),
            observed_turn_agent_messages: Mutex::new(HashMap::new()),
            observed_turn_completions: Mutex::new(HashMap::new()),
            observed_turn_completion_notify: Notify::new(),
            turn_errors: Mutex::new(HashMap::new()),
            forked_from_conversations: Mutex::new(HashMap::new()),
            external_agent_import_completed_generation: Mutex::new(0),
            external_agent_import_completed_notify: Notify::new(),
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
pub struct AccountInfoResponse {
    pub email: Option<String>,
    pub account_id: Option<String>,
    pub user_id: Option<String>,
    pub plan: Option<String>,
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
    host_id: Option<String>,
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

pub(crate) enum AppServerRequestKind {
    AccountRead,
    AccountRateLimitsRead,
    AccountSendAddCreditsNudgeEmail,
    AppsList,
    ModelsList,
    LoginApiKey,
    LoginChatGpt,
    LoginChatGptDeviceCode,
    CancelLogin,
    Logout,
    ConfigRead,
    ExternalAgentConfigDetect,
    ExternalAgentConfigImport,
    ConfigRequirementsRead,
    ConfigValueWrite,
    ConfigBatchWrite,
    ExperimentalFeatureList,
    ExperimentalFeatureEnablementSet,
    MemoryReset,
    McpServerOauthLogin,
    McpServerStatusList,
    ReloadMcpServerConfig,
    SkillsList,
    SkillsConfigWrite,
    HooksList,
    MarketplaceAdd,
    MarketplaceRemove,
    MarketplaceUpgrade,
    PluginList,
    PluginRead,
    PluginShareList,
    PluginShareSave,
    PluginShareDelete,
    PluginInstall,
    PluginUninstall,
    ThreadList,
    ThreadStart,
    ThreadFork,
    ThreadArchive,
    ThreadResume,
    ThreadUnsubscribe,
    ThreadUnarchive,
    ThreadNameSet,
    ThreadGoalSet,
    ThreadRead,
    ThreadRollback,
    ReviewStart,
    SendFollowUpMessage,
    TurnStart,
    TurnSteer,
    TurnInterrupt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetThreadGoalParams {
    pub thread_id: String,
    pub objective: String,
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

#[tauri::command(rename = "account-info")]
pub async fn read_account_info(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<AccountInfoResponse, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::AccountRead,
        serde_json::json!({
            "refreshToken": false,
        }),
    )
    .await?;
    let response = serde_json::from_value::<AccountReadResponse>(value)
        .map_err(|err| format!("failed to decode account info response: {err}"))?;
    Ok(map_account_info_response(response))
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
    ensure_supported_host_id(params.host_id.as_deref(), "login_api_key")?;
    login_api_key_inner(&app, state.inner(), params.api_key).await
}

#[tauri::command(rename = "login-with-api-key")]
pub async fn login_api_key_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ApiKeyLoginParams,
) -> Result<(), String> {
    ensure_supported_host_id(params.host_id.as_deref(), "login-with-api-key")?;
    login_api_key_inner(&app, state.inner(), params.api_key).await
}

#[tauri::command(rename = "login-with-api-key-for-host")]
pub async fn login_api_key_for_host_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ApiKeyLoginParams,
) -> Result<(), String> {
    ensure_supported_host_id(params.host_id.as_deref(), "login-with-api-key-for-host")?;
    login_api_key_inner(&app, state.inner(), params.api_key).await
}

async fn login_api_key_inner(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    api_key: String,
) -> Result<(), String> {
    clear_login_error(app, state);
    send_request(
        state,
        AppServerRequestKind::LoginApiKey,
        serde_json::json!({
            "type": "apiKey",
            "apiKey": api_key,
        }),
    )
    .await
    .map(|_| ())
    .map_err(|error| {
        set_login_error(app, state, error.clone());
        error
    })
}

#[tauri::command]
pub async fn login_chatgpt(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<ChatGptLoginStart, String> {
    login_chatgpt_inner(&app, state.inner()).await
}

#[tauri::command(rename = "login-with-chatgpt")]
pub async fn login_chatgpt_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<ChatGptLoginStart, String> {
    login_chatgpt_inner_for_host(&app, state.inner(), params.host_id.as_deref()).await
}

#[tauri::command(rename = "login-with-chatgpt-for-host")]
pub async fn login_chatgpt_for_host_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<ChatGptLoginStart, String> {
    login_chatgpt_inner_for_host(&app, state.inner(), params.host_id.as_deref()).await
}

async fn login_chatgpt_inner(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
) -> Result<ChatGptLoginStart, String> {
    clear_login_error(app, state);
    let value = send_request(
        state,
        AppServerRequestKind::LoginChatGpt,
        serde_json::json!({
            "type": "chatgpt",
        }),
    )
    .await
    .map_err(|error| {
        set_login_error(app, state, error.clone());
        error
    })?;
    let result = serde_json::from_value::<LoginStartResult>(value).map_err(|err| {
        let error = format!("failed to decode chatgpt login response: {err}");
        set_login_error(app, state, error.clone());
        error
    })?;
    match result {
        LoginStartResult::Chatgpt { login_id, auth_url } => {
            update_login_pending_state(
                app,
                state,
                Some(login_id.clone()),
                Some(auth_url.clone()),
                None,
            );
            Ok(ChatGptLoginStart { login_id, auth_url })
        }
        _ => {
            let error = "unexpected login response type".to_string();
            set_login_error(app, state, error.clone());
            Err(error)
        }
    }
}

async fn login_chatgpt_inner_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
) -> Result<ChatGptLoginStart, String> {
    if is_local_host_id(host_id) {
        return login_chatgpt_inner(app, state).await;
    }
    let host_id = remote_host_id(host_id).expect("remote host id should be present");
    let value = remote_app_server_runtime::send_request(
        app,
        host_id,
        request_method(&AppServerRequestKind::LoginChatGpt),
        serde_json::json!({
            "type": "chatgpt",
        }),
    )
    .await?;
    let result = serde_json::from_value::<LoginStartResult>(value)
        .map_err(|err| format!("failed to decode chatgpt login response: {err}"))?;
    match result {
        LoginStartResult::Chatgpt { login_id, auth_url } => {
            Ok(ChatGptLoginStart { login_id, auth_url })
        }
        _ => Err("unexpected login response type".to_string()),
    }
}

#[tauri::command]
pub async fn login_chatgpt_device_code(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<DeviceCodeLoginStart, String> {
    login_chatgpt_device_code_inner(&app, state.inner()).await
}

#[tauri::command(rename = "login-with-chatgpt-device-code")]
pub async fn login_chatgpt_device_code_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<DeviceCodeLoginStart, String> {
    login_chatgpt_device_code_inner_for_host(&app, state.inner(), params.host_id.as_deref()).await
}

async fn login_chatgpt_device_code_inner(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
) -> Result<DeviceCodeLoginStart, String> {
    clear_login_error(app, state);
    let value = send_request(
        state,
        AppServerRequestKind::LoginChatGptDeviceCode,
        serde_json::json!({
            "type": "chatgptDeviceCode",
        }),
    )
    .await
    .map_err(|error| {
        set_login_error(app, state, error.clone());
        error
    })?;
    let result = serde_json::from_value::<LoginStartResult>(value).map_err(|err| {
        let error = format!("failed to decode device code response: {err}");
        set_login_error(app, state, error.clone());
        error
    })?;
    match result {
        LoginStartResult::ChatgptDeviceCode {
            login_id,
            verification_url,
            user_code,
        } => {
            update_login_pending_state(
                app,
                state,
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
            set_login_error(app, state, error.clone());
            Err(error)
        }
    }
}

async fn login_chatgpt_device_code_inner_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
) -> Result<DeviceCodeLoginStart, String> {
    if is_local_host_id(host_id) {
        return login_chatgpt_device_code_inner(app, state).await;
    }
    let host_id = remote_host_id(host_id).expect("remote host id should be present");
    let value = remote_app_server_runtime::send_request(
        app,
        host_id,
        request_method(&AppServerRequestKind::LoginChatGptDeviceCode),
        serde_json::json!({
            "type": "chatgptDeviceCode",
        }),
    )
    .await?;
    let result = serde_json::from_value::<LoginStartResult>(value)
        .map_err(|err| format!("failed to decode device code response: {err}"))?;
    match result {
        LoginStartResult::ChatgptDeviceCode {
            login_id,
            verification_url,
            user_code,
        } => Ok(DeviceCodeLoginStart {
            login_id,
            verification_url,
            user_code,
        }),
        _ => Err("unexpected login response type".to_string()),
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
pub async fn logout(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: Option<HostScopedParams>,
) -> Result<(), String> {
    let host_id = params.as_ref().and_then(|params| params.host_id.as_deref());
    send_request_for_host(
        &app,
        state.inner(),
        host_id,
        AppServerRequestKind::Logout,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())?;
    if is_local_host_id(host_id) {
        clear_login_state(&app, state.inner());
    }
    Ok(())
}

#[tauri::command]
pub async fn read_config(
    state: State<'_, Arc<AuthBridgeState>>,
    cwd: Option<String>,
) -> Result<ConfigReadResponse, String> {
    read_config_inner(state.inner(), cwd, true).await
}

#[tauri::command(rename = "read-config-for-host")]
pub async fn read_config_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigReadForHostParams,
) -> Result<ConfigReadResponse, String> {
    read_config_inner_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        params.cwd,
        params.include_layers,
    )
    .await
}

#[tauri::command]
pub async fn write_config_value(
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigValueWriteParams,
) -> Result<(), String> {
    write_config_value_inner(state.inner(), params).await
}

#[tauri::command(rename = "write-config-value")]
pub async fn write_config_value_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigValueWriteParams,
) -> Result<(), String> {
    write_config_value_inner_for_host(&app, state.inner(), params).await
}

#[tauri::command(rename = "get-config-requirements-for-host")]
pub async fn get_config_requirements_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<ConfigRequirementsReadResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::ConfigRequirementsRead,
        serde_json::json!({}),
    )
    .await?;
    serde_json::from_value::<ConfigRequirementsReadResponse>(value)
        .map_err(|err| format!("failed to decode config requirements response: {err}"))
}

async fn read_config_inner(
    state: &Arc<AuthBridgeState>,
    cwd: Option<String>,
    include_layers: bool,
) -> Result<ConfigReadResponse, String> {
    let value = send_request(
        state,
        AppServerRequestKind::ConfigRead,
        serde_json::json!({
            "includeLayers": include_layers,
            "cwd": cwd,
        }),
    )
    .await?;
    serde_json::from_value::<ConfigReadResponse>(value)
        .map_err(|err| format!("failed to decode config read response: {err}"))
}

async fn read_config_inner_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    cwd: Option<String>,
    include_layers: bool,
) -> Result<ConfigReadResponse, String> {
    let value = send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::ConfigRead,
        serde_json::json!({
            "includeLayers": include_layers,
            "cwd": cwd,
        }),
    )
    .await?;
    serde_json::from_value::<ConfigReadResponse>(value)
        .map_err(|err| format!("failed to decode config read response: {err}"))
}

async fn write_config_value_inner(
    state: &Arc<AuthBridgeState>,
    params: ConfigValueWriteParams,
) -> Result<(), String> {
    send_request(
        state,
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

async fn write_config_value_inner_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: ConfigValueWriteParams,
) -> Result<(), String> {
    send_request_for_host(
        app,
        state,
        params.host_id.as_deref(),
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
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigBatchWriteParams,
) -> Result<(), String> {
    batch_write_config_values_inner(&app, state.inner(), params).await
}

#[tauri::command(rename = "batch-write-config-value")]
pub async fn batch_write_config_value_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ConfigBatchWriteForHostParams,
) -> Result<(), String> {
    batch_write_config_values_inner_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        params.write,
    )
    .await
}

async fn batch_write_config_values_inner(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    params: ConfigBatchWriteParams,
) -> Result<(), String> {
    let query_cache_invalidations = params
        .edits
        .iter()
        .filter_map(|edit| query_cache_invalidation_root(&edit.key_path))
        .map(str::to_string)
        .collect::<std::collections::BTreeSet<_>>();
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
        state,
        AppServerRequestKind::ConfigBatchWrite,
        serde_json::json!({
            "edits": edits,
            "filePath": params.file_path,
            "expectedVersion": params.expected_version,
            "reloadUserConfig": params.reload_user_config,
        }),
    )
    .await
    .map(|_| ())?;

    for root in query_cache_invalidations {
        emit_query_cache_invalidate(app, vec![serde_json::Value::String(root)]);
    }
    Ok(())
}

async fn batch_write_config_values_inner_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    params: ConfigBatchWriteParams,
) -> Result<(), String> {
    let query_cache_invalidations = params
        .edits
        .iter()
        .filter_map(|edit| query_cache_invalidation_root(&edit.key_path))
        .map(str::to_string)
        .collect::<std::collections::BTreeSet<_>>();
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
    send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::ConfigBatchWrite,
        serde_json::json!({
            "edits": edits,
            "filePath": params.file_path,
            "expectedVersion": params.expected_version,
            "reloadUserConfig": params.reload_user_config,
        }),
    )
    .await
    .map(|_| ())?;

    for root in query_cache_invalidations {
        emit_query_cache_invalidate(app, vec![serde_json::Value::String(root)]);
    }
    Ok(())
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

#[tauri::command(rename = "list-experimental-features-for-host")]
pub async fn list_experimental_features_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<Vec<ExperimentalFeature>, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
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

#[tauri::command(rename = "set-local-app-server-feature-enablement")]
pub async fn set_local_app_server_feature_enablement(
    state: State<'_, Arc<AuthBridgeState>>,
    params: LocalAppServerFeatureEnablementParams,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ExperimentalFeatureEnablementSet,
        serde_json::json!({
            "enablement": HashMap::from([(params.feature_name, params.enabled)]),
        }),
    )
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn reset_memories(state: State<'_, Arc<AuthBridgeState>>) -> Result<(), String> {
    reset_memories_inner(state.inner()).await
}

#[tauri::command(rename = "reset-memories-for-host")]
pub async fn reset_memories_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<(), String> {
    send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::MemoryReset,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())
}

async fn reset_memories_inner(state: &Arc<AuthBridgeState>) -> Result<(), String> {
    send_request(
        state,
        AppServerRequestKind::MemoryReset,
        serde_json::json!({}),
    )
    .await
    .map(|_| ())
}

pub(crate) fn ensure_supported_host_id(
    host_id: Option<&str>,
    command_name: &str,
) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn is_local_host_id(host_id: Option<&str>) -> bool {
    matches!(
        host_id.map(str::trim).filter(|value| !value.is_empty()),
        None | Some(LOCAL_HOST_ID)
    )
}

fn remote_host_id(host_id: Option<&str>) -> Option<&str> {
    host_id
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != LOCAL_HOST_ID)
}

pub(crate) async fn send_request_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    kind: AppServerRequestKind,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    if let Some(host_id) = remote_host_id(host_id) {
        remote_app_server_runtime::send_request(app, host_id, request_method(&kind), payload).await
    } else {
        send_request(state, kind, payload).await
    }
}

fn query_cache_invalidation_root(key_path: &str) -> Option<&'static str> {
    match key_path.split('.').next()? {
        "apps" => Some("apps"),
        "hooks" => Some("hooks"),
        "plugins" => Some("plugins"),
        "skills" => Some("skills"),
        "mcp_servers" | "mcpServers" => Some("config"),
        _ => Some("config"),
    }
}

fn map_app_tools(status_entry: &McpServerStatusEntry, app_id: &str) -> Vec<AppToolInfo> {
    let mut tools = status_entry
        .tools
        .iter()
        .filter_map(|(tool_key, tool)| {
            (mcp_tool_connector_id(tool) == Some(app_id)).then(|| map_app_tool(tool_key, tool))
        })
        .collect::<Vec<_>>();
    tools.sort_by(|left, right| left.name.cmp(&right.name));
    tools
}

fn map_app_tool(tool_key: &str, tool: &McpToolEntry) -> AppToolInfo {
    let visibility = normalize_tool_label(tool.visibility.as_deref());
    let annotations = tool.annotations.as_ref();
    let mut access_badges = if annotations.is_some_and(|annotations| annotations.read_only_hint) {
        vec!["READ".to_string()]
    } else if let Some(visibility) = visibility.as_ref() {
        vec![format!("{visibility} WRITE")]
    } else {
        vec!["WRITE".to_string()]
    };
    if annotations.is_some_and(|annotations| annotations.open_world_hint) {
        access_badges.push("OPEN WORLD".to_string());
    }
    if annotations.is_some_and(|annotations| annotations.destructive_hint) {
        access_badges.push("DESTRUCTIVE".to_string());
    }

    AppToolInfo {
        name: tool
            .title
            .clone()
            .or_else(|| tool.name.clone())
            .unwrap_or_else(|| tool_key.to_string()),
        description: tool.description.clone().unwrap_or_default(),
        access_badges,
        visibility,
    }
}

fn mcp_tool_connector_id(tool: &McpToolEntry) -> Option<&str> {
    let meta = tool.meta.as_ref()?;
    meta.connector_id.as_deref().or_else(|| {
        meta.codex_apps
            .as_ref()
            .and_then(|codex_apps| codex_apps.connector_id.as_deref())
    })
}

fn normalize_tool_label(value: Option<&str>) -> Option<String> {
    let value = value?;
    let normalized = value
        .split(|character: char| character == '_' || character == '-' || character.is_whitespace())
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_ascii_uppercase())
        .collect::<Vec<_>>()
        .join(" ");
    (!normalized.is_empty()).then_some(normalized)
}

fn plugin_list_cwds(params: &PluginListParams) -> Vec<String> {
    if !params.cwds.is_empty() {
        return params.cwds.clone();
    }
    match params.cwd.clone() {
        Some(cwd) => vec![cwd],
        None => Vec::new(),
    }
}

fn skills_list_cwds(params: &SkillsListParams) -> Vec<String> {
    if !params.cwds.is_empty() {
        return params.cwds.clone();
    }
    match params.cwd.clone() {
        Some(cwd) => vec![cwd],
        None => Vec::new(),
    }
}

#[tauri::command]
pub async fn list_skills(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: SkillsListParams,
) -> Result<SkillsListResponse, String> {
    let cwds = skills_list_cwds(&params);
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
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
pub async fn write_skill_config(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: SkillsConfigWriteParams,
) -> Result<SkillsConfigWriteResponse, String> {
    let SkillsConfigWriteParams {
        host_id,
        path,
        name,
        enabled,
    } = params;
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::SkillsConfigWrite,
        serde_json::json!({
            "path": path,
            "name": name,
            "enabled": enabled,
        }),
    )
    .await?;
    serde_json::from_value::<SkillsConfigWriteResponse>(value)
        .map_err(|err| format!("failed to decode skills config write response: {err}"))
}

#[tauri::command(rename = "skills-config-write")]
pub async fn write_skill_config_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: SkillsConfigWriteParams,
) -> Result<SkillsConfigWriteResponse, String> {
    write_skill_config(app, state, params).await
}

#[tauri::command(rename = "list-skills-for-host")]
pub async fn list_skills_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: SkillsListParams,
) -> Result<SkillsListResponse, String> {
    list_skills(app, state, params).await
}

#[tauri::command(rename = "list-hooks-for-host")]
pub async fn list_hooks_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HooksListParams,
) -> Result<HooksListResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::HooksList,
        serde_json::json!({
            "cwds": params.cwds,
        }),
    )
    .await?;
    serde_json::from_value::<HooksListResponse>(value)
        .map_err(|err| format!("failed to decode hooks list response: {err}"))
}

#[tauri::command]
pub async fn list_apps(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: AppsListParams,
) -> Result<AppsListResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
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

#[tauri::command(rename = "list-models-for-host")]
pub async fn list_models_for_host(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ModelListParams,
) -> Result<ModelListResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::ModelsList,
        serde_json::json!({
            "cursor": params.cursor,
            "limit": params.limit,
            "includeHidden": params.include_hidden,
        }),
    )
    .await?;
    serde_json::from_value::<ModelListResponse>(value)
        .map_err(|err| format!("failed to decode model list response: {err}"))
}

#[tauri::command]
pub async fn read_app_tools(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ReadAppToolsParams,
) -> Result<ReadAppToolsResponse, String> {
    let mut cursor = None;

    loop {
        let value = send_request_for_host(
            &app,
            state.inner(),
            params.host_id.as_deref(),
            AppServerRequestKind::McpServerStatusList,
            serde_json::json!({
                "cursor": cursor,
                "detail": "toolsAndAuthOnly",
                "limit": 100,
            }),
        )
        .await?;
        let response = serde_json::from_value::<McpServerStatusListResponse>(value)
            .map_err(|err| format!("failed to decode app tools response: {err}"))?;

        if let Some(status_entry) = response
            .data
            .iter()
            .find(|status_entry| status_entry.name == "codex_apps")
        {
            return Ok(ReadAppToolsResponse {
                tools: map_app_tools(status_entry, &params.app_id),
            });
        }

        if response.next_cursor.is_none() {
            return Ok(ReadAppToolsResponse { tools: Vec::new() });
        }
        cursor = response.next_cursor;
    }
}

#[tauri::command(rename = "read-app-tools")]
pub async fn read_app_tools_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ReadAppToolsParams,
) -> Result<ReadAppToolsResponse, String> {
    read_app_tools(app, state, params).await
}

#[tauri::command]
pub async fn list_plugins(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginListParams,
) -> Result<PluginListResponse, String> {
    let cwds = plugin_list_cwds(&params);
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::PluginList,
        serde_json::json!({
            "cwds": cwds,
        }),
    )
    .await?;
    serde_json::from_value::<PluginListResponse>(value)
        .map_err(|err| format!("failed to decode plugin list response: {err}"))
}

#[tauri::command(rename = "list-plugins")]
pub async fn list_plugins_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginListParams,
) -> Result<PluginListResponse, String> {
    list_plugins(app, state, params).await
}

#[tauri::command]
pub async fn add_marketplace(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceAddParams,
) -> Result<MarketplaceAddResponse, String> {
    let MarketplaceAddParams {
        host_id,
        source,
        ref_name,
        sparse_paths,
    } = params;
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::MarketplaceAdd,
        serde_json::json!({
            "source": source,
            "refName": ref_name,
            "sparsePaths": sparse_paths,
        }),
    )
    .await?;
    serde_json::from_value::<MarketplaceAddResponse>(value)
        .map_err(|err| format!("failed to decode marketplace add response: {err}"))
}

#[tauri::command(rename = "add-marketplace")]
pub async fn add_marketplace_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceAddParams,
) -> Result<MarketplaceAddResponse, String> {
    add_marketplace(app, state, params).await
}

#[tauri::command]
pub async fn remove_marketplace(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceRemoveParams,
) -> Result<MarketplaceRemoveResponse, String> {
    let MarketplaceRemoveParams {
        host_id,
        marketplace_name,
    } = params;
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::MarketplaceRemove,
        serde_json::json!({
            "marketplaceName": marketplace_name,
        }),
    )
    .await?;
    serde_json::from_value::<MarketplaceRemoveResponse>(value)
        .map_err(|err| format!("failed to decode marketplace remove response: {err}"))
}

#[tauri::command(rename = "remove-marketplace")]
pub async fn remove_marketplace_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceRemoveParams,
) -> Result<MarketplaceRemoveResponse, String> {
    remove_marketplace(app, state, params).await
}

#[tauri::command]
pub async fn upgrade_marketplaces(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceUpgradeParams,
) -> Result<MarketplaceUpgradeResponse, String> {
    let MarketplaceUpgradeParams {
        host_id,
        marketplace_name,
    } = params;
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::MarketplaceUpgrade,
        serde_json::json!({
            "marketplaceName": marketplace_name,
        }),
    )
    .await?;
    serde_json::from_value::<MarketplaceUpgradeResponse>(value)
        .map_err(|err| format!("failed to decode marketplace upgrade response: {err}"))
}

#[tauri::command(rename = "upgrade-marketplaces")]
pub async fn upgrade_marketplaces_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MarketplaceUpgradeParams,
) -> Result<MarketplaceUpgradeResponse, String> {
    upgrade_marketplaces(app, state, params).await
}

#[tauri::command]
pub async fn read_plugin(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginReadParams,
) -> Result<PluginReadResponse, String> {
    let PluginReadParams {
        host_id,
        marketplace_path,
        remote_marketplace_name,
        plugin_name,
    } = params;
    if marketplace_path.is_some() == remote_marketplace_name.is_some() {
        return Err(
            "plugin/read requires exactly one of marketplacePath or remoteMarketplaceName".into(),
        );
    }
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
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

#[tauri::command(rename = "read-plugin")]
pub async fn read_plugin_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginReadParams,
) -> Result<PluginReadResponse, String> {
    read_plugin(app, state, params).await
}

#[tauri::command]
pub async fn install_plugin(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginInstallParams,
) -> Result<PluginInstallResponse, String> {
    let PluginInstallParams {
        host_id,
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
    let value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
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

#[tauri::command(rename = "install-plugin")]
pub async fn install_plugin_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginInstallParams,
) -> Result<PluginInstallResponse, String> {
    install_plugin(app, state, params).await
}

#[tauri::command]
pub async fn uninstall_plugin(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginUninstallParams,
) -> Result<PluginUninstallResponse, String> {
    send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::PluginUninstall,
        serde_json::json!({
            "pluginId": params.plugin_id,
        }),
    )
    .await
    .map(|_| PluginUninstallResponse {})
}

#[tauri::command(rename = "uninstall-plugin")]
pub async fn uninstall_plugin_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginUninstallParams,
) -> Result<PluginUninstallResponse, String> {
    uninstall_plugin(app, state, params).await
}

#[tauri::command]
pub async fn list_plugin_shares(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareListParams,
) -> Result<PluginShareListResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::PluginShareList,
        serde_json::json!({}),
    )
    .await?;
    serde_json::from_value::<PluginShareListResponse>(value)
        .map_err(|err| format!("failed to decode plugin share list response: {err}"))
}

#[tauri::command(rename = "list-plugin-shares")]
pub async fn list_plugin_shares_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareListParams,
) -> Result<PluginShareListResponse, String> {
    list_plugin_shares(app, state, params).await
}

#[tauri::command]
pub async fn save_plugin_share(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareSaveParams,
) -> Result<PluginShareSaveResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::PluginShareSave,
        serde_json::json!({
            "pluginPath": params.plugin_path,
            "remotePluginId": params.remote_plugin_id,
        }),
    )
    .await?;
    serde_json::from_value::<PluginShareSaveResponse>(value)
        .map_err(|err| format!("failed to decode plugin share save response: {err}"))
}

#[tauri::command(rename = "save-plugin-share")]
pub async fn save_plugin_share_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareSaveParams,
) -> Result<PluginShareSaveResponse, String> {
    save_plugin_share(app, state, params).await
}

#[tauri::command]
pub async fn delete_plugin_share(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareDeleteParams,
) -> Result<PluginShareDeleteResponse, String> {
    send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::PluginShareDelete,
        serde_json::json!({
            "remotePluginId": params.remote_plugin_id,
        }),
    )
    .await
    .map(|_| PluginShareDeleteResponse {})
}

#[tauri::command(rename = "delete-plugin-share")]
pub async fn delete_plugin_share_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: PluginShareDeleteParams,
) -> Result<PluginShareDeleteResponse, String> {
    delete_plugin_share(app, state, params).await
}

#[tauri::command]
pub async fn list_mcp_server_status(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerStatusListParams,
) -> Result<McpServerStatusListResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
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

#[tauri::command(rename = "list-mcp-server-status")]
pub async fn list_mcp_server_status_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerStatusListParams,
) -> Result<McpServerStatusListResponse, String> {
    list_mcp_server_status(app, state, params).await
}

#[tauri::command]
pub async fn login_mcp_server(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerOauthLoginParams,
) -> Result<McpServerOauthLoginResponse, String> {
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::McpServerOauthLogin,
        serde_json::json!({
            "name": params.name,
        }),
    )
    .await?;
    serde_json::from_value::<McpServerOauthLoginResponse>(value)
        .map_err(|err| format!("failed to decode MCP server oauth login response: {err}"))
}

#[tauri::command(rename = "login-mcp-server")]
pub async fn login_mcp_server_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: McpServerOauthLoginParams,
) -> Result<McpServerOauthLoginResponse, String> {
    login_mcp_server(app, state, params).await
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

#[tauri::command(rename = "codex-app-server-restart")]
pub async fn codex_app_server_restart(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<(), String> {
    if let Some(host_id) = remote_host_id(params.host_id.as_deref()) {
        remote_app_server_runtime::restart(&app, host_id).await
    } else {
        restart_app_server(&app, state.inner()).await
    }
}

#[tauri::command]
pub async fn list_recent_threads(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads(state.inner(), false).await
}

#[tauri::command(rename = "list-recent-threads")]
pub async fn list_recent_threads_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads_for_host(&app, state.inner(), params.host_id.as_deref(), false).await
}

#[tauri::command]
pub async fn list_archived_threads(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads(state.inner(), true).await
}

#[tauri::command(rename = "list-archived-threads")]
pub async fn list_archived_threads_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: HostScopedParams,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads_for_host(&app, state.inner(), params.host_id.as_deref(), true).await
}

#[tauri::command(rename = "unsubscribe-thread-for-host")]
pub async fn unsubscribe_thread_for_host(
    state: State<'_, Arc<AuthBridgeState>>,
    params: UnsubscribeThreadForHostParams,
) -> Result<ThreadUnsubscribeResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "unsubscribe-thread-for-host")?;
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadUnsubscribe,
        serde_json::json!({
            "threadId": params.thread_id,
        }),
    )
    .await?;
    serde_json::from_value::<ThreadUnsubscribeResponse>(value)
        .map_err(|err| format!("failed to decode thread unsubscribe response: {err}"))
}

async fn list_threads(
    state: &Arc<AuthBridgeState>,
    archived: bool,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads_from_value(
        send_request(
            state,
            AppServerRequestKind::ThreadList,
            serde_json::json!({
                "archived": archived,
                "limit": 100,
                "sortKey": "updated_at",
            }),
        )
        .await?,
    )
}

async fn list_threads_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    archived: bool,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    list_threads_from_value(
        send_request_for_host(
            app,
            state,
            host_id,
            AppServerRequestKind::ThreadList,
            serde_json::json!({
                "archived": archived,
                "limit": 100,
                "sortKey": "updated_at",
            }),
        )
        .await?,
    )
}

fn list_threads_from_value(value: serde_json::Value) -> Result<Vec<ThreadHistoryEntry>, String> {
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
            status: thread.status,
            cwd: thread.cwd,
            path: thread.path,
            name: thread.name,
            source: thread_history_source_from_value(thread.source.as_ref()),
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

fn thread_history_source_from_value(
    value: Option<&serde_json::Value>,
) -> Option<ThreadHistorySource> {
    let parent_thread_id = value
        .and_then(|source| source.pointer("/subAgent/thread_spawn/parent_thread_id"))
        .and_then(serde_json::Value::as_str)
        .map(ToOwned::to_owned);

    parent_thread_id.map(|parent_thread_id| ThreadHistorySource {
        parent_thread_id: Some(parent_thread_id),
    })
}

#[tauri::command]
pub async fn start_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    cwd: Option<String>,
) -> Result<String, String> {
    start_thread_with_personality(state.inner(), cwd, state.current_personality()).await
}

#[tauri::command(rename = "start-conversation")]
pub async fn start_conversation(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: StartConversationParams,
) -> Result<String, String> {
    let StartConversationParams {
        host_id,
        input,
        text,
        cwd,
        workspace_roots,
        collaboration_mode,
        projectless_output_directory,
        workspace_kind,
        approval_policy,
        approvals_reviewer,
        sandbox_policy,
        skip_auto_title_generation,
    } = params;
    let _ = skip_auto_title_generation;
    let _ = collaboration_mode;
    let _ = projectless_output_directory;
    let _ = workspace_kind;

    let cwd = cwd
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            workspace_roots.as_ref().and_then(|roots| {
                roots
                    .iter()
                    .map(String::as_str)
                    .map(str::trim)
                    .find(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
            })
        });
    let input = if let Some(input) = input.filter(|items| !items.is_empty()) {
        serde_json::Value::Array(input)
    } else {
        let text = text.unwrap_or_default();
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Err("start-conversation requires text or input".to_string());
        }
        serde_json::json!([{ "type": "text", "text": trimmed, "text_elements": [] }])
    };
    let permission_overrides = Some(TurnStartPermissionOverrides {
        approval_policy,
        approvals_reviewer,
        sandbox_policy,
    });
    let thread_value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::ThreadStart,
        build_thread_start_payload(cwd.clone(), state.current_personality()),
    )
    .await?;
    let thread_response = serde_json::from_value::<ThreadStartResponse>(thread_value)
        .map_err(|err| format!("failed to decode thread start response: {err}"))?;
    let thread_id = thread_response.thread.id;
    let turn_value = send_request_for_host(
        &app,
        state.inner(),
        host_id.as_deref(),
        AppServerRequestKind::TurnStart,
        build_turn_start_payload(
            thread_id.clone(),
            input,
            cwd,
            state.current_personality(),
            permission_overrides,
        ),
    )
    .await?;
    let _ = serde_json::from_value::<TurnStartResponse>(turn_value)
        .map_err(|err| format!("failed to decode turn start response: {err}"))?;
    Ok(thread_id)
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

#[tauri::command(rename = "fork-conversation-from-latest")]
pub async fn fork_conversation_from_latest(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ForkConversationFromLatestParams,
) -> Result<String, String> {
    let source_thread_title = send_request(
        state.inner(),
        AppServerRequestKind::ThreadRead,
        serde_json::json!({
            "threadId": params.conversation_id.clone(),
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
            "threadId": params.conversation_id.clone(),
            "cwd": params.cwd,
            "developerInstructions": params.developer_instructions,
            "ephemeral": true,
            "persistExtendedHistory": false,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode side-chat thread fork response: {err}"))?;
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
                source_conversation_id: params.conversation_id.clone(),
                source_conversation_title: source_thread_title.clone(),
            },
        );
    }
    if let Some(item) = build_forked_from_conversation_item(
        &forked_turn_id,
        format!("forked-from-conversation:{forked_thread_id}"),
        params.conversation_id,
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

#[tauri::command(rename = "discard-conversation-from-cache")]
pub async fn discard_conversation_from_cache(
    state: State<'_, Arc<AuthBridgeState>>,
    params: UnsubscribeThreadForHostParams,
) -> Result<ThreadUnsubscribeResponse, String> {
    unsubscribe_thread_for_host(state, params).await
}

#[tauri::command]
pub async fn archive_thread(
    app: AppHandle,
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
    .map(|_| ())?;
    archive_automation_run_history_for_thread(&app, &thread_id)?;
    Ok(())
}

#[tauri::command(rename = "archive-conversation")]
pub async fn archive_conversation_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ArchiveConversationParams,
) -> Result<(), String> {
    let _ = params.cleanup_worktree;
    archive_thread(app, state, params.conversation_id).await
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

#[tauri::command(rename = "unarchive-conversation")]
pub async fn unarchive_conversation_command(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: UnarchiveConversationParams,
) -> Result<String, String> {
    unarchive_thread_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        params.conversation_id,
    )
    .await
}

async fn unarchive_thread_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    thread_id: String,
) -> Result<String, String> {
    let value = send_request_for_host(
        app,
        state,
        host_id,
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

#[tauri::command(rename = "set-thread-goal")]
pub async fn set_thread_goal(
    state: State<'_, Arc<AuthBridgeState>>,
    params: SetThreadGoalParams,
) -> Result<(), String> {
    send_request(
        state.inner(),
        AppServerRequestKind::ThreadGoalSet,
        serde_json::json!({
            "threadId": params.thread_id,
            "objective": params.objective,
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
    approval_policy: Option<serde_json::Value>,
    approvals_reviewer: Option<String>,
    sandbox_policy: Option<serde_json::Value>,
) -> Result<String, String> {
    start_turn_with_personality(
        state.inner(),
        thread_id,
        text,
        cwd,
        state.current_personality(),
        Some(TurnStartPermissionOverrides {
            approval_policy,
            approvals_reviewer,
            sandbox_policy,
        }),
    )
    .await
}

#[tauri::command]
pub async fn start_turn_with_input(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
    input: Vec<serde_json::Value>,
    cwd: Option<String>,
    approval_policy: Option<serde_json::Value>,
    approvals_reviewer: Option<String>,
    sandbox_policy: Option<serde_json::Value>,
) -> Result<String, String> {
    start_turn_with_input_and_personality(
        state.inner(),
        thread_id,
        serde_json::Value::Array(input),
        cwd,
        state.current_personality(),
        Some(TurnStartPermissionOverrides {
            approval_policy,
            approvals_reviewer,
            sandbox_policy,
        }),
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
    input: Vec<serde_json::Value>,
) -> Result<String, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::TurnSteer,
        serde_json::json!({
            "threadId": thread_id,
            "input": input,
            "expectedTurnId": turn_id,
        }),
    )
    .await?;
    let response = serde_json::from_value::<TurnSteerResponse>(value)
        .map_err(|err| format!("failed to decode turn steer response: {err}"))?;
    Ok(response.turn_id)
}

#[tauri::command(rename = "send-follow-up-message")]
pub async fn send_follow_up_message(
    state: State<'_, Arc<AuthBridgeState>>,
    params: SendFollowUpMessageParams,
) -> Result<String, String> {
    let prompt = params.prompt.trim();
    if prompt.is_empty() {
        return Err("send-follow-up-message requires a non-empty prompt".to_string());
    }

    let mut payload = serde_json::Map::new();
    payload.insert(
        "threadId".to_string(),
        serde_json::Value::String(params.conversation_id),
    );
    payload.insert(
        "prompt".to_string(),
        serde_json::Value::String(prompt.to_string()),
    );
    if let Some(model) = params.model.filter(|value| !value.trim().is_empty()) {
        payload.insert("model".to_string(), serde_json::Value::String(model));
    }
    if let Some(reasoning_effort) = params
        .reasoning_effort
        .filter(|value| !value.trim().is_empty())
    {
        payload.insert(
            "reasoningEffort".to_string(),
            serde_json::Value::String(reasoning_effort),
        );
    }

    let value = send_request(
        state.inner(),
        AppServerRequestKind::SendFollowUpMessage,
        serde_json::Value::Object(payload),
    )
    .await?;
    let response = serde_json::from_value::<TurnStartResponse>(value)
        .map_err(|err| format!("failed to decode send follow-up response: {err}"))?;
    Ok(response.turn.id)
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

#[tauri::command(rename = "maybe-resume-conversation")]
pub async fn maybe_resume_conversation(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: MaybeResumeConversationParams,
) -> Result<ThreadConversation, String> {
    let _ = params.reasoning_effort;
    let _ = params.collaboration_mode;

    let cwd = params
        .workspace_roots
        .iter()
        .map(String::as_str)
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let value = send_request_for_host(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        AppServerRequestKind::ThreadResume,
        serde_json::json!({
            "threadId": params.conversation_id,
            "cwd": cwd,
            "model": params.model,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadResumeResponse>(value)
        .map_err(|err| format!("failed to decode thread resume response: {err}"))?;
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

pub(crate) fn register_external_agent_import_completed_waiter(
    state: &Arc<AuthBridgeState>,
) -> ExternalAgentImportCompletedWaiter {
    let seen_generation = *state
        .external_agent_import_completed_generation
        .lock()
        .expect("external agent import generation mutex poisoned");
    ExternalAgentImportCompletedWaiter {
        state: Arc::clone(state),
        seen_generation,
    }
}

pub(crate) async fn request_external_agent_config_detect_for_host(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::ExternalAgentConfigDetect,
        payload,
    )
    .await
}

pub(crate) async fn request_external_agent_config_import(
    state: &Arc<AuthBridgeState>,
    payload: serde_json::Value,
) -> Result<(), String> {
    send_request(
        state,
        AppServerRequestKind::ExternalAgentConfigImport,
        payload,
    )
    .await
    .map(|_| ())
}

fn build_thread_start_payload(
    cwd: Option<String>,
    personality: Option<String>,
) -> serde_json::Value {
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
    serde_json::Value::Object(payload)
}

pub(crate) fn build_thread_start_payload_with_overrides(
    cwd: Option<String>,
    personality: Option<String>,
    mut extra: serde_json::Map<String, serde_json::Value>,
) -> serde_json::Value {
    let mut payload = match build_thread_start_payload(cwd, personality) {
        serde_json::Value::Object(object) => object,
        _ => serde_json::Map::new(),
    };
    payload.append(&mut extra);
    serde_json::Value::Object(payload)
}

fn build_turn_start_payload(
    thread_id: String,
    input: serde_json::Value,
    cwd: Option<String>,
    personality: Option<String>,
    permission_overrides: Option<TurnStartPermissionOverrides>,
) -> serde_json::Value {
    let mut payload = serde_json::Map::new();
    payload.insert("threadId".to_string(), serde_json::Value::String(thread_id));
    payload.insert("input".to_string(), normalize_turn_input_value(input));
    if let Some(cwd) = cwd {
        payload.insert("cwd".to_string(), serde_json::Value::String(cwd));
    }
    if let Some(personality) = personality {
        payload.insert(
            "personality".to_string(),
            serde_json::Value::String(personality),
        );
    }
    if let Some(permission_overrides) = permission_overrides {
        if let Some(approval_policy) = permission_overrides.approval_policy {
            payload.insert("approvalPolicy".to_string(), approval_policy);
        }
        if let Some(approvals_reviewer) = permission_overrides.approvals_reviewer {
            payload.insert(
                "approvalsReviewer".to_string(),
                serde_json::Value::String(approvals_reviewer),
            );
        }
        if let Some(sandbox_policy) = permission_overrides.sandbox_policy {
            payload.insert("sandboxPolicy".to_string(), sandbox_policy);
        }
    }
    serde_json::Value::Object(payload)
}

pub(crate) fn build_turn_start_payload_with_overrides(
    thread_id: String,
    input: serde_json::Value,
    cwd: Option<String>,
    personality: Option<String>,
    permission_overrides: Option<TurnStartPermissionOverrides>,
    mut extra: serde_json::Map<String, serde_json::Value>,
) -> serde_json::Value {
    let mut payload =
        match build_turn_start_payload(thread_id, input, cwd, personality, permission_overrides) {
            serde_json::Value::Object(object) => object,
            _ => serde_json::Map::new(),
        };
    payload.append(&mut extra);
    serde_json::Value::Object(payload)
}

fn normalize_turn_input_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Array(items) => {
            serde_json::Value::Array(items.into_iter().map(normalize_turn_input_item).collect())
        }
        other => other,
    }
}

fn normalize_turn_input_item(value: serde_json::Value) -> serde_json::Value {
    let mut object = match value {
        serde_json::Value::Object(object) => object,
        other => return other,
    };

    if let Some(text_elements) = object.remove("textElements") {
        object.insert("text_elements".to_string(), text_elements);
    }

    serde_json::Value::Object(object)
}

pub async fn start_thread_with_personality(
    state: &Arc<AuthBridgeState>,
    cwd: Option<String>,
    personality: Option<String>,
) -> Result<String, String> {
    let value = send_request(
        state,
        AppServerRequestKind::ThreadStart,
        build_thread_start_payload(cwd, personality),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread start response: {err}"))?;
    Ok(response.thread.id)
}

pub(crate) async fn start_ephemeral_thread(state: &Arc<AuthBridgeState>) -> Result<String, String> {
    let value = send_request(
        state,
        AppServerRequestKind::ThreadStart,
        serde_json::json!({
            "ephemeral": true,
            "persistExtendedHistory": false,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode ephemeral thread start response: {err}"))?;
    Ok(response.thread.id)
}

pub(crate) async fn start_ephemeral_thread_with_overrides(
    state: &Arc<AuthBridgeState>,
    payload: serde_json::Value,
) -> Result<String, String> {
    let value = send_request(state, AppServerRequestKind::ThreadStart, payload).await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode ephemeral thread start response: {err}"))?;
    Ok(response.thread.id)
}

pub async fn start_turn_with_personality(
    state: &Arc<AuthBridgeState>,
    thread_id: String,
    text: String,
    cwd: Option<String>,
    personality: Option<String>,
    permission_overrides: Option<TurnStartPermissionOverrides>,
) -> Result<String, String> {
    start_turn_with_input_and_personality(
        state,
        thread_id,
        serde_json::json!([{ "type": "text", "text": text }]),
        cwd,
        personality,
        permission_overrides,
    )
    .await
}

pub async fn start_turn_with_input_and_personality(
    state: &Arc<AuthBridgeState>,
    thread_id: String,
    input: serde_json::Value,
    cwd: Option<String>,
    personality: Option<String>,
    permission_overrides: Option<TurnStartPermissionOverrides>,
) -> Result<String, String> {
    let value = send_request(
        state,
        AppServerRequestKind::TurnStart,
        build_turn_start_payload(thread_id, input, cwd, personality, permission_overrides),
    )
    .await?;
    let response = serde_json::from_value::<TurnStartResponse>(value)
        .map_err(|err| format!("failed to decode turn start response: {err}"))?;
    Ok(response.turn.id)
}

pub(crate) async fn start_turn_with_payload(
    state: &Arc<AuthBridgeState>,
    payload: serde_json::Value,
) -> Result<String, String> {
    let value = send_request(state, AppServerRequestKind::TurnStart, payload).await?;
    let response = serde_json::from_value::<TurnStartResponse>(value)
        .map_err(|err| format!("failed to decode turn start response: {err}"))?;
    Ok(response.turn.id)
}

pub(crate) async fn unsubscribe_thread(
    state: &Arc<AuthBridgeState>,
    thread_id: &str,
) -> Result<(), String> {
    send_request(
        state,
        AppServerRequestKind::ThreadUnsubscribe,
        serde_json::json!({
            "threadId": thread_id,
        }),
    )
    .await
    .map(|_| ())
}

pub(crate) async fn wait_for_turn_completion(
    state: &Arc<AuthBridgeState>,
    thread_id: &str,
    turn_id: &str,
    timeout_duration: Duration,
) -> Result<ObservedTurnCompletion, String> {
    let cache_key = thread_turn_cache_key(thread_id, turn_id);
    tokio::time::timeout(timeout_duration, async {
        loop {
            let notified = state.observed_turn_completion_notify.notified();
            let observed_completion = state
                .observed_turn_completions
                .lock()
                .map_err(|_| "failed to lock observed turn completion cache".to_string())?
                .get(&cache_key)
                .cloned();
            if let Some(observed_completion) = observed_completion {
                return Ok(observed_completion);
            }
            notified.await;
        }
    })
    .await
    .map_err(|_| format!("timed out waiting for turn completion: {turn_id}"))?
}

pub(crate) fn take_observed_turn_agent_message(
    state: &Arc<AuthBridgeState>,
    thread_id: &str,
    turn_id: &str,
) -> Result<Option<String>, String> {
    state
        .observed_turn_agent_messages
        .lock()
        .map_err(|_| "failed to lock observed agent message cache".to_string())
        .map(|mut messages| messages.remove(&thread_turn_cache_key(thread_id, turn_id)))
}

pub(crate) fn clear_observed_turn_completion(
    state: &Arc<AuthBridgeState>,
    thread_id: &str,
    turn_id: &str,
) -> Result<(), String> {
    state
        .observed_turn_completions
        .lock()
        .map_err(|_| "failed to lock observed turn completion cache".to_string())
        .map(|mut completions| {
            completions.remove(&thread_turn_cache_key(thread_id, turn_id));
        })
}

pub async fn start(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Arc<AuthBridgeState>>().inner().clone();
    let _lifecycle_lock = state.app_server_lifecycle_lock.lock().await;
    spawn_app_server(&app, &state, true).await
}

async fn spawn_app_server(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    reset_snapshot: bool,
) -> Result<(), String> {
    if reset_snapshot {
        update_snapshot(app, state, AuthSnapshot::default());
    }
    *state.is_ready.lock().expect("ready mutex poisoned") = false;

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

    let generation = {
        let mut generation = state
            .app_server_generation
            .lock()
            .expect("app-server generation mutex poisoned");
        *generation += 1;
        *generation
    };
    *state.app_server_process.lock().await = Some(child);

    tokio::spawn(run_client(
        app.clone(),
        Arc::clone(state),
        generation,
        stdin,
        stdout,
        request_rx,
    ));
    Ok(())
}

async fn stop_app_server(state: &Arc<AuthBridgeState>) {
    *state.is_ready.lock().expect("ready mutex poisoned") = false;
    *state
        .request_tx
        .lock()
        .expect("request channel mutex poisoned") = None;

    let child = state.app_server_process.lock().await.take();
    if let Some(mut child) = child {
        let _ = child.start_kill();
        let _ = child.wait().await;
    }
}

async fn restart_app_server(app: &AppHandle, state: &Arc<AuthBridgeState>) -> Result<(), String> {
    let _lifecycle_lock = state.app_server_lifecycle_lock.lock().await;
    stop_app_server(state).await;
    spawn_app_server(app, state, false).await
}

async fn run_client(
    app: AppHandle,
    state: Arc<AuthBridgeState>,
    generation: u64,
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
                            let _ = app.emit(
                                CODEX_APP_SERVER_INITIALIZED_EVENT,
                                CodexAppServerInitializedNotification {
                                    host_id: LOCAL_HOST_ID.to_string(),
                                },
                            );
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
                            "externalAgentConfig/import/completed" => {
                                handle_external_agent_import_completed(&state);
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
                                handle_item_completed(
                                    &app,
                                    &state,
                                    params,
                                    &mut pending_thread_items,
                                );
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
                                record_app_state_snapshot_delta_from_params(&app, &params);
                                handle_agent_message_delta(
                                    &app,
                                    &state,
                                    params,
                                    &mut pending_thread_items,
                                );
                            }
                            "item/plan/delta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                record_app_state_snapshot_delta_from_params(&app, &params);
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
                                record_app_state_snapshot_delta_from_params(&app, &params);
                                handle_reasoning_summary_text_delta(
                                    &app,
                                    params,
                                    &mut pending_thread_items,
                                );
                            }
                            "item/reasoning/textDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                record_app_state_snapshot_delta_from_params(&app, &params);
                                handle_reasoning_text_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/commandExecution/outputDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                record_app_state_snapshot_delta_from_params(&app, &params);
                                handle_command_execution_output_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/fileChange/outputDelta" => {
                                remember_latest_turn_from_notification(&state, &params);
                                record_app_state_snapshot_delta_from_params(&app, &params);
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
                                handle_turn_completed(&app, &state, params);
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

    let is_current_generation = {
        let current_generation = *state
            .app_server_generation
            .lock()
            .expect("app-server generation mutex poisoned");
        current_generation == generation
    };
    if is_current_generation {
        *state.is_ready.lock().expect("ready mutex poisoned") = false;
        *state
            .request_tx
            .lock()
            .expect("request channel mutex poisoned") = None;

        let child = state.app_server_process.lock().await.take();
        if let Some(mut child) = child {
            let _ = child.wait().await;
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
    let Ok(mut notification) = serde_json::from_value::<McpOauthLoginCompletedNotification>(params)
    else {
        return;
    };
    if notification.host_id.is_none() {
        notification.host_id = Some(LOCAL_HOST_ID.to_string());
    }
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
        AppServerRequestKind::ModelsList => "model/list",
        AppServerRequestKind::LoginApiKey => "account/login/start",
        AppServerRequestKind::LoginChatGpt => "account/login/start",
        AppServerRequestKind::LoginChatGptDeviceCode => "account/login/start",
        AppServerRequestKind::CancelLogin => "account/login/cancel",
        AppServerRequestKind::Logout => "account/logout",
        AppServerRequestKind::ConfigRead => "config/read",
        AppServerRequestKind::ExternalAgentConfigDetect => "externalAgentConfig/detect",
        AppServerRequestKind::ExternalAgentConfigImport => "externalAgentConfig/import",
        AppServerRequestKind::ConfigRequirementsRead => "configRequirements/read",
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
        AppServerRequestKind::SkillsConfigWrite => "skills/config/write",
        AppServerRequestKind::HooksList => "hooks/list",
        AppServerRequestKind::MarketplaceAdd => "marketplace/add",
        AppServerRequestKind::MarketplaceRemove => "marketplace/remove",
        AppServerRequestKind::MarketplaceUpgrade => "marketplace/upgrade",
        AppServerRequestKind::PluginList => "plugin/list",
        AppServerRequestKind::PluginRead => "plugin/read",
        AppServerRequestKind::PluginShareList => "plugin/share/list",
        AppServerRequestKind::PluginShareSave => "plugin/share/save",
        AppServerRequestKind::PluginShareDelete => "plugin/share/delete",
        AppServerRequestKind::PluginInstall => "plugin/install",
        AppServerRequestKind::PluginUninstall => "plugin/uninstall",
        AppServerRequestKind::ThreadList => "thread/list",
        AppServerRequestKind::ThreadStart => "thread/start",
        AppServerRequestKind::ThreadFork => "thread/fork",
        AppServerRequestKind::ThreadArchive => "thread/archive",
        AppServerRequestKind::ThreadResume => "thread/resume",
        AppServerRequestKind::ThreadUnsubscribe => "thread/unsubscribe",
        AppServerRequestKind::ThreadUnarchive => "thread/unarchive",
        AppServerRequestKind::ThreadNameSet => "thread/name/set",
        AppServerRequestKind::ThreadGoalSet => "thread/goal/set",
        AppServerRequestKind::ThreadRead => "thread/read",
        AppServerRequestKind::ThreadRollback => "thread/rollback",
        AppServerRequestKind::ReviewStart => "review/start",
        AppServerRequestKind::SendFollowUpMessage => "send-follow-up-message",
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

fn handle_external_agent_import_completed(state: &Arc<AuthBridgeState>) {
    {
        let mut generation = state
            .external_agent_import_completed_generation
            .lock()
            .expect("external agent import generation mutex poisoned");
        *generation += 1;
    }
    state
        .external_agent_import_completed_notify
        .notify_waiters();
}

fn handle_item_completed(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
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
    if let ThreadConversationItem::AgentMessage { text, .. } = &thread_item {
        cache_observed_turn_agent_message(state, thread_id, turn_id, text);
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
    state: &Arc<AuthBridgeState>,
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
    if let ThreadConversationItem::AgentMessage { text, .. } = &updated_item {
        cache_observed_turn_agent_message(state, thread_id, turn_id, text);
    }
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

fn record_app_state_snapshot_delta_from_params(app: &AppHandle, params: &serde_json::Value) {
    let Some(delta) = params.get("delta").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Some(snapshot_state) = app.try_state::<Arc<AppStateSnapshotState>>() else {
        return;
    };
    let _ = snapshot_state.record_raw_delta_bytes(delta);
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

fn handle_turn_completed(app: &AppHandle, state: &Arc<AuthBridgeState>, params: serde_json::Value) {
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
    if let Ok(mut observed_turn_completions) = state.observed_turn_completions.lock() {
        observed_turn_completions.insert(
            thread_turn_cache_key(thread_id, turn_id),
            ObservedTurnCompletion {
                status: status.to_string(),
                error: error.clone(),
            },
        );
    }
    state.observed_turn_completion_notify.notify_waiters();
    let _ = complete_automation_run_history_for_thread(app, thread_id);
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

fn cache_observed_turn_agent_message(
    state: &Arc<AuthBridgeState>,
    thread_id: &str,
    turn_id: &str,
    text: &str,
) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }
    if let Ok(mut observed_turn_agent_messages) = state.observed_turn_agent_messages.lock() {
        observed_turn_agent_messages.insert(
            thread_turn_cache_key(thread_id, turn_id),
            trimmed.to_string(),
        );
    }
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

fn map_account_info_response(response: AccountReadResponse) -> AccountInfoResponse {
    match response.account {
        Some(Account {
            account_type,
            email,
            plan_type,
        }) if account_type == "chatgpt" => AccountInfoResponse {
            email,
            account_id: None,
            user_id: None,
            plan: plan_type,
        },
        _ => AccountInfoResponse {
            email: None,
            account_id: None,
            user_id: None,
            plan: None,
        },
    }
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

#[cfg(test)]
mod tests {
    use super::ensure_supported_host_id;
    use super::list_threads_from_value;
    use super::map_account;
    use super::map_account_info_response;
    use super::map_app_tools;
    use super::normalize_turn_input_value;
    use super::plugin_list_cwds;
    use super::remote_host_id;
    use super::skills_list_cwds;
    use super::Account;
    use super::AccountInfoResponse;
    use super::AccountReadResponse;
    use super::ApiKeyLoginParams;
    use super::AppToolInfo;
    use super::AppsListParams;
    use super::ArchiveConversationParams;
    use super::AuthState;
    use super::ConfigBatchWriteForHostParams;
    use super::ConfigReadForHostParams;
    use super::ConfigReadResponse;
    use super::ConfigRequirements;
    use super::ConfigRequirementsReadResponse;
    use super::ConfigValueWriteParams;
    use super::HookLoadErrorInfo;
    use super::HookMetadata;
    use super::HooksListEntry;
    use super::HooksListParams;
    use super::HooksListResponse;
    use super::HostScopedParams;
    use super::MarketplaceAddParams;
    use super::MarketplaceAddResponse;
    use super::MarketplaceInterface;
    use super::MarketplaceRemoveParams;
    use super::MarketplaceRemoveResponse;
    use super::MarketplaceUpgradeErrorInfo;
    use super::MarketplaceUpgradeParams;
    use super::MarketplaceUpgradeResponse;
    use super::MaybeResumeConversationParams;
    use super::McpOauthLoginCompletedNotification;
    use super::McpServerOauthLoginParams;
    use super::McpServerStatusEntry;
    use super::McpServerStatusListParams;
    use super::McpServerStatusListResponse;
    use super::ModelListEntry;
    use super::ModelListParams;
    use super::ModelListResponse;
    use super::PluginAuthPolicy;
    use super::PluginAvailability;
    use super::PluginDetail;
    use super::PluginHookSummary;
    use super::PluginInstallParams;
    use super::PluginInstallPolicy;
    use super::PluginInterface;
    use super::PluginListParams;
    use super::PluginListResponse;
    use super::PluginMarketplaceEntry;
    use super::PluginReadParams;
    use super::PluginReadResponse;
    use super::PluginShareContext;
    use super::PluginShareDeleteParams;
    use super::PluginShareListParams;
    use super::PluginSharePrincipal;
    use super::PluginSharePrincipalType;
    use super::PluginShareSaveParams;
    use super::PluginSource;
    use super::PluginSummary;
    use super::PluginUninstallParams;
    use super::ReadAppToolsParams;
    use super::SkillInterface;
    use super::SkillsConfigWriteParams;
    use super::SkillsListParams;
    use super::ThreadHistoryActiveFlag;
    use super::ThreadHistoryEntry;
    use super::ThreadHistorySource;
    use super::ThreadHistoryStatus;
    use super::ThreadUnsubscribeResponse;
    use super::ThreadUnsubscribeStatus;
    use super::UnarchiveConversationParams;
    use super::UnsubscribeThreadForHostParams;
    use serde_json::json;

    #[test]
    fn normalize_turn_input_value_renames_text_elements() {
        let normalized = normalize_turn_input_value(json!([
            {
                "type": "text",
                "text": "hello",
                "textElements": [
                    {
                        "byteRange": {
                            "start": 0,
                            "end": 5
                        },
                        "placeholder": null
                    }
                ]
            }
        ]));

        assert_eq!(
            normalized,
            json!([
                {
                    "type": "text",
                    "text": "hello",
                    "text_elements": [
                        {
                            "byteRange": {
                                "start": 0,
                                "end": 5
                            },
                            "placeholder": null
                        }
                    ]
                }
            ])
        );
    }

    #[test]
    fn archive_conversation_params_accept_page_owned_shape() {
        let params: ArchiveConversationParams = serde_json::from_value(json!({
            "conversationId": "thr_123",
            "cleanupWorktree": false
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ArchiveConversationParams {
                conversation_id: "thr_123".to_string(),
                cleanup_worktree: false,
            }
        );
    }

    #[test]
    fn archive_conversation_params_default_cleanup_worktree_to_false() {
        let params: ArchiveConversationParams = serde_json::from_value(json!({
            "conversationId": "thr_123"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ArchiveConversationParams {
                conversation_id: "thr_123".to_string(),
                cleanup_worktree: false,
            }
        );
    }

    #[test]
    fn unarchive_conversation_params_accept_page_owned_shape() {
        let params: UnarchiveConversationParams = serde_json::from_value(json!({
            "hostId": "local",
            "conversationId": "thr_123"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            UnarchiveConversationParams {
                host_id: Some("local".to_string()),
                conversation_id: "thr_123".to_string(),
            }
        );
    }

    #[test]
    fn unsubscribe_thread_for_host_params_accept_upstream_shape() {
        let params: UnsubscribeThreadForHostParams = serde_json::from_value(json!({
            "hostId": "local",
            "threadId": "thr_123"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            UnsubscribeThreadForHostParams {
                host_id: Some("local".to_string()),
                thread_id: "thr_123".to_string(),
            }
        );
    }

    #[test]
    fn unsubscribe_thread_for_host_response_deserializes_upstream_status() {
        let response: ThreadUnsubscribeResponse = serde_json::from_value(json!({
            "status": "notSubscribed"
        }))
        .expect("response should deserialize");

        assert_eq!(
            response,
            ThreadUnsubscribeResponse {
                status: ThreadUnsubscribeStatus::NotSubscribed,
            }
        );
    }

    #[test]
    fn maybe_resume_conversation_params_accept_upstream_shape() {
        let params: MaybeResumeConversationParams = serde_json::from_value(json!({
            "hostId": "local",
            "conversationId": "thr_123",
            "model": null,
            "reasoningEffort": null,
            "workspaceRoots": ["D:/workspace"],
            "collaborationMode": null
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            MaybeResumeConversationParams {
                host_id: Some("local".to_string()),
                conversation_id: "thr_123".to_string(),
                model: None,
                reasoning_effort: None,
                workspace_roots: vec!["D:/workspace".to_string()],
                collaboration_mode: None,
            }
        );
    }

    #[test]
    fn list_threads_from_value_preserves_thread_spawn_parent_thread_id() {
        let threads = list_threads_from_value(json!({
            "data": [
                {
                    "id": "thread-1",
                    "preview": "hello",
                    "createdAt": 100,
                    "updatedAt": 200,
                    "status": {
                        "type": "active",
                        "activeFlags": ["waitingOnUserInput"]
                    },
                    "cwd": "D:/workspace",
                    "path": "D:/workspace/.codex/session.jsonl",
                    "name": "Demo",
                    "source": {
                        "subAgent": {
                            "thread_spawn": {
                                "parent_thread_id": "parent-thread-1",
                                "depth": 1
                            }
                        }
                    }
                }
            ]
        }))
        .expect("thread list should deserialize");

        assert_eq!(
            threads,
            vec![ThreadHistoryEntry {
                id: "thread-1".to_string(),
                preview: "hello".to_string(),
                created_at: 100,
                updated_at: 200,
                status: ThreadHistoryStatus::Active {
                    active_flags: vec![ThreadHistoryActiveFlag::WaitingOnUserInput],
                },
                cwd: "D:/workspace".to_string(),
                path: Some("D:/workspace/.codex/session.jsonl".to_string()),
                name: Some("Demo".to_string()),
                source: Some(ThreadHistorySource {
                    parent_thread_id: Some("parent-thread-1".to_string()),
                }),
            }]
        );
    }

    #[test]
    fn api_key_login_params_accept_upstream_host_shape() {
        let params: ApiKeyLoginParams = serde_json::from_value(json!({
            "hostId": "local",
            "apiKey": "sk-test"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ApiKeyLoginParams {
                host_id: Some("local".to_string()),
                api_key: "sk-test".to_string(),
            }
        );
    }

    #[test]
    fn api_key_login_params_keep_legacy_shape_without_host_id() {
        let params: ApiKeyLoginParams = serde_json::from_value(json!({
            "apiKey": "sk-test"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ApiKeyLoginParams {
                host_id: None,
                api_key: "sk-test".to_string(),
            }
        );
    }

    #[test]
    fn host_scoped_params_accept_logout_host_id() {
        let params: HostScopedParams = serde_json::from_value(json!({
            "hostId": "local"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            HostScopedParams {
                host_id: Some("local".to_string()),
            }
        );
    }

    #[test]
    fn remote_connections_auth_host_scoped_commands_only_accept_local_host() {
        assert!(ensure_supported_host_id(None, "login-with-api-key").is_ok());
        assert!(ensure_supported_host_id(Some(""), "login-with-api-key").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "login-with-api-key").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "login-with-api-key")
                .expect_err("non-local host id should be rejected"),
            "login-with-api-key does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "login-with-api-key-for-host").is_ok());
        assert!(ensure_supported_host_id(Some(""), "login-with-api-key-for-host").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "login-with-api-key-for-host").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "login-with-api-key-for-host")
                .expect_err("non-local host id should be rejected"),
            "login-with-api-key-for-host does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "login-with-chatgpt").is_ok());
        assert!(ensure_supported_host_id(Some(""), "login-with-chatgpt").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "login-with-chatgpt").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "login-with-chatgpt")
                .expect_err("non-local host id should be rejected"),
            "login-with-chatgpt does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "login-with-chatgpt-for-host").is_ok());
        assert!(ensure_supported_host_id(Some(""), "login-with-chatgpt-for-host").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "login-with-chatgpt-for-host").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "login-with-chatgpt-for-host")
                .expect_err("non-local host id should be rejected"),
            "login-with-chatgpt-for-host does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "login-with-chatgpt-device-code").is_ok());
        assert!(ensure_supported_host_id(Some(""), "login-with-chatgpt-device-code").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "login-with-chatgpt-device-code").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "login-with-chatgpt-device-code")
                .expect_err("non-local host id should be rejected"),
            "login-with-chatgpt-device-code does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "logout").is_ok());
        assert!(ensure_supported_host_id(Some(""), "logout").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "logout").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "logout")
                .expect_err("non-local host id should be rejected"),
            "logout does not support host id: remote"
        );

        assert!(ensure_supported_host_id(None, "unsubscribe-thread-for-host").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "unsubscribe-thread-for-host").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "unsubscribe-thread-for-host")
                .expect_err("non-local host id should be rejected"),
            "unsubscribe-thread-for-host does not support host id: remote"
        );
    }

    #[test]
    fn remote_host_id_distinguishes_local_and_remote_hosts() {
        assert!(remote_host_id(None).is_none());
        assert!(matches!(remote_host_id(Some("")), None));
        assert!(matches!(remote_host_id(Some("local")), None));
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
        assert_eq!(
            remote_host_id(Some("remote-ssh-discovered:demo")),
            Some("remote-ssh-discovered:demo")
        );
    }

    #[test]
    fn reset_memories_for_host_only_accepts_local_host() {
        assert!(ensure_supported_host_id(None, "reset-memories-for-host").is_ok());
        assert!(ensure_supported_host_id(Some(""), "reset-memories-for-host").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "reset-memories-for-host").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "reset-memories-for-host")
                .expect_err("non-local host id should be rejected"),
            "reset-memories-for-host does not support host id: remote"
        );
    }

    #[test]
    fn read_config_for_host_params_accept_upstream_shape() {
        let params: ConfigReadForHostParams = serde_json::from_value(json!({
            "hostId": "local",
            "cwd": "D:/repo",
            "includeLayers": true
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ConfigReadForHostParams {
                host_id: Some("local".to_string()),
                cwd: Some("D:/repo".to_string()),
                include_layers: true,
            }
        );
    }

    #[test]
    fn config_read_response_deserializes_service_tier() {
        let response: ConfigReadResponse = serde_json::from_value(json!({
            "config": {
                "approvalPolicy": null,
                "sandboxMode": null,
                "sandboxWorkspaceWrite": null,
                "personality": null,
                "modelPersonality": null,
                "serviceTier": "flex",
                "memories": null,
                "mcpServers": null
            },
            "origins": {},
            "layers": null
        }))
        .expect("config read response should deserialize");

        assert_eq!(response.config.service_tier, Some("flex".to_string()));
    }

    #[test]
    fn write_config_value_params_accept_host_id() {
        let params: ConfigValueWriteParams = serde_json::from_value(json!({
            "hostId": "local",
            "keyPath": "approval_policy",
            "value": "never",
            "mergeStrategy": "upsert",
            "filePath": "D:/repo/.codex/config.toml",
            "expectedVersion": "version-1"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ConfigValueWriteParams {
                host_id: Some("local".to_string()),
                key_path: "approval_policy".to_string(),
                value: json!("never"),
                merge_strategy: "upsert".to_string(),
                file_path: Some("D:/repo/.codex/config.toml".to_string()),
                expected_version: Some("version-1".to_string()),
            }
        );
    }

    #[test]
    fn model_list_params_accept_upstream_host_shape() {
        let params: ModelListParams = serde_json::from_value(json!({
            "hostId": "local",
            "cursor": null,
            "limit": 100,
            "includeHidden": false
        }))
        .expect("model list params should deserialize");

        assert_eq!(
            params,
            ModelListParams {
                host_id: Some("local".to_string()),
                cursor: None,
                limit: Some(100),
                include_hidden: Some(false),
            }
        );
    }

    #[test]
    fn model_list_response_deserializes_speed_fields() {
        let response: ModelListResponse = serde_json::from_value(json!({
            "data": [{
                "id": "gpt-5.3-codex",
                "hidden": false,
                "additionalSpeedTiers": ["fast"]
            }],
            "nextCursor": null
        }))
        .expect("model list response should deserialize");

        assert_eq!(
            response,
            ModelListResponse {
                data: vec![ModelListEntry {
                    id: "gpt-5.3-codex".to_string(),
                    hidden: false,
                    additional_speed_tiers: vec!["fast".to_string()],
                }],
                next_cursor: None,
            }
        );
    }

    #[test]
    fn skills_config_write_params_accept_host_id() {
        let params: SkillsConfigWriteParams = serde_json::from_value(json!({
            "hostId": "local",
            "path": "D:/repo/.codex/skills/my-skill/SKILL.md",
            "name": null,
            "enabled": false
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            SkillsConfigWriteParams {
                host_id: Some("local".to_string()),
                path: Some("D:/repo/.codex/skills/my-skill/SKILL.md".to_string()),
                name: None,
                enabled: false,
            }
        );
    }

    #[test]
    fn config_requirements_response_deserializes_required_fields() {
        let response: ConfigRequirementsReadResponse = serde_json::from_value(json!({
            "requirements": {
                "allowedApprovalPolicies": ["on-request", "never"],
                "allowedSandboxModes": ["read-only", "workspace-write"],
                "allowedWebSearchModes": null,
                "featureRequirements": {
                    "plugins": true
                },
                "enforceResidency": null
            }
        }))
        .expect("response should deserialize");

        assert_eq!(
            response,
            ConfigRequirementsReadResponse {
                requirements: Some(ConfigRequirements {
                    allowed_approval_policies: Some(vec![json!("on-request"), json!("never"),]),
                    allowed_approvals_reviewers: None,
                    allowed_sandbox_modes: Some(vec![
                        "read-only".to_string(),
                        "workspace-write".to_string(),
                    ]),
                    allowed_web_search_modes: None,
                    feature_requirements: Some(std::collections::HashMap::from([(
                        "plugins".to_string(),
                        true,
                    )])),
                    enforce_residency: None,
                }),
            }
        );
    }

    #[test]
    fn config_host_scoped_commands_accept_remote_host_routing() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
        assert_eq!(
            remote_host_id(Some("remote-ssh-discovered:demo")),
            Some("remote-ssh-discovered:demo")
        );
    }

    #[test]
    fn batch_write_config_value_params_accept_host_id() {
        let params: ConfigBatchWriteForHostParams = serde_json::from_value(json!({
            "hostId": "local",
            "edits": [{
                "keyPath": "hooks.state",
                "value": {
                    "hook-key": {
                        "enabled": false
                    }
                },
                "mergeStrategy": "upsert"
            }],
            "filePath": null,
            "expectedVersion": null,
            "reloadUserConfig": true
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ConfigBatchWriteForHostParams {
                host_id: Some("local".to_string()),
                write: super::ConfigBatchWriteParams {
                    edits: vec![super::ConfigEditParams {
                        key_path: "hooks.state".to_string(),
                        value: json!({
                            "hook-key": {
                                "enabled": false
                            }
                        }),
                        merge_strategy: "upsert".to_string(),
                    }],
                    file_path: None,
                    expected_version: None,
                    reload_user_config: true,
                },
            }
        );
    }

    #[test]
    fn apps_list_params_accept_upstream_host_shape() {
        let params: AppsListParams = serde_json::from_value(json!({
            "hostId": "remote-ssh-discovered:demo",
            "cursor": "cursor-1",
            "limit": 25,
            "threadId": "thread-1",
            "forceRefetch": true
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            AppsListParams {
                host_id: Some("remote-ssh-discovered:demo".to_string()),
                cursor: Some("cursor-1".to_string()),
                limit: Some(25),
                thread_id: Some("thread-1".to_string()),
                force_refetch: Some(true),
            }
        );
    }

    #[test]
    fn mcp_server_status_list_params_accept_host_id() {
        let params: McpServerStatusListParams = serde_json::from_value(json!({
            "hostId": "local",
            "cursor": null,
            "limit": 100,
            "detail": "full"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            McpServerStatusListParams {
                host_id: Some("local".to_string()),
                cursor: None,
                limit: Some(100),
                detail: Some("full".to_string()),
            }
        );
    }

    #[test]
    fn mcp_server_oauth_login_params_accept_host_id() {
        let params: McpServerOauthLoginParams = serde_json::from_value(json!({
            "hostId": "local",
            "name": "demo-server"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            McpServerOauthLoginParams {
                host_id: Some("local".to_string()),
                name: "demo-server".to_string(),
            }
        );
    }

    #[test]
    fn mcp_oauth_notification_accepts_host_id() {
        let notification: McpOauthLoginCompletedNotification = serde_json::from_value(json!({
            "hostId": "remote-ssh-discovered:demo",
            "name": "demo-server",
            "success": true,
            "error": null
        }))
        .expect("notification should deserialize");

        assert_eq!(
            notification.host_id.as_deref(),
            Some("remote-ssh-discovered:demo")
        );
        assert_eq!(notification.name, "demo-server".to_string());
        assert!(notification.success);
        assert_eq!(notification.error, None);
    }

    #[test]
    fn read_app_tools_params_accept_host_id() {
        let params: ReadAppToolsParams = serde_json::from_value(json!({
            "hostId": "local",
            "appId": "connector-1"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ReadAppToolsParams {
                host_id: Some("local".to_string()),
                app_id: "connector-1".to_string(),
            }
        );
    }

    #[test]
    fn read_app_tools_can_route_remote_host() {
        assert_eq!(
            remote_host_id(Some("remote-ssh-discovered:demo")),
            Some("remote-ssh-discovered:demo")
        );
    }

    #[test]
    fn mcp_server_status_response_deserializes_tool_inventory() {
        let response: McpServerStatusListResponse = serde_json::from_value(json!({
            "data": [{
                "name": "codex_apps",
                "authStatus": "authenticated",
                "tools": {
                    "read_contacts": {
                        "name": "lookup_contact",
                        "description": "Find a contact",
                        "visibility": "public",
                        "annotations": {
                            "readOnlyHint": true,
                            "openWorldHint": true
                        },
                        "_meta": {
                            "_codex_apps": {
                                "connector_id": "connector-1"
                            }
                        }
                    },
                    "write_contacts": {
                        "name": "create_contact",
                        "title": "Create contact",
                        "description": "Create a contact",
                        "visibility": "visible",
                        "annotations": {
                            "destructiveHint": true
                        },
                        "_meta": {
                            "connectorId": "connector-1"
                        }
                    }
                }
            }],
            "nextCursor": null
        }))
        .expect("response should deserialize");

        assert_eq!(
            response.data[0]
                .tools
                .get("read_contacts")
                .and_then(|tool| tool.name.as_deref()),
            Some("lookup_contact")
        );
        assert_eq!(
            response.data[0]
                .tools
                .get("read_contacts")
                .and_then(|tool| tool.meta.as_ref())
                .and_then(|meta| meta.codex_apps.as_ref())
                .and_then(|meta| meta.connector_id.as_deref()),
            Some("connector-1")
        );
        assert_eq!(
            response.data[0]
                .tools
                .get("write_contacts")
                .and_then(|tool| tool.meta.as_ref())
                .and_then(|meta| meta.connector_id.as_deref()),
            Some("connector-1")
        );
        assert_eq!(response.next_cursor, None);
    }

    #[test]
    fn map_app_tools_filters_and_sorts_connector_tools() {
        let status_entry: McpServerStatusEntry = serde_json::from_value(json!({
            "name": "codex_apps",
            "authStatus": "authenticated",
            "tools": {
                "read_contacts": {
                    "name": "Lookup contact",
                    "description": "Find a contact",
                    "visibility": "public",
                    "annotations": {
                        "readOnlyHint": true,
                        "openWorldHint": true
                    },
                    "_meta": {
                        "_codex_apps": {
                            "connector_id": "connector-1"
                        }
                    }
                },
                "write_contacts": {
                    "name": "create_contact",
                    "title": "Create contact",
                    "description": "Create a contact",
                    "visibility": "visible",
                    "annotations": {
                        "destructiveHint": true
                    },
                    "_meta": {
                        "connectorId": "connector-1"
                    }
                },
                "other_connector": {
                    "name": "Ignore me",
                    "description": "Belongs to another app",
                    "_meta": {
                        "connectorId": "connector-2"
                    }
                }
            }
        }))
        .expect("status entry should deserialize");

        assert_eq!(
            map_app_tools(&status_entry, "connector-1"),
            vec![
                AppToolInfo {
                    name: "Create contact".to_string(),
                    description: "Create a contact".to_string(),
                    access_badges: vec!["VISIBLE WRITE".to_string(), "DESTRUCTIVE".to_string()],
                    visibility: Some("VISIBLE".to_string()),
                },
                AppToolInfo {
                    name: "Lookup contact".to_string(),
                    description: "Find a contact".to_string(),
                    access_badges: vec!["READ".to_string(), "OPEN WORLD".to_string()],
                    visibility: Some("PUBLIC".to_string()),
                },
            ]
        );
    }

    #[test]
    fn skills_list_params_accept_upstream_host_and_cwds_shape() {
        let params: SkillsListParams = serde_json::from_value(json!({
            "hostId": "local",
            "cwds": ["D:/repo-a", "D:/repo-b"],
            "forceReload": true
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            SkillsListParams {
                host_id: Some("local".to_string()),
                cwds: vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()],
                cwd: None,
                force_reload: true,
            }
        );
    }

    #[test]
    fn skills_list_cwds_prefer_upstream_array_over_legacy_cwd() {
        let upstream = SkillsListParams {
            host_id: Some("local".to_string()),
            cwds: vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()],
            cwd: Some("D:/legacy".to_string()),
            force_reload: false,
        };
        let legacy = SkillsListParams {
            host_id: None,
            cwds: Vec::new(),
            cwd: Some("D:/legacy".to_string()),
            force_reload: false,
        };

        assert_eq!(
            skills_list_cwds(&upstream),
            vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()]
        );
        assert_eq!(skills_list_cwds(&legacy), vec!["D:/legacy".to_string()]);
    }

    #[test]
    fn hooks_list_params_accept_upstream_host_and_cwds_shape() {
        let params: HooksListParams = serde_json::from_value(json!({
            "hostId": "local",
            "cwds": ["D:/repo-a", "D:/repo-b"]
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            HooksListParams {
                host_id: Some("local".to_string()),
                cwds: vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()],
            }
        );
    }

    #[test]
    fn hooks_list_response_deserializes_upstream_shape() {
        let response: HooksListResponse = serde_json::from_value(json!({
            "data": [{
                "cwd": "D:/repo-a",
                "hooks": [{
                    "key": "D:/Users/demo/.codex/config.toml:preToolUse:0:0",
                    "eventName": "preToolUse",
                    "handlerType": "command",
                    "matcher": "Bash",
                    "command": "python hook.py",
                    "timeoutSec": 5,
                    "statusMessage": "running hook",
                    "sourcePath": "D:/Users/demo/.codex/config.toml",
                    "source": "user",
                    "pluginId": null,
                    "displayOrder": 0,
                    "enabled": true,
                    "isManaged": false,
                    "currentHash": "sha256:abc",
                    "trustStatus": "untrusted"
                }],
                "warnings": ["warning text"],
                "errors": [{
                    "path": "D:/repo-a/.codex/config.toml",
                    "message": "bad hook config"
                }]
            }]
        }))
        .expect("response should deserialize");

        assert_eq!(
            response,
            HooksListResponse {
                data: vec![HooksListEntry {
                    cwd: "D:/repo-a".to_string(),
                    hooks: vec![HookMetadata {
                        key: "D:/Users/demo/.codex/config.toml:preToolUse:0:0".to_string(),
                        event_name: "preToolUse".to_string(),
                        handler_type: "command".to_string(),
                        matcher: Some("Bash".to_string()),
                        command: Some("python hook.py".to_string()),
                        timeout_sec: 5,
                        status_message: Some("running hook".to_string()),
                        source_path: "D:/Users/demo/.codex/config.toml".to_string(),
                        source: "user".to_string(),
                        plugin_id: None,
                        display_order: 0,
                        enabled: true,
                        is_managed: false,
                        current_hash: "sha256:abc".to_string(),
                        trust_status: "untrusted".to_string(),
                    }],
                    warnings: vec!["warning text".to_string()],
                    errors: vec![HookLoadErrorInfo {
                        path: "D:/repo-a/.codex/config.toml".to_string(),
                        message: "bad hook config".to_string(),
                    }],
                }],
            }
        );
    }

    #[test]
    fn list_hooks_can_route_remote_host() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
    }

    #[test]
    fn plugin_list_params_accept_upstream_host_and_cwds_shape() {
        let params: PluginListParams = serde_json::from_value(json!({
            "hostId": "local",
            "cwds": ["D:/repo-a", "D:/repo-b"]
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            PluginListParams {
                host_id: Some("local".to_string()),
                cwds: vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()],
                cwd: None,
            }
        );
    }

    #[test]
    fn plugin_list_cwds_prefer_upstream_array_over_legacy_cwd() {
        let upstream = PluginListParams {
            host_id: Some("local".to_string()),
            cwds: vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()],
            cwd: Some("D:/legacy".to_string()),
        };
        let legacy = PluginListParams {
            host_id: None,
            cwds: Vec::new(),
            cwd: Some("D:/legacy".to_string()),
        };

        assert_eq!(
            plugin_list_cwds(&upstream),
            vec!["D:/repo-a".to_string(), "D:/repo-b".to_string()]
        );
        assert_eq!(plugin_list_cwds(&legacy), vec!["D:/legacy".to_string()]);
    }

    #[test]
    fn list_plugins_can_route_remote_host() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
    }

    #[test]
    fn marketplace_mutation_params_accept_upstream_host_shape() {
        let add_params: MarketplaceAddParams = serde_json::from_value(json!({
            "hostId": "local",
            "source": "openai/plugins",
            "refName": "main",
            "sparsePaths": ["plugins/codex", "plugins/browser-use"]
        }))
        .expect("add params should deserialize");
        let remove_params: MarketplaceRemoveParams = serde_json::from_value(json!({
            "hostId": "local",
            "marketplaceName": "openai/plugins"
        }))
        .expect("remove params should deserialize");
        let upgrade_params: MarketplaceUpgradeParams = serde_json::from_value(json!({
            "hostId": "local",
            "marketplaceName": "openai/plugins"
        }))
        .expect("upgrade params should deserialize");

        assert_eq!(
            add_params,
            MarketplaceAddParams {
                host_id: Some("local".to_string()),
                source: "openai/plugins".to_string(),
                ref_name: Some("main".to_string()),
                sparse_paths: Some(vec![
                    "plugins/codex".to_string(),
                    "plugins/browser-use".to_string(),
                ]),
            }
        );
        assert_eq!(
            remove_params,
            MarketplaceRemoveParams {
                host_id: Some("local".to_string()),
                marketplace_name: "openai/plugins".to_string(),
            }
        );
        assert_eq!(
            upgrade_params,
            MarketplaceUpgradeParams {
                host_id: Some("local".to_string()),
                marketplace_name: Some("openai/plugins".to_string()),
            }
        );
    }

    #[test]
    fn marketplace_mutation_responses_deserialize_upstream_shape() {
        let add_response: MarketplaceAddResponse = serde_json::from_value(json!({
            "marketplaceName": "openai/plugins",
            "installedRoot": "D:/Users/demo/.codex/marketplaces/openai-plugins",
            "alreadyAdded": true
        }))
        .expect("add response should deserialize");
        let remove_response: MarketplaceRemoveResponse = serde_json::from_value(json!({
            "marketplaceName": "openai/plugins",
            "installedRoot": "D:/Users/demo/.codex/marketplaces/openai-plugins"
        }))
        .expect("remove response should deserialize");
        let upgrade_response: MarketplaceUpgradeResponse = serde_json::from_value(json!({
            "selectedMarketplaces": ["openai/plugins"],
            "upgradedRoots": ["D:/Users/demo/.codex/marketplaces/openai-plugins"],
            "errors": [{
                "marketplaceName": "acme/plugins",
                "message": "failed to fetch origin"
            }]
        }))
        .expect("upgrade response should deserialize");

        assert_eq!(
            add_response,
            MarketplaceAddResponse {
                marketplace_name: "openai/plugins".to_string(),
                installed_root: "D:/Users/demo/.codex/marketplaces/openai-plugins".to_string(),
                already_added: true,
            }
        );
        assert_eq!(
            remove_response,
            MarketplaceRemoveResponse {
                marketplace_name: "openai/plugins".to_string(),
                installed_root: Some(
                    "D:/Users/demo/.codex/marketplaces/openai-plugins".to_string()
                ),
            }
        );
        assert_eq!(
            upgrade_response,
            MarketplaceUpgradeResponse {
                selected_marketplaces: vec!["openai/plugins".to_string()],
                upgraded_roots: vec!["D:/Users/demo/.codex/marketplaces/openai-plugins".to_string()],
                errors: vec![MarketplaceUpgradeErrorInfo {
                    marketplace_name: "acme/plugins".to_string(),
                    message: "failed to fetch origin".to_string(),
                }],
            }
        );
    }

    #[test]
    fn plugin_list_response_deserializes_upstream_plugin_sources() {
        let response: PluginListResponse = serde_json::from_value(json!({
            "marketplaces": [
                {
                    "name": "openai/plugins",
                    "path": null,
                    "interface": {
                        "displayName": "OpenAI"
                    },
                    "plugins": [
                        {
                            "id": "browser-use@1.0.0",
                            "name": "browser-use",
                            "shareContext": {
                                "remotePluginId": "rplugin_browser_use",
                                "shareUrl": "https://chatgpt.com/g/g-browser-use",
                                "creatorAccountUserId": "user_123",
                                "creatorName": "OpenAI",
                                "shareTargets": [{
                                    "principalType": "group",
                                    "principalId": "team_123",
                                    "name": "Core Team"
                                }]
                            },
                            "source": {
                                "type": "remote"
                            },
                            "installed": true,
                            "enabled": true,
                            "installPolicy": "AVAILABLE",
                            "authPolicy": "ON_INSTALL",
                            "availability": "AVAILABLE",
                            "keywords": ["browser", "automation"],
                            "interface": null
                        }
                    ]
                },
                {
                    "name": "workspace-marketplace",
                    "path": "D:/repo/.codex/plugins",
                    "interface": null,
                    "plugins": [
                        {
                            "id": "workspace-plugin@1.0.0",
                            "name": "workspace-plugin",
                            "shareContext": null,
                            "source": {
                                "type": "local",
                                "path": "D:/repo/.codex/plugins/workspace-plugin"
                            },
                            "installed": true,
                            "enabled": false,
                            "installPolicy": "INSTALLED_BY_DEFAULT",
                            "authPolicy": "ON_USE",
                            "availability": "DISABLED_BY_ADMIN",
                            "keywords": [],
                            "interface": null
                        },
                        {
                            "id": "git-plugin@1.0.0",
                            "name": "git-plugin",
                            "shareContext": null,
                            "source": {
                                "type": "git",
                                "url": "https://github.com/acme/plugins.git",
                                "path": "plugins/git-plugin",
                                "refName": "main",
                                "sha": "abc123"
                            },
                            "installed": true,
                            "enabled": true,
                            "installPolicy": "NOT_AVAILABLE",
                            "authPolicy": "ON_INSTALL",
                            "availability": "AVAILABLE",
                            "keywords": ["git"],
                            "interface": null
                        }
                    ]
                }
            ],
            "marketplaceLoadErrors": [],
            "featuredPluginIds": []
        }))
        .expect("plugin list response should deserialize");

        assert_eq!(
            response,
            PluginListResponse {
                marketplaces: vec![
                    PluginMarketplaceEntry {
                        name: "openai/plugins".to_string(),
                        path: None,
                        interface: Some(MarketplaceInterface {
                            display_name: Some("OpenAI".to_string()),
                        }),
                        plugins: vec![PluginSummary {
                            id: "browser-use@1.0.0".to_string(),
                            name: "browser-use".to_string(),
                            share_context: Some(PluginShareContext {
                                remote_plugin_id: "rplugin_browser_use".to_string(),
                                share_url: Some("https://chatgpt.com/g/g-browser-use".to_string(),),
                                creator_account_user_id: Some("user_123".to_string()),
                                creator_name: Some("OpenAI".to_string()),
                                share_targets: Some(vec![PluginSharePrincipal {
                                    principal_type: PluginSharePrincipalType::Group,
                                    principal_id: "team_123".to_string(),
                                    name: "Core Team".to_string(),
                                }]),
                            }),
                            source: PluginSource::Remote,
                            installed: true,
                            enabled: true,
                            install_policy: PluginInstallPolicy::Available,
                            auth_policy: PluginAuthPolicy::OnInstall,
                            availability: PluginAvailability::Available,
                            interface: None,
                            keywords: vec!["browser".to_string(), "automation".to_string()],
                        }],
                    },
                    PluginMarketplaceEntry {
                        name: "workspace-marketplace".to_string(),
                        path: Some("D:/repo/.codex/plugins".to_string()),
                        interface: None,
                        plugins: vec![
                            PluginSummary {
                                id: "workspace-plugin@1.0.0".to_string(),
                                name: "workspace-plugin".to_string(),
                                share_context: None,
                                source: PluginSource::Local {
                                    path: "D:/repo/.codex/plugins/workspace-plugin".to_string(),
                                },
                                installed: true,
                                enabled: false,
                                install_policy: PluginInstallPolicy::InstalledByDefault,
                                auth_policy: PluginAuthPolicy::OnUse,
                                availability: PluginAvailability::DisabledByAdmin,
                                interface: None,
                                keywords: vec![],
                            },
                            PluginSummary {
                                id: "git-plugin@1.0.0".to_string(),
                                name: "git-plugin".to_string(),
                                share_context: None,
                                source: PluginSource::Git {
                                    url: "https://github.com/acme/plugins.git".to_string(),
                                    path: Some("plugins/git-plugin".to_string()),
                                    ref_name: Some("main".to_string()),
                                    sha: Some("abc123".to_string()),
                                },
                                installed: true,
                                enabled: true,
                                install_policy: PluginInstallPolicy::NotAvailable,
                                auth_policy: PluginAuthPolicy::OnInstall,
                                availability: PluginAvailability::Available,
                                interface: None,
                                keywords: vec!["git".to_string()],
                            },
                        ],
                    },
                ],
                marketplace_load_errors: vec![],
                featured_plugin_ids: vec![],
            }
        );
    }

    #[test]
    fn plugin_read_response_deserializes_upstream_plugin_detail_shape() {
        let response: PluginReadResponse = serde_json::from_value(json!({
            "plugin": {
                "marketplaceName": "openai/plugins",
                "marketplacePath": "D:/Users/demo/.codex/marketplaces/openai-plugins/.agents/plugins/marketplace.json",
                "summary": {
                    "id": "browser-use@1.0.0",
                    "name": "browser-use",
                    "shareContext": {
                        "remotePluginId": "rplugin_browser_use",
                        "shareUrl": "https://chatgpt.com/g/g-browser-use",
                        "creatorAccountUserId": "user_123",
                        "creatorName": "OpenAI",
                        "shareTargets": [{
                            "principalType": "workspace",
                            "principalId": "ws_123",
                            "name": "OpenAI Workspace"
                        }]
                    },
                    "source": {
                        "type": "git",
                        "url": "https://github.com/openai/plugins.git",
                        "path": "plugins/browser-use",
                        "refName": "main",
                        "sha": "abc123"
                    },
                    "installed": true,
                    "enabled": true,
                    "installPolicy": "AVAILABLE",
                    "authPolicy": "ON_INSTALL",
                    "availability": "DISABLED_BY_ADMIN",
                    "interface": {
                        "displayName": "Browser Use",
                        "shortDescription": "Control a browser",
                        "longDescription": "Drive and inspect browser sessions.",
                        "developerName": "OpenAI",
                        "category": "Browser",
                        "capabilities": ["browser", "automation"],
                        "websiteUrl": "https://example.com/browser-use",
                        "privacyPolicyUrl": "https://example.com/privacy",
                        "termsOfServiceUrl": "https://example.com/terms",
                        "defaultPrompt": ["Summarize this page"],
                        "brandColor": "#00AAFF",
                        "composerIcon": "D:/plugins/browser-use/assets/composer.png",
                        "composerIconUrl": "https://cdn.example.com/composer.png",
                        "logo": "D:/plugins/browser-use/assets/logo.png",
                        "logoUrl": "https://cdn.example.com/logo.png",
                        "screenshots": ["D:/plugins/browser-use/assets/screenshot-1.png"],
                        "screenshotUrls": ["https://cdn.example.com/screenshot-1.png"]
                    },
                    "keywords": ["browser", "automation"]
                },
                "description": "Drive and inspect browser sessions.",
                "skills": [{
                    "name": "browser",
                    "description": "Interact with a browser",
                    "shortDescription": "Control tabs",
                    "interface": {
                        "displayName": "Browser Skill",
                        "shortDescription": "Control tabs",
                        "iconSmall": "D:/plugins/browser-use/skills/browser/icon-small.png",
                        "iconLarge": "D:/plugins/browser-use/skills/browser/icon-large.png",
                        "brandColor": "#112233",
                        "defaultPrompt": "Open example.com"
                    },
                    "path": "D:/plugins/browser-use/skills/browser",
                    "enabled": true
                }],
                "hooks": [{
                    "key": "browser.after_tool",
                    "eventName": "post_tool"
                }],
                "apps": [{
                    "id": "browser-app",
                    "name": "Browser App",
                    "description": "Connected browser app",
                    "installUrl": "https://example.com/install",
                    "needsAuth": true
                }],
                "mcpServers": ["browser-server"]
            }
        }))
        .expect("plugin read response should deserialize");

        assert_eq!(
            response,
            PluginReadResponse {
                plugin: PluginDetail {
                    marketplace_name: "openai/plugins".to_string(),
                    marketplace_path: Some(
                        "D:/Users/demo/.codex/marketplaces/openai-plugins/.agents/plugins/marketplace.json"
                            .to_string(),
                    ),
                    summary: PluginSummary {
                        id: "browser-use@1.0.0".to_string(),
                        name: "browser-use".to_string(),
                        share_context: Some(PluginShareContext {
                            remote_plugin_id: "rplugin_browser_use".to_string(),
                            share_url: Some(
                                "https://chatgpt.com/g/g-browser-use".to_string(),
                            ),
                            creator_account_user_id: Some("user_123".to_string()),
                            creator_name: Some("OpenAI".to_string()),
                            share_targets: Some(vec![PluginSharePrincipal {
                                principal_type: PluginSharePrincipalType::Workspace,
                                principal_id: "ws_123".to_string(),
                                name: "OpenAI Workspace".to_string(),
                            }]),
                        }),
                        source: PluginSource::Git {
                            url: "https://github.com/openai/plugins.git".to_string(),
                            path: Some("plugins/browser-use".to_string()),
                            ref_name: Some("main".to_string()),
                            sha: Some("abc123".to_string()),
                        },
                        installed: true,
                        enabled: true,
                        install_policy: PluginInstallPolicy::Available,
                        auth_policy: PluginAuthPolicy::OnInstall,
                        availability: PluginAvailability::DisabledByAdmin,
                        interface: Some(PluginInterface {
                            display_name: Some("Browser Use".to_string()),
                            short_description: Some("Control a browser".to_string()),
                            long_description: Some(
                                "Drive and inspect browser sessions.".to_string(),
                            ),
                            developer_name: Some("OpenAI".to_string()),
                            category: Some("Browser".to_string()),
                            capabilities: vec![
                                "browser".to_string(),
                                "automation".to_string(),
                            ],
                            website_url: Some(
                                "https://example.com/browser-use".to_string(),
                            ),
                            privacy_policy_url: Some(
                                "https://example.com/privacy".to_string(),
                            ),
                            terms_of_service_url: Some(
                                "https://example.com/terms".to_string(),
                            ),
                            default_prompt: Some(vec![
                                "Summarize this page".to_string(),
                            ]),
                            brand_color: Some("#00AAFF".to_string()),
                            composer_icon: Some(
                                "D:/plugins/browser-use/assets/composer.png".to_string(),
                            ),
                            composer_icon_url: Some(
                                "https://cdn.example.com/composer.png".to_string(),
                            ),
                            logo: Some(
                                "D:/plugins/browser-use/assets/logo.png".to_string(),
                            ),
                            logo_url: Some(
                                "https://cdn.example.com/logo.png".to_string(),
                            ),
                            screenshots: vec![
                                "D:/plugins/browser-use/assets/screenshot-1.png".to_string(),
                            ],
                            screenshot_urls: vec![
                                "https://cdn.example.com/screenshot-1.png".to_string(),
                            ],
                        }),
                        keywords: vec!["browser".to_string(), "automation".to_string()],
                    },
                    description: Some("Drive and inspect browser sessions.".to_string()),
                    skills: vec![super::PluginSkillSummary {
                        name: "browser".to_string(),
                        description: "Interact with a browser".to_string(),
                        short_description: Some("Control tabs".to_string()),
                        interface: Some(SkillInterface {
                            display_name: Some("Browser Skill".to_string()),
                            short_description: Some("Control tabs".to_string()),
                            icon_small: Some(
                                "D:/plugins/browser-use/skills/browser/icon-small.png"
                                    .to_string(),
                            ),
                            icon_large: Some(
                                "D:/plugins/browser-use/skills/browser/icon-large.png"
                                    .to_string(),
                            ),
                            brand_color: Some("#112233".to_string()),
                            default_prompt: Some("Open example.com".to_string()),
                        }),
                        path: Some("D:/plugins/browser-use/skills/browser".to_string()),
                        enabled: true,
                    }],
                    hooks: vec![PluginHookSummary {
                        key: "browser.after_tool".to_string(),
                        event_name: "post_tool".to_string(),
                    }],
                    apps: vec![super::PluginAppSummary {
                        id: "browser-app".to_string(),
                        name: "Browser App".to_string(),
                        description: Some("Connected browser app".to_string()),
                        install_url: Some("https://example.com/install".to_string()),
                        needs_auth: true,
                    }],
                    mcp_servers: vec!["browser-server".to_string()],
                },
            }
        );
    }

    #[test]
    fn marketplace_mutation_commands_can_route_remote_host() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
    }

    #[test]
    fn plugin_detail_and_mutation_params_accept_upstream_host_shape() {
        let read_params: PluginReadParams = serde_json::from_value(json!({
            "hostId": "local",
            "remoteMarketplaceName": "openai/plugins",
            "pluginName": "browser-use"
        }))
        .expect("read params should deserialize");
        let install_params: PluginInstallParams = serde_json::from_value(json!({
            "hostId": "local",
            "marketplacePath": "D:/repo/.codex/plugins",
            "pluginName": "browser-use"
        }))
        .expect("install params should deserialize");
        let uninstall_params: PluginUninstallParams = serde_json::from_value(json!({
            "hostId": "local",
            "pluginId": "plugin-123"
        }))
        .expect("uninstall params should deserialize");

        assert_eq!(
            read_params,
            PluginReadParams {
                host_id: Some("local".to_string()),
                marketplace_path: None,
                remote_marketplace_name: Some("openai/plugins".to_string()),
                plugin_name: "browser-use".to_string(),
            }
        );
        assert_eq!(
            install_params,
            PluginInstallParams {
                host_id: Some("local".to_string()),
                marketplace_path: Some("D:/repo/.codex/plugins".to_string()),
                remote_marketplace_name: None,
                plugin_name: "browser-use".to_string(),
            }
        );
        assert_eq!(
            uninstall_params,
            PluginUninstallParams {
                host_id: Some("local".to_string()),
                plugin_id: "plugin-123".to_string(),
            }
        );
    }

    #[test]
    fn plugin_detail_and_mutation_commands_can_route_remote_host() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
    }

    #[test]
    fn plugin_share_params_accept_upstream_host_shape() {
        let list_params: PluginShareListParams = serde_json::from_value(json!({
            "hostId": "local"
        }))
        .expect("list params should deserialize");
        let save_params: PluginShareSaveParams = serde_json::from_value(json!({
            "hostId": "local",
            "pluginPath": "D:/repo/.codex/plugins/demo",
            "remotePluginId": "plugin-123"
        }))
        .expect("save params should deserialize");
        let delete_params: PluginShareDeleteParams = serde_json::from_value(json!({
            "hostId": "local",
            "remotePluginId": "plugin-123"
        }))
        .expect("delete params should deserialize");

        assert_eq!(
            list_params,
            PluginShareListParams {
                host_id: Some("local".to_string()),
            }
        );
        assert_eq!(
            save_params,
            PluginShareSaveParams {
                host_id: Some("local".to_string()),
                plugin_path: "D:/repo/.codex/plugins/demo".to_string(),
                remote_plugin_id: Some("plugin-123".to_string()),
            }
        );
        assert_eq!(
            delete_params,
            PluginShareDeleteParams {
                host_id: Some("local".to_string()),
                remote_plugin_id: "plugin-123".to_string(),
            }
        );
    }

    #[test]
    fn plugin_share_save_params_allow_missing_remote_plugin_id() {
        let params: PluginShareSaveParams = serde_json::from_value(json!({
            "hostId": "local",
            "pluginPath": "D:/repo/.codex/plugins/demo"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            PluginShareSaveParams {
                host_id: Some("local".to_string()),
                plugin_path: "D:/repo/.codex/plugins/demo".to_string(),
                remote_plugin_id: None,
            }
        );
    }

    #[test]
    fn plugin_share_commands_can_route_remote_host() {
        assert_eq!(remote_host_id(Some("remote")), Some("remote"));
    }

    #[test]
    fn map_account_keeps_account_owned_ids_nullable() {
        let auth_state = map_account(AccountReadResponse {
            account: Some(Account {
                account_type: "chatgpt".to_string(),
                email: Some("user@example.com".to_string()),
                plan_type: Some("pro".to_string()),
            }),
            requires_openai_auth: true,
        });

        assert_eq!(
            auth_state,
            AuthState {
                auth_method: Some("chatgpt".to_string()),
                open_ai_auth: Some("chatgpt".to_string()),
                requires_auth: true,
                email: Some("user@example.com".to_string()),
                account_id: None,
                user_id: None,
                plan_at_login: Some("pro".to_string()),
            }
        );
    }

    #[test]
    fn map_account_info_response_uses_only_desktop_proven_fields() {
        let account_info = map_account_info_response(AccountReadResponse {
            account: Some(Account {
                account_type: "chatgpt".to_string(),
                email: Some("user@example.com".to_string()),
                plan_type: Some("pro".to_string()),
            }),
            requires_openai_auth: true,
        });

        assert_eq!(
            account_info,
            AccountInfoResponse {
                email: Some("user@example.com".to_string()),
                account_id: None,
                user_id: None,
                plan: Some("pro".to_string()),
            }
        );
    }
}
