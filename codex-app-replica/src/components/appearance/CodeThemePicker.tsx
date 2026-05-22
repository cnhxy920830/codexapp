import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusFirstItemRef = useRef(false);
  const options = useMemo(() => getCodeThemeOptions(variant), [variant]);
  const selectedOption = useMemo(() => resolveCodeThemeOption(value, variant), [value, variant]);
  const menuId = `code-theme-picker-menu-${variant}`;

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
    const handleFocusIn = (event: FocusEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldFocusFirstItemRef.current) {
      return;
    }

    shouldFocusFirstItemRef.current = false;
    menuItemRefs.current[0]?.focus();
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

  const closeMenu = () => {
    shouldFocusFirstItemRef.current = false;
    setIsOpen(false);
  };

  const focusMenuItem = (index: number) => {
    menuItemRefs.current[index]?.focus();
  };

  const handleMenuItemKeyDown = (index: number, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(Math.min(index + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(options.length - 1);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="relative w-[11rem] max-w-full" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          shouldFocusFirstItemRef.current = false;
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          triggerRef.current = event.currentTarget;
          if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          shouldFocusFirstItemRef.current = true;
          setIsOpen(true);
        }}
        className="flex h-9 w-[11rem] max-w-full items-center justify-between gap-2 rounded-lg border border-token-border bg-token-bg-primary px-2.5 py-0 shadow-sm max-sm:w-full"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CodeThemeSwatch preview={selectedPreview} />
          <span className="truncate text-sm leading-none">{selectedOption?.label ?? value}</span>
        </div>
        <ChevronDownIcon className="icon-xs shrink-0 opacity-65" />
      </button>
      {isOpen ? (
        <div
          aria-orientation="vertical"
          className="no-drag absolute right-0 top-[calc(100%+1px)] z-50 m-px flex min-w-[220px] select-none flex-col overflow-y-auto rounded-xl bg-token-dropdown-background/90 px-1 py-1 text-token-foreground ring-token-border shadow-xl-spread ring-[0.5px] backdrop-blur-sm"
          id={menuId}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
            }
          }}
          role="menu"
        >
          <div className="max-h-80 overflow-y-auto pb-1">
            {options.map((option, index) => {
              const preview = previews[option.id] ?? selectedPreview;
              const isSelected = option.id === selectedOption?.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  ref={(node) => {
                    menuItemRefs.current[index] = node;
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  disabled={disabled}
                  onClick={() => {
                    closeMenu();
                    onChange(option.id);
                  }}
                  onKeyDown={(event) => handleMenuItemKeyDown(index, event)}
                  onMouseMove={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                  className={[
                    "no-drag flex w-full cursor-interaction items-center gap-2 rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-left text-sm text-token-foreground outline-hidden hover:bg-token-list-hover-background focus:bg-token-list-hover-background",
                    isSelected ? "font-medium" : "",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CodeThemeSwatch preview={preview} />
                    <span className="truncate">{option.label}</span>
                  </div>
                  {isSelected ? <CheckIcon className="ml-auto h-3.5 w-3.5 shrink-0" /> : null}
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
