import { invoke } from "@tauri-apps/api/core";

export async function getCodexHomePath() {
  return invoke<string>("get_codex_home");
}

export function isWithinCodexWorktrees(cwd: string | null | undefined, codexHome: string | null | undefined) {
  if (!cwd || !codexHome) {
    return false;
  }

  const normalizedWorktreesRoot = normalizeWorktreePath(`${codexHome.replace(/[\\/]+$/, "")}/worktrees`);
  return normalizeWorktreePath(cwd).includes(normalizedWorktreesRoot);
}

function normalizeWorktreePath(path: string) {
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("//") || path.startsWith("\\\\");
  const normalized = normalizePosixPath(path.replace(/\\/g, "/"));
  return isWindowsPath ? normalized.toLowerCase() : normalized;
}

function normalizePosixPath(path: string) {
  const isAbsolute = path.startsWith("/");
  const segments = path.split("/");
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      const previous = normalizedSegments.at(-1);
      if (previous && previous !== ".." && !previous.endsWith(":")) {
        normalizedSegments.pop();
        continue;
      }
    }
    normalizedSegments.push(segment);
  }

  if (normalizedSegments.length === 0) {
    return isAbsolute ? "/" : ".";
  }

  return `${isAbsolute ? "/" : ""}${normalizedSegments.join("/")}`;
}
