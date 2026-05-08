import { useSyncExternalStore } from "react";

type FilePreviewOpenFilesState = {
  isOpen: boolean;
  width: number;
};

const DEFAULT_FILE_PREVIEW_OPEN_FILES_STATE: FilePreviewOpenFilesState = {
  isOpen: false,
  width: 400,
};

let filePreviewOpenFilesState = DEFAULT_FILE_PREVIEW_OPEN_FILES_STATE;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return filePreviewOpenFilesState;
}

function setFilePreviewOpenFilesState(updater: (current: FilePreviewOpenFilesState) => FilePreviewOpenFilesState) {
  const nextState = updater(filePreviewOpenFilesState);
  if (
    nextState.isOpen === filePreviewOpenFilesState.isOpen &&
    nextState.width === filePreviewOpenFilesState.width
  ) {
    return;
  }

  filePreviewOpenFilesState = nextState;
  listeners.forEach((listener) => listener());
}

export function useFilePreviewOpenFilesState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    open() {
      setFilePreviewOpenFilesState((current) => ({
        ...current,
        isOpen: true,
      }));
    },
    close() {
      setFilePreviewOpenFilesState((current) => ({
        ...current,
        isOpen: false,
      }));
    },
    toggle() {
      setFilePreviewOpenFilesState((current) => ({
        ...current,
        isOpen: !current.isOpen,
      }));
    },
    setWidth(width: number) {
      setFilePreviewOpenFilesState((current) => ({
        ...current,
        width,
      }));
    },
  };
}
