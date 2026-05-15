import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from "react";
import {
  BUILTIN_AVATARS,
  DEFAULT_AVATAR_ID,
  resolveAvatarOption,
  type AvatarOption,
} from "../../components/appearance/avatarData";
import { useI18n } from "../../i18n/i18n";
import {
  onAvatarOverlayKeyboardInteractionReady,
  setAvatarOverlayKeyboardInteractive,
  setAvatarOverlayPointerInteractive,
} from "../../services/avatarOverlay";
import {
  getRecentThreads,
  onThreadEvent,
  readThread,
  sendFollowUpMessage,
  type ThreadConversation,
  type ThreadHistoryEntry,
} from "../../services/history";
import { listRemoteTasks, type RemoteTask } from "../../services/remoteTasks";
import { readSelectedAvatarId } from "../../services/settings";
import { openInMainWindow } from "../../services/windowNavigation";
import { AvatarOverlayView } from "./AvatarOverlayView";
import {
  deriveAvatarOverlayNotifications,
  type AvatarOverlayNotification,
} from "./avatarOverlayNotifications";

const RECENT_THREAD_LIMIT = 20;
const DEFAULT_ACTIVITY_POLL_INTERVAL_MS = 60_000;
const ACTIVE_ACTIVITY_POLL_INTERVAL_MS = 15_000;
const THREAD_EVENT_REFRESH_DEBOUNCE_MS = 300;
const REMOTE_TASK_LIMIT = 20;
const AVATAR_OVERLAY_REGION_SELECTORS = [
  "[data-avatar-overlay-hit-region]",
  "[data-avatar-mascot='true']",
];

type AvatarOverlayPageProps = {
  initialAvatarId?: string | null;
};

export function AvatarOverlayPage({ initialAvatarId }: AvatarOverlayPageProps) {
  const { t } = useI18n();
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    initialAvatarId ?? DEFAULT_AVATAR_ID,
  );
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);
  const [isPointerInteractive, setIsPointerInteractive] = useState<boolean>(true);
  const [isReplyEditorActive, setIsReplyEditorActive] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [recentThreads, setRecentThreads] = useState<ThreadHistoryEntry[]>([]);
  const [conversationsByThreadId, setConversationsByThreadId] = useState<
    Map<string, ThreadConversation>
  >(() => new Map());
  const [remoteTasks, setRemoteTasks] = useState<RemoteTask[]>([]);
  const [remoteTaskRefreshTick, setRemoteTaskRefreshTick] = useState(0);
  const [dismissedNotificationTurnKeys, setDismissedNotificationTurnKeys] = useState<
    Map<string, string | null>
  >(() => new Map());
  const recentThreadIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRemoteTasksRef = useRef(false);
  const interactiveRegionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        const stored = await readSelectedAvatarId();
        if (!cancelled && typeof stored === "string" && stored.length > 0) {
          setSelectedAvatarId(stored);
        }
      } catch {
        // ignore; fallback to default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    let queuedRefreshId: number | null = null;

    const loadRecentActivity = async () => {
      try {
        const latestThreads = await getRecentThreads();
        if (cancelled) {
          return;
        }

        const trimmedThreads = latestThreads.slice(0, RECENT_THREAD_LIMIT);
        recentThreadIdsRef.current = new Set(trimmedThreads.map((thread) => thread.id));

        const detailThreads = trimmedThreads.filter(
          (thread) =>
            thread.source?.parentThreadId == null &&
            thread.status.type !== "idle" &&
            thread.status.type !== "notLoaded",
        );
        const detailEntries = await Promise.all(
          detailThreads.map(async (thread) => {
            try {
              return [thread.id, await readThread(thread.id)] as const;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) {
          return;
        }

        const nextConversationsByThreadId = new Map<string, ThreadConversation>();
        for (const detailEntry of detailEntries) {
          if (detailEntry != null) {
            nextConversationsByThreadId.set(detailEntry[0], detailEntry[1]);
          }
        }

        setRecentThreads(trimmedThreads);
        setConversationsByThreadId(nextConversationsByThreadId);
        setNowMs(Date.now());
      } catch {
        if (!cancelled) {
          setNowMs(Date.now());
        }
      }
    };

    const queueRefresh = () => {
      if (queuedRefreshId != null) {
        return;
      }

      queuedRefreshId = window.setTimeout(() => {
        queuedRefreshId = null;
        void loadRecentActivity();
      }, THREAD_EVENT_REFRESH_DEBOUNCE_MS);
    };

    void loadRecentActivity();

    const pollId = window.setInterval(() => {
      void loadRecentActivity();
    }, ACTIVE_ACTIVITY_POLL_INTERVAL_MS);

    const unlistenPromise = onThreadEvent((event) => {
      if ("threadId" in event && recentThreadIdsRef.current.has(event.threadId)) {
        queueRefresh();
      }
    });

    return () => {
      cancelled = true;
      if (pollId != null) {
        window.clearInterval(pollId);
      }
      if (queuedRefreshId != null) {
        window.clearTimeout(queuedRefreshId);
      }
      void unlistenPromise.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;

    const loadRemoteActivity = async () => {
      try {
        const response = await listRemoteTasks({
          taskFilter: "current",
          limit: REMOTE_TASK_LIMIT,
        });
        if (cancelled) {
          return;
        }

        setRemoteTasks(response.items ?? []);
        setNowMs(Date.now());
      } catch {
        if (!cancelled) {
          setNowMs(Date.now());
        }
      } finally {
        if (!cancelled) {
          setRemoteTaskRefreshTick((current) => current + 1);
        }
      }
    };

    if (!hasLoadedRemoteTasksRef.current) {
      hasLoadedRemoteTasksRef.current = true;
      void loadRemoteActivity();
      return () => {
        cancelled = true;
      };
    }

    const hasRunningRemoteTask = remoteTasks.some((task) => {
      const status = task.task_status_display?.latest_turn_status_display?.turn_status;
      return status === "pending" || status === "in_progress";
    });
    const timeoutId = window.setTimeout(() => {
      void loadRemoteActivity();
    }, hasRunningRemoteTask ? ACTIVE_ACTIVITY_POLL_INTERVAL_MS : DEFAULT_ACTIVITY_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [remoteTaskRefreshTick, remoteTasks]);

  const selectedAvatar: AvatarOption = useMemo(
    () => resolveAvatarOption(selectedAvatarId, BUILTIN_AVATARS),
    [selectedAvatarId],
  );
  const notificationState = useMemo(
    () =>
      deriveAvatarOverlayNotifications({
        conversationsByThreadId,
        dismissedNotificationTurnKeys,
        nowMs,
        recentThreads,
        remoteTasks,
        translate: t,
      }),
    [conversationsByThreadId, dismissedNotificationTurnKeys, nowMs, recentThreads, remoteTasks, t],
  );

  useEffect(() => {
    if (typeof window === "undefined" || notificationState.nextExpiresAtMs == null) {
      return undefined;
    }

    const delayMs = Math.max(notificationState.nextExpiresAtMs - Date.now(), 0);
    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, delayMs + 1);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notificationState.nextExpiresAtMs]);

  useAvatarOverlayPointerInteractivity({
    interactiveRegionRef,
    onInteractiveChange: setIsPointerInteractive,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    void setAvatarOverlayPointerInteractive(isPointerInteractive);
    return undefined;
  }, [isPointerInteractive]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    void setAvatarOverlayKeyboardInteractive(isReplyEditorActive);
    return () => {
      if (isReplyEditorActive) {
        void setAvatarOverlayKeyboardInteractive(false);
      }
    };
  }, [isReplyEditorActive]);

  useEffect(() => {
    if (isTrayOpen) {
      return;
    }

    setIsReplyEditorActive(false);
  }, [isTrayOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const unlistenPromise = onAvatarOverlayKeyboardInteractionReady(() => {
      const replyInput = document.querySelector<HTMLInputElement>(
        "[data-avatar-overlay-reply-input='true']",
      );
      replyInput?.focus();
      replyInput?.select();
    });

    return () => {
      void unlistenPromise.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  const handleOpenNotification = (notification: AvatarOverlayNotification) => {
    setIsTrayOpen(false);
    setIsReplyEditorActive(false);
    void openInMainWindow(notification.actionPath);
  };

  const handleDismissNotification = (notification: AvatarOverlayNotification) => {
    if (!notification.canDismiss) {
      return;
    }
    setDismissedNotificationTurnKeys((current) => {
      if (current.get(notification.id) === notification.turnKey) {
        return current;
      }
      const next = new Map(current);
      next.set(notification.id, notification.turnKey);
      return next;
    });
  };

  const handleSubmitNotificationReply = useEffectEvent(
    async (notification: AvatarOverlayNotification, prompt: string) => {
      if (notification.localConversationId == null) {
        return;
      }

      await sendFollowUpMessage({
        conversationId: notification.localConversationId,
        prompt,
      });
    },
  );

  return (
    <AvatarOverlayView
      interactiveRegionRef={interactiveRegionRef}
      selectedAvatar={selectedAvatar}
      notifications={notificationState.notifications}
      isTrayOpen={isTrayOpen}
      onToggleTray={() => {
        setIsTrayOpen((current) => {
          const next = !current;
          if (!next) {
            setIsReplyEditorActive(false);
          }
          return next;
        });
      }}
      onCollapseTray={() => {
        setIsTrayOpen(false);
        setIsReplyEditorActive(false);
      }}
      onOpenNotification={handleOpenNotification}
      onDismissNotification={handleDismissNotification}
      onNotificationReplyEditorActiveChange={setIsReplyEditorActive}
      onOpenNotificationReply={() => undefined}
      onSubmitNotificationReply={handleSubmitNotificationReply}
    />
  );
}

function useAvatarOverlayPointerInteractivity(options: {
  interactiveRegionRef: RefObject<HTMLElement | null>;
  isPaused?: () => boolean;
  onInteractiveChange: (isInteractive: boolean) => void;
}) {
  const { interactiveRegionRef, isPaused, onInteractiveChange } = options;
  const isPausedEvent = useEffectEvent(() => isPaused?.() ?? false);
  const handleInteractiveChange = useEffectEvent(onInteractiveChange);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let lastDeliveredInteractive: boolean | null = null;
    let currentPointerPoint: PointerPoint | null = null;
    let pendingPointerPoint: PointerPoint | null = null;
    let animationFrameId: number | null = null;

    const deliverInteractiveChange = (isInteractive: boolean) => {
      if (lastDeliveredInteractive === isInteractive) {
        return;
      }

      lastDeliveredInteractive = isInteractive;
      handleInteractiveChange(isInteractive);
    };

    const resolveInteractiveAtPoint = (point: PointerPoint) => {
      const interactiveRegion = interactiveRegionRef.current;
      if (interactiveRegion == null) {
        return true;
      }

      for (const selector of AVATAR_OVERLAY_REGION_SELECTORS) {
        const elements = interactiveRegion.querySelectorAll(selector);
        for (const element of elements) {
          if (
            isVisiblePointerTarget(element) &&
            pointIntersectsElement(point, element)
          ) {
            return true;
          }
        }
      }

      return false;
    };

    const resolveHoverInteractiveState = () => {
      const interactiveRegion = interactiveRegionRef.current;
      if (interactiveRegion != null) {
        for (const selector of AVATAR_OVERLAY_REGION_SELECTORS) {
          const elements = interactiveRegion.querySelectorAll(selector);
          for (const element of elements) {
            if (isVisiblePointerTarget(element) && element.matches(":hover")) {
              return true;
            }
          }
        }
      }

      return document.documentElement.matches(":hover") ? false : null;
    };

    const updateFromPointer = () => {
      animationFrameId = null;
      if (pendingPointerPoint == null || isPausedEvent()) {
        return;
      }

      currentPointerPoint = pendingPointerPoint;
      deliverInteractiveChange(resolveInteractiveAtPoint(pendingPointerPoint));
    };

    const schedulePointerUpdate = () => {
      if (animationFrameId != null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateFromPointer);
    };

    const handleMouseMove = (event: MouseEvent) => {
      pendingPointerPoint = {
        x: event.clientX,
        y: event.clientY,
      };
      currentPointerPoint = pendingPointerPoint;
      schedulePointerUpdate();
    };

    const handleViewportChange = () => {
      if (currentPointerPoint != null) {
        pendingPointerPoint = currentPointerPoint;
        schedulePointerUpdate();
      }
    };

    const handleWindowMouseLeave = () => {
      if (isPausedEvent()) {
        return;
      }

      deliverInteractiveChange(false);
    };

    const handleMutation = () => {
      if (isPausedEvent()) {
        return;
      }

      const hoveredState = resolveHoverInteractiveState();
      if (hoveredState != null) {
        deliverInteractiveChange(hoveredState);
      }
    };

    const observer = new MutationObserver(handleViewportChange);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("mouseleave", handleWindowMouseLeave);
    observer.observe(document.body, {
      attributeFilter: ["aria-hidden", "class", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    handleMutation();
    const initialFrameId = window.requestAnimationFrame(handleMutation);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("mouseleave", handleWindowMouseLeave);
      observer.disconnect();
      window.cancelAnimationFrame(initialFrameId);
      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      handleInteractiveChange(true);
    };
  }, [handleInteractiveChange, interactiveRegionRef, isPausedEvent]);
}

type PointerPoint = {
  x: number;
  y: number;
};

function pointIntersectsElement(point: PointerPoint, element: Element) {
  const rect = element.getBoundingClientRect();
  if (!pointInsideRect(point, rect)) {
    return false;
  }

  return document.elementsFromPoint(point.x, point.y).some(
    (candidate) => candidate === element || element.contains(candidate),
  );
}

function isVisiblePointerTarget(element: Element) {
  const computedStyle = window.getComputedStyle(element);
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.pointerEvents === "none"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function pointInsideRect(point: PointerPoint, rect: DOMRect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
