import { useEffect, useRef, useState } from "react";

const NOISE_FLOOR = 0.0025;
const COMPACT_BAR_COUNT = 4;
const COMPACT_ATTACK = 0.36;
const COMPACT_BAR_BLEND = 0.5;
const COMPACT_BAR_MAX_AMPLITUDE = 0.085;
const COMPACT_BAR_WIDTH_FACTOR = 0.48;
const COMPACT_GAP_FACTOR = 0.28;
const COMPACT_LEVEL_GATE = 0.006;
const COMPACT_LEVEL_MAX = 0.16;
const COMPACT_PHASE_STEP = 0.05;
const COMPACT_RELEASE = 0.1;

export function useGlobalDictationWaveform() {
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recordingStartedAtMsRef = useRef<number | null>(null);
  const barLevelsRef = useRef<number[]>([]);
  const compactSmoothedLevelRef = useRef(0);
  const compactPhaseRef = useRef(0);
  const lastReportedDurationSecsRef = useRef(-1);

  const initializeBars = (canvas: HTMLCanvasElement | null) => {
    if (canvas === null) {
      return false;
    }

    const barCount = Math.max(1, COMPACT_BAR_COUNT);
    barLevelsRef.current = Array.from({ length: barCount }, createNoiseFloorValue);
    return true;
  };

  const drawWaveform = () => {
    const canvas = waveformCanvasRef.current;
    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }

    const { clientHeight, clientWidth } = canvas;
    if (clientHeight === 0 || clientWidth === 0) {
      return;
    }

    if (barLevelsRef.current.length !== COMPACT_BAR_COUNT) {
      initializeBars(canvas);
    }

    const bars = barLevelsRef.current;
    if (bars.length === 0) {
      return;
    }

    const scale = window.devicePixelRatio || 1;
    canvas.width = clientWidth * scale;
    canvas.height = clientHeight * scale;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();

    const centerHeight = canvas.height * 0.5;
    context.translate(0, centerHeight);

    const slotWidth = canvas.width / bars.length;
    const barWidth = slotWidth * COMPACT_BAR_WIDTH_FACTOR;
    const gapWidth = slotWidth * COMPACT_GAP_FACTOR;
    const totalWidth = barWidth * bars.length + gapWidth * (bars.length - 1);
    const startX = (canvas.width - totalWidth) / 2;

    context.fillStyle = getComputedStyle(canvas).color || "#000";
    for (let index = 0; index < bars.length; index += 1) {
      const level = bars[index] ?? NOISE_FLOOR;
      const barHeight = Math.max(1.5 * scale, level * 10 * centerHeight);
      const left = startX + index * (barWidth + gapWidth);
      const radius = Math.min(barWidth * 0.5, barHeight);

      context.globalAlpha = level <= NOISE_FLOOR ? 0.5 : 0.95;
      context.beginPath();
      context.roundRect(left, -barHeight, barWidth, barHeight * 2, radius);
      context.fill();
    }

    context.restore();
  };

  const stopWaveformCapture = () => {
    if (processorRef.current !== null) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaSourceRef.current !== null) {
      mediaSourceRef.current.disconnect();
      mediaSourceRef.current = null;
    }

    if (audioContextRef.current !== null) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    recordingStartedAtMsRef.current = null;
    barLevelsRef.current = [];
    compactSmoothedLevelRef.current = 0;
    compactPhaseRef.current = 0;
    lastReportedDurationSecsRef.current = -1;
    clearCanvas(waveformCanvasRef.current);
  };

  const resetWaveformDisplay = () => {
    barLevelsRef.current = [];
    compactSmoothedLevelRef.current = 0;
    compactPhaseRef.current = 0;
    lastReportedDurationSecsRef.current = -1;
    setRecordingDurationMs(0);
  };

  const startWaveformCapture = (stream: MediaStream) => {
    stopWaveformCapture();
    resetWaveformDisplay();
    initializeBars(waveformCanvasRef.current);
    drawWaveform();

    if (typeof AudioContext === "undefined") {
      return;
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const mediaSource = audioContext.createMediaStreamSource(stream);
    mediaSourceRef.current = mediaSource;

    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;
    recordingStartedAtMsRef.current = performance.now();

    processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      let sumSquares = 0;

      for (let index = 0; index < channelData.length; index += 1) {
        const amplitude = Math.abs(channelData[index] ?? 0);
        sumSquares += amplitude * amplitude;
        channelData[index] = amplitude < NOISE_FLOOR ? NOISE_FLOOR : amplitude;
      }

      if (barLevelsRef.current.length === 0) {
        initializeBars(waveformCanvasRef.current);
      }

      const bars = barLevelsRef.current;
      const rms = Math.sqrt(sumSquares / Math.max(1, channelData.length));
      const adjustedLevel = Math.max(0, rms - COMPACT_LEVEL_GATE);
      const normalizedLevel =
        Math.min(1, adjustedLevel / (COMPACT_LEVEL_MAX - COMPACT_LEVEL_GATE)) ** 0.6 *
        COMPACT_BAR_MAX_AMPLITUDE;
      const previousSmoothedLevel = compactSmoothedLevelRef.current;
      const easing =
        normalizedLevel > previousSmoothedLevel ? COMPACT_ATTACK : COMPACT_RELEASE;
      const smoothedLevel =
        previousSmoothedLevel * (1 - easing) + normalizedLevel * easing;
      compactSmoothedLevelRef.current = smoothedLevel;
      compactPhaseRef.current += COMPACT_PHASE_STEP;

      for (let index = 0; index < bars.length; index += 1) {
        const pulse =
          0.9 + ((Math.sin(compactPhaseRef.current - index * 0.8) + 1) * 0.5) * 0.1;
        const levelScale = measureCompactBarScale(channelData, index, bars.length, rms);
        const nextLevel = Math.min(
          COMPACT_BAR_MAX_AMPLITUDE,
          NOISE_FLOOR + smoothedLevel * pulse * levelScale,
        );
        const previousLevel = bars[index] ?? NOISE_FLOOR;
        bars[index] =
          previousLevel * (1 - COMPACT_BAR_BLEND) + nextLevel * COMPACT_BAR_BLEND;
      }

      drawWaveform();

      if (recordingStartedAtMsRef.current !== null) {
        const elapsedSecs = Math.max(
          0,
          Math.floor((performance.now() - recordingStartedAtMsRef.current) / 1_000),
        );
        if (elapsedSecs !== lastReportedDurationSecsRef.current) {
          lastReportedDurationSecsRef.current = elapsedSecs;
          setRecordingDurationMs(elapsedSecs * 1_000);
        }
      }
    };

    mediaSource.connect(processor);
    processor.connect(audioContext.destination);
  };

  const getCurrentRecordingDurationMs = () => {
    if (recordingStartedAtMsRef.current === null) {
      return recordingDurationMs;
    }

    return Math.max(0, performance.now() - recordingStartedAtMsRef.current);
  };

  useEffect(() => {
    return () => {
      stopWaveformCapture();
    };
  }, []);

  return {
    getCurrentRecordingDurationMs,
    recordingDurationMs,
    waveformCanvasRef,
    startWaveformCapture,
    stopWaveformCapture,
    resetWaveformDisplay,
  };
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas === null) {
    return;
  }

  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}

function createNoiseFloorValue() {
  return NOISE_FLOOR;
}

function measureCompactBarScale(
  channelData: Float32Array,
  barIndex: number,
  barCount: number,
  rms: number,
) {
  const windowSize = Math.max(1, Math.floor(channelData.length / barCount));
  const start = Math.min(
    Math.max(0, channelData.length - windowSize),
    barIndex * windowSize,
  );

  let sumSquares = 0;
  for (let index = start; index < start + windowSize; index += 1) {
    const amplitude = channelData[index] ?? NOISE_FLOOR;
    sumSquares += amplitude * amplitude;
  }

  const barRms = Math.sqrt(sumSquares / windowSize);
  const relativeScale = rms <= NOISE_FLOOR ? 1 : barRms / rms;
  return Math.min(1.14, Math.max(0.86, relativeScale));
}
