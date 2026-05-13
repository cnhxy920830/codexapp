use serde::Deserialize;
use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::async_runtime::spawn_blocking;
use tauri::AppHandle;

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
pub async fn git_origins(
    app: AppHandle,
    params: GitOriginsParams,
) -> Result<GitOriginsResponse, String> {
    let host_id = normalize_requested_host_id(params.host_id.as_deref());
    let dirs = params.dirs.unwrap_or_default();
    let blocking_app = app.clone();

    spawn_blocking(move || {
        if host_id == LOCAL_HOST_ID {
            return Ok(GitOriginsResponse {
                origins: dirs.into_iter().map(resolve_git_origin).collect::<Vec<_>>(),
            });
        }

        crate::git_origins_remote::resolve_remote_git_origins(&blocking_app, &host_id, dirs)
    })
    .await
    .map_err(|error| format!("failed to resolve git origins: {error}"))?
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

fn normalize_requested_host_id(host_id: Option<&str>) -> String {
    host_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(LOCAL_HOST_ID)
        .to_string()
}

fn apply_no_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}
