#[tauri::command(rename = "electron-request-microphone-permission")]
pub fn request_microphone_permission() -> Result<(), String> {
    // The extracted Windows Electron baseline treats this desktop message as a no-op.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::request_microphone_permission;

    #[test]
    fn is_a_noop_for_the_windows_baseline() {
        assert_eq!(request_microphone_permission(), Ok(()));
    }
}
