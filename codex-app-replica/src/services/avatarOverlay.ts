import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AvatarOverlayLayout } from "../features/avatarOverlay/avatarOverlayLayout";

export type AvatarOverlayOpenStateChangedNotification = {
  isOpen: boolean;
};

export type AvatarOverlayLayoutChangedNotification = {
  layout: AvatarOverlayLayout;
};

type AvatarOverlayInteractionChangedParams = {
  isInteractive: boolean;
};

type AvatarOverlayElementSizeChangedParams = {
  isTrayVisible: boolean;
  mascot: AvatarOverlayMeasuredElementSize;
  tray: AvatarOverlayMeasuredElementSize | null;
};

type AvatarOverlayDragStartParams = {
  pointerWindowX: number;
  pointerWindowY: number;
};

type AvatarOverlayDragReleaseParams = {
  velocityX: number;
  velocityY: number;
};

export type AvatarOverlayMeasuredElementSize = {
  width: number;
  height: number;
};

const AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT = "avatar-overlay-open-state-changed";
const AVATAR_OVERLAY_LAYOUT_CHANGED_EVENT = "avatar-overlay-layout-changed";
const AVATAR_OVERLAY_KEYBOARD_INTERACTION_READY_EVENT =
  "avatar-overlay-keyboard-interaction-ready";

export async function toggleAvatarOverlay() {
  await invoke<void>("avatar-overlay-open");
}

export function onAvatarOverlayOpenStateChanged(
  handler: (notification: AvatarOverlayOpenStateChangedNotification) => void,
) {
  return listen<AvatarOverlayOpenStateChangedNotification>(
    AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export function onAvatarOverlayLayoutChanged(
  handler: (notification: AvatarOverlayLayoutChangedNotification) => void,
) {
  return listen<AvatarOverlayLayoutChangedNotification>(
    AVATAR_OVERLAY_LAYOUT_CHANGED_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
}

export async function readAvatarOverlayOpenState() {
  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let unlistenOverlayState:
      | null
      | (() => void | Promise<void>) = null;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();

      if (unlistenOverlayState) {
        void unlistenOverlayState();
        unlistenOverlayState = null;
      }
    };

    void onAvatarOverlayOpenStateChanged((notification) => {
      settle(() => {
        resolve(notification.isOpen);
      });
    })
      .then((dispose) => {
        unlistenOverlayState = dispose;
        return invoke<void>("avatar-overlay-open-state-request");
      })
      .catch((error) => {
        settle(() => {
          reject(error);
        });
      });
  });
}

export function onAvatarOverlayKeyboardInteractionReady(handler: () => void) {
  return listen(AVATAR_OVERLAY_KEYBOARD_INTERACTION_READY_EVENT, () => {
    handler();
  });
}

export async function reportAvatarOverlayElementSizeChanged(
  params: AvatarOverlayElementSizeChangedParams,
) {
  await invoke<void>("avatar-overlay-element-size-changed", { params });
}

export async function startAvatarOverlayDrag(params: AvatarOverlayDragStartParams) {
  await invoke<void>("avatar-overlay-drag-start", { params });
}

export async function moveAvatarOverlayDrag() {
  await invoke<void>("avatar-overlay-drag-move");
}

export async function endAvatarOverlayDrag() {
  await invoke<void>("avatar-overlay-drag-end");
}

export async function releaseAvatarOverlayDrag(params: AvatarOverlayDragReleaseParams) {
  await invoke<void>("avatar-overlay-drag-release", { params });
}

export async function openCurrentMainWindow() {
  await invoke<void>("open-current-main-window");
}

export async function setAvatarOverlayPointerInteractive(isInteractive: boolean) {
  await invoke<void>("avatar-overlay-pointer-interaction-changed", {
    params: {
      isInteractive,
    } satisfies AvatarOverlayInteractionChangedParams,
  });
}

export async function setAvatarOverlayKeyboardInteractive(isInteractive: boolean) {
  await invoke<void>("avatar-overlay-keyboard-interaction-changed", {
    params: {
      isInteractive,
    } satisfies AvatarOverlayInteractionChangedParams,
  });
}
