import { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarOption } from "../../components/appearance/avatarData";
import {
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
} from "../../components/AppShellIcons";
import type { MessageKey } from "../../i18n/messages";
import {
  getComposerModifierLabel,
  shouldInvertFollowUpOnEnter,
} from "../../lib/followUpShortcuts";
import type {
  ComposerEnterBehavior,
  ConfigSnapshot,
  FollowUpQueueMode,
  ReviewDelivery,
} from "../../services/settings";
import {
  getHotkeyPermissionOptionValue,
  getNextAgentModeFromOption,
  isDefaultPermissionsMode,
  type HotkeyPermissionAgentMode,
  type HotkeyPermissionsState,
} from "../hotkeyWindow/hotkeyPermissionsMode";

type ThreadComposerProps = {
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  composerPermissionConfig: ConfigSnapshot | null;
  composerPermissionMode: HotkeyPermissionAgentMode;
  composerPermissionsState: HotkeyPermissionsState;
  focusComposerNonce?: number | null;
  followUpQueueMode: FollowUpQueueMode;
  isWorktreeThread: boolean;
  pendingPdfCommentCount?: number;
  queuedFollowUpCount: number;
  reviewDelivery: ReviewDelivery;
  selectedAvatar: AvatarOption;
  onComposerDraftChange: (value: string) => void;
  onComposerPermissionModeChange: (mode: HotkeyPermissionAgentMode) => void;
  onClearPendingPdfComments?: (() => void) | null;
  onOpenWorkspaceFileSearch?: (() => void) | null;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadCwd: string | null;
  turnError: string | null;
};

type PermissionOptionValue =
  | "default"
  | "guardian-approvals"
  | "full-access"
  | "custom";

export function ThreadComposer({
  composerDraft,
  composerEnterBehavior,
  composerPermissionConfig,
  composerPermissionMode,
  composerPermissionsState,
  focusComposerNonce,
  followUpQueueMode,
  isWorktreeThread,
  pendingPdfCommentCount = 0,
  queuedFollowUpCount,
  reviewDelivery,
  selectedAvatar,
  onComposerDraftChange,
  onComposerPermissionModeChange,
  onClearPendingPdfComments = null,
  onOpenWorkspaceFileSearch = null,
  onStopTurn,
  onSubmitTurn,
  submitButtonMode,
  t,
  threadCwd,
  turnError,
}: ThreadComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const permissionMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPermissionMenuOpen, setIsPermissionMenuOpen] = useState(false);
  const [isFullAccessConfirmOpen, setIsFullAccessConfirmOpen] = useState(false);
  const composerModifierLabel = getComposerModifierLabel();
  const helperText =
    composerEnterBehavior === "cmdIfMultiline"
      ? t("general.enterBehaviorDescription", { modifierSymbol: composerModifierLabel })
      : "";
  const isSubmitDisabled =
    submitButtonMode === "send" &&
    composerDraft.trim().length === 0 &&
    pendingPdfCommentCount === 0;
  const canOpenWorkspaceFileSearch = onOpenWorkspaceFileSearch !== null;
  const permissionMenuValue = getHotkeyPermissionOptionValue(composerPermissionMode);
  const permissionTriggerLabel = isDefaultPermissionsMode(composerPermissionMode)
    ? t("composer.permissionsDropdown.default.label")
    : composerPermissionMode === "guardian-approvals"
      ? t("composer.permissionsDropdown.guardianApproval.shortLabel")
      : composerPermissionMode === "full-access"
        ? t("composer.permissionsDropdown.fullAccess.label")
        : t("composer.permissionsDropdown.custom.label");
  const permissionOptions = useMemo(() => {
    const options: Array<{ label: string; value: PermissionOptionValue }> = [];

    if (composerPermissionsState.canShowDefaultPermissions) {
      options.push({
        label: t("composer.permissionsDropdown.default.optionLabel"),
        value: "default",
      });
    }
    if (composerPermissionsState.canShowGuardian) {
      options.push({
        label: t("composer.mode.agentMode.guardianApprovals"),
        value: "guardian-approvals",
      });
    }
    if (composerPermissionsState.canShowFullAccess) {
      options.push({
        label: t("composer.permissionsDropdown.fullAccess.optionLabel"),
        value: "full-access",
      });
    }
    if (composerPermissionsState.canShowCustom) {
      options.push({
        label: t("composer.permissionsDropdown.custom.optionLabel"),
        value: "custom",
      });
    }

    return options;
  }, [composerPermissionsState, t]);
  const followUpModeLabelKey =
    followUpQueueMode === "queue"
      ? "settings.general.followUpQueueMode.queue"
      : "settings.general.followUpQueueMode.interrupt";
  const reviewDeliveryLabelKey =
    reviewDelivery === "inline"
      ? "settings.general.reviewDelivery.inline"
      : "settings.general.reviewDelivery.detached";
  const environmentLabel = isWorktreeThread
    ? t("settings.automations.executionEnvironment.worktree")
    : t("settings.automations.executionEnvironment.local");
  const projectLabel =
    threadCwd?.split(/[\\/]/).filter((segment) => segment.length > 0).at(-1) ?? null;
  const modeLabel = isWorktreeThread ? t("composer.mode.worktree") : t("composer.mode.local");
  const footerStatusLabel = [selectedAvatar.displayName, environmentLabel, projectLabel]
    .filter((value): value is string => value !== null && value.trim().length > 0)
    .join(" · ");
  const footerStatusTitle = [
    threadCwd,
    composerPermissionConfig?.sandboxMode,
    t(followUpModeLabelKey),
    t(reviewDeliveryLabelKey),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" · ");
  const helperOrStatusText = turnError ?? (helperText || footerStatusLabel || "\u00a0");

  const handleInsertMention = () => {
    const suffix = composerDraft.length > 0 && !/\s$/u.test(composerDraft) ? " @" : "@";
    onComposerDraftChange(`${composerDraft}${suffix}`);
    textareaRef.current?.focus();
  };

  const handlePermissionOptionChange = (value: PermissionOptionValue) => {
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

  return (
    <>
      <div className="app-thread-composer overflow-visible rounded-[24px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] shadow-[var(--app-shell-card-shadow)]">
        <div className="px-4 pt-4 pb-3">
          <textarea
            ref={textareaRef}
            value={composerDraft}
            onChange={(event) => onComposerDraftChange(event.target.value)}
            onKeyDown={(event) => {
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
                onSubmitTurn();
              }
            }}
            rows={4}
            placeholder={t("app.chat.composePlaceholder")}
            className="app-text-input min-h-[112px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
          />
        </div>

        <div className="border-t border-[var(--app-shell-border)] px-4 py-3">
          {pendingPdfCommentCount > 0 || queuedFollowUpCount > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {pendingPdfCommentCount > 0 ? (
                <div className="app-card-muted flex items-center gap-2 rounded-full px-3 py-1 text-[12px] leading-5">
                  <span>{t("commentAttachments.numAnnotations", { count: pendingPdfCommentCount })}</span>
                  {onClearPendingPdfComments == null ? null : (
                    <button
                      type="button"
                      onClick={onClearPendingPdfComments}
                      className="app-control-weak rounded-full px-2 py-0.5 text-[11px]"
                    >
                      {t("app.chat.removeQueuedFollowUp")}
                    </button>
                  )}
                </div>
              ) : null}
              {queuedFollowUpCount > 0 ? (
                <div className="app-card-muted rounded-full px-3 py-1 text-[12px] leading-5">
                  {t("app.chat.queuedFollowUps", { count: queuedFollowUpCount })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-end gap-3">
            <div
              className={[
                turnError ? "app-text-error" : "app-text-subtle",
                "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5",
              ].join(" ")}
              title={footerStatusTitle || undefined}
            >
              {helperOrStatusText}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative" ref={permissionMenuRef}>
                <button
                  type="button"
                  disabled={composerPermissionsState.isDropdownDisabled}
                  onClick={() => setIsPermissionMenuOpen((current) => !current)}
                  className="app-thread-composer-pill"
                  aria-label={permissionTriggerLabel}
                  title={permissionTriggerLabel}
                >
                  <span>{permissionTriggerLabel}</span>
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
                {isPermissionMenuOpen ? (
                  <div className="app-card absolute right-0 bottom-[calc(100%+10px)] z-20 min-w-[236px] rounded-[16px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                    {permissionOptions.map((option) => {
                      const selected = option.value === permissionMenuValue;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePermissionOptionChange(option.value)}
                          className="app-nav-item-idle flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]"
                        >
                          <span>{option.label}</span>
                          {selected ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {canOpenWorkspaceFileSearch ? (
                <button
                  type="button"
                  onClick={() => onOpenWorkspaceFileSearch?.()}
                  className="app-thread-composer-action-button"
                  aria-label={t("thread.sidePanel.openFile")}
                  title={t("thread.sidePanel.openFile")}
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleInsertMention}
                className="app-thread-composer-action-button"
                aria-label="@"
                title="@"
              >
                <span className="text-[15px] font-medium leading-none">@</span>
              </button>
              <button
                type="button"
                disabled={isSubmitDisabled}
                onClick={() => {
                  if (submitButtonMode === "stop") {
                    onStopTurn();
                    return;
                  }
                  onSubmitTurn();
                }}
                className="app-button-primary inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[12px] font-medium"
                aria-label={submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send")}
                title={submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send")}
              >
                {submitButtonMode === "stop" ? "■" : "↑"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="app-thread-composer-footer-pill">
              <span>{modeLabel}</span>
            </div>
            <div className="app-thread-composer-footer-pill">
              <span>{footerStatusLabel}</span>
            </div>
            <div className="app-thread-composer-footer-pill">
              <span>{t(followUpModeLabelKey)}</span>
            </div>
            <div className="app-thread-composer-footer-pill">
              <span>{t(reviewDeliveryLabelKey)}</span>
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
