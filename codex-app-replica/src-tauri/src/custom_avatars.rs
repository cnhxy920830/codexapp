use crate::codex_home::resolve_codex_home;
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const CUSTOM_AVATARS_DIRECTORY_NAME: &str = "pets";
const CUSTOM_AVATAR_MANIFEST_FILE_NAME: &str = "pet.json";
const CUSTOM_AVATAR_SPRITESHEET_MIME_TYPE: &str = "image/webp";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CustomAvatarManifest {
    id: String,
    display_name: String,
    description: String,
    spritesheet_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomAvatar {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub spritesheet_data_url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomAvatarsResponse {
    pub avatar_directory: String,
    pub avatars: Vec<CustomAvatar>,
}

#[tauri::command(rename = "custom-avatars")]
pub fn read_custom_avatars() -> Result<CustomAvatarsResponse, String> {
    let codex_home = resolve_codex_home()?;
    read_custom_avatars_from_home(&codex_home)
}

fn read_custom_avatars_from_home(codex_home: &Path) -> Result<CustomAvatarsResponse, String> {
    let avatar_directory = codex_home.join(CUSTOM_AVATARS_DIRECTORY_NAME);
    let mut avatars = Vec::new();

    if avatar_directory.exists() {
        let mut pet_dirs = fs::read_dir(&avatar_directory)
            .map_err(|err| format!("failed to read {avatar_directory:?}: {err}"))?
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_type()
                    .map(|file_type| file_type.is_dir())
                    .unwrap_or(false)
            })
            .collect::<Vec<_>>();
        pet_dirs.sort_by_key(|entry| entry.file_name());

        for entry in pet_dirs {
            avatars.push(read_custom_avatar(entry.path())?);
        }
    }

    Ok(CustomAvatarsResponse {
        avatar_directory: avatar_directory.to_string_lossy().to_string(),
        avatars,
    })
}

fn read_custom_avatar(pet_dir: PathBuf) -> Result<CustomAvatar, String> {
    let manifest_path = pet_dir.join(CUSTOM_AVATAR_MANIFEST_FILE_NAME);
    let manifest_contents = fs::read_to_string(&manifest_path)
        .map_err(|err| format!("failed to read {manifest_path:?}: {err}"))?;
    let manifest: CustomAvatarManifest = serde_json::from_str(&manifest_contents)
        .map_err(|err| format!("failed to parse {manifest_path:?}: {err}"))?;

    let folder_id = pet_dir
        .file_name()
        .ok_or_else(|| format!("missing folder name for {pet_dir:?}"))?
        .to_string_lossy()
        .to_string();
    if manifest.id.trim() != folder_id {
        return Err(format!(
            "custom avatar manifest id {:?} does not match folder name {:?}",
            manifest.id, folder_id
        ));
    }

    let spritesheet_path = pet_dir.join(&manifest.spritesheet_path);
    let spritesheet_bytes = fs::read(&spritesheet_path)
        .map_err(|err| format!("failed to read {spritesheet_path:?}: {err}"))?;
    let spritesheet_data_url = format!(
        "data:{CUSTOM_AVATAR_SPRITESHEET_MIME_TYPE};base64,{}",
        STANDARD.encode(spritesheet_bytes)
    );

    Ok(CustomAvatar {
        id: format!("custom:{folder_id}"),
        display_name: manifest.display_name,
        description: manifest.description,
        spritesheet_data_url,
    })
}

#[cfg(test)]
mod tests {
    use super::read_custom_avatars_from_home;
    use super::CustomAvatar;
    use super::CustomAvatarsResponse;
    use std::fs;
    use std::path::PathBuf;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    #[test]
    fn read_custom_avatars_returns_empty_list_when_directory_is_missing() {
        let root = temp_dir("missing-directory");
        let response = read_custom_avatars_from_home(&root).expect("should load custom avatars");

        assert_eq!(
            response,
            CustomAvatarsResponse {
                avatar_directory: root.join("pets").display().to_string(),
                avatars: vec![],
            }
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_custom_avatars_loads_manifest_and_spritesheet() {
        let root = temp_dir("custom-avatar");
        let pet_dir = root.join("pets").join("fox");
        fs::create_dir_all(&pet_dir).expect("pet directory should be created");
        fs::write(
            pet_dir.join("pet.json"),
            r#"{
  "id": "fox",
  "displayName": "Fox",
  "description": "A quick orange pet.",
  "spritesheetPath": "spritesheet.webp"
}"#,
        )
        .expect("manifest should be written");
        fs::write(pet_dir.join("spritesheet.webp"), [0x01, 0x02, 0x03, 0x04])
            .expect("spritesheet should be written");

        let response = read_custom_avatars_from_home(&root).expect("should load custom avatars");

        assert_eq!(
            response,
            CustomAvatarsResponse {
                avatar_directory: root.join("pets").display().to_string(),
                avatars: vec![CustomAvatar {
                    id: "custom:fox".to_string(),
                    display_name: "Fox".to_string(),
                    description: "A quick orange pet.".to_string(),
                    spritesheet_data_url: "data:image/webp;base64,AQIDBA==".to_string(),
                }],
            }
        );

        let _ = fs::remove_dir_all(root);
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
