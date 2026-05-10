use crate::global_settings::read_global_settings;
use crate::global_settings::write_global_settings;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Size, State,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent,
};

const AVATAR_OVERLAY_WINDOW_LABEL: &str = "avatar-overlay";
const AVATAR_OVERLAY_ROUTE_PATH: &str = "/avatar-overlay";
const AVATAR_OVERLAY_OPEN_KEY: &str = "electron-avatar-overlay-open";
const AVATAR_OVERLAY_BOUNDS_KEY: &str = "electron-avatar-overlay-bounds";
const AVATAR_OVERLAY_LAYOUT_CHANGED_EVENT: &str = "avatar-overlay-layout-changed";
const AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT: &str = "avatar-overlay-open-state-changed";
const AVATAR_OVERLAY_KEYBOARD_INTERACTION_READY_EVENT: &str =
    "avatar-overlay-keyboard-interaction-ready";

const DEFAULT_VIEWPORT_WIDTH: f64 = 356.0;
const DEFAULT_VIEWPORT_HEIGHT: f64 = 320.0;
const DEFAULT_MASCOT_WIDTH: f64 = 112.0;
const DEFAULT_MASCOT_HEIGHT: f64 = 121.0;
const DEFAULT_TRAY_WIDTH: f64 = 276.0;
const DEFAULT_TRAY_HEIGHT: f64 = 131.0;
const VIEWPORT_PADDING_TOP: f64 = 8.0;
const VIEWPORT_PADDING_RIGHT: f64 = 28.0;
const VIEWPORT_PADDING_BOTTOM: f64 = 8.0;
const VIEWPORT_PADDING_LEFT: f64 = 0.0;
const TRAY_GAP: f64 = 4.0;
const PREVIOUS_PLACEMENT_BIAS: i32 = 96;
const DISPLAY_SWITCH_PADDING: f64 = 24.0;
const MOMENTUM_TICK_MS: u64 = 16;
const MOMENTUM_FRICTION: f64 = 0.88;
const MOMENTUM_STOP_SPEED: f64 = 65.0;
const MOMENTUM_MAX_DURATION_MS: u64 = 900;

#[derive(Default)]
pub struct AvatarOverlayState {
    snapshot: Mutex<AvatarOverlaySnapshot>,
}

struct AvatarOverlaySnapshot {
    anchor: Rect,
    drag_state: Option<AvatarOverlayDragState>,
    has_renderer_measurement: bool,
    layout: Option<AvatarOverlayComputedLayout>,
    mascot_size: OverlaySize,
    momentum_generation: u64,
    mouse_passthrough_enabled: bool,
    placement: AvatarOverlayPlacement,
    pointer_interactive: bool,
    requested_open: bool,
    tray_size: Option<OverlaySize>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarOverlayDragStartParams {
    pub pointer_window_x: f64,
    pub pointer_window_y: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarOverlayDragReleaseParams {
    pub velocity_x: f64,
    pub velocity_y: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarOverlayElementSizeChangedParams {
    pub is_tray_visible: bool,
    pub mascot: AvatarOverlayMeasuredElementSize,
    pub tray: Option<AvatarOverlayMeasuredElementSize>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarOverlayMeasuredElementSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarOverlayInteractionChangedParams {
    pub is_interactive: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayOpenStateChangedNotification {
    is_open: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayLayoutChangedNotification {
    layout: AvatarOverlayLayoutNotification,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayLayoutNotification {
    mascot: AvatarOverlayLayoutRect,
    placement: AvatarOverlayPlacement,
    tray: Option<AvatarOverlayLayoutRect>,
    viewport: AvatarOverlayViewportSize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum AvatarOverlayPlacement {
    TopStart,
    TopEnd,
    BottomStart,
    BottomEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayStoredBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    anchor: Option<AvatarOverlayStoredAnchorRect>,
    mascot: Option<AvatarOverlayLayoutRect>,
    placement: Option<AvatarOverlayPlacement>,
    tray: Option<AvatarOverlayLayoutRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayStoredAnchorRect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayLayoutRect {
    left: i32,
    top: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AvatarOverlayViewportSize {
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct AvatarOverlayDragState {
    pointer_anchor_x: f64,
    pointer_anchor_y: f64,
    has_moved: bool,
    display_bounds: Rect,
}

#[derive(Debug, Clone, PartialEq)]
struct AvatarOverlayComputedLayout {
    anchor: Rect,
    mascot: AvatarOverlayLayoutRect,
    placement: AvatarOverlayPlacement,
    tray: Option<AvatarOverlayLayoutRect>,
    viewport: AvatarOverlayViewportSize,
    window_bounds: Rect,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct OverlaySize {
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

pub(crate) trait AvatarOverlayOwnerWindow {
    fn label(&self) -> &str;
    fn avatar_overlay_app_handle(&self) -> &AppHandle;
    fn current_monitor(&self) -> tauri::Result<Option<Monitor>>;
    fn outer_position(&self) -> tauri::Result<PhysicalPosition<i32>>;
    fn outer_size(&self) -> tauri::Result<PhysicalSize<u32>>;
}

impl AvatarOverlayOwnerWindow for Window {
    fn label(&self) -> &str {
        self.label()
    }

    fn avatar_overlay_app_handle(&self) -> &AppHandle {
        Manager::app_handle(self)
    }

    fn current_monitor(&self) -> tauri::Result<Option<Monitor>> {
        self.current_monitor()
    }

    fn outer_position(&self) -> tauri::Result<PhysicalPosition<i32>> {
        self.outer_position()
    }

    fn outer_size(&self) -> tauri::Result<PhysicalSize<u32>> {
        self.outer_size()
    }
}

impl AvatarOverlayOwnerWindow for WebviewWindow {
    fn label(&self) -> &str {
        self.label()
    }

    fn avatar_overlay_app_handle(&self) -> &AppHandle {
        Manager::app_handle(self)
    }

    fn current_monitor(&self) -> tauri::Result<Option<Monitor>> {
        self.current_monitor()
    }

    fn outer_position(&self) -> tauri::Result<PhysicalPosition<i32>> {
        self.outer_position()
    }

    fn outer_size(&self) -> tauri::Result<PhysicalSize<u32>> {
        self.outer_size()
    }
}

impl Default for AvatarOverlaySnapshot {
    fn default() -> Self {
        let viewport = Rect {
            x: 0.0,
            y: 0.0,
            width: DEFAULT_VIEWPORT_WIDTH,
            height: DEFAULT_VIEWPORT_HEIGHT,
        };
        let mascot_size = default_mascot_size();
        Self {
            anchor: default_anchor(viewport, mascot_size),
            drag_state: None,
            has_renderer_measurement: false,
            layout: None,
            mascot_size,
            momentum_generation: 0,
            mouse_passthrough_enabled: false,
            placement: AvatarOverlayPlacement::TopEnd,
            pointer_interactive: false,
            requested_open: false,
            tray_size: None,
        }
    }
}

#[tauri::command(rename = "avatar-overlay-open")]
pub fn avatar_overlay_open(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
) -> Result<(), String> {
    let overlay_window = app.get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL);
    if let Some(overlay_window) = overlay_window {
        if is_window_visible(&overlay_window)? {
            persist_requested_open(&app, false)?;
            {
                let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
                snapshot.requested_open = false;
                snapshot.pointer_interactive = false;
            }
            overlay_window
                .close()
                .map_err(|err| format!("failed to close {AVATAR_OVERLAY_WINDOW_LABEL}: {err}"))?;
            return Ok(());
        }
    }

    open_avatar_overlay(&app, Some(&window), &avatar_overlay_state)
}

#[tauri::command(rename = "avatar-overlay-open-state-request")]
pub fn avatar_overlay_open_state_request(app: AppHandle, window: Window) -> Result<(), String> {
    window
        .emit(
            AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT,
            AvatarOverlayOpenStateChangedNotification {
                is_open: overlay_is_open(&app)?,
            },
        )
        .map_err(|err| {
            format!(
                "failed to emit {AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT} for {}: {err}",
                window.label()
            )
        })
}

#[tauri::command(rename = "avatar-overlay-drag-start")]
pub fn avatar_overlay_drag_start(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
    params: AvatarOverlayDragStartParams,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }

    let overlay_window = require_overlay_window(&app)?;
    cancel_momentum(&avatar_overlay_state)?;

    let layout = {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        if snapshot.layout.is_none() {
            let display_bounds =
                display_bounds_for_point(&overlay_window, rect_center(snapshot.anchor))?;
            apply_layout(&mut snapshot, display_bounds);
        }
        snapshot
            .layout
            .clone()
            .ok_or_else(|| "missing avatar overlay layout".to_string())?
    };
    let cursor = overlay_window
        .cursor_position()
        .map_err(|err| format!("failed to read cursor position: {err}"))?;
    let display_bounds = display_bounds_for_point(&overlay_window, cursor)?;

    let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
    snapshot.drag_state = Some(AvatarOverlayDragState {
        pointer_anchor_x: params.pointer_window_x - f64::from(layout.mascot.left),
        pointer_anchor_y: params.pointer_window_y - f64::from(layout.mascot.top),
        has_moved: false,
        display_bounds,
    });
    Ok(())
}

#[tauri::command(rename = "avatar-overlay-drag-move")]
pub fn avatar_overlay_drag_move(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }

    let overlay_window = require_overlay_window(&app)?;
    let has_drag_state = {
        let snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot.drag_state.is_some()
    };
    if !has_drag_state {
        return Ok(());
    }

    cancel_momentum(&avatar_overlay_state)?;
    {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        if let Some(drag_state) = snapshot.drag_state.as_mut() {
            drag_state.has_moved = true;
        }
    }
    move_drag_to_current_cursor(&overlay_window, &avatar_overlay_state)
}

#[tauri::command(rename = "avatar-overlay-drag-end")]
pub fn avatar_overlay_drag_end(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }

    let overlay_window = require_overlay_window(&app)?;
    let had_moved = {
        let snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot
            .drag_state
            .map(|drag_state| drag_state.has_moved)
            .unwrap_or(false)
    };
    if had_moved {
        move_drag_to_current_cursor(&overlay_window, &avatar_overlay_state)?;
    }
    {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot.drag_state = None;
    }
    reclamp_window_to_visible_display(&overlay_window, &avatar_overlay_state, true)
}

#[tauri::command(rename = "avatar-overlay-drag-release")]
pub fn avatar_overlay_drag_release(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
    params: AvatarOverlayDragReleaseParams,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }
    if !params.velocity_x.is_finite() || !params.velocity_y.is_finite() {
        return Ok(());
    }
    if params.velocity_x == 0.0 && params.velocity_y == 0.0 {
        return Ok(());
    }

    let overlay_window = require_overlay_window(&app)?;
    let overlay_label = overlay_window.label().to_string();
    let target_generation = {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot.momentum_generation += 1;
        snapshot.drag_state = None;
        snapshot.momentum_generation
    };
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut velocity_x = params.velocity_x;
        let mut velocity_y = params.velocity_y;
        let mut elapsed_ms = 0_u64;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(MOMENTUM_TICK_MS)).await;
            let Some(window) = app_handle.get_webview_window(&overlay_label) else {
                return;
            };
            let current_generation = match app_handle.try_state::<AvatarOverlayState>() {
                Some(state) => match lock_snapshot(&state) {
                    Ok(snapshot) => snapshot.momentum_generation,
                    Err(_) => return,
                },
                None => return,
            };
            if current_generation != target_generation {
                return;
            }
            elapsed_ms += MOMENTUM_TICK_MS;
            let candidate_anchor = match app_handle.try_state::<AvatarOverlayState>() {
                Some(state) => match lock_snapshot(&state) {
                    Ok(snapshot) => Rect {
                        x: snapshot.anchor.x + velocity_x * MOMENTUM_TICK_MS as f64 / 1000.0,
                        y: snapshot.anchor.y + velocity_y * MOMENTUM_TICK_MS as f64 / 1000.0,
                        width: snapshot.anchor.width,
                        height: snapshot.anchor.height,
                    },
                    Err(_) => return,
                },
                None => return,
            };
            let display_bounds =
                match display_bounds_for_point(&window, rect_center(candidate_anchor)) {
                    Ok(bounds) => bounds,
                    Err(_) => return,
                };
            let actual_anchor = match app_handle.try_state::<AvatarOverlayState>() {
                Some(state) => {
                    let mut snapshot = match lock_snapshot(&state) {
                        Ok(snapshot) => snapshot,
                        Err(_) => return,
                    };
                    snapshot.anchor = candidate_anchor;
                    apply_layout(&mut snapshot, display_bounds);
                    if apply_window_bounds(&window, snapshot.layout.as_ref()).is_err() {
                        return;
                    }
                    let _ = emit_layout_changed(&window, snapshot.layout.as_ref());
                    snapshot.anchor
                }
                None => return,
            };
            if actual_anchor.x != candidate_anchor.x.round() {
                velocity_x = 0.0;
            }
            if actual_anchor.y != candidate_anchor.y.round() {
                velocity_y = 0.0;
            }
            velocity_x *= MOMENTUM_FRICTION;
            velocity_y *= MOMENTUM_FRICTION;
            if elapsed_ms >= MOMENTUM_MAX_DURATION_MS
                || velocity_x.hypot(velocity_y) < MOMENTUM_STOP_SPEED
            {
                if let Some(state) = app_handle.try_state::<AvatarOverlayState>() {
                    let _ = persist_window_bounds(&app_handle, &state);
                }
                return;
            }
        }
    });
    Ok(())
}

#[tauri::command(rename = "avatar-overlay-element-size-changed")]
pub fn avatar_overlay_element_size_changed(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
    params: AvatarOverlayElementSizeChangedParams,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }

    let overlay_window = require_overlay_window(&app)?;
    cancel_momentum(&avatar_overlay_state)?;
    {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot.anchor.width = params.mascot.width;
        snapshot.anchor.height = params.mascot.height;
        snapshot.has_renderer_measurement = true;
        snapshot.mascot_size = OverlaySize {
            width: params.mascot.width,
            height: params.mascot.height,
        };
        snapshot.tray_size = params.tray.map(|tray| OverlaySize {
            width: tray.width,
            height: tray.height,
        });
        let display_bounds =
            display_bounds_for_point(&overlay_window, rect_center(snapshot.anchor))?;
        apply_layout(&mut snapshot, display_bounds);
        apply_window_bounds(&overlay_window, snapshot.layout.as_ref())?;
        emit_layout_changed(&overlay_window, snapshot.layout.as_ref())?;
    }
    maybe_show_window(&overlay_window, &avatar_overlay_state)
}

#[tauri::command(rename = "avatar-overlay-pointer-interaction-changed")]
pub fn avatar_overlay_pointer_interaction_changed(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
    params: AvatarOverlayInteractionChangedParams,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }
    let overlay_window = require_overlay_window(&app)?;
    {
        let mut snapshot = lock_snapshot(&avatar_overlay_state)?;
        snapshot.pointer_interactive = params.is_interactive;
    }
    apply_pointer_interactivity_policy(&overlay_window, &avatar_overlay_state)
}

#[tauri::command(rename = "avatar-overlay-keyboard-interaction-changed")]
pub fn avatar_overlay_keyboard_interaction_changed(
    app: AppHandle,
    window: Window,
    avatar_overlay_state: State<'_, AvatarOverlayState>,
    params: AvatarOverlayInteractionChangedParams,
) -> Result<(), String> {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return Ok(());
    }
    let overlay_window = require_overlay_window(&app)?;
    apply_pointer_interactivity_policy(&overlay_window, &avatar_overlay_state)?;
    if !params.is_interactive {
        overlay_window
            .set_focusable(false)
            .map_err(|err| format!("failed to disable overlay focus: {err}"))?;
        return Ok(());
    }

    overlay_window
        .set_focusable(true)
        .map_err(|err| format!("failed to enable overlay focus: {err}"))?;
    maybe_show_window(&overlay_window, &avatar_overlay_state)?;
    overlay_window
        .set_focus()
        .map_err(|err| format!("failed to focus overlay window: {err}"))?;
    overlay_window
        .emit(AVATAR_OVERLAY_KEYBOARD_INTERACTION_READY_EVENT, ())
        .map_err(|err| {
            format!("failed to emit {AVATAR_OVERLAY_KEYBOARD_INTERACTION_READY_EVENT}: {err}")
        })
}

pub(crate) fn restore_open_state<W: AvatarOverlayOwnerWindow>(
    app: &AppHandle,
    owner_window: Option<&W>,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    if !stored_open_requested(app)? {
        return Ok(());
    }
    open_avatar_overlay(app, owner_window, avatar_overlay_state)
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != AVATAR_OVERLAY_WINDOW_LABEL {
        return;
    }
    if let WindowEvent::Destroyed = event {
        let app = AvatarOverlayOwnerWindow::avatar_overlay_app_handle(window);
        let state = app.state::<AvatarOverlayState>();
        let _ = persist_requested_open(&app, false);
        let _ = broadcast_open_state(&app);
        if let Ok(mut snapshot) = lock_snapshot(&state) {
            snapshot.anchor = default_anchor(
                Rect {
                    x: 0.0,
                    y: 0.0,
                    width: DEFAULT_VIEWPORT_WIDTH,
                    height: DEFAULT_VIEWPORT_HEIGHT,
                },
                default_mascot_size(),
            );
            snapshot.drag_state = None;
            snapshot.has_renderer_measurement = false;
            snapshot.layout = None;
            snapshot.mascot_size = default_mascot_size();
            snapshot.momentum_generation += 1;
            snapshot.mouse_passthrough_enabled = false;
            snapshot.placement = AvatarOverlayPlacement::TopEnd;
            snapshot.pointer_interactive = false;
            snapshot.requested_open = false;
            snapshot.tray_size = None;
        };
    }
}

fn open_avatar_overlay<W: AvatarOverlayOwnerWindow>(
    app: &AppHandle,
    owner_window: Option<&W>,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    persist_requested_open(app, true)?;
    let overlay_window = ensure_overlay_window(app)?;
    {
        let mut snapshot = lock_snapshot(avatar_overlay_state)?;
        snapshot.requested_open = true;
        position_window(app, owner_window, &overlay_window, &mut snapshot)?;
        if snapshot.has_renderer_measurement {
            let display_bounds =
                display_bounds_for_point(&overlay_window, rect_center(snapshot.anchor))?;
            apply_layout(&mut snapshot, display_bounds);
            apply_window_bounds(&overlay_window, snapshot.layout.as_ref())?;
            emit_layout_changed(&overlay_window, snapshot.layout.as_ref())?;
        }
    }
    maybe_show_window(&overlay_window, avatar_overlay_state)?;
    apply_pointer_interactivity_policy(&overlay_window, avatar_overlay_state)
}

fn ensure_overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        AVATAR_OVERLAY_WINDOW_LABEL,
        WebviewUrl::App(AVATAR_OVERLAY_ROUTE_PATH.into()),
    )
    .title(app.package_info().name.clone())
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focusable(false)
    .shadow(false)
    .resizable(false)
    .visible(false)
    .inner_size(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT)
    .build()
    .map_err(|err| format!("failed to create {AVATAR_OVERLAY_WINDOW_LABEL}: {err}"))?;

    window
        .set_visible_on_all_workspaces(true)
        .map_err(|err| format!("failed to enable all-workspaces visibility: {err}"))?;
    window
        .set_always_on_top(true)
        .map_err(|err| format!("failed to keep overlay on top: {err}"))?;
    window
        .set_skip_taskbar(true)
        .map_err(|err| format!("failed to hide overlay from the taskbar: {err}"))?;
    Ok(window)
}

fn position_window<W: AvatarOverlayOwnerWindow>(
    app: &AppHandle,
    owner_window: Option<&W>,
    overlay_window: &WebviewWindow,
    snapshot: &mut AvatarOverlaySnapshot,
) -> Result<(), String> {
    if let Some(stored_bounds) = read_stored_bounds(app)? {
        let derived_anchor = if let Some(anchor) = stored_bounds.anchor {
            Rect {
                x: f64::from(anchor.x),
                y: f64::from(anchor.y),
                width: f64::from(anchor.width),
                height: f64::from(anchor.height),
            }
        } else if let Some(mascot) = stored_bounds.mascot {
            Rect {
                x: f64::from(stored_bounds.x + mascot.left),
                y: f64::from(stored_bounds.y + mascot.top),
                width: f64::from(mascot.width),
                height: f64::from(mascot.height),
            }
        } else {
            Rect {
                x: f64::from(stored_bounds.x),
                y: f64::from(stored_bounds.y),
                width: f64::from(stored_bounds.width),
                height: f64::from(stored_bounds.height),
            }
        };
        snapshot.anchor = derived_anchor;
        snapshot.mascot_size = OverlaySize {
            width: derived_anchor.width,
            height: derived_anchor.height,
        };
        snapshot.placement = stored_bounds
            .placement
            .unwrap_or(AvatarOverlayPlacement::TopEnd);
        if snapshot.has_renderer_measurement {
            apply_layout(
                snapshot,
                display_bounds_for_point(overlay_window, rect_center(snapshot.anchor))?,
            );
        }
        return Ok(());
    }

    let display_bounds = match owner_window {
        Some(owner_window) if owner_window.label() != AVATAR_OVERLAY_WINDOW_LABEL => {
            display_bounds_for_window(owner_window)?
        }
        _ => display_bounds_for_cursor(app)?,
    };
    snapshot.anchor = default_anchor(display_bounds, snapshot.mascot_size);
    if snapshot.has_renderer_measurement {
        apply_layout(snapshot, display_bounds);
    }
    Ok(())
}

fn maybe_show_window(
    window: &WebviewWindow,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    let should_show = {
        let snapshot = lock_snapshot(avatar_overlay_state)?;
        snapshot.requested_open && snapshot.has_renderer_measurement
    };
    if !should_show {
        return Ok(());
    }

    let was_open = is_window_visible(window)?;
    window
        .show()
        .map_err(|err| format!("failed to show {AVATAR_OVERLAY_WINDOW_LABEL}: {err}"))?;
    if !was_open && is_window_visible(window)? {
        broadcast_open_state(AvatarOverlayOwnerWindow::avatar_overlay_app_handle(window))?;
    }
    Ok(())
}

fn apply_pointer_interactivity_policy(
    window: &WebviewWindow,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    let ignore_cursor_events = {
        let snapshot = lock_snapshot(avatar_overlay_state)?;
        !snapshot.pointer_interactive
    };
    let should_update = {
        let snapshot = lock_snapshot(avatar_overlay_state)?;
        snapshot.mouse_passthrough_enabled != ignore_cursor_events
    };
    if !should_update {
        return Ok(());
    }

    window
        .set_ignore_cursor_events(ignore_cursor_events)
        .map_err(|err| {
            format!("failed to update {AVATAR_OVERLAY_WINDOW_LABEL} pointer policy: {err}")
        })?;
    let mut snapshot = lock_snapshot(avatar_overlay_state)?;
    snapshot.mouse_passthrough_enabled = ignore_cursor_events;
    Ok(())
}

fn move_drag_to_current_cursor(
    window: &WebviewWindow,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    let cursor = window
        .cursor_position()
        .map_err(|err| format!("failed to read cursor position: {err}"))?;
    let mut snapshot = lock_snapshot(avatar_overlay_state)?;
    let Some(drag_state) = snapshot.drag_state else {
        return Ok(());
    };
    let cursor_display_bounds = display_bounds_for_point(window, cursor)?;
    let display_bounds = if same_rect(cursor_display_bounds, drag_state.display_bounds)
        || point_within_rect(
            cursor.x,
            cursor.y,
            expand_rect(drag_state.display_bounds, DISPLAY_SWITCH_PADDING),
        ) {
        drag_state.display_bounds
    } else {
        cursor_display_bounds
    };
    if let Some(active_drag_state) = snapshot.drag_state.as_mut() {
        active_drag_state.display_bounds = display_bounds;
        active_drag_state.has_moved = true;
        snapshot.anchor = Rect {
            x: cursor.x - active_drag_state.pointer_anchor_x,
            y: cursor.y - active_drag_state.pointer_anchor_y,
            width: snapshot.anchor.width,
            height: snapshot.anchor.height,
        };
    }
    apply_layout(&mut snapshot, display_bounds);
    apply_window_bounds(window, snapshot.layout.as_ref())?;
    emit_layout_changed(window, snapshot.layout.as_ref())
}

fn reclamp_window_to_visible_display(
    window: &WebviewWindow,
    avatar_overlay_state: &AvatarOverlayState,
    should_persist: bool,
) -> Result<(), String> {
    let display_bounds = {
        let snapshot = lock_snapshot(avatar_overlay_state)?;
        display_bounds_for_point(window, rect_center(snapshot.anchor))?
    };
    {
        let mut snapshot = lock_snapshot(avatar_overlay_state)?;
        apply_layout(&mut snapshot, display_bounds);
        apply_window_bounds(window, snapshot.layout.as_ref())?;
        emit_layout_changed(window, snapshot.layout.as_ref())?;
    }
    if should_persist {
        persist_window_bounds(
            AvatarOverlayOwnerWindow::avatar_overlay_app_handle(window),
            avatar_overlay_state,
        )?;
    }
    Ok(())
}

fn persist_window_bounds(
    app: &AppHandle,
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<(), String> {
    let snapshot = lock_snapshot(avatar_overlay_state)?;
    let Some(layout) = snapshot.layout.as_ref() else {
        return Ok(());
    };
    let stored_bounds = AvatarOverlayStoredBounds {
        x: layout.window_bounds.x.round() as i32,
        y: layout.window_bounds.y.round() as i32,
        width: layout.window_bounds.width.round() as u32,
        height: layout.window_bounds.height.round() as u32,
        anchor: Some(AvatarOverlayStoredAnchorRect {
            x: snapshot.anchor.x.round() as i32,
            y: snapshot.anchor.y.round() as i32,
            width: snapshot.anchor.width.round() as u32,
            height: snapshot.anchor.height.round() as u32,
        }),
        mascot: Some(layout.mascot.clone()),
        placement: Some(layout.placement.clone()),
        tray: layout.tray.clone(),
    };
    let mut settings = read_global_settings(app)?;
    settings.insert(
        AVATAR_OVERLAY_BOUNDS_KEY.to_string(),
        serde_json::to_value(stored_bounds)
            .map_err(|err| format!("failed to encode avatar overlay bounds: {err}"))?,
    );
    write_global_settings(app, &settings)
}

fn read_stored_bounds(app: &AppHandle) -> Result<Option<AvatarOverlayStoredBounds>, String> {
    let settings = read_global_settings(app)?;
    let Some(value) = settings.get(AVATAR_OVERLAY_BOUNDS_KEY).cloned() else {
        return Ok(None);
    };
    serde_json::from_value(value)
        .map(Some)
        .map_err(|err| format!("failed to parse {AVATAR_OVERLAY_BOUNDS_KEY}: {err}"))
}

fn stored_open_requested(app: &AppHandle) -> Result<bool, String> {
    let settings = read_global_settings(app)?;
    Ok(settings
        .get(AVATAR_OVERLAY_OPEN_KEY)
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

fn persist_requested_open(app: &AppHandle, requested_open: bool) -> Result<(), String> {
    let mut settings = read_global_settings(app)?;
    settings.insert(
        AVATAR_OVERLAY_OPEN_KEY.to_string(),
        Value::Bool(requested_open),
    );
    write_global_settings(app, &settings)
}

fn require_overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL)
        .ok_or_else(|| format!("missing {AVATAR_OVERLAY_WINDOW_LABEL} window"))
}

fn overlay_is_open(app: &AppHandle) -> Result<bool, String> {
    let Some(window) = app.get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL) else {
        return Ok(false);
    };
    is_window_visible(&window)
}

fn is_window_visible(window: &WebviewWindow) -> Result<bool, String> {
    window
        .is_visible()
        .map_err(|err| format!("failed to read {} visibility: {err}", window.label()))
}

fn broadcast_open_state(app: &AppHandle) -> Result<(), String> {
    app.emit(
        AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT,
        AvatarOverlayOpenStateChangedNotification {
            is_open: overlay_is_open(app)?,
        },
    )
    .map_err(|err| format!("failed to emit {AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT}: {err}"))
}

fn emit_layout_changed(
    window: &WebviewWindow,
    layout: Option<&AvatarOverlayComputedLayout>,
) -> Result<(), String> {
    let Some(layout) = layout else {
        return Ok(());
    };
    window
        .emit(
            AVATAR_OVERLAY_LAYOUT_CHANGED_EVENT,
            AvatarOverlayLayoutChangedNotification {
                layout: AvatarOverlayLayoutNotification {
                    mascot: layout.mascot.clone(),
                    placement: layout.placement.clone(),
                    tray: layout.tray.clone(),
                    viewport: layout.viewport.clone(),
                },
            },
        )
        .map_err(|err| format!("failed to emit {AVATAR_OVERLAY_LAYOUT_CHANGED_EVENT}: {err}"))
}

fn apply_window_bounds(
    window: &WebviewWindow,
    layout: Option<&AvatarOverlayComputedLayout>,
) -> Result<(), String> {
    let Some(layout) = layout else {
        return Ok(());
    };
    let position = PhysicalPosition::new(
        layout.window_bounds.x.round() as i32,
        layout.window_bounds.y.round() as i32,
    );
    let size = PhysicalSize::new(
        layout.window_bounds.width.round() as u32,
        layout.window_bounds.height.round() as u32,
    );
    window
        .set_position(Position::Physical(position))
        .map_err(|err| format!("failed to position {AVATAR_OVERLAY_WINDOW_LABEL}: {err}"))?;
    window
        .set_size(Size::Physical(size))
        .map_err(|err| format!("failed to resize {AVATAR_OVERLAY_WINDOW_LABEL}: {err}"))
}

fn apply_layout(snapshot: &mut AvatarOverlaySnapshot, display_bounds: Rect) {
    let viewport = OverlaySize {
        width: DEFAULT_VIEWPORT_WIDTH.min(display_bounds.width),
        height: DEFAULT_VIEWPORT_HEIGHT.min(display_bounds.height),
    };
    let anchor = clamp_anchor_rect(
        Rect {
            x: snapshot.anchor.x,
            y: snapshot.anchor.y,
            width: snapshot.mascot_size.width.min(display_bounds.width),
            height: snapshot.mascot_size.height.min(display_bounds.height),
        },
        display_bounds,
    );
    let tray_size = clamp_tray_size(
        snapshot.tray_size.unwrap_or(default_tray_size()),
        viewport,
        anchor.height,
    );
    let preferred_placement = preferred_placement(anchor, display_bounds);
    let placement = choose_placement(
        anchor,
        display_bounds,
        preferred_placement,
        snapshot.placement.clone(),
        tray_size,
    );
    let tray_bounds = clamp_rect_to_display(
        tray_rect(anchor, tray_size, placement.clone()),
        display_bounds,
    );
    let content_bounds = union_rects([expand_mascot_bounds(anchor), tray_bounds]);
    let window_bounds = window_bounds(content_bounds, display_bounds, viewport);

    snapshot.anchor = anchor;
    snapshot.layout = Some(AvatarOverlayComputedLayout {
        anchor,
        mascot: relative_layout_rect(anchor, window_bounds),
        placement: placement.clone(),
        tray: Some(relative_layout_rect(tray_bounds, window_bounds)),
        viewport: AvatarOverlayViewportSize {
            width: viewport.width.round() as u32,
            height: viewport.height.round() as u32,
        },
        window_bounds,
    });
    snapshot.placement = placement;
}

fn default_anchor(display_bounds: Rect, mascot_size: OverlaySize) -> Rect {
    Rect {
        x: display_bounds.x + display_bounds.width - mascot_size.width,
        y: display_bounds.y + display_bounds.height - mascot_size.height - VIEWPORT_PADDING_BOTTOM,
        width: mascot_size.width,
        height: mascot_size.height,
    }
}

fn default_mascot_size() -> OverlaySize {
    OverlaySize {
        width: DEFAULT_MASCOT_WIDTH,
        height: DEFAULT_MASCOT_HEIGHT,
    }
}

fn default_tray_size() -> OverlaySize {
    OverlaySize {
        width: DEFAULT_TRAY_WIDTH,
        height: DEFAULT_TRAY_HEIGHT,
    }
}

fn clamp_tray_size(
    tray_size: OverlaySize,
    viewport: OverlaySize,
    mascot_height: f64,
) -> OverlaySize {
    OverlaySize {
        width: tray_size
            .width
            .min((viewport.width - VIEWPORT_PADDING_LEFT - VIEWPORT_PADDING_RIGHT).max(0.0)),
        height: tray_size
            .height
            .min((viewport.height - mascot_height - VIEWPORT_PADDING_BOTTOM - TRAY_GAP).max(0.0)),
    }
}

fn preferred_placement(anchor: Rect, display_bounds: Rect) -> AvatarOverlayPlacement {
    match (
        rect_center_y(anchor) < rect_center_y(display_bounds),
        rect_center_x(anchor) < rect_center_x(display_bounds),
    ) {
        (true, true) => AvatarOverlayPlacement::BottomStart,
        (true, false) => AvatarOverlayPlacement::BottomEnd,
        (false, true) => AvatarOverlayPlacement::TopStart,
        (false, false) => AvatarOverlayPlacement::TopEnd,
    }
}

fn choose_placement(
    anchor: Rect,
    display_bounds: Rect,
    preferred_placement: AvatarOverlayPlacement,
    previous_placement: AvatarOverlayPlacement,
    tray_size: OverlaySize,
) -> AvatarOverlayPlacement {
    [
        AvatarOverlayPlacement::TopStart,
        AvatarOverlayPlacement::TopEnd,
        AvatarOverlayPlacement::BottomStart,
        AvatarOverlayPlacement::BottomEnd,
    ]
    .into_iter()
    .map(|placement| {
        let mut score = rect_out_of_bounds_score(
            tray_rect(anchor, tray_size, placement.clone()),
            display_bounds,
        );
        if placement != preferred_placement {
            score += 32;
        }
        if placement == previous_placement {
            score -= PREVIOUS_PLACEMENT_BIAS;
        }
        (placement, score)
    })
    .min_by_key(|(_, score)| *score)
    .map(|(placement, _)| placement)
    .unwrap_or(AvatarOverlayPlacement::TopEnd)
}

fn tray_rect(anchor: Rect, tray_size: OverlaySize, placement: AvatarOverlayPlacement) -> Rect {
    let top = matches!(
        placement,
        AvatarOverlayPlacement::TopStart | AvatarOverlayPlacement::TopEnd
    );
    let end = matches!(
        placement,
        AvatarOverlayPlacement::TopEnd | AvatarOverlayPlacement::BottomEnd
    );
    Rect {
        x: if end {
            anchor.x + anchor.width - tray_size.width
        } else {
            anchor.x
        },
        y: if top {
            anchor.y - tray_size.height - TRAY_GAP
        } else {
            anchor.y + anchor.height + TRAY_GAP
        },
        width: tray_size.width,
        height: tray_size.height,
    }
}

fn expand_mascot_bounds(anchor: Rect) -> Rect {
    Rect {
        x: anchor.x - VIEWPORT_PADDING_LEFT,
        y: anchor.y - VIEWPORT_PADDING_TOP,
        width: anchor.width + VIEWPORT_PADDING_LEFT + VIEWPORT_PADDING_RIGHT,
        height: anchor.height + VIEWPORT_PADDING_TOP + VIEWPORT_PADDING_BOTTOM,
    }
}

fn clamp_anchor_rect(rect: Rect, display_bounds: Rect) -> Rect {
    Rect {
        x: clamp_coordinate(
            rect.x,
            display_bounds.x,
            display_bounds.x + display_bounds.width - rect.width,
        ),
        y: clamp_coordinate(
            rect.y,
            display_bounds.y,
            display_bounds.y + display_bounds.height - rect.height - VIEWPORT_PADDING_BOTTOM,
        ),
        width: rect.width,
        height: rect.height,
    }
}

fn clamp_rect_to_display(rect: Rect, display_bounds: Rect) -> Rect {
    Rect {
        x: clamp_coordinate(
            rect.x,
            display_bounds.x,
            display_bounds.x + display_bounds.width - rect.width,
        ),
        y: clamp_coordinate(
            rect.y,
            display_bounds.y,
            display_bounds.y + display_bounds.height - rect.height,
        ),
        width: rect.width,
        height: rect.height,
    }
}

fn window_bounds(content_bounds: Rect, display_bounds: Rect, viewport: OverlaySize) -> Rect {
    Rect {
        x: clamp_coordinate(
            content_bounds.x + content_bounds.width - viewport.width,
            display_bounds.x,
            display_bounds.x + display_bounds.width - viewport.width,
        ),
        y: clamp_coordinate(
            content_bounds.y + content_bounds.height - viewport.height,
            display_bounds.y,
            display_bounds.y + display_bounds.height - viewport.height,
        ),
        width: viewport.width,
        height: viewport.height,
    }
}

fn rect_out_of_bounds_score(rect: Rect, display_bounds: Rect) -> i32 {
    let left = (display_bounds.x - rect.x).max(0.0);
    let top = (display_bounds.y - rect.y).max(0.0);
    let right = (rect.x + rect.width - display_bounds.x - display_bounds.width).max(0.0);
    let bottom = (rect.y + rect.height - display_bounds.y - display_bounds.height).max(0.0);
    (left + top + right + bottom + (left + right) * rect.height + (top + bottom) * rect.width)
        .round() as i32
}

fn union_rects<const N: usize>(rects: [Rect; N]) -> Rect {
    let min_x = rects
        .iter()
        .map(|rect| rect.x)
        .fold(f64::INFINITY, f64::min);
    let min_y = rects
        .iter()
        .map(|rect| rect.y)
        .fold(f64::INFINITY, f64::min);
    let max_x = rects
        .iter()
        .map(|rect| rect.x + rect.width)
        .fold(f64::NEG_INFINITY, f64::max);
    let max_y = rects
        .iter()
        .map(|rect| rect.y + rect.height)
        .fold(f64::NEG_INFINITY, f64::max);
    Rect {
        x: min_x,
        y: min_y,
        width: max_x - min_x,
        height: max_y - min_y,
    }
}

fn relative_layout_rect(rect: Rect, window_bounds: Rect) -> AvatarOverlayLayoutRect {
    AvatarOverlayLayoutRect {
        left: (rect.x - window_bounds.x).round() as i32,
        top: (rect.y - window_bounds.y).round() as i32,
        width: rect.width.round() as u32,
        height: rect.height.round() as u32,
    }
}

fn clamp_coordinate(value: f64, minimum: f64, maximum: f64) -> f64 {
    if minimum > maximum {
        ((minimum + maximum) / 2.0).round()
    } else {
        value.round().clamp(minimum, maximum)
    }
}

fn rect_center(rect: Rect) -> PhysicalPosition<f64> {
    PhysicalPosition::new(rect.x + rect.width / 2.0, rect.y + rect.height / 2.0)
}

fn rect_center_x(rect: Rect) -> f64 {
    rect.x + rect.width / 2.0
}

fn rect_center_y(rect: Rect) -> f64 {
    rect.y + rect.height / 2.0
}

fn expand_rect(rect: Rect, amount: f64) -> Rect {
    Rect {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2.0,
        height: rect.height + amount * 2.0,
    }
}

fn point_within_rect(x: f64, y: f64, rect: Rect) -> bool {
    x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

fn same_rect(left: Rect, right: Rect) -> bool {
    left == right
}

fn display_bounds_for_cursor(app: &AppHandle) -> Result<Rect, String> {
    let cursor = app
        .cursor_position()
        .map_err(|err| format!("failed to read cursor position: {err}"))?;
    let window = app
        .get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL)
        .or_else(|| app.get_webview_window("main"))
        .ok_or_else(|| "missing reference window for monitor lookup".to_string())?;
    display_bounds_for_point(&window, cursor)
}

fn display_bounds_for_window<W: AvatarOverlayOwnerWindow>(window: &W) -> Result<Rect, String> {
    if let Some(monitor) = window.current_monitor().map_err(|err| {
        format!(
            "failed to read current monitor for {}: {err}",
            window.label()
        )
    })? {
        return Ok(monitor_rect(&monitor));
    }

    let position = window
        .outer_position()
        .map_err(|err| format!("failed to read {} position: {err}", window.label()))?;
    let size = window
        .outer_size()
        .map_err(|err| format!("failed to read {} size: {err}", window.label()))?;
    let center = PhysicalPosition::new(
        position.x + (size.width / 2) as i32,
        position.y + (size.height / 2) as i32,
    );
    let reference_window = AvatarOverlayOwnerWindow::avatar_overlay_app_handle(window)
        .get_webview_window(AVATAR_OVERLAY_WINDOW_LABEL)
        .or_else(|| {
            AvatarOverlayOwnerWindow::avatar_overlay_app_handle(window).get_webview_window("main")
        })
        .ok_or_else(|| "missing reference window for monitor lookup".to_string())?;
    display_bounds_for_point(
        &reference_window,
        PhysicalPosition::new(f64::from(center.x), f64::from(center.y)),
    )
}

fn display_bounds_for_point(
    window: &WebviewWindow,
    point: PhysicalPosition<f64>,
) -> Result<Rect, String> {
    let monitors = window
        .available_monitors()
        .map_err(|err| format!("failed to enumerate monitors: {err}"))?;
    let Some(bounds) = monitors
        .into_iter()
        .map(|monitor| monitor_rect(&monitor))
        .min_by(|left, right| {
            distance_to_rect(point.x, point.y, *left)
                .partial_cmp(&distance_to_rect(point.x, point.y, *right))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    else {
        return Err("no monitors are available".to_string());
    };
    Ok(bounds)
}

fn monitor_rect(monitor: &tauri::Monitor) -> Rect {
    Rect {
        x: f64::from(monitor.position().x),
        y: f64::from(monitor.position().y),
        width: f64::from(monitor.size().width),
        height: f64::from(monitor.size().height),
    }
}

fn distance_to_rect(x: f64, y: f64, rect: Rect) -> f64 {
    let clamped_x = x.clamp(rect.x, rect.x + rect.width);
    let clamped_y = y.clamp(rect.y, rect.y + rect.height);
    (x - clamped_x).hypot(y - clamped_y)
}

fn lock_snapshot(
    avatar_overlay_state: &AvatarOverlayState,
) -> Result<std::sync::MutexGuard<'_, AvatarOverlaySnapshot>, String> {
    avatar_overlay_state
        .snapshot
        .lock()
        .map_err(|_| "avatar overlay state mutex poisoned".to_string())
}

fn cancel_momentum(avatar_overlay_state: &AvatarOverlayState) -> Result<(), String> {
    let mut snapshot = lock_snapshot(avatar_overlay_state)?;
    snapshot.momentum_generation += 1;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::apply_layout;
    use super::default_anchor;
    use super::default_mascot_size;
    use super::AvatarOverlayElementSizeChangedParams;
    use super::AvatarOverlayInteractionChangedParams;
    use super::AvatarOverlayLayoutChangedNotification;
    use super::AvatarOverlayOpenStateChangedNotification;
    use super::AvatarOverlayPlacement;
    use super::AvatarOverlaySnapshot;
    use super::OverlaySize;
    use super::Rect;

    #[test]
    fn layout_matches_extracted_default_geometry() {
        let display_bounds = Rect {
            x: 0.0,
            y: 0.0,
            width: 356.0,
            height: 320.0,
        };
        let mut snapshot = AvatarOverlaySnapshot::default();
        snapshot.anchor = default_anchor(display_bounds, default_mascot_size());
        snapshot.mascot_size = default_mascot_size();
        snapshot.tray_size = Some(OverlaySize {
            width: 276.0,
            height: 131.0,
        });

        apply_layout(&mut snapshot, display_bounds);

        let layout = snapshot.layout.expect("layout should be computed");
        assert_eq!(layout.placement, AvatarOverlayPlacement::TopEnd);
        assert_eq!(
            serde_json::to_value(AvatarOverlayLayoutChangedNotification {
                layout: super::AvatarOverlayLayoutNotification {
                    mascot: layout.mascot,
                    placement: layout.placement,
                    tray: layout.tray,
                    viewport: layout.viewport,
                },
            })
            .expect("layout notification should serialize"),
            serde_json::json!({
                "layout": {
                    "mascot": {
                        "left": 244,
                        "top": 191,
                        "width": 112,
                        "height": 121
                    },
                    "placement": "top-end",
                    "tray": {
                        "left": 80,
                        "top": 56,
                        "width": 276,
                        "height": 131
                    },
                    "viewport": {
                        "width": 356,
                        "height": 320
                    }
                }
            })
        );
    }

    #[test]
    fn open_state_notification_serializes_with_camel_case() {
        assert_eq!(
            serde_json::to_value(AvatarOverlayOpenStateChangedNotification { is_open: true })
                .expect("notification should serialize"),
            serde_json::json!({
                "isOpen": true
            })
        );
    }

    #[test]
    fn deserializes_element_size_changed_payload() {
        let payload: AvatarOverlayElementSizeChangedParams =
            serde_json::from_value(serde_json::json!({
                "isTrayVisible": false,
                "mascot": {
                    "width": 112,
                    "height": 121
                },
                "tray": null
            }))
            .expect("payload should deserialize");

        assert_eq!(
            payload,
            AvatarOverlayElementSizeChangedParams {
                is_tray_visible: false,
                mascot: super::AvatarOverlayMeasuredElementSize {
                    width: 112.0,
                    height: 121.0,
                },
                tray: None,
            }
        );
    }

    #[test]
    fn deserializes_interaction_payload() {
        let payload: AvatarOverlayInteractionChangedParams =
            serde_json::from_value(serde_json::json!({
                "isInteractive": true
            }))
            .expect("payload should deserialize");

        assert_eq!(
            payload,
            AvatarOverlayInteractionChangedParams {
                is_interactive: true,
            }
        );
    }

    #[test]
    fn placement_serializes_to_kebab_case() {
        assert_eq!(
            serde_json::to_value(AvatarOverlayPlacement::BottomStart)
                .expect("placement should serialize"),
            serde_json::json!("bottom-start")
        );
    }
}
