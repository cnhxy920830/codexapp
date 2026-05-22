import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n";
import {
  getArchivedThreadsForHost,
  unarchiveConversationForHost,
  type ThreadHistoryEntry,
} from "../services/history";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";

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
  const [isLoadError, setIsLoadError] = useState(false);
  const [pendingThreadIds, setPendingThreadIds] = useState<string[]>([]);
  const archivedThreadsRequestIdRef = useRef(0);
  const selectedHostIdRef = useRef(selectedHostId);

  selectedHostIdRef.current = selectedHostId;

  const loadArchivedThreads = async ({
    clearOnError,
    hostId,
    showLoading,
  }: {
    clearOnError: boolean;
    hostId: string;
    showLoading: boolean;
  }) => {
    const requestId = ++archivedThreadsRequestIdRef.current;

    if (showLoading) {
      setIsLoading(true);
      setIsLoadError(false);
    }

    try {
      const threads = await getArchivedThreadsForHost(hostId);
      if (
        requestId !== archivedThreadsRequestIdRef.current ||
        hostId !== selectedHostIdRef.current
      ) {
        return;
      }

      setArchivedThreads(threads);
      setIsLoadError(false);
    } catch (error) {
      if (
        requestId !== archivedThreadsRequestIdRef.current ||
        hostId !== selectedHostIdRef.current
      ) {
        return;
      }

      void error;
      if (clearOnError) {
        setIsLoadError(true);
        setArchivedThreads([]);
      }
    } finally {
      if (
        showLoading &&
        requestId === archivedThreadsRequestIdRef.current &&
        hostId === selectedHostIdRef.current
      ) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadArchivedThreads({
      hostId: selectedHostId,
      showLoading: true,
      clearOnError: true,
    });
  }, [selectedHostId]);

  useEffect(() => {
    const handleFocus = () => {
      void loadArchivedThreads({
        hostId: selectedHostIdRef.current,
        showLoading: false,
        clearOnError: false,
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const openUnarchivedConversation = (threadId: string) => {
    onDismissToast?.();
    void onViewThread?.(threadId, selectedHostId);
  };

  const unarchiveArchivedThread = async (thread: ThreadHistoryEntry) => {
    const previousThreads = archivedThreads;
    setPendingThreadIds((current) => [...current, thread.id]);
    setArchivedThreads((current) => current.filter((entry) => entry.id !== thread.id));
    try {
      await unarchiveConversationForHost({
        hostId: selectedHostId,
        conversationId: thread.id,
      });
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
      setArchivedThreads(previousThreads);
      onShowToast?.({
        tone: "error",
        message: t("settings.dataControls.archivedChats.unarchiveError"),
      });
    } finally {
      setPendingThreadIds((current) => current.filter((threadId) => threadId !== thread.id));
      void loadArchivedThreads({
        hostId: selectedHostId,
        showLoading: false,
        clearOnError: false,
      });
    }
  };

  return (
    <SettingsContentLayout title={<SettingsSectionTitle slug="data-controls" />}>
      <SettingsGroup className="gap-2">
        <SettingsGroup.Content>
          {isLoading ? (
            <SettingsSurface>
              <SettingsRow label={t("settings.dataControls.archivedChats.loading")} />
            </SettingsSurface>
          ) : isLoadError ? (
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
                const title =
                  normalizeArchivedThreadTitle(thread.name) ??
                  normalizeArchivedThreadTitle(thread.preview) ??
                  t("settings.dataControls.archivedChats.untitled");
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
        </SettingsGroup.Content>
      </SettingsGroup>
    </SettingsContentLayout>
  );
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
  return normalizeProjectName(segments.at(-1));
}

function normalizeArchivedThreadTitle(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const firstLine = trimmed.split(/\r?\n/u, 1)[0] ?? trimmed;
  const normalized = firstLine.replace(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProjectName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const words = trimmed.split(/\s+/u).filter(Boolean);
  if (words.length <= 3) {
    return trimmed;
  }

  return words.slice(0, 3).join(" ");
}
