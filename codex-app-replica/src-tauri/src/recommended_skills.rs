use crate::codex_home::resolve_codex_home;
use crate::open_targets::ensure_supported_host_id;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

const CURATED_REPO_DIRECTORY_NAME: &str = "skills";
const CURATED_CACHE_FILE_NAME: &str = "skills-curated-cache.json";
const CURATED_SKILLS_REPO_PATH_PREFIX: &str = "skills/.curated";
const SKILL_DEFINITION_FILE_NAME: &str = "SKILL.md";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedSkillsParams {
    pub host_id: Option<String>,
    #[serde(default)]
    pub refresh: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallRecommendedSkillParams {
    pub host_id: Option<String>,
    pub skill_id: String,
    pub repo_path: String,
    pub install_root: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoveSkillParams {
    pub host_id: Option<String>,
    pub skill_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedSkillsResponse {
    pub skills: Vec<RecommendedSkillSummary>,
    pub repo_root: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedSkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub short_description: Option<String>,
    pub icon_small: Option<String>,
    pub icon_large: Option<String>,
    pub repo_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallRecommendedSkillResponse {
    pub installed_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoveSkillResponse {
    pub removed_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CuratedSkillsCache {
    skills: Vec<CachedRecommendedSkill>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedRecommendedSkill {
    id: String,
    name: String,
    description: String,
    short_description: Option<String>,
    icon_small: Option<String>,
    icon_large: Option<String>,
    repo_path: String,
}

#[tauri::command(rename = "recommended-skills")]
pub fn recommended_skills(
    params: RecommendedSkillsParams,
) -> Result<RecommendedSkillsResponse, String> {
    let _ = params.refresh;
    let codex_home = resolve_codex_home()?;
    let skills = read_recommended_skills(&codex_home).map_err(|err| RecommendedSkillsResponse {
        skills: Vec::new(),
        repo_root: None,
        error: Some(err),
    });

    match skills {
        Ok(skills) => Ok(RecommendedSkillsResponse {
            skills,
            repo_root: None,
            error: None,
        }),
        Err(response) => Ok(response),
    }
}

#[tauri::command(rename = "install-recommended-skill")]
pub fn install_recommended_skill(
    params: InstallRecommendedSkillParams,
) -> Result<InstallRecommendedSkillResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "install-recommended-skill")?;
    let codex_home = resolve_codex_home()?;
    let source_directory =
        resolve_recommended_skill_source_directory(&codex_home, &params.repo_path)?;
    let install_directory =
        resolve_recommended_skill_install_directory(&codex_home, params.install_root.as_deref())?
            .join(params.skill_id.trim());

    if install_directory.exists() {
        if !install_directory.is_dir() {
            return Err(format!(
                "recommended skill target is not a directory: {}",
                install_directory.display()
            ));
        }
        return Ok(InstallRecommendedSkillResponse {
            installed_path: install_directory.to_string_lossy().to_string(),
        });
    }

    copy_directory_recursively(&source_directory, &install_directory)?;
    Ok(InstallRecommendedSkillResponse {
        installed_path: install_directory.to_string_lossy().to_string(),
    })
}

#[tauri::command(rename = "remove-skill")]
pub fn remove_skill(params: RemoveSkillParams) -> Result<RemoveSkillResponse, String> {
    ensure_supported_host_id(params.host_id.as_deref(), "remove-skill")?;
    let codex_home = resolve_codex_home()?;
    let skill_directory = resolve_installed_skill_directory(&params.skill_path)?;
    let removable_directory = validate_removable_skill_directory(&skill_directory, &codex_home)?;

    fs::remove_dir_all(&removable_directory).map_err(|err| {
        format!(
            "failed to remove skill directory {}: {err}",
            removable_directory.display()
        )
    })?;

    Ok(RemoveSkillResponse {
        removed_path: removable_directory.to_string_lossy().to_string(),
    })
}

fn read_recommended_skills(codex_home: &Path) -> Result<Vec<RecommendedSkillSummary>, String> {
    let vendor_imports_root = codex_home.join("vendor_imports");
    let cache_path = vendor_imports_root.join(CURATED_CACHE_FILE_NAME);
    match fs::read_to_string(&cache_path) {
        Ok(contents) => parse_curated_cache(&vendor_imports_root, &contents),
        Err(_) => scan_curated_skills_directory(&vendor_imports_root),
    }
}

fn parse_curated_cache(
    vendor_imports_root: &Path,
    contents: &str,
) -> Result<Vec<RecommendedSkillSummary>, String> {
    let cache: CuratedSkillsCache = serde_json::from_str(contents)
        .map_err(|err| format!("failed to parse curated skills cache: {err}"))?;
    Ok(cache
        .skills
        .into_iter()
        .map(|skill| RecommendedSkillSummary {
            icon_large: resolve_optional_skill_asset_path(
                vendor_imports_root,
                &skill.repo_path,
                skill.icon_large.as_deref(),
            ),
            icon_small: resolve_optional_skill_asset_path(
                vendor_imports_root,
                &skill.repo_path,
                skill.icon_small.as_deref(),
            ),
            id: skill.id,
            name: skill.name,
            description: skill.description,
            short_description: skill.short_description,
            repo_path: skill.repo_path,
        })
        .collect())
}

fn resolve_optional_skill_asset_path(
    vendor_imports_root: &Path,
    repo_path: &str,
    value: Option<&str>,
) -> Option<String> {
    let asset_path = value?.trim();
    if asset_path.is_empty() {
        return None;
    }

    let candidate = PathBuf::from(asset_path);
    if candidate.is_absolute() {
        return Some(candidate.to_string_lossy().to_string());
    }

    let skill_root = vendor_imports_root.join(repo_path);
    Some(skill_root.join(asset_path).to_string_lossy().to_string())
}

fn scan_curated_skills_directory(
    vendor_imports_root: &Path,
) -> Result<Vec<RecommendedSkillSummary>, String> {
    let curated_root = vendor_imports_root
        .join(CURATED_REPO_DIRECTORY_NAME)
        .join(".curated");
    let entries = fs::read_dir(&curated_root).map_err(|err| {
        format!(
            "failed to read curated skills directory {}: {err}",
            curated_root.display()
        )
    })?;
    let mut skills = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read curated skills entry: {err}"))?;
        let skill_directory = entry.path();
        if !skill_directory.is_dir() {
            continue;
        }

        let skill_id = entry.file_name().to_string_lossy().to_string();
        let skill_definition_path = skill_directory.join(SKILL_DEFINITION_FILE_NAME);
        if !skill_definition_path.is_file() {
            continue;
        }

        let skill_contents = fs::read_to_string(&skill_definition_path).map_err(|err| {
            format!(
                "failed to read curated skill {}: {err}",
                skill_definition_path.display()
            )
        })?;
        let (front_matter_name, front_matter_description) =
            parse_skill_front_matter(&skill_contents);
        skills.push(RecommendedSkillSummary {
            id: skill_id.clone(),
            name: front_matter_name.unwrap_or_else(|| skill_id.clone()),
            description: front_matter_description.unwrap_or_else(|| skill_id.clone()),
            short_description: None,
            icon_small: None,
            icon_large: None,
            repo_path: format!("{CURATED_SKILLS_REPO_PATH_PREFIX}/{skill_id}"),
        });
    }

    skills.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(skills)
}

fn parse_skill_front_matter(contents: &str) -> (Option<String>, Option<String>) {
    let mut lines = contents.lines();
    if lines.next() != Some("---") {
        return (None, None);
    }

    let mut name = None;
    let mut description = None;
    for line in lines {
        if line == "---" {
            break;
        }
        if let Some(value) = parse_front_matter_line(line, "name") {
            name = Some(value);
            continue;
        }
        if let Some(value) = parse_front_matter_line(line, "description") {
            description = Some(value);
        }
    }

    (name, description)
}

fn parse_front_matter_line(line: &str, key: &str) -> Option<String> {
    let (field_name, value) = line.split_once(':')?;
    if field_name.trim() != key {
        return None;
    }

    let trimmed = value.trim().trim_matches('"').trim_matches('\'');
    (!trimmed.is_empty()).then_some(trimmed.to_string())
}

fn resolve_recommended_skill_source_directory(
    codex_home: &Path,
    repo_path: &str,
) -> Result<PathBuf, String> {
    let trimmed_repo_path = repo_path.trim();
    if trimmed_repo_path.is_empty() {
        return Err("repoPath is empty".to_string());
    }

    let source_directory = codex_home.join("vendor_imports").join(trimmed_repo_path);
    if !source_directory.is_dir() {
        return Err(format!(
            "recommended skill source directory does not exist: {}",
            source_directory.display()
        ));
    }
    if !source_directory.join(SKILL_DEFINITION_FILE_NAME).is_file() {
        return Err(format!(
            "recommended skill source directory is missing {SKILL_DEFINITION_FILE_NAME}: {}",
            source_directory.display()
        ));
    }
    Ok(source_directory)
}

fn resolve_recommended_skill_install_directory(
    codex_home: &Path,
    install_root: Option<&str>,
) -> Result<PathBuf, String> {
    let install_root = install_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    let skills_root = match install_root {
        Some(root) => root.join(".codex").join("skills"),
        None => codex_home.join("skills"),
    };
    fs::create_dir_all(&skills_root).map_err(|err| {
        format!(
            "failed to create recommended skills install root {}: {err}",
            skills_root.display()
        )
    })?;
    Ok(skills_root)
}

fn copy_directory_recursively(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|err| {
        format!(
            "failed to create target directory {}: {err}",
            target.display()
        )
    })?;

    for entry in fs::read_dir(source).map_err(|err| {
        format!(
            "failed to read source directory {}: {err}",
            source.display()
        )
    })? {
        let entry = entry.map_err(|err| format!("failed to read source directory entry: {err}"))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_recursively(&source_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|err| {
                    format!(
                        "failed to create target directory {}: {err}",
                        parent.display()
                    )
                })?;
            }
            fs::copy(&source_path, &target_path).map_err(|err| {
                format!(
                    "failed to copy {} to {}: {err}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn resolve_installed_skill_directory(skill_path: &str) -> Result<PathBuf, String> {
    let trimmed_skill_path = skill_path.trim();
    if trimmed_skill_path.is_empty() {
        return Err("skillPath is empty".to_string());
    }

    let path = PathBuf::from(trimmed_skill_path);
    if path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .is_some_and(|file_name| file_name.eq_ignore_ascii_case(SKILL_DEFINITION_FILE_NAME))
    {
        return path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("skill path has no parent directory: {trimmed_skill_path}"));
    }

    Ok(path)
}

fn validate_removable_skill_directory(
    skill_directory: &Path,
    codex_home: &Path,
) -> Result<PathBuf, String> {
    let canonical_directory = fs::canonicalize(skill_directory).map_err(|err| {
        format!(
            "failed to resolve skill directory {}: {err}",
            skill_directory.display()
        )
    })?;
    if !canonical_directory.is_dir() {
        return Err(format!(
            "skill directory is not a directory: {}",
            canonical_directory.display()
        ));
    }
    if !canonical_directory
        .join(SKILL_DEFINITION_FILE_NAME)
        .is_file()
    {
        return Err(format!(
            "skill directory is missing {SKILL_DEFINITION_FILE_NAME}: {}",
            canonical_directory.display()
        ));
    }

    if let Some(removable_directory) =
        validate_user_skill_directory(&canonical_directory, &codex_home.join("skills"))?
    {
        return Ok(removable_directory);
    }

    validate_repo_skill_directory(&canonical_directory)
}

fn validate_user_skill_directory(
    skill_directory: &Path,
    user_skills_root: &Path,
) -> Result<Option<PathBuf>, String> {
    if !skill_directory.starts_with(user_skills_root) {
        return Ok(None);
    }

    let relative_path = skill_directory
        .strip_prefix(user_skills_root)
        .map_err(|err| format!("failed to compute skill relative path: {err}"))?;
    let skill_name = relative_path
        .components()
        .next()
        .and_then(|component| component.as_os_str().to_str())
        .ok_or_else(|| "skill path is outside the removable user skill root".to_string())?;

    if skill_name.starts_with('.') {
        return Err(format!(
            "remove-skill does not support built-in skill paths: {}",
            skill_directory.display()
        ));
    }

    Ok(Some(user_skills_root.join(skill_name)))
}

fn validate_repo_skill_directory(skill_directory: &Path) -> Result<PathBuf, String> {
    let skill_name = skill_directory
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            format!(
                "remove-skill could not determine the repo skill directory: {}",
                skill_directory.display()
            )
        })?;
    if skill_name.starts_with('.') {
        return Err(format!(
            "remove-skill does not support built-in repo skill paths: {}",
            skill_directory.display()
        ));
    }

    let skills_root = skill_directory.parent().ok_or_else(|| {
        format!(
            "remove-skill could not resolve the repo skills root: {}",
            skill_directory.display()
        )
    })?;
    let codex_directory = skills_root.parent().ok_or_else(|| {
        format!(
            "remove-skill could not resolve the repo Codex directory: {}",
            skill_directory.display()
        )
    })?;
    let skills_root_name = skills_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let codex_directory_name = codex_directory
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if skills_root_name != "skills" || codex_directory_name != ".codex" {
        return Err(format!(
            "remove-skill only supports repo or user skill directories: {}",
            skill_directory.display()
        ));
    }

    Ok(skill_directory.to_path_buf())
}
