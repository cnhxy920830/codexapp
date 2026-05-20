import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

export function SettingsChoiceMenu({
  className,
  disabled,
  menuClassName,
  onChange,
  options,
  triggerLabel,
  value,
}: {
  className?: string;
  disabled: boolean;
  menuClassName?: string;
  onChange: (value: string) => void;
  options: SettingsChoiceMenuOption[];
  triggerLabel?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <div className={joinClasses("relative w-[280px] max-w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
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
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const isOptionDisabled = disabled || option.disabled === true;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isOptionDisabled}
                  onClick={() => {
                    if (isOptionDisabled) {
                      return;
                    }
                    setIsOpen(false);
                    onChange(option.value);
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
          </div>
        </div>
      ) : null}
    </div>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
