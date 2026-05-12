use crate::local_environments::{
    LocalEnvironmentDocument, UpstreamLocalEnvironmentConfigResponse,
    UpstreamLocalEnvironmentConfigSaveResponse, UpstreamLocalEnvironmentEntry,
    UpstreamLocalEnvironmentError, UpstreamLocalEnvironmentResponse, UpstreamLocalEnvironmentState,
    UpstreamLocalEnvironmentsResponse,
};
use crate::remote_connections::read_remote_connection_by_host_id;
use crate::remote_ssh::{run_ssh_command, run_ssh_command_with_input};
use std::process::Output;
use tauri::AppHandle;

const LOCAL_ENVIRONMENTS_DIR: &str = ".codex/environments";

pub(crate) fn list_remote_local_environments(
    app: &AppHandle,
    host_id: &str,
    workspace_root: &str,
) -> Result<UpstreamLocalEnvironmentsResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let workspace_root = normalize_remote_workspace_root(workspace_root)?;
    let paths = list_remote_environment_paths(&connection, &workspace_root)?;
    let environments = paths
        .iter()
        .map(|path| read_remote_environment_entry(&connection, path))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(UpstreamLocalEnvironmentsResponse { environments })
}

pub(crate) fn read_remote_local_environment(
    app: &AppHandle,
    host_id: &str,
    config_path: &str,
) -> Result<UpstreamLocalEnvironmentResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let config_path = normalize_remote_config_path(config_path)?;
    Ok(UpstreamLocalEnvironmentResponse {
        environment: read_remote_environment_entry(&connection, &config_path)?,
    })
}

pub(crate) fn read_remote_local_environment_config(
    app: &AppHandle,
    host_id: &str,
    config_path: &str,
) -> Result<UpstreamLocalEnvironmentConfigResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let config_path = normalize_remote_config_path(config_path)?;
    let raw = read_remote_file_if_exists(&connection, &config_path)?;
    Ok(UpstreamLocalEnvironmentConfigResponse {
        config_path,
        exists: raw.is_some(),
        raw,
    })
}

pub(crate) fn write_remote_local_environment_config(
    app: &AppHandle,
    host_id: &str,
    config_path: &str,
    raw: &str,
) -> Result<UpstreamLocalEnvironmentConfigSaveResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let config_path = normalize_remote_config_path(config_path)?;
    let parent_directory = remote_parent_directory(&config_path)?;
    let command = remote_shell_command(&format!(
        "mkdir -p {} && cat > {}",
        quote_posix(&parent_directory),
        quote_posix(&config_path)
    ));
    ensure_ssh_success(
        &connection,
        "write local environment config",
        run_ssh_command_with_input(&connection, &command, raw.as_bytes())?,
    )?;
    Ok(UpstreamLocalEnvironmentConfigSaveResponse {
        config_path,
        success: true,
    })
}

fn read_remote_connection(
    app: &AppHandle,
    host_id: &str,
) -> Result<crate::remote_connections::RemoteConnection, String> {
    read_remote_connection_by_host_id(app, host_id)?
        .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))
}

fn list_remote_environment_paths(
    connection: &crate::remote_connections::RemoteConnection,
    workspace_root: &str,
) -> Result<Vec<String>, String> {
    let command = remote_shell_command(&format!(
        "set -eu\ncurrent={workspace_root}\nif [ ! -d \"$current\" ]; then\n  echo \"workspace root is not a directory: $current\" >&2\n  exit 4\nfi\nwhile :\ndo\n  env_dir=\"$current/{LOCAL_ENVIRONMENTS_DIR}\"\n  if [ -d \"$env_dir\" ]; then\n    find \"$env_dir\" -maxdepth 1 -type f -name '*.toml' -print\n  fi\n  if [ \"$current\" = \"/\" ]; then\n    break\n  fi\n  current=$(dirname \"$current\")\ndone | LC_ALL=C sort",
        workspace_root = quote_posix(workspace_root),
    ));
    let output = ensure_ssh_success(
        connection,
        "list local environment configs",
        run_ssh_command(connection, &command)?,
    )?;
    let stdout = decode_ssh_stdout(connection, "list local environment configs", &output)?;
    let mut paths = Vec::new();
    for line in stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        paths.push(normalize_remote_config_path(line)?);
    }
    paths.dedup();
    Ok(paths)
}

fn read_remote_environment_entry(
    connection: &crate::remote_connections::RemoteConnection,
    config_path: &str,
) -> Result<UpstreamLocalEnvironmentEntry, String> {
    let owner_root = remote_owner_root_from_config_path(config_path)?;
    let raw = read_remote_file_if_exists(connection, config_path)?
        .ok_or_else(|| format!("local environment config does not exist: {config_path}"))?;
    let state = match parse_remote_local_environment_document(&raw, &owner_root) {
        Ok(environment) => UpstreamLocalEnvironmentState::Success { environment },
        Err(message) => UpstreamLocalEnvironmentState::Error {
            error: UpstreamLocalEnvironmentError { message },
        },
    };
    Ok(UpstreamLocalEnvironmentEntry {
        config_path: config_path.to_string(),
        state,
    })
}

fn read_remote_file_if_exists(
    connection: &crate::remote_connections::RemoteConnection,
    config_path: &str,
) -> Result<Option<String>, String> {
    let command = remote_shell_command(&format!(
        "if [ -f {} ]; then\n  cat {}\nelse\n  exit 3\nfi",
        quote_posix(config_path),
        quote_posix(config_path)
    ));
    let output = run_ssh_command(connection, &command)?;
    match output.status.code() {
        Some(0) => {
            decode_ssh_stdout(connection, "read local environment config", &output).map(Some)
        }
        Some(3) => Ok(None),
        _ => Err(format_ssh_failure(
            connection,
            "read local environment config",
            &output,
        )),
    }
}

fn ensure_ssh_success(
    connection: &crate::remote_connections::RemoteConnection,
    action: &str,
    output: Output,
) -> Result<Output, String> {
    if output.status.success() {
        return Ok(output);
    }
    Err(format_ssh_failure(connection, action, &output))
}

fn decode_ssh_stdout(
    connection: &crate::remote_connections::RemoteConnection,
    action: &str,
    output: &Output,
) -> Result<String, String> {
    String::from_utf8(output.stdout.clone()).map_err(|err| {
        format!(
            "{action} returned non-UTF-8 stdout for {}: {err}",
            connection.host_id
        )
    })
}

fn format_ssh_failure(
    connection: &crate::remote_connections::RemoteConnection,
    action: &str,
    output: &Output,
) -> String {
    let status = output.status.code().map_or_else(
        || "terminated without exit code".to_string(),
        |code| format!("exit code {code}"),
    );
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return format!("{action} failed for {}: {status}", connection.host_id);
    }
    format!(
        "{action} failed for {}: {status}: {stderr}",
        connection.host_id
    )
}

fn parse_remote_local_environment_document(
    contents: &str,
    owner_root: &str,
) -> Result<LocalEnvironmentDocument, String> {
    toml::from_str::<LocalEnvironmentDocument>(contents)
        .map(|document| normalize_remote_local_environment_document(document, owner_root))
        .map_err(|err| format!("failed to parse local environment config: {err}"))
}

fn normalize_remote_local_environment_document(
    mut document: LocalEnvironmentDocument,
    owner_root: &str,
) -> LocalEnvironmentDocument {
    if document.version == 0 {
        document.version = 1;
    }
    if document.name.trim().is_empty() {
        document.name = remote_path_label(owner_root);
    }
    document
}

fn normalize_remote_workspace_root(workspace_root: &str) -> Result<String, String> {
    let trimmed = workspace_root.trim();
    if trimmed.is_empty() {
        return Err("workspace root is empty".to_string());
    }
    if !trimmed.starts_with('/') {
        return Err(format!(
            "remote workspace root must be an absolute POSIX path: {trimmed}"
        ));
    }
    Ok(normalize_posix_path(trimmed))
}

fn normalize_remote_config_path(config_path: &str) -> Result<String, String> {
    let trimmed = config_path.trim();
    if trimmed.is_empty() {
        return Err("local environment config path is empty".to_string());
    }
    if !trimmed.starts_with('/') {
        return Err(format!(
            "remote local environment config path must be an absolute POSIX path: {trimmed}"
        ));
    }
    let normalized = normalize_posix_path(trimmed);
    let _ = remote_owner_root_from_config_path(&normalized)?;
    Ok(normalized)
}

fn remote_owner_root_from_config_path(config_path: &str) -> Result<String, String> {
    let normalized = normalize_posix_path(config_path);
    if !normalized.ends_with(".toml") {
        return Err(format!(
            "local environment config path must be a TOML file: {normalized}"
        ));
    }

    let segments = split_posix_segments(&normalized);
    let segment_count = segments.len();
    if segment_count < 3
        || segments[segment_count - 2] != "environments"
        || segments[segment_count - 3] != ".codex"
    {
        return Err(format!(
            "local environment config path must live under .codex/environments: {normalized}"
        ));
    }

    let owner_segments = &segments[..segment_count - 3];
    if owner_segments.is_empty() {
        return Ok("/".to_string());
    }
    Ok(format!("/{}", owner_segments.join("/")))
}

fn remote_parent_directory(config_path: &str) -> Result<String, String> {
    let normalized = normalize_posix_path(config_path);
    let parent = normalized
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or_default();
    if parent.is_empty() {
        return Err(format!(
            "local environment config path has no parent directory: {normalized}"
        ));
    }
    Ok(parent.to_string())
}

fn normalize_posix_path(path: &str) -> String {
    let mut segments = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                if !segments.is_empty() {
                    segments.pop();
                }
            }
            _ => segments.push(segment),
        }
    }
    if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    }
}

fn split_posix_segments(path: &str) -> Vec<&str> {
    path.split('/')
        .filter(|segment| !segment.is_empty())
        .collect()
}

fn remote_path_label(path: &str) -> String {
    split_posix_segments(path)
        .last()
        .map_or_else(|| "local".to_string(), |segment| (*segment).to_string())
}

fn remote_shell_command(script: &str) -> String {
    format!("sh -lc {}", quote_posix(script))
}

fn quote_posix(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
