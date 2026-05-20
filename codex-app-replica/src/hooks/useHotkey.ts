import { useEffect, useEffectEvent, useRef } from "react";

type ParsedAccelerator = {
  key: string | null;
  requireAlt: boolean;
  requireCtrl: boolean;
  requireMeta: boolean;
  requireShift: boolean;
};

export function useHotkey({
  accelerator,
  allowRepeat = false,
  capture = true,
  enabled = true,
  ignoreWithin,
  keyboardEventTarget,
  onKeyDown,
  onKeyUp,
}: {
  accelerator: string;
  allowRepeat?: boolean;
  capture?: boolean;
  enabled?: boolean;
  ignoreWithin?: string;
  keyboardEventTarget?: EventTarget | null;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
}) {
  const parsedAccelerator = parseAccelerator(accelerator);
  const isPressedRef = useRef(false);
  const hasKeyUpHandler = onKeyUp != null;

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled) {
      return;
    }
    if (!allowRepeat && event.repeat) {
      return;
    }
    if (isWithinSelector(event, "[data-codex-shortcut-capture]")) {
      return;
    }
    if (ignoreWithin && isWithinSelector(event, ignoreWithin)) {
      return;
    }
    if (!matchesAccelerator(event, parsedAccelerator)) {
      return;
    }

    isPressedRef.current = true;
    onKeyDown(event);
  });

  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (!isPressedRef.current || !matchesKey(event, parsedAccelerator)) {
      return;
    }

    isPressedRef.current = false;
    onKeyUp?.(event);
  });

  const keyDownListener: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      handleKeyDown(event);
    }
  };
  const keyUpListener: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      handleKeyUp(event);
    }
  };

  useEffect(() => {
    if (!enabled) {
      isPressedRef.current = false;
      return;
    }

    const eventTarget =
      keyboardEventTarget ?? (typeof window === "undefined" ? null : window);
    if (eventTarget == null) {
      isPressedRef.current = false;
      return;
    }

    eventTarget.addEventListener("keydown", keyDownListener, { capture });
    if (hasKeyUpHandler) {
      eventTarget.addEventListener("keyup", keyUpListener, { capture });
    }

    return () => {
      eventTarget.removeEventListener("keydown", keyDownListener, { capture });
      if (hasKeyUpHandler) {
        eventTarget.removeEventListener("keyup", keyUpListener, { capture });
      }
      isPressedRef.current = false;
    };
  }, [capture, enabled, hasKeyUpHandler, keyDownListener, keyUpListener, keyboardEventTarget]);
}

function parseAccelerator(accelerator: string): ParsedAccelerator {
  const segments = accelerator.split("+").filter(Boolean);
  let key: string | null = null;
  let requireCtrl = false;
  let requireMeta = false;
  let requireAlt = false;
  let requireShift = false;

  for (const segment of segments) {
    switch (segment) {
      case "CmdOrCtrl":
        requireCtrl = true;
        break;
      case "Command":
      case "Cmd":
        requireMeta = true;
        break;
      case "Control":
      case "Ctrl":
        requireCtrl = true;
        break;
      case "Alt":
      case "Option":
        requireAlt = true;
        break;
      case "Shift":
        requireShift = true;
        break;
      default:
        key = normalizeKey(segment.toLowerCase());
        break;
    }
  }

  return {
    key,
    requireAlt,
    requireCtrl,
    requireMeta,
    requireShift,
  };
}

function normalizeKey(key: string) {
  switch (key) {
    case "space":
      return " ";
    case "plus":
      return "+";
    default:
      return key;
  }
}

function isWithinSelector(event: KeyboardEvent, selector: string) {
  return event.target instanceof Element && event.target.closest(selector) != null;
}

function matchesKey(event: KeyboardEvent, accelerator: ParsedAccelerator) {
  return (
    event.key.toLowerCase() === accelerator.key ||
    (accelerator.key === "=" && accelerator.requireShift && event.key === "+")
  );
}

function matchesAccelerator(event: KeyboardEvent, accelerator: ParsedAccelerator) {
  return !(
    !accelerator.key ||
    !matchesKey(event, accelerator) ||
    event.ctrlKey !== accelerator.requireCtrl ||
    event.metaKey !== accelerator.requireMeta ||
    event.altKey !== accelerator.requireAlt ||
    event.shiftKey !== accelerator.requireShift
  );
}
