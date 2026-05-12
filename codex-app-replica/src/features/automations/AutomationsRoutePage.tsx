import { useEffect, useMemo, useState } from "react";
import {
  BackNavigationIcon,
  ForwardNavigationIcon,
  PauseCircleIcon,
  PlayOutlineIcon,
  PlusIcon,
  ResumeCircleIcon,
  TrashIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import {
  AUTOMATION_UPDATE_MISSING_MESSAGE,
  buildAutomationDraft,
  createAutomation,
  deleteAutomationCompat,
  listAutomations,
  runAutomationNow,
  setAutomationStatus,
  type AutomationRecord,
  updateAutomation,
} from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";
import { AutomationsCreateDialog } from "./AutomationsCreateDialog";
import { AutomationsDetailPane } from "./AutomationsDetailPane";
import { AutomationsOverviewPane } from "./AutomationsOverviewPane";
import { useAutomationLocalEnvironmentSelection } from "./useAutomationLocalEnvironmentSelection";
import {
  areAutomationsEqual,
  copyAutomation,
  type FeedbackState,
  formatErrorMessage,
  hasAutomationRequiredFields,
  isPaused,
  sortAutomations,
} from "./automationsPageUtils";
import {
  formatAutomationLastRunLabel,
  formatAutomationNextRunLabel,
} from "./time";

const AUTO_SAVE_DELAY_MS = 600;

type AutomationsRoutePageProps = {
  hasConnectedRemoteConnections: boolean;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  recentThreads: ThreadHistoryEntry[];
  onOpenThread: (threadId: string) => void | Promise<void>;
  selectedHostId: string;
};

type ToolbarProps = {
  automationName: string | null;
  isDeleting: boolean;
  isDetailVisible: boolean;
  isPaused: boolean;
  isRetrySavePending: boolean;
  isRunNowPending: boolean;
  isSaveRetryVisible: boolean;
  onBackToAutomations: () => void;
  onCreateAutomationClick: () => void;
  onDeleteAutomation: () => void;
  onPauseAutomation: () => void;
  onResumeAutomation: () => void;
  onRetrySave: () => void;
  onRunNow: () => void;
  t: ReturnType<typeof useI18n>["t"];
};

function Toolbar({
  automationName,
  isDeleting,
  isDetailVisible,
  isPaused: detailIsPaused,
  isRetrySavePending,
  isRunNowPending,
  isSaveRetryVisible,
  onBackToAutomations,
  onCreateAutomationClick,
  onDeleteAutomation,
  onPauseAutomation,
  onResumeAutomation,
  onRetrySave,
  onRunNow,
  t,
}: ToolbarProps) {
  return (
    <div className="draggable grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-[var(--app-shell-border)] px-panel py-2 electron:h-toolbar">
      <div className="min-w-0 text-base">
        {isDetailVisible && automationName ? (
          <div className="flex min-w-0 items-center gap-1 text-[var(--app-shell-muted)]">
            <button
              type="button"
              onClick={onBackToAutomations}
              className="app-control-weak no-drag inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1 text-[13px]"
            >
              <BackNavigationIcon className="h-4 w-4" />
              {t("inbox.automations.header.root")}
            </button>
            <ForwardNavigationIcon className="h-3.5 w-3.5 shrink-0" />
            <div className="truncate text-[13px] text-[var(--app-shell-title)]">
              {automationName}
            </div>
          </div>
        ) : null}
      </div>

      <div className="no-drag flex items-center justify-end gap-2">
        {isDetailVisible ? (
          <>
            {isSaveRetryVisible ? (
              <button
                type="button"
                disabled={isRetrySavePending}
                onClick={onRetrySave}
                className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
              >
                {isRetrySavePending
                  ? t("general.saving")
                  : t("settings.automations.saveRetry")}
              </button>
            ) : null}
            {detailIsPaused ? (
              <button
                type="button"
                aria-label={t("settings.automations.resumeAria")}
                onClick={onResumeAutomation}
                className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
              >
                <ResumeCircleIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("settings.automations.pauseAria")}
                onClick={onPauseAutomation}
                className="app-control flex h-9 w-9 items-center justify-center rounded-[11px]"
              >
                <PauseCircleIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={t("settings.automations.deleteAria")}
              disabled={isDeleting}
              onClick={onDeleteAutomation}
              className="app-control flex h-9 w-9 items-center justify-center rounded-[11px] text-[var(--app-shell-danger)] disabled:cursor-default disabled:opacity-60"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isRunNowPending}
              onClick={onRunNow}
              className="app-button-primary inline-flex items-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
            >
              {isRunNowPending ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <PlayOutlineIcon className="h-4 w-4" />
              )}
              {t("settings.automations.runNow")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onCreateAutomationClick}
            className="app-button-primary inline-flex items-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            <PlusIcon className="h-4 w-4" />
            {t("inbox.automations.new")}
          </button>
        )}
      </div>
    </div>
  );
}

export function AutomationsRoutePage({
  hasConnectedRemoteConnections,
  onOpenLocalEnvironmentsSettings,
  recentThreads,
  onOpenThread,
  selectedHostId,
}: AutomationsRoutePageProps) {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<AutomationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationRecord | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [isRetrySaving, setIsRetrySaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunningNowId, setIsRunningNowId] = useState<string | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [failedAutoSaveDraft, setFailedAutoSaveDraft] =
    useState<AutomationRecord | null>(null);

  const threadNameById = useMemo(
    () =>
      new Map(
        recentThreads.map((thread) => [
          thread.id,
          thread.name?.trim() || thread.preview.trim() || thread.id,
        ]),
      ),
    [recentThreads],
  );

  const sortedItems = useMemo(() => sortAutomations(items), [items]);
  const selectedAutomation = useMemo(
    () =>
      selectedId
        ? sortedItems.find((item) => item.id === selectedId) ?? null
        : null,
    [selectedId, sortedItems],
  );
  const deleteCandidate = useMemo(
    () =>
      deleteCandidateId
        ? sortedItems.find((item) => item.id === deleteCandidateId) ?? null
        : null,
    [deleteCandidateId, sortedItems],
  );

  const isCreateMode = editorMode === "create" && draft !== null;
  const isDetailVisible =
    editorMode === "edit" && selectedAutomation !== null && draft !== null;
  const isRunNowBusy = isRunningNowId !== null;
  const isSaveRetryVisible =
    draft !== null &&
    failedAutoSaveDraft !== null &&
    areAutomationsEqual(draft, failedAutoSaveDraft);

  const detailAutomationName =
    draft?.name.trim() ||
    selectedAutomation?.name.trim() ||
    (isDetailVisible || isCreateMode
      ? t("settings.automations.dialog.newTitle")
      : null);

  const nextRunLabel =
    draft === null
      ? ""
      : formatAutomationNextRunLabel({
          locale,
          nextRunAt: draft.nextRunAt,
          status: draft.status,
          t,
        });
  const lastRunLabel =
    draft === null
      ? ""
      : formatAutomationLastRunLabel({
          lastRunAt: draft.lastRunAt,
          locale,
          t,
        });
  const localEnvironmentState = useAutomationLocalEnvironmentSelection({
    automation: draft,
    hostId: selectedHostId,
    setAutomation: setDraft,
  });

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
        return null;
      });
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
    void loadAutomations(null);
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
    if (editorMode !== "edit" || selectedId === null || selectedAutomation !== null || isLoading) {
      return;
    }

    setDraft(null);
    setEditorMode(null);
    setFailedAutoSaveDraft(null);
    setSelectedId(null);
  }, [editorMode, isLoading, selectedAutomation, selectedId]);

  async function persistDetailDraft(
    nextDraft: AutomationRecord,
    source: "auto" | "retry",
  ) {
    const requestDraft = copyAutomation(nextDraft);
    if (source === "retry") {
      setIsRetrySaving(true);
    } else {
      setIsDetailSaving(true);
    }

    try {
      const updated = await updateAutomation(requestDraft);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDraft((current) => {
        if (!current || current.id !== updated.id) {
          return current;
        }

        return areAutomationsEqual(current, requestDraft)
          ? copyAutomation(updated)
          : current;
      });
      setFailedAutoSaveDraft(null);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.updateError"), error),
        tone: "error",
      });
      setFailedAutoSaveDraft(requestDraft);

      if (
        error instanceof Error &&
        error.message === AUTOMATION_UPDATE_MISSING_MESSAGE
      ) {
        setSelectedId(null);
        setDraft(null);
        setEditorMode(null);
        setFailedAutoSaveDraft(null);
        await loadAutomations(null);
      }
    } finally {
      if (source === "retry") {
        setIsRetrySaving(false);
      } else {
        setIsDetailSaving(false);
      }
    }
  }

  useEffect(() => {
    if (
      editorMode !== "edit" ||
      draft === null ||
      selectedAutomation === null ||
      isDetailSaving ||
      isRetrySaving ||
      !hasAutomationRequiredFields(draft) ||
      areAutomationsEqual(draft, selectedAutomation) ||
      (failedAutoSaveDraft !== null && areAutomationsEqual(draft, failedAutoSaveDraft))
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDetailDraft(draft, "auto");
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    draft,
    editorMode,
    failedAutoSaveDraft,
    isDetailSaving,
    isRetrySaving,
    selectedAutomation,
  ]);

  const updateDraft: typeof setDraft = (value) => {
    setDraft(value);
    setFeedback((current) => (current?.tone === "success" ? null : current));
  };

  const selectAutomation = (automation: AutomationRecord) => {
    setOpenRowMenuId(null);
    setSelectedId(automation.id);
    setDraft(copyAutomation(automation));
    setEditorMode("edit");
    setFailedAutoSaveDraft(null);
    setFeedback(null);
  };

  const closeDetail = (clearFeedback = true) => {
    setOpenRowMenuId(null);
    setSelectedId(null);
    setDraft(null);
    setEditorMode(null);
    setFailedAutoSaveDraft(null);
    if (clearFeedback) {
      setFeedback(null);
    }
  };

  const startCreate = () => {
    setOpenRowMenuId(null);
    setSelectedId(null);
    setDraft(buildAutomationDraft("cron"));
    setEditorMode("create");
    setFailedAutoSaveDraft(null);
    setFeedback(null);
  };

  const clearDraft = () => {
    updateDraft((current) =>
      current ? { ...current, name: "", prompt: "" } : current,
    );
  };

  const saveCreate = async () => {
    if (draft === null || !hasAutomationRequiredFields(draft)) {
      return;
    }

    setIsCreateSaving(true);
    try {
      await createAutomation(draft);
      setFeedback(null);
      setEditorMode(null);
      setDraft(null);
      await loadAutomations(null);
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.createError"), error),
        tone: "error",
      });
    } finally {
      setIsCreateSaving(false);
    }
  };

  const updateStatus = async (
    automation: AutomationRecord,
    status: "ACTIVE" | "PAUSED",
  ) => {
    setOpenRowMenuId(null);
    try {
      const updated = await setAutomationStatus(automation.id, status);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (selectedId === updated.id) {
        setDraft(copyAutomation(updated));
      }
      setFailedAutoSaveDraft(null);
      setFeedback(null);
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

    setIsDeleting(true);
    try {
      const result = await deleteAutomationCompat(deleteCandidate.id);
      if (!result.success) {
        setFeedback({
          message: `${t("inbox.automations.deleteError")}: ${t(
            "inbox.automations.deleteFailedDescription",
          )}`,
          tone: "error",
        });
        return;
      }

      const wasSelected = selectedId === deleteCandidate.id;
      setDeleteCandidateId(null);
      if (wasSelected) {
        closeDetail(false);
      }
      await loadAutomations(wasSelected ? null : selectedId);
    } catch (error) {
      setFeedback({
        message: formatErrorMessage(t("inbox.automations.deleteError"), error),
        tone: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunNow = async (automation: AutomationRecord) => {
    setIsRunningNowId(automation.id);
    setFeedback(null);
    try {
      const result = await runAutomationNow(automation.id);
      setFeedback({
        message: t("inbox.automations.runNowSuccess"),
        tone: "success",
      });
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

  const detailAutomation = isDetailVisible ? selectedAutomation : null;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Toolbar
          automationName={detailAutomationName}
          isDeleting={isDeleting}
          isDetailVisible={isDetailVisible}
          isPaused={detailAutomation ? isPaused(detailAutomation) : false}
          isRetrySavePending={isRetrySaving}
          isRunNowPending={
            detailAutomation ? isRunningNowId === detailAutomation.id : false
          }
          isSaveRetryVisible={isSaveRetryVisible && isDetailVisible}
          onBackToAutomations={() => closeDetail()}
          onCreateAutomationClick={startCreate}
          onDeleteAutomation={() => {
            if (detailAutomation) {
              setDeleteCandidateId(detailAutomation.id);
            }
          }}
          onPauseAutomation={() => {
            if (detailAutomation) {
              void updateStatus(detailAutomation, "PAUSED");
            }
          }}
          onResumeAutomation={() => {
            if (detailAutomation) {
              void updateStatus(detailAutomation, "ACTIVE");
            }
          }}
          onRetrySave={() => {
            if (draft) {
              void persistDetailDraft(draft, "retry");
            }
          }}
          onRunNow={() => {
            if (detailAutomation) {
              void handleRunNow(detailAutomation);
            }
          }}
          t={t}
        />

        {detailAutomation && draft ? (
          <AutomationsDetailPane
            draft={draft}
            feedback={feedback}
            hasConnectedRemoteConnections={hasConnectedRemoteConnections}
            isSaving={isDetailSaving || isRetrySaving}
            lastRunLabel={lastRunLabel}
            localEnvironmentState={localEnvironmentState}
            nextRunLabel={nextRunLabel}
            onClearDraft={clearDraft}
            onDraftChange={updateDraft}
            onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
            recentThreads={recentThreads}
            threadNameById={threadNameById}
            t={t}
          />
        ) : (
          <AutomationsOverviewPane
            feedback={feedback}
            isLoading={isLoading}
            isRunningNowId={isRunningNowId}
            items={sortedItems}
            openRowMenuId={openRowMenuId}
            selectedId={selectedId}
            threadNameById={threadNameById}
            onDeleteAutomation={(automation) => {
              setDeleteCandidateId(automation.id);
              setOpenRowMenuId(null);
            }}
            onPauseAutomation={(automation) => void updateStatus(automation, "PAUSED")}
            onResumeAutomation={(automation) => void updateStatus(automation, "ACTIVE")}
            onRunAutomationNow={(automation) => void handleRunNow(automation)}
            onSelectAutomation={selectAutomation}
            onToggleMenu={setOpenRowMenuId}
            t={t}
          />
        )}
      </div>

      {isCreateMode ? (
        <AutomationsCreateDialog
          canSave={draft !== null && hasAutomationRequiredFields(draft)}
          draft={draft}
          feedback={feedback}
          isSaving={isCreateSaving}
          localEnvironmentState={localEnvironmentState}
          onCancel={() => {
            setEditorMode(null);
            setDraft(null);
            setFeedback(null);
          }}
          onClearDraft={clearDraft}
          onCreate={() => void saveCreate()}
          onDraftChange={updateDraft}
          onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
          recentThreads={recentThreads}
          t={t}
        />
      ) : null}

      {deleteCandidate ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">
              {t("inbox.automations.deleteConfirm.title", {
                name:
                  deleteCandidate.name.trim() ||
                  t("settings.automations.dialog.newTitle"),
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
                disabled={isDeleting}
                onClick={() => void removeSelected()}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
              >
                {isDeleting
                  ? t("general.saving")
                  : t("inbox.automations.deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
