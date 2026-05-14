use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Deserialize;
use serde::Serialize;
use std::ffi::OsStr;
use std::fs;
use std::path::Component;
use std::path::Path;
use std::path::PathBuf;

const MAX_SEARCH_RESULTS: usize = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceFilesParams {
    pub workspace_root: String,
    pub query: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorkspaceFileParams {
    pub workspace_root: String,
    pub relative_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorkspaceDirectoryEntriesParams {
    pub workspace_root: String,
    pub directory_path: Option<String>,
    pub include_hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileSearchResult {
    pub name: String,
    pub path: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDirectoryEntryResponse {
    pub path: String,
    pub name: String,
    pub entry_type: WorkspaceDirectoryEntryType,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceDirectoryEntryType {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileDocumentResponse {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub contents: Option<String>,
    pub mime_type: Option<String>,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileMetadataResponse {
    pub is_file: bool,
    pub size_bytes: Option<u64>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorkspaceFileBinaryResponse {
    pub contents_base64: String,
}

#[tauri::command]
pub fn search_workspace_files(
    params: SearchWorkspaceFilesParams,
) -> Result<Vec<WorkspaceFileSearchResult>, String> {
    let workspace_root = resolve_workspace_root(&params.workspace_root)?;
    let normalized_query = params.query.trim().to_lowercase();
    let mut results = Vec::new();
    collect_workspace_files(
        &workspace_root,
        &workspace_root,
        &normalized_query,
        &mut results,
    )?;
    results.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(results)
}

#[tauri::command]
pub fn read_workspace_file_metadata(
    params: ReadWorkspaceFileParams,
) -> Result<WorkspaceFileMetadataResponse, String> {
    let resolved = resolve_workspace_file(&params)?;
    let metadata = fs::metadata(&resolved.canonical_target)
        .map_err(|err| format!("failed to inspect workspace file: {err}"))?;
    let is_file = metadata.is_file();

    Ok(WorkspaceFileMetadataResponse {
        is_file,
        size_bytes: is_file.then_some(metadata.len()),
        mime_type: infer_mime_type(&resolved.canonical_target),
    })
}

#[tauri::command]
pub fn read_workspace_file(
    params: ReadWorkspaceFileParams,
) -> Result<WorkspaceFileDocumentResponse, String> {
    let resolved = resolve_workspace_file(&params)?;
    if !resolved.canonical_target.is_file() {
        return Err(format!(
            "workspace file does not exist: {}",
            resolved.canonical_target.display()
        ));
    }

    let bytes = fs::read(&resolved.canonical_target)
        .map_err(|err| format!("failed to read workspace file: {err}"))?;
    let contents = String::from_utf8(bytes.clone()).ok();
    let mime_type = infer_mime_type(&resolved.canonical_target);
    let is_binary = contents.is_none() || mime_type.as_deref() == Some("application/pdf");

    Ok(WorkspaceFileDocumentResponse {
        name: file_name_label(&resolved.canonical_target),
        path: resolved.canonical_target.display().to_string(),
        relative_path: resolved.relative_path,
        contents,
        mime_type,
        is_binary,
    })
}

#[tauri::command]
pub fn read_workspace_file_binary(
    params: ReadWorkspaceFileParams,
) -> Result<ReadWorkspaceFileBinaryResponse, String> {
    let resolved = resolve_workspace_file(&params)?;
    if !resolved.canonical_target.is_file() {
        return Err(format!(
            "workspace file does not exist: {}",
            resolved.canonical_target.display()
        ));
    }

    let contents = fs::read(&resolved.canonical_target)
        .map_err(|err| format!("failed to read workspace file: {err}"))?;
    Ok(ReadWorkspaceFileBinaryResponse {
        contents_base64: STANDARD.encode(contents),
    })
}

#[tauri::command]
pub fn list_workspace_directory_entries(
    params: ListWorkspaceDirectoryEntriesParams,
) -> Result<Vec<WorkspaceDirectoryEntryResponse>, String> {
    let workspace_root = resolve_workspace_root(&params.workspace_root)?;
    let relative_directory_path = params
        .directory_path
        .as_deref()
        .map(normalize_relative_path)
        .transpose()?;
    let target_directory = match &relative_directory_path {
        Some(path) => workspace_root.join(path),
        None => workspace_root.clone(),
    };
    if !target_directory.exists() {
        return Err(format!(
            "workspace directory does not exist: {}",
            target_directory.display()
        ));
    }
    if !target_directory.is_dir() {
        return Err(format!(
            "workspace path is not a directory: {}",
            target_directory.display()
        ));
    }

    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|err| format!("failed to resolve workspace root: {err}"))?;
    let canonical_target_directory = target_directory
        .canonicalize()
        .map_err(|err| format!("failed to resolve workspace directory: {err}"))?;
    if canonical_target_directory
        .strip_prefix(&canonical_root)
        .is_err()
    {
        return Err(format!(
            "workspace directory is outside workspace root: {}",
            canonical_target_directory.display()
        ));
    }

    let entries = fs::read_dir(&canonical_target_directory)
        .map_err(|err| format!("failed to read workspace directory: {err}"))?;
    let mut results = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read workspace entry: {err}"))?;
        let file_name = entry.file_name();
        if file_name == OsStr::new(".git") {
            continue;
        }
        if !params.include_hidden && file_name.to_str().is_some_and(|name| name.starts_with('.')) {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|err| format!("failed to inspect workspace entry: {err}"))?;
        let entry_type = if file_type.is_dir() {
            WorkspaceDirectoryEntryType::Directory
        } else if file_type.is_file() {
            WorkspaceDirectoryEntryType::File
        } else {
            continue;
        };

        let path = entry.path();
        let relative_path = path
            .strip_prefix(&workspace_root)
            .map_err(|err| format!("failed to compute workspace-relative file path: {err}"))?
            .to_string_lossy()
            .replace('\\', "/");
        results.push(WorkspaceDirectoryEntryResponse {
            path: relative_path,
            name: file_name.to_string_lossy().to_string(),
            entry_type,
        });
    }

    results.sort_by(|left, right| match (&left.entry_type, &right.entry_type) {
        (WorkspaceDirectoryEntryType::Directory, WorkspaceDirectoryEntryType::File) => {
            std::cmp::Ordering::Less
        }
        (WorkspaceDirectoryEntryType::File, WorkspaceDirectoryEntryType::Directory) => {
            std::cmp::Ordering::Greater
        }
        _ => left.path.cmp(&right.path),
    });

    Ok(results)
}

fn collect_workspace_files(
    workspace_root: &Path,
    current_dir: &Path,
    normalized_query: &str,
    results: &mut Vec<WorkspaceFileSearchResult>,
) -> Result<(), String> {
    if results.len() >= MAX_SEARCH_RESULTS {
        return Ok(());
    }

    let entries = fs::read_dir(current_dir)
        .map_err(|err| format!("failed to read workspace directory: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read workspace entry: {err}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|err| format!("failed to inspect workspace entry: {err}"))?;

        if file_type.is_dir() {
            if entry.file_name() == OsStr::new(".git") {
                continue;
            }
            collect_workspace_files(workspace_root, &path, normalized_query, results)?;
            if results.len() >= MAX_SEARCH_RESULTS {
                return Ok(());
            }
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let relative_path = path
            .strip_prefix(workspace_root)
            .map_err(|err| format!("failed to compute workspace-relative file path: {err}"))?
            .to_string_lossy()
            .replace('\\', "/");
        let file_name = entry.file_name().to_string_lossy().to_string();
        let search_text = format!("{file_name} {relative_path}").to_lowercase();
        if normalized_query.is_empty() || search_text.contains(normalized_query) {
            results.push(WorkspaceFileSearchResult {
                name: file_name,
                path: path.display().to_string(),
                relative_path,
            });
            if results.len() >= MAX_SEARCH_RESULTS {
                return Ok(());
            }
        }
    }

    Ok(())
}

fn resolve_workspace_root(workspace_root: &str) -> Result<PathBuf, String> {
    let trimmed = workspace_root.trim();
    if trimmed.is_empty() {
        return Err("workspace root is empty".to_string());
    }

    let path = Path::new(trimmed);
    if !path.exists() {
        return Err(format!("workspace root does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!(
            "workspace root is not a directory: {}",
            path.display()
        ));
    }

    Ok(path.to_path_buf())
}

#[derive(Debug)]
struct ResolvedWorkspaceFile {
    canonical_target: PathBuf,
    relative_path: String,
}

fn resolve_workspace_file(
    params: &ReadWorkspaceFileParams,
) -> Result<ResolvedWorkspaceFile, String> {
    let workspace_root = resolve_workspace_root(&params.workspace_root)?;
    let relative_path = normalize_relative_path(&params.relative_path)?;
    let target_path = workspace_root.join(&relative_path);
    if !target_path.exists() {
        return Err(format!(
            "workspace file does not exist: {}",
            target_path.display()
        ));
    }

    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|err| format!("failed to resolve workspace root: {err}"))?;
    let canonical_target = target_path
        .canonicalize()
        .map_err(|err| format!("failed to resolve workspace file: {err}"))?;
    if canonical_target.strip_prefix(&canonical_root).is_err() {
        return Err(format!(
            "workspace file is outside workspace root: {}",
            canonical_target.display()
        ));
    }

    Ok(ResolvedWorkspaceFile {
        canonical_target,
        relative_path,
    })
}

fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("workspace file path is empty".to_string());
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err(format!(
            "workspace file path must be relative: {}",
            path.display()
        ));
    }
    for component in path.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        ) {
            return Err(format!(
                "workspace file path cannot escape workspace root: {}",
                path.display()
            ));
        }
    }

    Ok(trimmed.replace('\\', "/"))
}

fn file_name_label(path: &Path) -> String {
    path.file_name()
        .and_then(OsStr::to_str)
        .map_or_else(|| path.display().to_string(), ToString::to_string)
}

fn infer_mime_type(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let mime_type = match extension.as_str() {
        "c" | "cc" | "cpp" | "css" | "go" | "h" | "hpp" | "html" | "java" | "js" | "json"
        | "jsx" | "md" | "mjs" | "py" | "rb" | "rs" | "sh" | "sql" | "svg" | "toml" | "ts"
        | "tsx" | "txt" | "xml" | "yaml" | "yml" => "text/plain",
        "pdf" => "application/pdf",
        _ => return None,
    };
    Some(mime_type.to_string())
}
