import { useEffect, useRef, useState, type SVGProps } from "react";
import { CheckIcon, ChevronDownIcon, MoreActionsIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import type { PullRequestBoardItem, PullRequestFilterView, PullRequestStatusSuccess } from "../../services/pullRequests";
import type { PullRequestDiffFile } from "./pullRequestDiffModel";
import { PullRequestDetailPane, type PullRequestDetailTab } from "./PullRequestDetailPane";
import { PullRequestStateColorClass, PullRequestStateIcon } from "./PullRequestIcons";
import type { PullRequestBoardSection, PullRequestRepoOption } from "./pullRequestsPageModel";

type PullRequestsPageViewProps = {
  boardItems: PullRequestBoardItem[];
  boardLoading: boolean;
  boardSections: PullRequestBoardSection[];
  detail: PullRequestStatusSuccess | null;
  detailError: string | null;
  detailKey: string;
  detailLoading: boolean;
  diffFiles: PullRequestDiffFile[];
  codeReviewError: string | null;
  cwd: string | null;
  isCodeReviewLoading: boolean;
  noRepos: boolean;
  onCloseDetail: () => void;
  onCopyGitApplyCommand: (() => void | Promise<void>) | null;
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenCommentUrl: (url: string) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  onMarkAsDraft: () => void | Promise<void>;
  onMarkAsReady: () => void | Promise<void>;
  onPostComment: (body: string) => void | Promise<void>;
  onPostReply: (reviewThreadId: string, body: string) => void | Promise<void>;
  onRefreshCodeReview: () => void;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
  onSelectFilterView: (view: PullRequestFilterView) => void;
  onSelectRepo: (repoKey: string) => void;
  onSelectTab: (tab: PullRequestDetailTab) => void;
  onToggleAutoMerge: () => void | Promise<void>;
  hostId: string | null;
  pageError: string | null;
  pageErrorDetail: string | null;
  repoOptions: PullRequestRepoOption[];
  selectedBoardItem: PullRequestBoardItem | null;
  selectedRepoKey: string | null;
  selectedTab: PullRequestDetailTab;
  selectedView: PullRequestFilterView;
  isWorkspaceMetadataLoading: boolean;
};

export function PullRequestsPageView({
  boardItems,
  boardLoading,
  boardSections,
  detail,
  detailError,
  detailKey,
  detailLoading,
  diffFiles,
  codeReviewError,
  cwd,
  isCodeReviewLoading,
  noRepos,
  onCloseDetail,
  onCopyGitApplyCommand,
  onCopyPullRequestUrl,
  onMergePullRequest,
  onOpenCommentUrl,
  onOpenPullRequestInBrowser,
  onMarkAsDraft,
  onMarkAsReady,
  onPostComment,
  onPostReply,
  onRefreshCodeReview,
  onSelectBoardItem,
  onSelectFilterView,
  onSelectRepo,
  onSelectTab,
  onToggleAutoMerge,
  hostId,
  pageError,
  pageErrorDetail,
  repoOptions,
  selectedBoardItem,
  selectedRepoKey,
  selectedTab,
  selectedView,
  isWorkspaceMetadataLoading,
}: PullRequestsPageViewProps) {
  const { t } = useI18n();
  const hasRepos = repoOptions.length > 0;
  const shouldShowLoading = isWorkspaceMetadataLoading || (hasRepos && boardLoading && boardItems.length === 0);

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--app-shell-border)] bg-[var(--app-shell-topbar)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="app-title truncate text-[16px] font-medium">{t("pullRequestsPage.title")}</div>
        </div>
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

      <div className="border-b border-[var(--app-shell-border)] bg-[var(--app-shell-topbar)] px-5 py-3">
        <PullRequestFilterToggle selectedView={selectedView} onSelectView={onSelectFilterView} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0">
          <section
            className={[
              "min-h-0 overflow-hidden border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]",
              selectedBoardItem ? "w-[460px] shrink-0 border-r" : "flex-1",
            ].join(" ")}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {boardItems.length === 0 ? (
                  <CenteredState
                    description={getEmptyDescription(selectedRepoKey === "all", selectedView, t)}
                    title={t("pullRequestsPage.empty.noPullRequests.title")}
                  />
                ) : (
                  <div className="space-y-6" aria-label={t("pullRequestsPage.sectionsNav")}>
                    {boardSections.map((section) => (
                      <PullRequestBoardSectionView
                        key={section.key}
                        section={section}
                        isSelectedRepoAll={selectedRepoKey === "all"}
                        onCopyPullRequestUrl={onCopyPullRequestUrl}
                        onMergePullRequest={onMergePullRequest}
                        onOpenPullRequestInBrowser={onOpenPullRequestInBrowser}
                        onSelectBoardItem={onSelectBoardItem}
                        selectedBoardItem={selectedBoardItem}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {selectedBoardItem ? (
            <PullRequestDetailPane
              boardItem={selectedBoardItem}
              codeReviewError={codeReviewError}
              commentAttachments={detail?.commentAttachments ?? []}
              cwd={cwd}
              detail={detail}
              detailError={detailError}
              detailKey={detailKey}
              detailLoading={detailLoading}
              diffFiles={diffFiles}
              isCodeReviewLoading={isCodeReviewLoading}
              onClose={onCloseDetail}
              onCopyGitApplyCommand={onCopyGitApplyCommand}
              onCopyUrl={() => void onCopyPullRequestUrl(selectedBoardItem)}
              onMerge={() => void onMergePullRequest(selectedBoardItem)}
              onOpenCommentUrl={(url) => void onOpenCommentUrl(url)}
              onOpenInBrowser={() => void onOpenPullRequestInBrowser(selectedBoardItem)}
              onPostComment={(body) => void onPostComment(body)}
              onPostReply={(reviewThreadId, body) => void onPostReply(reviewThreadId, body)}
              onRefreshCodeReview={onRefreshCodeReview}
              onSelectTab={onSelectTab}
              onMarkAsDraft={onMarkAsDraft}
              onMarkAsReady={onMarkAsReady}
              onToggleAutoMerge={onToggleAutoMerge}
              hostId={hostId}
              selectedTab={selectedTab}
            />
          ) : null}
        </div>
      </div>
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
  );
}

function PullRequestBoardSectionView({
  isSelectedRepoAll,
  onCopyPullRequestUrl,
  onMergePullRequest,
  onOpenPullRequestInBrowser,
  onSelectBoardItem,
  section,
  selectedBoardItem,
}: {
  isSelectedRepoAll: boolean;
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
  section: PullRequestBoardSection;
  selectedBoardItem: PullRequestBoardItem | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(section.key === "merged");
  const { t } = useI18n();
  const sectionId = `pull-request-board-section-${section.key}`;

  useEffect(() => {
    setIsCollapsed(section.key === "merged");
  }, [section.key]);

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        aria-controls={sectionId}
        onClick={() => setIsCollapsed((value) => !value)}
        className="flex items-center gap-2 text-left"
      >
        <ChevronDownIcon
          className={[
            "icon-2xs shrink-0 transition-transform",
            isCollapsed ? "-rotate-90" : "",
          ].join(" ")}
        />
        <span className="text-[12px] font-medium tracking-[0.14em] text-[var(--app-shell-subtle)]">
          {t(section.title as MessageKey)}
        </span>
      </button>

      {isCollapsed ? null : (
        <div id={sectionId} className="flex flex-col gap-2">
          {section.items.map((item) => (
            <PullRequestBoardCard
              key={item.url}
              item={item}
              isSelected={selectedBoardItem?.url === item.url}
              isSelectedRepoAll={isSelectedRepoAll}
              onCopyPullRequestUrl={onCopyPullRequestUrl}
              onMergePullRequest={onMergePullRequest}
              onOpenPullRequestInBrowser={onOpenPullRequestInBrowser}
              onSelectBoardItem={onSelectBoardItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PullRequestBoardCard({
  isSelected,
  isSelectedRepoAll,
  item,
  onCopyPullRequestUrl,
  onMergePullRequest,
  onOpenPullRequestInBrowser,
  onSelectBoardItem,
}: {
  isSelected: boolean;
  isSelectedRepoAll: boolean;
  item: PullRequestBoardItem;
  onCopyPullRequestUrl: (item: PullRequestBoardItem) => void | Promise<void>;
  onMergePullRequest: (item: PullRequestBoardItem) => void | Promise<void>;
  onOpenPullRequestInBrowser: (item: PullRequestBoardItem) => void | Promise<void>;
  onSelectBoardItem: (item: PullRequestBoardItem) => void;
}) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canShowMergeButton = item.isAuthor && item.state === "ready";
  const rightActions = [
    {
      label: t("pullRequestsPage.card.contextMenu.copyUrl"),
      onSelect: () => void onCopyPullRequestUrl(item),
    },
    {
      label: t("pullRequestsPage.card.contextMenu.openInBrowser"),
      onSelect: () => void onOpenPullRequestInBrowser(item),
    },
  ];

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  return (
    <article ref={menuRef} className="relative">
      <div
        className={[
          "flex items-stretch gap-2 rounded-[14px] border px-3 py-3",
          isSelected
            ? "app-nav-item-active border-[var(--app-shell-border-heavy)]"
            : "app-nav-item-idle border-[var(--app-shell-border)]",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onSelectBoardItem(item)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <PullRequestStateIcon
            className={["mt-0.5 h-5 w-5 shrink-0", PullRequestStateColorClass(item.state)].join(" ")}
            state={item.state}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium leading-5">{item.title}</div>
                <div className="mt-1 flex min-w-0 items-center gap-1 text-[12px] leading-5">
                  {isSelectedRepoAll && item.repo ? (
                    <>
                      <span className="truncate text-[var(--app-shell-subtle)]">{item.repo}</span>
                      <span className="shrink-0 text-[var(--app-shell-subtle)]">·</span>
                    </>
                  ) : null}
                  <span className="truncate text-[var(--app-shell-subtle)]">
                    {t("pullRequestsPage.card.branchPair", {
                      baseBranch: item.baseBranch,
                      headBranch: item.headBranch,
                    })}
                  </span>
                </div>
              </div>
              <span className="app-text-muted shrink-0 text-[11px] leading-5">
                +{item.additions} / -{item.deletions}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="app-card-muted rounded-full px-2 py-0.5 text-[11px] leading-5">
                {t("pullRequestsPage.card.pullRequestNumber", { number: item.number })}
              </span>
              {canShowMergeButton ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onMergePullRequest(item);
                  }}
                  className="app-button-primary rounded-[11px] px-3 py-1 text-[12px]"
                >
                  {t("pullRequestsPage.card.merge")}
                </button>
              ) : null}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-start gap-1 pt-0.5">
          <button
            type="button"
            aria-label={t("pullRequestsPage.card.contextMenu.copyUrl")}
            aria-expanded={isMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen((value) => !value);
            }}
            className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
          >
            <MoreActionsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="app-card absolute top-[calc(100%+6px)] right-0 z-20 min-w-[180px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {rightActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                action.onSelect();
              }}
              className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px]"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
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
    <div className="relative w-[280px] max-w-full shrink-0" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <GitHubMarkIcon className="h-4 w-4 shrink-0" />
          <span className="truncate text-left">{selectedOption?.label ?? value}</span>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setIsOpen(false);
                    onChange(option.value);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                    isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                  ].join(" ")}
                >
                  <span className="min-w-0 truncate text-[13px]">{option.label}</span>
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
