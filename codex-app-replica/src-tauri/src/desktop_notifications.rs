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
//!   "actionType": "open" | "<custom>" | "reply",
//!   "navigationPath": null | "...",
//!   "conversationId": null | "...",
//!   "requestId": null | "...",
//!   "reply": null | "..."
//! }
//! ```
//!
//! The upstream Windows owner tracks live `ToastNotification` objects so
//! `desktop-notification-hide` dismisses already shown toasts rather than
//! only forgetting local bookkeeping, and it forwards reply text from
//! `turn-complete` notifications when `replyPlaceholder` is present.
//! This replica now mirrors that behavior directly through the WinRT toast
//! APIs while preserving the existing Tauri command and event names.

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
use windows::core::IInspectable;
use windows::core::Interface;
use windows::core::Ref;
use windows::core::HSTRING;
use windows::Data::Xml::Dom::XmlDocument;
use windows::Foundation::Collections::ValueSet;
use windows::Foundation::IPropertyValue;
use windows::Foundation::TypedEventHandler;
use windows::UI::Notifications::ToastActivatedEventArgs;
use windows::UI::Notifications::ToastNotification;
use windows::UI::Notifications::ToastNotificationManager;

const DESKTOP_NOTIFICATION_ACTION_EVENT: &str = "desktop-notification-action";
const DEFAULT_HOST_ID: &str = "local";
const MAX_ACTIONS: usize = 4;
const POWERSHELL_AUMID: &str = Toast::POWERSHELL_APP_ID;
const REPLY_INPUT_ID: &str = "reply";
const REPLY_ACTION_ARGUMENT: &str = "__reply__";
const DEFAULT_REPLY_BUTTON_LABEL: &str = "Reply";
const NOTIFICATION_GROUP: &str = "codex-desktop";

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
    toast: ToastNotification,
}

impl DesktopNotificationsState {
    fn close_by_id(&self, id: &str) -> Option<ActiveNotification> {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        guard.by_id.remove(id)
    }

    fn close_by_conversation(&self, conversation_id: &str) -> Vec<ActiveNotification> {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        let to_remove: Vec<String> = guard
            .by_id
            .iter()
            .filter_map(|(id, entry)| {
                (entry.conversation_id.as_deref() == Some(conversation_id)).then(|| id.clone())
            })
            .collect();

        let mut removed = Vec::with_capacity(to_remove.len());
        for id in to_remove {
            if let Some(entry) = guard.by_id.remove(&id) {
                removed.push(entry);
            }
        }
        removed
    }

    fn record(&self, id: String, conversation_id: Option<String>, toast: ToastNotification) {
        let mut guard = self.inner.lock().expect("notification state poisoned");
        guard.by_id.insert(
            id,
            ActiveNotification {
                conversation_id,
                toast,
            },
        );
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

    if let Some(existing) = state.close_by_id(&notification.id) {
        dismiss_toast(&app, &existing.toast).ok();
    }

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

    let toast = create_toast_notification(&notification)?;
    let app_for_callback = app.clone();
    let target_label_for_callback = target_window_label.clone();
    let host_id_for_callback = host_id.clone();
    let actions_for_callback = actions.clone();
    let notification_for_callback = notification.clone();

    toast
        .Activated(&TypedEventHandler::new(
            move |_, args: Ref<'_, IInspectable>| {
                let payload = build_activation_payload(
                    &host_id_for_callback,
                    &notification_for_callback,
                    &actions_for_callback,
                    &args.cloned(),
                );
                let _ = app_for_callback.emit_to(
                    target_label_for_callback.as_str(),
                    DESKTOP_NOTIFICATION_ACTION_EVENT,
                    payload,
                );
                Ok(())
            },
        ))
        .map_err(|err| format!("failed to bind desktop notification activation: {err}"))?;

    let app_for_dismiss = app.clone();
    let dismiss_id = notification.id.clone();
    toast
        .Dismissed(&TypedEventHandler::new(move |_, _args| {
            let state = app_for_dismiss.state::<DesktopNotificationsState>();
            state.forget(&dismiss_id);
            Ok(())
        }))
        .map_err(|err| format!("failed to bind desktop notification dismissal: {err}"))?;

    let notifier = create_toast_notifier(&app)?;
    notifier
        .Show(&toast)
        .map_err(|err| format!("failed to show desktop notification: {err}"))?;

    state.record(
        notification.id.clone(),
        notification.conversation_id.clone(),
        toast,
    );

    Ok(())
}

#[tauri::command(rename = "desktop-notification-hide")]
pub fn desktop_notification_hide(
    app: AppHandle,
    state: State<'_, DesktopNotificationsState>,
    params: DesktopNotificationHideParams,
) -> Result<(), String> {
    match (params.notification_id, params.conversation_id) {
        (Some(id), _) => {
            if let Some(entry) = state.close_by_id(&id) {
                dismiss_toast(&app, &entry.toast)?;
            } else {
                dismiss_notification_history_entry(&app, &id)?;
            }
        }
        (None, Some(conversation_id)) => {
            let removed = state.close_by_conversation(&conversation_id);
            if removed.is_empty() {
                return Ok(());
            }
            for entry in removed {
                dismiss_toast(&app, &entry.toast)?;
            }
        }
        (None, None) => {}
    }

    Ok(())
}

fn build_activation_payload(
    host_id: &str,
    notification: &DesktopNotification,
    actions: &[DesktopNotificationAction],
    args: &Option<IInspectable>,
) -> DesktopNotificationActionPayload {
    let activated_args = args
        .as_ref()
        .and_then(|insp| insp.cast::<ToastActivatedEventArgs>().ok());
    let argument = activated_args
        .as_ref()
        .and_then(|args| args.Arguments().ok())
        .map(|value| value.to_string())
        .filter(|value| !value.is_empty());
    let reply = activated_args
        .as_ref()
        .and_then(|args| args.UserInput().ok())
        .and_then(|inputs| read_reply_input(&inputs));

    match argument {
        None => build_action_payload(
            host_id,
            notification,
            None,
            "open".to_string(),
            reply.filter(|value| !value.is_empty()),
        ),
        Some(argument) if argument == REPLY_ACTION_ARGUMENT => build_action_payload(
            host_id,
            notification,
            None,
            "reply".to_string(),
            reply.or(Some(String::new())),
        ),
        Some(argument) => {
            let action_type = actions
                .iter()
                .find(|action| action.id == argument)
                .and_then(|action| action.action_type.clone())
                .unwrap_or_else(|| argument.clone());
            build_action_payload(host_id, notification, Some(argument), action_type, None)
        }
    }
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

fn create_toast_notification(
    notification: &DesktopNotification,
) -> Result<ToastNotification, String> {
    let toast_xml = XmlDocument::new()
        .map_err(|err| format!("failed to allocate desktop notification xml: {err}"))?;
    toast_xml
        .LoadXml(&HSTRING::from(build_toast_xml(notification)))
        .map_err(|err| format!("failed to parse desktop notification xml: {err}"))?;

    let toast = ToastNotification::CreateToastNotification(&toast_xml)
        .map_err(|err| format!("failed to create desktop notification: {err}"))?;
    toast
        .SetTag(&HSTRING::from(notification.id.clone()))
        .map_err(|err| format!("failed to set desktop notification tag: {err}"))?;
    toast
        .SetGroup(&HSTRING::from(NOTIFICATION_GROUP))
        .map_err(|err| format!("failed to set desktop notification group: {err}"))?;
    Ok(toast)
}

fn build_toast_xml(notification: &DesktopNotification) -> String {
    let scenario = sticky_scenario_attribute(notification.kind.as_str());
    let title = escape_xml(&notification.title);
    let body = escape_xml(&notification.body);
    let actions_xml = build_actions_xml(notification);

    format!(
        "<toast {scenario}><visual><binding template=\"ToastGeneric\"><text>{title}</text><text>{body}</text></binding></visual>{actions_xml}</toast>"
    )
}

fn build_actions_xml(notification: &DesktopNotification) -> String {
    let actions = notification
        .actions
        .iter()
        .take(MAX_ACTIONS)
        .map(|action| {
            let title = escape_xml(&action.title);
            let id = escape_xml(&action.id);
            format!(
                "<action content=\"{title}\" arguments=\"{id}\" activationType=\"foreground\"/>"
            )
        })
        .collect::<String>();

    if !supports_reply(notification) {
        if actions.is_empty() {
            String::new()
        } else {
            format!("<actions>{actions}</actions>")
        }
    } else {
        let placeholder = escape_xml(
            notification
                .reply_placeholder
                .as_deref()
                .unwrap_or_default(),
        );
        let reply_label = escape_xml(DEFAULT_REPLY_BUTTON_LABEL);
        format!(
            "<actions><input id=\"{REPLY_INPUT_ID}\" type=\"text\" placeHolderContent=\"{placeholder}\"/>{actions}<action content=\"{reply_label}\" arguments=\"{REPLY_ACTION_ARGUMENT}\" activationType=\"foreground\" hint-inputId=\"{REPLY_INPUT_ID}\"/></actions>"
        )
    }
}

fn sticky_scenario_attribute(kind: &str) -> &'static str {
    match kind {
        "permission" | "question" => "scenario=\"reminder\"",
        _ => "",
    }
}

fn supports_reply(notification: &DesktopNotification) -> bool {
    notification.kind == "turn-complete" && notification.reply_placeholder.is_some()
}

fn create_toast_notifier(
    app: &AppHandle,
) -> Result<windows::UI::Notifications::ToastNotifier, String> {
    let aumid = resolve_aumid(app);
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(aumid))
        .map_err(|err| format!("failed to create desktop notification notifier: {err}"))
}

fn dismiss_toast(app: &AppHandle, toast: &ToastNotification) -> Result<(), String> {
    let notifier = create_toast_notifier(app)?;
    notifier
        .Hide(toast)
        .map_err(|err| format!("failed to dismiss desktop notification: {err}"))
}

fn dismiss_notification_history_entry(
    app: &AppHandle,
    notification_id: &str,
) -> Result<(), String> {
    let history = ToastNotificationManager::History()
        .map_err(|err| format!("failed to access desktop notification history: {err}"))?;
    let app_id = HSTRING::from(resolve_aumid(app));
    history
        .RemoveGroupedTagWithId(
            &HSTRING::from(notification_id),
            &HSTRING::from(NOTIFICATION_GROUP),
            &app_id,
        )
        .map_err(|err| format!("failed to remove desktop notification history entry: {err}"))
}

fn read_reply_input(inputs: &ValueSet) -> Option<String> {
    let value = inputs.Lookup(&HSTRING::from(REPLY_INPUT_ID)).ok()?;
    let property = value.cast::<IPropertyValue>().ok()?;
    property.GetString().ok().map(|value| value.to_string())
}

fn resolve_aumid(app: &AppHandle) -> String {
    let identifier = app.config().identifier.clone();
    if identifier.is_empty() {
        POWERSHELL_AUMID.to_string()
    } else {
        identifier
    }
}

fn escape_xml(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

#[cfg(test)]
fn sticky_scenario_for_kind(kind: &str) -> Option<Scenario> {
    match kind {
        "permission" | "question" => Some(Scenario::Reminder),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri_winrt_notification::Scenario;

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
        let toast = sample_toast();
        state.record("n-x".into(), Some("c-x".into()), toast);
        let removed = state.close_by_id("n-x");
        assert!(removed.is_some());
        let again = state.close_by_id("n-x");
        assert!(again.is_none());
    }

    #[test]
    fn state_close_by_conversation_clears_matching_entries() {
        let state = DesktopNotificationsState::default();
        state.record("n-1".into(), Some("c".into()), sample_toast());
        state.record("n-2".into(), Some("c".into()), sample_toast());
        state.record("n-3".into(), Some("other".into()), sample_toast());
        let removed = state.close_by_conversation("c");
        assert_eq!(removed.len(), 2);
        let guard = state.inner.lock().expect("lock");
        assert_eq!(guard.by_id.len(), 1);
        assert!(guard.by_id.contains_key("n-3"));
    }

    #[test]
    fn sticky_scenario_is_enabled_for_permission_and_question_only() {
        assert!(matches!(
            sticky_scenario_for_kind("permission"),
            Some(Scenario::Reminder)
        ));
        assert!(matches!(
            sticky_scenario_for_kind("question"),
            Some(Scenario::Reminder)
        ));
        assert!(sticky_scenario_for_kind("turn-complete").is_none());
        assert!(sticky_scenario_for_kind("info").is_none());
    }

    #[test]
    fn build_actions_xml_adds_reply_input_for_turn_complete_notifications() {
        let notification = DesktopNotification {
            id: "n-1".into(),
            kind: "turn-complete".into(),
            title: "Title".into(),
            body: "Body".into(),
            host_id: None,
            conversation_id: None,
            request_id: None,
            navigation_path: None,
            reply_placeholder: Some("Reply here".into()),
            actions: vec![DesktopNotificationAction {
                id: "open".into(),
                title: "Open".into(),
                action_type: Some("open".into()),
            }],
        };
        let xml = build_actions_xml(&notification);
        assert!(xml.contains("type=\"text\""));
        assert!(xml.contains("hint-inputId=\"reply\""));
        assert!(xml.contains("__reply__"));
    }

    #[test]
    fn build_actions_xml_skips_reply_for_non_turn_complete_notifications() {
        let notification = DesktopNotification {
            id: "n-2".into(),
            kind: "info".into(),
            title: "Title".into(),
            body: "Body".into(),
            host_id: None,
            conversation_id: None,
            request_id: None,
            navigation_path: None,
            reply_placeholder: Some("Reply here".into()),
            actions: vec![DesktopNotificationAction {
                id: "dismiss".into(),
                title: "Dismiss".into(),
                action_type: Some("dismiss".into()),
            }],
        };
        let xml = build_actions_xml(&notification);
        assert!(!xml.contains("type=\"text\""));
        assert!(!xml.contains("__reply__"));
    }

    #[test]
    fn build_toast_xml_escapes_special_characters() {
        let notification = DesktopNotification {
            id: "n-3".into(),
            kind: "question".into(),
            title: "Fish & Chips".into(),
            body: "2 < 3".into(),
            host_id: None,
            conversation_id: None,
            request_id: None,
            navigation_path: None,
            reply_placeholder: None,
            actions: Vec::new(),
        };
        let xml = build_toast_xml(&notification);
        assert!(xml.contains("scenario=\"reminder\""));
        assert!(xml.contains("Fish &amp; Chips"));
        assert!(xml.contains("2 &lt; 3"));
    }

    fn sample_toast() -> ToastNotification {
        create_toast_notification(&DesktopNotification {
            id: "sample".into(),
            kind: "info".into(),
            title: "Title".into(),
            body: "Body".into(),
            host_id: None,
            conversation_id: None,
            request_id: None,
            navigation_path: None,
            reply_placeholder: None,
            actions: Vec::new(),
        })
        .expect("create sample toast")
    }
}
