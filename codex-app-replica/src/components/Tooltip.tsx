import {
  cloneElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipAlign = "start" | "center" | "end";
type TooltipSide = "top" | "bottom";
type TooltipKeycapVariant = "default" | "button";

export function TooltipKeycap({
  className,
  keysLabel,
  variant = "default",
}: {
  className?: string;
  keysLabel: string;
  variant?: TooltipKeycapVariant;
}) {
  const variantClass =
    variant === "button"
      ? "h-4 min-w-4 items-center justify-center !px-1.5 !py-0 !leading-4"
      : "!px-1.5 !py-0.5 !leading-none";

  return (
    <kbd
      className={joinClasses(
        "inline-flex !rounded-md !border-0 !bg-current/10 !font-sans !text-xs !text-current !shadow-none",
        variantClass,
        className,
      )}
    >
      {keysLabel}
    </kbd>
  );
}

export function Tooltip({
  align = "center",
  children,
  delayDuration = 0,
  disabled = false,
  side = "top",
  sideOffset = 2,
  tooltipClassName,
  tooltipBodyClassName,
  tooltipContent,
  tooltipMaxWidth = 300,
}: {
  align?: TooltipAlign;
  children: ReactElement;
  delayDuration?: number;
  disabled?: boolean;
  side?: TooltipSide;
  sideOffset?: number;
  tooltipClassName?: string;
  tooltipBodyClassName?: string;
  tooltipContent: ReactNode;
  tooltipMaxWidth?: number;
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openTimeoutRef = useRef<number | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    return () => {
      if (openTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (disabled || !isOpen || typeof window === "undefined") {
      return undefined;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (trigger == null || tooltip == null) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      if (align === "start") {
        left = triggerRect.left;
      } else if (align === "end") {
        left = triggerRect.right - tooltipRect.width;
      }

      let top =
        side === "top"
          ? triggerRect.top - tooltipRect.height - sideOffset
          : triggerRect.bottom + sideOffset;

      left = clampTooltipPosition(left, 8, window.innerWidth - tooltipRect.width - 8);
      top = clampTooltipPosition(top, 8, window.innerHeight - tooltipRect.height - 8);

      setPosition((current) =>
        current != null && current.left === left && current.top === top
          ? current
          : {
              left,
              top,
            },
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, disabled, isOpen, side, sideOffset]);

  if (disabled) {
    return children;
  }

  const clearScheduledOpen = () => {
    if (openTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  };

  const openTooltip = () => {
    clearScheduledOpen();
    if (delayDuration <= 0 || typeof window === "undefined") {
      setIsOpen(true);
      return;
    }

    openTimeoutRef.current = window.setTimeout(() => {
      openTimeoutRef.current = null;
      setIsOpen(true);
    }, delayDuration);
  };

  const closeTooltip = () => {
    clearScheduledOpen();
    setIsOpen(false);
  };

  const describedChild = cloneElement(
    children as ReactElement<{ "aria-describedby"?: string }>,
    {
      "aria-describedby": isOpen ? tooltipId : undefined,
    },
  );

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex min-w-0"
        onBlur={closeTooltip}
        onFocus={openTooltip}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeTooltip();
          }
        }}
        onPointerEnter={openTooltip}
        onPointerLeave={closeTooltip}
      >
        {describedChild}
      </span>
      {isOpen && position != null && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={joinClasses(
                "bg-token-dropdown-background text-token-foreground border-token-border fixed z-50 w-fit select-none rounded-lg border px-2 py-1 text-sm whitespace-normal break-words",
                tooltipClassName,
              )}
              style={{
                left: `${position.left}px`,
                maxWidth: `${tooltipMaxWidth}px`,
                top: `${position.top}px`,
              }}
            >
              <div className={tooltipBodyClassName ?? "min-w-0 text-center"}>{tooltipContent}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function clampTooltipPosition(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
