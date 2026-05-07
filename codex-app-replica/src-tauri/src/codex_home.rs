use std::env;
use std::path::PathBuf;

#[tauri::command]
pub fn get_codex_home() -> Result<String, String> {
    Ok(resolve_codex_home()?.to_string_lossy().to_string())
}

pub fn resolve_codex_home() -> Result<PathBuf, String> {
    if let Some(path) = non_empty_env_path("CODEX_HOME") {
        return Ok(path);
    }

    let home_dir =
        resolve_home_directory().ok_or_else(|| "failed to resolve CODEX_HOME".to_string())?;
    Ok(home_dir.join(".codex"))
}

fn resolve_home_directory() -> Option<PathBuf> {
    non_empty_env_path("USERPROFILE")
        .or_else(home_directory_from_drive_and_path)
        .or_else(|| non_empty_env_path("HOME"))
}

fn home_directory_from_drive_and_path() -> Option<PathBuf> {
    let drive = env::var_os("HOMEDRIVE")?;
    let path = env::var_os("HOMEPATH")?;
    let mut home_dir = PathBuf::from(drive);
    home_dir.push(PathBuf::from(path));
    if home_dir.as_os_str().is_empty() {
        return None;
    }
    Some(home_dir)
}

fn non_empty_env_path(name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(env::var_os(name)?);
    if path.as_os_str().is_empty() {
        return None;
    }
    Some(path)
}
