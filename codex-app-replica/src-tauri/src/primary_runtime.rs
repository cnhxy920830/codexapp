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
//! state. Default responses match the upstream "feature not enabled / no
//! runtime installed" branch — `bundleVersion: null`, `installed: false`,
//! `instructions: null`, no problems, no install in progress. This is the
//! faithful steady state on a machine where no runtime has yet been
//! provisioned.
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeHostParams {
    pub host_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeReleaseParams {
    pub host_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release: Option<String>,
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
pub struct InstallPrimaryRuntimeResponse {
    pub started: bool,
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
pub enum PrimaryRuntimeUpdateStatusKind {
    Idle,
    Checking,
    Available,
    Installing,
    Failed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeUpdateStatusResponse {
    pub status: PrimaryRuntimeUpdateStatusKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryRuntimeInstallProgressEvent {
    pub host_id: String,
    pub progress: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release: Option<String>,
}

#[derive(Default)]
pub struct PrimaryRuntimeState {
    inner: Mutex<PrimaryRuntimeStateInner>,
}

#[derive(Default)]
struct PrimaryRuntimeStateInner {
    update_status: Option<PrimaryRuntimeUpdateStatusKind>,
}

impl PrimaryRuntimeState {
    fn current_update_status(&self) -> PrimaryRuntimeUpdateStatusResponse {
        let guard = self.inner.lock().expect("primary runtime state poisoned");
        PrimaryRuntimeUpdateStatusResponse {
            status: guard
                .update_status
                .unwrap_or(PrimaryRuntimeUpdateStatusKind::Idle),
            error_message: None,
        }
    }

    fn set_update_status(&self, status: PrimaryRuntimeUpdateStatusKind) {
        let mut guard = self.inner.lock().expect("primary runtime state poisoned");
        guard.update_status = Some(status);
    }
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
    params: PrimaryRuntimeReleaseParams,
) -> Result<InstallPrimaryRuntimeResponse, String> {
    // Phase 1: emit a single 0% progress event so the page-owner knows the
    // install request was received. Phase 2 will replace this with a real
    // installer task that streams measured progress.
    let event = PrimaryRuntimeInstallProgressEvent {
        host_id: params.host_id.clone(),
        progress: 0.0,
        release: params.release.clone(),
    };
    let _ = app.emit(PRIMARY_RUNTIME_INSTALL_PROGRESS_EVENT, event);
    Ok(InstallPrimaryRuntimeResponse { started: true })
}

#[tauri::command(rename = "finish-primary-runtime-install")]
pub fn finish_primary_runtime_install(
    _params: PrimaryRuntimeReleaseParams,
) -> Result<FinishPrimaryRuntimeInstallResponse, String> {
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
) -> Result<PrimaryRuntimeUpdateStatusResponse, String> {
    state.set_update_status(PrimaryRuntimeUpdateStatusKind::Idle);
    Ok(state.current_update_status())
}

#[tauri::command(rename = "reset-primary-runtime-dependencies")]
pub fn reset_primary_runtime_dependencies(
    _params: PrimaryRuntimeReleaseParams,
) -> Result<DiagnosePrimaryRuntimeDependenciesResponse, String> {
    Ok(DiagnosePrimaryRuntimeDependenciesResponse {
        bundle_version: None,
        installed: false,
        problems: Vec::new(),
    })
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
            host_id: "local".into(),
            progress: 42.5,
            release: Some("1.0.0".into()),
        };
        let value = serde_json::to_value(&event).expect("serialize");
        assert_eq!(value["hostId"], "local");
        assert_eq!(value["progress"], 42.5);
        assert_eq!(value["release"], "1.0.0");
    }

    #[test]
    fn install_progress_event_omits_null_release() {
        let event = PrimaryRuntimeInstallProgressEvent {
            host_id: "local".into(),
            progress: 0.0,
            release: None,
        };
        let value = serde_json::to_value(&event).expect("serialize");
        assert!(value.get("release").is_none() || value["release"].is_null());
    }

    #[test]
    fn host_params_decode_camel_case() {
        let raw = serde_json::json!({"hostId": "local"});
        let parsed: PrimaryRuntimeHostParams = serde_json::from_value(raw).expect("decode");
        assert_eq!(parsed.host_id, "local");
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
    fn update_status_starts_idle_and_can_advance() {
        let state = PrimaryRuntimeState::default();
        let initial = state.current_update_status();
        assert_eq!(initial.status, PrimaryRuntimeUpdateStatusKind::Idle);
        state.set_update_status(PrimaryRuntimeUpdateStatusKind::Checking);
        let next = state.current_update_status();
        assert_eq!(next.status, PrimaryRuntimeUpdateStatusKind::Checking);
    }

    #[test]
    fn update_status_serializes_kebab_case() {
        let response = PrimaryRuntimeUpdateStatusResponse {
            status: PrimaryRuntimeUpdateStatusKind::Available,
            error_message: None,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["status"], "available");
        assert!(value.get("errorMessage").is_none());
    }
}
