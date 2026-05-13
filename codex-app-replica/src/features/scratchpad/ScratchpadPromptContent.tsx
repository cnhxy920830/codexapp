import type { ReactNode } from "react";
import type { AppInfo } from "../../services/apps";
import { openFile, openInBrowser } from "../../services/hostFiles";
import type { SkillSummary } from "../../services/skills";
import {
  type ScratchpadPromptSegment,
  parseScratchpadPromptSegments,
} from "./scratchpadPromptLinks";

type ScratchpadPromptContentProps = {
  hostId?: string | null;
  text: string;
  apps?: AppInfo[];
  skills?: SkillSummary[];
};

export function ScratchpadPromptContent({
  hostId = null,
  text,
  apps = [],
  skills = [],
}: ScratchpadPromptContentProps) {
  const parts = parseScratchpadPromptSegments(text, {
    apps,
    skills,
  });
  return (
    <span className="min-w-0 whitespace-pre-wrap break-words text-base text-token-foreground">
      {parts.map((part, index) => renderPromptPart(part, hostId, index))}
    </span>
  );
}

function renderPromptPart(part: ScratchpadPromptSegment, hostId: string | null, index: number): ReactNode {
  if (part.type === "text") {
    return <span key={`text-${index}`}>{part.value}</span>;
  }

  switch (part.type) {
    case "skill":
      return (
        <button
          key={`link-${index}`}
          type="button"
          className="inline-flex max-w-full cursor-interaction items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 text-left align-baseline text-[0.95em] leading-[1.35] text-token-foreground hover:border-token-text-secondary"
          onClick={(event) => {
            event.stopPropagation();
            void openFile({
              hostId,
              path: part.path,
            }).catch(() => undefined);
          }}
          title={part.detail ?? part.path}
        >
          <span className="shrink-0 text-[0.8em] text-token-text-secondary">$</span>
          <span className="min-w-0 truncate">{part.displayLabel}</span>
        </button>
      );
    case "app":
    case "plugin":
      return (
        <span
          key={`link-${index}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-token-border bg-token-bg-tertiary px-2 py-0.5 text-[0.95em] leading-[1.35] text-token-foreground"
          title={part.detail ?? part.href}
        >
          <span className="shrink-0 text-[0.8em] text-token-text-secondary">@</span>
          <span className="min-w-0 truncate">{part.displayLabel}</span>
        </span>
      );
    case "url":
      return (
        <button
          key={`link-${index}`}
          type="button"
          className="inline cursor-interaction bg-transparent p-0 text-left align-baseline text-[var(--app-shell-accent)] underline underline-offset-2"
          onClick={(event) => {
            event.stopPropagation();
            void openInBrowser(part.url).catch(() => undefined);
          }}
          title={part.url}
        >
          {part.label}
        </button>
      );
    case "file": {
      const displayLabel = part.locationSuffix ? `${part.label}${part.locationSuffix}` : part.label;
      return (
        <button
          key={`link-${index}`}
          type="button"
          className="inline cursor-interaction bg-transparent p-0 text-left align-baseline text-[var(--app-shell-accent)] underline underline-offset-2"
          onClick={(event) => {
            event.stopPropagation();
            void openFile({
              hostId,
              path: part.path,
              line: part.line,
              column: part.column,
            }).catch(() => undefined);
          }}
          title={part.href}
        >
          {displayLabel}
        </button>
      );
    }
    case "unknown":
      return (
        <span key={`link-${index}`} className="text-token-foreground">
          {part.raw}
        </span>
      );
  }
}
