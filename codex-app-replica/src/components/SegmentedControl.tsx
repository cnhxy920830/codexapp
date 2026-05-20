import type { ReactNode } from "react";
import { Button } from "./Button";

export function SegmentedControl({
  ariaLabel,
  ariaLabelledBy,
  className,
  onSelect,
  options = [],
  selectedId,
  selectedColor = "secondary",
  size = "default",
  uniform,
  unselectedColor = "ghost",
}: {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  onSelect: (id: string) => void;
  options?: Array<{
    ariaLabel?: string;
    disabled?: boolean;
    id: string;
    label: ReactNode;
    tooltipContent?: ReactNode;
  }>;
  selectedColor?: "secondary" | "ghost" | "ghostActive" | "outline" | "outlineActive" | "primary";
  selectedId: string;
  size?: "default" | "icon" | "toolbar";
  uniform?: boolean;
  unselectedColor?: "ghost" | "ghostActive" | "outline" | "outlineActive" | "primary" | "secondary";
}) {
  const shouldUseUniform = uniform ?? (size === "icon" && options.length > 2);

  return (
    <div
      className={joinClasses("inline-flex items-center gap-0.5", className)}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => {
        const selected = option.id === selectedId;
        const disabled = option.disabled ?? false;

        return (
          <Button
            key={option.id}
            color={selected ? selectedColor : unselectedColor}
            size={size}
            uniform={shouldUseUniform}
            aria-pressed={selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onSelect(option.id);
              }
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
