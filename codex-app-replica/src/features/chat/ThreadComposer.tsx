import type { MessageKey } from "../../i18n/messages";
import type { ComposerEnterBehavior } from "../../services/settings";

type ThreadComposerProps = {
  composerDraft: string;
  composerEnterBehavior: ComposerEnterBehavior;
  onComposerDraftChange: (value: string) => void;
  onStopTurn: () => void;
  onSubmitTurn: (invertFollowUpAction?: boolean) => void;
  submitButtonMode: "send" | "stop";
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  turnError: string | null;
};

export function ThreadComposer({
  composerDraft,
  composerEnterBehavior,
  onComposerDraftChange,
  onStopTurn,
  onSubmitTurn,
  submitButtonMode,
  t,
  turnError,
}: ThreadComposerProps) {
  return (
    <div className="app-card rounded-[18px] px-4 py-4">
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
        className="app-text-input min-h-[104px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 outline-none disabled:cursor-not-allowed"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="app-text-error min-h-[20px] text-[12px]">{turnError ?? ""}</div>
        <button
          type="button"
          disabled={submitButtonMode === "send" && composerDraft.trim().length === 0}
          onClick={() => {
            if (submitButtonMode === "stop") {
              onStopTurn();
              return;
            }
            onSubmitTurn();
          }}
          className="app-button-primary rounded-full px-4 py-1.5 text-[13px]"
        >
          {submitButtonMode === "stop" ? t("app.chat.stop") : t("app.chat.send")}
        </button>
      </div>
    </div>
  );
}
