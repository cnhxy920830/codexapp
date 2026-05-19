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
const CALLBACK_URL: &str = "codex://app-connect-oauth-callback";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConnectOAuthCallbackUrlResponse {
    pub callback_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinishAppConnectOAuthCallbackParams {
    pub full_redirect_url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinishAppConnectOAuthCallbackResponse {
    pub app_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct FinishAppConnectOAuthCallbackRequest<'a> {
    full_redirect_url: &'a str,
}

#[derive(Debug, Clone, Deserialize)]
struct FinishAppConnectOAuthCallbackBackendResponse {
    link: Option<FinishAppConnectOAuthCallbackBackendLink>,
}

#[derive(Debug, Clone, Deserialize)]
struct FinishAppConnectOAuthCallbackBackendLink {
    name: Option<String>,
}

#[derive(Debug)]
struct AppConnectOAuthClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

#[derive(Debug)]
struct RequestFailure {
    message: String,
    status: Option<StatusCode>,
}

#[tauri::command(rename = "app-connect-oauth-callback-url")]
pub async fn app_connect_oauth_callback_url() -> Result<AppConnectOAuthCallbackUrlResponse, String>
{
    Ok(AppConnectOAuthCallbackUrlResponse {
        callback_url: CALLBACK_URL.to_string(),
    })
}

#[tauri::command(rename = "finish-app-connect-oauth-callback")]
pub async fn finish_app_connect_oauth_callback(
    params: FinishAppConnectOAuthCallbackParams,
) -> Result<FinishAppConnectOAuthCallbackResponse, String> {
    AppConnectOAuthClient::load()
        .await?
        .finish_callback(&params)
        .await
}

impl AppConnectOAuthClient {
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
        .map_err(|err| format!("failed to build app connect oauth client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "app connect OAuth requires an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("app connect OAuth requires ChatGPT token auth".to_string());
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
            .map_err(|err| format!("failed to encode app connect oauth auth header: {err}"))?;
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
            .map_err(|err| format!("failed to refresh ChatGPT auth for app connect oauth: {err}"))
    }

    async fn finish_callback(
        &self,
        params: &FinishAppConnectOAuthCallbackParams,
    ) -> Result<FinishAppConnectOAuthCallbackResponse, String> {
        let request = FinishAppConnectOAuthCallbackRequest {
            full_redirect_url: params.full_redirect_url.trim(),
        };
        let response = self
            .post_json_with_retry::<FinishAppConnectOAuthCallbackBackendResponse, _>(
                "/aip/connectors/links/oauth/callback",
                &request,
            )
            .await?;
        Ok(FinishAppConnectOAuthCallbackResponse {
            app_name: response.link.and_then(|link| link.name),
        })
    }

    async fn post_json_with_retry<T, B>(&self, path: &str, body: &B) -> Result<T, String>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        match self.post_json_once(path, body).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.post_json_once(path, body)
                    .await
                    .map_err(|error| error.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn post_json_once<T, B>(&self, path: &str, body: &B) -> Result<T, RequestFailure>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = self
            .http
            .post(&url)
            .headers(headers)
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .json(body)
            .send()
            .await
            .map_err(|error| RequestFailure::from_http_error("POST", &url, error))?;
        let status = response.status();
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let raw_body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure::from_response(
                "POST",
                &url,
                status,
                &content_type,
                &raw_body,
            ));
        }
        serde_json::from_str(&raw_body).map_err(|error| {
            RequestFailure::from_decode_error("POST", &url, &content_type, &raw_body, error)
        })
    }
}

impl RequestFailure {
    fn from_http_error(method: &str, url: &str, error: reqwest::Error) -> Self {
        Self {
            message: format!("{method} {url} failed: {error}"),
            status: error.status(),
        }
    }

    fn from_response(
        method: &str,
        url: &str,
        status: StatusCode,
        content_type: &str,
        body: &str,
    ) -> Self {
        let message = parse_error_message(body).unwrap_or_else(|| {
            format!("{method} {url} failed: {status}; content-type={content_type}; body={body}")
        });
        Self {
            message,
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

fn parse_error_message(body: &str) -> Option<String> {
    let parsed = serde_json::from_str::<serde_json::Value>(body).ok()?;
    parsed
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string)
}
