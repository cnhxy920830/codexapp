//! Primary runtime manager (Phase 1).
//!
//! Mirrors the upstream `Mx` controller in `main-Bnxe1qAn.js` that owns the
//! Codex primary runtime cache, dependency diagnostics, and install/update
//! lifecycle. The page-owners are `agent-settings-Cqw4tvBe.js` plus the
//! `primary-runtime-install-{state,action,status-message}` shared bundles.
//!
//! Phase 1 (this commit) ships the bridge surface: typed Tauri commands for
//! every page-owned name, parameter/response shapes that match upstream's
//! payloads, and an in-process registry so the page can poll consistent
//! state. Default responses mirror the upstream disabled / no-runtime branch,
//! while the install and update commands stay on a no-op path until the real
//! runtime owner exists in this replica.
//!
//! Phase 2 (follow-up scope) will:
//!
//! 1. Read the `codex_runtimes_config` shared object to surface real
//!    `bundleVersion` / `installed` / `instructions` triples.
//! 2. Run actual cache directory inspection + binary diagnostics.
//! 3. Drive an installer task that emits `primary-runtime-install-progress`
//!    events with measured percent values.
//! 4. Trigger the post-install `skills/list` + marketplace re-sync that
//!    upstream does once the runtime is live.
//!
//! The Phase 1 wire shapes are kept aligned with upstream so swapping in
//! Phase 2 can be done without touching the page.

use serde::Deserialize;
use serde::Serialize;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::State;

const PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT: &str = "primary-runtime-install-progress";
const PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON: &str = "runtime-config-missing";
const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST: &str = "latest";
const PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA: &str = "latest-alpha";

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
#[allow(dead_code)]
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
#[allow(dead_code)]
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

impl Default for PrimaryRuntimeUpdateStatusResponse {
    fn default() -> Self {
        Self {
            disabled_reason: Some(PRIMARY_RUNTIME_RUNTIME_CONFIG_MISSING_REASON.to_string()),
            enabled: false,
            is_running: false,
            next_run_at: None,
            startup_checked: false,
        }
    }
}

#[derive(Default)]
pub struct PrimaryRuntimeState {
    inner: Mutex<PrimaryRuntimeStateInner>,
}

#[derive(Clone)]
struct PrimaryRuntimeStateInner {
    update_status: PrimaryRuntimeUpdateStatusResponse,
    install_release: String,
}

impl Default for PrimaryRuntimeStateInner {
    fn default() -> Self {
        Self {
            update_status: PrimaryRuntimeUpdateStatusResponse::default(),
            install_release: PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST.to_string(),
        }
    }
}

impl PrimaryRuntimeState {
    fn current_update_status(&self) -> PrimaryRuntimeUpdateStatusResponse {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.update_status.clone()
    }

    fn selected_install_release(&self) -> String {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_release.clone()
    }

    fn set_install_release(&self, release: String) {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.install_release = release;
    }

    fn effective_install_release(&self, release: Option<String>) -> Result<String, String> {
        if let Some(release) = release {
            validate_primary_runtime_install_release(&release)?;
            return Ok(release);
        }

        Ok(self.selected_install_release())
    }

    fn run_now(&self) -> PrimaryRuntimeUpdateRunNowResponse {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        let status = guard.update_status.clone();
        PrimaryRuntimeUpdateRunNowResponse {
            bundle_version: None,
            next_run_at: status.next_run_at,
            reason: status.disabled_reason,
            status: PrimaryRuntimeUpdateRunNowStatus::Skipped,
        }
    }
}

fn validate_primary_runtime_install_release(release: &str) -> Result<(), String> {
    match release {
        PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST | PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA => {
            Ok(())
        }
        _ => Err(format!("unsupported primary runtime release: {release}")),
    }
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
#[allow(dead_code)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryRuntimeUpdateRunNowStatus {
    AlreadyCurrent,
    Installed,
    Skipped,
}

#[tauri::command(rename = "load-primary-runtime-dependencies")]
pub fn load_primary_runtime_dependencies(
    _params: PrimaryRuntimeHostParams,
) -> Result<LoadPrimaryRuntimeDependenciesResponse, String> {
    Ok(LoadPrimaryRuntimeDependenciesResponse {
        bundle_version: None,
        installed: false,
        instructions: None,
    })
}

#[tauri::command(rename = "diagnose-primary-runtime-dependencies")]
pub fn diagnose_primary_runtime_dependencies(
    _params: PrimaryRuntimeHostParams,
) -> Result<DiagnosePrimaryRuntimeDependenciesResponse, String> {
    Ok(DiagnosePrimaryRuntimeDependenciesResponse {
        bundle_version: None,
        installed: false,
        problems: Vec::new(),
    })
}

#[tauri::command(rename = "install-primary-runtime")]
pub fn install_primary_runtime(
    app: AppHandle,
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<PrimaryRuntimeInstallResultResponse, String> {
    let PrimaryRuntimeReleaseParams { host_id, release } = params;
    let release = state.effective_install_release(release)?;
    // Phase 1: emit a single 0% progress event so the page-owner knows the
    // install request was received. Phase 2 will replace this with a real
    // installer task that streams measured progress.
    let event = PrimaryRuntimeInstallProgressNotification {
        host_id,
        progress: PrimaryRuntimeInstallProgressEvent {
            bundle_version: None,
            downloaded_bytes: None,
            error_message: None,
            phase: PrimaryRuntimeInstallProgressPhase::Checking,
            release: Some(release),
            total_bytes: None,
        },
    };
    let _ = app.emit(PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT, event);
    Ok(PrimaryRuntimeInstallResultResponse {
        bundle_version: None,
        status: PrimaryRuntimeInstallStatus::AlreadyCurrent,
    })
}

#[tauri::command(rename = "finish-primary-runtime-install")]
pub fn finish_primary_runtime_install(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<FinishPrimaryRuntimeInstallResponse, String> {
    let _ = state.effective_install_release(params.release)?;
    Ok(FinishPrimaryRuntimeInstallResponse { completed: false })
}

#[tauri::command(rename = "cancel-primary-runtime-install")]
pub fn cancel_primary_runtime_install(
    _params: PrimaryRuntimeHostParams,
) -> Result<CancelPrimaryRuntimeInstallResponse, String> {
    Ok(CancelPrimaryRuntimeInstallResponse { canceled: false })
}

#[tauri::command(rename = "primary-runtime-update-status")]
pub fn primary_runtime_update_status(
    state: State<'_, PrimaryRuntimeState>,
) -> Result<PrimaryRuntimeUpdateStatusResponse, String> {
    Ok(state.current_update_status())
}

#[tauri::command(rename = "primary-runtime-update-run-now")]
pub fn primary_runtime_update_run_now(
    state: State<'_, PrimaryRuntimeState>,
) -> Result<PrimaryRuntimeUpdateRunNowResponse, String> {
    Ok(state.run_now())
}

#[tauri::command(rename = "reset-primary-runtime-dependencies")]
pub fn reset_primary_runtime_dependencies(
    state: State<'_, PrimaryRuntimeState>,
    params: PrimaryRuntimeReleaseParams,
) -> Result<PrimaryRuntimeInstallResultResponse, String> {
    let _ = state.effective_install_release(params.release)?;
    Ok(PrimaryRuntimeInstallResultResponse {
        bundle_version: None,
        status: PrimaryRuntimeInstallStatus::AlreadyCurrent,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_response_serializes_camel_case_with_null_fields() {
        let response = LoadPrimaryRuntimeDependenciesResponse {
            bundle_version: None,
            installed: false,
            instructions: None,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert!(value["bundleVersion"].is_null());
        assert_eq!(value["installed"], false);
        assert!(value["instructions"].is_null());
    }

    #[test]
    fn diagnose_response_serializes_camel_case_with_problems_array() {
        let response = DiagnosePrimaryRuntimeDependenciesResponse {
            bundle_version: Some("1.2.3".into()),
            installed: true,
            problems: vec![PrimaryRuntimeProblem {
                kind: "missing-dependency".into(),
                message: "node not found".into(),
            }],
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["bundleVersion"], "1.2.3");
        assert_eq!(value["installed"], true);
        let problems = value["problems"].as_array().expect("problems");
        assert_eq!(problems.len(), 1);
        assert_eq!(problems[0]["kind"], "missing-dependency");
        assert_eq!(problems[0]["message"], "node not found");
    }

    #[test]
    fn install_progress_event_serializes_camel_case() {
        let event = PrimaryRuntimeInstallProgressEvent {
            bundle_version: Some("1.0.0".into()),
            downloaded_bytes: Some(42),
            error_message: None,
            phase: PrimaryRuntimeInstallProgressPhase::Downloading,
            release: Some("1.0.0".into()),
            total_bytes: Some(100),
        };
        let value = serde_json::to_value(&event).expect("serialize");
        assert_eq!(value["bundleVersion"], "1.0.0");
        assert_eq!(value["downloadedBytes"], 42);
        assert!(value["errorMessage"].is_null());
        assert_eq!(value["phase"], "downloading");
        assert_eq!(value["release"], "1.0.0");
        assert_eq!(value["totalBytes"], 100);
    }

    #[test]
    fn install_progress_event_serializes_null_fields() {
        let event = PrimaryRuntimeInstallProgressEvent {
            bundle_version: None,
            downloaded_bytes: None,
            error_message: Some("failed".into()),
            phase: PrimaryRuntimeInstallProgressPhase::Error,
            release: None,
            total_bytes: None,
        };
        let value = serde_json::to_value(&event).expect("serialize");
        assert!(value["bundleVersion"].is_null());
        assert!(value["downloadedBytes"].is_null());
        assert_eq!(value["errorMessage"], "failed");
        assert_eq!(value["phase"], "error");
        assert!(value["release"].is_null());
        assert!(value["totalBytes"].is_null());
    }

    #[test]
    fn install_progress_notification_serializes_host_and_progress() {
        let event = PrimaryRuntimeInstallProgressNotification {
            host_id: "local".into(),
            progress: PrimaryRuntimeInstallProgressEvent {
                bundle_version: None,
                downloaded_bytes: None,
                error_message: None,
                phase: PrimaryRuntimeInstallProgressPhase::Checking,
                release: Some("latest".into()),
                total_bytes: None,
            },
        };
        let value = serde_json::to_value(&event).expect("serialize");
        assert_eq!(value["hostId"], "local");
        assert_eq!(value["progress"]["phase"], "checking");
        assert_eq!(value["progress"]["release"], "latest");
    }

    #[test]
    fn host_params_decode_camel_case() {
        let raw = serde_json::json!({"hostId": "local"});
        let parsed: PrimaryRuntimeHostParams = serde_json::from_value(raw).expect("decode");
        assert_eq!(parsed.host_id, "local");
    }

    #[test]
    fn install_release_defaults_to_latest() {
        let state = PrimaryRuntimeState::default();
        assert_eq!(state.selected_install_release(), "latest");
    }

    #[test]
    fn install_release_state_updates_selected_release() {
        let state = PrimaryRuntimeState::default();
        state.set_install_release("latest-alpha".into());
        assert_eq!(state.selected_install_release(), "latest-alpha");
    }

    #[test]
    fn effective_install_release_uses_selected_release_when_missing() {
        let state = PrimaryRuntimeState::default();
        state.set_install_release("latest-alpha".into());
        let release = state
            .effective_install_release(None)
            .expect("effective release");
        assert_eq!(release, "latest-alpha");
    }

    #[test]
    fn effective_install_release_rejects_unknown_release() {
        let state = PrimaryRuntimeState::default();
        let err = state
            .effective_install_release(Some("stable".into()))
            .expect_err("reject unknown release");
        assert!(err.contains("unsupported primary runtime release"));
    }

    #[test]
    fn release_params_decode_optional_release() {
        let with_release: PrimaryRuntimeReleaseParams =
            serde_json::from_value(serde_json::json!({"hostId": "local", "release": "1.0.0"}))
                .expect("decode with release");
        assert_eq!(with_release.release.as_deref(), Some("1.0.0"));

        let without_release: PrimaryRuntimeReleaseParams =
            serde_json::from_value(serde_json::json!({"hostId": "local"}))
                .expect("decode without release");
        assert!(without_release.release.is_none());
    }

    #[test]
    fn cancel_response_defaults_to_not_canceled() {
        let response = cancel_primary_runtime_install(PrimaryRuntimeHostParams {
            host_id: "local".into(),
        })
        .expect("cancel");
        assert!(!response.canceled);
    }

    #[test]
    fn update_status_defaults_to_disabled_runtime_config_missing() {
        let state = PrimaryRuntimeState::default();
        let initial = state.current_update_status();
        assert_eq!(
            initial.disabled_reason.as_deref(),
            Some("runtime-config-missing")
        );
        assert!(!initial.enabled);
        assert!(!initial.is_running);
        assert!(initial.next_run_at.is_none());
        assert!(!initial.startup_checked);
    }

    #[test]
    fn update_status_serializes_disabled_fields() {
        let response = PrimaryRuntimeUpdateStatusResponse {
            disabled_reason: Some("runtime-config-missing".into()),
            enabled: false,
            is_running: false,
            next_run_at: None,
            startup_checked: false,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["disabledReason"], "runtime-config-missing");
        assert_eq!(value["enabled"], false);
        assert_eq!(value["isRunning"], false);
        assert!(value["nextRunAt"].is_null());
        assert_eq!(value["startupChecked"], false);
    }

    #[test]
    fn install_result_response_serializes_status() {
        let response = PrimaryRuntimeInstallResultResponse {
            bundle_version: None,
            status: PrimaryRuntimeInstallStatus::AlreadyCurrent,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert!(value["bundleVersion"].is_null());
        assert_eq!(value["status"], "already-current");
    }

    #[test]
    fn update_run_now_defaults_to_skipped() {
        let state = PrimaryRuntimeState::default();
        let response = state.run_now();
        let value = serde_json::to_value(&response).expect("serialize");
        assert!(value["bundleVersion"].is_null());
        assert!(value["nextRunAt"].is_null());
        assert_eq!(value["reason"], "runtime-config-missing");
        assert_eq!(value["status"], "skipped");
    }
}
