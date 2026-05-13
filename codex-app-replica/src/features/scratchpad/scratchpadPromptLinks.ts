import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";

export type ScratchpadPromptSegment =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "app";
      raw: string;
      label: string;
      href: string;
      appId: string;
      displayLabel: string;
      detail: string | null;
    }
  | {
      type: "skill";
      raw: string;
      label: string;
      href: string;
      path: string;
      displayLabel: string;
      detail: string | null;
      brandColor: string | null;
    }
  | {
      type: "plugin";
      raw: string;
      label: string;
      href: string;
      displayLabel: string;
      detail: string | null;
    }
  | {
      type: "url";
      raw: string;
      label: string;
      href: string;
      url: string;
    }
  | {
      type: "file";
      raw: string;
      label: string;
      href: string;
      path: string;
      line: number | null;
      column: number | null;
      locationSuffix: string;
    }
  | {
      type: "unknown";
      raw: string;
      label: string;
      href: string;
    };

export type ScratchpadPromptMentionSegment = Extract<
  ScratchpadPromptSegment,
  { type: "app" | "plugin" | "skill" }
>;

type ScratchpadPromptParseOptions = {
  apps?: AppInfo[];
  skills?: SkillSummary[];
};

const PROMPT_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

export function parseScratchpadPromptSegments(
  text: string,
  { apps = [], skills = [] }: ScratchpadPromptParseOptions = {},
): ScratchpadPromptSegment[] {
  const segments: ScratchpadPromptSegment[] = [];
  let lastIndex = 0;
  PROMPT_LINK_PATTERN.lastIndex = 0;
  let match = PROMPT_LINK_PATTERN.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    const label = match[1] ?? "";
    const href = match[2] ?? "";
    const raw = match[0];
    segments.push(classifyPromptLink(raw, label, href, apps, skills));

    lastIndex = match.index + raw.length;
    match = PROMPT_LINK_PATTERN.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: "text",
      value: text,
    });
  }

  return segments;
}

export function isScratchpadPromptMentionSegment(
  segment: ScratchpadPromptSegment,
): segment is ScratchpadPromptMentionSegment {
  return segment.type === "app" || segment.type === "plugin" || segment.type === "skill";
}

export function buildScratchpadPromptMentionDisplayText(segment: ScratchpadPromptMentionSegment) {
  const prefix = segment.type === "skill" ? "$" : "@";
  return `${prefix}${segment.displayLabel}`;
}

export function buildScratchpadPromptMentionTitle(segment: ScratchpadPromptMentionSegment) {
  switch (segment.type) {
    case "app":
      return segment.detail ?? segment.href;
    case "plugin":
      return segment.detail ?? segment.href;
    case "skill":
      return segment.detail ?? segment.path;
  }
}

export function buildScratchpadAppPromptLink(app: AppInfo) {
  return `[@${app.name}](app://${app.id})`;
}

export function buildScratchpadSkillPromptLink(skill: SkillSummary) {
  const label = `$${skill.name}`;
  if (!skill.path) {
    return label;
  }
  return `[${label}](${encodeURI(skill.path.replace(/\\/g, "/"))})`;
}

function classifyPromptLink(
  raw: string,
  label: string,
  href: string,
  apps: AppInfo[],
  skills: SkillSummary[],
): ScratchpadPromptSegment {
  const trimmedLabel = label.trim();
  const trimmedHref = href.trim();

  if (trimmedHref.startsWith("app://")) {
    const appId = decodeURIComponent(trimmedHref.slice("app://".length));
    const labelKey = stripMentionPrefix(trimmedLabel, "@").toLowerCase();
    const resolvedApp =
      apps.find((app) => app.id.toLowerCase() === appId.toLowerCase()) ??
      apps.find((app) => app.name.toLowerCase() === labelKey) ??
      null;

    return {
      type: "app",
      raw,
      label: trimmedLabel,
      href: trimmedHref,
      appId,
      displayLabel: resolvedApp?.name ?? (stripMentionPrefix(trimmedLabel, "@") || appId),
      detail: resolvedApp?.description ?? null,
    };
  }

  if (trimmedHref.startsWith("plugin://")) {
    return {
      type: "plugin",
      raw,
      label: trimmedLabel,
      href: trimmedHref,
      displayLabel: stripMentionPrefix(trimmedLabel, "@") || decodeURIComponent(trimmedHref.slice("plugin://".length)),
      detail: null,
    };
  }

  if (trimmedLabel.startsWith("$")) {
    const path = decodeURIComponent(trimmedHref).replaceAll("/", "\\");
    const labelKey = stripMentionPrefix(trimmedLabel, "$").toLowerCase();
    const resolvedSkill =
      skills.find((skill) => normalizePathKey(skill.path) === normalizePathKey(path)) ??
      skills.find((skill) => skill.name.toLowerCase() === labelKey) ??
      skills.find((skill) => (skill.displayName ?? "").toLowerCase() === labelKey) ??
      null;

    return {
      type: "skill",
      raw,
      label: trimmedLabel,
      href: trimmedHref,
      path: resolvedSkill?.path ?? path,
      displayLabel: resolvedSkill?.displayName ?? resolvedSkill?.name ?? stripMentionPrefix(trimmedLabel, "$"),
      detail: resolvedSkill?.shortDescription ?? resolvedSkill?.description ?? null,
      brandColor: resolvedSkill?.brandColor ?? null,
    };
  }

  if (/^(https?:\/\/)/i.test(trimmedHref)) {
    return {
      type: "url",
      raw,
      label: trimmedLabel,
      href: trimmedHref,
      url: trimmedHref,
    };
  }

  if (looksLikeFileReference(trimmedHref)) {
    const parsedReference = parseFileReference(trimmedHref);
    if (parsedReference !== null) {
      return {
        type: "file",
        raw,
        label: trimmedLabel,
        href: trimmedHref,
        path: parsedReference.path,
        line: parsedReference.line,
        column: parsedReference.column,
        locationSuffix:
          parsedReference.line === null
            ? ""
            : parsedReference.column === null
              ? `:${parsedReference.line}`
              : `:${parsedReference.line}:${parsedReference.column}`,
      };
    }
  }

  return {
    type: "unknown",
    raw,
    label: trimmedLabel,
    href: trimmedHref,
  };
}

function stripMentionPrefix(value: string, prefix: "@" | "$") {
  return value.startsWith(prefix) ? value.slice(1).trim() : value.trim();
}

function normalizePathKey(value: string) {
  return decodeURIComponent(value).replaceAll("/", "\\").trim().toLowerCase();
}

function looksLikeFileReference(value: string) {
  return /^[./~]|^[A-Za-z]:[\\/]/.test(value);
}

function parseFileReference(value: string) {
  const decodedValue = decodeURIComponent(value);
  const normalized = decodedValue.replaceAll("/", "\\");
  const windowsMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(normalized);
  if (!windowsMatch) {
    return null;
  }

  const path = windowsMatch[1]?.trim() ?? "";
  if (path.length === 0) {
    return null;
  }

  return {
    path,
    line: parsePositiveInteger(windowsMatch[2]),
    column: parsePositiveInteger(windowsMatch[3]),
  };
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
