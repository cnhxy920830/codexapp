mod auth_bridge;
mod browser_use_settings;
mod codex_home;
mod computer_use_settings;
mod global_settings;
mod keyboard_shortcuts;
mod local_environments;
mod thread_history;
mod workspace_agents;
mod workspace_files;
use auth_bridge::archive_thread;
use auth_bridge::batch_write_config_values;
use auth_bridge::cancel_login;
use auth_bridge::fork_thread;
use auth_bridge::get_auth_state;
use auth_bridge::install_plugin;
use auth_bridge::interrupt_turn;
use auth_bridge::list_apps;
use auth_bridge::list_archived_threads;
use auth_bridge::list_experimental_features;
use auth_bridge::list_mcp_server_status;
use auth_bridge::list_plugins;
use auth_bridge::list_recent_threads;
use auth_bridge::list_skills;
use auth_bridge::login_api_key;
use auth_bridge::login_chatgpt;
use auth_bridge::login_chatgpt_device_code;
use auth_bridge::login_mcp_server;
use auth_bridge::logout;
use auth_bridge::read_account_rate_limits;
use auth_bridge::read_config;
use auth_bridge::read_plugin;
use auth_bridge::read_thread;
use auth_bridge::reload_mcp_server_config;
use auth_bridge::reset_memories;
use auth_bridge::respond_to_approval_request;
use auth_bridge::respond_to_mcp_server_elicitation_request;
use auth_bridge::respond_to_permissions_request_approval;
use auth_bridge::respond_to_tool_request_user_input;
use auth_bridge::send_add_credits_nudge_email;
use auth_bridge::set_experimental_feature_enablement;
use auth_bridge::set_personality;
use auth_bridge::set_thread_name;
use auth_bridge::shared_state;
use auth_bridge::start_review;
use auth_bridge::start_thread;
use auth_bridge::start_turn;
use auth_bridge::steer_turn;
use auth_bridge::unarchive_thread;
use auth_bridge::uninstall_plugin;
use auth_bridge::write_config_value;
use browser_use_settings::add_browser_use_origin;
use browser_use_settings::read_browser_use_settings;
use browser_use_settings::remove_browser_use_origin;
use browser_use_settings::write_browser_use_approval_mode;
use browser_use_settings::write_browser_use_history_approval_mode;
use codex_home::get_codex_home;
use computer_use_settings::read_computer_use_approvals;
use computer_use_settings::read_computer_use_approvals_visibility;
use computer_use_settings::remove_computer_use_approval;
use global_settings::get_global_state;
use global_settings::set_global_state;
use keyboard_shortcuts::get_command_keymap_state;
use keyboard_shortcuts::set_command_keybinding;
use local_environments::list_local_environments;
use local_environments::read_local_environment_config;
use local_environments::write_local_environment_config;
use std::env;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use workspace_agents::read_workspace_agents_md;
use workspace_agents::write_workspace_agents_md;
use workspace_files::read_workspace_file;
use workspace_files::read_workspace_file_metadata;
use workspace_files::search_workspace_files;

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
            read_account_rate_limits,
            send_add_credits_nudge_email,
            list_apps,
            read_config,
            list_experimental_features,
            list_plugins,
            read_plugin,
            install_plugin,
            uninstall_plugin,
            read_browser_use_settings,
            write_browser_use_approval_mode,
            write_browser_use_history_approval_mode,
            add_browser_use_origin,
            remove_browser_use_origin,
            get_codex_home,
            read_computer_use_approvals_visibility,
            read_computer_use_approvals,
            remove_computer_use_approval,
            list_mcp_server_status,
            list_skills,
            list_recent_threads,
            list_archived_threads,
            start_thread,
            fork_thread,
            archive_thread,
            unarchive_thread,
            set_thread_name,
            start_turn,
            start_review,
            steer_turn,
            interrupt_turn,
            set_experimental_feature_enablement,
            reset_memories,
            respond_to_approval_request,
            respond_to_mcp_server_elicitation_request,
            respond_to_permissions_request_approval,
            respond_to_tool_request_user_input,
            read_thread,
            get_global_state,
            get_command_keymap_state,
            login_api_key,
            login_mcp_server,
            login_chatgpt,
            login_chatgpt_device_code,
            cancel_login,
            logout,
            set_global_state,
            set_command_keybinding,
            set_personality,
            batch_write_config_values,
            write_config_value,
            read_workspace_agents_md,
            write_workspace_agents_md,
            search_workspace_files,
            read_workspace_file_metadata,
            read_workspace_file,
            list_local_environments,
            read_local_environment_config,
            write_local_environment_config,
            reload_mcp_server_config
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
