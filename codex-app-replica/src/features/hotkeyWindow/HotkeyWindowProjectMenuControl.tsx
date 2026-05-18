import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  SearchIcon,
  WorktreeIcon,
} from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n/i18n";
import { readGitOrigins } from "../../services/gitOrigins";
import { getLocalEnvironmentProjectName } from "../../services/localEnvironments";
import {
  addNewWorkspaceRootOption,
  clearActiveWorkspaceRoot,
  onActiveWorkspaceRootsUpdated,
  onWorkspaceRootOptionsUpdated,
  readActiveWorkspaceRoots,
  readWorkspaceRootOptions,
  setActiveWorkspaceRoot,
} from "../../services/workspaceRoots";
import { isWithinCodexWorktrees } from "../../services/codexHome";

type WorkspaceProjectOption = {
  hasGitRoot: boolean;
  isCodexWorktree: boolean;
  label: string;
  root: string;
};

type HotkeyWindowProjectMenuControlViewProps = {
  containerRef?: RefObject<HTMLDivElement | null>;
  filteredWorkspaceOptions: WorkspaceProjectOption[];
  isLoading: boolean;
  isOpen: boolean;
  query: string;
  selectedOption: WorkspaceProjectOption | null;
  selectedWorkspaceRoot: string | null;
  onAddProject: () => void;
  onClearProject: () => void;
  onQueryChange: (query: string) => void;
  onSelectWorkspaceRoot: (workspaceRoot: string) => void;
  onToggleOpen: () => void;
};

export function HotkeyWindowProjectMenuControl({
  codexHome,
  initialWorkspaceRoot,
  onSelectedWorkspaceRootChange,
}: {
  codexHome: string | null;
  initialWorkspaceRoot: string | null;
  onSelectedWorkspaceRootChange: (workspaceRoot: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceProjectOption[]>([]);
  const [selectedWorkspaceRoot, setSelectedWorkspaceRoot] = useState<string | null>(
    normalizeOptionalPath(initialWorkspaceRoot),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const preferredWorkspaceRoot = normalizeOptionalPath(initialWorkspaceRoot);

  useEffect(() => {
    onSelectedWorkspaceRootChange(selectedWorkspaceRoot);
  }, [onSelectedWorkspaceRootChange, selectedWorkspaceRoot]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceState = async () => {
      setIsLoading(true);
      try {
        const [workspaceRootOptionsResponse, activeWorkspaceRootsResponse] = await Promise.all([
          readWorkspaceRootOptions(),
          readActiveWorkspaceRoots(),
        ]);
        if (cancelled) {
          return;
        }

        const nextWorkspaceRoots = dedupeWorkspaceRoots(
          workspaceRootOptionsResponse.roots,
          activeWorkspaceRootsResponse.roots,
          preferredWorkspaceRoot,
        );
        const nextLabels = {
          ...workspaceRootOptionsResponse.labels,
        };
        if (
          preferredWorkspaceRoot !== null &&
          !hasWorkspaceRootLabel(preferredWorkspaceRoot, nextLabels)
        ) {
          nextLabels[preferredWorkspaceRoot] =
            getLocalEnvironmentProjectName(preferredWorkspaceRoot) ?? preferredWorkspaceRoot;
        }

        const gitOriginsResponse =
          nextWorkspaceRoots.length === 0
            ? { origins: [] as Array<{ dir: string; root: string }> }
            : await readGitOrigins({ dirs: nextWorkspaceRoots }).catch(() => ({ origins: [] as Array<{ dir: string; root: string }> }));
        if (cancelled) {
          return;
        }

        const gitRepoRoots = new Set(
          gitOriginsResponse.origins
            .filter((origin) => typeof origin.root === "string" && origin.root.trim().length > 0)
            .map((origin) => normalizeComparablePath(origin.dir)),
        );

        setWorkspaceOptions(
          nextWorkspaceRoots.map((root) => ({
            hasGitRoot: gitRepoRoots.has(normalizeComparablePath(root)),
            isCodexWorktree: isWithinCodexWorktrees(root, codexHome),
            label: getWorkspaceRootLabel(root, nextLabels),
            root,
          })),
        );
        setSelectedWorkspaceRoot((current) => {
          return (
            findMatchingWorkspaceRoot(nextWorkspaceRoots, current) ??
            findMatchingWorkspaceRoot(nextWorkspaceRoots, preferredWorkspaceRoot) ??
            findMatchingWorkspaceRoot(nextWorkspaceRoots, activeWorkspaceRootsResponse.roots[0] ?? null) ??
            null
          );
        });
      } catch {
        if (!cancelled) {
          const nextWorkspaceRoots =
            preferredWorkspaceRoot === null ? [] : [preferredWorkspaceRoot];
          setWorkspaceOptions(
            nextWorkspaceRoots.map((root) => ({
              hasGitRoot: false,
              isCodexWorktree: isWithinCodexWorktrees(root, codexHome),
              label: getLocalEnvironmentProjectName(root) ?? root,
              root,
            })),
          );
          setSelectedWorkspaceRoot(preferredWorkspaceRoot);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadWorkspaceState();

    let disposeOptions: (() => void) | undefined;
    let disposeActive: (() => void) | undefined;

    void onWorkspaceRootOptionsUpdated(() => {
      void loadWorkspaceState();
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      disposeOptions = cleanup;
    });

    void onActiveWorkspaceRootsUpdated(() => {
      void loadWorkspaceState();
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      disposeActive = cleanup;
    });

    return () => {
      cancelled = true;
      disposeOptions?.();
      disposeActive?.();
    };
  }, [codexHome, preferredWorkspaceRoot]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
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
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredWorkspaceOptions = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return workspaceOptions;
    }
    return workspaceOptions.filter((option) => {
      return [option.label, option.root].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [normalizedQuery, workspaceOptions]);

  const selectedOption =
    selectedWorkspaceRoot === null
      ? null
      : workspaceOptions.find((option) => areSamePath(option.root, selectedWorkspaceRoot)) ?? null;

  return (
    <HotkeyWindowProjectMenuControlView
      containerRef={containerRef}
      filteredWorkspaceOptions={filteredWorkspaceOptions}
      isLoading={isLoading}
      isOpen={isOpen}
      query={query}
      selectedOption={selectedOption}
      selectedWorkspaceRoot={selectedWorkspaceRoot}
      onAddProject={() => {
        setIsOpen(false);
        void addNewWorkspaceRootOption().catch(() => undefined);
      }}
      onClearProject={() => {
        setIsOpen(false);
        setSelectedWorkspaceRoot(null);
        void clearActiveWorkspaceRoot().catch(() => undefined);
      }}
      onQueryChange={setQuery}
      onSelectWorkspaceRoot={(workspaceRoot) => {
        setIsOpen(false);
        setSelectedWorkspaceRoot(workspaceRoot);
        void setActiveWorkspaceRoot(workspaceRoot).catch(() => undefined);
      }}
      onToggleOpen={() => setIsOpen((open) => !open)}
    />
  );
}

export function HotkeyWindowProjectMenuControlView({
  containerRef,
  filteredWorkspaceOptions,
  isLoading,
  isOpen,
  query,
  selectedOption,
  selectedWorkspaceRoot,
  onAddProject,
  onClearProject,
  onQueryChange,
  onSelectWorkspaceRoot,
  onToggleOpen,
}: HotkeyWindowProjectMenuControlViewProps) {
  const { t } = useI18n();
  const menuId = "hotkey-window-project-menu";

  const triggerLabel =
    selectedOption?.label ??
    (selectedWorkspaceRoot === null
      ? t("composer.localCwdDropdown.newChat")
      : t("composer.localCwdDropdown.noActiveRoot"));

  return (
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <Button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-label={t("composer.localCwdDropdown.tooltip")}
        aria-haspopup="menu"
        className="max-w-full gap-2"
        color="ghost"
        data-state={isOpen ? "open" : "closed"}
        size="composerSm"
        title={t("composer.localCwdDropdown.tooltip")}
        onClick={onToggleOpen}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {selectedOption === null ? (
              <WorkspaceProjectAddIcon className="icon-xs shrink-0" />
            ) : selectedOption.isCodexWorktree ? (
              <WorktreeIcon className="icon-xs shrink-0" />
            ) : selectedOption.hasGitRoot ? (
              <WorkspaceProjectGitIcon className="icon-xs shrink-0" />
            ) : (
              <WorkspaceProjectFolderIcon className="icon-xs shrink-0" />
            )}
          </span>
          <span className="min-w-0 max-w-40 truncate text-sm leading-[18px]">
            {triggerLabel}
          </span>
        </span>
        <ChevronDownIcon className="icon-2xs shrink-0 text-token-input-placeholder-foreground" />
      </Button>

      {isOpen ? (
        <div
          className="app-card absolute right-0 bottom-[calc(100%+8px)] z-30 w-[288px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
          id={menuId}
        >
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-token-text-secondary" />
              <input
                aria-label={t("composer.localCwdDropdown.searchPlaceholder")}
                autoFocus
                className="app-control app-text-input w-full rounded-[10px] py-2 pr-3 pl-9 text-[13px] outline-none"
                placeholder={t("composer.localCwdDropdown.searchPlaceholder")}
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>

            <div className="vertical-scroll-fade-mask max-h-[232px] overflow-y-auto [--edge-fade-distance:1.5rem]">
              {filteredWorkspaceOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-token-text-secondary">
                  {isLoading
                    ? t("electron.onboarding.workspace.loading")
                    : t("composer.localCwdDropdown.noResults")}
                </div>
              ) : (
                filteredWorkspaceOptions.map((option) => {
                  const isSelected =
                    selectedWorkspaceRoot !== null &&
                    areSamePath(selectedWorkspaceRoot, option.root);
                  return (
                    <button
                      key={option.root}
                      type="button"
                      className={[
                        "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                        isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                      ].join(" ")}
                      title={option.root}
                      onClick={() => onSelectWorkspaceRoot(option.root)}
                    >
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                          {option.isCodexWorktree ? (
                            <WorktreeIcon className="icon-xs shrink-0" />
                          ) : option.hasGitRoot ? (
                            <WorkspaceProjectGitIcon className="icon-xs shrink-0" />
                          ) : (
                            <WorkspaceProjectFolderIcon className="icon-xs shrink-0" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{option.label}</span>
                          <span className="mt-1 block truncate text-[12px] leading-5 text-token-text-secondary">
                            {option.root}
                          </span>
                        </span>
                      </span>
                      {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-token-border-light pt-2">
              <button
                type="button"
                className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
                onClick={onClearProject}
              >
                <WorkspaceProjectClearIcon className="h-4 w-4 shrink-0 text-token-text-secondary" />
                <span>{t("composer.localCwdDropdown.clearProject")}</span>
              </button>
              <button
                type="button"
                className="app-nav-item-idle mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
                onClick={onAddProject}
              >
                <WorkspaceProjectAddIcon className="h-4 w-4 shrink-0 text-token-text-secondary" />
                <span>{t("composer.localCwdDropdown.addWorkspaceRoot")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getWorkspaceRootLabel(workspaceRoot: string, labels: Record<string, string>) {
  const matchingLabelEntry = Object.entries(labels).find(([root]) => areSamePath(root, workspaceRoot));
  const label = matchingLabelEntry?.[1]?.trim();
  if (label && label.length > 0) {
    return label;
  }
  return getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot;
}

function hasWorkspaceRootLabel(workspaceRoot: string, labels: Record<string, string>) {
  return Object.keys(labels).some((root) => areSamePath(root, workspaceRoot));
}

function dedupeWorkspaceRoots(...groups: Array<Array<string> | string | null>) {
  const deduped: string[] = [];
  for (const group of groups) {
    if (Array.isArray(group)) {
      for (const item of group) {
        const normalized = normalizeOptionalPath(item);
        if (normalized && !deduped.some((existing) => areSamePath(existing, normalized))) {
          deduped.push(normalized);
        }
      }
      continue;
    }

    const normalized = normalizeOptionalPath(group);
    if (normalized && !deduped.some((existing) => areSamePath(existing, normalized))) {
      deduped.push(normalized);
    }
  }
  return deduped;
}

function findMatchingWorkspaceRoot(workspaceRoots: string[], candidate: string | null) {
  if (candidate === null) {
    return null;
  }
  return workspaceRoots.find((workspaceRoot) => areSamePath(workspaceRoot, candidate)) ?? null;
}

function normalizeOptionalPath(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeComparablePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function areSamePath(left: string, right: string) {
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function WorkspaceProjectAddIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.2041 17.5V15.665H13.3691C13.0019 15.665 12.7041 15.3673 12.7041 15C12.7041 14.6327 13.0019 14.335 13.3691 14.335H15.2041V12.5C15.2041 12.1327 15.5019 11.835 15.8691 11.835C16.2362 11.8352 16.5332 12.1329 16.5332 12.5V14.335H18.3691C18.7362 14.3352 19.0332 14.6329 19.0332 15C19.0332 15.3671 18.7362 15.6648 18.3691 15.665H16.5332V17.5C16.5332 17.8671 16.2362 18.1648 15.8691 18.165C15.5019 18.165 15.2041 17.8673 15.2041 17.5ZM2.12012 12.7002V7.29981C2.12012 6.64581 2.11922 6.1149 2.1543 5.68555C2.19002 5.24867 2.26619 4.85832 2.45117 4.49512L2.56836 4.28516C2.86045 3.80898 3.27979 3.42103 3.78028 3.16602L3.91797 3.10156C4.24192 2.96268 4.5885 2.90039 4.97071 2.86914C5.40006 2.83406 5.93096 2.83496 6.58496 2.83496H7.28028C7.42346 2.83496 7.52305 2.83479 7.6211 2.84082L7.875 2.86719C8.46133 2.95309 9.01189 3.20874 9.45703 3.60547L9.70215 3.84473C9.81425 3.95779 9.85105 3.99455 9.88672 4.02637L9.99805 4.11719C10.2646 4.31741 10.5851 4.43638 10.9199 4.45703L11.1797 4.45996H13.6914C14.2499 4.45996 14.703 4.45958 15.0713 4.48535C15.4458 4.51157 15.7828 4.56683 16.1025 4.70313L16.3662 4.83106C16.9638 5.15706 17.4378 5.67623 17.707 6.30762L17.7939 6.54981C17.868 6.79538 17.904 7.05317 17.9238 7.33203C17.9498 7.69789 17.9502 8.14747 17.9502 8.7002C17.9501 8.87631 17.8803 9.0453 17.7559 9.16992C17.6311 9.29464 17.4615 9.36524 17.2852 9.36524H3.4502V12.7002C3.4502 13.3761 3.45084 13.8434 3.48047 14.2061C3.50947 14.5608 3.56304 14.7568 3.63672 14.9014L3.70215 15.0195C3.86642 15.2873 4.10236 15.505 4.38379 15.6484L4.50391 15.7002C4.63661 15.7476 4.81329 15.783 5.0791 15.8047C5.44174 15.8343 5.90903 15.835 6.58496 15.835H9.40918L9.54395 15.8486C9.84681 15.9108 10.0742 16.1788 10.0742 16.5C10.0742 16.8212 9.84681 17.0892 9.54395 17.1514L9.40918 17.165H6.58496C5.93096 17.165 5.40006 17.1659 4.97071 17.1309C4.5885 17.0996 4.24192 17.0373 3.91797 16.8984L3.78028 16.834C3.27979 16.579 2.86045 16.191 2.56836 15.7148L2.45117 15.5049C2.26619 15.1417 2.19002 14.7513 2.1543 14.3145C2.11922 13.8851 2.12012 13.3542 2.12012 12.7002ZM3.4502 8.03516H16.6172C16.6146 7.79548 16.6098 7.59777 16.5977 7.42676C16.5816 7.20054 16.5552 7.04845 16.5205 6.9336L16.4834 6.8291C16.332 6.47411 16.0655 6.1824 15.7295 5.99903L15.5811 5.92676C15.4545 5.8728 15.2835 5.83385 14.9785 5.8125C14.6674 5.79073 14.2686 5.79004 13.6914 5.79004H11.1797L10.8379 5.78418C10.2426 5.74746 9.67313 5.53663 9.19922 5.18067L9.00196 5.01953C8.92848 4.95403 8.85889 4.88222 8.75781 4.78028L8.57227 4.59863C8.32169 4.37525 8.01175 4.23086 7.68164 4.18262L7.54004 4.16797C7.49225 4.16502 7.43987 4.16504 7.28028 4.16504H6.58496C5.90903 4.16504 5.44174 4.16569 5.0791 4.19531C4.81329 4.21705 4.63661 4.25237 4.50391 4.29981L4.38379 4.35156C4.10236 4.49499 3.86642 4.71271 3.70215 4.98047L3.63672 5.09863C3.56304 5.24324 3.50947 5.43924 3.48047 5.79395C3.45084 6.15659 3.4502 6.62388 3.4502 7.29981V8.03516Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WorkspaceProjectGitIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.3812 8.27413V4.75577C1.3812 4.32969 1.38061 3.98381 1.40346 3.70408C1.42674 3.41945 1.47636 3.16514 1.59688 2.92852L1.67323 2.79173C1.86352 2.4815 2.13672 2.22875 2.46279 2.06261L2.5525 2.02062C2.76355 1.93013 2.98935 1.88955 3.23835 1.86919C3.51808 1.84634 3.86396 1.84693 4.29004 1.84693H4.74304C4.83633 1.84692 4.90121 1.84681 4.96508 1.85074L5.1305 1.86792C5.51249 1.92388 5.87119 2.09044 6.1612 2.34891L6.32089 2.50479C6.39392 2.57845 6.4179 2.6024 6.44114 2.62313L6.51367 2.6823C6.68734 2.81274 6.89613 2.89025 7.11427 2.9037L7.28351 2.90561H8.91989C9.28374 2.90561 9.57891 2.90537 9.81889 2.92215C10.0629 2.93924 10.2824 2.97524 10.4907 3.06403L10.6625 3.14738C11.0519 3.35977 11.3607 3.69801 11.5361 4.10936L11.5927 4.26715C11.6409 4.42714 11.6644 4.59509 11.6773 4.77677C11.6942 5.01512 11.6945 5.30802 11.6945 5.66813C11.6945 5.78286 11.6489 5.89296 11.5679 5.97415C11.4866 6.0554 11.3761 6.1014 11.2612 6.1014H2.24774V8.27413C2.24774 8.71449 2.24816 9.01893 2.26747 9.25519C2.28636 9.48629 2.32126 9.61398 2.36926 9.70819L2.41189 9.7851C2.51713 9.95654 2.66844 10.0964 2.84989 10.1888L2.92798 10.2222C3.01462 10.2532 3.12913 10.2759 3.2998 10.2898C3.53292 10.3088 3.83331 10.3094 4.26709 10.3094H5.72998C5.96513 10.3095 6.17705 10.4977 6.17725 10.7427C6.17725 10.9878 5.96518 11.1763 5.72998 11.1765H4.26709C3.84666 11.1765 3.50552 11.177 3.22955 11.1545C2.9831 11.1344 2.76144 11.0907 2.55598 11.0027L2.44971 10.9539C2.13987 10.7959 1.88048 10.5562 1.6991 10.2607L1.61499 10.1092C1.50047 9.88426 1.45317 9.6419 1.42853 9.34003C1.40435 9.04415 1.40466 8.67786 1.40466 8.22516V8.22414C1.38158 8.2133 1.3812 8.19754 1.3812 8.27413ZM2.24774 5.23421H10.8198C10.8169 5.08806 10.8126 4.9655 10.8057 4.86857C10.7936 4.69787 10.7766 4.58283 10.7505 4.49638L10.7225 4.41772C10.6085 4.1504 10.4078 3.93062 10.1544 3.79237L10.0425 3.73834C9.94704 3.69763 9.81803 3.66823 9.58785 3.65213C9.35301 3.63569 9.05205 3.63517 8.61918 3.63516H7.28351L7.03796 3.6313C6.6125 3.60451 6.20518 3.45453 5.86621 3.1991L5.72559 3.08289C5.67314 3.0361 5.62296 2.98517 5.54968 2.91116L5.41492 2.77981C5.23042 2.61513 5.00174 2.50884 4.75879 2.47327L4.65442 2.46201C4.61898 2.45982 4.58033 2.45996 4.4657 2.45996H4.29004C3.85626 2.45996 3.55588 2.46058 3.32275 2.47958C3.15208 2.4935 3.03758 2.51614 2.95093 2.54721L2.87286 2.58063C2.69144 2.67303 2.54016 2.81287 2.43492 2.98431L2.39227 3.06122C2.34426 3.15544 2.30937 3.28313 2.29047 3.51423C2.27116 3.75048 2.27074 4.05492 2.27074 4.49529V5.23421H2.24774Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WorkspaceProjectFolderIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M6.584 2.874a3.01 3.01 0 0 1 1.816.757c.073.064.142.135.243.237.112.113.15.15.187.183.292.26.663.415 1.053.44.049.002.102.002.261.002h2.718c.56 0 1.015 0 1.386.027.377.027.714.086 1.034.226.608.267 1.11.727 1.43 1.31.168.307.256.637.316 1.01.03.181.054.383.077.609h.371a1.915 1.915 0 0 1 1.832 2.475l-1.645 5.367a2.331 2.331 0 0 1-2.229 1.648H4.754c-.61 0-1.15-.23-1.559-.6a3.006 3.006 0 0 1-.847-.933c-.191-.33-.287-.687-.351-1.093-.063-.398-.1-.89-.147-1.499l-.418-5.435c-.052-.683-.096-1.235-.093-1.681.002-.453.05-.858.214-1.237a3.008 3.008 0 0 1 1.365-1.475c.366-.192.766-.27 1.218-.308.444-.036.997-.036 1.682-.036h.427c.144 0 .242 0 .339.006Zm-.66 6.13a.586.586 0 0 0-.559.415l-1.57 5.121a1.002 1.002 0 0 0 .589 1.224c.109.03.244.055.422.071h10.628c.44 0 .828-.288.957-.708l1.645-5.366a.585.585 0 0 0-.56-.756H5.925Zm-.106-4.872c-.706 0-1.198 0-1.579.032-.374.03-.582.087-.734.167a1.744 1.744 0 0 0-.791.855c-.068.157-.11.369-.112.745-.002.382.036.873.09 1.578l.374 4.87 1.028-3.35a1.916 1.916 0 0 1 1.83-1.354h9.909a8.189 8.189 0 0 0-.052-.62c-.043-.271-.098-.405-.171-.538a1.742 1.742 0 0 0-.826-.757c-.14-.062-.292-.106-.593-.128-.307-.022-.7-.023-1.272-.023H10.144c-.085 0-.152 0-.212-.002a3.018 3.018 0 0 1-1.846-.77 3.738 3.738 0 0 1-.197-.191c-.092-.094-.114-.116-.136-.135a1.681 1.681 0 0 0-.998-.42 3.685 3.685 0 0 0-.17-.004h-.767Z" />
    </svg>
  );
}

function WorkspaceProjectClearIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.68457 2.66846C7.38445 2.66846 7.93651 2.78675 8.40527 2.97803C8.86652 3.16626 9.22191 3.41587 9.51562 3.62646C10.0869 4.03605 10.4781 4.33551 11.334 4.33545H14.9736C16.7177 4.33545 18.126 5.75581 18.126 7.50049V8.78271C18.1259 9.33955 17.6573 9.83039 17.0791 9.83057H3.20605V14.1655C3.20605 15.1822 4.02453 16.0004 5.02734 16.0005H9.83887C10.2059 16.0007 10.5039 16.2984 10.5039 16.6655C10.5039 17.0327 10.2059 17.3303 9.83887 17.3306H5.02734C3.28341 17.3304 1.87598 15.9101 1.87598 14.1655V9.17432C1.87594 9.17152 1.875 9.16833 1.875 9.16553C1.875 9.16226 1.87593 9.15902 1.87598 9.15576V5.8335C1.87598 4.08889 3.28341 2.66858 5.02734 2.66846H6.68457ZM5.02734 3.99854C4.02453 3.99866 3.20605 4.81683 3.20605 5.8335V8.50049H16.7959V7.50049C16.7959 6.48375 15.9766 5.66455 14.9736 5.66455H11.334C10.0235 5.66465 9.33097 5.13107 8.74023 4.70752C8.45288 4.50149 8.20685 4.33372 7.90234 4.20947C7.60531 4.0883 7.22568 3.99854 6.68457 3.99854H5.02734Z"
        fill="currentColor"
      />
      <path
        d="M17.5644 12.195C17.8241 11.9354 18.2452 11.9353 18.5048 12.195C18.7643 12.4546 18.7643 12.8757 18.5048 13.1354L16.79 14.8493L18.5048 16.5641C18.7642 16.8238 18.7644 17.2449 18.5048 17.5045C18.2452 17.7639 17.8241 17.7638 17.5644 17.5045L15.8496 15.7897L14.1357 17.5045C13.876 17.7639 13.4549 17.7639 13.1953 17.5045C12.9357 17.2449 12.9357 16.8237 13.1953 16.5641L14.9101 14.8493L13.1953 13.1354C12.9357 12.8757 12.9357 12.4546 13.1953 12.195C13.4549 11.9353 13.876 11.9354 14.1357 12.195L15.8496 13.9098L17.5644 12.195Z"
        fill="currentColor"
      />
    </svg>
  );
}
