import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCodeThemeOptions,
  loadCodeThemePreview,
  resolveCodeThemeOption,
  type AppearanceChromeTheme,
  type AppearanceCodeThemeId,
  type AppearanceVariant,
} from "../../services/appearanceThemes";
import { useI18n } from "../../i18n/i18n";
import { CheckIcon, ChevronDownIcon } from "../AppShellIcons";

type ThemePreview = {
  accent: string;
  ink: string;
  surface: string;
};

export function CodeThemePicker({
  ariaLabel,
  disabled,
  theme,
  value,
  variant,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  theme: AppearanceChromeTheme;
  value: AppearanceCodeThemeId;
  variant: AppearanceVariant;
  onChange: (value: AppearanceCodeThemeId) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [previews, setPreviews] = useState<Record<string, ThemePreview>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getCodeThemeOptions(variant), [variant]);
  const selectedOption = useMemo(() => resolveCodeThemeOption(value, variant), [value, variant]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    void Promise.all(
      options.map(async (option) => ({
        id: option.id,
        preview: await loadCodeThemePreview(option.id, variant),
      })),
    )
      .then((nextPreviews) => {
        if (cancelled) {
          return;
        }
        setPreviews((current) => {
          const merged = { ...current };
          for (const item of nextPreviews) {
            merged[item.id] = item.preview;
          }
          return merged;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isOpen, options, variant]);

  const selectedPreview = previews[selectedOption?.id ?? ""] ?? {
    accent: theme.accent,
    ink: theme.ink,
    surface: theme.surface,
  };

  return (
    <div className="relative w-[11rem] max-w-full" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex h-9 w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-0 shadow-sm max-sm:w-full"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CodeThemeSwatch preview={selectedPreview} />
          <span className="sr-only">{t("settings.general.appearance.codeTheme.previewGlyph")}</span>
          <span className="truncate text-[13px] leading-none">{selectedOption?.label ?? value}</span>
        </div>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[280px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto pb-1">
            {options.map((option) => {
              const preview = previews[option.id] ?? selectedPreview;
              const isSelected = option.id === selectedOption?.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setIsOpen(false);
                    onChange(option.id);
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <CodeThemeSwatch preview={preview} />
                  <span className="truncate text-[13px]">{option.label}</span>
                  {isSelected ? <CheckIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CodeThemeSwatch({ preview }: { preview: ThemePreview }) {
  const { t } = useI18n();
  const borderColor = `color-mix(in srgb, ${preview.ink} 16%, ${preview.surface})`;
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] leading-none font-semibold"
      style={{
        backgroundColor: preview.surface,
        borderColor,
        color: preview.accent,
      }}
    >
      {t("settings.general.appearance.codeTheme.previewGlyph")}
    </span>
  );
}
