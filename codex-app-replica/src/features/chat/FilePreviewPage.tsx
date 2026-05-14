import { lazy, Suspense } from "react";
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

  if (state.filePath.toLowerCase().endsWith(".pdf")) {
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
        <PdbPreview contents={normalizedContents} t={t} />
      </Suspense>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="border-0 shadow-none rounded-none">
        <div className="p-panel overflow-visible">
          <code className="block whitespace-pre-wrap break-words">{normalizedContents}</code>
        </div>
      </div>
    </div>
  );
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
