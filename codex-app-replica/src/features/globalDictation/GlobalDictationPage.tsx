import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../statsig/replicaStatsig";
import {
  GlobalDictationPageView,
  type GlobalDictationStatus,
} from "./GlobalDictationPageView";
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

const MINIMUM_RECORDING_DURATION_MS = 250;

type ActiveRecordingSession = {
  cleanupEnabled: boolean;
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
  const cleanupEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.globalDictationCleanup,
  );
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

  const runTranscription = useEffectEvent(async ({
    audio,
    cleanupEnabled,
    sessionId,
  }: {
    audio: Blob;
    cleanupEnabled: boolean;
    sessionId: string;
  }) => {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    const response = await transcribeGlobalDictationAudio({
      audioBytes,
      cleanupEnabled,
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
        audio: new Blob(recording.chunks),
        sessionId: recording.sessionId,
      };
      retryRecordingRef.current = retrySession;
      await runTranscription({
        audio: retrySession.audio,
        cleanupEnabled: recording.cleanupEnabled,
        sessionId: recording.sessionId,
      });
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
      void requestMicrophonePermission().catch(() => undefined);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      startWaveformCapture(stream);

      const recorder = new MediaRecorder(stream);
      const activeRecording: ActiveRecordingSession = {
        cleanupEnabled,
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
      void notifyGlobalDictationFailed({
        sessionId,
        stage: "recording",
      }).catch(() => undefined);
      showError(sessionId, "start", error);
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
      await runTranscription({
        audio: retryRecording.audio,
        cleanupEnabled,
        sessionId: currentSessionId,
      });
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

  const liveStatusText =
    status === "starting" || status === "listening"
      ? t("globalDictation.listening")
      : status === "transcribing"
        ? t("globalDictation.transcribing")
        : status === "error"
          ? errorMessage
          : null;

  return (
    <GlobalDictationPageView
      canRetry={canRetry}
      errorMessage={errorMessage}
      liveStatusText={liveStatusText}
      onDismiss={() => void handleDismiss()}
      onRetry={() => void handleRetry()}
      onStop={() => void handleStopClick()}
      retryAriaLabel={t("globalDictation.retry")}
      dismissAriaLabel={t("globalDictation.dismissError")}
      status={status}
      waveformAriaLabel={t("globalDictation.waveformAriaLabel")}
      waveformCanvasRef={waveformCanvasRef}
    />
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
