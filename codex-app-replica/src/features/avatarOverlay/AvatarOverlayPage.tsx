import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  DEFAULT_AVATAR_ID,
  buildAvatarOptions,
  resolveAvatarOption,
  type AvatarOption,
} from "../../components/appearance/avatarData";
import type { AvatarSpriteState } from "../../components/appearance/AvatarSprite";
import { useI18n } from "../../i18n/i18n";
import {
  endAvatarOverlayDrag,
  moveAvatarOverlayDrag,
  onAvatarOverlayKeyboardInteractionReady,
  onAvatarOverlayLayoutChanged,
  openCurrentMainWindow,
  releaseAvatarOverlayDrag,
  reportAvatarOverlayElementSizeChanged,
  setAvatarOverlayKeyboardInteractive,
  setAvatarOverlayPointerInteractive,
  startAvatarOverlayDrag,
  toggleAvatarOverlay,
} from "../../services/avatarOverlay";
import {
  getRecentThreads,
  onThreadEvent,
  readThread,
  sendFollowUpMessage,
  type ThreadConversation,
  type ThreadHistoryEntry,
} from "../../services/history";
import {
  ensureCustomAvatarsLoaded,
  getCustomAvatarsSnapshot,
  refreshCustomAvatars,
  subscribeCustomAvatars,
  type CustomAvatarsSnapshot,
} from "../../services/customAvatars";
import { listRemoteTasks, type RemoteTask } from "../../services/remoteTasks";
import { onGlobalStateUpdated, readSelectedAvatarId } from "../../services/settings";
import { openInMainWindow } from "../../services/windowNavigation";
import { AvatarOverlayView } from "./AvatarOverlayView";
import { DEFAULT_AVATAR_OVERLAY_LAYOUT, type AvatarOverlayLayout } from "./avatarOverlayLayout";
import type { AvatarOverlayContextMenuPosition } from "./AvatarOverlayContextMenu";
import {
  deriveAvatarOverlayNotifications,
  type AvatarOverlayNotification,
} from "./avatarOverlayNotifications";

const RECENT_THREAD_LIMIT = 20;
const DEFAULT_ACTIVITY_POLL_INTERVAL_MS = 60_000;
const ACTIVE_ACTIVITY_POLL_INTERVAL_MS = 15_000;
const THREAD_EVENT_REFRESH_DEBOUNCE_MS = 300;
const REMOTE_TASK_LIMIT = 20;
const DRAG_THRESHOLD_PX = 4;
const DRAG_VELOCITY_WINDOW_MS = 100;
const DRAG_MIN_FLING_SPEED_PX_PER_SECOND = 320;
const DRAG_MAX_FLING_SPEED_PX_PER_SECOND = 1600;
const AVATAR_OVERLAY_REGION_SELECTORS = [
  "[data-avatar-overlay-hit-region]",
  "[data-avatar-mascot='true']",
];
const AVATAR_OVERLAY_ROOT_SELECTOR = ".codex-avatar-root";
const AVATAR_OVERLAY_MEASURE_SELECTORS = [
  AVATAR_OVERLAY_ROOT_SELECTOR,
  "[data-avatar-overlay-size='notification-tray']",
  "[data-avatar-overlay-size='notification-tray-header']",
  "[data-avatar-overlay-size='notification-tray-list']",
  "[data-avatar-overlay-measure='notification-tray-row']",
].join(", ");

type AvatarOverlayPageProps = {
  initialAvatarId?: string | null;
};

type PointerSample = {
  screenX: number;
  screenY: number;
  timeMs: number;
};

type ActiveDrag = {
  pointerId: number;
  startedOnMascot: boolean;
  hasMoved: boolean;
  screenX: number;
  screenY: number;
  samples: PointerSample[];
};

type MeasuredElementSize = {
  width: number;
  height: number;
};

type MeasuredOverlayState = {
  isTrayVisible: boolean;
  mascot: MeasuredElementSize;
  tray: MeasuredElementSize | null;
};

export function AvatarOverlayPage({ initialAvatarId }: AvatarOverlayPageProps) {
  const { t } = useI18n();
  const [customAvatarsSnapshot, setCustomAvatarsSnapshot] = useState<CustomAvatarsSnapshot>(
    getCustomAvatarsSnapshot(),
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    initialAvatarId ?? DEFAULT_AVATAR_ID,
  );
  const [layout, setLayout] = useState<AvatarOverlayLayout>(DEFAULT_AVATAR_OVERLAY_LAYOUT);
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mascotTransientState, setMascotTransientState] = useState<AvatarSpriteState | null>(null);
  const [isPointerInteractive, setIsPointerInteractive] = useState<boolean>(true);
  const [isReplyEditorActive, setIsReplyEditorActive] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<AvatarOverlayContextMenuPosition | null>(
    null,
  );
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
  const dragRef = useRef<ActiveDrag | null>(null);
  const lastMeasuredOverlayRef = useRef<MeasuredOverlayState | null>(null);
  const missingCustomAvatarRefreshIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCustomAvatars((nextSnapshot) => {
      setCustomAvatarsSnapshot(nextSnapshot);
    });

    void ensureCustomAvatarsLoaded();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    let unlistenGlobalStateUpdated: (() => void) | null = null;

    const syncSelectedAvatarId = async () => {
      try {
        const stored = await readSelectedAvatarId();
        if (!cancelled && typeof stored === "string" && stored.length > 0) {
          setSelectedAvatarId(stored);
        }
      } catch {
        if (!cancelled) {
          setSelectedAvatarId(DEFAULT_AVATAR_ID);
        }
      }
    };

    void syncSelectedAvatarId();

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("selected-avatar-id")) {
        return;
      }

      void syncSelectedAvatarId();
    }).then((dispose) => {
      if (cancelled) {
        void dispose();
        return;
      }

      unlistenGlobalStateUpdated = () => {
        void dispose();
      };
    });

    return () => {
      cancelled = true;
      unlistenGlobalStateUpdated?.();
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
            (thread.status.type !== "idle" ||
              thread.hasUnreadTurn === true) &&
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

  const avatarOptions = useMemo(
    () => buildAvatarOptions(customAvatarsSnapshot.avatars),
    [customAvatarsSnapshot.avatars],
  );
  const selectedAvatar: AvatarOption = useMemo(
    () => resolveAvatarOption(selectedAvatarId, avatarOptions),
    [avatarOptions, selectedAvatarId],
  );

  useEffect(() => {
    if (!selectedAvatarId.startsWith("custom:") || selectedAvatar.id === selectedAvatarId) {
      missingCustomAvatarRefreshIdRef.current = null;
      return;
    }

    if (
      customAvatarsSnapshot.isLoading ||
      missingCustomAvatarRefreshIdRef.current === selectedAvatarId
    ) {
      return;
    }

    missingCustomAvatarRefreshIdRef.current = selectedAvatarId;
    void refreshCustomAvatars().catch(() => undefined);
  }, [customAvatarsSnapshot.isLoading, selectedAvatar.id, selectedAvatarId]);
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
  const notifications = notificationState.notifications;
  const topNotification = notifications[0] ?? null;
  const hasRunningLocalSession = notifications.some(
    (notification) => notification.source !== "cloud" && notification.status === "running",
  );
  const hasRunningCloudSession = notifications.some(
    (notification) => notification.source === "cloud" && notification.status === "running",
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
    isPaused: () => dragRef.current != null,
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
    if (contextMenuPosition == null || typeof window === "undefined") {
      return undefined;
    }

    const handleWindowBlur = () => {
      setContextMenuPosition(null);
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [contextMenuPosition]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const unlistenPromise = onAvatarOverlayLayoutChanged((notification) => {
      setLayout(notification.layout);
    });

    return () => {
      void unlistenPromise.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  const reportElementSizes = useEffectEvent(() => {
    const measurement = measureOverlayState(interactiveRegionRef.current, {
      isTrayVisible: isTrayOpen && notifications.length > 0,
    });
    if (measurement == null || overlayStateEquals(lastMeasuredOverlayRef.current, measurement)) {
      return;
    }

    lastMeasuredOverlayRef.current = measurement;
    void reportAvatarOverlayElementSizeChanged({
      isTrayVisible: measurement.isTrayVisible,
      mascot: measurement.mascot,
      tray: measurement.tray,
    });
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    let frameId: number | null = null;
    const scheduleReport = () => {
      if (frameId != null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        reportElementSizes();
      });
    };

    const observer = new ResizeObserver(scheduleReport);
    const interactiveRegion = interactiveRegionRef.current;
    if (interactiveRegion != null) {
      observer.observe(interactiveRegion);
      for (const element of interactiveRegion.querySelectorAll(AVATAR_OVERLAY_MEASURE_SELECTORS)) {
        observer.observe(element);
      }
    }
    window.addEventListener("resize", scheduleReport);
    scheduleReport();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleReport);
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [layout.mascot.height, layout.mascot.width, notifications, isTrayOpen, reportElementSizes]);

  useLayoutEffect(() => {
    reportElementSizes();
  }, [reportElementSizes, isTrayOpen, notifications.length, layout, selectedAvatar.id]);

  const handleOpenNotification = (notification: AvatarOverlayNotification) => {
    setContextMenuPosition(null);
    setIsReplyEditorActive(false);
    void openInMainWindow(notification.actionPath);
  };

  const handleDismissNotification = (notification: AvatarOverlayNotification) => {
    setContextMenuPosition(null);
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

  const releasePointer = useEffectEvent(
    (
      pointerId: number,
      options: {
        releaseSample?: PointerSample;
        shouldOpenMainWindow: boolean;
      },
    ) => {
      const currentDrag = dragRef.current;
      if (currentDrag == null || currentDrag.pointerId !== pointerId) {
        return;
      }

      dragRef.current = null;
      setIsDragging(false);
      setMascotTransientState(null);

      const velocity = options.releaseSample == null
        ? null
        : derivePointerVelocity({
            hasMoved: currentDrag.hasMoved,
            samples: prunePointerSamples([...currentDrag.samples, options.releaseSample]),
          });

      if (interactiveRegionRef.current?.hasPointerCapture?.(pointerId)) {
        interactiveRegionRef.current.releasePointerCapture(pointerId);
      }

      if (options.shouldOpenMainWindow && currentDrag.startedOnMascot && !currentDrag.hasMoved) {
        void openCurrentMainWindow();
      }

      void endAvatarOverlayDrag();
      if (currentDrag.hasMoved && velocity != null) {
        void releaseAvatarOverlayDrag({
          velocityX: velocity.x,
          velocityY: velocity.y,
        });
      }
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePointerUp = (event: PointerEvent) => {
      releasePointer(event.pointerId, {
        releaseSample: createPointerSample(event),
        shouldOpenMainWindow: true,
      });
    };
    const handlePointerCancel = (event: PointerEvent) => {
      releasePointer(event.pointerId, {
        shouldOpenMainWindow: false,
      });
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [releasePointer]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (contextMenuPosition != null) {
      setContextMenuPosition(null);
    }
    if (
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest(".no-drag") != null
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      startedOnMascot: event.target.closest("[data-avatar-mascot='true']") != null,
      hasMoved: false,
      pointerId: event.pointerId,
      samples: [createPointerSample(event)],
      screenX: event.screenX,
      screenY: event.screenY,
    };
    void startAvatarOverlayDrag({
      pointerWindowX: event.clientX,
      pointerWindowY: event.clientY,
    });
    setIsDragging(true);
    setMascotTransientState(null);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const currentDrag = dragRef.current;
    if (currentDrag == null || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    const sample = createPointerSample(event);
    currentDrag.samples = prunePointerSamples([...currentDrag.samples, sample]);
    const deltaX = sample.screenX - currentDrag.screenX;
    const deltaY = sample.screenY - currentDrag.screenY;

    if (Math.abs(deltaX) < DRAG_THRESHOLD_PX && Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
      return;
    }

    currentDrag.hasMoved = true;
    currentDrag.screenX = sample.screenX;
    currentDrag.screenY = sample.screenY;
    setMascotTransientState((currentState) => deriveTransientMascotState(currentState, deltaX));
    void moveAvatarOverlayDrag();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    releasePointer(event.pointerId, {
      releaseSample: createPointerSample(event),
      shouldOpenMainWindow: true,
    });
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    releasePointer(event.pointerId, {
      shouldOpenMainWindow: false,
    });
  };

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLElement>) => {
    releasePointer(event.pointerId, {
      shouldOpenMainWindow: false,
    });
  };

  const handleMascotContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element) || event.target.closest("[data-avatar-mascot='true']") == null) {
      return;
    }

    event.preventDefault();
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleClosePet = () => {
    setContextMenuPosition(null);
    void toggleAvatarOverlay();
  };

  return (
    <AvatarOverlayView
      contextMenuPosition={contextMenuPosition}
      interactiveRegionRef={interactiveRegionRef}
      selectedAvatar={selectedAvatar}
      notifications={notifications}
      topNotification={topNotification}
      isTrayOpen={isTrayOpen}
      isDragging={isDragging}
      mascotTransientState={mascotTransientState}
      layout={layout}
      hasRunningCloudSession={hasRunningCloudSession}
      hasRunningLocalSession={hasRunningLocalSession}
      onCloseContextMenu={() => {
        setContextMenuPosition(null);
      }}
      onClosePet={handleClosePet}
      onOpenTray={() => {
        setContextMenuPosition(null);
        setIsTrayOpen(true);
      }}
      onCloseTray={() => {
        setContextMenuPosition(null);
        setIsTrayOpen(false);
        setIsReplyEditorActive(false);
      }}
      onOpenNotification={handleOpenNotification}
      onDismissNotification={handleDismissNotification}
      onNotificationReplyEditorActiveChange={setIsReplyEditorActive}
      onOpenNotificationReply={() => undefined}
      onSubmitNotificationReply={handleSubmitNotificationReply}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onContextMenu={handleMascotContextMenu}
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
          if (isVisiblePointerTarget(element) && pointIntersectsElement(point, element)) {
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

function createPointerSample(
  event: Pick<PointerEvent, "screenX" | "screenY" | "timeStamp">,
): PointerSample {
  return {
    screenX: event.screenX,
    screenY: event.screenY,
    timeMs: event.timeStamp,
  };
}

function prunePointerSamples(samples: PointerSample[]) {
  const latestSample = samples.at(-1);
  if (latestSample == null) {
    return samples;
  }
  return samples.filter((sample) => latestSample.timeMs - sample.timeMs <= DRAG_VELOCITY_WINDOW_MS);
}

function derivePointerVelocity(options: {
  hasMoved: boolean;
  samples: PointerSample[];
}) {
  if (!options.hasMoved) {
    return null;
  }

  const latestSample = options.samples.at(-1);
  if (latestSample == null) {
    return null;
  }

  const originSample = options.samples.find((sample) => latestSample.timeMs - sample.timeMs > 16);
  if (originSample == null) {
    return null;
  }

  const elapsedSeconds = (latestSample.timeMs - originSample.timeMs) / 1000;
  if (elapsedSeconds <= 0) {
    return null;
  }

  const rawVelocity = {
    x: (latestSample.screenX - originSample.screenX) / elapsedSeconds,
    y: (latestSample.screenY - originSample.screenY) / elapsedSeconds,
  };
  const rawSpeed = Math.hypot(rawVelocity.x, rawVelocity.y);
  if (rawSpeed < DRAG_MIN_FLING_SPEED_PX_PER_SECOND) {
    return null;
  }
  if (rawSpeed <= DRAG_MAX_FLING_SPEED_PX_PER_SECOND) {
    return rawVelocity;
  }

  const scale = DRAG_MAX_FLING_SPEED_PX_PER_SECOND / rawSpeed;
  return {
    x: rawVelocity.x * scale,
    y: rawVelocity.y * scale,
  };
}

function deriveTransientMascotState(
  currentDragState: AvatarSpriteState | null,
  deltaX: number,
): AvatarSpriteState | null {
  if (deltaX >= DRAG_THRESHOLD_PX) {
    return "running-right";
  }
  if (deltaX <= -DRAG_THRESHOLD_PX) {
    return "running-left";
  }
  return currentDragState;
}

function measureOverlayState(
  element: HTMLElement | null,
  options: { isTrayVisible: boolean },
): MeasuredOverlayState | null {
  if (element == null) {
    return null;
  }

  const mascot = measureElementSize(element.querySelector(AVATAR_OVERLAY_ROOT_SELECTOR));
  const tray = measureTraySize(
    element.querySelector("[data-avatar-overlay-size='notification-tray']"),
  );
  if (mascot == null) {
    return null;
  }

  return {
    isTrayVisible: options.isTrayVisible,
    mascot,
    tray,
  };
}

function measureElementSize(element: Element | null) {
  if (!(element instanceof HTMLElement) || isElementDisplayNone(element)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };
}

function measureTraySize(element: Element | null) {
  if (!(element instanceof HTMLElement) || isElementDisplayNone(element)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const measuredWidth = Math.ceil(element.offsetWidth > 0 ? element.offsetWidth : rect.width);
  const header = element.querySelector("[data-avatar-overlay-size='notification-tray-header']");
  const list = element.querySelector("[data-avatar-overlay-size='notification-tray-list']");
  if (!(header instanceof HTMLElement) || !(list instanceof HTMLElement)) {
    return {
      width: measuredWidth,
      height: Math.ceil(rect.height),
    };
  }

  return {
    width: measuredWidth,
    height: Math.ceil(header.getBoundingClientRect().height + list.scrollHeight),
  };
}

function overlayStateEquals(
  left: MeasuredOverlayState | null,
  right: MeasuredOverlayState,
) {
  return (
    left != null &&
    left.isTrayVisible === right.isTrayVisible &&
    left.mascot.width === right.mascot.width &&
    left.mascot.height === right.mascot.height &&
    elementSizeEquals(left.tray, right.tray)
  );
}

function elementSizeEquals(
  left: MeasuredElementSize | null,
  right: MeasuredElementSize | null,
) {
  return (
    left === right ||
    (left != null &&
      right != null &&
      left.width === right.width &&
      left.height === right.height)
  );
}

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

function isElementDisplayNone(element: HTMLElement) {
  return window.getComputedStyle(element).display === "none";
}
