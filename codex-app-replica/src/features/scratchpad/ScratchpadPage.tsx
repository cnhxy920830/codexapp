import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircleFilledIcon,
  FollowUpIcon,
  UnselectedCircleIcon,
  XCircleIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { Tooltip } from "../../components/Tooltip";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import {
  type ThreadConversation,
  type ThreadConversationItem,
  type ThreadConversationTurn,
  type ThreadConversationTurnTiming,
  type ThreadConversationUserInput,
  type ThreadEvent,
  maybeResumeConversation,
  onThreadEvent,
  readThread,
  startConversation,
  startTurnWithInput,
} from "../../services/history";
import { onAppsSnapshotUpdated, readAppsSnapshot, type AppInfo } from "../../services/apps";
import { readProjectlessThreadCwd } from "../../services/projectlessThreads";
import { generateScratchpadCompletionSummary } from "../../services/scratchpad";
import { readPluginsSnapshot, type PluginSummary } from "../../services/plugins";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import { ThreadPageHeader } from "../chat/ThreadPageHeader";
import { ScratchpadPromptContent } from "./ScratchpadPromptContent";
import { ScratchpadPromptInput } from "./ScratchpadPromptInput";
import type { RowSummaryState, ScratchpadRow, ThreadRuntimeState } from "./scratchpadTypes";

const INITIAL_ROW_ID = "scratchpad-0";
const SCRATCHPAD_HOST_ID = LOCAL_SETTINGS_HOST_ID;

export function ScratchpadPage({
  onOpenConversation,
  onRegisterHeaderContent,
  onShowToast,
}: {
  onOpenConversation?: (conversationId: string) => void;
  onRegisterHeaderContent?: (content: ReactNode | null) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<ScratchpadRow[]>([
    {
      id: INITIAL_ROW_ID,
      state: "draft",
      text: "",
      isIndented: false,
      conversationId: null,
      turnId: null,
      parentRowId: null,
      createdAtMs: null,
      error: null,
    },
  ]);
  const [threadConversationsById, setThreadConversationsById] = useState<Record<string, ThreadConversation>>({});
  const [threadRuntimeById, setThreadRuntimeById] = useState<Record<string, ThreadRuntimeState>>({});
  const [summaryByRowId, setSummaryByRowId] = useState<Record<string, RowSummaryState>>({});
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);

  const rowsRef = useRef(rows);
  const threadConversationsByIdRef = useRef(threadConversationsById);
  const drainingConversationIdsRef = useRef(new Set<string>());
  const summaryRequestsRef = useRef(new Set<string>());
  const nextRowNumberRef = useRef(1);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    threadConversationsByIdRef.current = threadConversationsById;
  }, [threadConversationsById]);

  const connectedConversationIds = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.conversationId)
          .filter((conversationId): conversationId is string => typeof conversationId === "string" && conversationId.length > 0),
      ),
    );
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    const loadThreads = async () => {
      await Promise.all(
        connectedConversationIds.map(async (conversationId) => {
          if (threadConversationsByIdRef.current[conversationId]) {
            return;
          }
          try {
            const thread = await readThread(conversationId);
            if (cancelled) {
              return;
            }
            setThreadConversationsById((current) => ({
              ...current,
              [conversationId]: thread,
            }));
          } catch {
            // Ignore failed background hydration. Started rows can still recover on future events.
          }
        }),
      );
    };

    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, [connectedConversationIds]);

  useEffect(() => {
    let cancelled = false;
    let disposeAppsUpdated: (() => void) | undefined;

    const loadPageData = async () => {
      const [nextApps, nextPlugins, nextSkills] = await Promise.all([
        readAppsSnapshot({ hostId: SCRATCHPAD_HOST_ID }).then((response) => response.data).catch(() => []),
        readPluginsSnapshot(null, SCRATCHPAD_HOST_ID)
          .then((response) => response.marketplaces.flatMap((marketplace) => marketplace.plugins))
          .catch(() => []),
        readSkillsSnapshot(null, { hostId: SCRATCHPAD_HOST_ID }).catch(() => []),
      ]);

      if (cancelled) {
        return;
      }
      setApps(nextApps);
      setPlugins(nextPlugins);
      setSkills(nextSkills);
    };

    void loadPageData();

    void onAppsSnapshotUpdated((snapshot) => {
      if (cancelled) {
        return;
      }
      setApps(snapshot.data);
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      disposeAppsUpdated = dispose;
    });

    return () => {
      cancelled = true;
      disposeAppsUpdated?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void onThreadEvent((event) => {
      void handleThreadEvent(event);
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    void drainQueuedFollowUps();
  }, [rows, threadConversationsById, threadRuntimeById]);

  useEffect(() => {
    for (const row of rows) {
      if (row.state !== "started" || row.conversationId === null || row.turnId === null) {
        continue;
      }

      const thread = threadConversationsById[row.conversationId];
      if (!thread) {
        continue;
      }

      const finalAssistantMessage = findFinalAssistantMessage(thread.items, row.turnId);
      if (!finalAssistantMessage) {
        continue;
      }

      const existingSummary = summaryByRowId[row.id];
      if (existingSummary?.message === finalAssistantMessage) {
        continue;
      }
      if (summaryRequestsRef.current.has(row.id)) {
        continue;
      }

      summaryRequestsRef.current.add(row.id);
      setSummaryByRowId((current) => ({
        ...current,
        [row.id]: {
          status: "loading",
          message: finalAssistantMessage,
          summary: null,
        },
      }));

      void generateScratchpadCompletionSummary({
        message: finalAssistantMessage,
        cwd: thread.cwd,
      })
        .then((response) => {
          const nextSummary = response.summary;
          setSummaryByRowId((current) => ({
            ...current,
            [row.id]:
              nextSummary == null
                ? {
                    status: "error",
                    message: finalAssistantMessage,
                    summary: null,
                  }
                : {
                    status: "ready",
                    message: finalAssistantMessage,
                    summary: nextSummary,
                  },
          }));
        })
        .catch(() => {
          setSummaryByRowId((current) => ({
            ...current,
            [row.id]: {
              status: "error",
              message: finalAssistantMessage,
              summary: null,
            },
          }));
        })
        .finally(() => {
          summaryRequestsRef.current.delete(row.id);
        });
    }
  }, [rows, summaryByRowId, threadConversationsById]);

  const clearRows = useEffectEvent(() => {
    drainingConversationIdsRef.current.clear();
    summaryRequestsRef.current.clear();
    nextRowNumberRef.current = 1;
    setThreadConversationsById({});
    setThreadRuntimeById({});
    setSummaryByRowId({});
    setRows([createDraftRow(INITIAL_ROW_ID)]);
  });

  const headerContent = useMemo(
    () => (
      <div className="draggable grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2">
        <ThreadPageHeader
          compact
          environmentType={null}
          secondaryText={t("scratchpadPage.headerSubtitle")}
          start={t("scratchpadPage.headerTitle")}
          trailingActions={
            <Button color="ghost" size="toolbar" onClick={() => clearRows()}>
              {t("scratchpadPage.clearButton")}
            </Button>
          }
        />
      </div>
    ),
    [clearRows, t],
  );

  useEffect(() => {
    onRegisterHeaderContent?.(headerContent);
    return () => {
      onRegisterHeaderContent?.(null);
    };
  }, [headerContent, onRegisterHeaderContent]);

  const handleDraftChange = (rowId: string, text: string) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId && row.state === "draft" ? { ...row, text } : row)),
    );
  };

  const handleDraftIndent = (rowId: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && row.state === "draft" && !row.isIndented ? { ...row, isIndented: true } : row,
      ),
    );
  };

  const handleDraftOutdent = (rowId: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && row.state === "draft" && row.isIndented ? { ...row, isIndented: false } : row,
      ),
    );
  };

  const handleDraftSubmit = async (rowId: string) => {
    const row = rowsRef.current.find((entry) => entry.id === rowId);
    if (!row || row.state !== "draft") {
      return;
    }

    const text = row.text.trim();
    if (text.length === 0) {
      return;
    }

    if (row.isIndented) {
      const followUpTarget = findFollowUpTarget(rowsRef.current, rowId);
      if (!followUpTarget) {
        setRows((current) =>
          current.map((entry) =>
            entry.id === rowId
              ? {
                  ...entry,
                  state: "error",
                  error: t("scratchpadPage.createError"),
                  text,
                }
              : entry,
          ),
        );
        onShowToast?.({
          tone: "error",
          message: t("scratchpadPage.createError"),
        });
        return;
      }

      const nextDraftId = createNextRowId();
      setRows((current) =>
        current.flatMap((entry) => {
          if (entry.id !== rowId) {
            return [entry];
          }
          return [
            {
              ...entry,
              state: "queued_follow_up",
              text,
              error: null,
              conversationId: followUpTarget.conversationId,
              parentRowId: followUpTarget.rowId,
            },
            createDraftRow(nextDraftId),
          ];
        }),
      );
      return;
    }

    setRows((current) =>
      current.map((entry) =>
        entry.id === rowId
          ? {
              ...entry,
              state: "starting",
              text,
              error: null,
            }
          : entry,
      ),
    );

    try {
      const projectlessThread = await readProjectlessThreadCwd({
        prompt: text,
      });
      const conversationId = await startConversation({
        hostId: SCRATCHPAD_HOST_ID,
        input: [createTextInput(text)],
        cwd: projectlessThread.cwd,
        workspaceRoots: [projectlessThread.workspaceRoot],
        collaborationMode: null,
        projectlessOutputDirectory: projectlessThread.outputDirectory,
        workspaceKind: "projectless",
        approvalsReviewer: "user",
      });
      const thread = await readThread(conversationId);
      const currentTurn = thread.turns.at(-1) ?? null;
      const nextDraftId = createNextRowId();

      setThreadConversationsById((current) => ({
        ...current,
        [conversationId]: thread,
      }));
      setRows((current) =>
        current.flatMap((entry) => {
          if (entry.id !== rowId) {
            return [entry];
          }
          return [
            {
              ...entry,
              state: "started",
              text,
              conversationId,
              turnId: currentTurn?.id ?? null,
              createdAtMs: resolveTurnTimestamp(thread.turnTimings, currentTurn?.id ?? null) ?? Date.now(),
              error: null,
            },
            createDraftRow(nextDraftId),
          ];
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("scratchpadPage.createError");
      setRows((current) =>
        current.map((entry) =>
          entry.id === rowId
            ? {
                ...entry,
                state: "error",
                error: message,
                text,
              }
            : entry,
        ),
      );
      onShowToast?.({
        tone: "error",
        message: t("scratchpadPage.createError"),
        description: message,
      });
    }
  };

  const defaultDraftPlaceholder = t(
    rows.some((row) => row.state !== "draft")
    ? "scratchpadPage.inputPlaceholder.followUpHint"
    : "scratchpadPage.inputPlaceholder.initial",
  );
  const followUpDraftPlaceholder = t("scratchpadPage.inputPlaceholder.followUp");
  const focusedDraftRowId = rows.find((row) => row.state === "draft")?.id ?? null;

  return (
    <ScratchpadPagePreview
      apps={apps}
      defaultDraftPlaceholder={defaultDraftPlaceholder}
      followUpDraftPlaceholder={followUpDraftPlaceholder}
      focusedDraftRowId={focusedDraftRowId}
      hostId={SCRATCHPAD_HOST_ID}
      onDraftChange={handleDraftChange}
      onDraftIndent={handleDraftIndent}
      onDraftOutdent={handleDraftOutdent}
      onDraftSubmit={handleDraftSubmit}
      onOpenConversation={onOpenConversation}
      plugins={plugins}
      rows={rows}
      skills={skills}
      summaryByRowId={summaryByRowId}
      t={t}
      threadConversationsById={threadConversationsById}
      threadRuntimeById={threadRuntimeById}
    />
  );

  async function handleThreadEvent(event: ThreadEvent) {
    if ("threadId" in event) {
      const conversationId = event.threadId;
      if (!rowsRef.current.some((row) => row.conversationId === conversationId)) {
        return;
      }
    }

    if (event.type === "turnCompleted") {
      try {
        const thread = await readThread(event.threadId);
        setThreadConversationsById((current) => ({
          ...current,
          [event.threadId]: thread,
        }));
      } catch {
        // Ignore refresh failures and keep the last known thread snapshot.
      }
      clearRuntimeTurn(event.threadId, event.turnId);
      await drainQueuedFollowUps();
      return;
    }

    if (event.type === "threadItemUpdated") {
      setThreadConversationsById((current) => {
        const existingThread = current[event.threadId];
        if (!existingThread) {
          return current;
        }
        const nextThread = patchThreadWithItemEvent(existingThread, event);
        return nextThread === existingThread
          ? current
          : {
              ...current,
              [event.threadId]: nextThread,
            };
      });
      return;
    }

    if (
      event.type === "commandApprovalRequested" ||
      event.type === "fileChangeApprovalRequested" ||
      event.type === "permissionsRequestApprovalRequested"
    ) {
      setThreadRuntimeById((current) => {
        const next = cloneRuntimeState(current[event.threadId]);
        next.pendingApprovalTurnIds.add(event.turnId);
        return {
          ...current,
          [event.threadId]: next,
        };
      });
      return;
    }

    if (event.type === "toolRequestUserInputRequested") {
      setThreadRuntimeById((current) => {
        const next = cloneRuntimeState(current[event.threadId]);
        next.pendingUserInputTurnIds.add(event.turnId);
        return {
          ...current,
          [event.threadId]: next,
        };
      });
      return;
    }

    if (event.type === "serverRequestResolved") {
      setThreadRuntimeById((current) => {
        const conversationId = event.threadId;
        const thread = threadConversationsByIdRef.current[conversationId];
        const next = cloneRuntimeState(current[conversationId]);
        if (thread) {
          next.pendingApprovalTurnIds = new Set(
            Array.from(next.pendingApprovalTurnIds).filter((turnId) => hasPendingApproval(thread.items, turnId)),
          );
          next.pendingUserInputTurnIds = new Set(
            Array.from(next.pendingUserInputTurnIds).filter((turnId) => hasPendingUserInput(thread.items, turnId)),
          );
        } else {
          next.pendingApprovalTurnIds.clear();
          next.pendingUserInputTurnIds.clear();
        }
        return {
          ...current,
          [conversationId]: next,
        };
      });
    }
  }

  async function drainQueuedFollowUps() {
    const queuedRows = rowsRef.current.filter((row) => row.state === "queued_follow_up");
    for (const row of queuedRows) {
      if (!row.conversationId || drainingConversationIdsRef.current.has(row.conversationId)) {
        continue;
      }
      const thread = threadConversationsByIdRef.current[row.conversationId];
      if (!thread || isThreadBusy(thread, threadRuntimeById[row.conversationId] ?? null)) {
        continue;
      }

      drainingConversationIdsRef.current.add(row.conversationId);

      try {
        const resumedThread = await maybeResumeConversation({
          conversationId: row.conversationId,
          hostId: SCRATCHPAD_HOST_ID,
          workspaceRoots:
            thread.cwd && thread.cwd.trim().length > 0
              ? [thread.cwd]
              : [],
        });
        setThreadConversationsById((current) => ({
          ...current,
          [row.conversationId as string]: resumedThread,
        }));

        if (isThreadBusy(resumedThread, threadRuntimeById[row.conversationId] ?? null)) {
          continue;
        }

        setRows((current) =>
          current.map((entry) =>
            entry.id === row.id
              ? {
                  ...entry,
                  state: "sending_follow_up",
                }
              : entry,
          ),
        );

        const turnId = await startTurnWithInput({
          threadId: row.conversationId,
          input: [createTextInput(row.text)],
          cwd: resumedThread.cwd ?? null,
        });
        setRows((current) =>
          current.map((entry) =>
            entry.id === row.id
              ? {
                  ...entry,
                  state: "started",
                  turnId,
                  createdAtMs: Date.now(),
                  error: null,
                }
              : entry,
          ),
        );
        setThreadConversationsById((current) => ({
          ...current,
          [row.conversationId as string]: upsertTurnTiming(
            current[row.conversationId as string] ?? resumedThread,
            turnId,
            {
              status: "in_progress",
              turnStartedAtMs: Date.now(),
            },
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("scratchpadPage.createError");
        setRows((current) =>
          current.map((entry) =>
            entry.id === row.id
              ? {
                  ...entry,
                  state: "error",
                  error: message,
                }
              : entry,
          ),
        );
        onShowToast?.({
          tone: "error",
          message: t("scratchpadPage.createError"),
          description: message,
        });
      } finally {
        drainingConversationIdsRef.current.delete(row.conversationId);
      }
    }
  }

  function clearRuntimeTurn(conversationId: string, turnId: string) {
    setThreadRuntimeById((current) => {
      const next = cloneRuntimeState(current[conversationId]);
      next.pendingApprovalTurnIds.delete(turnId);
      next.pendingUserInputTurnIds.delete(turnId);
      return {
        ...current,
        [conversationId]: next,
      };
    });
  }

  function createNextRowId() {
    const rowId = `scratchpad-${nextRowNumberRef.current}`;
    nextRowNumberRef.current += 1;
    return rowId;
  }
}

type ScratchpadPagePreviewProps = {
  apps?: AppInfo[];
  defaultDraftPlaceholder?: string;
  followUpDraftPlaceholder?: string;
  focusedDraftRowId?: string | null;
  hostId?: string | null;
  onDraftChange?: (rowId: string, text: string) => void;
  onDraftIndent?: (rowId: string) => void;
  onDraftOutdent?: (rowId: string) => void;
  onDraftSubmit?: (rowId: string) => void | Promise<void>;
  onOpenConversation?: (conversationId: string) => void;
  plugins?: PluginSummary[];
  rows: ScratchpadRow[];
  skills?: SkillSummary[];
  summaryByRowId?: Record<string, RowSummaryState>;
  t: ReturnType<typeof useI18n>["t"];
  threadConversationsById?: Record<string, ThreadConversation>;
  threadRuntimeById?: Record<string, ThreadRuntimeState>;
};

export function ScratchpadPagePreview({
  apps = [],
  defaultDraftPlaceholder,
  followUpDraftPlaceholder,
  focusedDraftRowId = null,
  hostId = SCRATCHPAD_HOST_ID,
  onDraftChange,
  onDraftIndent,
  onDraftOutdent,
  onDraftSubmit,
  onOpenConversation,
  plugins = [],
  rows,
  skills = [],
  summaryByRowId = {},
  t,
  threadConversationsById = {},
  threadRuntimeById = {},
}: ScratchpadPagePreviewProps) {
  const resolvedDefaultDraftPlaceholder =
    defaultDraftPlaceholder ??
    t(
      rows.some((row) => row.state !== "draft")
        ? "scratchpadPage.inputPlaceholder.followUpHint"
        : "scratchpadPage.inputPlaceholder.initial",
    );
  const resolvedFollowUpDraftPlaceholder =
    followUpDraftPlaceholder ?? t("scratchpadPage.inputPlaceholder.followUp");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[var(--thread-composer-max-width)] flex-1 overflow-x-visible overflow-y-auto pt-panel pr-panel pb-panel pl-20">
        <div className="flex w-full flex-col">
          {rows.map((row) => (
            <ScratchpadRowItem
              key={row.id}
              apps={apps}
              hostId={hostId}
              isFocused={focusedDraftRowId === row.id}
              onDraftChange={(rowId, text) => onDraftChange?.(rowId, text)}
              onDraftIndent={(rowId) => onDraftIndent?.(rowId)}
              onDraftOutdent={(rowId) => onDraftOutdent?.(rowId)}
              onDraftSubmit={(rowId) => onDraftSubmit?.(rowId)}
              onOpenConversation={onOpenConversation}
              placeholder={
                row.isIndented && row.state === "draft"
                  ? resolvedFollowUpDraftPlaceholder
                  : resolvedDefaultDraftPlaceholder
              }
              plugins={plugins}
              row={row}
              runtime={row.conversationId ? threadRuntimeById[row.conversationId] ?? null : null}
              skills={skills}
              summaryState={summaryByRowId[row.id] ?? null}
              t={t}
              thread={row.conversationId ? threadConversationsById[row.conversationId] ?? null : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScratchpadRowItem({
  row,
  thread,
  runtime,
  summaryState,
  hostId,
  isFocused,
  placeholder,
  apps,
  plugins,
  skills,
  onDraftChange,
  onDraftIndent,
  onDraftOutdent,
  onDraftSubmit,
  onOpenConversation,
  t,
}: {
  row: ScratchpadRow;
  thread: ThreadConversation | null;
  runtime: ThreadRuntimeState | null;
  summaryState: RowSummaryState | null;
  hostId: string | null;
  isFocused: boolean;
  placeholder: string;
  apps: AppInfo[];
  plugins: PluginSummary[];
  skills: SkillSummary[];
  onDraftChange: (rowId: string, text: string) => void;
  onDraftIndent: (rowId: string) => void;
  onDraftOutdent: (rowId: string) => void;
  onDraftSubmit: (rowId: string) => void | Promise<void>;
  onOpenConversation?: (conversationId: string) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const derived = deriveRowPresentation(row, thread, runtime, summaryState, t);
  const indentClass = row.isIndented ? "ml-6" : "";

  return (
    <div className="group relative flex w-full items-start gap-2">
      {derived.timestampMs === null ? null : (
        <div
          aria-hidden="true"
          className="invisible absolute top-0 left-[-4.5rem] flex h-full w-[4rem] items-start justify-end pt-1.5 pr-2 text-base text-token-description-foreground opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100"
        >
          {formatHoverTimestamp(derived.timestampMs)}
        </div>
      )}
      <div className={["flex min-w-0 flex-1 items-start gap-2", indentClass].filter(Boolean).join(" ")}>
        <div className="flex shrink-0 pt-1.5">{derived.icon}</div>
        {row.state === "draft" ? (
          <ScratchpadPromptInput
            ariaLabel={placeholder}
            autoFocus={isFocused}
            hostId={SCRATCHPAD_HOST_ID}
            isIndented={row.isIndented}
            value={row.text}
            placeholder={placeholder}
            onChange={(nextValue) => onDraftChange(row.id, nextValue)}
            onIndent={() => onDraftIndent(row.id)}
            onOutdent={() => onDraftOutdent(row.id)}
            onSubmit={() => onDraftSubmit(row.id)}
            apps={apps}
            skills={skills}
            t={t}
          />
        ) : (
          <div className="inline-flex max-w-full min-w-0 items-baseline gap-2 py-1.5">
            <ScratchpadPromptRowText
              apps={apps}
              conversationId={row.state === "started" && !row.isIndented ? row.conversationId : null}
              hostId={hostId}
              onOpenConversation={onOpenConversation}
              plugins={plugins}
              skills={skills}
              text={row.text}
              t={t}
            />
            {derived.trailingContent}
          </div>
        )}
      </div>
    </div>
  );
}

function deriveRowPresentation(
  row: ScratchpadRow,
  thread: ThreadConversation | null,
  runtime: ThreadRuntimeState | null,
  summaryState: RowSummaryState | null,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (row.state === "draft") {
    return {
      icon: row.isIndented ? (
        <FollowUpIcon className="icon-sm shrink-0 text-token-input-placeholder-foreground/70" />
      ) : (
        <UnselectedCircleIcon className="icon-sm shrink-0 text-token-description-foreground" />
      ),
      timestampMs: null,
      trailingContent: null,
    };
  }

  if (row.state === "starting" || row.state === "sending_follow_up") {
    return {
      icon: <Spinner className="icon-sm shrink-0 text-token-description-foreground" />,
      timestampMs: null,
      trailingContent: <ThinkingLabel label={t("thinkingShimmer.default")} />,
    };
  }

  if (row.state === "queued_follow_up") {
    return {
      icon: <FollowUpIcon className="icon-sm shrink-0 text-token-input-placeholder-foreground/70" />,
      timestampMs: null,
      trailingContent: null,
    };
  }

  if (row.state === "error") {
    return {
      icon: <XCircleIcon className="icon-sm shrink-0 text-token-error-foreground" />,
      timestampMs: null,
      trailingContent: null,
    };
  }

  const timing = findTurnTiming(thread?.turnTimings ?? [], row.turnId);
  const timestampMs = timing?.turnStartedAtMs ?? row.createdAtMs ?? null;
  const turnStatus = normalizeTurnStatus(timing?.status ?? findTurn(thread?.turns ?? [], row.turnId)?.status ?? null);
  const hasPendingApproval = row.turnId ? runtime?.pendingApprovalTurnIds.has(row.turnId) === true : false;
  const hasPendingUserInput = row.turnId ? runtime?.pendingUserInputTurnIds.has(row.turnId) === true : false;
  const finalAssistantMessage = row.turnId ? findFinalAssistantMessage(thread?.items ?? [], row.turnId) : null;
  const reasoningFallback = row.turnId ? findReasoningFallback(thread?.items ?? [], row.turnId) : null;

  let icon = <Spinner className="icon-sm shrink-0 text-token-description-foreground" />;
  if (turnStatus === "completed") {
    icon = <CheckCircleFilledIcon className="icon-sm shrink-0 text-token-success-foreground" />;
  } else if (turnStatus === "failed" || turnStatus === "interrupted") {
    icon = <XCircleIcon className="icon-sm shrink-0 text-token-error-foreground" />;
  }

  let trailingContent = null;
  if (turnStatus !== "failed" && turnStatus !== "interrupted") {
    if (hasPendingApproval) {
      trailingContent = <StatusChip label={t("codex.localTaskRow.awaitingApproval")} tone="approval" />;
    } else if (hasPendingUserInput) {
      trailingContent = <ThinkingLabel label={t("codex.localTaskRow.awaitingResponse")} />;
    } else if (turnStatus === "completed") {
      if (finalAssistantMessage && summaryState?.status === "loading" && summaryState.message === finalAssistantMessage) {
        trailingContent = <ThinkingLabel label={t("scratchpadPage.summaryLoading")} />;
      } else if (
        finalAssistantMessage &&
        summaryState?.status === "ready" &&
        summaryState.message === finalAssistantMessage &&
        summaryState.summary
      ) {
        trailingContent = <TrailingSummaryLabel label={summaryState.summary} />;
      } else if (reasoningFallback) {
        trailingContent = <TrailingSummaryLabel label={reasoningFallback} />;
      }
    } else {
      const progressLabel = row.turnId ? findReasoningProgressLabel(thread?.items ?? [], row.turnId) : null;
      trailingContent = <ThinkingLabel label={progressLabel ?? t("thinkingShimmer.default")} />;
    }
  }

  return {
    icon,
    timestampMs,
    trailingContent,
  };
}

function ScratchpadPromptRowText({
  apps,
  conversationId,
  hostId,
  onOpenConversation,
  plugins,
  skills,
  text,
  t,
}: {
  apps: AppInfo[];
  conversationId: string | null;
  hostId: string | null;
  onOpenConversation?: (conversationId: string) => void;
  plugins: PluginSummary[];
  skills: SkillSummary[];
  text: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const textRef = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (element == null) {
      return;
    }

    const updateTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    updateTruncation();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateTruncation();
    });
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  if (conversationId) {
    const button = (
      <button
        ref={(element) => {
          textRef.current = element;
        }}
        type="button"
        className="min-w-0 cursor-interaction truncate text-left text-base text-token-foreground hover:underline"
        onClick={() => onOpenConversation?.(conversationId)}
      >
        <ScratchpadPromptContent apps={apps} hostId={hostId} plugins={plugins} skills={skills} text={text} t={t} />
      </button>
    );

    return (
      <Tooltip align="start" disabled={!isTruncated} side="top" tooltipContent={text}>
        {button}
      </Tooltip>
    );
  }

  const content = (
    <div
      ref={(element) => {
        textRef.current = element;
      }}
      className="min-w-0 truncate text-base text-token-foreground"
    >
      <ScratchpadPromptContent apps={apps} hostId={hostId} plugins={plugins} skills={skills} text={text} t={t} />
    </div>
  );

  return (
    <Tooltip align="start" disabled={!isTruncated} side="top" tooltipContent={text}>
      {content}
    </Tooltip>
  );
}

function createDraftRow(id: string): ScratchpadRow {
  return {
    id,
    state: "draft",
    text: "",
    isIndented: false,
    conversationId: null,
    turnId: null,
    parentRowId: null,
    createdAtMs: null,
    error: null,
  };
}

function createTextInput(text: string): ThreadConversationUserInput {
  return {
    type: "text",
    text,
    textElements: [],
  };
}

function findFollowUpTarget(rows: ScratchpadRow[], rowId: string) {
  const rowIndex = rows.findIndex((row) => row.id === rowId);
  if (rowIndex <= 0) {
    return null;
  }
  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (
      (row.state === "started" ||
        row.state === "queued_follow_up" ||
        row.state === "sending_follow_up" ||
        row.state === "error") &&
      row.conversationId
    ) {
      return {
        conversationId: row.conversationId,
        rowId: row.id,
      };
    }
  }
  return null;
}

function patchThreadWithItemEvent(
  thread: ThreadConversation,
  event: Extract<ThreadEvent, { type: "threadItemUpdated" }>,
) {
  const nextItems =
    event.phase === "started"
      ? upsertOrReplaceConversationItem(thread.items, event.item)
      : upsertOrReplaceConversationItem(thread.items, event.item);

  if (nextItems === thread.items) {
    return thread;
  }

  const now = Date.now();
  let nextThread = {
    ...thread,
    items: nextItems,
  };

  if (event.phase === "started" && event.item.type === "agentMessage") {
    nextThread = upsertTurnTiming(nextThread, event.turnId, {
      finalAssistantStartedAtMs:
        nextThread.turnTimings.find((entry) => entry.turnId === event.turnId)?.finalAssistantStartedAtMs ?? now,
    });
  }
  if ((event.phase === "started" || event.phase === "completed") && isWorkStartedConversationItem(event.item)) {
    const currentTiming = nextThread.turnTimings.find((entry) => entry.turnId === event.turnId);
    if (currentTiming?.firstTurnWorkItemStartedAtMs === null || currentTiming === undefined) {
      nextThread = upsertTurnTiming(nextThread, event.turnId, {
        firstTurnWorkItemStartedAtMs: now,
        ...(currentTiming === undefined ? { status: "completed" } : {}),
      });
    }
  }

  return nextThread;
}

function upsertOrReplaceConversationItem(items: ThreadConversationItem[], item: ThreadConversationItem) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index < 0) {
    return [...items, item];
  }
  if (items[index] === item) {
    return items;
  }
  const nextItems = items.slice();
  nextItems[index] = item;
  return nextItems;
}

function upsertTurnTiming(
  thread: ThreadConversation,
  turnId: string,
  update: Partial<ThreadConversationTurnTiming>,
) {
  const existingIndex = thread.turnTimings.findIndex((entry) => entry.turnId === turnId);
  if (existingIndex < 0) {
    return {
      ...thread,
      turnTimings: [
        ...thread.turnTimings,
        {
          turnId,
          status: update.status ?? "completed",
          turnStartedAtMs: update.turnStartedAtMs ?? null,
          finalAssistantStartedAtMs: update.finalAssistantStartedAtMs ?? null,
          firstTurnWorkItemStartedAtMs: update.firstTurnWorkItemStartedAtMs ?? null,
        },
      ],
    };
  }

  const existing = thread.turnTimings[existingIndex];
  const nextEntry: ThreadConversationTurnTiming = {
    ...existing,
    ...update,
    turnId,
  };
  if (shallowEqualTurnTiming(existing, nextEntry)) {
    return thread;
  }
  const nextTurnTimings = thread.turnTimings.slice();
  nextTurnTimings[existingIndex] = nextEntry;
  return {
    ...thread,
    turnTimings: nextTurnTimings,
  };
}

function shallowEqualTurnTiming(left: ThreadConversationTurnTiming, right: ThreadConversationTurnTiming) {
  return (
    left.turnId === right.turnId &&
    left.status === right.status &&
    left.turnStartedAtMs === right.turnStartedAtMs &&
    left.finalAssistantStartedAtMs === right.finalAssistantStartedAtMs &&
    left.firstTurnWorkItemStartedAtMs === right.firstTurnWorkItemStartedAtMs
  );
}

function findTurnTiming(turnTimings: ThreadConversationTurnTiming[], turnId: string | null) {
  if (turnId === null) {
    return turnTimings.at(-1) ?? null;
  }
  return turnTimings.find((entry) => entry.turnId === turnId) ?? turnTimings.at(-1) ?? null;
}

function findTurn(turns: ThreadConversationTurn[], turnId: string | null) {
  if (turnId === null) {
    return turns.at(-1) ?? null;
  }
  return turns.find((turn) => turn.id === turnId) ?? turns.at(-1) ?? null;
}

function resolveTurnTimestamp(turnTimings: ThreadConversationTurnTiming[], turnId: string | null) {
  return findTurnTiming(turnTimings, turnId)?.turnStartedAtMs ?? null;
}

function normalizeTurnStatus(status: string | null) {
  if (status === "inProgress" || status === "in_progress") {
    return "inProgress" as const;
  }
  if (status === "failed") {
    return "failed" as const;
  }
  if (status === "interrupted") {
    return "interrupted" as const;
  }
  if (status === "completed") {
    return "completed" as const;
  }
  return "inProgress" as const;
}

function isThreadBusy(thread: ThreadConversation, runtime: ThreadRuntimeState | null) {
  const lastTurn = thread.turns.at(-1) ?? null;
  if (!lastTurn) {
    return false;
  }
  const turnStatus = normalizeTurnStatus(
    findTurnTiming(thread.turnTimings, lastTurn.id)?.status ?? lastTurn.status ?? null,
  );
  if (turnStatus === "inProgress") {
    return true;
  }
  if (runtime?.pendingApprovalTurnIds.has(lastTurn.id) || runtime?.pendingUserInputTurnIds.has(lastTurn.id)) {
    return true;
  }
  return false;
}

function findFinalAssistantMessage(items: ThreadConversationItem[], turnId: string) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.turnId !== turnId) {
      continue;
    }
    if (item.type === "agentMessage") {
      const text = item.text.trim();
      if (text.length > 0 && item.completed) {
        return text;
      }
    }
  }
  return null;
}

function findReasoningProgressLabel(items: ThreadConversationItem[], turnId: string) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.turnId !== turnId) {
      continue;
    }
    if (item.type === "reasoning") {
      const line = firstNonEmptyLine(item.content);
      if (line) {
        return line;
      }
    }
  }
  return null;
}

function findReasoningFallback(items: ThreadConversationItem[], turnId: string) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.turnId !== turnId) {
      continue;
    }
    if (item.type === "reasoning") {
      const line = firstNonEmptyLine(item.content);
      if (line) {
        return stripSurroundingBold(line);
      }
    }
  }
  return null;
}

function firstNonEmptyLine(lines: string[]) {
  return lines
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? null;
}

function stripSurroundingBold(value: string) {
  return value.replace(/^\*\*(.*?)\*\*$/u, "$1").trim();
}

function hasPendingApproval(items: ThreadConversationItem[], turnId: string) {
  return items.some((item) => {
    if (item.turnId !== turnId) {
      return false;
    }
    if (item.type === "permissionRequest") {
      return item.completed !== true;
    }
    return false;
  });
}

function hasPendingUserInput(items: ThreadConversationItem[], turnId: string) {
  return items.some((item) => item.turnId === turnId && item.type === "userInput" && item.completed !== true);
}

function cloneRuntimeState(runtime: ThreadRuntimeState | undefined): ThreadRuntimeState {
  return {
    pendingApprovalTurnIds: new Set(runtime?.pendingApprovalTurnIds ?? []),
    pendingUserInputTurnIds: new Set(runtime?.pendingUserInputTurnIds ?? []),
  };
}

function isWorkStartedConversationItem(item: ThreadConversationItem) {
  return (
    item.type === "reasoning" ||
    item.type === "commandExecution" ||
    item.type === "fileChange" ||
    item.type === "hook" ||
    item.type === "workedFor" ||
    item.type === "plan" ||
    item.type === "planImplementation"
  );
}

function formatHoverTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date(timestampMs));
}

function ThinkingLabel({ label }: { label?: string }) {
  return (
    <span className="loading-shimmer-pure-text max-w-[12rem] min-w-0 cursor-default truncate text-base text-token-text-tertiary select-none">
      {label}
    </span>
  );
}

function TrailingSummaryLabel({
  label,
}: {
  label: string;
}) {
  return (
    <span className="max-w-[12rem] min-w-0 cursor-default truncate text-base text-token-text-tertiary">
      {label}
    </span>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "approval" }) {
  return (
    <span className="inline-flex max-w-[150px] items-center truncate rounded-full bg-token-charts-green/20 py-0.5 pr-2.5 pl-2 text-base text-token-charts-green">
      {label}
    </span>
  );
}
