use std::sync::Arc;
use std::sync::Mutex;

use tauri::AppHandle;
use tauri::Manager;
use tauri::Window;
use tauri::WindowEvent;

use crate::auth_bridge::AuthBridgeState;
use crate::debug_modal::ambient_suggestions_refresh_for_project_root;
use crate::debug_modal::AmbientSuggestionsCache;
use crate::debug_modal::AmbientSuggestionsRefreshMode;
use crate::projectless_threads::projectless_workspace_root;
use crate::workspace_roots::read_active_workspace_roots_from_app;

#[derive(Debug, Default)]
pub struct AmbientSuggestionsBackgroundRefreshState {
    last_all_windows_unfocused: Mutex<bool>,
}

pub fn handle_window_event(
    window: &Window,
    event: &WindowEvent,
    auth_state: &Arc<AuthBridgeState>,
    cache: &Arc<AmbientSuggestionsCache>,
    background_state: &AmbientSuggestionsBackgroundRefreshState,
) {
    let WindowEvent::Focused(is_focused) = event else {
        return;
    };

    if *is_focused {
        set_all_windows_unfocused(background_state, false);
        return;
    }

    let app = window.app_handle();
    if any_window_focused(&app) {
        return;
    }

    let should_refresh = {
        let mut guard = background_state
            .last_all_windows_unfocused
            .lock()
            .expect("ambient suggestions background refresh mutex poisoned");
        if *guard {
            false
        } else {
            *guard = true;
            true
        }
    };
    if !should_refresh {
        return;
    }

    let Some(project_root) = refresh_project_root(&app) else {
        return;
    };
    let app = app.clone();
    let auth_state = auth_state.clone();
    let cache = cache.clone();
    tauri::async_runtime::spawn(async move {
        let _ = ambient_suggestions_refresh_for_project_root(
            &app,
            &auth_state,
            &cache,
            None,
            &project_root,
            AmbientSuggestionsRefreshMode::Default,
        )
        .await;
    });
}

pub fn sync_initial_focus_state(
    app: &AppHandle,
    background_state: &AmbientSuggestionsBackgroundRefreshState,
) {
    set_all_windows_unfocused(background_state, !any_window_focused(app));
}

fn set_all_windows_unfocused(
    background_state: &AmbientSuggestionsBackgroundRefreshState,
    value: bool,
) {
    *background_state
        .last_all_windows_unfocused
        .lock()
        .expect("ambient suggestions background refresh mutex poisoned") = value;
}

fn any_window_focused(app: &AppHandle) -> bool {
    app.webview_windows()
        .into_values()
        .any(|window| window.is_focused().unwrap_or(false))
}

fn refresh_project_root(app: &AppHandle) -> Option<String> {
    let active_workspace_root = read_active_workspace_roots_from_app(app)
        .ok()
        .and_then(|roots| roots.into_iter().next());
    active_workspace_root.or_else(|| projectless_workspace_root(app).ok())
}
