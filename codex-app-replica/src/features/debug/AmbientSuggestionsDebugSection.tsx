import { DebugEmptyState, DebugSection } from "./DebugSectionPrimitives";
import { readAppFlavor, type AmbientSuggestionsGenerationStatus } from "../../services/debug";
import type { ProjectlessThreadCwdResponse } from "../../services/projectlessThreads";
import type { WorkspaceRootOptionsResponse } from "../../services/workspaceRoots";

type AmbientSuggestionsDebugSectionProps = {
  isLoading: boolean;
  projectlessThreadCwd: ProjectlessThreadCwdResponse | null;
  refreshingProjectRoot: string | null;
  statuses: AmbientSuggestionsGenerationStatus[] | null;
  onRefresh: (projectRoot: string) => void;
  workspaceRootOptions: WorkspaceRootOptionsResponse | null;
};

type AmbientSuggestionChatEntry = {
  projectRoot: string;
  title: string;
};

const AMBIENT_SUGGESTION_DEBUG_STORAGE_KEY = "debug-ambient-suggestion-threads";
const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function AmbientSuggestionsDebugSection({
  isLoading,
  projectlessThreadCwd,
  refreshingProjectRoot,
  statuses,
  onRefresh,
  workspaceRootOptions,
}: AmbientSuggestionsDebugSectionProps) {
  const appFlavor = readAppFlavor();
  if (appFlavor !== "dev" && appFlavor !== "nightly") {
    return null;
  }

  const entries = buildAmbientSuggestionEntries({
    labels: workspaceRootOptions?.labels,
    projectlessThreadCwd: projectlessThreadCwd?.cwd ?? null,
    statuses,
    workspaceRoots: workspaceRootOptions?.roots,
  });
  const statusesByProjectRoot = new Map((statuses ?? []).map((status) => [status.projectRoot, status]));
  const title = entries.length > 0 ? `Ambient suggestion chats (${entries.length})` : "Ambient suggestion chats";

  return (
    <DebugSection storageKey={AMBIENT_SUGGESTION_DEBUG_STORAGE_KEY} title={title}>
      {isLoading && statuses === null && workspaceRootOptions === null ? (
        <DebugEmptyState message="Loading ambient suggestion status..." />
      ) : entries.length === 0 ? (
        <DebugEmptyState message="No project roots" />
      ) : (
        <div className="flex flex-col py-1.5">
          {entries.map((entry) => {
            const status = statusesByProjectRoot.get(entry.projectRoot);
            const statusLabel = getAmbientSuggestionStatusLabel(status);
            const subtitle = describeAmbientSuggestionStatus(status, entry.projectRoot);
            const isRunning = (status?.runningCount ?? 0) > 0 || (status?.safetyRunningCount ?? 0) > 0;
            const isRefreshDisabled = isRunning || refreshingProjectRoot !== null;

            return (
              <div
                key={entry.projectRoot}
                className="flex items-start justify-between gap-3 border-t-[0.5px] border-token-border py-1.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-token-foreground">{entry.title}</div>
                  <div className="break-words text-xs text-token-description-foreground">{subtitle}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="shrink-0 rounded border border-token-border px-2 py-0.5 text-xs text-token-foreground">
                    {statusLabel}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 cursor-interaction rounded border border-token-border px-2 py-0.5 text-xs text-token-foreground hover:bg-token-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRefreshDisabled}
                    onClick={() => onRefresh(entry.projectRoot)}
                  >
                    Refresh now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DebugSection>
  );
}

function buildAmbientSuggestionEntries({
  labels,
  projectlessThreadCwd,
  statuses,
  workspaceRoots,
}: {
  labels: Record<string, string> | undefined;
  projectlessThreadCwd: string | null;
  statuses: AmbientSuggestionsGenerationStatus[] | null;
  workspaceRoots: string[] | undefined;
}) {
  const entries = new Map<string, AmbientSuggestionChatEntry>();

  for (const workspaceRoot of workspaceRoots ?? []) {
    entries.set(workspaceRoot, {
      projectRoot: workspaceRoot,
      title: labels?.[workspaceRoot] ?? workspaceRoot,
    });
  }

  for (const status of statuses ?? []) {
    if (!entries.has(status.projectRoot)) {
      entries.set(status.projectRoot, {
        projectRoot: status.projectRoot,
        title: labels?.[status.projectRoot] ?? status.projectRoot,
      });
    }
  }

  if (projectlessThreadCwd !== null) {
    entries.set(projectlessThreadCwd, {
      projectRoot: projectlessThreadCwd,
      title: "Projectless chat",
    });
  }

  return Array.from(entries.values());
}

function describeAmbientSuggestionStatus(
  status: AmbientSuggestionsGenerationStatus | undefined,
  projectRoot: string,
) {
  const suffix = ` • ${projectRoot}`;
  const safetyRunningCount = status?.safetyRunningCount ?? 0;
  const runningCount = status?.runningCount ?? 0;

  if (safetyRunningCount > 0) {
    const startedAt = status?.safetyStartedAtMs ?? null;
    if (startedAt === null) {
      return `${safetyRunningCount} safety check active${suffix}`;
    }
    return `${safetyRunningCount} safety check active • started ${formatRelativeTime(startedAt)}${suffix}`;
  }

  if (runningCount > 0) {
    const startedAt = status?.runningStartedAtMs ?? null;
    if (startedAt === null) {
      return `${runningCount} active${suffix}`;
    }
    return `${runningCount} active • started ${formatRelativeTime(startedAt)}${suffix}`;
  }

  if (status?.lastFinishedAtMs == null) {
    return `No completed run yet${suffix}`;
  }

  return `Finished ${formatRelativeTime(status.lastFinishedAtMs)}${suffix}`;
}

function getAmbientSuggestionStatusLabel(status: AmbientSuggestionsGenerationStatus | undefined) {
  if ((status?.safetyRunningCount ?? 0) > 0) {
    return "Checking safety";
  }
  if ((status?.runningCount ?? 0) > 0) {
    return "Running";
  }
  return "Idle";
}

function formatRelativeTime(timestampMs: number) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (elapsedSeconds < 60) {
    return RELATIVE_TIME_FORMAT.format(-elapsedSeconds, "second");
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return RELATIVE_TIME_FORMAT.format(-elapsedMinutes, "minute");
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return RELATIVE_TIME_FORMAT.format(-elapsedHours, "hour");
}
