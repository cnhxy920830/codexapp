use serde::Serialize;

#[cfg(target_os = "windows")]
use std::env;
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

const POWERSHELL_SHELL: &str = "powershell";
const COMMAND_PROMPT_SHELL: &str = "commandPrompt";
const GIT_BASH_SHELL: &str = "gitBash";
const WSL_SHELL: &str = "wsl";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalShellOptionsResponse {
    pub available_shells: Vec<String>,
}

#[tauri::command(rename = "terminal-shell-options")]
pub fn terminal_shell_options() -> Result<TerminalShellOptionsResponse, String> {
    Ok(TerminalShellOptionsResponse {
        available_shells: detect_terminal_shells(),
    })
}

#[cfg(target_os = "windows")]
fn detect_terminal_shells() -> Vec<String> {
    available_shells_with(&find_executable_in_path, &program_files_dirs())
        .into_iter()
        .map(str::to_string)
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn detect_terminal_shells() -> Vec<String> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn available_shells_with<F>(
    find_executable: &F,
    program_files_dirs: &[PathBuf],
) -> Vec<&'static str>
where
    F: Fn(&str) -> Option<PathBuf>,
{
    let mut shells = vec![POWERSHELL_SHELL, COMMAND_PROMPT_SHELL];
    if git_bash_path_with(find_executable, program_files_dirs).is_some() {
        shells.push(GIT_BASH_SHELL);
    }
    if wsl_path_with(find_executable).is_some() {
        shells.push(WSL_SHELL);
    }
    shells
}

#[cfg(target_os = "windows")]
fn find_executable_in_path(name: &str) -> Option<PathBuf> {
    let output = Command::new("where.exe").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.exists())
}

#[cfg(target_os = "windows")]
fn program_files_dirs() -> Vec<PathBuf> {
    [
        env::var_os("ProgramFiles"),
        env::var_os("ProgramFiles(x86)"),
    ]
    .into_iter()
    .flatten()
    .map(PathBuf::from)
    .collect()
}

#[cfg(target_os = "windows")]
fn git_bash_path_with<F>(find_executable: &F, program_files_dirs: &[PathBuf]) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<PathBuf>,
{
    if let Some(path) = find_executable("git-bash.exe").or_else(|| find_executable("git-bash")) {
        return Some(path);
    }

    if let Some(path) = find_executable("git.exe")
        .or_else(|| find_executable("git"))
        .and_then(|git_path| git_bash_adjacent_to_git(&git_path))
    {
        return Some(path);
    }

    for directory in program_files_dirs {
        for candidate in [
            directory.join("Git").join("git-bash.exe"),
            directory.join("Git").join("bin").join("bash.exe"),
        ] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn git_bash_adjacent_to_git(git_path: &Path) -> Option<PathBuf> {
    let parent = git_path.parent()?;
    if parent.join("bash.exe").exists() {
        return Some(parent.join("bash.exe"));
    }

    let root = parent.parent()?;
    for candidate in [root.join("git-bash.exe"), root.join("bin").join("bash.exe")] {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn wsl_path_with<F>(find_executable: &F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<PathBuf>,
{
    find_executable("wsl.exe").or_else(|| find_executable("wsl"))
}

#[cfg(test)]
mod tests {
    #[cfg(not(target_os = "windows"))]
    use super::detect_terminal_shells;
    use super::terminal_shell_options;
    #[cfg(target_os = "windows")]
    use super::{
        available_shells_with, COMMAND_PROMPT_SHELL, GIT_BASH_SHELL, POWERSHELL_SHELL, WSL_SHELL,
    };
    #[cfg(target_os = "windows")]
    use std::fs;
    #[cfg(target_os = "windows")]
    use std::path::PathBuf;
    #[cfg(target_os = "windows")]
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn terminal_shell_options_command_serializes_camel_case_response() {
        let response = terminal_shell_options().expect("query should succeed");
        let value = serde_json::to_value(response).expect("response should serialize");

        assert!(value.get("availableShells").is_some());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn terminal_shell_options_are_empty_off_windows() {
        assert_eq!(detect_terminal_shells(), Vec::<String>::new());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn terminal_shell_options_include_windows_base_shells() {
        let shells = available_shells_with(&|_| None, &[]);

        assert_eq!(shells, vec![POWERSHELL_SHELL, COMMAND_PROMPT_SHELL]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn terminal_shell_options_add_git_bash_from_adjacent_git_install() {
        let install_root = temp_dir("git-bash");
        let git_cmd_dir = install_root.join("cmd");
        let git_binary = git_cmd_dir.join("git.exe");
        let bash_binary = install_root.join("bin").join("bash.exe");
        fs::create_dir_all(&git_cmd_dir).expect("git cmd directory should be created");
        fs::create_dir_all(
            bash_binary
                .parent()
                .expect("git bash parent directory should resolve"),
        )
        .expect("git bash parent directory should be created");
        fs::write(&git_binary, []).expect("git.exe should be created");
        fs::write(&bash_binary, []).expect("bash.exe should be created");

        let shells = available_shells_with(
            &|name| match name {
                "git.exe" => Some(git_binary.clone()),
                "git" => Some(git_binary.clone()),
                _ => None,
            },
            &[],
        );

        assert_eq!(
            shells,
            vec![POWERSHELL_SHELL, COMMAND_PROMPT_SHELL, GIT_BASH_SHELL]
        );

        let _ = fs::remove_dir_all(install_root);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn terminal_shell_options_add_git_bash_and_wsl_when_found() {
        let shells = available_shells_with(
            &|name| match name {
                "git-bash.exe" => Some(PathBuf::from("C:/Program Files/Git/git-bash.exe")),
                "wsl.exe" => Some(PathBuf::from("C:/Windows/System32/wsl.exe")),
                _ => None,
            },
            &[],
        );

        assert_eq!(
            shells,
            vec![
                POWERSHELL_SHELL,
                COMMAND_PROMPT_SHELL,
                GIT_BASH_SHELL,
                WSL_SHELL,
            ]
        );
    }

    #[cfg(target_os = "windows")]
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
