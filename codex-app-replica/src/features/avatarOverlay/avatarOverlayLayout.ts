export type AvatarOverlayPlacement =
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

export type AvatarOverlayLayoutRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AvatarOverlayViewport = {
  width: number;
  height: number;
};

export type AvatarOverlayLayout = {
  mascot: AvatarOverlayLayoutRect;
  placement: AvatarOverlayPlacement;
  tray: AvatarOverlayLayoutRect | null;
  viewport: AvatarOverlayViewport;
};

export const DEFAULT_AVATAR_OVERLAY_LAYOUT: AvatarOverlayLayout = {
  mascot: {
    left: 244,
    top: 191,
    width: 112,
    height: 121,
  },
  placement: "top-end",
  tray: {
    left: 80,
    top: 56,
    width: 276,
    height: 131,
  },
  viewport: {
    width: 356,
    height: 320,
  },
};
