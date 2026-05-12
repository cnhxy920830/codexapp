use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::AppHandle;

use crate::codex_home::resolve_codex_home;

const LOCAL_HOST_ID: &str = "local";
const CODEX_WORKTREES_DIR: &str = "worktrees";
const SETTINGS_DELETE_TARGETED_REASON: &str = "settings-delete-targeted";
const WORKTREE_THREAD_CONFIG_FILE: &str = "codex-thread.json";
const WORKTREE_THREAD_CONFIG_VERSION: u32 = 1;

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexWorktreesParams {
    pub host_config: WorktreeHostConfig,
    pub operation_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeHostConfig {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexWorktreesResponse {
    pub worktrees: Vec<CodexWorktreeEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct CodexWorktreeEntry {
    pub dir: String,
    pub git_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeSetOwnerThreadParams {
    pub host_id: Option<String>,
    pub worktree: String,
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeSetOwnerThreadResponse {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WorktreeThreadConfig {
    version: u32,
    owner_thread_id: String,
}

#[tauri::command(rename = "worktree-delete")]
pub fn worktree_delete(
    app: AppHandle,
    params: WorktreeDeleteParams,
) -> Result<WorktreeDeleteResponse, String> {
    let host_id = normalize_requested_host_id(params.host_id.as_deref());
    ensure_supported_reason(&params.reason)?;
    if host_id != LOCAL_HOST_ID {
        return crate::worktrees_remote::delete_remote_worktree(&app, &host_id, &params.worktree);
    }

    let codex_home = resolve_codex_home()?;
    let validated_path = validate_worktree_delete_path(&params.worktree, &codex_home)?;
    delete_worktree_directory(&validated_path)?;

    Ok(WorktreeDeleteResponse {})
}

#[tauri::command(rename = "codex-worktrees")]
pub fn codex_worktrees(
    app: AppHandle,
    params: CodexWorktreesParams,
) -> Result<CodexWorktreesResponse, String> {
    let host_id = normalize_requested_host_id(Some(params.host_config.id.as_str()));
    ensure_non_empty_operation_source(&params.operation_source, "codex-worktrees")?;
    if host_id != LOCAL_HOST_ID {
        return crate::worktrees_remote::list_remote_codex_worktrees(&app, &host_id);
    }

    let worktrees_root = resolve_codex_home()?.join(CODEX_WORKTREES_DIR);
    Ok(CodexWorktreesResponse {
        worktrees: collect_codex_worktrees(&worktrees_root)?,
    })
}

#[tauri::command(rename = "worktree-set-owner-thread")]
pub fn worktree_set_owner_thread(
    params: WorktreeSetOwnerThreadParams,
) -> Result<WorktreeSetOwnerThreadResponse, String> {
    ensure_local_host_id(params.host_id.as_deref(), "worktree-set-owner-thread")?;
    let conversation_id = validate_conversation_id(&params.conversation_id)?;

    let codex_home = resolve_codex_home()?;
    let validated_path = validate_worktree_owner_thread_path(&params.worktree, &codex_home)?;
    write_worktree_owner_thread_config(&validated_path, conversation_id)?;

    Ok(WorktreeSetOwnerThreadResponse::default())
}

fn ensure_local_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn normalize_requested_host_id(host_id: Option<&str>) -> String {
    host_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(LOCAL_HOST_ID)
        .to_string()
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

fn ensure_non_empty_operation_source(
    operation_source: &str,
    command_name: &str,
) -> Result<(), String> {
    if operation_source.trim().is_empty() {
        return Err(format!("{command_name} operationSource is empty"));
    }

    Ok(())
}

fn validate_conversation_id(conversation_id: &str) -> Result<&str, String> {
    let trimmed = conversation_id.trim();
    if trimmed.is_empty() {
        return Err("worktree-set-owner-thread conversationId is empty".to_string());
    }

    Ok(trimmed)
}

fn validate_worktree_delete_path(worktree: &str, codex_home: &Path) -> Result<PathBuf, String> {
    validate_worktree_path_under_codex_home(worktree, codex_home, "worktree-delete")
}

fn validate_worktree_owner_thread_path(
    worktree: &str,
    codex_home: &Path,
) -> Result<PathBuf, String> {
    let normalized_target =
        validate_worktree_path_under_codex_home(worktree, codex_home, "worktree-set-owner-thread")?;
    ensure_existing_directory(&normalized_target, "worktree-set-owner-thread")?;
    ensure_git_metadata_exists(&normalized_target)?;

    Ok(normalized_target)
}

fn validate_worktree_path_under_codex_home(
    worktree: &str,
    codex_home: &Path,
    command_name: &str,
) -> Result<PathBuf, String> {
    let trimmed = worktree.trim();
    if trimmed.is_empty() {
        return Err(format!("{command_name} path is empty"));
    }

    let candidate = Path::new(trimmed);
    if !candidate.is_absolute() {
        return Err(format!("{command_name} path must be absolute: {trimmed}"));
    }

    let normalized_target = normalize_existing_or_lexical(candidate)?;
    let normalized_root = normalize_existing_or_lexical(codex_home.join(CODEX_WORKTREES_DIR))?;

    if normalized_target == normalized_root {
        return if command_name == "worktree-delete" {
            Err(format!(
                "worktree-delete cannot remove the CODEX_HOME/{CODEX_WORKTREES_DIR} root"
            ))
        } else {
            Err(format!(
                "{command_name} path cannot target the CODEX_HOME/{CODEX_WORKTREES_DIR} root"
            ))
        };
    }
    if !normalized_target.starts_with(&normalized_root) {
        return Err(format!(
            "{command_name} path must stay under {}: {}",
            normalized_root.display(),
            normalized_target.display()
        ));
    }

    Ok(normalized_target)
}

fn ensure_existing_directory(path: &Path, command_name: &str) -> Result<(), String> {
    if !path.exists() {
        return Err(format!(
            "{command_name} path does not exist: {}",
            path.display()
        ));
    }

    let metadata = fs::metadata(path).map_err(|err| {
        format!(
            "failed to read worktree metadata for {}: {err}",
            path.display()
        )
    })?;
    if !metadata.is_dir() {
        return Err(format!(
            "{command_name} path is not a directory: {}",
            path.display()
        ));
    }

    Ok(())
}

fn ensure_git_metadata_exists(path: &Path) -> Result<(), String> {
    let git_metadata_path = path.join(".git");
    if git_metadata_path.exists() {
        return Ok(());
    }

    Err(format!(
        "worktree-set-owner-thread path is missing .git metadata: {}",
        path.display()
    ))
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

fn collect_codex_worktrees(worktrees_root: &Path) -> Result<Vec<CodexWorktreeEntry>, String> {
    if !worktrees_root.exists() {
        return Ok(Vec::new());
    }
    if !worktrees_root.is_dir() {
        return Err(format!(
            "CODEX_HOME/worktrees is not a directory: {}",
            worktrees_root.display()
        ));
    }

    let mut worktrees = Vec::new();
    collect_codex_worktrees_recursive(worktrees_root, &mut worktrees)?;
    worktrees.sort();
    Ok(worktrees)
}

fn collect_codex_worktrees_recursive(
    current_dir: &Path,
    worktrees: &mut Vec<CodexWorktreeEntry>,
) -> Result<(), String> {
    if let Some(entry) = read_worktree_entry(current_dir)? {
        worktrees.push(entry);
        return Ok(());
    }

    for entry in fs::read_dir(current_dir)
        .map_err(|err| format!("failed to read worktrees directory: {err}"))?
    {
        let entry = entry.map_err(|err| format!("failed to read worktree entry: {err}"))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|err| format!("failed to read worktree entry metadata: {err}"))?;
        if metadata.is_dir() {
            collect_codex_worktrees_recursive(&path, worktrees)?;
        }
    }

    Ok(())
}

fn read_worktree_entry(worktree_dir: &Path) -> Result<Option<CodexWorktreeEntry>, String> {
    let git_metadata_path = worktree_dir.join(".git");
    if !git_metadata_path.exists() {
        return Ok(None);
    }

    let git_dir = resolve_git_dir(&git_metadata_path)?;
    let dir = normalize_existing_or_lexical(worktree_dir)?;

    Ok(Some(CodexWorktreeEntry {
        dir: dir.display().to_string(),
        git_dir: git_dir.display().to_string(),
    }))
}

fn resolve_git_dir(git_metadata_path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::metadata(git_metadata_path).map_err(|err| {
        format!(
            "failed to read .git metadata for {}: {err}",
            git_metadata_path.display()
        )
    })?;

    if metadata.is_dir() {
        return normalize_existing_or_lexical(git_metadata_path);
    }
    if metadata.is_file() {
        return resolve_git_dir_from_file(git_metadata_path);
    }

    Err(format!(
        ".git metadata is neither a file nor directory: {}",
        git_metadata_path.display()
    ))
}

fn resolve_git_dir_from_file(git_metadata_path: &Path) -> Result<PathBuf, String> {
    let contents = fs::read_to_string(git_metadata_path).map_err(|err| {
        format!(
            "failed to read .git file for {}: {err}",
            git_metadata_path.display()
        )
    })?;
    let gitdir_prefix = "gitdir:";
    let git_dir_value = contents
        .lines()
        .find_map(|line| line.strip_prefix(gitdir_prefix))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                ".git file does not contain a gitdir entry: {}",
                git_metadata_path.display()
            )
        })?;

    let candidate = Path::new(git_dir_value);
    let resolved = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        git_metadata_path
            .parent()
            .ok_or_else(|| {
                format!(
                    ".git file has no parent directory: {}",
                    git_metadata_path.display()
                )
            })?
            .join(candidate)
    };

    normalize_existing_or_lexical(resolved)
}

fn write_worktree_owner_thread_config(
    worktree_root: &Path,
    conversation_id: &str,
) -> Result<(), String> {
    let config = WorktreeThreadConfig {
        version: WORKTREE_THREAD_CONFIG_VERSION,
        owner_thread_id: conversation_id.to_string(),
    };
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|err| format!("failed to serialize worktree thread config: {err}"))?;
    let config_path = worktree_root.join(WORKTREE_THREAD_CONFIG_FILE);

    fs::write(&config_path, format!("{serialized}\n")).map_err(|err| {
        format!(
            "failed to write worktree owner-thread config {}: {err}",
            config_path.display()
        )
    })
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
    fn codex_worktrees_params_accept_upstream_shape() {
        let params: CodexWorktreesParams = serde_json::from_value(serde_json::json!({
            "hostConfig": { "id": "local" },
            "operationSource": "worktrees_settings_page"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            CodexWorktreesParams {
                host_config: WorktreeHostConfig {
                    id: "local".to_string(),
                },
                operation_source: "worktrees_settings_page".to_string(),
            }
        );
    }

    #[test]
    fn worktree_set_owner_thread_params_accept_upstream_shape() {
        let params: WorktreeSetOwnerThreadParams = serde_json::from_value(serde_json::json!({
            "hostId": "local",
            "worktree": "D:/Users/example/.codex/worktrees/20260508/demo",
            "conversationId": "conversation-123"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            WorktreeSetOwnerThreadParams {
                host_id: Some("local".to_string()),
                worktree: "D:/Users/example/.codex/worktrees/20260508/demo".to_string(),
                conversation_id: "conversation-123".to_string(),
            }
        );
    }

    #[test]
    fn normalize_requested_host_id_defaults_to_local() {
        assert_eq!(normalize_requested_host_id(None), "local");
        assert_eq!(normalize_requested_host_id(Some("")), "local");
        assert_eq!(normalize_requested_host_id(Some("local")), "local");
        assert_eq!(normalize_requested_host_id(Some("remote")), "remote");
    }

    #[test]
    fn worktree_set_owner_thread_only_accepts_local_host() {
        assert!(ensure_local_host_id(None, "worktree-set-owner-thread").is_ok());
        assert!(ensure_local_host_id(Some(""), "worktree-set-owner-thread").is_ok());
        assert!(ensure_local_host_id(Some("local"), "worktree-set-owner-thread").is_ok());
        assert_eq!(
            ensure_local_host_id(Some("remote"), "worktree-set-owner-thread")
                .expect_err("non-local host id should be rejected"),
            "worktree-set-owner-thread does not support host id: remote"
        );
    }

    #[test]
    fn codex_worktrees_rejects_blank_operation_source() {
        assert_eq!(
            ensure_non_empty_operation_source("  ", "codex-worktrees")
                .expect_err("blank operation source should be rejected"),
            "codex-worktrees operationSource is empty"
        );
    }

    #[test]
    fn worktree_set_owner_thread_rejects_blank_conversation_id() {
        assert_eq!(
            validate_conversation_id("  ").expect_err("blank conversation id should be rejected"),
            "worktree-set-owner-thread conversationId is empty"
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
    fn worktree_set_owner_thread_path_requires_git_metadata() {
        let codex_home = temp_codex_home("owner-thread");
        let worktree_dir = codex_home
            .join(CODEX_WORKTREES_DIR)
            .join("20260509")
            .join("demo");
        fs::create_dir_all(&worktree_dir).expect("worktree directory should be created");

        let error =
            validate_worktree_owner_thread_path(&worktree_dir.to_string_lossy(), &codex_home)
                .expect_err("missing .git metadata should be rejected");

        assert!(
            error.starts_with("worktree-set-owner-thread path is missing .git metadata: "),
            "unexpected error: {error}"
        );
        assert!(
            error.contains("worktrees") && error.contains("20260509") && error.contains("demo"),
            "unexpected error: {error}"
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

    #[test]
    fn write_worktree_owner_thread_config_writes_upstream_json_shape() {
        let worktree_dir = temp_codex_home("write-owner-thread")
            .join(CODEX_WORKTREES_DIR)
            .join("20260509")
            .join("demo");
        fs::create_dir_all(&worktree_dir).expect("worktree directory should be created");
        fs::write(worktree_dir.join(".git"), "gitdir: ../.git/worktrees/demo")
            .expect("git metadata fixture should be written");

        write_worktree_owner_thread_config(&worktree_dir, "conversation-123")
            .expect("config file should be written");

        let config_path = worktree_dir.join(WORKTREE_THREAD_CONFIG_FILE);
        let contents = fs::read_to_string(&config_path).expect("config file should be readable");
        assert_eq!(
            contents,
            "{\n  \"version\": 1,\n  \"ownerThreadId\": \"conversation-123\"\n}\n"
        );

        let parsed: WorktreeThreadConfig =
            serde_json::from_str(&contents).expect("config file should deserialize");
        assert_eq!(
            parsed,
            WorktreeThreadConfig {
                version: WORKTREE_THREAD_CONFIG_VERSION,
                owner_thread_id: "conversation-123".to_string(),
            }
        );

        let codex_home = worktree_dir
            .ancestors()
            .nth(3)
            .expect("codex home ancestor should exist");
        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn collect_codex_worktrees_returns_sorted_entries_with_git_file_and_directory_metadata() {
        let codex_home = temp_codex_home("codex-worktrees");
        let worktrees_root = codex_home.join(CODEX_WORKTREES_DIR);
        let alpha = worktrees_root.join("20260509").join("alpha");
        let beta = worktrees_root.join("20260510").join("beta");
        let ignored = worktrees_root.join("20260511").join("ignored");

        fs::create_dir_all(alpha.join(".git")).expect("alpha .git directory should be created");
        fs::create_dir_all(&beta).expect("beta directory should be created");
        let beta_git_dir = codex_home
            .join("repos")
            .join("demo")
            .join(".git")
            .join("worktrees")
            .join("beta");
        fs::create_dir_all(&beta_git_dir).expect("beta resolved git dir should be created");
        fs::write(
            beta.join(".git"),
            format!("gitdir: {}\n", beta_git_dir.display()),
        )
        .expect("beta .git file should be written");
        fs::create_dir_all(&ignored).expect("ignored directory should be created");

        let worktrees = collect_codex_worktrees(&worktrees_root).expect("worktrees should collect");

        assert_eq!(
            worktrees,
            vec![
                CodexWorktreeEntry {
                    dir: alpha
                        .canonicalize()
                        .expect("alpha canonical path should resolve")
                        .display()
                        .to_string(),
                    git_dir: alpha
                        .join(".git")
                        .canonicalize()
                        .expect("alpha git dir should resolve")
                        .display()
                        .to_string(),
                },
                CodexWorktreeEntry {
                    dir: beta
                        .canonicalize()
                        .expect("beta canonical path should resolve")
                        .display()
                        .to_string(),
                    git_dir: beta_git_dir
                        .canonicalize()
                        .expect("beta git dir should resolve")
                        .display()
                        .to_string(),
                },
            ]
        );

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn collect_codex_worktrees_returns_empty_when_root_is_missing() {
        let codex_home = temp_codex_home("codex-worktrees-missing");
        let worktrees_root = codex_home.join(CODEX_WORKTREES_DIR);

        let worktrees =
            collect_codex_worktrees(&worktrees_root).expect("missing root should be empty");

        assert!(worktrees.is_empty(), "unexpected worktrees: {worktrees:?}");
    }

    #[test]
    fn collect_codex_worktrees_rejects_invalid_git_file_shape() {
        let codex_home = temp_codex_home("codex-worktrees-invalid-git");
        let worktree_dir = codex_home
            .join(CODEX_WORKTREES_DIR)
            .join("20260509")
            .join("demo");
        fs::create_dir_all(&worktree_dir).expect("worktree directory should be created");
        fs::write(worktree_dir.join(".git"), "not-a-gitdir-line\n")
            .expect("invalid .git file should be written");

        let error = collect_codex_worktrees(&codex_home.join(CODEX_WORKTREES_DIR))
            .expect_err("invalid git file should fail");

        assert!(
            error.starts_with(".git file does not contain a gitdir entry: "),
            "unexpected error: {error}"
        );

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
