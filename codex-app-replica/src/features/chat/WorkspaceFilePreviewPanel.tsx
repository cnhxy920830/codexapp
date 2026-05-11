import { useEffect, useState, type ReactNode } from "react";
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
  const previewTitle = getWorkspaceFilePreviewTitle(selectedFileTarget);

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
      <WorkspaceFilePreviewShell title={previewTitle}>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[13px] leading-6 text-token-text-secondary">
            <LoadingSpinner />
            <span>{t("review.fileSource.loading")}</span>
          </div>
        </div>
      </WorkspaceFilePreviewShell>
    );
  }

  return <WorkspaceFilePreviewContent file={previewState.file} t={t} />;
}

export function WorkspaceFilePreviewContent({
  file,
  t,
}: {
  file: WorkspaceFileDocument;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const title = getWorkspaceFilePreviewTitle(file);
  const normalizedPath = (file.relativePath || file.path).toLowerCase();
  const isPdf = normalizedPath.endsWith(".pdf");
  const isPdb = isWorkspaceFilePdbPreview(file);
  const normalizedContents = normalizePreviewText(file.contents ?? "");

  return (
    <WorkspaceFilePreviewShell title={title}>
      {isPdf ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-[13px] leading-6 text-token-text-secondary">{t("wham.diff.binaryFile")}</div>
        </div>
      ) : isPdb ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <PdbPreview contents={file.contents ?? ""} t={t} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="p-panel overflow-visible">
            <code className="block whitespace-pre-wrap break-words">{normalizedContents}</code>
          </div>
        </div>
      )}
    </WorkspaceFilePreviewShell>
  );
}

function WorkspaceFilePreviewShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full flex-col bg-token-main-surface-primary">
      <div className="border-b border-token-border px-3 py-2 text-sm font-medium text-token-text-primary">{title}</div>
      {children}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function getWorkspaceFilePreviewTitle(file: Pick<WorkspaceFileDocument | WorkspaceFilePreviewTarget, "name" | "path" | "relativePath">) {
  const sourcePath = file.relativePath || file.name || file.path;
  return sourcePath.split(/[\\/]+/).at(-1) ?? sourcePath;
}
