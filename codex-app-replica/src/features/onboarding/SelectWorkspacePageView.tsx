import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { CheckIcon, FolderIcon, PlusIcon } from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";

export type WorkspaceRootOptionView = {
  root: string;
  label: string;
};

export type SelectWorkspacePageViewProps = {
  addProjectMenuOpen?: boolean;
  hasAvailableRoots: boolean;
  isEmptyState: boolean;
  isLoadingRoots: boolean;
  isRemoteHost?: boolean;
  isSelectAllChecked: boolean;
  isSkipPending: boolean;
  hasSelectedRoots: boolean;
  selectedRoots: string[];
  showPlaygroundCopy: boolean;
  skipErrorMessage: string | null;
  visibleWorkspaceRootOptions: WorkspaceRootOptionView[];
  onContinue: () => void;
  onOpenFolder: () => void;
  onSkip: () => void;
  onStartFromScratch: () => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleWorkspace: (root: string, checked: boolean) => void;
};

export function SelectWorkspacePageView({
  addProjectMenuOpen,
  hasAvailableRoots,
  isEmptyState,
  isLoadingRoots,
  isRemoteHost = false,
  isSelectAllChecked,
  isSkipPending,
  hasSelectedRoots,
  selectedRoots,
  showPlaygroundCopy,
  skipErrorMessage,
  visibleWorkspaceRootOptions,
  onContinue,
  onOpenFolder,
  onSkip,
  onStartFromScratch,
  onToggleSelectAll,
  onToggleWorkspace,
}: SelectWorkspacePageViewProps) {
  const { t } = useI18n();
  const selectedRootsSet = new Set(selectedRoots);

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <div className="absolute inset-0 bg-token-bg-primary electron:bg-transparent" />
      <div className="fixed inset-x-0 bottom-0 top-0 flex items-center justify-center px-6 pb-8 pt-8">
        {isEmptyState ? (
          <SelectWorkspaceSection showIcon>
            <div className="flex w-full flex-col gap-3">
              <AddProjectButton
                buttonClassName="w-full justify-center py-2.5"
                buttonColor={showPlaygroundCopy ? "outline" : "primary"}
                forceOpen={addProjectMenuOpen}
                isRemoteHost={isRemoteHost}
                onStartFromScratch={onStartFromScratch}
                onUseExistingFolder={onOpenFolder}
              />
              {isRemoteHost ? null : (
                <SkipWorkspaceButton
                  errorMessage={skipErrorMessage}
                  isPending={isSkipPending}
                  onClick={onSkip}
                  showPlaygroundCopy={showPlaygroundCopy}
                />
              )}
            </div>
          </SelectWorkspaceSection>
        ) : (
          <SelectWorkspaceSection showIcon={false}>
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-2">
                {isLoadingRoots ? (
                  <div className="bg-token-surface-primary flex w-full items-center justify-center gap-2 rounded-2xl border border-token-border px-5 py-6">
                    <Spinner className="h-4 w-4 text-token-foreground" />
                    <span className="text-sm text-token-description-foreground">
                      {t("electron.onboarding.workspace.loading")}
                    </span>
                  </div>
                ) : null}
                {hasAvailableRoots ? (
                  <div
                    aria-label={t("electron.onboarding.workspace.listLabel")}
                    className={joinClasses(
                      "flex h-[240px] w-full flex-col overflow-y-auto rounded-2xl border border-token-border bg-token-surface-primary px-5 py-4",
                      isLoadingRoots && "pointer-events-none opacity-50",
                    )}
                    role="list"
                  >
                    <WorkspaceCheckboxRow
                      checked={isSelectAllChecked}
                      checkboxId="workspace-root-select-all"
                      disabled={isLoadingRoots}
                      label={t("electron.onboarding.workspace.selectAll")}
                      onCheckedChange={onToggleSelectAll}
                    />
                    {visibleWorkspaceRootOptions.map((option, index) => (
                      <WorkspaceCheckboxRow
                        key={option.root}
                        checked={selectedRootsSet.has(option.root)}
                        checkboxId={`workspace-root-${index}`}
                        description={option.root}
                        disabled={isLoadingRoots}
                        label={option.label}
                        onCheckedChange={(checked) => onToggleWorkspace(option.root, checked)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-token-description-foreground">
                    {t("electron.onboarding.workspace.empty")}
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-3">
                <div className="flex w-full items-center gap-4">
                  <AddProjectButton
                    buttonClassName="flex-1 justify-center border-token-button-border bg-transparent text-base leading-6 font-medium whitespace-nowrap enabled:hover:bg-token-foreground/5"
                    buttonColor="outline"
                    buttonSize="large"
                    forceOpen={addProjectMenuOpen}
                    isRemoteHost={isRemoteHost}
                    onStartFromScratch={onStartFromScratch}
                    onUseExistingFolder={onOpenFolder}
                    wrapperClassName="flex-1"
                  />
                  <Button
                    className="flex-1 justify-center text-base leading-6 font-medium"
                    color="primary"
                    disabled={!hasSelectedRoots || isLoadingRoots}
                    onClick={onContinue}
                    size="large"
                  >
                    {t("electron.onboarding.workspace.continue")}
                  </Button>
                </div>
                {isRemoteHost ? null : (
                  <SkipWorkspaceButton
                    errorMessage={skipErrorMessage}
                    isPending={isSkipPending}
                    onClick={onSkip}
                    showPlaygroundCopy={showPlaygroundCopy}
                  />
                )}
              </div>
            </div>
          </SelectWorkspaceSection>
        )}
      </div>
    </div>
  );
}

function SelectWorkspaceSection({
  children,
  showIcon,
}: {
  children: ReactNode;
  showIcon: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex w-full max-w-[330px] flex-col items-center gap-6">
      {showIcon ? <PlusIcon aria-hidden="true" className="h-10 w-10 text-token-foreground" /> : null}
      <div className="flex w-full flex-col items-center text-center gap-6">
        <span className="text-center text-heading-lg font-semibold text-token-foreground">
          {t("electron.onboarding.workspace.title")}
        </span>
        <span className="text-center text-lg leading-6 text-token-description-foreground">
          {t("electron.onboarding.workspace.subtitle")}
        </span>
      </div>
      {children}
    </div>
  );
}

function AddProjectButton({
  buttonClassName,
  buttonColor,
  buttonSize,
  forceOpen,
  isRemoteHost,
  onStartFromScratch,
  onUseExistingFolder,
  wrapperClassName = "w-full",
}: {
  buttonClassName?: string;
  buttonColor: "outline" | "primary";
  buttonSize?: "default" | "large";
  forceOpen?: boolean;
  isRemoteHost: boolean;
  onStartFromScratch: () => void;
  onUseExistingFolder: () => void;
  wrapperClassName?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusFirstItemRef = useRef(false);
  const menuId = "workspace-add-project-menu";
  const open = forceOpen ?? isOpen;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !shouldFocusFirstItemRef.current) {
      return;
    }

    shouldFocusFirstItemRef.current = false;
    menuItemRefs.current[0]?.focus();
  }, [open]);

  const closeMenu = () => {
    shouldFocusFirstItemRef.current = false;
    setIsOpen(false);
  };

  if (isRemoteHost) {
    return (
      <Button
        className={buttonClassName}
        color={buttonColor}
        onClick={onUseExistingFolder}
        size={buttonSize}
      >
        {t("electron.onboarding.workspace.openFolder")}
      </Button>
    );
  }

  return (
    <div className={joinClasses("relative", wrapperClassName)} ref={containerRef}>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClassName}
        color={buttonColor}
        data-state={open ? "open" : "closed"}
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          shouldFocusFirstItemRef.current = false;
          setIsOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          triggerRef.current = event.currentTarget;
          if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          shouldFocusFirstItemRef.current = true;
          setIsOpen(true);
        }}
        size={buttonSize}
      >
        {t("electron.onboarding.workspace.openFolder")}
      </Button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+1px)] z-50 m-px flex min-w-[220px] select-none flex-col overflow-y-auto rounded-xl bg-token-dropdown-background/90 px-1 py-1 text-token-foreground ring-token-border shadow-xl-spread ring-[0.5px] backdrop-blur-sm"
          id={menuId}
          role="menu"
        >
          <MenuItem
            icon={<AddIcon className="icon-xs" />}
            itemRef={(node) => {
              menuItemRefs.current[0] = node;
            }}
            label={t("projectSetup.addProjectMenu.startFromScratch")}
            onClick={() => {
              closeMenu();
              onStartFromScratch();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                menuItemRefs.current[1]?.focus();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeMenu();
                triggerRef.current?.focus();
              }
            }}
          />
          <MenuItem
            icon={<FolderIcon className="icon-xs" />}
            itemRef={(node) => {
              menuItemRefs.current[1] = node;
            }}
            label={t("projectSetup.addProjectMenu.useExistingFolder")}
            onClick={() => {
              closeMenu();
              onUseExistingFolder();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                menuItemRefs.current[0]?.focus();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeMenu();
                triggerRef.current?.focus();
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  itemRef,
  label,
  onClick,
  onKeyDown,
}: {
  icon: ReactNode;
  itemRef?: (node: HTMLButtonElement | null) => void;
  label: string;
  onClick: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="no-drag group flex w-full cursor-interaction items-center gap-1.5 rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-left text-sm text-token-foreground outline-hidden hover:bg-token-list-hover-background focus:bg-token-list-hover-background"
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={itemRef}
      role="menuitem"
      type="button"
    >
      <span className="shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function SkipWorkspaceButton({
  errorMessage,
  isPending,
  onClick,
  showPlaygroundCopy,
}: {
  errorMessage: string | null;
  isPending: boolean;
  onClick: () => void;
  showPlaygroundCopy: boolean;
}) {
  const { t } = useI18n();
  const label = isPending
    ? showPlaygroundCopy
      ? t("electron.onboarding.workspace.skipping.playground")
      : t("electron.onboarding.workspace.skipping")
    : showPlaygroundCopy
      ? t("electron.onboarding.workspace.skip.playground")
      : t("electron.onboarding.workspace.skip");

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {errorMessage ? (
        <div className="text-center text-sm text-token-error-foreground">
          {t("electron.onboarding.workspace.skip.error", { message: errorMessage })}
        </div>
      ) : null}
      <Button
        className="w-full justify-center text-base leading-6 font-medium"
        color="ghost"
        disabled={isPending}
        onClick={onClick}
        size="large"
      >
        {label}
      </Button>
    </div>
  );
}

function WorkspaceCheckboxRow({
  checked,
  checkboxId,
  description,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  checkboxId: string;
  description?: string;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="relative flex items-start gap-2" role="listitem">
      <div>
        <input
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          id={checkboxId}
          onChange={(event) => onCheckedChange(event.target.checked)}
          type="checkbox"
        />
        <span
          className={joinClasses(
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-[1px] border-token-border shadow-sm transition-[background-color,border-color,box-shadow]",
            checked && "border-token-foreground bg-token-foreground text-token-dropdown-background",
          )}
        >
          {checked ? <CheckIcon className="h-3 w-3" /> : null}
        </span>
      </div>
      <label className="flex min-w-0 flex-1 items-start gap-2 text-left" htmlFor={checkboxId}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base leading-5 text-token-foreground">{label}</div>
          {description ? (
            <div className="truncate text-xs leading-4 text-token-text-secondary">{description}</div>
          ) : null}
        </div>
      </label>
    </div>
  );
}

function AddIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
