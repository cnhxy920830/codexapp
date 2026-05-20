import { useEffect, useState } from "react";
import { CheckIcon, CopyPathIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { useI18n } from "../i18n/i18n";

type CodeSnippetProps = {
  codeContainerClassName?: string;
  content: string;
  language: string;
  shouldWrapCode?: boolean;
  showActionBar?: boolean;
  title?: string;
  wrapperClassName?: string;
};

export function CodeSnippet({
  codeContainerClassName,
  content,
  language,
  shouldWrapCode = false,
  showActionBar = true,
  title,
  wrapperClassName,
}: CodeSnippetProps) {
  const resolvedTitle = title ?? language;

  return (
    <div
      className={joinClasses(
        "relative w-full min-w-0 overflow-clip rounded-lg border border-token-input-background bg-token-text-code-block-background contain-inline-size",
        wrapperClassName,
      )}
    >
      {showActionBar ? (
        <div className="flex items-center px-2 py-1 text-sm text-token-description-foreground select-none">
          <div className="min-w-0 flex-1 truncate">{resolvedTitle}</div>
          <div className="ml-auto flex shrink-0 items-center">
            <CodeSnippetCopyButton content={content} />
          </div>
        </div>
      ) : null}
      <div className={joinClasses("overflow-auto p-2 text-size-chat", codeContainerClassName)} dir="ltr">
        <code
          className={joinClasses(
            "block font-mono text-xs text-token-text-primary",
            shouldWrapCode ? "whitespace-pre-wrap" : "whitespace-pre",
          )}
          data-language={language}
        >
          {content}
        </code>
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

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
