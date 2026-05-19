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

export function Tooltip({
  align = "center",
  children,
  disabled = false,
  side = "top",
  sideOffset = 2,
  tooltipBodyClassName,
  tooltipContent,
  tooltipMaxWidth = 300,
}: {
  align?: TooltipAlign;
  children: ReactElement;
  disabled?: boolean;
  side?: TooltipSide;
  sideOffset?: number;
  tooltipBodyClassName?: string;
  tooltipContent: ReactNode;
  tooltipMaxWidth?: number;
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

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
        onBlur={() => {
          setIsOpen(false);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        onPointerEnter={() => {
          setIsOpen(true);
        }}
        onPointerLeave={() => {
          setIsOpen(false);
        }}
      >
        {describedChild}
      </span>
      {isOpen && position != null && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="bg-token-dropdown-background text-token-foreground border-token-border fixed z-50 w-fit select-none rounded-lg border px-2 py-1 text-sm whitespace-normal break-words"
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
