use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::codex_home::resolve_codex_home;

const SESSIONS_DIR: &str = "sessions";
const DEFAULT_MAX_ROLLOUTS: usize = 128;
const ESTIMATED_STANDARD_MS_PER_GENERATED_TOKEN: i64 = 18;
const ESTIMATED_FAST_MS_PER_GENERATED_TOKEN: i64 = 12;
const ESTIMATED_SAVED_MS_PER_GENERATED_TOKEN: i64 =
    ESTIMATED_STANDARD_MS_PER_GENERATED_TOKEN - ESTIMATED_FAST_MS_PER_GENERATED_TOKEN;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FastModeRolloutMetricsQuery {
    pub params: FastModeRolloutMetricsParams,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FastModeRolloutMetricsParams {
    pub start_time_ms: i64,
    pub end_time_ms: Option<i64>,
    pub max_rollouts: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FastModeRolloutMetricsResponse {
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub max_rollouts: i64,
    pub scanned_rollout_count: i64,
    pub parsed_rollout_count: i64,
    pub rollout_count_with_completed_turns: i64,
    pub rollout_count_with_estimated_turns: i64,
    pub completed_turn_count: i64,
    pub estimated_turn_count: i64,
    pub total_output_tokens: i64,
    pub total_reasoning_output_tokens: i64,
    pub total_generated_tokens: i64,
    pub observed_completed_turn_wall_time_ms: i64,
    pub estimated_standard_ms: i64,
    pub estimated_fast_ms: i64,
    pub estimated_saved_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct NormalizedParams {
    start_time_ms: i64,
    end_time_ms: i64,
    max_rollouts: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RolloutFileEntry {
    modified_at_ms: i64,
    path: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PerRolloutMetrics {
    completed_turn_count: i64,
    estimated_turn_count: i64,
    output_tokens: i64,
    reasoning_output_tokens: i64,
    observed_completed_turn_wall_time_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct CurrentTaskMetrics {
    started_at_ms: Option<i64>,
    output_tokens: i64,
    reasoning_output_tokens: i64,
}

#[tauri::command(rename = "fast-mode-rollout-metrics")]
pub async fn fast_mode_rollout_metrics(
    query: FastModeRolloutMetricsQuery,
) -> Result<FastModeRolloutMetricsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let codex_home = resolve_codex_home()?;
        fast_mode_rollout_metrics_blocking(&codex_home, query.params)
    })
    .await
    .map_err(|err| format!("fast-mode-rollout-metrics task failed: {err}"))?
}

fn fast_mode_rollout_metrics_blocking(
    codex_home: &Path,
    params: FastModeRolloutMetricsParams,
) -> Result<FastModeRolloutMetricsResponse, String> {
    let params = normalize_params(params);
    let mut aggregate = empty_aggregate(params);
    let sessions_root = codex_home.join(SESSIONS_DIR);
    if !sessions_root.exists() {
        return Ok(aggregate);
    }

    let rollout_files =
        collect_rollout_files(&sessions_root, params.start_time_ms, params.max_rollouts)?;
    aggregate.scanned_rollout_count = rollout_files.len() as i64;

    for rollout_file in rollout_files {
        let metrics = match parse_rollout_file(
            &rollout_file.path,
            params.start_time_ms,
            params.end_time_ms,
        ) {
            Ok(metrics) => metrics,
            Err(_) => continue,
        };

        aggregate.parsed_rollout_count = aggregate.parsed_rollout_count.saturating_add(1);
        if metrics.completed_turn_count > 0 {
            aggregate.rollout_count_with_completed_turns = aggregate
                .rollout_count_with_completed_turns
                .saturating_add(1);
        }
        if metrics.estimated_turn_count > 0 {
            aggregate.rollout_count_with_estimated_turns = aggregate
                .rollout_count_with_estimated_turns
                .saturating_add(1);
        }
        aggregate.completed_turn_count = aggregate
            .completed_turn_count
            .saturating_add(metrics.completed_turn_count);
        aggregate.estimated_turn_count = aggregate
            .estimated_turn_count
            .saturating_add(metrics.estimated_turn_count);
        aggregate.total_output_tokens = aggregate
            .total_output_tokens
            .saturating_add(metrics.output_tokens);
        aggregate.total_reasoning_output_tokens = aggregate
            .total_reasoning_output_tokens
            .saturating_add(metrics.reasoning_output_tokens);
        aggregate.observed_completed_turn_wall_time_ms = aggregate
            .observed_completed_turn_wall_time_ms
            .saturating_add(metrics.observed_completed_turn_wall_time_ms);
    }

    Ok(finalize_aggregate(aggregate))
}

fn normalize_params(params: FastModeRolloutMetricsParams) -> NormalizedParams {
    let end_time_ms = params.end_time_ms.unwrap_or_else(now_unix_ms);
    let max_rollouts = params
        .max_rollouts
        .map(normalize_max_rollouts)
        .unwrap_or(DEFAULT_MAX_ROLLOUTS);

    NormalizedParams {
        start_time_ms: params.start_time_ms,
        end_time_ms,
        max_rollouts,
    }
}

fn normalize_max_rollouts(value: f64) -> usize {
    if !value.is_finite() {
        return 1;
    }

    value.floor().max(1.0) as usize
}

fn empty_aggregate(params: NormalizedParams) -> FastModeRolloutMetricsResponse {
    FastModeRolloutMetricsResponse {
        start_time_ms: params.start_time_ms,
        end_time_ms: params.end_time_ms,
        max_rollouts: params.max_rollouts as i64,
        scanned_rollout_count: 0,
        parsed_rollout_count: 0,
        rollout_count_with_completed_turns: 0,
        rollout_count_with_estimated_turns: 0,
        completed_turn_count: 0,
        estimated_turn_count: 0,
        total_output_tokens: 0,
        total_reasoning_output_tokens: 0,
        total_generated_tokens: 0,
        observed_completed_turn_wall_time_ms: 0,
        estimated_standard_ms: 0,
        estimated_fast_ms: 0,
        estimated_saved_ms: 0,
    }
}

fn finalize_aggregate(
    mut aggregate: FastModeRolloutMetricsResponse,
) -> FastModeRolloutMetricsResponse {
    let total_generated_tokens = aggregate
        .total_output_tokens
        .saturating_add(aggregate.total_reasoning_output_tokens);
    aggregate.total_generated_tokens = total_generated_tokens;
    aggregate.estimated_standard_ms =
        total_generated_tokens.saturating_mul(ESTIMATED_STANDARD_MS_PER_GENERATED_TOKEN);
    aggregate.estimated_fast_ms =
        total_generated_tokens.saturating_mul(ESTIMATED_FAST_MS_PER_GENERATED_TOKEN);
    aggregate.estimated_saved_ms =
        total_generated_tokens.saturating_mul(ESTIMATED_SAVED_MS_PER_GENERATED_TOKEN);
    aggregate
}

fn collect_rollout_files(
    sessions_root: &Path,
    start_time_ms: i64,
    max_rollouts: usize,
) -> Result<Vec<RolloutFileEntry>, String> {
    let mut files = Vec::new();

    for year_dir in descending_directories(sessions_root)? {
        for month_dir in descending_directories(&year_dir)? {
            for day_dir in descending_directories(&month_dir)? {
                files.extend(day_rollout_files(&day_dir, start_time_ms));
            }
        }
    }

    files.sort_by(|left, right| right.modified_at_ms.cmp(&left.modified_at_ms));
    files.truncate(max_rollouts);
    Ok(files)
}

fn descending_directories(path: &Path) -> Result<Vec<PathBuf>, String> {
    let mut directories = read_dir_entries(path)?
        .into_iter()
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if file_type.is_dir() {
                Some(entry.path())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    directories.sort_by(|left, right| {
        right
            .file_name()
            .map(|value| value.to_string_lossy())
            .cmp(&left.file_name().map(|value| value.to_string_lossy()))
    });
    Ok(directories)
}

fn day_rollout_files(day_path: &Path, start_time_ms: i64) -> Vec<RolloutFileEntry> {
    let mut files = match read_dir_entries(day_path) {
        Ok(entries) => entries
            .into_iter()
            .filter_map(|entry| {
                let file_type = entry.file_type().ok()?;
                if !file_type.is_file() {
                    return None;
                }

                let file_name = entry.file_name();
                if !file_name.to_string_lossy().ends_with(".jsonl") {
                    return None;
                }

                let path = entry.path();
                let metadata = fs::metadata(&path).ok()?;
                if !metadata.is_file() {
                    return None;
                }

                let modified_at_ms = metadata_modified_at_ms(&metadata).ok()?;
                if modified_at_ms < start_time_ms {
                    return None;
                }

                Some(RolloutFileEntry {
                    modified_at_ms,
                    path,
                })
            })
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };

    files.sort_by(|left, right| {
        right
            .path
            .file_name()
            .map(|value| value.to_string_lossy())
            .cmp(&left.path.file_name().map(|value| value.to_string_lossy()))
    });
    files
}

fn read_dir_entries(path: &Path) -> Result<Vec<fs::DirEntry>, String> {
    match fs::read_dir(path) {
        Ok(entries) => entries
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("failed to read {}: {err}", path.display())),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(err) => Err(format!("failed to read {}: {err}", path.display())),
    }
}

fn metadata_modified_at_ms(metadata: &fs::Metadata) -> Result<i64, String> {
    let modified_at = metadata
        .modified()
        .map_err(|err| format!("failed to read file modified time: {err}"))?;
    unix_time_ms(modified_at)
}

fn unix_time_ms(time: SystemTime) -> Result<i64, String> {
    let duration = time
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("failed to resolve unix timestamp: {err}"))?;
    Ok(duration.as_millis().min(i64::MAX as u128) as i64)
}

fn now_unix_ms() -> i64 {
    unix_time_ms(SystemTime::now()).unwrap_or(0)
}

fn parse_rollout_file(
    path: &Path,
    start_time_ms: i64,
    end_time_ms: i64,
) -> Result<PerRolloutMetrics, String> {
    let file =
        File::open(path).map_err(|err| format!("failed to open {}: {err}", path.display()))?;
    let mut reader = BufReader::new(file);
    let mut buffer = Vec::<u8>::new();
    let mut metrics = PerRolloutMetrics {
        completed_turn_count: 0,
        estimated_turn_count: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        observed_completed_turn_wall_time_ms: 0,
    };
    let mut current_task: Option<CurrentTaskMetrics> = None;

    loop {
        buffer.clear();
        let read = reader
            .read_until(b'\n', &mut buffer)
            .map_err(|err| format!("failed to read {}: {err}", path.display()))?;
        if read == 0 {
            break;
        }

        let line = String::from_utf8_lossy(&buffer);
        let trimmed_line = line.trim_end_matches(['\r', '\n']);
        if trimmed_line.is_empty() {
            continue;
        }

        let entry = match serde_json::from_str::<Value>(trimmed_line) {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.get("type").and_then(Value::as_str) != Some("event_msg") {
            continue;
        }

        let payload = match entry.get("payload") {
            Some(Value::Object(_)) => entry.get("payload").expect("payload should exist"),
            _ => continue,
        };

        let payload_type = payload.get("type").and_then(Value::as_str);
        match payload_type {
            Some("task_started") => {
                current_task = Some(CurrentTaskMetrics {
                    started_at_ms: entry
                        .get("timestamp")
                        .and_then(Value::as_str)
                        .and_then(parse_timestamp_ms),
                    output_tokens: 0,
                    reasoning_output_tokens: 0,
                });
            }
            Some("token_count") => {
                let Some(task) = current_task.as_mut() else {
                    continue;
                };
                let token_usage = payload
                    .get("info")
                    .and_then(Value::as_object)
                    .and_then(|info| info.get("last_token_usage"))
                    .and_then(Value::as_object);
                let output_tokens = token_usage
                    .and_then(|usage| usage.get("output_tokens"))
                    .and_then(Value::as_i64)
                    .unwrap_or(0);
                let reasoning_output_tokens = token_usage
                    .and_then(|usage| usage.get("reasoning_output_tokens"))
                    .and_then(Value::as_i64)
                    .unwrap_or(0);
                if output_tokens <= 0 && reasoning_output_tokens <= 0 {
                    continue;
                }

                task.output_tokens = task.output_tokens.saturating_add(output_tokens);
                task.reasoning_output_tokens = task
                    .reasoning_output_tokens
                    .saturating_add(reasoning_output_tokens);
            }
            Some("task_complete") => {
                let Some(task) = current_task else {
                    continue;
                };
                let completed_at_ms = entry
                    .get("timestamp")
                    .and_then(Value::as_str)
                    .and_then(parse_timestamp_ms);
                if let Some(completed_at_ms) = completed_at_ms {
                    if completed_at_ms >= start_time_ms && completed_at_ms <= end_time_ms {
                        let generated_tokens = task
                            .output_tokens
                            .saturating_add(task.reasoning_output_tokens);
                        metrics.completed_turn_count =
                            metrics.completed_turn_count.saturating_add(1);
                        let wall_time_ms = match task.started_at_ms {
                            Some(started_at_ms) => {
                                completed_at_ms.saturating_sub(started_at_ms).max(0)
                            }
                            None => 0,
                        };
                        metrics.observed_completed_turn_wall_time_ms = metrics
                            .observed_completed_turn_wall_time_ms
                            .saturating_add(wall_time_ms);
                        if generated_tokens > 0 {
                            metrics.estimated_turn_count =
                                metrics.estimated_turn_count.saturating_add(1);
                            metrics.output_tokens =
                                metrics.output_tokens.saturating_add(task.output_tokens);
                            metrics.reasoning_output_tokens = metrics
                                .reasoning_output_tokens
                                .saturating_add(task.reasoning_output_tokens);
                        }
                    }
                }
                current_task = None;
            }
            _ => {}
        }
    }

    Ok(metrics)
}

fn parse_timestamp_ms(value: &str) -> Option<i64> {
    let value = value.trim();
    let (date_part, time_and_offset) = value.split_once('T')?;
    let (year, month, day) = parse_date(date_part)?;
    let (hour, minute, second, millisecond, offset_minutes) =
        parse_time_and_offset(time_and_offset)?;
    let days = days_from_civil(year, month, day)?;
    let seconds_since_midnight = (hour as i64) * 3600 + (minute as i64) * 60 + (second as i64);
    let offset_ms = (offset_minutes as i64) * 60 * 1000;

    Some(
        days.checked_mul(86_400_000)?
            .checked_add(seconds_since_midnight.checked_mul(1000)?)?
            .checked_add(millisecond as i64)?
            .checked_sub(offset_ms)?,
    )
}

fn parse_date(value: &str) -> Option<(i32, u32, u32)> {
    let mut parts = value.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = parts.next()?.parse::<u32>().ok()?;
    let day = parts.next()?.parse::<u32>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    if !(1..=12).contains(&month) {
        return None;
    }
    if day == 0 || day > days_in_month(year, month) {
        return None;
    }
    Some((year, month, day))
}

fn parse_time_and_offset(value: &str) -> Option<(u32, u32, u32, u32, i32)> {
    let offset_separator = value
        .char_indices()
        .skip(1)
        .find(|(_, ch)| *ch == 'Z' || *ch == '+' || *ch == '-')
        .map(|(index, _)| index)?;
    let (time_part, offset_part) = value.split_at(offset_separator);
    let (hour, minute, second, millisecond) = parse_time(time_part)?;
    let offset_minutes = parse_offset(offset_part)?;
    Some((hour, minute, second, millisecond, offset_minutes))
}

fn parse_time(value: &str) -> Option<(u32, u32, u32, u32)> {
    let mut parts = value.split(':');
    let hour = parts.next()?.parse::<u32>().ok()?;
    let minute = parts.next()?.parse::<u32>().ok()?;
    let second_part = parts.next()?;
    if parts.next().is_some() {
        return None;
    }

    let (second, millisecond) = match second_part.split_once('.') {
        Some((second_part, fraction_part)) => {
            let second = second_part.parse::<u32>().ok()?;
            let millisecond = parse_fractional_milliseconds(fraction_part)?;
            (second, millisecond)
        }
        None => (second_part.parse::<u32>().ok()?, 0),
    };

    if hour > 23 || minute > 59 || second > 59 {
        return None;
    }

    Some((hour, minute, second, millisecond))
}

fn parse_fractional_milliseconds(value: &str) -> Option<u32> {
    if value.is_empty() || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }

    let mut digits = value.chars().take(3).collect::<String>();
    while digits.len() < 3 {
        digits.push('0');
    }
    digits.parse::<u32>().ok()
}

fn parse_offset(value: &str) -> Option<i32> {
    if value == "Z" {
        return Some(0);
    }

    let sign = match value.as_bytes().first().copied()? {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let offset = &value[1..];
    let (hours, minutes) = match offset.split_once(':') {
        Some((hours, minutes)) => (hours, minutes),
        None if offset.len() == 4 => (&offset[0..2], &offset[2..4]),
        None => return None,
    };
    let hours = hours.parse::<i32>().ok()?;
    let minutes = minutes.parse::<i32>().ok()?;
    if hours > 23 || minutes > 59 {
        return None;
    }
    Some(sign * (hours * 60 + minutes))
}

fn days_from_civil(year: i32, month: u32, day: u32) -> Option<i64> {
    let month = month as i32;
    let day = day as i32;
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    Some((era * 146_097 + day_of_era - 719_468) as i64)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => 0,
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

#[cfg(test)]
mod tests {
    use super::{
        fast_mode_rollout_metrics_blocking, normalize_params, parse_timestamp_ms,
        FastModeRolloutMetricsParams, FastModeRolloutMetricsResponse,
    };
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[test]
    fn returns_empty_aggregate_when_sessions_directory_is_missing() {
        let codex_home = temp_dir("fast-mode-empty");

        let response = fast_mode_rollout_metrics_blocking(
            &codex_home,
            FastModeRolloutMetricsParams {
                start_time_ms: 0,
                end_time_ms: Some(1000),
                max_rollouts: Some(128.0),
            },
        )
        .expect("query should succeed");

        assert_eq!(
            response,
            FastModeRolloutMetricsResponse {
                start_time_ms: 0,
                end_time_ms: 1000,
                max_rollouts: 128,
                scanned_rollout_count: 0,
                parsed_rollout_count: 0,
                rollout_count_with_completed_turns: 0,
                rollout_count_with_estimated_turns: 0,
                completed_turn_count: 0,
                estimated_turn_count: 0,
                total_output_tokens: 0,
                total_reasoning_output_tokens: 0,
                total_generated_tokens: 0,
                observed_completed_turn_wall_time_ms: 0,
                estimated_standard_ms: 0,
                estimated_fast_ms: 0,
                estimated_saved_ms: 0,
            }
        );

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn aggregates_completed_and_estimated_turns_from_jsonl_rollouts() {
        let codex_home = temp_dir("fast-mode-aggregate");
        let rollout_path = codex_home
            .join("sessions")
            .join("2026")
            .join("05")
            .join("09")
            .join("session-a.jsonl");
        write_rollout(
            &rollout_path,
            &[
                "not-json",
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:01.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"output_tokens":10,"reasoning_output_tokens":2}}}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:05.000Z","payload":{"type":"task_complete"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:10:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:10:10.000Z","payload":{"type":"task_complete"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:20:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:20:01.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"output_tokens":6,"reasoning_output_tokens":4}}}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T02:00:00.000Z","payload":{"type":"task_complete"}}"#,
            ],
        );

        let response = fast_mode_rollout_metrics_blocking(
            &codex_home,
            FastModeRolloutMetricsParams {
                start_time_ms: parse_timestamp_ms("2026-05-09T00:00:00.000Z")
                    .expect("timestamp should parse"),
                end_time_ms: Some(
                    parse_timestamp_ms("2026-05-09T01:00:00.000Z").expect("timestamp should parse"),
                ),
                max_rollouts: Some(128.0),
            },
        )
        .expect("query should succeed");

        assert_eq!(response.scanned_rollout_count, 1);
        assert_eq!(response.parsed_rollout_count, 1);
        assert_eq!(response.rollout_count_with_completed_turns, 1);
        assert_eq!(response.rollout_count_with_estimated_turns, 1);
        assert_eq!(response.completed_turn_count, 2);
        assert_eq!(response.estimated_turn_count, 1);
        assert_eq!(response.total_output_tokens, 10);
        assert_eq!(response.total_reasoning_output_tokens, 2);
        assert_eq!(response.total_generated_tokens, 12);
        assert_eq!(response.observed_completed_turn_wall_time_ms, 15_000);
        assert_eq!(response.estimated_standard_ms, 216);
        assert_eq!(response.estimated_fast_ms, 144);
        assert_eq!(response.estimated_saved_ms, 72);

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn honors_max_rollouts_after_sorting_by_modified_time_descending() {
        let codex_home = temp_dir("fast-mode-max-rollouts");
        let day_dir = codex_home
            .join("sessions")
            .join("2026")
            .join("05")
            .join("09");
        let older_rollout = day_dir.join("older.jsonl");
        let newer_rollout = day_dir.join("newer.jsonl");

        write_rollout(
            &older_rollout,
            &[
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:01.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"output_tokens":5,"reasoning_output_tokens":0}}}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:02.000Z","payload":{"type":"task_complete"}}"#,
            ],
        );
        thread::sleep(Duration::from_millis(25));
        write_rollout(
            &newer_rollout,
            &[
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:01.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"output_tokens":20,"reasoning_output_tokens":1}}}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:02.000Z","payload":{"type":"task_complete"}}"#,
            ],
        );

        let response = fast_mode_rollout_metrics_blocking(
            &codex_home,
            FastModeRolloutMetricsParams {
                start_time_ms: 0,
                end_time_ms: Some(
                    parse_timestamp_ms("2026-05-09T01:00:00.000Z").expect("timestamp should parse"),
                ),
                max_rollouts: Some(1.0),
            },
        )
        .expect("query should succeed");

        assert_eq!(response.scanned_rollout_count, 1);
        assert_eq!(response.total_output_tokens, 20);
        assert_eq!(response.total_reasoning_output_tokens, 1);

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn filters_rollouts_older_than_requested_start_time() {
        let codex_home = temp_dir("fast-mode-start-time");
        let rollout_path = codex_home
            .join("sessions")
            .join("2026")
            .join("05")
            .join("09")
            .join("session-a.jsonl");
        write_rollout(
            &rollout_path,
            &[
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:00.000Z","payload":{"type":"task_started"}}"#,
                r#"{"type":"event_msg","timestamp":"2026-05-09T00:00:01.000Z","payload":{"type":"task_complete"}}"#,
            ],
        );
        let modified_at_ms = fs::metadata(&rollout_path)
            .expect("rollout metadata should exist")
            .modified()
            .expect("modified time should exist")
            .duration_since(UNIX_EPOCH)
            .expect("modified time should be after epoch")
            .as_millis() as i64;

        let response = fast_mode_rollout_metrics_blocking(
            &codex_home,
            FastModeRolloutMetricsParams {
                start_time_ms: modified_at_ms.saturating_add(1),
                end_time_ms: Some(modified_at_ms.saturating_add(5_000)),
                max_rollouts: Some(128.0),
            },
        )
        .expect("query should succeed");

        assert_eq!(response.scanned_rollout_count, 0);
        assert_eq!(response.parsed_rollout_count, 0);

        let _ = fs::remove_dir_all(codex_home);
    }

    #[test]
    fn normalizes_max_rollouts_like_the_extracted_handler() {
        let normalized = normalize_params(FastModeRolloutMetricsParams {
            start_time_ms: 1,
            end_time_ms: Some(2),
            max_rollouts: Some(0.9),
        });
        assert_eq!(normalized.max_rollouts, 1);

        let normalized = normalize_params(FastModeRolloutMetricsParams {
            start_time_ms: 1,
            end_time_ms: Some(2),
            max_rollouts: Some(3.9),
        });
        assert_eq!(normalized.max_rollouts, 3);
    }

    #[test]
    fn parses_rfc3339_timestamps_with_offsets() {
        assert_eq!(parse_timestamp_ms("1970-01-01T00:00:00.000Z"), Some(0));
        assert_eq!(parse_timestamp_ms("1970-01-01T08:00:00+08:00"), Some(0));
        assert_eq!(parse_timestamp_ms("1970-01-01T01:30:00+0130"), Some(0));
    }

    fn write_rollout(path: &Path, lines: &[&str]) {
        fs::create_dir_all(path.parent().expect("parent directory should exist"))
            .expect("parent directory should be created");
        let mut contents = lines.join("\n");
        contents.push('\n');
        fs::write(path, contents).expect("rollout file should be written");
    }

    fn temp_dir(case_name: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("codex-app-replica-{case_name}-{unique_suffix}"));
        fs::create_dir_all(&path).expect("temp directory should be created");
        path
    }
}
