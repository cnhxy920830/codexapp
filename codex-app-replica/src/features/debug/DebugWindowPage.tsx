import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  CloseTabIcon,
  FolderIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { getAuthSnapshot, initialAuthSnapshot, type AuthSnapshot } from "../../services/auth";
import {
  allowDebugMenu,
  refreshAmbientSuggestions,
  readAmbientSuggestionsGenerationStatuses,
  readAppFlavor,
  readPackagedState,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA,
  primaryRuntimeUpdateRunNow,
  readPrimaryRuntimeUpdateStatus,
  runDebugAppAction,
  setPrimaryRuntimeInstallRelease,
  type AmbientSuggestionsGenerationStatus,
  type PackagedStateResponse,
  type PrimaryRuntimeUpdateRunNowResponse,
  type PrimaryRuntimeUpdateStatusResponse,
} from "../../services/debug";
import type { ThreadConversation } from "../../services/history";
import {
  onPrimaryRuntimeInstallProgress,
  type PrimaryRuntimeInstallProgressEvent,
} from "../../services/primaryRuntime";
import { readProjectlessThreadCwd, type ProjectlessThreadCwdResponse } from "../../services/projectlessThreads";
import {
  getGlobalState,
  onGlobalStateUpdated,
  setGlobalState,
  type HotkeyWindowHotkeyStateResponse,
} from "../../services/settings";
import {
  type AppServerConnectionState,
  readSettingsRemoteConnectionsSnapshot,
  type RemoteConnection,
} from "../../services/settingsHosts";
import type {
  DebugAppServerHostSnapshot,
  DebugAppServerThreadStatusResponse,
} from "../../services/debugAppServer";
import {
  listWorkspaceDirectoryEntries,
  type WorkspaceDirectoryEntry,
} from "../../services/workspaceFiles";
import {
  readWorkspaceRootOptions,
  type WorkspaceRootOptionsResponse,
} from "../../services/workspaceRoots";
import { AmbientSuggestionsDebugSection } from "./AmbientSuggestionsDebugSection";
import {
  GlobalDictationSection,
  LocalConversationSection,
  OnboardingSection,
  PopoutWindowHotkeySection,
  RealtimeVoiceSection,
} from "./DebugParitySections";
import { DebugAppServerSection } from "./DebugAppServerSection";
import { DebugChildProcessesSection } from "./DebugChildProcessesSection";
import { DebugNodeReplSection } from "./DebugNodeReplSection";
import type { DebugOnboardingState } from "./DebugParitySections";
import { DebugEmptyState, DebugField, DebugSection } from "./DebugSectionPrimitives";
import {
  DEFAULT_DEBUG_WINDOW_PARITY_STATE,
  loadDebugWindowParityState,
  shouldRefreshDebugWindowParityState,
} from "./debugWindowPageParityState";
import {
  onDebugWindowOriginConversationChanged,
  takePendingDebugWindowOriginConversation,
} from "../../services/windowNavigation";

const DEFAULT_APP_ACTION_JSON = `{
  "type": "app.get_summary"
}`;

const LOCAL_HOST_ID = "local";
const PROJECT_ROOTS_STORAGE_KEY = "debug-workspace-roots";
const WORKSPACE_RUNTIME_STORAGE_KEY = "debug-workspace-runtime";
const WORKTREE_CLEANUP_STORAGE_KEY = "debug-worktree-cleanup-override";
const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

type DebugWindowPageProps = {
  conversationId: string | null;
  onConversationChange?: (conversationId: string) => void;
  onNavigateHome: () => void;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  threadConversation: ThreadConversation | null;
};

type DebugModalProps = {
  ambientSuggestionStatuses: AmbientSuggestionsGenerationStatus[] | null;
  appActionDraft: string;
  appActionResult: string;
  authSnapshot: AuthSnapshot | null;
  conversationId: string | null;
  debugAppServerInitialConnectionStatesByHostId?: Record<string, AppServerConnectionState>;
  debugAppServerInitialHosts?: DebugAppServerHostSnapshot[];
  debugAppServerInitialThreadStatusesByHostId?: Record<string, DebugAppServerThreadStatusResponse>;
  globalDictationForceLockEnabled: boolean;
  hotkeyWindowState: HotkeyWindowHotkeyStateResponse | null;
  isAppActionRunning: boolean;
  isAmbientSuggestionsLoading: boolean;
  isPackaged: PackagedStateResponse | null;
  onboardingState: DebugOnboardingState;
  onAppActionDraftChange: (value: string) => void;
  onClose: () => void;
  onOpenConversation?: (threadId: string, hostId: string) => void;
  onPopOut?: () => void;
  onPrimaryRuntimeInstallReleaseChange: (release: string) => void;
  onPrimaryRuntimeRefresh: () => void;
  onPrimaryRuntimeRunNow: () => void;
  onRefreshAmbientSuggestions: (projectRoot: string) => void;
  onRunAppAction: () => void;
  primaryRuntimeInstallRelease: string;
  primaryRuntimeInstallProgress: PrimaryRuntimeInstallProgressEvent | null;
  primaryRuntimeLastTrigger: string;
  primaryRuntimeStatus: PrimaryRuntimeUpdateStatusResponse | null;
  projectlessThreadCwd: ProjectlessThreadCwdResponse | null;
  refreshingAmbientSuggestionsProjectRoot: string | null;
  realtimeVoiceDebugDisabled: boolean;
  remoteConnections: RemoteConnection[];
  showHeader?: boolean;
  showPopOutButton?: boolean;
  threadConversation: ThreadConversation | null;
  workspaceRootOptions: WorkspaceRootOptionsResponse | null;
};

type ProjectRootTreeProps = {
  includeHidden: boolean;
  label: string;
  root: string;
};

type ProjectRootDirectoryNodeProps = {
  depth: number;
  entry: WorkspaceDirectoryEntry;
  entriesByDirectory: Map<string, WorkspaceDirectoryEntry[]>;
  expandedDirectories: Set<string>;
  loadingDirectories: Set<string>;
  onToggleDirectory: (directoryPath: string) => void;
};

type WorkspaceRuntimeActionsMenuProps = {
  disabled: boolean;
  installRelease: string;
  isEnabled: boolean;
  isRunning: boolean;
  onInstallReleaseChange: (release: string) => void;
  onRefresh: () => void;
  onRunNow: () => void;
};

export function DebugWindowPage({
  conversationId,
  onConversationChange,
  onNavigateHome,
  onOpenConversation,
  threadConversation,
}: DebugWindowPageProps) {
  const isDebugMenuAllowed = allowDebugMenu();
  const [conversationIdOverride, setConversationIdOverride] = useState<string | null>(conversationId);

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot | null>(null);
  const [workspaceRootOptions, setWorkspaceRootOptions] = useState<WorkspaceRootOptionsResponse | null>(null);
  const [projectlessThreadCwd, setProjectlessThreadCwd] = useState<ProjectlessThreadCwdResponse | null>(null);
  const [ambientSuggestionStatuses, setAmbientSuggestionStatuses] = useState<AmbientSuggestionsGenerationStatus[] | null>(null);
  const [remoteConnections, setRemoteConnections] = useState<RemoteConnection[]>([]);
  const [primaryRuntimeStatus, setPrimaryRuntimeStatus] = useState<PrimaryRuntimeUpdateStatusResponse | null>(null);
  const [primaryRuntimeInstallRelease, setPrimaryRuntimeInstallReleaseState] = useState(
    PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
  );
  const [primaryRuntimeLastTrigger, setPrimaryRuntimeLastTrigger] = useState("Not run yet");
  const [isPackaged, setIsPackaged] = useState<PackagedStateResponse | null>(null);
  const [appActionDraft, setAppActionDraft] = useState(DEFAULT_APP_ACTION_JSON);
  const [appActionResult, setAppActionResult] = useState("Not run yet");
  const [isAppActionRunning, setIsAppActionRunning] = useState(false);
  const [refreshingAmbientSuggestionsProjectRoot, setRefreshingAmbientSuggestionsProjectRoot] = useState<string | null>(null);
  const [debugParityState, setDebugParityState] = useState(DEFAULT_DEBUG_WINDOW_PARITY_STATE);
  const [primaryRuntimeInstallProgress, setPrimaryRuntimeInstallProgress] =
    useState<PrimaryRuntimeInstallProgressEvent | null>(null);

  const appFlavor = readAppFlavor();
  const showAmbientSuggestionsSection = appFlavor === "dev" || appFlavor === "nightly";

  useEffect(() => {
    setConversationIdOverride(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (conversationIdOverride == null || conversationIdOverride === conversationId) {
      return;
    }

    onConversationChange?.(conversationIdOverride);
  }, [conversationId, conversationIdOverride, onConversationChange]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void takePendingDebugWindowOriginConversation()
      .then((pendingConversationId) => {
        if (disposed || pendingConversationId == null) {
          return;
        }

        const normalizedConversationId = pendingConversationId.trim();
        if (normalizedConversationId.length === 0) {
          return;
        }

        setConversationIdOverride(normalizedConversationId);
      })
      .catch(() => undefined);

    void onDebugWindowOriginConversationChanged((nextConversationId) => {
      setConversationIdOverride(nextConversationId);
    })
      .then((dispose) => {
        if (disposed) {
          void dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isDebugMenuAllowed) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      const [
        authSnapshotResult,
        workspaceRootOptionsResult,
        projectlessThreadCwdResult,
        ambientSuggestionStatusesResult,
        primaryRuntimeStatusResult,
        packagedStateResult,
        debugParityStateResult,
      ] = await Promise.all([
        getAuthSnapshot().catch(() => initialAuthSnapshot),
        readWorkspaceRootOptions().catch(() => null),
        showAmbientSuggestionsSection ? readProjectlessThreadCwd().catch(() => null) : Promise.resolve(null),
        showAmbientSuggestionsSection
          ? readAmbientSuggestionsGenerationStatuses().then((response) => response.statuses).catch(() => null)
          : Promise.resolve(null),
        readPrimaryRuntimeUpdateStatus().catch(() => null),
        readPackagedState().catch(() => null),
        loadDebugWindowParityState(),
      ]);

      const remoteConnectionsSnapshot = await readSettingsRemoteConnectionsSnapshot().catch(() => []);

      if (cancelled) {
        return;
      }

      setAuthSnapshot(authSnapshotResult);
      setWorkspaceRootOptions(workspaceRootOptionsResult);
      setProjectlessThreadCwd(projectlessThreadCwdResult);
      setAmbientSuggestionStatuses(ambientSuggestionStatusesResult);
      setRemoteConnections(remoteConnectionsSnapshot);
      setPrimaryRuntimeStatus(primaryRuntimeStatusResult);
      setIsPackaged(packagedStateResult);
      setDebugParityState(debugParityStateResult);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isDebugMenuAllowed, showAmbientSuggestionsSection]);

  useEffect(() => {
    if (!isDebugMenuAllowed) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void onGlobalStateUpdated((notification) => {
      if (!shouldRefreshDebugWindowParityState(notification.keys)) {
        return;
      }

      void loadDebugWindowParityState().then((nextState) => {
        if (!disposed) {
          setDebugParityState(nextState);
        }
      });
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isDebugMenuAllowed]);

  useEffect(() => {
    if (!isDebugMenuAllowed) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void onPrimaryRuntimeInstallProgress((notification) => {
      if (notification.hostId !== LOCAL_HOST_ID) {
        return;
      }

      setPrimaryRuntimeInstallProgress(notification.progress);
      if (notification.progress.phase !== "ready" && notification.progress.phase !== "error") {
        return;
      }

      void readPrimaryRuntimeUpdateStatus()
        .then((nextStatus) => {
          if (!disposed) {
            setPrimaryRuntimeStatus(nextStatus);
          }
        })
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isDebugMenuAllowed]);

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
    try {
      const response = await primaryRuntimeUpdateRunNow();
      setPrimaryRuntimeLastTrigger(formatPrimaryRuntimeRunNowResult(response));
    } catch {
      setPrimaryRuntimeLastTrigger("Failed to trigger cron job");
    }
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
    return <NavigateHome onNavigateHome={onNavigateHome} />;
  }

  return (
    <DebugModal
      ambientSuggestionStatuses={ambientSuggestionStatuses}
      appActionDraft={appActionDraft}
      appActionResult={appActionResult}
      authSnapshot={authSnapshot}
      conversationId={conversationIdOverride}
      debugAppServerInitialThreadStatusesByHostId={undefined}
      globalDictationForceLockEnabled={debugParityState.globalDictationForceLockEnabled}
      hotkeyWindowState={debugParityState.hotkeyWindowState}
      isAmbientSuggestionsLoading={showAmbientSuggestionsSection && ambientSuggestionStatuses === null}
      isAppActionRunning={isAppActionRunning}
      isPackaged={isPackaged}
      onboardingState={debugParityState.onboardingState}
      onAppActionDraftChange={setAppActionDraft}
      onClose={closeDebugWindow}
      onOpenConversation={onOpenConversation}
      onPopOut={undefined}
      onPrimaryRuntimeInstallReleaseChange={handlePrimaryRuntimeInstallReleaseChange}
      onPrimaryRuntimeRefresh={() => void handlePrimaryRuntimeRefresh()}
      onPrimaryRuntimeRunNow={() => void handlePrimaryRuntimeRunNow()}
      onRefreshAmbientSuggestions={(projectRoot) => void handleAmbientSuggestionsRefresh(projectRoot)}
      onRunAppAction={() => void handleRunAppAction()}
      primaryRuntimeInstallRelease={primaryRuntimeInstallRelease}
      primaryRuntimeInstallProgress={primaryRuntimeInstallProgress}
      primaryRuntimeLastTrigger={primaryRuntimeLastTrigger}
      primaryRuntimeStatus={primaryRuntimeStatus}
      projectlessThreadCwd={projectlessThreadCwd}
      refreshingAmbientSuggestionsProjectRoot={refreshingAmbientSuggestionsProjectRoot}
      realtimeVoiceDebugDisabled={debugParityState.realtimeVoiceDebugDisabled}
      remoteConnections={remoteConnections}
      showHeader={false}
      showPopOutButton={false}
      threadConversation={threadConversation}
      workspaceRootOptions={workspaceRootOptions}
    />
  );
}

function NavigateHome({ onNavigateHome }: { onNavigateHome: () => void }) {
  useEffect(() => {
    onNavigateHome();
  }, [onNavigateHome]);

  return null;
}

function closeDebugWindow() {
  if (typeof window !== "undefined" && typeof window.close === "function") {
    window.close();
    return;
  }
}

export function DebugModal({
  ambientSuggestionStatuses,
  appActionDraft,
  appActionResult,
  authSnapshot,
  conversationId,
  debugAppServerInitialConnectionStatesByHostId,
  debugAppServerInitialHosts,
  debugAppServerInitialThreadStatusesByHostId,
  globalDictationForceLockEnabled,
  hotkeyWindowState,
  isAmbientSuggestionsLoading,
  isAppActionRunning,
  isPackaged,
  onboardingState,
  onAppActionDraftChange,
  onClose,
  onOpenConversation,
  onPopOut,
  onPrimaryRuntimeInstallReleaseChange,
  onPrimaryRuntimeRefresh,
  onPrimaryRuntimeRunNow,
  onRefreshAmbientSuggestions,
  onRunAppAction,
  primaryRuntimeInstallRelease,
  primaryRuntimeInstallProgress,
  primaryRuntimeLastTrigger,
  primaryRuntimeStatus,
  projectlessThreadCwd,
  refreshingAmbientSuggestionsProjectRoot,
  realtimeVoiceDebugDisabled,
  remoteConnections,
  showHeader = true,
  showPopOutButton = true,
  threadConversation,
  workspaceRootOptions,
}: DebugModalProps) {
  const showDiagnostics = false;

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
                  <PopOutIcon className="icon-xs" />
                </button>
              ) : null}
              <button
                type="button"
                className="no-drag cursor-interaction rounded p-1 leading-none text-token-foreground/80 hover:bg-token-toolbar-hover-background focus:outline-none focus:ring-1 focus:ring-token-focus-border"
                aria-label="Close"
                onClick={onClose}
              >
                <CloseTabIcon className="icon-xs" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-4" data-debug-panel-scroll-container>
          <DebugSection storageKey="debug-product-events-section" title="Product events" variant="global">
            <DebugEmptyState message="No product events sent yet" />
          </DebugSection>

          <DebugNodeReplSection conversationId={conversationId} threadConversation={threadConversation} />

          {conversationId != null ? (
            <LocalConversationSection
              conversationId={conversationId}
              threadConversation={threadConversation}
            />
          ) : null}

          <DebugChildProcessesSection />

          <DebugAppServerSection
            initialConnectionStatesByHostId={debugAppServerInitialConnectionStatesByHostId}
            initialHosts={debugAppServerInitialHosts}
            initialThreadStatusesByHostId={debugAppServerInitialThreadStatusesByHostId}
            onOpenConversation={onOpenConversation}
            remoteConnections={remoteConnections}
          />

          <AmbientSuggestionsDebugSection
            isLoading={isAmbientSuggestionsLoading}
            onRefresh={onRefreshAmbientSuggestions}
            projectlessThreadCwd={projectlessThreadCwd}
            refreshingProjectRoot={refreshingAmbientSuggestionsProjectRoot}
            statuses={ambientSuggestionStatuses}
            workspaceRootOptions={workspaceRootOptions}
          />

          <OnboardingSection
            authSnapshot={authSnapshot}
            initialState={onboardingState}
            primaryRuntimeInstallProgress={primaryRuntimeInstallProgress}
            workspaceRootCount={workspaceRootOptions?.roots.length ?? 0}
          />

          <ProjectRootsSection workspaceRootOptions={workspaceRootOptions} />

          <WorkspaceRuntimeSection
            installRelease={primaryRuntimeInstallRelease}
            lastTrigger={primaryRuntimeLastTrigger}
            onInstallReleaseChange={onPrimaryRuntimeInstallReleaseChange}
            onRefresh={onPrimaryRuntimeRefresh}
            onRunNow={onPrimaryRuntimeRunNow}
            primaryRuntimeStatus={primaryRuntimeStatus}
          />

          <RealtimeVoiceSection initialDebugDisabled={realtimeVoiceDebugDisabled} />

          {isPackaged?.isPackaged === false ? (
            <GlobalDictationSection initialForceLockEnabled={globalDictationForceLockEnabled} />
          ) : null}

          <DebugSection
            storageKey="debug-app-actions"
            title="App Actions"
            variant="global"
            actions={
              <button
                type="button"
                className="inline-flex items-center rounded border border-token-border px-3 py-1 text-xs text-token-foreground hover:bg-token-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isAppActionRunning}
                onClick={onRunAppAction}
              >
                {isAppActionRunning ? "Running…" : "Run action"}
              </button>
            }
          >
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
            </div>
          </DebugSection>

          {isPackaged?.isPackaged === false ? <WorktreeCleanupSection /> : null}

          <PopoutWindowHotkeySection initialState={hotkeyWindowState} />

          <DebugSection storageKey="debug-user-section" title="User" variant="global">
            {authSnapshot ? (
              <div className="flex flex-col py-1.5">
                <DebugField label="Auth Method" value={summaryValue(authSnapshot.authState.authMethod, "none")} />
                <DebugField label="User ID" value={summaryValue(authSnapshot.authState.userId, "Unavailable")} />
                <DebugField
                  label="Account ID"
                  value={summaryValue(authSnapshot.authState.accountId, "Unavailable")}
                />
                <DebugField label="Email" value={summaryValue(authSnapshot.authState.email, "Unavailable")} />
              </div>
            ) : (
              <DebugEmptyState message="Loading user…" />
            )}
          </DebugSection>

          {showDiagnostics ? (
            <DebugSection storageKey="debug-diagnostics-section" title="Diagnostics" variant="global">
              <DebugEmptyState message="Unavailable" />
            </DebugSection>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ProjectRootsSection({ workspaceRootOptions }: { workspaceRootOptions: WorkspaceRootOptionsResponse | null }) {
  const [isSectionOpen, setIsSectionOpen] = useState(() => readStoredSectionOpen(PROJECT_ROOTS_STORAGE_KEY));
  const [includeHidden, setIncludeHidden] = useState(false);
  const roots = workspaceRootOptions?.roots ?? [];
  const labels = workspaceRootOptions?.labels ?? {};

  return (
    <DebugSection
      storageKey={PROJECT_ROOTS_STORAGE_KEY}
      title="Project roots"
      variant="global"
      onToggle={setIsSectionOpen}
      actions={
        isSectionOpen ? (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-xs hover:bg-token-foreground/10"
            onClick={() => setIncludeHidden((current) => !current)}
          >
            {includeHidden ? "Hide dotfiles" : "Show dotfiles"}
          </button>
        ) : null
      }
    >
      {isSectionOpen ? (
        roots.length === 0 ? (
          <div className="py-2 text-token-description-foreground">No project roots</div>
        ) : (
          roots.map((root) => (
            <ProjectRootTree
              key={root}
              includeHidden={includeHidden}
              label={labels[root] ?? root}
              root={root}
            />
          ))
        )
      ) : null}
    </DebugSection>
  );
}

function ProjectRootTree({ includeHidden, label, root }: ProjectRootTreeProps) {
  const [expanded, setExpanded] = useState(false);
  const [rootEntries, setRootEntries] = useState<WorkspaceDirectoryEntry[] | null>(null);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(() => new Set());
  const [entriesByDirectory, setEntriesByDirectory] = useState<Map<string, WorkspaceDirectoryEntry[]>>(() => new Map());
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setRootEntries(null);
    setExpandedDirectories(new Set());
    setEntriesByDirectory(new Map());
    setLoadingDirectories(new Set());
  }, [includeHidden, root]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    if (rootEntries !== null) {
      return;
    }

    let cancelled = false;
    setLoadingDirectories(new Set([""]));
    void listWorkspaceDirectoryEntries({ workspaceRoot: root, includeHidden })
      .then((entries) => {
        if (!cancelled) {
          setRootEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRootEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDirectories(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, includeHidden, root, rootEntries]);

  const toggleDirectory = (directoryPath: string) => {
    setExpandedDirectories((current) => {
      const next = new Set(current);
      if (next.has(directoryPath)) {
        next.delete(directoryPath);
      } else {
        next.add(directoryPath);
      }
      return next;
    });

    if (entriesByDirectory.has(directoryPath) || loadingDirectories.has(directoryPath)) {
      return;
    }

    setLoadingDirectories((current) => new Set(current).add(directoryPath));
    void listWorkspaceDirectoryEntries({
      workspaceRoot: root,
      directoryPath,
      includeHidden,
    })
      .then((entries) => {
        setEntriesByDirectory((current) => {
          const next = new Map(current);
          next.set(directoryPath, entries);
          return next;
        });
      })
      .catch(() => {
        setEntriesByDirectory((current) => {
          const next = new Map(current);
          next.set(directoryPath, []);
          return next;
        });
      })
      .finally(() => {
        setLoadingDirectories((current) => {
          const next = new Set(current);
          next.delete(directoryPath);
          return next;
        });
      });
  };

  return (
    <div className="border-t border-token-border/50 first:border-t-0">
      <button
        type="button"
        className="flex w-full items-start gap-2 py-2 text-left"
        onClick={() => setExpanded((current) => !current)}
      >
        <span
          className="icon-2xs mt-1 shrink-0 transition-transform duration-150"
          style={{ transform: `rotate(${expanded ? 0 : -90}deg)` }}
        >
          <ChevronDownIcon className="icon-2xs" />
        </span>
        <div className="min-w-0">
          <div>{label}</div>
          <div className="text-xs text-token-description-foreground">{root}</div>
        </div>
      </button>
      {expanded ? (
        <div className="pb-1">
          {loadingDirectories.has("") && rootEntries === null ? (
            <div className="px-2 py-2 text-xs text-token-description-foreground">Loading project root…</div>
          ) : rootEntries != null && rootEntries.length === 0 ? (
            <div className="px-2 py-2 text-xs text-token-description-foreground">This project root is empty</div>
          ) : (
            (rootEntries ?? []).map((entry) => (
              <ProjectRootDirectoryNode
                key={`${entry.entryType}:${entry.path}`}
                depth={0}
                entry={entry}
                entriesByDirectory={entriesByDirectory}
                expandedDirectories={expandedDirectories}
                loadingDirectories={loadingDirectories}
                onToggleDirectory={toggleDirectory}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProjectRootDirectoryNode({
  depth,
  entry,
  entriesByDirectory,
  expandedDirectories,
  loadingDirectories,
  onToggleDirectory,
}: ProjectRootDirectoryNodeProps) {
  if (entry.entryType === "file") {
    return (
      <div
        className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px]"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-token-description-foreground" />
        <span className="truncate">{entry.name}</span>
      </div>
    );
  }

  const isExpanded = expandedDirectories.has(entry.path);
  const childEntries = entriesByDirectory.get(entry.path) ?? [];
  const isLoading = loadingDirectories.has(entry.path);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px] hover:bg-token-foreground/5"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onToggleDirectory(entry.path)}
      >
        <span
          className="icon-2xs shrink-0 transition-transform duration-150"
          style={{ transform: `rotate(${isExpanded ? 0 : -90}deg)` }}
        >
          <ChevronDownIcon className="icon-2xs" />
        </span>
        <FolderIcon className="h-4 w-4 shrink-0 text-token-description-foreground" />
        <span className="truncate">{entry.name}</span>
      </button>
      {isExpanded ? (
        isLoading ? (
          <div
            className="px-2 py-2 text-xs text-token-description-foreground"
            style={{ paddingLeft: `${24 + depth * 16}px` }}
          >
            Loading…
          </div>
        ) : childEntries.length === 0 ? (
          <div
            className="px-2 py-2 text-xs text-token-description-foreground"
            style={{ paddingLeft: `${24 + depth * 16}px` }}
          >
            Empty
          </div>
        ) : (
          childEntries.map((childEntry) => (
            <ProjectRootDirectoryNode
              key={`${childEntry.entryType}:${childEntry.path}`}
              depth={depth + 1}
              entry={childEntry}
              entriesByDirectory={entriesByDirectory}
              expandedDirectories={expandedDirectories}
              loadingDirectories={loadingDirectories}
              onToggleDirectory={onToggleDirectory}
            />
          ))
        )
      ) : null}
    </div>
  );
}

function WorkspaceRuntimeSection({
  installRelease,
  lastTrigger,
  onInstallReleaseChange,
  onRefresh,
  onRunNow,
  primaryRuntimeStatus,
}: {
  installRelease: string;
  lastTrigger: string;
  onInstallReleaseChange: (release: string) => void;
  onRefresh: () => void;
  onRunNow: () => void;
  primaryRuntimeStatus: PrimaryRuntimeUpdateStatusResponse | null;
}) {
  const [isSectionOpen, setIsSectionOpen] = useState(() => readStoredSectionOpen(WORKSPACE_RUNTIME_STORAGE_KEY));
  const isRunning = primaryRuntimeStatus?.isRunning === true;
  const actionsVisible = isSectionOpen && primaryRuntimeStatus !== null;

  return (
    <DebugSection
      storageKey={WORKSPACE_RUNTIME_STORAGE_KEY}
      title="Workspace runtime"
      variant="global"
      onToggle={setIsSectionOpen}
      actions={
        actionsVisible ? (
          <WorkspaceRuntimeActionsMenu
            disabled={isRunning}
            installRelease={installRelease}
            isEnabled={primaryRuntimeStatus?.enabled === true}
            isRunning={isRunning}
            onInstallReleaseChange={onInstallReleaseChange}
            onRefresh={onRefresh}
            onRunNow={onRunNow}
          />
        ) : null
      }
    >
      {primaryRuntimeStatus ? (
        <div className="flex flex-col py-1.5">
          <DebugField label="State" value={primaryRuntimeStatus.enabled ? "Enabled" : "Disabled"} />
          {primaryRuntimeStatus.disabledReason == null ? null : (
            <DebugField
              label="Disabled"
              value={formatPrimaryRuntimeDisabledReason(primaryRuntimeStatus.disabledReason)}
            />
          )}
          <DebugField label="Next cron" value={formatPrimaryRuntimeNextRun(primaryRuntimeStatus.nextRunAt)} />
          <DebugField label="Startup check" value={primaryRuntimeStatus.startupChecked ? "Complete" : "Pending"} />
          <DebugField label="Running" value={isRunning ? "Yes" : "No"} />
          <DebugField label="Last trigger" value={lastTrigger} />
        </div>
      ) : (
        <DebugEmptyState message="Loading workspace runtime status…" />
      )}
    </DebugSection>
  );
}

function WorkspaceRuntimeActionsMenu({
  disabled,
  installRelease,
  isEnabled,
  isRunning,
  onInstallReleaseChange,
  onRefresh,
  onRunNow,
}: WorkspaceRuntimeActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const alphaEnabled = installRelease === PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex cursor-interaction items-center gap-1.5 rounded px-1.5 py-0.5 text-xs hover:bg-token-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {isRunning ? <Spinner className="icon-2xs" /> : null}
        Cron
        <ChevronDownIcon className="icon-2xs opacity-70" />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+8px)] right-0 z-20 flex min-w-[220px] flex-col gap-0.5 rounded-[14px] border border-token-border bg-token-dropdown-background p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="px-3 py-1 text-xs font-medium text-token-description-foreground">Workspace runtime cron</div>
          <button
            type="button"
            className="rounded-[10px] px-3 py-2 text-left text-sm hover:bg-token-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRunning || !isEnabled}
            onClick={() => {
              setOpen(false);
              onRunNow();
            }}
          >
            Run now
          </button>
          <button
            type="button"
            className="rounded-[10px] px-3 py-2 text-left text-sm hover:bg-token-foreground/5"
            onClick={() => {
              setOpen(false);
              onRefresh();
            }}
          >
            Refresh status
          </button>
          <div className="my-1 h-px bg-token-border" />
          <div className="px-3 py-1 text-xs font-medium text-token-description-foreground">Install flow</div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm electron:text-base">Alpha version</div>
              <div className="truncate text-xs text-token-description-foreground">{installRelease}</div>
            </div>
            <ToggleSwitch
              ariaLabel="Use alpha Codex Workspace install flow"
              checked={alphaEnabled}
              disabled={false}
              onChange={(checked) =>
                onInstallReleaseChange(
                  checked ? PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST_ALPHA : PRIMARY_RUNTIME_INSTALL_RELEASE_LATEST,
                )
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorktreeCleanupSection() {
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState<boolean | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [autoCleanupResponse, overrideResponse] = await Promise.all([
        getGlobalState("worktree-auto-cleanup-enabled").catch(() => ({ value: true })),
        getGlobalState("worktree-auto-cleanup-unpackaged-override-enabled").catch(() => ({ value: false })),
      ]);

      if (cancelled) {
        return;
      }

      setAutoCleanupEnabled(typeof autoCleanupResponse.value === "boolean" ? autoCleanupResponse.value : true);
      setOverrideEnabled(overrideResponse.value === true);
      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleOverride = async (checked: boolean) => {
    const previousOverrideEnabled = overrideEnabled;
    setError(null);
    setOverrideEnabled(checked);
    try {
      await setGlobalState("worktree-auto-cleanup-unpackaged-override-enabled", checked);
    } catch (nextError) {
      setOverrideEnabled(previousOverrideEnabled);
      setError(nextError instanceof Error ? nextError.message : "Failed to update worktree cleanup override.");
    }
  };

  if (isLoading || autoCleanupEnabled == null || overrideEnabled == null) {
    return (
      <DebugSection storageKey={WORKTREE_CLEANUP_STORAGE_KEY} title="Worktree cleanup" variant="global">
        <DebugEmptyState message="Loading worktree cleanup…" />
      </DebugSection>
    );
  }

  const effectiveCleanup = autoCleanupEnabled && overrideEnabled;

  return (
    <DebugSection storageKey={WORKTREE_CLEANUP_STORAGE_KEY} title="Worktree cleanup" variant="global">
      <div className="flex flex-col py-1.5">
        <DebugField label="Worktrees setting" value={autoCleanupEnabled ? "Enabled" : "Disabled"} />
        <DebugField label="Source-build override" value={overrideEnabled ? "Enabled" : "Disabled"} />
        <DebugField label="Effective cleanup" value={effectiveCleanup ? "Enabled" : "Disabled"} />
      </div>
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="text-xs text-token-description-foreground">
          Allow automatic worktree cleanup in this unpackaged build.
        </div>
        <ToggleSwitch
          ariaLabel="Enable worktree cleanup in this unpackaged build"
          checked={overrideEnabled}
          disabled={false}
          onChange={(checked) => {
            void handleToggleOverride(checked);
          }}
        />
      </div>
      {error ? <div className="py-1.5 text-xs text-token-error-foreground">{error}</div> : null}
    </DebugSection>
  );
}

function PopOutIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12.8333 3.49988H16.5V7.16655"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.9998 7.99988L16.3332 3.66655"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.3335 4.33325H7.00016C5.5274 4.33325 4.3335 5.52716 4.3335 6.99992V12.9999C4.3335 14.4727 5.5274 15.6666 7.00016 15.6666H13.0002C14.4729 15.6666 15.6668 14.4727 15.6668 12.9999V10.6666"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function summaryValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function readStoredSectionOpen(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "open";
  } catch {
    return false;
  }
}

function formatPrimaryRuntimeNextRun(nextRunAt: number | null) {
  if (nextRunAt == null) {
    return "Unavailable";
  }

  const nextRunDate = new Date(nextRunAt);
  const remainingSeconds = Math.ceil((nextRunAt - Date.now()) / 1000);
  if (remainingSeconds <= 0) {
    return `Due now (${nextRunDate.toLocaleString()})`;
  }
  if (remainingSeconds < 60) {
    return `${nextRunDate.toLocaleString()} (${RELATIVE_TIME_FORMAT.format(remainingSeconds, "second")})`;
  }

  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  if (remainingMinutes < 60) {
    return `${nextRunDate.toLocaleString()} (${RELATIVE_TIME_FORMAT.format(remainingMinutes, "minute")})`;
  }

  return `${nextRunDate.toLocaleString()} (${RELATIVE_TIME_FORMAT.format(Math.ceil(remainingMinutes / 60), "hour")})`;
}

function formatPrimaryRuntimeRunNowResult(response: PrimaryRuntimeUpdateRunNowResponse) {
  switch (response.status) {
    case "already-current":
      return response.bundleVersion == null ? "Already current" : `Already current (${response.bundleVersion})`;
    case "installed":
      return response.bundleVersion == null ? "Install started" : `Installed ${response.bundleVersion}`;
    case "skipped":
      return response.reason == null ? "Skipped" : `Skipped: ${formatPrimaryRuntimeRunNowReason(response.reason)}`;
  }
}

function formatPrimaryRuntimeRunNowReason(reason: PrimaryRuntimeUpdateRunNowResponse["reason"]) {
  switch (reason) {
    case "already-running":
      return "already running";
    case "current":
      return "already current";
    case "feature-gate-disabled":
      return "feature gate disabled";
    case "not-local-host":
      return "not local host";
    case "runtime-config-missing":
      return "runtime config missing";
    case "unsupported-windows-version":
      return "unsupported Windows version";
    case null:
      return "unknown";
  }
}

function formatPrimaryRuntimeDisabledReason(reason: string) {
  switch (reason) {
    case "feature-gate-disabled":
      return "Feature gate disabled";
    case "not-local-host":
      return "Not local host";
    case "runtime-config-missing":
      return "Runtime config missing";
    case "unsupported-windows-version":
      return "Unsupported Windows version";
    default:
      return reason;
  }
}
