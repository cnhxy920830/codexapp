import { useEffect, type ReactNode } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  HOTKEY_HOME_ROUTE_PATH,
  HOTKEY_NEW_THREAD_ROUTE_PATH,
} from "../../services/windowNavigation";
import type { RemoteTaskReadResponse } from "../../services/remoteTasks";
import { HotkeyWindowDetailLayout } from "./HotkeyWindowDetailLayout";
import { useHotkeyWindowHotkeyState } from "./hotkeyWindowHotkeyState";

export function HotkeyWindowRemoteConversationPage({
  children,
  onNavigateToPath,
  taskId,
  task,
}: {
  children: ReactNode;
  onNavigateToPath: (path: string) => void;
  taskId: string | null;
  task: RemoteTaskReadResponse | null;
}) {
  const { t } = useI18n();
  const hotkeyState = useHotkeyWindowHotkeyState();

  useEffect(() => {
    if (taskId !== null || hotkeyState === null) {
      return;
    }

    onNavigateToPath(
      hotkeyState.configuredHotkey === null
        ? HOTKEY_NEW_THREAD_ROUTE_PATH
        : HOTKEY_HOME_ROUTE_PATH,
    );
  }, [hotkeyState, onNavigateToPath, taskId]);

  if (taskId === null) {
    return null;
  }

  const trimmedTitle = task?.task.title?.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : t("hotkeyWindow.defaultTitle");
  const environmentLabel = task?.task.task_status_display?.environment_label?.trim() ?? "";
  const mainWindowPath = buildMainWindowRemoteThreadPath(taskId);

  return (
    <main aria-label={title} className="h-full p-1" role="main">
      <HotkeyWindowDetailLayout
        mainWindowPath={mainWindowPath}
        title={
          <div className="flex max-w-full min-w-0 items-baseline gap-2">
            <div className="min-w-0 shrink-[999] truncate text-token-foreground">{title}</div>
            {environmentLabel.length > 0 ? (
              <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-token-description-foreground">
                <span className="truncate">{environmentLabel}</span>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="h-full [--padding-panel:calc(var(--padding-panel-base)/2)]">{children}</div>
      </HotkeyWindowDetailLayout>
    </main>
  );
}

function buildMainWindowRemoteThreadPath(taskId: string) {
  return `/remote/${encodeURIComponent(taskId)}`;
}
