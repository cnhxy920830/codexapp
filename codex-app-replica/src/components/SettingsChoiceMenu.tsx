import { useEffect, useMemo, useRef, useState } from "react";

type SettingsChoiceMenuOption = {
  value: string;
  label: string;
  description?: string;
};

export function SettingsChoiceMenu({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  options: SettingsChoiceMenuOption[];
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
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="truncate text-left">{selectedOption?.label ?? value}</span>
        <span className="app-text-muted shrink-0">▾</span>
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setIsOpen(false);
                    onChange(option.value);
                  }}
                  className={[
                    "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">{option.label}</span>
                    {option.description ? (
                      <span className="app-text-muted mt-1 block text-[12px] leading-5">{option.description}</span>
                    ) : null}
                  </span>
                  {isSelected ? <span className="shrink-0 text-[13px]">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
