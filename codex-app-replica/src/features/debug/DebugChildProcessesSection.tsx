import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CloseTabIcon, InfoIcon } from "../../components/AppShellIcons";
import {
  readChildProcesses,
  type ChildProcessInfo,
  type ChildProcessesResponse,
} from "../../services/debug";
import { DebugSection } from "./DebugSectionPrimitives";

const CHILD_PROCESSES_STORAGE_KEY = "debug-child-processes";
const CHILD_PROCESS_ROW_HEIGHT = 34;
const MAX_VISIBLE_CHILD_PROCESS_ROWS = 12;
const ONE_GIB_IN_KIB = 1024 * 1024;
const FIVE_GIB_IN_KIB = 5 * 1024 * 1024;

type ChildProcessNode = {
  children: ChildProcessNode[];
  commandLabel: string;
  fullCommand: string;
  process: ChildProcessInfo;
  totalCpuPercent: number | null;
  totalRssKb: number | null;
  treePath: string;
};

export function DebugChildProcessesSection() {
  const [isSectionOpen, setIsSectionOpen] = useState(() => readStoredSectionOpen(CHILD_PROCESSES_STORAGE_KEY));
  const [isPaused, setIsPaused] = useState(false);
  const [response, setResponse] = useState<ChildProcessesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProcessDetails, setSelectedProcessDetails] = useState<string | null>(null);
  const responseRef = useRef<ChildProcessesResponse | null>(null);

  useEffect(() => {
    responseRef.current = response;
  }, [response]);

  useEffect(() => {
    if (!isSectionOpen || isPaused) {
      return;
    }

    let cancelled = false;

    const load = async (isInitialLoad: boolean) => {
      if (isInitialLoad && responseRef.current == null) {
        setIsLoading(true);
      }

      try {
        const nextResponse = await readChildProcesses();
        if (!cancelled) {
          setResponse(nextResponse);
        }
      } catch {
        if (!cancelled) {
          setResponse((current) => current ?? { rootProcess: null, processes: [] });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load(true);

    const intervalId = window.setInterval(() => {
      void load(false);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isPaused, isSectionOpen]);

  const processCount = response?.processes.length ?? 0;
  const title = isSectionOpen ? `Child processes (${processCount})` : "Child processes";
  const actions = isSectionOpen ? (
    <button
      type="button"
      className="cursor-interaction rounded-full border border-token-border/70 px-2 py-1 text-xs font-medium hover:bg-token-foreground/10"
      onClick={() => setIsPaused((current) => !current)}
    >
      {isPaused ? "Resume" : "Pause"}
    </button>
  ) : null;

  let body = null;
  if (isSectionOpen) {
    if (isLoading && response == null) {
      body = (
        <div className="rounded-xl border border-token-border/60 bg-token-foreground/5 px-3 py-3 text-sm text-token-description-foreground">
          Loading child processes…
        </div>
      );
    } else if (response?.rootProcess == null) {
      body = (
        <div className="rounded-xl border border-token-border/60 bg-token-foreground/5 px-3 py-3 text-sm text-token-description-foreground">
          No child processes found.
        </div>
      );
    } else {
      body = (
        <ChildProcessesTree
          onProcessDetailsClick={setSelectedProcessDetails}
          processes={response.processes}
          rootProcess={response.rootProcess}
        />
      );
    }
  }

  return (
    <DebugSection
      storageKey={CHILD_PROCESSES_STORAGE_KEY}
      title={title}
      variant="global"
      actions={actions}
      onToggle={(open) => {
        setIsSectionOpen(open);
        if (!open) {
          setIsPaused(false);
          setSelectedProcessDetails(null);
        }
      }}
    >
      {body}
      <ChildProcessDetailsDialog
        details={selectedProcessDetails}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProcessDetails(null);
          }
        }}
      />
    </DebugSection>
  );
}

function ChildProcessesTree({
  onProcessDetailsClick,
  processes,
  rootProcess,
}: {
  onProcessDetailsClick: (details: string) => void;
  processes: ChildProcessInfo[];
  rootProcess: ChildProcessInfo;
}) {
  const rootNode = useMemo(() => buildChildProcessTree(rootProcess, processes), [processes, rootProcess]);
  const expandablePaths = useMemo(() => collectExpandedChildProcessPaths(rootNode), [rootNode]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => collectExpandedChildProcessPaths(rootNode));
  const previousExpandablePathsRef = useRef<Set<string>>(expandablePaths);

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set<string>();
      for (const treePath of expandablePaths) {
        if (current.has(treePath) || !previousExpandablePathsRef.current.has(treePath)) {
          next.add(treePath);
        }
      }
      previousExpandablePathsRef.current = new Set(expandablePaths);
      return next;
    });
  }, [expandablePaths]);

  if (rootNode == null) {
    return null;
  }

  const rowCount = countChildProcessNodes(rootNode);
  const maxHeight = Math.min(rowCount, MAX_VISIBLE_CHILD_PROCESS_ROWS) * CHILD_PROCESS_ROW_HEIGHT + 4;

  return (
    <div className="py-1">
      <div role="tree" className="overflow-auto" style={{ maxHeight: `${maxHeight}px` }}>
        <ChildProcessTreeNode
          expandedPaths={expandedPaths}
          node={rootNode}
          onProcessDetailsClick={onProcessDetailsClick}
          onToggleNode={(treePath) => {
            setExpandedPaths((current) => {
              const next = new Set(current);
              if (next.has(treePath)) {
                next.delete(treePath);
              } else {
                next.add(treePath);
              }
              return next;
            });
          }}
        />
      </div>
    </div>
  );
}

function ChildProcessTreeNode({
  expandedPaths,
  node,
  onProcessDetailsClick,
  onToggleNode,
}: {
  expandedPaths: Set<string>;
  node: ChildProcessNode;
  onProcessDetailsClick: (details: string) => void;
  onToggleNode: (treePath: string) => void;
}) {
  const detailsLabel = formatProcessDetails(node);
  const isExpandable = node.children.length > 0;
  const isExpanded = isExpandable ? expandedPaths.has(node.treePath) : false;
  const ramTone = readRamTone(node.totalRssKb);
  const selfCpu = node.process.depth === 0 && node.process.cpuPercent == null
    ? ""
    : formatChildProcessCpuPercent(node.process.cpuPercent);
  const totalCpu = formatChildProcessCpuPercent(node.totalCpuPercent);
  const selfRss = formatChildProcessRss(node.process.rssKb);
  const totalRss = formatChildProcessRss(node.totalRssKb);
  const age = formatChildProcessAge(node.process.ageSeconds);

  return (
    <>
      <div
        role="treeitem"
        aria-level={node.process.depth + 1}
        aria-expanded={isExpandable ? isExpanded : undefined}
        className={[
          "flex items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-token-foreground/5",
          isExpandable ? "cursor-interaction" : "",
        ].join(" ")}
        tabIndex={isExpandable ? 0 : undefined}
        onClick={isExpandable ? () => onToggleNode(node.treePath) : undefined}
        onKeyDown={
          isExpandable
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                onToggleNode(node.treePath);
              }
            : undefined
        }
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          style={{ paddingLeft: `${node.process.depth * 12}px` }}
        >
          <span
            className="icon-2xs shrink-0 transition-transform duration-150"
            style={{
              opacity: isExpandable ? 1 : 0,
              transform: `rotate(${isExpanded ? 0 : -90}deg)`,
            }}
          >
            <ChevronDownIcon className="icon-2xs" />
          </span>
          <span className="min-w-0 truncate font-medium">{node.commandLabel}</span>
          <button
            type="button"
            aria-label={detailsLabel}
            title={detailsLabel}
            className="inline-flex shrink-0 text-token-description-foreground hover:text-token-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border"
            onClick={(event) => {
              event.stopPropagation();
              onProcessDetailsClick(detailsLabel);
            }}
          >
            <InfoIcon className="icon-2xs" />
          </button>
        </div>
        <div
          className="ml-auto grid items-center gap-x-1 text-xs text-token-description-foreground tabular-nums"
          style={{
            gridTemplateColumns:
              "max-content 6.5ch 1ch 6.5ch 16px max-content 8.6ch 1ch 8.6ch 16px max-content 7ch",
          }}
        >
          <span className="font-semibold opacity-60">CPU</span>
          <span className="text-right opacity-70">{selfCpu}</span>
          <span className="text-center opacity-45">/</span>
          <span className="text-left opacity-90">{totalCpu}</span>
          <span />
          <span className="font-semibold opacity-60">RAM</span>
          <span className="text-right opacity-70">{selfRss}</span>
          <span className="text-center opacity-45">/</span>
          <span
            className={[
              "text-left opacity-90",
              ramTone === "warning" ? "text-token-charts-yellow opacity-100" : "",
              ramTone === "danger" ? "text-token-charts-red opacity-100" : "",
            ].join(" ")}
          >
            {totalRss}
          </span>
          <span />
          <span className="font-semibold opacity-60">AGE</span>
          <span className="text-right opacity-70">{age}</span>
        </div>
      </div>
      {isExpanded
        ? node.children.map((childNode) => (
            <ChildProcessTreeNode
              key={childNode.treePath}
              expandedPaths={expandedPaths}
              node={childNode}
              onProcessDetailsClick={onProcessDetailsClick}
              onToggleNode={onToggleNode}
            />
          ))
        : null}
    </>
  );
}

function ChildProcessDetailsDialog({
  details,
  onOpenChange,
}: {
  details: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (details == null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [details, onOpenChange]);

  if (details == null || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" onClick={() => onOpenChange(false)} />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="debug-child-process-dialog-title"
          aria-describedby="debug-child-process-dialog-description"
          className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-token-border bg-token-main-surface-primary p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="debug-child-process-dialog-title" className="text-base font-medium text-token-foreground">
                Process details
              </h2>
              <p id="debug-child-process-dialog-description" className="mt-1 text-sm text-token-description-foreground">
                The process ID and full command are shown below
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex shrink-0 rounded p-1 text-token-description-foreground hover:bg-token-foreground/5 hover:text-token-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border"
              onClick={() => onOpenChange(false)}
            >
              <CloseTabIcon className="icon-xs" />
            </button>
          </div>
          <pre className="m-0 max-h-[420px] overflow-auto rounded-xl border border-token-border bg-token-editor-background/70 p-3 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-token-foreground">
            {details}
          </pre>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function buildChildProcessTree(
  rootProcess: ChildProcessInfo | null,
  processes: ChildProcessInfo[],
): ChildProcessNode | null {
  if (rootProcess == null) {
    return null;
  }

  const processesByParent = new Map<number | null, ChildProcessInfo[]>();
  for (const process of processes) {
    const siblings = processesByParent.get(process.parentPid) ?? [];
    siblings.push(process);
    processesByParent.set(process.parentPid, siblings);
  }

  return buildChildProcessNode(rootProcess, null, processesByParent);
}

function buildChildProcessNode(
  process: ChildProcessInfo,
  parentPath: string | null,
  processesByParent: Map<number | null, ChildProcessInfo[]>,
): ChildProcessNode {
  const commandLabel = readCommandLabel(process.command);
  const treePath = parentPath == null
    ? `${commandLabel} [pid ${process.pid}]`
    : `${parentPath}/${commandLabel} [pid ${process.pid}]`;
  const children = (processesByParent.get(process.pid) ?? [])
    .map((childProcess) => buildChildProcessNode(childProcess, treePath, processesByParent))
    .sort(compareChildProcessNodes);

  return {
    children,
    commandLabel,
    fullCommand: process.command.trim().length > 0 ? process.command.trim() : "(command unavailable)",
    process,
    totalCpuPercent: computeTotalCpuPercent(process.cpuPercent, children),
    totalRssKb: computeTotalRssKb(process.rssKb, children),
    treePath,
  };
}

function compareChildProcessNodes(left: ChildProcessNode, right: ChildProcessNode) {
  const leftTotalRss = left.totalRssKb ?? -1;
  const rightTotalRss = right.totalRssKb ?? -1;
  if (leftTotalRss !== rightTotalRss) {
    return rightTotalRss - leftTotalRss;
  }

  const leftRss = left.process.rssKb ?? -1;
  const rightRss = right.process.rssKb ?? -1;
  if (leftRss !== rightRss) {
    return rightRss - leftRss;
  }

  const labelComparison = left.commandLabel.localeCompare(right.commandLabel);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.process.pid - right.process.pid;
}

function computeTotalCpuPercent(cpuPercent: number | null, children: ChildProcessNode[]) {
  let total = cpuPercent ?? 0;
  let hasValue = cpuPercent != null;

  for (const child of children) {
    if (child.totalCpuPercent == null) {
      continue;
    }

    total += child.totalCpuPercent;
    hasValue = true;
  }

  return hasValue ? total : null;
}

function computeTotalRssKb(rssKb: number | null, children: ChildProcessNode[]) {
  let total = rssKb ?? 0;
  let hasValue = rssKb != null;

  for (const child of children) {
    if (child.totalRssKb == null) {
      continue;
    }

    total += child.totalRssKb;
    hasValue = true;
  }

  return hasValue ? total : null;
}

function countChildProcessNodes(node: ChildProcessNode): number {
  return 1 + node.children.reduce((count, childNode) => count + countChildProcessNodes(childNode), 0);
}

function collectExpandedChildProcessPaths(node: ChildProcessNode | null) {
  const expandedPaths = new Set<string>();
  if (node == null) {
    return expandedPaths;
  }

  addExpandedChildProcessPaths(node, expandedPaths);
  return expandedPaths;
}

function addExpandedChildProcessPaths(node: ChildProcessNode, expandedPaths: Set<string>) {
  if (node.children.length > 0) {
    expandedPaths.add(node.treePath);
  }

  for (const childNode of node.children) {
    addExpandedChildProcessPaths(childNode, expandedPaths);
  }
}

function formatProcessDetails(node: ChildProcessNode) {
  return `PID ${node.process.pid}\n${node.fullCommand}`;
}

function readCommandLabel(command: string) {
  const trimmedCommand = command.trim();
  if (trimmedCommand.length === 0) {
    return "(command unavailable)";
  }

  const quotedMatch = /^"([^"]+)"/.exec(trimmedCommand);
  if (quotedMatch != null) {
    return basenameFromPath(quotedMatch[1]);
  }

  const appBundleMatch = /^.+?\/([^/]+)\.app\/Contents\/MacOS\/(.+)$/.exec(trimmedCommand);
  if (appBundleMatch != null) {
    const appName = appBundleMatch[1];
    const executableName = appBundleMatch[2];
    if (executableName === appName || executableName.startsWith(`${appName} `)) {
      return appName;
    }
  }

  return basenameFromPath(trimmedCommand.split(/\s+/, 1)[0] ?? trimmedCommand);
}

function basenameFromPath(path: string) {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function formatChildProcessAge(ageSeconds: number | null) {
  if (ageSeconds == null || !Number.isFinite(ageSeconds)) {
    return "n/a";
  }

  const wholeSeconds = Math.max(0, Math.floor(ageSeconds));
  if (wholeSeconds < 60) {
    return `${wholeSeconds}s`;
  }

  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatChildProcessRss(rssKb: number | null) {
  if (rssKb == null || !Number.isFinite(rssKb)) {
    return "n/a";
  }

  if (rssKb >= ONE_GIB_IN_KIB) {
    return `${(rssKb / ONE_GIB_IN_KIB).toFixed(2)} GB`;
  }

  if (rssKb >= 1024) {
    return `${(rssKb / 1024).toFixed(1)} MB`;
  }

  return `${rssKb} KB`;
}

function formatChildProcessCpuPercent(cpuPercent: number | null) {
  if (cpuPercent == null || !Number.isFinite(cpuPercent)) {
    return "n/a";
  }

  return `${cpuPercent.toFixed(1)}%`;
}

function readRamTone(totalRssKb: number | null) {
  if (totalRssKb == null) {
    return "default";
  }

  if (totalRssKb > FIVE_GIB_IN_KIB) {
    return "danger";
  }

  if (totalRssKb > ONE_GIB_IN_KIB) {
    return "warning";
  }

  return "default";
}

function readStoredSectionOpen(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "open";
  } catch {
    return false;
  }
}
