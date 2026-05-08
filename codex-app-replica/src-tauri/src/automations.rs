use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use tauri::State;

use crate::auth_bridge::start_thread_with_personality;
use crate::auth_bridge::start_turn_with_personality;
use crate::auth_bridge::AuthBridgeState;
use crate::codex_home::resolve_codex_home;

const AUTOMATIONS_DIR: &str = "automations";
const AUTOMATION_FILE_NAME: &str = "automation.toml";
const AUTOMATION_UPDATE_MISSING_MESSAGE: &str =
    "Automation does not exist in the app and could not be updated. It may have been deleted manually by the user.";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AutomationStatus {
    Active,
    Paused,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationThreadRunResult {
    pub thread_id: String,
    pub turn_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationItemResponse {
    pub item: AutomationRecord,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AutomationDeleteStatus {
    Deleted,
    NotFound,
    InvalidId,
    StoreUnavailable,
    StateCleanupFailed,
    RemoveFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationDeleteResponse {
    pub item: Option<AutomationRecord>,
    pub success: bool,
    pub status: AutomationDeleteStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunNowResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AutomationRecord {
    Heartbeat {
        id: String,
        name: String,
        prompt: String,
        status: AutomationStatus,
        #[serde(default)]
        created_at: Option<u64>,
        #[serde(default)]
        updated_at: Option<u64>,
        #[serde(default)]
        last_run_at: Option<u64>,
        #[serde(default)]
        next_run_at: Option<u64>,
        target_thread_id: String,
        model: Option<String>,
        reasoning_effort: Option<String>,
        rrule: String,
    },
    Cron {
        id: String,
        name: String,
        prompt: String,
        status: AutomationStatus,
        #[serde(default)]
        created_at: Option<u64>,
        #[serde(default)]
        updated_at: Option<u64>,
        #[serde(default)]
        last_run_at: Option<u64>,
        #[serde(default)]
        next_run_at: Option<u64>,
        cwds: Vec<String>,
        execution_environment: String,
        local_environment_config_path: Option<String>,
        model: Option<String>,
        reasoning_effort: Option<String>,
        rrule: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveAutomationParams {
    pub automation: AutomationRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationIdParams {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetAutomationStatusParams {
    pub id: String,
    pub status: AutomationStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationsListResponse {
    pub items: Vec<AutomationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PersistedAutomationDocument {
    pub automation: AutomationRecord,
}

#[tauri::command]
pub fn list_automations() -> Result<AutomationsListResponse, String> {
    let root = automations_root_path()?;
    if !root.is_dir() {
        return Ok(AutomationsListResponse { items: Vec::new() });
    }

    let mut items = Vec::new();
    for entry in
        fs::read_dir(&root).map_err(|err| format!("failed to read automations directory: {err}"))?
    {
        let entry = entry.map_err(|err| format!("failed to read automation entry: {err}"))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let file_path = path.join(AUTOMATION_FILE_NAME);
        if !file_path.is_file() {
            continue;
        }
        let Some(record) = read_automation_file(&file_path)? else {
            continue;
        };
        if record.status() == AutomationStatus::Deleted {
            continue;
        }
        items.push(record);
    }

    items.sort_by(|left, right| {
        left.name()
            .cmp(right.name())
            .then_with(|| left.id().cmp(right.id()))
    });
    Ok(AutomationsListResponse { items })
}

#[tauri::command(rename = "list-automations")]
pub fn list_automations_command() -> Result<AutomationsListResponse, String> {
    list_automations()
}

#[tauri::command]
pub fn read_automation(params: AutomationIdParams) -> Result<Option<AutomationRecord>, String> {
    let file_path = automation_file_path(&params.id)?;
    if !file_path.is_file() {
        return Ok(None);
    }
    read_automation_file(&file_path)
}

#[tauri::command]
pub fn save_automation(params: SaveAutomationParams) -> Result<AutomationRecord, String> {
    save_automation_inner(params.automation)
}

#[tauri::command(rename = "automation-create")]
pub fn automation_create_command(
    params: AutomationRecord,
) -> Result<AutomationItemResponse, String> {
    let item = save_automation_inner(params)?;
    Ok(AutomationItemResponse { item })
}

#[tauri::command(rename = "automation-update")]
pub fn automation_update_command(
    params: AutomationRecord,
) -> Result<AutomationItemResponse, String> {
    let item = update_automation_inner(params)?;
    Ok(AutomationItemResponse { item })
}

#[tauri::command]
pub fn set_automation_status(
    params: SetAutomationStatusParams,
) -> Result<AutomationRecord, String> {
    let Some(mut automation) = read_automation(AutomationIdParams {
        id: params.id.clone(),
    })?
    else {
        return Err("automation not found".to_string());
    };
    let previous = automation.clone();
    automation.set_status(params.status);
    let now = current_timestamp_ms()?;
    persist_automation(automation, Some(previous), now)
}

#[tauri::command]
pub fn delete_automation(params: AutomationIdParams) -> Result<(), String> {
    let file_path = automation_file_path(&params.id)?;
    if !file_path.exists() {
        return Ok(());
    }
    let automation_dir = file_path
        .parent()
        .ok_or_else(|| "automation file path has no parent directory".to_string())?;
    fs::remove_dir_all(automation_dir).map_err(|err| format!("failed to delete automation: {err}"))
}

#[tauri::command(rename = "automation-delete")]
pub fn automation_delete_command(
    params: AutomationIdParams,
) -> Result<AutomationDeleteResponse, String> {
    let item = match read_automation(AutomationIdParams {
        id: params.id.clone(),
    }) {
        Ok(item) => item,
        Err(err) if is_invalid_automation_id_error(&err) => {
            return Ok(automation_delete_response(
                None,
                AutomationDeleteStatus::InvalidId,
            ));
        }
        Err(_) => {
            return Ok(automation_delete_response(
                None,
                AutomationDeleteStatus::StoreUnavailable,
            ));
        }
    };

    match delete_automation(params) {
        Ok(()) => {
            let status = if item.is_some() {
                AutomationDeleteStatus::Deleted
            } else {
                AutomationDeleteStatus::NotFound
            };
            Ok(automation_delete_response(item, status))
        }
        Err(err) if is_invalid_automation_id_error(&err) => Ok(automation_delete_response(
            item,
            AutomationDeleteStatus::InvalidId,
        )),
        Err(_) => Ok(automation_delete_response(
            item,
            AutomationDeleteStatus::RemoveFailed,
        )),
    }
}

#[tauri::command]
pub async fn run_automation_now(
    state: State<'_, Arc<AuthBridgeState>>,
    params: AutomationIdParams,
) -> Result<AutomationThreadRunResult, String> {
    run_automation_now_inner(state.inner(), params).await
}

#[tauri::command(rename = "automation-run-now")]
pub async fn automation_run_now_command(
    state: State<'_, Arc<AuthBridgeState>>,
    params: AutomationIdParams,
) -> Result<AutomationRunNowResponse, String> {
    run_automation_now_inner(state.inner(), params).await?;
    Ok(AutomationRunNowResponse { success: true })
}

fn save_automation_inner(automation: AutomationRecord) -> Result<AutomationRecord, String> {
    let automation = normalize_automation_record(automation)?;
    let existing = read_automation(AutomationIdParams {
        id: automation.id().to_string(),
    })?;
    let now = current_timestamp_ms()?;
    persist_automation(automation, existing, now)
}

fn update_automation_inner(automation: AutomationRecord) -> Result<AutomationRecord, String> {
    let automation = normalize_automation_record(automation)?;
    let Some(existing) = read_automation(AutomationIdParams {
        id: automation.id().to_string(),
    })?
    else {
        return Err(AUTOMATION_UPDATE_MISSING_MESSAGE.to_string());
    };
    let now = current_timestamp_ms()?;
    persist_automation(automation, Some(existing), now)
}

async fn run_automation_now_inner(
    state: &Arc<AuthBridgeState>,
    params: AutomationIdParams,
) -> Result<AutomationThreadRunResult, String> {
    let Some(automation) = read_automation(params)? else {
        return Err("automation not found".to_string());
    };
    let personality = state.current_personality();

    let result: AutomationThreadRunResult = match &automation {
        AutomationRecord::Heartbeat {
            target_thread_id,
            prompt,
            ..
        } => {
            let turn_id = start_turn_with_personality(
                state,
                target_thread_id.clone(),
                prompt.clone(),
                None,
                personality,
            )
            .await?;
            Ok::<AutomationThreadRunResult, String>(AutomationThreadRunResult {
                thread_id: target_thread_id.clone(),
                turn_id,
            })
        }
        AutomationRecord::Cron { cwds, prompt, .. } => {
            let cwd = cwds.first().cloned();
            let thread_id =
                start_thread_with_personality(state, cwd.clone(), personality.clone()).await?;
            let turn_id = start_turn_with_personality(
                state,
                thread_id.clone(),
                prompt.clone(),
                cwd,
                personality,
            )
            .await?;
            Ok::<AutomationThreadRunResult, String>(AutomationThreadRunResult {
                thread_id,
                turn_id,
            })
        }
    }?;

    let now = current_timestamp_ms()?;
    let previous = automation.clone();
    let mut updated = automation;
    updated.set_last_run_at(Some(now));
    persist_automation(updated, Some(previous), now)?;

    Ok(result)
}

impl AutomationRecord {
    fn id(&self) -> &str {
        match self {
            Self::Heartbeat { id, .. } | Self::Cron { id, .. } => id,
        }
    }

    fn name(&self) -> &str {
        match self {
            Self::Heartbeat { name, .. } | Self::Cron { name, .. } => name,
        }
    }

    fn status(&self) -> AutomationStatus {
        match self {
            Self::Heartbeat { status, .. } | Self::Cron { status, .. } => *status,
        }
    }

    fn created_at(&self) -> Option<u64> {
        match self {
            Self::Heartbeat { created_at, .. } | Self::Cron { created_at, .. } => *created_at,
        }
    }

    fn last_run_at(&self) -> Option<u64> {
        match self {
            Self::Heartbeat { last_run_at, .. } | Self::Cron { last_run_at, .. } => *last_run_at,
        }
    }

    fn next_run_at(&self) -> Option<u64> {
        match self {
            Self::Heartbeat { next_run_at, .. } | Self::Cron { next_run_at, .. } => *next_run_at,
        }
    }

    fn rrule(&self) -> &str {
        match self {
            Self::Heartbeat { rrule, .. } | Self::Cron { rrule, .. } => rrule,
        }
    }

    fn set_status(&mut self, next_status: AutomationStatus) {
        match self {
            Self::Heartbeat { status, .. } | Self::Cron { status, .. } => *status = next_status,
        }
    }

    fn set_created_at(&mut self, created_at: Option<u64>) {
        match self {
            Self::Heartbeat {
                created_at: field, ..
            }
            | Self::Cron {
                created_at: field, ..
            } => {
                *field = created_at;
            }
        }
    }

    fn set_updated_at(&mut self, updated_at: Option<u64>) {
        match self {
            Self::Heartbeat {
                updated_at: field, ..
            }
            | Self::Cron {
                updated_at: field, ..
            } => {
                *field = updated_at;
            }
        }
    }

    fn set_last_run_at(&mut self, last_run_at: Option<u64>) {
        match self {
            Self::Heartbeat {
                last_run_at: field, ..
            }
            | Self::Cron {
                last_run_at: field, ..
            } => {
                *field = last_run_at;
            }
        }
    }

    fn set_next_run_at(&mut self, next_run_at: Option<u64>) {
        match self {
            Self::Heartbeat {
                next_run_at: field, ..
            }
            | Self::Cron {
                next_run_at: field, ..
            } => {
                *field = next_run_at;
            }
        }
    }
}

fn read_automation_file(file_path: &Path) -> Result<Option<AutomationRecord>, String> {
    let contents = fs::read_to_string(file_path)
        .map_err(|err| format!("failed to read automation file: {err}"))?;
    let document = toml::from_str::<PersistedAutomationDocument>(&contents).map_err(|err| {
        format!(
            "failed to parse automation file {}: {err}",
            file_path.display()
        )
    })?;
    Ok(Some(normalize_automation_record(document.automation)?))
}

fn normalize_automation_record(automation: AutomationRecord) -> Result<AutomationRecord, String> {
    match automation {
        AutomationRecord::Heartbeat {
            id,
            name,
            prompt,
            status,
            created_at,
            updated_at,
            last_run_at,
            next_run_at,
            target_thread_id,
            model: _,
            reasoning_effort: _,
            rrule,
        } => {
            let id = normalize_required_field("automation id", &id)?;
            let name = normalize_required_field("automation name", &name)?;
            let prompt = normalize_required_field("automation prompt", &prompt)?;
            let target_thread_id = normalize_required_field("target thread id", &target_thread_id)?;
            let rrule = normalize_required_field("automation rrule", &rrule)?;
            Ok(AutomationRecord::Heartbeat {
                id,
                name,
                prompt,
                status,
                created_at,
                updated_at,
                last_run_at,
                next_run_at,
                target_thread_id,
                model: None,
                reasoning_effort: None,
                rrule,
            })
        }
        AutomationRecord::Cron {
            id,
            name,
            prompt,
            status,
            created_at,
            updated_at,
            last_run_at,
            next_run_at,
            cwds,
            execution_environment,
            local_environment_config_path,
            model,
            reasoning_effort,
            rrule,
        } => {
            let id = normalize_required_field("automation id", &id)?;
            let name = normalize_required_field("automation name", &name)?;
            let prompt = normalize_required_field("automation prompt", &prompt)?;
            let execution_environment =
                normalize_required_field("execution environment", &execution_environment)?;
            let rrule = normalize_required_field("automation rrule", &rrule)?;
            let normalized_cwds = cwds
                .iter()
                .filter_map(|cwd| normalize_optional_field(cwd))
                .collect::<Vec<_>>();
            Ok(AutomationRecord::Cron {
                id,
                name,
                prompt,
                status,
                created_at,
                updated_at,
                last_run_at,
                next_run_at,
                cwds: normalized_cwds,
                execution_environment,
                local_environment_config_path: local_environment_config_path
                    .as_deref()
                    .and_then(normalize_optional_field),
                model: model.as_deref().and_then(normalize_optional_field),
                reasoning_effort: reasoning_effort
                    .as_deref()
                    .and_then(normalize_optional_field),
                rrule,
            })
        }
    }
}

fn persist_automation(
    mut automation: AutomationRecord,
    previous: Option<AutomationRecord>,
    now: u64,
) -> Result<AutomationRecord, String> {
    let previous = previous.as_ref();
    if automation.created_at().is_none() {
        automation.set_created_at(
            previous
                .and_then(AutomationRecord::created_at)
                .or(Some(now)),
        );
    }
    if automation.last_run_at().is_none() {
        automation.set_last_run_at(previous.and_then(AutomationRecord::last_run_at));
    }
    automation.set_updated_at(Some(now));

    let next_run_at = if should_preserve_next_run_at(previous, &automation, now) {
        previous.and_then(AutomationRecord::next_run_at)
    } else {
        compute_next_run_at(&automation, now)
    };
    automation.set_next_run_at(next_run_at);

    write_automation_file(&automation)?;
    Ok(automation)
}

fn should_preserve_next_run_at(
    previous: Option<&AutomationRecord>,
    automation: &AutomationRecord,
    now: u64,
) -> bool {
    let Some(previous) = previous else {
        return false;
    };

    previous.status() == AutomationStatus::Active
        && automation.status() == AutomationStatus::Active
        && previous.rrule() == automation.rrule()
        && previous
            .next_run_at()
            .is_some_and(|next_run_at| next_run_at > now)
}

fn write_automation_file(automation: &AutomationRecord) -> Result<(), String> {
    let file_path = automation_file_path(automation.id())?;
    let parent = file_path
        .parent()
        .ok_or_else(|| "automation path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create automation directory: {err}"))?;

    let contents = toml::to_string(&PersistedAutomationDocument {
        automation: automation.clone(),
    })
    .map_err(|err| format!("failed to serialize automation: {err}"))?;
    let contents = ensure_trailing_newline(contents);
    fs::write(&file_path, contents).map_err(|err| format!("failed to write automation file: {err}"))
}

fn automation_delete_response(
    item: Option<AutomationRecord>,
    status: AutomationDeleteStatus,
) -> AutomationDeleteResponse {
    AutomationDeleteResponse {
        item,
        success: matches!(
            status,
            AutomationDeleteStatus::Deleted | AutomationDeleteStatus::NotFound
        ),
        status,
    }
}

fn current_timestamp_ms() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|err| format!("failed to read current time: {err}"))
}

fn compute_next_run_at(automation: &AutomationRecord, now: u64) -> Option<u64> {
    if automation.status() != AutomationStatus::Active {
        return None;
    }

    let interval_ms = parse_rrule_interval_ms(automation.rrule())?;
    let anchor = automation.last_run_at().unwrap_or(now);
    let mut next_run_at = anchor.checked_add(interval_ms)?;
    if next_run_at <= now {
        let elapsed = now.checked_sub(next_run_at)?;
        let steps = elapsed / interval_ms + 1;
        next_run_at = next_run_at.checked_add(interval_ms.checked_mul(steps)?)?;
    }
    Some(next_run_at)
}

fn parse_rrule_interval_ms(rrule: &str) -> Option<u64> {
    let mut frequency = None;
    let mut interval = 1_u64;

    for part in rrule.split(';') {
        let (key, value) = part.split_once('=')?;
        let key = key.trim().to_ascii_uppercase();
        let value = value.trim();
        match key.as_str() {
            "FREQ" => frequency = Some(value.to_ascii_uppercase()),
            "INTERVAL" => {
                interval = value.parse().ok()?;
                if interval == 0 {
                    return None;
                }
            }
            _ => {}
        }
    }

    let multiplier_ms = match frequency.as_deref()? {
        "SECONDLY" => 1_000_u64,
        "MINUTELY" => 60_000_u64,
        "HOURLY" => 3_600_000_u64,
        "DAILY" => 86_400_000_u64,
        "WEEKLY" => 604_800_000_u64,
        _ => return None,
    };

    interval.checked_mul(multiplier_ms)
}

fn normalize_required_field(label: &str, value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{label} is empty"));
    }
    Ok(normalized.to_string())
}

fn normalize_optional_field(value: &str) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return None;
    }
    Some(normalized.to_string())
}

fn is_invalid_automation_id_error(err: &str) -> bool {
    err == "automation id is empty" || err == "automation id must not contain path separators"
}

fn automations_root_path() -> Result<PathBuf, String> {
    Ok(resolve_codex_home()?.join(AUTOMATIONS_DIR))
}

fn automation_file_path(id: &str) -> Result<PathBuf, String> {
    let normalized_id = normalize_required_field("automation id", id)?;
    if normalized_id.contains('/') || normalized_id.contains('\\') {
        return Err("automation id must not contain path separators".to_string());
    }
    Ok(automations_root_path()?
        .join(normalized_id)
        .join(AUTOMATION_FILE_NAME))
}

fn ensure_trailing_newline(contents: String) -> String {
    if contents.ends_with('\n') {
        contents
    } else {
        format!("{contents}\n")
    }
}

#[cfg(test)]
mod tests {
    use super::automation_delete_command;
    use super::automation_delete_response;
    use super::AutomationDeleteResponse;
    use super::AutomationDeleteStatus;
    use super::AutomationIdParams;
    use super::AUTOMATION_UPDATE_MISSING_MESSAGE;
    use serde_json::json;

    #[test]
    fn automation_delete_response_uses_upstream_status_names() {
        assert_eq!(
            serde_json::to_value(automation_delete_response(
                None,
                AutomationDeleteStatus::NotFound,
            ))
            .expect("response should serialize"),
            json!({
                "item": null,
                "success": true,
                "status": "not_found",
            })
        );
    }

    #[test]
    fn automation_delete_command_maps_invalid_ids_to_upstream_failure_status() {
        assert_eq!(
            automation_delete_command(AutomationIdParams {
                id: "bad/id".to_string(),
            })
            .expect("invalid id response should not hard-fail"),
            AutomationDeleteResponse {
                item: None,
                success: false,
                status: AutomationDeleteStatus::InvalidId,
            }
        );
    }

    #[test]
    fn automation_update_missing_message_matches_upstream_constant() {
        assert_eq!(
            AUTOMATION_UPDATE_MISSING_MESSAGE,
            "Automation does not exist in the app and could not be updated. It may have been deleted manually by the user."
        );
    }
}
