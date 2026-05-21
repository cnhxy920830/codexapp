import { useEffect } from "react";
import { useI18n } from "../../i18n/i18n";
import { HOTKEY_HOME_ROUTE_PATH, HOTKEY_NEW_THREAD_ROUTE_PATH, buildWorktreeInitV2RoutePath, openInHotkeyWindow } from "../../services/windowNavigation";
import { HotkeyWindowDetailLayout } from "./HotkeyWindowDetailLayout";
import { WorktreeInitV2Page } from "../worktreeInit/WorktreeInitV2Page";
import { useHotkeyWindowHotkeyState } from "./hotkeyWindowHotkeyState";

export function HotkeyWindowWorktreeInitPage({
  pendingWorktreeId,
  onEditEnvironment,
  onNavigateToPath,
}: {
  pendingWorktreeId: string | null;
  onEditEnvironment: (params: {
    workspaceRoot: string;
    configPath: string | null;
    mode: "edit" | "preview";
  }) => void;
  onNavigateToPath: (path: string) => void;
}) {
  const { t } = useI18n();
  const hotkeyState = useHotkeyWindowHotkeyState();

  useEffect(() => {
    if (pendingWorktreeId !== null || hotkeyState === null) {
      return;
    }

    onNavigateToPath(
      hotkeyState.configuredHotkey === null
        ? HOTKEY_NEW_THREAD_ROUTE_PATH
        : HOTKEY_HOME_ROUTE_PATH,
    );
  }, [hotkeyState, onNavigateToPath, pendingWorktreeId]);

  if (pendingWorktreeId === null) {
    return null;
  }

  return (
    <main
      aria-label={t("worktreeInitV2.title")}
      className="h-full p-1"
      role="main"
    >
      <HotkeyWindowDetailLayout
        mainWindowPath={buildWorktreeInitV2RoutePath(pendingWorktreeId)}
        title={<span className="max-w-full truncate">{t("worktreeInitV2.title")}</span>}
      >
        <div className="h-full [--padding-panel:calc(var(--padding-panel-base)/2)]">
          <WorktreeInitV2Page
            pendingWorktreeId={pendingWorktreeId}
            onConversationReady={(conversationId) => {
              void openInHotkeyWindow(`/hotkey-window/thread/${encodeURIComponent(conversationId)}`).catch(
                () => undefined,
              );
            }}
            onEditEnvironment={onEditEnvironment}
            onNavigateToNewConversation={({ prefillPrompt }) => {
              const path = prefillPrompt.trim().length > 0
                ? `${HOTKEY_NEW_THREAD_ROUTE_PATH}?prefillPrompt=${encodeURIComponent(prefillPrompt)}`
                : HOTKEY_NEW_THREAD_ROUTE_PATH;
              onNavigateToPath(path);
            }}
            conversationPathBuilder={(conversationId) =>
              `/hotkey-window/thread/${encodeURIComponent(conversationId)}`
            }
            homePath={HOTKEY_HOME_ROUTE_PATH}
          />
        </div>
      </HotkeyWindowDetailLayout>
    </main>
  );
}
