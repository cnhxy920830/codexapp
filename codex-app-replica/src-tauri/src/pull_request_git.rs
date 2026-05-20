use crate::hosted_command::run_hosted_command;
use crate::pull_requests::ErrorEnvelope;
use serde::Deserialize;
use serde::Serialize;
use tauri::AppHandle;
const SUCCESS_STATUS: &str = "success";
const ERROR_STATUS: &str = "error";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestGitObjectParams {
    pub cwd: String,
    pub host_id: Option<String>,
    pub object_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestGitObjectSuccess {
    pub status: &'static str,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum PullRequestGitObjectResponse {
    Success(PullRequestGitObjectSuccess),
    Error(ErrorEnvelope),
}

#[tauri::command(rename = "gh-pr-file-content")]
pub async fn gh_pr_file_content(
    app: AppHandle,
    params: PullRequestGitObjectParams,
) -> Result<PullRequestGitObjectResponse, String> {
    match read_git_object(
        &app,
        params.host_id.as_deref(),
        &params.cwd,
        &params.object_id,
    )
    .await
    {
        Ok(contents) => Ok(PullRequestGitObjectResponse::Success(
            PullRequestGitObjectSuccess {
                status: SUCCESS_STATUS,
                contents,
            },
        )),
        Err(err) => Ok(PullRequestGitObjectResponse::Error(error_envelope(err))),
    }
}

fn error_envelope(error: String) -> ErrorEnvelope {
    ErrorEnvelope {
        status: ERROR_STATUS,
        error,
    }
}

async fn read_git_object(
    app: &AppHandle,
    host_id: Option<&str>,
    cwd: &str,
    object_id: &str,
) -> Result<String, String> {
    let cwd = normalize_required_string(cwd, "cwd")?;
    let object_id = normalize_required_string(object_id, "objectId")?;
    let output = run_hosted_command(
        app,
        host_id,
        "git",
        vec!["cat-file".to_string(), "-p".to_string(), object_id],
        Some(cwd),
        &[],
        "Git is not installed.",
    )
    .await?;
    Ok(output.stdout)
}

fn normalize_required_string(value: &str, field_name: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field_name} is empty"));
    }

    Ok(trimmed.to_string())
}
