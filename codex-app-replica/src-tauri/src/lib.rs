mod ambient_suggestions_background_refresh;
mod ambient_suggestions_connector_personalization;
mod app_connect_oauth;
mod app_shell_signals;
mod app_state_snapshot;
mod auth_bridge;
mod automation_run_history;
mod automations;
mod avatar_overlay;
mod browser_session_data;
mod browser_sidebar;
mod browser_use_settings;
mod chronicle;
mod codex_app_config;
mod codex_home;
mod computer_use_settings;
mod custom_avatars;
mod debug_app_server;
mod debug_child_processes;
mod debug_modal;
mod debug_packaged_state;
mod desktop_notifications;
mod external_agent_import;
mod fast_mode_rollout_metrics;
mod git_branches;
mod git_commit_messages;
mod git_origins;
mod git_origins_remote;
mod global_dictation;
mod global_dictation_settings;
mod global_dictation_transcription;
mod global_dictation_window;
mod global_settings;
mod host_files;
mod hotkey_window;
mod keyboard_shortcuts;
mod local_environments;
mod local_environments_remote;
mod open_targets;
mod pending_worktrees;
mod power_save_blocker;
mod primary_runtime;
mod primary_runtime_post_install;
mod projectless_threads;
mod pull_request_git;
mod pull_requests;
mod query_cache;
mod recommended_skills;
mod remote_app_server_registry;
mod remote_app_server_runtime;
mod remote_connections;
mod remote_control;
mod remote_diff_apply;
mod remote_ssh;
mod remote_tasks;
mod scratchpad;
mod statsig;
mod taskbar_badge;
mod terminal_shell_options;
mod thread_history;
mod usage_billing;
mod window_mode;
mod window_navigation;
mod workspace_agents;
mod workspace_files;
mod workspace_roots;
mod worktrees;
mod worktrees_remote;
use ambient_suggestions_background_refresh::handle_window_event as handle_ambient_suggestions_background_refresh_window_event;
use ambient_suggestions_background_refresh::sync_initial_focus_state as sync_ambient_suggestions_background_refresh_state;
use ambient_suggestions_background_refresh::AmbientSuggestionsBackgroundRefreshState;
use app_connect_oauth::app_connect_oauth_callback_url;
use app_connect_oauth::finish_app_connect_oauth_callback;
use app_shell_signals::electron_window_focus_request;
use app_shell_signals::view_focused;
use app_state_snapshot::electron_app_state_snapshot_response;
use app_state_snapshot::set_review_pane_snapshot_metrics_for_host;
use app_state_snapshot::spawn_app_state_snapshot_heartbeat;
use app_state_snapshot::AppStateSnapshotState;
use auth_bridge::add_marketplace;
use auth_bridge::add_marketplace_command;
use auth_bridge::archive_conversation_command;
use auth_bridge::archive_thread;
use auth_bridge::batch_write_config_value_command;
use auth_bridge::batch_write_config_values;
use auth_bridge::cancel_login;
use auth_bridge::clear_thread_goal;
use auth_bridge::codex_app_server_restart;
use auth_bridge::debug_app_server_thread_status_for_host;
use auth_bridge::delete_plugin_share;
use auth_bridge::delete_plugin_share_command;
use auth_bridge::discard_conversation_from_cache;
use auth_bridge::fork_conversation_from_latest;
use auth_bridge::fork_thread;
use auth_bridge::get_auth_state;
use auth_bridge::get_config_requirements_for_host;
use auth_bridge::install_plugin;
use auth_bridge::install_plugin_command;
use auth_bridge::interrupt_turn;
use auth_bridge::list_apps;
use auth_bridge::list_archived_threads;
use auth_bridge::list_archived_threads_command;
use auth_bridge::list_experimental_features;
use auth_bridge::list_experimental_features_for_host;
use auth_bridge::list_hooks_for_host;
use auth_bridge::list_mcp_server_status;
use auth_bridge::list_mcp_server_status_command;
use auth_bridge::list_models_for_host;
use auth_bridge::list_plugin_shares;
use auth_bridge::list_plugin_shares_command;
use auth_bridge::list_plugins;
use auth_bridge::list_plugins_command;
use auth_bridge::list_recent_threads;
use auth_bridge::list_recent_threads_command;
use auth_bridge::list_skills;
use auth_bridge::list_skills_for_host;
use auth_bridge::login_api_key;
use auth_bridge::login_api_key_command;
use auth_bridge::login_api_key_for_host_command;
use auth_bridge::login_chatgpt;
use auth_bridge::login_chatgpt_command;
use auth_bridge::login_chatgpt_device_code;
use auth_bridge::login_chatgpt_device_code_command;
use auth_bridge::login_chatgpt_for_host_command;
use auth_bridge::login_mcp_server;
use auth_bridge::login_mcp_server_command;
use auth_bridge::logout;
use auth_bridge::mark_conversation_as_read;
use auth_bridge::mark_conversation_as_unread;
use auth_bridge::maybe_resume_conversation;
use auth_bridge::read_account_info;
use auth_bridge::read_account_rate_limits;
use auth_bridge::read_app_tools;
use auth_bridge::read_app_tools_command;
use auth_bridge::read_config;
use auth_bridge::read_config_for_host;
use auth_bridge::read_plugin;
use auth_bridge::read_plugin_command;
use auth_bridge::read_thread;
use auth_bridge::reload_mcp_server_config;
use auth_bridge::remove_marketplace;
use auth_bridge::remove_marketplace_command;
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
use auth_bridge::send_follow_up_message;
use auth_bridge::set_experimental_feature_enablement;
use auth_bridge::set_local_app_server_feature_enablement;
use auth_bridge::set_personality;
use auth_bridge::set_thread_goal;
use auth_bridge::set_thread_goal_status;
use auth_bridge::set_thread_name;
use auth_bridge::shared_state;
use auth_bridge::start_conversation;
use auth_bridge::start_review;
use auth_bridge::start_thread;
use auth_bridge::start_turn;
use auth_bridge::start_turn_with_input;
use auth_bridge::steer_turn;
use auth_bridge::unarchive_conversation_command;
use auth_bridge::unarchive_thread;
use auth_bridge::uninstall_plugin;
use auth_bridge::uninstall_plugin_command;
use auth_bridge::unsubscribe_thread_for_host;
use auth_bridge::upgrade_marketplaces;
use auth_bridge::upgrade_marketplaces_command;
use auth_bridge::write_config_value;
use auth_bridge::write_config_value_command;
use auth_bridge::write_skill_config;
use auth_bridge::write_skill_config_command;
use auth_bridge::AuthBridgeState;
use automation_run_history::inbox_item_set_read_state;
use automation_run_history::inbox_items;
use automation_run_history::AutomationRunHistoryState;
use automations::automation_create_command;
use automations::automation_delete_command;
use automations::automation_run_now_command;
use automations::automation_update_command;
use automations::delete_automation;
use automations::heartbeat_automation_thread_state_changed;
use automations::list_automations;
use automations::list_automations_command;
use automations::read_automation;
use automations::run_automation_now;
use automations::save_automation;
use automations::set_automation_status;
use automations::spawn_heartbeat_automation_scheduler;
use automations::HeartbeatAutomationSchedulerState;
use avatar_overlay::avatar_overlay_drag_end;
use avatar_overlay::avatar_overlay_drag_move;
use avatar_overlay::avatar_overlay_drag_release;
use avatar_overlay::avatar_overlay_drag_start;
use avatar_overlay::avatar_overlay_element_size_changed;
use avatar_overlay::avatar_overlay_keyboard_interaction_changed;
use avatar_overlay::avatar_overlay_open;
use avatar_overlay::avatar_overlay_open_state_request;
use avatar_overlay::avatar_overlay_pointer_interaction_changed;
use avatar_overlay::AvatarOverlayState;
use browser_session_data::browser_browsing_data_clear;
use browser_sidebar::browser_sidebar_navigate;
use browser_sidebar::browser_sidebar_open_file;
use browser_sidebar::browser_sidebar_set_bounds;
use browser_sidebar::browser_sidebar_set_visible;
use browser_sidebar::BrowserSidebarState;
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
use chronicle::chronicle_permissions;
use codex_home::get_codex_home;
use computer_use_settings::chrome_extension_installed_read;
use computer_use_settings::chrome_extension_settings_open;
use computer_use_settings::computer_use_app_approval_remove;
use computer_use_settings::computer_use_app_approvals_read;
use computer_use_settings::computer_use_app_approvals_visibility;
use computer_use_settings::computer_use_sound_mode_read;
use computer_use_settings::computer_use_sound_mode_write;
use computer_use_settings::read_computer_use_approvals;
use computer_use_settings::read_computer_use_approvals_visibility;
use computer_use_settings::remove_computer_use_approval;
use custom_avatars::read_custom_avatars;
use debug_app_server::debug_app_server_clear_notifications;
use debug_app_server::debug_app_server_clear_requests;
use debug_app_server::debug_app_server_snapshot;
use debug_app_server::DebugAppServerState;
use debug_child_processes::child_processes;
use debug_child_processes::ChildProcessMetricsState;
use debug_modal::ambient_suggestion_set_status;
use debug_modal::ambient_suggestions;
use debug_modal::ambient_suggestions_generation_statuses;
use debug_modal::ambient_suggestions_refresh;
use debug_modal::debug_run_app_action_request;
use debug_modal::debug_run_app_action_response;
use debug_modal::AmbientSuggestionsCache;
use debug_modal::DebugActionRequestSources;
use debug_packaged_state::is_packaged;
use desktop_notifications::desktop_notification_hide;
use desktop_notifications::desktop_notification_show;
use desktop_notifications::DesktopNotificationsState;
use external_agent_import::external_agent_import_detect;
use external_agent_import::external_agent_import_import;
use external_agent_import::external_agent_import_status;
use fast_mode_rollout_metrics::fast_mode_rollout_metrics;
use git_branches::git_branches_read;
use git_branches::git_checkout_branch;
use git_branches::git_commit_changes;
use git_branches::git_commit_dialog_read;
use git_branches::git_create_branch;
use git_commit_messages::generate_git_commit_message;
use git_origins::git_origins;
use global_dictation::request_microphone_permission;
use global_dictation_settings::global_dictation_copy_history_item;
use global_dictation_settings::global_dictation_history;
use global_dictation_settings::global_dictation_hotkey_state;
use global_dictation_settings::global_dictation_set_hotkey;
use global_dictation_settings::global_dictation_set_toggle_hotkey;
use global_dictation_settings::start_global_dictation_hotkey_runtime;
use global_dictation_settings::GlobalDictationSettingsState;
use global_dictation_transcription::global_dictation_transcribe_audio;
use global_dictation_window::global_dictation_completed;
use global_dictation_window::global_dictation_dismiss;
use global_dictation_window::global_dictation_enabled_changed;
use global_dictation_window::global_dictation_failed;
use global_dictation_window::global_dictation_force_lock_changed;
use global_dictation_window::global_dictation_hide;
use global_dictation_window::global_dictation_in_app_started;
use global_dictation_window::global_dictation_prewarm;
use global_dictation_window::global_dictation_record_history_item;
use global_dictation_window::global_dictation_recording_stopped;
use global_dictation_window::global_dictation_show_and_start;
use global_dictation_window::global_dictation_stop;
use global_dictation_window::global_dictation_window_layout;
use global_dictation_window::GlobalDictationWindowState;
use global_settings::get_global_state;
use global_settings::get_global_state_command;
use global_settings::set_global_state;
use global_settings::set_global_state_command;
use global_settings::wsl_bash_availability;
use host_files::compile_latex_artifact;
use host_files::open_file;
use host_files::open_in_browser;
use host_files::read_file;
use host_files::read_file_binary;
use host_files::read_file_metadata;
use host_files::third_party_notices;
use hotkey_window::hotkey_window_enabled_changed;
use hotkey_window::hotkey_window_home_pointer_interaction_changed;
use hotkey_window::hotkey_window_hotkey_state;
use hotkey_window::hotkey_window_set_dev_hotkey_override;
use hotkey_window::hotkey_window_set_hotkey;
use hotkey_window::open_in_hotkey_window;
use hotkey_window::HotkeyWindowGateState;
use keyboard_shortcuts::get_command_keymap_state;
use keyboard_shortcuts::set_command_keybinding;
use local_environments::list_local_environments;
use local_environments::read_local_environment_config;
use local_environments::upstream_local_environment;
use local_environments::upstream_local_environment_config;
use local_environments::upstream_local_environment_config_save;
use local_environments::upstream_local_environments;
use local_environments::write_local_environment_config;
use open_targets::open_in_targets;
use open_targets::set_preferred_app;
use pending_worktrees::pending_worktree_cancel;
use pending_worktrees::pending_worktree_create;
use pending_worktrees::pending_worktree_dismiss;
use pending_worktrees::pending_worktree_retry;
use pending_worktrees::pending_worktree_update_metadata;
use pending_worktrees::PendingWorktreesState;
use power_save_blocker::power_save_blocker_set;
use power_save_blocker::PowerSaveBlockerState;
use primary_runtime::cancel_primary_runtime_install;
use primary_runtime::diagnose_primary_runtime_dependencies;
use primary_runtime::finish_primary_runtime_install;
use primary_runtime::install_primary_runtime;
use primary_runtime::load_primary_runtime_dependencies;
use primary_runtime::primary_runtime_update_run_now;
use primary_runtime::primary_runtime_update_status;
use primary_runtime::reset_primary_runtime_dependencies;
use primary_runtime::set_primary_runtime_install_release;
use primary_runtime::sync_primary_runtime_shared_objects;
use primary_runtime::PrimaryRuntimeState;
use projectless_threads::projectless_thread_cwd;
use pull_request_git::gh_pr_file_content;
use pull_requests::gh_cli_status;
use pull_requests::gh_current_user;
use pull_requests::gh_pr_board;
use pull_requests::gh_pr_body;
use pull_requests::gh_pr_checks;
use pull_requests::gh_pr_comment;
use pull_requests::gh_pr_comments;
use pull_requests::gh_pr_diff;
use pull_requests::gh_pr_merge;
use pull_requests::gh_pr_status;
use pull_requests::gh_pr_update;
use recommended_skills::install_recommended_skill;
use recommended_skills::recommended_skills;
use recommended_skills::remove_skill;
use remote_app_server_registry::RemoteAppServerRegistry;
use remote_app_server_runtime::RemoteAppServerRuntimeState;
use remote_connections::app_server_connection_state;
use remote_connections::discover_remote_ssh_connections;
use remote_connections::get_shared_object_snapshot;
use remote_connections::refresh_remote_connections;
use remote_connections::save_codex_managed_remote_ssh_connections;
use remote_connections::save_remote_project;
use remote_connections::set_remote_connection_auto_connect;
use remote_control::mfa_info_read;
use remote_control::remote_control_clients_list;
use remote_control::remote_control_mfa_required_but_disabled_read;
use remote_control::remote_control_mfa_requirement_read;
use remote_diff_apply::apply_patch;
use remote_tasks::remote_task_image_read;
use remote_tasks::remote_task_list;
use remote_tasks::remote_task_pr_create;
use remote_tasks::remote_task_read;
use remote_tasks::remote_task_turn_logs_read;
use remote_tasks::remote_task_turn_read;
use remote_tasks::remote_task_turns_read;
use scratchpad::generate_scratchpad_completion_summary;
use statsig::statsig_fetch_values;
use statsig::statsig_request;
use std::env;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use taskbar_badge::electron_set_badge_count;
use tauri::Manager;
use terminal_shell_options::terminal_shell_options;
use usage_billing::disable_usage_auto_top_up;
use usage_billing::enable_usage_auto_top_up;
use usage_billing::read_usage_auto_top_up_settings;
use usage_billing::read_usage_billing_currency;
use usage_billing::read_usage_customer_portal;
use usage_billing::read_usage_pricing;
use usage_billing::update_usage_auto_top_up;
use window_mode::electron_set_window_mode;
use window_mode::PrimaryWindowModeState;
use window_navigation::debug_window_origin_conversation_changed;
use window_navigation::open_current_main_window;
use window_navigation::open_debug_window;
use window_navigation::open_in_main_window;
use window_navigation::open_in_new_window;
use window_navigation::show_diff;
use window_navigation::show_plan_summary;
use window_navigation::show_settings;
use window_navigation::take_pending_debug_window_origin_conversation;
use window_navigation::take_pending_plan_summary;
use window_navigation::take_pending_window_route;
use window_navigation::update_diff_if_open;
use window_navigation::DebugWindowOriginConversations;
use window_navigation::PendingDebugWindowOriginConversations;
use window_navigation::PendingPlanSummaries;
use window_navigation::PendingWindowRoutes;
use workspace_agents::codex_agents_md;
use workspace_agents::codex_agents_md_save;
use workspace_agents::read_workspace_agents_md;
use workspace_agents::write_workspace_agents_md;
use workspace_files::list_workspace_directory_entries;
use workspace_files::read_workspace_file;
use workspace_files::read_workspace_file_binary;
use workspace_files::read_workspace_file_metadata;
use workspace_files::search_workspace_files;
use workspace_roots::active_workspace_roots;
use workspace_roots::add_new_workspace_root_option;
use workspace_roots::clear_active_workspace_root;
use workspace_roots::create_new_workspace_root_option;
use workspace_roots::onboarding_pick_workspace_or_create_default;
use workspace_roots::onboarding_skip_workspace;
use workspace_roots::paths_exist;
use workspace_roots::pick_workspace_root_option;
use workspace_roots::rename_workspace_root_option;
use workspace_roots::set_active_workspace_root;
use workspace_roots::update_workspace_root_options;
use workspace_roots::workspace_root_options;
use worktrees::codex_worktrees;
use worktrees::worktree_delete;
use worktrees::worktree_set_owner_thread;

#[derive(Default)]
struct LaunchState {
    app_connect_oauth_callback_url: Mutex<Option<String>>,
    open_project_path: Mutex<Option<String>>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchContext {
    app_connect_oauth_callback_url: Option<String>,
    open_project_path: Option<String>,
}

enum LaunchArgument {
    AppConnectOAuthCallbackUrl(String),
    OpenProjectPath(PathBuf),
}

pub fn run() {
    let launch_state = Arc::new(LaunchState::default());
    let auth_state = shared_state();
    let heartbeat_automation_scheduler_state =
        Arc::new(HeartbeatAutomationSchedulerState::default());
    let app_state_snapshot_state = Arc::new(AppStateSnapshotState::default());
    let automation_run_history_state = Arc::new(AutomationRunHistoryState::default());
    if let Some(argument) = parse_launch_argument() {
        match argument {
            LaunchArgument::OpenProjectPath(path) => {
                *launch_state
                    .open_project_path
                    .lock()
                    .expect("launch state mutex poisoned") =
                    Some(path.to_string_lossy().to_string());
            }
            LaunchArgument::AppConnectOAuthCallbackUrl(callback_url) => {
                *launch_state
                    .app_connect_oauth_callback_url
                    .lock()
                    .expect("launch state mutex poisoned") = Some(callback_url);
            }
        }
    }
    tauri::Builder::default()
        .on_window_event(|window, event| {
            app_shell_signals::handle_window_event(window, event);
            avatar_overlay::handle_window_event(window, event);
            if let (Some(auth_state), Some(cache), Some(background_state)) = (
                window.try_state::<Arc<AuthBridgeState>>(),
                window.try_state::<Arc<AmbientSuggestionsCache>>(),
                window.try_state::<AmbientSuggestionsBackgroundRefreshState>(),
            ) {
                handle_ambient_suggestions_background_refresh_window_event(
                    window,
                    event,
                    auth_state.inner(),
                    cache.inner(),
                    background_state.inner(),
                );
            }
        })
        .manage(auth_state.clone())
        .manage(heartbeat_automation_scheduler_state.clone())
        .manage(app_state_snapshot_state.clone())
        .manage(automation_run_history_state)
        .manage(launch_state)
        .manage(PowerSaveBlockerState::default())
        .manage(AvatarOverlayState::default())
        .manage(BrowserSidebarState::default())
        .manage(PrimaryWindowModeState::default())
        .manage(DebugWindowOriginConversations::default())
        .manage(PendingPlanSummaries::default())
        .manage(PendingDebugWindowOriginConversations::default())
        .manage(PendingWindowRoutes::default())
        .manage(Arc::new(AmbientSuggestionsCache::default()))
        .manage(AmbientSuggestionsBackgroundRefreshState::default())
        .manage(DebugActionRequestSources::default())
        .manage(GlobalDictationWindowState::default())
        .manage(GlobalDictationSettingsState::default())
        .manage(HotkeyWindowGateState::default())
        .manage(DesktopNotificationsState::default())
        .manage(RemoteAppServerRegistry::default())
        .manage(RemoteAppServerRuntimeState::default())
        .manage(DebugAppServerState::default())
        .manage(PrimaryRuntimeState::default())
        .manage(Arc::new(PendingWorktreesState::default()))
        .manage(ChildProcessMetricsState::default())
        .invoke_handler(tauri::generate_handler![
            get_launch_context,
            app_connect_oauth_callback_url,
            get_auth_state,
            read_account_info,
            read_account_rate_limits,
            read_usage_auto_top_up_settings,
            enable_usage_auto_top_up,
            update_usage_auto_top_up,
            disable_usage_auto_top_up,
            read_usage_billing_currency,
            read_usage_pricing,
            read_usage_customer_portal,
            send_add_credits_nudge_email,
            read_custom_avatars,
            ambient_suggestions,
            ambient_suggestions_refresh,
            ambient_suggestion_set_status,
            ambient_suggestions_generation_statuses,
            debug_run_app_action_request,
            debug_run_app_action_response,
            is_packaged,
            child_processes,
            debug_app_server_snapshot,
            debug_app_server_clear_requests,
            debug_app_server_clear_notifications,
            debug_app_server_thread_status_for_host,
            global_dictation_prewarm,
            global_dictation_show_and_start,
            global_dictation_stop,
            global_dictation_transcribe_audio,
            global_dictation_window_layout,
            global_dictation_hide,
            global_dictation_recording_stopped,
            global_dictation_dismiss,
            global_dictation_completed,
            global_dictation_failed,
            global_dictation_in_app_started,
            global_dictation_record_history_item,
            global_dictation_enabled_changed,
            global_dictation_force_lock_changed,
            global_dictation_hotkey_state,
            global_dictation_set_hotkey,
            global_dictation_set_toggle_hotkey,
            global_dictation_history,
            global_dictation_copy_history_item,
            desktop_notification_show,
            desktop_notification_hide,
            browser_browsing_data_clear,
            browser_sidebar_navigate,
            browser_sidebar_open_file,
            browser_sidebar_set_bounds,
            browser_sidebar_set_visible,
            remote_control_mfa_requirement_read,
            mfa_info_read,
            remote_control_clients_list,
            remote_control_mfa_required_but_disabled_read,
            remote_task_list,
            remote_task_read,
            remote_task_turns_read,
            remote_task_turn_read,
            remote_task_turn_logs_read,
            remote_task_pr_create,
            remote_task_image_read,
            apply_patch,
            load_primary_runtime_dependencies,
            diagnose_primary_runtime_dependencies,
            install_primary_runtime,
            finish_primary_runtime_install,
            cancel_primary_runtime_install,
            primary_runtime_update_status,
            primary_runtime_update_run_now,
            reset_primary_runtime_dependencies,
            set_primary_runtime_install_release,
            sync_primary_runtime_shared_objects,
            list_apps,
            read_app_tools,
            read_app_tools_command,
            external_agent_import_detect,
            external_agent_import_import,
            external_agent_import_status,
            fast_mode_rollout_metrics,
            list_automations,
            list_automations_command,
            inbox_items,
            inbox_item_set_read_state,
            read_config,
            read_config_for_host,
            get_config_requirements_for_host,
            list_models_for_host,
            list_experimental_features,
            list_experimental_features_for_host,
            list_plugins,
            list_plugins_command,
            list_plugin_shares,
            list_plugin_shares_command,
            add_marketplace,
            add_marketplace_command,
            remove_marketplace,
            remove_marketplace_command,
            upgrade_marketplaces,
            upgrade_marketplaces_command,
            read_plugin,
            read_plugin_command,
            install_plugin,
            install_plugin_command,
            uninstall_plugin,
            uninstall_plugin_command,
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
            chronicle_permissions,
            read_computer_use_approvals_visibility,
            computer_use_app_approvals_visibility,
            read_computer_use_approvals,
            computer_use_app_approvals_read,
            remove_computer_use_approval,
            computer_use_app_approval_remove,
            computer_use_sound_mode_read,
            computer_use_sound_mode_write,
            chrome_extension_installed_read,
            chrome_extension_settings_open,
            request_microphone_permission,
            avatar_overlay_open,
            avatar_overlay_open_state_request,
            avatar_overlay_drag_start,
            avatar_overlay_drag_move,
            avatar_overlay_drag_end,
            avatar_overlay_drag_release,
            avatar_overlay_element_size_changed,
            avatar_overlay_pointer_interaction_changed,
            avatar_overlay_keyboard_interaction_changed,
            open_in_hotkey_window,
            hotkey_window_hotkey_state,
            hotkey_window_set_hotkey,
            hotkey_window_set_dev_hotkey_override,
            hotkey_window_enabled_changed,
            hotkey_window_home_pointer_interaction_changed,
            statsig_fetch_values,
            statsig_request,
            list_mcp_server_status,
            list_mcp_server_status_command,
            list_skills,
            list_skills_for_host,
            recommended_skills,
            install_recommended_skill,
            remove_skill,
            write_skill_config,
            write_skill_config_command,
            list_hooks_for_host,
            list_recent_threads,
            list_recent_threads_command,
            list_archived_threads,
            list_archived_threads_command,
            unsubscribe_thread_for_host,
            discard_conversation_from_cache,
            start_conversation,
            start_thread,
            fork_thread,
            fork_conversation_from_latest,
            archive_thread,
            archive_conversation_command,
            unarchive_thread,
            unarchive_conversation_command,
            set_thread_name,
            mark_conversation_as_unread,
            mark_conversation_as_read,
            set_thread_goal,
            set_thread_goal_status,
            clear_thread_goal,
            start_turn,
            start_turn_with_input,
            send_follow_up_message,
            start_review,
            steer_turn,
            interrupt_turn,
            set_experimental_feature_enablement,
            set_local_app_server_feature_enablement,
            reset_memories,
            reset_memories_for_host,
            respond_to_approval_request,
            respond_to_mcp_server_elicitation_request,
            respond_to_permissions_request_approval,
            respond_to_tool_request_user_input,
            read_thread,
            maybe_resume_conversation,
            rollback_thread,
            read_automation,
            automation_create_command,
            automation_update_command,
            automation_delete_command,
            automation_run_now_command,
            heartbeat_automation_thread_state_changed,
            get_global_state,
            get_global_state_command,
            get_command_keymap_state,
            login_api_key,
            login_api_key_command,
            login_api_key_for_host_command,
            login_mcp_server,
            login_mcp_server_command,
            login_chatgpt,
            login_chatgpt_command,
            login_chatgpt_device_code,
            login_chatgpt_device_code_command,
            login_chatgpt_for_host_command,
            cancel_login,
            logout,
            set_global_state,
            set_global_state_command,
            power_save_blocker_set,
            electron_set_window_mode,
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
            read_file_metadata,
            read_file_binary,
            compile_latex_artifact,
            open_file,
            open_in_browser,
            open_in_targets,
            set_preferred_app,
            gh_cli_status,
            gh_current_user,
            gh_pr_board,
            gh_pr_status,
            gh_pr_body,
            gh_pr_checks,
            gh_pr_comments,
            gh_pr_diff,
            gh_pr_file_content,
            gh_pr_comment,
            gh_pr_merge,
            gh_pr_update,
            git_branches_read,
            git_commit_dialog_read,
            git_checkout_branch,
            git_create_branch,
            git_commit_changes,
            generate_git_commit_message,
            git_origins,
            projectless_thread_cwd,
            finish_app_connect_oauth_callback,
            open_current_main_window,
            open_debug_window,
            open_in_main_window,
            open_in_new_window,
            debug_window_origin_conversation_changed,
            show_diff,
            show_plan_summary,
            show_settings,
            take_pending_debug_window_origin_conversation,
            take_pending_plan_summary,
            take_pending_window_route,
            update_diff_if_open,
            workspace_root_options,
            active_workspace_roots,
            paths_exist,
            add_new_workspace_root_option,
            create_new_workspace_root_option,
            pick_workspace_root_option,
            rename_workspace_root_option,
            update_workspace_root_options,
            set_active_workspace_root,
            clear_active_workspace_root,
            onboarding_skip_workspace,
            onboarding_pick_workspace_or_create_default,
            third_party_notices,
            search_workspace_files,
            list_workspace_directory_entries,
            read_workspace_file_metadata,
            read_workspace_file,
            read_workspace_file_binary,
            app_server_connection_state,
            get_shared_object_snapshot,
            discover_remote_ssh_connections,
            refresh_remote_connections,
            save_remote_project,
            save_codex_managed_remote_ssh_connections,
            set_remote_connection_auto_connect,
            upstream_local_environments,
            upstream_local_environment,
            upstream_local_environment_config,
            upstream_local_environment_config_save,
            generate_scratchpad_completion_summary,
            list_local_environments,
            read_local_environment_config,
            write_local_environment_config,
            terminal_shell_options,
            electron_set_badge_count,
            wsl_bash_availability,
            reload_mcp_server_config,
            codex_app_server_restart,
            codex_worktrees,
            worktree_delete,
            worktree_set_owner_thread,
            pending_worktree_create,
            pending_worktree_update_metadata,
            pending_worktree_retry,
            pending_worktree_cancel,
            pending_worktree_dismiss,
            electron_app_state_snapshot_response,
            set_review_pane_snapshot_metrics_for_host,
            electron_window_focus_request,
            view_focused
        ])
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            spawn_heartbeat_automation_scheduler(
                handle.clone(),
                auth_state.clone(),
                heartbeat_automation_scheduler_state.clone(),
            );
            spawn_app_state_snapshot_heartbeat(handle.clone(), app_state_snapshot_state.clone());
            let avatar_overlay_state = app.state::<AvatarOverlayState>();
            let main_window = handle.get_webview_window("main");
            let _ = avatar_overlay::restore_open_state(
                &handle,
                main_window.as_ref(),
                &avatar_overlay_state,
            );
            let ambient_background_state = app.state::<AmbientSuggestionsBackgroundRefreshState>();
            sync_ambient_suggestions_background_refresh_state(
                &handle,
                ambient_background_state.inner(),
            );
            let dictation_settings_state = app.state::<GlobalDictationSettingsState>();
            if let Err(err) = start_global_dictation_hotkey_runtime(
                handle.clone(),
                dictation_settings_state.inner(),
            ) {
                eprintln!("failed to start global dictation hotkey runtime: {err}");
            }
            if cfg!(target_os = "windows") && should_register_windows_context_menu() {
                let _ = register_windows_folder_context_menu();
                let _ = register_windows_protocol_handler();
            }
            tauri::async_runtime::spawn({
                let handle = handle.clone();
                async move {
                    let _ = auth_bridge::start(handle.clone()).await;
                    let _ = refresh_remote_connections(handle).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Codex App Replica");
}

#[tauri::command]
fn get_launch_context(state: tauri::State<'_, Arc<LaunchState>>) -> LaunchContext {
    LaunchContext {
        app_connect_oauth_callback_url: state
            .app_connect_oauth_callback_url
            .lock()
            .expect("launch state mutex poisoned")
            .clone(),
        open_project_path: state
            .open_project_path
            .lock()
            .expect("launch state mutex poisoned")
            .clone(),
    }
}

fn parse_launch_argument() -> Option<LaunchArgument> {
    let mut args = env::args_os().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--open-project" {
            return args
                .next()
                .map(PathBuf::from)
                .map(LaunchArgument::OpenProjectPath);
        }
        if let Some(callback_url) = parse_app_connect_oauth_callback_url(&arg.to_string_lossy()) {
            return Some(LaunchArgument::AppConnectOAuthCallbackUrl(callback_url));
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

fn register_windows_protocol_handler() -> Result<(), String> {
    let exe =
        env::current_exe().map_err(|err| format!("failed to resolve executable path: {err}"))?;
    let exe = exe
        .to_str()
        .ok_or_else(|| "executable path is not valid utf-8".to_string())?;
    let key = r"HKCU\Software\Classes\codex";
    let command = format!(r#""{exe}" "%1""#);

    run_reg(&["add", key, "/ve", "/d", "URL:Codex Protocol", "/f"])?;
    run_reg(&["add", key, "/v", "URL Protocol", "/d", "", "/f"])?;
    run_reg(&["add", key, "/v", "Icon", "/d", &format!("{exe},0"), "/f"])?;
    run_reg(&[
        "add",
        &format!(r"{key}\shell\open\command"),
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

fn parse_app_connect_oauth_callback_url(raw_value: &str) -> Option<String> {
    let trimmed = raw_value.trim();
    if !trimmed.starts_with("codex://") {
        return None;
    }

    let normalized = trimmed.replacen(
        "codex://app-connect-oauth-callback",
        "https://chatgpt.com/connector_platform_oauth_redirect",
        1,
    );
    if normalized == trimmed {
        return None;
    }
    Some(normalized)
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
