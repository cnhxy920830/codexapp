use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

const DEBUG_APP_SERVER_HOST_UPDATED_EVENT: &str = "debug-app-server-host-updated";
const LOCAL_DEBUG_APP_SERVER_HOST_ID: &str = "local";
const MAX_REQUESTS_PER_HOST: usize = 200;
const MAX_NOTIFICATIONS_PER_HOST: usize = 300;

#[derive(Default)]
pub struct DebugAppServerState {
    inner: Mutex<DebugAppServerStore>,
}

#[derive(Default)]
struct DebugAppServerStore {
    hosts: HashMap<String, DebugAppServerHostState>,
}

#[derive(Default)]
struct DebugAppServerHostState {
    app_server_version: Option<String>,
    installed_codex_version: Option<String>,
    subscribed_thread_ids: HashSet<String>,
    next_request_sequence_number: u64,
    next_notification_sequence_number: u64,
    requests: Vec<DebugAppServerRequestRecord>,
    notifications: Vec<DebugAppServerNotificationRecord>,
}

#[derive(Debug, Clone)]
pub struct DebugAppServerRequestHandle {
    host_id: String,
    request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerSnapshotResponse {
    pub hosts: Vec<DebugAppServerHostSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerHostSnapshot {
    pub host_id: String,
    pub app_server_version: Option<String>,
    pub installed_codex_version: Option<String>,
    pub requests: Vec<DebugAppServerRequestRecord>,
    pub notifications: Vec<DebugAppServerNotificationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerHostUpdatedNotification {
    pub host: DebugAppServerHostSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerHostParams {
    pub host_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerRequestRecord {
    pub id: String,
    pub method: String,
    pub matching_request_sequence_number: u64,
    pub started_at_ms: i64,
    pub ended_at_ms: Option<i64>,
    pub timeout_ms: i64,
    pub params_preview: String,
    pub result_preview: Option<String>,
    pub error_preview: Option<String>,
    pub status: DebugAppServerRequestStatus,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DebugAppServerRequestStatus {
    Pending,
    Completed,
    Failed,
    TimedOut,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DebugAppServerNotificationRecord {
    pub id: String,
    pub method: String,
    pub params_preview: String,
    pub received_at_ms: i64,
    pub severity: DebugAppServerNotificationSeverity,
    pub is_noisy: bool,
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DebugAppServerNotificationSeverity {
    Default,
    Error,
    Noisy,
}

#[tauri::command(rename = "debug-app-server-snapshot")]
pub async fn debug_app_server_snapshot(
    state: tauri::State<'_, DebugAppServerState>,
) -> Result<DebugAppServerSnapshotResponse, String> {
    let guard = state
        .inner
        .lock()
        .map_err(|_| "failed to lock debug app-server state".to_string())?;
    Ok(DebugAppServerSnapshotResponse {
        hosts: snapshot_hosts(&guard),
    })
}

#[tauri::command(rename = "debug-app-server-clear-requests")]
pub async fn debug_app_server_clear_requests(
    app: AppHandle,
    params: DebugAppServerHostParams,
) -> Result<(), String> {
    clear_requests(&app, &params.host_id)?;
    Ok(())
}

#[tauri::command(rename = "debug-app-server-clear-notifications")]
pub async fn debug_app_server_clear_notifications(
    app: AppHandle,
    params: DebugAppServerHostParams,
) -> Result<(), String> {
    clear_notifications(&app, &params.host_id)?;
    Ok(())
}

pub fn request_started(
    app: &AppHandle,
    host_id: &str,
    method: &str,
    params: &Value,
    timeout_ms: i64,
) -> DebugAppServerRequestHandle {
    let started_at_ms = now_ms();
    mutate_host(app, host_id, |host| {
        host.next_request_sequence_number += 1;
        let sequence_number = host.next_request_sequence_number;
        let request_id = format!("request-{sequence_number}");
        host.requests.insert(
            0,
            DebugAppServerRequestRecord {
                id: request_id.clone(),
                method: method.to_string(),
                matching_request_sequence_number: sequence_number,
                started_at_ms,
                ended_at_ms: None,
                timeout_ms,
                params_preview: format_preview(params),
                result_preview: None,
                error_preview: None,
                status: DebugAppServerRequestStatus::Pending,
                duration_ms: None,
            },
        );
        host.requests.truncate(MAX_REQUESTS_PER_HOST);
        DebugAppServerRequestHandle {
            host_id: host_id.to_string(),
            request_id,
        }
    })
    .unwrap_or_else(|_| DebugAppServerRequestHandle {
        host_id: host_id.to_string(),
        request_id: "request-unknown".to_string(),
    })
}

pub fn request_completed(app: &AppHandle, handle: &DebugAppServerRequestHandle, result: &Value) {
    let completed_at_ms = now_ms();
    let _ = mutate_host(app, &handle.host_id, |host| {
        if let Some(request) = host
            .requests
            .iter_mut()
            .find(|request| request.id == handle.request_id)
        {
            request.ended_at_ms = Some(completed_at_ms);
            request.duration_ms = Some(completed_at_ms.saturating_sub(request.started_at_ms));
            request.result_preview = Some(format_preview(result));
            request.error_preview = None;
            request.status = DebugAppServerRequestStatus::Completed;
        }
    });
}

pub fn request_failed(app: &AppHandle, handle: &DebugAppServerRequestHandle, error: &str) {
    let completed_at_ms = now_ms();
    let error_preview = if error.trim().is_empty() {
        "Unknown error".to_string()
    } else {
        error.trim().to_string()
    };
    let _ = mutate_host(app, &handle.host_id, |host| {
        if let Some(request) = host
            .requests
            .iter_mut()
            .find(|request| request.id == handle.request_id)
        {
            request.ended_at_ms = Some(completed_at_ms);
            request.duration_ms = Some(completed_at_ms.saturating_sub(request.started_at_ms));
            request.result_preview = None;
            request.error_preview = Some(error_preview);
            request.status = DebugAppServerRequestStatus::Failed;
        }
    });
}

pub fn notification_received(app: &AppHandle, host_id: &str, method: &str, params: &Value) {
    let received_at_ms = now_ms();
    let is_noisy = is_noisy_notification_method(method);
    let severity = notification_severity(method, is_noisy);
    let thread_id = extract_thread_id(params);
    let _ = mutate_host(app, host_id, |host| {
        host.next_notification_sequence_number += 1;
        let notification_id = format!("notification-{}", host.next_notification_sequence_number);
        host.notifications.insert(
            0,
            DebugAppServerNotificationRecord {
                id: notification_id,
                method: method.to_string(),
                params_preview: format_preview(params),
                received_at_ms,
                severity,
                is_noisy,
                thread_id,
            },
        );
        host.notifications.truncate(MAX_NOTIFICATIONS_PER_HOST);
    });
}

pub fn set_versions(
    app: &AppHandle,
    host_id: &str,
    app_server_version: Option<String>,
    installed_codex_version: Option<String>,
) {
    let _ = mutate_host(app, host_id, |host| {
        host.app_server_version = app_server_version;
        host.installed_codex_version = installed_codex_version;
        host.subscribed_thread_ids.clear();
    });
}

pub fn mark_thread_subscribed(app: &AppHandle, host_id: &str, thread_id: &str) {
    let normalized_thread_id = thread_id.trim();
    if normalized_thread_id.is_empty() {
        return;
    }
    let _ = mutate_host(app, host_id, |host| {
        host.subscribed_thread_ids
            .insert(normalized_thread_id.to_string());
    });
}

pub fn mark_thread_unsubscribed(app: &AppHandle, host_id: &str, thread_id: &str) {
    let normalized_thread_id = thread_id.trim();
    if normalized_thread_id.is_empty() {
        return;
    }
    let _ = mutate_host(app, host_id, |host| {
        host.subscribed_thread_ids.remove(normalized_thread_id);
    });
}

pub fn is_thread_subscribed(
    app: &AppHandle,
    host_id: &str,
    thread_id: &str,
) -> Result<bool, String> {
    let normalized_host_id = normalize_host_id(host_id);
    let normalized_thread_id = thread_id.trim();
    if normalized_thread_id.is_empty() {
        return Ok(false);
    }
    let state = app.state::<DebugAppServerState>();
    let guard = state
        .inner
        .lock()
        .map_err(|_| "failed to lock debug app-server state".to_string())?;
    Ok(guard
        .hosts
        .get(&normalized_host_id)
        .map(|host| host.subscribed_thread_ids.contains(normalized_thread_id))
        .unwrap_or(false))
}

pub fn parse_app_server_version_from_initialize_result(result: &Value) -> Option<String> {
    result
        .get("userAgent")
        .and_then(Value::as_str)
        .and_then(parse_version_from_user_agent)
}

pub fn clear_requests(app: &AppHandle, host_id: &str) -> Result<(), String> {
    mutate_host(app, host_id, |host| {
        host.requests.clear();
    })
}

pub fn clear_notifications(app: &AppHandle, host_id: &str) -> Result<(), String> {
    mutate_host(app, host_id, |host| {
        host.notifications.clear();
    })
}

fn mutate_host<T>(
    app: &AppHandle,
    host_id: &str,
    mutation: impl FnOnce(&mut DebugAppServerHostState) -> T,
) -> Result<T, String> {
    let normalized_host_id = normalize_host_id(host_id);
    let (host_snapshot, output) = {
        let state = app.state::<DebugAppServerState>();
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| "failed to lock debug app-server state".to_string())?;
        let host = guard.hosts.entry(normalized_host_id.clone()).or_default();
        let output = mutation(host);
        (snapshot_host(&normalized_host_id, host), output)
    };
    emit_host_updated(app, host_snapshot);
    Ok(output)
}

fn emit_host_updated(app: &AppHandle, host: DebugAppServerHostSnapshot) {
    let _ = app.emit(
        DEBUG_APP_SERVER_HOST_UPDATED_EVENT,
        DebugAppServerHostUpdatedNotification { host },
    );
}

fn snapshot_hosts(store: &DebugAppServerStore) -> Vec<DebugAppServerHostSnapshot> {
    let mut hosts = store
        .hosts
        .iter()
        .map(|(host_id, host)| snapshot_host(host_id, host))
        .collect::<Vec<_>>();
    hosts.sort_by(|left, right| {
        if left.host_id == LOCAL_DEBUG_APP_SERVER_HOST_ID {
            return std::cmp::Ordering::Less;
        }
        if right.host_id == LOCAL_DEBUG_APP_SERVER_HOST_ID {
            return std::cmp::Ordering::Greater;
        }
        left.host_id.cmp(&right.host_id)
    });
    hosts
}

fn snapshot_host(host_id: &str, host: &DebugAppServerHostState) -> DebugAppServerHostSnapshot {
    DebugAppServerHostSnapshot {
        host_id: host_id.to_string(),
        app_server_version: host.app_server_version.clone(),
        installed_codex_version: host.installed_codex_version.clone(),
        requests: host.requests.clone(),
        notifications: host.notifications.clone(),
    }
}

fn normalize_host_id(host_id: &str) -> String {
    let trimmed = host_id.trim();
    if trimmed.is_empty() {
        return LOCAL_DEBUG_APP_SERVER_HOST_ID.to_string();
    }
    trimmed.to_string()
}

fn extract_thread_id(params: &Value) -> Option<String> {
    params
        .get("threadId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|thread_id| !thread_id.is_empty())
        .map(ToOwned::to_owned)
}

fn notification_severity(method: &str, is_noisy: bool) -> DebugAppServerNotificationSeverity {
    if method == "error" || method.contains("/error") || method.contains("failed") {
        return DebugAppServerNotificationSeverity::Error;
    }
    if is_noisy {
        return DebugAppServerNotificationSeverity::Noisy;
    }
    DebugAppServerNotificationSeverity::Default
}

fn is_noisy_notification_method(method: &str) -> bool {
    method.contains("/delta") || method.contains("Delta") || method.ends_with("/output")
}

fn format_preview(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

fn parse_version_from_user_agent(user_agent: &str) -> Option<String> {
    let (_originator, rest) = user_agent.split_once('/')?;
    let version = rest
        .split_whitespace()
        .next()
        .filter(|version| !version.is_empty())?;
    Some(version.to_string())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::extract_thread_id;
    use super::format_preview;
    use super::is_noisy_notification_method;
    use super::notification_severity;
    use super::parse_app_server_version_from_initialize_result;
    use super::parse_version_from_user_agent;
    use super::DebugAppServerNotificationSeverity;
    use serde_json::json;

    #[test]
    fn extract_thread_id_reads_non_empty_thread_id() {
        assert_eq!(
            extract_thread_id(&json!({ "threadId": "thread-123" })),
            Some("thread-123".to_string())
        );
        assert_eq!(extract_thread_id(&json!({ "threadId": "" })), None);
        assert_eq!(
            extract_thread_id(&json!({ "conversationId": "thread-123" })),
            None
        );
    }

    #[test]
    fn noisy_notification_detection_matches_upstream_patterns() {
        assert!(is_noisy_notification_method("item/agentMessage/delta"));
        assert!(is_noisy_notification_method("reasoningTextDelta"));
        assert!(is_noisy_notification_method("command/output"));
        assert!(!is_noisy_notification_method("thread/goal/updated"));
    }

    #[test]
    fn notification_severity_prefers_errors_over_noisy() {
        assert_eq!(
            notification_severity("item/failed", false),
            DebugAppServerNotificationSeverity::Error
        );
        assert_eq!(
            notification_severity("item/agentMessage/delta", true),
            DebugAppServerNotificationSeverity::Noisy
        );
        assert_eq!(
            notification_severity("thread/goal/updated", false),
            DebugAppServerNotificationSeverity::Default
        );
    }

    #[test]
    fn format_preview_uses_pretty_json() {
        assert_eq!(
            format_preview(&json!({ "threadId": "thread-123", "count": 2 })),
            "{\n  \"threadId\": \"thread-123\",\n  \"count\": 2\n}"
        );
    }

    #[test]
    fn parse_version_from_user_agent_reads_version_token() {
        assert_eq!(
            parse_version_from_user_agent(
                "codex_app_server_daemon/1.2.3 (Linux 6.8.0; x86_64) codex_cli_rs/1.2.3"
            ),
            Some("1.2.3".to_string())
        );
        assert_eq!(
            parse_version_from_user_agent("codex_app_server_daemon"),
            None
        );
    }

    #[test]
    fn parse_app_server_version_from_initialize_result_reads_user_agent() {
        assert_eq!(
            parse_app_server_version_from_initialize_result(&json!({
                "userAgent": "codex_app_server_daemon/0.129.0-alpha.6 (Linux 6.8.0; x86_64) codex_cli_rs/0.129.0-alpha.6"
            })),
            Some("0.129.0-alpha.6".to_string())
        );
        assert_eq!(
            parse_app_server_version_from_initialize_result(&json!({
                "platformFamily": "windows"
            })),
            None
        );
    }
}
