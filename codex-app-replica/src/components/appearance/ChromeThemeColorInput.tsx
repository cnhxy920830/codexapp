import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

type HsvaColor = {
  h: number;
  s: number;
  v: number;
};

export function ChromeThemeColorInput({
  ariaLabel,
  disabled,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerId = useIdValue(ariaLabel);
  const popoverId = `${triggerId}-popover`;
  const inputValue = draftValue ?? value;
  const inputColor = normalizeHexValue(inputValue) ?? value;
  const textColor = getReadableTextColor(inputColor);
  const hsva = useMemo(() => hexToHsva(inputColor), [inputColor]);

  useEffect(() => {
    setDraftValue(null);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
      setDraftValue(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setIsOpen(false);
      setDraftValue(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const commitColor = (nextValue: string) => {
    setDraftValue(null);
    onChange(nextValue);
  };

  return (
    <div className="relative w-full max-w-[8.5rem] max-sm:max-w-none" ref={containerRef}>
      <div
        className="relative flex h-7 w-full items-center gap-2 rounded-lg border border-transparent px-2 shadow-sm"
        style={{
          backgroundColor: value,
          color: textColor,
        }}
      >
        <button
          id={triggerId}
          type="button"
          aria-label={ariaLabel}
          aria-controls={isOpen ? popoverId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => {
            setIsOpen((open) => {
              if (open) {
                setDraftValue(null);
              }
              return !open;
            });
          }}
          className="h-3.5 w-3.5 shrink-0 rounded-full disabled:cursor-default"
          style={{
            backgroundColor: value,
            border: `1px solid color-mix(in srgb, ${textColor} 18%, ${value})`,
          }}
        >
          <span aria-hidden="true" className="sr-only" />
        </button>
        <input
          aria-label={ariaLabel}
          type="text"
          spellCheck={false}
          disabled={disabled}
          value={inputValue.toUpperCase()}
          onBlur={() => {
            setDraftValue(null);
          }}
          onChange={(event) => {
            const nextValue = sanitizeHexDraft(event.target.value);
            const normalized = normalizeHexValue(nextValue);
            if (normalized == null) {
              setDraftValue(nextValue);
              return;
            }
            setDraftValue(null);
            onChange(normalized);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          className="min-w-0 flex-1 bg-transparent text-xs uppercase tabular-nums outline-hidden disabled:cursor-default"
        />
      </div>
      {isOpen ? (
        <div
          id={popoverId}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-auto rounded-xl p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
        >
          <div
            className="h-34 w-34"
            onPointerDown={(event) => {
              event.preventDefault();
            }}
          >
            <SaturationPicker
              color={hsva}
              disabled={disabled}
              onChange={(patch) => commitColor(hsvaToHex({ ...hsva, ...patch }))}
            />
            <HueSlider
              color={hsva}
              disabled={disabled}
              onChange={(patch) => commitColor(hsvaToHex({ ...hsva, ...patch }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SaturationPicker({
  color,
  disabled,
  onChange,
}: {
  color: HsvaColor;
  disabled: boolean;
  onChange: (patch: Partial<HsvaColor>) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const background = `hsl(${color.h} 100% 50%)`;

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const relativeX = clamp01((clientX - rect.left) / rect.width);
    const relativeY = clamp01((clientY - rect.top) / rect.height);
    onChange({
      s: relativeX * 100,
      v: 100 - relativeY * 100,
    });
  };

  const startPointerTracking = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);

    const handlePointerMove = (nextEvent: PointerEvent) => {
      updateFromPointer(nextEvent.clientX, nextEvent.clientY);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const next = { ...color };
    if (event.key === "ArrowLeft") {
      next.s = Math.max(0, color.s - 5);
    } else if (event.key === "ArrowRight") {
      next.s = Math.min(100, color.s + 5);
    } else if (event.key === "ArrowUp") {
      next.v = Math.min(100, color.v + 5);
    } else if (event.key === "ArrowDown") {
      next.v = Math.max(0, color.v - 5);
    } else {
      return;
    }

    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      ref={surfaceRef}
      role="slider"
      aria-label="Color"
      aria-valuetext={`Saturation ${Math.round(color.s)}%, Brightness ${Math.round(color.v)}%`}
      className="react-colorful__saturation relative h-[136px] rounded-t-[8px] border-b-[12px] border-black"
      style={{
        backgroundColor: background,
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))]" />
      <div
        role="slider"
        aria-label="Color"
        aria-valuetext={`Saturation ${Math.round(color.s)}%, Brightness ${Math.round(color.v)}%`}
        tabIndex={disabled ? -1 : 0}
        className="react-colorful__interactive absolute inset-0 rounded-[inherit] outline-none [touch-action:none]"
        onPointerDown={startPointerTracking}
        onKeyDown={handleKeyDown}
      />
      <ColorPointer
        className="react-colorful__saturation-pointer"
        color={hsvaToHex(color)}
        left={color.s / 100}
        top={1 - color.v / 100}
      />
    </div>
  );
}

function HueSlider({
  color,
  disabled,
  onChange,
}: {
  color: HsvaColor;
  disabled: boolean;
  onChange: (patch: Partial<HsvaColor>) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const updateFromPointer = (clientX: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    onChange({
      h: clamp01((clientX - rect.left) / rect.width) * 360,
    });
  };

  const startPointerTracking = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    updateFromPointer(event.clientX);

    const handlePointerMove = (nextEvent: PointerEvent) => {
      updateFromPointer(nextEvent.clientX);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    let nextHue = color.h;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextHue = Math.max(0, color.h - 5);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextHue = Math.min(360, color.h + 5);
    } else {
      return;
    }

    event.preventDefault();
    onChange({ h: nextHue });
  };

  return (
    <div
      ref={surfaceRef}
      role="slider"
      aria-label="Hue"
      aria-valuenow={Math.round(color.h)}
      aria-valuemin={0}
      aria-valuemax={360}
      className="react-colorful__hue react-colorful__last-control relative h-6 rounded-b-[8px] bg-[linear-gradient(90deg,red_0,#ff0_17%,#0f0_33%,#0ff_50%,#00f_67%,#f0f_83%,red)]"
    >
      <div
        role="slider"
        aria-label="Hue"
        aria-valuenow={Math.round(color.h)}
        aria-valuemin={0}
        aria-valuemax={360}
        tabIndex={disabled ? -1 : 0}
        className="react-colorful__interactive absolute inset-0 rounded-[inherit] outline-none [touch-action:none]"
        onPointerDown={startPointerTracking}
        onKeyDown={handleKeyDown}
      />
      <ColorPointer
        className="react-colorful__hue-pointer"
        color={hslToHex(color.h, 100, 50)}
        left={color.h / 360}
        top={0.5}
      />
    </div>
  );
}

function ColorPointer({
  className,
  color,
  left,
  top,
}: {
  className: string;
  color: string;
  left: number;
  top: number;
}) {
  return (
    <div
      className={`react-colorful__pointer absolute z-[1] box-border h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${className}`}
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
      }}
    >
      <div
        className="react-colorful__pointer-fill absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function sanitizeHexDraft(value: string) {
  const trimmed = value.toUpperCase().replace(/[^0-9A-F#]/g, "").replaceAll("#", "");
  return trimmed.length === 0 ? "#" : `#${trimmed.slice(0, 6)}`;
}

function normalizeHexValue(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function getReadableTextColor(value: string) {
  const normalized = normalizeHexValue(value);
  if (!normalized) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255 > 0.62 ? "#101010" : "#ffffff";
}

function hexToHsva(value: string): HsvaColor {
  const normalized = normalizeHexValue(value) ?? "#000000";
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return {
    h: ((hue * 60) + 360) % 360,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

function hsvaToHex(value: HsvaColor) {
  const hue = value.h / 60;
  const saturation = value.s / 100;
  const brightness = value.v / 100;
  const chroma = brightness * saturation;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = brightness - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue >= 0 && hue < 1) {
    red = chroma;
    green = x;
  } else if (hue < 2) {
    red = x;
    green = chroma;
  } else if (hue < 3) {
    green = chroma;
    blue = x;
  } else if (hue < 4) {
    green = x;
    blue = chroma;
  } else if (hue < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexChannel((red + match) * 255)}${toHexChannel((green + match) * 255)}${toHexChannel((blue + match) * 255)}`;
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = h / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = lightness - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue >= 0 && hue < 1) {
    red = chroma;
    green = x;
  } else if (hue < 2) {
    red = x;
    green = chroma;
  } else if (hue < 3) {
    green = chroma;
    blue = x;
  } else if (hue < 4) {
    green = x;
    blue = chroma;
  } else if (hue < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexChannel((red + match) * 255)}${toHexChannel((green + match) * 255)}${toHexChannel((blue + match) * 255)}`;
}

function toHexChannel(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function useIdValue(value: string) {
  return useMemo(
    () =>
      `chrome-theme-color-${value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`,
    [value],
  );
}
