mod auth_bridge;
mod automations;
mod browser_use_settings;
mod codex_home;
mod computer_use_settings;
mod global_settings;
mod host_files;
mod keyboard_shortcuts;
mod local_environments;
mod scratchpad;
mod thread_history;
mod workspace_agents;
mod workspace_files;
mod worktrees;
use auth_bridge::archive_conversation_command;
use auth_bridge::archive_thread;
use auth_bridge::batch_write_config_value_command;
use auth_bridge::batch_write_config_values;
use auth_bridge::cancel_login;
use auth_bridge::delete_plugin_share;
use auth_bridge::delete_plugin_share_command;
use auth_bridge::fork_thread;
use auth_bridge::get_auth_state;
use auth_bridge::get_config_requirements_for_host;
use auth_bridge::install_plugin;
use auth_bridge::interrupt_turn;
use auth_bridge::list_apps;
use auth_bridge::list_archived_threads;
use auth_bridge::list_experimental_features;
use auth_bridge::list_hooks_for_host;
use auth_bridge::list_mcp_server_status;
use auth_bridge::list_mcp_server_status_command;
use auth_bridge::list_plugin_shares;
use auth_bridge::list_plugin_shares_command;
use auth_bridge::list_plugins;
use auth_bridge::list_plugins_command;
use auth_bridge::list_recent_threads;
use auth_bridge::list_skills;
use auth_bridge::list_skills_for_host;
use auth_bridge::login_api_key;
use auth_bridge::login_api_key_for_host_command;
use auth_bridge::login_chatgpt;
use auth_bridge::login_chatgpt_device_code;
use auth_bridge::login_mcp_server;
use auth_bridge::login_mcp_server_command;
use auth_bridge::logout;
use auth_bridge::read_account_info;
use auth_bridge::read_account_rate_limits;
use auth_bridge::read_config;
use auth_bridge::read_config_for_host;
use auth_bridge::read_plugin;
use auth_bridge::read_thread;
use auth_bridge::reload_mcp_server_config;
use auth_bridge::reset_memories;
use auth_bridge::reset_memories_for_host;
use auth_bridge::respond_to_approval_request;
use auth_bridge::respond_to_mcp_server_elicitation_request;
use auth_bridge::respond_to_permissions_request_approval;
use auth_bridge::respond_to_tool_request_user_input;
use auth_bridge::rollback_thread;
use auth_bridge::save_plugin_share;
use auth_bridge::save_plugin_share_command;
use auth_bridge::send_add_credits_nudge_email;
use auth_bridge::set_experimental_feature_enablement;
use auth_bridge::set_personality;
use auth_bridge::set_thread_name;
use auth_bridge::shared_state;
use auth_bridge::start_review;
use auth_bridge::start_thread;
use auth_bridge::start_turn;
use auth_bridge::start_turn_with_input;
use auth_bridge::steer_turn;
use auth_bridge::unarchive_thread;
use auth_bridge::uninstall_plugin;
use auth_bridge::write_config_value;
use auth_bridge::write_config_value_command;
use automations::automation_create_command;
use automations::automation_delete_command;
use automations::automation_run_now_command;
use automations::automation_update_command;
use automations::delete_automation;
use automations::list_automations;
use automations::list_automations_command;
use automations::read_automation;
use automations::run_automation_now;
use automations::save_automation;
use automations::set_automation_status;
use browser_use_settings::add_browser_use_file_transfer_origin;
use browser_use_settings::add_browser_use_origin;
use browser_use_settings::browser_use_approval_mode_write;
use browser_use_settings::browser_use_history_approval_mode_write;
use browser_use_settings::browser_use_origin_add;
use browser_use_settings::browser_use_origin_remove;
use browser_use_settings::browser_use_origin_state_read;
use browser_use_settings::read_browser_use_settings;
use browser_use_settings::remove_browser_use_file_transfer_origin;
use browser_use_settings::remove_browser_use_origin;
use browser_use_settings::write_browser_use_approval_mode;
use browser_use_settings::write_browser_use_file_transfer_approval_mode;
use browser_use_settings::write_browser_use_history_approval_mode;
use codex_home::get_codex_home;
use computer_use_settings::computer_use_app_approval_remove;
use computer_use_settings::computer_use_app_approvals_read;
use computer_use_settings::computer_use_app_approvals_visibility;
use computer_use_settings::computer_use_sound_mode_read;
use computer_use_settings::computer_use_sound_mode_write;
use computer_use_settings::read_computer_use_approvals;
use computer_use_settings::read_computer_use_approvals_visibility;
use computer_use_settings::remove_computer_use_approval;
use global_settings::get_global_state;
use global_settings::get_global_state_command;
use global_settings::set_global_state;
use global_settings::set_global_state_command;
use global_settings::wsl_bash_availability;
use host_files::open_file;
use host_files::open_in_targets;
use host_files::read_file;
use host_files::third_party_notices;
use keyboard_shortcuts::get_command_keymap_state;
use keyboard_shortcuts::set_command_keybinding;
use local_environments::list_local_environments;
use local_environments::read_local_environment_config;
use local_environments::upstream_local_environment;
use local_environments::upstream_local_environment_config;
use local_environments::upstream_local_environment_config_save;
use local_environments::upstream_local_environments;
use local_environments::write_local_environment_config;
use scratchpad::generate_scratchpad_completion_summary;
use std::env;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use workspace_agents::codex_agents_md;
use workspace_agents::codex_agents_md_save;
use workspace_agents::read_workspace_agents_md;
use workspace_agents::write_workspace_agents_md;
use workspace_files::list_workspace_directory_entries;
use workspace_files::read_workspace_file;
use workspace_files::read_workspace_file_metadata;
use workspace_files::search_workspace_files;
use worktrees::worktree_delete;

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
            read_account_info,
            read_account_rate_limits,
            send_add_credits_nudge_email,
            list_apps,
            list_automations,
            list_automations_command,
            read_config,
            read_config_for_host,
            get_config_requirements_for_host,
            list_experimental_features,
            list_plugins,
            list_plugins_command,
            list_plugin_shares,
            list_plugin_shares_command,
            read_plugin,
            install_plugin,
            uninstall_plugin,
            save_plugin_share,
            save_plugin_share_command,
            delete_plugin_share,
            delete_plugin_share_command,
            read_browser_use_settings,
            browser_use_origin_state_read,
            write_browser_use_approval_mode,
            browser_use_approval_mode_write,
            write_browser_use_history_approval_mode,
            browser_use_history_approval_mode_write,
            write_browser_use_file_transfer_approval_mode,
            add_browser_use_origin,
            browser_use_origin_add,
            add_browser_use_file_transfer_origin,
            remove_browser_use_origin,
            browser_use_origin_remove,
            remove_browser_use_file_transfer_origin,
            get_codex_home,
            read_computer_use_approvals_visibility,
            computer_use_app_approvals_visibility,
            read_computer_use_approvals,
            computer_use_app_approvals_read,
            remove_computer_use_approval,
            computer_use_app_approval_remove,
            computer_use_sound_mode_read,
            computer_use_sound_mode_write,
            list_mcp_server_status,
            list_mcp_server_status_command,
            list_skills,
            list_skills_for_host,
            list_hooks_for_host,
            list_recent_threads,
            list_archived_threads,
            start_thread,
            fork_thread,
            archive_thread,
            archive_conversation_command,
            unarchive_thread,
            set_thread_name,
            start_turn,
            start_turn_with_input,
            start_review,
            steer_turn,
            interrupt_turn,
            set_experimental_feature_enablement,
            reset_memories,
            reset_memories_for_host,
            respond_to_approval_request,
            respond_to_mcp_server_elicitation_request,
            respond_to_permissions_request_approval,
            respond_to_tool_request_user_input,
            read_thread,
            rollback_thread,
            read_automation,
            automation_create_command,
            automation_update_command,
            automation_delete_command,
            automation_run_now_command,
            get_global_state,
            get_global_state_command,
            get_command_keymap_state,
            login_api_key,
            login_api_key_for_host_command,
            login_mcp_server,
            login_mcp_server_command,
            login_chatgpt,
            login_chatgpt_device_code,
            cancel_login,
            logout,
            set_global_state,
            set_global_state_command,
            set_command_keybinding,
            set_personality,
            batch_write_config_values,
            batch_write_config_value_command,
            write_config_value,
            write_config_value_command,
            codex_agents_md,
            codex_agents_md_save,
            read_workspace_agents_md,
            write_workspace_agents_md,
            save_automation,
            set_automation_status,
            delete_automation,
            run_automation_now,
            read_file,
            open_file,
            open_in_targets,
            third_party_notices,
            search_workspace_files,
            list_workspace_directory_entries,
            read_workspace_file_metadata,
            read_workspace_file,
            upstream_local_environments,
            upstream_local_environment,
            upstream_local_environment_config,
            upstream_local_environment_config_save,
            generate_scratchpad_completion_summary,
            list_local_environments,
            read_local_environment_config,
            write_local_environment_config,
            wsl_bash_availability,
            reload_mcp_server_config,
            worktree_delete
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
