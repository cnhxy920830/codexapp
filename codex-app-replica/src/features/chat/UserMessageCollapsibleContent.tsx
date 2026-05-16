import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { ChevronDownIcon } from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";

const DEFAULT_COLLAPSED_LINE_COUNT = 20;
const CLAMP_STYLE = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
} as const;

type CollapseState = "collapsed" | "expanded" | "uncollapsible";

type UserMessageCollapsibleContentProps = {
  text: string;
  cwd?: string | null;
  hostId?: string | null;
  collapsedLineCount?: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function UserMessageCollapsibleContent({
  text,
  cwd = null,
  hostId = null,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
  t,
}: UserMessageCollapsibleContentProps) {
  const { collapseState, setTextContentMeasurementRef, toggleExpansion } = useUserMessageCollapseState({
    text,
    collapsedLineCount,
  });

  const clampStyle =
    collapseState === "collapsed"
      ? {
          ...CLAMP_STYLE,
          WebkitLineClamp: collapsedLineCount,
        }
      : undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      <div ref={setTextContentMeasurementRef} className="relative w-full min-w-0 text-[14px] leading-6">
        <MarkdownPreview
          className="app-message-markdown"
          cwd={cwd}
          hostId={hostId}
          style={clampStyle}
          text={text}
          variant="appShell"
        />
      </div>
      {collapseState === "uncollapsible" ? null : (
        <button
          type="button"
          aria-expanded={collapseState === "expanded"}
          onClick={toggleExpansion}
          className="mt-1.5 inline-flex cursor-pointer items-center gap-1 self-start text-[14px] leading-6 text-[var(--app-shell-subtle)] hover:text-[var(--app-shell-text)]"
        >
          <span>
            {collapseState === "expanded"
              ? t("app.chat.userMessage.showLess")
              : t("app.chat.userMessage.showMore")}
          </span>
          <ChevronDownIcon className={collapseState === "expanded" ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
        </button>
      )}
    </div>
  );
}

function useUserMessageCollapseState({
  text,
  collapsedLineCount,
}: {
  text: string;
  collapsedLineCount: number;
}) {
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<TextMeasurement | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setExpandedText((current) => (current === text ? current : null));
  }, [text]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const updateMeasurement = () => {
      const nextMeasurement = readTextMeasurement(element, 13);
      setMeasurement((current) => {
        if (
          current?.font === nextMeasurement?.font &&
          current?.lineHeightPx === nextMeasurement?.lineHeightPx &&
          current?.maxWidthPx === nextMeasurement?.maxWidthPx
        ) {
          return current;
        }
        return nextMeasurement;
      });
    };

    updateMeasurement();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurement();
    });
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  const lineCount = measureWrappedLineCount(text, measurement);
  const collapseState: CollapseState =
    lineCount === null || lineCount <= collapsedLineCount
      ? "uncollapsible"
      : expandedText === text
        ? "expanded"
        : "collapsed";

  return {
    collapseState,
    setTextContentMeasurementRef: (element: HTMLDivElement | null) => {
      elementRef.current = element;
    },
    toggleExpansion: () => {
      setExpandedText((current) => (current === text ? null : text));
    },
  };
}

type TextMeasurement = {
  font: string;
  lineHeightPx: number;
  maxWidthPx: number;
};

function readTextMeasurement(element: HTMLElement, fallbackFontSizePx: number): TextMeasurement | null {
  const maxWidthPx = Math.floor(element.getBoundingClientRect().width);
  if (maxWidthPx <= 0) {
    return null;
  }

  const style = window.getComputedStyle(element);
  const fontSizePx = readFontSizePx(style, fallbackFontSizePx);

  return {
    font: [style.fontStyle || "normal", style.fontVariant || "normal", style.fontWeight || "400", `${fontSizePx}px`, style.fontFamily || "sans-serif"].join(" "),
    lineHeightPx: readLineHeightPx(style, fontSizePx),
    maxWidthPx,
  };
}

function readFontSizePx(style: CSSStyleDeclaration, fallbackFontSizePx: number) {
  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) ? fontSize : fallbackFontSizePx;
}

function readLineHeightPx(style: CSSStyleDeclaration, fontSizePx: number) {
  const lineHeight = Number.parseFloat(style.lineHeight);
  return Number.isFinite(lineHeight) ? lineHeight : fontSizePx * 1.5;
}

function measureWrappedLineCount(text: string, measurement: TextMeasurement | null) {
  if (!measurement || measurement.maxWidthPx <= 0) {
    return null;
  }

  const canvas = getMeasurementCanvasContext();
  canvas.font = measurement.font;

  const paragraphs = normalizeText(text).split("\n");
  let lineCount = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lineCount += 1;
      continue;
    }
    lineCount += measureParagraphLineCount(paragraph, measurement.maxWidthPx, canvas);
  }
  return lineCount;
}

function measureParagraphLineCount(paragraph: string, maxWidthPx: number, canvas: TextMeasurementCanvasContext) {
  const segments = segmentParagraph(paragraph);
  let lineCount = 1;
  let currentWidth = 0;

  for (const segment of segments) {
    const segmentWidth = canvas.measureText(segment).width;

    if (segmentWidth <= maxWidthPx) {
      if (currentWidth > 0 && currentWidth + segmentWidth > maxWidthPx) {
        lineCount += 1;
        currentWidth = segmentWidth;
      } else {
        currentWidth += segmentWidth;
      }
      continue;
    }

    for (const grapheme of segmentGraphemes(segment)) {
      const graphemeWidth = canvas.measureText(grapheme).width;
      if (currentWidth > 0 && currentWidth + graphemeWidth > maxWidthPx) {
        lineCount += 1;
        currentWidth = graphemeWidth;
      } else if (currentWidth === 0 && graphemeWidth > maxWidthPx) {
        lineCount += 1;
        currentWidth = 0;
      } else {
        currentWidth += graphemeWidth;
      }
    }
  }

  return lineCount;
}

function segmentParagraph(paragraph: string) {
  const segments = paragraph.match(/\S+\s*|\s+/g);
  return segments ?? [paragraph];
}

function segmentGraphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (entry) => entry.segment);
  }
  return Array.from(text);
}

type TextMeasurementCanvasContext = {
  font: string;
  measureText: (text: string) => TextMetrics;
};

let measurementCanvasContext: TextMeasurementCanvasContext | null = null;

function getMeasurementCanvasContext() {
  if (measurementCanvasContext !== null) {
    return measurementCanvasContext;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    measurementCanvasContext = new OffscreenCanvas(1, 1).getContext("2d");
  } else {
    measurementCanvasContext = document.createElement("canvas").getContext("2d");
  }

  if (measurementCanvasContext === null) {
    throw new Error("Text measurement requires a canvas context.");
  }

  return measurementCanvasContext;
}

function normalizeText(text: string) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}
