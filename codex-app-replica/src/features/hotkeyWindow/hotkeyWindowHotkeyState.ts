import { useEffect, useState } from "react";
import {
  HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY,
  type HotkeyWindowHotkeyStateResponse,
} from "../../services/settings";
import {
  onSharedObjectUpdated,
  readSharedObjectSnapshot,
} from "../../services/settingsHosts";

export const DEFAULT_HOTKEY_WINDOW_HOTKEY_STATE: HotkeyWindowHotkeyStateResponse = {
  supported: false,
  configuredHotkey: null,
  isGateEnabled: false,
  isDevMode: false,
  isDevOverrideEnabled: false,
  isActive: false,
};

export type HotkeyWindowHotkeyStateValue =
  | HotkeyWindowHotkeyStateResponse
  | null;

export async function readHotkeyWindowHotkeyStateSnapshot() {
  return readSharedObjectSnapshot(
    HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY,
    normalizeHotkeyWindowHotkeyState,
  );
}

export function subscribeHotkeyWindowHotkeyState(
  handler: (state: HotkeyWindowHotkeyStateResponse) => void,
) {
  return onSharedObjectUpdated((notification) => {
    if (notification.key !== HOTKEY_WINDOW_HOTKEY_STATE_SHARED_OBJECT_KEY) {
      return;
    }

    handler(normalizeHotkeyWindowHotkeyState(notification.value));
  });
}

export function useHotkeyWindowHotkeyState() {
  const [hotkeyState, setHotkeyState] = useState<HotkeyWindowHotkeyStateValue>(null);

  useEffect(() => {
    let cancelled = false;

    void readHotkeyWindowHotkeyStateSnapshot()
      .then((state) => {
        if (!cancelled) {
          setHotkeyState(state);
        }
      })
      .catch(() => undefined);

    const unsubscribe = subscribeHotkeyWindowHotkeyState((state) => {
      if (!cancelled) {
        setHotkeyState(state);
      }
    });

    return () => {
      cancelled = true;
      void unsubscribe.then((dispose) => dispose());
    };
  }, []);

  return hotkeyState;
}

function normalizeHotkeyWindowHotkeyState(value: unknown): HotkeyWindowHotkeyStateResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_HOTKEY_WINDOW_HOTKEY_STATE;
  }

  const record = value as Record<string, unknown>;
  return {
    supported: record.supported === true,
    configuredHotkey:
      typeof record.configuredHotkey === "string" ? record.configuredHotkey : null,
    isGateEnabled: record.isGateEnabled === true,
    isDevMode: record.isDevMode === true,
    isDevOverrideEnabled: record.isDevOverrideEnabled === true,
    isActive: record.isActive === true,
  };
}
