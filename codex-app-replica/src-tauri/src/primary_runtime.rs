use crate::primary_runtime_post_install::sync_primary_runtime_post_install;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

pub(crate) const PRIMARY_RUNTIME_NAME: &str = "codex-primary-runtime";
const PRIMARY_RUNTIME_PLUGIN_DIRECTORY_NAME: &str = "openai-primary-runtime";
const PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT: &str = "primary-runtime-install-progress";
const SHARED_OBJECT_UPDATED_EVENT: &str = "shared-object-updated";
const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST: &str = "latest";
const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA: &str = "latest-alpha";
const PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON: &str = "runtime-config-missing";
const PRIMARY_RUNTIME_FEATURE_GATE_DISABLED_REASON: &str = "feature-gate-disabled";
const PRIMARY_RUNTIME_NOT_LOCAL_HOST_REASON: &str = "not-local-host";
const PRIMARY_RUNTIME_ALREADY_RUNNING_REASON: &str = "already-running";
const PRIMARY_RUNTIME_CURRENT_REASON: &str = "current";
const PRIMARY_RUNTIME_UPDATE_INTERVAL_SECS: i64 = 60 * 60;
pub const CODEX_RUNTIMES_CONFIG_SHARED_OBJECT_KEY: &str = "codex_runtimes_config";
pub const STATSIG_DEFAULT_ENABLE_FEATURES_SHARED_OBJECT_KEY: &str =
    "statsig_default_enable_features";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeHostParams {
    pub host_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeReleaseParams {
    pub host_id: String,
    #[serde(default)]
    pub release: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeInstallReleaseParams {
    pub release: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncPrimaryRuntimeSharedObjectsParams {
    #[serde(default)]
    pub codex_runtimes_config: Value,
    #[serde(default)]
    pub statsig_default_enable_features: Value,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoadPrimaryRuntimeDependenciesResponse {
    pub bundle_version: Option<String>,
    pub installed: bool,
    pub instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosePrimaryRuntimeDependenciesResponse {
    pub bundle_version: Option<String>,
    pub installed: bool,
    pub problems: Vec<PrimaryRuntimeProblem>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeProblem {
    pub kind: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeInstallResultResponse {
    pub bundle_version: Option<String>,
    pub status: PrimaryRuntimeInstallStatus,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryRuntimeInstallStatus {
    AlreadyCurrent,
    Installed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinishPrimaryRuntimeInstallResponse {
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CancelPrimaryRuntimeInstallResponse {
    pub canceled: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryRuntimeInstallProgressPhase {
    Checking,
    Downloading,
    Verifying,
    Extracting,
    Validating,
    Installed,
    Configuring,
    Ready,
    Error,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeUpdateStatusResponse {
    pub disabled_reason: Option<String>,
    pub enabled: bool,
    pub is_running: bool,
    pub next_run_at: Option<i64>,
    pub startup_checked: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeInstallProgressEvent {
    pub bundle_version: Option<String>,
    pub downloaded_bytes: Option<u64>,
    pub error_message: Option<String>,
    pub phase: PrimaryRuntimeInstallProgressPhase,
    pub release: Option<String>,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeInstallProgressNotification {
    pub host_id: String,
    pub progress: PrimaryRuntimeInstallProgressEvent,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeUpdateRunNowResponse {
    pub bundle_version: Option<String>,
    pub next_run_at: Option<i64>,
    pub reason: Option<String>,
    pub status: PrimaryRuntimeUpdateRunNowStatus,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryRuntimeUpdateRunNowStatus {
    AlreadyCurrent,
    Installed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SharedObjectUpdatedNotification {
    key: String,
    value: Value,
}

#[derive(Debug, Clone)]
struct ResolvedPrimaryRuntimeInstallConfig {
    archive_digest: Option<String>,
    archive_size: Option<u64>,
    bundle_version: Option<String>,
    download_url: String,
    release: String,
    runtime_root_directory_name: String,
}

#[derive(Debug, Clone, Default)]
struct PrimaryRuntimeSharedObjects {
    codex_runtimes_config: Option<Value>,
    statsig_default_enable_features: Option<Value>,
}

#[derive(Debug, Clone)]
struct PrimaryRuntimeStateInner {
    install_release: String,
    shared_objects: PrimaryRuntimeSharedObjects,
    install_running: bool,
    cancel_requested: bool,
    last_progress: Option<PrimaryRuntimeInstallProgressEvent>,
    next_run_at: Option<i64>,
    startup_checked: bool,
}

#[derive(Debug, Clone)]
struct PrimaryRuntimeCacheInspection {
    installed: bool,
    installed_bundle_version: Option<String>,
    is_current: bool,
    problems: Vec<PrimaryRuntimeProblem>,
}

#[derive(Default)]
pub struct PrimaryRuntimeState {
    inner: Mutex<PrimaryRuntimeStateInner>,
}

impl Default for PrimaryRuntimeStateInner {
    fn default() -> Self {
        Self {
            install_release: PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST.to_string(),
            shared_objects: PrimaryRuntimeSharedObjects::default(),
            install_running: false,
            cancel_requested: false,
            last_progress: None,
            next_run_at: None,
            startup_checked: false,
        }
    }
}

impl PrimaryRuntimeState {
    fn begin_install(&self) -> Result<(), String> {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        if guard.install_running {
            return Err(PRIMARY_RUNTIME_ALREADY_RUNNING_REASON.to_string());
        }
        guard.install_running = true;
        guard.cancel_requested = false;
        Ok(())
    }

    fn current_update_status(&self) -> PrimaryRuntimeUpdateStatusResponse {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        build_update_status(&guard)
    }

    fn effective_install_release(&self, release: Option<String>) -> Result<String, String> {
        if let Some(release) = release {
            validate_primary_runtime_install_release(&release)?;
            return Ok(release);
        }

        Ok(self.selected_install_release())
    }

    fn finish_install(
        &self,
        progress: Option<PrimaryRuntimeInstallProgressEvent>,
        startup_checked: bool,
        next_run_at: Option<i64>,
    ) {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_running = false;
        guard.cancel_requested = false;
        guard.last_progress = progress;
        guard.startup_checked = startup_checked;
        guard.next_run_at = next_run_at;
    }

    fn is_cancel_requested(&self) -> bool {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.cancel_requested
    }

    fn is_install_running(&self) -> bool {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_running
    }

    fn request_cancel(&self) -> bool {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        if !guard.install_running {
            return false;
        }
        guard.cancel_requested = true;
        true
    }

    fn schedule_next_update(&self) -> i64 {
        let next_run_at = next_update_at();
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.startup_checked = true;
        guard.next_run_at = Some(next_run_at);
        next_run_at
    }

    fn selected_install_release(&self) -> String {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_release.clone()
    }

    fn set_install_release(&self, release: String) {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_release = release;
    }

    fn shared_object_snapshot(&self, key: &str) -> Option<Value> {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        match key {
            CODEX_RUNTIMES_CONFIG_SHARED_OBJECT_KEY => {
                guard.shared_objects.codex_runtimes_config.clone()
            }
            STATSIG_DEFAULT_ENABLE_FEATURES_SHARED_OBJECT_KEY => {
                guard.shared_objects.statsig_default_enable_features.clone()
            }
            _ => None,
        }
    }

    fn shared_objects_snapshot(&self) -> PrimaryRuntimeSharedObjects {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.shared_objects.clone()
    }

    fn sync_shared_objects(
        &self,
        codex_runtimes_config: Option<Value>,
        statsig_default_enable_features: Option<Value>,
    ) -> Vec<(String, Value)> {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        let mut changed = Vec::new();

        if guard.shared_objects.codex_runtimes_config != codex_runtimes_config {
            guard.shared_objects.codex_runtimes_config = codex_runtimes_config.clone();
            guard.startup_checked = false;
            guard.next_run_at = None;
            changed.push((
                CODEX_RUNTIMES_CONFIG_SHARED_OBJECT_KEY.to_string(),
                codex_runtimes_config.unwrap_or(Value::Null),
            ));
        }

        if guard.shared_objects.statsig_default_enable_features != statsig_default_enable_features {
            guard.shared_objects.statsig_default_enable_features =
                statsig_default_enable_features.clone();
            guard.startup_checked = false;
            guard.next_run_at = None;
            changed.push((
                STATSIG_DEFAULT_ENABLE_FEATURES_SHARED_OBJECT_KEY.to_string(),
                statsig_default_enable_features.unwrap_or(Value::Null),
            ));
        }

        changed
    }
}

#[tauri::command(rename = "sync-primary-runtime-shared-objects")]
pub fn sync_primary_runtime_shared_objects(
    app: AppHandle,
    state: State<'_, PrimaryRuntimeState>,
    params: SyncPrimaryRuntimeSharedObjectsParams,
) -> Result<(), String> {
    let changed = state.sync_shared_objects(
        normalize_shared_object_value(params.codex_runtimes_config),
        normalize_shared_object_value(params.statsig_default_enable_features),
    );
    for (key, value) in changed {
        emit_shared_object_updated(&app, &key, value)?;
    }
    Ok(())
}

#[tauri::command(rename = "load-primary-runtime-dependencies")]
pub fn load_primary_runtime_dependencies(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeHostParams,
) -> Result<LoadPrimaryRuntimeDependenciesResponse, String> {
    if params.host_id != "local" {
        return Ok(LoadPrimaryRuntimeDependenciesResponse {
            bundle_version: None,
            installed: false,
            instructions: Some("Primary runtime is only available for the local host.".to_string()),
        });
    }

    let release = state.selected_install_release();
    let shared_objects = state.shared_objects_snapshot();
    let expected_bundle_version = resolve_expected_bundle_version(&shared_objects, &release);
    let inspection = inspect_primary_runtime_cache(expected_bundle_version.as_deref());
    Ok(LoadPrimaryRuntimeDependenciesResponse {
        bundle_version: inspection.installed_bundle_version,
        installed: inspection.installed,
        instructions: format_problem_messages(&inspection.problems),
    })
}

#[tauri::command(rename = "diagnose-primary-runtime-dependencies")]
pub fn diagnose_primary_runtime_dependencies(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeHostParams,
) -> Result<DiagnosePrimaryRuntimeDependenciesResponse, String> {
    if params.host_id != "local" {
        return Ok(DiagnosePrimaryRuntimeDependenciesResponse {
            bundle_version: None,
            installed: false,
            problems: vec![primary_runtime_problem(
                "not-local-host",
                "Primary runtime is only available for the local host.".to_string(),
            )],
        });
    }

    let release = state.selected_install_release();
    let shared_objects = state.shared_objects_snapshot();
    let expected_bundle_version = resolve_expected_bundle_version(&shared_objects, &release);
    let inspection = inspect_primary_runtime_cache(expected_bundle_version.as_deref());
    Ok(DiagnosePrimaryRuntimeDependenciesResponse {
        bundle_version: inspection.installed_bundle_version,
        installed: inspection.installed,
        problems: inspection.problems,
    })
}

#[tauri::command(rename = "install-primary-runtime")]
pub async fn install_primary_runtime(
    app: AppHandle,
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<PrimaryRuntimeInstallResultResponse, String> {
    let release = state.effective_install_release(params.release)?;
    install_primary_runtime_inner(&app, state.inner(), params.host_id, release, false).await
}

#[tauri::command(rename = "finish-primary-runtime-install")]
pub async fn finish_primary_runtime_install(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<FinishPrimaryRuntimeInstallResponse, String> {
    let _ = state.effective_install_release(params.release)?;
    let deadline = SystemTime::now() + Duration::from_secs(90);
    while state.is_install_running() && SystemTime::now() < deadline {
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    Ok(FinishPrimaryRuntimeInstallResponse {
        completed: !state.is_install_running(),
    })
}

#[tauri::command(rename = "cancel-primary-runtime-install")]
pub fn cancel_primary_runtime_install(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeHostParams,
) -> Result<CancelPrimaryRuntimeInstallResponse, String> {
    if params.host_id != "local" {
        return Ok(CancelPrimaryRuntimeInstallResponse { canceled: false });
    }

    Ok(CancelPrimaryRuntimeInstallResponse {
        canceled: state.request_cancel(),
    })
}

#[tauri::command(rename = "primary-runtime-update-status")]
pub fn primary_runtime_update_status(
    state: State<'_, PrimaryRuntimeState>,
) -> Result<PrimaryRuntimeUpdateStatusResponse, String> {
    Ok(state.current_update_status())
}

#[tauri::command(rename = "primary-runtime-update-run-now")]
pub async fn primary_runtime_update_run_now(
    app: AppHandle,
    state: State<'_, PrimaryRuntimeState>,
) -> Result<PrimaryRuntimeUpdateRunNowResponse, String> {
    let release = state.selected_install_release();
    let status = state.current_update_status();
    let next_run_at = state.schedule_next_update();

    if let Some(reason) = status.disabled_reason {
        return Ok(PrimaryRuntimeUpdateRunNowResponse {
            bundle_version: None,
            next_run_at: Some(next_run_at),
            reason: Some(reason),
            status: PrimaryRuntimeUpdateRunNowStatus::Skipped,
        });
    }

    if state.is_install_running() {
        return Ok(PrimaryRuntimeUpdateRunNowResponse {
            bundle_version: None,
            next_run_at: Some(next_run_at),
            reason: Some(PRIMARY_RUNTIME_ALREADY_RUNNING_REASON.to_string()),
            status: PrimaryRuntimeUpdateRunNowStatus::Skipped,
        });
    }

    let shared_objects = state.shared_objects_snapshot();
    let expected_bundle_version = resolve_expected_bundle_version(&shared_objects, &release);
    let inspection = inspect_primary_runtime_cache(expected_bundle_version.as_deref());
    if inspection.is_current {
        return Ok(PrimaryRuntimeUpdateRunNowResponse {
            bundle_version: inspection.installed_bundle_version,
            next_run_at: Some(next_run_at),
            reason: Some(PRIMARY_RUNTIME_CURRENT_REASON.to_string()),
            status: PrimaryRuntimeUpdateRunNowStatus::AlreadyCurrent,
        });
    }

    let result =
        install_primary_runtime_inner(&app, state.inner(), "local".to_string(), release, false)
            .await?;
    Ok(PrimaryRuntimeUpdateRunNowResponse {
        bundle_version: result.bundle_version,
        next_run_at: Some(next_run_at),
        reason: match result.status {
            PrimaryRuntimeInstallStatus::AlreadyCurrent => {
                Some(PRIMARY_RUNTIME_CURRENT_REASON.to_string())
            }
            PrimaryRuntimeInstallStatus::Installed => None,
        },
        status: match result.status {
            PrimaryRuntimeInstallStatus::AlreadyCurrent => {
                PrimaryRuntimeUpdateRunNowStatus::AlreadyCurrent
            }
            PrimaryRuntimeInstallStatus::Installed => PrimaryRuntimeUpdateRunNowStatus::Installed,
        },
    })
}

#[tauri::command(rename = "reset-primary-runtime-dependencies")]
pub async fn reset_primary_runtime_dependencies(
    app: AppHandle,
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<PrimaryRuntimeInstallResultResponse, String> {
    let release = state.effective_install_release(params.release)?;
    install_primary_runtime_inner(&app, state.inner(), params.host_id, release, true).await
}

#[tauri::command(rename = "set-primary-runtime-install-release")]
pub fn set_primary_runtime_install_release(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeInstallReleaseParams,
) -> Result<(), String> {
    validate_primary_runtime_install_release(&params.release)?;
    state.set_install_release(params.release);
    Ok(())
}

pub fn shared_object_snapshot(app: &AppHandle, key: &str) -> Option<Value> {
    let state = app.try_state::<PrimaryRuntimeState>()?;
    state.shared_object_snapshot(key)
}

async fn install_primary_runtime_inner(
    app: &AppHandle,
    state: &PrimaryRuntimeState,
    host_id: String,
    release: String,
    reset_existing: bool,
) -> Result<PrimaryRuntimeInstallResultResponse, String> {
    if host_id != "local" {
        return Err(PRIMARY_RUNTIME_NOT_LOCAL_HOST_REASON.to_string());
    }

    let shared_objects = state.shared_objects_snapshot();
    let resolved_config = resolve_primary_runtime_install_config(&shared_objects, &release)?;
    let inspection = inspect_primary_runtime_cache(resolved_config.bundle_version.as_deref());
    if !reset_existing && inspection.is_current {
        return Ok(PrimaryRuntimeInstallResultResponse {
            bundle_version: inspection.installed_bundle_version,
            status: PrimaryRuntimeInstallStatus::AlreadyCurrent,
        });
    }

    state.begin_install()?;
    let next_run_at = Some(state.schedule_next_update());

    let result = run_install_flow(app, state, &host_id, &resolved_config, reset_existing).await;

    match result {
        Ok(bundle_version) => {
            let ready_progress = build_progress_event(
                &resolved_config,
                PrimaryRuntimeInstallProgressPhase::Ready,
                None,
                None,
                None,
            );
            state.finish_install(Some(ready_progress), true, next_run_at);
            emit_install_progress(
                app,
                &host_id,
                build_progress_event(
                    &resolved_config,
                    PrimaryRuntimeInstallProgressPhase::Ready,
                    None,
                    None,
                    None,
                ),
            )?;
            Ok(PrimaryRuntimeInstallResultResponse {
                bundle_version,
                status: PrimaryRuntimeInstallStatus::Installed,
            })
        }
        Err(error) => {
            let error_progress = build_progress_event(
                &resolved_config,
                PrimaryRuntimeInstallProgressPhase::Error,
                None,
                None,
                Some(error.clone()),
            );
            state.finish_install(Some(error_progress), true, next_run_at);
            let _ = emit_install_progress(
                app,
                &host_id,
                build_progress_event(
                    &resolved_config,
                    PrimaryRuntimeInstallProgressPhase::Error,
                    None,
                    None,
                    Some(error.clone()),
                ),
            );
            Err(error)
        }
    }
}

async fn run_install_flow(
    app: &AppHandle,
    state: &PrimaryRuntimeState,
    host_id: &str,
    resolved_config: &ResolvedPrimaryRuntimeInstallConfig,
    reset_existing: bool,
) -> Result<Option<String>, String> {
    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Checking,
            Some(0),
            resolved_config.archive_size,
            None,
        ),
    )?;
    ensure_not_canceled(state)?;

    let archive_path =
        download_primary_runtime_archive(app, state, host_id, resolved_config).await?;

    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Verifying,
            resolved_config.archive_size,
            resolved_config.archive_size,
            None,
        ),
    )?;
    ensure_not_canceled(state)?;
    validate_downloaded_archive(
        &archive_path,
        resolved_config.archive_size,
        resolved_config.archive_digest.as_deref(),
    )?;

    let staging_root = create_install_workspace_path("extract");
    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Extracting,
            resolved_config.archive_size,
            resolved_config.archive_size,
            None,
        ),
    )?;
    ensure_not_canceled(state)?;
    let staged_runtime_root = tauri::async_runtime::spawn_blocking({
        let archive_path = archive_path.clone();
        let staging_root = staging_root.clone();
        let runtime_root_directory_name = resolved_config.runtime_root_directory_name.clone();
        move || {
            extract_primary_runtime_archive(
                &archive_path,
                &staging_root,
                &runtime_root_directory_name,
            )
        }
    })
    .await
    .map_err(|err| format!("primary runtime extract task failed: {err}"))??;

    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Validating,
            resolved_config.archive_size,
            resolved_config.archive_size,
            None,
        ),
    )?;
    ensure_not_canceled(state)?;
    validate_staged_runtime_root(
        &staged_runtime_root,
        resolved_config.bundle_version.as_deref(),
    )?;

    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Installed,
            resolved_config.archive_size,
            resolved_config.archive_size,
            None,
        ),
    )?;
    ensure_not_canceled(state)?;

    let cache_root = primary_runtime_cache_root();
    emit_install_progress(
        app,
        host_id,
        build_progress_event(
            resolved_config,
            PrimaryRuntimeInstallProgressPhase::Configuring,
            resolved_config.archive_size,
            resolved_config.archive_size,
            None,
        ),
    )?;
    tauri::async_runtime::spawn_blocking({
        let cache_root = cache_root.clone();
        let staging_root = staging_root.clone();
        let staged_runtime_root = staged_runtime_root.clone();
        move || {
            install_staged_runtime_root(
                &staging_root,
                &staged_runtime_root,
                &cache_root,
                reset_existing,
            )
        }
    })
    .await
    .map_err(|err| format!("primary runtime install task failed: {err}"))??;

    let post_install_result = sync_primary_runtime_post_install(app, &cache_root).await;
    let _ = fs::remove_file(&archive_path);
    post_install_result?;
    Ok(read_installed_bundle_version(&cache_root))
}

async fn download_primary_runtime_archive(
    app: &AppHandle,
    state: &PrimaryRuntimeState,
    host_id: &str,
    resolved_config: &ResolvedPrimaryRuntimeInstallConfig,
) -> Result<PathBuf, String> {
    let client = reqwest::Client::new();
    let mut response = client
        .get(&resolved_config.download_url)
        .send()
        .await
        .map_err(|err| format!("failed to download primary runtime: {err}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "failed to download primary runtime: HTTP {}",
            response.status()
        ));
    }

    let archive_path = create_install_workspace_path("download.tar.xz");
    if let Some(parent) = archive_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create runtime cache directory: {err}"))?;
    }

    let mut file = File::create(&archive_path)
        .map_err(|err| format!("failed to create runtime archive: {err}"))?;
    let total_bytes = response.content_length().or(resolved_config.archive_size);
    let mut downloaded_bytes = 0_u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|err| format!("failed to read runtime download stream: {err}"))?
    {
        ensure_not_canceled(state)?;
        file.write_all(&chunk)
            .map_err(|err| format!("failed to write runtime archive: {err}"))?;
        downloaded_bytes += chunk.len() as u64;
        emit_install_progress(
            app,
            host_id,
            build_progress_event(
                resolved_config,
                PrimaryRuntimeInstallProgressPhase::Downloading,
                Some(downloaded_bytes),
                total_bytes,
                None,
            ),
        )?;
    }

    Ok(archive_path)
}

fn build_progress_event(
    resolved_config: &ResolvedPrimaryRuntimeInstallConfig,
    phase: PrimaryRuntimeInstallProgressPhase,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    error_message: Option<String>,
) -> PrimaryRuntimeInstallProgressEvent {
    PrimaryRuntimeInstallProgressEvent {
        bundle_version: resolved_config.bundle_version.clone(),
        downloaded_bytes,
        error_message,
        phase,
        release: Some(resolved_config.release.clone()),
        total_bytes,
    }
}

fn build_update_status(inner: &PrimaryRuntimeStateInner) -> PrimaryRuntimeUpdateStatusResponse {
    let disabled_reason = resolve_update_disabled_reason(&inner.shared_objects);
    PrimaryRuntimeUpdateStatusResponse {
        enabled: disabled_reason.is_none(),
        disabled_reason,
        is_running: inner.install_running,
        next_run_at: inner.next_run_at,
        startup_checked: inner.startup_checked,
    }
}

fn create_install_workspace_path(suffix: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    primary_runtime_parent_dir().join(format!("{PRIMARY_RUNTIME_NAME}.{nonce}.{suffix}"))
}

fn emit_install_progress(
    app: &AppHandle,
    host_id: &str,
    progress: PrimaryRuntimeInstallProgressEvent,
) -> Result<(), String> {
    app.emit(
        PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT,
        PrimaryRuntimeInstallProgressNotification {
            host_id: host_id.to_string(),
            progress,
        },
    )
    .map_err(|err| format!("failed to emit primary-runtime-install-progress: {err}"))
}

fn emit_shared_object_updated(app: &AppHandle, key: &str, value: Value) -> Result<(), String> {
    app.emit(
        SHARED_OBJECT_UPDATED_EVENT,
        SharedObjectUpdatedNotification {
            key: key.to_string(),
            value,
        },
    )
    .map_err(|err| format!("failed to emit shared-object-updated: {err}"))
}

fn ensure_not_canceled(state: &PrimaryRuntimeState) -> Result<(), String> {
    if state.is_cancel_requested() {
        return Err("aborted".to_string());
    }
    Ok(())
}

fn extract_primary_runtime_archive(
    archive_path: &Path,
    staging_root: &Path,
    runtime_root_directory_name: &str,
) -> Result<PathBuf, String> {
    if staging_root.exists() {
        fs::remove_dir_all(staging_root)
            .map_err(|err| format!("failed to clear staging runtime directory: {err}"))?;
    }
    fs::create_dir_all(staging_root)
        .map_err(|err| format!("failed to create staging runtime directory: {err}"))?;

    let status = Command::new("tar.exe")
        .arg("-xf")
        .arg(archive_path)
        .arg("-C")
        .arg(staging_root)
        .status()
        .map_err(|err| format!("failed to extract primary runtime archive: {err}"))?;
    if !status.success() {
        return Err(format!(
            "failed to extract primary runtime archive: tar.exe exited with {status}"
        ));
    }

    resolve_extracted_runtime_root(staging_root, runtime_root_directory_name)
}

fn format_problem_messages(problems: &[PrimaryRuntimeProblem]) -> Option<String> {
    if problems.is_empty() {
        return None;
    }

    Some(
        problems
            .iter()
            .map(|problem| problem.message.clone())
            .collect::<Vec<_>>()
            .join("; "),
    )
}

fn home_directory() -> PathBuf {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn inspect_primary_runtime_cache(
    expected_bundle_version: Option<&str>,
) -> PrimaryRuntimeCacheInspection {
    let cache_root = primary_runtime_cache_root();
    if !cache_root.exists() {
        return PrimaryRuntimeCacheInspection {
            installed: false,
            installed_bundle_version: None,
            is_current: false,
            problems: vec![primary_runtime_problem(
                "missing-cache-root",
                format!(
                    "Primary runtime cache was not found at {}.",
                    cache_root.display()
                ),
            )],
        };
    }

    let mut problems = Vec::new();
    let runtime_json_path = cache_root.join("runtime.json");
    let installed_bundle_version = match fs::read_to_string(&runtime_json_path) {
        Ok(contents) => match serde_json::from_str::<Value>(&contents) {
            Ok(value) => value
                .get("bundleVersion")
                .and_then(Value::as_str)
                .map(ToString::to_string)
                .or_else(|| {
                    problems.push(primary_runtime_problem(
                        "missing-bundle-version",
                        "runtime.json did not contain bundleVersion.".to_string(),
                    ));
                    None
                }),
            Err(err) => {
                problems.push(primary_runtime_problem(
                    "invalid-runtime-json",
                    format!("runtime.json could not be parsed: {err}"),
                ));
                None
            }
        },
        Err(err) => {
            problems.push(primary_runtime_problem(
                "missing-runtime-json",
                format!("runtime.json could not be read: {err}"),
            ));
            None
        }
    };

    let expected_node_path = expected_node_binary_path(&cache_root);
    if !expected_node_path.exists() {
        problems.push(primary_runtime_problem(
            "missing-node",
            format!(
                "Node runtime was not found at {}.",
                expected_node_path.display()
            ),
        ));
    }

    let expected_python_path = expected_python_binary_path(&cache_root);
    if !expected_python_path.exists() {
        problems.push(primary_runtime_problem(
            "missing-python",
            format!(
                "Python runtime was not found at {}.",
                expected_python_path.display()
            ),
        ));
    }

    let expected_plugin_root = cache_root
        .join("plugins")
        .join(PRIMARY_RUNTIME_PLUGIN_DIRECTORY_NAME);
    if !expected_plugin_root.exists() {
        problems.push(primary_runtime_problem(
            "missing-plugin-root",
            format!(
                "Bundled plugin directory was not found at {}.",
                expected_plugin_root.display()
            ),
        ));
    }

    if let Some(expected_bundle_version) = expected_bundle_version {
        if installed_bundle_version.as_deref() != Some(expected_bundle_version) {
            problems.push(primary_runtime_problem(
                "bundle-version-mismatch",
                format!(
                    "Installed bundle version {} does not match expected version {expected_bundle_version}.",
                    installed_bundle_version
                        .as_deref()
                        .unwrap_or("unknown")
                ),
            ));
        }
    }

    let installed = !problems
        .iter()
        .any(|problem| problem.kind != "bundle-version-mismatch");
    let is_current = installed && installed_bundle_version.as_deref() == expected_bundle_version;

    PrimaryRuntimeCacheInspection {
        installed,
        installed_bundle_version,
        is_current,
        problems,
    }
}

fn install_staged_runtime_root(
    staging_root: &Path,
    staged_runtime_root: &Path,
    cache_root: &Path,
    _reset_existing: bool,
) -> Result<(), String> {
    let parent = cache_root
        .parent()
        .ok_or_else(|| "primary runtime cache root has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create runtime cache parent directory: {err}"))?;

    let backup_root = parent.join(format!("{PRIMARY_RUNTIME_NAME}.backup"));
    if backup_root.exists() {
        fs::remove_dir_all(&backup_root)
            .map_err(|err| format!("failed to clear runtime backup directory: {err}"))?;
    }

    if cache_root.exists() {
        fs::rename(cache_root, &backup_root)
            .map_err(|err| format!("failed to move existing runtime cache aside: {err}"))?;
    }

    let install_result = fs::rename(staged_runtime_root, cache_root);
    if let Err(err) = install_result {
        if cache_root.exists() {
            let _ = fs::remove_dir_all(cache_root);
        }
        if backup_root.exists() {
            let _ = fs::rename(&backup_root, cache_root);
        }
        return Err(format!("failed to install staged runtime: {err}"));
    }

    if backup_root.exists() {
        fs::remove_dir_all(&backup_root)
            .map_err(|err| format!("failed to remove runtime backup directory: {err}"))?;
    }

    if staging_root.exists() {
        let _ = fs::remove_dir_all(staging_root);
    }

    Ok(())
}

fn normalize_shared_object_value(value: Value) -> Option<Value> {
    if value.is_null() {
        return None;
    }
    Some(value)
}

fn next_update_at() -> i64 {
    current_unix_seconds() + PRIMARY_RUNTIME_UPDATE_INTERVAL_SECS
}

fn current_unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn primary_runtime_cache_root() -> PathBuf {
    primary_runtime_parent_dir().join(PRIMARY_RUNTIME_NAME)
}

fn primary_runtime_parent_dir() -> PathBuf {
    home_directory().join(".cache").join("codex-runtimes")
}

fn primary_runtime_problem(kind: &str, message: String) -> PrimaryRuntimeProblem {
    PrimaryRuntimeProblem {
        kind: kind.to_string(),
        message,
    }
}

fn read_installed_bundle_version(cache_root: &Path) -> Option<String> {
    let contents = fs::read_to_string(cache_root.join("runtime.json")).ok()?;
    let value = serde_json::from_str::<Value>(&contents).ok()?;
    value
        .get("bundleVersion")
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn resolve_expected_bundle_version(
    shared_objects: &PrimaryRuntimeSharedObjects,
    release: &str,
) -> Option<String> {
    let resolved = resolve_primary_runtime_install_config(shared_objects, release).ok()?;
    resolved.bundle_version
}

fn resolve_primary_runtime_install_config(
    shared_objects: &PrimaryRuntimeSharedObjects,
    release: &str,
) -> Result<ResolvedPrimaryRuntimeInstallConfig, String> {
    let runtimes_config = shared_objects
        .codex_runtimes_config
        .as_ref()
        .ok_or_else(|| PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON.to_string())?;
    let runtime_config = runtimes_config
        .get("runtimes")
        .and_then(Value::as_object)
        .and_then(|runtimes| runtimes.get(PRIMARY_RUNTIME_NAME))
        .and_then(Value::as_object)
        .ok_or_else(|| "codex-primary-runtime config is missing".to_string())?;

    let manifest = match release {
        PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST => runtime_config.get("latest"),
        PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA => runtime_config.get("latest-alpha"),
        _ => None,
    }
    .and_then(Value::as_object)
    .ok_or_else(|| format!("runtime manifest for release {release} is missing"))?;

    let platform_key = current_platform_key();
    let platform = manifest
        .get("platforms")
        .and_then(Value::as_object)
        .and_then(|platforms| platforms.get(&platform_key))
        .and_then(Value::as_object)
        .ok_or_else(|| format!("runtime manifest for platform {platform_key} is missing"))?;

    let provider_url = platform
        .get("providers")
        .and_then(Value::as_array)
        .and_then(|providers| providers.first())
        .and_then(Value::as_object)
        .and_then(|provider| provider.get("url"))
        .and_then(Value::as_str)
        .ok_or_else(|| "runtime provider URL is missing".to_string())?;

    let download_url = resolve_provider_url(
        runtime_config.get("baseUrl").and_then(Value::as_str),
        provider_url,
    )?;

    Ok(ResolvedPrimaryRuntimeInstallConfig {
        archive_digest: platform
            .get("digest")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        archive_size: platform.get("size").and_then(Value::as_u64),
        bundle_version: manifest
            .get("bundleVersion")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        download_url,
        release: release.to_string(),
        runtime_root_directory_name: manifest
            .get("runtimeRootDirectoryName")
            .and_then(Value::as_str)
            .map(ToString::to_string)
            .unwrap_or_else(|| PRIMARY_RUNTIME_NAME.to_string()),
    })
}

fn resolve_provider_url(base_url: Option<&str>, provider_url: &str) -> Result<String, String> {
    if provider_url.starts_with("http://") || provider_url.starts_with("https://") {
        return Ok(provider_url.to_string());
    }

    let base_url =
        base_url.ok_or_else(|| "relative runtime provider URL has no baseUrl".to_string())?;
    let base =
        Url::parse(base_url).map_err(|err| format!("invalid runtime baseUrl {base_url}: {err}"))?;
    base.join(provider_url)
        .map(|url| url.to_string())
        .map_err(|err| format!("invalid runtime provider URL {provider_url}: {err}"))
}

fn resolve_extracted_runtime_root(
    staging_root: &Path,
    runtime_root_directory_name: &str,
) -> Result<PathBuf, String> {
    let named_root = staging_root.join(runtime_root_directory_name);
    if named_root.exists() {
        return Ok(named_root);
    }

    if staging_root.join("runtime.json").exists() {
        return Ok(staging_root.to_path_buf());
    }

    let mut directories = fs::read_dir(staging_root)
        .map_err(|err| format!("failed to inspect extracted runtime archive: {err}"))?
        .flatten()
        .filter_map(|entry| {
            entry
                .file_type()
                .ok()
                .filter(|file_type| file_type.is_dir())
                .map(|_| entry.path())
        })
        .collect::<Vec<_>>();
    if directories.len() == 1 {
        let only_directory = directories.swap_remove(0);
        if only_directory.join("runtime.json").exists() {
            return Ok(only_directory);
        }
    }

    Err(format!(
        "extracted runtime root {runtime_root_directory_name} was not found in {}",
        staging_root.display()
    ))
}

fn resolve_update_disabled_reason(shared_objects: &PrimaryRuntimeSharedObjects) -> Option<String> {
    if shared_objects.codex_runtimes_config.is_none() {
        return Some(PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON.to_string());
    }

    if !workspace_dependencies_default_enabled(
        shared_objects.statsig_default_enable_features.as_ref(),
    ) {
        return Some(PRIMARY_RUNTIME_FEATURE_GATE_DISABLED_REASON.to_string());
    }

    None
}

fn validate_downloaded_archive(
    archive_path: &Path,
    expected_size: Option<u64>,
    expected_digest: Option<&str>,
) -> Result<(), String> {
    if let Some(expected_size) = expected_size {
        let actual_size = fs::metadata(archive_path)
            .map_err(|err| format!("failed to read runtime archive metadata: {err}"))?
            .len();
        if actual_size != expected_size {
            return Err(format!(
                "downloaded runtime archive size {actual_size} did not match expected size {expected_size}"
            ));
        }
    }

    if let Some(expected_digest) = expected_digest {
        let actual_digest = sha256_file_hash(archive_path)?;
        if !actual_digest.eq_ignore_ascii_case(expected_digest) {
            return Err(format!(
                "downloaded runtime archive digest {actual_digest} did not match expected digest {expected_digest}"
            ));
        }
    }

    Ok(())
}

fn validate_primary_runtime_install_release(release: &str) -> Result<(), String> {
    match release {
        PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST | PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA => {
            Ok(())
        }
        _ => Err(format!("unsupported primary runtime release: {release}")),
    }
}

fn validate_staged_runtime_root(
    staged_runtime_root: &Path,
    expected_bundle_version: Option<&str>,
) -> Result<(), String> {
    if !staged_runtime_root.join("runtime.json").exists() {
        return Err(format!(
            "staged runtime did not contain runtime.json at {}",
            staged_runtime_root.display()
        ));
    }
    if !expected_node_binary_path(staged_runtime_root).exists() {
        return Err(format!(
            "staged runtime did not contain node executable at {}",
            expected_node_binary_path(staged_runtime_root).display()
        ));
    }
    if !expected_python_binary_path(staged_runtime_root).exists() {
        return Err(format!(
            "staged runtime did not contain python executable at {}",
            expected_python_binary_path(staged_runtime_root).display()
        ));
    }

    if let Some(expected_bundle_version) = expected_bundle_version {
        let installed_bundle_version = read_installed_bundle_version(staged_runtime_root)
            .ok_or_else(|| "staged runtime bundleVersion is missing".to_string())?;
        if installed_bundle_version != expected_bundle_version {
            return Err(format!(
                "staged runtime bundle version {installed_bundle_version} did not match expected version {expected_bundle_version}"
            ));
        }
    }

    Ok(())
}

fn workspace_dependencies_default_enabled(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_object)
        .and_then(|object| object.get("workspace_dependencies"))
        .and_then(Value::as_bool)
        == Some(true)
}

fn expected_node_binary_path(runtime_root: &Path) -> PathBuf {
    runtime_root
        .join("dependencies")
        .join("node")
        .join("bin")
        .join(if cfg!(target_os = "windows") {
            "node.exe"
        } else {
            "node"
        })
}

fn expected_python_binary_path(runtime_root: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        return runtime_root
            .join("dependencies")
            .join("python")
            .join("python.exe");
    }

    runtime_root
        .join("dependencies")
        .join("python")
        .join("bin")
        .join("python3")
}

fn current_platform_key() -> String {
    match (env::consts::OS, env::consts::ARCH) {
        ("windows", "x86_64") => "windows-x86_64".to_string(),
        ("windows", "aarch64") => "windows-arm64".to_string(),
        ("macos", "x86_64") => "darwin-x86_64".to_string(),
        ("macos", "aarch64") => "darwin-arm64".to_string(),
        ("linux", "x86_64") => "linux-x86_64".to_string(),
        ("linux", "aarch64") => "linux-arm64".to_string(),
        (os, arch) => format!("{os}-{arch}"),
    }
}

fn sha256_file_hash(path: &Path) -> Result<String, String> {
    if cfg!(target_os = "windows") {
        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-FileHash -Algorithm SHA256 -LiteralPath $args[0]).Hash",
            ])
            .arg(path)
            .output()
            .map_err(|err| format!("failed to hash runtime archive: {err}"))?;
        if !output.status.success() {
            return Err(format!(
                "failed to hash runtime archive: powershell exited with {}",
                output.status
            ));
        }
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    Err("runtime archive hashing is unsupported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_update_status_requires_runtime_config() {
        let state = PrimaryRuntimeState::default();
        let status = state.current_update_status();
        assert_eq!(
            status.disabled_reason.as_deref(),
            Some(PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON)
        );
        assert!(!status.enabled);
        assert!(!status.is_running);
        assert!(status.next_run_at.is_none());
        assert!(!status.startup_checked);
    }

    #[test]
    fn shared_object_snapshot_round_trips_synced_values() {
        let state = PrimaryRuntimeState::default();
        let changed = state.sync_shared_objects(
            Some(json!({
                "runtimes": {
                    "codex-primary-runtime": {
                        "latest": {
                            "bundleVersion": "26.430.10722",
                            "platforms": {
                                "windows-x86_64": {
                                    "digest": "abcd",
                                    "providers": [{"url": "https://example.com/runtime.tar.xz"}]
                                }
                            }
                        }
                    }
                }
            })),
            Some(json!({"workspace_dependencies": true})),
        );
        assert_eq!(changed.len(), 2);
        assert!(state
            .shared_object_snapshot(CODEX_RUNTIMES_CONFIG_SHARED_OBJECT_KEY)
            .is_some());
        assert!(state
            .shared_object_snapshot(STATSIG_DEFAULT_ENABLE_FEATURES_SHARED_OBJECT_KEY)
            .is_some());
    }

    #[test]
    fn feature_gate_disabled_without_workspace_dependencies_default() {
        let state = PrimaryRuntimeState::default();
        let _ = state.sync_shared_objects(
            Some(json!({
                "runtimes": {
                    "codex-primary-runtime": {
                        "latest": {
                            "bundleVersion": "26.430.10722",
                            "platforms": {
                                "windows-x86_64": {
                                    "digest": "abcd",
                                    "providers": [{"url": "https://example.com/runtime.tar.xz"}]
                                }
                            }
                        }
                    }
                }
            })),
            Some(json!({"workspace_dependencies": false})),
        );
        let status = state.current_update_status();
        assert_eq!(
            status.disabled_reason.as_deref(),
            Some(PRIMARY_RUNTIME_FEATURE_GATE_DISABLED_REASON)
        );
        assert!(!status.enabled);
    }
}
