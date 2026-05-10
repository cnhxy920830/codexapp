//! Desktop notification owner.
//!
//! Implements `desktop-notification-show` and `desktop-notification-hide`
//! Tauri commands that mirror upstream `main-Bnxe1qAn.js`'s
//! `desktopNotificationManager.showNotification(...)` /
//! `dismissByNotificationId(...)` / `dismissByConversationId(...)`.
//!
//! Activation events fire back to the calling window as the
//! `desktop-notification-action` Tauri event with the upstream payload shape:
//!
//! ```json
//! {
//!   "type": "desktop-notification-action",
//!   "hostId": "...",
//!   "notificationId": "...",
//!   "actionId": null | "...",
//!   "actionType": "open" | "<custom>",
//!   "navigationPath": null | "...",
//!   "conversationId": null | "...",
//!   "requestId": null | "...",
//!   "reply": null
//! }
//! ```
//!
//! Implementation uses `tauri-winrt-notification`, which wraps Windows'
//! ToastNotificationManager. AppUserModelID is set from
//! `tauri::Config::identifier` so toast registrations stay aligned with the
//! installer-time identifier. Reply input (`<input type="text">` toast XML)
//! is not exposed by `tauri-winrt-notification` 0.7; the upstream contract
//! only enables it for `kind === "turn-complete"
//! && typeof replyPlaceholder === "string"`. For now those payloads still
//! display normally and the click path emits `actionType: "open"` as the
//! faithful fallback. Adding reply input requires direct WinRT XML
//! construction and is tracked as a follow-up scope decision.

use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri::Window;
use tauri_winrt_notification::Toast;

const DESKTOP_NOTIFICATION_ACTION_EVENT: &str = "desktop-notification-action";
const DEFAULT_HOST_ID: &str = "local";
const MAX_ACTIONS: usize = 4;
const POWERSHELL_AUMID: &str = Toast::POWERSHELL_APP_ID;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationAction {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub action_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotification {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub navigation_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_placeholder: Option<String>,
    #[serde(default)]
    pub actions: Vec<DesktopNotificationAction>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationShowParams {
    pub notification: DesktopNotification,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationHideParams {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notification_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationActionPayload {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub host_id: String,
    pub notification_id: String,
    pub action_id: Option<String>,
    pub action_type: String,
    pub navigation_path: Option<String>,
    pub conversation_id: Option<String>,
    pub request_id: Option<String>,
    pub reply: Option<String>,
}

#[derive(Default)]
pub struct DesktopNotificationsState {
    inner: Mutex<DesktopNotificationsStateInner>,
}

#[derive(Default)]
struct DesktopNotificationsStateInner {
    by_id: HashMap<String, ActiveNotification>,
}

struct ActiveNotification {
    conversation_id: Option<String>,
}

impl DesktopNotificationsState {
    fn close_by_id(&self, id: &str) -> Option<ActiveNotification> {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        guard.by_id.remove(id)
    }

    fn close_by_conversation(&self, conversation_id: &str) -> Vec<String> {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        let to_remove: Vec<String> = guard
            .by_id
            .iter()
            .filter_map(|(id, entry)| {
                (entry.conversation_id.as_deref() == Some(conversation_id)).then(|| id.clone())
            })
            .collect();
        for id in &to_remove {
            guard.by_id.remove(id);
        }
        to_remove
    }

    fn record(&self, id: String, conversation_id: Option<String>) {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        guard
            .by_id
            .insert(id, ActiveNotification { conversation_id });
    }

    fn forget(&self, id: &str) {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        guard.by_id.remove(id);
    }
}

#[tauri::command(rename = "desktop-notification-show")]
pub fn desktop_notification_show(
    app: AppHandle,
    window: Window,
    state: State<'_, DesktopNotificationsState>,
    params: DesktopNotificationShowParams,
) -> Result<(), String> {
    let target_window_label = window.label().to_string();
    let notification = params.notification;

    state.close_by_id(&notification.id);

    let host_id = notification
        .host_id
        .clone()
        .unwrap_or_else(|| DEFAULT_HOST_ID.to_string());

    let actions = notification
        .actions
        .iter()
        .take(MAX_ACTIONS)
        .cloned()
        .collect::<Vec<_>>();

    let aumid = resolve_aumid(&app);

    let mut toast = Toast::new(&aumid)
        .title(&notification.title)
        .text1(&notification.body);

    for action in &actions {
        toast = toast.add_button(&action.title, &action.id);
    }

    let app_for_callback = app.clone();
    let target_label_for_callback = target_window_label.clone();
    let host_id_for_callback = host_id.clone();
    let actions_for_callback = actions.clone();
    let notification_for_callback = notification.clone();

    toast = toast.on_activated(move |action_argument| {
        let payload = match action_argument {
            None => build_action_payload(
                &host_id_for_callback,
                &notification_for_callback,
                None,
                "open".to_string(),
                None,
            ),
            Some(arg) => {
                let action_id = arg.to_string();
                let action_type = actions_for_callback
                    .iter()
                    .find(|a| a.id == action_id)
                    .and_then(|a| a.action_type.clone())
                    .unwrap_or_else(|| action_id.clone());
                build_action_payload(
                    &host_id_for_callback,
                    &notification_for_callback,
                    Some(action_id),
                    action_type,
                    None,
                )
            }
        };
        let _ = app_for_callback.emit_to(
            target_label_for_callback.as_str(),
            DESKTOP_NOTIFICATION_ACTION_EVENT,
            payload,
        );
        Ok(())
    });

    let app_for_dismiss = app.clone();
    let dismiss_id = notification.id.clone();
    toast = toast.on_dismissed(move |_reason| {
        let state = app_for_dismiss.state::<DesktopNotificationsState>();
        state.forget(&dismiss_id);
        Ok(())
    });

    state.record(
        notification.id.clone(),
        notification.conversation_id.clone(),
    );

    toast
        .show()
        .map_err(|err| format!("failed to show desktop notification: {err}"))
}

#[tauri::command(rename = "desktop-notification-hide")]
pub fn desktop_notification_hide(
    state: State<'_, DesktopNotificationsState>,
    params: DesktopNotificationHideParams,
) -> Result<(), String> {
    // tauri-winrt-notification 0.7 does not expose a dismiss-by-handle API;
    // the platform behavior is that the toast remains in Action Center until
    // the user dismisses it or its timeout elapses. We still clear our
    // tracking state so subsequent show calls with the same id behave like
    // upstream's "replace by id" semantics.
    match (params.notification_id, params.conversation_id) {
        (Some(id), _) => {
            state.close_by_id(&id);
        }
        (None, Some(conv)) => {
            state.close_by_conversation(&conv);
        }
        (None, None) => {}
    }
    Ok(())
}

fn build_action_payload(
    host_id: &str,
    notification: &DesktopNotification,
    action_id: Option<String>,
    action_type: String,
    reply: Option<String>,
) -> DesktopNotificationActionPayload {
    DesktopNotificationActionPayload {
        kind: "desktop-notification-action",
        host_id: host_id.to_string(),
        notification_id: notification.id.clone(),
        action_id,
        action_type,
        navigation_path: notification.navigation_path.clone(),
        conversation_id: notification.conversation_id.clone(),
        request_id: notification.request_id.clone(),
        reply,
    }
}

fn resolve_aumid(app: &AppHandle) -> String {
    let identifier = app.config().identifier.clone();
    if identifier.is_empty() {
        POWERSHELL_AUMID.to_string()
    } else {
        identifier
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn show_params_deserialize_camel_case_with_full_shape() {
        let raw = serde_json::json!({
            "notification": {
                "id": "n-1",
                "kind": "turn-complete",
                "title": "Title",
                "body": "Body",
                "hostId": "local",
                "conversationId": "c-1",
                "requestId": "r-1",
                "navigationPath": "/local/c-1",
                "replyPlaceholder": "Reply…",
                "actions": [
                    { "id": "a-1", "title": "Open", "actionType": "open" },
                    { "id": "a-2", "title": "Snooze", "actionType": "snooze" }
                ]
            }
        });
        let parsed: DesktopNotificationShowParams =
            serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.notification.id, "n-1");
        assert_eq!(parsed.notification.kind, "turn-complete");
        assert_eq!(parsed.notification.host_id.as_deref(), Some("local"));
        assert_eq!(parsed.notification.actions.len(), 2);
        assert_eq!(parsed.notification.actions[0].id, "a-1");
    }

    #[test]
    fn show_params_allow_minimal_shape() {
        let raw = serde_json::json!({
            "notification": {
                "id": "n-2",
                "kind": "info",
                "title": "Hello",
                "body": "World"
            }
        });
        let parsed: DesktopNotificationShowParams =
            serde_json::from_value(raw).expect("deserialize minimal");
        assert!(parsed.notification.host_id.is_none());
        assert!(parsed.notification.actions.is_empty());
    }

    #[test]
    fn hide_params_accept_id_only_or_conversation_only() {
        let by_id: DesktopNotificationHideParams =
            serde_json::from_value(serde_json::json!({"notificationId": "n-1"})).unwrap();
        assert_eq!(by_id.notification_id.as_deref(), Some("n-1"));
        assert!(by_id.conversation_id.is_none());

        let by_conv: DesktopNotificationHideParams =
            serde_json::from_value(serde_json::json!({"conversationId": "c-2"})).unwrap();
        assert!(by_conv.notification_id.is_none());
        assert_eq!(by_conv.conversation_id.as_deref(), Some("c-2"));
    }

    #[test]
    fn action_payload_serializes_camel_case_with_type_field() {
        let payload = DesktopNotificationActionPayload {
            kind: "desktop-notification-action",
            host_id: "local".into(),
            notification_id: "n-3".into(),
            action_id: Some("a-1".into()),
            action_type: "open".into(),
            navigation_path: Some("/local/c-3".into()),
            conversation_id: Some("c-3".into()),
            request_id: None,
            reply: None,
        };
        let value = serde_json::to_value(&payload).expect("serialize");
        assert_eq!(value["type"], "desktop-notification-action");
        assert_eq!(value["hostId"], "local");
        assert_eq!(value["notificationId"], "n-3");
        assert_eq!(value["actionId"], "a-1");
        assert_eq!(value["actionType"], "open");
        assert_eq!(value["navigationPath"], "/local/c-3");
        assert!(value["reply"].is_null());
    }

    #[test]
    fn build_action_payload_preserves_notification_metadata() {
        let notification = DesktopNotification {
            id: "n-4".into(),
            kind: "turn-complete".into(),
            title: "T".into(),
            body: "B".into(),
            host_id: Some("local".into()),
            conversation_id: Some("c-4".into()),
            request_id: Some("r-4".into()),
            navigation_path: Some("/local/c-4".into()),
            reply_placeholder: None,
            actions: Vec::new(),
        };
        let payload = build_action_payload(
            "local",
            &notification,
            Some("a-99".into()),
            "snooze".into(),
            Some("hi".into()),
        );
        assert_eq!(payload.action_id.as_deref(), Some("a-99"));
        assert_eq!(payload.action_type, "snooze");
        assert_eq!(payload.reply.as_deref(), Some("hi"));
        assert_eq!(payload.conversation_id.as_deref(), Some("c-4"));
        assert_eq!(payload.request_id.as_deref(), Some("r-4"));
    }

    #[test]
    fn state_close_by_id_is_idempotent() {
        let state = DesktopNotificationsState::default();
        state.record("n-x".into(), Some("c-x".into()));
        let removed = state.close_by_id("n-x");
        assert!(removed.is_some());
        let again = state.close_by_id("n-x");
        assert!(again.is_none());
    }

    #[test]
    fn state_close_by_conversation_clears_matching_entries() {
        let state = DesktopNotificationsState::default();
        state.record("n-1".into(), Some("c".into()));
        state.record("n-2".into(), Some("c".into()));
        state.record("n-3".into(), Some("other".into()));
        let removed = state.close_by_conversation("c");
        assert_eq!(removed.len(), 2);
        let guard = state.inner.lock().unwrap();
        assert_eq!(guard.by_id.len(), 1);
        assert!(guard.by_id.contains_key("n-3"));
    }
}
