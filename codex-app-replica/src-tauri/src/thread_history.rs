use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadHistorySource {
    pub parent_thread_id: Option<String>,
    pub depth: Option<i64>,
    pub agent_nickname: Option<String>,
    pub agent_role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversation {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub host_id: Option<String>,
    pub source: Option<ThreadHistorySource>,
    pub has_unread_turn: bool,
    pub thread_runtime_status: Option<ThreadHistoryStatus>,
    pub latest_collaboration_mode: Option<String>,
    pub latest_token_usage_info: Option<ThreadConversationTokenUsageInfo>,
    pub thread_goal: Option<ThreadConversationGoal>,
    pub turns: Vec<ThreadConversationTurn>,
    pub turn_timings: Vec<ThreadConversationTurnTiming>,
    pub items: Vec<ThreadConversationItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadHistoryStatus {
    NotLoaded,
    Idle,
    SystemError,
    #[serde(rename_all = "camelCase")]
    Active {
        active_flags: Vec<ThreadHistoryActiveFlag>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThreadHistoryActiveFlag {
    WaitingOnApproval,
    WaitingOnUserInput,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationGoal {
    pub thread_id: String,
    pub objective: String,
    pub status: String,
    pub token_budget: Option<i64>,
    pub tokens_used: i64,
    pub time_used_seconds: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationTokenUsageBreakdown {
    pub total_tokens: i64,
    pub input_tokens: i64,
    pub cached_input_tokens: i64,
    pub output_tokens: i64,
    pub reasoning_output_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationTokenUsageInfo {
    pub total: ThreadConversationTokenUsageBreakdown,
    pub last: ThreadConversationTokenUsageBreakdown,
    pub model_context_window: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationTurn {
    pub id: String,
    pub status: String,
    pub input: Vec<ThreadConversationUserInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationTurnTiming {
    pub turn_id: String,
    pub status: String,
    pub turn_started_at_ms: Option<i64>,
    pub final_assistant_started_at_ms: Option<i64>,
    pub first_turn_work_item_started_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum ThreadConversationJsonRpcId {
    Integer(i64),
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThreadConversationItem {
    UserMessage {
        id: String,
        turn_id: String,
        role: String,
        text: String,
        completed: bool,
        images: Vec<String>,
        attachments: Vec<ThreadConversationUserAttachment>,
        comments: Vec<ThreadConversationUserComment>,
        goal: bool,
        references_prior_conversation: bool,
        pull_request_merge_task_number: Option<u32>,
        review_mode: bool,
        pull_request_fix_mode: bool,
        auto_resolve_sync: bool,
        pull_request_check_count: Option<u32>,
    },
    AgentMessage {
        id: String,
        turn_id: String,
        role: String,
        text: String,
        completed: bool,
    },
    Hook {
        id: String,
        turn_id: String,
        event_name: String,
        status: String,
        status_message: Option<String>,
        source_path: Option<String>,
        started_at: Option<i64>,
        completed_at: Option<i64>,
        duration_ms: Option<i64>,
        entries: Vec<ThreadConversationHookOutputEntry>,
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
        arguments: serde_json::Value,
        result: Option<serde_json::Value>,
        error: Option<serde_json::Value>,
        duration_ms: Option<i64>,
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
        arguments: Option<serde_json::Value>,
        content_items: Vec<serde_json::Value>,
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
        source: String,
    },
    PlanImplementation {
        id: String,
        turn_id: String,
        plan_content: String,
        is_completed: bool,
    },
    UserInputResponse {
        id: String,
        turn_id: String,
        request_id: Option<ThreadConversationJsonRpcId>,
        questions_and_answers: Vec<ThreadConversationQuestionAndAnswer>,
        completed: bool,
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
pub enum ThreadConversationUserInput {
    Text {
        text: String,
        text_elements: Vec<ThreadConversationTextElement>,
    },
    Image {
        url: String,
    },
    LocalImage {
        path: String,
    },
    Skill {
        name: String,
        path: String,
    },
    Mention {
        name: String,
        path: String,
    },
    Comment {
        path: String,
        body: String,
        content: Vec<ThreadConversationUserCommentContent>,
        position: Option<ThreadConversationUserInputCommentPosition>,
        origin: Option<String>,
        local_pdf_context: Option<ThreadConversationUserCommentLocalPdfContext>,
        local_pdf_comment_metadata: Option<ThreadConversationUserCommentLocalPdfCommentMetadata>,
        local_pdf_screenshot: Option<ThreadConversationUserCommentLocalPdfScreenshot>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationTextElement {
    pub byte_range: ThreadConversationByteRange,
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationByteRange {
    pub start: usize,
    pub end: usize,
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
pub struct ThreadConversationHookOutputEntry {
    pub kind: String,
    pub text: String,
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
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationQuestionAndAnswer {
    pub id: String,
    pub header: String,
    pub question: String,
    pub answers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserAttachment {
    pub label: String,
    pub path: String,
    pub fs_path: Option<String>,
    pub start_line: Option<i64>,
    pub end_line: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserComment {
    pub path: String,
    pub line_range: Option<String>,
    pub body: String,
    pub content: Vec<ThreadConversationUserCommentContent>,
    pub position: Option<ThreadConversationUserCommentPosition>,
    pub origin: Option<String>,
    pub local_pdf_context: Option<ThreadConversationUserCommentLocalPdfContext>,
    pub local_pdf_comment_metadata: Option<ThreadConversationUserCommentLocalPdfCommentMetadata>,
    pub local_pdf_screenshot: Option<ThreadConversationUserCommentLocalPdfScreenshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserCommentContent {
    pub content_type: String,
    pub text: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserCommentPosition {
    pub path: String,
    pub line: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserInputCommentPosition {
    pub side: Option<String>,
    pub path: String,
    pub line: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationPdfPoint {
    pub x: i64,
    pub y: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationPdfRect {
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationPdfSize {
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserCommentLocalPdfContext {
    pub page_count: i64,
    pub page_number: i64,
    pub path: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserCommentLocalPdfCommentMetadata {
    pub kind: String,
    pub page_point: Option<ThreadConversationPdfPoint>,
    pub page_rect: Option<ThreadConversationPdfRect>,
    pub page_size: ThreadConversationPdfSize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadConversationUserCommentLocalPdfScreenshot {
    pub comment_id: String,
    pub data_url: String,
    pub width: i64,
    pub height: i64,
    pub page_number: i64,
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
            let content = value
                .get("content")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default();
            let raw_text = extract_raw_user_text(content.as_slice());
            let text = extract_user_visible_text(&raw_text);
            let images = extract_user_images(content.as_slice());
            let attachments = extract_user_attachments(value.get("attachments"));
            let comments = extract_user_comments(value.get("commentAttachments"), &raw_text);
            let goal = extract_bool(value.get("goal")).unwrap_or(false);
            let review_mode = has_user_message_heading(&raw_text, USER_MESSAGE_REVIEW_MODE_HEADING);
            let pull_request_fix_mode =
                has_user_message_heading(&raw_text, USER_MESSAGE_PULL_REQUEST_FIX_HEADING);
            let auto_resolve_sync =
                has_user_message_heading(&raw_text, USER_MESSAGE_AUTO_RESOLVE_MERGE_HEADING);
            let references_prior_conversation = !review_mode
                && !pull_request_fix_mode
                && raw_text.contains(USER_MESSAGE_PRIOR_CONVERSATION_HEADING);
            let pull_request_merge_task_number =
                extract_u32(value.get("pullRequestMergeTaskNumber"))
                    .or_else(|| extract_u32(value.get("pullRequestNumber")));
            let pull_request_check_count = extract_pull_request_check_count(&raw_text);
            if text.is_empty() && images.is_empty() && attachments.is_empty() && comments.is_empty()
            {
                return None;
            }
            Some(ThreadConversationItem::UserMessage {
                id,
                turn_id: turn_id.to_string(),
                role: "user".to_string(),
                text,
                completed: item_completed.unwrap_or(true),
                images,
                attachments,
                comments,
                goal,
                references_prior_conversation,
                pull_request_merge_task_number,
                review_mode,
                pull_request_fix_mode,
                auto_resolve_sync,
                pull_request_check_count,
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
                completed: item_completed.unwrap_or(true),
            })
        }
        "hook" => build_hook_item(turn_id, value),
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
        "planImplementation" => {
            let id = value.get("id")?.as_str()?.to_string();
            let plan_content = value
                .get("planContent")
                .and_then(serde_json::Value::as_str)?
                .trim()
                .to_string();
            if plan_content.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::PlanImplementation {
                id,
                turn_id: turn_id.to_string(),
                plan_content,
                is_completed: value
                    .get("isCompleted")
                    .and_then(serde_json::Value::as_bool)
                    .or(item_completed)
                    .unwrap_or(true),
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
            arguments: value
                .get("arguments")
                .cloned()
                .unwrap_or(serde_json::Value::Null),
            result: value.get("result").cloned(),
            error: value.get("error").cloned(),
            duration_ms: value.get("durationMs").and_then(serde_json::Value::as_i64),
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
            arguments: value.get("arguments").cloned(),
            content_items: value
                .get("contentItems")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default(),
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
            source: value
                .get("source")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|source| !source.is_empty())
                .unwrap_or("automatic")
                .to_string(),
        }),
        "userInputResponse" => {
            let id = value.get("id")?.as_str()?.to_string();
            let questions_and_answers = value
                .get("questions")
                .and_then(serde_json::Value::as_array)
                .map(|questions| {
                    questions
                        .iter()
                        .filter_map(|question| map_user_input_question_and_answer(question, value))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            if questions_and_answers.is_empty() {
                return None;
            }
            Some(ThreadConversationItem::UserInputResponse {
                id,
                turn_id: turn_id.to_string(),
                request_id: value.get("requestId").cloned().and_then(|request_id| {
                    serde_json::from_value::<ThreadConversationJsonRpcId>(request_id).ok()
                }),
                questions_and_answers,
                completed: value
                    .get("completed")
                    .and_then(serde_json::Value::as_bool)
                    .or(item_completed)
                    .unwrap_or(true),
            })
        }
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

pub fn map_turn_input(value: &[serde_json::Value]) -> Vec<ThreadConversationUserInput> {
    value.iter().filter_map(map_user_input_item).collect()
}

pub fn thread_item_id(item: &ThreadConversationItem) -> &str {
    match item {
        ThreadConversationItem::UserMessage { id, .. }
        | ThreadConversationItem::AgentMessage { id, .. }
        | ThreadConversationItem::Hook { id, .. }
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
        | ThreadConversationItem::PlanImplementation { id, .. }
        | ThreadConversationItem::UserInputResponse { id, .. }
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

pub fn build_hook_item(turn_id: &str, value: &serde_json::Value) -> Option<ThreadConversationItem> {
    let id = value.get("id")?.as_str()?.trim().to_string();
    let event_name = value.get("eventName")?.as_str()?.trim().to_string();
    let status = value.get("status")?.as_str()?.trim().to_string();
    if id.is_empty() || event_name.is_empty() || status.is_empty() {
        return None;
    }

    let status_message = value
        .get("statusMessage")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string);
    let source_path = value
        .get("sourcePath")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(str::to_string);
    let entries = value
        .get("entries")
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(map_hook_output_entry)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(ThreadConversationItem::Hook {
        id,
        turn_id: turn_id.to_string(),
        event_name,
        status,
        status_message,
        source_path,
        started_at: value.get("startedAt").and_then(serde_json::Value::as_i64),
        completed_at: value.get("completedAt").and_then(serde_json::Value::as_i64),
        duration_ms: value.get("durationMs").and_then(serde_json::Value::as_i64),
        entries,
    })
}

fn map_hook_output_entry(value: &serde_json::Value) -> Option<ThreadConversationHookOutputEntry> {
    let kind = value.get("kind")?.as_str()?.trim().to_string();
    let text = value
        .get("text")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    if kind.is_empty() && text.is_empty() {
        return None;
    }
    Some(ThreadConversationHookOutputEntry { kind, text })
}

fn map_hook_prompt_fragment(value: &serde_json::Value) -> Option<HookPromptFragment> {
    let text = value.get("text")?.as_str()?.trim().to_string();
    let hook_run_id = value.get("hookRunId")?.as_str()?.trim().to_string();
    if text.is_empty() && hook_run_id.is_empty() {
        return None;
    }
    Some(HookPromptFragment { text, hook_run_id })
}

const USER_MESSAGE_REVIEW_MODE_HEADING: &str = "## Code review guidelines:";
const USER_MESSAGE_PULL_REQUEST_FIX_HEADING: &str = "## Pull request fix:";
const USER_MESSAGE_AUTO_RESOLVE_MERGE_HEADING: &str = "## Auto resolve merge:";
const USER_MESSAGE_PRIOR_CONVERSATION_HEADING: &str = "## Prior conversation with Codex:";
const USER_MESSAGE_REQUEST_HEADING: &str = "## My request for Codex:";
const USER_MESSAGE_FAILING_PR_CHECKS_HEADING: &str = "# Failing PR checks:";

fn extract_raw_user_text(content: &[serde_json::Value]) -> String {
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

fn extract_user_visible_text(raw_text: &str) -> String {
    let trimmed = raw_text.trim();
    let last_section = trimmed
        .rsplit(USER_MESSAGE_REQUEST_HEADING)
        .next()
        .unwrap_or(trimmed)
        .trim();
    if last_section.is_empty() {
        trimmed.to_string()
    } else {
        last_section.to_string()
    }
}

fn has_user_message_heading(raw_text: &str, heading: &str) -> bool {
    let trimmed = raw_text.trim();
    let prefix = trimmed
        .find(USER_MESSAGE_REQUEST_HEADING)
        .map_or(trimmed, |index| &trimmed[..index]);
    prefix.contains(heading)
}

fn extract_pull_request_check_count(raw_text: &str) -> Option<u32> {
    let start = raw_text.find(USER_MESSAGE_FAILING_PR_CHECKS_HEADING)?;
    let after_heading = &raw_text[start + USER_MESSAGE_FAILING_PR_CHECKS_HEADING.len()..];
    let before_request = after_heading
        .find(USER_MESSAGE_REQUEST_HEADING)
        .map_or(after_heading, |index| &after_heading[..index]);
    let count = before_request
        .lines()
        .filter(|line| line.trim_start().starts_with("## Check "))
        .count();
    u32::try_from(count).ok().filter(|count| *count > 0)
}

fn extract_user_images(content: &[serde_json::Value]) -> Vec<String> {
    content
        .iter()
        .filter_map(|item| {
            let item_type = item.get("type")?.as_str()?;
            match item_type {
                "image" => item
                    .get("url")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                "localImage" => item
                    .get("path")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                _ => None,
            }
        })
        .collect()
}

fn extract_user_attachments(
    value: Option<&serde_json::Value>,
) -> Vec<ThreadConversationUserAttachment> {
    value
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let label = item
                        .get("label")
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)?;
                    let fs_path = item
                        .get("fsPath")
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string);
                    let path = fs_path.clone().or_else(|| {
                        item.get("path")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                            .map(str::to_string)
                    })?;
                    Some(ThreadConversationUserAttachment {
                        label,
                        path,
                        fs_path,
                        start_line: extract_integer(item.get("startLine")),
                        end_line: extract_integer(item.get("endLine")),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn map_user_input_item(value: &serde_json::Value) -> Option<ThreadConversationUserInput> {
    let item_type = value.get("type")?.as_str()?;
    match item_type {
        "text" => Some(ThreadConversationUserInput::Text {
            text: value.get("text")?.as_str()?.to_string(),
            text_elements: value
                .get("textElements")
                .and_then(serde_json::Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(map_text_element)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
        }),
        "image" => Some(ThreadConversationUserInput::Image {
            url: value
                .get("url")
                .or_else(|| value.get("imageUrl"))?
                .as_str()?
                .to_string(),
        }),
        "localImage" => Some(ThreadConversationUserInput::LocalImage {
            path: value.get("path")?.as_str()?.to_string(),
        }),
        "skill" => Some(ThreadConversationUserInput::Skill {
            name: value.get("name")?.as_str()?.to_string(),
            path: value.get("path")?.as_str()?.to_string(),
        }),
        "mention" => Some(ThreadConversationUserInput::Mention {
            name: value.get("name")?.as_str()?.to_string(),
            path: value.get("path")?.as_str()?.to_string(),
        }),
        "comment" => map_user_input_comment(value),
        _ => None,
    }
}

fn map_text_element(value: &serde_json::Value) -> Option<ThreadConversationTextElement> {
    let byte_range = value.get("byteRange")?;
    let start = byte_range.get("start")?.as_u64()? as usize;
    let end = byte_range.get("end")?.as_u64()? as usize;
    Some(ThreadConversationTextElement {
        byte_range: ThreadConversationByteRange { start, end },
        placeholder: value
            .get("placeholder")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
    })
}

fn map_user_input_comment(value: &serde_json::Value) -> Option<ThreadConversationUserInput> {
    let path = value
        .get("path")
        .or_else(|| {
            value
                .get("position")
                .and_then(|position| position.get("path"))
        })
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;
    let body = value
        .get("body")
        .and_then(extract_text_from_json)
        .unwrap_or_default();
    let content = extract_user_comment_content(value, &body);
    let position = extract_user_input_comment_position(
        value,
        &path,
        extract_comment_line_range(value).as_deref(),
    );
    if body.is_empty() && content.is_empty() {
        return None;
    }
    Some(ThreadConversationUserInput::Comment {
        path,
        body,
        content,
        position,
        origin: extract_user_comment_origin(value),
        local_pdf_context: extract_local_pdf_context(value),
        local_pdf_comment_metadata: extract_local_pdf_comment_metadata(value),
        local_pdf_screenshot: extract_local_pdf_screenshot(value),
    })
}

fn extract_user_comments(
    value: Option<&serde_json::Value>,
    raw_text: &str,
) -> Vec<ThreadConversationUserComment> {
    if let Some(comments) = extract_user_comment_attachments(value) {
        return comments;
    }

    extract_user_comments_from_raw_text(raw_text)
}

fn extract_user_comment_attachments(
    value: Option<&serde_json::Value>,
) -> Option<Vec<ThreadConversationUserComment>> {
    value.and_then(serde_json::Value::as_array).map(|items| {
        items
            .iter()
            .filter_map(|item| {
                let path = item
                    .get("position")
                    .and_then(|position| position.get("path"))
                    .or_else(|| item.get("path"))
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)?;
                let body = extract_text_from_json(item.get("body")?)?;
                let line_range = extract_comment_line_range(item);
                let content = extract_user_comment_content(item, &body);
                let position = extract_user_comment_position(item, &path, line_range.as_deref());
                Some(ThreadConversationUserComment {
                    path,
                    line_range,
                    body,
                    content,
                    position,
                    origin: extract_user_comment_origin(item),
                    local_pdf_context: extract_local_pdf_context(item),
                    local_pdf_comment_metadata: extract_local_pdf_comment_metadata(item),
                    local_pdf_screenshot: extract_local_pdf_screenshot(item),
                })
            })
            .collect::<Vec<_>>()
    })
}

fn extract_user_comments_from_raw_text(raw_text: &str) -> Vec<ThreadConversationUserComment> {
    let comments_start = raw_text.find("# Diff comments:");
    let Some(start) = comments_start else {
        return Vec::new();
    };
    let after_heading = &raw_text[start + "# Diff comments:".len()..];
    let comments_block = after_heading
        .find(USER_MESSAGE_REQUEST_HEADING)
        .map_or(after_heading, |index| &after_heading[..index]);
    let lines = comments_block
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>();

    let mut comment_ranges = Vec::new();
    let mut current_start = None;
    for (index, line) in lines.iter().enumerate() {
        if line.starts_with("## Comment") {
            if let Some(start_index) = current_start.replace(index) {
                comment_ranges.push((start_index, index));
            }
        }
    }
    if let Some(start_index) = current_start {
        comment_ranges.push((start_index, lines.len()));
    }

    comment_ranges
        .into_iter()
        .filter_map(|(start_index, end_index)| {
            parse_user_comment_lines(&lines[start_index..end_index])
        })
        .collect()
}

fn parse_user_comment_lines(lines: &[&str]) -> Option<ThreadConversationUserComment> {
    let header = lines.first()?.trim();
    if !header.starts_with("## Comment") {
        return None;
    }

    if let Some((path, line_range)) = parse_inline_user_comment_header(header) {
        let body = lines
            .iter()
            .skip(1)
            .copied()
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string();
        if body.is_empty() {
            return None;
        }
        let content = build_text_comment_content(&body);
        let position = build_user_comment_position(
            &path,
            parse_first_comment_line_number(line_range.as_deref()),
        );
        return Some(ThreadConversationUserComment {
            path,
            line_range,
            body,
            content,
            position,
            origin: None,
            local_pdf_context: None,
            local_pdf_comment_metadata: None,
            local_pdf_screenshot: None,
        });
    }

    let path = find_comment_metadata_value(lines, "File:")?
        .trim()
        .to_string();
    let line_range = find_comment_metadata_value(lines, "Lines:")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let comment_index = lines.iter().position(|line| line.trim() == "Comment:");
    let body_lines = match comment_index {
        Some(index) => &lines[index + 1..],
        None => &lines[1..],
    };
    let body = body_lines.join("\n").trim().to_string();
    if body.is_empty() {
        return None;
    }
    let content = build_text_comment_content(&body);
    let position = build_user_comment_position(
        &path,
        parse_first_comment_line_number(line_range.as_deref()),
    );

    Some(ThreadConversationUserComment {
        path,
        line_range,
        body,
        content,
        position,
        origin: None,
        local_pdf_context: None,
        local_pdf_comment_metadata: None,
        local_pdf_screenshot: None,
    })
}

fn parse_inline_user_comment_header(header: &str) -> Option<(String, Option<String>)> {
    let suffix_start = header.find(" (")?;
    if !header.ends_with(')') {
        return None;
    }
    let suffix = &header[suffix_start + 2..header.len() - 1];
    let separator = suffix.rfind(':')?;
    let path = suffix[..separator].trim();
    if path.is_empty() {
        return None;
    }
    let line_range = suffix[separator + 1..].trim();
    Some((
        path.to_string(),
        (!line_range.is_empty()).then(|| line_range.to_string()),
    ))
}

fn find_comment_metadata_value<'a>(lines: &'a [&str], prefix: &str) -> Option<&'a str> {
    lines
        .iter()
        .find_map(|line| line.strip_prefix(prefix))
        .map(str::trim)
}

fn extract_comment_line_range(value: &serde_json::Value) -> Option<String> {
    if let Some(line) = value
        .get("position")
        .and_then(|position| position.get("line"))
        .and_then(serde_json::Value::as_i64)
    {
        return Some(line.to_string());
    }

    let start_line = value
        .get("startLine")
        .and_then(serde_json::Value::as_i64)
        .or_else(|| {
            value
                .get("position")
                .and_then(|position| position.get("startLine"))
                .and_then(serde_json::Value::as_i64)
        });
    let end_line = value
        .get("endLine")
        .and_then(serde_json::Value::as_i64)
        .or_else(|| {
            value
                .get("position")
                .and_then(|position| position.get("endLine"))
                .and_then(serde_json::Value::as_i64)
        });

    match (start_line, end_line) {
        (Some(start), Some(end)) if start != end => Some(format!("{start}-{end}")),
        (Some(start), _) => Some(start.to_string()),
        _ => None,
    }
}

fn extract_user_comment_content(
    value: &serde_json::Value,
    body: &str,
) -> Vec<ThreadConversationUserCommentContent> {
    let content = value
        .get("content")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let content_type = item
                        .get("content_type")
                        .or_else(|| item.get("contentType"))
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)?;
                    Some(ThreadConversationUserCommentContent {
                        content_type,
                        text: item
                            .get("text")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                            .map(str::to_string),
                        label: item
                            .get("label")
                            .and_then(serde_json::Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                            .map(str::to_string),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if content.is_empty() {
        return build_text_comment_content(body);
    }

    content
}

fn build_text_comment_content(body: &str) -> Vec<ThreadConversationUserCommentContent> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    vec![ThreadConversationUserCommentContent {
        content_type: "text".to_string(),
        text: Some(trimmed.to_string()),
        label: None,
    }]
}

fn extract_user_comment_position(
    value: &serde_json::Value,
    fallback_path: &str,
    line_range: Option<&str>,
) -> Option<ThreadConversationUserCommentPosition> {
    let path = value
        .get("position")
        .and_then(|position| position.get("path"))
        .or_else(|| value.get("path"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_path);
    let line =
        extract_position_line(value).or_else(|| parse_first_comment_line_number(line_range))?;
    build_user_comment_position(path, Some(line))
}

fn extract_user_input_comment_position(
    value: &serde_json::Value,
    fallback_path: &str,
    line_range: Option<&str>,
) -> Option<ThreadConversationUserInputCommentPosition> {
    let path = value
        .get("position")
        .and_then(|position| position.get("path"))
        .or_else(|| value.get("path"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_path);
    let line =
        extract_position_line(value).or_else(|| parse_first_comment_line_number(line_range))?;
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return None;
    }

    Some(ThreadConversationUserInputCommentPosition {
        side: value
            .get("position")
            .and_then(|position| position.get("side"))
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        path: trimmed_path.to_string(),
        line,
    })
}

fn build_user_comment_position(
    path: &str,
    line: Option<i64>,
) -> Option<ThreadConversationUserCommentPosition> {
    let trimmed_path = path.trim();
    let line = line?;
    if trimmed_path.is_empty() {
        return None;
    }

    Some(ThreadConversationUserCommentPosition {
        path: trimmed_path.to_string(),
        line,
    })
}

fn extract_position_line(value: &serde_json::Value) -> Option<i64> {
    extract_integer(
        value
            .get("position")
            .and_then(|position| position.get("startLine")),
    )
    .or_else(|| extract_integer(value.get("startLine")))
    .or_else(|| {
        extract_integer(
            value
                .get("position")
                .and_then(|position| position.get("line")),
        )
    })
    .or_else(|| extract_integer(value.get("line")))
}

fn parse_first_comment_line_number(line_range: Option<&str>) -> Option<i64> {
    let line_range = line_range?;
    let digits = line_range
        .chars()
        .skip_while(|character| !character.is_ascii_digit())
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }

    digits.parse::<i64>().ok()
}

fn extract_user_comment_origin(value: &serde_json::Value) -> Option<String> {
    value
        .get("origin")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(str::to_string)
}

fn extract_local_pdf_context(
    value: &serde_json::Value,
) -> Option<ThreadConversationUserCommentLocalPdfContext> {
    let context = value.get("localPdfContext")?;
    let page_count = extract_integer(context.get("pageCount"))?;
    let page_number = extract_integer(context.get("pageNumber"))?;
    let path = context
        .get("path")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;
    let title = context
        .get("title")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    Some(ThreadConversationUserCommentLocalPdfContext {
        page_count,
        page_number,
        path,
        title,
    })
}

fn extract_local_pdf_comment_metadata(
    value: &serde_json::Value,
) -> Option<ThreadConversationUserCommentLocalPdfCommentMetadata> {
    let metadata = value.get("localPdfCommentMetadata")?;
    let kind = metadata
        .get("kind")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;
    let page_size = extract_pdf_size(metadata.get("pageSize"))?;
    let page_point = extract_pdf_point(metadata.get("pagePoint"));
    let page_rect = extract_pdf_rect(metadata.get("pageRect"));

    Some(ThreadConversationUserCommentLocalPdfCommentMetadata {
        kind,
        page_point,
        page_rect,
        page_size,
    })
}

fn extract_local_pdf_screenshot(
    value: &serde_json::Value,
) -> Option<ThreadConversationUserCommentLocalPdfScreenshot> {
    let screenshot = value.get("localPdfScreenshot")?;
    let comment_id = screenshot
        .get("commentId")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;
    let data_url = screenshot
        .get("dataUrl")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;
    let width = extract_integer(screenshot.get("width"))?;
    let height = extract_integer(screenshot.get("height"))?;
    let page_number = extract_integer(screenshot.get("pageNumber"))?;

    Some(ThreadConversationUserCommentLocalPdfScreenshot {
        comment_id,
        data_url,
        width,
        height,
        page_number,
    })
}

fn extract_pdf_size(value: Option<&serde_json::Value>) -> Option<ThreadConversationPdfSize> {
    let value = value?;
    Some(ThreadConversationPdfSize {
        width: extract_integer(value.get("width"))?,
        height: extract_integer(value.get("height"))?,
    })
}

fn extract_pdf_point(value: Option<&serde_json::Value>) -> Option<ThreadConversationPdfPoint> {
    let value = value?;
    Some(ThreadConversationPdfPoint {
        x: extract_integer(value.get("x"))?,
        y: extract_integer(value.get("y"))?,
    })
}

fn extract_pdf_rect(value: Option<&serde_json::Value>) -> Option<ThreadConversationPdfRect> {
    let value = value?;
    Some(ThreadConversationPdfRect {
        x: extract_integer(value.get("x"))?,
        y: extract_integer(value.get("y"))?,
        width: extract_integer(value.get("width"))?,
        height: extract_integer(value.get("height"))?,
    })
}

fn extract_integer(value: Option<&serde_json::Value>) -> Option<i64> {
    let value = value?;
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|number| i64::try_from(number).ok()))
        .or_else(|| value.as_f64().map(|number| number.round() as i64))
}

fn extract_u32(value: Option<&serde_json::Value>) -> Option<u32> {
    extract_integer(value).and_then(|number| u32::try_from(number).ok())
}

fn extract_bool(value: Option<&serde_json::Value>) -> Option<bool> {
    value.and_then(serde_json::Value::as_bool)
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

fn map_user_input_question_and_answer(
    question: &serde_json::Value,
    item: &serde_json::Value,
) -> Option<ThreadConversationQuestionAndAnswer> {
    let question_id = question.get("id")?.as_str()?.to_string();
    let header = question
        .get("header")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    let question_text = question
        .get("question")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    let answers = item
        .get("answers")
        .and_then(|answers| answers.get(&question_id))
        .and_then(extract_user_input_response_answers)
        .unwrap_or_default();
    if question_id.is_empty() && header.is_empty() && question_text.is_empty() && answers.is_empty()
    {
        return None;
    }
    Some(ThreadConversationQuestionAndAnswer {
        id: question_id,
        header,
        question: question_text,
        answers,
    })
}

fn extract_user_input_response_answers(value: &serde_json::Value) -> Option<Vec<String>> {
    let answers = if let Some(entries) = value.as_array() {
        entries
            .iter()
            .filter_map(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>()
    } else {
        value
            .get("answers")
            .and_then(serde_json::Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|entry| !entry.is_empty())
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    };

    if answers.is_empty() {
        return None;
    }

    Some(answers)
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

#[cfg(test)]
mod tests {
    use super::{map_thread_item, ThreadConversationItem, ThreadConversationUserAttachment};

    #[test]
    fn maps_user_message_goal_merge_task_and_attachments() {
        let value = serde_json::json!({
            "type": "userMessage",
            "id": "user-1",
            "goal": true,
            "pullRequestMergeTaskNumber": 123,
            "content": [
                {
                    "type": "text",
                    "text": "## My request for Codex:\nShip this fix."
                }
            ],
            "attachments": [
                {
                    "label": "ThreadPageHeader.tsx (42-44)",
                    "path": "src/features/chat/ThreadPageHeader.tsx",
                    "fsPath": "D:\\workspace\\project\\src\\features\\chat\\ThreadPageHeader.tsx",
                    "startLine": 42,
                    "endLine": 44
                }
            ]
        });

        let item = map_thread_item("turn-1", &value, Some(true));

        let Some(ThreadConversationItem::UserMessage {
            goal,
            pull_request_merge_task_number,
            attachments,
            text,
            ..
        }) = item
        else {
            panic!("expected user message item");
        };

        assert_eq!(goal, true);
        assert_eq!(pull_request_merge_task_number, Some(123));
        assert_eq!(text, "Ship this fix.");
        assert_eq!(
            attachments,
            vec![ThreadConversationUserAttachment {
                label: "ThreadPageHeader.tsx (42-44)".to_string(),
                path: "D:\\workspace\\project\\src\\features\\chat\\ThreadPageHeader.tsx"
                    .to_string(),
                fs_path: Some(
                    "D:\\workspace\\project\\src\\features\\chat\\ThreadPageHeader.tsx".to_string()
                ),
                start_line: Some(42),
                end_line: Some(44),
            }]
        );
    }
}
