use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;

const COMPUTER_USE_APPROVALS_FILE: &str = "ComputerUseAppApprovals.json";
const COMPUTER_USE_GROUP_CONTAINER: &str = "2DC432GLL2.com.openai.sky.CUAService";
#[cfg(target_os = "macos")]
const COMPUTER_USE_SERVICE_BUNDLE_IDENTIFIER: &str = "com.openai.sky.CUAService";
#[cfg(target_os = "macos")]
const COMPUTER_USE_SOUND_MODE_KEY: &str = "computerUseSoundMode";
#[cfg(target_os = "windows")]
const WINDOWS_NATIVE_DESKTOP_APP_BUNDLE_ID_ENV: &str = "CODEX_NATIVE_DESKTOP_APP_BUNDLE_ID";
#[cfg(target_os = "windows")]
const WINDOWS_NATIVE_DESKTOP_APP_ICON_PATH_ENV: &str = "CODEX_NATIVE_DESKTOP_APP_ICON_PATH";
#[cfg(target_os = "windows")]
const WINDOWS_NATIVE_DESKTOP_APP_METADATA_SCRIPT: &str = r#"
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$bundleId = $env:CODEX_NATIVE_DESKTOP_APP_BUNDLE_ID
if ([string]::IsNullOrWhiteSpace($bundleId)) {
  exit 0
}

$trimmedBundleId = $bundleId.Trim()

function Get-FileMetadata([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  $resolvedPath = (Resolve-Path -LiteralPath $Path).ProviderPath
  $displayName = $null

  try {
    $directory = [System.IO.Path]::GetDirectoryName($resolvedPath)
    $fileName = [System.IO.Path]::GetFileName($resolvedPath)
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace($directory)
    if ($null -ne $folder) {
      $item = $folder.ParseName($fileName)
      if ($null -ne $item -and -not [string]::IsNullOrWhiteSpace($item.Name)) {
        $displayName = $item.Name.Trim()
      }
    }
  } catch {
  }

  if ([string]::IsNullOrWhiteSpace($displayName)) {
    try {
      $fileDescription = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($resolvedPath).FileDescription
      if (-not [string]::IsNullOrWhiteSpace($fileDescription)) {
        $displayName = $fileDescription.Trim()
      }
    } catch {
    }
  }

  if ([string]::IsNullOrWhiteSpace($displayName)) {
    $displayName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedPath)
  }

  if ([string]::IsNullOrWhiteSpace($displayName)) {
    return $null
  }

  return @{
    appPath = $resolvedPath
    displayName = $displayName
  }
}

function Get-AppsFolderMetadata([string]$AppId) {
  try {
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace("shell:AppsFolder")
    if ($null -eq $folder) {
      return $null
    }

    $item = $folder.ParseName($AppId)
    if ($null -eq $item) {
      foreach ($candidate in $folder.Items()) {
        if ($candidate.Path -eq $AppId) {
          $item = $candidate
          break
        }
      }
    }
    if ($null -eq $item -or [string]::IsNullOrWhiteSpace($item.Name)) {
      return $null
    }

    $itemPath = $item.Path
    if ([string]::IsNullOrWhiteSpace($itemPath)) {
      $itemPath = $AppId
    }

    return @{
      appPath = $itemPath.Trim()
      displayName = $item.Name.Trim()
    }
  } catch {
    return $null
  }
}

$result = Get-FileMetadata $trimmedBundleId
if ($null -eq $result) {
  $result = Get-AppsFolderMetadata $trimmedBundleId
}

if ($null -ne $result) {
  Write-Output ($result | ConvertTo-Json -Compress)
}
"#;
#[cfg(target_os = "windows")]
const WINDOWS_NATIVE_DESKTOP_APP_ICON_SCRIPT: &str = r#"
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$code = @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct SIZE {
  public int cx;
  public int cy;
  public SIZE(int x, int y) { cx = x; cy = y; }
}

[StructLayout(LayoutKind.Sequential)]
public struct BITMAPINFOHEADER {
  public uint biSize;
  public int biWidth;
  public int biHeight;
  public ushort biPlanes;
  public ushort biBitCount;
  public uint biCompression;
  public uint biSizeImage;
  public int biXPelsPerMeter;
  public int biYPelsPerMeter;
  public uint biClrUsed;
  public uint biClrImportant;
}

[StructLayout(LayoutKind.Sequential)]
public struct BITMAPINFO {
  public BITMAPINFOHEADER bmiHeader;
  public uint bmiColors;
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
public interface IShellItemImageFactory {
  void GetImage(SIZE size, int flags, out IntPtr phbm);
}

public static class CodexShellIconNative {
  const int BI_RGB = 0;
  const int DIB_RGB_COLORS = 0;
  const int ICON_ONLY = 4;

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  public static extern void SHCreateItemFromParsingName(
    string pszPath,
    IntPtr pbc,
    ref Guid riid,
    [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv
  );

  [DllImport("gdi32.dll")]
  public static extern bool DeleteObject(IntPtr hObject);

  [DllImport("gdi32.dll")]
  static extern int GetDIBits(
    IntPtr hdc,
    IntPtr hbmp,
    uint uStartScan,
    uint cScanLines,
    byte[] lpvBits,
    ref BITMAPINFO lpbi,
    uint uUsage
  );

  [DllImport("user32.dll")]
  static extern IntPtr GetDC(IntPtr hWnd);

  [DllImport("user32.dll")]
  static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

  public static string GetAppsFolderIconDataUrl(string appId) {
    Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
    IShellItemImageFactory factory;
    SHCreateItemFromParsingName("shell:AppsFolder\\\\" + appId, IntPtr.Zero, ref iid, out factory);

    IntPtr hbitmap;
    factory.GetImage(new SIZE(32, 32), ICON_ONLY, out hbitmap);
    try {
      using (var bitmap = BitmapFromHBitmapPreserveAlpha(hbitmap, 32, 32))
      using (var stream = new System.IO.MemoryStream()) {
        bitmap.Save(stream, System.Drawing.Imaging.ImageFormat.Png);
        return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
      }
    } finally {
      DeleteObject(hbitmap);
    }
  }

  static System.Drawing.Bitmap BitmapFromHBitmapPreserveAlpha(IntPtr hbitmap, int width, int height) {
    var info = new BITMAPINFO();
    info.bmiHeader.biSize = (uint)Marshal.SizeOf(typeof(BITMAPINFOHEADER));
    info.bmiHeader.biWidth = width;
    info.bmiHeader.biHeight = -height;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    info.bmiHeader.biSizeImage = (uint)(width * height * 4);

    byte[] pixels = new byte[width * height * 4];
    IntPtr hdc = GetDC(IntPtr.Zero);
    try {
      int scanLines = GetDIBits(hdc, hbitmap, 0, (uint)height, pixels, ref info, DIB_RGB_COLORS);
      if (scanLines == 0) {
        throw new InvalidOperationException("GetDIBits failed.");
      }
    } finally {
      ReleaseDC(IntPtr.Zero, hdc);
    }

    var bitmap = new System.Drawing.Bitmap(width, height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
    var data = bitmap.LockBits(
      new System.Drawing.Rectangle(0, 0, width, height),
      System.Drawing.Imaging.ImageLockMode.WriteOnly,
      System.Drawing.Imaging.PixelFormat.Format32bppArgb
    );
    try {
      Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
    } finally {
      bitmap.UnlockBits(data);
    }
    return bitmap;
  }
}
"@

Add-Type -AssemblyName System.Drawing
if (-not ("CodexShellIconNative" -as [type])) {
  Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
}

function Convert-ImageFileToDataUrl([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  $mimeType = switch ($extension) {
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".ico" { "image/x-icon" }
    ".bmp" { "image/bmp" }
    default { $null }
  }
  if ($null -eq $mimeType) {
    return $null
  }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  return "data:$mimeType;base64,$([Convert]::ToBase64String($bytes))"
}

function Convert-ExeIconToDataUrl([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  Add-Type -AssemblyName System.Drawing
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($Path)
  if ($null -eq $icon) {
    return $null
  }

  $bitmap = $null
  $stream = New-Object System.IO.MemoryStream
  try {
    $bitmap = $icon.ToBitmap()
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return "data:image/png;base64,$([Convert]::ToBase64String($stream.ToArray()))"
  } finally {
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    $icon.Dispose()
    $stream.Dispose()
  }
}

$appPath = $env:CODEX_NATIVE_DESKTOP_APP_ICON_PATH
if ([string]::IsNullOrWhiteSpace($appPath)) {
  exit 0
}

$trimmedAppPath = $appPath.Trim()
if (Test-Path -LiteralPath $trimmedAppPath -PathType Leaf) {
  $extension = [System.IO.Path]::GetExtension($trimmedAppPath).ToLowerInvariant()
  $dataUrl = if ($extension -eq ".exe" -or $extension -eq ".dll") {
    Convert-ExeIconToDataUrl $trimmedAppPath
  } else {
    Convert-ImageFileToDataUrl $trimmedAppPath
  }
  if ($null -ne $dataUrl) {
    Write-Output $dataUrl
  }
  exit 0
}

try {
  Write-Output ([CodexShellIconNative]::GetAppsFolderIconDataUrl($trimmedAppPath))
} catch {
  exit 0
}
"#;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseVisibilityState {
    pub has_approval_store: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovedApp {
    pub bundle_identifier: String,
    pub display_name: String,
    #[serde(rename = "iconDataURL")]
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovalsState {
    pub approved_apps: Vec<ComputerUseApprovedApp>,
    pub approved_bundle_identifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseSoundModeReadResponse {
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseSoundModeWriteResponse {
    pub value: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChromeExtensionInstalledReadResponse {
    pub installed: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NativeDesktopAppMetadata {
    app_path: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseApprovalRemoveParams {
    pub bundle_identifier: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseSoundModeWriteParams {
    pub value: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChromeExtensionParams {
    pub extension_id: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ComputerUseApprovalStoreFile {
    #[serde(default)]
    approved_bundle_identifiers: Vec<String>,
}

#[tauri::command]
pub fn read_computer_use_approvals_visibility() -> Result<ComputerUseVisibilityState, String> {
    read_computer_use_approvals_visibility_state()
}

#[tauri::command(rename = "computer-use-app-approvals-visibility")]
pub fn computer_use_app_approvals_visibility() -> Result<ComputerUseVisibilityState, String> {
    read_computer_use_approvals_visibility_state()
}

#[tauri::command]
pub fn read_computer_use_approvals() -> Result<Option<ComputerUseApprovalsState>, String> {
    read_computer_use_approvals_state()
}

#[tauri::command(rename = "computer-use-app-approvals-read")]
pub fn computer_use_app_approvals_read() -> Result<Option<ComputerUseApprovalsState>, String> {
    read_computer_use_approvals_state()
}

#[tauri::command]
pub fn remove_computer_use_approval(
    params: ComputerUseApprovalRemoveParams,
) -> Result<Option<ComputerUseApprovalsState>, String> {
    remove_computer_use_approval_state(params)
}

#[tauri::command(rename = "computer-use-app-approval-remove")]
pub fn computer_use_app_approval_remove(
    params: ComputerUseApprovalRemoveParams,
) -> Result<Option<ComputerUseApprovalsState>, String> {
    remove_computer_use_approval_state(params)
}

#[tauri::command(rename = "computer-use-sound-mode-read")]
pub fn computer_use_sound_mode_read() -> Result<ComputerUseSoundModeReadResponse, String> {
    Ok(ComputerUseSoundModeReadResponse {
        value: read_computer_use_sound_mode()?,
    })
}

#[tauri::command(rename = "computer-use-sound-mode-write")]
pub fn computer_use_sound_mode_write(
    params: ComputerUseSoundModeWriteParams,
) -> Result<ComputerUseSoundModeWriteResponse, String> {
    Ok(ComputerUseSoundModeWriteResponse {
        value: write_computer_use_sound_mode(&params.value)?,
    })
}

#[tauri::command(rename = "chrome-extension-installed-read")]
pub fn chrome_extension_installed_read(
    params: ChromeExtensionParams,
) -> Result<ChromeExtensionInstalledReadResponse, String> {
    let extension_id = normalized_extension_id(&params.extension_id)?;
    Ok(ChromeExtensionInstalledReadResponse {
        installed: chrome_extension_is_installed(extension_id),
    })
}

#[tauri::command(rename = "chrome-extension-settings-open")]
pub fn chrome_extension_settings_open(params: ChromeExtensionParams) -> Result<(), String> {
    let extension_id = normalized_extension_id(&params.extension_id)?;
    open_chrome_extension_settings(extension_id)
}

fn read_computer_use_approvals_visibility_state() -> Result<ComputerUseVisibilityState, String> {
    Ok(ComputerUseVisibilityState {
        has_approval_store: computer_use_approval_store_path()?.exists(),
    })
}

fn read_computer_use_approvals_state() -> Result<Option<ComputerUseApprovalsState>, String> {
    let Some(bundle_identifiers) = read_computer_use_approval_store()? else {
        return Ok(None);
    };

    Ok(Some(computer_use_approvals_state(bundle_identifiers)))
}

fn remove_computer_use_approval_state(
    params: ComputerUseApprovalRemoveParams,
) -> Result<Option<ComputerUseApprovalsState>, String> {
    let Some(bundle_identifiers) = read_computer_use_approval_store()? else {
        return Ok(None);
    };

    let target_bundle_identifier = params.bundle_identifier.trim();
    let next_bundle_identifiers = bundle_identifiers
        .iter()
        .filter(|bundle_identifier| bundle_identifier.as_str() != target_bundle_identifier)
        .cloned()
        .collect::<Vec<_>>();

    if next_bundle_identifiers != bundle_identifiers {
        write_computer_use_approval_store(&next_bundle_identifiers)?;
    }

    Ok(Some(computer_use_approvals_state(next_bundle_identifiers)))
}

#[cfg(target_os = "macos")]
fn read_computer_use_sound_mode() -> Result<Option<String>, String> {
    let output = match Command::new("/usr/bin/defaults")
        .args([
            "read",
            COMPUTER_USE_SERVICE_BUNDLE_IDENTIFIER,
            COMPUTER_USE_SOUND_MODE_KEY,
        ])
        .output()
    {
        Ok(output) => output,
        Err(_) => return Ok(None),
    };

    if !output.status.success() {
        return Ok(None);
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

#[cfg(not(target_os = "macos"))]
fn read_computer_use_sound_mode() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(target_os = "macos")]
fn write_computer_use_sound_mode(value: &str) -> Result<String, String> {
    let output = Command::new("/usr/bin/defaults")
        .args([
            "write",
            COMPUTER_USE_SERVICE_BUNDLE_IDENTIFIER,
            COMPUTER_USE_SOUND_MODE_KEY,
            value,
        ])
        .output()
        .map_err(|err| format!("failed to write computer use sound mode: {err}"))?;

    if output.status.success() {
        Ok(value.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!(
                "failed to write computer use sound mode: defaults exited with {}",
                output.status
            ))
        } else {
            Err(format!("failed to write computer use sound mode: {stderr}"))
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn write_computer_use_sound_mode(value: &str) -> Result<String, String> {
    Ok(value.to_string())
}

fn read_computer_use_approval_store() -> Result<Option<Vec<String>>, String> {
    let approvals_path = computer_use_approval_store_path()?;
    if !approvals_path.exists() {
        return Ok(None);
    }

    let parsed_file = match fs::read_to_string(&approvals_path) {
        Ok(contents) => {
            serde_json::from_str::<ComputerUseApprovalStoreFile>(&contents).unwrap_or_default()
        }
        Err(_) => ComputerUseApprovalStoreFile::default(),
    };

    Ok(Some(normalized_bundle_identifiers(
        &parsed_file.approved_bundle_identifiers,
    )))
}

fn write_computer_use_approval_store(bundle_identifiers: &[String]) -> Result<(), String> {
    let approvals_path = computer_use_approval_store_path()?;
    let parent = approvals_path
        .parent()
        .ok_or_else(|| "computer use approval store path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create computer use approval store directory: {err}"))?;

    let contents = serde_json::to_string_pretty(&ComputerUseApprovalStoreFile {
        approved_bundle_identifiers: bundle_identifiers.to_vec(),
    })
    .map_err(|err| format!("failed to serialize computer use approvals: {err}"))?;
    let normalized_contents = if contents.ends_with('\n') {
        contents
    } else {
        format!("{contents}\n")
    };

    fs::write(&approvals_path, normalized_contents)
        .map_err(|err| format!("failed to write computer use approvals: {err}"))
}

fn computer_use_approvals_state(bundle_identifiers: Vec<String>) -> ComputerUseApprovalsState {
    let approved_apps = bundle_identifiers
        .iter()
        .map(|bundle_identifier| {
            if let Some(metadata) = resolve_native_desktop_app_metadata(bundle_identifier) {
                ComputerUseApprovedApp {
                    bundle_identifier: bundle_identifier.clone(),
                    display_name: metadata.display_name,
                    icon_data_url: resolve_native_desktop_app_icon_data_url(&metadata.app_path),
                }
            } else {
                ComputerUseApprovedApp {
                    bundle_identifier: bundle_identifier.clone(),
                    display_name: bundle_identifier.clone(),
                    icon_data_url: None,
                }
            }
        })
        .collect::<Vec<_>>();

    ComputerUseApprovalsState {
        approved_apps,
        approved_bundle_identifiers: bundle_identifiers,
    }
}

fn resolve_native_desktop_app_metadata(
    bundle_identifier: &str,
) -> Option<NativeDesktopAppMetadata> {
    #[cfg(target_os = "windows")]
    {
        let stdout = run_windows_powershell_script(
            WINDOWS_NATIVE_DESKTOP_APP_METADATA_SCRIPT,
            WINDOWS_NATIVE_DESKTOP_APP_BUNDLE_ID_ENV,
            bundle_identifier,
        )?;
        return parse_windows_native_desktop_app_metadata(&stdout);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = bundle_identifier;
        None
    }
}

fn resolve_native_desktop_app_icon_data_url(app_path: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let stdout = run_windows_powershell_script(
            WINDOWS_NATIVE_DESKTOP_APP_ICON_SCRIPT,
            WINDOWS_NATIVE_DESKTOP_APP_ICON_PATH_ENV,
            app_path,
        )?;
        return parse_windows_native_desktop_app_icon_data_url(&stdout);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_path;
        None
    }
}

fn parse_windows_native_desktop_app_metadata(stdout: &str) -> Option<NativeDesktopAppMetadata> {
    let metadata = serde_json::from_str::<NativeDesktopAppMetadata>(stdout.trim()).ok()?;
    if metadata.app_path.trim().is_empty() || metadata.display_name.trim().is_empty() {
        return None;
    }
    Some(metadata)
}

fn parse_windows_native_desktop_app_icon_data_url(stdout: &str) -> Option<String> {
    let data_url = stdout.trim();
    if data_url.starts_with("data:image/") {
        Some(data_url.to_string())
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn run_windows_powershell_script(script: &str, env_name: &str, env_value: &str) -> Option<String> {
    if env_value.trim().is_empty() {
        return None;
    }

    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env(env_name, env_value)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        None
    } else {
        Some(stdout)
    }
}

fn normalized_bundle_identifiers(bundle_identifiers: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();

    for bundle_identifier in bundle_identifiers {
        let trimmed_bundle_identifier = bundle_identifier.trim();
        if trimmed_bundle_identifier.is_empty()
            || normalized
                .iter()
                .any(|existing_identifier| existing_identifier == trimmed_bundle_identifier)
        {
            continue;
        }

        normalized.push(trimmed_bundle_identifier.to_string());
    }

    normalized
}

fn normalized_extension_id(extension_id: &str) -> Result<&str, String> {
    let trimmed_extension_id = extension_id.trim();
    if trimmed_extension_id.is_empty() {
        return Err("extensionId is empty".to_string());
    }

    Ok(trimmed_extension_id)
}

fn chrome_extension_is_installed(extension_id: &str) -> bool {
    chrome_user_data_roots().iter().any(|user_data_root| {
        chrome_extension_is_installed_in_user_data_root(user_data_root, extension_id)
    })
}

fn chrome_extension_is_installed_in_user_data_root(
    user_data_root: &Path,
    extension_id: &str,
) -> bool {
    let Ok(entries) = fs::read_dir(user_data_root) else {
        return false;
    };

    entries.filter_map(Result::ok).any(|entry| {
        let extension_directory = entry.path().join("Extensions").join(extension_id);
        extension_directory.is_dir()
            && fs::read_dir(&extension_directory)
                .ok()
                .and_then(|mut version_entries| version_entries.find_map(|item| item.ok()))
                .is_some()
    })
}

#[cfg(target_os = "windows")]
fn chrome_user_data_roots() -> Vec<PathBuf> {
    let Some(local_app_data) = non_empty_env_path("LOCALAPPDATA") else {
        return Vec::new();
    };

    vec![
        local_app_data
            .join("Google")
            .join("Chrome")
            .join("User Data"),
        local_app_data
            .join("Google")
            .join("Chrome Beta")
            .join("User Data"),
        local_app_data
            .join("Google")
            .join("Chrome Dev")
            .join("User Data"),
        local_app_data
            .join("Google")
            .join("Chrome SxS")
            .join("User Data"),
    ]
}

#[cfg(target_os = "macos")]
fn chrome_user_data_roots() -> Vec<PathBuf> {
    let Some(home_dir) = resolve_home_directory() else {
        return Vec::new();
    };

    let application_support = home_dir.join("Library").join("Application Support");
    vec![
        application_support.join("Google").join("Chrome"),
        application_support.join("Google").join("Chrome Beta"),
        application_support.join("Google").join("Chrome Dev"),
        application_support.join("Google").join("Chrome Canary"),
    ]
}

#[cfg(all(unix, not(target_os = "macos")))]
fn chrome_user_data_roots() -> Vec<PathBuf> {
    let Some(home_dir) = resolve_home_directory() else {
        return Vec::new();
    };

    let config_dir = home_dir.join(".config");
    vec![
        config_dir.join("google-chrome"),
        config_dir.join("google-chrome-beta"),
        config_dir.join("google-chrome-unstable"),
    ]
}

#[cfg(target_os = "windows")]
fn open_chrome_extension_settings(extension_id: &str) -> Result<(), String> {
    let settings_url = chrome_extension_settings_url(extension_id);
    for chrome_executable in chrome_windows_executable_candidates() {
        if chrome_executable.exists() {
            return run_command_success(
                Command::new(&chrome_executable).arg(&settings_url),
                &chrome_executable.display().to_string(),
            );
        }
    }

    run_command_success(
        Command::new("cmd.exe")
            .args(["/d", "/c", "start", ""])
            .arg(&settings_url),
        "cmd.exe",
    )
}

#[cfg(target_os = "macos")]
fn open_chrome_extension_settings(extension_id: &str) -> Result<(), String> {
    let settings_url = chrome_extension_settings_url(extension_id);
    for application_name in [
        "Google Chrome",
        "Google Chrome Beta",
        "Google Chrome Dev",
        "Google Chrome Canary",
    ] {
        if run_command_success(
            Command::new("open").args(["-a", application_name, &settings_url]),
            "open",
        )
        .is_ok()
        {
            return Ok(());
        }
    }

    Err("failed to launch Google Chrome".to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_chrome_extension_settings(extension_id: &str) -> Result<(), String> {
    let settings_url = chrome_extension_settings_url(extension_id);
    for browser_command in [
        "google-chrome",
        "google-chrome-stable",
        "google-chrome-beta",
        "google-chrome-unstable",
    ] {
        if run_command_success(
            Command::new(browser_command).arg(&settings_url),
            browser_command,
        )
        .is_ok()
        {
            return Ok(());
        }
    }

    run_command_success(Command::new("xdg-open").arg(&settings_url), "xdg-open")
}

#[cfg(target_os = "windows")]
fn chrome_windows_executable_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut base_directories = Vec::new();

    if let Some(local_app_data) = non_empty_env_path("LOCALAPPDATA") {
        base_directories.push(local_app_data);
    }
    if let Some(program_files) = non_empty_env_path("PROGRAMFILES") {
        base_directories.push(program_files);
    }
    if let Some(program_files_x86) = non_empty_env_path("PROGRAMFILES(X86)") {
        base_directories.push(program_files_x86);
    }

    for base_directory in base_directories {
        for channel_directory in [
            ["Google", "Chrome"],
            ["Google", "Chrome Beta"],
            ["Google", "Chrome Dev"],
            ["Google", "Chrome SxS"],
        ] {
            let mut executable_path = base_directory.clone();
            for path_segment in channel_directory {
                executable_path.push(path_segment);
            }
            executable_path.push("Application");
            executable_path.push("chrome.exe");
            candidates.push(executable_path);
        }
    }

    candidates
}

fn chrome_extension_settings_url(extension_id: &str) -> String {
    format!("chrome://extensions/?id={extension_id}")
}

fn run_command_success(command: &mut Command, program_name: &str) -> Result<(), String> {
    let status = command
        .status()
        .map_err(|err| format!("failed to launch {program_name}: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program_name} exited with {status}"))
    }
}

fn computer_use_approval_store_path() -> Result<PathBuf, String> {
    let home_dir =
        resolve_home_directory().ok_or_else(|| "failed to resolve home directory".to_string())?;

    Ok(home_dir
        .join("Library")
        .join("Group Containers")
        .join(COMPUTER_USE_GROUP_CONTAINER)
        .join("Library")
        .join("Application Support")
        .join("Software")
        .join(COMPUTER_USE_APPROVALS_FILE))
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

#[cfg(test)]
mod tests {
    use super::chrome_extension_is_installed_in_user_data_root;
    use super::chrome_extension_settings_url;
    use super::computer_use_approvals_state;
    use super::normalized_bundle_identifiers;
    use super::normalized_extension_id;
    use super::parse_windows_native_desktop_app_icon_data_url;
    use super::parse_windows_native_desktop_app_metadata;
    use super::read_computer_use_sound_mode;
    use super::write_computer_use_sound_mode;
    use super::ChromeExtensionParams;
    use super::ComputerUseApprovalsState;
    use super::ComputerUseApprovedApp;
    use super::NativeDesktopAppMetadata;
    use std::fs;
    use std::path::PathBuf;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    use serde_json::json;

    #[test]
    fn normalized_bundle_identifiers_trims_and_deduplicates() {
        let bundle_identifiers = vec![
            " com.example.app ".to_string(),
            "com.example.app".to_string(),
            "".to_string(),
            "com.example.other".to_string(),
        ];

        assert_eq!(
            normalized_bundle_identifiers(&bundle_identifiers),
            vec![
                "com.example.app".to_string(),
                "com.example.other".to_string()
            ]
        );
    }

    #[test]
    fn chrome_extension_params_accept_extension_id() {
        let params: ChromeExtensionParams = serde_json::from_value(json!({
            "extensionId": "abcdefghijklmnopabcdefghijklmnop"
        }))
        .expect("params should deserialize");

        assert_eq!(
            params,
            ChromeExtensionParams {
                extension_id: "abcdefghijklmnopabcdefghijklmnop".to_string(),
            }
        );
    }

    #[test]
    fn normalized_extension_id_trims_and_rejects_empty_values() {
        assert_eq!(
            normalized_extension_id("  abcdefghijklmnopabcdefghijklmnop  ")
                .expect("extension id should trim"),
            "abcdefghijklmnopabcdefghijklmnop"
        );
        assert_eq!(
            normalized_extension_id("   ").expect_err("empty extension id should fail"),
            "extensionId is empty"
        );
    }

    #[test]
    fn chrome_extension_settings_url_targets_extension_management_page() {
        assert_eq!(
            chrome_extension_settings_url("abcdefghijklmnopabcdefghijklmnop"),
            "chrome://extensions/?id=abcdefghijklmnopabcdefghijklmnop".to_string()
        );
    }

    #[test]
    fn installed_extension_read_detects_version_directory_in_profile() {
        let user_data_root = temp_dir("chrome-extension-installed");
        let extension_directory = user_data_root
            .join("Default")
            .join("Extensions")
            .join("abcdefghijklmnopabcdefghijklmnop")
            .join("1.0.0");
        fs::create_dir_all(&extension_directory)
            .expect("extension version directory should be created");

        assert!(
            chrome_extension_is_installed_in_user_data_root(
                &user_data_root,
                "abcdefghijklmnopabcdefghijklmnop"
            ),
            "extension directory with a version entry should count as installed"
        );

        let _ = fs::remove_dir_all(user_data_root);
    }

    #[test]
    fn installed_extension_read_ignores_empty_extension_directory() {
        let user_data_root = temp_dir("chrome-extension-empty");
        let extension_directory = user_data_root
            .join("Profile 1")
            .join("Extensions")
            .join("abcdefghijklmnopabcdefghijklmnop");
        fs::create_dir_all(&extension_directory).expect("extension directory should be created");

        assert!(
            !chrome_extension_is_installed_in_user_data_root(
                &user_data_root,
                "abcdefghijklmnopabcdefghijklmnop"
            ),
            "extension directory without version entries should not count as installed"
        );

        let _ = fs::remove_dir_all(user_data_root);
    }

    #[test]
    fn computer_use_approvals_state_uses_bundle_identifier_fallbacks() {
        let state = computer_use_approvals_state(vec!["com.example.app".to_string()]);

        assert_eq!(
            state,
            ComputerUseApprovalsState {
                approved_apps: vec![ComputerUseApprovedApp {
                    bundle_identifier: "com.example.app".to_string(),
                    display_name: "com.example.app".to_string(),
                    icon_data_url: None,
                }],
                approved_bundle_identifiers: vec!["com.example.app".to_string()],
            }
        );
    }

    #[test]
    fn parse_windows_native_desktop_app_metadata_requires_non_empty_fields() {
        assert_eq!(
            parse_windows_native_desktop_app_metadata(
                r#"{"appPath":"C:\\Apps\\App.exe","displayName":"Calculator"}"#
            ),
            Some(NativeDesktopAppMetadata {
                app_path: r"C:\Apps\App.exe".to_string(),
                display_name: "Calculator".to_string(),
            })
        );
        assert_eq!(
            parse_windows_native_desktop_app_metadata(r#"{"appPath":"","displayName":"App"}"#),
            None
        );
        assert_eq!(
            parse_windows_native_desktop_app_metadata(
                r#"{"appPath":"C:\\Apps\\App.exe","displayName":""}"#
            ),
            None
        );
    }

    #[test]
    fn parse_windows_native_desktop_app_icon_data_url_requires_image_data_url() {
        assert_eq!(
            parse_windows_native_desktop_app_icon_data_url("data:image/png;base64,aGVsbG8="),
            Some("data:image/png;base64,aGVsbG8=".to_string())
        );
        assert_eq!(
            parse_windows_native_desktop_app_icon_data_url("not-a-data-url"),
            None
        );
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn sound_mode_read_returns_none_off_macos() {
        assert_eq!(read_computer_use_sound_mode().unwrap(), None);
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn sound_mode_write_echoes_value_off_macos() {
        assert_eq!(
            write_computer_use_sound_mode("foregroundClicks").unwrap(),
            "foregroundClicks".to_string()
        );
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
