use serde::Deserialize;
use tauri::State;

#[cfg(target_os = "windows")]
use std::io;
#[cfg(target_os = "windows")]
use std::sync::mpsc::{self, Receiver, Sender};
#[cfg(target_os = "windows")]
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::thread;

#[cfg(target_os = "windows")]
const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;
#[cfg(target_os = "windows")]
const ES_CONTINUOUS: u32 = 0x8000_0000;

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    #[link_name = "SetThreadExecutionState"]
    fn set_thread_execution_state(execution_state: u32) -> u32;
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerSaveBlockerSetParams {
    pub should_block: bool,
}

#[derive(Default)]
pub struct PowerSaveBlockerState {
    #[cfg(target_os = "windows")]
    request_sender: Mutex<Option<Sender<PowerSaveBlockerRequest>>>,
}

#[cfg(target_os = "windows")]
#[derive(Debug)]
struct PowerSaveBlockerRequest {
    should_block: bool,
    response_sender: Sender<Result<(), String>>,
}

#[tauri::command(rename = "power-save-blocker-set")]
pub fn power_save_blocker_set(
    params: PowerSaveBlockerSetParams,
    state: State<'_, PowerSaveBlockerState>,
) -> Result<(), String> {
    state.set_should_block(params.should_block)
}

impl PowerSaveBlockerState {
    fn set_should_block(&self, should_block: bool) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            let request_sender = self.request_sender()?;
            let (response_sender, response_receiver) = mpsc::channel();
            request_sender
                .send(PowerSaveBlockerRequest {
                    should_block,
                    response_sender,
                })
                .map_err(|_| "failed to send power save blocker request".to_string())?;
            return response_receiver
                .recv()
                .map_err(|_| "power save blocker worker stopped unexpectedly".to_string())?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = should_block;
            Ok(())
        }
    }

    #[cfg(target_os = "windows")]
    fn request_sender(&self) -> Result<Sender<PowerSaveBlockerRequest>, String> {
        let mut guard = self
            .request_sender
            .lock()
            .map_err(|_| "power save blocker mutex poisoned".to_string())?;
        if let Some(request_sender) = guard.as_ref() {
            return Ok(request_sender.clone());
        }

        let (request_sender, request_receiver) = mpsc::channel();
        thread::Builder::new()
            .name("power-save-blocker".to_string())
            .spawn(move || power_save_blocker_worker(request_receiver))
            .map_err(|err| format!("failed to spawn power save blocker worker: {err}"))?;
        *guard = Some(request_sender.clone());
        Ok(request_sender)
    }
}

#[cfg(target_os = "windows")]
// SetThreadExecutionState is thread-scoped, so a dedicated worker owns the native state.
fn power_save_blocker_worker(request_receiver: Receiver<PowerSaveBlockerRequest>) {
    let mut last_should_block = false;

    while let Ok(request) = request_receiver.recv() {
        let result = if request.should_block == last_should_block {
            Ok(())
        } else {
            apply_execution_state(request.should_block).map(|()| {
                last_should_block = request.should_block;
            })
        };
        let _ = request.response_sender.send(result);
    }

    let _ = apply_execution_state(false);
}

#[cfg(target_os = "windows")]
fn apply_execution_state(should_block: bool) -> Result<(), String> {
    let result = unsafe { set_thread_execution_state(execution_state_flags(should_block)) };
    if result == 0 {
        return Err(format!(
            "SetThreadExecutionState failed: {}",
            io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn execution_state_flags(should_block: bool) -> u32 {
    if should_block {
        ES_CONTINUOUS | ES_SYSTEM_REQUIRED
    } else {
        ES_CONTINUOUS
    }
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "windows")]
    use super::{execution_state_flags, ES_CONTINUOUS, ES_SYSTEM_REQUIRED};

    #[cfg(target_os = "windows")]
    #[test]
    fn execution_state_flags_match_expected_masks() {
        assert_eq!(execution_state_flags(false), ES_CONTINUOUS);
        assert_eq!(
            execution_state_flags(true),
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        );
    }
}
