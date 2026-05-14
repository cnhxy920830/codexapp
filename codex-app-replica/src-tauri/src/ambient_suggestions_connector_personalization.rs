use codex_client::build_reqwest_client_with_custom_ca;
use codex_client::with_chatgpt_cloudflare_cookie_store;
use codex_login::AuthCredentialsStoreMode;
use codex_login::CodexAuth;
use reqwest::header::HeaderMap;
use reqwest::header::HeaderName;
use reqwest::header::HeaderValue;
use reqwest::header::AUTHORIZATION;
use serde::Deserialize;
use std::collections::HashSet;

use crate::auth_bridge::AppInfo;
use crate::codex_home::resolve_codex_home;

const CONNECTOR_PREFIX: &str = "connector_";
const CONNECTOR_SETTING_SKU: &str = "CONNECTOR_SETTING";
const CONNECTOR_ACCOUNT_ID_HEADER: &str = "ChatGPT-Account-Id";
const DEFAULT_CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";
const LOCALHOST_CHATGPT_BACKEND_BASE_URL: &str = "http://localhost:8000/api";
const NO_PERSONALIZATION: &str = "NO_PERSONALIZATION";
const PERSONALIZE_ALWAYS: &str = "PERSONALIZE_ALWAYS";
const UNSET_PERSONALIZATION: &str = "UNSET";

#[derive(Debug, Clone, Deserialize)]
struct ConnectorTosResponse {
    #[serde(default)]
    personalization_default: Option<String>,
    #[serde(default)]
    personalization_toggle_blurb: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorLinkToolSettingsResponse {
    #[serde(default)]
    personalized: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorLinkResponse {
    #[serde(default)]
    tool_settings: Option<ConnectorLinkToolSettingsResponse>,
}

#[derive(Debug, Clone, Deserialize)]
struct ConnectorLinkEnvelope {
    #[serde(default)]
    link: Option<ConnectorLinkResponse>,
}

pub async fn read_personalization_disabled_connector_app_ids(
    apps: &[&AppInfo],
) -> Result<HashSet<String>, String> {
    let connector_app_ids = apps
        .iter()
        .map(|app| app.id.as_str())
        .filter(|app_id| app_id.starts_with(CONNECTOR_PREFIX))
        .map(str::to_string)
        .collect::<Vec<_>>();
    if connector_app_ids.is_empty() {
        return Ok(HashSet::new());
    }

    let client = ConnectorPersonalizationClient::load().await?;
    let Some(auth) = client.read_current_chatgpt_auth().await? else {
        return Err(
            "ambient connector personalization requires an active ChatGPT login".to_string(),
        );
    };

    let mut disabled = HashSet::new();
    for connector_app_id in connector_app_ids {
        match client
            .connector_personalization_disabled(&auth, &connector_app_id)
            .await
        {
            Ok(true) => {
                disabled.insert(connector_app_id);
            }
            Ok(false) => {}
            Err(_) => {
                disabled.insert(connector_app_id);
            }
        }
    }
    Ok(disabled)
}

struct ConnectorPersonalizationClient {
    http: reqwest::Client,
    api_base_url: String,
}

impl ConnectorPersonalizationClient {
    async fn load() -> Result<Self, String> {
        let http = build_reqwest_client_with_custom_ca(with_chatgpt_cloudflare_cookie_store(
            reqwest::Client::builder(),
        ))
        .map_err(|err| {
            format!("failed to build ambient connector personalization client: {err}")
        })?;
        Ok(Self {
            http,
            api_base_url: connector_api_base_url(),
        })
    }

    async fn read_current_chatgpt_auth(&self) -> Result<Option<CodexAuth>, String> {
        let codex_home = resolve_codex_home()?;
        let auth = CodexAuth::from_auth_storage(
            &codex_home,
            AuthCredentialsStoreMode::Auto,
            Some(&self.api_base_url),
        )
        .await
        .map_err(|err| {
            format!("failed to load ChatGPT auth for ambient connector personalization: {err}")
        })?;
        Ok(auth.filter(CodexAuth::is_chatgpt_auth))
    }

    async fn connector_personalization_disabled(
        &self,
        auth: &CodexAuth,
        connector_app_id: &str,
    ) -> Result<bool, String> {
        let headers = connector_request_headers(auth)?;
        let tos: ConnectorTosResponse = self
            .get_json(
                &format!(
                    "/aip/connectors/{}/tos",
                    percent_encode_path_segment(connector_app_id)
                ),
                headers.clone(),
            )
            .await?;
        if tos.personalization_toggle_blurb.is_none() {
            return Ok(false);
        }
        let link: ConnectorLinkEnvelope = self
            .get_json(
                &format!(
                    "/aip/connectors/{}/link",
                    percent_encode_path_segment(connector_app_id)
                ),
                headers,
            )
            .await?;
        let personalized = link
            .link
            .and_then(|value| value.tool_settings)
            .and_then(|value| value.personalized)
            .unwrap_or_else(|| UNSET_PERSONALIZATION.to_string());
        let effective_personalization = if personalized == UNSET_PERSONALIZATION {
            if tos.personalization_default.as_deref() == Some(PERSONALIZE_ALWAYS) {
                PERSONALIZE_ALWAYS
            } else {
                NO_PERSONALIZATION
            }
        } else {
            personalized.as_str()
        };
        Ok(effective_personalization == NO_PERSONALIZATION)
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        headers: HeaderMap,
    ) -> Result<T, String> {
        let url = format!(
            "{}/{}",
            self.api_base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        let response = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|err| format!("failed to GET {url}: {err}"))?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("GET {url} returned status {status}; body: {body}"));
        }
        serde_json::from_str(&body)
            .map_err(|err| format!("GET {url} response did not match expected shape: {err}"))
    }
}

fn connector_request_headers(auth: &CodexAuth) -> Result<HeaderMap, String> {
    let token = auth
        .get_token()
        .map_err(|err| format!("failed to read ChatGPT access token: {err}"))?;
    let mut headers = HeaderMap::new();
    let auth_header = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|err| format!("failed to encode ambient connector auth header: {err}"))?;
    headers.insert(AUTHORIZATION, auth_header);
    headers.insert(
        HeaderName::from_bytes(b"originator").map_err(|err| {
            format!("failed to encode ambient connector originator header name: {err}")
        })?,
        HeaderValue::from_str(&connector_originator()).map_err(|err| {
            format!("failed to encode ambient connector originator header: {err}")
        })?,
    );
    headers.insert(
        HeaderName::from_bytes(b"OAI-Product-Sku")
            .map_err(|err| format!("failed to encode ambient connector sku header name: {err}"))?,
        HeaderValue::from_static(CONNECTOR_SETTING_SKU),
    );
    if let Some(account_id) = auth.get_account_id() {
        let header_name =
            HeaderName::from_bytes(CONNECTOR_ACCOUNT_ID_HEADER.as_bytes()).map_err(|err| {
                format!("failed to encode ambient connector account header name: {err}")
            })?;
        let header_value = HeaderValue::from_str(&account_id)
            .map_err(|err| format!("failed to encode ambient connector account header: {err}"))?;
        headers.insert(header_name, header_value);
    }
    Ok(headers)
}

fn connector_originator() -> String {
    std::env::var("CODEX_INTERNAL_ORIGINATOR_OVERRIDE")
        .unwrap_or_else(|_| "Codex Desktop".to_string())
}

fn connector_api_base_url() -> String {
    let api_base_url = std::env::var("CODEX_API_BASE_URL").ok();
    let api_endpoint = std::env::var("CODEX_API_ENDPOINT").ok();
    connector_api_base_url_from_env(api_base_url.as_deref(), api_endpoint.as_deref())
}

fn connector_api_base_url_from_env(
    api_base_url: Option<&str>,
    api_endpoint: Option<&str>,
) -> String {
    if let Some(api_base_url) = api_base_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return api_base_url.trim_end_matches('/').to_string();
    }
    if api_endpoint
        .map(str::trim)
        .is_some_and(|value| value.eq_ignore_ascii_case("localhost"))
    {
        return LOCALHOST_CHATGPT_BACKEND_BASE_URL.to_string();
    }
    DEFAULT_CHATGPT_BACKEND_BASE_URL.to_string()
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

#[cfg(test)]
mod tests {
    use super::connector_api_base_url_from_env;
    use super::percent_encode_path_segment;

    #[test]
    fn api_base_url_prefers_explicit_override() {
        assert_eq!(
            connector_api_base_url_from_env(Some(" https://example.com/root/ "), Some("localhost")),
            "https://example.com/root"
        );
    }

    #[test]
    fn api_base_url_uses_localhost_endpoint_override() {
        assert_eq!(
            connector_api_base_url_from_env(None, Some("LOCALHOST")),
            "http://localhost:8000/api"
        );
    }

    #[test]
    fn api_base_url_defaults_to_chatgpt_backend() {
        assert_eq!(
            connector_api_base_url_from_env(None, Some("production")),
            "https://chatgpt.com/backend-api"
        );
    }

    #[test]
    fn connector_path_segment_is_percent_encoded() {
        assert_eq!(
            percent_encode_path_segment("connector_google calendar/x"),
            "connector_google%20calendar%2Fx"
        );
    }
}
