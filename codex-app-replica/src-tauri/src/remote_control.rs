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
use reqwest::header::USER_AGENT;
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";

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
#[serde(rename_all = "camelCase")]
pub struct RemoteControlClient {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlClientsListResponse {
    pub items: Vec<RemoteControlClient>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlMfaRequiredButDisabledResponse {
    pub mfa_required_but_disabled: bool,
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
        match self.send_get(path).await {
            Ok(value) => Ok(value),
            Err(error) if error.is_unauthorized() => {
                self.refresh_auth().await?;
                self.send_get(path).await.map_err(|err| err.message)
            }
            Err(error) => Err(error.message),
        }
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
                status: None,
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
                    "id": "c-1",
                    "name": "iPhone",
                    "status": "active",
                    "createdAt": "2026-05-10T00:00:00Z"
                }
            ],
            "cursor": "next"
        });
        let parsed: RemoteControlClientsListResponse =
            serde_json::from_value(payload).expect("decode");
        assert_eq!(parsed.items.len(), 1);
        assert_eq!(parsed.items[0].id, "c-1");
        assert_eq!(parsed.items[0].name.as_deref(), Some("iPhone"));
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
