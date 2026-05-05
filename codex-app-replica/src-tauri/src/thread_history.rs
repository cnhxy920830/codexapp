use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversation {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub items: Vec<ThreadConversationItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadConversationItem {
    UserMessage {
        id: String,
        turn_id: String,
        role: String,
        text: String,
    },
    AgentMessage {
        id: String,
        turn_id: String,
        role: String,
        text: String,
    },
    CommandExecution {
        id: String,
        turn_id: String,
        command: String,
        cwd: String,
        status: String,
        command_actions: Vec<ThreadCommandAction>,
        aggregated_output: Option<String>,
        exit_code: Option<i32>,
        duration_ms: Option<i64>,
    },
    FileChange {
        id: String,
        turn_id: String,
        status: String,
        changes: Vec<FileChangeSummary>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadCommandAction {
    Read {
        command: String,
        name: String,
        path: String,
    },
    ListFiles {
        command: String,
        path: Option<String>,
    },
    Search {
        command: String,
        query: Option<String>,
        path: Option<String>,
    },
    Unknown {
        command: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeSummary {
    pub path: String,
    pub kind: String,
    pub diff: Option<String>,
    pub move_path: Option<String>,
}

pub fn map_thread_item(turn_id: &str, value: &serde_json::Value) -> Option<ThreadConversationItem> {
    let item_type = value.get("type")?.as_str()?;
    match item_type {
        "userMessage" => {
            let id = value.get("id")?.as_str()?.to_string();
            let text = value
                .get("content")
                .and_then(serde_json::Value::as_array)
                .map(|content| extract_user_text(content.as_slice()))
                .unwrap_or_default()
                .trim()
                .to_string();
            if text.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::UserMessage {
                id,
                turn_id: turn_id.to_string(),
                role: "user".to_string(),
                text,
            })
        }
        "agentMessage" => {
            let id = value.get("id")?.as_str()?.to_string();
            let text = value.get("text")?.as_str()?.trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::AgentMessage {
                id,
                turn_id: turn_id.to_string(),
                role: "assistant".to_string(),
                text,
            })
        }
        "commandExecution" => Some(ThreadConversationItem::CommandExecution {
            id: value.get("id")?.as_str()?.to_string(),
            turn_id: turn_id.to_string(),
            command: value.get("command")?.as_str()?.to_string(),
            cwd: value.get("cwd")?.as_str()?.to_string(),
            status: value.get("status")?.as_str()?.to_string(),
            command_actions: value
                .get("commandActions")
                .and_then(serde_json::Value::as_array)
                .map(|actions| {
                    actions
                        .iter()
                        .filter_map(map_command_action)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
            aggregated_output: value
                .get("aggregatedOutput")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
            exit_code: value
                .get("exitCode")
                .and_then(serde_json::Value::as_i64)
                .and_then(|value| i32::try_from(value).ok()),
            duration_ms: value.get("durationMs").and_then(serde_json::Value::as_i64),
        }),
        "fileChange" => Some(ThreadConversationItem::FileChange {
            id: value.get("id")?.as_str()?.to_string(),
            turn_id: turn_id.to_string(),
            status: value.get("status")?.as_str()?.to_string(),
            changes: value
                .get("changes")
                .and_then(serde_json::Value::as_array)
                .map(|changes| {
                    changes
                        .iter()
                        .filter_map(map_file_change_summary)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
        }),
        _ => None,
    }
}

pub fn thread_item_id(item: &ThreadConversationItem) -> &str {
    match item {
        ThreadConversationItem::UserMessage { id, .. }
        | ThreadConversationItem::AgentMessage { id, .. }
        | ThreadConversationItem::CommandExecution { id, .. }
        | ThreadConversationItem::FileChange { id, .. } => id,
    }
}

pub fn map_file_change_summary(value: &serde_json::Value) -> Option<FileChangeSummary> {
    let kind = value.get("kind")?.get("type")?.as_str()?;
    let move_path = value
        .get("kind")
        .and_then(|kind| kind.get("movePath"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    Some(FileChangeSummary {
        path: value.get("path")?.as_str()?.to_string(),
        kind: kind.to_string(),
        diff: value
            .get("diff")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        move_path,
    })
}

pub fn append_agent_message_delta(
    item: &mut ThreadConversationItem,
    delta: &str,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::AgentMessage { text, .. } = item else {
        return None;
    };
    text.push_str(delta);
    Some(item.clone())
}

pub fn append_command_execution_output_delta(
    item: &mut ThreadConversationItem,
    delta: &str,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::CommandExecution {
        aggregated_output, ..
    } = item
    else {
        return None;
    };
    match aggregated_output {
        Some(output) => output.push_str(delta),
        None => *aggregated_output = Some(delta.to_string()),
    }
    Some(item.clone())
}

pub fn replace_file_change_changes(
    item: &mut ThreadConversationItem,
    changes: Vec<FileChangeSummary>,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::FileChange {
        changes: current_changes,
        ..
    } = item
    else {
        return None;
    };
    *current_changes = changes;
    Some(item.clone())
}

fn map_command_action(value: &serde_json::Value) -> Option<ThreadCommandAction> {
    let action_type = value.get("type")?.as_str()?;
    match action_type {
        "read" => Some(ThreadCommandAction::Read {
            command: value.get("command")?.as_str()?.to_string(),
            name: value.get("name")?.as_str()?.to_string(),
            path: value.get("path")?.as_str()?.to_string(),
        }),
        "listFiles" => Some(ThreadCommandAction::ListFiles {
            command: value.get("command")?.as_str()?.to_string(),
            path: value
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
        }),
        "search" => Some(ThreadCommandAction::Search {
            command: value.get("command")?.as_str()?.to_string(),
            query: value
                .get("query")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
            path: value
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
        }),
        "unknown" => Some(ThreadCommandAction::Unknown {
            command: value.get("command")?.as_str()?.to_string(),
        }),
        _ => None,
    }
}

fn extract_user_text(content: &[serde_json::Value]) -> String {
    content
        .iter()
        .filter_map(|item| {
            let item_type = item.get("type")?.as_str()?;
            if item_type != "text" {
                return None;
            }
            item.get("text")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .collect::<Vec<_>>()
        .join("\n")
}
