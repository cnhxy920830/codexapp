import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Tooltip } from "../../components/Tooltip";
import { MarkdownOwnedLink, type MarkdownLinkContext } from "../../components/markdownPreviewLinks";
import { I18N_CONTEXT } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type { AppInfo } from "../../services/apps";
import type { PluginSummary } from "../../services/plugins";
import type { SkillSummary } from "../../services/skills";
import {
  type ScratchpadPromptSegment,
  parseScratchpadPromptSegments,
} from "./scratchpadPromptLinks";

type ScratchpadPromptContentProps = {
  hostId?: string | null;
  text: string;
  apps?: AppInfo[];
  plugins?: PluginSummary[];
  skills?: SkillSummary[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

const INLINE_MENTION_BASE_CLASS =
  "group/inline-mention inline-mention-brand-aware inline cursor-pointer px-0.5 align-baseline font-medium whitespace-normal text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)]";
const INLINE_MENTION_ICON_WRAPPER_CLASS = "relative mr-1 inline-block h-[1lh] w-4 align-bottom";
const INLINE_MENTION_ICON_CLASS = "icon-xs absolute top-1/2 -translate-y-1/2 rounded-[2px] object-cover";
const INLINE_MENTION_TEXT_CLASS = "min-w-0 break-words";
const FILE_LINK_CLASS = "inline appearance-none border-0 bg-transparent p-0 text-left align-baseline whitespace-normal";

export function ScratchpadPromptContent({
  hostId = null,
  text,
  apps = [],
  plugins = [],
  skills = [],
  t,
}: ScratchpadPromptContentProps) {
  const parts = parseScratchpadPromptSegments(text, {
    apps,
    plugins,
    skills,
  });
  const linkContext = buildMarkdownLinkContext(hostId);
  const i18nValue = buildScratchpadI18nValue(t);

  return (
    <I18N_CONTEXT.Provider value={i18nValue}>
      <span className="min-w-0 whitespace-pre-wrap break-words text-base text-token-foreground">
        {parts.map((part, index) => renderPromptPart(part, index, linkContext))}
      </span>
    </I18N_CONTEXT.Provider>
  );
}

function renderPromptPart(
  part: ScratchpadPromptSegment,
  index: number,
  linkContext: MarkdownLinkContext,
): ReactNode {
  if (part.type === "text") {
    return <span key={`text-${index}`}>{part.value}</span>;
  }

  switch (part.type) {
    case "app":
      if (!part.resolved) {
        return <Fragment key={`link-${index}`}>{`$${part.displayLabel}`}</Fragment>;
      }

      return (
        <InlineMention
          key={`link-${index}`}
          label={part.displayLabel}
          iconSource={part.iconSource}
          title={part.href}
        />
      );
    case "plugin":
      if (!part.resolved) {
        return <Fragment key={`link-${index}`}>{`@${part.displayLabel}`}</Fragment>;
      }

      return (
        <InlineMention
          key={`link-${index}`}
          label={part.displayLabel}
          iconSource={part.iconSource}
          style={getInlineMentionStyle(part.brandColor)}
          title={part.href}
        />
      );
    case "agent": {
      const textLabel = `@${part.displayLabel}`;
      return (
        <Tooltip key={`link-${index}`} align="start" side="top" tooltipContent={part.href}>
          <span className={`${INLINE_MENTION_BASE_CLASS} cursor-default`} title={part.href}>
            <span className={INLINE_MENTION_TEXT_CLASS}>{textLabel}</span>
          </span>
        </Tooltip>
      );
    }
    case "skill":
      if (!part.resolved) {
        return <Fragment key={`link-${index}`}>{`$${part.displayLabel}`}</Fragment>;
      }

      return (
        <MarkdownOwnedLink
          key={`link-${index}`}
          className={FILE_LINK_CLASS}
          context={linkContext}
          href={part.href}
          title={part.href}
        >
          <InlineMentionContent iconSource={part.iconSource} label={part.displayLabel} />
        </MarkdownOwnedLink>
      );
    case "file": {
      const displayLabel = part.locationSuffix ? `${part.label}${part.locationSuffix}` : part.label;
      return (
        <MarkdownOwnedLink
          key={`link-${index}`}
          className={FILE_LINK_CLASS}
          context={linkContext}
          href={part.href}
          title={part.href}
        >
          {displayLabel}
        </MarkdownOwnedLink>
      );
    }
    case "url":
    case "unknown":
      return <Fragment key={`link-${index}`}>{part.raw}</Fragment>;
  }
}

function InlineMention({
  iconSource,
  label,
  style,
  title,
}: {
  iconSource: string | null;
  label: string;
  style?: CSSProperties;
  title: string;
}) {
  return (
    <Tooltip align="start" side="top" tooltipContent={title}>
      <span className={INLINE_MENTION_BASE_CLASS} style={style} title={title}>
        <InlineMentionContent iconSource={iconSource} label={label} />
      </span>
    </Tooltip>
  );
}

function InlineMentionContent({
  iconSource,
  label,
}: {
  iconSource: string | null;
  label: string;
}) {
  const normalizedIconSource = normalizeMentionIconSource(iconSource);

  return (
    <>
      {normalizedIconSource ? (
        <span className={INLINE_MENTION_ICON_WRAPPER_CLASS}>
          <img alt="" aria-hidden className={INLINE_MENTION_ICON_CLASS} src={normalizedIconSource} />
        </span>
      ) : null}
      <span className={INLINE_MENTION_TEXT_CLASS}>{label}</span>
    </>
  );
}

function buildMarkdownLinkContext(hostId: string | null): MarkdownLinkContext {
  return {
    cwd: null,
    hostId,
    canFileLinkOpenInSidePanel: null,
    onExternalLinkOpenInBrowser: null,
    onFileLinkOpen: null,
    onFileLinkOpenInBrowser: null,
  };
}

function buildScratchpadI18nValue(t: ScratchpadPromptContentProps["t"]) {
  return {
    locale: "en-US" as const,
    setLocale: () => {},
    t,
  };
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

function getInlineMentionStyle(brandColor: string | null) {
  if (brandColor == null || brandColor.trim().length === 0) {
    return undefined;
  }

  return {
    ["--inline-mention-base-color" as string]: brandColor,
    ["--inline-mention-dark-base-color" as string]: `color-mix(in oklch, ${brandColor} 50%, var(--color-token-foreground, var(--app-shell-foreground)) 50%)`,
  } as CSSProperties;
}
