use crate::auth_bridge::list_plugins;
use crate::auth_bridge::AuthBridgeState;
use crate::auth_bridge::PluginListParams;
use crate::auth_bridge::PluginMarketplaceEntry;
use crate::auth_bridge::PluginSource;
use crate::open_targets::ensure_supported_host_id;
use crate::open_targets::open_path_in_effective_target;
use crate::open_targets::OpenTargetLocation;
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
#[allow(deprecated)]
use tauri_plugin_shell::ShellExt;
use tokio::fs as tokio_fs;
use tokio::process::Command;

const THIRD_PARTY_NOTICES_FILE_NAME: &str = "THIRD_PARTY_NOTICES.txt";
const LATEX_TECTONIC_PLUGIN_NAME: &str = "latex-tectonic";
const OFFICIAL_PLUGIN_MARKETPLACE_NAME: &str = "openai/plugins";
const LATEX_ARTIFACT_TIMEOUT: Duration = Duration::from_secs(60);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
pub struct ReadFileMetadataResponse {
    pub is_file: bool,
    pub size_bytes: Option<u64>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileBinaryResponse {
    pub contents_base64: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompileLatexArtifactResponse {
    pub contents_base64: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThirdPartyNoticesResponse {
    pub text: Option<String>,
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

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInBrowserParams {
    pub url: String,
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

#[tauri::command(rename = "read-file-metadata")]
pub fn read_file_metadata(params: ReadFileParams) -> Result<ReadFileMetadataResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "read-file-metadata")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let metadata = fs::metadata(&path).map_err(map_not_found_error)?;
    let is_file = metadata.is_file();

    Ok(ReadFileMetadataResponse {
        is_file,
        size_bytes: is_file.then_some(metadata.len()),
        mime_type: infer_mime_type(&path),
    })
}

#[tauri::command(rename = "read-file-binary")]
pub fn read_file_binary(params: ReadFileParams) -> Result<ReadFileBinaryResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "read-file-binary")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let metadata = fs::metadata(&path).map_err(map_not_found_error)?;
    if !metadata.is_file() {
        return Err(format!("path is not a file: {}", path.display()));
    }

    let contents = fs::read(&path).map_err(|err| format!("failed to read file: {err}"))?;
    Ok(ReadFileBinaryResponse {
        contents_base64: STANDARD.encode(contents),
        mime_type: infer_mime_type(&path),
    })
}

#[tauri::command(rename = "compile-latex-artifact")]
pub async fn compile_latex_artifact(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    params: ReadFileParams,
) -> Result<CompileLatexArtifactResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "compile-latex-artifact")?;
    let host_id = params.host_id.clone();
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let tectonic_path = resolve_latex_tectonic_binary_path(
        list_plugins(
            app,
            state,
            PluginListParams {
                host_id,
                cwds: Vec::new(),
                cwd: None,
            },
        )
        .await
        .ok()
        .map(|response| response.marketplaces),
    )
    .await;

    let contents_base64 = match tectonic_path {
        Some(tectonic_path) => compile_latex_artifact_to_pdf_base64(&path, &tectonic_path).await,
        None => None,
    };
    Ok(CompileLatexArtifactResponse { contents_base64 })
}

#[tauri::command(rename = "open-file")]
pub fn open_file(app: AppHandle, params: OpenFileParams) -> Result<(), String> {
    ensure_supported_host_id(params.host_id.as_deref(), "open-file")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let location = effective_location(&params).map(|location| OpenTargetLocation {
        line: location.line,
        column: location.column,
    });
    open_path_in_effective_target(
        &app,
        params.target.as_deref(),
        params.cwd.as_deref(),
        &path,
        location,
    )
}

#[tauri::command(rename = "open-in-browser")]
pub fn open_in_browser(app: AppHandle, params: OpenInBrowserParams) -> Result<(), String> {
    let url = normalize_browser_url(&params.url)?;
    #[allow(deprecated)]
    app.shell()
        .open(url, None)
        .map_err(|err| format!("failed to open url: {err}"))
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

pub(crate) fn resolve_requested_path(path: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
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

fn infer_mime_type(path: &std::path::Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let mime_type = match extension.as_str() {
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "c" | "cc" | "cpp" | "css" | "go" | "h" | "hpp" | "html" | "java" | "js" | "json"
        | "jsx" | "md" | "mjs" | "py" | "rb" | "rs" | "sh" | "sql" | "svg" | "toml" | "ts"
        | "tsx" | "txt" | "xml" | "yaml" | "yml" => "text/plain",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "jpeg" | "jpg" => "image/jpeg",
        "m4v" | "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "ogg" => "video/ogg",
        "pdf" => "application/pdf",
        "png" => "image/png",
        "webm" => "video/webm",
        "webp" => "image/webp",
        _ => return None,
    };
    Some(mime_type.to_string())
}

pub(crate) fn normalize_browser_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("url is empty".to_string());
    }

    Ok(trimmed.to_string())
}

async fn resolve_latex_tectonic_binary_path(
    marketplaces: Option<Vec<PluginMarketplaceEntry>>,
) -> Option<PathBuf> {
    let binary_path = resolve_latex_tectonic_binary_path_for_platform(
        marketplaces.as_deref()?,
        std::env::consts::OS,
    )?;
    tokio_fs::metadata(&binary_path).await.ok()?;
    Some(binary_path)
}

fn resolve_latex_tectonic_binary_path_for_platform(
    marketplaces: &[PluginMarketplaceEntry],
    platform: &str,
) -> Option<PathBuf> {
    for marketplace in marketplaces {
        if marketplace.name != OFFICIAL_PLUGIN_MARKETPLACE_NAME {
            continue;
        }

        let Some(plugin) = marketplace.plugins.iter().find(|plugin| {
            plugin.name == LATEX_TECTONIC_PLUGIN_NAME
                && plugin.installed
                && plugin.enabled
                && matches!(plugin.source, PluginSource::Local { .. })
        }) else {
            continue;
        };
        let PluginSource::Local { path } = &plugin.source else {
            continue;
        };
        let executable_name = if platform == "windows" {
            "tectonic.exe"
        } else {
            "tectonic"
        };
        return Some(PathBuf::from(path).join("bin").join(executable_name));
    }

    None
}

async fn compile_latex_artifact_to_pdf_base64(
    path: &std::path::Path,
    tectonic_binary_path: &std::path::Path,
) -> Option<String> {
    let source_directory = path.parent()?;
    let source_file_name = path.file_name()?.to_os_string();
    let temp_directory = std::env::temp_dir().join(format!(
        "codex-latex-artifact-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_nanos()
    ));
    let output_file_path =
        temp_directory.join(PathBuf::from(&source_file_name).with_extension("pdf"));

    if tokio_fs::create_dir_all(&temp_directory).await.is_err() {
        return None;
    }

    let mut child = Command::new(tectonic_binary_path);
    child
        .arg("-X")
        .arg("compile")
        .arg("--outdir")
        .arg(&temp_directory)
        .arg("--outfmt")
        .arg("pdf")
        .arg("--print")
        .arg("--untrusted")
        .arg(&source_file_name)
        .current_dir(source_directory)
        .env("TECTONIC_UNTRUSTED_MODE", "1")
        .kill_on_drop(true);
    #[cfg(target_os = "windows")]
    child.creation_flags(CREATE_NO_WINDOW);

    let result = async {
        let mut child = child.spawn().ok()?;
        let status = match tokio::time::timeout(LATEX_ARTIFACT_TIMEOUT, child.wait()).await {
            Ok(Ok(status)) => status,
            _ => {
                let _ = child.kill().await;
                return None;
            }
        };
        if !status.success() {
            return None;
        }

        let contents = tokio_fs::read(&output_file_path).await.ok()?;
        Some(STANDARD.encode(contents))
    }
    .await;

    let _ = tokio_fs::remove_dir_all(&temp_directory).await;
    result
}

#[cfg(test)]
mod tests {
    use super::effective_location;
    use super::ensure_supported_host_id;
    use super::normalize_browser_url;
    use super::read_file;
    use super::read_file_binary;
    use super::read_file_metadata;
    use super::resolve_latex_tectonic_binary_path_for_platform;
    use super::resolve_requested_path;
    use super::FilePosition;
    use super::OpenFileParams;
    use super::OpenInBrowserParams;
    use super::PluginMarketplaceEntry;
    use super::ReadFileBinaryResponse;
    use super::ReadFileMetadataResponse;
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
    fn open_in_browser_params_accept_url() {
        let params: OpenInBrowserParams = serde_json::from_value(json!({
            "url": "https://github.com/openai/codex/pull/1"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            OpenInBrowserParams {
                url: "https://github.com/openai/codex/pull/1".to_string(),
            }
        );
    }

    #[test]
    fn open_in_browser_params_ignore_external_browser_flag() {
        let params: OpenInBrowserParams = serde_json::from_value(json!({
            "url": "https://auth.openai.com/login",
            "useExternalBrowser": true
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            OpenInBrowserParams {
                url: "https://auth.openai.com/login".to_string(),
            }
        );
    }

    #[test]
    fn normalize_browser_url_rejects_empty_string() {
        assert_eq!(
            normalize_browser_url("   ").expect_err("empty url should fail"),
            "url is empty"
        );
    }

    #[test]
    fn normalize_browser_url_trims_surrounding_whitespace() {
        assert_eq!(
            normalize_browser_url("  https://example.com/path  ").expect("url should normalize"),
            "https://example.com/path"
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
    fn read_file_metadata_returns_directory_state() {
        let root = temp_dir("metadata-directory");
        let response = read_file_metadata(ReadFileParams {
            host_id: Some("local".to_string()),
            path: root.display().to_string(),
            cwd: None,
        })
        .expect("directory metadata should succeed");

        assert_eq!(
            response,
            ReadFileMetadataResponse {
                is_file: false,
                size_bytes: None,
                mime_type: None,
            }
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_file_metadata_returns_size_and_mime_type() {
        let root = temp_dir("metadata-file");
        let file = root.join("preview.txt");
        fs::write(&file, "hello").expect("file should be created");
        let response = read_file_metadata(ReadFileParams {
            host_id: Some("local".to_string()),
            path: file.display().to_string(),
            cwd: None,
        })
        .expect("file metadata should succeed");

        assert_eq!(
            response,
            ReadFileMetadataResponse {
                is_file: true,
                size_bytes: Some(5),
                mime_type: Some("text/plain".to_string()),
            }
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_file_binary_returns_base64_contents() {
        let root = temp_dir("binary-file");
        let file = root.join("preview.png");
        fs::write(&file, b"abc").expect("file should be created");
        let response = read_file_binary(ReadFileParams {
            host_id: Some("local".to_string()),
            path: file.display().to_string(),
            cwd: None,
        })
        .expect("file binary should succeed");

        assert_eq!(
            response,
            ReadFileBinaryResponse {
                contents_base64: "YWJj".to_string(),
                mime_type: Some("image/png".to_string()),
            }
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn third_party_notices_response_serializes_nullable_text() {
        let response = ThirdPartyNoticesResponse { text: None };
        let value = serde_json::to_value(response).expect("response should serialize");

        assert_eq!(value, json!({ "text": null }));
    }

    #[test]
    fn compile_latex_artifact_response_serializes_nullable_contents() {
        let response = super::CompileLatexArtifactResponse {
            contents_base64: None,
        };
        let value = serde_json::to_value(response).expect("response should serialize");

        assert_eq!(value, json!({ "contentsBase64": null }));
    }

    #[test]
    fn resolves_windows_latex_tectonic_binary_path() {
        let marketplaces: Vec<PluginMarketplaceEntry> = serde_json::from_value(json!([
            {
                "name": "openai/plugins",
                "path": "D:/plugins",
                "plugins": [
                    {
                        "id": "latex-tectonic@1.0.0",
                        "name": "latex-tectonic",
                        "source": {
                            "type": "local",
                            "path": "D:/plugins/latex-tectonic"
                        },
                        "installed": true,
                        "enabled": true,
                        "installPolicy": "AVAILABLE",
                        "authPolicy": "ON_USE",
                        "availability": "AVAILABLE"
                    }
                ]
            }
        ]))
        .expect("marketplaces should deserialize");

        assert_eq!(
            resolve_latex_tectonic_binary_path_for_platform(&marketplaces, "windows"),
            Some(
                PathBuf::from("D:/plugins/latex-tectonic")
                    .join("bin")
                    .join("tectonic.exe")
            )
        );
    }

    #[test]
    fn ignores_disabled_latex_tectonic_plugin() {
        let marketplaces: Vec<PluginMarketplaceEntry> = serde_json::from_value(json!([
            {
                "name": "openai/plugins",
                "path": "D:/plugins",
                "plugins": [
                    {
                        "id": "latex-tectonic@1.0.0",
                        "name": "latex-tectonic",
                        "source": {
                            "type": "local",
                            "path": "D:/plugins/latex-tectonic"
                        },
                        "installed": true,
                        "enabled": false,
                        "installPolicy": "AVAILABLE",
                        "authPolicy": "ON_USE",
                        "availability": "AVAILABLE"
                    }
                ]
            }
        ]))
        .expect("marketplaces should deserialize");

        assert_eq!(
            resolve_latex_tectonic_binary_path_for_platform(&marketplaces, "windows"),
            None
        );
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
