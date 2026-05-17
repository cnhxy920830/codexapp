import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppToast } from "../../components/AppToastRegion";
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
  listInboxItems,
  listAutomations,
  runAutomationNow,
  setInboxItemReadState,
  setAutomationStatus,
  updateAutomation,
  type AutomationInboxItem,
  type AutomationRecord,
  type CronAutomationRecord,
} from "../../services/automations";
import {
  getGlobalState,
  listModelsForHost,
  onGlobalStateUpdated,
  type ModelListEntry,
} from "../../services/settings";
import type { ThreadHistoryEntry } from "../../services/history";
import { AutomationsCreateDialog } from "./AutomationsCreateDialog";
import { AutomationsDetailPane } from "./AutomationsDetailPane";
import { AutomationsOverviewPane } from "./AutomationsOverviewPane";
import {
  areAutomationsEqual,
  buildHeartbeatThreadOptions,
  copyAutomation,
  formatErrorMessage,
  hasAutomationRequiredFields,
  isPaused,
  sortAutomations,
} from "./automationsPageUtils";
import {
  parseAutomationsRouteState,
  serializeAutomationsRouteState,
  type AutomationsRouteState,
} from "./automationsRouteState";
import {
  formatAutomationLastRunLabel,
  formatAutomationNextRunLabel,
} from "./time";
import { useAutomationLocalEnvironmentSelection } from "./useAutomationLocalEnvironmentSelection";
import {
  onWorkspaceRootOptionsUpdated,
  readWorkspaceRootOptions,
} from "../../services/workspaceRoots";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
} from "../../services/queryCache";

const AUTO_SAVE_DELAY_MS = 600;
const INBOX_ITEMS_QUERY_KEY = ["inbox-items"] as const;

type AutomationsRoutePageProps = {
  hasConnectedRemoteConnections: boolean;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  onShowToast: (toast: AppToast) => void;
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

function getWindowSearch() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}

function writeAutomationsRouteState(
  state: AutomationsRouteState,
  options?: { replace?: boolean },
) {
  if (typeof window === "undefined") {
    return;
  }

  const params = serializeAutomationsRouteState(state);
  const nextSearch = params.toString();
  const nextUrl =
    nextSearch.length > 0
      ? `${window.location.pathname}?${nextSearch}`
      : window.location.pathname;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl === nextUrl) {
    return;
  }

  const method = options?.replace === true ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", nextUrl);
}

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
    <div className="draggable grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-panel py-2 electron:h-toolbar">
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

function MissingAutomationPane({
  onBackToAutomations,
  t,
}: {
  onBackToAutomations: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-1 flex-col items-start gap-3 px-panel pt-panel pb-panel">
      <div className="text-lg text-[var(--app-shell-title)]">
        {t("inbox.automations.missing")}
      </div>
      <div className="app-text-muted">
        {t("inbox.automations.missingSubtitle")}
      </div>
      <button
        type="button"
        onClick={onBackToAutomations}
        className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
      >
        {t("inbox.automations.missingBack")}
      </button>
    </div>
  );
}

export function AutomationsRoutePage({
  hasConnectedRemoteConnections,
  onOpenLocalEnvironmentsSettings,
  onShowToast,
  recentThreads,
  onOpenThread,
  selectedHostId,
}: AutomationsRoutePageProps) {
  const { locale, t } = useI18n();
  const [routeState, setRouteState] = useState<AutomationsRouteState>(() =>
    parseAutomationsRouteState(
      getWindowSearch(),
      typeof window === "undefined" ? null : window.history.state,
    ),
  );
  const [items, setItems] = useState<AutomationRecord[]>([]);
  const [inboxItems, setInboxItems] = useState<AutomationInboxItem[]>([]);
  const [isInboxItemsLoading, setIsInboxItemsLoading] = useState(true);
  const [createDraft, setCreateDraft] = useState<AutomationRecord | null>(null);
  const [detailDraft, setDetailDraft] = useState<AutomationRecord | null>(null);
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
  const [workspaceRootLabels, setWorkspaceRootLabels] = useState<
    Record<string, string>
  >({});
  const [workspaceRootOptions, setWorkspaceRootOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelListEntry[]>([]);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>([]);

  useEffect(() => {
    const handlePopState = () => {
      setRouteState(
        parseAutomationsRouteState(getWindowSearch(), window.history.state),
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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
  const selectedHeartbeatTargetThreadId =
    detailDraft?.kind === "heartbeat"
      ? detailDraft.targetThreadId.trim()
      : createDraft?.kind === "heartbeat"
        ? createDraft.targetThreadId.trim()
        : "";
  const occupiedHeartbeatThreadIds = useMemo(
    () =>
      new Set(
        items.flatMap((automation) => {
          if (automation.kind !== "heartbeat" || automation.status !== "ACTIVE") {
            return [];
          }

          const targetThreadId = automation.targetThreadId.trim();
          if (
            targetThreadId.length === 0 ||
            (selectedHeartbeatTargetThreadId.length > 0 &&
              targetThreadId === selectedHeartbeatTargetThreadId)
          ) {
            return [];
          }

          return [targetThreadId];
        }),
      ),
    [items, selectedHeartbeatTargetThreadId],
  );
  const heartbeatThreadOptions = useMemo(
    () =>
      buildHeartbeatThreadOptions({
        occupiedThreadIds: occupiedHeartbeatThreadIds,
        pinnedThreadIds,
        recentThreads,
        selectedThreadId: selectedHeartbeatTargetThreadId,
        threadNameById,
      }),
    [
      occupiedHeartbeatThreadIds,
      pinnedThreadIds,
      recentThreads,
      selectedHeartbeatTargetThreadId,
      threadNameById,
    ],
  );

  const sortedItems = useMemo(() => sortAutomations(items), [items]);
  const isCreateMode = routeState.automationMode === "create";
  const effectiveSelectedAutomationId = isCreateMode
    ? null
    : routeState.automationId;
  const selectedAutomation = useMemo(
    () =>
      effectiveSelectedAutomationId
        ? sortedItems.find((item) => item.id === effectiveSelectedAutomationId) ??
          null
        : null,
    [effectiveSelectedAutomationId, sortedItems],
  );
  const deleteCandidate = useMemo(
    () =>
      deleteCandidateId
        ? sortedItems.find((item) => item.id === deleteCandidateId) ?? null
        : null,
    [deleteCandidateId, sortedItems],
  );

  const isMissingSelection =
    effectiveSelectedAutomationId !== null &&
    selectedAutomation === null &&
    !isLoading;
  const isDetailVisible =
    effectiveSelectedAutomationId !== null &&
    selectedAutomation !== null &&
    detailDraft !== null;
  const activeDraft = isDetailVisible ? detailDraft : createDraft;
  const detailAutomationName =
    selectedAutomation?.name.trim() ||
    detailDraft?.name.trim() ||
    (isDetailVisible ? t("settings.automations.dialog.newTitle") : null);
  const isSaveRetryVisible =
    detailDraft !== null &&
    failedAutoSaveDraft !== null &&
    areAutomationsEqual(detailDraft, failedAutoSaveDraft);

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

  const localEnvironmentState = useAutomationLocalEnvironmentSelection({
    automation: activeDraft,
    hostId: selectedHostId,
    setAutomation: isDetailVisible ? setDetailDraft : setCreateDraft,
  });

  async function loadAutomations() {
    setIsLoading(true);
    try {
      const nextItems = await listAutomations();
      setItems(nextItems);
    } catch (error) {
      onShowToast({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadInboxItems() {
    setIsInboxItemsLoading(true);
    try {
      const nextItems = await listInboxItems();
      setInboxItems(nextItems);
    } catch (error) {
      onShowToast({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setIsInboxItemsLoading(false);
    }
  }

  const handleSetInboxItemReadState = async (id: string, isRead: boolean) => {
    const nextReadAt = isRead ? Date.now() : null;
    setInboxItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: nextReadAt } : item)),
    );

    try {
      await setInboxItemReadState(id, isRead);
    } catch (error) {
      onShowToast({
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
      void loadInboxItems();
    }
  };

  useEffect(() => {
    void loadAutomations();
    void loadInboxItems();
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const reload = () => {
      if (disposed) {
        return;
      }
      void loadInboxItems();
    };

    void onQueryCacheInvalidated((notification) => {
      if (!queryKeyMatchesPrefix(notification.queryKey, INBOX_ITEMS_QUERY_KEY)) {
        return;
      }
      reload();
    }).then((unsubscribe) => {
      if (disposed) {
        unsubscribe();
        return;
      }
      cleanup = unsubscribe;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [onShowToast]);

  useEffect(() => {
    let disposed = false;

    const reload = () => {
      void readWorkspaceRootOptions(selectedHostId)
        .then((response) => {
          if (disposed) {
            return;
          }
          setWorkspaceRootOptions(response.roots);
          setWorkspaceRootLabels(response.labels);
        })
        .catch(() => {
          if (disposed) {
            return;
          }
          setWorkspaceRootOptions([]);
          setWorkspaceRootLabels({});
        });
    };

    reload();

    let cleanup: (() => void) | null = null;
    void onWorkspaceRootOptionsUpdated(reload).then((unsubscribe) => {
      if (disposed) {
        unsubscribe();
        return;
      }
      cleanup = unsubscribe;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [selectedHostId]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const reloadPinnedThreadIds = () => {
      void getGlobalState("pinned-thread-ids")
        .then((response) => {
          if (disposed) {
            return;
          }

          setPinnedThreadIds(
            Array.isArray(response.value)
              ? response.value.filter(
                  (entry): entry is string =>
                    typeof entry === "string" && entry.trim().length > 0,
                )
              : [],
          );
        })
        .catch(() => {
          if (disposed) {
            return;
          }
          setPinnedThreadIds([]);
        });
    };

    reloadPinnedThreadIds();

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("pinned-thread-ids")) {
        return;
      }
      reloadPinnedThreadIds();
    }).then((unsubscribe) => {
      if (disposed) {
        unsubscribe();
        return;
      }
      cleanup = unsubscribe;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    void listModelsForHost({ hostId: selectedHostId })
      .then((response) => {
        if (disposed) {
          return;
        }
        setModelOptions(response.data);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setModelOptions([]);
      });

    return () => {
      disposed = true;
    };
  }, [selectedHostId]);

  useEffect(() => {
    if (!openRowMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (
        event.target.closest(`[data-automation-menu-root="${openRowMenuId}"]`)
      ) {
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
    if (!isCreateMode) {
      setCreateDraft(null);
      return;
    }

    setCreateDraft((current) => current ?? buildAutomationDraft("cron"));
    setFailedAutoSaveDraft(null);
  }, [isCreateMode]);

  useEffect(() => {
    if (!selectedAutomation) {
      setDetailDraft(null);
      setFailedAutoSaveDraft(null);
      return;
    }

    setDetailDraft((current) => {
      if (current === null || current.id !== selectedAutomation.id) {
        return copyAutomation(selectedAutomation);
      }

      return current;
    });
  }, [selectedAutomation]);

  const updateRouteState = (
    nextState: AutomationsRouteState,
    options?: { replace?: boolean },
  ) => {
    setRouteState(nextState);
    writeAutomationsRouteState(nextState, options);
  };

  const showCreate = (prefilledDraft?: CronAutomationRecord) => {
    setOpenRowMenuId(null);
    setDeleteCandidateId(null);
    if (prefilledDraft) {
      setCreateDraft(copyAutomation(prefilledDraft));
    }
    updateRouteState(
      {
        automationId: null,
        automationMode: "create",
      },
      { replace: false },
    );
  };

  const showOverview = (options?: { replace?: boolean; clearFeedback?: boolean }) => {
    setOpenRowMenuId(null);
    setDeleteCandidateId(null);
    setFailedAutoSaveDraft(null);
    setCreateDraft(null);
    setDetailDraft(null);
    updateRouteState(
      {
        automationId: null,
        automationMode: null,
      },
      { replace: options?.replace === true },
    );
  };

  const selectAutomation = (automation: AutomationRecord) => {
    setOpenRowMenuId(null);
    setDeleteCandidateId(null);
    setFailedAutoSaveDraft(null);
    setDetailDraft(copyAutomation(automation));
    updateRouteState(
      {
        automationId: automation.id,
        automationMode: null,
      },
      { replace: false },
    );
  };

  const updateDetailDraft: typeof setDetailDraft = (value) => {
    setDetailDraft(value);
  };

  const updateCreateDraft: typeof setCreateDraft = (value) => {
    setCreateDraft(value);
  };

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
      setDetailDraft((current) => {
        if (!current || current.id !== updated.id) {
          return current;
        }

        return areAutomationsEqual(current, requestDraft)
          ? copyAutomation(updated)
          : current;
      });
      setFailedAutoSaveDraft(null);
    } catch (error) {
      onShowToast({
        message: formatErrorMessage(t("inbox.automations.updateError"), error),
        tone: "error",
      });
      setFailedAutoSaveDraft(requestDraft);

      if (
        error instanceof Error &&
        error.message === AUTOMATION_UPDATE_MISSING_MESSAGE
      ) {
        setDetailDraft(null);
        setFailedAutoSaveDraft(null);
        await loadAutomations();
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
      !isDetailVisible ||
      detailDraft === null ||
      selectedAutomation === null ||
      isDetailSaving ||
      isRetrySaving ||
      !hasAutomationRequiredFields(detailDraft) ||
      areAutomationsEqual(detailDraft, selectedAutomation) ||
      (failedAutoSaveDraft !== null &&
        areAutomationsEqual(detailDraft, failedAutoSaveDraft))
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDetailDraft(detailDraft, "auto");
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    detailDraft,
    failedAutoSaveDraft,
    isDetailSaving,
    isDetailVisible,
    isRetrySaving,
    selectedAutomation,
  ]);

  const clearDetailDraft = () => {
    updateDetailDraft((current) =>
      current ? { ...current, name: "", prompt: "" } : current,
    );
  };

  const clearCreateDraft = () => {
    updateCreateDraft((current) =>
      current ? { ...current, name: "", prompt: "" } : current,
    );
  };

  const saveCreate = async () => {
    if (createDraft === null || !hasAutomationRequiredFields(createDraft)) {
      return;
    }

    setIsCreateSaving(true);
    try {
      const created = await createAutomation(createDraft);
      setCreateDraft(null);
      await loadAutomations();
      updateRouteState(
        {
          automationId: created.id,
          automationMode: null,
        },
        { replace: true },
      );
    } catch (error) {
      onShowToast({
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
      if (effectiveSelectedAutomationId === updated.id) {
        setDetailDraft(copyAutomation(updated));
      }
      setFailedAutoSaveDraft(null);
    } catch (error) {
      onShowToast({
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
        onShowToast({
          message: `${t("inbox.automations.deleteError")}: ${t(
            "inbox.automations.deleteFailedDescription",
          )}`,
          tone: "error",
        });
        return;
      }

      setDeleteCandidateId(null);
      await loadAutomations();
      if (effectiveSelectedAutomationId === deleteCandidate.id) {
        showOverview({ clearFeedback: false, replace: true });
      }
    } catch (error) {
      onShowToast({
        message: formatErrorMessage(t("inbox.automations.deleteError"), error),
        tone: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunNow = async (automation: AutomationRecord) => {
    setIsRunningNowId(automation.id);
    try {
      const result = await runAutomationNow(automation.id);
      onShowToast({
        message: t("inbox.automations.runNowSuccess"),
        tone: "info",
      });
      await onOpenThread(result.threadId);
    } catch (error) {
      onShowToast({
        message: formatErrorMessage(t("inbox.automations.runNowError"), error),
        tone: "error",
      });
    } finally {
      setIsRunningNowId(null);
    }
  };

  const detailAutomation = isDetailVisible ? selectedAutomation : null;
  const quickStartBaseDraft = useMemo(
    () => buildAutomationDraft("cron") as CronAutomationRecord,
    [],
  );

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
          onBackToAutomations={() => showOverview()}
          onCreateAutomationClick={showCreate}
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
            if (detailDraft) {
              void persistDetailDraft(detailDraft, "retry");
            }
          }}
          onRunNow={() => {
            if (detailAutomation) {
              void handleRunNow(detailAutomation);
            }
          }}
          t={t}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isDetailVisible && detailAutomation && detailDraft ? (
            <AutomationsDetailPane
              draft={detailDraft}
              feedback={null}
              hasConnectedRemoteConnections={hasConnectedRemoteConnections}
              heartbeatThreadOptions={heartbeatThreadOptions}
              inboxItems={inboxItems}
              isInboxItemsLoading={isInboxItemsLoading}
              isSaving={isDetailSaving || isRetrySaving}
              lastRunLabel={lastRunLabel}
              localEnvironmentState={localEnvironmentState}
              locale={locale}
              nextRunLabel={nextRunLabel}
              onClearDraft={clearDetailDraft}
              onDraftChange={updateDetailDraft}
              onOpenThread={onOpenThread}
              onSetInboxItemReadState={handleSetInboxItemReadState}
              onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
              threadTitleById={threadNameById}
              modelOptions={modelOptions}
              workspaceRootOptions={workspaceRootOptions}
              workspaceRootLabels={workspaceRootLabels}
              t={t}
            />
          ) : isMissingSelection ? (
            <MissingAutomationPane
              onBackToAutomations={() => showOverview({ replace: true })}
              t={t}
            />
          ) : (
            <AutomationsOverviewPane
              isLoading={isLoading}
              isRunningNowId={isRunningNowId}
              items={sortedItems}
              locale={locale}
              openRowMenuId={openRowMenuId}
              quickStartBaseDraft={quickStartBaseDraft}
              selectedId={effectiveSelectedAutomationId}
              threadNameById={threadNameById}
              workspaceRootLabels={workspaceRootLabels}
              onDeleteAutomation={(automation) => {
                setDeleteCandidateId(automation.id);
                setOpenRowMenuId(null);
              }}
              onPauseAutomation={(automation) =>
                void updateStatus(automation, "PAUSED")
              }
              onSelectQuickStart={(draft) => {
                showCreate(draft);
              }}
              onResumeAutomation={(automation) =>
                void updateStatus(automation, "ACTIVE")
              }
              onRunAutomationNow={(automation) => void handleRunNow(automation)}
              onSelectAutomation={selectAutomation}
              onToggleMenu={setOpenRowMenuId}
              t={t}
            />
          )}
        </div>
      </div>

      {isCreateMode && createDraft ? (
        <AutomationsCreateDialog
          canSave={
            createDraft !== null && hasAutomationRequiredFields(createDraft)
          }
          draft={createDraft}
          isSaving={isCreateSaving}
          heartbeatThreadOptions={heartbeatThreadOptions}
          locale={locale}
          modelOptions={modelOptions}
          quickStartBaseDraft={quickStartBaseDraft}
          localEnvironmentState={localEnvironmentState}
          onCancel={() => showOverview()}
          onClearDraft={clearCreateDraft}
          onCreate={() => void saveCreate()}
          onDraftChange={updateCreateDraft}
          onSelectTemplateDraft={(draft) => {
            setCreateDraft(copyAutomation(draft));
          }}
          onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
          workspaceRootLabels={workspaceRootLabels}
          workspaceRootOptions={workspaceRootOptions}
          t={t}
        />
      ) : null}

      {deleteCandidate ? (
        <AutomationDeleteConfirmDialog
          isDeleting={isDeleting}
          name={deleteCandidate.name.trim()}
          fallbackName={t("settings.automations.dialog.newTitle")}
          titleTemplate={t("inbox.automations.deleteConfirm.title", {
            name: "{{__NAME__}}",
          })}
          description={t("inbox.automations.deleteConfirm.description")}
          cancelLabel={t("inbox.automations.deleteConfirm.cancel")}
          confirmLabel={t("inbox.automations.deleteConfirm.confirm")}
          savingLabel={t("general.saving")}
          onCancel={() => setDeleteCandidateId(null)}
          onConfirm={() => void removeSelected()}
        />
      ) : null}
    </>
  );
}

function AutomationDeleteConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  fallbackName,
  isDeleting,
  name,
  onCancel,
  onConfirm,
  savingLabel,
  titleTemplate,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  fallbackName: string;
  isDeleting: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  savingLabel: string;
  titleTemplate: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedRef = useRef<HTMLElement | null>(null);
  const displayName = name.length > 0 ? name : fallbackName;
  const titleParts = titleTemplate.split("{{__NAME__}}");

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    previousFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();

    return () => {
      previousFocusedRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialogElement = dialogRef.current;
      if (dialogElement == null) {
        return;
      }
      const focusable = Array.from(
        dialogElement.querySelectorAll<HTMLElement>(
          "button:not([disabled]),[tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.24)]"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="automation-delete-confirm-title"
        aria-describedby="automation-delete-confirm-description"
        className="app-card relative z-10 w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
      >
        <div id="automation-delete-confirm-title" className="app-title text-[15px] font-medium">
          {titleParts[0]}
          <strong className="font-semibold">{displayName}</strong>
          {titleParts[1] ?? ""}
        </div>
        <div
          id="automation-delete-confirm-description"
          className="app-text-muted mt-2 text-[13px] leading-6"
        >
          {description}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
          >
            {isDeleting ? savingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
