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
use serde_json::Value;
use std::sync::Arc;

const BROWSER_CALLBACK_PATH: &str = "/connector_platform_oauth_redirect";
const CALLBACK_URL: &str = "codex://app-connect-oauth-callback";
const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";
const CONNECTOR_ORIGINATOR_DEFAULT: &str = "Codex Desktop";
const CONNECTOR_PRODUCT_SKU: &str = "CONNECTOR_SETTING";
const NO_PERSONALIZATION: &str = "NO_PERSONALIZATION";

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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadAppConnectorDisclosureParams {
    pub app_id: String,
    pub app_name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadAppConnectorDisclosureResponse {
    pub blurbs: Vec<AppConnectorBlurb>,
    pub personalization_toggle: Option<AppConnectorPersonalizationToggle>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConnectorBlurb {
    pub description: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConnectorPersonalizationToggle {
    pub app_id: String,
    pub app_name: String,
    pub blurb: AppConnectorBlurb,
    pub default_mode: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectAppConnectorParams {
    pub app_id: String,
    pub app_name: String,
    pub callback_mode: Option<String>,
    pub install_url: Option<String>,
    pub personalization_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind")]
pub enum ConnectAppConnectorResponse {
    #[serde(rename = "browser-fallback")]
    BrowserFallback,
    #[serde(rename = "connected-directly")]
    ConnectedDirectly,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "oauth-started", rename_all = "camelCase")]
    OauthStarted { redirect_url: String },
}

#[derive(Debug, Clone, Serialize)]
struct FinishAppConnectOAuthCallbackRequest<'a> {
    full_redirect_url: &'a str,
}

#[derive(Debug, Clone, Serialize)]
struct ConnectAppConnectorRequest<'a> {
    action_names: ConnectActionNames<'a>,
    connector_id: &'a str,
    name: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    callback_url: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    post_auth_url: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_settings: Option<ConnectorToolSettingsRequest<'a>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
enum ConnectActionNames<'a> {
    Empty(Vec<&'a str>),
    Null(Option<Vec<&'a str>>),
}

#[derive(Debug, Clone, Serialize)]
struct ConnectorToolSettingsRequest<'a> {
    personalized: &'a str,
}

#[derive(Debug, Clone, Deserialize)]
struct FinishAppConnectOAuthCallbackBackendResponse {
    link: Option<FinishAppConnectOAuthCallbackBackendLink>,
}

#[derive(Debug, Clone, Deserialize)]
struct FinishAppConnectOAuthCallbackBackendLink {
    name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ReadConnectorDisclosureBackendResponse {
    #[serde(default)]
    blurbs: Vec<ConnectorDisclosureBlurbBackend>,
    #[serde(default)]
    personalization_default: Option<String>,
    #[serde(default)]
    personalization_toggle_blurb: Option<ConnectorDisclosureBlurbBackend>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorDisclosureBlurbBackend {
    description: Option<String>,
    title: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorMetadataResponse {
    id: String,
    name: String,
    #[serde(default)]
    link_params_schema: Option<Value>,
    #[serde(default)]
    supported_auth: Vec<ConnectorSupportedAuth>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorSupportedAuth {
    #[serde(rename = "type")]
    auth_type: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectAppConnectorBackendResponse {
    redirect_url: Option<String>,
}

#[derive(Debug, Clone)]
struct AppConnectOAuthClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

#[derive(Debug)]
struct RequestFailure {
    message: String,
    status: Option<StatusCode>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ConnectorAuthType {
    None,
    OAuth,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ConnectorCallbackMode {
    Browser,
    Native,
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

#[tauri::command(rename = "read-app-connector-disclosure")]
pub async fn read_app_connector_disclosure(
    params: ReadAppConnectorDisclosureParams,
) -> Result<ReadAppConnectorDisclosureResponse, String> {
    AppConnectOAuthClient::load()
        .await?
        .read_connector_disclosure(&params)
        .await
}

#[tauri::command(rename = "connect-app-connector")]
pub async fn connect_app_connector(
    params: ConnectAppConnectorParams,
) -> Result<ConnectAppConnectorResponse, String> {
    AppConnectOAuthClient::load()
        .await?
        .connect_connector(&params)
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

    fn connector_headers_for_auth(&self, auth: &CodexAuth) -> Result<HeaderMap, String> {
        let mut headers = self.headers_for_auth(auth)?;
        let originator = std::env::var("CODEX_INTERNAL_ORIGINATOR_OVERRIDE")
            .unwrap_or_else(|_| CONNECTOR_ORIGINATOR_DEFAULT.to_string());
        let originator_name = HeaderName::from_bytes(b"originator")
            .map_err(|err| format!("failed to encode connector originator header name: {err}"))?;
        let originator_value = HeaderValue::from_str(&originator)
            .map_err(|err| format!("failed to encode connector originator header: {err}"))?;
        headers.insert(originator_name, originator_value);
        let sku_name = HeaderName::from_bytes(b"OAI-Product-Sku")
            .map_err(|err| format!("failed to encode connector sku header name: {err}"))?;
        headers.insert(sku_name, HeaderValue::from_static(CONNECTOR_PRODUCT_SKU));
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
                /*connector_headers*/ false,
            )
            .await?;
        Ok(FinishAppConnectOAuthCallbackResponse {
            app_name: response.link.and_then(|link| link.name),
        })
    }

    async fn read_connector_disclosure(
        &self,
        params: &ReadAppConnectorDisclosureParams,
    ) -> Result<ReadAppConnectorDisclosureResponse, String> {
        let app_id = params.app_id.trim();
        let app_name = params.app_name.trim();
        if app_id.is_empty() {
            return Err("app connector disclosure requires a non-empty app id".to_string());
        }
        if app_name.is_empty() {
            return Err("app connector disclosure requires a non-empty app name".to_string());
        }

        let path = format!(
            "/aip/connectors/{}/tos",
            percent_encode_path_segment(app_id),
        );
        let response = self
            .get_json_with_retry::<ReadConnectorDisclosureBackendResponse>(
                &path, /*connector_headers*/ true,
            )
            .await?;

        let blurbs = response
            .blurbs
            .into_iter()
            .filter_map(normalize_backend_blurb)
            .collect::<Vec<_>>();
        let personalization_toggle = response
            .personalization_toggle_blurb
            .and_then(normalize_backend_blurb)
            .map(|blurb| AppConnectorPersonalizationToggle {
                app_id: app_id.to_string(),
                app_name: app_name.to_string(),
                blurb,
                default_mode: response
                    .personalization_default
                    .as_deref()
                    .filter(|mode| !mode.trim().is_empty())
                    .unwrap_or(NO_PERSONALIZATION)
                    .to_string(),
            });

        Ok(ReadAppConnectorDisclosureResponse {
            blurbs,
            personalization_toggle,
        })
    }

    async fn connect_connector(
        &self,
        params: &ConnectAppConnectorParams,
    ) -> Result<ConnectAppConnectorResponse, String> {
        let app_id = params.app_id.trim();
        let app_name = params.app_name.trim();
        if app_id.is_empty() {
            return Err("app connector connect requires a non-empty app id".to_string());
        }
        if app_name.is_empty() {
            return Err("app connector connect requires a non-empty app name".to_string());
        }

        let install_url = normalize_optional_string(params.install_url.as_deref());
        let connector = match self.read_connector_metadata(app_id).await {
            Ok(connector) => connector,
            Err(error) => {
                return Ok(match install_url {
                    Some(_) => {
                        eprintln!("failed to resolve connector metadata for {app_id}: {error}");
                        ConnectAppConnectorResponse::BrowserFallback
                    }
                    None => ConnectAppConnectorResponse::Failed,
                });
            }
        };

        let auth_type = connector_auth_type(&connector);
        if connector_requires_link_params(&connector) || auth_type == ConnectorAuthType::Unsupported
        {
            return Ok(match install_url {
                Some(_) => ConnectAppConnectorResponse::BrowserFallback,
                None => ConnectAppConnectorResponse::Failed,
            });
        }

        let personalization_mode =
            normalize_optional_string(params.personalization_mode.as_deref());
        let tool_settings =
            personalization_mode.map(|mode| ConnectorToolSettingsRequest { personalized: mode });

        match auth_type {
            ConnectorAuthType::None => {
                let request = ConnectAppConnectorRequest {
                    action_names: ConnectActionNames::Empty(Vec::new()),
                    callback_url: None,
                    connector_id: &connector.id,
                    name: &connector.name,
                    post_auth_url: None,
                    tool_settings,
                };
                if self
                    .post_json_with_retry::<Value, _>(
                        "/aip/connectors/links/noauth",
                        &request,
                        /*connector_headers*/ true,
                    )
                    .await
                    .is_ok()
                {
                    return Ok(ConnectAppConnectorResponse::ConnectedDirectly);
                }
            }
            ConnectorAuthType::OAuth => {
                let callback_mode =
                    ConnectorCallbackMode::from_option(params.callback_mode.as_deref());
                let callback_url = match callback_mode {
                    ConnectorCallbackMode::Browser => browser_callback_url(install_url)
                        .unwrap_or_else(|| CALLBACK_URL.to_string()),
                    ConnectorCallbackMode::Native => CALLBACK_URL.to_string(),
                };
                let post_auth_url = build_post_auth_url(app_id, install_url)
                    .unwrap_or_else(|| default_post_auth_url(app_id));
                let request = ConnectAppConnectorRequest {
                    action_names: ConnectActionNames::Null(None),
                    callback_url: Some(&callback_url),
                    connector_id: &connector.id,
                    name: &connector.name,
                    post_auth_url: Some(&post_auth_url),
                    tool_settings,
                };
                match self
                    .post_json_with_retry::<ConnectAppConnectorBackendResponse, _>(
                        "/aip/connectors/links/oauth",
                        &request,
                        /*connector_headers*/ true,
                    )
                    .await
                {
                    Ok(response) => {
                        if let Some(redirect_url) =
                            normalize_optional_string(response.redirect_url.as_deref())
                        {
                            return Ok(ConnectAppConnectorResponse::OauthStarted {
                                redirect_url: redirect_url.to_string(),
                            });
                        }
                    }
                    Err(error) => {
                        eprintln!("failed to start connector oauth for {app_id}: {error}");
                    }
                }
            }
            ConnectorAuthType::Unsupported => {}
        }

        Ok(match install_url {
            Some(_) => ConnectAppConnectorResponse::BrowserFallback,
            None => ConnectAppConnectorResponse::Failed,
        })
    }

    async fn read_connector_metadata(
        &self,
        app_id: &str,
    ) -> Result<ConnectorMetadataResponse, String> {
        let path = format!(
            "/aip/connectors/{}?include_logo=false",
            percent_encode_path_segment(app_id),
        );
        self.get_json_with_retry(&path, /*connector_headers*/ true)
            .await
    }

    async fn get_json_with_retry<T>(&self, path: &str, connector_headers: bool) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        match self.get_json_once(path, connector_headers).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.get_json_once(path, connector_headers)
                    .await
                    .map_err(|error| error.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn get_json_once<T>(
        &self,
        path: &str,
        connector_headers: bool,
    ) -> Result<T, RequestFailure>
    where
        T: DeserializeOwned,
    {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = if connector_headers {
            self.connector_headers_for_auth(&auth)
        } else {
            self.headers_for_auth(&auth)
        }
        .map_err(RequestFailure::other)?;
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|error| RequestFailure::from_http_error("GET", &url, error))?;
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
                "GET",
                &url,
                status,
                &content_type,
                &raw_body,
            ));
        }
        serde_json::from_str(&raw_body).map_err(|error| {
            RequestFailure::from_decode_error("GET", &url, &content_type, &raw_body, error)
        })
    }

    async fn post_json_with_retry<T, B>(
        &self,
        path: &str,
        body: &B,
        connector_headers: bool,
    ) -> Result<T, String>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        match self.post_json_once(path, body, connector_headers).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.post_json_once(path, body, connector_headers)
                    .await
                    .map_err(|error| error.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn post_json_once<T, B>(
        &self,
        path: &str,
        body: &B,
        connector_headers: bool,
    ) -> Result<T, RequestFailure>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let headers = if connector_headers {
            self.connector_headers_for_auth(&auth)
        } else {
            self.headers_for_auth(&auth)
        }
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

impl ConnectorCallbackMode {
    fn from_option(value: Option<&str>) -> Self {
        if value
            .map(str::trim)
            .is_some_and(|mode| mode.eq_ignore_ascii_case("browser"))
        {
            return Self::Browser;
        }
        Self::Native
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

fn normalize_backend_blurb(value: ConnectorDisclosureBlurbBackend) -> Option<AppConnectorBlurb> {
    let title = normalize_optional_string(value.title.as_deref())?;
    let description = normalize_optional_string(value.description.as_deref())?;
    Some(AppConnectorBlurb {
        description: description.to_string(),
        title: title.to_string(),
    })
}

fn connector_auth_type(connector: &ConnectorMetadataResponse) -> ConnectorAuthType {
    if connector
        .supported_auth
        .iter()
        .any(|auth| auth.auth_type.eq_ignore_ascii_case("OAUTH"))
    {
        return ConnectorAuthType::OAuth;
    }
    if connector
        .supported_auth
        .iter()
        .any(|auth| auth.auth_type.eq_ignore_ascii_case("NONE"))
    {
        return ConnectorAuthType::None;
    }
    ConnectorAuthType::Unsupported
}

fn connector_requires_link_params(connector: &ConnectorMetadataResponse) -> bool {
    let Some(schema) = connector.link_params_schema.as_ref() else {
        return false;
    };

    let has_properties = schema
        .get("properties")
        .and_then(Value::as_object)
        .is_some_and(|properties| !properties.is_empty());
    let has_required = schema
        .get("required")
        .and_then(Value::as_array)
        .is_some_and(|required| !required.is_empty());
    has_properties || has_required
}

fn browser_callback_url(install_url: Option<&str>) -> Option<String> {
    let install_url = normalize_optional_string(install_url)?;
    let origin = url_origin(install_url)?;
    Some(format!("{origin}{BROWSER_CALLBACK_PATH}"))
}

fn build_post_auth_url(app_id: &str, install_url: Option<&str>) -> Option<String> {
    let install_url = normalize_optional_string(install_url)?;
    let mut url = reqwest::Url::parse(install_url).ok()?;
    url.set_fragment(Some(&settings_hash(app_id)));
    Some(url.to_string())
}

fn default_post_auth_url(app_id: &str) -> String {
    format!("https://chatgpt.com/gpts/editor#{}", settings_hash(app_id))
}

fn settings_hash(app_id: &str) -> String {
    format!(
        "settings/Connectors?connector={}&referrer=app_directory",
        percent_encode_query_value(app_id),
    )
}

fn url_origin(value: &str) -> Option<String> {
    let url = reqwest::Url::parse(value).ok()?;
    Some(url.origin().ascii_serialization())
}

fn normalize_optional_string(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn parse_error_message(body: &str) -> Option<String> {
    let parsed = serde_json::from_str::<Value>(body).ok()?;
    parsed
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string)
}

fn percent_encode_path_segment(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(char::from(byte))
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn percent_encode_query_value(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(char::from(byte))
            }
            b' ' => encoded.push_str("%20"),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::browser_callback_url;
    use super::build_post_auth_url;
    use super::connector_auth_type;
    use super::connector_requires_link_params;
    use super::default_post_auth_url;
    use super::percent_encode_path_segment;
    use super::ConnectorAuthType;
    use super::ConnectorMetadataResponse;
    use super::ConnectorSupportedAuth;
    use serde_json::json;

    #[test]
    fn connector_path_segment_is_percent_encoded() {
        assert_eq!(
            percent_encode_path_segment("connector_google calendar/x"),
            "connector_google%20calendar%2Fx"
        );
    }

    #[test]
    fn browser_callback_url_uses_install_origin() {
        assert_eq!(
            browser_callback_url(Some("https://chatgpt.com/g/g-123/plugin")),
            Some("https://chatgpt.com/connector_platform_oauth_redirect".to_string())
        );
    }

    #[test]
    fn post_auth_url_reuses_install_url() {
        assert_eq!(
            build_post_auth_url(
                "connector_google-calendar",
                Some("https://chatgpt.com/g/g-123/plugin?tab=overview")
            ),
            Some(
                "https://chatgpt.com/g/g-123/plugin?tab=overview#settings/Connectors?connector=connector_google-calendar&referrer=app_directory".to_string()
            )
        );
    }

    #[test]
    fn default_post_auth_url_falls_back_to_editor() {
        assert_eq!(
            default_post_auth_url("connector_slack"),
            "https://chatgpt.com/gpts/editor#settings/Connectors?connector=connector_slack&referrer=app_directory"
        );
    }

    #[test]
    fn connector_auth_type_prefers_oauth_over_none() {
        let connector = ConnectorMetadataResponse {
            id: "connector_google-calendar".to_string(),
            name: "Google Calendar".to_string(),
            link_params_schema: None,
            supported_auth: vec![
                ConnectorSupportedAuth {
                    auth_type: "NONE".to_string(),
                },
                ConnectorSupportedAuth {
                    auth_type: "OAUTH".to_string(),
                },
            ],
        };
        assert_eq!(connector_auth_type(&connector), ConnectorAuthType::OAuth);
    }

    #[test]
    fn connector_link_params_schema_marks_connector_as_unsupported() {
        let connector = ConnectorMetadataResponse {
            id: "connector_custom".to_string(),
            name: "Custom".to_string(),
            link_params_schema: Some(json!({
                "type": "object",
                "properties": {
                    "workspaceId": {
                        "type": "string",
                    }
                }
            })),
            supported_auth: vec![ConnectorSupportedAuth {
                auth_type: "OAUTH".to_string(),
            }],
        };
        assert!(connector_requires_link_params(&connector));
    }
}
