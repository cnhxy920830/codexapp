import { AvatarSprite } from "../../components/appearance/AvatarSprite";
import type { AvatarOption } from "../../components/appearance/avatarData";
import type { MessageKey } from "../../i18n/messages";
import type { ComposerEnterBehavior } from "../../services/settings";
import type { FollowUpQueueMode, ReviewDelivery } from "../../services/settings";

const COMPOSER_MODIFIER_SYMBOL = "Ctrl";

type ThreadComposerProps = {
  followUpQueueMode: FollowUpQueueMode;
  isWorktreeThread: boolean;
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  queuedFollowUpCount: number;
  reviewDelivery: ReviewDelivery;
  selectedAvatar: AvatarOption;
  onComposerDraftChange: (value: string) => void;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  threadCwd: string | null;
  turnError: string | null;
};

export function ThreadComposer({
  followUpQueueMode,
  isWorktreeThread,
  composerDraft,
  composerEnterBehavior,
  queuedFollowUpCount,
  reviewDelivery,
  selectedAvatar,
  onComposerDraftChange,
  onStopTurn,
  onSubmitTurn,
  submitButtonMode,
  t,
  threadCwd,
  turnError,
}: ThreadComposerProps) {
  const helperText =
    composerEnterBehavior === "cmdIfMultiline"
      ? t("general.enterBehaviorDescription", { modifierSymbol: COMPOSER_MODIFIER_SYMBOL })
      : "";
  const isSubmitDisabled = submitButtonMode === "send" && composerDraft.trim().length === 0;
  const followUpModeLabelKey =
    followUpQueueMode === "queue"
      ? "settings.general.followUpQueueMode.queue"
      : "settings.general.followUpQueueMode.interrupt";
  const reviewDeliveryLabelKey =
    reviewDelivery === "inline"
      ? "settings.general.reviewDelivery.inline"
      : "settings.general.reviewDelivery.detached";

  return (
    <div className="app-card overflow-hidden rounded-[18px]">
      <div className="px-4 pt-4 pb-3">
        <textarea
          value={composerDraft}
          onChange={(event) => onComposerDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            const hasModifier = event.ctrlKey || event.metaKey;
            const hasMultilineContent = composerDraft.includes("\n");
            if (hasModifier) {
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="app-card-muted flex items-center gap-2 rounded-full px-2 py-1">
            <AvatarSprite avatar={selectedAvatar} size="sm" />
            <span className="text-[12px] leading-5">{selectedAvatar.displayName}</span>
          </div>
          {threadCwd ? (
            <div
              className="app-card-muted app-text-muted max-w-full truncate rounded-full px-3 py-1 text-[12px] leading-5"
              title={threadCwd}
            >
              {threadCwd}
            </div>
          ) : null}
          <div className="app-card-muted rounded-full px-3 py-1 text-[12px] leading-5">
            {isWorktreeThread
              ? t("settings.automations.executionEnvironment.worktree")
              : t("settings.automations.executionEnvironment.local")}
          </div>
          <div className="app-card-muted rounded-full px-3 py-1 text-[12px] leading-5">
            {t(followUpModeLabelKey)}
          </div>
          <div className="app-card-muted rounded-full px-3 py-1 text-[12px] leading-5">
            {t(reviewDeliveryLabelKey)}
          </div>
          {queuedFollowUpCount > 0 ? (
            <div className="app-card-muted rounded-full px-3 py-1 text-[12px] leading-5">
              {t("app.chat.queuedFollowUps", { count: queuedFollowUpCount })}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div
            className={[
              turnError ? "app-text-error" : "app-text-subtle",
              "min-h-[20px] min-w-0 flex-1 text-[12px] leading-5",
            ].join(" ")}
          >
            {turnError ?? helperText}
          </div>
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
            className="app-button-primary min-w-[72px] rounded-full px-4 py-1.5 text-[13px]"
          >
            {submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
