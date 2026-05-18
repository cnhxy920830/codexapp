import { useEffect, useState } from "react";
import { HomepageLogo } from "./HomepageLogo";

const HELLO_LOOP_SECONDS = 12;
const HELLO_FRAME_COUNT = 719.994;
const HELLO_CENTER = 250;
const HELLO_SCALE = 5;
const HELLO_OUTER_PATH = [
  "M 9.535 -35.608 C 5.684 -39.457, 0.365 -41.837, -5.509 -41.837 C -15.356 -41.837, -23.64 -35.149, -26.069 -26.068 C -35.15 -23.639, -41.837 -15.355, -41.837 -5.508 C -41.837 0.366, -39.457 5.684, -35.609 9.535 C -36.079 11.293, -36.331 13.141, -36.331 15.047 C -36.331 26.801, -26.803 36.329, -15.049 36.329 C -13.143 36.329, -11.296 36.076, -9.539 35.606 C -5.688 39.456, -0.368 41.837, 5.507 41.837 C 15.355 41.837, 23.638 35.148, 26.066 26.066 C 35.148 23.638, 41.837 15.355, 41.837 5.507 C 41.837 -0.368, 39.456 -5.687, 35.606 -9.538 C 36.076 -11.295, 36.329 -13.142, 36.329 -15.048 C 36.329 -26.802, 26.801 -36.33, 15.047 -36.33 C 13.141 -36.33, 11.293 -36.078, 9.535 -35.608 Z",
  "M -21.09 -21.089 C -20.81 -29.453, -13.941 -36.147, -5.509 -36.147 C 0.069 -36.147, 4.962 -33.217, 7.717 -28.812 C 9.902 -29.978, 12.397 -30.639, 15.046 -30.639 C 23.657 -30.639, 30.637 -23.659, 30.637 -15.048 C 30.637 -12.399, 29.975 -9.904, 28.809 -7.719 C 33.214 -4.964, 36.145 -0.071, 36.145 5.507 C 36.145 13.94, 29.45 20.807, 21.086 21.087 C 20.806 29.451, 13.938 36.146, 5.506 36.146 C -0.072 36.146, -4.966 33.215, -7.721 28.81 C -9.906 29.976, -12.4 30.638, -15.049 30.638 C -23.66 30.638, -30.64 23.658, -30.64 15.047 C -30.64 12.398, -29.979 9.903, -28.813 7.718 C -33.218 4.963, -36.148 0.07, -36.148 -5.508 C -36.148 -13.94, -29.454 -20.808, -21.09 -21.089 Z",
].join(" ");
const HELLO_ARROW_PATH =
  "M 9.794 2.771 C 9.794 2.771, 0.221 -2.771, 0.221 -2.771 C 0.221 -2.771, -9.794 2.771, -9.794 2.771";
const HELLO_LINE_PATH = "M 6.784 0 C 6.784 0, -6.784 0, -6.784 0";
const HELLO_ROTATION_KEYFRAMES = [
  { frame: 0, rotate: 0 },
  { frame: 15, rotate: -2 },
  { frame: 179.999, rotate: -88 },
  { frame: 209.998, rotate: -92 },
  { frame: 349.997, rotate: -178 },
  { frame: 379.997, rotate: -182 },
  { frame: 519.996, rotate: -268 },
  { frame: 549.996, rotate: -272 },
  { frame: 704.995, rotate: -360 },
  { frame: 719.994, rotate: -360.7 },
] as const;
const HELLO_SEGMENTS = [
  { name: "Arrow 5", kind: "arrow", startFrame: 0, endFrame: 80, x: 183.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  {
    name: "Line 5",
    kind: "pulseLine",
    startFrame: 0,
    endFrame: 80,
    x: 296.422,
    y: 299.768,
    rotate: 180,
    scaleX: 5,
    scaleY: 5,
    opacityFrames: [
      { frame: 0, opacity: 1 },
      { frame: 20, opacity: 0 },
      { frame: 40, opacity: 1 },
      { frame: 60, opacity: 0 },
      { frame: 80, opacity: 1 },
      { frame: 99.999, opacity: 0 },
      { frame: 119.999, opacity: 1 },
    ],
  },
  { name: "Arrow 12", kind: "arrow", startFrame: 80, endFrame: 89, x: 307.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: -5 },
  { name: "Line 10", kind: "line", startFrame: 80, endFrame: 89, x: 200.422, y: 235.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 11", kind: "line", startFrame: 80, endFrame: 89, x: 200.422, y: 275.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 6", kind: "arrow", startFrame: 89, endFrame: 97, x: 307.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: 5 },
  { name: "Line 6", kind: "line", startFrame: 89, endFrame: 97, x: 184.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 7", kind: "arrow", startFrame: 97, endFrame: 103, x: 207.52, y: 250.557, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 7", kind: "line", startFrame: 97, endFrame: 103, x: 336.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 8", kind: "arrow", startFrame: 103, endFrame: 109, x: 303.52, y: 234.557, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 8", kind: "line", startFrame: 103, endFrame: 109, x: 192.422, y: 291.768, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Arrow 11", kind: "arrow", startFrame: 109, endFrame: 115, x: 303.52, y: 246.557, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 9", kind: "line", startFrame: 109, endFrame: 115, x: 172.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 12", kind: "line", startFrame: 115, endFrame: 121, x: 200.422, y: 251.768, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 13", kind: "line", startFrame: 115, endFrame: 121, x: 200.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 14", kind: "line", startFrame: 115, endFrame: 121, x: 324.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 37", kind: "arrow", startFrame: 121, endFrame: 251, x: 183.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  {
    name: "Line 47",
    kind: "pulseLine",
    startFrame: 121,
    endFrame: 251,
    x: 296.422,
    y: 299.768,
    rotate: 180,
    scaleX: 5,
    scaleY: 5,
    opacityFrames: [
      { frame: 121, opacity: 1 },
      { frame: 141, opacity: 0 },
      { frame: 161, opacity: 1 },
      { frame: 180.999, opacity: 0 },
      { frame: 200.999, opacity: 1 },
      { frame: 220.999, opacity: 0 },
      { frame: 240.999, opacity: 1 },
    ],
  },
  { name: "Arrow 16", kind: "arrow", startFrame: 251, endFrame: 260, x: 199.52, y: 226.557, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 18", kind: "line", startFrame: 251, endFrame: 260, x: 316.422, y: 283.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 15", kind: "arrow", startFrame: 260, endFrame: 268, x: 307.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: 5 },
  { name: "Line 17", kind: "line", startFrame: 260, endFrame: 268, x: 184.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 23", kind: "line", startFrame: 268, endFrame: 274, x: 326.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 24", kind: "line", startFrame: 268, endFrame: 274, x: 184.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 14", kind: "arrow", startFrame: 274, endFrame: 280, x: 207.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: -5 },
  { name: "Line 15", kind: "line", startFrame: 274, endFrame: 280, x: 312.422, y: 235.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 16", kind: "line", startFrame: 274, endFrame: 280, x: 312.422, y: 275.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 19", kind: "arrow", startFrame: 280, endFrame: 286, x: 323.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 20", kind: "arrow", startFrame: 280, endFrame: 286, x: 179.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: -5 },
  { name: "Line 25", kind: "line", startFrame: 280, endFrame: 286, x: 252.422, y: 249.768, rotate: -65, scaleX: 5, scaleY: 5 },
  { name: "Arrow 18", kind: "arrow", startFrame: 286, endFrame: 292, x: 303.52, y: 246.557, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 20", kind: "line", startFrame: 286, endFrame: 292, x: 172.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 38", kind: "arrow", startFrame: 292, endFrame: 420, x: 183.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  {
    name: "Line 48",
    kind: "pulseLine",
    startFrame: 292,
    endFrame: 420,
    x: 296.422,
    y: 299.768,
    rotate: 180,
    scaleX: 5,
    scaleY: 5,
    opacityFrames: [
      { frame: 292, opacity: 1 },
      { frame: 312, opacity: 0 },
      { frame: 332, opacity: 1 },
      { frame: 351.999, opacity: 0 },
      { frame: 371.999, opacity: 1 },
      { frame: 391.999, opacity: 0 },
      { frame: 411.999, opacity: 1 },
    ],
  },
  { name: "Line 26", kind: "line", startFrame: 420, endFrame: 429, x: 172.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 27", kind: "line", startFrame: 420, endFrame: 429, x: 296.422, y: 299.768, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 28", kind: "line", startFrame: 420, endFrame: 429, x: 296.422, y: 251.768, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Arrow 22", kind: "arrow", startFrame: 429, endFrame: 437, x: 191.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 30", kind: "line", startFrame: 429, endFrame: 437, x: 326.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 33", kind: "line", startFrame: 437, endFrame: 443, x: 252.422, y: 235.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 34", kind: "line", startFrame: 437, endFrame: 443, x: 252.422, y: 275.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 28", kind: "arrow", startFrame: 443, endFrame: 449, x: 191.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 29", kind: "arrow", startFrame: 443, endFrame: 449, x: 315.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: -5 },
  { name: "Arrow 24", kind: "arrow", startFrame: 449, endFrame: 455, x: 323.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 25", kind: "arrow", startFrame: 449, endFrame: 455, x: 179.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: -5 },
  { name: "Line 35", kind: "line", startFrame: 449, endFrame: 455, x: 252.422, y: 249.768, rotate: -65, scaleX: 5, scaleY: 5 },
  { name: "Arrow 26", kind: "arrow", startFrame: 455, endFrame: 461, x: 303.52, y: 234.557, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 36", kind: "line", startFrame: 455, endFrame: 461, x: 192.422, y: 291.768, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Arrow 39", kind: "arrow", startFrame: 461, endFrame: 591, x: 183.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  {
    name: "Line 49",
    kind: "pulseLine",
    startFrame: 461,
    endFrame: 591,
    x: 296.422,
    y: 299.768,
    rotate: 180,
    scaleX: 5,
    scaleY: 5,
    opacityFrames: [
      { frame: 461, opacity: 1 },
      { frame: 481, opacity: 0 },
      { frame: 501, opacity: 1 },
      { frame: 520.999, opacity: 0 },
      { frame: 540.999, opacity: 1 },
      { frame: 560.999, opacity: 0 },
      { frame: 580.999, opacity: 1 },
    ],
  },
  { name: "Arrow 30", kind: "arrow", startFrame: 591, endFrame: 600, x: 199.52, y: 226.557, rotate: 0, scaleX: 5, scaleY: 5 },
  { name: "Line 38", kind: "line", startFrame: 591, endFrame: 600, x: 316.422, y: 283.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 31", kind: "arrow", startFrame: 600, endFrame: 608, x: 307.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: 5 },
  { name: "Line 39", kind: "line", startFrame: 600, endFrame: 608, x: 184.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 40", kind: "line", startFrame: 608, endFrame: 614, x: 326.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Line 41", kind: "line", startFrame: 608, endFrame: 614, x: 184.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 32", kind: "arrow", startFrame: 614, endFrame: 620, x: 207.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: -5 },
  { name: "Line 42", kind: "line", startFrame: 614, endFrame: 620, x: 312.422, y: 235.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Line 43", kind: "line", startFrame: 614, endFrame: 620, x: 312.422, y: 275.768, rotate: 180, scaleX: 5, scaleY: 5 },
  { name: "Arrow 33", kind: "arrow", startFrame: 620, endFrame: 626, x: 323.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 34", kind: "arrow", startFrame: 620, endFrame: 626, x: 179.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: -5 },
  { name: "Arrow 40", kind: "arrow", startFrame: 626, endFrame: 632, x: 311.52, y: 250.557, rotate: -90, scaleX: 5, scaleY: 5 },
  { name: "Line 50", kind: "line", startFrame: 626, endFrame: 632, x: 172.422, y: 251.768, rotate: 90, scaleX: 5, scaleY: 5 },
  { name: "Arrow 36", kind: "arrow", startFrame: 632, endFrame: 719.994, x: 183.52, y: 250.557, rotate: 90, scaleX: 5, scaleY: 5 },
  {
    name: "Line 46",
    kind: "pulseLine",
    startFrame: 632,
    endFrame: 719.994,
    x: 296.422,
    y: 299.768,
    rotate: 180,
    scaleX: 5,
    scaleY: 5,
    opacityFrames: [
      { frame: 600, opacity: 1 },
      { frame: 620, opacity: 0 },
      { frame: 640, opacity: 1 },
      { frame: 660, opacity: 0 },
      { frame: 680, opacity: 1 },
      { frame: 699.999, opacity: 0 },
      { frame: 719.999, opacity: 1 },
    ],
  },
] as const;

export function HelloLogo({ className }: { className?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div aria-hidden="true" className={joinClasses("inline-block shrink-0", className)}>
      {prefersReducedMotion ? (
        <HomepageLogo aria-hidden="true" className="block size-full" />
      ) : (
        <svg aria-hidden="true" className="block size-full" viewBox="0 0 500 500">
          <g>
            <animateTransform
              attributeName="transform"
              calcMode="linear"
              dur={`${HELLO_LOOP_SECONDS}s`}
              keyTimes={HELLO_ROTATION_KEYFRAMES.map(({ frame }) => formatKeyTime(frame)).join(";")}
              repeatCount="indefinite"
              type="rotate"
              values={HELLO_ROTATION_KEYFRAMES.map(({ rotate }) => `${rotate} ${HELLO_CENTER} ${HELLO_CENTER}`).join(";")}
            />
            <path
              d={HELLO_OUTER_PATH}
              fill="currentColor"
              fillRule="evenodd"
              transform={`translate(${HELLO_CENTER} ${HELLO_CENTER}) scale(${HELLO_SCALE})`}
            />
          </g>
          {HELLO_SEGMENTS.map((segment) => {
            const animation = buildOpacityAnimation(segment);
            return (
              <g
                key={segment.name}
                opacity={animation.initialOpacity}
                transform={`translate(${segment.x} ${segment.y}) rotate(${segment.rotate}) scale(${segment.scaleX} ${segment.scaleY})`}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  dur={`${HELLO_LOOP_SECONDS}s`}
                  keyTimes={animation.keyTimes}
                  repeatCount="indefinite"
                  values={animation.values}
                />
                <path
                  d={segment.kind === "arrow" ? HELLO_ARROW_PATH : HELLO_LINE_PATH}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="5.54"
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

type Segment = (typeof HELLO_SEGMENTS)[number];

function buildOpacityAnimation(segment: Segment) {
  if (segment.kind === "pulseLine") {
    const opacityFrames = segment.opacityFrames ?? [];
    let activeOpacity = 0;
    for (const frame of opacityFrames) {
      if (frame.frame > segment.startFrame) {
        break;
      }
      activeOpacity = frame.opacity;
    }

    const timeline: Array<{ frame: number; opacity: number }> = [];
    if (segment.startFrame > 0) {
      timeline.push({ frame: 0, opacity: 0 });
    }
    timeline.push({ frame: segment.startFrame, opacity: activeOpacity });

    for (const frame of opacityFrames) {
      if (frame.frame > segment.startFrame && frame.frame < segment.endFrame) {
        timeline.push(frame);
      }
    }

    if (segment.endFrame < HELLO_FRAME_COUNT) {
      timeline.push({ frame: segment.endFrame, opacity: 0 });
    }

    return {
      initialOpacity: String(timeline[0]?.opacity ?? 0),
      keyTimes: timeline.map(({ frame }) => formatKeyTime(frame)).join(";"),
      values: timeline.map(({ opacity }) => String(opacity)).join(";"),
    };
  }

  if (segment.startFrame === 0) {
    return {
      initialOpacity: "1",
      keyTimes: `0;${formatKeyTime(segment.endFrame)}`,
      values: "1;0",
    };
  }

  if (segment.endFrame >= HELLO_FRAME_COUNT) {
    return {
      initialOpacity: "0",
      keyTimes: `0;${formatKeyTime(segment.startFrame)}`,
      values: "0;1",
    };
  }

  return {
    initialOpacity: "0",
    keyTimes: `0;${formatKeyTime(segment.startFrame)};${formatKeyTime(segment.endFrame)}`,
    values: "0;1;0",
  };
}

function formatKeyTime(frame: number) {
  return (frame / HELLO_FRAME_COUNT).toFixed(6);
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

function readPrefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
}
