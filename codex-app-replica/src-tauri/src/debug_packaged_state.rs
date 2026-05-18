use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PackagedStateResponse {
    pub is_packaged: bool,
}

#[tauri::command(rename = "is-packaged")]
pub fn is_packaged() -> PackagedStateResponse {
    PackagedStateResponse {
        is_packaged: !tauri::is_dev(),
    }
}

#[cfg(test)]
mod tests {
    use super::is_packaged;

    #[test]
    fn packaged_state_matches_tauri_mode() {
        assert_eq!(is_packaged().is_packaged, !tauri::is_dev());
    }
}
