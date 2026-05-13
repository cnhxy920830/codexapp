use crate::codex_home::resolve_codex_home;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use codex_client::build_reqwest_client_with_custom_ca;
use codex_client::with_chatgpt_cloudflare_cookie_store;
use codex_login::default_client::get_codex_user_agent;
use codex_login::AuthCredentialsStoreMode;
use codex_login::AuthManager;
use codex_login::CodexAuth;
use reqwest::header::HeaderMap;
use reqwest::header::HeaderName;
use reqwest::header::HeaderValue;
use reqwest::header::AUTHORIZATION;
use reqwest::header::CONTENT_TYPE;
use reqwest::header::USER_AGENT;
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskReadParams {
    pub task_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskTurnsReadParams {
    pub task_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskTurnReadParams {
    pub task_id: String,
    pub turn_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskTurnLogsReadParams {
    pub task_id: String,
    pub turn_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskPullRequestCreateParams {
    pub task_id: String,
    pub turn_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub add_codex_tag: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hide_pr_title_and_body: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub additional_labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
struct RemoteTaskPullRequestCreateRequestBody {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    add_codex_tag: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    hide_pr_title_and_body: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    additional_labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskImageReadParams {
    pub asset_pointer: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskReadResponse {
    pub task: RemoteTask,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_user_turn: Option<RemoteTaskTurn>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_assistant_turn: Option<RemoteTaskTurn>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_diff_task_turn: Option<RemoteTaskTurn>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnsReadResponse {
    #[serde(default)]
    pub turn_mapping: HashMap<String, RemoteTaskTurnMappingEntry>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnReadResponse {
    pub turn: RemoteTaskTurn,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnLogsReadResponse {
    #[serde(default)]
    pub logs: Vec<RemoteTaskTurnLogEntry>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskPullRequestCreateResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTaskImageReadResponse {
    pub contents_base64: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTask {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_unread_turn: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_status_display: Option<RemoteTaskStatusDisplay>,
    #[serde(default)]
    pub external_pull_requests: Vec<RemoteTaskExternalPullRequest>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskStatusDisplay {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_turn_status_display: Option<RemoteTaskLatestTurnStatusDisplay>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskLatestTurnStatusDisplay {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diff_stats: Option<RemoteTaskDiffStats>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskDiffStats {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines_added: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines_removed: Option<i64>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskExternalPullRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assistant_turn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pull_request: Option<RemoteTaskPullRequest>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskPullRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnMappingEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn: Option<RemoteTaskTurn>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurn {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_turn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attempt_placement: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_events: Option<RemoteTaskThreadEvents>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<RemoteTaskTurnError>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_items: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_items: Option<Vec<Value>>,
    #[serde(default)]
    pub sibling_turn_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pull_request_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pull_request_data: Option<RemoteTaskPullRequest>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<RemoteTaskEnvironment>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskEnvironment {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default)]
    pub repo_map: Vec<RemoteTaskRepoMapEntry>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskRepoMapEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub clone_url: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskThreadEvents {
    #[serde(default)]
    pub events: Vec<Value>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnError {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnLogEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<RemoteTaskTurnLogKey>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RemoteTaskTurnLogKey {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
struct RemoteTaskFileDownloadUrlResponse {
    status: String,
    #[serde(default)]
    download_url: Option<String>,
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}

#[tauri::command(rename = "remote-task-read")]
pub async fn remote_task_read(
    params: RemoteTaskReadParams,
) -> Result<RemoteTaskReadResponse, String> {
    RemoteTasksClient::load()
        .await?
        .get_json(&format!("/wham/tasks/{}", params.task_id))
        .await
}

#[tauri::command(rename = "remote-task-turns-read")]
pub async fn remote_task_turns_read(
    params: RemoteTaskTurnsReadParams,
) -> Result<RemoteTaskTurnsReadResponse, String> {
    RemoteTasksClient::load()
        .await?
        .get_json(&format!("/wham/tasks/{}/turns", params.task_id))
        .await
}

#[tauri::command(rename = "remote-task-turn-read")]
pub async fn remote_task_turn_read(
    params: RemoteTaskTurnReadParams,
) -> Result<RemoteTaskTurnReadResponse, String> {
    RemoteTasksClient::load()
        .await?
        .get_json(&format!(
            "/wham/tasks/{}/turns/{}",
            params.task_id, params.turn_id
        ))
        .await
}

#[tauri::command(rename = "remote-task-turn-logs-read")]
pub async fn remote_task_turn_logs_read(
    params: RemoteTaskTurnLogsReadParams,
) -> Result<RemoteTaskTurnLogsReadResponse, String> {
    RemoteTasksClient::load()
        .await?
        .get_json(&format!(
            "/wham/tasks/{}/turns/{}/logs",
            params.task_id, params.turn_id
        ))
        .await
}

#[tauri::command(rename = "remote-task-pr-create")]
pub async fn remote_task_pr_create(
    params: RemoteTaskPullRequestCreateParams,
) -> Result<RemoteTaskPullRequestCreateResponse, String> {
    let request_body = RemoteTaskPullRequestCreateRequestBody {
        mode: params.mode,
        add_codex_tag: params.add_codex_tag,
        hide_pr_title_and_body: params.hide_pr_title_and_body,
        additional_labels: params.additional_labels,
    };
    RemoteTasksClient::load()
        .await?
        .post_json(
            &format!("/wham/tasks/{}/turns/{}/pr", params.task_id, params.turn_id),
            &request_body,
        )
        .await
}

#[tauri::command(rename = "remote-task-image-read")]
pub async fn remote_task_image_read(
    params: RemoteTaskImageReadParams,
) -> Result<RemoteTaskImageReadResponse, String> {
    RemoteTasksClient::load()
        .await?
        .read_image(&params.asset_pointer)
        .await
}

struct RemoteTasksClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

impl RemoteTasksClient {
    async fn load() -> Result<Self, String> {
        let codex_home = resolve_codex_home()?;
        let auth_manager = AuthManager::shared(
            codex_home,
            /*enable_codex_api_key_env*/ false,
            AuthCredentialsStoreMode::Auto,
            Some(CHATGPT_BACKEND_BASE_URL.to_string()),
        )
        .await;
        let http = build_reqwest_client_with_custom_ca(with_chatgpt_cloudflare_cookie_store(
            reqwest::Client::builder(),
        ))
        .map_err(|err| format!("failed to build remote tasks client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "remote tasks require an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("remote tasks require ChatGPT token auth".to_string());
        }
        Ok(auth)
    }

    fn headers_for_auth(&self, auth: &CodexAuth) -> Result<HeaderMap, String> {
        let mut headers = HeaderMap::new();
        match HeaderValue::from_str(&get_codex_user_agent()) {
            Ok(user_agent) => {
                headers.insert(USER_AGENT, user_agent);
            }
            Err(_) => {
                headers.insert(USER_AGENT, HeaderValue::from_static("codex-app-replica"));
            }
        }
        let token = auth
            .get_token()
            .map_err(|err| format!("failed to read ChatGPT access token: {err}"))?;
        let auth_header = HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|err| format!("failed to encode remote tasks auth header: {err}"))?;
        headers.insert(AUTHORIZATION, auth_header);
        if let Some(account_id) = auth.get_account_id() {
            if let Ok(header_name) = HeaderName::from_bytes(b"ChatGPT-Account-ID") {
                if let Ok(header_value) = HeaderValue::from_str(&account_id) {
                    headers.insert(header_name, header_value);
                }
            }
        }
        if auth.is_fedramp_account() {
            if let Ok(header_name) = HeaderName::from_bytes(b"X-OpenAI-Fedramp") {
                headers.insert(header_name, HeaderValue::from_static("true"));
            }
        }
        Ok(headers)
    }

    async fn refresh_auth(&self) -> Result<(), String> {
        self.auth_manager
            .refresh_token_from_authority()
            .await
            .map_err(|err| format!("failed to refresh ChatGPT auth for remote tasks: {err}"))
    }

    async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        match self.send_get(path).await {
            Ok(value) => Ok(value),
            Err(error) if error.is_unauthorized() => {
                self.refresh_auth().await?;
                self.send_get(path).await.map_err(|err| err.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn post_json<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, String> {
        match self.send_post(path, body).await {
            Ok(value) => Ok(value),
            Err(error) if error.is_unauthorized() => {
                self.refresh_auth().await?;
                self.send_post(path, body).await.map_err(|err| err.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn read_image(&self, asset_pointer: &str) -> Result<RemoteTaskImageReadResponse, String> {
        let normalized_asset_pointer = normalize_remote_task_asset_pointer(asset_pointer);
        if normalized_asset_pointer.is_empty() {
            return Err("remote task image asset pointer is empty".to_string());
        }

        let download_url_response: RemoteTaskFileDownloadUrlResponse = self
            .get_json(&format!("/files/download/{normalized_asset_pointer}"))
            .await?;
        if download_url_response.status != "success" {
            return Err(format!(
                "remote task image download URL request failed with status {}",
                download_url_response.status
            ));
        }
        let download_url = download_url_response
            .download_url
            .ok_or_else(|| "remote task image download URL was missing".to_string())?;
        let (bytes, content_type) = self.get_bytes(&download_url).await?;

        Ok(RemoteTaskImageReadResponse {
            contents_base64: BASE64_STANDARD.encode(bytes),
            content_type,
        })
    }

    async fn send_get<T: DeserializeOwned>(&self, path: &str) -> Result<T, RequestFailure> {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|err| RequestFailure {
                status: err.status(),
                message: format!("failed to GET {url}: {err}"),
            })?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure {
                status: Some(status),
                message: format!("GET {url} returned status {status}; body: {body}"),
            });
        }
        serde_json::from_str(&body).map_err(|err| RequestFailure {
            status: Some(status),
            message: format!("GET {url} response did not match expected shape: {err}"),
        })
    }

    async fn send_post<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, RequestFailure> {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = self
            .http
            .post(&url)
            .headers(headers)
            .json(body)
            .send()
            .await
            .map_err(|err| RequestFailure {
                status: err.status(),
                message: format!("failed to POST {url}: {err}"),
            })?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure {
                status: Some(status),
                message: format!("POST {url} returned status {status}; body: {body}"),
            });
        }
        serde_json::from_str(&body).map_err(|err| RequestFailure {
            status: Some(status),
            message: format!("POST {url} response did not match expected shape: {err}"),
        })
    }

    async fn get_bytes(&self, url: &str) -> Result<(Vec<u8>, Option<String>), String> {
        let response = self
            .http
            .get(url)
            .send()
            .await
            .map_err(|err| format!("failed to GET {url}: {err}"))?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("GET {url} returned status {status}; body: {body}"));
        }
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(ToOwned::to_owned);
        let bytes = response.bytes().await.map_err(|err| {
            format!("failed to read remote task image response body from {url}: {err}")
        })?;
        Ok((bytes.to_vec(), content_type))
    }
}

fn normalize_remote_task_asset_pointer(asset_pointer: &str) -> &str {
    asset_pointer
        .strip_prefix("file-service://")
        .or_else(|| asset_pointer.strip_prefix("sediment://"))
        .unwrap_or(asset_pointer)
}

struct RequestFailure {
    status: Option<StatusCode>,
    message: String,
}

impl RequestFailure {
    fn is_unauthorized(&self) -> bool {
        self.status == Some(StatusCode::UNAUTHORIZED)
    }

    fn other(message: String) -> Self {
        Self {
            status: None,
            message,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_task_read_params_deserialize_camel_case() {
        let parsed: RemoteTaskReadParams =
            serde_json::from_value(serde_json::json!({"taskId": "task_123"})).expect("decode");
        assert_eq!(parsed.task_id, "task_123");
    }

    #[test]
    fn remote_task_turn_read_params_deserialize_camel_case() {
        let parsed: RemoteTaskTurnReadParams =
            serde_json::from_value(serde_json::json!({"taskId": "task_123", "turnId": "turn_123"}))
                .expect("decode");
        assert_eq!(parsed.task_id, "task_123");
        assert_eq!(parsed.turn_id, "turn_123");
    }

    #[test]
    fn remote_task_turn_preserves_upstream_snake_case_shape() {
        let parsed: RemoteTaskTurn = serde_json::from_value(serde_json::json!({
            "id": "turn_1",
            "previous_turn_id": "turn_0",
            "created_at": 123,
            "attempt_placement": 2,
            "turn_status": "completed",
            "conversation_id": "conversation_1",
            "input_items": [{"type": "message"}],
            "output_items": [{"type": "message"}],
            "sibling_turn_ids": ["turn_2"],
            "environment": {
                "id": "env_1",
                "label": "Workspace",
                "repo_map": [
                    {
                        "clone_url": "https://github.com/openai/codex.git"
                    }
                ]
            }
        }))
        .expect("decode");

        assert_eq!(parsed.previous_turn_id.as_deref(), Some("turn_0"));
        assert_eq!(parsed.attempt_placement, Some(2));
        assert_eq!(parsed.turn_status.as_deref(), Some("completed"));
        assert_eq!(parsed.conversation_id.as_deref(), Some("conversation_1"));
        assert_eq!(parsed.input_items.as_ref().map(Vec::len), Some(1));
        assert_eq!(parsed.output_items.as_ref().map(Vec::len), Some(1));
        assert_eq!(parsed.sibling_turn_ids, vec!["turn_2".to_string()]);
        assert_eq!(
            parsed
                .environment
                .as_ref()
                .and_then(|environment| environment.id.as_deref()),
            Some("env_1")
        );
        assert_eq!(
            parsed
                .environment
                .as_ref()
                .and_then(|environment| environment.repo_map.first())
                .and_then(|repo| repo.clone_url.as_deref()),
            Some("https://github.com/openai/codex.git")
        );
    }

    #[test]
    fn remote_task_turns_response_reads_turn_mapping() {
        let parsed: RemoteTaskTurnsReadResponse = serde_json::from_value(serde_json::json!({
            "turn_mapping": {
                "node-1": {
                    "turn": {
                        "id": "turn_1",
                        "attempt_placement": 1
                    }
                }
            }
        }))
        .expect("decode");

        assert_eq!(parsed.turn_mapping.len(), 1);
        assert_eq!(
            parsed
                .turn_mapping
                .get("node-1")
                .and_then(|entry| entry.turn.as_ref())
                .map(|turn| turn.id.as_str()),
            Some("turn_1")
        );
    }

    #[test]
    fn remote_task_turn_read_response_reads_turn() {
        let parsed: RemoteTaskTurnReadResponse = serde_json::from_value(serde_json::json!({
            "turn": {
                "id": "turn_1",
                "turn_status": "completed",
                "pull_request_status": "created",
                "pull_request_data": {
                    "url": "https://github.com/openai/codex/pull/7",
                    "number": 7,
                    "status": "ready"
                }
            }
        }))
        .expect("decode");

        assert_eq!(parsed.turn.id, "turn_1");
        assert_eq!(parsed.turn.turn_status.as_deref(), Some("completed"));
        assert_eq!(parsed.turn.pull_request_status.as_deref(), Some("created"));
        assert_eq!(
            parsed
                .turn
                .pull_request_data
                .as_ref()
                .and_then(|pull_request| pull_request.number),
            Some(7)
        );
    }

    #[test]
    fn remote_task_read_response_reads_current_turns_and_task_fields() {
        let parsed: RemoteTaskReadResponse = serde_json::from_value(serde_json::json!({
            "task": {
                "id": "task_1",
                "title": "Remote task",
                "has_unread_turn": true,
                "task_status_display": {
                    "environment_label": "qa",
                    "latest_turn_status_display": {
                        "turn_status": "in_progress",
                        "diff_stats": {
                            "lines_added": 12,
                            "lines_removed": 4
                        }
                    }
                },
                "external_pull_requests": [
                    {
                        "assistant_turn_id": "turn_2",
                        "pull_request": {
                            "url": "https://github.com/example/pull/1",
                            "number": 1
                        }
                    }
                ]
            },
            "current_user_turn": {
                "id": "turn_1"
            },
            "current_assistant_turn": {
                "id": "turn_2"
            },
            "current_diff_task_turn": {
                "id": "turn_3"
            }
        }))
        .expect("decode");

        assert_eq!(parsed.task.id, "task_1");
        assert_eq!(parsed.task.title.as_deref(), Some("Remote task"));
        assert_eq!(parsed.task.has_unread_turn, Some(true));
        assert_eq!(
            parsed
                .task
                .task_status_display
                .as_ref()
                .and_then(|status| status.environment_label.as_deref()),
            Some("qa")
        );
        assert_eq!(parsed.task.external_pull_requests.len(), 1);
        assert_eq!(
            parsed
                .current_assistant_turn
                .as_ref()
                .map(|turn| turn.id.as_str()),
            Some("turn_2")
        );
        assert_eq!(
            parsed
                .current_diff_task_turn
                .as_ref()
                .map(|turn| turn.id.as_str()),
            Some("turn_3")
        );
    }

    #[test]
    fn remote_task_pr_create_params_deserialize_camel_case() {
        let parsed: RemoteTaskPullRequestCreateParams = serde_json::from_value(serde_json::json!({
            "taskId": "task_123",
            "turnId": "turn_123",
            "mode": "draft",
            "addCodexTag": true,
            "hidePrTitleAndBody": true,
            "additionalLabels": ["cloud"]
        }))
        .expect("decode");

        assert_eq!(parsed.task_id, "task_123");
        assert_eq!(parsed.turn_id, "turn_123");
        assert_eq!(parsed.mode.as_deref(), Some("draft"));
        assert_eq!(parsed.add_codex_tag, Some(true));
        assert_eq!(parsed.hide_pr_title_and_body, Some(true));
        assert_eq!(parsed.additional_labels, Some(vec!["cloud".to_string()]));
    }

    #[test]
    fn remote_task_pr_create_response_accepts_sparse_status_shape() {
        let parsed: RemoteTaskPullRequestCreateResponse =
            serde_json::from_value(serde_json::json!({"status": "success"})).expect("decode");

        assert_eq!(parsed.status.as_deref(), Some("success"));
    }

    #[test]
    fn remote_task_turn_logs_read_params_deserialize_camel_case() {
        let parsed: RemoteTaskTurnLogsReadParams =
            serde_json::from_value(serde_json::json!({"taskId": "task_123", "turnId": "turn_123"}))
                .expect("decode");
        assert_eq!(parsed.task_id, "task_123");
        assert_eq!(parsed.turn_id, "turn_123");
    }

    #[test]
    fn remote_task_turn_logs_response_reads_user_setup_script_logs() {
        let parsed: RemoteTaskTurnLogsReadResponse = serde_json::from_value(serde_json::json!({
            "logs": [
                {
                    "id": "log_1",
                    "item_type": "log",
                    "key": {
                        "type": "UserSetupScript",
                        "created_at": "2026-05-13T12:00:00Z"
                    },
                    "line": "installing dependencies"
                }
            ]
        }))
        .expect("decode");

        assert_eq!(parsed.logs.len(), 1);
        assert_eq!(parsed.logs[0].id.as_deref(), Some("log_1"));
        assert_eq!(
            parsed.logs[0]
                .key
                .as_ref()
                .and_then(|key| key.r#type.as_deref()),
            Some("UserSetupScript")
        );
        assert_eq!(
            parsed.logs[0].line.as_deref(),
            Some("installing dependencies")
        );
    }

    #[test]
    fn remote_task_image_read_params_deserialize_camel_case() {
        let parsed: RemoteTaskImageReadParams = serde_json::from_value(serde_json::json!({
            "assetPointer": "file-service://file_123"
        }))
        .expect("decode");

        assert_eq!(parsed.asset_pointer, "file-service://file_123");
    }

    #[test]
    fn normalize_remote_task_asset_pointer_strips_known_schemes() {
        assert_eq!(
            normalize_remote_task_asset_pointer("file-service://file_123"),
            "file_123"
        );
        assert_eq!(
            normalize_remote_task_asset_pointer("sediment://file_456"),
            "file_456"
        );
        assert_eq!(normalize_remote_task_asset_pointer("file_789"), "file_789");
    }
}
