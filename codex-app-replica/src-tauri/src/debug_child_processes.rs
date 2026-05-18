use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::process::Command;
use std::sync::Mutex;
use std::time::Instant;
use tauri::async_runtime::spawn_blocking;
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(target_os = "windows")]
const WINDOWS_CHILD_PROCESSES_SCRIPT: &str = r#"
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$processesById = @{}
Get-CimInstance -ClassName Win32_Process | ForEach-Object {
  $command = $_.CommandLine
  if ([string]::IsNullOrWhiteSpace($command)) {
    $command = $_.ExecutablePath
  }

  $ageSeconds = $null
  if ($null -ne $_.CreationDate) {
    try {
      $ageSeconds = [Math]::Max(0, ([DateTime]::UtcNow - $_.CreationDate.ToUniversalTime()).TotalSeconds)
    } catch {
      $ageSeconds = $null
    }
  }

  $processesById[[int]$_.ProcessId] = [ordered]@{
    pid = [int]$_.ProcessId
    parentPid = if ($_.ParentProcessId -gt 0) { [int]$_.ParentProcessId } else { $null }
    command = if ([string]::IsNullOrWhiteSpace($command)) { "" } else { [string]$command }
    rssKb = $null
    cpuSeconds = $null
    ageSeconds = $ageSeconds
  }
}

Get-Process | ForEach-Object {
  $pid = [int]$_.Id
  if (-not $processesById.ContainsKey($pid)) {
    $processesById[$pid] = [ordered]@{
      pid = $pid
      parentPid = $null
      command = ""
      rssKb = $null
      cpuSeconds = $null
      ageSeconds = $null
    }
  }

  $record = $processesById[$pid]

  try {
    if ($null -ne $_.WorkingSet64) {
      $record.rssKb = [Math]::Round([double]$_.WorkingSet64 / 1KB)
    }
  } catch {
  }

  try {
    if ($null -ne $_.CPU) {
      $record.cpuSeconds = [double]$_.CPU
    }
  } catch {
  }

  try {
    if ([string]::IsNullOrWhiteSpace($record.command)) {
      if (-not [string]::IsNullOrWhiteSpace($_.Path)) {
        $record.command = [string]$_.Path
      } elseif (-not [string]::IsNullOrWhiteSpace($_.ProcessName)) {
        $record.command = [string]$_.ProcessName
      }
    }
  } catch {
    if ([string]::IsNullOrWhiteSpace($record.command) -and -not [string]::IsNullOrWhiteSpace($_.ProcessName)) {
      $record.command = [string]$_.ProcessName
    }
  }
}

@($processesById.Values | Sort-Object pid) | ConvertTo-Json -Compress -Depth 4
"#;

#[derive(Debug, Default)]
pub struct ChildProcessMetricsState {
    sample: Mutex<ChildProcessCpuSampleCache>,
}

#[derive(Debug, Clone, Default)]
struct ChildProcessCpuSampleCache {
    sampled_at: Option<Instant>,
    cpu_seconds_by_pid: HashMap<u32, f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChildProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub command: String,
    pub rss_kb: Option<u64>,
    pub cpu_percent: Option<f64>,
    pub age_seconds: Option<f64>,
    pub depth: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChildProcessesResponse {
    pub root_process: Option<ChildProcessInfo>,
    pub processes: Vec<ChildProcessInfo>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct WindowsProcessSample {
    pid: u32,
    parent_pid: Option<u32>,
    command: String,
    rss_kb: Option<u64>,
    cpu_seconds: Option<f64>,
    age_seconds: Option<f64>,
}

#[tauri::command(rename = "child-processes")]
pub async fn child_processes(
    state: State<'_, ChildProcessMetricsState>,
) -> Result<ChildProcessesResponse, String> {
    let previous_sample = state
        .sample
        .lock()
        .map_err(|_| "child process metrics state mutex poisoned".to_string())?
        .clone();
    let current_pid = std::process::id();

    let (response, next_sample) =
        spawn_blocking(move || read_child_processes_snapshot(current_pid, previous_sample))
            .await
            .map_err(|err| format!("failed to read child processes: {err}"))??;

    *state
        .sample
        .lock()
        .map_err(|_| "child process metrics state mutex poisoned".to_string())? = next_sample;

    Ok(response)
}

fn read_child_processes_snapshot(
    current_pid: u32,
    previous_sample: ChildProcessCpuSampleCache,
) -> Result<(ChildProcessesResponse, ChildProcessCpuSampleCache), String> {
    let processes = read_windows_process_samples()?;
    let sampled_at = Instant::now();
    let cpu_percent_by_pid = compute_cpu_percent_by_pid(&processes, &previous_sample, sampled_at);

    let next_sample = ChildProcessCpuSampleCache {
        sampled_at: Some(sampled_at),
        cpu_seconds_by_pid: processes
            .iter()
            .filter_map(|process| {
                process
                    .cpu_seconds
                    .map(|cpu_seconds| (process.pid, cpu_seconds))
            })
            .collect(),
    };

    Ok((
        build_child_processes_response(current_pid, &processes, &cpu_percent_by_pid),
        next_sample,
    ))
}

fn build_child_processes_response(
    current_pid: u32,
    processes: &[WindowsProcessSample],
    cpu_percent_by_pid: &HashMap<u32, Option<f64>>,
) -> ChildProcessesResponse {
    let processes_by_pid = processes
        .iter()
        .cloned()
        .map(|process| (process.pid, process))
        .collect::<HashMap<_, _>>();
    let Some(root_process) = processes_by_pid.get(&current_pid) else {
        return ChildProcessesResponse {
            root_process: None,
            processes: Vec::new(),
        };
    };

    let mut children_by_parent = HashMap::<u32, Vec<u32>>::new();
    for process in processes {
        if let Some(parent_pid) = process.parent_pid {
            children_by_parent
                .entry(parent_pid)
                .or_default()
                .push(process.pid);
        }
    }

    let mut descendants = Vec::new();
    let mut visited = HashSet::from([current_pid]);
    collect_descendant_processes(
        current_pid,
        1,
        &children_by_parent,
        &processes_by_pid,
        cpu_percent_by_pid,
        &mut visited,
        &mut descendants,
    );

    ChildProcessesResponse {
        root_process: Some(to_child_process_info(
            root_process,
            0,
            cpu_percent_by_pid.get(&root_process.pid).copied().flatten(),
        )),
        processes: descendants,
    }
}

fn collect_descendant_processes(
    parent_pid: u32,
    depth: usize,
    children_by_parent: &HashMap<u32, Vec<u32>>,
    processes_by_pid: &HashMap<u32, WindowsProcessSample>,
    cpu_percent_by_pid: &HashMap<u32, Option<f64>>,
    visited: &mut HashSet<u32>,
    descendants: &mut Vec<ChildProcessInfo>,
) {
    let Some(child_pids) = children_by_parent.get(&parent_pid) else {
        return;
    };

    for child_pid in child_pids {
        if !visited.insert(*child_pid) {
            continue;
        }

        let Some(child_process) = processes_by_pid.get(child_pid) else {
            continue;
        };

        descendants.push(to_child_process_info(
            child_process,
            depth,
            cpu_percent_by_pid.get(child_pid).copied().flatten(),
        ));

        collect_descendant_processes(
            *child_pid,
            depth + 1,
            children_by_parent,
            processes_by_pid,
            cpu_percent_by_pid,
            visited,
            descendants,
        );
    }
}

fn to_child_process_info(
    process: &WindowsProcessSample,
    depth: usize,
    cpu_percent: Option<f64>,
) -> ChildProcessInfo {
    ChildProcessInfo {
        pid: process.pid,
        parent_pid: process.parent_pid,
        command: process.command.clone(),
        rss_kb: process.rss_kb,
        cpu_percent,
        age_seconds: process.age_seconds.map(|age_seconds| age_seconds.max(0.0)),
        depth,
    }
}

fn compute_cpu_percent_by_pid(
    processes: &[WindowsProcessSample],
    previous_sample: &ChildProcessCpuSampleCache,
    sampled_at: Instant,
) -> HashMap<u32, Option<f64>> {
    let mut cpu_percent_by_pid = HashMap::new();
    let Some(previous_sampled_at) = previous_sample.sampled_at else {
        for process in processes {
            cpu_percent_by_pid.insert(process.pid, None);
        }
        return cpu_percent_by_pid;
    };

    let elapsed_seconds = sampled_at
        .saturating_duration_since(previous_sampled_at)
        .as_secs_f64();
    if elapsed_seconds <= 0.0 {
        for process in processes {
            cpu_percent_by_pid.insert(process.pid, None);
        }
        return cpu_percent_by_pid;
    }

    for process in processes {
        let cpu_percent = match (
            process.cpu_seconds,
            previous_sample
                .cpu_seconds_by_pid
                .get(&process.pid)
                .copied(),
        ) {
            (Some(cpu_seconds), Some(previous_cpu_seconds))
                if cpu_seconds >= previous_cpu_seconds =>
            {
                Some(((cpu_seconds - previous_cpu_seconds) / elapsed_seconds) * 100.0)
            }
            _ => None,
        };
        cpu_percent_by_pid.insert(process.pid, cpu_percent.map(|value| value.max(0.0)));
    }

    cpu_percent_by_pid
}

#[cfg(target_os = "windows")]
fn read_windows_process_samples() -> Result<Vec<WindowsProcessSample>, String> {
    let mut command = Command::new("powershell.exe");
    command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            WINDOWS_CHILD_PROCESSES_SCRIPT,
        ])
        .creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|err| format!("failed to query Windows child processes: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return if stderr.is_empty() {
            Err(format!(
                "failed to query Windows child processes: powershell exited with {}",
                output.status
            ))
        } else {
            Err(format!("failed to query Windows child processes: {stderr}"))
        };
    }

    parse_windows_process_samples(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(target_os = "windows"))]
fn read_windows_process_samples() -> Result<Vec<WindowsProcessSample>, String> {
    Ok(Vec::new())
}

fn parse_windows_process_samples(stdout: &str) -> Result<Vec<WindowsProcessSample>, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let value = serde_json::from_str::<serde_json::Value>(trimmed)
        .map_err(|err| format!("failed to parse child process snapshot: {err}"))?;
    match value {
        serde_json::Value::Array(items) => items
            .into_iter()
            .map(|item| {
                serde_json::from_value::<WindowsProcessSample>(item)
                    .map_err(|err| format!("failed to decode child process snapshot entry: {err}"))
            })
            .collect(),
        object @ serde_json::Value::Object(_) => {
            serde_json::from_value::<WindowsProcessSample>(object)
                .map(|process| vec![process])
                .map_err(|err| format!("failed to decode child process snapshot entry: {err}"))
        }
        _ => Err("failed to parse child process snapshot: expected object or array".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::build_child_processes_response;
    use super::compute_cpu_percent_by_pid;
    use super::ChildProcessCpuSampleCache;
    use super::ChildProcessInfo;
    use super::ChildProcessesResponse;
    use super::WindowsProcessSample;
    use std::collections::HashMap;
    use std::time::Duration;
    use std::time::Instant;

    #[test]
    fn response_includes_only_root_and_descendants() {
        let processes = vec![
            WindowsProcessSample {
                pid: 100,
                parent_pid: Some(1),
                command: "codex.exe".to_string(),
                rss_kb: Some(512),
                cpu_seconds: Some(10.0),
                age_seconds: Some(120.0),
            },
            WindowsProcessSample {
                pid: 200,
                parent_pid: Some(100),
                command: "helper.exe".to_string(),
                rss_kb: Some(256),
                cpu_seconds: Some(5.0),
                age_seconds: Some(60.0),
            },
            WindowsProcessSample {
                pid: 300,
                parent_pid: Some(200),
                command: "worker.exe".to_string(),
                rss_kb: Some(128),
                cpu_seconds: Some(2.0),
                age_seconds: Some(30.0),
            },
            WindowsProcessSample {
                pid: 400,
                parent_pid: Some(1),
                command: "unrelated.exe".to_string(),
                rss_kb: Some(64),
                cpu_seconds: Some(1.0),
                age_seconds: Some(15.0),
            },
        ];

        let cpu_percent_by_pid = HashMap::from([
            (100, Some(12.5)),
            (200, Some(20.0)),
            (300, Some(30.0)),
            (400, Some(40.0)),
        ]);

        let response = build_child_processes_response(100, &processes, &cpu_percent_by_pid);

        assert_eq!(
            response,
            ChildProcessesResponse {
                root_process: Some(ChildProcessInfo {
                    pid: 100,
                    parent_pid: Some(1),
                    command: "codex.exe".to_string(),
                    rss_kb: Some(512),
                    cpu_percent: Some(12.5),
                    age_seconds: Some(120.0),
                    depth: 0,
                }),
                processes: vec![
                    ChildProcessInfo {
                        pid: 200,
                        parent_pid: Some(100),
                        command: "helper.exe".to_string(),
                        rss_kb: Some(256),
                        cpu_percent: Some(20.0),
                        age_seconds: Some(60.0),
                        depth: 1,
                    },
                    ChildProcessInfo {
                        pid: 300,
                        parent_pid: Some(200),
                        command: "worker.exe".to_string(),
                        rss_kb: Some(128),
                        cpu_percent: Some(30.0),
                        age_seconds: Some(30.0),
                        depth: 2,
                    },
                ],
            }
        );
    }

    #[test]
    fn cpu_percent_uses_previous_sample_delta() {
        let sampled_at = Instant::now();
        let previous_sample = ChildProcessCpuSampleCache {
            sampled_at: Some(sampled_at - Duration::from_secs(10)),
            cpu_seconds_by_pid: HashMap::from([(100, 1.0), (200, 2.0)]),
        };
        let processes = vec![
            WindowsProcessSample {
                pid: 100,
                parent_pid: Some(1),
                command: "codex.exe".to_string(),
                rss_kb: Some(512),
                cpu_seconds: Some(3.5),
                age_seconds: Some(120.0),
            },
            WindowsProcessSample {
                pid: 200,
                parent_pid: Some(100),
                command: "helper.exe".to_string(),
                rss_kb: Some(256),
                cpu_seconds: None,
                age_seconds: Some(60.0),
            },
        ];

        let cpu_percent_by_pid =
            compute_cpu_percent_by_pid(&processes, &previous_sample, sampled_at);

        assert_eq!(cpu_percent_by_pid.get(&100), Some(&Some(25.0)));
        assert_eq!(cpu_percent_by_pid.get(&200), Some(&None));
    }
}
