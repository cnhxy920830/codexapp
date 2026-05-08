use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

const FILE_MANAGER_TARGET: &str = "fileManager";
const LOCAL_HOST_ID: &str = "local";
const THIRD_PARTY_NOTICES_FILE_NAME: &str = "THIRD_PARTY_NOTICES.txt";

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileParams {
    pub host_id: Option<String>,
    pub path: String,
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResponse {
    pub contents: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThirdPartyNoticesResponse {
    pub text: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInTargetsParams {
    pub host_id: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInTargetsResponse {
    pub preferred_target: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenFileParams {
    pub host_id: Option<String>,
    pub path: String,
    pub cwd: Option<String>,
    pub target: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub range: Option<FileRange>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileRange {
    pub start: FilePosition,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FilePosition {
    pub line: u32,
    pub column: u32,
}

#[tauri::command(rename = "read-file")]
pub fn read_file(params: ReadFileParams) -> Result<ReadFileResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "read-file")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let metadata = fs::metadata(&path).map_err(map_not_found_error)?;
    if !metadata.is_file() {
        return Err(format!("path is not a file: {}", path.display()));
    }

    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read file: {err}"))?;
    Ok(ReadFileResponse { contents })
}

#[tauri::command(rename = "open-file")]
pub fn open_file(params: OpenFileParams) -> Result<(), String> {
    ensure_supported_host_id(params.host_id.as_deref(), "open-file")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    if params.target.as_deref() == Some(FILE_MANAGER_TARGET) {
        return open_in_file_manager(&path);
    }

    open_in_default_target(&path, effective_location(&params))
}

#[tauri::command(rename = "open-in-targets")]
pub fn open_in_targets(params: OpenInTargetsParams) -> Result<OpenInTargetsResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "open-in-targets")?;
    let _ = params.cwd;
    Ok(OpenInTargetsResponse {
        preferred_target: None,
    })
}

#[tauri::command(rename = "third-party-notices")]
pub fn third_party_notices(app: AppHandle) -> Result<ThirdPartyNoticesResponse, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("failed to resolve resource directory: {err}"))?;
    let path = resource_dir.join(THIRD_PARTY_NOTICES_FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(text) => Ok(ThirdPartyNoticesResponse { text: Some(text) }),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            Ok(ThirdPartyNoticesResponse { text: None })
        }
        Err(err) => Err(format!(
            "failed to read {} from {}: {err}",
            THIRD_PARTY_NOTICES_FILE_NAME,
            path.display()
        )),
    }
}

fn effective_location(params: &OpenFileParams) -> Option<FilePosition> {
    match params.line {
        Some(line) => Some(FilePosition {
            line,
            column: params.column.unwrap_or(1),
        }),
        None => params.range.as_ref().map(|range| range.start.clone()),
    }
}

fn resolve_requested_path(path: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path is empty".to_string());
    }

    let requested = PathBuf::from(trimmed);
    if requested.is_absolute() {
        return Ok(requested);
    }

    let cwd = cwd
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("relative path requires cwd: {trimmed}"))?;
    Ok(PathBuf::from(cwd).join(requested))
}

fn map_not_found_error(error: std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        return "ENOENT".to_string();
    }
    error.to_string()
}

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn open_in_default_target(path: &Path, location: Option<FilePosition>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if location.is_some() || (!path.exists() && is_text_like_path(path)) {
            return spawn_command(Command::new("notepad.exe").arg(path), "notepad.exe");
        }

        return spawn_command(
            Command::new("cmd.exe")
                .arg("/d")
                .arg("/c")
                .arg("start")
                .arg("")
                .arg(path),
            "cmd.exe",
        );
    }

    #[cfg(target_os = "macos")]
    {
        let _ = location;
        return spawn_command(Command::new("open").arg(path), "open");
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = location;
        return spawn_command(Command::new("xdg-open").arg(path), "xdg-open");
    }

    #[allow(unreachable_code)]
    Err("open-file is not supported on this platform".to_string())
}

fn open_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let existing = nearest_existing_path(path)
            .ok_or_else(|| format!("failed to resolve file manager path: {}", path.display()))?;
        if existing.is_file() {
            return spawn_command(
                Command::new("explorer.exe").arg(format!("/select,{}", existing.display())),
                "explorer.exe",
            );
        }

        return spawn_command(Command::new("explorer.exe").arg(existing), "explorer.exe");
    }

    #[cfg(target_os = "macos")]
    {
        let existing = nearest_existing_path(path).unwrap_or_else(|| path.to_path_buf());
        if existing.is_file() {
            return spawn_command(Command::new("open").arg("-R").arg(existing), "open");
        }
        return spawn_command(Command::new("open").arg(existing), "open");
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let existing = nearest_existing_path(path).unwrap_or_else(|| path.to_path_buf());
        let directory = if existing.is_dir() {
            existing
        } else {
            existing.parent().map(Path::to_path_buf).unwrap_or(existing)
        };
        return spawn_command(Command::new("xdg-open").arg(directory), "xdg-open");
    }

    #[allow(unreachable_code)]
    Err("open-file is not supported on this platform".to_string())
}

fn spawn_command(command: &mut Command, program_name: &str) -> Result<(), String> {
    command
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("failed to launch {program_name}: {err}"))
}

fn is_text_like_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some(
            "cfg" | "conf" | "ini" | "json" | "log" | "md" | "rs" | "toml" | "txt" | "yaml" | "yml"
        )
    )
}

fn nearest_existing_path(path: &Path) -> Option<PathBuf> {
    let mut current = path.to_path_buf();
    loop {
        if current.exists() {
            return Some(current);
        }

        let parent = current.parent()?.to_path_buf();
        if parent == current {
            return None;
        }
        current = parent;
    }
}

#[cfg(test)]
mod tests {
    use super::effective_location;
    use super::ensure_supported_host_id;
    use super::nearest_existing_path;
    use super::open_in_targets;
    use super::read_file;
    use super::resolve_requested_path;
    use super::FilePosition;
    use super::OpenFileParams;
    use super::OpenInTargetsParams;
    use super::OpenInTargetsResponse;
    use super::ReadFileParams;
    use super::ThirdPartyNoticesResponse;
    use std::fs;
    use std::path::PathBuf;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    use serde_json::json;

    #[test]
    fn read_file_params_accept_host_id() {
        let params: ReadFileParams = serde_json::from_value(json!({
            "hostId": "local",
            "path": "D:/repo/.codex/config.toml",
            "cwd": null
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ReadFileParams {
                host_id: Some("local".to_string()),
                path: "D:/repo/.codex/config.toml".to_string(),
                cwd: None,
            }
        );
    }

    #[test]
    fn open_file_params_accept_range_shape() {
        let params: OpenFileParams = serde_json::from_value(json!({
            "hostId": "local",
            "path": "D:/repo/.codex/config.toml",
            "range": {
                "start": {
                    "line": 12,
                    "column": 4
                }
            }
        }))
        .expect("params should deserialize");

        assert_eq!(
            params.range,
            Some(super::FileRange {
                start: FilePosition {
                    line: 12,
                    column: 4,
                },
            })
        );
    }

    #[test]
    fn open_in_targets_only_accepts_local_host() {
        assert!(ensure_supported_host_id(None, "open-in-targets").is_ok());
        assert!(ensure_supported_host_id(Some(""), "open-in-targets").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "open-in-targets").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "open-in-targets")
                .expect_err("non-local host id should be rejected"),
            "open-in-targets does not support host id: remote"
        );
    }

    #[test]
    fn open_in_targets_returns_minimal_preferred_target_shape() {
        let response = open_in_targets(OpenInTargetsParams {
            host_id: Some("local".to_string()),
            cwd: None,
        })
        .expect("query should succeed");

        assert_eq!(
            response,
            OpenInTargetsResponse {
                preferred_target: None,
            }
        );
    }

    #[test]
    fn effective_location_prefers_explicit_line_and_column() {
        let location = effective_location(&OpenFileParams {
            host_id: None,
            path: "D:/repo/.codex/config.toml".to_string(),
            cwd: None,
            target: None,
            line: Some(5),
            column: Some(9),
            range: Some(super::FileRange {
                start: FilePosition {
                    line: 12,
                    column: 4,
                },
            }),
        });

        assert_eq!(location, Some(FilePosition { line: 5, column: 9 }));
    }

    #[test]
    fn resolve_requested_path_joins_relative_path_to_cwd() {
        let resolved = resolve_requested_path("config.toml", Some("D:/repo/.codex"))
            .expect("relative path should resolve");

        assert_eq!(
            resolved,
            PathBuf::from("D:/repo/.codex").join("config.toml")
        );
    }

    #[test]
    fn resolve_requested_path_rejects_relative_path_without_cwd() {
        assert_eq!(
            resolve_requested_path("config.toml", None)
                .expect_err("relative path without cwd should fail"),
            "relative path requires cwd: config.toml"
        );
    }

    #[test]
    fn nearest_existing_path_returns_parent_for_missing_file() {
        let root = temp_dir("existing-parent");
        let file_path = root.join("nested").join("config.toml");
        fs::create_dir_all(root.join("nested")).expect("nested directory should be created");

        let existing = nearest_existing_path(&file_path).expect("ancestor should resolve");

        assert_eq!(existing, root.join("nested"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_file_returns_enoent_for_missing_file() {
        let root = temp_dir("missing-file");
        let missing = root.join("config.toml");
        let error = read_file(ReadFileParams {
            host_id: Some("local".to_string()),
            path: missing.display().to_string(),
            cwd: None,
        })
        .expect_err("missing file should fail");

        assert_eq!(error, "ENOENT");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn third_party_notices_response_serializes_nullable_text() {
        let response = ThirdPartyNoticesResponse { text: None };
        let value = serde_json::to_value(response).expect("response should serialize");

        assert_eq!(value, json!({ "text": null }));
    }

    fn temp_dir(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("codex-app-replica-{case_name}-{unique_suffix}"));
        fs::create_dir_all(&path).expect("temp directory should be created");
        path
    }
}
