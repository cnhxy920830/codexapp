import { useEffect, useMemo, useState } from "react";
import {
  ClockIcon,
  MoreActionsIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayOutlineIcon,
  PlusIcon,
  ResumeCircleIcon,
  TrashIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import {
  buildAutomationDraft,
  deleteAutomation,
  listAutomations,
  runAutomationNow,
  saveAutomation,
  setAutomationStatus,
  type AutomationRecord,
  type AutomationStatus,
} from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";
import {
  formatAutomationLastRunLabel,
  formatAutomationNextRunLabel,
} from "./time";

type AutomationsRoutePageProps = {
  recentThreads: ThreadHistoryEntry[];
  onOpenThread: (threadId: string) => void | Promise<void>;
};

type FeedbackState =
  | {
      message: string;
      tone: "error" | "success";
    }
  | null;

function isPaused(automation: AutomationRecord) {
  return automation.status === "PAUSED";
}

function copyAutomation(automation: AutomationRecord): AutomationRecord {
  if (automation.kind === "heartbeat") {
    return { ...automation };
  }

  return { ...automation, cwds: [...automation.cwds] };
}

function describeAutomation(
  automation: AutomationRecord,
  threadNameById: Map<string, string>,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (automation.kind === "heartbeat") {
    return t("inbox.automations.rowSummary.heartbeat", {
      thread: threadNameById.get(automation.targetThreadId) ?? automation.targetThreadId,
    });
  }

  if (automation.cwds.length === 0) {
    return t("inbox.automations.workspaceFallback");
  }

  return automation.cwds.join(" · ");
}

function formatScheduleSummary(
  automation: AutomationRecord,
  t: ReturnType<typeof useI18n>["t"],
) {
  const value = automation.rrule.trim();
  return value.length > 0 ? value : t("settings.automations.rruleSummaryFallback");
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

function formatErrorMessage(
  prefix: string,
  error: unknown,
) {
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

function AutomationRow({
  automation,
  isMenuOpen,
  isRunNowDisabled,
  isRunNowPending,
  isSelected,
  onDelete,
  onEdit,
  onPause,
  onResume,
  onRunNow,
  onSelect,
  onToggleMenu,
  scheduleLabel,
  secondaryLabel,
  t,
}: {
  automation: AutomationRecord;
  isMenuOpen: boolean;
  isRunNowDisabled: boolean;
  isRunNowPending: boolean;
  isSelected: boolean;
  onDelete: (automation: AutomationRecord) => void;
  onEdit: (automation: AutomationRecord) => void;
  onPause: (automation: AutomationRecord) => void;
  onResume: (automation: AutomationRecord) => void;
  onRunNow: (automation: AutomationRecord) => void;
  onSelect: (automation: AutomationRecord) => void;
  onToggleMenu: (automationId: string | null) => void;
  scheduleLabel: string;
  secondaryLabel: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const statusIcon =
    automation.status === "PAUSED" ? (
      <PauseCircleIcon className="h-5 w-5" />
    ) : (
      <ClockIcon className="h-[18px] w-[18px]" />
    );

  return (
    <div
      className="group relative"
      data-automation-menu-root={automation.id}
    >
      <button
        type="button"
        onClick={() => onSelect(automation)}
        className={[
          "flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition-colors",
          isSelected ? "app-nav-item-active" : "app-nav-item-idle",
        ].join(" ")}
      >
        <span className="app-text-muted flex h-5 w-5 shrink-0 items-center justify-center">
          {statusIcon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="app-title truncate text-[13px] leading-5">
            {automation.name.trim() || t("settings.automations.namePlaceholder")}
          </div>
          <div className="app-text-muted mt-1 truncate text-[12px] leading-5">
            {secondaryLabel}
          </div>
        </div>
        <div className="relative ml-3 flex shrink-0 items-center text-[12px] text-[var(--app-shell-muted)]">
          <span
            className={[
              "min-w-[92px] text-right transition-opacity",
              isMenuOpen ? "opacity-0" : "group-hover:opacity-0",
            ].join(" ")}
          >
            {automation.status === "PAUSED" ? formatStatusLabel(automation.status, t) : scheduleLabel}
          </span>
          <div
            className={[
              "absolute inset-y-0 right-0 flex items-center gap-2 transition-opacity",
              isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            ].join(" ")}
          >
            <button
              type="button"
              title={t("settings.automations.runNow")}
              aria-label={t("settings.automations.runNow")}
              disabled={isRunNowDisabled}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onRunNow(automation);
              }}
              className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)] disabled:cursor-default disabled:opacity-60"
            >
              {isRunNowPending ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
              ) : (
                <PlayOutlineIcon className="h-[18px] w-[18px]" />
              )}
            </button>
            <button
              type="button"
              title={t("inbox.automations.editTooltip")}
              aria-label={t("inbox.automations.editTooltip")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit(automation);
              }}
              className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)]"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("inbox.automations.moreOptionsTooltip")}
              aria-label={t("inbox.automations.rowActions")}
              aria-expanded={isMenuOpen}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleMenu(isMenuOpen ? null : automation.id);
              }}
              className="app-text-muted flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:text-[var(--app-shell-foreground)]"
            >
              <MoreActionsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </button>
      {isMenuOpen ? (
        <div className="app-card absolute top-[calc(100%-6px)] right-3 z-10 min-w-[180px] rounded-[14px] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.18)]">
          {automation.status === "PAUSED" ? (
            <button
              type="button"
              onClick={() => onResume(automation)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <ResumeCircleIcon className="h-4 w-4" />
              {t("inbox.automations.resumeMenuItem")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPause(automation)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <PauseCircleIcon className="h-4 w-4" />
              {t("inbox.automations.pauseMenuItem")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(automation)}
            className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] text-[var(--app-shell-danger)]"
          >
            <TrashIcon className="h-4 w-4" />
            {t("inbox.automations.deleteMenuItem")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AutomationDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="app-card-muted flex items-center justify-between gap-4 rounded-[12px] px-3 py-2 text-[13px]">
      <span className="app-text-muted">{label}</span>
      <span className="app-title text-right">{value}</span>
    </div>
  );
}

export function AutomationsRoutePage({ recentThreads, onOpenThread }: AutomationsRoutePageProps) {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<AutomationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationRecord | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningNowId, setIsRunningNowId] = useState<string | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  const threadNameById = useMemo(
    () =>
      new Map(
        recentThreads.map((thread) => [thread.id, thread.name?.trim() || thread.preview.trim() || thread.id]),
      ),
    [recentThreads],
  );
  const currentItems = items.filter((item) => !isPaused(item));
  const pausedItems = items.filter(isPaused);
  const selectedAutomation = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;
  const deleteCandidate = deleteCandidateId
    ? items.find((item) => item.id === deleteCandidateId) ?? null
    : null;
  const isCreateMode = editorMode === "create";
  const activeDraft = draft;
  const isRunNowBusy = isRunningNowId !== null;

  async function loadAutomations(nextSelectedId?: string | null) {
    setIsLoading(true);
    try {
      const nextItems = await listAutomations();
      setItems(nextItems);
      setSelectedId((current) => {
        const candidate = nextSelectedId === undefined ? current : nextSelectedId;
        if (candidate && nextItems.some((item) => item.id === candidate)) {
          return candidate;
        }
        return nextItems[0]?.id ?? null;
      });
      setFeedback(null);
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAutomations();
  }, []);

  useEffect(() => {
    if (!openRowMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(`[data-automation-menu-root="${openRowMenuId}"]`)) {
        return;
      }

      setOpenRowMenuId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openRowMenuId]);

  useEffect(() => {
    if (editorMode === "create") {
      return;
    }

    if (!selectedAutomation) {
      setDraft(null);
      if (items.length === 0) {
        setEditorMode(null);
      }
      return;
    }

    setDraft(copyAutomation(selectedAutomation));
    setEditorMode("edit");
  }, [editorMode, items, selectedAutomation]);

  const selectAutomation = (automation: AutomationRecord) => {
    setOpenRowMenuId(null);
    setSelectedId(automation.id);
    setEditorMode("edit");
    setFeedback(null);
  };

  const startCreate = () => {
    setOpenRowMenuId(null);
    setSelectedId(null);
    setEditorMode("create");
    setDraft(buildAutomationDraft("cron"));
    setFeedback(null);
  };

  const cancelEditing = () => {
    if (selectedAutomation) {
      setDraft(copyAutomation(selectedAutomation));
      setEditorMode("edit");
      return;
    }

    setEditorMode(null);
    setDraft(null);
  };

  const saveCurrent = async () => {
    if (!activeDraft) {
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveAutomation({ automation: activeDraft });
      await loadAutomations(saved.id);
      setDraft(copyAutomation(saved));
      setEditorMode("edit");
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

  const updateStatus = async (automation: AutomationRecord, status: "ACTIVE" | "PAUSED") => {
    setOpenRowMenuId(null);
    try {
      const updated = await setAutomationStatus(automation.id, status);
      await loadAutomations(updated.id);
      setDraft(copyAutomation(updated));
      setEditorMode("edit");
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const removeSelected = async () => {
    if (!deleteCandidate) {
      return;
    }

    try {
      await deleteAutomation(deleteCandidate.id);
      setDeleteCandidateId(null);
      setOpenRowMenuId(null);
      await loadAutomations(selectedId === deleteCandidate.id ? null : selectedId);
      if (selectedId === deleteCandidate.id) {
        setDraft(null);
      }
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.deleteError"), error),
        tone: "error",
      });
    }
  };

  const handleRunNow = async (automation: AutomationRecord) => {
    setIsRunningNowId(automation.id);
    setFeedback(null);
    try {
      const result = await runAutomationNow(automation.id);
      setFeedback({ message: t("inbox.automations.runNowSuccess"), tone: "success" });
      await onOpenThread(result.threadId);
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.runNowError"), error),
        tone: "error",
      });
    } finally {
      setIsRunningNowId(null);
    }
  };

  const activeTitle =
    activeDraft?.name.trim() ||
    (isCreateMode ? t("inbox.automations.new") : selectedAutomation?.name.trim()) ||
    t("settings.automations.namePlaceholder");
  const nextRunLabel =
    activeDraft === null
      ? ""
      : formatAutomationNextRunLabel({
          locale,
          nextRunAt: activeDraft.nextRunAt,
          status: activeDraft.status,
          t,
        });
  const lastRunLabel =
    activeDraft === null
      ? ""
      : formatAutomationLastRunLabel({
          lastRunAt: activeDraft.lastRunAt,
          locale,
          t,
        });

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <section className="flex min-h-0 w-[380px] flex-col border-r border-[var(--app-shell-border)] bg-[var(--app-shell-sidebar)]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="app-title text-[16px] font-medium">{t("inbox.automations.header.root")}</div>
            <button
              type="button"
              onClick={startCreate}
              className="app-control inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12px]"
            >
              <PlusIcon className="h-4 w-4" />
              {t("inbox.automations.new")}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {isLoading ? (
              <div className="app-text-muted px-2 py-3 text-[13px]">{t("inbox.automations.loading")}</div>
            ) : items.length === 0 ? (
              <div className="app-badge rounded-[14px] px-4 py-3 text-[13px] leading-6">
                {t("inbox.automations.emptySubtitle.learnMore")}
              </div>
            ) : (
              <div className="space-y-5" aria-label={t("inbox.automations.sectionsNav")}>
                {currentItems.length > 0 ? (
                  <div>
                    <div className="app-text-muted px-2 pb-2 text-[12px] font-medium tracking-[0.14em]">
                      {t("inbox.automations.current")}
                    </div>
                    <div className="space-y-1" role="list">
                      {currentItems.map((automation) => (
                        <div key={automation.id} role="listitem">
                          <AutomationRow
                            automation={automation}
                            isMenuOpen={openRowMenuId === automation.id}
                            isRunNowDisabled={isRunNowBusy}
                            isRunNowPending={isRunningNowId === automation.id}
                            isSelected={selectedId === automation.id && !isCreateMode}
                            onDelete={(item) => {
                              setDeleteCandidateId(item.id);
                              setOpenRowMenuId(null);
                            }}
                            onEdit={selectAutomation}
                            onPause={(item) => void updateStatus(item, "PAUSED")}
                            onResume={(item) => void updateStatus(item, "ACTIVE")}
                            onRunNow={(item) => void handleRunNow(item)}
                            onSelect={selectAutomation}
                            onToggleMenu={setOpenRowMenuId}
                            scheduleLabel={formatScheduleSummary(automation, t)}
                            secondaryLabel={describeAutomation(automation, threadNameById, t)}
                            t={t}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {pausedItems.length > 0 ? (
                  <div>
                    <div className="app-text-muted px-2 pb-2 text-[12px] font-medium tracking-[0.14em]">
                      {t("inbox.automations.pausedSection")}
                    </div>
                    <div className="space-y-1" role="list">
                      {pausedItems.map((automation) => (
                        <div key={automation.id} role="listitem">
                          <AutomationRow
                            automation={automation}
                            isMenuOpen={openRowMenuId === automation.id}
                            isRunNowDisabled={isRunNowBusy}
                            isRunNowPending={isRunningNowId === automation.id}
                            isSelected={selectedId === automation.id && !isCreateMode}
                            onDelete={(item) => {
                              setDeleteCandidateId(item.id);
                              setOpenRowMenuId(null);
                            }}
                            onEdit={selectAutomation}
                            onPause={(item) => void updateStatus(item, "PAUSED")}
                            onResume={(item) => void updateStatus(item, "ACTIVE")}
                            onRunNow={(item) => void handleRunNow(item)}
                            onSelect={selectAutomation}
                            onToggleMenu={setOpenRowMenuId}
                            scheduleLabel={formatScheduleSummary(automation, t)}
                            secondaryLabel={describeAutomation(automation, threadNameById, t)}
                            t={t}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeDraft ? (
            <>
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
                <div className="grid max-w-[920px] gap-5">
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

                  {!isCreateMode ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      <AutomationDetailRow
                        label={t("inbox.automations.status.label")}
                        value={formatStatusLabel(activeDraft.status, t)}
                      />
                      <AutomationDetailRow
                        label={t("inbox.automations.nextRun.label")}
                        value={nextRunLabel}
                      />
                      <AutomationDetailRow
                        label={t("inbox.automations.lastRun.label")}
                        value={lastRunLabel}
                      />
                    </div>
                  ) : null}

                  <label className="grid gap-2">
                    <span className="app-title text-[13px] font-medium">{t("settings.automations.nameLabel")}</span>
                    <input
                      value={activeDraft.name}
                      onChange={(event) =>
                        setDraft((current) => (current ? { ...current, name: event.target.value } : current))
                      }
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

                  {activeDraft.kind === "heartbeat" ? (
                    <label className="grid gap-2">
                      <span className="app-title text-[13px] font-medium">{t("inbox.automations.targetThread.label")}</span>
                      <select
                        value={activeDraft.targetThreadId}
                        onChange={(event) =>
                          setDraft((current) =>
                            current && current.kind === "heartbeat"
                              ? { ...current, targetThreadId: event.target.value }
                              : current,
                          )
                        }
                        className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                      >
                        <option value="">{t("settings.automations.heartbeatThread.placeholder")}</option>
                        {recentThreads.map((thread) => (
                          <option key={thread.id} value={thread.id}>
                            {thread.name?.trim() || thread.preview.trim() || thread.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="grid gap-2">
                        <span className="app-title text-[13px] font-medium">{t("inbox.automations.folder.label")}</span>
                        <textarea
                          value={activeDraft.cwds.join("\n")}
                          onChange={(event) =>
                            setDraft((current) =>
                              current && current.kind === "cron"
                                ? {
                                    ...current,
                                    cwds: event.target.value
                                      .split(/\r?\n/)
                                      .map((line) => line.trim())
                                      .filter(Boolean),
                                  }
                                : current,
                            )
                          }
                          placeholder={t("settings.automations.cwdPlaceholder")}
                          className="app-input min-h-[88px] rounded-[12px] px-3 py-3 text-[14px] leading-6"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="app-title text-[13px] font-medium">{t("inbox.automations.executionEnvironment.label")}</span>
                        <select
                          aria-label={t("settings.automations.executionEnvironment.ariaLabel")}
                          value={activeDraft.executionEnvironment}
                          onChange={(event) =>
                            setDraft((current) =>
                              current && current.kind === "cron"
                                ? { ...current, executionEnvironment: event.target.value }
                                : current,
                            )
                          }
                          className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                        >
                          <option value="local">{t("settings.automations.executionEnvironment.local")}</option>
                          <option value="worktree">{t("settings.automations.executionEnvironment.worktree")}</option>
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="app-title text-[13px] font-medium">{t("inbox.automations.model.label")}</span>
                        <input
                          value={activeDraft.model ?? ""}
                          onChange={(event) =>
                            setDraft((current) =>
                              current && current.kind === "cron"
                                ? { ...current, model: event.target.value || null }
                                : current,
                            )
                          }
                          className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="app-title text-[13px] font-medium">{t("inbox.automations.reasoning.label")}</span>
                        <input
                          value={activeDraft.reasoningEffort ?? ""}
                          onChange={(event) =>
                            setDraft((current) =>
                              current && current.kind === "cron"
                                ? { ...current, reasoningEffort: event.target.value || null }
                                : current,
                            )
                          }
                          className="app-input h-11 rounded-[12px] px-3 text-[14px]"
                        />
                      </label>
                    </>
                  )}

                  <label className="grid gap-2">
                    <span className="app-title text-[13px] font-medium">
                      {activeDraft.kind === "heartbeat"
                        ? t("inbox.automations.interval.label")
                        : t("inbox.automations.repeats.label")}
                    </span>
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
                    onClick={cancelEditing}
                    className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                  >
                    {t("settings.automations.cancel")}
                  </button>
                  {!isCreateMode && selectedAutomation ? (
                    <>
                      {selectedAutomation.status === "PAUSED" ? (
                        <button
                          type="button"
                          aria-label={t("settings.automations.resumeAria")}
                          onClick={() => void updateStatus(selectedAutomation, "ACTIVE")}
                          className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
                        >
                          <ResumeCircleIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={t("settings.automations.pauseAria")}
                          onClick={() => void updateStatus(selectedAutomation, "PAUSED")}
                          className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
                        >
                          <PauseCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t("settings.automations.deleteAria")}
                        onClick={() => setDeleteCandidateId(selectedAutomation.id)}
                        className="app-control flex h-9 w-9 items-center justify-center rounded-[11px] text-[var(--app-shell-danger)]"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isRunNowBusy}
                        onClick={() => void handleRunNow(selectedAutomation)}
                        className="app-button-primary inline-flex items-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
                      >
                        {isRunningNowId === selectedAutomation.id ? (
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
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6">
              <div className="app-text-muted max-w-[420px] text-center text-[14px] leading-6">
                {items.length === 0 ? t("inbox.automations.emptySubtitle.learnMore") : t("inbox.automations.details")}
              </div>
            </div>
          )}
        </section>
      </div>

      {deleteCandidate ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
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
                onClick={() => void removeSelected()}
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
