use crate::pull_requests::ErrorEnvelope;
use serde::Deserialize;
use serde::Serialize;
use std::process::Command;
use tauri::async_runtime::spawn_blocking;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const LOCAL_HOST_ID: &str = "local";
const SUCCESS_STATUS: &str = "success";
const ERROR_STATUS: &str = "error";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
    params: PullRequestGitObjectParams,
) -> Result<PullRequestGitObjectResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "gh-pr-file-content")?;

    match read_git_object(&params.cwd, &params.object_id).await {
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

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

async fn read_git_object(cwd: &str, object_id: &str) -> Result<String, String> {
    let cwd = normalize_required_string(cwd, "cwd")?;
    let object_id = normalize_required_string(object_id, "objectId")?;
    let join_result = spawn_blocking(move || {
        let mut command = Command::new("git");
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        command.args(["cat-file", "-p", &object_id]);
        command.current_dir(cwd);

        let output = command.output().map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => "Git is not installed.".to_string(),
            _ => format!("failed to launch Git: {err}"),
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let detail = if stderr.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                stderr.trim().to_string()
            };
            let status = output
                .status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            return Err(format!(
                "git cat-file exited with status {status}: {detail}"
            ));
        }

        String::from_utf8(output.stdout)
            .map_err(|err| format!("git object is not valid UTF-8: {err}"))
    })
    .await;

    join_result.map_err(|err| format!("failed to join Git task: {err}"))?
}

fn normalize_required_string(value: &str, field_name: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field_name} is empty"));
    }

    Ok(trimmed.to_string())
}
