import { useEffect, useMemo, useRef, useState, type MouseEvent, type SVGProps } from "react";
import { CheckIcon, ChevronDownIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type { PullRequestBoardItem, PullRequestFilterView } from "../../services/pullRequests";
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
  noRepos: boolean;
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
  onSelectFilterView: (view: PullRequestFilterView) => void;
  onSelectRepo: (repoKey: string) => void;
  pageError: string | null;
  pageErrorDetail: string | null;
  repoOptions: PullRequestRepoOption[];
  selectedBoardItem: PullRequestBoardItem | null;
  selectedRepoKey: string | null;
  selectedView: PullRequestFilterView;
  isWorkspaceMetadataLoading: boolean;
};

type ContextMenuState = {
  item: PullRequestBoardItem;
  x: number;
  y: number;
} | null;

export function PullRequestsPageView({
  boardItems,
  boardLoading,
  boardSections,
  noRepos,
  onCopyPullRequestUrl,
  onMergePullRequest,
  onOpenPullRequestInBrowser,
  onSelectBoardItem,
  onSelectFilterView,
  onSelectRepo,
  pageError,
  pageErrorDetail,
  repoOptions,
  selectedBoardItem,
  selectedRepoKey,
  selectedView,
  isWorkspaceMetadataLoading,
}: PullRequestsPageViewProps) {
  const { t } = useI18n();
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const hasRepos = repoOptions.length > 0;
  const shouldShowLoading = isWorkspaceMetadataLoading || (hasRepos && boardLoading && boardItems.length === 0);
  const boardContent = useMemo(() => {
    if (boardItems.length === 0) {
      return (
        <CenteredState
          description={getEmptyDescription(selectedRepoKey === "all", selectedView, t)}
          title={t("pullRequestsPage.empty.noPullRequests.title")}
        />
      );
    }

    return (
      <div className="flex flex-col gap-8 px-panel pb-panel" aria-label={t("pullRequestsPage.sectionsNav")}>
        {boardSections.map((section) => (
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
        ))}
      </div>
    );
  }, [boardItems.length, boardSections, onMergePullRequest, onSelectBoardItem, selectedBoardItem, selectedRepoKey, selectedView, t]);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuState]);

  if (pageError) {
    return (
      <CenteredState
        description={t("pullRequestsPage.error.description")}
        detail={pageErrorDetail}
        title={t("pullRequestsPage.error.title")}
      />
    );
  }

  if (shouldShowLoading) {
    return <CenteredSpinner />;
  }

  if (noRepos) {
    return (
      <CenteredState
        description={t("pullRequestsPage.empty.noRepos.description")}
        title={t("pullRequestsPage.empty.noRepos.title")}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="draggable flex w-full min-w-0 items-center justify-between gap-3 border-b border-[var(--app-shell-border)] px-panel py-3">
        <div className="min-w-0 text-[16px] font-medium text-[var(--app-shell-title)]">
          {t("pullRequestsPage.title")}
        </div>
        <div className="flex items-center gap-2">
          <PullRequestRepoMenu
            disabled={repoOptions.length === 0}
            onChange={onSelectRepo}
            options={[
              { label: t("pullRequestsPage.repo.allRepos"), value: "all" },
              ...repoOptions.map((repoOption) => ({ label: repoOption.label, value: repoOption.key })),
            ]}
            value={selectedRepoKey ?? repoOptions[0]?.key ?? "all"}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-content-max-width)] flex-col gap-8 px-panel pt-panel">
            <PullRequestFilterToggle selectedView={selectedView} onSelectView={onSelectFilterView} />
            {boardContent}
          </div>
        </div>
      </div>

      {contextMenuState ? (
        <div
          ref={contextMenuRef}
          className="app-card fixed z-30 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
          style={{ left: contextMenuState.x, top: contextMenuState.y }}
        >
          <button
            type="button"
            onClick={() => {
              void onCopyPullRequestUrl(contextMenuState.item);
              setContextMenuState(null);
            }}
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
          >
            {t("pullRequestsPage.card.contextMenu.copyUrl")}
          </button>
          <button
            type="button"
            onClick={() => {
              void onOpenPullRequestInBrowser(contextMenuState.item);
              setContextMenuState(null);
            }}
            className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
          >
            {t("pullRequestsPage.card.contextMenu.openInBrowser")}
          </button>
        </div>
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
      <div className="inline-flex rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] p-1">
        <button
          type="button"
          aria-pressed={selectedView === "authored"}
          aria-label={t("pullRequestsPage.filter.ariaLabel")}
          onClick={() => onSelectView("authored")}
          className={[
            "rounded-[10px] px-3 py-1.5 text-[12px] transition-colors",
            selectedView === "authored" ? "app-nav-item-active" : "app-nav-item-idle",
          ].join(" ")}
        >
          {t("pullRequestsPage.filter.authored")}
        </button>
        <button
          type="button"
          aria-pressed={selectedView === "review"}
          onClick={() => onSelectView("review")}
          className={[
            "rounded-[10px] px-3 py-1.5 text-[12px] transition-colors",
            selectedView === "review" ? "app-nav-item-active" : "app-nav-item-idle",
          ].join(" ")}
        >
          {t("pullRequestsPage.filter.review")}
        </button>
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

  return (
    <section id={sectionId} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--app-shell-border)] pb-2">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={`${sectionId}-items`}
          onClick={() => setIsCollapsed((value) => !value)}
          className="flex cursor-pointer items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={[
              "icon-2xs shrink-0 transition-transform",
              isCollapsed ? "-rotate-90" : "",
            ].join(" ")}
          />
          <span>{t(section.title as MessageKey)}</span>
        </button>
      </div>
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
    </section>
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

  return (
    <div
      aria-label={item.title}
      role="button"
      tabIndex={0}
      aria-disabled={false}
      onClick={() => onSelectBoardItem(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectBoardItem(item);
        }
      }}
      onContextMenu={(event) => onContextMenu(item, event)}
      className={[
        "group min-h-10 w-full cursor-pointer rounded-lg px-3 py-3 text-left text-base",
        isSelected ? "bg-[var(--app-shell-card-bg-selected)]" : "hover:bg-[var(--app-shell-card-bg-selected)]",
      ].join(" ")}
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
              <span className="min-w-0 truncate text-[var(--app-shell-title)]">{item.title}</span>
              <span className="max-w-48 shrink-0 truncate text-[var(--app-shell-muted)]">
                {t("pullRequestsPage.card.pullRequestNumber", { number: item.number })}
              </span>
            </div>
            <div className="flex min-h-6 shrink-0 items-center text-base text-[var(--app-shell-muted)]">
              +{item.additions} / -{item.deletions}
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-3 text-sm leading-[22px] text-[var(--app-shell-muted)]">
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onMergePullRequest(item);
                  }}
                  className="app-control rounded-[11px] px-3 text-sm leading-[22px]"
                >
                  {t("pullRequestsPage.card.merge")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PullRequestRepoMenu({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;

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
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <GitHubMarkIcon className="icon-sm shrink-0" />
        <span className="max-w-[220px] truncate">{selectedOption?.label ?? value}</span>
        <ChevronDownIcon
          className={[
            "icon-2xs text-token-text-secondary transition-transform",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[220px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
                className={[
                  "app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                  isSelected ? "font-medium" : "",
                ].join(" ")}
              >
                <span className="min-w-0 truncate text-[13px]">{option.label}</span>
                {isSelected ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
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

function DotDivider() {
  return <span className="shrink-0 text-[var(--app-shell-muted)]">·</span>;
}

function GitHubMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9.99996 2.08002C14.373 2.08002 17.915 5.62198 17.915 9.99502C17.9145 11.6534 17.3941 13.2699 16.4268 14.617C15.4595 15.9641 14.0941 16.9739 12.5229 17.5044C12.1271 17.5835 11.9787 17.3362 11.9787 17.1284C11.9787 16.8613 11.9886 16.0104 11.9886 14.9518C11.9886 14.2098 11.7413 13.7349 11.4543 13.4875C13.2154 13.2896 15.0656 12.6169 15.0656 9.57948C15.0656 8.70883 14.7589 8.00637 14.2543 7.45232C14.3334 7.25445 14.6104 6.44316 14.1751 5.35485C14.1751 5.35485 13.5122 5.13719 11.9985 6.16614C11.3653 5.98805 10.6925 5.899 10.0197 5.899C9.34697 5.899 8.6742 5.98805 8.041 6.16614C6.52726 5.14708 5.86437 5.35485 5.86437 5.35485C5.42905 6.44316 5.70607 7.25445 5.78522 7.45232C5.28064 8.00637 4.97394 8.71872 4.97394 9.57948C4.97394 12.607 6.81417 13.2896 8.57526 13.4875C8.3477 13.6854 8.13994 14.0317 8.07068 14.5461C7.61557 14.7539 6.47779 15.0903 5.76544 13.8932C5.61703 13.6557 5.17181 13.072 4.54851 13.0819C3.88562 13.0918 4.28137 13.4578 4.5584 13.6062C4.89479 13.7942 5.28064 14.4967 5.36969 14.7242C5.52799 15.1694 6.04246 16.0203 8.03111 15.6542C8.03111 16.3171 8.041 16.9404 8.041 17.1284C8.041 17.3362 7.89259 17.5736 7.49684 17.5044C5.92041 16.9796 4.54923 15.9718 3.57782 14.6239C2.60641 13.276 2.08409 11.6565 2.08496 9.99502C2.08496 5.62198 5.62692 2.08002 9.99996 2.08002Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--app-shell-border-heavy)] border-t-transparent" />
    </div>
  );
}

function CenteredState({
  description,
  detail,
  title,
}: {
  description: string;
  detail?: string | null;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6">
      <div className="app-card w-full max-w-[420px] rounded-[20px] px-8 py-8 text-center">
        <div className="app-title text-[18px] font-medium">{title}</div>
        <div className="app-text-muted mt-3 text-[14px] leading-6">{description}</div>
        {detail ? <div className="app-text-muted mt-2 break-words text-[12px] leading-5">{detail}</div> : null}
      </div>
    </div>
  );
}
