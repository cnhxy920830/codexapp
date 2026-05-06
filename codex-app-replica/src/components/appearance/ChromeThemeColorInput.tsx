import { useEffect, useRef, useState } from "react";

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
  const [draftValue, setDraftValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputColor = normalizeHexValue(draftValue) ?? value;
  const textColor = getReadableTextColor(inputColor);

  useEffect(() => {
    setDraftValue(value);
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
      setDraftValue(value);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, value]);

  return (
    <div className="relative w-full max-w-[8.5rem]" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-7 w-full items-center gap-2 rounded-[10px] border border-transparent px-2 shadow-sm"
        style={{
          backgroundColor: value,
          color: textColor,
        }}
      >
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 rounded-full border"
          style={{
            backgroundColor: value,
            border: `1px solid color-mix(in srgb, ${textColor} 18%, ${value})`,
          }}
        />
        <span className="min-w-0 flex-1 truncate text-left text-[12px] uppercase tabular-nums">{value.toUpperCase()}</span>
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[200px] rounded-[14px] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="space-y-3">
            <input
              aria-label={ariaLabel}
              type="color"
              disabled={disabled}
              value={inputColor}
              onChange={(event) => {
                setDraftValue(event.target.value);
                onChange(event.target.value);
              }}
              className="h-[136px] w-full cursor-pointer rounded-[12px] border-0 bg-transparent p-0"
            />
            <input
              aria-label={ariaLabel}
              type="text"
              spellCheck={false}
              disabled={disabled}
              value={draftValue.toUpperCase()}
              onChange={(event) => {
                const nextValue = sanitizeHexDraft(event.target.value);
                setDraftValue(nextValue);
                const normalized = normalizeHexValue(nextValue);
                if (normalized) {
                  onChange(normalized);
                }
              }}
              className="app-control h-9 w-full rounded-[10px] px-3 font-mono text-[13px] uppercase"
            />
          </div>
        </div>
      ) : null}
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
