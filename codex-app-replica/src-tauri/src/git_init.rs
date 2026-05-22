use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::AppHandle;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInitParams {
    pub cwd: String,
    pub host_id: Option<String>,
}

#[tauri::command(rename = "git-init-repo")]
pub async fn git_init_repo(params: GitInitParams) -> Result<(), String> {
    // For now, only support local host
    if let Some(host_id) = params.host_id.as_ref() {
        let trimmed = host_id.trim();
        if !trimmed.is_empty() && trimmed != "local" {
            return Err(format!(
                "git-init-repo does not support host id: {}",
                trimmed
            ));
        }
    }

    let mut command = Command::new("git");
    command.arg("init").current_dir(&params.cwd);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|err| format!("failed to execute git init: {}", err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git init failed: {}", stderr));
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationParams {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationValueResponse {
    pub value: Option<serde_json::Value>,
}

#[tauri::command(rename = "get-configuration")]
pub fn get_configuration(
    app: AppHandle,
    params: ConfigurationParams,
) -> Result<ConfigurationValueResponse, String> {
    use crate::global_settings::read_global_settings;

    let settings = read_global_settings(&app)?;
    let value = settings.get(&params.key).cloned();

    Ok(ConfigurationValueResponse { value })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_init_params_serializes_correctly() {
        let params = GitInitParams {
            cwd: "/path/to/repo".to_string(),
            host_id: Some("local".to_string()),
        };
        let json = serde_json::to_value(&params).unwrap();
        assert_eq!(json["cwd"], "/path/to/repo");
        assert_eq!(json["hostId"], "local");
    }

    #[test]
    fn configuration_value_response_serializes_correctly() {
        let response = ConfigurationValueResponse {
            value: Some(serde_json::json!("test")),
        };
        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["value"], "test");
    }
}
