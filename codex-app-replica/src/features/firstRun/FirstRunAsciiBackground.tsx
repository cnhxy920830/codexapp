import { useEffect, useMemo, useRef, useState } from "react";

const ASCII_CHARS = "@%#*+=-:. ";
const BASE_FONT_FAMILY = "monospace";
const BASE_FONT_SIZE = 12;
const FRAME_RATE = 20;
const PHASE_STEP = 0.03;

type AsciiMode = "noise" | "composite";

type AsciiEngineOptions = {
  initialColumns?: number;
  initialMode?: AsciiMode;
  initialRows?: number;
};

type AsciiEngineProps = {
  autoCover?: boolean;
  backgroundColor?: string;
  columns: number;
  foregroundColor?: string;
  lines: string[];
  rows: number;
  scale?: number;
};

const FIRST_RUN_MASK_STYLE = {
  WebkitMaskImage:
    "radial-gradient(ellipse at center, rgba(0,0,0,1) 25%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 50%)",
  maskImage:
    "radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 78%)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  opacity: 0.15,
} as const;

export function FirstRunAsciiBackground() {
  const { columns, lines, rows } = useAsciiEngine({
    initialColumns: 130,
    initialMode: "composite",
    initialRows: 100,
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -ml-6" style={FIRST_RUN_MASK_STYLE}>
      <AsciiEngine
        autoCover
        backgroundColor="var(--color-token-side-bar-background, var(--app-shell-sidebar))"
        columns={columns}
        foregroundColor="var(--color-token-checkbox-border, var(--app-shell-control-border))"
        lines={lines}
        rows={rows}
        scale={0.95}
      />
    </div>
  );
}

function AsciiEngine({
  autoCover = false,
  backgroundColor = "var(--color-token-side-bar-background, var(--app-shell-sidebar))",
  columns,
  foregroundColor = "var(--color-token-checkbox-border, var(--app-shell-control-border))",
  lines,
  rows,
  scale = 0.75,
}: AsciiEngineProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fontSizeRef = useRef(BASE_FONT_SIZE);
  const fontFamilyRef = useRef(BASE_FONT_FAMILY);
  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const resolveColor = useMemo(() => {
    return (value: string, property: "color" | "backgroundColor") => {
      const resolved = value.trim();
      if (!resolved.startsWith("var(")) {
        return resolved;
      }

      try {
        const probe = document.createElement("div");
        probe.style.display = "none";
        probe.style[property] = resolved;
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe)[property];
        probe.remove();
        return computed || resolved;
      } catch {
        return resolved;
      }
    };
  }, []);

  const drawFrame = useMemo(() => {
    return () => {
      const host = hostRef.current;
      const frame = frameRef.current;
      let canvas = canvasRef.current;
      if (!host || !frame) {
        return;
      }

      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.imageRendering = "crisp-edges";
        canvas.style.borderRadius = autoCover ? "0px" : "10px";
        host.appendChild(canvas);
        canvasRef.current = canvas;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const fontSize = fontSizeRef.current;
      const fontFamily = fontFamilyRef.current;
      context.font = `${fontSize}px ${fontFamily}`;
      const metrics = context.measureText("M");
      const charWidth = Math.max(1, Math.round(metrics.width));
      const charHeight = Math.max(
        1,
        Math.round((metrics.actualBoundingBoxAscent || fontSize) + (metrics.actualBoundingBoxDescent || Math.ceil(fontSize * 0.3))),
      );

      const contentWidth = Math.max(1, columns * charWidth);
      const contentHeight = Math.max(1, rows * charHeight);
      const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
      let renderScale = Math.max(0.001, scale);

      if (autoCover) {
        try {
          const parent = frame.parentElement?.getBoundingClientRect();
          if (parent && contentWidth > 0 && contentHeight > 0) {
            const widthScale = parent.width / contentWidth;
            const heightScale = parent.height / contentHeight;
            renderScale = Math.max(widthScale, heightScale);
            if (!Number.isFinite(renderScale) || renderScale <= 0) {
              renderScale = 1;
            } else {
              renderScale *= 1.02;
            }
          }
        } catch {
          renderScale = 1;
        }
      }

      const width = Math.max(1, Math.round(contentWidth * renderScale));
      const height = Math.max(1, Math.round(contentHeight * renderScale));
      const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
      const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      canvas.style.borderRadius = autoCover ? "0px" : "10px";

      context.setTransform(devicePixelRatio * renderScale, 0, 0, devicePixelRatio * renderScale, 0, 0);
      context.imageSmoothingEnabled = false;
      context.save();

      const resolvedBackground = resolveColor(backgroundColor, "backgroundColor");
      const resolvedForeground = resolveColor(foregroundColor, "color");
      if (resolvedBackground) {
        context.fillStyle = resolvedBackground;
        context.fillRect(0, 0, width, height);
      }
      if (resolvedForeground) {
        context.fillStyle = resolvedForeground;
      }
      context.textBaseline = "top";
      context.font = `${fontSize}px ${fontFamily}`;

      const lineHeight = charHeight;
      const visibleRows = Math.min(rows, linesRef.current.length);
      for (let index = 0; index < visibleRows; index += 1) {
        context.fillText(linesRef.current[index] ?? "", 0, index * lineHeight);
      }

      context.restore();

      if (autoCover) {
        frame.style.position = "absolute";
        frame.style.left = "50%";
        frame.style.top = "50%";
        frame.style.transform = "translate(-50%, -50%)";
        frame.style.transformOrigin = "center";
        frame.style.display = "block";
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
      } else {
        frame.style.position = "static";
        frame.style.left = "auto";
        frame.style.top = "auto";
        frame.style.transform = `scale(${renderScale})`;
        frame.style.transformOrigin = "center";
        frame.style.display = "inline-block";
      }
    };
  }, [autoCover, backgroundColor, columns, foregroundColor, resolveColor, rows, scale]);

  useEffect(() => {
    let cancelled = false;
    let frameHandle = 0;
    let lastFrameAt = 0;
    const intervalMs = 1000 / FRAME_RATE;

    const animate = (now: number) => {
      if (cancelled) {
        return;
      }

      if (!document.hidden && now - lastFrameAt >= intervalMs - 1) {
        drawFrame();
        lastFrameAt = now;
      }

      frameHandle = window.requestAnimationFrame(animate);
    };

    const start = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // ignore font readiness failures
      }

      if (cancelled) {
        return;
      }

      drawFrame();
      frameHandle = window.requestAnimationFrame(animate);
    };

    void start();

    const handleResize = () => {
      if (!document.hidden) {
        window.requestAnimationFrame(drawFrame);
      }
    };

    document.addEventListener("visibilitychange", handleResize);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameHandle);
      document.removeEventListener("visibilitychange", handleResize);
      window.removeEventListener("resize", handleResize);
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, [drawFrame]);

  return (
    <div
      ref={frameRef}
      style={
        autoCover
          ? { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "block" }
          : { transform: `scale(${scale})`, transformOrigin: "center", display: "inline-block" }
      }
    >
      <div ref={hostRef} style={{ display: "inline-block", lineHeight: 1, borderRadius: autoCover ? 0 : 10 }} />
    </div>
  );
}

function useAsciiEngine({ initialColumns = 50, initialMode = "noise", initialRows = 30 }: AsciiEngineOptions) {
  const [columns] = useState(initialColumns);
  const [rows] = useState(initialRows);
  const modeRef = useRef<AsciiMode>(initialMode);
  const phaseRef = useRef(0);
  const noise = useMemo(() => createNoise3D(Date.now()), []);

  const buildFrame = useMemo(() => {
    return (phase: number) => {
      const frameLines: string[] = [];
      for (let row = 0; row < rows; row += 1) {
        let line = "";
        for (let column = 0; column < columns; column += 1) {
          const x = column * 0.08;
          const y = row * 0.08;
          const value = sampleNoise(noise, x, y, phase, modeRef.current);
          const charIndex = Math.max(0, Math.min(ASCII_CHARS.length - 1, Math.round((1 - value) * (ASCII_CHARS.length - 1))));
          line += ASCII_CHARS[charIndex] ?? " ";
        }

        frameLines.push(line);
      }

      if (frameLines.length === 0 || frameLines.every((line) => !line.trim())) {
        return Array.from({ length: rows }, () => "@".repeat(columns));
      }

      return frameLines;
    };
  }, [columns, noise, rows]);

  const [lines, setLines] = useState<string[]>(() => buildFrame(0));

  useEffect(() => {
    let cancelled = false;
    let frameHandle = 0;
    let lastFrameAt = 0;
    const intervalMs = 1000 / FRAME_RATE;

    const animate = (now: number) => {
      if (cancelled) {
        return;
      }

      if (!document.hidden && now - lastFrameAt >= intervalMs - 1) {
        setLines(buildFrame(phaseRef.current));
        phaseRef.current += PHASE_STEP;
        lastFrameAt = now;
      }

      frameHandle = window.requestAnimationFrame(animate);
    };

    const start = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // ignore font readiness failures
      }

      if (cancelled) {
        return;
      }

      frameHandle = window.requestAnimationFrame(animate);
    };

    void start();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastFrameAt = 0;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameHandle);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleVisibilityChange);
    };
  }, [buildFrame]);

  return { columns, lines, rows };
}

function sampleNoise(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  phase: number,
  mode: AsciiMode,
) {
  const base = noise(x, y, phase);
  if (mode === "noise") {
    return base;
  }

  const detail = noise(x * 1.9 + 17.2, y * 1.9 - 11.8, phase * 1.8);
  const ridge = 1 - Math.abs(noise(x * 0.7 - 9.1, y * 0.7 + 4.6, phase * 2.2) * 2 - 1);
  return clamp01(base * 0.62 + detail * 0.26 + ridge * 0.12);
}

function createNoise3D(seed: number) {
  return (x: number, y: number, z: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const z1 = z0 + 1;
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const fz = fade(z - z0);

    const c000 = hash3(seed, x0, y0, z0);
    const c100 = hash3(seed, x1, y0, z0);
    const c010 = hash3(seed, x0, y1, z0);
    const c110 = hash3(seed, x1, y1, z0);
    const c001 = hash3(seed, x0, y0, z1);
    const c101 = hash3(seed, x1, y0, z1);
    const c011 = hash3(seed, x0, y1, z1);
    const c111 = hash3(seed, x1, y1, z1);

    const x00 = lerp(c000, c100, fx);
    const x10 = lerp(c010, c110, fx);
    const x01 = lerp(c001, c101, fx);
    const x11 = lerp(c011, c111, fx);
    const y0v = lerp(x00, x10, fy);
    const y1v = lerp(x01, x11, fy);
    return lerp(y0v, y1v, fz);
  };
}

function hash3(seed: number, x: number, y: number, z: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 0.0001) * 43758.5453123;
  return value - Math.floor(value);
}

function fade(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, alpha: number) {
  return start + (end - start) * alpha;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
