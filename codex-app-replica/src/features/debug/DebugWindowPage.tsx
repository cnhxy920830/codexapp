import { useEffect, useState } from "react";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { formatAuthDetail, formatAuthLabel, getAuthSnapshot, initialAuthSnapshot, type AuthSnapshot } from "../../services/auth";
import {
  allowDebugMenu,
  refreshAmbientSuggestions,
  readAmbientSuggestionsGenerationStatuses,
  readAppFlavor,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA,
  primaryRuntimeUpdateRunNow,
  readPrimaryRuntimeUpdateStatus,
  runDebugAppAction,
  setPrimaryRuntimeInstallRelease,
  type AmbientSuggestionsGenerationStatus,
  type PrimaryRuntimeUpdateStatusResponse,
} from "../../services/debug";
import { getRecentThreads, readThread, type ThreadConversation, type ThreadHistoryEntry } from "../../services/history";
import { readProjectlessThreadCwd, type ProjectlessThreadCwdResponse } from "../../services/projectlessThreads";
import {
  readActiveWorkspaceRoots,
  readWorkspaceRootOptions,
  type ActiveWorkspaceRootsResponse,
  type WorkspaceRootOptionsResponse,
} from "../../services/workspaceRoots";
import {
  readConnectedSettingsRemoteConnections,
  readSettingsRemoteConnectionsSnapshot,
  type RemoteConnection,
} from "../../services/settingsHosts";
import {
  type WorktreesSettingsSnapshot,
} from "../../services/worktrees";
import { AmbientSuggestionsDebugSection } from "./AmbientSuggestionsDebugSection";
import { DebugEmptyState, DebugField, DebugSection } from "./DebugSectionPrimitives";

const DEFAULT_APP_ACTION_JSON = `{
  "type": "app.get_summary"
}`;

export type DebugWindowPageProps = {
  conversationId: string | null;
  isLoading: boolean;
  threadConversation: ThreadConversation | null;
  onClose: () => void;
};

export type DebugModalProps = {
  ambientSuggestionStatuses: AmbientSuggestionsGenerationStatus[] | null;
  conversationId: string | null;
  threadConversation: ThreadConversation | null;
  authSnapshot: AuthSnapshot | null;
  projectlessThreadCwd: ProjectlessThreadCwdResponse | null;
  recentThreads: ThreadHistoryEntry[];
  workspaceRootOptions: WorkspaceRootOptionsResponse | null;
  activeWorkspaceRoots: ActiveWorkspaceRootsResponse | null;
  remoteConnections: RemoteConnection[];
  connectedRemoteConnections: RemoteConnection[];
  worktreesSettings: WorktreesSettingsSnapshot | null;
  primaryRuntimeStatus: PrimaryRuntimeUpdateStatusResponse | null;
  primaryRuntimeInstallRelease: string;
  isAmbientSuggestionsLoading: boolean;
  refreshingAmbientSuggestionsProjectRoot: string | null;
  appActionDraft: string;
  appActionResult: string;
  isAppActionRunning: boolean;
  onAppActionDraftChange: (value: string) => void;
  onRefreshAmbientSuggestions: (projectRoot: string) => void;
  onRunAppAction: () => void;
  onPrimaryRuntimeInstallReleaseChange: (release: string) => void;
  onPrimaryRuntimeRefresh: () => void;
  onPrimaryRuntimeRunNow: () => void;
  onClose: () => void;
  showHeader?: boolean;
  showPopOutButton?: boolean;
  onPopOut?: () => void;
};

export function DebugWindowPage({ conversationId, isLoading, threadConversation, onClose }: DebugWindowPageProps) {
  const isDebugMenuAllowed = allowDebugMenu();

  useEffect(() => {
    if (isDebugMenuAllowed) {
      return;
    }

    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [isDebugMenuAllowed]);

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot | null>(null);
  const [recentThreads, setRecentThreads] = useState<ThreadHistoryEntry[]>([]);
  const [workspaceRootOptions, setWorkspaceRootOptions] = useState<WorkspaceRootOptionsResponse | null>(null);
  const [activeWorkspaceRoots, setActiveWorkspaceRoots] = useState<ActiveWorkspaceRootsResponse | null>(null);
  const [projectlessThreadCwd, setProjectlessThreadCwd] = useState<ProjectlessThreadCwdResponse | null>(null);
  const [ambientSuggestionStatuses, setAmbientSuggestionStatuses] = useState<AmbientSuggestionsGenerationStatus[] | null>(null);
  const [remoteConnections, setRemoteConnections] = useState<RemoteConnection[]>([]);
  const [connectedRemoteConnections, setConnectedRemoteConnections] = useState<RemoteConnection[]>([]);
  const [worktreesSettings, setWorktreesSettings] = useState<WorktreesSettingsSnapshot | null>(null);
  const [primaryRuntimeStatus, setPrimaryRuntimeStatus] = useState<PrimaryRuntimeUpdateStatusResponse | null>(null);
  const [primaryRuntimeInstallRelease, setPrimaryRuntimeInstallReleaseState] = useState(
    PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  );
  const [appActionDraft, setAppActionDraft] = useState(DEFAULT_APP_ACTION_JSON);
  const [appActionResult, setAppActionResult] = useState("Not run yet");
  const [isAppActionRunning, setIsAppActionRunning] = useState(false);
  const [refreshingAmbientSuggestionsProjectRoot, setRefreshingAmbientSuggestionsProjectRoot] = useState<string | null>(null);
  const [threadSnapshot, setThreadSnapshot] = useState<ThreadConversation | null>(threadConversation);
  const [isHydrated, setIsHydrated] = useState(false);
  const appFlavor = readAppFlavor();
  const showAmbientSuggestionsSection = appFlavor === "dev" || appFlavor === "nightly";

  useEffect(() => {
    setThreadSnapshot(threadConversation);
  }, [threadConversation]);

  useEffect(() => {
    if (!isDebugMenuAllowed) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      const thread =
        threadConversation !== null && threadConversation.id === conversationId
          ? threadConversation
          : conversationId
            ? await readThread(conversationId).catch(() => null)
            : null;

      const [
        authSnapshotResult,
        recentThreadsResult,
        workspaceRootOptionsResult,
        activeWorkspaceRootsResult,
        projectlessThreadCwdResult,
        ambientSuggestionStatusesResult,
      ] =
        await Promise.all([
          getAuthSnapshot().catch(() => initialAuthSnapshot),
          getRecentThreads().catch(() => [] as ThreadHistoryEntry[]),
          readWorkspaceRootOptions().catch(() => null),
          readActiveWorkspaceRoots().catch(() => null),
          showAmbientSuggestionsSection ? readProjectlessThreadCwd().catch(() => null) : Promise.resolve(null),
          showAmbientSuggestionsSection
            ? readAmbientSuggestionsGenerationStatuses().then((response) => response.statuses).catch(() => null)
            : Promise.resolve(null),
        ]);

      const remoteConnectionsSnapshot = await readSettingsRemoteConnectionsSnapshot().catch(() => []);
      const connectedRemoteConnectionsResult = await readConnectedSettingsRemoteConnections(remoteConnectionsSnapshot).catch(
        () => [],
      );

      const [{ DEFAULT_WORKTREES_SETTINGS, readWorktreesSettingsSnapshot }, primaryRuntimeStatusResult] = await Promise.all([
        import("../../services/worktrees"),
        readPrimaryRuntimeUpdateStatus().catch(() => null),
      ]);
      const worktreesSettingsResult = await readWorktreesSettingsSnapshot().catch(() => DEFAULT_WORKTREES_SETTINGS);

      if (cancelled) {
        return;
      }

      setThreadSnapshot(thread);
      setAuthSnapshot(authSnapshotResult);
      setRecentThreads(recentThreadsResult);
      setWorkspaceRootOptions(workspaceRootOptionsResult);
      setActiveWorkspaceRoots(activeWorkspaceRootsResult);
      setProjectlessThreadCwd(projectlessThreadCwdResult);
      setAmbientSuggestionStatuses(ambientSuggestionStatusesResult);
      setRemoteConnections(remoteConnectionsSnapshot);
      setConnectedRemoteConnections(connectedRemoteConnectionsResult);
      setWorktreesSettings(worktreesSettingsResult);
      setPrimaryRuntimeStatus(primaryRuntimeStatusResult);
      setIsHydrated(true);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId, isDebugMenuAllowed, showAmbientSuggestionsSection, threadConversation]);

  const reloadAmbientSuggestionsState = async () => {
    if (!showAmbientSuggestionsSection) {
      return;
    }

    const [projectlessThreadCwdResult, ambientSuggestionStatusesResult] = await Promise.all([
      readProjectlessThreadCwd().catch(() => null),
      readAmbientSuggestionsGenerationStatuses().then((response) => response.statuses).catch(() => null),
    ]);

    setProjectlessThreadCwd(projectlessThreadCwdResult);
    setAmbientSuggestionStatuses(ambientSuggestionStatusesResult);
  };

  const handleRunAppAction = async () => {
    const actionText = appActionDraft.trim();
    if (!actionText) {
      setAppActionResult("Error: empty action JSON");
      return;
    }

    let action: Record<string, unknown>;
    try {
      const parsed = JSON.parse(actionText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Action JSON must be an object");
      }
      action = parsed as Record<string, unknown>;
    } catch (error) {
      setAppActionResult(`Error: ${error instanceof Error ? error.message : String(error)}\n\nInput JSON:\n${actionText}`);
      return;
    }

    setIsAppActionRunning(true);
    try {
      const response = await runDebugAppAction({
        action,
        sourceThreadId: conversationId ?? null,
      });

      if (response.ok) {
        setAppActionResult(
          `Success\n\nResult:\n${JSON.stringify(response.result ?? null, null, 2)}\n\nSent payload:\n${JSON.stringify(
            action,
            null,
            2,
          )}`,
        );
      } else {
        setAppActionResult(
          `Error: ${response.errorMessage ?? "Unknown app action error"}\n\nInput JSON:\n${actionText}`,
        );
      }
    } catch (error) {
      setAppActionResult(`Error: ${error instanceof Error ? error.message : String(error)}\n\nInput JSON:\n${actionText}`);
    } finally {
      setIsAppActionRunning(false);
    }
  };

  const handlePrimaryRuntimeRefresh = async () => {
    setPrimaryRuntimeStatus(await readPrimaryRuntimeUpdateStatus().catch(() => null));
  };

  const handlePrimaryRuntimeRunNow = async () => {
    await primaryRuntimeUpdateRunNow().catch(() => undefined);
    await handlePrimaryRuntimeRefresh();
  };

  const handlePrimaryRuntimeInstallReleaseChange = async (release: string) => {
    setPrimaryRuntimeInstallReleaseState(release);
    await setPrimaryRuntimeInstallRelease(release).catch(() => undefined);
  };

  const handleAmbientSuggestionsRefresh = async (projectRoot: string) => {
    setRefreshingAmbientSuggestionsProjectRoot(projectRoot);
    try {
      await refreshAmbientSuggestions({
        projectRoot,
      });
      await reloadAmbientSuggestionsState();
    } finally {
      setRefreshingAmbientSuggestionsProjectRoot(null);
    }
  };

  if (!isDebugMenuAllowed) {
    return <DebugLoadingState />;
  }

  if (isLoading || !isHydrated) {
    return <DebugLoadingState />;
  }

  return (
    <DebugModal
      ambientSuggestionStatuses={ambientSuggestionStatuses}
      activeWorkspaceRoots={activeWorkspaceRoots}
      appActionDraft={appActionDraft}
      appActionResult={appActionResult}
      authSnapshot={authSnapshot}
      connectedRemoteConnections={connectedRemoteConnections}
      conversationId={conversationId}
      isAppActionRunning={isAppActionRunning}
      isAmbientSuggestionsLoading={showAmbientSuggestionsSection && ambientSuggestionStatuses === null}
      refreshingAmbientSuggestionsProjectRoot={refreshingAmbientSuggestionsProjectRoot}
      onAppActionDraftChange={setAppActionDraft}
      onClose={onClose}
      onPopOut={undefined}
      onRefreshAmbientSuggestions={(projectRoot) => void handleAmbientSuggestionsRefresh(projectRoot)}
      onPrimaryRuntimeInstallReleaseChange={handlePrimaryRuntimeInstallReleaseChange}
      onPrimaryRuntimeRefresh={() => void handlePrimaryRuntimeRefresh()}
      onPrimaryRuntimeRunNow={() => void handlePrimaryRuntimeRunNow()}
      onRunAppAction={() => void handleRunAppAction()}
      primaryRuntimeInstallRelease={primaryRuntimeInstallRelease}
      primaryRuntimeStatus={primaryRuntimeStatus}
      projectlessThreadCwd={projectlessThreadCwd}
      recentThreads={recentThreads}
      remoteConnections={remoteConnections}
      showHeader={false}
      showPopOutButton={false}
      threadConversation={threadSnapshot}
      worktreesSettings={worktreesSettings}
      workspaceRootOptions={workspaceRootOptions}
    />
  );
}

export function DebugModal({
  ambientSuggestionStatuses,
  conversationId,
  threadConversation,
  authSnapshot,
  projectlessThreadCwd,
  recentThreads,
  workspaceRootOptions,
  activeWorkspaceRoots,
  remoteConnections,
  connectedRemoteConnections,
  worktreesSettings,
  primaryRuntimeStatus,
  primaryRuntimeInstallRelease,
  isAmbientSuggestionsLoading,
  refreshingAmbientSuggestionsProjectRoot,
  appActionDraft,
  appActionResult,
  isAppActionRunning,
  onAppActionDraftChange,
  onRefreshAmbientSuggestions,
  onRunAppAction,
  onPrimaryRuntimeInstallReleaseChange,
  onPrimaryRuntimeRefresh,
  onPrimaryRuntimeRunNow,
  onClose,
  showHeader = true,
  showPopOutButton = true,
  onPopOut,
}: DebugModalProps) {
  const showDiagnostics = false;
  const runtimeInstallReleaseChecked = primaryRuntimeInstallRelease === PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA;

  return (
    <main className="h-dvh w-full overflow-hidden bg-token-main-surface-primary text-token-foreground">
      <div className="flex h-full min-h-0 w-full flex-col text-sm">
        {showHeader ? (
          <div
            className={[
              "grid h-toolbar-sm shrink-0 items-center border-b border-token-border px-3 font-medium text-token-description-foreground",
              showPopOutButton ? "grid-cols-[2rem_1fr_auto]" : "grid-cols-[2rem_1fr_2rem]",
            ].join(" ")}
          >
            <div className="h-full draggable" />
            <div className="flex h-full items-center justify-center">
              <h1>Debug</h1>
            </div>
            <div className="no-drag flex items-center gap-1 justify-self-end">
              {showPopOutButton ? (
                <button
                  type="button"
                  className="no-drag cursor-interaction rounded p-1 leading-none text-token-foreground/80 hover:bg-token-toolbar-hover-background focus:outline-none focus:ring-1 focus:ring-token-focus-border"
                  aria-label="Pop out debug view"
                  title="Pop out debug view"
                  onClick={onPopOut}
                >
                  ↗
                </button>
              ) : null}
              <button
                type="button"
                className="no-drag cursor-interaction rounded p-1 leading-none text-token-foreground/80 hover:bg-token-toolbar-hover-background focus:outline-none focus:ring-1 focus:ring-token-focus-border"
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-4">
          <DebugSection storageKey="debug-product-events-section" title="Product events" defaultOpen>
            <DebugEmptyState message="No product events sent yet" />
          </DebugSection>

          <DebugSection storageKey="debug-app-server-section" title="App Server" defaultOpen>
            {connectedRemoteConnections.length === 0 ? (
              <DebugEmptyState message="No connected managers yet" />
            ) : (
              <div className="flex flex-col py-1.5">
                <DebugField label="Known connections" value={String(remoteConnections.length)} />
                {connectedRemoteConnections.map((connection) => (
                  <DebugField
                    key={connection.hostId}
                    label={connection.displayName}
                    value={`${connection.source}${connection.autoConnect ? " · auto-connect" : ""}`}
                  />
                ))}
              </div>
            )}
          </DebugSection>

          <DebugSection storageKey="debug-thread-status-section" title="Thread status" defaultOpen>
            {threadConversation ? (
              <div className="flex flex-col py-1.5">
                <DebugField label="Conversation ID" value={conversationId ?? "Unavailable"} />
                <DebugField label="Title" value={summaryValue(threadConversation.title, "Untitled")} />
                <DebugField label="CWD" value={summaryValue(threadConversation.cwd, "Unavailable")} />
                <DebugField label="Turns" value={String(threadConversation.turns.length)} />
                <DebugField label="Items" value={String(threadConversation.items.length)} />
              </div>
            ) : (
              <DebugEmptyState message="No thread data loaded." />
            )}

            {recentThreads.length > 0 ? (
              <div className="mt-2 rounded-lg border border-token-border bg-token-foreground/[0.025] px-3">
                {recentThreads.slice(0, 5).map((thread) => (
                  <DebugField
                    key={thread.id}
                    label={thread.name?.trim() || thread.id}
                    value={summaryValue(thread.preview?.trim(), "(no message yet)")}
                  />
                ))}
              </div>
            ) : null}
          </DebugSection>

          <DebugSection storageKey="debug-app-actions-section" title="App Actions" defaultOpen>
            <p className="pt-2 text-xs text-token-foreground-secondary">
              Run a raw app-control action payload against the primary app window. Agent tool availability is controlled
              by the app-control Statsig gate.
            </p>
            <div className="flex flex-col gap-2 py-2">
              <textarea
                className="min-h-48 resize-y rounded border border-token-border bg-token-background-primary p-2 font-mono text-xs text-token-foreground outline-none"
                spellCheck={false}
                value={appActionDraft}
                onChange={(event) => onAppActionDraftChange(event.target.value)}
              />
              <div className="rounded border border-token-border bg-token-foreground/5 px-3 py-2 text-xs whitespace-pre-wrap text-token-foreground">
                {appActionResult}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded border border-token-border px-3 py-1 text-xs text-token-foreground hover:bg-token-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAppActionRunning}
                  onClick={onRunAppAction}
                >
                  {isAppActionRunning ? "Running…" : "Run action"}
                </button>
              </div>
            </div>
          </DebugSection>

          <AmbientSuggestionsDebugSection
            isLoading={isAmbientSuggestionsLoading}
            onRefresh={onRefreshAmbientSuggestions}
            projectlessThreadCwd={projectlessThreadCwd}
            refreshingProjectRoot={refreshingAmbientSuggestionsProjectRoot}
            statuses={ambientSuggestionStatuses}
            workspaceRootOptions={workspaceRootOptions}
          />

          <DebugSection storageKey="debug-workspace-roots-section" title="Workspace roots" defaultOpen>
            {workspaceRootOptions?.roots.length ? (
              <div className="flex flex-col py-1.5">
                {workspaceRootOptions.roots.map((root) => (
                  <DebugField key={root} label={workspaceRootOptions.labels[root] ?? root} value={root} />
                ))}
              </div>
            ) : (
              <DebugEmptyState message="No project roots" />
            )}
            {activeWorkspaceRoots?.roots.length ? (
              <div className="mt-2 rounded-lg border border-token-border bg-token-foreground/[0.025] px-3">
                {activeWorkspaceRoots.roots.map((root) => (
                  <DebugField key={root} label="Active" value={root} />
                ))}
              </div>
            ) : null}
          </DebugSection>

          <DebugSection storageKey="debug-workspace-runtime-section" title="Workspace runtime" defaultOpen>
            {primaryRuntimeStatus ? (
              <div className="flex flex-col gap-3 py-1.5">
                <DebugField label="State" value={primaryRuntimeStatus.enabled ? "Enabled" : "Disabled"} />
                <DebugField
                  label="Disabled"
                  value={summaryValue(primaryRuntimeStatus.disabledReason, "Unavailable")}
                />
                <DebugField
                  label="Next cron"
                  value={primaryRuntimeStatus.nextRunAt === null ? "Unavailable" : new Date(primaryRuntimeStatus.nextRunAt * 1000).toLocaleString()}
                />
                <DebugField
                  label="Startup check"
                  value={primaryRuntimeStatus.startupChecked ? "Complete" : "Pending"}
                />
                <DebugField label="Running" value={primaryRuntimeStatus.isRunning ? "Yes" : "No"} />
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm electron:text-base">Alpha version</div>
                    <div className="truncate text-xs text-token-foreground-secondary">
                      {primaryRuntimeInstallRelease}
                    </div>
                  </div>
                  <ToggleSwitch
                    ariaLabel="Use alpha Codex Workspace install flow"
                    checked={runtimeInstallReleaseChecked}
                    disabled={false}
                    onChange={(checked) =>
                      onPrimaryRuntimeInstallReleaseChange(
                        checked ? PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA : PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
                      )
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex cursor-interaction items-center rounded border border-token-border px-3 py-1 text-xs text-token-foreground hover:bg-token-foreground/5"
                    onClick={onPrimaryRuntimeRunNow}
                  >
                    Run now
                  </button>
                  <button
                    type="button"
                    className="inline-flex cursor-interaction items-center rounded border border-token-border px-3 py-1 text-xs text-token-foreground hover:bg-token-foreground/5"
                    onClick={onPrimaryRuntimeRefresh}
                  >
                    Refresh status
                  </button>
                </div>
              </div>
            ) : (
              <DebugEmptyState message="Loading workspace runtime status…" />
            )}
          </DebugSection>

          <DebugSection storageKey="debug-worktree-cleanup-section" title="Worktree cleanup" defaultOpen>
            {worktreesSettings ? (
              <div className="flex flex-col py-1.5">
                <DebugField
                  label="Worktrees setting"
                  value={worktreesSettings.autoCleanupEnabled ? "Enabled" : "Disabled"}
                />
                <DebugField
                  label="Keep count"
                  value={String(worktreesSettings.keepCount)}
                />
              </div>
            ) : (
              <DebugEmptyState message="Loading worktree cleanup…" />
            )}
          </DebugSection>

          <DebugSection storageKey="debug-user-section" title="User" defaultOpen>
            {authSnapshot ? (
              <div className="flex flex-col py-1.5">
                <DebugField label="Auth Method" value={summaryValue(authSnapshot.authState.authMethod, "none")} />
                <DebugField label="User ID" value={summaryValue(authSnapshot.authState.userId, "Unavailable")} />
                <DebugField
                  label="Account ID"
                  value={summaryValue(authSnapshot.authState.accountId, "Unavailable")}
                />
                <DebugField label="Email" value={summaryValue(authSnapshot.authState.email, "Unavailable")} />
                <DebugField label="Plan" value={summaryValue(authSnapshot.authState.planAtLogin, "Unavailable")} />
                <DebugField
                  label="Auth label"
                  value={formatAuthLabel(authSnapshot, (key) => key)}
                />
                <DebugField
                  label="Auth detail"
                  value={formatAuthDetail(authSnapshot, (key) => key) ?? "Unavailable"}
                />
              </div>
            ) : (
              <DebugEmptyState message="Loading user…" />
            )}
          </DebugSection>

          {showDiagnostics ? (
            <DebugSection storageKey="debug-diagnostics-section" title="Diagnostics" defaultOpen>
              <DebugEmptyState message="Unavailable" />
            </DebugSection>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function DebugLoadingState() {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-token-main-surface-primary text-token-foreground">
      <div className="rounded-xl border border-token-border bg-token-foreground/[0.03] px-4 py-3 text-sm text-token-foreground-secondary">
        Loading…
      </div>
    </main>
  );
}

function summaryValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}
