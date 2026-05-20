//! Remote-control HTTP client for `/wham/remote/control/*` and
//! `/accounts/mfa_info`.
//!
//! Backs the Codex mobile / NUX paths in
//! `use-codex-mobile-connected-settings-BaF0LEnD.js` and `nux-gate-V47g3npd.js`.
//! Upstream wraps these endpoints with `c.safeGet(...)` against the same
//! ChatGPT backend the rest of the app uses, so this owner mirrors the
//! authenticated-client pattern from `usage_billing.rs` against the same
//! backend URL.
//!
//! Three Tauri commands are exposed, all matching the upstream paths:
//!
//! - `remote-control-mfa-requirement-read` →
//!   `GET /wham/remote/control/mfa_requirement` returning `{ requirement }`.
//! - `mfa-info-read` →
//!   `GET /accounts/mfa_info` returning `{ mfaEnabledV2 }`.
//! - `remote-control-clients-list` →
//!   `GET /wham/remote/control/clients?cursor=&limit=` returning
//!   `{ items: [...], cursor }`.
//!
//! A higher-level helper `remote-control-mfa-required-but-disabled-read`
//! mirrors upstream's composed helper `H()` that returns true when MFA is
//! required by `/wham/remote/control/mfa_requirement` but disabled by
//! `/accounts/mfa_info`. Pages that want the same one-shot signal can call
//! it instead of composing client-side.
//!
//! The shape of every response stays exactly aligned with the upstream JSON
//! payload so the page-owners do not need to change.

use crate::codex_home::resolve_codex_home;
use crate::global_settings::read_global_settings;
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
use std::sync::Arc;
use tauri::AppHandle;

const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";
const REMOTE_CONTROL_CLIENT_ENROLLMENTS_KEY: &str = "electron-remote-control-client-enrollments";
const REMOTE_CONTROL_ENVIRONMENTS_PATH: &str = "/codex/remote/control/environments";
const REMOTE_CONTROL_ENVIRONMENT_HOST_ID_PREFIX: &str = "remote-control:";
const REMOTE_CONTROL_ENVIRONMENTS_PAGE_SIZE: u32 = 100;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlMfaRequirementResponse {
    pub requirement: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct MfaRequirementBackend {
    requirement: String,
}

impl From<MfaRequirementBackend> for RemoteControlMfaRequirementResponse {
    fn from(value: MfaRequirementBackend) -> Self {
        Self {
            requirement: value.requirement,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MfaInfoResponse {
    pub mfa_enabled_v2: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct MfaInfoBackend {
    mfa_enabled_v2: bool,
}

impl From<MfaInfoBackend> for MfaInfoResponse {
    fn from(value: MfaInfoBackend) -> Self {
        Self {
            mfa_enabled_v2: value.mfa_enabled_v2,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlClientsListParams {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct RemoteControlClient {
    pub client_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enrollment_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct RemoteControlClientsListResponse {
    pub items: Vec<RemoteControlClient>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlEnvironment {
    pub host_id: String,
    pub display_name: String,
    pub host_name: Option<String>,
    pub auto_connect: bool,
    pub source: String,
    pub env_id: String,
    pub environment_kind: Option<String>,
    pub online: bool,
    pub busy: bool,
    pub os: Option<String>,
    pub arch: Option<String>,
    pub app_server_version: Option<String>,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlConnectionsState {
    pub available: bool,
    pub auth_required: bool,
    pub client_authorized: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RenameRemoteControlEnvironmentParams {
    pub env_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRemoteControlEnvironmentParams {
    pub env_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlMfaRequiredButDisabledResponse {
    pub mfa_required_but_disabled: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct RemoteControlEnvironmentPage {
    items: Vec<RemoteControlEnvironmentBackend>,
    cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct RemoteControlEnvironmentBackend {
    env_id: String,
    display_name: Option<String>,
    host_name: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    online: bool,
    busy: bool,
    #[serde(default)]
    os: Option<String>,
    #[serde(default)]
    arch: Option<String>,
    #[serde(default)]
    app_server_version: Option<String>,
    #[serde(default)]
    last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
struct RenameRemoteControlEnvironmentRequest<'a> {
    name: &'a str,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct StoredRemoteControlClientEnrollment {
    account_user_id: String,
    client_id: String,
    key_id: String,
    public_key_spki_der_base64: String,
    algorithm: String,
    protection_class: String,
}

struct ResponsePayload {
    body: String,
    content_type: String,
    url: String,
}

#[tauri::command(rename = "remote-control-mfa-requirement-read")]
pub async fn remote_control_mfa_requirement_read(
) -> Result<RemoteControlMfaRequirementResponse, String> {
    let client = RemoteControlClient_::load().await?;
    client
        .get_json::<MfaRequirementBackend>("/wham/remote/control/mfa_requirement")
        .await
        .map(Into::into)
}

#[tauri::command(rename = "mfa-info-read")]
pub async fn mfa_info_read() -> Result<MfaInfoResponse, String> {
    let client = RemoteControlClient_::load().await?;
    client
        .get_json::<MfaInfoBackend>("/accounts/mfa_info")
        .await
        .map(Into::into)
}

#[tauri::command(rename = "remote-control-clients-list")]
pub async fn remote_control_clients_list(
    params: RemoteControlClientsListParams,
) -> Result<RemoteControlClientsListResponse, String> {
    let client = RemoteControlClient_::load().await?;
    let mut path = String::from("/wham/remote/control/clients?");
    let mut first = true;
    if let Some(cursor) = params.cursor.as_deref() {
        path.push_str("cursor=");
        path.push_str(&urlencoding_lite(cursor));
        first = false;
    }
    if let Some(limit) = params.limit {
        if !first {
            path.push('&');
        }
        path.push_str(&format!("limit={limit}"));
    } else if !first {
        // no extra param
    }
    if path.ends_with('?') {
        path.pop();
    }
    client.get_json(&path).await
}

#[tauri::command(rename = "remote-control-mfa-required-but-disabled-read")]
pub async fn remote_control_mfa_required_but_disabled_read(
) -> Result<RemoteControlMfaRequiredButDisabledResponse, String> {
    let client = RemoteControlClient_::load().await?;
    let mfa_requirement: MfaRequirementBackend = client
        .get_json("/wham/remote/control/mfa_requirement")
        .await?;
    if mfa_requirement.requirement != "required" {
        return Ok(RemoteControlMfaRequiredButDisabledResponse {
            mfa_required_but_disabled: false,
        });
    }
    let mfa_info: MfaInfoBackend = client.get_json("/accounts/mfa_info").await?;
    Ok(RemoteControlMfaRequiredButDisabledResponse {
        mfa_required_but_disabled: !mfa_info.mfa_enabled_v2,
    })
}

pub(crate) async fn load_remote_control_connections_snapshot(
    app: &AppHandle,
) -> Result<(Vec<RemoteControlEnvironment>, RemoteControlConnectionsState), String> {
    let client = RemoteControlClient_::load().await?;
    let current_auth = match client.current_auth().await {
        Ok(auth) => Some(auth),
        Err(_) => None,
    };
    let client_authorized = read_remote_control_client_authorized(app, current_auth.as_ref())?;

    match client.list_remote_control_environments().await {
        Ok(connections) => Ok((
            connections,
            RemoteControlConnectionsState {
                available: true,
                auth_required: false,
                client_authorized,
            },
        )),
        Err(error) if error.status == Some(StatusCode::NOT_FOUND) => Ok((
            Vec::new(),
            RemoteControlConnectionsState {
                available: false,
                auth_required: false,
                client_authorized: false,
            },
        )),
        Err(error) if error.is_auth_required() => Ok((
            Vec::new(),
            RemoteControlConnectionsState {
                available: true,
                auth_required: true,
                client_authorized: false,
            },
        )),
        Err(error) => Err(error.message),
    }
}

pub(crate) async fn rename_remote_control_environment(
    env_id: &str,
    name: &str,
) -> Result<(), String> {
    let client = RemoteControlClient_::load().await?;
    client
        .rename_remote_control_environment(env_id, name)
        .await
        .map_err(|error| error.message)
}

pub(crate) async fn delete_remote_control_environment(env_id: &str) -> Result<(), String> {
    let client = RemoteControlClient_::load().await?;
    client
        .delete_remote_control_environment(env_id)
        .await
        .map_err(|error| error.message)
}

#[allow(non_camel_case_types)] // suffix `_` to avoid collision with `RemoteControlClient` model
struct RemoteControlClient_ {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

impl RemoteControlClient_ {
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
        .map_err(|err| format!("failed to build remote-control http client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "remote control requires an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("remote control requires ChatGPT token auth".to_string());
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
            .map_err(|err| format!("failed to encode remote control auth header: {err}"))?;
        headers.insert(AUTHORIZATION, auth_header);
        if let Some(account_id) = auth.get_account_id() {
            if let Ok(name) = HeaderName::from_bytes(b"ChatGPT-Account-ID") {
                if let Ok(value) = HeaderValue::from_str(&account_id) {
                    headers.insert(name, value);
                }
            }
        }
        if auth.is_fedramp_account() {
            if let Ok(name) = HeaderName::from_bytes(b"X-OpenAI-Fedramp") {
                headers.insert(name, HeaderValue::from_static("true"));
            }
        }
        Ok(headers)
    }

    async fn refresh_auth(&self) -> Result<(), String> {
        self.auth_manager
            .refresh_token_from_authority()
            .await
            .map_err(|err| format!("failed to refresh ChatGPT auth for remote control: {err}"))
    }

    async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        self.get_json_request_failure(path)
            .await
            .map_err(|error| error.message)
    }

    async fn get_json_request_failure<T: DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, RequestFailure> {
        let payload = self
            .send_request_with_retry("GET", path, |client, url, headers| {
                client.get(url).headers(headers)
            })
            .await?;
        serde_json::from_str(&payload.body).map_err(|err| RequestFailure {
            auth_required: false,
            status: None,
            message: format!(
                "GET {} response did not match expected shape: {err}",
                payload.url
            ),
        })
    }

    async fn patch_status_only<B: Serialize + ?Sized>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<(), RequestFailure> {
        self.send_request_with_retry("PATCH", path, |client, url, headers| {
            client
                .patch(url)
                .headers(headers)
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .json(body)
        })
        .await
        .map(|_| ())
    }

    async fn delete_status_only(&self, path: &str) -> Result<(), RequestFailure> {
        self.send_request_with_retry("DELETE", path, |client, url, headers| {
            client.delete(url).headers(headers)
        })
        .await
        .map(|_| ())
    }

    async fn send_request_with_retry<F>(
        &self,
        method: &str,
        path: &str,
        build_request: F,
    ) -> Result<ResponsePayload, RequestFailure>
    where
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        match self.send_request_once(method, path, &build_request).await {
            Ok(payload) => Ok(payload),
            Err(error) if error.is_unauthorized() => {
                self.refresh_auth()
                    .await
                    .map_err(RequestFailure::auth_required)?;
                self.send_request_once(method, path, &build_request).await
            }
            Err(error) => Err(error),
        }
    }

    async fn send_request_once<F>(
        &self,
        method: &str,
        path: &str,
        build_request: &F,
    ) -> Result<ResponsePayload, RequestFailure>
    where
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        let auth = self
            .current_auth()
            .await
            .map_err(RequestFailure::auth_required)?;
        let headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = build_request(&self.http, &url, headers)
            .send()
            .await
            .map_err(|err| RequestFailure {
                auth_required: false,
                status: None,
                message: format!("failed to {method} {url}: {err}"),
            })?;
        let status = response.status();
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure {
                auth_required: status == StatusCode::UNAUTHORIZED,
                status: Some(status),
                message: format!(
                    "{method} {url} returned status {status}; content-type={content_type}; body={body}"
                ),
            });
        }
        Ok(ResponsePayload {
            body,
            content_type,
            url,
        })
    }

    async fn list_remote_control_environments(
        &self,
    ) -> Result<Vec<RemoteControlEnvironment>, RequestFailure> {
        let mut cursor = None;
        let mut connections = Vec::new();

        loop {
            let response: RemoteControlEnvironmentPage = self
                .get_json_request_failure(&remote_control_environments_path(cursor.as_deref()))
                .await?;
            connections.extend(
                response
                    .items
                    .into_iter()
                    .map(map_remote_control_environment),
            );
            if response.cursor.is_none() {
                return Ok(connections);
            }
            cursor = response.cursor;
        }
    }

    async fn rename_remote_control_environment(
        &self,
        env_id: &str,
        name: &str,
    ) -> Result<(), RequestFailure> {
        let body = RenameRemoteControlEnvironmentRequest { name };
        self.patch_status_only(&remote_control_environment_path(env_id), &body)
            .await
    }

    async fn delete_remote_control_environment(&self, env_id: &str) -> Result<(), RequestFailure> {
        self.delete_status_only(&remote_control_environment_path(env_id))
            .await
    }
}

struct RequestFailure {
    auth_required: bool,
    status: Option<StatusCode>,
    message: String,
}

impl RequestFailure {
    fn is_unauthorized(&self) -> bool {
        self.status == Some(StatusCode::UNAUTHORIZED)
    }

    fn is_auth_required(&self) -> bool {
        self.auth_required || self.is_unauthorized()
    }

    fn auth_required(message: String) -> Self {
        Self {
            auth_required: true,
            status: None,
            message,
        }
    }

    fn other(message: String) -> Self {
        Self {
            auth_required: false,
            status: None,
            message,
        }
    }
}

fn read_remote_control_client_authorized(
    app: &AppHandle,
    auth: Option<&CodexAuth>,
) -> Result<bool, String> {
    let Some(chatgpt_user_id) = auth.and_then(CodexAuth::get_chatgpt_user_id) else {
        return Ok(false);
    };
    let settings = read_global_settings(app)?;
    let Some(value) = settings.get(REMOTE_CONTROL_CLIENT_ENROLLMENTS_KEY) else {
        return Ok(false);
    };
    let Some(enrollments) = value.as_object() else {
        return Ok(false);
    };

    Ok(enrollments.values().any(|value| {
        serde_json::from_value::<StoredRemoteControlClientEnrollment>(value.clone())
            .ok()
            .is_some_and(|enrollment| enrollment.account_user_id == chatgpt_user_id)
    }))
}

fn remote_control_environments_path(cursor: Option<&str>) -> String {
    let mut path =
        format!("{REMOTE_CONTROL_ENVIRONMENTS_PATH}?limit={REMOTE_CONTROL_ENVIRONMENTS_PAGE_SIZE}");
    if let Some(cursor) = cursor {
        path.push_str("&cursor=");
        path.push_str(&urlencoding_lite(cursor));
    }
    path
}

fn remote_control_environment_path(env_id: &str) -> String {
    format!(
        "{REMOTE_CONTROL_ENVIRONMENTS_PATH}/{}",
        urlencoding_lite(env_id)
    )
}

fn build_remote_control_host_id(env_id: &str) -> String {
    format!(
        "{REMOTE_CONTROL_ENVIRONMENT_HOST_ID_PREFIX}{}",
        urlencoding_lite(env_id)
    )
}

fn map_remote_control_environment(
    environment: RemoteControlEnvironmentBackend,
) -> RemoteControlEnvironment {
    let env_id = environment.env_id;
    let display_name = environment
        .display_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| env_id.clone());
    RemoteControlEnvironment {
        host_id: build_remote_control_host_id(&env_id),
        display_name,
        host_name: environment.host_name,
        auto_connect: false,
        source: "remote-control".to_string(),
        env_id,
        environment_kind: environment.kind,
        online: environment.online,
        busy: environment.busy,
        os: environment.os,
        arch: environment.arch,
        app_server_version: environment.app_server_version,
        last_seen_at: environment.last_seen_at,
    }
}

/// Minimal RFC 3986 component-encoder for a single query value. The upstream
/// helpers go through `safeGet({ parameters: { query: { cursor } } })`, which
/// percent-encodes special characters in cursor tokens; mirror that locally
/// without pulling in another crate.
fn urlencoding_lite(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.as_bytes() {
        let c = *byte;
        if matches!(c, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~') {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mfa_requirement_response_serializes_camel_case() {
        let response = RemoteControlMfaRequirementResponse {
            requirement: "required".into(),
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["requirement"], "required");
    }

    #[test]
    fn mfa_info_response_serializes_camel_case() {
        let response = MfaInfoResponse {
            mfa_enabled_v2: true,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["mfaEnabledV2"], true);
    }

    #[test]
    fn mfa_info_backend_decodes_snake_case_field() {
        let raw = serde_json::json!({"mfa_enabled_v2": true});
        let parsed: MfaInfoBackend = serde_json::from_value(raw).expect("decode");
        assert!(parsed.mfa_enabled_v2);
    }

    #[test]
    fn clients_list_params_decode_camel_case() {
        let raw = serde_json::json!({"cursor": "abc", "limit": 25});
        let parsed: RemoteControlClientsListParams = serde_json::from_value(raw).expect("decode");
        assert_eq!(parsed.cursor.as_deref(), Some("abc"));
        assert_eq!(parsed.limit, Some(25));
    }

    #[test]
    fn clients_list_response_round_trips() {
        let payload = serde_json::json!({
            "items": [
                {
                    "client_id": "c-1",
                    "display_name": "iPhone",
                    "device_model": "iPhone 15 Pro",
                    "platform": "ios",
                    "status": "active",
                    "enrollment_status": "approved",
                    "created_at": "2026-05-10T00:00:00Z"
                }
            ],
            "cursor": "next"
        });
        let parsed: RemoteControlClientsListResponse =
            serde_json::from_value(payload).expect("decode");
        assert_eq!(parsed.items.len(), 1);
        assert_eq!(parsed.items[0].client_id, "c-1");
        assert_eq!(parsed.items[0].display_name.as_deref(), Some("iPhone"));
        assert_eq!(
            parsed.items[0].device_model.as_deref(),
            Some("iPhone 15 Pro")
        );
        assert_eq!(parsed.items[0].platform.as_deref(), Some("ios"));
        assert_eq!(
            parsed.items[0].enrollment_status.as_deref(),
            Some("approved")
        );
        assert_eq!(
            parsed.items[0].created_at.as_deref(),
            Some("2026-05-10T00:00:00Z")
        );
        assert_eq!(parsed.cursor.as_deref(), Some("next"));
    }

    #[test]
    fn mfa_required_but_disabled_response_serializes_camel_case() {
        let response = RemoteControlMfaRequiredButDisabledResponse {
            mfa_required_but_disabled: true,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["mfaRequiredButDisabled"], true);
    }

    #[test]
    fn remote_control_connections_state_serializes_camel_case() {
        let state = RemoteControlConnectionsState {
            available: true,
            auth_required: false,
            client_authorized: true,
        };
        let value = serde_json::to_value(&state).expect("serialize");
        assert_eq!(
            value,
            serde_json::json!({
                "available": true,
                "authRequired": false,
                "clientAuthorized": true,
            })
        );
    }

    #[test]
    fn remote_control_environment_page_decodes_snake_case_items() {
        let payload = serde_json::json!({
            "items": [
                {
                    "env_id": "env-1",
                    "display_name": "Office Mac",
                    "host_name": "MacBook Pro",
                    "kind": "desktop",
                    "online": true,
                    "busy": false,
                    "os": "darwin",
                    "arch": "arm64",
                    "app_server_version": "0.129.0",
                    "last_seen_at": "2026-05-20T00:00:00Z"
                }
            ],
            "cursor": "next"
        });
        let page: RemoteControlEnvironmentPage = serde_json::from_value(payload).expect("decode");
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].env_id, "env-1");
        assert_eq!(page.items[0].display_name.as_deref(), Some("Office Mac"));
        assert_eq!(page.cursor.as_deref(), Some("next"));
    }

    #[test]
    fn map_remote_control_environment_matches_replica_snapshot_shape() {
        let environment = map_remote_control_environment(RemoteControlEnvironmentBackend {
            env_id: "env-1".to_string(),
            display_name: Some("Office Mac".to_string()),
            host_name: Some("MacBook Pro".to_string()),
            kind: Some("desktop".to_string()),
            online: true,
            busy: true,
            os: Some("darwin".to_string()),
            arch: Some("arm64".to_string()),
            app_server_version: Some("0.129.0".to_string()),
            last_seen_at: Some("2026-05-20T00:00:00Z".to_string()),
        });
        assert_eq!(
            environment,
            RemoteControlEnvironment {
                host_id: "remote-control:env-1".to_string(),
                display_name: "Office Mac".to_string(),
                host_name: Some("MacBook Pro".to_string()),
                auto_connect: false,
                source: "remote-control".to_string(),
                env_id: "env-1".to_string(),
                environment_kind: Some("desktop".to_string()),
                online: true,
                busy: true,
                os: Some("darwin".to_string()),
                arch: Some("arm64".to_string()),
                app_server_version: Some("0.129.0".to_string()),
                last_seen_at: Some("2026-05-20T00:00:00Z".to_string()),
            }
        );
    }

    #[test]
    fn remote_control_environment_paths_match_extracted_routes() {
        assert_eq!(
            remote_control_environments_path(None),
            "/codex/remote/control/environments?limit=100"
        );
        assert_eq!(
            remote_control_environments_path(Some("abc/123")),
            "/codex/remote/control/environments?limit=100&cursor=abc%2F123"
        );
        assert_eq!(
            remote_control_environment_path("env/123"),
            "/codex/remote/control/environments/env%2F123"
        );
    }

    #[test]
    fn request_failure_auth_required_is_true_for_explicit_auth_required() {
        let failure = RequestFailure::auth_required("sign in required".to_string());
        assert!(failure.is_auth_required());
        assert!(!failure.is_unauthorized());
    }

    #[test]
    fn urlencoding_passes_unreserved_through_unchanged() {
        assert_eq!(urlencoding_lite("abcXYZ09-_."), "abcXYZ09-_.");
    }

    #[test]
    fn urlencoding_percent_encodes_special_characters() {
        assert_eq!(urlencoding_lite(" "), "%20");
        assert_eq!(urlencoding_lite("a/b"), "a%2Fb");
        assert_eq!(urlencoding_lite("a&b"), "a%26b");
        assert_eq!(urlencoding_lite("a=b"), "a%3Db");
    }
}
