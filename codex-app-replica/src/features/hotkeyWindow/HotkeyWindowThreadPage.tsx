import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/i18n";
import type { ThreadConversation } from "../../services/history";
import {
  readHotkeyWindowHotkeyState,
  type HotkeyWindowHotkeyStateResponse,
} from "../../services/settings";
import {
  HOTKEY_HOME_ROUTE_PATH,
  HOTKEY_NEW_THREAD_ROUTE_PATH,
} from "../../services/windowNavigation";
import { HotkeyWindowDetailLayout } from "./HotkeyWindowDetailLayout";

export function HotkeyWindowThreadPage({
  children,
  conversationId,
  onNavigateToPath,
  threadConversation,
}: {
  children: ReactNode;
  conversationId: string | null;
  onNavigateToPath: (path: string) => void;
  threadConversation: ThreadConversation | null;
}) {
  const { t } = useI18n();
  const [hotkeyState, setHotkeyState] =
    useState<HotkeyWindowHotkeyStateResponse | undefined>(undefined);

  useEffect(() => {
    if (conversationId !== null) {
      return;
    }

    let cancelled = false;

    void readHotkeyWindowHotkeyState()
      .then((state) => {
        if (!cancelled) {
          setHotkeyState(state);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (conversationId !== null || hotkeyState === undefined) {
      return;
    }

    onNavigateToPath(
      hotkeyState.configuredHotkey === null
        ? HOTKEY_NEW_THREAD_ROUTE_PATH
        : HOTKEY_HOME_ROUTE_PATH,
    );
  }, [conversationId, hotkeyState, onNavigateToPath]);

  if (conversationId === null) {
    return null;
  }

  const trimmedTitle = threadConversation?.title.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : t("hotkeyWindow.defaultTitle");
  const projectLabel = getThreadProjectLabel(threadConversation?.cwd ?? null);
  const mainWindowPath = buildMainWindowLocalThreadPath(conversationId);

  return (
    <main aria-label={title} className="h-full p-1" role="main">
      <HotkeyWindowDetailLayout
        mainWindowPath={mainWindowPath}
        title={
          <div className="flex max-w-full min-w-0 items-baseline gap-2">
            <div className="min-w-0 shrink-[999] truncate text-token-foreground">{title}</div>
            {projectLabel ? (
              <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-token-description-foreground">
                <span className="truncate">{projectLabel}</span>
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

function buildMainWindowLocalThreadPath(conversationId: string) {
  return `/local/${encodeURIComponent(conversationId)}`;
}

function getThreadProjectLabel(cwd: string | null) {
  if (!cwd) {
    return null;
  }

  const normalizedPath = cwd.replace(/[\\/]+$/, "");
  if (normalizedPath.length === 0) {
    return null;
  }

  const pathSegments = normalizedPath.split(/[/\\]+/).filter((segment) => segment.length > 0);
  return truncateProjectLabel(pathSegments.at(-1) ?? normalizedPath);
}

function truncateProjectLabel(value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const parts = trimmedValue.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length <= 3) {
    return trimmedValue;
  }

  return parts.slice(0, 3).join(" ");
}
