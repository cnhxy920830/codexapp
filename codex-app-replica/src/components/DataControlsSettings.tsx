import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n";
import {
  getArchivedThreads,
  unarchiveThread,
  type ThreadHistoryEntry,
} from "../services/history";
import type { AppToast } from "./AppToastRegion";

export function DataControlsSettings({
  onDismissToast,
  onShowToast,
  onThreadUnarchived,
  onViewThread,
}: {
  onDismissToast?: () => void;
  onShowToast?: (toast: AppToast) => void;
  onThreadUnarchived?: (threadId: string) => void | Promise<void>;
  onViewThread?: (threadId: string) => void | Promise<void>;
}) {
  const { locale, t } = useI18n();
  const [archivedThreads, setArchivedThreads] = useState<ThreadHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingThreadIds, setPendingThreadIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const threads = await getArchivedThreads();
        if (!cancelled) {
          setArchivedThreads(threads);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const unarchiveArchivedThread = async (thread: ThreadHistoryEntry) => {
    setPendingThreadIds((current) => [...current, thread.id]);
    try {
      await unarchiveThread(thread.id);
      setArchivedThreads((current) => current.filter((entry) => entry.id !== thread.id));
      void onThreadUnarchived?.(thread.id);
      onShowToast?.({
        tone: "info",
        message: (
          <span>
            {t("settings.dataControls.archivedChats.unarchiveSuccessPlain")}
            {onViewThread ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    onDismissToast?.();
                    void onViewThread(thread.id);
                  }}
                  className="cursor-interaction text-[var(--app-shell-accent)] underline underline-offset-2 hover:opacity-80"
                >
                  {t("settings.dataControls.archivedChats.viewNow")}
                </button>
              </>
            ) : null}
          </span>
        ),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.dataControls.archivedChats.unarchiveError"),
      });
    } finally {
      setPendingThreadIds((current) => current.filter((threadId) => threadId !== thread.id));
    }
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.section.data-controls")}</div>
      </div>

      <div className="app-card rounded-[18px] px-0 py-0">
        {isLoading ? (
          <ArchivedThreadStateRow label={t("settings.dataControls.archivedChats.loading")} />
        ) : loadError ? (
          <ArchivedThreadStateRow label={t("settings.dataControls.archivedChats.error")} />
        ) : archivedThreads.length === 0 ? (
          <ArchivedThreadStateRow label={t("settings.dataControls.archivedChats.empty")} />
        ) : (
          <div className="max-h-[80vh] overflow-y-auto">
            {archivedThreads.map((thread) => {
              const isPending = pendingThreadIds.includes(thread.id);
              const title = (thread.name ?? thread.preview).trim() || t("settings.dataControls.archivedChats.untitled");
              const summary = formatArchivedThreadSummary(thread, locale, t);

              return (
                <div
                  key={thread.id}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--app-shell-muted-surface)]"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[16px] font-medium">{title}</div>
                    {summary ? (
                      <div className="app-text-muted mt-1 truncate text-[13px] leading-5">
                        {summary}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void unarchiveArchivedThread(thread)}
                    className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                  >
                    {t("settings.dataControls.archivedChats.unarchive")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchivedThreadStateRow({ label }: { label: string }) {
  return (
    <div className="px-5 py-4">
      <div className="app-text-muted text-[14px] leading-6">{label}</div>
    </div>
  );
}

function formatArchivedThreadSummary(
  thread: ThreadHistoryEntry,
  locale: string,
  t: (key: "settings.dataControls.archivedChats.dateTime" | "settings.dataControls.archivedChats.dateTimeWithRepo", values?: Record<string, number | string>) => string,
) {
  const primaryTimestamp = Number.isFinite(thread.updatedAt) ? thread.updatedAt : thread.createdAt;
  const date = new Date(primaryTimestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const repo = deriveProjectName(thread.cwd) ?? deriveProjectName(thread.path);
  const formattedDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (repo) {
    return t("settings.dataControls.archivedChats.dateTimeWithRepo", {
      date: formattedDate,
      time: formattedTime,
      repo,
    });
  }

  return t("settings.dataControls.archivedChats.dateTime", {
    date: formattedDate,
    time: formattedTime,
  });
}

function deriveProjectName(path: string | null | undefined) {
  if (!path) {
    return null;
  }
  const segments = path.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? null;
}
