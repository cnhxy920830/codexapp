use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use codex_client::build_reqwest_client_with_custom_ca;
use codex_client::with_chatgpt_cloudflare_cookie_store;
use reqwest::header::HeaderMap;
use reqwest::header::HeaderName;
use reqwest::header::HeaderValue;
use reqwest::header::CONTENT_TYPE;
use reqwest::header::USER_AGENT;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::OnceLock;
use std::time::Duration;

const STATSIG_SDK_KEY: &str = "client-sYWqzCYMRkUg4DqqiZcR5DGTNl2iD7zNJY0HoeDLzxR";
const STATSIG_INITIALIZE_URL: &str = "https://ab.chatgpt.com/v1/initialize";
const STATSIG_USER_AGENT: &str = "CodexAppReplica/0.0.0";

static STATSIG_HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

#[derive(Debug, Deserialize, PartialEq)]
pub struct StatsigFetchValuesParams {
    pub body: Value,
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsigRequestParams {
    pub url: String,
    pub method: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body_base64: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsigRequestResponse {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body_base64: String,
}

#[tauri::command(rename = "statsig-fetch-values")]
pub async fn statsig_fetch_values(params: StatsigFetchValuesParams) -> Result<Value, String> {
    let client = statsig_http_client()?;
    let response = client
        .post(format!(
            "{STATSIG_INITIALIZE_URL}?sinceTime=0&sdkKey={STATSIG_SDK_KEY}"
        ))
        .header(CONTENT_TYPE, "application/json")
        .header(USER_AGENT, STATSIG_USER_AGENT)
        .json(&params.body)
        .send()
        .await
        .map_err(|err| format!("statsig initialize request failed: {err}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_else(|_| String::new());
        return Err(format!(
            "statsig initialize request returned {status}: {body}"
        ));
    }

    response
        .json::<Value>()
        .await
        .map_err(|err| format!("failed to decode statsig initialize response: {err}"))
}

#[tauri::command(rename = "statsig-request")]
pub async fn statsig_request(
    params: StatsigRequestParams,
) -> Result<StatsigRequestResponse, String> {
    let client = statsig_http_client()?;
    let method = reqwest::Method::from_bytes(params.method.as_bytes())
        .map_err(|err| format!("invalid statsig request method '{}': {err}", params.method))?;
    let mut request = client
        .request(method, &params.url)
        .header(USER_AGENT, STATSIG_USER_AGENT);
    if !params.headers.is_empty() {
        request = request.headers(statsig_request_headers(&params.headers)?);
    }
    if let Some(body_base64) = params.body_base64.as_deref() {
        let body = BASE64_STANDARD
            .decode(body_base64)
            .map_err(|err| format!("invalid statsig request body: {err}"))?;
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("statsig request failed: {err}"))?;
    let status = response.status().as_u16();
    let headers = response_headers(response.headers());
    let body = response
        .bytes()
        .await
        .map_err(|err| format!("failed to read statsig response body: {err}"))?;

    Ok(StatsigRequestResponse {
        status,
        headers,
        body_base64: BASE64_STANDARD.encode(body),
    })
}

fn statsig_http_client() -> Result<&'static reqwest::Client, String> {
    match STATSIG_HTTP_CLIENT.get_or_init(|| {
        build_reqwest_client_with_custom_ca(with_chatgpt_cloudflare_cookie_store(
            reqwest::Client::builder().timeout(Duration::from_secs(15)),
        ))
        .map_err(|err| format!("failed to build statsig http client: {err}"))
    }) {
        Ok(client) => Ok(client),
        Err(err) => Err(err.clone()),
    }
}

fn statsig_request_headers(headers: &BTreeMap<String, String>) -> Result<HeaderMap, String> {
    let mut header_map = HeaderMap::new();
    for (name, value) in headers {
        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|err| format!("invalid statsig request header name '{name}': {err}"))?;
        let header_value = HeaderValue::from_str(value)
            .map_err(|err| format!("invalid statsig request header value for '{name}': {err}"))?;
        header_map.insert(header_name, header_value);
    }
    Ok(header_map)
}

fn response_headers(headers: &HeaderMap) -> BTreeMap<String, String> {
    let mut response_headers = BTreeMap::new();
    for (name, value) in headers {
        let Ok(value) = value.to_str() else {
            continue;
        };
        response_headers
            .entry(name.as_str().to_owned())
            .and_modify(|current: &mut String| {
                current.push_str(", ");
                current.push_str(value);
            })
            .or_insert_with(|| value.to_owned());
    }
    response_headers
}

#[cfg(test)]
mod tests {
    use super::StatsigFetchValuesParams;
    use super::StatsigRequestParams;
    use std::collections::BTreeMap;

    #[test]
    fn deserializes_statsig_fetch_values_payload() {
        let payload: StatsigFetchValuesParams = serde_json::from_value(serde_json::json!({
            "body": {
                "user": {
                    "stableID": "stable-id"
                },
                "hash": "djb2",
                "deltasResponseRequested": false,
                "full_checksum": null
            }
        }))
        .expect("statsig-fetch-values payload should deserialize");

        assert_eq!(
            payload.body,
            serde_json::json!({
                "user": {
                    "stableID": "stable-id"
                },
                "hash": "djb2",
                "deltasResponseRequested": false,
                "full_checksum": null
            })
        );
    }

    #[test]
    fn deserializes_statsig_request_payload() {
        let payload: StatsigRequestParams = serde_json::from_value(serde_json::json!({
            "url": "https://chatgpt.com/ces/v1/rgstr",
            "method": "POST",
            "headers": {
                "content-type": "application/json"
            },
            "bodyBase64": "e30="
        }))
        .expect("statsig-request payload should deserialize");

        assert_eq!(payload.url, "https://chatgpt.com/ces/v1/rgstr");
        assert_eq!(payload.method, "POST");
        assert_eq!(
            payload.headers,
            BTreeMap::from([("content-type".to_string(), "application/json".to_string(),)])
        );
        assert_eq!(payload.body_base64, Some("e30=".to_string()));
    }
}
