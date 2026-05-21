import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { MessageKey } from "../../i18n/messages";
import { useI18n } from "../../i18n/i18n";
import {
  CheckCircleFilledIcon,
  ChevronDownIcon,
  ClockIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { AvatarSprite, type AvatarSpriteState } from "../../components/appearance/AvatarSprite";
import type { AvatarOption } from "../../components/appearance/avatarData";
import {
  AvatarOverlayContextMenu,
  type AvatarOverlayContextMenuPosition,
} from "./AvatarOverlayContextMenu";
import type { AvatarOverlayLayout } from "./avatarOverlayLayout";
import { AvatarOverlayTooltip } from "./AvatarOverlayTooltip";
import type {
  AvatarOverlayNotification,
  AvatarOverlayNotificationStatus,
} from "./avatarOverlayNotifications";

const TRAY_NOTIFICATION_PAGE_SIZE = 2;
const TRAY_SCROLL_EPSILON = 2;
const ROW_ENTER_STAGGER_SECONDS = 0.035;
const COLLAPSED_BODY_MAX_HEIGHT_PX = 32;
const EXPANDED_BODY_MAX_HEIGHT_PX = 512;
const BADGE_MOTION_CLASSNAME =
  "avatar-overlay-badge-enter transition-transform duration-150 ease-out motion-reduce:animate-none motion-reduce:transition-none hover:scale-[1.06] active:scale-[0.94]";
const EDGE_CONTROL_MOTION_CLASSNAME =
  "avatar-overlay-edge-control-enter transition-transform duration-150 ease-out motion-reduce:animate-none motion-reduce:transition-none hover:scale-[1.03] active:scale-[0.96]";
const ROW_ENTER_CLASSNAME = "avatar-overlay-row-enter motion-reduce:animate-none";
const BODY_EXPAND_TRANSITION_CLASSNAME =
  "transition-[max-height] duration-[180ms] ease-out motion-reduce:transition-none";
const REPLY_FORM_ENTER_CLASSNAME = "avatar-overlay-reply-enter motion-reduce:animate-none";
const TRAY_OPEN_CLOSE_TRANSITION_CLASSNAME =
  "transition-[opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

const TRAY_EDGE_CONTROL_CLASSNAME =
  `group no-drag absolute left-1/2 z-10 flex h-5 -translate-x-1/2 cursor-interaction items-center justify-center gap-0.5 rounded-full border border-token-border bg-token-main-surface-primary px-2 text-[10px] leading-none font-medium text-token-text-secondary shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] backdrop-blur hover:text-token-foreground hover:shadow-[0px_7px_14px_-9px_rgba(0,0,0,0.26)] focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none forced-colors:bg-[Canvas] ${EDGE_CONTROL_MOTION_CLASSNAME}`;
const OVERLAY_BUTTON_SURFACE_CLASSNAME =
  "!bg-token-main-surface-primary enabled:hover:!bg-[color-mix(in_srgb,var(--color-token-main-surface-primary)_94%,var(--color-token-foreground))]";

const NOOP_POINTER_HANDLER = (_event: ReactPointerEvent<HTMLElement>) => undefined;

export type AvatarOverlayTrayScrollState = {
  hasScrollableContent: boolean;
  hasLatestNotificationsAbove: boolean;
  hiddenOlderNotificationCount: number;
};

export type AvatarOverlayViewTestState = {
  contextMenuPosition?: AvatarOverlayContextMenuPosition | null;
  expandedNotificationIds?: string[];
  forceMascotHover?: boolean;
  forceControlsVisible?: boolean;
  forceExpandableNotificationIds?: string[];
  forceTrayScrollState?: AvatarOverlayTrayScrollState;
  replyOpenNotificationId?: string | null;
};

export type AvatarOverlayViewProps = {
  selectedAvatar: AvatarOption;
  notifications: AvatarOverlayNotification[];
  topNotification: AvatarOverlayNotification | null;
  isTrayOpen: boolean;
  isDragging: boolean;
  mascotTransientState: AvatarSpriteState | null;
  layout: AvatarOverlayLayout;
  hasRunningCloudSession?: boolean;
  hasRunningLocalSession?: boolean;
  interactiveRegionRef?: RefObject<HTMLElement | null>;
  contextMenuPosition?: AvatarOverlayContextMenuPosition | null;
  onCloseContextMenu?: () => void;
  onClosePet?: () => void;
  onOpenTray: () => void;
  onCloseTray: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenNotification: (notification: AvatarOverlayNotification) => void;
  onDismissNotification: (notification: AvatarOverlayNotification) => void;
  onNotificationReplyEditorActiveChange?: (isActive: boolean) => void;
  onOpenNotificationReply?: (notification: AvatarOverlayNotification) => void;
  onSubmitNotificationReply?: (
    notification: AvatarOverlayNotification,
    prompt: string,
  ) => Promise<unknown> | unknown;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLElement>) => void;
  onLostPointerCapture?: (event: ReactPointerEvent<HTMLElement>) => void;
  testState?: AvatarOverlayViewTestState;
};

export function AvatarOverlayView({
  selectedAvatar,
  notifications,
  topNotification,
  isTrayOpen,
  isDragging,
  mascotTransientState,
  layout,
  interactiveRegionRef,
  contextMenuPosition,
  onCloseContextMenu,
  onClosePet,
  onOpenTray,
  onCloseTray,
  onContextMenu,
  onOpenNotification,
  onDismissNotification,
  onNotificationReplyEditorActiveChange,
  onOpenNotificationReply,
  onSubmitNotificationReply,
  onPointerDown = NOOP_POINTER_HANDLER,
  onPointerMove = NOOP_POINTER_HANDLER,
  onPointerUp = NOOP_POINTER_HANDLER,
  onPointerCancel = NOOP_POINTER_HANDLER,
  onLostPointerCapture = NOOP_POINTER_HANDLER,
  testState,
}: AvatarOverlayViewProps) {
  const { t } = useI18n();
  const topNotificationAppearance = getNotificationAppearance(topNotification);
  const hasNotifications = notifications.length > 0;
  const isTrayVisible = hasNotifications && isTrayOpen;
  const trayPlacementOrigin = `${layout.placement.startsWith("top") ? "bottom" : "top"} ${
    layout.placement.endsWith("end") ? "right" : "left"
  }`;
  const mascotState = topNotificationAppearance.mascotState;
  const trayMaxHeight = layout.tray?.height;
  const activeContextMenuPosition = testState?.contextMenuPosition ?? contextMenuPosition ?? null;

  const notificationBadge = isTrayVisible
    ? {
        ariaLabel: t("avatarOverlay.collapseNotificationTray"),
        backgroundColor: "var(--color-token-bg-primary)",
        content: <ChevronDownIcon className="icon-xs opacity-80" />,
        foregroundColor: "var(--color-token-text-secondary)",
        isIconOnly: true,
        onClick: onCloseTray,
      }
    : hasNotifications
      ? {
          ariaLabel: t("avatarOverlay.toggleNotificationTray", {
            count: notifications.length,
          }),
          backgroundColor: topNotificationAppearance.badgeBackgroundColor,
          content: notifications.length,
          foregroundColor: topNotificationAppearance.badgeForegroundColor,
          onClick: onOpenTray,
        }
      : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-transparent">
      <section
        ref={interactiveRegionRef as RefObject<HTMLElement> | undefined}
        data-avatar-overlay-content-frame="true"
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        onLostPointerCapture={onLostPointerCapture}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {hasNotifications ? (
          <div
            aria-hidden={!isTrayVisible || undefined}
            data-avatar-overlay-hit-region="notification-tray"
            inert={!isTrayVisible ? true : undefined}
            className="absolute cursor-interaction text-sm text-token-foreground"
            style={{
              height: layout.tray?.height,
              left: layout.tray?.left,
              pointerEvents: isTrayVisible ? undefined : "none",
              top: layout.tray?.top,
              visibility: layout.tray == null ? "hidden" : undefined,
              width: layout.tray?.width,
            }}
          >
            <div
              className={`relative overflow-hidden [corner-shape:superellipse(1.5)] ${TRAY_OPEN_CLOSE_TRANSITION_CLASSNAME}`}
              data-avatar-overlay-size="notification-tray"
              style={{
                maxHeight: trayMaxHeight,
                opacity: isTrayVisible ? 1 : 0,
                transformOrigin: trayPlacementOrigin,
                transform: `translateY(${isTrayVisible || testState?.forceControlsVisible ? 0 : 8}px) scale(${isTrayVisible || testState?.forceControlsVisible ? 1 : 0.97})`,
              }}
            >
              <div
                data-avatar-overlay-size="notification-tray-header"
                className="h-0 overflow-hidden"
              />
              <NotificationTray
                isTrayVisible={isTrayVisible}
                notifications={notifications}
                trayMaxHeight={trayMaxHeight}
                onDismissNotification={onDismissNotification}
                onNotificationReplyEditorActiveChange={onNotificationReplyEditorActiveChange}
                onOpenNotification={onOpenNotification}
                onOpenNotificationReply={onOpenNotificationReply}
                onSubmitNotificationReply={onSubmitNotificationReply}
                testState={testState}
              />
            </div>
          </div>
        ) : null}

        <div
          data-avatar-overlay-hit-region="mascot"
          className={[
            "absolute duration-[160ms] ease-out [@media(prefers-reduced-motion:reduce)]:transition-none",
            isDragging ? "scale-95 transition-transform" : "transition-none",
          ].join(" ")}
          style={{
            height: layout.mascot.height,
            left: layout.mascot.left,
            top: layout.mascot.top,
            width: layout.mascot.width,
          }}
        >
          <MascotButton
            ariaLabel={t("petOverlay.mascotLabel", { petName: selectedAvatar.displayName })}
            avatar={selectedAvatar}
            badge={notificationBadge}
            forceHover={testState?.forceMascotHover === true}
            mascotState={mascotState}
            onContextMenu={onContextMenu}
            transientState={mascotTransientState}
          />
        </div>
        {activeContextMenuPosition != null && onCloseContextMenu != null && onClosePet != null ? (
          <AvatarOverlayContextMenu
            label={t("petOverlay.closePet")}
            onClose={onCloseContextMenu}
            onSelect={onClosePet}
            position={activeContextMenuPosition}
          />
        ) : null}
      </section>
    </main>
  );
}

function MascotButton({
  ariaLabel,
  avatar,
  badge,
  forceHover = false,
  mascotState,
  onContextMenu,
  transientState,
}: {
  ariaLabel: string;
  avatar: AvatarOption;
  badge:
    | {
        ariaLabel: string;
        backgroundColor: string;
        content: ReactNode;
        foregroundColor: string;
        isIconOnly?: boolean;
        onClick: () => void;
      }
    | null;
  forceHover?: boolean;
  mascotState: AvatarSpriteState;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  transientState: AvatarSpriteState | null;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const state = transientState ?? (forceHover || isHovered ? "jumping" : mascotState);

  return (
    <div
      aria-label={ariaLabel}
      data-avatar-mascot="true"
      data-testid="avatar-mascot-button"
      role={badge != null ? "group" : "img"}
      className="relative flex size-20 cursor-interaction items-center justify-center active:cursor-grabbing"
      onContextMenu={onContextMenu}
      onPointerEnter={() => {
        setIsHovered(true);
      }}
      onPointerLeave={() => {
        setIsHovered(false);
      }}
    >
      <AvatarSprite
        avatar={avatar}
        className="relative z-10"
        size="md"
        state={state}
      />
      {badge != null ? (
        <button
          type="button"
          aria-label={badge.ariaLabel}
          className={[
            "no-drag absolute top-0 right-0 z-20 flex cursor-interaction items-center justify-center rounded-full border border-token-border/60 text-xs leading-none font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none",
            BADGE_MOTION_CLASSNAME,
            badge.isIconOnly ? "size-7 p-0" : "min-h-7 min-w-7 px-2 py-1",
          ].join(" ")}
          data-testid="avatar-overlay-notification-badge"
          onClick={badge.onClick}
          style={{
            backgroundColor: badge.backgroundColor,
            color: badge.foregroundColor,
          }}
        >
          {badge.content}
        </button>
      ) : null}
    </div>
  );
}

function NotificationTray({
  isTrayVisible,
  notifications,
  trayMaxHeight,
  onDismissNotification,
  onNotificationReplyEditorActiveChange,
  onOpenNotification,
  onOpenNotificationReply,
  onSubmitNotificationReply,
  testState,
}: {
  isTrayVisible: boolean;
  notifications: AvatarOverlayNotification[];
  trayMaxHeight?: number;
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
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const [scrollState, setScrollState] = useState<AvatarOverlayTrayScrollState>(
    testState?.forceTrayScrollState ?? {
      hasScrollableContent: false,
      hasLatestNotificationsAbove: false,
      hiddenOlderNotificationCount: 0,
    },
  );
  const [replyOpenNotificationId, setReplyOpenNotificationId] = useState<string | null>(null);
  const controlledReplyOpenNotificationId = testState?.replyOpenNotificationId;
  const activeReplyOpenNotificationId =
    controlledReplyOpenNotificationId === undefined
      ? replyOpenNotificationId
      : controlledReplyOpenNotificationId;
  const hiddenOlderNotificationCount = Math.min(
    scrollState.hiddenOlderNotificationCount,
    Math.max(0, notifications.length - TRAY_NOTIFICATION_PAGE_SIZE),
  );
  const showLatestControl =
    scrollState.hasScrollableContent &&
    notifications.length > TRAY_NOTIFICATION_PAGE_SIZE &&
    scrollState.hasLatestNotificationsAbove;
  const showOlderControl =
    scrollState.hasScrollableContent &&
    notifications.length > TRAY_NOTIFICATION_PAGE_SIZE &&
    hiddenOlderNotificationCount > 0;
  const hasScrollableContent = scrollState.hasScrollableContent;

  useEffect(() => {
    onNotificationReplyEditorActiveChange?.(
      activeReplyOpenNotificationId != null && isTrayVisible,
    );
  }, [activeReplyOpenNotificationId, isTrayVisible, onNotificationReplyEditorActiveChange]);

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
      return undefined;
    }

    const update = () => {
      const next = getTrayScrollState(element);
      setScrollState((current) => (trayScrollStateEquals(current, next) ? current : next));
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    element.addEventListener("scroll", update);
    resizeObserver?.observe(element);
    update();

    return () => {
      element.removeEventListener("scroll", update);
      resizeObserver?.disconnect();
    };
  }, [notifications, activeReplyOpenNotificationId, testState?.forceTrayScrollState, trayMaxHeight]);

  return (
    <div className="relative">
      {showLatestControl ? (
        <button
          type="button"
          aria-label={t("avatarOverlay.showLatestNotifications")}
          data-avatar-overlay-hit-region="notification-scroll-control"
          className={`${TRAY_EDGE_CONTROL_CLASSNAME} top-1 min-w-12`}
          onClick={() => {
            const element = listRef.current;
            if (element == null) {
              return;
            }
            element.scrollTo({
              top: 0,
              behavior: "smooth",
            });
            setScrollState(getTrayScrollState(element, 0));
          }}
        >
          <span>{t("avatarOverlay.latestNotifications")}</span>
          <ChevronDownIcon className="icon-2xs hidden -rotate-90 opacity-70 group-hover:block group-focus:block" />
        </button>
      ) : null}

      <div
        ref={listRef}
        aria-label={t("avatarOverlay.notificationList")}
        className={[
          "scrollbar-on-hover flex flex-col gap-1.5 overflow-y-auto px-1.5 pt-1 pb-0 [--edge-fade-distance:0.75rem]",
          hasScrollableContent ? "vertical-scroll-fade-mask snap-y snap-mandatory" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-avatar-overlay-size="notification-tray-list"
        role="list"
        style={{ maxHeight: trayMaxHeight }}
      >
        {notifications.map((notification, index) => (
          <NotificationTrayRow
            key={notification.id}
            forceControlsVisible={testState?.forceControlsVisible === true}
            forceExpandable={testState?.forceExpandableNotificationIds?.includes(notification.id)}
            initiallyExpanded={testState?.expandedNotificationIds?.includes(notification.id)}
            isReplyEditorOpen={activeReplyOpenNotificationId === notification.id}
            notification={notification}
            notificationIndex={index}
            onCloseReply={() => {
              setReplyOpenNotificationId((current) =>
                current === notification.id ? null : current,
              );
            }}
            onDismissNotification={onDismissNotification}
            onOpenNotification={onOpenNotification}
            onOpenReply={() => {
              onOpenNotificationReply?.(notification);
              setReplyOpenNotificationId(notification.id);
            }}
            onSubmitNotificationReply={onSubmitNotificationReply}
            replyInputRef={replyInputRef}
          />
        ))}
      </div>

      {showOlderControl ? (
        <button
          type="button"
          aria-label={t("avatarOverlay.showOlderNotifications", {
            count: hiddenOlderNotificationCount,
          })}
          data-avatar-overlay-hit-region="notification-scroll-control"
          className={`${TRAY_EDGE_CONTROL_CLASSNAME} bottom-1 min-w-9`}
          onClick={() => {
            const element = listRef.current;
            if (element == null) {
              return;
            }
            const nextScrollTop = getOlderNotificationScrollTop(element, hiddenOlderNotificationCount);
            element.scrollTo({
              top: nextScrollTop,
              behavior: "smooth",
            });
            setScrollState(getTrayScrollState(element, nextScrollTop));
          }}
        >
          <span className="group-hover:hidden group-focus:hidden">
            {t("avatarOverlay.compactOlderNotificationCount", {
              count: hiddenOlderNotificationCount,
            })}
          </span>
          <span className="hidden group-hover:inline group-focus:inline">
            {t("avatarOverlay.olderNotificationCount", {
              count: hiddenOlderNotificationCount,
            })}
          </span>
          <ChevronDownIcon className="icon-2xs hidden rotate-90 opacity-70 group-hover:block group-focus:block" />
        </button>
      ) : null}
    </div>
  );
}

function NotificationTrayRow({
  forceControlsVisible,
  forceExpandable,
  initiallyExpanded = false,
  isReplyEditorOpen,
  notification,
  notificationIndex,
  onCloseReply,
  onDismissNotification,
  onOpenNotification,
  onOpenReply,
  onSubmitNotificationReply,
  replyInputRef,
}: {
  forceControlsVisible: boolean;
  forceExpandable?: boolean;
  initiallyExpanded?: boolean;
  isReplyEditorOpen: boolean;
  notification: AvatarOverlayNotification;
  notificationIndex: number;
  onCloseReply: () => void;
  onDismissNotification: (notification: AvatarOverlayNotification) => void;
  onOpenNotification: (notification: AvatarOverlayNotification) => void;
  onOpenReply: () => void;
  onSubmitNotificationReply?: (
    notification: AvatarOverlayNotification,
    prompt: string,
  ) => Promise<unknown> | unknown;
  replyInputRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useI18n();
  const appearance = getNotificationAppearance(notification);
  const fallbackBody = t(appearance.fallbackBodyKey);
  const body = notification.body ?? fallbackBody;
  const statusLabel = t(appearance.labelKey);
  const trimmedBody = trimStatusText(body);
  const trimmedStatusLabel = trimStatusText(statusLabel);
  const ariaBody = notification.body == null && trimmedBody === trimmedStatusLabel ? "" : trimmedBody;
  const canOpen = notification.actionPath.length > 0;
  const canReply = notification.localConversationId != null && onSubmitNotificationReply != null;
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyValue, setReplyValue] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isControlActive, setIsControlActive] = useState(false);
  const measureBodyRef = useRef<HTMLDivElement | null>(null);
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(0);

  useLayoutEffect(() => {
    const element = measureBodyRef.current;
    if (element == null) {
      return undefined;
    }

    const update = () => {
      const nextHeight = element.scrollHeight;
      setMeasuredBodyHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    update();
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [body]);

  useEffect(() => {
    if (!isReplyEditorOpen) {
      setReplyError(null);
      setReplyValue("");
      return;
    }

    replyInputRef.current?.focus();
  }, [isReplyEditorOpen, replyInputRef]);

  const canExpand =
    forceExpandable === true || measuredBodyHeight > COLLAPSED_BODY_MAX_HEIGHT_PX + 1;
  const showExpandedBody = canExpand && isExpanded && !isReplyEditorOpen;
  const showControls = forceControlsVisible || isControlActive || isReplyEditorOpen;
  const ariaLabel = canOpen
    ? [notification.title, statusLabel, ariaBody, t("avatarOverlay.openNotification")]
        .filter((segment) => segment.length > 0)
        .join(". ")
    : undefined;

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
      setReplyValue("");
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
      className={`group no-drag relative w-full snap-start scroll-mt-2 text-left ${ROW_ENTER_CLASSNAME}`}
      data-avatar-overlay-measure="notification-tray-row"
      style={{
        animationDelay: `${Math.min(notificationIndex, 3) * ROW_ENTER_STAGGER_SECONDS}s`,
        opacity: 1,
      }}
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
      <div
        className={[
          "relative z-[1] overflow-hidden rounded-[18px] border border-token-border/60 bg-token-main-surface-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(0,0,0,0.08)] backdrop-blur-xl forced-colors:bg-[Canvas]",
          canOpen
            ? "transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-token-border/80 hover:bg-token-main-surface-primary hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.52),inset_0_-1px_0_rgba(0,0,0,0.1)] motion-reduce:transition-none"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          role={canOpen ? "button" : undefined}
          tabIndex={canOpen ? 0 : undefined}
          aria-label={ariaLabel}
          className={[
            "block w-full min-w-0 px-3 py-1.5 text-left focus-visible:outline-token-focus focus-visible:outline focus-visible:outline-offset-[-2px]",
            canOpen ? "cursor-interaction" : "cursor-default",
          ].join(" ")}
          onClick={() => {
            if (canOpen) {
              onOpenNotification(notification);
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (!canOpen || (event.key !== "Enter" && event.key !== " ")) {
              return;
            }
            event.preventDefault();
            onOpenNotification(notification);
          }}
        >
          <span className="flex min-w-0 items-center pr-7">
            <span className="text-size-chat min-w-0 truncate leading-[17px] font-semibold text-token-foreground">
              {notification.title}
            </span>
          </span>
          <div
            className={[
              "text-size-chat-sm mt-0.5 overflow-hidden leading-4 text-token-foreground",
              BODY_EXPAND_TRANSITION_CLASSNAME,
              showExpandedBody ? "whitespace-pre-wrap" : "line-clamp-2",
            ].join(" ")}
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
          className={[
            "pointer-events-none absolute top-1 right-1 z-0 flex size-6 items-center justify-center opacity-100",
            canExpand && showControls ? "opacity-0 transition-opacity duration-150 motion-reduce:transition-none" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {renderNotificationIcon(notification.status)}
        </span>

        {canExpand ? (
          <div
            className={[
              "absolute top-1 right-1 z-10 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              showControls
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none translate-x-[6px] opacity-0",
            ].join(" ")}
            data-avatar-overlay-control="expand"
          >
            <AvatarOverlayTooltip
              align="end"
              content={t(
                showExpandedBody
                  ? "avatarOverlay.collapseNotificationTooltip"
                  : "avatarOverlay.expandNotificationTooltip",
              )}
              side="top"
            >
              <Button
                aria-expanded={showExpandedBody}
                aria-label={t(
                  showExpandedBody
                    ? "avatarOverlay.collapseNotification"
                    : "avatarOverlay.expandNotification",
                  { title: notification.title },
                )}
                className={["size-6", OVERLAY_BUTTON_SURFACE_CLASSNAME].join(" ")}
                color="ghost"
                size="icon"
                onClick={() => {
                  setIsExpanded((current) => !current);
                }}
              >
                <ChevronDownIcon
                  className={[
                    "icon-xs transition-transform duration-150",
                    showExpandedBody ? "rotate-90" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </Button>
            </AvatarOverlayTooltip>
          </div>
        ) : null}

        {canReply && !isReplyEditorOpen ? (
          <div
            className={[
              "no-drag absolute right-2 bottom-1 z-10 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              showControls
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none translate-x-[6px] opacity-0",
            ].join(" ")}
            data-avatar-overlay-control="reply"
          >
            <div className="flex justify-end pb-1">
              <Button
                aria-label={t("avatarOverlay.replyNotification", { title: notification.title })}
                className={[
                  "h-5 px-2 text-xs leading-none text-token-foreground shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)]",
                  OVERLAY_BUTTON_SURFACE_CLASSNAME,
                ].join(" ")}
                color="outline"
                size="default"
                onClick={(event) => {
                  event.stopPropagation();
                  setReplyError(null);
                  setReplyValue("");
                  onOpenReply();
                  setIsControlActive(true);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                {t("avatarOverlay.replyNotificationButton")}
              </Button>
            </div>
          </div>
        ) : null}

        {isReplyEditorOpen ? (
          <form
            className={`no-drag mx-3 mb-2 border-t border-token-border/60 pt-2 ${REPLY_FORM_ENTER_CLASSNAME}`}
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
              <Button
                aria-label={t("avatarOverlay.sendNotificationReply", { title: notification.title })}
                className="h-6 px-2 text-xs"
                color="primary"
                disabled={replyValue.trim().length === 0 || isSubmittingReply}
                loading={isSubmittingReply}
                size="default"
                type="submit"
              >
                {t("avatarOverlay.replyNotificationButton")}
              </Button>
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
            className={[
              "absolute top-1 left-1 z-20 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              showControls
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-[6px] opacity-0",
            ].join(" ")}
            data-avatar-overlay-control="dismiss"
          >
            <AvatarOverlayTooltip
              align="start"
              content={t("avatarOverlay.dismissNotificationTooltip")}
              side="top"
            >
              <Button
                aria-label={t("avatarOverlay.dismissNotification", { title: notification.title })}
                className={[
                  "[&>svg]:!icon-xs size-6 shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] enabled:hover:!text-token-foreground",
                  OVERLAY_BUTTON_SURFACE_CLASSNAME,
                ].join(" ")}
                color="outline"
                size="icon"
                onClick={() => {
                  onDismissNotification(notification);
                }}
              >
                <DismissNotificationIcon className="icon-xs" />
              </Button>
            </AvatarOverlayTooltip>
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
  mascotState: AvatarSpriteState;
};

function getNotificationAppearance(
  notification: AvatarOverlayNotification | null | undefined,
): NotificationAppearance {
  if (notification?.isLoading) {
    return {
      badgeBackgroundColor: "var(--color-token-activity-bar-badge-background)",
      badgeForegroundColor: "var(--color-token-activity-bar-badge-foreground)",
      fallbackBodyKey: "avatarOverlay.statusRunningSubtitle",
      iconClassName: "icon-xs shrink-0 text-token-text-secondary",
      labelKey: "avatarOverlay.statusRunning",
      mascotState: "running",
    };
  }

  switch (notification?.status) {
    case "waiting":
      return {
        badgeBackgroundColor: "var(--color-token-editor-warning-foreground)",
        badgeForegroundColor: "var(--color-token-bg-primary)",
        fallbackBodyKey: "avatarOverlay.statusWaiting",
        iconClassName: "icon-xs shrink-0 text-token-editor-warning-foreground",
        labelKey: "avatarOverlay.statusWaiting",
        mascotState: "waiting",
      };
    case "failed":
      return {
        badgeBackgroundColor: "var(--color-token-error-foreground)",
        badgeForegroundColor: "var(--color-token-bg-primary)",
        fallbackBodyKey: "avatarOverlay.statusFailed",
        iconClassName: "icon-xs shrink-0 text-token-error-foreground",
        labelKey: "avatarOverlay.statusFailed",
        mascotState: "failed",
      };
    case "review":
      return {
        badgeBackgroundColor: "var(--color-token-charts-green)",
        badgeForegroundColor: "var(--color-token-bg-primary)",
        fallbackBodyKey: "avatarOverlay.statusReview",
        iconClassName: "icon-xs shrink-0 text-token-charts-green",
        labelKey: "avatarOverlay.statusReview",
        mascotState: "review",
      };
    case "running":
      return {
        badgeBackgroundColor: "var(--color-token-activity-bar-badge-background)",
        badgeForegroundColor: "var(--color-token-activity-bar-badge-foreground)",
        fallbackBodyKey: "avatarOverlay.statusRunningSubtitle",
        iconClassName: "icon-xs shrink-0 text-token-text-secondary",
        labelKey: "avatarOverlay.statusRunning",
        mascotState: "running",
      };
    default:
      return {
        badgeBackgroundColor: "var(--color-token-activity-bar-badge-background)",
        badgeForegroundColor: "var(--color-token-activity-bar-badge-foreground)",
        fallbackBodyKey: "avatarOverlay.statusInfo",
        iconClassName: "icon-xs shrink-0 text-token-text-secondary",
        labelKey: "avatarOverlay.statusInfo",
        mascotState: "idle",
      };
  }
}

function renderNotificationIcon(status: AvatarOverlayNotificationStatus) {
  switch (status) {
    case "waiting":
      return <ClockIcon className="icon-xs shrink-0 text-token-editor-warning-foreground" />;
    case "failed":
      return <WarningTriangleIcon className="icon-xs shrink-0 text-token-error-foreground" />;
    case "running":
      return (
        <RunningActivityIcon className="icon-xs shrink-0 animate-spin text-token-text-secondary motion-reduce:animate-none" />
      );
    case "review":
      return <CheckCircleFilledIcon className="icon-xs shrink-0 text-token-charts-green" />;
  }
}

function trimStatusText(value: string) {
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

function getOlderNotificationScrollTop(element: HTMLDivElement, hiddenOlderCount: number) {
  if (hiddenOlderCount <= TRAY_NOTIFICATION_PAGE_SIZE) {
    return element.scrollHeight;
  }
  const rows = getTrayScrollRows(element);
  return rows[findTrayScrollIndex(rows, getTrayTopAnchor(element, rows)) + TRAY_NOTIFICATION_PAGE_SIZE]
    ?.offsetTop ?? element.scrollHeight;
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
