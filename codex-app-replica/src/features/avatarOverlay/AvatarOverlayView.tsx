import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { MessageKey } from "../../i18n/messages";
import { useI18n } from "../../i18n/i18n";
import {
  CheckCircleFilledIcon,
  ChevronDownIcon,
  ClockIcon,
} from "../../components/AppShellIcons";
import { AvatarSprite } from "../../components/appearance/AvatarSprite";
import type { AvatarOption } from "../../components/appearance/avatarData";
import type {
  AvatarOverlayNotification,
  AvatarOverlayNotificationStatus,
} from "./avatarOverlayNotifications";

const TRAY_SCROLL_EPSILON = 2;
const COLLAPSED_BODY_MAX_HEIGHT_PX = 32;
const EXPANDED_BODY_MAX_HEIGHT_PX = 512;

const TRAY_EDGE_CONTROL_CLASSNAME =
  "group no-drag absolute left-1/2 z-10 flex h-5 -translate-x-1/2 cursor-interaction items-center justify-center gap-0.5 rounded-full border border-token-border bg-token-main-surface-primary px-2 text-[10px] leading-none font-medium text-token-text-secondary shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] backdrop-blur hover:text-token-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border forced-colors:bg-[Canvas]";

export type AvatarOverlayTrayScrollState = {
  hasScrollableContent: boolean;
  hasLatestNotificationsAbove: boolean;
  hiddenOlderNotificationCount: number;
};

export type AvatarOverlayViewTestState = {
  expandedNotificationIds?: string[];
  forceControlsVisible?: boolean;
  forceExpandableNotificationIds?: string[];
  forceTrayScrollState?: AvatarOverlayTrayScrollState;
  replyOpenNotificationId?: string | null;
};

export type AvatarOverlayViewProps = {
  selectedAvatar: AvatarOption;
  notifications: AvatarOverlayNotification[];
  isTrayOpen: boolean;
  interactiveRegionRef?: RefObject<HTMLElement | null>;
  onToggleTray: () => void;
  onCollapseTray: () => void;
  onOpenNotification: (notification: AvatarOverlayNotification) => void;
  onDismissNotification: (notification: AvatarOverlayNotification) => void;
  onNotificationReplyEditorActiveChange?: (isActive: boolean) => void;
  onOpenNotificationReply?: (notification: AvatarOverlayNotification) => void;
  onSubmitNotificationReply?: (
    notification: AvatarOverlayNotification,
    prompt: string,
  ) => Promise<unknown> | unknown;
  testState?: AvatarOverlayViewTestState;
};

export function AvatarOverlayView({
  selectedAvatar,
  notifications,
  isTrayOpen,
  interactiveRegionRef,
  onToggleTray,
  onCollapseTray,
  onOpenNotification,
  onDismissNotification,
  onNotificationReplyEditorActiveChange,
  onOpenNotificationReply,
  onSubmitNotificationReply,
  testState,
}: AvatarOverlayViewProps) {
  const { t } = useI18n();
  const notificationCount = notifications.length;
  const topNotification = notifications[0] ?? null;
  const topNotificationAppearance = getNotificationAppearance(topNotification?.status);
  const trayAriaLabel = t("avatarOverlay.toggleNotificationTray", {
    count: notificationCount,
  });
  const mascotAriaLabel = t("petOverlay.mascotLabel", { petName: selectedAvatar.displayName });

  return (
    <main
      ref={interactiveRegionRef as RefObject<HTMLElement> | undefined}
      data-page="avatar-overlay"
      className="flex h-full w-full select-none flex-col items-center justify-end overflow-hidden bg-transparent text-token-foreground"
    >
      <section
        aria-label={t("avatarOverlay.notificationList")}
        className="pointer-events-none flex w-full max-w-[340px] flex-col items-stretch gap-2 px-4 pb-3"
      >
        {isTrayOpen ? (
          <NotificationTray
            notifications={notifications}
            onCollapse={onCollapseTray}
            onDismissNotification={onDismissNotification}
            onNotificationReplyEditorActiveChange={onNotificationReplyEditorActiveChange}
            onOpenNotification={onOpenNotification}
            onOpenNotificationReply={onOpenNotificationReply}
            onSubmitNotificationReply={onSubmitNotificationReply}
            testState={testState}
          />
        ) : null}
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
          <button
            type="button"
            data-avatar-overlay-hit-region="true"
            data-testid="avatar-overlay-notification-badge"
            aria-label={trayAriaLabel}
            className="no-drag absolute top-0 right-0 z-20 flex min-h-7 min-w-7 cursor-interaction items-center justify-center rounded-full border border-token-border/60 px-2 py-1 text-xs leading-none font-medium shadow-sm focus:outline-none"
            onClick={onToggleTray}
            style={{
              backgroundColor: topNotificationAppearance.badgeBackgroundColor,
              color: topNotificationAppearance.badgeForegroundColor,
            }}
          >
            {t("avatarOverlay.compactOlderNotificationCount", { count: notificationCount })}
          </button>
        ) : null}
      </div>
    </main>
  );
}

function NotificationTray({
  notifications,
  onCollapse,
  onDismissNotification,
  onNotificationReplyEditorActiveChange,
  onOpenNotification,
  onOpenNotificationReply,
  onSubmitNotificationReply,
  testState,
}: {
  notifications: AvatarOverlayNotification[];
  onCollapse: () => void;
  onDismissNotification: (notification: AvatarOverlayNotification) => void;
  onNotificationReplyEditorActiveChange?: (isActive: boolean) => void;
  onOpenNotification: (notification: AvatarOverlayNotification) => void;
  onOpenNotificationReply?: (notification: AvatarOverlayNotification) => void;
  onSubmitNotificationReply?: (
    notification: AvatarOverlayNotification,
    prompt: string,
  ) => Promise<unknown> | unknown;
  testState?: AvatarOverlayViewTestState;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [replyOpenNotificationId, setReplyOpenNotificationId] = useState<string | null>(null);
  const [scrollState, setScrollState] = useState<AvatarOverlayTrayScrollState>(
    testState?.forceTrayScrollState ?? {
      hasScrollableContent: false,
      hasLatestNotificationsAbove: false,
      hiddenOlderNotificationCount: 0,
    },
  );
  const controlledReplyOpenNotificationId = testState?.replyOpenNotificationId;
  const activeReplyOpenNotificationId =
    controlledReplyOpenNotificationId === undefined
      ? replyOpenNotificationId
      : controlledReplyOpenNotificationId;

  useEffect(() => {
    const isActive = activeReplyOpenNotificationId != null;
    onNotificationReplyEditorActiveChange?.(isActive);
  }, [activeReplyOpenNotificationId, onNotificationReplyEditorActiveChange]);

  useEffect(() => {
    return () => {
      onNotificationReplyEditorActiveChange?.(false);
    };
  }, [onNotificationReplyEditorActiveChange]);

  useLayoutEffect(() => {
    if (testState?.forceTrayScrollState != null) {
      setScrollState(testState.forceTrayScrollState);
      return undefined;
    }

    const element = listRef.current;
    if (element == null) {
      setScrollState({
        hasScrollableContent: false,
        hasLatestNotificationsAbove: false,
        hiddenOlderNotificationCount: 0,
      });
      return undefined;
    }

    let frameId: number | null = null;
    const update = () => {
      frameId = null;
      const next = getTrayScrollState(element);
      setScrollState((current) => (trayScrollStateEquals(current, next) ? current : next));
    };
    const scheduleUpdate = () => {
      if (frameId != null || typeof window === "undefined") {
        return;
      }
      frameId = window.requestAnimationFrame(update);
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    element.addEventListener("scroll", scheduleUpdate);
    resizeObserver?.observe(element);
    for (const row of getTrayScrollRows(element)) {
      resizeObserver?.observe(row);
    }
    scheduleUpdate();

    return () => {
      element.removeEventListener("scroll", scheduleUpdate);
      resizeObserver?.disconnect();
      if (frameId != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    notifications,
    activeReplyOpenNotificationId,
    testState?.forceTrayScrollState,
  ]);

  const handleOpenReply = (notification: AvatarOverlayNotification) => {
    if (notification.localConversationId == null) {
      return;
    }
    onOpenNotificationReply?.(notification);
    if (controlledReplyOpenNotificationId === undefined) {
      setReplyOpenNotificationId(notification.id);
    }
  };

  const handleCloseReply = () => {
    if (controlledReplyOpenNotificationId === undefined) {
      setReplyOpenNotificationId(null);
    }
  };

  return (
    <div
      data-avatar-overlay-hit-region="true"
      data-avatar-overlay-size="notification-tray"
      className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-token-border bg-token-main-surface-primary p-3 shadow-lg"
    >
      <div
        data-avatar-overlay-size="notification-tray-header"
        className="flex items-center justify-between"
      >
        <span className="text-size-chat-sm font-medium text-token-foreground">
          {t("avatarOverlay.latestNotifications")}
        </span>
        <button
          type="button"
          aria-label={t("avatarOverlay.collapseNotificationTray")}
          className="flex size-6 cursor-interaction items-center justify-center rounded-md text-token-text-secondary hover:bg-token-list-hover-background focus:outline-none"
          onClick={onCollapse}
        >
          <ChevronDownIcon className="icon-xs" />
        </button>
      </div>
      {notifications.length === 0 ? (
        <p className="text-size-chat-sm text-token-text-secondary">{t("history.noMessageYet")}</p>
      ) : (
        <div className="relative">
          {scrollState.hasLatestNotificationsAbove ? (
            <button
              type="button"
              aria-label={t("avatarOverlay.showLatestNotifications")}
              className={`${TRAY_EDGE_CONTROL_CLASSNAME} top-1`}
              onClick={() => {
                const element = listRef.current;
                if (element == null) {
                  return;
                }
                element.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
            >
              <ChevronDownIcon className="icon-[10px] rotate-180 opacity-70" />
              <span>{t("avatarOverlay.latestNotifications")}</span>
            </button>
          ) : null}
          <div
            ref={listRef}
            role="list"
            data-avatar-overlay-size="notification-tray-list"
            className="flex max-h-60 snap-y snap-mandatory flex-col gap-2 overflow-y-auto pr-0.5"
          >
            {notifications.map((notification) => (
              <NotificationTrayRow
                key={notification.id}
                forceControlsVisible={testState?.forceControlsVisible === true}
                forceExpandable={testState?.forceExpandableNotificationIds?.includes(
                  notification.id,
                )}
                initiallyExpanded={testState?.expandedNotificationIds?.includes(notification.id)}
                isReplyEditorOpen={activeReplyOpenNotificationId === notification.id}
                notification={notification}
                onCloseReply={handleCloseReply}
                onDismissNotification={onDismissNotification}
                onOpenNotification={onOpenNotification}
                onOpenReply={handleOpenReply}
                onSubmitNotificationReply={onSubmitNotificationReply}
              />
            ))}
          </div>
          {scrollState.hiddenOlderNotificationCount > 0 ? (
            <button
              type="button"
              aria-label={t("avatarOverlay.showOlderNotifications", {
                count: scrollState.hiddenOlderNotificationCount,
              })}
              className={`${TRAY_EDGE_CONTROL_CLASSNAME} bottom-1`}
              onClick={() => {
                const element = listRef.current;
                if (element == null) {
                  return;
                }
                const rows = getTrayScrollRows(element);
                const currentIndex = findTrayScrollIndex(
                  rows,
                  getTrayTopAnchor(element, rows),
                );
                const nextIndex = Math.min(currentIndex + 1, rows.length - 1);
                const anchorOffsetTop = rows[0]?.offsetTop ?? 0;
                element.scrollTo({
                  top: Math.max(0, rows[nextIndex]?.offsetTop - anchorOffsetTop),
                  behavior: "smooth",
                });
              }}
            >
              <span>
                {t("avatarOverlay.olderNotificationCount", {
                  count: scrollState.hiddenOlderNotificationCount,
                })}
              </span>
              <ChevronDownIcon className="icon-[10px] opacity-70" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NotificationTrayRow({
  forceControlsVisible,
  forceExpandable,
  initiallyExpanded = false,
  isReplyEditorOpen,
  notification,
  onCloseReply,
  onDismissNotification,
  onOpenNotification,
  onOpenReply,
  onSubmitNotificationReply,
}: {
  forceControlsVisible: boolean;
  forceExpandable?: boolean;
  initiallyExpanded?: boolean;
  isReplyEditorOpen: boolean;
  notification: AvatarOverlayNotification;
  onCloseReply: () => void;
  onDismissNotification: (notification: AvatarOverlayNotification) => void;
  onOpenNotification: (notification: AvatarOverlayNotification) => void;
  onOpenReply: (notification: AvatarOverlayNotification) => void;
  onSubmitNotificationReply?: (
    notification: AvatarOverlayNotification,
    prompt: string,
  ) => Promise<unknown> | unknown;
}) {
  const { t } = useI18n();
  const appearance = getNotificationAppearance(notification.status);
  const fallbackBody = t(appearance.fallbackBodyKey);
  const body = notification.body ?? fallbackBody;
  const statusLabel = t(appearance.labelKey);
  const trimmedStatusLabel = trimStatusBody(statusLabel);
  const trimmedBody = trimStatusBody(body);
  const bodyForAria =
    notification.body == null && trimmedBody === trimmedStatusLabel ? "" : trimmedBody;
  const ariaLabel = [
    notification.title,
    statusLabel,
    bodyForAria,
    t("avatarOverlay.openNotification"),
  ]
    .filter((segment) => segment.length > 0)
    .join(". ");
  const canReply = notification.localConversationId != null && onSubmitNotificationReply != null;
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyValue, setReplyValue] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isControlActive, setIsControlActive] = useState(false);
  const measureBodyRef = useRef<HTMLDivElement | null>(null);
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(0);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const measureElement = measureBodyRef.current;
    if (measureElement == null) {
      return undefined;
    }

    const updateHeight = () => {
      const nextHeight = measureElement.scrollHeight;
      setMeasuredBodyHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(measureElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [body]);

  useEffect(() => {
    if (!isReplyEditorOpen) {
      setReplyError(null);
      setReplyValue("");
      return;
    }

    replyInputRef.current?.focus();
  }, [isReplyEditorOpen]);

  const canExpand =
    forceExpandable === true ||
    measuredBodyHeight > COLLAPSED_BODY_MAX_HEIGHT_PX + 1 ||
    body.length > 120 ||
    body.includes("\n");
  const showExpandedBody = canExpand && isExpanded && !isReplyEditorOpen;
  const showControls = forceControlsVisible || isControlActive || isReplyEditorOpen;

  const handleOpen = () => {
    onOpenNotification(notification);
  };

  const handleOpenKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleOpen();
  };

  const handleReplySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReply || isSubmittingReply) {
      return;
    }

    const prompt = replyValue.trim();
    if (prompt.length === 0) {
      return;
    }

    try {
      setIsSubmittingReply(true);
      setReplyError(null);
      await onSubmitNotificationReply(notification, prompt);
      onCloseReply();
    } catch {
      setReplyError(t("avatarOverlay.notificationReplyError"));
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div
      role="listitem"
      className="group no-drag relative w-full snap-start scroll-mt-2 text-left"
      data-avatar-overlay-measure="notification-tray-row"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }
        setIsControlActive(false);
      }}
      onFocusCapture={() => {
        setIsControlActive(true);
      }}
      onPointerEnter={() => {
        setIsControlActive(true);
      }}
      onPointerLeave={() => {
        setIsControlActive(false);
      }}
    >
      <div className="relative z-[1] overflow-hidden rounded-[18px] border border-token-border/60 bg-token-main-surface-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(0,0,0,0.08)]">
        <div
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
          className="block w-full min-w-0 cursor-interaction px-3 py-1.5 text-left focus:outline-none focus-visible:outline focus-visible:outline-token-focus focus-visible:outline-offset-[-2px]"
          onClick={handleOpen}
          onKeyDown={handleOpenKeyDown}
        >
          <span className="flex min-w-0 items-center gap-2 pr-7">
            <span className={appearance.iconClassName}>{renderNotificationIcon(notification.status)}</span>
            <span className="text-size-chat min-w-0 truncate leading-[17px] font-semibold text-token-foreground">
              {notification.title}
            </span>
          </span>
          <div
            className={`text-size-chat-sm mt-0.5 overflow-hidden leading-4 text-token-foreground ${
              showExpandedBody ? "whitespace-pre-wrap" : "line-clamp-2"
            }`}
            style={{
              maxHeight: showExpandedBody
                ? `${EXPANDED_BODY_MAX_HEIGHT_PX}px`
                : `${COLLAPSED_BODY_MAX_HEIGHT_PX}px`,
            }}
          >
            {body}
          </div>
        </div>
        <div
          ref={measureBodyRef}
          aria-hidden="true"
          className="text-size-chat-sm pointer-events-none invisible absolute inset-x-3 top-0 -z-10 leading-4 whitespace-pre-wrap"
        >
          {body}
        </div>
        <span
          className={`pointer-events-none absolute top-1 right-1 z-0 flex size-6 items-center justify-center ${
            canExpand && showControls ? "opacity-0" : "opacity-100"
          }`}
        >
          {renderNotificationIcon(notification.status)}
        </span>
        {canExpand ? (
          <div
            className={`absolute top-1 right-1 z-10 ${
              showControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <button
              type="button"
              aria-expanded={showExpandedBody}
              aria-label={t(
                showExpandedBody
                  ? "avatarOverlay.collapseNotification"
                  : "avatarOverlay.expandNotification",
                { title: notification.title },
              )}
              className="flex size-6 cursor-interaction items-center justify-center rounded-md border border-token-border bg-token-main-surface-primary text-token-text-secondary shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] hover:text-token-foreground focus:outline-none"
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded((current) => !current);
              }}
            >
              <ChevronDownIcon
                className={`icon-xs transition-transform duration-150 ${
                  showExpandedBody ? "rotate-90" : "-rotate-90"
                }`}
              />
            </button>
          </div>
        ) : null}
        {canReply && !isReplyEditorOpen ? (
          <div
            className={`no-drag absolute right-2 bottom-1 z-10 ${
              showControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <button
              type="button"
              aria-label={t("avatarOverlay.replyNotification", { title: notification.title })}
              className="h-5 cursor-interaction rounded-md border border-token-border bg-token-main-surface-primary px-2 text-xs leading-none text-token-foreground shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] focus:outline-none"
              onClick={(event) => {
                event.stopPropagation();
                setReplyError(null);
                setReplyValue("");
                onOpenReply(notification);
                setIsControlActive(true);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              {t("avatarOverlay.replyNotificationButton")}
            </button>
          </div>
        ) : null}
        {isReplyEditorOpen ? (
          <form
            className="no-drag mx-3 mb-2 border-t border-token-border/60 pt-2"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onSubmit={handleReplySubmit}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <input
                ref={replyInputRef}
                type="text"
                data-avatar-overlay-reply-input="true"
                className="text-size-chat-sm h-6 min-w-0 flex-1 rounded-md border border-token-border bg-token-main-surface-primary px-2 text-token-foreground outline-none placeholder:text-token-text-tertiary focus:border-token-focus-border"
                aria-label={t("avatarOverlay.replyNotification", { title: notification.title })}
                autoFocus
                placeholder={t("avatarOverlay.notificationReplyPlaceholder")}
                value={replyValue}
                onChange={(event) => {
                  setReplyValue(event.currentTarget.value);
                  setReplyError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Escape" || isSubmittingReply) {
                    return;
                  }
                  event.stopPropagation();
                  onCloseReply();
                  setReplyError(null);
                }}
              />
              <button
                type="submit"
                aria-label={t("avatarOverlay.sendNotificationReply", { title: notification.title })}
                disabled={replyValue.trim().length === 0 || isSubmittingReply}
                className="h-6 cursor-interaction rounded-md bg-token-button-primary px-2 text-xs text-token-button-primary-label disabled:cursor-default disabled:opacity-60 focus:outline-none"
              >
                {t("avatarOverlay.replyNotificationButton")}
              </button>
            </div>
            {replyError != null ? (
              <div className="mt-1 text-[11px] leading-4 text-token-error-foreground" role="alert">
                {replyError}
              </div>
            ) : null}
          </form>
        ) : null}
        {notification.canDismiss ? (
          <div
            className={`absolute top-1 left-1 z-20 ${
              showControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <button
              type="button"
              aria-label={t("avatarOverlay.dismissNotification", { title: notification.title })}
              className="flex size-6 cursor-interaction items-center justify-center rounded-full border border-token-border bg-token-main-surface-primary text-token-text-secondary shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] hover:text-token-foreground focus:outline-none"
              onClick={(event) => {
                event.stopPropagation();
                onDismissNotification(notification);
              }}
            >
              <DismissNotificationIcon className="icon-xs" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type NotificationAppearance = {
  badgeBackgroundColor: string;
  badgeForegroundColor: string;
  fallbackBodyKey: MessageKey;
  iconClassName: string;
  labelKey: MessageKey;
};

function getNotificationAppearance(
  status: AvatarOverlayNotificationStatus | null | undefined,
): NotificationAppearance {
  if (status === "running") {
    return {
      badgeBackgroundColor: "var(--color-token-activity-bar-badge-background)",
      badgeForegroundColor: "var(--color-token-activity-bar-badge-foreground)",
      fallbackBodyKey: "avatarOverlay.statusRunningSubtitle",
      iconClassName: "icon-xs shrink-0 text-token-text-secondary",
      labelKey: "avatarOverlay.statusRunning",
    };
  }

  if (status === "waiting") {
    return {
      badgeBackgroundColor: "var(--color-token-editor-warning-foreground)",
      badgeForegroundColor: "var(--color-token-bg-primary)",
      fallbackBodyKey: "avatarOverlay.statusWaiting",
      iconClassName: "icon-xs shrink-0 text-token-editor-warning-foreground",
      labelKey: "avatarOverlay.statusWaiting",
    };
  }

  if (status === "failed") {
    return {
      badgeBackgroundColor: "var(--color-token-error-foreground)",
      badgeForegroundColor: "var(--color-token-bg-primary)",
      fallbackBodyKey: "avatarOverlay.statusFailed",
      iconClassName: "icon-xs shrink-0 text-token-error-foreground",
      labelKey: "avatarOverlay.statusFailed",
    };
  }

  if (status === "review") {
    return {
      badgeBackgroundColor: "var(--color-token-charts-green)",
      badgeForegroundColor: "var(--color-token-bg-primary)",
      fallbackBodyKey: "avatarOverlay.statusReview",
      iconClassName: "icon-xs shrink-0 text-token-charts-green",
      labelKey: "avatarOverlay.statusReview",
    };
  }

  return {
    badgeBackgroundColor: "var(--color-token-activity-bar-badge-background)",
    badgeForegroundColor: "var(--color-token-activity-bar-badge-foreground)",
    fallbackBodyKey: "avatarOverlay.statusInfo",
    iconClassName: "icon-xs shrink-0 text-token-text-secondary",
    labelKey: "avatarOverlay.statusInfo",
  };
}

function renderNotificationIcon(status: AvatarOverlayNotificationStatus) {
  switch (status) {
    case "waiting":
      return <ClockIcon className="icon-xs" />;
    case "failed":
      return <WarningTriangleIcon className="icon-xs" />;
    case "running":
      return <RunningActivityIcon className="icon-xs animate-spin motion-reduce:animate-none" />;
    case "review":
      return <CheckCircleFilledIcon className="icon-xs" />;
  }
}

function trimStatusBody(value: string) {
  return value.replace(/[.?!]+$/g, "");
}

function getTrayScrollState(
  element: HTMLDivElement,
  scrollTop = element.scrollTop,
): AvatarOverlayTrayScrollState {
  if (!hasTrayScrollableContent(element)) {
    return {
      hasScrollableContent: false,
      hasLatestNotificationsAbove: false,
      hiddenOlderNotificationCount: 0,
    };
  }

  if (isTrayScrolledToOlderEdge(element, scrollTop)) {
    return {
      hasScrollableContent: true,
      hasLatestNotificationsAbove: true,
      hiddenOlderNotificationCount: 0,
    };
  }

  const rows = getTrayScrollRows(element);
  const topAnchor = getTrayTopAnchor(element, rows, scrollTop);
  return {
    hasScrollableContent: true,
    hasLatestNotificationsAbove: scrollTop > TRAY_SCROLL_EPSILON,
    hiddenOlderNotificationCount: countHiddenOlderNotifications(element, rows, topAnchor),
  };
}

function trayScrollStateEquals(
  left: AvatarOverlayTrayScrollState,
  right: AvatarOverlayTrayScrollState,
) {
  return (
    left.hasScrollableContent === right.hasScrollableContent &&
    left.hasLatestNotificationsAbove === right.hasLatestNotificationsAbove &&
    left.hiddenOlderNotificationCount === right.hiddenOlderNotificationCount
  );
}

function isTrayScrolledToOlderEdge(element: HTMLDivElement, scrollTop = element.scrollTop) {
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  return hasTrayScrollableContent(element) && scrollTop >= maxScrollTop - TRAY_SCROLL_EPSILON;
}

function hasTrayScrollableContent(element: HTMLDivElement) {
  return element.scrollHeight > element.clientHeight + TRAY_SCROLL_EPSILON;
}

function countHiddenOlderNotifications(
  element: HTMLDivElement,
  rows: HTMLElement[],
  topAnchor: number,
) {
  const bottomEdge = topAnchor + element.clientHeight - TRAY_SCROLL_EPSILON;
  return rows.filter((row) => row.offsetTop + row.offsetHeight > bottomEdge).length;
}

function getTrayScrollRows(element: HTMLDivElement) {
  return Array.from(element.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

function getTrayTopAnchor(
  element: HTMLDivElement,
  rows: HTMLElement[],
  scrollTop = element.scrollTop,
) {
  return scrollTop + (rows[0]?.offsetTop ?? 0) + TRAY_SCROLL_EPSILON;
}

function findTrayScrollIndex(rows: HTMLElement[], topAnchor: number) {
  let index = 0;
  for (let currentIndex = 0; currentIndex < rows.length; currentIndex += 1) {
    if (rows[currentIndex]?.offsetTop <= topAnchor) {
      index = currentIndex;
    }
  }
  return index;
}

function RunningActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        opacity="0.3"
        d="M18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12ZM20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z"
        fill="currentColor"
      />
      <path
        d="M12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12H6C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WarningTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7.84807 3.17468C8.36037 2.33399 9.63963 2.33399 10.1519 3.17468L15.9147 12.628C16.4472 13.5018 15.8186 14.625 14.7627 14.625H3.2373C2.18141 14.625 1.55277 13.5018 2.08533 12.628L7.84807 3.17468Z"
        fill="currentColor"
      />
      <path
        d="M9 6.15C9.28995 6.15 9.525 6.38505 9.525 6.675V9.825C9.525 10.1149 9.28995 10.35 9 10.35C8.71005 10.35 8.475 10.1149 8.475 9.825V6.675C8.475 6.38505 8.71005 6.15 9 6.15Z"
        fill="var(--color-token-bg-primary)"
      />
      <path
        d="M9 12.15C9.37279 12.15 9.675 11.8478 9.675 11.475C9.675 11.1022 9.37279 10.8 9 10.8C8.62721 10.8 8.325 11.1022 8.325 11.475C8.325 11.8478 8.62721 12.15 9 12.15Z"
        fill="var(--color-token-bg-primary)"
      />
    </svg>
  );
}

function DismissNotificationIcon({ className }: { className?: string }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}
