use crate::auth_bridge::send_request_for_host;
use crate::auth_bridge::AppServerRequestKind;
use crate::auth_bridge::AuthBridgeState;
use crate::auth_bridge::MarketplaceAddResponse;
use crate::auth_bridge::PluginListResponse;
use crate::auth_bridge::PluginSource;
use crate::codex_home::resolve_codex_home;
use crate::primary_runtime::PRIMARY_RUNTIME_NAME;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use std::fs;
use std::path::Component;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use tauri::AppHandle;
use tauri::Manager;

const LOCAL_HOST_ID: &str = "local";
const MARKETPLACE_MANIFEST_PATH: [&str; 3] = [".agents", "plugins", "marketplace.json"];
const PRIMARY_RUNTIME_SKILLS_RELOAD_FAILURE_PREFIX: &str = "primary_runtime_skills_reload_failed";

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PrimaryRuntimeManifest {
    #[serde(default)]
    bundled_plugins: Vec<String>,
    #[serde(default)]
    bundled_skills: Vec<String>,
    #[serde(default)]
    skills_to_remove: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrimaryRuntimeMarketplaceManifest {
    name: String,
    plugins: Vec<PrimaryRuntimeMarketplacePlugin>,
}

#[derive(Debug, Deserialize)]
struct PrimaryRuntimeMarketplacePlugin {
    name: String,
    source: PrimaryRuntimeMarketplacePluginSource,
}

#[derive(Debug, Deserialize)]
struct PrimaryRuntimeMarketplacePluginSource {
    source: String,
    path: String,
}

#[derive(Debug, Deserialize)]
struct PrimaryRuntimePluginManifest {
    name: String,
    version: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BundledPluginInstallState {
    Current,
    Missing,
    Outdated,
    Unknown,
}

pub(crate) async fn sync_primary_runtime_post_install(
    app: &AppHandle,
    cache_root: &Path,
) -> Result<(), String> {
    let manifest = read_primary_runtime_manifest(cache_root)?;
    sync_primary_runtime_bundled_plugin_marketplaces(app, cache_root, &manifest.bundled_plugins)
        .await?;
    let bundled_skill_paths = resolve_bundled_skill_paths(cache_root, &manifest)?;
    sync_primary_runtime_bundled_skills(&manifest.skills_to_remove, &bundled_skill_paths)?;
    reload_primary_runtime_skills(app);
    Ok(())
}

fn read_primary_runtime_manifest(cache_root: &Path) -> Result<PrimaryRuntimeManifest, String> {
    let manifest_path = cache_root.join("runtime.json");
    let contents = fs::read_to_string(&manifest_path).map_err(|err| {
        format!(
            "failed to read primary runtime manifest {}: {err}",
            manifest_path.display()
        )
    })?;
    serde_json::from_str(&contents).map_err(|err| {
        format!(
            "failed to parse primary runtime manifest {}: {err}",
            manifest_path.display()
        )
    })
}

async fn sync_primary_runtime_bundled_plugin_marketplaces(
    app: &AppHandle,
    cache_root: &Path,
    bundled_plugins: &[String],
) -> Result<(), String> {
    for bundled_plugin in bundled_plugins {
        let marketplace_root = resolve_relative_path_within_root(
            cache_root,
            bundled_plugin,
            "Primary runtime bundled plugin marketplace path must stay within the runtime cache",
            true,
        )?;
        if !sync_primary_runtime_bundled_plugin_marketplace(app, &marketplace_root).await {
            return Err(format!(
                "Failed to sync primary runtime bundled plugin marketplace: {}",
                marketplace_root.display()
            ));
        }
    }

    Ok(())
}

async fn sync_primary_runtime_bundled_plugin_marketplace(
    app: &AppHandle,
    marketplace_root: &Path,
) -> bool {
    let Ok(auth_state) = auth_bridge_state(app) else {
        return false;
    };
    let Ok(marketplace_manifest) = read_primary_runtime_marketplace_manifest(marketplace_root)
    else {
        return false;
    };

    let added_marketplace = send_request_for_host(
        app,
        &auth_state,
        Some(LOCAL_HOST_ID),
        AppServerRequestKind::MarketplaceAdd,
        json!({
            "source": marketplace_root.to_string_lossy(),
        }),
    )
    .await
    .ok()
    .and_then(|value| serde_json::from_value::<MarketplaceAddResponse>(value).ok());
    let Some(added_marketplace) = added_marketplace else {
        return false;
    };

    let installed_marketplace = send_request_for_host(
        app,
        &auth_state,
        Some(LOCAL_HOST_ID),
        AppServerRequestKind::PluginList,
        json!({}),
    )
    .await
    .ok()
    .and_then(|value| serde_json::from_value::<PluginListResponse>(value).ok())
    .and_then(|response| {
        response.marketplaces.into_iter().find(|marketplace| {
            marketplace.name == added_marketplace.marketplace_name
                || marketplace.name == marketplace_manifest.name
        })
    });

    let marketplace_manifest_path =
        marketplace_root.join(PathBuf::from_iter(MARKETPLACE_MANIFEST_PATH));
    for plugin in &marketplace_manifest.plugins {
        if plugin.source.source != "local" {
            return false;
        }
        let installed_plugin = installed_marketplace.as_ref().and_then(|marketplace| {
            marketplace
                .plugins
                .iter()
                .find(|entry| entry.name == plugin.name)
        });
        let install_state =
            resolve_bundled_plugin_install_state(marketplace_root, plugin, installed_plugin);
        if install_state == BundledPluginInstallState::Current {
            continue;
        }

        if install_state == BundledPluginInstallState::Outdated {
            if let Some(installed_plugin) = installed_plugin {
                if send_request_for_host(
                    app,
                    &auth_state,
                    Some(LOCAL_HOST_ID),
                    AppServerRequestKind::PluginUninstall,
                    json!({
                        "pluginId": installed_plugin.id,
                    }),
                )
                .await
                .is_err()
                {
                    return false;
                }
            }
        }

        if send_request_for_host(
            app,
            &auth_state,
            Some(LOCAL_HOST_ID),
            AppServerRequestKind::PluginInstall,
            json!({
                "marketplacePath": marketplace_manifest_path.to_string_lossy(),
                "pluginName": plugin.name,
            }),
        )
        .await
        .is_err()
        {
            return false;
        }

        if install_state != BundledPluginInstallState::Missing {
            if let Some(installed_plugin) = installed_plugin {
                if !installed_plugin.enabled
                    && send_request_for_host(
                        app,
                        &auth_state,
                        Some(LOCAL_HOST_ID),
                        AppServerRequestKind::ConfigBatchWrite,
                        json!({
                            "edits": [{
                                "keyPath": format!(
                                    "plugins.{}@{}.enabled",
                                    plugin.name, added_marketplace.marketplace_name
                                ),
                                "mergeStrategy": "upsert",
                                "value": false,
                            }],
                            "reloadUserConfig": true,
                        }),
                    )
                    .await
                    .is_err()
                {
                    return false;
                }
            }
        }
    }

    true
}

fn read_primary_runtime_marketplace_manifest(
    marketplace_root: &Path,
) -> Result<PrimaryRuntimeMarketplaceManifest, String> {
    let marketplace_manifest_path =
        marketplace_root.join(PathBuf::from_iter(MARKETPLACE_MANIFEST_PATH));
    let contents = fs::read_to_string(&marketplace_manifest_path).map_err(|err| {
        format!(
            "failed to read primary runtime marketplace manifest {}: {err}",
            marketplace_manifest_path.display()
        )
    })?;
    serde_json::from_str(&contents).map_err(|err| {
        format!(
            "failed to parse primary runtime marketplace manifest {}: {err}",
            marketplace_manifest_path.display()
        )
    })
}

fn resolve_bundled_plugin_install_state(
    marketplace_root: &Path,
    bundled_plugin: &PrimaryRuntimeMarketplacePlugin,
    installed_plugin: Option<&crate::auth_bridge::PluginSummary>,
) -> BundledPluginInstallState {
    let Some(installed_plugin) = installed_plugin else {
        return BundledPluginInstallState::Missing;
    };
    if !installed_plugin.installed {
        return BundledPluginInstallState::Missing;
    }

    let bundled_manifest =
        read_primary_runtime_plugin_manifest(marketplace_root, &bundled_plugin.source.path);
    let installed_manifest = match &installed_plugin.source {
        PluginSource::Local { path } => read_primary_runtime_plugin_manifest(Path::new(path), "."),
        PluginSource::Git { .. } | PluginSource::Remote => {
            return BundledPluginInstallState::Unknown
        }
    };

    match (bundled_manifest, installed_manifest) {
        (Ok(bundled_manifest), Ok(installed_manifest))
            if bundled_manifest.name == installed_manifest.name
                && bundled_manifest.version == installed_manifest.version =>
        {
            BundledPluginInstallState::Current
        }
        (Ok(_), Ok(_)) => BundledPluginInstallState::Outdated,
        _ => BundledPluginInstallState::Unknown,
    }
}

fn read_primary_runtime_plugin_manifest(
    root: &Path,
    plugin_path: &str,
) -> Result<PrimaryRuntimePluginManifest, String> {
    let plugin_root = resolve_relative_path_within_root(
        root,
        plugin_path,
        "Primary runtime plugin path must stay within the marketplace root",
        true,
    )?;
    let manifest_path = plugin_root.join(".codex-plugin").join("plugin.json");
    let contents = fs::read_to_string(&manifest_path).map_err(|err| {
        format!(
            "failed to read bundled plugin manifest {}: {err}",
            manifest_path.display()
        )
    })?;
    serde_json::from_str(&contents).map_err(|err| {
        format!(
            "failed to parse bundled plugin manifest {}: {err}",
            manifest_path.display()
        )
    })
}

fn resolve_bundled_skill_paths(
    cache_root: &Path,
    manifest: &PrimaryRuntimeManifest,
) -> Result<Vec<PathBuf>, String> {
    let mut skill_paths = Vec::new();
    let mut seen = HashSet::new();

    for bundled_skill in &manifest.bundled_skills {
        let skill_path = resolve_relative_path_within_root(
            cache_root,
            bundled_skill,
            "Primary runtime bundled skill path must stay within the runtime cache",
            true,
        )?;
        let resolved_skill_path = if skill_path.is_dir() {
            skill_path.join("SKILL.md")
        } else {
            skill_path
        };
        push_unique_path(&mut skill_paths, &mut seen, resolved_skill_path);
    }

    for bundled_plugin in &manifest.bundled_plugins {
        let marketplace_root = resolve_relative_path_within_root(
            cache_root,
            bundled_plugin,
            "Primary runtime bundled plugin marketplace path must stay within the runtime cache",
            true,
        )?;
        collect_skill_files(&marketplace_root, &mut skill_paths, &mut seen)?;
    }

    Ok(skill_paths)
}

fn collect_skill_files(
    root: &Path,
    skill_paths: &mut Vec<PathBuf>,
    seen: &mut HashSet<String>,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(root)
        .map_err(|err| format!("failed to read directory {}: {err}", root.display()))?
    {
        let entry = entry.map_err(|err| format!("failed to read directory entry: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_skill_files(&path, skill_paths, seen)?;
            continue;
        }
        if path.file_name().and_then(|file_name| file_name.to_str()) == Some("SKILL.md") {
            push_unique_path(skill_paths, seen, path);
        }
    }

    Ok(())
}

fn push_unique_path(paths: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    let key = path.to_string_lossy().to_lowercase();
    if seen.insert(key) {
        paths.push(path);
    }
}

fn sync_primary_runtime_bundled_skills(
    skills_to_remove: &[String],
    bundled_skill_paths: &[PathBuf],
) -> Result<(), String> {
    if skills_to_remove.is_empty() && bundled_skill_paths.is_empty() {
        return Ok(());
    }

    let codex_home = resolve_codex_home()?;
    migrate_legacy_primary_runtime_skills(&codex_home, skills_to_remove)?;
    if bundled_skill_paths.is_empty() {
        return Ok(());
    }

    let primary_runtime_skills_root = codex_home.join("skills").join(PRIMARY_RUNTIME_NAME);
    if primary_runtime_skills_root.exists() {
        fs::remove_dir_all(&primary_runtime_skills_root).map_err(|err| {
            format!(
                "failed to clear primary runtime skills directory {}: {err}",
                primary_runtime_skills_root.display()
            )
        })?;
    }
    fs::create_dir_all(&primary_runtime_skills_root).map_err(|err| {
        format!(
            "failed to create primary runtime skills directory {}: {err}",
            primary_runtime_skills_root.display()
        )
    })?;

    for bundled_skill_path in bundled_skill_paths {
        let bundled_skill_root = bundled_skill_path.parent().ok_or_else(|| {
            format!(
                "bundled skill path has no parent directory: {}",
                bundled_skill_path.display()
            )
        })?;
        let bundled_skill_name = bundled_skill_root.file_name().ok_or_else(|| {
            format!(
                "bundled skill directory has no final path segment: {}",
                bundled_skill_root.display()
            )
        })?;
        copy_directory_recursively(
            bundled_skill_root,
            &primary_runtime_skills_root.join(bundled_skill_name),
        )?;
    }

    Ok(())
}

fn migrate_legacy_primary_runtime_skills(
    codex_home: &Path,
    skills_to_remove: &[String],
) -> Result<(), String> {
    if skills_to_remove.is_empty() {
        return Ok(());
    }

    let skills_root = codex_home.join("skills");
    for skill_dir in skills_to_remove {
        let skill_root = resolve_removed_skill_path(&skills_root, skill_dir)?;
        let metadata = match fs::metadata(&skill_root) {
            Ok(metadata) => metadata,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => {
                return Err(format!(
                    "failed to inspect legacy primary runtime skill directory {}: {err}",
                    skill_root.display()
                ));
            }
        };
        if !metadata.is_dir() {
            continue;
        }

        let backup_root = codex_home
            .join(".tmp")
            .join("legacy-primary-runtime-skills")
            .join(format!(
                "{}-{}-{}",
                skill_root
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("skill"),
                current_unix_millis(),
                std::process::id()
            ));
        if let Some(parent) = backup_root.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                format!(
                    "failed to create legacy primary runtime skills backup directory {}: {err}",
                    parent.display()
                )
            })?;
        }
        fs::rename(&skill_root, &backup_root).map_err(|err| {
            format!(
                "failed to migrate legacy primary runtime skill {} to {}: {err}",
                skill_root.display(),
                backup_root.display()
            )
        })?;
    }

    Ok(())
}

fn resolve_removed_skill_path(skills_root: &Path, skill_dir: &str) -> Result<PathBuf, String> {
    resolve_relative_path_within_root(
        skills_root,
        skill_dir,
        "Primary runtime removed skill path must stay within the Codex skills directory",
        false,
    )
}

fn resolve_relative_path_within_root(
    root: &Path,
    relative_path: &str,
    escape_error: &str,
    allow_root: bool,
) -> Result<PathBuf, String> {
    let mut resolved_path = PathBuf::from(root);
    for component in Path::new(relative_path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => resolved_path.push(part),
            Component::ParentDir => {
                if !resolved_path.pop() || !resolved_path.starts_with(root) {
                    return Err(format!("{escape_error}: {relative_path}"));
                }
            }
            Component::Prefix(_) | Component::RootDir => {
                return Err(format!("{escape_error}: {relative_path}"));
            }
        }
    }

    if (!allow_root && resolved_path == root) || !resolved_path.starts_with(root) {
        return Err(format!("{escape_error}: {relative_path}"));
    }

    Ok(resolved_path)
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

fn reload_primary_runtime_skills(app: &AppHandle) {
    let Some(auth_state) = app
        .try_state::<Arc<AuthBridgeState>>()
        .map(|state| state.inner().clone())
    else {
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(err) = send_request_for_host(
            &app,
            &auth_state,
            Some(LOCAL_HOST_ID),
            AppServerRequestKind::SkillsList,
            json!({
                "forceReload": true,
            }),
        )
        .await
        {
            eprintln!("{PRIMARY_RUNTIME_SKILLS_RELOAD_FAILURE_PREFIX}: {err}");
        }
    });
}

fn auth_bridge_state(app: &AppHandle) -> Result<Arc<AuthBridgeState>, String> {
    app.try_state::<Arc<AuthBridgeState>>()
        .map(|state| state.inner().clone())
        .ok_or_else(|| "auth bridge state is unavailable".to_string())
}

fn current_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
