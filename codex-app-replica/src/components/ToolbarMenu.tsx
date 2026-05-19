import { useEffect, useRef, useState, type ReactNode } from "react";

export type ToolbarMenuItem = {
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
  title?: string;
};

export function ToolbarMenu({
  children,
  items,
}: {
  children: (args: { open: boolean; toggle: () => void }) => ReactNode;
  items: ToolbarMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      {children({
        open,
        toggle: () => setOpen((current) => !current),
      })}

      {open ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {items.map((item) => (
            <MenuButton
              key={item.key}
              disabled={item.disabled}
              icon={item.icon}
              label={item.label}
              title={item.title}
              onSelect={() => {
                if (item.disabled) {
                  return;
                }
                setOpen(false);
                item.onSelect();
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  disabled = false,
  icon,
  label,
  onSelect,
  title,
}: {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      title={title}
      className={[
        "flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60",
        disabled ? "" : "app-nav-item-idle",
      ].join(" ")}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
