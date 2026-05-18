import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearDebugAppServerNotifications,
  clearDebugAppServerRequests,
  onDebugAppServerHostUpdated,
  readDebugAppServerSnapshot,
  readDebugAppServerThreadStatusForHost,
  unsubscribeDebugAppServerThreadForHost,
  type DebugAppServerHostSnapshot,
  type DebugAppServerNotificationRecord,
  type DebugAppServerRequestRecord,
  type DebugAppServerThreadResumeState,
  type DebugAppServerThreadStatusEntry,
  type DebugAppServerThreadStatusResponse,
} from "../../services/debugAppServer";
import {
  LOCAL_SETTINGS_HOST_ID,
  onRemoteAppServerConnectionStateChanged,
  readSettingsRemoteConnectionStates,
  type AppServerConnectionState,
  type RemoteConnection,
} from "../../services/settingsHosts";
import { DebugField, DebugSection } from "./DebugSectionPrimitives";

const APP_SERVER_SECTION_STORAGE_KEY = "debug-app-server-section";
const APP_SERVER_HOST_OPEN_STORAGE_KEY_PREFIX = "debug-app-server-host:";
const REQUEST_STATUS_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  fractionalSecondDigits: 3,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const EMPTY_THREAD_STATUS_RESPONSE: DebugAppServerThreadStatusResponse = {
  entries: [],
  titlesByThreadId: {},
};
const THREAD_STATUS_STATES: DebugAppServerThreadResumeState[] = [
  "resumed",
  "resuming",
  "needs_resume",
];
const THREAD_STATUS_REFRESH_REQUEST_METHODS = new Set([
  "thread/fork",
  "thread/resume",
  "thread/start",
  "thread/unsubscribe",
  "review/start",
]);
const THREAD_STATUS_REFRESH_NOTIFICATION_METHODS = new Set([
  "error",
  "thread/closed",
  "thread/name/updated",
  "thread/started",
  "thread/status/changed",
  "turn/completed",
  "turn/started",
]);

type DebugAppServerSectionProps = {
  initialConnectionStatesByHostId?: Record<string, AppServerConnectionState>;
  initialHosts?: DebugAppServerHostSnapshot[];
  initialThreadStatusesByHostId?: Record<string, DebugAppServerThreadStatusResponse>;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  remoteConnections: RemoteConnection[];
};

type HostDetails = {
  connectionType: string;
  displayName: string;
  lines: Array<{
    label: string;
    value: string;
  }>;
  stateType: "connection" | "local";
};

type RequestSectionProps = {
  hostId: string;
  requests: DebugAppServerRequestRecord[];
};

type NotificationsSectionProps = {
  hostId: string;
  notifications: DebugAppServerNotificationRecord[];
  titlesByThreadId: Record<string, string>;
};

type ThreadStatusSectionProps = {
  hostId: string;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  threadStatus: DebugAppServerThreadStatusResponse;
};

export function DebugAppServerSection({
  initialConnectionStatesByHostId,
  initialHosts,
  initialThreadStatusesByHostId,
  onOpenConversation,
  remoteConnections,
}: DebugAppServerSectionProps) {
  const [hostsById, setHostsById] = useState<Record<string, DebugAppServerHostSnapshot>>(() =>
    Object.fromEntries((initialHosts ?? []).map((host) => [host.hostId, host])),
  );
  const [connectionStatesByHostId, setConnectionStatesByHostId] = useState<Record<string, AppServerConnectionState>>(
    () => initialConnectionStatesByHostId ?? {},
  );
  const [threadStatusesByHostId, setThreadStatusesByHostId] = useState<Record<string, DebugAppServerThreadStatusResponse>>(
    () => initialThreadStatusesByHostId ?? {},
  );
  const reloadTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const hostIds = useMemo(() => {
    const ids = new Set<string>([LOCAL_SETTINGS_HOST_ID]);
    for (const remoteConnection of remoteConnections) {
      ids.add(remoteConnection.hostId);
    }
    return Array.from(ids);
  }, [remoteConnections]);

  useEffect(() => {
    let disposed = false;
    let unlistenHostUpdated: (() => void) | null = null;
    let unlistenConnectionStateChanged: (() => void) | null = null;

    const clearReloadTimer = (hostId: string) => {
      const timer = reloadTimersRef.current.get(hostId);
      if (timer != null) {
        clearTimeout(timer);
        reloadTimersRef.current.delete(hostId);
      }
    };

    const loadThreadStatus = (hostId: string) => {
      clearReloadTimer(hostId);
      void readDebugAppServerThreadStatusForHost(hostId)
        .then((response) => {
          if (disposed) {
            return;
          }
          setThreadStatusesByHostId((current) => ({
            ...current,
            [hostId]: response,
          }));
        })
        .catch(() => {
          if (disposed) {
            return;
          }
          setThreadStatusesByHostId((current) => ({
            ...current,
            [hostId]: EMPTY_THREAD_STATUS_RESPONSE,
          }));
        });
    };

    const scheduleThreadStatusReload = (hostId: string) => {
      clearReloadTimer(hostId);
      const timer = setTimeout(() => {
        reloadTimersRef.current.delete(hostId);
        loadThreadStatus(hostId);
      }, 120);
      reloadTimersRef.current.set(hostId, timer);
    };

    void readDebugAppServerSnapshot()
      .then((response) => {
        if (disposed) {
          return;
        }
        setHostsById(Object.fromEntries(response.hosts.map((host) => [host.hostId, host])));
      })
      .catch(() => undefined);

    void readSettingsRemoteConnectionStates(remoteConnections)
      .then((states) => {
        if (!disposed) {
          setConnectionStatesByHostId(states);
        }
      })
      .catch(() => undefined);

    for (const hostId of hostIds) {
      loadThreadStatus(hostId);
    }

    void onDebugAppServerHostUpdated((notification) => {
      if (disposed) {
        return;
      }
      setHostsById((current) => ({
        ...current,
        [notification.host.hostId]: notification.host,
      }));
      if (shouldReloadThreadStatus(notification.host)) {
        scheduleThreadStatusReload(notification.host.hostId);
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenHostUpdated = dispose;
    });

    void onRemoteAppServerConnectionStateChanged((notification) => {
      if (disposed) {
        return;
      }
      setConnectionStatesByHostId((current) => ({
        ...current,
        [notification.hostId]: notification.state,
      }));
      if (notification.state === "connected") {
        scheduleThreadStatusReload(notification.hostId);
        return;
      }
      if (notification.state === "connecting") {
        return;
      }
      setThreadStatusesByHostId((current) => ({
        ...current,
        [notification.hostId]: EMPTY_THREAD_STATUS_RESPONSE,
      }));
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlistenConnectionStateChanged = dispose;
    });

    return () => {
      disposed = true;
      unlistenHostUpdated?.();
      unlistenConnectionStateChanged?.();
      for (const timer of reloadTimersRef.current.values()) {
        clearTimeout(timer);
      }
      reloadTimersRef.current.clear();
    };
  }, [hostIds, remoteConnections]);

  return (
    <DebugSection
      storageKey={APP_SERVER_SECTION_STORAGE_KEY}
      title="App Server"
      unmountChildrenWhenClosed={true}
      variant="global"
    >
      <div className="flex flex-col gap-3 py-3">
        {hostIds.map((hostId) => {
          const host = hostsById[hostId] ?? buildEmptyHostSnapshot(hostId);
          return (
            <AppServerHostCard
              key={hostId}
              connectionState={
                hostId === LOCAL_SETTINGS_HOST_ID
                  ? "connected"
                  : connectionStatesByHostId[hostId] ?? "disconnected"
              }
              host={host}
              hostDetails={deriveHostDetails(hostId, remoteConnections)}
              onOpenConversation={onOpenConversation}
              threadStatus={threadStatusesByHostId[hostId] ?? EMPTY_THREAD_STATUS_RESPONSE}
            />
          );
        })}
      </div>
    </DebugSection>
  );
}

function AppServerHostCard({
  connectionState,
  host,
  hostDetails,
  onOpenConversation,
  threadStatus,
}: {
  connectionState: AppServerConnectionState;
  host: DebugAppServerHostSnapshot;
  hostDetails: HostDetails;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  threadStatus: DebugAppServerThreadStatusResponse;
}) {
  const failedRequests = host.requests.filter(isFailedRequest);
  const pendingRequests = host.requests.filter((request) => request.status === "pending");
  const errorNotifications = host.notifications.filter((notification) => notification.severity === "error");
  const deltaNotifications = host.notifications.filter((notification) => notification.isNoisy);
  const [open, setOpen] = useState(() => {
    return readStoredOpenState(hostDetails.stateType === "local", `${APP_SERVER_HOST_OPEN_STORAGE_KEY_PREFIX}${host.hostId}`);
  });

  useEffect(() => {
    writeStoredOpenState(`${APP_SERVER_HOST_OPEN_STORAGE_KEY_PREFIX}${host.hostId}`, open);
  }, [host.hostId, open]);

  const badgeState = hostDetails.stateType === "local" ? "local" : connectionState;
  const hostSuffix = hostDetails.stateType === "connection" ? ` · ${host.hostId}` : "";
  const versionSuffix = ` · v${host.appServerVersion ?? "Unavailable"}`;

  return (
    <details
      className="group rounded-xl border border-token-border bg-token-foreground/[0.03] shadow-sm"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex cursor-interaction list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-token-foreground">{hostDetails.displayName}</span>
            <AppServerStateBadge state={badgeState} />
          </div>
          <div className="mt-1 truncate text-xs text-token-description-foreground">
            {hostDetails.connectionType}
            {hostSuffix}
            {versionSuffix}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-token-description-foreground tabular-nums">
          <span>{host.requests.length} requests</span>
          <span>{host.notifications.length} notifications</span>
          {pendingRequests.length > 0 ? (
            <span className="rounded-full bg-token-charts-yellow/15 px-2 py-0.5 text-token-charts-yellow">
              {pendingRequests.length} live
            </span>
          ) : null}
          {failedRequests.length > 0 ? (
            <span className="rounded-full bg-token-charts-red/15 px-2 py-0.5 text-token-charts-red">
              {failedRequests.length} failed
            </span>
          ) : null}
          {errorNotifications.length > 0 ? (
            <span className="rounded-full bg-token-charts-red/15 px-2 py-0.5 text-token-charts-red">
              {errorNotifications.length} notification errors
            </span>
          ) : null}
          {deltaNotifications.length > 0 ? (
            <span className="rounded-full bg-token-foreground/10 px-2 py-0.5">{deltaNotifications.length} deltas</span>
          ) : null}
        </div>
      </summary>
      <div className="border-t border-token-border px-3 pb-3">
        <div className="flex flex-col gap-3 py-3">
          {hostDetails.lines.length > 0 ? (
            <div className="rounded-lg border border-token-border bg-token-foreground/[0.025] px-3">
              {hostDetails.lines.map((line) => (
                <DebugField key={line.label} label={line.label} value={line.value} />
              ))}
            </div>
          ) : null}

          <AppServerThreadStatusSection
            hostId={host.hostId}
            onOpenConversation={onOpenConversation}
            threadStatus={threadStatus}
          />

          <AppServerRequestSection hostId={host.hostId} requests={host.requests} />
          <AppServerNotificationsSection
            hostId={host.hostId}
            notifications={host.notifications}
            titlesByThreadId={threadStatus.titlesByThreadId}
          />
        </div>
      </div>
    </details>
  );
}

function AppServerThreadStatusSection({
  hostId,
  onOpenConversation,
  threadStatus,
}: ThreadStatusSectionProps) {
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<DebugAppServerThreadResumeState | null>(null);
  const groupedEntries = groupThreadStatusEntries(threadStatus.entries);
  const normalizedSelectedState =
    selectedState != null && THREAD_STATUS_STATES.includes(selectedState) ? selectedState : null;
  const visibleGroups =
    normalizedSelectedState == null
      ? groupedEntries
      : groupedEntries.filter((group) => group.status === normalizedSelectedState);

  return (
    <div className="overflow-hidden rounded-lg border border-token-border bg-token-foreground/[0.025]">
      <DebugSection
        storageKey={`debug-app-server-thread-status-${hostId}`}
        title="Thread status"
        variant="global"
      >
        <div className="py-3">
          {groupedEntries.length === 0 ? (
            <EmptyStateCard message="No in-memory threads for this manager yet" />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  className="bg-token-background max-w-80 cursor-interaction rounded-md border border-token-border px-2 py-1 text-xs text-token-foreground"
                  value={normalizedSelectedState ?? ""}
                  onChange={(event) => setSelectedState(normalizeThreadStatusState(event.currentTarget.value))}
                >
                  <option value="">All states ({threadStatus.entries.length})</option>
                  {THREAD_STATUS_STATES.map((status) => (
                    <option key={status} value={status}>
                      {formatThreadStatusOptionLabel(
                        status,
                        groupedEntries.find((group) => group.status === status)?.entries.length ?? 0,
                      )}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto pr-1">
                {visibleGroups.length === 0 ? (
                  <EmptyStateCard message="No in-memory threads match this state" />
                ) : (
                  visibleGroups.map((group) => (
                    <div key={group.status} className="flex flex-col gap-2">
                      <div className="text-xs font-medium text-token-description-foreground">
                        {formatThreadStatusGroupLabel(group.status, group.entries.length)}
                      </div>
                      <div className="flex flex-col gap-2">
                        {group.entries.map((entry) => (
                          <AppServerThreadStatusCard
                            key={entry.conversationId}
                            entry={entry}
                            hostId={hostId}
                            isPending={pendingConversationId === entry.conversationId}
                            onOpenConversation={onOpenConversation}
                            onUnsubscribe={async (conversationId) => {
                              setPendingConversationId(conversationId);
                              try {
                                await clearThreadSubscription(hostId, conversationId);
                              } finally {
                                setPendingConversationId((current) =>
                                  current === conversationId ? null : current,
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DebugSection>
    </div>
  );
}

function AppServerThreadStatusCard({
  entry,
  hostId,
  isPending,
  onOpenConversation,
  onUnsubscribe,
}: {
  entry: DebugAppServerThreadStatusEntry;
  hostId: string;
  isPending: boolean;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  onUnsubscribe: (conversationId: string) => Promise<void>;
}) {
  const canUnsubscribe =
    entry.resumeState === "resumed" &&
    entry.streamRole?.role === "owner" &&
    !isPending;
  const title = entry.title?.trim() || "Untitled thread";

  return (
    <div className="bg-token-background rounded-lg border border-token-border px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-token-foreground">{title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="truncate font-mono text-[11px] text-token-description-foreground">
              {entry.conversationId}
            </div>
            <button
              type="button"
              aria-label="Open thread"
              className="cursor-interaction rounded p-0.5 text-token-charts-blue hover:bg-token-foreground/10"
              onClick={() => onOpenConversation?.(entry.conversationId, hostId)}
            >
              <ArrowUpRightLgIcon className="icon-xs" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="cursor-interaction rounded border border-token-border px-2 py-1 text-xs text-token-foreground hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50"
          disabled={!canUnsubscribe}
          onClick={() => void onUnsubscribe(entry.conversationId)}
        >
          {isPending ? "Unsubscribing..." : "Unsubscribe"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-token-description-foreground">
        <ThreadStatusChip label={`resume: ${entry.resumeState}`} />
        <ThreadStatusChip label={`stream: ${entry.streamRole?.role ?? "none"}`} />
        <ThreadStatusChip label={`runtime: ${entry.threadRuntimeStatus?.type ?? "none"}`} />
        <ThreadStatusChip label={`turn: ${entry.lastTurnStatus ?? "none"}`} />
      </div>
    </div>
  );
}

function ThreadStatusChip({ label }: { label: string }) {
  return <span className="rounded-full bg-token-foreground/10 px-2 py-0.5 tabular-nums">{label}</span>;
}

function AppServerRequestSection({ hostId, requests }: RequestSectionProps) {
  const [failedOnly, setFailedOnly] = useState(false);
  const failedRequests = requests.filter(isFailedRequest);
  const visibleRequests = failedOnly ? failedRequests : requests;

  return (
    <DebugAppServerSubsection
      clearDisabled={requests.length === 0}
      onClear={() => void clearDebugAppServerRequests(hostId)}
      storageKey={`debug-app-server-requests-${hostId}`}
      title="Recent requests"
    >
      {failedRequests.length > 0 || failedOnly ? (
        <div className="mb-2 flex justify-end">
          <label className="flex cursor-interaction items-center gap-2 text-xs text-token-description-foreground">
            <input
              checked={failedOnly}
              className="cursor-interaction"
              onChange={(event) => setFailedOnly(event.currentTarget.checked)}
              type="checkbox"
            />
            Failed
            <span className="tabular-nums">({failedRequests.length})</span>
          </label>
        </div>
      ) : null}

      {visibleRequests.length > 0 ? (
        <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
          {visibleRequests.map((request) => (
            <AppServerRequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <EmptyStateCard
          message={failedOnly ? "No failed requests recorded for this manager yet" : "No requests recorded for this manager yet"}
        />
      )}
    </DebugAppServerSubsection>
  );
}

function AppServerNotificationsSection({
  hostId,
  notifications,
  titlesByThreadId,
}: NotificationsSectionProps) {
  const [showDeltaNotifications, setShowDeltaNotifications] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const threadIds = useMemo(() => {
    const ids = new Set<string>();
    const orderedThreadIds: string[] = [];
    for (const notification of notifications) {
      if (notification.threadId != null && !ids.has(notification.threadId)) {
        ids.add(notification.threadId);
        orderedThreadIds.push(notification.threadId);
      }
    }
    return orderedThreadIds;
  }, [notifications]);
  const normalizedSelectedThreadId =
    selectedThreadId != null && threadIds.includes(selectedThreadId) ? selectedThreadId : null;
  const threadFilteredNotifications =
    normalizedSelectedThreadId == null
      ? notifications
      : notifications.filter((notification) => notification.threadId === normalizedSelectedThreadId);
  const deltaNotifications = threadFilteredNotifications.filter((notification) => notification.isNoisy);
  const visibleNotifications = showDeltaNotifications
    ? threadFilteredNotifications
    : threadFilteredNotifications.filter((notification) => !notification.isNoisy);

  return (
    <DebugAppServerSubsection
      clearDisabled={notifications.length === 0}
      onClear={() => void clearDebugAppServerNotifications(hostId)}
      storageKey={`debug-app-server-notifications-${hostId}`}
      title="Notifications"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {threadIds.length > 0 ? (
          <select
            className="bg-token-background max-w-80 cursor-interaction rounded-md border border-token-border px-2 py-1 text-xs text-token-foreground"
            value={normalizedSelectedThreadId ?? ""}
            onChange={(event) => setSelectedThreadId(event.currentTarget.value || null)}
          >
            <option value="">All threads</option>
            {threadIds.map((threadId) => (
              <option key={threadId} value={threadId}>
                {titlesByThreadId[threadId]?.trim() || "Untitled thread"}
              </option>
            ))}
          </select>
        ) : null}

        {deltaNotifications.length > 0 ? (
          <label className="ml-auto flex cursor-interaction items-center gap-2 text-xs text-token-description-foreground">
            <input
              checked={showDeltaNotifications}
              className="cursor-interaction"
              onChange={(event) => setShowDeltaNotifications(event.currentTarget.checked)}
              type="checkbox"
            />
            Show delta notifications
            <span className="tabular-nums">({deltaNotifications.length})</span>
          </label>
        ) : null}
      </div>

      {visibleNotifications.length > 0 ? (
        <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
          {visibleNotifications.map((notification) => (
            <AppServerNotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      ) : (
        <EmptyStateCard
          message={
            deltaNotifications.length > 0
              ? "Only hidden delta notifications recorded"
              : normalizedSelectedThreadId == null
                ? "No notifications recorded for this manager yet"
                : "No notifications recorded for this thread"
          }
        />
      )}
    </DebugAppServerSubsection>
  );
}

function AppServerRequestCard({ request }: { request: DebugAppServerRequestRecord }) {
  const timingLabel = formatRequestStatusLabel(request);

  return (
    <details className="group/request rounded-lg border border-token-border bg-token-background">
      <summary className="flex cursor-interaction list-none items-center justify-between gap-3 px-3 py-2 marker:content-none">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-xs text-token-foreground">{request.method}</span>
            <span className="rounded-full bg-token-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-token-description-foreground tabular-nums">
              #{request.matchingRequestSequenceNumber}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-token-description-foreground tabular-nums">
          <div>{REQUEST_STATUS_TIME_FORMAT.format(request.startedAtMs)}</div>
          <div>{timingLabel}</div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-token-border p-3">
        <div className="grid gap-2 text-[11px] text-token-description-foreground md:grid-cols-2">
          <div>Request ID: {request.id}</div>
          <div>Timeout: {request.timeoutMs > 0 ? request.timeoutMs : "none"}</div>
          <div>
            {request.endedAtMs == null ? "Ended: pending" : `Ended: ${REQUEST_STATUS_TIME_FORMAT.format(request.endedAtMs)}`}
          </div>
        </div>
        <PayloadBlock payload={request.paramsPreview} title="Params" />
        {request.resultPreview != null ? <PayloadBlock payload={request.resultPreview} title="Result" /> : null}
        {request.errorPreview != null ? <PayloadBlock payload={request.errorPreview} title="Error" /> : null}
      </div>
    </details>
  );
}

function AppServerNotificationCard({ notification }: { notification: DebugAppServerNotificationRecord }) {
  return (
    <details className={notificationCardClassName(notification.severity)}>
      <summary className="flex cursor-interaction list-none items-center justify-between gap-3 px-3 py-2 marker:content-none">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-xs text-token-foreground">{notification.method}</span>
            {notification.severity === "error" ? (
              <span className="rounded-full bg-token-charts-red/15 px-1.5 py-0.5 text-[10px] font-medium text-token-charts-red">
                error
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-token-description-foreground tabular-nums">
          {REQUEST_STATUS_TIME_FORMAT.format(notification.receivedAtMs)}
        </div>
      </summary>
      <div className="space-y-3 border-t border-token-border p-3">
        <PayloadBlock payload={notification.paramsPreview} title="Params" />
      </div>
    </details>
  );
}

function PayloadBlock({ payload, title }: { payload: string; title: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium tracking-wide text-token-description-foreground uppercase">
        <span>{title}</span>
        <button
          type="button"
          className="cursor-interaction rounded px-1.5 py-0.5 text-token-foreground hover:bg-token-foreground/10"
          onClick={() => {
            if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
              return;
            }
            void navigator.clipboard.writeText(payload).catch(() => undefined);
          }}
        >
          Copy
        </button>
      </div>
      <pre className="max-h-52 overflow-auto rounded-md border border-token-border bg-token-foreground/[0.035] p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-token-foreground">
        {payload}
      </pre>
    </div>
  );
}

function AppServerStateBadge({
  state,
}: {
  state: AppServerConnectionState | "local";
}) {
  return <span className={stateBadgeClassName(state)}>{state}</span>;
}

function DebugAppServerSubsection({
  children,
  clearDisabled,
  onClear,
  storageKey,
  title,
}: {
  children: ReactNode;
  clearDisabled: boolean;
  onClear: () => void;
  storageKey: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-token-border bg-token-foreground/[0.025]">
      <DebugSection
        actions={
          <button
            type="button"
            className="cursor-interaction rounded px-1.5 py-0.5 text-xs hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50"
            disabled={clearDisabled}
            onClick={onClear}
          >
            Clear
          </button>
        }
        storageKey={storageKey}
        title={title}
        variant="global"
      >
        <div className="py-3">{children}</div>
      </DebugSection>
    </div>
  );
}

function EmptyStateCard({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-token-border px-3 py-6 text-center text-xs text-token-description-foreground">
      {message}
    </div>
  );
}

function buildEmptyHostSnapshot(hostId: string): DebugAppServerHostSnapshot {
  return {
    hostId,
    appServerVersion: null,
    installedCodexVersion: null,
    requests: [],
    notifications: [],
  };
}

function deriveHostDetails(hostId: string, remoteConnections: RemoteConnection[]): HostDetails {
  if (hostId === LOCAL_SETTINGS_HOST_ID) {
    return {
      connectionType: "Built-in app server",
      displayName: "Local",
      lines: [],
      stateType: "local",
    };
  }

  const remoteConnection = remoteConnections.find((connection) => connection.hostId === hostId);
  if (remoteConnection == null) {
    return {
      connectionType: "Unknown",
      displayName: hostId,
      lines: [
        {
          label: "Registered",
          value: "true",
        },
      ],
      stateType: "connection",
    };
  }

  return {
    connectionType: remoteConnectionTypeLabel(remoteConnection),
    displayName: remoteConnection.displayName,
    lines: [
      { label: "Source", value: remoteConnection.source },
      { label: "Auto connect", value: String(remoteConnection.autoConnect) },
      { label: "SSH host", value: remoteConnection.sshHost ?? "Unavailable" },
      { label: "SSH port", value: remoteConnection.sshPort == null ? "default" : String(remoteConnection.sshPort) },
      { label: "Identity", value: remoteConnection.identity == null ? "none" : "configured" },
    ],
    stateType: "connection",
  };
}

function remoteConnectionTypeLabel(remoteConnection: RemoteConnection) {
  switch (remoteConnection.source) {
    case "codex-managed":
      return "Remote SSH · managed";
    case "discovered":
      return "Remote SSH · discovered";
    default:
      return "Remote SSH";
  }
}

function isFailedRequest(request: DebugAppServerRequestRecord) {
  return request.status === "failed" || request.status === "timed-out";
}

function formatRequestStatusLabel(request: DebugAppServerRequestRecord) {
  switch (request.status) {
    case "pending":
      return "pending";
    case "completed":
      return `✅ ${formatDuration(request.durationMs)}`;
    case "failed":
    case "timed-out":
      return `❌ ${formatDuration(request.durationMs)}`;
  }
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return "running";
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function notificationCardClassName(severity: DebugAppServerNotificationRecord["severity"]) {
  switch (severity) {
    case "error":
      return "group/notification rounded-lg border border-token-charts-red/50 bg-token-background";
    case "noisy":
      return "group/notification rounded-lg border border-token-border/70 bg-token-background";
    case "default":
      return "group/notification rounded-lg border border-token-border bg-token-background";
  }
}

function stateBadgeClassName(state: AppServerConnectionState | "local") {
  const baseClassName = "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide";
  switch (state) {
    case "connected":
    case "local":
      return `${baseClassName} bg-token-charts-green/15 text-token-charts-green`;
    case "connecting":
      return `${baseClassName} bg-token-charts-yellow/15 text-token-charts-yellow`;
    case "restarting":
      return `${baseClassName} bg-token-charts-blue/15 text-token-charts-blue`;
    case "disconnected":
      return `${baseClassName} bg-token-foreground/10 text-token-description-foreground`;
    case "error":
      return `${baseClassName} bg-token-charts-red/15 text-token-charts-red`;
  }
}

function readStoredOpenState(defaultValue: boolean, storageKey: string) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === "open") {
      return true;
    }
    if (value === "closed") {
      return false;
    }
  } catch {
    return defaultValue;
  }

  return defaultValue;
}

function writeStoredOpenState(storageKey: string, open: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, open ? "open" : "closed");
  } catch {
    // ignore local persistence failures
  }
}

function groupThreadStatusEntries(entries: DebugAppServerThreadStatusEntry[]) {
  return THREAD_STATUS_STATES.flatMap((status) => {
    const groupedEntries = entries.filter((entry) => entry.resumeState === status);
    return groupedEntries.length === 0 ? [] : [{ entries: groupedEntries, status }] as const;
  });
}

function formatThreadStatusGroupLabel(status: DebugAppServerThreadResumeState, count: number) {
  return `${status} (${count})`;
}

function formatThreadStatusOptionLabel(status: DebugAppServerThreadResumeState, count: number) {
  return `${status} (${count})`;
}

function normalizeThreadStatusState(value: string) {
  return THREAD_STATUS_STATES.find((status) => status === value) ?? null;
}

function shouldReloadThreadStatus(host: DebugAppServerHostSnapshot) {
  const latestRequest = host.requests[0];
  if (
    latestRequest != null &&
    latestRequest.status !== "pending" &&
    THREAD_STATUS_REFRESH_REQUEST_METHODS.has(latestRequest.method)
  ) {
    return true;
  }

  const latestNotification = host.notifications[0];
  return latestNotification != null && THREAD_STATUS_REFRESH_NOTIFICATION_METHODS.has(latestNotification.method);
}

async function clearThreadSubscription(hostId: string, threadId: string) {
  await unsubscribeDebugAppServerThreadForHost(hostId, threadId);
}

function ArrowUpRightLgIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M11.949 3.47949C12.0997 3.46465 12.2553 3.51279 12.3709 3.62793C12.4863 3.74328 12.5338 3.89898 12.5193 4.0498C12.5206 4.06633 12.5251 4.08275 12.5252 4.09961V10.667C12.525 10.9565 12.2902 11.191 12.0007 11.1914C11.7109 11.1914 11.4755 10.9568 11.4754 10.667V5.2666L4.37184 12.376C4.16684 12.5807 3.83365 12.5808 3.62867 12.376C3.42385 12.1711 3.42396 11.8388 3.62867 11.6338L10.7332 4.52539H5.33375C5.0438 4.52539 4.80836 4.28995 4.80836 4C4.80836 3.71005 5.0438 3.47461 5.33375 3.47461H11.9002C11.9167 3.47462 11.9328 3.47822 11.949 3.47949Z"
        fill="currentColor"
      />
    </svg>
  );
}
