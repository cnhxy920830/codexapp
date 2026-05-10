//! Debug Modal desktop owners.
//!
//! Backs the debug modal page (`P-058`) with two Rust/Tauri surfaces it depends
//! on but the replica previously stubbed:
//!
//! 1. `ambient-suggestions-generation-statuses` — pure in-process snapshot
//!    query. Upstream main-process handler is
//!    `"ambient-suggestions-generation-statuses": async () => ({ statuses: t.Cr() })`
//!    where `t.Cr()` returns the current ambient-suggestion generation status
//!    list cached in main-process memory.
//! 2. `debug-run-app-action-request` / `debug-run-app-action-response` — desktop
//!    relay between the Debug window's "Run app action" tab and the chat window
//!    that owns the active app-server connection. Upstream's main-process
//!    handler forwards the request to the debug window's owner (or the primary
//!    window) and routes the response back to the originating sender.
//!
//! Scope of this module is the desktop-owned relay and cache, not the action
//! execution itself. Action execution lives in the receiving window's
//! frontend, which subscribes via `listen('debug-run-app-action-request')`,
//! invokes the relevant app-server method, and sends the result back through
//! `dispatchMessage('debug-run-app-action-response', ...)` (which lands here as
//! the `debug-run-app-action-response` Tauri command).

use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri::Window;

/// Tauri window label that owns the debug modal frontend.
///
/// Mirrors `DEBUG_WINDOW_LABEL` in `window_navigation.rs` to avoid coupling
/// these two modules; if the label ever changes, both constants must move.
const DEBUG_WINDOW_LABEL: &str = "debug-window";

/// Frontend event names. Kept private to this module; the public surface is
/// the registered Tauri commands and the typed managed-state structs.
const DEBUG_RUN_APP_ACTION_REQUEST_EVENT: &str = "debug-run-app-action-request";
const DEBUG_RUN_APP_ACTION_RESPONSE_EVENT: &str = "debug-run-app-action-response";

/// In-memory ambient-suggestion generation status cache.
///
/// Currently always empty because the replica has no ambient-suggestion
/// generator yet. The shape is preserved so a future generator can call
/// `set_status(...)` without touching the page-owned query handler.
#[derive(Debug, Default)]
pub struct AmbientSuggestionsCache {
    inner: Mutex<HashMap<AmbientSuggestionKey, AmbientSuggestionGenerationStatus>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct AmbientSuggestionKey {
    pub host_id: String,
    pub project_root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSuggestionGenerationStatus {
    pub host_id: String,
    pub project_root: String,
    pub state: String,
    pub last_updated_ms: Option<u64>,
}

impl AmbientSuggestionsCache {
    fn snapshot(&self) -> Vec<AmbientSuggestionGenerationStatus> {
        let guard = self
            .inner
            .lock()
            .expect("ambient suggestions cache mutex poisoned");
        let mut entries: Vec<AmbientSuggestionGenerationStatus> = guard.values().cloned().collect();
        entries.sort_by(|left, right| {
            left.host_id
                .cmp(&right.host_id)
                .then_with(|| left.project_root.cmp(&right.project_root))
        });
        entries
    }

    /// Replace the status for a given key. Reserved for the future ambient
    /// suggestion generator implementation; not used in the current code path.
    #[allow(dead_code)]
    pub fn set_status(&self, status: AmbientSuggestionGenerationStatus) {
        let key = AmbientSuggestionKey {
            host_id: status.host_id.clone(),
            project_root: status.project_root.clone(),
        };
        let mut guard = self
            .inner
            .lock()
            .expect("ambient suggestions cache mutex poisoned");
        guard.insert(key, status);
    }
}

/// In-flight `debug-run-app-action-request` source registry.
///
/// Tracks which window originally dispatched the request so the response can
/// be routed back precisely. Cleared when a matching response lands.
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

#[tauri::command(rename = "ambient-suggestions-generation-statuses")]
pub fn ambient_suggestions_generation_statuses(
    cache: State<'_, AmbientSuggestionsCache>,
) -> Result<AmbientSuggestionsStatusesResponse, String> {
    Ok(AmbientSuggestionsStatusesResponse {
        statuses: cache.snapshot(),
    })
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

#[tauri::command(rename = "debug-run-app-action-response")]
pub fn debug_run_app_action_response(
    app: AppHandle,
    sources: State<'_, DebugActionRequestSources>,
    params: DebugRunAppActionResponseParams,
) -> Result<(), String> {
    let target_label = sources.take(&params.request_id)?;
    let Some(target_label) = target_label else {
        // Source already cleaned up (timeout, window closed). Drop silently —
        // upstream's behavior on a missing source webContents is also a no-op.
        return Ok(());
    };

    app.emit_to(
        target_label.as_str(),
        DEBUG_RUN_APP_ACTION_RESPONSE_EVENT,
        params,
    )
    .map_err(|err| format!("failed to emit debug-run-app-action-response: {err}"))
}

/// Pick the window that should run the requested app action.
///
/// Mirrors upstream's `windowManager.debugWindowManager.getOwnerWebContentsId`
/// fallback: when the sender is the debug window itself, route the request to
/// the primary chat window. When the sender is already the primary window the
/// request is delivered back to itself, matching upstream's
/// `getPrimaryWindow(...)` branch.
fn resolve_request_target(app: &AppHandle, source_label: &str) -> String {
    if source_label == DEBUG_WINDOW_LABEL {
        if app.get_webview_window("main").is_some() {
            return "main".to_string();
        }
    }
    source_label.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ambient_cache_starts_empty_and_returns_camel_case_response() {
        let cache = AmbientSuggestionsCache::default();
        let response = AmbientSuggestionsStatusesResponse {
            statuses: cache.snapshot(),
        };
        let value = serde_json::to_value(&response).expect("response should serialize");
        assert!(value["statuses"].is_array());
        assert_eq!(value["statuses"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn ambient_cache_snapshot_is_sorted_and_serializes_camel_case() {
        let cache = AmbientSuggestionsCache::default();
        cache.set_status(AmbientSuggestionGenerationStatus {
            host_id: "local".into(),
            project_root: "/b".into(),
            state: "running".into(),
            last_updated_ms: Some(2),
        });
        cache.set_status(AmbientSuggestionGenerationStatus {
            host_id: "local".into(),
            project_root: "/a".into(),
            state: "idle".into(),
            last_updated_ms: None,
        });

        let snapshot = cache.snapshot();
        assert_eq!(snapshot.len(), 2);
        assert_eq!(snapshot[0].project_root, "/a");
        assert_eq!(snapshot[1].project_root, "/b");

        let value = serde_json::to_value(&snapshot[0]).expect("status should serialize");
        assert_eq!(value["hostId"], "local");
        assert_eq!(value["projectRoot"], "/a");
        assert_eq!(value["state"], "idle");
        assert!(value.get("lastUpdatedMs").is_some());
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
    fn debug_action_request_params_allow_missing_source_thread() {
        let raw = serde_json::json!({
            "requestId": "req-2",
            "action": { "type": "noop" },
        });
        let parsed: DebugRunAppActionRequestParams =
            serde_json::from_value(raw).expect("should deserialize");
        assert!(parsed.source_thread_id.is_none());
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
        // Second take returns None (already consumed).
        assert_eq!(sources.take("req-1").expect("take ok"), None);
    }
}
