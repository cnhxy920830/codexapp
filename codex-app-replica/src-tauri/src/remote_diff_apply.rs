use codex_git_utils::apply_git_patch;
use codex_git_utils::ApplyGitRequest;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPatchParams {
    pub diff: String,
    pub cwd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_config: Option<Value>,
    #[serde(default)]
    pub revert: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ApplyPatchStatus {
    Success,
    PartialSuccess,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ApplyPatchErrorCode {
    NotGitRepo,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPatchResponse {
    pub status: ApplyPatchStatus,
    pub applied_paths: Vec<String>,
    pub skipped_paths: Vec<String>,
    pub conflicted_paths: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_code: Option<ApplyPatchErrorCode>,
}

#[tauri::command(rename = "apply-patch")]
pub async fn apply_patch(params: ApplyPatchParams) -> Result<ApplyPatchResponse, String> {
    let cwd = params.cwd.trim();
    if cwd.is_empty() {
        return Ok(ApplyPatchResponse {
            status: ApplyPatchStatus::Error,
            applied_paths: Vec::new(),
            skipped_paths: Vec::new(),
            conflicted_paths: Vec::new(),
            error_code: None,
        });
    }

    let request = ApplyGitRequest {
        cwd: PathBuf::from(cwd),
        diff: params.diff,
        revert: params.revert,
        preflight: false,
    };

    match apply_git_patch(&request) {
        Ok(result) => {
            let status = resolve_apply_patch_status(
                &result.applied_paths,
                &result.conflicted_paths,
                result.exit_code,
            );
            Ok(ApplyPatchResponse {
                status,
                applied_paths: result.applied_paths,
                skipped_paths: result.skipped_paths,
                conflicted_paths: result.conflicted_paths,
                error_code: None,
            })
        }
        Err(err) => {
            let error_code = classify_apply_error(&err.to_string());
            Ok(ApplyPatchResponse {
                status: ApplyPatchStatus::Error,
                applied_paths: Vec::new(),
                skipped_paths: Vec::new(),
                conflicted_paths: Vec::new(),
                error_code,
            })
        }
    }
}

fn resolve_apply_patch_status(
    applied_paths: &[String],
    conflicted_paths: &[String],
    exit_code: i32,
) -> ApplyPatchStatus {
    if exit_code == 0 {
        return ApplyPatchStatus::Success;
    }
    if !applied_paths.is_empty() || !conflicted_paths.is_empty() {
        return ApplyPatchStatus::PartialSuccess;
    }
    ApplyPatchStatus::Error
}

fn classify_apply_error(message: &str) -> Option<ApplyPatchErrorCode> {
    let normalized = message.to_ascii_lowercase();
    if normalized.contains("not a git repository") {
        return Some(ApplyPatchErrorCode::NotGitRepo);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_apply_patch_status_reports_success_for_zero_exit_code() {
        let status = resolve_apply_patch_status(&[], &[], 0);
        assert_eq!(status, ApplyPatchStatus::Success);
    }

    #[test]
    fn resolve_apply_patch_status_reports_partial_success_when_some_paths_changed() {
        let status = resolve_apply_patch_status(&["src/lib.rs".to_string()], &[], 1);
        assert_eq!(status, ApplyPatchStatus::PartialSuccess);
    }

    #[test]
    fn classify_apply_error_detects_not_git_repo() {
        let error_code = classify_apply_error("not a git repository (exit 128)");
        assert_eq!(error_code, Some(ApplyPatchErrorCode::NotGitRepo));
    }
}
