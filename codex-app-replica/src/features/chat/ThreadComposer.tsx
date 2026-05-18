import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircleFilledIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CheckIcon,
  CloseTabIcon,
  DefaultPermissionsIcon,
  FullAccessPermissionsIcon,
  GuardianApprovalsIcon,
  PlusIcon,
  SearchIcon,
  SettingsCogIcon,
} from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import {
  getComposerModifierLabel,
  shouldInvertFollowUpOnEnter,
} from "../../lib/followUpShortcuts";
import { initializeGitRepository } from "../../services/gitInit";
import { emitGitStateChanged } from "../../services/gitStateEvents";
import type {
  ThreadConversationGoal,
  ThreadConversationTokenUsageInfo,
} from "../../services/history";
import type {
  ComposerEnterBehavior,
  ConfigSnapshot,
  FollowUpQueueMode,
  ReviewDelivery,
} from "../../services/settings";
import {
  getVisibleHotkeyPermissionOptions,
  getHotkeyPermissionOptionValue,
  getNextAgentModeFromOption,
  isDefaultPermissionsMode,
  type HotkeyPermissionAgentMode,
  type HotkeyPermissionOptionValue,
  type HotkeyPermissionsState,
} from "../hotkeyWindow/hotkeyPermissionsMode";
import type { PendingPdfCommentAttachment } from "./pdfCommentAttachments";
import { PendingPdfCommentAttachmentStrip } from "./PendingPdfCommentAttachmentStrip";
import { ThreadComposerBranchSwitcher } from "./ThreadComposerBranchSwitcher";

type ThreadComposerProps = {
  activeCollaborationMode?: string | null;
  aboveComposerHeaderContent?: ReactNode;
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  conversationId?: string | null;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  focusComposerNonce?: number | null;
  followUpQueueMode: FollowUpQueueMode;
  isResponseInProgress?: boolean;
  isWorktreeThread: boolean;
  authMethod?: string | null;
  latestTokenUsageInfo?: ThreadConversationTokenUsageInfo | null;
  layoutMode?: "multiline" | "auto-single-line";
  pendingPdfComments?: PendingPdfCommentAttachment[];
  pendingPdfCommentCount?: number;
  pendingThreadGoalObjective?: string | null;
  placement?: "main" | "side";
  reviewDelivery: ReviewDelivery;
  threadBranchLabel?: string | null;
  threadGoal?: ThreadConversationGoal | null;
  onShowToast?: (toast: AppToast) => void;
  onComposerDraftChange: (value: string) => void;
  onComposerCollaborationModeChange?: (mode: "default" | "plan" | null) => void;
  onComposerPermissionModeChange: (mode: HotkeyPermissionAgentMode) => void;
  onClearPendingPdfComments?: (() => void) | null;
  onOpenThreadGoalEditor?: (() => void) | null;
  onOpenSideChat?: ((initialPrompt?: string | null) => Promise<boolean> | boolean) | null;
  onOpenWorkspaceFileSearch?: (() => void) | null;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadGitRoot?: string | null;
  threadHostId?: string | null;
  threadCwd: string | null;
  turnError: string | null;
};

type PermissionOption = {
  disabled: boolean;
  label: string;
  tooltip: string;
  value: HotkeyPermissionOptionValue;
};

type ThreadComposerSuggestionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type DismissedSuggestionsByScope = Record<string, string[]>;

const PLAN_KEYWORD_SUGGESTION_ID = "keyword-plan-mode";
const NEW_THREAD_SUGGESTION_SCOPE_KEY = "__new-thread__";
const THREAD_COMPOSER_DISMISSED_SUGGESTIONS_STORAGE_KEY =
  "codex:thread-composer-dismissed-suggestions";

export function buildThreadComposerPermissionOptions(params: {
  composerPermissionsState: HotkeyPermissionsState;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const defaultPermissionsTooltip = params.t("composer.permissionsDropdown.default.tooltip");
  const guardianPermissionsTooltip = params.t("composer.permissionsDropdown.guardianApproval.tooltip");
  const guardianDisabledTooltip = params.t("composer.permissionsDropdown.guardianApproval.disabled");
  const fullAccessPermissionsTooltip = params.t("composer.permissionsDropdown.agentMode.tooltip.fullAccess");
  const fullAccessDisabledTooltip =
    params.composerPermissionsState.fullAccessDisabledReason === "global-default"
      ? params.t("composer.permissionsDropdown.fullAccess.disabledGlobalDefault")
      : params.t("composer.permissionsDropdown.fullAccess.disabled");
  const customPermissionsTooltip = params.t("composer.permissionsDropdown.agentMode.tooltip.custom");
  const options: PermissionOption[] = [];

  for (const option of getVisibleHotkeyPermissionOptions(params.composerPermissionsState)) {
    switch (option.value) {
      case "default":
        options.push({
          disabled: option.disabled,
          label: params.t("composer.permissionsDropdown.default.optionLabel"),
          tooltip: defaultPermissionsTooltip,
          value: option.value,
        });
        break;
      case "guardian-approvals":
        options.push({
          disabled: option.disabled,
          label: params.t("composer.mode.agentMode.guardianApprovals"),
          tooltip: option.disabled ? guardianDisabledTooltip : guardianPermissionsTooltip,
          value: option.value,
        });
        break;
      case "full-access":
        options.push({
          disabled: option.disabled,
          label: params.t("composer.permissionsDropdown.fullAccess.optionLabel"),
          tooltip: option.disabled ? fullAccessDisabledTooltip : fullAccessPermissionsTooltip,
          value: option.value,
        });
        break;
      case "custom":
        options.push({
          disabled: option.disabled,
          label: params.t("composer.permissionsDropdown.custom.optionLabel"),
          tooltip: customPermissionsTooltip,
          value: option.value,
        });
        break;
    }
  }

  return options;
}

export function parseSideChatCommandDraft(draft: string) {
  const match = /^\s*\/side(?:\s+([\s\S]*?))?\s*$/u.exec(draft);
  if (match == null) {
    return null;
  }

  return match[1]?.trim() ?? "";
}

export function getThreadComposerSuggestionScopeKey(
  conversationId: string | null | undefined,
) {
  const trimmedConversationId = conversationId?.trim() ?? "";
  return trimmedConversationId.length > 0
    ? trimmedConversationId
    : NEW_THREAD_SUGGESTION_SCOPE_KEY;
}

export function readThreadComposerDismissedSuggestionIds(
  storage: ThreadComposerSuggestionStorage | null | undefined,
  conversationId: string | null | undefined,
) {
  if (storage == null) {
    return [];
  }

  const rawState = storage.getItem(THREAD_COMPOSER_DISMISSED_SUGGESTIONS_STORAGE_KEY);
  if (rawState == null) {
    return [];
  }

  try {
    const parsedState = JSON.parse(rawState) as unknown;
    if (
      typeof parsedState !== "object" ||
      parsedState === null ||
      Array.isArray(parsedState)
    ) {
      return [];
    }
    const parsedStateRecord = parsedState as Record<string, unknown>;
    const dismissedSuggestionIds =
      parsedStateRecord[getThreadComposerSuggestionScopeKey(conversationId)];
    if (!Array.isArray(dismissedSuggestionIds)) {
      return [];
    }
    return dismissedSuggestionIds.filter(
      (dismissedSuggestionId): dismissedSuggestionId is string =>
        typeof dismissedSuggestionId === "string",
    );
  } catch {
    return [];
  }
}

export function writeThreadComposerDismissedSuggestionIds(
  storage: ThreadComposerSuggestionStorage | null | undefined,
  conversationId: string | null | undefined,
  dismissedSuggestionIds: string[],
) {
  if (storage == null) {
    return;
  }

  let parsedState: DismissedSuggestionsByScope = {};
  const rawState = storage.getItem(THREAD_COMPOSER_DISMISSED_SUGGESTIONS_STORAGE_KEY);
  if (rawState != null) {
    try {
      const nextParsedState = JSON.parse(rawState) as unknown;
      if (
        typeof nextParsedState === "object" &&
        nextParsedState !== null &&
        !Array.isArray(nextParsedState)
      ) {
        parsedState = Object.fromEntries(
          Object.entries(nextParsedState).map(([scopeKey, value]) => [
            scopeKey,
            Array.isArray(value)
              ? value.filter(
                  (dismissedSuggestionId): dismissedSuggestionId is string =>
                    typeof dismissedSuggestionId === "string",
                )
              : [],
          ]),
        );
      }
    } catch {
      parsedState = {};
    }
  }

  const scopeKey = getThreadComposerSuggestionScopeKey(conversationId);
  if (dismissedSuggestionIds.length === 0) {
    delete parsedState[scopeKey];
  } else {
    parsedState[scopeKey] = dismissedSuggestionIds;
  }

  storage.setItem(
    THREAD_COMPOSER_DISMISSED_SUGGESTIONS_STORAGE_KEY,
    JSON.stringify(parsedState),
  );
}

export function shouldShowThreadComposerPlanKeywordSuggestion(params: {
  composerDraft: string;
  isDismissed: boolean;
  isPlanCollaborationMode: boolean;
  supportsPlanModeToggle: boolean;
}) {
  return (
    params.supportsPlanModeToggle &&
    !params.isPlanCollaborationMode &&
    !params.isDismissed &&
    /\bplan\b/iu.test(params.composerDraft)
  );
}

function getThreadComposerSuggestionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ThreadComposer({
  activeCollaborationMode = null,
  aboveComposerHeaderContent = null,
  composerDraft,
  composerEnterBehavior,
  conversationId = null,
  composerPermissionMode,
  composerPermissionsState,
  focusComposerNonce,
  followUpQueueMode,
  isResponseInProgress = false,
  authMethod = null,
  latestTokenUsageInfo = null,
  layoutMode = "multiline",
  pendingPdfComments = [],
  pendingPdfCommentCount = 0,
  pendingThreadGoalObjective = null,
  placement = "main",
  threadBranchLabel = null,
  threadGoal = null,
  onShowToast,
  onComposerDraftChange,
  onComposerCollaborationModeChange,
  onComposerPermissionModeChange,
  onClearPendingPdfComments = null,
  onOpenThreadGoalEditor = null,
  onOpenSideChat = null,
  onOpenWorkspaceFileSearch = null,
  onStopTurn,
  onSubmitTurn,
  submitButtonMode,
  t,
  threadGitRoot = null,
  threadHostId = null,
  threadCwd,
  turnError,
}: ThreadComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const permissionMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPermissionMenuOpen, setIsPermissionMenuOpen] = useState(false);
  const [isFullAccessConfirmOpen, setIsFullAccessConfirmOpen] = useState(false);
  const [isCreatingGitRepository, setIsCreatingGitRepository] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState(() =>
    readThreadComposerDismissedSuggestionIds(
      getThreadComposerSuggestionStorage(),
      conversationId,
    ),
  );
  const composerModifierLabel = getComposerModifierLabel();
  const isAutoSingleLineLayout = layoutMode === "auto-single-line";
  const helperText =
    composerEnterBehavior === "cmdIfMultiline"
      ? t("general.enterBehaviorDescription", { modifierSymbol: composerModifierLabel })
      : "";
  const resolvedPendingPdfCommentCount =
    pendingPdfComments.length > 0 ? pendingPdfComments.length : pendingPdfCommentCount;
  const isSubmitDisabled =
    submitButtonMode === "send" &&
    composerDraft.trim().length === 0 &&
    resolvedPendingPdfCommentCount === 0;
  const canOpenSideChat = onOpenSideChat !== null;
  const isSidePlacement = placement === "side";
  const hasThreadGoal = threadGoal !== null || pendingThreadGoalObjective !== null;
  const canOpenThreadGoalEditor = placement === "main" && onOpenThreadGoalEditor !== null;
  const permissionMenuValue = getHotkeyPermissionOptionValue(composerPermissionMode);
  const permissionTriggerLabel = isDefaultPermissionsMode(composerPermissionMode)
    ? t("composer.permissionsDropdown.default.label")
    : composerPermissionMode === "guardian-approvals"
      ? t("composer.permissionsDropdown.guardianApproval.shortLabel")
      : composerPermissionMode === "full-access"
        ? t("composer.permissionsDropdown.fullAccess.label")
        : t("composer.permissionsDropdown.custom.label");
  const permissionTriggerTooltip = t("composer.permissionsDropdown.trigger.tooltip");
  const disabledPermissionsTooltip = t("composer.permissionsDropdown.disabled.requirements");
  const permissionOptions = useMemo(() => {
    return buildThreadComposerPermissionOptions({
      composerPermissionsState,
      t,
    });
  }, [composerPermissionsState, t]);
  const permissionMenuTooltip =
    composerPermissionsState.isDropdownDisabled
      ? disabledPermissionsTooltip
      : permissionTriggerTooltip;
  const helperOrStatusText = turnError ?? (helperText.length > 0 ? helperText : null);
  const normalizedThreadBranchLabel =
    threadBranchLabel !== null && threadBranchLabel.trim().length > 0 ? threadBranchLabel.trim() : null;
  const canCreateGitRepository =
    placement === "main" && threadCwd !== null && threadGitRoot === null;
  const contextWindowUsage = useMemo(
    () => getContextWindowUsageInfo(latestTokenUsageInfo),
    [latestTokenUsageInfo],
  );
  const shouldShowAutoCompactionHint = authMethod === "chatgpt";
  const contextWindowTooltipContent = useMemo(
    () =>
      contextWindowUsage === null
        ? null
        : getContextWindowTooltipContent({
            contextWindowUsage,
            shouldShowAutoCompactionHint,
            t,
          }),
    [contextWindowUsage, shouldShowAutoCompactionHint, t],
  );
  const permissionTriggerIcon =
    composerPermissionMode === "guardian-approvals"
      ? GuardianApprovalsIcon
      : composerPermissionMode === "full-access"
        ? FullAccessPermissionsIcon
        : composerPermissionMode === "custom"
          ? SettingsCogIcon
          : DefaultPermissionsIcon;
  const PermissionTriggerIcon = permissionTriggerIcon;
  const submitButtonTooltipContent = useMemo(
    () =>
      getSubmitButtonTooltipContent({
        composerEnterBehavior,
        composerModifierLabel,
        followUpQueueMode,
        isResponseInProgress,
        submitButtonMode,
        t,
      }),
    [
      composerEnterBehavior,
      composerModifierLabel,
      followUpQueueMode,
      submitButtonMode,
      t,
    ],
  );
  const submitButtonAriaLabel =
    submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send");
  const isPlanCollaborationMode = activeCollaborationMode === "plan";
  const supportsPlanModeToggle = onComposerCollaborationModeChange != null;
  const isPlanKeywordSuggestionDismissed = dismissedSuggestionIds.includes(
    PLAN_KEYWORD_SUGGESTION_ID,
  );
  const goalTriggerTooltip = hasThreadGoal
    ? t("composer.threadGoal.editTooltip")
    : t("composer.threadGoalEditor.createTitle");
  const GoalTriggerIcon = hasThreadGoal ? CheckCircleFilledIcon : CheckCircleIcon;
  const goalTriggerLabel =
    threadGoal === null
      ? t("composer.threadGoal.summary.active")
      : threadGoal.status === "paused"
        ? t("composer.threadGoal.summary.paused")
        : threadGoal.status === "budgetLimited"
          ? t("composer.threadGoal.summary.budgetLimited")
          : threadGoal.status === "complete"
            ? t("composer.threadGoal.summary.complete")
            : t("composer.threadGoal.summary.active");
  const shouldShowPlanKeywordSuggestion =
    shouldShowThreadComposerPlanKeywordSuggestion({
      composerDraft,
      isDismissed: isPlanKeywordSuggestionDismissed,
      isPlanCollaborationMode,
      supportsPlanModeToggle,
    });

  const updateDismissedSuggestionIds = (
    updater: (current: string[]) => string[],
  ) => {
    setDismissedSuggestionIds((current) => {
      const next = updater(current);
      writeThreadComposerDismissedSuggestionIds(
        getThreadComposerSuggestionStorage(),
        conversationId,
        next,
      );
      return next;
    });
  };

  const handleOpenSideChat = async () => {
    if (!canOpenSideChat) {
      return false;
    }

    const sidePrompt = parseSideChatCommandDraft(composerDraft);
    if (sidePrompt === null) {
      return false;
    }

    const didOpen = await onOpenSideChat?.(sidePrompt);
    if (!didOpen) {
      return true;
    }

    onComposerDraftChange("");
    textareaRef.current?.focus();
    return true;
  };

  const handleCreateGitRepository = async () => {
    if (!canCreateGitRepository || isCreatingGitRepository) {
      return;
    }

    setIsCreatingGitRepository(true);
    try {
      await initializeGitRepository({
        cwd: threadCwd,
        hostId: threadHostId,
      });
      emitGitStateChanged();
      onShowToast?.({
        message: t("codex.review.noDiff.gitInit.success"),
        tone: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : String(error);
      onShowToast?.({
        message: t("codex.review.noDiff.gitInit.error", { message }),
        tone: "error",
      });
    } finally {
      setIsCreatingGitRepository(false);
    }
  };

  const handleTogglePlanMode = () => {
    if (!supportsPlanModeToggle) {
      return;
    }

    onComposerCollaborationModeChange?.(isPlanCollaborationMode ? "default" : "plan");
  };

  const handleEnablePlanMode = () => {
    onComposerCollaborationModeChange?.("plan");
    updateDismissedSuggestionIds((current) =>
      current.includes(PLAN_KEYWORD_SUGGESTION_ID)
        ? current
        : [...current, PLAN_KEYWORD_SUGGESTION_ID],
    );
  };

  const handleDismissPlanKeywordSuggestion = () => {
    updateDismissedSuggestionIds((current) =>
      current.includes(PLAN_KEYWORD_SUGGESTION_ID)
        ? current
        : [...current, PLAN_KEYWORD_SUGGESTION_ID],
    );
  };

  const handlePermissionOptionChange = (value: HotkeyPermissionOptionValue) => {
    setIsPermissionMenuOpen(false);
    if (value === "full-access") {
      setIsFullAccessConfirmOpen(true);
      return;
    }

    onComposerPermissionModeChange(
      getNextAgentModeFromOption({
        defaultAgentMode: composerPermissionsState.defaultAgentMode,
        option: value,
      }),
    );
  };

  useEffect(() => {
    if (focusComposerNonce == null) {
      return;
    }

    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  }, [focusComposerNonce]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }

    if (!isAutoSingleLineLayout) {
      textarea.style.removeProperty("height");
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 144)}px`;
  }, [composerDraft, isAutoSingleLineLayout]);

  useEffect(() => {
    if (!isPermissionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (permissionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsPermissionMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPermissionMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPermissionMenuOpen]);

  useEffect(() => {
    setDismissedSuggestionIds(
      readThreadComposerDismissedSuggestionIds(
        getThreadComposerSuggestionStorage(),
        conversationId,
      ),
    );
  }, [conversationId]);

  const shouldShowAttachmentStrip = resolvedPendingPdfCommentCount > 0;

  return (
    <>
      <div className="app-thread-composer overflow-visible rounded-[26px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] shadow-[var(--app-shell-card-shadow)]">
        {shouldShowAttachmentStrip ? (
          <PendingPdfCommentAttachmentStrip
            pendingPdfCommentCount={resolvedPendingPdfCommentCount}
            pendingPdfComments={pendingPdfComments}
            onClearPendingPdfComments={onClearPendingPdfComments}
            t={t}
          />
        ) : null}

        {aboveComposerHeaderContent ? (
          <div className="px-3 pt-3 pb-1.5">
            {aboveComposerHeaderContent}
          </div>
        ) : null}

        <div className={shouldShowAttachmentStrip ? "px-4 pt-2.5 pb-2.5" : "px-4 pt-3 pb-2.5"}>
          <textarea
            ref={textareaRef}
            value={composerDraft}
            onChange={(event) => onComposerDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Tab" &&
                event.shiftKey &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                supportsPlanModeToggle
              ) {
                event.preventDefault();
                handleTogglePlanMode();
                return;
              }
              if (event.key !== "Enter") {
                return;
              }
              const shouldInvertFollowUp = shouldInvertFollowUpOnEnter({
                altKey: event.altKey,
                composerEnterBehavior,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
              });
              const hasMultilineContent = composerDraft.includes("\n");
              if (shouldInvertFollowUp) {
                event.preventDefault();
                onSubmitTurn(true);
                return;
              }
              if (event.shiftKey) {
                return;
              }
              if (composerEnterBehavior === "enter" || !hasMultilineContent) {
                event.preventDefault();
                void handleOpenSideChat().then((didOpenSideChat) => {
                  if (!didOpenSideChat) {
                    onSubmitTurn();
                  }
                });
              }
            }}
            rows={isAutoSingleLineLayout ? 1 : 4}
            placeholder={t("app.chat.composePlaceholder")}
            className={[
              "app-text-input w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed",
              isAutoSingleLineLayout
                ? "min-h-[44px] overflow-y-auto"
                : isSidePlacement
                  ? "min-h-[104px]"
                  : "min-h-[112px]",
            ].join(" ")}
          />
          {shouldShowPlanKeywordSuggestion ? (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-[24px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              <div className="min-w-0 flex-1">
                <div className="app-title truncate text-[14px] font-medium">
                  {t("composer.aboveSuggestion.plan.title")}
                </div>
                <div className="app-text-muted mt-1 flex items-center gap-1.5 text-[12px] leading-4">
                  <span className="app-thread-composer-footer-shortcut-badge">
                    {t("composer.aboveSuggestion.plan.shortcut")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleEnablePlanMode}
                  className="app-thread-composer-footer-pill shrink-0 px-2.5 text-[12px] text-[var(--app-shell-accent)]"
                >
                  {t("composer.aboveSuggestion.plan.action")}
                </button>
                <button
                  type="button"
                  aria-label={t("composer.aboveSuggestion.dismiss")}
                  onClick={handleDismissPlanKeywordSuggestion}
                  className="app-control-weak flex h-[22px] w-[22px] items-center justify-center rounded-full"
                >
                  <CloseTabIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-[var(--app-shell-border)] pt-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {canOpenThreadGoalEditor ? (
                <ComposerTooltip align="start" content={goalTriggerTooltip}>
                  <button
                    type="button"
                    onClick={() => onOpenThreadGoalEditor?.()}
                    className="app-thread-composer-footer-pill inline-flex items-center gap-1.5"
                    aria-label={goalTriggerTooltip}
                  >
                    <GoalTriggerIcon className="h-4 w-4 shrink-0" />
                    <span>{goalTriggerLabel}</span>
                  </button>
                </ComposerTooltip>
              ) : null}
              {isPlanCollaborationMode ? (
                <ComposerTooltip
                  align="start"
                  contentClassName="flex flex-col items-center text-center leading-tight"
                  content={
                    <>
                      <span>{t("composer.planModeIndicator.tooltipText")}</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="app-thread-composer-footer-shortcut-badge">
                          {t("composer.planModeIndicator.tooltipShortcut")}
                        </span>
                        <span>{t("composer.planModeIndicator.tooltipToggle")}</span>
                      </span>
                    </>
                  }
                >
                  <button
                    type="button"
                    onClick={handleTogglePlanMode}
                    className="app-thread-composer-footer-pill group inline-flex max-w-[96px] items-center gap-1 text-[var(--app-shell-accent)] hover:bg-[color-mix(in_srgb,var(--app-shell-accent)_12%,transparent)]"
                    aria-label={t("composer.planModeIndicator")}
                  >
                    <span aria-hidden="true" className="group-hover:hidden">
                      ↹
                    </span>
                    <span aria-hidden="true" className="hidden group-hover:inline">
                      →
                    </span>
                    <span className="truncate text-[12px]">{t("composer.planModeIndicator")}</span>
                  </button>
                </ComposerTooltip>
              ) : null}
              <div className="relative" ref={permissionMenuRef}>
                <ComposerTooltip
                  align="start"
                  contentClassName="max-w-[260px] text-left whitespace-pre-line"
                  content={sanitizeTooltipText(permissionMenuTooltip)}
                >
                  <button
                    type="button"
                    disabled={composerPermissionsState.isDropdownDisabled}
                    onClick={() => setIsPermissionMenuOpen((current) => !current)}
                    className={[
                      "app-thread-composer-pill",
                      isPermissionMenuOpen ? "app-thread-composer-pill-active" : "",
                    ].join(" ")}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {permissionTriggerIcon === FullAccessPermissionsIcon ? (
                        <PermissionTriggerIcon className="h-4 w-4 text-[var(--app-shell-warning-text)]" />
                      ) : permissionTriggerIcon === GuardianApprovalsIcon ? (
                        <PermissionTriggerIcon className="h-4 w-4 text-[var(--app-shell-accent)]" />
                      ) : (
                        <PermissionTriggerIcon className="h-4 w-4" />
                      )}
                    </span>
                    <span>{permissionTriggerLabel}</span>
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>
                </ComposerTooltip>
                {isPermissionMenuOpen ? (
                  <div className="app-card absolute right-0 bottom-[calc(100%+10px)] z-20 min-w-[236px] rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                    {permissionOptions.map((option) => {
                      const selected = option.value === permissionMenuValue;
                      const OptionIcon =
                        option.value === "guardian-approvals"
                          ? GuardianApprovalsIcon
                          : option.value === "full-access"
                            ? FullAccessPermissionsIcon
                            : option.value === "custom"
                              ? SettingsCogIcon
                              : DefaultPermissionsIcon;
                      return (
                        <ComposerTooltip
                          key={option.value}
                          align="start"
                          wrapperClassName="block"
                          contentClassName="max-w-[260px] text-left whitespace-pre-line"
                          content={sanitizeTooltipText(option.tooltip)}
                        >
                          <button
                            type="button"
                            disabled={option.disabled}
                            onClick={() => handlePermissionOptionChange(option.value)}
                            className="app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-pressed={selected}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                                {option.value === "full-access" ? (
                                  <OptionIcon className="h-4 w-4 text-[var(--app-shell-warning-text)]" />
                                ) : option.value === "guardian-approvals" ? (
                                  <OptionIcon className="h-4 w-4 text-[var(--app-shell-accent)]" />
                                ) : (
                                  <OptionIcon className="h-4 w-4" />
                                )}
                              </span>
                              <span className="min-w-0 truncate">{option.label}</span>
                            </span>
                            <CheckIcon
                              className={[
                                "h-3.5 w-3.5 shrink-0",
                                selected ? "" : "invisible",
                              ].join(" ")}
                            />
                          </button>
                        </ComposerTooltip>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {onOpenWorkspaceFileSearch !== null ? (
                <button
                  type="button"
                  onClick={onOpenWorkspaceFileSearch}
                  className="app-thread-composer-footer-pill inline-flex items-center gap-1.5"
                >
                  <SearchIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("thread.sidePanel.openFile")}</span>
                </button>
              ) : null}
              {placement === "main" && threadGitRoot !== null ? (
                <ThreadComposerBranchSwitcher
                  fallbackBranchLabel={normalizedThreadBranchLabel}
                  gitRoot={threadGitRoot}
                  hostId={threadHostId}
                  t={t}
                />
              ) : canCreateGitRepository ? (
                <button
                  type="button"
                  disabled={isCreatingGitRepository}
                  onClick={() => void handleCreateGitRepository()}
                  className="app-thread-composer-footer-pill inline-flex max-w-[220px] items-center gap-1.5 disabled:opacity-60"
                >
                  <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {isCreatingGitRepository
                      ? t("codex.review.noDiff.gitInit.creating")
                      : t("codex.review.noDiff.gitInit.createRepository")}
                  </span>
                </button>
              ) : normalizedThreadBranchLabel ? (
                <div className="app-thread-composer-footer-pill max-w-[220px]">
                  <span className="truncate">
                    {t("composer.remote.currentBranch", { branch: normalizedThreadBranchLabel })}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <div
                className={[
                  turnError ? "app-text-error" : "app-text-subtle",
                  isSidePlacement
                    ? "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5 text-right"
                    : "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5 text-right",
                ].join(" ")}
              >
                {helperOrStatusText}
              </div>
              {contextWindowTooltipContent === null || contextWindowUsage === null ? null : (
                <ComposerTooltip
                  contentClassName="flex w-38 flex-col gap-0.5 text-center"
                  content={
                    <div className="flex flex-col gap-0.5 text-center">
                      <div>{contextWindowTooltipContent.label}</div>
                      <div>{contextWindowTooltipContent.status}</div>
                      <div>{contextWindowTooltipContent.usage}</div>
                      {contextWindowTooltipContent.autoCompactionHint === null ? null : (
                        <div>{contextWindowTooltipContent.autoCompactionHint}</div>
                      )}
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="app-thread-composer-footer-icon-button app-thread-composer-footer-meter-button"
                    aria-label={contextWindowTooltipContent.ariaLabel}
                  >
                    <ContextWindowUsageMeter percent={contextWindowUsage.percent} />
                  </button>
                </ComposerTooltip>
              )}
              <ComposerTooltip
                align="end"
                contentClassName="min-w-[84px] text-center"
                content={submitButtonTooltipContent}
              >
                <button
                  type="button"
                  disabled={isSubmitDisabled}
                  onClick={() => {
                    if (submitButtonMode === "stop") {
                      onStopTurn();
                      return;
                    }
                    void handleOpenSideChat().then((didOpenSideChat) => {
                      if (!didOpenSideChat) {
                        onSubmitTurn();
                      }
                    });
                  }}
                  className="app-thread-composer-submit-button"
                  aria-label={submitButtonAriaLabel}
                >
                  {submitButtonMode === "stop" ? "■" : "↑"}
                </button>
              </ComposerTooltip>
            </div>
          </div>
        </div>
      </div>

      {isFullAccessConfirmOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">
              {t("composer.mode.agentMode.fullAccessConfirm.title")}
            </div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("composer.mode.agentMode.fullAccessConfirm.description")}
            </div>
            <div className="app-text-muted mt-3 text-[13px] leading-6">
              {t("composer.mode.agentMode.fullAccessConfirm.caution")}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFullAccessConfirmOpen(false)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("composer.mode.agentMode.fullAccessConfirm.goBack")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onComposerPermissionModeChange("full-access");
                  setIsFullAccessConfirmOpen(false);
                }}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("composer.mode.agentMode.fullAccessConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ContextWindowUsageInfo = {
  percent: number;
  usedTokensK: number;
  contextWindowK: number;
};

type ContextWindowTooltipContent = {
  ariaLabel: string;
  autoCompactionHint: string | null;
  label: string;
  status: string;
  usage: string;
};

function getSubmitButtonTooltipContent({
  composerEnterBehavior,
  composerModifierLabel,
  followUpQueueMode,
  isResponseInProgress,
  submitButtonMode,
  t,
}: {
  composerEnterBehavior: ComposerEnterBehavior;
  composerModifierLabel: string;
  followUpQueueMode: FollowUpQueueMode;
  isResponseInProgress: boolean;
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (submitButtonMode === "stop") {
    return t("app.chat.stop");
  }

  if (!isResponseInProgress) {
    return t("app.chat.send");
  }

  const primaryLabel =
    followUpQueueMode === "queue"
      ? t("settings.general.followUpQueueMode.queue")
      : t("settings.general.followUpQueueMode.interrupt");
  const secondaryLabel =
    followUpQueueMode === "queue"
      ? t("settings.general.followUpQueueMode.interrupt")
      : t("settings.general.followUpQueueMode.queue");
  const primaryShortcut =
    composerEnterBehavior === "cmdIfMultiline"
      ? `${composerModifierLabel}+Enter`
      : "Enter";
  const secondaryShortcut =
    composerEnterBehavior === "cmdIfMultiline"
      ? "Enter"
      : `${composerModifierLabel}+Enter`;

  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1">
      <span>{primaryLabel}</span>
      <span className="justify-self-end text-[var(--app-shell-subtle)]">{primaryShortcut}</span>
      <span>{secondaryLabel}</span>
      <span className="justify-self-end text-[var(--app-shell-subtle)]">{secondaryShortcut}</span>
    </div>
  );
}

function getContextWindowUsageInfo(
  tokenUsageInfo: ThreadConversationTokenUsageInfo | null,
): ContextWindowUsageInfo | null {
  const usedTokens = tokenUsageInfo?.last.totalTokens ?? null;
  const contextWindow = tokenUsageInfo?.modelContextWindow ?? null;
  if (
    usedTokens === null ||
    contextWindow === null ||
    !Number.isFinite(usedTokens) ||
    !Number.isFinite(contextWindow) ||
    contextWindow <= 0
  ) {
    return null;
  }

  const boundedUsedTokens = Math.max(0, Math.min(usedTokens, contextWindow));
  return {
    percent: Math.round((boundedUsedTokens / contextWindow) * 100),
    usedTokensK: Math.round(usedTokens / 1000),
    contextWindowK: Math.round(contextWindow / 1000),
  };
}

function getContextWindowTooltipContent({
  contextWindowUsage,
  shouldShowAutoCompactionHint,
  t,
}: {
  contextWindowUsage: ContextWindowUsageInfo;
  shouldShowAutoCompactionHint: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}): ContextWindowTooltipContent {
  const remaining = Math.max(0, 100 - contextWindowUsage.percent);
  const label = t("composer.contextWindowUsageLabel");
  const status =
    contextWindowUsage.percent >= 50
      ? t("composer.contextWindowUsageStatusFull", {
          usage: contextWindowUsage.percent,
        })
      : t("composer.contextWindowUsageStatusLeft", {
          usage: contextWindowUsage.percent,
          remaining,
        });
  const usage = t("composer.contextWindowUsageTooltip", {
    usedTokens: contextWindowUsage.usedTokensK,
    contextWindow: contextWindowUsage.contextWindowK,
  });
  const autoCompactionHint = shouldShowAutoCompactionHint
    ? t("composer.contextWindow.autoCompactionTooltipLine1")
    : null;

  return {
    ariaLabel: [label, status, usage, autoCompactionHint].filter(Boolean).join(" "),
    autoCompactionHint,
    label,
    status,
    usage,
  };
}

function ContextWindowUsageMeter({ percent }: { percent: number }) {
  const normalizedPercent = Math.max(0, Math.min(percent, 100));
  const circumference = 2 * Math.PI * 5.75;
  const strokeLength = (normalizedPercent / 100) * circumference;

  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center text-[var(--app-shell-control-text-muted)]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle
          cx="9"
          cy="9"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.7"
        />
        <circle
          cx="9"
          cy="9"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeDasharray={`${Math.max(strokeLength, 0.001)} ${circumference}`}
          transform="rotate(-90 9 9)"
        />
      </svg>
    </span>
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

function sanitizeTooltipText(value: string) {
  return value.replace(/<\/?link>/gu, "");
}
