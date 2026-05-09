use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder, Window};

const MAIN_WINDOW_LABEL: &str = "main";
const NAVIGATE_TO_ROUTE_EVENT: &str = "navigate-to-route";
const TOGGLE_DIFF_PANEL_EVENT: &str = "toggle-diff-panel";
const DEBUG_WINDOW_LABEL: &str = "debug-window";
const DEBUG_WINDOW_ROUTE_PATH: &str = "/debug";
const DEBUG_WINDOW_TITLE: &str = "Debug";
const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT: &str =
    "debug-window-origin-conversation-changed";
const PLAN_SUMMARY_ROUTE_PATH: &str = "/plan-summary";
const PLAN_SUMMARY_WINDOW_LABEL_PREFIX: &str = "plan-summary-window";
const THREAD_WINDOW_LABEL_PREFIX: &str = "thread-window";

#[derive(Default)]
pub struct PendingWindowRoutes {
    routes_by_label: Mutex<HashMap<String, String>>,
}

impl PendingWindowRoutes {
    pub(crate) fn insert(&self, label: &str, path: String) -> Result<(), String> {
        let mut routes = self
            .routes_by_label
            .lock()
            .map_err(|_| "pending window routes mutex poisoned".to_string())?;
        routes.insert(label.to_string(), path);
        Ok(())
    }

    pub(crate) fn remove(&self, label: &str) -> Result<(), String> {
        let mut routes = self
            .routes_by_label
            .lock()
            .map_err(|_| "pending window routes mutex poisoned".to_string())?;
        routes.remove(label);
        Ok(())
    }

    pub(crate) fn take(&self, label: &str) -> Result<Option<String>, String> {
        let mut routes = self
            .routes_by_label
            .lock()
            .map_err(|_| "pending window routes mutex poisoned".to_string())?;
        Ok(routes.remove(label))
    }
}

#[derive(Default)]
pub struct PendingPlanSummaries {
    summaries_by_label: Mutex<HashMap<String, PendingPlanSummary>>,
}

impl PendingPlanSummaries {
    fn insert(&self, label: &str, summary: PendingPlanSummary) -> Result<(), String> {
        let mut summaries = self
            .summaries_by_label
            .lock()
            .map_err(|_| "pending plan summaries mutex poisoned".to_string())?;
        summaries.insert(label.to_string(), summary);
        Ok(())
    }

    fn remove(&self, label: &str) -> Result<(), String> {
        let mut summaries = self
            .summaries_by_label
            .lock()
            .map_err(|_| "pending plan summaries mutex poisoned".to_string())?;
        summaries.remove(label);
        Ok(())
    }

    fn take(&self, label: &str) -> Result<Option<PendingPlanSummary>, String> {
        let mut summaries = self
            .summaries_by_label
            .lock()
            .map_err(|_| "pending plan summaries mutex poisoned".to_string())?;
        Ok(summaries.remove(label))
    }
}

#[derive(Default)]
pub struct PendingDebugWindowOriginConversations {
    conversations_by_label: Mutex<HashMap<String, String>>,
}

impl PendingDebugWindowOriginConversations {
    fn insert(&self, label: &str, conversation_id: String) -> Result<(), String> {
        let mut conversations = self
            .conversations_by_label
            .lock()
            .map_err(|_| "pending debug window origin conversations mutex poisoned".to_string())?;
        conversations.insert(label.to_string(), conversation_id);
        Ok(())
    }

    fn remove(&self, label: &str) -> Result<(), String> {
        let mut conversations = self
            .conversations_by_label
            .lock()
            .map_err(|_| "pending debug window origin conversations mutex poisoned".to_string())?;
        conversations.remove(label);
        Ok(())
    }

    fn take(&self, label: &str) -> Result<Option<String>, String> {
        let mut conversations = self
            .conversations_by_label
            .lock()
            .map_err(|_| "pending debug window origin conversations mutex poisoned".to_string())?;
        Ok(conversations.remove(label))
    }
}

#[derive(Default)]
pub struct DebugWindowOriginConversations {
    conversations_by_source_label: Mutex<HashMap<String, String>>,
}

impl DebugWindowOriginConversations {
    fn insert(&self, source_label: &str, conversation_id: String) -> Result<(), String> {
        let mut conversations = self
            .conversations_by_source_label
            .lock()
            .map_err(|_| "debug window origin conversations mutex poisoned".to_string())?;
        conversations.insert(source_label.to_string(), conversation_id);
        Ok(())
    }

    fn get(&self, source_label: &str) -> Result<Option<String>, String> {
        let conversations = self
            .conversations_by_source_label
            .lock()
            .map_err(|_| "debug window origin conversations mutex poisoned".to_string())?;
        Ok(conversations.get(source_label).cloned())
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NavigateToRouteNotification {
    path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ToggleDiffPanelNotification {
    open: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct DebugWindowOriginConversationChangedNotification {
    conversation_id: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenInNewWindowParams {
    pub host_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShowDiffParams {
    pub conversation_id: String,
    pub unified_diff: String,
    #[serde(default)]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShowPlanSummaryParams {
    pub conversation_id: String,
    pub plan_content: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiffIfOpenParams {
    pub conversation_id: String,
    pub unified_diff: String,
}

pub type PendingPlanSummary = ShowPlanSummaryParams;

#[tauri::command(rename = "show-settings")]
pub fn show_settings(app: AppHandle, window: Window, section: String) -> Result<(), String> {
    let path = settings_route_path(&section)?;
    let main_window = reveal_main_window(&app, &window)?;
    navigate_window_to_route(&main_window, &path)
}

#[tauri::command(rename = "open-current-main-window")]
pub fn open_current_main_window(app: AppHandle, window: Window) -> Result<(), String> {
    reveal_main_window(&app, &window)?;
    Ok(())
}

#[tauri::command(rename = "open-in-main-window")]
pub fn open_in_main_window(app: AppHandle, window: Window, path: String) -> Result<(), String> {
    let path = validated_main_window_route(&path)?;
    let main_window = reveal_main_window(&app, &window)?;
    navigate_window_to_route(&main_window, &path)
}

#[tauri::command(rename = "open-debug-window")]
pub async fn open_debug_window(
    app: AppHandle,
    window: Window,
    pending_debug_window_origin_conversations: State<'_, PendingDebugWindowOriginConversations>,
    debug_window_origin_conversations: State<'_, DebugWindowOriginConversations>,
    pending_window_routes: State<'_, PendingWindowRoutes>,
) -> Result<(), String> {
    let origin_conversation_id = debug_window_origin_conversations.get(window.label())?;
    pending_window_routes.insert(DEBUG_WINDOW_LABEL, DEBUG_WINDOW_ROUTE_PATH.to_string())?;

    if let Some(conversation_id) = origin_conversation_id.as_ref() {
        pending_debug_window_origin_conversations
            .insert(DEBUG_WINDOW_LABEL, conversation_id.clone())?;
    } else {
        pending_debug_window_origin_conversations.remove(DEBUG_WINDOW_LABEL)?;
    }

    if let Some(debug_window) = app.get_webview_window(DEBUG_WINDOW_LABEL) {
        navigate_window_to_route(&debug_window, DEBUG_WINDOW_ROUTE_PATH)?;
        if let Some(conversation_id) = origin_conversation_id.as_deref() {
            send_debug_window_origin_conversation_changed(&debug_window, conversation_id)?;
        }
        return show_and_focus_window(&debug_window);
    }

    match create_debug_window(&app) {
        Ok(window) => show_and_focus_window(&window),
        Err(err) => {
            let _ = pending_window_routes.remove(DEBUG_WINDOW_LABEL);
            let _ = pending_debug_window_origin_conversations.remove(DEBUG_WINDOW_LABEL);
            Err(err)
        }
    }
}

#[tauri::command(rename = "open-in-new-window")]
pub async fn open_in_new_window(
    app: AppHandle,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: OpenInNewWindowParams,
) -> Result<(), String> {
    let host_id = normalized_host_id(&params.host_id)?;
    let path = validated_main_window_route(&params.path)?;
    let label = thread_window_label(&host_id, &path)?;

    if let Some(window) = app.get_webview_window(&label) {
        navigate_window_to_route(&window, &path)?;
        show_and_focus_window(&window)?;
        return Ok(());
    }

    pending_window_routes.insert(&label, path.clone())?;
    match create_thread_window(&app, &label) {
        Ok(window) => show_and_focus_window(&window),
        Err(err) => {
            let _ = pending_window_routes.remove(&label);
            Err(err)
        }
    }
}

#[tauri::command(rename = "show-plan-summary")]
pub async fn show_plan_summary(
    app: AppHandle,
    pending_plan_summaries: State<'_, PendingPlanSummaries>,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: ShowPlanSummaryParams,
) -> Result<(), String> {
    let conversation_id = normalized_conversation_id(&params.conversation_id)?;
    let plan_content = normalized_plan_content(&params.plan_content)?;
    let summary = PendingPlanSummary {
        conversation_id,
        plan_content,
    };
    let label = plan_summary_window_label(&summary)?;

    pending_plan_summaries.insert(&label, summary)?;
    pending_window_routes.insert(&label, PLAN_SUMMARY_ROUTE_PATH.to_string())?;

    if let Some(window) = app.get_webview_window(&label) {
        navigate_window_to_route(&window, PLAN_SUMMARY_ROUTE_PATH)?;
        return show_and_focus_window(&window);
    }

    match create_thread_window(&app, &label) {
        Ok(window) => show_and_focus_window(&window),
        Err(err) => {
            let _ = pending_plan_summaries.remove(&label);
            let _ = pending_window_routes.remove(&label);
            Err(err)
        }
    }
}

#[tauri::command(rename = "show-diff")]
pub fn show_diff(window: Window, params: ShowDiffParams) -> Result<(), String> {
    let ShowDiffParams {
        conversation_id: _,
        unified_diff: _,
        cwd: _,
    } = params;

    window
        .emit(
            TOGGLE_DIFF_PANEL_EVENT,
            ToggleDiffPanelNotification { open: true },
        )
        .map_err(|err| format!("failed to emit {TOGGLE_DIFF_PANEL_EVENT}: {err}"))
}

#[tauri::command(rename = "update-diff-if-open")]
pub fn update_diff_if_open(params: UpdateDiffIfOpenParams) -> Result<(), String> {
    let UpdateDiffIfOpenParams {
        conversation_id: _,
        unified_diff: _,
    } = params;

    Ok(())
}

#[tauri::command(rename = "debug-window-origin-conversation-changed")]
pub fn debug_window_origin_conversation_changed(
    app: AppHandle,
    window: Window,
    pending_debug_window_origin_conversations: State<'_, PendingDebugWindowOriginConversations>,
    debug_window_origin_conversations: State<'_, DebugWindowOriginConversations>,
    conversation_id: String,
) -> Result<(), String> {
    let conversation_id = normalized_conversation_id(&conversation_id)?;
    debug_window_origin_conversations.insert(window.label(), conversation_id.clone())?;
    pending_debug_window_origin_conversations
        .insert(DEBUG_WINDOW_LABEL, conversation_id.clone())?;

    if let Some(debug_window) = app.get_webview_window(DEBUG_WINDOW_LABEL) {
        send_debug_window_origin_conversation_changed(&debug_window, &conversation_id)?;
    }

    Ok(())
}

#[tauri::command]
pub fn take_pending_window_route(
    window: Window,
    pending_window_routes: State<'_, PendingWindowRoutes>,
) -> Result<Option<String>, String> {
    pending_window_routes.take(window.label())
}

#[tauri::command]
pub fn take_pending_plan_summary(
    window: Window,
    pending_plan_summaries: State<'_, PendingPlanSummaries>,
) -> Result<Option<PendingPlanSummary>, String> {
    pending_plan_summaries.take(window.label())
}

#[tauri::command]
pub fn take_pending_debug_window_origin_conversation(
    window: Window,
    pending_debug_window_origin_conversations: State<'_, PendingDebugWindowOriginConversations>,
) -> Result<Option<String>, String> {
    pending_debug_window_origin_conversations.take(window.label())
}

fn settings_route_path(section: &str) -> Result<String, String> {
    if !is_valid_settings_section(section) {
        return Err(format!("invalid settings section: {section}"));
    }

    Ok(format!("/settings/{section}"))
}

fn reveal_main_window(app: &AppHandle, window: &Window) -> Result<WebviewWindow, String> {
    if window.label() != MAIN_WINDOW_LABEL {
        window
            .hide()
            .map_err(|err| format!("failed to hide current window: {err}"))?;
    }

    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("missing {MAIN_WINDOW_LABEL} window"))?;

    show_and_focus_window(&main_window)?;
    Ok(main_window)
}

fn show_and_focus_window(window: &WebviewWindow) -> Result<(), String> {
    window
        .show()
        .map_err(|err| format!("failed to show {} window: {err}", window.label()))?;
    window
        .set_focus()
        .map_err(|err| format!("failed to focus {} window: {err}", window.label()))
}

fn navigate_window_to_route(window: &WebviewWindow, path: &str) -> Result<(), String> {
    window
        .emit(
            NAVIGATE_TO_ROUTE_EVENT,
            NavigateToRouteNotification {
                path: path.to_string(),
            },
        )
        .map_err(|err| format!("failed to emit {NAVIGATE_TO_ROUTE_EVENT}: {err}"))
}

fn create_thread_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "missing window template config".to_string())?;
    config.label = label.to_string();

    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| format!("failed to clone window template: {err}"))?
        .build()
        .map_err(|err| format!("failed to create {label} window: {err}"))
}

fn create_debug_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "missing window template config".to_string())?;
    config.label = DEBUG_WINDOW_LABEL.to_string();

    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| format!("failed to clone window template: {err}"))?
        .title(DEBUG_WINDOW_TITLE)
        .inner_size(920.0, 840.0)
        .center()
        .build()
        .map_err(|err| format!("failed to create {DEBUG_WINDOW_LABEL} window: {err}"))
}

fn send_debug_window_origin_conversation_changed(
    window: &WebviewWindow,
    conversation_id: &str,
) -> Result<(), String> {
    window
        .emit(
            DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT,
            DebugWindowOriginConversationChangedNotification {
                conversation_id: conversation_id.to_string(),
            },
        )
        .map_err(|err| {
            format!("failed to emit {DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT}: {err}")
        })
}

fn validated_main_window_route(path: &str) -> Result<String, String> {
    if !is_valid_main_window_route(path) {
        return Err(format!("invalid main window path: {path}"));
    }

    Ok(path.to_string())
}

fn normalized_host_id(host_id: &str) -> Result<String, String> {
    let trimmed = host_id.trim();
    if trimmed.is_empty() {
        return Err("hostId must not be empty".to_string());
    }

    Ok(trimmed.to_string())
}

fn normalized_conversation_id(conversation_id: &str) -> Result<String, String> {
    let trimmed = conversation_id.trim();
    if trimmed.is_empty() {
        return Err("conversationId must not be empty".to_string());
    }

    if !trimmed.bytes().all(is_valid_main_window_route_byte) {
        return Err(format!("invalid conversationId: {trimmed}"));
    }

    Ok(trimmed.to_string())
}

fn normalized_plan_content(plan_content: &str) -> Result<String, String> {
    let normalized = plan_content.trim().to_string();
    if normalized.is_empty() {
        return Err("planContent must not be empty".to_string());
    }

    Ok(normalized)
}

fn thread_window_label(host_id: &str, path: &str) -> Result<String, String> {
    let (route_kind, thread_id) =
        parse_main_window_route(path).ok_or_else(|| format!("invalid main window path: {path}"))?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    host_id.hash(&mut hasher);
    path.hash(&mut hasher);
    let route_hash = hasher.finish();

    Ok(format!(
        "{THREAD_WINDOW_LABEL_PREFIX}-{}-{}-{:016x}",
        sanitize_label_component(host_id),
        sanitize_label_component(&format!("{route_kind}-{thread_id}")),
        route_hash
    ))
}

fn plan_summary_window_label(summary: &PendingPlanSummary) -> Result<String, String> {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    summary.conversation_id.hash(&mut hasher);
    summary.plan_content.hash(&mut hasher);
    let content_hash = hasher.finish();

    Ok(format!(
        "{PLAN_SUMMARY_WINDOW_LABEL_PREFIX}-{}-{content_hash:016x}",
        sanitize_label_component(&summary.conversation_id),
    ))
}

fn parse_main_window_route(path: &str) -> Option<(&str, &str)> {
    if let Some(id) = path.strip_prefix("/local/") {
        return Some(("local", id));
    }
    if let Some(id) = path.strip_prefix("/remote/") {
        return Some(("remote", id));
    }
    None
}

fn sanitize_label_component(value: &str) -> String {
    let sanitized = value
        .bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() {
                char::from(byte)
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "window".to_string()
    } else {
        sanitized
    }
}

fn is_valid_settings_section(section: &str) -> bool {
    !section.is_empty()
        && section
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn is_valid_main_window_route(path: &str) -> bool {
    let Some(id) = path
        .strip_prefix("/local/")
        .or_else(|| path.strip_prefix("/remote/"))
    else {
        return false;
    };

    !id.is_empty() && id.bytes().all(is_valid_main_window_route_byte)
}

fn is_valid_main_window_route_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'%')
}

#[cfg(test)]
mod tests {
    use super::is_valid_main_window_route;
    use super::is_valid_settings_section;
    use super::normalized_conversation_id;
    use super::normalized_host_id;
    use super::normalized_plan_content;
    use super::plan_summary_window_label;
    use super::settings_route_path;
    use super::thread_window_label;
    use super::validated_main_window_route;
    use super::PendingPlanSummary;
    use super::ShowDiffParams;
    use super::UpdateDiffIfOpenParams;
    use super::DEBUG_WINDOW_ROUTE_PATH;

    #[test]
    fn accepts_hyphenated_settings_sections() {
        assert_eq!(
            settings_route_path("local-environments"),
            Ok("/settings/local-environments".to_string())
        );
    }

    #[test]
    fn rejects_invalid_settings_sections() {
        assert!(!is_valid_settings_section(""));
        assert!(!is_valid_settings_section("../general"));
        assert!(!is_valid_settings_section("General"));
        assert!(!is_valid_settings_section("general/settings"));
    }

    #[test]
    fn accepts_page_owned_main_window_routes() {
        assert_eq!(
            validated_main_window_route("/local/550e8400-e29b-41d4-a716-446655440000"),
            Ok("/local/550e8400-e29b-41d4-a716-446655440000".to_string())
        );
        assert_eq!(
            validated_main_window_route("/remote/thread_abc-123"),
            Ok("/remote/thread_abc-123".to_string())
        );
    }

    #[test]
    fn rejects_invalid_main_window_routes() {
        assert!(!is_valid_main_window_route(""));
        assert!(!is_valid_main_window_route("local/thread"));
        assert!(!is_valid_main_window_route("/settings/general"));
        assert!(!is_valid_main_window_route("/local/thread/extra"));
        assert!(!is_valid_main_window_route("/remote/thread?query=1"));
    }

    #[test]
    fn trims_host_id_for_new_window_requests() {
        assert_eq!(normalized_host_id(" local "), Ok("local".to_string()));
    }

    #[test]
    fn rejects_blank_host_id_for_new_window_requests() {
        assert_eq!(
            normalized_host_id("   "),
            Err("hostId must not be empty".to_string())
        );
    }

    #[test]
    fn builds_deterministic_thread_window_labels() {
        let local_label = thread_window_label("local", "/local/thread_abc-123")
            .expect("local route should build a label");
        let remote_label = thread_window_label("remote", "/remote/thread_abc-123")
            .expect("remote route should build a label");

        assert!(local_label.starts_with("thread-window-local-local-thread-abc-123-"));
        assert!(remote_label.starts_with("thread-window-remote-remote-thread-abc-123-"));
        assert_ne!(local_label, remote_label);
    }

    #[test]
    fn validates_plan_summary_payload() {
        assert_eq!(
            normalized_conversation_id("thread_abc-123"),
            Ok("thread_abc-123".to_string())
        );
        assert_eq!(
            normalized_plan_content("  # Plan  "),
            Ok("# Plan".to_string())
        );
    }

    #[test]
    fn rejects_invalid_plan_summary_payload() {
        assert_eq!(
            normalized_conversation_id(""),
            Err("conversationId must not be empty".to_string())
        );
        assert_eq!(
            normalized_plan_content("   "),
            Err("planContent must not be empty".to_string())
        );
    }

    #[test]
    fn builds_deterministic_plan_summary_window_labels() {
        let summary = PendingPlanSummary {
            conversation_id: "thread_abc-123".to_string(),
            plan_content: "# Plan".to_string(),
        };
        let label = plan_summary_window_label(&summary).expect("summary should build a label");

        assert!(label.starts_with("plan-summary-window-thread-abc-123-"));
    }

    #[test]
    fn deserializes_show_diff_payload() {
        let payload: ShowDiffParams = serde_json::from_value(serde_json::json!({
            "conversationId": "thread_abc-123",
            "unifiedDiff": "@@ -1 +1 @@\n-old\n+new\n",
            "cwd": "C:/repo"
        }))
        .expect("show-diff payload should deserialize");

        assert_eq!(
            payload,
            ShowDiffParams {
                conversation_id: "thread_abc-123".to_string(),
                unified_diff: "@@ -1 +1 @@\n-old\n+new\n".to_string(),
                cwd: Some("C:/repo".to_string()),
            }
        );
    }

    #[test]
    fn deserializes_update_diff_if_open_payload() {
        let payload: UpdateDiffIfOpenParams = serde_json::from_value(serde_json::json!({
            "conversationId": "thread_abc-123",
            "unifiedDiff": "@@ -1 +1 @@\n-old\n+new\n"
        }))
        .expect("update-diff-if-open payload should deserialize");

        assert_eq!(
            payload,
            UpdateDiffIfOpenParams {
                conversation_id: "thread_abc-123".to_string(),
                unified_diff: "@@ -1 +1 @@\n-old\n+new\n".to_string(),
            }
        );
    }

    #[test]
    fn debug_window_route_matches_upstream() {
        assert_eq!(DEBUG_WINDOW_ROUTE_PATH, "/debug");
    }
}
