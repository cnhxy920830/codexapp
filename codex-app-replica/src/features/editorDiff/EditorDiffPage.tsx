import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ChevronDownIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  RichPreviewDisabledIcon,
  RichPreviewEnabledIcon,
} from "../../components/AppShellIcons";
import { DiffPreviewShell, RichDiffPreview, SplitDiffPreview } from "../../components/DiffPreview";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import {
  buildPullRequestUnifiedDiffSummary,
  parsePullRequestUnifiedDiff,
  type PullRequestDiffFile,
} from "../../lib/unifiedDiff";

const DEFAULT_OPEN_FILE_COUNT = 25;
const DEFAULT_OPEN_LINE_COUNT = 2000;
const EDITOR_DIFF_VIEW_MODE_STORAGE_KEY = "codex-app-replica.editor-diff.view-mode";
const EDITOR_DIFF_RICH_PREVIEW_STORAGE_KEY = "codex-app-replica.editor-diff.rich-preview";

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
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => readStoredViewMode());
  const [richPreviewEnabled, setRichPreviewEnabled] = useState<boolean>(() => readStoredRichPreviewEnabled());

  const resolvedRouteState = useMemo(() => resolveEditorDiffRouteState(routeState), [routeState]);
  const diffFiles = useMemo(
    () =>
      resolvedRouteState.type === "ready"
        ? parsePullRequestUnifiedDiff(resolvedRouteState.state.unifiedDiff)
        : [],
    [resolvedRouteState],
  );
  const summary = useMemo(() => buildPullRequestUnifiedDiffSummary(diffFiles), [diffFiles]);
  const defaultOpen = summary.fileCount <= DEFAULT_OPEN_FILE_COUNT && summary.linesAdded + summary.linesDeleted <= DEFAULT_OPEN_LINE_COUNT;
  const defaultExpandedPaths = useMemo(
    () => (defaultOpen ? new Set(diffFiles.map((file) => file.path)) : new Set<string>()),
    [defaultOpen, diffFiles],
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(defaultExpandedPaths));

  useEffect(() => {
    persistStoredViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    persistStoredRichPreviewEnabled(richPreviewEnabled);
  }, [richPreviewEnabled]);

  useEffect(() => {
    setExpandedPaths(new Set(defaultExpandedPaths));
  }, [defaultExpandedPaths]);

  if (resolvedRouteState.type === "error" || !summary.hasChanges) {
    return (
      <div className="p-4 text-[var(--app-shell-error-text)]">
        {t(resolvedRouteState.type === "error" ? resolvedRouteState.errorKey : "codex.diffView.noDiffData")}
      </div>
    );
  }

  const richPreviewToggleLabel = t("codex.diffView.richPreviewToggle");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between py-2 pr-2 pl-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--app-shell-text)]">
            {t("codex.diffView.filesChanged", { fileCount: summary.fileCount })}
          </span>
          {(summary.linesAdded > 0 || summary.linesDeleted > 0) ? (
            <div className="flex items-center gap-1">
              <span className="text-emerald-700 dark:text-emerald-300">
                {t("codex.diffView.linesAdded", { linesAdded: summary.linesAdded })}
              </span>
              <span className="text-red-700 dark:text-red-300">
                {t("codex.diffView.linesDeleted", { linesDeleted: summary.linesDeleted })}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <div className="app-segmented inline-flex rounded-[12px] p-1">
            <ViewModeButton
              active={viewMode === "unified"}
              ariaLabel={t("codex.diffView.switchToUnified")}
              onClick={() => setViewMode("unified")}
              title={t("codex.diffView.switchToUnified")}
            >
              <DiffUnifiedIcon className="h-4 w-4" />
            </ViewModeButton>
            <ViewModeButton
              active={viewMode === "split"}
              ariaLabel={t("codex.diffView.switchToSplit")}
              onClick={() => setViewMode("split")}
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
            onClick={() => setRichPreviewEnabled((value) => !value)}
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
        {diffFiles.map((file) => {
          const isExpanded = expandedPaths.has(file.path);
          return (
            <section
              key={file.path}
              className="overflow-hidden rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)]"
            >
              <button
                type="button"
                onClick={() => toggleExpandedPath(file.path, setExpandedPaths)}
                className="flex w-full items-center gap-3 border-b border-[var(--app-shell-border)] px-4 py-3 text-left"
              >
                <ChevronDownIcon className={["h-4 w-4 shrink-0 transition-transform", isExpanded ? "" : "-rotate-90"].join(" ")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[var(--app-shell-text)]">{file.path}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-subtle)]">
                    +{file.additions} / -{file.deletions}
                  </div>
                </div>
              </button>
              {isExpanded ? (
                <div className="p-4">
                  {renderDiffFilePreview(file, {
                    richPreviewEnabled,
                    viewMode,
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function renderDiffFilePreview(
  file: PullRequestDiffFile,
  options: {
    richPreviewEnabled: boolean;
    viewMode: DiffViewMode;
  },
) {
  if (options.viewMode === "split") {
    return (
      <SplitDiffPreview
        file={file}
        isWhitespaceHidden={false}
        isWordDiffsEnabled={false}
        isWrapEnabled={false}
      />
    );
  }

  if (options.richPreviewEnabled) {
    return (
      <RichDiffPreview
        file={file}
        isWhitespaceHidden={false}
        isWordDiffsEnabled={false}
        isWrapEnabled={false}
      />
    );
  }

  return (
    <DiffPreviewShell isWrapEnabled={false}>
      <pre className="whitespace-pre px-4 py-3 text-[12px] leading-6">
        <code>{file.patch}</code>
      </pre>
    </DiffPreviewShell>
  );
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

function resolveEditorDiffRouteState(routeState: unknown) {
  if (routeState == null || typeof routeState !== "object") {
    return {
      type: "error" as const,
      errorKey: "codex.diffView.noDiffData" as MessageKey,
    };
  }

  const record = routeState as Record<string, unknown>;
  const rawConversationId = record.conversationId;
  const rawUnifiedDiff = record.unifiedDiff;
  const rawCwd = record.cwd;

  if (typeof rawConversationId !== "string" || typeof rawUnifiedDiff !== "string") {
    return {
      type: "error" as const,
      errorKey: "codex.diffView.noDiffData" as MessageKey,
    };
  }

  const conversationId = rawConversationId.trim();
  const unifiedDiff = rawUnifiedDiff;
  const cwd = typeof rawCwd === "string" && rawCwd.trim().length > 0 ? rawCwd.trim() : null;

  if (conversationId.length === 0 || unifiedDiff.trim().length === 0) {
    return {
      type: "error" as const,
      errorKey: "codex.diffView.noDiffData" as MessageKey,
    };
  }

  return {
    type: "ready" as const,
    state: {
      conversationId,
      cwd,
      unifiedDiff,
    } satisfies NormalizedEditorDiffRouteState,
  };
}

function toggleExpandedPath(
  path: string,
  setExpandedPaths: Dispatch<SetStateAction<Set<string>>>,
) {
  setExpandedPaths((current) => {
    const next = new Set(current);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
}

function readStoredViewMode(): DiffViewMode {
  if (typeof window === "undefined") {
    return "unified";
  }

  const stored = window.localStorage.getItem(EDITOR_DIFF_VIEW_MODE_STORAGE_KEY);
  return stored === "split" ? "split" : "unified";
}

function readStoredRichPreviewEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(EDITOR_DIFF_RICH_PREVIEW_STORAGE_KEY);
  return stored == null ? true : stored === "true";
}

function persistStoredViewMode(viewMode: DiffViewMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EDITOR_DIFF_VIEW_MODE_STORAGE_KEY, viewMode);
}

function persistStoredRichPreviewEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EDITOR_DIFF_RICH_PREVIEW_STORAGE_KEY, enabled ? "true" : "false");
}
