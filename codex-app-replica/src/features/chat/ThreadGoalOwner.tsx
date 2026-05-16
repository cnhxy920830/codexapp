import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  CheckCircleFilledIcon,
  ChevronDownIcon,
  ClockIcon,
  PauseCircleIcon,
  PencilIcon,
  ResumeCircleIcon,
  TrashIcon,
} from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import {
  clearThreadGoal,
  setThreadGoal,
  setThreadGoalStatus,
  type ThreadConversationGoal,
  type ThreadConversationGoalStatus,
} from "../../services/history";

type ThreadGoalOwnerProps = {
  conversationId: string | null;
  draftObjective: string;
  goal: ThreadConversationGoal | null;
  hostId?: string | null;
  isEditorOpen: boolean;
  pendingObjective: string | null;
  onEditorOpenChange: (open: boolean) => void;
  onFocusComposer: () => void;
  onPendingObjectiveChange: (value: string | null) => void;
  onShowToast?: (toast: AppToast) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

type GoalActionState = "clear" | "status" | null;

export function ThreadGoalOwner({
  conversationId,
  draftObjective,
  goal,
  hostId = null,
  isEditorOpen,
  pendingObjective,
  onEditorOpenChange,
  onFocusComposer,
  onPendingObjectiveChange,
  onShowToast,
  t,
}: ThreadGoalOwnerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasExistingGoal = goal !== null || pendingObjective !== null;

  if (isEditorOpen) {
    return (
      <ThreadGoalEditor
        draftObjective={draftObjective}
        initialObjective={goal?.objective ?? pendingObjective ?? ""}
        isEditing={hasExistingGoal}
        isSubmitting={isSubmitting}
        t={t}
        onCancel={() => onEditorOpenChange(false)}
        onSubmit={async (objective) => {
          if (conversationId === null) {
            onPendingObjectiveChange(objective);
            onEditorOpenChange(false);
            onFocusComposer();
            return;
          }

          setIsSubmitting(true);
          try {
            await setThreadGoal({
              hostId,
              threadId: conversationId,
              objective,
            });
            onEditorOpenChange(false);
            onFocusComposer();
          } catch {
            onShowToast?.({
              tone: "error",
              message: t("composer.threadGoal.setError"),
            });
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    );
  }

  if (conversationId !== null && goal !== null) {
    return (
      <ActiveThreadGoalCard
        conversationId={conversationId}
        goal={goal}
        hostId={hostId}
        t={t}
        onEdit={() => onEditorOpenChange(true)}
        onShowToast={onShowToast}
      />
    );
  }

  if (pendingObjective === null) {
    return null;
  }

  return (
    <PendingThreadGoalCard
      objective={pendingObjective}
      t={t}
      onClear={() => onPendingObjectiveChange(null)}
      onEdit={() => onEditorOpenChange(true)}
    />
  );
}

function PendingThreadGoalCard({
  objective,
  t,
  onClear,
  onEdit,
}: {
  objective: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  onClear: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="app-card-muted rounded-[18px]">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CheckCircleIcon className="icon-2xs shrink-0 text-[var(--app-shell-subtle)] opacity-70" />
          <span className="text-size-chat min-w-0 truncate leading-4 text-[var(--app-shell-subtle)]">
            <span className="text-[var(--app-shell-text)]">{t("composer.pendingThreadGoal.summary")}</span>
            <span aria-hidden="true" className="before:mx-1 before:content-['·']" />
            {objective}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GoalIconButton
            ariaLabel={t("composer.pendingThreadGoal.edit")}
            tooltip={t("composer.pendingThreadGoal.editTooltip")}
            onClick={onEdit}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </GoalIconButton>
          <GoalIconButton
            ariaLabel={t("composer.pendingThreadGoal.clear")}
            tooltip={t("composer.pendingThreadGoal.clearTooltip")}
            onClick={onClear}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </GoalIconButton>
        </div>
      </div>
    </div>
  );
}

function ThreadGoalEditor({
  draftObjective,
  initialObjective,
  isEditing,
  isSubmitting,
  t,
  onCancel,
  onSubmit,
}: {
  draftObjective: string;
  initialObjective: string;
  isEditing: boolean;
  isSubmitting: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  onCancel: () => void;
  onSubmit: (objective: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(initialObjective);
  const trimmedDraftObjective = draftObjective.trim();
  const trimmedValue = value.trim();
  const canUseDraft =
    trimmedDraftObjective.length > 0 && trimmedDraftObjective !== trimmedValue;

  return (
    <div className="app-card-muted rounded-[18px]">
      <form
        className="flex flex-col gap-2 px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isSubmitting || trimmedValue.length === 0) {
            return;
          }
          void onSubmit(trimmedValue);
        }}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--app-shell-text)]">
          <CheckCircleIcon className="icon-2xs shrink-0 text-[var(--app-shell-subtle)] opacity-70" />
          <span>
            {isEditing
              ? t("composer.threadGoalEditor.editTitle")
              : t("composer.threadGoalEditor.createTitle")}
          </span>
        </div>
        <textarea
          autoFocus
          rows={2}
          value={value}
          aria-label={t("composer.threadGoalEditor.objectiveAriaLabel")}
          placeholder={t("composer.threadGoalEditor.objectivePlaceholder")}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => {
            if (!isEditing) {
              return;
            }
            const cursorPosition = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(cursorPosition, cursorPosition);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-16 w-full resize-none rounded-xl border border-[var(--app-shell-border)] bg-transparent p-2 text-sm text-[var(--app-shell-text)] outline-none placeholder:text-[var(--app-shell-subtle)] focus:ring-1 focus:ring-[var(--app-shell-accent)]"
        />
        <div className="flex items-center justify-between gap-2">
          <div>
            {canUseDraft ? (
              <button
                type="button"
                className="app-control-weak rounded-full px-2.5 py-1 text-[12px]"
                onClick={() => setValue(trimmedDraftObjective)}
              >
                {t("composer.threadGoalEditor.useDraft")}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              className="app-control rounded-full px-3 py-1.5 text-[12px]"
              onClick={onCancel}
            >
              {t("composer.threadGoalEditor.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || trimmedValue.length === 0}
              className="app-control rounded-full px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {isEditing
                ? t("composer.threadGoalEditor.save")
                : t("composer.threadGoalEditor.set")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ActiveThreadGoalCard({
  conversationId,
  goal,
  hostId,
  t,
  onEdit,
  onShowToast,
}: {
  conversationId: string;
  goal: ThreadConversationGoal;
  hostId: string | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  onEdit: () => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionState, setActionState] = useState<GoalActionState>(null);
  const nextStatus = getNextThreadGoalStatus(goal.status);
  const GoalStatusIcon = getThreadGoalStatusIcon(goal.status);
  const statusSummary = t(getThreadGoalSummaryKey(goal.status));
  const statusLabel = t(getThreadGoalStatusKey(goal.status));
  const elapsedTime = useMemo(
    () => formatThreadGoalDuration(goal.timeUsedSeconds),
    [goal.timeUsedSeconds],
  );
  const formattedTokenUsage = useMemo(() => {
    if (goal.tokenBudget === null) {
      return null;
    }

    return t("composer.threadGoal.tokenUsage", {
      used: formatCompactNumber(goal.tokensUsed),
      budget: formatCompactNumber(goal.tokenBudget),
    });
  }, [goal.tokenBudget, goal.tokensUsed, t]);

  const toggleStatus = async () => {
    if (nextStatus === null) {
      return;
    }

    setActionState("status");
    try {
      await setThreadGoalStatus({
        hostId,
        threadId: conversationId,
        status: nextStatus,
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("composer.threadGoal.statusUpdateError"),
      });
    } finally {
      setActionState(null);
    }
  };

  const clearGoal = async () => {
    setActionState("clear");
    try {
      await clearThreadGoal({
        hostId,
        threadId: conversationId,
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("composer.threadGoal.clearError"),
      });
    } finally {
      setActionState(null);
    }
  };

  return (
    <div className="app-card-muted rounded-[18px]">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-interaction items-center gap-2 text-left"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <GoalStatusIcon className="icon-2xs shrink-0 text-[var(--app-shell-subtle)] opacity-70" />
          {isExpanded ? (
            <span className="text-size-chat min-w-0 truncate leading-4 text-[var(--app-shell-text)]">
              {statusSummary}
            </span>
          ) : (
            <span className="text-size-chat min-w-0 truncate leading-4 text-[var(--app-shell-subtle)]">
              <span className="text-[var(--app-shell-text)]">{statusSummary}</span>
              <span aria-hidden="true" className="before:mx-1 before:content-['·']" />
              {goal.objective}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <GoalIconButton
            ariaLabel={t("composer.threadGoal.edit")}
            tooltip={t("composer.threadGoal.editTooltip")}
            disabled={actionState !== null}
            onClick={onEdit}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </GoalIconButton>
          {nextStatus !== null ? (
            <GoalIconButton
              ariaLabel={
                nextStatus === "paused"
                  ? t("composer.threadGoal.pause")
                  : t("composer.threadGoal.resume")
              }
              tooltip={
                nextStatus === "paused"
                  ? t("composer.threadGoal.pauseTooltip")
                  : t("composer.threadGoal.resumeTooltip")
              }
              disabled={actionState !== null}
              onClick={() => void toggleStatus()}
            >
              {nextStatus === "paused" ? (
                <PauseCircleIcon className="h-3.5 w-3.5" />
              ) : (
                <ResumeCircleIcon className="h-3.5 w-3.5" />
              )}
            </GoalIconButton>
          ) : null}
          <GoalIconButton
            ariaLabel={t("composer.threadGoal.clear")}
            tooltip={t("composer.threadGoal.clearTooltip")}
            disabled={actionState !== null}
            onClick={() => void clearGoal()}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </GoalIconButton>
          <GoalIconButton
            ariaLabel={
              isExpanded ? t("composer.threadGoal.collapse") : t("composer.threadGoal.expand")
            }
            tooltip={
              isExpanded ? t("composer.threadGoal.collapse") : t("composer.threadGoal.expand")
            }
            onClick={() => setIsExpanded((current) => !current)}
          >
            <ChevronDownIcon
              className={[
                "icon-2xs shrink-0 text-current transition-transform duration-300",
                isExpanded ? "rotate-90" : "",
              ].join(" ")}
            />
          </GoalIconButton>
        </div>
      </div>
      <div
        className={isExpanded ? "overflow-visible" : "overflow-hidden"}
        style={{ pointerEvents: isExpanded ? "auto" : "none" }}
      >
        <div
          className="flex flex-col gap-2 px-3 pt-0.5 pb-3"
          style={{
            height: isExpanded ? "auto" : 0,
            opacity: isExpanded ? 1 : 0,
            transition: "height 180ms ease, opacity 180ms ease",
          }}
        >
          <div className="text-sm text-[var(--app-shell-text)]">{goal.objective}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--app-shell-subtle)]">
            <span>{statusLabel}</span>
            <ThreadGoalDot />
            <span>{elapsedTime}</span>
            {formattedTokenUsage === null ? null : (
              <>
                <ThreadGoalDot />
                <span>{formattedTokenUsage}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalIconButton({
  ariaLabel,
  children,
  disabled = false,
  onClick,
  tooltip,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <ComposerTooltip align="start" content={tooltip}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        className="app-thread-composer-footer-icon-button"
      >
        {children}
      </button>
    </ComposerTooltip>
  );
}

function ComposerTooltip({
  align = "center",
  children,
  content,
  contentClassName = "",
  wrapperClassName = "",
}: {
  align?: "center" | "end" | "start";
  children: ReactNode;
  content: ReactNode;
  contentClassName?: string;
  wrapperClassName?: string;
}) {
  const alignmentClassName =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className={["group relative", wrapperClassName || "flex shrink-0 items-center"].join(" ")}>
      {children}
      <div
        className={[
          "pointer-events-none absolute bottom-full z-20 mb-2 hidden rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block",
          alignmentClassName,
          contentClassName,
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}

function ThreadGoalDot() {
  return <span aria-hidden="true" className="before:content-['·']" />;
}

function getNextThreadGoalStatus(
  status: ThreadConversationGoalStatus,
): ThreadConversationGoalStatus | null {
  switch (status) {
    case "active":
      return "paused";
    case "paused":
      return "active";
    case "budgetLimited":
    case "complete":
      return null;
  }
}

function getThreadGoalStatusIcon(status: ThreadConversationGoalStatus) {
  switch (status) {
    case "active":
      return CheckCircleIcon;
    case "paused":
      return PauseCircleIcon;
    case "budgetLimited":
      return ClockIcon;
    case "complete":
      return CheckCircleFilledIcon;
  }
}

function getThreadGoalSummaryKey(status: ThreadConversationGoalStatus): MessageKey {
  switch (status) {
    case "active":
      return "composer.threadGoal.summary.active";
    case "paused":
      return "composer.threadGoal.summary.paused";
    case "budgetLimited":
      return "composer.threadGoal.summary.budgetLimited";
    case "complete":
      return "composer.threadGoal.summary.complete";
  }
}

function getThreadGoalStatusKey(status: ThreadConversationGoalStatus): MessageKey {
  switch (status) {
    case "active":
      return "composer.threadGoal.status.active";
    case "paused":
      return "composer.threadGoal.status.paused";
    case "budgetLimited":
      return "composer.threadGoal.status.budgetLimited";
    case "complete":
      return "composer.threadGoal.status.complete";
  }
}

function formatThreadGoalDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const parts = [`${hours}h`];
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }
  return parts.join(" ");
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
