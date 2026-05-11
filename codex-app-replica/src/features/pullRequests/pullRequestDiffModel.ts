export type PullRequestDiffFileStatus = "added" | "deleted" | "modified" | "renamed";

export type PullRequestDiffFile = {
  additions: number;
  deletions: number;
  headerLines: string[];
  hunks: string[];
  newPath: string | null;
  oldPath: string | null;
  path: string;
  patch: string;
  status: PullRequestDiffFileStatus;
};

export function buildPullRequestGitApplyCommand(unifiedDiff: string) {
  return ` (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF'\n${unifiedDiff}\nEOF\n)`;
}

export function parsePullRequestUnifiedDiff(unifiedDiff: string) {
  const lines = normalizeText(unifiedDiff).split("\n");
  const files: PullRequestDiffFile[] = [];
  let current: MutablePullRequestDiffFile | null = null;

  const flushCurrent = () => {
    if (current == null) {
      return;
    }

    files.push({
      additions: current.additions,
      deletions: current.deletions,
      headerLines: [...current.headerLines],
      hunks: [...current.hunks],
      newPath: current.newPath,
      oldPath: current.oldPath,
      path: current.path ?? current.newPath ?? current.oldPath ?? "unknown",
      patch: current.rawLines.join("\n").trimEnd(),
      status: current.status,
    });
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushCurrent();
      current = createDiffFile(line);
      continue;
    }

    if (current == null) {
      continue;
    }

    current.rawLines.push(line);
    if (line.startsWith("@@ ")) {
      current.hunks.push(line);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
      continue;
    }
    if (line.startsWith("rename from ")) {
      current.status = "renamed";
      current.oldPath = line.slice("rename from ".length).trim() || current.oldPath;
      current.path = current.oldPath ?? current.path;
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.status = "renamed";
      current.newPath = line.slice("rename to ".length).trim() || current.newPath;
      current.path = current.newPath ?? current.path;
      continue;
    }
    if (line.startsWith("new file mode ")) {
      current.status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      current.status = "deleted";
      continue;
    }
    if (line.startsWith("--- ")) {
      const oldPath = normalizeDiffPath(line.slice(4).trim());
      current.oldPath = oldPath === "/dev/null" ? null : oldPath;
      current.headerLines.push(line);
      if (current.status !== "renamed" && current.status !== "deleted") {
        current.path = current.oldPath ?? current.path;
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const newPath = normalizeDiffPath(line.slice(4).trim());
      current.newPath = newPath === "/dev/null" ? null : newPath;
      current.headerLines.push(line);
      current.path =
        current.status === "deleted" ? current.oldPath ?? current.path : current.newPath ?? current.path;
      continue;
    }

    if (current.hunks.length === 0) {
      current.headerLines.push(line);
    } else {
      current.hunks.push(line);
    }
  }

  flushCurrent();
  return files;
}

type MutablePullRequestDiffFile = {
  additions: number;
  deletions: number;
  headerLines: string[];
  hunks: string[];
  newPath: string | null;
  oldPath: string | null;
  path: string | null;
  rawLines: string[];
  status: PullRequestDiffFileStatus;
};

function createDiffFile(diffHeader: string): MutablePullRequestDiffFile {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(diffHeader.trim());
  const oldPath = match?.[1] ?? null;
  const newPath = match?.[2] ?? oldPath;
  return {
    additions: 0,
    deletions: 0,
    headerLines: [diffHeader],
    hunks: [],
    newPath,
    oldPath,
    path: newPath ?? oldPath,
    rawLines: [diffHeader],
    status: "modified",
  };
}

function normalizeDiffPath(value: string) {
  if (value === "/dev/null") {
    return value;
  }
  return value.replace(/^a\//, "").replace(/^b\//, "");
}

function normalizeText(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}
