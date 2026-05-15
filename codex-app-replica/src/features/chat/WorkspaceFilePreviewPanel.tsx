import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyPathIcon,
  FolderIcon,
  MoreActionsIcon,
  PencilIcon,
  WorkspaceFileIcon,
  WordDiffsDisabledIcon,
  WordDiffsEnabledIcon,
} from "../../components/AppShellIcons";
import { useReplicaStatsigGateValue } from "../statsig/replicaStatsig";
import type { MessageKey } from "../../i18n/messages";
import type {
  ThreadConversation,
  ThreadConversationUserComment,
  ThreadConversationUserInputComment,
} from "../../services/history";
import { compileLatexArtifact, openFile } from "../../services/hostFiles";
import type { BrowserSidebarTarget } from "../../services/browserSidebar";
import {
  readWorkspaceFile,
  readWorkspaceFileBinary,
  readWorkspaceFileMetadata,
  type WorkspaceFileDocument,
  type WorkspaceFileMetadata,
  type WorkspaceFilePreviewTarget,
} from "../../services/workspaceFiles";
import { PdbPreview } from "./PdbPreview";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import { PresentationPreviewPanel } from "./PresentationPreviewPanel";
import { PdfPreviewPanel } from "./PdfPreviewPanel";
import { WorkbookPreviewPanel } from "./WorkbookPreviewPanel";
import { NotebookPreviewPanel } from "./NotebookPreviewPanel";
import {
  loadArtifactPreviewProto,
  type ParsedArtifactPreview,
  type WorkspaceFileParsedArtifactImportKind,
} from "./workbookPreviewLoader";
import {
  type WorkspaceFileArtifactImportKind,
  getWorkspaceFileArtifactImportKind,
  getWorkspaceFileUnsupportedMessageKey,
  getWorkspaceFileUnsupportedPreviewKind,
  isWorkspaceFileWorkbookImportKind,
  isWorkspaceFilePdbPreview,
  normalizePreviewText,
  supportsWorkspaceFileArtifactSourceView,
  type WorkspaceFilePreviewState,
  type WorkspaceFileUnsupportedPreviewKind,
  getBreadcrumbSegments,
} from "./workspaceFilePreviewUtils";
import { DocxPreviewPanel } from "./DocxPreviewPanel";
import { WorkspaceFileTreePanel } from "./WorkspaceFileTreePanel";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";

type WorkspaceFilePreviewPanelProps = {
  onOpenBrowserTarget?: ((target: BrowserSidebarTarget) => void) | null;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onSelectWorkspaceFile?: ((file: WorkspaceFilePreviewTarget) => void) | null;
  onSubmitPdfComment?: ((comment: ThreadConversationUserInputComment) => Promise<void>) | null;
  pendingPdfComments?: PendingPdfCommentAttachment[];
  selectedFileTarget: WorkspaceFilePreviewTarget;
  tabId?: string | null;
  threadConversation?: ThreadConversation | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type WorkspaceFilePreviewReadyState =
  | {
      kind: "ready";
      parsedArtifact: ParsedArtifactPreview | null;
      binaryContents: Uint8Array | null;
      compiledPdfDataUrl: string | null;
      file: WorkspaceFileDocument;
    }
  | Extract<WorkspaceFilePreviewState, { kind: "unsupported" | "tooLarge" | "error" | "loading" }>;

const ARTIFACT_PREVIEW_POPCORN_GATE = "839469903";
const ARTIFACT_PREVIEW_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200] as const;

type ArtifactPreviewHeaderFitOption = {
  label: string;
  onSelect: () => void;
  selected: boolean;
};

type ArtifactPreviewHeaderZoomControlProps = {
  fitOption?: ArtifactPreviewHeaderFitOption | null;
  onZoomPercentChange: (zoomPercent: number) => void;
  triggerTestId: string;
  zoomPercent: number;
};

export function WorkspaceFilePreviewPanel({
  onOpenBrowserTarget = null,
  onPendingPdfCommentsChange = null,
  onSelectWorkspaceFile = null,
  onSubmitPdfComment = null,
  pendingPdfComments = [],
  selectedFileTarget,
  tabId = null,
  threadConversation = null,
  t,
}: WorkspaceFilePreviewPanelProps) {
  const [artifactRichPreviewEnabled, setArtifactRichPreviewEnabled] = useState(true);
  const [previewState, setPreviewState] = useState<WorkspaceFilePreviewReadyState>({ kind: "loading" });
  const previewTitle = getWorkspaceFilePreviewTitle(selectedFileTarget);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);
  const [preferredEditorTarget, setPreferredEditorTarget] = useState<string | null>(null);
  const artifactPreviewGateEnabled = useReplicaStatsigGateValue(ARTIFACT_PREVIEW_POPCORN_GATE);

  useEffect(() => {
    let cancelled = false;
    setPreviewState({ kind: "loading" });

    void loadWorkspaceFilePreviewState(
      selectedFileTarget,
      artifactRichPreviewEnabled,
      artifactPreviewGateEnabled,
    )
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
  }, [
    artifactPreviewGateEnabled,
    artifactRichPreviewEnabled,
    selectedFileTarget.relativePath,
    selectedFileTarget.workspaceRoot,
  ]);

  useEffect(() => {
    setIsFileTreeOpen(false);
  }, [selectedFileTarget.relativePath, selectedFileTarget.workspaceRoot]);

  useEffect(() => {
    setArtifactRichPreviewEnabled(true);
  }, [selectedFileTarget.relativePath, selectedFileTarget.workspaceRoot]);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === "undefined") {
      setPreferredEditorTarget(null);
      return () => {
        cancelled = true;
      };
    }

    void import("../../services/openTargets")
      .then(({ readOpenInTargets }) =>
        readOpenInTargets({
          cwd: selectedFileTarget.workspaceRoot,
          hostId: selectedFileTarget.hostId ?? null,
          path: selectedFileTarget.path,
        }),
      )
      .then((response) => {
        if (cancelled) {
          return;
        }

        const preferredTarget =
          response.preferredTarget ??
          response.targets.find((target) => target.default)?.target ??
          response.availableTargets[0] ??
          null;
        setPreferredEditorTarget(preferredTarget);
      })
      .catch(() => {
        if (!cancelled) {
          setPreferredEditorTarget(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileTarget.hostId, selectedFileTarget.path, selectedFileTarget.workspaceRoot]);

  return (
    <WorkspaceFilePreviewSurface
      onOpenBrowserTarget={onOpenBrowserTarget}
      onPendingPdfCommentsChange={onPendingPdfCommentsChange}
      onSelectWorkspaceFile={onSelectWorkspaceFile}
      onSubmitPdfComment={onSubmitPdfComment}
      pendingPdfComments={pendingPdfComments}
      preferredEditorTarget={preferredEditorTarget}
      previewState={previewState}
      previewTitle={previewTitle}
      selectedFileTarget={selectedFileTarget}
      showFileTree={isFileTreeOpen}
      tabId={tabId}
      threadConversation={threadConversation}
      artifactRichPreviewEnabled={artifactRichPreviewEnabled}
      artifactPreviewGateEnabled={artifactPreviewGateEnabled}
      setArtifactRichPreviewEnabled={setArtifactRichPreviewEnabled}
      toggleFileTree={() => {
        setIsFileTreeOpen((current) => !current);
      }}
      t={t}
    />
  );
}

export function WorkspaceFilePreviewContent({
  artifactPreviewGateEnabled = null,
  binaryContents = null,
  compiledPdfDataUrl = null,
  file,
  ownerShellContext = null,
  parsedArtifact = null,
  selectedFileTarget = null,
  t,
}: {
  artifactPreviewGateEnabled?: boolean | null;
  binaryContents?: Uint8Array | null;
  compiledPdfDataUrl?: string | null;
  file: WorkspaceFileDocument;
  ownerShellContext?: WorkspaceFilePreviewOwnerShellContext | null;
  parsedArtifact?: ParsedArtifactPreview | null;
  selectedFileTarget?: WorkspaceFilePreviewTarget | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const previewTitle = getWorkspaceFilePreviewTitle(file);
  return (
    <WorkspaceFilePreviewSurface
      artifactPreviewGateEnabled={artifactPreviewGateEnabled}
      onOpenBrowserTarget={ownerShellContext?.onOpenBrowserTarget ?? null}
      onPendingPdfCommentsChange={ownerShellContext?.onPendingPdfCommentsChange ?? null}
      onSelectWorkspaceFile={ownerShellContext?.onSelectWorkspaceFile ?? null}
      onSubmitPdfComment={ownerShellContext?.onSubmitPdfComment ?? null}
      pendingPdfComments={ownerShellContext?.pendingPdfComments ?? []}
      preferredEditorTarget={ownerShellContext?.preferredEditorTarget ?? null}
      previewState={{
        parsedArtifact,
        kind: "ready",
        binaryContents,
        compiledPdfDataUrl,
        file,
      }}
      previewTitle={previewTitle}
      selectedFileTarget={selectedFileTarget}
      showFileTree={ownerShellContext?.showFileTree ?? false}
      tabId={ownerShellContext?.tabId ?? null}
      threadConversation={ownerShellContext?.threadConversation ?? null}
      artifactRichPreviewEnabled={ownerShellContext?.artifactRichPreviewEnabled ?? true}
      setArtifactRichPreviewEnabled={ownerShellContext?.setArtifactRichPreviewEnabled ?? null}
      toggleFileTree={ownerShellContext?.toggleFileTree ?? null}
      t={t}
    />
  );
}

export function WorkspaceFilePreviewStateContent({
  artifactPreviewGateEnabled = null,
  ownerShellContext = null,
  previewState,
  previewTitle,
  selectedFileTarget = null,
  t,
}: {
  artifactPreviewGateEnabled?: boolean | null;
  ownerShellContext?: WorkspaceFilePreviewOwnerShellContext | null;
  previewState: WorkspaceFilePreviewReadyState;
  previewTitle: string;
  selectedFileTarget?: WorkspaceFilePreviewTarget | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <WorkspaceFilePreviewSurface
      artifactPreviewGateEnabled={artifactPreviewGateEnabled}
      onOpenBrowserTarget={ownerShellContext?.onOpenBrowserTarget ?? null}
      onPendingPdfCommentsChange={ownerShellContext?.onPendingPdfCommentsChange ?? null}
      onSelectWorkspaceFile={ownerShellContext?.onSelectWorkspaceFile ?? null}
      onSubmitPdfComment={ownerShellContext?.onSubmitPdfComment ?? null}
      pendingPdfComments={ownerShellContext?.pendingPdfComments ?? []}
      preferredEditorTarget={ownerShellContext?.preferredEditorTarget ?? null}
      previewState={previewState}
      previewTitle={previewTitle}
      selectedFileTarget={selectedFileTarget}
      showFileTree={ownerShellContext?.showFileTree ?? false}
      tabId={ownerShellContext?.tabId ?? null}
      threadConversation={ownerShellContext?.threadConversation ?? null}
      artifactRichPreviewEnabled={ownerShellContext?.artifactRichPreviewEnabled ?? true}
      setArtifactRichPreviewEnabled={ownerShellContext?.setArtifactRichPreviewEnabled ?? null}
      toggleFileTree={ownerShellContext?.toggleFileTree ?? null}
      t={t}
    />
  );
}

type WorkspaceFilePreviewOwnerShellContext = {
  onOpenBrowserTarget?: ((target: BrowserSidebarTarget) => void) | null;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onSelectWorkspaceFile?: ((file: WorkspaceFilePreviewTarget) => void) | null;
  onSubmitPdfComment?: ((comment: ThreadConversationUserInputComment) => Promise<void>) | null;
  pendingPdfComments?: PendingPdfCommentAttachment[];
  preferredEditorTarget?: string | null;
  showFileTree?: boolean;
  tabId?: string | null;
  threadConversation?: ThreadConversation | null;
  artifactRichPreviewEnabled?: boolean;
  setArtifactRichPreviewEnabled?: ((enabled: boolean) => void) | null;
  toggleFileTree?: (() => void) | null;
};

function WorkspaceFilePreviewSurface({
  artifactPreviewGateEnabled = null,
  onOpenBrowserTarget = null,
  onPendingPdfCommentsChange = null,
  onSelectWorkspaceFile = null,
  onSubmitPdfComment = null,
  pendingPdfComments = [],
  preferredEditorTarget,
  previewState,
  previewTitle,
  selectedFileTarget,
  showFileTree,
  tabId,
  threadConversation,
  artifactRichPreviewEnabled = true,
  setArtifactRichPreviewEnabled = null,
  toggleFileTree,
  t,
}: {
  artifactPreviewGateEnabled?: boolean | null;
  onOpenBrowserTarget?: ((target: BrowserSidebarTarget) => void) | null;
  onPendingPdfCommentsChange?: ((
    update: (current: PendingPdfCommentAttachment[]) => PendingPdfCommentAttachment[],
  ) => void) | null;
  onSelectWorkspaceFile?: ((file: WorkspaceFilePreviewTarget) => void) | null;
  onSubmitPdfComment?: ((comment: ThreadConversationUserInputComment) => Promise<void>) | null;
  pendingPdfComments?: PendingPdfCommentAttachment[];
  preferredEditorTarget: string | null;
  previewState: WorkspaceFilePreviewReadyState;
  previewTitle: string;
  selectedFileTarget: WorkspaceFilePreviewTarget | null;
  showFileTree: boolean;
  tabId: string | null;
  threadConversation: ThreadConversation | null;
  artifactRichPreviewEnabled?: boolean;
  setArtifactRichPreviewEnabled?: ((enabled: boolean) => void) | null;
  toggleFileTree: (() => void) | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const resolvedArtifactPreviewGateEnabled =
    artifactPreviewGateEnabled ?? useReplicaStatsigGateValue(ARTIFACT_PREVIEW_POPCORN_GATE);
  const hidePresentationSpeakerNotes = resolvedArtifactPreviewGateEnabled;
  const fallbackPreviewPath = previewState.kind === "ready" ? previewState.file.relativePath || previewState.file.path : previewTitle;
  const previewPath =
    selectedFileTarget == null
      ? fallbackPreviewPath
      : buildBreadcrumbPath(selectedFileTarget.workspaceRoot, selectedFileTarget.relativePath) ?? fallbackPreviewPath;
  const previewDescriptor =
    selectedFileTarget == null
      ? previewState.kind === "ready"
        ? {
            mimeType: previewState.file.mimeType,
            name: previewState.file.name,
            path: previewState.file.path,
            relativePath: previewState.file.relativePath,
          }
        : null
      : {
          mimeType: previewState.kind === "ready" ? previewState.file.mimeType : null,
          name: selectedFileTarget.name,
          path: selectedFileTarget.path,
          relativePath: selectedFileTarget.relativePath,
        };
  const selectedArtifactImportKind =
    previewDescriptor == null ? null : getWorkspaceFileArtifactImportKind(previewDescriptor);
  const supportsSelectedArtifactSourceView = supportsWorkspaceFileArtifactSourceView(selectedArtifactImportKind);
  const canSwitchArtifactPreviewMode =
    selectedFileTarget != null &&
    tabId != null &&
    setArtifactRichPreviewEnabled != null &&
    supportsSelectedArtifactSourceView;
  const previewHostId =
    selectedFileTarget?.hostId ?? (previewState.kind === "ready" ? previewState.file.hostId ?? null : null);
  const previewAbsolutePath =
    selectedFileTarget?.path ?? (previewState.kind === "ready" ? previewState.file.path : previewTitle);
  const workspaceRoot = selectedFileTarget?.workspaceRoot ?? null;
  const openInEditorAction =
    preferredEditorTarget == null
      ? null
      : () => {
          void openFile({
            cwd: workspaceRoot,
            hostId: previewHostId,
            path: previewAbsolutePath,
            target: preferredEditorTarget,
          });
        };
  const canToggleFileTree =
    workspaceRoot !== null && onSelectWorkspaceFile !== null && toggleFileTree !== null && tabId !== null;
  const trailingActions = useMemo(() => {
    const actions: ReactNode[] = [];

    if (selectedFileTarget != null) {
      actions.push(
        <ArtifactPreviewOptionsMenu
          key="options"
          isRichPreviewEnabled={artifactRichPreviewEnabled}
          onToggleArtifactRichPreview={
            canSwitchArtifactPreviewMode && setArtifactRichPreviewEnabled != null
              ? () => {
                  setArtifactRichPreviewEnabled(!artifactRichPreviewEnabled);
                }
              : null
          }
          path={previewPath}
          t={t}
        />,
      );
    }

    if (openInEditorAction != null) {
      actions.push(
        <ArtifactPreviewOpenInEditorButton
          key="open-in-editor"
          onOpenInEditor={openInEditorAction}
          t={t}
        />,
      );
    }

    if (canToggleFileTree && toggleFileTree != null) {
      actions.push(
        <ArtifactPreviewOpenFilesButton
          key="open-files"
          isOpen={showFileTree}
          onClick={toggleFileTree}
        />,
      );
    }

    return actions;
  }, [
    artifactRichPreviewEnabled,
    canSwitchArtifactPreviewMode,
    canToggleFileTree,
    openInEditorAction,
    previewPath,
    selectedFileTarget,
    setArtifactRichPreviewEnabled,
    showFileTree,
    t,
    toggleFileTree,
  ]);

  const wrappedChildren = (children: ReactNode) =>
    selectedFileTarget == null ? (
      children
    ) : (
      <WorkspaceFilePreviewOwnerShell
        path={previewPath}
        previewChildren={children}
        showFileTree={showFileTree}
        setArtifactRichPreviewEnabled={setArtifactRichPreviewEnabled}
        trailingActions={trailingActions}
        workspaceRoot={workspaceRoot}
        onSelectWorkspaceFile={onSelectWorkspaceFile}
        t={t}
      />
    );

  if (previewState.kind === "loading") {
    return wrappedChildren(<ArtifactPreviewStatus kind="loading" t={t} />);
  }

  if (previewState.kind === "error") {
    return wrappedChildren(<ArtifactPreviewStatus kind="error" t={t} />);
  }

  if (previewState.kind === "tooLarge") {
    return wrappedChildren(<TooLargePreviewState sizeBytes={previewState.sizeBytes} t={t} />);
  }

  if (previewState.kind === "unsupported") {
    return wrappedChildren(<UnsupportedPreviewState unsupportedKind={previewState.unsupportedKind} t={t} />);
  }

  const { parsedArtifact, binaryContents, compiledPdfDataUrl, file } = previewState;
  const normalizedPath = (file.relativePath || file.path).toLowerCase();
  const isPdf = normalizedPath.endsWith(".pdf");
  const isPdb = isWorkspaceFilePdbPreview(file);
  const artifactImportKind = getWorkspaceFileArtifactImportKind(file);
  const isTexPdfPreview = artifactImportKind === "tex" && compiledPdfDataUrl != null;
  const normalizedContents = normalizePreviewText(file.contents ?? "");
  const shouldShowArtifactSourceViewControl = canSwitchArtifactPreviewMode && artifactRichPreviewEnabled;
  const notebookHeaderRightContent = shouldShowArtifactSourceViewControl ? (
    <ArtifactPreviewSourceOptionsMenu
      onViewSource={() => {
        setArtifactRichPreviewEnabled(false);
      }}
      t={t}
    />
  ) : undefined;
  const texHeaderRightContent = shouldShowArtifactSourceViewControl ? (
    <ArtifactPreviewSourceOptionsMenu
      onViewSource={() => {
        setArtifactRichPreviewEnabled(false);
      }}
      t={t}
    />
  ) : undefined;
  const richHeaderRightContent = (
    <>
      <ArtifactPreviewOpenButton hostId={file.hostId} path={file.path} t={t} />
      {shouldShowArtifactSourceViewControl ? (
        <ArtifactPreviewSourceOptionsMenu
          onViewSource={() => {
            setArtifactRichPreviewEnabled(false);
          }}
          t={t}
        />
      ) : null}
    </>
  );
  const renderHeaderZoomControl = useCallback(
    (params: ArtifactPreviewHeaderZoomControlProps) => (
      <ArtifactPreviewHeaderZoomControl
        fitOption={params.fitOption}
        onZoomPercentChange={params.onZoomPercentChange}
        t={t}
        triggerTestId={params.triggerTestId}
        zoomPercent={params.zoomPercent}
      />
    ),
    [t],
  );
  const isDocxPreview =
    artifactImportKind === "docx" && binaryContents != null && !resolvedArtifactPreviewGateEnabled;
  const isDocumentPreview =
    artifactImportKind === "docx" &&
    resolvedArtifactPreviewGateEnabled &&
    parsedArtifact?.kind === "document";
  const isNotebookPreview = artifactImportKind === "ipynb" && binaryContents != null;
  const richPanelOwnsHeader =
    isPdf ||
    isTexPdfPreview ||
    artifactImportKind === "docx" ||
    artifactImportKind === "ipynb" ||
    artifactImportKind === "pptx" ||
    isWorkspaceFileWorkbookImportKind(artifactImportKind);
  const pdfComments =
    previewState.kind === "ready" ? getPdfCommentsForPath(threadConversation, previewState.file.path) : [];

  return wrappedChildren(
    <WorkspaceFilePreviewShell title={previewTitle} omitHeader={richPanelOwnsHeader}>
      {isPdf ? (
        <PdfPreviewPanel
          comments={pdfComments}
          file={file}
          onPendingPdfCommentsChange={onPendingPdfCommentsChange}
          onSubmitPdfComment={onSubmitPdfComment}
          pendingPdfComments={pendingPdfComments}
          t={t}
        />
      ) : isTexPdfPreview ? (
        <PdfPreviewPanel
          comments={pdfComments}
          file={file}
          fileDataUrl={compiledPdfDataUrl}
          headerRightContent={texHeaderRightContent}
          hostId={file.hostId ?? null}
          onPendingPdfCommentsChange={onPendingPdfCommentsChange}
          onSubmitPdfComment={onSubmitPdfComment}
          pendingPdfComments={pendingPdfComments}
          path={file.path}
          t={t}
          title={previewTitle}
        />
      ) : isDocumentPreview ? (
        <DocumentPreviewPanel
          documentProto={parsedArtifact.proto}
          headerRightContent={richHeaderRightContent}
          renderHeaderZoomControl={renderHeaderZoomControl}
          title={previewTitle}
          t={t}
        />
      ) : artifactImportKind === "pptx" && parsedArtifact?.kind === "presentation" ? (
        <PresentationPreviewPanel
          headerRightContent={richHeaderRightContent}
          hideSpeakerNotes={hidePresentationSpeakerNotes}
          presentationProto={parsedArtifact.proto}
          renderHeaderZoomControl={renderHeaderZoomControl}
          title={previewTitle}
          t={t}
        />
      ) : isWorkspaceFileWorkbookImportKind(artifactImportKind) && parsedArtifact?.kind === "spreadsheet" ? (
        <WorkbookPreviewPanel
          headerRightContent={richHeaderRightContent}
          renderHeaderZoomControl={renderHeaderZoomControl}
          title={previewTitle}
          t={t}
          workbookProto={parsedArtifact.proto}
        />
      ) : isDocxPreview ? (
        <DocxPreviewPanel
          bytes={binaryContents}
          hostId={file.hostId ?? null}
          path={file.path}
          title={previewTitle}
          t={t}
        />
      ) : isNotebookPreview ? (
        <NotebookPreviewPanel
          bytes={binaryContents}
          headerRightContent={notebookHeaderRightContent}
          hostId={file.hostId}
          onOpenBrowserTarget={onOpenBrowserTarget}
          onSelectWorkspaceFile={onSelectWorkspaceFile}
          path={file.path}
          title={previewTitle}
          t={t}
          workspaceRoot={selectedFileTarget?.workspaceRoot ?? null}
        />
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
    </WorkspaceFilePreviewShell>,
  );
}

async function loadWorkspaceFilePreviewState(
  selectedFileTarget: WorkspaceFilePreviewTarget,
  artifactRichPreviewEnabled: boolean,
  artifactPreviewGateEnabled: boolean,
): Promise<WorkspaceFilePreviewReadyState> {
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
  if (artifactImportKind === "tex" && artifactRichPreviewEnabled) {
    const response = await compileLatexArtifact({
      cwd: selectedFileTarget.workspaceRoot,
      hostId: selectedFileTarget.hostId ?? null,
      path: selectedFileTarget.path,
    });
    if (response.contentsBase64 != null) {
      return {
        parsedArtifact: null,
        binaryContents: null,
        compiledPdfDataUrl: `data:application/pdf;base64,${response.contentsBase64}`,
        kind: "ready",
        file: buildWorkspaceFileDocumentFromMetadata(selectedFileTarget, fileMetadata),
      };
    }
  }

  if (artifactImportKind != null && artifactImportKind !== "tex" && artifactRichPreviewEnabled) {
    const file = buildWorkspaceFileDocumentFromMetadata(selectedFileTarget, fileMetadata);
    const binaryResponse = await readWorkspaceFileBinary({
      workspaceRoot: selectedFileTarget.workspaceRoot,
      relativePath: selectedFileTarget.relativePath,
    });
    const binaryContents = decodeBase64ToBytes(binaryResponse.contentsBase64);
    const shouldParseArtifact =
      isWorkspaceFileParsedArtifactImportKind(artifactImportKind) &&
      (artifactImportKind !== "docx" || artifactPreviewGateEnabled);
    const parsedArtifact = shouldParseArtifact
      ? await loadArtifactPreviewProto({
          cacheKey: `${selectedFileTarget.workspaceRoot}:${artifactImportKind}:${selectedFileTarget.relativePath}`,
          contentsBase64: binaryResponse.contentsBase64,
          importKind: artifactImportKind,
        })
      : null;
    return {
      parsedArtifact,
      kind: "ready",
      binaryContents,
      compiledPdfDataUrl: null,
      file,
    };
  }

  const file = await readWorkspaceFile({
    workspaceRoot: selectedFileTarget.workspaceRoot,
    relativePath: selectedFileTarget.relativePath,
  });
  return {
    parsedArtifact: null,
    kind: "ready",
    binaryContents: null,
    compiledPdfDataUrl: null,
    file: {
      ...file,
      hostId: selectedFileTarget.hostId ?? file.hostId ?? null,
    },
  };
}

function buildWorkspaceFileDocumentFromMetadata(
  selectedFileTarget: WorkspaceFilePreviewTarget,
  fileMetadata: WorkspaceFileMetadata,
): WorkspaceFileDocument {
  return {
    contents: null,
    hostId: selectedFileTarget.hostId ?? null,
    isBinary: true,
    mimeType: fileMetadata.mimeType,
    name: selectedFileTarget.name,
    path: selectedFileTarget.path,
    relativePath: selectedFileTarget.relativePath,
  };
}

function isWorkspaceFileParsedArtifactImportKind(
  artifactImportKind: WorkspaceFileArtifactImportKind | null,
): artifactImportKind is WorkspaceFileParsedArtifactImportKind {
  return artifactImportKind === "docx" || artifactImportKind === "pptx" || isWorkspaceFileWorkbookImportKind(artifactImportKind);
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

function WorkspaceFilePreviewOwnerShell({
  onSelectWorkspaceFile,
  path,
  previewChildren,
  showFileTree,
  setArtifactRichPreviewEnabled,
  trailingActions,
  workspaceRoot,
  t,
}: {
  onSelectWorkspaceFile?: ((file: WorkspaceFilePreviewTarget) => void) | null;
  path: string;
  previewChildren: ReactNode;
  showFileTree: boolean;
  setArtifactRichPreviewEnabled?: ((enabled: boolean) => void) | null;
  trailingActions: ReactNode[];
  workspaceRoot: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-token-main-surface-primary">
      <WorkspaceFilePreviewBreadcrumb path={path} trailingActions={trailingActions} t={t} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">{previewChildren}</div>
        {showFileTree && workspaceRoot !== null && onSelectWorkspaceFile != null ? (
          <div className="h-full w-[320px] shrink-0 border-l border-token-border bg-token-main-surface-primary">
            <WorkspaceFileTreePanel
              workspaceRoot={workspaceRoot}
              onSelectWorkspaceFile={onSelectWorkspaceFile}
              t={t}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceFilePreviewBreadcrumb({
  path,
  trailingActions,
  t,
}: {
  path: string;
  trailingActions: ReactNode[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const segments = getBreadcrumbSegments(path);
  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={t("review.fileSource.breadcrumb.ariaLabel")}
      className="group flex h-toolbar-pane shrink-0 items-center border-b border-token-border-default bg-token-main-surface-primary px-2"
    >
      <div className="hide-scrollbar flex min-w-0 flex-1 flex-row-reverse items-center overflow-x-auto px-2">
        <ol className="flex flex-1 items-center gap-1 text-xs text-token-text-secondary">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <li key={`${index}:${segment}`} className="flex shrink-0 items-center gap-1">
                <span className={isLast ? "font-medium whitespace-nowrap text-token-text-primary" : "whitespace-nowrap"}>
                  {segment}
                </span>
                {isLast ? null : <ChevronDownIcon aria-hidden="true" className="icon-2xs shrink-0 -rotate-90 text-token-text-tertiary" />}
              </li>
            );
          })}
        </ol>
      </div>
      {trailingActions.length > 0 ? <div className="ml-2 flex shrink-0 items-center gap-px">{trailingActions}</div> : null}
    </nav>
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

function ArtifactPreviewOpenButton({
  hostId,
  path,
  t,
}: {
  hostId?: string | null;
  path: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <Button
      aria-label={t("artifactTab.preview.open")}
      className="shrink-0 rounded-md !border-token-border-default bg-token-main-surface-primary text-sm text-token-text-primary hover:text-token-text-primary"
      color="outline"
      size="toolbar"
      onClick={() => {
        void openFile({
          cwd: null,
          hostId: hostId ?? null,
          path,
          target: "fileManager",
        });
      }}
    >
      <span>{t("artifactTab.preview.open")}</span>
    </Button>
  );
}

function ArtifactPreviewOpenInEditorButton({
  onOpenInEditor,
  t,
}: {
  onOpenInEditor: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <Button
      aria-label={t("review.fileSource.breadcrumb.openInEditor.ariaLabel")}
      title={t("review.fileSource.breadcrumb.openInEditor.tooltip")}
      color="ghost"
      size="toolbar"
      uniform
      onClick={onOpenInEditor}
    >
      <PencilIcon className="icon-sm" />
    </Button>
  );
}

function ArtifactPreviewOptionsMenu({
  isRichPreviewEnabled = true,
  onToggleArtifactRichPreview = null,
  path,
  t,
}: {
  isRichPreviewEnabled?: boolean;
  onToggleArtifactRichPreview?: (() => void) | null;
  path: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("review.fileSource.options")}
        color="ghost"
        size="toolbar"
        title={t("review.fileSource.options")}
        uniform
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <MoreActionsIcon className="icon-sm" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <button
            type="button"
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard?.writeText != null) {
                void navigator.clipboard.writeText(path).catch(() => {});
              }
              setIsOpen(false);
            }}
          >
            <CopyPathIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
            <span>{t("review.fileSource.copyPath")}</span>
          </button>
          {onToggleArtifactRichPreview != null ? (
            <button
              type="button"
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
              onClick={() => {
                onToggleArtifactRichPreview();
                setIsOpen(false);
              }}
            >
              {isRichPreviewEnabled ? (
                <WordDiffsDisabledIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
              ) : (
                <WordDiffsEnabledIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
              )}
              <span>
                {isRichPreviewEnabled
                  ? t("review.fileSource.richPreview.disable")
                  : t("review.fileSource.richPreview.enable")}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ArtifactPreviewSourceOptionsMenu({
  onViewSource,
  t,
}: {
  onViewSource: () => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("artifactTab.sourceOptions")}
        color="ghost"
        size="toolbar"
        uniform
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <MoreActionsIcon className="icon-sm" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <button
            type="button"
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            onClick={() => {
              onViewSource();
              setIsOpen(false);
            }}
          >
            <WorkspaceFileIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-muted)]" />
            <span>{t("artifactTab.sourceOptions.viewSource")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ArtifactPreviewOpenFilesButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="ms-auto"
      color={isOpen ? "secondary" : "ghost"}
      size="toolbar"
      uniform
      onClick={onClick}
    >
      <FolderIcon className="icon-sm" />
    </Button>
  );
}

function ArtifactPreviewHeaderZoomControl({
  fitOption = null,
  onZoomPercentChange,
  t,
  triggerTestId,
  zoomPercent,
}: ArtifactPreviewHeaderZoomControlProps & {
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isFitOptionSelected = fitOption?.selected === true;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="shrink-0 gap-1 rounded-md px-1.5 text-sm"
        color="ghost"
        data-testid={triggerTestId}
        size="toolbar"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        <span className="tabular-nums">{t("artifactTab.preview.zoomPercent", { zoomPercent })}</span>
        <ChevronDownIcon className="icon-2xs" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[168px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="space-y-1">
            {ARTIFACT_PREVIEW_ZOOM_OPTIONS.map((option) => {
              const isSelected = !isFitOptionSelected && option === zoomPercent;
              return (
                <button
                  key={option}
                  type="button"
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                  onClick={() => {
                    onZoomPercentChange(option);
                    setIsOpen(false);
                  }}
                >
                  <span>{t("artifactTab.preview.zoomPercent", { zoomPercent: option })}</span>
                  {isSelected ? <CheckIcon className="icon-2xs" /> : null}
                </button>
              );
            })}
            {fitOption != null ? (
              <>
                <div className="my-1 h-px bg-[var(--app-shell-border)]" />
                <button
                  type="button"
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isFitOptionSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                  onClick={() => {
                    fitOption.onSelect();
                    setIsOpen(false);
                  }}
                >
                  <span>{fitOption.label}</span>
                  {isFitOptionSelected ? <CheckIcon className="icon-2xs" /> : null}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildBreadcrumbPath(workspaceRoot: string, relativePath: string) {
  const normalizedRoot = workspaceRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  const normalizedRelativePath = relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
  const rootLabel = normalizedRoot.split("/").filter((segment) => segment.length > 0).at(-1) ?? normalizedRoot;
  if (normalizedRoot.length === 0) {
    return normalizedRelativePath;
  }
  if (normalizedRelativePath.length === 0) {
    return rootLabel;
  }
  return `${rootLabel}/${normalizedRelativePath}`;
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

function getPdfCommentsForPath(
  threadConversation: ThreadConversation | null,
  filePath: string,
): ThreadConversationUserComment[] {
  if (threadConversation == null) {
    return [];
  }

  const normalizedFilePath = normalizeWorkspacePreviewPath(filePath);
  return threadConversation.items.flatMap((item) => {
    if (item.type !== "userMessage" || !Array.isArray(item.comments)) {
      return [];
    }

    return item.comments.filter((comment) => {
      const commentPath = comment.localPdfContext?.path;
      return commentPath != null && normalizeWorkspacePreviewPath(commentPath) === normalizedFilePath;
    });
  });
}

function normalizeWorkspacePreviewPath(pathValue: string) {
  return pathValue.replaceAll("/", "\\").toLowerCase();
}
