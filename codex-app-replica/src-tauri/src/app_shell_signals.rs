use serde::Serialize;
use tauri::{Emitter, Window, WindowEvent};

const ELECTRON_WINDOW_FOCUS_CHANGED_EVENT: &str = "electron-window-focus-changed";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ElectronWindowFocusChangedNotification {
    is_focused: bool,
}

#[tauri::command(rename = "electron-window-focus-request")]
pub fn electron_window_focus_request(window: Window) -> Result<(), String> {
    let is_focused = window.is_focused().map_err(|err| {
        format!(
            "failed to read {} window focus state: {err}",
            window.label()
        )
    })?;
    emit_window_focus_changed(&window, is_focused)
}

#[tauri::command(rename = "view-focused")]
pub fn view_focused() {}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::Focused(is_focused) = event {
        let _ = emit_window_focus_changed(window, *is_focused);
    }
}

fn emit_window_focus_changed(window: &Window, is_focused: bool) -> Result<(), String> {
    window
        .emit(
            ELECTRON_WINDOW_FOCUS_CHANGED_EVENT,
            ElectronWindowFocusChangedNotification { is_focused },
        )
        .map_err(|err| {
            format!(
                "failed to emit {ELECTRON_WINDOW_FOCUS_CHANGED_EVENT} for {}: {err}",
                window.label()
            )
        })
}

#[cfg(test)]
mod tests {
    use super::ElectronWindowFocusChangedNotification;

    #[test]
    fn focus_changed_notification_serializes_to_camel_case() {
        let notification = ElectronWindowFocusChangedNotification { is_focused: true };

        assert_eq!(
            serde_json::to_value(notification).expect("notification should serialize"),
            serde_json::json!({
                "isFocused": true
            })
        );
    }
}
