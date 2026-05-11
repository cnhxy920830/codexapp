import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import {
  getArchivedThreadsForHost,
  unarchiveConversationForHost,
  type ThreadHistoryEntry,
} from "../services/history";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";

export function DataControlsSettings({
  onDismissToast,
  onShowToast,
  onThreadUnarchived,
  onViewThread,
  selectedHostId,
}: {
  onDismissToast?: () => void;
  onShowToast?: (toast: AppToast) => void;
  onThreadUnarchived?: (threadId: string, hostId: string) => void | Promise<void>;
  onViewThread?: (threadId: string, hostId: string) => void | Promise<void>;
  selectedHostId: string;
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
        const threads = await getArchivedThreadsForHost(selectedHostId);
        if (!cancelled) {
          setArchivedThreads(threads);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setArchivedThreads([]);
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
  }, [selectedHostId]);

  const openUnarchivedConversation = (threadId: string) => {
    onDismissToast?.();
    void onViewThread?.(threadId, selectedHostId);
  };

  const unarchiveArchivedThread = async (thread: ThreadHistoryEntry) => {
    setPendingThreadIds((current) => [...current, thread.id]);
    try {
      await unarchiveConversationForHost({
        hostId: selectedHostId,
        conversationId: thread.id,
      });
      setArchivedThreads((current) => current.filter((entry) => entry.id !== thread.id));
      void onThreadUnarchived?.(thread.id, selectedHostId);
      onShowToast?.({
        tone: "info",
        message: (
          <span>
            {t("settings.dataControls.archivedChats.unarchiveSuccessPlain")}
            {onViewThread ? (
              <button
                type="button"
                onClick={() => openUnarchivedConversation(thread.id)}
                className="pointer-events-auto ml-1 cursor-interaction text-token-link underline-offset-2 hover:underline"
              >
                {t("settings.dataControls.archivedChats.viewNow")}
              </button>
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
    <SettingsContentLayout title={t("settings.section.data-controls")}>
      <SettingsGroup>
        <SettingsGroupContent>
          {isLoading ? (
            <SettingsSurface>
              <SettingsRow label={t("settings.dataControls.archivedChats.loading")} />
            </SettingsSurface>
          ) : loadError ? (
            <SettingsSurface>
              <SettingsRow label={t("settings.dataControls.archivedChats.error")} />
            </SettingsSurface>
          ) : archivedThreads.length === 0 ? (
            <SettingsSurface>
              <SettingsRow label={t("settings.dataControls.archivedChats.empty")} />
            </SettingsSurface>
          ) : (
            <SettingsSurface className="max-h-[min(80vh)] overflow-y-auto">
              {archivedThreads.map((thread) => {
                const isPending = pendingThreadIds.includes(thread.id);
                const title = (thread.name ?? thread.preview).trim() || t("settings.dataControls.archivedChats.untitled");
                const summary = formatArchivedThreadSummary(thread, locale, t);

                return (
                  <div
                    key={thread.id}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-token-list-hover-background"
                  >
                    <div className="min-w-0 flex-1 text-left text-token-text-primary">
                      <div className="truncate text-base font-medium">{title}</div>
                      {summary ? (
                        <div className="mt-1 flex min-w-0 flex-col gap-0.5 text-sm">
                          <div className="truncate text-token-text-secondary">{summary}</div>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      className="shrink-0"
                      color="secondary"
                      size="toolbar"
                      disabled={isPending}
                      loading={isPending}
                      onClick={() => void unarchiveArchivedThread(thread)}
                    >
                      {t("settings.dataControls.archivedChats.unarchive")}
                    </Button>
                  </div>
                );
              })}
            </SettingsSurface>
          )}
        </SettingsGroupContent>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border",
        className,
      )}
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function SettingsRow({ label }: { label: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

function formatArchivedThreadSummary(
  thread: ThreadHistoryEntry,
  locale: string,
  t: (
    key: "settings.dataControls.archivedChats.dateTime" | "settings.dataControls.archivedChats.dateTimeWithRepo",
    values?: Record<string, number | string>,
  ) => string,
) {
  const updatedAt = Number(thread.updatedAt);
  const createdAt = Number(thread.createdAt);
  const updatedAtDate = new Date(updatedAt * 1000);
  const createdAtDate = new Date(createdAt * 1000);
  const date =
    Number.isFinite(updatedAtDate.getTime()) ? updatedAtDate : Number.isFinite(createdAtDate.getTime()) ? createdAtDate : null;
  if (date === null) {
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
