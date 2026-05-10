use crate::codex_home::resolve_codex_home;
use crate::global_settings::{read_global_settings, write_global_settings};
use crate::local_environments::LocalEnvironmentDocument;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::sync::Mutex;

const ACTIVE_WORKSPACE_ROOTS_KEY: &str = "active-workspace-roots";
const LOCAL_HOST_ID: &str = "local";
const OUTPUT_TEXT_LIMIT: usize = 32_000;
const PENDING_WORKTREES_SHARED_OBJECT_KEY: &str = "pending_worktrees";
const SHARED_OBJECT_UPDATED_EVENT: &str = "shared-object-updated";
const WORKSPACE_ROOT_LABELS_KEY: &str = "electron-workspace-root-labels";
const WORKSPACE_ROOT_OPTIONS_KEY: &str = "electron-saved-workspace-roots";
const WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT: &str = "workspace-root-options-updated";
const ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT: &str = "active-workspace-roots-updated";
const CODEX_WORKTREES_DIR: &str = "worktrees";
const LOCAL_ENVIRONMENT_CONFIG_KEY: &str = "codex.localEnvironmentConfigPath";
const NO_LOCAL_ENVIRONMENT_VALUE: &str = "__none__";
const SOURCE_TREE_ENV_VAR: &str = "CODEX_SOURCE_TREE_PATH";
const WORKTREE_PATH_ENV_VAR: &str = "CODEX_WORKTREE_PATH";
static NEXT_WORKTREE_DIR_NONCE: AtomicU64 = AtomicU64::new(0);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Default)]
pub struct PendingWorktreesState {
    inner: Mutex<PendingWorktreesStore>,
    next_runtime_nonce: AtomicU64,
}

#[derive(Debug, Default)]
struct PendingWorktreesStore {
    states_by_id: HashMap<String, PendingWorktreeStateRecord>,
}

#[derive(Debug)]
struct PendingWorktreeStateRecord {
    entry: PendingWorktreeEntry,
    runtime: Option<Arc<PendingWorktreeRuntime>>,
}

#[derive(Debug)]
struct PendingWorktreeRuntime {
    nonce: u64,
    cancelled: AtomicBool,
    active_process_id: Mutex<Option<u32>>,
    allocated_git_root: Mutex<Option<String>>,
    source_git_root: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SharedObjectUpdatedNotification {
    key: String,
    value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingWorktreeEntry {
    pub id: String,
    pub host_id: String,
    pub created_at: u64,
    pub phase: PendingWorktreePhase,
    pub label_edited: bool,
    pub output_text: String,
    pub error_message: Option<String>,
    pub worktree_workspace_root: Option<String>,
    pub worktree_git_root: Option<String>,
    pub needs_attention: bool,
    pub is_pinned: bool,
    pub pinned_before_thread_id: Option<String>,
    pub label: Option<String>,
    pub initial_thread_title: Option<String>,
    pub source_workspace_root: String,
    pub starting_state: Option<PendingWorktreeStartingState>,
    pub local_environment_config_path: Option<String>,
    pub prompt: String,
    pub launch_mode: PendingWorktreeLaunchMode,
    pub start_conversation_params_input: Option<Value>,
    pub thread_goal_objective: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_collaboration_mode: Option<Value>,
    pub target_turn_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PendingWorktreePhase {
    Queued,
    Creating,
    WorktreeReady,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PendingWorktreeLaunchMode {
    CreateStableWorktree,
    ForkConversation,
    StartConversation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum PendingWorktreeStartingState {
    #[serde(rename = "working-tree")]
    WorkingTree,
    #[serde(rename = "branch")]
    Branch {
        #[serde(rename = "branchName")]
        branch_name: String,
    },
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingWorktreeCreateRequest {
    pub id: String,
    pub host_id: String,
    pub label: Option<String>,
    pub initial_thread_title: Option<String>,
    pub source_workspace_root: String,
    pub starting_state: Option<PendingWorktreeStartingState>,
    pub local_environment_config_path: Option<String>,
    pub prompt: String,
    pub launch_mode: PendingWorktreeLaunchMode,
    pub start_conversation_params_input: Option<Value>,
    pub thread_goal_objective: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_collaboration_mode: Option<Value>,
    pub target_turn_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PendingWorktreeMetadataUpdate {
    IsPinned {
        #[serde(rename = "isPinned")]
        is_pinned: bool,
    },
    PinnedBeforeThreadId {
        #[serde(rename = "beforeThreadId")]
        before_thread_id: Option<String>,
    },
    Label {
        label: String,
    },
    LabelEdited {
        #[serde(rename = "labelEdited")]
        label_edited: bool,
    },
    NeedsAttention {
        #[serde(rename = "needsAttention")]
        needs_attention: bool,
    },
}

#[derive(Debug, Clone)]
struct CreatedWorktree {
    worktree_git_root: String,
    worktree_workspace_root: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum CreateFailure {
    Cancelled,
    Message(String),
}

#[cfg(test)]
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PendingWorktreeCreateEnvelope {
    host_id: String,
    request: PendingWorktreeCreateRequest,
}

#[cfg(test)]
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PendingWorktreeMetadataEnvelope {
    host_id: String,
    id: String,
    update: PendingWorktreeMetadataUpdate,
}

#[tauri::command(rename = "pending-worktree-create")]
pub async fn pending_worktree_create(
    app: AppHandle,
    state: State<'_, Arc<PendingWorktreesState>>,
    host_id: String,
    request: PendingWorktreeCreateRequest,
) -> Result<(), String> {
    ensure_supported_host_id(Some(host_id.as_str()), "pending-worktree-create")?;
    ensure_supported_host_id(Some(request.host_id.as_str()), "pending-worktree-create")?;
    if host_id != request.host_id {
        return Err("pending-worktree-create hostId mismatch".to_string());
    }

    let id = validate_pending_worktree_id(&request.id)?;
    let entry = PendingWorktreeEntry {
        id: id.to_string(),
        host_id,
        created_at: now_unix_ms(),
        phase: PendingWorktreePhase::Queued,
        label_edited: false,
        output_text: String::new(),
        error_message: None,
        worktree_workspace_root: None,
        worktree_git_root: None,
        needs_attention: false,
        is_pinned: false,
        pinned_before_thread_id: None,
        label: request.label,
        initial_thread_title: request.initial_thread_title,
        source_workspace_root: request.source_workspace_root,
        starting_state: request.starting_state,
        local_environment_config_path: request.local_environment_config_path,
        prompt: request.prompt,
        launch_mode: request.launch_mode,
        start_conversation_params_input: request.start_conversation_params_input,
        thread_goal_objective: request.thread_goal_objective,
        source_conversation_id: request.source_conversation_id,
        source_collaboration_mode: request.source_collaboration_mode,
        target_turn_id: request.target_turn_id,
    };

    {
        let mut guard = state.inner.lock().await;
        if guard.states_by_id.contains_key(id) {
            return Ok(());
        }
        guard.states_by_id.insert(
            id.to_string(),
            PendingWorktreeStateRecord {
                entry,
                runtime: None,
            },
        );
    }
    publish_pending_worktrees(&app, state.inner.lock().await.collect_entries_for_publish())?;
    start_pending_worktree_create(app, state.inner().clone(), id.to_string()).await;
    Ok(())
}

#[tauri::command(rename = "pending-worktree-update-metadata")]
pub async fn pending_worktree_update_metadata(
    app: AppHandle,
    state: State<'_, Arc<PendingWorktreesState>>,
    host_id: String,
    id: String,
    update: PendingWorktreeMetadataUpdate,
) -> Result<(), String> {
    ensure_supported_host_id(Some(host_id.as_str()), "pending-worktree-update-metadata")?;
    let snapshot = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.get_mut(&id) else {
            return Ok(());
        };
        record.entry = apply_metadata_update(record.entry.clone(), update);
        guard.collect_entries_for_publish()
    };
    publish_pending_worktrees(&app, snapshot)?;
    Ok(())
}

#[tauri::command(rename = "pending-worktree-retry")]
pub async fn pending_worktree_retry(
    app: AppHandle,
    state: State<'_, Arc<PendingWorktreesState>>,
    host_id: String,
    id: String,
) -> Result<(), String> {
    ensure_supported_host_id(Some(host_id.as_str()), "pending-worktree-retry")?;
    let restarted = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.get_mut(&id) else {
            return Ok(());
        };
        if let Some(runtime) = record.runtime.take() {
            abort_runtime(runtime).await;
        }
        record.entry.phase = PendingWorktreePhase::Queued;
        record.entry.output_text.clear();
        record.entry.error_message = None;
        record.entry.worktree_workspace_root = None;
        record.entry.worktree_git_root = None;
        record.entry.needs_attention = false;
        guard.collect_entries_for_publish()
    };
    publish_pending_worktrees(&app, restarted)?;
    start_pending_worktree_create(app, state.inner().clone(), id).await;
    Ok(())
}

#[tauri::command(rename = "pending-worktree-cancel")]
pub async fn pending_worktree_cancel(
    app: AppHandle,
    state: State<'_, Arc<PendingWorktreesState>>,
    host_id: String,
    id: String,
) -> Result<(), String> {
    ensure_supported_host_id(Some(host_id.as_str()), "pending-worktree-cancel")?;
    let (runtime, entry, snapshot) = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.remove(&id) else {
            return Ok(());
        };
        let snapshot = guard.collect_entries_for_publish();
        (record.runtime, record.entry, snapshot)
    };
    if let Some(runtime) = runtime {
        abort_runtime(runtime).await;
    }
    publish_pending_worktrees(&app, snapshot)?;
    if let Some(worktree_git_root) = entry.worktree_git_root {
        delete_created_worktree(&entry.source_workspace_root, &worktree_git_root).await?;
    }
    Ok(())
}

#[tauri::command(rename = "pending-worktree-dismiss")]
pub async fn pending_worktree_dismiss(
    app: AppHandle,
    state: State<'_, Arc<PendingWorktreesState>>,
    host_id: String,
    id: String,
) -> Result<(), String> {
    ensure_supported_host_id(Some(host_id.as_str()), "pending-worktree-dismiss")?;
    let (runtime, snapshot) = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.remove(&id) else {
            return Ok(());
        };
        let snapshot = guard.collect_entries_for_publish();
        (record.runtime, snapshot)
    };
    if let Some(runtime) = runtime {
        abort_runtime(runtime).await;
    }
    publish_pending_worktrees(&app, snapshot)?;
    Ok(())
}

pub(crate) async fn pending_worktrees_snapshot_value(app: &AppHandle) -> Result<Value, String> {
    let state = app.state::<Arc<PendingWorktreesState>>();
    let entries = {
        let guard = state.inner.lock().await;
        guard.collect_entries_for_publish()
    };
    serde_json::to_value(entries)
        .map_err(|err| format!("failed to encode pending_worktrees shared object: {err}"))
}

pub(crate) const fn pending_worktrees_shared_object_key() -> &'static str {
    PENDING_WORKTREES_SHARED_OBJECT_KEY
}

impl PendingWorktreesStore {
    fn collect_entries_for_publish(&self) -> Vec<PendingWorktreeEntry> {
        let mut entries = self
            .states_by_id
            .values()
            .map(|record| record.entry.clone())
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.created_at);
        entries
    }
}

impl PendingWorktreeRuntime {
    fn new(nonce: u64) -> Arc<Self> {
        Arc::new(Self {
            nonce,
            cancelled: AtomicBool::new(false),
            active_process_id: Mutex::new(None),
            allocated_git_root: Mutex::new(None),
            source_git_root: Mutex::new(None),
        })
    }
}

async fn start_pending_worktree_create(
    app: AppHandle,
    state: Arc<PendingWorktreesState>,
    id: String,
) {
    let runtime = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.get_mut(&id) else {
            return;
        };
        let nonce = state.next_runtime_nonce.fetch_add(1, Ordering::Relaxed) + 1;
        let runtime = PendingWorktreeRuntime::new(nonce);
        record.runtime = Some(runtime.clone());
        record.entry.phase = PendingWorktreePhase::Creating;
        record.entry.output_text = append_output_text("", "[info] Starting worktree creation\n");
        runtime
    };
    publish_pending_worktrees(&app, state.inner.lock().await.collect_entries_for_publish()).ok();
    tauri::async_runtime::spawn(async move {
        let result = create_pending_worktree(&app, &state, &id, runtime.clone()).await;
        finish_pending_worktree_create(app, state, id, runtime, result).await;
    });
}

async fn finish_pending_worktree_create(
    app: AppHandle,
    state: Arc<PendingWorktreesState>,
    id: String,
    runtime: Arc<PendingWorktreeRuntime>,
    result: Result<CreatedWorktree, CreateFailure>,
) {
    match result {
        Ok(created) => {
            let launch_mode = {
                let mut guard = state.inner.lock().await;
                let Some(record) = guard.states_by_id.get_mut(&id) else {
                    return;
                };
                if record.runtime.as_ref().map(|active| active.nonce) != Some(runtime.nonce) {
                    return;
                }
                record.runtime = None;
                record.entry.phase = PendingWorktreePhase::WorktreeReady;
                record.entry.worktree_git_root = Some(created.worktree_git_root.clone());
                record.entry.worktree_workspace_root =
                    Some(created.worktree_workspace_root.clone());
                record.entry.launch_mode.clone()
            };
            if launch_mode == PendingWorktreeLaunchMode::CreateStableWorktree {
                let label = {
                    let mut guard = state.inner.lock().await;
                    let Some(record) = guard.states_by_id.remove(&id) else {
                        return;
                    };
                    record.entry.label
                };
                add_workspace_root_from_pending_worktree(
                    &app,
                    &created.worktree_workspace_root,
                    label,
                )
                .await
                .ok();
            }
            publish_pending_worktrees(&app, state.inner.lock().await.collect_entries_for_publish())
                .ok();
        }
        Err(CreateFailure::Cancelled) => {}
        Err(CreateFailure::Message(message)) => {
            {
                let mut guard = state.inner.lock().await;
                let Some(record) = guard.states_by_id.get_mut(&id) else {
                    return;
                };
                if record.runtime.as_ref().map(|active| active.nonce) != Some(runtime.nonce) {
                    return;
                }
                record.runtime = None;
                record.entry.phase = PendingWorktreePhase::Failed;
                record.entry.error_message = Some(message.clone());
                record.entry.needs_attention = true;
                record.entry.output_text =
                    append_output_text(&record.entry.output_text, &format!("[stderr] {message}\n"));
            }
            publish_pending_worktrees(&app, state.inner.lock().await.collect_entries_for_publish())
                .ok();
        }
    }
}

async fn create_pending_worktree(
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
    runtime: Arc<PendingWorktreeRuntime>,
) -> Result<CreatedWorktree, CreateFailure> {
    let request = {
        let guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.get(id) else {
            return Err(CreateFailure::Cancelled);
        };
        if record.runtime.as_ref().map(|active| active.nonce) != Some(runtime.nonce) {
            return Err(CreateFailure::Cancelled);
        }
        record.entry.clone()
    };

    let source_workspace_root = resolve_existing_directory(&request.source_workspace_root)
        .map_err(CreateFailure::Message)?;
    let source_git_root =
        resolve_source_git_root(&source_workspace_root, runtime.clone(), app, state, id).await?;
    *runtime.source_git_root.lock().await = Some(source_git_root.display().to_string());
    ensure_not_cancelled(&runtime)?;

    let starting_ref = resolve_starting_ref(
        &source_git_root,
        request.starting_state.clone(),
        runtime.clone(),
        app,
        state,
        id,
    )
    .await?;
    let (worktree_git_root, worktree_workspace_root) =
        compute_worktree_paths(&source_git_root, &source_workspace_root)
            .map_err(CreateFailure::Message)?;
    *runtime.allocated_git_root.lock().await = Some(worktree_git_root.display().to_string());
    ensure_not_cancelled(&runtime)?;

    let mut worktree_add_command = git_command(&source_git_root, &["worktree", "add", "--detach"]);
    worktree_add_command
        .arg(&worktree_git_root)
        .arg(&starting_ref);
    run_git_command_streaming(worktree_add_command, runtime.clone(), app, state, id)
        .await
        .map_err(|message| CreateFailure::Message(format!("git worktree add failed: {message}")))?;
    ensure_not_cancelled(&runtime)?;

    if matches!(
        request.starting_state,
        Some(PendingWorktreeStartingState::WorkingTree) | None
    ) {
        append_output_chunk(
            app,
            state,
            id,
            runtime.nonce,
            "[info] Applying working tree diff to new worktree\n",
        )
        .await
        .ok();
        sync_working_tree_state(&source_git_root, &worktree_git_root)
            .map_err(CreateFailure::Message)?;
    }
    ensure_not_cancelled(&runtime)?;

    append_output_chunk(
        app,
        state,
        id,
        runtime.nonce,
        &format!(
            "Worktree created at {}\n",
            worktree_workspace_root.display()
        ),
    )
    .await
    .ok();

    let selected_environment = request.local_environment_config_path.as_deref();
    if set_selected_environment_config(&worktree_git_root, selected_environment)
        .await
        .is_err()
    {
        append_output_chunk(
            app,
            state,
            id,
            runtime.nonce,
            "Failed to store selected environment in git config\n",
        )
        .await
        .ok();
    }
    match selected_environment {
        None => {
            append_output_chunk(
                app,
                state,
                id,
                runtime.nonce,
                "No local environment selected\n",
            )
            .await
            .ok();
        }
        Some(config_path) => {
            let selected_environment =
                read_selected_local_environment(config_path, &source_git_root)
                    .map_err(|err| CreateFailure::Message(err.clone()))?;
            append_output_chunk(
                app,
                state,
                id,
                runtime.nonce,
                &format!("Running setup script {config_path}\n"),
            )
            .await
            .ok();
            run_selected_environment_setup(
                &selected_environment,
                &source_workspace_root,
                &worktree_workspace_root,
                runtime.clone(),
                app,
                state,
                id,
            )
            .await?;
        }
    }

    Ok(CreatedWorktree {
        worktree_git_root: worktree_git_root.display().to_string(),
        worktree_workspace_root: worktree_workspace_root.display().to_string(),
    })
}

async fn run_selected_environment_setup(
    selected_environment: &SelectedLocalEnvironment,
    source_workspace_root: &Path,
    worktree_workspace_root: &Path,
    runtime: Arc<PendingWorktreeRuntime>,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
) -> Result<(), CreateFailure> {
    let Some(script) = resolve_setup_script(&selected_environment.environment) else {
        return Ok(());
    };
    ensure_not_cancelled(&runtime)?;

    let codex_home = resolve_codex_home().map_err(CreateFailure::Message)?;
    let script_root = codex_home
        .join("tmp")
        .join("local-environment")
        .join(unique_suffix("pending-worktree-setup"));
    fs::create_dir_all(&script_root).map_err(|err| {
        CreateFailure::Message(format!("failed to create setup temp directory: {err}"))
    })?;
    let script_path = script_root.join("setup.ps1");
    fs::write(&script_path, script).map_err(|err| {
        CreateFailure::Message(format!(
            "failed to write setup script {}: {err}",
            script_path.display()
        ))
    })?;

    let setup_cwd = worktree_workspace_root.join(&selected_environment.cwd_relative_to_git_root);
    let mut command = Command::new("powershell.exe");
    apply_no_window(&mut command);
    command
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(&script_path)
        .current_dir(&setup_cwd)
        .env(SOURCE_TREE_ENV_VAR, source_workspace_root)
        .env(WORKTREE_PATH_ENV_VAR, worktree_workspace_root)
        .env("COLORTERM", "truecolor")
        .env("FORCE_COLOR", "1")
        .env("TERM", "xterm-256color");

    let result = run_git_command_streaming(command, runtime.clone(), app, state, id)
        .await
        .map_err(CreateFailure::Message);
    let _ = fs::remove_dir_all(&script_root);
    result?;
    append_output_chunk(app, state, id, runtime.nonce, "Setup script completed\n")
        .await
        .ok();
    Ok(())
}

async fn resolve_starting_ref(
    source_git_root: &Path,
    starting_state: Option<PendingWorktreeStartingState>,
    runtime: Arc<PendingWorktreeRuntime>,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
) -> Result<String, CreateFailure> {
    let starting_state = starting_state.unwrap_or(PendingWorktreeStartingState::WorkingTree);
    let branch_name = match starting_state {
        PendingWorktreeStartingState::Branch { branch_name } => {
            if branch_name == "HEAD" {
                match resolve_current_branch(source_git_root, runtime.clone(), app, state, id).await
                {
                    Ok(Some(branch_name)) => branch_name,
                    Ok(None) | Err(_) => "HEAD".to_string(),
                }
            } else {
                branch_name
            }
        }
        PendingWorktreeStartingState::WorkingTree => {
            let current_branch =
                resolve_current_branch(source_git_root, runtime.clone(), app, state, id)
                    .await
                    .unwrap_or(None);
            current_branch
                .or_else(|| resolve_origin_head_branch(source_git_root))
                .unwrap_or_else(|| "HEAD".to_string())
        }
    };
    Ok(resolve_upstream_ahead_ref(source_git_root, &branch_name).unwrap_or(branch_name))
}

async fn resolve_current_branch(
    source_git_root: &Path,
    runtime: Arc<PendingWorktreeRuntime>,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
) -> Result<Option<String>, CreateFailure> {
    let branch = run_git_command_streaming(
        git_command(source_git_root, &["rev-parse", "--abbrev-ref", "HEAD"]),
        runtime.clone(),
        app,
        state,
        id,
    )
    .await
    .ok()
    .and_then(|output| {
        let trimmed = output.trim();
        (trimmed != "HEAD" && !trimmed.is_empty()).then(|| trimmed.to_string())
    });
    if branch.is_some() {
        return Ok(branch);
    }

    let branch = run_git_command_streaming(
        git_command(
            source_git_root,
            &["symbolic-ref", "--quiet", "--short", "HEAD"],
        ),
        runtime,
        app,
        state,
        id,
    )
    .await
    .ok()
    .and_then(|output| {
        let trimmed = output.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });
    Ok(branch)
}

fn resolve_origin_head_branch(source_git_root: &Path) -> Option<String> {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(source_git_root)
        .args(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])
        .output()
        .ok()?;
    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        return text.trim().rsplit('/').next().map(ToString::to_string);
    }

    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(source_git_root)
        .args(["remote", "show", "origin"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| line.trim().strip_prefix("HEAD branch:"))
        .map(str::trim)
        .filter(|value| *value != "(unknown)" && !value.is_empty())
        .map(ToString::to_string)
}

fn resolve_upstream_ahead_ref(source_git_root: &Path, branch_name: &str) -> Option<String> {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(source_git_root)
        .args([
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            &format!("{branch_name}@{{u}}"),
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let upstream_ref = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if upstream_ref.is_empty() {
        return None;
    }

    let compare = std::process::Command::new("git")
        .arg("-C")
        .arg(source_git_root)
        .args([
            "rev-list",
            "--left-right",
            "--count",
            &format!("{branch_name}...{upstream_ref}"),
        ])
        .output()
        .ok()?;
    if !compare.status.success() {
        return None;
    }
    let counts = String::from_utf8_lossy(&compare.stdout);
    let mut parts = counts.split_whitespace();
    let left = parts.next()?.parse::<u64>().ok()?;
    let right = parts.next()?.parse::<u64>().ok()?;
    if left == 0 && right > 0 {
        Some(upstream_ref)
    } else {
        None
    }
}

fn compute_worktree_paths(
    source_git_root: &Path,
    source_workspace_root: &Path,
) -> Result<(PathBuf, PathBuf), String> {
    let codex_home = resolve_codex_home()?;
    let worktrees_root = codex_home.join(CODEX_WORKTREES_DIR);
    let worktree_slug = short_worktree_dir_name();
    let repo_name = source_git_root
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "failed to derive worktree repository name".to_string())?;
    let worktree_git_root = worktrees_root.join(worktree_slug).join(repo_name);
    let workspace_suffix = source_workspace_root
        .strip_prefix(source_git_root)
        .map_err(|_| "workspace root is outside the source git root".to_string())?;
    Ok((
        worktree_git_root.clone(),
        if workspace_suffix.as_os_str().is_empty() {
            worktree_git_root
        } else {
            worktree_git_root.join(workspace_suffix)
        },
    ))
}

fn sync_working_tree_state(source_git_root: &Path, target_git_root: &Path) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(source_git_root)
        .arg("-c")
        .arg("core.quotePath=false")
        .args(["status", "--porcelain=v1", "--untracked-files=all"])
        .output()
        .map_err(|err| format!("failed to read git working tree state: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "failed to read git working tree state: {}",
            stderr.trim()
        ));
    }

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.len() < 4 {
            continue;
        }
        let status = &line[..2];
        let path = line[3..].trim();
        if path.is_empty() {
            continue;
        }
        if let Some((from, to)) = path.split_once(" -> ") {
            if status.contains('R') {
                remove_target_path(&target_git_root.join(from))?;
            }
            copy_source_path(source_git_root, target_git_root, to)?;
            continue;
        }
        if status == "??" {
            copy_source_path(source_git_root, target_git_root, path)?;
            continue;
        }
        if status.contains('D') {
            remove_target_path(&target_git_root.join(path))?;
            continue;
        }
        copy_source_path(source_git_root, target_git_root, path)?;
    }

    Ok(())
}

fn copy_source_path(
    source_root: &Path,
    target_root: &Path,
    relative_path: &str,
) -> Result<(), String> {
    let source = source_root.join(relative_path);
    if !source.exists() {
        return Ok(());
    }
    let target = target_root.join(relative_path);
    if source.is_dir() {
        copy_directory_recursively(&source, &target)?;
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create target parent {}: {err}", parent.display()))?;
    }
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|err| {
            format!(
                "failed to replace target directory {}: {err}",
                target.display()
            )
        })?;
    }
    fs::copy(&source, &target).map_err(|err| {
        format!(
            "failed to copy {} to {}: {err}",
            source.display(),
            target.display()
        )
    })?;
    Ok(())
}

fn copy_directory_recursively(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|err| {
        format!(
            "failed to create target directory {}: {err}",
            target.display()
        )
    })?;
    for entry in fs::read_dir(source).map_err(|err| {
        format!(
            "failed to read source directory {}: {err}",
            source.display()
        )
    })? {
        let entry = entry.map_err(|err| format!("failed to read source directory entry: {err}"))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_recursively(&source_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|err| {
                    format!(
                        "failed to create target directory {}: {err}",
                        parent.display()
                    )
                })?;
            }
            fs::copy(&source_path, &target_path).map_err(|err| {
                format!(
                    "failed to copy {} to {}: {err}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn remove_target_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|err| {
            format!(
                "failed to remove target directory {}: {err}",
                path.display()
            )
        })
    } else {
        fs::remove_file(path)
            .map_err(|err| format!("failed to remove target file {}: {err}", path.display()))
    }
}

async fn resolve_source_git_root(
    source_workspace_root: &Path,
    runtime: Arc<PendingWorktreeRuntime>,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
) -> Result<PathBuf, CreateFailure> {
    let output = run_git_command_streaming(
        git_command(source_workspace_root, &["rev-parse", "--show-toplevel"]),
        runtime,
        app,
        state,
        id,
    )
    .await
    .map_err(|message| CreateFailure::Message(format!("Failed to resolve git root: {message}")))?;
    resolve_existing_directory(output.trim()).map_err(CreateFailure::Message)
}

fn read_selected_local_environment(
    config_path: &str,
    source_git_root: &Path,
) -> Result<SelectedLocalEnvironment, String> {
    let config_path = resolve_absolute_path(config_path)?;
    let owner_root = local_environment_owner_root_from_config_path(&config_path)?;
    let raw = fs::read_to_string(&config_path)
        .map_err(|err| format!("failed to read local environment config: {err}"))?;
    let environment = toml::from_str::<LocalEnvironmentDocument>(&raw)
        .map_err(|err| format!("failed to parse local environment config: {err}"))?;
    let cwd_relative_to_git_root = owner_root
        .strip_prefix(source_git_root)
        .map(Path::to_path_buf)
        .map_err(|_| {
            format!(
                "local environment root must stay under the source git root: {}",
                owner_root.display()
            )
        })?;
    Ok(SelectedLocalEnvironment {
        cwd_relative_to_git_root,
        environment,
    })
}

fn resolve_setup_script(environment: &LocalEnvironmentDocument) -> Option<String> {
    let script = environment
        .setup
        .win32
        .as_ref()
        .map(|platform| platform.script.trim())
        .filter(|script| !script.is_empty())
        .or_else(|| {
            let script = environment.setup.script.trim();
            (!script.is_empty()).then_some(script)
        })?;
    Some(script.replace("\r\n", "\n"))
}

async fn set_selected_environment_config(
    worktree_git_root: &Path,
    selected_environment: Option<&str>,
) -> Result<(), String> {
    let value = selected_environment.unwrap_or(NO_LOCAL_ENVIRONMENT_VALUE);
    let result = std::process::Command::new("git")
        .arg("-C")
        .arg(worktree_git_root)
        .args(["config", "--worktree", LOCAL_ENVIRONMENT_CONFIG_KEY, value])
        .output()
        .map_err(|err| format!("failed to write local environment config to git: {err}"))?;
    if result.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&result.stderr).to_lowercase();
    if !stderr.contains("worktreeconfig") {
        return Err(String::from_utf8_lossy(&result.stderr).trim().to_string());
    }
    let enable = std::process::Command::new("git")
        .arg("-C")
        .arg(worktree_git_root)
        .args(["config", "extensions.worktreeConfig", "true"])
        .output()
        .map_err(|err| format!("failed to enable git worktree config: {err}"))?;
    if !enable.status.success() {
        return Err(String::from_utf8_lossy(&enable.stderr).trim().to_string());
    }
    let retry = std::process::Command::new("git")
        .arg("-C")
        .arg(worktree_git_root)
        .args(["config", "--worktree", LOCAL_ENVIRONMENT_CONFIG_KEY, value])
        .output()
        .map_err(|err| format!("failed to retry local environment git config write: {err}"))?;
    if retry.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&retry.stderr).trim().to_string())
    }
}

async fn run_git_command_streaming(
    mut command: Command,
    runtime: Arc<PendingWorktreeRuntime>,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
) -> Result<String, String> {
    ensure_not_cancelled(&runtime).map_err(|_| "Request canceled".to_string())?;
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|err| format!("failed to start command: {err}"))?;
    {
        let mut process_id = runtime.active_process_id.lock().await;
        *process_id = child.id();
    }
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let state_stdout = state.clone();
    let state_stderr = state.clone();
    let stdout_id = id.to_string();
    let stderr_id = id.to_string();
    let runtime_nonce = runtime.nonce;
    let stdout_task = tauri::async_runtime::spawn(async move {
        if let Some(stdout) = stdout {
            read_stream_chunks(
                stdout,
                &app_stdout,
                &state_stdout,
                &stdout_id,
                runtime_nonce,
            )
            .await
        } else {
            Ok(String::new())
        }
    });
    let stderr_task = tauri::async_runtime::spawn(async move {
        if let Some(stderr) = stderr {
            read_stream_chunks(
                stderr,
                &app_stderr,
                &state_stderr,
                &stderr_id,
                runtime_nonce,
            )
            .await
        } else {
            Ok(String::new())
        }
    });
    let status = child
        .wait()
        .await
        .map_err(|err| format!("command failed to complete: {err}"))?;
    let stdout = stdout_task
        .await
        .map_err(|err| format!("failed to read stdout stream: {err}"))??;
    let stderr = stderr_task
        .await
        .map_err(|err| format!("failed to read stderr stream: {err}"))??;
    {
        let mut process_id = runtime.active_process_id.lock().await;
        *process_id = None;
    }
    if runtime.cancelled.load(Ordering::Relaxed) {
        return Err("Request canceled".to_string());
    }
    if status.success() {
        Ok(stdout)
    } else {
        let fallback = stderr.trim();
        if !fallback.is_empty() {
            Err(fallback.to_string())
        } else {
            Err(stdout.trim().to_string())
        }
    }
}

async fn read_stream_chunks<R: AsyncRead + Unpin>(
    mut reader: R,
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
    runtime_nonce: u64,
) -> Result<String, String> {
    let mut output = String::new();
    let mut buffer = [0u8; 4096];
    loop {
        let read = reader
            .read(&mut buffer)
            .await
            .map_err(|err| format!("failed to read process output: {err}"))?;
        if read == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buffer[..read]).into_owned();
        output.push_str(&chunk);
        append_output_chunk(app, state, id, runtime_nonce, &chunk).await?;
    }
    Ok(output)
}

async fn append_output_chunk(
    app: &AppHandle,
    state: &Arc<PendingWorktreesState>,
    id: &str,
    runtime_nonce: u64,
    chunk: &str,
) -> Result<(), String> {
    let snapshot = {
        let mut guard = state.inner.lock().await;
        let Some(record) = guard.states_by_id.get_mut(id) else {
            return Ok(());
        };
        if record.runtime.as_ref().map(|runtime| runtime.nonce) != Some(runtime_nonce) {
            return Ok(());
        }
        record.entry.output_text = append_output_text(&record.entry.output_text, chunk);
        guard.collect_entries_for_publish()
    };
    publish_pending_worktrees(app, snapshot)
}

async fn abort_runtime(runtime: Arc<PendingWorktreeRuntime>) {
    runtime.cancelled.store(true, Ordering::Relaxed);
    #[cfg(target_os = "windows")]
    {
        let process_id = *runtime.active_process_id.lock().await;
        if let Some(process_id) = process_id {
            let _ = std::process::Command::new("taskkill")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["/F", "/T", "/PID", &process_id.to_string()])
                .status();
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let process_id = *runtime.active_process_id.lock().await;
        if let Some(process_id) = process_id {
            let _ = std::process::Command::new("kill")
                .args(["-TERM", &process_id.to_string()])
                .status();
        }
    }
}

fn ensure_not_cancelled(runtime: &PendingWorktreeRuntime) -> Result<(), CreateFailure> {
    if runtime.cancelled.load(Ordering::Relaxed) {
        Err(CreateFailure::Cancelled)
    } else {
        Ok(())
    }
}

async fn add_workspace_root_from_pending_worktree(
    app: &AppHandle,
    root: &str,
    label: Option<String>,
) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    let normalized_root = normalize_required_root(root, "root")?;
    let mut roots = read_string_array_raw(&settings, WORKSPACE_ROOT_OPTIONS_KEY);
    if !roots.iter().any(|existing| existing == &normalized_root) {
        roots.push(normalized_root.clone());
        write_string_array(
            &mut settings,
            WORKSPACE_ROOT_OPTIONS_KEY,
            &dedupe_strings(roots),
        );
    }
    let had_active_roots = !read_string_array_raw(&settings, ACTIVE_WORKSPACE_ROOTS_KEY).is_empty();
    if !had_active_roots {
        write_string_array(
            &mut settings,
            ACTIVE_WORKSPACE_ROOTS_KEY,
            &[normalized_root.clone()],
        );
    }
    let mut labels = normalize_workspace_root_labels(settings.get(WORKSPACE_ROOT_LABELS_KEY));
    labels.insert(normalized_root, label.unwrap_or_default());
    write_workspace_root_labels(&mut settings, &labels);
    write_global_settings(app, &settings)?;
    if !had_active_roots {
        let _ = app.emit(ACTIVE_WORKSPACE_ROOTS_UPDATED_EVENT, ());
    }
    let _ = app.emit(WORKSPACE_ROOT_OPTIONS_UPDATED_EVENT, ());
    Ok(())
}

async fn delete_created_worktree(
    source_workspace_root: &str,
    worktree_git_root: &str,
) -> Result<(), String> {
    let source_workspace_root = resolve_existing_directory(source_workspace_root)?;
    let worktree_git_root = resolve_absolute_path(worktree_git_root)?;
    if worktree_git_root.exists() {
        let output = std::process::Command::new("git")
            .arg("-C")
            .arg(&source_workspace_root)
            .args(["worktree", "remove", "--force"])
            .arg(&worktree_git_root)
            .output()
            .map_err(|err| format!("failed to delete worktree: {err}"))?;
        if !output.status.success() && worktree_git_root.exists() {
            fs::remove_dir_all(&worktree_git_root).map_err(|err| {
                format!(
                    "failed to remove worktree directory {}: {err}",
                    worktree_git_root.display()
                )
            })?;
        }
    }
    if let Some(parent) = worktree_git_root.parent() {
        remove_empty_parent_chain(parent)?;
    }
    Ok(())
}

fn remove_empty_parent_chain(path: &Path) -> Result<(), String> {
    let worktrees_root =
        normalize_existing_or_lexical(resolve_codex_home()?.join(CODEX_WORKTREES_DIR))?;
    let mut current = normalize_existing_or_lexical(path)?;
    while current.starts_with(&worktrees_root) && current != worktrees_root {
        if fs::read_dir(&current)
            .map_err(|err| format!("failed to read {}: {err}", current.display()))?
            .next()
            .is_some()
        {
            break;
        }
        fs::remove_dir(&current)
            .map_err(|err| format!("failed to remove {}: {err}", current.display()))?;
        let Some(parent) = current.parent() else {
            break;
        };
        current = parent.to_path_buf();
    }
    Ok(())
}

fn publish_pending_worktrees(
    app: &AppHandle,
    entries: Vec<PendingWorktreeEntry>,
) -> Result<(), String> {
    let value = serde_json::to_value(entries)
        .map_err(|err| format!("failed to encode pending_worktrees update payload: {err}"))?;
    app.emit(
        SHARED_OBJECT_UPDATED_EVENT,
        SharedObjectUpdatedNotification {
            key: PENDING_WORKTREES_SHARED_OBJECT_KEY.to_string(),
            value,
        },
    )
    .map_err(|err| format!("failed to emit shared-object-updated: {err}"))
}

fn apply_metadata_update(
    mut entry: PendingWorktreeEntry,
    update: PendingWorktreeMetadataUpdate,
) -> PendingWorktreeEntry {
    match update {
        PendingWorktreeMetadataUpdate::IsPinned { is_pinned } => {
            entry.is_pinned = is_pinned;
        }
        PendingWorktreeMetadataUpdate::PinnedBeforeThreadId { before_thread_id } => {
            entry.pinned_before_thread_id = before_thread_id;
        }
        PendingWorktreeMetadataUpdate::Label { label } => {
            entry.label = Some(label);
        }
        PendingWorktreeMetadataUpdate::LabelEdited { label_edited } => {
            entry.label_edited = label_edited;
        }
        PendingWorktreeMetadataUpdate::NeedsAttention { needs_attention } => {
            entry.needs_attention = needs_attention;
        }
    }
    entry
}

fn validate_pending_worktree_id(id: &str) -> Result<&str, String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("pending-worktree-create id is empty".to_string());
    }
    Ok(trimmed)
}

fn append_output_text(current: &str, next: &str) -> String {
    if next.is_empty() {
        return current.to_string();
    }
    let combined = format!("{current}{next}");
    let char_count = combined.chars().count();
    if char_count <= OUTPUT_TEXT_LIMIT {
        return combined;
    }
    combined
        .chars()
        .skip(char_count - OUTPUT_TEXT_LIMIT)
        .collect()
}

fn ensure_supported_host_id(host_id: Option<&str>, command_name: &str) -> Result<(), String> {
    match host_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(LOCAL_HOST_ID) => Ok(()),
        Some(host_id) => Err(format!(
            "{command_name} does not support host id: {host_id}"
        )),
    }
}

fn resolve_existing_directory(path: &str) -> Result<PathBuf, String> {
    let resolved = resolve_absolute_path(path)?;
    if !resolved.is_dir() {
        return Err(format!("directory does not exist: {}", resolved.display()));
    }
    resolved
        .canonicalize()
        .map_err(|err| format!("failed to resolve directory {}: {err}", resolved.display()))
}

fn resolve_absolute_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path is empty".to_string());
    }
    let path = Path::new(trimmed);
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|err| format!("failed to resolve current directory: {err}"))?
            .join(path)
    };
    Ok(normalize_path_lexically(&candidate))
}

fn local_environment_owner_root_from_config_path(path: &Path) -> Result<PathBuf, String> {
    if path.extension().and_then(|extension| extension.to_str()) != Some("toml") {
        return Err(format!(
            "local environment config path must be a TOML file: {}",
            path.display()
        ));
    }
    let Some(parent) = path.parent() else {
        return Err(format!(
            "local environment config path has no parent directory: {}",
            path.display()
        ));
    };
    if parent.file_name().and_then(|name| name.to_str()) != Some("environments") {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    }
    let Some(codex_dir) = parent.parent() else {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    };
    if codex_dir.file_name().and_then(|name| name.to_str()) != Some(".codex") {
        return Err(format!(
            "local environment config path must live under .codex/environments: {}",
            path.display()
        ));
    }
    let Some(owner_root) = codex_dir.parent() else {
        return Err(format!(
            "local environment config path must have a workspace owner directory: {}",
            path.display()
        ));
    };
    if owner_root.exists() {
        owner_root
            .canonicalize()
            .map_err(|err| format!("failed to resolve local environment owner root: {err}"))
    } else {
        Ok(normalize_path_lexically(owner_root))
    }
}

fn normalize_existing_or_lexical(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path.as_ref();
    if path.exists() {
        path.canonicalize()
            .map_err(|err| format!("failed to resolve path {}: {err}", path.display()))
    } else {
        Ok(normalize_path_lexically(path))
    }
}

fn normalize_path_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push(component.as_os_str());
                }
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after the unix epoch")
        .as_millis() as u64
}

fn unique_suffix(prefix: &str) -> String {
    let value = now_unix_ms();
    format!("{prefix}-{value:016x}")
}

fn short_worktree_dir_name() -> String {
    let value = (now_unix_ms() ^ NEXT_WORKTREE_DIR_NONCE.fetch_add(1, Ordering::Relaxed)) as u16;
    format!("{value:04x}")
}

fn git_command(cwd: &Path, args: &[&str]) -> Command {
    let mut command = Command::new("git");
    apply_no_window(&mut command);
    command.arg("-C").arg(cwd).args(args);
    command
}

fn apply_no_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn read_string_array_raw(settings: &Map<String, Value>, key: &str) -> Vec<String> {
    match settings.get(key) {
        Some(Value::Array(entries)) => entries
            .iter()
            .filter_map(|entry| entry.as_str().map(ToString::to_string))
            .collect(),
        _ => Vec::new(),
    }
}

fn write_string_array(settings: &mut Map<String, Value>, key: &str, values: &[String]) {
    settings.insert(
        key.to_string(),
        Value::Array(values.iter().cloned().map(Value::String).collect()),
    );
}

fn normalize_workspace_root_labels(value: Option<&Value>) -> BTreeMap<String, String> {
    let Some(Value::Object(labels)) = value else {
        return BTreeMap::new();
    };
    let mut normalized = BTreeMap::new();
    for (root, label) in labels {
        let Some(root) = normalize_optional_root(root) else {
            continue;
        };
        let Some(label) = label.as_str() else {
            continue;
        };
        normalized.insert(root, label.to_string());
    }
    normalized
}

fn write_workspace_root_labels(
    settings: &mut Map<String, Value>,
    labels: &BTreeMap<String, String>,
) {
    let mut serialized = Map::new();
    for (root, label) in labels {
        serialized.insert(root.clone(), Value::String(label.clone()));
    }
    settings.insert(
        WORKSPACE_ROOT_LABELS_KEY.to_string(),
        Value::Object(serialized),
    );
}

fn normalize_optional_root(root: &str) -> Option<String> {
    let trimmed = root.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn normalize_required_root(root: &str, parameter_name: &str) -> Result<String, String> {
    normalize_optional_root(root).ok_or_else(|| format!("{parameter_name} is empty"))
}

fn dedupe_strings(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for value in values {
        if seen.insert(value.clone()) {
            deduped.push(value);
        }
    }
    deduped
}

#[derive(Debug, Clone)]
struct SelectedLocalEnvironment {
    cwd_relative_to_git_root: PathBuf,
    environment: LocalEnvironmentDocument,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn pending_worktree_create_payload_accepts_upstream_shape() {
        let payload: PendingWorktreeCreateEnvelope = serde_json::from_value(json!({
            "hostId": "local",
            "request": {
                "id": "local:pending-123",
                "hostId": "local",
                "label": "Demo",
                "initialThreadTitle": "Demo thread",
                "sourceWorkspaceRoot": "D:/repo",
                "startingState": { "type": "working-tree" },
                "localEnvironmentConfigPath": "D:/repo/.codex/environments/environment.toml",
                "prompt": "Fix the tests",
                "launchMode": "start-conversation",
                "startConversationParamsInput": { "input": [{ "type": "text", "text": "Fix the tests" }] },
                "threadGoalObjective": "Ship the fix",
                "sourceConversationId": null,
                "sourceCollaborationMode": null,
                "targetTurnId": null
            }
        }))
        .expect("payload should deserialize");

        assert_eq!(payload.host_id, "local".to_string());
        assert_eq!(payload.request.id, "local:pending-123".to_string());
        assert_eq!(
            payload.request.starting_state,
            Some(PendingWorktreeStartingState::WorkingTree)
        );
        assert_eq!(
            payload.request.launch_mode,
            PendingWorktreeLaunchMode::StartConversation
        );
    }

    #[test]
    fn pending_worktree_metadata_payload_accepts_upstream_shape() {
        let payload: PendingWorktreeMetadataEnvelope = serde_json::from_value(json!({
            "hostId": "local",
            "id": "local:pending-123",
            "update": {
                "type": "pinnedBeforeThreadId",
                "beforeThreadId": "thread-123"
            }
        }))
        .expect("payload should deserialize");

        assert_eq!(payload.host_id, "local".to_string());
        assert_eq!(payload.id, "local:pending-123".to_string());
        assert_eq!(
            payload.update,
            PendingWorktreeMetadataUpdate::PinnedBeforeThreadId {
                before_thread_id: Some("thread-123".to_string())
            }
        );
    }

    #[test]
    fn apply_metadata_update_matches_extracted_variants() {
        let entry = PendingWorktreeEntry {
            id: "local:pending-123".to_string(),
            host_id: "local".to_string(),
            created_at: 1,
            phase: PendingWorktreePhase::Queued,
            label_edited: false,
            output_text: String::new(),
            error_message: None,
            worktree_workspace_root: None,
            worktree_git_root: None,
            needs_attention: false,
            is_pinned: false,
            pinned_before_thread_id: None,
            label: Some("Old".to_string()),
            initial_thread_title: None,
            source_workspace_root: "D:/repo".to_string(),
            starting_state: Some(PendingWorktreeStartingState::WorkingTree),
            local_environment_config_path: None,
            prompt: "Prompt".to_string(),
            launch_mode: PendingWorktreeLaunchMode::StartConversation,
            start_conversation_params_input: None,
            thread_goal_objective: None,
            source_conversation_id: None,
            source_collaboration_mode: None,
            target_turn_id: None,
        };

        let updated = apply_metadata_update(
            entry,
            PendingWorktreeMetadataUpdate::Label {
                label: "New".to_string(),
            },
        );

        assert_eq!(updated.label, Some("New".to_string()));
    }

    #[test]
    fn append_output_text_keeps_last_32000_characters() {
        let existing = "a".repeat(31_999);
        let next = "bc";

        let updated = append_output_text(&existing, next);

        assert_eq!(updated.chars().count(), 32_000);
        assert!(updated.ends_with("bc"));
    }

    #[test]
    fn collect_entries_for_publish_sorts_by_created_at() {
        let mut store = PendingWorktreesStore::default();
        store.states_by_id.insert(
            "b".to_string(),
            PendingWorktreeStateRecord {
                entry: PendingWorktreeEntry {
                    id: "b".to_string(),
                    host_id: "local".to_string(),
                    created_at: 2,
                    phase: PendingWorktreePhase::Queued,
                    label_edited: false,
                    output_text: String::new(),
                    error_message: None,
                    worktree_workspace_root: None,
                    worktree_git_root: None,
                    needs_attention: false,
                    is_pinned: false,
                    pinned_before_thread_id: None,
                    label: None,
                    initial_thread_title: None,
                    source_workspace_root: "D:/repo".to_string(),
                    starting_state: None,
                    local_environment_config_path: None,
                    prompt: "Two".to_string(),
                    launch_mode: PendingWorktreeLaunchMode::StartConversation,
                    start_conversation_params_input: None,
                    thread_goal_objective: None,
                    source_conversation_id: None,
                    source_collaboration_mode: None,
                    target_turn_id: None,
                },
                runtime: None,
            },
        );
        store.states_by_id.insert(
            "a".to_string(),
            PendingWorktreeStateRecord {
                entry: PendingWorktreeEntry {
                    id: "a".to_string(),
                    host_id: "local".to_string(),
                    created_at: 1,
                    phase: PendingWorktreePhase::Queued,
                    label_edited: false,
                    output_text: String::new(),
                    error_message: None,
                    worktree_workspace_root: None,
                    worktree_git_root: None,
                    needs_attention: false,
                    is_pinned: false,
                    pinned_before_thread_id: None,
                    label: None,
                    initial_thread_title: None,
                    source_workspace_root: "D:/repo".to_string(),
                    starting_state: None,
                    local_environment_config_path: None,
                    prompt: "One".to_string(),
                    launch_mode: PendingWorktreeLaunchMode::StartConversation,
                    start_conversation_params_input: None,
                    thread_goal_objective: None,
                    source_conversation_id: None,
                    source_collaboration_mode: None,
                    target_turn_id: None,
                },
                runtime: None,
            },
        );

        let entries = store.collect_entries_for_publish();

        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            vec!["a", "b"]
        );
    }
}
