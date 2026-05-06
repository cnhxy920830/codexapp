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
use crate::thread_history::map_file_change_summary;
use crate::thread_history::map_thread_item;
use crate::thread_history::replace_file_change_changes;
use crate::thread_history::thread_item_id;
use crate::thread_history::FileChangeSummary;
use crate::thread_history::ThreadConversation;
use crate::thread_history::ThreadConversationItem;

const AUTH_EVENT: &str = "auth-state-changed";
const THREAD_EVENT: &str = "thread-event";
const MCP_OAUTH_EVENT: &str = "mcp-oauth-login-completed";
const CLIENT_NAME: &str = "codex-app-replica";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");

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
    items: Vec<serde_json::Value>,
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
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadEventPayload {
    ThreadItemUpdated {
        thread_id: String,
        turn_id: String,
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
        command: Option<String>,
        cwd: Option<String>,
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
    ServerRequestResolved {
        request_id: JsonRpcId,
        thread_id: String,
    },
}

impl Default for AuthBridgeState {
    fn default() -> Self {
        Self {
            snapshot: Mutex::new(AuthSnapshot::default()),
            is_ready: Mutex::new(false),
            request_tx: Mutex::new(None),
        }
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
    let payload = match cwd {
        Some(cwd) => serde_json::json!({ "cwd": cwd }),
        None => serde_json::json!({}),
    };
    let value = send_request(state.inner(), AppServerRequestKind::ThreadStart, payload).await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread start response: {err}"))?;
    Ok(response.thread.id)
}

#[tauri::command]
pub async fn fork_thread(
    state: State<'_, Arc<AuthBridgeState>>,
    thread_id: String,
) -> Result<String, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadFork,
        serde_json::json!({
            "threadId": thread_id,
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadStartResponse>(value)
        .map_err(|err| format!("failed to decode thread fork response: {err}"))?;
    Ok(response.thread.id)
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
    let payload = match cwd {
        Some(cwd) => serde_json::json!({
            "threadId": thread_id,
            "input": [
                { "type": "text", "text": text }
            ],
            "cwd": cwd,
        }),
        None => serde_json::json!({
            "threadId": thread_id,
            "input": [
                { "type": "text", "text": text }
            ],
        }),
    };
    let value = send_request(state.inner(), AppServerRequestKind::TurnStart, payload).await?;
    let response = serde_json::from_value::<TurnStartResponse>(value)
        .map_err(|err| format!("failed to decode turn start response: {err}"))?;
    Ok(response.turn.id)
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
    let mut items = Vec::<ThreadConversationItem>::new();
    for turn in response.thread.turns.iter() {
        for item in turn
            .items
            .iter()
            .filter_map(|item| map_thread_item(&turn.id, item))
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
    }
    Ok(ThreadConversation {
        id: response.thread.id,
        title: response
            .thread
            .name
            .unwrap_or(response.thread.preview)
            .trim()
            .to_string(),
        cwd: response.thread.cwd,
        items,
    })
}

pub fn shared_state() -> Arc<AuthBridgeState> {
    Arc::new(AuthBridgeState::default())
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
                            "mcpServer/startupStatus/updated" => {}
                            "item/started" => {
                                handle_item_started(&app, params, &mut pending_thread_items);
                            }
                            "item/completed" => {
                                handle_item_completed(&app, params, &mut pending_thread_items);
                            }
                            "item/agentMessage/delta" => {
                                handle_agent_message_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/commandExecution/outputDelta" => {
                                handle_command_execution_output_delta(&app, params, &mut pending_thread_items);
                            }
                            "item/fileChange/patchUpdated" => {
                                handle_file_change_patch_updated(&app, params, &mut pending_thread_items);
                            }
                            "serverRequest/resolved" => {
                                handle_server_request_resolved(&app, params);
                            }
                            "turn/completed" => {
                                handle_turn_completed(&app, params);
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

fn request_method(kind: &AppServerRequestKind) -> &'static str {
    match kind {
        AppServerRequestKind::AccountRead => "account/read",
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
    let Some(thread_item) = map_thread_item(turn_id, &item) else {
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
    let Some(thread_item) = map_thread_item(turn_id, &item) else {
        return;
    };
    if matches!(
        thread_item,
        ThreadConversationItem::CommandExecution { .. } | ThreadConversationItem::FileChange { .. }
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
            item: thread_item,
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
        });
    let Some(updated_item) = append_agent_message_delta(item, delta) else {
        return;
    };
    let _ = app.emit(
        THREAD_EVENT,
        ThreadEventPayload::ThreadItemUpdated {
            thread_id: thread_id.to_string(),
            turn_id: turn_id.to_string(),
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
    let command = params
        .get("command")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let cwd = params
        .get("cwd")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
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
            command,
            cwd,
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
