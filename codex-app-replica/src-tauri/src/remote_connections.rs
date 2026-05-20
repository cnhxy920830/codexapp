use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::codex_app_config::{
    read_codex_app_config, write_codex_app_config, CodexAppConfig, CodexAppRemoteConnection,
    CodexAppRemoteProject,
};
use crate::global_settings::{read_global_settings, write_global_settings};
use crate::pending_worktrees::{
    pending_worktrees_shared_object_key, pending_worktrees_snapshot_value,
};
use crate::remote_app_server_runtime;
use crate::remote_control::{
    delete_remote_control_environment, load_remote_control_connections_snapshot,
    rename_remote_control_environment, DeleteRemoteControlEnvironmentParams,
    RemoteControlConnectionsState, RemoteControlEnvironment, RenameRemoteControlEnvironmentParams,
};

const CODEX_MANAGED_REMOTE_CONNECTIONS_KEY: &str = "codex-managed-remote-connections";
const SHARED_OBJECT_UPDATED_EVENT: &str = "shared-object-updated";
const REMOTE_CONNECTIONS_SHARED_OBJECT_KEY: &str = "remote_connections";
const REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY: &str = "remote_control_connections";
const REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY: &str = "remote_control_connections_state";
const REMOTE_CONNECTION_AUTO_CONNECT_BY_HOST_ID_KEY: &str =
    "remote-connection-auto-connect-by-host-id";
const REMOTE_PROJECTS_KEY: &str = "remote-projects";
const PROJECT_ORDER_KEY: &str = "project-order";
const SOURCE_CODEX_MANAGED: &str = "codex-managed";
const SOURCE_DISCOVERED: &str = "discovered";
const REMOTE_SSH_CODEX_MANAGED_PREFIX: &str = "remote-ssh-codex-managed:";
const REMOTE_SSH_DISCOVERED_PREFIX: &str = "remote-ssh-discovered:";
const SSH_CONFIG_DIR: &str = ".ssh";
const SSH_CONFIG_FILE: &str = "config";
const EXCLUDED_DISCOVERED_ALIAS: &str = "colima";
const EXCLUDED_DISCOVERED_HOSTNAME: &str = "github.com";
const APP_SERVER_VERSION_RESTART_AVAILABLE_PREFIX: &str =
    "codex-app-server-version-restart-available:";
const APP_SERVER_VERSION_UNSUPPORTED_PREFIX: &str = "codex-app-server-version-unsupported:";
const APP_SERVER_MIN_REQUIRED_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppServerConnectionStateParams {
    pub host_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AppServerConnectionState {
    Connecting,
    Restarting,
    Connected,
    Disconnected,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "code")]
pub enum AppServerConnectionError {
    #[serde(rename = "login-required")]
    LoginRequired,
    #[serde(rename = "restart-required")]
    RestartRequired {
        #[serde(rename = "currentVersion")]
        current_version: Option<String>,
        #[serde(rename = "installedVersion")]
        installed_version: Option<String>,
    },
    #[serde(rename = "update-required")]
    UpdateRequired {
        #[serde(rename = "minRequiredVersion")]
        min_required_version: String,
        #[serde(rename = "currentVersion")]
        current_version: String,
    },
    #[serde(rename = "connection-failed")]
    ConnectionFailed { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppServerConnectionStateResponse {
    pub state: AppServerConnectionState,
    pub error: Option<AppServerConnectionError>,
    pub app_server_version: Option<String>,
    pub installed_codex_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnection {
    pub host_id: String,
    pub display_name: String,
    pub source: String,
    pub auto_connect: bool,
    pub ssh_alias: Option<String>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub identity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRemoteConnectionsResponse {
    pub remote_connections: Vec<RemoteConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetRemoteConnectionAutoConnectResponse {
    pub remote_connections: Vec<RemoteConnection>,
    pub state: AppServerConnectionState,
    pub error: Option<AppServerConnectionError>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SharedObjectSnapshotResponse {
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverRemoteSshConnectionsResponse {
    pub discovered_remote_connections: Vec<RemoteConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedRemoteConnection {
    pub host_id: String,
    pub display_name: String,
    pub source: String,
    pub alias: Option<String>,
    pub hostname: Option<String>,
    pub ssh_port: Option<u16>,
    pub identity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedRemoteConnectionInput {
    pub host_id: Option<String>,
    pub display_name: String,
    pub source: Option<String>,
    pub alias: Option<String>,
    pub hostname: Option<String>,
    pub ssh_port: Option<u16>,
    pub identity: Option<String>,
    #[serde(default)]
    pub ssh_alias: Option<String>,
    #[serde(default)]
    pub ssh_host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveCodexManagedRemoteSshConnectionsParams {
    pub remote_connections: Vec<SavedRemoteConnectionInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveCodexManagedRemoteSshConnectionsResponse {
    pub remote_connections: Vec<SavedRemoteConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetRemoteConnectionAutoConnectParams {
    pub host_id: String,
    pub auto_connect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProject {
    pub id: String,
    pub host_id: String,
    pub remote_path: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveRemoteProjectParams {
    pub host_id: String,
    pub remote_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveRemoteProjectResponse {
    pub project: RemoteProject,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteWorkspaceDirectoryEntriesParams {
    pub host_id: String,
    pub directory_path: String,
    pub directories_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteWorkspaceDirectoryEntriesResponse {
    pub directory_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SharedObjectUpdatedNotification {
    key: String,
    value: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SaveCodexManagedRemoteSshConnectionsCommandResult {
    response: SaveCodexManagedRemoteSshConnectionsResponse,
    state: RemoteConnectionsState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RemoteConnectionsState {
    remote_connections: Vec<RemoteConnection>,
    remote_control_connections: Vec<RemoteControlEnvironment>,
    remote_control_connections_state: RemoteControlConnectionsState,
    remote_projects: Vec<RemoteProject>,
}

#[derive(Debug, Default, PartialEq, Eq)]
struct ResolvedSshConfig {
    hostname: Option<String>,
    port: Option<u16>,
    identity: Option<String>,
}

#[tauri::command(rename = "discover-remote-ssh-connections")]
pub async fn discover_remote_ssh_connections(
) -> Result<DiscoverRemoteSshConnectionsResponse, String> {
    tauri::async_runtime::spawn_blocking(discover_remote_ssh_connections_blocking)
        .await
        .map_err(|err| format!("discover-remote-ssh-connections task failed: {err}"))?
}

#[tauri::command(rename = "refresh-remote-connections")]
pub async fn refresh_remote_connections(
    app: AppHandle,
) -> Result<RefreshRemoteConnectionsResponse, String> {
    refresh_remote_connections_runtime(&app).await
}

#[tauri::command(rename = "refresh-remote-control-connections")]
pub async fn refresh_remote_control_connections(app: AppHandle) -> Result<(), String> {
    let settings = read_global_settings(&app)?;
    let auto_connect_by_host_id = read_auto_connect_by_host_id(&settings);
    let (remote_control_connections, remote_control_connections_state) =
        tauri::async_runtime::block_on(load_remote_control_connections_snapshot(&app))?;
    let remote_control_connections = overlay_auto_connect_on_remote_control_connections(
        remote_control_connections,
        &auto_connect_by_host_id,
    );
    emit_shared_object_updated(
        &app,
        REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY,
        &remote_control_connections,
    )?;
    emit_shared_object_updated(
        &app,
        REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY,
        &remote_control_connections_state,
    )?;
    Ok(())
}

#[tauri::command(rename = "save-codex-managed-remote-ssh-connections")]
pub async fn save_codex_managed_remote_ssh_connections(
    app: AppHandle,
    params: SaveCodexManagedRemoteSshConnectionsParams,
) -> Result<SaveCodexManagedRemoteSshConnectionsResponse, String> {
    let blocking_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        save_codex_managed_remote_ssh_connections_blocking(&blocking_app, params)
    })
    .await
    .map_err(|err| format!("save-codex-managed-remote-ssh-connections task failed: {err}"))??;
    let SaveCodexManagedRemoteSshConnectionsCommandResult { response, state } = result;
    apply_remote_connections_runtime(&app, state).await?;
    Ok(response)
}

#[tauri::command(rename = "save-remote-project")]
pub async fn save_remote_project(
    app: AppHandle,
    params: SaveRemoteProjectParams,
) -> Result<SaveRemoteProjectResponse, String> {
    let host_id = normalize_required_value(&params.host_id, "host_id")?;
    let remote_path = normalize_remote_project_path(&params.remote_path)?;
    let blocking_app = app.clone();
    let state = tauri::async_runtime::spawn_blocking(move || {
        save_remote_project_blocking(&blocking_app, params)
    })
    .await
    .map_err(|err| format!("save-remote-project task failed: {err}"))??;
    apply_remote_connections_runtime(&app, state.clone()).await?;

    let project = state
        .remote_projects
        .into_iter()
        .find(|project| project.host_id == host_id && project.remote_path == remote_path)
        .ok_or_else(|| "saved remote project was not found after refresh".to_string())?;
    Ok(SaveRemoteProjectResponse { project })
}

#[tauri::command(rename = "remote-workspace-directory-entries")]
pub async fn remote_workspace_directory_entries(
    app: AppHandle,
    params: RemoteWorkspaceDirectoryEntriesParams,
) -> Result<RemoteWorkspaceDirectoryEntriesResponse, String> {
    let blocking_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        remote_workspace_directory_entries_blocking(&blocking_app, params)
    })
    .await
    .map_err(|err| format!("remote-workspace-directory-entries task failed: {err}"))?
}

#[tauri::command(rename = "set-remote-connection-auto-connect")]
pub async fn set_remote_connection_auto_connect(
    app: AppHandle,
    registry: tauri::State<'_, crate::remote_app_server_registry::RemoteAppServerRegistry>,
    params: SetRemoteConnectionAutoConnectParams,
) -> Result<SetRemoteConnectionAutoConnectResponse, String> {
    let blocking_app = app.clone();
    let host_id = params.host_id;
    let host_id_for_write = host_id.clone();
    let auto_connect = params.auto_connect;
    let refreshed_state = tauri::async_runtime::spawn_blocking(move || {
        let mut settings = read_global_settings(&blocking_app)?;
        let mut auto_connect_by_host_id = read_auto_connect_by_host_id(&settings);
        if auto_connect {
            auto_connect_by_host_id.insert(host_id_for_write, Value::Bool(true));
        } else {
            auto_connect_by_host_id.remove(&host_id_for_write);
        }
        settings.insert(
            REMOTE_CONNECTION_AUTO_CONNECT_BY_HOST_ID_KEY.to_string(),
            Value::Object(auto_connect_by_host_id),
        );
        write_global_settings(&blocking_app, &settings)?;
        Ok::<_, String>(refresh_remote_connections_blocking(&blocking_app)?)
    })
    .await
    .map_err(|err| format!("set-remote-connection-auto-connect task failed: {err}"))??;
    let host_in_ssh = refreshed_state
        .remote_connections
        .iter()
        .any(|connection| connection.host_id == host_id);
    let host_in_remote_control = refreshed_state
        .remote_control_connections
        .iter()
        .any(|connection| connection.host_id == host_id);
    let refreshed = apply_remote_connections_runtime(&app, refreshed_state).await?;
    if !host_in_ssh && !host_in_remote_control {
        return Err(format!("remote connection for host ID {host_id} not found"));
    }

    if auto_connect && host_in_ssh {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        loop {
            let snapshot = registry.snapshot(&host_id);
            if !matches!(
                snapshot.state,
                crate::remote_app_server_registry::RemoteAppServerConnectionState::Connecting
                    | crate::remote_app_server_registry::RemoteAppServerConnectionState::Restarting
            ) || tokio::time::Instant::now() >= deadline
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    let connection_state = app_server_connection_state_for_registry(
        &registry,
        &AppServerConnectionStateParams {
            host_id: host_id.clone(),
        },
    );

    Ok(SetRemoteConnectionAutoConnectResponse {
        remote_connections: refreshed.remote_connections,
        state: connection_state.state,
        error: connection_state.error,
    })
}

#[tauri::command(rename = "rename-remote-control-environment")]
pub async fn rename_remote_control_environment_command(
    app: AppHandle,
    params: RenameRemoteControlEnvironmentParams,
) -> Result<(), String> {
    let env_id = normalize_required_value(&params.env_id, "env_id")?;
    let name = normalize_required_value(&params.name, "name")?;
    rename_remote_control_environment(&env_id, &name).await?;
    refresh_remote_connections_runtime(&app).await?;
    Ok(())
}

#[tauri::command(rename = "delete-remote-control-environment")]
pub async fn delete_remote_control_environment_command(
    app: AppHandle,
    params: DeleteRemoteControlEnvironmentParams,
) -> Result<(), String> {
    let env_id = normalize_required_value(&params.env_id, "env_id")?;
    delete_remote_control_environment(&env_id).await?;
    refresh_remote_connections_runtime(&app).await?;
    Ok(())
}

#[tauri::command(rename = "app-server-connection-state")]
pub async fn app_server_connection_state(
    registry: tauri::State<'_, crate::remote_app_server_registry::RemoteAppServerRegistry>,
    params: AppServerConnectionStateParams,
) -> Result<AppServerConnectionStateResponse, String> {
    Ok(app_server_connection_state_for_registry(
        &*registry, &params,
    ))
}

fn app_server_connection_state_for_registry(
    registry: &crate::remote_app_server_registry::RemoteAppServerRegistry,
    params: &AppServerConnectionStateParams,
) -> AppServerConnectionStateResponse {
    let snapshot = registry.snapshot(&params.host_id);
    let state = match snapshot.state {
        crate::remote_app_server_registry::RemoteAppServerConnectionState::Disconnected => {
            AppServerConnectionState::Disconnected
        }
        crate::remote_app_server_registry::RemoteAppServerConnectionState::Connecting => {
            AppServerConnectionState::Connecting
        }
        crate::remote_app_server_registry::RemoteAppServerConnectionState::Restarting => {
            AppServerConnectionState::Restarting
        }
        crate::remote_app_server_registry::RemoteAppServerConnectionState::Connected => {
            AppServerConnectionState::Connected
        }
        crate::remote_app_server_registry::RemoteAppServerConnectionState::Error => {
            AppServerConnectionState::Error
        }
    };
    let error = snapshot
        .error
        .map(|message| map_app_server_connection_error(&message));
    AppServerConnectionStateResponse {
        state,
        error,
        app_server_version: snapshot.app_server_version,
        installed_codex_version: snapshot.installed_codex_version,
    }
}

fn map_app_server_connection_error(message: &str) -> AppServerConnectionError {
    if message.starts_with("Parse Error") {
        return AppServerConnectionError::RestartRequired {
            current_version: None,
            installed_version: None,
        };
    }

    if let Some(payload) = message.strip_prefix(APP_SERVER_VERSION_RESTART_AVAILABLE_PREFIX) {
        let mut parts = payload.splitn(2, ':');
        let current_version = parts.next().and_then(trim_to_owned);
        let installed_version = parts.next().and_then(trim_to_owned);
        return AppServerConnectionError::RestartRequired {
            current_version,
            installed_version,
        };
    }

    if let Some(current_version) = message
        .strip_prefix(APP_SERVER_VERSION_UNSUPPORTED_PREFIX)
        .and_then(trim_to_owned)
    {
        return AppServerConnectionError::UpdateRequired {
            min_required_version: APP_SERVER_MIN_REQUIRED_VERSION.to_string(),
            current_version,
        };
    }

    AppServerConnectionError::ConnectionFailed {
        message: message.to_string(),
    }
}

async fn refresh_remote_connections_runtime(
    app: &AppHandle,
) -> Result<RefreshRemoteConnectionsResponse, String> {
    let state = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || refresh_remote_connections_blocking(&app)
    })
    .await
    .map_err(|err| format!("refresh-remote-connections task failed: {err}"))??;
    apply_remote_connections_runtime(app, state).await
}

async fn apply_remote_connections_runtime(
    app: &AppHandle,
    state: RemoteConnectionsState,
) -> Result<RefreshRemoteConnectionsResponse, String> {
    remote_app_server_runtime::reconcile(app, &state.remote_connections).await?;
    emit_shared_object_updated(
        app,
        REMOTE_CONNECTIONS_SHARED_OBJECT_KEY,
        &state.remote_connections,
    )?;
    emit_shared_object_updated(
        app,
        REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY,
        &state.remote_control_connections,
    )?;
    emit_shared_object_updated(
        app,
        REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY,
        &state.remote_control_connections_state,
    )?;
    emit_shared_object_updated(app, REMOTE_PROJECTS_KEY, &state.remote_projects)?;
    Ok(RefreshRemoteConnectionsResponse {
        remote_connections: state.remote_connections,
    })
}

#[allow(dead_code)]
pub(crate) fn read_remote_connection_by_host_id(
    app: &AppHandle,
    host_id: &str,
) -> Result<Option<RemoteConnection>, String> {
    let host_id = host_id.trim();
    if host_id.is_empty() {
        return Ok(None);
    }

    Ok(refresh_remote_connections_blocking(app)?
        .remote_connections
        .into_iter()
        .find(|connection| connection.host_id == host_id))
}

#[tauri::command(rename = "get-shared-object-snapshot")]
pub async fn get_shared_object_snapshot(
    app: AppHandle,
    key: String,
) -> Result<SharedObjectSnapshotResponse, String> {
    if key == pending_worktrees_shared_object_key() {
        return Ok(SharedObjectSnapshotResponse {
            value: pending_worktrees_snapshot_value(&app).await?,
        });
    }

    if let Some(value) = crate::primary_runtime::shared_object_snapshot(&app, &key) {
        return Ok(SharedObjectSnapshotResponse { value });
    }

    let value = tauri::async_runtime::spawn_blocking(move || {
        shared_object_snapshot_value_blocking(&app, &key)
    })
    .await
    .map_err(|err| format!("get-shared-object-snapshot task failed: {err}"))??;
    Ok(SharedObjectSnapshotResponse { value })
}

fn discover_remote_ssh_connections_blocking() -> Result<DiscoverRemoteSshConnectionsResponse, String>
{
    let ssh_config_entrypoint = default_ssh_config_entrypoint();
    let mut discovered = discover_remote_connections_from_entrypoint(&ssh_config_entrypoint)?;
    discovered.sort_by(|left, right| left.display_name.cmp(&right.display_name));
    Ok(DiscoverRemoteSshConnectionsResponse {
        discovered_remote_connections: discovered,
    })
}

fn refresh_remote_connections_blocking(app: &AppHandle) -> Result<RemoteConnectionsState, String> {
    let mut settings = read_global_settings(app)?;
    let config = read_codex_app_config(app)?;
    let saved = load_saved_remote_connections(&mut settings);
    let discovered_remote_connections =
        discover_remote_connections_from_entrypoint(&default_ssh_config_entrypoint())?;
    let remote_projects =
        derive_remote_projects_from_config(&config, &saved, &discovered_remote_connections);
    let saved = restore_saved_alias_connections_for_existing_remote_projects(
        &mut settings,
        saved,
        &remote_projects,
        &discovered_remote_connections,
    )?;
    let auto_connect = ensure_remote_project_hosts_auto_connect(&mut settings, &remote_projects);
    let remote_connections = load_remote_connections(&saved, &auto_connect)?;
    let (remote_control_connections, remote_control_connections_state) =
        tauri::async_runtime::block_on(load_remote_control_connections_snapshot(app))?;
    let remote_control_connections = overlay_auto_connect_on_remote_control_connections(
        remote_control_connections,
        &auto_connect,
    );
    sync_remote_projects_snapshot(&mut settings, &remote_projects)?;
    sync_project_order(&mut settings, &remote_projects);
    write_global_settings(app, &settings)?;
    Ok(RemoteConnectionsState {
        remote_connections,
        remote_control_connections,
        remote_control_connections_state,
        remote_projects,
    })
}

fn save_codex_managed_remote_ssh_connections_blocking(
    app: &AppHandle,
    params: SaveCodexManagedRemoteSshConnectionsParams,
) -> Result<SaveCodexManagedRemoteSshConnectionsCommandResult, String> {
    let canonical = params
        .remote_connections
        .into_iter()
        .filter_map(normalize_saved_remote_connection)
        .collect::<Vec<_>>();
    let mut settings = read_global_settings(app)?;
    settings.insert(
        CODEX_MANAGED_REMOTE_CONNECTIONS_KEY.to_string(),
        serde_json::to_value(&canonical)
            .map_err(|err| format!("failed to encode saved remote connections: {err}"))?,
    );
    write_global_settings(app, &settings)?;
    let refreshed = refresh_remote_connections_blocking(app)?;
    Ok(SaveCodexManagedRemoteSshConnectionsCommandResult {
        response: SaveCodexManagedRemoteSshConnectionsResponse {
            remote_connections: canonical,
        },
        state: refreshed,
    })
}

fn save_remote_project_blocking(
    app: &AppHandle,
    params: SaveRemoteProjectParams,
) -> Result<RemoteConnectionsState, String> {
    let host_id = normalize_required_value(&params.host_id, "host_id")?;
    let remote_path = normalize_remote_project_path(&params.remote_path)?;
    let remote_connections_state = refresh_remote_connections_blocking(app)?;
    let connection = remote_connections_state
        .remote_connections
        .iter()
        .find(|connection| connection.host_id == host_id)
        .cloned()
        .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))?;

    let mut config = read_codex_app_config(app)?;
    let remote_connection = find_or_create_config_remote_connection(&mut config, &connection);
    upsert_config_remote_project(remote_connection, &remote_path);
    write_codex_app_config(app, &config)?;

    refresh_remote_connections_blocking(app)
}

fn remote_workspace_directory_entries_blocking(
    app: &AppHandle,
    params: RemoteWorkspaceDirectoryEntriesParams,
) -> Result<RemoteWorkspaceDirectoryEntriesResponse, String> {
    let host_id = normalize_required_value(&params.host_id, "host_id")?;
    let directory_path = normalize_remote_project_path(&params.directory_path)?;
    let remote_connections_state = refresh_remote_connections_blocking(app)?;
    let connection = remote_connections_state
        .remote_connections
        .iter()
        .find(|connection| connection.host_id == host_id)
        .cloned()
        .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))?;
    let quoted_path = format!("'{}'", directory_path.replace('\'', "'\\''"));
    let test_flag = if params.directories_only { "-d" } else { "-e" };
    let script = format!(
        "if [ {test_flag} {quoted_path} ]; then\n  cd {quoted_path}\n  pwd\nelse\n  exit 3\nfi"
    );
    let command = format!("sh -lc '{}'", script.replace('\'', "'\\''"));
    let output = crate::remote_ssh::run_ssh_command(&connection, &command)?;
    if !output.status.success() {
        let status = output.status.code().map_or_else(
            || "terminated without exit code".to_string(),
            |code| format!("exit code {code}"),
        );
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err(format!(
                "remote workspace directory validation failed for {}: {status}",
                connection.host_id
            ));
        }
        return Err(format!(
            "remote workspace directory validation failed for {}: {status}: {stderr}",
            connection.host_id
        ));
    }
    let stdout = String::from_utf8(output.stdout).map_err(|err| {
        format!(
            "remote workspace directory validation returned non-UTF-8 stdout for {}: {err}",
            connection.host_id
        )
    })?;
    Ok(RemoteWorkspaceDirectoryEntriesResponse {
        directory_path: normalize_remote_project_path(stdout.trim())?,
    })
}

fn shared_object_snapshot_value_blocking(app: &AppHandle, key: &str) -> Result<Value, String> {
    let state = refresh_remote_connections_blocking(app)?;
    match key {
        REMOTE_CONNECTIONS_SHARED_OBJECT_KEY => serde_json::to_value(state.remote_connections)
            .map_err(|err| format!("failed to encode remote_connections shared object: {err}")),
        REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY => {
            serde_json::to_value(state.remote_control_connections).map_err(|err| {
                format!("failed to encode remote_control_connections shared object: {err}")
            })
        }
        REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY => {
            serde_json::to_value(state.remote_control_connections_state).map_err(|err| {
                format!("failed to encode remote_control_connections_state shared object: {err}")
            })
        }
        REMOTE_PROJECTS_KEY => serde_json::to_value(state.remote_projects)
            .map_err(|err| format!("failed to encode remote-projects shared object: {err}")),
        _ => Err(format!("unsupported shared object key: {key}")),
    }
}

fn emit_shared_object_updated<T: Serialize>(
    app: &AppHandle,
    key: &str,
    value: &T,
) -> Result<(), String> {
    let value = serde_json::to_value(value)
        .map_err(|err| format!("failed to encode shared object update payload for {key}: {err}"))?;
    app.emit(
        SHARED_OBJECT_UPDATED_EVENT,
        SharedObjectUpdatedNotification {
            key: key.to_string(),
            value,
        },
    )
    .map_err(|err| format!("failed to emit shared-object-updated: {err}"))
}

fn load_remote_connections(
    saved_connections: &[SavedRemoteConnection],
    auto_connect_by_host_id: &Map<String, Value>,
) -> Result<Vec<RemoteConnection>, String> {
    let mut codex_managed = Vec::new();
    let mut discovered = Vec::new();
    let ssh_config_entrypoint = default_ssh_config_entrypoint();

    for connection in saved_connections {
        if let Some(hostname) = connection.hostname.clone() {
            codex_managed.push(RemoteConnection {
                host_id: connection.host_id.clone(),
                display_name: connection.display_name.clone(),
                source: SOURCE_CODEX_MANAGED.to_string(),
                auto_connect: is_auto_connect_enabled(auto_connect_by_host_id, &connection.host_id),
                ssh_alias: None,
                ssh_host: Some(hostname),
                ssh_port: connection.ssh_port,
                identity: connection.identity.clone(),
            });
        }
    }

    for connection in saved_connections {
        let Some(alias) = connection.alias.as_deref() else {
            continue;
        };
        let Some(mut resolved) = resolve_ssh_alias(&ssh_config_entrypoint, alias)? else {
            continue;
        };
        resolved.host_id = connection.host_id.clone();
        resolved.display_name = connection.display_name.clone();
        resolved.auto_connect =
            is_auto_connect_enabled(auto_connect_by_host_id, &connection.host_id);
        discovered.push(resolved);
    }

    codex_managed.extend(discovered);
    Ok(codex_managed)
}

fn overlay_auto_connect_on_remote_control_connections(
    remote_control_connections: Vec<RemoteControlEnvironment>,
    auto_connect_by_host_id: &Map<String, Value>,
) -> Vec<RemoteControlEnvironment> {
    remote_control_connections
        .into_iter()
        .map(|mut connection| {
            connection.auto_connect =
                is_auto_connect_enabled(auto_connect_by_host_id, &connection.host_id);
            connection
        })
        .collect()
}

fn load_saved_remote_connections(settings: &mut Map<String, Value>) -> Vec<SavedRemoteConnection> {
    let saved_value = settings
        .get(CODEX_MANAGED_REMOTE_CONNECTIONS_KEY)
        .cloned()
        .unwrap_or(Value::Array(Vec::new()));
    let Value::Array(entries) = saved_value else {
        settings.insert(
            CODEX_MANAGED_REMOTE_CONNECTIONS_KEY.to_string(),
            Value::Array(Vec::new()),
        );
        return Vec::new();
    };

    let normalized = entries
        .into_iter()
        .filter_map(|entry| serde_json::from_value::<SavedRemoteConnectionInput>(entry).ok())
        .filter_map(normalize_saved_remote_connection)
        .collect::<Vec<_>>();

    if let Ok(normalized_value) = serde_json::to_value(&normalized) {
        settings.insert(
            CODEX_MANAGED_REMOTE_CONNECTIONS_KEY.to_string(),
            normalized_value,
        );
    }

    normalized
}

fn restore_saved_alias_connections_for_existing_remote_projects(
    settings: &mut Map<String, Value>,
    saved_connections: Vec<SavedRemoteConnection>,
    remote_projects: &[RemoteProject],
    discovered_remote_connections: &[RemoteConnection],
) -> Result<Vec<SavedRemoteConnection>, String> {
    if remote_projects.is_empty() {
        return Ok(saved_connections);
    }
    let mut existing_aliases = saved_connections
        .iter()
        .filter_map(|connection| connection.alias.clone())
        .collect::<HashSet<_>>();
    let remote_project_host_ids = remote_projects
        .iter()
        .map(|project| project.host_id.clone())
        .collect::<HashSet<_>>();
    let mut next_saved_connections = saved_connections;

    for discovered in discovered_remote_connections {
        let Some(alias) = discovered.ssh_alias.clone() else {
            continue;
        };
        if existing_aliases.contains(&alias)
            || !remote_project_host_ids.contains(&discovered.host_id)
        {
            continue;
        }
        existing_aliases.insert(alias.clone());
        next_saved_connections.push(SavedRemoteConnection {
            host_id: discovered.host_id.clone(),
            display_name: discovered.display_name.clone(),
            source: SOURCE_DISCOVERED.to_string(),
            alias: Some(alias),
            hostname: None,
            ssh_port: None,
            identity: None,
        });
    }

    if let Ok(saved_value) = serde_json::to_value(&next_saved_connections) {
        settings.insert(
            CODEX_MANAGED_REMOTE_CONNECTIONS_KEY.to_string(),
            saved_value,
        );
    }
    Ok(next_saved_connections)
}

fn derive_remote_projects_from_config(
    config: &CodexAppConfig,
    saved_connections: &[SavedRemoteConnection],
    discovered_remote_connections: &[RemoteConnection],
) -> Vec<RemoteProject> {
    let mut remote_projects = Vec::new();
    let mut seen_ids = HashSet::new();

    for connection in &config.remote_connections {
        let Some(host_id) = resolve_config_remote_connection_host_id(
            connection,
            saved_connections,
            discovered_remote_connections,
        ) else {
            continue;
        };

        for project in &connection.projects {
            let Ok(remote_path) = normalize_remote_project_path(&project.remote_path) else {
                continue;
            };
            let label = trim_to_owned_option(project.label.clone())
                .unwrap_or_else(|| remote_project_label_from_path(&remote_path));
            let id = build_remote_project_id(&host_id, &remote_path);
            if seen_ids.insert(id.clone()) {
                remote_projects.push(RemoteProject {
                    id,
                    host_id: host_id.clone(),
                    remote_path,
                    label,
                });
            }
        }
    }

    remote_projects
}

fn resolve_config_remote_connection_host_id(
    connection: &CodexAppRemoteConnection,
    saved_connections: &[SavedRemoteConnection],
    discovered_remote_connections: &[RemoteConnection],
) -> Option<String> {
    if let Some(alias) = trim_to_owned_option(connection.ssh_alias.clone()) {
        if let Some(saved_connection) = saved_connections
            .iter()
            .find(|saved_connection| saved_connection.alias.as_deref() == Some(alias.as_str()))
        {
            return Some(saved_connection.host_id.clone());
        }

        if let Some(discovered_connection) =
            discovered_remote_connections
                .iter()
                .find(|discovered_connection| {
                    discovered_connection.ssh_alias.as_deref() == Some(alias.as_str())
                })
        {
            return Some(discovered_connection.host_id.clone());
        }
    }

    let hostname = trim_to_owned_option(connection.ssh_host.clone())?;
    saved_connections
        .iter()
        .find(|saved_connection| {
            saved_remote_connection_matches_config_connection(
                saved_connection,
                &hostname,
                connection,
            )
        })
        .map(|saved_connection| saved_connection.host_id.clone())
}

fn saved_remote_connection_matches_config_connection(
    saved_connection: &SavedRemoteConnection,
    hostname: &str,
    connection: &CodexAppRemoteConnection,
) -> bool {
    if saved_connection.hostname.as_deref() != Some(hostname) {
        return false;
    }

    if let Some(ssh_port) = connection.ssh_port {
        if saved_connection.ssh_port != Some(ssh_port) {
            return false;
        }
    }

    if let Some(identity) = trim_to_owned_option(connection.identity.clone()) {
        if saved_connection.identity.as_deref() != Some(identity.as_str()) {
            return false;
        }
    }

    true
}

fn find_or_create_config_remote_connection<'a>(
    config: &'a mut CodexAppConfig,
    remote_connection: &RemoteConnection,
) -> &'a mut CodexAppRemoteConnection {
    if let Some(index) = config.remote_connections.iter().position(|connection| {
        config_remote_connection_matches_remote_connection(connection, remote_connection)
    }) {
        return config
            .remote_connections
            .get_mut(index)
            .expect("remote connection index should remain valid");
    }

    config.remote_connections.push(CodexAppRemoteConnection {
        ssh_alias: remote_connection.ssh_alias.clone(),
        ssh_host: remote_connection.ssh_host.clone(),
        ssh_port: remote_connection.ssh_port,
        identity: remote_connection.identity.clone(),
        projects: Vec::new(),
        extra: Map::new(),
    });
    config
        .remote_connections
        .last_mut()
        .expect("remote connection should exist after push")
}

fn config_remote_connection_matches_remote_connection(
    connection: &CodexAppRemoteConnection,
    remote_connection: &RemoteConnection,
) -> bool {
    let connection_alias = trim_to_owned_option(connection.ssh_alias.clone());
    let remote_alias = remote_connection
        .ssh_alias
        .as_deref()
        .and_then(trim_to_owned);
    if connection_alias.is_some() || remote_alias.is_some() {
        return connection_alias == remote_alias;
    }

    trim_to_owned_option(connection.ssh_host.clone())
        == remote_connection
            .ssh_host
            .as_deref()
            .and_then(trim_to_owned)
        && connection.ssh_port == remote_connection.ssh_port
        && trim_to_owned_option(connection.identity.clone())
            == remote_connection
                .identity
                .as_deref()
                .and_then(trim_to_owned)
}

fn upsert_config_remote_project(connection: &mut CodexAppRemoteConnection, remote_path: &str) {
    let label = remote_project_label_from_path(remote_path);
    if let Some(existing_project) = connection.projects.iter_mut().find(|project| {
        normalize_remote_project_path(&project.remote_path)
            .ok()
            .as_deref()
            == Some(remote_path)
    }) {
        existing_project.remote_path = remote_path.to_string();
        if trim_to_owned_option(existing_project.label.clone()).is_none() {
            existing_project.label = Some(label);
        }
        return;
    }

    connection.projects.push(CodexAppRemoteProject {
        remote_path: remote_path.to_string(),
        label: Some(label),
        extra: Map::new(),
    });
}

fn ensure_remote_project_hosts_auto_connect(
    settings: &mut Map<String, Value>,
    remote_projects: &[RemoteProject],
) -> Map<String, Value> {
    let mut auto_connect_by_host_id = read_auto_connect_by_host_id(settings);
    let mut changed = false;

    for remote_project in remote_projects {
        if auto_connect_by_host_id
            .get(&remote_project.host_id)
            .and_then(Value::as_bool)
            != Some(true)
        {
            auto_connect_by_host_id.insert(remote_project.host_id.clone(), Value::Bool(true));
            changed = true;
        }
    }

    if changed {
        settings.insert(
            REMOTE_CONNECTION_AUTO_CONNECT_BY_HOST_ID_KEY.to_string(),
            Value::Object(auto_connect_by_host_id.clone()),
        );
    }

    auto_connect_by_host_id
}

fn sync_remote_projects_snapshot(
    settings: &mut Map<String, Value>,
    remote_projects: &[RemoteProject],
) -> Result<(), String> {
    let value = serde_json::to_value(remote_projects)
        .map_err(|err| format!("failed to encode remote-projects snapshot: {err}"))?;
    settings.insert(REMOTE_PROJECTS_KEY.to_string(), value);
    Ok(())
}

fn sync_project_order(settings: &mut Map<String, Value>, remote_projects: &[RemoteProject]) {
    let remote_project_ids = remote_projects
        .iter()
        .map(|project| project.id.clone())
        .collect::<Vec<_>>();
    let remote_project_id_set = remote_project_ids.iter().cloned().collect::<HashSet<_>>();
    let existing_order = read_string_array_raw(settings, PROJECT_ORDER_KEY);
    let mut next_order = existing_order
        .iter()
        .filter(|project_id| remote_project_id_set.contains(*project_id))
        .cloned()
        .collect::<Vec<_>>();
    let mut seen = next_order.iter().cloned().collect::<HashSet<_>>();

    for remote_project_id in remote_project_ids {
        if seen.insert(remote_project_id.clone()) {
            next_order.push(remote_project_id);
        }
    }

    next_order.extend(
        existing_order
            .into_iter()
            .filter(|project_id| !remote_project_id_set.contains(project_id)),
    );
    write_string_array_setting(settings, PROJECT_ORDER_KEY, &next_order);
}

fn write_string_array_setting(settings: &mut Map<String, Value>, key: &str, values: &[String]) {
    settings.insert(
        key.to_string(),
        Value::Array(values.iter().cloned().map(Value::String).collect()),
    );
}

fn read_string_array_raw(settings: &Map<String, Value>, key: &str) -> Vec<String> {
    match settings.get(key) {
        Some(Value::Array(entries)) => entries
            .iter()
            .filter_map(|entry| match entry {
                Value::String(value) => Some(value.clone()),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn read_auto_connect_by_host_id(settings: &Map<String, Value>) -> Map<String, Value> {
    settings
        .get(REMOTE_CONNECTION_AUTO_CONNECT_BY_HOST_ID_KEY)
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn is_auto_connect_enabled(auto_connect_by_host_id: &Map<String, Value>, host_id: &str) -> bool {
    auto_connect_by_host_id
        .get(host_id)
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn normalize_saved_remote_connection(
    input: SavedRemoteConnectionInput,
) -> Option<SavedRemoteConnection> {
    let display_name = trim_to_owned(&input.display_name)?;
    let alias = trim_to_owned_option(input.alias.or(input.ssh_alias));
    let hostname = trim_to_owned_option(input.hostname.or(input.ssh_host));

    if let Some(alias) = alias {
        return Some(SavedRemoteConnection {
            host_id: trim_to_owned_option(input.host_id)
                .unwrap_or_else(|| build_discovered_host_id(&alias)),
            display_name,
            source: SOURCE_DISCOVERED.to_string(),
            alias: Some(alias),
            hostname: None,
            ssh_port: None,
            identity: None,
        });
    }

    let hostname = hostname?;
    Some(SavedRemoteConnection {
        host_id: trim_to_owned_option(input.host_id)
            .unwrap_or_else(|| build_codex_managed_host_id(&display_name)),
        display_name,
        source: SOURCE_CODEX_MANAGED.to_string(),
        alias: None,
        hostname: Some(hostname),
        ssh_port: input.ssh_port,
        identity: trim_to_owned_option(input.identity),
    })
}

fn discover_remote_connections_from_entrypoint(
    entrypoint_path: &Path,
) -> Result<Vec<RemoteConnection>, String> {
    if !entrypoint_path.exists() {
        return Ok(Vec::new());
    }

    let discovered_aliases = collect_ssh_aliases(entrypoint_path)?;
    let filtered_aliases = discovered_aliases
        .into_iter()
        .filter(|alias| !alias.eq_ignore_ascii_case(EXCLUDED_DISCOVERED_ALIAS))
        .collect::<Vec<_>>();
    let mut discovered_connections = Vec::new();

    for alias in filtered_aliases {
        if let Some(connection) = resolve_ssh_alias(entrypoint_path, &alias)? {
            discovered_connections.push(connection);
        }
    }

    Ok(discovered_connections)
}

fn collect_ssh_aliases(entrypoint_path: &Path) -> Result<Vec<String>, String> {
    let entrypoint_path = entrypoint_path.canonicalize().map_err(|err| {
        format!("failed to resolve ssh config entrypoint {entrypoint_path:?}: {err}")
    })?;
    let ssh_config_root_directory = entrypoint_path
        .parent()
        .ok_or_else(|| {
            format!("missing parent directory for ssh config entrypoint {entrypoint_path:?}")
        })?
        .to_path_buf();
    let mut discovered_aliases = Vec::new();
    let mut discovered_alias_set = HashSet::new();
    let mut visited_config_paths = HashSet::new();
    collect_ssh_aliases_from_config(
        &entrypoint_path,
        &ssh_config_root_directory,
        &mut discovered_aliases,
        &mut discovered_alias_set,
        &mut visited_config_paths,
    )?;
    Ok(discovered_aliases)
}

fn collect_ssh_aliases_from_config(
    config_path: &Path,
    ssh_config_root_directory: &Path,
    discovered_aliases: &mut Vec<String>,
    discovered_alias_set: &mut HashSet<String>,
    visited_config_paths: &mut HashSet<PathBuf>,
) -> Result<(), String> {
    let normalized_path = config_path.to_path_buf();
    if !visited_config_paths.insert(normalized_path.clone()) {
        return Ok(());
    }

    let contents = fs::read_to_string(&normalized_path)
        .map_err(|err| format!("failed to read ssh config {normalized_path:?}: {err}"))?;
    for line in contents.lines() {
        let Some((directive, values)) = parse_ssh_directive(line) else {
            continue;
        };
        if directive.eq_ignore_ascii_case("host") {
            let alias = values
                .iter()
                .find(|value| !contains_ssh_host_pattern(value))
                .cloned();
            if let Some(alias) = alias {
                if discovered_alias_set.insert(alias.clone()) {
                    discovered_aliases.push(alias);
                }
            }
            continue;
        }

        if directive.eq_ignore_ascii_case("include") {
            for include_path in expand_include_patterns(ssh_config_root_directory, &values) {
                collect_ssh_aliases_from_config(
                    &include_path,
                    ssh_config_root_directory,
                    discovered_aliases,
                    discovered_alias_set,
                    visited_config_paths,
                )?;
            }
        }
    }

    Ok(())
}

fn parse_ssh_directive(line: &str) -> Option<(String, Vec<String>)> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }

    let mut separator_index = None;
    for (index, character) in trimmed.char_indices() {
        if character.is_whitespace() || character == '=' {
            separator_index = Some(index);
            break;
        }
    }

    let separator_index = separator_index?;
    let directive = trimmed[..separator_index].trim();
    if directive.is_empty() {
        return None;
    }
    let values = split_ssh_values(
        trimmed[separator_index..]
            .trim_start_matches(|character| matches!(character, ' ' | '\t' | '=')),
    );
    Some((directive.to_string(), values))
}

fn split_ssh_values(raw: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut escaping = false;

    for character in raw.chars() {
        if escaping {
            current.push(character);
            escaping = false;
            continue;
        }

        match character {
            '\\' => {
                escaping = true;
            }
            '"' => {
                in_quotes = !in_quotes;
            }
            '#' if !in_quotes => {
                break;
            }
            character if character.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    values.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(character),
        }
    }

    if !current.is_empty() {
        values.push(current);
    }

    values
}

fn expand_include_patterns(root_directory: &Path, include_values: &[String]) -> Vec<PathBuf> {
    let mut matches = Vec::new();

    for include_value in include_values {
        let expanded = expand_tilde(include_value);
        let resolved_pattern = if expanded.is_absolute() {
            expanded
        } else {
            root_directory.join(expanded)
        };

        if path_has_glob_characters(&resolved_pattern) {
            matches.extend(expand_glob_pattern(&resolved_pattern));
            continue;
        }

        if resolved_pattern.is_file() {
            matches.push(resolved_pattern);
        }
    }

    matches
}

fn expand_glob_pattern(pattern: &Path) -> Vec<PathBuf> {
    let (base, parts) = split_glob_pattern(pattern);
    if parts.is_empty() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    expand_glob_pattern_from(&base, &parts, &mut matches);
    matches.sort();
    matches.dedup();
    matches
}

fn split_glob_pattern(pattern: &Path) -> (PathBuf, Vec<String>) {
    let mut base = PathBuf::new();
    let mut parts = Vec::new();

    for component in pattern.components() {
        match component {
            Component::Prefix(prefix) => base.push(prefix.as_os_str()),
            Component::RootDir => base.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => parts.push("..".to_string()),
            Component::Normal(value) => parts.push(value.to_string_lossy().into_owned()),
        }
    }

    (base, parts)
}

fn expand_glob_pattern_from(base: &Path, parts: &[String], matches: &mut Vec<PathBuf>) {
    let Some((part, remaining)) = parts.split_first() else {
        if base.is_file() {
            matches.push(base.to_path_buf());
        }
        return;
    };

    if part == "**" {
        expand_glob_pattern_from(base, remaining, matches);
        if let Ok(entries) = fs::read_dir(base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    expand_glob_pattern_from(&path, parts, matches);
                }
            }
        }
        return;
    }

    if !path_component_has_glob_characters(part) {
        let next = base.join(part);
        if remaining.is_empty() {
            if next.is_file() {
                matches.push(next);
            }
        } else if next.is_dir() {
            expand_glob_pattern_from(&next, remaining, matches);
        }
        return;
    }

    let Ok(entries) = fs::read_dir(base) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if !matches_glob_component(&file_name, part) {
            continue;
        }
        if remaining.is_empty() {
            if path.is_file() {
                matches.push(path);
            }
        } else if path.is_dir() {
            expand_glob_pattern_from(&path, remaining, matches);
        }
    }
}

fn matches_glob_component(candidate: &str, pattern: &str) -> bool {
    let candidate_chars = candidate.chars().collect::<Vec<_>>();
    let pattern_chars = pattern.chars().collect::<Vec<_>>();
    matches_glob_component_from(&candidate_chars, &pattern_chars, 0, 0)
}

fn matches_glob_component_from(
    candidate: &[char],
    pattern: &[char],
    candidate_index: usize,
    pattern_index: usize,
) -> bool {
    if pattern_index == pattern.len() {
        return candidate_index == candidate.len();
    }

    match pattern[pattern_index] {
        '*' => {
            for next_candidate_index in candidate_index..=candidate.len() {
                if matches_glob_component_from(
                    candidate,
                    pattern,
                    next_candidate_index,
                    pattern_index + 1,
                ) {
                    return true;
                }
            }
            false
        }
        '?' => {
            candidate_index < candidate.len()
                && matches_glob_component_from(
                    candidate,
                    pattern,
                    candidate_index + 1,
                    pattern_index + 1,
                )
        }
        '[' => {
            let Some((matches, next_pattern_index)) =
                match_glob_character_class(candidate, pattern, candidate_index, pattern_index)
            else {
                return candidate_index < candidate.len()
                    && candidate[candidate_index] == '['
                    && matches_glob_component_from(
                        candidate,
                        pattern,
                        candidate_index + 1,
                        pattern_index + 1,
                    );
            };
            matches
                && matches_glob_component_from(
                    candidate,
                    pattern,
                    candidate_index + 1,
                    next_pattern_index,
                )
        }
        expected => {
            candidate_index < candidate.len()
                && candidate[candidate_index] == expected
                && matches_glob_component_from(
                    candidate,
                    pattern,
                    candidate_index + 1,
                    pattern_index + 1,
                )
        }
    }
}

fn match_glob_character_class(
    candidate: &[char],
    pattern: &[char],
    candidate_index: usize,
    pattern_index: usize,
) -> Option<(bool, usize)> {
    if candidate_index >= candidate.len() {
        return Some((false, pattern.len()));
    }

    let mut class_index = pattern_index + 1;
    let mut negated = false;
    if class_index < pattern.len() && pattern[class_index] == '!' {
        negated = true;
        class_index += 1;
    }

    let mut class_matches = false;
    while class_index < pattern.len() {
        let current = pattern[class_index];
        if current == ']' {
            return Some((
                (if negated {
                    !class_matches
                } else {
                    class_matches
                }),
                class_index + 1,
            ));
        }
        if current == candidate[candidate_index] {
            class_matches = true;
        }
        class_index += 1;
    }

    None
}

fn resolve_ssh_alias(
    entrypoint_path: &Path,
    ssh_alias: &str,
) -> Result<Option<RemoteConnection>, String> {
    let output = Command::new("ssh")
        .args(["-G", "-F"])
        .arg(entrypoint_path)
        .arg(ssh_alias)
        .output()
        .map_err(|err| format!("failed to resolve discovered SSH alias {ssh_alias}: {err}"))?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let resolved = parse_resolved_ssh_config(&stdout);
    let Some(hostname) = trim_to_owned_option(resolved.hostname) else {
        return Ok(None);
    };
    if hostname.eq_ignore_ascii_case(EXCLUDED_DISCOVERED_HOSTNAME) {
        return Ok(None);
    }

    Ok(Some(RemoteConnection {
        host_id: build_discovered_host_id(ssh_alias),
        display_name: ssh_alias.to_string(),
        source: SOURCE_DISCOVERED.to_string(),
        auto_connect: false,
        ssh_alias: Some(ssh_alias.to_string()),
        ssh_host: Some(hostname),
        ssh_port: resolved.port,
        identity: trim_to_owned_option(resolved.identity),
    }))
}

fn parse_resolved_ssh_config(stdout: &str) -> ResolvedSshConfig {
    let mut resolved = ResolvedSshConfig::default();

    for line in stdout.lines() {
        let Some((directive, values)) = parse_ssh_directive(line) else {
            continue;
        };
        let Some(value) = values.first().cloned() else {
            continue;
        };

        if directive.eq_ignore_ascii_case("hostname") && resolved.hostname.is_none() {
            resolved.hostname = Some(value);
            continue;
        }

        if directive.eq_ignore_ascii_case("port") && resolved.port.is_none() {
            resolved.port = value.parse::<u16>().ok();
            continue;
        }

        if directive.eq_ignore_ascii_case("identityfile")
            && resolved.identity.is_none()
            && !value.eq_ignore_ascii_case("none")
        {
            resolved.identity = Some(value);
        }
    }

    resolved
}

fn path_has_glob_characters(path: &Path) -> bool {
    path.to_string_lossy()
        .chars()
        .any(|character| matches!(character, '*' | '?' | '[' | ']'))
}

fn path_component_has_glob_characters(path_component: &str) -> bool {
    path_component
        .chars()
        .any(|character| matches!(character, '*' | '?' | '[' | ']'))
}

fn contains_ssh_host_pattern(host: &str) -> bool {
    host.chars()
        .any(|character| matches!(character, '!' | '*' | '?' | '[' | ']'))
}

fn expand_tilde(raw: &str) -> PathBuf {
    if raw == "~" {
        return home_directory();
    }
    if raw.starts_with("~/") || raw.starts_with("~\\") {
        return home_directory().join(&raw[2..]);
    }
    PathBuf::from(raw)
}

fn home_directory() -> PathBuf {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn default_ssh_config_entrypoint() -> PathBuf {
    home_directory().join(SSH_CONFIG_DIR).join(SSH_CONFIG_FILE)
}

fn build_codex_managed_host_id(display_name: &str) -> String {
    format!(
        "{REMOTE_SSH_CODEX_MANAGED_PREFIX}{}",
        encode_uri_component(display_name)
    )
}

fn build_discovered_host_id(ssh_alias: &str) -> String {
    format!(
        "{REMOTE_SSH_DISCOVERED_PREFIX}{}",
        encode_uri_component(ssh_alias)
    )
}

fn encode_uri_component(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => encoded.push(char::from(*byte)),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn build_remote_project_id(host_id: &str, remote_path: &str) -> String {
    format!(
        "remote-project:{}:{}",
        encode_uri_component(host_id),
        encode_uri_component(remote_path)
    )
}

fn normalize_required_value(value: &str, parameter_name: &str) -> Result<String, String> {
    trim_to_owned(value).ok_or_else(|| format!("{parameter_name} is empty"))
}

fn normalize_remote_project_path(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("remote project path is empty".to_string());
    }
    if !trimmed.starts_with('/') {
        return Err("remote project path must be absolute".to_string());
    }

    let mut normalized_segments = Vec::new();
    for segment in trimmed.split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            if normalized_segments.pop().is_none() {
                return Err("remote project path cannot traverse above root".to_string());
            }
            continue;
        }
        normalized_segments.push(segment);
    }

    if normalized_segments.is_empty() {
        return Ok("/".to_string());
    }

    Ok(format!("/{}", normalized_segments.join("/")))
}

fn remote_project_label_from_path(remote_path: &str) -> String {
    remote_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .next_back()
        .map(ToString::to_string)
        .unwrap_or_else(|| "/".to_string())
}

fn trim_to_owned(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn trim_to_owned_option(value: Option<String>) -> Option<String> {
    value.and_then(|value| trim_to_owned(&value))
}

#[cfg(test)]
mod tests {
    use super::app_server_connection_state_for_registry;
    use super::build_codex_managed_host_id;
    use super::build_discovered_host_id;
    use super::collect_ssh_aliases;
    use super::default_ssh_config_entrypoint;
    use super::expand_glob_pattern;
    use super::load_remote_connections;
    use super::map_app_server_connection_error;
    use super::normalize_saved_remote_connection;
    use super::overlay_auto_connect_on_remote_control_connections;
    use super::parse_resolved_ssh_config;
    use super::split_ssh_values;
    use super::AppServerConnectionError;
    use super::AppServerConnectionState;
    use super::AppServerConnectionStateParams;
    use super::AppServerConnectionStateResponse;
    use super::RemoteConnection;
    use super::SavedRemoteConnection;
    use super::SavedRemoteConnectionInput;
    use super::SetRemoteConnectionAutoConnectResponse;
    use super::SharedObjectSnapshotResponse;
    use crate::remote_control::RemoteControlEnvironment;
    use serde_json::json;
    use serde_json::Map;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory {
        path: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be after unix epoch")
                .as_nanos();
            let path =
                std::env::temp_dir().join(format!("codex-app-replica-remote-connections-{unique}"));
            fs::create_dir_all(&path).expect("test directory should be created");
            Self { path }
        }

        fn write_file(&self, relative_path: &str, contents: &str) -> PathBuf {
            let path = self.path.join(relative_path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("parent directory should be created");
            }
            fs::write(&path, contents).expect("file should be written");
            path
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn host_id_builders_match_extracted_prefixes() {
        assert_eq!(
            build_codex_managed_host_id("Demo Host"),
            "remote-ssh-codex-managed:Demo%20Host".to_string()
        );
        assert_eq!(
            build_discovered_host_id("demo-alias"),
            "remote-ssh-discovered:demo-alias".to_string()
        );
    }

    #[test]
    fn normalize_saved_remote_connection_prefers_alias_shape() {
        let connection = normalize_saved_remote_connection(SavedRemoteConnectionInput {
            host_id: None,
            display_name: " Alias Connection ".to_string(),
            source: Some("ignored".to_string()),
            alias: Some("demo-alias".to_string()),
            hostname: Some("ignored.example.com".to_string()),
            ssh_port: Some(22),
            identity: Some("ignored".to_string()),
            ssh_alias: None,
            ssh_host: None,
        })
        .expect("alias connection should normalize");

        assert_eq!(
            connection,
            SavedRemoteConnection {
                host_id: "remote-ssh-discovered:demo-alias".to_string(),
                display_name: "Alias Connection".to_string(),
                source: "discovered".to_string(),
                alias: Some("demo-alias".to_string()),
                hostname: None,
                ssh_port: None,
                identity: None,
            }
        );
    }

    #[test]
    fn normalize_saved_remote_connection_accepts_legacy_ssh_host_fields() {
        let connection = normalize_saved_remote_connection(SavedRemoteConnectionInput {
            host_id: Some("host-123".to_string()),
            display_name: "Manual Host".to_string(),
            source: None,
            alias: None,
            hostname: None,
            ssh_port: Some(2200),
            identity: Some(" ~/.ssh/id_demo ".to_string()),
            ssh_alias: None,
            ssh_host: Some(" example.com ".to_string()),
        })
        .expect("manual host should normalize");

        assert_eq!(
            connection,
            SavedRemoteConnection {
                host_id: "host-123".to_string(),
                display_name: "Manual Host".to_string(),
                source: "codex-managed".to_string(),
                alias: None,
                hostname: Some("example.com".to_string()),
                ssh_port: Some(2200),
                identity: Some("~/.ssh/id_demo".to_string()),
            }
        );
    }

    #[test]
    fn load_remote_connections_applies_auto_connect_flags() {
        let saved_connections = vec![SavedRemoteConnection {
            host_id: "remote-ssh-codex-managed:demo".to_string(),
            display_name: "Demo Host".to_string(),
            source: "codex-managed".to_string(),
            alias: None,
            hostname: Some("demo.example.com".to_string()),
            ssh_port: Some(2200),
            identity: Some("~/.ssh/id_demo".to_string()),
        }];
        let mut auto_connect_by_host_id = Map::new();
        auto_connect_by_host_id.insert("remote-ssh-codex-managed:demo".to_string(), json!(true));

        let remote_connections =
            load_remote_connections(&saved_connections, &auto_connect_by_host_id)
                .expect("remote connections should load");

        assert_eq!(
            remote_connections,
            vec![RemoteConnection {
                host_id: "remote-ssh-codex-managed:demo".to_string(),
                display_name: "Demo Host".to_string(),
                source: "codex-managed".to_string(),
                auto_connect: true,
                ssh_alias: None,
                ssh_host: Some("demo.example.com".to_string()),
                ssh_port: Some(2200),
                identity: Some("~/.ssh/id_demo".to_string()),
            }]
        );
    }

    #[test]
    fn remote_control_connections_apply_auto_connect_flags() {
        let remote_control_connections = vec![RemoteControlEnvironment {
            host_id: "remote-control:env-1".to_string(),
            display_name: "Office Mac".to_string(),
            host_name: Some("MacBook Pro".to_string()),
            auto_connect: false,
            source: "remote-control".to_string(),
            env_id: "env-1".to_string(),
            environment_kind: Some("desktop".to_string()),
            online: true,
            busy: false,
            os: Some("darwin".to_string()),
            arch: Some("arm64".to_string()),
            app_server_version: Some("0.129.0".to_string()),
            last_seen_at: Some("2026-05-20T00:00:00Z".to_string()),
        }];
        let mut auto_connect_by_host_id = Map::new();
        auto_connect_by_host_id.insert("remote-control:env-1".to_string(), json!(true));

        let remote_control_connections = overlay_auto_connect_on_remote_control_connections(
            remote_control_connections,
            &auto_connect_by_host_id,
        );

        assert_eq!(
            remote_control_connections,
            vec![RemoteControlEnvironment {
                host_id: "remote-control:env-1".to_string(),
                display_name: "Office Mac".to_string(),
                host_name: Some("MacBook Pro".to_string()),
                auto_connect: true,
                source: "remote-control".to_string(),
                env_id: "env-1".to_string(),
                environment_kind: Some("desktop".to_string()),
                online: true,
                busy: false,
                os: Some("darwin".to_string()),
                arch: Some("arm64".to_string()),
                app_server_version: Some("0.129.0".to_string()),
                last_seen_at: Some("2026-05-20T00:00:00Z".to_string()),
            }]
        );
    }

    #[test]
    fn split_ssh_values_honors_quotes_and_comments() {
        assert_eq!(
            split_ssh_values(r#""alias one" alias-two # comment"#),
            vec!["alias one".to_string(), "alias-two".to_string()]
        );
    }

    #[test]
    fn parse_resolved_ssh_config_reads_first_hostname_port_and_identity() {
        let resolved = parse_resolved_ssh_config(
            "hostname example.com\nport 2222\nidentityfile ~/.ssh/id_demo\nidentityfile ~/.ssh/id_other\n",
        );

        assert_eq!(
            resolved,
            super::ResolvedSshConfig {
                hostname: Some("example.com".to_string()),
                port: Some(2222),
                identity: Some("~/.ssh/id_demo".to_string()),
            }
        );
    }

    #[test]
    fn collect_ssh_aliases_reads_includes_and_skips_wildcards() {
        let test_directory = TestDirectory::new();
        let entrypoint = test_directory.write_file(
            ".ssh/config",
            "Include config.d/*.conf\nHost demo-alias *.wildcard\n  HostName example.com\n",
        );
        test_directory.write_file(
            ".ssh/config.d/extra.conf",
            "Host included-alias\n  HostName included.example.com\n",
        );

        let aliases = collect_ssh_aliases(&entrypoint).expect("aliases should be collected");

        assert_eq!(
            aliases,
            vec!["included-alias".to_string(), "demo-alias".to_string()]
        );
    }

    #[test]
    fn expand_glob_pattern_matches_relative_files() {
        let test_directory = TestDirectory::new();
        test_directory.write_file("config.d/one.conf", "");
        test_directory.write_file("config.d/two.conf", "");
        test_directory.write_file("config.d/skip.txt", "");

        let matches = expand_glob_pattern(&test_directory.path().join("config.d").join("*.conf"));
        let mut file_names = matches
            .iter()
            .filter_map(|path| path.file_name())
            .map(|name| name.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        file_names.sort();

        assert_eq!(
            file_names,
            vec!["one.conf".to_string(), "two.conf".to_string()]
        );
    }

    #[test]
    fn default_ssh_config_entrypoint_ends_with_expected_segments() {
        let entrypoint = default_ssh_config_entrypoint();
        let entrypoint_string = entrypoint.to_string_lossy();

        assert!(entrypoint_string.contains(".ssh"));
        assert!(entrypoint_string.ends_with("config"));
    }

    #[test]
    fn app_server_connection_state_response_serializes_to_upstream_shape() {
        let response = AppServerConnectionStateResponse {
            state: AppServerConnectionState::Disconnected,
            error: None,
            app_server_version: None,
            installed_codex_version: None,
        };

        assert_eq!(
            serde_json::to_value(&response).expect("response should serialize"),
            json!({
                "state": "disconnected",
                "error": null,
                "appServerVersion": null,
                "installedCodexVersion": null
            })
        );
    }

    #[test]
    fn set_remote_connection_auto_connect_response_serializes_to_upstream_shape() {
        let response = SetRemoteConnectionAutoConnectResponse {
            remote_connections: vec![RemoteConnection {
                host_id: "remote-ssh-discovered:demo-alias".to_string(),
                display_name: "Demo Alias".to_string(),
                source: "discovered".to_string(),
                auto_connect: true,
                ssh_alias: Some("demo-alias".to_string()),
                ssh_host: Some("demo.example.com".to_string()),
                ssh_port: Some(2222),
                identity: Some("~/.ssh/id_demo".to_string()),
            }],
            state: AppServerConnectionState::Connected,
            error: None,
        };

        assert_eq!(
            serde_json::to_value(&response).expect("response should serialize"),
            json!({
                "remoteConnections": [
                    {
                        "hostId": "remote-ssh-discovered:demo-alias",
                        "displayName": "Demo Alias",
                        "source": "discovered",
                        "autoConnect": true,
                        "sshAlias": "demo-alias",
                        "sshHost": "demo.example.com",
                        "sshPort": 2222,
                        "identity": "~/.ssh/id_demo"
                    }
                ],
                "state": "connected",
                "error": null
            })
        );
    }

    #[test]
    fn shared_object_snapshot_response_serializes_to_upstream_shape() {
        assert_eq!(
            serde_json::to_value(SharedObjectSnapshotResponse {
                value: json!([{ "hostId": "remote-ssh-discovered:demo" }]),
            })
            .expect("snapshot response should serialize"),
            json!({
                "value": [
                    {
                        "hostId": "remote-ssh-discovered:demo"
                    }
                ]
            })
        );
    }

    #[tokio::test]
    async fn app_server_connection_state_defaults_to_disconnected_without_registry() {
        let registry = crate::remote_app_server_registry::RemoteAppServerRegistry::default();
        let response = app_server_connection_state_for_registry(
            &registry,
            &AppServerConnectionStateParams {
                host_id: "remote-ssh-discovered:demo-alias".to_string(),
            },
        );

        assert_eq!(
            response,
            AppServerConnectionStateResponse {
                state: AppServerConnectionState::Disconnected,
                error: None,
                app_server_version: None,
                installed_codex_version: None,
            }
        );
    }

    #[test]
    fn app_server_connection_error_maps_restart_required_from_parse_error() {
        assert_eq!(
            map_app_server_connection_error("Parse Error: expected value"),
            AppServerConnectionError::RestartRequired {
                current_version: None,
                installed_version: None,
            }
        );
    }

    #[test]
    fn app_server_connection_error_maps_restart_required_from_version_restart_message() {
        assert_eq!(
            map_app_server_connection_error(
                "codex-app-server-version-restart-available:0.128.0:0.129.0"
            ),
            AppServerConnectionError::RestartRequired {
                current_version: Some("0.128.0".to_string()),
                installed_version: Some("0.129.0".to_string()),
            }
        );
    }

    #[test]
    fn app_server_connection_error_maps_update_required_from_unsupported_version_message() {
        assert_eq!(
            map_app_server_connection_error("codex-app-server-version-unsupported:0.128.0"),
            AppServerConnectionError::UpdateRequired {
                min_required_version: env!("CARGO_PKG_VERSION").to_string(),
                current_version: "0.128.0".to_string(),
            }
        );
    }

    #[test]
    fn app_server_connection_error_preserves_generic_connection_failures() {
        assert_eq!(
            map_app_server_connection_error("ssh handshake failed"),
            AppServerConnectionError::ConnectionFailed {
                message: "ssh handshake failed".to_string(),
            }
        );
    }
}
