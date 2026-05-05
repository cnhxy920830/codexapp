mod auth_bridge;
mod global_settings;
mod thread_history;
use auth_bridge::cancel_login;
use auth_bridge::get_auth_state;
use auth_bridge::interrupt_turn;
use auth_bridge::list_recent_threads;
use auth_bridge::login_api_key;
use auth_bridge::login_chatgpt;
use auth_bridge::login_chatgpt_device_code;
use auth_bridge::logout;
use auth_bridge::read_config;
use auth_bridge::read_thread;
use auth_bridge::respond_to_approval_request;
use auth_bridge::shared_state;
use auth_bridge::start_thread;
use auth_bridge::start_turn;
use auth_bridge::write_config_value;
use global_settings::get_global_state;
use global_settings::set_global_state;
use std::env;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct LaunchState {
    open_project_path: Mutex<Option<String>>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchContext {
    open_project_path: Option<String>,
}

pub fn run() {
    let launch_state = Arc::new(LaunchState::default());
    if let Some(path) = parse_open_project_path() {
        *launch_state
            .open_project_path
            .lock()
            .expect("launch state mutex poisoned") = Some(path.to_string_lossy().to_string());
    }
    tauri::Builder::default()
        .manage(shared_state())
        .manage(launch_state)
        .invoke_handler(tauri::generate_handler![
            get_launch_context,
            get_auth_state,
            read_config,
            list_recent_threads,
            start_thread,
            start_turn,
            interrupt_turn,
            respond_to_approval_request,
            read_thread,
            get_global_state,
            login_api_key,
            login_chatgpt,
            login_chatgpt_device_code,
            cancel_login,
            logout,
            set_global_state,
            write_config_value
        ])
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            if cfg!(target_os = "windows") && should_register_windows_context_menu() {
                let _ = register_windows_folder_context_menu();
            }
            tauri::async_runtime::spawn(async move {
                let _ = auth_bridge::start(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Codex App Replica");
}

#[tauri::command]
fn get_launch_context(state: tauri::State<'_, Arc<LaunchState>>) -> LaunchContext {
    LaunchContext {
        open_project_path: state
            .open_project_path
            .lock()
            .expect("launch state mutex poisoned")
            .clone(),
    }
}

fn parse_open_project_path() -> Option<PathBuf> {
    let mut args = env::args_os().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--open-project" {
            return args.next().map(PathBuf::from);
        }
    }
    None
}

fn register_windows_folder_context_menu() -> Result<(), String> {
    let exe =
        env::current_exe().map_err(|err| format!("failed to resolve executable path: {err}"))?;
    let exe = exe
        .to_str()
        .ok_or_else(|| "executable path is not valid utf-8".to_string())?;
    let key = r"HKCU\Software\Classes\Directory\shell\OpenProjectInCodex";
    let command = format!(r#""{exe}" --open-project "%1""#);

    run_reg(&["add", key, "/ve", "/d", "Open project in Codex", "/f"])?;
    run_reg(&["add", key, "/v", "Icon", "/d", &format!("{exe},0"), "/f"])?;
    run_reg(&[
        "add",
        &format!(r"{key}\command"),
        "/ve",
        "/d",
        &command,
        "/f",
    ])?;
    Ok(())
}

fn should_register_windows_context_menu() -> bool {
    let Ok(exe) = env::current_exe() else {
        return false;
    };
    let exe = exe.to_string_lossy().to_ascii_lowercase();
    !exe.contains(r"\src-tauri\target\")
}

fn run_reg(args: &[&str]) -> Result<(), String> {
    let status = Command::new("reg.exe")
        .args(args)
        .status()
        .map_err(|err| format!("failed to run reg.exe: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("reg.exe exited with {status}"))
    }
}
