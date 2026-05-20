import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { PromptEditor } from "../promptEditor";
import { readAppsSnapshot, type AppInfo } from "../../services/apps";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";
import type { MessageKey } from "../../i18n/messages";

type UserMessageEditComposerProps = {
  cwd: string | null;
  hostId: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (value: string) => Promise<void> | void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
  value: string;
};

export function UserMessageEditComposer({
  cwd,
  hostId,
  isSubmitting,
  onCancel,
  onDraftChange,
  onSubmit,
  t,
  value,
}: UserMessageEditComposerProps) {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      readAppsSnapshot({ hostId }).then((response) => response.data).catch(() => []),
      readSkillsSnapshot(cwd, { hostId }).catch(() => []),
    ]).then(([nextApps, nextSkills]) => {
      if (cancelled) {
        return;
      }
      setApps(nextApps);
      setSkills(nextSkills);
    });

    return () => {
      cancelled = true;
    };
  }, [cwd, hostId]);

  const handleDraftChange = (value: string) => {
    onDraftChange(value);
  };

  const handleSubmit = async () => {
    const nextText = value.trim();
    if (nextText.length === 0 || isSubmitting) {
      return;
    }
    await onSubmit(nextText);
  };

  return (
    <form
      className="relative flex w-full flex-col rounded-3xl bg-token-input-background/90 ring ring-black/10 backdrop-blur-lg electron:shadow-[0_4px_16px_0_rgba(0,0,0,0.05)] electron:dark:bg-token-dropdown-background"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex-grow overflow-y-auto px-3 pt-3">
          <PromptEditor
            ariaLabel={t("app.chat.userMessage.editTextareaAriaLabel")}
            autoFocus
            hostId={hostId}
            isIndented={false}
            onChange={handleDraftChange}
            onIndent={() => undefined}
            onOutdent={() => undefined}
            onSubmit={() => handleSubmit()}
            placeholder={t("app.chat.userMessage.editPlaceholder")}
            value={value}
            apps={apps}
            skills={skills}
            t={t}
          />
        </div>
        <div className="flex justify-end gap-1.5 px-3 pb-3">
          <Button
            type="button"
            color="outline"
            size="toolbar"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {t("app.chat.userMessage.cancelEditMessage")}
          </Button>
          <Button
            type="submit"
            color="primary"
            size="toolbar"
            loading={isSubmitting}
            disabled={value.trim().length === 0}
          >
            {t("app.chat.userMessage.sendEditedMessage")}
          </Button>
        </div>
      </div>
    </form>
  );
}
