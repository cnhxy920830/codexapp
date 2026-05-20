import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CollapseAllDiffsIcon,
  CopyPathIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  ExpandAllDiffsIcon,
  MoreActionsIcon,
  OpenFilesIcon,
  RefreshIcon,
  RichPreviewDisabledIcon,
  RichPreviewEnabledIcon,
  WhitespaceIcon,
  WordDiffsEnabledIcon,
  WordDiffsDisabledIcon,
  WrapDisabledIcon,
  WrapEnabledIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";

type PullRequestReviewToolbarProps = {
  isAllDiffsExpanded: boolean;
  isLoadFullFilesEnabled: boolean;
  isRichPreviewEnabled: boolean;
  isSplitDiffEnabled: boolean;
  isWhitespaceHidden: boolean;
  isWordDiffsEnabled: boolean;
  isWrapEnabled: boolean;
  onCopyGitApplyCommand: (() => void | Promise<void>) | null;
  onRefreshCodeReview: () => void;
  onToggleAllDiffsExpanded: () => void;
  onToggleLoadFullFilesEnabled: () => void;
  onToggleRichPreviewEnabled: () => void;
  onToggleWhitespaceHidden: () => void;
  onToggleWordDiffsEnabled: () => void;
  onToggleSplitDiffEnabled: () => void;
  onToggleWrapEnabled: () => void;
  showHideWhitespace?: boolean;
  showLoadFullFiles: boolean;
};

export function PullRequestReviewToolbar({
  isAllDiffsExpanded,
  isLoadFullFilesEnabled,
  isRichPreviewEnabled,
  isSplitDiffEnabled,
  isWhitespaceHidden,
  isWordDiffsEnabled,
  isWrapEnabled,
  onCopyGitApplyCommand,
  onRefreshCodeReview,
  onToggleAllDiffsExpanded,
  onToggleLoadFullFilesEnabled,
  onToggleRichPreviewEnabled,
  onToggleWhitespaceHidden,
  onToggleWordDiffsEnabled,
  onToggleSplitDiffEnabled,
  onToggleWrapEnabled,
  showHideWhitespace = true,
  showLoadFullFiles,
}: PullRequestReviewToolbarProps) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const moreOptionsLabel = t("codex.review.header.moreOptions");
  const refreshCodeReviewLabel = t("codex.review.refreshGitQueries");
  const wrapToggleLabel = isWrapEnabled ? t("codex.review.wrap.disable") : t("codex.review.wrap.enable");
  const expandAllDiffsLabel = isAllDiffsExpanded
    ? t("codex.review.expandOrCollapseDiffMenu.collapse")
    : t("codex.review.expandOrCollapseDiffMenu.expand");
  const splitDiffToggleLabel = isSplitDiffEnabled
    ? t("codex.review.switchToUnified")
    : t("codex.review.switchToSplit");
  const loadFullFilesToggleLabel = isLoadFullFilesEnabled
    ? t("codex.review.loadFullFiles.disable")
    : t("codex.review.loadFullFiles.enable");
  const richPreviewToggleLabel = isRichPreviewEnabled
    ? t("codex.review.richPreview.disable")
    : t("codex.review.richPreview.enable");
  const wordDiffsToggleLabel = isWordDiffsEnabled
    ? t("codex.review.wordDiffs.disable")
    : t("codex.review.wordDiffs.enable");
  const whitespaceToggleLabel = isWhitespaceHidden
    ? t("codex.review.whitespace.show")
    : t("codex.review.whitespace.hide");

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-1 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] p-1">
        <div ref={menuRef} className="relative">
          <ToolbarIconButton
            ariaLabel={moreOptionsLabel}
            hasPopupMenu
            isPressed={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
            title={moreOptionsLabel}
          >
            <MoreActionsIcon className="h-4 w-4" />
          </ToolbarIconButton>

          {isMenuOpen ? (
            <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 min-w-[240px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
              {showLoadFullFiles ? (
                <ReviewOptionsMenuItem
                  icon={<OpenFilesIcon className="h-4 w-4" />}
                  onSelect={() => {
                    onToggleLoadFullFilesEnabled();
                    setIsMenuOpen(false);
                  }}
                >
                  {loadFullFilesToggleLabel}
                </ReviewOptionsMenuItem>
              ) : null}
              <ReviewOptionsMenuItem
                icon={
                  isRichPreviewEnabled ? (
                    <RichPreviewEnabledIcon className="h-4 w-4" />
                  ) : (
                    <RichPreviewDisabledIcon className="h-4 w-4" />
                  )
                }
                onSelect={() => {
                  onToggleRichPreviewEnabled();
                  setIsMenuOpen(false);
                }}
              >
                {richPreviewToggleLabel}
              </ReviewOptionsMenuItem>
              <ReviewOptionsMenuItem
                icon={
                  isWordDiffsEnabled ? (
                    <WordDiffsEnabledIcon className="h-4 w-4" />
                  ) : (
                    <WordDiffsDisabledIcon className="h-4 w-4" />
                  )
                }
                onSelect={() => {
                  onToggleWordDiffsEnabled();
                  setIsMenuOpen(false);
                }}
              >
                {wordDiffsToggleLabel}
              </ReviewOptionsMenuItem>
              {showHideWhitespace ? (
                <ReviewOptionsMenuItem
                  icon={<WhitespaceIcon className="h-4 w-4" />}
                  onSelect={() => {
                    onToggleWhitespaceHidden();
                    setIsMenuOpen(false);
                  }}
                >
                  {whitespaceToggleLabel}
                </ReviewOptionsMenuItem>
              ) : null}
              <ReviewOptionsMenuItem
                disabled={onCopyGitApplyCommand == null}
                icon={<CopyPathIcon className="h-4 w-4" />}
                onSelect={() => {
                  setIsMenuOpen(false);
                  void onCopyGitApplyCommand?.();
                }}
              >
                {t("codex.review.copyGitApplyCommand")}
              </ReviewOptionsMenuItem>
            </div>
          ) : null}
        </div>

        <ToolbarIconButton
          ariaLabel={refreshCodeReviewLabel}
          onClick={onRefreshCodeReview}
          title={refreshCodeReviewLabel}
        >
          <RefreshIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          ariaLabel={wrapToggleLabel}
          isPressed={isWrapEnabled}
          onClick={onToggleWrapEnabled}
          title={wrapToggleLabel}
        >
          {isWrapEnabled ? <WrapEnabledIcon className="h-4 w-4" /> : <WrapDisabledIcon className="h-4 w-4" />}
        </ToolbarIconButton>
        <ToolbarIconButton
          ariaLabel={expandAllDiffsLabel}
          isPressed={isAllDiffsExpanded}
          onClick={onToggleAllDiffsExpanded}
          title={expandAllDiffsLabel}
        >
          {isAllDiffsExpanded ? (
            <CollapseAllDiffsIcon className="h-4 w-4" />
          ) : (
            <ExpandAllDiffsIcon className="h-4 w-4" />
          )}
        </ToolbarIconButton>
        <ToolbarIconButton
          ariaLabel={splitDiffToggleLabel}
          isPressed={isSplitDiffEnabled}
          onClick={onToggleSplitDiffEnabled}
          title={splitDiffToggleLabel}
        >
          {isSplitDiffEnabled ? <DiffUnifiedIcon className="h-4 w-4" /> : <DiffSplitIcon className="h-4 w-4" />}
        </ToolbarIconButton>
      </div>
    </div>
  );
}

function ToolbarIconButton({
  ariaLabel,
  children,
  hasPopupMenu = false,
  isPressed,
  onClick,
  title,
}: {
  ariaLabel: string;
  children: ReactNode;
  hasPopupMenu?: boolean;
  isPressed?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-expanded={hasPopupMenu ? isPressed : undefined}
      aria-haspopup={hasPopupMenu ? "menu" : undefined}
      aria-pressed={hasPopupMenu ? undefined : isPressed}
      onClick={onClick}
      className={[
        "app-topbar-button flex h-8 w-8 items-center justify-center rounded-[10px] border border-transparent transition-colors",
        isPressed === true ? "app-nav-item-active" : "app-nav-item-idle",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ReviewOptionsMenuItem({
  children,
  disabled = false,
  icon,
  onSelect,
}: {
  children: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.()}
      className="app-nav-item-idle flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="shrink-0 text-[var(--app-shell-muted)]">{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}
