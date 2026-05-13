use crate::git_origins::{GitOrigin, GitOriginsResponse};
use crate::remote_connections::read_remote_connection_by_host_id;
use crate::remote_ssh::run_ssh_command;
use std::process::Output;
use tauri::AppHandle;

pub(crate) fn resolve_remote_git_origins(
    app: &AppHandle,
    host_id: &str,
    dirs: Vec<String>,
) -> Result<GitOriginsResponse, String> {
    let connection = resolve_remote_connection(app, host_id)?;
    let origins = dirs
        .into_iter()
        .map(|dir| resolve_remote_git_origin(&connection, dir))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(GitOriginsResponse { origins })
}

fn resolve_remote_connection(
    app: &AppHandle,
    host_id: &str,
) -> Result<crate::remote_connections::RemoteConnection, String> {
    read_remote_connection_by_host_id(app, host_id)?
        .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))
}

fn resolve_remote_git_origin(
    connection: &crate::remote_connections::RemoteConnection,
    dir: String,
) -> Result<GitOrigin, String> {
    let Some(remote_dir) = normalize_remote_dir(&dir) else {
        return Ok(GitOrigin {
            dir,
            root: None,
            origin_url: None,
        });
    };

    let command = remote_shell_command(&format!(
        r#"set -eu
dir={dir}
if [ ! -d "$dir" ]; then
  printf '%s\0%s' '' ''
  exit 0
fi
root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)
origin=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
printf '%s\0%s' "$root" "$origin""#,
        dir = quote_posix(&remote_dir),
    ));
    let output = ensure_ssh_success(
        connection,
        "read remote git origin",
        run_ssh_command(connection, &command)?,
    )?;
    let (root, origin_url) = parse_remote_git_origin_output(connection, &output)?;

    Ok(GitOrigin {
        dir,
        root,
        origin_url,
    })
}

fn normalize_remote_dir(dir: &str) -> Option<String> {
    let trimmed = dir.trim();
    if trimmed.is_empty() || !trimmed.starts_with('/') {
        return None;
    }
    Some(normalize_posix_path(trimmed))
}

fn parse_remote_git_origin_output(
    connection: &crate::remote_connections::RemoteConnection,
    output: &Output,
) -> Result<(Option<String>, Option<String>), String> {
    let fields = output
        .stdout
        .splitn(2, |byte| *byte == b'\0')
        .collect::<Vec<_>>();
    let root = decode_optional_utf8_field(connection, "git root", fields.first().copied())?;
    let origin_url =
        decode_optional_utf8_field(connection, "git origin url", fields.get(1).copied())?;
    Ok((root, origin_url))
}

fn decode_optional_utf8_field(
    connection: &crate::remote_connections::RemoteConnection,
    field_name: &str,
    bytes: Option<&[u8]>,
) -> Result<Option<String>, String> {
    let Some(bytes) = bytes else {
        return Ok(None);
    };
    let value = String::from_utf8(bytes.to_vec()).map_err(|err| {
        format!(
            "remote {field_name} returned non-UTF-8 output for {}: {err}",
            connection.host_id
        )
    })?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Ok(Some(trimmed.to_string()))
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

fn remote_shell_command(script: &str) -> String {
    format!("sh -lc {}", quote_posix(script))
}

fn quote_posix(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::normalize_remote_dir;

    #[test]
    fn normalize_remote_dir_requires_absolute_posix_paths() {
        assert_eq!(
            normalize_remote_dir("/srv/demo/../repo"),
            Some("/srv/repo".to_string())
        );
        assert_eq!(normalize_remote_dir("relative"), None);
        assert_eq!(normalize_remote_dir(" "), None);
    }
}
