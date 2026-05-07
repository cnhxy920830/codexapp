use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;

const COMPUTER_USE_APPROVALS_FILE: &str = "ComputerUseAppApprovals.json";
const COMPUTER_USE_GROUP_CONTAINER: &str = "2DC432GLL2.com.openai.sky.CUAService";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseVisibilityState {
    pub has_approval_store: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovedApp {
    pub bundle_identifier: String,
    pub display_name: String,
    #[serde(rename = "iconDataURL")]
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovalsState {
    pub approved_apps: Vec<ComputerUseApprovedApp>,
    pub approved_bundle_identifiers: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovalRemoveParams {
    pub bundle_identifier: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ComputerUseApprovalStoreFile {
    #[serde(default)]
    approved_bundle_identifiers: Vec<String>,
}

#[tauri::command]
pub fn read_computer_use_approvals_visibility() -> Result<ComputerUseVisibilityState, String> {
    Ok(ComputerUseVisibilityState {
        has_approval_store: computer_use_approval_store_path()?.exists(),
    })
}

#[tauri::command]
pub fn read_computer_use_approvals() -> Result<Option<ComputerUseApprovalsState>, String> {
    let Some(bundle_identifiers) = read_computer_use_approval_store()? else {
        return Ok(None);
    };

    Ok(Some(computer_use_approvals_state(bundle_identifiers)))
}

#[tauri::command]
pub fn remove_computer_use_approval(
    params: ComputerUseApprovalRemoveParams,
) -> Result<Option<ComputerUseApprovalsState>, String> {
    let Some(bundle_identifiers) = read_computer_use_approval_store()? else {
        return Ok(None);
    };

    let target_bundle_identifier = params.bundle_identifier.trim();
    let next_bundle_identifiers = bundle_identifiers
        .iter()
        .filter(|bundle_identifier| bundle_identifier.as_str() != target_bundle_identifier)
        .cloned()
        .collect::<Vec<_>>();

    if next_bundle_identifiers != bundle_identifiers {
        write_computer_use_approval_store(&next_bundle_identifiers)?;
    }

    Ok(Some(computer_use_approvals_state(next_bundle_identifiers)))
}

fn read_computer_use_approval_store() -> Result<Option<Vec<String>>, String> {
    let approvals_path = computer_use_approval_store_path()?;
    if !approvals_path.exists() {
        return Ok(None);
    }

    let parsed_file = match fs::read_to_string(&approvals_path) {
        Ok(contents) => {
            serde_json::from_str::<ComputerUseApprovalStoreFile>(&contents).unwrap_or_default()
        }
        Err(_) => ComputerUseApprovalStoreFile::default(),
    };

    Ok(Some(normalized_bundle_identifiers(
        &parsed_file.approved_bundle_identifiers,
    )))
}

fn write_computer_use_approval_store(bundle_identifiers: &[String]) -> Result<(), String> {
    let approvals_path = computer_use_approval_store_path()?;
    let parent = approvals_path
        .parent()
        .ok_or_else(|| "computer use approval store path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create computer use approval store directory: {err}"))?;

    let contents = serde_json::to_string_pretty(&ComputerUseApprovalStoreFile {
        approved_bundle_identifiers: bundle_identifiers.to_vec(),
    })
    .map_err(|err| format!("failed to serialize computer use approvals: {err}"))?;
    let normalized_contents = if contents.ends_with('\n') {
        contents
    } else {
        format!("{contents}\n")
    };

    fs::write(&approvals_path, normalized_contents)
        .map_err(|err| format!("failed to write computer use approvals: {err}"))
}

fn computer_use_approvals_state(bundle_identifiers: Vec<String>) -> ComputerUseApprovalsState {
    let approved_apps = bundle_identifiers
        .iter()
        .map(|bundle_identifier| ComputerUseApprovedApp {
            bundle_identifier: bundle_identifier.clone(),
            display_name: bundle_identifier.clone(),
            icon_data_url: None,
        })
        .collect::<Vec<_>>();

    ComputerUseApprovalsState {
        approved_apps,
        approved_bundle_identifiers: bundle_identifiers,
    }
}

fn normalized_bundle_identifiers(bundle_identifiers: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();

    for bundle_identifier in bundle_identifiers {
        let trimmed_bundle_identifier = bundle_identifier.trim();
        if trimmed_bundle_identifier.is_empty()
            || normalized
                .iter()
                .any(|existing_identifier| existing_identifier == trimmed_bundle_identifier)
        {
            continue;
        }

        normalized.push(trimmed_bundle_identifier.to_string());
    }

    normalized
}

fn computer_use_approval_store_path() -> Result<PathBuf, String> {
    let home_dir =
        resolve_home_directory().ok_or_else(|| "failed to resolve home directory".to_string())?;

    Ok(home_dir
        .join("Library")
        .join("Group Containers")
        .join(COMPUTER_USE_GROUP_CONTAINER)
        .join("Library")
        .join("Application Support")
        .join("Software")
        .join(COMPUTER_USE_APPROVALS_FILE))
}

fn resolve_home_directory() -> Option<PathBuf> {
    non_empty_env_path("USERPROFILE")
        .or_else(home_directory_from_drive_and_path)
        .or_else(|| non_empty_env_path("HOME"))
}

fn home_directory_from_drive_and_path() -> Option<PathBuf> {
    let drive = env::var_os("HOMEDRIVE")?;
    let path = env::var_os("HOMEPATH")?;
    let mut home_dir = PathBuf::from(drive);
    home_dir.push(PathBuf::from(path));
    if home_dir.as_os_str().is_empty() {
        return None;
    }
    Some(home_dir)
}

fn non_empty_env_path(name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(env::var_os(name)?);
    if path.as_os_str().is_empty() {
        return None;
    }
    Some(path)
}

#[cfg(test)]
mod tests {
    use super::computer_use_approvals_state;
    use super::normalized_bundle_identifiers;

    #[test]
    fn normalized_bundle_identifiers_trims_and_deduplicates() {
        let bundle_identifiers = vec![
            " com.example.app ".to_string(),
            "com.example.app".to_string(),
            "".to_string(),
            "com.example.other".to_string(),
        ];

        assert_eq!(
            normalized_bundle_identifiers(&bundle_identifiers),
            vec![
                "com.example.app".to_string(),
                "com.example.other".to_string()
            ]
        );
    }

    #[test]
    fn computer_use_approvals_state_uses_bundle_identifier_fallbacks() {
        let state = computer_use_approvals_state(vec!["com.example.app".to_string()]);

        assert_eq!(
            state.approved_bundle_identifiers,
            vec!["com.example.app".to_string()]
        );
        assert_eq!(state.approved_apps.len(), 1);
        assert_eq!(state.approved_apps[0].bundle_identifier, "com.example.app");
        assert_eq!(state.approved_apps[0].display_name, "com.example.app");
        assert_eq!(state.approved_apps[0].icon_data_url, None);
    }
}
