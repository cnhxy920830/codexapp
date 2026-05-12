use crate::remote_connections::RemoteConnection;
use std::io::Write;
use std::process::{Command, Output, Stdio};

pub fn build_ssh_command_args(
    connection: &RemoteConnection,
    remote_command: &str,
) -> Result<Vec<String>, String> {
    let mut args = vec!["-o".to_string(), "BatchMode=yes".to_string()];

    if let Some(alias) = connection.ssh_alias.as_deref() {
        args.push(alias.to_string());
    } else {
        let host = connection.ssh_host.as_deref().ok_or_else(|| {
            format!(
                "remote connection {} is missing ssh host",
                connection.host_id
            )
        })?;
        if let Some(port) = connection.ssh_port {
            args.push("-p".to_string());
            args.push(port.to_string());
        }
        if let Some(identity) = connection.identity.as_deref() {
            args.push("-i".to_string());
            args.push(expand_tilde_path(identity));
        }
        args.push(host.to_string());
    }

    args.push(remote_command.to_string());
    Ok(args)
}

pub fn run_ssh_command(
    connection: &RemoteConnection,
    remote_command: &str,
) -> Result<Output, String> {
    let args = build_ssh_command_args(connection, remote_command)?;
    Command::new("ssh")
        .args(&args)
        .output()
        .map_err(|err| format!("failed to run ssh for {}: {err}", connection.host_id))
}

pub fn run_ssh_command_with_input(
    connection: &RemoteConnection,
    remote_command: &str,
    input: &[u8],
) -> Result<Output, String> {
    let args = build_ssh_command_args(connection, remote_command)?;
    let mut child = Command::new("ssh")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("failed to spawn ssh for {}: {err}", connection.host_id))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input).map_err(|err| {
            format!(
                "failed to write ssh stdin for {}: {err}",
                connection.host_id
            )
        })?;
    }

    child.wait_with_output().map_err(|err| {
        format!(
            "failed to read ssh output for {}: {err}",
            connection.host_id
        )
    })
}

pub fn expand_tilde_path(value: &str) -> String {
    if value == "~" {
        return home_directory()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|| value.to_string());
    }

    let Some(suffix) = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
    else {
        return value.to_string();
    };

    home_directory()
        .map(|path| path.join(suffix).to_string_lossy().into_owned())
        .unwrap_or_else(|| value.to_string())
}

fn home_directory() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
}

#[cfg(test)]
mod tests {
    use super::build_ssh_command_args;
    use super::expand_tilde_path;
    use crate::remote_connections::RemoteConnection;

    #[test]
    fn ssh_command_uses_alias_when_present() {
        let args = build_ssh_command_args(
            &RemoteConnection {
                host_id: "remote-ssh-discovered:demo".into(),
                display_name: "Demo".into(),
                source: "discovered".into(),
                auto_connect: true,
                ssh_alias: Some("demo-alias".into()),
                ssh_host: Some("ignored.example.com".into()),
                ssh_port: Some(2222),
                identity: Some("~/.ssh/id_demo".into()),
            },
            "codex app-server --listen stdio://",
        )
        .expect("ssh args");

        assert_eq!(
            args,
            vec![
                "-o".to_string(),
                "BatchMode=yes".to_string(),
                "demo-alias".to_string(),
                "codex app-server --listen stdio://".to_string(),
            ]
        );
    }

    #[test]
    fn ssh_command_uses_manual_host_settings_when_alias_missing() {
        let args = build_ssh_command_args(
            &RemoteConnection {
                host_id: "remote-ssh-codex-managed:demo".into(),
                display_name: "Demo".into(),
                source: "codex-managed".into(),
                auto_connect: true,
                ssh_alias: None,
                ssh_host: Some("example.com".into()),
                ssh_port: Some(2200),
                identity: Some("C:/Users/demo/.ssh/id_demo".into()),
            },
            "codex app-server --listen stdio://",
        )
        .expect("ssh args");

        assert_eq!(
            args,
            vec![
                "-o".to_string(),
                "BatchMode=yes".to_string(),
                "-p".to_string(),
                "2200".to_string(),
                "-i".to_string(),
                "C:/Users/demo/.ssh/id_demo".to_string(),
                "example.com".to_string(),
                "codex app-server --listen stdio://".to_string(),
            ]
        );
    }

    #[test]
    fn expand_tilde_path_leaves_non_tilde_values_unchanged() {
        assert_eq!(
            expand_tilde_path("C:/ssh/id_demo"),
            "C:/ssh/id_demo".to_string()
        );
    }
}
