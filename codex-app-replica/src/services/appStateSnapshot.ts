import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const APP_STATE_SNAPSHOT_REQUEST_EVENT = "electron-app-state-snapshot-request";
const RENDERER_FRAME_INTERVAL_WINDOW_MS = 30_000;

type RendererFrameIntervalSample = {
  intervalMs: number;
  timestampMs: number;
};

const rendererFrameIntervalSamples: RendererFrameIntervalSample[] = [];

let previousAnimationFrameTimestampMs: number | null = null;
let rendererFrameIntervalSamplerStarted = false;

export type AppStateSnapshotRequestNotification = {
  hostId: string;
  requestId: string;
  reason: string;
};

export type AppStateSnapshotFields = {
  event: "app_state_snapshot";
  schema_version: 1;
  snapshot_reason: string;
  session_age_ms: number;
  thread_count_total: number;
  thread_count_loaded_recent: number;
  thread_count_active: number;
  thread_count_streaming_owner: number;
  thread_count_streaming_follower: number;
  thread_count_streaming_without_role: number;
  thread_count_streaming_with_active_runtime: number;
  thread_count_streaming_without_active_runtime: number;
  thread_count_with_inflight_turn: number;
  turn_count_total_loaded: number;
  item_count_total_loaded: number;
  max_turns_in_single_thread: number;
  max_items_in_single_turn: number;
  pending_request_count: number;
  inflight_turn_count: number;
  delta_events_total: number;
  delta_bytes_total_estimate: number;
  delta_events_last_30s: number;
  delta_bytes_last_30s_estimate: number;
  renderer_frame_interval_sample_count_last_30s: number;
  renderer_frame_interval_p95_ms_last_30s: number | null;
  review_diff_files_total: number;
  review_diff_lines_total: number;
  review_diff_bytes_estimate: number;
};

export function onAppStateSnapshotRequested(
  handler: (notification: AppStateSnapshotRequestNotification) => void,
) {
  return listen<AppStateSnapshotRequestNotification>(APP_STATE_SNAPSHOT_REQUEST_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function sendAppStateSnapshotResponse(params: {
  requestId: string;
  fields: AppStateSnapshotFields;
}) {
  await invoke("electron-app-state-snapshot-response", { params });
}

export async function notifyViewFocused() {
  await invoke("view-focused");
}

export function startRendererFrameIntervalSampler() {
  if (typeof window === "undefined" || rendererFrameIntervalSamplerStarted) {
    return;
  }

  rendererFrameIntervalSamplerStarted = true;
  window.requestAnimationFrame(recordRendererFrameIntervalSample);
}

export function readRendererFrameIntervalSnapshot() {
  const nowMs = typeof performance === "undefined" ? 0 : performance.now();
  pruneOldRendererFrameIntervalSamples(nowMs);
  const sortedIntervalsMs = rendererFrameIntervalSamples
    .map((sample) => sample.intervalMs)
    .sort((left, right) => left - right);
  const rendererFrameIntervalSampleCountLast30s = sortedIntervalsMs.length;

  return {
    rendererFrameIntervalSampleCountLast30s,
    rendererFrameIntervalP95MsLast30s:
      rendererFrameIntervalSampleCountLast30s === 0
        ? null
        : sortedIntervalsMs[Math.min(
            rendererFrameIntervalSampleCountLast30s - 1,
            Math.max(0, Math.ceil(rendererFrameIntervalSampleCountLast30s * 0.95) - 1),
          )],
  };
}

export function estimateUtf8Bytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function recordRendererFrameIntervalSample(timestampMs: number) {
  if (previousAnimationFrameTimestampMs !== null) {
    rendererFrameIntervalSamples.push({
      intervalMs: timestampMs - previousAnimationFrameTimestampMs,
      timestampMs,
    });
    pruneOldRendererFrameIntervalSamples(timestampMs);
  }

  previousAnimationFrameTimestampMs = timestampMs;
  window.requestAnimationFrame(recordRendererFrameIntervalSample);
}

function pruneOldRendererFrameIntervalSamples(nowMs: number) {
  while (
    rendererFrameIntervalSamples.length > 0 &&
    nowMs - rendererFrameIntervalSamples[0].timestampMs > RENDERER_FRAME_INTERVAL_WINDOW_MS
  ) {
    rendererFrameIntervalSamples.shift();
  }
}
