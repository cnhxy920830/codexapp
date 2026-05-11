import { useEffect, useState, type ReactNode } from "react";
import { BrowserTabIcon, CloseTabIcon, CopyPathIcon } from "../../components/AppShellIcons";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useI18n } from "../../i18n/i18n";
import type {
  PullRequestActivityComment,
  PullRequestActivityEvent,
  PullRequestActivityItem,
  PullRequestBoardItem,
  PullRequestCommentAttachment,
  PullRequestReviewer,
  PullRequestReviewers,
  PullRequestStatusSuccess,
} from "../../services/pullRequests";
import { renderMessageContent } from "../chat/messageContent";
import type { PullRequestDiffFile } from "./pullRequestDiffModel";
import {
  ActivityEventIcon,
  PullRequestStateIcon,
} from "./PullRequestIcons";
import { PullRequestChecksSection } from "./PullRequestChecksSection";
import { PullRequestCodeReviewPane } from "./PullRequestCodeReviewPane";

export type PullRequestDetailTab = "pullRequest" | "codeReview";

type PullRequestReplyTarget = {
  authorLabel: string;
  reviewThreadId: string;
} | null;

export function PullRequestDetailPane({
  boardItem,
  codeReviewError,
  cwd,
  detail,
  detailError,
  detailKey,
  detailLoading,
  diffFiles,
  isCodeReviewLoading,
  onClose,
  onCopyGitApplyCommand,
  onCopyUrl,
  onMarkAsDraft,
  onMarkAsReady,
  onMerge,
  onOpenCommentUrl,
  onOpenInBrowser,
  onPostComment,
  onPostReply,
  onRefreshCodeReview,
  hostId,
  onToggleAutoMerge,
  onSelectTab,
  selectedTab,
  commentAttachments,
}: {
  boardItem: PullRequestBoardItem | null;
  codeReviewError: string | null;
  commentAttachments: PullRequestCommentAttachment[];
  cwd: string | null;
  detail: PullRequestStatusSuccess | null;
  detailError: string | null;
  detailKey: string;
  detailLoading: boolean;
  diffFiles: PullRequestDiffFile[];
  isCodeReviewLoading: boolean;
  onClose: () => void;
  onCopyGitApplyCommand: (() => void | Promise<void>) | null;
  onCopyUrl: () => void | Promise<void>;
  onMarkAsDraft: () => void | Promise<void>;
  onMarkAsReady: () => void | Promise<void>;
  onMerge: () => void | Promise<void>;
  onOpenCommentUrl: (url: string) => void | Promise<void>;
  onOpenInBrowser: () => void | Promise<void>;
  onPostComment: (body: string) => void | Promise<void>;
  onPostReply: (reviewThreadId: string, body: string) => void | Promise<void>;
  onRefreshCodeReview: () => void;
  hostId: string | null;
  onSelectTab: (tab: PullRequestDetailTab) => void;
  onToggleAutoMerge: () => void | Promise<void>;
  selectedTab: PullRequestDetailTab;
}) {
  const { locale, t } = useI18n();
  const [commentDraft, setCommentDraft] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<PullRequestReplyTarget>(null);
  const [isPostingReply, setIsPostingReply] = useState(false);
  const currentPullRequest = detail ?? null;
  const hasOpenPullRequest = detail?.hasOpenPr ?? boardItem !== null;
  const effectiveBoardItem = detail?.boardItem ?? boardItem;
  const openCommentUrl = (url: string | null) => {
    if (url == null) {
      return;
    }

    void onOpenCommentUrl(url);
  };

  useEffect(() => {
    setCommentDraft("");
    setReplyDraft("");
    setReplyTarget(null);
  }, [detailKey]);

  const headerSubtitle =
    effectiveBoardItem != null && effectiveBoardItem.repo != null
      ? effectiveBoardItem.repo
      : currentPullRequest?.repo ?? null;

  const handleSubmitComment = async () => {
    const body = commentDraft.trim();
    if (body.length === 0) {
      return;
    }

    setIsPostingComment(true);
    try {
      await onPostComment(body);
      setCommentDraft("");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyTarget) {
      return;
    }

    const body = replyDraft.trim();
    if (body.length === 0) {
      return;
    }

    setIsPostingReply(true);
    try {
      await onPostReply(replyTarget.reviewThreadId, body);
      setReplyDraft("");
      setReplyTarget(null);
    } finally {
      setIsPostingReply(false);
    }
  };

  if (effectiveBoardItem == null) {
    return <div className="min-h-0 flex-1 overflow-y-auto" />;
  }

  const isInitialLoading = detailLoading && currentPullRequest == null;
  const isRefreshing = detailLoading && currentPullRequest != null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]">
      <div className="border-b border-[var(--app-shell-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <PullRequestStateIcon className="h-5 w-5 shrink-0" state={effectiveBoardItem.state} />
              <div className="app-title truncate text-[15px] font-medium leading-6">{effectiveBoardItem.title}</div>
              <div className="app-card-muted shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-5">
                {t("pullRequestsPage.detail.pullRequestNumber", { number: effectiveBoardItem.number })}
              </div>
            </div>
            <div className="app-text-muted mt-1 truncate text-[12px] leading-5">
              {headerSubtitle ?? effectiveBoardItem.cwd}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <button
              type="button"
              title={t("pullRequestsPage.detail.copyPullRequestUrl.ariaLabel")}
              aria-label={t("pullRequestsPage.detail.copyPullRequestUrl.ariaLabel")}
              onClick={() => void onCopyUrl()}
              className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
            >
              <CopyPathIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("pullRequestsPage.detail.openPullRequest.tooltip")}
              aria-label={t("pullRequestsPage.detail.openPullRequest")}
              onClick={() => void onOpenInBrowser()}
              className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
            >
              <BrowserTabIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("pullRequestsPage.detail.closePanel")}
              aria-label={t("pullRequestsPage.detail.closePanel")}
              onClick={onClose}
              className="app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent"
            >
              <CloseTabIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={[
          "min-h-0 flex-1 px-5 py-4",
          selectedTab === "codeReview" ? "overflow-hidden" : "overflow-y-auto",
        ].join(" ")}
      >
        {detailError ? (
          <div className="app-card-error rounded-[14px] px-4 py-3 text-[13px] leading-6">
            <div className="font-medium">{t("pullRequestsPage.error.title")}</div>
            <div className="mt-1 text-[12px] leading-5 opacity-80">{t("pullRequestsPage.detail.section.errorDescription")}</div>
            <div className="mt-2 break-words text-[12px] leading-5 opacity-80">{detailError}</div>
          </div>
        ) : null}

        {isInitialLoading || isRefreshing ? (
          <div className="app-card-muted mt-4 rounded-[14px] px-4 py-3 text-[13px] leading-6">
            {isInitialLoading ? t("pullRequestsPage.detail.body.loading") : t("pullRequestsPage.detail.body.refreshing")}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] p-1">
            <button
              type="button"
              aria-label={t("pullRequestsPage.detail.viewToggle.ariaLabel")}
              aria-pressed={selectedTab === "pullRequest"}
              onClick={() => onSelectTab("pullRequest")}
              className={[
                "rounded-[10px] px-3 py-1.5 text-[12px] transition-colors",
                selectedTab === "pullRequest" ? "app-nav-item-active" : "app-nav-item-idle",
              ].join(" ")}
            >
              {t("pullRequestsPage.detail.viewToggle.pullRequest")}
            </button>
            <button
              type="button"
              aria-pressed={selectedTab === "codeReview"}
              onClick={() => onSelectTab("codeReview")}
              className={[
                "rounded-[10px] px-3 py-1.5 text-[12px] transition-colors",
                selectedTab === "codeReview" ? "app-nav-item-active" : "app-nav-item-idle",
              ].join(" ")}
            >
              {t("pullRequestsPage.detail.viewToggle.codeReview")}
            </button>
          </div>
        </div>

        {selectedTab === "pullRequest" ? (
          <div className="mt-4 space-y-4">
            <div className="app-card-muted max-h-[320px] overflow-y-auto rounded-[14px] px-4 py-3">
              {isInitialLoading ? (
                <div className="text-[13px] leading-6">
                  {t("pullRequestsPage.detail.body.loading")}
                </div>
              ) : currentPullRequest?.body.trim().length ? (
                renderMessageContent(currentPullRequest.body)
              ) : (
                <div className="text-[13px] leading-6">
                  {t("pullRequestsPage.detail.noBody")}
                </div>
              )}
            </div>

            <PullRequestSection title={t("pullRequestsPage.detail.reviewers")}>
              {isInitialLoading ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">
                  {t("pullRequestsPage.detail.reviewers.loading")}
                </div>
              ) : (
                renderReviewers(currentPullRequest?.reviewers ?? null, t)
              )}
            </PullRequestSection>

            <PullRequestChecksSection
              checks={currentPullRequest?.checks ?? []}
              ciStatus={currentPullRequest?.ciStatus ?? "none"}
              onOpenCheckUrl={(url) => void openCommentUrl(url)}
            />

            <PullRequestSection title={t("pullRequestsPage.detail.activity")}>
              {isInitialLoading ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">
                  {t("pullRequestsPage.detail.activity.loadingAuthor")}
                </div>
              ) : currentPullRequest == null || currentPullRequest.activityItems.length === 0 ? (
                <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">
                  {t("pullRequestsPage.detail.noComments")}
                </div>
              ) : (
                <div className="space-y-3">
                  {currentPullRequest.activityItems.map((item) => (
                    <ActivityItemCard
                      key={activityItemKey(item)}
                      item={item}
                      locale={locale}
                      onReply={(replyTargetValue) => {
                        setReplyTarget(replyTargetValue);
                        setReplyDraft("");
                      }}
                      replyDraft={replyDraft}
                      replyTarget={replyTarget}
                      setReplyDraft={setReplyDraft}
                      isPostingReply={isPostingReply}
                      onCancelReply={() => {
                        setReplyTarget(null);
                        setReplyDraft("");
                      }}
                      onSubmitReply={() => void handleSubmitReply()}
                      hasOpenPullRequest={hasOpenPullRequest}
                      onOpenCommentOnGitHub={openCommentUrl}
                      onViewCommentOnGitHub={openCommentUrl}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </PullRequestSection>

            {hasOpenPullRequest ? (
              <div className="app-card-muted rounded-[14px] px-4 py-3">
                <textarea
                  aria-label={t("pullRequestsPage.detail.commentInput.ariaLabel")}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                  placeholder={t("pullRequestsPage.detail.commentInput.placeholder")}
                  className="app-input min-h-[100px] w-full rounded-[12px] px-3 py-2 text-[13px] leading-6"
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPostingComment || commentDraft.trim().length === 0}
                    onClick={() => void handleSubmitComment()}
                    className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
                  >
                    {t("pullRequestsPage.detail.commentInput.submit")}
                  </button>
                </div>
              </div>
            ) : null}

            {hasOpenPullRequest && effectiveBoardItem.isAuthor ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  onClick={() => void (detail?.isDraft ? onMarkAsReady() : onMarkAsDraft())}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {detail?.isDraft
                    ? t("pullRequestsPage.detail.actions.markReady")
                    : t("pullRequestsPage.detail.actions.markDraft")}
                </button>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="flex items-center gap-2 text-[12px] text-[var(--app-shell-subtle)]">
                    <span>{t("pullRequestsPage.detail.actions.autoMerge")}</span>
                    <ToggleSwitch
                      ariaLabel={t("pullRequestsPage.detail.actions.autoMerge.ariaLabel")}
                      checked={detail?.isAutoMergeEnabled === true}
                      disabled={detail == null || (detail.isDraft && detail.isAutoMergeEnabled !== true)}
                      onChange={() => void onToggleAutoMerge()}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={detail?.canMerge !== true}
                    onClick={() => void onMerge()}
                    className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
                  >
                    {t("pullRequestsPage.detail.actions.merge")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <PullRequestCodeReviewPane
            codeReviewError={codeReviewError}
            commentAttachments={commentAttachments}
            cwd={cwd}
            detailKey={detailKey}
            diffFiles={diffFiles}
            isCodeReviewLoading={isCodeReviewLoading}
            hostId={hostId}
            onCopyGitApplyCommand={onCopyGitApplyCommand}
            onRefreshCodeReview={onRefreshCodeReview}
            onOpenCommentUrl={(url) => void openCommentUrl(url)}
          />
        )}
      </div>
    </div>
  );

}

function PullRequestSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-3">
      <div className="text-[12px] font-medium tracking-[0.14em] text-[var(--app-shell-subtle)]">{title}</div>
      {children}
    </section>
  );
}

function renderReviewers(reviewers: PullRequestReviewers | null, t: ReturnType<typeof useI18n>["t"]) {
  if (!reviewers) {
    return <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">{t("pullRequestsPage.detail.noReviewers")}</div>;
  }

  const reviewerMap = new Map<string, PullRequestReviewer>();
  for (const reviewer of [
    ...reviewers.requested,
    ...reviewers.approved,
    ...reviewers.changesRequested,
    ...reviewers.commented,
    ...reviewers.commentCounts,
  ]) {
    reviewerMap.set(reviewer.login, reviewer);
  }

  const entries = Array.from(reviewerMap.values());
  if (entries.length === 0) {
    return <div className="app-card-muted rounded-[14px] px-4 py-3 text-[13px] leading-6">{t("pullRequestsPage.detail.noReviewers")}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((reviewer) => (
        <div
          key={reviewer.login}
          className="app-card-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px]"
        >
          <ReviewerAvatar reviewer={reviewer} />
          <span className="truncate">{reviewer.login}</span>
          {reviewer.count != null && reviewer.count > 1 ? (
            <span className="app-text-muted text-[11px]">x{reviewer.count}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ActivityItemCard({
  item,
  locale,
  onCancelReply,
  onOpenCommentOnGitHub,
  onReply,
  onSubmitReply,
  onViewCommentOnGitHub,
  hasOpenPullRequest,
  replyDraft,
  replyTarget,
  setReplyDraft,
  isPostingReply,
  t,
}: {
  hasOpenPullRequest: boolean;
  item: PullRequestActivityItem;
  locale: string;
  onCancelReply: () => void;
  onOpenCommentOnGitHub: (url: string | null) => void;
  onReply: (replyTarget: PullRequestReplyTarget) => void;
  onSubmitReply: () => void;
  onViewCommentOnGitHub: (url: string | null) => void;
  replyDraft: string;
  replyTarget: PullRequestReplyTarget;
  setReplyDraft: (value: string) => void;
  isPostingReply: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  switch (item.type) {
    case "event":
      return (
        <div className="app-card-muted rounded-[14px] px-4 py-3">
          <div className="flex items-center gap-2">
            <ActivityEventIcon className="h-4 w-4 shrink-0" event={item.event} />
            <span className="app-title text-[13px] font-medium">{formatActivityEventLabel(item, t)}</span>
            <span className="app-text-muted text-[12px]">{formatRelativeTime(item.createdAt, locale)}</span>
          </div>
        </div>
      );
    case "comment":
    case "review":
    case "review_comment":
      return (
        <div className="app-card-muted rounded-[14px] px-4 py-3">
          <CommentHeader
            createdAt={item.createdAt}
            item={item}
            locale={locale}
            t={t}
            onOpenCommentOnGitHub={onOpenCommentOnGitHub}
            onViewCommentOnGitHub={onViewCommentOnGitHub}
          />
          <div className="mt-3">{renderMessageContent(item.body)}</div>
          {item.path && item.line != null ? (
            <div className="app-text-muted mt-3 text-[12px] leading-5">
              {t("pullRequestsPage.detail.activityCommentLocation", { path: item.path, line: item.line })}
            </div>
          ) : null}
          {item.type === "review_comment" && item.reviewThreadId ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={!hasOpenPullRequest}
                onClick={() =>
                  onReply({
                    authorLabel:
                      item.authorLogin?.trim().length ? item.authorLogin : t("pullRequestsPage.detail.commentReplyInput.fallbackAuthor"),
                    reviewThreadId: item.reviewThreadId ?? "",
                  })
                }
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
              >
                {t("pullRequestsPage.detail.activityComment.reply")}
              </button>
            </div>
          ) : null}
          {item.type === "review_comment" && item.reviewThreadId && replyTarget?.reviewThreadId === item.reviewThreadId ? (
            <div className="mt-3 rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] p-3">
              <textarea
                aria-label={t("pullRequestsPage.detail.commentReplyInput.ariaLabel")}
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    onSubmitReply();
                  }
                }}
                placeholder={t("pullRequestsPage.detail.commentReplyInput.placeholder", {
                  author: item.authorLogin?.trim().length ? item.authorLogin : t("pullRequestsPage.detail.commentReplyInput.unknownAuthor"),
                })}
                className="app-input min-h-[84px] w-full rounded-[12px] px-3 py-2 text-[13px] leading-6"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("pullRequestsPage.detail.commentReplyInput.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isPostingReply || replyDraft.trim().length === 0}
                  onClick={onSubmitReply}
                  className="app-button-primary rounded-[11px] px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-60"
                >
                  {t("pullRequestsPage.detail.commentReplyInput.submit")}
                </button>
              </div>
            </div>
          ) : null}
          {item.replies.length > 0 ? (
            <div className="mt-4 space-y-3 border-l border-[var(--app-shell-border)] pl-4">
              {item.replies.map((reply) => (
                <div key={reply.id} className="app-card rounded-[14px] px-3 py-2">
                  <CommentHeader
                    createdAt={reply.createdAt}
                    item={{
                      type: "comment",
                      authorAvatarUrl: reply.authorAvatarUrl,
                      authorLogin: reply.authorLogin,
                      body: reply.body,
                      createdAt: reply.createdAt,
                      id: reply.id,
                      path: null,
                      line: null,
                      replies: [],
                      reviewThreadId: null,
                      url: reply.url,
                    }}
                    locale={locale}
                    t={t}
                    onOpenCommentOnGitHub={onOpenCommentOnGitHub}
                    onViewCommentOnGitHub={onViewCommentOnGitHub}
                    compact
                  />
                  <div className="mt-2">{renderMessageContent(reply.body)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
  }
}

function CommentHeader({
  item,
  locale,
  compact = false,
  onOpenCommentOnGitHub,
  onViewCommentOnGitHub,
  t,
}: {
  compact?: boolean;
  item: PullRequestActivityComment | PullRequestActivityEvent | PullRequestActivityItem & { authorAvatarUrl?: string | null; authorLogin?: string | null };
  locale: string;
  onOpenCommentOnGitHub: (url: string | null) => void;
  onViewCommentOnGitHub: (url: string | null) => void;
  t: ReturnType<typeof useI18n>["t"];
  createdAt: string;
}) {
  const authorLogin =
    "authorLogin" in item && item.authorLogin?.trim().length
      ? item.authorLogin
      : "authorLogin" in item
        ? t("pullRequestsPage.detail.commentUnknownAuthor")
        : t("pullRequestsPage.detail.activityUnknownActor");
  const avatarUrl = "authorAvatarUrl" in item ? item.authorAvatarUrl : null;
  const createdAt = "createdAt" in item ? item.createdAt : "";
  const bodyUrl = "url" in item ? item.url : null;

  return (
    <div className={["flex items-start justify-between gap-3", compact ? "text-[12px]" : "text-[13px]"].join(" ")}>
      <div className="flex min-w-0 items-start gap-3">
        <Avatar avatarUrl={avatarUrl} authorLogin={authorLogin} compact={compact} t={t} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="app-title truncate font-medium">{authorLogin}</span>
            <span className="app-text-muted text-[12px]">{formatRelativeTime(createdAt, locale)}</span>
          </div>
          {bodyUrl ? (
            <button
              type="button"
              onClick={() => onViewCommentOnGitHub(bodyUrl)}
              className="app-text-muted mt-1 text-left text-[12px] hover:underline"
            >
              {t("pullRequestsPage.detail.viewCommentOnGitHub")}
            </button>
          ) : null}
        </div>
      </div>

      {"url" in item && item.url ? (
        <button
          type="button"
          onClick={() => onOpenCommentOnGitHub(item.url)}
          className="app-text-muted shrink-0 text-[12px] hover:underline"
        >
          {t("pullRequestsPage.detail.openCommentOnGitHub")}
        </button>
      ) : null}
    </div>
  );
}

function Avatar({
  avatarUrl,
  authorLogin,
  compact,
  t,
}: {
  avatarUrl: string | null | undefined;
  authorLogin: string;
  compact: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const sizeClass = compact ? "size-6" : "size-7";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={t("pullRequestsPage.detail.commentAuthorAvatarAlt", { author: authorLogin })}
        className={[sizeClass, "shrink-0 rounded-full object-cover"].join(" ")}
      />
    );
  }

  return (
    <div className={[sizeClass, "app-card-muted flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium"].join(" ")}>
      {authorLogin.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ReviewerAvatar({
  reviewer,
}: {
  reviewer: PullRequestReviewer;
}) {
  if (reviewer.avatarUrl) {
    return <img src={reviewer.avatarUrl} alt={reviewer.login} className="size-5 shrink-0 rounded-full object-cover" />;
  }

  return <div className="app-card-muted flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">{reviewer.login.slice(0, 1).toUpperCase()}</div>;
}

function activityItemKey(item: PullRequestActivityItem) {
  switch (item.type) {
    case "event":
      return `${item.type}:${item.event}:${item.createdAt}`;
    case "comment":
    case "review":
    case "review_comment":
      return `${item.type}:${item.id}`;
  }
}

function formatActivityEventLabel(item: PullRequestActivityEvent, t: ReturnType<typeof useI18n>["t"]) {
  switch (item.event) {
    case "approved":
      return t("pullRequestsPage.detail.activityApproved");
    case "changes_requested":
      return t("pullRequestsPage.detail.activityChangesRequested");
    case "merged":
      return t("pullRequestsPage.detail.activityMerged");
    case "opened":
      return t("pullRequestsPage.detail.activityOpened");
    default:
      return t("pullRequestsPage.detail.activityUnknownActor");
  }
}

function formatRelativeTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });

  if (absolute < 60) {
    return formatter.format(deltaSeconds, "second");
  }
  if (absolute < 3_600) {
    return formatter.format(Math.round(deltaSeconds / 60), "minute");
  }
  if (absolute < 86_400) {
    return formatter.format(Math.round(deltaSeconds / 3_600), "hour");
  }
  return formatter.format(Math.round(deltaSeconds / 86_400), "day");
}
