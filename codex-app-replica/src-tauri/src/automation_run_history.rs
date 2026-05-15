use crate::query_cache::emit_query_cache_invalidate;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const AUTOMATION_RUN_HISTORY_DIR_NAME: &str = "codex-app";
const AUTOMATION_RUN_HISTORY_FILE_NAME: &str = "automation-run-history.json";
const INBOX_ITEMS_QUERY_KEY: &str = "inbox-items";

static AUTOMATION_RUN_HISTORY_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub struct AutomationRunHistoryState {
    lock: Mutex<()>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AutomationRunHistoryStatus {
    InProgress,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationInboxItem {
    pub id: String,
    pub automation_id: String,
    pub automation_name: Option<String>,
    pub title: Option<String>,
    pub source_cwd: Option<String>,
    pub thread_id: Option<String>,
    pub read_at: Option<u64>,
    pub created_at: u64,
    pub status: Option<AutomationRunHistoryStatus>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
struct AutomationRunHistoryDocument {
    pub items: Vec<AutomationInboxItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxItemsParams {
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxItemsResponse {
    pub items: Vec<AutomationInboxItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxItemSetReadStateParams {
    pub id: String,
    pub is_read: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewAutomationRunHistoryItem {
    pub automation_id: String,
    pub automation_name: Option<String>,
    pub title: Option<String>,
    pub source_cwd: Option<String>,
}

#[tauri::command(rename = "inbox-items")]
pub fn inbox_items(
    app: AppHandle,
    state: State<'_, Arc<AutomationRunHistoryState>>,
    params: InboxItemsParams,
) -> Result<InboxItemsResponse, String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "failed to lock automation run history state".to_string())?;
    let mut items = read_automation_run_history_document(&app)?.items;
    items.sort_by(|left, right| {
        right
            .created_at
            .cmp(&left.created_at)
            .then_with(|| right.id.cmp(&left.id))
    });
    if let Some(limit) = params.limit {
        items.truncate(limit);
    }
    Ok(InboxItemsResponse { items })
}

#[tauri::command(rename = "inbox-item-set-read-state")]
pub fn inbox_item_set_read_state(
    app: AppHandle,
    state: State<'_, Arc<AutomationRunHistoryState>>,
    params: InboxItemSetReadStateParams,
) -> Result<(), String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "failed to lock automation run history state".to_string())?;
    let mut document = read_automation_run_history_document(&app)?;
    let Some(item) = document.items.iter_mut().find(|item| item.id == params.id) else {
        return Ok(());
    };
    item.read_at = if params.is_read {
        Some(current_timestamp_ms()?)
    } else {
        None
    };
    write_automation_run_history_document(&app, &document)?;
    invalidate_inbox_items_query(&app);
    Ok(())
}

pub(crate) fn create_automation_run_history_item(
    app: &AppHandle,
    params: NewAutomationRunHistoryItem,
) -> Result<String, String> {
    let state = app.state::<Arc<AutomationRunHistoryState>>();
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "failed to lock automation run history state".to_string())?;
    let mut document = read_automation_run_history_document(app)?;
    let now = current_timestamp_ms()?;
    let id = next_automation_run_history_item_id(now);
    document.items.push(AutomationInboxItem {
        id: id.clone(),
        automation_id: params.automation_id,
        automation_name: params.automation_name,
        title: params.title,
        source_cwd: params.source_cwd,
        thread_id: None,
        read_at: None,
        created_at: now,
        status: Some(AutomationRunHistoryStatus::InProgress),
    });
    write_automation_run_history_document(app, &document)?;
    invalidate_inbox_items_query(app);
    Ok(id)
}

pub(crate) fn attach_automation_run_history_thread_id(
    app: &AppHandle,
    item_id: &str,
    thread_id: &str,
) -> Result<(), String> {
    mutate_automation_run_history_document(app, |document| {
        if let Some(item) = document.items.iter_mut().find(|item| item.id == item_id) {
            item.thread_id = Some(thread_id.to_string());
            return Ok(true);
        }
        Ok(false)
    })
}

pub(crate) fn delete_automation_run_history_item(
    app: &AppHandle,
    item_id: &str,
) -> Result<(), String> {
    mutate_automation_run_history_document(app, |document| {
        let previous_len = document.items.len();
        document.items.retain(|item| item.id != item_id);
        Ok(document.items.len() != previous_len)
    })
}

pub(crate) fn complete_automation_run_history_for_thread(
    app: &AppHandle,
    thread_id: &str,
) -> Result<(), String> {
    mutate_automation_run_history_document(app, |document| {
        let mut changed = false;
        for item in &mut document.items {
            if item.thread_id.as_deref() == Some(thread_id)
                && item.status == Some(AutomationRunHistoryStatus::InProgress)
            {
                item.status = None;
                changed = true;
            }
        }
        Ok(changed)
    })
}

pub(crate) fn archive_automation_run_history_for_thread(
    app: &AppHandle,
    thread_id: &str,
) -> Result<(), String> {
    mutate_automation_run_history_document(app, |document| {
        let mut changed = false;
        for item in &mut document.items {
            if item.thread_id.as_deref() == Some(thread_id)
                && item.status != Some(AutomationRunHistoryStatus::Archived)
            {
                item.status = Some(AutomationRunHistoryStatus::Archived);
                changed = true;
            }
        }
        Ok(changed)
    })
}

fn mutate_automation_run_history_document<F>(app: &AppHandle, mutate: F) -> Result<(), String>
where
    F: FnOnce(&mut AutomationRunHistoryDocument) -> Result<bool, String>,
{
    let state = app.state::<Arc<AutomationRunHistoryState>>();
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "failed to lock automation run history state".to_string())?;
    let mut document = read_automation_run_history_document(app)?;
    if !mutate(&mut document)? {
        return Ok(());
    }
    write_automation_run_history_document(app, &document)?;
    invalidate_inbox_items_query(app);
    Ok(())
}

fn read_automation_run_history_document(
    app: &AppHandle,
) -> Result<AutomationRunHistoryDocument, String> {
    let path = automation_run_history_path(app)?;
    if !path.exists() {
        return Ok(AutomationRunHistoryDocument::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read {path:?}: {err}"))?;
    serde_json::from_str::<AutomationRunHistoryDocument>(&contents)
        .map_err(|err| format!("failed to parse {path:?}: {err}"))
}

fn write_automation_run_history_document(
    app: &AppHandle,
    document: &AutomationRunHistoryDocument,
) -> Result<(), String> {
    let path = automation_run_history_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("missing parent directory for {path:?}"))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create config directory {parent:?}: {err}"))?;
    let payload = serde_json::to_string_pretty(document)
        .map_err(|err| format!("failed to encode automation run history json: {err}"))?;
    fs::write(&path, payload).map_err(|err| format!("failed to write {path:?}: {err}"))
}

fn automation_run_history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("failed to resolve app config dir: {err}"))?;
    path.push(AUTOMATION_RUN_HISTORY_DIR_NAME);
    path.push(AUTOMATION_RUN_HISTORY_FILE_NAME);
    Ok(path)
}

fn invalidate_inbox_items_query(app: &AppHandle) {
    emit_query_cache_invalidate(app, vec![Value::String(INBOX_ITEMS_QUERY_KEY.to_string())]);
}

fn current_timestamp_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("system clock error: {err}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| "timestamp overflow".to_string())
}

fn next_automation_run_history_item_id(now: u64) -> String {
    let suffix = AUTOMATION_RUN_HISTORY_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("automation-run-history-{now}-{suffix}")
}
