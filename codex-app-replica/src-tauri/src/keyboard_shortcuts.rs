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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandInventoryEntry {
    id: String,
    default_keybindings: Vec<String>,
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
    let commands = serde_json::from_str::<Vec<CommandInventoryEntry>>(COMMAND_INVENTORY_JSON)
        .map_err(|err| format!("failed to parse keyboard shortcut inventory: {err}"))?;
    commands
        .into_iter()
        .find(|command| command.id == command_id)
        .map(|command| command.default_keybindings)
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
