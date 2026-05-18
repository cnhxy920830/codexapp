import { useEffect, useRef, useState } from "react";
import type { AvatarOption } from "./avatarData";

const SHEET_COLUMN_COUNT = 8;
const SHEET_ROW_COUNT = 9;
const IDLE_FRAME_MULTIPLIER = 6;

type AvatarSpriteFrame = {
  rowIndex: number;
  columnIndex: number;
  frameDurationMs: number;
};

export type AvatarSpriteState =
  | "idle"
  | "jumping"
  | "waiting"
  | "failed"
  | "review"
  | "running"
  | "running-left"
  | "running-right";

const IDLE_FRAMES: AvatarSpriteFrame[] = [
  { rowIndex: 0, columnIndex: 0, frameDurationMs: 280 },
  { rowIndex: 0, columnIndex: 1, frameDurationMs: 110 },
  { rowIndex: 0, columnIndex: 2, frameDurationMs: 110 },
  { rowIndex: 0, columnIndex: 3, frameDurationMs: 140 },
  { rowIndex: 0, columnIndex: 4, frameDurationMs: 140 },
  { rowIndex: 0, columnIndex: 5, frameDurationMs: 320 },
];

const SCALED_IDLE_FRAMES = IDLE_FRAMES.map((frame) => ({
  ...frame,
  frameDurationMs: frame.frameDurationMs * IDLE_FRAME_MULTIPLIER,
}));

const AVATAR_STATE_FRAMES: Record<AvatarSpriteState, AvatarSpriteFrame[]> = {
  failed: buildRowFrames(5, 8, 140, 240),
  idle: IDLE_FRAMES,
  jumping: buildRowFrames(4, 5, 140, 280),
  review: buildRowFrames(8, 6, 150, 280),
  running: buildRowFrames(7, 6, 120, 220),
  "running-left": buildRowFrames(2, 8, 120, 220),
  "running-right": buildRowFrames(1, 8, 120, 220),
  waiting: buildRowFrames(6, 6, 150, 260),
};

export function AvatarSprite({
  avatar,
  className,
  size = "sm",
  state = "idle",
}: {
  avatar: AvatarOption;
  className?: string;
  size?: "sm" | "md";
  state?: AvatarSpriteState;
}) {
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const avatarElement = avatarRef.current;
    if (!avatarElement) {
      return;
    }

    const { frames, loopStartIndex } = getAnimationPlan(state, prefersReducedMotion);
    let timeoutId: number | null = null;
    let cancelled = false;
    let frameIndex = 0;

    const applyFrame = () => {
      const frame = frames[frameIndex];
      avatarElement.style.backgroundPosition = backgroundPositionForFrame(frame);

      if (cancelled || frames.length <= 1) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        const nextFrameIndex = frameIndex + 1;
        if (nextFrameIndex >= frames.length) {
          if (loopStartIndex == null) {
            timeoutId = null;
            return;
          }
          frameIndex = loopStartIndex;
          applyFrame();
          return;
        }

        frameIndex = nextFrameIndex;
        applyFrame();
      }, frame.frameDurationMs);
    };

    applyFrame();

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [avatar.assetRef, avatar.spritesheetUrl, prefersReducedMotion, state]);

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-token-border bg-token-bg-secondary",
        size === "sm" ? "size-8" : "size-16",
      ].join(" ")}
    >
      <div
        ref={avatarRef}
        data-avatar-id={avatar.id}
        data-avatar-state={state}
        className={[
          "codex-avatar-root",
          size === "sm" ? "scale-[0.42]" : "scale-75",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ backgroundImage: `url(${avatar.spritesheetUrl})` }}
        aria-hidden="true"
      />
    </div>
  );
}

function getAnimationPlan(state: AvatarSpriteState, prefersReducedMotion: boolean) {
  const frames = AVATAR_STATE_FRAMES[state];
  if (prefersReducedMotion) {
    return {
      frames: [frames[0]],
      loopStartIndex: null as number | null,
    };
  }

  if (state === "idle") {
    return {
      frames: SCALED_IDLE_FRAMES,
      loopStartIndex: 0,
    };
  }

  const repeatedFrames = [...frames, ...frames, ...frames];
  return {
    frames: [...repeatedFrames, ...SCALED_IDLE_FRAMES],
    loopStartIndex: repeatedFrames.length,
  };
}

function buildRowFrames(
  rowIndex: number,
  frameCount: number,
  frameDurationMs: number,
  lastFrameDurationMs: number,
) {
  return Array.from({ length: frameCount }, (_, columnIndex) => ({
    rowIndex,
    columnIndex,
    frameDurationMs: columnIndex === frameCount - 1 ? lastFrameDurationMs : frameDurationMs,
  }));
}

function backgroundPositionForFrame(frame: AvatarSpriteFrame) {
  return `${(frame.columnIndex / (SHEET_COLUMN_COUNT - 1)) * 100}% ${(frame.rowIndex / (SHEET_ROW_COUNT - 1)) * 100}%`;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => {
        mediaQuery.removeEventListener("change", update);
      };
    }

    mediaQuery.addListener(update);
    return () => {
      mediaQuery.removeListener(update);
    };
  }, []);

  return prefersReducedMotion;
}
