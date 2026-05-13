import type { ReactNode } from "react";
import { useI18n } from "../../i18n/i18n";
import type { ThreadConversation } from "../../services/history";
import { HotkeyWindowDetailLayout } from "./HotkeyWindowDetailLayout";

export function HotkeyWindowThreadPage({
  children,
  conversationId,
  threadConversation,
}: {
  children: ReactNode;
  conversationId: string | null;
  threadConversation: ThreadConversation | null;
}) {
  const { t } = useI18n();
  const trimmedTitle = threadConversation?.title.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : t("hotkeyWindow.defaultTitle");
  const projectLabel = getThreadProjectLabel(threadConversation?.cwd ?? null);
  const mainWindowPath = conversationId ? `/local/${encodeURIComponent(conversationId)}` : "/";

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

function getThreadProjectLabel(cwd: string | null) {
  if (!cwd) {
    return null;
  }

  const normalizedPath = cwd.replace(/[\\/]+$/, "");
  if (normalizedPath.length === 0) {
    return null;
  }

  const pathSegments = normalizedPath.split(/[/\\]+/).filter((segment) => segment.length > 0);
  return pathSegments.at(-1) ?? normalizedPath;
}
