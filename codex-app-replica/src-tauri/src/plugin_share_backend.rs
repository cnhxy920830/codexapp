use crate::auth_bridge::PluginSharePrincipal;
use crate::auth_bridge::PluginSharePrincipalRole;
use crate::auth_bridge::PluginSharePrincipalType;
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
use reqwest::header::CONTENT_TYPE;
use reqwest::header::USER_AGENT;
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";
const DEFAULT_SEARCH_LIMIT: u32 = 10;
const DEFAULT_SEARCH_OFFSET: u32 = 0;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadPluginSharePrincipalsParams {
    pub remote_plugin_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginShareTarget {
    pub principal_type: PluginSharePrincipalType,
    pub principal_id: String,
    pub role: PluginSharePrincipalRole,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePluginShareTargetsParams {
    pub remote_plugin_id: String,
    pub targets: Vec<PluginShareTarget>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginSharePrincipalsResponse {
    pub principals: Vec<PluginSharePrincipal>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceUsersParams {
    pub account_id: String,
    pub query: String,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUserSummary {
    pub account_user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceUsersResponse {
    pub items: Vec<WorkspaceUserSummary>,
}

#[derive(Debug, Clone)]
struct PluginShareBackendClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

#[derive(Debug)]
struct RequestFailure {
    message: String,
    status: Option<StatusCode>,
}

#[derive(Debug, Clone, Serialize)]
struct UpdatePluginShareTargetsRequest<'a> {
    targets: &'a [PluginShareTarget],
}

#[derive(Debug, Clone, Deserialize)]
struct PluginSharePrincipalsBackendResponse {
    principals: Vec<PluginSharePrincipalBackend>,
}

#[derive(Debug, Clone, Deserialize)]
struct SearchWorkspaceUsersBackendResponse {
    #[serde(default)]
    items: Vec<WorkspaceUserSummaryBackend>,
}

#[derive(Debug, Clone, Deserialize)]
struct PluginSharePrincipalBackend {
    principal_type: PluginSharePrincipalType,
    principal_id: String,
    #[serde(default)]
    role: Option<PluginSharePrincipalRole>,
    name: String,
}

#[derive(Debug, Clone, Deserialize)]
struct WorkspaceUserSummaryBackend {
    account_user_id: String,
    email: Option<String>,
    name: Option<String>,
}

#[tauri::command(rename = "read-plugin-share-principals")]
pub async fn read_plugin_share_principals(
    params: ReadPluginSharePrincipalsParams,
) -> Result<PluginSharePrincipalsResponse, String> {
    PluginShareBackendClient::load()
        .await?
        .read_plugin_share_principals(&params)
        .await
}

#[tauri::command(rename = "update-plugin-share-targets")]
pub async fn update_plugin_share_targets(
    params: UpdatePluginShareTargetsParams,
) -> Result<PluginSharePrincipalsResponse, String> {
    PluginShareBackendClient::load()
        .await?
        .update_plugin_share_targets(&params)
        .await
}

#[tauri::command(rename = "search-workspace-users")]
pub async fn search_workspace_users(
    params: SearchWorkspaceUsersParams,
) -> Result<SearchWorkspaceUsersResponse, String> {
    PluginShareBackendClient::load()
        .await?
        .search_workspace_users(&params)
        .await
}

impl PluginShareBackendClient {
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
        .map_err(|err| format!("failed to build plugin share backend client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "plugin sharing requires an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("plugin sharing requires ChatGPT token auth".to_string());
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
            .map_err(|err| format!("failed to encode plugin sharing auth header: {err}"))?;
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
            .map_err(|err| format!("failed to refresh ChatGPT auth for plugin sharing: {err}"))
    }

    async fn get_json<T, F>(
        &self,
        method: &'static str,
        path: &str,
        build_request: F,
    ) -> Result<T, String>
    where
        T: DeserializeOwned,
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        self.send_json_with_retry(method, path, build_request).await
    }

    async fn put_json<T, B>(&self, path: &str, body: &B) -> Result<T, String>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        self.send_json_with_retry("PUT", path, |client, url, headers| {
            client
                .put(url)
                .headers(headers)
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .json(body)
        })
        .await
    }

    async fn send_json_with_retry<T, F>(
        &self,
        method: &'static str,
        path: &str,
        build_request: F,
    ) -> Result<T, String>
    where
        T: DeserializeOwned,
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        match self.send_json_once(method, path, &build_request).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.send_json_once(method, path, &build_request)
                    .await
                    .map_err(|error| error.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn send_json_once<T, F>(
        &self,
        method: &'static str,
        path: &str,
        build_request: &F,
    ) -> Result<T, RequestFailure>
    where
        T: DeserializeOwned,
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = build_request(&self.http, &url, headers)
            .send()
            .await
            .map_err(|error| RequestFailure::from_http_error(method, &url, error))?;
        let status = response.status();
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure::from_status(
                method,
                &url,
                status,
                &content_type,
                &body,
            ));
        }
        serde_json::from_str(&body).map_err(|error| {
            RequestFailure::from_decode_error(method, &url, &content_type, &body, error)
        })
    }

    async fn read_plugin_share_principals(
        &self,
        params: &ReadPluginSharePrincipalsParams,
    ) -> Result<PluginSharePrincipalsResponse, String> {
        let path = format!(
            "/ps/plugins/{}/shares",
            encode_component(&params.remote_plugin_id)
        );
        self.get_json("GET", &path, |client, url, headers| {
            client.get(url).headers(headers)
        })
        .await
        .map(
            |response: PluginSharePrincipalsBackendResponse| PluginSharePrincipalsResponse {
                principals: response
                    .principals
                    .into_iter()
                    .map(PluginSharePrincipal::from)
                    .collect(),
            },
        )
    }

    async fn update_plugin_share_targets(
        &self,
        params: &UpdatePluginShareTargetsParams,
    ) -> Result<PluginSharePrincipalsResponse, String> {
        let path = format!(
            "/ps/plugins/{}/shares",
            encode_component(&params.remote_plugin_id)
        );
        self.put_json(
            &path,
            &UpdatePluginShareTargetsRequest {
                targets: &params.targets,
            },
        )
        .await
        .map(
            |response: PluginSharePrincipalsBackendResponse| PluginSharePrincipalsResponse {
                principals: response
                    .principals
                    .into_iter()
                    .map(PluginSharePrincipal::from)
                    .collect(),
            },
        )
    }

    async fn search_workspace_users(
        &self,
        params: &SearchWorkspaceUsersParams,
    ) -> Result<SearchWorkspaceUsersResponse, String> {
        let limit = params.limit.unwrap_or(DEFAULT_SEARCH_LIMIT);
        let offset = params.offset.unwrap_or(DEFAULT_SEARCH_OFFSET);
        let path = format!("/accounts/{}/users", encode_component(&params.account_id));
        self.get_json("GET", &path, |client, url, headers| {
            client.get(url).headers(headers).query(&[
                ("limit", limit.to_string()),
                ("offset", offset.to_string()),
                ("query", params.query.clone()),
            ])
        })
        .await
        .map(
            |response: SearchWorkspaceUsersBackendResponse| SearchWorkspaceUsersResponse {
                items: response
                    .items
                    .into_iter()
                    .map(WorkspaceUserSummary::from)
                    .collect(),
            },
        )
    }
}

impl From<PluginSharePrincipalBackend> for PluginSharePrincipal {
    fn from(value: PluginSharePrincipalBackend) -> Self {
        Self {
            principal_type: value.principal_type,
            principal_id: value.principal_id,
            role: value.role,
            name: value.name,
        }
    }
}

impl From<WorkspaceUserSummaryBackend> for WorkspaceUserSummary {
    fn from(value: WorkspaceUserSummaryBackend) -> Self {
        Self {
            account_user_id: value.account_user_id,
            email: value.email,
            name: value.name,
        }
    }
}

impl RequestFailure {
    fn from_http_error(method: &str, url: &str, error: reqwest::Error) -> Self {
        Self {
            message: format!("{method} {url} failed: {error}"),
            status: error.status(),
        }
    }

    fn from_status(
        method: &str,
        url: &str,
        status: StatusCode,
        content_type: &str,
        body: &str,
    ) -> Self {
        Self {
            message: format!(
                "{method} {url} failed with {status}; content-type={content_type}; body={body}"
            ),
            status: Some(status),
        }
    }

    fn from_decode_error(
        method: &str,
        url: &str,
        content_type: &str,
        body: &str,
        error: serde_json::Error,
    ) -> Self {
        Self {
            message: format!(
                "failed to decode {method} {url} response: {error}; content-type={content_type}; body={body}"
            ),
            status: None,
        }
    }

    fn other(message: String) -> Self {
        Self {
            message,
            status: None,
        }
    }
}

fn encode_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.as_bytes() {
        let value = *byte;
        if matches!(
            value,
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~'
        ) {
            out.push(value as char);
        } else {
            out.push_str(&format!("%{value:02X}"));
        }
    }
    out
}
