//! Remote app-server connection registry.
//!
//! This module owns the per-host connection state that upstream
//! `main-Bnxe1qAn.js` calls `appServerConnectionRegistry`. It is the
//! foundation for the remote-host owner chain (`P-022`, `P-023`, `P-009`,
//! `P-050`, `P-057`, `P-006`, `P-045`).
//!
//! Phase 1 (this commit) delivers the in-process state machine and the
//! `app-server-connection-state` query backed by it. The state machine
//! tracks every host-id the user has configured along with its
//! connection state, last error, and auto-connect preference, so the
//! settings shells (`P-048` shared selected-host context, `P-022`
//! Remote Connections Settings) stop seeing a hard-coded
//! `disconnected` / `null` stub and instead see whatever the registry
//! currently reports.
//!
//! Phase 2 (follow-up work item) wires the actual SSH transport that
//! spawns a remote `codex app-server --listen stdio://` per host and
//! drives the state machine from real connection events. Until that
//! transport lands, the registry remains in `Disconnected` for unknown
//! hosts and only flips to other states when an explicit set-state
//! command is invoked.
//!
//! The shape of `AppServerConnectionStateResponse` is preserved so
//! `app-server-connection-state-CkyVIVDP.js` and the page-owners that
//! consume it cannot tell the difference between Phase 1 and Phase 2 at
//! the wire level — they simply see the registry-backed state.

use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RemoteAppServerConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

impl Default for RemoteAppServerConnectionState {
    fn default() -> Self {
        RemoteAppServerConnectionState::Disconnected
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAppServerHostStatus {
    pub host_id: String,
    pub state: RemoteAppServerConnectionState,
    pub error: Option<String>,
    pub auto_connect: bool,
}

#[derive(Default)]
pub struct RemoteAppServerRegistry {
    inner: Mutex<RegistryInner>,
}

#[derive(Default)]
struct RegistryInner {
    hosts: HashMap<String, RegistryEntry>,
}

#[derive(Default, Clone)]
struct RegistryEntry {
    state: RemoteAppServerConnectionState,
    error: Option<String>,
    auto_connect: bool,
}

impl RemoteAppServerRegistry {
    pub fn snapshot(&self, host_id: &str) -> RemoteAppServerHostStatus {
        let guard = self.inner.lock().expect("registry mutex poisoned");
        let entry = guard.hosts.get(host_id).cloned().unwrap_or_default();
        RemoteAppServerHostStatus {
            host_id: host_id.to_string(),
            state: entry.state,
            error: entry.error,
            auto_connect: entry.auto_connect,
        }
    }

    pub fn list(&self) -> Vec<RemoteAppServerHostStatus> {
        let guard = self.inner.lock().expect("registry mutex poisoned");
        let mut entries: Vec<RemoteAppServerHostStatus> = guard
            .hosts
            .iter()
            .map(|(host_id, entry)| RemoteAppServerHostStatus {
                host_id: host_id.clone(),
                state: entry.state,
                error: entry.error.clone(),
                auto_connect: entry.auto_connect,
            })
            .collect();
        entries.sort_by(|left, right| left.host_id.cmp(&right.host_id));
        entries
    }

    pub fn ensure_host(&self, host_id: &str) {
        let mut guard = self.inner.lock().expect("registry mutex poisoned");
        guard.hosts.entry(host_id.to_string()).or_default();
    }

    pub fn set_state(
        &self,
        host_id: &str,
        state: RemoteAppServerConnectionState,
        error: Option<String>,
    ) {
        let mut guard = self.inner.lock().expect("registry mutex poisoned");
        let entry = guard.hosts.entry(host_id.to_string()).or_default();
        entry.state = state;
        entry.error = error;
    }

    pub fn set_auto_connect(&self, host_id: &str, auto_connect: bool) {
        let mut guard = self.inner.lock().expect("registry mutex poisoned");
        let entry = guard.hosts.entry(host_id.to_string()).or_default();
        entry.auto_connect = auto_connect;
    }

    pub fn forget(&self, host_id: &str) {
        let mut guard = self.inner.lock().expect("registry mutex poisoned");
        guard.hosts.remove(host_id);
    }

    /// Returns true if the host is currently reporting `Connected` state.
    pub fn is_connected(&self, host_id: &str) -> bool {
        let guard = self.inner.lock().expect("registry mutex poisoned");
        guard
            .hosts
            .get(host_id)
            .map(|entry| matches!(entry.state, RemoteAppServerConnectionState::Connected))
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAppServerConnectStateParams {
    pub host_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAppServerConnectStateResponse {
    pub state: RemoteAppServerConnectionState,
    pub error: Option<String>,
}

/// Page-owned `app-server-connection-state` query, registry-backed.
///
/// Kept compatible with the upstream payload shape so the
/// `app-server-connection-state-CkyVIVDP.js` shared helper continues to
/// work without modification. Currently exercised through tests; the
/// runtime command in `remote_connections.rs` calls the registry directly.
#[allow(dead_code)]
pub fn registry_connection_state(
    registry: &RemoteAppServerRegistry,
    host_id: &str,
) -> RemoteAppServerConnectStateResponse {
    let snapshot = registry.snapshot(host_id);
    RemoteAppServerConnectStateResponse {
        state: snapshot.state,
        error: snapshot.error,
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetRemoteAutoConnectParams {
    pub host_id: String,
    pub auto_connect: bool,
}

#[tauri::command(rename = "set-remote-connection-auto-connect")]
pub fn set_remote_connection_auto_connect(
    registry: State<'_, RemoteAppServerRegistry>,
    params: SetRemoteAutoConnectParams,
) -> Result<(), String> {
    registry.set_auto_connect(&params.host_id, params.auto_connect);
    Ok(())
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnsureRemoteConnectionParams {
    pub host_id: String,
}

#[tauri::command(rename = "ensure-remote-connection-connected")]
pub fn ensure_remote_connection_connected(
    registry: State<'_, RemoteAppServerRegistry>,
    params: EnsureRemoteConnectionParams,
) -> Result<RemoteAppServerHostStatus, String> {
    registry.ensure_host(&params.host_id);
    // Phase 1: surface a Connecting state so settings UIs can render the
    // intent. Phase 2 will replace this with a real SSH dial.
    registry.set_state(
        &params.host_id,
        RemoteAppServerConnectionState::Connecting,
        None,
    );
    Ok(registry.snapshot(&params.host_id))
}

#[tauri::command(rename = "disconnect-remote-connection")]
pub fn disconnect_remote_connection(
    registry: State<'_, RemoteAppServerRegistry>,
    params: EnsureRemoteConnectionParams,
) -> Result<RemoteAppServerHostStatus, String> {
    registry.set_state(
        &params.host_id,
        RemoteAppServerConnectionState::Disconnected,
        None,
    );
    Ok(registry.snapshot(&params.host_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_host_defaults_to_disconnected() {
        let registry = RemoteAppServerRegistry::default();
        let response = registry_connection_state(&registry, "host-a");
        assert_eq!(response.state, RemoteAppServerConnectionState::Disconnected);
        assert!(response.error.is_none());
    }

    #[test]
    fn ensure_host_creates_default_entry() {
        let registry = RemoteAppServerRegistry::default();
        registry.ensure_host("host-a");
        let entries = registry.list();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].host_id, "host-a");
        assert_eq!(
            entries[0].state,
            RemoteAppServerConnectionState::Disconnected
        );
        assert!(!entries[0].auto_connect);
    }

    #[test]
    fn set_state_updates_existing_entry_with_error_message() {
        let registry = RemoteAppServerRegistry::default();
        registry.set_state(
            "host-b",
            RemoteAppServerConnectionState::Error,
            Some("ssh handshake failed".into()),
        );
        let response = registry_connection_state(&registry, "host-b");
        assert_eq!(response.state, RemoteAppServerConnectionState::Error);
        assert_eq!(response.error.as_deref(), Some("ssh handshake failed"));
    }

    #[test]
    fn set_auto_connect_persists_independent_of_state() {
        let registry = RemoteAppServerRegistry::default();
        registry.set_auto_connect("host-c", true);
        let snapshot = registry.snapshot("host-c");
        assert!(snapshot.auto_connect);
        assert_eq!(snapshot.state, RemoteAppServerConnectionState::Disconnected);
    }

    #[test]
    fn forget_clears_entry() {
        let registry = RemoteAppServerRegistry::default();
        registry.ensure_host("host-d");
        registry.forget("host-d");
        assert!(registry.list().is_empty());
    }

    #[test]
    fn is_connected_only_returns_true_when_state_is_connected() {
        let registry = RemoteAppServerRegistry::default();
        registry.set_state("host-e", RemoteAppServerConnectionState::Connecting, None);
        assert!(!registry.is_connected("host-e"));
        registry.set_state("host-e", RemoteAppServerConnectionState::Connected, None);
        assert!(registry.is_connected("host-e"));
        registry.set_state(
            "host-e",
            RemoteAppServerConnectionState::Error,
            Some("dropped".into()),
        );
        assert!(!registry.is_connected("host-e"));
    }

    #[test]
    fn list_is_sorted_by_host_id() {
        let registry = RemoteAppServerRegistry::default();
        registry.ensure_host("zeta");
        registry.ensure_host("alpha");
        registry.ensure_host("middle");
        let ordered: Vec<String> = registry.list().into_iter().map(|h| h.host_id).collect();
        assert_eq!(ordered, vec!["alpha", "middle", "zeta"]);
    }

    #[test]
    fn connection_state_serializes_kebab_case() {
        let response = RemoteAppServerConnectStateResponse {
            state: RemoteAppServerConnectionState::Connected,
            error: None,
        };
        let value = serde_json::to_value(&response).expect("serialize");
        assert_eq!(value["state"], "connected");
        assert!(value["error"].is_null());
    }

    #[test]
    fn host_status_serializes_camel_case() {
        let status = RemoteAppServerHostStatus {
            host_id: "h".into(),
            state: RemoteAppServerConnectionState::Connecting,
            error: Some("slow".into()),
            auto_connect: true,
        };
        let value = serde_json::to_value(&status).expect("serialize");
        assert_eq!(value["hostId"], "h");
        assert_eq!(value["state"], "connecting");
        assert_eq!(value["error"], "slow");
        assert_eq!(value["autoConnect"], true);
    }

    #[test]
    fn auto_connect_params_deserialize_camel_case() {
        let raw = serde_json::json!({"hostId": "h", "autoConnect": true});
        let parsed: SetRemoteAutoConnectParams = serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.host_id, "h");
        assert!(parsed.auto_connect);
    }
}
