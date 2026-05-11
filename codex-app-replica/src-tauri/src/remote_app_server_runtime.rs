use crate::remote_app_server_registry::{RemoteAppServerConnectionState, RemoteAppServerRegistry};
use crate::remote_connections::RemoteConnection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};

const CLIENT_NAME: &str = "codex-app-replica";
const CLIENT_TITLE: &str = "Codex App Replica";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const CODEX_APP_SERVER_INITIALIZED_EVENT: &str = "codex-app-server-initialized";
const MCP_OAUTH_EVENT: &str = "mcp-oauth-login-completed";
const REMOTE_APP_SERVER_COMMAND: &str = "codex app-server --listen stdio://";

#[derive(Default)]
pub struct RemoteAppServerRuntimeState {
    entries: AsyncMutex<HashMap<String, RemoteAppServerProcess>>,
    reconcile_lock: AsyncMutex<()>,
    next_generation: Mutex<u64>,
}

struct RemoteAppServerProcess {
    connection: RemoteConnection,
    child: Child,
    generation: u64,
    request_tx: mpsc::UnboundedSender<RemoteAppServerMessage>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum RemoteJsonRpcId {
    Integer(i64),
    String(String),
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RemoteJsonRpcMessage {
    Response {
        id: RemoteJsonRpcId,
        #[serde(default)]
        result: Option<Value>,
        #[serde(default)]
        error: Option<RemoteJsonRpcError>,
    },
    Request {
        id: RemoteJsonRpcId,
        method: String,
        #[serde(default)]
        params: Value,
    },
    Notification {
        method: String,
        #[serde(default)]
        params: Value,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct RemoteJsonRpcError {
    code: i64,
    message: String,
}

struct RemoteAppServerRequest {
    method: String,
    payload: Value,
    response_tx: Option<oneshot::Sender<Result<Value, String>>>,
}

enum RemoteAppServerMessage {
    Request(RemoteAppServerRequest),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexAppServerInitializedNotification {
    host_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct McpOauthLoginCompletedNotification {
    host_id: Option<String>,
    name: String,
    success: bool,
    error: Option<String>,
}

pub async fn send_request(
    app: &AppHandle,
    host_id: &str,
    method: &str,
    payload: Value,
) -> Result<Value, String> {
    let request_tx = wait_for_request_sender(app, host_id).await?;
    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(RemoteAppServerMessage::Request(RemoteAppServerRequest {
            method: method.to_string(),
            payload,
            response_tx: Some(response_tx),
        }))
        .map_err(|_| format!("remote app-server request channel closed for {host_id}"))?;
    response_rx
        .await
        .map_err(|_| format!("remote app-server response channel closed for {host_id}"))?
}

async fn wait_for_request_sender(
    app: &AppHandle,
    host_id: &str,
) -> Result<mpsc::UnboundedSender<RemoteAppServerMessage>, String> {
    let runtime_state = app.state::<RemoteAppServerRuntimeState>();
    let entries = runtime_state.entries.lock().await;
    let entry = entries
        .get(host_id)
        .ok_or_else(|| format!("remote app-server is not running for {host_id}"))?;
    match entry.child.id() {
        Some(_) => Ok(entry.request_tx.clone()),
        None => Err(format!("remote app-server is not running for {host_id}")),
    }
}

pub async fn reconcile(
    app: &AppHandle,
    remote_connections: &[RemoteConnection],
) -> Result<(), String> {
    let runtime_state = app.state::<RemoteAppServerRuntimeState>();
    let registry = app.state::<RemoteAppServerRegistry>();
    let _reconcile_lock = runtime_state.reconcile_lock.lock().await;
    let desired_host_ids = remote_connections
        .iter()
        .map(|connection| connection.host_id.clone())
        .collect::<HashSet<_>>();

    stop_removed_hosts(app, &runtime_state, &registry, &desired_host_ids).await;

    for connection in remote_connections {
        registry.ensure_host(&connection.host_id);
        registry.set_auto_connect(&connection.host_id, connection.auto_connect);
        if connection.auto_connect {
            ensure_connected(app, &runtime_state, &registry, connection.clone(), false).await;
        } else {
            ensure_stopped(&runtime_state, &registry, &connection.host_id).await;
        }
    }

    Ok(())
}

pub async fn restart(app: &AppHandle, host_id: &str) -> Result<(), String> {
    let runtime_state = app.state::<RemoteAppServerRuntimeState>();
    let registry = app.state::<RemoteAppServerRegistry>();
    let _reconcile_lock = runtime_state.reconcile_lock.lock().await;
    let connection = {
        let entries = runtime_state.entries.lock().await;
        entries
            .get(host_id)
            .map(|entry| entry.connection.clone())
            .ok_or_else(|| format!("remote app-server is not running for {host_id}"))?
    };
    ensure_connected(app, &runtime_state, &registry, connection, true).await;
    Ok(())
}

async fn stop_removed_hosts(
    app: &AppHandle,
    runtime_state: &RemoteAppServerRuntimeState,
    registry: &RemoteAppServerRegistry,
    desired_host_ids: &HashSet<String>,
) {
    let current_host_ids = registry
        .list()
        .into_iter()
        .map(|entry| entry.host_id)
        .collect::<Vec<_>>();
    for host_id in current_host_ids {
        if desired_host_ids.contains(&host_id) {
            continue;
        }
        if let Some(process) = remove_process(runtime_state, &host_id).await {
            stop_process(process).await;
        }
        registry.forget(&host_id);
    }

    let stale_host_ids = {
        let entries = runtime_state.entries.lock().await;
        entries
            .keys()
            .filter(|host_id| !desired_host_ids.contains(*host_id))
            .cloned()
            .collect::<Vec<_>>()
    };
    for host_id in stale_host_ids {
        if let Some(process) = remove_process(runtime_state, &host_id).await {
            stop_process(process).await;
        }
    }

    let _ = app;
}

async fn ensure_stopped(
    runtime_state: &RemoteAppServerRuntimeState,
    registry: &RemoteAppServerRegistry,
    host_id: &str,
) {
    if let Some(process) = remove_process(runtime_state, host_id).await {
        stop_process(process).await;
    }
    registry.set_state(host_id, RemoteAppServerConnectionState::Disconnected, None);
}

async fn ensure_connected(
    app: &AppHandle,
    runtime_state: &RemoteAppServerRuntimeState,
    registry: &RemoteAppServerRegistry,
    connection: RemoteConnection,
    force_restart: bool,
) {
    let existing_process = {
        let mut entries = runtime_state.entries.lock().await;
        match entries.get_mut(&connection.host_id) {
            Some(entry) => match entry.child.try_wait() {
                Ok(None) if same_connection(&entry.connection, &connection) && !force_restart => {
                    return;
                }
                Ok(_) | Err(_) => entries.remove(&connection.host_id),
            },
            None => None,
        }
    };

    let restarting = existing_process.is_some() || force_restart;
    if restarting {
        registry.set_state(
            &connection.host_id,
            RemoteAppServerConnectionState::Restarting,
            None,
        );
    }
    if let Some(process) = existing_process {
        stop_process(process).await;
    }

    registry.set_state(
        &connection.host_id,
        RemoteAppServerConnectionState::Connecting,
        None,
    );

    let generation = next_generation(runtime_state);
    let spawn_result = spawn_remote_app_server_process(&connection, generation);
    let (process, stdin, stdout, stderr, request_rx) = match spawn_result {
        Ok(value) => value,
        Err(err) => {
            registry.set_state(
                &connection.host_id,
                RemoteAppServerConnectionState::Error,
                Some(err),
            );
            return;
        }
    };

    {
        let mut entries = runtime_state.entries.lock().await;
        entries.insert(connection.host_id.clone(), process);
    }

    tokio::spawn(run_remote_app_server_client(
        app.clone(),
        connection.host_id,
        generation,
        stdin,
        stdout,
        stderr,
        request_rx,
    ));
}

fn next_generation(runtime_state: &RemoteAppServerRuntimeState) -> u64 {
    let mut next_generation = runtime_state
        .next_generation
        .lock()
        .expect("remote app-server generation mutex poisoned");
    *next_generation += 1;
    *next_generation
}

fn spawn_remote_app_server_process(
    connection: &RemoteConnection,
    generation: u64,
) -> Result<
    (
        RemoteAppServerProcess,
        ChildStdin,
        ChildStdout,
        ChildStderr,
        mpsc::UnboundedReceiver<RemoteAppServerMessage>,
    ),
    String,
> {
    let args = build_ssh_command_args(connection)?;
    let mut child = Command::new("ssh")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("failed to spawn ssh for {}: {err}", connection.host_id))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| format!("missing ssh stdin for {}", connection.host_id))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("missing ssh stdout for {}", connection.host_id))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("missing ssh stderr for {}", connection.host_id))?;
    let (request_tx, request_rx) = mpsc::unbounded_channel();

    Ok((
        RemoteAppServerProcess {
            connection: connection.clone(),
            child,
            generation,
            request_tx,
        },
        stdin,
        stdout,
        stderr,
        request_rx,
    ))
}

fn build_ssh_command_args(connection: &RemoteConnection) -> Result<Vec<String>, String> {
    let mut args = vec!["-o".to_string(), "BatchMode=yes".to_string()];

    if let Some(alias) = connection.ssh_alias.as_deref() {
        args.push(alias.to_string());
    } else {
        let host = connection.ssh_host.as_deref().ok_or_else(|| {
            format!(
                "remote connection {} is missing ssh host",
                connection.host_id
            )
        })?;
        if let Some(port) = connection.ssh_port {
            args.push("-p".to_string());
            args.push(port.to_string());
        }
        if let Some(identity) = connection.identity.as_deref() {
            args.push("-i".to_string());
            args.push(expand_tilde_path(identity));
        }
        args.push(host.to_string());
    }

    args.push(REMOTE_APP_SERVER_COMMAND.to_string());
    Ok(args)
}

fn expand_tilde_path(value: &str) -> String {
    if value == "~" {
        return home_directory()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|| value.to_string());
    }

    let Some(suffix) = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
    else {
        return value.to_string();
    };

    home_directory()
        .map(|path| path.join(suffix).to_string_lossy().into_owned())
        .unwrap_or_else(|| value.to_string())
}

fn home_directory() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
}

async fn stop_process(mut process: RemoteAppServerProcess) {
    let _ = process.child.start_kill();
    let _ = process.child.wait().await;
}

fn same_connection(current: &RemoteConnection, next: &RemoteConnection) -> bool {
    current.host_id == next.host_id
        && current.ssh_alias == next.ssh_alias
        && current.ssh_host == next.ssh_host
        && current.ssh_port == next.ssh_port
        && current.identity == next.identity
}

async fn run_remote_app_server_client(
    app: AppHandle,
    host_id: String,
    generation: u64,
    mut stdin: ChildStdin,
    stdout: ChildStdout,
    stderr: ChildStderr,
    mut request_rx: mpsc::UnboundedReceiver<RemoteAppServerMessage>,
) {
    let stderr_task = tokio::spawn(async move { read_stderr(stderr).await });
    let mut lines = BufReader::new(stdout).lines();
    let mut initialized = false;
    let mut error_message = None;
    let mut next_request_id: i64 = 2;
    let mut pending_result =
        HashMap::<RemoteJsonRpcId, oneshot::Sender<Result<Value, String>>>::new();

    if let Err(err) = write_json(
        &mut stdin,
        &serde_json::json!({
            "method": "initialize",
            "id": 1,
            "params": {
                "clientInfo": {
                    "name": CLIENT_NAME,
                    "title": CLIENT_TITLE,
                    "version": CLIENT_VERSION,
                },
                "capabilities": {
                    "experimentalApi": true,
                }
            }
        }),
    )
    .await
    {
        error_message = Some(err);
    } else {
        loop {
            tokio::select! {
                maybe_message = request_rx.recv(), if initialized => {
                    let Some(message) = maybe_message else {
                        break;
                    };
                    match message {
                        RemoteAppServerMessage::Request(request) => {
                            let request_id = RemoteJsonRpcId::Integer(next_request_id);
                            next_request_id += 1;
                            let payload = serde_json::json!({
                                "method": request.method,
                                "id": request_id,
                                "params": request.payload,
                            });
                            if let Some(response_tx) = request.response_tx {
                                pending_result.insert(request_id.clone(), response_tx);
                            }
                            if let Err(err) = write_json(&mut stdin, &payload).await {
                                if let Some(response_tx) = pending_result.remove(&request_id) {
                                    let _ = response_tx.send(Err(err.clone()));
                                }
                                error_message = Some(err);
                                break;
                            }
                        }
                    }
                }
                line = lines.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            if line.trim().is_empty() {
                                continue;
                            }
                            let Ok(message) = serde_json::from_str::<RemoteJsonRpcMessage>(&line) else {
                                continue;
                            };
                            match message {
                                RemoteJsonRpcMessage::Response { id, result, error } => {
                                    if id == RemoteJsonRpcId::Integer(1) && !initialized {
                                        if let Some(error) = error {
                                            error_message = Some(error.message);
                                            break;
                                        }
                                        initialized = true;
                                        if mark_state_if_current(
                                            &app,
                                            &host_id,
                                            generation,
                                            RemoteAppServerConnectionState::Connected,
                                            None,
                                        )
                                        .await
                                        {
                                            let _ = app.emit(
                                                CODEX_APP_SERVER_INITIALIZED_EVENT,
                                                CodexAppServerInitializedNotification {
                                                    host_id: host_id.clone(),
                                                },
                                            );
                                        }
                                        if let Err(err) = write_json(
                                            &mut stdin,
                                            &serde_json::json!({
                                                "method": "initialized",
                                                "params": {}
                                            }),
                                        )
                                        .await
                                        {
                                            error_message = Some(err);
                                            break;
                                        }
                                        continue;
                                    }

                                    if let Some(response_tx) = pending_result.remove(&id) {
                                        match (result, error) {
                                            (Some(value), None) => {
                                                let _ = response_tx.send(Ok(value));
                                            }
                                            (_, Some(err)) => {
                                                let _ = response_tx.send(Err(err.message));
                                            }
                                            _ => {
                                                let _ = response_tx.send(Err("empty response".to_string()));
                                            }
                                        }
                                    }
                                }
                                RemoteJsonRpcMessage::Request { id, method, params } => {
                                    let _ = (id, method, params);
                                }
                                RemoteJsonRpcMessage::Notification { method, params } => {
                                    match method.as_str() {
                                        "mcpServer/oauthLogin/completed" => {
                                            handle_mcp_oauth_login_completed(&app, &host_id, params);
                                        }
                                        _ => {
                                            let _ = params;
                                        }
                                    }
                                }
                            }
                        }
                        Ok(None) => break,
                        Err(err) => {
                            error_message = Some(format!(
                                "failed to read remote app-server output for {host_id}: {err}"
                            ));
                            break;
                        }
                    }
                }
            }
        }
    }

    for (_, response_tx) in pending_result {
        let _ = response_tx.send(Err(format!(
            "remote app-server request dropped for {host_id}"
        )));
    }

    let stderr_output = stderr_task.await.unwrap_or_default();
    if error_message.is_none() && !initialized {
        error_message = Some(remote_process_exit_message(&host_id, &stderr_output, false));
    } else if error_message.is_none() && initialized {
        error_message = Some(remote_process_exit_message(&host_id, &stderr_output, true));
    } else if let Some(message) = error_message.as_mut() {
        if !stderr_output.is_empty() {
            *message = format!("{message}: {stderr_output}");
        }
    }

    let Some(mut process) = take_current_process(&app, &host_id, generation).await else {
        return;
    };
    let _ = process.child.wait().await;
    if let Some(message) = error_message {
        let registry = app.state::<RemoteAppServerRegistry>();
        if registry.snapshot(&host_id).auto_connect {
            registry.set_state(
                &host_id,
                RemoteAppServerConnectionState::Error,
                Some(message),
            );
        } else {
            registry.set_state(&host_id, RemoteAppServerConnectionState::Disconnected, None);
        }
    }
}

async fn read_stderr(mut stderr: ChildStderr) -> String {
    let mut bytes = Vec::new();
    let _ = stderr.read_to_end(&mut bytes).await;
    String::from_utf8_lossy(&bytes).trim().to_string()
}

fn remote_process_exit_message(host_id: &str, stderr_output: &str, initialized: bool) -> String {
    if !stderr_output.is_empty() {
        return stderr_output.to_string();
    }
    if initialized {
        format!("remote app-server exited for {host_id}")
    } else {
        format!("remote app-server disconnected before initialization for {host_id}")
    }
}

async fn mark_state_if_current(
    app: &AppHandle,
    host_id: &str,
    generation: u64,
    state: RemoteAppServerConnectionState,
    error: Option<String>,
) -> bool {
    let runtime_state = app.state::<RemoteAppServerRuntimeState>();
    let is_current = {
        let entries = runtime_state.entries.lock().await;
        entries
            .get(host_id)
            .map(|entry| entry.generation == generation)
            .unwrap_or(false)
    };
    if is_current {
        let registry = app.state::<RemoteAppServerRegistry>();
        registry.set_state(host_id, state, error);
    }
    is_current
}

async fn take_current_process(
    app: &AppHandle,
    host_id: &str,
    generation: u64,
) -> Option<RemoteAppServerProcess> {
    let runtime_state = app.state::<RemoteAppServerRuntimeState>();
    let mut entries = runtime_state.entries.lock().await;
    let is_current = entries
        .get(host_id)
        .map(|entry| entry.generation == generation)
        .unwrap_or(false);
    if is_current {
        entries.remove(host_id)
    } else {
        None
    }
}

async fn remove_process(
    runtime_state: &RemoteAppServerRuntimeState,
    host_id: &str,
) -> Option<RemoteAppServerProcess> {
    let mut entries = runtime_state.entries.lock().await;
    entries.remove(host_id)
}

async fn write_json(stdin: &mut ChildStdin, value: &Value) -> Result<(), String> {
    let mut line = serde_json::to_vec(value).map_err(|err| err.to_string())?;
    line.push(b'\n');
    stdin
        .write_all(&line)
        .await
        .map_err(|err| format!("failed to write remote app-server json: {err}"))?;
    stdin
        .flush()
        .await
        .map_err(|err| format!("failed to flush remote app-server json: {err}"))
}

fn handle_mcp_oauth_login_completed(app: &AppHandle, host_id: &str, params: Value) {
    let Ok(mut notification) = serde_json::from_value::<McpOauthLoginCompletedNotification>(params)
    else {
        return;
    };
    notification.host_id = Some(host_id.to_string());
    let _ = app.emit(MCP_OAUTH_EVENT, notification);
}

#[cfg(test)]
mod tests {
    use super::build_ssh_command_args;
    use super::expand_tilde_path;
    use crate::remote_connections::RemoteConnection;

    #[test]
    fn ssh_command_uses_alias_when_present() {
        let args = build_ssh_command_args(&RemoteConnection {
            host_id: "remote-ssh-discovered:demo".into(),
            display_name: "Demo".into(),
            source: "discovered".into(),
            auto_connect: true,
            ssh_alias: Some("demo-alias".into()),
            ssh_host: Some("ignored.example.com".into()),
            ssh_port: Some(2222),
            identity: Some("~/.ssh/id_demo".into()),
        })
        .expect("ssh args");

        assert_eq!(
            args,
            vec![
                "-o".to_string(),
                "BatchMode=yes".to_string(),
                "demo-alias".to_string(),
                "codex app-server --listen stdio://".to_string(),
            ]
        );
    }

    #[test]
    fn ssh_command_uses_manual_host_settings_when_alias_missing() {
        let args = build_ssh_command_args(&RemoteConnection {
            host_id: "remote-ssh-codex-managed:demo".into(),
            display_name: "Demo".into(),
            source: "codex-managed".into(),
            auto_connect: true,
            ssh_alias: None,
            ssh_host: Some("example.com".into()),
            ssh_port: Some(2200),
            identity: Some("C:/Users/demo/.ssh/id_demo".into()),
        })
        .expect("ssh args");

        assert_eq!(
            args,
            vec![
                "-o".to_string(),
                "BatchMode=yes".to_string(),
                "-p".to_string(),
                "2200".to_string(),
                "-i".to_string(),
                "C:/Users/demo/.ssh/id_demo".to_string(),
                "example.com".to_string(),
                "codex app-server --listen stdio://".to_string(),
            ]
        );
    }

    #[test]
    fn expand_tilde_path_leaves_non_tilde_values_unchanged() {
        assert_eq!(
            expand_tilde_path("C:/ssh/id_demo"),
            "C:/ssh/id_demo".to_string()
        );
    }
}
