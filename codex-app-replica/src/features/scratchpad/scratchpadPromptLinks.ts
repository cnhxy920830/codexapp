import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";
import { classifyPromptLink, type PromptLinkSegment } from "../../lib/promptLinks";

export type ScratchpadPromptSegment =
  | {
      type: "text";
      value: string;
    }
  | PromptLinkSegment;

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
    segments.push(
      classifyPromptLink({
        raw,
        label,
        href,
        apps,
        skills,
      }),
    );

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
