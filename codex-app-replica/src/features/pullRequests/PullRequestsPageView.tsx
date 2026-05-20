import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { CheckIcon, ChevronDownIcon, CopyPathIcon } from "../../components/AppShellIcons";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type { PullRequestBoardItem, PullRequestFilterView } from "../../services/pullRequests";
import { SectionedPage, SectionedPageSection } from "../automations/SectionedPage";
import { PullRequestStateColorClass, PullRequestStateIcon } from "./PullRequestIcons";
import {
  isPullRequestColumnCollapsedByDefault,
  type PullRequestBoardSection,
  type PullRequestRepoOption,
} from "./pullRequestsPageModel";

type PullRequestsPageViewProps = {
  boardItems: PullRequestBoardItem[];
  boardLoading: boolean;
  boardSections: PullRequestBoardSection[];
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
  onSelectFilterView: (view: PullRequestFilterView) => void;
  pageError: string | null;
  pageErrorDetail: string | null;
  selectedBoardItem: PullRequestBoardItem | null;
  selectedRepoKey: string | null;
  selectedView: PullRequestFilterView;
};

type ContextMenuState = {
  item: PullRequestBoardItem;
  x: number;
  y: number;
} | null;

type RepoMenuOption = {
  key: string;
  label: string;
};

export function PullRequestsPageView({
  boardItems,
  boardLoading,
  boardSections,
  onCopyPullRequestUrl,
  onMergePullRequest,
  onOpenPullRequestInBrowser,
  onSelectBoardItem,
  onSelectFilterView,
  pageError,
  pageErrorDetail,
  selectedBoardItem,
  selectedRepoKey,
  selectedView,
}: PullRequestsPageViewProps) {
  const { t } = useI18n();
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldShowLoading = boardLoading && boardItems.length === 0;

  useEffect(() => {
    if (contextMenuState == null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenuState(null);
    };

    const handleContextMenu = (event: globalThis.MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenuState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
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
  }, [contextMenuState]);

  const sections = useMemo(
    () =>
      boardSections.map((section) => ({
        id: getSectionDomId(section.key),
        title: t(section.title as MessageKey),
      })),
    [boardSections, t],
  );

  let boardContent: ReactNode;
  if (pageError) {
    boardContent = (
      <PullRequestsCenteredEmptyState
        description={t("pullRequestsPage.error.description")}
        detail={pageErrorDetail}
        title={t("pullRequestsPage.error.title")}
      />
    );
  } else if (shouldShowLoading) {
    boardContent = <PullRequestsBoardLoadingState />;
  } else if (boardItems.length === 0) {
    boardContent = (
      <PullRequestsCenteredEmptyState
        description={getEmptyDescription(selectedRepoKey === "all", selectedView, t)}
        title={t("pullRequestsPage.empty.noPullRequests.title")}
      />
    );
  } else {
    boardContent = boardSections.map((section) => (
      <PullRequestBoardSectionView
        key={section.key}
        section={section}
        isSelectedRepoAll={selectedRepoKey === "all"}
        onContextMenu={(item, event) => {
          event.preventDefault();
          setContextMenuState({
            item,
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onMergePullRequest={onMergePullRequest}
        onSelectBoardItem={onSelectBoardItem}
        selectedBoardItem={selectedBoardItem}
      />
    ));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionedPage
        ariaLabel={t("pullRequestsPage.sectionsNav")}
        className="[--sectioned-page-leading-inset:0.75rem]"
        contentInnerClassName="flex flex-col gap-8 px-panel pb-panel"
        header={
          <PullRequestFilterToggle
            selectedView={selectedView}
            onSelectView={onSelectFilterView}
          />
        }
        sections={sections}
        showNav={false}
      >
        {boardContent}
      </SectionedPage>

      {contextMenuState ? (
        <PullRequestContextMenu
          item={contextMenuState.item}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          onClose={() => setContextMenuState(null)}
          onCopyPullRequestUrl={onCopyPullRequestUrl}
          onOpenPullRequestInBrowser={onOpenPullRequestInBrowser}
          menuRef={contextMenuRef}
        />
      ) : null}
    </div>
  );
}

function PullRequestFilterToggle({
  onSelectView,
  selectedView,
}: {
  onSelectView: (view: PullRequestFilterView) => void;
  selectedView: PullRequestFilterView;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center">
      <div
        aria-label={t("pullRequestsPage.filter.ariaLabel")}
        className="inline-flex items-center gap-0.5"
        role="group"
      >
        <Button
          aria-label={t("pullRequestsPage.filter.ariaLabel")}
          aria-pressed={selectedView === "authored"}
          color={selectedView === "authored" ? "secondary" : "ghost"}
          size="toolbar"
          onClick={() => onSelectView("authored")}
        >
          {t("pullRequestsPage.filter.authored")}
        </Button>
        <Button
          aria-pressed={selectedView === "review"}
          color={selectedView === "review" ? "secondary" : "ghost"}
          size="toolbar"
          onClick={() => onSelectView("review")}
        >
          {t("pullRequestsPage.filter.review")}
        </Button>
      </div>
    </div>
  );
}

function PullRequestBoardSectionView({
  isSelectedRepoAll,
  onContextMenu,
  onMergePullRequest,
  onSelectBoardItem,
  section,
  selectedBoardItem,
}: {
  isSelectedRepoAll: boolean;
  onContextMenu: (item: PullRequestBoardItem, event: MouseEvent<HTMLDivElement>) => void;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
  section: PullRequestBoardSection;
  selectedBoardItem: PullRequestBoardItem | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(isPullRequestColumnCollapsedByDefault(section.key));
  const { t } = useI18n();
  const sectionId = getSectionDomId(section.key);

  useEffect(() => {
    setIsCollapsed(isPullRequestColumnCollapsedByDefault(section.key));
  }, [section.key]);

  const title = (
    <button
      type="button"
      aria-expanded={!isCollapsed}
      aria-controls={`${sectionId}-items`}
      onClick={() => setIsCollapsed((value) => !value)}
      className="flex cursor-interaction items-center gap-2 text-left"
    >
      <ChevronDownIcon
        className={[
          "icon-2xs shrink-0 transition-transform",
          isCollapsed ? "-rotate-90" : "",
        ].join(" ")}
      />
      <span>{t(section.title as MessageKey)}</span>
    </button>
  );

  return (
    <SectionedPageSection id={sectionId} showDivider title={title}>
      {isCollapsed ? null : (
        <div id={`${sectionId}-items`} role="list" className="flex flex-col gap-1">
          {section.items.map((item) => (
            <div key={`${section.key}-${item.url}`} role="listitem">
              <SelectablePullRequestRow
                item={item}
                isSelected={selectedBoardItem?.url === item.url}
                isSelectedRepoAll={isSelectedRepoAll}
                onContextMenu={onContextMenu}
                onMergePullRequest={onMergePullRequest}
                onSelectBoardItem={onSelectBoardItem}
              />
            </div>
          ))}
        </div>
      )}
    </SectionedPageSection>
  );
}

function SelectablePullRequestRow({
  isSelected,
  isSelectedRepoAll,
  item,
  onContextMenu,
  onMergePullRequest,
  onSelectBoardItem,
}: {
  isSelected: boolean;
  isSelectedRepoAll: boolean;
  item: PullRequestBoardItem;
  onContextMenu: (item: PullRequestBoardItem, event: MouseEvent<HTMLDivElement>) => void;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
}) {
  const { t } = useI18n();
  const canShowMergeButton = item.isAuthor && item.state === "ready";
  const rowProps = useSelectableRow(() => onSelectBoardItem(item));

  return (
    <div
      aria-label={item.title}
      className={[
        "group min-h-10 w-full rounded-lg px-3 py-3 text-base cursor-interaction text-left",
        isSelected
          ? "bg-token-list-active-selection-background"
          : "hover:bg-token-list-active-selection-background",
      ].join(" ")}
      onContextMenu={(event) => onContextMenu(item, event)}
      {...rowProps}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex min-h-6 shrink-0 items-center">
          <PullRequestStateIcon
            className={["icon-sm shrink-0 translate-y-[2px]", PullRequestStateColorClass(item.state)].join(" ")}
            state={item.state}
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-baseline gap-3">
            <div className="flex min-w-0 flex-1 items-baseline gap-2 text-base leading-6">
              <span className="min-w-0 truncate text-token-foreground">{item.title}</span>
              <span className="max-w-48 shrink-0 truncate text-token-description-foreground">
                {t("pullRequestsPage.card.pullRequestNumber", { number: item.number })}
              </span>
            </div>
            <div className="flex min-h-6 shrink-0 items-center text-base text-token-description-foreground">
              +{item.additions} / -{item.deletions}
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-3 text-sm leading-[22px] text-token-description-foreground">
            <div className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1 truncate">
                {isSelectedRepoAll && item.repo ? (
                  <>
                    <span className="truncate">{item.repo}</span>
                    <DotDivider />
                  </>
                ) : null}
                <span className="truncate">
                  {t("pullRequestsPage.card.branchPair", {
                    baseBranch: item.baseBranch,
                    headBranch: item.headBranch,
                  })}
                </span>
              </span>
            </div>
            {canShowMergeButton ? (
              <div className="flex min-h-[22px] shrink-0 items-center">
                <Button
                  className="px-3 text-sm leading-[22px]"
                  color="secondary"
                  size="default"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onMergePullRequest(item);
                  }}
                >
                  {t("pullRequestsPage.card.merge")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PullRequestContextMenu({
  item,
  position,
  onClose,
  onCopyPullRequestUrl,
  onOpenPullRequestInBrowser,
  menuRef,
}: {
  item: PullRequestBoardItem;
  position: { x: number; y: number };
  onClose: () => void;
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  menuRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useI18n();

  return (
    <div
      ref={menuRef}
      className="app-card no-drag fixed z-30 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      style={getSafeContextMenuPosition(position)}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={() => {
          void onCopyPullRequestUrl(item);
          onClose();
        }}
        className="app-nav-item-idle no-drag flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]"
      >
        <CopyPathIcon className="h-4 w-4 shrink-0" />
        <span>{t("pullRequestsPage.card.contextMenu.copyUrl")}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          void onOpenPullRequestInBrowser(item);
          onClose();
        }}
        className="app-nav-item-idle no-drag flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]"
      >
        <GitHubMarkIcon className="h-4 w-4 shrink-0" />
        <span>{t("pullRequestsPage.card.contextMenu.openInBrowser")}</span>
      </button>
    </div>
  );
}

function InternalHeaderRepoMenu({
  disabled,
  onChange,
  options,
  selectedRepoKey,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  options: PullRequestRepoOption[];
  selectedRepoKey: string | null;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const menuOptions: RepoMenuOption[] = [
    { key: "all", label: t("pullRequestsPage.repo.allRepos") },
    ...options.map((option) => ({ key: option.key, label: option.label })),
  ];
  const selectedKey = selectedRepoKey ?? menuOptions[0]?.key ?? "all";
  const selectedOption = menuOptions.find((option) => option.key === selectedKey) ?? menuOptions[0] ?? null;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        color="outline"
        disabled={disabled}
        size="toolbar"
        onClick={() => setIsOpen((open) => !open)}
      >
        <GitHubMarkIcon className="icon-sm shrink-0" />
        <span className="max-w-[220px] truncate">{selectedOption?.label ?? selectedKey}</span>
        <ChevronDownIcon
          className={[
            "icon-2xs text-token-input-placeholder-foreground transition-transform",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <RepoMenuButton
            isSelected={selectedKey === "all"}
            label={t("pullRequestsPage.repo.allRepos")}
            onSelect={() => {
              setIsOpen(false);
              onChange("all");
            }}
          />
          <div className="my-2 h-px bg-[var(--app-shell-border)]" />
          {options.map((option) => (
            <RepoMenuButton
              key={option.key}
              isSelected={option.key === selectedKey}
              label={option.label}
              onSelect={() => {
                setIsOpen(false);
                onChange(option.key);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RepoMenuButton({
  isSelected,
  label,
  onSelect,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
        isSelected ? "font-medium" : "",
      ].join(" ")}
    >
      <span className="min-w-0 truncate">{label}</span>
      {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
    </button>
  );
}

export function PullRequestsBoardLoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function PullRequestsRouteLoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}

export function PullRequestsCenteredEmptyState({
  description,
  detail,
  title,
}: {
  description: string;
  detail?: string | null;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-full items-center justify-center">
      <div className="flex w-full flex-col items-center justify-center px-3 py-6">
        <div className="flex w-full max-w-xl flex-col items-center justify-center gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="text-base font-medium">{title}</div>
            <div className="text-base text-token-description-foreground">{description}</div>
            {detail ? <div className="text-xs text-token-description-foreground">{detail}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function useSelectableRow(onSelect: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-disabled": false,
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      onSelect();
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.currentTarget !== event.target) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
  };
}

function getSectionDomId(key: PullRequestBoardSection["key"]) {
  return `pull-request-board-section-${key}`;
}

function getEmptyDescription(
  isAllReposSelected: boolean,
  selectedView: PullRequestFilterView,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (isAllReposSelected) {
    return t("pullRequestsPage.empty.noPullRequests.allReposDescription");
  }

  if (selectedView === "review") {
    return t("pullRequestsPage.empty.noPullRequests.reviewDescription");
  }

  return t("pullRequestsPage.empty.noPullRequests.description");
}

function getSafeContextMenuPosition(position: { x: number; y: number }) {
  if (typeof window === "undefined") {
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
    };
  }

  const contextMenuWidth = 180;
  const contextMenuHeight = 96;
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

function DotDivider() {
  return <span className="shrink-0 text-token-description-foreground">·</span>;
}

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M9.99996 2.08002C14.373 2.08002 17.915 5.62198 17.915 9.99502C17.9145 11.6534 17.3941 13.2699 16.4268 14.617C15.4595 15.9641 14.0941 16.9739 12.5229 17.5044C12.1271 17.5835 11.9787 17.3362 11.9787 17.1284C11.9787 16.8613 11.9886 16.0104 11.9886 14.9518C11.9886 14.2098 11.7413 13.7349 11.4543 13.4875C13.2154 13.2896 15.0656 12.6169 15.0656 9.57948C15.0656 8.70883 14.7589 8.00637 14.2543 7.45232C14.3334 7.25445 14.6104 6.44316 14.1751 5.35485C14.1751 5.35485 13.5122 5.13719 11.9985 6.16614C11.3653 5.98805 10.6925 5.899 10.0197 5.899C9.34697 5.899 8.6742 5.98805 8.041 6.16614C6.52726 5.14708 5.86437 5.35485 5.86437 5.35485C5.42905 6.44316 5.70607 7.25445 5.78522 7.45232C5.28064 8.00637 4.97394 8.71872 4.97394 9.57948C4.97394 12.607 6.81417 13.2896 8.57526 13.4875C8.3477 13.6854 8.13994 14.0317 8.07068 14.5461C7.61557 14.7539 6.47779 15.0903 5.76544 13.8932C5.61703 13.6557 5.17181 13.072 4.54851 13.0819C3.88562 13.0918 4.28137 13.4578 4.5584 13.6062C4.89479 13.7942 5.28064 14.4967 5.36969 14.7242C5.52799 15.1694 6.04246 16.0203 8.03111 15.6542C8.03111 16.3171 8.041 16.9404 8.041 17.1284C8.041 17.3362 7.89259 17.5736 7.49684 17.5044C5.92041 16.9796 4.54923 15.9718 3.57782 14.6239C2.60641 13.276 2.08409 11.6565 2.08496 9.99502C2.08496 5.62198 5.62692 2.08002 9.99996 2.08002Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const PullRequestsHeaderRepoMenu = InternalHeaderRepoMenu;
