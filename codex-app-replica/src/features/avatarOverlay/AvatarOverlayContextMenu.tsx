import { useEffect, useRef } from "react";

export type AvatarOverlayContextMenuPosition = {
  x: number;
  y: number;
};

type AvatarOverlayContextMenuProps = {
  label: string;
  onClose: () => void;
  onSelect: () => void;
  position: AvatarOverlayContextMenuPosition;
};

export function AvatarOverlayContextMenu({
  label,
  onClose,
  onSelect,
  position,
}: AvatarOverlayContextMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleContextMenu = (event: globalThis.MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      data-avatar-overlay-hit-region="context-menu"
      className="app-card no-drag fixed z-30 min-w-[148px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      style={getSafeAvatarOverlayContextMenuPosition(position)}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <button
        type="button"
        className="app-nav-item-idle no-drag flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px]"
        onClick={() => {
          onClose();
          onSelect();
        }}
      >
        {label}
      </button>
    </div>
  );
}

function getSafeAvatarOverlayContextMenuPosition(position: AvatarOverlayContextMenuPosition) {
  if (typeof window === "undefined") {
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
    };
  }

  const contextMenuWidth = 148;
  const contextMenuHeight = 48;
  const viewportPadding = 8;
  return {
    left: `${Math.max(
      viewportPadding,
      Math.min(position.x, window.innerWidth - contextMenuWidth - viewportPadding),
    )}px`,
    top: `${Math.max(
      viewportPadding,
      Math.min(position.y, window.innerHeight - contextMenuHeight - viewportPadding),
    )}px`,
  };
}
