import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  SettingsCogIcon,
} from "../../components/AppShellIcons";
import {
  getConfigFileName,
  getPreferredLocalEnvironment,
  normalizePathForComparison,
  type LocalEnvironmentConfigEntry,
} from "../../services/localEnvironments";
import type { TranslateFn } from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

type AutomationLocalEnvironmentSelectorProps = {
  align?: "start" | "end";
  className?: string;
  defaultOpen?: boolean;
  fullWidth?: boolean;
  labelClassName?: string;
  onOpenSettings: (params: {
    configPath: string | null;
    workspaceRoot: string;
  }) => void;
  showIcon?: boolean;
  state: AutomationLocalEnvironmentState;
  t: TranslateFn;
};

export function AutomationLocalEnvironmentSelector({
  align = "start",
  className,
  defaultOpen = false,
  fullWidth = true,
  labelClassName,
  onOpenSettings,
  showIcon = true,
  state,
  t,
}: AutomationLocalEnvironmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const defaultEnvironment = useMemo(
    () => getPreferredLocalEnvironment(state.environments),
    [state.environments],
  );
  const defaultEnvironmentConfigPath = defaultEnvironment?.configPath ?? null;
  const normalizedDefaultEnvironmentConfigPath =
    defaultEnvironmentConfigPath === null
      ? null
      : normalizePathForComparison(defaultEnvironmentConfigPath);
  const normalizedSelectedConfigPath =
    state.selectedConfigPath === null
      ? null
      : normalizePathForComparison(state.selectedConfigPath);
  const selectedEnvironment = useMemo(
    () =>
      normalizedSelectedConfigPath === null
        ? null
        : state.environments.find(
            (entry) =>
              normalizePathForComparison(entry.configPath) ===
              normalizedSelectedConfigPath,
          ) ?? null,
    [normalizedSelectedConfigPath, state.environments],
  );
  const availableEnvironments = useMemo(() => {
    if (normalizedDefaultEnvironmentConfigPath === null) {
      return state.environments;
    }

    return state.environments.filter(
      (entry) =>
        normalizePathForComparison(entry.configPath) !==
        normalizedDefaultEnvironmentConfigPath,
    );
  }, [normalizedDefaultEnvironmentConfigPath, state.environments]);
  const canSelectNoEnvironment = !state.isLoading && state.error === null;
  const triggerLabel = getTriggerLabel({
    selectedEnvironment,
    t,
    isLoading: state.isLoading,
  });

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
    <div
      className={["relative max-w-full", fullWidth ? "w-full" : "w-auto"].join(" ")}
      ref={containerRef}
    >
      <button
        type="button"
        aria-label={t("composer.worktreeEnvironment.tooltip")}
        onClick={() => setIsOpen((current) => !current)}
        className={[
          "app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          {showIcon ? <SettingsCogIcon className="h-4 w-4 shrink-0" /> : null}
          <span
            className={[
              "max-w-40 truncate text-left",
              labelClassName ?? "app-text-muted",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {triggerLabel}
          </span>
        </span>
        {state.isLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
        )}
      </button>

      {isOpen ? (
        <div
          className={[
            "app-card absolute top-[calc(100%+8px)] z-20 w-64 rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
            align === "end" ? "right-0" : "left-0",
          ].join(" ")}
        >
          <div className="px-3 py-2 text-[12px] font-medium text-[var(--app-shell-title)]">
            {t("composer.worktreeEnvironment.title")}
          </div>

          <div className="vertical-scroll-fade-mask flex max-h-[220px] flex-col overflow-y-auto">
            {canSelectNoEnvironment ? (
              <SelectorMenuItem
                isSelected={state.selectedConfigPath === null}
                label={t("codex.environmentSelector.noEnvironment")}
                onClick={() => {
                  state.onSelectConfigPath(null);
                  setIsOpen(false);
                }}
              />
            ) : null}

            {defaultEnvironment ? (
              <SelectorMenuItem
                isSelected={
                  normalizedSelectedConfigPath !== null &&
                  normalizedSelectedConfigPath ===
                    normalizedDefaultEnvironmentConfigPath
                }
                onClick={() => {
                  state.onSelectConfigPath(defaultEnvironment.configPath);
                  setIsOpen(false);
                }}
                label={
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      title={t("composer.worktreeEnvironment.default")}
                      className="flex shrink-0 text-[var(--app-shell-muted)]"
                    >
                      <DefaultEnvironmentIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">
                      {formatEnvironmentLabel(defaultEnvironment)}
                    </span>
                  </span>
                }
              />
            ) : null}

            {state.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
              </div>
            ) : state.error !== null ? (
              <div className="rounded-[10px] px-3 py-2 text-[13px] text-[var(--app-shell-danger)]">
                {t("composer.worktreeEnvironment.error")}
              </div>
            ) : availableEnvironments.length > 0 ? (
              <div className="flex flex-col">
                {availableEnvironments.map((environment) => (
                  <SelectorMenuItem
                    key={environment.configPath}
                    isSelected={
                      normalizedSelectedConfigPath !== null &&
                      normalizePathForComparison(environment.configPath) ===
                        normalizedSelectedConfigPath
                    }
                    label={formatEnvironmentLabel(environment)}
                    onClick={() => {
                      state.onSelectConfigPath(environment.configPath);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            ) : state.environments.length === 0 ? (
              <div className="rounded-[10px] px-3 py-2 text-[13px] app-text-muted">
                {t("codex.environments.noEnvironmentsFound")}
              </div>
            ) : null}
          </div>

          <div className="mt-2 border-t border-[var(--app-shell-border)] pt-2">
            <button
              type="button"
              onClick={() => {
                if (state.workspaceRoot === null) {
                  return;
                }

                onOpenSettings({
                  configPath: state.selectedConfigPath,
                  workspaceRoot: state.workspaceRoot,
                });
                setIsOpen(false);
              }}
              className="app-nav-item-idle flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              <LinkExternalIcon className="h-4 w-4 shrink-0" />
              <span>{t("composer.worktreeEnvironment.create")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectorMenuItem({
  isSelected,
  label,
  onClick,
}: {
  isSelected: boolean;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
        isSelected ? "app-nav-item-active" : "app-nav-item-idle",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">{label}</span>
      {isSelected ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      ) : null}
    </button>
  );
}

function getTriggerLabel({
  isLoading,
  selectedEnvironment,
  t,
}: {
  isLoading: boolean;
  selectedEnvironment: LocalEnvironmentConfigEntry | null;
  t: TranslateFn;
}) {
  if (isLoading) {
    return t("composer.worktreeEnvironment.loading");
  }

  return selectedEnvironment?.type === "success"
    ? selectedEnvironment.environment.name
    : t("codex.environmentSelector.noEnvironment");
}

function formatEnvironmentLabel(environment: LocalEnvironmentConfigEntry) {
  if (environment.type === "success") {
    const name = environment.environment.name.trim();
    return name.length > 0
      ? name
      : getConfigFileName(environment.configPath);
  }

  return getConfigFileName(environment.configPath);
}

function DefaultEnvironmentIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="15"
      height="14"
      viewBox="0 0 15 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M5.914.678a1.332 1.332 0 0 1 2.321 0L9.792 3.44a.268.268 0 0 0 .18.13l3.108.628a1.332 1.332 0 0 1 .717 2.207L11.652 8.74a.268.268 0 0 0-.07.211l.364 3.15a1.332 1.332 0 0 1-1.877 1.364l-2.883-1.32a.268.268 0 0 0-.222 0l-2.883 1.32a1.333 1.333 0 0 1-1.878-1.364l.364-3.15a.268.268 0 0 0-.069-.211L.353 6.405a1.332 1.332 0 0 1 .716-2.207l3.108-.627a.268.268 0 0 0 .18-.13L5.914.677Zm1.394.523a.268.268 0 0 0-.467 0L5.285 3.962c-.19.337-.518.575-.897.652L1.28 5.24a.268.268 0 0 0-.145.444l2.147 2.334c.261.285.386.67.342 1.055l-.364 3.15a.268.268 0 0 0 .378.273l2.883-1.32a1.332 1.332 0 0 1 1.108 0l2.883 1.32a.268.268 0 0 0 .377-.274l-.363-3.15c-.044-.384.08-.769.342-1.054l2.146-2.334a.268.268 0 0 0-.144-.444l-3.108-.627a1.332 1.332 0 0 1-.897-.652l-1.557-2.76Z"
      />
    </svg>
  );
}

function LinkExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.30164 12.197V8.53003C4.30164 7.84109 4.30099 7.28391 4.33777 6.83374C4.3752 6.37598 4.45451 5.9701 4.64636 5.59351L4.76843 5.37573C5.07254 4.8798 5.50895 4.47626 6.03015 4.21069L6.17273 4.14331C6.50897 3.99911 6.86981 3.93484 7.27039 3.9021C7.72063 3.86531 8.27758 3.86499 8.96668 3.86499H9.13367L9.26746 3.87866C9.57036 3.94067 9.79855 4.20883 9.79871 4.53003C9.79871 4.85133 9.5704 5.11932 9.26746 5.1814L9.13367 5.19507H8.96668C8.25564 5.19507 7.7623 5.19596 7.37878 5.22729C7.09678 5.25034 6.90733 5.28812 6.76355 5.3396L6.63367 5.39526C6.33147 5.54924 6.07854 5.7835 5.90222 6.07104L5.83191 6.19702C5.75142 6.35498 5.69465 6.56664 5.66394 6.94214C5.63261 7.3256 5.63171 7.81917 5.63171 8.53003V12.197C5.63171 12.9081 5.63261 13.4014 5.66394 13.7849C5.69464 14.1606 5.7514 14.372 5.83191 14.53L5.90222 14.656C6.07854 14.9436 6.33141 15.1778 6.63367 15.3318L6.76355 15.3884C6.9073 15.4399 7.09693 15.4767 7.37878 15.4998C7.7623 15.5311 8.25564 15.532 8.96668 15.532H12.6337C13.3445 15.532 13.8381 15.5311 14.2216 15.4998C14.5971 15.469 14.8087 15.4123 14.9667 15.3318L15.0927 15.2615C15.3802 15.0852 15.6145 14.8322 15.7684 14.53L15.8241 14.4001C15.8756 14.2564 15.9134 14.0669 15.9364 13.7849C15.9677 13.4014 15.9686 12.9081 15.9686 12.197V12.03C15.9688 11.6629 16.2665 11.365 16.6337 11.365C17.0007 11.3652 17.2985 11.663 17.2987 12.03V12.197C17.2987 12.8861 17.2984 13.4431 17.2616 13.8933C17.2289 14.2939 17.1646 14.6547 17.0204 14.991L16.953 15.1335C16.6874 15.6547 16.2839 16.0912 15.788 16.3953L15.5702 16.5173C15.1936 16.7092 14.7877 16.7885 14.33 16.8259C13.8798 16.8627 13.3226 16.8621 12.6337 16.8621H8.96668C8.27758 16.8621 7.72063 16.8627 7.27039 16.8259C6.86974 16.7932 6.50902 16.728 6.17273 16.5837L6.03015 16.5173C5.50912 16.2519 5.07253 15.848 4.76843 15.3523L4.64636 15.1335C4.45456 14.7569 4.37518 14.3511 4.33777 13.8933C4.30098 13.4431 4.30164 12.8861 4.30164 12.197ZM12.1034 10.0007C11.8437 10.2603 11.4226 10.2604 11.163 10.0007C10.9033 9.74109 10.9034 9.32001 11.163 9.0603L12.1034 10.0007ZM18.1317 7.86401C18.1315 8.23113 17.8338 8.52905 17.4667 8.52905C17.0995 8.52905 16.8018 8.23113 16.8016 7.86401V5.30249L12.1034 10.0007L11.6337 9.53003L11.163 9.0603L15.8602 4.36206H13.2997C12.9326 4.36188 12.6346 4.06418 12.6346 3.69702C12.6346 3.32986 12.9326 3.03216 13.2997 3.03198H17.4667L17.6005 3.04565C17.9036 3.10759 18.1317 3.37559 18.1317 3.69702V7.86401Z"
        fill="currentColor"
      />
    </svg>
  );
}
