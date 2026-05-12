use crate::remote_connections::read_remote_connection_by_host_id;
use crate::remote_ssh::run_ssh_command;
use crate::worktrees::{CodexWorktreeEntry, CodexWorktreesResponse, WorktreeDeleteResponse};
use std::process::Output;
use tauri::AppHandle;

pub(crate) fn list_remote_codex_worktrees(
    app: &AppHandle,
    host_id: &str,
) -> Result<CodexWorktreesResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let command = remote_shell_command(
        r#"set -eu
codex_home=${CODEX_HOME:-"$HOME/.codex"}
worktrees_root="$codex_home/worktrees"
if [ ! -d "$worktrees_root" ]; then
  exit 0
fi
find "$worktrees_root" \( -type d -name '.git' -o -type f -name '.git' \) -print | while IFS= read -r git_metadata_path
do
  [ -n "$git_metadata_path" ] || continue
  worktree_dir=$(dirname "$git_metadata_path")
  if [ -d "$git_metadata_path" ]; then
    git_dir=$(cd "$git_metadata_path" && pwd -P)
  else
    git_dir_value=$(sed -n 's/^gitdir:[[:space:]]*//p' "$git_metadata_path" | head -n 1)
    if [ -z "$git_dir_value" ]; then
      echo ".git file does not contain a gitdir entry: $git_metadata_path" >&2
      exit 5
    fi
    case "$git_dir_value" in
      /*) git_candidate="$git_dir_value" ;;
      *) git_candidate="$worktree_dir/$git_dir_value" ;;
    esac
    git_dir=$(cd "$git_candidate" && pwd -P)
  fi
  worktree_dir=$(cd "$worktree_dir" && pwd -P)
  printf '%s\0%s\0' "$worktree_dir" "$git_dir"
done"#,
    );
    let output = ensure_ssh_success(
        &connection,
        "list remote codex worktrees",
        run_ssh_command(&connection, &command)?,
    )?;
    let mut worktrees = parse_remote_worktrees_output(&connection, &output)?;
    worktrees.sort();
    worktrees.dedup();
    Ok(CodexWorktreesResponse { worktrees })
}

pub(crate) fn delete_remote_worktree(
    app: &AppHandle,
    host_id: &str,
    worktree: &str,
) -> Result<WorktreeDeleteResponse, String> {
    let connection = read_remote_connection(app, host_id)?;
    let remote_worktree = normalize_remote_absolute_path(worktree, "worktree-delete path")?;
    let command = remote_shell_command(&format!(
        r#"set -eu
target={target}
codex_home=${{CODEX_HOME:-"$HOME/.codex"}}
worktrees_root="$codex_home/worktrees"
if [ -d "$worktrees_root" ]; then
  worktrees_root=$(cd "$worktrees_root" && pwd -P)
fi
if [ ! -e "$target" ]; then
  exit 0
fi
if [ ! -d "$target" ]; then
  echo "worktree-delete path is not a directory: $target" >&2
  exit 6
fi
target=$(cd "$target" && pwd -P)
if [ "$target" = "$worktrees_root" ]; then
  echo "worktree-delete cannot remove the CODEX_HOME/worktrees root" >&2
  exit 7
fi
case "$target" in
  "$worktrees_root"/*) rm -rf -- "$target" ;;
  *)
    echo "worktree-delete path must stay under $worktrees_root: $target" >&2
    exit 8
    ;;
esac"#,
        target = quote_posix(&remote_worktree),
    ));
    ensure_ssh_success(
        &connection,
        "delete remote worktree",
        run_ssh_command(&connection, &command)?,
    )?;
    Ok(WorktreeDeleteResponse {})
}

fn read_remote_connection(
    app: &AppHandle,
    host_id: &str,
) -> Result<crate::remote_connections::RemoteConnection, String> {
    read_remote_connection_by_host_id(app, host_id)?
        .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))
}

fn parse_remote_worktrees_output(
    connection: &crate::remote_connections::RemoteConnection,
    output: &Output,
) -> Result<Vec<CodexWorktreeEntry>, String> {
    let fields = output
        .stdout
        .split(|byte| *byte == b'\0')
        .filter(|field| !field.is_empty())
        .collect::<Vec<_>>();
    if fields.len() % 2 != 0 {
        return Err(format!(
            "remote codex-worktrees returned an invalid payload for {}",
            connection.host_id
        ));
    }

    let mut worktrees = Vec::new();
    for pair in fields.chunks_exact(2) {
        let dir = decode_utf8_field(connection, "worktree dir", pair[0])?;
        let git_dir = decode_utf8_field(connection, "worktree git dir", pair[1])?;
        worktrees.push(CodexWorktreeEntry { dir, git_dir });
    }
    Ok(worktrees)
}

fn decode_utf8_field(
    connection: &crate::remote_connections::RemoteConnection,
    field_name: &str,
    bytes: &[u8],
) -> Result<String, String> {
    String::from_utf8(bytes.to_vec()).map_err(|err| {
        format!(
            "remote {field_name} returned non-UTF-8 output for {}: {err}",
            connection.host_id
        )
    })
}

fn normalize_remote_absolute_path(path: &str, parameter_name: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(format!("{parameter_name} is empty"));
    }
    if !trimmed.starts_with('/') {
        return Err(format!("{parameter_name} must be absolute: {trimmed}"));
    }
    Ok(normalize_posix_path(trimmed))
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
    use super::normalize_remote_absolute_path;

    #[test]
    fn normalize_remote_absolute_path_rejects_relative_values() {
        assert_eq!(
            normalize_remote_absolute_path("/srv/demo/../repo", "worktree-delete path"),
            Ok("/srv/repo".to_string())
        );
        assert_eq!(
            normalize_remote_absolute_path("relative", "worktree-delete path"),
            Err("worktree-delete path must be absolute: relative".to_string())
        );
    }
}
