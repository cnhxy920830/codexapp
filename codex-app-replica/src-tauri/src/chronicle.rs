//! `chronicle-permissions` desktop owner.
//!
//! The extracted Personalization page polls `chronicle-permissions` once per
//! second while visible. Upstream's host implementation lives at
//! `compare/resources/26.506.2212.0/app.asar.extracted/.vite/build/main-Bnxe1qAn.js`
//! and resolves to:
//!
//! ```text
//! "chronicle-permissions": async () => {
//!   let e = FE(this.repoRoot),
//!       t = this.appServerConnectionRegistry
//!             .getMaybeConnection(xe)
//!             ?.getChronicleSidecarControlState();
//!   return {
//!     accessibility: NE(),
//!     screenRecording: PE(),
//!     chronicleSidecarPresent: e,
//!     chronicleSidecarProcessState: t?.state ?? "disabled",
//!   };
//! }
//! ```
//!
//! `NE()` and `PE()` are macOS-only system permission probes; the page itself
//! describes them as "macOS Accessibility / Screen Recording permission
//! status". Windows does not gate accessibility or screen recording the way
//! macOS does, so the Windows-faithful host returns `granted` for both.
//!
//! `FE(repoRoot)` checks for the bundled Chronicle sidecar binary. The upstream
//! Codex desktop bundle ships the sidecar inside its installer; replica builds
//! do not bundle one, so absence is the expected steady state, and the page's
//! sidecar-absent branch (`chronicleFeatureEnabled === false`) takes over and
//! hides the Chronicle UI. We still scan a small set of canonical install
//! locations so a future bundled build automatically lights the section up.
//!
//! `getChronicleSidecarControlState()` is owned by the app-server connection.
//! Without an active Chronicle sidecar, upstream returns `state: "disabled"`,
//! which we mirror exactly.

use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)] // variants reflect upstream's full status enum; Windows currently emits Granted.
pub enum ChroniclePermissionStatus {
    Granted,
    Denied,
    Restricted,
    NotDetermined,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)] // variants reflect upstream's full lifecycle; replica reports Disabled until a sidecar lands.
pub enum ChronicleSidecarProcessState {
    Disabled,
    Starting,
    Running,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChroniclePermissionsResponse {
    pub accessibility: ChroniclePermissionStatus,
    pub screen_recording: ChroniclePermissionStatus,
    pub chronicle_sidecar_present: bool,
    pub chronicle_sidecar_process_state: ChronicleSidecarProcessState,
}

#[tauri::command(rename = "chronicle-permissions")]
pub fn chronicle_permissions(app: AppHandle) -> Result<ChroniclePermissionsResponse, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("failed to resolve resource dir: {err}"))
        .ok();

    Ok(build_response(resource_dir.as_deref(), &platform_status()))
}

fn build_response(
    resource_dir: Option<&std::path::Path>,
    status: &PlatformStatus,
) -> ChroniclePermissionsResponse {
    let chronicle_sidecar_present = locate_chronicle_sidecar(resource_dir).is_some();
    ChroniclePermissionsResponse {
        accessibility: status.accessibility,
        screen_recording: status.screen_recording,
        chronicle_sidecar_present,
        chronicle_sidecar_process_state: ChronicleSidecarProcessState::Disabled,
    }
}

#[derive(Debug, Clone, Copy)]
struct PlatformStatus {
    accessibility: ChroniclePermissionStatus,
    screen_recording: ChroniclePermissionStatus,
}

#[cfg(target_os = "windows")]
fn platform_status() -> PlatformStatus {
    // Windows has no equivalent of macOS's Accessibility / Screen Recording
    // privacy gates that Chronicle queries. Upstream `NE()` / `PE()` always
    // resolve to `granted` on Windows because the underlying probes return
    // `kAXTrustedCheckOptionPrompt = false`-style results that map to granted.
    PlatformStatus {
        accessibility: ChroniclePermissionStatus::Granted,
        screen_recording: ChroniclePermissionStatus::Granted,
    }
}

#[cfg(not(target_os = "windows"))]
fn platform_status() -> PlatformStatus {
    PlatformStatus {
        accessibility: ChroniclePermissionStatus::Unknown,
        screen_recording: ChroniclePermissionStatus::Unknown,
    }
}

/// Look for the Chronicle sidecar in the canonical install locations.
///
/// Returns the discovered binary path so callers can extend the lookup later
/// (process-state probing, version reporting). The current command path only
/// needs the boolean.
fn locate_chronicle_sidecar(resource_dir: Option<&std::path::Path>) -> Option<PathBuf> {
    for candidate in candidate_sidecar_paths(resource_dir) {
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn candidate_sidecar_paths(resource_dir: Option<&std::path::Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(dir) = resource_dir {
        candidates.push(
            dir.join("sidecars")
                .join("chronicle")
                .join("codex-chronicle.exe"),
        );
        candidates.push(dir.join("chronicle").join("codex-chronicle.exe"));
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let local_app_data = PathBuf::from(local_app_data);
        candidates.push(
            local_app_data
                .join("Codex")
                .join("sidecars")
                .join("chronicle")
                .join("codex-chronicle.exe"),
        );
        candidates.push(
            local_app_data
                .join("Programs")
                .join("Codex")
                .join("resources")
                .join("sidecars")
                .join("chronicle")
                .join("codex-chronicle.exe"),
        );
    }

    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        candidates.push(
            PathBuf::from(program_files)
                .join("Codex")
                .join("resources")
                .join("sidecars")
                .join("chronicle")
                .join("codex-chronicle.exe"),
        );
    }

    candidates
}

#[cfg(not(target_os = "windows"))]
fn candidate_sidecar_paths(resource_dir: Option<&std::path::Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(dir) = resource_dir {
        candidates.push(
            dir.join("sidecars")
                .join("chronicle")
                .join("codex-chronicle"),
        );
        candidates.push(dir.join("chronicle").join("codex-chronicle"));
    }
    candidates
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn response_serializes_camel_case_with_kebab_case_status() {
        let response = ChroniclePermissionsResponse {
            accessibility: ChroniclePermissionStatus::Granted,
            screen_recording: ChroniclePermissionStatus::NotDetermined,
            chronicle_sidecar_present: false,
            chronicle_sidecar_process_state: ChronicleSidecarProcessState::Disabled,
        };
        let value = serde_json::to_value(&response).expect("response should serialize");
        assert_eq!(value["accessibility"], "granted");
        assert_eq!(value["screenRecording"], "not-determined");
        assert_eq!(value["chronicleSidecarPresent"], false);
        assert_eq!(value["chronicleSidecarProcessState"], "disabled");
    }

    #[test]
    fn build_response_reports_absent_sidecar_when_no_binary_exists() {
        let temp = unique_temp_dir("chronicle-absent");
        let status = PlatformStatus {
            accessibility: ChroniclePermissionStatus::Granted,
            screen_recording: ChroniclePermissionStatus::Granted,
        };

        let response = build_response(Some(&temp), &status);

        assert_eq!(response.accessibility, ChroniclePermissionStatus::Granted);
        assert_eq!(
            response.screen_recording,
            ChroniclePermissionStatus::Granted
        );
        assert!(!response.chronicle_sidecar_present);
        assert_eq!(
            response.chronicle_sidecar_process_state,
            ChronicleSidecarProcessState::Disabled,
        );

        let _ = fs::remove_dir_all(temp);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn build_response_detects_resource_dir_sidecar_on_windows() {
        let temp = unique_temp_dir("chronicle-resource");
        let sidecar = temp
            .join("sidecars")
            .join("chronicle")
            .join("codex-chronicle.exe");
        fs::create_dir_all(sidecar.parent().expect("parent path resolves"))
            .expect("sidecar parent created");
        fs::write(&sidecar, []).expect("sidecar binary placeholder created");

        let status = PlatformStatus {
            accessibility: ChroniclePermissionStatus::Granted,
            screen_recording: ChroniclePermissionStatus::Granted,
        };
        let response = build_response(Some(&temp), &status);

        assert!(response.chronicle_sidecar_present);
        // Process state stays disabled until an app-server connection reports otherwise.
        assert_eq!(
            response.chronicle_sidecar_process_state,
            ChronicleSidecarProcessState::Disabled,
        );

        let _ = fs::remove_dir_all(temp);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn build_response_detects_resource_dir_sidecar_off_windows() {
        let temp = unique_temp_dir("chronicle-resource");
        let sidecar = temp
            .join("sidecars")
            .join("chronicle")
            .join("codex-chronicle");
        fs::create_dir_all(sidecar.parent().expect("parent path resolves"))
            .expect("sidecar parent created");
        fs::write(&sidecar, []).expect("sidecar binary placeholder created");

        let status = PlatformStatus {
            accessibility: ChroniclePermissionStatus::Granted,
            screen_recording: ChroniclePermissionStatus::Granted,
        };
        let response = build_response(Some(&temp), &status);

        assert!(response.chronicle_sidecar_present);

        let _ = fs::remove_dir_all(temp);
    }

    fn unique_temp_dir(case: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-app-replica-{case}-{nanos}"));
        fs::create_dir_all(&path).expect("temp dir created");
        path
    }
}
