import { invoke } from "@tauri-apps/api/core";
import type { CustomAvatarRecord } from "../components/appearance/avatarData";

export type CustomAvatarsResponse = {
  avatarDirectory: string;
  avatars: CustomAvatarRecord[];
};

export type CustomAvatarsSnapshot = {
  avatarDirectory: string | null;
  avatars: CustomAvatarRecord[];
  hasLoaded: boolean;
  isError: boolean;
  isLoading: boolean;
};

const INITIAL_SNAPSHOT: CustomAvatarsSnapshot = {
  avatarDirectory: null,
  avatars: [],
  hasLoaded: false,
  isError: false,
  isLoading: false,
};

let snapshot: CustomAvatarsSnapshot = INITIAL_SNAPSHOT;
let pendingRefresh: Promise<CustomAvatarsSnapshot> | null = null;
const listeners = new Set<(nextSnapshot: CustomAvatarsSnapshot) => void>();

export function getCustomAvatarsSnapshot() {
  return snapshot;
}

export function subscribeCustomAvatars(
  handler: (nextSnapshot: CustomAvatarsSnapshot) => void,
) {
  listeners.add(handler);
  handler(snapshot);

  return () => {
    listeners.delete(handler);
  };
}

export async function ensureCustomAvatarsLoaded() {
  if (snapshot.hasLoaded) {
    return snapshot;
  }

  try {
    return await refreshCustomAvatars();
  } catch {
    return snapshot;
  }
}

export async function refreshCustomAvatars() {
  if (pendingRefresh) {
    return pendingRefresh;
  }

  snapshot = {
    ...snapshot,
    isError: false,
    isLoading: true,
  };
  emitSnapshot();

  pendingRefresh = invoke<CustomAvatarsResponse>("custom-avatars")
    .then((response) => {
      snapshot = {
        avatarDirectory: response.avatarDirectory,
        avatars: response.avatars,
        hasLoaded: true,
        isError: false,
        isLoading: false,
      };
      emitSnapshot();
      return snapshot;
    })
    .catch((error) => {
      snapshot = {
        ...snapshot,
        hasLoaded: true,
        isError: true,
        isLoading: false,
      };
      emitSnapshot();
      throw error;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
}

function emitSnapshot() {
  for (const listener of listeners) {
    listener(snapshot);
  }
}
