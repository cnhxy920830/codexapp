use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const CODEX_DIRECTORY_NAME: &str = "Codex";
const DEFAULT_PROJECTLESS_THREAD_NAME: &str = "new-chat";
const MAX_PROJECTLESS_DIRECTORY_ATTEMPTS: u32 = 100;
const MAX_PROJECTLESS_SLUG_LENGTH: usize = 80;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectlessThreadCwdParams {
    pub directory_name: Option<String>,
    pub prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectlessThreadCwdResponse {
    pub cwd: String,
    pub output_directory: String,
    pub workspace_root: String,
}

#[tauri::command(rename = "projectless-thread-cwd")]
pub fn projectless_thread_cwd(
    app: AppHandle,
    params: Option<ProjectlessThreadCwdParams>,
) -> Result<ProjectlessThreadCwdResponse, String> {
    let documents_dir = app
        .path()
        .document_dir()
        .map_err(|err| format!("failed to resolve documents directory: {err}"))?;
    let workspace_root = documents_dir.join(CODEX_DIRECTORY_NAME);
    ensure_real_directory(&workspace_root)?;

    let dated_root = workspace_root.join(current_local_date_directory_name()?);
    ensure_real_directory(&dated_root)?;

    let slug = build_projectless_slug(params.as_ref());
    let cwd = create_unique_projectless_directory(&dated_root, &slug)?;
    let cwd_string = display_path(&cwd);
    let workspace_root_string = display_path(&workspace_root);

    Ok(ProjectlessThreadCwdResponse {
        cwd: cwd_string.clone(),
        output_directory: cwd_string,
        workspace_root: workspace_root_string,
    })
}

fn current_local_date_directory_name() -> Result<String, String> {
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Date -Format yyyy-MM-dd",
        ])
        .output()
        .map_err(|err| format!("failed to resolve current local date: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "failed to resolve current local date: {}",
            stderr.trim()
        ));
    }
    let date = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if date.is_empty() {
        return Err("failed to resolve current local date: empty output".to_string());
    }
    Ok(date)
}

fn ensure_real_directory(path: &Path) -> Result<(), String> {
    if path.exists() {
        let metadata = fs::symlink_metadata(path)
            .map_err(|err| format!("failed to stat {}: {err}", path.display()))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "projectless thread directory must be a real directory: {}",
                path.display()
            ));
        }
        return Ok(());
    }

    fs::create_dir_all(path)
        .map_err(|err| format!("failed to create {}: {err}", path.display()))?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|err| format!("failed to stat {}: {err}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "projectless thread directory must be a real directory: {}",
            path.display()
        ));
    }
    Ok(())
}

fn create_unique_projectless_directory(parent: &Path, slug: &str) -> Result<PathBuf, String> {
    for index in 0..MAX_PROJECTLESS_DIRECTORY_ATTEMPTS {
        let candidate_name = if index == 0 {
            slug.to_string()
        } else {
            format!("{slug}-{}", index + 1)
        };
        let candidate = parent.join(candidate_name);
        match fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(err) => {
                return Err(format!(
                    "failed to create projectless thread directory {}: {err}",
                    candidate.display()
                ))
            }
        }
    }

    Err("Unable to create a unique projectless thread directory".to_string())
}

fn build_projectless_slug(params: Option<&ProjectlessThreadCwdParams>) -> String {
    let source = params
        .and_then(|value| value.directory_name.as_deref())
        .or_else(|| params.and_then(|value| value.prompt.as_deref()))
        .unwrap_or_default();
    let prefer_full_directory_name = params
        .and_then(|value| value.directory_name.as_ref())
        .is_some();

    let mut parts = Vec::new();
    let mut current = String::new();
    for character in source.chars() {
        if character.is_ascii_alphanumeric() {
            current.push(character.to_ascii_lowercase());
        } else if !current.is_empty() {
            parts.push(current.clone());
            current.clear();
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }

    if parts.is_empty() {
        return DEFAULT_PROJECTLESS_THREAD_NAME.to_string();
    }

    let selected_parts = if prefer_full_directory_name {
        parts
    } else {
        parts.into_iter().take(6).collect()
    };
    let mut slug = selected_parts.join("-");
    if slug.len() > MAX_PROJECTLESS_SLUG_LENGTH {
        slug.truncate(MAX_PROJECTLESS_SLUG_LENGTH);
        while slug.ends_with('-') {
            slug.pop();
        }
    }

    if slug.is_empty() {
        DEFAULT_PROJECTLESS_THREAD_NAME.to_string()
    } else {
        slug
    }
}

fn display_path(path: &Path) -> String {
    path.display().to_string()
}

#[cfg(test)]
mod tests {
    use super::build_projectless_slug;
    use super::ProjectlessThreadCwdParams;

    #[test]
    fn projectless_slug_falls_back_to_new_chat() {
        assert_eq!(build_projectless_slug(None), "new-chat");
        assert_eq!(
            build_projectless_slug(Some(&ProjectlessThreadCwdParams {
                directory_name: None,
                prompt: Some("!!!".to_string()),
            })),
            "new-chat"
        );
    }

    #[test]
    fn projectless_slug_limits_prompt_to_six_tokens() {
        assert_eq!(
            build_projectless_slug(Some(&ProjectlessThreadCwdParams {
                directory_name: None,
                prompt: Some("One two three four five six seven eight".to_string()),
            })),
            "one-two-three-four-five-six"
        );
    }

    #[test]
    fn projectless_slug_keeps_full_directory_name_tokens() {
        assert_eq!(
            build_projectless_slug(Some(&ProjectlessThreadCwdParams {
                directory_name: Some("One two three four five six seven eight".to_string()),
                prompt: Some("ignored prompt".to_string()),
            })),
            "one-two-three-four-five-six-seven-eight"
        );
    }
}
