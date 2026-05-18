import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type {
  ThreadConversation,
  ThreadConversationItem,
  ThreadConversationMcpToolCall,
} from "../../services/history";
import { getRecentThreads, readThread } from "../../services/history";
import { DebugField, DebugSection } from "./DebugSectionPrimitives";

const NODE_REPL_SERVER = "node_repl";
const NODE_REPL_SECTION_STORAGE_KEY = "debug-node-repl-section";
const MAX_RECENT_CALLS = 8;
const DEFAULT_JSON_CHAR_LIMIT = 1200;
const RESULT_JSON_CHAR_LIMIT = 8000;
const MULTILINE_CHAR_LIMIT = 12000;

type DebugNodeReplSectionProps = {
  conversationId: string | null;
  threadConversation: ThreadConversation | null;
};

type NodeReplSource = {
  conversationId: string | null;
  items: ThreadConversationItem[];
};

type NodeReplLine =
  | {
      label: string;
      value: string;
      kind?: undefined;
    }
  | {
      kind: "javascript" | "json" | "multiline";
      label: string;
      value: string;
      title: string;
      wrapCode?: boolean;
    }
  | {
      kind: "image";
      label: string;
      mimeType: string;
      src: string;
    };

type NodeReplCallEntry = {
  conversationId: string | null;
  item: ThreadConversationMcpToolCall;
};

type NodeReplSectionSummary = {
  totalCount: number;
  completedCount: number;
  failedCount: number;
  inProgressCount: number;
  recentCalls: NodeReplCallEntry[];
};

const EMPTY_NODE_REPL_LINES: NodeReplLine[] = [
  {
    label: "status",
    value: "No Node REPL tool calls for this thread",
  },
];

export function DebugNodeReplSection({ conversationId, threadConversation }: DebugNodeReplSectionProps) {
  const [globalSources, setGlobalSources] = useState<NodeReplSource[]>([]);

  useEffect(() => {
    if (conversationId != null) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const recentThreads = await getRecentThreads();
        const orderedThreadIds = [...recentThreads].reverse().map((entry) => entry.id);
        const threads = await Promise.all(
          orderedThreadIds.map(async (threadId) => {
            return await readThread(threadId).catch(() => null);
          }),
        );
        if (cancelled) {
          return;
        }

        setGlobalSources(
          threads
            .filter((thread): thread is ThreadConversation => thread !== null)
            .map((thread) => ({
              conversationId: thread.id,
              items: thread.items,
            })),
        );
      } catch {
        if (!cancelled) {
          setGlobalSources([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const sources = useMemo(() => {
    if (conversationId != null) {
      return threadConversation == null
        ? []
        : [
            {
              conversationId,
              items: threadConversation.items,
            },
          ];
    }

    return globalSources;
  }, [conversationId, globalSources, threadConversation]);

  const lines = useMemo(() => buildNodeReplLines(sources), [sources]);

  return (
    <DebugSection
      storageKey={NODE_REPL_SECTION_STORAGE_KEY}
      title="Node REPL"
      variant="global"
      unmountChildrenWhenClosed={true}
    >
      <div className="py-1.5">
        {lines.map((line, index) => (
          <DebugNodeReplLineRow key={`${index}:${line.label}`} line={line} />
        ))}
      </div>
    </DebugSection>
  );
}

export function buildNodeReplLines(sources: NodeReplSource[]): NodeReplLine[] {
  const summary = summarizeNodeReplCalls(sources);
  if (summary.totalCount === 0) {
    return EMPTY_NODE_REPL_LINES;
  }

  return [
    {
      label: "toolCallCount",
      value: String(summary.totalCount),
    },
    {
      label: "inProgressCount",
      value: String(summary.inProgressCount),
    },
    {
      label: "completedCount",
      value: String(summary.completedCount),
    },
    {
      label: "failedCount",
      value: String(summary.failedCount),
    },
    {
      label: "showing",
      value: `${summary.recentCalls.length} of ${summary.totalCount} most recent`,
    },
    ...summary.recentCalls.flatMap((call, index) => buildNodeReplCallLines(call, index)),
  ];
}

function summarizeNodeReplCalls(sources: NodeReplSource[]): NodeReplSectionSummary {
  const recentCalls: NodeReplCallEntry[] = [];
  let totalCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;

  for (const source of sources) {
    for (const item of source.items) {
      if (!isNodeReplToolCall(item)) {
        continue;
      }

      totalCount += 1;
      if (item.status === "completed") {
        completedCount += 1;
      } else if (item.status === "failed") {
        failedCount += 1;
      } else if (item.status === "inProgress") {
        inProgressCount += 1;
      }

      recentCalls.push({
        conversationId: source.conversationId,
        item,
      });
      if (recentCalls.length > MAX_RECENT_CALLS) {
        recentCalls.shift();
      }
    }
  }

  return {
    totalCount,
    completedCount,
    failedCount,
    inProgressCount,
    recentCalls: recentCalls.reverse(),
  };
}

function buildNodeReplCallLines(entry: NodeReplCallEntry, index: number): NodeReplLine[] {
  const { conversationId, item } = entry;
  const durationSuffix =
    typeof item.durationMs === "number" ? `, ${item.durationMs}ms` : "";
  const lines: NodeReplLine[] = [
    {
      label: `call[${index}]`,
      value: `${item.tool}: ${item.status}${durationSuffix}`,
    },
    {
      label: `call[${index}].id`,
      value: item.id,
    },
    ...buildNodeReplArgumentLines(item.arguments, index),
  ];

  if (conversationId != null) {
    lines.push({
      label: `call[${index}].threadId`,
      value: conversationId,
    });
  }

  lines.push({
    label: `call[${index}].turnId`,
    value: item.turnId ?? "none",
  });

  const errorMessage = readNodeReplErrorMessage(item);
  if (errorMessage != null) {
    lines.push({
      label: `call[${index}].error`,
      value: errorMessage,
    });
  }

  if (item.result != null) {
    lines.push(...buildNodeReplResultContentLines(item.result, index));
    lines.push({
      kind: "json",
      label: `call[${index}].result`,
      value: formatNodeReplJson(item.result, RESULT_JSON_CHAR_LIMIT),
      title: "JSON",
    });
  }

  return lines;
}

function buildNodeReplArgumentLines(argumentsValue: unknown, index: number): NodeReplLine[] {
  const scriptArguments = parseNodeReplScriptArguments(argumentsValue);
  if (scriptArguments == null) {
    return [
      {
        label: `call[${index}].arguments`,
        value: formatNodeReplJson(argumentsValue),
      },
    ];
  }

  const lines: NodeReplLine[] = [];
  if (scriptArguments.title != null) {
    lines.push({
      label: `call[${index}].title`,
      value: scriptArguments.title,
    });
  }
  if (scriptArguments.timeoutMs != null) {
    lines.push({
      label: `call[${index}].timeoutMs`,
      value: String(scriptArguments.timeoutMs),
    });
  }

  lines.push({
    kind: "javascript",
    label: `call[${index}].script`,
    value: truncateNodeReplText(scriptArguments.code.replaceAll("\r\n", "\n").trim(), MULTILINE_CHAR_LIMIT),
    title: "JavaScript",
  });

  if (Object.keys(scriptArguments.extraArguments).length > 0) {
    lines.push({
      label: `call[${index}].arguments`,
      value: formatNodeReplJson(scriptArguments.extraArguments),
    });
  }

  return lines;
}

function buildNodeReplResultContentLines(result: unknown, index: number): NodeReplLine[] {
  const content = extractNodeReplResultContent(result);
  if (content == null) {
    return [];
  }

  const lines: NodeReplLine[] = [];

  content.forEach((item, contentIndex) => {
    const textContent = parseNodeReplTextContent(item);
    if (textContent != null) {
      lines.push({
        kind: "multiline",
        label: `call[${index}].result.content[${contentIndex}]`,
        value: truncateNodeReplText(textContent, MULTILINE_CHAR_LIMIT),
        title: "Text",
        wrapCode: true,
      });
      return;
    }

    const imageContent = parseNodeReplImageContent(item);
    if (imageContent == null) {
      return;
    }

    lines.push({
      kind: "image",
      label: `call[${index}].result.content[${contentIndex}]`,
      mimeType: imageContent.mimeType,
      src: imageContent.src,
    });
  });

  return lines;
}

function readNodeReplErrorMessage(item: ThreadConversationMcpToolCall) {
  if (
    item.error &&
    typeof item.error === "object" &&
    !Array.isArray(item.error) &&
    typeof (item.error as { message?: unknown }).message === "string"
  ) {
    const message = (item.error as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  const message = item.errorMessage?.trim();
  return message && message.length > 0 ? message : null;
}

function isNodeReplToolCall(item: ThreadConversationItem): item is ThreadConversationMcpToolCall {
  return item.type === "mcpToolCall" && item.server === NODE_REPL_SERVER;
}

function parseNodeReplScriptArguments(value: unknown) {
  if (!isPlainObject(value) || typeof value.code !== "string") {
    return null;
  }

  const { code, timeout_ms: timeoutMsValue, title: titleValue, ...extraArguments } = value;

  return {
    code,
    timeoutMs: typeof timeoutMsValue === "number" ? timeoutMsValue : null,
    title: typeof titleValue === "string" ? titleValue : null,
    extraArguments,
  };
}

function extractNodeReplResultContent(result: unknown) {
  if (!isPlainObject(result) || !Array.isArray(result.content)) {
    return null;
  }

  return result.content;
}

function parseNodeReplTextContent(value: unknown) {
  if (!isPlainObject(value) || value.type !== "text" || typeof value.text !== "string") {
    return null;
  }

  return value.text;
}

function parseNodeReplImageContent(value: unknown) {
  if (!isNodeReplImageContentRecord(value)) {
    return null;
  }

  const rawData = value.data.trim();
  if (rawData.startsWith("data:image/")) {
    return {
      mimeType: extractMimeTypeFromDataUrl(rawData) ?? "image/png",
      src: rawData,
    };
  }

  const mimeType = readNodeReplImageMimeType(value, rawData);
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  return {
    mimeType,
    src: `data:${mimeType};base64,${rawData}`,
  };
}

function readNodeReplImageMimeType(
  value: Record<string, unknown> & { data: string },
  rawData: string,
) {
  const explicitMimeType =
    typeof value.mimeType === "string"
      ? value.mimeType
      : typeof value.mime_type === "string"
        ? value.mime_type
        : inferNodeReplImageMimeType(rawData);

  return explicitMimeType;
}

function inferNodeReplImageMimeType(data: string) {
  if (data.startsWith("iVBOR")) {
    return "image/png";
  }
  if (data.startsWith("/9j/")) {
    return "image/jpeg";
  }
  if (data.startsWith("R0lGOD")) {
    return "image/gif";
  }
  if (data.startsWith("UklGR")) {
    return "image/webp";
  }
  if (data.startsWith("PHN2Zy")) {
    return "image/svg+xml";
  }
  return "image/png";
}

function formatNodeReplJson(value: unknown, charLimit = DEFAULT_JSON_CHAR_LIMIT) {
  try {
    const json = JSON.stringify(value, nodeReplJsonReplacer, 2) ?? String(value);
    return truncateNodeReplText(json, charLimit);
  } catch (error) {
    return truncateNodeReplText(String(error), charLimit);
  }
}

function nodeReplJsonReplacer(this: unknown, key: string, value: unknown) {
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Set) {
    return [...value];
  }
  if (key === "data" && typeof value === "string" && isNodeReplImageContentRecord(this)) {
    return `<base64 image data: ${value.length} chars>`;
  }

  return value;
}

function truncateNodeReplText(value: string, charLimit: number) {
  return value.length <= charLimit ? value : `${value.slice(0, charLimit)}… (${value.length} chars)`;
}

function extractMimeTypeFromDataUrl(dataUrl: string) {
  return /^data:(image\/[a-z0-9.+-]+);base64,/iu.exec(dataUrl)?.[1] ?? null;
}

function isNodeReplImageContentRecord(value: unknown): value is Record<string, unknown> & { data: string } {
  return isPlainObject(value) && value.type === "image" && typeof value.data === "string";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function DebugNodeReplLineRow({ line }: { line: NodeReplLine }) {
  switch (line.kind) {
    case "javascript":
    case "json":
    case "multiline":
      return (
        <DebugNodeReplRow label={line.label}>
          <DebugNodeReplCodeBlock
            content={line.value}
            title={line.title}
            wrapCode={line.wrapCode === true}
          />
        </DebugNodeReplRow>
      );
    case "image":
      return <DebugNodeReplImageRow line={line} />;
    case undefined:
      return <DebugField label={line.label} value={line.value} />;
  }
}

function DebugNodeReplRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="relative flex items-start justify-between border-t-[0.5px] border-token-border py-1.5 tabular-nums first:border-t-0"
      style={{ "--debug-label-width": "110px" } as CSSProperties}
    >
      <span
        className="min-w-0 shrink-0 text-left break-words text-token-description-foreground"
        style={{ width: "var(--debug-label-width)" }}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1 pr-3 text-left">{children}</div>
    </div>
  );
}

function DebugNodeReplCodeBlock({
  content,
  title,
  wrapCode,
}: {
  content: string;
  title: string;
  wrapCode: boolean;
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border border-token-border bg-token-text-code-block-background">
      <div className="px-2 py-1 text-xs text-token-description-foreground select-none">{title}</div>
      <div className="overflow-auto p-2 text-size-chat" dir="ltr">
        <code
          className={[
            "block font-mono text-xs text-token-text-primary",
            wrapCode ? "whitespace-pre-wrap break-words" : "whitespace-pre",
          ].join(" ")}
        >
          {content}
        </code>
      </div>
    </div>
  );
}

function DebugNodeReplImageRow({
  line,
}: {
  line: Extract<NodeReplLine, { kind: "image" }>;
}) {
  const [open, setOpen] = useState(false);
  const imageAlt = `${line.label} image`;

  return (
    <DebugNodeReplRow label={line.label}>
      <>
        <button
          type="button"
          className="cursor-interaction overflow-hidden rounded-md border border-token-border bg-token-main-surface-primary p-1 focus:outline-none focus:ring-1 focus:ring-token-focus-border"
          aria-label="Open full-size image"
          title="Open full-size image"
          onClick={() => setOpen(true)}
        >
          <img
            src={line.src}
            alt={imageAlt}
            className="block max-h-48 max-w-full rounded object-contain"
            referrerPolicy="no-referrer"
            decoding="async"
            loading="lazy"
            draggable={false}
          />
          <span className="sr-only">{line.mimeType}</span>
        </button>
        {open ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
            role="dialog"
            aria-modal="true"
            aria-label={imageAlt}
            onClick={() => setOpen(false)}
          >
            <img
              src={line.src}
              alt={imageAlt}
              className="max-h-full max-w-full rounded object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              referrerPolicy="no-referrer"
              decoding="async"
              loading="eager"
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
              }}
            />
          </div>
        ) : null}
      </>
    </DebugNodeReplRow>
  );
}
