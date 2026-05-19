import { lazy, Suspense, type ClipboardEvent as ReactClipboardEvent } from "react";
import type { MessageKey } from "../../i18n/messages";
import { isWorkspaceFilePdbPreview, normalizePreviewText } from "./workspaceFilePreviewUtils";

const PdbPreview = lazy(async () => {
  const module = await import("./PdbPreview");
  return { default: module.PdbPreview };
});

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type FilePreviewPageProps = {
  routeState?: unknown;
  t: Translate;
};

type FilePreviewRouteState = {
  filePath: string;
  contents: string;
  line?: number;
  column?: number;
};

export function FilePreviewPage({ routeState, t }: FilePreviewPageProps) {
  const state = parseFilePreviewRouteState(routeState ?? (typeof window === "undefined" ? null : window.history.state));
  if (state === null) {
    return <div className="h-full" />;
  }

  if (resolveFilePreviewMimeType(state.filePath) === "application/pdf") {
    return (
      <div className="flex h-full items-center justify-center text-token-text-tertiary">
        {t("wham.diff.binaryFile")}
      </div>
    );
  }

  const normalizedContents = normalizePreviewText(state.contents);
  if (
    isWorkspaceFilePdbPreview({
      mimeType: null,
      name: state.filePath,
      path: state.filePath,
      relativePath: state.filePath,
    })
  ) {
    return (
      <Suspense fallback={<div className="h-full bg-token-main-surface-primary" />}>
        <PdbPreview contents={normalizedContents} filePath={state.filePath} t={t} />
      </Suspense>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <FilePreviewCodeSnippet
        content={normalizedContents}
        shouldWrapCode
        showActionBar={false}
        wrapperClassName="border-0 shadow-none rounded-none"
        codeContainerClassName="p-panel overflow-visible"
        codeClassName="block"
      />
    </div>
  );
}

type FilePreviewCodeSnippetProps = {
  codeClassName?: string;
  codeContainerClassName?: string;
  content: string;
  shouldWrapCode?: boolean;
  showActionBar?: boolean;
  wrapperClassName?: string;
};

function FilePreviewCodeSnippet({
  codeClassName = "",
  codeContainerClassName = "",
  content,
  shouldWrapCode = false,
  showActionBar = true,
  wrapperClassName = "",
}: FilePreviewCodeSnippetProps) {
  const theme = resolveCodeSnippetTheme();

  return (
    <div
      className={joinClassNames(
        "relative w-full min-w-0 overflow-clip rounded-lg border contain-inline-size",
        "bg-token-text-code-block-background border-token-input-background",
        theme,
        wrapperClassName,
      )}
      data-theme={theme}
    >
      <div className={joinClassNames("text-size-chat overflow-auto p-2", codeContainerClassName)} dir="ltr">
        <code
          className={joinClassNames(codeClassName, shouldWrapCode ? "whitespace-pre-wrap" : "whitespace-pre")}
          onCopy={handleCodeCopy}
        >
          <span>{content}</span>
        </code>
      </div>
    </div>
  );
}

function handleCodeCopy(event: ReactClipboardEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();

  const selectedText = window.getSelection()?.toString();
  if (!selectedText) {
    return;
  }

  const navigatorObject = event.currentTarget.ownerDocument.defaultView?.navigator ?? window.navigator;
  if (navigatorObject.clipboard?.writeText == null) {
    return;
  }

  void navigatorObject.clipboard.writeText(selectedText).catch(() => {});
}

function parseFilePreviewRouteState(value: unknown): FilePreviewRouteState | null {
  if (!isRecord(value)) {
    return null;
  }

  const { filePath, contents, line, column } = value;
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return null;
  }
  if (typeof contents !== "string") {
    return null;
  }
  if (line !== undefined && !isFiniteNumber(line)) {
    return null;
  }
  if (column !== undefined && !isFiniteNumber(column)) {
    return null;
  }

  return {
    filePath,
    contents,
    ...(typeof line === "number" ? { line } : {}),
    ...(typeof column === "number" ? { column } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveFilePreviewMimeType(filePath: string) {
  return /\.pdf$/i.test(filePath.trim()) ? "application/pdf" : null;
}

function resolveCodeSnippetTheme() {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
