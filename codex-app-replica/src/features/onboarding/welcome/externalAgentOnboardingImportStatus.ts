import { useSyncExternalStore } from "react";

export type ExternalAgentOnboardingImportStatus =
  | {
      status: "idle";
    }
  | {
      startedAtMs: number;
      status: "importing";
    }
  | {
      completedAtMs: number;
      status: "error" | "success";
    };

type Listener = () => void;

const listeners = new Set<Listener>();
const IDLE_STATUS: ExternalAgentOnboardingImportStatus = { status: "idle" };

let currentStatus: ExternalAgentOnboardingImportStatus = IDLE_STATUS;

export function getExternalAgentOnboardingImportStatus() {
  return currentStatus;
}

export function subscribeExternalAgentOnboardingImportStatus(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useExternalAgentOnboardingImportStatus() {
  return useSyncExternalStore(
    subscribeExternalAgentOnboardingImportStatus,
    getExternalAgentOnboardingImportStatus,
    getExternalAgentOnboardingImportStatus,
  );
}

export function runExternalAgentOnboardingImportStatus(task: () => Promise<unknown> | unknown) {
  setExternalAgentOnboardingImportStatus({
    status: "importing",
    startedAtMs: Date.now(),
  });

  let taskPromise: Promise<unknown>;
  try {
    taskPromise = Promise.resolve(task());
  } catch {
    setExternalAgentOnboardingImportStatus({
      status: "error",
      completedAtMs: Date.now(),
    });
    return Promise.resolve();
  }

  return taskPromise.then(
    () => {
      setExternalAgentOnboardingImportStatus({
        status: "success",
        completedAtMs: Date.now(),
      });
    },
    () => {
      setExternalAgentOnboardingImportStatus({
        status: "error",
        completedAtMs: Date.now(),
      });
    },
  );
}

function setExternalAgentOnboardingImportStatus(nextStatus: ExternalAgentOnboardingImportStatus) {
  currentStatus = nextStatus;
  listeners.forEach((listener) => listener());
}
