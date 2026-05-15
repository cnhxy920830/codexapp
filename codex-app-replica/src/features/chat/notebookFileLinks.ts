import type { MarkdownFileLinkReference } from "../../components/markdownLinkTypes";
import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";

type ResolveNotebookWorkspaceFileLinkTargetArgs = {
  fileReference: MarkdownFileLinkReference;
  hostId?: string | null;
  notebookCwd: string | null;
  workspaceRoot: string | null;
};

type ParsedPath = {
  isAbsolute: boolean;
  prefix: string;
  segments: string[];
};

export function resolveNotebookWorkspaceFileLinkTarget({
  fileReference,
  hostId = null,
  notebookCwd,
  workspaceRoot,
}: ResolveNotebookWorkspaceFileLinkTargetArgs): WorkspaceFilePreviewTarget | null {
  if (workspaceRoot == null) {
    return null;
  }

  const resolvedPath = resolveNotebookFileLinkPath(fileReference.path, notebookCwd);
  if (resolvedPath == null) {
    return null;
  }

  const normalizedWorkspaceRoot = normalizePath(workspaceRoot);
  if (normalizedWorkspaceRoot == null) {
    return null;
  }

  const normalizedResolvedPath = normalizePath(resolvedPath);
  if (normalizedResolvedPath == null || !isPathInsideRoot(normalizedWorkspaceRoot, normalizedResolvedPath)) {
    return null;
  }

  const relativePath = normalizedResolvedPath
    .slice(normalizedWorkspaceRoot.length)
    .replace(/^\\+/, "")
    .replaceAll("\\", "/");
  const name = relativePath.split("/").filter((segment) => segment.length > 0).at(-1) ?? fileReference.path;

  return {
    hostId,
    name,
    path: normalizedResolvedPath,
    relativePath,
    workspaceRoot,
  };
}

function resolveNotebookFileLinkPath(path: string, notebookCwd: string | null) {
  const trimmedPath = path.trim();
  if (trimmedPath.length === 0 || trimmedPath.startsWith("~")) {
    return null;
  }

  if (isAbsolutePath(trimmedPath)) {
    return normalizePath(trimmedPath);
  }

  if (notebookCwd == null) {
    return null;
  }

  const normalizedNotebookCwd = normalizePath(notebookCwd);
  if (normalizedNotebookCwd == null) {
    return null;
  }

  return joinPath(normalizedNotebookCwd, trimmedPath);
}

function isAbsolutePath(path: string) {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\") || path.startsWith("\\") || path.startsWith("/");
}

function isPathInsideRoot(rootPath: string, candidatePath: string) {
  const normalizedRoot = rootPath.toLowerCase();
  const normalizedCandidate = candidatePath.toLowerCase();
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}\\`);
}

function joinPath(basePath: string, relativePath: string) {
  const parsedBasePath = parsePath(basePath);
  if (parsedBasePath == null || !parsedBasePath.isAbsolute) {
    return null;
  }

  const parsedRelativePath = parsePath(relativePath);
  if (parsedRelativePath == null || parsedRelativePath.isAbsolute) {
    return null;
  }

  return buildPath({
    isAbsolute: true,
    prefix: parsedBasePath.prefix,
    segments: normalizePathSegments([...parsedBasePath.segments, ...parsedRelativePath.segments], true),
  });
}

function normalizePath(path: string) {
  const parsedPath = parsePath(path);
  if (parsedPath == null) {
    return null;
  }

  return buildPath({
    ...parsedPath,
    segments: normalizePathSegments(parsedPath.segments, parsedPath.isAbsolute),
  });
}

function parsePath(path: string): ParsedPath | null {
  const normalizedPath = path.trim().replaceAll("/", "\\");
  if (normalizedPath.length === 0) {
    return null;
  }

  const driveMatch = /^([A-Za-z]):\\/.exec(normalizedPath);
  if (driveMatch != null) {
    const prefix = `${(driveMatch[1] ?? "").toUpperCase()}:`;
    return {
      isAbsolute: true,
      prefix,
      segments: normalizedPath
        .slice(prefix.length)
        .split("\\")
        .filter((segment) => segment.length > 0),
    };
  }

  if (normalizedPath.startsWith("\\\\")) {
    const uncMatch = /^\\\\[^\\]+\\[^\\]+/.exec(normalizedPath);
    if (uncMatch == null) {
      return null;
    }

    return {
      isAbsolute: true,
      prefix: uncMatch[0],
      segments: normalizedPath
        .slice(uncMatch[0].length)
        .split("\\")
        .filter((segment) => segment.length > 0),
    };
  }

  if (normalizedPath.startsWith("\\")) {
    return {
      isAbsolute: true,
      prefix: "\\",
      segments: normalizedPath.split("\\").filter((segment) => segment.length > 0),
    };
  }

  return {
    isAbsolute: false,
    prefix: "",
    segments: normalizedPath.split("\\").filter((segment) => segment.length > 0),
  };
}

function normalizePathSegments(segments: string[], clampToRoot: boolean) {
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (normalizedSegments.length > 0 && normalizedSegments[normalizedSegments.length - 1] !== "..") {
        normalizedSegments.pop();
      } else if (!clampToRoot) {
        normalizedSegments.push(segment);
      }
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments;
}

function buildPath(path: ParsedPath) {
  const joinedSegments = path.segments.join("\\");
  if (!path.isAbsolute) {
    return joinedSegments;
  }

  if (path.prefix === "\\") {
    return joinedSegments.length > 0 ? `\\${joinedSegments}` : "\\";
  }

  if (path.prefix.startsWith("\\\\")) {
    return joinedSegments.length > 0 ? `${path.prefix}\\${joinedSegments}` : path.prefix;
  }

  return joinedSegments.length > 0 ? `${path.prefix}\\${joinedSegments}` : `${path.prefix}\\`;
}
