import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { CheckIcon, ChevronDownIcon, MoreActionsIcon, RefreshIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsRow } from "./SettingsRow";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import { useI18n } from "../i18n/i18n";
import type { MessageKey, MessageValues } from "../i18n/messages";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import { openFile } from "../services/hostFiles";
import {
  invalidateHooksQueries,
  listHooksForHost,
  onHooksQueryInvalidated,
  setHookEnabledForHost,
  type HookEventName,
  type HookLoadErrorInfo,
  type HookMetadata,
  type HookSource,
  type HooksListEntry,
} from "../services/hooks";
import {
  LOCAL_SETTINGS_HOST_ID,
  REMOTE_PROJECTS_SHARED_OBJECT_KEY,
  onSharedObjectUpdated,
  readSettingsRemoteProjectsSnapshot,
} from "../services/settingsHosts";
import {
  onActiveWorkspaceRootsUpdated,
  onWorkspaceRootOptionsUpdated,
  readActiveWorkspaceRoots,
  readWorkspaceRootOptions,
  type WorkspaceRootOptionsResponse,
} from "../services/workspaceRoots";

const HOOKS_DOCS_URL = "https://developers.openai.com/codex/hooks";
const HOOK_EVENT_ORDER: HookEventName[] = [
  "preToolUse",
  "permissionRequest",
  "postToolUse",
  "sessionStart",
  "userPromptSubmit",
  "stop",
];

type Translate = (key: MessageKey, values?: MessageValues) => string;

type HookEventSummary = {
  eventName: HookEventName;
  active: number;
  installed: number;
};

type HookProjectRootsState = {
  labels: Record<string, string>;
  roots: string[];
};

export function HooksSettings({
  onShowToast,
  selectedHostId,
  settingsCwd = null,
}: {
  onShowToast?: (toast: AppToast) => void;
  selectedHostId: string;
  settingsCwd?: string | null;
}) {
  const { t } = useI18n();
  const isRemoteHost = selectedHostId !== LOCAL_SETTINGS_HOST_ID;
  const [projectRootsState, setProjectRootsState] = useState<HookProjectRootsState>({
    labels: {},
    roots: [],
  });
  const [activeProjectRoots, setActiveProjectRoots] = useState<string[]>([]);
  const [isLoadingProjectRoots, setIsLoadingProjectRoots] = useState(true);
  const [hooksEntry, setHooksEntry] = useState<HooksListEntry | null>(null);
  const [isLoadingHooks, setIsLoadingHooks] = useState(false);
  const [isRefreshingHooks, setIsRefreshingHooks] = useState(false);
  const [hooksLoadError, setHooksLoadError] = useState<Error | null>(null);
  const [selectedProjectRootState, setSelectedProjectRootState] = useState<string | null>(null);
  const [projectRootsReloadNonce, setProjectRootsReloadNonce] = useState(0);
  const projectRootsRequestIdRef = useRef(0);
  const hooksRequestIdRef = useRef(0);
  const skipNextHooksInvalidationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++projectRootsRequestIdRef.current;

    setIsLoadingProjectRoots(true);

    const loadProjectRoots = async () => {
      if (isRemoteHost) {
        const remoteProjects = await readSettingsRemoteProjectsSnapshot();
        if (cancelled || requestId !== projectRootsRequestIdRef.current) {
          return;
        }

        const remoteProjectsForSelectedHost = remoteProjects.filter((project) => project.hostId === selectedHostId);
        setProjectRootsState({
          labels: Object.fromEntries(
            remoteProjectsForSelectedHost.map((project) => [project.remotePath, project.label]),
          ),
          roots: remoteProjectsForSelectedHost.map((project) => project.remotePath),
        });
        setActiveProjectRoots([]);
        return;
      }

      const [optionsResult, activeRootsResult] = await Promise.allSettled([
        readWorkspaceRootOptions(selectedHostId),
        readActiveWorkspaceRoots(selectedHostId),
      ]);
      if (cancelled || requestId !== projectRootsRequestIdRef.current) {
        return;
      }

      const nextProjectRootsState = optionsResult.status === "fulfilled"
        ? optionsResult.value
        : createEmptyWorkspaceRootOptionsResponse();
      const nextActiveProjectRoots = activeRootsResult.status === "fulfilled"
        ? activeRootsResult.value.roots
        : [];

      setProjectRootsState({
        labels: nextProjectRootsState.labels,
        roots: nextProjectRootsState.roots,
      });
      setActiveProjectRoots(nextActiveProjectRoots);
    };

    void loadProjectRoots()
      .finally(() => {
        if (!cancelled && requestId === projectRootsRequestIdRef.current) {
          setIsLoadingProjectRoots(false);
        }
      });

    return () => {
      cancelled = true;
      if (requestId === projectRootsRequestIdRef.current) {
        projectRootsRequestIdRef.current += 1;
      }
    };
  }, [isRemoteHost, projectRootsReloadNonce, selectedHostId]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const subscribe = isRemoteHost
      ? onSharedObjectUpdated((notification) => {
          if (!disposed && notification.key === REMOTE_PROJECTS_SHARED_OBJECT_KEY) {
            setProjectRootsReloadNonce((current) => current + 1);
          }
        })
      : Promise.all([
          onWorkspaceRootOptionsUpdated(() => {
            if (!disposed) {
              setProjectRootsReloadNonce((current) => current + 1);
            }
          }),
          onActiveWorkspaceRootsUpdated(() => {
            if (!disposed) {
              setProjectRootsReloadNonce((current) => current + 1);
            }
          }),
        ]).then(([disposeOptions, disposeActive]) => {
          return () => {
            disposeOptions();
            disposeActive();
          };
        });

    void subscribe.then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [isRemoteHost]);

  const defaultProjectRoot = isRemoteHost
    ? settingsCwd
    : activeProjectRoots[0] ?? settingsCwd;
  const projectRoots = useMemo(
    () => uniqueProjectRoots(projectRootsState.roots, defaultProjectRoot),
    [defaultProjectRoot, projectRootsState.roots],
  );
  const selectedProjectRoot = useMemo(() => {
    if (selectedProjectRootState && projectRoots.includes(selectedProjectRootState)) {
      return selectedProjectRootState;
    }
    return defaultProjectRoot ?? projectRoots[0] ?? null;
  }, [defaultProjectRoot, projectRoots, selectedProjectRootState]);

  const loadHooksForProject = useEffectEvent(
    async (projectRoot: string, options?: { refreshing?: boolean }) => {
      const requestId = ++hooksRequestIdRef.current;
      const isRefreshing = options?.refreshing === true;

      setHooksLoadError(null);
      if (isRefreshing) {
        setIsRefreshingHooks(true);
      } else {
        setIsLoadingHooks(true);
      }

      try {
        const response = await listHooksForHost({
          hostId: selectedHostId,
          cwd: projectRoot,
        });
        if (requestId !== hooksRequestIdRef.current) {
          return false;
        }

        const nextEntry = response.data.find((entry) => entry.cwd === projectRoot) ?? null;
        setHooksEntry(nextEntry);
        setHooksLoadError(null);
        return true;
      } catch (error) {
        if (requestId !== hooksRequestIdRef.current) {
          return false;
        }

        setHooksEntry(null);
        setHooksLoadError(toError(error));
        return false;
      } finally {
        if (requestId !== hooksRequestIdRef.current) {
          return;
        }
        if (isRefreshing) {
          setIsRefreshingHooks(false);
        } else {
          setIsLoadingHooks(false);
        }
      }
    },
  );

  useEffect(() => {
    if (selectedProjectRoot === null) {
      hooksRequestIdRef.current += 1;
      setHooksEntry(null);
      setHooksLoadError(null);
      setIsLoadingHooks(false);
      setIsRefreshingHooks(false);
      return;
    }

    setHooksEntry(null);
    setHooksLoadError(null);
    void loadHooksForProject(selectedProjectRoot);
  }, [selectedHostId, selectedProjectRoot]);

  const handleHooksQueryInvalidated = useEffectEvent(() => {
    if (skipNextHooksInvalidationRef.current > 0) {
      skipNextHooksInvalidationRef.current -= 1;
      return;
    }
    if (selectedProjectRoot === null) {
      return;
    }
    void loadHooksForProject(selectedProjectRoot, { refreshing: true });
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onHooksQueryInvalidated(() => {
      if (!disposed) {
        handleHooksQueryInvalidated();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const refreshHooks = useEffectEvent(async () => {
    if (selectedProjectRoot === null) {
      return;
    }

    const success = await loadHooksForProject(selectedProjectRoot, { refreshing: true });
    if (!success) {
      return;
    }

    skipNextHooksInvalidationRef.current += 1;
    await invalidateHooksQueries();
    onShowToast?.({
      tone: "success",
      message: t("settings.hooks.refresh.success"),
    });
  });

  const toggleHookEnabled = useEffectEvent(
    async (hook: HookMetadata, enabled: boolean) => {
      if (hook.isManaged || selectedProjectRoot === null) {
        return;
      }

      const previousEntry = hooksEntry;
      setHooksEntry((current) =>
        current === null
          ? current
          : {
              ...current,
              hooks: current.hooks.map((currentHook) =>
                currentHook.key === hook.key
                  ? {
                      ...currentHook,
                      enabled,
                    }
                  : currentHook
              ),
            },
      );

      try {
        await setHookEnabledForHost({
          hostId: selectedHostId,
          key: hook.key,
          enabled,
        });

        const success = await loadHooksForProject(selectedProjectRoot, { refreshing: true });
        if (!success) {
          return;
        }

        skipNextHooksInvalidationRef.current += 1;
        await invalidateHooksQueries();
      } catch {
        setHooksEntry(previousEntry);
      }
    },
  );

  const openHookSourceFile = useEffectEvent(async (hook: HookMetadata) => {
    if (isRemoteHost) {
      return;
    }

    try {
      await openFile({
        hostId: selectedHostId,
        path: hook.sourcePath,
        cwd: null,
      });
    } catch {
      // The upstream surface does not add local fallback messaging here.
    }
  });

  return (
    <HooksSettingsContent
      key={`${selectedHostId}:${selectedProjectRoot ?? "none"}`}
      entry={hooksEntry}
      isLoading={isLoadingHooks}
      isLoadingProjectRoots={isLoadingProjectRoots}
      isRefreshing={isRefreshingHooks}
      isRemoteHost={isRemoteHost}
      loadError={hooksLoadError}
      projectRootLabels={projectRootsState.labels}
      projectRoots={projectRoots}
      selectedProjectRoot={selectedProjectRoot}
      onOpenSourceFile={(hook) => void openHookSourceFile(hook)}
      onRefreshHooks={() => void refreshHooks()}
      onSelectProjectRoot={setSelectedProjectRootState}
      onToggleHookEnabled={(hook, enabled) => void toggleHookEnabled(hook, enabled)}
    />
  );
}

function HooksSettingsContent({
  entry,
  isLoading,
  isLoadingProjectRoots,
  isRefreshing,
  isRemoteHost,
  loadError,
  projectRootLabels,
  projectRoots,
  selectedProjectRoot,
  onOpenSourceFile,
  onRefreshHooks,
  onSelectProjectRoot,
  onToggleHookEnabled,
}: {
  entry: HooksListEntry | null;
  isLoading: boolean;
  isLoadingProjectRoots: boolean;
  isRefreshing: boolean;
  isRemoteHost: boolean;
  loadError: Error | null;
  projectRootLabels: Record<string, string>;
  projectRoots: string[];
  selectedProjectRoot: string | null;
  onOpenSourceFile: (hook: HookMetadata) => void;
  onRefreshHooks: () => void;
  onSelectProjectRoot: (projectRoot: string) => void;
  onToggleHookEnabled: (hook: HookMetadata, enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const [expandedEventNames, setExpandedEventNames] = useState<string[]>([]);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const hooks = entry?.hooks ?? [];
  const warnings = entry?.warnings ?? [];
  const errors = entry?.errors ?? [];
  const issueCount = warnings.length + errors.length;
  const refreshDisabled = selectedProjectRoot === null || isLoading || isRefreshing;

  return (
    <SettingsContentLayout
      title={t("settings.section.hooks-settings")}
      subtitle={renderInlineLinkMessage(t("settings.hooks.subtitle"), HOOKS_DOCS_URL)}
      subtitleClassName="whitespace-normal"
      action={
        <div className="flex items-center gap-2">
          <HookProjectSelector
            projectRootLabels={projectRootLabels}
            projectRoots={projectRoots}
            selectedProjectRoot={selectedProjectRoot}
            onSelectProjectRoot={onSelectProjectRoot}
          />
          <Button
            aria-label={t("settings.hooks.refresh")}
            color="ghost"
            disabled={refreshDisabled}
            onClick={onRefreshHooks}
            size="icon"
            title={t("settings.hooks.refresh")}
            uniform
          >
            <RefreshIcon className="icon-xs" />
          </Button>
        </div>
      }
    >
      {issueCount > 0 ? (
        <HookIssuesSummary
          errors={errors}
          expanded={issuesExpanded}
          issueCount={issueCount}
          warnings={warnings}
          onToggleExpanded={() => setIssuesExpanded((current) => !current)}
        />
      ) : null}
      <SettingsSurface>
        {selectedProjectRoot === null && isLoadingProjectRoots ? (
          <SettingsRow label={t("settings.hooks.loadingProjects.label")} />
        ) : selectedProjectRoot === null ? (
          <SettingsRow
            label={t("settings.hooks.emptyProject.label")}
            description={t("settings.hooks.emptyProject.description")}
          />
        ) : isLoading ? (
          <SettingsRow label={t("settings.hooks.loading.label")} />
        ) : loadError ? (
          <SettingsRow label={t("settings.hooks.loadError.label")} description={loadError.message} />
        ) : (
          buildHookEventSummaries(hooks).map((summary) => (
            <HookEventSection
              key={summary.eventName}
              expanded={expandedEventNames.includes(summary.eventName)}
              hooks={hooks}
              isRemoteHost={isRemoteHost}
              row={summary}
              onOpenSourceFile={onOpenSourceFile}
              onToggleExpanded={() =>
                setExpandedEventNames((current) =>
                  current.includes(summary.eventName)
                    ? current.filter((eventName) => eventName !== summary.eventName)
                    : [...current, summary.eventName],
                )
              }
              onToggleHookEnabled={onToggleHookEnabled}
            />
          ))
        )}
      </SettingsSurface>
    </SettingsContentLayout>
  );
}

function HookEventSection({
  expanded,
  hooks,
  isRemoteHost,
  row,
  onOpenSourceFile,
  onToggleExpanded,
  onToggleHookEnabled,
}: {
  expanded: boolean;
  hooks: HookMetadata[];
  isRemoteHost: boolean;
  row: HookEventSummary;
  onOpenSourceFile: (hook: HookMetadata) => void;
  onToggleExpanded: () => void;
  onToggleHookEnabled: (hook: HookMetadata, enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const isEmpty = row.installed === 0;
  const counterClassName = row.active === 0 ? "text-token-text-tertiary" : undefined;
  const eventHooks = expanded ? sortHooksForEvent(hooks, row.eventName) : [];

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        disabled={isEmpty}
        onClick={onToggleExpanded}
        className={joinClasses("w-full text-left", isEmpty ? "cursor-default" : "cursor-interaction")}
      >
        <SettingsRow
          icon={<HooksEventIcon className="h-[18px] w-[18px]" />}
          label={getHookEventTitle(row.eventName, t)}
          description={getHookEventDescription(row.eventName, t)}
          control={
            <div className="flex items-center gap-3 text-sm text-token-text-primary">
              <span className={counterClassName}>
                {row.installed > 0
                  ? t("settings.hooks.event.counts", {
                      active: row.active,
                      installed: row.installed,
                    })
                  : t("settings.hooks.event.emptyCounts")}
              </span>
              {row.installed > 0 ? (
                <ChevronDownIcon
                  className={joinClasses("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                />
              ) : null}
            </div>
          }
        />
      </button>
      {expanded ? (
        <div className="border-t border-token-border bg-token-bg-primary/40 px-3">
          <div className="divide-y-[0.5px] divide-token-border">
            {eventHooks.map((hook, index) => (
              <HookRow
                key={hook.key}
                hook={hook}
                index={index}
                isRemoteHost={isRemoteHost}
                onOpenSourceFile={onOpenSourceFile}
                onToggleHookEnabled={onToggleHookEnabled}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HookRow({
  hook,
  index,
  isRemoteHost,
  onOpenSourceFile,
  onToggleHookEnabled,
}: {
  hook: HookMetadata;
  index: number;
  isRemoteHost: boolean;
  onOpenSourceFile: (hook: HookMetadata) => void;
  onToggleHookEnabled: (hook: HookMetadata, enabled: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="group flex items-center justify-between gap-4 py-3 pl-9">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium text-token-text-primary">
            {t("settings.hooks.event.fallbackHookTitle", { index: index + 1 })}
          </div>
        </div>
        <div className="text-sm text-token-text-secondary">{getHookSourceSummary(hook, t)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="invisible opacity-0 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 has-[[data-state=open]]:visible has-[[data-state=open]]:opacity-100">
          <HookRowActionsMenu
            disabledOpenSourceFile={isRemoteHost}
            onOpenSourceFile={() => onOpenSourceFile(hook)}
          />
        </div>
        {hook.isManaged ? (
          <span
            title={t("settings.hooks.event.managedTooltip")}
            className="inline-flex cursor-not-allowed"
            tabIndex={0}
          >
            <ToggleSwitch
              ariaLabel={t("settings.hooks.event.fallbackHookTitle", { index: index + 1 })}
              checked
              disabled
              onChange={() => undefined}
            />
          </span>
        ) : (
          <ToggleSwitch
            ariaLabel={t("settings.hooks.event.fallbackHookTitle", { index: index + 1 })}
            checked={hook.enabled}
            disabled={false}
            onChange={(checked) => onToggleHookEnabled(hook, checked)}
          />
        )}
      </div>
    </div>
  );
}

function HookRowActionsMenu({
  disabledOpenSourceFile,
  onOpenSourceFile,
}: {
  disabledOpenSourceFile: boolean;
  onOpenSourceFile: () => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-label={t("settings.hooks.event.moreActions")}
        color="ghost"
        data-state={isOpen ? "open" : "closed"}
        size="toolbar"
        uniform
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
      >
        <MoreActionsIcon className="h-3.5 w-3.5" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <button
            type="button"
            disabled={disabledOpenSourceFile}
            onClick={(event) => {
              event.stopPropagation();
              if (disabledOpenSourceFile) {
                return;
              }
              setIsOpen(false);
              onOpenSourceFile();
            }}
            className={joinClasses(
              "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]",
              disabledOpenSourceFile
                ? "cursor-not-allowed opacity-60"
                : "app-nav-item-idle",
            )}
          >
            {t("settings.hooks.event.openSourceFile")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HookProjectSelector({
  projectRootLabels,
  projectRoots,
  selectedProjectRoot,
  onSelectProjectRoot,
}: {
  projectRootLabels: Record<string, string>;
  projectRoots: string[];
  selectedProjectRoot: string | null;
  onSelectProjectRoot: (projectRoot: string) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <button
        type="button"
        disabled={projectRoots.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate text-left">
          {selectedProjectRoot === null
            ? t("settings.hooks.project.loading")
            : getProjectRootLabel(selectedProjectRoot, projectRootLabels)}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
            {t("settings.hooks.project.group")}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {projectRoots.map((projectRoot) => {
              const isSelected = projectRoot === selectedProjectRoot;
              return (
                <button
                  key={projectRoot}
                  type="button"
                  title={projectRoot}
                  onClick={() => {
                    setIsOpen(false);
                    onSelectProjectRoot(projectRoot);
                  }}
                  className={joinClasses(
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  )}
                >
                  <span className="truncate">{getProjectRootLabel(projectRoot, projectRootLabels)}</span>
                  {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HookIssuesSummary({
  errors,
  expanded,
  issueCount,
  warnings,
  onToggleExpanded,
}: {
  errors: HookLoadErrorInfo[];
  expanded: boolean;
  issueCount: number;
  warnings: string[];
  onToggleExpanded: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-lg border border-token-editor-warning-foreground/30 bg-token-editor-warning-background/30">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full cursor-interaction items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <WarningCircleIcon className="h-4 w-4 shrink-0 text-token-editor-warning-foreground" />
          <span className="truncate text-sm text-token-text-primary">
            {t("settings.hooks.issues.summary", { count: issueCount })}
          </span>
        </span>
        <ChevronDownIcon
          className={joinClasses("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-token-editor-warning-foreground/20 px-3 py-2 text-sm text-token-text-secondary">
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
          {errors.map((error) => (
            <div key={`${error.path}:${error.message}`}>
              {t("settings.hooks.issues.error", {
                path: error.path,
                message: error.message,
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getHookEventTitle(eventName: HookEventName, t: Translate) {
  switch (eventName) {
    case "preToolUse":
      return t("settings.hooks.event.preToolUse");
    case "permissionRequest":
      return t("settings.hooks.event.permissionRequest");
    case "postToolUse":
      return t("settings.hooks.event.postToolUse");
    case "preCompact":
      return t("settings.hooks.event.preCompact");
    case "postCompact":
      return t("settings.hooks.event.postCompact");
    case "sessionStart":
      return t("settings.hooks.event.sessionStart");
    case "userPromptSubmit":
      return t("settings.hooks.event.userPromptSubmit");
    case "stop":
      return t("settings.hooks.event.stop");
  }
}

function getHookEventDescription(eventName: HookEventName, t: Translate) {
  switch (eventName) {
    case "preToolUse":
      return t("settings.hooks.event.preToolUse.description");
    case "permissionRequest":
      return t("settings.hooks.event.permissionRequest.description");
    case "postToolUse":
      return t("settings.hooks.event.postToolUse.description");
    case "preCompact":
      return t("settings.hooks.event.preCompact.description");
    case "postCompact":
      return t("settings.hooks.event.postCompact.description");
    case "sessionStart":
      return t("settings.hooks.event.sessionStart.description");
    case "userPromptSubmit":
      return t("settings.hooks.event.userPromptSubmit.description");
    case "stop":
      return t("settings.hooks.event.stop.description");
  }
}

function getHookSourceSummary(hook: HookMetadata, t: Translate) {
  if (hook.source === "plugin") {
    const pluginName = getHookPluginName(hook.pluginId);
    return pluginName === null
      ? t("settings.hooks.source.plugin")
      : t("settings.hooks.source.pluginSummary", { pluginName });
  }

  return getHookSourceLabel(hook.source, t);
}

function getHookPluginName(pluginId: string | null) {
  if (pluginId === null) {
    return null;
  }
  const pluginName = pluginId.split("@")[0]?.trim();
  return pluginName && pluginName.length > 0 ? pluginName : null;
}

function getHookSourceLabel(source: HookSource, t: Translate) {
  switch (source) {
    case "system":
    case "mdm":
    case "cloudRequirements":
    case "legacyManagedConfigFile":
    case "legacyManagedConfigMdm":
      return t("settings.hooks.source.adminConfig");
    case "user":
      return t("settings.hooks.source.userConfig");
    case "project":
      return t("settings.hooks.source.projectConfig");
    case "sessionFlags":
      return t("settings.hooks.source.sessionFlags");
    case "plugin":
      return t("settings.hooks.source.plugin");
    case "unknown":
    default:
      return t("settings.hooks.source.unknown");
  }
}

function buildHookEventSummaries(hooks: HookMetadata[]): HookEventSummary[] {
  return HOOK_EVENT_ORDER.map((eventName) => {
    const eventHooks = hooks.filter((hook) => hook.eventName === eventName);
    return {
      eventName,
      active: eventHooks.filter((hook) => hook.enabled || hook.isManaged).length,
      installed: eventHooks.length,
    };
  });
}

function sortHooksForEvent(hooks: HookMetadata[], eventName: HookEventName) {
  return hooks
    .filter((hook) => hook.eventName === eventName)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function getProjectRootLabel(projectRoot: string, projectRootLabels: Record<string, string>) {
  return projectRootLabels[projectRoot] ?? deriveProjectName(projectRoot) ?? projectRoot;
}

function deriveProjectName(projectRoot: string) {
  const segments = projectRoot.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? null;
}

function uniqueProjectRoots(projectRoots: string[], preferredProjectRoot: string | null) {
  return Array.from(new Set(preferredProjectRoot === null ? projectRoots : [preferredProjectRoot, ...projectRoots]));
}

function createEmptyWorkspaceRootOptionsResponse(): WorkspaceRootOptionsResponse {
  return {
    roots: [],
    labels: {},
  };
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function HooksEventIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8.99805" cy="4.875" r="1.875" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 6.75V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V9.75L13.5 11.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 6.75V12C9 13.6569 7.65685 15 6 15C4.34315 15 3 13.6569 3 12V9.75L4.5 11.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9.995 12.315c.489 0 .875.37.875.842 0 .473-.386.843-.875.843-.488 0-.875-.37-.875-.843 0-.472.387-.842.875-.842ZM10.001 6c.478 0 .778.295.778.79 0 .042 0 .107-.006.16l-.08 3.716c-.016.456-.252.725-.698.725-.445 0-.681-.269-.692-.725L9.217 6.95c0-.053-.006-.118-.006-.16 0-.495.307-.79.79-.79Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2.085a7.915 7.915 0 1 1 0 15.83 7.915 7.915 0 0 1 0-15.83Zm0 1.33a6.585 6.585 0 1 0 0 13.17 6.585 6.585 0 0 0 0-13.17Z"
      />
    </svg>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
