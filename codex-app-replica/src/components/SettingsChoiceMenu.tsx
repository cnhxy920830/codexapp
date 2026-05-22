import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "./AppShellIcons";

type SettingsChoiceMenuOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  title?: string;
  warning?: string;
  warningIcon?: ReactNode;
};

type SettingsChoiceMenuSection = {
  label: string;
  options: SettingsChoiceMenuOption[];
};

export function SettingsChoiceMenu({
  className,
  disabled,
  menuClassName,
  onChange,
  options,
  sections,
  triggerLabel,
  value,
}: {
  className?: string;
  disabled: boolean;
  menuClassName?: string;
  onChange: (value: string) => void;
  options: SettingsChoiceMenuOption[];
  sections?: SettingsChoiceMenuSection[];
  triggerLabel?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusFirstItemRef = useRef(false);
  const menuId = useId();
  const menuSections = useMemo<Array<{ label: string | null; options: SettingsChoiceMenuOption[] }>>(() => {
    if (sections == null || sections.length === 0) {
      return [{ label: null, options }];
    }

    return sections
      .filter((section) => section.options.length > 0)
      .map((section) => ({
        label: section.label,
        options: section.options,
      }));
  }, [options, sections]);

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
    focusEnabledMenuItem(0, 1);
  }, [isOpen, menuSections]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const closeMenu = (options?: { restoreFocus?: boolean }) => {
    shouldFocusFirstItemRef.current = false;
    setIsOpen(false);
    if (options?.restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const focusEnabledMenuItem = (startIndex: number, direction: 1 | -1) => {
    for (
      let index = startIndex;
      index >= 0 && index < menuItemRefs.current.length;
      index += direction
    ) {
      const nextItem = menuItemRefs.current[index];
      if (nextItem == null || nextItem.disabled) {
        continue;
      }

      nextItem.focus();
      return;
    }
  };

  const handleMenuItemKeyDown = (
    index: number,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEnabledMenuItem(index + 1, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusEnabledMenuItem(index - 1, -1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusEnabledMenuItem(0, 1);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusEnabledMenuItem(menuItemRefs.current.length - 1, -1);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  };

  menuItemRefs.current = [];

  return (
    <div className={joinClasses("relative w-[280px] max-w-full", className)} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-state={isOpen ? "open" : "closed"}
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
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="truncate text-left">
          {triggerLabel ?? selectedOption?.label ?? value}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div
          className={joinClasses(
            "app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
            menuClassName,
          )}
        >
          <div
            id={menuId}
            aria-orientation="vertical"
            className="max-h-80 overflow-y-auto"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
              }
            }}
            role="menu"
          >
            {menuSections.map((section, sectionIndex) => {
              const baseIndex = menuSections
                .slice(0, sectionIndex)
                .reduce((count, currentSection) => count + currentSection.options.length, 0);

              return (
                <div key={section.label ?? `section-${sectionIndex}`}>
                  {section.label ? (
                    <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
                      {section.label}
                    </div>
                  ) : null}
                  {section.options.map((option, optionOffset) => {
                    const optionIndex = baseIndex + optionOffset;
                    const isSelected = option.value === value;
                    const isOptionDisabled = disabled || option.disabled === true;
                    return (
                      <button
                        key={option.value}
                        ref={(node) => {
                          menuItemRefs.current[optionIndex] = node;
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        disabled={isOptionDisabled}
                        onClick={() => {
                          if (isOptionDisabled) {
                            return;
                          }
                          closeMenu({ restoreFocus: true });
                          onChange(option.value);
                        }}
                        onKeyDown={(event) => handleMenuItemKeyDown(optionIndex, event)}
                        onMouseMove={(event) => {
                          event.currentTarget.focus({ preventScroll: true });
                        }}
                        title={option.title}
                        className={[
                          "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
                          isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                        ].join(" ")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px]">{option.label}</span>
                          {option.description ? (
                            <span className="app-text-muted mt-1 block text-[12px] leading-5">{option.description}</span>
                          ) : null}
                          {option.warning ? (
                            <span className="mt-0.5 flex min-w-0 items-start gap-1 text-sm leading-4 text-token-description-foreground">
                              {option.warningIcon}
                              <span className="min-w-0 whitespace-normal">{option.warning}</span>
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                      </button>
                    );
                  })}
                  {sectionIndex < menuSections.length - 1 ? (
                    <div className="my-2 h-px bg-token-border" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
