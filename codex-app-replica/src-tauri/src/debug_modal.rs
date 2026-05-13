//! Debug Modal desktop owners.
//!
//! `P-058` is owned by the extracted debug modal bundles plus the Electron main
//! process request handlers they call into. This replica-side owner restores the
//! desktop boundary the page expects:
//!
//! - `ambient-suggestions-generation-statuses`
//! - `ambient-suggestions`
//! - `ambient-suggestions-refresh`
//! - `ambient-suggestion-set-status`
//! - `debug-run-app-action-request`
//! - `debug-run-app-action-response`

use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use serde_json::Map;
use serde_json::Value;
use sha1::Digest;
use sha1::Sha1;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri::Window;

use crate::auth_bridge::auth_snapshot;
use crate::auth_bridge::build_thread_start_payload_with_overrides;
use crate::auth_bridge::build_turn_start_payload_with_overrides;
use crate::auth_bridge::clear_observed_turn_completion;
use crate::auth_bridge::ensure_supported_host_id;
use crate::auth_bridge::send_request_for_host;
use crate::auth_bridge::start_ephemeral_thread_with_overrides;
use crate::auth_bridge::start_turn_with_payload;
use crate::auth_bridge::take_observed_turn_agent_message;
use crate::auth_bridge::unsubscribe_thread;
use crate::auth_bridge::wait_for_turn_completion;
use crate::auth_bridge::AppServerRequestKind;
use crate::auth_bridge::AuthBridgeState;
use crate::codex_home::resolve_codex_home;
use crate::global_settings::read_global_settings;
use crate::query_cache::emit_query_cache_invalidate;

const DEBUG_WINDOW_LABEL: &str = "debug-window";
const DEBUG_RUN_APP_ACTION_REQUEST_EVENT: &str = "debug-run-app-action-request";
const DEBUG_RUN_APP_ACTION_RESPONSE_EVENT: &str = "debug-run-app-action-response";
const AMBIENT_SUGGESTIONS_DIRECTORY_NAME: &str = "ambient-suggestions";
const AMBIENT_SUGGESTIONS_FILE_NAME: &str = "ambient-suggestions.json";
const AMBIENT_SUGGESTIONS_STALE_TIME_MS: u64 = 300 * 60 * 1000;
const AMBIENT_SUGGESTIONS_PLUS_STALE_TIME_MS: u64 = 1440 * 60 * 1000;
const AMBIENT_SUGGESTIONS_GENERATION_TIMEOUT: Duration = Duration::from_secs(600);
const AMBIENT_SUGGESTIONS_SAFETY_TIMEOUT: Duration = Duration::from_secs(120);
const AMBIENT_SUGGESTIONS_GENERATION_MODEL: &str = "gpt-5.4";
const AMBIENT_SUGGESTIONS_GENERATION_EFFORT: &str = "medium";
const AMBIENT_SUGGESTIONS_FAST_MODEL: &str = "gpt-5.4-mini";
const AMBIENT_SUGGESTIONS_FAST_EFFORT: &str = "low";
const LOCAL_HOST_ID: &str = "local";
const OPENAI_EMAIL_SUFFIX: &str = "@openai.com";

const AMBIENT_SUGGESTIONS_PLUS_PLANS: &[&str] = &[
    "plus",
    "pro",
    "business",
    "team",
    "self_serve_business_usage_based",
];

const AMBIENT_SUGGESTIONS_GENERATION_BASE_INSTRUCTIONS: &str =
    "Generate Codex ambient suggestions. Return only JSON matching the schema.";
const AMBIENT_SUGGESTIONS_SAFETY_BASE_INSTRUCTIONS: &str =
    "Classify Codex ambient suggestion candidates for policy safety. Return only JSON matching the schema.";

#[derive(Debug, Default)]
pub struct AmbientSuggestionsCache {
    inner: Mutex<HashMap<AmbientSuggestionKey, AmbientSuggestionGenerationStatus>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct AmbientSuggestionKey {
    pub project_root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionGenerationStatus {
    pub project_root: String,
    pub running_count: u64,
    pub safety_running_count: u64,
    pub running_started_at_ms: Option<u64>,
    pub safety_started_at_ms: Option<u64>,
    pub last_finished_at_ms: Option<u64>,
}

impl AmbientSuggestionsCache {
    fn snapshot(&self) -> Vec<AmbientSuggestionGenerationStatus> {
        let guard = self
            .inner
            .lock()
            .expect("ambient suggestions cache mutex poisoned");
        let mut entries = guard.values().cloned().collect::<Vec<_>>();
        entries.sort_by(|left, right| left.project_root.cmp(&right.project_root));
        entries
    }

    fn transition_running(&self, project_root: &str) {
        self.replace_status(project_root, |previous| AmbientSuggestionGenerationStatus {
            project_root: project_root.to_string(),
            running_count: 1,
            safety_running_count: 0,
            running_started_at_ms: Some(now_ms()),
            safety_started_at_ms: None,
            last_finished_at_ms: previous.and_then(|status| status.last_finished_at_ms),
        });
    }

    fn transition_safety_running(&self, project_root: &str) {
        self.replace_status(project_root, |previous| AmbientSuggestionGenerationStatus {
            project_root: project_root.to_string(),
            running_count: 0,
            safety_running_count: 1,
            running_started_at_ms: None,
            safety_started_at_ms: Some(now_ms()),
            last_finished_at_ms: previous.and_then(|status| status.last_finished_at_ms),
        });
    }

    fn transition_finished(&self, project_root: &str) {
        self.replace_status(project_root, |_| AmbientSuggestionGenerationStatus {
            project_root: project_root.to_string(),
            running_count: 0,
            safety_running_count: 0,
            running_started_at_ms: None,
            safety_started_at_ms: None,
            last_finished_at_ms: Some(now_ms()),
        });
    }

    fn has_active_run(&self, project_root: &str) -> bool {
        self.inner
            .lock()
            .expect("ambient suggestions cache mutex poisoned")
            .get(&AmbientSuggestionKey {
                project_root: project_root.to_string(),
            })
            .is_some_and(|status| status.running_count > 0 || status.safety_running_count > 0)
    }

    fn replace_status(
        &self,
        project_root: &str,
        build: impl FnOnce(
            Option<&AmbientSuggestionGenerationStatus>,
        ) -> AmbientSuggestionGenerationStatus,
    ) {
        let key = AmbientSuggestionKey {
            project_root: project_root.to_string(),
        };
        let mut guard = self
            .inner
            .lock()
            .expect("ambient suggestions cache mutex poisoned");
        let next = build(guard.get(&key));
        guard.insert(key, next);
    }
}

#[derive(Debug, Default)]
pub struct DebugActionRequestSources {
    inner: Mutex<HashMap<String, String>>,
}

impl DebugActionRequestSources {
    fn record(&self, request_id: &str, source_label: &str) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|err| err.to_string())?;
        guard.insert(request_id.to_string(), source_label.to_string());
        Ok(())
    }

    fn take(&self, request_id: &str) -> Result<Option<String>, String> {
        let mut guard = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(guard.remove(request_id))
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionsStatusesResponse {
    pub statuses: Vec<AmbientSuggestionGenerationStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionRecord {
    pub id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub app_ids: Vec<String>,
    pub status: AmbientSuggestionRecordStatus,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AmbientSuggestionRecordStatus {
    Pending,
    Accepted,
    Dismissed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionsFile {
    pub project_root: String,
    pub generated_at_ms: Option<u64>,
    pub current_suggestion_ids: Vec<String>,
    pub suggestions: Vec<AmbientSuggestionRecord>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionsReadResponse {
    pub file: AmbientSuggestionsFile,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionSetStatusResponse {
    pub file: AmbientSuggestionsFile,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionsParams {
    pub host_id: Option<String>,
    pub project_root: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionsRefreshParams {
    pub host_id: Option<String>,
    pub project_root: String,
    pub mode: Option<AmbientSuggestionsRefreshMode>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AmbientSuggestionsRefreshMode {
    Default,
    FirstPluginConnect,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionSetStatusParams {
    pub host_id: Option<String>,
    pub project_root: String,
    pub suggestion_id: String,
    pub status: AmbientSuggestionRecordStatus,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugRunAppActionRequestParams {
    pub request_id: String,
    pub action: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct DebugRunAppActionRequestEvent {
    request_id: String,
    source_window_label: String,
    action: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_thread_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugRunAppActionResponseParams {
    pub request_id: String,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadListResponse {
    data: Vec<ThreadListItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadListItem {
    id: String,
    preview: String,
    updated_at: i64,
    cwd: String,
    name: Option<String>,
    #[serde(default)]
    ephemeral: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AmbientSuggestionsPromptThread {
    id: String,
    title: String,
    preview: String,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedAmbientSuggestionCandidate {
    title: String,
    description: String,
    prompt: String,
    app_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedAmbientSuggestionsResult {
    suggestions: Vec<GeneratedAmbientSuggestionCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AmbientSuggestionSafetyExcludeItem {
    id: String,
    reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AmbientSuggestionSafetyResult {
    exclude: Vec<AmbientSuggestionSafetyExcludeItem>,
}

#[tauri::command(rename = "ambient-suggestions-generation-statuses")]
pub fn ambient_suggestions_generation_statuses(
    cache: State<'_, AmbientSuggestionsCache>,
) -> Result<AmbientSuggestionsStatusesResponse, String> {
    Ok(AmbientSuggestionsStatusesResponse {
        statuses: cache.snapshot(),
    })
}

#[tauri::command(rename = "ambient-suggestions")]
pub fn ambient_suggestions(
    app: AppHandle,
    params: AmbientSuggestionsParams,
) -> Result<AmbientSuggestionsReadResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "ambient-suggestions")?;
    Ok(AmbientSuggestionsReadResponse {
        file: read_ambient_suggestions_file(&app, &params.project_root)?,
    })
}

#[tauri::command(rename = "ambient-suggestion-set-status")]
pub fn ambient_suggestion_set_status(
    app: AppHandle,
    params: AmbientSuggestionSetStatusParams,
) -> Result<AmbientSuggestionSetStatusResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "ambient-suggestion-set-status")?;
    let updated = set_ambient_suggestion_status(
        &app,
        &params.project_root,
        &params.suggestion_id,
        params.status,
    )?;
    invalidate_ambient_suggestions_queries(&app);
    Ok(AmbientSuggestionSetStatusResponse { file: updated })
}

#[tauri::command(rename = "ambient-suggestions-refresh")]
pub async fn ambient_suggestions_refresh(
    app: AppHandle,
    state: State<'_, Arc<AuthBridgeState>>,
    cache: State<'_, AmbientSuggestionsCache>,
    params: AmbientSuggestionsRefreshParams,
) -> Result<AmbientSuggestionsReadResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "ambient-suggestions-refresh")?;
    let project_root = params.project_root.trim().to_string();
    if project_root.is_empty() {
        return Ok(AmbientSuggestionsReadResponse {
            file: default_ambient_suggestions_file(""),
        });
    }

    let enabled = ambient_suggestions_enabled(&app)?;
    let existing = read_ambient_suggestions_file(&app, &project_root)?;
    let mode = params
        .mode
        .unwrap_or(AmbientSuggestionsRefreshMode::Default);
    let stale_time_ms = ambient_suggestions_stale_time_ms(&state);
    if !enabled {
        return Ok(AmbientSuggestionsReadResponse { file: existing });
    }
    if matches!(mode, AmbientSuggestionsRefreshMode::Default)
        && is_file_fresh(&existing, stale_time_ms)
    {
        return Ok(AmbientSuggestionsReadResponse { file: existing });
    }
    if cache.has_active_run(&project_root) {
        return Ok(AmbientSuggestionsReadResponse { file: existing });
    }

    cache.transition_running(&project_root);
    let refresh_result = refresh_ambient_suggestions_inner(
        &app,
        state.inner(),
        &cache,
        params.host_id.as_deref(),
        &project_root,
        &existing,
        &mode,
    )
    .await;
    cache.transition_finished(&project_root);

    let file = refresh_result?;
    invalidate_ambient_suggestions_queries(&app);
    Ok(AmbientSuggestionsReadResponse { file })
}

#[tauri::command(rename = "debug-run-app-action-request")]
pub fn debug_run_app_action_request(
    app: AppHandle,
    window: Window,
    sources: State<'_, DebugActionRequestSources>,
    params: DebugRunAppActionRequestParams,
) -> Result<(), String> {
    let source_label = window.label().to_string();
    let target_label = resolve_request_target(&app, &source_label);

    sources.record(&params.request_id, &source_label)?;

    let event = DebugRunAppActionRequestEvent {
        request_id: params.request_id,
        source_window_label: source_label,
        action: params.action,
        source_thread_id: params.source_thread_id,
    };

    app.emit_to(
        target_label.as_str(),
        DEBUG_RUN_APP_ACTION_REQUEST_EVENT,
        event,
    )
    .map_err(|err| format!("failed to emit debug-run-app-action-request: {err}"))
}

#[tauri::command(rename = "debug-run-app-action-response")]
pub fn debug_run_app_action_response(
    app: AppHandle,
    sources: State<'_, DebugActionRequestSources>,
    params: DebugRunAppActionResponseParams,
) -> Result<(), String> {
    let target_label = sources.take(&params.request_id)?;
    let Some(target_label) = target_label else {
        return Ok(());
    };

    app.emit_to(
        target_label.as_str(),
        DEBUG_RUN_APP_ACTION_RESPONSE_EVENT,
        params,
    )
    .map_err(|err| format!("failed to emit debug-run-app-action-response: {err}"))
}

fn resolve_request_target(app: &AppHandle, source_label: &str) -> String {
    if source_label == DEBUG_WINDOW_LABEL && app.get_webview_window("main").is_some() {
        return "main".to_string();
    }
    source_label.to_string()
}

async fn refresh_ambient_suggestions_inner(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    cache: &AmbientSuggestionsCache,
    host_id: Option<&str>,
    project_root: &str,
    existing: &AmbientSuggestionsFile,
    mode: &AmbientSuggestionsRefreshMode,
) -> Result<AmbientSuggestionsFile, String> {
    let is_projectless_chat = looks_like_projectless_chat(project_root);
    let recent_threads =
        read_recent_threads_for_project(app, state, host_id, project_root, is_projectless_chat)
            .await?;

    let generation_result = run_generation_turn(
        state,
        project_root,
        is_projectless_chat,
        existing,
        &recent_threads,
        mode,
    )
    .await?;

    let Some(generation_result) = generation_result else {
        let fresh_file = mark_file_generated(existing.clone());
        write_ambient_suggestions_file(app, &fresh_file)?;
        return Ok(fresh_file);
    };

    cache.transition_safety_running(project_root);
    let filtered_candidates = run_safety_turn(state, &generation_result.suggestions).await?;
    if !generation_result.suggestions.is_empty() && filtered_candidates.is_empty() {
        return Ok(existing.clone());
    }

    let updated = append_generated_suggestions(existing.clone(), filtered_candidates);
    write_ambient_suggestions_file(app, &updated)?;
    Ok(updated)
}

async fn read_recent_threads_for_project(
    app: &AppHandle,
    state: &Arc<AuthBridgeState>,
    host_id: Option<&str>,
    project_root: &str,
    is_projectless_chat: bool,
) -> Result<Vec<AmbientSuggestionsPromptThread>, String> {
    let value = send_request_for_host(
        app,
        state,
        host_id,
        AppServerRequestKind::ThreadList,
        json!({
            "archived": false,
            "limit": 100,
            "sortKey": "updated_at",
        }),
    )
    .await?;
    let response = serde_json::from_value::<ThreadListResponse>(value)
        .map_err(|err| format!("failed to decode thread list response: {err}"))?;
    Ok(response
        .data
        .into_iter()
        .filter(|thread| !thread.ephemeral.unwrap_or(false))
        .filter(|thread| thread_matches_project(&thread.cwd, project_root, is_projectless_chat))
        .take(8)
        .map(|thread| AmbientSuggestionsPromptThread {
            id: thread.id,
            title: resolved_thread_title(thread.name.as_deref(), &thread.preview),
            preview: normalize_thread_preview(&thread.preview),
            updated_at: iso_time_from_unix_seconds(thread.updated_at),
        })
        .collect())
}

async fn run_generation_turn(
    state: &Arc<AuthBridgeState>,
    project_root: &str,
    is_projectless_chat: bool,
    existing: &AmbientSuggestionsFile,
    recent_threads: &[AmbientSuggestionsPromptThread],
    mode: &AmbientSuggestionsRefreshMode,
) -> Result<Option<GeneratedAmbientSuggestionsResult>, String> {
    let model = match mode {
        AmbientSuggestionsRefreshMode::Default => AMBIENT_SUGGESTIONS_GENERATION_MODEL,
        AmbientSuggestionsRefreshMode::FirstPluginConnect => AMBIENT_SUGGESTIONS_FAST_MODEL,
    };
    let effort = match mode {
        AmbientSuggestionsRefreshMode::Default => AMBIENT_SUGGESTIONS_GENERATION_EFFORT,
        AmbientSuggestionsRefreshMode::FirstPluginConnect => AMBIENT_SUGGESTIONS_FAST_EFFORT,
    };
    let prompt =
        build_generation_prompt(project_root, is_projectless_chat, existing, recent_threads);
    run_structured_turn(
        state,
        project_root,
        prompt,
        Some(model),
        Some(effort),
        Some(ambient_suggestions_thread_config()),
        Some(AMBIENT_SUGGESTIONS_GENERATION_BASE_INSTRUCTIONS),
        Some(""),
        ambient_suggestions_generation_output_schema(),
        AMBIENT_SUGGESTIONS_GENERATION_TIMEOUT,
    )
    .await
}

async fn run_safety_turn(
    state: &Arc<AuthBridgeState>,
    candidates: &[GeneratedAmbientSuggestionCandidate],
) -> Result<Vec<GeneratedAmbientSuggestionCandidate>, String> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let prompt = build_safety_prompt(candidates);
    let result = run_structured_turn::<AmbientSuggestionSafetyResult>(
        state,
        "",
        prompt,
        Some(AMBIENT_SUGGESTIONS_FAST_MODEL),
        Some(AMBIENT_SUGGESTIONS_FAST_EFFORT),
        Some(ambient_suggestions_thread_config()),
        Some(AMBIENT_SUGGESTIONS_SAFETY_BASE_INSTRUCTIONS),
        Some(""),
        ambient_suggestions_safety_output_schema(),
        AMBIENT_SUGGESTIONS_SAFETY_TIMEOUT,
    )
    .await?;
    let Some(result) = result else {
        return Ok(Vec::new());
    };

    let excluded_ids = result
        .exclude
        .into_iter()
        .filter(|item| !item.reason.trim().is_empty())
        .map(|item| item.id)
        .collect::<std::collections::HashSet<_>>();
    Ok(candidates
        .iter()
        .enumerate()
        .filter(|(index, _)| !excluded_ids.contains(&format!("suggestion-{}", index + 1)))
        .map(|(_, candidate)| candidate.clone())
        .collect())
}

async fn run_structured_turn<T>(
    state: &Arc<AuthBridgeState>,
    cwd: &str,
    prompt: String,
    model: Option<&str>,
    effort: Option<&str>,
    config: Option<Map<String, Value>>,
    base_instructions: Option<&str>,
    developer_instructions: Option<&str>,
    output_schema: Value,
    timeout: Duration,
) -> Result<Option<T>, String>
where
    T: for<'de> Deserialize<'de>,
{
    let mut thread_extra = Map::new();
    thread_extra.insert("ephemeral".to_string(), Value::Bool(true));
    thread_extra.insert("persistExtendedHistory".to_string(), Value::Bool(false));
    thread_extra.insert(
        "approvalPolicy".to_string(),
        Value::String("never".to_string()),
    );
    thread_extra.insert(
        "sandbox".to_string(),
        Value::String("read-only".to_string()),
    );
    if let Some(config) = config {
        thread_extra.insert("config".to_string(), Value::Object(config));
    }
    if let Some(model) = model {
        thread_extra.insert("model".to_string(), Value::String(model.to_string()));
    }
    if let Some(base_instructions) = base_instructions {
        thread_extra.insert(
            "baseInstructions".to_string(),
            Value::String(base_instructions.to_string()),
        );
    }
    if let Some(developer_instructions) = developer_instructions {
        thread_extra.insert(
            "developerInstructions".to_string(),
            Value::String(developer_instructions.to_string()),
        );
    }
    let cwd_value = (!cwd.trim().is_empty()).then(|| cwd.to_string());
    let thread_id = start_ephemeral_thread_with_overrides(
        state,
        build_thread_start_payload_with_overrides(cwd_value.clone(), None, thread_extra),
    )
    .await?;

    let mut turn_extra = Map::new();
    if let Some(model) = model {
        turn_extra.insert("model".to_string(), Value::String(model.to_string()));
    }
    if let Some(effort) = effort {
        turn_extra.insert("effort".to_string(), Value::String(effort.to_string()));
    }
    turn_extra.insert("summary".to_string(), Value::String("auto".to_string()));
    turn_extra.insert("outputSchema".to_string(), output_schema);

    let turn_result = async {
        let turn_id = start_turn_with_payload(
            state,
            build_turn_start_payload_with_overrides(
                thread_id.clone(),
                json!([{
                    "type": "text",
                    "text": prompt,
                    "textElements": [],
                }]),
                cwd_value,
                None,
                None,
                turn_extra,
            ),
        )
        .await?;
        let completion = wait_for_turn_completion(state, &thread_id, &turn_id, timeout).await?;
        if completion.status != "completed" {
            return Err(match completion.error {
                Some(error) if !error.trim().is_empty() => {
                    format!(
                        "structured turn ended with status {}: {error}",
                        completion.status
                    )
                }
                _ => format!("structured turn ended with status {}", completion.status),
            });
        }
        let message = take_observed_turn_agent_message(state, &thread_id, &turn_id)?
            .unwrap_or_default()
            .trim()
            .to_string();
        clear_observed_turn_completion(state, &thread_id, &turn_id)?;
        if message.is_empty() {
            return Ok(None);
        }
        let parsed = serde_json::from_str::<T>(&message).map_err(|err| {
            format!("failed to decode structured ambient suggestion response: {err}")
        })?;
        Ok(Some(parsed))
    }
    .await;

    let _ = unsubscribe_thread(state, &thread_id).await;
    turn_result
}

fn ambient_suggestions_enabled(app: &AppHandle) -> Result<bool, String> {
    let settings = read_global_settings(app)?;
    Ok(settings
        .get("ambient-suggestions-enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true))
}

fn ambient_suggestions_stale_time_ms(state: &Arc<AuthBridgeState>) -> u64 {
    let snapshot = auth_snapshot(state);
    let auth_method = snapshot.auth_state.auth_method.unwrap_or_default();
    if auth_method == "apikey" {
        return AMBIENT_SUGGESTIONS_PLUS_STALE_TIME_MS;
    }
    if auth_method == "chatgpt" {
        let email = snapshot
            .auth_state
            .email
            .unwrap_or_default()
            .to_ascii_lowercase();
        let plan = snapshot
            .auth_state
            .plan_at_login
            .unwrap_or_default()
            .to_ascii_lowercase();
        if email.ends_with(OPENAI_EMAIL_SUFFIX)
            || AMBIENT_SUGGESTIONS_PLUS_PLANS
                .iter()
                .any(|candidate| *candidate == plan)
        {
            return AMBIENT_SUGGESTIONS_PLUS_STALE_TIME_MS;
        }
    }
    AMBIENT_SUGGESTIONS_STALE_TIME_MS
}

fn is_file_fresh(file: &AmbientSuggestionsFile, stale_time_ms: u64) -> bool {
    file.generated_at_ms
        .is_some_and(|generated_at_ms| now_ms().saturating_sub(generated_at_ms) < stale_time_ms)
}

fn append_generated_suggestions(
    existing: AmbientSuggestionsFile,
    candidates: Vec<GeneratedAmbientSuggestionCandidate>,
) -> AmbientSuggestionsFile {
    let generated_at_ms = now_ms();
    let existing_dedupe = existing
        .suggestions
        .iter()
        .filter(|suggestion| !matches!(suggestion.status, AmbientSuggestionRecordStatus::Pending))
        .map(ambient_suggestion_dedupe_key)
        .collect::<std::collections::HashSet<_>>();

    let mut new_ids = Vec::new();
    let mut suggestions = existing.suggestions.clone();
    for candidate in candidates {
        let app_ids = normalize_app_ids(&candidate.app_id);
        let dedupe_key = ambient_suggestion_dedupe_key_parts(&app_ids, &candidate.prompt);
        if existing_dedupe.contains(&dedupe_key) {
            continue;
        }
        let id = format!(
            "ambient-suggestion-{}-{}",
            generated_at_ms,
            suggestions.len() + new_ids.len() + 1
        );
        new_ids.push(id.clone());
        suggestions.push(AmbientSuggestionRecord {
            id,
            title: candidate.title,
            description: candidate.description,
            prompt: candidate.prompt,
            app_ids,
            status: AmbientSuggestionRecordStatus::Pending,
            created_at_ms: generated_at_ms,
            updated_at_ms: generated_at_ms,
        });
    }

    AmbientSuggestionsFile {
        project_root: existing.project_root,
        generated_at_ms: Some(generated_at_ms),
        current_suggestion_ids: new_ids,
        suggestions,
    }
}

fn mark_file_generated(mut existing: AmbientSuggestionsFile) -> AmbientSuggestionsFile {
    existing.generated_at_ms = Some(now_ms());
    existing.current_suggestion_ids.clear();
    existing
}

fn set_ambient_suggestion_status(
    app: &AppHandle,
    project_root: &str,
    suggestion_id: &str,
    status: AmbientSuggestionRecordStatus,
) -> Result<AmbientSuggestionsFile, String> {
    let mut file = read_ambient_suggestions_file(app, project_root)?;
    let updated_at_ms = now_ms();
    let mut changed = false;
    file.suggestions = file
        .suggestions
        .into_iter()
        .map(|suggestion| {
            if suggestion.id != suggestion_id || suggestion.status == status {
                return suggestion;
            }
            changed = true;
            AmbientSuggestionRecord {
                status: status.clone(),
                updated_at_ms,
                ..suggestion
            }
        })
        .collect();
    if changed {
        write_ambient_suggestions_file(app, &file)?;
    }
    Ok(file)
}

fn read_ambient_suggestions_file(
    _app: &AppHandle,
    project_root: &str,
) -> Result<AmbientSuggestionsFile, String> {
    if project_root.trim().is_empty() {
        return Ok(default_ambient_suggestions_file(project_root));
    }
    let path = ambient_suggestions_file_path(project_root)?;
    if !path.exists() {
        return Ok(default_ambient_suggestions_file(project_root));
    }
    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read {path:?}: {err}"))?;
    let parsed = serde_json::from_str::<AmbientSuggestionsFile>(&contents)
        .map_err(|err| format!("failed to parse {path:?}: {err}"))?;
    Ok(AmbientSuggestionsFile {
        project_root: project_root.to_string(),
        generated_at_ms: parsed.generated_at_ms,
        current_suggestion_ids: parsed.current_suggestion_ids,
        suggestions: parsed.suggestions,
    })
}

fn write_ambient_suggestions_file(
    _app: &AppHandle,
    file: &AmbientSuggestionsFile,
) -> Result<(), String> {
    if file.project_root.trim().is_empty() {
        return Ok(());
    }
    let path = ambient_suggestions_file_path(&file.project_root)?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("missing parent directory for {path:?}"))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create ambient suggestions dir {parent:?}: {err}"))?;
    let temp_path = parent.join(format!(
        ".{}.tmp-{}",
        AMBIENT_SUGGESTIONS_FILE_NAME,
        now_ms()
    ));
    let payload = serde_json::to_string_pretty(file)
        .map_err(|err| format!("failed to encode ambient suggestions json: {err}"))?;
    fs::write(&temp_path, format!("{payload}\n"))
        .map_err(|err| format!("failed to write {temp_path:?}: {err}"))?;
    if let Err(err) = fs::rename(&temp_path, &path) {
        let _ = fs::remove_file(&path);
        fs::rename(&temp_path, &path).map_err(|rename_err| {
            format!(
                "failed to replace ambient suggestions file after rename error ({err}): {rename_err}"
            )
        })?;
    }
    Ok(())
}

fn ambient_suggestions_file_path(project_root: &str) -> Result<PathBuf, String> {
    let codex_home = resolve_codex_home()?;
    let mut path = codex_home;
    path.push(AMBIENT_SUGGESTIONS_DIRECTORY_NAME);
    path.push(ambient_suggestions_hash(LOCAL_HOST_ID, project_root));
    path.push(AMBIENT_SUGGESTIONS_FILE_NAME);
    Ok(path)
}

fn ambient_suggestions_hash(host_id: &str, project_root: &str) -> String {
    let mut hash = Sha1::new();
    hash.update(host_id.as_bytes());
    hash.update(b"\0");
    hash.update(project_root.as_bytes());
    format!("{:x}", hash.finalize())
}

fn default_ambient_suggestions_file(project_root: &str) -> AmbientSuggestionsFile {
    AmbientSuggestionsFile {
        project_root: project_root.to_string(),
        generated_at_ms: None,
        current_suggestion_ids: Vec::new(),
        suggestions: Vec::new(),
    }
}

fn ambient_suggestion_dedupe_key(suggestion: &AmbientSuggestionRecord) -> String {
    ambient_suggestion_dedupe_key_parts(&suggestion.app_ids, &suggestion.prompt)
}

fn ambient_suggestion_dedupe_key_parts(app_ids: &[String], prompt: &str) -> String {
    let mut sorted_app_ids = app_ids.to_vec();
    sorted_app_ids.sort();
    serde_json::to_string(&(sorted_app_ids, prompt)).unwrap_or_else(|_| prompt.to_string())
}

fn normalize_app_ids(app_id: &str) -> Vec<String> {
    let app_id = app_id.trim();
    if app_id.is_empty() {
        Vec::new()
    } else {
        vec![app_id.to_string()]
    }
}

fn thread_matches_project(thread_cwd: &str, project_root: &str, is_projectless_chat: bool) -> bool {
    let normalized_project_root = normalized_path(project_root);
    let normalized_thread_cwd = normalized_path(thread_cwd);
    if is_projectless_chat {
        return normalized_thread_cwd == normalized_project_root;
    }
    if normalized_thread_cwd == normalized_project_root {
        return true;
    }
    let prefix = format!("{normalized_project_root}/");
    normalized_thread_cwd.starts_with(&prefix)
}

fn looks_like_projectless_chat(project_root: &str) -> bool {
    let normalized = normalized_path(project_root);
    let segments = normalized
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    segments
        .windows(2)
        .any(|window| window[0].eq_ignore_ascii_case("codex") && is_iso_date_segment(window[1]))
}

fn is_iso_date_segment(segment: &str) -> bool {
    segment.len() == 10
        && segment
            .chars()
            .enumerate()
            .all(|(index, character)| match index {
                4 | 7 => character == '-',
                _ => character.is_ascii_digit(),
            })
}

fn normalized_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

fn resolved_thread_title(name: Option<&str>, preview: &str) -> String {
    let name = name.unwrap_or_default().trim();
    if !name.is_empty() {
        return name.to_string();
    }
    normalize_thread_preview(preview)
}

fn normalize_thread_preview(preview: &str) -> String {
    let collapsed = preview
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if collapsed.is_empty() {
        "(no message yet)".to_string()
    } else {
        collapsed
    }
}

fn iso_time_from_unix_seconds(seconds: i64) -> String {
    let seconds = seconds.max(0);
    let timestamp = UNIX_EPOCH
        .checked_add(Duration::from_secs(seconds as u64))
        .unwrap_or(UNIX_EPOCH);
    let datetime = unix_seconds_to_iso_utc(timestamp);
    format!("{datetime}Z")
}

fn ambient_suggestions_thread_config() -> Map<String, Value> {
    let mut config = Map::new();
    config.insert(
        "include_permissions_instructions".to_string(),
        Value::Bool(false),
    );
    config.insert("include_apps_instructions".to_string(), Value::Bool(false));
    config.insert(
        "include_environment_context".to_string(),
        Value::Bool(false),
    );
    config.insert(
        "project_doc_max_bytes".to_string(),
        Value::Number(0u64.into()),
    );
    config.insert(
        "skills".to_string(),
        json!({
            "bundled": {
                "enabled": false,
            },
            "config": [],
        }),
    );
    config.insert("features.apps".to_string(), Value::Bool(false));
    config.insert("features.plugins".to_string(), Value::Bool(false));
    config.insert("features.tool_search".to_string(), Value::Bool(false));
    config.insert("features.tool_suggest".to_string(), Value::Bool(false));
    config.insert("features.shell_tool".to_string(), Value::Bool(false));
    config.insert("features.unified_exec".to_string(), Value::Bool(false));
    config.insert("features.shell_snapshot".to_string(), Value::Bool(false));
    config.insert(
        "features.apply_patch_freeform".to_string(),
        Value::Bool(false),
    );
    config.insert("features.js_repl".to_string(), Value::Bool(false));
    config.insert(
        "features.js_repl_tools_only".to_string(),
        Value::Bool(false),
    );
    config.insert("features.code_mode".to_string(), Value::Bool(false));
    config.insert("features.code_mode_only".to_string(), Value::Bool(false));
    config.insert("features.multi_agent".to_string(), Value::Bool(false));
    config.insert("features.multi_agent_v2".to_string(), Value::Bool(false));
    config.insert("features.enable_fanout".to_string(), Value::Bool(false));
    config.insert("features.memories".to_string(), Value::Bool(false));
    config.insert(
        "features.request_permissions_tool".to_string(),
        Value::Bool(false),
    );
    config.insert("features.image_generation".to_string(), Value::Bool(false));
    config.insert(
        "features.image_detail_original".to_string(),
        Value::Bool(false),
    );
    config.insert(
        "features.skill_mcp_dependency_install".to_string(),
        Value::Bool(false),
    );
    config.insert(
        "features.skill_env_var_dependency_prompt".to_string(),
        Value::Bool(false),
    );
    config.insert(
        "features.default_mode_request_user_input".to_string(),
        Value::Bool(false),
    );
    config.insert(
        "web_search".to_string(),
        Value::String("disabled".to_string()),
    );
    config.insert(
        "memories".to_string(),
        json!({
            "use_memories": false,
            "generate_memories": false,
        }),
    );
    config.insert(
        "apps".to_string(),
        json!({
            "_default": {
                "enabled": false,
                "destructive_enabled": false,
                "open_world_enabled": false,
            }
        }),
    );
    config
}

fn ambient_suggestions_generation_output_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "suggestions": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "title": { "type": "string", "minLength": 1 },
                        "description": { "type": "string", "minLength": 1 },
                        "prompt": { "type": "string", "minLength": 1 },
                        "appId": { "type": "string" }
                    },
                    "required": ["title", "description", "prompt", "appId"]
                }
            }
        },
        "required": ["suggestions"]
    })
}

fn ambient_suggestions_safety_output_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "exclude": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "id": { "type": "string", "minLength": 1 },
                        "reason": { "type": "string", "minLength": 1 }
                    },
                    "required": ["id", "reason"]
                }
            }
        },
        "required": ["exclude"]
    })
}

fn build_generation_prompt(
    project_root: &str,
    is_projectless_chat: bool,
    existing: &AmbientSuggestionsFile,
    recent_threads: &[AmbientSuggestionsPromptThread],
) -> String {
    let previous_suggestions = existing
        .suggestions
        .iter()
        .filter(|suggestion| matches!(suggestion.status, AmbientSuggestionRecordStatus::Dismissed))
        .rev()
        .take(3)
        .collect::<Vec<_>>();
    let previous_suggestions_json =
        serde_json::to_string_pretty(&previous_suggestions).unwrap_or_else(|_| "[]".to_string());
    let recent_threads_json =
        serde_json::to_string_pretty(recent_threads).unwrap_or_else(|_| "[]".to_string());
    format!(
        "\
# Overview

Generate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex in {scope}

Serve this specific user. Do not suggest generic project-quality, onboarding, exploration, cleanup, refactor, documentation, test-writing, or dependency-update tasks merely because they could be useful to someone who owns this project.
Your job is to predict what this user specifically needs to get done.
{projectless_grounding}

# Rules

No plugins or connected apps are available in this session. Do not use connected apps or MCP sources for this generation.
{project_grounding}
Your suggestions must be based on recent events.
Before returning a suggestion, it must pass all four checks:
- Why this user
- Why now
- Why Codex
- Why not already handled

Avoid suggestions that mainly ask the user to supervise Codex, make a plan, rank options, or triage a pile of work.
Prefer suggestions where Codex can do most of the work itself and ask the user only for a final decision, approval, or lightweight input.

{threads_label}:
{recent_threads_json}

Avoid repeating these previously dismissed suggestions:
{previous_suggestions_json}

Return 0 to 3 fresh suggestions. Return fewer than 3 when fewer than 3 suggestions clear the bar.

# Response format

Each suggestion must include:
- title
- description
- prompt
- appId
- {launch_shape}",
        scope = if is_projectless_chat {
            "this Projectless chat".to_string()
        } else {
            format!("this local project: {project_root}")
        },
        projectless_grounding = if is_projectless_chat {
            "For Projectless chat, ground each suggestion in recent thread activity."
        } else {
            ""
        },
        project_grounding = if is_projectless_chat {
            "Projectless suggestions should usually be unrelated to operating on the local computer, modifying local files, or changing local app settings unless the recent Projectless threads provide strong direct evidence that the user is already doing that work there."
        } else {
            "For local project suggestions, make sure suggestions are truly relevant to this project itself."
        },
        threads_label = if is_projectless_chat {
            "Recent Projectless Codex threads with the same cwd"
        } else {
            "Recent Codex threads in this project"
        },
        launch_shape = if is_projectless_chat {
            "write the prompt as something that should launch as a new Projectless Codex thread"
        } else {
            "write the prompt as something that should launch as a new Codex thread in this project"
        },
    )
}

fn unix_seconds_to_iso_utc(timestamp: SystemTime) -> String {
    let duration = timestamp
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0));
    let total_seconds = duration.as_secs();
    let days = total_seconds / 86_400;
    let seconds_of_day = total_seconds % 86_400;
    let (year, month, day) = civil_from_days(days as i64);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}")
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    (year, month as u32, day as u32)
}

fn build_safety_prompt(candidates: &[GeneratedAmbientSuggestionCandidate]) -> String {
    let formatted_candidates = candidates
        .iter()
        .enumerate()
        .map(|(index, candidate)| {
            format!(
                "- suggestion_id: \"suggestion-{id}\"\n  title: {title}\n  description: {description}\n  prompt: {prompt}\n  app_id: {app_id}",
                id = index + 1,
                title = serde_json::to_string(&candidate.title).unwrap_or_else(|_| "\"\"".to_string()),
                description = serde_json::to_string(&candidate.description)
                    .unwrap_or_else(|_| "\"\"".to_string()),
                prompt = serde_json::to_string(&candidate.prompt).unwrap_or_else(|_| "\"\"".to_string()),
                app_id = serde_json::to_string(&candidate.app_id).unwrap_or_else(|_| "\"\"".to_string()),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "\
You are an expert at upholding safety and compliance standards for Codex ambient suggestions.

I will present you with two categories of content: things to ALWAYS exclude, and things which you should exclude if they are about the user unless the recent user context shows the user has specifically asked for it.

Always exclude:
- hate, harassment, or abuse
- sexual content
- self-harm or suicide content
- extremist praise or assistance
- actionable illicit wrongdoing assistance
- dangerous delusion or mania reinforcement
- age-restricted content

Also exclude suggestions about the user's sensitive personal data unless the recent user context specifically asked for it.

# Ambient suggestion candidates
{formatted_candidates}

# Output Format

Return a JSON object with one field:
- exclude: a list of objects with id and reason

You must not output any other text. Only output the JSON object."
    )
}

fn invalidate_ambient_suggestions_queries(app: &AppHandle) {
    emit_query_cache_invalidate(
        app,
        vec![Value::String(
            "ambient-suggestions-generation-statuses".to_string(),
        )],
    );
    emit_query_cache_invalidate(app, vec![Value::String("ambient-suggestions".to_string())]);
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ambient_cache_starts_empty() {
        let cache = AmbientSuggestionsCache::default();
        assert_eq!(
            AmbientSuggestionsStatusesResponse {
                statuses: cache.snapshot(),
            },
            AmbientSuggestionsStatusesResponse { statuses: vec![] }
        );
    }

    #[test]
    fn ambient_hash_matches_expected_shape() {
        assert_eq!(
            ambient_suggestions_hash("local", "D:\\repo"),
            "be51f853b5dd2613ffeb5fdba7de7c96ccb709a7"
        );
    }

    #[test]
    fn ambient_default_file_is_empty() {
        assert_eq!(
            default_ambient_suggestions_file("D:\\repo"),
            AmbientSuggestionsFile {
                project_root: "D:\\repo".to_string(),
                generated_at_ms: None,
                current_suggestion_ids: vec![],
                suggestions: vec![],
            }
        );
    }

    #[test]
    fn append_generated_suggestions_sets_current_ids() {
        let file = append_generated_suggestions(
            default_ambient_suggestions_file("D:\\repo"),
            vec![GeneratedAmbientSuggestionCandidate {
                title: "Fix failing CI for parser PR".to_string(),
                description: "CI failed on the parser branch.".to_string(),
                prompt: "Investigate and fix the parser CI failure.".to_string(),
                app_id: "".to_string(),
            }],
        );
        assert_eq!(file.current_suggestion_ids.len(), 1);
        assert_eq!(file.suggestions.len(), 1);
        assert_eq!(
            file.suggestions[0].status,
            AmbientSuggestionRecordStatus::Pending
        );
    }

    #[test]
    fn projectless_detection_matches_codex_documents_shape() {
        assert!(looks_like_projectless_chat(
            "D:\\Users\\debug\\Documents\\Codex\\2026-05-13\\new-chat"
        ));
        assert!(!looks_like_projectless_chat("D:\\repo"));
    }

    #[test]
    fn thread_match_uses_prefix_for_local_projects() {
        assert!(thread_matches_project(
            "D:\\repo\\subdir",
            "D:\\repo",
            false
        ));
        assert!(!thread_matches_project("D:\\other", "D:\\repo", false));
    }

    #[test]
    fn debug_action_request_params_deserialize_camel_case() {
        let raw = serde_json::json!({
            "requestId": "req-1",
            "action": { "type": "app.get_summary" },
            "sourceThreadId": "thread-7",
        });
        let parsed: DebugRunAppActionRequestParams =
            serde_json::from_value(raw).expect("should deserialize");
        assert_eq!(parsed.request_id, "req-1");
        assert_eq!(parsed.source_thread_id.as_deref(), Some("thread-7"));
        assert_eq!(parsed.action["type"], "app.get_summary");
    }

    #[test]
    fn debug_action_response_params_serialize_skips_missing_fields() {
        let params = DebugRunAppActionResponseParams {
            request_id: "req-3".into(),
            ok: true,
            result: Some(serde_json::json!({"value": 42})),
            error_message: None,
        };
        let value = serde_json::to_value(&params).expect("should serialize");
        assert_eq!(value["requestId"], "req-3");
        assert_eq!(value["ok"], true);
        assert_eq!(value["result"]["value"], 42);
        assert!(value.get("errorMessage").is_none());
    }

    #[test]
    fn sources_records_and_takes_request_origin() {
        let sources = DebugActionRequestSources::default();
        sources.record("req-1", "debug-window").expect("record ok");
        assert_eq!(
            sources.take("req-1").expect("take ok"),
            Some("debug-window".to_string())
        );
        assert_eq!(sources.take("req-1").expect("take ok"), None);
    }
}
