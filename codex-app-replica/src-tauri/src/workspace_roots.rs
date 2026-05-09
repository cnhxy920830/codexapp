use crate::global_settings::read_global_settings;
use crate::global_settings::write_global_settings;

use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Window};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const LOCAL_HOST_ID: &str = "local";
const DEFAULT_PROJECT_NAME: &str = "New project";
const CONVERSATION_DETAIL_MODE_KEY: &str = "conversationDetailMode";
const STEPS_PROSE_MODE: &str = "STEPS_PROSE";
const ACTIVE_WORKSPACE_ROOTS_KEY: &str = "active-workspace-roots";
const WORKSPACE_ROOT_OPTIONS_KEY: &str = "electron-saved-workspace-roots";
const WORKSPACE_ROOT_LABELS_KEY: &str = "electron-workspace-root-labels";
const PROJECT_ORDER_KEY: &str = "project-order";
const WORKSPACE_ROOT_OPTION_PICKED_EVENT: &str = "workspace-root-option-picked";
const WORKSPACE_ROOT_OPTION_ADDED_EVENT: &str = "workspace-root-option-added";
const WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT: &str = "workspace-root-options-updated";
const ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT: &str = "active-workspace-roots-updated";
const ONBOARDING_SKIP_WORKSPACE_RESULT_EVENT: &str = "electron-onboarding-skip-workspace-result";
const NAVIGATE_TO_ROUTE_EVENT: &str = "navigate-to-route";
const UNIQUE_WORKSPACE_SUFFIX_START: u32 = 2;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(target_os = "windows")]
const PICK_FOLDER_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select a project'; $dialog.ShowNewFolderButton = $true; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }"#;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRootOptionsResponse {
    pub roots: Vec<String>,
    pub labels: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActiveWorkspaceRootsResponse {
    pub roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRootOptionPickedNotification {
    root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRootOptionAddedNotification {
    root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct OnboardingSkipWorkspaceResultNotification {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NavigateToRouteNotification {
    path: &'static str,
    state: NavigateToRouteState,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NavigateToRouteState {
    focus_composer_nonce: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct UpdateWorkspaceRootOptionsOutcome {
    active_roots_changed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SetActiveWorkspaceRootOutcome {
    state_changed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct AddWorkspaceRootOptionOutcome {
    options_changed: bool,
}

#[tauri::command(rename = "workspace-root-options")]
pub fn workspace_root_options(
    app: AppHandle,
    host_id: Option<String>,
) -> Result<WorkspaceRootOptionsResponse, String> {
    ensure_supported_host_id(host_id.as_deref(), "workspace-root-options")?;
    let settings = read_global_settings(&app)?;
    Ok(WorkspaceRootOptionsResponse {
        roots: read_workspace_root_options(&settings),
        labels: read_workspace_root_labels(&settings),
    })
}

#[tauri::command(rename = "active-workspace-roots")]
pub fn active_workspace_roots(
    app: AppHandle,
    host_id: Option<String>,
) -> Result<ActiveWorkspaceRootsResponse, String> {
    ensure_supported_host_id(host_id.as_deref(), "active-workspace-roots")?;
    let settings = read_global_settings(&app)?;
    Ok(ActiveWorkspaceRootsResponse {
        roots: read_active_workspace_roots(&settings),
    })
}

#[tauri::command(rename = "electron-pick-workspace-root-option")]
pub fn pick_workspace_root_option(window: Window) -> Result<(), String> {
    let Some(root) = pick_folder_path()? else {
        return Ok(());
    };

    window
        .emit(
            WORKSPACE_ROOT_OPTION_PICKED_EVENT,
            WorkspaceRootOptionPickedNotification { root },
        )
        .map_err(|err| format!("failed to emit {WORKSPACE_ROOT_OPTION_PICKED_EVENT}: {err}"))
}

#[tauri::command(rename = "electron-add-new-workspace-root-option")]
pub fn add_new_workspace_root_option(
    window: Window,
    app: AppHandle,
    root: Option<String>,
) -> Result<(), String> {
    let root = match root.as_deref().and_then(normalize_optional_root) {
        Some(root) => {
            if Path::new(&root).is_dir() {
                root
            } else {
                return Ok(());
            }
        }
        None => {
            let Some(root) = pick_folder_path()? else {
                return Ok(());
            };
            root
        }
    };

    let mut settings = read_global_settings(&app)?;
    let outcome = apply_add_workspace_root_option(&mut settings, &root)?;
    write_global_settings(&app, &settings)?;

    if outcome.options_changed {
        emit_no_payload_event(&window, WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT)?;
    }
    emit_no_payload_event(&window, ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT)?;
    window
        .emit(
            WORKSPACE_ROOT_OPTION_ADDED_EVENT,
            WorkspaceRootOptionAddedNotification { root },
        )
        .map_err(|err| format!("failed to emit {WORKSPACE_ROOT_OPTION_ADDED_EVENT}: {err}"))?;
    emit_navigate_to_route(&window)
}

#[tauri::command(rename = "electron-update-workspace-root-options")]
pub fn update_workspace_root_options(
    window: Window,
    app: AppHandle,
    roots: Vec<String>,
) -> Result<(), String> {
    let mut settings = read_global_settings(&app)?;
    let outcome = apply_workspace_root_options_update(&mut settings, roots);
    write_global_settings(&app, &settings)?;
    if outcome.active_roots_changed {
        emit_no_payload_event(&window, ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT)?;
    }
    emit_no_payload_event(&window, WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT)
}

#[tauri::command(rename = "electron-set-active-workspace-root")]
pub fn set_active_workspace_root(
    window: Window,
    app: AppHandle,
    root: String,
) -> Result<(), String> {
    let mut settings = read_global_settings(&app)?;
    let outcome = apply_set_active_workspace_root(&mut settings, &root)?;
    if !outcome.state_changed {
        return Ok(());
    }

    write_global_settings(&app, &settings)?;
    emit_no_payload_event(&window, ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT)
}

#[tauri::command(rename = "electron-clear-active-workspace-root")]
pub fn clear_active_workspace_root(window: Window, app: AppHandle) -> Result<(), String> {
    let mut settings = read_global_settings(&app)?;
    if !apply_clear_active_workspace_root(&mut settings) {
        return Ok(());
    }

    write_global_settings(&app, &settings)?;
    emit_no_payload_event(&window, ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT)
}

#[tauri::command(rename = "electron-onboarding-skip-workspace")]
pub fn onboarding_skip_workspace(
    window: Window,
    app: AppHandle,
    project_name: Option<String>,
) -> Result<(), String> {
    let mut created_root = None;
    let result = (|| -> Result<(), String> {
        let mut settings = read_global_settings(&app)?;
        let requested_name = project_name.as_deref().unwrap_or(DEFAULT_PROJECT_NAME);
        let root = create_default_workspace_root(&app, &mut settings, requested_name)?;
        created_root = Some(root.clone());
        apply_onboarding_workspace(&mut settings, &root)?;
        write_global_settings(&app, &settings)?;
        emit_no_payload_event(&window, WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT)?;
        emit_no_payload_event(&window, ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT)?;
        emit_onboarding_skip_result(&window, true, Some(root), None)?;
        emit_navigate_to_route(&window)
    })();

    match result {
        Ok(()) => Ok(()),
        Err(err) => {
            emit_onboarding_skip_result(&window, false, created_root, Some(err))?;
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
fn pick_folder_path() -> Result<Option<String>, String> {
    let mut command = Command::new("powershell.exe");
    command
        .creation_flags(CREATE_NO_WINDOW)
        .args(["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-Command"])
        .arg(PICK_FOLDER_SCRIPT);

    let output = command
        .output()
        .map_err(|err| format!("failed to launch folder picker: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err(format!(
                "folder picker exited with status {}",
                output.status
            ));
        }
        return Err(format!("folder picker failed: {stderr}"));
    }

    Ok(normalize_optional_root(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

#[cfg(not(target_os = "windows"))]
fn pick_folder_path() -> Result<Option<String>, String> {
    Err("electron-pick-workspace-root-option is only supported on Windows".to_string())
}

fn apply_workspace_root_options_update(
    settings: &mut Map<String, Value>,
    requested_roots: Vec<String>,
) -> UpdateWorkspaceRootOptionsOutcome {
    let next_roots = normalize_workspace_roots(requested_roots);
    write_string_array(settings, WORKSPACE_ROOT_OPTIONS_KEY, &next_roots);

    let current_labels = read_workspace_root_labels(settings);
    if current_labels.is_empty() {
        settings.remove(WORKSPACE_ROOT_LABELS_KEY);
    } else {
        let retained_roots = next_roots.iter().cloned().collect::<HashSet<_>>();
        let pruned_labels = current_labels
            .into_iter()
            .filter(|(root, _)| retained_roots.contains(root))
            .collect::<BTreeMap<_, _>>();
        write_workspace_root_labels(settings, &pruned_labels, true);
    }

    let current_active_raw = read_string_array_raw(settings, ACTIVE_WORKSPACE_ROOTS_KEY);
    let current_active = normalize_workspace_roots(current_active_raw.clone());
    let mut next_active = current_active
        .into_iter()
        .filter(|root| next_roots.contains(root))
        .collect::<Vec<_>>();
    if next_active.is_empty() && !next_roots.is_empty() {
        next_active.push(next_roots[0].clone());
    }

    let active_roots_changed = current_active_raw != next_active;
    if active_roots_changed {
        write_string_array(settings, ACTIVE_WORKSPACE_ROOTS_KEY, &next_active);
    }

    UpdateWorkspaceRootOptionsOutcome {
        active_roots_changed,
    }
}

fn apply_set_active_workspace_root(
    settings: &mut Map<String, Value>,
    requested_root: &str,
) -> Result<SetActiveWorkspaceRootOutcome, String> {
    let root = normalize_required_root(requested_root, "root")?;
    let current_active_raw = read_string_array_raw(settings, ACTIVE_WORKSPACE_ROOTS_KEY);
    let current_options_raw = read_string_array_raw(settings, WORKSPACE_ROOT_OPTIONS_KEY);
    let current_options = normalize_workspace_roots(current_options_raw.clone());
    let current_labels = read_workspace_root_labels(settings);

    let next_active = vec![root.clone()];
    let next_options = if current_options.contains(&root) {
        current_options
    } else {
        let mut options = vec![root.clone()];
        options.extend(current_options);
        options
    };

    let active_changed = current_active_raw != next_active;
    let options_changed = current_options_raw != next_options;
    let labels_changed =
        !raw_labels_equal_normalized(settings.get(WORKSPACE_ROOT_LABELS_KEY), &current_labels);
    let state_changed = active_changed || options_changed || labels_changed;

    if !state_changed {
        return Ok(SetActiveWorkspaceRootOutcome { state_changed });
    }

    if active_changed {
        write_string_array(settings, ACTIVE_WORKSPACE_ROOTS_KEY, &next_active);
    }
    if options_changed {
        write_string_array(settings, WORKSPACE_ROOT_OPTIONS_KEY, &next_options);
    }
    if labels_changed {
        write_workspace_root_labels(settings, &current_labels, true);
    }

    Ok(SetActiveWorkspaceRootOutcome { state_changed })
}

fn apply_clear_active_workspace_root(settings: &mut Map<String, Value>) -> bool {
    let current_active = read_string_array_raw(settings, ACTIVE_WORKSPACE_ROOTS_KEY);
    if current_active.is_empty() {
        return false;
    }

    write_string_array(settings, ACTIVE_WORKSPACE_ROOTS_KEY, &[]);
    true
}

fn apply_add_workspace_root_option(
    settings: &mut Map<String, Value>,
    requested_root: &str,
) -> Result<AddWorkspaceRootOptionOutcome, String> {
    let root = normalize_required_root(requested_root, "root")?;
    let current_options = read_workspace_root_options(settings);
    let options_changed = !current_options.contains(&root);
    if options_changed {
        let mut next_options = vec![root.clone()];
        next_options.extend(current_options);
        write_string_array(settings, WORKSPACE_ROOT_OPTIONS_KEY, &next_options);
        update_project_order(settings, &root);
    }

    write_string_array(settings, ACTIVE_WORKSPACE_ROOTS_KEY, &[root]);

    Ok(AddWorkspaceRootOptionOutcome { options_changed })
}

fn apply_onboarding_workspace(
    settings: &mut Map<String, Value>,
    requested_root: &str,
) -> Result<(), String> {
    let root = normalize_required_root(requested_root, "root")?;
    let mut next_roots = vec![root.clone()];
    next_roots.extend(read_string_array_raw(settings, WORKSPACE_ROOT_OPTIONS_KEY));
    let next_roots = normalize_workspace_roots(next_roots);
    write_string_array(settings, WORKSPACE_ROOT_OPTIONS_KEY, &next_roots);
    update_project_order(settings, &root);
    let normalized_labels = read_workspace_root_labels(settings);
    write_workspace_root_labels(settings, &normalized_labels, true);
    write_string_array(settings, ACTIVE_WORKSPACE_ROOTS_KEY, &[root]);
    Ok(())
}

fn create_default_workspace_root(
    app: &AppHandle,
    settings: &mut Map<String, Value>,
    requested_name: &str,
) -> Result<String, String> {
    let project_name = sanitize_default_project_name(requested_name);
    let documents_dir = app
        .path()
        .document_dir()
        .map_err(|err| format!("failed to resolve documents directory: {err}"))?;
    let root = find_available_default_workspace_root(&documents_dir, &project_name)?;
    fs::create_dir_all(&root)
        .map_err(|err| format!("failed to create workspace root {}: {err}", root.display()))?;

    if read_string_value(settings, CONVERSATION_DETAIL_MODE_KEY).as_deref()
        != Some(STEPS_PROSE_MODE)
    {
        initialize_default_workspace(&root);
    }

    let root_string = root.display().to_string();
    let existing_labels = read_workspace_root_labels(settings);
    let existing_roots = read_workspace_root_options(settings);
    let label_already_used = existing_roots.iter().any(|existing_root| {
        effective_workspace_root_label(existing_root, &existing_labels).trim() == project_name
    });
    if workspace_root_basename(&root_string) != project_name && !label_already_used {
        let mut labels = existing_labels;
        labels.insert(root_string.clone(), project_name);
        write_workspace_root_labels(settings, &labels, true);
    }

    Ok(root_string)
}

fn find_available_default_workspace_root(
    documents_dir: &Path,
    project_name: &str,
) -> Result<PathBuf, String> {
    let mut suffix = None;
    loop {
        let candidate = documents_dir.join(match suffix {
            None => project_name.to_string(),
            Some(number) => format!("{project_name} {number}"),
        });
        if !candidate.exists() {
            return Ok(candidate);
        }
        suffix = Some(suffix.map_or(UNIQUE_WORKSPACE_SUFFIX_START, |value| value + 1));
    }
}

fn initialize_default_workspace(root: &Path) {
    let mut command = Command::new("git");
    command.arg("init").current_dir(root);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let _ = command.output();
}

fn emit_onboarding_skip_result(
    window: &Window,
    success: bool,
    root: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    window
        .emit(
            ONBOARDING_SKIP_WORKSPACE_RESULT_EVENT,
            OnboardingSkipWorkspaceResultNotification {
                success,
                root,
                error,
            },
        )
        .map_err(|err| format!("failed to emit {ONBOARDING_SKIP_WORKSPACE_RESULT_EVENT}: {err}"))
}

fn emit_navigate_to_route(window: &Window) -> Result<(), String> {
    let focus_composer_nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("system time error: {err}"))?
        .as_millis() as u64;
    window
        .emit(
            NAVIGATE_TO_ROUTE_EVENT,
            NavigateToRouteNotification {
                path: "/",
                state: NavigateToRouteState {
                    focus_composer_nonce,
                },
            },
        )
        .map_err(|err| format!("failed to emit {NAVIGATE_TO_ROUTE_EVENT}: {err}"))
}

fn emit_no_payload_event(window: &Window, event_name: &str) -> Result<(), String> {
    window
        .emit(event_name, ())
        .map_err(|err| format!("failed to emit {event_name}: {err}"))
}

fn read_workspace_root_options(settings: &Map<String, Value>) -> Vec<String> {
    normalize_workspace_roots(read_string_array_raw(settings, WORKSPACE_ROOT_OPTIONS_KEY))
}

fn read_active_workspace_roots(settings: &Map<String, Value>) -> Vec<String> {
    normalize_workspace_roots(read_string_array_raw(settings, ACTIVE_WORKSPACE_ROOTS_KEY))
}

fn read_workspace_root_labels(settings: &Map<String, Value>) -> BTreeMap<String, String> {
    normalize_workspace_root_labels(settings.get(WORKSPACE_ROOT_LABELS_KEY))
}

fn read_string_array_raw(settings: &Map<String, Value>, key: &str) -> Vec<String> {
    match settings.get(key) {
        Some(Value::Array(entries)) => entries
            .iter()
            .filter_map(|entry| match entry {
                Value::String(value) => Some(value.clone()),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn read_string_value(settings: &Map<String, Value>, key: &str) -> Option<String> {
    settings.get(key).and_then(|value| match value {
        Value::String(text) => Some(text.clone()),
        _ => None,
    })
}

fn normalize_workspace_roots<I>(roots: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for root in roots {
        let Some(root) = normalize_optional_root(&root) else {
            continue;
        };
        if seen.insert(root.clone()) {
            normalized.push(root);
        }
    }
    normalized
}

fn normalize_workspace_root_labels(value: Option<&Value>) -> BTreeMap<String, String> {
    let Some(Value::Object(raw_labels)) = value else {
        return BTreeMap::new();
    };

    let mut normalized = BTreeMap::new();
    for (root, label) in raw_labels {
        let Value::String(label) = label else {
            continue;
        };
        let Some(root) = normalize_optional_root(root) else {
            continue;
        };
        normalized.entry(root).or_insert_with(|| label.clone());
    }
    normalized
}

fn raw_labels_equal_normalized(
    value: Option<&Value>,
    normalized: &BTreeMap<String, String>,
) -> bool {
    let Some(Value::Object(raw_labels)) = value else {
        return false;
    };
    if raw_labels.len() != normalized.len() {
        return false;
    }

    raw_labels.iter().all(|(root, label)| match label {
        Value::String(label) => normalized.get(root) == Some(label),
        _ => false,
    })
}

fn write_string_array(settings: &mut Map<String, Value>, key: &str, values: &[String]) {
    settings.insert(
        key.to_string(),
        Value::Array(values.iter().cloned().map(Value::String).collect()),
    );
}

fn write_workspace_root_labels(
    settings: &mut Map<String, Value>,
    labels: &BTreeMap<String, String>,
    always_store_empty: bool,
) {
    if labels.is_empty() && !always_store_empty {
        settings.remove(WORKSPACE_ROOT_LABELS_KEY);
        return;
    }

    let mut serialized = Map::new();
    for (root, label) in labels {
        serialized.insert(root.clone(), Value::String(label.clone()));
    }
    settings.insert(
        WORKSPACE_ROOT_LABELS_KEY.to_string(),
        Value::Object(serialized),
    );
}

fn update_project_order(settings: &mut Map<String, Value>, root: &str) {
    let mut next_order = vec![root.to_string()];
    next_order.extend(
        read_string_array_raw(settings, PROJECT_ORDER_KEY)
            .into_iter()
            .filter(|existing_root| existing_root != root),
    );
    write_string_array(settings, PROJECT_ORDER_KEY, &next_order);
}

fn normalize_optional_root(root: &str) -> Option<String> {
    let trimmed = root.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_required_root(root: &str, parameter_name: &str) -> Result<String, String> {
    normalize_optional_root(root).ok_or_else(|| format!("{parameter_name} is empty"))
}

fn sanitize_default_project_name(project_name: &str) -> String {
    let base_name = trimmed_path_basename(project_name)
        .filter(|name| *name != "." && *name != "..")
        .unwrap_or(DEFAULT_PROJECT_NAME);
    if base_name.is_empty() {
        DEFAULT_PROJECT_NAME.to_string()
    } else {
        base_name.to_string()
    }
}

fn effective_workspace_root_label(root: &str, labels: &BTreeMap<String, String>) -> String {
    labels
        .get(root)
        .map(|label| label.trim().to_string())
        .filter(|label| !label.is_empty())
        .unwrap_or_else(|| workspace_root_basename(root))
}

fn workspace_root_basename(root: &str) -> String {
    trimmed_path_basename(root).unwrap_or(root).to_string()
}

fn trimmed_path_basename(path: &str) -> Option<&str> {
    let trimmed = path.trim().trim_end_matches(['\\', '/']);
    if trimmed.is_empty() {
        return None;
    }

    Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .or(Some(trimmed))
        .map(str::trim)
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
    use super::apply_add_workspace_root_option;
    use super::apply_onboarding_workspace;
    use super::apply_set_active_workspace_root;
    use super::apply_workspace_root_options_update;
    use super::normalize_optional_root;
    use super::sanitize_default_project_name;
    use super::workspace_root_basename;
    use super::ActiveWorkspaceRootsResponse;
    use super::AddWorkspaceRootOptionOutcome;
    use super::OnboardingSkipWorkspaceResultNotification;
    use super::SetActiveWorkspaceRootOutcome;
    use super::UpdateWorkspaceRootOptionsOutcome;
    use super::WorkspaceRootOptionAddedNotification;
    use super::WorkspaceRootOptionPickedNotification;
    use super::WorkspaceRootOptionsResponse;
    use super::ACTIVE_WORKSPACE_ROOTS_KEY;
    use super::CONVERSATION_DETAIL_MODE_KEY;
    use super::PROJECT_ORDER_KEY;
    use super::STEPS_PROSE_MODE;
    use super::WORKSPACE_ROOT_LABELS_KEY;
    use super::WORKSPACE_ROOT_OPTIONS_KEY;
    use serde_json::{json, Map, Value};
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn normalize_selected_root_rejects_empty_selection() {
        assert_eq!(normalize_optional_root("   \r\n"), None);
    }

    #[test]
    fn normalize_selected_root_trims_selected_path() {
        assert_eq!(
            normalize_optional_root("  C:\\Users\\Administrator\\Projects\\demo  \r\n"),
            Some("C:\\Users\\Administrator\\Projects\\demo".to_string())
        );
    }

    #[test]
    fn picked_notification_serializes_expected_shape() {
        let value = serde_json::to_value(WorkspaceRootOptionPickedNotification {
            root: "C:\\workspace".to_string(),
        })
        .expect("notification should serialize");

        assert_eq!(value, json!({ "root": "C:\\workspace" }));
    }

    #[test]
    fn added_notification_serializes_expected_shape() {
        let value = serde_json::to_value(WorkspaceRootOptionAddedNotification {
            root: "C:\\workspace".to_string(),
        })
        .expect("notification should serialize");

        assert_eq!(value, json!({ "root": "C:\\workspace" }));
    }

    #[test]
    fn workspace_root_options_response_serializes_expected_shape() {
        let value = serde_json::to_value(WorkspaceRootOptionsResponse {
            roots: vec!["C:\\workspace".to_string()],
            labels: BTreeMap::from([("C:\\workspace".to_string(), "Demo".to_string())]),
        })
        .expect("response should serialize");

        assert_eq!(
            value,
            json!({
                "roots": ["C:\\workspace"],
                "labels": { "C:\\workspace": "Demo" }
            })
        );
    }

    #[test]
    fn active_workspace_roots_response_serializes_expected_shape() {
        let value = serde_json::to_value(ActiveWorkspaceRootsResponse {
            roots: vec!["C:\\workspace".to_string()],
        })
        .expect("response should serialize");

        assert_eq!(value, json!({ "roots": ["C:\\workspace"] }));
    }

    #[test]
    fn skip_result_serializes_optional_fields_like_upstream() {
        let value = serde_json::to_value(OnboardingSkipWorkspaceResultNotification {
            success: false,
            root: None,
            error: Some("boom".to_string()),
        })
        .expect("notification should serialize");

        assert_eq!(value, json!({ "success": false, "error": "boom" }));
    }

    #[test]
    fn workspace_root_options_update_prunes_labels_and_reselects_first_root() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\one", "C:\\two"]),
        );
        settings.insert(ACTIVE_WORKSPACE_ROOTS_KEY.to_string(), json!(["C:\\two"]));
        settings.insert(
            WORKSPACE_ROOT_LABELS_KEY.to_string(),
            json!({
                "C:\\one": "One",
                "C:\\two": "Two",
                "C:\\stale": "Stale"
            }),
        );

        let outcome = apply_workspace_root_options_update(
            &mut settings,
            vec!["  C:\\one  ".to_string(), "C:\\one".to_string()],
        );

        assert_eq!(
            outcome,
            UpdateWorkspaceRootOptionsOutcome {
                active_roots_changed: true,
            }
        );
        assert_eq!(
            settings.get(WORKSPACE_ROOT_OPTIONS_KEY),
            Some(&json!(["C:\\one"]))
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\one"]))
        );
        assert_eq!(
            settings.get(WORKSPACE_ROOT_LABELS_KEY),
            Some(&json!({ "C:\\one": "One" }))
        );
    }

    #[test]
    fn workspace_root_options_update_removes_missing_label_store_when_empty() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\existing"]),
        );

        let outcome =
            apply_workspace_root_options_update(&mut settings, vec!["C:\\existing".to_string()]);

        assert_eq!(
            outcome,
            UpdateWorkspaceRootOptionsOutcome {
                active_roots_changed: true,
            }
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\existing"]))
        );
        assert!(!settings.contains_key(WORKSPACE_ROOT_LABELS_KEY));
    }

    #[test]
    fn add_workspace_root_option_prepends_root_updates_project_order_and_sets_active() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\existing"]),
        );
        settings.insert(
            PROJECT_ORDER_KEY.to_string(),
            json!(["C:\\old", "C:\\existing"]),
        );

        let outcome = apply_add_workspace_root_option(&mut settings, "C:\\new")
            .expect("add workspace root option should succeed");

        assert_eq!(
            outcome,
            AddWorkspaceRootOptionOutcome {
                options_changed: true,
            }
        );
        assert_eq!(
            settings.get(WORKSPACE_ROOT_OPTIONS_KEY),
            Some(&json!(["C:\\new", "C:\\existing"]))
        );
        assert_eq!(
            settings.get(PROJECT_ORDER_KEY),
            Some(&json!(["C:\\new", "C:\\old", "C:\\existing"]))
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\new"]))
        );
    }

    #[test]
    fn add_workspace_root_option_existing_root_sets_active_without_duplication() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\existing", "C:\\other"]),
        );
        settings.insert(
            PROJECT_ORDER_KEY.to_string(),
            json!(["C:\\old", "C:\\existing", "C:\\other"]),
        );
        settings.insert(ACTIVE_WORKSPACE_ROOTS_KEY.to_string(), json!(["C:\\other"]));

        let outcome = apply_add_workspace_root_option(&mut settings, "C:\\existing")
            .expect("add workspace root option should succeed");

        assert_eq!(
            outcome,
            AddWorkspaceRootOptionOutcome {
                options_changed: false,
            }
        );
        assert_eq!(
            settings.get(WORKSPACE_ROOT_OPTIONS_KEY),
            Some(&json!(["C:\\existing", "C:\\other"]))
        );
        assert_eq!(
            settings.get(PROJECT_ORDER_KEY),
            Some(&json!(["C:\\old", "C:\\existing", "C:\\other"]))
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\existing"]))
        );
    }

    #[test]
    fn set_active_workspace_root_injects_missing_root_and_normalizes_labels() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\existing"]),
        );

        let outcome = apply_set_active_workspace_root(&mut settings, "C:\\new")
            .expect("set active workspace root should succeed");

        assert_eq!(
            outcome,
            SetActiveWorkspaceRootOutcome {
                state_changed: true
            }
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\new"]))
        );
        assert_eq!(
            settings.get(WORKSPACE_ROOT_OPTIONS_KEY),
            Some(&json!(["C:\\new", "C:\\existing"]))
        );
        assert_eq!(settings.get(WORKSPACE_ROOT_LABELS_KEY), Some(&json!({})));
    }

    #[test]
    fn apply_onboarding_workspace_updates_roots_active_and_project_order() {
        let mut settings = Map::new();
        settings.insert(
            WORKSPACE_ROOT_OPTIONS_KEY.to_string(),
            json!(["C:\\existing"]),
        );
        settings.insert(
            PROJECT_ORDER_KEY.to_string(),
            json!(["C:\\old", "C:\\existing"]),
        );

        apply_onboarding_workspace(&mut settings, "C:\\new")
            .expect("onboarding workspace should apply");

        assert_eq!(
            settings.get(WORKSPACE_ROOT_OPTIONS_KEY),
            Some(&json!(["C:\\new", "C:\\existing"]))
        );
        assert_eq!(
            settings.get(ACTIVE_WORKSPACE_ROOTS_KEY),
            Some(&json!(["C:\\new"]))
        );
        assert_eq!(
            settings.get(PROJECT_ORDER_KEY),
            Some(&json!(["C:\\new", "C:\\old", "C:\\existing"]))
        );
        assert_eq!(settings.get(WORKSPACE_ROOT_LABELS_KEY), Some(&json!({})));
    }

    #[test]
    fn sanitize_default_project_name_uses_basename_and_default_fallback() {
        assert_eq!(
            sanitize_default_project_name("  "),
            "New project".to_string()
        );
        assert_eq!(
            sanitize_default_project_name("C:\\Users\\Administrator\\Demo"),
            "Demo".to_string()
        );
        assert_eq!(
            sanitize_default_project_name("."),
            "New project".to_string()
        );
        assert_eq!(
            sanitize_default_project_name(".."),
            "New project".to_string()
        );
    }

    #[test]
    fn workspace_root_basename_trims_trailing_separators() {
        assert_eq!(
            workspace_root_basename("C:\\Users\\Administrator\\Demo\\"),
            "Demo".to_string()
        );
    }

    #[test]
    fn default_workspace_names_use_space_number_suffixes() {
        let root = temp_dir("workspace-roots");
        fs::create_dir_all(root.join("New project")).expect("first root should exist");
        fs::create_dir_all(root.join("New project 2")).expect("second root should exist");

        let available = super::find_available_default_workspace_root(&root, "New project")
            .expect("available root should resolve");

        assert_eq!(available, root.join("New project 3"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn update_allows_steps_prose_to_skip_git_init_flag_without_changing_state_shape() {
        let mut settings = Map::new();
        settings.insert(
            CONVERSATION_DETAIL_MODE_KEY.to_string(),
            Value::String(STEPS_PROSE_MODE.to_string()),
        );
        apply_onboarding_workspace(&mut settings, "C:\\playground")
            .expect("workspace should still apply");

        assert_eq!(
            settings.get(CONVERSATION_DETAIL_MODE_KEY),
            Some(&Value::String(STEPS_PROSE_MODE.to_string()))
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
