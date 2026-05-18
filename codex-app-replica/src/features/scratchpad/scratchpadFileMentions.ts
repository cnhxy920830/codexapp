import type { WorkspaceFileSearchResult } from "../../services/workspaceFiles";

export type ScratchpadFileMentionCandidate = {
  id: string;
  kind: "file";
  label: string;
  displayLabel: string;
  insertText: string;
  detail: string | null;
  absolutePath: string;
};

export function buildScratchpadFilePromptLink({
  absolutePath,
  label,
}: {
  absolutePath: string;
  label: string;
}) {
  const normalizedLabel = normalizeScratchpadFileLabel(label);
  const normalizedHref = encodeURI(absolutePath.replaceAll("\\", "/"));
  return `[${normalizedLabel}](${normalizedHref})`;
}

export function buildScratchpadFileMentionCandidate({
  result,
  workspaceRoot,
}: {
  result: WorkspaceFileSearchResult;
  workspaceRoot: string;
}): ScratchpadFileMentionCandidate {
  const displayLabel = normalizeScratchpadFileLabel(result.relativePath || result.name || result.path);
  return {
    id: `file:${result.path.toLowerCase()}`,
    kind: "file",
    label: displayLabel,
    displayLabel,
    insertText: buildScratchpadFilePromptLink({
      absolutePath: result.path,
      label: displayLabel,
    }),
    detail: workspaceRoot,
    absolutePath: result.path,
  };
}

export function dedupeScratchpadFileMentionCandidates(
  candidates: ScratchpadFileMentionCandidate[],
) {
  const uniqueCandidates = new Map<string, ScratchpadFileMentionCandidate>();

  for (const candidate of candidates) {
    if (!uniqueCandidates.has(candidate.id)) {
      uniqueCandidates.set(candidate.id, candidate);
    }
  }

  return Array.from(uniqueCandidates.values());
}

function normalizeScratchpadFileLabel(label: string) {
  const normalized = label.trim().replaceAll("\\", "/").replace(/^\.?\//u, "");
  return normalized.length > 0 ? normalized : label.trim();
}
