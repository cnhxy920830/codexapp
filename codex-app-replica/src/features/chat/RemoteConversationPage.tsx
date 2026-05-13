import type { ReactNode } from "react";
import { CloudTaskIcon, InfoIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import { openInBrowser } from "../../services/hostFiles";

const REMOTE_TASK_WEB_BASE_URL = "https://chatgpt.com/codex/tasks";

function renderUnderlinedMessage(template: string) {
  const startTag = "<u>";
  const endTag = "</u>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const underlinedText = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <>
      {prefix}
      <span className="underline underline-offset-2">{underlinedText}</span>
      {suffix}
    </>
  );
}

export function RemoteConversationPage({
  children,
  taskId,
}: {
  children: ReactNode;
  taskId: string;
}) {
  const { t } = useI18n();
  const normalizedTaskId = taskId.trim();

  if (normalizedTaskId.length === 0) {
    return <>{children}</>;
  }

  const taskUrl = `${REMOTE_TASK_WEB_BASE_URL}/${encodeURIComponent(normalizedTaskId)}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        title={t("codex.remoteConversation.viewPreviousTurns")}
        onClick={() => void openInBrowser(taskUrl)}
        className="group flex items-center justify-center gap-1 bg-[rgba(59,130,246,0.10)] px-4 py-2 text-[13px] text-[var(--app-shell-text)] focus:outline-none"
      >
        <CloudTaskIcon className="h-4 w-4 shrink-0" />
        <span>{renderUnderlinedMessage(t("codex.remoteConversation.codexCloudTask"))}</span>
        <InfoIcon className="h-4 w-4 shrink-0 opacity-80 transition-opacity group-hover:opacity-100" />
      </button>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
