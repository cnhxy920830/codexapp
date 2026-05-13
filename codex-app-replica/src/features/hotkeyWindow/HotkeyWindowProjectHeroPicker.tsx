import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import { getLocalEnvironmentProjectName } from "../../services/localEnvironments";
import {
  clearActiveWorkspaceRoot,
  onActiveWorkspaceRootsUpdated,
  onWorkspaceRootOptionPicked,
  onWorkspaceRootOptionsUpdated,
  pickWorkspaceRootOption,
  readActiveWorkspaceRoots,
  readWorkspaceRootOptions,
  setActiveWorkspaceRoot,
} from "../../services/workspaceRoots";

export function HotkeyWindowProjectHeroPicker({
  initialWorkspaceRoot,
  onSelectedWorkspaceRootChange,
}: {
  initialWorkspaceRoot: string | null;
  onSelectedWorkspaceRootChange: (workspaceRoot: string | null) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [workspaceRootLabels, setWorkspaceRootLabels] = useState<Record<string, string>>({});
  const [selectedWorkspaceRoot, setSelectedWorkspaceRoot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const preferredWorkspaceRoot = normalizeOptionalPath(initialWorkspaceRoot);

  useEffect(() => {
    onSelectedWorkspaceRootChange(selectedWorkspaceRoot);
  }, [onSelectedWorkspaceRootChange, selectedWorkspaceRoot]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceState = async (pickedWorkspaceRoot?: string | null) => {
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

        setWorkspaceRoots(nextWorkspaceRoots);
        setWorkspaceRootLabels(nextLabels);
        setSelectedWorkspaceRoot((current) => {
          return (
            findMatchingWorkspaceRoot(nextWorkspaceRoots, pickedWorkspaceRoot ?? null) ??
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
          setWorkspaceRoots(nextWorkspaceRoots);
          setWorkspaceRootLabels(
            preferredWorkspaceRoot === null
              ? {}
              : {
                  [preferredWorkspaceRoot]:
                    getLocalEnvironmentProjectName(preferredWorkspaceRoot) ?? preferredWorkspaceRoot,
                },
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
    let disposePicked: (() => void) | undefined;

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

    void onWorkspaceRootOptionPicked((notification) => {
      setSelectedWorkspaceRoot(notification.root);
      void setActiveWorkspaceRoot(notification.root).catch(() => undefined);
      void loadWorkspaceState(notification.root);
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      disposePicked = cleanup;
    });

    return () => {
      cancelled = true;
      disposeOptions?.();
      disposeActive?.();
      disposePicked?.();
    };
  }, [preferredWorkspaceRoot]);

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

  const projectOptions = useMemo(() => {
    return workspaceRoots.map((workspaceRoot) => ({
      label: getWorkspaceRootLabel(workspaceRoot, workspaceRootLabels),
      value: workspaceRoot,
    }));
  }, [workspaceRootLabels, workspaceRoots]);

  const selectedProjectLabel =
    selectedWorkspaceRoot === null
      ? t("electron.onboarding.workspace.title")
      : getWorkspaceRootLabel(selectedWorkspaceRoot, workspaceRootLabels);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={t("hotkeyWindow.home.taskMenu.project")}
        onClick={() => setIsOpen((open) => !open)}
        className="group inline-flex max-w-full items-center gap-2 rounded-[18px] px-5 py-3 transition-colors hover:bg-token-foreground/5"
      >
        <span
          className={[
            "heading-xl truncate font-normal",
            selectedWorkspaceRoot === null ? "text-token-foreground/55" : "text-token-foreground",
          ].join(" ")}
        >
          {selectedProjectLabel}
        </span>
        <ChevronDownIcon
          className={[
            "mt-0.5 h-4 w-4 shrink-0 text-token-foreground/60 transition-transform",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+12px)] left-1/2 z-20 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 rounded-[20px] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            <ProjectOptionRow
              description={undefined}
              isSelected={selectedWorkspaceRoot === null}
              label={t("electron.onboarding.workspace.title")}
              onSelect={() => {
                setIsOpen(false);
                setSelectedWorkspaceRoot(null);
                void clearActiveWorkspaceRoot().catch(() => undefined);
              }}
            />

            {isLoading ? (
              <div className="px-3 py-3 text-sm text-token-text-secondary">
                {t("electron.onboarding.workspace.loading")}
              </div>
            ) : projectOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-token-text-secondary">
                {t("electron.onboarding.workspace.empty")}
              </div>
            ) : (
              projectOptions.map((option) => (
                <ProjectOptionRow
                  key={option.value}
                  description={option.value}
                  isSelected={selectedWorkspaceRoot !== null && areSamePath(selectedWorkspaceRoot, option.value)}
                  label={option.label}
                  onSelect={() => {
                    setIsOpen(false);
                    setSelectedWorkspaceRoot(option.value);
                    void setActiveWorkspaceRoot(option.value).catch(() => undefined);
                  }}
                />
              ))
            )}
          </div>

          <div className="mt-2 border-t border-token-border-light px-1 pt-2">
            <button
              type="button"
              className="app-control flex w-full items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-sm"
              onClick={() => {
                setIsOpen(false);
                void pickWorkspaceRootOption().catch(() => undefined);
              }}
            >
              <PlusIcon className="icon-xs" />
              <span>{t("electron.onboarding.workspace.openFolder")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectOptionRow({
  description,
  isSelected,
  label,
  onSelect,
}: {
  description?: string;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-start justify-between gap-3 rounded-[12px] px-3 py-2 text-left",
        isSelected ? "app-nav-item-active" : "app-nav-item-idle",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-token-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block truncate text-[12px] leading-5 text-token-text-secondary">
            {description}
          </span>
        ) : null}
      </span>
      {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
    </button>
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
