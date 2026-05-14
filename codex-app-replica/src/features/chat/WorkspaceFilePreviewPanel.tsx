import { useEffect, useState, type ReactNode } from "react";
import type { MessageKey } from "../../i18n/messages";
import {
  readWorkspaceFile,
  readWorkspaceFileBinary,
  readWorkspaceFileMetadata,
  type WorkspaceFileDocument,
  type WorkspaceFileMetadata,
  type WorkspaceFilePreviewTarget,
} from "../../services/workspaceFiles";
import { PdbPreview } from "./PdbPreview";
import { PdfPreviewPanel } from "./PdfPreviewPanel";
import { WorkbookPreviewPanel } from "./WorkbookPreviewPanel";
import { loadWorkbookPreviewProto, type WorkbookPreviewProto } from "./workbookPreviewLoader";
import {
  getWorkspaceFileArtifactImportKind,
  getWorkspaceFileUnsupportedMessageKey,
  getWorkspaceFileUnsupportedPreviewKind,
  isWorkspaceFileWorkbookImportKind,
  isWorkspaceFilePdbPreview,
  normalizePreviewText,
  type WorkspaceFilePreviewState,
  type WorkspaceFileUnsupportedPreviewKind,
} from "./workspaceFilePreviewUtils";
import { DocxPreviewPanel } from "./DocxPreviewPanel";

type WorkspaceFilePreviewPanelProps = {
  selectedFileTarget: WorkspaceFilePreviewTarget;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type WorkspaceFilePreviewReadyState =
  | {
      kind: "ready";
      file: WorkspaceFileDocument;
      workbookProto: WorkbookPreviewProto | null;
      binaryContents: Uint8Array | null;
    }
  | Extract<WorkspaceFilePreviewState, { kind: "unsupported" | "tooLarge" | "error" | "loading" }>;

export function WorkspaceFilePreviewPanel({
  selectedFileTarget,
  t,
}: WorkspaceFilePreviewPanelProps) {
  const [previewState, setPreviewState] = useState<WorkspaceFilePreviewReadyState>({ kind: "loading" });
  const previewTitle = getWorkspaceFilePreviewTitle(selectedFileTarget);

  useEffect(() => {
    let cancelled = false;
    setPreviewState({ kind: "loading" });

    void loadWorkspaceFilePreviewState(selectedFileTarget)
      .then((nextPreviewState) => {
        if (!cancelled) {
          setPreviewState(nextPreviewState);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewState({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileTarget.relativePath, selectedFileTarget.workspaceRoot]);

  return <WorkspaceFilePreviewSurface previewState={previewState} previewTitle={previewTitle} t={t} />;
}

export function WorkspaceFilePreviewContent({
  binaryContents = null,
  file,
  t,
  workbookProto = null,
}: {
  binaryContents?: Uint8Array | null;
  file: WorkspaceFileDocument;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workbookProto?: WorkbookPreviewProto | null;
}) {
  const previewTitle = getWorkspaceFilePreviewTitle(file);
  return (
    <WorkspaceFilePreviewSurface
      previewState={{
        kind: "ready",
        binaryContents,
        file,
        workbookProto,
      }}
      previewTitle={previewTitle}
      t={t}
    />
  );
}

export function WorkspaceFilePreviewStateContent({
  previewState,
  previewTitle,
  t,
}: {
  previewState: WorkspaceFilePreviewReadyState;
  previewTitle: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return <WorkspaceFilePreviewSurface previewState={previewState} previewTitle={previewTitle} t={t} />;
}

function WorkspaceFilePreviewSurface({
  previewState,
  previewTitle,
  t,
}: {
  previewState: WorkspaceFilePreviewReadyState;
  previewTitle: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (previewState.kind === "loading") {
    return (
      <WorkspaceFilePreviewShell title={previewTitle}>
        <ArtifactPreviewStatus kind="loading" t={t} />
      </WorkspaceFilePreviewShell>
    );
  }

  if (previewState.kind === "error") {
    return (
      <WorkspaceFilePreviewShell title={previewTitle}>
        <ArtifactPreviewStatus kind="error" t={t} />
      </WorkspaceFilePreviewShell>
    );
  }

  if (previewState.kind === "tooLarge") {
    return (
      <WorkspaceFilePreviewShell title={previewTitle}>
        <TooLargePreviewState sizeBytes={previewState.sizeBytes} t={t} />
      </WorkspaceFilePreviewShell>
    );
  }

  if (previewState.kind === "unsupported") {
    return (
      <WorkspaceFilePreviewShell title={previewTitle}>
        <UnsupportedPreviewState unsupportedKind={previewState.unsupportedKind} t={t} />
      </WorkspaceFilePreviewShell>
    );
  }

  const { binaryContents, file, workbookProto } = previewState;
  const normalizedPath = (file.relativePath || file.path).toLowerCase();
  const isPdf = normalizedPath.endsWith(".pdf");
  const isPdb = isWorkspaceFilePdbPreview(file);
  const artifactImportKind = getWorkspaceFileArtifactImportKind(file);
  const normalizedContents = normalizePreviewText(file.contents ?? "");
  const isDocxPreview = artifactImportKind === "docx" && binaryContents != null;

  return (
    <WorkspaceFilePreviewShell title={previewTitle} omitHeader={isPdf}>
      {isPdf ? (
        <PdfPreviewPanel file={file} t={t} />
      ) : isWorkspaceFileWorkbookImportKind(artifactImportKind) && workbookProto != null ? (
        <WorkbookPreviewPanel title={previewTitle} t={t} workbookProto={workbookProto} />
      ) : isDocxPreview ? (
        <DocxPreviewPanel bytes={binaryContents} path={file.path} title={previewTitle} t={t} />
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

async function loadWorkspaceFilePreviewState(selectedFileTarget: WorkspaceFilePreviewTarget): Promise<WorkspaceFilePreviewReadyState> {
  const fileMetadata = await readWorkspaceFileMetadata({
    workspaceRoot: selectedFileTarget.workspaceRoot,
    relativePath: selectedFileTarget.relativePath,
  });

  if (!fileMetadata.isFile) {
    return { kind: "error" };
  }

  const previewDescriptor = {
    name: selectedFileTarget.name,
    path: selectedFileTarget.path,
    relativePath: selectedFileTarget.relativePath,
    mimeType: fileMetadata.mimeType,
  };

  const unsupportedKind = getWorkspaceFileUnsupportedPreviewKind(previewDescriptor);
  if (unsupportedKind != null) {
    return {
      kind: "unsupported",
      unsupportedKind,
    };
  }

  const normalizedPath = (selectedFileTarget.relativePath || selectedFileTarget.path).toLowerCase();
  const isPdf = normalizedPath.endsWith(".pdf");
  if (!isPdf && fileMetadata.sizeBytes != null && fileMetadata.sizeBytes > 40 * 1024 * 1024) {
    return {
      kind: "tooLarge",
      sizeBytes: fileMetadata.sizeBytes,
    };
  }

  const artifactImportKind = getWorkspaceFileArtifactImportKind(previewDescriptor);
  if (artifactImportKind != null) {
    const file = buildWorkspaceFileDocumentFromMetadata(selectedFileTarget, fileMetadata);
    const binaryResponse = await readWorkspaceFileBinary({
      workspaceRoot: selectedFileTarget.workspaceRoot,
      relativePath: selectedFileTarget.relativePath,
    });
    const binaryContents = decodeBase64ToBytes(binaryResponse.contentsBase64);
    const workbookProto = isWorkspaceFileWorkbookImportKind(artifactImportKind)
      ? await loadWorkbookPreviewProto({
          cacheKey: `${selectedFileTarget.workspaceRoot}:${artifactImportKind}:${selectedFileTarget.relativePath}`,
          contentsBase64: binaryResponse.contentsBase64,
          importKind: artifactImportKind,
        })
      : null;
    return {
      kind: "ready",
      binaryContents,
      file,
      workbookProto,
    };
  }

  const file = await readWorkspaceFile({
    workspaceRoot: selectedFileTarget.workspaceRoot,
    relativePath: selectedFileTarget.relativePath,
  });
  return {
    kind: "ready",
    binaryContents: null,
    file,
    workbookProto: null,
  };
}

function buildWorkspaceFileDocumentFromMetadata(
  selectedFileTarget: WorkspaceFilePreviewTarget,
  fileMetadata: WorkspaceFileMetadata,
): WorkspaceFileDocument {
  return {
    contents: null,
    isBinary: true,
    mimeType: fileMetadata.mimeType,
    name: selectedFileTarget.name,
    path: selectedFileTarget.path,
    relativePath: selectedFileTarget.relativePath,
  };
}

function WorkspaceFilePreviewShell({
  children,
  omitHeader = false,
  title,
}: {
  children: ReactNode;
  omitHeader?: boolean;
  title: string;
}) {
  return (
    <div className="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-full flex-col bg-token-main-surface-primary">
      {omitHeader ? null : (
        <div className="border-b border-token-border px-3 py-2 text-sm font-medium text-token-text-primary">{title}</div>
      )}
      {children}
    </div>
  );
}

function ArtifactPreviewStatus({
  kind,
  t,
}: {
  kind: "loading" | "error";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
      {kind === "loading" ? (
        <span className="loading-shimmer-pure-text font-medium">{t("artifactTab.previewLoading")}</span>
      ) : (
        t("artifactTab.previewError")
      )}
    </div>
  );
}

function TooLargePreviewState({
  t,
}: {
  sizeBytes: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-token-description-foreground">
      <span>{t("artifactTab.previewTooLarge")}</span>
    </div>
  );
}

function UnsupportedPreviewState({
  unsupportedKind,
  t,
}: {
  unsupportedKind: WorkspaceFileUnsupportedPreviewKind;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-token-description-foreground">
      <span>{t(getWorkspaceFileUnsupportedMessageKey(unsupportedKind))}</span>
      <span className="text-xs">{t("review.fileSource.unsupportedDetail")}</span>
    </div>
  );
}

function getWorkspaceFilePreviewTitle(file: Pick<WorkspaceFileDocument | WorkspaceFilePreviewTarget, "name" | "path" | "relativePath">) {
  const sourcePath = file.relativePath || file.name || file.path;
  return sourcePath.split(/[\\/]+/).at(-1) ?? sourcePath;
}

function decodeBase64ToBytes(contentsBase64: string) {
  if (typeof window === "undefined") {
    return Uint8Array.from(Buffer.from(contentsBase64, "base64"));
  }

  const binaryString = window.atob(contentsBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}
