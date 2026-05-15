import type { AppInfo } from "../services/apps";
import type { PluginSummary } from "../services/plugins";
import type { SkillSummary } from "../services/skills";
import { looksLikeFileReference, parseFileReference } from "./fileReference";

export type PromptLinkSegment =
  | {
      type: "app";
      raw: string;
      label: string;
      href: string;
      appId: string;
      displayLabel: string;
      detail: string | null;
      iconSource: string | null;
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
      iconSource: string | null;
    }
  | {
      type: "plugin";
      raw: string;
      label: string;
      href: string;
      displayLabel: string;
      detail: string | null;
      brandColor: string | null;
      iconSource: string | null;
    }
  | {
      type: "agent";
      raw: string;
      label: string;
      href: string;
      displayLabel: string;
      detail: null;
      conversationId: string | null;
      roleName: string | null;
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

type PromptLinkClassificationOptions = {
  raw?: string;
  label: string;
  href: string;
  apps?: AppInfo[];
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
};

export function classifyPromptLink({
  raw,
  label,
  href,
  apps = [],
  plugins = [],
  skills = [],
}: PromptLinkClassificationOptions): PromptLinkSegment {
  const trimmedLabel = label.trim();
  const trimmedHref = href.trim();
  const segmentRaw = raw ?? `[${label}](${href})`;

  if (trimmedHref.startsWith("app://")) {
    const appId = decodeURIComponent(trimmedHref.slice("app://".length));
    const labelKey = stripMentionPrefix(trimmedLabel, "@").toLowerCase();
    const resolvedApp =
      apps.find((app) => app.id.toLowerCase() === appId.toLowerCase()) ??
      apps.find((app) => app.name.toLowerCase() === labelKey) ??
      null;

    return {
      type: "app",
      raw: segmentRaw,
      label: trimmedLabel,
      href: trimmedHref,
      appId,
      displayLabel: resolvedApp?.name ?? (stripMentionPrefix(trimmedLabel, "@") || appId),
      detail: resolvedApp?.description ?? null,
      iconSource: resolvedApp?.logoUrl ?? resolvedApp?.logoUrlDark ?? null,
    };
  }

  if (trimmedHref.startsWith("plugin://")) {
    const pluginId = decodeURIComponent(trimmedHref.slice("plugin://".length));
    const labelKey = stripMentionPrefix(trimmedLabel, "@").toLowerCase();
    const resolvedPlugin =
      plugins.find((plugin) => plugin.id.toLowerCase() === pluginId.toLowerCase()) ??
      plugins.find((plugin) => plugin.name.toLowerCase() === labelKey) ??
      plugins.find((plugin) => (plugin.interface?.displayName ?? "").toLowerCase() === labelKey) ??
      null;

    return {
      type: "plugin",
      raw: segmentRaw,
      label: trimmedLabel,
      href: trimmedHref,
      displayLabel:
        resolvedPlugin?.interface?.displayName ??
        (stripMentionPrefix(trimmedLabel, "@") || pluginId),
      detail: resolvedPlugin?.interface?.shortDescription ?? null,
      brandColor: resolvedPlugin?.interface?.brandColor ?? null,
      iconSource: resolvePluginIconSource(resolvedPlugin),
    };
  }

  if (trimmedHref.startsWith("agent://")) {
    const conversationId = parseAgentConversationId(trimmedHref);
    return {
      type: "agent",
      raw: segmentRaw,
      label: trimmedLabel,
      href: trimmedHref,
      displayLabel: stripMentionPrefix(trimmedLabel, "@") || conversationId || "agent",
      detail: null,
      conversationId,
      roleName: null,
    };
  }

  if (trimmedHref.startsWith("subagent://")) {
    const roleName = parseSubagentRoleName(trimmedHref);
    return {
      type: "agent",
      raw: segmentRaw,
      label: trimmedLabel,
      href: trimmedHref,
      displayLabel: stripMentionPrefix(trimmedLabel, "@") || roleName || "agent",
      detail: null,
      conversationId: null,
      roleName,
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
      raw: segmentRaw,
      label: trimmedLabel,
      href: trimmedHref,
      path: resolvedSkill?.path ?? path,
      displayLabel: resolvedSkill?.displayName ?? resolvedSkill?.name ?? stripMentionPrefix(trimmedLabel, "$"),
      detail: resolvedSkill?.shortDescription ?? resolvedSkill?.description ?? null,
      brandColor: resolvedSkill?.brandColor ?? null,
      iconSource: resolvedSkill?.iconSmall ?? resolvedSkill?.iconLarge ?? null,
    };
  }

  if (/^(https?:\/\/)/i.test(trimmedHref)) {
    return {
      type: "url",
      raw: segmentRaw,
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
        raw: segmentRaw,
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
    raw: segmentRaw,
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

function resolvePluginIconSource(plugin: PluginSummary | null) {
  if (plugin == null) {
    return null;
  }

  return (
    plugin.interface?.composerIconUrl ??
    plugin.interface?.logoUrl ??
    plugin.interface?.composerIcon ??
    plugin.interface?.logo ??
    null
  );
}

function parseAgentConversationId(href: string) {
  const conversationId = href.slice("agent://".length).trim();
  return conversationId.length === 0 ? null : conversationId;
}

function parseSubagentRoleName(href: string) {
  const roleName = href.slice("subagent://".length).trim();
  return roleName.length === 0 ? null : roleName;
}
