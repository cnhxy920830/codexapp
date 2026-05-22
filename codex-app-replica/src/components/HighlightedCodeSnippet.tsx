import { useEffect, useState } from "react";
import { CheckIcon, CopyPathIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { useI18n } from "../i18n/i18n";
import { codeToHtml } from "shiki";

type HighlightedCodeSnippetProps = {
  codeContainerClassName?: string;
  content: string;
  language: string;
  shouldWrapCode?: boolean;
  showActionBar?: boolean;
  showLineNumbers?: boolean;
  title?: string;
  wrapperClassName?: string;
};

export function HighlightedCodeSnippet({
  codeContainerClassName,
  content,
  language,
  shouldWrapCode = false,
  showActionBar = true,
  showLineNumbers = false,
  title,
  wrapperClassName,
}: HighlightedCodeSnippetProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const resolvedTitle = title ?? language;

  useEffect(() => {
    let cancelled = false;

    const highlight = async () => {
      if (isHighlighting) {
        return;
      }

      setIsHighlighting(true);

      try {
        const html = await codeToHtml(content, {
          lang: language || "text",
          theme: "github-dark",
          transformers: showLineNumbers
            ? [
                {
                  line(node, line) {
                    node.properties["data-line"] = line;
                  },
                },
              ]
            : [],
        });

        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch (error) {
        // If highlighting fails, fall back to plain text
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      } finally {
        if (!cancelled) {
          setIsHighlighting(false);
        }
      }
    };

    void highlight();

    return () => {
      cancelled = true;
    };
  }, [content, language, showLineNumbers, isHighlighting]);

  return (
    <div
      className={joinClasses(
        "relative w-full min-w-0 overflow-clip rounded-lg border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-muted)] contain-inline-size",
        wrapperClassName,
      )}
    >
      {showActionBar ? (
        <div className="flex items-center border-b border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] px-3 py-2 text-xs text-[var(--app-shell-muted)] select-none">
          <div className="min-w-0 flex-1 truncate font-medium">{resolvedTitle}</div>
          <div className="ml-auto flex shrink-0 items-center">
            <CodeSnippetCopyButton content={content} />
          </div>
        </div>
      ) : null}
      <div
        className={joinClasses(
          "overflow-auto p-4 text-[13px] leading-[1.6]",
          codeContainerClassName,
        )}
        dir="ltr"
      >
        {highlightedHtml ? (
          <div
            className={joinClasses(
              "[&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent [&_code]:font-mono [&_code]:text-[13px]",
              shouldWrapCode ? "[&_code]:whitespace-pre-wrap" : "[&_code]:whitespace-pre",
              showLineNumbers ? "[&_.line]:pl-4 [&_.line]:before:content-[attr(data-line)] [&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:text-right [&_.line]:before:mr-4 [&_.line]:before:text-[var(--app-shell-subtle)]" : "",
            )}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code
            className={joinClasses(
              "block font-mono text-[13px] text-[var(--app-shell-text)]",
              shouldWrapCode ? "whitespace-pre-wrap" : "whitespace-pre",
            )}
            data-language={language}
          >
            {content}
          </code>
        )}
      </div>
    </div>
  );
}

function CodeSnippetCopyButton({ content }: { content: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  return (
    <Button
      aria-label={copied ? t("copyButton.copiedAriaLabel") : t("copyButton.copyAriaLabel")}
      color={copied ? "ghostActive" : "ghost"}
      size="icon"
      title={copied ? t("copyButton.copied") : t("copyButton.copyCode")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
          return;
        }

        void navigator.clipboard.writeText(content).then(
          () => {
            setCopied(true);
          },
          () => {},
        );
      }}
    >
      {copied ? <CheckIcon className="icon-xs" /> : <CopyPathIcon className="icon-xs" />}
    </Button>
  );
}

function joinClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
