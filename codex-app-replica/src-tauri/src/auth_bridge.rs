use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{sleep, Duration};

const AUTH_EVENT: &str = "auth-state-changed";
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
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversation {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub messages: Vec<ThreadConversationMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationMessage {
    pub id: String,
    pub role: String,
    pub text: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SandboxWorkspaceWrite {
    pub network_access: bool,
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
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadReadResponse {
    thread: ThreadReadThread,
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
    request_tx: Mutex<Option<mpsc::UnboundedSender<AppServerRequest>>>,
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
        id: i64,
        #[serde(default)]
        result: Option<serde_json::Value>,
        #[serde(default)]
        error: Option<JsonRpcError>,
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
    ThreadList,
    ThreadRead,
}

struct AppServerRequest {
    kind: AppServerRequestKind,
    payload: serde_json::Value,
    response_tx: Option<oneshot::Sender<Result<serde_json::Value, String>>>,
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
    send_request(state.inner(), AppServerRequestKind::Logout, serde_json::json!({}))
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
pub async fn list_recent_threads(
    state: State<'_, Arc<AuthBridgeState>>,
) -> Result<Vec<ThreadHistoryEntry>, String> {
    let value = send_request(
        state.inner(),
        AppServerRequestKind::ThreadList,
        serde_json::json!({
            "archived": false,
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
    let messages = response
        .thread
        .turns
        .into_iter()
        .flat_map(|turn| turn.items.into_iter())
        .filter_map(map_thread_message)
        .collect::<Vec<_>>();
    Ok(ThreadConversation {
        id: response.thread.id,
        title: response
            .thread
            .name
            .unwrap_or(response.thread.preview)
            .trim()
            .to_string(),
        cwd: response.thread.cwd,
        messages,
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
    mut request_rx: mpsc::UnboundedReceiver<AppServerRequest>,
) {
    let mut next_request_id: i64 = 1;
    let mut pending = HashMap::<i64, AppServerRequestKind>::new();
    let mut pending_result =
        HashMap::<i64, oneshot::Sender<Result<serde_json::Value, String>>>::new();
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
    pending.insert(next_request_id, AppServerRequestKind::AccountRead);
    next_request_id += 1;

    loop {
        tokio::select! {
            maybe_request = request_rx.recv() => {
                let Some(request) = maybe_request else {
                    break;
                };
                let request_id = next_request_id;
                next_request_id += 1;
                let method = request_method(&request.kind);
                let payload = serde_json::json!({
                    "method": method,
                    "id": request_id,
                    "params": request.payload,
                });
                if let Some(response_tx) = request.response_tx {
                    pending_result.insert(request_id, response_tx);
                }
                pending.insert(request_id, request.kind);
                if let Err(err) = write_json(&mut stdin, &payload).await {
                    if let Some(response_tx) = pending_result.remove(&request_id) {
                        let _ = response_tx.send(Err(err.clone()));
                    }
                    pending.remove(&request_id);
                    set_bridge_error(&app, &state, err);
                    break;
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
                        if id == 1 && !initialized {
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
                    JsonRpcMessage::Notification { method, params } => {
                        match method.as_str() {
                            "account/updated" => {
                                queue_account_read(&mut stdin, &mut next_request_id, &mut pending).await;
                            }
                            "account/login/completed" => {
                                handle_login_completed(&app, &state, params);
                                queue_account_read(&mut stdin, &mut next_request_id, &mut pending).await;
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
    pending: &mut HashMap<i64, AppServerRequestKind>,
) {
    let request_id = *next_request_id;
    *next_request_id += 1;
    pending.insert(request_id, AppServerRequestKind::AccountRead);
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
        AppServerRequestKind::ThreadList => "thread/list",
        AppServerRequestKind::ThreadRead => "thread/read",
    }
}

fn map_thread_message(value: serde_json::Value) -> Option<ThreadConversationMessage> {
    let item_type = value.get("type")?.as_str()?;
    match item_type {
        "userMessage" => {
            let id = value.get("id")?.as_str()?.to_string();
            let text = value
                .get("content")
                .and_then(serde_json::Value::as_array)
                .map(|content| extract_user_text(content.as_slice()))
                .unwrap_or_default()
                .trim()
                .to_string();
            if text.is_empty() {
                return None;
            }
            Some(ThreadConversationMessage {
                id,
                role: "user".to_string(),
                text,
            })
        }
        "agentMessage" => {
            let id = value.get("id")?.as_str()?.to_string();
            let text = value.get("text")?.as_str()?.trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(ThreadConversationMessage {
                id,
                role: "assistant".to_string(),
                text,
            })
        }
        _ => None,
    }
}

fn extract_user_text(content: &[serde_json::Value]) -> String {
    content
        .iter()
        .filter_map(|item| {
            let item_type = item.get("type")?.as_str()?;
            if item_type != "text" {
                return None;
            }
            item.get("text")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .collect::<Vec<_>>()
        .join("\n")
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
) -> Result<mpsc::UnboundedSender<AppServerRequest>, String> {
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
        .send(AppServerRequest {
            kind,
            payload,
            response_tx: Some(response_tx),
        })
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
