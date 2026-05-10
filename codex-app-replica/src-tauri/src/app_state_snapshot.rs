use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State, Window};

const APP_STATE_SNAPSHOT_REQUEST_EVENT: &str = "electron-app-state-snapshot-request";
const HEARTBEAT_INTERVAL_MS: u64 = 30_000;
const REQUEST_TTL_MS: u64 = 60_000;
const PRIMARY_WINDOW_LABEL: &str = "main";
const SNAPSHOT_REASON_HEARTBEAT: &str = "heartbeat";
const WINDOW_HOST_ID: &str = "local";

#[derive(Debug, Default)]
pub struct AppStateSnapshotState {
    next_request_id: AtomicU64,
    pending_requests: Mutex<HashMap<String, PendingSnapshotRequest>>,
    latest_snapshot_by_window: Mutex<HashMap<String, AppStateSnapshotFields>>,
}

#[derive(Debug)]
struct PendingSnapshotRequest {
    created_at: Instant,
    window_label: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ElectronAppStateSnapshotRequestEvent {
    host_id: String,
    request_id: String,
    reason: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElectronAppStateSnapshotResponseParams {
    pub request_id: String,
    pub fields: AppStateSnapshotFields,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct AppStateSnapshotFields {
    pub event: String,
    pub schema_version: u32,
    pub snapshot_reason: String,
    pub session_age_ms: u64,
    pub thread_count_total: u64,
    pub thread_count_loaded_recent: u64,
    pub thread_count_active: u64,
    pub thread_count_streaming_owner: u64,
    pub thread_count_streaming_follower: u64,
    pub thread_count_streaming_without_role: u64,
    pub thread_count_streaming_with_active_runtime: u64,
    pub thread_count_streaming_without_active_runtime: u64,
    pub thread_count_with_inflight_turn: u64,
    pub turn_count_total_loaded: u64,
    pub item_count_total_loaded: u64,
    pub max_turns_in_single_thread: u64,
    pub max_items_in_single_turn: u64,
    pub pending_request_count: u64,
    pub inflight_turn_count: u64,
    pub delta_events_total: u64,
    pub delta_bytes_total_estimate: u64,
    pub delta_events_last_30s: u64,
    pub delta_bytes_last_30s_estimate: u64,
    pub renderer_frame_interval_sample_count_last_30s: u64,
    pub renderer_frame_interval_p95_ms_last_30s: Option<f64>,
    pub review_diff_files_total: u64,
    pub review_diff_lines_total: u64,
    pub review_diff_bytes_estimate: u64,
}

pub fn spawn_app_state_snapshot_heartbeat(app: AppHandle, state: Arc<AppStateSnapshotState>) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let _ = request_app_state_snapshot(&app, &state);

        loop {
            tokio::time::sleep(Duration::from_millis(HEARTBEAT_INTERVAL_MS)).await;
            let _ = request_app_state_snapshot(&app, &state);
        }
    });
}

#[tauri::command(rename = "electron-app-state-snapshot-response")]
pub fn electron_app_state_snapshot_response(
    window: Window,
    state: State<'_, Arc<AppStateSnapshotState>>,
    params: ElectronAppStateSnapshotResponseParams,
) -> Result<(), String> {
    state.prune_expired_requests();

    {
        let mut pending_requests = state
            .pending_requests
            .lock()
            .map_err(|err| format!("pending snapshot requests mutex poisoned: {err}"))?;
        let Some(pending_request) = pending_requests.get(&params.request_id) else {
            return Ok(());
        };
        if pending_request.window_label != window.label() {
            return Ok(());
        }
        pending_requests.remove(&params.request_id);
    }

    let mut latest_snapshot_by_window = state
        .latest_snapshot_by_window
        .lock()
        .map_err(|err| format!("latest snapshot cache mutex poisoned: {err}"))?;
    latest_snapshot_by_window.insert(window.label().to_string(), params.fields);
    Ok(())
}

fn request_app_state_snapshot(
    app: &AppHandle,
    state: &AppStateSnapshotState,
) -> Result<(), String> {
    state.prune_expired_requests();

    let Some(window) = app.get_webview_window(PRIMARY_WINDOW_LABEL) else {
        return Ok(());
    };

    let is_focused = window.is_focused().map_err(|err| {
        format!("failed to read {PRIMARY_WINDOW_LABEL} window focus state: {err}")
    })?;
    if !is_focused {
        return Ok(());
    }

    let request_id = format!(
        "app-state-snapshot-request-{}",
        state.next_request_id.fetch_add(1, Ordering::Relaxed) + 1
    );
    {
        let mut pending_requests = state
            .pending_requests
            .lock()
            .map_err(|err| format!("pending snapshot requests mutex poisoned: {err}"))?;
        pending_requests.insert(
            request_id.clone(),
            PendingSnapshotRequest {
                created_at: Instant::now(),
                window_label: window.label().to_string(),
            },
        );
    }

    let request_event = ElectronAppStateSnapshotRequestEvent {
        host_id: WINDOW_HOST_ID.to_string(),
        request_id: request_id.clone(),
        reason: SNAPSHOT_REASON_HEARTBEAT.to_string(),
    };

    if let Err(err) = window.emit(APP_STATE_SNAPSHOT_REQUEST_EVENT, request_event) {
        let mut pending_requests = state
            .pending_requests
            .lock()
            .map_err(|lock_err| format!("pending snapshot requests mutex poisoned: {lock_err}"))?;
        pending_requests.remove(&request_id);
        return Err(format!(
            "failed to emit {APP_STATE_SNAPSHOT_REQUEST_EVENT} for {}: {err}",
            window.label()
        ));
    }

    Ok(())
}

impl AppStateSnapshotState {
    fn prune_expired_requests(&self) {
        let mut pending_requests = self
            .pending_requests
            .lock()
            .expect("pending snapshot requests mutex poisoned");
        pending_requests.retain(|_, request| {
            request.created_at.elapsed() < Duration::from_millis(REQUEST_TTL_MS)
        });
    }
}

#[cfg(test)]
mod tests {
    use super::AppStateSnapshotFields;
    use super::AppStateSnapshotState;
    use super::ElectronAppStateSnapshotRequestEvent;
    use super::ElectronAppStateSnapshotResponseParams;
    use super::PendingSnapshotRequest;
    use super::REQUEST_TTL_MS;
    use std::time::{Duration, Instant};

    fn sample_fields() -> AppStateSnapshotFields {
        AppStateSnapshotFields {
            event: "app_state_snapshot".into(),
            schema_version: 1,
            snapshot_reason: "heartbeat".into(),
            session_age_ms: 42,
            thread_count_total: 3,
            thread_count_loaded_recent: 2,
            thread_count_active: 1,
            thread_count_streaming_owner: 1,
            thread_count_streaming_follower: 0,
            thread_count_streaming_without_role: 0,
            thread_count_streaming_with_active_runtime: 1,
            thread_count_streaming_without_active_runtime: 0,
            thread_count_with_inflight_turn: 1,
            turn_count_total_loaded: 7,
            item_count_total_loaded: 19,
            max_turns_in_single_thread: 7,
            max_items_in_single_turn: 6,
            pending_request_count: 4,
            inflight_turn_count: 1,
            delta_events_total: 15,
            delta_bytes_total_estimate: 2_048,
            delta_events_last_30s: 3,
            delta_bytes_last_30s_estimate: 512,
            renderer_frame_interval_sample_count_last_30s: 120,
            renderer_frame_interval_p95_ms_last_30s: Some(18.4),
            review_diff_files_total: 2,
            review_diff_lines_total: 48,
            review_diff_bytes_estimate: 900,
        }
    }

    #[test]
    fn snapshot_request_event_serializes_to_camel_case() {
        let value = serde_json::to_value(ElectronAppStateSnapshotRequestEvent {
            host_id: "local".into(),
            request_id: "req-1".into(),
            reason: "heartbeat".into(),
        })
        .expect("event should serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "hostId": "local",
                "requestId": "req-1",
                "reason": "heartbeat"
            })
        );
    }

    #[test]
    fn snapshot_response_params_deserialize_camel_case_wrapper_and_snake_case_fields() {
        let parsed: ElectronAppStateSnapshotResponseParams =
            serde_json::from_value(serde_json::json!({
                "requestId": "req-2",
                "fields": {
                    "event": "app_state_snapshot",
                    "schema_version": 1,
                    "snapshot_reason": "heartbeat",
                    "session_age_ms": 42,
                    "thread_count_total": 3,
                    "thread_count_loaded_recent": 2,
                    "thread_count_active": 1,
                    "thread_count_streaming_owner": 1,
                    "thread_count_streaming_follower": 0,
                    "thread_count_streaming_without_role": 0,
                    "thread_count_streaming_with_active_runtime": 1,
                    "thread_count_streaming_without_active_runtime": 0,
                    "thread_count_with_inflight_turn": 1,
                    "turn_count_total_loaded": 7,
                    "item_count_total_loaded": 19,
                    "max_turns_in_single_thread": 7,
                    "max_items_in_single_turn": 6,
                    "pending_request_count": 4,
                    "inflight_turn_count": 1,
                    "delta_events_total": 15,
                    "delta_bytes_total_estimate": 2048,
                    "delta_events_last_30s": 3,
                    "delta_bytes_last_30s_estimate": 512,
                    "renderer_frame_interval_sample_count_last_30s": 120,
                    "renderer_frame_interval_p95_ms_last_30s": 18.4,
                    "review_diff_files_total": 2,
                    "review_diff_lines_total": 48,
                    "review_diff_bytes_estimate": 900
                }
            }))
            .expect("params should deserialize");

        assert_eq!(parsed.request_id, "req-2");
        assert_eq!(parsed.fields, sample_fields());
    }

    #[test]
    fn prune_expired_requests_removes_stale_entries() {
        let state = AppStateSnapshotState::default();
        state
            .pending_requests
            .lock()
            .expect("pending snapshot requests mutex poisoned")
            .insert(
                "stale".into(),
                PendingSnapshotRequest {
                    created_at: Instant::now()
                        .checked_sub(Duration::from_millis(REQUEST_TTL_MS + 1))
                        .expect("request age should be representable"),
                    window_label: "main".into(),
                },
            );

        state.prune_expired_requests();

        assert!(state
            .pending_requests
            .lock()
            .expect("pending snapshot requests mutex poisoned")
            .is_empty());
    }
}
