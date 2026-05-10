use serde::Deserialize;
use std::sync::Mutex;
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size, State,
    WebviewWindow, Window,
};

const MAIN_WINDOW_LABEL: &str = "main";
const DEFAULT_ONBOARDING_WINDOW_WIDTH: f64 = 560.0;
const DEFAULT_ONBOARDING_WINDOW_HEIGHT: f64 = 560.0;
const V2_ONBOARDING_WINDOW_WIDTH: f64 = 1024.0;
const V2_ONBOARDING_WINDOW_HEIGHT: f64 = 680.0;

#[derive(Default)]
pub struct PrimaryWindowModeState {
    snapshot: Mutex<PrimaryWindowModeSnapshot>,
}

#[derive(Default)]
struct PrimaryWindowModeSnapshot {
    current_mode: Option<PrimaryWindowModeParams>,
    restore_bounds: Option<PrimaryWindowRestoreBounds>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PrimaryWindowModeParams {
    pub mode: PrimaryWindowModeKind,
    pub onboarding_variant: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryWindowModeKind {
    App,
    Onboarding,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PrimaryWindowRestoreBounds {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    was_maximized: bool,
    was_fullscreen: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct WindowDimensions {
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct WindowMinimumSize {
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PrimaryWindowModeTransition {
    NoOp,
    ShowOnboardingIfHidden,
    ApplyOnboardingSize,
    RestoreAppWindow,
}

#[tauri::command(rename = "electron-set-window-mode")]
pub fn electron_set_window_mode(
    app: AppHandle,
    window: Window,
    primary_window_mode_state: State<'_, PrimaryWindowModeState>,
    params: PrimaryWindowModeParams,
) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Ok(());
    }

    let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    apply_primary_window_mode(&app, &main_window, &primary_window_mode_state, params)
}

fn apply_primary_window_mode(
    app: &AppHandle,
    window: &WebviewWindow,
    primary_window_mode_state: &PrimaryWindowModeState,
    params: PrimaryWindowModeParams,
) -> Result<(), String> {
    let target_window_dimensions = onboarding_window_dimensions(&params);
    let mut restore_bounds = None;
    let transition = {
        let mut snapshot = primary_window_mode_state
            .snapshot
            .lock()
            .map_err(|_| "primary window mode mutex poisoned".to_string())?;
        let transition = determine_transition(
            snapshot.current_mode.as_ref(),
            target_window_dimensions.is_some(),
            &params,
        );

        match transition {
            PrimaryWindowModeTransition::NoOp
            | PrimaryWindowModeTransition::ShowOnboardingIfHidden => transition,
            PrimaryWindowModeTransition::ApplyOnboardingSize => {
                snapshot.current_mode = Some(params);
                if snapshot.restore_bounds.is_none() {
                    snapshot.restore_bounds = Some(capture_restore_bounds(window)?);
                }
                transition
            }
            PrimaryWindowModeTransition::RestoreAppWindow => {
                snapshot.current_mode = Some(params);
                restore_bounds = snapshot.restore_bounds.take();
                transition
            }
        }
    };

    match transition {
        PrimaryWindowModeTransition::NoOp => Ok(()),
        PrimaryWindowModeTransition::ShowOnboardingIfHidden => {
            show_primary_window_if_hidden(window)
        }
        PrimaryWindowModeTransition::ApplyOnboardingSize => {
            let target_window_dimensions = target_window_dimensions
                .ok_or_else(|| "missing onboarding window dimensions".to_string())?;
            apply_onboarding_window_mode(window, target_window_dimensions)
        }
        PrimaryWindowModeTransition::RestoreAppWindow => {
            restore_app_window_mode(app, window, restore_bounds)
        }
    }
}

fn determine_transition(
    current_mode: Option<&PrimaryWindowModeParams>,
    has_target_window_dimensions: bool,
    params: &PrimaryWindowModeParams,
) -> PrimaryWindowModeTransition {
    if current_mode == Some(params) {
        if has_target_window_dimensions {
            return PrimaryWindowModeTransition::ShowOnboardingIfHidden;
        }

        return PrimaryWindowModeTransition::NoOp;
    }

    if has_target_window_dimensions {
        PrimaryWindowModeTransition::ApplyOnboardingSize
    } else {
        PrimaryWindowModeTransition::RestoreAppWindow
    }
}

fn onboarding_window_dimensions(params: &PrimaryWindowModeParams) -> Option<WindowDimensions> {
    match params.mode {
        PrimaryWindowModeKind::App => None,
        PrimaryWindowModeKind::Onboarding => {
            if params.onboarding_variant.as_deref() == Some("v2") {
                return Some(WindowDimensions {
                    width: V2_ONBOARDING_WINDOW_WIDTH,
                    height: V2_ONBOARDING_WINDOW_HEIGHT,
                });
            }

            Some(WindowDimensions {
                width: DEFAULT_ONBOARDING_WINDOW_WIDTH,
                height: DEFAULT_ONBOARDING_WINDOW_HEIGHT,
            })
        }
    }
}

fn capture_restore_bounds(window: &WebviewWindow) -> Result<PrimaryWindowRestoreBounds, String> {
    Ok(PrimaryWindowRestoreBounds {
        position: window
            .outer_position()
            .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} window position: {err}"))?,
        size: window
            .outer_size()
            .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} window size: {err}"))?,
        was_maximized: window
            .is_maximized()
            .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} maximized state: {err}"))?,
        was_fullscreen: window
            .is_fullscreen()
            .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} fullscreen state: {err}"))?,
    })
}

fn apply_onboarding_window_mode(
    window: &WebviewWindow,
    target_window_dimensions: WindowDimensions,
) -> Result<(), String> {
    if window
        .is_fullscreen()
        .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} fullscreen state: {err}"))?
    {
        window
            .set_fullscreen(false)
            .map_err(|err| format!("failed to exit fullscreen on {MAIN_WINDOW_LABEL}: {err}"))?;
    }

    if window
        .is_maximized()
        .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} maximized state: {err}"))?
    {
        window
            .unmaximize()
            .map_err(|err| format!("failed to unmaximize {MAIN_WINDOW_LABEL}: {err}"))?;
    }

    window
        .set_resizable(false)
        .map_err(|err| format!("failed to disable resizing on {MAIN_WINDOW_LABEL}: {err}"))?;
    window
        .set_maximizable(false)
        .map_err(|err| format!("failed to disable maximizing on {MAIN_WINDOW_LABEL}: {err}"))?;
    window
        .set_min_size(Some(Size::Logical(LogicalSize::new(
            target_window_dimensions.width,
            target_window_dimensions.height,
        ))))
        .map_err(|err| format!("failed to set {MAIN_WINDOW_LABEL} minimum size: {err}"))?;
    window
        .set_size(Size::Logical(LogicalSize::new(
            target_window_dimensions.width,
            target_window_dimensions.height,
        )))
        .map_err(|err| format!("failed to resize {MAIN_WINDOW_LABEL}: {err}"))?;
    window
        .center()
        .map_err(|err| format!("failed to center {MAIN_WINDOW_LABEL}: {err}"))?;

    show_primary_window_if_hidden(window)
}

fn restore_app_window_mode(
    app: &AppHandle,
    window: &WebviewWindow,
    restore_bounds: Option<PrimaryWindowRestoreBounds>,
) -> Result<(), String> {
    window
        .set_resizable(true)
        .map_err(|err| format!("failed to enable resizing on {MAIN_WINDOW_LABEL}: {err}"))?;
    window
        .set_maximizable(true)
        .map_err(|err| format!("failed to enable maximizing on {MAIN_WINDOW_LABEL}: {err}"))?;

    let default_minimum_size = primary_window_default_minimum_size(app);
    apply_primary_window_minimum_size(window, default_minimum_size)?;

    if let Some(restore_bounds) = restore_bounds {
        let constrained_restore_size =
            constrain_restore_size(window, restore_bounds.size, default_minimum_size)?;
        window
            .set_position(Position::Physical(restore_bounds.position))
            .map_err(|err| format!("failed to restore {MAIN_WINDOW_LABEL} position: {err}"))?;
        window
            .set_size(Size::Physical(constrained_restore_size))
            .map_err(|err| format!("failed to restore {MAIN_WINDOW_LABEL} size: {err}"))?;
        if restore_bounds.was_maximized {
            window
                .maximize()
                .map_err(|err| format!("failed to maximize {MAIN_WINDOW_LABEL}: {err}"))?;
        }
        if restore_bounds.was_fullscreen {
            window.set_fullscreen(true).map_err(|err| {
                format!("failed to restore fullscreen on {MAIN_WINDOW_LABEL}: {err}")
            })?;
        }
    }

    show_primary_window_if_hidden(window)
}

fn primary_window_default_minimum_size(app: &AppHandle) -> Option<WindowMinimumSize> {
    let config = app.config().app.windows.first()?;
    let min_width = config.min_width?;
    let min_height = config.min_height?;

    Some(WindowMinimumSize {
        width: min_width,
        height: min_height,
    })
}

fn apply_primary_window_minimum_size(
    window: &WebviewWindow,
    default_minimum_size: Option<WindowMinimumSize>,
) -> Result<(), String> {
    let minimum_size = default_minimum_size.map(|default_minimum_size| {
        Size::Logical(LogicalSize::new(
            default_minimum_size.width,
            default_minimum_size.height,
        ))
    });

    window
        .set_min_size(minimum_size)
        .map_err(|err| format!("failed to restore {MAIN_WINDOW_LABEL} minimum size: {err}"))
}

fn constrain_restore_size(
    window: &WebviewWindow,
    restore_size: PhysicalSize<u32>,
    default_minimum_size: Option<WindowMinimumSize>,
) -> Result<PhysicalSize<u32>, String> {
    let Some(default_minimum_size) = default_minimum_size else {
        return Ok(restore_size);
    };

    let scale_factor = window
        .scale_factor()
        .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} scale factor: {err}"))?;
    let minimum_width = (default_minimum_size.width * scale_factor).ceil() as u32;
    let minimum_height = (default_minimum_size.height * scale_factor).ceil() as u32;

    Ok(PhysicalSize::new(
        restore_size.width.max(minimum_width),
        restore_size.height.max(minimum_height),
    ))
}

fn show_primary_window_if_hidden(window: &WebviewWindow) -> Result<(), String> {
    let is_visible = window
        .is_visible()
        .map_err(|err| format!("failed to read {MAIN_WINDOW_LABEL} visibility: {err}"))?;
    if is_visible {
        return Ok(());
    }

    window
        .show()
        .map_err(|err| format!("failed to show {MAIN_WINDOW_LABEL}: {err}"))?;
    window
        .set_focus()
        .map_err(|err| format!("failed to focus {MAIN_WINDOW_LABEL}: {err}"))
}

#[cfg(test)]
mod tests {
    use super::determine_transition;
    use super::onboarding_window_dimensions;
    use super::PrimaryWindowModeKind;
    use super::PrimaryWindowModeParams;
    use super::PrimaryWindowModeTransition;

    #[test]
    fn deserializes_onboarding_window_mode_payload() {
        let payload: PrimaryWindowModeParams = serde_json::from_value(serde_json::json!({
            "mode": "onboarding",
            "onboardingVariant": "v2"
        }))
        .expect("electron-set-window-mode payload should deserialize");

        assert_eq!(
            payload,
            PrimaryWindowModeParams {
                mode: PrimaryWindowModeKind::Onboarding,
                onboarding_variant: Some("v2".to_string()),
            }
        );
    }

    #[test]
    fn uses_v2_onboarding_window_dimensions_when_requested() {
        let params = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::Onboarding,
            onboarding_variant: Some("v2".to_string()),
        };

        assert_eq!(
            onboarding_window_dimensions(&params),
            Some(super::WindowDimensions {
                width: 1024.0,
                height: 680.0,
            })
        );
    }

    #[test]
    fn uses_default_onboarding_window_dimensions_without_variant() {
        let params = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::Onboarding,
            onboarding_variant: None,
        };

        assert_eq!(
            onboarding_window_dimensions(&params),
            Some(super::WindowDimensions {
                width: 560.0,
                height: 560.0,
            })
        );
    }

    #[test]
    fn reapplies_visibility_only_for_identical_onboarding_mode() {
        let params = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::Onboarding,
            onboarding_variant: Some("v2".to_string()),
        };

        assert_eq!(
            determine_transition(Some(&params), true, &params),
            PrimaryWindowModeTransition::ShowOnboardingIfHidden
        );
    }

    #[test]
    fn restores_app_window_when_leaving_onboarding() {
        let current = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::Onboarding,
            onboarding_variant: Some("v2".to_string()),
        };
        let next = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::App,
            onboarding_variant: None,
        };

        assert_eq!(
            determine_transition(Some(&current), false, &next),
            PrimaryWindowModeTransition::RestoreAppWindow
        );
    }

    #[test]
    fn applies_onboarding_size_when_entering_onboarding() {
        let current = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::App,
            onboarding_variant: None,
        };
        let next = PrimaryWindowModeParams {
            mode: PrimaryWindowModeKind::Onboarding,
            onboarding_variant: Some("v2".to_string()),
        };

        assert_eq!(
            determine_transition(Some(&current), true, &next),
            PrimaryWindowModeTransition::ApplyOnboardingSize
        );
    }
}
