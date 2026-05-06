use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAgentsMdDocumentResponse {
    pub path: String,
    pub contents: String,
}

#[tauri::command]
pub fn read_workspace_agents_md(
    params: ReadWorkspaceAgentsMdParams,
) -> Result<Option<WorkspaceAgentsMdDocumentResponse>, String> {
    let path = resolve_agents_md_path(params.workspace_root.as_deref())?;
    if !path.is_file() {
        return Ok(None);
    }
    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read AGENTS.md: {err}"))?;
    Ok(Some(WorkspaceAgentsMdDocumentResponse {
        path: path.display().to_string(),
        contents,
    }))
}

#[tauri::command]
pub fn write_workspace_agents_md(
    params: WriteWorkspaceAgentsMdParams,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    let path = resolve_agents_md_path(params.workspace_root.as_deref())?;
    let parent = path
        .parent()
        .ok_or_else(|| "AGENTS.md path has no parent directory".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "workspace root is not a directory: {}",
            parent.display()
        ));
    }
    fs::write(&path, params.contents.as_bytes())
        .map_err(|err| format!("failed to write AGENTS.md: {err}"))?;
    Ok(WorkspaceAgentsMdDocumentResponse {
        path: path.display().to_string(),
        contents: params.contents,
    })
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
