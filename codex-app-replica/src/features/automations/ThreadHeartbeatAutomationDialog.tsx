import { useEffect, useMemo, useState } from "react";
import {
  PauseCircleIcon,
  PlayOutlineIcon,
  ResumeCircleIcon,
  TrashIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import {
  deleteAutomation,
  runAutomationNow,
  saveAutomation,
  setAutomationStatus,
  type AutomationStatus,
  type HeartbeatAutomationRecord,
} from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";

type ThreadHeartbeatAutomationDialogProps = {
  open: boolean;
  initialDraft: HeartbeatAutomationRecord | null;
  initialMode: "create" | "edit";
  recentThreads: ThreadHistoryEntry[];
  onAutomationsChanged: () => void | Promise<void>;
  onClose: () => void;
  onOpenThread: (threadId: string) => void | Promise<void>;
};

type FeedbackState =
  | {
      message: string;
      tone: "error" | "success";
    }
  | null;

function copyHeartbeatAutomation(automation: HeartbeatAutomationRecord): HeartbeatAutomationRecord {
  return { ...automation };
}

function formatStatusLabel(
  status: AutomationStatus,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (status) {
    case "ACTIVE":
      return t("inbox.automations.status.active");
    case "PAUSED":
      return t("inbox.automations.status.paused");
    case "DELETED":
      return t("inbox.automations.status.deleted");
  }
}

function formatErrorMessage(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${detail}`;
}

function AutomationStatusBadge({
  status,
  t,
}: {
  status: AutomationStatus;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const dotClassName =
    status === "ACTIVE"
      ? "bg-[#2c9f5f]"
      : status === "PAUSED"
        ? "bg-[#c98a1c]"
        : "bg-[var(--app-shell-danger)]";

  return (
    <span className="app-badge inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px]">
      <span className={["h-2 w-2 rounded-full", dotClassName].join(" ")} />
      {formatStatusLabel(status, t)}
    </span>
  );
}

export function ThreadHeartbeatAutomationDialog({
  open,
  initialDraft,
  initialMode,
  recentThreads,
  onAutomationsChanged,
  onClose,
  onOpenThread,
}: ThreadHeartbeatAutomationDialogProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<HeartbeatAutomationRecord | null>(initialDraft);
  const [editorMode, setEditorMode] = useState<"create" | "edit">(initialMode);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(initialDraft ? copyHeartbeatAutomation(initialDraft) : null);
    setEditorMode(initialMode);
    setFeedback(null);
    setDeleteCandidateId(null);
    setIsSaving(false);
    setIsRunningNow(false);
  }, [initialDraft, initialMode, open]);

  const activeDraft = draft;
  const isCreateMode = editorMode === "create";
  const activeTitle =
    activeDraft?.name.trim() ||
    (isCreateMode ? t("inbox.automations.new") : initialDraft?.name.trim()) ||
    t("settings.automations.namePlaceholder");

  const deleteCandidate = deleteCandidateId && activeDraft?.id === deleteCandidateId ? activeDraft : null;
  const recentThreadOptions = useMemo(
    () =>
      recentThreads.map((thread) => ({
        id: thread.id,
        label: thread.name?.trim() || thread.preview.trim() || thread.id,
      })),
    [recentThreads],
  );

  if (!open || !activeDraft) {
    return null;
  }

  const saveCurrent = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await saveAutomation({ automation: activeDraft });
      setDraft(copyHeartbeatAutomation(saved as HeartbeatAutomationRecord));
      setEditorMode("edit");
      await onAutomationsChanged();
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(
          isCreateMode ? t("inbox.automations.createError") : t("settings.automations.save"),
          error,
        ),
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (status: "ACTIVE" | "PAUSED") => {
    try {
      const updated = await setAutomationStatus(activeDraft.id, status);
      setDraft(copyHeartbeatAutomation(updated as HeartbeatAutomationRecord));
      await onAutomationsChanged();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const removeCurrent = async () => {
    if (!deleteCandidate) {
      return;
    }

    try {
      await deleteAutomation(deleteCandidate.id);
      await onAutomationsChanged();
      setDeleteCandidateId(null);
      onClose();
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.deleteError"), error),
        tone: "error",
      });
    }
  };

  const handleRunNow = async () => {
    setIsRunningNow(true);
    setFeedback(null);
    try {
      const result = await runAutomationNow(activeDraft.id);
      setFeedback({ message: t("inbox.automations.runNowSuccess"), tone: "success" });
      await onOpenThread(result.threadId);
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.runNowError"), error),
        tone: "error",
      });
    } finally {
      setIsRunningNow(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
        <div className="app-card flex max-h-[min(92vh,860px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] shadow-[0_20px_48px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[var(--app-shell-border)] px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="app-title truncate text-[16px] font-medium">{activeTitle}</div>
                <div className="app-text-muted mt-1 text-[13px]">{t("inbox.automations.details")}</div>
              </div>
              <AutomationStatusBadge status={activeDraft.status} t={t} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5">
              {feedback ? (
                <div
                  className={[
                    feedback.tone === "error" ? "app-card-error" : "app-badge",
                    "rounded-[14px] px-4 py-3 text-[13px]",
                  ].join(" ")}
                >
                  {feedback.message}
                </div>
              ) : null}

              <label className="grid gap-2">
                <span className="app-title text-[13px] font-medium">{t("settings.automations.nameLabel")}</span>
                <input
                  value={activeDraft.name}
                  onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                  placeholder={t("settings.automations.namePlaceholder")}
                  className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                />
              </label>

              <label className="grid gap-2">
                <span className="app-title text-[13px] font-medium">{t("settings.automations.promptLabel")}</span>
                <textarea
                  value={activeDraft.prompt}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, prompt: event.target.value } : current))
                  }
                  placeholder={t("settings.automations.promptPlaceholder")}
                  className="app-input min-h-[160px] rounded-[12px] px-3 py-3 text-[14px] leading-6"
                />
              </label>

              <label className="grid gap-2">
                <span className="app-title text-[13px] font-medium">{t("inbox.automations.targetThread.label")}</span>
                <select
                  value={activeDraft.targetThreadId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            targetThreadId: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                >
                  <option value="">{t("settings.automations.heartbeatThread.placeholder")}</option>
                  {recentThreadOptions.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="app-title text-[13px] font-medium">{t("inbox.automations.interval.label")}</span>
                <input
                  value={activeDraft.rrule}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, rrule: event.target.value } : current))
                  }
                  className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--app-shell-border)] px-6 py-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.automations.cancel")}
              </button>
              {!isCreateMode ? (
                <>
                  {activeDraft.status === "PAUSED" ? (
                    <button
                      type="button"
                      aria-label={t("settings.automations.resumeAria")}
                      onClick={() => void updateStatus("ACTIVE")}
                      className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
                    >
                      <ResumeCircleIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t("settings.automations.pauseAria")}
                      onClick={() => void updateStatus("PAUSED")}
                      className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
                    >
                      <PauseCircleIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("settings.automations.deleteAria")}
                    onClick={() => setDeleteCandidateId(activeDraft.id)}
                    className="app-control flex h-9 w-9 items-center justify-center rounded-[11px] text-[var(--app-shell-danger)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isRunningNow}
                    onClick={() => void handleRunNow()}
                    className="app-button-primary inline-flex items-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
                  >
                    {isRunningNow ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <PlayOutlineIcon className="h-4 w-4" />
                    )}
                    {t("settings.automations.runNow")}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveCurrent()}
                className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
              >
                {isSaving
                  ? t("general.saving")
                  : isCreateMode
                    ? t("settings.automations.create")
                    : t("settings.automations.save")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {deleteCandidate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">
              {t("inbox.automations.deleteConfirm.title", {
                name: deleteCandidate.name || t("settings.automations.namePlaceholder"),
              })}
            </div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("inbox.automations.deleteConfirm.description")}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidateId(null)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("inbox.automations.deleteConfirm.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void removeCurrent()}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("inbox.automations.deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
