const GIT_STATE_CHANGED_EVENT = "codex-app-replica:git-state-changed";

export function emitGitStateChanged() {
  window.dispatchEvent(new Event(GIT_STATE_CHANGED_EVENT));
}

export function listenGitStateChanged(listener: () => void) {
  window.addEventListener(GIT_STATE_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(GIT_STATE_CHANGED_EVENT, listener);
  };
}
