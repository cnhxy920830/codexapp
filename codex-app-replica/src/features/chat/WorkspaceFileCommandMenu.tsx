import { useEffect, useMemo, useState } from "react";
import { SearchIcon, WorkspaceFileIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import {
  getCommandShortcutEntries,
  type CommandKeymapState,
} from "../../services/keyboardShortcuts";
import {
  searchWorkspaceFiles,
  type WorkspaceFilePreviewTarget,
  type WorkspaceFileSearchResult,
} from "../../services/workspaceFiles";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

export type WorkspaceFileCommandMenuMode = "root" | "files";

type WorkspaceFileCommandMenuProps = {
  commandKeymapState: CommandKeymapState | null;
  initialMode: WorkspaceFileCommandMenuMode;
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSelectFile: (file: WorkspaceFilePreviewTarget) => void;
  t: Translate;
  workspaceRoot: string | null;
};

type WorkspaceFileCommandMenuPanelProps = {
  canSearch: boolean;
  isLoading: boolean;
  mode: WorkspaceFileCommandMenuMode;
  onQueryChange?: (value: string) => void;
  onSelectFile?: (result: WorkspaceFileSearchResult) => void;
  onSelectSearchFiles?: () => void;
  query: string;
  results: WorkspaceFileSearchResult[];
  searchFilesShortcutLabel: string | null;
  selectedIndex: number;
  showSearchFilesItem: boolean;
  t: Translate;
};

export function WorkspaceFileCommandMenu({
  commandKeymapState,
  initialMode,
  isOpen,
  onClose,
  onError,
  onSelectFile,
  t,
  workspaceRoot,
}: WorkspaceFileCommandMenuProps) {
  const [mode, setMode] = useState<WorkspaceFileCommandMenuMode>(initialMode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceFileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchFilesShortcutLabel =
    getCommandShortcutEntries("searchFiles", commandKeymapState)[0]?.label ?? null;
  const showSearchFilesItem = useMemo(
    () =>
      matchesCommandMenuQuery(
        [
          t("thread.fileCommandMenu.searchFiles"),
          searchFilesShortcutLabel,
          "workspace",
          "project",
          "cmd+p",
        ]
          .filter(Boolean)
          .join(" "),
        query,
      ),
    [query, searchFilesShortcutLabel, t],
  );
  const canSearch = workspaceRoot !== null;

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setMode(initialMode);
    setQuery("");
    setResults([]);
    setSelectedIndex(initialMode === "root" ? 0 : -1);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "files" || !workspaceRoot) {
      setIsLoading(false);
      if (mode !== "files") {
        setResults([]);
      }
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void searchWorkspaceFiles({ workspaceRoot, query })
      .then((nextResults) => {
        if (!cancelled) {
          setResults(nextResults);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : String(error));
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, onError, query, workspaceRoot]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "root") {
      setSelectedIndex(showSearchFilesItem ? 0 : -1);
      return;
    }

    if (results.length === 0) {
      setSelectedIndex(-1);
      return;
    }

    setSelectedIndex((current) => (current < 0 || current >= results.length ? 0 : current));
  }, [isOpen, mode, results, showSearchFilesItem]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (mode === "root") {
        if (!showSearchFilesItem) {
          return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          setSelectedIndex(0);
          return;
        }

        if (event.key === "Enter" && selectedIndex === 0) {
          event.preventDefault();
          setQuery("");
          setMode("files");
        }
        return;
      }

      if (results.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current < 0 ? 0 : (current + 1) % results.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          current < 0 ? results.length - 1 : (current - 1 + results.length) % results.length,
        );
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedIndex(results.length - 1);
        return;
      }

      if (event.key === "Enter" && selectedIndex >= 0) {
        event.preventDefault();
        const result = results[selectedIndex];
        if (result && workspaceRoot) {
          onSelectFile({
            ...result,
            workspaceRoot,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, mode, onClose, onSelectFile, query, results, selectedIndex, showSearchFilesItem, workspaceRoot]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-transparent"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="absolute top-14 right-4"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <WorkspaceFileCommandMenuPanel
          canSearch={canSearch}
          isLoading={isLoading}
          mode={mode}
          onQueryChange={setQuery}
          onSelectFile={
            workspaceRoot
              ? (result) => {
                  onSelectFile({
                    ...result,
                    workspaceRoot,
                  });
                }
              : undefined
          }
          onSelectSearchFiles={() => {
            setQuery("");
            setMode("files");
          }}
          query={query}
          results={results}
          searchFilesShortcutLabel={searchFilesShortcutLabel}
          selectedIndex={selectedIndex}
          showSearchFilesItem={showSearchFilesItem}
          t={t}
        />
      </div>
    </div>
  );
}

export function WorkspaceFileCommandMenuPanel({
  canSearch,
  isLoading,
  mode,
  onQueryChange,
  onSelectFile,
  onSelectSearchFiles,
  query,
  results,
  searchFilesShortcutLabel,
  selectedIndex,
  showSearchFilesItem,
  t,
}: WorkspaceFileCommandMenuPanelProps) {
  return (
    <div className="app-card w-[340px] max-w-[calc(100vw-2rem)] rounded-[18px] px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <input
        autoFocus
        disabled={!canSearch}
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        aria-label={t("thread.fileCommandMenu.searchFiles")}
        aria-autocomplete="list"
        aria-expanded={mode === "files" ? results.length > 0 : showSearchFilesItem}
        placeholder={t("thread.fileCommandMenu.searchFiles")}
        className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
      />
      <div className="mt-3">
        {mode === "root" ? (
          showSearchFilesItem ? (
            <button
              type="button"
              onClick={() => onSelectSearchFiles?.()}
              className={[
                "flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13px]",
                selectedIndex === 0 ? "app-nav-item-active" : "app-nav-item-idle",
              ].join(" ")}
            >
              <SearchIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{t("thread.fileCommandMenu.searchFiles")}</div>
              </div>
              {searchFilesShortcutLabel ? (
                <span className="app-card-muted shrink-0 rounded-[8px] px-2 py-0.5 text-[11px] leading-5">
                  {searchFilesShortcutLabel}
                </span>
              ) : null}
            </button>
          ) : (
            <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
              {t("thread.fileTreePanel.noMatchingFiles")}
            </div>
          )
        ) : (
          <>
            <div className="app-text-muted px-1 text-[11px] font-medium tracking-[0.16em]">
              {t("thread.fileCommandMenu.filesGroup")}
            </div>
            <div className="mt-2 max-h-[420px] overflow-y-auto">
              {!canSearch ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                  {t("thread.fileTreePanel.noMatchingFiles")}
                </div>
              ) : isLoading ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                  {t("thread.fileTreePanel.searchingFiles")}
                </div>
              ) : results.length === 0 ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px]">
                  {t("thread.fileTreePanel.noMatchingFiles")}
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={result.relativePath}
                      type="button"
                      onClick={() => onSelectFile?.(result)}
                      className={[
                        "flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13px]",
                        selectedIndex === index ? "app-nav-item-active" : "app-nav-item-idle",
                      ].join(" ")}
                    >
                      <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{result.name}</div>
                        <div className="app-text-muted mt-1 truncate text-[12px]">{result.relativePath}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function matchesCommandMenuQuery(searchText: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }

  const normalizedSearchText = searchText.toLowerCase();
  return normalizedQuery
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .every((part) => normalizedSearchText.includes(part));
}
