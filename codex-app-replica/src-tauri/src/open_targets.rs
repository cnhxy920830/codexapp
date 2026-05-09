#[cfg(target_os = "windows")]
use crate::global_settings::default_wsl_distro_name;
use crate::global_settings::read_global_settings;
use crate::global_settings::write_global_settings;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Map;
use serde_json::Value;
use std::collections::BTreeMap;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

const ANDROID_STUDIO_TARGET: &str = "androidStudio";
const ANTIGRAVITY_TARGET: &str = "antigravity";
const CMDER_TARGET: &str = "cmder";
const CURSOR_TARGET: &str = "cursor";
const FILE_MANAGER_TARGET: &str = "fileManager";
const GIT_BASH_TARGET: &str = "gitBash";
const GITHUB_DESKTOP_TARGET: &str = "githubDesktop";
const GOLAND_TARGET: &str = "goland";
const INTELLIJ_TARGET: &str = "intellij";
const LOCAL_HOST_ID: &str = "local";
const OPEN_IN_TARGET_PREFERENCES_KEY: &str = "OPEN_IN_TARGET_PREFERENCES";
const PHPSTORM_TARGET: &str = "phpstorm";
const PYCHARM_TARGET: &str = "pycharm";
const RIDER_TARGET: &str = "rider";
const RUSTROVER_TARGET: &str = "rustrover";
const SUBLIME_TEXT_TARGET: &str = "sublimeText";
const SYSTEM_DEFAULT_TARGET: &str = "systemDefault";
const TERMINAL_TARGET: &str = "terminal";
const VISUAL_STUDIO_TARGET: &str = "visualStudio";
const VSCODE_INSIDERS_TARGET: &str = "vscodeInsiders";
const VSCODE_TARGET: &str = "vscode";
const WEBSTORM_TARGET: &str = "webstorm";
const WSL_TARGET: &str = "wsl";
const ZED_TARGET: &str = "zed";

const OPEN_TARGET_MODE_EDITOR: &str = "editor";
const OPEN_TARGET_MODE_NATIVE: &str = "native";

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInTargetsParams {
    pub host_id: Option<String>,
    pub cwd: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInTargetsResponse {
    pub preferred_target: Option<String>,
    pub available_targets: Vec<String>,
    pub mode: String,
    pub targets: Vec<OpenTargetItem>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenTargetItem {
    pub id: String,
    pub target: String,
    pub label: String,
    pub icon: Option<String>,
    pub kind: String,
    pub hidden: bool,
    pub available: bool,
    pub default: bool,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetPreferredAppParams {
    pub target: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SetPreferredAppResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenTargetLocation {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenInTargetPreferences {
    global: Option<String>,
    per_path: Option<BTreeMap<String, String>>,
}

#[derive(Clone, Copy)]
enum LaunchStrategy {
    GoToEditor,
    JetBrainsEditor,
    PathOnlyEditor,
    SublimeEditor,
    DirectoryEditor,
    SystemDefault,
    FileManager,
    Terminal,
    GitBash,
    Cmder,
    Wsl,
}

struct OpenTargetDefinition {
    id: &'static str,
    label: &'static str,
    icon: &'static str,
    kind: &'static str,
    hidden: bool,
    detect: fn() -> Option<PathBuf>,
    launch: LaunchStrategy,
}

const WINDOWS_OPEN_TARGETS: &[OpenTargetDefinition] = &[
    OpenTargetDefinition {
        id: VSCODE_TARGET,
        label: "VS Code",
        icon: "apps/vscode.png",
        kind: "editor",
        hidden: false,
        detect: detect_vscode,
        launch: LaunchStrategy::GoToEditor,
    },
    OpenTargetDefinition {
        id: VSCODE_INSIDERS_TARGET,
        label: "VS Code Insiders",
        icon: "apps/vscode-insiders.png",
        kind: "editor",
        hidden: false,
        detect: detect_vscode_insiders,
        launch: LaunchStrategy::GoToEditor,
    },
    OpenTargetDefinition {
        id: VISUAL_STUDIO_TARGET,
        label: "Visual Studio",
        icon: "apps/vscode.png",
        kind: "editor",
        hidden: false,
        detect: detect_visual_studio,
        launch: LaunchStrategy::PathOnlyEditor,
    },
    OpenTargetDefinition {
        id: CURSOR_TARGET,
        label: "Cursor",
        icon: "apps/cursor.png",
        kind: "editor",
        hidden: false,
        detect: detect_cursor,
        launch: LaunchStrategy::GoToEditor,
    },
    OpenTargetDefinition {
        id: SUBLIME_TEXT_TARGET,
        label: "Sublime Text",
        icon: "apps/sublime-text.png",
        kind: "editor",
        hidden: false,
        detect: detect_sublime_text,
        launch: LaunchStrategy::SublimeEditor,
    },
    OpenTargetDefinition {
        id: ZED_TARGET,
        label: "Zed",
        icon: "apps/zed.png",
        kind: "editor",
        hidden: false,
        detect: detect_zed,
        launch: LaunchStrategy::GoToEditor,
    },
    OpenTargetDefinition {
        id: ANTIGRAVITY_TARGET,
        label: "Antigravity",
        icon: "apps/antigravity.png",
        kind: "editor",
        hidden: false,
        detect: detect_antigravity,
        launch: LaunchStrategy::GoToEditor,
    },
    OpenTargetDefinition {
        id: GITHUB_DESKTOP_TARGET,
        label: "GitHub Desktop",
        icon: "apps/vscode.png",
        kind: "editor",
        hidden: false,
        detect: detect_github_desktop,
        launch: LaunchStrategy::DirectoryEditor,
    },
    OpenTargetDefinition {
        id: SYSTEM_DEFAULT_TARGET,
        label: "Default app",
        icon: "apps/file-explorer.png",
        kind: "systemDefault",
        hidden: true,
        detect: detect_system_default,
        launch: LaunchStrategy::SystemDefault,
    },
    OpenTargetDefinition {
        id: FILE_MANAGER_TARGET,
        label: "File Explorer",
        icon: "apps/file-explorer.png",
        kind: "fileManager",
        hidden: false,
        detect: detect_file_manager,
        launch: LaunchStrategy::FileManager,
    },
    OpenTargetDefinition {
        id: TERMINAL_TARGET,
        label: "Terminal",
        icon: "apps/microsoft-terminal.png",
        kind: "terminal",
        hidden: false,
        detect: detect_terminal,
        launch: LaunchStrategy::Terminal,
    },
    OpenTargetDefinition {
        id: GIT_BASH_TARGET,
        label: "Git Bash",
        icon: "apps/vscode.png",
        kind: "terminal",
        hidden: false,
        detect: detect_git_bash,
        launch: LaunchStrategy::GitBash,
    },
    OpenTargetDefinition {
        id: CMDER_TARGET,
        label: "Cmder",
        icon: "apps/cmder.png",
        kind: "terminal",
        hidden: false,
        detect: detect_cmder,
        launch: LaunchStrategy::Cmder,
    },
    OpenTargetDefinition {
        id: WSL_TARGET,
        label: "WSL",
        icon: "apps/terminal.png",
        kind: "terminal",
        hidden: false,
        detect: detect_wsl,
        launch: LaunchStrategy::Wsl,
    },
    OpenTargetDefinition {
        id: ANDROID_STUDIO_TARGET,
        label: "Android Studio",
        icon: "apps/android-studio.png",
        kind: "editor",
        hidden: false,
        detect: detect_android_studio,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: INTELLIJ_TARGET,
        label: "IntelliJ IDEA",
        icon: "apps/intellij.png",
        kind: "editor",
        hidden: false,
        detect: detect_intellij,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: RIDER_TARGET,
        label: "Rider",
        icon: "apps/rider.png",
        kind: "editor",
        hidden: false,
        detect: detect_rider,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: GOLAND_TARGET,
        label: "GoLand",
        icon: "apps/goland.png",
        kind: "editor",
        hidden: false,
        detect: detect_goland,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: RUSTROVER_TARGET,
        label: "RustRover",
        icon: "apps/rustrover.png",
        kind: "editor",
        hidden: false,
        detect: detect_rustrover,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: PYCHARM_TARGET,
        label: "PyCharm",
        icon: "apps/pycharm.png",
        kind: "editor",
        hidden: false,
        detect: detect_pycharm,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: WEBSTORM_TARGET,
        label: "WebStorm",
        icon: "apps/webstorm.svg",
        kind: "editor",
        hidden: false,
        detect: detect_webstorm,
        launch: LaunchStrategy::JetBrainsEditor,
    },
    OpenTargetDefinition {
        id: PHPSTORM_TARGET,
        label: "PhpStorm",
        icon: "apps/phpstorm.png",
        kind: "editor",
        hidden: false,
        detect: detect_phpstorm,
        launch: LaunchStrategy::JetBrainsEditor,
    },
];

#[tauri::command(rename = "open-in-targets")]
pub fn open_in_targets(
    app: AppHandle,
    params: OpenInTargetsParams,
) -> Result<OpenInTargetsResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "open-in-targets")?;
    let available_targets = available_open_target_ids();
    let preferred_target = read_preferred_target(&app, params.cwd.as_deref(), &available_targets)?;
    let available_set = available_targets.iter().cloned().collect::<HashSet<_>>();
    let mode = resolve_open_target_mode(params.path.as_deref(), params.cwd.as_deref());
    let targets = WINDOWS_OPEN_TARGETS
        .iter()
        .map(|definition| OpenTargetItem {
            id: definition.id.to_string(),
            target: definition.id.to_string(),
            label: definition.label.to_string(),
            icon: Some(definition.icon.to_string()),
            kind: definition.kind.to_string(),
            hidden: definition.hidden,
            available: available_set.contains(definition.id),
            default: preferred_target.as_deref() == Some(definition.id),
        })
        .collect();

    Ok(OpenInTargetsResponse {
        preferred_target,
        available_targets,
        mode,
        targets,
    })
}

#[tauri::command(rename = "set-preferred-app")]
pub fn set_preferred_app(
    app: AppHandle,
    params: SetPreferredAppParams,
) -> Result<SetPreferredAppResponse, String> {
    let target = normalize_open_target_id(&params.target)
        .ok_or_else(|| format!("unsupported open target: {}", params.target))?;
    write_preferred_target(&app, None, target)?;
    Ok(SetPreferredAppResponse { success: true })
}

pub(crate) fn ensure_supported_host_id(
    host_id: Option<&str>,
    command_name: &str,
) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

pub(crate) fn open_path_in_effective_target(
    app: &AppHandle,
    requested_target: Option<&str>,
    cwd: Option<&str>,
    path: &Path,
    location: Option<OpenTargetLocation>,
) -> Result<(), String> {
    let available_targets = available_open_target_ids();
    let preferred_target = read_preferred_target(app, cwd, &available_targets)?;
    let target = choose_effective_target(
        requested_target,
        preferred_target.as_deref(),
        path,
        &available_targets,
    )
    .ok_or_else(|| "No available open target".to_string())?;

    open_path_in_target(&target, path, location)
}

fn open_path_in_target(
    target: &str,
    path: &Path,
    location: Option<OpenTargetLocation>,
) -> Result<(), String> {
    let definition = windows_open_target_definition(target)
        .ok_or_else(|| format!("unsupported open target: {target}"))?;
    match definition.launch {
        LaunchStrategy::SystemDefault => open_in_system_default(path),
        LaunchStrategy::FileManager => open_in_file_manager(path),
        LaunchStrategy::Terminal => {
            let command = detect_terminal()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &["-d".to_string(), open_target_directory(path)])
        }
        LaunchStrategy::GitBash => {
            let command = detect_git_bash()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &[format!("--cd={}", open_target_directory(path))])
        }
        LaunchStrategy::Cmder => {
            let command =
                detect_cmder().ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(
                &command,
                &["/START".to_string(), open_target_directory(path)],
            )
        }
        LaunchStrategy::Wsl => {
            let command = detect_terminal()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &build_wsl_args(path))
        }
        LaunchStrategy::GoToEditor => {
            let command = (definition.detect)()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &build_goto_args(path, location.as_ref()))
        }
        LaunchStrategy::JetBrainsEditor => {
            let command = (definition.detect)()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &build_jetbrains_args(path, location.as_ref()))
        }
        LaunchStrategy::PathOnlyEditor => {
            let command = (definition.detect)()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &[path.display().to_string()])
        }
        LaunchStrategy::SublimeEditor => {
            let command = (definition.detect)()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &build_sublime_args(path, location.as_ref()))
        }
        LaunchStrategy::DirectoryEditor => {
            let command = (definition.detect)()
                .ok_or_else(|| format!("open target is not available: {target}"))?;
            launch_detached(&command, &[open_target_directory(path)])
        }
    }
}

fn available_open_target_ids() -> Vec<String> {
    WINDOWS_OPEN_TARGETS
        .iter()
        .filter_map(|definition| {
            if (definition.detect)().is_some() {
                Some(definition.id.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn resolve_open_target_mode(path: Option<&str>, cwd: Option<&str>) -> String {
    let Some(path) = path else {
        return OPEN_TARGET_MODE_EDITOR.to_string();
    };
    let Ok(resolved) = resolve_optional_path(path, cwd) else {
        return OPEN_TARGET_MODE_EDITOR.to_string();
    };

    if is_platform_default_viewer_file(&resolved) {
        return OPEN_TARGET_MODE_NATIVE.to_string();
    }

    OPEN_TARGET_MODE_EDITOR.to_string()
}

fn read_preferred_target(
    app: &AppHandle,
    path: Option<&str>,
    available_targets: &[String],
) -> Result<Option<String>, String> {
    let settings = read_global_settings(app)?;
    let preferences = read_preferences_from_settings(&settings);
    Ok(resolve_preferred_target(
        &preferences,
        normalize_preference_path(path),
        available_targets,
    ))
}

fn write_preferred_target(app: &AppHandle, path: Option<&str>, target: &str) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    let mut preferences = read_preferences_from_settings(&settings);
    preferences.global = Some(target.to_string());
    if let Some(path) = normalize_preference_path(path) {
        let per_path = preferences.per_path.get_or_insert_with(BTreeMap::new);
        per_path.insert(path.to_string(), target.to_string());
    }
    let value = serde_json::to_value(prune_preferences(preferences))
        .map_err(|err| format!("failed to encode open target preferences: {err}"))?;
    settings.insert(OPEN_IN_TARGET_PREFERENCES_KEY.to_string(), value);
    write_global_settings(app, &settings)
}

fn read_preferences_from_settings(settings: &Map<String, Value>) -> OpenInTargetPreferences {
    let raw = settings
        .get(OPEN_IN_TARGET_PREFERENCES_KEY)
        .cloned()
        .unwrap_or(Value::Null);
    let Ok(preferences) = serde_json::from_value::<OpenInTargetPreferences>(raw) else {
        return OpenInTargetPreferences::default();
    };
    normalize_preferences(preferences)
}

fn normalize_preferences(preferences: OpenInTargetPreferences) -> OpenInTargetPreferences {
    let global = preferences
        .global
        .as_deref()
        .and_then(normalize_open_target_id)
        .map(str::to_string);
    let per_path = preferences.per_path.and_then(|per_path| {
        let normalized = per_path
            .into_iter()
            .filter_map(|(path, target)| {
                normalize_open_target_id(&target).map(|target| (path, target.to_string()))
            })
            .collect::<BTreeMap<_, _>>();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    });
    OpenInTargetPreferences { global, per_path }
}

fn prune_preferences(preferences: OpenInTargetPreferences) -> OpenInTargetPreferences {
    let per_path = preferences.per_path.and_then(|per_path| {
        if per_path.is_empty() {
            None
        } else {
            Some(per_path)
        }
    });
    OpenInTargetPreferences {
        global: preferences.global,
        per_path,
    }
}

fn resolve_preferred_target(
    preferences: &OpenInTargetPreferences,
    path: Option<&str>,
    available_targets: &[String],
) -> Option<String> {
    let available = available_targets.iter().cloned().collect::<HashSet<_>>();
    let preferred = path
        .and_then(|path| {
            preferences
                .per_path
                .as_ref()
                .and_then(|per_path| per_path.get(path))
        })
        .or(preferences.global.as_ref());

    if let Some(preferred) = preferred.filter(|preferred| available.contains(preferred.as_str())) {
        return Some(preferred.clone());
    }

    available_targets.first().cloned()
}

fn choose_effective_target(
    requested_target: Option<&str>,
    preferred_target: Option<&str>,
    path: &Path,
    available_targets: &[String],
) -> Option<String> {
    let available = available_targets.iter().cloned().collect::<HashSet<_>>();
    if let Some(target) = requested_target.and_then(normalize_open_target_id) {
        if available.contains(target) {
            return Some(target.to_string());
        }
        return None;
    }

    if path.is_dir() && available.contains(FILE_MANAGER_TARGET) {
        return Some(FILE_MANAGER_TARGET.to_string());
    }

    if is_platform_default_viewer_file(path) && available.contains(SYSTEM_DEFAULT_TARGET) {
        return Some(SYSTEM_DEFAULT_TARGET.to_string());
    }

    if let Some(target) = preferred_target {
        if available.contains(target) {
            return Some(target.to_string());
        }
    }

    available_targets.first().cloned()
}

fn normalize_open_target_id(target: &str) -> Option<&'static str> {
    match target {
        "finder" => Some(FILE_MANAGER_TARGET),
        _ => windows_open_target_definition(target).map(|definition| definition.id),
    }
}

fn normalize_preference_path(path: Option<&str>) -> Option<&str> {
    path.map(str::trim).filter(|path| !path.is_empty())
}

fn resolve_optional_path(path: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
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
        .filter(|cwd| !cwd.is_empty())
        .ok_or_else(|| format!("relative path requires cwd: {trimmed}"))?;
    Ok(PathBuf::from(cwd).join(requested))
}

fn windows_open_target_definition(target: &str) -> Option<&'static OpenTargetDefinition> {
    WINDOWS_OPEN_TARGETS
        .iter()
        .find(|definition| definition.id == target)
}

fn build_goto_args(path: &Path, location: Option<&OpenTargetLocation>) -> Vec<String> {
    match location {
        Some(location) => vec![
            format!("--goto"),
            format!("{}:{}:{}", path.display(), location.line, location.column),
        ],
        None => vec![path.display().to_string()],
    }
}

fn build_jetbrains_args(path: &Path, location: Option<&OpenTargetLocation>) -> Vec<String> {
    let mut args = Vec::new();
    if let Some(location) = location {
        args.push("--line".to_string());
        args.push(location.line.to_string());
        args.push("--column".to_string());
        args.push(location.column.to_string());
    }
    args.push(path.display().to_string());
    args
}

fn build_sublime_args(path: &Path, location: Option<&OpenTargetLocation>) -> Vec<String> {
    match location {
        Some(location) => vec![format!(
            "{}:{}:{}",
            path.display(),
            location.line,
            location.column
        )],
        None => vec![path.display().to_string()],
    }
}

fn build_wsl_args(path: &Path) -> Vec<String> {
    let directory = open_target_directory(path);
    if directory.starts_with(r"\\") {
        return vec!["-d".to_string(), directory, "wsl.exe".to_string()];
    }

    vec![
        "-d".to_string(),
        directory.clone(),
        "wsl.exe".to_string(),
        "--cd".to_string(),
        windows_path_to_wsl_path(&directory),
    ]
}

fn open_target_directory(path: &Path) -> String {
    let existing = nearest_existing_path(path).unwrap_or_else(|| path.to_path_buf());
    let directory = if existing.is_dir() {
        existing
    } else {
        existing.parent().map(Path::to_path_buf).unwrap_or(existing)
    };
    directory.display().to_string()
}

fn open_in_system_default(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let existing = nearest_existing_path(path).unwrap_or_else(|| path.to_path_buf());
        let path = existing.display().to_string();
        let output = Command::new("cmd.exe")
            .arg("/d")
            .arg("/s")
            .arg("/c")
            .arg("start")
            .arg("")
            .arg(path)
            .spawn();
        return output
            .map(|_| ())
            .map_err(|err| format!("failed to launch system default app: {err}"));
    }

    #[allow(unreachable_code)]
    Err("open target is not supported on this platform".to_string())
}

fn open_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let existing = nearest_existing_path(path)
            .ok_or_else(|| format!("failed to resolve file manager path: {}", path.display()))?;
        if existing.is_file() {
            return Command::new("explorer.exe")
                .arg(format!("/select,{}", existing.display()))
                .spawn()
                .map(|_| ())
                .map_err(|err| format!("failed to launch explorer.exe: {err}"));
        }

        return Command::new("explorer.exe")
            .arg(existing)
            .spawn()
            .map(|_| ())
            .map_err(|err| format!("failed to launch explorer.exe: {err}"));
    }

    #[allow(unreachable_code)]
    Err("open target is not supported on this platform".to_string())
}

fn launch_detached(command: &Path, args: &[String]) -> Result<(), String> {
    let mut process = Command::new("cmd.exe");
    process
        .arg("/d")
        .arg("/s")
        .arg("/c")
        .arg("start")
        .arg("")
        .arg(command);
    for arg in args {
        process.arg(arg);
    }
    process
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("failed to launch {}: {err}", command.display()))
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

fn is_platform_default_viewer_file(path: &Path) -> bool {
    if !path.exists() || !path.is_file() {
        return false;
    }

    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some(
            "7z" | "aac"
                | "ai"
                | "aif"
                | "aiff"
                | "avi"
                | "bmp"
                | "bz2"
                | "caf"
                | "csv"
                | "doc"
                | "docx"
                | "fig"
                | "flac"
                | "gif"
                | "gz"
                | "html"
                | "ico"
                | "indd"
                | "jpeg"
                | "jpg"
                | "key"
                | "m4a"
                | "m4v"
                | "mkv"
                | "mov"
                | "mp3"
                | "mp4"
                | "mpeg"
                | "mpg"
                | "numbers"
                | "pages"
                | "pdf"
                | "png"
                | "ppt"
                | "pptx"
                | "psd"
                | "rar"
                | "sketch"
                | "tar"
                | "tbz"
                | "tgz"
                | "tiff"
                | "txz"
                | "wav"
                | "webm"
                | "webp"
                | "xls"
                | "xlsx"
                | "xd"
                | "xz"
                | "zip"
        )
    )
}

#[cfg(target_os = "windows")]
fn detect_vscode() -> Option<PathBuf> {
    detect_path_or_install_dir("code", "Code.exe", "Microsoft VS Code")
}

#[cfg(not(target_os = "windows"))]
fn detect_vscode() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_vscode_insiders() -> Option<PathBuf> {
    detect_path_or_install_dir(
        "code-insiders",
        "Code - Insiders.exe",
        "Microsoft VS Code Insiders",
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_vscode_insiders() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_visual_studio() -> Option<PathBuf> {
    find_command_on_path("devenv.exe")
        .or_else(|| find_command_on_path("devenv"))
        .and_then(|path| sibling_executable(&path, "devenv.exe").or(Some(path)))
        .or_else(|| {
            let years = ["2022", "2019", "2017"];
            let editions = [
                "Community",
                "Professional",
                "Enterprise",
                "Preview",
                "BuildTools",
            ];
            for root in windows_program_roots() {
                for year in years {
                    for edition in editions {
                        let candidate = root
                            .join("Microsoft Visual Studio")
                            .join(year)
                            .join(edition)
                            .join("Common7")
                            .join("IDE")
                            .join("devenv.exe");
                        if candidate.exists() {
                            return Some(candidate);
                        }
                    }
                }
            }
            None
        })
}

#[cfg(not(target_os = "windows"))]
fn detect_visual_studio() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_cursor() -> Option<PathBuf> {
    find_command_on_path("cursor")
        .and_then(|path| {
            let sibling = sibling_executable(&path, "Cursor.exe");
            sibling.or_else(|| {
                if file_name_equals(&path, "Cursor.exe") {
                    Some(path)
                } else {
                    None
                }
            })
        })
        .or_else(|| find_in_program_roots(&[&["Cursor", "Cursor.exe"]]))
}

#[cfg(not(target_os = "windows"))]
fn detect_cursor() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_sublime_text() -> Option<PathBuf> {
    find_command_on_path("subl.exe")
        .or_else(|| find_command_on_path("subl"))
        .and_then(|path| sibling_executable(&path, "sublime_text.exe").or(Some(path)))
        .or_else(|| {
            find_in_program_roots(&[
                &["Sublime Text", "sublime_text.exe"],
                &["Sublime Text", "subl.exe"],
            ])
        })
}

#[cfg(not(target_os = "windows"))]
fn detect_sublime_text() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_zed() -> Option<PathBuf> {
    find_command_on_path("zed.exe")
        .or_else(|| find_command_on_path("zed"))
        .and_then(|path| sibling_executable(&path, "Zed.exe").or(Some(path)))
        .or_else(|| find_in_program_roots(&[&["Zed", "Zed.exe"]]))
}

#[cfg(not(target_os = "windows"))]
fn detect_zed() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_antigravity() -> Option<PathBuf> {
    find_command_on_path("antigravity.exe")
        .or_else(|| find_command_on_path("antigravity.cmd"))
        .or_else(|| find_command_on_path("antigravity"))
        .or_else(|| {
            find_in_program_roots(&[
                &["Antigravity", "Antigravity.exe"],
                &["antigravity", "Antigravity.exe"],
                &["Antigravity", "bin", "antigravity.cmd"],
                &["antigravity", "bin", "antigravity.cmd"],
                &["Antigravity", "resources", "app", "bin", "antigravity.cmd"],
                &["antigravity", "resources", "app", "bin", "antigravity.cmd"],
            ])
        })
}

#[cfg(not(target_os = "windows"))]
fn detect_antigravity() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_github_desktop() -> Option<PathBuf> {
    find_command_on_path("github.exe")
        .or_else(|| find_command_on_path("github"))
        .and_then(|path| sibling_executable(&path, "GitHubDesktop.exe").or(Some(path)))
        .or_else(|| {
            let local_app_data = std::env::var_os("LOCALAPPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    PathBuf::from(std::env::var_os("USERPROFILE").unwrap_or_default())
                        .join("AppData")
                        .join("Local")
                });
            [
                local_app_data
                    .join("GitHubDesktop")
                    .join("GitHubDesktop.exe"),
                local_app_data
                    .join("GitHub Desktop")
                    .join("GitHubDesktop.exe"),
            ]
            .into_iter()
            .find(|candidate| candidate.exists())
        })
        .or_else(|| {
            find_in_program_roots(&[
                &["GitHub Desktop", "GitHubDesktop.exe"],
                &["GitHubDesktop", "GitHubDesktop.exe"],
            ])
        })
}

#[cfg(not(target_os = "windows"))]
fn detect_github_desktop() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_system_default() -> Option<PathBuf> {
    Some(PathBuf::from("system-default"))
}

#[cfg(not(target_os = "windows"))]
fn detect_system_default() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_file_manager() -> Option<PathBuf> {
    let system_root = std::env::var_os("SystemRoot")
        .or_else(|| std::env::var_os("windir"))
        .map(PathBuf::from);
    system_root
        .map(|system_root| system_root.join("explorer.exe"))
        .filter(|path| path.exists())
        .or_else(|| Some(PathBuf::from("explorer.exe")))
}

#[cfg(not(target_os = "windows"))]
fn detect_file_manager() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_terminal() -> Option<PathBuf> {
    find_command_on_path("wt.exe")
        .or_else(|| find_windows_apps_executable("wt.exe"))
        .or_else(|| {
            let windows_terminal = start_menu_paths()
                .into_iter()
                .find_map(|path| find_file_recursively(&path, "Windows Terminal.lnk"));
            if windows_terminal.is_some() {
                return find_windows_apps_executable("wt.exe").or(Some(PathBuf::from("wt.exe")));
            }
            None
        })
}

#[cfg(not(target_os = "windows"))]
fn detect_terminal() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_git_bash() -> Option<PathBuf> {
    find_command_on_path("git-bash.exe")
        .or_else(|| find_command_on_path("git-bash"))
        .and_then(|path| sibling_executable(&path, "git-bash.exe").or(Some(path)))
        .or_else(|| find_in_program_roots(&[&["Git", "git-bash.exe"], &["Git", "bin", "bash.exe"]]))
}

#[cfg(not(target_os = "windows"))]
fn detect_git_bash() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_cmder() -> Option<PathBuf> {
    std::env::var_os("CMDER_ROOT")
        .map(PathBuf::from)
        .map(|path| path.join("Cmder.exe"))
        .filter(|path| path.exists())
        .or_else(|| find_command_on_path("cmder.exe"))
        .or_else(|| find_command_on_path("cmder"))
}

#[cfg(not(target_os = "windows"))]
fn detect_cmder() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_wsl() -> Option<PathBuf> {
    if default_wsl_distro_name().is_none() {
        return None;
    }
    detect_terminal()
}

#[cfg(not(target_os = "windows"))]
fn detect_wsl() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_android_studio() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["studio64.exe", "studio.exe", "studio"],
        &["android studio"],
        &["studio64.exe", "studio.exe"],
        Some(&[
            &["Android", "Android Studio", "bin", "studio64.exe"],
            &["Android", "Android Studio", "bin", "studio.exe"],
        ]),
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_android_studio() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_intellij() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["idea64.exe", "idea.exe", "idea"],
        &["intellij idea", "idea"],
        &["idea64.exe", "idea.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_intellij() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_rider() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["rider64.exe", "rider.exe", "rider"],
        &["rider"],
        &["rider64.exe", "rider.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_rider() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_goland() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["goland64.exe", "goland.exe", "goland"],
        &["goland"],
        &["goland64.exe", "goland.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_goland() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_rustrover() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["rustrover64.exe", "rustrover.exe", "rustrover"],
        &["rustrover"],
        &["rustrover64.exe", "rustrover.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_rustrover() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_pycharm() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["pycharm64.exe", "pycharm.exe", "pycharm"],
        &["pycharm"],
        &["pycharm64.exe", "pycharm.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_pycharm() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_webstorm() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["webstorm64.exe", "webstorm.exe", "webstorm"],
        &["webstorm"],
        &["webstorm64.exe", "webstorm.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_webstorm() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_phpstorm() -> Option<PathBuf> {
    detect_jetbrains_tool(
        &["phpstorm64.exe", "phpstorm.exe", "phpstorm"],
        &["phpstorm"],
        &["phpstorm64.exe", "phpstorm.exe"],
        None,
    )
}

#[cfg(not(target_os = "windows"))]
fn detect_phpstorm() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn detect_jetbrains_tool(
    path_commands: &[&str],
    install_dir_prefixes: &[&str],
    install_executables: &[&str],
    fallback_paths: Option<&[&[&str]]>,
) -> Option<PathBuf> {
    for command in path_commands {
        if let Some(path) = find_command_on_path(command) {
            return Some(path);
        }
    }

    find_install_dir_match(install_dir_prefixes, install_executables)
        .or_else(|| fallback_paths.and_then(find_in_program_roots))
}

#[cfg(target_os = "windows")]
fn detect_path_or_install_dir(
    path_command: &str,
    executable_name: &str,
    install_dir_name: &str,
) -> Option<PathBuf> {
    find_command_on_path(path_command)
        .and_then(|path| {
            sibling_executable(&path, executable_name).or_else(|| {
                if file_name_equals(&path, executable_name) {
                    Some(path)
                } else {
                    None
                }
            })
        })
        .or_else(|| find_in_program_roots(&[&[install_dir_name, executable_name]]))
}

#[cfg(target_os = "windows")]
fn find_command_on_path(command_name: &str) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("PATH") {
        for root in std::env::split_paths(&path) {
            let candidate = root.join(command_name);
            if let Some(existing) = resolve_existing_executable(&candidate) {
                return Some(existing);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn resolve_existing_executable(path: &Path) -> Option<PathBuf> {
    if path.exists() {
        return Some(path.to_path_buf());
    }
    if path.extension().is_some() {
        return None;
    }
    [".cmd", ".bat", ".exe"]
        .into_iter()
        .map(|extension| PathBuf::from(format!("{}{}", path.display(), extension)))
        .find(|candidate| candidate.exists())
}

#[cfg(target_os = "windows")]
fn sibling_executable(path: &Path, executable_name: &str) -> Option<PathBuf> {
    let directory = path.parent()?;
    if file_name_equals(directory, "bin") {
        let parent = directory.parent()?;
        let candidate = parent.join(executable_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    let candidate = directory.join(executable_name);
    if candidate.exists() {
        return Some(candidate);
    }
    None
}

#[cfg(target_os = "windows")]
fn file_name_equals(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn find_in_program_roots(path_segments_sets: &[&[&str]]) -> Option<PathBuf> {
    for root in windows_program_roots() {
        for path_segments in path_segments_sets {
            let candidate = path_segments
                .iter()
                .fold(root.clone(), |current, segment| current.join(segment));
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn find_install_dir_match(
    install_dir_prefixes: &[&str],
    install_executables: &[&str],
) -> Option<PathBuf> {
    let prefixes = install_dir_prefixes
        .iter()
        .map(|prefix| prefix.to_ascii_lowercase())
        .collect::<Vec<_>>();

    for root in windows_program_roots() {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        let mut directories = entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                entry.file_type().ok().and_then(|file_type| {
                    if file_type.is_dir() {
                        Some(entry.path())
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<_>>();
        directories.sort_by(|left, right| right.cmp(left));
        for directory in directories {
            let Some(name) = directory.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            let name = name.to_ascii_lowercase();
            if !prefixes.iter().any(|prefix| name.starts_with(prefix)) {
                continue;
            }
            for executable in install_executables {
                let candidate = directory.join("bin").join(executable);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn windows_program_roots() -> Vec<PathBuf> {
    [
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .map(|path| path.join("Programs")),
        std::env::var_os("ProgramFiles").map(PathBuf::from),
        std::env::var_os("ProgramFiles(x86)").map(PathBuf::from),
    ]
    .into_iter()
    .flatten()
    .collect()
}

#[cfg(target_os = "windows")]
fn find_windows_apps_executable(executable_name: &str) -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|path| {
            path.join("Microsoft")
                .join("WindowsApps")
                .join(executable_name)
        })
        .filter(|path| path.exists())
}

#[cfg(target_os = "windows")]
fn start_menu_paths() -> Vec<PathBuf> {
    [
        std::env::var_os("APPDATA").map(PathBuf::from).map(|path| {
            path.join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
        }),
        std::env::var_os("ProgramData")
            .map(PathBuf::from)
            .map(|path| {
                path.join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs")
            }),
    ]
    .into_iter()
    .flatten()
    .collect()
}

#[cfg(target_os = "windows")]
fn find_file_recursively(root: &Path, target_file_name: &str) -> Option<PathBuf> {
    if !root.exists() {
        return None;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return None;
    };
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_file() && file_name_equals(&path, target_file_name) {
            return Some(path);
        }
        if file_type.is_dir() {
            if let Some(found) = find_file_recursively(&path, target_file_name) {
                return Some(found);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn windows_path_to_wsl_path(path: &str) -> String {
    if path.starts_with(r"\\") {
        return path.to_string();
    }

    let normalized = path.replace('\\', "/");
    let mut parts = normalized.splitn(2, ':');
    let Some(drive) = parts.next() else {
        return normalized;
    };
    let Some(rest) = parts.next() else {
        return normalized;
    };

    format!(
        "/mnt/{}/{}",
        drive.to_ascii_lowercase(),
        rest.trim_start_matches('/')
    )
}

#[cfg(test)]
mod tests {
    use super::choose_effective_target;
    use super::is_platform_default_viewer_file;
    use super::normalize_open_target_id;
    use super::normalize_preferences;
    use super::resolve_preferred_target;
    use super::OpenInTargetPreferences;
    use super::WINDOWS_OPEN_TARGETS;
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::PathBuf;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    #[test]
    fn windows_open_target_order_matches_upstream() {
        let ids = WINDOWS_OPEN_TARGETS
            .iter()
            .map(|definition| definition.id)
            .collect::<Vec<_>>();

        assert_eq!(
            ids,
            vec![
                "vscode",
                "vscodeInsiders",
                "visualStudio",
                "cursor",
                "sublimeText",
                "zed",
                "antigravity",
                "githubDesktop",
                "systemDefault",
                "fileManager",
                "terminal",
                "gitBash",
                "cmder",
                "wsl",
                "androidStudio",
                "intellij",
                "rider",
                "goland",
                "rustrover",
                "pycharm",
                "webstorm",
                "phpstorm",
            ]
        );
    }

    #[test]
    fn normalize_open_target_id_maps_legacy_finder() {
        assert_eq!(normalize_open_target_id("finder"), Some("fileManager"));
        assert_eq!(normalize_open_target_id("vscode"), Some("vscode"));
        assert_eq!(normalize_open_target_id("unknown"), None);
    }

    #[test]
    fn normalize_preferences_drops_invalid_targets() {
        let preferences = OpenInTargetPreferences {
            global: Some("finder".to_string()),
            per_path: Some(BTreeMap::from([
                ("D:/repo".to_string(), "cursor".to_string()),
                ("D:/bad".to_string(), "nope".to_string()),
            ])),
        };

        assert_eq!(
            normalize_preferences(preferences),
            OpenInTargetPreferences {
                global: Some("fileManager".to_string()),
                per_path: Some(BTreeMap::from([(
                    "D:/repo".to_string(),
                    "cursor".to_string()
                )])),
            }
        );
    }

    #[test]
    fn resolve_preferred_target_uses_per_path_before_global() {
        let preferences = OpenInTargetPreferences {
            global: Some("vscode".to_string()),
            per_path: Some(BTreeMap::from([(
                "D:/repo".to_string(),
                "cursor".to_string(),
            )])),
        };
        let available = vec!["vscode".to_string(), "cursor".to_string()];

        assert_eq!(
            resolve_preferred_target(&preferences, Some("D:/repo"), &available),
            Some("cursor".to_string())
        );
    }

    #[test]
    fn resolve_preferred_target_falls_back_to_first_available() {
        let preferences = OpenInTargetPreferences {
            global: Some("cursor".to_string()),
            per_path: None,
        };
        let available = vec!["systemDefault".to_string(), "fileManager".to_string()];

        assert_eq!(
            resolve_preferred_target(&preferences, None, &available),
            Some("systemDefault".to_string())
        );
    }

    #[test]
    fn choose_effective_target_prefers_file_manager_for_directories() {
        let directory = temp_dir("open-target-directory");
        let available = vec![
            "vscode".to_string(),
            "systemDefault".to_string(),
            "fileManager".to_string(),
        ];

        assert_eq!(
            choose_effective_target(None, Some("vscode"), &directory, &available),
            Some("fileManager".to_string())
        );

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn choose_effective_target_prefers_system_default_for_previewable_files() {
        let directory = temp_dir("open-target-preview");
        let file_path = directory.join("preview.pdf");
        fs::write(&file_path, "pdf").expect("preview file should be created");
        let available = vec![
            "vscode".to_string(),
            "systemDefault".to_string(),
            "fileManager".to_string(),
        ];

        assert_eq!(
            choose_effective_target(None, Some("vscode"), &file_path, &available),
            Some("systemDefault".to_string())
        );

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn choose_effective_target_respects_supported_explicit_target() {
        let directory = temp_dir("open-target-explicit");
        let file_path = directory.join("main.rs");
        fs::write(&file_path, "fn main() {}").expect("source file should be created");
        let available = vec![
            "vscode".to_string(),
            "systemDefault".to_string(),
            "fileManager".to_string(),
        ];

        assert_eq!(
            choose_effective_target(
                Some("vscode"),
                Some("systemDefault"),
                &file_path,
                &available
            ),
            Some("vscode".to_string())
        );

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn platform_default_viewer_file_matches_upstream_extensions() {
        let directory = temp_dir("open-target-extensions");
        let html_path = directory.join("index.html");
        let text_path = directory.join("notes.txt");
        fs::write(&html_path, "<html></html>").expect("html file should be created");
        fs::write(&text_path, "notes").expect("text file should be created");

        assert_eq!(is_platform_default_viewer_file(&html_path), true);
        assert_eq!(is_platform_default_viewer_file(&text_path), false);

        let _ = fs::remove_dir_all(directory);
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
