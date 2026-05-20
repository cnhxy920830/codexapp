import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
} from "./AppShellIcons";
import { Button } from "./Button";
import type { MessageKey, MessageValues } from "../i18n/messages";
import {
  getSettingsRemoteHostColor,
  LOCAL_SETTINGS_HOST_ID,
  type RemoteConnection,
} from "../services/settingsHosts";

type SettingsHostDropdownProps = {
  align?: "center" | "end" | "start";
  connectedRemoteConnections: RemoteConnection[];
  contentWidth?: "icon" | "menuWide" | "workspace";
  disabled?: boolean;
  onSelectHost: (hostId: string) => void;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  t: (key: MessageKey, values?: MessageValues) => string;
  triggerClassName?: string;
  triggerColor?: "ghost" | "ghostActive" | "ghostMuted" | "outline" | "outlineActive" | "primary" | "secondary";
};

export function SettingsHostDropdown({
  align = "end",
  connectedRemoteConnections,
  contentWidth = "menuWide",
  onSelectHost,
  remoteConnectionHostIds,
  selectedHostId,
  t,
  triggerClassName,
  triggerColor = "outline",
}: SettingsHostDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRemoteConnection =
    connectedRemoteConnections.find((remoteConnection) => remoteConnection.hostId === selectedHostId) ?? null;
  const localHostLabel = t("settings.hostDropdown.local");
  const selectedHostLabel = selectedRemoteConnection?.displayName ?? localHostLabel;
  const hostOptions = [
    { hostId: LOCAL_SETTINGS_HOST_ID, displayName: localHostLabel },
    ...connectedRemoteConnections.map((remoteConnection) => ({
      hostId: remoteConnection.hostId,
      displayName: remoteConnection.displayName,
    })),
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <Button
        aria-label={t("settings.hostDropdown.title")}
        className={
          triggerClassName ??
          "h-7 w-auto max-w-[160px] px-2 text-[13px]"
        }
        color={triggerColor}
        onClick={() => setIsOpen((open) => !open)}
        size="composerSm"
      >
        {selectedRemoteConnection === null ? (
          <SettingsLocalHostIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-text)]" />
        ) : (
          <SettingsRemoteHostIcon
            className="h-4 w-4 shrink-0"
            hostId={selectedRemoteConnection.hostId}
            hostIdsForColorAssignment={remoteConnectionHostIds}
          />
        )}
        <span className="truncate text-left text-[var(--app-shell-text)]">{selectedHostLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </Button>
      {isOpen ? (
        <div
          className={[
            "app-card absolute top-[calc(100%+8px)] z-20 rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
            align === "start"
              ? "left-0"
              : align === "center"
                ? "left-1/2 -translate-x-1/2"
                : "right-0",
            contentWidth === "workspace"
              ? "w-[260px]"
              : contentWidth === "icon"
                ? "w-[220px]"
                : "w-[220px]",
          ].join(" ")}
        >
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
            {t("settings.hostDropdown.title")}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {hostOptions.map((hostOption) => {
              const isSelected = hostOption.hostId === selectedHostId;
              return (
                <button
                  key={hostOption.hostId}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectHost(hostOption.hostId);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {hostOption.hostId === LOCAL_SETTINGS_HOST_ID ? (
                      <SettingsLocalHostIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <SettingsRemoteHostIcon
                        className="h-4 w-4 shrink-0"
                        hostId={hostOption.hostId}
                        hostIdsForColorAssignment={remoteConnectionHostIds}
                      />
                    )}
                    <span className="truncate">{hostOption.displayName}</span>
                  </span>
                  {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsLocalHostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M17.6682 13.998H12.6565L11.9641 14.3447C11.8718 14.3909 11.7695 14.415 11.6663 14.415H8.33325C8.23001 14.415 8.12774 14.3909 8.0354 14.3447L7.34302 13.998H2.32837V14.583C2.32837 15.1362 2.77712 15.585 3.33032 15.585H16.6663C17.2195 15.585 17.6682 15.1362 17.6682 14.583V13.998ZM16.8352 6.41699C16.8352 5.93931 16.8347 5.62054 16.8147 5.37598C16.8002 5.19841 16.7766 5.09313 16.7512 5.02246L16.7258 4.96191C16.6538 4.82049 16.5493 4.69891 16.4221 4.60645L16.2883 4.52441C16.2194 4.48931 16.1101 4.45489 15.8733 4.43555C15.6288 4.4156 15.3106 4.41504 14.8333 4.41504H5.16626C4.68886 4.41504 4.37071 4.41559 4.12622 4.43555C3.94903 4.45002 3.84339 4.47277 3.77271 4.49805L3.71216 4.52441C3.57094 4.59637 3.4491 4.70021 3.35669 4.82715L3.27368 4.96191C3.23861 5.03079 3.20513 5.13947 3.18579 5.37598C3.16581 5.62054 3.16528 5.93931 3.16528 6.41699V12.668H7.50024L7.57642 12.6729C7.65302 12.6817 7.72779 12.7036 7.79712 12.7383L8.4895 13.085H11.51L12.2024 12.7383L12.2737 12.708C12.346 12.6819 12.423 12.668 12.5002 12.668H16.8352V6.41699ZM18.1653 12.668H18.3333C18.7003 12.668 18.9981 12.9659 18.9983 13.333V14.583C18.9983 15.8708 17.954 16.915 16.6663 16.915H3.33032C2.04258 16.915 0.998291 15.8708 0.998291 14.583V13.333L1.01196 13.1992C1.07402 12.8962 1.34201 12.668 1.66333 12.668H1.83521V6.41699C1.83521 5.96125 1.83419 5.57886 1.85962 5.26758C1.88569 4.94869 1.94266 4.6459 2.08911 4.3584L2.17896 4.19727C2.40296 3.83215 2.72389 3.53443 3.10767 3.33887L3.21606 3.28809C3.47122 3.17862 3.73854 3.13317 4.01782 3.11035C4.32903 3.08493 4.71068 3.08496 5.16626 3.08496H14.8333C15.2888 3.08496 15.6705 3.08494 15.9817 3.11035C16.3007 3.13642 16.6042 3.19231 16.8918 3.33887L17.052 3.42871C17.4174 3.65275 17.7147 3.97437 17.9104 4.3584L17.9612 4.4668C18.0705 4.72179 18.1171 4.9885 18.1399 5.26758C18.1653 5.57886 18.1653 5.96125 18.1653 6.41699V12.668Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SettingsRemoteHostIcon({
  className,
  hostId,
  hostIdsForColorAssignment,
}: {
  className?: string;
  hostId: string;
  hostIdsForColorAssignment: string[];
}) {
  const color = getSettingsRemoteHostColor(hostId, hostIdsForColorAssignment);
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path d="M10 2.125C14.3492 2.125 17.875 5.65076 17.875 10C17.875 14.3492 14.3492 17.875 10 17.875C5.65076 17.875 2.125 14.3492 2.125 10C2.125 5.65076 5.65076 2.125 10 2.125ZM7.88672 10.625C7.94334 12.3161 8.22547 13.8134 8.63965 14.9053C8.87263 15.5194 9.1351 15.9733 9.39453 16.2627C9.65437 16.5524 9.86039 16.625 10 16.625C10.1396 16.625 10.3456 16.5524 10.6055 16.2627C10.8649 15.9733 11.1274 15.5194 11.3604 14.9053C11.7745 13.8134 12.0567 12.3161 12.1133 10.625H7.88672ZM3.40527 10.625C3.65313 13.2734 5.45957 15.4667 7.89844 16.2822C7.7409 15.997 7.5977 15.6834 7.4707 15.3486C6.99415 14.0923 6.69362 12.439 6.63672 10.625H3.40527ZM13.3633 10.625C13.3064 12.439 13.0059 14.0923 12.5293 15.3486C12.4022 15.6836 12.2582 15.9969 12.1006 16.2822C14.5399 15.467 16.3468 13.2737 16.5947 10.625H13.3633ZM12.1006 3.7168C12.2584 4.00235 12.4021 4.31613 12.5293 4.65137C13.0059 5.90775 13.3064 7.56102 13.3633 9.375H16.5947C16.3468 6.72615 14.54 4.53199 12.1006 3.7168ZM10 3.375C9.86039 3.375 9.65437 3.44756 9.39453 3.7373C9.1351 4.02672 8.87263 4.48057 8.63965 5.09473C8.22547 6.18664 7.94334 7.68388 7.88672 9.375H12.1133C12.0567 7.68388 11.7745 6.18664 11.3604 5.09473C11.1274 4.48057 10.8649 4.02672 10.6055 3.7373C10.3456 3.44756 10.1396 3.375 10 3.375ZM7.89844 3.7168C5.45942 4.53222 3.65314 6.72647 3.40527 9.375H6.63672C6.69362 7.56102 6.99415 5.90775 7.4707 4.65137C7.59781 4.31629 7.74073 4.00224 7.89844 3.7168Z" />
    </svg>
  );
}
