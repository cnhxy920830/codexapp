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
      <div className="border-b border-[var(--app-shell-border)] px-5 py-4">
        <div className="mx-auto flex max-w-[820px] items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="app-title text-[14px] font-medium">{t("scratchpadPage.headerTitle")}</div>
            <div className="app-text-muted mt-1 text-[13px] leading-6">{t("scratchpadPage.headerSubtitle")}</div>
          </div>
          <button
            type="button"
            onClick={clearRows}
            className="app-control rounded-full px-3 py-1.5 text-[12px]"
          >
            {t("scratchpadPage.clearButton")}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[820px] flex-col gap-3 px-5 py-5">
          {rows.map((row) => (
            <ScratchpadRowCard key={row.id} row={row} t={t} />
          ))}

          <div className={["app-card rounded-[18px] px-4 py-4", draftIsIndented ? "ml-6" : ""].join(" ")}>
            <div className="flex items-start gap-3">
              <div className="pt-1 text-[12px] leading-6 text-[var(--app-shell-subtle)]">
                {draftIsIndented ? "↳" : "•"}
              </div>
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
                rows={4}
                className="app-text-input min-h-[104px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScratchpadRowCard({ row, t }: { row: ScratchpadRow; t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <div className={row.isIndented ? "ml-6" : ""}>
      <div className="app-card rounded-[18px] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="pt-1 text-[12px] leading-6 text-[var(--app-shell-subtle)]">
            {row.isIndented ? "↳" : "•"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="whitespace-pre-wrap text-[14px] leading-6">{row.text}</div>
            {row.status === "loading" ? (
              <div className="app-text-muted mt-2 text-[12px] leading-5">{t("scratchpadPage.summaryLoading")}</div>
            ) : row.summary ? (
              <div className="app-text-muted mt-2 text-[12px] leading-5">{row.summary}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
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
