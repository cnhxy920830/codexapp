import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import {
  ChevronDownIcon,
  FolderIcon,
  SearchClearIcon,
  SearchIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import {
  listWorkspaceDirectoryEntries,
  searchWorkspaceFiles,
  type WorkspaceDirectoryEntry,
  type WorkspaceFilePreviewTarget,
  type WorkspaceFileSearchResult,
} from "../../services/workspaceFiles";

type WorkspaceFileTreePanelProps = {
  workspaceRoot: string;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type DirectoryNodeProps = {
  depth: number;
  entry: WorkspaceDirectoryEntry;
  expandedPaths: Set<string>;
  fileEntriesByDirectory: Map<string, WorkspaceDirectoryEntry[]>;
  loadingDirectories: Set<string>;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  onToggleDirectory: (directoryPath: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workspaceRoot: string;
};

function normalizeDirectoryKey(directoryPath: string | null) {
  if (!directoryPath) {
    return "";
  }
  return directoryPath.replaceAll("\\", "/").replace(/^\.?\//, "");
}

function buildWorkspaceFileTarget(workspaceRoot: string, result: WorkspaceFileSearchResult): WorkspaceFilePreviewTarget {
  return {
    ...result,
    workspaceRoot,
  };
}

function buildWorkspaceFileTargetFromTreeEntry(args: {
  workspaceRoot: string;
  name: string;
  relativePath: string;
}): WorkspaceFilePreviewTarget {
  const normalizedRelativePath = normalizeDirectoryKey(args.relativePath);
  const normalizedWorkspaceRoot = args.workspaceRoot.replace(/[\\/]+$/, "");

  return {
    name: args.name,
    path:
      normalizedRelativePath.length > 0
        ? `${normalizedWorkspaceRoot}\\${normalizedRelativePath.replaceAll("/", "\\")}`
        : normalizedWorkspaceRoot,
    relativePath: normalizedRelativePath,
    workspaceRoot: args.workspaceRoot,
  };
}

function SearchInput({
  onChange,
  query,
  t,
}: {
  onChange: (value: string) => void;
  query: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="shrink-0 px-2 pt-2 pb-px">
      <div className="relative flex h-9 w-full items-center gap-1.5 rounded-lg border border-[var(--app-shell-border)] bg-[color:var(--app-shell-muted-surface)] text-[13px] leading-[18px]">
        <label htmlFor="workspace-directory-tree-search" className="sr-only">
          {t("codex.fileTreeSearch.label")}
        </label>
        <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
        <input
          id="workspace-directory-tree-search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("codex.fileTreeSearch.placeholder")}
          className="w-full appearance-none border-none bg-transparent py-0 pl-0 pr-1.5 text-[var(--app-shell-text)] outline-none placeholder:text-[var(--app-shell-muted)]"
          type="text"
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label={t("codex.fileTreeSearch.clear")}
            onClick={() => onChange("")}
            className="mr-1 flex h-7 w-7 items-center justify-center text-[var(--app-shell-muted)] hover:text-[var(--app-shell-text)]"
          >
            <SearchClearIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="px-2 py-2 text-left text-[13px] text-[var(--app-shell-muted)]">{children}</div>;
}

function SearchResults({
  isLoading,
  onSelectWorkspaceFile,
  results,
  root,
  t,
}: {
  isLoading: boolean;
  onSelectWorkspaceFile: (file: WorkspaceFilePreviewTarget) => void;
  results: WorkspaceFileSearchResult[];
  root: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading && results.length === 0) {
    return <EmptyState>{t("thread.fileTreePanel.searchingFiles")}</EmptyState>;
  }

  if (results.length === 0) {
    return <EmptyState>{t("thread.fileTreePanel.noMatchingFiles")}</EmptyState>;
  }

  return (
    <div className="h-full min-h-0 w-full px-2">
      <div className="space-y-1">
        {results.map((result) => (
          <button
            key={result.relativePath}
            type="button"
            onClick={() => onSelectWorkspaceFile(buildWorkspaceFileTarget(root, result))}
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]"
          >
            <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{result.name}</div>
              <div className="app-text-muted mt-0.5 truncate text-[12px]">{result.relativePath}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DirectoryNode({
  depth,
  entry,
  expandedPaths,
  fileEntriesByDirectory,
  loadingDirectories,
  onSelectWorkspaceFile,
  onToggleDirectory,
  t,
  workspaceRoot,
}: DirectoryNodeProps) {
  const normalizedPath = normalizeDirectoryKey(entry.path);
  const isDirectory = entry.entryType === "directory";
  const isExpanded = expandedPaths.has(normalizedPath);
  const childEntries = fileEntriesByDirectory.get(normalizedPath) ?? [];
  const isLoading = loadingDirectories.has(normalizedPath);

  if (!isDirectory) {
    return (
      <button
        type="button"
        onClick={() =>
          onSelectWorkspaceFile(
            buildWorkspaceFileTargetFromTreeEntry({
              workspaceRoot,
              name: entry.name,
              relativePath: normalizedPath,
            }),
          )
        }
        className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
        <span className="truncate">{entry.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleDirectory(normalizedPath)}
        className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <ChevronDownIcon
          className={[
            "h-4 w-4 shrink-0 text-[var(--app-shell-muted)] transition-transform",
            isExpanded ? "rotate-0" : "-rotate-90",
          ].join(" ")}
        />
        <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
        <span className="truncate">{entry.name}</span>
      </button>
      {isExpanded ? (
        isLoading ? (
          <div className="px-2 py-2 text-[13px] text-[var(--app-shell-muted)]" style={{ paddingLeft: `${24 + depth * 16}px` }}>
            {t("threadSidePanel.workspaceBrowser.loading")}
          </div>
        ) : childEntries.length === 0 ? (
          <div className="px-2 py-2 text-[13px] text-[var(--app-shell-muted)]" style={{ paddingLeft: `${24 + depth * 16}px` }}>
            {t("threadSidePanel.workspaceBrowser.empty")}
          </div>
        ) : (
          <div>
            {childEntries.map((childEntry) => (
              <DirectoryNode
                key={`${childEntry.entryType}:${childEntry.path}`}
                depth={depth + 1}
                entry={childEntry}
                expandedPaths={expandedPaths}
                fileEntriesByDirectory={fileEntriesByDirectory}
                loadingDirectories={loadingDirectories}
                onSelectWorkspaceFile={onSelectWorkspaceFile}
                onToggleDirectory={onToggleDirectory}
                t={t}
                workspaceRoot={workspaceRoot}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

export function WorkspaceFileTreePanel({
  workspaceRoot,
  onSelectWorkspaceFile,
  t,
}: WorkspaceFileTreePanelProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceFileSearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [rootEntries, setRootEntries] = useState<WorkspaceDirectoryEntry[]>([]);
  const [isRootLoading, setIsRootLoading] = useState(true);
  const [fileEntriesByDirectory, setFileEntriesByDirectory] = useState<Map<string, WorkspaceDirectoryEntry[]>>(
    () => new Map(),
  );
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(() => new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setQuery("");
    setSearchResults([]);
    setRootEntries([]);
    setFileEntriesByDirectory(new Map());
    setLoadingDirectories(new Set());
    setExpandedPaths(new Set());
  }, [workspaceRoot]);

  useEffect(() => {
    let cancelled = false;
    setIsRootLoading(true);
    void listWorkspaceDirectoryEntries({ workspaceRoot })
      .then((entries) => {
        if (cancelled || !mountedRef.current) {
          return;
        }
        setRootEntries(entries);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setRootEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setIsRootLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);
    void searchWorkspaceFiles({ workspaceRoot, query: trimmedQuery })
      .then((results) => {
        if (!cancelled && mountedRef.current) {
          setSearchResults(results);
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setIsSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, workspaceRoot]);

  const handleToggleDirectory = (directoryPath: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(directoryPath)) {
        next.delete(directoryPath);
        return next;
      }

      next.add(directoryPath);
      return next;
    });

    if (fileEntriesByDirectory.has(directoryPath) || loadingDirectories.has(directoryPath)) {
      return;
    }

    setLoadingDirectories((current) => {
      const next = new Set(current);
      next.add(directoryPath);
      return next;
    });

    void listWorkspaceDirectoryEntries({
      workspaceRoot,
      directoryPath,
    })
      .then((entries) => {
        if (!mountedRef.current) {
          return;
        }
        setFileEntriesByDirectory((current) => {
          const next = new Map(current);
          next.set(directoryPath, entries);
          return next;
        });
      })
      .catch(() => {
        if (!mountedRef.current) {
          return;
        }
        setFileEntriesByDirectory((current) => {
          const next = new Map(current);
          next.set(directoryPath, []);
          return next;
        });
      })
      .finally(() => {
        if (!mountedRef.current) {
          return;
        }
        setLoadingDirectories((current) => {
          const next = new Set(current);
          next.delete(directoryPath);
          return next;
        });
      });
  };

  const rootEntriesByDirectory = useMemo(() => {
    const next = new Map(fileEntriesByDirectory);
    next.set("", rootEntries);
    return next;
  }, [fileEntriesByDirectory, rootEntries]);

  const rootDisplay = useMemo(() => {
    if (query.trim().length > 0) {
      return (
        <SearchResults
          isLoading={isSearchLoading}
          onSelectWorkspaceFile={onSelectWorkspaceFile}
          results={searchResults}
          root={workspaceRoot}
          t={t}
        />
      );
    }

    if (isRootLoading) {
      return <EmptyState>{t("threadSidePanel.workspaceBrowser.loading")}</EmptyState>;
    }

    if (rootEntries.length === 0) {
      return <EmptyState>{t("threadSidePanel.workspaceBrowser.empty")}</EmptyState>;
    }

    return (
      <div className="h-full min-h-0 w-full px-2">
        {rootEntries.map((entry) => (
          <DirectoryNode
            key={`${entry.entryType}:${entry.path}`}
            depth={0}
            entry={entry}
            expandedPaths={expandedPaths}
            fileEntriesByDirectory={rootEntriesByDirectory}
            loadingDirectories={loadingDirectories}
            onSelectWorkspaceFile={onSelectWorkspaceFile}
            onToggleDirectory={handleToggleDirectory}
            t={t}
            workspaceRoot={workspaceRoot}
          />
        ))}
      </div>
    );
  }, [
    expandedPaths,
    isRootLoading,
    isSearchLoading,
    loadingDirectories,
    onSelectWorkspaceFile,
    query,
    rootEntries,
    rootEntriesByDirectory,
    searchResults,
    t,
    workspaceRoot,
  ]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <SearchInput onChange={setQuery} query={query} t={t} />
      <div className="min-h-0 flex-1">{rootDisplay}</div>
    </div>
  );
}
