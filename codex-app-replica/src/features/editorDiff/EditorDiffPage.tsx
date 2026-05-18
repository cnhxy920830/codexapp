import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DiffSplitIcon,
  DiffUnifiedIcon,
  RichPreviewDisabledIcon,
  RichPreviewEnabledIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import {
  buildPullRequestUnifiedDiffSummary,
  parsePullRequestUnifiedDiff,
} from "../../lib/unifiedDiff";
import {
  getGlobalState,
  onGlobalStateUpdated,
  setGlobalState,
} from "../../services/settings";
import {
  onActiveWorkspaceRootsUpdated,
  readActiveWorkspaceRoots,
} from "../../services/workspaceRoots";
import { EditorDiffFileSurface } from "./EditorDiffFileSurface";

const DEFAULT_OPEN_FILE_COUNT = 25;
const DEFAULT_OPEN_LINE_COUNT = 2000;
const EDITOR_DIFF_VIEW_MODE_KEY = "editorDiffViewMode";
const DIFF_RICH_PREVIEW_KEY = "diffRichPreview";

type DiffViewMode = "split" | "unified";

type NormalizedEditorDiffRouteState = {
  conversationId: string;
  cwd: string | null;
  unifiedDiff: string;
};

type EditorDiffPageProps = {
  routeState: unknown;
};

export function EditorDiffPage({ routeState }: EditorDiffPageProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [richPreviewEnabled, setRichPreviewEnabled] = useState(false);
  const [workspaceRootCwd, setWorkspaceRootCwd] = useState<string | null>(null);

  const resolvedRouteState = useMemo(
    () => resolveEditorDiffRouteState(routeState),
    [routeState],
  );
  const diffFiles = useMemo(
    () =>
      resolvedRouteState.type === "ready"
        ? parsePullRequestUnifiedDiff(resolvedRouteState.state.unifiedDiff)
        : [],
    [resolvedRouteState],
  );
  const summary = useMemo(
    () => buildPullRequestUnifiedDiffSummary(diffFiles),
    [diffFiles],
  );
  const defaultOpen =
    summary.fileCount <= DEFAULT_OPEN_FILE_COUNT &&
    summary.linesAdded + summary.linesDeleted <= DEFAULT_OPEN_LINE_COUNT;
  const defaultExpandedPaths = useMemo(
    () =>
      defaultOpen
        ? new Set(
            diffFiles
              .filter((file) => file.status !== "deleted")
              .map((file) => file.path),
          )
        : new Set<string>(),
    [defaultOpen, diffFiles],
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(defaultExpandedPaths),
  );

  useEffect(() => {
    let cancelled = false;

    const loadViewMode = async () => {
      try {
        const response = await getGlobalState(EDITOR_DIFF_VIEW_MODE_KEY);
        if (cancelled) {
          return;
        }
        setViewMode(response.value === "split" ? "split" : "unified");
      } catch {
        if (!cancelled) {
          setViewMode("unified");
        }
      }
    };

    void loadViewMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRichPreview = async () => {
      try {
        const response = await getGlobalState(DIFF_RICH_PREVIEW_KEY);
        if (cancelled) {
          return;
        }
        setRichPreviewEnabled(response.value === true);
      } catch {
        if (!cancelled) {
          setRichPreviewEnabled(false);
        }
      }
    };

    void loadRichPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const disposePromise = onGlobalStateUpdated((notification) => {
      if (notification.keys.includes(EDITOR_DIFF_VIEW_MODE_KEY)) {
        void getGlobalState(EDITOR_DIFF_VIEW_MODE_KEY).then((response) => {
          setViewMode(response.value === "split" ? "split" : "unified");
        }).catch(() => undefined);
      }

      if (notification.keys.includes(DIFF_RICH_PREVIEW_KEY)) {
        void getGlobalState(DIFF_RICH_PREVIEW_KEY).then((response) => {
          setRichPreviewEnabled(response.value === true);
        }).catch(() => undefined);
      }
    });

    return () => {
      void disposePromise.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const reloadWorkspaceRoots = async () => {
      try {
        const response = await readActiveWorkspaceRoots();
        if (cancelled) {
          return;
        }
        const root = response.roots[0];
        setWorkspaceRootCwd(
          typeof root === "string" && root.trim().length > 0 ? root.trim() : null,
        );
      } catch {
        if (!cancelled) {
          setWorkspaceRootCwd(null);
        }
      }
    };

    void reloadWorkspaceRoots();

    const disposePromise = onActiveWorkspaceRootsUpdated(() => {
      void reloadWorkspaceRoots();
    });

    return () => {
      cancelled = true;
      void disposePromise.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    setExpandedPaths(new Set(defaultExpandedPaths));
  }, [defaultExpandedPaths]);

  if (resolvedRouteState.type === "error" || !summary.hasChanges) {
    return (
      <div className="p-4 text-[var(--app-shell-error-text)]">
        {t(
          resolvedRouteState.type === "error"
            ? resolvedRouteState.errorKey
            : "codex.diffView.noDiffData",
        )}
      </div>
    );
  }

  const effectiveCwd = resolvedRouteState.state.cwd ?? workspaceRootCwd;
  void effectiveCwd;
  const richPreviewToggleLabel = t("codex.diffView.richPreviewToggle");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between py-2 pr-2 pl-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--app-shell-text)]">
            {t("codex.diffView.filesChanged", { fileCount: summary.fileCount })}
          </span>
          {summary.linesAdded > 0 || summary.linesDeleted > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-emerald-700 dark:text-emerald-300">
                {t("codex.diffView.linesAdded", {
                  linesAdded: summary.linesAdded,
                })}
              </span>
              <span className="text-red-700 dark:text-red-300">
                {t("codex.diffView.linesDeleted", {
                  linesDeleted: summary.linesDeleted,
                })}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <div className="app-segmented inline-flex rounded-[12px] p-1">
            <ViewModeButton
              active={viewMode === "unified"}
              ariaLabel={t("codex.diffView.switchToUnified")}
              onClick={() => {
                setViewMode("unified");
                void setGlobalState(EDITOR_DIFF_VIEW_MODE_KEY, "unified").catch(
                  () => undefined,
                );
              }}
              title={t("codex.diffView.switchToUnified")}
            >
              <DiffUnifiedIcon className="h-4 w-4" />
            </ViewModeButton>
            <ViewModeButton
              active={viewMode === "split"}
              ariaLabel={t("codex.diffView.switchToSplit")}
              onClick={() => {
                setViewMode("split");
                void setGlobalState(EDITOR_DIFF_VIEW_MODE_KEY, "split").catch(
                  () => undefined,
                );
              }}
              title={t("codex.diffView.switchToSplit")}
            >
              <DiffSplitIcon className="h-4 w-4" />
            </ViewModeButton>
          </div>
          <button
            type="button"
            aria-label={richPreviewToggleLabel}
            aria-pressed={richPreviewEnabled}
            title={richPreviewToggleLabel}
            onClick={() => {
              const nextValue = !richPreviewEnabled;
              setRichPreviewEnabled(nextValue);
              void setGlobalState(DIFF_RICH_PREVIEW_KEY, nextValue).catch(
                () => undefined,
              );
            }}
            className={[
              "app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent transition-colors",
              richPreviewEnabled ? "app-nav-item-active" : "app-nav-item-idle",
            ].join(" ")}
          >
            {richPreviewEnabled ? (
              <RichPreviewEnabledIcon className="h-4 w-4" />
            ) : (
              <RichPreviewDisabledIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-[var(--padding-panel)] pt-0">
        {diffFiles.map((file) => (
          <EditorDiffFileSurface
            key={file.path}
            file={file}
            isOpen={expandedPaths.has(file.path)}
            onToggleOpen={() => {
              setExpandedPaths((current) => {
                const next = new Set(current);
                if (next.has(file.path)) {
                  next.delete(file.path);
                } else {
                  next.add(file.path);
                }
                return next;
              });
            }}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}

function resolveEditorDiffRouteState(routeState: unknown) {
  if (routeState == null || typeof routeState !== "object") {
    return {
      errorKey: "codex.diffView.noDiffData" as MessageKey,
      type: "error" as const,
    };
  }

  try {
    const record = routeState as Record<string, unknown>;
    const rawConversationId = record.conversationId;
    const rawUnifiedDiff = record.unifiedDiff;
    const rawCwd = record.cwd;

    if (
      typeof rawConversationId !== "string" ||
      typeof rawUnifiedDiff !== "string"
    ) {
      return {
        errorKey: "codex.diffView.noDiffData" as MessageKey,
        type: "error" as const,
      };
    }

    const conversationId = rawConversationId.trim();
    const unifiedDiff = rawUnifiedDiff;
    const cwd =
      typeof rawCwd === "string" && rawCwd.trim().length > 0
        ? rawCwd.trim()
        : null;

    if (conversationId.length === 0 || unifiedDiff.trim().length === 0) {
      return {
        errorKey: "codex.diffView.noDiffData" as MessageKey,
        type: "error" as const,
      };
    }

    return {
      state: {
        conversationId,
        cwd,
        unifiedDiff,
      } satisfies NormalizedEditorDiffRouteState,
      type: "ready" as const,
    };
  } catch {
    return {
      errorKey: "codex.diffView.failedToDecodeBase64Diff" as MessageKey,
      type: "error" as const,
    };
  }
}

function ViewModeButton({
  active,
  ariaLabel,
  children,
  onClick,
  title,
}: {
  active: boolean;
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent transition-colors",
        active ? "app-segmented-option-active" : "app-segmented-option-idle",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
