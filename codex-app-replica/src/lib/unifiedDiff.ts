export type PullRequestDiffFileStatus = "added" | "deleted" | "modified" | "renamed";

export type PullRequestDiffHunkContent =
  | {
      type: "context";
      lines: number;
    }
  | {
      type: "addition";
      additions: number;
    }
  | {
      type: "deletion";
      deletions: number;
    };

export type PullRequestDiffHunk = {
  additionCount: number;
  additionStart: number;
  deletionCount: number;
  deletionStart: number;
  hunkContent: PullRequestDiffHunkContent[];
  hunkSpecs: string;
  noEOFCRAdditions: boolean;
  noEOFCRDeletions: boolean;
};

export type PullRequestDiffFile = {
  additions: number;
  deletions: number;
  headerLines: string[];
  hunkMetadata: PullRequestDiffHunk[];
  hunks: string[];
  isBinary: boolean;
  isPartial: boolean;
  newObjectId: string | null;
  newPath: string | null;
  oldObjectId: string | null;
  oldPath: string | null;
  path: string;
  patch: string;
  status: PullRequestDiffFileStatus;
};

export type PullRequestUnifiedDiffSummary = {
  fileCount: number;
  linesAdded: number;
  linesDeleted: number;
  hasChanges: boolean;
};

export function buildPullRequestGitApplyCommand(unifiedDiff: string) {
  return ` (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF'\n${unifiedDiff}\nEOF\n)`;
}

export function buildPullRequestUnifiedDiffSummary(files: PullRequestDiffFile[]): PullRequestUnifiedDiffSummary {
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const file of files) {
    linesAdded += file.additions;
    linesDeleted += file.deletions;
  }

  const fileCount = files.length;

  return {
    fileCount,
    linesAdded,
    linesDeleted,
    hasChanges: !(fileCount === 0 && linesAdded === 0 && linesDeleted === 0),
  };
}

export function parsePullRequestUnifiedDiff(unifiedDiff: string) {
  const lines = normalizeText(unifiedDiff).split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

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
      hunkMetadata: [...current.hunkMetadata],
      hunks: [...current.hunks],
      isBinary: current.isBinary,
      isPartial:
        !current.isBinary &&
        (current.additions > 0 || current.deletions > 0 || current.hunkMetadata.length > 0),
      newObjectId: current.newObjectId,
      newPath: current.newPath,
      oldObjectId: current.oldObjectId,
      oldPath: current.oldPath,
      path: current.path ?? current.newPath ?? current.oldPath ?? "unknown",
      patch: current.rawLines.join("\n"),
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
      current.activeHunk = { ...parseHunkHeader(line) };
      current.hunkMetadata.push(current.activeHunk);
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
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

    if (line.startsWith("Binary files ")) {
      current.isBinary = true;
      current.headerLines.push(line);
      continue;
    }

    if (line.startsWith("index ")) {
      const match = /^index\s+([0-9a-fA-F]+)\.\.([0-9a-fA-F]+)(?:\s+\d+)?$/.exec(line.trim());
      if (match) {
        current.oldObjectId = normalizeDiffObjectId(match[1]);
        current.newObjectId = normalizeDiffObjectId(match[2]);
      }
      current.headerLines.push(line);
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

    if (current.activeHunk == null) {
      current.headerLines.push(line);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
      appendHunkContent(current.activeHunk.hunkContent, {
        type: "addition",
        additions: 1,
      });
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
      appendHunkContent(current.activeHunk.hunkContent, {
        type: "deletion",
        deletions: 1,
      });
      continue;
    }

    appendHunkContent(current.activeHunk.hunkContent, {
      type: "context",
      lines: 1,
    });
  }

  flushCurrent();
  return files;
}

type MutablePullRequestDiffFile = {
  additions: number;
  deletions: number;
  headerLines: string[];
  hunkMetadata: PullRequestDiffHunk[];
  hunks: string[];
  isBinary: boolean;
  newObjectId: string | null;
  newPath: string | null;
  oldObjectId: string | null;
  oldPath: string | null;
  path: string | null;
  rawLines: string[];
  status: PullRequestDiffFileStatus;
  activeHunk: MutablePullRequestDiffHunk | null;
};

type MutablePullRequestDiffHunk = {
  additionCount: number;
  additionStart: number;
  deletionCount: number;
  deletionStart: number;
  hunkContent: PullRequestDiffHunkContent[];
  hunkSpecs: string;
  noEOFCRAdditions: boolean;
  noEOFCRDeletions: boolean;
};

function createDiffFile(diffHeader: string): MutablePullRequestDiffFile {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(diffHeader.trim());
  const oldPath = match?.[1] ?? null;
  const newPath = match?.[2] ?? oldPath;
  return {
    additions: 0,
    deletions: 0,
    headerLines: [diffHeader],
    hunkMetadata: [],
    hunks: [],
    isBinary: false,
    newObjectId: null,
    newPath,
    oldObjectId: null,
    oldPath,
    path: newPath ?? oldPath,
    rawLines: [diffHeader],
    status: "modified",
    activeHunk: null,
  };
}

function appendHunkContent(
  hunkContent: PullRequestDiffHunkContent[],
  entry: PullRequestDiffHunkContent,
) {
  const previous = hunkContent[hunkContent.length - 1];
  if (previous == null || previous.type !== entry.type) {
    hunkContent.push(entry);
    return;
  }

  switch (previous.type) {
    case "context":
      (previous as Extract<PullRequestDiffHunkContent, { type: "context" }>).lines +=
        (entry as Extract<PullRequestDiffHunkContent, { type: "context" }>).lines;
      return;
    case "addition":
      (previous as Extract<PullRequestDiffHunkContent, { type: "addition" }>).additions +=
        (entry as Extract<PullRequestDiffHunkContent, { type: "addition" }>).additions;
      return;
    case "deletion":
      (previous as Extract<PullRequestDiffHunkContent, { type: "deletion" }>).deletions +=
        (entry as Extract<PullRequestDiffHunkContent, { type: "deletion" }>).deletions;
      return;
  }
}

function parseHunkHeader(line: string): PullRequestDiffHunk {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
  return {
    additionCount: match == null ? 0 : parseCount(match[4]),
    additionStart: match == null ? 0 : Number(match[3]),
    deletionCount: match == null ? 0 : parseCount(match[2]),
    deletionStart: match == null ? 0 : Number(match[1]),
    hunkContent: [],
    hunkSpecs: line,
    noEOFCRAdditions: false,
    noEOFCRDeletions: false,
  };
}

function parseCount(value: string | undefined) {
  return value == null ? 1 : Number(value);
}

function normalizeDiffObjectId(value: string) {
  return /^0+$/.test(value) ? null : value;
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
