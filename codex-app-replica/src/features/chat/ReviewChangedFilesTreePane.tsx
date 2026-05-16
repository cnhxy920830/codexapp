import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  FolderIcon,
  SearchClearIcon,
  SearchIcon,
  WorkspaceFileIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import type { FileChangeSummary } from "../../services/history";

type ReviewChangedFilesTreePaneProps = {
  activePath: string | null;
  files: FileChangeSummary[];
  onSelectPath: (path: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type FileTreeNode = FileTreeDirectoryNode | FileTreeFileNode;

type FileTreeDirectoryNode = {
  kind: "directory";
  name: string;
  path: string;
  children: FileTreeNode[];
};

type FileTreeFileNode = {
  kind: "file";
  name: string;
  filePath: string;
};

type MutableFileTreeDirectoryNode = {
  kind: "directory";
  name: string;
  path: string;
  children: Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>;
};

export function ReviewChangedFilesTreePane({
  activePath,
  files,
  onSelectPath,
  t,
}: ReviewChangedFilesTreePaneProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const allDirectoryPaths = useMemo(() => collectDirectoryPaths(files), [files]);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(
    () => new Set(allDirectoryPaths),
  );

  const visibleFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return files;
    }

    return files.filter((file) => normalizeReviewPath(file.path).toLowerCase().includes(normalizedQuery));
  }, [files, searchQuery]);
  const visibleDirectories = useMemo(() => collectDirectoryPaths(visibleFiles), [visibleFiles]);
  const treeNodes = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);
  const effectiveExpandedDirectories =
    searchQuery.trim().length > 0
      ? new Set(visibleDirectories)
      : expandedDirectories;

  useEffect(() => {
    setExpandedDirectories(new Set(allDirectoryPaths));
  }, [allDirectoryPaths]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <SearchInput onChange={setSearchQuery} query={searchQuery} t={t} />
      <div className="min-h-0 flex-1">
        {visibleFiles.length === 0 ? (
          <div className="px-2 py-2 text-left text-[13px] text-[var(--app-shell-muted)]">
            {t("codex.review.fileSearch.empty")}
          </div>
        ) : (
          <div className="h-full min-h-0 w-full px-2">
            <FileTreeNodes
              activeFilePath={activePath == null ? null : normalizeReviewPath(activePath)}
              depth={0}
              expandedDirectories={effectiveExpandedDirectories}
              nodes={treeNodes}
              onSelectFile={onSelectPath}
              onToggleDirectory={(directoryPath) => {
                setExpandedDirectories((current) => {
                  const next = new Set(current);
                  if (next.has(directoryPath)) {
                    next.delete(directoryPath);
                  } else {
                    next.add(directoryPath);
                  }
                  return next;
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
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
        <label htmlFor="review-changed-files-search" className="sr-only">
          {t("codex.fileTreeSearch.label")}
        </label>
        <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
        <input
          id="review-changed-files-search"
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

function FileTreeNodes({
  activeFilePath,
  depth,
  expandedDirectories,
  nodes,
  onSelectFile,
  onToggleDirectory,
}: {
  activeFilePath: string | null;
  depth: number;
  expandedDirectories: Set<string>;
  nodes: FileTreeNode[];
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5 py-2">
      {nodes.map((node) =>
        node.kind === "directory" ? (
          <div key={`dir:${node.path}`}>
            <button
              type="button"
              onClick={() => onToggleDirectory(node.path)}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]"
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              <ChevronDownIcon
                className={[
                  "h-4 w-4 shrink-0 text-[var(--app-shell-muted)] transition-transform",
                  expandedDirectories.has(node.path) ? "rotate-0" : "-rotate-90",
                ].join(" ")}
              />
              <FolderIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
              <span className="truncate">{node.name}</span>
            </button>
            {expandedDirectories.has(node.path) ? (
              <FileTreeNodes
                activeFilePath={activeFilePath}
                depth={depth + 1}
                expandedDirectories={expandedDirectories}
                nodes={node.children}
                onSelectFile={onSelectFile}
                onToggleDirectory={onToggleDirectory}
              />
            ) : null}
          </div>
        ) : (
          <button
            key={`file:${node.filePath}`}
            type="button"
            onClick={() => onSelectFile(node.filePath)}
            className={[
              "flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13px]",
              activeFilePath === normalizeReviewPath(node.filePath)
                ? "app-nav-item-active"
                : "app-nav-item-idle",
            ].join(" ")}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
            <span className="truncate">{node.name}</span>
          </button>
        ),
      )}
    </div>
  );
}

function collectDirectoryPaths(files: FileChangeSummary[]) {
  const directoryPaths = new Set<string>();

  for (const file of files) {
    const segments = normalizeReviewPath(file.path)
      .split("/")
      .filter((segment) => segment.length > 0);
    for (let index = 1; index < segments.length; index += 1) {
      directoryPaths.add(segments.slice(0, index).join("/"));
    }
  }

  return Array.from(directoryPaths).sort((left, right) => left.localeCompare(right));
}

function buildFileTree(files: FileChangeSummary[]) {
  const root = new Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>();

  for (const file of files) {
    const normalizedPath = normalizeReviewPath(file.path);
    const segments = normalizedPath.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      continue;
    }

    let currentChildren = root;
    let directoryPath = "";

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const isFileSegment = index === segments.length - 1;

      if (isFileSegment) {
        currentChildren.set(`file:${normalizedPath}`, {
          kind: "file",
          name: segment,
          filePath: file.path,
        });
        continue;
      }

      directoryPath = directoryPath.length > 0 ? `${directoryPath}/${segment}` : segment;
      const directoryKey = `dir:${directoryPath}`;
      const existingNode = currentChildren.get(directoryKey);
      if (existingNode && existingNode.kind === "directory") {
        currentChildren = existingNode.children;
        continue;
      }

      const nextDirectory: MutableFileTreeDirectoryNode = {
        kind: "directory",
        name: segment,
        path: directoryPath,
        children: new Map(),
      };
      currentChildren.set(directoryKey, nextDirectory);
      currentChildren = nextDirectory.children;
    }
  }

  return flattenEmptyDirectories(finalizeTreeNodes(root));
}

function finalizeTreeNodes(
  nodes: Map<string, MutableFileTreeDirectoryNode | FileTreeFileNode>,
): FileTreeNode[] {
  return Array.from(nodes.values())
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .map((node) =>
      node.kind === "directory"
        ? {
            kind: "directory",
            name: node.name,
            path: node.path,
            children: finalizeTreeNodes(node.children),
          }
        : node,
    );
}

function flattenEmptyDirectories(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.kind !== "directory") {
      return node;
    }

    const flattenedChildren = flattenEmptyDirectories(node.children);
    if (flattenedChildren.length === 1 && flattenedChildren[0]?.kind === "directory") {
      const child = flattenedChildren[0];
      return {
        kind: "directory",
        name: `${node.name}/${child.name}`,
        path: child.path,
        children: child.children,
      };
    }

    return {
      ...node,
      children: flattenedChildren,
    };
  });
}

function normalizeReviewPath(path: string) {
  return path.replaceAll("\\", "/");
}
