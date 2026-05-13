import { useEffect, useMemo, useRef, useState } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import { readGitSettingsSnapshot } from "../../services/gitSettings";
import { openInBrowser } from "../../services/hostFiles";
import type { PullRequestBoardState } from "../../services/pullRequests";
import {
  createRemoteTaskPullRequest,
  getRemoteTaskApplyDiff,
  isTerminalRemoteTaskPullRequestStatus,
  parsePullRequestNumberFromUrl,
  readRemoteTaskTurn,
  resolveRemoteTaskExternalPullRequest,
  resolveRemoteTaskPullRequestAction,
  type RemoteTaskEnvironment,
  type RemoteTask,
  type RemoteTaskTurn,
} from "../../services/remoteTasks";
import { PullRequestStateColorClass, PullRequestStateIcon } from "../pullRequests/PullRequestIcons";
import { RemoteDiffApplyControl } from "./RemoteDiffApplyControl";

const PR_POLL_INTERVAL_MS = 2_000;

type RemoteConversationHeaderActionsProps = {
  onShowToast?: (toast: AppToast) => void;
  selectedTurn: RemoteTaskTurn | null;
  diffTaskTurn: RemoteTaskTurn | null;
  task: RemoteTask | null;
  taskEnvironment: RemoteTaskEnvironment | null;
  taskId: string;
  turns: RemoteTaskTurn[];
  workspaceRoot: string | null;
};

export function RemoteConversationHeaderActions({
  onShowToast,
  selectedTurn,
  diffTaskTurn,
  task,
  taskEnvironment,
  taskId,
  turns,
  workspaceRoot,
}: RemoteConversationHeaderActionsProps) {
  const { t } = useI18n();
  const [createDraftPullRequest, setCreateDraftPullRequest] = useState(true);
  const [createPendingTurnId, setCreatePendingTurnId] = useState<string | null>(null);
  const [isCreateRequestPending, setIsCreateRequestPending] = useState(false);
  const [polledTurn, setPolledTurn] = useState<RemoteTaskTurn | null>(null);
  const pendingOpenRef = useRef(false);
  const failedTurnToastRef = useRef<string | null>(null);
  const normalizedTaskId = taskId.trim();
  const taskUrl =
    normalizedTaskId.length > 0
      ? `https://chatgpt.com/codex/tasks/${encodeURIComponent(normalizedTaskId)}`
      : null;
  const pullRequestAction = useMemo(
    () =>
      resolveRemoteTaskPullRequestAction({
        turns,
        selectedTurn,
        diffTaskTurn,
      }),
    [diffTaskTurn, selectedTurn, turns],
  );
  const actionTurnId = pullRequestAction?.actionTurn.id ?? null;
  const applyDiff = useMemo(
    () =>
      getRemoteTaskApplyDiff({
        selectedTurn,
        diffTaskTurn,
      }),
    [diffTaskTurn, selectedTurn],
  );

  useEffect(() => {
    let cancelled = false;
    void readGitSettingsSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setCreateDraftPullRequest(snapshot.createDraftPullRequest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPolledTurn((current) => (current?.id === actionTurnId ? current : null));
    setCreatePendingTurnId((current) => (current === actionTurnId ? current : null));
    failedTurnToastRef.current = null;
    pendingOpenRef.current = false;
  }, [actionTurnId]);

  const currentTurn =
    polledTurn?.id === actionTurnId ? polledTurn : pullRequestAction?.actionTurn ?? null;
  const currentPullRequestStatus = currentTurn?.pull_request_status ?? null;
  const currentPullRequestUrl = currentTurn?.pull_request_data?.url ?? null;
  const matchedExternalPullRequest = resolveRemoteTaskExternalPullRequest(
    task?.external_pull_requests,
    currentTurn?.id ?? actionTurnId,
    currentPullRequestUrl,
  );
  const effectivePullRequestStatus =
    currentTurn?.pull_request_data?.status ?? matchedExternalPullRequest?.status ?? null;
  const effectivePullRequestNumber =
    currentTurn?.pull_request_data?.number ??
    matchedExternalPullRequest?.number ??
    parsePullRequestNumberFromUrl(currentPullRequestUrl);
  const hasTerminalPullRequestState = isTerminalRemoteTaskPullRequestStatus(
    currentPullRequestStatus,
    currentPullRequestUrl,
  );
  const isActionTurnCompleted = currentTurn?.turn_status === "completed";
  const isCreatePending =
    normalizedTaskId.length > 0 &&
    !!actionTurnId &&
    (isCreateRequestPending ||
      currentPullRequestStatus === "creating" ||
      (createPendingTurnId === actionTurnId && !hasTerminalPullRequestState));

  useEffect(() => {
    if (!normalizedTaskId || !actionTurnId || !isCreatePending) {
      return;
    }

    let cancelled = false;
    const pollTurn = async () => {
      try {
        const response = await readRemoteTaskTurn({
          taskId: normalizedTaskId,
          turnId: actionTurnId,
        });
        if (cancelled) {
          return;
        }
        setPolledTurn(response.turn);
      } catch {
        // Keep polling until the request settles or the component unmounts.
      }
    };

    void pollTurn();
    const intervalId = window.setInterval(() => {
      void pollTurn();
    }, PR_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [actionTurnId, isCreatePending, normalizedTaskId]);

  useEffect(() => {
    if (!currentPullRequestUrl || !pendingOpenRef.current) {
      return;
    }
    pendingOpenRef.current = false;
    setCreatePendingTurnId(null);
    void openInBrowser(currentPullRequestUrl);
  }, [currentPullRequestUrl]);

  useEffect(() => {
    if (createPendingTurnId !== actionTurnId || !hasTerminalPullRequestState) {
      return;
    }
    if (!currentPullRequestUrl) {
      setCreatePendingTurnId(null);
    }
  }, [actionTurnId, createPendingTurnId, currentPullRequestUrl, hasTerminalPullRequestState]);

  useEffect(() => {
    if (!actionTurnId || currentPullRequestStatus !== "failed" || failedTurnToastRef.current === actionTurnId) {
      return;
    }
    failedTurnToastRef.current = actionTurnId;
    pendingOpenRef.current = false;
    setCreatePendingTurnId(null);
    onShowToast?.({
      tone: "error",
      message: t("localConversationPage.createPullRequestError"),
    });
  }, [actionTurnId, currentPullRequestStatus, onShowToast, t]);

  const handleCreatePullRequest = async () => {
    if (!normalizedTaskId || !actionTurnId || !isActionTurnCompleted || isCreatePending) {
      return;
    }

    pendingOpenRef.current = false;
    failedTurnToastRef.current = null;
    setCreatePendingTurnId(actionTurnId);
    setIsCreateRequestPending(true);
    try {
      await createRemoteTaskPullRequest({
        taskId: normalizedTaskId,
        turnId: actionTurnId,
        mode: createDraftPullRequest ? "draft" : null,
      });
      pendingOpenRef.current = true;
    } catch {
      pendingOpenRef.current = false;
      setCreatePendingTurnId(null);
      onShowToast?.({
        tone: "error",
        message: t("localConversationPage.createPullRequestError"),
      });
    } finally {
      setIsCreateRequestPending(false);
    }
  };

  if (!taskUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <RemoteDiffApplyControl
        variant="header"
        diff={applyDiff}
        onShowToast={onShowToast}
        taskEnvironment={taskEnvironment}
        turnId={selectedTurn?.id ?? diffTaskTurn?.id ?? null}
        workspaceRoot={workspaceRoot}
      />
      <button
        type="button"
        title={t("codex.remoteConversation.viewPreviousTurns.buttonTooltip")}
        aria-label={t("codex.remoteConversation.viewPreviousTurns.buttonTooltip")}
        onClick={() => void openInBrowser(taskUrl)}
        className="app-control flex h-8 items-center gap-2 rounded-[11px] px-3 text-[12px]"
      >
        <ArrowTopRightIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{t("codex.remoteConversation.viewPreviousTurns.buttonText")}</span>
      </button>
      <RemotePullRequestButton
        createDraftPullRequest={createDraftPullRequest}
        currentPullRequestNumber={effectivePullRequestNumber}
        currentPullRequestStatus={effectivePullRequestStatus}
        currentPullRequestUrl={currentPullRequestUrl}
        isActionTurnCompleted={isActionTurnCompleted}
        isCreatePending={isCreatePending}
        onClickCreate={handleCreatePullRequest}
        onClickOpen={() => {
          if (!currentPullRequestUrl) {
            return;
          }
          void openInBrowser(currentPullRequestUrl);
        }}
        t={t}
        visible={pullRequestAction?.diffText != null}
      />
    </div>
  );
}

function RemotePullRequestButton({
  createDraftPullRequest,
  currentPullRequestNumber,
  currentPullRequestStatus,
  currentPullRequestUrl,
  isActionTurnCompleted,
  isCreatePending,
  onClickCreate,
  onClickOpen,
  t,
  visible,
}: {
  createDraftPullRequest: boolean;
  currentPullRequestNumber: number | null;
  currentPullRequestStatus: string | null;
  currentPullRequestUrl: string | null;
  isActionTurnCompleted: boolean;
  isCreatePending: boolean;
  onClickCreate: () => void | Promise<void>;
  onClickOpen: () => void | Promise<void>;
  t: ReturnType<typeof useI18n>["t"];
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  if (currentPullRequestUrl) {
    const state = mapRemotePullRequestStatusToBoardState(currentPullRequestStatus);
    return (
      <button
        type="button"
        title={currentPullRequestUrl}
        aria-label={currentPullRequestUrl}
        onClick={() => void onClickOpen()}
        className="app-control flex h-8 shrink-0 items-center gap-2 rounded-[11px] px-3 text-[12px]"
      >
        <PullRequestStateIcon
          className={["h-3.5 w-3.5 shrink-0", PullRequestStateColorClass(state)].join(" ")}
          state={state}
        />
        <span>{currentPullRequestNumber == null ? "PR" : `#${currentPullRequestNumber}`}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!isActionTurnCompleted || isCreatePending}
      onClick={() => void onClickCreate()}
      className="app-control flex h-8 shrink-0 items-center gap-2 rounded-[11px] px-3 text-[12px] disabled:opacity-60"
    >
      {isCreatePending ? <Spinner className="h-3.5 w-3.5 shrink-0" /> : <GitHubMarkIcon className="h-3.5 w-3.5 shrink-0" />}
      <span>
        {isCreatePending
          ? createDraftPullRequest
            ? t("review.commit.loading.title.createDraftPr")
            : t("review.commit.loading.title.createPr")
          : createDraftPullRequest
            ? t("localConversationPage.createDraftPullRequestButtonLabel")
            : t("localConversationPage.createPullRequestButtonLabel")}
      </span>
    </button>
  );
}

function mapRemotePullRequestStatusToBoardState(
  status: string | null,
): PullRequestBoardState {
  switch (status) {
    case "draft":
      return "draft";
    case "merged":
      return "merged";
    default:
      return "ready";
  }
}

function ArrowTopRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14.3349 13.3301V6.60645L5.47065 15.4707C5.21095 15.7304 4.78895 15.7304 4.52925 15.4707C4.26955 15.211 4.26955 14.789 4.52925 14.5293L13.3935 5.66504H6.66011C6.29284 5.66504 5.99507 5.36727 5.99507 5C5.99507 4.63273 6.29284 4.33496 6.66011 4.33496H14.9999L15.1337 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V13.3301C15.6649 13.6973 15.3672 13.9951 14.9999 13.9951C14.6327 13.9951 14.335 13.6973 14.3349 13.3301Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9.99996 2.08002C14.373 2.08002 17.915 5.62198 17.915 9.99502C17.9145 11.6534 17.3941 13.2699 16.4268 14.617C15.4595 15.9641 14.0941 16.9739 12.5229 17.5044C12.1271 17.5835 11.9787 17.3362 11.9787 17.1284C11.9787 16.8613 11.9886 16.0104 11.9886 14.9518C11.9886 14.2098 11.7413 13.7349 11.4543 13.4875C13.2154 13.2896 15.0656 12.6169 15.0656 9.57948C15.0656 8.70883 14.7589 8.00637 14.2543 7.45232C14.3334 7.25445 14.6104 6.44316 14.1751 5.35485C14.1751 5.35485 13.5122 5.13719 11.9985 6.16614C11.3653 5.98805 10.6925 5.899 10.0197 5.899C9.34697 5.899 8.6742 5.98805 8.041 6.16614C6.52726 5.14708 5.86437 5.35485 5.86437 5.35485C5.42905 6.44316 5.70607 7.25445 5.78522 7.45232C5.28064 8.00637 4.97394 8.71872 4.97394 9.57948C4.97394 12.607 6.81417 13.2896 8.57526 13.4875C8.3477 13.6854 8.13994 14.0317 8.07068 14.5461C7.61557 14.7539 6.47779 15.0903 5.76544 13.8932C5.61703 13.6557 5.17181 13.072 4.54851 13.0819C3.88562 13.0918 4.28137 13.4578 4.5584 13.6062C4.89479 13.7942 5.28064 14.4967 5.36969 14.7242C5.52799 15.1694 6.04246 16.0203 8.03111 15.6542C8.03111 16.3171 8.041 16.9404 8.041 17.1284C8.041 17.3362 7.89259 17.5736 7.49684 17.5044C5.92041 16.9796 4.54923 15.9718 3.57782 14.6239C2.60641 13.276 2.08409 11.6565 2.08496 9.99502C2.08496 5.62198 5.62692 2.08002 9.99996 2.08002Z"
        fill="currentColor"
      />
    </svg>
  );
}
