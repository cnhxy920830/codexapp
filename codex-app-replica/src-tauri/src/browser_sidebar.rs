use crate::host_files::normalize_browser_url;
use crate::host_files::resolve_requested_path;
use crate::open_targets::ensure_supported_host_id;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::LogicalPosition;
use tauri::LogicalSize;
use tauri::Manager;
use tauri::Position;
use tauri::Rect;
use tauri::Size;
use tauri::Url;
use tauri::Webview;
use tauri::WebviewBuilder;
use tauri::WebviewUrl;
use tauri::Window;
use tauri::Wry;

pub(crate) const BROWSER_PARTITION_ROOT_DIR: &str = "codex-browser-partitions";
pub(crate) const BROWSER_SIDEBAR_LABEL: &str = "browser-sidebar";
const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Default)]
pub struct BrowserSidebarState {
    inner: Mutex<BrowserSidebarStateInner>,
}

#[derive(Default)]
struct BrowserSidebarStateInner {
    bounds: Option<BrowserSidebarBounds>,
    visible: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSidebarBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSidebarNavigateParams {
    pub url: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSidebarOpenFileParams {
    pub host_id: Option<String>,
    pub path: String,
    pub cwd: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSidebarVisibleParams {
    pub visible: bool,
}

#[tauri::command(rename = "browser-sidebar-navigate")]
pub async fn browser_sidebar_navigate(
    window: Window<Wry>,
    app: tauri::AppHandle,
    state: tauri::State<'_, BrowserSidebarState>,
    params: BrowserSidebarNavigateParams,
) -> Result<(), String> {
    let url = parse_browser_sidebar_url(&params.url)?;
    let webview = ensure_browser_sidebar_webview(&window, &app, &state)?;
    webview
        .navigate(url)
        .map_err(|err| format!("failed to navigate browser sidebar: {err}"))
}

#[tauri::command(rename = "browser-sidebar-open-file")]
pub async fn browser_sidebar_open_file(
    window: Window<Wry>,
    app: tauri::AppHandle,
    state: tauri::State<'_, BrowserSidebarState>,
    params: BrowserSidebarOpenFileParams,
) -> Result<(), String> {
    ensure_supported_host_id(params.host_id.as_deref(), "browser-sidebar-open-file")?;
    let path = resolve_requested_path(&params.path, params.cwd.as_deref())?;
    let url = Url::from_file_path(&path)
        .map_err(|()| format!("failed to convert path to file url: {}", path.display()))?;
    let webview = ensure_browser_sidebar_webview(&window, &app, &state)?;
    webview
        .navigate(url)
        .map_err(|err| format!("failed to open file in browser sidebar: {err}"))
}

#[tauri::command(rename = "browser-sidebar-set-bounds")]
pub fn browser_sidebar_set_bounds(
    app: tauri::AppHandle,
    state: tauri::State<'_, BrowserSidebarState>,
    params: BrowserSidebarBounds,
) -> Result<(), String> {
    let bounds = normalize_browser_sidebar_bounds(params);
    {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "browser sidebar state mutex poisoned".to_string())?;
        inner.bounds = Some(bounds);
    }

    if let Some(webview) = app.get_webview(BROWSER_SIDEBAR_LABEL) {
        apply_browser_sidebar_bounds(&webview, bounds)?;
    }

    Ok(())
}

#[tauri::command(rename = "browser-sidebar-set-visible")]
pub fn browser_sidebar_set_visible(
    app: tauri::AppHandle,
    state: tauri::State<'_, BrowserSidebarState>,
    params: BrowserSidebarVisibleParams,
) -> Result<(), String> {
    {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "browser sidebar state mutex poisoned".to_string())?;
        inner.visible = params.visible;
    }

    if let Some(webview) = app.get_webview(BROWSER_SIDEBAR_LABEL) {
        apply_browser_sidebar_visibility(&webview, params.visible)?;
    }

    Ok(())
}

fn ensure_browser_sidebar_webview(
    window: &Window<Wry>,
    app: &tauri::AppHandle,
    state: &BrowserSidebarState,
) -> Result<Webview<Wry>, String> {
    if let Some(webview) = app.get_webview(BROWSER_SIDEBAR_LABEL) {
        apply_browser_sidebar_state(&webview, state)?;
        return Ok(webview);
    }

    let (bounds, visible) = {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "browser sidebar state mutex poisoned".to_string())?;
        (
            inner.bounds.unwrap_or(BrowserSidebarBounds {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            }),
            inner.visible,
        )
    };
    let bounds = normalize_browser_sidebar_bounds(bounds);
    if window.label() != MAIN_WINDOW_LABEL {
        return Err(format!(
            "browser sidebar commands must originate from the main window: {}",
            window.label()
        ));
    }
    let webview = window
        .add_child(
            WebviewBuilder::new(
                BROWSER_SIDEBAR_LABEL,
                WebviewUrl::External(
                    Url::parse("about:blank").expect("about:blank should be a valid URL"),
                ),
            )
            .data_directory(browser_sidebar_partition_relative_dir()),
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|err| format!("failed to create browser sidebar webview: {err}"))?;

    apply_browser_sidebar_visibility(&webview, visible)?;
    apply_browser_sidebar_bounds(&webview, bounds)?;
    Ok(webview)
}

fn apply_browser_sidebar_state(
    webview: &Webview<Wry>,
    state: &BrowserSidebarState,
) -> Result<(), String> {
    let (bounds, visible) = {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "browser sidebar state mutex poisoned".to_string())?;
        (inner.bounds, inner.visible)
    };

    if let Some(bounds) = bounds {
        apply_browser_sidebar_bounds(webview, bounds)?;
    }
    apply_browser_sidebar_visibility(webview, visible)
}

fn apply_browser_sidebar_bounds(
    webview: &Webview<Wry>,
    bounds: BrowserSidebarBounds,
) -> Result<(), String> {
    webview
        .set_bounds(Rect {
            position: Position::Logical(LogicalPosition::new(bounds.x, bounds.y)),
            size: Size::Logical(LogicalSize::new(bounds.width, bounds.height)),
        })
        .map_err(|err| format!("failed to resize browser sidebar: {err}"))
}

fn apply_browser_sidebar_visibility(webview: &Webview<Wry>, visible: bool) -> Result<(), String> {
    if visible {
        webview
            .show()
            .map_err(|err| format!("failed to show browser sidebar: {err}"))
    } else {
        webview
            .hide()
            .map_err(|err| format!("failed to hide browser sidebar: {err}"))
    }
}

pub(crate) fn browser_sidebar_partition_relative_dir() -> PathBuf {
    PathBuf::from(BROWSER_PARTITION_ROOT_DIR).join("app")
}

fn normalize_browser_sidebar_bounds(bounds: BrowserSidebarBounds) -> BrowserSidebarBounds {
    BrowserSidebarBounds {
        x: bounds.x.max(0.0),
        y: bounds.y.max(0.0),
        width: bounds.width.max(1.0),
        height: bounds.height.max(1.0),
    }
}

fn parse_browser_sidebar_url(url: &str) -> Result<Url, String> {
    let normalized = normalize_browser_url(url)?;
    Url::parse(&normalized).map_err(|err| format!("failed to parse browser sidebar url: {err}"))
}

#[cfg(test)]
mod tests {
    use super::normalize_browser_sidebar_bounds;
    use super::BrowserSidebarBounds;
    use super::BrowserSidebarNavigateParams;
    use super::BrowserSidebarOpenFileParams;
    use super::BrowserSidebarVisibleParams;
    use serde_json::json;

    #[test]
    fn navigate_params_accept_url() {
        let params: BrowserSidebarNavigateParams = serde_json::from_value(json!({
            "url": "https://chatgpt.com/codex"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            BrowserSidebarNavigateParams {
                url: "https://chatgpt.com/codex".to_string(),
            }
        );
    }

    #[test]
    fn open_file_params_accept_local_host_shape() {
        let params: BrowserSidebarOpenFileParams = serde_json::from_value(json!({
            "hostId": "local",
            "path": "preview.html",
            "cwd": "D:/repo"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            BrowserSidebarOpenFileParams {
                host_id: Some("local".to_string()),
                path: "preview.html".to_string(),
                cwd: Some("D:/repo".to_string()),
            }
        );
    }

    #[test]
    fn visible_params_accept_camel_case_shape() {
        let params: BrowserSidebarVisibleParams = serde_json::from_value(json!({
            "visible": true
        }))
        .expect("params should deserialize");

        assert_eq!(params, BrowserSidebarVisibleParams { visible: true });
    }

    #[test]
    fn browser_sidebar_bounds_are_clamped_to_positive_values() {
        assert_eq!(
            normalize_browser_sidebar_bounds(BrowserSidebarBounds {
                x: -10.0,
                y: -20.0,
                width: 0.0,
                height: -5.0,
            }),
            BrowserSidebarBounds {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            }
        );
    }
}
