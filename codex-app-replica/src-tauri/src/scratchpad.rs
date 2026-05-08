use serde::Serialize;

const SUMMARY_MAX_CHARS: usize = 96;
const SUMMARY_TRUNCATED_CHARS: usize = SUMMARY_MAX_CHARS - 3;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScratchpadCompletionSummaryResponse {
    pub summary: Option<String>,
}

#[tauri::command(rename = "generate-scratchpad-completion-summary")]
pub async fn generate_scratchpad_completion_summary(
    message: String,
    cwd: Option<String>,
) -> Result<ScratchpadCompletionSummaryResponse, String> {
    let _ = cwd;

    Ok(ScratchpadCompletionSummaryResponse {
        summary: summarize_scratchpad_completion(&message),
    })
}

fn summarize_scratchpad_completion(message: &str) -> Option<String> {
    let first_line = message
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())?;
    let line_chars: Vec<char> = first_line.chars().collect();
    if line_chars.len() <= SUMMARY_MAX_CHARS {
        return Some(first_line.to_string());
    }

    let truncated: String = line_chars
        .into_iter()
        .take(SUMMARY_TRUNCATED_CHARS)
        .collect();
    Some(format!("{}...", truncated.trim_end()))
}

#[cfg(test)]
mod tests {
    use super::summarize_scratchpad_completion;

    #[test]
    fn summary_uses_first_non_empty_line() {
        assert_eq!(
            summarize_scratchpad_completion("\n  \n  First line  \nSecond line"),
            Some("First line".to_string())
        );
    }

    #[test]
    fn summary_truncates_long_first_line() {
        let long_line = format!("{} tail", "a".repeat(93));

        assert_eq!(
            summarize_scratchpad_completion(&long_line),
            Some(format!("{}...", "a".repeat(93)))
        );
    }

    #[test]
    fn summary_is_none_for_blank_messages() {
        assert_eq!(summarize_scratchpad_completion(" \n\t\r\n "), None);
    }
}
