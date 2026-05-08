use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

const LOCAL_HOST_ID: &str = "local";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorkspaceAgentsMdParams {
    pub workspace_root: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteWorkspaceAgentsMdParams {
    pub workspace_root: Option<String>,
    pub contents: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAgentsMdParams {
    pub host_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAgentsMdSaveParams {
    pub host_id: Option<String>,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAgentsMdDocumentResponse {
    pub path: String,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAgentsMdPathResponse {
    pub path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MissingAgentsMdBehavior {
    ReturnNone,
    ReturnEmptyDocument,
}

#[tauri::command]
pub fn read_workspace_agents_md(
    params: ReadWorkspaceAgentsMdParams,
) -> Result<Option<WorkspaceAgentsMdDocumentResponse>, String> {
    read_workspace_agents_md_document(
        params.workspace_root.as_deref(),
        MissingAgentsMdBehavior::ReturnNone,
    )
}

#[tauri::command]
pub fn write_workspace_agents_md(
    params: WriteWorkspaceAgentsMdParams,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    write_workspace_agents_md_document(params.workspace_root.as_deref(), params.contents)
}

#[tauri::command(rename = "codex-agents-md")]
pub fn codex_agents_md(
    params: CodexAgentsMdParams,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "codex-agents-md")?;
    read_workspace_agents_md_document(None, MissingAgentsMdBehavior::ReturnEmptyDocument)?
        .ok_or_else(|| "failed to resolve AGENTS.md document".to_string())
}

#[tauri::command(rename = "codex-agents-md-save")]
pub fn codex_agents_md_save(
    params: CodexAgentsMdSaveParams,
) -> Result<WorkspaceAgentsMdPathResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "codex-agents-md-save")?;
    let document = write_workspace_agents_md_document(None, params.contents)?;
    Ok(WorkspaceAgentsMdPathResponse {
        path: document.path,
    })
}

fn read_workspace_agents_md_document(
    workspace_root: Option<&str>,
    missing_behavior: MissingAgentsMdBehavior,
) -> Result<Option<WorkspaceAgentsMdDocumentResponse>, String> {
    let path = resolve_agents_md_path(workspace_root)?;
    read_workspace_agents_md_document_from_path(path, missing_behavior)
}

fn read_workspace_agents_md_document_from_path(
    path: PathBuf,
    missing_behavior: MissingAgentsMdBehavior,
) -> Result<Option<WorkspaceAgentsMdDocumentResponse>, String> {
    if !path.is_file() {
        return match missing_behavior {
            MissingAgentsMdBehavior::ReturnNone => Ok(None),
            MissingAgentsMdBehavior::ReturnEmptyDocument => {
                Ok(Some(WorkspaceAgentsMdDocumentResponse {
                    path: path.display().to_string(),
                    contents: String::new(),
                }))
            }
        };
    }

    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read AGENTS.md: {err}"))?;
    Ok(Some(WorkspaceAgentsMdDocumentResponse {
        path: path.display().to_string(),
        contents,
    }))
}

fn write_workspace_agents_md_document(
    workspace_root: Option<&str>,
    contents: String,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    let path = resolve_agents_md_path(workspace_root)?;
    write_workspace_agents_md_document_to_path(path, contents)
}

fn write_workspace_agents_md_document_to_path(
    path: PathBuf,
    contents: String,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "AGENTS.md path has no parent directory".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "workspace root is not a directory: {}",
            parent.display()
        ));
    }

    fs::write(&path, contents.as_bytes())
        .map_err(|err| format!("failed to write AGENTS.md: {err}"))?;
    Ok(WorkspaceAgentsMdDocumentResponse {
        path: path.display().to_string(),
        contents,
    })
}

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn resolve_agents_md_path(workspace_root: Option<&str>) -> Result<PathBuf, String> {
    if let Some(workspace_root) = workspace_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return resolve_workspace_agents_md_path(Path::new(workspace_root));
    }

    let current_dir =
        env::current_dir().map_err(|err| format!("failed to resolve current directory: {err}"))?;
    if let Some(path) = find_agents_md_in_ancestors(&current_dir) {
        return Ok(path);
    }

    Ok(current_dir.join("AGENTS.md"))
}

fn resolve_workspace_agents_md_path(workspace_root: &Path) -> Result<PathBuf, String> {
    if !workspace_root.exists() {
        return Err(format!(
            "workspace root does not exist: {}",
            workspace_root.display()
        ));
    }
    if !workspace_root.is_dir() {
        return Err(format!(
            "workspace root is not a directory: {}",
            workspace_root.display()
        ));
    }
    Ok(workspace_root.join("AGENTS.md"))
}

fn find_agents_md_in_ancestors(start: &Path) -> Option<PathBuf> {
    for path in start.ancestors() {
        let candidate = path.join("AGENTS.md");
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn codex_agents_read_returns_empty_document_when_file_is_missing() {
        let path = temp_agents_md_path("missing");
        let document = read_workspace_agents_md_document_from_path(
            path.clone(),
            MissingAgentsMdBehavior::ReturnEmptyDocument,
        )
        .expect("read should succeed")
        .expect("document should exist");

        assert_eq!(
            document,
            WorkspaceAgentsMdDocumentResponse {
                path: path.display().to_string(),
                contents: String::new(),
            }
        );
    }

    #[test]
    fn codex_agents_save_returns_path_only_response() {
        let path = temp_agents_md_path("save");
        fs::create_dir_all(path.parent().expect("path should have parent"))
            .expect("parent directory should be created");

        let document =
            write_workspace_agents_md_document_to_path(path.clone(), "instructions".to_string())
                .expect("write should succeed");

        assert_eq!(
            WorkspaceAgentsMdPathResponse {
                path: document.path.clone(),
            },
            WorkspaceAgentsMdPathResponse {
                path: path.display().to_string(),
            }
        );
        assert_eq!(document.contents, "instructions");
        assert_eq!(
            fs::read_to_string(&path).expect("saved file should be readable"),
            "instructions"
        );
        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir_all(path.parent().expect("path should have parent"));
    }

    #[test]
    fn codex_agents_commands_only_accept_local_host() {
        assert!(ensure_supported_host_id(None, "codex-agents-md").is_ok());
        assert!(ensure_supported_host_id(Some(""), "codex-agents-md").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "codex-agents-md").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "codex-agents-md")
                .expect_err("non-local host id should be rejected"),
            "codex-agents-md does not support host id: remote"
        );
    }

    fn temp_agents_md_path(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        env::temp_dir()
            .join(format!(
                "codex-app-replica-workspace-agents-{case_name}-{unique_suffix}"
            ))
            .join("AGENTS.md")
    }
}
