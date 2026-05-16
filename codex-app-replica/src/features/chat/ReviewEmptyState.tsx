import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import { initializeGitRepository } from "../../services/gitInit";
import { emitGitStateChanged } from "../../services/gitStateEvents";

type ReviewEmptyStateProps = {
  gitInitCwd: string | null;
  hasLastTurnDiff?: boolean;
  hostId?: string | null;
  onShowToast?: (toast: AppToast) => void;
  showGitRepoRequired: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function ReviewEmptyState({
  gitInitCwd,
  hasLastTurnDiff = false,
  hostId = null,
  onShowToast,
  showGitRepoRequired,
  t,
}: ReviewEmptyStateProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingGitRepository, setIsCreatingGitRepository] = useState(false);

  useEffect(() => {
    setErrorMessage(null);
    setIsCreatingGitRepository(false);
  }, [gitInitCwd, hostId, showGitRepoRequired]);

  const description = resolveReviewEmptyStateDescription({
    hasLastTurnDiff,
    showGitRepoRequired,
    t,
  });

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-[var(--app-shell-subtle)]">
      <div className="max-w-72 rounded-[18px] border border-dashed border-[var(--app-shell-border)] px-5 py-6">
        <div className="app-title text-[14px] font-medium">
          {showGitRepoRequired ? t("codex.review.noDiff.gitRepoRequired.title") : t("codex.review.noDiff")}
        </div>
        {description ? <div className="mt-2 text-[13px] leading-6">{description}</div> : null}
        {showGitRepoRequired ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            {errorMessage ? (
              <div className="text-[12px] text-[var(--app-shell-danger-text)]">
                {t("codex.review.noDiff.gitInit.error", {
                  message: errorMessage,
                })}
              </div>
            ) : null}
            <Button
              color="secondary"
              size="toolbar"
              disabled={gitInitCwd === null || isCreatingGitRepository}
              loading={isCreatingGitRepository}
              onClick={() => {
                if (gitInitCwd === null || isCreatingGitRepository) {
                  return;
                }

                setErrorMessage(null);
                setIsCreatingGitRepository(true);
                void initializeGitRepository({
                  cwd: gitInitCwd,
                  hostId,
                })
                  .then(() => {
                    emitGitStateChanged();
                    onShowToast?.({
                      message: t("codex.review.noDiff.gitInit.success"),
                      tone: "success",
                    });
                  })
                  .catch((error) => {
                    if (error instanceof Error && error.message.trim().length > 0) {
                      setErrorMessage(error.message.trim());
                      return;
                    }
                    setErrorMessage(String(error));
                  })
                  .finally(() => {
                    setIsCreatingGitRepository(false);
                  });
              }}
            >
              {isCreatingGitRepository
                ? t("codex.review.noDiff.gitInit.creating")
                : t("codex.review.noDiff.gitInit.createRepository")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function resolveReviewEmptyStateDescription({
  hasLastTurnDiff,
  showGitRepoRequired,
  t,
}: {
  hasLastTurnDiff: boolean;
  showGitRepoRequired: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (showGitRepoRequired) {
    return t("codex.review.noDiff.gitRepoRequired.description");
  }

  if (!hasLastTurnDiff) {
    return t("codex.review.noDiff.baseDescription");
  }

  return t("codex.review.noDiff.orNoLongerAvailable");
}
