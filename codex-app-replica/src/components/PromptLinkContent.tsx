import { Fragment, type CSSProperties, type ReactNode } from "react";
import { WorkspaceFileIcon } from "./AppShellIcons";
import { Tooltip } from "./Tooltip";
import { MarkdownOwnedLink, type MarkdownLinkContext } from "./markdownPreviewLinks";
import type { AppInfo } from "../services/apps";
import type { PluginSummary } from "../services/plugins";
import type { SkillSummary } from "../services/skills";
import { classifyPromptLink } from "../lib/promptLinks";

type PromptLinkContentProps = {
  apps?: AppInfo[];
  className?: string;
  context: MarkdownLinkContext;
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
  text: string;
};

const PROMPT_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
const INLINE_MENTION_BASE_CLASS =
  "group/inline-mention inline-mention-brand-aware inline cursor-pointer px-0.5 align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)]";
const INLINE_MENTION_INTERACTIVE_CLASS =
  "group/inline-mention inline-mention-brand-aware inline appearance-none cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)] hover:underline hover:decoration-current hover:decoration-dashed hover:decoration-[0.5px] hover:underline-offset-2";
const INLINE_MENTION_ICON_WRAPPER_CLASS = "relative mr-1 inline-block h-[1lh] w-4 align-bottom";
const INLINE_MENTION_ICON_CLASS = "icon-xs absolute top-1/2 -translate-y-1/2 rounded-[2px] object-cover";
const INLINE_MENTION_TEXT_CLASS = "min-w-0 break-words";
const FILE_LINK_CLASS = "inline appearance-none border-0 bg-transparent p-0 text-left align-baseline whitespace-normal";

export function PromptLinkContent({
  apps = [],
  className,
  context,
  plugins = [],
  skills = [],
  text,
}: PromptLinkContentProps) {
  return (
    <span className={className}>
      {renderPromptText({
        apps,
        context,
        plugins,
        skills,
        text,
      })}
    </span>
  );
}

export function renderPromptText({
  apps = [],
  context,
  plugins = [],
  skills = [],
  text,
}: {
  apps?: AppInfo[];
  context: MarkdownLinkContext;
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
  text: string;
}) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let elementIndex = 0;

  PROMPT_LINK_PATTERN.lastIndex = 0;
  let match = PROMPT_LINK_PATTERN.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const label = match[1] ?? "";
    const href = match[2] ?? "";
    const raw = match[0];
    const segment = classifyPromptLink({
      raw,
      label,
      href,
      apps,
      plugins,
      skills,
    });

    parts.push(
      renderPromptLinkSegment({
        context,
        index: elementIndex,
        segment,
      }) ?? raw,
    );

    lastIndex = match.index + raw.length;
    elementIndex += 1;
    match = PROMPT_LINK_PATTERN.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? [text] : parts;
}

function renderPromptLinkSegment({
  context,
  index,
  segment,
}: {
  context: MarkdownLinkContext;
  index: number;
  segment: ReturnType<typeof classifyPromptLink>;
}) {
  const key = `prompt-link-${index}`;

  switch (segment.type) {
    case "app":
      if (!segment.resolved) {
        return renderUnresolvedMentionText({
          key,
          prefix: "$",
          text: segment.displayLabel,
        });
      }
      return (
        <PromptMentionTooltip key={key} tooltipText={segment.detail ?? segment.href}>
          <MentionChip
            className={INLINE_MENTION_BASE_CLASS}
            iconSource={segment.iconSource}
            label={segment.displayLabel}
          />
        </PromptMentionTooltip>
      );
    case "plugin":
      if (!segment.resolved) {
        return renderUnresolvedMentionText({
          key,
          prefix: "@",
          text: segment.displayLabel,
        });
      }
      return (
        <PromptMentionTooltip key={key} tooltipText={segment.detail ?? segment.href}>
          <MentionChip
            className={INLINE_MENTION_BASE_CLASS}
            iconSource={segment.iconSource}
            label={segment.displayLabel}
            style={getMentionChipStyle(segment.brandColor)}
          />
        </PromptMentionTooltip>
      );
    case "agent":
      if (segment.conversationId == null && segment.roleName == null) {
        return null;
      }
      return (
        <PromptMentionTooltip key={key} tooltipText={segment.href}>
          <MentionChip
            className={`${INLINE_MENTION_BASE_CLASS} cursor-default`}
            label={`@${segment.displayLabel}`}
          />
        </PromptMentionTooltip>
      );
    case "skill":
      if (!segment.resolved) {
        return renderUnresolvedMentionText({
          key,
          prefix: "$",
          text: segment.displayLabel,
        });
      }
      return (
        <MarkdownOwnedLink
          key={key}
          className={FILE_LINK_CLASS}
          context={context}
          href={segment.path}
          title={segment.path}
        >
          <PromptMentionTooltip tooltipText={segment.detail ?? segment.path}>
            <MentionChip
              className={INLINE_MENTION_BASE_CLASS}
              iconSource={segment.iconSource}
              label={segment.displayLabel}
            />
          </PromptMentionTooltip>
        </MarkdownOwnedLink>
      );
    case "file": {
      const displayLabel = segment.locationSuffix ? `${segment.label}${segment.locationSuffix}` : segment.label;
      return (
        <MarkdownOwnedLink
          key={key}
          className={FILE_LINK_CLASS}
          context={context}
          href={segment.href}
          title={segment.href}
        >
          <PromptMentionTooltip tooltipText={segment.href}>
            <span className="inline-flex min-w-0 items-center gap-1 align-baseline">
              <WorkspaceFileIcon className="h-[0.95em] w-[0.95em] shrink-0 text-token-text-secondary" />
              <span className="min-w-0 break-words">{displayLabel}</span>
            </span>
          </PromptMentionTooltip>
        </MarkdownOwnedLink>
      );
    }
    case "url":
    case "unknown":
      return null;
  }
}

function renderUnresolvedMentionText({
  key,
  prefix,
  text,
}: {
  key: string;
  prefix: "@" | "$";
  text: string;
}) {
  return <Fragment key={key}>{`${prefix}${text}`}</Fragment>;
}

function PromptMentionTooltip({
  children,
  tooltipText,
}: {
  children: ReactNode;
  tooltipText: string;
}) {
  return (
    <Tooltip align="start" side="top" tooltipContent={tooltipText}>
      <span className="inline-flex min-w-0">{children}</span>
    </Tooltip>
  );
}

function MentionChip({
  className,
  iconSource,
  label,
  style,
}: {
  className?: string;
  iconSource?: string | null;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      {renderMentionChipIcon(iconSource)}
      <span className={INLINE_MENTION_TEXT_CLASS}>{label}</span>
    </span>
  );
}

function renderMentionChipIcon(iconSource: string | null | undefined) {
  const normalizedSource = normalizeMentionIconSource(iconSource ?? null);
  if (normalizedSource == null) {
    return null;
  }

  return (
    <span className={INLINE_MENTION_ICON_WRAPPER_CLASS}>
      <img
        alt=""
        aria-hidden
        className={INLINE_MENTION_ICON_CLASS}
        src={normalizedSource}
      />
    </span>
  );
}

function normalizeMentionIconSource(iconSource: string | null) {
  if (iconSource == null) {
    return null;
  }

  const trimmed = iconSource.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^(https?:|data:|blob:|file:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return `file:///${trimmed.replaceAll("\\", "/")}`;
  }

  if (trimmed.startsWith("\\\\")) {
    return `file:${trimmed.replaceAll("\\", "/")}`;
  }

  if (trimmed.startsWith("/")) {
    return `file://${trimmed}`;
  }

  return null;
}

function getMentionChipStyle(brandColor: string | null) {
  if (brandColor == null || brandColor.trim().length === 0) {
    return undefined;
  }

  return {
    ["--inline-mention-base-color" as string]: brandColor,
    ["--inline-mention-dark-base-color" as string]: `color-mix(in oklch, ${brandColor} 50%, var(--color-token-foreground, var(--app-shell-foreground)) 50%)`,
  } as CSSProperties;
}
