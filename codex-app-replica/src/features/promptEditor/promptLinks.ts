import type { AppInfo } from "../../services/apps";
import type { PluginSummary } from "../../services/plugins";
import type { SkillSummary } from "../../services/skills";
import {
  classifyPromptLink,
  normalizeAppMentionName,
  type PromptLinkSegment,
} from "../../lib/promptLinks";

export type PromptEditorSegment =
  | {
      type: "text";
      value: string;
    }
  | PromptLinkSegment;

export type PromptEditorMentionSegment = Extract<
  PromptEditorSegment,
  { type: "agent" | "app" | "plugin" | "skill" }
>;

type PromptEditorParseOptions = {
  apps?: AppInfo[];
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
};

const PROMPT_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

export function parsePromptEditorSegments(
  text: string,
  { apps = [], plugins = [], skills = [] }: PromptEditorParseOptions = {},
): PromptEditorSegment[] {
  const segments: PromptEditorSegment[] = [];
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
        plugins,
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

export function isPromptEditorMentionSegment(
  segment: PromptEditorSegment,
): segment is PromptEditorMentionSegment {
  return (
    segment.type === "agent" ||
    segment.type === "app" ||
    segment.type === "plugin" ||
    segment.type === "skill"
  );
}

export function buildPromptEditorMentionDisplayText(segment: PromptEditorMentionSegment) {
  const prefix = segment.type === "agent" || segment.type === "plugin" ? "@" : "$";
  return `${prefix}${segment.displayLabel}`;
}

export function buildPromptEditorMentionTitle(segment: PromptEditorMentionSegment) {
  switch (segment.type) {
    case "agent":
      return segment.href;
    case "app":
      return segment.detail ?? segment.href;
    case "plugin":
      return segment.detail ?? segment.href;
    case "skill":
      return segment.detail ?? segment.path;
  }
}

export function buildPromptEditorAppLink(app: AppInfo) {
  return `[$${normalizeAppMentionName(app.name)}](app://${app.id})`;
}

export function buildPromptEditorSkillLink(skill: SkillSummary) {
  const label = `$${skill.name}`;
  if (!skill.path) {
    return label;
  }
  return `[${label}](${encodeURI(skill.path.replace(/\\/g, "/"))})`;
}
