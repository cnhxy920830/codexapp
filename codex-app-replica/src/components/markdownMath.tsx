import { c as katexRuntime } from "../assets/katex/katex-V194-jer.js";

const DISPLAY_MATH_DELIMITER = "$$";
const INLINE_MATH_DELIMITER = "$";
const DEFAULT_ERROR_COLOR = "#cc0000";
const MATH_CODE_FENCE_LANGUAGES = new Set(["language-math", "math"]);

type KatexRuntime = {
  renderToString(expression: string, options?: {
    displayMode?: boolean;
    errorColor?: string;
    strict?: boolean | "ignore" | string;
    throwOnError?: boolean;
  }): string;
};

const katex = katexRuntime as KatexRuntime;

export type MarkdownMathBlock = {
  source: string;
  type: "math";
};

export type MarkdownMathInlineNode = {
  source: string;
  type: "math";
};

export type MarkdownMathToken = {
  fullMatch: string;
  index: number;
  innerText: string;
  type: "math";
};

export function MarkdownMath({
  displayMode,
  source,
}: {
  displayMode: boolean;
  source: string;
}) {
  const html = renderMarkdownMathMarkup(source, displayMode);
  if (displayMode) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function isMarkdownMathCodeFenceLanguage(language: string | null) {
  if (language == null) {
    return false;
  }

  const normalized = language.trim().toLowerCase().split(/\s+/, 1)[0] ?? "";
  return MATH_CODE_FENCE_LANGUAGES.has(normalized);
}

export function tryParseMarkdownMathBlock({
  lineIndex,
  lines,
}: {
  lineIndex: number;
  lines: string[];
}) {
  const line = lines[lineIndex] ?? "";
  const openingMatch = /^\s*\$\$(.*)$/.exec(line);
  if (openingMatch == null) {
    return null;
  }

  const openingRemainder = openingMatch[1] ?? "";
  const singleLineCloseIndex = findUnescapedDoubleDollar(openingRemainder);
  if (singleLineCloseIndex >= 0) {
    const trailingText = openingRemainder.slice(singleLineCloseIndex + DISPLAY_MATH_DELIMITER.length);
    if (trailingText.trim().length > 0) {
      return null;
    }

    return {
      block: {
        source: openingRemainder.slice(0, singleLineCloseIndex),
        type: "math" as const,
      },
      nextLineIndex: lineIndex + 1,
    };
  }

  const mathLines = [openingRemainder];
  for (let nextLineIndex = lineIndex + 1; nextLineIndex < lines.length; nextLineIndex += 1) {
    const currentLine = lines[nextLineIndex] ?? "";
    const closeIndex = findUnescapedDoubleDollar(currentLine);
    if (closeIndex < 0) {
      mathLines.push(currentLine);
      continue;
    }

    const trailingText = currentLine.slice(closeIndex + DISPLAY_MATH_DELIMITER.length);
    if (trailingText.trim().length > 0) {
      return null;
    }

    mathLines.push(currentLine.slice(0, closeIndex));
    return {
      block: {
        source: trimOuterMathBlockNewlines(mathLines.join("\n")),
        type: "math" as const,
      },
      nextLineIndex: nextLineIndex + 1,
    };
  }

  return null;
}

export function findInlineMathToken(text: string): MarkdownMathToken | null {
  for (let openIndex = 0; openIndex < text.length; openIndex += 1) {
    if (!isValidInlineMathOpening(text, openIndex)) {
      continue;
    }

    for (let closeIndex = openIndex + 1; closeIndex < text.length; closeIndex += 1) {
      if (!isValidInlineMathClosing(text, closeIndex)) {
        continue;
      }

      return {
        fullMatch: text.slice(openIndex, closeIndex + 1),
        index: openIndex,
        innerText: text.slice(openIndex + 1, closeIndex),
        type: "math",
      };
    }
  }

  return null;
}

function renderMarkdownMathMarkup(source: string, displayMode: boolean) {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: true,
    });
  } catch (error) {
    try {
      return katex.renderToString(source, {
        displayMode,
        strict: "ignore",
        throwOnError: false,
      });
    } catch {
      const title = String(error);
      return `<span class="katex-error" style="color:${DEFAULT_ERROR_COLOR}" title="${escapeHtmlAttribute(title)}">${escapeHtml(source)}</span>`;
    }
  }
}

function isValidInlineMathOpening(text: string, index: number) {
  if (text[index] !== INLINE_MATH_DELIMITER || isEscapedDelimiter(text, index)) {
    return false;
  }

  const previousCharacter = text[index - 1] ?? "";
  const nextCharacter = text[index + 1] ?? "";
  if (previousCharacter === INLINE_MATH_DELIMITER || nextCharacter === INLINE_MATH_DELIMITER) {
    return false;
  }

  if (nextCharacter.trim().length === 0) {
    return false;
  }

  return !(isAsciiDigit(previousCharacter) && isAsciiDigit(nextCharacter));
}

function isValidInlineMathClosing(text: string, index: number) {
  if (text[index] !== INLINE_MATH_DELIMITER || isEscapedDelimiter(text, index)) {
    return false;
  }

  const previousCharacter = text[index - 1] ?? "";
  const nextCharacter = text[index + 1] ?? "";
  if (previousCharacter === INLINE_MATH_DELIMITER || nextCharacter === INLINE_MATH_DELIMITER) {
    return false;
  }

  if (previousCharacter.trim().length === 0) {
    return false;
  }

  return !(isAsciiDigit(previousCharacter) && isAsciiDigit(nextCharacter));
}

function findUnescapedDoubleDollar(text: string) {
  for (let index = 0; index < text.length - 1; index += 1) {
    if (text[index] === INLINE_MATH_DELIMITER && text[index + 1] === INLINE_MATH_DELIMITER && !isEscapedDelimiter(text, index)) {
      return index;
    }
  }

  return -1;
}

function isEscapedDelimiter(text: string, index: number) {
  let slashCount = 0;
  for (let currentIndex = index - 1; currentIndex >= 0 && text[currentIndex] === "\\"; currentIndex -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isAsciiDigit(value: string) {
  return /^\d$/.test(value);
}

function trimOuterMathBlockNewlines(value: string) {
  return value.replace(/^\n/, "").replace(/\n$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
