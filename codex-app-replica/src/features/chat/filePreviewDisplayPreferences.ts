import { useSyncExternalStore } from "react";

type FilePreviewDisplayPreferences = {
  isRichPreviewEnabled: boolean;
  isWordWrapEnabled: boolean;
};

const DEFAULT_FILE_PREVIEW_DISPLAY_PREFERENCES: FilePreviewDisplayPreferences = {
  isRichPreviewEnabled: false,
  isWordWrapEnabled: true,
};

let filePreviewDisplayPreferences = DEFAULT_FILE_PREVIEW_DISPLAY_PREFERENCES;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return filePreviewDisplayPreferences;
}

function setFilePreviewDisplayPreferences(
  updater: (current: FilePreviewDisplayPreferences) => FilePreviewDisplayPreferences,
) {
  const nextPreferences = updater(filePreviewDisplayPreferences);
  if (
    nextPreferences.isRichPreviewEnabled === filePreviewDisplayPreferences.isRichPreviewEnabled &&
    nextPreferences.isWordWrapEnabled === filePreviewDisplayPreferences.isWordWrapEnabled
  ) {
    return;
  }

  filePreviewDisplayPreferences = nextPreferences;
  listeners.forEach((listener) => listener());
}

export function useFilePreviewDisplayPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...preferences,
    toggleRichPreview() {
      setFilePreviewDisplayPreferences((current) => ({
        ...current,
        isRichPreviewEnabled: !current.isRichPreviewEnabled,
      }));
    },
    toggleWordWrap() {
      setFilePreviewDisplayPreferences((current) => ({
        ...current,
        isWordWrapEnabled: !current.isWordWrapEnabled,
      }));
    },
  };
}
