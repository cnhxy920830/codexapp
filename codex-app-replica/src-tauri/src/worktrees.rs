use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::codex_home::resolve_codex_home;

const LOCAL_HOST_ID: &str = "local";
const CODEX_WORKTREES_DIR: &str = "worktrees";
const SETTINGS_DELETE_TARGETED_REASON: &str = "settings-delete-targeted";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDeleteParams {
    pub host_id: Option<String>,
    pub worktree: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDeleteResponse {}

#[tauri::command(rename = "worktree-delete")]
pub fn worktree_delete(params: WorktreeDeleteParams) -> Result<WorktreeDeleteResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "worktree-delete")?;
    ensure_supported_reason(&params.reason)?;

    let codex_home = resolve_codex_home()?;
    let validated_path = validate_worktree_delete_path(&params.worktree, &codex_home)?;
    delete_worktree_directory(&validated_path)?;

    Ok(WorktreeDeleteResponse {})
}

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn ensure_supported_reason(reason: &str) -> Result<(), String> {
    let trimmed = reason.trim();
    if trimmed == SETTINGS_DELETE_TARGETED_REASON {
        return Ok(());
    }

    Err(format!(
        "worktree-delete does not support reason: {trimmed}"
    ))
}

fn validate_worktree_delete_path(worktree: &str, codex_home: &Path) -> Result<PathBuf, String> {
    let trimmed = worktree.trim();
    if trimmed.is_empty() {
        return Err("worktree-delete path is empty".to_string());
    }

    let candidate = Path::new(trimmed);
    if !candidate.is_absolute() {
        return Err(format!("worktree-delete path must be absolute: {trimmed}"));
    }

    let normalized_target = normalize_existing_or_lexical(candidate)?;
    let normalized_root = normalize_existing_or_lexical(codex_home.join(CODEX_WORKTREES_DIR))?;

    if normalized_target == normalized_root {
        return Err(format!(
            "worktree-delete cannot remove the CODEX_HOME/{CODEX_WORKTREES_DIR} root"
        ));
    }
    if !normalized_target.starts_with(&normalized_root) {
        return Err(format!(
            "worktree-delete path must stay under {}: {}",
            normalized_root.display(),
            normalized_target.display()
        ));
    }

    Ok(normalized_target)
}

fn normalize_existing_or_lexical(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path.as_ref();
    if path.exists() {
        return path
            .canonicalize()
            .map_err(|err| format!("failed to resolve path: {err}"));
    }

    Ok(normalize_path_lexically(path))
}

fn normalize_path_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push(component.as_os_str());
                }
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    normalized
}

fn delete_worktree_directory(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(path).map_err(|err| {
        format!(
            "failed to read worktree metadata for {}: {err}",
            path.display()
        )
    })?;
    if !metadata.is_dir() {
        return Err(format!(
            "worktree-delete path is not a directory: {}",
            path.display()
        ));
    }

    fs::remove_dir_all(path)
        .map_err(|err| format!("failed to delete worktree {}: {err}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn worktree_delete_params_accept_upstream_shape() {
        let params: WorktreeDeleteParams = serde_json::from_value(serde_json::json!({
            "hostId": "local",
            "worktree": "D:/Users/example/.codex/worktrees/20260508/demo",
            "reason": "settings-delete-targeted"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            WorktreeDeleteParams {
                host_id: Some("local".to_string()),
                worktree: "D:/Users/example/.codex/worktrees/20260508/demo".to_string(),
                reason: "settings-delete-targeted".to_string(),
            }
        );
    }

    #[test]
    fn worktree_delete_only_accepts_local_host() {
        assert!(ensure_supported_host_id(None, "worktree-delete").is_ok());
        assert!(ensure_supported_host_id(Some(""), "worktree-delete").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "worktree-delete").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "worktree-delete")
                .expect_err("non-local host id should be rejected"),
            "worktree-delete does not support host id: remote"
        );
    }

    #[test]
    fn worktree_delete_only_accepts_page_owned_reason() {
        assert!(ensure_supported_reason("settings-delete-targeted").is_ok());
        assert_eq!(
            ensure_supported_reason("cleanup").expect_err("unexpected reasons should be rejected"),
            "worktree-delete does not support reason: cleanup"
        );
    }

    #[test]
    fn worktree_delete_path_must_stay_under_codex_home_worktrees() {
        let codex_home = temp_codex_home("validate");
        let outside = codex_home
            .parent()
            .expect("codex home parent should exist")
            .join("outside-worktree");

        let error = validate_worktree_delete_path(&outside.to_string_lossy(), &codex_home)
            .expect_err("path outside CODEX_HOME/worktrees should be rejected");

        assert!(
            error.contains("worktree-delete path must stay under"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn worktree_delete_rejects_worktrees_root() {
        let codex_home = temp_codex_home("root");
        let worktrees_root = codex_home.join(CODEX_WORKTREES_DIR);
        fs::create_dir_all(&worktrees_root).expect("worktrees root should be created");

        let error = validate_worktree_delete_path(&worktrees_root.to_string_lossy(), &codex_home)
            .expect_err("worktrees root should be rejected");

        assert_eq!(
            error,
            "worktree-delete cannot remove the CODEX_HOME/worktrees root"
        );

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn delete_worktree_directory_removes_existing_directory() {
        let worktree_dir = temp_codex_home("delete")
            .join(CODEX_WORKTREES_DIR)
            .join("20260508")
            .join("demo");
        fs::create_dir_all(&worktree_dir).expect("worktree directory should be created");
        fs::write(worktree_dir.join("README.md"), "demo").expect("fixture file should be written");

        delete_worktree_directory(&worktree_dir).expect("directory should be removed");

        assert!(
            !worktree_dir.exists(),
            "worktree directory should no longer exist"
        );

        let codex_home = worktree_dir
            .ancestors()
            .nth(3)
            .expect("codex home ancestor should exist");
        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn delete_worktree_directory_is_idempotent_for_missing_paths() {
        let worktree_dir = temp_codex_home("missing")
            .join(CODEX_WORKTREES_DIR)
            .join("20260508")
            .join("demo");

        delete_worktree_directory(&worktree_dir).expect("missing worktree should be ignored");

        let codex_home = worktree_dir
            .ancestors()
            .nth(3)
            .expect("codex home ancestor should exist");
        let _ = fs::remove_dir_all(codex_home);
    }

    fn temp_codex_home(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        env::temp_dir().join(format!(
            "codex-app-replica-worktrees-{case_name}-{unique_suffix}"
        ))
    }
}
