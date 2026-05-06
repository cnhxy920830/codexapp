import { useEffect, useRef } from "react";
import { applyAppearanceCssVariables, type AppearanceChromeTheme, type AppearanceVariant } from "../../services/appearanceThemes";

const BEFORE_PREVIEW_LINES = [
  'const themePreview: ThemeConfig = {',
  '  surface: "sidebar",',
  '  accent: "#2563eb",',
  "  contrast: 42,",
  "};",
];

const AFTER_PREVIEW_LINES = [
  'const themePreview: ThemeConfig = {',
  '  surface: "sidebar-elevated",',
  '  accent: "#0ea5e9",',
  "  contrast: 68,",
  "};",
];

export function ThemePreviewCard({
  theme,
  variant,
}: {
  theme: AppearanceChromeTheme;
  variant: AppearanceVariant;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }
    applyAppearanceCssVariables(rootRef.current, variant, theme);
  }, [theme, variant]);

  return (
    <div
      ref={rootRef}
      data-testid="theme-preview"
      className="overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-background-surface)] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      style={{
        colorScheme: variant,
        fontFamily: "var(--app-shell-ui-font-family)",
      }}
    >
      <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
        <PreviewPane lines={BEFORE_PREVIEW_LINES} tone="deleted" />
        <PreviewPane lines={AFTER_PREVIEW_LINES} tone="added" />
      </div>
    </div>
  );
}

function PreviewPane({
  lines,
  tone,
}: {
  lines: string[];
  tone: "added" | "deleted";
}) {
  return (
    <div className="min-w-0 bg-[var(--color-background-editor-opaque)] px-3 py-3">
      <div
        className="overflow-hidden rounded-[14px] border border-[var(--color-border-light)] bg-[var(--color-background-panel)]"
        style={{
          fontFamily: "var(--app-shell-code-font-family)",
        }}
      >
        {lines.map((line, index) => (
          <PreviewLine
            key={`${tone}:${index}:${line}`}
            lineNumber={index + 1}
            text={line}
            tone={index > 0 && index < lines.length - 1 ? tone : null}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewLine({
  lineNumber,
  text,
  tone,
}: {
  lineNumber: number;
  text: string;
  tone: "added" | "deleted" | null;
}) {
  const backgroundColor =
    tone === "added"
      ? "var(--color-editor-added)"
      : tone === "deleted"
        ? "var(--color-editor-deleted)"
        : "transparent";

  return (
    <div
      className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 px-3 py-1.5 text-[12px] leading-5"
      style={{
        backgroundColor,
      }}
    >
      <span className="text-right tabular-nums text-[var(--color-text-foreground-tertiary)]">{lineNumber}</span>
      <code className="min-w-0 overflow-x-auto whitespace-pre text-[var(--color-text-foreground)]">{text}</code>
    </div>
  );
}
