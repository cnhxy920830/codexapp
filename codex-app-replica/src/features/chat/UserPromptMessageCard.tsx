import { useState, type ReactElement, type ReactNode } from "react";
import {
  CheckIcon,
  CopyPathIcon,
} from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import { UserMessageCollapsibleContent } from "./UserMessageCollapsibleContent";
import { OpenPullRequestIcon } from "../pullRequests/PullRequestIcons";

const IMPLEMENT_PLAN_PROMPT_PREFIX = "PLEASE IMPLEMENT THIS PLAN:";
const PULL_REQUEST_MERGE_TASK_HEADING = "## Pull request merge task:";
const USER_REQUEST_HEADING = "## My request for Codex:";

export function UserPromptMessageCard({
  hostId,
  message,
}: {
  hostId: string;
  message: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const normalizedMessage = message.trim();
  const visibleText = normalizedMessage.startsWith(IMPLEMENT_PLAN_PROMPT_PREFIX)
    ? t("app.chat.userMessage.implementPlan")
    : message;
  const hasVisibleText = visibleText.trim().length > 0;
  const pullRequestMergeTaskNumber = getPullRequestMergeTaskNumber(message);

  const handleCopy = async () => {
    if (normalizedMessage.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Leave the message visible even when clipboard access is unavailable.
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {pullRequestMergeTaskNumber !== null ? (
        <UserMessageHeaderBadge
          icon={<OpenPullRequestIcon className="h-3.5 w-3.5 shrink-0" />}
          label={t("app.chat.userMessage.pullRequestMergeTask", {
            number: pullRequestMergeTaskNumber,
          })}
        />
      ) : null}
      <div className="group flex w-full flex-col items-end justify-end gap-1">
        <div
          className={[
            "app-user-message max-w-[77%] break-words rounded-2xl px-3 py-2 [&_.contain-inline-size]:[contain:initial]",
            hasVisibleText ? "" : "leading-none",
          ].join(" ")}
        >
          {hasVisibleText ? (
            <UserMessageCollapsibleContent
              hostId={hostId}
              text={visibleText}
              t={t}
            />
          ) : (
            <div className="app-text-subtle mb-px text-[13px] leading-6">
              {t("app.chat.userMessage.noContent")}
            </div>
          )}
        </div>
        {hasVisibleText ? (
          <div className="mr-1 ms-1 flex flex-row-reverse items-center gap-1 text-[12px] leading-4 text-[var(--app-shell-muted)]">
            <div className="flex items-center gap-1">
              <UserMessageActionTooltip
                content={copied
                  ? t("app.chat.userMessage.copyCopiedTooltip")
                  : t("app.chat.userMessage.copyTooltip")}
              >
                <button
                  type="button"
                  aria-label={copied
                    ? t("app.chat.userMessage.copyCopiedAriaLabel")
                    : t("app.chat.userMessage.copyAriaLabel")}
                  className="app-topbar-button inline-flex h-6 w-6 items-center justify-center rounded-full px-0 py-0 disabled:cursor-default"
                  disabled={copied}
                  onClick={() => {
                    void handleCopy();
                  }}
                >
                  {copied
                    ? <CheckIcon className="h-[14px] w-[14px]" />
                    : <CopyPathIcon className="h-[14px] w-[14px]" />}
                </button>
              </UserMessageActionTooltip>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserMessageHeaderBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="app-user-message-pill text-left">
      <span className="app-user-message-pill-icon">{icon}</span>
      <span className="app-user-message-pill-content">
        <span className="app-user-message-pill-label">{label}</span>
      </span>
    </span>
  );
}

function UserMessageActionTooltip({
  children,
  content,
}: {
  children: ReactElement;
  content: ReactNode;
}) {
  return (
    <div className="group relative flex shrink-0 items-center">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-[12px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-3 py-2 text-[12px] leading-5 whitespace-pre-line text-[var(--app-shell-text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

function getPullRequestMergeTaskNumber(message: string) {
  const sectionStart = message.indexOf(PULL_REQUEST_MERGE_TASK_HEADING);
  if (sectionStart === -1) {
    return null;
  }

  const sectionBodyStart = sectionStart + PULL_REQUEST_MERGE_TASK_HEADING.length;
  const remainingText = message.slice(sectionBodyStart);
  const requestHeadingIndex = remainingText.indexOf(USER_REQUEST_HEADING);
  const sectionText = requestHeadingIndex === -1
    ? remainingText
    : remainingText.slice(0, requestHeadingIndex);
  const match = sectionText.match(/^Pull request:\s*#(\d+)\s*$/m);
  if (match === null) {
    return null;
  }

  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? number : null;
}
