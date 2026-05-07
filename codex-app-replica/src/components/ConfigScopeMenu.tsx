import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./AppShellIcons";

type ConfigScopeMenuOption = {
  group: "global" | "project";
  key: string;
  label: string;
  title?: string | null;
};

export function ConfigScopeMenu({
  disabled,
  globalGroupLabel,
  loadingLabel,
  onSelect,
  options,
  projectGroupLabel,
  selectedKey,
}: {
  disabled?: boolean;
  globalGroupLabel: string;
  loadingLabel: string;
  onSelect: (key: string) => void;
  options: ConfigScopeMenuOption[];
  projectGroupLabel: string;
  selectedKey: string | null;
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
    () => options.find((option) => option.key === selectedKey) ?? null,
    [options, selectedKey],
  );
  const projectOptions = useMemo(
    () => options.filter((option) => option.group === "project"),
    [options],
  );
  const globalOptions = useMemo(
    () => options.filter((option) => option.group === "global"),
    [options],
  );
  const isDisabled = disabled || options.length === 0;

  const renderOption = (option: ConfigScopeMenuOption) => {
    const isSelected = option.key === selectedKey;
    return (
      <button
        key={option.key}
        type="button"
        title={option.title ?? undefined}
        onClick={() => {
          setIsOpen(false);
          onSelect(option.key);
        }}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
          isSelected ? "app-nav-item-active" : "app-nav-item-idle",
        ].join(" ")}
      >
        <span className="truncate">{option.label}</span>
        {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
      </button>
    );
  };

  return (
    <div className="relative w-[220px] max-w-full" ref={containerRef}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="truncate text-left">{selectedOption?.label ?? loadingLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            {projectOptions.length > 0 ? (
              <>
                <div className="px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-shell-subtle)]">
                  {projectGroupLabel}
                </div>
                <div className="mt-1 space-y-1">{projectOptions.map(renderOption)}</div>
                <div className="my-2 h-px bg-[var(--app-shell-border)]" />
              </>
            ) : null}
            <div className="px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-shell-subtle)]">
              {globalGroupLabel}
            </div>
            <div className="mt-1 space-y-1">{globalOptions.map(renderOption)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
