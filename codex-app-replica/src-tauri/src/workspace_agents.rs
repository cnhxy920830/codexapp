use crate::auth_bridge::send_request_for_host;
use crate::auth_bridge::AppServerRequestKind;
use crate::auth_bridge::AuthBridgeState;
use crate::codex_home::resolve_codex_home;
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::State;

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteFsReadFileResponse {
    data_base64: String,
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
pub async fn codex_agents_md(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: CodexAgentsMdParams,
) -> Result<WorkspaceAgentsMdDocumentResponse, String> {
    let path = resolve_codex_agents_md_path(state.inner(), params.host_id.as_deref())?;
    let contents = read_codex_agents_md_contents(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        &path,
        MissingAgentsMdBehavior::ReturnEmptyDocument,
    )
    .await?;
    Ok(WorkspaceAgentsMdDocumentResponse {
        path: path.display().to_string(),
        contents,
    })
}

#[tauri::command(rename = "codex-agents-md-save")]
pub async fn codex_agents_md_save(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: CodexAgentsMdSaveParams,
) -> Result<WorkspaceAgentsMdPathResponse, String> {
    let path = resolve_codex_agents_md_path(state.inner(), params.host_id.as_deref())?;
    write_codex_agents_md_contents(
        &app,
        state.inner(),
        params.host_id.as_deref(),
        &path,
        params.contents,
    )
    .await?;
    Ok(WorkspaceAgentsMdPathResponse {
        path: path.display().to_string(),
    })
}

fn read_workspace_agents_md_document(
    workspace_root: Option<&str>,
    missing_behavior: MissingAgentsMdBehavior,
) -> Result<Option<WorkspaceAgentsMdDocumentResponse>, String> {
    let path = resolve_workspace_agents_md_path_from_optional_root(workspace_root)?;
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
    let path = resolve_workspace_agents_md_path_from_optional_root(workspace_root)?;
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

fn resolve_workspace_agents_md_path_from_optional_root(
    workspace_root: Option<&str>,
) -> Result<PathBuf, String> {
    let workspace_root = workspace_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "workspace root is required".to_string())?;
    resolve_workspace_agents_md_path(Path::new(workspace_root))
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

fn resolve_codex_agents_md_path(
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
) -> Result<PathBuf, String> {
    if is_local_host_id(host_id) {
        return Ok(resolve_codex_home()?.join("AGENTS.md"));
    }

    let codex_home = state.codex_home_for_host(host_id).ok_or_else(|| {
        format!(
            "codexHome is unavailable for host {}",
            display_host_id(host_id)
        )
    })?;
    Ok(PathBuf::from(codex_home).join("AGENTS.md"))
}

async fn read_codex_agents_md_contents(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    path: &Path,
    missing_behavior: MissingAgentsMdBehavior,
) -> Result<String, String> {
    if is_local_host_id(host_id) {
        return Ok(read_workspace_agents_md_document_from_path(
            path.to_path_buf(),
            missing_behavior,
        )?
        .map(|document| document.contents)
        .unwrap_or_default());
    }

    let value = match send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::FsReadFile,
        serde_json::json!({
            "path": path.display().to_string(),
        }),
    )
    .await
    {
        Ok(value) => value,
        Err(err) if should_treat_missing_as_empty(&err, missing_behavior) => {
            return Ok(String::new());
        }
        Err(err) => return Err(err),
    };
    let response: RemoteFsReadFileResponse = serde_json::from_value(value)
        .map_err(|err| format!("invalid fs/readFile response: {err}"))?;
    let bytes = STANDARD
        .decode(response.data_base64)
        .map_err(|err| format!("invalid AGENTS.md base64 contents: {err}"))?;
    String::from_utf8(bytes).map_err(|err| format!("invalid AGENTS.md utf-8 contents: {err}"))
}

async fn write_codex_agents_md_contents(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    path: &Path,
    contents: String,
) -> Result<(), String> {
    if is_local_host_id(host_id) {
        let parent = path
            .parent()
            .ok_or_else(|| "AGENTS.md path has no parent directory".to_string())?;
        if !parent.is_dir() {
            return Err(format!(
                "workspace root is not a directory: {}",
                parent.display()
            ));
        }
        fs::write(path, contents.as_bytes())
            .map_err(|err| format!("failed to write AGENTS.md: {err}"))?;
        return Ok(());
    }

    send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::FsWriteFile,
        serde_json::json!({
            "path": path.display().to_string(),
            "dataBase64": STANDARD.encode(contents.as_bytes()),
        }),
    )
    .await
    .map(|_| ())
}

fn should_treat_missing_as_empty(err: &str, missing_behavior: MissingAgentsMdBehavior) -> bool {
    missing_behavior == MissingAgentsMdBehavior::ReturnEmptyDocument
        && (err.contains("No such file")
            || err.contains("not found")
            || err.contains("ENOENT")
            || err.contains("os error 2"))
}

fn is_local_host_id(host_id: Option<&str>) -> bool {
    matches!(
        host_id.map(str::trim).filter(|value| !value.is_empty()),
        None | Some(LOCAL_HOST_ID)
    )
}

fn display_host_id(host_id: Option<&str>) -> &str {
    host_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(LOCAL_HOST_ID)
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
    fn local_host_id_detection_accepts_remote_hosts() {
        assert!(is_local_host_id(None));
        assert!(is_local_host_id(Some("")));
        assert!(is_local_host_id(Some("local")));
        assert!(!is_local_host_id(Some("remote")));
        assert!(!is_local_host_id(Some("remote-ssh-discovered:demo")));
    }

    #[test]
    fn missing_remote_file_errors_map_to_empty_document() {
        assert!(should_treat_missing_as_empty(
            "No such file or directory",
            MissingAgentsMdBehavior::ReturnEmptyDocument,
        ));
        assert!(should_treat_missing_as_empty(
            "ENOENT",
            MissingAgentsMdBehavior::ReturnEmptyDocument,
        ));
        assert!(!should_treat_missing_as_empty(
            "permission denied",
            MissingAgentsMdBehavior::ReturnEmptyDocument,
        ));
        assert!(!should_treat_missing_as_empty(
            "ENOENT",
            MissingAgentsMdBehavior::ReturnNone,
        ));
    }

    fn temp_agents_md_path(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        std::env::temp_dir()
            .join(format!(
                "codex-app-replica-workspace-agents-{case_name}-{unique_suffix}"
            ))
            .join("AGENTS.md")
    }
}
