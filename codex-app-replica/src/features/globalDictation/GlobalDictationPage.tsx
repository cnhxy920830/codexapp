import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RefreshIcon } from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import { GLOBAL_DICTATION_ROUTE_PATH } from "../../services/windowNavigation";
import {
  dismissGlobalDictation,
  notifyGlobalDictationCompleted,
  notifyGlobalDictationFailed,
  notifyGlobalDictationRecordingStopped,
  onGlobalDictationStart,
  onGlobalDictationStop,
  requestMicrophonePermission,
  transcribeGlobalDictationAudio,
  updateGlobalDictationWindowLayout,
  type GlobalDictationSessionParams,
} from "./globalDictation";
import {
  resolveGlobalDictationError,
  type GlobalDictationErrorStage,
} from "./globalDictationErrors";
import { useGlobalDictationWaveform } from "./useGlobalDictationWaveform";

const CLEANUP_ENABLED = false;
const MINIMUM_RECORDING_DURATION_MS = 250;

type GlobalDictationStatus = "starting" | "listening" | "transcribing" | "error";

type ActiveRecordingSession = {
  chunks: Blob[];
  isStopping: boolean;
  recorder: MediaRecorder;
  sessionId: string;
  startedAtMs: number;
  stream: MediaStream;
};

type RetryRecordingSession = {
  audio: Blob;
  sessionId: string;
};

export function GlobalDictationPage() {
  const { t } = useI18n();
  const [canRetry, setCanRetry] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<GlobalDictationStatus>("starting");
  const activeRecordingRef = useRef<ActiveRecordingSession | null>(null);
  const pendingStartSessionIdRef = useRef<string | null>(null);
  const pendingStopSessionIdRef = useRef<string | null>(null);
  const retryRecordingRef = useRef<RetryRecordingSession | null>(null);
  const retrySessionInFlightRef = useRef<string | null>(null);
  const {
    resetWaveformDisplay,
    startWaveformCapture,
    stopWaveformCapture,
    waveformCanvasRef,
  } = useGlobalDictationWaveform();
  const errorMessages = {
    connection: t("dictation.error.connection"),
    microphoneMissing: t("dictation.error.microphoneMissing"),
    microphonePermissionDenied: t("dictation.error.microphonePermissionDenied"),
    microphoneUnavailable: t("dictation.error.microphoneUnavailable"),
    startError: t("composer.dictation.startError"),
    transcribeError: t("composer.dictation.transcribeError"),
    unsupported: t("dictation.error.unsupported"),
  };

  const showCompactLayout = useEffectEvent((sessionId: string) => {
    void updateGlobalDictationWindowLayout({
      sessionId,
      layout: "compact",
    }).catch(() => undefined);
  });

  const showError = useEffectEvent(
    (sessionId: string, stage: GlobalDictationErrorStage, error: unknown) => {
      const resolution = resolveGlobalDictationError(stage, error, errorMessages);
      setErrorMessage(resolution.message);
      setCanRetry(resolution.canRetry);
      setStatus("error");
      void updateGlobalDictationWindowLayout({
        sessionId,
        layout: "error",
      }).catch(() => undefined);
    },
  );

  const sendCompleted = useEffectEvent((sessionId: string, text: string) => {
    void notifyGlobalDictationCompleted({
      sessionId,
      text,
    }).catch(() => undefined);
  });

  const handleTranscriptionFailure = useEffectEvent((sessionId: string, error: unknown) => {
    showError(sessionId, "transcription", error);
    void notifyGlobalDictationFailed({
      sessionId,
      stage: "transcription",
    }).catch(() => undefined);
  });

  const runTranscription = useEffectEvent(async (sessionId: string, audio: Blob) => {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    const response = await transcribeGlobalDictationAudio({
      audioBytes,
      cleanupEnabled: CLEANUP_ENABLED,
      contentType: audio.type || null,
    });

    if (retryRecordingRef.current?.sessionId === sessionId) {
      retryRecordingRef.current = null;
    }

    sendCompleted(sessionId, response.text);
  });

  const finalizeRecording = useEffectEvent(async (recording: ActiveRecordingSession) => {
    let retrySession: RetryRecordingSession | null = null;

    try {
      try {
        await stopMediaRecorder(recording.recorder);
      } finally {
        recording.stream.getTracks().forEach((track) => track.stop());
        stopWaveformCapture();
        resetWaveformDisplay();
        if (activeRecordingRef.current === recording) {
          activeRecordingRef.current = null;
        }
      }

      if (
        recording.chunks.length === 0 ||
        Date.now() - recording.startedAtMs < MINIMUM_RECORDING_DURATION_MS
      ) {
        retryRecordingRef.current = null;
        sendCompleted(recording.sessionId, "");
        return;
      }

      retrySession = {
        audio: new Blob(recording.chunks, {
          type: recording.recorder.mimeType || "audio/webm",
        }),
        sessionId: recording.sessionId,
      };
      retryRecordingRef.current = retrySession;
      await runTranscription(recording.sessionId, retrySession.audio);
    } catch (error) {
      if (retrySession !== null) {
        retryRecordingRef.current = retrySession;
      }
      handleTranscriptionFailure(recording.sessionId, error);
    }
  });

  const requestStopRecording = useEffectEvent((sessionId: string) => {
    const activeRecording = activeRecordingRef.current;
    if (activeRecording === null || activeRecording.sessionId !== sessionId) {
      pendingStopSessionIdRef.current = sessionId;
      return;
    }

    if (activeRecording.isStopping) {
      return;
    }

    activeRecording.isStopping = true;
    void notifyGlobalDictationRecordingStopped({ sessionId }).catch(() => undefined);
    void finalizeRecording(activeRecording);
  });

  const startRecording = useEffectEvent(async (sessionId: string) => {
    if (
      activeRecordingRef.current?.sessionId === sessionId ||
      pendingStartSessionIdRef.current === sessionId
    ) {
      return;
    }

    retryRecordingRef.current = null;
    if (activeRecordingRef.current !== null) {
      requestStopRecording(activeRecordingRef.current.sessionId);
    }

    let stream: MediaStream | null = null;
    try {
      pendingStartSessionIdRef.current = sessionId;
      await requestMicrophonePermission();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      startWaveformCapture(stream);

      const recorder = new MediaRecorder(stream);
      const activeRecording: ActiveRecordingSession = {
        chunks: [],
        isStopping: false,
        recorder,
        sessionId,
        startedAtMs: Date.now(),
        stream,
      };
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          activeRecording.chunks.push(event.data);
        }
      });
      recorder.start();
      activeRecordingRef.current = activeRecording;

      if (pendingStartSessionIdRef.current === sessionId) {
        pendingStartSessionIdRef.current = null;
      }

      if (pendingStopSessionIdRef.current === sessionId) {
        pendingStopSessionIdRef.current = null;
        requestStopRecording(sessionId);
      }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      stopWaveformCapture();
      resetWaveformDisplay();
      if (pendingStartSessionIdRef.current === sessionId) {
        pendingStartSessionIdRef.current = null;
      }
      if (pendingStopSessionIdRef.current === sessionId) {
        pendingStopSessionIdRef.current = null;
      }
      showError(sessionId, "start", error);
      void notifyGlobalDictationFailed({
        sessionId,
        stage: "recording",
      }).catch(() => undefined);
    }
  });

  const handleStartNotification = useEffectEvent((notification: GlobalDictationSessionParams) => {
    setCurrentSessionId(notification.sessionId);
    setErrorMessage(null);
    setCanRetry(false);
    setStatus("listening");
    showCompactLayout(notification.sessionId);
    void startRecording(notification.sessionId);
  });

  const handleStopNotification = useEffectEvent((notification: GlobalDictationSessionParams) => {
    setStatus("transcribing");
    setErrorMessage(null);
    setCanRetry(false);
    showCompactLayout(notification.sessionId);
    requestStopRecording(notification.sessionId);
  });

  const handleRetry = useEffectEvent(async () => {
    if (currentSessionId === null) {
      return;
    }

    const retryRecording = retryRecordingRef.current;
    if (
      retryRecording === null ||
      retryRecording.sessionId !== currentSessionId ||
      retrySessionInFlightRef.current === currentSessionId
    ) {
      return;
    }

    retrySessionInFlightRef.current = currentSessionId;
    setStatus("transcribing");
    setErrorMessage(null);
    setCanRetry(false);
    showCompactLayout(currentSessionId);
    try {
      await runTranscription(currentSessionId, retryRecording.audio);
    } catch (error) {
      handleTranscriptionFailure(currentSessionId, error);
    } finally {
      if (retrySessionInFlightRef.current === currentSessionId) {
        retrySessionInFlightRef.current = null;
      }
    }
  });

  const handleDismiss = useEffectEvent(() => {
    if (currentSessionId === null) {
      return;
    }

    void dismissGlobalDictation({
      sessionId: currentSessionId,
    }).catch(() => undefined);
    setCurrentSessionId(null);
    setErrorMessage(null);
    setCanRetry(false);
  });

  const handleStopClick = useEffectEvent(() => {
    if (currentSessionId === null || status !== "listening") {
      return;
    }

    setStatus("transcribing");
    setErrorMessage(null);
    setCanRetry(false);
    showCompactLayout(currentSessionId);
    requestStopRecording(currentSessionId);
  });

  useEffect(() => {
    let disposed = false;
    let unlistenStart: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;

    void onGlobalDictationStart(handleStartNotification).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlistenStart = cleanup;
    });

    void onGlobalDictationStop(handleStopNotification).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlistenStop = cleanup;
    });

    return () => {
      disposed = true;
      unlistenStart?.();
      unlistenStop?.();
      activeRecordingRef.current?.stream.getTracks().forEach((track) => track.stop());
      stopWaveformCapture();
    };
  }, []);

  const pillBehaviorClassName =
    status === "listening" ? "no-drag cursor-interaction" : "draggable";
  const pillSizeClassName =
    status === "error" ? "w-fit max-w-[304px] gap-2" : "w-16 justify-center";
  const pillClassName = [
    "flex h-8 items-center rounded-full border border-token-border-default/80 bg-token-bg-primary/95 px-2 shadow-lg shadow-black/20 backdrop-blur-sm forced-colors:bg-[Canvas] forced-colors:backdrop-blur-none [@media(prefers-reduced-transparency:reduce)]:bg-token-bg-primary [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
    pillBehaviorClassName,
    pillSizeClassName,
  ].join(" ");
  const liveStatusText =
    status === "listening"
      ? t("globalDictation.listening")
      : status === "transcribing"
        ? t("globalDictation.transcribing")
        : status === "error"
          ? errorMessage
          : null;

  return (
    <main
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent p-1 text-token-text-primary"
      data-route={GLOBAL_DICTATION_ROUTE_PATH}
    >
      <section
        aria-label={t("globalDictation.waveformAriaLabel")}
        aria-live="polite"
        className={pillClassName}
        onClick={() => void handleStopClick()}
      >
        {status === "transcribing" ? (
          <Spinner className="h-4 w-4 text-token-text-secondary" />
        ) : null}
        {status === "error" ? (
          <>
            <span className="max-w-[252px] min-w-0 truncate text-xs font-medium text-token-error-foreground">
              {errorMessage}
            </span>
            {canRetry ? (
              <button
                type="button"
                aria-label={t("globalDictation.retry")}
                className="no-drag flex size-5 shrink-0 cursor-interaction items-center justify-center rounded-full text-token-text-secondary hover:bg-token-list-hover-background hover:text-token-text-primary focus:outline-none"
                onClick={() => void handleRetry()}
              >
                <RefreshIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={t("globalDictation.dismissError")}
              className="no-drag flex size-5 shrink-0 cursor-interaction items-center justify-center rounded-full text-token-text-secondary hover:bg-token-list-hover-background hover:text-token-text-primary focus:outline-none"
              onClick={() => void handleDismiss()}
            >
              <span aria-hidden="true" className="text-sm leading-none">
                ×
              </span>
            </button>
          </>
        ) : null}
        {status === "starting" || status === "listening" ? (
          <canvas
            ref={waveformCanvasRef}
            aria-hidden="true"
            className="h-4 min-w-0 flex-1 text-token-text-primary"
          />
        ) : null}
        <span className="sr-only">{liveStatusText}</span>
      </section>
    </main>
  );
}

function stopMediaRecorder(recorder: MediaRecorder) {
  if (recorder.state === "inactive") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    recorder.addEventListener(
      "stop",
      () => {
        resolve();
      },
      { once: true },
    );
    recorder.stop();
  });
}
