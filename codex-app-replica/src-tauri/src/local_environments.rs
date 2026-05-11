use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::path::Component;
use std::path::Path;
use std::path::PathBuf;

const LOCAL_ENVIRONMENTS_DIR: &str = ".codex/environments";
const DEFAULT_ENVIRONMENT_FILE_NAME: &str = "environment.toml";
const LOCAL_HOST_ID: &str = "local";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLocalEnvironmentsParams {
    pub workspace_root: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadLocalEnvironmentConfigParams {
    pub workspace_root: String,
    pub config_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteLocalEnvironmentConfigParams {
    pub workspace_root: String,
    pub config_path: String,
    pub environment: LocalEnvironmentDocument,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentsParams {
    pub host_id: Option<String>,
    pub workspace_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentParams {
    pub host_id: Option<String>,
    pub config_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentConfigSaveParams {
    pub host_id: Option<String>,
    pub config_path: String,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvironmentsListResponse {
    pub workspace_root: String,
    pub groups: Vec<LocalEnvironmentGroup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvironmentGroup {
    pub path: String,
    pub label: String,
    pub is_current_root: bool,
    pub environments: Vec<LocalEnvironmentConfigEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvironmentConfigEntry {
    pub config_path: String,
    pub file_name: String,
    pub environment: Option<LocalEnvironmentDocument>,
    pub parse_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvironmentConfigResponse {
    pub config_path: String,
    pub exists: bool,
    pub environment: LocalEnvironmentDocument,
    pub parse_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentsResponse {
    pub environments: Vec<UpstreamLocalEnvironmentEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentResponse {
    pub environment: UpstreamLocalEnvironmentEntry,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentConfigResponse {
    pub config_path: String,
    pub exists: bool,
    pub raw: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentConfigSaveResponse {
    pub config_path: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentEntry {
    pub config_path: String,
    #[serde(flatten)]
    pub state: UpstreamLocalEnvironmentState,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamLocalEnvironmentError {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum UpstreamLocalEnvironmentState {
    Success {
        environment: LocalEnvironmentDocument,
    },
    Error {
        error: UpstreamLocalEnvironmentError,
    },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalEnvironmentDocument {
    #[serde(default = "default_local_environment_version")]
    pub version: u64,
    pub name: String,
    pub setup: LocalEnvironmentScriptSection,
    pub cleanup: LocalEnvironmentScriptSection,
    pub actions: Vec<LocalEnvironmentAction>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalEnvironmentScriptSection {
    pub script: String,
    pub darwin: Option<LocalEnvironmentPlatformScript>,
    pub linux: Option<LocalEnvironmentPlatformScript>,
    pub win32: Option<LocalEnvironmentPlatformScript>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalEnvironmentPlatformScript {
    pub script: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalEnvironmentAction {
    pub name: String,
    pub icon: Option<String>,
    pub command: String,
    pub platform: Option<String>,
}

#[tauri::command]
pub fn list_local_environments(
    params: ListLocalEnvironmentsParams,
) -> Result<LocalEnvironmentsListResponse, String> {
    let workspace_root = resolve_workspace_root(params.workspace_root.as_deref())?;
    let mut groups = Vec::new();

    for (index, root_path) in workspace_root.ancestors().enumerate() {
        let entries = collect_local_environment_entries(root_path)?;
        if index == 0 || !entries.is_empty() {
            groups.push(LocalEnvironmentGroup {
                path: root_path.display().to_string(),
                label: derive_path_label(root_path),
                is_current_root: index == 0,
                environments: entries,
            });
        }
    }

    Ok(LocalEnvironmentsListResponse {
        workspace_root: workspace_root.display().to_string(),
        groups,
    })
}

#[tauri::command]
pub fn read_local_environment_config(
    params: ReadLocalEnvironmentConfigParams,
) -> Result<LocalEnvironmentConfigResponse, String> {
    let workspace_root = resolve_workspace_root(Some(&params.workspace_root))?;
    let config_path =
        normalize_local_environment_config_path(&workspace_root, &params.config_path)?;
    let owner_root = local_environment_owner_root_from_config_path(&config_path)?;
    if !config_path.is_file() {
        return Ok(LocalEnvironmentConfigResponse {
            config_path: config_path.display().to_string(),
            exists: false,
            environment: default_local_environment_document(&owner_root),
            parse_error: None,
        });
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|err| format!("failed to read local environment config: {err}"))?;
    match parse_local_environment_document(&contents, &owner_root) {
        Ok(environment) => Ok(LocalEnvironmentConfigResponse {
            config_path: config_path.display().to_string(),
            exists: true,
            environment,
            parse_error: None,
        }),
        Err(parse_error) => Ok(LocalEnvironmentConfigResponse {
            config_path: config_path.display().to_string(),
            exists: true,
            environment: default_local_environment_document(&owner_root),
            parse_error: Some(parse_error),
        }),
    }
}

#[tauri::command]
pub fn write_local_environment_config(
    params: WriteLocalEnvironmentConfigParams,
) -> Result<LocalEnvironmentConfigResponse, String> {
    let workspace_root = resolve_workspace_root(Some(&params.workspace_root))?;
    let config_path =
        normalize_local_environment_config_path(&workspace_root, &params.config_path)?;
    let owner_root = local_environment_owner_root_from_config_path(&config_path)?;
    let parent = config_path
        .parent()
        .ok_or_else(|| "local environment config path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create local environment directory: {err}"))?;

    let environment = normalize_local_environment_document(params.environment, &owner_root);
    let contents = render_local_environment_document(&environment);
    fs::write(&config_path, contents.as_bytes())
        .map_err(|err| format!("failed to write local environment config: {err}"))?;

    Ok(LocalEnvironmentConfigResponse {
        config_path: config_path.display().to_string(),
        exists: true,
        environment,
        parse_error: None,
    })
}

#[tauri::command(rename = "local-environments")]
pub fn upstream_local_environments(
    params: UpstreamLocalEnvironmentsParams,
) -> Result<UpstreamLocalEnvironmentsResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "local-environments")?;
    let workspace_root = resolve_workspace_root(Some(&params.workspace_root))?;
    Ok(UpstreamLocalEnvironmentsResponse {
        environments: collect_upstream_local_environment_entries(&workspace_root)?,
    })
}

#[tauri::command(rename = "local-environment")]
pub fn upstream_local_environment(
    params: UpstreamLocalEnvironmentParams,
) -> Result<UpstreamLocalEnvironmentResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "local-environment")?;
    let config_path = normalize_upstream_local_environment_config_path(&params.config_path)?;
    Ok(UpstreamLocalEnvironmentResponse {
        environment: read_upstream_local_environment_entry(&config_path)?,
    })
}

#[tauri::command(rename = "local-environment-config")]
pub fn upstream_local_environment_config(
    params: UpstreamLocalEnvironmentParams,
) -> Result<UpstreamLocalEnvironmentConfigResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "local-environment-config")?;
    let config_path = normalize_upstream_local_environment_config_path(&params.config_path)?;
    read_upstream_local_environment_config(&config_path)
}

#[tauri::command(rename = "local-environment-config-save")]
pub fn upstream_local_environment_config_save(
    params: UpstreamLocalEnvironmentConfigSaveParams,
) -> Result<UpstreamLocalEnvironmentConfigSaveResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "local-environment-config-save")?;
    let config_path = normalize_upstream_local_environment_config_path(&params.config_path)?;
    write_upstream_local_environment_config(&config_path, &params.raw)
}

fn collect_local_environment_entries(
    root_path: &Path,
) -> Result<Vec<LocalEnvironmentConfigEntry>, String> {
    let environments_dir = root_path.join(LOCAL_ENVIRONMENTS_DIR);
    if !environments_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut paths = Vec::new();
    for entry in fs::read_dir(&environments_dir)
        .map_err(|err| format!("failed to read local environments directory: {err}"))?
    {
        let entry =
            entry.map_err(|err| format!("failed to read local environment entry: {err}"))?;
        let path = entry.path();
        if !path.is_file() || path.extension() != Some(OsStr::new("toml")) {
            continue;
        }
        paths.push(path);
    }
    paths.sort();

    let mut entries = Vec::new();
    for path in paths {
        let contents = fs::read_to_string(&path)
            .map_err(|err| format!("failed to read local environment config: {err}"))?;
        let (environment, parse_error) =
            match parse_local_environment_document(&contents, root_path) {
                Ok(environment) => (Some(environment), None),
                Err(parse_error) => (None, Some(parse_error)),
            };
        entries.push(LocalEnvironmentConfigEntry {
            config_path: path.display().to_string(),
            file_name: file_name_label(&path),
            environment,
            parse_error,
        });
    }

    Ok(entries)
}

fn collect_upstream_local_environment_entries(
    root_path: &Path,
) -> Result<Vec<UpstreamLocalEnvironmentEntry>, String> {
    let mut paths = Vec::new();
    for ancestor in root_path.ancestors() {
        let environments_dir = ancestor.join(LOCAL_ENVIRONMENTS_DIR);
        if !environments_dir.is_dir() {
            continue;
        }

        for entry in fs::read_dir(&environments_dir)
            .map_err(|err| format!("failed to read local environments directory: {err}"))?
        {
            let entry =
                entry.map_err(|err| format!("failed to read local environment entry: {err}"))?;
            let path = entry.path();
            if !path.is_file() || path.extension() != Some(OsStr::new("toml")) {
                continue;
            }
            paths.push(path);
        }
    }
    paths.sort();

    paths
        .iter()
        .map(|path| read_upstream_local_environment_entry(path))
        .collect()
}

fn resolve_workspace_root(workspace_root: Option<&str>) -> Result<PathBuf, String> {
    let trimmed = workspace_root.map(str::trim).unwrap_or_default();
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

    path.canonicalize()
        .map_err(|err| format!("failed to resolve workspace root: {err}"))
}

fn normalize_upstream_local_environment_config_path(config_path: &str) -> Result<PathBuf, String> {
    let trimmed = config_path.trim();
    if trimmed.is_empty() {
        return Err("local environment config path is empty".to_string());
    }

    let path = Path::new(trimmed);
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        let current_dir = env::current_dir()
            .map_err(|err| format!("failed to resolve current directory: {err}"))?;
        current_dir.join(path)
    };
    let candidate = normalize_path_lexically(&candidate);
    let _ = local_environment_owner_root_from_config_path(&candidate)?;
    Ok(candidate)
}

fn normalize_local_environment_config_path(
    workspace_root: &Path,
    config_path: &str,
) -> Result<PathBuf, String> {
    let trimmed = config_path.trim();
    if trimmed.is_empty() {
        return Err("local environment config path is empty".to_string());
    }

    let path = Path::new(trimmed);
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        workspace_root.join(path)
    };
    let candidate = normalize_path_lexically(&candidate);

    let owner_root = local_environment_owner_root_from_config_path(&candidate)?;
    if !workspace_root
        .ancestors()
        .any(|ancestor| ancestor == owner_root.as_path())
    {
        return Err(format!(
            "local environment config path must resolve inside the workspace ancestry: {}",
            candidate.display()
        ));
    }

    Ok(candidate)
}

fn local_environment_owner_root_from_config_path(path: &Path) -> Result<PathBuf, String> {
    if path.extension() != Some(OsStr::new("toml")) {
        return Err(format!(
            "local environment config path must be a TOML file: {}",
            path.display()
        ));
    }

    let Some(parent) = path.parent() else {
        return Err(format!(
            "local environment config path has no parent directory: {}",
            path.display()
        ));
    };
    if parent.file_name() != Some(OsStr::new("environments")) {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    }
    let Some(codex_dir) = parent.parent() else {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    };
    if codex_dir.file_name() != Some(OsStr::new(".codex")) {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    }

    let Some(owner_root) = codex_dir.parent() else {
        return Err(format!(
            "local environment config path must have a workspace owner directory: {}",
            path.display()
        ));
    };

    if owner_root.exists() {
        owner_root
            .canonicalize()
            .map_err(|err| format!("failed to resolve local environment owner root: {err}"))
    } else {
        Ok(normalize_path_lexically(owner_root))
    }
}

fn normalize_path_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push(component.as_os_str());
                }
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    normalized
}

fn parse_local_environment_document(
    contents: &str,
    workspace_root: &Path,
) -> Result<LocalEnvironmentDocument, String> {
    toml::from_str::<LocalEnvironmentDocument>(contents)
        .map(|document| normalize_local_environment_document(document, workspace_root))
        .map_err(|err| format!("failed to parse local environment config: {err}"))
}

fn normalize_local_environment_document(
    mut document: LocalEnvironmentDocument,
    workspace_root: &Path,
) -> LocalEnvironmentDocument {
    if document.version == 0 {
        document.version = default_local_environment_version();
    }
    if document.name.trim().is_empty() {
        document.name = derive_path_label(workspace_root);
    }
    document
}

fn default_local_environment_document(workspace_root: &Path) -> LocalEnvironmentDocument {
    LocalEnvironmentDocument {
        version: default_local_environment_version(),
        name: derive_path_label(workspace_root),
        setup: LocalEnvironmentScriptSection::default(),
        cleanup: LocalEnvironmentScriptSection::default(),
        actions: Vec::new(),
    }
}

fn render_local_environment_document(environment: &LocalEnvironmentDocument) -> String {
    let mut output = String::new();
    output.push_str("# THIS IS AUTOGENERATED. DO NOT EDIT MANUALLY\n");
    output.push_str(&format!(
        "version = {}\nname = {}\n\n",
        if environment.version == 0 {
            default_local_environment_version()
        } else {
            environment.version
        },
        quote_toml_string(&environment.name)
    ));
    render_script_section(&mut output, "setup", &environment.setup);
    output.push('\n');
    render_script_section(&mut output, "cleanup", &environment.cleanup);

    let actions = environment
        .actions
        .iter()
        .filter_map(normalize_local_environment_action)
        .collect::<Vec<_>>();
    if !actions.is_empty() {
        output.push('\n');
        for (index, action) in actions.iter().enumerate() {
            if index > 0 {
                output.push('\n');
            }
            output.push_str("[[actions]]\n");
            output.push_str(&format!("name = {}\n", quote_toml_string(&action.name)));
            if let Some(icon) = action
                .icon
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("icon = {}\n", quote_toml_string(icon)));
            }
            output.push_str(&format!(
                "command = {}\n",
                quote_toml_string(&action.command)
            ));
            if let Some(platform) = action
                .platform
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                output.push_str(&format!("platform = {}\n", quote_toml_string(platform)));
            }
        }
    }

    output
}

fn render_script_section(
    output: &mut String,
    section_name: &str,
    scripts: &LocalEnvironmentScriptSection,
) {
    output.push_str(&format!(
        "[{section_name}]\nscript = {}\n",
        quote_toml_string(&scripts.script)
    ));

    if let Some(darwin) = scripts
        .darwin
        .as_ref()
        .map(|script| script.script.as_str())
        .filter(|script| !script.is_empty())
    {
        output.push('\n');
        output.push_str(&format!(
            "[{section_name}.darwin]\nscript = {}\n",
            quote_toml_string(darwin)
        ));
    }
    if let Some(linux) = scripts
        .linux
        .as_ref()
        .map(|script| script.script.as_str())
        .filter(|script| !script.is_empty())
    {
        output.push('\n');
        output.push_str(&format!(
            "[{section_name}.linux]\nscript = {}\n",
            quote_toml_string(linux)
        ));
    }
    if let Some(win32) = scripts
        .win32
        .as_ref()
        .map(|script| script.script.as_str())
        .filter(|script| !script.is_empty())
    {
        output.push('\n');
        output.push_str(&format!(
            "[{section_name}.win32]\nscript = {}\n",
            quote_toml_string(win32)
        ));
    }
}

fn normalize_local_environment_action(
    action: &LocalEnvironmentAction,
) -> Option<LocalEnvironmentAction> {
    let name = action.name.trim();
    let command = action.command.trim();
    if name.is_empty() || command.is_empty() {
        return None;
    }

    Some(LocalEnvironmentAction {
        name: name.to_string(),
        icon: action
            .icon
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        command: command.to_string(),
        platform: action
            .platform
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    })
}

fn quote_toml_string(value: &str) -> String {
    let normalized = value.replace("\r\n", "\n");
    if normalized.contains('\n') {
        if normalized.contains("'''") {
            return format!(
                "\"\"\"\n{}\n\"\"\"",
                normalized
                    .replace('\\', "\\\\")
                    .replace("\"\"\"", "\\\"\"\"")
            );
        }
        return format!("'''\n{normalized}\n'''");
    }

    serde_json::to_string(&normalized).unwrap_or_else(|_| "\"\"".to_string())
}

fn derive_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(OsStr::to_str)
        .map_or_else(|| "local".to_string(), ToString::to_string)
}

fn file_name_label(path: &Path) -> String {
    path.file_name().and_then(OsStr::to_str).map_or_else(
        || DEFAULT_ENVIRONMENT_FILE_NAME.to_string(),
        ToString::to_string,
    )
}

fn default_local_environment_version() -> u64 {
    1
}

fn read_upstream_local_environment_entry(
    path: &Path,
) -> Result<UpstreamLocalEnvironmentEntry, String> {
    if !path.is_file() {
        return Err(format!(
            "local environment config does not exist: {}",
            path.display()
        ));
    }

    let owner_root = local_environment_owner_root_from_config_path(path)?;
    let contents = fs::read_to_string(path)
        .map_err(|err| format!("failed to read local environment config: {err}"))?;

    let state = match parse_local_environment_document(&contents, &owner_root) {
        Ok(environment) => UpstreamLocalEnvironmentState::Success { environment },
        Err(message) => UpstreamLocalEnvironmentState::Error {
            error: UpstreamLocalEnvironmentError { message },
        },
    };

    Ok(UpstreamLocalEnvironmentEntry {
        config_path: path.display().to_string(),
        state,
    })
}

fn read_upstream_local_environment_config(
    path: &Path,
) -> Result<UpstreamLocalEnvironmentConfigResponse, String> {
    if !path.is_file() {
        return Ok(UpstreamLocalEnvironmentConfigResponse {
            config_path: path.display().to_string(),
            exists: false,
            raw: None,
        });
    }

    let raw = fs::read_to_string(path)
        .map_err(|err| format!("failed to read local environment config: {err}"))?;
    Ok(UpstreamLocalEnvironmentConfigResponse {
        config_path: path.display().to_string(),
        exists: true,
        raw: Some(raw),
    })
}

fn write_upstream_local_environment_config(
    path: &Path,
    raw: &str,
) -> Result<UpstreamLocalEnvironmentConfigSaveResponse, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "local environment config path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create local environment directory: {err}"))?;
    fs::write(path, raw.as_bytes())
        .map_err(|err| format!("failed to write local environment config: {err}"))?;

    Ok(UpstreamLocalEnvironmentConfigSaveResponse {
        config_path: path.display().to_string(),
        success: true,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn upstream_local_environments_returns_success_and_error_entries() {
        let workspace_root = temp_workspace_root("list");
        let environments_dir = workspace_root.join(LOCAL_ENVIRONMENTS_DIR);
        fs::create_dir_all(&environments_dir).expect("environments directory should be created");
        let valid_path = environments_dir.join("environment.toml");
        let invalid_path = environments_dir.join("broken.toml");
        fs::write(&valid_path, "version = 1\nname = \"demo\"\n")
            .expect("valid environment should be written");
        fs::write(&invalid_path, "not valid toml").expect("invalid environment should be written");

        let environments = collect_upstream_local_environment_entries(&workspace_root)
            .expect("list should succeed");

        assert_eq!(
            environments,
            vec![
                UpstreamLocalEnvironmentEntry {
                    config_path: invalid_path.display().to_string(),
                    state: UpstreamLocalEnvironmentState::Error {
                        error: UpstreamLocalEnvironmentError {
                            message:
                                "failed to parse local environment config: TOML parse error at line 1, column 5\n  |\n1 | not valid toml\n  |     ^\nexpected `.`, `=`\n"
                                    .to_string(),
                        },
                    },
                },
                UpstreamLocalEnvironmentEntry {
                    config_path: valid_path.display().to_string(),
                    state: UpstreamLocalEnvironmentState::Success {
                        environment: LocalEnvironmentDocument {
                            version: 1,
                            name: "demo".to_string(),
                            setup: LocalEnvironmentScriptSection::default(),
                            cleanup: LocalEnvironmentScriptSection::default(),
                            actions: Vec::new(),
                        },
                    },
                },
            ]
        );

        let _ = fs::remove_dir_all(&workspace_root);
    }

    #[test]
    fn upstream_local_environment_config_reports_missing_file() {
        let path = temp_workspace_root("missing")
            .join(".codex")
            .join("environments")
            .join("environment.toml");

        let response = read_upstream_local_environment_config(&path).expect("read should succeed");

        assert_eq!(
            response,
            UpstreamLocalEnvironmentConfigResponse {
                config_path: path.display().to_string(),
                exists: false,
                raw: None,
            }
        );
    }

    #[test]
    fn upstream_local_environment_config_save_writes_raw_contents() {
        let path = temp_workspace_root("save")
            .join(".codex")
            .join("environments")
            .join("environment.toml");
        let raw = "version = 1\nname = \"demo\"\n";

        let response =
            write_upstream_local_environment_config(&path, raw).expect("save should succeed");

        assert_eq!(
            response,
            UpstreamLocalEnvironmentConfigSaveResponse {
                config_path: path.display().to_string(),
                success: true,
            }
        );
        assert_eq!(
            fs::read_to_string(&path).expect("saved config should be readable"),
            raw
        );

        let workspace_root = path
            .ancestors()
            .nth(3)
            .expect("workspace root ancestor should exist");
        let _ = fs::remove_dir_all(workspace_root);
    }

    #[test]
    fn upstream_local_environment_reads_parsed_success_state() {
        let workspace_root = temp_workspace_root("single");
        let path = workspace_root
            .join(".codex")
            .join("environments")
            .join("environment.toml");
        fs::create_dir_all(path.parent().expect("path should have parent"))
            .expect("environments directory should be created");
        fs::write(&path, "version = 1\nname = \"demo\"\n").expect("environment should be written");

        let entry =
            read_upstream_local_environment_entry(&path).expect("environment read should succeed");

        assert_eq!(
            entry,
            UpstreamLocalEnvironmentEntry {
                config_path: path.display().to_string(),
                state: UpstreamLocalEnvironmentState::Success {
                    environment: LocalEnvironmentDocument {
                        version: 1,
                        name: "demo".to_string(),
                        setup: LocalEnvironmentScriptSection::default(),
                        cleanup: LocalEnvironmentScriptSection::default(),
                        actions: Vec::new(),
                    },
                },
            }
        );

        let _ = fs::remove_dir_all(&workspace_root);
    }

    #[test]
    fn upstream_local_environment_commands_only_accept_local_host() {
        assert!(ensure_supported_host_id(None, "local-environments").is_ok());
        assert!(ensure_supported_host_id(Some(""), "local-environments").is_ok());
        assert!(ensure_supported_host_id(Some("local"), "local-environments").is_ok());
        assert_eq!(
            ensure_supported_host_id(Some("remote"), "local-environments")
                .expect_err("non-local host id should be rejected"),
            "local-environments does not support host id: remote"
        );
    }

    fn temp_workspace_root(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        env::temp_dir().join(format!(
            "codex-app-replica-local-environments-{case_name}-{unique_suffix}"
        ))
    }
}
