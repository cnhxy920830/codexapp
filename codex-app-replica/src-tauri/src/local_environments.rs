use serde::Deserialize;
use serde::Serialize;
use std::ffi::OsStr;
use std::fs;
use std::path::Component;
use std::path::Path;
use std::path::PathBuf;

const LOCAL_ENVIRONMENTS_DIR: &str = ".codex/environments";
const DEFAULT_ENVIRONMENT_FILE_NAME: &str = "environment.toml";

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
