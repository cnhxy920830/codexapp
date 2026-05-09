use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const COMMAND_KEYMAP_STATE_FILE_NAME: &str = "command-keymap-state.json";
const COMMAND_INVENTORY_JSON: &str =
    include_str!("../../src/assets/keyboard-shortcuts/commandInventory.json");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandKeymapState {
    pub bindings: Vec<CommandKeybinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandKeybinding {
    pub command: String,
    pub key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CommandKeybindingLookup {
    pub has_binding: bool,
    pub hotkey: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlatformDefaultKeybindings {
    default: Option<Vec<String>>,
    #[serde(rename = "macOS")]
    mac_os: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandInventoryEntry {
    id: String,
    default_keybindings: Vec<String>,
    platform_default_keybindings: Option<PlatformDefaultKeybindings>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetCommandKeybindingParams {
    pub command_id: String,
    pub update: CommandKeybindingUpdate,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CommandKeybindingUpdate {
    Set {
        accelerator: String,
    },
    Append {
        accelerator: String,
    },
    Replace {
        previous_accelerator: String,
        accelerator: String,
    },
    Remove {
        accelerator: String,
    },
    Reset,
}

#[tauri::command]
pub fn get_command_keymap_state(app: AppHandle) -> Result<CommandKeymapState, String> {
    read_command_keymap_state(&app)
}

#[tauri::command]
pub fn set_command_keybinding(
    app: AppHandle,
    params: SetCommandKeybindingParams,
) -> Result<CommandKeymapState, String> {
    let mut state = read_command_keymap_state(&app)?;
    let default_keybindings = default_keybindings_for_command(&params.command_id)?;
    let current_bindings = state
        .bindings
        .iter()
        .filter(|binding| binding.command == params.command_id)
        .cloned()
        .collect::<Vec<_>>();

    let current_accelerator_list = current_accelerators(&current_bindings, &default_keybindings);
    let next_bindings = match params.update {
        CommandKeybindingUpdate::Set { accelerator } => {
            build_override_bindings(&params.command_id, &default_keybindings, vec![accelerator])
        }
        CommandKeybindingUpdate::Append { accelerator } => {
            let mut next_accelerators = current_accelerator_list;
            next_accelerators.push(accelerator);
            build_override_bindings(&params.command_id, &default_keybindings, next_accelerators)
        }
        CommandKeybindingUpdate::Replace {
            previous_accelerator,
            accelerator,
        } => {
            let mut replaced = false;
            let next_accelerators = current_accelerator_list
                .into_iter()
                .map(|current| {
                    if !replaced && current == previous_accelerator {
                        replaced = true;
                        accelerator.clone()
                    } else {
                        current
                    }
                })
                .collect::<Vec<_>>();

            if !replaced {
                return Err(format!(
                    "shortcut {previous_accelerator} is not assigned to {}",
                    params.command_id
                ));
            }

            build_override_bindings(&params.command_id, &default_keybindings, next_accelerators)
        }
        CommandKeybindingUpdate::Remove { accelerator } => {
            let next_accelerators = current_accelerator_list
                .into_iter()
                .filter(|current| current != &accelerator)
                .collect::<Vec<_>>();
            build_override_bindings(&params.command_id, &default_keybindings, next_accelerators)
        }
        CommandKeybindingUpdate::Reset => Vec::new(),
    };

    state
        .bindings
        .retain(|binding| binding.command != params.command_id);
    state.bindings.extend(next_bindings);
    write_command_keymap_state(&app, &state)?;
    Ok(state)
}

pub(crate) fn read_command_keybinding_lookup(
    app: &AppHandle,
    command_id: &str,
) -> Result<CommandKeybindingLookup, String> {
    let state = read_command_keymap_state(app)?;
    Ok(command_keybinding_lookup(command_id, &state))
}

fn read_command_keymap_state(app: &AppHandle) -> Result<CommandKeymapState, String> {
    let path = command_keymap_state_path(app)?;
    if !path.exists() {
        return Ok(CommandKeymapState {
            bindings: Vec::new(),
        });
    }

    let contents =
        fs::read_to_string(&path).map_err(|err| format!("failed to read {path:?}: {err}"))?;
    serde_json::from_str::<CommandKeymapState>(&contents)
        .map_err(|err| format!("failed to parse {path:?}: {err}"))
}

fn write_command_keymap_state(app: &AppHandle, state: &CommandKeymapState) -> Result<(), String> {
    let path = command_keymap_state_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("missing parent directory for {path:?}"))?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create settings directory {parent:?}: {err}"))?;
    let payload = serde_json::to_string_pretty(state)
        .map_err(|err| format!("failed to encode command keymap state json: {err}"))?;
    fs::write(&path, payload).map_err(|err| format!("failed to write {path:?}: {err}"))
}

fn command_keymap_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("failed to resolve app config dir: {err}"))?;
    path.push(COMMAND_KEYMAP_STATE_FILE_NAME);
    Ok(path)
}

fn default_keybindings_for_command(command_id: &str) -> Result<Vec<String>, String> {
    default_keybindings_for_command_from_inventory(command_id, COMMAND_INVENTORY_JSON)
}

fn command_keybinding_lookup(
    command_id: &str,
    state: &CommandKeymapState,
) -> CommandKeybindingLookup {
    match state
        .bindings
        .iter()
        .find(|binding| binding.command == command_id)
    {
        Some(binding) => CommandKeybindingLookup {
            has_binding: true,
            hotkey: binding.key.clone(),
        },
        None => CommandKeybindingLookup {
            has_binding: false,
            hotkey: None,
        },
    }
}

fn default_keybindings_for_command_from_inventory(
    command_id: &str,
    command_inventory_json: &str,
) -> Result<Vec<String>, String> {
    let commands = serde_json::from_str::<Vec<CommandInventoryEntry>>(command_inventory_json)
        .map_err(|err| format!("failed to parse keyboard shortcut inventory: {err}"))?;
    commands
        .into_iter()
        .find(|command| command.id == command_id)
        .map(|command| {
            if cfg!(target_os = "macos") {
                if let Some(mac_os_default_keybindings) =
                    command.platform_default_keybindings.as_ref().and_then(
                        |platform_default_keybindings| platform_default_keybindings.mac_os.clone(),
                    )
                {
                    return mac_os_default_keybindings;
                }
            } else if let Some(default_keybindings) =
                command.platform_default_keybindings.as_ref().and_then(
                    |platform_default_keybindings| platform_default_keybindings.default.clone(),
                )
            {
                return default_keybindings;
            }

            command.default_keybindings
        })
        .ok_or_else(|| format!("unsupported keyboard shortcut command: {command_id}"))
}

fn current_accelerators(
    current_bindings: &[CommandKeybinding],
    default_keybindings: &[String],
) -> Vec<String> {
    if current_bindings.is_empty() {
        return default_keybindings.to_vec();
    }
    if current_bindings.iter().any(|binding| binding.key.is_none()) {
        return Vec::new();
    }
    current_bindings
        .iter()
        .filter_map(|binding| binding.key.clone())
        .collect()
}

fn build_override_bindings(
    command_id: &str,
    default_keybindings: &[String],
    accelerators: Vec<String>,
) -> Vec<CommandKeybinding> {
    let normalized = normalize_accelerators(accelerators);
    if normalized.is_empty() {
        return if default_keybindings.is_empty() {
            Vec::new()
        } else {
            vec![CommandKeybinding {
                command: command_id.to_string(),
                key: None,
            }]
        };
    }

    if normalized == default_keybindings {
        return Vec::new();
    }

    normalized
        .into_iter()
        .map(|accelerator| CommandKeybinding {
            command: command_id.to_string(),
            key: Some(accelerator),
        })
        .collect()
}

fn normalize_accelerators(accelerators: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for accelerator in accelerators {
        let trimmed = accelerator.trim();
        if trimmed.is_empty()
            || normalized
                .iter()
                .any(|existing: &String| existing == trimmed)
        {
            continue;
        }
        normalized.push(trimmed.to_string());
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::{
        command_keybinding_lookup, default_keybindings_for_command_from_inventory,
        CommandKeybinding, CommandKeybindingLookup, CommandKeymapState, COMMAND_INVENTORY_JSON,
    };

    #[test]
    fn command_keybinding_lookup_reports_missing_binding() {
        assert_eq!(
            command_keybinding_lookup(
                "hotkeyWindow",
                &CommandKeymapState {
                    bindings: Vec::new(),
                },
            ),
            CommandKeybindingLookup {
                has_binding: false,
                hotkey: None,
            }
        );
    }

    #[test]
    fn command_keybinding_lookup_uses_first_matching_binding() {
        assert_eq!(
            command_keybinding_lookup(
                "hotkeyWindow",
                &CommandKeymapState {
                    bindings: vec![
                        CommandKeybinding {
                            command: "hotkeyWindow".to_string(),
                            key: Some("Ctrl+Alt+K".to_string()),
                        },
                        CommandKeybinding {
                            command: "hotkeyWindow".to_string(),
                            key: Some("Ctrl+Alt+L".to_string()),
                        },
                    ],
                },
            ),
            CommandKeybindingLookup {
                has_binding: true,
                hotkey: Some("Ctrl+Alt+K".to_string()),
            }
        );
    }

    #[test]
    fn command_keybinding_lookup_reports_cleared_binding() {
        assert_eq!(
            command_keybinding_lookup(
                "hotkeyWindow",
                &CommandKeymapState {
                    bindings: vec![CommandKeybinding {
                        command: "hotkeyWindow".to_string(),
                        key: None,
                    }],
                },
            ),
            CommandKeybindingLookup {
                has_binding: true,
                hotkey: None,
            }
        );
    }

    #[test]
    fn find_in_thread_uses_platform_specific_default_keybinding() {
        let expected = if cfg!(target_os = "macos") {
            vec!["Command+F".to_string()]
        } else {
            vec!["Ctrl+F".to_string()]
        };

        assert_eq!(
            expected,
            default_keybindings_for_command_from_inventory("findInThread", COMMAND_INVENTORY_JSON,)
                .unwrap()
        );
    }

    #[test]
    fn upstream_keyboard_shortcut_commands_are_supported() {
        assert_eq!(
            Vec::<String>::new(),
            default_keybindings_for_command_from_inventory(
                "openThreadInNewWindow",
                COMMAND_INVENTORY_JSON,
            )
            .unwrap()
        );
        assert_eq!(
            Vec::<String>::new(),
            default_keybindings_for_command_from_inventory(
                "globalDictationHold",
                COMMAND_INVENTORY_JSON,
            )
            .unwrap()
        );
    }
}
