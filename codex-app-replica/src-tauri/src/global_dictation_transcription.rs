//! Global dictation transcription owner.
//!
//! The extracted `/global-dictation` renderer uploads recorded audio to
//! `POST /transcribe` and optionally runs a transcript cleanup pass against
//! `POST /codex/responses`. The replica keeps that flow page-local with one
//! Tauri command that performs raw transcription and, when requested, a
//! best-effort cleanup pass using the same authenticated ChatGPT backend
//! pattern already used by other desktop owners.

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
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";
const DEFAULT_AUDIO_CONTENT_TYPE: &str = "audio/webm";
const DICTATION_CLEANUP_MODEL: &str = "gpt-5.4-mini";
const DICTATION_CLEANUP_PROMPT: &str = "Clean up dictation transcripts. Fix likely speech recognition mistakes, punctuation, capitalization, and formatting. Remove filler words and disfluencies when they do not add meaning. When the user clearly self-corrects or backtracks, keep the corrected intent. Use surrounding text only as context. Dictionary entries are canonical spellings, names, file paths, and code symbols; when the transcript likely refers to one, copy the dictionary entry exactly, including casing and punctuation. Preserve the user's meaning, wording, and flow unless a small cleanup makes the transcript more coherent. Do not answer the user or add new content. Return only the cleaned transcript.";
const DICTATION_DICTIONARY_KEY: &str = "dictationDictionary";
const MAX_DICTIONARY_ENTRIES: usize = 100;
const MAX_SURROUNDING_TEXT_CHARS: usize = 2_000;
const MAX_TRANSCRIPT_CHARS: usize = 4_000;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationTranscribeAudioParams {
    pub audio_bytes: Vec<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(default)]
    pub cleanup_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub surrounding_text: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalDictationTranscribeAudioResponse {
    pub text: String,
}

#[tauri::command(rename = "global-dictation-transcribe-audio")]
pub async fn global_dictation_transcribe_audio(
    app: AppHandle,
    params: GlobalDictationTranscribeAudioParams,
) -> Result<GlobalDictationTranscribeAudioResponse, String> {
    DictationBackendClient::load()
        .await?
        .transcribe_audio(&app, &params)
        .await
}

struct DictationBackendClient {
    auth_manager: Arc<AuthManager>,
    http: reqwest::Client,
}

impl DictationBackendClient {
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
        .map_err(|err| format!("failed to build global dictation client: {err}"))?;
        Ok(Self { auth_manager, http })
    }

    async fn transcribe_audio(
        &self,
        app: &AppHandle,
        params: &GlobalDictationTranscribeAudioParams,
    ) -> Result<GlobalDictationTranscribeAudioResponse, String> {
        let transcript = self
            .transcribe_audio_with_retry(params)
            .await
            .map_err(|err| err.to_transcription_error())?;
        let transcript = transcript.trim().to_string();
        if transcript.is_empty() || !params.cleanup_enabled {
            return Ok(GlobalDictationTranscribeAudioResponse { text: transcript });
        }

        let text = self
            .cleanup_transcript(app, &transcript, params.surrounding_text.as_deref())
            .await
            .unwrap_or_else(|_| transcript.clone());
        Ok(GlobalDictationTranscribeAudioResponse { text })
    }

    async fn transcribe_audio_with_retry(
        &self,
        params: &GlobalDictationTranscribeAudioParams,
    ) -> Result<String, RequestFailure> {
        match self.send_transcribe_request(params).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await.map_err(RequestFailure::other)?;
                self.send_transcribe_request(params).await
            }
            Err(error) => Err(error),
        }
    }

    async fn send_transcribe_request(
        &self,
        params: &GlobalDictationTranscribeAudioParams,
    ) -> Result<String, RequestFailure> {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let mut headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        let content_type = normalized_content_type(params.content_type.as_deref());
        let boundary = build_boundary();
        let body = build_transcribe_body(
            &params.audio_bytes,
            &boundary,
            &default_filename_for_content_type(content_type),
            content_type,
        );
        let multipart_content_type = HeaderValue::from_str(&format!(
            "multipart/form-data; boundary={boundary}"
        ))
        .map_err(|err| {
            RequestFailure::other(format!(
                "failed to encode global dictation multipart content type: {err}"
            ))
        })?;
        headers.insert(CONTENT_TYPE, multipart_content_type);
        let url = format!("{CHATGPT_BACKEND_BASE_URL}/transcribe");
        let response = self
            .http
            .post(&url)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|err| RequestFailure::network("POST", &url, err))?;
        let status = response.status();
        let response_content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let response_body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure::http(
                "POST",
                &url,
                status,
                &response_content_type,
                &response_body,
            ));
        }

        let response: TranscribeBackendResponse =
            serde_json::from_str(&response_body).map_err(|err| {
                RequestFailure::decode("POST", &url, &response_content_type, &response_body, err)
            })?;
        Ok(response.body.text)
    }

    async fn cleanup_transcript(
        &self,
        app: &AppHandle,
        transcript: &str,
        surrounding_text: Option<&str>,
    ) -> Result<String, String> {
        let dictionary = read_dictation_dictionary(app)?;
        let request = serde_json::json!({
            "model": DICTATION_CLEANUP_MODEL,
            "instructions": DICTATION_CLEANUP_PROMPT,
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": build_cleanup_input(transcript, surrounding_text, &dictionary),
                        }
                    ],
                }
            ],
            "tools": [],
            "tool_choice": "none",
            "parallel_tool_calls": false,
            "reasoning": { "effort": "low" },
            "store": false,
            "stream": false,
            "include": [],
        });
        let response: ResponsesBackendResponse = self
            .post_json_with_retry("/codex/responses", &request)
            .await?;
        Ok(extract_response_text(&response).unwrap_or_else(|| transcript.to_string()))
    }

    async fn post_json_with_retry<T>(&self, path: &str, body: &Value) -> Result<T, String>
    where
        T: for<'de> Deserialize<'de>,
    {
        match self.post_json_once(path, body).await {
            Ok(response) => Ok(response),
            Err(error) if error.status == Some(StatusCode::UNAUTHORIZED) => {
                self.refresh_auth().await?;
                self.post_json_once(path, body)
                    .await
                    .map_err(|err| err.message)
            }
            Err(error) => Err(error.message),
        }
    }

    async fn post_json_once<T>(&self, path: &str, body: &Value) -> Result<T, RequestFailure>
    where
        T: for<'de> Deserialize<'de>,
    {
        let auth = self.current_auth().await.map_err(RequestFailure::other)?;
        let mut headers = self
            .headers_for_auth(&auth)
            .map_err(RequestFailure::other)?;
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        let url = format!("{CHATGPT_BACKEND_BASE_URL}{path}");
        let response = self
            .http
            .post(&url)
            .headers(headers)
            .json(body)
            .send()
            .await
            .map_err(|err| RequestFailure::network("POST", &url, err))?;
        let status = response.status();
        let response_content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let response_body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RequestFailure::http(
                "POST",
                &url,
                status,
                &response_content_type,
                &response_body,
            ));
        }

        serde_json::from_str(&response_body).map_err(|err| {
            RequestFailure::decode("POST", &url, &response_content_type, &response_body, err)
        })
    }

    async fn current_auth(&self) -> Result<CodexAuth, String> {
        let auth = self
            .auth_manager
            .auth()
            .await
            .ok_or_else(|| "global dictation requires an active ChatGPT login".to_string())?;
        if !auth.is_chatgpt_auth() {
            return Err("global dictation requires ChatGPT token auth".to_string());
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
            .map_err(|err| format!("failed to encode global dictation auth header: {err}"))?;
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
            .map_err(|err| format!("failed to refresh ChatGPT auth for global dictation: {err}"))
    }
}

#[derive(Debug, Clone, Deserialize)]
struct TranscribeBackendResponse {
    body: TranscribeBackendBody,
}

#[derive(Debug, Clone, Deserialize)]
struct TranscribeBackendBody {
    text: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ResponsesBackendResponse {
    #[serde(default)]
    output: Vec<ResponsesBackendOutputItem>,
}

#[derive(Debug, Clone, Deserialize)]
struct ResponsesBackendOutputItem {
    #[serde(default)]
    content: Vec<ResponsesBackendContentItem>,
}

#[derive(Debug, Clone, Deserialize)]
struct ResponsesBackendContentItem {
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiErrorEnvelope {
    detail: ApiErrorDetail,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum ApiErrorDetail {
    MessageString(String),
    MessageObject {
        message: String,
        #[serde(default, rename = "type")]
        _type: Option<String>,
    },
    ErrorObject {
        #[serde(default)]
        _error_code: Option<String>,
        message: String,
        #[serde(default, rename = "type")]
        _type: Option<String>,
    },
}

#[derive(Debug)]
struct RequestFailure {
    api_message: Option<String>,
    is_network: bool,
    message: String,
    status: Option<StatusCode>,
}

impl RequestFailure {
    fn http(method: &str, url: &str, status: StatusCode, content_type: &str, body: &str) -> Self {
        Self {
            api_message: parse_api_error_message(body),
            is_network: false,
            message: format!(
                "{method} {url} failed: {status}; content-type={content_type}; body={body}"
            ),
            status: Some(status),
        }
    }

    fn network(method: &str, url: &str, error: reqwest::Error) -> Self {
        Self {
            api_message: None,
            is_network: true,
            message: format!("{method} {url} failed: {error}"),
            status: error.status(),
        }
    }

    fn decode(
        method: &str,
        url: &str,
        content_type: &str,
        body: &str,
        error: serde_json::Error,
    ) -> Self {
        Self {
            api_message: None,
            is_network: false,
            message: format!(
                "failed to decode {method} {url} response: {error}; content-type={content_type}; body={body}"
            ),
            status: None,
        }
    }

    fn other(message: String) -> Self {
        Self {
            api_message: None,
            is_network: false,
            message,
            status: None,
        }
    }

    fn to_transcription_error(&self) -> String {
        if self.status == Some(StatusCode::TOO_MANY_REQUESTS) {
            let message = self
                .api_message
                .clone()
                .unwrap_or_else(|| "Too many transcription requests".to_string());
            return format!("rate_limit:{message}");
        }

        if self.is_network {
            return format!("network:{}", self.message);
        }

        format!("transcribe:{}", self.message)
    }
}

fn build_boundary() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("----codex-transcribe-{now}")
}

fn normalized_content_type(content_type: Option<&str>) -> &str {
    let Some(content_type) = content_type.map(str::trim) else {
        return DEFAULT_AUDIO_CONTENT_TYPE;
    };

    if content_type.is_empty() {
        DEFAULT_AUDIO_CONTENT_TYPE
    } else {
        content_type
    }
}

fn default_filename_for_content_type(content_type: &str) -> String {
    let extension = content_type
        .split(['/', ';'])
        .nth(1)
        .filter(|value| !value.is_empty())
        .unwrap_or("webm");
    format!("codex.{}", sanitize_filename(extension))
}

fn sanitize_filename(value: &str) -> String {
    value.replace('"', "")
}

fn build_transcribe_body(
    audio_bytes: &[u8],
    boundary: &str,
    filename: &str,
    content_type: &str,
) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\n",
            sanitize_filename(filename)
        )
        .as_bytes(),
    );
    body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
    body.extend_from_slice(audio_bytes);
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    body
}

fn build_cleanup_input(
    transcript: &str,
    surrounding_text: Option<&str>,
    dictionary: &[String],
) -> String {
    let mut input = String::new();
    if let Some(surrounding_text) = surrounding_text
        .map(str::trim)
        .filter(|text| !text.is_empty())
    {
        input.push_str("Surrounding text:\n");
        input.push_str(&truncate_chars(
            surrounding_text,
            MAX_SURROUNDING_TEXT_CHARS,
        ));
        input.push_str("\n\n");
    }

    input.push_str(
        "Dictionary (canonical entries; use exact spelling, casing, and punctuation when they match):\n",
    );
    if dictionary.is_empty() {
        input.push_str("(none)");
    } else {
        input.push_str(&dictionary.join("\n"));
    }
    input.push_str("\n\nTranscript:\n");
    input.push_str(&truncate_chars(transcript, MAX_TRANSCRIPT_CHARS));
    input
}

fn extract_response_text(response: &ResponsesBackendResponse) -> Option<String> {
    let text = response
        .output
        .iter()
        .flat_map(|item| item.content.iter())
        .filter_map(|content| content.text.as_deref())
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn parse_api_error_message(body: &str) -> Option<String> {
    let envelope: ApiErrorEnvelope = serde_json::from_str(body).ok()?;
    match envelope.detail {
        ApiErrorDetail::MessageString(message)
        | ApiErrorDetail::MessageObject { message, .. }
        | ApiErrorDetail::ErrorObject { message, .. } => {
            let trimmed = message.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
    }
}

fn read_dictation_dictionary(app: &AppHandle) -> Result<Vec<String>, String> {
    let settings = read_global_settings(app)?;
    Ok(parse_dictation_dictionary(
        settings.get(DICTATION_DICTIONARY_KEY),
    ))
}

fn parse_dictation_dictionary(value: Option<&Value>) -> Vec<String> {
    let Some(Value::Array(entries)) = value else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .take(MAX_DICTIONARY_ENTRIES)
        .map(ToOwned::to_owned)
        .collect()
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_filename_tracks_content_type_extension() {
        assert_eq!(
            default_filename_for_content_type("audio/webm"),
            "codex.webm"
        );
        assert_eq!(
            default_filename_for_content_type("audio/mp4; codecs=mp4a"),
            "codex.mp4"
        );
    }

    #[test]
    fn parse_api_error_message_supports_string_and_object_details() {
        assert_eq!(
            parse_api_error_message(r#"{"detail":"Too many requests"}"#),
            Some("Too many requests".to_string())
        );
        assert_eq!(
            parse_api_error_message(r#"{"detail":{"message":"Rate limit","type":"limit"}}"#),
            Some("Rate limit".to_string())
        );
        assert_eq!(
            parse_api_error_message(
                r#"{"detail":{"error_code":"limit","message":"Slow down","type":"rate_limit"}}"#
            ),
            Some("Slow down".to_string())
        );
    }

    #[test]
    fn parse_dictation_dictionary_filters_and_caps_entries() {
        let entries =
            parse_dictation_dictionary(Some(&serde_json::json!(["  Alpha  ", "", null, "Beta"])));
        assert_eq!(entries, vec!["Alpha".to_string(), "Beta".to_string()]);
    }

    #[test]
    fn build_cleanup_input_matches_upstream_shape() {
        let value = build_cleanup_input(
            "Transcript text",
            Some("Context text"),
            &["alpha".to_string(), "beta".to_string()],
        );
        assert!(value.contains("Surrounding text:\nContext text"));
        assert!(value.contains(
            "Dictionary (canonical entries; use exact spelling, casing, and punctuation when they match):\nalpha\nbeta"
        ));
        assert!(value.ends_with("Transcript:\nTranscript text"));
    }

    #[test]
    fn request_failure_maps_rate_limit_and_network_prefixes() {
        let rate_limit = RequestFailure {
            api_message: Some("Too many requests".to_string()),
            is_network: false,
            message: "raw".to_string(),
            status: Some(StatusCode::TOO_MANY_REQUESTS),
        };
        assert_eq!(
            rate_limit.to_transcription_error(),
            "rate_limit:Too many requests"
        );

        let network = RequestFailure {
            api_message: None,
            is_network: true,
            message: "offline".to_string(),
            status: None,
        };
        assert_eq!(network.to_transcription_error(), "network:offline");
    }
}
