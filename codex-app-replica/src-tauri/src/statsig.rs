use codex_client::build_reqwest_client_with_custom_ca;
use codex_client::with_chatgpt_cloudflare_cookie_store;
use reqwest::header::CONTENT_TYPE;
use reqwest::header::USER_AGENT;
use serde::Deserialize;
use serde_json::Value;
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

#[cfg(test)]
mod tests {
    use super::StatsigFetchValuesParams;

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
}
