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
use std::collections::HashMap;
use std::sync::Arc;

use crate::codex_home::resolve_codex_home;

const ACCOUNT_CHECK_VERSION: &str = "v4-2023-04-27";
const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsageAutoTopUpWriteParams {
    pub recharge_threshold: String,
    pub recharge_target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsageAutoTopUpSettingsResponse {
    pub is_enabled: bool,
    pub recharge_threshold: Option<String>,
    pub recharge_target: Option<String>,
    pub immediate_top_up_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsageBillingCurrencyResponse {
    pub billing_currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsagePricingReadParams {
    pub billing_currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsagePricingResponse {
    pub amount_per_credit: f64,
    pub currency_code: String,
    pub minor_unit_exponent: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsageCustomerPortalResponse {
    pub url: String,
}

#[derive(Debug)]
struct UsageBillingClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

#[derive(Debug)]
struct RequestFailure {
    message: String,
    status: Option<StatusCode>,
}

#[derive(Debug, Clone, Serialize)]
struct AutoTopUpWriteRequest<'a> {
    recharge_threshold: &'a str,
    recharge_target: &'a str,
}

#[derive(Debug, Clone, Deserialize)]
struct AutoTopUpBackendResponse {
    is_enabled: bool,
    recharge_threshold: Option<String>,
    recharge_target: Option<String>,
    immediate_top_up_status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct CustomerPortalBackendResponse {
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AccountCheckBackendResponse {
    accounts: Option<HashMap<String, AccountCheckAccount>>,
}

#[derive(Debug, Clone, Deserialize)]
struct AccountCheckAccount {
    entitlement: Option<AccountEntitlement>,
}

#[derive(Debug, Clone, Deserialize)]
struct AccountEntitlement {
    billing_currency: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct CheckoutPricingBackendResponse {
    currency_config: Option<CheckoutCurrencyConfig>,
}

#[derive(Debug, Clone, Deserialize)]
struct CheckoutCurrencyConfig {
    amount_per_credit: Option<f64>,
    symbol_code: Option<String>,
    minor_unit_exponent: Option<i64>,
}

impl RequestFailure {
    fn from_http_error(method: &str, url: &str, error: reqwest::Error) -> Self {
        Self {
            message: format!("{method} {url} failed: {error}"),
            status: error.status(),
        }
    }

    fn unauthorized(
        method: &str,
        url: &str,
        status: StatusCode,
        content_type: &str,
        body: &str,
    ) -> Self {
        Self {
            message: format!(
                "{method} {url} failed: {status}; content-type={content_type}; body={body}"
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

impl UsageBillingClient {
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
        .map_err(|err| format!("failed to build usage billing client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "usage billing requires an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("usage billing requires ChatGPT token auth".to_string());
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
            .map_err(|err| format!("failed to encode usage billing auth header: {err}"))?;
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
            .map_err(|err| format!("failed to refresh ChatGPT auth for usage billing: {err}"))
    }

    async fn get_json<T>(&self, path: &str) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        self.send_json_with_retry(path, |client, url, headers| {
            client.get(url).headers(headers)
        })
        .await
    }

    async fn post_json<T, B>(&self, path: &str, body: &B) -> Result<T, String>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        self.send_json_with_retry(path, |client, url, headers| {
            client
                .post(url)
                .headers(headers)
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .json(body)
        })
        .await
    }

    async fn post_empty<T>(&self, path: &str) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        self.send_json_with_retry(path, |client, url, headers| {
            client.post(url).headers(headers)
        })
        .await
    }

    async fn send_json_with_retry<T, F>(&self, path: &str, build_request: F) -> Result<T, String>
    where
        T: DeserializeOwned,
        F: Fn(&reqwest::Client, &str, HeaderMap) -> reqwest::RequestBuilder,
    {
        match self.send_json_once(path, &build_request).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.send_json_once(path, &build_request)
                    .await
                    .map_err(|error| error.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn send_json_once<T, F>(&self, path: &str, build_request: &F) -> Result<T, RequestFailure>
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
            .map_err(|error| RequestFailure::from_http_error("request", &url, error))?;
        let status = response.status();
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure::unauthorized(
                "request",
                &url,
                status,
                &content_type,
                &body,
            ));
        }
        serde_json::from_str(&body).map_err(|error| {
            RequestFailure::from_decode_error("request", &url, &content_type, &body, error)
        })
    }

    async fn read_auto_top_up_settings(&self) -> Result<UsageAutoTopUpSettingsResponse, String> {
        self.get_json::<AutoTopUpBackendResponse>("/subscriptions/auto_top_up/settings")
            .await
            .map(Into::into)
    }

    async fn enable_auto_top_up(
        &self,
        params: &UsageAutoTopUpWriteParams,
    ) -> Result<UsageAutoTopUpSettingsResponse, String> {
        let request = AutoTopUpWriteRequest {
            recharge_threshold: params.recharge_threshold.as_str(),
            recharge_target: params.recharge_target.as_str(),
        };
        self.post_json::<AutoTopUpBackendResponse, _>("/subscriptions/auto_top_up/enable", &request)
            .await
            .map(Into::into)
    }

    async fn update_auto_top_up(
        &self,
        params: &UsageAutoTopUpWriteParams,
    ) -> Result<UsageAutoTopUpSettingsResponse, String> {
        let request = AutoTopUpWriteRequest {
            recharge_threshold: params.recharge_threshold.as_str(),
            recharge_target: params.recharge_target.as_str(),
        };
        self.post_json::<AutoTopUpBackendResponse, _>("/subscriptions/auto_top_up/update", &request)
            .await
            .map(Into::into)
    }

    async fn disable_auto_top_up(&self) -> Result<UsageAutoTopUpSettingsResponse, String> {
        self.post_empty::<AutoTopUpBackendResponse>("/subscriptions/auto_top_up/disable")
            .await
            .map(Into::into)
    }

    async fn read_billing_currency(&self) -> Result<UsageBillingCurrencyResponse, String> {
        let auth = self.current_auth().await?;
        let account_id = auth
            .get_account_id()
            .ok_or_else(|| "usage billing requires a ChatGPT account id".to_string())?;
        let response = self
            .get_json::<AccountCheckBackendResponse>(&format!(
                "/accounts/check/{ACCOUNT_CHECK_VERSION}"
            ))
            .await?;
        Ok(UsageBillingCurrencyResponse {
            billing_currency: response
                .accounts
                .and_then(|accounts| accounts.get(&account_id).cloned())
                .and_then(|account| account.entitlement)
                .and_then(|entitlement| entitlement.billing_currency),
        })
    }

    async fn read_pricing(
        &self,
        params: &UsagePricingReadParams,
    ) -> Result<Option<UsagePricingResponse>, String> {
        let response = self
            .get_json::<CheckoutPricingBackendResponse>(&format!(
                "/checkout_pricing_config/configs/{}",
                params.billing_currency
            ))
            .await?;
        let Some(currency_config) = response.currency_config else {
            return Ok(None);
        };
        let Some(amount_per_credit) = currency_config.amount_per_credit else {
            return Ok(None);
        };
        if amount_per_credit <= 0.0 {
            return Ok(None);
        }
        Ok(Some(UsagePricingResponse {
            amount_per_credit,
            currency_code: currency_config
                .symbol_code
                .unwrap_or_else(|| params.billing_currency.clone()),
            minor_unit_exponent: currency_config.minor_unit_exponent,
        }))
    }

    async fn read_customer_portal(&self) -> Result<UsageCustomerPortalResponse, String> {
        self.get_json::<CustomerPortalBackendResponse>("/payments/customer_portal")
            .await
            .map(|response| UsageCustomerPortalResponse { url: response.url })
    }
}

impl From<AutoTopUpBackendResponse> for UsageAutoTopUpSettingsResponse {
    fn from(response: AutoTopUpBackendResponse) -> Self {
        Self {
            is_enabled: response.is_enabled,
            recharge_threshold: response.recharge_threshold,
            recharge_target: response.recharge_target,
            immediate_top_up_status: response.immediate_top_up_status,
        }
    }
}

#[tauri::command]
pub async fn read_usage_auto_top_up_settings() -> Result<UsageAutoTopUpSettingsResponse, String> {
    UsageBillingClient::load()
        .await?
        .read_auto_top_up_settings()
        .await
}

#[tauri::command]
pub async fn enable_usage_auto_top_up(
    params: UsageAutoTopUpWriteParams,
) -> Result<UsageAutoTopUpSettingsResponse, String> {
    UsageBillingClient::load()
        .await?
        .enable_auto_top_up(&params)
        .await
}

#[tauri::command]
pub async fn update_usage_auto_top_up(
    params: UsageAutoTopUpWriteParams,
) -> Result<UsageAutoTopUpSettingsResponse, String> {
    UsageBillingClient::load()
        .await?
        .update_auto_top_up(&params)
        .await
}

#[tauri::command]
pub async fn disable_usage_auto_top_up() -> Result<UsageAutoTopUpSettingsResponse, String> {
    UsageBillingClient::load()
        .await?
        .disable_auto_top_up()
        .await
}

#[tauri::command]
pub async fn read_usage_billing_currency() -> Result<UsageBillingCurrencyResponse, String> {
    UsageBillingClient::load()
        .await?
        .read_billing_currency()
        .await
}

#[tauri::command]
pub async fn read_usage_pricing(
    params: UsagePricingReadParams,
) -> Result<Option<UsagePricingResponse>, String> {
    UsageBillingClient::load()
        .await?
        .read_pricing(&params)
        .await
}

#[tauri::command]
pub async fn read_usage_customer_portal() -> Result<UsageCustomerPortalResponse, String> {
    UsageBillingClient::load()
        .await?
        .read_customer_portal()
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_top_up_backend_response_maps_to_frontend_shape() {
        let response = AutoTopUpBackendResponse {
            is_enabled: true,
            recharge_threshold: Some("125".to_string()),
            recharge_target: Some("250".to_string()),
            immediate_top_up_status: Some("failed".to_string()),
        };

        assert_eq!(
            UsageAutoTopUpSettingsResponse::from(response),
            UsageAutoTopUpSettingsResponse {
                is_enabled: true,
                recharge_threshold: Some("125".to_string()),
                recharge_target: Some("250".to_string()),
                immediate_top_up_status: Some("failed".to_string()),
            }
        );
    }

    #[test]
    fn account_check_response_preserves_nested_billing_currency() {
        let response: AccountCheckBackendResponse = serde_json::from_value(serde_json::json!({
            "accounts": {
                "acc_123": {
                    "entitlement": {
                        "billing_currency": "USD"
                    }
                }
            }
        }))
        .expect("account check response should deserialize");

        assert_eq!(
            response
                .accounts
                .and_then(|accounts| accounts.get("acc_123").cloned())
                .and_then(|account| account.entitlement)
                .and_then(|entitlement| entitlement.billing_currency),
            Some("USD".to_string())
        );
    }

    #[test]
    fn checkout_pricing_response_handles_missing_currency_config() {
        let response: CheckoutPricingBackendResponse = serde_json::from_value(serde_json::json!({
            "currency_config": null
        }))
        .expect("pricing response should deserialize");

        assert!(response.currency_config.is_none());
    }
}
