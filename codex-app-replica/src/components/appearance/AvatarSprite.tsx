import { useEffect, useRef, useState } from "react";
import type { AvatarOption } from "./avatarData";

const IDLE_FRAMES = [
  { rowIndex: 0, columnIndex: 0, frameDurationMs: 280 },
  { rowIndex: 0, columnIndex: 1, frameDurationMs: 110 },
  { rowIndex: 0, columnIndex: 2, frameDurationMs: 110 },
  { rowIndex: 0, columnIndex: 3, frameDurationMs: 140 },
  { rowIndex: 0, columnIndex: 4, frameDurationMs: 140 },
  { rowIndex: 0, columnIndex: 5, frameDurationMs: 320 },
].map((frame) => ({ ...frame, frameDurationMs: frame.frameDurationMs * 6 }));

export function AvatarSprite({
  avatar,
  size = "sm",
}: {
  avatar: AvatarOption;
  size?: "sm" | "md";
}) {
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const avatarElement = avatarRef.current;
    if (!avatarElement) {
      return;
    }

    let timeoutId: number | null = null;
    let frameIndex = 0;
    let cancelled = false;

    const applyFrame = () => {
      const frame = IDLE_FRAMES[frameIndex];
      avatarElement.style.backgroundPosition = `${(frame.columnIndex / 7) * 100}% ${(frame.rowIndex / 8) * 100}%`;

      if (cancelled || prefersReducedMotion || IDLE_FRAMES.length === 1) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        frameIndex = (frameIndex + 1) % IDLE_FRAMES.length;
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
  }, [prefersReducedMotion, avatar.assetRef, avatar.spritesheetUrl]);

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
        className={["codex-avatar-root", size === "sm" ? "scale-[0.42]" : "scale-75"].join(" ")}
        style={{ backgroundImage: `url(${avatar.spritesheetUrl})` }}
        aria-hidden="true"
      />
    </div>
  );
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
