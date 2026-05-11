import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/i18n";

type ScratchpadRowStatus = "loading" | "ready";

type ScratchpadRow = {
  id: string;
  isIndented: boolean;
  status: ScratchpadRowStatus;
  summary: string | null;
  text: string;
  createdAt: number;
};

type PersistedScratchpadState = {
  draftIsIndented: boolean;
  draftText: string;
  rows: ScratchpadRow[];
};

const STORAGE_KEY = "codex-app-replica.scratchpad.v1";
const SUMMARY_DELAY_MS = 550;

export function ScratchpadPage() {
  const { t } = useI18n();
  const [draftText, setDraftText] = useState("");
  const [draftIsIndented, setDraftIsIndented] = useState(false);
  const [rows, setRows] = useState<ScratchpadRow[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const completionTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    const persisted = readPersistedScratchpadState();
    if (persisted) {
      setDraftText(persisted.draftText);
      setDraftIsIndented(persisted.draftIsIndented);
      setRows(persisted.rows);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writePersistedScratchpadState({
      draftIsIndented,
      draftText,
      rows,
    });
  }, [draftIsIndented, draftText, isHydrated, rows]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    for (const row of rows) {
      if (row.status !== "loading" || completionTimersRef.current.has(row.id)) {
        continue;
      }

      const timeoutId = window.setTimeout(() => {
        completionTimersRef.current.delete(row.id);
        setRows((currentRows) =>
          currentRows.map((currentRow) =>
            currentRow.id === row.id
              ? {
                  ...currentRow,
                  status: "ready",
                  summary: buildScratchpadSummary(currentRow.text),
                }
              : currentRow,
          ),
        );
      }, SUMMARY_DELAY_MS);

      completionTimersRef.current.set(row.id, timeoutId);
    }
  }, [isHydrated, rows]);

  useEffect(() => {
    return () => {
      for (const timeoutId of completionTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      completionTimersRef.current.clear();
    };
  }, []);

  const clearRows = () => {
    for (const timeoutId of completionTimersRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    completionTimersRef.current.clear();
    setRows([]);
    setDraftText("");
    setDraftIsIndented(false);
  };

  const submitDraft = () => {
    const text = draftText.trim();
    if (!text) {
      return;
    }

    setRows((currentRows) => [
      ...currentRows,
      {
        id: createScratchpadRowId(),
        isIndented: draftIsIndented,
        status: "loading",
        summary: null,
        text,
        createdAt: Date.now(),
      },
    ]);
    setDraftText("");
    setDraftIsIndented(false);
  };

  const placeholderKey = draftIsIndented
    ? "scratchpadPage.inputPlaceholder.followUp"
    : rows.length > 0
      ? "scratchpadPage.inputPlaceholder.followUpHint"
      : "scratchpadPage.inputPlaceholder.initial";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="draggable grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-[var(--app-shell-border)] px-5 electron:h-toolbar">
        <div className="min-w-0">
          <div className="text-md flex min-w-0 items-center gap-2 truncate text-base electron:font-medium">
            <span className="app-title truncate">{t("scratchpadPage.headerTitle")}</span>
            <span className="app-text-muted shrink-0 text-[12px] font-normal leading-[18px]">
              {t("scratchpadPage.headerSubtitle")}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={clearRows}
            className="app-control rounded-full px-3 py-1 text-[12px]"
          >
            {t("scratchpadPage.clearButton")}
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[var(--thread-composer-max-width)] flex-1 overflow-x-visible overflow-y-auto pt-panel pr-panel pb-panel pl-20">
        <div className="flex w-full flex-col">
          {rows.map((row) => (
            <ScratchpadRowItem key={row.id} row={row} t={t} />
          ))}

          <div className="group relative flex w-full items-start gap-2">
            <div className="flex shrink-0 pt-1.5">
              <UnselectedCircleIcon className="icon-sm shrink-0 text-token-input-placeholder-foreground/70" />
            </div>
            <div className="relative min-w-0 flex-1">
              <textarea
                aria-label={t("scratchpadPage.headerTitle")}
                autoFocus
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    event.preventDefault();
                    setDraftIsIndented(!event.shiftKey);
                    return;
                  }

                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitDraft();
                  }
                }}
                placeholder={t(placeholderKey)}
                rows={1}
                className="max-h-none min-h-9 min-w-0 w-full resize-none border-0 bg-transparent py-1.5 text-base outline-none placeholder:text-token-input-placeholder-foreground"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScratchpadRowItem({ row, t }: { row: ScratchpadRow; t: ReturnType<typeof useI18n>["t"] }) {
  const hoverTimestamp = formatHoverTimestamp(row.createdAt);
  const indentClass = row.isIndented ? "pl-6" : "";

  return (
    <div className={["group relative flex w-full items-start gap-2", indentClass].filter(Boolean).join(" ")}>
      <div className="invisible absolute top-0 left-[-4.5rem] flex h-full w-[4rem] items-start justify-end pt-1.5 pr-2 text-[12px] text-token-description-foreground opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100">
        {hoverTimestamp}
      </div>
      <div className="flex shrink-0 pt-1.5">
        {row.status === "loading" ? (
          <SpinnerIcon className="icon-sm shrink-0 text-token-description-foreground" />
        ) : (
          <CheckCircleFilledIcon className="icon-sm text-token-success-foreground shrink-0" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-1.5">
        <div className="min-w-0 truncate text-base text-token-foreground" title={row.text}>
          {row.text}
        </div>
        {row.status === "loading" ? (
          <div className="app-text-muted mt-1 text-[12px] leading-5">
            {t("scratchpadPage.summaryLoading")}
          </div>
        ) : row.summary ? (
          <div className="app-text-muted mt-1 text-[12px] leading-5">{row.summary}</div>
        ) : null}
      </div>
    </div>
  );
}

function UnselectedCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function CheckCircleFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.59L5.41 12l1.42-1.41L10 13.76l7.17-7.18 1.42 1.42L10 16.59z" />
    </svg>
  );
}

function formatHoverTimestamp(timestampMs: number) {
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildScratchpadSummary(text: string) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return null;
  }

  if (firstLine.length <= 96) {
    return firstLine;
  }

  return `${firstLine.slice(0, 93).trimEnd()}…`;
}

function createScratchpadRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `scratchpad-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readPersistedScratchpadState(): PersistedScratchpadState | null {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return null;
    }

    const parsed = JSON.parse(rawState) as Partial<PersistedScratchpadState>;
    if (!Array.isArray(parsed.rows)) {
      return null;
    }

    const rows = parsed.rows.filter(isScratchpadRow).sort((left, right) => left.createdAt - right.createdAt);
    return {
      draftIsIndented: parsed.draftIsIndented === true,
      draftText: typeof parsed.draftText === "string" ? parsed.draftText : "",
      rows,
    };
  } catch {
    return null;
  }
}

function writePersistedScratchpadState(state: PersistedScratchpadState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures; the page still works for the current session.
  }
}

function isScratchpadRow(value: unknown): value is ScratchpadRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.isIndented === "boolean" &&
    (row.status === "loading" || row.status === "ready") &&
    (row.summary === null || typeof row.summary === "string") &&
    typeof row.text === "string" &&
    typeof row.createdAt === "number"
  );
}
