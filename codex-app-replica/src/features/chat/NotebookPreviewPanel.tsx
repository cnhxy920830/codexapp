import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { CheckIcon, ChevronDownIcon, CopyPathIcon, RefreshIcon } from "../../components/AppShellIcons";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import type { MarkdownFileLinkReference } from "../../components/markdownLinkTypes";
import type { MessageKey } from "../../i18n/messages";
import { readAppsSnapshot, type AppInfo } from "../../services/apps";
import type { BrowserSidebarTarget } from "../../services/browserSidebar";
import { openFile } from "../../services/hostFiles";
import { readPluginsSnapshot, type PluginSummary } from "../../services/plugins";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import type { WorkspaceFilePreviewTarget } from "../../services/workspaceFiles";
import { resolveNotebookWorkspaceFileLinkTarget } from "./notebookFileLinks";

type NotebookPreviewPanelProps = {
  bytes: Uint8Array;
  headerRightContent?: ReactNode;
  hostId?: string | null;
  onOpenBrowserTarget?: ((target: BrowserSidebarTarget) => void) | null;
  onSelectWorkspaceFile?: ((file: WorkspaceFilePreviewTarget) => void) | null;
  path: string;
  title: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  workspaceRoot?: string | null;
};

type NotebookDocument = {
  cells: NotebookCell[];
  title: string | null;
};

type NotebookMarkdownContext = {
  apps: AppInfo[];
  canOpenFileLinkInSidePanel: (fileReference: MarkdownFileLinkReference) => boolean;
  cwd: string | null;
  hostId: string | null;
  onExternalLinkOpenInBrowser: (href: string) => void;
  onFileLinkOpen: (fileReference: MarkdownFileLinkReference) => void;
  onFileLinkOpenInBrowser: (fileReference: MarkdownFileLinkReference) => void;
  plugins: PluginSummary[];
  skills: SkillSummary[];
};

type NotebookCell =
  | {
      cellType: "markdown" | "raw";
      id: string | null;
      source: string;
      title: string | null;
    }
  | {
      cellType: "code";
      descriptionMarkdown: string | null;
      executionCount: number | null;
      id: string | null;
      outputs: NotebookOutput[];
      source: string;
      title: string | null;
    };

type NotebookOutput =
  | {
      dataUrl: string;
      outputNumber: number;
      type: "image";
    }
  | {
      html: string;
      type: "html";
    }
  | {
      markdown: string;
      type: "markdown";
    }
  | {
      summaryMarkdown: string | null;
      text: string;
      type: "json" | "stream" | "text";
    }
  | {
      ename: string;
      evalue: string;
      summaryMarkdown: string | null;
      traceback: string;
      type: "error";
    };

type NotebookParseState =
  | {
      document: NotebookDocument;
      kind: "ready";
    }
  | {
      kind: "error";
    };

const NOTEBOOK_METADATA_ROOT_KEYS = ["codex", "codexNotebook", "codex_notebook", "codex-app"] as const;
const NOTEBOOK_TITLE_KEYS = ["title", "cellTitle", "cell_title"] as const;
const NOTEBOOK_DESCRIPTION_KEYS = [
  "codeDescriptionMarkdown",
  "code_description_markdown",
  "descriptionMarkdown",
  "description_markdown",
  "description",
] as const;

const HTML_OUTPUT_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
].join("; ");

export function NotebookPreviewPanel({
  bytes,
  headerRightContent,
  hostId = null,
  onOpenBrowserTarget = null,
  onSelectWorkspaceFile = null,
  path,
  title,
  t,
  workspaceRoot = null,
}: NotebookPreviewPanelProps) {
  const parseState = useMemo(() => parseNotebookBytes(bytes), [bytes]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const notebookCwd = useMemo(() => getParentDirectoryPath(path), [path]);
  const resolveNotebookFileTarget = useMemo(
    () =>
      (fileReference: MarkdownFileLinkReference) =>
        resolveNotebookWorkspaceFileLinkTarget({
          fileReference,
          hostId,
          notebookCwd,
          workspaceRoot,
        }),
    [hostId, notebookCwd, workspaceRoot],
  );
  const markdownContext = useMemo<NotebookMarkdownContext>(
    () => ({
      apps,
      canOpenFileLinkInSidePanel: (fileReference) => onSelectWorkspaceFile != null && resolveNotebookFileTarget(fileReference) != null,
      cwd: notebookCwd,
      hostId,
      onExternalLinkOpenInBrowser: (href) => {
        if (onOpenBrowserTarget == null) {
          return;
        }

        onOpenBrowserTarget({
          kind: "url",
          url: href,
        });
      },
      onFileLinkOpen: (fileReference) => {
        const fileTarget = resolveNotebookFileTarget(fileReference);
        if (fileTarget != null) {
          onSelectWorkspaceFile?.(fileTarget);
        }
      },
      onFileLinkOpenInBrowser: (fileReference) => {
        if (onOpenBrowserTarget == null || !isNotebookBrowserViewablePath(fileReference.path, hostId)) {
          return;
        }

        onOpenBrowserTarget({
          kind: "file",
          cwd: notebookCwd,
          hostId,
          path: fileReference.path,
        });
      },
      plugins,
      skills,
    }),
    [apps, hostId, notebookCwd, onOpenBrowserTarget, onSelectWorkspaceFile, plugins, resolveNotebookFileTarget, skills],
  );
  const displayTitle =
    parseState.kind === "ready" ? parseState.document.title ?? stripIpynbExtension(title) : stripIpynbExtension(title);
  const artifactType =
    parseState.kind === "ready"
      ? `IPYNB \u00b7 ${t("notebookPreview.cellCount", { cellCount: parseState.document.cells.length })}`
      : "IPYNB";

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      readAppsSnapshot({ hostId }).then((response) => response.data).catch(() => []),
      readPluginsSnapshot(notebookCwd, hostId)
        .then((response) => response.marketplaces.flatMap((marketplace) => marketplace.plugins))
        .catch(() => []),
      readSkillsSnapshot(notebookCwd, { hostId }).catch(() => []),
    ]).then(([nextApps, nextPlugins, nextSkills]) => {
      if (cancelled) {
        return;
      }

      setApps(nextApps);
      setPlugins(nextPlugins);
      setSkills(nextSkills);
    });

    return () => {
      cancelled = true;
    };
  }, [hostId, notebookCwd]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-token-side-bar-background">
      <header className="@container grid h-toolbar-pane shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 overflow-hidden border-b border-token-border-light bg-token-main-surface-primary pr-2 pl-4 [@container_(max-width:260px)]:grid-cols-[0_auto_auto] [@container_(max-width:260px)]:gap-1 [@container_(max-width:260px)]:pl-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <h2 className="truncate text-sm leading-5 font-medium tracking-[-0.18px] text-token-text-primary [@container_(max-width:260px)]:hidden">
            {displayTitle}
          </h2>
          <span className="shrink-0 text-sm leading-5 text-token-text-tertiary [@container_(max-width:360px)]:hidden">
            {artifactType}
          </span>
        </div>
        <div className="min-w-0 justify-self-center" />
        <div className="flex min-w-0 justify-end overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 overflow-hidden">
            {parseState.kind === "ready" ? (
              <>
                <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-token-border-light bg-token-main-surface-secondary/30 px-2 text-xs font-medium text-token-text-tertiary">
                  {t("notebookPreview.readOnlyBadge")}
                </span>
                <DisabledNotebookAction label={t("notebookPreview.runAllDisabledTooltip")}>
                  <NotebookPlaySmallIcon className="icon-2xs" />
                  <span className="hidden md:inline">{t("notebookPreview.runAllDisabled")}</span>
                </DisabledNotebookAction>
                <DisabledNotebookAction label={t("notebookPreview.restartKernelDisabledTooltip")}>
                  <RefreshIcon className="icon-2xs" />
                  <span className="hidden lg:inline">{t("notebookPreview.restartKernelDisabled")}</span>
                </DisabledNotebookAction>
              </>
            ) : null}
            <Button
              aria-label={t("artifactTab.preview.open")}
              className="shrink-0 rounded-md !border-token-border-default bg-token-main-surface-primary text-sm text-token-text-primary hover:text-token-text-primary"
              color="outline"
              size="toolbar"
              onClick={() => {
                void openFile({
                  cwd: null,
                  hostId,
                  path,
                  target: "fileManager",
                });
              }}
            >
              <span>{t("artifactTab.preview.open")}</span>
            </Button>
            {headerRightContent}
          </div>
        </div>
      </header>
      {parseState.kind === "ready" ? (
        <NotebookBody document={parseState.document} markdownContext={markdownContext} t={t} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
          {t("artifactTab.previewError")}
        </div>
      )}
    </section>
  );
}

function DisabledNotebookAction({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      aria-disabled
      className="inline-flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md px-2 text-xs font-medium text-token-text-tertiary/70"
      disabled
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function NotebookBody({
  document,
  markdownContext,
  t,
}: {
  document: NotebookDocument;
  markdownContext: NotebookMarkdownContext;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (document.cells.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-token-text-tertiary">
        {t("notebookPreview.empty")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-token-side-bar-background px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {document.cells.map((cell, index) => (
          <NotebookCellPanel
            key={cell.id ?? index}
            cell={cell}
            cellNumber={index + 1}
            markdownContext={markdownContext}
            t={t}
            totalCellCount={document.cells.length}
          />
        ))}
      </div>
    </div>
  );
}

function NotebookCellPanel({
  cell,
  cellNumber,
  markdownContext,
  t,
  totalCellCount,
}: {
  cell: NotebookCell;
  cellNumber: number;
  markdownContext: NotebookMarkdownContext;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  totalCellCount: number;
}) {
  const cellTitle = getNotebookCellTitle(cell, cellNumber, t);

  return (
    <details className="group/notebook-cell overflow-hidden rounded-lg border border-token-border-light bg-token-main-surface-primary" open>
      <summary className="flex cursor-interaction list-none items-center justify-between gap-3 border-b border-token-border-light px-4 py-2 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDownIcon className="icon-2xs shrink-0 -rotate-90 text-token-text-tertiary transition-transform duration-300 group-open/notebook-cell:rotate-0" />
          <div className="min-w-0 truncate text-sm font-medium text-token-text-primary" title={cellTitle}>
            {cellTitle}
          </div>
          <span className="shrink-0 text-xs text-token-text-tertiary">
            {t("notebookPreview.cellPosition", { cellNumber, totalCellCount })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-token-text-tertiary">
          {cell.cellType === "code" && cell.executionCount != null ? (
            <span className="tabular-nums">{t("notebookPreview.executionCount", { executionCount: cell.executionCount })}</span>
          ) : null}
          {cell.cellType === "code" ? (
            <span
              aria-hidden
              className="pointer-events-none inline-flex opacity-0 transition-opacity duration-150 group-focus-within/notebook-cell:opacity-60 group-hover/notebook-cell:opacity-60"
              title={t("notebookPreview.runCellDisabledTooltip")}
            >
              <NotebookPlaySmallIcon className="icon-2xs" />
            </span>
          ) : null}
        </div>
      </summary>
      <NotebookCellContents cell={cell} markdownContext={markdownContext} t={t} />
    </details>
  );
}

function NotebookCellContents({
  cell,
  markdownContext,
  t,
}: {
  cell: NotebookCell;
  markdownContext: NotebookMarkdownContext;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (cell.cellType === "markdown") {
    return (
      <div className="px-4 py-3">
        {cell.source.trim().length === 0 ? (
          <NotebookEmptyBox>{t("notebookPreview.emptyMarkdownCell")}</NotebookEmptyBox>
        ) : (
          <NotebookMarkdown markdownContext={markdownContext} text={cell.source} t={t} />
        )}
      </div>
    );
  }

  if (cell.cellType === "raw") {
    return (
      <div className="px-4 py-3">
        {cell.source.trim().length === 0 ? (
          <NotebookEmptyBox>{t("notebookPreview.emptyRawCell")}</NotebookEmptyBox>
        ) : (
          <CodeBlock content={cell.source} language="text" t={t} title={t("notebookPreview.rawCodeTitle")} />
        )}
      </div>
    );
  }

  if (cell.cellType !== "code") {
    return null;
  }

  const normalizedDescription = (cell.descriptionMarkdown ?? "").trim();
  const hasCode = cell.source.trim().length > 0;

  return (
    <>
      <div className="px-4 py-3">
        {normalizedDescription.length > 0 ? (
          <NotebookMarkdown markdownContext={markdownContext} text={normalizedDescription} t={t} />
        ) : null}
        {hasCode ? (
          normalizedDescription.length > 0 ? (
            <details className="group/code mt-3 border-t border-token-border-light pt-2">
              <summary className="flex cursor-interaction list-none items-center gap-2 rounded-md py-1 text-left text-xs font-medium text-token-text-tertiary transition-colors hover:text-token-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-token-text-tertiary [&::-webkit-details-marker]:hidden">
                <ChevronDownIcon className="icon-2xs shrink-0 -rotate-90 transition-transform duration-300 group-open/code:rotate-0" />
                <NotebookPlaySmallIcon className="icon-2xs shrink-0" />
                <span>{t("notebookPreview.codeDisclosure")}</span>
              </summary>
              <div className="mt-2">
                <CodeBlock content={cell.source} language="python" t={t} title={t("notebookPreview.pythonCodeTitle")} />
              </div>
            </details>
          ) : (
            <CodeBlock content={cell.source} language="python" t={t} title={t("notebookPreview.pythonCodeTitle")} />
          )
        ) : (
          <NotebookEmptyBox>{t("notebookPreview.emptyCodeCell")}</NotebookEmptyBox>
        )}
      </div>
      {cell.outputs.length > 0 ? (
        <div className="border-t border-token-border-light bg-token-main-surface-secondary/15 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-col gap-3">
            {cell.outputs.map((output: NotebookOutput, index: number) => (
              <NotebookOutputView key={index} markdownContext={markdownContext} output={output} t={t} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function NotebookOutputView({
  markdownContext,
  output,
  t,
}: {
  markdownContext: NotebookMarkdownContext;
  output: NotebookOutput;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  switch (output.type) {
    case "image":
      return (
        <div className="overflow-auto rounded-md bg-token-main-surface-primary/40 p-2">
          <img
            alt={t("notebookPreview.imageOutputAlt", { outputNumber: output.outputNumber })}
            className="max-h-[640px] max-w-full"
            src={output.dataUrl}
          />
        </div>
      );
    case "html":
      return (
        <div>
          <iframe
            className="h-72 w-full rounded-md bg-token-main-surface-primary"
            sandbox=""
            srcDoc={buildNotebookHtmlDocument(output.html)}
            title={t("notebookPreview.htmlOutputTitle")}
          />
          <RawOutputDisclosure className="mt-2" t={t}>
            {output.html}
          </RawOutputDisclosure>
        </div>
      );
    case "markdown":
      return (
        <div className="rounded-md bg-token-main-surface-primary/40 px-3 py-2">
          <NotebookMarkdown markdownContext={markdownContext} text={output.markdown} t={t} />
        </div>
      );
    case "json":
      return (
        <NotebookTextOutput
          language="json"
          markdownContext={markdownContext}
          rawText={output.text}
          summaryMarkdown={output.summaryMarkdown}
          t={t}
        />
      );
    case "stream":
    case "text":
      return (
        <NotebookTextOutput
          markdownContext={markdownContext}
          rawText={output.text}
          summaryMarkdown={output.summaryMarkdown}
          t={t}
        />
      );
    case "error":
      return (
        <div className="rounded-md border border-token-charts-red/30 bg-token-charts-red/5 p-3">
          {output.summaryMarkdown == null ? (
            <div className="text-sm font-medium text-token-charts-red">
              {output.evalue.length > 0
                ? t("notebookPreview.errorOutput", {
                    message: output.evalue,
                    name: output.ename,
                  })
                : output.ename}
            </div>
          ) : (
            <NotebookMarkdown markdownContext={markdownContext} text={output.summaryMarkdown} t={t} />
          )}
          {getNotebookErrorRawOutput(output).trim().length > 0 ? (
            <RawOutputDisclosure className="mt-2" t={t}>
              {getNotebookErrorRawOutput(output)}
            </RawOutputDisclosure>
          ) : null}
        </div>
      );
  }
}

function NotebookTextOutput({
  markdownContext,
  rawText,
  summaryMarkdown,
  language,
  t,
}: {
  markdownContext: NotebookMarkdownContext;
  rawText: string;
  summaryMarkdown: string | null;
  language?: "json";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (summaryMarkdown != null) {
    return (
      <div className="rounded-md bg-token-main-surface-primary/40 p-3">
        <NotebookMarkdown markdownContext={markdownContext} text={summaryMarkdown} t={t} />
        <RawOutputDisclosure className="mt-2" t={t}>
          {rawText}
        </RawOutputDisclosure>
      </div>
    );
  }

  if (language != null) {
    return <CodeBlock content={rawText} language={language} showActionBar={false} t={t} />;
  }

  return <RawPre>{rawText}</RawPre>;
}

function NotebookEmptyBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-token-border-light px-3 py-2 text-sm text-token-text-tertiary">{children}</div>;
}

function CodeBlock({
  content,
  language,
  showActionBar = true,
  t,
  title,
}: {
  content: string;
  language: string;
  showActionBar?: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  title?: string;
}) {
  const resolvedTitle = title ?? language;

  return (
    <div className="w-full min-w-0 overflow-clip rounded-lg border border-token-input-background bg-token-text-code-block-background">
      {showActionBar ? (
        <div className="flex items-center px-2 py-1 text-sm text-token-description-foreground select-none">
          <div className="min-w-0 flex-1 truncate">{resolvedTitle}</div>
          <div className="ml-auto flex shrink-0 items-center">
            <CodeBlockCopyButton content={content} label={t("copyButton.copyCode")} t={t} />
          </div>
        </div>
      ) : null}
      <div className="overflow-auto p-2 text-size-chat" dir="ltr">
        <code className="block font-mono text-xs whitespace-pre-wrap text-token-text-primary" data-language={language}>
          {content}
        </code>
      </div>
    </div>
  );
}

function CodeBlockCopyButton({
  content,
  label,
  t,
}: {
  content: string;
  label: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
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
      color="ghost"
      size="icon"
      title={copied ? t("copyButton.copied") : label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText != null) {
          void navigator.clipboard.writeText(content).then(
            () => {
              setCopied(true);
            },
            () => {},
          );
        }
      }}
    >
      {copied ? <CheckIcon className="icon-xs" /> : <CopyPathIcon className="icon-xs" />}
    </Button>
  );
}

function RawOutputDisclosure({
  children,
  className,
  t,
}: {
  children: string;
  className?: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <details className={className}>
      <summary className="cursor-interaction text-xs font-medium text-token-text-tertiary marker:text-token-text-tertiary">
        {t("notebookPreview.rawOutputDisclosure")}
      </summary>
      <RawPre className="mt-2">{children}</RawPre>
    </details>
  );
}

function RawPre({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <pre
      className={[
        "overflow-auto rounded-md bg-token-text-code-block-background/20 p-3 font-mono text-xs whitespace-pre-wrap text-token-text-primary",
        className ?? "",
      ].join(" ").trim()}
    >
      {children}
    </pre>
  );
}

function NotebookMarkdown({
  markdownContext,
  text,
  t,
}: {
  markdownContext: NotebookMarkdownContext;
  text: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <MarkdownPreview
      allowBasicHtml
      apps={markdownContext.apps}
      canFileLinkOpenInSidePanel={markdownContext.canOpenFileLinkInSidePanel}
      cwd={markdownContext.cwd}
      hostId={markdownContext.hostId}
      onExternalLinkOpenInBrowser={markdownContext.onExternalLinkOpenInBrowser}
      onFileLinkOpen={markdownContext.onFileLinkOpen}
      onFileLinkOpenInBrowser={markdownContext.onFileLinkOpenInBrowser}
      plugins={markdownContext.plugins}
      renderCodeBlock={({ content, language }) => (
        <CodeBlock content={content} language={language ?? "text"} t={t} />
      )}
      skills={markdownContext.skills}
      text={text}
      variant="notebook"
    />
  );
}

function getParentDirectoryPath(path: string) {
  const lastSeparatorIndex = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  if (lastSeparatorIndex < 0) {
    return null;
  }

  return path.slice(0, lastSeparatorIndex);
}

function isNotebookBrowserViewablePath(path: string, hostId: string | null) {
  return isNotebookBrowserViewableHostId(hostId) && /\.html?$/i.test(path.trim().replace(/[?#].*$/, ""));
}

function isNotebookBrowserViewableHostId(hostId: string | null) {
  const normalizedHostId = hostId?.trim();
  return normalizedHostId == null || normalizedHostId.length === 0 || normalizedHostId === "local";
}

function parseNotebookBytes(bytes: Uint8Array): NotebookParseState {
  try {
    const jsonValue = JSON.parse(new TextDecoder().decode(bytes));
    return {
      document: parseNotebookDocument(jsonValue),
      kind: "ready",
    };
  } catch {
    return {
      kind: "error",
    };
  }
}

function parseNotebookDocument(value: unknown): NotebookDocument {
  if (!isRecord(value) || !Array.isArray(value.cells)) {
    throw new Error("Notebook must be a JSON object with a cells array");
  }

  return {
    cells: value.cells.map((cell, index) => parseNotebookCell(cell, index)),
    title: extractMetadataText(value.metadata, NOTEBOOK_TITLE_KEYS),
  };
}

function parseNotebookCell(value: unknown, cellIndex: number): NotebookCell {
  if (!isRecord(value)) {
    return {
      cellType: "raw",
      id: null,
      source: "",
      title: null,
    };
  }

  const source = extractJoinedText(value.source) ?? "";
  const id = typeof value.id === "string" ? value.id : null;
  const title = extractMetadataText(value.metadata, NOTEBOOK_TITLE_KEYS);

  switch (value.cell_type) {
    case "code":
      return {
        cellType: "code",
        descriptionMarkdown: extractMetadataText(value.metadata, NOTEBOOK_DESCRIPTION_KEYS),
        executionCount: typeof value.execution_count === "number" ? value.execution_count : null,
        id,
        outputs: Array.isArray(value.outputs)
          ? value.outputs.flatMap((output, outputIndex) =>
              parseNotebookOutput(output, outputIndex, readNotebookOutputSummary(value.metadata, outputIndex)),
            )
          : [],
        source,
        title,
      };
    case "markdown":
      return {
        cellType: "markdown",
        id,
        source,
        title,
      };
    case "raw":
      return {
        cellType: "raw",
        id,
        source,
        title,
      };
    default:
      return {
        cellType: "raw",
        id: id ?? `cell-${cellIndex}`,
        source,
        title,
      };
  }
}

function parseNotebookOutput(
  value: unknown,
  outputIndex: number,
  summaryMarkdown: string | null,
): NotebookOutput[] {
  if (!isRecord(value) || typeof value.output_type !== "string") {
    return [];
  }

  switch (value.output_type) {
    case "stream": {
      const text = extractJoinedText(value.text);
      return text == null
        ? []
        : [
            {
              summaryMarkdown,
              text,
              type: "stream",
            },
          ];
    }
    case "error":
      return [
        {
          ename: extractStringProperty(value, "ename") ?? "Error",
          evalue: extractStringProperty(value, "evalue") ?? "",
          summaryMarkdown,
          traceback: extractJoinedText(value.traceback) ?? "",
          type: "error",
        },
      ];
    case "display_data":
    case "execute_result":
      return parseNotebookOutputData(value.data, outputIndex, summaryMarkdown);
    default:
      return [];
  }
}

function parseNotebookOutputData(
  value: unknown,
  outputIndex: number,
  summaryMarkdown: string | null,
): NotebookOutput[] {
  if (!isRecord(value)) {
    return [];
  }

  const imageOutput = getNotebookImageOutput(value, outputIndex);
  if (imageOutput != null) {
    return [imageOutput];
  }

  const html = extractJoinedText(value["text/html"]);
  if (html != null && html.trim().length > 0) {
    return [{ html, type: "html" }];
  }

  const markdown = extractJoinedText(value["text/markdown"]);
  if (markdown != null && markdown.trim().length > 0) {
    return [{ markdown, type: "markdown" }];
  }

  const plainText = extractJoinedText(value["text/plain"]);
  if (plainText != null) {
    return [
      {
        summaryMarkdown,
        text: plainText,
        type: "text",
      },
    ];
  }

  const jsonValue = value["application/json"] ?? value["application/vnd.vega.v5+json"];
  if (jsonValue == null) {
    return [];
  }

  return [
    {
      summaryMarkdown,
      text: JSON.stringify(jsonValue, null, 2),
      type: "json",
    },
  ];
}

function getNotebookImageOutput(value: Record<string, unknown>, outputIndex: number): NotebookOutput | null {
  const png = extractJoinedText(value["image/png"]);
  if (png != null) {
    return {
      dataUrl: `data:image/png;base64,${png.replaceAll(/\s/g, "")}`,
      outputNumber: outputIndex + 1,
      type: "image",
    };
  }

  const jpeg = extractJoinedText(value["image/jpeg"]);
  if (jpeg != null) {
    return {
      dataUrl: `data:image/jpeg;base64,${jpeg.replaceAll(/\s/g, "")}`,
      outputNumber: outputIndex + 1,
      type: "image",
    };
  }

  const svg = extractJoinedText(value["image/svg+xml"]);
  if (svg == null) {
    return null;
  }

  return {
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    outputNumber: outputIndex + 1,
    type: "image",
  };
}

function readNotebookOutputSummary(metadata: unknown, outputIndex: number) {
  for (const root of getNotebookMetadataRoots(metadata)) {
    const outputSummaries = root.outputSummaries;
    if (!Array.isArray(outputSummaries)) {
      continue;
    }
    const summary = outputSummaries[outputIndex];
    if (!isRecord(summary)) {
      continue;
    }
    const summaryMarkdown = extractJoinedText(summary.summaryMarkdown);
    if (summaryMarkdown != null && summaryMarkdown.trim().length > 0) {
      return summaryMarkdown;
    }
  }

  return null;
}

function getNotebookMetadataRoots(metadata: unknown) {
  if (!isRecord(metadata)) {
    return [];
  }

  const roots = NOTEBOOK_METADATA_ROOT_KEYS.flatMap((key) => {
    const candidate = metadata[key];
    return isRecord(candidate) ? [candidate] : [];
  });

  return [...roots, metadata];
}

function extractMetadataText(metadata: unknown, keys: readonly string[]) {
  for (const root of getNotebookMetadataRoots(metadata)) {
    for (const key of keys) {
      const text = extractJoinedText(root[key]);
      if (text != null && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

function extractStringProperty(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : null;
}

function extractJoinedText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  return Array.isArray(value) && value.every((part) => typeof part === "string") ? value.join("") : null;
}

function getNotebookCellTitle(
  cell: NotebookCell,
  cellNumber: number,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const explicitTitle = cell.title?.trim();
  if (explicitTitle != null && explicitTitle.length > 0) {
    return explicitTitle;
  }

  if (cell.cellType === "markdown") {
    return extractMarkdownHeading(cell.source) ?? t("notebookPreview.markdownCellTitle", { cellNumber });
  }

  if (cell.cellType === "raw") {
    return t("notebookPreview.rawCellTitle", { cellNumber });
  }

  if (cell.cellType !== "code") {
    return t("notebookPreview.codeCellTitle", { cellNumber });
  }

  const descriptionText = normalizeNotebookDescriptionText(cell.descriptionMarkdown ?? "");
  return descriptionText.length > 0 ? truncateNotebookTitle(descriptionText) : t("notebookPreview.codeCellTitle", { cellNumber });
}

function getNotebookErrorRawOutput(output: Extract<NotebookOutput, { type: "error" }>) {
  const headline = `${output.ename}: ${output.evalue}`.trim();
  return output.traceback.trim().length === 0 ? headline : `${headline}\n${output.traceback}`;
}

function extractMarkdownHeading(source: string) {
  const headingLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+/.test(line));
  return headingLine == null ? null : truncateNotebookTitle(headingLine.replace(/^#{1,6}\s+/, ""));
}

function normalizeNotebookDescriptionText(source: string) {
  return source
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/[*_~#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateNotebookTitle(value: string) {
  const trimmed = value.trim();
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77).trimEnd()}\u2026`;
}

function stripIpynbExtension(title: string) {
  return title.replace(/\.ipynb$/i, "");
}

function buildNotebookHtmlDocument(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${HTML_OUTPUT_CSP}"><meta name="color-scheme" content="light dark"><base target="_blank"><style>html,body{margin:0;background:transparent;color:CanvasText;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}body{padding:12px;}img,svg,canvas,video{max-width:100%;height:auto;}table{border-collapse:collapse;}th,td{border:1px solid color-mix(in srgb, CanvasText 18%, transparent);padding:4px 6px;}</style></head><body>${html}</body></html>`;
}

function trimTrailingBlankLines(lines: string[]) {
  const trimmedLines = [...lines];
  while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1]?.trim().length === 0) {
    trimmedLines.pop();
  }
  return trimmedLines;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function NotebookPlaySmallIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 12 12">
      <path
        d="M3.75 3.63838L3.75 8.36129C3.75 8.85447 4.29447 9.15336 4.71055 8.88858L8.42137 6.52713C8.80732 6.28153 8.80732 5.71815 8.42137 5.47255L4.71055 3.11113C4.29447 2.84631 3.75 3.14518 3.75 3.63838Z"
        fill="currentColor"
      />
    </svg>
  );
}
