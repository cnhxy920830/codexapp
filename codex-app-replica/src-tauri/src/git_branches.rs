use crate::open_targets::ensure_supported_host_id;
use serde::Deserialize;
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::Path;
use std::process::Command;
use tauri::async_runtime::spawn_blocking;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchesParams {
    pub git_root: String,
    pub query: Option<String>,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchesResponse {
    pub current_branch: Option<String>,
    pub default_branch: Option<String>,
    pub recent_branches: Vec<String>,
    pub search_branches: Vec<String>,
    pub has_working_tree_changes: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCheckoutBranchParams {
    pub git_root: String,
    pub branch: String,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCreateBranchParams {
    pub git_root: String,
    pub branch: String,
    pub fail_if_exists: Option<bool>,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitChangesParams {
    pub git_root: String,
    pub message: String,
    pub include_unstaged: Option<bool>,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDialogStateParams {
    pub git_root: String,
    pub host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitBranchMutationStatus {
    Success,
    Error,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitBranchMutationErrorType {
    BlockedByWorkingTreeChanges,
    BranchAlreadyExists,
    InvalidBranchName,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchMutationResponse {
    pub status: GitBranchMutationStatus,
    pub error: Option<String>,
    pub error_type: Option<GitBranchMutationErrorType>,
    pub conflicted_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitChangeSummary {
    pub files: usize,
    pub file_paths: Vec<String>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDialogStateResponse {
    pub current_branch: Option<String>,
    pub staged_summary: GitChangeSummary,
    pub unstaged_summary: GitChangeSummary,
    pub tracked_changes_unified_diff: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WorkingTreeStatusSummary {
    staged_count: usize,
    unstaged_count: usize,
    untracked_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitCommandOutput {
    stdout: String,
    stderr: String,
    success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitBranchMutationError {
    message: String,
    error_type: Option<GitBranchMutationErrorType>,
    conflicted_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiffStatSummary {
    files: BTreeSet<String>,
    total_additions: usize,
    total_deletions: usize,
}

#[tauri::command(rename = "git-branches-read")]
pub async fn git_branches_read(params: GitBranchesParams) -> Result<GitBranchesResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-branches-read")?;

    let git_root = params.git_root.trim().to_string();
    if git_root.is_empty() {
        return Err("git root is empty".to_string());
    }

    spawn_blocking(move || resolve_git_branches(&git_root, params.query.as_deref()))
        .await
        .map_err(|error| format!("failed to read git branches: {error}"))?
}

#[tauri::command(rename = "git-commit-dialog-read")]
pub async fn git_commit_dialog_read(
    params: GitCommitDialogStateParams,
) -> Result<GitCommitDialogStateResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-commit-dialog-read")?;

    let git_root = normalize_required_path(&params.git_root, "git root")?;

    spawn_blocking(move || resolve_git_commit_dialog_state(&git_root))
        .await
        .map_err(|error| format!("failed to read git commit dialog state: {error}"))?
}

#[tauri::command(rename = "git-checkout-branch")]
pub async fn git_checkout_branch(
    params: GitCheckoutBranchParams,
) -> Result<GitBranchMutationResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-checkout-branch")?;

    let git_root = normalize_required_path(&params.git_root, "git root")?;
    let branch = normalize_required_value(&params.branch, "branch")?;

    spawn_blocking(move || {
        Ok::<_, String>(
            run_checkout_branch(&git_root, &branch)
                .map_or_else(GitBranchMutationResponse::error, |_| {
                    GitBranchMutationResponse::success()
                }),
        )
    })
    .await
    .map_err(|error| format!("failed to checkout git branch: {error}"))?
}

#[tauri::command(rename = "git-create-branch")]
pub async fn git_create_branch(
    params: GitCreateBranchParams,
) -> Result<GitBranchMutationResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-create-branch")?;

    let git_root = normalize_required_path(&params.git_root, "git root")?;
    let branch = normalize_required_value(&params.branch, "branch")?;
    let fail_if_exists = params.fail_if_exists.unwrap_or(false);

    spawn_blocking(move || {
        Ok::<_, String>(
            run_create_branch(&git_root, &branch, fail_if_exists)
                .map_or_else(GitBranchMutationResponse::error, |_| {
                    GitBranchMutationResponse::success()
                }),
        )
    })
    .await
    .map_err(|error| format!("failed to create git branch: {error}"))?
}

#[tauri::command(rename = "git-commit-changes")]
pub async fn git_commit_changes(
    params: GitCommitChangesParams,
) -> Result<GitBranchMutationResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "git-commit-changes")?;

    let git_root = normalize_required_path(&params.git_root, "git root")?;
    let message = normalize_required_value(&params.message, "message")?;
    let include_unstaged = params.include_unstaged.unwrap_or(true);

    spawn_blocking(move || {
        Ok::<_, String>(
            run_commit_changes(&git_root, &message, include_unstaged)
                .map_or_else(GitBranchMutationResponse::error, |_| {
                    GitBranchMutationResponse::success()
                }),
        )
    })
    .await
    .map_err(|error| format!("failed to commit git changes: {error}"))?
}

fn resolve_git_branches(
    git_root: &str,
    query: Option<&str>,
) -> Result<GitBranchesResponse, String> {
    let all_local_branches = list_local_branches(git_root)?;
    let current_branch =
        normalize_branch_name(&run_git(git_root, &["rev-parse", "--abbrev-ref", "HEAD"])?);
    let default_branch = resolve_default_branch(git_root);
    let working_tree_summary = read_working_tree_status(git_root)?;
    let normalized_query = query
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase);

    let search_branches = match normalized_query.as_deref() {
        Some(query) => all_local_branches
            .iter()
            .filter(|branch| branch.to_lowercase().contains(query))
            .cloned()
            .collect(),
        None => Vec::new(),
    };
    let has_working_tree_changes = working_tree_summary.has_changes();

    Ok(GitBranchesResponse {
        current_branch,
        default_branch,
        recent_branches: all_local_branches,
        search_branches,
        has_working_tree_changes,
        staged_count: working_tree_summary.staged_count,
        unstaged_count: working_tree_summary.unstaged_count,
        untracked_count: working_tree_summary.untracked_count,
    })
}

fn resolve_git_commit_dialog_state(git_root: &str) -> Result<GitCommitDialogStateResponse, String> {
    let current_branch =
        normalize_branch_name(&run_git(git_root, &["rev-parse", "--abbrev-ref", "HEAD"])?);
    let working_tree_summary = read_working_tree_status(git_root)?;
    let staged_summary = read_diff_stat_summary(git_root, true, false)?;
    let unstaged_summary = read_diff_stat_summary(git_root, false, true)?
        .with_untracked_count(working_tree_summary.untracked_count);
    let tracked_changes_unified_diff = read_tracked_changes_unified_diff(git_root)?;

    Ok(GitCommitDialogStateResponse {
        current_branch,
        staged_summary: staged_summary.into_change_summary(),
        unstaged_summary: unstaged_summary.into_change_summary(),
        tracked_changes_unified_diff,
    })
}

fn list_local_branches(git_root: &str) -> Result<Vec<String>, String> {
    let output = run_git(
        git_root,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "--sort=-committerdate",
            "refs/heads",
        ],
    )?;

    Ok(output.lines().filter_map(normalize_branch_name).collect())
}

fn read_working_tree_status(git_root: &str) -> Result<WorkingTreeStatusSummary, String> {
    let output = run_git(git_root, &["status", "--porcelain"])?;
    Ok(parse_working_tree_status(&output))
}

fn read_diff_stat_summary(
    git_root: &str,
    staged: bool,
    include_untracked: bool,
) -> Result<DiffStatSummary, String> {
    let args = if staged {
        vec!["diff", "--cached", "--numstat", "--find-renames"]
    } else {
        vec!["diff", "--numstat", "--find-renames"]
    };
    let output = run_git(git_root, &args)?;
    Ok(parse_diff_stat_summary(&output, include_untracked))
}

fn read_tracked_changes_unified_diff(git_root: &str) -> Result<Option<String>, String> {
    let staged_diff = run_git(
        git_root,
        &["diff", "--cached", "--no-ext-diff", "--find-renames"],
    )?;
    let unstaged_diff = run_git(git_root, &["diff", "--no-ext-diff", "--find-renames"])?;

    let sections = [staged_diff, unstaged_diff]
        .into_iter()
        .map(|diff| diff.trim().to_string())
        .filter(|diff| !diff.is_empty())
        .collect::<Vec<_>>();
    if sections.is_empty() {
        return Ok(None);
    }

    Ok(Some(sections.join("\n\n")))
}

fn resolve_default_branch(git_root: &str) -> Option<String> {
    run_git(
        git_root,
        &[
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ],
    )
    .ok()
    .and_then(|value| {
        normalize_branch_name(&value).map(|branch| {
            branch
                .strip_prefix("origin/")
                .unwrap_or(branch.as_str())
                .to_string()
        })
    })
}

fn normalize_branch_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed == "HEAD" {
        return None;
    }
    Some(trimmed.to_string())
}

fn normalize_required_path(value: &str, field_name: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field_name} is empty"));
    }
    Ok(trimmed.to_string())
}

fn normalize_required_value(value: &str, field_name: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field_name} is empty"));
    }
    Ok(trimmed.to_string())
}

fn validate_branch_name(git_root: &str, branch: &str) -> Result<(), GitBranchMutationError> {
    let output =
        run_git_capture(git_root, &["check-ref-format", "--branch", branch]).map_err(|error| {
            GitBranchMutationError {
                message: error,
                error_type: Some(GitBranchMutationErrorType::InvalidBranchName),
                conflicted_paths: None,
            }
        })?;
    if output.success {
        return Ok(());
    }

    Err(GitBranchMutationError {
        message: normalize_git_error(&output).unwrap_or_else(|| "invalid branch name".to_string()),
        error_type: Some(GitBranchMutationErrorType::InvalidBranchName),
        conflicted_paths: None,
    })
}

fn run_checkout_branch(git_root: &str, branch: &str) -> Result<(), GitBranchMutationError> {
    validate_branch_name(git_root, branch)?;

    let output = run_git_capture(git_root, &["checkout", "--quiet", branch]).map_err(|error| {
        GitBranchMutationError {
            message: error,
            error_type: None,
            conflicted_paths: None,
        }
    })?;
    if output.success {
        return Ok(());
    }

    if let Some(conflicted_paths) = parse_checkout_conflicted_paths(&output.stderr) {
        return Err(GitBranchMutationError {
            message: normalize_git_error(&output)
                .unwrap_or_else(|| "working tree changes would be overwritten".to_string()),
            error_type: Some(GitBranchMutationErrorType::BlockedByWorkingTreeChanges),
            conflicted_paths: Some(conflicted_paths),
        });
    }

    Err(GitBranchMutationError {
        message: normalize_git_error(&output)
            .unwrap_or_else(|| "failed to checkout branch".to_string()),
        error_type: None,
        conflicted_paths: None,
    })
}

fn run_create_branch(
    git_root: &str,
    branch: &str,
    fail_if_exists: bool,
) -> Result<(), GitBranchMutationError> {
    validate_branch_name(git_root, branch)?;

    let output =
        run_git_capture(git_root, &["branch", branch]).map_err(|error| GitBranchMutationError {
            message: error,
            error_type: None,
            conflicted_paths: None,
        })?;
    if output.success {
        return Ok(());
    }

    let error_message =
        normalize_git_error(&output).unwrap_or_else(|| "failed to create branch".to_string());
    if fail_if_exists && error_message.to_lowercase().contains("already exists") {
        return Err(GitBranchMutationError {
            message: error_message,
            error_type: Some(GitBranchMutationErrorType::BranchAlreadyExists),
            conflicted_paths: None,
        });
    }

    Err(GitBranchMutationError {
        message: error_message,
        error_type: None,
        conflicted_paths: None,
    })
}

fn run_commit_changes(
    git_root: &str,
    message: &str,
    include_unstaged: bool,
) -> Result<(), GitBranchMutationError> {
    if include_unstaged {
        let add_output = run_git_capture(git_root, &["add", "--all"]).map_err(|error| {
            GitBranchMutationError {
                message: error,
                error_type: None,
                conflicted_paths: None,
            }
        })?;
        if !add_output.success {
            return Err(GitBranchMutationError {
                message: normalize_git_error(&add_output)
                    .unwrap_or_else(|| "failed to stage changes".to_string()),
                error_type: None,
                conflicted_paths: None,
            });
        }
    }

    let commit_output = run_git_capture(git_root, &["commit", "-m", message]).map_err(|error| {
        GitBranchMutationError {
            message: error,
            error_type: None,
            conflicted_paths: None,
        }
    })?;
    if commit_output.success {
        return Ok(());
    }

    Err(GitBranchMutationError {
        message: normalize_git_error(&commit_output)
            .unwrap_or_else(|| "failed to commit changes".to_string()),
        error_type: None,
        conflicted_paths: None,
    })
}

fn parse_working_tree_status(output: &str) -> WorkingTreeStatusSummary {
    let mut staged_paths = BTreeSet::new();
    let mut unstaged_paths = BTreeSet::new();
    let mut untracked_paths = BTreeSet::new();

    for line in output.lines().filter(|line| !line.trim().is_empty()) {
        if let Some(path) = extract_status_path(line) {
            if line.starts_with("??") {
                untracked_paths.insert(path);
                continue;
            }

            let status = line.as_bytes();
            if status.first().is_some_and(|value| *value != b' ') {
                staged_paths.insert(path.clone());
            }
            if status.get(1).is_some_and(|value| *value != b' ') {
                unstaged_paths.insert(path);
            }
        }
    }

    WorkingTreeStatusSummary {
        staged_count: staged_paths.len(),
        unstaged_count: unstaged_paths.len(),
        untracked_count: untracked_paths.len(),
    }
}

fn parse_diff_stat_summary(output: &str, include_untracked: bool) -> DiffStatSummary {
    let mut summary = DiffStatSummary::default();

    for line in output.lines().filter(|line| !line.trim().is_empty()) {
        if let Some((path, additions, deletions)) = parse_diff_stat_line(line) {
            summary.files.insert(path);
            summary.total_additions += additions;
            summary.total_deletions += deletions;
        }
    }

    if !include_untracked {
        return summary;
    }

    summary
}

fn parse_diff_stat_line(line: &str) -> Option<(String, usize, usize)> {
    let mut parts = line.splitn(3, '\t');
    let additions = parts.next()?;
    let deletions = parts.next()?;
    let path = parts.next()?.trim();
    if path.is_empty() {
        return None;
    }

    Some((
        path.to_string(),
        parse_diff_stat_count(additions),
        parse_diff_stat_count(deletions),
    ))
}

fn parse_diff_stat_count(value: &str) -> usize {
    value.parse::<usize>().unwrap_or(0)
}

fn extract_status_path(line: &str) -> Option<String> {
    let path = line.get(3..)?.trim();
    if path.is_empty() {
        return None;
    }

    let resolved = if let Some((_, renamed_path)) = path.split_once(" -> ") {
        renamed_path
    } else {
        path
    };
    Some(resolved.trim().to_string())
}

fn parse_checkout_conflicted_paths(stderr: &str) -> Option<Vec<String>> {
    const MARKERS: [&str; 2] = [
        "Your local changes to the following files would be overwritten by checkout:",
        "The following untracked working tree files would be overwritten by checkout:",
    ];

    for marker in MARKERS {
        if let Some(paths) = collect_conflicted_paths_after_marker(stderr, marker) {
            return Some(paths);
        }
    }

    None
}

fn collect_conflicted_paths_after_marker(stderr: &str, marker: &str) -> Option<Vec<String>> {
    let mut collecting = false;
    let mut paths = Vec::new();

    for line in stderr.lines() {
        if collecting {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("Please ") || trimmed == "Aborting" {
                break;
            }
            paths.push(trimmed.to_string());
            continue;
        }

        if line.contains(marker) {
            collecting = true;
        }
    }

    if paths.is_empty() {
        None
    } else {
        Some(paths)
    }
}

fn normalize_git_error(output: &GitCommandOutput) -> Option<String> {
    let stderr = output.stderr.trim();
    if !stderr.is_empty() {
        return Some(stderr.to_string());
    }

    let stdout = output.stdout.trim();
    if !stdout.is_empty() {
        return Some(stdout.to_string());
    }

    None
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = run_git_capture(cwd, args)?;
    if output.success {
        return Ok(output.stdout.trim().to_string());
    }

    Err(normalize_git_error(&output)
        .unwrap_or_else(|| "git command failed without output".to_string()))
}

fn run_git_capture(cwd: &str, args: &[&str]) -> Result<GitCommandOutput, String> {
    let mut command = Command::new("git");
    apply_no_window(&mut command);
    let output = command
        .arg("-C")
        .arg(Path::new(cwd))
        .args(args)
        .output()
        .map_err(|error| format!("failed to run git: {error}"))?;

    Ok(GitCommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}

fn apply_no_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

impl WorkingTreeStatusSummary {
    fn has_changes(&self) -> bool {
        self.staged_count > 0 || self.unstaged_count > 0 || self.untracked_count > 0
    }
}

impl Default for DiffStatSummary {
    fn default() -> Self {
        Self {
            files: BTreeSet::new(),
            total_additions: 0,
            total_deletions: 0,
        }
    }
}

impl DiffStatSummary {
    fn with_untracked_count(mut self, untracked_count: usize) -> Self {
        for index in 0..untracked_count {
            self.files.insert(format!("__untracked__:{index}"));
        }
        self
    }

    fn into_change_summary(self) -> GitChangeSummary {
        let file_paths = self.files.into_iter().collect::<Vec<_>>();
        GitChangeSummary {
            files: file_paths.len(),
            file_paths,
            total_additions: self.total_additions,
            total_deletions: self.total_deletions,
        }
    }
}

impl GitBranchMutationResponse {
    fn success() -> Self {
        Self {
            status: GitBranchMutationStatus::Success,
            error: None,
            error_type: None,
            conflicted_paths: None,
        }
    }

    fn error(error: GitBranchMutationError) -> Self {
        Self {
            status: GitBranchMutationStatus::Error,
            error: Some(error.message),
            error_type: error.error_type,
            conflicted_paths: error.conflicted_paths,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_branch_name_rejects_empty_and_head() {
        assert_eq!(normalize_branch_name(""), None);
        assert_eq!(normalize_branch_name("HEAD"), None);
        assert_eq!(
            normalize_branch_name(" feature/test "),
            Some("feature/test".to_string())
        );
    }

    #[test]
    fn resolve_default_branch_strips_origin_prefix() {
        let branch = normalize_branch_name("origin/main").map(|value| {
            value
                .strip_prefix("origin/")
                .unwrap_or(value.as_str())
                .to_string()
        });

        assert_eq!(branch, Some("main".to_string()));
    }

    #[test]
    fn parse_working_tree_status_counts_unique_paths() {
        let summary = parse_working_tree_status(
            " M src/lib.rs\nM  src/main.rs\nMM src/app.rs\n?? src/new.ts\nR  old.rs -> new.rs\n",
        );

        assert_eq!(
            summary,
            WorkingTreeStatusSummary {
                staged_count: 3,
                unstaged_count: 2,
                untracked_count: 1,
            }
        );
        assert!(summary.has_changes());
    }

    #[test]
    fn parse_checkout_conflicted_paths_extracts_file_list() {
        let stderr = "\
error: Your local changes to the following files would be overwritten by checkout:\n\
\tsrc/App.tsx\n\
\tsrc/features/hotkeyWindow/HotkeyWindowHomePage.tsx\n\
Please commit your changes or stash them before you switch branches.\n\
Aborting\n";

        assert_eq!(
            parse_checkout_conflicted_paths(stderr),
            Some(vec![
                "src/App.tsx".to_string(),
                "src/features/hotkeyWindow/HotkeyWindowHomePage.tsx".to_string(),
            ])
        );
    }

    #[test]
    fn parse_checkout_conflicted_paths_handles_untracked_marker() {
        let stderr = "\
error: The following untracked working tree files would be overwritten by checkout:\n\
\tsrc/new-file.ts\n\
Please move or remove them before you switch branches.\n\
Aborting\n";

        assert_eq!(
            parse_checkout_conflicted_paths(stderr),
            Some(vec!["src/new-file.ts".to_string()])
        );
    }

    #[test]
    fn parse_diff_stat_summary_collects_files_and_line_counts() {
        let summary = parse_diff_stat_summary(
            "12\t4\tsrc/main.rs\n-\t-\tassets/logo.png\n0\t1\tsrc/lib.rs\n",
            false,
        );

        assert_eq!(
            summary.into_change_summary(),
            GitChangeSummary {
                files: 3,
                file_paths: vec![
                    "assets/logo.png".to_string(),
                    "src/lib.rs".to_string(),
                    "src/main.rs".to_string(),
                ],
                total_additions: 12,
                total_deletions: 5,
            }
        );
    }

    #[test]
    fn diff_stat_summary_can_include_untracked_file_count() {
        let summary = parse_diff_stat_summary("3\t1\tsrc/main.rs\n", false).with_untracked_count(2);

        assert_eq!(
            summary.into_change_summary(),
            GitChangeSummary {
                files: 3,
                file_paths: vec![
                    "__untracked__:0".to_string(),
                    "__untracked__:1".to_string(),
                    "src/main.rs".to_string(),
                ],
                total_additions: 3,
                total_deletions: 1,
            }
        );
    }
}
