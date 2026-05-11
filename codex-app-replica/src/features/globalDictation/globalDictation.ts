import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const GLOBAL_DICTATION_START_EVENT = "global-dictation-start";
export const GLOBAL_DICTATION_STOP_EVENT = "global-dictation-stop";

export type GlobalDictationSessionParams = {
  sessionId: string;
};

export type GlobalDictationCompletedParams = {
  sessionId: string;
  text: string;
};

export type GlobalDictationFailedParams = {
  sessionId: string;
  stage: "recording" | "transcription";
};

export type GlobalDictationLayout = "compact" | "error";

export type GlobalDictationLayoutParams = {
  sessionId: string;
  layout: GlobalDictationLayout;
};

export type GlobalDictationTranscribeAudioParams = {
  audioBytes: Uint8Array;
  cleanupEnabled?: boolean;
  contentType?: string | null;
  surroundingText?: string | null;
};

export type GlobalDictationTranscribeAudioResponse = {
  text: string;
};

export async function requestMicrophonePermission() {
  await invoke<void>("electron-request-microphone-permission");
}

export async function updateGlobalDictationWindowLayout(params: GlobalDictationLayoutParams) {
  await invoke<void>("global-dictation-window-layout", { params });
}

export async function notifyGlobalDictationRecordingStopped(params: GlobalDictationSessionParams) {
  await invoke<void>("global-dictation-recording-stopped", { params });
}

export async function notifyGlobalDictationCompleted(params: GlobalDictationCompletedParams) {
  await invoke<void>("global-dictation-completed", { params });
}

export async function notifyGlobalDictationFailed(params: GlobalDictationFailedParams) {
  await invoke<void>("global-dictation-failed", { params });
}

export async function dismissGlobalDictation(params: GlobalDictationSessionParams) {
  await invoke<void>("global-dictation-dismiss", { params });
}

export async function transcribeGlobalDictationAudio(
  params: GlobalDictationTranscribeAudioParams,
) {
  return invoke<GlobalDictationTranscribeAudioResponse>("global-dictation-transcribe-audio", {
    params: {
      audioBytes: Array.from(params.audioBytes),
      cleanupEnabled: params.cleanupEnabled ?? false,
      contentType: params.contentType ?? null,
      surroundingText: params.surroundingText ?? null,
    },
  });
}

export function onGlobalDictationStart(
  handler: (notification: GlobalDictationSessionParams) => void,
) {
  return listen<GlobalDictationSessionParams>(GLOBAL_DICTATION_START_EVENT, (event) => {
    handler(event.payload);
  });
}

export function onGlobalDictationStop(
  handler: (notification: GlobalDictationSessionParams) => void,
) {
  return listen<GlobalDictationSessionParams>(GLOBAL_DICTATION_STOP_EVENT, (event) => {
    handler(event.payload);
  });
}
