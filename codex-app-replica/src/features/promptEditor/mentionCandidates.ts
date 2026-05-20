import type { MessageKey } from "../../i18n/messages";
import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";
import {
  buildPromptEditorAppLink,
  buildPromptEditorSkillLink,
} from "./promptLinks";
import type {
  PromptEditorAppMentionCandidate,
  PromptEditorMentionState,
  PromptEditorSkillMentionCandidate,
} from "./types";

export function buildAppMentionCandidates({
  mentionState,
  apps,
  t,
}: {
  mentionState: PromptEditorMentionState | null;
  apps: AppInfo[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}): PromptEditorAppMentionCandidate[] {
  if (mentionState === null || mentionState.symbol !== "@") {
    return [];
  }

  const normalizedQuery = mentionState.query.trim().toLowerCase();
  const appCandidates = apps
    .filter((app) => app.isAccessible)
    .filter((app) => {
      if (normalizedQuery.length === 0) {
        return true;
      }
      return (
        app.name.toLowerCase().includes(normalizedQuery) ||
        (app.description ?? "").toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 8)
    .map((app) => ({
      id: `app:${app.id}`,
      kind: "app" as const,
      label: app.name,
      displayLabel: app.name,
      insertText: buildPromptEditorAppLink(app),
      detail: app.description ?? null,
      iconSource: app.logoUrl ?? app.logoUrlDark ?? null,
      scopeLabel: t("apps.appConnectOAuthCallbackPage.fallbackAppName"),
    }));

  return appCandidates;
}

export function buildSkillMentionCandidates({
  mentionState,
  skills,
  activeWorkspaceRoots,
  t,
}: {
  mentionState: PromptEditorMentionState | null;
  skills: SkillSummary[];
  activeWorkspaceRoots: string[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}): PromptEditorSkillMentionCandidate[] {
  if (mentionState === null || mentionState.symbol !== "$") {
    return [];
  }

  const normalizedQuery = mentionState.query.trim().toLowerCase();
  const dedupedSkills = dedupeSkills(skills);

  return skills
    .filter((skill) => dedupedSkills.includes(skill))
    .filter((skill) => {
      if (normalizedQuery.length === 0) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(normalizedQuery) ||
        (skill.displayName ?? "").toLowerCase().includes(normalizedQuery) ||
        skill.description.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 8)
    .map((skill) => ({
      id: `skill:${skill.path || skill.name}`,
      kind: "skill" as const,
      label: skill.displayName ?? skill.name,
      displayLabel: skill.displayName ?? skill.name,
      insertText: buildPromptEditorSkillLink(skill),
      detail: skill.shortDescription ?? skill.description,
      path: skill.path,
      brandColor: skill.brandColor ?? null,
      iconSource: skill.iconSmall ?? skill.iconLarge ?? null,
      scopeLabel: getSkillScopeLabel(skill, activeWorkspaceRoots, t),
    }));
}

export function dedupeSkills(skills: SkillSummary[]) {
  const selectedByName = new Map<string, SkillSummary>();

  for (const skill of skills) {
    const existing = selectedByName.get(skill.name);
    if (existing == null) {
      selectedByName.set(skill.name, skill);
      continue;
    }

    const currentRank = getScopePriority(skill.scope);
    const existingRank = getScopePriority(existing.scope);
    if (
      currentRank < existingRank ||
      (currentRank === existingRank && skill.path.localeCompare(existing.path) < 0)
    ) {
      selectedByName.set(skill.name, skill);
    }
  }

  return Array.from(selectedByName.values());
}

export function getSkillScopeLabel(
  skill: SkillSummary,
  workspaceRoots: string[],
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const normalizedScope = normalizeScope(skill.scope);
  if (normalizedScope === "repo") {
    const repoRoot = getBestMatchingRoot(skill.path, workspaceRoots);
    return repoRoot ? getPathBasename(repoRoot) : t("skills.scope.team");
  }
  if (normalizedScope === "user") {
    return t("skills.scope.personal");
  }
  if (normalizedScope === "admin") {
    return t("skills.scope.adminInstalled");
  }
  return t("skills.scope.builtIn");
}

function getScopePriority(scope: string) {
  return SCOPE_PRIORITY[normalizeScope(scope)] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getBestMatchingRoot(path: string, roots: string[]) {
  let bestMatch: string | null = null;

  for (const root of roots) {
    if (!path.startsWith(root)) {
      continue;
    }
    if (bestMatch == null || root.length > bestMatch.length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

function getPathBasename(path: string) {
  const trimmedPath = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmedPath.lastIndexOf("/"), trimmedPath.lastIndexOf("\\"));
  return separatorIndex === -1 ? trimmedPath : trimmedPath.slice(separatorIndex + 1);
}

const SCOPE_PRIORITY: Record<string, number> = {
  repo: 0,
  user: 1,
  personal: 1,
  system: 2,
  "built-in": 2,
  builtin: 2,
  admin: 3,
  admininstalled: 3,
};
