import { useMemo, type CSSProperties } from "react";

const STANDARD_ANSI_COLORS = [
  "0, 0, 0",
  "187, 0, 0",
  "0, 187, 0",
  "187, 187, 0",
  "0, 0, 187",
  "187, 0, 187",
  "0, 187, 187",
  "255, 255, 255",
] as const;

const BRIGHT_ANSI_COLORS = [
  "85, 85, 85",
  "255, 85, 85",
  "0, 255, 0",
  "255, 255, 85",
  "85, 85, 255",
  "255, 85, 255",
  "85, 255, 255",
  "255, 255, 255",
] as const;

const BACKSPACE_PATTERN = /[^\n]\u0008/gm;
const DEFAULT_REVERSED_FOREGROUND = "255, 255, 255";
const DEFAULT_REVERSED_BACKGROUND = "0, 0, 0";

type AnsiSegment = {
  backgroundColor: string | null;
  color: string | null;
  decorations: string[];
  opacity: number | null;
  text: string;
};

type AnsiStyleState = {
  backgroundColor: string | null;
  color: string | null;
  decorations: Set<string>;
};

export function AnsiText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const segments = useMemo(() => parseAnsiSegments(children), [children]);

  return (
    <code className={className}>
      {segments.map((segment, index) => (
        <span
          key={`${index}:${segment.text}`}
          style={buildSegmentStyle(segment)}
        >
          {segment.text}
        </span>
      ))}
    </code>
  );
}

function parseAnsiSegments(text: string) {
  const normalizedText = normalizeAnsiText(text);
  if (normalizedText.length === 0) {
    return [] as AnsiSegment[];
  }

  const segments: AnsiSegment[] = [];
  const state: AnsiStyleState = {
    backgroundColor: null,
    color: null,
    decorations: new Set<string>(),
  };

  let index = 0;
  let buffer = "";

  const flushBuffer = () => {
    if (buffer.length === 0) {
      return;
    }

    segments.push(buildSegment(buffer, state));
    buffer = "";
  };

  while (index < normalizedText.length) {
    if (normalizedText[index] === "\u001b" && normalizedText[index + 1] === "[") {
      const sequenceEnd = findAnsiSequenceEnd(normalizedText, index + 2);
      if (sequenceEnd === null) {
        buffer += normalizedText[index];
        index += 1;
        continue;
      }

      flushBuffer();
      const params = normalizedText.slice(index + 2, sequenceEnd.end);
      if (sequenceEnd.finalByte === "m") {
        applyAnsiCodes(state, params);
      }

      index = sequenceEnd.end + 1;
      continue;
    }

    buffer += normalizedText[index];
    index += 1;
  }

  flushBuffer();
  return segments;
}

function normalizeAnsiText(text: string) {
  let normalized = normalizeCarriageReturns(text);
  let previous = normalized;
  do {
    previous = normalized;
    normalized = previous.replace(BACKSPACE_PATTERN, "");
  } while (normalized.length < previous.length);
  return normalized;
}

function normalizeCarriageReturns(text: string) {
  if (text.length === 0 || !text.includes("\r")) {
    return text;
  }

  let normalized = text.replace(/\r+\n/gm, "\n");
  while (/\r./.test(normalized)) {
    normalized = normalized.replace(
      /^([^\r\n]*)\r+([^\r\n]+)/gm,
      (_match, prefix: string, replacement: string) =>
        replacement + prefix.slice(replacement.length),
    );
  }

  return normalized;
}

function findAnsiSequenceEnd(text: string, startIndex: number) {
  for (let index = startIndex; index < text.length; index += 1) {
    const codePoint = text.charCodeAt(index);
    if (codePoint >= 0x40 && codePoint <= 0x7e) {
      return {
        end: index,
        finalByte: text[index],
      };
    }
  }

  return null;
}

function applyAnsiCodes(state: AnsiStyleState, rawParams: string) {
  const params = rawParams.length === 0
    ? [0]
    : rawParams.split(";").map((value) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
      });

  for (let index = 0; index < params.length; index += 1) {
    const code = params[index] ?? 0;
    switch (code) {
      case 0:
        state.color = null;
        state.backgroundColor = null;
        state.decorations.clear();
        break;
      case 1:
        state.decorations.add("bold");
        break;
      case 2:
        state.decorations.add("dim");
        break;
      case 3:
        state.decorations.add("italic");
        break;
      case 4:
        state.decorations.add("underline");
        break;
      case 5:
        state.decorations.add("blink");
        break;
      case 7:
        state.decorations.add("reverse");
        break;
      case 8:
        state.decorations.add("hidden");
        break;
      case 9:
        state.decorations.add("strikethrough");
        break;
      case 21:
        state.decorations.delete("bold");
        break;
      case 22:
        state.decorations.delete("bold");
        state.decorations.delete("dim");
        break;
      case 23:
        state.decorations.delete("italic");
        break;
      case 24:
        state.decorations.delete("underline");
        break;
      case 25:
        state.decorations.delete("blink");
        break;
      case 27:
        state.decorations.delete("reverse");
        break;
      case 28:
        state.decorations.delete("hidden");
        break;
      case 29:
        state.decorations.delete("strikethrough");
        break;
      case 39:
        state.color = null;
        break;
      case 49:
        state.backgroundColor = null;
        break;
      case 38:
      case 48: {
        const isForeground = code === 38;
        const mode = params[index + 1];
        if (mode === 5) {
          const paletteIndex = params[index + 2];
          if (paletteIndex !== undefined) {
            const color = resolveAnsiPaletteColor(paletteIndex);
            if (color !== null) {
              if (isForeground) {
                state.color = color;
              } else {
                state.backgroundColor = color;
              }
            }
          }
          index += 2;
        } else if (mode === 2) {
          const red = params[index + 2];
          const green = params[index + 3];
          const blue = params[index + 4];
          if (
            red !== undefined &&
            green !== undefined &&
            blue !== undefined &&
            isByteColorValue(red) &&
            isByteColorValue(green) &&
            isByteColorValue(blue)
          ) {
            const color = `${red}, ${green}, ${blue}`;
            if (isForeground) {
              state.color = color;
            } else {
              state.backgroundColor = color;
            }
          }
          index += 4;
        }
        break;
      }
      default:
        if (code >= 30 && code <= 37) {
          state.color = STANDARD_ANSI_COLORS[code - 30] ?? null;
        } else if (code >= 90 && code <= 97) {
          state.color = BRIGHT_ANSI_COLORS[code - 90] ?? null;
        } else if (code >= 40 && code <= 47) {
          state.backgroundColor = STANDARD_ANSI_COLORS[code - 40] ?? null;
        } else if (code >= 100 && code <= 107) {
          state.backgroundColor = BRIGHT_ANSI_COLORS[code - 100] ?? null;
        }
        break;
    }
  }
}

function resolveAnsiPaletteColor(index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 255) {
    return null;
  }

  if (index < 8) {
    return STANDARD_ANSI_COLORS[index] ?? null;
  }

  if (index < 16) {
    return BRIGHT_ANSI_COLORS[index - 8] ?? null;
  }

  if (index < 232) {
    const paletteIndex = index - 16;
    const red = Math.floor(paletteIndex / 36);
    const green = Math.floor((paletteIndex % 36) / 6);
    const blue = paletteIndex % 6;
    const scale = [0, 95, 135, 175, 215, 255];
    return `${scale[red]}, ${scale[green]}, ${scale[blue]}`;
  }

  const grayscale = 8 + (index - 232) * 10;
  return `${grayscale}, ${grayscale}, ${grayscale}`;
}

function isByteColorValue(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function buildSegment(text: string, state: AnsiStyleState): AnsiSegment {
  let color = state.color;
  let backgroundColor = state.backgroundColor;
  const decorations = Array.from(state.decorations).filter((decoration) => decoration !== "reverse");

  if (state.decorations.has("reverse")) {
    const nextColor = backgroundColor ?? DEFAULT_REVERSED_FOREGROUND;
    const nextBackgroundColor = color ?? DEFAULT_REVERSED_BACKGROUND;
    color = nextColor;
    backgroundColor = nextBackgroundColor;
  }

  return {
    backgroundColor,
    color,
    decorations,
    opacity: decorations.includes("dim") ? 0.5 : null,
    text,
  };
}

function buildSegmentStyle(segment: AnsiSegment) {
  const textDecorationLine = segment.decorations
    .filter((decoration) => decoration === "underline" || decoration === "strikethrough")
    .join(" ");

  const style: CSSProperties = {};
  if (segment.color !== null) {
    style.color = `rgb(${segment.color})`;
  }
  if (segment.backgroundColor !== null) {
    style.backgroundColor = `rgb(${segment.backgroundColor})`;
  }
  if (segment.decorations.includes("bold")) {
    style.fontWeight = "bold";
  }
  if (segment.decorations.includes("italic")) {
    style.fontStyle = "italic";
  }
  if (segment.decorations.includes("hidden")) {
    style.visibility = "hidden";
  }
  if (segment.opacity !== null) {
    style.opacity = segment.opacity;
  }
  if (textDecorationLine.length > 0) {
    style.textDecorationLine = textDecorationLine;
  }
  return style;
}
