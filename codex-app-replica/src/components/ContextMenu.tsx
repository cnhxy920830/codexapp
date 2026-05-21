import {
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: () => void;
};

export function ContextMenu({
  children,
  items,
}: {
  children: ReactNode;
  items: ContextMenuItem[];
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openPosition, setOpenPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (openPosition === null || typeof window === "undefined") {
      setMenuPosition(null);
      return;
    }

    const menuElement = menuRef.current;
    if (menuElement == null) {
      return;
    }

    const menuRect = menuElement.getBoundingClientRect();
    const viewportPadding = 8;
    const left = Math.max(
      viewportPadding,
      Math.min(openPosition.x, window.innerWidth - menuRect.width - viewportPadding),
    );
    const top = Math.max(
      viewportPadding,
      Math.min(openPosition.y, window.innerHeight - menuRect.height - viewportPadding),
    );
    setMenuPosition({ left, top });
  }, [openPosition]);

  useEffect(() => {
    if (openPosition === null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpenPosition(null);
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        event.preventDefault();
        return;
      }
      setOpenPosition(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPosition(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPosition]);

  const handleContextMenu = (event: React.MouseEvent) => {
    if (items.length === 0) {
      return;
    }
    event.preventDefault();
    setOpenPosition({ x: event.clientX, y: event.clientY });
  };

  const triggerElement = isValidElement(children)
    ? (children as ReactElement<{ onContextMenu?: (event: React.MouseEvent) => void }>)
    : null;
  const trigger = triggerElement
    ? cloneElement(
        triggerElement,
        {
          onContextMenu: (event: React.MouseEvent) => {
            triggerElement.props.onContextMenu?.(event);
            handleContextMenu(event);
          },
        },
      )
    : (
        <span className="contents" onContextMenu={handleContextMenu}>
          {children}
        </span>
      );

  return (
    <>
      {trigger}
      {openPosition !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 m-px flex min-w-[180px] flex-col rounded-xl bg-token-dropdown-background/90 p-1 text-token-foreground shadow-lg ring-[0.5px] ring-token-border backdrop-blur-sm select-none"
              style={{
                left: `${menuPosition?.left ?? openPosition.x}px`,
                top: `${menuPosition?.top ?? openPosition.y}px`,
              }}
              onContextMenu={(event) => {
                event.preventDefault();
              }}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-disabled={item.disabled === true}
                  className={[
                    "rounded-lg p-1.5 text-left text-sm outline-hidden",
                    item.disabled === true
                      ? "cursor-default opacity-50"
                      : "cursor-interaction hover:bg-token-list-hover-background focus:bg-token-list-hover-background",
                  ].join(" ")}
                  onClick={() => {
                    if (item.disabled === true) {
                      return;
                    }
                    setOpenPosition(null);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
