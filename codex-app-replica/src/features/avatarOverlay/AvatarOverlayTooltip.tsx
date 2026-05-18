import { cloneElement, useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

type AvatarOverlayTooltipAlign = "start" | "center" | "end";
type AvatarOverlayTooltipSide = "top" | "bottom";

type AvatarOverlayTooltipProps = {
  align?: AvatarOverlayTooltipAlign;
  children: ReactElement;
  content: string;
  maxWidth?: number | string;
  side?: AvatarOverlayTooltipSide;
  sideOffset?: number;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_VIEWPORT_PADDING_PX = 8;

export function AvatarOverlayTooltip({
  align = "center",
  children,
  content,
  maxWidth,
  side = "top",
  sideOffset = 2,
}: AvatarOverlayTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || typeof window === "undefined") {
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

      left = clampPosition(
        left,
        TOOLTIP_VIEWPORT_PADDING_PX,
        window.innerWidth - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING_PX,
      );
      top = clampPosition(
        top,
        TOOLTIP_VIEWPORT_PADDING_PX,
        window.innerHeight - tooltipRect.height - TOOLTIP_VIEWPORT_PADDING_PX,
      );

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
  }, [align, isOpen, side, sideOffset]);

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
        className="inline-flex"
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
              className="bg-token-dropdown-background text-token-foreground border-token-border fixed z-50 w-fit max-w-[min(20rem,calc(100vw-16px))] select-none rounded-lg border px-2 py-1 text-sm whitespace-normal break-words"
              style={{
                left: `${position.left}px`,
                maxWidth,
                top: `${position.top}px`,
              }}
            >
              <div className="min-w-0">{content}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function clampPosition(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}
