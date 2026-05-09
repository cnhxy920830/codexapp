import { useEffect, useState } from "react";
import type { MessageKey } from "../../i18n/messages";
import { readWorkspaceFile, type WorkspaceFileDocument, type WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import { isWorkspaceFilePdbPreview, normalizePreviewText } from "./workspaceFilePreviewUtils";
import { PdbPreview } from "./PdbPreview";

type WorkspaceFilePreviewPanelProps = {
  selectedFileTarget: WorkspaceFilePreviewTarget;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type WorkspaceFilePreviewState =
  | {
      kind: "loading";
    }
  | {
      kind: "empty";
    }
  | {
      kind: "ready";
      file: WorkspaceFileDocument;
    };

export function WorkspaceFilePreviewPanel({
  selectedFileTarget,
  t,
}: WorkspaceFilePreviewPanelProps) {
  const [previewState, setPreviewState] = useState<WorkspaceFilePreviewState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setPreviewState({ kind: "loading" });

    void readWorkspaceFile({
      workspaceRoot: selectedFileTarget.workspaceRoot,
      relativePath: selectedFileTarget.relativePath,
    })
      .then((file) => {
        if (!cancelled) {
          setPreviewState({ kind: "ready", file });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewState({ kind: "empty" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileTarget.relativePath, selectedFileTarget.workspaceRoot]);

  if (previewState.kind === "empty") {
    return <div className="-mx-4 -my-4 h-[calc(100%+2rem)] min-h-full" />;
  }

  if (previewState.kind === "loading") {
    return (
      <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full items-center justify-center">
        <div className="app-text-muted text-[13px] leading-6">{t("review.fileSource.loading")}</div>
      </div>
    );
  }

  const { file } = previewState;
  const normalizedPath = (file.relativePath || file.path).toLowerCase();
  const normalizedMimeType = file.mimeType?.toLowerCase() ?? null;
  const isPdf = normalizedMimeType === "application/pdf" || normalizedPath.endsWith(".pdf");
  const isPdb = isWorkspaceFilePdbPreview(file);
  const normalizedContents = normalizePreviewText(file.contents ?? "");

  if (isPdf) {
    return (
      <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full items-center justify-center">
        <div className="app-text-muted text-[13px] leading-6">{t("wham.diff.binaryFile")}</div>
      </div>
    );
  }

  if (isPdb) {
    return (
      <div className="-mx-4 -my-4 h-[calc(100%+2rem)] min-h-full overflow-hidden">
        <PdbPreview contents={file.contents ?? ""} t={t} />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 h-[calc(100%+2rem)] min-h-full overflow-auto">
      <div className="min-h-full bg-[var(--app-shell-right)]">
        <code className="block whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-6">
          {normalizedContents}
        </code>
      </div>
    </div>
  );
}
