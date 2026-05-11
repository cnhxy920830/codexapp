use crate::open_targets::ensure_supported_host_id;
use serde::Deserialize;
use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::async_runtime::spawn_blocking;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const LOCAL_HOST_ID: &str = "local";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitOriginsParams {
    pub dirs: Option<Vec<String>>,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitOrigin {
    pub dir: String,
    pub root: Option<String>,
    pub origin_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitOriginsResponse {
    pub origins: Vec<GitOrigin>,
}

#[tauri::command(rename = "git-origins")]
pub async fn git_origins(params: GitOriginsParams) -> Result<GitOriginsResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-origins")?;

    let dirs = params.dirs.unwrap_or_default();
    let origins = spawn_blocking(move || dirs.into_iter().map(resolve_git_origin).collect::<Vec<_>>())
        .await
        .map_err(|error| format!("failed to resolve git origins: {error}"))?;

    Ok(GitOriginsResponse { origins })
}

fn resolve_git_origin(dir: String) -> GitOrigin {
    let trimmed = dir.trim();
    if trimmed.is_empty() {
        return GitOrigin {
            dir,
            root: None,
            origin_url: None,
        };
    }

    let root = run_git(trimmed, &["rev-parse", "--show-toplevel"]).ok();
    let origin_url = run_git(trimmed, &["remote", "get-url", "origin"]).ok();

    GitOrigin {
        dir,
        root,
        origin_url,
    }
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    apply_no_window(&mut command);
    let output = command
        .arg("-C")
        .arg(Path::new(cwd))
        .args(args)
        .output()
        .map_err(|error| format!("failed to run git: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("git exited with {}", output.status)
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn apply_no_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}
