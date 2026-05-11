import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "../../components/Button";
import { CheckIcon, ChevronDownIcon, FolderIcon, PlusIcon } from "../../components/AppShellIcons";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";

export type WorkspaceRootOptionView = {
  root: string;
  label: string;
};

export type SelectWorkspacePageViewProps = {
  hasAvailableRoots: boolean;
  isEmptyState: boolean;
  isLoading: boolean;
  isSelectAllChecked: boolean;
  isSelectAllIndeterminate: boolean;
  isSkipPending: boolean;
  selectedRootCount: number;
  selectedRoots: Record<string, boolean>;
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
  hasAvailableRoots,
  isEmptyState,
  isLoading,
  isSelectAllChecked,
  isSelectAllIndeterminate,
  isSkipPending,
  selectedRootCount,
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
  const selectAllInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllInputRef.current) {
      selectAllInputRef.current.indeterminate = isSelectAllIndeterminate;
    }
  }, [isSelectAllIndeterminate]);

  return (
    <main className="flex h-full w-full items-center justify-center overflow-auto bg-[var(--app-shell-main-surface)] text-[var(--app-shell-text)]">
      <div className="flex w-full max-w-3xl flex-col items-center justify-start px-4 py-8">
        <SelectWorkspaceCard showIcon={isEmptyState}>
          {isEmptyState ? (
            <div className="flex w-full flex-col gap-3">
              <AddProjectButton
                color={showPlaygroundCopy ? "outline" : "primary"}
                onStartFromScratch={onStartFromScratch}
                onUseExistingFolder={onOpenFolder}
                triggerClassName="w-full justify-center py-2.5"
              />
              <SkipWorkspaceButton
                errorMessage={skipErrorMessage}
                isPending={isSkipPending}
                onClick={onSkip}
                showPlaygroundCopy={showPlaygroundCopy}
                t={t}
              />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-2">
                {isLoading ? (
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
                      "flex w-full flex-col overflow-hidden rounded-2xl border border-token-border bg-token-surface-primary",
                      isLoading && "pointer-events-none opacity-50",
                    )}
                  >
                    <WorkspaceCheckboxRow
                      id="workspace-root-select-all"
                      checked={isSelectAllChecked}
                      disabled={isLoading}
                      inputRef={selectAllInputRef}
                      label={t("electron.onboarding.workspace.selectAll")}
                      onCheckedChange={onToggleSelectAll}
                    />
                    {visibleWorkspaceRootOptions.map((option, index) => (
                      <WorkspaceCheckboxRow
                        key={option.root}
                        checked={selectedRoots[option.root] === true}
                        description={option.root}
                        disabled={isLoading}
                        id={`workspace-root-${index}`}
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
                <div className="flex w-full items-center gap-4 max-sm:flex-col">
                  <AddProjectButton
                    color="outline"
                    onStartFromScratch={onStartFromScratch}
                    onUseExistingFolder={onOpenFolder}
                    triggerClassName="flex-1 justify-center text-base leading-6 font-medium"
                  />
                  <Button
                    className="flex-1 justify-center text-base leading-6 font-medium"
                    color="primary"
                    disabled={selectedRootCount === 0 || isLoading}
                    onClick={onContinue}
                    size="large"
                  >
                    {t("electron.onboarding.workspace.continue")}
                  </Button>
                </div>
                <SkipWorkspaceButton
                  errorMessage={skipErrorMessage}
                  isPending={isSkipPending}
                  onClick={onSkip}
                  showPlaygroundCopy={showPlaygroundCopy}
                  t={t}
                />
              </div>
            </div>
          )}
        </SelectWorkspaceCard>
      </div>
    </main>
  );
}

function SelectWorkspaceCard({
  children,
  showIcon,
}: {
  children: ReactNode;
  showIcon: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex w-full max-w-[330px] flex-col items-center rounded-[28px] border border-token-border bg-token-main-surface-primary px-6 py-7 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
      {showIcon ? (
        <div
          aria-hidden="true"
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-token-foreground/5 text-token-foreground"
        >
          <FolderIcon className="h-5 w-5" />
        </div>
      ) : null}
      <h1 className="text-center text-[28px] leading-[34px] font-normal text-token-foreground">
        {t("electron.onboarding.workspace.title")}
      </h1>
      <p className="mt-2 text-center text-[16px] leading-6 text-token-description-foreground">
        {t("electron.onboarding.workspace.subtitle")}
      </p>
      <div className="mt-6 flex w-full flex-col">{children}</div>
    </div>
  );
}

function AddProjectButton({
  color,
  onStartFromScratch,
  onUseExistingFolder,
  triggerClassName,
}: {
  color: "outline" | "primary";
  onStartFromScratch: () => void;
  onUseExistingFolder: () => void;
  triggerClassName?: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={joinClasses("w-full justify-center gap-2", triggerClassName)}
        color={color}
        onClick={() => setIsOpen((current) => !current)}
        size="large"
      >
        {t("electron.onboarding.workspace.openFolder")}
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </Button>
      {isOpen ? (
        <div
          role="menu"
          className="absolute left-0 right-0 z-10 mt-2 overflow-hidden rounded-2xl border border-token-border bg-token-main-surface-primary p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]"
        >
          <MenuItem
            icon={<PlusIcon className="h-4 w-4" />}
            label={t("projectSetup.addProjectMenu.startFromScratch")}
            onClick={() => {
              setIsOpen(false);
              onStartFromScratch();
            }}
          />
          <MenuItem
            icon={<FolderIcon className="h-4 w-4" />}
            label={t("projectSetup.addProjectMenu.useExistingFolder")}
            onClick={() => {
              setIsOpen(false);
              onUseExistingFolder();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-token-foreground enabled:hover:bg-token-list-hover-background"
      onClick={onClick}
    >
      <span className="shrink-0 text-token-description-foreground">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function SkipWorkspaceButton({
  errorMessage,
  isPending,
  onClick,
  showPlaygroundCopy,
  t,
}: {
  errorMessage: string | null;
  isPending: boolean;
  onClick: () => void;
  showPlaygroundCopy: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
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
  description,
  disabled,
  id,
  inputRef,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description?: string;
  disabled: boolean;
  id: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={joinClasses(
        "flex cursor-pointer items-start gap-3 border-t border-token-border px-4 py-3 first:border-t-0",
        disabled && "cursor-not-allowed opacity-60",
      )}
      htmlFor={id}
    >
      <span className="relative mt-0.5">
        <input
          ref={inputRef}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          id={id}
          onChange={(event) => onCheckedChange(event.target.checked)}
          type="checkbox"
        />
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-token-border bg-token-main-surface-primary peer-checked:border-token-foreground peer-checked:bg-token-foreground">
          {checked ? <CheckIcon className="h-3.5 w-3.5 text-token-main-surface-primary" /> : null}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-token-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block truncate text-sm text-token-description-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
