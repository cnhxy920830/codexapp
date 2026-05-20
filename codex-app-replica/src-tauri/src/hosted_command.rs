use crate::remote_connections::read_remote_connection_by_host_id;
use crate::remote_ssh::run_ssh_command;
use std::process::Command;
use tauri::async_runtime::spawn_blocking;
use tauri::AppHandle;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const LOCAL_HOST_ID: &str = "local";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone)]
pub(crate) struct HostedCommandOutput {
    pub status_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

pub(crate) async fn run_hosted_command(
    app: &AppHandle,
    host_id: Option<&str>,
    program: &'static str,
    arguments: Vec<String>,
    cwd: Option<String>,
    allowed_exit_codes: &[i32],
    not_installed_error: &'static str,
) -> Result<HostedCommandOutput, String> {
    let normalized_host_id = normalize_host_id(host_id);
    if normalized_host_id
        .as_deref()
        .is_none_or(|host_id| host_id == LOCAL_HOST_ID)
    {
        return run_local_command(
            program,
            arguments,
            cwd,
            allowed_exit_codes,
            not_installed_error,
        )
        .await;
    }

    run_remote_command(
        app,
        normalized_host_id.as_deref().unwrap_or(LOCAL_HOST_ID),
        program,
        arguments,
        cwd,
        allowed_exit_codes,
        not_installed_error,
    )
    .await
}

fn normalize_host_id(host_id: Option<&str>) -> Option<String> {
    host_id
        .map(str::trim)
        .filter(|host_id| !host_id.is_empty())
        .map(str::to_string)
}

async fn run_local_command(
    program: &'static str,
    arguments: Vec<String>,
    cwd: Option<String>,
    allowed_exit_codes: &[i32],
    not_installed_error: &'static str,
) -> Result<HostedCommandOutput, String> {
    let allowed_exit_codes = allowed_exit_codes.to_vec();
    let join_result = spawn_blocking(move || {
        let mut command = Command::new(program);
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        command.args(&arguments);
        if let Some(cwd) = cwd.as_deref() {
            command.current_dir(cwd);
        }

        let output = command.output().map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => not_installed_error.to_string(),
            _ => format!("failed to launch {program}: {err}"),
        })?;
        command_output_from_execution(
            program,
            output.status.code(),
            output.stdout,
            output.stderr,
            &allowed_exit_codes,
            not_installed_error,
        )
    })
    .await;

    join_result.map_err(|err| format!("failed to join {program} task: {err}"))?
}

async fn run_remote_command(
    app: &AppHandle,
    host_id: &str,
    program: &'static str,
    arguments: Vec<String>,
    cwd: Option<String>,
    allowed_exit_codes: &[i32],
    not_installed_error: &'static str,
) -> Result<HostedCommandOutput, String> {
    let blocking_app = app.clone();
    let host_id = host_id.to_string();
    let allowed_exit_codes = allowed_exit_codes.to_vec();
    let join_result = spawn_blocking(move || {
        let connection = read_remote_connection_by_host_id(&blocking_app, &host_id)?
            .ok_or_else(|| format!("remote connection for host ID {host_id} not found"))?;
        let command = build_remote_command(program, &arguments, cwd.as_deref());
        let output = run_ssh_command(&connection, &command)
            .map_err(|err| format!("failed to launch remote {program}: {err}"))?;
        command_output_from_execution(
            program,
            output.status.code(),
            output.stdout,
            output.stderr,
            &allowed_exit_codes,
            not_installed_error,
        )
    })
    .await;

    join_result.map_err(|err| format!("failed to join remote {program} task: {err}"))?
}

fn command_output_from_execution(
    program: &str,
    status_code: Option<i32>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    allowed_exit_codes: &[i32],
    not_installed_error: &'static str,
) -> Result<HostedCommandOutput, String> {
    let stdout = String::from_utf8_lossy(&stdout).to_string();
    let stderr = String::from_utf8_lossy(&stderr).to_string();

    if status_code == Some(127) && looks_like_missing_command(&stderr, program) {
        return Err(not_installed_error.to_string());
    }

    if status_code == Some(0)
        || status_code
            .map(|code| allowed_exit_codes.contains(&code))
            .unwrap_or(false)
    {
        return Ok(HostedCommandOutput {
            status_code,
            stdout,
            stderr,
        });
    }

    let detail = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };
    let status = status_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    Err(format!("{program} exited with status {status}: {detail}"))
}

fn build_remote_command(program: &str, arguments: &[String], cwd: Option<&str>) -> String {
    let mut script = String::new();
    if let Some(cwd) = cwd {
        script.push_str("cd ");
        script.push_str(&quote_posix(cwd));
        script.push_str(" && ");
    }
    script.push_str(&quote_command(program, arguments));
    remote_shell_command(&script)
}

fn quote_command(program: &str, arguments: &[String]) -> String {
    std::iter::once(program.to_string())
        .chain(arguments.iter().cloned())
        .map(|value| quote_posix(&value))
        .collect::<Vec<_>>()
        .join(" ")
}

fn remote_shell_command(script: &str) -> String {
    format!("sh -lc {}", quote_posix(script))
}

fn quote_posix(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn looks_like_missing_command(stderr: &str, program: &str) -> bool {
    let normalized = stderr.to_ascii_lowercase();
    normalized.contains(&format!("{program}: not found"))
        || normalized.contains(&format!("{program}: command not found"))
}
