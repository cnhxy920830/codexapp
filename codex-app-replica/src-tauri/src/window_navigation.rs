use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder, Window};

const MAIN_WINDOW_LABEL: &str = "main";
const NAVIGATE_TO_ROUTE_EVENT: &str = "navigate-to-route";
const DEBUG_WINDOW_LABEL: &str = "debug-window";
const DEBUG_WINDOW_ROUTE_PATH: &str = "/debug";
const DEBUG_WINDOW_TITLE: &str = "Debug";
pub const APP_CONNECT_OAUTH_CALLBACK_ROUTE_PATH: &str = "/app-connect-oauth-callback";
const DEBUG_WINDOW_ORIGIN_CONVERSATION_CHANGED_EVENT: &str =
    "debug-window-origin-conversation-changed";
const FILE_PREVIEW_ROUTE_PATH: &str = "/file-preview";
const FILE_PREVIEW_WINDOW_LABEL_PREFIX: &str = "file-preview-window";
const FILE_PREVIEW_WINDOW_TITLE: &str = "File";
const EDITOR_DIFF_ROUTE_PATH: &str = "/diff";
const EDITOR_DIFF_WINDOW_LABEL_PREFIX: &str = "editor-diff-window";
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
pub struct PendingDiffs {
    diffs_by_label: Mutex<HashMap<String, PendingDiff>>,
}

impl PendingDiffs {
    fn insert(&self, label: &str, diff: PendingDiff) -> Result<(), String> {
        let mut diffs = self
            .diffs_by_label
            .lock()
            .map_err(|_| "pending diffs mutex poisoned".to_string())?;
        diffs.insert(label.to_string(), diff);
        Ok(())
    }

    fn get(&self, label: &str) -> Result<Option<PendingDiff>, String> {
        let diffs = self
            .diffs_by_label
            .lock()
            .map_err(|_| "pending diffs mutex poisoned".to_string())?;
        Ok(diffs.get(label).cloned())
    }

    fn take(&self, label: &str) -> Result<Option<PendingDiff>, String> {
        let mut diffs = self
            .diffs_by_label
            .lock()
            .map_err(|_| "pending diffs mutex poisoned".to_string())?;
        Ok(diffs.remove(label))
    }
}

#[derive(Default)]
pub struct PendingFilePreviews {
    previews_by_label: Mutex<HashMap<String, PendingFilePreview>>,
}

impl PendingFilePreviews {
    fn insert(&self, label: &str, preview: PendingFilePreview) -> Result<(), String> {
        let mut previews = self
            .previews_by_label
            .lock()
            .map_err(|_| "pending file previews mutex poisoned".to_string())?;
        previews.insert(label.to_string(), preview);
        Ok(())
    }

    fn remove(&self, label: &str) -> Result<(), String> {
        let mut previews = self
            .previews_by_label
            .lock()
            .map_err(|_| "pending file previews mutex poisoned".to_string())?;
        previews.remove(label);
        Ok(())
    }

    fn take(&self, label: &str) -> Result<Option<PendingFilePreview>, String> {
        let mut previews = self
            .previews_by_label
            .lock()
            .map_err(|_| "pending file previews mutex poisoned".to_string())?;
        Ok(previews.remove(label))
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

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct NavigateToRouteNotification {
    path: String,
    state: Option<Value>,
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShowFilePreviewParams {
    pub file_path: String,
    pub contents: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiffIfOpenParams {
    pub conversation_id: String,
    pub unified_diff: String,
}

pub type PendingPlanSummary = ShowPlanSummaryParams;
pub type PendingDiff = ShowDiffParams;
pub type PendingFilePreview = ShowFilePreviewParams;

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
pub fn show_diff(
    app: AppHandle,
    pending_diffs: State<'_, PendingDiffs>,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: ShowDiffParams,
) -> Result<(), String> {
    let diff = normalized_pending_diff(params)?;
    let label = editor_diff_window_label(&diff);

    pending_diffs.insert(&label, diff)?;
    pending_window_routes.insert(&label, EDITOR_DIFF_ROUTE_PATH.to_string())?;

    if let Some(window) = app.get_webview_window(&label) {
        navigate_window_to_route(&window, EDITOR_DIFF_ROUTE_PATH)?;
        return show_and_focus_window(&window);
    }

    match create_thread_window(&app, &label) {
        Ok(window) => show_and_focus_window(&window),
        Err(err) => {
            let _ = pending_window_routes.remove(&label);
            Err(err)
        }
    }
}

#[tauri::command(rename = "show-file-preview")]
pub fn show_file_preview(
    app: AppHandle,
    window: Window,
    pending_file_previews: State<'_, PendingFilePreviews>,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: ShowFilePreviewParams,
) -> Result<(), String> {
    let preview = normalized_pending_file_preview(params)?;
    let label = file_preview_window_label(window.label());

    pending_file_previews.insert(&label, preview.clone())?;
    pending_window_routes.insert(&label, FILE_PREVIEW_ROUTE_PATH.to_string())?;

    if let Some(file_preview_window) = app.get_webview_window(&label) {
        file_preview_window
            .set_title(&file_preview_window_title(&preview.file_path))
            .map_err(|err| format!("failed to set {label} title: {err}"))?;
        navigate_window_to_route_with_state(
            &file_preview_window,
            FILE_PREVIEW_ROUTE_PATH,
            Some(serde_json::to_value(&preview).map_err(|err| {
                format!("failed to serialize file preview navigation state: {err}")
            })?),
        )?;
        return show_and_focus_window(&file_preview_window);
    }

    match create_file_preview_window(&app, &label) {
        Ok(file_preview_window) => {
            file_preview_window
                .set_title(&file_preview_window_title(&preview.file_path))
                .map_err(|err| format!("failed to set {label} title: {err}"))?;
            show_and_focus_window(&file_preview_window)
        }
        Err(err) => {
            let _ = pending_file_previews.remove(&label);
            let _ = pending_window_routes.remove(&label);
            Err(err)
        }
    }
}

#[tauri::command(rename = "update-diff-if-open")]
pub fn update_diff_if_open(
    app: AppHandle,
    pending_diffs: State<'_, PendingDiffs>,
    pending_window_routes: State<'_, PendingWindowRoutes>,
    params: UpdateDiffIfOpenParams,
) -> Result<(), String> {
    let conversation_id = normalized_conversation_id(&params.conversation_id)?;
    let unified_diff = normalized_unified_diff(&params.unified_diff)?;
    let label = editor_diff_window_label_for_conversation(&conversation_id);

    let Some(window) = app.get_webview_window(&label) else {
        return Ok(());
    };
    let cwd = pending_diffs
        .get(&label)?
        .and_then(|existing_diff| existing_diff.cwd);

    pending_diffs.insert(
        &label,
        PendingDiff {
            conversation_id,
            unified_diff,
            cwd,
        },
    )?;
    pending_window_routes.insert(&label, EDITOR_DIFF_ROUTE_PATH.to_string())?;
    navigate_window_to_route(&window, EDITOR_DIFF_ROUTE_PATH)?;
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
pub fn take_pending_diff(
    window: Window,
    pending_diffs: State<'_, PendingDiffs>,
) -> Result<Option<PendingDiff>, String> {
    pending_diffs.take(window.label())
}

#[tauri::command]
pub fn take_pending_file_preview(
    window: Window,
    pending_file_previews: State<'_, PendingFilePreviews>,
) -> Result<Option<PendingFilePreview>, String> {
    pending_file_previews.take(window.label())
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
    navigate_window_to_route_with_state(window, path, None)
}

fn navigate_window_to_route_with_state(
    window: &WebviewWindow,
    path: &str,
    state: Option<Value>,
) -> Result<(), String> {
    window
        .emit(
            NAVIGATE_TO_ROUTE_EVENT,
            NavigateToRouteNotification {
                path: path.to_string(),
                state,
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

fn create_file_preview_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
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
        .title(FILE_PREVIEW_WINDOW_TITLE)
        .build()
        .map_err(|err| format!("failed to create {label} window: {err}"))
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
    if plan_content.trim().is_empty() {
        return Err("planContent must not be empty".to_string());
    }

    Ok(plan_content.to_string())
}

fn normalized_unified_diff(unified_diff: &str) -> Result<String, String> {
    if unified_diff.trim().is_empty() {
        return Err("unifiedDiff must not be empty".to_string());
    }

    Ok(unified_diff.to_string())
}

fn normalized_pending_diff(params: ShowDiffParams) -> Result<PendingDiff, String> {
    let conversation_id = normalized_conversation_id(&params.conversation_id)?;
    let unified_diff = normalized_unified_diff(&params.unified_diff)?;
    let cwd = params.cwd.and_then(|cwd| {
        let trimmed = cwd.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });

    Ok(PendingDiff {
        conversation_id,
        unified_diff,
        cwd,
    })
}

fn normalized_pending_file_preview(
    params: ShowFilePreviewParams,
) -> Result<PendingFilePreview, String> {
    let file_path = normalized_file_preview_file_path(&params.file_path)?;

    Ok(PendingFilePreview {
        file_path,
        contents: params.contents,
        line: params.line,
        column: params.column,
    })
}

fn normalized_file_preview_file_path(file_path: &str) -> Result<String, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("filePath must not be empty".to_string());
    }

    Ok(trimmed.to_string())
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

fn editor_diff_window_label(diff: &PendingDiff) -> String {
    editor_diff_window_label_for_conversation(&diff.conversation_id)
}

fn editor_diff_window_label_for_conversation(conversation_id: &str) -> String {
    format!(
        "{EDITOR_DIFF_WINDOW_LABEL_PREFIX}-{}",
        sanitize_label_component(conversation_id)
    )
}

fn file_preview_window_label(owner_label: &str) -> String {
    format!(
        "{FILE_PREVIEW_WINDOW_LABEL_PREFIX}-{}",
        sanitize_label_component(owner_label)
    )
}

fn file_preview_window_title(file_path: &str) -> String {
    let trimmed = file_path.trim();
    trimmed
        .rsplit(['/', '\\'])
        .next()
        .filter(|segment| !segment.is_empty())
        .unwrap_or(trimmed)
        .to_string()
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
    if path == "/" {
        return true;
    }

    if path == APP_CONNECT_OAUTH_CALLBACK_ROUTE_PATH {
        return true;
    }

    if path == FILE_PREVIEW_ROUTE_PATH {
        return true;
    }

    if path == EDITOR_DIFF_ROUTE_PATH {
        return true;
    }

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
    use super::editor_diff_window_label;
    use super::file_preview_window_label;
    use super::file_preview_window_title;
    use super::is_valid_main_window_route;
    use super::is_valid_settings_section;
    use super::normalized_conversation_id;
    use super::normalized_file_preview_file_path;
    use super::normalized_host_id;
    use super::normalized_pending_diff;
    use super::normalized_pending_file_preview;
    use super::normalized_plan_content;
    use super::normalized_unified_diff;
    use super::plan_summary_window_label;
    use super::settings_route_path;
    use super::thread_window_label;
    use super::validated_main_window_route;
    use super::PendingDiff;
    use super::PendingFilePreview;
    use super::PendingPlanSummary;
    use super::ShowDiffParams;
    use super::ShowFilePreviewParams;
    use super::UpdateDiffIfOpenParams;
    use super::APP_CONNECT_OAUTH_CALLBACK_ROUTE_PATH;
    use super::DEBUG_WINDOW_ROUTE_PATH;
    use super::EDITOR_DIFF_ROUTE_PATH;
    use super::FILE_PREVIEW_ROUTE_PATH;

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
        assert_eq!(validated_main_window_route("/"), Ok("/".to_string()));
        assert_eq!(
            validated_main_window_route(APP_CONNECT_OAUTH_CALLBACK_ROUTE_PATH),
            Ok(APP_CONNECT_OAUTH_CALLBACK_ROUTE_PATH.to_string())
        );
        assert_eq!(
            validated_main_window_route(FILE_PREVIEW_ROUTE_PATH),
            Ok(FILE_PREVIEW_ROUTE_PATH.to_string())
        );
        assert_eq!(
            validated_main_window_route(EDITOR_DIFF_ROUTE_PATH),
            Ok(EDITOR_DIFF_ROUTE_PATH.to_string())
        );
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
            Ok("  # Plan  ".to_string())
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
    fn validates_pending_file_preview_payload() {
        assert_eq!(
            normalized_pending_file_preview(ShowFilePreviewParams {
                file_path: "  docs/spec.md  ".to_string(),
                contents: "line 1\nline 2".to_string(),
                line: Some(3),
                column: Some(8),
            }),
            Ok(PendingFilePreview {
                file_path: "docs/spec.md".to_string(),
                contents: "line 1\nline 2".to_string(),
                line: Some(3),
                column: Some(8),
            })
        );
    }

    #[test]
    fn rejects_blank_file_preview_path() {
        assert_eq!(
            normalized_file_preview_file_path("   "),
            Err("filePath must not be empty".to_string())
        );
    }

    #[test]
    fn builds_file_preview_window_label_per_owner() {
        assert_eq!(
            file_preview_window_label("main"),
            "file-preview-window-main".to_string()
        );
        assert_eq!(
            file_preview_window_label("thread-window-local-local-thread-1"),
            "file-preview-window-thread-window-local-local-thread-1".to_string()
        );
    }

    #[test]
    fn derives_file_preview_window_title_from_basename() {
        assert_eq!(
            file_preview_window_title("C:/repo/src/example.ts"),
            "example.ts".to_string()
        );
        assert_eq!(
            file_preview_window_title("models\\protein.pdb"),
            "protein.pdb".to_string()
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
    fn validates_pending_diff_payload() {
        assert_eq!(
            normalized_unified_diff("@@ -1 +1 @@\n-old\n+new\n"),
            Ok("@@ -1 +1 @@\n-old\n+new\n".to_string())
        );

        assert_eq!(
            normalized_pending_diff(ShowDiffParams {
                conversation_id: "thread_abc-123".to_string(),
                unified_diff: "@@ -1 +1 @@\n-old\n+new\n".to_string(),
                cwd: Some("  C:/repo  ".to_string()),
            }),
            Ok(PendingDiff {
                conversation_id: "thread_abc-123".to_string(),
                unified_diff: "@@ -1 +1 @@\n-old\n+new\n".to_string(),
                cwd: Some("C:/repo".to_string()),
            })
        );
    }

    #[test]
    fn rejects_blank_pending_diff_payload() {
        assert_eq!(
            normalized_unified_diff("   "),
            Err("unifiedDiff must not be empty".to_string())
        );
    }

    #[test]
    fn builds_deterministic_editor_diff_window_labels() {
        let label = editor_diff_window_label(&PendingDiff {
            conversation_id: "thread_abc-123".to_string(),
            unified_diff: "@@ -1 +1 @@\n-old\n+new\n".to_string(),
            cwd: None,
        });

        assert_eq!(label, "editor-diff-window-thread-abc-123");
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
