import type { ReactNode } from "react";
import { InfoIcon } from "../../components/AppShellIcons";
import type { AppToast } from "../../components/AppToastRegion";
import type { MessageKey } from "../../i18n/messages";
import { openInBrowser } from "../../services/hostFiles";
import type { RemoteTaskEnvironment } from "../../services/remoteTasks";
import { RemoteDiffApplyControl } from "./RemoteDiffApplyControl";

type RemoteConversationFooterProps = {
  composer: ReactNode;
  latestTurnPreview?: ReactNode;
  onShowToast?: (toast: AppToast) => void;
  remoteApplyDiff: string | null;
  remoteApplyTurnId: string | null;
  remoteTaskEnvironment: RemoteTaskEnvironment | null;
  remoteTaskId: string | null;
  showComposerFooter: boolean;
  showRemoteApplyFooter: boolean;
  showRemoteFailedFooter: boolean;
  workspaceRoot: string | null;
  footerPendingRequest?: ReactNode;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};

export function RemoteConversationFooter({
  composer,
  latestTurnPreview = null,
  onShowToast,
  remoteApplyDiff,
  remoteApplyTurnId,
  remoteTaskEnvironment,
  remoteTaskId,
  showComposerFooter,
  showRemoteApplyFooter,
  showRemoteFailedFooter,
  workspaceRoot,
  footerPendingRequest = null,
  t,
}: RemoteConversationFooterProps) {
  return (
    <div className="px-5 pb-4 pt-2">
      <div className="mx-auto w-full max-w-[var(--thread-composer-max-width)]">
        {latestTurnPreview ? <div className="mb-2">{latestTurnPreview}</div> : null}
        {showRemoteApplyFooter ? (
          <div className="mb-2">
            <RemoteDiffApplyControl
              variant="footer"
              diff={remoteApplyDiff}
              onShowToast={onShowToast}
              taskEnvironment={remoteTaskEnvironment}
              turnId={remoteApplyTurnId}
              workspaceRoot={workspaceRoot}
            />
          </div>
        ) : null}
        {showRemoteFailedFooter ? (
          <div className="mb-2">
            <RemoteFailedTurnBanner
              onOpenTaskInBrowser={
                remoteTaskId
                  ? () => void openInBrowser(`https://chatgpt.com/codex/tasks/${encodeURIComponent(remoteTaskId)}`)
                  : null
              }
              t={t}
            />
          </div>
        ) : null}
        {footerPendingRequest ? footerPendingRequest : showComposerFooter ? composer : null}
      </div>
    </div>
  );
}

function RemoteFailedTurnBanner({
  onOpenTaskInBrowser,
  t,
}: {
  onOpenTaskInBrowser: (() => void) | null;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card-error rounded-[18px] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <InfoIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-[13px] leading-6">
          {t("codex.remoteConversation.turnFailed")}
        </div>
        <div className="shrink-0">
          <button
            type="button"
            disabled={onOpenTaskInBrowser === null}
            onClick={() => onOpenTaskInBrowser?.()}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("codex.remoteConversation.openInWeb")}
          </button>
        </div>
      </div>
    </div>
  );
}
