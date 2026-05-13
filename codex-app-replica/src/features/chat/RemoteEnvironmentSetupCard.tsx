import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  extractRemoteTaskSetupLogEntries,
  readRemoteTaskTurnLogs,
  resolveRemoteTaskEnvironmentSetupState,
  type RemoteTaskSetupLogEntry,
  type RemoteTaskTurn,
} from "../../services/remoteTasks";

const REMOTE_TASK_SETUP_LOG_POLL_INTERVAL_MS = 2_000;

export function RemoteEnvironmentSetupCard({
  assistantTurn,
  taskId,
}: {
  assistantTurn: RemoteTaskTurn;
  taskId: string;
}) {
  const { t } = useI18n();
  const setupState = resolveRemoteTaskEnvironmentSetupState(assistantTurn);
  const [logs, setLogs] = useState<RemoteTaskSetupLogEntry[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!setupState || taskId.trim().length === 0 || assistantTurn.id.trim().length === 0) {
      setLogs([]);
      return;
    }

    let isDisposed = false;

    const loadLogs = async () => {
      try {
        const response = await readRemoteTaskTurnLogs({
          taskId,
          turnId: assistantTurn.id,
        });
        if (isDisposed) {
          return;
        }
        setLogs(extractRemoteTaskSetupLogEntries(response));
      } catch {
        if (!isDisposed) {
          setLogs((current) => current);
        }
      }
    };

    void loadLogs();
    if (setupState !== "running") {
      return () => {
        isDisposed = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void loadLogs();
    }, REMOTE_TASK_SETUP_LOG_POLL_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [assistantTurn.id, setupState, taskId]);

  const output = logs.map((entry) => entry.line).join("\n");

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [output]);

  if (!setupState) {
    return null;
  }

  const title =
    setupState === "failed"
      ? t("remoteConversation.environmentSetup.failed")
      : t("remoteConversation.environmentSetup.running");

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="text-[13px] text-[var(--app-shell-subtle)]">{title}</div>
      <div
        ref={scrollContainerRef}
        className="min-h-[180px] max-h-[500px] overflow-auto rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] px-4 py-3 font-mono text-[12px] leading-6 text-[var(--app-shell-subtle)]"
      >
        {output.length > 0 ? (
          <pre className="whitespace-pre-wrap">{output}</pre>
        ) : (
          <span className="text-[var(--app-shell-placeholder)]">
            {t("remoteConversation.environmentSetup.output.empty")}
          </span>
        )}
      </div>
    </div>
  );
}
