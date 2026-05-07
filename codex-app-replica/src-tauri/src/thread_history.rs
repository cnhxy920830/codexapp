use std::collections::BTreeMap;

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
    HookPrompt {
        id: String,
        turn_id: String,
        fragments: Vec<HookPromptFragment>,
    },
    TodoList {
        id: String,
        turn_id: String,
        explanation: Option<String>,
        plan: Vec<TodoListStep>,
    },
    TurnDiff {
        id: String,
        turn_id: String,
        unified_diff: String,
    },
    PersonalityChanged {
        id: String,
        turn_id: String,
        personality: String,
    },
    ModelChanged {
        id: String,
        turn_id: String,
        from_model: String,
        to_model: String,
    },
    ModelRerouted {
        id: String,
        turn_id: String,
        from_model: String,
        to_model: String,
        reason: String,
    },
    ForkedFromConversation {
        id: String,
        turn_id: String,
        source_conversation_id: String,
        source_conversation_title: Option<String>,
    },
    RemoteTaskCreated {
        id: String,
        turn_id: String,
        task_id: String,
    },
    AutomaticApprovalReview {
        id: String,
        turn_id: String,
        status: String,
        risk_level: Option<String>,
        rationale: Option<String>,
    },
    AutoReviewInterruptionWarning {
        id: String,
        turn_id: String,
    },
    SystemError {
        id: String,
        turn_id: String,
        content: String,
    },
    StreamError {
        id: String,
        turn_id: String,
        content: String,
        additional_details: Option<String>,
    },
    Plan {
        id: String,
        turn_id: String,
        text: String,
    },
    Reasoning {
        id: String,
        turn_id: String,
        summary: Vec<String>,
        content: Vec<String>,
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
    McpToolCall {
        id: String,
        turn_id: String,
        server: String,
        tool: String,
        status: String,
        result_summary: Option<String>,
        error_message: Option<String>,
    },
    DynamicToolCall {
        id: String,
        turn_id: String,
        namespace: Option<String>,
        tool: String,
        status: String,
        result_summary: Option<String>,
        success: Option<bool>,
    },
    CollabAgentToolCall {
        id: String,
        turn_id: String,
        tool: String,
        status: String,
        sender_thread_id: String,
        receiver_thread_ids: Vec<String>,
        prompt: Option<String>,
        model: Option<String>,
        reasoning_effort: Option<String>,
        agents_states: BTreeMap<String, ThreadCollabAgentState>,
    },
    WebSearch {
        id: String,
        turn_id: String,
        query: String,
        action: Option<ThreadWebSearchAction>,
        completed: bool,
    },
    ImageView {
        id: String,
        turn_id: String,
        path: String,
    },
    ImageGeneration {
        id: String,
        turn_id: String,
        status: String,
        revised_prompt: Option<String>,
        result: String,
        saved_path: Option<String>,
    },
    ContextCompaction {
        id: String,
        turn_id: String,
        is_completed: bool,
    },
    EnteredReviewMode {
        id: String,
        turn_id: String,
        review: String,
    },
    ExitedReviewMode {
        id: String,
        turn_id: String,
        review: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadCollabAgentState {
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HookPromptFragment {
    pub text: String,
    pub hook_run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TodoListStep {
    pub step: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadWebSearchAction {
    Search {
        query: Option<String>,
        queries: Option<Vec<String>>,
    },
    OpenPage {
        url: Option<String>,
    },
    FindInPage {
        pattern: Option<String>,
        url: Option<String>,
    },
    Other {},
}

pub fn map_thread_item(
    turn_id: &str,
    value: &serde_json::Value,
    item_completed: Option<bool>,
) -> Option<ThreadConversationItem> {
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
        "hookPrompt" => {
            let id = value.get("id")?.as_str()?.to_string();
            let fragments = value
                .get("fragments")
                .and_then(serde_json::Value::as_array)
                .map(|fragments| {
                    fragments
                        .iter()
                        .filter_map(map_hook_prompt_fragment)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            if fragments.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::HookPrompt {
                id,
                turn_id: turn_id.to_string(),
                fragments,
            })
        }
        "todoList" => build_todo_list_item(
            turn_id,
            value
                .get("explanation")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
            value
                .get("plan")
                .and_then(serde_json::Value::as_array)
                .map(|plan| {
                    plan.iter()
                        .filter_map(map_todo_list_step)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
        ),
        "plan" => {
            let id = value.get("id")?.as_str()?.to_string();
            let text = value.get("text")?.as_str()?.trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::Plan {
                id,
                turn_id: turn_id.to_string(),
                text,
            })
        }
        "personalityChanged" => build_personality_changed_item(
            turn_id,
            value
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "personality-changed:{turn_id}:{}",
                        value
                            .get("personality")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                    )
                }),
            value
                .get("personality")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
        ),
        "modelChanged" => build_model_changed_item(
            turn_id,
            value
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "model-changed:{turn_id}:{}:{}",
                        value
                            .get("fromModel")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or(""),
                        value
                            .get("toModel")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                    )
                }),
            value
                .get("fromModel")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
            value
                .get("toModel")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
        ),
        "modelRerouted" => build_model_rerouted_item(
            turn_id,
            value
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "model-rerouted:{turn_id}:{}:{}:{}",
                        value
                            .get("fromModel")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or(""),
                        value
                            .get("toModel")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or(""),
                        value
                            .get("reason")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                    )
                }),
            value
                .get("fromModel")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
            value
                .get("toModel")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
            value
                .get("reason")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
        ),
        "forkedFromConversation" => build_forked_from_conversation_item(
            turn_id,
            value
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "forked-from-conversation:{turn_id}:{}",
                        value
                            .get("sourceConversationId")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                    )
                }),
            value
                .get("sourceConversationId")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
            value
                .get("sourceConversationTitle")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
        ),
        "remoteTaskCreated" => build_remote_task_created_item(
            turn_id,
            value
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "remote-task-created:{turn_id}:{}",
                        value
                            .get("taskId")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                    )
                }),
            value
                .get("taskId")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string(),
        ),
        "reasoning" => {
            let id = value.get("id")?.as_str()?.to_string();
            let summary = extract_string_array(value.get("summary"));
            let content = extract_string_array(value.get("content"));
            if summary.is_empty() && content.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::Reasoning {
                id,
                turn_id: turn_id.to_string(),
                summary,
                content,
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
        "mcpToolCall" => Some(ThreadConversationItem::McpToolCall {
            id: value.get("id")?.as_str()?.to_string(),
            turn_id: turn_id.to_string(),
            server: value.get("server")?.as_str()?.trim().to_string(),
            tool: value.get("tool")?.as_str()?.trim().to_string(),
            status: value.get("status")?.as_str()?.to_string(),
            result_summary: summarize_mcp_tool_result(value.get("result")),
            error_message: value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|message| !message.is_empty())
                .map(str::to_string),
        }),
        "dynamicToolCall" => Some(ThreadConversationItem::DynamicToolCall {
            id: value.get("id")?.as_str()?.to_string(),
            turn_id: turn_id.to_string(),
            namespace: value
                .get("namespace")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|namespace| !namespace.is_empty())
                .map(str::to_string),
            tool: value.get("tool")?.as_str()?.trim().to_string(),
            status: value.get("status")?.as_str()?.to_string(),
            result_summary: summarize_dynamic_tool_output(value.get("contentItems")),
            success: value.get("success").and_then(serde_json::Value::as_bool),
        }),
        "collabAgentToolCall" => {
            let id = value.get("id")?.as_str()?.to_string();
            let tool = value.get("tool")?.as_str()?.trim().to_string();
            let status = value.get("status")?.as_str()?.to_string();
            let sender_thread_id = value.get("senderThreadId")?.as_str()?.trim().to_string();
            let receiver_thread_ids = extract_string_array(value.get("receiverThreadIds"));
            let prompt = value
                .get("prompt")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|prompt| !prompt.is_empty())
                .map(str::to_string);
            let model = value
                .get("model")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|model| !model.is_empty())
                .map(str::to_string);
            let reasoning_effort = value
                .get("reasoningEffort")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|effort| !effort.is_empty())
                .map(str::to_string);
            let agents_states = extract_collab_agent_states(value.get("agentsStates"));
            if tool.is_empty()
                && status.is_empty()
                && sender_thread_id.is_empty()
                && receiver_thread_ids.is_empty()
                && prompt.is_none()
                && model.is_none()
                && reasoning_effort.is_none()
                && agents_states.is_empty()
            {
                return None;
            }
            Some(ThreadConversationItem::CollabAgentToolCall {
                id,
                turn_id: turn_id.to_string(),
                tool,
                status,
                sender_thread_id,
                receiver_thread_ids,
                prompt,
                model,
                reasoning_effort,
                agents_states,
            })
        }
        "webSearch" => {
            let id = value.get("id")?.as_str()?.to_string();
            let query = value.get("query")?.as_str()?.trim().to_string();
            if query.is_empty() {
                return None;
            }
            let action = value.get("action").and_then(|action| {
                let action_type = action.get("type").and_then(serde_json::Value::as_str)?;
                match action_type {
                    "search" => {
                        let query = action
                            .get("query")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|query| !query.is_empty())
                            .map(str::to_string);
                        let queries = extract_string_array(action.get("queries"));
                        Some(ThreadWebSearchAction::Search {
                            query,
                            queries: (!queries.is_empty()).then_some(queries),
                        })
                    }
                    "open_page" | "openPage" => Some(ThreadWebSearchAction::OpenPage {
                        url: action
                            .get("url")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|url| !url.is_empty())
                            .map(str::to_string),
                    }),
                    "find_in_page" | "findInPage" => Some(ThreadWebSearchAction::FindInPage {
                        pattern: action
                            .get("pattern")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|pattern| !pattern.is_empty())
                            .map(str::to_string),
                        url: action
                            .get("url")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|url| !url.is_empty())
                            .map(str::to_string),
                    }),
                    "other" => Some(ThreadWebSearchAction::Other {}),
                    _ => None,
                }
            });
            Some(ThreadConversationItem::WebSearch {
                id,
                turn_id: turn_id.to_string(),
                query,
                action,
                completed: item_completed.unwrap_or(true),
            })
        }
        "imageView" => {
            let id = value.get("id")?.as_str()?.to_string();
            let path = value.get("path")?.as_str()?.trim().to_string();
            if path.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::ImageView {
                id,
                turn_id: turn_id.to_string(),
                path,
            })
        }
        "imageGeneration" => {
            let id = value.get("id")?.as_str()?.to_string();
            let status = value.get("status")?.as_str()?.to_string();
            let result = value.get("result")?.as_str()?.trim().to_string();
            let revised_prompt = value
                .get("revisedPrompt")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|prompt| !prompt.is_empty())
                .map(str::to_string);
            let saved_path = value
                .get("savedPath")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|path| !path.is_empty())
                .map(str::to_string);
            if status.is_empty()
                && result.is_empty()
                && revised_prompt.is_none()
                && saved_path.is_none()
            {
                return None;
            }
            Some(ThreadConversationItem::ImageGeneration {
                id,
                turn_id: turn_id.to_string(),
                status,
                revised_prompt,
                result,
                saved_path,
            })
        }
        "contextCompaction" => Some(ThreadConversationItem::ContextCompaction {
            id: value.get("id")?.as_str()?.to_string(),
            turn_id: turn_id.to_string(),
            is_completed: item_completed.unwrap_or(true),
        }),
        "enteredReviewMode" => Some(ThreadConversationItem::EnteredReviewMode {
            id: format!("reviewMode:{}", value.get("id")?.as_str()?),
            turn_id: turn_id.to_string(),
            review: value.get("review")?.as_str()?.trim().to_string(),
        }),
        "exitedReviewMode" => Some(ThreadConversationItem::ExitedReviewMode {
            id: format!("reviewMode:{}", value.get("id")?.as_str()?),
            turn_id: turn_id.to_string(),
            review: value.get("review")?.as_str()?.trim().to_string(),
        }),
        _ => None,
    }
}

pub fn thread_item_id(item: &ThreadConversationItem) -> &str {
    match item {
        ThreadConversationItem::UserMessage { id, .. }
        | ThreadConversationItem::AgentMessage { id, .. }
        | ThreadConversationItem::HookPrompt { id, .. }
        | ThreadConversationItem::TodoList { id, .. }
        | ThreadConversationItem::TurnDiff { id, .. }
        | ThreadConversationItem::PersonalityChanged { id, .. }
        | ThreadConversationItem::ModelChanged { id, .. }
        | ThreadConversationItem::ModelRerouted { id, .. }
        | ThreadConversationItem::ForkedFromConversation { id, .. }
        | ThreadConversationItem::RemoteTaskCreated { id, .. }
        | ThreadConversationItem::AutomaticApprovalReview { id, .. }
        | ThreadConversationItem::AutoReviewInterruptionWarning { id, .. }
        | ThreadConversationItem::SystemError { id, .. }
        | ThreadConversationItem::StreamError { id, .. }
        | ThreadConversationItem::Plan { id, .. }
        | ThreadConversationItem::Reasoning { id, .. }
        | ThreadConversationItem::CommandExecution { id, .. }
        | ThreadConversationItem::FileChange { id, .. }
        | ThreadConversationItem::McpToolCall { id, .. }
        | ThreadConversationItem::DynamicToolCall { id, .. }
        | ThreadConversationItem::CollabAgentToolCall { id, .. }
        | ThreadConversationItem::WebSearch { id, .. }
        | ThreadConversationItem::ImageView { id, .. }
        | ThreadConversationItem::ImageGeneration { id, .. }
        | ThreadConversationItem::ContextCompaction { id, .. }
        | ThreadConversationItem::EnteredReviewMode { id, .. }
        | ThreadConversationItem::ExitedReviewMode { id, .. } => id,
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

pub fn append_plan_delta(
    item: &mut ThreadConversationItem,
    delta: &str,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::Plan { text, .. } = item else {
        return None;
    };
    text.push_str(delta);
    Some(item.clone())
}

pub fn ensure_reasoning_summary_part(
    item: &mut ThreadConversationItem,
    summary_index: usize,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::Reasoning { summary, .. } = item else {
        return None;
    };
    while summary.len() <= summary_index {
        summary.push(String::new());
    }
    Some(item.clone())
}

pub fn append_reasoning_summary_delta(
    item: &mut ThreadConversationItem,
    summary_index: usize,
    delta: &str,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::Reasoning { summary, .. } = item else {
        return None;
    };
    while summary.len() <= summary_index {
        summary.push(String::new());
    }
    summary[summary_index].push_str(delta);
    Some(item.clone())
}

pub fn append_reasoning_content_delta(
    item: &mut ThreadConversationItem,
    content_index: usize,
    delta: &str,
) -> Option<ThreadConversationItem> {
    let ThreadConversationItem::Reasoning { content, .. } = item else {
        return None;
    };
    while content.len() <= content_index {
        content.push(String::new());
    }
    content[content_index].push_str(delta);
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

pub fn build_todo_list_item(
    turn_id: &str,
    explanation: Option<String>,
    plan: Vec<TodoListStep>,
) -> Option<ThreadConversationItem> {
    let explanation = explanation
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if explanation.is_none() && plan.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::TodoList {
        id: format!("todo-list:{turn_id}"),
        turn_id: turn_id.to_string(),
        explanation,
        plan,
    })
}

pub fn build_turn_diff_item(turn_id: &str, unified_diff: String) -> ThreadConversationItem {
    ThreadConversationItem::TurnDiff {
        id: format!("turn-diff:{turn_id}"),
        turn_id: turn_id.to_string(),
        unified_diff,
    }
}

pub fn build_personality_changed_item(
    turn_id: &str,
    item_id: String,
    personality: String,
) -> Option<ThreadConversationItem> {
    let personality = personality.trim().to_string();
    if personality.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::PersonalityChanged {
        id: item_id,
        turn_id: turn_id.to_string(),
        personality,
    })
}

pub fn build_model_changed_item(
    turn_id: &str,
    item_id: String,
    from_model: String,
    to_model: String,
) -> Option<ThreadConversationItem> {
    let from_model = from_model.trim().to_string();
    let to_model = to_model.trim().to_string();
    if from_model.is_empty() && to_model.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::ModelChanged {
        id: item_id,
        turn_id: turn_id.to_string(),
        from_model,
        to_model,
    })
}

pub fn build_model_rerouted_item(
    turn_id: &str,
    item_id: String,
    from_model: String,
    to_model: String,
    reason: String,
) -> Option<ThreadConversationItem> {
    let from_model = from_model.trim().to_string();
    let to_model = to_model.trim().to_string();
    let reason = reason.trim().to_string();
    if from_model.is_empty() && to_model.is_empty() && reason.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::ModelRerouted {
        id: item_id,
        turn_id: turn_id.to_string(),
        from_model,
        to_model,
        reason,
    })
}

pub fn build_forked_from_conversation_item(
    turn_id: &str,
    item_id: String,
    source_conversation_id: String,
    source_conversation_title: Option<String>,
) -> Option<ThreadConversationItem> {
    let source_conversation_id = source_conversation_id.trim().to_string();
    let source_conversation_title = source_conversation_title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if source_conversation_id.is_empty() && source_conversation_title.is_none() {
        return None;
    }
    Some(ThreadConversationItem::ForkedFromConversation {
        id: item_id,
        turn_id: turn_id.to_string(),
        source_conversation_id,
        source_conversation_title,
    })
}

pub fn build_remote_task_created_item(
    turn_id: &str,
    item_id: String,
    task_id: String,
) -> Option<ThreadConversationItem> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::RemoteTaskCreated {
        id: item_id,
        turn_id: turn_id.to_string(),
        task_id,
    })
}

pub fn build_automatic_approval_review_item(
    turn_id: &str,
    item_id: String,
    status: String,
    risk_level: Option<String>,
    rationale: Option<String>,
) -> Option<ThreadConversationItem> {
    let status = status.trim().to_string();
    let risk_level = risk_level
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let rationale = rationale
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if status.is_empty() && risk_level.is_none() && rationale.is_none() {
        return None;
    }
    Some(ThreadConversationItem::AutomaticApprovalReview {
        id: item_id,
        turn_id: turn_id.to_string(),
        status,
        risk_level,
        rationale,
    })
}

pub fn build_auto_review_interruption_warning_item(
    turn_id: &str,
    item_id: String,
) -> ThreadConversationItem {
    ThreadConversationItem::AutoReviewInterruptionWarning {
        id: item_id,
        turn_id: turn_id.to_string(),
    }
}

pub fn build_system_error_item(
    turn_id: &str,
    item_id: String,
    content: String,
) -> Option<ThreadConversationItem> {
    let content = content.trim().to_string();
    if content.is_empty() {
        return None;
    }
    Some(ThreadConversationItem::SystemError {
        id: item_id,
        turn_id: turn_id.to_string(),
        content,
    })
}

pub fn build_stream_error_item(
    turn_id: &str,
    item_id: String,
    content: String,
    additional_details: Option<String>,
) -> Option<ThreadConversationItem> {
    let content = content.trim().to_string();
    let additional_details = additional_details
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if content.is_empty() && additional_details.is_none() {
        return None;
    }
    Some(ThreadConversationItem::StreamError {
        id: item_id,
        turn_id: turn_id.to_string(),
        content,
        additional_details,
    })
}

pub fn map_todo_list_step(value: &serde_json::Value) -> Option<TodoListStep> {
    let step = value.get("step")?.as_str()?.trim().to_string();
    if step.is_empty() {
        return None;
    }
    let status = normalize_todo_list_status(
        value
            .get("status")
            .and_then(serde_json::Value::as_str)
            .map(str::trim),
    );
    Some(TodoListStep { step, status })
}

fn map_hook_prompt_fragment(value: &serde_json::Value) -> Option<HookPromptFragment> {
    let text = value.get("text")?.as_str()?.trim().to_string();
    let hook_run_id = value.get("hookRunId")?.as_str()?.trim().to_string();
    if text.is_empty() && hook_run_id.is_empty() {
        return None;
    }
    Some(HookPromptFragment { text, hook_run_id })
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

fn extract_string_array(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn extract_collab_agent_states(
    value: Option<&serde_json::Value>,
) -> BTreeMap<String, ThreadCollabAgentState> {
    value
        .and_then(serde_json::Value::as_object)
        .map(|states| {
            states
                .iter()
                .filter_map(|(thread_id, state)| {
                    let status = state.get("status")?.as_str()?.trim().to_string();
                    if status.is_empty() {
                        return None;
                    }
                    let message = state
                        .get("message")
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|message| !message.is_empty())
                        .map(str::to_string);
                    Some((
                        thread_id.clone(),
                        ThreadCollabAgentState { status, message },
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn summarize_mcp_tool_result(value: Option<&serde_json::Value>) -> Option<String> {
    let result = value?;
    let content_items = result.get("content")?.as_array()?;
    let summary = content_items
        .iter()
        .filter_map(extract_text_from_json)
        .find(|text| !text.is_empty())?;
    Some(summary)
}

fn extract_text_from_json(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        serde_json::Value::Array(items) => items.iter().find_map(extract_text_from_json),
        serde_json::Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(serde_json::Value::as_str) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
            map.values().find_map(extract_text_from_json)
        }
        _ => None,
    }
}

fn summarize_dynamic_tool_output(value: Option<&serde_json::Value>) -> Option<String> {
    let items = value?.as_array()?;
    items.iter().find_map(|item| {
        let item_type = item.get("type").and_then(serde_json::Value::as_str)?;
        if item_type != "inputText" {
            return None;
        }
        let text = item.get("text").and_then(serde_json::Value::as_str)?.trim();
        if text.is_empty() {
            return None;
        }
        Some(text.to_string())
    })
}

fn normalize_todo_list_status(status: Option<&str>) -> String {
    match status {
        Some("completed") => "completed".to_string(),
        Some("inProgress") | Some("in_progress") => "in_progress".to_string(),
        Some("pending") => "pending".to_string(),
        Some(value) if !value.is_empty() => value.to_string(),
        _ => "pending".to_string(),
    }
}
