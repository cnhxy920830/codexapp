import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type AvatarOverlayOpenStateChangedNotification = {
  isOpen: boolean;
};

const AVATAR_OVERLAY_OPEN_STATE_CHANGED_EVENT = "avatar-overlay-open-state-changed";

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
