use crate::hosted_command::{run_hosted_command, HostedCommandOutput};
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use tauri::AppHandle;

const GH_NOT_INSTALLED_ERROR: &str = "GitHub CLI is not installed.";
const SUCCESS_STATUS: &str = "success";
const ERROR_STATUS: &str = "error";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostOnlyParams {
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestBoardRepoParams {
    pub cwd: String,
    pub host_id: Option<String>,
    pub repo: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestBoardParams {
    pub cwd: Option<String>,
    pub host_id: Option<String>,
    pub repo: Option<String>,
    pub repos: Option<Vec<PullRequestBoardRepoParams>>,
    pub search_query: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestLookupParams {
    pub cwd: String,
    pub head_branch: String,
    pub host_id: Option<String>,
    pub number: Option<u64>,
    pub repo: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestDiffParams {
    pub cwd: String,
    pub host_id: Option<String>,
    pub number: u64,
    pub repo: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCommentParams {
    pub body: String,
    pub cwd: String,
    pub host_id: Option<String>,
    pub number: u64,
    pub repo: String,
    pub reply_to_review_thread_id: Option<StringOrNumber>,
    pub inline_comment: Option<InlineCommentParams>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InlineCommentParams {
    pub path: String,
    pub side: String,
    pub line: u64,
    pub start_line: Option<u64>,
    pub start_side: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestMergeParams {
    pub cwd: String,
    pub host_id: Option<String>,
    pub merge_method: String,
    pub number: u64,
    pub repo: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestUpdateParams {
    pub cwd: String,
    pub host_id: Option<String>,
    pub number: u64,
    pub repo: String,
    pub action: String,
    pub enabled: Option<bool>,
    pub merge_method: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(untagged)]
pub enum StringOrNumber {
    String(String),
    Number(u64),
}

impl StringOrNumber {
    fn into_string(self) -> String {
        match self {
            Self::String(value) => value,
            Self::Number(value) => value.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GhCliStatusResponse {
    pub is_installed: bool,
    pub is_authenticated: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SuccessEnvelope {
    pub status: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    pub status: &'static str,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum GhCurrentUserResponse {
    Success(GhCurrentUserSuccess),
    Error(ErrorEnvelope),
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GhCurrentUserSuccess {
    pub status: &'static str,
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum PullRequestBoardResponse {
    Success(PullRequestBoardSuccess),
    Error(ErrorEnvelope),
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestBoardSuccess {
    pub status: &'static str,
    pub items: Vec<PullRequestBoardItem>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum PullRequestStatusResponse {
    Success(PullRequestStatusSuccess),
    Error(ErrorEnvelope),
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestStatusSuccess {
    pub status: &'static str,
    pub activity_items: Vec<PullRequestActivityItem>,
    pub board_item: Option<PullRequestBoardItem>,
    pub body: String,
    pub can_merge: bool,
    pub checks: Vec<PullRequestCheck>,
    pub ci_status: String,
    pub comment_attachments: Vec<PullRequestCommentAttachment>,
    pub has_open_pr: bool,
    pub is_auto_merge_enabled: bool,
    pub is_draft: bool,
    pub number: Option<u64>,
    pub repo: Option<String>,
    pub reviewers: PullRequestReviewers,
    pub review_status: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestBodyResponse {
    pub body: String,
    pub is_draft: bool,
    pub is_auto_merge_enabled: bool,
    pub reviewers: PullRequestReviewers,
    pub has_open_pr: bool,
    pub can_merge: bool,
    pub repo: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestChecksResponse {
    pub ci_status: String,
    pub checks: Vec<PullRequestCheck>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCommentsResponse {
    pub activity_items: Vec<PullRequestActivityItem>,
    pub repo: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum PullRequestDiffResponse {
    Success(PullRequestDiffSuccess),
    Error(ErrorEnvelope),
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestDiffSuccess {
    pub status: &'static str,
    pub unified_diff: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum CommandStatusEnvelope {
    Success(SuccessEnvelope),
    Error(ErrorEnvelope),
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestBoardItem {
    pub cwd: String,
    pub head_branch: String,
    pub host_id: Option<String>,
    pub url: String,
    pub number: u64,
    pub state: String,
    pub additions: u64,
    pub deletions: u64,
    pub title: String,
    pub repo: Option<String>,
    pub base_branch: String,
    pub is_author: bool,
    pub can_merge: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PullRequestActivityItem {
    Event {
        event: String,
        actor_login: Option<String>,
        created_at: String,
    },
    Comment {
        id: String,
        review_thread_id: Option<String>,
        author_login: Option<String>,
        author_avatar_url: Option<String>,
        body: String,
        created_at: String,
        replies: Vec<PullRequestActivityReply>,
        url: Option<String>,
        path: Option<String>,
        line: Option<u64>,
    },
    Review {
        id: String,
        review_thread_id: Option<String>,
        author_login: Option<String>,
        author_avatar_url: Option<String>,
        body: String,
        created_at: String,
        replies: Vec<PullRequestActivityReply>,
        url: Option<String>,
        path: Option<String>,
        line: Option<u64>,
    },
    ReviewComment {
        id: String,
        review_thread_id: Option<String>,
        author_login: Option<String>,
        author_avatar_url: Option<String>,
        body: String,
        created_at: String,
        replies: Vec<PullRequestActivityReply>,
        url: Option<String>,
        path: Option<String>,
        line: Option<u64>,
    },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestActivityReply {
    pub id: String,
    pub author_login: Option<String>,
    pub author_avatar_url: Option<String>,
    pub body: String,
    pub created_at: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCheck {
    pub status: String,
    pub label: String,
    pub description: Option<String>,
    pub link: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCommentAttachment {
    pub review_thread_id: Option<String>,
    pub position: PullRequestCommentPosition,
    pub body: String,
    pub content: Vec<PullRequestCommentContent>,
    pub path: String,
    pub line: Option<u64>,
    pub start_line: Option<u64>,
    pub end_line: Option<u64>,
    pub author_login: Option<String>,
    pub author_avatar_url: Option<String>,
    pub created_at: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCommentPosition {
    pub path: String,
    pub line: Option<u64>,
    pub side: String,
    pub start_line: Option<u64>,
    pub start_side: Option<String>,
    pub end_line: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestCommentContent {
    pub content_type: &'static str,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestReviewers {
    pub approved: Vec<PullRequestReviewer>,
    pub comment_counts: Vec<PullRequestReviewer>,
    pub commented: Vec<PullRequestReviewer>,
    pub changes_requested: Vec<PullRequestReviewer>,
    pub requested: Vec<PullRequestReviewer>,
    pub unresolved_comment_count: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestReviewer {
    pub login: String,
    pub avatar_url: Option<String>,
    pub url: Option<String>,
    pub comment_count: Option<u64>,
    pub count: Option<u64>,
}

#[derive(Debug, Clone)]
struct ParsedRepo {
    host: Option<String>,
    repo_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct UserIdentity {
    login: String,
    avatar_url: Option<String>,
    url: Option<String>,
}

#[tauri::command(rename = "gh-cli-status")]
pub async fn gh_cli_status(
    app: AppHandle,
    params: HostOnlyParams,
) -> Result<GhCliStatusResponse, String> {
    let version = run_gh(
        &app,
        params.host_id.as_deref(),
        vec!["--version".to_string()],
        None,
        &[],
    )
    .await;
    match version {
        Ok(_) => {}
        Err(err) if err == GH_NOT_INSTALLED_ERROR => {
            return Ok(GhCliStatusResponse {
                is_installed: false,
                is_authenticated: false,
            })
        }
        Err(err) => return Err(err),
    }

    let auth_status = run_gh(
        &app,
        params.host_id.as_deref(),
        vec!["auth".to_string(), "status".to_string()],
        None,
        &[1],
    )
    .await?;

    Ok(GhCliStatusResponse {
        is_installed: true,
        is_authenticated: auth_status.status_code == Some(0),
    })
}

#[tauri::command(rename = "gh-current-user")]
pub async fn gh_current_user(
    app: AppHandle,
    params: HostOnlyParams,
) -> Result<GhCurrentUserResponse, String> {
    match fetch_current_user(&app, params.host_id.as_deref()).await {
        Ok(user) => Ok(GhCurrentUserResponse::Success(GhCurrentUserSuccess {
            status: SUCCESS_STATUS,
            login: user.login,
            avatar_url: user.avatar_url.unwrap_or_default(),
        })),
        Err(err) => Ok(GhCurrentUserResponse::Error(error_envelope(err))),
    }
}

#[tauri::command(rename = "gh-pr-board")]
pub async fn gh_pr_board(
    app: AppHandle,
    params: PullRequestBoardParams,
) -> Result<PullRequestBoardResponse, String> {
    let items = match build_pull_request_board(&app, params).await {
        Ok(items) => items,
        Err(err) => return Ok(PullRequestBoardResponse::Error(error_envelope(err))),
    };

    Ok(PullRequestBoardResponse::Success(PullRequestBoardSuccess {
        status: SUCCESS_STATUS,
        items,
    }))
}

#[tauri::command(rename = "gh-pr-status")]
pub async fn gh_pr_status(
    app: AppHandle,
    params: PullRequestLookupParams,
) -> Result<PullRequestStatusResponse, String> {
    let pr_value = match fetch_pull_request_value(&app, &params).await {
        Ok(pr_value) => pr_value,
        Err(err) => return Ok(PullRequestStatusResponse::Error(error_envelope(err))),
    };

    let Some(pr_value) = pr_value else {
        return Ok(PullRequestStatusResponse::Success(
            empty_pull_request_status(),
        ));
    };

    let repo = resolve_repo_name(params.repo.as_deref(), value_string(&pr_value, "url"));
    let number = value_u64(&pr_value, "number");
    let timeline = match (repo.as_deref(), number) {
        (Some(repo_name), Some(pr_number)) => fetch_pull_request_timeline(
            &app,
            params.host_id.as_deref(),
            repo_name,
            pr_number,
            &params.cwd,
        )
        .await
        .unwrap_or_default(),
        _ => PullRequestTimeline::default(),
    };

    let ci_status = compute_ci_status_from_rollup(pr_value.get("statusCheckRollup"));
    let board_item = build_board_item_from_value(
        &params.cwd,
        params.host_id.clone(),
        repo.clone(),
        &pr_value,
        timeline.current_user_login.as_deref(),
    );
    let reviewers = build_reviewers(&pr_value, &timeline.review_comments, &timeline.reviews);
    let can_merge = compute_can_merge(value_bool(&pr_value, "isDraft"), &ci_status, &pr_value);
    let review_status = compute_review_status(&pr_value, &timeline.reviews);

    Ok(PullRequestStatusResponse::Success(
        PullRequestStatusSuccess {
            status: SUCCESS_STATUS,
            activity_items: timeline.activity_items,
            board_item,
            body: value_string(&pr_value, "body").unwrap_or_default(),
            can_merge,
            checks: compute_checks_from_rollup(pr_value.get("statusCheckRollup")),
            ci_status,
            comment_attachments: build_comment_attachments(&timeline.review_comments),
            has_open_pr: true,
            is_auto_merge_enabled: pr_value.get("autoMergeRequest").is_some(),
            is_draft: value_bool(&pr_value, "isDraft"),
            number,
            repo,
            reviewers,
            review_status,
            url: value_string(&pr_value, "url"),
        },
    ))
}

#[tauri::command(rename = "gh-pr-body")]
pub async fn gh_pr_body(
    app: AppHandle,
    params: PullRequestLookupParams,
) -> Result<PullRequestBodyResponse, String> {
    let pr_value = fetch_pull_request_value(&app, &params)
        .await?
        .ok_or_else(|| "No open pull request found".to_string())?;
    let repo = resolve_repo_name(params.repo.as_deref(), value_string(&pr_value, "url"));
    let number = value_u64(&pr_value, "number")
        .ok_or_else(|| "Pull request number is missing".to_string())?;
    let timeline = match repo.as_deref() {
        Some(repo_name) => {
            fetch_pull_request_timeline(
                &app,
                params.host_id.as_deref(),
                repo_name,
                number,
                &params.cwd,
            )
            .await?
        }
        None => PullRequestTimeline::default(),
    };
    let ci_status = compute_ci_status_from_rollup(pr_value.get("statusCheckRollup"));

    Ok(PullRequestBodyResponse {
        body: value_string(&pr_value, "body").unwrap_or_default(),
        is_draft: value_bool(&pr_value, "isDraft"),
        is_auto_merge_enabled: pr_value.get("autoMergeRequest").is_some(),
        reviewers: build_reviewers(&pr_value, &timeline.review_comments, &timeline.reviews),
        has_open_pr: true,
        can_merge: compute_can_merge(value_bool(&pr_value, "isDraft"), &ci_status, &pr_value),
        repo,
    })
}

#[tauri::command(rename = "gh-pr-checks")]
pub async fn gh_pr_checks(
    app: AppHandle,
    params: PullRequestLookupParams,
) -> Result<PullRequestChecksResponse, String> {
    let selector = pull_request_selector(&params)?;
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let mut args = vec![
        "pr".to_string(),
        "checks".to_string(),
        selector,
        "--json".to_string(),
        "description,link,name,state".to_string(),
    ];
    if let Some(repo) = normalized_optional_string(params.repo.as_deref()) {
        args.push("--repo".to_string());
        args.push(repo);
    }

    let checks_value = run_gh_json(&app, params.host_id.as_deref(), args, Some(cwd), &[8]).await?;
    let checks_array = checks_value
        .as_array()
        .ok_or_else(|| "GitHub CLI returned invalid pull request checks".to_string())?;
    let checks = checks_array
        .iter()
        .map(build_check_from_value)
        .collect::<Vec<_>>();

    Ok(PullRequestChecksResponse {
        ci_status: compute_ci_status_from_checks(&checks),
        checks,
    })
}

#[tauri::command(rename = "gh-pr-comments")]
pub async fn gh_pr_comments(
    app: AppHandle,
    params: PullRequestLookupParams,
) -> Result<PullRequestCommentsResponse, String> {
    let pr_value = fetch_pull_request_value(&app, &params)
        .await?
        .ok_or_else(|| "No open pull request found".to_string())?;
    let repo = resolve_repo_name(params.repo.as_deref(), value_string(&pr_value, "url"));
    let number = value_u64(&pr_value, "number")
        .ok_or_else(|| "Pull request number is missing".to_string())?;
    let timeline = match repo.as_deref() {
        Some(repo_name) => {
            fetch_pull_request_timeline(
                &app,
                params.host_id.as_deref(),
                repo_name,
                number,
                &params.cwd,
            )
            .await?
        }
        None => PullRequestTimeline::default(),
    };

    Ok(PullRequestCommentsResponse {
        activity_items: timeline.activity_items,
        repo,
    })
}

#[tauri::command(rename = "gh-pr-diff")]
pub async fn gh_pr_diff(
    app: AppHandle,
    params: PullRequestDiffParams,
) -> Result<PullRequestDiffResponse, String> {
    match fetch_pull_request_diff(&app, &params).await {
        Ok(unified_diff) => Ok(PullRequestDiffResponse::Success(PullRequestDiffSuccess {
            status: SUCCESS_STATUS,
            unified_diff,
        })),
        Err(err) => Ok(PullRequestDiffResponse::Error(error_envelope(err))),
    }
}

#[tauri::command(rename = "gh-pr-comment")]
pub async fn gh_pr_comment(
    app: AppHandle,
    params: PullRequestCommentParams,
) -> Result<CommandStatusEnvelope, String> {
    let result = post_pull_request_comment(&app, params).await;
    Ok(command_status_envelope(result))
}

#[tauri::command(rename = "gh-pr-merge")]
pub async fn gh_pr_merge(
    app: AppHandle,
    params: PullRequestMergeParams,
) -> Result<CommandStatusEnvelope, String> {
    let result = merge_pull_request(&app, params).await;
    Ok(command_status_envelope(result))
}

#[tauri::command(rename = "gh-pr-update")]
pub async fn gh_pr_update(
    app: AppHandle,
    params: PullRequestUpdateParams,
) -> Result<CommandStatusEnvelope, String> {
    let result = update_pull_request(&app, params).await;
    Ok(command_status_envelope(result))
}

async fn build_pull_request_board(
    app: &AppHandle,
    params: PullRequestBoardParams,
) -> Result<Vec<PullRequestBoardItem>, String> {
    let default_host_id = params.host_id.clone();
    let current_user_login = fetch_current_user(app, default_host_id.as_deref())
        .await
        .ok()
        .map(|user| user.login);
    let search_query = normalized_optional_string(params.search_query.as_deref());

    if let Some(repos) = params.repos {
        let mut items = Vec::new();
        for repo in repos {
            items.extend(
                load_repo_pull_requests(
                    app,
                    &repo.cwd,
                    repo.host_id.clone(),
                    &repo.repo,
                    search_query.as_deref(),
                    current_user_login.as_deref(),
                )
                .await?,
            );
        }
        return Ok(items);
    }

    let cwd = normalize_required_string(params.cwd.as_deref().unwrap_or_default(), "cwd")?;
    let repo = normalize_required_string(params.repo.as_deref().unwrap_or_default(), "repo")?;
    load_repo_pull_requests(
        app,
        &cwd,
        params.host_id,
        &repo,
        search_query.as_deref(),
        current_user_login.as_deref(),
    )
    .await
}

async fn load_repo_pull_requests(
    app: &AppHandle,
    cwd: &str,
    host_id: Option<String>,
    repo: &str,
    search_query: Option<&str>,
    current_user_login: Option<&str>,
) -> Result<Vec<PullRequestBoardItem>, String> {
    let mut args = vec![
        "pr".to_string(),
        "list".to_string(),
        "--state".to_string(),
        "all".to_string(),
        "--limit".to_string(),
        "100".to_string(),
        "--repo".to_string(),
        repo.to_string(),
        "--json".to_string(),
        "additions,author,baseRefName,deletions,headRefName,isDraft,mergeStateStatus,mergeable,number,state,statusCheckRollup,title,url".to_string(),
    ];
    if let Some(search_query) = normalized_optional_string(search_query) {
        args.push("--search".to_string());
        args.push(search_query);
    }

    let list_value = run_gh_json(app, host_id.as_deref(), args, Some(cwd.to_string()), &[]).await?;
    let list = list_value
        .as_array()
        .ok_or_else(|| "GitHub CLI returned invalid pull request list data".to_string())?;

    Ok(list
        .iter()
        .map(|value| {
            build_board_item_from_value(
                cwd,
                host_id.clone(),
                Some(repo.to_string()),
                value,
                current_user_login,
            )
        })
        .flatten()
        .collect())
}

async fn fetch_pull_request_value(
    app: &AppHandle,
    params: &PullRequestLookupParams,
) -> Result<Option<Value>, String> {
    let selector = pull_request_selector(params)?;
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let mut args = vec![
        "pr".to_string(),
        "view".to_string(),
        selector,
        "--json".to_string(),
        "author,autoMergeRequest,baseRefName,body,createdAt,headRefName,headRefOid,isDraft,latestReviews,mergeStateStatus,mergeable,mergedAt,mergedBy,number,reviewDecision,reviewRequests,state,statusCheckRollup,title,url".to_string(),
    ];
    if let Some(repo) = normalized_optional_string(params.repo.as_deref()) {
        args.push("--repo".to_string());
        args.push(repo);
    }

    match run_gh_json(app, params.host_id.as_deref(), args, Some(cwd), &[]).await {
        Ok(value) => Ok(Some(value)),
        Err(err) if is_no_pull_request_error(&err) => Ok(None),
        Err(err) => Err(err),
    }
}

async fn fetch_current_user(
    app: &AppHandle,
    host_id: Option<&str>,
) -> Result<UserIdentity, String> {
    let value = run_gh_json(
        app,
        host_id,
        vec!["api".to_string(), "user".to_string()],
        None,
        &[],
    )
    .await?;
    user_identity_from_value(&value)
        .ok_or_else(|| "GitHub CLI returned invalid current user data".to_string())
}

async fn fetch_pull_request_timeline(
    app: &AppHandle,
    host_id: Option<&str>,
    repo: &str,
    number: u64,
    cwd: &str,
) -> Result<PullRequestTimeline, String> {
    let issue_comments = fetch_repo_api_array(
        app,
        host_id,
        repo,
        &format!("repos/{{repo}}/issues/{number}/comments"),
        cwd,
    )
    .await?;
    let review_comments = fetch_repo_api_array(
        app,
        host_id,
        repo,
        &format!("repos/{{repo}}/pulls/{number}/comments"),
        cwd,
    )
    .await?;
    let reviews = fetch_repo_api_array(
        app,
        host_id,
        repo,
        &format!("repos/{{repo}}/pulls/{number}/reviews"),
        cwd,
    )
    .await?;
    let current_user_login = fetch_current_user(app, host_id)
        .await
        .ok()
        .map(|user| user.login);

    Ok(PullRequestTimeline {
        activity_items: build_activity_items(&issue_comments, &review_comments, &reviews),
        review_comments,
        reviews,
        current_user_login,
    })
}

async fn fetch_pull_request_diff(
    app: &AppHandle,
    params: &PullRequestDiffParams,
) -> Result<String, String> {
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let mut args = vec![
        "pr".to_string(),
        "diff".to_string(),
        params.number.to_string(),
    ];
    if let Some(repo) = normalized_optional_string(params.repo.as_deref()) {
        args.push("--repo".to_string());
        args.push(repo);
    }

    let output = run_gh(app, params.host_id.as_deref(), args, Some(cwd), &[]).await?;
    Ok(output.stdout)
}

async fn fetch_repo_api_array(
    app: &AppHandle,
    host_id: Option<&str>,
    repo: &str,
    path_template: &str,
    cwd: &str,
) -> Result<Vec<Value>, String> {
    let parsed_repo = parse_repo(repo)?;
    let mut args = vec!["api".to_string()];
    if let Some(host) = parsed_repo.host {
        args.push("--hostname".to_string());
        args.push(host);
    }
    args.push(path_template.replace("{repo}", &parsed_repo.repo_path));

    let value = run_gh_json(app, host_id, args, Some(cwd.to_string()), &[]).await?;
    value
        .as_array()
        .cloned()
        .ok_or_else(|| "GitHub CLI returned invalid API response".to_string())
}

async fn post_pull_request_comment(
    app: &AppHandle,
    params: PullRequestCommentParams,
) -> Result<(), String> {
    let host_id = params.host_id.clone();
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let body = normalize_required_string(&params.body, "body")?;
    let repo = normalize_required_string(&params.repo, "repo")?;

    if let Some(reply_to_review_thread_id) = params.reply_to_review_thread_id {
        let parsed_repo = parse_repo(&repo)?;
        let mut args = vec!["api".to_string()];
        if let Some(host) = parsed_repo.host {
            args.push("--hostname".to_string());
            args.push(host);
        }
        args.push(format!(
            "repos/{}/pulls/{}/comments/{}/replies",
            parsed_repo.repo_path,
            params.number,
            reply_to_review_thread_id.into_string()
        ));
        args.push("-f".to_string());
        args.push(format!("body={body}"));
        run_gh_json(app, host_id.as_deref(), args, Some(cwd), &[]).await?;
        return Ok(());
    }

    if let Some(inline_comment) = params.inline_comment {
        let pr_value = fetch_pull_request_value(
            app,
            &PullRequestLookupParams {
                cwd: params.cwd.clone(),
                head_branch: String::new(),
                host_id: host_id.clone(),
                number: Some(params.number),
                repo: Some(repo.clone()),
            },
        )
        .await?
        .ok_or_else(|| "No open pull request found".to_string())?;
        let head_ref_oid = normalize_required_string(
            value_string(&pr_value, "headRefOid")
                .as_deref()
                .unwrap_or_default(),
            "headRefOid",
        )?;
        let parsed_repo = parse_repo(&repo)?;
        let mut args = vec!["api".to_string()];
        if let Some(host) = parsed_repo.host {
            args.push("--hostname".to_string());
            args.push(host);
        }
        args.push(format!(
            "repos/{}/pulls/{}/comments",
            parsed_repo.repo_path, params.number
        ));
        args.push("-f".to_string());
        args.push(format!("body={body}"));
        args.push("-f".to_string());
        args.push(format!(
            "path={}",
            normalize_required_string(&inline_comment.path, "path")?
        ));
        args.push("-F".to_string());
        args.push(format!("line={}", inline_comment.line));
        args.push("-f".to_string());
        args.push(format!(
            "side={}",
            normalize_required_string(&inline_comment.side, "side")?
        ));
        args.push("-f".to_string());
        args.push(format!("commit_id={head_ref_oid}"));
        if let Some(start_line) = inline_comment.start_line {
            args.push("-F".to_string());
            args.push(format!("start_line={start_line}"));
        }
        if let Some(start_side) = normalized_optional_string(inline_comment.start_side.as_deref()) {
            args.push("-f".to_string());
            args.push(format!("start_side={start_side}"));
        }
        run_gh_json(app, host_id.as_deref(), args, Some(cwd), &[]).await?;
        return Ok(());
    }

    let args = vec![
        "pr".to_string(),
        "comment".to_string(),
        params.number.to_string(),
        "--repo".to_string(),
        repo,
        "--body".to_string(),
        body,
    ];
    run_gh(app, host_id.as_deref(), args, Some(cwd), &[]).await?;
    Ok(())
}

async fn merge_pull_request(app: &AppHandle, params: PullRequestMergeParams) -> Result<(), String> {
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let repo = normalize_required_string(&params.repo, "repo")?;
    let merge_flag = merge_method_flag(&params.merge_method)?;
    let args = vec![
        "pr".to_string(),
        "merge".to_string(),
        params.number.to_string(),
        "--repo".to_string(),
        repo,
        merge_flag.to_string(),
    ];
    run_gh(app, params.host_id.as_deref(), args, Some(cwd), &[]).await?;
    Ok(())
}

async fn update_pull_request(
    app: &AppHandle,
    params: PullRequestUpdateParams,
) -> Result<(), String> {
    let cwd = normalize_required_string(&params.cwd, "cwd")?;
    let repo = normalize_required_string(&params.repo, "repo")?;
    match params.action.as_str() {
        "mark-ready" => {
            run_gh(
                app,
                params.host_id.as_deref(),
                vec![
                    "pr".to_string(),
                    "ready".to_string(),
                    params.number.to_string(),
                    "--repo".to_string(),
                    repo,
                ],
                Some(cwd),
                &[],
            )
            .await?;
        }
        "mark-draft" => {
            run_gh(
                app,
                params.host_id.as_deref(),
                vec![
                    "pr".to_string(),
                    "ready".to_string(),
                    params.number.to_string(),
                    "--repo".to_string(),
                    repo,
                    "--undo".to_string(),
                ],
                Some(cwd),
                &[],
            )
            .await?;
        }
        "toggle-auto-merge" => {
            if params.enabled.unwrap_or(false) {
                let merge_method = params.merge_method.as_deref().unwrap_or("merge");
                let merge_flag = merge_method_flag(merge_method)?;
                run_gh(
                    app,
                    params.host_id.as_deref(),
                    vec![
                        "pr".to_string(),
                        "merge".to_string(),
                        params.number.to_string(),
                        "--repo".to_string(),
                        repo,
                        "--auto".to_string(),
                        merge_flag.to_string(),
                    ],
                    Some(cwd),
                    &[],
                )
                .await?;
            } else {
                run_gh(
                    app,
                    params.host_id.as_deref(),
                    vec![
                        "pr".to_string(),
                        "merge".to_string(),
                        params.number.to_string(),
                        "--repo".to_string(),
                        repo,
                        "--disable-auto".to_string(),
                    ],
                    Some(cwd),
                    &[],
                )
                .await?;
            }
        }
        _ => {
            return Err(format!(
                "Unsupported pull request update action: {}",
                params.action
            ))
        }
    }
    Ok(())
}

fn build_board_item_from_value(
    cwd: &str,
    host_id: Option<String>,
    repo: Option<String>,
    value: &Value,
    current_user_login: Option<&str>,
) -> Option<PullRequestBoardItem> {
    let url = value_string(value, "url")?;
    let number = value_u64(value, "number")?;
    let title = value_string(value, "title")?;
    let head_branch = value_string(value, "headRefName")?;
    let base_branch = value_string(value, "baseRefName")?;
    let ci_status = compute_ci_status_from_rollup(value.get("statusCheckRollup"));
    let state = compute_board_state(value, &ci_status);
    let is_draft = value_bool(value, "isDraft");

    Some(PullRequestBoardItem {
        cwd: cwd.to_string(),
        head_branch,
        host_id,
        url,
        number,
        state: state.to_string(),
        additions: value_u64(value, "additions").unwrap_or(0),
        deletions: value_u64(value, "deletions").unwrap_or(0),
        title,
        repo,
        base_branch,
        is_author: current_user_login
            .zip(user_identity_from_value(value.get("author")?).as_ref())
            .map(|(current_user_login, author)| {
                author.login.eq_ignore_ascii_case(current_user_login)
            })
            .unwrap_or(false),
        can_merge: compute_can_merge(is_draft, &ci_status, value),
    })
}

fn build_check_from_value(value: &Value) -> PullRequestCheck {
    let raw_state = value_string(value, "state").unwrap_or_else(|| "unknown".to_string());
    PullRequestCheck {
        status: map_check_status(&raw_state).to_string(),
        label: value_string(value, "name").unwrap_or_else(|| "Unnamed check".to_string()),
        description: value_string(value, "description"),
        link: value_string(value, "link"),
    }
}

fn build_comment_attachments(review_comments: &[Value]) -> Vec<PullRequestCommentAttachment> {
    review_comments
        .iter()
        .filter(|value| value_u64(value, "in_reply_to_id").is_none())
        .filter_map(|value| {
            let path = value_string(value, "path")?;
            let side = value_string(value, "side").unwrap_or_else(|| "RIGHT".to_string());
            let line = value_u64(value, "line");
            let start_line = value_u64(value, "start_line");
            let end_line = line.or(start_line);
            let body = value_string(value, "body")?;
            let author = user_identity_from_value(value.get("user")?);
            Some(PullRequestCommentAttachment {
                review_thread_id: value_u64(value, "id").map(|value| value.to_string()),
                position: PullRequestCommentPosition {
                    path: path.clone(),
                    line,
                    side,
                    start_line,
                    start_side: value_string(value, "start_side"),
                    end_line,
                },
                body: body.clone(),
                content: vec![PullRequestCommentContent {
                    content_type: "text",
                    text: body,
                }],
                path,
                line,
                start_line,
                end_line,
                author_login: author.as_ref().map(|user| user.login.clone()),
                author_avatar_url: author.and_then(|user| user.avatar_url),
                created_at: value_string(value, "created_at"),
                url: value_string(value, "html_url"),
            })
        })
        .collect()
}

fn build_reviewers(
    pr_value: &Value,
    review_comments: &[Value],
    reviews: &[Value],
) -> PullRequestReviewers {
    let mut latest_reviews = BTreeMap::<String, (String, PullRequestReviewer)>::new();
    for review in reviews {
        let Some(author) = review.get("user").and_then(user_identity_from_value) else {
            continue;
        };
        let Some(state) = value_string(review, "state") else {
            continue;
        };
        latest_reviews.insert(
            author.login.clone(),
            (
                state,
                PullRequestReviewer {
                    login: author.login,
                    avatar_url: author.avatar_url,
                    url: author.url,
                    comment_count: None,
                    count: None,
                },
            ),
        );
    }

    let mut approved = Vec::new();
    let mut commented = Vec::new();
    let mut changes_requested = Vec::new();
    for (state, reviewer) in latest_reviews.into_values() {
        match state.to_ascii_uppercase().as_str() {
            "APPROVED" => approved.push(reviewer),
            "CHANGES_REQUESTED" => changes_requested.push(reviewer),
            "COMMENTED" | "DISMISSED" => commented.push(reviewer),
            _ => {}
        }
    }

    let requested = pr_value
        .get("reviewRequests")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(review_request_reviewer)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut comment_counts = HashMap::<String, PullRequestReviewer>::new();
    for review_comment in review_comments {
        let Some(author) = review_comment
            .get("user")
            .and_then(user_identity_from_value)
        else {
            continue;
        };
        let reviewer = comment_counts
            .entry(author.login.clone())
            .or_insert(PullRequestReviewer {
                login: author.login,
                avatar_url: author.avatar_url,
                url: author.url,
                comment_count: Some(0),
                count: Some(0),
            });
        reviewer.comment_count = Some(reviewer.comment_count.unwrap_or(0) + 1);
        reviewer.count = reviewer.comment_count;
    }

    PullRequestReviewers {
        approved,
        comment_counts: comment_counts.into_values().collect(),
        commented,
        changes_requested,
        requested,
        unresolved_comment_count: 0,
    }
}

fn review_request_reviewer(value: &Value) -> Option<PullRequestReviewer> {
    let reviewer_value = value.get("requestedReviewer").unwrap_or(value);
    let reviewer = user_identity_from_value(reviewer_value)?;
    Some(PullRequestReviewer {
        login: reviewer.login,
        avatar_url: reviewer.avatar_url,
        url: reviewer.url,
        comment_count: None,
        count: None,
    })
}

fn build_activity_items(
    issue_comments: &[Value],
    review_comments: &[Value],
    reviews: &[Value],
) -> Vec<PullRequestActivityItem> {
    let mut items = Vec::<(String, PullRequestActivityItem)>::new();

    for review in reviews {
        let Some(created_at) = value_string(review, "submitted_at") else {
            continue;
        };
        let author = review.get("user").and_then(user_identity_from_value);
        if let Some(event) = map_review_event(review, created_at.clone(), author.as_ref()) {
            items.push((created_at.clone(), event));
        }
        if let Some(body) = normalized_optional_string(value_string(review, "body").as_deref()) {
            items.push((
                created_at.clone(),
                PullRequestActivityItem::Review {
                    id: value_u64(review, "id")
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| format!("review-{created_at}")),
                    review_thread_id: None,
                    author_login: author.as_ref().map(|user| user.login.clone()),
                    author_avatar_url: author.as_ref().and_then(|user| user.avatar_url.clone()),
                    body,
                    created_at,
                    replies: Vec::new(),
                    url: value_string(review, "html_url"),
                    path: None,
                    line: None,
                },
            ));
        }
    }

    for issue_comment in issue_comments {
        let Some(created_at) = value_string(issue_comment, "created_at") else {
            continue;
        };
        let Some(body) = value_string(issue_comment, "body") else {
            continue;
        };
        let author = issue_comment.get("user").and_then(user_identity_from_value);
        items.push((
            created_at.clone(),
            PullRequestActivityItem::Comment {
                id: value_u64(issue_comment, "id")
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| format!("issue-comment-{created_at}")),
                review_thread_id: None,
                author_login: author.as_ref().map(|user| user.login.clone()),
                author_avatar_url: author.as_ref().and_then(|user| user.avatar_url.clone()),
                body,
                created_at,
                replies: Vec::new(),
                url: value_string(issue_comment, "html_url"),
                path: None,
                line: None,
            },
        ));
    }

    let mut review_threads = HashMap::<u64, (Option<Value>, Vec<Value>)>::new();
    for review_comment in review_comments {
        let comment_id = value_u64(review_comment, "id");
        let reply_to_id = value_u64(review_comment, "in_reply_to_id");
        match (comment_id, reply_to_id) {
            (_, Some(parent_id)) => {
                review_threads
                    .entry(parent_id)
                    .or_insert((None, Vec::new()))
                    .1
                    .push(review_comment.clone());
            }
            (Some(comment_id), None) => {
                review_threads
                    .entry(comment_id)
                    .or_insert((None, Vec::new()))
                    .0 = Some(review_comment.clone());
            }
            _ => {}
        }
    }

    for (thread_id, (top_level_comment, replies)) in review_threads {
        let Some(top_level_comment) = top_level_comment else {
            continue;
        };
        let Some(created_at) = value_string(&top_level_comment, "created_at") else {
            continue;
        };
        let Some(body) = value_string(&top_level_comment, "body") else {
            continue;
        };
        let author = top_level_comment
            .get("user")
            .and_then(user_identity_from_value);
        let replies = replies
            .into_iter()
            .filter_map(|reply| map_activity_reply(&reply))
            .collect::<Vec<_>>();

        items.push((
            created_at.clone(),
            PullRequestActivityItem::ReviewComment {
                id: thread_id.to_string(),
                review_thread_id: Some(thread_id.to_string()),
                author_login: author.as_ref().map(|user| user.login.clone()),
                author_avatar_url: author.as_ref().and_then(|user| user.avatar_url.clone()),
                body,
                created_at,
                replies,
                url: value_string(&top_level_comment, "html_url"),
                path: value_string(&top_level_comment, "path"),
                line: value_u64(&top_level_comment, "line"),
            },
        ));
    }

    items.sort_by(|left, right| left.0.cmp(&right.0));
    items.into_iter().map(|(_, item)| item).collect()
}

fn map_activity_reply(value: &Value) -> Option<PullRequestActivityReply> {
    let created_at = value_string(value, "created_at")?;
    let body = value_string(value, "body")?;
    let author = value.get("user").and_then(user_identity_from_value);
    Some(PullRequestActivityReply {
        id: value_u64(value, "id")
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("reply-{created_at}")),
        author_login: author.as_ref().map(|user| user.login.clone()),
        author_avatar_url: author.as_ref().and_then(|user| user.avatar_url.clone()),
        body,
        created_at,
        url: value_string(value, "html_url"),
    })
}

fn map_review_event(
    review: &Value,
    created_at: String,
    author: Option<&UserIdentity>,
) -> Option<PullRequestActivityItem> {
    let event = match value_string(review, "state")?.to_ascii_uppercase().as_str() {
        "APPROVED" => "approved",
        "CHANGES_REQUESTED" => "changes_requested",
        _ => return None,
    };
    Some(PullRequestActivityItem::Event {
        event: event.to_string(),
        actor_login: author.map(|user| user.login.clone()),
        created_at,
    })
}

fn compute_board_state(value: &Value, ci_status: &str) -> &'static str {
    if value_string(value, "state")
        .map(|state| state.eq_ignore_ascii_case("merged"))
        .unwrap_or(false)
    {
        return "merged";
    }
    if value_bool(value, "isDraft") {
        return "draft";
    }
    if ci_status == "failing" || mergeable_is_blocked(value) {
        return "failing";
    }
    if ci_status == "pending" || merge_state_is_in_progress(value) {
        return "in_progress";
    }
    "ready"
}

fn compute_can_merge(is_draft: bool, ci_status: &str, value: &Value) -> bool {
    !is_draft && ci_status == "passing" && !mergeable_is_blocked(value)
}

fn compute_ci_status_from_checks(checks: &[PullRequestCheck]) -> String {
    if checks.is_empty() {
        return "none".to_string();
    }
    if checks.iter().any(|check| check.status == "failing") {
        return "failing".to_string();
    }
    if checks.iter().any(|check| check.status == "pending") {
        return "pending".to_string();
    }
    "passing".to_string()
}

fn compute_ci_status_from_rollup(value: Option<&Value>) -> String {
    let Some(entries) = value.and_then(Value::as_array) else {
        return "none".to_string();
    };
    let checks = entries
        .iter()
        .map(|entry| PullRequestCheck {
            status: map_rollup_status(entry).to_string(),
            label: value_string(entry, "name")
                .or_else(|| value_string(entry, "context"))
                .unwrap_or_else(|| "Status check".to_string()),
            description: value_string(entry, "description"),
            link: value_string(entry, "targetUrl").or_else(|| value_string(entry, "detailsUrl")),
        })
        .collect::<Vec<_>>();
    compute_ci_status_from_checks(&checks)
}

fn compute_checks_from_rollup(value: Option<&Value>) -> Vec<PullRequestCheck> {
    value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .map(|entry| PullRequestCheck {
                    status: map_rollup_status(entry).to_string(),
                    label: value_string(entry, "name")
                        .or_else(|| value_string(entry, "context"))
                        .unwrap_or_else(|| "Status check".to_string()),
                    description: value_string(entry, "description"),
                    link: value_string(entry, "targetUrl")
                        .or_else(|| value_string(entry, "detailsUrl")),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn compute_review_status(pr_value: &Value, reviews: &[Value]) -> String {
    match value_string(pr_value, "reviewDecision")
        .unwrap_or_default()
        .to_ascii_uppercase()
        .as_str()
    {
        "APPROVED" => "approved".to_string(),
        "CHANGES_REQUESTED" => "changes_requested".to_string(),
        "REVIEW_REQUIRED" => "none".to_string(),
        _ if reviews.iter().any(|review| {
            value_string(review, "state")
                .map(|state| state.eq_ignore_ascii_case("commented"))
                .unwrap_or(false)
        }) =>
        {
            "commented".to_string()
        }
        _ => "none".to_string(),
    }
}

fn mergeable_is_blocked(value: &Value) -> bool {
    match value_string(value, "mergeable")
        .unwrap_or_default()
        .to_ascii_uppercase()
        .as_str()
    {
        "CONFLICTING" => true,
        _ => matches!(
            value_string(value, "mergeStateStatus")
                .unwrap_or_default()
                .to_ascii_uppercase()
                .as_str(),
            "BLOCKED" | "DIRTY"
        ),
    }
}

fn merge_state_is_in_progress(value: &Value) -> bool {
    matches!(
        value_string(value, "mergeStateStatus")
            .unwrap_or_default()
            .to_ascii_uppercase()
            .as_str(),
        "BEHIND" | "UNSTABLE" | "HAS_HOOKS" | "UNKNOWN"
    )
}

fn map_rollup_status(value: &Value) -> &'static str {
    let candidates = [
        value_string(value, "conclusion"),
        value_string(value, "state"),
        value_string(value, "status"),
    ];
    let normalized = candidates
        .into_iter()
        .flatten()
        .map(|value| value.to_ascii_lowercase())
        .find(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    map_check_status(&normalized)
}

fn map_check_status(value: &str) -> &'static str {
    match value.to_ascii_lowercase().as_str() {
        "success" | "successful" | "pass" | "passed" | "completed" => "successful",
        "skipped" | "neutral" => "skipped",
        "pending" | "queued" | "in_progress" | "requested" | "waiting" => "pending",
        "action_required" | "cancelled" | "failure" | "fail" | "startup_failure" | "timed_out" => {
            "failing"
        }
        _ => "unknown",
    }
}

fn command_status_envelope(result: Result<(), String>) -> CommandStatusEnvelope {
    match result {
        Ok(()) => CommandStatusEnvelope::Success(SuccessEnvelope {
            status: SUCCESS_STATUS,
        }),
        Err(err) => CommandStatusEnvelope::Error(error_envelope(err)),
    }
}

fn empty_pull_request_status() -> PullRequestStatusSuccess {
    PullRequestStatusSuccess {
        status: SUCCESS_STATUS,
        activity_items: Vec::new(),
        board_item: None,
        body: String::new(),
        can_merge: false,
        checks: Vec::new(),
        ci_status: "none".to_string(),
        comment_attachments: Vec::new(),
        has_open_pr: false,
        is_auto_merge_enabled: false,
        is_draft: false,
        number: None,
        repo: None,
        reviewers: PullRequestReviewers {
            approved: Vec::new(),
            comment_counts: Vec::new(),
            commented: Vec::new(),
            changes_requested: Vec::new(),
            requested: Vec::new(),
            unresolved_comment_count: 0,
        },
        review_status: "none".to_string(),
        url: None,
    }
}

fn error_envelope(error: String) -> ErrorEnvelope {
    ErrorEnvelope {
        status: ERROR_STATUS,
        error,
    }
}

fn pull_request_selector(params: &PullRequestLookupParams) -> Result<String, String> {
    if let Some(number) = params.number {
        return Ok(number.to_string());
    }
    normalize_required_string(&params.head_branch, "headBranch")
}

fn merge_method_flag(value: &str) -> Result<&'static str, String> {
    match normalize_required_string(value, "mergeMethod")?.as_str() {
        "merge" => Ok("--merge"),
        "squash" => Ok("--squash"),
        "rebase" => Ok("--rebase"),
        other => Err(format!("Unsupported merge method: {other}")),
    }
}

fn parse_repo(repo: &str) -> Result<ParsedRepo, String> {
    let normalized = normalize_required_string(repo, "repo")?;
    let parts = normalized.split('/').collect::<Vec<_>>();
    if parts.len() < 2 {
        return Err(format!("repo is invalid: {normalized}"));
    }
    if parts.len() == 2 {
        return Ok(ParsedRepo {
            host: None,
            repo_path: normalized,
        });
    }
    if looks_like_host(parts[0]) {
        return Ok(ParsedRepo {
            host: Some(parts[0].to_string()),
            repo_path: parts[1..].join("/"),
        });
    }
    Ok(ParsedRepo {
        host: None,
        repo_path: normalized,
    })
}

fn looks_like_host(value: &str) -> bool {
    value.contains('.') || value.contains(':') || value.eq_ignore_ascii_case("localhost")
}

fn resolve_repo_name(request_repo: Option<&str>, url: Option<String>) -> Option<String> {
    normalized_optional_string(request_repo)
        .or_else(|| url.and_then(|url| repo_from_pull_request_url(&url)))
}

fn repo_from_pull_request_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    let (_, rest) = trimmed.split_once("://")?;
    let mut parts = rest.split('/').filter(|value| !value.is_empty());
    let host = parts.next()?;
    let owner = parts.next()?;
    let repo = parts.next()?;
    if host.eq_ignore_ascii_case("github.com") {
        return Some(format!("{owner}/{repo}"));
    }
    Some(format!("{host}/{owner}/{repo}"))
}

fn user_identity_from_value(value: &Value) -> Option<UserIdentity> {
    let login = value_string(value, "login")
        .or_else(|| value_string(value, "name"))
        .filter(|value| !value.is_empty())?;
    Some(UserIdentity {
        login,
        avatar_url: value_string(value, "avatarUrl").or_else(|| value_string(value, "avatar_url")),
        url: value_string(value, "url").or_else(|| value_string(value, "html_url")),
    })
}

fn value_string(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_string)
}

fn value_u64(value: &Value, key: &str) -> Option<u64> {
    value.get(key)?.as_u64()
}

fn value_bool(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn is_no_pull_request_error(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("no pull requests found")
        || normalized.contains("no pull request found")
        || normalized.contains("could not find pull request")
}

fn normalize_required_string(value: &str, field_name: &str) -> Result<String, String> {
    normalized_optional_string(Some(value)).ok_or_else(|| format!("{field_name} is empty"))
}

fn normalized_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

async fn run_gh_json(
    app: &AppHandle,
    host_id: Option<&str>,
    arguments: Vec<String>,
    cwd: Option<String>,
    allowed_exit_codes: &[i32],
) -> Result<Value, String> {
    let output = run_gh(app, host_id, arguments, cwd, allowed_exit_codes).await?;
    serde_json::from_str(&output.stdout).map_err(|err| {
        let detail = if output.stdout.trim().is_empty() {
            output.stderr
        } else {
            output.stdout
        };
        format!("GitHub CLI returned invalid JSON: {err}. Output: {detail}")
    })
}

async fn run_gh(
    app: &AppHandle,
    host_id: Option<&str>,
    arguments: Vec<String>,
    cwd: Option<String>,
    allowed_exit_codes: &[i32],
) -> Result<HostedCommandOutput, String> {
    run_hosted_command(
        app,
        host_id,
        "gh",
        arguments,
        cwd,
        allowed_exit_codes,
        GH_NOT_INSTALLED_ERROR,
    )
    .await
}

#[derive(Debug, Default)]
struct PullRequestTimeline {
    activity_items: Vec<PullRequestActivityItem>,
    review_comments: Vec<Value>,
    reviews: Vec<Value>,
    current_user_login: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::build_board_item_from_value;
    use super::command_status_envelope;
    use super::compute_board_state;
    use super::compute_ci_status_from_checks;
    use super::error_envelope;
    use super::merge_method_flag;
    use super::parse_repo;
    use super::repo_from_pull_request_url;
    use super::CommandStatusEnvelope;
    use super::ErrorEnvelope;
    use super::HostOnlyParams;
    use super::PullRequestBoardItem;
    use super::PullRequestCommentParams;
    use super::PullRequestDiffParams;
    use super::PullRequestUpdateParams;
    use serde_json::json;

    #[test]
    fn host_only_params_accept_local_shape() {
        let params: HostOnlyParams = serde_json::from_value(json!({
            "hostId": "local"
        }))
        .expect("params should deserialize");

        assert_eq!(params.host_id, Some("local".to_string()));
    }

    #[test]
    fn comment_params_accept_inline_comment_shape() {
        let params: PullRequestCommentParams = serde_json::from_value(json!({
            "body": "Ship it",
            "cwd": "D:/repo",
            "hostId": "local",
            "number": 7,
            "repo": "openai/codex",
            "inlineComment": {
                "path": "src/main.rs",
                "side": "RIGHT",
                "line": 42,
                "startLine": 40,
                "startSide": "LEFT"
            }
        }))
        .expect("comment params should deserialize");

        assert_eq!(
            params
                .inline_comment
                .expect("inline comment should exist")
                .line,
            42
        );
    }

    #[test]
    fn update_params_accept_toggle_auto_merge_shape() {
        let params: PullRequestUpdateParams = serde_json::from_value(json!({
            "cwd": "D:/repo",
            "hostId": "local",
            "number": 7,
            "repo": "openai/codex",
            "action": "toggle-auto-merge",
            "enabled": true,
            "mergeMethod": "squash"
        }))
        .expect("update params should deserialize");

        assert_eq!(params.merge_method, Some("squash".to_string()));
    }

    #[test]
    fn diff_params_accept_query_shape() {
        let params: PullRequestDiffParams = serde_json::from_value(json!({
            "cwd": "D:/repo",
            "hostId": "local",
            "number": 7,
            "repo": "openai/codex"
        }))
        .expect("diff params should deserialize");

        assert_eq!(params.repo, Some("openai/codex".to_string()));
    }

    #[test]
    fn merge_method_flags_match_supported_methods() {
        assert_eq!(
            merge_method_flag("merge").expect("merge should be supported"),
            "--merge"
        );
        assert_eq!(
            merge_method_flag("squash").expect("squash should be supported"),
            "--squash"
        );
        assert_eq!(
            merge_method_flag("rebase").expect("rebase should be supported"),
            "--rebase"
        );
    }

    #[test]
    fn repo_parser_understands_enterprise_prefixes() {
        let parsed =
            parse_repo("ghe.example.com/openai/codex").expect("enterprise repo should parse");

        assert_eq!(parsed.host, Some("ghe.example.com".to_string()));
        assert_eq!(parsed.repo_path, "openai/codex".to_string());
    }

    #[test]
    fn repo_can_be_derived_from_pull_request_url() {
        assert_eq!(
            repo_from_pull_request_url("https://github.com/openai/codex/pull/7"),
            Some("openai/codex".to_string())
        );
        assert_eq!(
            repo_from_pull_request_url("https://ghe.example.com/openai/codex/pull/7"),
            Some("ghe.example.com/openai/codex".to_string())
        );
    }

    #[test]
    fn board_state_prefers_draft_and_merged_then_ci_status() {
        let ready = json!({
            "state": "OPEN",
            "isDraft": false,
            "mergeable": "MERGEABLE",
            "mergeStateStatus": "CLEAN"
        });
        let draft = json!({
            "state": "OPEN",
            "isDraft": true,
            "mergeable": "MERGEABLE"
        });
        let merged = json!({
            "state": "MERGED",
            "isDraft": false
        });

        assert_eq!(compute_board_state(&ready, "passing"), "ready");
        assert_eq!(compute_board_state(&ready, "pending"), "in_progress");
        assert_eq!(compute_board_state(&ready, "failing"), "failing");
        assert_eq!(compute_board_state(&draft, "passing"), "draft");
        assert_eq!(compute_board_state(&merged, "passing"), "merged");
    }

    #[test]
    fn ci_status_rolls_up_from_checks() {
        assert_eq!(compute_ci_status_from_checks(&[]), "none");
        assert_eq!(
            compute_ci_status_from_checks(&[super::PullRequestCheck {
                status: "successful".to_string(),
                label: "build".to_string(),
                description: None,
                link: None,
            }]),
            "passing"
        );
        assert_eq!(
            compute_ci_status_from_checks(&[super::PullRequestCheck {
                status: "pending".to_string(),
                label: "build".to_string(),
                description: None,
                link: None,
            }]),
            "pending"
        );
        assert_eq!(
            compute_ci_status_from_checks(&[super::PullRequestCheck {
                status: "failing".to_string(),
                label: "build".to_string(),
                description: None,
                link: None,
            }]),
            "failing"
        );
    }

    #[test]
    fn board_item_maps_from_gh_list_value() {
        let value = json!({
            "url": "https://github.com/openai/codex/pull/7",
            "number": 7,
            "title": "Improve PR support",
            "headRefName": "feature/pr",
            "baseRefName": "main",
            "additions": 12,
            "deletions": 4,
            "state": "OPEN",
            "isDraft": false,
            "mergeable": "MERGEABLE",
            "mergeStateStatus": "CLEAN",
            "author": {
                "login": "octocat"
            },
            "statusCheckRollup": [{
                "name": "build",
                "conclusion": "SUCCESS"
            }]
        });

        let item = build_board_item_from_value(
            "D:/repo",
            Some("local".to_string()),
            Some("openai/codex".to_string()),
            &value,
            Some("octocat"),
        )
        .expect("board item should map");

        assert_eq!(
            item,
            PullRequestBoardItem {
                cwd: "D:/repo".to_string(),
                head_branch: "feature/pr".to_string(),
                host_id: Some("local".to_string()),
                url: "https://github.com/openai/codex/pull/7".to_string(),
                number: 7,
                state: "ready".to_string(),
                additions: 12,
                deletions: 4,
                title: "Improve PR support".to_string(),
                repo: Some("openai/codex".to_string()),
                base_branch: "main".to_string(),
                is_author: true,
                can_merge: true,
            }
        );
    }

    #[test]
    fn mutation_success_envelope_serializes_expected_shape() {
        let value = serde_json::to_value(command_status_envelope(Ok(())))
            .expect("success envelope should serialize");

        assert_eq!(value, json!({ "status": "success" }));
    }

    #[test]
    fn mutation_error_envelope_serializes_expected_shape() {
        let value = serde_json::to_value(CommandStatusEnvelope::Error(error_envelope(
            "GitHub CLI is not installed.".to_string(),
        )))
        .expect("error envelope should serialize");

        assert_eq!(
            value,
            json!({
                "status": "error",
                "error": "GitHub CLI is not installed."
            })
        );
    }

    #[test]
    fn error_envelope_uses_expected_status_literal() {
        assert_eq!(
            error_envelope("boom".to_string()),
            ErrorEnvelope {
                status: "error",
                error: "boom".to_string(),
            }
        );
    }
}
