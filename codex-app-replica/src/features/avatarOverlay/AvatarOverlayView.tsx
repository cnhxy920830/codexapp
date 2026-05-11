import { useI18n } from "../../i18n/i18n";
import { AvatarSprite } from "../../components/appearance/AvatarSprite";
import type { AvatarOption } from "../../components/appearance/avatarData";

export type AvatarOverlayViewProps = {
  selectedAvatar: AvatarOption;
  notificationCount: number;
  isTrayOpen: boolean;
  onToggleTray: () => void;
  onCollapseTray: () => void;
};

export function AvatarOverlayView({
  selectedAvatar,
  notificationCount,
  isTrayOpen,
  onToggleTray,
  onCollapseTray,
}: AvatarOverlayViewProps) {
  const { t } = useI18n();
  const trayAriaLabel = t("avatarOverlay.toggleNotificationTray", {
    count: notificationCount,
  });
  const mascotAriaLabel = t("petOverlay.mascotLabel", { petName: selectedAvatar.displayName });

  return (
    <main
      data-page="avatar-overlay"
      className="flex h-full w-full select-none flex-col items-center justify-end overflow-hidden bg-transparent text-token-foreground"
    >
      <section
        aria-label={t("avatarOverlay.notificationList")}
        className="pointer-events-none flex w-full max-w-[340px] flex-col items-stretch gap-2 px-4 pb-3"
      >
        {isTrayOpen ? <NotificationTrayShell onCollapse={onCollapseTray} /> : null}
      </section>
      <div className="relative flex items-end gap-2 pb-3">
        <button
          type="button"
          aria-label={mascotAriaLabel}
          data-avatar-mascot="true"
          data-testid="avatar-mascot-button"
          className="no-drag relative flex size-20 cursor-interaction items-center justify-center rounded-full bg-transparent focus:outline-none"
          onClick={onToggleTray}
        >
          <AvatarSprite avatar={selectedAvatar} size="md" />
        </button>
        {notificationCount > 0 ? (
          <span
            data-testid="avatar-overlay-notification-badge"
            aria-label={trayAriaLabel}
            className="no-drag absolute top-0 right-0 z-20 flex min-h-7 min-w-7 cursor-interaction items-center justify-center rounded-full border border-token-border/60 bg-token-foreground px-2 py-1 text-xs leading-none font-medium text-token-dropdown-background shadow-sm"
          >
            {t("avatarOverlay.compactOlderNotificationCount", { count: notificationCount })}
          </span>
        ) : null}
      </div>
    </main>
  );
}

function NotificationTrayShell({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-token-border bg-token-main-surface-primary p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-size-chat-sm font-medium text-token-foreground">
          {t("avatarOverlay.latestNotifications")}
        </span>
        <button
          type="button"
          aria-label={t("avatarOverlay.collapseNotificationTray")}
          className="flex size-6 cursor-interaction items-center justify-center rounded-md text-token-text-secondary hover:bg-token-list-hover-background"
          onClick={onCollapse}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <p className="text-size-chat-sm text-token-text-secondary">{t("history.noMessageYet")}</p>
    </div>
  );
}
